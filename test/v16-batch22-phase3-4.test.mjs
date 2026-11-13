/**
 * v16 batch 22 — Phase 3-4 tests:
 *   - Multi-layer visual effect (shader) consistency: eligible layer filtering,
 *     unified elevation range calculation, applyAll / syncEntryToAll wiring,
 *     ShaderWorkbench batch/row actions, and EffectsBody localized stack labels.
 *   - Imagery catalog curation & runtime tile reliability: 3 standalone defaults,
 *     retired blank stock preset cleanup on legacy sources.json (while keeping
 *     active selections or custom URLs), L4 coverage hint, and basemap errorEvent
 *     monitoring in ViewerSurface.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { normalizeConfig } = await import(new URL('../index.js', import.meta.url).href)
const { MESSAGES } = await import('../src/client/messages.js')
const {
  combinedShaderElevationRange,
  createWorkbenchWiring,
  eligibleShaderLayers,
  SHADER_FORM_DEFAULTS,
} = await import('../src/client/ui/workbench-wiring.js')
const { ShaderWorkbench } = await import('../src/client/ui/cards.js')
const { EffectsBody } = await import('../src/client/ui/tool-windows.js')
const { LayersMap } = await import('../src/client/ui/layers-map.js')
const { IMAGERY_OPEN_KEY, writePanelFlag } = await import('../src/client/ui/panel-prefs.js')
const { readRepoFile } = await import('./helpers/source.mjs')

const t = (key, params) =>
  params ? `${key}(${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',')})` : key

function withStorage(fn) {
  const store = new Map()
  const prev = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  try {
    return fn(store)
  } finally {
    if (prev === undefined) delete globalThis.localStorage
    else globalThis.localStorage = prev
  }
}

function createRenderer(rootFn, getProps) {
  const states = new Map()
  const refs = new Map()
  let rerender = null

  function renderComponent(Component, props, path) {
    let slot = 0
    const saved = {
      useState: React.useState,
      useRef: React.useRef,
      useCallback: React.useCallback,
      useMemo: React.useMemo,
      useEffect: React.useEffect,
    }
    React.useState = (initial) => {
      const key = `${path}#s${slot++}`
      if (!states.has(key)) states.set(key, typeof initial === 'function' ? initial() : initial)
      const setState = (next) => {
        const cur = states.get(key)
        states.set(key, typeof next === 'function' ? next(cur) : next)
        rerender?.()
      }
      return [states.get(key), setState]
    }
    React.useRef = (initial) => {
      const key = `${path}#r${slot++}`
      if (!refs.has(key)) refs.set(key, { current: initial })
      return refs.get(key)
    }
    React.useCallback = (fn) => fn
    React.useMemo = (fn) => fn()
    React.useEffect = () => {}
    try {
      return expand(Component(props), path)
    } finally {
      Object.assign(React, saved)
    }
  }

  function expand(node, path) {
    if (node == null || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map((item, idx) => expand(item, `${path}[${idx}]`))
    if (typeof node.type === 'function') {
      const props = { ...(node.props || {}), children: node.children }
      return renderComponent(node.type, props, `${path}/${node.type.name || 'Fn'}`)
    }
    const kids = node.children ?? node.props?.children
    if (kids !== undefined) {
      return { ...node, children: expand(kids, `${path}/${String(node.type)}`) }
    }
    return node
  }

  let tree = renderComponent(rootFn, getProps(), 'root')
  rerender = () => {
    tree = renderComponent(rootFn, getProps(), 'root')
  }
  return { tree: () => tree }
}

function findAll(node, predicate, out = []) {
  if (node == null) return out
  if (Array.isArray(node)) {
    for (const item of node) findAll(item, predicate, out)
    return out
  }
  if (typeof node !== 'object') return out
  if (predicate(node)) out.push(node)
  const kids = node.children ?? node.props?.children
  if (kids !== undefined) findAll(kids, predicate, out)
  return out
}

function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object') return textOf(node.children ?? node.props?.children)
  return ''
}

const makeLayer = (id, opts = {}) => ({
  id,
  name: opts.name ?? id.toUpperCase(),
  visible: opts.visible ?? true,
  kind: opts.kind ?? '3dtiles',
  tileset: opts.tileset ?? {},
})

test('eligibleShaderLayers 正确过滤隐藏图层与 3DGS 图层', () => {
  const splat = makeLayer('gs1', { kind: '3dgs' })
  const extSplat = makeLayer('gs2', { tileset: { extensionsUsed: ['KHR_gaussian_splatting'] } })
  const hidden = makeLayer('hid', { visible: false })
  const mesh1 = makeLayer('m1')
  const mesh2 = makeLayer('m2')
  const res = eligibleShaderLayers([mesh1, hidden, splat, mesh2, extSplat])
  assert.deepEqual(res.eligible.map((l) => l.id), ['m1', 'm2'])
  assert.equal(res.skippedHidden, 1)
  assert.equal(res.skippedGaussian, 2)
})

test('combinedShaderElevationRange 在多图层未锁定范围时合并真实包围高度，锁定则不覆盖', () => {
  const layers = [
    makeLayer('a', { tileset: { root: { boundingVolume: { minimumHeight: 12, maximumHeight: 45 } } } }),
    makeLayer('b', { tileset: { root: { boundingVolume: { minimumHeight: 5, maximumHeight: 110 } } } }),
  ]
  const rangeFn = (_Cesium, tileset) => ({
    minimum: tileset.root.boundingVolume.minimumHeight,
    maximum: tileset.root.boundingVolume.maximumHeight,
    bounds: true,
  })
  assert.deepEqual(
    combinedShaderElevationRange({}, layers, { ...SHADER_FORM_DEFAULTS, preset: 'height-false-color' }, rangeFn),
    { min_height: 5, max_height: 110 },
  )
  assert.equal(
    combinedShaderElevationRange({}, layers, { ...SHADER_FORM_DEFAULTS, minHeight: '0', maxHeight: '80' }, rangeFn),
    null,
    '用户显式填了范围时不应被自动合并覆盖',
  )
  assert.equal(
    combinedShaderElevationRange({}, layers, { ...SHADER_FORM_DEFAULTS, preset: 'scan' }, rangeFn),
    null,
  )
})

test('workbench.applyAll 与 syncEntryToAll 统一下发参数并跳过隐藏与 3DGS 图层', async () => {
  const calls = []
  const toasts = []
  let form = { ...SHADER_FORM_DEFAULTS, layerId: 'm1', preset: ['height-false-color', 'scan'], speed: '2' }
  const m1 = makeLayer('m1', { tileset: { root: { boundingVolume: { minimumHeight: 10, maximumHeight: 50 } } } })
  const m2 = makeLayer('m2', { tileset: { root: { boundingVolume: { minimumHeight: 30, maximumHeight: 120 } } } })
  const gs = makeLayer('gs', { kind: '3dgs' })
  const hid = makeLayer('hid', { visible: false })
  const CesiumStub = {
    Cartesian3: { fromDegrees: () => ({ x: 6378137, y: 0, z: 0 }) },
    Cartographic: { fromCartesian: () => ({ height: 20 }) },
  }

  const w = createWorkbenchWiring({
    getForm: () => form,
    getLayers: () => [m1, m2, gs, hid],
    setShaderForm: (u) => { form = typeof u === 'function' ? u(form) : u },
    shaderCommand: async (args) => {
      calls.push(args)
      return { preset: args.preset, layer: args.layer }
    },
    showToast: (msg) => toasts.push(msg),
    t,
    shaderCompare: async () => ({}),
    getScene: () => ({ Cesium: CesiumStub }),
  })

  const res = await w.applyAll()
  assert.equal(calls.length, 2)
  assert.deepEqual(res.applied, ['M1', 'M2'])
  assert.equal(res.skippedHidden, 1)
  assert.equal(res.skippedGaussian, 1)
  assert.equal(calls[0].min_height, 10)
  assert.equal(calls[0].max_height, 120)
  assert.equal(calls[1].min_height, 10)
  assert.equal(calls[1].max_height, 120)
  assert.equal(calls[0].layer, 'm1')
  assert.equal(calls[1].layer, 'm2')
  assert.match(toasts[0], /shaderSync\.doneSkipped\(/)

  calls.length = 0
  toasts.length = 0
  await w.syncEntryToAll({
    layerId: 'm2',
    layer: 'M2',
    preset: ['water', 'water-depth'],
    params: { speed: 1.5, amplitude: 2, opacity: 0.6, water_height: 18, depth_max: 40 },
  })
  assert.equal(form.layerId, 'm2')
  assert.deepEqual(form.preset, ['water', 'water-depth'])
  assert.equal(form.waterHeight, '18')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].water_height, 18)
  assert.equal(calls[1].water_height, 18)
})

test('workbench.applyAll 仅 3DGS 可见时提示 shaderSync.gaussianOnly', async () => {
  const toasts = []
  const w = createWorkbenchWiring({
    getForm: () => ({ ...SHADER_FORM_DEFAULTS }),
    getLayers: () => [makeLayer('gs', { kind: '3dgs' })],
    setShaderForm: () => {},
    shaderCommand: async () => assert.fail('不应执行应用'),
    showToast: (msg) => toasts.push(msg),
    t,
  })
  const res = await w.applyAll()
  assert.deepEqual(res.applied, [])
  assert.equal(toasts[0], 'shaderSync.gaussianOnly')
})

test('ShaderWorkbench 与 EffectsBody 渲染多图层同步、行操作与本地化叠层标签', () => {
  withStorage(() => {
    const syncCalls = []
    const loadCalls = []
    const resetCalls = []
    const tree = createRenderer(ShaderWorkbench, () => ({
      t,
      layers: [makeLayer('a'), makeLayer('b'), makeLayer('gs', { kind: '3dgs' })],
      form: { ...SHADER_FORM_DEFAULTS },
      active: [{ layerId: 'a', layer: 'A', preset: ['water', 'scan'], params: {} }],
      target: { layer: makeLayer('a'), auto: true },
      getScene: () => ({}),
      onClose: () => {},
      onLayer: () => {},
      onPreset: () => {},
      onPresetMove: () => {},
      onField: () => {},
      onPreview: () => {},
      onCompare: () => {},
      onApply: () => {},
      onApplyAll: () => syncCalls.push('all'),
      onLoadEntry: (e) => loadCalls.push(e.layerId),
      onSyncEntry: (e) => syncCalls.push(e.layerId),
      onResetEntry: (id) => resetCalls.push(id),
      onResetLayer: () => {},
      onResetAll: () => {},
    })).tree()

    const txt = textOf(tree)
    assert.ok(txt.includes('shaderSync.applyAllCount(n=2)'))
    assert.ok(txt.includes('shaderSync.skip3dgsHint(n=1)'))
    const buttons = findAll(tree, (n) => n.type === 'button')
    const applyAllBtn = buttons.find((b) => textOf(b).includes('shaderSync.applyAllCount'))
    assert.ok(applyAllBtn)
    applyAllBtn.props.onClick()
    const syncRowBtn = buttons.find((b) => b.props.title === 'shaderSync.syncRow')
    assert.ok(syncRowBtn)
    syncRowBtn.props.onClick()
    assert.deepEqual(syncCalls, ['all', 'a'])

    const loadBtn = buttons.find((b) => b.props.className === 'mv-shader-load')
    loadBtn.props.onClick()
    assert.deepEqual(loadCalls, ['a'])

    const resetRowBtn = findAll(tree, (n) => n.type === 'button' && n.props.title === 'shader.resetLayer' && textOf(n) === '✕')[0]
    assert.ok(resetRowBtn)
    resetRowBtn.props.onClick()
    assert.deepEqual(resetCalls, ['a'])
  })

  const effectsFallback = EffectsBody({
    t,
    shaderActive: [{ layerId: 'a', layer: 'A', preset: ['water', 'scan'] }],
    onOpenShader: () => {},
    onResetAllShaders: () => {},
  })
  assert.ok(textOf(effectsFallback).includes('water + scan'))
  assert.ok(textOf(effectsFallback).includes('shader.resetAll'))

  const zhT = (key) => MESSAGES.zh[key] ?? key
  const effectsLocalized = EffectsBody({
    t: zhT,
    shaderActive: [{ layerId: 'a', layer: 'A', preset: ['water', 'scan'] }],
    onOpenShader: () => {},
    onResetAllShaders: () => {},
  })
  assert.ok(textOf(effectsLocalized).includes(`${MESSAGES.zh['shader.preset.water']} + ${MESSAGES.zh['shader.preset.scan']}`))
})

test('sources catalog 精简至 3 项内置底图并兼容清理旧版空白 Esri 预设', () => {
  const fresh = normalizeConfig({})
  assert.deepEqual(fresh.imagery.map((s) => s.id), ['esri-world-imagery', 'esri-world-topo', 'esri-world-street'])
  assert.equal(fresh.settings.imagery, 'esri-world-imagery')

  // 旧版 7 项默认列表在升级后会自动移除未改 URL 的 4 项空白/山影底图。
  const upgraded = normalizeConfig({
    imagery: [
      { id: 'esri-world-imagery', name: 'Esri World Imagery', type: 'xyz', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
      { id: 'esri-world-topo', name: 'Esri World Topographic', type: 'arcgis', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer' },
      { id: 'esri-world-street', name: 'Esri World Street Map', type: 'arcgis', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer' },
      { id: 'esri-light-gray', name: 'Esri Light Gray Canvas', type: 'arcgis', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer' },
      { id: 'esri-shaded-relief', name: 'Esri World Shaded Relief', type: 'arcgis', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer' },
      { id: 'esri-world-ocean', name: 'Esri World Ocean', type: 'arcgis', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer' },
      { id: 'esri-world-hillshade', name: 'Esri World Hillshade', type: 'arcgis', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer' },
      { id: 'custom-wmts', name: 'Custom Imagery', type: 'xyz', url: 'https://example.com/{z}/{x}/{y}.png' },
    ],
    settings: { imagery: 'esri-world-imagery' },
  })
  assert.deepEqual(upgraded.imagery.map((s) => s.id), ['esri-world-imagery', 'esri-world-topo', 'esri-world-street', 'custom-wmts'])

  // 若旧会话当前正激活着某个已淘汰预设，或用户自定义了 URL，必须保留不破坏兼容性。
  const activeLegacy = normalizeConfig({
    imagery: [
      { id: 'esri-light-gray', name: 'Gray', type: 'arcgis', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer' },
      { id: 'esri-world-ocean', name: 'Mirror Ocean', type: 'arcgis', url: 'https://mirror.example.com/Ocean/MapServer' },
    ],
    settings: { imagery: 'esri-light-gray' },
  })
  assert.ok(activeLegacy.imagery.some((s) => s.id === 'esri-light-gray'))
  assert.ok(activeLegacy.imagery.some((s) => s.id === 'esri-world-ocean'))
  assert.equal(activeLegacy.settings.imagery, 'esri-light-gray')
})

test('LayersMap 展开底图列表时展示高缩放覆盖说明，ViewerSurface 监听 tile errorEvent', () => {
  withStorage(() => {
    writePanelFlag(IMAGERY_OPEN_KEY, true)
    const tree = createRenderer(LayersMap, () => ({
      t,
      config: { imagery: [{ id: 'esri-world-imagery', name: 'Esri World Imagery' }] },
      settings: { imagery: 'esri-world-imagery' },
      onSelectImagery: () => {},
      onOverlayAdd: () => {},
      onOverlayRemove: () => {},
      onOverlayOpacity: () => {},
      onOverlayVisible: () => {},
      onOverlayMove: () => {},
      onImportVector: () => {},
      onPickLocalTiles: () => {},
    })).tree()
    assert.ok(textOf(tree).includes('layers.imageryCoverageHint'))
  })

  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /provider\.errorEvent\?\.addEventListener/)
  assert.match(viewer, /toast\.basemapTilesWarn/)
  assert.match(viewer, /imageryErrorUnsubRef\.current\?\.\(\)/)
})

test('Phase 3-4 新增 i18n 键值中英文对齐', () => {
  for (const key of [
    'layers.imageryCoverageHint',
    'toast.basemapTilesWarn',
    'shaderSync.applyAll',
    'shaderSync.applyAllCount',
    'shaderSync.applyAllHint',
    'shaderSync.syncRow',
    'shaderSync.loadRow',
    'shaderSync.skip3dgsHint',
    'shaderSync.gaussianOnly',
    'shaderSync.done',
    'shaderSync.doneSkipped',
    'shaderSync.partial',
  ]) {
    assert.ok(typeof MESSAGES.zh[key] === 'string' && MESSAGES.zh[key].length > 0, `缺少 zh.${key}`)
    assert.ok(typeof MESSAGES.en[key] === 'string' && MESSAGES.en[key].length > 0, `缺少 en.${key}`)
  }
})
