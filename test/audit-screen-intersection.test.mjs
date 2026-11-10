import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rowsInScreenBox } from '../src/client/scene/screen-intersection.js'

const box = { x1: 100, y1: 100, x2: 200, y2: 200 }
const viewer = { scene: {}, clock: {} }
const ring = (low, high) => [{ x: low, y: low }, { x: high, y: low }, { x: high, y: high }, { x: low, y: high }]

test('屏幕相交：穿框线、包含框的面可选，洞内部和隐藏对象不选，重复实体只投影一次', () => {
  let projections = 0, reads = 0
  const Cesium = { SceneTransforms: { worldToWindowCoordinates: (scene, point) => { projections++; return point } } }
  const line = { polyline: { positions: [{ x: 50, y: 150 }, { x: 250, y: 150 }] } }
  const polygon = { polygon: { hierarchy: { getValue() { reads++; return { positions: ring(0, 300) } } } } }
  const hole = { polygon: { hierarchy: { positions: ring(0, 300), holes: [{ positions: ring(50, 250) }] } } }
  const rows = [line, polygon, hole, { ...line, isShowing: false }, line].map((entity, index) => ({ kind: 'draw', index, entities: [entity] }))
  assert.deepEqual(rowsInScreenBox(Cesium, viewer, rows, box).map((row) => row.index), [0, 1, 4])
  assert.equal(reads, 1)
  assert.equal(projections, 14)
})

test('投影缺失和不相交线段不会产生伪命中', () => {
  const Cesium = { SceneTransforms: { worldToWindowCoordinates: (scene, point) => point } }
  const rows = [{ entities: [{ polyline: { positions: [{ x: 50, y: 50 }, { x: 250, y: 50 }] } }] },
    { entities: [{ polygon: { hierarchy: { positions: [null, null, null] } } }] }]
  assert.deepEqual(rowsInScreenBox(Cesium, viewer, rows, box), [])
})

test('图形自身的 show 属性为 false 时不参与框选', () => {
  const Cesium = { SceneTransforms: { worldToWindowCoordinates: (scene, point) => point } }
  const rows = [
    { entities: [{ polyline: { show: false, positions: [{ x: 50, y: 150 }, { x: 250, y: 150 }] } }] },
    { entities: [{ polygon: { show: { getValue: () => false }, hierarchy: { positions: ring(0, 300) } } }] },
  ]
  assert.deepEqual(rowsInScreenBox(Cesium, viewer, rows, box), [])
})
