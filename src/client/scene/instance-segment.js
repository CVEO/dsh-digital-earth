/**
 * scene/instance-segment.js — tiled 2D instance segmentation over a nadir frame.
 *
 * The capture (scene/ortho-capture.js) freezes one top-down frame. This module
 * walks it in overlapping windows, asks the host `/vision-instances` route for
 * polygons per window, maps the normalized 0..1000 answers back to the full
 * frame, projects them to WGS84 and merges duplicates across window borders.
 *
 * Window model (mirrors the reference pipeline):
 *   - core windows tile the frame: `count = ceil(size / (tileSize - 2*halo))`
 *     per axis, core sizes are equal shares of the image;
 *   - each request reads `core + halo` (clamped to the canvas), so an object is
 *     whole inside the request image even when it straddles a core border;
 *   - an instance belongs to the window whose core it intersects; halo-only
 *     instances are dropped because the neighbouring core already owns them;
 *   - a window that fails (HTTP / invalid JSON / a response with nothing usable)
 *     is quartered once when its core is still ≥128 px and depth allows,
 *     otherwise it lands in `failedWindows` and `complete` stays false. A single
 *     unusable polygon next to good ones is dropped, not retried.
 *
 * Output is 2D only: a WGS84 FeatureCollection with `class_id`, `class_key`,
 * `class_name`, `color`, `area_m2` and an optional `clippedAtTileEdge` marker.
 * No heights, no Z, no mesh/annotation side effects.
 *
 * Cancellation is cooperative and does NOT throw: an aborted `signal` stops the
 * loop, keeps instances collected so far and returns `cancelled: true` in the
 * result, so the workbench can keep the queue instead of losing it.
 */
import { classHex, classKeyOf } from './annotation-scheme.js'
import { ringAreaSquareMeters } from './ring-area.js'
import { polygonLooksLikeBox, ringCrossesItself, visionError } from './vision-geometry.js'
import { classWindows, traceWindows, agreesWithProposal, TRACE_ANGLE, unrotateOutline } from './instance-crops.js'
import { sameFootprint } from './instance-overlap.js'
import { captureOrtho } from './ortho-capture.js'

/** Frozen knobs for one extraction run (bounds mirror the host route). */
export const INSTANCE_LIMITS = Object.freeze({
  tileSize: 768,
  halo: 48,
  maxDepth: 1,
  maxCalls: 80,
  resolutionScale: 1.2,
  maxClasses: 12,
  maxClassNameChars: 16,
  maxClassDefinitionChars: 120,
  minCoreRetryEdge: 128,
  minPolygonPixels: 4,
  duplicateOverlap: 0.55,
  cutTolerancePx: 1.5,
})

/** Backend/view state that makes the rest of the run pointless. */
const ABORT_CODES = new Set(['unavailable', 'model_not_visual', 'model_unknown', 'invalid_request', 'not_ready', 'busy', 'model_changed'])

/** Default prompt definition for a class the user added without one. */
const CUSTOM_DEFINITION_PREFIX = '\u7528\u6237\u81ea\u5b9a\u4e49\uff1a'

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const clamp = (value, low, high) => (value < low ? low : value > high ? high : value)
const round7 = (value) => Math.round(value * 1e7) / 1e7
const round1 = (value) => Math.round(value * 10) / 10

function invalidRequest(stage, detail) {
  return visionError('invalid_request', { stage, detail })
}

/**
 * De-fang one user class field exactly like the host protocol does (control
 * characters, quotes and backticks removed, whitespace collapsed) so a label can
 * never steer the prompt and the host validator accepts what we send.
 */
