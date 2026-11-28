/**
 * Multi-period imagery time dimension (raster-time) end-to-end test suite:
 *   1. Host catalog normalization & strict boundary rejection (`frames` / `times` / combined)
 *   2. Client provider mapping (XYZ/ArcGIS `{time}` template + WMS `TIME` parameter)
 *   3. Overlay stack in-place frame switching (Z-order, alpha, visibility, swipe, coalescing)
 *   4. Session snapshot persistence & backward compatibility with legacy snapshots
 *   5. Agent `earth_scene status` & `action: 'frame'` validation + UI/scene sync
 *   6. UI component rendering (`RasterTimeline`, `LayersSurface`) & i18n separation from Sun timeline
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

register(new URL('./helpers/react-stub-loader.mjs', import.meta.url))

import { cleanTimeString, isValidTimeString, normalizeTemporalImagery } from '../src/host/raster-time.js'
import { normalizeSceneRequest } from '../src/host/tools/scene.js'
import { createOverlayLayers, normalizeOverlayDraft } from '../src/client/scene/overlay-layers.js'
import { createRasterFrameController } from '../src/client/scene/raster-frame-controller.js'
import {
  describeRasterFrames,
  findFrameIndex,
  hasRasterTimeline,
  parseTemporalDraft,
  resolveFrameSource,
  resolveSourceFrames,
} from '../src/client/scene/raster-time.js'
import { createSceneStatus } from '../src/client/scene/status.js'
import { createCommandBridge } from '../src/client/scene/command-bridge.js'
import { createSwipeSession } from '../src/client/scene/swipe.js'
import { normalizeSceneSnapshot, readSceneSnapshot, SCENE_STORE_VERSION, writeSceneSnapshot } from '../src/client/scene-store.js'
import { RASTER_TIME_MESSAGES } from '../src/client/messages-raster-time.js'
import { clientSource } from './helpers/source.mjs'

const { imageryProvider } = await import('../src/client/api.js')
const { RasterTimeline } = await import('../src/client/ui/raster-timeline.js')

const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-rtime-'))
process.env.DSH_HOME = home
const { normalizeConfig } = await import(new URL('../index.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

/** Minimal Cesium.ImageryLayerCollection stand-in supporting indexOf + indexed insert. */
function fakeViewer() {
  const layers = []
  const renders = { count: 0 }
  const collection = {
    addImageryProvider(provider, index) {
      const layer = { provider, alpha: 1, show: true, splitDirection: 0, destroyed: false }
      const at = index === undefined ? layers.length : index
      layers.splice(at, 0, layer)
      collection.length = layers.length
      return layer
    },
    indexOf(layer) {
      return layers.indexOf(layer)
    },
    remove(layer, destroy) {
      const index = layers.indexOf(layer)
      if (index >= 0) layers.splice(index, 1)
      if (destroy) layer.destroyed = true
      collection.length = layers.length
    },
    raiseToTop(layer) {
      const index = layers.indexOf(layer)
      if (index >= 0) {
        layers.splice(index, 1)
        layers.push(layer)
      }
    },
    get(index) {
      return layers[index]
    },
    length: 0,
  }
  return {
    layers,
    renders,
    scene: {
      imageryLayers: collection,
      splitPosition: 0.5,
      requestRender: () => {
        renders.count += 1
      },
    },
  }
}

const FLOOD_FRAMES_OVERLAY = {
  id: 'flood-6',
  name: '流域洪水 6 期',
  type: 'xyz',
  frames: [
    { label: '灾前基线', url: 'https://tiles.example.test/flood/pre/{z}/{x}/{y}.png', time: '2026-07-01' },
    { label: '起涨期', url: 'https://tiles.example.test/flood/rise/{z}/{x}/{y}.png', time: '2026-07-03' },
    { label: '洪峰', url: 'https://tiles.example.test/flood/peak/{z}/{x}/{y}.png', time: '2026-07-05' },
    { label: '缓退期', url: 'https://tiles.example.test/flood/recede1/{z}/{x}/{y}.png', time: '2026-07-08' },
    { label: '退水期', url: 'https://tiles.example.test/flood/recede2/{z}/{x}/{y}.png', time: '2026-07-11' },
    { label: '灾后恢复', url: 'https://tiles.example.test/flood/post/{z}/{x}/{y}.png', time: '2026-07-15' },
  ],
  opacity: 0.8,
  visible: true,
}

