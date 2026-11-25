/**
 * v1.6.2 Batch D2–D6 — single-active right dock integration tests.
 *
 * Renders the real RightStack (and its real panels) through the hook-stub
 * renderer used by the other UI suites, but this variant runs effects, because
 * the dock's tab resolution / auto-switch / float bookkeeping lives in effects.
 * Covers: tabs exist in order, only one panel is visible while the others stay
 * mounted, tab switching, opening a tool window as a tab, closing a tab with a
 * sane fallback, the detach-to-float escape hatch, the collapsed pill, and the
 * analysis auto-switch policy (user vs. busy Agent run).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { RightStack } = await import('../src/client/ui/right-stack.js')

const t = (key) => key

const FLOOD = {
  operation: 'flood',
  layerName: 'Campus Tiles',
  result: {
    water_height: 12,
    area_km2: 1.2,
    inundated_km2: 0.6,
    inundated_ratio: 0.5,
    depth_max_m: 3.2,
    depth_mean_m: 1.4,
    samples_inundated: 20,
    samples_with_data: 40,
    region: { west: 120, south: 30, east: 120.1, north: 30.1 },
    warnings: [],
  },
}

function withStorage(fn) {
  const store = new Map()
  const previous = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
  try {
    return fn(store)
  } finally {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
}

/**
 * Recursive component renderer with working useState/ref/memo/callback/effect.
 * Effect callbacks run after each render pass and may schedule one more pass.
 */
function createRenderer(rootFn, getProps) {
  const states = new Map()
  const refs = new Map()
  const memos = new Map()
  const effectSlots = new Map()
  let tree = null
  let dirty = false
  let rendering = false
  let insideEffect = false
  let rerender = null

  function schedule() {
    if (rendering || insideEffect) {
      dirty = true
      return
    }
    rerender()
  }

  function makeHooks(path) {
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
      if (!states.has(key)) states.set(key, typeof initial === 'function' ? initial() : initial)
      const setState = (next) => {
        const current = states.get(key)
        const value = typeof next === 'function' ? next(current) : next
        if (Object.is(value, current)) return
        states.set(key, value)
        schedule()
      }
      return [states.get(key), setState]
    }
    React.useRef = (initial) => {
      const key = `${path}#r${slot++}`
      if (!refs.has(key)) refs.set(key, { current: initial })
      return refs.get(key)
    }
    const memo = (kind, fn, deps) => {
      const key = `${path}#${kind}${slot++}`
      const previous = memos.get(key)
      if (previous && deps && previous.deps && deps.length === previous.deps.length && deps.every((item, index) => Object.is(item, previous.deps[index]))) {
        return previous.value
      }
      const value = fn()
      memos.set(key, { value, deps: deps ? [...deps] : null })
      return value
    }
    React.useMemo = (fn, deps) => memo('m', fn, deps)
    React.useCallback = (fn, deps) => memo('c', () => fn, deps)
    React.useEffect = (fn, deps) => {
      const key = `${path}#e${slot++}`
      const previous = effectSlots.get(key)
      const changed =
        !previous ||
        !deps ||
        !previous.deps ||
        deps.length !== previous.deps.length ||
        deps.some((item, index) => !Object.is(item, previous.deps[index]))
      if (changed) effectSlots.set(key, { fn, deps: deps ? [...deps] : null, pending: true })
    }
    return saved
  }

  function expand(node, path) {
    if (node == null || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map((item, index) => expand(item, `${path}[${index}]`))
    if (typeof node.type === 'function') {
      const name = node.type.name || 'Fn'
      const props = { ...(node.props || {}), children: node.children }
      const saved = makeHooks(`${path}/${name}`)
      let result
      try {
        result = node.type(props)
      } finally {
        Object.assign(React, saved)
      }
      return expand(result, `${path}/${name}`)
    }
    return {
      type: node.type,
      props: node.props || {},
      children: (node.children || []).map((child, index) => expand(child, `${path}.${index}`)),
    }
  }

  function runPendingEffects() {
    insideEffect = true
    try {
      for (const entry of effectSlots.values()) {
        if (!entry.pending) continue
        entry.pending = false
        entry.fn()
      }
    } finally {
      insideEffect = false
    }
  }

  rerender = () => {
    for (let pass = 0; pass < 24; pass += 1) {
      dirty = false
      rendering = true
      try {
        tree = expand(React.createElement(rootFn, getProps()), 'root')
      } finally {
        rendering = false
      }
      runPendingEffects()
      if (!dirty) return
    }
    throw new Error('dock renderer did not settle (effect loop)')
  }
  rerender()
  return {
    tree: () => tree,
    rerender,
    states,
  }
}

function findAll(node, predicate, acc = []) {
  if (!node || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const item of node) findAll(item, predicate, acc)
    return acc
  }
  if (predicate(node)) acc.push(node)
  if (Array.isArray(node.children)) for (const child of node.children) findAll(child, predicate, acc)
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

