/**
 * v16 batch 17 — Phase 1 UI refactor tests.
 *
 * Covers L2 subaction bar & L4 collapsible imagery box in LayersSurface,
 * 2-column bento toolbox + index minimize/restore + ToolWindow zoom/restore
 * in ToolsPanel/ToolWindow, EffectsBody active layer list, and zh/en i18n parity.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { MESSAGES } = await import('../src/client/messages.js')
const { TOOLS_MINIMIZED_KEY, groupOpenKey, readPanelFlag, writePanelFlag } = await import(
  '../src/client/ui/panel-prefs.js'
)
const { selectToolWindow } = await import('../src/client/ui/tool-catalog.js')
const { LayersSurface } = await import('../src/client/ui/layers-surface.js')
const { RightStack } = await import('../src/client/ui/right-stack.js')
const { useToolWorkspace } = await import('../src/client/ui/tool-workspace.js')
const { ToolsPanel } = await import('../src/client/ui/tools-panel.js')
const { ToolWindow } = await import('../src/client/ui/tool-window.js')
const { EffectsBody } = await import('../src/client/ui/tool-windows.js')

const t = (key) => key

function withStorage(fn) {
  const store = new Map()
  const prev = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  try {
    return fn(store)
  } finally {
    if (prev === undefined) delete globalThis.localStorage
    else globalThis.localStorage = prev
  }
}

/**
 * Tiny recursive component renderer over the react-stub element tree so tests
 * can trigger click handlers and inspect re-rendered state without a full DOM.
 */
function createRenderer(rootFn, getProps) {
  const states = new Map()
  const refs = new Map()
  let rerender = null

  function renderComponent(Component, props, path) {
    let slot = 0
    const saved = {
      useState: React.useState,
      useRef: React.useRef,
      useCallback: React.useCallback,
      useMemo: React.useMemo,
      useEffect: React.useEffect,
    }
    React.useState = (initial) => {
      const key = `${path}#s${slot++}`
      if (!states.has(key)) {
        states.set(key, typeof initial === 'function' ? initial() : initial)
      }
      const setState = (next) => {
        const cur = states.get(key)
        states.set(key, typeof next === 'function' ? next(cur) : next)
        rerender?.()
      }
      return [states.get(key), setState]
    }
    React.useRef = (initial) => {
      const key = `${path}#r${slot++}`
      if (!refs.has(key)) refs.set(key, { current: initial })
      return refs.get(key)
    }
    React.useCallback = (fn) => fn
    React.useMemo = (fn) => fn()
    React.useEffect = () => {}
    try {
      return expand(Component(props), path)
    } finally {
      Object.assign(React, saved)
    }
  }

  function expand(node, path) {
    if (node == null || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map((item, idx) => expand(item, `${path}[${idx}]`))
    if (typeof node.type === 'function') {
      const props = { ...(node.props || {}), children: node.children }
      const name = node.type.name || 'Fn'
      return renderComponent(node.type, props, `${path}/${name}`)
    }
    if (node.type === React.Fragment) {
      return {
        type: 'fragment',
        props: node.props || {},
        children: (node.children || []).map((c, idx) => expand(c, `${path}.f${idx}`)),
      }
    }
    return {
      type: node.type,
      props: node.props || {},
      children: (node.children || []).map((c, idx) => expand(c, `${path}.${idx}`)),
    }
  }

  let tree = null
  rerender = () => {
    tree = renderComponent(rootFn, getProps(), 'root')
  }
  rerender()
  return {
    tree: () => tree,
    rerender,
  }
}

function findAll(node, predicate, acc = []) {
  if (!node || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const item of node) findAll(item, predicate, acc)
    return acc
  }
  if (predicate(node)) acc.push(node)
  if (Array.isArray(node.children)) {
    for (const child of node.children) findAll(child, predicate, acc)
  }
  return acc
}

function textOf(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.children)
}

function hasClass(node, cls) {
  return String(node?.props?.className || '')
    .split(/\s+/)
    .includes(cls)
}

test('selectToolWindow restores minimized active tool before toggling it closed', () => {
  assert.deepEqual(selectToolWindow({ openTool: null, minimized: false }, 'measure'), {
    openTool: 'measure',
    minimized: false,
  })
  // Re-clicking while minimized must un-minimize rather than close.
  assert.deepEqual(selectToolWindow({ openTool: 'measure', minimized: true }, 'measure'), {
    openTool: 'measure',
    minimized: false,
  })
  // Re-clicking while visible closes it.
  assert.deepEqual(selectToolWindow({ openTool: 'measure', minimized: false }, 'measure'), {
    openTool: null,
    minimized: false,
  })
  // Switching to another tool opens the new tool un-minimized.
  assert.deepEqual(selectToolWindow({ openTool: 'measure', minimized: true }, 'effects'), {
    openTool: 'effects',
    minimized: false,
  })
  // Unknown tool ID leaves state untouched.
  assert.deepEqual(selectToolWindow({ openTool: 'measure', minimized: true }, 'bogus'), {
    openTool: 'measure',
    minimized: true,
  })
})

