/**
 * v1.6 Phase 2 — scene status and "Ask Agent" are their own modules.
 *
 * `collectSceneStatus` output is a frozen additive contract the Agent reads, and
 * `askAgent` injects a textual scene summary even when capture/status fail. Both
 * used to live inside ViewerSurface; these tests drive them with fake deps.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createAskAgent } from '../src/client/scene/ask-agent.js'
import { createSceneStatus } from '../src/client/scene/status.js'
import { readRepoFile } from './helpers/source.mjs'

const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key)

function makeStatus(overrides = {}) {
  const viewer = {
    camera: { positionCartographic: { longitude: 1.995, latitude: 0.532, height: 812.4 }, heading: 0.3, pitch: -0.7 },
    canvas: { width: 1200, height: 700 },
    resolutionScale: 0.85,
    scene: { globe: { depthTestAgainstTerrain: true, maximumScreenSpaceError: 3 } },
  }
  return createSceneStatus({
    getCesium: () => ({ Math: { toDegrees: (radians) => (radians * 180) / Math.PI } }),
    getViewer: () => viewer,
    getSources: () => ({
      imagery: [{ id: 'esri', name: 'Esri' }],
      terrain: [{ id: 'arc', name: 'ArcGIS' }],
      settings: { imagery: 'esri', terrain: 'arc', quality: 'high', screenshotHud: true },
    }),
    getLayers: () => [
      {
        id: 'l1',
        name: 'Tiles',
        visible: true,
        url: 'https://host/tiles?token=secret',
        tileset: { statistics: { numberOfTilesWithContentReady: 12, numberOfPendingRequests: 1, numberOfTrianglesSelected: 3400 } },
      },
    ],
    getOverlayLayers: () => ({ list: () => [{ id: 'o1', name: 'Flood', opacity: 0.5, visible: true }] }),
    getAgentOverlays: () => ({ drawnFeatures: 3, measuredCount: 5, draw: [1], measure: [2, 3] }),
    getToolMode: () => 'distance',
    getFps: () => 59.6,
    getBusy: () => 'loading',
    t,
    redactUrl: (url) => String(url).replace(/token=[^&]+/, 'token=***'),
    normalizeQuality: (value) => (value === 'high' ? 'high' : 'balanced'),
    ...overrides,
  }).collectSceneStatus()
}

test('status：相机/图层统计/来源/叠加/render 加法字段齐全', async () => {
  const status = await makeStatus()
  assert.equal(status.ready, true)
  assert.deepEqual(status.view, { lon: 114.30508, lat: 30.481355, height: 812, heading: 17, pitch: -40 })
  assert.equal(status.layers[0].tiles, 12)
  assert.equal(status.layers[0].pending, 1)
  assert.equal(status.layers[0].triangles, 3400)
  // token never leaks into status.
  assert.equal(status.layers[0].url, 'https://host/tiles?token=***')
  assert.deepEqual(status.imagery, { id: 'esri', name: 'Esri' })
  assert.deepEqual(status.terrain, { id: 'arc', name: 'ArcGIS' })
  assert.deepEqual(status.raster_overlays, [{ id: 'o1', name: 'Flood', opacity: 0.5, visible: true }])
  assert.deepEqual(status.viewport, { width: 1200, height: 700 })
  assert.deepEqual(status.render, {
    fps: 60,
    idle: false,
    terrain_depth_test: true,
    quality: 'high',
    resolution_scale: 0.85,
    globe_maximum_screen_space_error: 3,
  })
  assert.deepEqual(status.snapshot, { includeHud: true })
  assert.equal(status.measureTool, 'distance')
  assert.deepEqual(status.annotations, { drawn_features: 3, measured_points: 5, overlays: 3 })
  assert.equal(status.busy, 'loading')
})

test('status：空闲时 fps=null，busy 缺省为空串', async () => {
  const status = await makeStatus({ getFps: () => null, getBusy: () => undefined })
  assert.equal(status.render.fps, null)
  assert.equal(status.render.idle, true)
  assert.equal(status.busy, '')
})

test('askAgent：注入文本包含相机/图层/叠加/分析/着色器/快照', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return { ok: true, json: async () => ({ ok: true }) }
  }
  const toasts = []
  try {
    const service = createAskAgent({
      getMeta: () => ({ injectUrl: 'https://host/inject', captureUrl: 'https://host/capture', token: 'tok' }),
      getSession: () => 's1',
      getAnalysis: () => ({ result: { operation: 'profile', length_m: 1000, stats: { relief_m: 10 }, samples: 32 } }),
      showToast: (text) => toasts.push(text),
      t,
      captureScene: async () => ({ path: '/tmp/shot.jpg' }),
      collectSceneStatus: async () => makeStatus(),
      shaderActiveList: () => [{ layer: 'Tiles', preset: 'contour' }],
      message: (error) => error?.message ?? String(error),
    })
    await service.askAgent()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://host/inject')
    assert.equal(calls[0].body.session, 's1')
    const text = calls[0].body.text
    assert.match(text, /\[Digital Earth scene context\]/)
    assert.match(text, /Camera: lon=114\.3/)
    assert.match(text, /Layers: Tiles\./)
    assert.match(text, /Imagery: Esri; terrain: ArcGIS\./)
    assert.match(text, /Analysis \(profile\): length=1000 m/)
    assert.match(text, /Shaders: Tiles=contour\./)
    assert.match(text, /Snapshot: \/tmp\/shot\.jpg/)
    assert.ok(toasts.some((entry) => entry.includes('toast.askAgentSent')))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('askAgent：无会话/无 injectUrl 只提示，不发请求', async () => {
  let fetchCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    fetchCalls += 1
    return { ok: true, json: async () => ({ ok: true }) }
  }
  const toasts = []
  try {
    await createAskAgent({
      getMeta: () => ({}),
      getSession: () => 's1',
      getAnalysis: () => null,
      showToast: (text) => toasts.push(text),
      t,
      captureScene: async () => ({}),
      collectSceneStatus: async () => null,
      shaderActiveList: () => [],
      message: (error) => error?.message ?? String(error),
    }).askAgent()
    assert.equal(fetchCalls, 0)
    assert.ok(toasts[0].includes('toast.askAgentNoSession'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('askAgent：采集与状态都失败时仍注入文字摘要；注入失败只 toast', async () => {
  const toasts = []
  let injectedBody = null
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, options) => {
    injectedBody = JSON.parse(options.body)
    return { ok: false, json: async () => ({ message: 'boom' }) }
  }
  try {
    const service = createAskAgent({
      getMeta: () => ({ injectUrl: 'https://host/inject' }),
      getSession: () => 's2',
      getAnalysis: () => null,
      showToast: (text) => toasts.push(text),
      t,
      captureScene: async () => {
        throw new Error('hidden')
      },
      collectSceneStatus: async () => {
        throw new Error('cold')
      },
      shaderActiveList: () => [],
      message: (error) => error?.message ?? String(error),
    })
    await service.askAgent()
    assert.match(injectedBody.text, /\[Digital Earth scene context\]/)
    assert.doesNotMatch(injectedBody.text, /Camera:/)
    assert.ok(toasts.some((entry) => entry.includes('toast.askAgentFailed')))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('拆分：ViewerSurface 只保留 status/ask 的接线', () => {
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /const collectSceneStatus = \(\) => sceneStatus\.collectSceneStatus\(\)/)
  assert.match(viewer, /const askAgent = \(\) => askAgentService\.askAgent\(\)/)
  assert.doesNotMatch(viewer, /async function collectSceneStatus\(\) \{/)
  assert.doesNotMatch(viewer, /async function askAgent\(\) \{/)
})
