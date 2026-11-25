/**
 * scripts/check-i18n.mjs — bilingual dictionary gate.
 *
 * The panel ships two locales in one bundle, so a key added to only one language
 * renders as a raw key in the other. This gate parses every authored client
 * module for literal `t('some.key')` lookups and proves that:
 *   1. zh and en define exactly the same keys (same set, same order is not required);
 *   2. every literal lookup resolves in both dictionaries;
 *   3. locale/*.json (host-facing copy) keeps zh/en key parity.
 *
 * Keys assembled at runtime (`t('prefix.' + id)`) are out of reach on purpose:
 * the catalog of prefixes below lists the dynamic families, and a *new* family
 * must be added here so it is reviewed once instead of silently drifting.
 *
 * Run: node scripts/check-i18n.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const clientDir = join(root, 'src/client')

// Dynamic families: `t('family.' + value)` cannot be grepped statically.
const DYNAMIC_PREFIXES = ['tool.action.', 'tool.call.toolview', 'menu.', 'shader.preset.', 'analysis.title.', 'health.issue.']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

const lookupPattern = /\bt\(\s*'([^']+)'/g
const messagesPattern = /\bmessages\(\s*'([^']+)'/g

const lookups = new Map() // key -> Set(files)
for (const file of walk(clientDir)) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const text = readFileSync(file, 'utf8')
  for (const pattern of [lookupPattern, messagesPattern]) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      const key = match[1]
      if (!key.includes('.')) continue
      if (!lookups.has(key)) lookups.set(key, new Set())
      lookups.get(key).add(rel)
    }
  }
}

const { MESSAGES } = await import('../src/client/messages.js')
const zh = MESSAGES.zh ?? {}
const en = MESSAGES.en ?? {}
const problems = []

const zhKeys = Object.keys(zh)
const enKeys = Object.keys(en)
const missingEn = zhKeys.filter((key) => !(key in en))
const missingZh = enKeys.filter((key) => !(key in zh))
for (const key of missingEn) problems.push(`en dictionary misses '${key}' (zh has it)`)
for (const key of missingZh) problems.push(`zh dictionary misses '${key}' (en has it)`)

for (const [key, files] of lookups) {
  const dynamic = DYNAMIC_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix + '.') === false && prefix.endsWith('.') && key.startsWith(prefix))
  if (dynamic) continue
  if (!(key in zh) || !(key in en)) {
    problems.push(`literal lookup '${key}' undefined in ${[...files].join(', ')}`)
  }
}

// Host-facing locale files must keep the same shape.
const locales = {}
for (const lang of ['zh', 'en']) {
  try {
    locales[lang] = JSON.parse(readFileSync(join(root, 'locale', `${lang}.json`), 'utf8'))
  } catch (error) {
    problems.push(`locale/${lang}.json unreadable: ${error.message}`)
    locales[lang] = {}
  }
}
const flatten = (value, prefix = '', out = {}) => {
  for (const [key, child] of Object.entries(value ?? {})) {
    const next = prefix === '' ? key : `${prefix}.${key}`
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, next, out)
    else out[next] = child
  }
  return out
}
const localeZh = flatten(locales.zh)
const localeEn = flatten(locales.en)
for (const key of Object.keys(localeZh)) if (!(key in localeEn)) problems.push(`locale/en.json misses '${key}'`)
for (const key of Object.keys(localeEn)) if (!(key in localeZh)) problems.push(`locale/zh.json misses '${key}'`)

const unused = zhKeys.filter((key) => !lookups.has(key) && !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix)))
// Dead-key ratchet (v1.6.2 B 遗留, updated in v1.6.3 for compare/sun/parse/bookmarks dynamic keys):
// the catalog is cleaned incrementally, but it must never grow unexpectedly.
const UNUSED_BASELINE = 321
if (unused.length > UNUSED_BASELINE) {
  problems.push(`unreferenced keys grew to ${unused.length} (baseline ${UNUSED_BASELINE})`)
}
if (process.argv.includes('--report')) console.log(['unreferenced keys:', ...unused].join('\n'))
console.log(
  `i18n: ${zhKeys.length} zh keys / ${enKeys.length} en keys, ${lookups.size} literal lookups, ` +
    `${Object.keys(localeZh).length} locale keys, ${unused.length} unreferenced keys`,
)
if (problems.length > 0) {
  console.error(`\ni18n gate failed: ${problems.length} problem(s)`)
  for (const problem of problems.slice(0, 40)) console.error(`  - ${problem}`)
  if (problems.length > 40) console.error(`  … ${problems.length - 40} more`)
  process.exit(1)
}
