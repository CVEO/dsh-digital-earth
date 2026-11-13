/**
 * scene/vector-export.js — pure export of the vector overlay layer (F3).
 *
 * One FeatureCollection is the deliverable everywhere: local download, host
 * write and chat hand-off all consume the same array, so the three paths can
 * never disagree about what "the vector layer" contains.
 *
 * Provenance is honest: hand-drawn annotations keep source 'manual', measured
 * lines keep 'measure' plus the measured value, and nothing invents a place
 * name or a height that was not measured.
 */
import { annotationKindOf, roundAnnotationGeometry } from './annotation-model.js'

/** Same ceilings as earth_draw, so an export can always be fed back as a draw. */
export const VECTOR_EXPORT_MAX_FEATURES = 500
export const VECTOR_EXPORT_MAX_COORDINATES = 20000
export const VECTOR_EXPORT_DECIMALS = 6

function cloneFeature(feature) {
  if (feature === null || typeof feature !== 'object' || feature.type !== 'Feature') return null
  if (feature.geometry === null || typeof feature.geometry !== 'object') return null
  return {
    type: 'Feature',
    ...(feature.id === undefined ? {} : { id: feature.id }),
    properties: feature.properties === undefined ? {} : JSON.parse(JSON.stringify(feature.properties)),
    geometry: roundAnnotationGeometry(feature.geometry, VECTOR_EXPORT_DECIMALS),
  }
}

function withProvenance(properties, provenance) {
  const next = { ...properties }
  if (next.provenance === undefined) next.provenance = provenance
  return next
}

/** Anchor point of a measure command, or null when it has no usable coordinates. */
function measureCoordinates(points) {
  const list = []
  for (const point of Array.isArray(points) ? points : []) {
    if (!Array.isArray(point) && (typeof point?.lon !== 'number' || typeof point?.lat !== 'number')) continue
    const lon = Array.isArray(point) ? point[0] : point.lon
    const lat = Array.isArray(point) ? point[1] : point.lat
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    list.push([lon, lat])
  }
  return list
}

function measureFeature(command, index) {
  const points = measureCoordinates(command?.points)
  if (points.length < 2) return null
  const mode = command?.mode === 'area' ? 'area' : command?.mode === 'height' ? 'height' : 'distance'
  const geometry = mode === 'area'
    ? { type: 'Polygon', coordinates: [[...points, points[0]]] }
    : { type: 'LineString', coordinates: points }
  const result = command?.result ?? {}
  const properties = withProvenance(
    {
      name: `measure-${index + 1}`,
      kind: mode === 'area' ? 'area' : 'line',
      source: 'measure',
      mode,
      ...(Number.isFinite(result.total_m) ? { distance_m: result.total_m } : {}),
      ...(Number.isFinite(result.area_m2) ? { area_m2: result.area_m2 } : {}),
      ...(Number.isFinite(result.height_m) ? { height_m: result.height_m } : {}),
    },
    { source: 'measure', tool: 'measure', basis: 'measured' },
  )
  return { type: 'Feature', properties, geometry }
}

/**
 * Merge the drawn commands and the measured overlays into exportable features.
 * Returns {ok:false, error} when there is nothing to export or a ceiling is hit.
 */
export function collectVectorFeatures({ drawCommands = [], measureCommands = [] } = {}) {
  const features = []
  const commands = Array.isArray(drawCommands) ? drawCommands : []
  for (const command of commands) {
    const list = Array.isArray(command?.geojson?.features) ? command.geojson.features : []
    for (const feature of list) {
      const cloned = cloneFeature(feature)
      if (!cloned) continue
      cloned.properties = withProvenance(cloned.properties, {
        source: cloned.properties.source ?? 'manual',
        tool: 'annotation',
        basis: 'measured',
      })
      if (typeof cloned.properties.name !== 'string' || cloned.properties.name === '') {
        cloned.properties.name = `annotation-${features.length + 1}`
      }
      if (cloned.properties.kind === undefined) cloned.properties.kind = annotationKindOf(cloned)
      features.push(cloned)
    }
  }
  const measures = Array.isArray(measureCommands) ? measureCommands : []
  measures.forEach((command, index) => {
    const feature = measureFeature(command, index)
    if (feature) features.push(feature)
  })
  if (features.length === 0) return { ok: false, error: 'empty' }
  if (features.length > VECTOR_EXPORT_MAX_FEATURES) return { ok: false, error: 'too_many_features' }
  const coordinates = vectorCoordinateCount(features)
  if (coordinates > VECTOR_EXPORT_MAX_COORDINATES) return { ok: false, error: 'too_many_coordinates' }
  return { ok: true, features, coordinates }
}

/** Visit every coordinate tree inside a geometry, including nested GeometryCollections. */
function walkGeometry(geometry, visit) {
  if (geometry === null || typeof geometry !== 'object') return
  if (geometry.type === 'GeometryCollection') {
    if (Array.isArray(geometry.geometries)) for (const child of geometry.geometries) walkGeometry(child, visit)
    return
  }
  visit(geometry.coordinates)
}

/** Leaf [lon, lat] pairs in any GeoJSON coordinate tree. */
export function vectorCoordinateCount(features) {
  let total = 0
  const visit = (node) => {
    if (!Array.isArray(node)) return
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      total += 1
      return
    }
    for (const item of node) visit(item)
  }
  for (const feature of Array.isArray(features) ? features : []) walkGeometry(feature?.geometry, visit)
  return total
}

/** Bounding box in degrees; null when no coordinate is finite. */
export function vectorBbox(features) {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  const visit = (node) => {
    if (!Array.isArray(node)) return
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      if (!Number.isFinite(node[0]) || !Number.isFinite(node[1])) return
      west = Math.min(west, node[0])
      east = Math.max(east, node[0])
      south = Math.min(south, node[1])
      north = Math.max(north, node[1])
      return
    }
    for (const item of node) visit(item)
  }
  for (const feature of Array.isArray(features) ? features : []) walkGeometry(feature?.geometry, visit)
  return Number.isFinite(west) ? { west, south, east, north } : null
}

/** FeatureCollection payload shared by every delivery path. */
export function vectorExportCollection(features, { name = '' } = {}) {
  const list = Array.isArray(features) ? features : []
  const trimmed = typeof name === 'string' ? name.trim().slice(0, 120) : ''
  return {
    type: 'FeatureCollection',
    ...(trimmed === '' ? {} : { name: trimmed }),
    features: list,
  }
}

/** GeoJSON text, 2-space indented, exactly what the host writes to disk. */
export function vectorExportText(collection) {
  return JSON.stringify(collection, null, 2)
}

/** File name used by the local download; the host picks its own path. */
export function vectorExportFileName(stamp = new Date().toISOString().slice(0, 19)) {
  const safe = String(stamp).replace(/[^0-9A-Za-z]+/g, '-').replace(/^-+|-+$/g, '')
  return `vector-overlay-${safe === '' ? 'export' : safe}.geojson`
}
