/**
 * v20 — 正射截图源测试（src/client/scene/ortho-capture.js）。
 *
 * 用最小的 fake viewer / fake Cesium / fake document 覆盖真实运行路径：
 * 相机保存与恢复、AOI 高度拟合与 clamp、resolutionScale 提升与还原、
 * read(rect) 的 JPEG 裁剪、lonLat 的三级取点回退、failure 时先恢复现场。
 *
 * 假映射是显式可逆的：CSS 像素 (clientWidth/2, clientHeight/2) 就是相机中心，
 * 1 CSS px = 1e-5°。这样 bbox、lonLat、像素裁剪都能精确断言，不依赖真实 GPU。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { captureOrtho } = await import('../src/client/scene/ortho-capture.js')

const deg = (value) => (value * Math.PI) / 180
const closeTo = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)

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
 * fake viewer：render() 按 resolutionScale 重算 drawing buffer（与 Cesium 一致），
 * camera.setView 记录调用并在 fake 里更新 position，输入锁作用在
 * screenSpaceCameraController 的六个布尔字段上（lockViewerInput 的真实契约）。
 */
function makeViewer(options = {}) {
  const {
    clientWidth = 800,
    clientHeight = 600,
    cameraLon = 114.3,
    cameraLat = 30.5,
    cameraHeight = 800,
    degPerPixel = 1e-5,
    pickPositionSupported = true,
    globePick = true,
    ellipsoidPick = true,
    failRender = false,
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
      return ellipsoidPick ? pixelGround(position) : null
    },
  }
  const pixelGround = (position) => {
    // Small-angle nadir mapping: 1 CSS px covers `degPerPixel` degrees at 800 m,
    // and scales linearly with the camera height (a taller camera sees more).
    const scale = camera.position.height / 800
    return {
      lon: camera.position.lon + (position.x - clientWidth / 2) * degPerPixel * scale,
      lat: camera.position.lat - (position.y - clientHeight / 2) * degPerPixel * scale,
      height: 0,
    }
  }
  const scene = {
    canvas,
    pickPositionSupported,
    pickPosition: (position) => (pickPositionSupported ? pixelGround(position) : null),
    globe: {
      ellipsoid: { id: 'fake-ellipsoid' },
      pick: (ray) => (globePick && ray?.position ? pixelGround(ray.position) : null),
    },
    screenSpaceCameraController: controller,
    requestRender() {},
  }
  return {
    canvas,
    camera,
    scene,
    resolutionScale: 1,
    renderCalls: 0,
    render() {
      if (failRender) throw new Error('render-boom')
      this.renderCalls += 1
      canvas.width = Math.round(clientWidth * this.resolutionScale)
      canvas.height = Math.round(clientHeight * this.resolutionScale)
    },
    isDestroyed: () => false,
  }
}

/** fake document：每块 canvas 记录 drawImage 参数与 toDataURL 的质量。 */
function installFakeDocument() {
  const previous = globalThis.document
  const canvases = []
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
          images.push({ type, quality, width: element.width, height: element.height, draw: element.lastDraw })
          return `data:image/jpeg;base64,${element.width}x${element.height}`
        },
      }
      canvases.push(element)
      return element
    },
  }
  return {
    canvases,
    images,
    restore() {
      globalThis.document = previous
    },
  }
}

/** 期望的 lon/lat：设备像素 → CSS → 假地图（相机中心为中心，随高度缩放的 1e-5°/px）。 */
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

