/**
 * Filesystem primitives shared by the persistence modules.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Replace the catalog atomically. Windows antivirus filters can hold a freshly
 * written file for a moment, so a transient rename failure is retried briefly
 * instead of failing the save.
 */
export async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to)
      return
    } catch (error) {
      const transient = error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'EBUSY'
      if (!transient || attempt >= 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
    }
  }
}

/**
 * Replace a JSON file atomically: write a unique temporary file in the same
 * folder, then rename it over the target (transient Windows share errors are
 * retried by renameWithRetry).
 */
export async function writeJsonAtomic(file, value, options = {}) {
  const space = options.space === undefined ? 2 : options.space
  const trailingNewline = options.trailingNewline !== false
  await fs.mkdir(dirname(file), { recursive: true })
  // A unique temporary name keeps two concurrent saves from sharing one file;
  // the rename stays atomic, so readers see either the old or the new content.
  const temporary = `${file}.tmp-${randomBytes(6).toString('hex')}`
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, space)}${trailingNewline ? '\n' : ''}`, 'utf8')
    await renameWithRetry(temporary, file)
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

/**
 * Keep the newest `keep` files in a folder, deleting the oldest first.
 * `match` narrows the candidate set and `keepName` protects the file that was
 * just written; pruning is best effort in every caller.
 */
export async function pruneByMtime(dir, keep, options = {}) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  const match = typeof options.match === 'function' ? options.match : () => true
  const files = []
  for (const entry of entries) {
    if (!entry.isFile() || !match(entry.name)) continue
    try {
      files.push({ name: entry.name, mtime: (await fs.stat(join(dir, entry.name))).mtimeMs })
    } catch {
      // The file disappeared while listing; nothing to prune.
    }
  }
  if (files.length <= keep) return
  files.sort((left, right) => left.mtime - right.mtime || left.name.localeCompare(right.name))
  let remove = files.length - keep
  for (const item of files) {
    if (remove <= 0) break
    if (options.keepName !== undefined && item.name === options.keepName) continue
    await fs.rm(join(dir, item.name), { force: true }).catch(() => {})
    remove -= 1
  }
}

/**
 * Bounded breadth-first `tileset.json` scan shared by local path resolution and
 * the panel's folder scan. Entries are read in name order so results are stable.
 */
export async function scanTilesets(base, options = {}) {
  const depthLimit = Number.isInteger(options.depth) && options.depth >= 0 ? options.depth : 3
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 200
  const found = []
  let visited = 0
  let truncated = false
  const queue = [{ directory: base, depth: 0 }]
  while (queue.length > 0 && !truncated) {
    const { directory, depth } = queue.shift()
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (visited >= limit) {
        truncated = true
        break
      }
      visited += 1
      if (entry.isDirectory()) {
        if (depth < depthLimit) queue.push({ directory: join(directory, entry.name), depth: depth + 1 })
      } else if (entry.isFile() && entry.name.toLowerCase() === 'tileset.json') {
        found.push(join(directory, entry.name))
      }
    }
  }
  return { found, visited, truncated }
}
