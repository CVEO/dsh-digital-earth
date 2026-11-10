/**
 * v1.6 — local GeoJSON import for the vector overlay.
 *
 * The meeting asked for GeoJSON/Shapefile attachments; the panel-side MVP reads a
 * local .geojson via the browser File API, validates/bounds it, then draws it with
 * the SAME overlay renderer as earth_draw (no new tool, no new host route, no
 * third-party parser). These tests drive the pure parser and the wiring.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { collectLonLat, countCoordinates, normalizeVectorGeoJSON, VECTOR_IMPORT_LIMITS } from '../src/client/scene/vector-import.js'
import { hasVectorFile, readVectorFiles } from '../src/client/scene/vector-file.js'
import { readRepoFile } from './helpers/source.mjs'

const collection = (features) => JSON.stringify({ type: 'FeatureCollection', features })

test('解析 FeatureCollection：要素数/几何类型/经纬度范围/坐标数', () => {
  const parsed = normalizeVectorGeoJSON(
    collection([
      { type: 'Feature', properties: { name: 'a' }, geometry: { type: 'Point', coordinates: [3.1, 45.7] } },
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[3.0, 45.6], [3.2, 45.8]] },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[[3.0, 45.6], [3.2, 45.6], [3.2, 45.8], [3.0, 45.6]]] },
      },
    ]),
  )
  assert.equal(parsed.featureCount, 3)
  assert.deepEqual(parsed.geometryTypes.sort(), ['LineString', 'Point', 'Polygon'])
  assert.deepEqual(parsed.bbox, { west: 3.0, south: 45.6, east: 3.2, north: 45.8 })
  assert.equal(parsed.coordinateCount, 1 + 2 + 4)
  assert.equal(parsed.geojson.type, 'FeatureCollection')
})

test('接受裸 Feature / 裸几何 / GeometryCollection，保留属性', () => {
  const feature = normalizeVectorGeoJSON(
    JSON.stringify({ type: 'Feature', properties: { id: 7 }, geometry: { type: 'Point', coordinates: [1, 2] } }),
  )
  assert.equal(feature.featureCount, 1)
  assert.equal(feature.geojson.features[0].properties.id, 7)

  const geometry = normalizeVectorGeoJSON(JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [1, 1]] }))
  assert.equal(geometry.featureCount, 1)

  const nested = normalizeVectorGeoJSON(
    JSON.stringify({
      type: 'GeometryCollection',
      geometries: [
        { type: 'Point', coordinates: [10, 20] },
        { type: 'Point', coordinates: [11, 21] },
      ],
    }),
  )
  assert.deepEqual(nested.bbox, { west: 10, south: 20, east: 11, north: 21 })
})

test('限制与错误：空文件/非 JSON/不支持类型/要素过多/坐标非法/坐标过多', () => {
  assert.throws(() => normalizeVectorGeoJSON(''), /文件为空/)
  assert.throws(() => normalizeVectorGeoJSON('{not json'), /不是合法的 JSON/)
  assert.throws(() => normalizeVectorGeoJSON('[]'), /不是 GeoJSON 对象/)
  assert.throws(() => normalizeVectorGeoJSON(JSON.stringify({ type: 'FeatureCollection', features: [] })), /没有可绘制的要素/)
  assert.throws(
    () => normalizeVectorGeoJSON(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Circle', coordinates: [0, 0] } }] })),
    /不支持的几何类型/,
  )
  const tooMany = Array.from({ length: VECTOR_IMPORT_LIMITS.maxFeatures + 1 }, (_, index) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [index / 1000, 0] },
  }))
  assert.throws(() => normalizeVectorGeoJSON(collection(tooMany)), /要素过多/)
  assert.throws(
    () => normalizeVectorGeoJSON(collection([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ['1', 2] } }])),
    /坐标必须是有限/,
  )
  const denseRing = Array.from({ length: VECTOR_IMPORT_LIMITS.maxCoordinates + 10 }, (_, index) => [index / 1e4, 0])
  assert.throws(
    () => normalizeVectorGeoJSON(collection([{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: denseRing } }])),
    /坐标点过多/,
  )
})

test('坐标工具：countCoordinates 与 collectLonLat 递归展开', () => {
  const geometry = {
    type: 'GeometryCollection',
    geometries: [
      { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      { type: 'Point', coordinates: [2, 2] },
    ],
  }
  assert.deepEqual(countCoordinates(geometry), { count: 3, invalid: false })
  assert.deepEqual(collectLonLat(geometry), [[0, 0], [1, 1], [2, 2]])
  assert.equal(countCoordinates({ type: 'Point', coordinates: [0, 0] }).invalid, false)
  assert.equal(countCoordinates({ type: 'Point', coordinates: [0] }).invalid, true)
})

test('File 入口：readVectorFiles 选 GeoJSON/Shapefile，hasVectorFile 判断扩展名', async () => {
  const geo = { name: 'a.geojson', text: async () => JSON.stringify({ type: 'Point', coordinates: [1, 2] }) }
  const geoResult = await readVectorFiles([geo])
  assert.equal(geoResult.name, 'a.geojson')
  assert.equal(geoResult.parsed.featureCount, 1)

  const dbf = { name: 'roads.dbf', arrayBuffer: async () => new ArrayBuffer(0) }
  const shp = { name: 'roads.shp', arrayBuffer: async () => new ArrayBuffer(0) }
  await assert.rejects(() => readVectorFiles([shp, dbf]), /SHP 文件过短/)
  await assert.rejects(() => readVectorFiles([{ name: 'x.txt' }]), /vector_file_unsupported/)
  assert.equal(hasVectorFile([{ name: 'a.SHP' }]), true)
  assert.equal(hasVectorFile([{ name: 'a.dbf' }]), true)
  assert.equal(hasVectorFile([{ name: 'a.png' }]), false)
})

test('接线：地图 Tab 导入 GeoJSON，画布用现有 overlay 渲染，契约不变', () => {
  const map = readRepoFile('src/client/ui/layers-map.js')
  assert.match(map, /readVectorFiles/)
  assert.match(map, /type: 'file'/)
  assert.match(map, /accept: '\.geojson,\.json,\.shp,\.dbf/)
  assert.match(map, /onImportVector\?\.\(parsed, name\)/)
  assert.match(map, /t\('layers\.importVector'\)/)
  assert.match(map, /t\('layers\.importFailed'/)

  const panel = readRepoFile('src/client/ui/layers-panel.js')
  assert.match(panel, /onImportVector/)

  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /onImportVector:/)
  assert.match(viewer, /drawAgentOverlay\(cesiumRef\.current, viewerRef\.current, parsed\.geojson, 'accent'/)
  assert.match(viewer, /t\('layers\.imported'/)

  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['layers.importVector', 'layers.imported', 'layers.importFailed', 'layers.importNeedFile']) {
    const hits = messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.equal(hits.length, 2, `缺少中英 ${key}`)
  }
})
