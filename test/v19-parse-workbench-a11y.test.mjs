/**
 * v1.9 — accessibility contract of the 2D extraction workbench.
 *
 * The panel is a single non-modal surface, so it carries its own affordances: one
 * aria-live status row, a real list of candidate rows, titled buttons, named chip
 * groups and a collapsed settings section that never becomes a dialog. These are
 * structural checks on element props, not visual checks.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { ParseWorkbench } = await import('../src/client/ui/parse-workbench.js')

const t = (key) => key

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

const CANDIDATES = [
  { id: 'A-01', classKey: 'building', className: '建筑', color: '#f59e0b', area_m2: 128.4, clippedAtTileEdge: true, status: 'pending' },
  { id: 'A-02', classKey: 'water', className: '水体', color: '#38bdf8', area_m2: 900, clippedAtTileEdge: false, status: 'accepted' },
]

function makeState(overrides = {}) {
  return {
    phase: 'review',
    busy: false,
    progress: null,
    classes: {
      catalog: [
        { id: 1, key: 'building', name: '建筑', color: '#f59e0b', definition: '屋顶轮廓', custom: false, on: true },
        { id: 2, key: 'water', name: '水体', color: '#38bdf8', definition: '独立水面', custom: false, on: true },
      ],
      custom: [],
      summary: 'parse.classesAll',
    },
    scope: 'aoi',
    aoi: { ready: true, area_m2: 1200, drawing: false },
    candidates: CANDIDATES,
    counts: { total: 2, pending: 1, accepted: 1, rejected: 0 },
    filter: 'all',
    selected: ['A-01'],
    activeId: 'A-01',
    report: { calls: 1, windows: 1, failedWindows: 0, complete: true, instances: 2, durationMs: 900 },
    error: { code: 'timeout', message: '超时' },
    canRun: true,
    reason: null,
    confirmRerun: false,
    rerun: null,
    primaryLabel: 'parse.start',
    ...overrides,
  }
}

const actions = {
  setScope() {}, startDrawAoi() {}, clearAoi() {}, toggleClass() {}, addCustomClass() {},
  resetClasses() {}, run() {}, stop() {}, confirmRun() {}, cancelRerun() {}, setFilter() {},
  select() {}, activate() {}, adopt() {}, reject() {}, restore() {}, remove() {}, undo() {},
  redo() {}, flyTo() {}, exportGeoJson() {}, clearAll() {},
}

const render = (state = makeState()) => createRenderer(ParseWorkbench, () => ({ t, state, actions }))

test('只有一行 aria-live 状态，进度与复核统计都由它播报', () => {
  for (const state of [makeState(), makeState({ busy: true, phase: 'segmenting', progress: { done: 1, total: 2 } }), makeState({ phase: 'idle', report: null })]) {
    const live = findAll(render(state).tree(), (node) => node.props?.['aria-live'] !== undefined)
    assert.equal(live.length, 1, '状态行必须唯一')
    assert.equal(live[0].props['aria-live'], 'polite')
    assert.equal(live[0].props.role, 'status')
  }
  const busyText = textOf(findAll(render(makeState({ busy: true, phase: 'segmenting', progress: { done: 1, total: 2 } })).tree(), (node) => node.props?.role === 'status')[0])
  assert.ok(busyText.includes('parse.phaseSegmenting'))
})

test('每个按钮都有 title；单字符图标按钮另有 aria-label；禁用态同样有 title', () => {
  for (const state of [makeState(), makeState({ busy: true, phase: 'capturing' }), makeState({ confirmRerun: true, rerun: { total: 2, accepted: 1 } })]) {
    const tree = render(state).tree()
    const all = findAll(tree, (node) => node.type === 'button')
    assert.ok(all.length > 10)
    for (const button of all) {
      const label = textOf(button).trim()
      assert.equal(typeof button.props.title, 'string', `按钮 "${label}" 缺少 title`)
      assert.ok(button.props.title.length > 0, `按钮 "${label}" 的 title 为空`)
      if ([...label].length <= 1) {
        assert.equal(typeof button.props['aria-label'], 'string', `图标按钮 "${label}" 需要 aria-label`)
        assert.ok(button.props['aria-label'].length > 0)
      }
    }
  }
})

test('候选队列是真实列表：容器 role=list，每行 role=listitem 且可多选', () => {
  const tree = render().tree()
  const lists = findAll(tree, (node) => node.props?.role === 'list')
  assert.equal(lists.length, 1)
  assert.equal(typeof lists[0].props['aria-label'], 'string')
  const rows = findAll(tree, (node) => node.props?.role === 'listitem')
  assert.equal(rows.length, CANDIDATES.length)
  const checks = findAll(tree, (node) => node.type === 'input' && node.props?.type === 'checkbox')
  assert.equal(checks.length, CANDIDATES.length)
  for (const check of checks) {
    assert.equal(typeof check.props['aria-label'], 'string')
    assert.ok(check.props['aria-label'].length > 0)
  }
})

test('分段组、chip 组与导出范围都有 aria-label，选择状态用 aria-pressed', () => {
  const tree = render().tree()
  const groups = findAll(tree, (node) => node.props?.role === 'group')
  assert.ok(groups.length >= 4)
  for (const group of groups) {
    assert.equal(typeof group.props['aria-label'], 'string', 'group 需要 aria-label')
    assert.ok(group.props['aria-label'].length > 0)
  }
  const toggles = findAll(tree, (node) => node.props?.['data-scope'] !== undefined || node.props?.['data-class'] !== undefined || node.props?.['data-export-scope'] !== undefined)
  assert.ok(toggles.length > 0)
  for (const node of toggles) assert.equal(typeof node.props['aria-pressed'], 'boolean')
})

test('自定义类别输入有 aria-label，展开设置不产生 modal/浮层', () => {
  const renderer = render()
  const add = findAll(renderer.tree(), (node) => node.props?.['data-class-add'] !== undefined)[0]
  add.props.onClick()
  const input = findAll(renderer.tree(), (node) => node.props?.['aria-label'] === 'parse.customInputLabel')
  assert.equal(input.length, 1)
  const settings = findAll(renderer.tree(), (node) => node.props?.['data-action'] === 'settings-toggle')[0]
  assert.equal(settings.props['aria-expanded'], false)
  settings.props.onClick()
  const tree = renderer.tree()
  const expanded = findAll(tree, (node) => node.props?.['data-action'] === 'settings-toggle')[0]
  assert.equal(expanded.props['aria-expanded'], true)
  for (const node of findAll(tree, () => true)) {
    const className = String(node.props?.className || '')
    assert.ok(!className.includes('mv-modal'), 'no modal overlay')
    assert.notEqual(node.props?.role, 'dialog')
    assert.ok(!String(node.props?.style?.['position'] || '').includes('fixed'), 'no fixed overlay')
  }
})

test('错误用 role=alert 内联播报，重试是带 title 的按钮', () => {
  const tree = render(makeState({ phase: 'error', error: { code: 'timeout', message: '超时' } })).tree()
  const alerts = findAll(tree, (node) => node.props?.role === 'alert')
  assert.equal(alerts.length, 1)
  assert.ok(textOf(alerts[0]).includes('超时'))
  const retry = findAll(tree, (node) => node.props?.['data-action'] === 'retry')[0]
  assert.ok(retry)
  assert.equal(typeof retry.props.title, 'string')
  assert.ok(retry.props.title.length > 0)
})
