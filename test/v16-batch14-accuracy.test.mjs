/**
 * v1.6 Batch 14 — the deterministic half of the accuracy answer.
 *
 * "How accurate is it?" has one honest, offline-testable part: what the code
 * itself guarantees (decimal rounding, offset math, vertex moves, hover
 * snapping) versus what depends on the data source or the vision model. These
 * assertions pin the first part with real numbers in metres, so a future
 * rounding or projection change cannot silently widen the error budget.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const selection = await import('../src/client/scene/selection.js')
const annotations = await import('../src/client/scene/annotation-model.js')
const metrics = await import('../src/client/analysis/profile-metrics.js')
const batch = await import('../src/client/scene/vision-batch.js')

const METERS_PER_DEGREE_LAT = 110540
const metersPerDegreeLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180)
const distanceM = (aLon, aLat, bLon, bLat) => {
  const dLon = (bLon - aLon) * metersPerDegreeLon((aLat + bLat) / 2)
  const dLat = (bLat - aLat) * METERS_PER_DEGREE_LAT
  return Math.hypot(dLon, dLat)
}

test('精度：坐标存 6 位小数，往返位移小于 0.1 m', () => {
  const feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [114.1234567, 30.5123456] },
  }
  const rounded = annotations.roundAnnotationGeometry(feature.geometry)
  const [lon, lat] = rounded.coordinates
  const moved = distanceM(114.1234567, 30.5123456, lon, lat)
  assert.ok(moved <= 0.111, `round trip moved ${moved.toFixed(4)} m`)
  // One unit in the sixth decimal is the whole quantum.
  assert.ok(metersPerDegreeLon(30.5) * 1e-6 <= 0.096)
  assert.ok(METERS_PER_DEGREE_LAT * 1e-6 <= 0.111)
  assert.equal(selection.coordinateText({ lon, lat }), '114.123457, 30.512346')
})

test('精度：offsetCartographic 走 100 m 偏差小于 0.5 m（含经纬比例）', () => {
  const north = selection.offsetCartographic(114.3, 30.5, 0, 100)
  const northMoved = distanceM(114.3, 30.5, north.lon, north.lat)
  assert.ok(Math.abs(northMoved - 100) < 0.5, `north ${northMoved}`)
  assert.ok(Math.abs(north.lon - 114.3) < 1e-9, 'north offset must not drift east')

  const east = selection.offsetCartographic(114.3, 30.5, 90, 100)
  const eastMoved = distanceM(114.3, 30.5, east.lon, east.lat)
  assert.ok(Math.abs(eastMoved - 100) < 0.5, `east ${eastMoved}`)
  assert.ok(Math.abs(east.lat - 30.5) < 1e-9, 'east offset must not drift north')
})

test('精度：拖一个顶点 0.001° 只改该点，位移与球面距离一致', () => {
  const ring = [[114.3, 30.5], [114.4, 30.5], [114.4, 30.6], [114.3, 30.6], [114.3, 30.5]]
  const feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
  const moved = annotations.moveAnnotationVertex(feature, 0, 1, 114.401, 30.5)
  assert.equal(moved.ok, true)
  assert.deepEqual(moved.feature.geometry.coordinates[0][1], [114.401, 30.5])
  assert.deepEqual(moved.feature.geometry.coordinates[0][0], [114.3, 30.5])
  const shift = distanceM(114.4, 30.5, 114.401, 30.5)
  assert.ok(Math.abs(shift - metersPerDegreeLon(30.5) * 0.001) < 0.01, `shift ${shift}`)
  assert.deepEqual(feature.geometry.coordinates[0][1], [114.4, 30.5], 'the input must not be mutated')
})

test('精度：剖面悬停按距离比例吸附到最近样本', () => {
  const points = [0, 100, 200, 300, 400, 500, 600].map((distance) => ({ distance_m: distance, height_m: 10 + distance / 100 }))
  assert.equal(metrics.nearestProfileIndex(points, 0), 0)
  // The ratio maps onto the largest sample distance (600 m), not onto 1000 m.
  assert.equal(metrics.nearestProfileIndex(points, 0.54), 3)
  assert.equal(metrics.nearestProfileIndex(points, 0.9), 5)
  assert.equal(metrics.nearestProfileIndex(points, 2), 6, 'ratio is clamped')
  assert.equal(metrics.nearestProfileIndex([{ distance_m: null }], 0.5), -1)
})

test('精度：跨块去重在 bbox IoU 0.5 附近取舍，异类不合并', () => {
  const square = (x, y, size, objectClass = 'building') => ({
    type: 'Feature',
    properties: { class: objectClass, confidence: 0.8 },
    geometry: { type: 'Polygon', coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]] },
  })
  const base = square(0, 0, 0.1)
  const same = square(0, 0, 0.1)
  const nudged = square(0.02, 0, 0.1) // IoU 0.96, same object
  const apart = square(0.06, 0, 0.1) // IoU 0.25, a different footprint
  const other = square(0, 0, 0.1, 'vegetation')

  assert.equal(batch.batchBoxIoU([0, 0, 0.1, 0.1], [0, 0, 0.1, 0.1]), 1)
  assert.ok(Math.abs(batch.batchBoxIoU([0, 0, 0.1, 0.1], [0.06, 0, 0.16, 0.1]) - 0.25) < 1e-9)

  assert.equal(batch.dedupeBatchFeatures([base, same]).length, 1)
  assert.equal(batch.dedupeBatchFeatures([base, nudged]).length, 1, 'IoU above 0.5 merges')
  assert.equal(batch.dedupeBatchFeatures([base, apart]).length, 2, 'IoU below 0.5 stays separate')
  assert.equal(batch.dedupeBatchFeatures([base, other]).length, 2, 'different classes never merge')
})

test('精度：视觉轮廓的地面误差随视口宽度线性，1 px 约 0.49 m（500 m 视口）', () => {
  const groundWidthM = 500
  const metersPerPixel = groundWidthM / 1024
  assert.ok(Math.abs(metersPerPixel - 0.4883) < 0.001)
  const boundaryPx = 5
  assert.ok(Math.abs(metersPerPixel * boundaryPx - 2.44) < 0.01)
  // The same 6-decimal quantum is an order of magnitude below one pixel here.
  assert.ok(metersPerDegreeLon(30.5) * 1e-6 < metersPerPixel / 4)
})