// ---------------------------------------------------------------------------
// 1. Host model & boundary validation
// ---------------------------------------------------------------------------

test('时间字符串校验：接受合法 ISO 子集，拒绝非法日历日期与注入字符', () => {
  for (const valid of ['2024', '2026-07', '2026-07-01', '2024-02-29', '2026-07-01T08:30:00Z', '2026-07-01T08:30:00+08:00', '2026-07-01T08:30:00.250Z']) {
    assert.equal(isValidTimeString(valid), true, `应接受 ${valid}`)
    assert.equal(cleanTimeString(` ${valid} `), valid)
  }
  for (const invalid of ['', '2026-02-30', '2023-02-29', '2026-13-01', '2026-00-10', '2026-07-01T25:00:00Z', '2026-07-01&foo=bar', '2026/07/01', '../etc', '2026-07-01\r\nX:1', 20260701, null]) {
    assert.equal(isValidTimeString(invalid), false, `应拒绝 ${String(invalid)}`)
  }
})

test('Host catalog：支持 frames、times 模板、WMS times 以及 frames+times 组合', () => {
  const config = normalizeConfig({
    rasterOverlays: [
      FLOOD_FRAMES_OVERLAY,
      {
        id: 'monthly-xyz',
        name: '月度合成',
        type: 'xyz',
        url: 'https://tiles.example.test/{time}/{z}/{x}/{y}.png',
        times: ['2026-01', '2026-02', '2026-03'],
        opacity: 0.7,
      },
      {
        id: 'flood-wms',
        name: '洪水 WMS',
        type: 'wms',
        url: 'https://wms.example.test/geoserver/wms',
        layers: 'basin:flood',
        times: ['2026-07-01', '2026-07-05'],
      },
      {
        id: 'paired',
        name: '组合模式',
        type: 'arcgis',
        frames: [
          { label: '一期', url: 'https://gis.example.test/MapServer_1' },
          { label: '二期', url: 'https://gis.example.test/MapServer_2' },
        ],
        times: ['2025', '2026'],
      },
    ],
  })

  assert.deepEqual(config.rasterOverlays.map((o) => o.id), ['flood-6', 'monthly-xyz', 'flood-wms', 'paired'])
  // Parent url derived from frames[0].url when omitted
  assert.equal(config.rasterOverlays[0].url, FLOOD_FRAMES_OVERLAY.frames[0].url)
  assert.equal(config.rasterOverlays[0].frames.length, 6)
  assert.deepEqual(config.rasterOverlays[1].times, ['2026-01', '2026-02', '2026-03'])
  assert.deepEqual(config.rasterOverlays[2].times, ['2026-07-01', '2026-07-05'])
  assert.equal(config.rasterOverlays[3].frames.length, 2)
  assert.deepEqual(config.rasterOverlays[3].times, ['2025', '2026'])
  // Round-trip stability
  assert.deepEqual(normalizeConfig(config).rasterOverlays, config.rasterOverlays)
})

