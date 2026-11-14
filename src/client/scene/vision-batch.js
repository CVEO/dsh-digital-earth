/**
 * scene/vision-batch.js — F6: parse one screenshot into object outlines.
 *
 * The single-target vision path (scene/vision-frame.js) magnifies a crop around
 * a click and returns one silhouette. Scene parsing is the opposite problem: one
 * full viewport image in, up to 40 outlines out, each normalized to the image.
 * This module owns the capture, the host request and the projection back onto
 * the surface. Everything that can be tested without Cesium is a pure function.
 *
 * Honesty rules: results are model output, so every feature is stamped
 * `source: vision_model`, `basis: inferred`, `approximate: true`. Projection is
 * best-effort — an outline over sky or a hole keeps the rest of the ring and
 * reports how many candidates had to be skipped.
 */
import { createHeightService } from '../analysis/height-service.js'
import { offsetCartographic } from './selection.js'
import { parseClassColor } from './vector-style.js'
import { projectVisionPolygon } from './vision-frame.js'
import { containsVisionPoint, distanceToPolygon, visionError } from './vision-geometry.js'
import { polygonAreaSquareMeters } from './screen-geodesy.js'

const round1 = (value) => Math.round(value * 10) / 10

export const MAX_PARSE_OBJECTS = 40
export const PARSE_DEDUPE_IOU = 0.5
export const PARSE_CLASSES = ['building', 'vegetation', 'water', 'road', 'vehicle', 'other']
export const PARSE_FLOOR_HEIGHT_M = 3.0
const AOI_SELECTION_KINDS = new Set(['rectangle', 'lasso', 'area', 'vision'])
const EXTERIOR_RING_RADII_M = [6, 14]
const BATCH_NAME_KEYS = new Set(['name', 'label', 'building_name', 'bldg_name', 'title', '名称', '建筑名称'])
const BATCH_HEIGHT_KEYS = new Set(['height', 'height_m', 'building_height', 'bldg_height', 'h', '建筑高度', '高度'])
const BATCH_FLOOR_KEYS = new Set(['floors', 'floor', 'levels', 'num_floors', 'stories', 'storeys', '楼层', '层数', '地上层数'])

function sceneLoading(getLayers) {
  return getLayers().some((layer) => layer?.visible !== false && layer?.tileset?.tilesLoaded === false)
}

/** True when a viewer selection describes a ground polygon usable as an AOI crop. */
export function isAoiSelectionCapable(selection) {
  if (!selection || !AOI_SELECTION_KINDS.has(selection.kind)) return false
  const hasPositions = Array.isArray(selection.positions) && selection.positions.length >= 3
  const hasRing = Array.isArray(selection.ring) && selection.ring.length >= 3
  return hasPositions || hasRing
}

/** Project a committed ground selection into viewport CSS pixel bounds. */
export function computeSelectionScreenCrop(viewer, Cesium, selection, { padPx = 14, minSizePx = 32 } = {}) {
  const canvas = viewer?.canvas ?? viewer?.scene?.canvas
  const cssWidth = Number(canvas?.clientWidth ?? canvas?.width ?? 0)
  const cssHeight = Number(canvas?.clientHeight ?? canvas?.height ?? 0)
  if (!viewer?.scene || !(cssWidth > 0) || !(cssHeight > 0)) {
    return { ok: false, reason: 'not_ready', crop: null }
  }
  if (!isAoiSelectionCapable(selection)) {
    return { ok: false, reason: 'no_selection', crop: null }
  }
  const toScreen = Cesium?.SceneTransforms?.worldToWindowCoordinates
  if (typeof toScreen !== 'function') {
    return { ok: false, reason: 'not_ready', crop: null }
  }
  let worldPoints = Array.isArray(selection.positions) && selection.positions.length >= 3 ? selection.positions : null
  if (!worldPoints && Array.isArray(selection.ring) && typeof Cesium?.Cartesian3?.fromDegrees === 'function') {
    const z = Number.isFinite(selection.heightRange?.mean)
      ? selection.heightRange.mean
      : Number.isFinite(selection.heightRange?.min)
        ? selection.heightRange.min
        : 0
    worldPoints = selection.ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, z))
  }
  if (!Array.isArray(worldPoints) || worldPoints.length < 3) {
    return { ok: false, reason: 'no_selection', crop: null }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, projectedCount = 0
  for (const cartesian of worldPoints) {
    let pt = null
    try {
      pt = toScreen.call(Cesium.SceneTransforms, viewer.scene, cartesian)
    } catch {
      pt = null
    }
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue
    projectedCount += 1
    if (pt.x < minX) minX = pt.x
    if (pt.y < minY) minY = pt.y
    if (pt.x > maxX) maxX = pt.x
    if (pt.y > maxY) maxY = pt.y
  }
  if (projectedCount < 2 || maxX <= 0 || maxY <= 0 || minX >= cssWidth || minY >= cssHeight) {
    return { ok: false, reason: 'aoi_offscreen', crop: null }
  }
  const left = Math.max(0, Math.floor(minX - padPx))
  const top = Math.max(0, Math.floor(minY - padPx))
  const right = Math.min(cssWidth, Math.ceil(maxX + padPx))
  const bottom = Math.min(cssHeight, Math.ceil(maxY + padPx))
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  if (width < minSizePx || height < minSizePx) {
    return { ok: false, reason: 'aoi_offscreen', crop: null }
  }
  return {
    ok: true,
    crop: { left, top, width, height },
    kind: selection.kind,
    area_m2: Number.isFinite(selection.area_m2) ? selection.area_m2 : null,
    cssWidth,
    cssHeight,
  }
}

