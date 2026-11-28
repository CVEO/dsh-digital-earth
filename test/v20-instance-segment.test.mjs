/**
 * v20 — 正射分块实例分割测试（src/client/scene/instance-segment.js）。
 *
 * fake viewer / Cesium / document / fetch 覆盖真实调用链：captureOrtho →
 * 分块窗口 → POST /vision-instances → 块坐标回映 → 跨窗去重 → GeoJSON。
 * 假地图可逆（设备像素 ↔ 经纬度），因此每个 Feature 的坐标、面积、去重取舍
 * 与请求块都精确可断言；不依赖真实网络、GPU 或 DOM。
 *
 * 覆盖语义：单窗成功、多窗映射、halo 扩边、跨窗去重、局部失败四分重试、
 * 失败块保留、maxCalls 截断、取消（返回 cancelled 且恢复相机）、bbox 过滤、
 * 参数校验。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { segmentInstances, planTileWindows, INSTANCE_LIMITS } = await import('../src/client/scene/instance-segment.js')

const deg = (value) => (value * Math.PI) / 180
const clamp = (value, low, high) => (value < low ? low : value > high ? high : value)
const closeTo = (actual, expected, epsilon = 1e-5) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected} (${Math.abs(actual - expected)})`)

/** fake Cesium：Cartesian2 是构造器，Cartographic 读 fake 点上的 lon/lat（角度）。 */
function makeCesium() {
  class Cartesian2 {
    constructor(x, y) {
      this.x = Number(x)
      this.y = Number(y)
    }
  }
  class Cartesian3 {}
  Cartesian3.fromDegrees = (lon, lat, height = 0) => ({ lon: Number(lon), lat: Number(lat), height: Number(height) })
  Cartesian3.clone = (value) => (value && typeof value === 'object' ? { ...value } : value)
  return {
    Cartesian2,
    Cartesian3,
    Cartographic: {
      fromCartesian: (cartesian) => (cartesian && Number.isFinite(cartesian.lon) && Number.isFinite(cartesian.lat)
        ? { longitude: deg(cartesian.lon), latitude: deg(cartesian.lat), height: Number(cartesian.height ?? 0) }
        : null),
    },
    Math: { toDegrees: (radians) => (radians * 180) / Math.PI, fromDegrees: deg },
  }
}

/**
 * fake viewer：render() 按 resolutionScale 重算 drawing buffer；假地图以相机中心
 * 为原点，1 CSS px = 1e-5°（随相机高度线性缩放），因此正射取景高度变化时
 * 视野也真的变宽/变窄。
 */
function makeViewer(options = {}) {
  const {
    clientWidth = 800,
    clientHeight = 600,
    cameraLon = 114.3,
    cameraLat = 30.5,
    cameraHeight = 800,
    degPerPixel = 1e-5,
  } = options
  const canvas = { clientWidth, clientHeight, width: clientWidth, height: clientHeight }
  const controller = {
    enableInputs: true,
    enableRotate: true,
    enableTranslate: true,
    enableZoom: true,
    enableTilt: true,
    enableLook: true,
  }
  const camera = {
    position: { lon: cameraLon, lat: cameraLat, height: cameraHeight },
    positionCartographic: { longitude: deg(cameraLon), latitude: deg(cameraLat), height: cameraHeight },
    heading: 0,
    pitch: -Math.PI / 3,
    roll: 0,
    frustum: { fov: Math.PI / 3, aspectRatio: clientWidth / clientHeight },
    setViewCalls: [],
    setView(view) {
      this.setViewCalls.push(view)
      const destination = view?.destination
      if (destination && typeof destination === 'object') {
        this.position = { lon: destination.lon, lat: destination.lat, height: destination.height }
        this.positionCartographic = {
          longitude: deg(destination.lon),
          latitude: deg(destination.lat),
          height: destination.height,
        }
      }
      if (view?.orientation) {
        this.heading = view.orientation.heading
        this.pitch = view.orientation.pitch
        this.roll = view.orientation.roll
      }
    },
    cancelFlight() {},
    getPickRay(position) {
      return { position }
    },
    pickEllipsoid(position) {
      return pixelGround(position)
    },
  }
  const pixelGround = (position) => {
    const scale = camera.position.height / 800
    return {
      lon: camera.position.lon + (position.x - clientWidth / 2) * degPerPixel * scale,
      lat: camera.position.lat - (position.y - clientHeight / 2) * degPerPixel * scale,
      height: 0,
    }
  }
  const scene = {
    canvas,
    pickPositionSupported: true,
    pickPosition: (position) => pixelGround(position),
    globe: { ellipsoid: { id: 'fake-ellipsoid' }, pick: (ray) => (ray?.position ? pixelGround(ray.position) : null) },
    screenSpaceCameraController: controller,
    requestRender() {},
  }
  return {
    canvas,
    camera,
    scene,
    resolutionScale: 1,
    render() {
      canvas.width = Math.round(clientWidth * this.resolutionScale)
      canvas.height = Math.round(clientHeight * this.resolutionScale)
    },
    isDestroyed: () => false,
  }
}

