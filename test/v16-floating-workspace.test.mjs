import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const {
  POSITION_STORAGE_KEY,
  clampWindowPos,
  nudgeWindowPos,
  defaultToolFloatPos,
  readSavedPos,
  writeSavedPos,
  focusFloatingWindow,
  getFloatingZIndex,
  resetFloatingFocusOrder,
  useFloatingWindow,
} = await import('../src/client/ui/floating.js')
const {
  openWorkspaceTool,
  closeWorkspaceTool,
  toggleMinimizeWorkspaceTool,
  toggleExpandWorkspaceTool,
  useToolWorkspace,
} = await import('../src/client/ui/tool-workspace.js')
const { RightStack } = await import('../src/client/ui/right-stack.js')
const { ToolbarQuick } = await import('../src/client/ui/toolbar-quick.js')
const { LayersMap } = await import('../src/client/ui/layers-map.js')
const { AnalysisCard } = await import('../src/client/ui/cards.js')
const { UI_MESSAGES } = await import('../src/client/messages-ui.js')
const { MESSAGES } = await import('../src/client/messages.js')
const { IMAGERY_OPEN_KEY, readPanelFlag } = await import('../src/client/ui/panel-prefs.js')

function withEnv(fn) {
  const store = new Map()
  const prevStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const prevWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const fakeStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: fakeStorage })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { ...(globalThis.window ?? {}), localStorage: fakeStorage },
  })
  resetFloatingFocusOrder()
  try {
    return fn(store)
  } finally {
    resetFloatingFocusOrder()
    if (prevStorage) Object.defineProperty(globalThis, 'localStorage', prevStorage)
    else delete globalThis.localStorage
    if (prevWindow) Object.defineProperty(globalThis, 'window', prevWindow)
    else delete globalThis.window
  }
}

function makeFakeDoc({ rootWidth = 1280, rootHeight = 800, panelRect = { left: 950, top: 60, width: 300, height: 240 } } = {}) {
  const docListeners = new Map()
  const rootEl = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: rootWidth, bottom: rootHeight, width: rootWidth, height: rootHeight }),
  }
  const doc = {
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, [])
      docListeners.get(type).push(fn)
    },
    removeEventListener(type, fn) {
      const list = docListeners.get(type) ?? []
      const idx = list.indexOf(fn)
      if (idx >= 0) list.splice(idx, 1)
    },
    emit(type, ev = {}) {
      for (const fn of [...(docListeners.get(type) ?? [])]) {
        fn({ preventDefault() {}, stopPropagation() {}, ...ev })
      }
    },
  }
  const panelEl = {
    ownerDocument: doc,
    offsetParent: rootEl,
    closest: (sel) => (sel === '.mv-root' ? rootEl : null),
    getBoundingClientRect: () => ({
      left: panelRect.left,
      top: panelRect.top,
      right: panelRect.left + panelRect.width,
      bottom: panelRect.top + panelRect.height,
      width: panelRect.width,
      height: panelRect.height,
    }),
  }
  return { doc, rootEl, panelEl }
}

