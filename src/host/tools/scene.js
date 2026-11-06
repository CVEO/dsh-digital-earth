/**
 * earth_scene: schema, validation, renderers and the tool factory.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { PANEL_CLOSED_MESSAGE, SESSION_FALLBACK_NOTE, asResultObject, resolveSessionTarget, sceneError, scrubToken } from '../session.js'
import { REPORT_FORMATS, REPORT_TIMEOUT_MS, SCENE_TIMEOUT_MS } from '../constants.js'
import { inspectSceneAction, renderInspectResult } from './scene-inspect.js'
import { isHttpUrl, isPlainObject } from '../sanitize.js'

const SCENE_TOOL_NAME = 'earth_scene'

const SCENE_RENDER_LIMIT = 4096

const SCENE_ACTIONS = {
  status: [],
  list: [],
  load: ['url', 'path'],
  remove: ['layer'],
  visible: ['layer', 'visible'],
  basemap: ['imagery'],
  terrain: ['terrain'],
  fly: ['lon', 'lat', 'height', 'heading', 'pitch', 'duration'],
  reset: [],
  pick: [],
  inspect: ['layer', 'path', 'url', 'deep'],
  report: ['format', 'title', 'include_capture'],
}
const SCENE_ACTION_NAMES = Object.keys(SCENE_ACTIONS)

const SCENE_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: SCENE_ACTION_NAMES,
      description: 'Operation to run.',
    },
    url: {
      type: 'string',
      description: 'load: absolute http(s) URL of a tileset.json; exactly one of url or path. inspect: absolute http(s) tileset.json URL to analyze.',
    },
    path: {
      type: 'string',
      description: 'load: absolute local path; a tileset.json file, or a folder/moved path that resolves to the unique tileset.json below it. A new folder needs one user confirmation in the panel. inspect: the same local path; an already allowed file works while the panel is closed.',
    },
    layer: {
      type: 'string',
      description: 'remove/visible: layer id from status.layers, or its exact name. inspect: analyze this loaded layer after the panel resolves its source; the panel must be open.',
    },
    deep: {
      type: 'boolean',
      description: 'inspect: true also checks content files (local: existence and size of up to 200 contents; remote: reachability of root content). Default false.',
    },
    visible: {
      type: 'boolean',
      description: 'visible: true shows the layer, false hides it.',
    },
    imagery: {
      type: 'string',
      description: 'basemap: imagery source id from status.sources.imagery; pass "none" to turn the basemap off.',
    },
    terrain: {
      type: 'string',
      description: 'terrain: terrain source id from status.sources.terrain; pass "none" to turn terrain off.',
    },
    lon: { type: 'number', description: 'fly: target longitude in degrees.' },
    lat: { type: 'number', description: 'fly: target latitude in degrees.' },
    height: { type: 'number', description: 'fly: camera height in meters; default 1500.' },
    heading: { type: 'number', description: 'fly: heading in degrees clockwise from north; default 0.' },
    pitch: { type: 'number', description: 'fly: pitch in degrees, -90 looks straight down; default -45.' },
    duration: { type: 'number', description: 'fly: flight time in seconds; default 1.2.' },
    format: {
      type: 'string',
      enum: ['html', 'markdown'],
      description: 'report: output format. Default html (self-contained, screenshot embedded).',
    },
    title: {
      type: 'string',
      description: 'report: report title, up to 120 characters. Default "Digital Earth scene report".',
    },
    include_capture: {
      type: 'boolean',
      description: 'report: also capture the current view and embed/link it in the report. Default true.',
    },
  },
  required: ['action'],
  additionalProperties: false,
}

const SCENE_DESCRIPTION = [
  'Read, change or health-check the interactive digital earth panel (CesiumJS): 3D Tiles and Gaussian splat layers, imagery basemap, terrain and camera.',
  '',
  'Actions:',
  '- status: view, layers, imagery, terrain, sources, viewport, snapshot, measureTool and busy state.',
  '- list: layers, sources, active imagery and terrain only (no camera/view).',
  '- load: add a layer from url (online tileset.json) or path (absolute local tileset.json; a folder or moved path resolves to the unique tileset.json below it; new local folders get one panel confirmation). Returns view, layers_count and, when the path was healed, resolved_from.',
  '- remove: remove a layer by layer id or name.',
  '- visible: show or hide one layer.',
  '- basemap: switch the imagery source, or pass "none" to turn the basemap off.',
  '- terrain: switch the terrain source, or pass "none" to turn terrain off.',
  '- fly: move the camera; returns the resulting view.',
  '- reset: return to the global view.',
  '- pick: identify whatever is at the center of the view.',
  '- inspect: static data health check of a tileset without changing the scene. Pass layer (panel resolves its source, merges runtime counters), or path/url; deep checks content files. Returns a compact summary plus a host report path.',
  '- report: write a scene report (HTML self-contained or Markdown) with camera, layers, basemap/terrain, Agent overlays and measurements, the active analysis and shader presets, plus an embedded/linked screenshot; returns the absolute host path. Call present with that path for the user.',
  '',
  'The panel JSON result is the authoritative scene state.',
].join('\n')

function requireSceneString(raw, key, action) {
  const value = raw[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw sceneError(`${action} needs "${key}" as a non-empty string.`)
  }
  return value.trim()
}

function nullableSceneString(raw, key, action) {
  const value = raw[key]
  if (value === null) return null
  if (typeof value === 'string' && value.trim() !== '') {
    const trimmed = value.trim()
    // The DSH schema subset has no `type: ['string', 'null']`, so the schema
    // advertises the string "none" and it is normalised to null here.
    return trimmed.toLowerCase() === 'none' ? null : trimmed
  }
  throw sceneError(`${action} "${key}" must be a source id string, or "none" to turn it off.`)
}

/** Validate the model-facing arguments and build the command the browser executes. */
function normalizeSceneRequest(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw sceneError('the arguments must be an object with an "action" field.')
  }
  const action = raw.action
  if (typeof action !== 'string' || !Object.hasOwn(SCENE_ACTIONS, action)) {
    throw sceneError(`"action" must be one of ${SCENE_ACTION_NAMES.join(', ')}.`)
  }
  const allowed = SCENE_ACTIONS[action]
  for (const key of Object.keys(raw)) {
    if (key === 'action' || allowed.includes(key)) continue
    throw sceneError(`action "${action}" does not accept "${key}"; accepted arguments: action${allowed.length === 0 ? '' : `, ${allowed.join(', ')}`}.`)
  }
  const args = {}
  switch (action) {
    case 'load': {
      const url = typeof raw.url === 'string' ? raw.url.trim() : ''
      const hasPath = typeof raw.path === 'string'
      const path = hasPath ? raw.path : ''
      if (url !== '' && hasPath && path.trim() !== '') throw sceneError('load takes either "url" or "path", not both.')
      if (url !== '') {
        if (!isHttpUrl(url)) throw sceneError(`load "url" must be an absolute http(s) URL, got ${JSON.stringify(url)}.`)
        args.url = url
      } else if (hasPath) {
        // The bridge resolves folders and healed paths and returns a typed
        // [invalid_local_path] error for unusable input.
        args.path = path
      } else {
        throw sceneError('load needs "url" (online tileset.json) or "path" (absolute local path).')
      }
      break
    }
    case 'remove':
      args.layer = requireSceneString(raw, 'layer', action)
      break
    case 'visible':
      if (typeof raw.visible !== 'boolean') throw sceneError('visible needs "visible" as true or false.')
      args.layer = requireSceneString(raw, 'layer', action)
      args.visible = raw.visible
      break
    case 'basemap':
      if (!Object.hasOwn(raw, 'imagery')) {
        throw sceneError('basemap needs "imagery" (a source id from status.sources.imagery, or "none" to turn the basemap off).')
      }
      args.imagery = nullableSceneString(raw, 'imagery', action)
      break
    case 'terrain':
      if (!Object.hasOwn(raw, 'terrain')) {
        throw sceneError('terrain needs "terrain" (a source id from status.sources.terrain, or "none" to turn terrain off).')
      }
      args.terrain = nullableSceneString(raw, 'terrain', action)
      break
    case 'fly': {
      for (const key of ['lon', 'lat']) {
        if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) {
          throw sceneError(`fly needs "${key}" as a finite number of degrees.`)
        }
        args[key] = raw[key]
      }
      if (args.lon < -180 || args.lon > 180) throw sceneError('fly "lon" must be between -180 and 180 degrees.')
      if (args.lat < -90 || args.lat > 90) throw sceneError('fly "lat" must be between -90 and 90 degrees.')
      for (const key of ['height', 'heading', 'pitch', 'duration']) {
        if (raw[key] === undefined) continue
        if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) {
          throw sceneError(`fly "${key}" must be a finite number.`)
        }
        args[key] = raw[key]
      }
      break
    }
    case 'inspect': {
      for (const key of ['url', 'path', 'layer']) {
        if (raw[key] !== undefined && typeof raw[key] !== 'string') throw sceneError(`inspect "${key}" must be a string.`)
      }
      const url = typeof raw.url === 'string' ? raw.url.trim() : ''
      const path = typeof raw.path === 'string' ? raw.path.trim() : ''
      const layer = typeof raw.layer === 'string' ? raw.layer.trim() : ''
      const given = [url !== '', path !== '', layer !== ''].filter((item) => item).length
      if (given === 0) throw sceneError('inspect needs exactly one of "layer" (a layer loaded in the panel), "path" (local tileset.json) or "url" (http(s) tileset.json).')
      if (given > 1) throw sceneError('inspect takes exactly one of "layer", "path" or "url", not several.')
      if (url !== '') {
        if (!isHttpUrl(url)) throw sceneError(`inspect "url" must be an absolute http(s) URL, got ${JSON.stringify(url)}.`)
        args.url = url
      } else if (path !== '') {
        // Folders and healed paths are resolved by the bridge, which returns
        // [invalid_local_path] for unusable input.
        args.path = path
      } else {
        args.layer = layer
      }
      if (raw.deep !== undefined) {
        if (typeof raw.deep !== 'boolean') throw sceneError('inspect "deep" must be true or false.')
        args.deep = raw.deep
      }
      break
    }
    case 'report': {
      const format = raw.format === undefined ? 'html' : raw.format
      if (typeof format !== 'string' || !REPORT_FORMATS.has(format)) {
        throw sceneError('report "format" must be "html" or "markdown".')
      }
      args.format = format
      if (raw.title !== undefined) {
        if (typeof raw.title !== 'string') throw sceneError('report "title" must be a string.')
        const title = raw.title.trim().slice(0, 120)
        if (title !== '') args.title = title
      }
      if (raw.include_capture !== undefined) {
        if (typeof raw.include_capture !== 'boolean') throw sceneError('report "include_capture" must be true or false.')
        args.include_capture = raw.include_capture
      }
      break
    }
    default:
      break
  }
  return { action, args }
}