test('TOOLS_MINIMIZED_KEY persists via readPanelFlag / writePanelFlag', () => {
  withStorage(() => {
    assert.equal(readPanelFlag(TOOLS_MINIMIZED_KEY, false), false)
    writePanelFlag(TOOLS_MINIMIZED_KEY, true)
    assert.equal(readPanelFlag(TOOLS_MINIMIZED_KEY, false), true)
    writePanelFlag(TOOLS_MINIMIZED_KEY, false)
    assert.equal(readPanelFlag(TOOLS_MINIMIZED_KEY, true), false)
  })
})

test('LayersSurface 按 矢量→栅格→影像→地形 分组，添加入口收进组头，影像底图默认折叠', () => {
  withStorage(() => {
    const addCalls = []
    const downloadCalls = []
    const renderer = createRenderer(LayersSurface, () => ({
      t,
      config: {
        imagery: [{ id: 'bing', name: 'Bing Aerial' }, { id: 'osm', name: 'OSM' }],
        terrain: [],
      },
      settings: { imagery: 'bing', imageryOpacity: 1 },
      onSelectImagery: () => {},
      importedOverlays: [{ kind: 'draw', origin: 'import', id: 'imp-1', index: 0, label: 'Parcel', detail: '' }],
      overlayDetails: { 0: [{ style: 'accent', name: 'Parcel A' }] },
      vectorExport: { canSend: () => true, download: () => downloadCalls.push('download'), send: () => {} },
      onAddLayer: (kind) => addCalls.push(kind),
      onClearImports: () => {},
    }))

    let root = renderer.tree()
    // 分组顺序固定：地表数据按绘制顺序 矢量图层 → 栅格图层 → 影像底图 → 地形。
    const groups = findAll(root, (n) => hasClass(n, 'mv-lgroup'))
    assert.deepEqual(
      groups.map((g) => g.props['data-group']),
      ['vector', 'raster', 'imagery', 'terrain'],
    )
    assert.deepEqual(
      groups.map((g) => textOf(findAll(g, (n) => hasClass(n, 'mv-group-title'))[0])),
      ['layers.vector', 'layers.raster', 'layers.imagery', 'layers.terrain'],
    )

    // 矢量组：行数在组头，导入 / 导出 / 清空都收进 .mv-group-actions。
    const vector = groups[0]
    assert.equal(textOf(findAll(vector, (n) => hasClass(n, 'mv-group-count'))[0]), '· 1')
    const actions = findAll(vector, (n) => hasClass(n, 'mv-group-actions'))
    assert.equal(actions.length, 1)
    const actionButtons = findAll(actions[0], (n) => n.type === 'button')
    const exportBtn = actionButtons.find((b) => b.props.title === 'layers.vectorExportHint')
    assert.ok(exportBtn, '导出按钮仍用 tooltip 解释导出范围')
    exportBtn.props.onClick()
    assert.deepEqual(downloadCalls, ['download'])
    const importBtn = actionButtons.find((b) => b.props.title === 'layers.importVector')
    assert.ok(importBtn, '导入矢量仍是组头里的显式入口（图标按钮带 tooltip）')
    importBtn.props.onClick()
    assert.deepEqual(addCalls, ['vector'])
    // 旧子操作条已删除：导入入口不再另起一行。
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-group-subactions')).length, 0)

    // 影像底图组默认折叠，只在组头提示当前底图；展开后才出现可选列表。
    let imagery = groups[2]
    assert.equal(hasClass(imagery, 'open'), false)
    assert.equal(findAll(imagery, (n) => hasClass(n, 'mv-lgroup-body')).length, 0)
    const hint = findAll(imagery, (n) => hasClass(n, 'mv-lgroup-hint'))[0]
    assert.ok(hint, '折叠时用一行提示说明当前底图')
    assert.ok(textOf(hint).includes('layers.imageryCurrent'))
    assert.ok(textOf(hint).includes('Bing Aerial'))
    assert.equal(textOf(findAll(imagery, (n) => hasClass(n, 'mv-group-count'))[0]), '· 2')

    const toggleBtn = findAll(imagery, (n) => hasClass(n, 'mv-group-toggle'))[0]
    assert.equal(toggleBtn.props['aria-expanded'], false)
    toggleBtn.props.onClick()

    root = renderer.tree()
    imagery = findAll(root, (n) => hasClass(n, 'mv-lgroup')).find((g) => g.props['data-group'] === 'imagery')
    assert.equal(hasClass(imagery, 'open'), true)
    assert.equal(findAll(imagery, (n) => hasClass(n, 'mv-lgroup-body')).length, 1)
    assert.equal(readPanelFlag(groupOpenKey('imagery'), false), true)
    assert.equal(findAll(imagery, (n) => hasClass(n, 'mv-lgroup-hint')).length, 0, '展开后不再重复提示')
    const choices = findAll(imagery, (n) => hasClass(n, 'mv-choice'))
    assert.deepEqual(
      choices.map((choice) => textOf(findAll(choice, (n) => hasClass(n, 'mv-row-name'))[0])),
      ['menu.none', 'Bing Aerial', 'OSM'],
    )
  })
})

