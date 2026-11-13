/**
 * scene/annotation-model.js — user annotations as plain GeoJSON features (F2).
 *
 * An annotation is not a separate data type: it is a GeoJSON Feature whose
 * properties carry the human meaning (name / note / kind / source) while the
 * geometry stays standard so the same record can be exported, re-imported and
 * handed to other GIS tools. Keeping the model pure means the panel, the canvas
 * editor and the import/export path all agree on the same rules.
 *
 * Honesty rules:
 *   - a feature without a name is still a feature; never invent one;
 *   - an unsupported edit (Multi* geometry, too few vertices) returns an error
 *     code instead of a silently broken geometry;
 *   - coordinates are clamped/validated to WGS84 bounds, exported with 6 decimals.
 */

export const ANNOTATION_MAX_NAME = 80
export const ANNOTATION_MAX_NOTE = 280
export const ANNOTATION_MAX_HEIGHT_M = 5000
/** Vertical/styling intent of a feature, independent of its geometry type. */
export const ANNOTATION_KINDS = ['point', 'line', 'area', 'note']
/** Style presets shared with earth_draw, so annotation layers look consistent. */
export const ANNOTATION_STYLES = ['accent', 'alert', 'success', 'warm', 'violet']
export const ANNOTATION_UNDO_LIMIT = 20
/** Decimal places used on export: ~0.1 m, enough for a study area, no fake precision. */
export const ANNOTATION_COORDINATE_DECIMALS = 6

const DEFAULT_KIND_BY_GEOMETRY = {
  Point: 'point',
  MultiPoint: 'point',
  LineString: 'line',
  MultiLineString: 'line',
  Polygon: 'area',
  MultiPolygon: 'area',
}

/** Trim + bound one free-text property; null for non-strings so callers stay simple. */
export function annotationText(value, limit) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

/** Human kind of a feature: explicit properties.kind wins, else derived from geometry. */
export function annotationKindOf(feature) {
  const explicit = feature?.properties?.kind
  if (typeof explicit === 'string' && ANNOTATION_KINDS.includes(explicit)) return explicit
  const type = feature?.geometry?.type
  return DEFAULT_KIND_BY_GEOMETRY[type] ?? 'note'
}

/** Display name of the feature; '' when the author has not named it yet. */
export function annotationName(feature) {
  return annotationText(feature?.properties?.name, ANNOTATION_MAX_NAME)
}

/** Free-form note shown in the card; '' when absent. */
export function annotationNote(feature) {
  return annotationText(feature?.properties?.note, ANNOTATION_MAX_NOTE)
}

const finiteHeight = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** Effective symbol style of a feature: explicit properties.style wins, else command fallback. */
export function annotationStyleOf(feature, fallback = 'accent') {
  const explicit = feature?.properties?.style
  if (typeof explicit === 'string' && ANNOTATION_STYLES.includes(explicit)) return explicit
  return typeof fallback === 'string' && ANNOTATION_STYLES.includes(fallback) ? fallback : 'accent'
}

/** Normalized 3D extrusion state and relative height (m) matching vector-renderer polygonVolume rules. */
export function annotationExtrusionOf(feature, defaultHeight = 15) {
  const props = feature?.properties && typeof feature.properties === 'object' ? feature.properties : {}
  const baseHeight =
    finiteHeight(props.base_height_m) ?? finiteHeight(props.ground_height_m) ?? finiteHeight(props.baseHeight) ?? 0
  const roofExplicit = finiteHeight(props.extruded_height_m) ?? finiteHeight(props.extrudedHeight)
  const rel = finiteHeight(props.height_m) ?? finiteHeight(props.building_height_m) ?? finiteHeight(props.height)
  let heightM = rel !== null && rel > 0 ? rel : null
  if (heightM === null && roofExplicit !== null && roofExplicit > baseHeight) {
    heightM = Math.round((roofExplicit - baseHeight) * 100) / 100
  }
  const hasExtrudedTrigger =
    (roofExplicit !== null && roofExplicit > baseHeight) ||
    (rel !== null &&
      rel > 0 &&
      (finiteHeight(props.base_height_m) !== null ||
        finiteHeight(props.ground_height_m) !== null ||
        finiteHeight(props.baseHeight) !== null ||
        props.height_m != null ||
        props.building_height_m != null ||
        props.mode3d === true ||
        props.extruded === true))
  const enabled = props.extruded === false ? false : Boolean(hasExtrudedTrigger)
  return {
    enabled,
    height_m: heightM ?? defaultHeight,
    has_height: heightM !== null,
    base_height_m: baseHeight,
  }
}

