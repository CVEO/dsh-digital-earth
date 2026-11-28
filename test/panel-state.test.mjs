import assert from 'node:assert/strict'
import test from 'node:test'

const {
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  PANEL_STORAGE_KEY,
  createPanelState,
  normalizePanelState,
  panelReducer,
  readPanelState,
  visiblePanelTabs,
  writePanelState,
} = await import('../src/client/ui/panel-state.js')

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}

test('默认状态：图层优先、展开、默认宽度、无工具、无未读', () => {
  const state = createPanelState()
  assert.equal(state.activeTab, 'layers')
  assert.equal(state.collapsed, false)
  assert.equal(state.width, PANEL_DEFAULT_WIDTH)
  assert.equal(state.openTool, null)
  assert.deepEqual(state.unread, { result: false, object: false })
})

test('归一化：脏数据回落默认，宽度夹取，未读只接受布尔真', () => {
  assert.equal(normalizePanelState(null).activeTab, 'layers')
  assert.equal(normalizePanelState('garbage').activeTab, 'layers')
  assert.equal(normalizePanelState({ activeTab: 'nope' }).activeTab, 'layers')
  assert.equal(normalizePanelState({ width: 100 }).width, PANEL_MIN_WIDTH)
  assert.equal(normalizePanelState({ width: 9999 }).width, PANEL_MAX_WIDTH)
  assert.equal(normalizePanelState({ width: 'abc' }).width, PANEL_DEFAULT_WIDTH)
  assert.deepEqual(normalizePanelState({ unread: { result: 'yes', object: 1 } }).unread, { result: false, object: false })
  assert.equal(normalizePanelState({ openTool: 42 }).openTool, null)
})

test('activate：切页签会展开、清未读；重复激活保持展开', () => {
  let state = createPanelState({ collapsed: true, unread: { result: true, object: false } })
  state = panelReducer(state, { type: 'activate', tabId: 'result' })
  assert.equal(state.activeTab, 'result')
  assert.equal(state.collapsed, false)
  assert.equal(state.unread.result, false)

  state = panelReducer(state, { type: 'activate', tabId: 'result' })
  assert.equal(state.collapsed, false)
})

test('toggle：点当前页签收起，再点展开；点其他页签切换并展开', () => {
  let state = createPanelState()
  state = panelReducer(state, { type: 'toggle', tabId: 'layers' })
  assert.equal(state.collapsed, true)
  state = panelReducer(state, { type: 'toggle', tabId: 'layers' })
  assert.equal(state.collapsed, false)
  state = panelReducer(state, { type: 'toggle', tabId: 'tools' })
  assert.equal(state.activeTab, 'tools')
  assert.equal(state.collapsed, false)
})

test('collapse/expand 幂等', () => {
  let state = createPanelState()
  const collapsed = panelReducer(state, { type: 'collapse' })
  assert.equal(collapsed.collapsed, true)
  assert.equal(panelReducer(collapsed, { type: 'collapse' }), collapsed)
  const expanded = panelReducer(collapsed, { type: 'expand' })
  assert.equal(expanded.collapsed, false)
  assert.equal(panelReducer(expanded, { type: 'expand' }), expanded)
})

test('宽度夹取在 reducer 内完成，非法值保持原宽度', () => {
  let state = createPanelState()
  state = panelReducer(state, { type: 'setWidth', width: 640 })
  assert.equal(state.width, 640)
  state = panelReducer(state, { type: 'setWidth', width: 10 })
  assert.equal(state.width, PANEL_MIN_WIDTH)
  state = panelReducer(state, { type: 'setWidth', width: 'bad' })
  assert.equal(state.width, PANEL_MIN_WIDTH)
})

test('openTool：工具页签 + 单活工具；closeTool 只清工具', () => {
  let state = createPanelState()
  state = panelReducer(state, { type: 'openTool', toolId: 'effects' })
  assert.equal(state.activeTab, 'tools')
  assert.equal(state.openTool, 'effects')
  state = panelReducer(state, { type: 'openTool', toolId: 'measure' })
  assert.equal(state.openTool, 'measure')
  state = panelReducer(state, { type: 'closeTool' })
  assert.equal(state.openTool, null)
  assert.equal(state.activeTab, 'tools')
  assert.equal(panelReducer(state, { type: 'openTool', toolId: '' }).openTool, null)
})

test('resultArrived：空闲且展开时切到结果，忙碌时只挂未读', () => {
  let idle = createPanelState({ activeTab: 'layers' })
  idle = panelReducer(idle, { type: 'resultArrived', busy: false })
  assert.equal(idle.activeTab, 'result')
  assert.equal(idle.unread.result, false)

  let busy = createPanelState({ activeTab: 'layers' })
  busy = panelReducer(busy, { type: 'resultArrived', busy: true })
  assert.equal(busy.activeTab, 'layers')
  assert.equal(busy.unread.result, true)
})

