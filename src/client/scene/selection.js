/**
 * scene/selection.js — "point at a place and explain it" maths (v1.7 P0).
 *
 * The honest answer is not always "a building". A photogrammetry tileset without
 * a batch table (the common case) only lets the browser hit a tile/region, so a
 * selection card must separate three tiers explicitly:
 *
 *   measured   the surface height under the pixel (depth buffer / height service)
 *   estimated  the object height, from a ring of neighbour samples (geometry)
 *   inferred   anything visual, which this module never fabricates
 *
 * Everything else (name / use / ownership / footprint) stays in `unknowns` when
 * the layer carries no feature metadata. Every number keeps its provenance so an
 * exported evidence pack can be re-read months later.
 *
 * Pure functions only: the Cesium viewer, the height service and React live in
 * scene/selection-controller.js and ui/selection-overlay.js.
 */

/** Bump when the JSON sidecar shape changes in a breaking way. */
export const EVIDENCE_SCHEMA_VERSION = 1
/** Rings sampled around the picked point, in metres (8 directions each). */
export const SELECTION_RADII_M = [30, 60, 120]
/** Bearings per ring: 8 compass directions is enough to find a low neighbour. */
export const SELECTION_DIRECTIONS = 8
/** Below this many usable neighbour samples the height estimate is a guess. */
export const SELECTION_MIN_SAMPLES = 4
/** Feature properties kept on the card/export: bounded so a wide table cannot bloat it. */
export const SELECTION_MAX_PROPERTIES = 24
/** Attributes shown inline before the card says "N more"; the rest stay in the export. */
export const PROPERTY_PREVIEW_LIMIT = 12

const METERS_PER_DEGREE_LAT = 110540
const METERS_PER_DEGREE_LON = 111320
/** Property names that plausibly identify a feature in a batch table. */
const IDENTITY_KEYS = ['name', 'Name', 'NAME', 'title', 'id', 'ID', 'identifier']

/**
 * Copyable lon/lat text, six decimals (~0.1 m) so a GIS user can paste it as-is.
 * Returns '' instead of 'NaN' when the card has no usable point.
 */
export function coordinateText(point, digits = 6) {
  if (!point || typeof point !== 'object') return ''
  const lon = Number(point.lon)
  const lat = Number(point.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return ''
  const fixed = (value) => value.toFixed(digits)
  return `${fixed(lon)}, ${fixed(lat)}`
}

/**
 * Split a batch-table property list into the preview rows and the hidden count.
 * The card shows attributes first (that is what "what is this object" means);
 * heights come from measurements, not from metadata.
 */
export function shownProperties(properties, limit = PROPERTY_PREVIEW_LIMIT) {
  const list = Array.isArray(properties) ? properties : []
  const shown = list.slice(0, Math.max(0, limit))
  return { shown, total: list.length, hidden: Math.max(0, list.length - shown.length) }
}

/** Round to one decimal; non-finite input stays null (never a fake zero). */
export function round1(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value * 10) / 10
}

/**
 * Displace a lon/lat by a ground distance and a bearing (0 = north, 90 = east).
 * Local flat approximation: the ring radii are tens of metres, far below the
 * error a proper geodesic would buy us here.
 */
export function offsetCartographic(lon, lat, bearingDeg, distanceM) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  if (!Number.isFinite(bearingDeg) || !Number.isFinite(distanceM) || distanceM <= 0) return null
  const bearing = (bearingDeg * Math.PI) / 180
  const north = (distanceM * Math.cos(bearing)) / METERS_PER_DEGREE_LAT
  const cosLat = Math.max(0.02, Math.cos((lat * Math.PI) / 180))
  const east = (distanceM * Math.sin(bearing)) / (METERS_PER_DEGREE_LON * cosLat)
  const nextLat = Math.min(89, Math.max(-89, lat + north))
  // Only wrap when crossing the antimeridian: a plain `% 360` would turn an
  // unchanged longitude into 114.29999999999995 and pollute the card/JSON.
  let nextLon = lon + east
  if (nextLon > 180) nextLon -= 360
  else if (nextLon < -180) nextLon += 360
  return { lon: nextLon, lat: nextLat }
}

/**
 * Sample positions around a centre: one ring per radius, 8 bearings each.
 * Returned in a stable order (radius outer loop) so tests and the card can label
 * the same sample twice.
 */