/** fake document：toDataURL 里编码块矩形（宽高@left,top），供 fake fetch 解码。 */
function installFakeDocument() {
  const previous = globalThis.document
  const images = []
  globalThis.document = {
    visibilityState: 'visible',
    createElement() {
      const element = {
        width: 0,
        height: 0,
        lastDraw: null,
        getContext() {
          return {
            drawImage: (...args) => {
              element.lastDraw = args
            },
          }
        },
        toDataURL(type, quality) {
          const draw = Array.isArray(element.lastDraw) ? element.lastDraw : []
          const left = draw.length >= 5 ? draw[1] : 0
          const top = draw.length >= 5 ? draw[2] : 0
          images.push({ type, quality, width: element.width, height: element.height, draw })
          return `data:image/jpeg;base64,${element.width}x${element.height}@${left},${top}`
        },
      }
      return element
    },
  }
  return {
    images,
    restore() {
      globalThis.document = previous
    },
  }
}

function decodeImageRect(dataUrl) {
  const match = /^data:image\/jpeg;base64,(\d+)x(\d+)@(-?\d+),(-?\d+)/.exec(String(dataUrl ?? ''))
  assert.ok(match, `unexpected request image: ${String(dataUrl).slice(0, 80)}`)
  return { width: Number(match[1]), height: Number(match[2]), left: Number(match[3]), top: Number(match[4]) }
}

/** 期望的 lon/lat：设备像素 → CSS → 假地图（相机中心为中心）。 */
function expectedLonLat(viewer, deviceX, deviceY) {
  const { canvas, camera } = viewer
  const scale = camera.position.height / 800
  const cssX = deviceX * (canvas.clientWidth / canvas.width)
  const cssY = deviceY * (canvas.clientHeight / canvas.height)
  return {
    lon: camera.position.lon + (cssX - canvas.clientWidth / 2) * 1e-5 * scale,
    lat: camera.position.lat - (cssY - canvas.clientHeight / 2) * 1e-5 * scale,
  }
}

function objectBBox(object) {
  const xs = object.polygon.map(([x]) => x)
  const ys = object.polygon.map(([, y]) => y)
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
}

/**
 * fake fetch：请求图像编码了块矩形，全图坐标（设备像素）的对象按块裁剪后
 * 用 0..1000 归一化坐标返回，与宿主实例协议一致。
 */
function makeFetch(respond) {
  const requests = []
  let count = 0
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    const rect = decodeImageRect(body.image)
    const request = { url, body, rect, index: count, signal: init.signal, headers: init.headers, method: init.method }
    count += 1
    requests.push(request)
    return respond(request)
  }
  return { fetchImpl, requests }
}

/** 按全图设备像素构造对象列表返回响应。 */
function respondWithObjects(objects) {
  return (request) => {
    const { rect } = request
    const instances = []
    for (const object of objects) {
      const bbox = objectBBox(object)
      const intersects = bbox.left < rect.left + rect.width && rect.left < bbox.right &&
        bbox.top < rect.top + rect.height && rect.top < bbox.bottom
      if (!intersects) continue
      instances.push({
        classId: object.classId,
        polygon: object.polygon.map(([x, y]) => [
          clamp(Math.round(((x - rect.left) / rect.width) * 1000), 0, 1000),
          clamp(Math.round(((y - rect.top) / rect.height) * 1000), 0, 1000),
        ]),
      })
    }
    return { ok: true, json: async () => ({ ok: true, instances, usage: { total_tokens: 12 }, finish: 'stop' }) }
  }
}

function emptyResponse() {
  return { ok: true, json: async () => ({ ok: true, instances: [], usage: {}, finish: 'stop' }) }
}

