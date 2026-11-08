/**
 * A1/A2 tests: coordinate input parsing/flight and profile cut-fill/slope/export.
 *
 * The profile fixture is the real 32-sample LOD18 profile returned by
 * `earth_analyze profile` from [113.130,31.003] to [113.148,31.015]. The contract
 * is unchanged: these pure functions only derive extra fields client-side.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { profileCsv, profileMetrics, profileSvg } from '../src/client/analysis/profile-metrics.js'
import { flyToCoordinates, parseLonLat } from '../src/client/scene/fly-target.js'
import { readRepoFile } from './helpers/source.mjs'

const LOD18_PROFILE = [
  [0, 72],
  [70.1, 73],
  [140.2, 80.9],
  [210.4, 89.9],
  [280.5, 97.9],
  [350.6, 104],
  [420.7, 111],
  [490.8, 116.5],
  [560.9, 116.1],
  [631.1, 116.6],
  [701.2, 109.8],
  [771.3, 98.8],
  [841.4, 79],
  [911.5, 73.1],
  [981.6, 72],
  [1051.8, 71.9],
  [1121.9, 72.1],
  [1192, 72.2],
  [1262.1, 70.6],
  [1332.2, 67.5],
  [1402.4, 67.7],
  [1472.5, 69.7],
  [1542.6, 69.6],
  [1612.7, 71.6],
  [1682.8, 71.9],
  [1752.9, 71.2],
  [1823.1, 69.8],
  [1893.2, 77.2],
  [1963.3, 76.6],
  [2033.4, 72.9],
  [2103.5, 73.6],
  [2173.6, 81.8],
].map(([distance_m, height_m]) => ({ distance_m, height_m }))

const near = (actual, expected, tolerance = 0.01) =>
  assert.ok(
    Math.abs(actual - expected) <= Math.abs(expected) * tolerance,
    `expected ${expected} ±${tolerance * 100}%, got ${actual}`,
  )

test('A2 profile：起终点坡线的 3D 长度、坡度、挖填面积与体积', () => {
  const metrics = profileMetrics(LOD18_PROFILE, { mode: 'grade', width_m: 7 })
  assert.equal(metrics.point_count, 32)
  assert.equal(metrics.valid_count, 32)
  near(metrics.distance_m, 2173.6, 1e-6)
  near(metrics.length_3d_m, 2181.2, 0.001)
  near(metrics.slope.mean_abs_pct, 5.63, 0.02)
  near(metrics.slope.max_abs_pct, 28.2, 0.02)
  near(metrics.design_grade_pct, 0.451, 0.02)
  // 7 m 宽、起终点坡线；与独立计算一致。
  near(metrics.cut_area_m2, 21320, 0.01)
  near(metrics.fill_area_m2, 8861, 0.01)
  near(metrics.cut_volume_m3, 149243, 0.01)
  near(metrics.fill_volume_m3, 62026, 0.01)
  near(metrics.net_volume_m3, 87217, 0.01)
  assert.equal(metrics.warnings.length, 0)
  // Series 每行都带地形/设计/差值，供 CSV 与 SVG 复用。
  assert.equal(metrics.series.length, 32)
  assert.equal(metrics.series[0].design_m, 72)
  assert.ok(Number.isFinite(metrics.series[10].delta_m))
})

test('A2 profile：水平基准取最低点，设计坡度归零，宽度夹到 1..100', () => {
  const metrics = profileMetrics(LOD18_PROFILE, { mode: 'level' })
  assert.equal(metrics.mode, 'level')
  assert.equal(metrics.design.level_m, 67.5)
  assert.equal(metrics.design_grade_pct, 0)
  assert.ok(metrics.cut_area_m2 > 0)
  assert.ok(metrics.warnings.includes('level_from_min'))

  const clamped = profileMetrics(LOD18_PROFILE, { mode: 'grade', width_m: 999 })
  assert.equal(clamped.width_m, 100)
  assert.ok(clamped.warnings.includes('width_clamped'))
})

test('A2 profile：数据缺口不连线，不足两点返回明确空结果', () => {
  const gapped = profileMetrics(
    [
      { distance_m: 0, height_m: 10 },
      { distance_m: 10, height_m: null },
      { distance_m: 20, height_m: 12 },
      { distance_m: 30, height_m: 14 },
    ],
    { mode: 'grade' },
  )
  assert.equal(gapped.valid_count, 3)
  assert.ok(gapped.warnings.includes('profile_gaps'))
  assert.equal(gapped.series[1].height_m, null)

  const empty = profileMetrics([], {})
  assert.equal(empty.valid_count, 0)
  assert.ok(empty.warnings.includes('no_profile'))
})

test('A2 export：CSV 表头/行数，SVG 单文件且转义标签', () => {
  const metrics = profileMetrics(LOD18_PROFILE, { mode: 'grade', width_m: 7 })
  const csv = profileCsv(metrics)
  const lines = csv.trim().split(/\r\n/)
  assert.equal(lines[0], 'distance_m,terrain_m,design_m,delta_m,slope_pct')
  assert.equal(lines.length, 33)

  const svg = profileSvg(metrics, {
    title: '剖面 & 设计线',
    distance: '距离',
    elevation: '高程',
    terrain: '地表',
    design: '设计线',
    cut: '挖方',
    fill: '填方',
    note: '示意',
  })
  assert.ok(svg.startsWith('<svg'))
  assert.ok(svg.includes('<polyline'))
  assert.ok(svg.includes('<polygon'))
  assert.ok(svg.includes('剖面 &amp; 设计线'), 'SVG text must escape XML entities')
  assert.ok(svg.includes('</svg>'))
})

test('A1 coordinates：解析 lon,lat[,height]，拒绝 URL/路径/越界', () => {
  assert.deepEqual(parseLonLat('113.14,31.02'), { lon: 113.14, lat: 31.02, height: null })
  assert.deepEqual(parseLonLat('113.14 31.02 900'), { lon: 113.14, lat: 31.02, height: 900 })
  assert.deepEqual(parseLonLat('113.14，31.02'), { lon: 113.14, lat: 31.02, height: null })
  assert.equal(parseLonLat('113.14'), null)
  assert.equal(parseLonLat('-200,31'), null)
  assert.equal(parseLonLat('113.14,91'), null)
  assert.equal(parseLonLat('113.14,31,30000000'), null)
  assert.equal(parseLonLat('https://example.invalid/tileset.json'), null)
  assert.equal(parseLonLat('D:\\data\\city\\tileset.json'), null)
})

test('A1 coordinates：飞行保留当前朝向/俯仰，高度可覆盖', () => {
  const calls = []
  const viewer = {
    camera: {
      positionCartographic: { height: 500 },
      heading: 0.3,
      pitch: -0.6,
      flyTo: (options) => calls.push(options),
    },
  }
  const Cesium = { Cartesian3: { fromDegrees: (lon, lat, height) => ({ lon, lat, height }) } }
  assert.equal(flyToCoordinates(viewer, Cesium, { lon: 113.14, lat: 31.02, height: null }, 1.2), true)
  assert.deepEqual(calls[0].destination, { lon: 113.14, lat: 31.02, height: 500 })
  assert.deepEqual(calls[0].orientation, { heading: 0.3, pitch: -0.6, roll: 0 })
  assert.equal(calls[0].duration, 1.2)

  flyToCoordinates(viewer, Cesium, { lon: 113.148, lat: 31.015, height: 900 })
  assert.deepEqual(calls[1].destination, { lon: 113.148, lat: 31.015, height: 900 })
  assert.equal(flyToCoordinates(null, Cesium, { lon: 0, lat: 0 }), false)
})

test('A1/A2 wiring：地址栏接坐标、分析卡接剖面指标、中英文案齐全', () => {
  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /parseLonLat/)
  assert.match(surface, /flyToCoordinates/)
  const cards = readRepoFile('src/client/ui/cards.js')
  assert.match(cards, /profileMetrics\(result\.points/)
  assert.match(cards, /profileCsv/)
  assert.match(cards, /profileSvg/)
  assert.match(cards, /className: 'profile-tools'/)
  const messages = readRepoFile('src/client/messages.js') + readRepoFile('src/client/messages-v18.js')
  for (const key of ['profile.slopeMean', 'profile.slopeMax', 'profile.cut', 'profile.fill', 'profile.exportCsv']) {
    assert.equal((messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []).length, 2, `缺少中英 ${key}`)
  }
  assert.match(messages, /经纬度/)
  assert.match(messages, /lon,lat/)
})
