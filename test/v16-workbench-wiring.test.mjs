/**
 * v1.6 Phase 2 — the shader workbench wiring lives in its own module.
 *
 * `src/client/ui/workbench-wiring.js` maps the workbench form to bridge calls:
 *   - chips toggle an ordered stack of 1..3 presets (never empty);
 *   - only parameters of selected presets become bridge args;
 *   - apply/reset show toasts and never throw into React.
 * Pure helpers are exercised directly; the factory is tested with fake deps.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildShaderFormArgs, createWorkbenchWiring, shaderStackLabel, toggleShaderPreset } from '../src/client/ui/workbench-wiring.js'

const t = (key, params) => (params && params.preset ? `${key}:${params.preset}` : key)
const form = (extra = {}) => ({ layerId: '', preset: 'height-false-color', minHeight: '', maxHeight: '', interval: '20', speed: '1', amplitude: '1', opacity: '0.75', waterHeight: '', depthMax: '', ...extra })

test('toggle：点选叠加最多 3 个、再点取消，且不允许清空到 0 个', () => {
  let state = form({ preset: 'contour' })
  state = toggleShaderPreset(state, 'scan')
  assert.deepEqual(state.preset, ['contour', 'scan'])
  state = toggleShaderPreset(state, 'water')
  assert.deepEqual(state.preset, ['contour', 'scan', 'water'])
  // 第四个被忽略（上限 3）。
  const capped = toggleShaderPreset(state, 'water-depth')
  assert.deepEqual(capped.preset, ['contour', 'scan', 'water'])
  // 取消一个回到字符串。
  const removed = toggleShaderPreset(state, 'scan')
  assert.deepEqual(removed.preset, ['contour', 'water'])
  // 唯一一个被点掉时保持原样。
  assert.deepEqual(toggleShaderPreset(form({ preset: 'contour' }), 'contour'), form({ preset: 'contour' }))
})

test('args：单预设发字符串，叠加发数组；只拼所选预设的参数', () => {
  assert.deepEqual(buildShaderFormArgs(form({ layerId: '', preset: 'contour' })), {
    action: 'apply',
    preset: 'contour',
    interval: 20,
  })
  assert.deepEqual(buildShaderFormArgs(form({ layerId: 'L1', preset: ['contour', 'scan'], interval: '40', speed: '2' })), {
    action: 'apply',
    preset: ['contour', 'scan'],
    layer: 'L1',
    interval: 40,
    speed: 2,
  })
  // water-depth 只带自己的参数；空字符串转成不传。
  assert.deepEqual(buildShaderFormArgs(form({ preset: 'water-depth', waterHeight: '320', depthMax: '' })), {
    action: 'apply',
    preset: 'water-depth',
    water_height: 320,
  })
  // 未选中的预设参数不得泄漏进 args（避免宿主跨预设拒绝）。
  const args = buildShaderFormArgs(form({ preset: 'contour', speed: '9', amplitude: '3', opacity: '0.2' }))
  assert.equal('speed' in args, false)
  assert.equal('amplitude' in args, false)
  assert.equal('opacity' in args, false)
})

test('label：单预设与叠加都显示成可读名字', () => {
  const translate = (key) => key.replace('shader.preset.', '')
  assert.equal(shaderStackLabel(translate, 'contour'), 'contour')
  assert.equal(shaderStackLabel(translate, ['contour', 'scan']), 'contour + scan')
})

test('factory：apply 调 bridge 并 toast 叠加名；失败只 toast 不抛', async () => {
  const calls = []
  const toasts = []
  const w = createWorkbenchWiring({
    getForm: () => form({ preset: ['contour', 'scan'], interval: '30', speed: '1' }),
    getLayers: () => [],
    setShaderForm: () => {},
    shaderCommand: async (args) => {
      calls.push(args)
      return { preset: ['contour', 'scan'], layer: 'L1' }
    },
    showToast: (text) => toasts.push(text),
    t,
  })
  await w.apply()
  assert.deepEqual(calls[0].preset, ['contour', 'scan'])
  assert.equal(calls[0].interval, 30)
  assert.ok(toasts[0].includes('contour') && toasts[0].includes('scan'), `toast 应包含叠加名：${toasts[0]}`)

  const failing = createWorkbenchWiring({
    getForm: () => form(),
    getLayers: () => [],
    setShaderForm: () => {},
    shaderCommand: async () => {
      throw new Error('shader: boom next: retry')
    },
    showToast: (text) => toasts.push(text),
    t,
  })
  await failing.apply()
  assert.equal(toasts[1], 'shader: boom next: retry')
})

test('factory：resetLayer 优先表单图层，否则最后一个可见图层；无图层时提示', async () => {
  const calls = []
  const toasts = []
  const layers = [
    { id: 'a', name: 'A', visible: true },
    { id: 'b', name: 'B', visible: true },
  ]
  const w = createWorkbenchWiring({
    getForm: () => form({ layerId: 'a' }),
    getLayers: () => layers,
    setShaderForm: () => {},
    shaderCommand: async (args) => {
      calls.push(args)
      return { layer: 'A' }
    },
    showToast: (text) => toasts.push(text),
    t,
  })
  await w.resetLayer()
  assert.deepEqual(calls[0], { action: 'reset', layer: 'a' })

  const last = createWorkbenchWiring({
    getForm: () => form({ layerId: '' }),
    getLayers: () => layers,
    setShaderForm: () => {},
    shaderCommand: async (args) => {
      calls.push(args)
      return { layer: 'B' }
    },
    showToast: (text) => toasts.push(text),
    t,
  })
  await last.resetLayer()
  assert.deepEqual(calls[1], { action: 'reset', layer: 'b' })

  const empty = createWorkbenchWiring({
    getForm: () => form(),
    getLayers: () => [],
    setShaderForm: () => {},
    shaderCommand: async () => {
      throw new Error('must not run')
    },
    showToast: (text) => toasts.push(text),
    t,
  })
  await empty.resetLayer()
  assert.equal(toasts[toasts.length - 1], 'shader.noLayers')

  await w.resetAll()
  assert.deepEqual(calls[2], { action: 'reset' })
})

test('factory：field/toggle 只通过 setShaderForm 更新表单', () => {
  let state = form({ preset: 'contour' })
  const w = createWorkbenchWiring({
    getForm: () => state,
    getLayers: () => [],
    setShaderForm: (updater) => {
      state = typeof updater === 'function' ? updater(state) : updater
    },
    shaderCommand: async () => ({}),
    showToast: () => {},
    t,
  })
  w.field('layerId', 'L9')
  assert.equal(state.layerId, 'L9')
  w.toggle('scan')
  assert.deepEqual(state.preset, ['contour', 'scan'])
})
