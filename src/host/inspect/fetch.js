/**
 * Inspector input normalization, allowlist/realpath containment and bounded reads.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { promises as fs } from 'node:fs'
import { basename, dirname, extname, isAbsolute, resolve, sep } from 'node:path'
import { INSPECT_FETCH_TIMEOUT_MS, MAX_INSPECT_CONTENT_BYTES, MAX_INSPECT_CONTENT_CHECKS, MAX_INSPECT_ISSUES, MAX_INSPECT_JSON, SPZ_MAGIC } from '../constants.js'
import { blockedHost, isUncPath, isWithinDirectory, realPathOr } from '../paths.js'
import { isHttpUrl, isPlainObject } from '../sanitize.js'

// ---------------------------------------------------------------------------
// Data health check (v1.2.0). A static analysis of one tileset.json runs on the
// host, so the panel button and the earth_scene "inspect" action share the same
// report. It is independent from the scene bridge and never changes the scene.
// ---------------------------------------------------------------------------

/** A failure that maps onto the frozen /inspect failure response. */
export class InspectError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'InspectError'
    this.code = code
  }
}

// The frozen contract lists exactly these codes and HTTP statuses.
export const INSPECT_FAILURE_STATUS = {
  forbidden: 403,
  invalid_source: 400,
  invalid_json: 400,
  too_large: 413,
  unreachable: 502,
  timeout: 502,
  internal: 502,
}

export const INSPECT_FORBIDDEN_MESSAGE = 'This local path is outside the folders the user opened in the Digital Earth panel. Ask the user to open that folder in the panel, then retry.'

const INSPECT_CONTENT_KINDS = {
  b3dm: 'b3dm',
  glb: 'glb',
  gltf: 'glb',
  pnts: 'pnts',
  spz: 'spz',
}

export const INSPECT_SUPPORTED_EXTENSIONS = new Set(['KHR_gaussian_splatting'])

export function inspectSourceLabel(source) {
  if (source.kind === 'remote') {
    try {
      return new URL(source.url).hostname
    } catch {
      return 'tileset'
    }
  }
  const parent = basename(dirname(source.path))
  if (parent !== '' && parent !== '.' && parent !== sep) return parent
  return basename(source.path)
}

/** Validate a source spec from the panel route or from the agent tool. */
export function normalizeInspectSource(raw) {
  if (!isPlainObject(raw)) throw new InspectError('invalid_source', 'source must be an object with kind "local" or "remote".')
  if (raw.kind === 'local') {
    if (typeof raw.path !== 'string' || raw.path.trim() === '') {
      throw new InspectError('invalid_source', 'local source.path must be a non-empty string.')
    }
    const path = raw.path.trim()
    if (!isAbsolute(path)) throw new InspectError('invalid_source', `local source.path must be an absolute path, got ${JSON.stringify(path)}.`)
    return { kind: 'local', path: resolve(path) }
  }
  if (raw.kind === 'remote') {
    if (typeof raw.url !== 'string' || raw.url.trim() === '') {
      throw new InspectError('invalid_source', 'remote source.url must be a non-empty string.')
    }
    const url = raw.url.trim()
    if (!isHttpUrl(url)) throw new InspectError('invalid_source', `remote source.url must be an absolute http(s) URL, got ${JSON.stringify(url)}.`)
    return { kind: 'remote', url }
  }
  throw new InspectError('invalid_source', 'source.kind must be "local" or "remote".')
}

/** Keep only the four numeric runtime counters; null when the panel sent none. */
export function normalizeInspectRuntime(raw) {
  if (!isPlainObject(raw)) return null
  const value = {}
  for (const key of ['tiles', 'pending', 'triangles', 'memory']) {
    const item = raw[key]
    if (typeof item === 'number' && Number.isFinite(item) && item >= 0) value[key] = item
  }
  return Object.keys(value).length === 0 ? null : value
}



/**
 * Containment check shared by the entry path and every derived local read
 * (external tileset JSON, deep content stat, SPZ header): lexical containment
 * below an opened folder plus a realpath containment check on both sides.
 * Returns the resolved path when it may be read, or `null` when it may not.
 * Derived refs additionally refuse UNC paths, so a tileset document can never
 * make the host touch an SMB share even when a network folder was opened.
 */
export async function inspectAllowedLocalPath(path, allowedDirs, { derived = false } = {}) {
  const target = resolve(path)
  if (derived && isUncPath(target)) return null
  const realTarget = await realPathOr(target)
  for (const allowed of allowedDirs) {
    const realAllowed = await realPathOr(allowed)
    const lexical = isWithinDirectory(target, allowed) || isWithinDirectory(target, realAllowed)
    if (lexical && isWithinDirectory(realTarget, realAllowed)) return target
  }
  return null
}