let generatedFeatureCounter = 0

/** Stable feature identifier across replays; checks properties.feature_id then feature.id. */
export function annotationFeatureId(feature) {
  const propId = feature?.properties?.feature_id
  if (typeof propId === 'string' && propId.trim() !== '') return propId.trim()
  if (typeof propId === 'number' && Number.isFinite(propId)) return String(propId)
  if (typeof feature?.id === 'string' && feature.id.trim() !== '') return feature.id.trim()
  if (typeof feature?.id === 'number' && Number.isFinite(feature.id)) return String(feature.id)
  return ''
}

/** Return a feature guaranteed to have a non-empty properties.feature_id. */
export function ensureAnnotationFeatureId(feature) {
  if (feature === null || typeof feature !== 'object' || feature.type !== 'Feature') return feature
  const existing = annotationFeatureId(feature)
  const id = existing !== '' ? existing : `feat-${Date.now().toString(36)}-${(generatedFeatureCounter += 1)}`
  if (feature.properties?.feature_id === id) return feature
  return { ...feature, properties: { ...(feature.properties ?? {}), feature_id: id } }
}

/**
 * Patch name/note/kind/style/extrusion of a feature without touching its geometry.
 * Returns {ok:true, feature} (a fresh object) or {ok:false, error}.
 */
export function withAnnotationProperties(feature, patch = {}) {
  if (feature === null || typeof feature !== 'object' || feature.type !== 'Feature') {
    return { ok: false, error: 'invalid_feature' }
  }
  const next = { ...feature, properties: { ...(feature.properties ?? {}) } }
  if (patch.name !== undefined) {
    const name = annotationText(patch.name, ANNOTATION_MAX_NAME)
    if (name === '') delete next.properties.name
    else next.properties.name = name
  }
  if (patch.note !== undefined) {
    const note = annotationText(patch.note, ANNOTATION_MAX_NOTE)
    if (note === '') delete next.properties.note
    else next.properties.note = note
  }
  if (patch.kind !== undefined) {
    if (!ANNOTATION_KINDS.includes(patch.kind)) return { ok: false, error: 'invalid_kind' }
    next.properties.kind = patch.kind
  }
  if (patch.style !== undefined) {
    if (patch.style === '' || patch.style === null) delete next.properties.style
    else if (!ANNOTATION_STYLES.includes(patch.style)) return { ok: false, error: 'invalid_style' }
    else next.properties.style = patch.style
  }
  if (patch.extruded !== undefined) {
    if (typeof patch.extruded !== 'boolean') return { ok: false, error: 'invalid_extruded' }
    next.properties.extruded = patch.extruded
  }
  if (patch.height_m !== undefined) {
    if (patch.height_m === '' || patch.height_m === null) {
      delete next.properties.height_m
      delete next.properties.extruded_height_m
      delete next.properties.extrudedHeight
      delete next.properties.building_height_m
      delete next.properties.height
    } else {
      const value = Number(patch.height_m)
      if (!Number.isFinite(value) || value <= 0 || value > ANNOTATION_MAX_HEIGHT_M) {
        return { ok: false, error: 'invalid_height' }
      }
      const rounded = Math.round(value * 100) / 100
      next.properties.height_m = rounded
      const base =
        finiteHeight(next.properties.base_height_m) ??
        finiteHeight(next.properties.ground_height_m) ??
        finiteHeight(next.properties.baseHeight) ??
        0
      if (
        next.properties.extruded_height_m != null ||
        next.properties.extrudedHeight != null ||
        next.properties.roof_height_m != null
      ) {
        const roof = Math.round((base + rounded) * 100) / 100
        if (next.properties.extrudedHeight !== undefined && next.properties.extruded_height_m === undefined) {
          next.properties.extrudedHeight = roof
        } else {
          next.properties.extruded_height_m = roof
        }
        if (typeof next.properties.roof_height_m === 'number') next.properties.roof_height_m = roof
      }
    }
  }
  return { ok: true, feature: next }
}

