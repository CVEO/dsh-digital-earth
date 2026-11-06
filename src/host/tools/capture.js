/**
 * earth_capture: schema, validation, disk-verified result and the tool factory.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { CAPTURES_DIR, CAPTURE_TIMEOUT_MS } from '../constants.js'
import { PANEL_CLOSED_MESSAGE, SESSION_FALLBACK_NOTE, asResultObject, resolveSessionTarget, scrubToken } from '../session.js'
import { isWithinDirectory } from '../paths.js'

const CAPTURE_TOOL_NAME = 'earth_capture'

const CAPTURE_NOTE = 'Image file written. If this model can read images, call read_image with this path; otherwise rely on earth_scene status JSON. To show the image to the user, call present with the path; never embed a local path in Markdown image syntax.'

const CAPTURE_ARG_NAMES = new Set(['width', 'format', 'include_hud', 'label'])
const CAPTURE_FORMATS = new Set(['jpeg', 'png'])
const DEFAULT_CAPTURE_WIDTH = 1280
const MIN_CAPTURE_WIDTH = 480
const MAX_CAPTURE_WIDTH = 2560

const CAPTURE_PARAMETERS = {
  type: 'object',
  properties: {
    width: {
      type: 'integer',
      minimum: MIN_CAPTURE_WIDTH,
      maximum: MAX_CAPTURE_WIDTH,
      description: 'Target image width in output image pixels (capped by the panel canvas size); height follows the panel aspect ratio. Default 1280.',
    },
    format: {
      type: 'string',
      enum: ['jpeg', 'png'],
      description: 'Image encoding. Default jpeg.',
    },
    include_hud: {
      type: 'boolean',
      description: 'true burns the coordinate HUD and team credit into the image (the DOM toolbar is never included); omit to use the panel screenshot setting (usually hidden).',
    },
    label: {
      type: 'string',
      description: 'Short scene label for this capture, used in the file name.',
    },
  },
  additionalProperties: false,
}

const CAPTURE_DESCRIPTION = [
  'Save the current digital earth view as an image file on the host and return its absolute path.',
  '',
  'By default the image follows the panel screenshot setting (usually a clean view); set include_hud true to burn in the coordinate HUD and team credit. The DOM toolbar is never part of the image.',
  'If this model can read images, call read_image on the returned path; otherwise describe the scene only from earth_scene status JSON.',
  'To show the image to the user, call present with its path. Never embed a local path in Markdown image syntax: the chat cannot load it and renders a broken preview.',
].join('\n')

const captureError = (message) => new Error(`earth_capture: ${message}`)

/** Validate capture options and build the capture command, passed through as-is. */
function normalizeCaptureRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (typeof input !== 'object' || Array.isArray(input)) throw captureError('the arguments must be an object.')
  for (const key of Object.keys(input)) {
    if (CAPTURE_ARG_NAMES.has(key)) continue
    throw captureError(`it does not accept "${key}"; accepted arguments: width, format, include_hud, label.`)
  }
  const width = input.width === undefined ? DEFAULT_CAPTURE_WIDTH : input.width
  if (!Number.isInteger(width) || width < MIN_CAPTURE_WIDTH || width > MAX_CAPTURE_WIDTH) {
    throw captureError(`"width" must be an integer between ${MIN_CAPTURE_WIDTH} and ${MAX_CAPTURE_WIDTH} pixels.`)
  }
  const format = input.format === undefined ? 'jpeg' : input.format
  if (!CAPTURE_FORMATS.has(format)) throw captureError('"format" must be "jpeg" or "png".')
  // An explicit boolean wins; otherwise the key is left out so the page can
  // fall back to its own screenshot setting (usually HUD hidden).
  const includeHud = input.include_hud
  if (includeHud !== undefined && typeof includeHud !== 'boolean') throw captureError('"include_hud" must be true or false.')
  const label = input.label === undefined ? '' : input.label
  if (typeof label !== 'string') throw captureError('"label" must be a string.')
  const args = { width, format }
  if (includeHud !== undefined) args.include_hud = includeHud
  const trimmedLabel = label.trim().slice(0, 80)
  if (trimmedLabel !== '') args.label = trimmedLabel
  return { args, includeHud }
}

