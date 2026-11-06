/**
 * earth_scene inspect: host-side action plus its model-facing value and renderer.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { INSPECT_BRIDGE_TIMEOUT_MS, MAX_INSPECT_ISSUES } from '../constants.js'
import { InspectError, normalizeInspectRuntime, normalizeInspectSource } from '../inspect/fetch.js'
import { PANEL_CLOSED_MESSAGE, SESSION_FALLBACK_NOTE, asResultObject, resolveSessionTarget, sceneError, scrubToken } from '../session.js'
import { analyzeTileset } from '../inspect/analyze.js'
import { isLocalResolutionAllowed, resolveLocalTileset } from '../local-resolve.js'
import { isPlainObject } from '../sanitize.js'
import { writeInspectReport } from '../inspect/handler.js'

/** Model-facing error text for an inspection failure, always with a next step. */
function inspectToolError(error) {
  if (!(error instanceof InspectError)) return error instanceof Error ? error.message : String(error)
  switch (error.code) {
    case 'forbidden': return error.message
    case 'invalid_source': return `The inspect source is not valid: ${error.message}`
    case 'invalid_json': return 'The tileset JSON is malformed, so it cannot be analyzed. Fix or replace the file, then retry.'
    case 'too_large': return 'The tileset JSON is larger than the 8 MB inspection limit. Inspect a smaller or split tileset.'
    case 'unreachable': return `The tileset could not be fetched: ${error.message} Check the URL and network, then retry.`
    case 'timeout': return 'The data inspection timed out after 8 s. Retry, or inspect a local tileset instead.'
    default: return `The data inspection failed: ${error.message}`
  }
}

/** Compact tool value: the full report stays on the host and in the panel. */
function inspectToolValue(report, layer) {
  const value = {
    operation: 'inspect',
    ok: report.ok,
    source: report.source,
    asset: report.asset,
    root: report.root,
    counts: report.counts,
    kinds: report.kinds,
    scenes: report.scenes,
    issues: report.issues.slice(0, 10),
    issues_total: report.issues.length,
    report_path: report.reportPath,
  }
  if (Number.isInteger(report.issuesDropped) && report.issuesDropped > 0) value.issues_dropped = report.issuesDropped
  if (report.runtime !== undefined) value.runtime = report.runtime
  if (typeof layer === 'string' && layer !== '') value.layer = layer
  return scrubToken(value)
}

export async function inspectSceneAction(bridge, allowedDirs, args, exec) {
  let source
  let runtime = null
  let layer = null
  let fallback = false
  if (typeof args.layer === 'string') {
    const target = resolveSessionTarget(bridge, exec)
    if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
    fallback = target.fallback === true
    const ack = asResultObject(await bridge.run(target.sessionId, 'inspect', { layer: args.layer, deep: args.deep === true }, INSPECT_BRIDGE_TIMEOUT_MS, exec.signal))
    layer = typeof ack.layer === 'string' && ack.layer.trim() !== '' ? ack.layer.trim() : args.layer
    try {
      source = normalizeInspectSource(ack.source)
    } catch {
      throw sceneError('the panel could not resolve this layer to a local path or an http(s) URL. Reload the layer in the panel, then retry.')
    }
    runtime = normalizeInspectRuntime(ack.runtime)
  } else if (typeof args.path === 'string') {
    // Reuse the bridge's local-path resolution and authorization. With no
    // connected panel, an already allowed file can still be inspected.
    const target = resolveSessionTarget(bridge, exec)
    let resolution
    if (target === null) {
      resolution = await resolveLocalTileset(args.path)
      if (!isLocalResolutionAllowed(resolution, allowedDirs)) throw new Error(PANEL_CLOSED_MESSAGE)
    } else {
      fallback = target.fallback === true
      resolution = await bridge.run(target.sessionId, 'inspect', { path: args.path }, INSPECT_BRIDGE_TIMEOUT_MS, exec.signal)
      if (typeof resolution?.path !== 'string' || resolution.path === '') {
        throw sceneError('the panel did not return a resolved local path for this inspection.')
      }
    }
    source = { kind: 'local', path: resolution.path }
  } else {
    source = { kind: 'remote', url: args.url }
  }
  let report
  try {
    report = await analyzeTileset(source, { deep: args.deep === true, runtime, allowedDirs })
    await writeInspectReport(report)
  } catch (error) {
    throw sceneError(inspectToolError(error))
  }
  const value = inspectToolValue(report, layer)
  if (fallback) value.session_fallback = SESSION_FALLBACK_NOTE
  return value
}

