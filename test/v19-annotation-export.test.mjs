/**
 * v1.9 — GeoJSON export of the reviewed footprints: 2D file, +Z file, property
 * whitelist/order, missing-height accounting, MultiPolygon splitting and file naming.
 * These pin the on-disk contract other tools read.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const {
  EXPORT_PROPERTY_ORDER,
  buildGeoJsonExport,
  exportMeta,
  missingHeightCount,
  suggestedFilename,
} = await import('../src/client/scene/annotation-export.js')

const SQUARE = [
  [100, 30],
  [100.001, 30],
  [100.001, 30.001],
  [100, 30.001],
  [100, 30],
]

/** One reviewed candidate; `height_m` / `base_m` can be overridden per test. */
function candidate(overrides = {}, coordinates = [SQUARE]) {
  return {
    type: 'Feature',
    properties: {
      id: 'A-01',
      class: '建筑',
      class_key: 'building',
      status: 'accepted',
      method: 'auto',
      source: '3d',
      confidence: 0.82,
      height_m: 12.5,
      height_source: 'dsm',
      floors: 4,
      base_m: 3.2,
      roof_m: 15.7,
      area_m2: 128.4,
      run_id: 'R-1700000000000',
      rev: 2,
      hex: '#ffce65',
      note: '内部字段不导出',
      ...overrides,
    },
    geometry: coordinates.length === 1
      ? { type: 'Polygon', coordinates }
      : { type: 'MultiPolygon', coordinates: coordinates.map((ring) => [ring]) },
  }
}

test('2D 导出输出闭合外环并按固定顺序写属性白名单', () => {
  const { collection, count, missing, skipped, withZ, assumeZero } = buildGeoJsonExport([candidate()])

  assert.equal(collection.type, 'FeatureCollection')
  assert.equal(count, 1)
  assert.equal(missing, 0)
  assert.equal(skipped, 0)
  assert.equal(withZ, false)
  assert.equal(assumeZero, false)

  const [feature] = collection.features
  assert.equal(feature.type, 'Feature')
  assert.equal(feature.geometry.type, 'Polygon')
  assert.deepEqual(feature.geometry.coordinates, [SQUARE])
  for (const position of feature.geometry.coordinates[0]) assert.equal(position.length, 2)

  assert.deepEqual(Object.keys(feature.properties), [...EXPORT_PROPERTY_ORDER])
  assert.equal(feature.properties.id, 'A-01')
  assert.equal(feature.properties.class, '建筑')
  assert.equal(feature.properties.class_key, 'building')
  assert.equal(feature.properties.status, 'accepted')
  assert.equal(feature.properties.confidence, 0.82)
  assert.equal(feature.properties.rev, 2)
  // Whitelist means internal review fields never reach the file.
  assert.equal('hex' in feature.properties, false)
  assert.equal('note' in feature.properties, false)
})

test('空值与非法数值在属性里写成 null', () => {
  const { collection } = buildGeoJsonExport([
    candidate({ height_m: undefined, base_m: NaN, confidence: 'high', rev: null, run_id: 7 }),
  ])
  const props = collection.features[0].properties
  assert.equal(props.height_m, null)
  assert.equal(props.base_m, null)
  assert.equal(props.confidence, null)
  assert.equal(props.rev, null)
  assert.equal(props.run_id, null)
})

test('withZ 用 base_m + height_m 写顶点高度', () => {
  const { collection, count, missing, skipped } = buildGeoJsonExport([candidate()], { withZ: true })

  assert.equal(count, 1)
  assert.equal(missing, 0)
  assert.equal(skipped, 0)
  const vertices = collection.features[0].geometry.coordinates[0]
  assert.deepEqual(vertices, SQUARE.map(([lon, lat]) => [lon, lat, 15.7]))
  assert.equal('estimated_geometry' in collection.features[0].properties, false)
})

test('withZ 缺高度时跳过并计入 missing/skipped；有高度无基准按 0 起算并标估算', () => {
  const { collection, count, missing, skipped } = buildGeoJsonExport([
    candidate({ height_m: null }),
    candidate({ height_m: 0 }),
    candidate({ height_m: 9, base_m: null }),
    candidate({ id: 'A-04', height_m: 6, base_m: 1 }),
  ], { withZ: true })

  assert.equal(count, 2)
  assert.equal(missing, 2)
  assert.equal(skipped, 2)
  assert.equal(collection.features[0].properties.id, 'A-01')
  assert.equal(collection.features[0].properties.estimated_geometry, true)
  assert.deepEqual(collection.features[0].geometry.coordinates[0][0], [100, 30, 9])
  assert.equal(collection.features[1].properties.id, 'A-04')
  assert.deepEqual(collection.features[1].geometry.coordinates[0][0], [100, 30, 7])
})