const CLASSES = [
  { id: 1, name: 'building', definition: '单栋建筑屋顶外轮廓', key: 'building', color: '#f0b84b' },
  { id: 2, name: 'water', definition: '独立水面/塘口', key: 'water', color: '#1d4ed8' },
]

const square = (classId, left, top, size) => ({
  classId,
  polygon: [[left, top], [left + size, top], [left + size, top + size], [left, top + size]],
})

test('planTileWindows 等分核心窗并按 halo 扩边', () => {
  const windows = planTileWindows({ width: 1536, height: 768, tileSize: 768, halo: 48 })
  assert.equal(windows.length, 6)
  assert.deepEqual(windows.map((window) => window.id), ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'])
  assert.deepEqual(windows[0].core, { left: 0, top: 0, width: 512, height: 384 })
  assert.deepEqual(windows[0].rect, { left: 0, top: 0, width: 560, height: 432 })
  assert.deepEqual(windows[5].core, { left: 1024, top: 384, width: 512, height: 384 })
  assert.deepEqual(windows[5].rect, { left: 976, top: 336, width: 560, height: 432 })
  for (const window of windows) {
    assert.ok(window.rect.left >= 0 && window.rect.top >= 0)
    assert.ok(window.rect.left + window.rect.width <= 1536)
    assert.ok(window.rect.top + window.rect.height <= 768)
    assert.ok(window.rect.width <= 1024 && window.rect.height <= 1024)
  }
  // A frame that fits the tile size is one window.
  assert.equal(planTileWindows({ width: 600, height: 400, tileSize: 768, halo: 48 }).length, 1)
  // Bad tiling knobs fail instead of sending oversized images.
  assert.throws(() => planTileWindows({ width: 800, height: 600, tileSize: 1100, halo: 48 }), (error) => error.code === 'invalid_request')
  assert.throws(() => planTileWindows({ width: 800, height: 600, tileSize: 768, halo: 400 }), (error) => error.code === 'invalid_request')
  assert.deepEqual(INSTANCE_LIMITS.tileSize, 768)
  assert.deepEqual(INSTANCE_LIMITS.halo, 48)
})

test('单窗口成功：全图坐标映射、属性与请求体正确', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer({ clientWidth: 500, clientHeight: 320 })
    const objects = [square(1, 100, 80, 200)]
    const { fetchImpl, requests } = makeFetch(respondWithObjects(objects))
    const progress = []
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/api/vision-instances/token' },
      classes: CLASSES,
      fetchImpl,
      onProgress: (event) => progress.push(event),
    })
    const { collection, cancelled, report } = result
    assert.equal(cancelled, false)
    assert.equal(report.calls, 1)
    assert.equal(report.windows, 1)
    assert.deepEqual(report.failedWindows, [])
    assert.deepEqual(report.errors, [])
    assert.equal(report.complete, true)
    assert.equal(report.instances, 1)
    assert.ok(report.durationMs >= 0)
    assert.equal(report.source.width, 600)
    assert.equal(report.source.height, 384)
    assert.ok(report.source.bbox)
    assert.equal(collection.type, 'FeatureCollection')
    assert.equal(collection.features.length, 1)
    const [feature] = collection.features
    assert.deepEqual(Object.keys(feature.properties).sort(), ['area_m2', 'class_id', 'class_key', 'class_name', 'color'])
    assert.equal(feature.properties.class_id, 1)
    assert.equal(feature.properties.class_key, 'building')
    assert.equal(feature.properties.class_name, 'building')
    assert.equal(feature.properties.color, '#f0b84b')
    assert.ok(feature.properties.area_m2 > 15000 && feature.properties.area_m2 < 30000)
    assert.equal(feature.geometry.type, 'Polygon')
    const [ring] = feature.geometry.coordinates
    assert.equal(ring.length, 5)
    assert.deepEqual(ring[4], ring[0])
    // First vertex: device (100, 80) in the full 600x384 frame.
    const topLeft = expectedLonLat(viewer, 100, 80)
    closeTo(ring[0][0], topLeft.lon)
    closeTo(ring[0][1], topLeft.lat)
    // The fake model rounds to 0..1000, so the mapped pixel is within ~1 device px.
    for (const [lon, lat] of ring) {
      assert.ok(lon > 114.29 && lon < 114.31)
      assert.ok(lat > 30.49 && lat < 30.51)
    }
    // Request contract.
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'POST')
    assert.equal(requests[0].url, '/api/vision-instances/token')
    assert.equal(requests[0].headers['content-type'], 'application/json')
    assert.equal(requests[0].headers['x-dsh-panel'], 'vision-instances')
    assert.equal(requests[0].body.mode, 'polygon')
    assert.deepEqual(requests[0].body.classes, [
      { id: 1, name: 'building', definition: '单栋建筑屋顶外轮廓' },
      { id: 2, name: 'water', definition: '独立水面/塘口' },
    ])
    assert.deepEqual(requests[0].rect, { left: 0, top: 0, width: 600, height: 384 })
    // JPEG quality is applied by the capture (read path).
    assert.equal(dom.images[0].quality, 0.85)
    // Progress: one window, no error field on success.
    assert.equal(progress.length, 1)
    assert.deepEqual(progress[0], { phase: 'window', done: 1, total: 1, found: 1, windowId: 'w1' })
    // The camera is back where the user left it.
    assert.equal(viewer.camera.setViewCalls.length, 2)
    assert.equal(viewer.resolutionScale, 1)
    const restored = viewer.camera.setViewCalls[1].destination
    closeTo(restored.lon, 114.3)
    closeTo(restored.lat, 30.5)
    closeTo(restored.height, 800)
    closeTo(viewer.camera.pitch, -Math.PI / 3)
  } finally {
    dom.restore()
  }
})