test('resultArrived：收起时绝不自动展开，重复到达不重复写', () => {
  let state = createPanelState({ collapsed: true, activeTab: 'tools' })
  state = panelReducer(state, { type: 'resultArrived', busy: false })
  assert.equal(state.collapsed, true)
  assert.equal(state.activeTab, 'tools')
  assert.equal(state.unread.result, true)
  assert.equal(panelReducer(state, { type: 'resultArrived', busy: false }), state)
})

test('objectArrived 同样遵守忙碌/收起策略，并记录对象序号', () => {
  let state = createPanelState()
  state = panelReducer(state, { type: 'objectArrived', busy: false, seq: 3 })
  assert.equal(state.activeTab, 'object')
  assert.equal(state.objectSeq, 3)
  let busy = panelReducer(createPanelState(), { type: 'objectArrived', busy: true, seq: 4 })
  assert.equal(busy.activeTab, 'layers')
  assert.equal(busy.unread.object, true)
  assert.equal(busy.objectSeq, 4)
})

test('objectCleared：对象页签回图层并清未读', () => {
  let state = createPanelState({ activeTab: 'object', unread: { result: false, object: true }, objectSeq: 2 })
  state = panelReducer(state, { type: 'objectCleared' })
  assert.equal(state.activeTab, 'layers')
  assert.equal(state.unread.object, false)
  assert.equal(state.objectSeq, 0)
})

test('clearUnread：只清指定页签', () => {
  let state = createPanelState({ unread: { result: true, object: true } })
  state = panelReducer(state, { type: 'clearUnread', tabId: 'result' })
  assert.deepEqual(state.unread, { result: false, object: true })
})

test('prune：活动页签不可用时回退到第一个可用页签', () => {
  const available = ['layers', 'tools']
  let state = createPanelState({ activeTab: 'result' })
  state = panelReducer(state, { type: 'prune', available })
  assert.equal(state.activeTab, 'layers')

  state = createPanelState({ activeTab: 'object' })
  state = panelReducer(state, { type: 'prune', available: ['tools'] })
  assert.equal(state.activeTab, 'tools')

  state = createPanelState({ activeTab: 'tools' })
  assert.equal(panelReducer(state, { type: 'prune', available: ['layers', 'tools'] }), state)
})

test('visiblePanelTabs：图层/工具/地名检索/结果常驻，对象按内容出现，顺序固定', () => {
  assert.deepEqual(visiblePanelTabs(), ['layers', 'tools', 'places', 'result'])
  assert.deepEqual(visiblePanelTabs({ hasResult: true }), ['layers', 'tools', 'places', 'result'])
  assert.deepEqual(visiblePanelTabs({ hasResult: true, hasObject: true }), ['layers', 'tools', 'places', 'result', 'object'])
})

test('readPanelState：无存储回默认；坏 JSON 不抛', () => {
  assert.equal(readPanelState(memoryStorage()).activeTab, 'layers')
  assert.equal(readPanelState(memoryStorage({ [PANEL_STORAGE_KEY]: '{{{' })).activeTab, 'layers')
})

test('readPanelState：v2 优先于旧右栏键', () => {
  const storage = memoryStorage({
    [PANEL_STORAGE_KEY]: JSON.stringify({ version: 2, activeTab: 'object', collapsed: true, width: 420, openTool: 'effects' }),
    'mv.rightDock.v1': JSON.stringify({ activeId: 'analysis' }),
  })
  const state = readPanelState(storage)
  assert.equal(state.activeTab, 'object')
  assert.equal(state.collapsed, true)
  assert.equal(state.width, 420)
  assert.equal(state.openTool, 'effects')
})

test('readPanelState：旧键迁移 analysis→result、toolwin→tools+openTool', () => {
  const analysis = readPanelState(memoryStorage({ 'mv.rightDock.v1': JSON.stringify({ activeId: 'analysis' }) }))
  assert.equal(analysis.activeTab, 'result')
  const tool = readPanelState(memoryStorage({ 'mv.rightDock.v1': JSON.stringify({ activeId: 'toolwin:effects' }) }))
  assert.equal(tool.activeTab, 'tools')
  assert.equal(tool.openTool, 'effects')
})

test('writePanelState：带 version=2 写回，且坏存储不抛', () => {
  const storage = memoryStorage()
  writePanelState(createPanelState({ activeTab: 'result', width: 500 }), storage)
  const raw = JSON.parse(storage.getItem(PANEL_STORAGE_KEY))
  assert.equal(raw.version, 2)
  assert.equal(raw.activeTab, 'result')
  assert.equal(raw.width, 500)
  assert.doesNotThrow(() => writePanelState(createPanelState(), { setItem: () => { throw new Error('nope') } }))
})