/** Viewport or AOI screenshot (keeps crop bounds so vision-frame projects back accurately). */
export function captureSceneFrame({ viewer, Cesium, getLayers = () => [], selection = null, scope = 'view' }) {
  if (!viewer?.scene || viewer.isDestroyed?.()) throw visionError('not_ready')
  const canvas = viewer.canvas, scene = viewer.scene
  if (typeof document === 'undefined' || !canvas?.clientWidth || !canvas?.clientHeight || document.visibilityState === 'hidden') throw visionError('not_ready')
  if (sceneLoading(getLayers) || scene.globe?.tilesLoaded === false) throw visionError('scene_loading')
  const cssWidth = canvas.clientWidth, cssHeight = canvas.clientHeight
  const effectiveScope = scope === 'aoi' ? 'aoi' : 'view'
  let crop = { left: 0, top: 0, width: cssWidth, height: cssHeight }
  let aoi = null
  if (effectiveScope === 'aoi') {
    const aoiBounds = computeSelectionScreenCrop(viewer, Cesium, selection)
    if (!aoiBounds.ok) throw visionError(aoiBounds.reason === 'no_selection' ? 'no_selection' : 'aoi_offscreen')
    crop = aoiBounds.crop
    aoi = { kind: aoiBounds.kind, area_m2: aoiBounds.area_m2, crop }
  }
  viewer.camera.cancelFlight?.()
  viewer.render()
  const scaleX = canvas.width / cssWidth, scaleY = canvas.height / cssHeight
  const srcX = Math.max(0, Math.round(crop.left * scaleX))
  const srcY = Math.max(0, Math.round(crop.top * scaleY))
  const sourceWidth = Math.max(1, Math.min(canvas.width - srcX, Math.round(crop.width * scaleX)))
  const sourceHeight = Math.max(1, Math.min(canvas.height - srcY, Math.round(crop.height * scaleY)))
  const scale = Math.min(1, 1024 / Math.max(sourceWidth, sourceHeight))
  const image = document.createElement('canvas')
  image.width = Math.max(32, Math.round(sourceWidth * scale))
  image.height = Math.max(32, Math.round(sourceHeight * scale))
  const context = image.getContext('2d')
  if (!context) throw visionError('not_ready')
  context.drawImage(canvas, srcX, srcY, sourceWidth, sourceHeight, 0, 0, image.width, image.height)
  const dataUrl = image.toDataURL('image/jpeg', 0.82)
  if (dataUrl.length > 2_000_000) throw visionError('too_large')
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `frame-${Date.now()}`,
    dataUrl, width: image.width, height: image.height,
    crop,
    scope: effectiveScope,
    aoi,
    cssWidth, cssHeight, viewer, Cesium, point: [0.5, 0.5],
    isValid: () => !viewer.isDestroyed?.(),
    release: () => {},
  }
}

