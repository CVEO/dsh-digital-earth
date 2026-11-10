import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVectorGeoJSON, VECTOR_IMPORT_LIMITS } from '../src/client/scene/vector-import.js'
import { readVectorFiles, isVectorDrag } from '../src/client/scene/vector-file.js'
import { runVectorImport } from '../src/client/scene/vector-import-transaction.js'
import { vectorError, vectorErrorText } from '../src/client/scene/vector-errors.js'
import { VECTOR_MESSAGES } from '../src/client/messages-vector.js'

test('导入校验：投影坐标、未闭合/过短环、非法子几何和过深嵌套被拒绝', () => {
  for (const geometry of [
    { type: 'Point', coordinates: [500000, 3500000] },
    { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] },
    { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
    { type: 'GeometryCollection', geometries: [{ type: 'Circle', coordinates: [0, 0] }] },
  ]) assert.throws(() => normalizeVectorGeoJSON(JSON.stringify(geometry)), /几何|坐标/)
  let geometry = { type: 'Point', coordinates: [1, 2] }
  for (let index = 0; index < 50; index++) geometry = { type: 'GeometryCollection', geometries: [geometry] }
  assert.throws(() => normalizeVectorGeoJSON(JSON.stringify(geometry)))
  const valid = normalizeVectorGeoJSON(JSON.stringify({ type: 'GeometryCollection', geometries: [
    { type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [1, 2] }] },
  ] }))
  assert.equal(valid.coordinateCount, 1)
})

test('文件入口：读取前拒绝超大文件、错误配对、多个 SHP 与投影 PRJ', async () => {
  let reads = 0
  const shp = { name: 'buildings.shp', arrayBuffer: async () => { reads++; return new ArrayBuffer(0) } }
  await assert.rejects(() => readVectorFiles([{ ...shp, size: VECTOR_IMPORT_LIMITS.maxBytes + 1 }]), /8 MB/)
  await assert.rejects(() => readVectorFiles([shp, { name: 'roads.dbf' }]), /同名/)
  await assert.rejects(() => readVectorFiles([shp, { ...shp, name: 'other.shp' }]), /多个/)
  await assert.rejects(() => readVectorFiles([shp, { name: 'buildings.prj', text: async () => 'PROJCS["WGS_1984_UTM",GEOGCS["WGS_1984"]]' }]), /投影/)
  assert.equal(reads, 0)
  assert.equal(isVectorDrag({ types: ['Files'], files: [] }), true)
  assert.equal(isVectorDrag({ types: ['text/plain'], files: [] }), false)
})

test('导入失败回滚本次实体、命令与计数，保留已有内容', () => {
  const original = {}, added = {}, removed = []
  const state = { draw: [original], drawCommands: [], drawnFeatures: 1, entityGroups: new WeakMap() }
  assert.throws(() => runVectorImport(state, { entities: { remove: (entity) => removed.push(entity) } }, () => {
    state.draw.push(added); state.drawCommands.push({}); state.drawnFeatures++
    throw new Error('draw failed')
  }), /draw failed/)
  assert.deepEqual(state.draw, [original])
  assert.deepEqual(removed, [added])
  assert.equal(state.drawCommands.length, 0)
  assert.equal(state.drawnFeatures, 1)
})

test('新增导入提示中英成对，英文错误不泄露中文解析文本', () => {
  assert.deepEqual(Object.keys(VECTOR_MESSAGES.zh).sort(), Object.keys(VECTOR_MESSAGES.en).sort())
  const translated = vectorErrorText(vectorError('Shapefile: 记录长度越界'), (key) => VECTOR_MESSAGES.en[key])
  assert.match(translated, /truncated|bounds/)
  assert.doesNotMatch(translated, /[\u4e00-\u9fff]/)
})
