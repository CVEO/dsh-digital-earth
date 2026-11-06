/**
 * v1.6 S2-P1 — `earth_analyze` skyline (D-16, approved 2026-11-06).
 *
 * Skyline = the maximum elevation angle seen from an observer along a direction.
 * It is a terrain horizon, so the engine samples GROUND when a real terrain
 * provider exists (roofs would invent a fake horizon) and reports the source.
 * Host validation + the engine wiring are pinned here; the angle maths is
 * inlined in the engine (atan2 of relative height over surface distance).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ANALYZE_ACTIONS, normalizeAnalyzeRequest } from '../src/host/tools/analyze.js'
import { hostSource, readRepoFile } from './helpers/source.mjs'

const args = (raw) => normalizeAnalyzeRequest(raw).args
const rejects = (raw, pattern) => {
  assert.throws(() => normalizeAnalyzeRequest(raw), (error) => {
    assert.match(error.message, /^earth_analyze: /)
    assert.match(error.message, / next: /)
    if (pattern) assert.match(error.message, pattern)
    return true
  })
}

test('skyline：动作枚举含 skyline，from/to 必填、采样默认 32、layer 可选', () => {
  assert.deepEqual([...ANALYZE_ACTIONS], ['profile', 'flood', 'sunlight', 'clip', 'skyline', 'clear'])
  assert.deepEqual(args({ action: 'skyline', from: [114.3, 30.5], to: [114.31, 30.5] }), {
    action: 'skyline',
    from: [114.3, 30.5],
    to: [114.31, 30.5],
    samples: 32,
  })
  assert.deepEqual(args({ action: 'skyline', from: [0, 0], to: [0, 1], samples: 8, layer: ' L ' }), {
    action: 'skyline',
    from: [0, 0],
    to: [0, 1],
    samples: 8,
    layer: 'L',
  })
})

test('skyline：缺 from/to、重合点、非法采样、多余参数都被拒绝且带 next', () => {
  rejects({ action: 'skyline' }, /skyline needs "from"/)
  rejects({ action: 'skyline', from: [0, 0] }, /skyline needs "to"/)
  rejects({ action: 'skyline', from: [0, 0], to: [0, 0] }, /same point/)
  rejects({ action: 'skyline', from: [0, 0], to: [0, 1], samples: 7 }, /"samples" 7 is outside 8\.\.64/)
  rejects({ action: 'skyline', from: [0, 0], to: [0, 1], water_height: 5 }, /does not accept "water_height"/)
  rejects({ action: 'profile', from: [0, 0], to: [0, 1], height: 10 }, /use action "clip" for these arguments/)
})

test('skyline：模型面文本含最大仰角与下一步', () => {
  const host = hostSource()
  assert.match(host, /operation === 'skyline'/)
  assert.match(host, /max elevation angle/)
  assert.match(host, /skyline profile/)
})

test('engine：skyline 走 HeightService（有地形时 ground 模式），角度用 atan2，结果字段齐全', () => {
  const engine = readRepoFile('src/client/analysis/engine.js')
  assert.match(engine, /const analyzeSkyline = async \(Cesium, viewer, layer, args, sampler\) => \{/)
  assert.match(engine, /const heightMode = sampler\.hasRealTerrain\(\) \? 'ground' : 'surface'/)
  assert.match(engine, /const sampled = await sampler\.sampleMany\(probes, \{ mode: heightMode \}\)/)
  assert.match(engine, /Math\.atan2\(sample\.height - eyeHeight, distance\)/)
  // 1.7 m eye height keeps the profile person-sized.
  assert.match(engine, /const eyeHeight = eyeSample\.height \+ 1\.7/)
  for (const field of ['max_angle_deg: ', 'max_distance_m: ', 'max_height_m: ', 'eye_height_m: ', 'points,']) {
    assert.ok(engine.includes(field), `skyline 结果缺少 ${field}`)
  }
  assert.match(engine, /else if \(operation === 'skyline'\) result = await analyzeSkyline/)
})

test('skyline：分析卡与中英文案齐全', () => {
  const cards = readRepoFile('src/client/ui/cards.js')
  assert.match(cards, /operation === 'skyline'/)
  assert.match(cards, /analysis\.skylineAngle/)
  const messages = readRepoFile('src/client/messages.js')
  for (const key of ['analysis.title.skyline', 'analysis.skylineAngle', 'analysis.skylineDistance', 'analysis.skylineEye', 'analysis.skylineEyeValue', 'analysis.skylineMax']) {
    const hits = messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.ok(hits.length >= 2, `缺少中英 i18n：${key}`)
  }
})