test('Host catalog 边界：帧数超 60、非法时间、非法 URL、缺 {time} 等明确拒绝该条目，不影响其他图层', () => {
  const over60 = Array.from({ length: 61 }, (_, i) => `20${String(10 + Math.floor(i / 12)).padStart(2, '0')}-${String((i % 12) + 1).padStart(2, '0')}`)
  const config = normalizeConfig({
    rasterOverlays: [
      { id: 'valid-plain', name: '普通层', type: 'xyz', url: 'https://example.test/{z}/{x}/{y}.png' },
      { id: 'too-many-times', name: '超限', type: 'wms', url: 'https://example.test/wms', layers: 'a', times: over60 },
      {
        id: 'too-many-frames',
        name: '超限帧',
        type: 'xyz',
        frames: Array.from({ length: 61 }, (_, i) => ({ label: `f${i}`, url: `https://example.test/${i}/{z}/{x}/{y}.png` })),
      },
      { id: 'bad-time', name: '非法日期', type: 'wms', url: 'https://example.test/wms', layers: 'a', times: ['2026-02-30', '2026-07-01'] },
      { id: 'empty-times', name: '空数组', type: 'wms', url: 'https://example.test/wms', layers: 'a', times: [] },
      { id: 'no-placeholder', name: '缺占位符', type: 'xyz', url: 'https://example.test/{z}/{x}/{y}.png', times: ['2025', '2026'] },
      { id: 'bad-scheme', name: '非法协议', type: 'xyz', frames: [{ label: 'x', url: 'javascript:alert(1)' }] },
      { id: 'mismatch-len', name: '长度不等', type: 'xyz', frames: [{ label: 'a', url: 'https://example.test/a/{z}/{x}/{y}.png' }], times: ['2025', '2026'] },
      { id: 'valid-temporal', name: '有效多期', type: 'wms', url: 'https://example.test/wms', layers: 'ok', times: ['2025', '2026'] },
    ],
  })
  assert.deepEqual(config.rasterOverlays.map((o) => o.id), ['valid-plain', 'valid-temporal'])
  // Plain layer stays untouched with zero temporal keys
  assert.deepEqual(Object.keys(config.rasterOverlays[0]).sort(), ['id', 'name', 'opacity', 'type', 'url', 'visible'])
  assert.equal(normalizeTemporalImagery({ type: 'xyz', url: 'https://example.test/{z}/{x}/{y}.png' }, 'xyz').ok, true)
})

// ---------------------------------------------------------------------------
// 2. Client provider mapping (XYZ/ArcGIS template + WMS TIME)
// ---------------------------------------------------------------------------

test('imageryProvider：WMS 下发 TIME 参数，XYZ/ArcGIS 替换 {time} 占位符', async () => {
  const captured = {}
  const fakeCesium = {
    WebMapServiceImageryProvider: class {
      constructor(opts) {
        captured.wms = opts
      }
    },
    UrlTemplateImageryProvider: class {
      constructor(opts) {
        captured.xyz = opts
      }
    },
    ArcGisMapServerImageryProvider: {
      fromUrl: async (url, opts) => {
        captured.arcgis = { url, opts }
        return { url }
      },
    },
  }

  const wmsSource = { id: 'w', name: 'W', type: 'wms', url: 'https://wms.test/service', layers: 'flood', times: ['2026-07-01', '2026-07-05'] }
  await imageryProvider(fakeCesium, resolveFrameSource(wmsSource, 1))
  assert.equal(captured.wms.parameters.TIME, '2026-07-05')
  assert.equal(captured.wms.layers, 'flood')

  // Plain WMS does not inject TIME
  await imageryProvider(fakeCesium, { id: 'w0', name: 'W0', type: 'wms', url: 'https://wms.test/service', layers: 'base' })
  assert.equal('TIME' in captured.wms.parameters, false)

  const xyzSource = { id: 'x', name: 'X', type: 'xyz', url: 'https://tiles.test/{time}/{z}/{x}/{y}.png', times: ['2026-01', '2026-06'] }
  await imageryProvider(fakeCesium, resolveFrameSource(xyzSource, 1))
  assert.equal(captured.xyz.url, 'https://tiles.test/2026-06/{z}/{x}/{y}.png')

  const arcSource = { id: 'a', name: 'A', type: 'arcgis', url: 'https://gis.test/{time}/MapServer', times: ['2024', '2025'] }
  await imageryProvider(fakeCesium, resolveFrameSource(arcSource, 0))
  assert.equal(captured.arcgis.url, 'https://gis.test/2024/MapServer')
})

