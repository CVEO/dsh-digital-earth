/**
 * 宿主半边的行为自检：自动打开面板时的「等待挂接」，以及最近目录的纯合并。
 *
 * 这些测试不启动 webServer：`apply()` 才注册路由，`createBridge` 与
 * `mergeRecentDirectories` 是显式导出的测试缝。用假的 req/res 顶替 SSE
 * 连接，验证：
 *   - 面板比工具调用晚到几毫秒时，调用会等它挂接而不是立刻失败；
 *   - 面板始终不出现时，等待结束即按 PANEL_CLOSED 拒绝；
 *   - 命令只写到该会话最新的连接，ack 能解决挂起的 promise；
 *   - 本地路径未授权时先请面板授权（authorize 帧）：允许后继续 load，
 *     拒绝为 access_denied，不回答为 access_timeout，不可解析则快速
 *     path_not_found 且不发 authorize；
 *   - 目录合并只做纯数据变换（去重、最新在前、截断、不改入参）。
 */
import { EventEmitter } from 'node:events'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
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

const eventFrames = (connection, event) =>
  connection.frames.filter((frame) => frame.startsWith(`event: ${event}`))

/** 读取连接上第 index 帧 event: <event> 的 JSON payload。 */
function eventPayload(connection, event, index = 0) {
  const frames = eventFrames(connection, event)
  assert.ok(frames.length > index, `缺少第 ${index + 1} 帧 event: ${event}`)
  const line = frames[index].split('\n').find((part) => part.startsWith('data: '))
  return JSON.parse(line.slice('data: '.length))
}

/** 等至少 count 帧 event: <event> 写出：授权与后续 load 是两步异步往返。 */
async function waitForEvents(connection, event, count = 1) {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    if (eventFrames(connection, event).length >= count) return
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5))
  }
  assert.fail(`等待 ${count} 帧 event: ${event} 超时`)
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

