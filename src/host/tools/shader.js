/**
 * earth_shader: whitelisted presets, argument enforcement, renderer and factory.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { PANEL_CLOSED_MESSAGE, SESSION_FALLBACK_NOTE, asResultObject, resolveSessionTarget, scrubToken } from '../session.js'
import { SHADER_TIMEOUT_MS } from '../constants.js'
import { isPlainObject } from '../sanitize.js'

const SHADER_TOOL_NAME = 'earth_shader'

// ---------------------------------------------------------------------------
// earth_shader: four fixed look presets applied by the panel through
// Cesium.CustomShader. The Host never accepts GLSL, only a whitelisted preset
// and its bounded parameters; the panel owns shader compilation and cleanup.
// ---------------------------------------------------------------------------

export const SHADER_ACTIONS = ['apply', 'reset', 'list']
export const SHADER_PRESETS = ['height-false-color', 'contour', 'scan', 'water', 'water-depth']
const SHADER_PARAMETER_NAMES = new Set([
  'action',
  'layer',
  'preset',
  'min_height',
  'max_height',
  'interval',
  'speed',
  'amplitude',
  'opacity',
  'water_height',
  'depth_max',
])
const SHADER_PRESET_PARAMETERS = {
  'height-false-color': new Set(['min_height', 'max_height']),
  contour: new Set(['interval']),
  scan: new Set(['speed']),
  water: new Set(['speed', 'amplitude', 'opacity']),
  'water-depth': new Set(['water_height', 'depth_max']),
}
const SHADER_MIN_HEIGHT = -1000
const SHADER_MAX_HEIGHT = 9000
const SHADER_MIN_INTERVAL = 1
const SHADER_MAX_INTERVAL = 500
const SHADER_DEFAULT_INTERVAL = 20
const SHADER_MIN_SPEED = 0.1
const SHADER_MAX_SPEED = 10
const SHADER_DEFAULT_SPEED = 1
const SHADER_MIN_AMPLITUDE = 0.1
const SHADER_MAX_AMPLITUDE = 5
const SHADER_DEFAULT_AMPLITUDE = 1
const SHADER_MIN_OPACITY = 0.05
const SHADER_MAX_OPACITY = 1
const SHADER_DEFAULT_OPACITY = 0.75
const SHADER_MIN_DEPTH_MAX = 0.5
const SHADER_MAX_DEPTH_MAX = 500
const SHADER_DEFAULT_DEPTH_MAX = 50
const SHADER_DEFAULT_WATER_HEIGHT = 0

const SHADER_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: SHADER_ACTIONS,
      description: 'apply: add or replace one whitelisted shader preset on a layer; reset: clear the shader from one layer or all layers; list: report active shaders and available presets.',
    },
    layer: {
      type: 'string',
      description: 'apply/reset: layer name or id from earth_scene status. apply defaults to the topmost visible 3D Tiles layer; omit layer on reset to clear every shader.',
    },
    preset: {
      type: 'string',
      enum: SHADER_PRESETS,
      description: 'apply: one whitelisted look preset. height-false-color: elevation color ramp; contour: height isolines; scan: moving height band; water: translucent animated water surface.',
    },
    min_height: {
      type: 'number',
      minimum: SHADER_MIN_HEIGHT,
      maximum: SHADER_MAX_HEIGHT,
      description: 'height-false-color: optional lower elevation in meters. When both min_height and max_height are given, min_height must be lower.',
    },
    max_height: {
      type: 'number',
      minimum: SHADER_MIN_HEIGHT,
      maximum: SHADER_MAX_HEIGHT,
      description: 'height-false-color: optional upper elevation in meters. When both min_height and max_height are given, max_height must be higher.',
    },
    interval: {
      type: 'number',
      minimum: SHADER_MIN_INTERVAL,
      maximum: SHADER_MAX_INTERVAL,
      description: `contour: spacing between isolines in meters, ${SHADER_MIN_INTERVAL}..${SHADER_MAX_INTERVAL}; default ${SHADER_DEFAULT_INTERVAL}.`,
    },
    speed: {
      type: 'number',
      minimum: SHADER_MIN_SPEED,
      maximum: SHADER_MAX_SPEED,
      description: `scan/water: animation speed, ${SHADER_MIN_SPEED}..${SHADER_MAX_SPEED}; default ${SHADER_DEFAULT_SPEED}.`,
    },
    amplitude: {
      type: 'number',
      minimum: SHADER_MIN_AMPLITUDE,
      maximum: SHADER_MAX_AMPLITUDE,
      description: `water: wave amplitude, ${SHADER_MIN_AMPLITUDE}..${SHADER_MAX_AMPLITUDE}; default ${SHADER_DEFAULT_AMPLITUDE}.`,
    },
    opacity: {
      type: 'number',
      minimum: SHADER_MIN_OPACITY,
      maximum: SHADER_MAX_OPACITY,
      description: `water: surface opacity, ${SHADER_MIN_OPACITY}..${SHADER_MAX_OPACITY}; default ${SHADER_DEFAULT_OPACITY}.`,
    },
    water_height: {
      type: 'number',
      minimum: SHADER_MIN_HEIGHT,
      maximum: SHADER_MAX_HEIGHT,
      description: `water-depth: water plane height in meters, ${SHADER_MIN_HEIGHT}..${SHADER_MAX_HEIGHT}; default ${SHADER_DEFAULT_WATER_HEIGHT}.`,
    },
    depth_max: {
      type: 'number',
      minimum: SHADER_MIN_DEPTH_MAX,
      maximum: SHADER_MAX_DEPTH_MAX,
      description: `water-depth: depth in meters mapped to the deepest colour, ${SHADER_MIN_DEPTH_MAX}..${SHADER_MAX_DEPTH_MAX}; default ${SHADER_DEFAULT_DEPTH_MAX}.`,
    },
  },
  required: ['action'],
  additionalProperties: false,
}

const SHADER_DESCRIPTION = [
  'Apply one of five whitelisted look presets to a loaded 3D Tiles layer: height-false-color (elevation color ramp), contour (height isolines), scan (moving height band), water (translucent animated water surface) and water-depth (fixed depth ramp below a chosen water plane).',
  'apply adds or replaces the single shader on the chosen layer; different layers can show different presets, but applying again to the same layer replaces its shader. reset clears one layer or every active shader; list reports active shaders and presets.',
  'No custom GLSL is accepted; only these presets exist, so the model cannot inject shader source. Load 3D Tiles first: with no loaded 3D Tiles layer, or on 3DGS splats and layers without Cesium.CustomShader support, apply returns an error instead of a partial shader.',
  'Parameters use meters and seconds: height-false-color takes optional min_height/max_height, contour interval (default 20), scan speed (default 1), water speed/amplitude/opacity (defaults 1/1/0.75), water-depth water_height/depth_max (defaults 0/50).',
  'Returns compact text plus JSON with operation, preset, layer, active and presets; call earth_capture if the user should see the shaded view.',
].join('\n')

// ---------------------------------------------------------------------------
// earth_shader: model-facing input normalization
// ---------------------------------------------------------------------------

const shaderError = (message, next = 'check the argument against the earth_shader schema and retry.') =>
  new Error(`earth_shader: ${message} next: ${next}`)

function normalizeShaderLayer(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw shaderError(
      '"layer" must be a non-empty layer name or id from earth_scene status.',
      'omit "layer" to use the topmost visible 3D Tiles layer, or pass the exact name from earth_scene list.',
    )
  }
  return value.trim()
}

function normalizeShaderNumber(raw, label, min, max) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw shaderError(
      `"${label}" must be a finite number.`,
      `send "${label}" as a number between ${min} and ${max}.`,
    )
  }
  if (raw < min || raw > max) {
    throw shaderError(
      `"${label}" ${raw} is outside ${min}..${max}.`,
      `send "${label}" within ${min}..${max}.`,
    )
  }
  return raw
}

/** Reject known-but-irrelevant arguments for the chosen shader action/preset. */
function rejectShaderKeys(input, action, allowed) {
  for (const key of Object.keys(input)) {
    if (key === 'action' || allowed.has(key)) continue
    let next
    if (action === 'list') {
      next = 'list accepts only "action"; call apply or reset to change a shader.'
    } else if (action === 'reset') {
      next = 'reset accepts only "action" and an optional "layer"; use action "apply" to add a shader.'
    } else if (key === 'min_height' || key === 'max_height') {
      next = 'use preset "height-false-color" for elevation bounds.'
    } else if (key === 'interval') {
      next = 'use preset "contour" for interval.'
    } else if (key === 'speed') {
      next = 'use preset "scan" or "water" for speed.'
    } else if (key === 'amplitude' || key === 'opacity') {
      next = 'use preset "water" for this parameter.'
    } else if (key === 'water_height' || key === 'depth_max') {
      next = 'use preset "water-depth" for this parameter.'
    } else {
      next = `remove "${key}" or choose the action that accepts it.`
    }
    throw shaderError(`action "${action}" does not accept "${key}".`, next)
  }
}