test('多窗口：每块按自身 rect 映射到全图', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer() // 960 x 720 device px, four 480x360 cores
    const objects = [
      square(1, 220, 160, 40),
      square(1, 700, 160, 40),
      square(1, 220, 520, 40),
      square(1, 700, 520, 40),
    ]
    const { fetchImpl, requests } = makeFetch(respondWithObjects(objects))
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
    })
    assert.equal(result.report.calls, 4)
    assert.equal(result.report.windows, 4)
    assert.equal(result.report.complete, true)
    assert.equal(result.report.instances, 4)
    assert.equal(result.collection.features.length, 4)
    assert.deepEqual(
      requests.map((request) => request.rect),
      [
        { left: 0, top: 0, width: 528, height: 408 },
        { left: 432, top: 0, width: 528, height: 408 },
        { left: 0, top: 312, width: 528, height: 408 },
        { left: 432, top: 312, width: 528, height: 408 },
      ],
    )
    // Each object is fully inside its own core, so no tile-edge marker.
    for (const feature of result.collection.features) assert.equal(feature.properties.clippedAtTileEdge, undefined)
    // The four centroids map to the four device-pixel centres.
    const centroids = result.collection.features.map((feature) => {
      const [ring] = feature.geometry.coordinates
      const open = ring.slice(0, -1)
      return {
        lon: open.reduce((sum, [lon]) => sum + lon, 0) / open.length,
        lat: open.reduce((sum, [, lat]) => sum + lat, 0) / open.length,
      }
    })
    const expectedCentres = [
      expectedLonLat(viewer, 240, 180),
      expectedLonLat(viewer, 720, 180),
      expectedLonLat(viewer, 240, 540),
      expectedLonLat(viewer, 720, 540),
    ]
    for (const expected of expectedCentres) {
      assert.ok(
        centroids.some((centroid) => Math.abs(centroid.lon - expected.lon) < 1e-5 && Math.abs(centroid.lat - expected.lat) < 1e-5),
        `missing centroid near ${expected.lon},${expected.lat}`,
      )
    }
  } finally {
    dom.restore()
  }
})

test('跨窗去重：同对象只保留完整的一份，不同类别各留一份', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    // One building and one pond on the same footprint, straddling the x=480
    // core border between w1 and w2.
    const footprint = [[440, 100], [540, 100], [540, 180], [440, 180]]
    const objects = [
      { classId: 1, polygon: footprint },
      { classId: 2, polygon: footprint },
    ]
    const { fetchImpl } = makeFetch(respondWithObjects(objects))
    const found = []
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
      onProgress: (event) => found.push(event.found),
    })
    assert.equal(result.report.calls, 4)
    assert.equal(result.report.complete, true)
    // w1 sees a clip at x=528, w2 sees the whole footprint: one copy per class.
    assert.equal(result.report.instances, 2)
    const byClass = new Map(result.collection.features.map((feature) => [feature.properties.class_key, feature]))
    assert.deepEqual([...byClass.keys()].sort(), ['building', 'water'])
    for (const feature of byClass.values()) {
      assert.equal(feature.properties.clippedAtTileEdge, undefined)
      const lons = feature.geometry.coordinates[0].map(([lon]) => lon)
      // The kept outline reaches the far device column 540 (not the clipped 528).
      closeTo(Math.max(...lons), expectedLonLat(viewer, 540, 100).lon)
      closeTo(Math.min(...lons), expectedLonLat(viewer, 440, 100).lon)
    }
    // Progress found counts merged instances only, never the duplicates.
    assert.ok(found.every((count) => count <= 2))
    assert.equal(found[found.length - 1], 2)
  } finally {
    dom.restore()
  }
})

