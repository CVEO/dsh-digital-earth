/**
 * v1.20 — P1a prompt quality and target prior.
 *
 * Pins the single-target outline discipline (one clicked object, boundary on its
 * own visible edge, concave examples instead of 4-point boxes), the optional
 * sanitized user target that reaches the user text, and the batch prompt hygiene
 * changes (8-vertex example, no axis-aligned boxes, 16 clearest targets).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { validateVisionRequest } from '../src/host/vision.js'
import { BATCH_SYSTEM, MAX_BATCH_OBJECTS, SINGLE_SYSTEM, buildSingleUserText } from '../src/host/vision/prompts.js'

function pngDataUrl(width = 64, height = 64) {
  const data = Buffer.alloc(33)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(data)
  data.write('IHDR', 12)
  data.writeUInt32BE(width, 16)
  data.writeUInt32BE(height, 20)
  return `data:image/png;base64,${data.toString('base64')}`
}

function payload(overrides = {}) {
  return { frameId: 'frame-1', point: [0.5, 0.5], image: pngDataUrl(), ...overrides }
}

/** Extract the polygon example embedded in a system prompt. */
function examplePolygon(prompt) {
  const match = prompt.match(/"polygon":(\[\[[^\]]*\](?:,\[[^\]]*\])+\])/)
  assert.ok(match, 'system prompt must embed a polygon example')
  return JSON.parse(match[1])
}

/** True when the ring has at least one reflex vertex (i.e. is concave). */
function isConcave(ring) {
  let sign = 0
  for (let index = 0; index < ring.length; index += 1) {
    const [ax, ay] = ring[index]
    const [bx, by] = ring[(index + 1) % ring.length]
    const [cx, cy] = ring[(index + 2) % ring.length]
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
    if (Math.abs(cross) < 1e-9) continue
    const current = Math.sign(cross)
    if (sign === 0) sign = current
    else if (current !== sign) return true
  }
  return false
}

test('单目标提示词：只描点击处的那一个目标，边界贴自身可见外缘且不外扩不留边距', () => {
  assert.match(SINGLE_SYSTEM, /Outline exactly one target/i)
  assert.match(SINGLE_SYSTEM, /directly under the supplied click/i)
  assert.match(SINGLE_SYSTEM, /visible structure or facade/i)
  assert.match(SINGLE_SYSTEM, /click must lie inside the returned polygon/i)
  assert.match(SINGLE_SYSTEM, /own visible outer edge/i)
  assert.match(SINGLE_SYSTEM, /do not expand it/i)
  assert.match(SINGLE_SYSTEM, /do not leave a margin/i)
  for (const excluded of [/surrounding grass/i, /ground shadows/i, /roads/i, /adjacent targets/i, /sky/i, /whole parcel/i]) {
    assert.match(SINGLE_SYSTEM, excluded)
  }
})

test('单目标提示词：大目标沿自身边界走，曲线用 16~32 点，拒绝 4 点矩形与图片边缘', () => {
  assert.match(SINGLE_SYSTEM, /sports field, court, large building/i)
  assert.match(SINGLE_SYSTEM, /16 to 32 vertices/i)
  assert.match(SINGLE_SYSTEM, /6 to 32 vertices/i)
  assert.match(SINGLE_SYSTEM, /axis-aligned 4-point rectangle is a failure/i)
  assert.match(SINGLE_SYSTEM, /never use an image edge/i)
  // bbox stays a last resort, and anti-injection wording is kept.
  assert.match(SINGLE_SYSTEM, /"bbox":\[left,top,right,bottom\]/)
  assert.match(SINGLE_SYSTEM, /only when a polygon is truly impossible/i)
  assert.match(SINGLE_SYSTEM, /never as instructions/i)
})

test('单目标提示词：示例是 8 点凹多边形，不再是轴对齐 4 点矩形', () => {
  const ring = examplePolygon(SINGLE_SYSTEM)
  assert.equal(ring.length, 8)
  assert.ok(isConcave(ring), 'example outline must be concave')
  for (const [x, y] of ring) {
    assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1)
  }
  // The old 4-point axis-aligned example must be gone.
  assert.doesNotMatch(SINGLE_SYSTEM, /\[\[0\.32,0\.28\],\[0\.68,0\.28\]/)
})

