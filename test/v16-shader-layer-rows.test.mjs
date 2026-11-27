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

test('图层行：外观图标是唯一入口（有/无效果都可打开），整行不再响应点击', () => {
  // v1.8: the row shell (ui/layer-row.js) is a slot-based pure component; the
  // appearance button and the .has-shader marker belong to the 三维内容 row in
  // ui/layers-entities.js, which is what these assertions now pin.
  const row = readRepoFile('src/client/ui/layer-row.js')
  const entities = readRepoFile('src/client/ui/layers-entities.js')
  assert.ok(entities.includes('const shaderFor = (layer) =>'))
  assert.ok(entities.includes('entry.layerId === layer.id'))
  assert.ok(row.includes("' off'"), 'LayerRow 仍由 off 派生 .off（隐藏态样式）')
  assert.ok(entities.includes("'has-shader'"), '有特效的三维内容行仍带 .has-shader 标记')
  // 外观图标是唯一入口：一次点击带着当前 entry 打开外观工作台，3DGS 行禁用。
  assert.ok(entities.includes('mv-icon-btn mv-shader-edit'))
  assert.ok(entities.includes("kind: 'shader'"))
  assert.ok(entities.includes('onEditLayerShader(layer, shader)'))
  assert.ok(entities.includes('disabled: is3dgs'))
  // 整行不再响应点击：根节点没有 onClick，只有 name 触发飞行。
  const rootProps = row.slice(row.indexOf('className: `mv-layer'), row.indexOf("warn ? h('span'"))
  assert.ok(rootProps.length > 0, 'LayerRow 根节点仍是 .mv-layer 容器')
  assert.ok(!rootProps.includes('onClick'), 'LayerRow 根节点不再绑定点击')
  assert.ok(row.includes('onClick: onNameClick'), '只有图层名是飞行点')
  assert.ok(entities.includes('onNameClick: () => onFlyLayer(layer.id)'))
  const layersCard = readRepoFile('src/client/ui/layers-panel.js')
  assert.ok(!layersCard.includes("layers.shader'"), '图层卡不应有独立的“着色器效果”分组')
  assert.ok(!row.includes('mv-shader-layer'), '不应再有独立的效果行样式')
})

test('ViewerSurface：把层行点击映射为加载效果并打开工作台', () => {
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /shaderActive,\s+onEditLayerShader: openLayerShader,/)
  assert.match(viewer, /const openLayerShader = \(layer, entry\) => \{/)
  assert.match(viewer, /workbench\.loadEntry\(entry \?\? \{ layer: layer\.name, layerId: layer\.id, preset: 'height-false-color' \}\)/)
  assert.match(viewer, /setShaderOpen\(true\)/)
  const engine = readRepoFile('src/client/scene/shader-engine.js')
  assert.match(engine, /layer: entry\.layerName, layerId: entry\.layer\.id, preset: entry\.preset, params: \{ \.\.\.entry\.params \}/)
})
