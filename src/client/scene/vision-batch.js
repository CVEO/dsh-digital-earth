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
import { visionError } from './vision-geometry.js'

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
    const center = batchPolygonCenter(object.polygon)
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

/** Preview outlines only; they never enter the scene data or the snapshot. */
export function drawBatchPreview(Cesium, viewer, features) {
  const entities = []
  for (const feature of Array.isArray(features) ? features : []) {
    const ring = feature?.geometry?.coordinates?.[0]
    if (!Array.isArray(ring) || ring.length < 4) continue
    const positions = ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0))
    try {
      entities.push(viewer.entities.add({
        polyline: {
          positions,
          width: 2,
          clampToGround: true,
          material: Cesium.Color.fromCssColorString('#c084fc').withAlpha(0.95),
        },
      }))
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