/** Validate the model-facing earth_shader arguments and build the bridge command. */
export function normalizeShaderRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (!isPlainObject(input)) throw shaderError('the arguments must be an object.')
  for (const key of Object.keys(input)) {
    if (key !== 'action' && !SHADER_PARAMETER_NAMES.has(key)) {
      throw shaderError(
        `it does not accept "${key}"; accepted arguments: ${[...SHADER_PARAMETER_NAMES].join(', ')}.`,
        'remove the unknown argument and retry.',
      )
    }
  }
  const action = input.action
  if (typeof action !== 'string' || !SHADER_ACTIONS.includes(action)) {
    throw shaderError(
      `"action" must be one of ${SHADER_ACTIONS.join(', ')}.`,
      'choose apply, reset or list.',
    )
  }
  if (action === 'list') {
    rejectShaderKeys(input, 'list', new Set())
    return { args: { action } }
  }
  if (action === 'reset') {
    rejectShaderKeys(input, 'reset', new Set(['layer']))
    const args = { action }
    if (input.layer !== undefined) args.layer = normalizeShaderLayer(input.layer)
    return { args }
  }

  const preset = input.preset
  if (typeof preset !== 'string' || !SHADER_PRESETS.includes(preset)) {
    throw shaderError(
      `apply needs "preset"; "preset" must be one of ${SHADER_PRESETS.join(', ')}.`,
      'choose height-false-color, contour, scan, water or water-depth.',
    )
  }
  rejectShaderKeys(input, 'apply', new Set(['layer', 'preset', ...SHADER_PRESET_PARAMETERS[preset]]))
  const args = { action, preset }
  if (input.layer !== undefined) args.layer = normalizeShaderLayer(input.layer)

  if (preset === 'height-false-color') {
    const hasMin = input.min_height !== undefined
    const hasMax = input.max_height !== undefined
    const min = hasMin ? normalizeShaderNumber(input.min_height, 'min_height', SHADER_MIN_HEIGHT, SHADER_MAX_HEIGHT) : undefined
    const max = hasMax ? normalizeShaderNumber(input.max_height, 'max_height', SHADER_MIN_HEIGHT, SHADER_MAX_HEIGHT) : undefined
    if (hasMin && hasMax && min >= max) {
      throw shaderError(
        '"min_height" must be less than "max_height".',
        'send a lower bound below the upper bound, or omit both to use the layer extent.',
      )
    }
    if (hasMin) args.min_height = min
    if (hasMax) args.max_height = max
  } else if (preset === 'contour') {
    args.interval = input.interval === undefined
      ? SHADER_DEFAULT_INTERVAL
      : normalizeShaderNumber(input.interval, 'interval', SHADER_MIN_INTERVAL, SHADER_MAX_INTERVAL)
  } else if (preset === 'scan') {
    args.speed = input.speed === undefined
      ? SHADER_DEFAULT_SPEED
      : normalizeShaderNumber(input.speed, 'speed', SHADER_MIN_SPEED, SHADER_MAX_SPEED)
  } else if (preset === 'water') {
    args.speed = input.speed === undefined
      ? SHADER_DEFAULT_SPEED
      : normalizeShaderNumber(input.speed, 'speed', SHADER_MIN_SPEED, SHADER_MAX_SPEED)
    args.amplitude = input.amplitude === undefined
      ? SHADER_DEFAULT_AMPLITUDE
      : normalizeShaderNumber(input.amplitude, 'amplitude', SHADER_MIN_AMPLITUDE, SHADER_MAX_AMPLITUDE)
    args.opacity = input.opacity === undefined
      ? SHADER_DEFAULT_OPACITY
      : normalizeShaderNumber(input.opacity, 'opacity', SHADER_MIN_OPACITY, SHADER_MAX_OPACITY)
  } else {
    // water-depth: a fixed depth ramp below a chosen water plane (no animation).
    args.water_height = input.water_height === undefined
      ? SHADER_DEFAULT_WATER_HEIGHT
      : normalizeShaderNumber(input.water_height, 'water_height', SHADER_MIN_HEIGHT, SHADER_MAX_HEIGHT)
    args.depth_max = input.depth_max === undefined
      ? SHADER_DEFAULT_DEPTH_MAX
      : normalizeShaderNumber(input.depth_max, 'depth_max', SHADER_MIN_DEPTH_MAX, SHADER_MAX_DEPTH_MAX)
  }
  return { args }
}