function cleanClassText(raw) {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/["'`\u201c\u201d\u2018\u2019]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 1..8 classes with stable id/name/key/color, ready for the request and features. */
function normalizeClasses(classes) {
  if (!Array.isArray(classes) || classes.length === 0) {
    throw invalidRequest('classes', 'At least one class is required.')
  }
  if (classes.length > INSTANCE_LIMITS.maxClasses) {
    throw invalidRequest('classes', `At most ${INSTANCE_LIMITS.maxClasses} classes are supported.`)
  }
  const normalized = []
  const seen = new Set()
  for (const entry of classes) {
    if (!entry || typeof entry !== 'object') throw invalidRequest('classes', 'Every class must be an object.')
    const rawId = entry.id
    // The host protocol uses positive integer ids verbatim in the prompt/answer.
    if (!Number.isSafeInteger(rawId) || rawId <= 0) {
      throw invalidRequest('classes', 'Every class id must be a positive integer.')
    }
    if (seen.has(rawId)) throw invalidRequest('classes', `Duplicate class id ${rawId}.`)
    seen.add(rawId)
    const name = cleanClassText(entry.name)
    if (!name) throw invalidRequest('classes', 'Every class needs a non-empty name.')
    if ([...name].length > INSTANCE_LIMITS.maxClassNameChars) {
      throw invalidRequest('classes', `Class name must be at most ${INSTANCE_LIMITS.maxClassNameChars} characters.`)
    }
    const providedDefinition = cleanClassText(entry.definition)
    const definition = providedDefinition !== ''
      ? providedDefinition
      : `${CUSTOM_DEFINITION_PREFIX}${name}`
    if ([...definition].length > INSTANCE_LIMITS.maxClassDefinitionChars) {
      throw invalidRequest('classes', `Class definition must be at most ${INSTANCE_LIMITS.maxClassDefinitionChars} characters.`)
    }
    const key = typeof entry.key === 'string' && entry.key.trim() !== '' ? entry.key.trim() : (classKeyOf(name) ?? name)
    const color = typeof entry.color === 'string' && entry.color.trim() !== '' ? entry.color.trim() : classHex(name)
    normalized.push({ id: rawId, idKey: String(rawId), name, definition, key, color })
  }
  return normalized
}

function normalizeInteger(value, low, high, name) {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number) || number < low || number > high) {
    throw invalidRequest('options', `${name} must be an integer ${low}..${high}.`)
  }
  return number
}

/** Tile size / halo combination that keeps every request image ≤1024 px. */
function normalizeTiling(tileSize, halo) {
  const size = normalizeInteger(tileSize, 64, 1024, 'tileSize')
  const margin = normalizeInteger(halo, 0, 256, 'halo')
  if (size - 2 * margin < 64) {
    throw invalidRequest('options', 'halo leaves less than 64 px of core window; lower halo or raise tileSize.')
  }
  return { tileSize: size, halo: margin }
}

function normalizeBBoxFilter(bbox) {
  if (bbox == null) return null
  if (typeof bbox !== 'object') throw invalidRequest('bbox', 'bbox must be an object.')
  const { west, south, east, north } = bbox
  if (![west, south, east, north].every(isNumber)) throw invalidRequest('bbox', 'bbox corners must be finite numbers.')
  if (!(west < east) || !(south < north)) throw invalidRequest('bbox', 'bbox must satisfy west < east and south < north.')
  return { west, south, east, north }
}

function expandRect(core, margin, width, height) {
  const left = Math.max(0, core.left - margin)
  const top = Math.max(0, core.top - margin)
  const right = Math.min(width, core.left + core.width + margin)
  const bottom = Math.min(height, core.top + core.height + margin)
  return { left, top, width: right - left, height: bottom - top }
}

/**
 * Core windows + their padded request rects for one frame size.
 *
 * Exported so the window arithmetic is testable without a viewer. Every returned
 * `rect` is inside the frame and at most `tileSize` (≤1024) on both edges.
 */
