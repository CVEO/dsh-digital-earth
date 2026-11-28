/**
 * scene/annotation-export.js — turn the reviewed queue into a 2D GeoJSON file.
 *
 * The extraction workbench delivers one flat footprint file for GIS/CAD. Nothing
 * here is three-dimensional: vertices are [lon, lat] pairs, and no height, floor
 * or refinement column is written. One whitelist and one key order mean a
 * downstream script can rely on the property names, and no internal review field
 * (status history, hex, undo bookkeeping) leaks into the file by accident.
 *
 * Honesty rules:
 *   - invalid geometry is dropped and counted, never repaired into something it
 *     was not;
 *   - only the polygon outer ring is exported, so a MultiPolygon becomes one
 *     feature per part and part counts stay explainable.
 */

/** Fixed property order of every exported feature. The file contract. */
export const EXPORT_PROPERTY_ORDER = Object.freeze([
  'id',
  'class',
  'class_key',
  'class_name',
  'color',
  'clippedAtTileEdge',
  'status',
  'method',
  'source',
  'source_kind',
  'shape',
  'confidence',
  'area_m2',
  'run_id',
  'rev',
])

/** Decimal places for longitude/latitude (~1 cm keeps footprint corners honest). */
export const EXPORT_DEFAULT_DECIMALS = 7

const STRING_KEYS = new Set([
  'id',
  'class',
  'class_key',
  'class_name',
  'color',
  'status',
  'method',
  'source',
  'source_kind',
  'shape',
  'run_id',
])
const NUMBER_KEYS = new Set(['confidence', 'area_m2', 'rev'])

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const finiteNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** Accept 0..15 decimals; an unusable argument falls back to the default. */
function decimalsOf(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(15, Math.max(0, Math.trunc(value)))
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Outer rings in feature order: one for Polygon, one per part for MultiPolygon. */
function outerRings(geometry) {
  if (!isObject(geometry)) return null
  if (geometry.type === 'Polygon') {
    const ring = Array.isArray(geometry.coordinates) ? geometry.coordinates[0] : null
    return Array.isArray(ring) ? [ring] : null
  }
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates)) return null
    const rings = []
    for (const polygon of geometry.coordinates) {
      if (!Array.isArray(polygon)) continue
      if (!Array.isArray(polygon[0])) continue
      rings.push(polygon[0])
    }
    return rings.length > 0 ? rings : null
  }
  // Points / lines / curved geometries are not part of the extraction deliverable.
  return null
}

/** Write one whitelisted property object; absent/ill-typed values become null. */
function exportProperties(properties) {
  const source = isObject(properties) ? properties : {}
  const out = {}
  for (const key of EXPORT_PROPERTY_ORDER) {
    const value = source[key]
    if (STRING_KEYS.has(key)) out[key] = typeof value === 'string' ? value : null
    else if (NUMBER_KEYS.has(key)) out[key] = finiteNumber(value)
    else out[key] = value === true ? true : null
  }
  return out
}

/**
 * One closed ring of [lon, lat] positions, or null when the ring cannot be
 * written (fewer than three positions, or a non-finite coordinate).
 */
function buildRing(ring, decimals) {
  if (!Array.isArray(ring) || ring.length < 3) return null
  const out = []
  for (const position of ring) {
    if (!Array.isArray(position) || position.length < 2) return null
    const lon = finiteNumber(position[0])
    const lat = finiteNumber(position[1])
    if (lon === null || lat === null) return null
    out.push([roundTo(lon, decimals), roundTo(lat, decimals)])
  }
  // GeoJSON rings must close; a provider that omitted the last vertex is fixed
  // here rather than producing a file other tools have to repair.
  const first = out[0]
  const last = out[out.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([...first])
  return out
}

/**
 * Build the FeatureCollection written to disk.
 *
 * @param {object[]} features candidate features (usually the accepted ones)
 * @param {object} [options]
 * @param {number} [options.round] longitude/latitude decimals
 * @returns {{collection: object, count: number, skipped: number}}
 *   `count` is the number of written polygons (MultiPolygon parts count once
 *   each); `skipped` counts dropped polygons with unusable geometry.
 */
export function buildGeoJsonExport(features, options = {}) {
  const list = Array.isArray(features) ? features : []
  const decimals = decimalsOf(options.round, EXPORT_DEFAULT_DECIMALS)

  const collection = { type: 'FeatureCollection', features: [] }
  let skipped = 0

  for (const feature of list) {
    if (!isObject(feature)) {
      skipped += 1
      continue
    }
    const rings = outerRings(feature.geometry)
    if (rings === null) {
      skipped += 1
      continue
    }
    const properties = exportProperties(feature.properties)
    for (const ring of rings) {
      const coordinates = buildRing(ring, decimals)
      if (coordinates === null) {
        skipped += 1
        continue
      }
      collection.features.push({
        type: 'Feature',
        properties: { ...properties },
        geometry: { type: 'Polygon', coordinates: [coordinates] },
      })
    }
  }

  return { collection, count: collection.features.length, skipped }
}

/** `extract-YYYYMMDD.geojson` (local date). */
export function suggestedFilename({ date = new Date() } = {}) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const year = String(when.getFullYear())
  const month = String(when.getMonth() + 1).padStart(2, '0')
  const day = String(when.getDate()).padStart(2, '0')
  return `extract-${year}${month}${day}.geojson`
}

/** Compact counters for the export bar: total features and per-status split. */
export function exportMeta(features) {
  const list = Array.isArray(features) ? features : []
  const byStatus = { pending: 0, accepted: 0, rejected: 0 }
  for (const feature of list) {
    const status = isObject(feature) && isObject(feature.properties) ? feature.properties.status : null
    if (typeof status === 'string' && Object.prototype.hasOwnProperty.call(byStatus, status)) byStatus[status] += 1
  }
  return { total: list.length, byStatus }
}
