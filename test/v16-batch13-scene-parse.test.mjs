/**
 * v1.6 Batch 13 — F6 MVP: parse the current view into annotation candidates.
 *
 * Requirement #6/#7: one screenshot goes to the vision model, the outlines come
 * back normalized, get projected onto the surface and shown for review. These
 * tests pin the pure parts (review math, dedupe, projection, host validation)
 * and the wiring that connects the entry to the annotation layer, so the model
 * prompt and the Cesium types can change without breaking the contract.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

import { readRepoFile } from './helpers/source.mjs'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const batch = await import('../src/client/scene/vision-batch.js')
const hostVision = await import('../src/host/vision.js')
const catalog = await import('../src/client/ui/tool-catalog.js')
const { PARSE_MESSAGES } = await import('../src/client/messages-parse.js')
const { MESSAGES } = await import('../src/client/messages.js')

/** A 40-byte PNG header: enough for the host dimension check (needs >= 33 bytes). */
function pngDataUrl(width, height) {
  const buffer = Buffer.alloc(40)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return `data:image/png;base64,${buffer.toString('base64')}`
}

/** Minimal Cesium surface: pickPosition returns a finite cartesian for every pixel. */
function fakeScene() {
  return {
    pickPositionSupported: true,
    pickPosition: (position) => ({ lon: position.x / 10, lat: position.y / 10, h: 5 }),
    globe: { pick: () => null, tilesLoaded: true },
    requestRender: () => {},
  }
}

function fakeViewer() {
  return {
    scene: fakeScene(),
    camera: { getPickRay: () => null, cancelFlight: () => {} },
    render: () => {},
    entities: { add: (entity) => entity, remove: () => {} },
    isDestroyed: () => false,
  }
}

const fakeCesium = {
  Cartesian2: class { constructor(x, y) { this.x = x; this.y = y } },
  Cartesian3: { fromDegrees: (lon, lat, height = 0) => ({ lon, lat, height }) },
  Cartographic: {
    fromCartesian: (cartesian) => ({
      longitude: cartesian.lon * Math.PI / 180,
      latitude: cartesian.lat * Math.PI / 180,
      height: cartesian.h ?? 0,
    }),
  },
  Math: { toDegrees: (radians) => radians * 180 / Math.PI },
  Color: { fromCssColorString: () => ({ withAlpha: () => ({}) }) },
}

function fakeFrame() {
  const viewer = fakeViewer()
  return {
    id: 'frame-1',
    viewer,
    Cesium: fakeCesium,
    crop: { left: 0, top: 0, width: 100, height: 100 },
    cssWidth: 100,
    cssHeight: 100,
    point: [0.5, 0.5],
    isValid: () => true,
    release: () => {},
  }
}

const SQUARE = [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]]

/** Normalized coordinates are floats; compare with a tolerance, not by bits. */
function close(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => Math.abs(value - expected[index]) < 1e-9)
}

test('解析候选：中心点取均值并夹到图内，坏输入返回 null', () => {
  assert.ok(close(batch.batchPolygonCenter(SQUARE), [0.3, 0.3]))
  assert.ok(close(batch.batchPolygonCenter([[0, 0], [0, 0.2], [0.2, 0]]), [1 / 15, 1 / 15]))
  // Clamp keeps the anchor strictly inside the image, never on the border.
  assert.ok(close(batch.batchPolygonCenter([[0, 0], [0, 0], [0, 0]]), [0.001, 0.001]))
  assert.equal(batch.batchPolygonCenter(null), null)
  assert.equal(batch.batchPolygonCenter([]), null)
  assert.equal(batch.batchPolygonCenter([[Number.NaN, 0.2], [0.4, 0.4], [0.2, 0.4]]), null)
})

test('解析候选：bbox IoU 用于跨块去重', () => {
  assert.equal(batch.batchBoxIoU([0, 0, 10, 10], [0, 0, 10, 10]), 1)
  assert.equal(batch.batchBoxIoU([0, 0, 10, 10], [20, 20, 30, 30]), 0)
  assert.equal(batch.batchBoxIoU([0, 0, 10, 10], [5, 0, 15, 10]), 5 * 10 / (100 + 100 - 50))
  assert.equal(batch.batchBoxIoU(null, [0, 0, 1, 1]), 0)
})

test('解析候选：同类重叠只留更可信的一条，异类与远处都保留', () => {
  const feature = (confidence, box, kind = 'building') => ({
    type: 'Feature',
    properties: { class: kind, confidence },
    geometry: { type: 'Polygon', coordinates: [[[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]], [box[0], box[1]]]] },
  })
  const low = feature(0.4, [0, 0, 10, 10])
  const high = feature(0.9, [0.5, 0.5, 10.5, 10.5])
  const other = feature(0.5, [0.5, 0.5, 10.5, 10.5], 'vegetation')
  const far = feature(0.3, [60, 60, 70, 70])
  const kept = batch.dedupeBatchFeatures([low, other, high, far])
  assert.equal(kept.length, 3)
  assert.ok(kept.includes(high))
  assert.ok(!kept.includes(low))
  assert.ok(kept.includes(other))
  assert.deepEqual(batch.batchClassCounts(kept), { building: 2, vegetation: 1 })
})

