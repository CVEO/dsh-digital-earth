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

test('图层行：有效果的层带 ✦ 标记、悬停摘要、点击整行载入工作台；无独立效果列表', () => {
  // Row markup moved to ui/layer-row.js; ui/layers-3d.js resolves the effect.
  const panel = readRepoFile('src/client/ui/layer-row.js')
  const layers3d = readRepoFile('src/client/ui/layers-3d.js')
  // 效果信息挂在 3D Tiles 图层行上，而不是单独分组。
  assert.match(layers3d, /const shaderFor = \(layer\) =>/)
  assert.match(layers3d, /entry\.layerId === layer\.id/)
  assert.match(panel, /className: `mv-layer\$\{layer\.visible \? '' : ' off'\}\$\{shader \? ' has-shader' : ''\}`/)
  assert.match(panel, /title: shader \? `\$\{layer\.name\} — \$\{summary\}` : layer\.name/)
  assert.match(panel, /const openShader = \(\) => onEditShader\(layer, shader\)/)
  assert.match(panel, /className: 'mv-icon-btn mv-shader-edit'/)
  assert.match(panel, /'✦'/)
  assert.match(panel, /stop\(event\)\n\s+onFlyLayer\(layer\.id\)/)
  const layersCard = readRepoFile('src/client/ui/layers-panel.js')
  assert.doesNotMatch(layersCard, /layers\.shader'/, '图层卡不应有独立的“着色器效果”分组')
  assert.doesNotMatch(panel, /mv-shader-layer/, '不应再有独立的效果行样式')
})

test('ViewerSurface：把层行点击映射为加载效果并打开工作台', () => {
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /shaderActive,\n\s+onEditLayerShader: \(layer, entry\) => \{/)
  assert.match(viewer, /workbench\.loadEntry\(entry \?\? \{ layer: layer\.name, layerId: layer\.id, preset: 'height-false-color' \}\)/)
  assert.match(viewer, /setShaderOpen\(true\)/)
  const engine = readRepoFile('src/client/scene/shader-engine.js')
  assert.match(engine, /layer: entry\.layerName, layerId: entry\.layer\.id, preset: entry\.preset, params: \{ \.\.\.entry\.params \}/)
})
