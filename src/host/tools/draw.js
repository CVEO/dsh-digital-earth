/**
 * earth_draw: GeoJSON validation, schema, renderer and the tool factory.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { DRAW_TIMEOUT_MS, MAX_DRAW_COORDINATES, MAX_DRAW_FEATURES } from '../constants.js'
import { PANEL_CLOSED_MESSAGE, SESSION_FALLBACK_NOTE, asResultObject, resolveSessionTarget, scrubToken } from '../session.js'
import { isPlainObject } from '../sanitize.js'

const DRAW_TOOL_NAME = 'earth_draw'

const DRAW_STYLES = ['accent', 'alert', 'success', 'warm', 'violet']
const MAX_DRAW_LABEL = 80

const DRAW_PARAMETERS = {
  type: 'object',
  properties: {
    features: {
      type: 'string',
      description: 'GeoJSON as a JSON string: a FeatureCollection, a Feature, or a bare geometry (Point / MultiPoint / LineString / MultiLineString / Polygon / MultiPolygon / GeometryCollection). WGS84 coordinates as [lon, lat] or [lon, lat, height] in degrees and meters. Required unless clear is true.',
    },
    style: {
      type: 'string',
      enum: DRAW_STYLES,
      description: 'Colour preset for the new annotations. Default accent.',
    },
    label: {
      type: 'string',
      description: `Optional caption for the whole annotation set (up to ${MAX_DRAW_LABEL} characters). Feature properties.name becomes the per-feature label when present.`,
    },
    clear: {
      type: 'boolean',
      description: 'true first removes every overlay the Agent drew earlier in this panel (annotations and measurements); it may be used alone.',
    },
  },
  additionalProperties: false,
}

const DRAW_DESCRIPTION = [
  'Draw annotations on the interactive digital earth panel: points, lines, polygons and labels from GeoJSON the Agent provides.',
  'Use it to show the user where something is — mark sites, outline areas, trace routes, label features. The overlay stays until a later call passes clear=true.',
  'Coordinates are WGS84 degrees; height is optional meters. Do not guess coordinates: take them from the user, from earth_scene status/pick, or from geodata the user provided. One call accepts up to 500 features and 20000 coordinates.',
  'Returns compact JSON with the count by geometry type and the bounding box.',
].join('\n')

const drawError = (message) => new Error(`earth_draw: ${message}`)

// ---------------------------------------------------------------------------
// earth_draw / earth_measure: browser-side overlays. The Host validates the
// model input (bounded size, real WGS84 positions) and forwards a normalized
// payload; the panel owns the Cesium entities and the numeric geometry.
// ---------------------------------------------------------------------------

const DRAW_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

/** Validate one GeoJSON position; `position` may carry an optional height. */
function validateDrawPosition(position) {
  if (!Array.isArray(position) || position.length < 2 || position.length > 3) {
    throw drawError('every GeoJSON position must be [lon, lat] or [lon, lat, height].')
  }
  for (const value of position) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw drawError('GeoJSON coordinates must be finite numbers.')
    }
  }
  const [lon, lat, height] = position
  if (lon < -180 || lon > 180) throw drawError(`longitude ${lon} is outside -180..180 degrees.`)
  if (lat < -90 || lat > 90) throw drawError(`latitude ${lat} is outside -90..90 degrees.`)
  if (position.length === 3 && Math.abs(height) > 10000000) {
    throw drawError('height must be within ±10,000,000 meters.')
  }
}

/**
 * Reject degenerate geometry up front: a LineString with one position or a
 * Polygon ring with two would otherwise draw nothing (or a NaN label) while the
 * tool reports success, which is worse for the model than an actionable error.
 */