/** Model-facing summary for `earth_scene action=report`. */
function renderReportResult(value) {
  const path = typeof value.path === 'string' ? value.path : ''
  const format = typeof value.format === 'string' ? value.format : 'html'
  const bytes = Number.isFinite(value.bytes) ? ` (${value.bytes} bytes)` : ''
  const lines = [`Scene report written: ${path}`, `Format: ${format}${bytes}.`]
  if (Array.isArray(value.sections) && value.sections.length > 0) lines.push(`Sections: ${value.sections.join(', ')}.`)
  if (Array.isArray(value.failed) && value.failed.length > 0) lines.push(`Skipped: ${value.failed.join('; ')}.`)
  lines.push('Call present with this path to show the report to the user.')
  return lines.join('\n')
}

function renderSceneResult(value) {  let text
  try {
    text = JSON.stringify(value)
  } catch {
    return '[digital earth result is not JSON serializable]'
  }
  if (typeof text !== 'string') return 'null'
  if (Buffer.byteLength(text, 'utf8') <= SCENE_RENDER_LIMIT) return text
  // Cut on code-point boundaries so a surrogate pair or multi-byte character is
  // never split, and keep the budget in UTF-8 bytes rather than JS characters.
  let head = ''
  let used = 0
  for (const character of text) {
    const size = Buffer.byteLength(character, 'utf8')
    if (used + size > SCENE_RENDER_LIMIT) break
    head += character
    used += size
  }
  return `${head}\n[result truncated at ${SCENE_RENDER_LIMIT} UTF-8 bytes; request a narrower earth_scene action for the rest]`
}

export function createSceneTool(bridge, allowedDirs) {
  return {
    name: SCENE_TOOL_NAME,
    description: SCENE_DESCRIPTION,
    parameters: SCENE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{
        type: 'text',
        text: isPlainObject(value) && value.operation === 'inspect'
          ? renderInspectResult(value)
          : isPlainObject(value) && value.operation === 'report'
            ? renderReportResult(value)
            : renderSceneResult(value),
      }],
    },
    async execute(args, exec = {}) {
      const request = normalizeSceneRequest(args)
      if (request.action === 'inspect') return inspectSceneAction(bridge, allowedDirs, request.args, exec)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const timeout = request.action === 'report' ? REPORT_TIMEOUT_MS : SCENE_TIMEOUT_MS
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, request.action, request.args, timeout, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}