function renderHooks(renderFn) {
  const fibers = new Map()
  let activeFiberKeys = new Set()
  let tree = null
  const prev = {
    useState: React.useState,
    useRef: React.useRef,
    useMemo: React.useMemo,
    useEffect: React.useEffect,
    useCallback: React.useCallback,
  }
  const depsChanged = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))

  const render = () => {
    const nextActiveKeys = new Set()
    const pending = []

    const runWithFiber = (fiberKey, fn) => {
      nextActiveKeys.add(fiberKey)
      let fiber = fibers.get(fiberKey)
      if (!fiber) {
        fiber = { states: [], refs: [], memos: [], effects: [] }
        fibers.set(fiberKey, fiber)
      }
      let si = 0
      let ri = 0
      let mi = 0
      let ei = 0

      React.useState = (init) => {
        const idx = si++
        if (!(idx in fiber.states)) fiber.states[idx] = typeof init === 'function' ? init() : init
        const setState = (updater) => {
          const next = typeof updater === 'function' ? updater(fiber.states[idx]) : updater
          if (!Object.is(next, fiber.states[idx])) {
            fiber.states[idx] = next
            render()
          }
        }
        return [fiber.states[idx], setState]
      }
      React.useRef = (init) => {
        const idx = ri++
        if (!(idx in fiber.refs)) fiber.refs[idx] = { current: init }
        return fiber.refs[idx]
      }
      React.useMemo = (factory, deps) => {
        const idx = mi++
        if (!fiber.memos[idx] || depsChanged(deps, fiber.memos[idx].deps)) {
          fiber.memos[idx] = { deps, value: factory() }
        }
        return fiber.memos[idx].value
      }
      React.useCallback = (fnArg, deps) => React.useMemo(() => fnArg, deps)
      React.useEffect = (effect, deps) => {
        const idx = ei++
        const prevEntry = fiber.effects[idx]
        if (!prevEntry || depsChanged(deps, prevEntry.deps)) {
          pending.push({ fiber, idx, effect, deps, prevCleanup: prevEntry?.cleanup })
        }
      }
      return fn()
    }

    const expand = (node, path = 'r') => {
      if (node === null || node === undefined || typeof node === 'boolean') return null
      if (Array.isArray(node)) {
        return node
          .flat()
          .map((child, idx) => expand(child, `${path}[${child?.props?.key ?? idx}]`))
          .filter((x) => x !== null)
      }
      if (typeof node !== 'object') return node
      if (typeof node.type === 'function') {
        const fnProps = { ...(node.props ?? {}) }
        if (node.children?.length && fnProps.children === undefined) {
          fnProps.children = node.children.length === 1 ? node.children[0] : node.children
        }
        const fKey = `${path}:${node.type.name || 'anon'}`
        return expand(runWithFiber(fKey, () => node.type(fnProps)), fKey)
      }
      const rawChildren = Array.isArray(node.children)
        ? node.children
        : node.props?.children !== undefined
          ? [node.props.children]
          : []
      const children = expand(rawChildren, path)
      return { ...node, children: Array.isArray(children) ? children : children === null ? [] : [children] }
    }

    tree = expand(runWithFiber('root', renderFn), 'root')
    for (const oldKey of activeFiberKeys) {
      if (!nextActiveKeys.has(oldKey)) {
        const oldFiber = fibers.get(oldKey)
        if (oldFiber) {
          for (const e of oldFiber.effects) if (typeof e?.cleanup === 'function') e.cleanup()
          fibers.delete(oldKey)
        }
      }
    }
    activeFiberKeys = nextActiveKeys
    for (const item of pending) {
      if (typeof item.prevCleanup === 'function') item.prevCleanup()
      const slot = { deps: item.deps, cleanup: undefined }
      item.fiber.effects[item.idx] = slot
      slot.cleanup = item.effect()
    }
    return tree
  }

  render()
  return {
    getTree: () => tree,
    rerender: () => render(),
    cleanup() {
      for (const fiber of fibers.values()) {
        for (const e of fiber.effects) if (typeof e?.cleanup === 'function') e.cleanup()
      }
      fibers.clear()
      Object.assign(React, prev)
    },
  }
}

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