test('halo 内的实例不入库，由相邻核心窗口负责', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    // x 500..520 lies in w1's halo (core ends at 480) and in w2's core.
    const objects = [square(1, 500, 100, 20)]
    const { fetchImpl } = makeFetch(respondWithObjects(objects))
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
    })
    assert.equal(result.report.calls, 4)
    assert.equal(result.report.complete, true)
    assert.equal(result.report.instances, 1)
    const [feature] = result.collection.features
    assert.equal(feature.properties.clippedAtTileEdge, undefined)
    closeTo(Math.min(...feature.geometry.coordinates[0].map(([lon]) => lon)), expectedLonLat(viewer, 500, 100).lon)
  } finally {
    dom.restore()
  }
})

test('局部失败四分重试一层：父失败记账，子窗口成功', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    const { fetchImpl, requests } = makeFetch((request) => {
      if (request.index === 0) return { ok: false, status: 500, json: async () => ({ ok: false }) }
      return emptyResponse()
    })
    const progress = []
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
      onProgress: (event) => progress.push(event),
    })
    // w1 fails, four children are requested, then the other three top windows.
    assert.equal(result.report.calls, 8)
    assert.equal(result.report.windows, 8)
    assert.deepEqual(result.report.failedWindows, [])
    assert.equal(result.report.complete, true)
    assert.equal(result.report.errors.length, 1)
    assert.deepEqual(result.report.errors[0], { windowId: 'w1', depth: 0, reason: 'http_500' })
    // Parent says w1 failed and announces the four children it queued.
    const failedEvent = progress.find((event) => event.windowId === 'w1')
    assert.ok(failedEvent)
    assert.equal(failedEvent.error, 'http_500')
    assert.equal(failedEvent.done, 1)
    assert.equal(failedEvent.total, 8)
    // Child requests carry their own (smaller) rects and stay inside the frame.
    for (const request of requests.slice(1, 5)) {
      assert.ok(request.rect.width <= 528 && request.rect.height <= 408)
      assert.ok(request.rect.width >= 32 && request.rect.height >= 32)
    }
  } finally {
    dom.restore()
  }
})

test('网络失败与失败块保留：complete=false 但成功块成果保留', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    const objects = [square(1, 620, 100, 40)] // lives in w2's core
    const { fetchImpl } = makeFetch((request) => {
      if (request.index === 0) throw new Error('boom')
      return respondWithObjects(objects)(request)
    })
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
      maxDepth: 0,
    })
    assert.equal(result.report.calls, 4)
    assert.equal(result.report.windows, 4)
    assert.equal(result.report.complete, false)
    assert.deepEqual(result.report.failedWindows, [{ windowId: 'w1', depth: 0, reason: 'network' }])
    assert.equal(result.report.errors.length, 1)
    assert.equal(result.report.errors[0].reason, 'network')
    assert.equal(result.report.instances, 1)
    assert.equal(result.collection.features.length, 1)
    assert.equal(result.collection.features[0].properties.class_id, 1)
  } finally {
    dom.restore()
  }

  // maxCalls truncation: queued windows are reported, never silently dropped.
  const dom2 = installFakeDocument()
  try {
    const viewer = makeViewer()
    const { fetchImpl } = makeFetch(() => emptyResponse())
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
      maxCalls: 2,
    })
    assert.equal(result.report.calls, 2)
    assert.equal(result.report.windows, 4)
    assert.equal(result.report.complete, false)
    assert.deepEqual(
      result.report.failedWindows.map((window) => window.reason),
      ['max_calls', 'max_calls'],
    )
  } finally {
    dom2.restore()
  }
})