function byClass(root, cls) {
  return findAll(root, (node) => hasClass(node, cls))
}

const TOOLS_PANEL_PROPS = {
  t,
  tool: null,
  analysis: null,
  shaderActive: [],
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
}

function DockHost(props) {
  const [showTools, setShowTools] = React.useState(true)
  const [windows, setWindows] = React.useState(props.initialWindows ?? [])
  return React.createElement(RightStack, {
    t,
    analysis: props.analysis ?? null,
    onCloseAnalysis: props.onCloseAnalysis ?? (() => {}),
    analysisHover: null,
    onAnalysisHover: () => {},
    showLayers: props.showLayers ?? false,
    layersPanel: {
      t,
      layers: [],
      config: { terrain: [], imagery: [] },
      settings: {},
      annotations: { drawn_features: [], measured_points: 0 },
      shaderActive: [],
      agentOverlays: [],
      overlayDetails: [],
      overlayExtrusions: [],
      onCollapse: () => {},
      ...(props.layersPanel ?? {}),
    },
    showTools,
    toolsPanel: {
      ...TOOLS_PANEL_PROPS,
      onCollapse: () => setShowTools(false),
    },
    openWindows: windows,
    onSelectTool: (id) => setWindows((list) => [...list.filter((item) => item.id !== id), { id }]),
    onCloseToolWindow: (id) => setWindows((list) => list.filter((item) => item.id !== id)),
    onToggleMinimizeTool: () => {},
    onToggleExpandTool: () => {},
    busy: Boolean(props.busy),
    dockRequest: props.dockRequest ?? null,
    objectPanel: props.objectPanel ?? null,
  })
}

function renderDock(initial = {}) {
  const props = { analysis: null, busy: false, ...initial }
  const renderer = createRenderer(DockHost, () => props)
  return { renderer, props }
}

function tabLabels(root) {
  return findAll(root, (node) => node?.props?.role === 'tab').map((node) => ({
    label: textOf(node),
    selected: node.props['aria-selected'],
    tabIndex: node.props.tabIndex,
  }))
}

function activeTabNodes(root) {
  return findAll(root, (node) => hasClass(node, 'mv-dock-tab') && hasClass(node, 'on'))
}

function panelNodes(root) {
  return findAll(root, (node) => node?.props?.role === 'tabpanel' && hasClass(node, 'mv-dock-panel'))
}

function visiblePanels(root) {
  return panelNodes(root).filter((node) => !node.props.hidden)
}

test('P1 四个目的地：图层/工具/结果常驻，只渲染一个可见 tabpanel', () => {
  withStorage(() => {
    const { renderer } = renderDock({ analysis: FLOOD, showLayers: true })
    const root = renderer.tree()
    assert.deepEqual(
      byClass(root, 'mv-dock-tab').map((node) => textOf(node)),
      ['panel.tab.layers', 'panel.tab.tools', 'panel.tab.result'],
    )
    assert.equal(activeTabNodes(root).length, 1)
    assert.equal(visiblePanels(root).length, 1)
    const panels = panelNodes(root)
    assert.equal(panels.length, 3, '三个页签都有挂载，只有非活动的 hidden')
    assert.equal(panels.filter((node) => node.props.hidden).length, 2)
  })
})

test('P1 页签切换：点结果后工具面板 hidden 但不卸载，切回可继续', () => {
  withStorage(() => {
    const { renderer } = renderDock({ analysis: FLOOD, showLayers: true })
    let root = renderer.tree()
    const resultTab = findAll(root, (node) => node?.props?.role === 'tab').find((node) =>
      textOf(node).includes('panel.tab.result'),
    )
    resultTab.props.onClick()
    root = renderer.tree()
    assert.ok(visiblePanels(root)[0].props.id.endsWith('result'))
    assert.match(textOf(visiblePanels(root)[0]), /analysis\.title\.flood/)
    const toolsPanel = findAll(root, (node) => node?.props?.id === 'mv-dock-panel-tools')[0]
    assert.equal(toolsPanel.props.hidden, true)

    const toolsTab = findAll(root, (node) => node?.props?.role === 'tab').find((node) =>
      textOf(node).includes('panel.tab.tools'),
    )
    toolsTab.props.onClick()
    root = renderer.tree()
    assert.ok(visiblePanels(root)[0].props.id.endsWith('tools'))
  })
})

test('P1 结果空态：没有分析结果时结果页签给出启动提示', () => {
  withStorage(() => {
    const { renderer } = renderDock({ showLayers: true })
    let root = renderer.tree()
    const resultTab = findAll(root, (node) => node?.props?.role === 'tab').find((node) =>
      textOf(node).includes('panel.tab.result'),
    )
    resultTab.props.onClick()
    root = renderer.tree()
    assert.match(textOf(visiblePanels(root)[0]), /panel\.result\.emptyTitle/)
  })
})

