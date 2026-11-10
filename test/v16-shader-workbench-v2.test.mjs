/**
 * v1.6 shader workbench 2.0 — readable card, preset thumbnails, explicit target,
 * ordered stack controls, sliders with optional live preview, and an original-look
 * comparison. Pure helpers and the wiring factory are tested here; the engine
 * behaviours (fast uniform update / comparison lifecycle) are pinned structurally.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createWorkbenchWiring,
  moveShaderPreset,
  resolveWorkbenchTarget,
} from '../src/client/ui/workbench-wiring.js'
import { samePresetStack } from '../src/client/shader/presets.js'
import { readRepoFile } from './helpers/source.mjs'

const form = (extra = {}) => ({ layerId: '', preset: ['contour', 'scan'], interval: '20', speed: '1', amplitude: '1', opacity: '0.75', waterHeight: '', depthMax: '', minHeight: '', maxHeight: '', ...extra })
const t = (key, params) => (params ? `${key}:${Object.values(params).join(',')}` : key)
const layer = (id, extra = {}) => ({ id, name: id.toUpperCase(), visible: true, ...extra })

test('samePresetStack：字符串与有序数组的比较', () => {
  assert.equal(samePresetStack('contour', 'contour'), true)
  assert.equal(samePresetStack('contour', ['contour']), true)
  assert.equal(samePresetStack(['contour', 'scan'], ['contour', 'scan']), true)
  assert.equal(samePresetStack(['contour', 'scan'], ['scan', 'contour']), false, '顺序不同即不同')
  assert.equal(samePresetStack('contour', ['contour', 'scan']), false)
  assert.equal(samePresetStack(undefined, []), true)
})

test('moveShaderPreset：在叠加里上下移动，边界不动，单预设不变', () => {
  assert.deepEqual(moveShaderPreset(form(), 'scan', -1).preset, ['scan', 'contour'])
  assert.deepEqual(moveShaderPreset(form(), 'contour', 1).preset, ['scan', 'contour'])
  assert.equal(moveShaderPreset(form(), 'contour', -1).preset.join(), 'contour,scan', '首位上移无效')
  assert.equal(moveShaderPreset(form(), 'scan', 1).preset.join(), 'contour,scan', '末位下移无效')
  assert.equal(moveShaderPreset(form({ preset: 'contour' }), 'contour', 1).preset, 'contour')
})

test('resolveWorkbenchTarget：显式选择优先，自动选择跳过隐藏层与 3DGS', () => {
  const gaussian = layer('splat', { tileset: { extensionsUsed: ['KHR_gaussian_splatting'] } })
  const layers = [layer('a'), layer('hidden', { visible: false }), gaussian, layer('b')]
  const explicit = resolveWorkbenchTarget(layers, form({ layerId: 'a' }))
  assert.deepEqual(explicit, { layer: layers[0], auto: false })
  const auto = resolveWorkbenchTarget(layers, form())
  assert.equal(auto.layer.id, 'b', '最上层可见普通图层')
  assert.equal(auto.auto, true)
  const none = resolveWorkbenchTarget([layer('hidden', { visible: false })], form())
  assert.equal(none.layer, null)
  const splatOnly = resolveWorkbenchTarget([gaussian], form())
  assert.equal(splatOnly.layer, null)
  assert.equal(splatOnly.gaussianOnly, true)
})

test('wiring：实时预览是静默且合并的；显式应用才 toast', async () => {
  const calls = []
  const toasts = []
  const w = createWorkbenchWiring({
    getForm: () => form({ preset: ['contour'], interval: '30' }),
    getLayers: () => [layer('a')],
    setShaderForm: (updater) => {
      if (typeof updater === 'function') updater(form())
    },
    shaderCommand: async (args) => {
      calls.push(args)
      return { preset: args.preset, layer: 'A' }
    },
    showToast: (text) => toasts.push(text),
    t,
    shaderCompare: async () => ({ compared: true }),
  })
  w.preview()
  w.preview()
  w.preview()
  await new Promise((resolve) => setTimeout(resolve, 260))
  assert.equal(calls.length, 1, '连续预览合并成一次 apply')
  assert.equal(calls[0].interval, 30)
  assert.deepEqual(toasts, [], '预览不弹 toast')

  await w.apply()
  assert.equal(calls.length, 2)
  assert.equal(toasts.length, 1)
  assert.match(toasts[0], /toast\.shaderApplied/)
})

test('wiring：目标图层与对比按钮把实际图层 id 传给 shaderCompare', async () => {
  const compared = []
  const w = createWorkbenchWiring({
    getForm: () => form({ layerId: 'a' }),
    getLayers: () => [layer('a'), layer('b')],
    setShaderForm: () => {},
    shaderCommand: async () => ({}),
    showToast: () => {},
    t,
    shaderCompare: async (id, enabled) => {
      compared.push([id, enabled])
      return { compared: enabled }
    },
  })
  assert.deepEqual(w.target().layer.id, 'a')
  await w.compare(true)
  await w.compare(false)
  assert.deepEqual(compared, [['a', true], ['a', false]])

  // 无图层时只提示，不调用引擎。
  const empty = createWorkbenchWiring({
    getForm: () => form(),
    getLayers: () => [],
    setShaderForm: () => {},
    shaderCommand: async () => ({}),
    showToast: (text) => compared.push(['toast', text]),
    t,
    shaderCompare: async () => assert.fail('不应调用'),
  })
  assert.equal(await empty.compare(true), null)
  assert.equal(compared[compared.length - 1][1], 'shader.noLayers')
})

test('engine：同预设走 uniform 快路径；对比在应用/重置/移除时自动结束', () => {
  const engine = readRepoFile('src/client/scene/shader-engine.js')
  assert.match(engine, /samePresetStack\(existing\.preset, request\.preset\)/)
  assert.match(engine, /existing\.shader\.setUniform\(name, uniform\.value\)/)
  assert.match(engine, /existing\.params = \{ \.\.\.request\.params \}/)
  // 任何一次 apply 先结束该图层的原图对比。
  assert.match(engine, /\/\/ Applying a look ends any original-look comparison on this layer\.\n\s+finishCompare\(layer\.id\)/)
  assert.match(engine, /function compareShader\(layerToken, enabled\) \{/)
  assert.match(engine, /comparisons\.set\(layer\.id, \{ original: entry\.previous \?\? null \}\)/)
  assert.match(engine, /layer\.tileset\.customShader = entry\.previous \?\? undefined/)
  assert.match(engine, /finishCompare\(entry\.layer\.id\)/, 'reset 时必须结束对比')
  assert.match(engine, /finishCompare\(id\)/, '图层移除时必须结束对比')
  assert.match(engine, /compare: \(layer, enabled\) => compareShader\(layer, enabled\)/)
})

test('cards：缩略图、目标行、顺序控件、滑杆、实时预览、对比与应用状态齐全', () => {
  const cards = readRepoFile('src/client/ui/cards.js')
  for (const marker of [
    'const thumb = (preset) =>',
    'className: \'thumb-svg\'',
    'shader.targetAuto',
    'shader.orderLabel',
    'onPresetMove(preset, -1)',
    'sliderField(\'interval\'',
    'type: \'range\'',
    'shader.livePreview',
    'shader.compareOn',
    'shader.appliedTag',
    'runApply',
    'onPreview()',
  ]) {
    assert.ok(cards.includes(marker), `工作台缺少 ${marker}`)
  }
  // 视觉特效产品化：只展示四个主效果，等高线入口不再出现在界面。
  assert.match(cards, /SHADER_PRIMARY_PRESETS\.map\(\(preset\) => presetChip\(preset\)\)/)
  assert.doesNotMatch(cards, /SHADER_ADVANCED_PRESETS/, '工作台不得再引用等高线分组')
  assert.doesNotMatch(cards, /shader\.advanced/, '高级效果分组已移除')
  assert.match(cards, /t\('shader\.targetHint'\)/)
  assert.match(cards, /t\('shader\.singleHint'\)/)
  assert.doesNotMatch(cards, /\.\.\.SHADER_PRESETS\.map/, '主网格不应再直接列出全部五个预设')
  // 关闭时通过 onClose 恢复原图对比，避免把图层留在原始外观。
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /onClose: \(\) => \{\n\s+void workbench\.compare\(false\)/)
  assert.match(viewer, /onPreview: workbench\.preview,/)
  assert.match(viewer, /target: workbench\.target\(\),/)
  assert.match(viewer, /onPresetMove: workbench\.move,/)
  assert.match(viewer, /onCompare: workbench\.compare,/)
  assert.match(viewer, /shaderCompare: \(layer, enabled\) => shaderEngine\.compare\(layer, enabled\),/)
})
