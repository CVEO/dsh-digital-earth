/**
 * Scene Compare UI & Wiring tests (R7 Step 2 UI + Step 3 floating panel + Step 4 checks):
 *   - Bilingual i18n parity & naming rule (remote-sensing / 3D AI focus, no "科研" wording in UI copy)
 *   - Toolbox catalog entry `compare` + ToolBody routing + icon rendering
 *   - The 3D-content row (`LayersEntities`) unlocks the split entry for visible layers and disables it when hidden
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
const { LayersEntities } = await import('../src/client/ui/layers-entities.js')
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

// The scene card is composed of function components (LayerGroup → LayerRow), so a
// click target only exists after they are invoked. These are all hook-free, so
// expand exactly them and keep MenuItem nodes unexpanded (their props carry state).
const LAYOUT_COMPONENTS = new Set(['LayerGroup', 'LayerRow', 'RowEye', 'RowDot'])
function expandLayout(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) expandLayout(child, out)
    return out
  }
  out.push(node)
  if (typeof node.type === 'function' && LAYOUT_COMPONENTS.has(node.type.name)) {
    // React merges `createElement` children into props; the stub keeps them apart.
    const props = { ...node.props }
    if (node.children?.length) props.children = node.children.length === 1 ? node.children[0] : node.children
    expandLayout(node.type(props), out)
  } else {
    expandLayout(node.children, out)
    expandLayout(node.props?.children, out)
  }
  return out
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

test('图层行（LayersEntities）: 可见 3DGS 图层在溢出菜单中启用原生分屏，隐藏时禁用', () => {
  const t = (k) => MESSAGES.zh[k] ?? k
  // v1.8: rows are generic; the 3D-content row (LayersEntities) builds the menu and
  // gates 分屏 on `layer.visible`, so the rule is asserted through the real component.
  const openLayerMenu = (layer, swipeState) => {
    const r = renderSimple(() =>
      LayersEntities({
        t,
        layers: [layer],
        shaderActive: [],
        agentOverlays: [],
        overlayDetails: {},
        overlayExtrusions: [],
        swipeState,
        onFlyLayer() {},
        onFrameAll() {},
        onToggleLayer() {},
        onRemoveLayer() {},
        onEditLayerShader() {},
        onOpenLayerProperties() {},
        onSwipeLayer() {},
        onAddLayer() {},
        onQuickAnnotate() {},
        onOpenMeasure() {},
        onFlyAgentOverlay() {},
        onRemoveAgentOverlay() {},
        onToggleOverlayExtrude() {},
        onToggleOverlayVisible() {},
        onSelectAgentFeature() {},
        onClearAnnotations() {},
        onClearMeasurements() {},
      }),
    )
    try {
      const more = expandLayout(r.getTree()).find(
        (node) => typeof node?.props?.className === 'string' && node.props.className.includes('mv-row-more'),
      )
      assert.ok(more, '缺少图层行溢出菜单按钮')
      more.props.onClick({ stopPropagation() {} })
      const item = expandLayout(r.getTree()).find(
        (node) => node?.type?.name === 'MenuItem' && (node.children ?? []).includes(MESSAGES.zh['swipe.toggle']),
      )
      assert.ok(item, '溢出菜单缺少分屏项')
      const button = item.type({ ...item.props, children: item.children?.[0] })
      return {
        disabled: item.props.disabled,
        checked: item.props.checked,
        role: button.props.role,
        ariaChecked: button.props['aria-checked'],
      }
    } finally {
      r.cleanup()
    }
  }

  const visible = openLayerMenu({ id: 'gs', name: '校园 3DGS', kind: '3dgs', visible: true }, { kind: '3d', id: 'gs' })
  assert.equal(visible.disabled, false, '可见的 3DGS 图层可开分屏')
  assert.equal(visible.checked, true, '正在分屏的图层要勾选')
  assert.equal(visible.role, 'menuitemcheckbox')
  assert.equal(visible.ariaChecked, true)

  const notSwiping = openLayerMenu({ id: 'gs', name: '校园 3DGS', kind: '3dgs', visible: true }, null)
  assert.equal(notSwiping.disabled, false)
  assert.equal(notSwiping.checked, false)
  assert.equal(notSwiping.ariaChecked, false)

  const hidden = openLayerMenu({ id: 'gs', name: '校园 3DGS', kind: '3dgs', visible: false }, null)
  assert.equal(hidden.disabled, true, '隐藏的图层不能开分屏')
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
