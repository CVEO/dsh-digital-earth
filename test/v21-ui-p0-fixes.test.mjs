/**
 * v21 — UI P0 fix pack regression tests.
 *
 * Pins the six P0 fixes from the v1.7.0 UI audit:
 *   1. Embedded AnalysisCard (profile + non-profile) exposes an explicit clear button
 *      in its body and ConsoleHeader exposes a context close/clear button for result/object;
 *   2. ProfileBar renders a canvas-level clear/redraw/view-chart pill for active profiles;
 *   3. Completing an analysis from the measure/analysis tool switches to the result tab;
 *   4. Programmatic dock requests with mode='activate' never collapse an already-active tab;
 *   5. TopBar dropdown menus right-align inside the console and `.in-dock` resets offsets;
 *   6. PanelRail removes `--mv-console-width` when collapsed so the topbar shrinks back.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import test from 'node:test'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { consoleCloseAction } = await import('../src/client/ui/console-header.js')
const { ProfileBar } = await import('../src/client/ui/profile-bar.js')
const { TopBar } = await import('../src/client/ui/topbar.js')
const { AnalysisCard } = await import('../src/client/ui/cards.js')
const { RightStack } = await import('../src/client/ui/right-stack.js')

const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key)
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

function nodeChildren(node) {
  return node?.children !== undefined ? node.children : node?.props?.children
}

function findAll(node, pred, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) findAll(item, pred, out)
    return out
  }
  if (pred(node)) out.push(node)
  const children = nodeChildren(node)
  if (children !== undefined) findAll(children, pred, out)
  return out
}

function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object') return textOf(nodeChildren(node))
  return ''
}

function createRenderer(Component, getProps) {
  let stateSlots = []
  let refSlots = []
  let effects = []
  let cleanups = []
  let tree = null
  const orig = {
    useState: React.useState,
    useRef: React.useRef,
    useEffect: React.useEffect,
    useCallback: React.useCallback,
    useMemo: React.useMemo,
  }
  function render() {
    let sIdx = 0
    let rIdx = 0
    let eIdx = 0
    const nextEffects = []
    React.useState = (init) => {
      const i = sIdx++
      if (!(i in stateSlots)) stateSlots[i] = typeof init === 'function' ? init() : init
      return [
        stateSlots[i],
        (val) => {
          stateSlots[i] = typeof val === 'function' ? val(stateSlots[i]) : val
        },
      ]
    }
    React.useRef = (init) => {
      const i = rIdx++
      if (!(i in refSlots)) refSlots[i] = { current: init }
      return refSlots[i]
    }
    React.useEffect = (fn, deps) => {
      const i = eIdx++
      nextEffects[i] = { fn, deps }
    }
    React.useCallback = (fn) => fn
    React.useMemo = (fn) => fn()
    try {
      const expand = (node) => {
        if (!node || typeof node !== 'object') return node
        if (Array.isArray(node)) return node.map(expand)
        if (typeof node.type === 'function') return expand(node.type(node.props))
        const children = nodeChildren(node)
        if (children !== undefined) {
          return { ...node, children: expand(children) }
        }
        return node
      }
      tree = expand(Component(getProps()))
    } finally {
      Object.assign(React, orig)
    }
    for (let i = 0; i < nextEffects.length; i += 1) {
      const prev = effects[i]
      const next = nextEffects[i]
      const changed = !prev || !next.deps || !prev.deps || next.deps.some((d, j) => d !== prev.deps[j])
      if (changed) {
        if (typeof cleanups[i] === 'function') cleanups[i]()
        cleanups[i] = next.fn()
      }
    }
    effects = nextEffects
    return tree
  }
  function settle() {
    for (let k = 0; k < 4; k += 1) render()
    return tree
  }
  settle()
  return { tree: () => tree, rerender: settle }
}

const PROFILE_ANALYSIS = {
  operation: 'profile',
  result: {
    action: 'profile',
    length_m: 245.5,
    samples: 3,
    from: [116.3, 39.9],
    to: [116.303, 39.9],
    stats: { min_height: 350, max_height: 362, relief_m: 12, gain_m: 12, loss_m: 0 },
    points: [
      { distance_m: 0, height_m: 350 },
      { distance_m: 120, height_m: 356 },
      { distance_m: 245.5, height_m: 362 },
    ],
  },
}

test('consoleCloseAction：结果/对象页签暴露清除或关闭动作，其他页签不显示', () => {
  let cleared = 0
  let closedReport = 0
  let closedObj = 0
  const prof = consoleCloseAction({
    t,
    activeTab: 'result',
    analysis: PROFILE_ANALYSIS,
    onCloseAnalysis: () => { cleared += 1 },
  })
  assert.equal(prof.closePanelLabel, 'profile.clear')
  assert.equal(prof.closePanelDanger, true)
  prof.onClosePanel()
  assert.equal(cleared, 1)

  const rep = consoleCloseAction({
    t,
    activeTab: 'result',
    analysis: PROFILE_ANALYSIS,
    reportPreview: { html: '<p>ok</p>' },
    onCloseReport: () => { closedReport += 1 },
  })
  assert.equal(rep.closePanelLabel, 'report.close')
  assert.equal(rep.closePanelDanger, false)
  rep.onClosePanel()
  assert.equal(closedReport, 1)

  const obj = consoleCloseAction({
    t,
    activeTab: 'object',
    hasObject: true,
    onCloseObject: () => { closedObj += 1 },
  })
  assert.equal(obj.closePanelLabel, 'btn.close')
  obj.onClosePanel()
  assert.equal(closedObj, 1)

  const layers = consoleCloseAction({ t, activeTab: 'layers', analysis: PROFILE_ANALYSIS, onCloseAnalysis: () => {} })
  assert.equal(layers.onClosePanel, null)
})

test('TopBar：传入 onClosePanel 时在标题区渲染可点击的关闭/清除按钮', () => {
  let clicks = 0
  const tree = TopBar({
    t,
    menuRef: { current: null },
    openMenu: null,
    setOpenMenu: () => {},
    data: { recentDirs: [], recentUrls: [] },
    view: { showHud: false },
    output: {},
    quick: { showLayers: false, showTools: false, showResult: true, onToggleLayers: () => {}, onToggleTools: () => {}, onOpenResult: () => {} },
    panelLabel: 'panel.tab.result',
    onClosePanel: () => { clicks += 1 },
    closePanelLabel: 'profile.clear',
    closePanelDanger: true,
    onOpenSettings: () => {},
    onToggleChrome: () => {},
  })
  const btn = findAll(tree, (n) => n?.props?.className === 'mv-top-close danger')[0]
  assert.ok(btn, '顶栏标题区应渲染清除按钮')
  assert.equal(btn.props['aria-label'], 'profile.clear')
  btn.props.onClick()
  assert.equal(clicks, 1)
})

test('ProfileBar：活动剖面在画布底部展示查看图表/重画/清除，并在结果页打开时隐藏查看图表', () => {
  let opened = 0
  let redrawn = 0
  let cleared = 0
  const bar = ProfileBar({
    t,
    analysis: PROFILE_ANALYSIS,
    hidden: false,
    resultOpen: false,
    onOpenResult: () => { opened += 1 },
    onRedraw: () => { redrawn += 1 },
    onClear: () => { cleared += 1 },
  })
  assert.ok(bar)
  const buttons = findAll(bar, (n) => n.type === 'button')
  assert.equal(buttons.length, 3)
  buttons[0].props.onClick()
  buttons[1].props.onClick()
  buttons[2].props.onClick()
  assert.equal(opened, 1)
  assert.equal(redrawn, 1)
  assert.equal(cleared, 1)

  const whenOpen = ProfileBar({ t, analysis: PROFILE_ANALYSIS, resultOpen: true, onOpenResult: () => {}, onRedraw: () => {}, onClear: () => {} })
  assert.equal(findAll(whenOpen, (n) => n.type === 'button').length, 2)
  assert.equal(ProfileBar({ t, analysis: PROFILE_ANALYSIS, hidden: true }), null)
  assert.equal(ProfileBar({ t, analysis: { operation: 'flood', result: { area_km2: 1 } } }), null)
})

test('AnalysisCard（embedded）：剖面与非剖面分析均在主体中提供显式清除按钮', () => {
  let closed = 0
  const profRenderer = createRenderer(AnalysisCard, () => ({
    state: PROFILE_ANALYSIS,
    t,
    embedded: true,
    onClose: () => { closed += 1 },
    onStartProfile: () => {},
  }))
  const clearProf = findAll(profRenderer.tree(), (n) => n.type === 'button' && textOf(n).includes('profile.clear'))[0]
  assert.ok(clearProf, '内嵌剖面卡必须提供显式清除剖面按钮')
  clearProf.props.onClick()
  assert.equal(closed, 1)

  const floodRenderer = createRenderer(AnalysisCard, () => ({
    state: { operation: 'flood', result: { water_height: 10, area_km2: 1, inundated_km2: 0.5 } },
    t,
    embedded: true,
    onClose: () => { closed += 1 },
  }))
  const clearFlood = findAll(floodRenderer.tree(), (n) => n.type === 'button' && textOf(n).includes('layers.analysisClear'))[0]
  assert.ok(clearFlood, '内嵌非剖面分析卡也必须提供显式清除分析按钮')
  clearFlood.props.onClick()
  assert.equal(closed, 2)
})

test('RightStack：从量测/分析工具完成剖面时自动切到结果页，activate 请求不会反向折叠已打开页签', () => {
  const prevStorage = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  try {
    let activeTab = null
    const props = {
      t,
      showLayers: true,
      showTools: true,
      openWindows: [{ id: 'measure' }],
      showToolIndex: false,
      analysis: null,
      dockRequest: { kind: 'tools', mode: 'activate', seq: 1 },
      onActiveTab: (tab) => { activeTab = tab },
      onUnread: () => {},
      layersPanel: { config: {}, settings: {}, layers: [] },
      toolsPanel: { openWindows: [{ id: 'measure' }] },
    }
    const r = createRenderer(RightStack, () => props)
    assert.equal(activeTab, 'tools')

    // Programmatic activate on an already-active tab must NOT collapse it.
    props.dockRequest = { kind: 'tools', mode: 'activate', seq: 2 }
    r.rerender()
    assert.equal(activeTab, 'tools', 'mode=activate 不应反向收起当前页签')

    // Completing a profile while measure tool is open switches straight to result.
    props.analysis = PROFILE_ANALYSIS
    r.rerender()
    assert.equal(activeTab, 'result', '从量测工具完成剖面应自动切到结果页')
  } finally {
    globalThis.localStorage = prevStorage
  }
})

test('CSS 与 PanelRail 契约：下拉菜单右对齐防裁切、in-dock 重置偏移、收起释放控制台宽度', () => {
  const css = read('src/client/ui/css.js')
  assert.match(css, /\.mv-menu\.mv-data-menu\{position:static\}/)
  assert.match(css, /\.mv-data-menu \.mv-menu-panel\{left:auto;right:4px;/)
  assert.match(css, /\.mv-dock-panel \.in-dock\{[^}]*inset:auto;top:auto;right:auto;bottom:auto;left:auto;z-index:auto/)
  const rail = read('src/client/ui/panel-rail.js')
  assert.match(rail, /if \(!isCollapsed && Number\.isFinite\(value\)\)/)
  const surface = read('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /workspace\.closeTool\(header\.toolId\)/)
})
