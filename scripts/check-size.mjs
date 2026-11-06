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
import { join, relative } from 'node:path'
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
  { file: 'scripts/build-client.mjs', max: 160 },
]

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

const failures = []
const rows = []

for (const { dir, max } of BUDGETS) {
  for (const path of await walk(dir)) {
    const lines = (await readFile(join(ROOT, path), 'utf8')).split('\n').length
    rows.push({ path, lines, max })
    if (lines > max) failures.push(`${path}: ${lines} lines > budget ${max}`)
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
for (const { path, lines, max } of rows) {
  const flag = lines > max ? 'FAIL' : ' ok '
  console.log(`${flag} ${String(lines).padStart(5)} / ${String(max).padStart(5)}  ${relative(ROOT, join(ROOT, path))}`)
}

if (failures.length > 0) {
  console.error(`\nsize guard: ${failures.length} file(s) over budget`)
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error('Split the file into modules instead of growing it.')
  process.exit(1)
}
console.log('\nsize guard: every authored file is inside budget')
