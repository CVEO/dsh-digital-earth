/**
 * scripts/check-a11y.mjs — interaction-accessibility gate.
 *
 * These are the invariants the panel keeps getting wrong when a new surface is
 * added, so they are checked mechanically instead of trusted to review:
 *
 *   1. no blocking `window.confirm/prompt/alert` (they steal host focus);
 *   2. modal surfaces carry `role="dialog"` + `aria-modal` and use the shared
 *      `useDialogA11y` hook for the focus trap / Escape / focus restore;
 *   3. transient feedback (toast) is announced with `role="status"` + `aria-live`;
 *   4. menus expose `role="menu"` and menu items are real buttons;
 *   5. the keyboard focus ring exists for the core controls;
 *   6. the right dock has one navigation level (no duplicate tab strip).
 *
 * Run: node scripts/check-a11y.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const clientDir = join(root, 'src/client')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

const files = walk(clientDir).map((file) => ({
  rel: relative(root, file).replaceAll('\\', '/'),
  text: readFileSync(file, 'utf8'),
}))
const problems = []

// 1) Blocking native dialogs have no place inside the embedded panel.
for (const file of files) {
  for (const match of file.text.matchAll(/\bwindow\.(confirm|prompt|alert)\s*\(/g)) {
    problems.push(`${file.rel} calls window.${match[1]}() — use the panel dialog instead`)
  }
}

// 2) Every modal dialog body must be marked and must use the shared a11y hook.
const dialogs = files.filter((file) => file.rel.includes('/ui/dialogs.js') || file.rel.includes('/ui/confirm-dialog.js'))
const allText = files.map((file) => file.text).join('\n')
const dialogBodies = allText.match(/role: 'dialog'/g) ?? []
if (dialogBodies.length === 0) problems.push('no role=dialog surface found in src/client')
if (!allText.includes("import { useDialogA11y } from './use-dialog-a11y.js'")) {
  problems.push('the shared useDialogA11y hook is not imported by any dialog module')
}
for (const file of dialogs) {
  const bodies = file.text.match(/role: 'dialog'/g) ?? []
  const modals = file.text.match(/'aria-modal':\s*'?true'?/g) ?? []
  if (bodies.length !== modals.length) {
    problems.push(`${file.rel}: ${bodies.length} role=dialog vs ${modals.length} aria-modal`)
  }
  if (bodies.length > 0 && !file.text.includes('useDialogA11y')) {
    problems.push(`${file.rel}: dialog does not use useDialogA11y (focus trap/Escape/restore)`)
  }
}

// 3) Toast announcements.
if (!/role: 'status'[^}]*'aria-live': 'polite'/.test(allText.replace(/\n/g, ' '))) {
  problems.push('the toast is not announced (role="status" + aria-live="polite")')
}

// 4) Menus.
if (!allText.includes("role: 'menu'")) problems.push('no role=menu surface found')
const menuOwners = files.filter((file) => file.text.includes("role: 'menu'"))
for (const file of menuOwners) {
  if (!file.text.includes('MenuItem') && !file.text.includes("role: 'menuitem'")) {
    problems.push(`${file.rel}: role=menu surface has no menu items`)
  }
}

// 5) One navigation level: the toolbar quick group switches destinations, so
// the dock body must not repeat it as a tablist or offer a second collapse
// action; hiding the whole console is the chrome control. It keeps exactly one
// visible tabpanel, each panel named.
const dockSource = files.find((file) => file.rel.endsWith('/ui/panel-rail.js'))?.text ?? ''
for (const marker of ["role: 'tabpanel'", "'aria-label': tabLabel(t, panel.id)", 'mv-dock-body']) {
  if (!dockSource.includes(marker)) problems.push(`right dock misses ${marker}`)
}
if (dockSource.includes("role: 'tablist'") || dockSource.includes("role: 'tab'")) {
  problems.push('right dock still renders a second tab navigation; the topbar quick group is the only switcher')
}
if (dockSource.includes("dock.collapse")) {
  problems.push('right dock must not keep a panel-only collapse control')
}
if ((dockSource.match(/role: 'tabpanel'/g) ?? []).length !== 1) {
  problems.push('right dock must render one tabpanel template')
}

// 6) Resize separators announce their current value and range.
const resizableSource = files.find((file) => file.rel.endsWith('/ui/resizable.js'))?.text ?? ''
for (const marker of ["role: 'separator'", "'aria-valuemin'", "'aria-valuemax'", "'aria-valuenow'"]) {
  if (!resizableSource.includes(marker)) problems.push(`resize handle misses ${marker}`)
}

// 7) Escape is owned by one stack module; dialogs keep their capture hook.
if (!files.some((file) => file.rel.endsWith('/ui/escape-stack.js'))) problems.push('the shared escape stack is missing')

// 8) Focus rings for the core controls.
const css = readFileSync(join(clientDir, 'ui/css.js'), 'utf8')
for (const selector of ['.mv-btn:focus-visible', '.mv-icon-btn:focus-visible']) {
  if (!css.includes(selector)) problems.push(`css.js misses ${selector}`)
}

if (problems.length > 0) {
  console.error(`a11y gate failed: ${problems.length} problem(s)`)
  for (const problem of problems.slice(0, 40)) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(`a11y: ${dialogBodies.length} dialog surfaces, toast + menus announced, focus rings present`)
