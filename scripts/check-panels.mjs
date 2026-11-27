#!/usr/bin/env node
/**
 * check-panels.mjs — static contract for Panel System 2.0.
 *
 * The goal is one predictable place for every panel. These assertions are cheap
 * and catch the regressions that visual review is supposed to catch but that no
 * headless test can see: a second rail, a floating escape hatch, duplicate tab
 * labels, a panel that is not kept mounted while inactive, or the old 7-entry
 * toolbar creeping back.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const problems = []
const fail = (message) => problems.push(message)
const read = (path) => readFileSync(join(root, path), 'utf8')

const state = read('src/client/ui/panel-state.js')
if (!state.includes("export const PANEL_STORAGE_KEY = 'mv.ui.v2'")) fail('panel-state: storage key is not mv.ui.v2')
for (const id of ['layers', 'tools', 'result', 'object']) {
  if (!new RegExp(`'${id}'`).test(state)) fail(`panel-state: missing tab ${id}`)
}
for (const marker of ['panelReducer', 'readPanelState', 'writePanelState', 'visiblePanelTabs', 'clampPanelWidth']) {
  if (!state.includes(marker)) fail(`panel-state: missing ${marker}`)
}
if (!state.includes("'resultArrived'") || !state.includes("'objectArrived'")) {
  fail('panel-state: automatic focus policy actions are missing')
}

const rail = read('src/client/ui/panel-rail.js')
// One navigation level: the topbar quick group switches destinations; the dock
// keeps a title bar and one visible tabpanel, never a second tab strip.
for (const marker of ["role: 'tabpanel'", "'aria-label': tabLabel(t, panel.id)", 'mv-dock-head-title']) {
  if (!rail.includes(marker)) fail(`panel-rail: missing ${marker}`)
}
if (rail.includes("role: 'tablist'") || rail.includes("role: 'tab'")) {
  fail('panel-rail: duplicate tab navigation; topbar quick group must be the only switcher')
}
const topbar = read('src/client/ui/topbar.js')
if (!topbar.includes('ToolbarQuick')) fail('topbar: quick destination group is missing')
if (!rail.includes("hidden: collapsed || panel.id !== activeTab")) fail('panel-rail: inactive panels must stay mounted and hidden')
if (/mv-dock-tab-close/.test(rail)) fail('panel-rail: per-tab close button must not exist')
if ((rail.match(/title: t\('dock\.collapse'\)/g) ?? []).length !== 1) fail('panel-rail: exactly one collapse entry')
if (!rail.includes('dock.unread')) fail('panel-rail: unread dot copy missing')

const stack = read('src/client/ui/right-stack.js')
if (!stack.includes("from './panel-rail.js'")) fail('right-stack: must render through panel-rail')
if (!stack.includes("from './panel-state.js'")) fail('right-stack: must use the panel-state kernel')
if (/useFloatingWindow|autoFloat|floatingIds|detached/.test(stack)) fail('right-stack: floating/detach paths must stay removed')
if (!stack.includes("type: 'resultArrived'") || !stack.includes("type: 'objectArrived'")) {
  fail('right-stack: arrival policy is not wired')
}

const css = read('src/client/ui/css.js')
if (!css.includes('.mv-dock-panel[hidden]{display:none}')) fail('css: inactive panels must be display:none')
if (!css.includes('.mv-dock.is-collapsed .mv-dock-body{display:none}')) fail('css: collapsed rail must hide body')
if (!css.includes('--mv-z-rail')) fail('css: z-index tokens are missing')
if (/\.mv-dock-tab-close/.test(css)) fail('css: dead tab-close rules must be removed')

const quick = read('src/client/ui/toolbar-quick.js')
const entries = [...quick.matchAll(/entry\('([a-z]+)'/g)].map((match) => match[1])
if (entries.join(',') !== 'layers,tools,result') fail(`toolbar-quick: expected layers,tools,result, got ${entries.join(',')}`)
if (/openToolCount|showAnalysis|showView|onOpenAnalysis|onOpenView/.test(quick)) fail('toolbar-quick: old analysis/view entries must stay removed')

const messages = read('src/client/messages-dock.js')
for (const key of ['panel.tab.layers', 'panel.tab.tools', 'panel.tab.result', 'panel.tab.object', 'panel.result.emptyTitle']) {
  const hits = [...messages.matchAll(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g'))].length
  if (hits !== 2) fail(`messages: ${key} must exist in zh and en`)
}
for (const key of ['panel.tab.layers', 'panel.tab.tools', 'panel.tab.result', 'panel.tab.object']) {
  if (!quick.includes(key) && !rail.includes(key)) fail(`label ${key} is not referenced by the rail or toolbar`)
}

// No source file may render a second right rail or resurrect the old stack.
const walk = (dir) =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name)
    return entry.isDirectory() ? walk(rel) : [rel]
  })
for (const rel of walk('src/client').filter((file) => file.endsWith('.js'))) {
  const text = readFileSync(join(root, rel), 'utf8')
  if (rel.endsWith('right-stack.js') || rel.endsWith('panel-rail.js')) continue
  if (text.includes("className: 'mv-right mv-dock") || text.includes('className: `mv-right mv-dock')) {
    fail(`${relative(root, join(root, rel))}: second right rail rendered`)
  }
}

if (problems.length) {
  console.error(`check-panels: ${problems.length} problem(s)`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('check-panels: single rail, 4 destinations, master-detail and persistence intact')