// ---------------------------------------------------------------------------
// 3. Overlay stack in-place switching, Z-order, swipe preservation & coalescing
// ---------------------------------------------------------------------------

test('overlayLayers.setFrame：原位替换不乱 Z 序，保留透明度/显隐/卷帘并合并高频拖动', async () => {
  const viewer = fakeViewer()
  const built = []
  const stack = createOverlayLayers({
    Cesium: {},
    viewer,
    providerFactory: async (_Cesium, src) => {
      built.push({ id: src.id, url: src.url, wmsTime: src.wmsTime ?? null })
      return { url: src.url, wmsTime: src.wmsTime ?? null }
    },
  })

  const topStatic = { id: 'top-static', name: '顶层静态', type: 'xyz', url: 'https://tiles.test/static/{z}/{x}/{y}.png', opacity: 0.5, visible: true }
  await stack.sync([FLOOD_FRAMES_OVERLAY, topStatic])
  assert.equal(viewer.layers.length, 2)
  assert.equal(viewer.layers[0].provider.url, FLOOD_FRAMES_OVERLAY.frames[0].url)
  assert.equal(viewer.layers[1].provider.url, topStatic.url)

  // Enable swipe on bottom temporal layer, then switch frame
  const swipe = createSwipeSession({
    getCesium: () => ({ SplitDirection: { LEFT: -1, NONE: 0 } }),
    getViewer: () => viewer,
    getLayers: () => [],
    getOverlayLayers: () => stack,
  })
  assert.equal(swipe.startRaster('flood-6').ok, true)
  assert.equal(viewer.layers[0].splitDirection, -1)

  const oldLayer = viewer.layers[0]
  const switched = await stack.setFrame('flood-6', 2)
  assert.equal(switched.ok, true)
  assert.equal(switched.frameIndex, 2)
  assert.equal(oldLayer.destroyed, true)
  // Stays at index 0 below topStatic!
  assert.equal(viewer.layers[0].provider.url, FLOOD_FRAMES_OVERLAY.frames[2].url)
  assert.equal(viewer.layers[1].provider.url, topStatic.url)
  assert.equal(viewer.layers[0].alpha, 0.8)
  assert.equal(viewer.layers[0].show, true)
  assert.equal(viewer.layers[0].splitDirection, -1)

  // Stopping swipe resets splitDirection on the NEW live layer
  swipe.stop()
  assert.equal(viewer.layers[0].splitDirection, 0)

  // sync() changing opacity keeps current frameIndex=2
  await stack.sync([{ ...FLOOD_FRAMES_OVERLAY, opacity: 0.4 }, topStatic])
  assert.equal(stack.getFrame('flood-6'), 2)
  assert.equal(viewer.layers[0].alpha, 0.4)

  // Rapid scrubbing coalesces intermediate requests
  built.length = 0
  const [r1, r2, r3] = await Promise.all([
    stack.setFrame('flood-6', 3),
    stack.setFrame('flood-6', 4),
    stack.setFrame('flood-6', 5),
  ])
  assert.equal(r1.stale, true)
  assert.equal(r2.stale, true)
  assert.equal(r3.ok, true)
  assert.equal(r3.frameIndex, 5)
  assert.equal(built.length, 1)
  assert.equal(built[0].url, FLOOD_FRAMES_OVERLAY.frames[5].url)
})

// ---------------------------------------------------------------------------
// 4. Session snapshot persistence & legacy backward compatibility
// ---------------------------------------------------------------------------

