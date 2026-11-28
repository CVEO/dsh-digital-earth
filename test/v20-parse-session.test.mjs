/**
 * v20 — 快照 v2：面板队列在会话内持久化/恢复，刷新不重跑模型。
 *
 * 用最小 fake viewer/ctx + 内存 localStorage 验证 parse-session 的读写链路：
 * hydrate 保留 id/status/geometry，flushParseSession 写盘，重开会话恢复。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)) },
  removeItem: (key) => { memory.delete(key) },
}

const { parseSession, resetParseSession, flushParseSession, PARSE_PERSIST_LIMIT } = await import('../src/client/ui/parse-session.js')

function makeCtx(viewer, session = 'session-test') {
  return {
    t: (key) => key,
    getCesium: () => ({}),
    getViewer: () => viewer,
    getLayers: () => [],
    getMeta: async () => ({}),
    getSession: () => session,
    showToast: () => {},
    onSyncParse: () => {},
  }
}

test('队列写入 localStorage 后重新挂载可恢复，保留审核状态', () => {
  resetParseSession()
  memory.clear()
  const viewer = {}
  const controller = parseSession(makeCtx(viewer))
  controller.actions.addCustomClass('温室')
  controller.store.startRun({ mode: 'auto', source: 'tiles3d', scope: 'view', classes: ['building'] })
  const [id] = controller.store.addCandidates([{
    type: 'Feature',
    properties: { class: 'building', class_key: 'building', height_m: 12 },
    geometry: { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.301, 30.5], [114.301, 30.501], [114.3, 30.5]]] },
  }])
  controller.store.setStatus([id], 'accepted')
  flushParseSession()

  const key = 'mv.parse.queue.session-test'
  assert.ok(memory.has(key), '应写入会话队列')
  const payload = JSON.parse(memory.get(key))
  assert.equal(payload.version, 2)
  assert.equal(payload.candidates.length, 1)
  assert.equal(payload.candidates[0].properties.status, 'accepted')
  assert.deepEqual(payload.customClasses, ['温室'], '自定义类别随队列持久化')
  assert.equal(payload.scope, 'view')
  assert.ok(PARSE_PERSIST_LIMIT >= 500)

  // 模拟刷新：旧会话释放后，新会话挂载同 session 的 controller
  resetParseSession()
  const freshViewer = {}
  const restored = parseSession(makeCtx(freshViewer))
  const state = restored.getState()
  assert.equal(state.candidates.length, 1, '刷新后应恢复队列')
  assert.equal(state.candidates[0].id, id)
  assert.equal(state.counts.accepted, 1)
  assert.deepEqual(state.classes.custom, ['温室'], '刷新后自定义类别应恢复')
  resetParseSession()
})

test('恢复被截断的队列时提示未持久化行数', () => {
  resetParseSession()
  memory.clear()
  const key = 'mv.parse.queue.session-truncated'
  memory.set(key, JSON.stringify({
    version: 2,
    truncated: 3,
    candidates: [{
      type: 'Feature',
      properties: { id: 'A-01', status: 'pending', class_key: 'building' },
      geometry: null,
    }],
  }))
  const toasts = []
  const viewer = {}
  const controller = parseSession({ ...makeCtx(viewer, 'session-truncated'), showToast: (message) => toasts.push(message) })
  assert.equal(controller.getState().candidates.length, 1)
  assert.equal(toasts.includes('parse.restoreTruncated'), true, '截断恢复应给出提示')
  resetParseSession()
})

test('同一画布切换对话时，分别保存队列和自定义类别', () => {
  resetParseSession()
  memory.clear()
  const viewer = {}
  const a = parseSession(makeCtx(viewer, 'A'))
  a.actions.addCustomClass('温室')
  const b = parseSession(makeCtx(viewer, 'B'))
  assert.notEqual(a, b)
  assert.ok(!b.getState().classes.catalog.some(c => c.name === '温室'))
  b.actions.addCustomClass('塘口')
  const restored = parseSession(makeCtx(viewer, 'A'))
  assert.ok(restored.getState().classes.catalog.some(c => c.name === '温室'))
  assert.ok(!restored.getState().classes.catalog.some(c => c.name === '塘口'))
  resetParseSession()
})
