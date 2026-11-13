/**
 * v1.6 batch12 — F5 profile v2: draggable endpoints + chart/globe hover.
 *
 * The behaviour that matters is pure and testable without a browser:
 *   - endpoints come only from a real profile result (never guessed);
 *   - a dragged endpoint replaces exactly one side and keeps the height source;
 *   - a mouse position maps to the nearest sample for both the line and the chart.
 * The wiring assertions then pin the one remaining integration: the panel must
 * create the editor, sync it with the analysis, and pass the hover index to the
 * analysis card.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  PROFILE_EDIT_KEYS,
  nearestProfileHit,
  moveProfileEndpoint,
  profileEndpoints,
  profileHeightSource,
} from '../src/client/scene/profile-edit.js'
import { nearestProfileIndex } from '../src/client/analysis/profile-metrics.js'
import { MESSAGES } from '../src/client/messages.js'
import { PROFILE_MESSAGES } from '../src/client/messages-profile.js'
import { readRepoFile } from './helpers/source.mjs'

const analysis = {
  operation: 'profile',
  layerName: 'demo',
  result: {
    from: [114.3, 30.5],
    to: [114.31, 30.51],
    height_mode: 'terrain',
    points: [
      { distance_m: 0, height_m: 20 },
      { distance_m: 100, height_m: 30 },
      { distance_m: 200, height_m: null },
      { distance_m: 300, height_m: 27 },
    ],
  },
}

test('profileEndpoints：只有真实剖面结果才给端点', () => {
  assert.deepEqual(profileEndpoints(analysis), { from: [114.3, 30.5], to: [114.31, 30.51] })
  assert.equal(profileEndpoints(null), null)
  assert.equal(profileEndpoints({ operation: 'flood', result: {} }), null)
  assert.equal(profileEndpoints({ operation: 'profile', result: { from: [1, 2] } }), null)
  // 端点必须是 2 个以上数字的数组，缺一个就不猜。
  assert.equal(profileEndpoints({ operation: 'profile', result: { from: [1], to: [2, 3] } }), null)
})

test('profileHeightSource：重算沿用这一次运行的高程源', () => {
  assert.equal(profileHeightSource(analysis), 'terrain')
  assert.equal(profileHeightSource({ operation: 'profile', result: { height_mode: 'tiles' } }), 'tiles')
  assert.equal(profileHeightSource({ operation: 'profile', result: {} }), 'tiles')
  assert.equal(profileHeightSource(null), 'tiles')
})

test('moveProfileEndpoint：只替换被拖的那一端', () => {
  const endpoints = { from: [114.3, 30.5], to: [114.31, 30.51] }
  const moved = moveProfileEndpoint(endpoints, 0, [114.2, 30.4])
  assert.deepEqual(moved, { from: [114.2, 30.4], to: [114.31, 30.51] })
  assert.deepEqual(endpoints, { from: [114.3, 30.5], to: [114.31, 30.51] }, '不得原地改输入')
  assert.deepEqual(moveProfileEndpoint(endpoints, 1, [114.4, 30.6]), { from: [114.3, 30.5], to: [114.4, 30.6] })
  assert.deepEqual(moveProfileEndpoint(endpoints, 1, [114.4]), endpoints, '非法坐标原样返回')
})

test('nearestProfileHit：16px 内取最近样本，否则 -1', () => {
  const screens = [
    { x: 10, y: 10 },
    { x: 50, y: 50 },
    { x: 100, y: 100 },
  ]
  assert.equal(nearestProfileHit(screens, { x: 52, y: 51 }), 1)
  assert.equal(nearestProfileHit(screens, { x: 12, y: 12 }), 0)
  assert.equal(nearestProfileHit(screens, { x: 200, y: 200 }), -1)
  assert.equal(nearestProfileHit(screens, { x: 21, y: 10 }, 8), -1, '阈值要生效')
  assert.equal(nearestProfileHit(screens, { x: 21, y: 10 }, 12), 0)
  assert.equal(nearestProfileHit([], { x: 0, y: 0 }), -1)
  assert.equal(nearestProfileHit(null, { x: 0, y: 0 }), -1)
})

test('nearestProfileIndex：图表比例换算成样本序号，无高程点也能定位', () => {
  const points = analysis.result.points
  assert.equal(nearestProfileIndex(points, 0), 0)
  assert.equal(nearestProfileIndex(points, 0.35), 1)
  assert.equal(nearestProfileIndex(points, 0.66), 2)
  assert.equal(nearestProfileIndex(points, 1), 3)
  assert.equal(nearestProfileIndex(points, 5), 3, '比例要夹到 1')
  assert.equal(nearestProfileIndex(points, -1), 0, '比例要夹到 0')
  assert.equal(nearestProfileIndex([], 0.5), -1)
  assert.equal(nearestProfileIndex([{ height_m: 3 }], 0.5), -1, '没有距离就不猜序号')
})

test('i18n：F5 文案中英齐全，并已并入 MESSAGES', () => {
  for (const key of PROFILE_EDIT_KEYS.concat(['profile.hoverReadout', 'profile.hoverEmpty', 'profile.hoverHint'])) {
    assert.equal(typeof PROFILE_MESSAGES.zh[key], 'string', `zh 缺 ${key}`)
    assert.equal(typeof PROFILE_MESSAGES.en[key], 'string', `en 缺 ${key}`)
    assert.equal(MESSAGES.zh[key], PROFILE_MESSAGES.zh[key])
    assert.equal(MESSAGES.en[key], PROFILE_MESSAGES.en[key])
  }
  assert.match(PROFILE_MESSAGES.zh['profile.recomputing'], /重算/)
  assert.match(PROFILE_MESSAGES.en['profile.recomputeFailed'], /\{message\}/)
})

test('接线：编辑器只加手柄/读数，图表与右栈共享同一个 hover 序号', () => {
  const edit = readRepoFile('src/client/scene/profile-edit.js')
  assert.match(edit, /export function createProfileEdit\(/)
  assert.match(edit, /mv-vertex-layer/)
  assert.match(edit, /mv-vertex center/)
  assert.match(edit, /pickSurface\?\.\(position\)/)
  assert.match(edit, /EllipsoidGeodesic/)
  assert.match(edit, /id: `\$\{READOUT_ID\}-\$\{index\}`/)
  assert.match(edit, /document\.addEventListener\('pointermove', move, true\)/)
  assert.match(edit, /onHover\(state\.hover\)/)

  const chart = readRepoFile('src/client/ui/profile-chart.js')
  assert.match(chart, /onPointerMove/)
  assert.match(chart, /onPointerLeave/)
  assert.match(chart, /nearestProfileIndex\(points,/)

  const stack = readRepoFile('src/client/ui/right-stack.js')
  assert.match(stack, /hoverIndex: analysisHover, onHover: onAnalysisHover/)

  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /createProfileEdit\(\{/)
  assert.match(surface, /profileEdit\.sync\(analysis\); return \(\) => profileEdit\.clear\(\)/)
  assert.match(surface, /analysisHover: profileHover,/)
  assert.match(surface, /profileEdit\.setHover\(index\)/)
  assert.match(surface, /action: 'profile',\s*from,\s*to,\s*samples:/)
})
