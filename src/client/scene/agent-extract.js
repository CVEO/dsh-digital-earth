/**
 * scene/agent-extract.js — the Agent bridge side of AI instance extraction.
 *
 * The chat tool `earth_extract` gives one extent + optional class names. This
 * module runs the same orthophoto + tiled instance segmentation as the panel
 * workbench, draws the result as ONE agent overlay, and returns a bounded
 * GeoJSON collection the model can relay. No 3D attributes: 2D WGS84 only.
 */
import { DEFAULT_CLASSES, SPORTS_CLASSES, buildClassCatalog, customClass, TAXONOMY_LIMITS } from '../../shared/taxonomy.js'
import { segmentInstances } from './instance-segment.js'
import { removeAgentOverlay } from './agent-overlays.js'

export const AGENT_EXTRACT_CAPTION = 'AI 提取'

/** Remove only the overlay this Agent extraction created (caption-scoped). */
export function clearExtractionOverlay({ state, viewer } = {}) {
  const commands = Array.isArray(state?.drawCommands) ? state.drawCommands : []
  let removed = 0
  for (let index = commands.length - 1; index >= 0; index -= 1) {
    if (commands[index]?.caption !== AGENT_EXTRACT_CAPTION) continue
    if (removeAgentOverlay(state, viewer, 'draw', index)) removed += 1
  }
  return { removed }
}
const AGENT_MAX_FEATURES = 60

/** Resolve Agent-supplied class names/keys against the default catalog. */
export function resolveAgentClasses(rawClasses) {
  const catalog = buildClassCatalog([])
  const requested = Array.isArray(rawClasses) ? rawClasses : []
  const names = requested.filter((value) => typeof value === 'string' && value.trim() !== '').map((value) => value.trim())
  if (names.length === 0) return catalog
  const selected = []
  let nextCustomId = Math.max(...catalog.map(entry => entry.id)) + 1
  for (const name of names) {
    const lower = name.toLowerCase()
    const preset = [...catalog, ...SPORTS_CLASSES].find(entry => entry.name.toLowerCase() === lower || entry.key.toLowerCase() === lower)
    const entry = preset ?? customClass(name)
    if (!entry || selected.some(item => item.key === entry.key)) continue
    selected.push(preset ?? { ...entry, id: nextCustomId++ })
    if (selected.length === TAXONOMY_LIMITS.maxClasses) break
  }
  return selected.length > 0 ? selected : catalog
}

export function compactExtractionCollection(collection, maxFeatures = AGENT_MAX_FEATURES) {
  const features = Array.isArray(collection?.features) ? collection.features : []
  const cap = Math.max(1, Math.min(AGENT_MAX_FEATURES, Math.floor(maxFeatures) || AGENT_MAX_FEATURES))
  return {
    collection: { type: 'FeatureCollection', features: features.slice(0, cap) },
    truncated: features.length > cap,
    count: features.length,
  }
}

/**
 * Run one extraction for the Agent bridge and draw it on the panel.
 *
 * @returns {Promise<{count:number, truncated:boolean, bbox:object|null,
 *   classes:string[], report:object, geojson:object}>}
 */
export async function runAgentExtraction({
  viewer,
  Cesium,
  meta,
  bbox = null,
  classes = null,
  maxFeatures = AGENT_MAX_FEATURES,
  maxCalls = 16,
  sessionId = null,
  multiScale = false,
  namedLabels = false,
  separateClasses = false,
  reuse = true,
  label = AGENT_EXTRACT_CAPTION,
  draw,
  clearAgent,
  clear = false,
  signal,
  onProgress,
  fetchImpl,
} = {}) {
  if (!viewer || !Cesium) throw new Error('extract: the digital earth panel is not ready. next: open the panel and retry.')
  if (clear) {
    const outcome = typeof clearAgent === 'function' ? clearAgent() : { removed: 0 }
    return {
      cleared: true,
      removed: Number(outcome?.removed) || 0,
      count: 0,
      truncated: false,
      bbox: null,
      classes: [],
      report: { cleared: Number(outcome?.removed) || 0 },
      geojson: { type: 'FeatureCollection', features: [] },
    }
  }
  const catalog = resolveAgentClasses(classes)
  const result = await segmentInstances({
    viewer,
    Cesium,
    meta,
    bbox: bbox ?? null,
    classes: catalog,
    multiScale,
    namedLabels,
    separateClasses,
    reuse,
    sessionId,
    resolutionScale: 1.2,
    maxCalls: Math.max(1, Math.min(40, Math.round(Number(maxCalls) || 16))),
    signal,
    onProgress,
    fetchImpl,
  })
  if (result.cancelled) {
    return {
      count: 0,
      truncated: false,
      bbox: bbox ?? null,
      classes: catalog.map((entry) => entry.name),
      report: result.report,
      geojson: { type: 'FeatureCollection', features: [] },
    }
  }
  const { collection, truncated, count } = compactExtractionCollection(result.collection, maxFeatures)
  if (count > 0 && typeof draw === 'function') {
    draw(Cesium, viewer, result.collection, 'violet', AGENT_EXTRACT_CAPTION, 'agent')
  }
  const byClass = {}
  for (const feature of collection.features) {
    const props = feature?.properties ?? {}
    const label = props.class_name ?? props.class ?? props.class_key ?? 'other'
    byClass[label] = (byClass[label] ?? 0) + 1
  }
  return {
    count,
    truncated,
    by_class: byClass,
    bbox: bbox ?? result.report?.source?.bbox ?? null,
    classes: catalog.map((entry) => entry.name),
    report: result.report,
    geojson: collection,
  }
}

export { DEFAULT_CLASSES }