test('assumeZero 估算缺失高度并标记 estimated_geometry', () => {
  const { collection, count, missing, skipped, assumeZero } = buildGeoJsonExport([
    candidate({ height_m: null, base_m: 3 }),
    candidate({ id: 'A-02', height_m: 8, base_m: null }),
  ], { withZ: true, assumeZero: true })

  assert.equal(assumeZero, true)
  assert.equal(count, 2)
  // Only the feature with no height counts as missing; a height without a base is
  // exported from base 0 and stamped estimated instead.
  assert.equal(missing, 1)
  assert.equal(skipped, 0)

  const [first, second] = collection.features
  assert.equal(first.properties.estimated_geometry, true)
  assert.equal(first.geometry.coordinates[0][0][2], 3)
  assert.equal(second.properties.estimated_geometry, true)
  assert.equal(second.geometry.coordinates[0][0][2], 8)
})

test('assumeZero 下确实有高度的候选不被打上估算标记', () => {
  const { collection, missing } = buildGeoJsonExport([
    candidate({ id: 'A-01', height_m: 10, base_m: 2 }),
    candidate({ id: 'A-02', height_m: null, base_m: 0 }),
  ], { withZ: true, assumeZero: true })

  assert.equal(missing, 1)
  assert.equal('estimated_geometry' in collection.features[0].properties, false)
  assert.equal(collection.features[0].geometry.coordinates[0][0][2], 12)
  assert.equal(collection.features[1].properties.estimated_geometry, true)
  assert.equal(collection.features[1].geometry.coordinates[0][0][2], 0)
})

test('2D 导出不因为 assumeZero 加估算标记', () => {
  const { collection } = buildGeoJsonExport([candidate({ height_m: null })], { assumeZero: true })
  assert.equal('estimated_geometry' in collection.features[0].properties, false)
})

test('MultiPolygon 拆成多个 Feature 并保留属性', () => {
  const second = [
    [101, 31],
    [101.002, 31],
    [101.002, 31.002],
    [101, 31],
  ]
  const { collection, count, skipped } = buildGeoJsonExport([candidate({}, [SQUARE, second])])

  assert.equal(count, 2)
  assert.equal(skipped, 0)
  assert.equal(collection.features.length, 2)
  for (const feature of collection.features) {
    assert.equal(feature.geometry.type, 'Polygon')
    assert.equal(feature.properties.id, 'A-01')
    assert.equal(feature.properties.class, '建筑')
    assert.equal(feature.properties.height_m, 12.5)
  }
  assert.deepEqual(collection.features[1].geometry.coordinates, [second])
})

test('非法 ring 与不支持的几何被跳过并计数', () => {
  const tooFew = candidate({ id: 'A-01' }, [[[100, 30], [100.001, 30]]])
  const notFinite = candidate({ id: 'A-02' }, [[[100, 30], [Number.NaN, 30], [100.001, 30]]])
  const badVertex = candidate({ id: 'A-03' }, [[[100, 30], [100.001], [100.001, 30.001]]])
  const point = { type: 'Feature', properties: { id: 'A-04' }, geometry: { type: 'Point', coordinates: [100, 30] } }
  const noGeometry = { type: 'Feature', properties: { id: 'A-05' } }

  const { collection, count, skipped } = buildGeoJsonExport([tooFew, notFinite, badVertex, point, noGeometry])
  assert.equal(count, 0)
  assert.equal(skipped, 5)
  assert.deepEqual(collection.features, [])
})

test('未闭合的环在导出时补上首点，坐标按 round 取整', () => {
  const open = [
    [100.123456789, 30.987654321],
    [100.1234, 30.99],
    [100.1239, 30.995],
  ]
  const { collection } = buildGeoJsonExport([
    { type: 'Feature', properties: { id: 'A-01' }, geometry: { type: 'Polygon', coordinates: [open] } },
  ], { round: 3 })

  const ring = collection.features[0].geometry.coordinates[0]
  assert.equal(ring.length, 4)
  assert.deepEqual(ring[0], [100.123, 30.988])
  assert.deepEqual(ring[3], ring[0])
})

test('heightRound 控制高出精度', () => {
  const { collection } = buildGeoJsonExport([
    candidate({ base_m: 1.23456, height_m: 2.34567 }),
  ], { withZ: true, heightRound: 1 })
  assert.equal(collection.features[0].geometry.coordinates[0][0][2], 3.6)
})

