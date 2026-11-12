/**
 * v1.6 Batch 5 — F0#3: computeSwipeClipPlane must stay exact for orthographic cameras
 * (no FOV, world-unit offsets) and for narrow/tall viewports (Cesium's perspective `fov`
 * is the vertical FOV when aspect <= 1), instead of falling back to a default PI/3 cone.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

import * as RealCesium from '../vendor/cesium/index.js'

const { computeSwipeClipPlane } = await import('../src/client/scene/swipe.js')

// Local ENU frame at (0, 0, 6378137): c0 = East (+X), c1 = North (+Y), c2 = Up (+Z).
const origin = new RealCesium.Cartesian3(0, 0, 6378137)
const enuMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, origin.x, origin.y, origin.z, 1]
const tileset = {
  boundingSphere: { center: origin },
  clippingPlanesOriginMatrix: enuMatrix,
}

// Camera 200 m above the local origin, looking straight down: Right = +X, Up = +Y.
const makeCamera = (frustum) => ({
  positionWC: new RealCesium.Cartesian3(0, 0, 6378337),
  directionWC: new RealCesium.Cartesian3(0, 0, -1),
  rightWC: new RealCesium.Cartesian3(1, 0, 0),
  upWC: new RealCesium.Cartesian3(0, 1, 0),
  frustum,
})

const evalPlane = (x, y, z, plane) => plane.normal.x * x + plane.normal.y * y + plane.normal.z * z + plane.distance
const nearZero = (value) => Math.abs(value) < 1e-6

test('F0#3: 正交相机垂直卷帘按世界距离分割，且平面与视线平行（与深度无关）', () => {
  const camera = makeCamera({ width: 400, height: 300, aspectRatio: 400 / 300 })
  const plane = computeSwipeClipPlane(RealCesium, camera, tileset, { ratio: 0.25, orientation: 'vertical' })
  assert.ok(plane, '正交相机必须给出裁剪平面而不是退回默认视锥')

  // ratio 0.25 → 分割线在 x = (2*0.25-1)*400/2 = -100 m 处，左侧保留。
  assert.ok(evalPlane(-150, 0, 0, plane) > 0, '分割线左侧应保留')
  assert.ok(evalPlane(-50, 0, 0, plane) < 0, '分割线右侧应被裁掉')
  assert.ok(nearZero(evalPlane(-100, 0, 100, plane)), '正交平面平行于视线，近处深度边界必须仍在 x=-100')
  assert.ok(nearZero(evalPlane(-100, 0, -100, plane)), '正交平面平行于视线，远处深度边界必须仍在 x=-100')
})

test('F0#3: 透视相机同一几何下分割线随深度移动，证明正交分支不是偷懒复用', () => {
  const camera = makeCamera({ fov: Math.PI / 2, fovy: Math.PI / 2, aspectRatio: 1 })
  const plane = computeSwipeClipPlane(RealCesium, camera, tileset, { ratio: 0.25, orientation: 'vertical' })
  assert.ok(plane)
  // fov=90°、ratio 0.25 → k = -0.5，分割线 x = 0.5z - 100：随深度移动，与正交的固定 x=-100 形成对照。
  assert.ok(nearZero(evalPlane(-100, 0, 0, plane)), '透视 ratio 0.25 在局部 z=0（相机下 200 m）处分割线在 x=-100')
  assert.ok(nearZero(evalPlane(-50, 0, 100, plane)), '透视平面倾斜：更近的 z=100 处分割线移到 x=-50')
  assert.ok(nearZero(evalPlane(-150, 0, -100, plane)), '更远的 z=-100 处分割线移到 x=-150')
})

test('F0#3: 竖直窄窗口（aspect<1）把 fov 当垂直 FOV，水平半角按 aspect 收窄', () => {
  const camera = makeCamera({ fov: Math.PI / 2, fovy: Math.PI / 2, aspectRatio: 0.4 })
  const plane = computeSwipeClipPlane(RealCesium, camera, tileset, { ratio: 0.25, orientation: 'vertical' })
  assert.ok(plane)
  // fov=90° 且 aspect=0.4 → tanHalfX = 0.4；相机下 200 m 处分割线在 x = -0.5*0.4*200 = -40 m。
  assert.ok(nearZero(evalPlane(-40, 0, 0, plane)), '窄窗口分割线必须落在 x=-40，而不是宽窗口的 x=-100')
  assert.ok(evalPlane(-60, 0, 0, plane) > 0)
  assert.ok(evalPlane(-20, 0, 0, plane) < 0)
})

test('F0#3: 正交相机支持 left/right 跨度与水平卷帘，缺 frustum 时安全退回', () => {
  const offsetCamera = makeCamera({ left: -200, right: 200, aspectRatio: 1 })
  const vertical = computeSwipeClipPlane(RealCesium, offsetCamera, tileset, { ratio: 0.25, orientation: 'vertical' })
  assert.ok(nearZero(evalPlane(-100, 0, 0, vertical)), 'left/right 跨度应等价于 width=400')

  const horizontalCamera = makeCamera({ width: 400, height: 300, aspectRatio: 400 / 300 })
  const horizontal = computeSwipeClipPlane(RealCesium, horizontalCamera, tileset, { ratio: 0.75, orientation: 'horizontal' })
  assert.ok(horizontal)
  // v = 1 - 2*0.75 = -0.5 → 分割线在 y = -0.5*300/2 = -75 m 处，上方保留。
  assert.ok(evalPlane(0, -50, 0, horizontal) > 0)
  assert.ok(evalPlane(0, -100, 0, horizontal) < 0)
  assert.ok(nearZero(evalPlane(0, -75, 500, horizontal)), '正交水平平面也与深度无关')

  const noFrustum = makeCamera(undefined)
  const fallback = computeSwipeClipPlane(RealCesium, noFrustum, tileset, {
    ratio: 0.5,
    orientation: 'vertical',
    canvas: { clientWidth: 800, clientHeight: 600 },
  })
  assert.ok(fallback, '缺 frustum 时按画布比例退回透视投影而不是崩掉')
  assert.ok(Number.isFinite(fallback.normal.x) && Number.isFinite(fallback.distance))
})
