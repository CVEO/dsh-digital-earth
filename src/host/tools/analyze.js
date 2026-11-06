/**
 * earth_analyze: action schema, argument enforcement, renderer and factory.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { ANALYZE_TIMEOUT_MS } from '../constants.js'
import { PANEL_CLOSED_MESSAGE, SESSION_FALLBACK_NOTE, asResultObject, resolveSessionTarget, scrubToken } from '../session.js'
import { formatMeasureDistance } from './measure.js'
import { isPlainObject } from '../sanitize.js'

const ANALYZE_TOOL_NAME = 'earth_analyze'

// Model-facing analysis text plus its JSON fallback; never dump a full flood
// sampling grid or every profile point past this budget.
const ANALYZE_RENDER_LIMIT = 8 * 1024

// ---------------------------------------------------------------------------
// earth_analyze: one active terrain analysis at a time (profile/flood/sunlight),
// plus clear. The Host owns strict model-input validation and the compact text;
// the panel owns sampling, Cesium entities and the analysis card.
// ---------------------------------------------------------------------------

export const ANALYZE_ACTIONS = ['profile', 'flood', 'sunlight', 'clear']
const ANALYZE_PARAMETER_NAMES = new Set([
  'action',
  'layer',
  'from',
  'to',
  'samples',
  'region',
  'water_height',
  'grid',
  'datetime',
  'show_shadows',
])
const ANALYZE_REGION_KEYS = ['west', 'south', 'east', 'north']
const ANALYZE_MIN_SAMPLES = 8
const ANALYZE_MAX_SAMPLES = 64
const ANALYZE_DEFAULT_SAMPLES = 32
const ANALYZE_MIN_GRID = 4
const ANALYZE_MAX_GRID = 24
const ANALYZE_DEFAULT_GRID = 12
const ANALYZE_MIN_WATER_HEIGHT = -1000
const ANALYZE_MAX_WATER_HEIGHT = 9000
const ANALYZE_MAX_REGION_SPAN = 10
const ANALYZE_MIN_YEAR = 1900
const ANALYZE_MAX_YEAR = 2200

const ANALYZE_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ANALYZE_ACTIONS,
      description: 'profile: elevation along the from→to line; flood: water height over a region; sunlight: sun position and shadows at a time; clear: remove the active analysis.',
    },
    layer: {
      type: 'string',
      description: 'Layer name or id from earth_scene status. Omit it to use the topmost visible 3D Tiles layer.',
    },
    from: {
      type: 'array',
      items: { type: 'number' },
      description: 'profile start as [lon, lat] WGS84 degrees (-180..180, -90..90), without a height. Required for profile.',
    },
    to: {
      type: 'array',
      items: { type: 'number' },
      description: 'profile end as [lon, lat] WGS84 degrees (-180..180, -90..90), without a height. Required for profile.',
    },
    samples: {
      type: 'integer',
      minimum: ANALYZE_MIN_SAMPLES,
      maximum: ANALYZE_MAX_SAMPLES,
      description: `profile sample count, ${ANALYZE_MIN_SAMPLES}..${ANALYZE_MAX_SAMPLES}; default ${ANALYZE_DEFAULT_SAMPLES}.`,
    },
    region: {
      type: 'object',
      properties: {
        west: { type: 'number', minimum: -180, maximum: 180 },
        south: { type: 'number', minimum: -90, maximum: 90 },
        east: { type: 'number', minimum: -180, maximum: 180 },
        north: { type: 'number', minimum: -90, maximum: 90 },
      },
      required: ANALYZE_REGION_KEYS,
      additionalProperties: false,
      description: `flood area in WGS84 degrees, required for flood: west<east, south<north, and each span at most ${ANALYZE_MAX_REGION_SPAN} degrees.`,
    },
    water_height: {
      type: 'number',
      minimum: ANALYZE_MIN_WATER_HEIGHT,
      maximum: ANALYZE_MAX_WATER_HEIGHT,
      description: `flood water height in meters, ${ANALYZE_MIN_WATER_HEIGHT}..${ANALYZE_MAX_WATER_HEIGHT}; required for flood.`,
    },
    grid: {
      type: 'integer',
      minimum: ANALYZE_MIN_GRID,
      maximum: ANALYZE_MAX_GRID,
      description: `flood samples per side, ${ANALYZE_MIN_GRID}..${ANALYZE_MAX_GRID}; default ${ANALYZE_DEFAULT_GRID} (grid² samples).`,
    },
    datetime: {
      type: 'string',
      description: 'sunlight ISO 8601 date/time; defaults to now and must fall within the years 1900..2200.',
    },
    show_shadows: {
      type: 'boolean',
      description: 'sunlight shadows on or off; default true.',
    },
  },
  required: ['action'],
  additionalProperties: false,
}

const ANALYZE_DESCRIPTION = [
  'Analyze the digital earth panel: profile elevation along a line, flood a region at a water height, check sunlight and shadows, or clear the active analysis.',
  'One analysis at a time: profile, flood and sunlight replace the previous active analysis; clear removes it and reports what was cleared.',
  'Elevations and depths come from loaded 3D Tiles or terrain heights, so load data first and never guess missing values; the panel returns an error when it has no height data.',
  'Take coordinates from the user, from earth_scene status/pick, or from loaded data; never guess. The layer is optional and defaults to the topmost visible 3D Tiles layer.',
  'Returns compact metrics, not a full sampling grid; call earth_capture if the user should see the drawn result.',
].join('\n')

// ---------------------------------------------------------------------------
// earth_analyze: model-facing input normalization
// ---------------------------------------------------------------------------

const analyzeError = (message, next = 'check the argument against the earth_analyze schema and retry.') =>
  new Error(`earth_analyze: ${message} next: ${next}`)

function normalizeAnalyzeLayer(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw analyzeError(
      '"layer" must be a non-empty layer name or id from earth_scene status.',
      'omit "layer" to use the topmost visible 3D Tiles layer, or pass the exact name from earth_scene list.',
    )
  }
  return value.trim()
}

function normalizeAnalyzeCoordinate(raw, label) {
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw analyzeError(
      `"${label}" must be exactly [lon, lat] without a height.`,
      'send two WGS84 numbers, for example [116.39, 39.9].',
    )
  }
  for (const value of raw) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw analyzeError(
        `"${label}" must contain two finite numbers.`,
        'send [lon, lat] as decimal degrees, for example [116.39, 39.9].',
      )
    }
  }
  const [lon, lat] = raw
  if (lon < -180 || lon > 180) {
    throw analyzeError(
      `"${label}" longitude ${lon} is outside -180..180 degrees.`,
      'send a longitude between -180 and 180.',
    )
  }
  if (lat < -90 || lat > 90) {
    throw analyzeError(
      `"${label}" latitude ${lat} is outside -90..90 degrees.`,
      'send a latitude between -90 and 90.',
    )
  }
  return [lon, lat]
}

function normalizeAnalyzeNumber(raw, label, min, max) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw analyzeError(
      `"${label}" must be a finite number.`,
      `send "${label}" as a number between ${min} and ${max}.`,
    )
  }
  if (raw < min || raw > max) {
    throw analyzeError(
      `"${label}" ${raw} is outside ${min}..${max}.`,
      `send "${label}" within ${min}..${max}.`,
    )
  }
  return raw
}

function normalizeAnalyzeInteger(raw, label, min, max, fallback) {
  if (raw === undefined) return fallback
  if (!Number.isInteger(raw)) {
    throw analyzeError(
      `"${label}" must be an integer.`,
      `send "${label}" as an integer between ${min} and ${max}.`,
    )
  }
  if (raw < min || raw > max) {
    throw analyzeError(
      `"${label}" ${raw} is outside ${min}..${max}.`,
      `send "${label}" within ${min}..${max}.`,
    )
  }
  return raw
}

function normalizeAnalyzeRegion(raw) {
  if (!isPlainObject(raw)) {
    throw analyzeError(
      '"region" must be an object with west, south, east and north.',
      'send the flood area as {west, south, east, north} in WGS84 degrees.',
    )
  }
  for (const key of Object.keys(raw)) {
    if (ANALYZE_REGION_KEYS.includes(key)) continue
    throw analyzeError(
      `"region" does not accept "${key}".`,
      'use exactly west, south, east and north.',
    )
  }
  for (const key of ANALYZE_REGION_KEYS) {
    if (!Object.hasOwn(raw, key)) {
      throw analyzeError(
        `"region" is missing "${key}"; it needs west, south, east and north.`,
        'send all four WGS84 degree boundaries.',
      )
    }
  }
  const west = normalizeAnalyzeNumber(raw.west, 'region.west', -180, 180)
  const south = normalizeAnalyzeNumber(raw.south, 'region.south', -90, 90)
  const east = normalizeAnalyzeNumber(raw.east, 'region.east', -180, 180)
  const north = normalizeAnalyzeNumber(raw.north, 'region.north', -90, 90)
  if (west >= east) {
    throw analyzeError(
      '"region.west" must be less than "region.east".',
      'send a west boundary that lies west of the east boundary.',
    )
  }
  if (south >= north) {
    throw analyzeError(
      '"region.south" must be less than "region.north".',
      'send a south boundary that lies south of the north boundary.',
    )
  }
  if (east - west > ANALYZE_MAX_REGION_SPAN + 1e-9) {
    throw analyzeError(
      `"region" longitude span ${Number((east - west).toFixed(6))} exceeds ${ANALYZE_MAX_REGION_SPAN} degrees.`,
      `narrow the flood area to at most ${ANALYZE_MAX_REGION_SPAN} degrees of longitude.`,
    )
  }
  if (north - south > ANALYZE_MAX_REGION_SPAN + 1e-9) {
    throw analyzeError(
      `"region" latitude span ${Number((north - south).toFixed(6))} exceeds ${ANALYZE_MAX_REGION_SPAN} degrees.`,
      `narrow the flood area to at most ${ANALYZE_MAX_REGION_SPAN} degrees of latitude.`,
    )
  }
  return { west, south, east, north }
}

/** Reject known-but-irrelevant arguments for the chosen action before running it. */
function rejectAnalyzeKeys(input, action, allowed) {
  for (const key of Object.keys(input)) {
    if (key === 'action' || allowed.has(key)) continue
    let next
    if (key === 'region' || key === 'water_height' || key === 'grid') {
      next = 'use action "flood" for these arguments.'
    } else if (key === 'datetime' || key === 'show_shadows') {
      next = 'use action "sunlight" for these arguments.'
    } else if (key === 'from' || key === 'to' || key === 'samples') {
      next = 'use action "profile" for these arguments.'
    } else if (action === 'clear') {
      next = 'clear takes no other arguments and removes the active analysis.'
    } else {
      next = `remove "${key}" or choose the action that accepts it.`
    }
    throw analyzeError(`action "${action}" does not accept "${key}".`, next)
  }
}

