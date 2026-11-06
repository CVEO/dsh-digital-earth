/**
 * earth_measure: point validation, schema, renderer and the tool factory.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { MAX_MEASURE_POINTS, MEASURE_TIMEOUT_MS, MIN_MEASURE_POINTS } from '../constants.js'
import { PANEL_CLOSED_MESSAGE, SESSION_FALLBACK_NOTE, asResultObject, resolveSessionTarget, scrubToken } from '../session.js'

const MEASURE_TOOL_NAME = 'earth_measure'

const MEASURE_MODES = ['distance', 'area', 'height']

const MEASURE_PARAMETERS = {
  type: 'object',
  properties: {
    mode: {
      type: 'string',
      enum: MEASURE_MODES,
      description: 'distance: geodesic length along the points; area: planar area of the polygon (perimeter included); height: height difference between the first and last point, with horizontal distance and slope.',
    },
    points: {
      type: 'array',
      description: 'Ordered points, each [lon, lat] or [lon, lat, height] (WGS84 degrees, meters). distance needs 2+, area needs 3+, height needs exactly 2. Up to 200 points.',
      items: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    draw: {
      type: 'boolean',
      description: 'Draw the measurement (points, line or polygon, and a result label) on the globe. Default true.',
    },
    clear: {
      type: 'boolean',
      description: 'true first removes every overlay the Agent drew earlier in this panel (annotations and measurements).',
    },
  },
  required: ['mode', 'points'],
  additionalProperties: false,
}

const MEASURE_DESCRIPTION = [
  'Measure on the digital earth panel and return the numeric result: geodesic distance along points, area of a polygon, or the height difference between two points.',
  'Coordinates are WGS84 degrees. distance and area are measured on the ellipsoid surface; height mode uses each point\'s height when provided, otherwise the terrain/globe surface height the panel reports. Measure only where the user asked or where the scene shows a real feature.',
  'By default the measurement is also drawn on the globe (points, line/polygon and a label) so the user can see it; pass draw=false for a numeric-only answer, and clear=true to remove earlier Agent overlays first.',
  'Returns compact JSON with meters/degrees plus a rendered summary; call earth_capture to show it.',
].join('\n')

const measureError = (message) => new Error(`earth_measure: ${message}`)

/** Validate one [lon, lat] or [lon, lat, height] measurement point. */
function normalizeMeasurePoint(position, index) {
  const label = `points[${index}]`
  if (!Array.isArray(position) || position.length < 2 || position.length > 3) {
    throw measureError(`${label} must be [lon, lat] or [lon, lat, height].`)
  }
  for (const value of position) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw measureError(`${label} must contain finite numbers.`)
    }
  }
  const [lon, lat, height] = position
  if (lon < -180 || lon > 180) throw measureError(`${label} longitude ${lon} is outside -180..180 degrees.`)
  if (lat < -90 || lat > 90) throw measureError(`${label} latitude ${lat} is outside -90..90 degrees.`)
  if (position.length === 3 && Math.abs(height) > 10000000) throw measureError(`${label} height must be within ±10,000,000 meters.`)
  return position.length === 3 ? [lon, lat, height] : [lon, lat]
}

/** Validate the model-facing earth_measure arguments and build the bridge command. */
export function normalizeMeasureRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (typeof input !== 'object' || Array.isArray(input)) throw measureError('the arguments must be an object.')
  const accepted = new Set(['mode', 'points', 'draw', 'clear'])
  for (const key of Object.keys(input)) {
    if (accepted.has(key)) continue
    throw measureError(`it does not accept "${key}"; accepted arguments: mode, points, draw, clear.`)
  }
  const mode = input.mode
  if (typeof mode !== 'string' || !MEASURE_MODES.includes(mode)) {
    throw measureError(`"mode" must be one of ${MEASURE_MODES.join(', ')}.`)
  }
  if (!Array.isArray(input.points)) {
    throw measureError('"points" must be an array of [lon, lat] or [lon, lat, height] positions.')
  }
  if (input.points.length < MIN_MEASURE_POINTS) {
    throw measureError(`"points" needs at least ${MIN_MEASURE_POINTS} positions.`)
  }
  if (input.points.length > MAX_MEASURE_POINTS) {
    throw measureError(`"points" is limited to ${MAX_MEASURE_POINTS} positions per call.`)
  }
  const points = input.points.map((position, index) => normalizeMeasurePoint(position, index))
  if (mode === 'area' && points.length < 3) throw measureError('area needs at least 3 points.')
  if (mode === 'height' && points.length !== 2) throw measureError('height needs exactly 2 points (the first and the last).')
  if (input.draw !== undefined && typeof input.draw !== 'boolean') throw measureError('"draw" must be true or false.')
  if (input.clear !== undefined && typeof input.clear !== 'boolean') throw measureError('"clear" must be true or false.')
  return { args: { mode, points, draw: input.draw !== false, clear: input.clear === true } }
}

/** Compact host-side distance text for model-facing renderers. */
export function formatMeasureDistance(meters) {
  if (!Number.isFinite(meters)) return 'unknown'
  return meters >= 1000 ? `${(meters / 1000).toFixed(3)} km (${meters.toFixed(1)} m)` : `${meters.toFixed(2)} m`
}

/** Compact host-side area text for model-facing renderers. */
function formatMeasureArea(squareMeters) {
  if (!Number.isFinite(squareMeters)) return 'unknown'
  if (squareMeters >= 1e6) return `${(squareMeters / 1e6).toFixed(3)} km² (${Math.round(squareMeters)} m²)`
  return `${squareMeters.toFixed(1)} m²`
}

function renderMeasureResult(value) {
  const lines = []
  if (value.cleared === true) lines.push('Cleared the overlays the Agent drew earlier on the digital earth.')
  if (value.mode === 'distance' && Number.isFinite(value.distance_m)) {
    lines.push(`Geodesic distance: ${formatMeasureDistance(value.distance_m)} across ${Number.isInteger(value.points) ? value.points : '?'} points.`)
  } else if (value.mode === 'area' && Number.isFinite(value.area_m2)) {
    const perimeter = Number.isFinite(value.perimeter_m) ? `, perimeter ${formatMeasureDistance(value.perimeter_m)}` : ''
    lines.push(`Area: ${formatMeasureArea(value.area_m2)}${perimeter}.`)
  } else if (value.mode === 'height' && Number.isFinite(value.height_m)) {
    const sign = value.height_m >= 0 ? '+' : ''
    const horizontal = Number.isFinite(value.horizontal_m) ? ` over ${formatMeasureDistance(value.horizontal_m)} horizontal distance` : ''
    const slope = Number.isFinite(value.slope_deg) ? ` (slope ${value.slope_deg.toFixed(1)}°)` : ''
    lines.push(`Height difference: ${sign}${value.height_m.toFixed(2)} m${horizontal}${slope}.`)
  } else {
    lines.push(`Measurement (${String(value.mode)}) completed.`)
  }
  if (value.drawn === true) lines.push('The measurement is drawn on the globe; call earth_capture if the user should see it.')
  return lines.join('\n')
}

export function createMeasureTool(bridge) {
  return {
    name: MEASURE_TOOL_NAME,
    description: MEASURE_DESCRIPTION,
    parameters: MEASURE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderMeasureResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeMeasureRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'measure', request.args, MEASURE_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}
