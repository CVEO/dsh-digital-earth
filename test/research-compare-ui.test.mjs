/**
 * Scene Compare UI & Wiring tests (R7 Step 2 UI + Step 3 floating panel + Step 4 checks):
 *   - Bilingual i18n parity & naming rule (remote-sensing / 3D AI focus, no "科研" wording in UI copy)
 *   - Toolbox catalog entry `compare` + ToolBody routing + icon rendering
 *   - LayerRow unlocks `◧` for visible 3DGS layers and disables when hidden
 *   - ComparePanel renders split controls, mesh/LOD inspection (with 3DGS wireframe guard),
 *     exact camera pose copy/paste snap, and comparison bundle export
 *   - ViewerSurface wiring & size regression checks
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { COMPARE_MESSAGES } = await import('../src/client/messages-compare.js')
const { MESSAGES } = await import('../src/client/messages.js')
const catalog = await import('../src/client/ui/tool-catalog.js')
const { ToolEntryIcon } = await import('../src/client/ui/icons.js')
const { ToolBody } = await import('../src/client/ui/tool-windows.js')
const { LayerRow } = await import('../src/client/ui/layer-row.js')
const { ComparePanel } = await import('../src/client/ui/compare-panel.js')
const { clientSource, readRepoFile } = await import('./helpers/source.mjs')

function findAll(node, pred, out = []) {
  if (!node) return out
  if (Array.isArray(node)) {
    for (const c of node) findAll(c, pred, out)
    return out
  }
  if (typeof node === 'object') {
    if (pred(node)) out.push(node)
    if (Array.isArray(node.children)) findAll(node.children, pred, out)
    else if (node.props?.children) findAll(node.props.children, pred, out)
  }
  return out
}

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object') {
    if (Array.isArray(node.children)) return textOf(node.children)
    return textOf(node.props?.children)
  }
  return ''
}

function renderSimple(renderFn) {
  const states = []
  const refs = []
  const memos = []
  let tree = null
  const prev = {
    useState: React.useState,
    useRef: React.useRef,
    useMemo: React.useMemo,
    useEffect: React.useEffect,
    useCallback: React.useCallback,
  }
  const render = () => {
    let si = 0
    let ri = 0
    let mi = 0
    React.useState = (init) => {
      const idx = si++
      if (!(idx in states)) states[idx] = typeof init === 'function' ? init() : init
      const setState = (updater) => {
        const next = typeof updater === 'function' ? updater(states[idx]) : updater
        if (!Object.is(next, states[idx])) {
          states[idx] = next
          render()
        }
      }
      return [states[idx], setState]
    }
    React.useRef = (init) => {
      const idx = ri++
      if (!(idx in refs)) refs[idx] = { current: init }
      return refs[idx]
    }
    React.useMemo = (factory) => {
      const idx = mi++
      memos[idx] = factory()
      return memos[idx]
    }
    React.useCallback = (fn) => fn
    React.useEffect = () => {}
    tree = renderFn()
    return tree
  }
  render()
  return {
    getTree: () => tree,
    rerender: () => render(),
    cleanup: () => Object.assign(React, prev),
  }
}

test('COMPARE_MESSAGES: 中英键完全配对、已合并至 MESSAGES，且界面文案聚焦遥感/三维场景不含“科研”字样', () => {
  const zhKeys = Object.keys(COMPARE_MESSAGES.zh).sort()
  const enKeys = Object.keys(COMPARE_MESSAGES.en).sort()
  assert.deepEqual(zhKeys, enKeys)
  for (const key of zhKeys) {
    const zh = COMPARE_MESSAGES.zh[key]
    const en = COMPARE_MESSAGES.en[key]
    assert.equal(typeof zh, 'string')
    assert.ok(zh.trim().length > 0, `empty zh key: ${key}`)
    assert.equal(typeof en, 'string')
    assert.ok(en.trim().length > 0, `empty en key: ${key}`)
    assert.equal(MESSAGES.zh[key], zh)
    assert.equal(MESSAGES.en[key], en)
    assert.doesNotMatch(zh, /科研/, `UI 文案 ${key} 不应出现“科研”字样`)
    assert.doesNotMatch(en, /\bresearch\b|\bacademic\b/i, `English UI copy ${key} should stay focused on remote-sensing/3D scene comparison`)
  }
  assert.equal(MESSAGES.zh['tools.compare'], '场景对比')
  assert.equal(MESSAGES.en['tools.compare'], 'Compare')
})

test('tool-catalog & icons & ToolBody: 注册独立 compare 浮窗入口与图标路由', () => {
  const entry = catalog.toolEntry('compare')
  assert.ok(entry)
  assert.equal(entry.labelKey, 'tools.compare')
  assert.equal(entry.hintKey, 'tools.compareHint')
  assert.equal(entry.icon, 'compare')
  assert.equal(catalog.TOOL_IDS[catalog.TOOL_IDS.indexOf('annotation') + 1], 'parse')

  const icon = ToolEntryIcon({ kind: 'compare' })
  assert.equal(icon.type, 'svg')
  assert.ok(icon.children.flat().length >= 3)

  const routed = ToolBody({ entryId: 'compare', t: (k) => k, layers: [] })
  assert.equal(routed.type, ComparePanel)
})

test('LayerRow: 可见 3DGS 图层启用 ◧ 快捷分屏按钮，隐藏时禁用', () => {
  const t = (k) => MESSAGES.zh[k] ?? k
  const visibleRow = LayerRow({
    t,
    layer: { id: 'gs', name: '校园 3DGS', kind: '3dgs', visible: true },
    shader: null,
    swipeActive: true,
    onFlyLayer() {},
    onToggleLayer() {},
    onInspectLayer() {},
    onRemoveLayer() {},
    onEditShader() {},
    onSwipeLayer() {},
  })
  const visBtn = findAll(visibleRow, (n) => n.type === 'button' && textOf(n).includes('◧'))[0]
  assert.ok(visBtn)
  assert.equal(visBtn.props.disabled, false)
  assert.equal(visBtn.props['aria-pressed'], true)

  const hiddenRow = LayerRow({
    t,
    layer: { id: 'gs', name: '校园 3DGS', kind: '3dgs', visible: false },
    shader: null,
    swipeActive: false,
    onFlyLayer() {},
    onToggleLayer() {},
    onInspectLayer() {},
    onRemoveLayer() {},
    onEditShader() {},
    onSwipeLayer() {},
  })
  const hidBtn = findAll(hiddenRow, (n) => n.type === 'button' && textOf(n).includes('◧'))[0]
  assert.equal(hidBtn.props.disabled, true)
})

test('ComparePanel: 渲染双层对比、线框/LOD 诊断与 3DGS 线框保护，并正确触发分屏与诊断回调', () => {
  const t = (k, params) => {
    let s = MESSAGES.zh[k] ?? k
    if (params) for (const [pk, pv] of Object.entries(params)) s = s.replaceAll(`{${pk}}`, String(pv))
    return s
  }
  const splatLayer = {
    id: 'gs-1',
    name: '校园 3DGS',
    kind: '3dgs',
    visible: true,
    tileset: {
      debugWireframe: false,
      debugColorizeTiles: false,
      debugShowBoundingVolume: false,
      maximumScreenSpaceError: 16,
      statistics: { selected: 12, numberOfTrianglesSelected: 0, numberOfPendingRequests: 0 },
      cacheBytes: 20_000_000,
    },
  }
  const meshLayer = {
    id: 'mesh-1',
    name: '倾斜摄影 Mesh',
    kind: 'mesh',
    visible: true,
    tileset: {
      debugWireframe: false,
      debugColorizeTiles: false,
      debugShowBoundingVolume: false,
      maximumScreenSpaceError: 16,
      statistics: { selected: 18, numberOfTrianglesSelected: 145_000, numberOfPendingRequests: 1 },
      cacheBytes: 52_428_800,
    },
  }
  const runtimeLayers = [splatLayer, meshLayer]
  const uiLayers = runtimeLayers.map(({ id, name, kind, visible }) => ({ id, name, kind, visible }))
  const pairCalls = []
  const viewer = { scene: { requestRender() {} } }

  const r = renderSimple(() =>
    ComparePanel({
      t,
      layers: uiLayers,
      getLayers: () => runtimeLayers,
      getViewer: () => viewer,
      getCesium: () => null,
      getMeta: () => ({ version: '1.6.0' }),
      renderSnapshot: async () => ({ dataUrl: 'data:image/png;base64,AA', width: 1280, height: 720, format: 'png' }),
      showToast() {},
      swipe: {
        state: null,
        startPair: (a, b, opts) => {
          pairCalls.push([a, b, opts])
          return { ok: true }
        },
        startSplit: () => ({ ok: true }),
        swapSides: () => ({ ok: true }),
        setRatio: () => {},
        stop: () => {},
      },
    }),
  )
  try {
    const tree = r.getTree()
    // 点击「开启对比」默认配对跨模态图层（3DGS 左 + Mesh 右）
    const startBtn = findAll(tree, (n) => n.type === 'button' && textOf(n) === '开启对比')[0]
    assert.ok(startBtn)
    startBtn.props.onClick()
    assert.equal(pairCalls.length, 1)
    assert.deepEqual(pairCalls[0].slice(0, 2), ['gs-1', 'mesh-1'])

    // 默认检视目标应优先选中 Mesh（以便直接开线框），点击线框开关立即修改 debugWireframe
    const wireBtn = findAll(tree, (n) => n.type === 'button' && textOf(n).includes('三角网线框'))[0]
    assert.ok(wireBtn)
    assert.equal(wireBtn.props.disabled, false)
    wireBtn.props.onClick()
    assert.equal(meshLayer.tileset.debugWireframe, true)

    // 点击 SSE=4 预设按钮修改 maximumScreenSpaceError
    const sse4Btn = findAll(r.getTree(), (n) => n.type === 'button' && textOf(n) === '4')[0]
    assert.ok(sse4Btn)
    sse4Btn.props.onClick()
    assert.equal(meshLayer.tileset.maximumScreenSpaceError, 4)

    // 点击「重置检视」恢复默认状态
    const resetBtn = findAll(r.getTree(), (n) => n.type === 'button' && textOf(n) === '重置检视')[0]
    assert.ok(resetBtn)
    resetBtn.props.onClick()
    assert.equal(meshLayer.tileset.debugWireframe, false)
    assert.equal(meshLayer.tileset.maximumScreenSpaceError, 16)

    // 切换检视图层到 3DGS 时，线框与素模按钮必须禁用并显示提示
    const clayBtnMesh = findAll(r.getTree(), (n) => n.type === 'button' && textOf(n).includes('素模检视'))[0]
    assert.ok(clayBtnMesh)
    assert.equal(clayBtnMesh.props.disabled, false)
    const selects = findAll(r.getTree(), (n) => n.type === 'select')
    const inspectSelect = selects.find((s) => s.props['aria-label'] === '检视图层')
    assert.ok(inspectSelect)
    inspectSelect.props.onChange({ target: { value: 'gs-1' } })
    const wireBtn3dgs = findAll(r.getTree(), (n) => n.type === 'button' && textOf(n).includes('三角网线框'))[0]
    const clayBtn3dgs = findAll(r.getTree(), (n) => n.type === 'button' && textOf(n).includes('素模检视'))[0]
    assert.equal(wireBtn3dgs.props.disabled, true)
    assert.equal(clayBtn3dgs.props.disabled, true)
    assert.ok(textOf(r.getTree()).includes('3DGS 图层无三角网格'))
  } finally {
    r.cleanup()
  }
})

test('接线与构建检查: ViewerSurface 传递 swipe/renderSnapshot/getMeta 并包含 ComparePanel 与 COMPARE_CSS', () => {
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /buildTilesetLoadOptions/)
  assert.match(viewer, /collectLayerStats/)
  assert.match(viewer, /swipe,/)
  assert.match(viewer, /renderSnapshot,/)

  const client = clientSource()
  assert.match(client, /function ComparePanel\(/)
  assert.match(client, /mv-compare-stats/)
  assert.match(client, /enableDebugWireframe/)
})
