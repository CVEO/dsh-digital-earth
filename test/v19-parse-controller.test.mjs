/**
 * v19 — 2D 提取工作台控制器（src/client/ui/parse-controller.js）端到端冒烟测试。
 *
 * 只断言运行时契约：状态机 → 真实 scene/instance-segment.js → annotation store
 * → 叠加层回调 → GeoJSON 导出。`t` 直接返回 key，所以不断言任何文案。
 *
 * 假的 viewer/Cesium/document 只实现被调用到的浏览器接口；测试用的 fetch 返回
 * 宿主 `/vision-instances` 的成功/失败/挂起响应，用于覆盖取消与重跑。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { createParseController } = await import('../src/client/ui/parse-controller.js')

const deg = (value) => (value * Math.PI) / 180

/** Fake Cesium namespace: enough for captureOrtho + selection ring projection. */
function makeFakeCesium() {
  class Cartesian2 {
    constructor(x, y) {
      this.x = Number(x)
      this.y = Number(y)
    }
  }
  class Cartesian3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
  }
  Cartesian3.fromDegrees = (lon, lat, height = 0) => ({ lon, lat, height })
  Cartesian3.clone = (value) => ({ ...value })
  return {
    Cartesian2,
    Cartesian3,
    Cartographic: {
      fromCartesian: (cartesian) => (cartesian && Number.isFinite(cartesian.lon) && Number.isFinite(cartesian.lat)
        ? { longitude: deg(cartesian.lon), latitude: deg(cartesian.lat), height: Number(cartesian.height ?? 0) }
        : null),
    },
    Math: { toDegrees: (radians) => (radians * 180) / Math.PI, fromDegrees: deg },
    ScreenSpaceEventHandler: class {
      setInputAction() {}
      destroy() {}
    },
    ScreenSpaceEventType: { LEFT_DOWN: 0, LEFT_UP: 1, LEFT_CLICK: 2, MOUSE_MOVE: 3, LEFT_DOUBLE_CLICK: 4 },
    SceneTransforms: { worldToWindowCoordinates: () => new Cartesian2(0, 0) },
    PolygonHierarchy: class {
      constructor(points) {
        this.positions = points
      }
    },
    Color: { fromCssColorString: (css) => ({ css, withAlpha: (alpha) => ({ css, alpha }) }) },
  }
}

/** Fake viewer: a fixed 800x600 viewport over 114.3E / 30.5N. */
function makeFakeViewer() {
  const canvas = {
    width: 800, height: 600, clientWidth: 800, clientHeight: 600,
    style: {}, getContext: () => ({ drawImage() {} }),
  }
  const groundOf = (position) => ({
    lon: 114.3 + (Number(position?.x) || 0) * 1e-5,
    lat: 30.5 + (600 - (Number(position?.y) || 0)) * 1e-5,
    height: 5,
  })
  const camera = {
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    pitch: -Math.PI / 2,
    roll: 0,
    positionCartographic: { longitude: deg(114.3), latitude: deg(30.5), height: 900 },
    frustum: { fov: Math.PI / 3, aspectRatio: 800 / 600 },
    setView: () => {},
    cancelFlight: () => {},
    flyTo: () => {},
    getPickRay: (position) => ({ position }),
    pickEllipsoid: (position) => groundOf(position),
  }
  const scene = {
    canvas,
    mode: 'SCENE3D',
    morphTime: 0,
    pickPositionSupported: true,
    pickPosition: (position) => groundOf(position),
    globe: {
      ellipsoid: {},
      tilesLoaded: true,
      pick: (ray) => (ray?.position ? groundOf(ray.position) : null),
    },
    imageryLayers: [],
    screenSpaceCameraController: {},
    requestRender: () => {},
  }
  return {
    canvas,
    camera,
    scene,
    render: () => {},
    resize: () => {},
    resolutionScale: 1,
    isDestroyed: () => false,
  }
}

/** Minimal document: canvas creation for the capture + anchor for downloads. */
function installFakeDocument() {
  const previous = globalThis.document
  const anchors = []
  globalThis.document = {
    visibilityState: 'visible',
    body: { appendChild: () => {} },
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage() {} }),
          toDataURL: () => 'data:image/jpeg;base64,AAAA',
        }
      }
      const anchor = { href: '', download: '', rel: '', click: () => {}, remove: () => {} }
      anchors.push(anchor)
      return anchor
    },
  }
  return { anchors, restore: () => { globalThis.document = previous } }
}