test('RightStack + ToolsPanel opens a tool window as a docked tab and keeps index minimize/active pill', () => {
  withStorage(() => {
    // v1.6.3 removes free floating: a tool window is always a dock tab, never a
    // window that can be zoomed/minimized outside the dock.
    let shaderOpened = 0
    const Host = (props) => {
      const ws = useToolWorkspace()
      return React.createElement(RightStack, {
        t,
        showTools: true,
        openWindows: ws.windows,
        onSelectTool: ws.selectTool,
        onCloseToolWindow: ws.closeTool,
        onToggleMinimizeTool: ws.toggleMinimize,
        onToggleExpandTool: ws.toggleExpand,
        toolsPanel: props,
      })
    }
    const renderer = createRenderer(Host, () => ({
      t,
      tool: null,
      analysis: null,
      shaderActive: [{ layerId: 'l1', layer: 'Campus Tiles', presets: ['edge', 'ao'] }],
      onStartTool: () => {},
      onClearMeasure: () => {},
      onStartProfile: () => {},
      onClearAnalysis: () => {},
      onOpenShader: () => { shaderOpened++ },
      onFlyView: () => {},
      onStartTour: () => {},
      getCurrentView: () => null,
      getCesium: () => null,
      getViewer: () => null,
      getLayers: () => [],
      onStartParse: () => {},
      onStartAnnotation: () => {},
      selectState: null,
      onSelectionChange: () => {},
      onAskSelection: () => {},
    }))

    let root = renderer.tree()
    // 1. v1.6.4: "Visual effects" opens the workbench directly; it must not stop
    // at a master-detail page whose only action is another "open" button.
    const entries = findAll(root, (n) => hasClass(n, 'mv-tool-entry'))
    const effectsBtn = entries.find((n) => textOf(n).includes('tools.effects'))
    assert.ok(effectsBtn)
    effectsBtn.props.onClick()

    root = renderer.tree()
    assert.equal(shaderOpened, 1, '点击视觉特效直接打开工作台')
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-toolwin')).length, 0, '不再进入二次打开页')

    // 2. The rail keeps only icons now; the accessible name still carries the
    // destination, so screen readers do not lose the label removed as duplicate.
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-dock-tab')).length, 0, '页签条已合并进顶栏，不再重复一层导航')
    // v1.6.5: the destination's name moved to the console header (TopBar), so the
    // dock exposes it through the visible tabpanel's aria-label instead of a
    // second title row.
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-dock-head')).length, 0, '面板内不再有第二行标题')
    const visiblePanel = findAll(root, (n) => n?.props?.role === 'tabpanel' && !n.props.hidden)[0]
    assert.equal(visiblePanel?.props?.['aria-label'], 'panel.tab.tools')
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-panel-back')).length, 0)
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-dock-tab-close')).length, 0)
  })
})

test('ToolWindow passes through EffectsBody empty hint when no shader layers active', () => {
  const tree = ToolWindow({
    t,
    entry: { id: 'effects', labelKey: 'tools.effects', icon: 'effects' },
    onToggleMinimize: () => {},
    onToggleExpand: () => {},
    onClose: () => {},
    children: EffectsBody({ t, shaderActive: [], onOpenShader: () => {} }),
  })
  assert.ok(textOf(tree).includes('tools.effectsEmpty'))
})

test('Phase 1 zh/en i18n keys are defined cleanly', () => {
  const keys = [
    'tools.windowZoom',
    'tools.windowRestore',
    'tools.indexMinimize',
    'tools.indexExpand',
    'layers.exportVector',
    'layers.vectorToChat',
    'layers.vectorExportHint',
    // v1.8：组的折叠标题与“当前底图”提示取代了旧的影像折叠说明。
    'layers.groupCollapse',
    'layers.groupExpand',
    'layers.imageryCurrent',
  ]
  for (const key of keys) {
    assert.ok(typeof MESSAGES.zh[key] === 'string' && MESSAGES.zh[key].length > 0, `missing zh key ${key}`)
    assert.ok(typeof MESSAGES.en[key] === 'string' && MESSAGES.en[key].length > 0, `missing en key ${key}`)
  }
})
