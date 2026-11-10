/**
 * v1.6 — ESRI Shapefile local import.
 *
 * No third-party parser: these fixtures build tiny binary .shp/.dbf buffers in the
 * test, then the same client parser used by the panel turns them into the
 * FeatureCollection the overlay renderer already understands.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseDbf, parseShapefile } from '../src/client/scene/shapefile-import.js'

function shpFile(shapeType, contents) {
  const total = 100 + contents.reduce((sum, content) => sum + 8 + content.byteLength, 0)
  const buffer = new ArrayBuffer(total)
  const view = new DataView(buffer)
  view.setInt32(0, 9994, false)
  view.setInt32(24, total / 2, false)
  view.setInt32(28, 1000, true)
  view.setInt32(32, shapeType, true)
  let offset = 100
  contents.forEach((content, index) => {
    view.setInt32(offset, index + 1, false)
    view.setInt32(offset + 4, content.byteLength / 2, false)
    new Uint8Array(buffer, offset + 8, content.byteLength).set(content)
    offset += 8 + content.byteLength
  })
  return buffer
}

function bboxBuffer(minX, minY, maxX, maxY) {
  const view = new DataView(new ArrayBuffer(32))
  view.setFloat64(0, minX, true)
  view.setFloat64(8, minY, true)
  view.setFloat64(16, maxX, true)
  view.setFloat64(24, maxY, true)
  return new Uint8Array(view.buffer)
}

function pointContent(x, y) {
  const view = new DataView(new ArrayBuffer(20))
  view.setInt32(0, 1, true)
  view.setFloat64(4, x, true)
  view.setFloat64(12, y, true)
  return new Uint8Array(view.buffer)
}

function partsContent(shapeType, parts, points) {
  const buffer = new ArrayBuffer(4 + 32 + 8 + parts.length * 4 + points.length * 16)
  const view = new DataView(buffer)
  view.setInt32(0, shapeType, true)
  let at = 4
  for (const value of [points[0][0], points[0][1], points[0][0], points[0][1]]) {
    // bbox is informational for this parser; a simple placeholder is fine.
    view.setFloat64(at, value, true)
    at += 8
  }
  view.setInt32(at, parts.length, true)
  view.setInt32(at + 4, points.length, true)
  at += 8
  for (const start of parts) {
    view.setInt32(at, start, true)
    at += 4
  }
  for (const point of points) {
    view.setFloat64(at, point[0], true)
    view.setFloat64(at + 8, point[1], true)
    at += 16
  }
  return new Uint8Array(buffer)
}

function polylineContent(parts, points) {
  return partsContent(3, parts, points)
}

function polygonContent(parts, points) {
  return partsContent(5, parts, points)
}

function multiPointContent(points) {
  const buffer = new ArrayBuffer(4 + 32 + 4 + points.length * 16)
  const view = new DataView(buffer)
  view.setInt32(0, 8, true)
  let at = 36
  view.setInt32(at, points.length, true)
  at += 4
  for (const point of points) {
    view.setFloat64(at, point[0], true)
    view.setFloat64(at + 8, point[1], true)
    at += 16
  }
  return new Uint8Array(buffer)
}

function dbfFile(rows, fields = [{ name: 'NAME', type: 'C', length: 10 }]) {
  const headerLength = 32 + fields.length * 32 + 1
  const recordLength = 1 + fields.reduce((sum, field) => sum + field.length, 0)
  const total = headerLength + rows.length * recordLength + 1
  const buffer = new ArrayBuffer(total)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  view.setUint8(0, 0x03)
  view.setUint32(4, rows.length, true)
  view.setUint16(8, headerLength, true)
  view.setUint16(10, recordLength, true)
  fields.forEach((field, index) => {
    const at = 32 + index * 32
    for (let i = 0; i < field.name.length && i < 10; i += 1) bytes[at + i] = field.name.charCodeAt(i)
    bytes[at + 11] = field.type.charCodeAt(0)
    bytes[at + 16] = field.length
  })
  bytes[headerLength - 1] = 0x0d
  rows.forEach((row, rowIndex) => {
    let at = headerLength + rowIndex * recordLength
    bytes[at] = 0x20
    at += 1
    fields.forEach((field) => {
      const value = String(row[field.name] ?? '').slice(0, field.length).padEnd(field.length, ' ')
      for (let i = 0; i < field.length; i += 1) bytes[at + i] = value.charCodeAt(i)
      at += field.length
    })
  })
  bytes[total - 1] = 0x1a
  return buffer
}

test('点 + DBF：坐标、bbox、属性与名称回退', () => {
  const shp = shpFile(1, [pointContent(3.17, 45.79)])
  const dbf = dbfFile([{ NAME: 'BuildingA' }])
  const parsed = parseShapefile(shp, dbf)
  assert.equal(parsed.featureCount, 1)
  assert.deepEqual(parsed.geometryTypes, ['Point'])
  assert.deepEqual(parsed.geojson.features[0].geometry, { type: 'Point', coordinates: [3.17, 45.79] })
  assert.equal(parsed.geojson.features[0].properties.NAME, 'BuildingA')
  assert.equal(parsed.geojson.features[0].properties.name, 'BuildingA')
  assert.deepEqual(parsed.bbox, { west: 3.17, south: 45.79, east: 3.17, north: 45.79 })
  assert.deepEqual(parsed.warnings, ['vector.warning.assumedWgs84'])
})

test('折线/多边形/多点：parts 拆分与环方向', () => {
  const line = parseShapefile(
    shpFile(3, [polylineContent([0, 2], [[3.0, 45.6], [3.2, 45.8], [3.3, 45.9], [3.4, 46.0]])]),
  )
  assert.equal(line.geojson.features[0].geometry.type, 'MultiLineString')
  assert.equal(line.geojson.features[0].geometry.coordinates.length, 2)

  // Clockwise outer ring (Shapefile convention) around Clermont.
  const ring = [[3.0, 45.6], [3.0, 45.8], [3.2, 45.8], [3.2, 45.6], [3.0, 45.6]]
  const polygon = parseShapefile(shpFile(5, [polygonContent([0], ring)]))
  assert.equal(polygon.geojson.features[0].geometry.type, 'Polygon')
  assert.equal(polygon.geojson.features[0].geometry.coordinates[0].length, 5)

  const multi = parseShapefile(shpFile(8, [multiPointContent([[1, 2], [3, 4]])]))
  assert.equal(multi.geojson.features[0].geometry.type, 'MultiPoint')
  assert.equal(multi.geojson.features[0].geometry.coordinates.length, 2)
})

test('DBF 独立解析：文本/数值/布尔与删除标记', () => {
  const dbf = dbfFile(
    [{ NAME: 'A', HEIGHT: '12.5', OK: 'T' }],
    [
      { name: 'NAME', type: 'C', length: 10 },
      { name: 'HEIGHT', type: 'N', length: 8 },
      { name: 'OK', type: 'L', length: 1 },
    ],
  )
  const rows = parseDbf(dbf)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].NAME, 'A')
  assert.equal(rows[0].HEIGHT, 12.5)
  assert.equal(rows[0].OK, true)
})

test('DBF 删除槽位保持原记录对齐，删除记录对应几何跳过', () => {
  const dbf = dbfFile([{ NAME: 'A' }, { NAME: 'B' }, { NAME: 'C' }])
  const view = new DataView(dbf)
  view.setUint8(view.getUint16(8, true) + view.getUint16(10, true), 0x2a)
  assert.equal(parseDbf(dbf)[1], null)
  const parsed = parseShapefile(shpFile(1, [pointContent(1, 1), pointContent(2, 2), pointContent(3, 3)]), dbf)
  assert.deepEqual(parsed.geojson.features.map((feature) => [feature.geometry.coordinates[0], feature.properties.NAME]), [[1, 'A'], [3, 'C']])
})

test('SHP 局部记录不能跨记录取坐标，Z 必需字段和 parts 起点严格验证', () => {
  const short = new Uint8Array(4)
  new DataView(short.buffer).setInt32(0, 1, true)
  assert.throws(() => parseShapefile(shpFile(1, [short, pointContent(1, 2)])), /记录长度/)
  const z = pointContent(1, 2)
  new DataView(z.buffer).setInt32(0, 11, true)
  assert.throws(() => parseShapefile(shpFile(11, [z])), /记录长度/)
  assert.throws(() => parseShapefile(shpFile(3, [partsContent(3, [1], [[0, 0], [1, 1]])])), /首索引/)
  const validZ = new Uint8Array(28)
  validZ.set(z)
  assert.equal(parseShapefile(shpFile(11, [validZ])).featureCount, 1)
})

test('洞按包含关系归属，环顺序变化不改变拓扑', () => {
  const outerA = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]
  const outerB = outerA.map(([lon, lat]) => [lon + 20, lat])
  const hole = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]
  for (const rings of [[outerA, outerB, hole], [hole, outerB, outerA]]) {
    const parsed = parseShapefile(shpFile(5, [partsContent(5, [0, 5, 10], rings.flat())]))
    const withHole = parsed.geojson.features.find((feature) => feature.geometry.coordinates.length === 2)
    assert.ok(withHole)
    assert.ok(withHole.geometry.coordinates[0].every(([lon]) => lon <= 10))
  }
})

test('Z/M 负载：接受完整或省略的可选 M，拒绝半截数组和跨记录补齐', () => {
  const points = [[1, 2], [3, 4]]
  const extend = (bytes, extra) => {
    const result = new Uint8Array(bytes.length + extra)
    result.set(bytes)
    return result
  }
  for (const type of [13, 23]) {
    const xy = partsContent(type, [0], points)
    const minimum = type === 13 ? extend(xy, 16 + points.length * 8) : xy
    for (const record of [minimum, extend(minimum, 16 + points.length * 8)]) {
      const parsed = parseShapefile(shpFile(type, [record]))
      assert.deepEqual(parsed.geojson.features[0].geometry.coordinates, points)
      assert.ok(parsed.warnings.includes('vector.warning.flattened'))
    }
    assert.throws(() => parseShapefile(shpFile(type, [extend(minimum, 8), pointContent(1, 2)])), /Z\/M/)
  }
  const pointZ = extend(pointContent(1, 2), 8)
  new DataView(pointZ.buffer).setInt32(0, 11, true)
  assert.equal(parseShapefile(shpFile(11, [extend(pointZ, 8)])).featureCount, 1)
  assert.throws(() => parseShapefile(shpFile(11, [extend(pointZ, 4)])), /Z\/M/)
  const pointM = extend(pointContent(1, 2), 8)
  new DataView(pointM.buffer).setInt32(0, 21, true)
  assert.equal(parseShapefile(shpFile(21, [pointM])).featureCount, 1)
})

test('密集环超出计算预算时明确退出，避免阻塞场景交互', () => {
  const rings = Array.from({ length: 1500 }, (_, index) => {
    const lon = index * 0.01
    return [[lon, 0], [lon, 0.001], [lon + 0.001, 0.001], [lon + 0.001, 0], [lon, 0]]
  })
  assert.throws(() => parseShapefile(shpFile(5, [partsContent(5, rings.map((_, index) => index * 5), rings.flat())])), /计算量过多/)
})

test('错误：magic/空文件/不支持类型/坐标越界总量', () => {
  const badMagic = new ArrayBuffer(120)
  new DataView(badMagic).setInt32(0, 1234, false)
  assert.throws(() => parseShapefile(badMagic), /magic/)

  assert.throws(() => parseShapefile(new ArrayBuffer(20)), /过短/)
  assert.throws(() => parseShapefile(shpFile(1, [])), /没有可绘制的要素/)

  // Record type 31 (MultiPatch) is out of scope and must be reported clearly.
  const unsupportedRecord = new Uint8Array(4)
  new DataView(unsupportedRecord.buffer).setInt32(0, 31, true)
  assert.throws(() => parseShapefile(shpFile(31, [unsupportedRecord])), /不支持的 shape type/)
})

test('接线：地图 Tab 文件选择同时接受 .shp/.dbf，复用同一 overlay 渲染', async () => {
  const { readRepoFile } = await import('./helpers/source.mjs')
  const map = readRepoFile('src/client/ui/layers-map.js')
  assert.match(map, /readVectorFiles/)
  assert.match(map, /\.geojson,\.json,\.shp,\.dbf/)
  assert.match(map, /multiple: true/)
  const file = readRepoFile('src/client/scene/vector-file.js')
  assert.match(file, /parseShapefile/)
  assert.match(file, /\.shp/)
  assert.match(file, /\.dbf/)
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /readVectorFiles\(files\)/)
  assert.match(viewer, /hasVectorFile/)
  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['layers.importVector', 'layers.importNeedFile']) {
    const hits = messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.equal(hits.length, 2, `缺少中英 ${key}`)
  }
})
