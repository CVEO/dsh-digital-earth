/**
 * v1.9 chrome shell: merged toolbar + dock, one hide action, no brand card.
 *
 * The layout itself is verified with real-browser screenshots; these checks pin
 * the contracts that are cheap to regress: the single shell markup, the keyboard
 * gate, the seam CSS and the copy shown in the View menu.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import test from 'node:test'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const { isChromeShortcut } = await import('../src/client/ui/chrome-visibility.js')
const { MESSAGES } = await import('../src/client/messages.js')

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('H toggles the chrome, but typing and open dialogs keep the key', () => {
  assert.equal(isChromeShortcut({ key: 'h' }), true)
  assert.equal(isChromeShortcut({ key: 'H' }), true)
  assert.equal(isChromeShortcut({ key: 'h', ctrlKey: true }), false)
  assert.equal(isChromeShortcut({ key: 'h', altKey: true }), false)
  assert.equal(isChromeShortcut({ key: 'x' }), false)
  assert.equal(isChromeShortcut({ key: 'h', defaultPrevented: true }), false)
  assert.equal(
    isChromeShortcut({ key: 'h' }, { closest: (selector) => (selector.includes('input') ? {} : null) }),
    false,
  )
  assert.equal(isChromeShortcut({ key: 'h' }, null, true), false)
})

test('one shell contains TopBar + RightStack; hide handle and live status stay outside', () => {
  const surface = read('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /import \{ ChromeA11y, ChromeShell, useChromeVisibility \}/)
  assert.match(surface, /const \[chromeHidden, toggleChrome\] = useChromeVisibility\(\)/)
  assert.match(surface, /h\(ChromeShell, \{ key: 'chrome', hidden: chromeHidden \}/)
  assert.match(surface, /h\(ChromeA11y, \{ key: 'chrome-a11y'/)
  assert.doesNotMatch(surface, /mv-brand/)
  assert.match(surface, /mv-chrome-hidden/)
})

test('scene overlays stay outside the chrome shell (identify card uses scene pixels)', () => {
  const surface = read('src/client/viewer/ViewerSurface.js')
  const shell = surface.indexOf("h(ChromeShell")
  const topbar = surface.indexOf("h(TopBar", shell)
  const dock = surface.indexOf("h(RightStack", topbar)
  const shellClose = surface.indexOf('\n        ),\n        urlBar', dock)
  const selection = surface.indexOf("h(SelectionOverlay", dock)
  assert.ok(shell >= 0 && topbar > shell && dock > topbar && shellClose > dock, 'shell must contain TopBar then RightStack')
  assert.ok(selection > shellClose, 'SelectionOverlay must be a scene sibling, not a child of the right console')
})

test('toolbar loses the brand card and exposes the hide action + shortcut hint', () => {
  const topbar = read('src/client/ui/topbar.js')
  assert.doesNotMatch(topbar, /mv-brand|ViewerIcon/)
  assert.match(topbar, /mv-chrome-hide/)
  assert.match(topbar, /'aria-keyshortcuts': 'H'/)
  assert.match(topbar, /onToggleChrome/)
  const view = read('src/client/ui/toolbar-view.js')
  assert.match(view, /key: 'hideChrome'/)
  assert.match(view, /hint: 'H'/)
  assert.match(view, /t\('dock\.hideChrome'\)/)
})

test('CSS makes the toolbar and dock one surface with one border and shadow', () => {
  const css = read('src/client/ui/css.js')
  assert.match(css, /\.mv-chrome\{[^}]*background:var\(--mv-glass\)[^}]*border:\.5px solid var\(--mv-line\)[^}]*border-radius:14px[^}]*box-shadow/)
  assert.match(css, /\.mv-top\{[^}]*border-bottom:\.5px solid var\(--mv-line\)/)
  assert.doesNotMatch(css, /\.mv-chrome\.is-flush/)
  assert.match(css, /\.mv-right\{[^}]*background:transparent[^}]*border:0/)
  assert.match(css, /\.mv-top \.mv-btn-label\{display:none\}/)
  assert.match(css, /\.mv-chrome \.mv-right\{max-width:100%\}/)
  assert.match(css, /\.mv-chrome-reveal\{/)
  assert.doesNotMatch(css, /\.mv-brand/)
})

test('copy exists in both locales and says hide / show interface', () => {
  for (const locale of ['zh', 'en']) {
    assert.equal(typeof MESSAGES[locale]['dock.hideChrome'], 'string')
    assert.equal(typeof MESSAGES[locale]['dock.showChrome'], 'string')
  }
  assert.equal(MESSAGES.zh['dock.hideChrome'], '隐藏界面')
  assert.equal(MESSAGES.zh['dock.showChrome'], '显示界面')
})