function validateDrawGeometryShape(type, coordinates) {
  const isPosition = (value) => Array.isArray(value) && typeof value[0] === 'number'
  const requireArray = (value, message) => {
    if (!Array.isArray(value) || value.length === 0) throw drawError(message)
    return value
  }
  // A positions array must be an array *of positions*, not one position passed
  // by mistake (e.g. a LineString with coordinates [1, 2]).
  const requirePositions = (value, message, minimum) => {
    if (!Array.isArray(value) || value.length < minimum || !value.every(isPosition)) throw drawError(message)
    return value
  }
  switch (type) {
    case 'Point':
      validateDrawPosition(coordinates)
      return
    case 'MultiPoint':
      requirePositions(coordinates, 'a MultiPoint needs a non-empty array of [lon, lat] positions.', 1)
      return
    case 'LineString':
      requirePositions(coordinates, 'a LineString needs at least 2 positions.', 2)
      return
    case 'MultiLineString':
      for (const line of requireArray(coordinates, 'a MultiLineString needs at least one line.')) {
        requirePositions(line, 'every MultiLineString line needs at least 2 positions.', 2)
      }
      return
    case 'Polygon':
      for (const ring of requireArray(coordinates, 'a Polygon needs at least one ring.')) {
        requirePositions(ring, 'every Polygon ring needs at least 3 positions.', 3)
      }
      return
    case 'MultiPolygon':
      for (const polygon of requireArray(coordinates, 'a MultiPolygon needs at least one polygon.')) {
        for (const ring of requireArray(polygon, 'every MultiPolygon polygon needs at least one ring.')) {
          requirePositions(ring, 'every Polygon ring needs at least 3 positions.', 3)
        }
      }
      return
    default:
      throw drawError(`unsupported geometry type ${JSON.stringify(type)}; supported: ${[...DRAW_GEOMETRY_TYPES].join(', ')}.`)
  }
}

/**
 * Walk a GeoJSON coordinates value (any nesting depth) and validate every
 * position in place. A position is an array whose first entry is a number.
 */
function collectDrawPositions(value, positions) {
  if (!Array.isArray(value)) throw drawError('GeoJSON coordinates must be nested arrays of numbers.')
  if (value.length === 0) return
  if (typeof value[0] === 'number') {
    validateDrawPosition(value)
    positions.push(value)
    return
  }
  for (const item of value) collectDrawPositions(item, positions)
}

/** Keep only scalar feature properties and derive a display name, when any. */
function drawFeatureProperties(feature) {
  const source = feature?.properties
  const properties = {}
  if (source !== null && typeof source === 'object' && !Array.isArray(source)) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') properties[key] = value
    }
  }
  for (const key of ['name', 'title', 'label']) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim() !== '') {
      properties.name = value.trim().slice(0, 120)
      break
    }
  }
  return properties
}