/** Local tileset files may come only from a folder the user opened in the panel. */
export async function inspectLocalPath(path, allowedDirs) {
  const target = await inspectAllowedLocalPath(path, allowedDirs)
  if (target === null) throw new InspectError('forbidden', INSPECT_FORBIDDEN_MESSAGE)
  return target
}

export const inspectRemaining = (deadline) => deadline - Date.now()

export async function inspectReadLocalJson(path, deadline) {
  let stat
  try {
    stat = await fs.stat(path)
  } catch {
    throw new InspectError('invalid_source', `cannot read the tileset JSON at ${path}.`)
  }
  if (!stat.isFile()) throw new InspectError('invalid_source', `the tileset path is not a file: ${path}.`)
  if (stat.size > MAX_INSPECT_JSON) {
    throw new InspectError('too_large', `the tileset JSON is ${stat.size} bytes, above the ${MAX_INSPECT_JSON / (1024 * 1024)} MB inspection limit.`)
  }
  if (inspectRemaining(deadline) <= 0) throw new InspectError('timeout', 'the inspection exceeded its 8 s budget.')
  return { text: await fs.readFile(path, 'utf8'), bytes: stat.size, label: path }
}

export async function inspectFetchRemote(url, deadline, method = 'GET') {
  if (blockedHost(url)) throw new InspectError('forbidden', 'the remote tileset URL points at a local or private address.')
  const remaining = inspectRemaining(deadline)
  if (remaining <= 0) throw new InspectError('timeout', 'the inspection exceeded its 8 s budget.')
  const controller = new AbortController()
  // One deadline for the whole exchange: the timer stays armed while the body
  // is read, so a slow or endless response body cannot outlive the 8 s budget.
  const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(remaining, INSPECT_FETCH_TIMEOUT_MS)))
  timer.unref?.()
  try {
    let response
    try {
      response = await fetch(url, { method, redirect: 'manual', signal: controller.signal })
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        throw new InspectError('timeout', 'fetching the remote tileset timed out.')
      }
      throw new InspectError('unreachable', `could not fetch the remote tileset: ${error instanceof Error ? error.message : String(error)}.`)
    }
    if (response.status >= 300 && response.status < 400) {
      throw new InspectError('unreachable', 'the remote tileset redirects; redirects are not followed.')
    }
    if (!response.ok) throw new InspectError('unreachable', `the remote tileset answered HTTP ${response.status}.`)
    if (method === 'HEAD') return { response }
    const reported = Number(response.headers?.get?.('content-length'))
    if (Number.isFinite(reported) && reported > MAX_INSPECT_JSON) {
      throw new InspectError('too_large', `the remote tileset JSON is ${reported} bytes, above the ${MAX_INSPECT_JSON / (1024 * 1024)} MB inspection limit.`)
    }
    if (response.body === null) return { text: '', bytes: 0, label: url }
    const reader = response.body.getReader()
    const chunks = []
    let total = 0
    for (;;) {
      if (inspectRemaining(deadline) <= 0) {
        throw new InspectError('timeout', 'the inspection exceeded its 8 s budget while reading the remote tileset body.')
      }
      let step
      try {
        step = await reader.read()
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') {
          throw new InspectError('timeout', 'reading the remote tileset body timed out.')
        }
        throw new InspectError('unreachable', `could not read the remote tileset body: ${error instanceof Error ? error.message : String(error)}.`)
      }
      if (step.done) break
      total += step.value.byteLength
      if (total > MAX_INSPECT_JSON) {
        // Stop the transfer immediately: a rejected report must never buffer the
        // whole oversized body first.
        controller.abort()
        reader.cancel().catch(() => {})
        throw new InspectError('too_large', `the remote tileset JSON is above the ${MAX_INSPECT_JSON / (1024 * 1024)} MB inspection limit.`)
      }
      chunks.push(Buffer.from(step.value))
    }
    return { text: Buffer.concat(chunks).toString('utf8'), bytes: total, label: url }
  } finally {
    clearTimeout(timer)
  }
}

/** Frozen issue code for an external tileset document that could not be loaded. */
export function inspectExternalLoadIssueCode(error, location) {
  const code = error instanceof InspectError ? error.code : 'internal'
  if (code === 'invalid_json' || code === 'too_large') return code
  return location.kind === 'local' ? 'content_missing' : 'content_unreachable'
}

