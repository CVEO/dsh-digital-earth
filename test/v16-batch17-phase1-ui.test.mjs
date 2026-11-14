/**
 * v16 batch 17 — Phase 1 UI refactor tests.
 *
 * Covers L2 subaction bar & L4 collapsible imagery box in LayersMap,
 * 2-column bento toolbox + index minimize/restore + ToolWindow zoom/restore
 * in ToolsPanel/ToolWindow, EffectsBody active layer list, and zh/en i18n parity.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { MESSAGES } = await import('../src/client/messages.js')
const { TOOLS_MINIMIZED_KEY, IMAGERY_OPEN_KEY, readPanelFlag, writePanelFlag } = await import(
  '../src/client/ui/panel-prefs.js'
)
const { selectToolWindow } = await import('../src/client/ui/tool-catalog.js')
const { LayersMap } = await import('../src/client/ui/layers-map.js')
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

test('LayersMap separates vector import CTA into subaction bar and wraps imagery in collapsible mv-fold-box', () => {
  withStorage(() => {
    const renderer = createRenderer(LayersMap, () => ({
      t,
      config: { imagery: [{ id: 'bing', label: 'Bing Aerial' }, { id: 'osm', label: 'OSM' }] },
      settings: { imagery: 'bing', imageryOpacity: 1 },
      onSelectImagery: () => {},
      onOverlayAdd: () => {},
      onOverlayRemove: () => {},
      onOverlayOpacity: () => {},
      onOverlayVisible: () => {},
      onOverlayMove: () => {},
      agentOverlays: [{ kind: 'draw', index: 0, label: 'Parcel' }],
      annotations: { drawn_features: 1, measured_points: 0 },
      onClearVector: () => {},
      onRemoveAgentOverlay: () => {},
      onFlyAgentOverlay: () => {},
      onImportVector: () => {},
      onPickLocalTiles: () => {},
      swipeState: null,
      onOverlaySwipe: () => {},
      vectorExport: { canSend: () => true, download: () => {}, send: () => {} },
    }))

    let root = renderer.tree()
    // Export action buttons stay in g2 mv-group-actions; import CTA sits in .mv-group-subactions.
    const groups = findAll(root, (n) => hasClass(n, 'mv-group'))
    const g2 = groups[0]
    assert.ok(textOf(g2).includes('layers.vector · 1'))
    const g2ActionButtons = findAll(g2, (n) => n.type === 'button')
    assert.equal(g2ActionButtons.length, 2)
    assert.equal(g2ActionButtons[0].props.title, 'layers.vectorExportHint')
    assert.equal(g2ActionButtons[1].props.title, 'layers.vectorChatHint')

    const subactions = findAll(root, (n) => hasClass(n, 'mv-group-subactions'))
    assert.equal(subactions.length, 1)
    assert.ok(textOf(subactions[0]).includes('layers.importVector'))

    // L4 imagery box starts collapsed (closed mv-fold-box, no mv-fold-body).
    let foldBoxes = findAll(root, (n) => hasClass(n, 'mv-fold-box'))
    assert.equal(foldBoxes.length, 1)
    assert.equal(hasClass(foldBoxes[0], 'open'), false)
    assert.equal(findAll(foldBoxes[0], (n) => hasClass(n, 'mv-fold-body')).length, 0)

    const toggleBtn = findAll(foldBoxes[0], (n) => hasClass(n, 'mv-group-toggle'))[0]
    assert.equal(toggleBtn.props['aria-expanded'], false)
    toggleBtn.props.onClick()

    root = renderer.tree()
    foldBoxes = findAll(root, (n) => hasClass(n, 'mv-fold-box'))
    assert.equal(hasClass(foldBoxes[0], 'open'), true)
    assert.equal(findAll(foldBoxes[0], (n) => hasClass(n, 'mv-fold-body')).length, 1)
    assert.equal(readPanelFlag(IMAGERY_OPEN_KEY, false), true)
  })
})

test('RightStack + ToolsPanel supports index minimize + active pill and ToolWindow zoom/minimize/restore', () => {
  withStorage(() => {
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
      onOpenShader: () => {},
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
    // 1. Open 'effects' tool window from index grid.
    const entries = findAll(root, (n) => hasClass(n, 'mv-tool-entry'))
    const effectsBtn = entries.find((n) => textOf(n).includes('tools.effects'))
    assert.ok(effectsBtn)
    effectsBtn.props.onClick()

    root = renderer.tree()
    const win = findAll(root, (n) => hasClass(n, 'mv-toolwin'))[0]
    assert.ok(win)
    assert.ok(findAll(win, (n) => hasClass(n, 'mv-toolwin-badge')).length === 1)
    assert.ok(findAll(win, (n) => hasClass(n, 'mv-tool-effects-list')).length === 1)
    assert.ok(textOf(win).includes('Campus Tiles'))
    assert.ok(textOf(win).includes('edge + ao'))

    // 2. Toggle zoom (expand) on ToolWindow header -> switches to tools.windowRestore & 480px height.
    const zoomBtn = findAll(win, (n) => n.type === 'button' && n.props.title === 'tools.windowZoom')[0]
    assert.ok(zoomBtn)
    assert.equal(zoomBtn.props['aria-pressed'], false)
    zoomBtn.props.onClick()

    root = renderer.tree()
    const zoomedWin = findAll(root, (n) => hasClass(n, 'mv-toolwin'))[0]
    assert.equal(zoomedWin.props.style.height, 'min(480px, 60vh)')
    assert.ok(findAll(zoomedWin, (n) => n.type === 'button' && n.props.title === 'tools.windowRestore')[0])

    // 3. Minimize ToolWindow -> body hides, re-clicking index entry restores it instead of closing.
    const minWinBtn = findAll(zoomedWin, (n) => n.type === 'button' && n.props.title === 'tools.windowMinimize')[0]
    minWinBtn.props.onClick()

    root = renderer.tree()
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-toolwin-body')).length, 0)
    const effectsBtnMin = findAll(root, (n) => hasClass(n, 'mv-tool-entry')).find((n) =>
      textOf(n).includes('tools.effects'),
    )
    effectsBtnMin.props.onClick()

    root = renderer.tree()
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-toolwin-body')).length, 1)

    // 4. Minimize toolbox index -> hides index grid, persists flag, displays active pill.
    const indexMinBtn = findAll(root, (n) => n.type === 'button' && n.props.title === 'tools.indexMinimize')[0]
    assert.equal(indexMinBtn.props['aria-expanded'], true)
    indexMinBtn.props.onClick()

    root = renderer.tree()
    assert.equal(readPanelFlag(TOOLS_MINIMIZED_KEY, false), true)
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-tool-index')).length, 0)
    const pills = findAll(root, (n) => hasClass(n, 'mv-tools-active-pill'))
    assert.ok(pills.some((p) => textOf(p) === 'tools.effects'))
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
    'layers.vectorChatHint',
  ]
  for (const key of keys) {
    assert.ok(typeof MESSAGES.zh[key] === 'string' && MESSAGES.zh[key].length > 0, `missing zh key ${key}`)
    assert.ok(typeof MESSAGES.en[key] === 'string' && MESSAGES.en[key].length > 0, `missing en key ${key}`)
  }
})
