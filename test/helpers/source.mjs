/**
 * Source access helpers for the structural tests.
 *
 * v1.x tests read `index.js` / `client.js` directly and asserted on strings. After
 * the v1.5 split those files are either an entry (host) or a build artifact
 * (client), so the structural tests read the AUTHORED SOURCE instead:
 *
 *   hostSource()    -> every module under src/host, or index.js before the split
 *   clientSource()  -> every module under src/client, or client.js before the split
 *
 * The fallback keeps the suite meaningful while the migration is in progress,
 * and once a directory exists the tests automatically cover the new layout.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(path))
    else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) found.push(path)
  }
  return found
}

/** Every authored file of one half, concatenated in a stable order. */
function sourceOf(dirName, fallbackFile) {
  const dir = join(ROOT, dirName)
  const files =
    existsSync(dir) && statSync(dir).isDirectory()
      ? walk(dir)
          .filter((file) => /\.(m?js)$/.test(file))
          .sort((a, b) => a.localeCompare(b, 'en'))
      : []
  // During the v1.5 migration the directory may exist but still be empty, so an
  // empty authored tree must fall back to the monolith as well.
  if (files.length === 0) return readFileSync(join(ROOT, fallbackFile), 'utf8')
  return files.map((file) => `\n// ---- ${file.slice(ROOT.length)} ----\n${readFileSync(file, 'utf8')}`).join('\n')
}

/** Authored Host source (all of src/host, or index.js before the split). */
export const hostSource = () => sourceOf('src/host', 'index.js')

/** Authored Client source (all of src/client, or client.js before the split). */
export const clientSource = () => sourceOf('src/client', 'client.js')

/** Read one file relative to the repository root. */
export const readRepoFile = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

/** Repository root with a trailing separator. */
export const repoRoot = () => ROOT