export function inspectParseJson(text, label) {
  try {
    const value = JSON.parse(text)
    if (!isPlainObject(value)) throw new Error('the top-level JSON value is not an object')
    return value
  } catch (error) {
    throw new InspectError('invalid_json', `the tileset JSON at ${label} is not a valid 3D Tiles document: ${error instanceof Error ? error.message : String(error)}.`)
  }
}

/** Resolve a tile content uri against the document that declared it. */
function resolveInspectUri(base, uri) {
  if (typeof uri !== 'string' || uri.trim() === '') return null
  const raw = uri.trim()
  const scheme = /^[a-z][a-z0-9+.-]*:/i.test(raw)
  if (base.kind === 'remote') {
    if (scheme) return /^https?:\/\//i.test(raw) ? { kind: 'remote', value: raw } : null
    try {
      return { kind: 'remote', value: new URL(raw, base.url).href }
    } catch {
      return null
    }
  }
  if (scheme) return /^https?:\/\//i.test(raw) ? { kind: 'remote', value: raw } : null
  return { kind: 'local', value: resolve(base.dir, raw.split('?')[0].split('#')[0]) }
}

function inspectLocation(resolved) {
  if (resolved.kind === 'local') return { kind: 'local', value: resolved.value, dir: dirname(resolved.value) }
  return { kind: 'remote', value: resolved.value }
}

export function inspectBoundingVolume(value) {
  if (!isPlainObject(value)) return null
  const key = ['box', 'region', 'sphere'].find((name) => Array.isArray(value[name]))
  if (key === undefined) return null
  const numbers = value[key]
  if (!numbers.every((item) => typeof item === 'number' && Number.isFinite(item))) return null
  if (key === 'box' && numbers.length !== 12) return null
  if (key === 'region' && numbers.length !== 6) return null
  if (key === 'sphere' && numbers.length !== 4) return null
  return { type: key, center: key === 'region' ? null : numbers.slice(0, 3), region: key === 'region' ? numbers.slice() : null }
}

function inspectContentRefs(tile) {
  const refs = []
  const push = (content) => {
    if (!isPlainObject(content)) return
    const uri = typeof content.uri === 'string' ? content.uri : typeof content.url === 'string' ? content.url : ''
    if (uri.trim() !== '') refs.push(uri.trim())
  }
  if (Array.isArray(tile.content)) {
    for (const content of tile.content) push(content)
  } else {
    push(tile.content)
  }
  return refs
}

export function inspectIssue(issues, level, code, message, path) {
  if (issues.length >= MAX_INSPECT_ISSUES) {
    issues.dropped = (issues.dropped ?? 0) + 1
    return
  }
  const issue = { level, code, message }
  if (typeof path === 'string' && path !== '') issue.path = path
  issues.push(issue)
}

/** Walk every tile of one tileset document and fold its statistics into state. */
export function inspectDocTiles(doc, docLabel, state, base, isRootDoc) {
  const roots = []
  if (isPlainObject(doc.root)) roots.push(doc.root)
  else if (Array.isArray(doc.tiles)) for (const tile of doc.tiles) if (isPlainObject(tile)) roots.push(tile)
  if (roots.length === 0) return { roots: 0, docDepth: 0 }
  const stack = roots.map((tile, index) => ({ tile, path: index === 0 ? `${docLabel}:root` : `${docLabel}:tiles[${index}]`, depth: 0 }))
  let docDepth = 0
  while (stack.length > 0) {
    const { tile, path, depth } = stack.pop()
    state.tiles += 1
    if (depth > docDepth) docDepth = depth
    const children = Array.isArray(tile.children) ? tile.children.filter((item) => isPlainObject(item)) : []
    const refs = inspectContentRefs(tile)
    if (Array.isArray(tile.children) && children.length === 0 && refs.length === 0) {
      inspectIssue(state.issues, 'warn', 'empty_children', 'a tile declares no content and no children.', path)
    }
    if (Object.hasOwn(tile, 'geometricError')) {
      const error = tile.geometricError
      if (typeof error !== 'number' || !Number.isFinite(error) || error < 0) {
        inspectIssue(state.issues, 'warn', 'geometric_error_invalid', `tile geometricError must be a finite number >= 0, got ${JSON.stringify(error)}.`, path)
      }
    }
    if (Object.hasOwn(tile, 'boundingVolume') && inspectBoundingVolume(tile.boundingVolume) === null) {
      inspectIssue(state.issues, 'warn', 'bounding_volume_invalid', 'tile boundingVolume must be a box, region or sphere with the right number of finite numbers.', path)
    }
    for (const uri of refs) {
      state.contents += 1
      const extension = extname(uri.split('?')[0].split('#')[0]).slice(1).toLowerCase()
      const resolved = resolveInspectUri(base, uri)
      if (extension === 'json') {
        state.externalFiles += 1
        if (resolved !== null) state.externalTilesets.push({ location: inspectLocation(resolved), label: uri })
      } else if (INSPECT_CONTENT_KINDS[extension] !== undefined) {
        state.kinds[INSPECT_CONTENT_KINDS[extension]] += 1
      }
      if (extension === 'spz') state.spzCount += 1
      state.contentRefs.push({ uri, extension, resolved })
      if (isRootDoc && depth === 0) state.rootContents.push({ uri, extension, resolved })
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ tile: children[index], path: `${path}.children[${index}]`, depth: depth + 1 })
    }
  }
  return { roots: roots.length, docDepth }
}