test('全块无效响应触发四分重试（协议级失败）', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer({ clientWidth: 500, clientHeight: 320 }) // single window
    let served = 0
    const { fetchImpl } = makeFetch(() => {
      served += 1
      if (served === 1) {
        // Two-vertex "polygon": unusable, so the window is retried.
        return { ok: true, json: async () => ({ ok: true, instances: [{ classId: 1, polygon: [[0, 0], [100, 100]] }] }) }
      }
      return emptyResponse()
    })
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
    })
    // The single window is quartered (4 children) and the run completes honestly.
    assert.equal(result.report.calls, 5)
    assert.equal(result.report.windows, 5)
    assert.equal(result.report.complete, true)
    assert.deepEqual(result.report.failedWindows, [])
    assert.deepEqual(result.report.errors, [{ windowId: 'w1', depth: 0, reason: 'invalid_instances' }])
  } finally {
    dom.restore()
  }
})

test('取消：返回 cancelled 标志、保留已收集实例并恢复相机', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    const controller = new AbortController()
    const objects = [square(1, 220, 160, 40)]
    const { fetchImpl } = makeFetch((request) => {
      if (request.index === 1) controller.abort()
      return respondWithObjects(objects)(request)
    })
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
      signal: controller.signal,
    })
    assert.equal(result.cancelled, true)
    assert.equal(result.report.complete, false)
    assert.equal(result.report.calls, 2)
    assert.equal(result.report.windows, 2)
    // w1's instances survive the stop.
    assert.equal(result.collection.features.length, 1)
    assert.equal(result.report.instances, 1)
    assert.equal(viewer.camera.setViewCalls.length, 2)
    assert.equal(viewer.resolutionScale, 1)
    assert.equal(viewer.scene.screenSpaceCameraController.enableInputs, true)
  } finally {
    dom.restore()
  }

  // An already-aborted signal returns immediately without touching the camera.
  const dom2 = installFakeDocument()
  try {
    const viewer = makeViewer()
    const controller = new AbortController()
    controller.abort()
    let fetched = 0
    const { fetchImpl } = makeFetch(() => {
      fetched += 1
      return emptyResponse()
    })
    const result = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: CLASSES,
      fetchImpl,
      signal: controller.signal,
    })
    assert.equal(result.cancelled, true)
    assert.equal(result.report.calls, 0)
    assert.equal(result.report.windows, 0)
    assert.equal(result.collection.features.length, 0)
    assert.equal(fetched, 0)
    assert.equal(viewer.camera.setViewCalls.length, 0)
  } finally {
    dom2.restore()
  }
})

test('相机在提取期间被程序移动：以 scene_changed 停止并恢复现场', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    const { fetchImpl } = makeFetch((request) => {
      // Another code path moves the camera while the first request is in flight.
      if (request.index === 0) viewer.camera.position = { lon: 114.31, lat: 30.51, height: 1200 }
      return emptyResponse()
    })
    await assert.rejects(
      segmentInstances({
        viewer,
        Cesium: makeCesium(),
        meta: { visionInstancesUrl: '/instances' },
        classes: CLASSES,
        fetchImpl,
      }),
      (error) => error.code === 'scene_changed',
    )
    // The capture's finally restored the original view and resolution.
    assert.equal(viewer.camera.setViewCalls.length, 2)
    assert.equal(viewer.resolutionScale, 1)
    closeTo(viewer.camera.position.lon, 114.3)
    closeTo(viewer.camera.position.lat, 30.5)
    closeTo(viewer.camera.position.height, 800)
    closeTo(viewer.camera.pitch, -Math.PI / 3)
  } finally {
    dom.restore()
  }
})

test('bbox：居中取景并只保留质心在 bbox 内的实例', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    const bbox = { west: 114.2975, south: 30.498, east: 114.3025, north: 30.502 }
    const objects = [
      square(1, 460, 340, 40), // centre in the middle of the frame
      square(2, 0, 340, 40), // far left, outside the bbox
    ]
    const { fetchImpl } = makeFetch(respondWithObjects(objects))
    const { collection, report } = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      bbox,
      classes: CLASSES,
      fetchImpl,
    })
    assert.equal(report.complete, true)
    assert.equal(report.instances, 1)
    assert.equal(collection.features[0].properties.class_key, 'building')
    // The camera was centred on the bbox before being restored.
    const [nadir] = viewer.camera.setViewCalls[0] ? [viewer.camera.setViewCalls[0].destination] : [null]
    closeTo(nadir.lon, (bbox.west + bbox.east) / 2)
    closeTo(nadir.lat, (bbox.south + bbox.north) / 2)
    assert.equal(viewer.camera.setViewCalls.length, 2)
  } finally {
    dom.restore()
  }
})