/**
 * Replace the geometry after a vertex edit; properties stay and the result must
 * remain writable WGS84. Returns {ok:true, feature} or {ok:false, error}.
 */
export function withAnnotationGeometry(feature, geometry) {
  if (feature === null || typeof feature !== 'object' || feature.type !== 'Feature') {
    return { ok: false, error: 'invalid_feature' }
  }
  if (geometry === null || typeof geometry !== 'object' || typeof geometry.type !== 'string') {
    return { ok: false, error: 'invalid_geometry' }
  }
  const next = { ...feature, geometry }
  if (!annotationBoundsOk(next)) return { ok: false, error: 'out_of_bounds' }
  return { ok: true, feature: next }
}

/** Fill the fields a hand-drawn or imported feature may miss, without inventing names. */
export function normalizeAnnotation(feature, { source = 'manual' } = {}) {
  if (feature === null || typeof feature !== 'object' || feature.type !== 'Feature') {
    return { ok: false, error: 'invalid_feature' }
  }
  const kind = annotationKindOf(feature)
  const properties = {
    ...(feature.properties && typeof feature.properties === 'object' ? feature.properties : {}),
    kind,
  }
  const name = annotationText(properties.name, ANNOTATION_MAX_NAME)
  if (name === '') delete properties.name
  else properties.name = name
  const note = annotationText(properties.note, ANNOTATION_MAX_NOTE)
  if (note === '') delete properties.note
  else properties.note = note
  if (typeof properties.source !== 'string' || properties.source === '') properties.source = source
  return { ok: true, feature: { type: 'Feature', ...(feature.id !== undefined ? { id: feature.id } : {}), properties, geometry: feature.geometry } }
}

/** True when every coordinate can be written into a WGS84 GeoJSON file. */
export function annotationBoundsOk(feature) {
  let valid = true
  const walk = (value) => {
    if (!valid || !Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [lon, lat] = value
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) valid = false
      return
    }
    for (const item of value) walk(item)
  }
  walk(feature?.geometry?.coordinates)
  return valid
}

/** Round coordinates for export so a 6-decimal file does not drift on re-import. */
export function roundAnnotationGeometry(geometry, digits = ANNOTATION_COORDINATE_DECIMALS) {
  if (geometry === null || typeof geometry !== 'object') return geometry
  const factor = 10 ** digits
  const round = (value) => Math.round(value * factor) / factor
  const walk = (value) => {
    if (!Array.isArray(value)) return value
    if (typeof value[0] === 'number') {
      return value.map((part, index) => (index < 2 ? round(part) : part))
    }
    return value.map(walk)
  }
  const next = { ...geometry }
  if (next.coordinates !== undefined) next.coordinates = walk(next.coordinates)
  if (Array.isArray(next.geometries)) next.geometries = next.geometries.map((child) => roundAnnotationGeometry(child, digits))
  return next
}

/**
 * Build the FeatureCollection written to disk (and shown to the Agent). The
 * top-level `name` is a plain GeoJSON foreign member; no private keys leak in.
 */
