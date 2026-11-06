/**
 * Local tileset resolution: bounded scan, moved-path healing and the allowlist check.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { promises as fs } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { isFilesystemRoot, isUncPath, isWithinDirectory, realPathOr } from './paths.js'
import { scanTilesets } from './fs-util.js'

// ---------------------------------------------------------------------------
// Local tileset resolution (v1.4.0). A tool call may point at a folder, at a
// file that has moved, or at a path below a folder the user has not opened yet.
// Resolution reads filesystem metadata only (never file contents) inside a
// bounded search; when the resolved file is outside the allowlist the bridge
// asks the panel for one-time permission.
// ---------------------------------------------------------------------------

/** The panel dialog timeout is independent from SCENE_TIMEOUT_MS. */
export const LOCAL_ACCESS_TIMEOUT_MS = 30000
const LOCAL_SEARCH_DEPTH = 3
const LOCAL_SEARCH_ITEMS = 200
const LOCAL_ANCESTOR_HOPS = 2
const LOCAL_CANDIDATE_LIMIT = 10

/** A local path failure with a stable code and one actionable next step. */
class LocalPathError extends Error {
  constructor(code, summary, next) {
    super(`[${code}] ${summary} next: ${next}`)
    this.name = 'LocalPathError'
    this.code = code
  }
}

export const localPathError = (code, summary, next) => new LocalPathError(code, summary, next)

/** Strip chat-copy noise (line breaks, wrapping quotes) without guessing. */
function normalizeLocalInput(value) {
  if (typeof value !== 'string') return ''
  let text = value.replace(/[\r\n]+/g, ' ').trim()
  for (;;) {
    if (text.length < 2) break
    const quote = text[0]
    if ((quote !== '"' && quote !== "'") || text[text.length - 1] !== quote) break
    text = text.slice(1, -1).trim()
  }
  return text
}


/** Resolve and keep only files whose real path stays inside the searched folder. */
async function insideFolder(files, base) {
  const inside = []
  for (const file of files) {
    const real = await realPathOr(file)
    if (isWithinDirectory(real, base)) inside.push(real)
  }
  return inside
}

function ambiguousLocalPath(base, files) {
  const shown = files.slice(0, LOCAL_CANDIDATE_LIMIT).map((file) => relative(base, file).split(sep).join('/'))
  const more = files.length > shown.length ? `, and ${files.length - shown.length} more` : ''
  return localPathError(
    'ambiguous_local_path',
    `found ${files.length} tileset.json files under "${base}": ${shown.join(', ')}${more}.`,
    'call again with the exact path of the tileset.json you want.',
  )
}

/** A real search base must never be a drive/share root reached through a junction. */
function assertSearchBase(base, requested) {
  if (isUncPath(base) || isFilesystemRoot(base)) {
    throw localPathError(
      'invalid_local_path',
      `"${requested}" resolves to a filesystem or share root.`,
      'pass a folder below a root, not the root itself.',
    )
  }
}

/**
 * Resolve a model-supplied local path to one concrete tileset.json.
 *
 * - an existing file is used as-is;
 * - an existing folder is searched (depth <= 3, <= 200 entries) for the unique
 *   tileset.json below it;
 * - a missing path climbs at most two parent folders and searches the nearest
 *   existing one, so a renamed/moved folder still heals in one call;
 * - roots and UNC paths are refused, and every returned real path is re-checked
 *   against the folder that was searched (symlink escapes are dropped);
 * - when `allowedDirs` is given, the final file must also stay inside one of
 *   them, otherwise the call fails with access_denied.
 *
 * Test seam: exported for unit tests; also used by earth_scene load/inspect.
 */