export function renderInspectResult(value) {
  const source = isPlainObject(value.source) ? value.source : {}
  const kind = typeof source.kind === 'string' ? source.kind : 'unknown'
  const label = typeof source.label === 'string' ? source.label : ''
  const bytes = Number.isFinite(source.bytes) ? `, ${source.bytes} bytes` : ''
  const lines = [`Data health: ok=${value.ok === true ? 'true' : 'false'} (${kind}${label !== '' ? ` ${label}` : ''}${bytes}).`]
  const asset = isPlainObject(value.asset) ? value.asset : {}
  const assetParts = []
  if (typeof value.layer === 'string') assetParts.push(`layer=${value.layer}`)
  assetParts.push(`version=${asset.version ?? 'unknown'}`)
  if (typeof asset.minVersion === 'string') assetParts.push(`minVersion=${asset.minVersion}`)
  if (typeof asset.generator === 'string') assetParts.push(`generator=${asset.generator}`)
  lines.push(`Asset: ${assetParts.join(', ')}.`)
  const root = isPlainObject(value.root) ? value.root : {}
  const boundingType = isPlainObject(root.boundingVolume) && typeof root.boundingVolume.type === 'string' ? root.boundingVolume.type : 'none'
  lines.push(`Root: geometricError=${root.geometricError ?? 'null'}, boundingVolume=${boundingType}, children=${Number.isInteger(root.children) ? root.children : 0}, depth=${Number.isInteger(root.depth) ? root.depth : 0}.`)
  const counts = isPlainObject(value.counts) ? value.counts : {}
  const extensions = Array.isArray(counts.extensionsUsed) && counts.extensionsUsed.length > 0 ? `, extensions=[${counts.extensionsUsed.join(', ')}]` : ''
  lines.push(`Counts: tiles=${counts.tiles ?? 0}, contents=${counts.contents ?? 0}, externalFiles=${counts.externalFiles ?? 0}${extensions}.`)
  const kinds = isPlainObject(value.kinds) ? value.kinds : {}
  lines.push(`Kinds: b3dm=${kinds.b3dm ?? 0}, glb=${kinds.glb ?? 0}, pnts=${kinds.pnts ?? 0}, gaussianSplatting=${kinds.gaussianSplatting === true ? 'true' : 'false'}, spz=${kinds.spz === true ? 'true' : 'false'}.`)
  const runtime = isPlainObject(value.runtime) ? value.runtime : null
  if (runtime !== null) {
    const parts = ['tiles', 'pending', 'triangles', 'memory'].filter((key) => Number.isFinite(runtime[key])).map((key) => `${key}=${runtime[key]}`)
    if (parts.length > 0) lines.push(`Panel runtime: ${parts.join(', ')}.`)
  }
  const issues = Array.isArray(value.issues) ? value.issues : []
  const total = Number.isInteger(value.issues_total) ? value.issues_total : issues.length
  if (issues.length === 0) {
    lines.push('Issues: none.')
  } else {
    lines.push(`Issues (${issues.length} of ${total}):`)
    for (const issue of issues) {
      if (!isPlainObject(issue)) continue
      const level = typeof issue.level === 'string' ? issue.level : 'info'
      const code = typeof issue.code === 'string' ? issue.code : 'unknown'
      const message = typeof issue.message === 'string' ? issue.message : ''
      const path = typeof issue.path === 'string' && issue.path !== '' ? ` (${issue.path})` : ''
      lines.push(`- [${level}] ${code}: ${message}${path}`)
    }
  }
  if (total > issues.length) lines.push(`... ${total - issues.length} more issues are in the report file.`)
  const dropped = Number.isInteger(value.issues_dropped) ? value.issues_dropped : 0
  if (dropped > 0) lines.push(`... ${dropped} further issues were omitted at the ${MAX_INSPECT_ISSUES}-issue limit.`)
  if (typeof value.report_path === 'string') lines.push(`Report: ${value.report_path}`)
  return lines.join('\n')
}
