/**
 * v1.6 shader rows — each applied preset stack is a selectable row in the layer
 * panel: click (or ✎) loads it into the workbench for editing, hover shows a
 * parameter summary, ✕ resets only that layer.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  formFromShaderEntry,
  SHADER_FORM_DEFAULTS,
  shaderEntrySummary,
} from '../src/client/ui/workbench-wiring.js'
import { createWorkbenchWiring } from '../src/client/ui/workbench-wiring.js'
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
  // 缺失字段一律回到默认表单，绝不留 undefined。
  const blank = formFromShaderEntry(null)
  assert.deepEqual(blank, SHADER_FORM_DEFAULTS)
})

test('shaderEntrySummary：悬浮提示包含图层、预设与参数；无参数时说明默认值', () => {
  const text = shaderEntrySummary(t, { layer: 'Tiles', preset: ['contour', 'scan'], params: { interval: 20, speed: 1 } })
  assert.match(text, /layer=Tiles/)
  assert.match(text, /presets=shader\.preset\.contour \+ shader\.preset\.scan/)
  assert.match(text, /params=shader\.param\.interval 20 · shader\.param\.speed 1/)
  const empty = shaderEntrySummary(t, { layer: 'A', preset: 'water', params: {} })
  assert.match(empty, /shader\.entryNoParams/)
})

test('wiring：点击行加载条目；✕ 只重置该图层并 toast', async () => {
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
      return { layer: args.layer, preset: null }
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

test('面板：着色器效果分组渲染可选中行、悬浮提示与编辑/移除按钮', () => {
  const panel = readRepoFile('src/client/ui/layers-panel.js')
  assert.match(panel, /t\('layers\.shader'\)/)
  assert.match(panel, /t\('layers\.shaderEmpty'\)/)
  assert.match(panel, /className: `mv-layer mv-shader-layer\$\{selected \? ' on' : ''\}`/)
  assert.match(panel, /title: shaderEntrySummary\(t, entry\)/)
  assert.match(panel, /onSelectShaderEntry\(entry\)/)
  assert.match(panel, /onResetShaderEntry\(entry\)/)
  assert.match(panel, /t\('shader\.editEntry'\)/)
  assert.match(panel, /t\('shader\.removeEntry'\)/)
  assert.match(panel, /role: 'button'/)
  assert.match(panel, /event\.stopPropagation\(\)/)
  assert.match(panel, /shaderForm\?\.layerId === entry\.layerId/)
})

test('ViewerSurface：选中行打开工作台，✕ 只重置该层；active 列表带 id/params', () => {
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /shaderActive,\n\s+shaderForm,/)
  assert.match(viewer, /onSelectShaderEntry: \(entry\) => \{\n\s+workbench\.loadEntry\(entry\)\n\s+setShaderOpen\(true\)/)
  assert.match(viewer, /onResetShaderEntry: \(entry\) => \{\n\s+void workbench\.resetLayerFor\(entry\.layer\)/)
  const engine = readRepoFile('src/client/scene/shader-engine.js')
  assert.match(engine, /layer: entry\.layerName, layerId: entry\.layer\.id, preset: entry\.preset, params: \{ \.\.\.entry\.params \}/)
})