// ---------------------------------------------------------------------------
// GLB header inspection (content-level Gaussian splatting detection).
//
// The v1.5.1 inspector only looked at extensions declared by tileset.json, so a
// dataset produced by `3dgs-ply-3dtiles-converter` (which declares
// KHR_gaussian_splatting inside each GLB, not in the tileset) was reported as
// plain mesh. Reading the GLB JSON chunk is enough to classify the content and
// stays within a small budget: only the first chunks of a bounded number of
// contents are read.
// ---------------------------------------------------------------------------

export const MAX_GLB_CONTENT_CHECKS = 16
const MAX_GLB_JSON_CHUNK = 2 * 1024 * 1024
const GLB_MAGIC = 0x46546c67
const GLB_JSON_CHUNK = 0x4e4f534a

/** Parse the JSON chunk of a GLB buffer, or null when it is not a valid GLB. */
function glbJsonFromBuffer(buffer) {
  if (buffer.length < 20) return null
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) return null
  const chunkLength = buffer.readUInt32LE(12)
  const chunkType = buffer.readUInt32LE(16)
  if (chunkType !== GLB_JSON_CHUNK || chunkLength <= 0 || chunkLength > MAX_GLB_JSON_CHUNK) return null
  if (buffer.length < 20 + chunkLength) return null
  try {
    const value = JSON.parse(buffer.subarray(20, 20 + chunkLength).toString('utf8'))
    return isPlainObject(value) ? value : null
  } catch {
    return null
  }
}

/** Read only the JSON chunk of a local GLB; never reads texture/binary chunks. */
export async function inspectGlbHeaderLocal(path, deadline) {
  if (inspectRemaining(deadline) <= 0) return null
  let handle
  try {
    handle = await fs.open(path, 'r')
    const head = Buffer.alloc(20)
    const { bytesRead } = await handle.read(head, 0, 20, 0)
    if (bytesRead < 20) return null
    const chunkLength = head.readUInt32LE(12)
    if (head.readUInt32LE(0) !== GLB_MAGIC || head.readUInt32LE(16) !== GLB_JSON_CHUNK) return null
    if (chunkLength <= 0 || chunkLength > MAX_GLB_JSON_CHUNK) return null
    const body = Buffer.alloc(chunkLength)
    const bodyRead = await handle.read(body, 0, chunkLength, 20)
    if (bodyRead.bytesRead < chunkLength) return null
    return glbJsonFromBuffer(Buffer.concat([head, body]))
  } catch {
    // A missing, unreadable or malformed content file is reported elsewhere.
    return null
  } finally {
    if (handle !== undefined) await handle.close().catch(() => {})
  }
}