export function selectionOffsets(center, { radii = SELECTION_RADII_M, directions = SELECTION_DIRECTIONS } = {}) {
  const lon = Number(center?.lon)
  const lat = Number(center?.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return []
  const list = []
  const count = Math.max(1, Math.min(directions, 36))
  for (const radius of radii) {
    if (!Number.isFinite(radius) || radius <= 0) continue
    for (let step = 0; step < count; step += 1) {
      const bearing = (step * 360) / count
      const point = offsetCartographic(lon, lat, bearing, radius)
      if (point) list.push({ lon: point.lon, lat: point.lat, distance_m: radius, bearing_deg: bearing })
    }
  }
  return list
}

/** Median of a numeric list (empty list → null). */
export function medianOf(values) {
  const list = (Array.isArray(values) ? values : []).filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (list.length === 0) return null
  const sorted = [...list].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Summarise sampled neighbour heights. `count` is the number of real values, so
 * a card can say "8 点抽样" instead of implying the full 24-point grid ran.
 */
export function summarizeHeights(values) {
  const list = (Array.isArray(values) ? values : []).filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (list.length === 0) {
    return { count: 0, min: null, max: null, median: null, spread: null }
  }
  const sorted = [...list].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  return {
    count: sorted.length,
    min: round1(min),
    max: round1(max),
    median: round1(medianOf(sorted)),
    spread: round1(max - min),
  }
}

/**
 * Classify a pick into what the browser can actually establish. The controller
 * passes a plain object so this module stays Cesium-free:
 * `{ kind, name, properties }` where kind is one of
 * tile_feature / tileset / entity / terrain / scene.
 */
export function normalizeIdentity(raw) {
  const kind = typeof raw?.kind === 'string' ? raw.kind : 'scene'
  const featureId = typeof raw?.featureId === 'number' && Number.isFinite(raw.featureId) ? raw.featureId : null
  const properties = (Array.isArray(raw?.properties) ? raw.properties : [])
    .filter((entry) => entry && typeof entry.name === 'string')
    .slice(0, SELECTION_MAX_PROPERTIES)
    .map((entry) => ({ name: entry.name.slice(0, 60), value: String(entry.value ?? '').slice(0, 160) }))
  let name = typeof raw?.name === 'string' && raw.name.trim() !== '' ? raw.name.trim().slice(0, 80) : null
  if (name === null) {
    const found = properties.find((entry) => IDENTITY_KEYS.includes(entry.name))
    if (found && found.value.trim() !== '') name = found.value.trim().slice(0, 80)
  }
  return {
    kind,
    ...(featureId !== null ? { featureId } : {}),
    name,
    properties,
    basis: name === null ? 'geometry_only' : kind === 'entity' ? 'entity_name' : 'layer_metadata',
  }
}

/** Map a HeightService ground sample source tag to a stable i18n key. */
export function groundSourceLabelKey(source) {
  if (source === 'tileset' || source === '3d_tiles') return 'selection.groundSource.tileset'
  if (source === 'terrain') return 'selection.groundSource.terrain'
  if (source === 'ellipsoid') return 'selection.groundSource.ellipsoid'
  return 'selection.groundSource.none'
}

/** Limitations describe what the selection cannot claim, with stable codes. */
export function selectionLimitations({ identity, layer, sampling }) {
  const limitations = []
  if (identity.kind === 'tileset') limitations.push('tile_feature_only')
  if (identity.kind === 'tile_feature' && identity.name === null) limitations.push('no_feature_name')
  if (identity.name === null) limitations.push('no_building_identity')
  if (sampling.count < SELECTION_MIN_SAMPLES) limitations.push('too_few_height_samples')
  if (sampling.count > 0) limitations.push('neighbour_sampled_height')
  if (!layer) limitations.push('layer_source_unknown')
  return limitations
}

/** Unknowns are the fields a building-level identity would fill. */
export function selectionUnknowns(identity) {
  const unknowns = []
  if (identity.name === null) unknowns.push('name')
  unknowns.push('use', 'ownership', 'footprint')
  return unknowns
}

/**
 * Build the card the panel shows (and the export serialises).
 *
 * @param {object} input
 * @param {{lon:number,lat:number,surface_height_m:number|null}} input.point
 * @param {{id?:string,name?:string,source?:object}|null} input.layer
 * @param {object} input.identity result of the pick classification
 * @param {Array<{distance_m:number,bearing_deg:number,height_m:number|null,source?:string}>} input.samples
 */
export function buildSelectionCard({ point, layer, identity: rawIdentity, samples, id, createdAt } = {}) {
  const safePoint = {
    lon: Number.isFinite(point?.lon) ? point.lon : 0,
    lat: Number.isFinite(point?.lat) ? point.lat : 0,
    surface_height_m: round1(point?.surface_height_m),
  }
  const identity = normalizeIdentity(rawIdentity)
  const list = Array.isArray(samples) ? samples : []
  const heights = list.map((sample) => (typeof sample?.height_m === 'number' ? sample.height_m : null))
  const sampling = {
    method: 'neighbor_ring',
    radii_m: SELECTION_RADII_M,
    directions: SELECTION_DIRECTIONS,
    requested: list.length,
    count: summarizeHeights(heights).count,
    ...summarizeHeights(heights),
  }
  // The lowest neighbour is the best free ground estimate we can get without a
  // terrain provider; the height service says where the number came from.
  const lowest = list
    .filter((sample) => typeof sample?.height_m === 'number')
    .sort((a, b) => a.height_m - b.height_m)[0]
  const ground = sampling.min
  const groundSource = lowest?.source ?? 'none'
  const objectHeight =
    safePoint.surface_height_m !== null && ground !== null
      ? round1(Math.max(0, safePoint.surface_height_m - ground))
      : null
  const aboveMedian =
    safePoint.surface_height_m !== null && sampling.median !== null ? round1(safePoint.surface_height_m - sampling.median) : null
  const facts = [
    {
      key: 'surface_height',
      value: safePoint.surface_height_m,
      unit: 'm',
      basis: 'measured',
      source: 'height_service',
    },
    {
      key: 'object_height',
      value: objectHeight,
      unit: 'm',
      basis: objectHeight === null ? 'inferred' : 'estimated',
      method: 'neighbor_ring',
      sample_count: sampling.count,
      ground_m: ground,
      spread_m: sampling.spread,
    },
    {
      key: 'above_median',
      value: aboveMedian,
      unit: 'm',
      basis: aboveMedian === null ? 'inferred' : 'estimated',
      method: 'neighbor_ring',
    },
    {
      key: 'ground_source',
      value: groundSource,
      unit: null,
      basis: 'measured',
    },
  ]
  const confidence = objectHeight === null ? 'inferred' : 'estimated'
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: typeof id === 'string' && id !== '' ? id : `sel-${Date.now().toString(36)}`,
    createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
    point: safePoint,
    layer: layer ? { id: layer.id ?? null, name: layer.name ?? null, source: layer.source ?? null } : null,
    identity,
    sampling,
    facts,
    confidence,
    unknowns: selectionUnknowns(identity),
    limitations: selectionLimitations({ identity, layer, sampling }),
  }
}

/**
 * The JSON sidecar written next to the PNG. It carries the same card plus the
 * viewer context needed to reproduce the shot, and states the height datum so a
 * GIS user never has to guess whether heights are ellipsoidal or orthometric.
 */
export function buildEvidencePack({ card, view, pluginVersion, capturedAt, image } = {}) {
  const safeView = view
    ? {
        lon: Number.isFinite(view.lon) ? view.lon : null,
        lat: Number.isFinite(view.lat) ? view.lat : null,
        height: round1(Number(view.height)),
        heading: round1(Number(view.heading)),
        pitch: round1(Number(view.pitch)),
      }
    : null
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    kind: 'digital-earth-evidence',
    id: card?.id ?? null,
    capturedAt: typeof capturedAt === 'string' ? capturedAt : new Date().toISOString(),
    pluginVersion: typeof pluginVersion === 'string' ? pluginVersion : null,
    view: safeView,
    point: card?.point ?? null,
    layer: card?.layer ?? null,
    identity: card?.identity ?? null,
    facts: Array.isArray(card?.facts) ? card.facts : [],
    sampling: card?.sampling ?? null,
    confidence: card?.confidence ?? 'inferred',
    unknowns: Array.isArray(card?.unknowns) ? card.unknowns : [],
    limitations: Array.isArray(card?.limitations) ? card.limitations : [],
    earth: { datum: 'WGS84', height_reference: 'ellipsoid' },
    image:
      image && typeof image === 'object'
        ? {
            format: image.format === 'jpeg' ? 'jpeg' : 'png',
            width: Number.isInteger(image.width) ? image.width : null,
            height: Number.isInteger(image.height) ? image.height : null,
          }
        : null,
  }
}