test('run 的本地路径未授权时按 authorize 协议：允许/拒绝/超时/不可解析', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsh-earth-auth-'))
  const fixtureFile = join(fixtureRoot, 'tileset.json')
  await writeFile(fixtureFile, '{}')
  // realpath 消除临时目录大小写/短名差异，授权与加载用同一份路径。
  const allowedFolder = await realpath(fixtureRoot)
  const allowedTileset = join(allowedFolder, 'tileset.json')

  try {
    // 0) 已在 allowlist 内的路径：直接发 load，不弹授权。
    {
      const bridge = createBridge(new Set([allowedFolder]), { attachGraceMs: 1000 })
      const panel = openConnection()
      bridge.attach('session-auth-allowed', panel.req, panel.res)
      const running = bridge.run('session-auth-allowed', 'load', { path: allowedTileset }, 1000)
      await waitForEvents(panel, 'command', 1)
      assert.equal(eventPayload(panel, 'command').action, 'load')
      assert.equal(eventFrames(panel, 'command').length, 1, '已授权路径不应出现 authorize 帧')
      const load = eventPayload(panel, 'command')
      assert.equal(bridge.settle('session-auth-allowed', load.id, { ok: true, result: { ok: true, layers: [{ name: 'a' }] } }), true)
      assert.deepEqual(await running, { ok: true, layers: [{ name: 'a' }], layers_count: 1 })
      bridge.dispose()
    }

    // 1) 未授权但可解析：先发 authorize 帧；面板允许（回执 ok + 目录入 allowlist）后继续 load。
    {
      const allowedDirs = new Set()
      const bridge = createBridge(allowedDirs, { attachGraceMs: 1000, authorizeTimeoutMs: 2000 })
      const panel = openConnection()
      bridge.attach('session-auth-allow', panel.req, panel.res)
      const running = bridge.run('session-auth-allow', 'load', { path: allowedTileset }, 1000)
      await waitForEvents(panel, 'command', 1)
      const authorize = eventPayload(panel, 'command')
      assert.equal(authorize.action, 'authorize')
      assert.equal(authorize.args.request, 'load')
      assert.equal(authorize.args.path, resolve(allowedTileset))
      assert.equal(authorize.args.target, allowedTileset)
      assert.equal(authorize.args.directory, allowedFolder)
      assert.equal(authorize.args.kind, 'file')
      assert.equal(authorize.args.resolved, false)
      assert.equal(eventFrames(panel, 'command').length, 1, '授权前不应先发 load')

      allowedDirs.add(allowedFolder)
      assert.equal(bridge.settle('session-auth-allow', authorize.id, { ok: true, result: { allowed: true } }), true)
      await waitForEvents(panel, 'command', 2)
      const load = eventPayload(panel, 'command', 1)
      assert.equal(load.action, 'load')
      assert.equal(load.args.path, allowedTileset)
      assert.equal(bridge.settle('session-auth-allow', load.id, { ok: true, result: { ok: true, layers: [{ name: 'b' }] } }), true)
      assert.deepEqual(await running, { ok: true, layers: [{ name: 'b' }], layers_count: 1 })
      bridge.dispose()
    }

    // 2) 拒绝授权：access_denied，且不再发 load、不重试。
    {
      const bridge = createBridge(new Set(), { attachGraceMs: 1000, authorizeTimeoutMs: 2000 })
      const panel = openConnection()
      bridge.attach('session-auth-deny', panel.req, panel.res)
      const running = bridge.run('session-auth-deny', 'load', { path: allowedTileset }, 1000)
      await waitForEvents(panel, 'command', 1)
      const authorize = eventPayload(panel, 'command')
      assert.equal(authorize.action, 'authorize')
      assert.equal(bridge.settle('session-auth-deny', authorize.id, { ok: false, error: 'the user denied' }), true)
      await assert.rejects(running, /\[access_denied\]/)
      assert.equal(eventFrames(panel, 'command').length, 1, '拒绝后不得再发 load 或重试授权')
      bridge.dispose()
    }

    // 3) 一直不回答授权框：独立于场景超时的 access_timeout。
    {
      const bridge = createBridge(new Set(), { attachGraceMs: 1000, authorizeTimeoutMs: 80 })
      const panel = openConnection()
      bridge.attach('session-auth-timeout', panel.req, panel.res)
      const started = Date.now()
      const running = bridge.run('session-auth-timeout', 'load', { path: allowedTileset }, 1000)
      await waitForEvents(panel, 'command', 1)
      assert.equal(eventPayload(panel, 'command').action, 'authorize')
      // 计时的授权 deadline 是 unref 的；测试里自己保持事件循环存活，否则
      // node --test 会在计时器到点前判定「promise 仍挂起但事件循环已空」。
      const keepAlive = setInterval(() => {}, 10)
      try {
        await assert.rejects(running, /\[access_timeout\]/)
      } finally {
        clearInterval(keepAlive)
      }
      assert.ok(Date.now() - started < 2000, '授权超时不应等待场景命令的 1s 时效')
      bridge.dispose()
    }

    // 4) 不可解析的路径：快速 path_not_found，不发 authorize，也不进入 attach 等待。
    {
      // 从当前盘符/根目录出发构造一条「最近父级也不存在」的绝对路径：
      // 字面量 "D:/..." 在 POSIX 上是相对路径，"/..." 在 Windows 上也不是绝对路径，
      // 直接写死会让这条用例只在其中一个平台成立（CI 曾因此在 Linux 上失败）。
      const missingPath = join(parse(process.cwd()).root, `dsh-earth-missing-${process.pid}-${Date.now()}`, 'tileset.json')
      const bridge = createBridge(new Set(), { attachGraceMs: 5000 })
      const panel = openConnection()
      bridge.attach('session-auth-missing', panel.req, panel.res)
      const started = Date.now()
      await assert.rejects(
        bridge.run('session-auth-missing', 'load', { path: missingPath }, 1000),
        /\[path_not_found\]/,
      )
      assert.ok(Date.now() - started < 1000, '路径不存在不应经过 5s 的 attach 等待')
      assert.equal(eventFrames(panel, 'command').length, 0, '不可解析路径不得发 authorize 或 command 帧')
      bridge.dispose()
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
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
