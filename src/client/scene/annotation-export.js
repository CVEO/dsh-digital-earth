/**
 * scene/annotation-export.js — turn the reviewed queue into a GeoJSON file (v1.9).
 *
 * The extraction workbench hands the user two deliverables: a plain 2D footprint
 * file for GIS/CAD, and a footprint file whose vertices carry an absolute roof
 * height (base + building height) for 3D tools. Both are derived from the same
 * records, so both use one whitelist and one key order — a downstream script can
 * rely on the property names, and no internal review field (status history, hex,
 * undo bookkeeping) leaks into the file by accident.
 *
 * Honesty rules:
 *   - polygons without a usable height are skipped, not silently flattened; the
 *     counts are returned so the panel can warn before the download starts;
 *   - `assumeZero` is an explicit opt-in to write approximate Z, and every such
 *     feature is stamped with `estimated_geometry: true`;
 *   - invalid geometry is dropped and counted, never repaired into something it
 *     was not.
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
  'height_m',
  'height_source',
  'floors',
  'base_m',
  'roof_m',
  'area_m2',
  'run_id',
  'rev',
  // P1b refinement provenance: `box` outlines are a coarse fallback, `refined` /
  // `manual` outlines were reviewed. Kept at the end so the legacy prefix of the
  // property contract does not move.
  'outline_source',
  'outline_quality',
  'refine_state',
])

/** Decimal places for longitude/latitude (~1 cm keeps footprint corners honest). */
export const EXPORT_DEFAULT_DECIMALS = 7
/** Decimal places for exported heights (1 cm). */
export const EXPORT_DEFAULT_HEIGHT_DECIMALS = 2

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
  'height_source',
  'run_id',
  'outline_source',
  'outline_quality',
  'refine_state',
])
const NUMBER_KEYS = new Set(['confidence', 'height_m', 'floors', 'base_m', 'roof_m', 'area_m2', 'rev'])

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
function exportProperties(properties, estimated) {
  const source = isObject(properties) ? properties : {}
  const out = {}
  for (const key of EXPORT_PROPERTY_ORDER) {
    const value = source[key]
    if (STRING_KEYS.has(key)) out[key] = typeof value === 'string' ? value : null
    else if (NUMBER_KEYS.has(key)) out[key] = finiteNumber(value)
    else if (key === 'clippedAtTileEdge') out[key] = value === true ? true : null
    else out[key] = null
  }
  if (estimated) out.estimated_geometry = true
  return out
}

/**
 * One closed ring of [lon, lat] or [lon, lat, z] positions, or null when the ring
 * cannot be written (fewer than three positions, or a non-finite coordinate).
 */
function buildRing(ring, { withZ, decimals, zDecimals, z }) {
  if (!Array.isArray(ring) || ring.length < 3) return null
  const out = []
  for (const position of ring) {
    if (!Array.isArray(position) || position.length < 2) return null
    const lon = finiteNumber(position[0])
    const lat = finiteNumber(position[1])
    if (lon === null || lat === null) return null
    const pair = [roundTo(lon, decimals), roundTo(lat, decimals)]
    out.push(withZ ? [...pair, roundTo(z, zDecimals)] : pair)
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
 * @param {boolean} [options.withZ] write an absolute roof Z on every vertex
 * @param {boolean} [options.assumeZero] estimate missing heights as 0 (opt-in)
 * @param {number} [options.round] longitude/latitude decimals
 * @param {number} [options.heightRound] height decimals
 * @returns {{collection: object, count: number, missing: number, skipped: number,
 *            withZ: boolean, assumeZero: boolean}}
 *   `count` is the number of written polygons (MultiPolygon parts count once
 *   each); `missing` counts features whose height was unusable (written flat or
 *   skipped); `skipped` counts dropped polygons (bad geometry or missing height).
 */
export function buildGeoJsonExport(features, options = {}) {
  const list = Array.isArray(features) ? features : []
  const withZ = options.withZ === true
  const assumeZero = options.assumeZero === true
  const decimals = decimalsOf(options.round, EXPORT_DEFAULT_DECIMALS)
  const zDecimals = decimalsOf(options.heightRound, EXPORT_DEFAULT_HEIGHT_DECIMALS)

  const collection = { type: 'FeatureCollection', features: [] }
  let missing = 0
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
    const properties = isObject(feature.properties) ? feature.properties : {}
    let z = 0
    let estimated = false
    if (withZ) {
      const base = finiteNumber(properties.base_m)
      const height = finiteNumber(properties.height_m)
      if (height !== null && height > 0) {
        // A footprint with a height but no recorded base still exports: the vertex
        // Z is the height above the local ground (base 0). It is stamped as
        // estimated because the absolute datum was not measured.
        z = (base ?? 0) + height
        if (base === null) estimated = true
      } else {
        missing += 1
        if (!assumeZero) {
          skipped += 1
          continue
        }
        // Explicit approximation: a missing/invalid half counts as zero, and the
        // feature is stamped so nobody mistakes the geometry for measured data.
        estimated = true
        z = base ?? 0
      }
    }
    const exported = exportProperties(properties, estimated)
    for (const ring of rings) {
      const coordinates = buildRing(ring, { withZ, decimals, zDecimals, z })
      if (coordinates === null) {
        skipped += 1
        continue
      }
      collection.features.push({
        type: 'Feature',
        properties: { ...exported },
        geometry: { type: 'Polygon', coordinates: [coordinates] },
      })
    }
  }

  return {
    collection,
    count: collection.features.length,
    missing,
    skipped,
    withZ,
    assumeZero,
  }
}

/**
 * How many features have no usable height (finite `height_m` greater than zero).
 * The panel shows this before an export so the +Z option is a choice, not a surprise.
 */
export function missingHeightCount(features) {
  let missing = 0
  for (const feature of Array.isArray(features) ? features : []) {
    const properties = isObject(feature) && isObject(feature.properties) ? feature.properties : null
    const height = properties === null ? null : finiteNumber(properties.height_m)
    if (height === null || height <= 0) missing += 1
  }
  return missing
}

/** `extract-YYYYMMDD.geojson` or `extract-YYYYMMDD-z.geojson` (local date). */
export function suggestedFilename({ format = 'geojson', date = new Date() } = {}) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const year = String(when.getFullYear())
  const month = String(when.getMonth() + 1).padStart(2, '0')
  const day = String(when.getDate()).padStart(2, '0')
  const suffix = format === 'geojson-z' ? '-z' : ''
  return `extract-${year}${month}${day}${suffix}.geojson`
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