export function planTileWindows({ width, height, tileSize = INSTANCE_LIMITS.tileSize, halo = INSTANCE_LIMITS.halo } = {}) {
  const widthPx = Math.round(Number(width))
  const heightPx = Math.round(Number(height))
  if (!(widthPx >= 32) || !(heightPx >= 32)) throw invalidRequest('image', 'Captured frame must be at least 32x32 device pixels.')
  const tiling = normalizeTiling(tileSize, halo)
  const step = tiling.tileSize - 2 * tiling.halo
  // One window when the whole frame fits one request tile; otherwise the
  // reference split applies to BOTH axes (a 1536x768 frame gets 3x2 windows).
  const singleWindow = widthPx <= tiling.tileSize && heightPx <= tiling.tileSize
  const columns = singleWindow ? 1 : Math.ceil(widthPx / step)
  const rows = singleWindow ? 1 : Math.ceil(heightPx / step)
  const coreWidth = Math.ceil(widthPx / columns)
  const coreHeight = Math.ceil(heightPx / rows)
  const windows = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const core = {
        left: column * coreWidth,
        top: row * coreHeight,
        width: Math.min(coreWidth, widthPx - column * coreWidth),
        height: Math.min(coreHeight, heightPx - row * coreHeight),
      }
      const rect = expandRect(core, tiling.halo, widthPx, heightPx)
      /* Defensive: the tiling rules above keep this ≤ tileSize, but a future
         change must fail loudly instead of sending an oversized image. */
      if (rect.width > 1024 || rect.height > 1024) {
        throw visionError('too_large', { stage: 'tiling', detail: `Window ${rect.width}x${rect.height} exceeds 1024 px.` })
      }
      windows.push({ id: `w${windows.length + 1}`, depth: 0, core, rect })
    }
  }
  return windows
}

/** Split one window core into four children (one retry level). */
function quarterWindow(window, width, height, margin) {
  const core = window.core
  const halfWidth = Math.ceil(core.width / 2)
  const halfHeight = Math.ceil(core.height / 2)
  const cells = [
    { left: core.left, top: core.top, width: halfWidth, height: halfHeight },
    { left: core.left + halfWidth, top: core.top, width: core.width - halfWidth, height: halfHeight },
    { left: core.left, top: core.top + halfHeight, width: halfWidth, height: core.height - halfHeight },
    { left: core.left + halfWidth, top: core.top + halfHeight, width: core.width - halfWidth, height: core.height - halfHeight },
  ]
  return cells
    .filter((cell) => cell.width > 0 && cell.height > 0)
    .map((cell, index) => ({
      id: `${window.id}.${index + 1}`,
      depth: window.depth + 1,
      core: cell,
      rect: expandRect(cell, margin, width, height),
    }))
}

function pixelBBox(points) {
  if (!Array.isArray(points) || points.length < 3) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const [x, y] of points) {
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }
  if (![left, top, right, bottom].every(isNumber)) return null
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

function shoelaceArea(points) {
  let sum = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    sum += current[0] * next[1] - next[0] * current[1]
  }
  return Math.abs(sum) / 2
}

function boxesIntersect(a, b) {
  if (!a || !b) return false
  return a.left < b.left + b.width && b.left < a.left + a.width &&
    a.top < b.top + b.height && b.top < a.top + a.height
}

function nearlySameProposal(a, b) {
  const width = Math.max(0, Math.min(a.left+a.width, b.left+b.width) - Math.max(a.left,b.left))
  const height = Math.max(0, Math.min(a.top+a.height, b.top+b.height) - Math.max(a.top,b.top))
  const intersection = width * height
  return intersection >= 0.65 * (a.width*a.height + b.width*b.height - intersection)
}

function pointInBBox(point, bbox) {
  return point.lon >= bbox.west && point.lon <= bbox.east && point.lat >= bbox.south && point.lat <= bbox.north
}

/**
 * Turn one protocol instance into a candidate, or null when the answer is not
 * usable geometry. Coordinates are the documented 0..1000 normalized space of the
 * request image with a small tolerance for models that overshoot by a pixel.
 */
