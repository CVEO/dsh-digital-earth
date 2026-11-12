/**
 * v1.7 P0 — selection ("指认") maths, the card, and the evidence pack.
 *
 * The card must never fabricate a building identity: the user's photogrammetry
 * tileset has no batch table, so the data can only support a tile/region hit plus
 * a geometric height estimate. These tests pin the provenance tiers, the
 * unknown/limitation codes and the exported JSON shape.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  EVIDENCE_SCHEMA_VERSION,
  SELECTION_DIRECTIONS,
  SELECTION_RADII_M,
  buildEvidencePack,
  buildSelectionCard,
  medianOf,
  normalizeIdentity,
  offsetCartographic,
  round1,
  selectionOffsets,
  summarizeHeights,
} from '../src/client/scene/selection.js'
import { postEvidence } from '../src/client/scene/evidence-export.js'
import * as Cesium from '../vendor/cesium/index.js'
import { createSelectionController } from '../src/client/scene/selection-controller.js'
import { clientSource, readRepoFile } from './helpers/source.mjs'

const adjacent = (a, b, epsilon = 1e-9) => Math.abs(a - b) <= epsilon

test('指认坐标与证据保留经纬度精度，低于 100 m 的模型表面不会归零', async () => {
  const lon = 113.13861234
  const lat = 31.02085678
  const anchor = Cesium.Cartesian3.fromDegrees(lon, lat, 87.6)
  let reads = 0
  const viewer = { scene: { pickPositionSupported: true, pickPosition() { reads++; return anchor }, pick: () => null,
    globe: { terrainProvider: new Cesium.EllipsoidTerrainProvider() } } }
  const controller = createSelectionController({ getViewer: () => viewer, getCesium: () => Cesium, getLayers: () => [] })
  const result = await controller.identifyAt(new Cesium.Cartesian2(200, 200))
  assert.equal(reads, 1)
  assert.ok(adjacent(result.card.point.lon, lon))
  assert.ok(adjacent(result.card.point.lat, lat))
  assert.equal(result.card.point.surface_height_m, 87.6)
  assert.equal(result.anchor, anchor)
  const pack = buildEvidencePack({ card: result.card, view: {lon, lat, height: 200} })
  assert.ok(adjacent(pack.point.lon, lon))
  assert.ok(adjacent(pack.view.lat, lat))
  assert.equal(buildSelectionCard({ point: { lon, lat, surface_height_m: null } }).point.surface_height_m, null)
})

test('offsetCartographic：正北抬升纬度、正东抬升经度，高纬经度补偿、非法输入返回 null', () => {
  const north = offsetCartographic(114.3, 30.5, 0, 30)
  assert.equal(north.lon, 114.3)
  assert.ok(north.lat > 30.5)
  assert.ok(adjacent(north.lat - 30.5, 30 / 110540, 1e-9))

  const east = offsetCartographic(114.3, 30.5, 90, 30)
  assert.equal(east.lat, 30.5)
  assert.ok(east.lon > 114.3)
  // A degree of longitude is shorter away from the equator.
  assert.ok(east.lon - 114.3 > 30 / 111320)

  // Latitude is clamped before the pole, longitude wraps into [-180, 180].
  const polar = offsetCartographic(179.999, 89.99, 0, 500000)
  assert.ok(polar.lat <= 89)
  assert.ok(polar.lon >= -180 && polar.lon <= 180)

  assert.equal(offsetCartographic(0, 0, 0, 0), null)
  assert.equal(offsetCartographic(Number.NaN, 0, 0, 10), null)
  assert.equal(offsetCartographic(0, 0, Number.NaN, 10), null)
})

test('selectionOffsets：8 方向 × 3 半径 = 24 个采样点，环半径与方位齐全', () => {
  const offsets = selectionOffsets({ lon: 114.3, lat: 30.5 })
  assert.equal(offsets.length, SELECTION_DIRECTIONS * SELECTION_RADII_M.length)
  assert.deepEqual([...new Set(offsets.map((item) => item.distance_m))], SELECTION_RADII_M)
  const bearings = offsets.filter((item) => item.distance_m === 30).map((item) => item.bearing_deg)
  assert.deepEqual(bearings, [0, 45, 90, 135, 180, 225, 270, 315])
  assert.equal(selectionOffsets({ lon: 'x', lat: 0 }).length, 0)
  assert.equal(selectionOffsets({ lon: 0, lat: 0 }, { radii: [], directions: 8 }).length, 0)
})

test('summarizeHeights / medianOf：忽略空值，返回样本数、最低/最高/中位数与跨度', () => {
  assert.deepEqual(summarizeHeights([]), { count: 0, min: null, max: null, median: null, spread: null })
  assert.deepEqual(summarizeHeights([null, undefined, 'x']), { count: 0, min: null, max: null, median: null, spread: null })
  const summary = summarizeHeights([42, 5, 9, null, 6])
  assert.equal(summary.count, 4)
  assert.equal(summary.min, 5)
  assert.equal(summary.max, 42)
  assert.equal(summary.median, 7.5)
  assert.equal(summary.spread, 37)
  assert.equal(medianOf([3, 1, 2]), 2)
  assert.equal(medianOf([]), null)
  assert.equal(round1(1.24), 1.2)
  assert.equal(round1(Number.NaN), null)
})

test('normalizeIdentity：优先取名称属性，缺失时标 geometry_only 而不是编造', () => {
  const named = normalizeIdentity({
    kind: 'tile_feature',
    properties: [
      { name: 'height', value: 42 },
      { name: 'name', value: '  教学楼 A  ' },
    ],
  })
  assert.equal(named.name, '教学楼 A')
  assert.equal(named.basis, 'layer_metadata')
  assert.equal(named.properties[0].value, '42')

  const entity = normalizeIdentity({ kind: 'entity', name: '测量点 1' })
  assert.equal(entity.basis, 'entity_name')

  const unnamed = normalizeIdentity({ kind: 'tileset', properties: [] })
  assert.equal(unnamed.name, null)
  assert.equal(unnamed.basis, 'geometry_only')

  const many = normalizeIdentity({
    kind: 'tile_feature',
    properties: Array.from({ length: 40 }, (_, index) => ({ name: `p${index}`, value: index })),
  })
  assert.equal(many.properties.length, 24)
})

test('buildSelectionCard：高度只作为几何估计，带样本数/地面/跨度，缺样本时降级为推断', () => {
  const samples = selectionOffsets({ lon: 114.3, lat: 30.5 }).map((offset, index) => ({
    ...offset,
    height_m: index === 0 ? 5 : index < 8 ? 12 : 30,
    source: 'tiles',
  }))
  const card = buildSelectionCard({
    point: { lon: 114.3, lat: 30.5, surface_height_m: 42.1 },
    layer: { id: 'layer-1', name: 'tileset.json', source: { kind: 'local', path: 'D:\\data' } },
    identity: { kind: 'tile_feature', name: null, properties: [] },
    samples,
    createdAt: '2026-11-07T00:00:00.000Z',
    id: 'sel-test',
  })
  assert.equal(card.schemaVersion, EVIDENCE_SCHEMA_VERSION)
  assert.equal(card.id, 'sel-test')
  assert.equal(card.point.surface_height_m, 42.1)
  assert.equal(card.sampling.count, 24)
  assert.equal(card.sampling.min, 5)
  const object = card.facts.find((fact) => fact.key === 'object_height')
  assert.equal(object.value, 37.1)
  assert.equal(object.basis, 'estimated')
  assert.equal(object.method, 'neighbor_ring')
  assert.equal(object.sample_count, 24)
  assert.equal(object.ground_m, 5)
  const surface = card.facts.find((fact) => fact.key === 'surface_height')
  assert.equal(surface.basis, 'measured')
  const aboveMedian = card.facts.find((fact) => fact.key === 'above_median')
  assert.ok(aboveMedian.value > 0)
  assert.equal(card.confidence, 'estimated')
  // No batch table → explicit unknowns, no invented name.
  assert.equal(card.identity.name, null)
  assert.deepEqual(card.unknowns, ['name', 'use', 'ownership', 'footprint'])
  assert.ok(card.limitations.includes('no_building_identity'))
  assert.ok(card.limitations.includes('neighbour_sampled_height'))
  // The whole card must be JSON-safe (no Cesium objects / NaN).
  assert.equal(JSON.parse(JSON.stringify(card)).point.surface_height_m, 42.1)
})

test('buildSelectionCard：无可用周边样本时不填 0，而是 null + 明确限制', () => {
  const card = buildSelectionCard({
    point: { lon: 114.3, lat: 30.5, surface_height_m: 42.1 },
    layer: null,
    identity: { kind: 'tileset', properties: [] },
    samples: [{ distance_m: 30, bearing_deg: 0, height_m: null, source: 'none' }],
  })
  const object = card.facts.find((fact) => fact.key === 'object_height')
  assert.equal(object.value, null)
  assert.equal(object.basis, 'inferred')
  assert.equal(card.confidence, 'inferred')
  assert.ok(card.limitations.includes('tile_feature_only'))
  assert.ok(card.limitations.includes('too_few_height_samples'))
  assert.ok(card.limitations.includes('layer_source_unknown'))
})

test('buildEvidencePack：sidecar 带 schema/版本/视角/来源/未知，且每个数字都有依据', () => {
  const card = buildSelectionCard({
    point: { lon: 114.3, lat: 30.5, surface_height_m: 42 },
    layer: { id: 'l1', name: 'tileset.json' },
    identity: { kind: 'tileset', properties: [] },
    samples: [
      { distance_m: 30, bearing_deg: 0, height_m: 5, source: 'tiles' },
      { distance_m: 30, bearing_deg: 90, height_m: 6, source: 'tiles' },
      { distance_m: 30, bearing_deg: 180, height_m: 4, source: 'tiles' },
      { distance_m: 30, bearing_deg: 270, height_m: 7, source: 'tiles' },
    ],
  })
  const pack = buildEvidencePack({
    card,
    view: { lon: 114.3, lat: 30.5, height: 800, heading: 15, pitch: -40 },
    pluginVersion: '1.5.0',
    capturedAt: '2026-11-07T00:00:00.000Z',
    image: { format: 'png', width: 1280, height: 720 },
  })
  assert.equal(pack.kind, 'digital-earth-evidence')
  assert.equal(pack.schemaVersion, EVIDENCE_SCHEMA_VERSION)
  assert.equal(pack.pluginVersion, '1.5.0')
  assert.equal(pack.earth.datum, 'WGS84')
  assert.equal(pack.earth.height_reference, 'ellipsoid')
  assert.deepEqual(pack.view, { lon: 114.3, lat: 30.5, height: 800, heading: 15, pitch: -40 })
  assert.deepEqual(pack.image, { format: 'png', width: 1280, height: 720 })
  for (const fact of pack.facts) assert.ok(['measured', 'estimated', 'inferred'].includes(fact.basis), fact.key)
  assert.ok(Array.isArray(pack.unknowns) && pack.unknowns.length > 0)
  // The Agent must never learn about this page-only payload from a tool result.
  assert.match(readRepoFile('src/host/tools/scene.js'), /pick: identify whatever is at the center of the view/)
})

test('postEvidence：POST 到 meta.exportUrl，body 为 evidence + card + PNG', async () => {
  const calls = []
  const card = { id: 'sel-1', point: { lon: 114.3, lat: 30.5, surface_height_m: 40 }, facts: [], unknowns: [], limitations: [], sampling: null, confidence: 'estimated' }
  const saved = await postEvidence({
    card,
    view: { lon: 114.3, lat: 30.5, height: 800, heading: 0, pitch: -35 },
    pluginVersion: '1.5.0',
    exportUrl: '/api/3dviewer/export/token',
    snapshot: { dataUrl: 'data:image/png;base64,AAAA', format: 'png', width: 1280, height: 720 },
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return { ok: true, json: async () => ({ path: 'C:\\exports\\x.json', image_path: 'C:\\exports\\x.png', bytes: 10 }) }
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/3dviewer/export/token')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.credentials, 'same-origin')
  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.kind, 'evidence')
  assert.equal(body.card.schemaVersion, EVIDENCE_SCHEMA_VERSION)
  assert.equal(body.card.pluginVersion, '1.5.0')
  assert.equal(body.card.id, 'sel-1')
  assert.equal(body.image, 'data:image/png;base64,AAAA')
  assert.equal(saved.path, 'C:\\exports\\x.json')

  // No route from /meta means a clear failure, not a silent no-op.
  await assert.rejects(() => postEvidence({ card, exportUrl: null }), /export_unavailable/)
  // The controller is the only caller; the tool catalog never sees this route.
  assert.match(readRepoFile('src/client/scene/selection-controller.js'), /postEvidence\(\{/)
})

test('接线：指认模式走既有 canvas 点击循环，卡片不进入任何工具契约', () => {
  const client = clientSource()
  assert.match(client, /if \(mode === 'identify' \|\| mode === 'pick'\)/)
  assert.match(client, /onIdentify: \(position\) => selectionApiRef\.current\?\.\(position\)/)
  assert.match(client, /className: 'mv-sel-anchor'/)
  // The title must follow the hit level: a whole-tile pick is not a "feature".
  assert.match(client, /selection\.unnamed\.tileset/)
  assert.match(client, /TITLE_KEY\[card\.identity\?\.kind\]/)
  assert.match(client, /t\('selection\.takeAway'\)/)
  // Identify is the default pointer behavior; a dedicated toolbar toggle is gone.
  assert.match(client, /const \[tool, setTool\] = React\.useState\('identify'\)/)
  assert.doesNotMatch(client, /iconButton\(h\(IdentifyIcon\)/)
  // Zero tool-contract change: no identify/select/evidence action appears in the
  // host tool catalog.
  const sceneTool = readRepoFile('src/host/tools/scene.js')
  assert.doesNotMatch(sceneTool, /identify:|select:|evidence:/)
  const registry = readRepoFile('src/host/tools/registry.js')
  assert.doesNotMatch(registry, /earth_identify|earth_select|earth_extract/)
})

test('默认指认：单击场景对象直接出卡，卡片显示批量表属性，天空误点静默', () => {
  const overlay = readRepoFile('src/client/ui/selection-overlay.js')
  assert.match(overlay, /card\?\.identity\?\.properties/)
  assert.match(overlay, /t\('selection\.properties'\)/)
  assert.match(overlay, /className: 'props'/)
  // A sky miss is a normal miss: no error card while identify is the default mode.
  assert.match(overlay, /reason === 'no_surface'/)
  assert.match(overlay, /setErrorLine\(''\)/)

  const pointer = readRepoFile('src/client/scene/pointer-tools.js')
  // Vector overlays win over the default identify click.
  assert.match(pointer, /mode === 'pick' \|\| mode === 'identify'/)
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  // Leaving a tool falls back to identify instead of a dead canvas.
  assert.match(viewer, /const next = mode \?\? 'identify'/)
  const status = readRepoFile('src/client/scene/status.js')
  assert.match(status, /measureTool: toolRef\.current === 'identify' \? null : toolRef\.current/)
})
