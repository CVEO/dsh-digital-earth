/**
 * v1.6 S2-P1 — `earth_analyze` clip (D-16, approved 2026-11-06).
 *
 * Clip cuts the 3D Tiles with one horizontal plane. Cesium clips the NEGATIVE
 * side of a ClippingPlane, so the sign of normal/distance is the whole feature:
 *   - keep=below  -> remove everything ABOVE the plane (normal points down)
 *   - keep=above  -> remove everything BELOW the plane (normal points up)
 * The plane maths is a pure helper (`analysisClipPlane`) so these sign rules are
 * tested without a Cesium viewer; the engine restore + host validation are pinned
 * structurally.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ANALYZE_ACTIONS, normalizeAnalyzeRequest } from '../src/host/tools/analyze.js'
import { analysisClipPlane } from '../src/client/analysis/math.js'
import { hostSource, readRepoFile } from './helpers/source.mjs'

// ---------------------------------------------------------------------------
// Host contract
// ---------------------------------------------------------------------------

const args = (raw) => normalizeAnalyzeRequest(raw).args
const rejects = (raw, pattern) => {
  assert.throws(() => normalizeAnalyzeRequest(raw), (error) => {
    assert.match(error.message, /^earth_analyze: /)
    assert.match(error.message, / next: /)
    if (pattern) assert.match(error.message, pattern)
    return true
  })
}

test('clip：动作枚举包含 clip，默认 keep=below，height 透传', () => {
  assert.deepEqual([...ANALYZE_ACTIONS], ['profile', 'flood', 'sunlight', 'clip', 'skyline', 'clear'])
  assert.deepEqual(args({ action: 'clip', height: 320 }), { action: 'clip', height: 320, keep: 'below' })
  assert.deepEqual(args({ action: 'clip', height: -12.5, keep: 'above' }), { action: 'clip', height: -12.5, keep: 'above' })
  assert.deepEqual(args({ action: 'clip', height: 0, layer: '  A  ' }), { action: 'clip', height: 0, keep: 'below', layer: 'A' })
})

test('clip：缺 height / 非法 keep / 越界 / 多余参数都被拒绝且带 next', () => {
  rejects({ action: 'clip' }, /clip needs "height"/)
  rejects({ action: 'clip', height: 'high' }, /"height" must be a finite number/)
  rejects({ action: 'clip', height: 9001 }, /"height" 9001 is outside -1000\.\.9000/)
  rejects({ action: 'clip', height: 10, keep: 'sideways' }, /"keep" must be "below" or "above"/)
  rejects({ action: 'clip', height: 10, water_height: 20 }, /does not accept "water_height"/)
  rejects({ action: 'profile', from: [0, 0], to: [1, 1], height: 10 }, /use action "clip" for these arguments/)
  rejects({ action: 'nope' }, /"action" must be one of profile, flood, sunlight, clip, skyline, clear/)
})

test('clip：模型面文本含裁剪结果与下一步', () => {
  const host = hostSource()
  assert.match(host, /operation === 'clip'/)
  assert.match(host, /plane at \$\{height\}, keeping \$\{keep\}/)
  assert.match(host, /earth_analyze action=clear to remove the clip/)
})

// ---------------------------------------------------------------------------
// Pure plane maths (fake Cesium: up = +Z, centre at ellipsoid height 100)
// ---------------------------------------------------------------------------

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }
}

const fakeCesium = {
  Cartesian3: Object.assign(Vec3, {
    multiplyByScalar: (value, scalar, out) => {
      out.x = value.x * scalar
      out.y = value.y * scalar
      out.z = value.z * scalar
      return out
    },
    add: (left, right, out) => {
      out.x = left.x + right.x
      out.y = left.y + right.y
      out.z = left.z + right.z
      return out
    },
    dot: (left, right) => left.x * right.x + left.y * right.y + left.z * right.z,
    negate: (value, out) => {
      out.x = -value.x
      out.y = -value.y
      out.z = -value.z
      return out
    },
    clone: (value, out) => {
      out.x = value.x
      out.y = value.y
      out.z = value.z
      return out
    },
  }),
  Cartographic: { fromCartesian: () => ({ longitude: 0, latitude: 0, height: 100 }) },
  Ellipsoid: { WGS84: { geodeticSurfaceNormal: () => new Vec3(0, 0, 1) } },
}

/** Plane equation used by Cesium: dot(normal, p) + distance; negative = clipped. */
const space = (plane) => (p) => plane.normal.x * p.x + plane.normal.y * p.y + plane.normal.z * p.z + plane.distance

test('clip 平面：keep=below 裁掉平面上方，keep=above 裁掉平面下方', () => {
  // Centre sits at ellipsoid height 100; the clip plane is at height 150 (z=150
  // in this fake frame where the local up is +Z).
  const center = new Vec3(0, 0, 100)
  const below = analysisClipPlane(fakeCesium, center, 150, 'below')
  assert.equal(below.keep, 'below')
  const f = space(below)
  assert.ok(f(new Vec3(0, 0, 140)) > 0, '平面下方必须保留（正侧）')
  assert.ok(f(new Vec3(0, 0, 160)) < 0, '平面上方必须被裁掉（负侧）')
  assert.equal(below.distance, 150)

  const above = analysisClipPlane(fakeCesium, center, 150, 'above')
  assert.equal(above.keep, 'above')
  const g = space(above)
  assert.ok(g(new Vec3(0, 0, 160)) > 0, '平面上方必须保留')
  assert.ok(g(new Vec3(0, 0, 140)) < 0, '平面下方必须被裁掉')
  assert.equal(above.distance, -150)
})

test('clip 平面：默认 keep=below；无包围球/非法中心返回 null', () => {
  assert.equal(analysisClipPlane(fakeCesium, new Vec3(0, 0, 0), 200).keep, 'below')
  assert.equal(analysisClipPlane(fakeCesium, null, 10), null)
  const noHeight = { ...fakeCesium, Cartographic: { fromCartesian: () => ({ longitude: 0, latitude: 0, height: Number.NaN }) } }
  assert.equal(analysisClipPlane(noHeight, new Vec3(0, 0, 0), 10), null)
})

// ---------------------------------------------------------------------------
// Client engine wiring
// ---------------------------------------------------------------------------

test('engine：clip 走纯平面 helper 与共享裁剪登记表，结果字段齐全', () => {
  const engine = readRepoFile('src/client/analysis/engine.js')
  assert.match(engine, /const analyzeClip = async \(Cesium, viewer, layer, args\) => \{/)
  assert.match(engine, /const plane = analysisClipPlane\(Cesium, center, height, args\.keep\)/)
  assert.match(engine, /analysisLocalizeClipPlane\(Cesium, plane, tileset, center\)/)
  // 集合创建/挂载只发生在 scene/clip-collections.js，engine 只申请与释放，
  // 这样清除剖切时不会把 clippingPlanes 赋 undefined 而销毁渲染纹理。
  assert.match(engine, /acquireClipCollection\(Cesium, tileset, \{/)
  assert.doesNotMatch(engine, /clippingPlanes\s*=/)
  assert.match(engine, /if \(operation === 'sunlight'\) result = analyzeSunlight\(Cesium, viewer, layer, args\)\n\s+else result = await analyzeClip/)
  // 结果字段与清空语义。
  for (const field of ['operation: ', 'height: ', 'keep: ', 'planes: ', 'layer_center_height: ']) {
    assert.ok(engine.includes(field), `clip 结果缺少 ${field}`)
  }
})