function buildCandidate(raw, window, classesById, source) {
  const entry = classesById.get(String(raw?.classId))
  if (!entry) return null
  if (!Array.isArray(raw.polygon) || raw.polygon.length < 3 || raw.polygon.length > 2000) return null
  const normalized = []
  for (const vertex of raw.polygon) {
    if (!Array.isArray(vertex) || vertex.length < 2) return null
    const x = Number(vertex[0])
    const y = Number(vertex[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    if (x < -10 || x > 1010 || y < -10 || y > 1010) return null
    const point = [clamp(x, 0, 1000), clamp(y, 0, 1000)]
    if (normalized.at(-1)?.[0] !== point[0] || normalized.at(-1)?.[1] !== point[1]) normalized.push(point)
  }
  if (normalized.length && normalized[0][0] === normalized.at(-1)[0] && normalized[0][1] === normalized.at(-1)[1]) normalized.pop()
  if (normalized.length < 3 || ringCrossesItself(normalized)) return null
  const rect = window.rect
  const pixels = normalized.map(([x, y]) => [rect.left + (x / 1000) * rect.width, rect.top + (y / 1000) * rect.height])
  const bbox = pixelBBox(pixels)
  if (!bbox) return null
  if (bbox.width < 2 || bbox.height < 2) return null
  const areaPx = shoelaceArea(pixels)
  if (!(areaPx >= INSTANCE_LIMITS.minPolygonPixels)) return null
  const ring = []
  let sumLon = 0
  let sumLat = 0
  for (const [x, y] of pixels) {
    const point = source.lonLat(x, y)
    // A partially projected ring would be a fake outline: drop the instance.
    if (!point || !isNumber(point.lon) || !isNumber(point.lat)) return null
    ring.push([point.lon, point.lat])
    sumLon += point.lon
    sumLat += point.lat
  }
  if (ring.length < 3) return null
  return {
    classId: entry.id,
    classKey: entry.key,
    className: entry.name,
    color: entry.color,
    pixels,
    bbox,
    areaPx,
    ring,
    centroid: { lon: sumLon / ring.length, lat: sumLat / ring.length },
    clipped: bbox.left <= rect.left + INSTANCE_LIMITS.cutTolerancePx ||
      bbox.top <= rect.top + INSTANCE_LIMITS.cutTolerancePx ||
      bbox.right >= rect.left + rect.width - INSTANCE_LIMITS.cutTolerancePx ||
      bbox.bottom >= rect.top + rect.height - INSTANCE_LIMITS.cutTolerancePx,
    windowId: window.id,
  }
}

/**
 * Merge one candidate into the kept list.
 *
 * Use overlap of traced interiors to distinguish seam duplicates from adjacent
 * parcels with overlapping bounding boxes. A non-clipped copy replaces a clipped one,
 * otherwise the larger copy wins.
 */
function keepCandidate(kept, candidate) {
  let duplicateIndex = -1
  for (let index = 0; index < kept.length; index += 1) {
    const existing = kept[index]
    if (existing.classKey !== candidate.classKey) continue
    if (
      boxesIntersect(existing.bbox, candidate.bbox) &&
      sameFootprint(existing, candidate, INSTANCE_LIMITS.duplicateOverlap)
    ) {
      duplicateIndex = index
      break
    }
  }
  if (duplicateIndex < 0) {
    kept.push(candidate)
    return 'kept'
  }
  const existing = kept[duplicateIndex]
  const replace =
    (existing.clipped === true && candidate.clipped !== true) ||
    (existing.clipped === candidate.clipped && candidate.areaPx > existing.areaPx)
  if (replace) kept[duplicateIndex] = candidate
  return 'duplicate'
}

function buildFeature(candidate) {
  const ring = candidate.ring.map(([lon, lat]) => [round7(lon), round7(lat)])
  ring.push(ring[0].slice())
  const area = ringAreaSquareMeters(ring)
  if (!(area > 0)) return null
  return {
    type: 'Feature',
    properties: {
      class_id: candidate.classId,
      class_key: candidate.classKey,
      class_name: candidate.className,
      color: candidate.color,
      area_m2: round1(area),
      ...(candidate.clipped ? { clippedAtTileEdge: true } : {}),
    },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

/** One POST to the host instance route. Returns `{payload}` or `{error: code}`. */
async function postWindow({ url, image, classes, fetchImpl, signal, mode, slots, sessionId, modelRoute, namedLabels, reuse }) {
  let response = null
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      credentials: 'same-origin',
      signal,
      headers: {
        'content-type': 'application/json', 'x-dsh-panel': 'vision-instances',
        ...(reuse ? { 'x-dsh-reuse': '1' } : {}),
        ...(sessionId ? { 'x-dsh-session': sessionId } : {}),
        ...(modelRoute ? { 'x-dsh-model-route': modelRoute } : {}),
      },
      body: JSON.stringify({ image, classes, mode, slots, ...(mode === 'locate' && namedLabels ? { namedLabels: true } : {}) }),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return { error: typeof error?.code === 'string' ? error.code : 'network' }
  }
  if (!response || response.ok !== true) {
    let payload = null
    try { payload = await response.json() } catch { payload = null }
    if (typeof payload?.code === 'string') return { error: payload.code, usage:payload.usage }
    const status = Number(response?.status)
    return { error: Number.isFinite(status) && status > 0 ? `http_${status}` : 'http_error' }
  }
  let payload = null
  try { payload = await response.json() } catch { return { error: 'invalid_json' } }
  if (!payload || payload.ok !== true || !Array.isArray(mode === 'locate' ? payload.boxes : payload.instances)) {
    return { error: typeof payload?.code === 'string' ? payload.code : 'invalid_result' }
  }
  return { payload }
}

function isAbort(error, signal) {
  return signal?.aborted === true || error?.name === 'AbortError'
}

/**
 * Extract instance polygons from the current view as a 2D WGS84 FeatureCollection.
 *
 * @param {object} options
 * @param {object} options.viewer Cesium viewer (see captureOrtho)
 * @param {object} options.Cesium Cesium namespace
 * @param {{visionInstancesUrl:string}} options.meta host panel meta with the route
 * @param {{west:number,south:number,east:number,north:number}|null} [options.bbox]
 *   AOI to frame and to filter by (centroid must be inside)
 * @param {{id:number|string,name:string,definition?:string,key?:string,color?:string}[]} options.classes
 * @param {number} [options.resolutionScale] device pixel multiplier passed to the capture
 * @param {number} [options.tileSize] core window size, default 768
 * @param {number} [options.halo] request padding around every core, default 48
 * @param {boolean} [options.multiScale] also search overlapping half-size cores
 * @param {boolean} [options.namedLabels] return literal class names in mixed-class localization
 * @param {boolean} [options.separateClasses] localize one class per request
 * @param {boolean} [options.reuse] allow exact request reuse in the host session
 * @param {number} [options.maxDepth] one-level retry depth, default 1
 * @param {number} [options.maxCalls] model request cap, default 80
 * @param {AbortSignal|null} [options.signal]
 * @param {(progress: {phase:'window',done:number,total:number,found:number,windowId:string,error?:string}) => void} [options.onProgress]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<{
 *   collection: {type:'FeatureCollection', features: object[]},
 *   cancelled: boolean,
 *   report: {
 *     calls: number, windows: number,
 *     failedWindows: {windowId:string,depth:number,reason:string}[],
 *     complete: boolean, instances: number, durationMs: number,
 *     source: {width:number,height:number,bbox:object|null},
 *     errors: {windowId:string,depth:number,reason:string}[],
 *   },
 * }>}
 * @throws code `invalid_request` | `unavailable` | `not_ready` | `too_large`
 */
export async function segmentInstances({
  viewer,
  Cesium,
  meta,
  bbox = null,
  classes,
  resolutionScale = INSTANCE_LIMITS.resolutionScale,
  tileSize = INSTANCE_LIMITS.tileSize,
  halo = INSTANCE_LIMITS.halo,
  sessionId = null,
  multiScale = false,
  namedLabels = false,
  separateClasses = false,
  reuse = false,
  maxDepth = INSTANCE_LIMITS.maxDepth,
  maxCalls = INSTANCE_LIMITS.maxCalls,
  signal = null,
  onProgress,
  fetchImpl = globalThis.fetch,
  captureFrame = captureOrtho,
} = {}) {
  const normalizedClasses = normalizeClasses(classes)
  const classesById = new Map(normalizedClasses.map((entry) => [entry.idKey, entry]))
  const requestClasses = normalizedClasses.map(({ id, name, definition }) => ({ id, name, definition }))
  const url = typeof meta?.visionInstancesUrl === 'string' ? meta.visionInstancesUrl.trim() : ''
  if (!url) throw visionError('unavailable', { stage: 'instance_segment', detail: 'meta.visionInstancesUrl is missing.' })
  if (typeof fetchImpl !== 'function') throw visionError('unavailable', { stage: 'instance_segment', detail: 'fetch is unavailable.' })
  const tiling = normalizeTiling(tileSize, halo)
  const depthLimit = normalizeInteger(maxDepth, 0, 3, 'maxDepth')
  const callLimit = normalizeInteger(maxCalls, 1, 500, 'maxCalls')
  const filterBBox = normalizeBBoxFilter(bbox)
  const emit = typeof onProgress === 'function' ? onProgress : () => {}

  const startedAt = Date.now()
  const kept = []
  const errors = []
  const failedWindows = []
  let modelRoute = null
  let modelUsed = null
  let calls = 0
  let reusedCalls = 0
  let measuredCalls = 0
  let totalTokens = 0
  let windows = 0
  let cancelled = false
  let capture = null

  const finish = () => {
    const features = []
    for (const candidate of kept) {
      const feature = buildFeature(candidate)
      if (feature) features.push(feature)
    }
    return {
      collection: { type: 'FeatureCollection', features },
      cancelled,
      report: {
        calls,
        reusedCalls,
        modelUsed,
        multiScale,
        usage: measuredCalls ? { totalTokens, measuredCalls } : null,
        windows,
        failedWindows,
        complete: failedWindows.length === 0 && !cancelled,
        instances: features.length,
        durationMs: Date.now() - startedAt,
        source: capture
          ? { width: capture.width, height: capture.height, bbox: capture.bbox }
          : { width: 0, height: 0, bbox: null },
        errors,
      },
    }
  }

  if (signal?.aborted) {
    cancelled = true
    return finish()
  }

  try {
    capture = await captureFrame({ viewer, Cesium, bbox: filterBBox, resolutionScale, signal })
  } catch (error) {
    if (signal?.aborted) {
      cancelled = true
      return finish()
    }
    throw error
  }

  try {
    if (signal?.aborted) {
      cancelled = true
      return finish()
    }
    const baseWindows = planTileWindows({ width: capture.width, height: capture.height, tileSize: tiling.tileSize, halo: tiling.halo })

    const seenProposals = new Map()
    const queue = meta.visionGroundedInstances === true ? classWindows(baseWindows, normalizedClasses, separateClasses) : baseWindows

    // A camera/viewport move invalidates every pixel→lon/lat conversion in the
    // frozen frame, so the run stops instead of emitting displaced outlines.
    const assertSceneStillValid = () => {
      if (typeof capture.source.isValid === 'function' && !capture.source.isValid()) {
        throw visionError('scene_changed', {
          stage: 'instance_segment',
          detail: 'Camera or viewport moved while the instance run was in flight.',
        })
      }
    }

    const progress = (windowId, error) => {
      const event = {
        phase: 'window',
        done: windows,
        total: windows + queue.length,
        found: kept.length,
        windowId,
        ...(error ? { error } : {}),
      }
      try { emit(event) } catch { /* a broken progress callback must not fail the run */ }
    }

    const ingest = (payload, window) => {
      let usable = 0
      let invalid = 0
      for (const raw of payload.instances) {
        // A single unusable polygon is dropped, not retried: the model already
        // saw this crop. Only a window where NOTHING usable came back is treated
        // as a protocol break and quartered (see the caller).
        if (window.classId && raw?.classId !== window.classId) { invalid++; continue }
        const candidate = buildCandidate(raw, window, classesById, capture.source)
        if (!candidate || (window.proposal && !agreesWithProposal(candidate, window))) {
          invalid += 1
          continue
        }
        // Halo-only instances belong to a neighbour core; keeping them would
        // duplicate every object twice.
        if (!boxesIntersect(candidate.bbox, window.core)) continue
        usable += 1
        if (filterBBox && !pointInBBox(candidate.centroid, filterBBox)) continue
        keepCandidate(kept, candidate)
      }
      return { usable, invalid }
    }

    while (queue.length > 0) {
      if (signal?.aborted) {
        cancelled = true
        break
      }
      assertSceneStillValid()
      const window = queue.shift()
      windows += 1
      if (calls >= callLimit) {
        failedWindows.push({ windowId: window.id, depth: window.depth, reason: 'max_calls' })
        progress(window.id, 'max_calls')
        continue
      }
      // A read guard failure (oversized rect, lost canvas) is a configuration
      // problem, not a model failure: it aborts the run instead of retrying.
      const group = [window]
      if (window.mode === 'trace' && !window.single && capture.source.readSheet) {
        while (group.length < 4 && queue[0]?.mode === 'trace' && !queue[0].single) group.push(queue.shift())
      }
      windows += group.length - 1
      const mode = group.length > 1 ? 'trace_batch' :
        (window.mode ?? (meta.visionGroundedInstances === true ? 'locate' : 'polygon'))
      const slots = group.length > 1 ? group.map(task => task.classId) : undefined
      const image = window.turned ? capture.source.readTurned(window.rect, TRACE_ANGLE) : slots ? capture.source.readSheet(group) :
        capture.source.read(window.rect, mode === 'locate' ? 640 : mode === 'trace' ? 384 : 0)
      const tileClasses = window.mode === 'trace' ? requestClasses.filter(cls => group.some(task => task.classId === cls.id)) :
        (window.classIds ? requestClasses.filter(cls => window.classIds.includes(cls.id)) : requestClasses)
      calls += 1
      let outcome
      try {
        outcome = await postWindow({ url, image, classes: tileClasses, fetchImpl, signal, mode, slots, sessionId, modelRoute, namedLabels, reuse })
      } catch (error) {
        if (isAbort(error, signal)) {
          cancelled = true
          break
        }
        outcome = { error: typeof error?.code === 'string' ? error.code : 'network' }
      }
      if (signal?.aborted) {
        cancelled = true
        break
      }
      assertSceneStillValid()

      if (outcome.payload?.reused) reusedCalls++
      if (outcome.payload?.modelRoute) modelRoute = outcome.payload.modelRoute
      if (outcome.payload?.model) modelUsed = outcome.payload.model
      const tokens = (outcome.payload?.usage ?? outcome.usage)?.total_tokens
      if (Number.isSafeInteger(tokens) && tokens >= 0) { totalTokens += tokens; measuredCalls++ }
      if (slots && !ABORT_CODES.has(outcome.error)) {
        // Preserve usable siblings and retry only the failed crops individually.
        const verify = new Set()
        const retry = new Set(outcome.error ? slots.map((_, i) => i+1) : outcome.payload.retrySlots)
        for (const raw of outcome.payload?.instances ?? []) {
          const task = group[raw.slot-1]
          if (!task || raw.classId !== task.classId) continue
          if (capture.source.readTurned && polygonLooksLikeBox(raw.polygon, 5)) {
            verify.add(raw.slot)
            retry.add(raw.slot)
            continue
          }
          if (ingest({instances:[raw]}, task).invalid) retry.add(raw.slot)
        }
        for (const slot of retry) {
          const task = group[slot-1]
          if (task) queue.push({...task, single:true, turned:verify.has(slot)})
        }
        if (outcome.error) errors.push({windowId:window.id, reason:outcome.error, depth:window.depth})
        progress(window.id)
        continue
      }
      if (!outcome.error && mode === 'locate') {
        let tasks = traceWindows(outcome.payload.boxes, window, capture.width, capture.height, classesById)
        if (multiScale && !window.classProbe) {
          if (window.depth === 0 && Math.min(window.core.width, window.core.height) >= 128) {
            const margin = Math.min(tiling.halo, Math.ceil(Math.min(window.core.width, window.core.height) / 8))
            queue.push(...quarterWindow(window, capture.width, capture.height, margin).map(child => ({
              ...child, detail: true, classIds: window.classIds,
            })))
          }
          tasks = tasks.filter(task => {
            const previous = seenProposals.get(task.classId) ?? []
            const box = task.proposal
            if (window.detail && previous.some(b => nearlySameProposal(b, box))) return false
            previous.push(box)
            seenProposals.set(task.classId, previous)
            return true
          })
        }
        // Reserve a tracing turn so a large viewport cannot consume every call on detection.
        if (window.classProbe) for (const task of tasks) task.single = true
        const probes = []
        // A crowded multi-class answer can spend its entire output on repeated
        // roofs and leave just one pond. Recheck sparse classes before spending
        // the remaining tracing budget on the dominant class.
        if (tileClasses.length > 1 && tasks.length > Math.max(16, (callLimit - calls) / 2)) {
          const counts = new Map()
          for (const task of tasks) counts.set(task.classId, (counts.get(task.classId) ?? 0) + 1)
          for (const cls of tileClasses) {
            if (counts.get(cls.id) === 1 && probes.length < 3) {
              probes.push({ ...window, id: window.id + '/check' + cls.id, classIds: [cls.id], classProbe: true })
            }
          }
        }
        const first = tasks.splice(0, window.classProbe ? tasks.length : (capture.source.readSheet ? 4 : 1))
        queue.unshift(...probes, ...first)
        queue.push(...tasks)
        progress(window.id)
        continue
      }
      if (!outcome.error && mode === 'trace' && outcome.payload.instances.length === 1 && capture.source.readTurned) {
        const raw = outcome.payload.instances[0]
        const isBox = polygonLooksLikeBox(raw.polygon, 5)
        if (window.turned) {
          const ring = !isBox && unrotateOutline(raw.polygon)
          if (!ring) outcome = {error:'unverified_outline'}
          else outcome.payload.instances = [{...raw, polygon:ring}]
        } else if (isBox) {
          queue.push({...window, single:true, turned:true})
          progress(window.id)
          continue
        }
      }
      if (!outcome.error) {
        const parsed = ingest(outcome.payload, window)
        // A response full of unusable polygons is a protocol break: retry the
        // window instead of reporting an empty (but "successful") block.
        if (outcome.payload.instances.length > 0 && parsed.usable === 0 && parsed.invalid > 0) {
          outcome = { error: 'invalid_instances' }
        } else {
          progress(window.id)
          continue
        }
      }

      if (ABORT_CODES.has(outcome.error)) {
        // Backend/payload state that would fail every remaining tile: stop with
        // the real code instead of burning the call budget on retries.
        throw visionError(outcome.error, {
          stage: 'instance_segment',
          detail: 'The host vision route rejects the instance request.',
        })
      }
      errors.push({ windowId: window.id, depth: window.depth, reason: outcome.error })
      const canRetry = mode !== 'trace' && window.depth < depthLimit &&
        Math.min(window.core.width, window.core.height) >= INSTANCE_LIMITS.minCoreRetryEdge
      if (canRetry) {
        // Depth-first: process the four children before the next sibling window.
        const children = quarterWindow(window, capture.width, capture.height, tiling.halo)
        queue.unshift(...children.map(child => ({ ...child, classIds: window.classIds })))
      } else {
        failedWindows.push({ windowId: window.id, depth: window.depth, reason: outcome.error })
      }
      progress(window.id, outcome.error)
    }
    return finish()
  } finally {
    try { capture?.restore?.() } catch { /* the viewer may be gone */ }
  }
}
