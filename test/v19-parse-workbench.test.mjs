/**
 * v19 — 2D 提取工作台视图（纯展示）按冻结契约渲染。
 *
 * 组件只接收 `{ t, state, actions }`，不得访问 viewer/controller/store，所以这里
 * 用假 state 驱动、记录被调用的 action，断言首屏结构、内联重跑确认、进度文案、
 * busy 冻结、导出范围与「不再有旧三维控件」。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const {
  ParseWorkbench,
  exportCount,
  filterCandidates,
  statusText,
  visibleCandidates,
} = await import('../src/client/ui/parse-workbench.js')
const { PARSE_CSS } = await import('../src/client/ui/parse-css.js')

const t = (key, params) => {
  if (!params) return key
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), key)
}

/* --------------------------------------------------------------- rendering */

function createRenderer(root, getProps) {
  const states = new Map()
  let rerender = null

  const renderComponent = (Component, props, path) => {
    let slot = 0
    const saved = {
      useState: React.useState,
      useEffect: React.useEffect,
      useRef: React.useRef,
      useCallback: React.useCallback,
      useMemo: React.useMemo,
    }
    React.useState = (initial) => {
      const key = `${path}#s${slot++}`
      if (!states.has(key)) states.set(key, typeof initial === 'function' ? initial() : initial)
      const setState = (next) => {
        const current = states.get(key)
        states.set(key, typeof next === 'function' ? next(current) : next)
        rerender?.()
      }
      return [states.get(key), setState]
    }
    React.useEffect = () => {}
    React.useRef = (initial) => ({ current: initial })
    React.useCallback = (callback) => callback
    React.useMemo = (factory) => factory()
    try {
      return expand(Component(props), path)
    } finally {
      Object.assign(React, saved)
    }
  }

  const expand = (node, path) => {
    if (node == null || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map((child, index) => expand(child, `${path}[${index}]`))
    if (typeof node.type === 'function') {
      return renderComponent(node.type, { ...(node.props || {}), children: node.children }, `${path}/${node.type.name || 'Fn'}`)
    }
    return {
      type: node.type,
      props: node.props || {},
      children: (node.children || []).map((child, index) => expand(child, `${path}.${index}`)),
    }
  }

  let tree = null
  rerender = () => { tree = renderComponent(root, getProps(), 'root') }
  rerender()
  return { tree: () => tree }
}

function findAll(node, predicate, acc = []) {
  if (!node || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, acc)
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

const byAttr = (attr, value) => (node) => node?.props?.[attr] === value
const buttons = (tree) => findAll(tree, (node) => node.type === 'button')
const buttonBy = (tree, attr, value) => buttons(tree).find((node) => node.props[attr] === value)

/* ------------------------------------------------------------- fake state */

const CATALOG = [
  { id: 1, key: 'building', name: '建筑', color: '#f59e0b', definition: '屋顶轮廓', custom: false, on: true },
  { id: 2, key: 'water', name: '水体', color: '#38bdf8', definition: '独立水面', custom: false, on: false },
  { id: 3, key: 'custom:温室', name: '温室', color: '#a78bfa', definition: '用户自定义', custom: true, on: true },
]

const PENDING = {
  id: 'A-01', classKey: 'building', className: '建筑', color: '#f59e0b',
  area_m2: 128.4, clippedAtTileEdge: true, status: 'pending',
}
const ACCEPTED = {
  id: 'A-02', classKey: 'water', className: '水体', color: '#38bdf8',
  area_m2: 900, clippedAtTileEdge: false, status: 'accepted',
}
const REJECTED = {
  id: 'A-03', classKey: 'custom:温室', className: '温室', color: '#a78bfa',
  area_m2: 12, clippedAtTileEdge: false, status: 'rejected',
}

function makeState(overrides = {}) {
  return {
    phase: 'review',
    busy: false,
    progress: null,
    classes: {
      catalog: CATALOG.map((entry) => ({ ...entry })),
      custom: ['温室'],
      summary: 'parse.classesOnly',
    },
    scope: 'view',
    aoi: { ready: false, area_m2: null, drawing: false },
    candidates: [PENDING, ACCEPTED, REJECTED],
    counts: { total: 3, pending: 1, accepted: 1, rejected: 1 },
    filter: 'all',
    selected: ['A-01'],
    activeId: 'A-01',
    report: { calls: 2, windows: 2, failedWindows: 0, complete: true, instances: 3, durationMs: 1200 },
    error: null,
    canRun: true,
    reason: null,
    confirmRerun: false,
    rerun: null,
    primaryLabel: 'parse.start',
    ...overrides,
  }
}

function makeActions(overrides = {}) {
  const calls = []
  const record = (name) => (...args) => calls.push([name, ...args])
  return {
    calls,
    actions: {
      setScope: record('setScope'),
      startDrawAoi: record('startDrawAoi'),
      clearAoi: record('clearAoi'),
      toggleClass: record('toggleClass'),
      addCustomClass: record('addCustomClass'),
      resetClasses: record('resetClasses'),
      run: record('run'),
      stop: record('stop'),
      confirmRun: record('confirmRun'),
      cancelRerun: record('cancelRerun'),
      setFilter: record('setFilter'),
      select: record('select'),
      activate: record('activate'),
      adopt: record('adopt'),
      reject: record('reject'),
      restore: record('restore'),
      remove: record('remove'),
      undo: record('undo'),
      redo: record('redo'),
      flyTo: record('flyTo'),
      exportGeoJson: record('exportGeoJson'),
      clearAll: record('clearAll'),
      ...overrides,
    },
  }
}

const render = (state, actions) => createRenderer(ParseWorkbench, () => ({ t, state, actions }))

/* ------------------------------------------------------------------ tests */

test('首屏：设置 / 开始提取 / 范围 / 类别 / 状态 / 队列 / 导出都在，设置默认折叠', () => {
  const { actions } = makeActions()
  const tree = render(makeState(), actions).tree()
  for (const row of ['head', 'run', 'scope', 'classes', 'status', 'queue', 'export']) {
    assert.equal(findAll(tree, byAttr('data-row', row)).length, 1, `缺少 ${row} 行`)
  }
  assert.equal(findAll(tree, byAttr('data-row', 'settings')).length, 0, '设置默认折叠')
  assert.ok(buttonBy(tree, 'data-action', 'settings-toggle'))
  assert.ok(buttonBy(tree, 'data-action', 'run'))
  assert.equal(findAll(tree, (node) => node.props?.['data-class'] !== undefined).length, CATALOG.length)
  assert.equal(findAll(tree, (node) => node.props?.['role'] === 'listitem').length, 3)
  assert.ok(buttonBy(tree, 'data-action', 'export'))
})

test('设置展开：显示类别定义与多尺度开关', () => {
  const { actions } = makeActions()
  const renderer = render(makeState(), actions)
  buttonBy(renderer.tree(), 'data-action', 'settings-toggle').props.onClick()
  const tree = renderer.tree()
  const settings = findAll(tree, byAttr('data-row', 'settings'))[0]
  assert.ok(settings, '展开后应出现设置区')
  const text = textOf(settings)
  assert.ok(text.includes('parse.settingsClasses'))
  assert.ok(text.includes('parse.settingsResolution'))
  assert.ok(text.includes('parse.settingsTiling'))
  assert.ok(!text.includes('parse.settingsTimeout'))
  const toggles = findAll(settings, (node) => node.type === 'input' && node.props.type === 'checkbox')
  assert.equal(toggles.length, 2)
  assert.equal(toggles[0].props.checked, false)
  assert.equal(findAll(tree, (node) => node.props?.role === 'dialog').length, 0)
})

test('重跑确认：内联“清空并提取”，不渲染 dialog', () => {
  const { actions, calls } = makeActions()
  const tree = render(makeState({ confirmRerun: true, rerun: { total: 3, accepted: 1 }, primaryLabel: 'parse.rerun' }), actions).tree()
  assert.equal(buttonBy(tree, 'data-action', 'run'), undefined)
  const confirm = buttonBy(tree, 'data-action', 'confirm-rerun')
  assert.ok(confirm)
  confirm.props.onClick()
  buttonBy(tree, 'data-action', 'cancel-rerun').props.onClick()
  assert.deepEqual(calls, [['confirmRun'], ['cancelRerun']])
  assert.equal(findAll(tree, (node) => node.props?.role === 'dialog').length, 0)
})

test('busy：主按钮变停止，其余控件统一冻结', () => {
  const { actions, calls } = makeActions()
  const state = makeState({ busy: true, phase: 'segmenting', progress: { done: 1, total: 2 }, canRun: false })
  const tree = render(state, actions).tree()
  const stop = buttonBy(tree, 'data-action', 'stop')
  assert.ok(stop)
  stop.props.onClick()
  assert.deepEqual(calls, [['stop']])
  const settings = buttonBy(tree, 'data-action', 'settings-toggle')
  const enabled = buttons(tree).filter((node) => node.props.disabled !== true && node.props['data-action'] !== 'stop' && node.props['data-action'] !== 'settings-toggle')
  assert.deepEqual(enabled, [], 'busy 时除停止/设置外按钮全部禁用')
  for (const node of findAll(tree, (item) => item.props?.['data-row-action'] !== undefined)) {
    assert.equal(node.props.disabled, true, '行操作在 busy 时禁用')
  }
  assert.ok(textOf(tree).includes('parse.phaseSegmenting'))
})

test('状态行：取景 / 分块进度 / 复核统计都来自 state', () => {
  assert.equal(statusText(t, makeState({ phase: 'idle', report: null })), 'parse.idleHint')
  assert.equal(statusText(t, makeState({ busy: true, phase: 'capturing' })), 'parse.phaseCapturing')
  const segmenting = statusText(t, makeState({
    busy: true,
    phase: 'segmenting',
    progress: { done: 1, total: 4 },
    report: { calls: 1, windows: 4, failedWindows: 2, complete: false, instances: 17, durationMs: 0 },
  }))
  assert.ok(segmenting.includes('parse.phaseSegmenting'))
  assert.ok(segmenting.includes('parse.progressFound'))
  const review = statusText(t, makeState())
  assert.ok(review.includes('parse.reportComplete'))
  assert.equal(statusText(t, makeState({ phase: 'error' })), 'parse.phaseError')
})

test('范围与 AOI：切换调 setScope，未就绪时显示原因并触发框选；就绪后可清除', () => {
  const { actions, calls } = makeActions()
  const tree = render(makeState({ scope: 'aoi', canRun: false, reason: 'parse.needAoi' }), actions).tree()
  buttonBy(tree, 'data-scope', 'view').props.onClick()
  buttonBy(tree, 'data-scope', 'aoi').props.onClick()
  assert.deepEqual(calls.slice(0, 2), [['setScope', 'view'], ['setScope', 'aoi']])
  assert.ok(calls.some(([name, kind]) => name === 'startDrawAoi' && kind === 'rect'), '未就绪时应开始框选')
  const draw = findAll(tree, (node) => node.props?.['data-draw'] === 'rect')[0]
  draw.props.onClick()
  assert.ok(calls.some(([name, kind]) => name === 'startDrawAoi' && kind === 'rect'))
  assert.ok(textOf(tree).includes('parse.needAoi'))
  assert.ok(buttonBy(tree, 'data-action', 'run').props.disabled)
  assert.equal(buttonBy(tree, 'data-action', 'run').props.title, 'parse.needAoi')

  const ready = render(makeState({
    scope: 'aoi',
    aoi: { ready: true, area_m2: 39500.4, drawing: false },
    canRun: true,
    reason: null,
  }), actions).tree()
  assert.ok(textOf(ready).includes('parse.aoiReadyLabel'))
  buttonBy(ready, 'data-aoi-clear', '1').props.onClick()
  assert.ok(calls.some(([name]) => name === 'clearAoi'))
})

test('类别：chip 切换、自定义输入提交、重置都回调; summary 来自 state', () => {
  const { actions, calls } = makeActions()
  const renderer = render(makeState(), actions)
  buttonBy(renderer.tree(), 'data-class', 'building').props.onClick()
  assert.deepEqual(calls.at(-1), ['toggleClass', 'building'])
  buttonBy(renderer.tree(), 'data-action', 'reset-classes').props.onClick()
  assert.deepEqual(calls.at(-1), ['resetClasses'])
  assert.ok(textOf(renderer.tree()).includes('parse.classesOnly'))

  buttonBy(renderer.tree(), 'data-class-add', '1').props.onClick()
  let input = findAll(renderer.tree(), (node) => node.props?.['aria-label'] === 'parse.customInputLabel')[0]
  assert.ok(input, '点击＋自定义后出现行内输入')
  input.props.onChange({ target: { value: '温室' } })
  input = findAll(renderer.tree(), (node) => node.props?.['aria-label'] === 'parse.customInputLabel')[0]
  input.props.onKeyDown({ key: 'Enter', preventDefault() {} })
  assert.deepEqual(calls.at(-1), ['addCustomClass', '温室'])

  const blank = render(makeState(), actions)
  buttonBy(blank.tree(), 'data-class-add', '1').props.onClick()
  const blankInput = findAll(blank.tree(), (node) => node.props?.['aria-label'] === 'parse.customInputLabel')[0]
  blankInput.props.onKeyDown({ key: 'Enter', preventDefault() {} })
  assert.ok(textOf(blank.tree()).includes('parse.customInvalid'))
  assert.ok(!calls.some(([name, value]) => name === 'addCustomClass' && value === ''), '空类别不得提交')
})

test('队列：筛选下拉、全选待审、撤销/重做作用于正确 action', () => {
  const { actions, calls } = makeActions()
  const tree = render(makeState(), actions).tree()
  findAll(tree, (node) => node.props?.['data-filter-select'] === '1')[0]
    .props.onChange({ target: { value: 'accepted' } })
  assert.deepEqual(calls.at(-1), ['setFilter', 'accepted'])
  buttonBy(tree, 'data-queue-action', 'select-pending').props.onClick()
  assert.deepEqual(calls.at(-1), ['select', ['A-01']])
  buttonBy(tree, 'data-action', 'undo').props.onClick()
  buttonBy(tree, 'data-action', 'redo').props.onClick()
  assert.deepEqual(calls.slice(-2), [['undo'], ['redo']])
  const counts = findAll(tree, (node) => String(node.props?.className || '').includes('mv-parse-queue-counts'))[0]
  assert.ok(textOf(counts).includes('parse.queueCounts'))
})

test('行操作：待审 ✓✕、已采纳 ↺✕、已排除 ✓↺，另有删除与定位', () => {
  const { actions, calls } = makeActions()
  const tree = render(makeState(), actions).tree()
  const action = (id, name) => findAll(tree, (node) => node.props?.['data-id'] === id && node.props?.['data-row-action'] === name)[0]
  action('A-01', 'adopt').props.onClick()
  action('A-01', 'reject').props.onClick()
  action('A-02', 'restore').props.onClick()
  action('A-02', 'reject').props.onClick()
  action('A-03', 'adopt').props.onClick()
  action('A-03', 'restore').props.onClick()
  action('A-01', 'remove').props.onClick()
  action('A-01', 'fly').props.onClick()
  assert.deepEqual(calls, [
    ['adopt', ['A-01']],
    ['reject', ['A-01']],
    ['restore', ['A-02']],
    ['reject', ['A-02']],
    ['adopt', ['A-03']],
    ['restore', ['A-03']],
    ['remove', ['A-01']],
    ['flyTo', 'A-01'],
  ])
  const checkbox = findAll(tree, (node) => node.props?.['data-select'] === 'A-02')[0]
  checkbox.props.onChange()
  assert.deepEqual(calls.at(-1), ['select', ['A-01', 'A-02']])
  findAll(tree, (node) => node.props?.['data-item-id'] === 'A-02')[0].props.onClick()
  assert.deepEqual(calls.at(-1), ['activate', 'A-02'])
})

test('筛选只影响展示，空队列显示一句引导', () => {
  assert.deepEqual(filterCandidates([PENDING, ACCEPTED, REJECTED], 'accepted').map((row) => row.id), ['A-02'])
  assert.deepEqual(visibleCandidates(makeState()).map((row) => row.id), ['A-01', 'A-02', 'A-03'])
  const tree = render(makeState({ candidates: [], counts: { total: 0, pending: 0, accepted: 0, rejected: 0 } }), makeActions().actions).tree()
  assert.equal(findAll(tree, (node) => node.props?.['role'] === 'listitem').length, 1)
  assert.ok(textOf(tree).includes('parse.queueEmpty'))
})

test('导出：默认 accepted，切到 all 后以 all 导出；无候选时禁用并说明', () => {
  const { actions, calls } = makeActions()
  const renderer = render(makeState(), actions)
  assert.equal(exportCount(makeState(), 'accepted'), 1)
  assert.equal(exportCount(makeState(), 'all'), 3)
  const initial = findAll(renderer.tree(), (node) => node.props?.['data-action'] === 'export')[0]
  initial.props.onClick()
  assert.deepEqual(calls.at(-1), ['exportGeoJson', 'accepted'])
  findAll(renderer.tree(), (node) => node.props?.['data-export-scope'] === 'all')[0].props.onClick()
  const all = findAll(renderer.tree(), (node) => node.props?.['data-action'] === 'export')[0]
  assert.ok(textOf(all).includes('parse.exportDo'))
  all.props.onClick()
  assert.deepEqual(calls.at(-1), ['exportGeoJson', 'all'])

  const empty = render(makeState({
    candidates: [],
    counts: { total: 0, pending: 0, accepted: 0, rejected: 0 },
  }), makeActions().actions).tree()
  const disabled = findAll(empty, (node) => node.props?.['data-action'] === 'export')[0]
  assert.equal(disabled.props.disabled, true)
  assert.equal(disabled.props.title, 'parse.exportBlocked')
})

test('错误卡片内联提示并给出重试，不渲染弹层', () => {
  const { actions, calls } = makeActions()
  const tree = render(makeState({ phase: 'error', error: { code: 'timeout', message: '解析超时' } }), actions).tree()
  const alert = findAll(tree, (node) => node.props?.role === 'alert')[0]
  assert.ok(alert)
  assert.ok(textOf(alert).includes('解析超时'))
  buttonBy(tree, 'data-action', 'retry').props.onClick()
  assert.deepEqual(calls, [['run']])
  assert.equal(findAll(tree, (node) => node.props?.role === 'dialog').length, 0)
})

test('旧三维/精修/LoD 控件与字段不再出现', () => {
  const state = makeState()
  const serialized = JSON.stringify(state)
  for (const banned of ['height', 'lod1', 'refine', 'czml', 'kml', 'source', 'mode']) {
    assert.equal(serialized.includes(banned), false, `state 不应再有 ${banned}`)
  }
  const tree = render(state, makeActions().actions).tree()
  const text = textOf(tree)
  for (const banned of ['parse.height', 'parse.lod1', 'parse.refine', 'parse.exportFormat', 'parse.mode', 'parse.sourceNote']) {
    assert.equal(text.includes(banned), false, `视图不应再渲染 ${banned}`)
  }
  for (const row of ['mode', 'source', 'height', 'refine', 'lod1']) {
    assert.equal(findAll(tree, byAttr('data-row', row)).length, 0, `不应再有 ${row} 行`)
  }
  assert.equal(findAll(tree, (node) => String(node.props?.['className'] || '').includes('mv-modal')).length, 0)
})

test('300px 窄栏：容器查询、chip 换行与单元格省略，无固定宽表格', () => {
  assert.ok(PARSE_CSS.includes('container-type:inline-size'))
  assert.ok(PARSE_CSS.includes('@container (max-width:340px)'))
  assert.ok(/\.mv-parse-chips\{[^}]*flex-wrap:wrap/.test(PARSE_CSS))
  assert.ok(/\.mv-parse-queue-head\{[^}]*flex-wrap:wrap/.test(PARSE_CSS))
  assert.ok(/\.mv-parse-item-class\{[^}]*overflow:hidden/.test(PARSE_CSS))
  assert.ok(/\.mv-parse-item-area\{[^}]*text-overflow:ellipsis/.test(PARSE_CSS))
  assert.equal(/(?<![-a-z])width:\s*(3[2-9]\d|[4-9]\d{2,})px/.test(PARSE_CSS), false, '不应有超过 300px 的固定宽度')
})