/** Validate the model-facing earth_analyze arguments and build the bridge command. */
export function normalizeAnalyzeRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (!isPlainObject(input)) throw analyzeError('the arguments must be an object.')
  for (const key of Object.keys(input)) {
    if (key !== 'action' && !ANALYZE_PARAMETER_NAMES.has(key)) {
      throw analyzeError(
        `it does not accept "${key}"; accepted arguments: ${[...ANALYZE_PARAMETER_NAMES].join(', ')}.`,
        'remove the unknown argument and retry.',
      )
    }
  }
  const action = input.action
  if (typeof action !== 'string' || !ANALYZE_ACTIONS.includes(action)) {
    throw analyzeError(
      `"action" must be one of ${ANALYZE_ACTIONS.join(', ')}.`,
      'choose profile, flood, sunlight or clear.',
    )
  }
  if (action === 'clear') {
    rejectAnalyzeKeys(input, 'clear', new Set())
    return { args: { action } }
  }

  const args = { action }
  if (input.layer !== undefined) args.layer = normalizeAnalyzeLayer(input.layer)

  if (action === 'profile') {
    rejectAnalyzeKeys(input, 'profile', new Set(['layer', 'from', 'to', 'samples']))
    if (!Object.hasOwn(input, 'from')) {
      throw analyzeError('profile needs "from" as [lon, lat].', 'send the profile start and end points.')
    }
    if (!Object.hasOwn(input, 'to')) {
      throw analyzeError('profile needs "to" as [lon, lat].', 'send the profile start and end points.')
    }
    args.from = normalizeAnalyzeCoordinate(input.from, 'from')
    args.to = normalizeAnalyzeCoordinate(input.to, 'to')
    if (args.from[0] === args.to[0] && args.from[1] === args.to[1]) {
      throw analyzeError(
        'profile "from" and "to" are the same point.',
        'choose two distinct positions along the profile line.',
      )
    }
    args.samples = normalizeAnalyzeInteger(
      input.samples,
      'samples',
      ANALYZE_MIN_SAMPLES,
      ANALYZE_MAX_SAMPLES,
      ANALYZE_DEFAULT_SAMPLES,
    )
    return { args }
  }

  if (action === 'flood') {
    rejectAnalyzeKeys(input, 'flood', new Set(['layer', 'region', 'water_height', 'grid']))
    if (!Object.hasOwn(input, 'region')) {
      throw analyzeError('flood needs "region" with west, south, east and north.', 'send the flood area.')
    }
    if (!Object.hasOwn(input, 'water_height')) {
      throw analyzeError('flood needs "water_height" in meters.', 'send the water height to test against the terrain.')
    }
    args.region = normalizeAnalyzeRegion(input.region)
    args.water_height = normalizeAnalyzeNumber(
      input.water_height,
      'water_height',
      ANALYZE_MIN_WATER_HEIGHT,
      ANALYZE_MAX_WATER_HEIGHT,
    )
    args.grid = normalizeAnalyzeInteger(input.grid, 'grid', ANALYZE_MIN_GRID, ANALYZE_MAX_GRID, ANALYZE_DEFAULT_GRID)
    return { args }
  }

  // sunlight
  rejectAnalyzeKeys(input, 'sunlight', new Set(['layer', 'datetime', 'show_shadows']))
  if (input.datetime !== undefined) {
    if (typeof input.datetime !== 'string' || input.datetime.trim() === '') {
      throw analyzeError('"datetime" must be an ISO 8601 date/time string.', 'send a time such as 2026-11-05T12:00:00Z.')
    }
    const milliseconds = Date.parse(input.datetime.trim())
    if (!Number.isFinite(milliseconds)) {
      throw analyzeError('"datetime" is not a valid date/time.', 'send an ISO 8601 time such as 2026-11-05T12:00:00Z.')
    }
    const date = new Date(milliseconds)
    const year = date.getUTCFullYear()
    if (year < ANALYZE_MIN_YEAR || year > ANALYZE_MAX_YEAR) {
      throw analyzeError(
        `"datetime" year ${year} is outside ${ANALYZE_MIN_YEAR}..${ANALYZE_MAX_YEAR}.`,
        `choose a time within the years ${ANALYZE_MIN_YEAR}..${ANALYZE_MAX_YEAR}.`,
      )
    }
    // Keep the caller's exact ISO string; Date.parse above established that the
    // panel can turn it into the same instant without the Host rewriting it.
    args.datetime = input.datetime.trim()
  }
  if (input.show_shadows !== undefined && typeof input.show_shadows !== 'boolean') {
    throw analyzeError('"show_shadows" must be true or false.', 'pass true to enable shadows or false to disable them.')
  }
  args.show_shadows = input.show_shadows !== false
  return { args }
}

