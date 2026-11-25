/**
 * scripts/check-tokens.mjs — theme-token gate.
 *
 * The panel must read its palette from the host design tokens (`--dsw-alias-*`)
 * or from the panel's own `--mv-*` custom properties. Two failure modes creep in:
 *
 *   1. a `var(--mv-*)` reference with no definition (a silently invalid colour);
 *   2. a new hardcoded hex colour outside the reviewed inventory — the panel then
 *      stops following the host theme in that spot.
 *
 * The inventory below is the reviewed set of data-viz colours (shader presets,
 * profile colours, attribution scrims) that are intentionally literal. Adding a
 * colour is a deliberate act: extend this list in the same change.
 *
 * Run: node scripts/check-tokens.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const uiDir = join(root, 'src/client/ui')

// Reviewed literal colours (lowercase, without the leading '#').
const REVIEWED_COLORS = new Set([
  '000', '00000008', '0000001a', '0006',
  '0284c7', '04241a', '05080f', '07152914', '07152926', '07152933', '07152966',
  '092638', '0a0f15', '0a1018', '0b1119', '0b111a', '0b1320', '0b1512', '0b1e4b', '0b2b52',
  '0e1620', '0e7490', '0ea5e9', '0f1115', '0f172a',
  '147db3', '157db3', '167344', '17212f', '172466', '1b6fae', '1d4ed8', '20344c', '223b53',
  '243244', '2631480f',
  '38bdf8', '38c9ff', '39b7ff30', '3c4d63', '3dcc99', '3ddc97', '4176e6', '4ade80',
  '5796cb', '5b6068', '67e8f9', '70d8ff', '76e0a4', '79b6e8', '79b6e83d', '7dd3fc', '7ff0c4',
  '8a5208', '8a8f98', '8bb6dc', '9fd7ff', '9fdcff', 'a52f37', 'a8adb5',
  'b52b35', 'bae6fd', 'c084fc', 'c2610a', 'c43b3b', 'cad7e3',
  'd0d4da', 'd33b3b', 'd48222', 'd8ecff', 'e2f2fd', 'e5484d', 'edf5ff', 'edf6ff',
  'f05c4d', 'f0b84b', 'f0be65', 'f59e0b', 'f87171', 'f8fafc', 'fbbf24', 'fca5a5', 'fcc951',
  'fcfdff', 'ff8b8b', 'ffa69c', 'ffadb4', 'ffc46b', 'fff',
])

const files = readdirSync(uiDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => join(uiDir, name))

const problems = []
// Vars some elements receive from JS (vector label accent, swatch colour).
const DYNAMIC_VARS = new Set(["--mv-label-accent", "--mv-swatch"])
const usedVars = new Set()
const definedVars = new Set()
const newColors = new Map()

for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/var\(\s*(--mv-[a-z0-9-]+)/g)) usedVars.add(match[1])
  for (const match of text.matchAll(/(--mv-[a-z0-9-]+)\s*:/g)) definedVars.add(match[1])
  for (const match of text.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    const color = match[1].toLowerCase()
    if (REVIEWED_COLORS.has(color)) continue
    if (!newColors.has(color)) newColors.set(color, new Set())
    newColors.get(color).add(rel)
  }
}

for (const name of usedVars) {
  if (!definedVars.has(name) && !DYNAMIC_VARS.has(name)) problems.push(`var(${name}) is used but never defined in src/client/ui`)
}
for (const [color, where] of newColors) {
  problems.push(`unreviewed literal colour #${color} in ${[...where].join(', ')} — use a token or extend REVIEWED_COLORS`)
}

console.log(`tokens: ${definedVars.size} --mv-* definitions, ${usedVars.size} references, ${REVIEWED_COLORS.size} reviewed literals`)

// Hardcoded theme palettes must not come back: the host tokens own the palette.
const css = readFileSync(join(uiDir, 'css.js'), 'utf8')
for (const forbidden of ['data-mv-theme="dark"', 'data-mv-theme="light"']) {
  if (css.includes(forbidden)) problems.push(`css.js re-introduces a hardcoded palette: ${forbidden}`)
}

if (problems.length > 0) {
  console.error(`\ntoken gate failed: ${problems.length} problem(s)`)
  for (const problem of problems.slice(0, 40)) console.error(`  - ${problem}`)
  process.exit(1)
}
