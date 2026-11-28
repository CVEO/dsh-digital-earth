/**
 * earth_extract: one-shot 2D instance extraction from the digital earth panel.
 *
 * The Host validates the extent/classes and asks the panel to run the orthophoto
 * instance-segmentation pipeline once. The panel returns a bounded 2D GeoJSON
 * collection and draws the full result as an agent overlay; no 3D attributes,
 * no multi-step planning.
 */
import { DEFAULT_CLASSES, SPORTS_CLASSES } from '../../shared/taxonomy.js'
import { PANEL_CLOSED_MESSAGE, asResultObject, resolveSessionTarget, scrubToken } from '../session.js'
import { isPlainObject } from '../sanitize.js'

const EXTRACT_TOOL_NAME = 'earth_extract'
const EXTRACT_TIMEOUT_MS = 300000
const MAX_FEATURES = 60
const MAX_CLASSES = 12

const EXTRACT_ACTIONS = ['extract', 'classes', 'clear']

const EXTRACT_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: EXTRACT_ACTIONS,
      description: 'extract (default): segment ground features inside the extent. classes: list the default class catalog. clear: remove the extraction overlay drawn by this tool.',
    },
    bbox: {
      type: 'object',
      description: 'Extent as {west,south,east,north} WGS84 degrees (west<east, south<north). Omit for the current view.',
      properties: {
        west: { type: 'number' },
        south: { type: 'number' },
        east: { type: 'number' },
        north: { type: 'number' },
      },
      required: ['west', 'south', 'east', 'north'],
      additionalProperties: false,
    },
    classes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional class names/keys from earth_extract classes. A name not in the default catalog becomes a custom class (definition: 用户自定义：<name>). Omit for all default classes.',
    },
    max_features: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_FEATURES,
      description: 'Maximum features returned in the GeoJSON payload (the panel still draws all of them). Default 60.',
    },
    separate_classes: { type: 'boolean', description: 'Locate each class in its own model call instead of a joint search.' },
    reuse: { type: 'boolean', description: 'Reuse identical completed requests from this session for 15 minutes. Default true.' },
    named_labels: { type: 'boolean', description: 'Use class names as the multi-class detector labels.' },
    multi_scale: { type: 'boolean', description: 'Search overlapping detail windows for smaller instances within the same request budget.' },
    max_calls: {
      type: 'integer',
      minimum: 1,
      maximum: 40,
      description: 'Maximum model calls (tiles) for this run; lower is faster. Default 16.',
    },
  },
  additionalProperties: false,
}

const EXTRACT_DESCRIPTION = [
  'Extract ground features (buildings, water, vegetation, roads, vehicles, sports fields, farmland, other) from the digital earth panel as 2D WGS84 vectors.',
  'The panel renders a nadir orthophoto view, segments instances with the configured vision model, draws one overlay, and returns a GeoJSON FeatureCollection.',
  'Pass bbox to limit the extent; omit it to use the current view. classes accepts names from action=classes; omit for all default classes.',
  'Use action=clear to remove the extraction overlay. Output is 2D only: no heights, no 3D/LoD/CZML. Review counts in the result; the panel is the source of truth.',
].join('\n')

const extractError = (message) => new Error(`earth_extract: ${message}`)

function normalizeBbox(raw) {
  if (raw === undefined || raw === null) return null
  if (!isPlainObject(raw)) throw extractError('bbox must be an object {west,south,east,north}.')
  const values = [raw.west, raw.south, raw.east, raw.north]
  if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    throw extractError('bbox values must be finite numbers in degrees.')
  }
  const [west, south, east, north] = values
  if (west < -180 || east > 180 || south < -90 || north > 90) throw extractError('bbox is outside WGS84 bounds.')
  if (!(west < east) || !(south < north)) throw extractError('bbox must satisfy west<east and south<north (cross-180 extents are not supported).')
  return { west, south, east, north }
}

function normalizeClasses(raw) {
  if (raw === undefined || raw === null) return null
  if (!Array.isArray(raw)) throw extractError('classes must be an array of class names.')
  const values = raw
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim().slice(0, 24))
  if (values.length > MAX_CLASSES) throw extractError(`at most ${MAX_CLASSES} classes may be requested.`)
  return values.length > 0 ? [...new Set(values)] : null
}

function normalizeFeatures(raw) {
  const value = Number.isFinite(raw) ? Math.round(raw) : MAX_FEATURES
  return Math.max(1, Math.min(MAX_FEATURES, value))
}

function renderExtractResult(_args, value) {
  if (value?.cleared === true) return `Cleared ${Number(value.removed) || 0} AI extraction overlay(s) from the digital earth.`
  if (Array.isArray(value?.classes) && !value?.geojson) {
    return `Default classes: ${value.classes.map((entry) => `${entry.name} (${entry.key})`).join(', ')}.`
  }
  const count = Number.isInteger(value?.count) ? value.count : 0
  const report = isPlainObject(value?.report) ? value.report : {}
  const lines = [`Extracted ${count} 2D instance${count === 1 ? '' : 's'}${value?.truncated ? ' (GeoJSON truncated to the first 60)' : ''}.`]
  const byClass = isPlainObject(value?.by_class) ? value.by_class : null
  if (byClass) lines.push(`By class: ${Object.entries(byClass).map(([key, n]) => `${key}=${n}`).join(', ')}.`)
  const failedWindows = Array.isArray(report.failedWindows) ? report.failedWindows.length : Number(report.failedWindows) || 0
  if (Number.isInteger(report.windows)) lines.push(`Windows: ${report.windows}, failed: ${failedWindows}${report.complete === false ? ' (partial)' : ''}.`)
  if (Array.isArray(value?.classes) && value.classes.length > 0) lines.push(`Classes: ${value.classes.join(', ')}.`)
  lines.push('The full extraction is drawn in the panel as one overlay; the result includes a 2D WGS84 GeoJSON FeatureCollection. Call earth_capture if the user should see it.')
  return lines.join(' ')
}

export function createExtractTool(bridge) {
  return {
    name: EXTRACT_TOOL_NAME,
    description: EXTRACT_DESCRIPTION,
    parameters: EXTRACT_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderExtractResult(_args, value) }],
    },
    async execute(args, exec = {}) {
      const action = typeof args?.action === 'string' ? args.action : 'extract'
      if (!EXTRACT_ACTIONS.includes(action)) throw extractError(`unknown action ${JSON.stringify(action)}; use ${EXTRACT_ACTIONS.join(', ')}.`)
      if (action === 'classes') {
        return {
          profiles: { sports: SPORTS_CLASSES.map(({ key, name, definition }) => ({ key, name, definition })) },
          classes: DEFAULT_CLASSES.map((entry) => ({ id: entry.id, key: entry.key, name: entry.name, definition: entry.definition })),
        }
      }
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const request = {
        clear: action === 'clear',
        max_features: normalizeFeatures(args?.max_features),
        max_calls: Math.max(1, Math.min(40, Math.round(Number(args?.max_calls) || 16))),
      }
      if (action === 'extract') {
        if (args?.separate_classes === true) request.separate_classes = true
        if (args?.reuse === false) request.reuse = false
        if (args?.named_labels === true) request.named_labels = true
        if (args?.multi_scale === true) request.multi_scale = true
        const bbox = normalizeBbox(args?.bbox)
        if (bbox) request.bbox = bbox
        const classes = normalizeClasses(args?.classes)
        if (classes) request.classes = classes
      }
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'extract', request, EXTRACT_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = 'Panel fell back to the latest connected tab.'
      return value
    },
  }
}