test('captureOrtho 把相机转成正射并临时提升 resolutionScale', async () => {
  const dom = installFakeDocument()
  try {
    const Cesium = makeCesium()
    const viewer = makeViewer()
    const capture = await captureOrtho({ viewer, Cesium })
    try {
      assert.equal(capture.width, 960)
      assert.equal(capture.height, 720)
      assert.equal(capture.source.width, 960)
      assert.equal(capture.source.height, 720)
      assert.equal(capture.source.cameraLocked, true)
      assert.equal(capture.source.restore, capture.restore)
      assert.equal(viewer.resolutionScale, 1.2)
      // The camera is nadir on the old centre at the old altitude.
      assert.equal(viewer.camera.setViewCalls.length, 1)
      const [view] = viewer.camera.setViewCalls
      closeTo(view.destination.lon, 114.3)
      closeTo(view.destination.lat, 30.5)
      closeTo(view.destination.height, 800)
      assert.equal(view.orientation.heading, 0)
      assert.equal(view.orientation.pitch, -Math.PI / 2)
      assert.equal(view.orientation.roll, 0)
      closeTo(capture.cameraHeight, 800)
      // Input is locked for the whole capture.
      for (const flag of ['enableInputs', 'enableRotate', 'enableTranslate', 'enableZoom', 'enableTilt', 'enableLook']) {
        assert.equal(viewer.scene.screenSpaceCameraController[flag], false)
      }
      // Framing bbox is derived from the four device-pixel corners.
      assert.ok(capture.bbox)
      const topLeft = expectedLonLat(viewer, 0, 0)
      const bottomRight = expectedLonLat(viewer, 959, 719)
      closeTo(capture.bbox.west, topLeft.lon)
      closeTo(capture.bbox.north, topLeft.lat)
      closeTo(capture.bbox.east, bottomRight.lon)
      closeTo(capture.bbox.south, bottomRight.lat)
      assert.deepEqual(capture.source.bbox, capture.bbox)
    } finally {
      capture.restore()
    }
    // Restore is complete and idempotent.
    assert.equal(viewer.resolutionScale, 1)
    assert.equal(viewer.camera.setViewCalls.length, 2)
    const restored = viewer.camera.setViewCalls[1]
    closeTo(restored.destination.lon, 114.3)
    closeTo(restored.destination.lat, 30.5)
    closeTo(restored.destination.height, 800)
    closeTo(restored.orientation.pitch, -Math.PI / 3)
    for (const flag of ['enableInputs', 'enableRotate', 'enableTranslate', 'enableZoom', 'enableTilt', 'enableLook']) {
      assert.equal(viewer.scene.screenSpaceCameraController[flag], true)
    }
    capture.restore()
    assert.equal(viewer.camera.setViewCalls.length, 2)

    // resolutionScale is clamped to at least 1: no upscaling below CSS pixels.
    const smallScale = makeViewer()
    const low = await captureOrtho({ viewer: smallScale, Cesium, resolutionScale: 0.5 })
    assert.equal(low.width, 800)
    assert.equal(low.height, 600)
    low.restore()

    // Without a bbox the current altitude is kept (no artificial raise to 80 m).
    const lowFlyer = makeViewer({ cameraHeight: 120 })
    const kept = await captureOrtho({ viewer: lowFlyer, Cesium })
    assert.equal(kept.cameraHeight, 120)
    closeTo(lowFlyer.camera.setViewCalls[0].destination.height, 120)
    kept.restore()
  } finally {
    dom.restore()
  }
})

test('captureOrtho 按 bbox 居中并自动拟合相机高度', async () => {
  const dom = installFakeDocument()
  try {
    const Cesium = makeCesium()
    // A ~1.9km × 2.2km AOI: the fitted view must contain the whole bbox.
    const bbox = { west: 114.29, south: 30.49, east: 114.31, north: 30.51 }
    const viewer = makeViewer()
    const capture = await captureOrtho({ viewer, Cesium, bbox })
    try {
      assert.equal(viewer.camera.setViewCalls.length, 1)
      const [view] = viewer.camera.setViewCalls
      closeTo(view.destination.lon, 114.3)
      closeTo(view.destination.lat, 30.5)
      closeTo(view.destination.height, capture.cameraHeight)
      assert.ok(capture.cameraHeight >= 80 && capture.cameraHeight <= 6000)
      assert.ok(capture.cameraHeight > 500, `fitted height too low: ${capture.cameraHeight}`)
      assert.ok(capture.bbox.west < bbox.west)
      assert.ok(capture.bbox.east > bbox.east)
      assert.ok(capture.bbox.south < bbox.south)
      assert.ok(capture.bbox.north > bbox.north)
    } finally {
      capture.restore()
    }

    const tinyViewer = makeViewer()
    const tiny = await captureOrtho({ viewer: tinyViewer, Cesium, bbox: { west: 114.3, south: 30.5, east: 114.300001, north: 30.500001 } })
    assert.equal(tiny.cameraHeight, 80)
    tiny.restore()

    const hugeViewer = makeViewer()
    const huge = await captureOrtho({ viewer: hugeViewer, Cesium, bbox: { west: 104.3, south: 20.5, east: 124.3, north: 40.5 } })
    assert.equal(huge.cameraHeight, 6000)
    huge.restore()

    await assert.rejects(
      captureOrtho({ viewer: makeViewer(), Cesium, bbox: { west: 114.31, south: 30.49, east: 114.29, north: 30.51 } }),
      (error) => error.code === 'invalid_request',
    )
  } finally {
    dom.restore()
  }
})