test('解析候选：模型轮廓经投影变成带诚实属性的面要素，投影失败计数', () => {
  const frame = fakeFrame()
  const { features, skipped } = batch.projectBatchObjects(frame, [
    { class: 'building', confidence: 0.8, polygon: SQUARE },
    { class: 'road', confidence: null, polygon: [[0.1, 0.1], [0.2, 0.2]] },
  ], { t: (key) => (key === 'parse.class.building' ? '建筑' : key) })
  assert.equal(skipped, 1)
  assert.equal(features.length, 1)
  const [feature] = features
  assert.equal(feature.type, 'Feature')
  assert.deepEqual(feature.geometry.coordinates[0].length, 9)
  assert.equal(feature.properties.name, '建筑 1')
  assert.equal(feature.properties.kind, 'area')
  assert.equal(feature.properties.class, 'building')
  assert.equal(feature.properties.source, 'vision_model')
  assert.equal(feature.properties.basis, 'inferred')
  assert.equal(feature.properties.approximate, true)
  assert.equal(feature.properties.depth_source, 'scene_depth')
  // Projection is best-effort: the ring is a closed lon/lat loop over the picked surface.
  const ring = feature.geometry.coordinates[0]
  assert.deepEqual(ring[0], ring[ring.length - 1])
})

test('宿主解析：只要 JSON 对象列表，非法条目计入 dropped，全无目标抛 no_target', () => {
  const text = 'Here you go:\n{"objects":[{"class":"building","confidence":0.8,"polygon":[[0.1,0.1],[0.3,0.1],[0.3,0.3],[0.1,0.3]]},' +
    '{"class":"tree","polygon":[[0.1,0.1],[0.3,0.1],[0.3,0.3]]},' +
    '{"class":"water","confidence":1.7,"polygon":[[0.1,0.1],[0.3,0.1]]}]}'
  const parsed = hostVision.parseVisionBatchOutput(text)
  assert.equal(parsed.objects.length, 1)
  assert.equal(parsed.objects[0].class, 'building')
  assert.equal(parsed.objects[0].confidence, 0.8)
  assert.equal(parsed.dropped, 2)
  const clamped = hostVision.parseVisionBatchOutput('{"objects":[{"class":"building","confidence":1.7,"polygon":[[0.1,0.1],[0.3,0.1],[0.3,0.3]]}]}')
  assert.equal(clamped.objects[0].confidence, 1)
  assert.throws(() => hostVision.parseVisionBatchOutput('{"objects":[]}'), /no_target/)
  assert.throws(() => hostVision.parseVisionBatchOutput('not json'), /invalid_result/)
})

test('宿主校验：截图请求必须有 frameId 与可解码的 32..1024 尺寸图', () => {
  const ok = hostVision.validateVisionBatchRequest({ frameId: 'frame-1', image: pngDataUrl(64, 64) })
  assert.equal(ok.frameId, 'frame-1')
  assert.equal(ok.width, 64)
  assert.equal(ok.height, 64)
  assert.throws(() => hostVision.validateVisionBatchRequest({ image: pngDataUrl(64, 64) }), /invalid_request/)
  assert.throws(() => hostVision.validateVisionBatchRequest({ frameId: 'frame 1', image: pngDataUrl(64, 64) }), /invalid_request/)
  assert.throws(() => hostVision.validateVisionBatchRequest({ frameId: 'frame-1', image: 'nope' }), /invalid_request/)
  assert.throws(() => hostVision.validateVisionBatchRequest({ frameId: 'frame-1', image: pngDataUrl(16, 16) }), /invalid_request/)
})

test('接线：解析入口经工具箱进入，采纳后只生成一条标注图层命令', async () => {
  assert.ok(catalog.TOOL_IDS.includes('parse'))
  assert.equal(catalog.TOOL_IDS[catalog.TOOL_IDS.indexOf('annotation') + 1], 'parse')
  const toolsPanel = await readRepoFile('src/client/ui/tools-panel.js')
  assert.match(toolsPanel, /onAdoptParse/)
  const toolWindows = await readRepoFile('src/client/ui/tool-windows.js')
  assert.match(toolWindows, /import \{ ParseBody \} from '\.\/parse-review\.js'/)
  assert.match(toolWindows, /if \(entryId === 'parse'\) return h\(ParseBody, rest\)/)
  const viewer = await readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /onAdoptParse: annotations\.adoptCollection,/)
  const actions = await readRepoFile('src/client/scene/annotation-actions.js')
  assert.match(actions, /adoptCollection: \(collection, caption\)/)
  assert.match(actions, /parse\.adopted/)
  const routes = await readRepoFile('src/host/routes.js')
  assert.match(routes, /visionBatchUrl/)
  assert.match(routes, /vision-batch\/\$\{TOKEN\}/)
  const css = await readRepoFile('src/client/ui/css.js')
  assert.match(css, /\$\{PARSE_CSS\}/)
  const parseCss = await readRepoFile('src/client/ui/parse-css.js')
  assert.match(parseCss, /\.mv-parse-row/)
})

test('文案：解析面板中英键集合一致，并已并入 MESSAGES', () => {
  const zh = Object.keys(PARSE_MESSAGES.zh).sort()
  const en = Object.keys(PARSE_MESSAGES.en).sort()
  assert.deepEqual(zh, en)
  for (const key of ['tools.parse', 'parse.run', 'parse.adopted', 'parse.failed', 'parse.empty', 'parse.err.no_target', 'parse.class.building']) {
    assert.ok(zh.includes(key), key)
  }
  assert.equal(typeof MESSAGES.zh['tools.parse'], 'string')
  assert.equal(typeof MESSAGES.en['tools.parse'], 'string')
  assert.equal(typeof MESSAGES.zh['parse.class.building'], 'string')
  assert.equal(typeof MESSAGES.en['parse.class.building'], 'string')
})
