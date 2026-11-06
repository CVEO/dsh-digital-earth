/**
 * v1.6 Phase 2 — the command bridge dispatcher.
 *
 * `runCommand` is the single entry for every panel command (earth_scene actions
 * plus authorize/capture/analyze/shader/report). It used to be a 250-line closure
 * inside ViewerSurface; these tests drive the dispatcher with fake deps so the
 * mapping and the actionable error rules stay pinned.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createCommandBridge } from '../src/client/scene/command-bridge.js'

const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key)

function makeBridge(overrides = {}) {
  const calls = []
  const deps = {
    getCesium: () => ({
      Math: { toDegrees: (r) => (r * 180) / Math.PI, toRadians: (d) => (d * Math.PI) / 180 },
      Cartesian3: { fromDegrees: (lon, lat, height) => ({ lon, lat, height }) },
      Cartesian2: class {
        constructor(x, y) {
          this.x = x
          this.y = y
        }
      },
    }),
    getViewer: () => ({
      camera: { positionCartographic: { longitude: 1, latitude: 0.5, height: 100 }, heading: 0, pitch: 0, flyTo: (value) => calls.push({ flyTo: value }) },
      canvas: { clientWidth: 800, clientHeight: 600, width: 800, height: 600 },
    }),
    getSources: () => ({ imagery: [{ id: 'esri', name: 'Esri' }], terrain: [], settings: {} }),
    getLayers: () => [{ id: 'l1', name: 'Tiles', visible: true, url: 'https://t/tiles?token=secret' }],
    getMeta: () => ({ tilesBase: 'https://host/tiles/', reportUrl: 'https://host/report', captureUrl: 'https://host/capture', token: 'tok' }),
    getAgentOverlays: () => ({ draw: [1], measure: [2], drawnFeatures: 1, measuredCount: 1 }),
    t,
    findLayer: (token) => ({ id: 'l1', name: 'Tiles', visible: true, url: 'https://t/tiles?token=secret' }),
    normalizeAccessRequest: () => ({ directory: 'D:/data' }),
    askPathAccess: async () => ({ allowed: true, directory: 'D:/data' }),
    collectSceneStatus: async () => ({
      view: { lon: 1, lat: 2, height: 3 },
      layers: [{ id: 'l1', name: 'Tiles', visible: true }],
      sources: { imagery: [{ id: 'esri', name: 'Esri' }], terrain: [] },
      imagery: { id: 'esri', name: 'Esri' },
      terrain: null,
    }),
    captureScene: async () => ({ path: '/tmp/a.jpg', url: 'https://host/a.jpg?token=secret', width: 10, height: 10, bytes: 99, hud: false }),
    redactUrl: (url) => String(url).replace(/token=[^&]+/, 'token=***'),
    analyzeCommand: async () => ({ operation: 'clear' }),
    shaderCommand: async () => ({ operation: 'list' }),
    message: (error) => error?.message ?? String(error),
    sourceOfLayer: () => ({ kind: 'local', path: 'D:/data' }),
    layerRuntime: () => ({ tiles: 1 }),
    localPathToUrl: async () => 'https://host/tiles/x/tileset.json',
    loadTileset: async (url) => ({ id: 'new', name: 'New', url }),
    removeLayer: () => ({ name: 'Tiles' }),
    setLayerVisible: () => null,
    applyImagery: async () => ({ ok: true }),
    updateSettings: () => {},
    applyTerrain: async () => ({ ok: true }),
    clampNumber: (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback),
    delay: async () => {},
    resetView: () => calls.push({ reset: true }),
    pickResult: (position) => ({ position }),
    clearAgentOverlays: () => calls.push({ cleared: true }),
    drawAgentOverlay: () => ({ drawn: 1, by_type: { points: 1, lines: 0, polygons: 0 }, bbox: null }),
    measureAgentOverlay: () => ({ mode: 'distance', distance_m: 10 }),
    buildSceneReport: async () => ({ format: 'markdown', title: 'R', sections: ['camera'], failed: [] }),
    ...overrides,
  }
  return { bridge: createCommandBridge(deps), calls }
}

test('status/capture/list：直接返回场景状态，capture 映射并脱敏 URL', async () => {
  const { bridge } = makeBridge()
  const status = await bridge.runCommand('status')
  assert.deepEqual(status.view, { lon: 1, lat: 2, height: 3 })
  assert.equal(status.layers[0].name, 'Tiles')

  const captured = await bridge.runCommand('capture', { width: 10, format: 'png' }, 's1')
  assert.equal(captured.path, '/tmp/a.jpg')
  assert.equal(captured.url, 'https://host/a.jpg?token=***')
  assert.equal(captured.hud_hidden, true)
  assert.equal(captured.layers_visible, 1)
  assert.deepEqual(captured.view, { lon: 1, lat: 2, height: 3 })

  const list = await bridge.runCommand('list')
  assert.deepEqual(list.imagery, { id: 'esri', name: 'Esri' })
  assert.equal(list.layers[0].name, 'Tiles')
})

test('analyze/shader：已是 next: 的错误原样抛，缺 next 的补一条', async () => {
  const { bridge } = makeBridge({
    analyzeCommand: async () => {
      throw new Error('analysis: boom')
    },
  })
  await assert.rejects(() => bridge.runCommand('analyze', {}), /analysis: boom next:/)

  const shaderShort = makeBridge({
    shaderCommand: async () => {
      throw new Error('shader: 3DGS 不支持 next: 换图层')
    },
  })
  await assert.rejects(() => shaderShort.bridge.runCommand('shader', {}), /next: 换图层$/)
})

test('authorize：拒绝时返回 access_denied，允许时返回目录', async () => {
  const denied = makeBridge({ askPathAccess: async () => ({ allowed: false, message: 'no' }) })
  await assert.rejects(() => denied.bridge.runCommand('authorize', {}), /access_denied/)

  const allowed = makeBridge()
  assert.deepEqual(await allowed.bridge.runCommand('authorize', {}), { authorized: true, directory: 'D:/data' })
})

test('load/remove/visible/inspect：图层动作走对应处理，URL 脱敏', async () => {
  const { bridge } = makeBridge()
  const loaded = await bridge.runCommand('load', { path: 'D:/data' })
  assert.equal(loaded.loaded, true)
  assert.equal(loaded.layer.url, 'https://host/tiles/x/tileset.json')
  assert.equal(loaded.layers_count, 1)

  assert.deepEqual(await bridge.runCommand('remove', { layer: 'Tiles' }), { removed: 'Tiles', layers: ['Tiles'] })
  assert.deepEqual(await bridge.runCommand('visible', { layer: 'Tiles', visible: false }), { id: 'l1', name: 'Tiles', visible: true })
  const inspected = await bridge.runCommand('inspect', { layer: 'Tiles' })
  assert.equal(inspected.layer, 'Tiles')
  assert.deepEqual(inspected.runtime, { tiles: 1 })
})

test('fly/reset/pick/draw/measure：相机与叠加动作返回契约字段', async () => {
  const { bridge, calls } = makeBridge()
  const flown = await bridge.runCommand('fly', { lon: 114, lat: 30, height: 5000 })
  assert.deepEqual(flown.view, { lon: 1, lat: 2, height: 3 })
  assert.equal(calls.find((entry) => entry.flyTo).flyTo.destination.height, 5000)
  await bridge.runCommand('reset')
  assert.ok(calls.some((entry) => entry.reset))

  const drawn = await bridge.runCommand('draw', { geojson: { type: 'Point' }, label: 'A' })
  assert.equal(drawn.drawn, 1)
  assert.equal(drawn.label, 'A')
  assert.equal(drawn.overlays, 2)

  const measured = await bridge.runCommand('measure', { mode: 'distance', points: [[0, 0], [1, 1]] })
  assert.equal(measured.distance_m, 10)
  assert.equal(measured.overlays, 2)
})

test('report：POST 报告并只回传本地路径与元数据', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return { ok: true, json: async () => ({ path: '/tmp/report.md', format: 'markdown', bytes: 5 }) }
  }
  try {
    const { bridge } = makeBridge()
    const saved = await bridge.runCommand('report', { format: 'markdown' })
    assert.equal(calls[0].url, 'https://host/report')
    assert.equal(saved.operation, 'report')
    assert.equal(saved.path, '/tmp/report.md')
    assert.equal(saved.title, 'R')
    assert.equal('url' in saved, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('未知 action：抛出带 agent.badAction 的可读错误', async () => {
  const { bridge } = makeBridge()
  await assert.rejects(() => bridge.runCommand('nope'), /agent\.badAction/)
})