export function annotationFeatureCollection(features, { name = 'Digital Earth annotations' } = {}) {
  const list = (Array.isArray(features) ? features : [])
    .filter((feature) => feature !== null && typeof feature === 'object' && feature.type === 'Feature')
    .map((feature) => {
      const normalized = normalizeAnnotation(feature, { source: feature.properties?.source ?? 'manual' })
      if (!normalized.ok) return null
      return { ...normalized.feature, geometry: roundAnnotationGeometry(normalized.feature.geometry) }
    })
    .filter(Boolean)
  return {
    type: 'FeatureCollection',
    name: annotationText(name, ANNOTATION_MAX_NAME),
    features: list,
  }
}

/** Flatten the features stored inside draw commands, newest command last. */
export function annotationFeaturesOfCommands(commands) {
  const features = []
  for (const command of Array.isArray(commands) ? commands : []) {
    const list = Array.isArray(command?.geojson?.features) ? command.geojson.features : []
    for (const feature of list) if (feature?.type === 'Feature') features.push(feature)
  }
  return features
}

/** Next free "研究区 1/2/3" style name for a kind, so new features are never anonymous. */
export function nextAnnotationName(features, kind, t) {
  const prefix = typeof t === 'function' ? t(`annotation.kind.${kind}`) : kind
  let index = 1
  const taken = new Set(
    (Array.isArray(features) ? features : [])
      .map((feature) => annotationName(feature))
      .filter((value) => value !== ''),
  )
  while (taken.has(`${prefix} ${index}`)) index += 1
  return `${prefix} ${index}`
}

// ---------------------------------------------------------------------------
// Geometry edits (F2b uses these; the model owns the rules, the canvas only
// supplies a vertex index). Every helper returns a NEW feature or an error code.
// ---------------------------------------------------------------------------

function editableRings(feature) {
  const geometry = feature?.geometry
  if (geometry?.type === 'Point') return { kind: 'point', rings: [geometry.coordinates] }
  if (geometry?.type === 'LineString') return { kind: 'line', rings: [geometry.coordinates] }
  if (geometry?.type === 'Polygon') return { kind: 'area', rings: geometry.coordinates }
  return null
}

function withRings(feature, rings, kind) {
  const geometry = kind === 'point'
    ? { type: 'Point', coordinates: rings[0] }
    : kind === 'line'
      ? { type: 'LineString', coordinates: rings[0] }
      : { type: 'Polygon', coordinates: rings }
  return { ...feature, geometry }
}

/** Locate a vertex by (ring, index). Point/LineString use ring 0. */
export function annotationVertexAt(feature, ringIndex, vertexIndex) {
  const editable = editableRings(feature)
  if (!editable) return null
  const ring = editable.rings[ringIndex]
  if (!Array.isArray(ring) || vertexIndex < 0 || vertexIndex >= ring.length) return null
  const vertex = ring[vertexIndex]
  if (!Array.isArray(vertex) || vertex.length < 2) return null
  return { lon: vertex[0], lat: vertex[1] }
}

/** Move one vertex; the polygon ring stays closed (last == first stays true). */
export function moveAnnotationVertex(feature, ringIndex, vertexIndex, lon, lat) {
  const editable = editableRings(feature)
  if (!editable) return { ok: false, error: 'unsupported_geometry' }
  const ring = editable.rings[ringIndex]
  if (!Array.isArray(ring) || vertexIndex < 0 || vertexIndex >= ring.length) return { ok: false, error: 'vertex_out_of_range' }
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
    return { ok: false, error: 'vertex_out_of_range' }
  }
  const rings = editable.rings.map((item) => item.slice())
  const closed = editable.kind === 'area' && rings[ringIndex].length > 1
  const wrapped = closed && vertexIndex === 0 ? rings[ringIndex].length - 1 : -1
  rings[ringIndex][vertexIndex] = [lon, lat]
  if (wrapped >= 0) rings[ringIndex][wrapped] = [lon, lat]
  if (closed && vertexIndex === rings[ringIndex].length - 1) rings[ringIndex][0] = [lon, lat]
  return { ok: true, feature: withRings(feature, rings, editable.kind) }
}

