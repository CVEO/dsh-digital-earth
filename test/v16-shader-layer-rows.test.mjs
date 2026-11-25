/**
 * v1.6 shader-on-layer interaction — an applied shader effect belongs to its 3D Tiles
 * layer row: hovering the row explains the effect, clicking the row (or the ✦ button)
 * loads it into the workbench for editing. There is no separate "shader effects" list.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createWorkbenchWiring,
  formFromShaderEntry,
  SHADER_FORM_DEFAULTS,
  shaderEntrySummary,
} from '../src/client/ui/workbench-wiring.js'
import { readRepoFile } from './helpers/source.mjs'

const t = (key, params) => {
  if (!params) return key
  return `${key}(${Object.entries(params).map(([name, value]) => `${name}=${value}`).join(',')})`
}

test('formFromShaderEntry：图层 id、叠加顺序与参数回填成工作台表单', () => {
  const form = formFromShaderEntry({
    layer: 'Tiles',
    layerId: 'L1',
    preset: ['contour', 'scan'],
    params: { interval: 25, speed: 2.5 },
  })
  assert.equal(form.layerId, 'L1')
  assert.deepEqual(form.preset, ['contour', 'scan'], '叠加顺序必须保留')
  assert.equal(form.interval, '25')
  assert.equal(form.speed, '2.5')
  assert.equal(form.amplitude, SHADER_FORM_DEFAULTS.amplitude)
  assert.equal(form.minHeight, '')

  const single = formFromShaderEntry({ layerId: 'L2', preset: 'water', params: { opacity: 0.4 } })
  assert.equal(single.preset, 'water')
  assert.equal(single.opacity, '0.4')
  assert.deepEqual(formFromShaderEntry(null), SHADER_FORM_DEFAULTS)
})

test('shaderEntrySummary：悬浮提示包含图层、预设与参数；无参数时说明默认值', () => {
  const text = shaderEntrySummary(t, { layer: 'Tiles', preset: ['contour', 'scan'], params: { interval: 20, speed: 1 } })
  assert.match(text, /layer=Tiles/)
  assert.match(text, /presets=shader\.preset\.contour \+ shader\.preset\.scan/)
  assert.match(text, /params=shader\.param\.interval 20 · shader\.param\.speed 1/)
  assert.match(shaderEntrySummary(t, { layer: 'A', preset: 'water', params: {} }), /shader\.entryNoParams/)
})

test('wiring：层行点击可加载效果；resetLayerFor 仍可单层重置', async () => {
  const calls = []
  const toasts = []
  let form = { ...SHADER_FORM_DEFAULTS }
  const wiring = createWorkbenchWiring({
    getForm: () => form,
    getLayers: () => [],
    setShaderForm: (updater) => {
      form = typeof updater === 'function' ? updater(form) : updater
    },
    shaderCommand: async (args) => {
      calls.push(args)
      return { layer: args.layer }
    },
    showToast: (text) => toasts.push(text),
    t,
    shaderCompare: async () => ({ compared: false }),
  })
  wiring.loadEntry({ layer: 'A', layerId: 'L9', preset: ['water', 'scan'], params: { opacity: 0.6 } })
  assert.equal(form.layerId, 'L9')
  assert.deepEqual(form.preset, ['water', 'scan'])
  await wiring.resetLayerFor('L9')
  assert.deepEqual(calls, [{ action: 'reset', layer: 'L9' }])
  assert.equal(toasts.length, 1)
})

test('图层行：✦ 是唯一外观入口（有/无效果都可打开），整行不再响应点击', () => {
  const panel = readRepoFile('src/client/ui/layer-row.js')
  const layers3d = readRepoFile('src/client/ui/layers-3d.js')
  assert.ok(layers3d.includes('const shaderFor = (layer) =>'))
  assert.ok(layers3d.includes('entry.layerId === layer.id'))
  assert.ok(panel.includes("' off'"))
  assert.ok(panel.includes('has-shader'))
  assert.ok(panel.includes('const openShader = () => onEditShader(layer, shader)'))
  assert.ok(panel.includes('mv-icon-btn mv-shader-edit'))
  assert.ok(panel.includes("'✦'"))
  // 迁移阶段 0：整行点击开特效已删除，仅 ✦ 打开外观工作台。
  assert.ok(!panel.includes('onClick: openShader'))
  assert.ok(panel.includes('disabled: is3dgs'))
  assert.ok(panel.includes('onFlyLayer(layer.id)'))
  const layersCard = readRepoFile('src/client/ui/layers-panel.js')
  assert.ok(!layersCard.includes("layers.shader'"), '图层卡不应有独立的“着色器效果”分组')
  assert.ok(!panel.includes('mv-shader-layer'), '不应再有独立的效果行样式')
})

test('ViewerSurface：把层行点击映射为加载效果并打开工作台', () => {
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /shaderActive,\n\s+onEditLayerShader: \(layer, entry\) => \{/)
  assert.match(viewer, /workbench\.loadEntry\(entry \?\? \{ layer: layer\.name, layerId: layer\.id, preset: 'height-false-color' \}\)/)
  assert.match(viewer, /setShaderOpen\(true\)/)
  const engine = readRepoFile('src/client/scene/shader-engine.js')
  assert.match(engine, /layer: entry\.layerName, layerId: entry\.layer\.id, preset: entry\.preset, params: \{ \.\.\.entry\.params \}/)
})