/** Validate and flatten GeoJSON into a bounded FeatureCollection the panel draws. */
function normalizeDrawGeoJson(input) {
  let document = input
  if (typeof document === 'string') {
    try {
      document = JSON.parse(document)
    } catch (error) {
      throw drawError(`"features" must be valid GeoJSON JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw drawError('"features" must be a GeoJSON object (FeatureCollection, Feature or a geometry).')
  }
  const features = []
  const state = { coordinates: 0 }
  const addFeature = (feature) => {
    const geometry = feature?.geometry
    // GeoJSON allows a null geometry; it has nothing to draw.
    if (geometry === null || geometry === undefined) return
    const type = geometry?.type
    if (typeof type !== 'string' || !DRAW_GEOMETRY_TYPES.has(type)) {
      throw drawError(`unsupported geometry type ${JSON.stringify(type)}; supported: ${[...DRAW_GEOMETRY_TYPES].join(', ')}.`)
    }
    if (type === 'GeometryCollection') {
      if (!Array.isArray(geometry.geometries)) throw drawError('a GeometryCollection needs a geometries array.')
      for (const child of geometry.geometries) addFeature({ properties: feature.properties, geometry: child })
      return
    }
    validateDrawGeometryShape(type, geometry.coordinates)
    const positions = []
    collectDrawPositions(geometry.coordinates, positions)
    state.coordinates += positions.length
    if (state.coordinates > MAX_DRAW_COORDINATES) {
      throw drawError(`the GeoJSON has more than ${MAX_DRAW_COORDINATES} coordinates; split it into several calls.`)
    }
    features.push({
      type: 'Feature',
      properties: drawFeatureProperties(feature),
      geometry: { type, coordinates: geometry.coordinates },
    })
    if (features.length > MAX_DRAW_FEATURES) {
      throw drawError(`the GeoJSON has more than ${MAX_DRAW_FEATURES} features; split it into several calls.`)
    }
  }
  if (document.type === 'FeatureCollection') {
    if (!Array.isArray(document.features)) throw drawError('a FeatureCollection needs a features array.')
    for (const feature of document.features) {
      if (feature === null || typeof feature !== 'object' || feature.type !== 'Feature') {
        throw drawError('every entry of a FeatureCollection must be a GeoJSON Feature.')
      }
      addFeature(feature)
    }
  } else if (document.type === 'Feature') {
    addFeature(document)
  } else {
    addFeature({ geometry: document, properties: {} })
  }
  return { type: 'FeatureCollection', features }
}

/** Validate the model-facing earth_draw arguments and build the bridge command. */
export function normalizeDrawRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (typeof input !== 'object' || Array.isArray(input)) throw drawError('the arguments must be an object.')
  const accepted = new Set(['features', 'style', 'clear', 'label'])
  for (const key of Object.keys(input)) {
    if (accepted.has(key)) continue
    throw drawError(`it does not accept "${key}"; accepted arguments: features, style, label, clear.`)
  }
  if (input.clear !== undefined && typeof input.clear !== 'boolean') {
    throw drawError('"clear" must be true or false.')
  }
  const clear = input.clear === true
  let style = 'accent'
  if (input.style !== undefined) {
    if (typeof input.style !== 'string' || !DRAW_STYLES.includes(input.style)) {
      throw drawError(`"style" must be one of ${DRAW_STYLES.join(', ')}.`)
    }
    style = input.style
  }
  let label = ''
  if (input.label !== undefined) {
    if (typeof input.label !== 'string') throw drawError('"label" must be a string.')
    label = input.label.trim().slice(0, MAX_DRAW_LABEL)
  }
  const args = { clear, style }
  if (label !== '') args.label = label
  if (input.features !== undefined && input.features !== null) {
    const geojson = normalizeDrawGeoJson(input.features)
    if (geojson.features.length === 0 && !clear) {
      throw drawError('"features" contains no drawable features; pass at least one Point, LineString or Polygon, or use clear=true.')
    }
    if (geojson.features.length > 0) args.geojson = geojson
  } else if (!clear) {
    throw drawError('needs "features" with GeoJSON to draw, or clear=true to remove the overlays the Agent drew earlier.')
  }
  return { args }
}

function renderDrawResult(value) {
  const lines = []
  if (value.cleared === true) lines.push('Cleared the overlays the Agent drew earlier on the digital earth.')
  const drawn = Number.isInteger(value.drawn) ? value.drawn : 0
  if (drawn > 0) {
    const byType = isPlainObject(value.by_type) ? value.by_type : {}
    const parts = ['points', 'lines', 'polygons']
      .filter((key) => Number.isInteger(byType[key]) && byType[key] > 0)
      .map((key) => `${key}=${byType[key]}`)
    lines.push(`Drew ${drawn} feature${drawn === 1 ? '' : 's'} on the digital earth${parts.length > 0 ? ` (${parts.join(', ')})` : ''}.`)
    const bbox = isPlainObject(value.bbox) ? value.bbox : null
    if (bbox !== null) {
      lines.push(`Bounding box: west=${bbox.west}, south=${bbox.south}, east=${bbox.east}, north=${bbox.north}.`)
    }
    if (typeof value.label === 'string' && value.label !== '') lines.push(`Label: ${value.label}`)
    lines.push('Call earth_capture if the user should see the annotated view.')
  } else if (value.cleared !== true) {
    lines.push('No features were drawn.')
  }
  return lines.join('\n')
}

export function createDrawTool(bridge) {
  return {
    name: DRAW_TOOL_NAME,
    description: DRAW_DESCRIPTION,
    parameters: DRAW_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderDrawResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeDrawRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'draw', request.args, DRAW_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}