/** POST the frame to the page-only batch route and return the validated object list. */
export async function requestSceneParse(url, { frame, signal, fetchImpl = globalThis.fetch } = {}) {
  if (typeof url !== 'string' || !url) throw visionError('unavailable')
  if (typeof fetchImpl !== 'function') throw visionError('unavailable')
  const response = await fetchImpl(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-dsh-panel': 'vision-batch' },
    body: JSON.stringify({ frameId: frame.id, image: frame.dataUrl, scope: frame.scope === 'aoi' ? 'aoi' : 'view' }),
    signal,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw visionError(payload?.code ?? 'model_failed', { next: payload?.next })
  if (!Array.isArray(payload.objects)) throw visionError('invalid_result')
  return payload
}

/** Mean of the normalized vertices; used as the "inside" point for projection. */
export function batchPolygonCenter(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return null
  let x = 0, y = 0
  for (const [px, py] of polygon) { x += px; y += py }
  const point = [x / polygon.length, y / polygon.length]
  if (!point.every((number) => Number.isFinite(number) && number >= 0 && number <= 1)) return null
  return [Math.min(0.999, Math.max(0.001, point[0])), Math.min(0.999, Math.max(0.001, point[1]))]
}

function classLabel(t, kind) {
  const key = `parse.class.${kind}`
  const label = typeof t === 'function' ? t(key) : key
  return typeof label === 'string' && label !== key ? label : kind
}

const ANCHOR_GRID = 9
const ANCHOR_ROUNDS = 4

/**
 * A point that sits inside the outline whenever one exists.
 *
 * The vertex mean is right for convex footprints but falls outside L/U shaped
 * ones; validateVisionPolygon rejects an anchor further than 0.08 outside, so a
 * concave building would be skipped without the user ever knowing. Sample a
 * shrinking grid inside the normalized bbox and keep the point furthest from
 * the boundary; fall back to the mean for degenerate outlines.
 */
export function batchPolygonAnchor(polygon) {
  const fallback = batchPolygonCenter(polygon)
  if (!Array.isArray(polygon) || polygon.length < 3) return fallback
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const vertex of polygon) {
    const [x, y] = Array.isArray(vertex) ? vertex : []
    if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback
    west = Math.min(west, x)
    east = Math.max(east, x)
    south = Math.min(south, y)
    north = Math.max(north, y)
  }
  if (!(east > west && north > south)) return fallback
  let best = null
  let bestDistance = -1
  let left = west
  let right = east
  let top = south
  let bottom = north
  for (let round = 0; round < ANCHOR_ROUNDS; round += 1) {
    const stepX = (right - left) / (ANCHOR_GRID - 1)
    const stepY = (bottom - top) / (ANCHOR_GRID - 1)
    for (let row = 0; row < ANCHOR_GRID; row += 1) {
      for (let column = 0; column < ANCHOR_GRID; column += 1) {
        const point = [left + column * stepX, top + row * stepY]
        if (!containsVisionPoint(polygon, point)) continue
        const distance = distanceToPolygon(polygon, point)
        if (distance > bestDistance) {
          best = point
          bestDistance = distance
        }
      }
    }
    if (best !== null) {
      left = best[0] - stepX
      right = best[0] + stepX
      top = best[1] - stepY
      bottom = best[1] + stepY
    }
  }
  if (best === null) return fallback
  return [Math.min(0.999, Math.max(0.001, best[0])), Math.min(0.999, Math.max(0.001, best[1]))]
}

/** Best-effort interior roof elevation lookup using the viewport's depth buffer. */
export function sampleAnchorHeight(frame, center) {
  const { viewer, Cesium } = frame ?? {}
  if (!viewer?.scene?.pickPositionSupported || typeof viewer.scene?.pickPosition !== 'function' || !Cesium) return null
  if (!Array.isArray(center) || center.length < 2) return null
  const crop = frame.crop ?? { left: 0, top: 0, width: frame.cssWidth, height: frame.cssHeight }
  if (!(crop?.width > 0) || !(crop?.height > 0)) return null
  try {
    const position = new Cesium.Cartesian2(crop.left + center[0] * crop.width, crop.top + center[1] * crop.height)
    const cartesian = viewer.scene.pickPosition(position)
    const carto = cartesian && Cesium.Cartographic.fromCartesian(cartesian)
    return carto && Number.isFinite(carto.height) ? carto.height : null
  } catch {
    return null
  }
}

/**
 * Derive honest horizontal footprint area and elevation breakdown from a
 * projected candidate polygon plus an optional interior roof pick.
 */