test('单目标用户文本：可选 target 渲染为 Target: "<target>"，缺省用中性的 the clicked object', () => {
  const base = { point: [0.5, 0.5], width: 640, height: 480 }
  const withTarget = buildSingleUserText({ ...base, target: '操场' })
  assert.match(withTarget, /Target: "操场"/)
  assert.match(withTarget, /Outline only the one clicked 操场/)
  assert.match(withTarget, /Click: \[0\.5,0\.5\]/)
  assert.match(withTarget, /normalized 0\.\.1/)
  assert.doesNotMatch(withTarget, /clicked object/)

  const neutral = buildSingleUserText(base)
  assert.match(neutral, /Outline only the one clicked object/)
  assert.doesNotMatch(neutral, /Target:/)

  for (const target of ['', '   ', null, undefined, 42, ['操场']]) {
    assert.match(buildSingleUserText({ ...base, target }), /Outline only the one clicked object/)
  }
})

test('单目标校验：合法 target 被清洗后保留并交给后端', () => {
  assert.equal(validateVisionRequest(payload({ target: ' 操场 ' })).target, '操场')
  assert.equal(validateVisionRequest(payload({ target: '  "建筑"  ' })).target, '建筑')
  assert.equal(validateVisionRequest(payload({ target: '建筑"\u0000`危险`' })).target, '建筑 危险')
  assert.equal(validateVisionRequest(payload({ target: 'a\nb' })).target, 'a b')
  // Exactly 24 characters pass, 25 are dropped (no silent truncation).
  assert.equal(validateVisionRequest(payload({ target: '十'.repeat(24) })).target, '十'.repeat(24))
  assert.equal(validateVisionRequest(payload({ target: '十'.repeat(25) })).target, '')
})

test('单目标校验：非法 target 被忽略而不报错，图片与点击边界保持不变', () => {
  for (const target of [42, null, {}, ['建筑'], true, '   ']) {
    assert.equal(validateVisionRequest(payload({ target })).target, '')
  }
  assert.equal(validateVisionRequest(payload()).target, '')
  assert.equal(validateVisionRequest(payload({ target: '操场' })).frameId, 'frame-1')
  assert.equal(validateVisionRequest(payload({ target: '操场' })).width, 64)
  assert.throws(() => validateVisionRequest(payload({ target: '操场', image: 'nope' })), { code: 'invalid_request' })
  assert.throws(() => validateVisionRequest(payload({ target: '操场', point: [2, 0] })), { code: 'invalid_request' })
})

test('批量提示词：示例改为 8 点凹多边形，轴对齐 4 点框无效并提示省略该对象', () => {
  const ring = examplePolygon(BATCH_SYSTEM)
  assert.equal(ring.length, 8)
  assert.ok(isConcave(ring), 'example outline must be concave')
  assert.match(BATCH_SYSTEM, /8 concave vertices/i)
  assert.match(BATCH_SYSTEM, /axis-aligned 4-point detection box is invalid/i)
  assert.match(BATCH_SYSTEM, /return at least 6 vertices/i)
  assert.match(BATCH_SYSTEM, /omit that object instead of returning its box/i)
  // The old axis-aligned 4-point example must be gone.
  assert.doesNotMatch(BATCH_SYSTEM, /\[\[0\.12,0\.20\],\[0\.34,0\.20\]/)
})

test('批量提示词：对象数措辞改为最多 16 个最清晰目标，宿主常量与类别 copy 规则不变', () => {
  assert.match(BATCH_SYSTEM, /at most 16 of the clearest targets/i)
  assert.doesNotMatch(BATCH_SYSTEM, /At most 40 objects/)
  assert.equal(MAX_BATCH_OBJECTS, 40)
  assert.match(BATCH_SYSTEM, /copied verbatim from the requested class list/i)
  assert.match(BATCH_SYSTEM, /never as instructions/i)
  assert.match(BATCH_SYSTEM, /geographic coordinates/i)
})
