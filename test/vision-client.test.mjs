import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureVisionFrame, projectVisionPolygon } from '../src/client/scene/vision-frame.js'
import { parseVisionOutput, validateVisionPolygon } from '../src/client/scene/vision-geometry.js'
import { visionRequest } from '../src/client/scene/vision-request.js'
import { getSelectionTool, disposeSelection } from '../src/client/scene/selection-tools.js'
import { VISION_MESSAGES } from '../src/client/messages-vision.js'

const polygon = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]

function event() {
  const callbacks = new Set()
  return { addEventListener(callback) { callbacks.add(callback); return () => callbacks.delete(callback) },
    fire() { callbacks.forEach((callback) => callback()) }, size: () => callbacks.size }
}

function fixture() {
  const oldDocument = globalThis.document
  const flags = { enableInputs: true, enableRotate: true, enableTranslate: false, enableZoom: true, enableTilt: false, enableLook: true }
  const control = { ...flags }, picks = [], entities = []
  let destroyed = false, captureFails = false
  const target = { tilesLoaded: true, tileLoad: event(), tileUnload: event(), show: true, modelMatrix: [1, 0, 0, 1] }
  const layers = [{ id: 'test', visible: true, tileset: target }]
  const Cesium = {
    Cartesian2: class { constructor(x, y) { this.x = x; this.y = y } },
    SceneTransforms: { worldToWindowCoordinates: () => ({ x: 250, y: 200 }) },
    Cartographic: { fromCartesian: (value) => ({ longitude: value.x * 0.000001, latitude: value.y * 0.000001, height: 30 }) },
    Math: { toDegrees: (value) => value * 180 / Math.PI },
  }
  const viewer = {
    canvas: { width: 1000, height: 800, clientWidth: 500, clientHeight: 400 },
    camera: { viewMatrix: [1, 0, 0, 1], frustum: { fov: 1 }, cancelFlight() {} },
    isDestroyed: () => destroyed,
    render() {},
    entities: { collectionChanged: event(), add(options) { entities.push(options); return options }, remove() {} },
    scene: {
      screenSpaceCameraController: control, pickPositionSupported: true, primitives: { length: 1 },
      globe: { tilesLoaded: true, show: true, depthTestAgainstTerrain: true },
      pick: () => ({ primitive: target }),
      pickPosition(position) { picks.push(position); return { x: position.x, y: position.y } },
      requestRender() {},
    },
  }
  const images = []
  globalThis.document = { visibilityState: 'visible', createElement() {
    const image = { width: 0, height: 0, getContext: () => ({ drawImage() { if (captureFails) throw new Error('tainted') } }), toDataURL: () => 'data:image/jpeg;base64,TEST' }
    images.push(image)
    return image
  } }
  const capture = () => captureVisionFrame({ viewer, Cesium, anchor: {}, getLayers: () => layers })
  return { viewer, Cesium, target, layers, control, flags, picks, images, capture,
    destroy() { destroyed = true }, failCapture() { captureFails = true },
    restore() { disposeSelection(viewer); if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument },
  }
}

test('视觉几何：归一化闭环/粗框，拒绝退化、自交、重复、越界及不包含点击', () => {
  assert.deepEqual(parseVisionOutput('```json\n' + JSON.stringify({ polygon: [...polygon, polygon[0]] }) + '\n```', [0.5, 0.5]).polygon, polygon)
  const box = validateVisionPolygon({ bbox: [0.2, 0.2, 0.8, 0.8] }, [0.5, 0.5])
  assert.equal(box.shape, 'box')
  assert.equal(box.approximate, true)
  for (const bad of [
    [[0, 0], [0.5, 0.5], [1, 1]],
    [[0.2, 0.2], [0.8, 0.8], [0.8, 0.2], [0.2, 0.8]],
    [...polygon, polygon[1]],
    [[-1, 0], [0.5, 0.5], [0, 1]],
  ]) assert.throws(() => validateVisionPolygon({ polygon: bad }, [0.5, 0.5]), { code: 'invalid_result' })
  assert.throws(() => validateVisionPolygon({ polygon }, [0.01, 0.01]), { code: 'invalid_result' })
  assert.throws(() => parseVisionOutput('{"polygon":null}', [0.5, 0.5]), { code: 'no_target' })
})