export function estimateCandidateMetrics(projected, interiorHeight = null) {
  const rawArea = polygonAreaSquareMeters(projected?.ring)
  const area_m2 = Number.isFinite(rawArea) && rawArea > 0 ? round1(rawArea) : null
  const minEdge = projected?.heightRange?.min
  const maxEdge = projected?.heightRange?.max
  const roofRaw = Number.isFinite(interiorHeight)
    ? Number.isFinite(maxEdge) ? Math.max(maxEdge, interiorHeight) : interiorHeight
    : Number.isFinite(maxEdge) ? maxEdge : null
  const ground_height_m = Number.isFinite(minEdge) ? round1(minEdge) : null
  const roof_height_m = roofRaw !== null ? round1(roofRaw) : null
  const delta = ground_height_m !== null && roof_height_m !== null ? round1(roof_height_m - ground_height_m) : null
  const height_m = delta !== null && delta >= 0.5 ? delta : null
  return { area_m2, ground_height_m, roof_height_m, height_m }
}

/** Estimate floor count from relative height (3.0m nominal floor-to-floor, >= 2.2m threshold). */
export function buildingFloorEstimate(heightM, { floorHeightM = PARSE_FLOOR_HEIGHT_M } = {}) {
  if (typeof heightM !== 'number' || !Number.isFinite(heightM) || heightM < 2.2) return null
  return Math.max(1, Math.round(heightM / floorHeightM))
}

function parsePositiveNumber(raw, max = 5000) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 && raw <= max ? raw : null
  if (typeof raw !== 'string') return null
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(?:m|层|f)?$/i)
  if (!match) return null
  const num = Number(match[1])
  return Number.isFinite(num) && num > 0 && num <= max ? num : null
}

function readPickedPropertyPairs(picked, viewer) {
  const pairs = []
  if (!picked || typeof picked !== 'object') return pairs
  if (typeof picked.getPropertyIds === 'function' && typeof picked.getProperty === 'function') {
    try {
      for (const id of picked.getPropertyIds()) {
        if (pairs.length >= 32) break
        pairs.push([String(id), picked.getProperty(id)])
      }
    } catch { /* ignore unreadable batch tables */ }
    return pairs
  }
  const bag = picked?.id?.properties
  const names = Array.isArray(bag?.propertyNames) ? bag.propertyNames : []
  const currentTime = viewer?.clock?.currentTime
  for (const key of names) {
    if (pairs.length >= 32) break
    try {
      const prop = bag[key]
      const value = typeof prop?.getValue === 'function' ? prop.getValue(currentTime) : prop
      pairs.push([String(key), value])
    } catch { /* ignore time-dynamic property errors */ }
  }
  return pairs
}

/**
 * Best-effort 3D Tiles BatchTable / Entity metadata probe under a candidate's anchor.
 * Never fabricates attributes when the tileset carries no batch table.
 */
export function extractFeatureMetadataAtAnchor(frame, center) {
  const { viewer, Cesium } = frame ?? {}
  if (typeof viewer?.scene?.pick !== 'function' || !Cesium || !Array.isArray(center) || center.length < 2) return null
  const crop = frame.crop ?? { left: 0, top: 0, width: frame.cssWidth, height: frame.cssHeight }
  if (!(crop?.width > 0) || !(crop?.height > 0)) return null
  let picked = null
  try {
    const position = new Cesium.Cartesian2(crop.left + center[0] * crop.width, crop.top + center[1] * crop.height)
    picked = viewer.scene.pick(position)
  } catch {
    return null
  }
  const pairs = readPickedPropertyPairs(picked, viewer)
  if (pairs.length === 0) return null
  let name = null, heightM = null, floors = null
  for (const [rawKey, rawValue] of pairs) {
    const key = rawKey.trim().toLowerCase()
    if (name === null && BATCH_NAME_KEYS.has(key) && typeof rawValue === 'string' && rawValue.trim() !== '') {
      name = rawValue.trim().slice(0, 80)
    } else if (heightM === null && BATCH_HEIGHT_KEYS.has(key)) {
      const h = parsePositiveNumber(rawValue, 2000)
      if (h !== null) heightM = round1(h)
    } else if (floors === null && BATCH_FLOOR_KEYS.has(key)) {
      const f = parsePositiveNumber(rawValue, 300)
      if (f !== null) floors = Math.max(1, Math.round(f))
    }
  }
  if (name === null && heightM === null && floors === null) return null
  return { name, height_m: heightM, floors }
}

