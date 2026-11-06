/**
 * Static 3D Tiles analysis: walk the tree, fold statistics, build the report.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { dirname } from 'node:path'
import { INSPECT_FETCH_TIMEOUT_MS, MAX_INSPECT_TILESETS } from '../constants.js'
import { INSPECT_FORBIDDEN_MESSAGE, INSPECT_SUPPORTED_EXTENSIONS, InspectError, inspectAllowedLocalPath, inspectBoundingVolume, inspectDeepContents, inspectDocTiles, inspectExternalLoadIssueCode, inspectFetchRemote, inspectIssue, inspectLocalPath, inspectParseJson, inspectReadLocalJson, inspectSourceLabel, normalizeInspectRuntime } from './fetch.js'
import { blockedHost } from '../paths.js'
import { isPlainObject } from '../sanitize.js'
import { scrubToken } from '../session.js'

function inspectRootGeometricError(doc) {
  if (!isPlainObject(doc?.root)) return null
  const error = doc.root.geometricError
  return typeof error === 'number' && Number.isFinite(error) ? error : null
}

export async function analyzeTileset(source, options = {}) {
  // allowedDirs is a Set in the running plugin; an array keeps the analyser
  // usable from tests and from any future caller.
  const allowedDirs = options.allowedDirs instanceof Set || Array.isArray(options.allowedDirs) ? options.allowedDirs : []
  const deep = options.deep === true
  const runtime = normalizeInspectRuntime(options.runtime)
  const deadline = Date.now() + INSPECT_FETCH_TIMEOUT_MS
  let rootLocation
  if (source.kind === 'local') {
    const target = await inspectLocalPath(source.path, allowedDirs)
    rootLocation = { kind: 'local', value: target, dir: dirname(target) }
  } else {
    if (blockedHost(source.url)) throw new InspectError('forbidden', 'the remote tileset URL points at a local or private address. Use a public http(s) URL.')
    rootLocation = { kind: 'remote', value: source.url }
  }
  const state = {
    tiles: 0,
    contents: 0,
    externalFiles: 0,
    maxDepth: 0,
    kinds: { b3dm: 0, glb: 0, pnts: 0, gaussianSplatting: false, spz: false },
    extensionsUsed: new Set(),
    extensionsRequired: new Set(),
    issues: [],
    contentRefs: [],
    rootContents: [],
    externalTilesets: [],
    documents: 0,
    spzCount: 0,
  }
  let rootDoc = null
  let rootBytes = 0
  const queue = [{ location: rootLocation, isRoot: true, label: source.kind === 'local' ? source.path : source.url }]
  const seen = new Set()
  while (queue.length > 0 && state.documents < MAX_INSPECT_TILESETS) {
    const entry = queue.shift()
    if (seen.has(entry.location.value)) continue
    seen.add(entry.location.value)
    let loaded
    try {
      if (entry.location.kind === 'local') {
        // The entry path was already validated; every derived tileset JSON is
        // re-checked against the allowlist and its realpath before it is read.
        const target = entry.isRoot
          ? entry.location.value
          : await inspectAllowedLocalPath(entry.location.value, allowedDirs, { derived: true })
        if (target === null) {
          if (entry.isRoot) throw new InspectError('forbidden', INSPECT_FORBIDDEN_MESSAGE)
          inspectIssue(state.issues, 'warn', 'content_unreachable', 'an external tileset is outside the folders the user opened in the panel; it was not read.')
          continue
        }
        if (!entry.isRoot) entry.location = { ...entry.location, value: target, dir: dirname(target) }
        loaded = await inspectReadLocalJson(target, deadline)
      } else {
        loaded = await inspectFetchRemote(entry.location.value, deadline)
      }
    } catch (error) {
      if (entry.isRoot) throw error
      const code = inspectExternalLoadIssueCode(error, entry.location)
      inspectIssue(state.issues, 'error', code, `could not load an external tileset: ${error instanceof Error ? error.message : String(error)}`, entry.label)
      continue
    }
    let doc
    try {
      doc = inspectParseJson(loaded.text, loaded.label)
    } catch (error) {
      if (entry.isRoot) throw error
      inspectIssue(state.issues, 'error', 'invalid_json', `external tileset is not valid JSON: ${entry.label}`, entry.label)
      continue
    }
    if (entry.isRoot) {
      rootDoc = doc
      rootBytes = loaded.bytes
      inspectRootDocument(doc, entry.label, state)
    }
    state.documents += 1
    if (Array.isArray(doc.extensionsUsed)) {
      for (const extension of doc.extensionsUsed) if (typeof extension === 'string') state.extensionsUsed.add(extension)
    }
    if (Array.isArray(doc.extensionsRequired)) {
      for (const extension of doc.extensionsRequired) if (typeof extension === 'string') state.extensionsRequired.add(extension)
    }
    const base = entry.location.kind === 'local' ? { kind: 'local', dir: entry.location.dir } : { kind: 'remote', url: entry.location.value }
    const before = state.externalTilesets.length
    const walked = inspectDocTiles(doc, entry.label, state, base, entry.isRoot)
    if (walked.docDepth > state.maxDepth) state.maxDepth = walked.docDepth
    for (const external of state.externalTilesets.slice(before)) queue.push({ ...external, isRoot: false })
    state.externalTilesets.length = before
  }
  if (queue.length > 0) {
    inspectIssue(state.issues, 'warn', 'too_large', `inspection stopped after ${MAX_INSPECT_TILESETS} tileset documents; deeper tilesets were not read.`)
  }
  for (const extension of [...state.extensionsRequired].sort()) {
    if (!INSPECT_SUPPORTED_EXTENSIONS.has(extension)) {
      inspectIssue(state.issues, 'warn', 'unsupported_extension', `the tileset requires extension "${extension}", which this inspection does not verify.`)
    }
  }
  const hasSplatExtension = state.extensionsUsed.has('KHR_gaussian_splatting') || state.extensionsRequired.has('KHR_gaussian_splatting')
  state.kinds.spz = state.spzCount > 0
  state.kinds.gaussianSplatting = hasSplatExtension || state.kinds.spz
  if (state.kinds.gaussianSplatting) {
    inspectIssue(
      state.issues,
      'info',
      'gaussian_splatting_ok',
      hasSplatExtension ? 'KHR_gaussian_splatting extension detected; the panel can render these Gaussian splats.' : '.spz content detected (Gaussian splatting).',
    )
  }
  if (deep) await inspectDeepContents(state, source, deadline, allowedDirs)
  // The issue list itself stays at the limit; the truncation count is a
  // separate field so `issues` never grows past MAX_INSPECT_ISSUES.
  const droppedIssues = Number.isInteger(state.issues.dropped) ? state.issues.dropped : 0
  const rootBoundingVolume = inspectBoundingVolume(rootDoc?.root?.boundingVolume)
  const rootGeometricError = inspectRootGeometricError(rootDoc)
  const ok = !state.issues.some((issue) => issue.level === 'error')
  const scenes = isPlainObject(rootDoc) && Array.isArray(rootDoc.scenes) && rootDoc.scenes.length > 0
    ? rootDoc.scenes.filter((scene) => isPlainObject(scene)).map((scene) => ({
      geometricError: Number.isFinite(scene.geometricError) ? scene.geometricError : rootGeometricError,
      tilesetCount: 1,
    }))
    : [{ geometricError: rootGeometricError, tilesetCount: 1 }]
  const report = {
    ok,
    source: { kind: source.kind, label: inspectSourceLabel(source), bytes: rootBytes },
    asset: {
      version: typeof rootDoc?.asset?.version === 'string' ? rootDoc.asset.version : null,
      minVersion: typeof rootDoc?.asset?.minVersion === 'string' ? rootDoc.asset.minVersion : null,
      generator: typeof rootDoc?.asset?.generator === 'string' ? rootDoc.asset.generator : null,
    },
    root: {
      geometricError: rootGeometricError,
      boundingVolume: {
        type: rootBoundingVolume?.type ?? null,
        center: rootBoundingVolume?.center ?? null,
        region: rootBoundingVolume?.region ?? null,
      },
      children: isPlainObject(rootDoc?.root) && Array.isArray(rootDoc.root.children) ? rootDoc.root.children.length : 0,
      depth: state.maxDepth,
    },
    counts: {
      tiles: state.tiles,
      contents: state.contents,
      externalFiles: state.externalFiles,
      extensionsUsed: [...state.extensionsUsed].sort(),
    },
    kinds: state.kinds,
    scenes,
    issues: state.issues,
  }
  if (droppedIssues > 0) report.issuesDropped = droppedIssues
  if (runtime !== null) report.runtime = runtime
  return scrubToken(report)
}

/** Validate the root document: asset version, root tile and its refined values. */
function inspectRootDocument(doc, label, state) {
  const version = typeof doc.asset?.version === 'string' ? doc.asset.version.trim() : ''
  if (version !== '' && !/^1(\.|$)/.test(version)) {
    inspectIssue(state.issues, 'error', 'asset_version_unsupported', `asset.version "${version}" is not supported; this panel targets 3D Tiles 1.x.`, `${label}:asset.version`)
  }
  const root = isPlainObject(doc.root) ? doc.root : null
  if (root === null && (!Array.isArray(doc.tiles) || doc.tiles.length === 0)) {
    inspectIssue(state.issues, 'error', 'no_root', 'the tileset has neither a root tile nor a tiles array.', label)
    return
  }
  if (root !== null) {
    if (!Object.hasOwn(root, 'geometricError')) {
      inspectIssue(state.issues, 'warn', 'no_geometric_error', 'the root tile has no geometricError, so refinement distances are undefined.', `${label}:root`)
    } else if (typeof root.geometricError !== 'number' || !Number.isFinite(root.geometricError) || root.geometricError < 0) {
      inspectIssue(state.issues, 'error', 'geometric_error_invalid', 'the root tile geometricError must be a finite number >= 0.', `${label}:root`)
    }
    if (inspectBoundingVolume(root.boundingVolume) === null) {
      inspectIssue(state.issues, 'error', 'bounding_volume_invalid', 'the root tile needs a boundingVolume with a box, region or sphere.', `${label}:root.boundingVolume`)
    }
    // Only standard 3D Tiles georeferencing is accepted: a root tile must carry a
    // world placement, otherwise Cesium reads local metres as ECEF and the dataset
    // collapses near the earth's centre. The panel reports this instead of
    // inferring a CRS from vendor sidecar files: a silent rewrite would make the
    // served bytes differ from the bytes on disk.
    const hasTransform = Array.isArray(root.transform) && root.transform.length === 16
    const hasRegion = isPlainObject(root.boundingVolume) && root.boundingVolume.region !== undefined
    if (!hasTransform && !hasRegion) {
      inspectIssue(
        state.issues,
        'error',
        'tileset_not_georeferenced',
        "the root tile has no transform (16 numbers) or boundingVolume.region, so its coordinates are read as ECEF; a dataset exported in local metres renders near the earth's centre. Re-export it with a root transform or region: this panel only accepts standard 3D Tiles 1.x georeferencing and never infers a CRS from sidecar files.",
        `${label}:root`,
      )
    }
  }
}