test('类别清洗：缺省 definition 与非法输入在请求前失败', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer({ clientWidth: 500, clientHeight: 320 })
    const { fetchImpl, requests } = makeFetch(respondWithObjects([]))
    const { collection } = await segmentInstances({
      viewer,
      Cesium: makeCesium(),
      meta: { visionInstancesUrl: '/instances' },
      classes: [{ id: 3, name: ' "温室" ', color: '#123456' }],
      fetchImpl,
    })
    // Quotes/control characters are stripped and a default definition is added.
    assert.deepEqual(requests[0].body.classes, [{ id: 3, name: '温室', definition: '用户自定义：温室' }])
    assert.equal(collection.features.length, 0)

    // Same validation rules as the host protocol.
    const base = { viewer, Cesium: makeCesium(), meta: { visionInstancesUrl: '/instances' }, fetchImpl }
    await assert.rejects(segmentInstances({ ...base, classes: [{ id: '1', name: 'x' }] }), (error) => error.code === 'invalid_request')
    await assert.rejects(segmentInstances({ ...base, classes: [{ id: 0, name: 'x' }] }), (error) => error.code === 'invalid_request')
    await assert.rejects(segmentInstances({ ...base, classes: [{ id: 1, name: 'x', definition: 'y'.repeat(121) }] }), (error) => error.code === 'invalid_request')
    await assert.rejects(segmentInstances({ ...base, classes: [{ id: 1, name: ' " " ' }] }), (error) => error.code === 'invalid_request')
  } finally {
    dom.restore()
  }
})

test('后端不可用（unavailable）立即停止而不是耗尽重试预算', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    const { fetchImpl, requests } = makeFetch(() => ({
      ok: false,
      status: 422,
      json: async () => ({ ok: false, code: 'unavailable', next: 'configure a vision backend' }),
    }))
    await assert.rejects(
      segmentInstances({
        viewer,
        Cesium: makeCesium(),
        meta: { visionInstancesUrl: '/instances' },
        classes: CLASSES,
        fetchImpl,
      }),
      (error) => error.code === 'unavailable',
    )
    // One failed request was enough: no quartering, no 40-window burn.
    assert.equal(requests.length, 1)
    assert.equal(viewer.camera.setViewCalls.length, 2)
    assert.equal(viewer.resolutionScale, 1)
  } finally {
    dom.restore()
  }
})

test('参数校验失败即拒绝，不移动相机', async () => {
  const dom = installFakeDocument()
  try {
    const viewer = makeViewer()
    const Cesium = makeCesium()
    const base = { viewer, Cesium, meta: { visionInstancesUrl: '/instances' }, fetchImpl: async () => emptyResponse() }
    await assert.rejects(segmentInstances({ ...base, classes: [] }), (error) => error.code === 'invalid_request')
    await assert.rejects(segmentInstances({ ...base, classes: Array.from({ length: 13 }, (_, index) => ({ id: index + 1, name: `类${index + 1}`, definition: '定义' })) }), (error) => error.code === 'invalid_request')
    await assert.rejects(segmentInstances({ ...base, classes: [{ id: 1, name: 'x'.repeat(40) }] }), (error) => error.code === 'invalid_request')
    await assert.rejects(segmentInstances({ ...base, classes: CLASSES, meta: {} }), (error) => error.code === 'unavailable')
    await assert.rejects(segmentInstances({ ...base, classes: CLASSES, fetchImpl: null }), (error) => error.code === 'unavailable')
    await assert.rejects(segmentInstances({ ...base, classes: CLASSES, tileSize: 2000 }), (error) => error.code === 'invalid_request')
    await assert.rejects(segmentInstances({ ...base, classes: CLASSES, halo: 400 }), (error) => error.code === 'invalid_request')
    await assert.rejects(segmentInstances({ ...base, classes: CLASSES, maxDepth: 9 }), (error) => error.code === 'invalid_request')
    await assert.rejects(
      segmentInstances({ ...base, classes: CLASSES, bbox: { west: 114.31, south: 30.49, east: 114.29, north: 30.51 } }),
      (error) => error.code === 'invalid_request',
    )
    assert.equal(viewer.camera.setViewCalls.length, 0)
  } finally {
    dom.restore()
  }
})
