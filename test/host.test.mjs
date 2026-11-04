/**
 * 宿主半边的行为自检：自动打开面板时的「等待挂接」，以及最近目录的纯合并。
 *
 * 这些测试不启动 webServer：`apply()` 才注册路由，`createBridge` 与
 * `mergeRecentDirectories` 是显式导出的测试缝。用假的 req/res 顶替 SSE
 * 连接，验证：
 *   - 面板比工具调用晚到几毫秒时，调用会等它挂接而不是立刻失败；
 *   - 面板始终不出现时，等待结束即按 PANEL_CLOSED 拒绝；
 *   - 命令只写到该会话最新的连接，ack 能解决挂起的 promise；
 *   - 目录合并只做纯数据变换（去重、最新在前、截断、不改入参）。
 */
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, createBridge, inject, mergeRecentDirectories } from '../index.js'

/** 一路假的 SSE 连接：收集 res.write 的每一帧。 */
function openConnection() {
  const frames = []
  const req = new EventEmitter()
  const res = {
    writeHead() {},
    write(chunk) {
      frames.push(String(chunk))
      return true
    },
    end() {},
  }
  return { req, res, frames }
}

const commandFrames = (connection) =>
  connection.frames.filter((frame) => frame.startsWith('event: command'))

/** run() 是异步的：让出事件循环，等队列里那一帧真正写出。 */
const flush = () => new Promise((resolve) => setImmediate(resolve))

function commandPayload(connection) {
  const frames = commandFrames(connection)
  assert.equal(frames.length, 1, '最新连接应恰好收到一帧 event: command')
  const line = frames[0].split('\n').find((part) => part.startsWith('data: '))
  return JSON.parse(line.slice('data: '.length))
}

test('宿主入口仍导出 inject/apply，且 createBridge 是测试缝', () => {
  assert.equal(typeof apply, 'function')
  assert.ok(Array.isArray(inject))
  assert.equal(typeof createBridge, 'function')
  assert.equal(typeof mergeRecentDirectories, 'function')
})

test('waitForAttach 在 attach 后返回 true，随后 run 不再以 PANEL_CLOSED 失败', async () => {
  const bridge = createBridge(new Set(), { attachGraceMs: 1000 })
  const waiting = bridge.waitForAttach('session-a', 1000)
  const panel = openConnection()
  bridge.attach('session-a', panel.req, panel.res)
  assert.equal(await waiting, true, 'attach() 应当唤醒等待者')

  const running = bridge.run('session-a', 'status', {}, 1000)
  await flush()
  const payload = commandPayload(panel)
  assert.equal(payload.action, 'status')
  assert.equal(bridge.settle('session-a', payload.id, { ok: true, result: { operation: 'status' } }), true)
  assert.deepEqual(await running, { operation: 'status' })
  bridge.dispose()
})

test('waitForAttach 在超时后返回 false，未连接时 run 以 PANEL_CLOSED 拒绝', async () => {
  const bridge = createBridge(new Set(), { attachGraceMs: 20 })
  assert.equal(await bridge.waitForAttach('session-b', 20), false)
  await assert.rejects(bridge.run('session-b', 'status', {}, 1000), /did not attach in time/)
  assert.equal(bridge.connectedSessions().length, 0)
  bridge.dispose()
})

test('waitForAttach 在 abort 后立即返回 false', async () => {
  const bridge = createBridge(new Set(), { attachGraceMs: 5000 })
  const controller = new AbortController()
  const waiting = bridge.waitForAttach('session-c', 5000, controller.signal)
  controller.abort()
  assert.equal(await waiting, false)
  bridge.dispose()
})

test('挂接后 run 只向最新连接写一帧 command，settle 解决 promise', async () => {
  const bridge = createBridge(new Set(), { attachGraceMs: 1000 })
  const older = openConnection()
  bridge.attach('session-d', older.req, older.res)
  const newer = openConnection()
  bridge.attach('session-d', newer.req, newer.res)

  const running = bridge.run('session-d', 'fly', { lon: 1, lat: 2 }, 1000)
  await flush()
  assert.equal(commandFrames(older).length, 0, '旧标签页必须保持空闲')
  const payload = commandPayload(newer)
  assert.equal(payload.action, 'fly')
  assert.deepEqual(payload.args, { lon: 1, lat: 2 })

  assert.equal(bridge.settle('session-d', payload.id, { ok: true, result: { ok: true, flown: true } }), true)
  assert.deepEqual(await running, { ok: true, flown: true })
  bridge.dispose()
})

test('run 的本地路径门禁仍在等待面板之前拒绝', async () => {
  // 等待 5 秒的 grace，但路径门禁必须先拒绝，不能为了等面板而放行。
  const bridge = createBridge(new Set(['D:/allowed']), { attachGraceMs: 5000 })
  const started = Date.now()
  await assert.rejects(
    bridge.run('session-e', 'load', { path: 'D:/secret/tileset.json' }, 1000),
    /opened in the Digital Earth panel/,
  )
  assert.ok(Date.now() - started < 500, '门禁拒绝不应经过 attach 等待')
  bridge.dispose()
})

test('mergeRecentDirectories 去重、最新在前、截断，且不修改入参', () => {
  const input = [
    { path: 'D:/data/a', at: '2026-01-01T00:00:00.000Z' },
    { path: 'D:/data/b', at: '2026-01-02T00:00:00.000Z' },
  ]
  const snapshot = input.map((entry) => ({ ...entry }))

  const merged = mergeRecentDirectories(input, { path: 'D:/data/c', at: '2026-01-03T00:00:00.000Z' }, 3)
  assert.deepEqual(merged, [
    { path: 'D:/data/c', at: '2026-01-03T00:00:00.000Z' },
    { path: 'D:/data/a', at: '2026-01-01T00:00:00.000Z' },
    { path: 'D:/data/b', at: '2026-01-02T00:00:00.000Z' },
  ])

  // 已存在的路径被顶到最新，而不是重复出现。
  const deduped = mergeRecentDirectories(input, { path: 'D:/data/b', at: '2026-01-04T00:00:00.000Z' }, 20)
  assert.deepEqual(deduped.map((entry) => entry.path), ['D:/data/b', 'D:/data/a'])

  // 上限从头部截断，最新条目保留。
  const capped = mergeRecentDirectories(input, { path: 'D:/data/c', at: '2026-01-03T00:00:00.000Z' }, 2)
  assert.deepEqual(capped.map((entry) => entry.path), ['D:/data/c', 'D:/data/a'])

  // 纯函数：原数组和原条目都不能被改写。
  assert.deepEqual(input, snapshot)
  assert.notEqual(merged, input)

  // 不给时间戳时补一个 ISO 时间，避免出现空 at。
  const stamped = mergeRecentDirectories([], { path: 'D:/data/x' }, 5)
  assert.match(stamped[0].at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
})