test('missingHeightCount 统计没有有效高度的候选', () => {
  assert.equal(missingHeightCount([
    candidate({ height_m: 12.5 }),
    candidate({ height_m: 0 }),
    candidate({ height_m: null }),
    candidate({ height_m: undefined }),
    candidate({ height_m: Number.NaN }),
    candidate({ height_m: -3 }),
    { type: 'Feature' },
  ]), 6)
  assert.equal(missingHeightCount([]), 0)
  assert.equal(missingHeightCount(null), 0)
})

test('suggestedFilename 使用 YYYYMMDD 与 +Z 后缀', () => {
  const date = new Date(2026, 2, 8, 10, 30, 0)
  assert.equal(suggestedFilename({ date }), 'extract-20260308.geojson')
  assert.equal(suggestedFilename({ format: 'geojson', date }), 'extract-20260308.geojson')
  assert.equal(suggestedFilename({ format: 'geojson-z', date }), 'extract-20260308-z.geojson')
  assert.match(suggestedFilename({ date: new Date('nope') }), /^extract-\d{8}\.geojson$/)
  assert.equal(suggestedFilename(), suggestedFilename({}))
})

test('exportMeta 给出总数与状态分组', () => {
  const meta = exportMeta([
    candidate({ status: 'accepted' }),
    candidate({ status: 'accepted' }),
    candidate({ status: 'pending' }),
  ])
  assert.deepEqual(meta, { total: 3, byStatus: { pending: 1, accepted: 2, rejected: 0 } })
  assert.deepEqual(exportMeta([]), { total: 0, byStatus: { pending: 0, accepted: 0, rejected: 0 } })
})

test('buildGeoJsonExport 不修改输入候选', () => {
  const input = candidate()
  const before = JSON.stringify(input)
  buildGeoJsonExport([input], { withZ: true })
  buildGeoJsonExport([input], { withZ: true, assumeZero: true })
  assert.equal(JSON.stringify(input), before)
})

test('导出末尾追加 outline_source/outline_quality/refine_state，旧字段顺序与取值不变', () => {
  const legacy = buildGeoJsonExport([candidate()]).collection.features[0].properties
  assert.deepEqual(Object.keys(legacy), [...EXPORT_PROPERTY_ORDER])
  assert.deepEqual(EXPORT_PROPERTY_ORDER.slice(-3), ['outline_source', 'outline_quality', 'refine_state'])
  // 旧字段（id…rev）位置不动，新字段只追加在末尾。
  assert.equal(EXPORT_PROPERTY_ORDER[0], 'id')
  assert.equal(EXPORT_PROPERTY_ORDER[EXPORT_PROPERTY_ORDER.length - 4], 'rev')
  assert.equal(legacy.id, 'A-01')
  assert.equal(legacy.height_m, 12.5)
  assert.equal(legacy.rev, 2)

  const refined = buildGeoJsonExport([
    candidate({ outline_source: 'refined', outline_quality: 'ok', refine_state: 'refined' }),
  ], { withZ: true }).collection.features[0]
  assert.deepEqual(Object.keys(refined.properties), [...EXPORT_PROPERTY_ORDER])
  assert.equal(refined.properties.outline_source, 'refined')
  assert.equal(refined.properties.outline_quality, 'ok')
  assert.equal(refined.properties.refine_state, 'refined')
  // 新字段不影响 base + height 的 withZ 口径。
  assert.deepEqual(refined.geometry.coordinates[0], SQUARE.map(([lon, lat]) => [lon, lat, 15.7]))
  assert.equal(refined.properties.class, '建筑')
  assert.equal(refined.properties.area_m2, 128.4)
})

test('缺失或非字符串的精修字段导出为 null，旧字段仍按原规则导出', () => {
  const missing = buildGeoJsonExport([candidate()]).collection.features[0].properties
  assert.equal(missing.outline_source, null)
  assert.equal(missing.outline_quality, null)
  assert.equal(missing.refine_state, null)

  const invalid = buildGeoJsonExport([
    candidate({ outline_source: 42, outline_quality: { level: 1 }, refine_state: null }),
  ]).collection.features[0].properties
  assert.equal(invalid.outline_source, null)
  assert.equal(invalid.outline_quality, null)
  assert.equal(invalid.refine_state, null)
  assert.equal(invalid.id, 'A-01')
  assert.equal(invalid.confidence, 0.82)
  assert.equal(invalid.height_m, 12.5)
})
