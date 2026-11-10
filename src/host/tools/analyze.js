/**
 * earth_analyze: action schema, argument enforcement, renderer and factory.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { ANALYZE_TIMEOUT_MS } from '../constants.js'
import { PANEL_CLOSED_MESSAGE, SESSION_FALLBACK_NOTE, asResultObject, resolveSessionTarget, scrubToken } from '../session.js'
import { formatMeasureDistance } from './measure.js'
import { renderAnalyzeResult } from './analyze-render.js'
import { isPlainObject } from '../sanitize.js'

const ANALYZE_TOOL_NAME = 'earth_analyze'

// Model-facing analysis text plus its JSON fallback; never dump a full flood
// sampling grid or every profile point past this budget.

// ---------------------------------------------------------------------------
// earth_analyze: one active analysis at a time (profile / flood / sunlight /
// clip / skyline), plus clear. The Host owns strict model-input validation and
// the compact text; the panel owns sampling, Cesium entities and the card.
// ---------------------------------------------------------------------------

export const ANALYZE_ACTIONS = ['profile', 'flood', 'sunlight', 'clip', 'skyline', 'clear']
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
  'height',
  'keep',
  'source',
])
const ANALYZE_REGION_KEYS = ['west', 'south', 'east', 'north']
// Exactly one height source per run. profile/skyline: tiles or terrain.
// flood: terrain (strict ground) or surface (explicit approximation, roofs included).
const ANALYZE_SOURCES = {
  profile: ['tiles', 'terrain'],
  skyline: ['tiles', 'terrain'],
  flood: ['terrain', 'surface'],
}
const ANALYZE_MIN_SAMPLES = 8
const ANALYZE_MAX_SAMPLES = 64
const ANALYZE_DEFAULT_SAMPLES = 32
const ANALYZE_MIN_GRID = 4
const ANALYZE_MAX_GRID = 24
const ANALYZE_DEFAULT_GRID = 12
const ANALYZE_MIN_WATER_HEIGHT = -1000
const ANALYZE_MAX_WATER_HEIGHT = 9000
const ANALYZE_MAX_REGION_SPAN = 10
const ANALYZE_CLIP_KEEP = ['below', 'above']
const ANALYZE_MIN_YEAR = 1900
const ANALYZE_MAX_YEAR = 2200

const ANALYZE_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ANALYZE_ACTIONS,
      description: 'profile: elevation along the from→to line; flood: water height over a region; sunlight: sun position and shadows at a time; clip: cut the 3D Tiles with a horizontal plane at a height; skyline: elevation-angle profile from an observer along a direction; clear: remove the active analysis.',
    },
    layer: {
      type: 'string',
      description: 'Layer name or id from earth_scene status. Omit it to use the topmost visible 3D Tiles layer.',
    },
    from: {
      type: 'array',
      items: { type: 'number' },
      description: 'profile/skyline start (observer for skyline) as [lon, lat] WGS84 degrees (-180..180, -90..90), without a height. Required for profile and skyline.',
    },
    to: {
      type: 'array',
      items: { type: 'number' },
      description: 'profile end / skyline direction target as [lon, lat] WGS84 degrees (-180..180, -90..90), without a height. Required for profile and skyline.',
    },
    samples: {
      type: 'integer',
      minimum: ANALYZE_MIN_SAMPLES,
      maximum: ANALYZE_MAX_SAMPLES,
      description: `profile/skyline sample count, ${ANALYZE_MIN_SAMPLES}..${ANALYZE_MAX_SAMPLES}; default ${ANALYZE_DEFAULT_SAMPLES}.`,
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
    height: {
      type: 'number',
      minimum: ANALYZE_MIN_WATER_HEIGHT,
      maximum: ANALYZE_MAX_WATER_HEIGHT,
      description: `clip plane height in meters along the local vertical, ${ANALYZE_MIN_WATER_HEIGHT}..${ANALYZE_MAX_WATER_HEIGHT}; required for clip.`,
    },
    keep: {
      type: 'string',
      enum: ANALYZE_CLIP_KEEP,
      description: 'clip: which side to keep. below (default) cuts off everything above the plane; above cuts off everything below it.',
    },
    source: {
      type: 'string',
      enum: ['tiles', 'terrain', 'surface'],
      description: 'Which single height source the run uses. profile/skyline: "tiles" (visible 3D Tiles surface; mesh only — 3DGS has no sampleable surface) or "terrain" (terrain provider); default "tiles". flood: "terrain" (strict ground; default) or "surface" (explicit approximation on 3D Tiles surface, roofs and vegetation included). Never mixed within one run.',
    },
  },
  required: ['action'],
  additionalProperties: false,
}

const ANALYZE_DESCRIPTION = [
  'Analyze the digital earth panel: profile elevation along a line, flood a region at a water height, check sunlight and shadows, clip the 3D Tiles with a horizontal plane, build a skyline elevation-angle profile from an observer, or clear the active analysis.',
  'One analysis at a time: profile, flood, sunlight, clip and skyline replace the previous active analysis; clear removes it and reports what was cleared.',
  'Height source is explicit and single per run: profile/skyline take source "tiles" (3D Tiles surface; mesh only, 3DGS has no sampleable surface) or "terrain"; flood takes "terrain" (default, strict ground) or "surface" (explicit approximate flood on the 3D surface). Never mixes 3D Tiles and terrain heights in one result. clip works on mesh 3D Tiles only; sunlight is independent of height sources and shadows apply to mesh/terrain, not 3DGS splats.',
  'Take coordinates from the user, from earth_scene status/pick, or from loaded data; never guess. The layer is optional; "tiles"/"surface" runs pick the topmost visible mesh layer unless a layer is given.',
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

/** Validate the optional single height source for a height-based action. */
function normalizeAnalyzeSource(input, action) {
  if (input.source === undefined) return undefined
  const allowed = ANALYZE_SOURCES[action]
  if (typeof input.source !== 'string' || !allowed.includes(input.source)) {
    throw analyzeError(
      `"source" must be ${allowed.map((item) => `"${item}"`).join(' or ')} for ${action}.`,
      'profile/skyline default to "tiles"; flood defaults to "terrain".',
    )
  }
  return input.source
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
      next = 'use action "profile" or "skyline" for these arguments.'
    } else if (key === 'source') {
      next = 'use action "profile", "skyline" or "flood" for "source".'
    } else if (key === 'height' || key === 'keep') {
      next = 'use action "clip" for these arguments.'
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
      'choose profile, flood, sunlight, clip, skyline or clear.',
    )
  }
  if (action === 'clear') {
    rejectAnalyzeKeys(input, 'clear', new Set())
    return { args: { action } }
  }

  const args = { action }
  if (input.layer !== undefined) args.layer = normalizeAnalyzeLayer(input.layer)

  if (action === 'profile') {
    rejectAnalyzeKeys(input, 'profile', new Set(['layer', 'from', 'to', 'samples', 'source']))
    const profileSource = normalizeAnalyzeSource(input, 'profile')
    if (profileSource !== undefined) args.source = profileSource
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

  if (action === 'skyline') {
    rejectAnalyzeKeys(input, 'skyline', new Set(['layer', 'from', 'to', 'samples', 'source']))
    const skylineSource = normalizeAnalyzeSource(input, 'skyline')
    if (skylineSource !== undefined) args.source = skylineSource
    if (!Object.hasOwn(input, 'from')) {
      throw analyzeError('skyline needs "from" as the observer [lon, lat].', 'send the observer position and a direction target.')
    }
    if (!Object.hasOwn(input, 'to')) {
      throw analyzeError('skyline needs "to" as the direction target [lon, lat].', 'send the observer position and a direction target.')
    }
    args.from = normalizeAnalyzeCoordinate(input.from, 'from')
    args.to = normalizeAnalyzeCoordinate(input.to, 'to')
    if (args.from[0] === args.to[0] && args.from[1] === args.to[1]) {
      throw analyzeError(
        'skyline "from" and "to" are the same point.',
        'choose a direction target away from the observer.',
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
    rejectAnalyzeKeys(input, 'flood', new Set(['layer', 'region', 'water_height', 'grid', 'source']))
    const floodSource = normalizeAnalyzeSource(input, 'flood')
    if (floodSource !== undefined) args.source = floodSource
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

  if (action === 'clip') {
    rejectAnalyzeKeys(input, 'clip', new Set(['layer', 'height', 'keep']))
    if (!Object.hasOwn(input, 'height')) {
      throw analyzeError('clip needs "height" in meters.', 'send the clip plane height along the local vertical.')
    }
    args.height = normalizeAnalyzeNumber(
      input.height,
      'height',
      ANALYZE_MIN_WATER_HEIGHT,
      ANALYZE_MAX_WATER_HEIGHT,
    )
    if (input.keep !== undefined && !ANALYZE_CLIP_KEEP.includes(input.keep)) {
      throw analyzeError(
        '"keep" must be "below" or "above".',
        'pass below to cut off everything above the plane, or above to cut off everything below it.',
      )
    }
    args.keep = input.keep ?? 'below'
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