test('scene-store：快照记录并恢复 rasterFrames，旧快照无该字段仍正常可读', () => {
  // Legacy snapshot (v1 without rasterFrames)
  const legacy = normalizeSceneSnapshot({
    v: SCENE_STORE_VERSION,
    view: { lon: 114.3, lat: 30.5, height: 1200, heading: 0, pitch: -45 },
    layers: [],
    annotations: { draw: [], measure: [] },
    analysis: null,
    shaders: [],
  })
  assert.ok(legacy)
  assert.equal(legacy.rasterFrames, undefined)

  // New snapshot with rasterFrames + invalid entries filtered out
  const modern = normalizeSceneSnapshot({
    v: SCENE_STORE_VERSION,
    view: { lon: 114.3, lat: 30.5, height: 1200, heading: 0, pitch: -45 },
    layers: [],
    annotations: { draw: [], measure: [] },
    analysis: null,
    shaders: [],
    rasterFrames: {
      'flood-6': { frame: 2, time: '2026-07-05' },
      'legacy-int': 4,
      'out-of-range': { frame: 99 },
      negative: -1,
    },
  })
  assert.deepEqual(modern.rasterFrames, {
    'flood-6': { frame: 2, time: '2026-07-05' },
    'legacy-int': { frame: 4 },
  })

  // Round-trip through writeSceneSnapshot / readSceneSnapshot with memory localStorage
  const store = new Map()
  const prevWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      get length() { return store.size },
      key: (i) => [...store.keys()][i] ?? null,
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  }
  try {
    const written = writeSceneSnapshot('sess-rtime', {
      view: modern.view,
      layers: [],
      annotations: { draw: [], measure: [] },
      analysis: null,
      shaders: [],
      rasterFrames: { 'flood-6': { frame: 2, time: '2026-07-05' } },
    })
    assert.ok(written)
    const loaded = readSceneSnapshot('sess-rtime')
    assert.deepEqual(loaded.rasterFrames, { 'flood-6': { frame: 2, time: '2026-07-05' } })
  } finally {
    if (prevWindow === undefined) delete globalThis.window
    else globalThis.window = prevWindow
  }
})

// ---------------------------------------------------------------------------
// 5. Agent contract: normalizeSceneRequest, status, command-bridge & controller
// ---------------------------------------------------------------------------

test('Agent earth_scene frame：参数校验严格，接受 frame 或 time 二选一', () => {
  assert.deepEqual(normalizeSceneRequest({ action: 'frame', layer: 'flood-6', frame: 2 }), {
    action: 'frame',
    args: { layer: 'flood-6', frame: 2 },
  })
  assert.deepEqual(normalizeSceneRequest({ action: 'frame', time: '2026-07-05' }), {
    action: 'frame',
    args: { time: '2026-07-05' },
  })
  assert.throws(() => normalizeSceneRequest({ action: 'frame', layer: 'flood-6' }), /needs "frame".*or "time"/)
  assert.throws(() => normalizeSceneRequest({ action: 'frame', frame: 1, time: '2026-07-01' }), /not both/)
  assert.throws(() => normalizeSceneRequest({ action: 'frame', frame: -1 }), /between 0 and 59/)
  assert.throws(() => normalizeSceneRequest({ action: 'frame', frame: 60 }), /between 0 and 59/)
  assert.throws(() => normalizeSceneRequest({ action: 'frame', frame: 1.5 }), /between 0 and 59/)
})

