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
import { projectVisionPolygon } from './vision-frame.js'
import { containsVisionPoint, distanceToPolygon, visionError } from './vision-geometry.js'
import { polygonAreaSquareMeters } from './screen-geodesy.js'

const round1 = (value) => Math.round(value * 10) / 10

export const MAX_PARSE_OBJECTS = 40
export const PARSE_DEDUPE_IOU = 0.5
export const PARSE_CLASSES = ['building', 'vegetation', 'water', 'road', 'vehicle', 'other']

function sceneLoading(getLayers) {
  return getLayers().some((layer) => layer?.visible !== false && layer?.tileset?.tilesLoaded === false)
}

/** Full-viewport screenshot, no crop and no crosshair (batch parsing sees everything). */
export function captureSceneFrame({ viewer, Cesium, getLayers = () => [] }) {
  if (!viewer?.scene || viewer.isDestroyed?.()) throw visionError('not_ready')
  const canvas = viewer.canvas, scene = viewer.scene
  if (typeof document === 'undefined' || !canvas?.clientWidth || !canvas?.clientHeight || document.visibilityState === 'hidden') throw visionError('not_ready')
  if (sceneLoading(getLayers) || scene.globe?.tilesLoaded === false) throw visionError('scene_loading')
  viewer.camera.cancelFlight?.()
  viewer.render()
  const cssWidth = canvas.clientWidth, cssHeight = canvas.clientHeight
  const scaleX = canvas.width / cssWidth, scaleY = canvas.height / cssHeight
  const sourceWidth = Math.max(1, Math.round(cssWidth * scaleX))
  const sourceHeight = Math.max(1, Math.round(cssHeight * scaleY))
  const scale = Math.min(1, 1024 / Math.max(sourceWidth, sourceHeight))
  const image = document.createElement('canvas')
  image.width = Math.max(32, Math.round(sourceWidth * scale))
  image.height = Math.max(32, Math.round(sourceHeight * scale))
  const context = image.getContext('2d')
  if (!context) throw visionError('not_ready')
  context.drawImage(canvas, 0, 0, sourceWidth, sourceHeight, 0, 0, image.width, image.height)
  const dataUrl = image.toDataURL('image/jpeg', 0.82)
  if (dataUrl.length > 2_000_000) throw visionError('too_large')
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `frame-${Date.now()}`,
    dataUrl, width: image.width, height: image.height,
    crop: { left: 0, top: 0, width: cssWidth, height: cssHeight },
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
    body: JSON.stringify({ frameId: frame.id, image: frame.dataUrl }),
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
    features.push({
      type: 'Feature',
      properties: {
        name: `${classLabel(t, kind)} ${index}`,
        kind: 'area',
        class: kind,
        confidence: object.confidence ?? null,
        source: 'vision_model',
        basis: 'inferred',
        approximate: true,
        depth_source: projected.depth_source,
        ...(metrics.area_m2 !== null ? { area_m2: metrics.area_m2 } : {}),
        ...(metrics.ground_height_m !== null ? { ground_height_m: metrics.ground_height_m } : {}),
        ...(metrics.roof_height_m !== null ? { roof_height_m: metrics.roof_height_m } : {}),
        ...(metrics.height_m !== null ? { height_m: metrics.height_m } : {}),
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    })
  }
  return { features, skipped }
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
          material: Cesium.Color.fromCssColorString('#c084fc').withAlpha(0.95),
        },
      }))
      if (is3d) {
        const hierarchy = new Cesium.PolygonHierarchy(ring.slice(0, -1).map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat)))
        entities.push(viewer.entities.add({
          polygon: {
            hierarchy,
            height: base,
            extrudedHeight: roof,
            material: Cesium.Color.fromCssColorString('#c084fc').withAlpha(0.28),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#e9d5ff').withAlpha(0.9),
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