function installFakeUrl() {
  const previous = { Blob: globalThis.Blob, URL: globalThis.URL }
  const blobs = []
  globalThis.Blob = class {
    constructor(parts, options) {
      this.parts = parts
      this.type = options?.type ?? ''
      blobs.push(this)
    }
  }
  globalThis.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} }
  return { blobs, restore: () => Object.assign(globalThis, previous) }
}

/** One normalized 0..1000 polygon, returned for every tile request. */
const INSTANCE = { classId: 1, polygon: [[100, 100], [900, 100], [900, 900], [100, 900]] }

function installFetch(handler) {
  const previous = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null
    requests.push({ url, body })
    return handler({ url, body, init, requests })
  }
  return { requests, restore: () => { globalThis.fetch = previous } }
}

const okResponse = (instances) => ({ ok: true, json: async () => ({ ok: true, instances }) })

/** Poll until `predicate(state)` or the deadline; throws with the last state. */
async function waitFor(controller, predicate, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let state = controller.getState()
  while (!predicate(state)) {
    if (Date.now() > deadline) throw new Error(`等待超时，最后状态：${JSON.stringify({ phase: state.phase, busy: state.busy })}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
    state = controller.getState()
  }
  return state
}

function makeCtx({ viewer, Cesium, meta, syncCalls, toasts }) {
  return {
    t: (key) => key,
    getCesium: () => Cesium,
    getViewer: () => viewer,
    getLayers: () => [],
    getMeta: () => meta,
    showToast: (message) => { toasts.push(message) },
    onSyncParse: (collection) => { syncCalls.push(collection) },
  }
}

function setup({ meta = { visionInstancesUrl: '/api/vision-instances/token' } } = {}) {
  const Cesium = makeFakeCesium()
  const viewer = makeFakeViewer()
  const syncCalls = []
  const toasts = []
  const doc = installFakeDocument()
  const url = installFakeUrl()
  const controller = createParseController(makeCtx({ viewer, Cesium, meta, syncCalls, toasts }))
  return {
    Cesium,
    viewer,
    controller,
    syncCalls,
    toasts,
    doc,
    url,
    cleanup: () => { controller.dispose(); doc.restore(); url.restore() },
  }
}

test('run 成功：候选入库、采纳后只把 accepted 同步到叠加层', async () => {
  const { controller, syncCalls, cleanup } = setup()
  const fetchStub = installFetch(() => okResponse([INSTANCE]))
  try {
    controller.actions.run()
    await waitFor(controller, (state) => !state.busy && state.phase === 'review')
    const state = controller.getState()
    assert.equal(state.report.complete, true)
    assert.ok(state.report.instances > 0, '应至少识别一个实例')
    assert.equal(state.candidates.length, state.report.instances)
    assert.equal(state.counts.pending, state.candidates.length)
    assert.equal(state.candidates[0].status, 'pending')
    assert.ok(state.candidates[0].classKey, '候选应带类别 key')
    assert.ok(Number.isFinite(state.candidates[0].area_m2), '候选应带投影面积')
    assert.ok(fetchStub.requests.length >= 2, '800x600 画面应至少分成 2 个窗口')
    assert.equal(fetchStub.requests[0].url, '/api/vision-instances/token')

    const acceptedId = state.candidates[0].id
    syncCalls.length = 0
    controller.actions.adopt([acceptedId])
    const after = controller.getState()
    assert.equal(after.counts.accepted, 1)
    assert.equal(syncCalls.length, 1, '采纳后同步一次叠加层')
    assert.equal(syncCalls[0].features.length, 1)
    assert.equal(syncCalls[0].features[0].properties.status, 'accepted')
  } finally {
    fetchStub.restore()
    cleanup()
  }
})

test('取消提取保留既有队列，并回到 review 而不是 error', async () => {
  const { controller, cleanup } = setup()
  let hang = false
  const fetchStub = installFetch(({ init }) => {
    if (!hang) return okResponse([INSTANCE])
    return new Promise((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })
  })
  try {
    controller.actions.run()
    await waitFor(controller, (state) => !state.busy && state.phase === 'review')
    const before = controller.getState()
    controller.actions.adopt([before.candidates[0].id])

    hang = true
    controller.actions.run()
    assert.equal(controller.getState().confirmRerun, true, '有候选时先进入重跑确认')
    controller.actions.confirmRun()
    await waitFor(controller, (state) => state.busy)
    controller.actions.stop()
    const after = await waitFor(controller, (state) => !state.busy)
    assert.equal(after.phase, 'review')
    assert.equal(after.error, null)
    assert.equal(after.candidates.length, before.candidates.length, '取消不得清空队列')
    assert.equal(after.counts.accepted, 1, '取消不得丢失已采纳状态')
  } finally {
    fetchStub.restore()
    cleanup()
  }
})

test('确认重跑：confirmRerun 带计数，取消后不改队列，确认后替换队列', async () => {
  const { controller, cleanup } = setup()
  const fetchStub = installFetch(() => okResponse([INSTANCE, INSTANCE]))
  try {
    controller.actions.run()
    await waitFor(controller, (state) => !state.busy && state.phase === 'review')
    const first = controller.getState()
    controller.actions.run()
    const confirming = controller.getState()
    assert.equal(confirming.confirmRerun, true)
    assert.deepEqual(confirming.rerun, { total: first.counts.total, accepted: 0 })
    controller.actions.cancelRerun()
    assert.equal(controller.getState().confirmRerun, false)
    assert.equal(controller.getState().candidates.length, first.candidates.length)

    controller.actions.run()
    controller.actions.confirmRun()
    await waitFor(controller, (state) => !state.busy && state.phase === 'review')
    assert.equal(controller.getState().counts.total, 2, '成功后按新结果替换队列')
  } finally {
    fetchStub.restore()
    cleanup()
  }
})

test('AOI：无选区时 canRun=false，提交选区后记录 bbox 面积；跨 180° 拒绝', async () => {
  const { controller, toasts, cleanup } = setup()
  const fetchStub = installFetch(() => okResponse([INSTANCE]))
  try {
    controller.actions.setScope('aoi')
    let state = controller.getState()
    assert.equal(state.scope, 'aoi')
    assert.equal(state.canRun, false)
    assert.equal(state.reason, 'parse.needAoi')

    controller._onSelection({
      type: 'commit',
      selection: {
        kind: 'rect',
        ring: [[114.3, 30.5], [114.302, 30.5], [114.302, 30.502], [114.3, 30.5]],
        area_m2: 39500.4,
      },
    })
    state = controller.getState()
    assert.equal(state.aoi.ready, true)
    assert.equal(state.aoi.area_m2, 39500.4)
    assert.equal(state.canRun, true)

    controller._onSelection({
      type: 'commit',
      selection: {
        kind: 'rect',
        ring: [[179, 10], [-179, 10], [-179, 11], [179, 10]],
        area_m2: 1000,
      },
    })
    state = controller.getState()
    assert.equal(state.aoi.ready, false, '跨 180° 的选区必须拒绝')
    assert.ok(toasts.includes('parse.err.antimeridian'))

    controller.actions.clearAoi()
    state = controller.getState()
    assert.equal(state.aoi.ready, false)
    assert.equal(state.canRun, false)
  } finally {
    fetchStub.restore()
    cleanup()
  }
})

test('自定义类别追加并选中，重置恢复默认 8 类', () => {
  const { controller, cleanup } = setup()
  try {
    const initial = controller.getState()
    assert.equal(initial.classes.catalog.length, 8, '默认 8 类')
    assert.ok(initial.classes.catalog.every((entry) => entry.on === true))
    assert.equal(initial.classes.custom.length, 0)

    controller.actions.addCustomClass('温室')
    const added = controller.getState()
    assert.deepEqual(added.classes.custom, ['温室'])
    const custom = added.classes.catalog.find((entry) => entry.name === '温室')
    assert.ok(custom, '自定义类别应进入目录')
    assert.equal(custom.custom, true)
    assert.equal(custom.on, true)
    assert.equal(added.classes.catalog.length, 9, '总数为默认 8 + 自定义')

    controller.actions.toggleClass(custom.key)
    assert.equal(controller.getState().classes.catalog.find((entry) => entry.key === custom.key).on, false)

    controller.actions.addCustomClass('')
    controller.actions.resetClasses()
    const reset = controller.getState()
    assert.deepEqual(reset.classes.custom, [])
    assert.ok(reset.classes.catalog.every((entry) => entry.custom === false && entry.on === true))
  } finally {
    cleanup()
  }
})

test('导出 GeoJSON：accepted / all 两种范围，坐标只有经纬度', async () => {
  const { controller, doc, url, cleanup } = setup()
  const fetchStub = installFetch(() => okResponse([INSTANCE]))
  try {
    controller.actions.run()
    await waitFor(controller, (state) => !state.busy && state.phase === 'review')
    const state = controller.getState()
    controller.actions.adopt([state.candidates[0].id])

    doc.anchors.length = 0
    url.blobs.length = 0
    assert.equal(controller.actions.exportGeoJson('accepted'), true)
    assert.equal(doc.anchors.length, 1)
    assert.match(doc.anchors[0].download, /\.geojson$/)
    assert.equal(url.blobs.length, 1)
    const collection = JSON.parse(url.blobs[0].parts[0])
    assert.equal(collection.type, 'FeatureCollection')
    assert.equal(collection.features.length, 1, '默认只导出已采纳')
    assert.equal(collection.features[0].geometry.coordinates[0][0].length, 2, '2D 导出不得带 Z')

    doc.anchors.length = 0
    url.blobs.length = 0
    assert.equal(controller.actions.exportGeoJson('all'), true)
    const all = JSON.parse(url.blobs[0].parts[0])
    assert.equal(all.features.length, state.counts.total, 'all 包含未采纳')
  } finally {
    fetchStub.restore()
    cleanup()
  }
})

test('快照：payload 带 customClasses/scope，恢复后队列、状态与类别还原', async () => {
  const { controller, cleanup } = setup()
  const fetchStub = installFetch(() => okResponse([INSTANCE]))
  try {
    controller.actions.addCustomClass('温室')
    controller.actions.run()
    await waitFor(controller, (state) => !state.busy && state.phase === 'review')
    controller.actions.adopt([controller.getState().candidates[0].id])
    const payload = controller.snapshotPayload()
    assert.equal(payload.version, 2)
    assert.deepEqual(payload.customClasses, ['温室'])
    assert.equal(payload.scope, 'view')
    assert.ok(payload.candidates.length > 0)

    const second = setup()
    try {
      const restored = second.controller.restoreSnapshot(payload)
      assert.equal(restored, true)
      const state = second.controller.getState()
      assert.equal(state.candidates.length, payload.candidates.length)
      assert.equal(state.counts.accepted, 1)
      assert.deepEqual(state.classes.custom, ['温室'])
      assert.equal(state.phase, 'review')
    } finally {
      second.cleanup()
    }
  } finally {
    fetchStub.restore()
    cleanup()
  }
})

test('缺少宿主提取地址时进入可控错误态，而不是抛异常', async () => {
  const { controller, cleanup } = setup({ meta: {} })
  try {
    controller.actions.run()
    const state = await waitFor(controller, (next) => next.phase === 'error')
    assert.equal(state.error.code, 'unavailable')
    assert.equal(state.busy, false)
  } finally {
    cleanup()
  }
})

test('类别载荷与范围传给真实提取管线；视图过滤只影响展示', async () => {
  const { controller, cleanup } = setup()
  const fetchStub = installFetch(() => okResponse([INSTANCE]))
  try {
    controller.actions.addCustomClass('温室')
    controller.actions.run()
    await waitFor(controller, (state) => !state.busy && state.phase === 'review')
    const body = fetchStub.requests[0].body
    assert.equal(body.mode, 'polygon')
    assert.ok(Array.isArray(body.classes) && body.classes.length > 0)
    assert.ok(body.classes.some((entry) => entry.name === '温室'), '自定义类别应随请求发送')

    const state = controller.getState()
    controller.actions.setFilter('pending')
    assert.equal(controller.getState().filter, 'pending')
    controller.actions.setFilter('accepted')
    assert.equal(controller.getState().filter, 'accepted')
    assert.equal(state.candidates.length, controller.getState().candidates.length, '筛选不改队列')
  } finally {
    fetchStub.restore()
    cleanup()
  }
})
