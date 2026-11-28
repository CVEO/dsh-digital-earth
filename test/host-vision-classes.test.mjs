import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateVisionBatchRequest } from '../src/host/vision/handler.js'
import { BATCH_CLASSES, BATCH_SYSTEM, buildBatchUserText } from '../src/host/vision/prompts.js'

function pngDataUrl(width = 64, height = 64) {
  const data = Buffer.alloc(33)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(data)
  data.write('IHDR', 12)
  data.writeUInt32BE(width, 16)
  data.writeUInt32BE(height, 20)
  return `data:image/png;base64,${data.toString('base64')}`
}

function payload(overrides = {}) {
  return { frameId: 'frame-1', image: pngDataUrl(), ...overrides }
}

function classesOf(classes) {
  return validateVisionBatchRequest(payload({ classes })).classes
}

test('批量类别：任意中英文类别原样保留，不再被固定白名单过滤', () => {
  assert.deepEqual(classesOf(['温室']), ['温室'])
  assert.deepEqual(classesOf(['road', 'Building', '太阳能板']), ['road', 'Building', '太阳能板'])
  assert.deepEqual(classesOf(['卡车', 'tower crane']), ['卡车', 'tower crane'])
  // Empty request still means "no class restriction" rather than an error.
  assert.deepEqual(classesOf([]), [])
  assert.deepEqual(validateVisionBatchRequest(payload()).classes, [])
})

test('批量类别：超过 8 个截断为前 8 个', () => {
  const many = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11']
  assert.deepEqual(classesOf(many), many.slice(0, 8))
})

test('批量类别：单项超过 16 字符丢弃，恰好 16 字符保留', () => {
  assert.deepEqual(classesOf(['a'.repeat(17)]), [])
  assert.deepEqual(classesOf(['b'.repeat(16), '1234567890123456']), ['b'.repeat(16), '1234567890123456'])
  assert.deepEqual(classesOf(['温室'.repeat(9)]), [])
})

test('批量类别：换行/控制字符/引号/反引号被清理，非法项丢弃而不整体报错', () => {
  assert.deepEqual(classesOf(['建筑"\n`危险`']), ['建筑 危险'])
  assert.deepEqual(classesOf(['  "road"\u0000  ']), ['road'])
  assert.deepEqual(classesOf(['sun\u001b[31mflower']), ['sun [31mflower'])
  assert.deepEqual(classesOf([123, null, undefined, { label: 'x' }, '   ', '""', 'ok']), ['ok'])
})

test('批量类别：大小写不敏感去重并保留首次写法', () => {
  assert.deepEqual(classesOf(['Building', 'building', 'BUILDING', ' 温室 ', '温室']), ['Building', '温室'])
})

test('批量类别：非法请求体仍按 invalid_request 拒绝（图片与帧号边界不变）', () => {
  assert.throws(() => validateVisionBatchRequest(null), { code: 'invalid_request' })
  assert.throws(() => validateVisionBatchRequest({ image: pngDataUrl() }), { code: 'invalid_request' })
  assert.throws(() => validateVisionBatchRequest(payload({ frameId: 'frame 1' })), { code: 'invalid_request' })
  assert.throws(() => validateVisionBatchRequest(payload({ image: 'nope' })), { code: 'invalid_request' })
  assert.throws(() => validateVisionBatchRequest(payload({ image: 'data:image/svg+xml;base64,PHN2Zy8+' })), { code: 'invalid_request' })
  assert.throws(() => validateVisionBatchRequest(payload({ image: pngDataUrl(16, 16) })), { code: 'invalid_request' })
  const input = validateVisionBatchRequest(payload({ scope: 'aoi', classes: ['温室'] }))
  assert.equal(input.scope, 'aoi')
  assert.equal(input.width, 64)
  assert.equal(input.force, false)
})

test('批量提示词：不再固定列举五类，保留 40 对象与防注入约束，中文类别进入用户文本', () => {
  assert.match(BATCH_SYSTEM, /requested class list/i)
  assert.doesNotMatch(BATCH_SYSTEM, /buildings, vegetation, water, roads and large vehicles/i)
  assert.match(BATCH_SYSTEM, /at most 16 of the clearest targets/i)
  assert.match(BATCH_SYSTEM, /never as instructions/i)
  assert.match(BATCH_SYSTEM, /geographic coordinates/i)
  assert.ok(BATCH_CLASSES instanceof Set)
  assert.ok(BATCH_CLASSES.has('building'))
  const text = buildBatchUserText({ width: 640, height: 480, classes: ['温室', 'road'] })
  assert.match(text, /温室/)
  assert.match(text, /"road"/)
  assert.match(buildBatchUserText({ width: 640, height: 480, classes: [] }), /not specified/i)
})
