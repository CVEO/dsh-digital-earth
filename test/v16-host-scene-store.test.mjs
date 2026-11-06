/**
 * v1.6 Phase 2 — the host-backed scene snapshot store.
 *
 * Extracted from ViewerSurface: reads time out (3 s), writes are throttled
 * (10 s) unless forced, oversized bodies stay local-only, and load prefers the
 * host snapshot while keeping the localStorage cache warm.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createHostSceneStore } from '../src/client/scene/host-scene-store.js'

function withFetch(handler, run) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return handler(String(url), options)
  }
  return Promise.resolve(run(calls)).finally(() => {
    globalThis.fetch = original
  })
}

const makeStore = (overrides = {}) =>
  createHostSceneStore({
    getMeta: () => ({ sceneUrl: 'https://host/scene', token: 'tok' }),
    loadMeta: async () => ({ sceneUrl: 'https://host/scene', token: 'tok' }),
    normalizeSceneSnapshot: (raw) => (raw ? { ...raw, normalized: true } : null),
    readSceneSnapshot: () => ({ fromLocal: true }),
    writeSceneSnapshot: () => null,
    ...overrides,
  })

test('read：无 sceneUrl 直接返回 null；成功时走 normalize；异常时返回 null', async () => {
  const noUrl = createHostSceneStore({
    getMeta: () => null,
    loadMeta: async () => null,
    normalizeSceneSnapshot: (raw) => raw,
    readSceneSnapshot: () => null,
    writeSceneSnapshot: () => null,
  })
  assert.equal(await noUrl.readHostSceneSnapshot('s1'), null)

  await withFetch(
    async () => ({ ok: true, json: async () => ({ snapshot: { view: { lon: 1 } } }) }),
    async (calls) => {
      const store = makeStore()
      assert.deepEqual(await store.readHostSceneSnapshot('s1'), { view: { lon: 1 }, normalized: true })
      assert.match(calls[0].url, /session=s1/)
      assert.match(calls[0].url, /token=tok/)
    },
  )

  await withFetch(
    async () => {
      throw new Error('offline')
    },
    async () => {
      assert.equal(await makeStore().readHostSceneSnapshot('s1'), null)
    },
  )
})

test('save：首次写、10 秒内节流、force 强制写、超大 body 不写', async () => {
  await withFetch(
    async () => ({ ok: true }),
    async (calls) => {
      const store = makeStore()
      store.saveHostSceneSnapshot('s1', { a: 1 })
      store.saveHostSceneSnapshot('s1', { a: 2 })
      assert.equal(calls.length, 1, '第二次应在节流窗口内被跳过')
      store.saveHostSceneSnapshot('s1', { a: 3 }, true)
      assert.equal(calls.length, 2, 'force 必须绕过节流')
      assert.equal(calls[0].options.method, 'PUT')
      assert.equal(calls[0].options.keepalive, true)
      store.saveHostSceneSnapshot('s1', { huge: 'x'.repeat(600 * 1024) }, true)
      assert.equal(calls.length, 2, '超过 512 KB 的 body 不应发送')
    },
  )
})

test('load：优先宿主快照并回写本地缓存；宿主没有时回退 localStorage', async () => {
  const writes = []
  const store = makeStore({ writeSceneSnapshot: (session, snapshot) => writes.push({ session, snapshot }) })
  await withFetch(
    async () => ({ ok: true, json: async () => ({ snapshot: { view: null } }) }),
    async () => {
      const loaded = await store.loadSceneSnapshot('s2')
      assert.deepEqual(loaded, { view: null, normalized: true })
      assert.equal(writes.length, 1)
      assert.equal(writes[0].session, 's2')
    },
  )
  await withFetch(
    async () => ({ ok: false, json: async () => ({}) }),
    async () => {
      assert.deepEqual(await store.loadSceneSnapshot('s3'), { fromLocal: true })
    },
  )
})