/**
 * Project every model outline onto the surface. Reuses the tested single-target
 * projection by giving each candidate its own "point" on the frame; candidates
 * that cannot reach the ground are reported, not silently dropped.
 */
export function projectBatchObjects(frame, objects, { t } = {}) {
  const features = []
  let skipped = 0
  for (const object of Array.isArray(objects) ? objects : []) {
    if (!Array.isArray(object.polygon) || object.polygon.length < 3) { skipped += 1; continue }
    const center = batchPolygonAnchor(object.polygon)
    if (!center) { skipped += 1; continue }
    const subframe = Object.create(frame)
    subframe.point = center
    let projected
    try {
      projected = projectVisionPolygon(subframe, { polygon: object.polygon })
    } catch {
      skipped += 1
      continue
    }
    const ring = projected.ring
    if (!Array.isArray(ring) || ring.length < 4) { skipped += 1; continue }
    const kind = PARSE_CLASSES.includes(object.class) ? object.class : 'other'
    const index = features.length + 1
    const metrics = estimateCandidateMetrics(projected, sampleAnchorHeight(frame, center))
    const batchMeta = extractFeatureMetadataAtAnchor(frame, center)
    const { styleKey } = parseClassColor(kind)
    const finalHeightM = batchMeta?.height_m > 0 ? batchMeta.height_m : metrics.height_m
    const finalRoofM = batchMeta?.height_m > 0 && metrics.ground_height_m !== null
      ? round1(metrics.ground_height_m + batchMeta.height_m)
      : metrics.roof_height_m
    const estFloors = kind === 'building' ? (batchMeta?.floors ?? buildingFloorEstimate(finalHeightM)) : null
    features.push({
      type: 'Feature',
      properties: {
        name: batchMeta?.name ?? `${classLabel(t, kind)} ${index}`,
        kind: 'area',
        class: kind,
        style: styleKey,
        confidence: object.confidence ?? null,
        source: 'vision_model',
        basis: 'inferred',
        approximate: true,
        depth_source: projected.depth_source,
        ...(batchMeta?.height_m ? { height_source: 'batch_table', batch_height_m: batchMeta.height_m } : {}),
        ...(batchMeta?.floors ? { batch_floors: batchMeta.floors } : {}),
        ...(metrics.area_m2 !== null ? { area_m2: metrics.area_m2 } : {}),
        ...(metrics.ground_height_m !== null ? { ground_height_m: metrics.ground_height_m } : {}),
        ...(finalRoofM !== null ? { roof_height_m: finalRoofM } : {}),
        ...(finalHeightM !== null ? { height_m: finalHeightM } : {}),
        ...(estFloors !== null ? { est_floors: estFloors } : {}),
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    })
  }
  return { features, skipped }
}

function toCartographic(Cesium, lon, lat, height = 0) {
  if (typeof Cesium?.Cartographic?.fromDegrees === 'function') {
    return Cesium.Cartographic.fromDegrees(lon, lat, height)
  }
  const rad = Math.PI / 180
  return { longitude: lon * rad, latitude: lat * rad, height }
}

function quantile(sorted, ratio) {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))
  return sorted[idx]
}

function buildMetricSamplePlan(ring) {
  const open = (Array.isArray(ring) ? ring.slice(0, -1) : []).filter(
    (pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]),
  )
  if (open.length < 3) return null
  let cx = 0, cy = 0
  for (const [lon, lat] of open) { cx += lon; cy += lat }
  cx /= open.length
  cy /= open.length
  const interior = []
  if (containsVisionPoint(open, [cx, cy])) interior.push([cx, cy])
  const step = Math.max(1, Math.floor(open.length / 4))
  for (let i = 0; i < open.length && interior.length < 4; i += step) {
    const [vx, vy] = open[i]
    const probe = [cx + (vx - cx) * 0.45, cy + (vy - cy) * 0.45]
    if (containsVisionPoint(open, probe)) interior.push(probe)
  }
  if (interior.length === 0) interior.push([cx, cy])
  const exterior = []
  const cosLat = Math.max(0.02, Math.cos((cy * Math.PI) / 180))
  for (let i = 0; i < open.length && exterior.length < 8; i += step) {
    const [vx, vy] = open[i]
    const east = (vx - cx) * cosLat
    const north = vy - cy
    const bearingDeg = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360
    for (const radius of EXTERIOR_RING_RADII_M) {
      const displaced = offsetCartographic(vx, vy, bearingDeg, radius)
      if (displaced && !containsVisionPoint(open, [displaced.lon, displaced.lat])) {
        exterior.push([displaced.lon, displaced.lat])
      }
    }
  }
  return { interior, exterior, center: [cx, cy] }
}

