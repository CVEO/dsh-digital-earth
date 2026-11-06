/**
 * v1.6 dialog render smoke — catches ReferenceError/TypeError that only happen when
 * a dialog is opened (the panel's main render never mounts them).
 *
 * The settings white screen was exactly this: SourcesDialog's Appearance tab used a
 * `field()` helper that only exists inside SourceForm, so clicking the gear threw
 * `ReferenceError: field is not defined` and React blanked the whole panel.
 *
 * This harness evaluates src/client/ui/dialogs.js without a bundler: imports are
 * stripped and the module factory receives the same tiny React/DOM stubs the panel
 * smoke test uses, then every dialog is rendered once.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readRepoFile } from './helpers/source.mjs'

function fakeReact() {
  return {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props ?? {}), children: children.length ? children : undefined },
    }),
    Fragment: Symbol('Fragment'),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useRef: (init) => ({ current: init }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    memo: (component) => component,
    forwardRef: (render) => render,
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value))
const FALLBACK_ABOUT = { version: '1.5.0', homepage: 'https://x', issues: 'https://x', team: { name: 'n', url: 'https://x' } }

function loadDialogs() {
  let source = readRepoFile('src/client/ui/dialogs.js')
  source = source.replace(/^import[^\n]*\n/gm, '')
  source = source.replace(/export \{([^}]*)\}/, 'return { $1 }')
  // eslint-disable-next-line no-new-func
  const factory = new Function('React', 'clone', 'FALLBACK_ABOUT', 'readAutoOpen', 'writeAutoOpen', source)
  return factory(fakeReact(), clone, FALLBACK_ABOUT, () => false, () => {})
}

const CONFIG = {
  imagery: [
    { id: 'xyz', name: 'XYZ', type: 'xyz', url: 'https://x/{z}/{x}/{y}.png', credit: '' },
    { id: 'arcgis', name: 'ArcGIS', type: 'arcgis', url: 'https://x/MapServer', credit: '' },
    { id: 'wms', name: 'WMS', type: 'wms', url: 'https://x/wms', layers: 'a', credit: '' },
  ],
  terrain: [
    { id: 'elev', name: 'Elev', type: 'arcgis', url: 'https://x/ImageServer', credit: '' },
    { id: 'cesium', name: 'Cesium', type: 'cesium', url: 'https://x/terrain', credit: '' },
  ],
  rasterOverlays: [],
  settings: {
    theme: 'auto',
    imagery: 'xyz',
    terrain: 'elev',
    screenshotHud: false,
    showLayers: false,
    showHud: true,
    quality: 'balanced',
    terrainDepthTest: false,
  },
}

/** Render a component tree once; any render-time exception reaches the test. */
function walk(element, depth = 0) {
  if (element === null || element === undefined || depth > 50) return 0
  if (typeof element !== 'object') return 1
  if (Array.isArray(element)) return element.reduce((sum, child) => sum + walk(child, depth + 1), 0)
  if (typeof element.type === 'function') return 1 + walk(element.type(element.props ?? {}), depth + 1)
  return 1 + walk(element.props?.children, depth + 1)
}

test('设置对话框可渲染（Appearance 的 quality 行曾经抛 field is not defined）', () => {
  const { SourcesDialog } = loadDialogs()
  const tree = fakeReact().createElement(SourcesDialog, {
    config: CONFIG,
    defaults: CONFIG,
    environmentDark: true,
    themeMode: 'auto',
    messages: (key) => key,
    meta: { version: '1.5.0', homepage: 'https://x', issues: 'https://x', team: { name: 'n', url: 'https://x' } },
    bridgeOn: true,
    bridgeReload: false,
    onPickLocal: () => {},
    onSave: () => {},
    onClose: () => {},
  })
  const rendered = walk(tree)
  assert.ok(rendered >= 5, `设置对话框渲染节点过少：${rendered}`)
  // 静态护栏：field 必须在 SourcesDialog 作用域内定义（SourceForm 里的同名 helper 不可见）。
  const start = readRepoFile('src/client/ui/dialogs.js').indexOf('function SourcesDialog(')
  const body = readRepoFile('src/client/ui/dialogs.js').slice(start, start + 12000)
  assert.match(body, /const field = \(label, input\) =>/)
})

test('设置对话框在极简/缺省配置下也不崩（空列表、缺 settings 字段）', () => {
  const { SourcesDialog } = loadDialogs()
  for (const config of [
    { imagery: [], terrain: [], settings: {} },
    { imagery: [], terrain: [], rasterOverlays: [], settings: { theme: 'dark', quality: 'high' } },
  ]) {
    const tree = fakeReact().createElement(SourcesDialog, {
      config,
      defaults: config,
      environmentDark: false,
      themeMode: 'dark',
      messages: (key) => key,
      meta: null,
      bridgeOn: false,
      bridgeReload: true,
      onPickLocal: () => {},
      onSave: () => {},
      onClose: () => {},
    })
    assert.ok(walk(tree) >= 5)
  }
})

test('数据源表单、健康检查、路径授权对话框都可渲染', () => {
  const { SourceForm, HealthDialog, PathAccessDialog } = loadDialogs()
  const t = (key) => key
  const forms = [
    ['imagery', CONFIG.imagery[0]],
    ['imagery', CONFIG.imagery[1]],
    ['imagery', CONFIG.imagery[2]],
    ['terrain', CONFIG.terrain[0]],
    ['terrain', CONFIG.terrain[1]],
  ]
  for (const [kind, source] of forms) {
    const tree = fakeReact().createElement(SourceForm, { kind, source, t, onPickLocal: () => {}, onChange: () => {}, onCancel: () => {} })
    assert.ok(walk(tree) >= 3, `${kind}/${source.type} 表单渲染失败`)
  }
  assert.ok(walk(fakeReact().createElement(HealthDialog, { state: null, messages: t, onClose: () => {}, onCopy: () => {} })) >= 3)
  assert.ok(
    walk(
      fakeReact().createElement(HealthDialog, {
        state: { report: { source: { kind: 'local', label: 'x' }, asset: { version: '1.0' }, counts: { tiles: 1, contents: 2, extensionsUsed: [] }, issues: [] } },
        messages: t,
        onClose: () => {},
        onCopy: () => {},
      }),
    ) >= 3,
  )
  assert.ok(
    walk(
      fakeReact().createElement(PathAccessDialog, {
        request: { kind: 'dir', path: 'C:/x', reason: 'r', token: 't' },
        busy: false,
        t,
        onAllow: () => {},
        onDeny: () => {},
      }),
    ) >= 3,
  )
})