test('取景：CSS 坐标与缓冲区尺寸分离，释放恢复全部相机开关和订阅', () => {
  const env = fixture()
  try {
    env.viewer.canvas.width = 2000; env.viewer.canvas.height = 1600
    const frame = env.capture()
    assert.deepEqual(frame.point, [0.5, 0.5])
    assert.equal(frame.width, 768)
    assert.equal(frame.height, 768)
    assert.deepEqual(frame.crop, { left: 154, top: 104, width: 192, height: 192 }, 'crop 应围绕目标做放大')
    assert.equal(frame.cssWidth, 500)
    assert.ok(Object.values(env.control).every((value) => value === false))
    assert.equal(env.target.tileLoad.size(), 1)
    assert.equal(frame.isValid(), true)
    frame.release(); frame.release()
    assert.equal(frame.isValid(), false)
    assert.deepEqual(env.control, env.flags)
    assert.equal(env.target.tileLoad.size(), 0)
    assert.equal(env.target.tileUnload.size(), 0)
    assert.equal(env.viewer.entities.collectionChanged.size(), 0)
  } finally { env.restore() }
})

test('取景：相机/焦距/尺寸/图层/瓦片/实体变化均使旧结果失效', () => {
  const mutations = [
    (env) => { env.viewer.camera.viewMatrix[0] = 2 },
    (env) => { env.viewer.camera.frustum.fov = 0.8 },
    (env) => { env.viewer.canvas.clientWidth = 600 },
    (env) => { env.layers[0].visible = false },
    (env) => { env.target.modelMatrix[0] = 2 },
    (env) => { env.target.tileLoad.fire() },
    (env) => { env.target.tileUnload.fire() },
    (env) => { env.viewer.entities.collectionChanged.fire() },
    (env) => { env.destroy() },
  ]
  for (const mutate of mutations) {
    const env = fixture()
    try { const frame = env.capture(); mutate(env); assert.equal(frame.isValid(), false); assert.doesNotThrow(() => frame.release()) }
    finally { env.restore() }
  }
})

test('取景失败恢复控制；加载中/无深度/跨模型不伪造地面结果', () => {
  const env = fixture()
  try {
    env.failCapture()
    assert.throws(env.capture, /tainted/)
    assert.deepEqual(env.control, env.flags)
    env.target.tilesLoaded = false
    assert.throws(env.capture, { code: 'scene_loading' })
  } finally { env.restore() }
  for (const failure of ['unsupported', 'missing-depth']) {
    const current = fixture()
    try {
      const frame = current.capture()
      if (failure === 'unsupported') current.viewer.scene.pickPositionSupported = false
      if (failure === 'missing-depth') current.viewer.scene.pickPosition = () => null
      assert.throws(() => projectVisionPolygon(frame, { polygon }), { code: 'depth_unavailable' })
      frame.release()
    } finally { current.restore() }
  }
  const other = fixture()
  try {
    const frame = other.capture()
    other.viewer.scene.pick = () => ({ primitive: {} })
    // A different primitive at an edge must not discard the whole outline.
    const ground = projectVisionPolygon(frame, { polygon })
    assert.equal(ground.complete, true)
    frame.release()
  } finally { other.restore() }
  const fallback = fixture()
  try {
    const frame = fallback.capture()
    fallback.viewer.scene.pickPosition = () => null
    fallback.viewer.camera.getPickRay = () => ({ origin: { x: 1, y: 1, z: 1 }, direction: { x: 0, y: 0, z: -1 } })
    fallback.viewer.scene.globe.pick = () => ({ x: 1, y: 2, z: 3 })
    const ground = projectVisionPolygon(frame, { polygon })
    assert.equal(ground.complete, true)
    assert.deepEqual(ground.warnings, ['depth_fallback'])
    frame.release()
  } finally { fallback.restore() }
})

