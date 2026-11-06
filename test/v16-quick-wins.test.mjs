/**
 * v1.6 S1-4 — four "feel direct" improvements.
 *
 * 1. one-click frame-all for every visible 3D Tiles layer (there was only
 *    per-layer fly);
 * 2. double-click flies to the point under the cursor (and still finishes a
 *    measurement when a tool is active);
 * 3. capture now ends with an actionable next step like the other tools;
 * 4. the panel shows the active spatial analysis and can clear it in one click.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { combinedBoundingSphere, flyToCartographic, frameAllLayers } from '../src/client/scene/frame.js'
import { clientSource, hostSource } from './helpers/source.mjs'

/** Tiny stand-in for the Cesium maths used by scene/frame.js. */
const Cartesian3 = class Cartesian3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }

  static add(left, right, out) {
    out.x = left.x + right.x
    out.y = left.y + right.y
    out.z = left.z + right.z
    return out
  }

  static divideByScalar(value, scalar, out) {
    out.x = value.x / scalar
    out.y = value.y / scalar
    out.z = value.z / scalar
    return out
  }

  static distance(left, right) {
    return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
  }

  static fromRadians() {
    return { fromRadians: true }
  }
}

const Cesium = {
  Cartesian3,
  BoundingSphere: class BoundingSphere {
    constructor(center, radius) {
      this.center = center
      this.radius = radius
    }
  },
}

const layer = (x, radius, visible = true) => ({ visible, tileset: { boundingSphere: { center: { x, y: 0, z: 0 }, radius } } })

test('框全图层：合并所有可见图层的包围球，忽略隐藏层与无包围球层', () => {
  assert.equal(combinedBoundingSphere(Cesium, []), null)
  assert.equal(combinedBoundingSphere(Cesium, [layer(0, 10, false)]), null)

  const single = combinedBoundingSphere(Cesium, [layer(5, 7)])
  assert.equal(single.center.x, 5)
  assert.equal(single.radius, 7)

  const merged = combinedBoundingSphere(Cesium, [layer(0, 10), layer(100, 10), { visible: true, tileset: null }])
  assert.equal(merged.center.x, 50)
  // 50 away from each centre plus that layer's own radius.
  assert.equal(merged.radius, 60)
})

test('框全图层：flyToBoundingSphere 带 15% 余量；没有可见图层时返回 false', () => {
  const calls = []
  const viewer = { camera: { flyToBoundingSphere: (sphere, options) => calls.push({ sphere, options }) } }
  assert.equal(frameAllLayers(viewer, Cesium, [layer(0, 10), layer(20, 10)], 0.9), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].sphere.center.x, 10)
  // centre 10 → each layer centre is 10 away, plus that layer's radius 10 = 20,
  // then the 15% margin = 23.
  assert.equal(calls[0].sphere.radius, 23)
  assert.equal(calls[0].options.duration, 0.9)
  assert.equal(frameAllLayers(viewer, Cesium, []), false)
  assert.equal(frameAllLayers(null, Cesium, [layer(0, 1)]), false)
})

test('双击飞向光标：保持当前朝向与高度，只把目标点移到画面中心', () => {
  const calls = []
  const viewer = {
    camera: {
      heading: 1.23,
      pitch: -0.6,
      positionCartographic: { height: 800 },
      flyTo: (options) => calls.push(options),
    },
  }
  assert.equal(flyToCartographic(viewer, Cesium, { longitude: 2.1, latitude: 0.5 }), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].orientation.heading, 1.23)
  assert.equal(calls[0].orientation.pitch, -0.6)
  assert.equal(calls[0].orientation.roll, 0)
  assert.equal(calls[0].duration, 0.8)
  // Invalid / missing input must be a no-op, not a crash.
  assert.equal(flyToCartographic(viewer, Cesium, null), false)
  assert.equal(flyToCartographic(viewer, Cesium, { longitude: Number.NaN, latitude: 0 }), false)
  assert.equal(flyToCartographic(null, Cesium, { longitude: 0, latitude: 0 }), false)
})

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

test('接线：双击在测量工具激活时结束测量，否则飞向光标点', () => {
  const client = clientSource()
  assert.match(client, /Cesium\.ScreenSpaceEventType\.LEFT_DOUBLE_CLICK/)
  assert.match(client, /if \(toolRef\.current\) \{\s*\n\s*finishMeasure\(\)/)
  assert.match(client, /sampleCursor\(viewerNow, Cesium, event\.position, \{ pickPosition: true \}\)/)
  assert.match(client, /flyToCartographic\(viewerNow, Cesium, carto\)/)
})

test('接线：面板标题栏有「框全」按钮，并传入可见图层', () => {
  const client = clientSource()
  assert.match(client, /onFrameAll: \(\) => frameAllLayers\(viewerRef\.current, cesiumRef\.current, layersRef\.current\)/)
  assert.match(client, /t\('layers\.frameAll'\)/)
})

test('接线：面板显示当前分析并可一键清除', () => {
  const client = clientSource()
  assert.match(client, /analysis,\n\s*onClearAnalysis: \(\) => clearAnalysis\(\)/)
  assert.match(client, /t\('layers\.analysis'\)/)
  assert.match(client, /t\('layers\.analysisClear'\)/)
  assert.match(client, /t\('layers\.analysisHint'\)/)
})

test('C1：截图结果以可执行的下一步结束（与 draw/measure/analyze 一致）', () => {
  const host = hostSource()
  assert.match(host, /Captured image: \$\{value\.path\}/)
  assert.match(host, /Next: read the image with read_image/)
  // 中文/英文文案各一条（面板 toast 与提示）。
  const client = clientSource()
  for (const key of ['layers.frameAll', 'layers.analysis', 'layers.analysisHint', 'layers.analysisClear']) {
    const hits = client.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.ok(hits.length >= 2, `locale 缺少 ${key}（中英各一条），实际 ${hits.length}`)
  }
})