/**
 * Refine ground, roof and relative height metrics using the shared HeightService.
 * Uses tileset interior probes for roofs and an exterior (6m/14m) ring for true
 * surrounding ground so packed urban depth buffers don't flatten height deltas.
 */
export async function refineBatchMetricsWithHeightService(frame, features, { getLayers = () => [] } = {}) {
  const list = Array.isArray(features) ? features : []
  const viewer = frame?.viewer
  const Cesium = frame?.Cesium
  if (!viewer?.scene || !Cesium || list.length === 0) {
    return { features: list, refined: 0, height_source: 'scene_depth' }
  }
  const layers = typeof getLayers === 'function' ? getLayers() : []
  const layer = (Array.isArray(layers) ? layers : []).find((item) => item && item.visible !== false && item.tileset) ?? null
  const heightService = createHeightService({ Cesium, viewer, layer })
  const canSampleTiles = typeof layer?.tileset?.getHeight === 'function'
  const canSampleTerrain = heightService.hasRealTerrain()
  if (!canSampleTiles && !canSampleTerrain) {
    return { features: list, refined: 0, height_source: 'scene_depth' }
  }
  const plans = list.map((feature) => buildMetricSamplePlan(feature?.geometry?.coordinates?.[0]))
  const cartos = []
  const refs = []
  plans.forEach((plan, index) => {
    if (!plan) return
    if (canSampleTiles) {
      for (const [lon, lat] of plan.interior) {
        refs.push({ index, role: 'interior' })
        cartos.push(toCartographic(Cesium, lon, lat))
      }
    }
    const groundPts = plan.exterior.length > 0 ? plan.exterior : [plan.center]
    for (const [lon, lat] of groundPts) {
      refs.push({ index, role: 'exterior' })
      cartos.push(toCartographic(Cesium, lon, lat))
    }
  })
  if (cartos.length === 0) {
    return { features: list, refined: 0, height_source: 'scene_depth' }
  }
  const primaryMode = canSampleTiles ? 'tiles' : 'terrain'
  const run = await heightService.sampleMany(cartos, { mode: primaryMode })
  const buckets = list.map(() => ({ interior: [], exterior: [] }))
  for (let i = 0; i < (run.values?.length ?? 0); i += 1) {
    const sample = run.values[i]
    if (!sample || !Number.isFinite(sample.height)) continue
    buckets[refs[i].index][refs[i].role].push(sample.height)
  }
  // If 3D Tiles returned roofs but missed every exterior ground point, query real terrain for bare ground.
  if (canSampleTiles && canSampleTerrain) {
    const terrainCartos = []
    const terrainFeatureIdx = []
    buckets.forEach((bucket, index) => {
      const plan = plans[index]
      if (!plan || bucket.exterior.length > 0) return
      for (const [lon, lat] of plan.exterior.length > 0 ? plan.exterior : [plan.center]) {
        terrainFeatureIdx.push(index)
        terrainCartos.push(toCartographic(Cesium, lon, lat))
      }
    })
    if (terrainCartos.length > 0) {
      const terrainRun = await heightService.sampleMany(terrainCartos, { mode: 'terrain' })
      for (let i = 0; i < (terrainRun.values?.length ?? 0); i += 1) {
        const sample = terrainRun.values[i]
        if (sample && Number.isFinite(sample.height)) buckets[terrainFeatureIdx[i]].exterior.push(sample.height)
      }
    }
  }
  let refined = 0
  const nextFeatures = list.map((feature, index) => {
    const props = feature?.properties
    if (!props) return feature
    const bucket = buckets[index]
    const extSorted = [...bucket.exterior].sort((a, b) => a - b)
    const intSorted = [...bucket.interior].sort((a, b) => a - b)
    const sampledGround = extSorted.length > 0 ? round1(quantile(extSorted, 0.2)) : null
    const sampledRoof = intSorted.length > 0 ? round1(intSorted[intSorted.length - 1]) : null
    if (sampledGround === null && sampledRoof === null) return feature
    refined += 1
    const nextProps = { ...props }
    const ground = sampledGround ?? (typeof props.ground_height_m === 'number' ? props.ground_height_m : null)
    const explicitHeight = typeof props.batch_height_m === 'number' && props.batch_height_m > 0 ? props.batch_height_m : null
    let roof = sampledRoof ?? (typeof props.roof_height_m === 'number' ? props.roof_height_m : null)
    let heightM = explicitHeight
    if (explicitHeight !== null && ground !== null) {
      roof = round1(ground + explicitHeight)
    } else if (explicitHeight === null) {
      const delta = ground !== null && roof !== null ? round1(roof - ground) : null
      heightM = delta !== null && delta >= 0.5 ? delta : null
    }
    if (ground !== null) nextProps.ground_height_m = ground
    if (roof !== null) nextProps.roof_height_m = roof
    if (heightM !== null) nextProps.height_m = heightM
    else delete nextProps.height_m
    if (props.class === 'building') {
      const floors = typeof props.batch_floors === 'number' ? props.batch_floors : buildingFloorEstimate(heightM)
      if (floors !== null) nextProps.est_floors = floors
    }
    nextProps.height_source = explicitHeight !== null
      ? 'batch_table'
      : canSampleTiles && (sampledRoof !== null || sampledGround !== null)
        ? 'tiles_height_service'
        : 'terrain_height_service'
    return { ...feature, properties: nextProps }
  })
  return { features: nextFeatures, refined, height_source: run.height_source }
}

