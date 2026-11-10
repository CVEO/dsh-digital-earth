/**
 * v1.6 S2-P0 — the height service.
 *
 * One elevation sampler for every analysis, with an explicit source:
 *   - `surface` (default) prefers the visible 3D Tiles `getHeight` (roofs/foliage)
 *     and falls back to terrain;
 *   - `ground` NEVER reads the 3D Tiles surface — a flood analysis must not treat
 *     roofs as bare ground;
 * every run reports its dominant source and warnings so the tool result can say
 * "this is a surface profile, not a ground profile" instead of hiding it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createHeightService, DEFAULT_SAMPLE_BUDGET, HEIGHT_SOURCES } from '../src/client/analysis/height-service.js'
import { clientSource } from './helpers/source.mjs'

/** Minimal Cesium fake: only what the service touches. */
class EllipsoidTerrainProvider {}
const Cesium = { EllipsoidTerrainProvider }

function fakeViewer({ terrainHeight = null, realTerrain = true } = {}) {
  return {
    scene: {
      globe: {
        terrainProvider: realTerrain ? { name: 'arcgis' } : new EllipsoidTerrainProvider(),
        getHeight: () => (terrainHeight === null ? undefined : terrainHeight),
      },
    },
  }
}

function tilesLayer(height, { visible = true, thenable = false } = {}) {
  return {
    visible,
    tileset: {
      getHeight: () => (thenable ? Promise.resolve(height) : height),
    },
  }
}

const carto = (lon = 114.3, lat = 30.5) => ({ longitude: lon, latitude: lat })

test('height service：source 枚举固定', () => {
  assert.deepEqual([...HEIGHT_SOURCES], ['tiles', 'terrain', 'none'])
  assert.equal(DEFAULT_SAMPLE_BUDGET >= 576, true, '默认预算必须覆盖 24×24 的淹没网格')
})

test('tiles 模式：只读 3D Tiles（含 Promise），无 tiles 时返回 null，不回退地形', async () => {
  const tilesFirst = createHeightService({ Cesium, viewer: fakeViewer({ terrainHeight: 20 }), layer: tilesLayer(55) })
  assert.deepEqual(await tilesFirst.sample(carto()), { height: 55, source: 'tiles' })
  assert.equal(tilesFirst.hasRealTerrain(), true)

  const asyncTiles = createHeightService({ Cesium, viewer: fakeViewer({ terrainHeight: 20 }), layer: tilesLayer(60, { thenable: true }) })
  assert.deepEqual(await asyncTiles.sample(carto(1, 2)), { height: 60, source: 'tiles' })

  // v1.5.2: a tiles run must never silently borrow a terrain height.
  const terrainOnly = createHeightService({ Cesium, viewer: fakeViewer({ terrainHeight: 20 }), layer: null })
  assert.equal(await terrainOnly.sample(carto(3, 4)), null)
  assert.ok(terrainOnly.report().warnings.includes('tiles_height_unavailable'))

  const nothing = createHeightService({ Cesium, viewer: fakeViewer({ realTerrain: false }), layer: null })
  assert.equal(await nothing.sample(carto(5, 6)), null)
  assert.equal(nothing.hasRealTerrain(), false)
})

test('tiles 模式：隐藏图层与非 3D Tiles 图层不参与采样，也不回退地形', async () => {
  const hidden = createHeightService({ Cesium, viewer: fakeViewer({ terrainHeight: 12 }), layer: tilesLayer(99, { visible: false }) })
  assert.equal(await hidden.sample(carto()), null)

  const noHeightApi = createHeightService({ Cesium, viewer: fakeViewer({ terrainHeight: 12 }), layer: { visible: true, tileset: {} } })
  assert.equal(await noHeightApi.sample(carto()), null)
})

test('terrain 模式：只用地形，即使有 3D Tiles 也不读屋顶；无地形时明确告警', async () => {
  const withTiles = createHeightService({ Cesium, viewer: fakeViewer({ terrainHeight: 8 }), layer: tilesLayer(120) })
  assert.deepEqual(await withTiles.sample(carto(), { mode: 'terrain' }), { height: 8, source: 'terrain' })

  const noTerrain = createHeightService({ Cesium, viewer: fakeViewer({ realTerrain: false }), layer: tilesLayer(120) })
  assert.equal(await noTerrain.sample(carto(7, 8), { mode: 'terrain' }), null)
  assert.deepEqual(noTerrain.report().warnings, ['terrain_height_unavailable'])
})

test('sampleMany：按预算截断、返回顺序与输入一致、聚合来源与告警', async () => {
  const service = createHeightService({ Cesium, viewer: fakeViewer({ terrainHeight: 30 }), layer: tilesLayer(70) })
  const probes = Array.from({ length: 5 }, (_, index) => carto(100 + index, 30))
  const sampled = await service.sampleMany(probes, { budget: 3 })
  assert.equal(sampled.values.length, 3)
  assert.deepEqual(sampled.values.map((item) => item.source), ['tiles', 'tiles', 'tiles'])
  assert.equal(sampled.height_source, 'tiles')
  assert.deepEqual(sampled.height_sources, { tiles: 3, terrain: 0, none: 0 })
  assert.ok(sampled.warnings.includes('surface_height_from_tiles'))
  assert.ok(sampled.warnings.includes('sample_budget_truncated'))
})

test('sampleMany：重复坐标命中缓存，只采样一次', async () => {
  let calls = 0
  const layer = { visible: true, tileset: { getHeight: () => { calls += 1; return 42 } } }
  const service = createHeightService({ Cesium, viewer: fakeViewer({ terrainHeight: 10 }), layer })
  const probe = carto(120, 31)
  await service.sampleMany([probe, { ...probe }, { ...probe }])
  assert.equal(calls, 1, '相同位置的探针必须走缓存')
})

test('report：没有数据时 source=none', () => {
  const service = createHeightService({ Cesium, viewer: fakeViewer({ realTerrain: false }), layer: null })
  assert.deepEqual(service.report(), { height_source: 'none', height_sources: { tiles: 0, terrain: 0, none: 0 }, warnings: [] })
})

// ---------------------------------------------------------------------------
// Wiring: the analyzers consume the service and expose provenance
// ---------------------------------------------------------------------------

test('接线：profile/flood 走 HeightService，结果带 height_source/warnings（profiles 旧字段不变）', () => {
  const client = clientSource()
  assert.match(client, /const sampler = createHeightService\(\{ Cesium, viewer, layer \}\)/)
  assert.match(client, /analyzeProfile\(Cesium, viewer, layer, args, sampler\)/)
  assert.match(client, /analyzeFlood\(Cesium, viewer, layer, args, sampler\)/)
  assert.match(client, /const probe = carto \? await sampler\.sample\(carto, \{ mode: heightMode \}\) : null/)
  // 旧结果字段仍在，provenance 是加法。
  for (const field of ['operation: ', 'length_m: ', 'points,', 'stats,']) assert.ok(client.includes(field), `profile 旧字段丢失：${field}`)
  assert.match(client, /\.\.\.sampler\.report\(\)/)
  assert.match(client, /height_mode: heightMode/)
})

test('接线：分析文本把来源与告警讲给模型听', async () => {
  const { hostSource } = await import('./helpers/source.mjs')
  const host = hostSource()
  assert.match(host, /Height source: \$\{value\.height_source\}/)
  assert.match(host, /Warnings: \$\{warnings\.join/)
})