function hasClass(node, cls) {
  return String(node?.props?.className ?? '').split(/\s+/).includes(cls)
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

const tIdentity = (key, params) => {
  if (!params) return key
  let out = key
  for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

test('floating pure helpers clamp within viewport, nudge by 16/48px, cascade auto-float, persist & order focus z-index', () => {
  withEnv(() => {
    const root = { left: 0, top: 0, width: 1200, height: 800 }
    const panel = { width: 300, height: 250 }
    assert.deepEqual(clampWindowPos({ x: -100, y: 10 }, panel, root), { x: 8, y: 52 })
    assert.deepEqual(clampWindowPos({ x: 5000, y: 5000 }, panel, root), { x: 892, y: 542 })

    assert.deepEqual(nudgeWindowPos({ x: 100, y: 100 }, 'ArrowLeft', false), { x: 84, y: 100 })
    assert.deepEqual(nudgeWindowPos({ x: 100, y: 100 }, 'ArrowDown', true), { x: 100, y: 148 })
    assert.equal(nudgeWindowPos({ x: 100, y: 100 }, 'Enter', false), null)

    const cascaded = defaultToolFloatPos(1, { width: 300, height: 240 }, root, { left: 884, top: 60, height: 500 })
    assert.ok(cascaded)
    assert.equal(cascaded.width, 300)
    assert.ok(cascaded.x < 884 - 300)
    assert.equal(cascaded.y, 88)
    assert.equal(defaultToolFloatPos(0, panel, { left: 0, top: 0, width: 600, height: 800 }, { height: 200 }), null)

    writeSavedPos('layers', { x: 120.4, y: 88.6, width: 340 })
    assert.deepEqual(readSavedPos('layers'), { x: 120, y: 89, width: 340 })
    writeSavedPos('layers', null)
    assert.equal(readSavedPos('layers'), null)
    assert.equal(globalThis.localStorage.getItem(POSITION_STORAGE_KEY), null)

    focusFloatingWindow('toolwin.select')
    focusFloatingWindow('toolwin.measure')
    assert.ok(getFloatingZIndex('toolwin.measure') > getFloatingZIndex('toolwin.select'))
    focusFloatingWindow('toolwin.select')
    assert.ok(getFloatingZIndex('toolwin.select') > getFloatingZIndex('toolwin.measure'))
  })
})

test('useFloatingWindow supports 2D pointer drag, Shift+Arrow nudging, and dock reset', () => {
  withEnv(() => {
    const { doc, panelEl } = makeFakeDoc()
    let ctrl = null
    const Harness = () => {
      ctrl = useFloatingWindow({ storageKey: 'layers', title: 'Layers', t: tIdentity })
      ctrl.ref.current = panelEl
      return React.createElement(
        'div',
        { className: ctrl.className, style: ctrl.style },
        ctrl.dragHandle,
        ctrl.resetButton,
        ctrl.liveRegion,
      )
    }
    const r = renderHooks(() => React.createElement(Harness))
    try {
      assert.equal(ctrl.moved, false)
      assert.equal(findAll(r.getTree(), (n) => hasClass(n, 'mv-dock-reset')).length, 0)

      // Movement below 4px threshold does not float the panel
      ctrl.dragHandle.props.onPointerDown({ button: 0, pointerId: 1, clientX: 960, clientY: 70, currentTarget: {} })
      doc.emit('pointermove', { pointerId: 1, clientX: 961, clientY: 71 })
      doc.emit('pointerup', { pointerId: 1 })
      assert.equal(ctrl.moved, false)

      // Drag left + down beyond threshold moves freely in 2D and persists
      ctrl.dragHandle.props.onPointerDown({ button: 0, pointerId: 2, clientX: 960, clientY: 70, currentTarget: {} })
      doc.emit('pointermove', { pointerId: 2, clientX: 760, clientY: 220 })
      assert.equal(ctrl.dragging, true)
      doc.emit('pointerup', { pointerId: 2 })
      assert.equal(ctrl.dragging, false)
      assert.equal(ctrl.moved, true)
      assert.equal(ctrl.userMoved, true)
      assert.equal(ctrl.style.position, 'absolute')
      assert.equal(ctrl.style.left, '750px')
      assert.equal(ctrl.style.top, '210px')
      assert.deepEqual(readSavedPos('layers'), { x: 750, y: 210, width: 300 })

      // Keyboard Shift+ArrowLeft nudges by 48px
      ctrl.dragHandle.props.onKeyDown({ key: 'ArrowLeft', shiftKey: true, preventDefault() {} })
      assert.deepEqual(readSavedPos('layers'), { x: 702, y: 210, width: 300 })

      // Reset dock button appears and restores docked layout + removes saved storage entry
      const resetBtn = findAll(r.getTree(), (n) => hasClass(n, 'mv-dock-reset'))[0]
      assert.ok(resetBtn)
      resetBtn.props.onClick()
      assert.equal(ctrl.moved, false)
      assert.equal(ctrl.userMoved, false)
      assert.equal(readSavedPos('layers'), null)
    } finally {
      r.cleanup()
    }
  })
})

test('tool-workspace & RightStack keep Selection mounted independently when Tools closes and support multi-window tools', () => {
  withEnv(() => {
    let wins = []
    wins = openWorkspaceTool(wins, 'select', { toggleIfOpen: false })
    wins = openWorkspaceTool(wins, 'measure', { toggleIfOpen: false })
    assert.deepEqual(
      wins.map((w) => w.id),
      ['select', 'measure'],
    )
    wins = toggleMinimizeWorkspaceTool(wins, 'select')
    assert.equal(wins.find((w) => w.id === 'select').minimized, true)
    // Re-opening a minimized window restores it instead of closing it
    wins = openWorkspaceTool(wins, 'select', { toggleIfOpen: true })
    assert.equal(wins.find((w) => w.id === 'select').minimized, false)
    // Toggling expand switches expanded on and restores minimized
    wins = toggleMinimizeWorkspaceTool(wins, 'measure')
    wins = toggleExpandWorkspaceTool(wins, 'measure')
    assert.equal(wins.find((w) => w.id === 'measure').expanded, true)
    assert.equal(wins.find((w) => w.id === 'measure').minimized, false)
    wins = openWorkspaceTool(wins, 'unknown-tool')
    assert.equal(wins.length, 2)
    wins = closeWorkspaceTool(wins, 'measure')
    assert.deepEqual(wins.map((w) => w.id), ['select'])

    let showTools = true
    let wsApi = null
    const WorkspaceHost = () => {
      wsApi = useToolWorkspace()
      return React.createElement(RightStack, {
        t: tIdentity,
        showTools,
        openWindows: wsApi.windows,
        onSelectTool: wsApi.selectTool,
        onCloseToolWindow: wsApi.closeTool,
        onToggleMinimizeTool: wsApi.toggleMinimize,
        onToggleExpandTool: wsApi.toggleExpand,
        toolsPanel: {
          tool: null,
          analysis: null,
          shaderActive: [],
          onCollapse: () => {
            showTools = false
          },
        },
      })
    }
    const r = renderHooks(() => React.createElement(WorkspaceHost))
    try {
      wsApi.openTool('select')
      wsApi.openTool('measure')
      r.rerender()
      const openTitles = () =>
        findAll(r.getTree(), (n) => hasClass(n, 'mv-toolwin')).map((win) =>
          textOf(findAll(win, (n) => hasClass(n, 'mv-toolwin-title'))[0]),
        )
      assert.deepEqual(openTitles(), ['tools.select', 'tools.measure'])
      assert.equal(findAll(r.getTree(), (n) => hasClass(n, 'mv-tool-index')).length, 1)

      // Closing ToolsPanel removes only the launcher card; open tool windows stay alive
      showTools = false
      r.rerender()
      assert.equal(findAll(r.getTree(), (n) => hasClass(n, 'mv-tool-index')).length, 0)
      assert.deepEqual(openTitles(), ['tools.select', 'tools.measure'])
    } finally {
      r.cleanup()
    }
  })
})

test('ToolbarQuick exposes 1-click Selection toggle and displays openToolCount when Tools is hidden', () => {
  let selectClicks = 0
  let toolsClicks = 0
  const tree = ToolbarQuick({
    t: tIdentity,
    showSelect: false,
    onToggleSelect: () => {
      selectClicks++
    },
    showLayers: false,
    showTools: false,
    openToolCount: 2,
    onToggleLayers: () => {},
    onToggleTools: () => {
      toolsClicks++
    },
    button: (label, onClick, active, style, title) =>
      React.createElement('button', { onClick, 'aria-pressed': Boolean(active), style, title }, label),
  })
  const buttons = findAll(tree, (n) => n.type === 'button')
  const selectBtn = buttons.find((b) => textOf(b).includes('btn.select'))
  const toolsBtn = buttons.find((b) => textOf(b).includes('btn.tools'))
  assert.ok(selectBtn)
  assert.equal(selectBtn.props['aria-pressed'], false)
  assert.equal(selectBtn.props.title, 'btn.selectShow')
  assert.ok(toolsBtn)
  assert.ok(textOf(toolsBtn).includes('2'))
  selectBtn.props.onClick()
  toolsBtn.props.onClick()
  assert.equal(selectClicks, 1)
  assert.equal(toolsClicks, 1)
})

test('LayersMap renders prominent L4 imagery fold affordance beside title + active summary bar', () => {
  withEnv(() => {
    const r = renderHooks(() =>
      LayersMap({
        t: tIdentity,
        config: {
          imagery: [
            { id: 'arcgis', name: 'ArcGIS Imagery' },
            { id: 'osm', name: 'OpenStreetMap' },
          ],
        },
        settings: { imagery: 'arcgis' },
        onSelectImagery: () => {},
      }),
    )
    try {
      const tree = r.getTree()
      const foldTop = findAll(tree, (n) => hasClass(n, 'mv-fold-top'))[0]
      const chevron = findAll(foldTop, (n) => hasClass(n, 'mv-group-chevron'))[0]
      const title = findAll(foldTop, (n) => hasClass(n, 'mv-group-title'))[0]
      const count = findAll(foldTop, (n) => hasClass(n, 'mv-fold-count'))[0]
      const state = findAll(foldTop, (n) => hasClass(n, 'mv-fold-state'))[0]
      const summary = findAll(tree, (n) => hasClass(n, 'mv-fold-summary'))[0]
      assert.ok(chevron && title && count && state && summary)
      assert.equal(textOf(count), 'layers.imageryCount')
      assert.equal(textOf(state), 'layers.imageryClickExpand')
      assert.ok(textOf(summary).includes('ArcGIS Imagery'))

      const toggleBtn = findAll(tree, (n) => hasClass(n, 'mv-group-toggle'))[0]
      assert.equal(toggleBtn.props['aria-expanded'], false)
      toggleBtn.props.onClick()
      const openTree = r.getTree()
      assert.equal(readPanelFlag(IMAGERY_OPEN_KEY, false), true)
      const openToggleBtn = findAll(openTree, (n) => hasClass(n, 'mv-group-toggle'))[0]
      assert.equal(openToggleBtn.props['aria-expanded'], true)
      const openState = findAll(openTree, (n) => hasClass(n, 'mv-fold-state'))[0]
      assert.equal(textOf(openState), 'layers.imageryClickFold')
    } finally {
      r.cleanup()
    }
  })
})

test('AnalysisCard shows direct redraw-profile shortcut when profile is active', () => {
  let redrawCount = 0
  const r = renderHooks(() =>
    AnalysisCard({
      t: tIdentity,
      state: {
        operation: 'profile',
        layerName: 'Viaduct',
        result: {
          length_m: 246,
          stats: { min_height: 10, max_height: 27, relief_m: 17, gain_m: 17, loss_m: 0 },
          samples: 2,
          points: [
            { distance_m: 0, height_m: 10 },
            { distance_m: 246, height_m: 27 },
          ],
        },
      },
      onClose: () => {},
      onStartProfile: () => {
        redrawCount++
      },
    }),
  )
  try {
    const redrawBtn = findAll(r.getTree(), (n) => n.type === 'button' && textOf(n).includes('analysis.redrawProfile'))[0]
    assert.ok(redrawBtn)
    redrawBtn.props.onClick()
    assert.equal(redrawCount, 1)
  } finally {
    r.cleanup()
  }
})

test('UI_MESSAGES zh/en keys are complete, non-empty, and merged into MESSAGES', () => {
  const zhKeys = Object.keys(UI_MESSAGES.zh).sort()
  const enKeys = Object.keys(UI_MESSAGES.en).sort()
  assert.deepEqual(zhKeys, enKeys)
  for (const key of zhKeys) {
    assert.equal(typeof UI_MESSAGES.zh[key], 'string')
    assert.ok(UI_MESSAGES.zh[key].trim().length > 0, `empty zh key: ${key}`)
    assert.equal(typeof UI_MESSAGES.en[key], 'string')
    assert.ok(UI_MESSAGES.en[key].trim().length > 0, `empty en key: ${key}`)
    assert.equal(MESSAGES.zh[key], UI_MESSAGES.zh[key])
    assert.equal(MESSAGES.en[key], UI_MESSAGES.en[key])
  }
})