/** Comparator for ParseBody / test sorting (`default` | `height` | `area`). */
export function compareBatchFeatures(a, b, sortBy = 'default') {
  if (sortBy === 'height') {
    const ah = typeof a?.properties?.height_m === 'number' ? a.properties.height_m : -1
    const bh = typeof b?.properties?.height_m === 'number' ? b.properties.height_m : -1
    return bh - ah
  }
  if (sortBy === 'area') {
    const aa = typeof a?.properties?.area_m2 === 'number' ? a.properties.area_m2 : -1
    const ba = typeof b?.properties?.area_m2 === 'number' ? b.properties.area_m2 : -1
    return ba - aa
  }
  return 0
}

/** Return a sorted copy of parsed features without mutating the input list. */
export function sortBatchFeatures(features, sortBy = 'default') {
  const list = Array.isArray(features) ? features : []
  if (sortBy !== 'height' && sortBy !== 'area') return list.slice()
  return list
    .map((feature, index) => ({ feature, index }))
    .sort((left, right) => compareBatchFeatures(left.feature, right.feature, sortBy) || (left.index - right.index))
    .map(({ feature }) => feature)
}

function featureBox(feature) {
  const ring = feature?.geometry?.coordinates?.[0]
  if (!Array.isArray(ring) || ring.length < 3) return null
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const point of ring) {
    const [lon, lat] = Array.isArray(point) ? point : []
    if (![lon, lat].every((number) => Number.isFinite(number))) return null
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return [minLon, minLat, maxLon, maxLat]
}

/** Bounding-box IoU. Deliberately cheap: it only needs to catch near-duplicates. */
export function batchBoxIoU(a, b) {
  if (!a || !b) return 0
  const width = Math.min(a[2], b[2]) - Math.max(a[0], b[0])
  const height = Math.min(a[3], b[3]) - Math.max(a[1], b[1])
  if (width <= 0 || height <= 0) return 0
  const overlap = width * height
  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1])
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1])
  const union = areaA + areaB - overlap
  return union > 0 ? overlap / union : 0
}

/** Drop candidates that describe the same object; keep the more confident one. */
export function dedupeBatchFeatures(features, { threshold = PARSE_DEDUPE_IOU } = {}) {
  const kept = []
  for (const feature of Array.isArray(features) ? features : []) {
    const box = featureBox(feature)
    if (!box) continue
    const duplicate = kept.find((item) => item.properties.class === feature.properties.class && batchBoxIoU(box, featureBox(item)) > threshold)
    if (!duplicate) {
      kept.push(feature)
      continue
    }
    if ((feature.properties.confidence ?? 0) > (duplicate.properties.confidence ?? 0)) {
      kept[kept.indexOf(duplicate)] = feature
    }
  }
  return kept
}