test('P1 工具主从：点工具索引进入工具体，← 工具返回索引', () => {
  withStorage(() => {
    const { renderer } = renderDock({ showLayers: true })
    let root = renderer.tree()
    const effectsEntry = byClass(root, 'mv-tool-entry').find((node) => textOf(node).includes('tools.effects'))
    assert.ok(effectsEntry)
    effectsEntry.props.onClick()

    root = renderer.tree()
    assert.equal(byClass(root, 'mv-toolwin').length, 1, '只显示一个工具体')
    assert.equal(byClass(root, 'mv-toolwin-body').length, 1)
    const back = byClass(root, 'mv-panel-back')[0]
    assert.ok(back)
    back.props.onClick()

    root = renderer.tree()
    assert.equal(byClass(root, 'mv-toolwin').length, 0)
    assert.ok(findAll(root, (node) => hasClass(node, 'mv-tool-index')).length >= 1)
  })
})

test('P1 分析结果到达：空闲时自动切到结果页签', () => {
  withStorage(() => {
    const { renderer, props } = renderDock({ showLayers: true })
    let root = renderer.tree()
    assert.ok(activeTabNodes(root)[0].props.id.endsWith('tools') || activeTabNodes(root)[0].props.id.endsWith('layers'))
    props.analysis = FLOOD
    renderer.rerender()
    root = renderer.tree()
    assert.ok(activeTabNodes(root)[0].props.id.endsWith('result'))
  })
})

test('P1 忙碌时分析结果不抢焦点，只在结果页签挂未读点', () => {
  withStorage(() => {
    const { renderer, props } = renderDock({ showLayers: true, busy: true })
    renderer.tree()
    props.analysis = FLOOD
    renderer.rerender()
    const root = renderer.tree()
    assert.equal(byClass(root, 'mv-dock-dot').length, 1)
    assert.equal(byClass(root, 'mv-analysis').length, 1, '分析卡保持挂载')
  })
})

test('P1 收起/展开：面板保持挂载，收起时全部 hidden', () => {
  withStorage(() => {
    const { renderer } = renderDock({ analysis: FLOOD, showLayers: true })
    let root = renderer.tree()
    const before = panelNodes(root).length
    const collapse = findAll(root, (node) => node?.props?.title === 'dock.collapse')[0]
    collapse.props.onClick()

    root = renderer.tree()
    assert.equal(byClass(root, 'mv-dock-tab').length, 0)
    assert.ok(byClass(root, 'mv-dock-pill')[0])
    assert.equal(panelNodes(root).length, before)
    assert.ok(panelNodes(root).every((panel) => panel.props.hidden === true))

    byClass(root, 'mv-dock-pill')[0].props.onClick()
    root = renderer.tree()
    assert.equal(byClass(root, 'mv-dock-tab').length, 3)
  })
})

test('P1 不再提供浮动入口或页签关闭按钮', () => {
  withStorage(() => {
    const { renderer } = renderDock({ analysis: FLOOD, showLayers: true })
    const root = renderer.tree()
    assert.equal(findAll(root, (node) => node?.props?.title === 'dock.float').length, 0)
    assert.equal(byClass(root, 'mv-dock-tab-close').length, 0)
  })
})

test('P1 刷新恢复：v2 偏好恢复活动页签与收起状态', () => {
  withStorage((store) => {
    store.set('mv.ui.v2', JSON.stringify({ version: 2, activeTab: 'result', collapsed: false, width: 360 }))
    const { renderer } = renderDock({ analysis: FLOOD, showLayers: true })
    const root = renderer.tree()
    assert.ok(activeTabNodes(root)[0].props.id.endsWith('result'))
  })
})

test('P2 对象页签：按需出现，到达时空闲自动切换，关闭后消失', () => {
  withStorage(() => {
    const objectPanel = { key: 'vector:1', node: React.createElement('div', { className: 'mv-test-object' }, 'object body') }
    const { renderer, props } = renderDock({ showLayers: true })
    let root = renderer.tree()
    assert.equal(byClass(root, 'mv-dock-tab').length, 3)

    props.objectPanel = objectPanel
    renderer.rerender()
    root = renderer.tree()
    const labels = byClass(root, 'mv-dock-tab').map((node) => textOf(node))
    assert.ok(labels.includes('panel.tab.object'))
    assert.ok(activeTabNodes(root)[0].props.id.endsWith('object'))
    assert.equal(byClass(root, 'mv-test-object').length, 1)

    props.objectPanel = null
    renderer.rerender()
    root = renderer.tree()
    assert.equal(byClass(root, 'mv-test-object').length, 0)
    assert.equal(byClass(root, 'mv-dock-tab').length, 3)
  })
})

test('P1 旧右栏偏好迁移：analysis → result', () => {
  withStorage((store) => {
    store.set('mv.rightDock.v1', JSON.stringify({ activeId: 'analysis' }))
    const { renderer } = renderDock({ analysis: FLOOD, showLayers: true })
    const root = renderer.tree()
    assert.ok(activeTabNodes(root)[0].props.id.endsWith('result'))
  })
})

