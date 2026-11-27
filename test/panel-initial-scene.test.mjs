/**
 * Panel initial-scene initialization tests:
 *   - Explicit view (oblique pitch/heading) + whitelisted raster layers
 *   - Validation, per-entry ignore receipts, and default-basemap fallback
 *   - Isolation from historical 3D Tiles / 3DGS / vector annotations / analysis / shaders
 *   - Idempotent repeat opens (focus existing tab, no duplicate instances)
 *   - Backward compatibility when opened without scene parameters (1.5.2 behavior)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import {
  applyInitialSceneToViewer,
  buildInitialRasterCatalog,
  createInitialSceneCoordinator,
  DEFAULT_INITIAL_HEIGHT,
  DEFAULT_OBLIQUE_PITCH,
  extractInitialSceneParam,
  isSceneOpenOptions,
  normalizeInitialScene,
} from '../src/client/scene/initial-scene.js'
import { createOverlayLayers } from '../src/client/scene/overlay-layers.js'
import { readRepoFile } from './helpers/source.mjs'

const DEFAULT_CATALOG = {
  imagery: [
    {
      id: 'esri-world-imagery',
      name: 'Esri World Imagery',
      type: 'xyz',
      url: 'https://wi.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      tilingScheme: 'geographic',
      maximumLevel: 19,
    },
    {
      id: 'esri-world-topo',
      name: 'Esri World Topographic',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
    },
  ],
  terrain: [
    {
      id: 'arcgis-world-elevation',
      name: 'ArcGIS WorldElevation3D',
      type: 'arcgis',
      url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
    },
  ],
  rasterOverlays: [
    {
      id: 'preexisting-global-overlay',
      name: 'Preexisting Overlay',
      type: 'xyz',
      url: 'https://example.test/old/{z}/{x}/{y}.png',
      opacity: 0.8,
      visible: true,
    },
  ],
  settings: {
    theme: 'auto',
    imagery: 'esri-world-imagery',
    terrain: 'arcgis-world-elevation',
  },
}

function makeFakeCesium() {
  return {
    Cartesian3: {
      fromDegrees: (lon, lat, height) => ({ lon, lat, height }),
    },
    Math: {
      toRadians: (deg) => (deg * Math.PI) / 180,
    },
    EllipsoidTerrainProvider: class EllipsoidTerrainProvider {},
  }
}

function makeFakeViewer() {
  const imageryLayers = []
  const primitives = []
  let lastView = null
  const collection = {
    addImageryProvider(provider, index) {
      const layer = { provider, alpha: 1, show: true, destroyed: false }
      const at = index === undefined ? imageryLayers.length : index
      imageryLayers.splice(at, 0, layer)
      collection.length = imageryLayers.length
      return layer
    },
    remove(layer, destroy) {
      const idx = imageryLayers.indexOf(layer)
      if (idx >= 0) imageryLayers.splice(idx, 1)
      if (destroy) layer.destroyed = true
      collection.length = imageryLayers.length
    },
    length: 0,
  }
  return {
    imageryLayers,
    primitives,
    get lastView() {
      return lastView
    },
    terrainProvider: { kind: 'custom-terrain' },
    camera: {
      setView(opts) {
        lastView = opts
      },
    },
    scene: {
      imageryLayers: collection,
      primitives: {
        add: (p) => primitives.push(p),
        remove: (p) => {
          const idx = primitives.indexOf(p)
          if (idx >= 0) primitives.splice(idx, 1)
        },
      },
    },
  }
}

// ---------------------------------------------------------------------------
// 1. Normalization, validation, degradation & receipts
// ---------------------------------------------------------------------------

test('规范化：view 倾斜视角定位 + 栅格 layers 对象形态（底图 + 叠加层）', () => {
  const res = normalizeInitialScene({
    sessionId: 'sess-1',
    view: { lon: 114.364, lat: 30.536, height: 1200, heading: 45, pitch: -35 },
    layers: {
      imagery: {
        id: 'custom-basemap',
        name: 'Custom XYZ',
        type: 'xyz',
        url: 'https://tiles.example.test/{z}/{x}/{y}.png',
        maximumLevel: 18,
      },
      rasterOverlays: [
        {
          id: 'flood-wms',
          name: 'Flood Risk',
          type: 'wms',
          url: 'https://geo.example.test/wms',
          layers: 'risk:flood',
          opacity: 0.65,
        },
      ],
    },
    replaceScene: true,
  })
  assert.equal(res.active, true)
  assert.equal(res.sessionId, 'sess-1')
  assert.equal(res.rasterOnly, true)
  assert.equal(res.replaceScene, true)
  assert.equal(res.skipSnapshot, true)
  assert.equal(res.fallbackBasemap, false)
  assert.deepEqual(res.ignored, [])
  assert.deepEqual(res.view, { lon: 114.364, lat: 30.536, height: 1200, heading: 45, pitch: -35 })
  assert.equal(res.layers.imagery.id, 'custom-basemap')
  assert.equal(res.layers.imagery.type, 'xyz')
  assert.equal(res.layers.rasterOverlays.length, 1)
  assert.equal(res.layers.rasterOverlays[0].opacity, 0.65)
  assert.equal(res.layers.rasterOverlays[0].visible, true)
})

test('规范化：view 缺省 pitch/height/heading 时使用倾斜视角默认值', () => {
  const res = normalizeInitialScene({ view: { lon: 114.3, lat: 30.5 } })
  assert.equal(res.active, true)
  assert.deepEqual(res.view, {
    lon: 114.3,
    lat: 30.5,
    height: DEFAULT_INITIAL_HEIGHT,
    heading: 0,
    pitch: DEFAULT_OBLIQUE_PITCH,
  })
  assert.ok(res.view.pitch <= -30 && res.view.pitch >= -60, '默认 pitch 应在 -30°~-60° 倾斜视角区间')
  assert.deepEqual(res.ignored, [])
})

test('校验与降级：非法坐标、未知图层类型、缺 url、非法协议逐条忽略并回执原因，不崩溃', () => {
  const res = normalizeInitialScene({
    view: { lon: 220, lat: -95, height: -5, pitch: 25, heading: 'bad' },
    layers: {
      imagery: { id: 'bad-base', type: '3dtiles', url: 'https://example.test/tileset.json' },
      rasterOverlays: [
        { id: 'bad-type', type: '3dgs', url: 'https://example.test/splat.spz' },
        { id: 'no-url', type: 'xyz' },
        { id: 'bad-scheme', type: 'wms', url: 'javascript:alert(1)' },
        null,
        { id: 'good-wms', name: 'Valid WMS', type: 'wms', url: 'https://example.test/wms', layers: 'l1', opacity: 0.5 },
      ],
    },
  })

  assert.equal(res.active, true)
  assert.equal(res.view, null)
  assert.equal(res.layers.imagery, null)
  assert.equal(res.fallbackBasemap, true, '底图非法时必须降级保留默认底图，不留黑屏')
  assert.deepEqual(
    res.layers.rasterOverlays.map((item) => item.id),
    ['good-wms'],
  )

  const reasons = new Map(res.ignored.map((item) => [item.target, item.reason]))
  assert.equal(reasons.get('view.lon'), 'invalid_coordinates')
  assert.equal(reasons.get('view.lat'), 'invalid_coordinates')
  assert.equal(reasons.get('layers.imagery'), 'unknown_layer_type')
  assert.equal(reasons.get('layers.rasterOverlays[0]'), 'unknown_layer_type')
  assert.equal(reasons.get('layers.rasterOverlays[1]'), 'missing_url')
  assert.equal(reasons.get('layers.rasterOverlays[2]'), 'invalid_url')
  assert.equal(reasons.get('layers.rasterOverlays[3]'), 'invalid_entry')
})

test('校验与降级：layers 为空数组或全非法时保留默认底图，不留黑屏', () => {
  const emptyArr = normalizeInitialScene({ layers: [] })
  assert.equal(emptyArr.active, true)
  assert.equal(emptyArr.rasterOnly, true)
  assert.equal(emptyArr.fallbackBasemap, true)
  assert.equal(emptyArr.layers.imagery, null)
  assert.deepEqual(emptyArr.layers.rasterOverlays, [])

  const plan = buildInitialRasterCatalog(DEFAULT_CATALOG, DEFAULT_CATALOG, emptyArr)
  assert.equal(plan.fallbackBasemap, true)
  assert.equal(plan.activeImageryId, 'esri-world-imagery')
  assert.deepEqual(plan.rasterOverlays, [])
  assert.equal(plan.config.settings.terrain, null)
  // Original persisted catalog must remain untouched.
  assert.equal(DEFAULT_CATALOG.rasterOverlays.length, 1)
  assert.equal(DEFAULT_CATALOG.settings.terrain, 'arcgis-world-elevation')
})

test('规范化：扁平数组 layers 简写（支持 role 与去重）及超量截断回执', () => {
  const many = [
    { id: 'base', type: 'xyz', url: 'https://example.test/base/{z}/{x}/{y}.png' },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: i < 2 ? 'dup' : `ov-${i}`,
      role: 'overlay',
      type: 'arcgis',
      url: `https://example.test/arcgis/${i}/MapServer`,
    })),
  ]
  const res = normalizeInitialScene({ layers: many })
  assert.equal(res.layers.imagery.id, 'base')
  // v1.9: the raster-overlay cap is 24 (local GeoTIFF pyramids are overlays too),
  // so 10 entries all fit and nothing is truncated here.
  assert.equal(res.layers.rasterOverlays.length, 10)
  assert.equal(new Set(res.layers.rasterOverlays.map((item) => item.id)).size, 10)
  assert.equal(res.ignored.filter((item) => item.reason === 'max_overlays_exceeded').length, 0)
})

test('可序列化参数提取：支持 JSON 字符串、tabProps.params、useTabInfo()', () => {
  const rawJson = JSON.stringify({ view: { lon: 114.3, lat: 30.5, pitch: -40 }, layers: [] })
  const fromProps = extractInitialSceneParam({ params: { initialScene: rawJson } })
  assert.deepEqual(fromProps.view, { lon: 114.3, lat: 30.5, pitch: -40 })

  const fromTabInfo = extractInitialSceneParam({ sessionId: 's1' }, { tab: { params: { view: { lon: 116.4, lat: 39.9 } } } })
  assert.deepEqual(fromTabInfo.view, { lon: 116.4, lat: 39.9 })

  const normFromString = normalizeInitialScene(rawJson, 'sess-json')
  assert.equal(normFromString.sessionId, 'sess-json')
  assert.equal(normFromString.view.pitch, -40)
})

test('向后兼容识别：isSceneOpenOptions 区分无参/sessionId/点击事件与显式场景入参', () => {
  assert.equal(isSceneOpenOptions(undefined), false)
  assert.equal(isSceneOpenOptions(null), false)
  assert.equal(isSceneOpenOptions('session-123'), false)
  assert.equal(isSceneOpenOptions({ preventDefault() {}, target: {} }), false)
  assert.equal(isSceneOpenOptions({ nativeEvent: {} }), false)
  assert.equal(isSceneOpenOptions({ sessionId: 'session-123' }), false)
  assert.equal(isSceneOpenOptions({ view: { lon: 114, lat: 30 } }), true)
  assert.equal(isSceneOpenOptions({ layers: [] }), true)
  assert.equal(isSceneOpenOptions({ replaceScene: true }), true)
})

// ---------------------------------------------------------------------------
// 2. Viewer application: oblique view, whitelisted raster only, clear 3D state
// ---------------------------------------------------------------------------

test('场景应用：view + 栅格 layers 打开时清理历史 3D/标注/分析/着色器，仅渲染白名单图层并应用倾斜相机', async () => {
  const Cesium = makeFakeCesium()
  const viewer = makeFakeViewer()
  const stack = createOverlayLayers({
    Cesium,
    viewer,
    providerFactory: async (_C, src) => ({ url: src.url, type: src.type }),
  })
  // Simulate pre-existing global overlay + 3D tileset + annotations + analysis + shader
  await stack.sync(DEFAULT_CATALOG.rasterOverlays)
  assert.equal(stack.size(), 1)
  let clearedLive = 0
  let inMemorySources = DEFAULT_CATALOG
  const appliedImageryIds = []

  const normalized = normalizeInitialScene({
    view: { lon: 114.36, lat: 30.54, height: 900, heading: 120, pitch: -50 },
    layers: {
      imagery: { id: 'satellite-custom', type: 'xyz', url: 'https://sat.example.test/{z}/{x}/{y}.jpg' },
      rasterOverlays: [
        { id: 'only-this-overlay', type: 'wms', url: 'https://wms.example.test/ows', layers: 'water', opacity: 0.7 },
      ],
    },
    replaceScene: true,
  })

  const outcome = await applyInitialSceneToViewer(
    {
      Cesium,
      viewer,
      baseConfig: DEFAULT_CATALOG,
      defaultsConfig: DEFAULT_CATALOG,
      setRestoring: () => {},
      clearLiveScene: () => {
        clearedLive += 1
      },
      setInMemorySources: (cfg) => {
        inMemorySources = cfg
      },
      applyImagery: async (id) => {
        appliedImageryIds.push(id)
        return { ok: true }
      },
      syncOverlays: (list) => stack.sync(list),
      clearTerrain: () => {
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
      },
      markApplied: () => {},
    },
    normalized,
  )

  assert.equal(outcome.applied, true)
  assert.equal(outcome.fallbackBasemap, false)
  assert.equal(clearedLive, 1, '必须清理既有 3D Tiles / 标注 / 分析 / 着色器')
  assert.deepEqual(appliedImageryIds, ['satellite-custom'])
  assert.deepEqual(
    stack.list().map((item) => item.id),
    ['only-this-overlay'],
    '全局目录中未在白名单内的旧叠加层不得保留',
  )
  assert.equal(inMemorySources.settings.imagery, 'satellite-custom')
  assert.equal(inMemorySources.settings.terrain, null)
  assert.ok(viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider)
  assert.deepEqual(viewer.lastView.destination, { lon: 114.36, lat: 30.54, height: 900 })
  assert.ok(Math.abs(viewer.lastView.orientation.heading - (120 * Math.PI) / 180) < 1e-9)
  assert.ok(Math.abs(viewer.lastView.orientation.pitch - (-50 * Math.PI) / 180) < 1e-9)
})

test('场景应用：自定义底图运行时加载失败时自动降级到默认底图，不留黑屏', async () => {
  const Cesium = makeFakeCesium()
  const viewer = makeFakeViewer()
  const tried = []
  const normalized = normalizeInitialScene({
    layers: { imagery: { id: 'broken-base', type: 'xyz', url: 'https://down.example.test/{z}/{x}/{y}.png' } },
  })
  const outcome = await applyInitialSceneToViewer(
    {
      Cesium,
      viewer,
      baseConfig: DEFAULT_CATALOG,
      defaultsConfig: DEFAULT_CATALOG,
      applyImagery: async (id) => {
        tried.push(id)
        return id === 'broken-base' ? { ok: false, error: 'timeout' } : { ok: true }
      },
      syncOverlays: async () => {},
    },
    normalized,
  )
  assert.equal(outcome.fallbackBasemap, true)
  assert.deepEqual(tried, ['broken-base', 'esri-world-imagery'])
})

// ---------------------------------------------------------------------------
// 3. Coordinator: cold mount, warm re-open, idempotency & stale 3D prevention
// ---------------------------------------------------------------------------

test('幂等与热重开：同一参数重复打开仅聚焦不重刷；若中途加载了 3D/标注则再次打开会清空，不带出历史 3D 内容', () => {
  const coordinator = createInitialSceneCoordinator()
  let focusCalls = 0
  let applyCalls = 0
  let lastSig = ''
  let has3DContent = false

  const openFn = () => {
    focusCalls += 1
    return true
  }

  const params = {
    sessionId: 'sess-idem',
    view: { lon: 114.35, lat: 30.53, height: 1000, heading: 30, pitch: -45 },
    layers: [{ id: 'base', type: 'xyz', url: 'https://example.test/{z}/{x}/{y}.png' }],
    replaceScene: true,
  }

  // Cold open: queued for mount
  const first = coordinator.dispatch(params, openFn)
  assert.equal(first.ok, true)
  assert.equal(first.opened, true)
  assert.equal(first.reused, false)
  assert.equal(focusCalls, 1)

  const consumed = coordinator.consumePending('sess-idem')
  assert.ok(consumed !== null && consumed.active)
  lastSig = consumed.signature

  // Viewer mounts and registers controller
  const dispose = coordinator.registerViewer({
    getSessionId: () => 'sess-idem',
    isIdempotentMatch: (sig) => sig !== '' && sig === lastSig && !has3DContent,
    apply: (norm) => {
      applyCalls += 1
      has3DContent = false
      lastSig = norm.signature
    },
  })

  // Repeat open with identical params while clean -> idempotent focus only
  const second = coordinator.dispatch(params, openFn)
  assert.equal(second.reused, true)
  assert.equal(focusCalls, 2)
  assert.equal(applyCalls, 0, '同参数重复打开且场景干净时不得重复重载图层')

  // User/previous session had 3D Tiles or annotations -> re-opening with same params must clear them
  has3DContent = true
  const third = coordinator.dispatch(params, openFn)
  assert.equal(third.reused, false)
  assert.equal(focusCalls, 3)
  assert.equal(applyCalls, 1, '存在历史 3D/标注时再次以同一参数打开必须清理，不得带出')
  assert.equal(has3DContent, false)

  dispose()
})

// ---------------------------------------------------------------------------
// 4. Wiring & client bundle exports + backward compatibility
// ---------------------------------------------------------------------------

test('接线与产物：client.js 导出显式入口，plugin/layout/ViewerSurface 透传且不破坏无参 1.5.2 路径', () => {
  const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  const registrations = []
  const win = {
    __ModuleLoader__: { load: (reg) => registrations.push(reg) },
  }
  const sandbox = {
    window: win,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => 0 },
    URL,
  }
  vm.runInNewContext(code, sandbox, { filename: 'client.js' })
  const exported = registrations[0].factory((id) => {
    if (id === 'react') {
      return {
        createElement: (type, props) => ({ type, props }),
        useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
        useEffect: () => {},
        useRef: (v) => ({ current: v }),
        useMemo: (f) => f(),
        useCallback: (f) => f,
        Fragment: Symbol('Fragment'),
      }
    }
    throw new Error(`unexpected require(${id})`)
  })
  assert.equal(typeof exported.openEarthPanel, 'function')
  assert.equal(typeof exported.openEarthPanelWithScene, 'function')
  assert.equal(typeof exported.normalizeInitialScene, 'function')

  // Verify plugin registers window.__dshDigitalEarth__ and forwards initialScene in registerTab
  const registeredTabs = []
  const disposers = []
  const fakeCtx = {
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    inject: (deps, cb) => {
      if (deps.includes('betterSidebar')) {
        cb({
          effect: (fn) => fn(),
          betterSidebar: { registerTab: (tab) => registeredTabs.push(tab) },
        })
      }
    },
    locale: { register: () => {}, bind: () => (k) => k },
    slots: { inject: () => {}, register: () => {} },
    get: () => undefined,
  }
  exported.apply(fakeCtx)
  assert.equal(typeof win.__dshDigitalEarth__?.openPanel, 'function')
  assert.equal(typeof win.__dshDigitalEarth__?.openWithScene, 'function')
  assert.equal(registeredTabs.length, 1)
  const el = registeredTabs[0].component({
    scope: { sessionId: 's-tab' },
    params: { initialScene: { view: { lon: 114.3, lat: 30.5, pitch: -45 }, layers: [], replaceScene: true } },
  })
  assert.equal(el.props.sessionId, 's-tab')
  assert.deepEqual(el.props.initialScene.view, { lon: 114.3, lat: 30.5, pitch: -45 })

  // Hot-reload cleanup removes the handle
  for (const d of disposers) d()
  assert.equal(win.__dshDigitalEarth__, undefined)

  // Backward compatibility checks on source files
  const layout = readRepoFile('src/client/ui/layout.js')
  assert.match(layout, /extractInitialSceneParam/)
  assert.match(layout, /initialScene/)
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /applyInitialSceneToViewer/)
  assert.match(viewer, /bootScene\?\.skipSnapshot/)
})
