#!/usr/bin/env node
/**
 * Architecture guard: keep authored modules small enough to stay reviewable.
 *
 * The v1.x tree was two mega-files (index.js 5k lines, client.js 7.4k lines) and
 * every later change landed in them, which is how the plugin turned into a pile.
 * This script fails CI when an authored source file grows past its budget, so the
 * split cannot silently regress.
 *
 * Generated artifacts (client.js) are exempt: they are build output.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

/** Directory -> maximum lines per authored file. */
const BUDGETS = [
  { dir: 'src/host', max: 600 },
  { dir: 'src/client', max: 900 },
]
/** Files that must stay small on their own. */
const FILE_BUDGETS = [
  { file: 'index.js', max: 80 },
  { file: 'scripts/build-client.mjs', max: 200 },
]
/**
 * Time-boxed exceptions for a file that is mid-decomposition. The max is the
 * CURRENT size rounded up: the file may not grow, and the entry must be removed
 * (or lowered) when the milestone that shrinks it lands. An exception is printed
 * as a warning so it cannot be forgotten.
 */
const EXCEPTIONS = new Map([
  // M3 phase 2 (scene runtime extraction) is in progress: the analysis engine and
  // other scene modules are being moved out. The number is lowered every time a
  // slice lands, so the file can only shrink.
  ['src/client/viewer/ViewerSurface.js', 3500],
])

async function walk(dir) {
  const found = []
  let entries
  try {
    entries = await readdir(join(ROOT, dir), { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await walk(path)))
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) found.push(path)
  }
  return found
}

/**
 * Repo-relative path with forward slashes. `path.join` yields backslashes on
 * Windows, so a budget keyed `src/client/...` would silently stop matching there
 * (the CI matrix runs both platforms — the guard must behave identically).
 */
const normalise = (path) => path.split(sep).join('/')

const failures = []
const warnings = []
const rows = []

for (const { dir, max } of BUDGETS) {
  for (const rawPath of await walk(dir)) {
    const path = normalise(rawPath)
    const lines = (await readFile(join(ROOT, path), 'utf8')).split('\n').length
    const exception = EXCEPTIONS.get(path)
    const budget = exception ?? max
    rows.push({ path, lines, max: budget, exception: exception !== undefined })
    if (lines > budget) failures.push(`${path}: ${lines} lines > budget ${budget}`)
    else if (exception !== undefined) warnings.push(`${path}: ${lines}/${budget} lines (time-boxed exception, must shrink)`)
  }
}

for (const { file, max } of FILE_BUDGETS) {
  const fileStat = await stat(join(ROOT, file)).catch(() => null)
  if (!fileStat?.isFile()) continue
  const lines = (await readFile(join(ROOT, file), 'utf8')).split('\n').length
  rows.push({ path: file, lines, max })
  if (lines > max) failures.push(`${file}: ${lines} lines > budget ${max}`)
}

rows.sort((a, b) => b.lines - a.lines)
for (const { path, lines, max, exception } of rows) {
  const flag = lines > max ? 'FAIL' : exception ? 'WARN' : ' ok '
  console.log(`${flag} ${String(lines).padStart(5)} / ${String(max).padStart(5)}  ${relative(ROOT, join(ROOT, path))}`)
}

for (const warning of warnings) console.warn(`size guard: ${warning}`)

if (failures.length > 0) {
  console.error(`\nsize guard: ${failures.length} file(s) over budget`)
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error('Split the file into modules instead of growing it.')
  process.exit(1)
}
console.log('\nsize guard: every authored file is inside budget')
