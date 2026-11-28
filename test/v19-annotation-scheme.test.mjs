import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_CLASSES,
  classHex,
  classKeyOf,
  classLabel,
  customEntries,
  customEntry,
  entryFor,
  matchClass,
  presetEntries,
  sanitizeClassLabel,
} from '../src/client/scene/annotation-scheme.js'

test('类别清洗：去控制字符/引号，折叠空白，拒绝空与超长', () => {
  assert.equal(sanitizeClassLabel('  温棚  '), '温棚')
  assert.equal(sanitizeClassLabel('green  house'), 'green house')
  assert.equal(sanitizeClassLabel('a\nb'), null)
  assert.equal(sanitizeClassLabel('x"y`z'), 'x y z')
  assert.equal(sanitizeClassLabel(''), null)
  assert.equal(sanitizeClassLabel('一二三四五六七八九十一二三四五六七'), null)
  assert.equal(sanitizeClassLabel(null), null)
})

test('类别键：预设/同义词归一到六类，未知类别落到 custom:<label>', () => {
  assert.equal(classKeyOf('building'), 'building')
  assert.equal(classKeyOf('Building'), 'building')
  assert.equal(classKeyOf('建筑'), 'building')
  assert.equal(classKeyOf('房屋'), 'building')
  assert.equal(classKeyOf('树'), 'vegetation')
  assert.equal(classKeyOf('河流'), 'water')
  assert.equal(classKeyOf('公路'), 'road')
  assert.equal(classKeyOf('汽车'), 'vehicle')
  assert.equal(classKeyOf('温室'), 'custom:温室')
  assert.equal(classKeyOf('greenhouse'), 'custom:greenhouse')
})

test('类别颜色：预设用原配色，自定义按标签稳定取色', () => {
  assert.equal(classHex('building'), '#ffce65')
  assert.equal(classHex('custom:温室'), classHex('温室'))
  assert.equal(classHex('custom:温室'), classHex('custom:温室'))
  assert.notEqual(classHex('custom:温室'), classHex('custom:道路'))
})

test('预设 chip 与自定义 chip 的形状满足 UI 合同', () => {
  const presets = presetEntries()
  assert.deepEqual(presets.map((entry) => entry.key), ['building', 'vegetation', 'water', 'road', 'vehicle', 'other'])
  for (const entry of presets) {
    assert.equal(entry.custom, false)
    assert.equal(entry.labelKey, `parse.class.${entry.key}`)
    assert.match(entry.hex, /^#[0-9a-f]{6}$/i)
    assert.equal(entry.on, false)
  }
  const custom = customEntry('温室')
  assert.equal(custom.key, 'custom:温室')
  assert.equal(custom.label, '温室')
  assert.equal(custom.custom, true)
  assert.equal(custom.on, true)
})

test('自定义类别列表：去重、跳预设、上限 8 个', () => {
  const entries = customEntries(['温室', '温室', 'building', ' 光伏板 ', 'water', '鱼塘'])
  assert.deepEqual(entries.map((entry) => entry.label), ['温室', '光伏板', '鱼塘'])
  const many = customEntries(Array.from({ length: 12 }, (_, index) => `类别${index}`))
  assert.equal(many.length, MAX_CLASSES)
})

test('entryFor 同时接受键与标签，label 供 UI 直接显示', () => {
  assert.equal(entryFor('building').key, 'building')
  assert.equal(entryFor('建筑').key, 'building')
  assert.equal(entryFor('custom:温室').label, '温室')
  assert.equal(entryFor('温室').key, 'custom:温室')
  assert.equal(entryFor(''), null)
})

test('matchClass：返回请求里的那个 chip，同义词与大小写归一，未知归 other', () => {
  const entries = [entryFor('building'), customEntry('温室'), entryFor('road')]
  assert.equal(matchClass('建筑', entries).key, 'building')
  assert.equal(matchClass('Building', entries).key, 'building')
  assert.equal(matchClass('温室', entries).key, 'custom:温室')
  assert.equal(matchClass('roads', entries).key, 'road')
  assert.equal(matchClass('nonsense', entries).key, 'other')
  assert.equal(matchClass('', entries), null)
})

test('classLabel：预设走 i18n，自定义直接显示原文', () => {
  const t = (key) => (key === 'parse.class.building' ? '建筑' : key)
  assert.equal(classLabel(entryFor('building'), t), '建筑')
  assert.equal(classLabel(customEntry('温室'), t), '温室')
  assert.equal(classLabel(null, t), '')
})