/** Real corner count of a ring: a closed polygon ring repeats its first vertex. */
function ringCorners(ring, closed) {
  if (!Array.isArray(ring) || ring.length === 0) return 0
  if (!closed || ring.length < 2) return ring.length
  const first = ring[0]
  const last = ring[ring.length - 1]
  return first?.[0] === last?.[0] && first?.[1] === last?.[1] ? ring.length - 1 : ring.length
}

/** Insert a vertex after `vertexIndex` (the ring is re-closed for polygons). */
export function insertAnnotationVertex(feature, ringIndex, vertexIndex, lon, lat) {
  const editable = editableRings(feature)
  if (!editable || editable.kind === 'point') return { ok: false, error: 'unsupported_geometry' }
  const ring = editable.rings[ringIndex]
  const corners = ringCorners(ring, editable.kind === 'area')
  // For a closed ring the duplicate closing vertex is not an insert position.
  if (!Array.isArray(ring) || vertexIndex < 0 || vertexIndex >= corners) return { ok: false, error: 'vertex_out_of_range' }
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
    return { ok: false, error: 'vertex_out_of_range' }
  }
  const rings = editable.rings.map((item) => item.slice())
  const at = vertexIndex + 1
  rings[ringIndex].splice(at, 0, [lon, lat])
  if (editable.kind === 'area') {
    // A closed ring must keep last == first after any insert.
    const next = rings[ringIndex]
    next[next.length - 1] = [next[0][0], next[0][1]]
  }
  return { ok: true, feature: withRings(feature, rings, editable.kind) }
}

/** Delete one vertex; refuses to leave a line with <2 or a ring with <3 corners. */
export function deleteAnnotationVertex(feature, ringIndex, vertexIndex) {
  const editable = editableRings(feature)
  if (!editable || editable.kind === 'point') return { ok: false, error: 'unsupported_geometry' }
  const ring = editable.rings[ringIndex]
  const closed = editable.kind === 'area'
  const corners = ringCorners(ring, closed)
  // Deleting the duplicate closing vertex would leave an open ring: reject it.
  if (!Array.isArray(ring) || vertexIndex < 0 || vertexIndex >= corners) return { ok: false, error: 'vertex_out_of_range' }
  if ((editable.kind === 'line' && corners <= 2) || (closed && corners <= 3)) {
    return { ok: false, error: 'too_few_vertices' }
  }
  const rings = editable.rings.map((item) => item.slice())
  if (closed && vertexIndex === 0) {
    rings[ringIndex].splice(0, 1)
    rings[ringIndex][rings[ringIndex].length - 1] = [rings[ringIndex][0][0], rings[ringIndex][0][1]]
  } else {
    rings[ringIndex].splice(vertexIndex, 1)
  }
  return { ok: true, feature: withRings(feature, rings, editable.kind) }
}

/** Translate every vertex by a lon/lat delta (whole-feature drag). */
export function translateAnnotation(feature, dLon, dLat) {
  const editable = editableRings(feature)
  if (!editable) return { ok: false, error: 'unsupported_geometry' }
  if (!Number.isFinite(dLon) || !Number.isFinite(dLat)) return { ok: false, error: 'vertex_out_of_range' }
  const rings = editable.rings.map((ring) => ring.map((vertex) => {
    if (!Array.isArray(vertex) || vertex.length < 2) return vertex
    return [Math.max(-180, Math.min(180, vertex[0] + dLon)), Math.max(-90, Math.min(90, vertex[1] + dLat))]
  }))
  return { ok: true, feature: withRings(feature, rings, editable.kind) }
}

/**
 * Undo stack for annotation edits: snapshots are small GeoJSON arrays, so the
 * simplest correct implementation is a bounded list of previous states.
 */
export function createAnnotationHistory(limit = ANNOTATION_UNDO_LIMIT) {
  const past = []
  return {
    push(features) {
      past.push(features)
      if (past.length > limit) past.shift()
    },
    undo() {
      return past.length > 0 ? past.pop() : null
    },
    canUndo() {
      return past.length > 0
    },
    size() {
      return past.length
    },
  }
}
