/**
 * v1.9 — GeoJSON export of the reviewed footprints: a strictly 2D file, its
 * property whitelist/order, MultiPolygon splitting and file naming.
 * These pin the on-disk contract other tools read.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const {
  EXPORT_PROPERTY_ORDER,
  buildGeoJsonExport,
  exportMeta,
  suggestedFilename,
} = await import('../src/client/scene/annotation-export.js')

const SQUARE = [
  [100, 30],
  [100.001, 30],
  [100.001, 30.001],
  [100, 30.001],
  [100, 30],
]

/** One reviewed candidate; overrides let a test inject bad values. */
function candidate(overrides = {}, coordinates = [SQUARE]) {
  return {
    type: 'Feature',
    properties: {
      id: 'A-01',
      class: '建筑',
      class_key: 'building',
      class_name: '建筑',
      color: '#f59e0b',
      status: 'accepted',
      method: 'auto',
      source: 'ortho',
      source_kind: 'panel',
      shape: 'polygon',
      confidence: 0.82,
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

test('导出输出闭合外环并按固定顺序写二维属性白名单', () => {
  const { collection, count, skipped } = buildGeoJsonExport([candidate()])

  assert.equal(collection.type, 'FeatureCollection')
  assert.equal(count, 1)
  assert.equal(skipped, 0)

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
  assert.equal(feature.properties.area_m2, 128.4)
  assert.equal(feature.properties.rev, 2)
  // Whitelist means internal review fields never reach the file.
  assert.equal('hex' in feature.properties, false)
  assert.equal('note' in feature.properties, false)
})

test('属性契约不含任何三维或精修字段', () => {
  const banned = ['height_m', 'height_source', 'floors', 'base_m', 'roof_m', 'outline_source', 'outline_quality', 'refine_state', 'estimated_geometry']
  for (const key of banned) assert.equal(EXPORT_PROPERTY_ORDER.includes(key), false, `${key} 不应在二维导出契约里`)
  const props = buildGeoJsonExport([
    candidate({ height_m: 12.5, base_m: 3.2, roof_m: 15.7, floors: 4, outline_source: 'refined' }),
  ]).collection.features[0].properties
  for (const key of banned) assert.equal(key in props, false, `${key} 不应写进文件`)
})

test('空值与非法数值在属性里写成 null', () => {
  const { collection } = buildGeoJsonExport([
    candidate({ area_m2: NaN, confidence: 'high', rev: null, run_id: 7, clippedAtTileEdge: false }),
  ])
  const props = collection.features[0].properties
  assert.equal(props.area_m2, null)
  assert.equal(props.confidence, null)
  assert.equal(props.rev, null)
  assert.equal(props.run_id, null)
  assert.equal(props.clippedAtTileEdge, null)
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
    assert.equal(feature.properties.area_m2, 128.4)
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

test('suggestedFilename 使用 YYYYMMDD', () => {
  const date = new Date(2026, 2, 8, 10, 30, 0)
  assert.equal(suggestedFilename({ date }), 'extract-20260308.geojson')
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
  buildGeoJsonExport([input])
  assert.equal(JSON.stringify(input), before)
})