export async function resolveLocalTileset(rawPath, allowedDirs = null) {
  const requested = normalizeLocalInput(rawPath)
  if (requested === '') {
    throw localPathError('invalid_local_path', 'the local path is empty.', 'pass an absolute path to a tileset.json.')
  }
  if (!isAbsolute(requested)) {
    throw localPathError('invalid_local_path', `"${requested}" is not an absolute path.`, 'pass an absolute path, not a relative one.')
  }
  const resolved = resolve(requested)
  if (isUncPath(resolved)) {
    throw localPathError('invalid_local_path', 'UNC network paths are not supported.', 'copy the data to a local drive and pass that path.')
  }
  if (isFilesystemRoot(resolved)) {
    throw localPathError('invalid_local_path', `"${resolved}" is a filesystem or share root.`, 'pass a folder below a root, not the root itself.')
  }
  let stat = null
  try {
    stat = await fs.stat(resolved)
  } catch {
    stat = null
  }
  let kind = 'missing'
  let base = null
  let target = null
  let files = []
  let truncated = false
  if (stat !== null && stat.isFile()) {
    kind = 'file'
    target = await realPathOr(resolved)
  } else if (stat !== null && stat.isDirectory()) {
    kind = 'directory'
    base = await realPathOr(resolved)
    assertSearchBase(base, resolved)
    const searched = await scanTilesets(base, { depth: LOCAL_SEARCH_DEPTH, limit: LOCAL_SEARCH_ITEMS })
    files = await insideFolder(searched.found, base)
    truncated = searched.truncated
  } else {
    // A missing path heals only when a parent within two levels exists; the
    // search never climbs to a drive/share root.
    let ancestor = null
    let candidate = dirname(resolved)
    for (let hop = 0; hop < LOCAL_ANCESTOR_HOPS && candidate !== '' && candidate !== null; hop += 1) {
      if (isUncPath(candidate) || isFilesystemRoot(candidate)) break
      let ancestorStat = null
      try {
        ancestorStat = await fs.stat(candidate)
      } catch {
        ancestorStat = null
      }
      if (ancestorStat !== null && ancestorStat.isDirectory()) {
        ancestor = candidate
        break
      }
      const parent = dirname(candidate)
      if (parent === candidate) break
      candidate = parent
    }
    if (ancestor === null) {
      throw localPathError(
        'path_not_found',
        `"${resolved}" does not exist and no existing parent folder was found within ${LOCAL_ANCESTOR_HOPS} levels.`,
        'check the path, then retry.',
      )
    }
    base = await realPathOr(ancestor)
    assertSearchBase(base, resolved)
    const searched = await scanTilesets(base, { depth: LOCAL_SEARCH_DEPTH, limit: LOCAL_SEARCH_ITEMS })
    files = await insideFolder(searched.found, base)
    truncated = searched.truncated
  }
  if (target !== null && (isUncPath(target) || isFilesystemRoot(target))) {
    throw localPathError('invalid_local_path', `"${resolved}" resolves to an unsupported network path.`, 'copy the data to a local drive and pass that path.')
  }
  if (target === null) {
    if (files.length === 0) {
      const limit = truncated ? ` (the search stopped at ${LOCAL_SEARCH_ITEMS} entries)` : ''
      const summary = kind === 'missing'
        ? `"${resolved}" does not exist and no tileset.json was found below its nearest existing parent "${base}"`
        : `no tileset.json was found below "${base}"`
      throw localPathError('no_tileset_found', `${summary}${limit}.`, 'pass the exact tileset.json path, or a folder that contains one.')
    }
    if (files.length > 1) throw ambiguousLocalPath(base, files)
    target = files[0]
  }
  const resolution = {
    requested: resolved,
    path: target,
    directory: dirname(target),
    kind,
  }
  // Only a healed path needs to be reported; a direct file is already what the
  // caller asked for (even when realpath normalises its case).
  if (kind !== 'file' && target !== resolved) resolution.resolvedFrom = resolved
  if (allowedDirs !== null && allowedDirs !== undefined && !isLocalResolutionAllowed(resolution, allowedDirs)) {
    throw localPathError(
      'access_denied',
      `the folder for "${resolved}" has not been opened in the Digital Earth panel.`,
      'ask the user to allow it in the panel; do not retry until they do.',
    )
  }
  return resolution
}

/** True when the resolved real file is inside one of the user-opened folders. */
export function isLocalResolutionAllowed(resolution, allowedDirs) {
  if (resolution === null || typeof resolution?.path !== 'string' || resolution.path === '') return false
  const folders = allowedDirs instanceof Set ? [...allowedDirs] : Array.isArray(allowedDirs) ? allowedDirs : []
  for (const folder of folders) {
    if (typeof folder !== 'string' || folder === '') continue
    if (isWithinDirectory(resolution.path, folder)) return true
  }
  return false
}