test('Agent status + frame 切换与 UI 状态、快照恢复端到端一致，不触碰相机与标注', async () => {
  const viewer = fakeViewer()
  const stack = createOverlayLayers({
    Cesium: {},
    viewer,
    providerFactory: async (_Cesium, src) => ({ url: src.url }),
  })
  await stack.sync([FLOOD_FRAMES_OVERLAY])

  const temporalBasemap = {
    id: 'yearly-base',
    name: '逐年影像底图',
    type: 'xyz',
    url: 'https://base.test/{time}/{z}/{x}/{y}.png',
    times: ['2024', '2025', '2026'],
  }
  const sources = {
    imagery: [temporalBasemap],
    terrain: [],
    rasterOverlays: [FLOOD_FRAMES_OVERLAY],
    settings: { imagery: 'yearly-base', terrain: null, quality: 'balanced' },
  }
  let uiFrameMap = {}
  const basemapCalls = []
  let snapshotSaves = 0
  const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key)

  const controller = createRasterFrameController({
    getSources: () => sources,
    getOverlayLayers: () => stack,
    applyImagery: async (id, _notify, idx) => {
      basemapCalls.push({ id, idx })
      return { ok: true }
    },
    getFrameMap: () => uiFrameMap,
    setFrameMap: (next) => { uiFrameMap = next },
    markSceneDirty: () => {},
    saveSceneSnapshot: () => { snapshotSaves += 1 },
    t,
  })

  const statusService = createSceneStatus({
    getCesium: () => ({ Math: { toDegrees: (r) => (r * 180) / Math.PI } }),
    getViewer: () => ({
      camera: { positionCartographic: { longitude: 1.99, latitude: 0.53, height: 1000 }, heading: 0, pitch: -0.7 },
      canvas: { width: 1200, height: 700 },
      resolutionScale: 1,
      scene: { globe: { depthTestAgainstTerrain: false, maximumScreenSpaceError: 2 } },
    }),
    getSources: () => sources,
    getLayers: () => [],
    getOverlayLayers: () => stack,
    getRasterFrames: () => uiFrameMap,
    getAgentOverlays: () => ({ drawnFeatures: 2, measuredCount: 0, draw: [1, 2], measure: [] }),
    getToolMode: () => 'identify',
    getFps: () => 60,
    getBusy: () => '',
    t,
    redactUrl: (u) => u,
    normalizeQuality: () => 'balanced',
  })

  const bridge = createCommandBridge({
    getCesium: () => ({}),
    getViewer: () => viewer,
    getSources: () => sources,
    getLayers: () => [],
    getMeta: () => ({}),
    getAgentOverlays: () => ({ draw: [], measure: [], drawnFeatures: 2, measuredCount: 0 }),
    t,
    collectSceneStatus: () => statusService.collectSceneStatus(),
    setRasterFrame: controller.commandFrame,
  })

  // Switch overlay by date string
  const res = await bridge.runCommand('frame', { layer: 'flood-6', time: '2026-07-05' })
  assert.equal(res.current_frame, 2)
  assert.equal(res.current_label, '洪峰')
  assert.equal(res.current_time, '2026-07-05')
  assert.equal(res.frame_count, 6)
  assert.equal(uiFrameMap['flood-6'], 2)
  assert.equal(snapshotSaves, 1)

  // Switch overlay by Chinese label
  const res2 = await bridge.runCommand('frame', { layer: '流域洪水 6 期', time: '灾后恢复' })
  assert.equal(res2.current_frame, 5)
  assert.equal(uiFrameMap['flood-6'], 5)

  // Switch basemap by frame index
  const resBase = await bridge.runCommand('frame', { layer: 'yearly-base', frame: 1 })
  assert.equal(resBase.current_frame, 1)
  assert.equal(resBase.current_time, '2025')
  assert.deepEqual(basemapCalls, [{ id: 'yearly-base', idx: 1 }])

  // status reflects both overlay & basemap frames + annotations unchanged
  const status = await bridge.runCommand('status')
  assert.equal(status.raster_overlays[0].current_frame, 5)
  assert.equal(status.raster_overlays[0].frames.length, 6)
  assert.equal(status.imagery.current_frame, 1)
  assert.equal(status.imagery.current_time, '2025')
  assert.equal(status.annotations.drawn_features, 2)

  // Snapshot capture & restore in a reopened panel returns to frame 5 and basemap frame 1
  const saved = controller.snapshotFrames()
  assert.deepEqual(saved, {
    'flood-6': { frame: 5, time: '2026-07-15' },
    'yearly-base': { frame: 1, time: '2025' },
  })
  uiFrameMap = {}
  await stack.setFrame('flood-6', 0)
  await controller.restoreFrames(saved)
  assert.equal(stack.getFrame('flood-6'), 5)
  assert.equal(uiFrameMap['flood-6'], 5)
  assert.equal(uiFrameMap['yearly-base'], 1)
})