test('read() 按 rect 裁剪并输出 JPEG（.85、设备像素）', async () => {
  const dom = installFakeDocument()
  try {
    const Cesium = makeCesium()
    const viewer = makeViewer()
    const capture = await captureOrtho({ viewer, Cesium })
    try {
      const dataUrl = capture.source.read({ left: 10, top: 20, width: 300, height: 200 })
      assert.match(dataUrl, /^data:image\/jpeg;base64,/)
      const panel = dom.canvases[dom.canvases.length - 1]
      assert.equal(panel.width, 300)
      assert.equal(panel.height, 200)
      assert.deepEqual(panel.lastDraw.slice(1), [10, 20, 300, 200, 0, 0, 300, 200])
      const image = dom.images[dom.images.length - 1]
      assert.equal(image.type, 'image/jpeg')
      assert.equal(image.quality, 0.85)
      assert.equal(image.width, 300)
      assert.equal(image.height, 200)
      // Rect components are rounded to device-pixel integers.
      const rounded = capture.source.read({ left: 10.4, top: 19.6, width: 299.6, height: 200.2 })
      assert.match(rounded, /^data:image\/jpeg;base64,/)
      assert.equal(dom.canvases[dom.canvases.length - 1].width, 300)
      assert.equal(dom.canvases[dom.canvases.length - 1].height, 200)
      // Rects are clamped to the captured canvas.
      capture.source.read({ left: 900, top: 600, width: 500, height: 400 })
      assert.equal(dom.canvases[dom.canvases.length - 1].width, 60)
      assert.equal(dom.canvases[dom.canvases.length - 1].height, 120)
    } finally {
      capture.restore()
    }
    assert.throws(() => capture.source.read({ left: 0, top: 0, width: 10, height: 10 }), (error) => error.code === 'not_ready')
  } finally {
    dom.restore()
  }

  // Guard: a crop edge above the host's 1024px limit fails instead of sending it.
  const dom2 = installFakeDocument()
  try {
    const Cesium = makeCesium()
    const viewer = makeViewer({ clientWidth: 1200, clientHeight: 1000 })
    const capture = await captureOrtho({ viewer, Cesium })
    try {
      assert.equal(capture.width, 1440)
      assert.throws(
        () => capture.source.read({ left: 0, top: 0, width: 1440, height: 1200 }),
        (error) => error.code === 'too_large',
      )
    } finally {
      capture.restore()
    }
  } finally {
    dom2.restore()
  }
})