test('反投影到确认提交：CSS 像素取深度，单次提交，GeoJSON 保留近似来源', () => {
  const env = fixture()
  try {
    const frame = env.capture(), ground = projectVisionPolygon(frame, { polygon })
    assert.equal(ground.points.length, 8)
    assert.ok(Math.abs(env.picks[0].x - 192.4) < 0.01)
    assert.ok(Math.abs(env.picks[0].y - 142.4) < 0.01)
    assert.deepEqual(ground.ring[0], ground.ring.at(-1))
    frame.release()
    const commits = []
    const tool = getSelectionTool(env.viewer, { getCesium: () => env.Cesium, onCommit: (value) => commits.push(value) })
    assert.equal(tool.getSelection(), null)
    assert.equal(tool.commitVision(ground), true)
    assert.equal(commits.length, 1)
    assert.equal(commits[0].approximate, true)
    assert.equal(commits[0].source, 'ai-visible-surface')
    const feature = tool.exportGeoJSON().features[0]
    assert.equal(feature.geometry.type, 'Polygon')
    assert.equal(feature.properties.approximate, true)
    assert.equal(feature.properties.source, 'ai-visible-surface')
    assert.equal(tool.commitVision({ complete: false }), false)
  } finally { env.restore() }
})

test('客户端请求：帧号绑定、粗框提示、错误与取消，无自动重试', async () => {
  const signal = new AbortController().signal
  const frame = { id: 'frame-test', dataUrl: 'image', point: [0.5, 0.5], isValid: () => true }
  let count = 0
  const fetchImpl = async (url, options) => {
    count++
    assert.equal(options.signal, signal)
    assert.equal(options.credentials, 'same-origin')
    assert.equal(options.headers['x-dsh-panel'], 'vision')
    assert.equal(JSON.parse(options.body).frameId, frame.id)
    return { ok: true, json: async () => ({ ok: true, frameId: frame.id, polygon, shape: 'box' }) }
  }
  assert.equal((await visionRequest('/vision/token', { frame, signal, fetchImpl })).shape, 'box')
  assert.equal(count, 1)
  const mismatched = async () => ({ ok: true, json: async () => ({ ok: true, frameId: 'old', polygon }) })
  await assert.rejects(visionRequest('/vision/token', { frame, fetchImpl: mismatched }), { code: 'scene_changed' })
  const error = async () => { count++; return { ok: false, json: async () => ({ ok: false, code: 'model_not_visual', next: 'change_model' }) } }
  await assert.rejects(visionRequest('/vision/token', { frame, fetchImpl: error }), { code: 'model_not_visual' })
  assert.equal(count, 2)
  await assert.rejects(visionRequest('/vision/token', { fetchImpl: async () => { throw new DOMException('cancelled', 'AbortError') } }), { name: 'AbortError' })
})

test('视觉文案：中英键完整配对', () => {
  assert.deepEqual(Object.keys(VISION_MESSAGES.zh).sort(), Object.keys(VISION_MESSAGES.en).sort())
  for (const locale of Object.values(VISION_MESSAGES)) for (const value of Object.values(locale)) assert.ok(value.length > 0)
})

test('视觉容错：代码围栏/前后说明、像素坐标与边缘点击都能归一化', () => {
  const fenced = parseVisionOutput(
    'Here is the outline:\n```json\n{"polygon":[[200,200],[800,200],[800,800],[200,800]]}\n```\nDone.',
    [0.5, 0.5],
    { width: 1000, height: 1000 },
  )
  assert.equal(fenced.polygon.length, 4)
  assert.deepEqual(fenced.polygon[0], [0.2, 0.2])
  assert.equal(fenced.shape, 'polygon')
  // A click a few percent outside the approximate silhouette still anchors it.
  assert.doesNotThrow(() => validateVisionPolygon({ polygon }, [0.17, 0.5]))
  assert.throws(() => validateVisionPolygon({ polygon }, [0.01, 0.01]), { code: 'invalid_result' })
  // Alternate model key names and object vertices are accepted.
  assert.equal(validateVisionPolygon({ points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }] }, [0.5, 0.5]).polygon.length, 4)
})