function renderShaderResult(value) {
  if (!isPlainObject(value)) return String(value)
  const operation = typeof value.operation === 'string' ? value.operation : 'unknown'
  const preset = typeof value.preset === 'string' && value.preset !== '' ? value.preset : null
  const layer = typeof value.layer === 'string' && value.layer !== '' ? value.layer : null
  const active = []
  for (const entry of Array.isArray(value.active) ? value.active : []) {
    if (!isPlainObject(entry)) continue
    const activeLayer = typeof entry.layer === 'string' && entry.layer !== '' ? entry.layer : 'unknown layer'
    const activePreset = typeof entry.preset === 'string' && entry.preset !== '' ? entry.preset : 'unknown preset'
    active.push(`${activeLayer} (${activePreset})`)
    if (active.length >= 20) {
      active.push('...')
      break
    }
  }
  const presets = (Array.isArray(value.presets) ? value.presets : SHADER_PRESETS)
    .filter((entry) => typeof entry === 'string' && entry !== '')
    .slice(0, SHADER_PRESETS.length)
  const lines = []
  if (operation === 'apply') {
    lines.push(`Applied shader${preset === null ? '' : ` preset ${preset}`}${layer === null ? ' to the default layer' : ` on layer ${layer}`}.`)
  } else if (operation === 'reset') {
    lines.push(layer === null ? 'Reset every active shader.' : `Reset the shader on layer ${layer}.`)
  } else if (operation === 'list') {
    lines.push('Shader list.')
  } else {
    lines.push(`Shader command (${operation}) completed.`)
  }
  lines.push(active.length > 0 ? `Active shaders: ${active.join(', ')}.` : 'Active shaders: none.')
  lines.push(`Available presets: ${presets.length > 0 ? presets.join(', ') : 'unknown'}.`)
  let json
  try {
    json = JSON.stringify(value)
  } catch {
    json = null
  }
  return typeof json === 'string' ? `${lines.join('\n')}\nJSON: ${json}` : lines.join('\n')
}

export function createShaderTool(bridge) {
  return {
    name: SHADER_TOOL_NAME,
    description: SHADER_DESCRIPTION,
    parameters: SHADER_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderShaderResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeShaderRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'shader', request.args, SHADER_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}