/** Count by class for the review header ("3 buildings · 2 trees"). */
export function batchClassCounts(features) {
  const counts = {}
  for (const feature of Array.isArray(features) ? features : []) {
    const kind = feature?.properties?.class
    if (typeof kind !== 'string') continue
    counts[kind] = (counts[kind] ?? 0) + 1
  }
  return counts
}

/** Filter parsed candidates by category ('all' or a specific PARSE_CLASSES entry). */
export function filterBatchFeatures(features, filter = 'all') {
  const list = Array.isArray(features) ? features : []
  if (filter === 'all' || !filter) return list
  return list.filter((feature) => feature?.properties?.class === filter)
}

/**
 * Toggle 3D extrusion metadata on parsed features without dropping height metrics:
 * when `extrude` is true and height > 0, stamps `extruded: true` + `extruded_height_m`.
 */
export function applyExtrusionToFeatures(features, extrude = false) {
  return (Array.isArray(features) ? features : []).map((feature) => {
    if (!feature || typeof feature !== 'object') return feature
    const props = feature.properties && typeof feature.properties === 'object' ? { ...feature.properties } : {}
    const base = typeof props.ground_height_m === 'number' && Number.isFinite(props.ground_height_m) ? props.ground_height_m : null
    const roof = typeof props.roof_height_m === 'number' && Number.isFinite(props.roof_height_m) ? props.roof_height_m : null
    const rel = typeof props.height_m === 'number' && Number.isFinite(props.height_m) ? props.height_m : null
    if (extrude && ((roof !== null && base !== null && roof > base) || (rel !== null && rel > 0))) {
      props.extruded = true
      props.extruded_height_m = roof !== null && base !== null && roof > base ? roof : (base ?? 0) + rel
    } else {
      props.extruded = false
      delete props.extruded_height_m
    }
    return { ...feature, properties: props }
  })
}

/** Preview outlines (plus optional 3D extruded preview volumes); never enters snapshots. */
export function drawBatchPreview(Cesium, viewer, features, { extrude = false } = {}) {
  const entities = []
  for (const feature of Array.isArray(features) ? features : []) {
    const ring = feature?.geometry?.coordinates?.[0]
    if (!Array.isArray(ring) || ring.length < 4) continue
    const props = feature?.properties ?? {}
    const { hex, outlineHex } = parseClassColor(props.class, props.style)
    const base = typeof props.ground_height_m === 'number' && Number.isFinite(props.ground_height_m) ? props.ground_height_m : 0
    const rel = typeof props.height_m === 'number' && Number.isFinite(props.height_m) ? props.height_m : 0
    const roof = typeof props.roof_height_m === 'number' && Number.isFinite(props.roof_height_m) ? props.roof_height_m : base + rel
    const is3d = extrude && roof > base && typeof Cesium?.PolygonHierarchy === 'function'
    const outlineHeight = is3d ? roof : 0
    const positions = ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, outlineHeight))
    try {
      entities.push(viewer.entities.add({
        polyline: {
          positions,
          width: 2,
          clampToGround: !is3d,
          material: Cesium.Color.fromCssColorString(hex).withAlpha(0.95),
        },
      }))
      if (is3d) {
        const hierarchy = new Cesium.PolygonHierarchy(ring.slice(0, -1).map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat)))
        entities.push(viewer.entities.add({
          polygon: {
            hierarchy,
            height: base,
            extrudedHeight: roof,
            material: Cesium.Color.fromCssColorString(hex).withAlpha(0.28),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(outlineHex).withAlpha(0.9),
          },
        }))
      }
    } catch {
      /* one bad ring must not drop the rest of the preview */
    }
  }
  viewer.scene?.requestRender?.()
  return entities
}

export function clearBatchPreview(viewer, entities) {
  for (const entity of Array.isArray(entities) ? entities : []) {
    try { viewer.entities.remove(entity) } catch { /* viewer may be gone */ }
  }
  if (Array.isArray(entities)) entities.length = 0
  viewer?.scene?.requestRender?.()
}

export function batchFeatureCollection(features, name) {
  return { type: 'FeatureCollection', ...(name ? { name } : {}), features: Array.isArray(features) ? features : [] }
}