// ---------------------------------------------------------------------------
// 6. UI draft parsing, helpers, i18n separation & bundle wiring
// ---------------------------------------------------------------------------

test('UI 辅助与双语文案：多期表单解析、命名与日照时间轴隔离且打包进 client.js', () => {
  assert.equal(hasRasterTimeline({ id: 'a', type: 'xyz', url: 'https://e/{z}/{x}/{y}.png' }), false)
  assert.equal(hasRasterTimeline(FLOOD_FRAMES_OVERLAY), true)
  assert.equal(resolveSourceFrames(FLOOD_FRAMES_OVERLAY).length, 6)
  assert.equal(findFrameIndex(resolveSourceFrames(FLOOD_FRAMES_OVERLAY), { time: '洪峰' }), 2)
  assert.equal(describeRasterFrames({ id: 'plain', type: 'xyz', url: 'https://e/{z}/{x}/{y}.png' }), null)

  // Draft form parsing: times mode & frames mode
  const timesDraft = normalizeOverlayDraft({
    type: 'xyz',
    name: '月度',
    url: 'https://e/{time}/{z}/{x}/{y}.png',
    opacity: 0.8,
    timeMode: 'times',
    timesText: '2026-01, 2026-02\n2026-03',
  })
  assert.deepEqual(timesDraft.times, ['2026-01', '2026-02', '2026-03'])

  const framesDraft = normalizeOverlayDraft({
    type: 'xyz',
    name: '洪水',
    url: '',
    opacity: 0.7,
    timeMode: 'frames',
    framesText: '灾前 | https://e/pre/{z}/{x}/{y}.png | 2026-07-01\n洪峰 | https://e/peak/{z}/{x}/{y}.png | 2026-07-05',
  })
  assert.equal(framesDraft.frames.length, 2)
  assert.equal(framesDraft.url, 'https://e/pre/{z}/{x}/{y}.png')

  // Rejects bad time & missing placeholder
  assert.equal(parseTemporalDraft({ mode: 'times', type: 'xyz', url: 'https://e/{z}/{x}/{y}.png', timesText: '2026-01' }).code, 'missing_time_placeholder')
  assert.equal(parseTemporalDraft({ mode: 'times', type: 'wms', url: 'https://e/wms', timesText: '2026-02-30' }).code, 'invalid_time')

  // zh / en key parity and distinct naming from Sun timeline
  assert.deepEqual(Object.keys(RASTER_TIME_MESSAGES.zh).sort(), Object.keys(RASTER_TIME_MESSAGES.en).sort())
  assert.equal(RASTER_TIME_MESSAGES.zh['rasterTime.title'], '影像期次')
  assert.notEqual(RASTER_TIME_MESSAGES.zh['rasterTime.title'], '日照时间轴')

  // Built client bundle wires RasterTimeline & frame bridge
  const client = clientSource()
  assert.match(client, /data-raster-timeline/)
  assert.match(client, /if \(action === 'frame'\)/)
  assert.match(client, /rasterFrames/)

  // Component smoke: single-frame layer renders null; 6-frame layer renders range + controls + current label/date
  const zhT = (key, vars) => {
    let text = RASTER_TIME_MESSAGES.zh[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v))
    }
    return text
  }
  assert.equal(
    RasterTimeline({ t: zhT, source: { id: 'single', name: 'Single', type: 'xyz', url: 'https://e/{z}/{x}/{y}.png' } }),
    null,
  )
  const tree = RasterTimeline({
    t: zhT,
    source: FLOOD_FRAMES_OVERLAY,
    frameIndex: 2,
    onSelectFrame: () => {},
  })
  assert.ok(tree && tree.props?.['data-raster-timeline'] === 'flood-6')
  const serialized = JSON.stringify(tree)
  assert.ok(serialized.includes('影像期次'))
  assert.ok(serialized.includes('洪峰'))
  assert.ok(serialized.includes('2026-07-05'))
  assert.ok(serialized.includes('3/6'))
  assert.ok(!serialized.includes('日照时间轴'))
})