/** Stream just enough of a remote GLB to parse its JSON chunk. */
export async function inspectGlbHeaderRemote(url, deadline) {
  if (blockedHost(url)) return null
  const remaining = inspectRemaining(deadline)
  if (remaining <= 0) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(remaining, INSPECT_FETCH_TIMEOUT_MS)))
  timer.unref?.()
  try {
    const response = await fetch(url, { redirect: 'manual', signal: controller.signal })
    if (response.status >= 300 && response.status < 400) return null
    if (!response.ok || response.body === null) return null
    const reader = response.body.getReader()
    const chunks = []
    let total = 0
    let json = null
    try {
      for (;;) {
        const step = await reader.read()
        if (step.done) break
        chunks.push(Buffer.from(step.value))
        total += step.value.byteLength
        const buffer = Buffer.concat(chunks, total)
        if (buffer.length < 20) {
          if (total > 20 + MAX_GLB_JSON_CHUNK) break
          continue
        }
        const chunkLength = buffer.readUInt32LE(12)
        if (buffer.readUInt32LE(0) !== GLB_MAGIC || buffer.readUInt32LE(16) !== GLB_JSON_CHUNK) break
        if (chunkLength <= 0 || chunkLength > MAX_GLB_JSON_CHUNK) break
        if (buffer.length >= 20 + chunkLength) {
          json = glbJsonFromBuffer(buffer)
          break
        }
        if (inspectRemaining(deadline) <= 0) break
      }
    } finally {
      reader.cancel().catch(() => {})
    }
    return json
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function inspectSpzHeader(path) {
  let handle
  try {
    handle = await fs.open(path, 'r')
    const buffer = Buffer.alloc(16)
    const { bytesRead } = await handle.read(buffer, 0, 16, 0)
    if (bytesRead < 12) return { ok: false, reason: 'file is shorter than the SPZ header' }
    const magic = buffer.readUInt32LE(0)
    const version = buffer.readUInt32LE(4)
    const points = buffer.readUInt32LE(8)
    if (magic !== SPZ_MAGIC) return { ok: false, reason: `unexpected SPZ magic 0x${magic.toString(16)}` }
    if (version !== 1 && version !== 2) return { ok: false, reason: `unsupported SPZ version ${version}` }
    if (points === 0) return { ok: false, reason: 'SPZ file declares zero splats' }
    return { ok: true, version, points }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    if (handle !== undefined) await handle.close().catch(() => {})
  }
}

/** Deep check: local content files are stat'ed, remote root contents are HEADed. */
export async function inspectDeepContents(state, source, deadline, allowedDirs) {
  if (source.kind === 'local') {
    let checked = 0
    for (const item of state.contentRefs) {
      if (item.resolved === null || item.resolved.kind !== 'local') continue
      if (checked >= MAX_INSPECT_CONTENT_CHECKS) break
      checked += 1
      // Derived content paths get the same allowlist + realpath check as the
      // entry path; an escape is a warning and the file is never touched.
      const target = await inspectAllowedLocalPath(item.resolved.value, allowedDirs, { derived: true })
      if (target === null) {
        inspectIssue(state.issues, 'warn', 'content_unreachable', 'a content file is outside the folders the user opened in the panel; it was not read.')
        continue
      }
      let stat
      try {
        stat = await fs.stat(target)
      } catch {
        inspectIssue(state.issues, 'warn', 'content_missing', `content file not found: ${item.uri}`, target)
        continue
      }
      if (!stat.isFile()) {
        inspectIssue(state.issues, 'warn', 'content_missing', `content path is not a file: ${item.uri}`, target)
        continue
      }
      if (stat.size > MAX_INSPECT_CONTENT_BYTES) {
        inspectIssue(state.issues, 'warn', 'content_too_large', `content file is ${stat.size} bytes: ${item.uri}`, target)
      }
      if (item.extension === 'spz') {
        // Only reached for a path that passed the allowlist + realpath check.
        const header = await inspectSpzHeader(target)
        if (header.ok) {
          inspectIssue(state.issues, 'info', 'gaussian_splatting_ok', `SPZ header ok: version ${header.version}, ${header.points} splats.`, item.uri)
        } else {
          inspectIssue(state.issues, 'warn', 'spz_header_invalid', `SPZ header could not be parsed: ${header.reason}.`, item.uri)
        }
      }
    }
    return
  }
  for (const item of state.rootContents) {
    if (item.resolved === null || item.resolved.kind !== 'remote') continue
    if (item.extension === 'spz') {
      inspectIssue(state.issues, 'info', 'gaussian_splatting_ok', 'remote .spz content detected; its header is not read for remote files.', item.uri)
      continue
    }
    if (inspectRemaining(deadline) <= 0) break
    try {
      const { response } = await inspectFetchRemote(item.resolved.value, deadline, 'HEAD')
      const reported = Number(response.headers?.get?.('content-length'))
      if (Number.isFinite(reported) && reported > MAX_INSPECT_CONTENT_BYTES) {
        inspectIssue(state.issues, 'warn', 'content_too_large', `content file is ${reported} bytes: ${item.uri}`, item.uri)
      }
    } catch (error) {
      const code = error instanceof InspectError ? error.code : 'internal'
      inspectIssue(state.issues, 'warn', 'content_unreachable', `content file could not be reached (${code}): ${item.uri}`, item.uri)
    }
  }
}