/** Turn a capture acknowledgement into the tool result, verified against the disk. */
async function captureResultValue(ack, request) {
  const result = asResultObject(ack)
  const reported = typeof result.path === 'string' ? result.path.trim() : ''
  if (reported === '') {
    throw captureError('the panel did not report a written image file; the capture failed. Retry, and if it keeps failing check the browser console for canvas or WebGL errors.')
  }
  const target = resolve(reported)
  if (!isWithinDirectory(target, CAPTURES_DIR)) {
    throw captureError('the panel reported an image path outside the host capture folder; no file was returned.')
  }
  let stat
  try {
    stat = await fs.stat(target)
  } catch {
    throw captureError('the captured image file is missing on disk; retry the capture.')
  }
  if (!stat.isFile() || stat.size === 0) throw captureError('the captured image file is empty; retry the capture.')
  // No file url in the tool result: it would carry the per-process token and
  // the model only needs the absolute path to read the image back.
  // The panel always reports `hud_hidden`; an older panel's `hud` flag is gone.
  const value = {
    path: target,
    bytes: stat.size,
    hud_hidden: typeof result.hud_hidden === 'boolean' ? result.hud_hidden : request.includeHud !== true,
    note: CAPTURE_NOTE,
  }
  if (Number.isInteger(result.width) && result.width > 0) value.width = result.width
  if (Number.isInteger(result.height) && result.height > 0) value.height = result.height
  // The page reports the camera as `view`; expose it as `camera` so the model
  // gets place context next to the image.
  const view = result.view !== null && typeof result.view === 'object' && !Array.isArray(result.view) ? result.view : null
  if (view !== null) value.camera = view
  if (Number.isInteger(result.layers_visible) && result.layers_visible >= 0) value.layers_visible = result.layers_visible
  return value
}

function renderCaptureResult(value) {
  const lines = [`Captured image: ${value.path}`]
  const dimensions = Number.isInteger(value.width) && Number.isInteger(value.height) ? `${value.width}x${value.height} px, ` : ''
  const hud = value.hud_hidden === true
    ? '; HUD and toolbars hidden'
    : value.hud_hidden === false
      ? '; HUD visible in the image'
      : ''
  lines.push(`${dimensions}${value.bytes} bytes${hud}.`)
  const context = []
  const camera = value.camera !== null && typeof value.camera === 'object' && !Array.isArray(value.camera) ? value.camera : null
  if (camera !== null) {
    if (Number.isFinite(camera.lon)) context.push(`lon=${camera.lon}`)
    if (Number.isFinite(camera.lat)) context.push(`lat=${camera.lat}`)
    if (Number.isFinite(camera.height)) context.push(`height=${camera.height}m`)
  }
  if (Number.isInteger(value.layers_visible)) context.push(`layers_visible=${value.layers_visible}`)
  if (context.length > 0) lines.push(`Camera and scene context: ${context.join(', ')}.`)
  if (typeof value.note === 'string') lines.push(value.note)
  // C1: every successful tool result should end with one actionable next step so
  // a model plans the follow-up instead of stopping after a bare file path.
  lines.push('Next: read the image with read_image when the model supports vision; otherwise use earth_scene action=status for the numbers.')
  return lines.join('\n')
}

export function createCaptureTool(bridge) {
  return {
    name: CAPTURE_TOOL_NAME,
    description: CAPTURE_DESCRIPTION,
    parameters: CAPTURE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderCaptureResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeCaptureRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const ack = await bridge.run(target.sessionId, 'capture', request.args, CAPTURE_TIMEOUT_MS, exec.signal)
      const value = scrubToken(await captureResultValue(ack, request))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}
