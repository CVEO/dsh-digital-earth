/**
 * Remembered-folder merge/read/persist plus the page-only directory route.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { promises as fs } from 'node:fs'
import { basename, resolve } from 'node:path'
import { DIRECTORIES_FILE, MAX_RECENT_DIRECTORIES } from './constants.js'
import { isFilesystemRoot, realPathOr } from './paths.js'
import { sendJson } from './http.js'
import { writeJsonAtomic } from './fs-util.js'

// ---------------------------------------------------------------------------
// Remembered folders (directories.json). `/scan` remains the only way a folder
// enters the allowlist, but that gesture is a user decision: remembering it lets
// the agent load the same data after a DSH restart without asking again. The
// list is page-only data for the panel's data menu; it never reaches tool
// results, so absolute local paths stay between the host and this page.
// ---------------------------------------------------------------------------

/**
 * Test seam: pure merge for the remembered-folder list. The new entry becomes
 * the newest item, a duplicate path keeps only its newest position, and the
 * result is capped at `max`. Neither argument is mutated.
 */
export function mergeRecentDirectories(list, entry, max = MAX_RECENT_DIRECTORIES) {
  const entries = []
  if (entry !== null && typeof entry === 'object' && typeof entry.path === 'string' && entry.path.trim() !== '') {
    const at = typeof entry.at === 'string' && entry.at !== '' ? entry.at : new Date().toISOString()
    entries.push({ path: entry.path.trim(), at })
  }
  if (Array.isArray(list)) entries.push(...list)
  return sanitizeRecentDirectories(entries, max)
}

/** Deduplicate by path, keep arrival order (newest first), cap the length. */
function sanitizeRecentDirectories(entries, max = MAX_RECENT_DIRECTORIES) {
  const limit = Number.isInteger(max) && max > 0 ? max : MAX_RECENT_DIRECTORIES
  const seen = new Set()
  const clean = []
  for (const item of entries) {
    if (item === null || typeof item !== 'object') continue
    if (typeof item.path !== 'string' || item.path.trim() === '') continue
    const path = item.path.trim()
    if (seen.has(path)) continue
    seen.add(path)
    clean.push({ path, at: typeof item.at === 'string' ? item.at : '' })
    if (clean.length >= limit) break
  }
  return clean
}

async function readRecentDirectories() {
  let text
  try {
    text = await fs.readFile(DIRECTORIES_FILE, 'utf8')
  } catch {
    return []
  }
  try {
    const parsed = JSON.parse(text)
    const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.directories) ? parsed.directories : []
    return sanitizeRecentDirectories(entries)
  } catch {
    return []
  }
}

/**
 * GET: folders remembered from earlier sessions. This response is data for the
 * page only — it is never merged into a tool result, so the token-bearing route
 * cannot hand absolute local paths to the model.
 */
export async function directoriesHandler(getDirectories, req, res) {
  const entries = typeof getDirectories === 'function' ? getDirectories() : []
  const directories = []
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (directories.length >= MAX_RECENT_DIRECTORIES) break
    // A moved or unmounted folder stays listed with exists:false so the user
    // can see why loading from it would fail.
    let exists = false
    try {
      await fs.access(entry.path)
      exists = true
    } catch {
      // Missing on purpose; the flag above is the answer.
    }
    directories.push({ path: entry.path, name: basename(entry.path), at: entry.at, exists })
  }
  sendJson(res, 200, { directories })
}

/**
 * Page-only remembered-folder state for one plugin instance. `/scan` remains the
 * only way a folder enters the allowlist; remembering it lets the agent load the
 * same data after a DSH restart without asking again.
 */
export function createRecentDirectories(allowedDirs) {
  let recentDirectories = []
  // Writes are serialised like the source catalog: two quick scans must never
  // let an older snapshot land after a newer one. The snapshot is captured at
  // call time so the queued write persists exactly the list that gesture saw.
  let persistChain = Promise.resolve()

  const rememberDirectory = (directory) => {
    recentDirectories = mergeRecentDirectories(recentDirectories, { path: directory, at: new Date().toISOString() })
    const snapshot = recentDirectories
    persistChain = persistChain.then(() => persistRecentDirectories(snapshot)).catch(() => {})
  }

  const rememberScannedDirectory = (resolvedDir, realDir) => {
    // Record the resolved spelling last, so the page lists the path the user
    // actually picked first; a junctioned folder contributes both spellings.
    if (realDir !== resolvedDir) rememberDirectory(realDir)
    rememberDirectory(resolvedDir)
  }

  /**
   * Restore remembered folders into the allowlist. A missing or unreadable
   * folder (unmounted drive, deleted directory) is skipped, and one bad entry
   * must never fail plugin startup; everything here swallows its errors.
   */
  const restore = async () => {
    const entries = await readRecentDirectories()
    const restored = []
    for (const entry of entries) {
      try {
        const directory = resolve(entry.path)
        // A drive/share root would hand the agent every file on it.
        if (isFilesystemRoot(directory)) continue
        restored.push(entry)
        try {
          await fs.access(directory)
        } catch {
          continue
        }
        allowedDirs.add(directory)
        // Restore has no user gesture behind it, so it must not follow a folder
        // that was since replaced by a junction to a drive root: that would hand
        // the agent a whole drive. `/scan` keeps its own realpath check.
        const realDirectory = await realPathOr(directory)
        if (!isFilesystemRoot(realDirectory)) allowedDirs.add(realDirectory)
      } catch {
        // Best effort: keep loading the remaining entries.
      }
    }
    recentDirectories = sanitizeRecentDirectories([...recentDirectories, ...restored])
  }

  return { rememberScannedDirectory, restore, list: () => recentDirectories }
}

/** Replace the remembered list atomically, with the catalog's temp+rename rule. */
async function writeRecentDirectories(list) {
  await writeJsonAtomic(DIRECTORIES_FILE, list)
}

/** Best effort: a read-only DSH home must never fail a panel request. */
function persistRecentDirectories(list) {
  return writeRecentDirectories(list).catch(() => {})
}