function formatAnalyzeCoordinate(position) {
  return Array.isArray(position) && position.length === 2 && position.every((value) => Number.isFinite(value))
    ? `[${position[0]}, ${position[1]}]`
    : 'unknown'
}

function formatAnalyzeSquareKilometers(squareKilometers) {
  return Number.isFinite(squareKilometers) ? `${squareKilometers.toFixed(3)} km²` : 'unknown'
}

/** Keep the analysis result inside its UTF-8 budget without splitting characters. */
function truncateAnalyzeText(text, note) {
  if (Buffer.byteLength(text, 'utf8') <= ANALYZE_RENDER_LIMIT) return text
  const budget = Math.max(0, ANALYZE_RENDER_LIMIT - Buffer.byteLength(note, 'utf8'))
  let head = ''
  let used = 0
  for (const character of text) {
    const size = Buffer.byteLength(character, 'utf8')
    if (used + size > budget) break
    head += character
    used += size
  }
  return `${head}${note}`
}

function renderAnalyzeResult(value) {
  if (!isPlainObject(value)) return truncateAnalyzeText(String(value), '\n[analysis result truncated]')
  const operation = typeof value.operation === 'string' ? value.operation : 'unknown'
  const layer = typeof value.layer === 'string' && value.layer !== '' ? ` on layer ${value.layer}` : ''
  const lines = []

  if (operation === 'profile') {
    const details = []
    if (value.from !== undefined && value.to !== undefined) {
      details.push(`from ${formatAnalyzeCoordinate(value.from)} to ${formatAnalyzeCoordinate(value.to)}`)
    }
    if (Number.isFinite(value.length_m)) details.push(formatMeasureDistance(value.length_m))
    if (Number.isInteger(value.samples)) details.push(`${value.samples} samples`)
    lines.push(`Profile${layer}${details.length > 0 ? `: ${details.join(', ')}` : ' completed'}.`)
    const stats = isPlainObject(value.stats) ? value.stats : {}
    const height = []
    if (Number.isFinite(stats.min_height)) height.push(`min ${stats.min_height.toFixed(1)} m`)
    if (Number.isFinite(stats.max_height)) height.push(`max ${stats.max_height.toFixed(1)} m`)
    if (Number.isFinite(stats.relief_m)) height.push(`relief ${stats.relief_m.toFixed(1)} m`)
    if (Number.isFinite(stats.gain_m)) height.push(`gain ${stats.gain_m.toFixed(1)} m`)
    if (Number.isFinite(stats.loss_m)) height.push(`loss ${stats.loss_m.toFixed(1)} m`)
    if (height.length > 0) lines.push(`Elevation: ${height.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the drawn profile.')
  } else if (operation === 'flood') {
    const details = []
    if (isPlainObject(value.region)) {
      const { west, south, east, north } = value.region
      if ([west, south, east, north].every((number) => Number.isFinite(number))) {
        details.push(`region [${west}, ${south}, ${east}, ${north}]`)
      }
    }
    if (Number.isFinite(value.water_height)) details.push(`water ${value.water_height} m`)
    if (Number.isInteger(value.grid)) details.push(`grid ${value.grid}×${value.grid}`)
    lines.push(`Flood${layer}${details.length > 0 ? `: ${details.join(', ')}` : ' completed'}.`)
    const area = []
    if (Number.isFinite(value.area_km2)) area.push(`area ${formatAnalyzeSquareKilometers(value.area_km2)}`)
    if (Number.isFinite(value.inundated_km2)) area.push(`inundated ${formatAnalyzeSquareKilometers(value.inundated_km2)}`)
    if (Number.isFinite(value.inundated_ratio)) area.push(`${(value.inundated_ratio * 100).toFixed(1)}% inundated`)
    if (area.length > 0) lines.push(`Coverage: ${area.join(', ')}.`)
    const depth = []
    if (Number.isFinite(value.depth_max_m)) depth.push(`max ${value.depth_max_m.toFixed(2)} m`)
    if (Number.isFinite(value.depth_mean_m)) depth.push(`mean ${value.depth_mean_m.toFixed(2)} m`)
    if (depth.length > 0) lines.push(`Depth: ${depth.join(', ')}.`)
    const samples = []
    if (Number.isInteger(value.samples_with_data)) samples.push(`${value.samples_with_data} with height data`)
    if (Number.isInteger(value.samples_inundated)) samples.push(`${value.samples_inundated} inundated`)
    if (samples.length > 0) lines.push(`Samples: ${samples.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the shaded flood area.')
  } else if (operation === 'sunlight') {
    const sun = isPlainObject(value.sun) ? value.sun : {}
    const details = [value.datetime ?? 'current time']
    if (Number.isFinite(sun.altitude_deg)) details.push(`altitude ${sun.altitude_deg.toFixed(1)}°`)
    if (Number.isFinite(sun.azimuth_deg)) details.push(`azimuth ${sun.azimuth_deg.toFixed(1)}°`)
    details.push(value.night === true ? 'night' : 'day')
    details.push(value.shadows_enabled === true ? 'shadows on' : 'shadows off')
    lines.push(`Sunlight${layer}: ${details.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the sun position or shadows.')
  } else if (operation === 'clear') {
    const cleared = Array.isArray(value.cleared) ? value.cleared.filter((item) => typeof item === 'string') : []
    lines.push(cleared.length > 0 ? `Cleared the active analysis (${cleared.join(', ')}).` : 'No active analysis was cleared.')
  } else {
    lines.push(`Analysis (${operation}) completed.`)
  }

  let json
  try {
    json = JSON.stringify(value)
  } catch {
    json = null
  }
  const summary = lines.join('\n')
  if (typeof json !== 'string') return truncateAnalyzeText(summary, '\n[analysis result truncated]')
  return truncateAnalyzeText(
    `${summary}\nJSON: ${json}`,
    `\n[analysis JSON truncated at ${ANALYZE_RENDER_LIMIT} UTF-8 bytes]`,
  )
}

export function createAnalyzeTool(bridge) {
  return {
    name: ANALYZE_TOOL_NAME,
    description: ANALYZE_DESCRIPTION,
    parameters: ANALYZE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderAnalyzeResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeAnalyzeRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'analyze', request.args, ANALYZE_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}