test('lonLat 优先 depth pick，再回退 globe ray，最后 ellipsoid', async () => {
  const dom = installFakeDocument()
  try {
    const Cesium = makeCesium()

    const depthViewer = makeViewer()
    const depth = await captureOrtho({ viewer: depthViewer, Cesium })
    try {
      const point = depth.source.lonLat(480, 360)
      const expected = expectedLonLat(depthViewer, 480, 360)
      closeTo(point.lon, expected.lon)
      closeTo(point.lat, expected.lat)
      // Corner is still on the fake ground.
      const corner = depth.source.lonLat(0, 0)
      const expectedCorner = expectedLonLat(depthViewer, 0, 0)
      closeTo(corner.lon, expectedCorner.lon)
      closeTo(corner.lat, expectedCorner.lat)
    } finally {
      depth.restore()
    }

    const rayViewer = makeViewer({ pickPositionSupported: false, globePick: true })
    const ray = await captureOrtho({ viewer: rayViewer, Cesium })
    try {
      const point = ray.source.lonLat(480, 360)
      closeTo(point.lon, 114.3)
      closeTo(point.lat, 30.5)
    } finally {
      ray.restore()
    }

    const ellipsoidViewer = makeViewer({ pickPositionSupported: false, globePick: false, ellipsoidPick: true })
    const ellipsoid = await captureOrtho({ viewer: ellipsoidViewer, Cesium })
    try {
      const point = ellipsoid.source.lonLat(0, 0)
      const expected = expectedLonLat(ellipsoidViewer, 0, 0)
      closeTo(point.lon, expected.lon)
      closeTo(point.lat, expected.lat)
    } finally {
      ellipsoid.restore()
    }

    // No surface at all: lonLat is null and the framing bbox is reported as null.
    const blindViewer = makeViewer({ pickPositionSupported: false, globePick: false, ellipsoidPick: false })
    const blind = await captureOrtho({ viewer: blindViewer, Cesium })
    try {
      assert.equal(blind.source.lonLat(100, 100), null)
      assert.equal(blind.bbox, null)
      assert.equal(blind.source.lonLat(Number.NaN, 0), null)
      assert.equal(blind.source.lonLat(10000, 10000), null)
    } finally {
      blind.restore()
    }
  } finally {
    dom.restore()
  }
})

test('restore 幂等：分辨率、相机与输入锁各恢复一次', async () => {
  const dom = installFakeDocument()
  try {
    const Cesium = makeCesium()
    const viewer = makeViewer()
    const capture = await captureOrtho({ viewer, Cesium })
    assert.equal(viewer.resolutionScale, 1.2)
    assert.equal(capture.source.isValid(), true)
    // A programmatic camera move invalidates the frozen pixel mapping.
    viewer.camera.heading = 0.4
    assert.equal(capture.source.isValid(), false)
    viewer.camera.heading = 0
    assert.equal(capture.source.isValid(), true)
    capture.restore()
    capture.restore()
    capture.restore()
    assert.equal(viewer.camera.setViewCalls.length, 2)
    assert.equal(viewer.resolutionScale, 1)
    assert.equal(viewer.camera.pitch, -Math.PI / 3)
    assert.equal(viewer.scene.screenSpaceCameraController.enableInputs, true)
    // The captured source is dead after restore but the frame stays inspectable.
    assert.equal(capture.source.lonLat(480, 360), null)
    assert.equal(capture.source.isValid(), false)
    assert.equal(capture.width, 960)
  } finally {
    dom.restore()
  }
})

test('渲染失败时先恢复相机/分辨率/输入锁再抛错', async () => {
  const dom = installFakeDocument()
  try {
    const Cesium = makeCesium()
    const viewer = makeViewer({ failRender: true })
    await assert.rejects(captureOrtho({ viewer, Cesium }), /render-boom/)
    assert.equal(viewer.resolutionScale, 1)
    assert.equal(viewer.camera.setViewCalls.length, 2)
    const restored = viewer.camera.setViewCalls[1]
    closeTo(restored.destination.lon, 114.3)
    closeTo(restored.destination.lat, 30.5)
    closeTo(restored.destination.height, 800)
    closeTo(restored.orientation.pitch, -Math.PI / 3)
    for (const flag of ['enableInputs', 'enableRotate', 'enableTranslate', 'enableZoom', 'enableTilt', 'enableLook']) {
      assert.equal(viewer.scene.screenSpaceCameraController[flag], true)
    }
  } finally {
    dom.restore()
  }
})

test('输入不合法时在移动相机之前失败', async () => {
  const dom = installFakeDocument()
  try {
    const Cesium = makeCesium()
    await assert.rejects(captureOrtho({ viewer: null, Cesium }), (error) => error.code === 'not_ready')
    await assert.rejects(captureOrtho({ viewer: makeViewer(), Cesium: null }), (error) => error.code === 'not_ready')
    const viewer = makeViewer()
    await assert.rejects(
      captureOrtho({ viewer, Cesium, bbox: { west: 114.3, south: 30.5, east: 114.3, north: 30.6 } }),
      (error) => error.code === 'invalid_request',
    )
    assert.equal(viewer.camera.setViewCalls.length, 0)
  } finally {
    dom.restore()
  }
})
