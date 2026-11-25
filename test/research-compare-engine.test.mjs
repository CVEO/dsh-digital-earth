/**
 * Research Comparison Suite (Steps 1-2 engine foundation) — unit tests:
 *   - tileset-diagnostics: load options, wireframe/LOD/SSE controls, 3DGS guard, stats & baseline reset
 *   - camera-pose & bookmarks: high-precision pose capture, JSON validation, instant setView + roll/fov
 *   - compare-session & swipe: native SplitDirection single & pair (3DGS <-> Mesh), swap, retarget, reconcile
 *   - experiment-export: same-viewpoint triplet capture, divider overlay, metadata schema, failure rollback
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import * as RealCesium from '../vendor/cesium/index.js'
import {
  applyTilesetDiagnostics,
  buildTilesetLoadOptions,
  clampSse,
  formatDiagnosticBytes,
  readTilesetDiagnostics,
  resetAllTilesetDiagnostics,
  resetTilesetDiagnostics,
  supportsWireframe,
} from '../src/client/scene/tileset-diagnostics.js'
import {
  applyCameraPoseInstant,
  captureCameraPose,
  normalizeCameraPose,
  parseCameraPoseJson,
  serializeCameraPose,
} from '../src/client/scene/camera-pose.js'
import { flyToBookmark, normalizeBookmarkView } from '../src/client/scene/bookmarks.js'
import { createSwipeSession } from '../src/client/scene/swipe.js'
import {
  downloadComparisonBundle,
  drawSplitFigureOverlay,
  exportComparisonBundle,
  sanitizeFileSlug,
} from '../src/client/scene/experiment-export.js'

function makeTileset(overrides = {}) {
  return {
    show: true,
    splitDirection: RealCesium.SplitDirection.NONE,
    debugWireframe: false,
    debugColorizeTiles: false,
    debugShowBoundingVolume: false,
    maximumScreenSpaceError: 16,
    cacheBytes: 52_428_800,
    boundingSphere: { center: new RealCesium.Cartesian3(0, 0, 6378137) },
    clippingPlanesOriginMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 6378137, 1],
    clippingPlanes: null,
    statistics: {
      selected: 18,
      visited: 42,
      numberOfTilesWithContentReady: 24,
      numberOfPendingRequests: 2,
      numberOfTrianglesSelected: 145_200,
      numberOfPointsSelected: 0,
      geometryByteLength: 18_000_000,
      texturesByteLength: 32_000_000,
      batchTableByteLength: 120_000,
    },
    ...overrides,
  }
}

function makeViewer(overrides = {}) {
  let renders = 0
  let cancelledFlights = 0
  const setViews = []
  const preRenderListeners = new Set()
  const viewer = {
    canvas: { clientWidth: 1280, clientHeight: 720, width: 1280, height: 720 },
    camera: {
      positionWC: RealCesium.Cartesian3.fromDegrees(114.35521, 30.53214, 420.5),
      directionWC: new RealCesium.Cartesian3(0, 0, -1),
      rightWC: new RealCesium.Cartesian3(1, 0, 0),
      upWC: new RealCesium.Cartesian3(0, 1, 0),
      heading: RealCesium.Math.toRadians(125.5),
      pitch: RealCesium.Math.toRadians(-32.25),
      roll: RealCesium.Math.toRadians(1.5),
      frustum: { fov: RealCesium.Math.toRadians(60), fovy: RealCesium.Math.toRadians(60), aspectRatio: 16 / 9 },
      cancelFlight() {
        cancelledFlights += 1
      },
      setView(opts) {
        setViews.push(opts)
      },
    },
    scene: {
      splitPosition: 0.5,
      requestRender() {
        renders += 1
      },
      preRender: {
        addEventListener(fn) {
          preRenderListeners.add(fn)
          return () => preRenderListeners.delete(fn)
        },
        removeEventListener(fn) {
          preRenderListeners.delete(fn)
        },
      },
    },
    get renders() {
      return renders
    },
    get cancelledFlights() {
      return cancelledFlights
    },
    setViews,
    preRenderListeners,
    ...overrides,
  }
  return viewer
}

// ---------------------------------------------------------------------------
// 1. tileset-diagnostics
// ---------------------------------------------------------------------------

test('tileset-diagnostics: buildTilesetLoadOptions 默认启用 enableDebugWireframe 且保留原选项', () => {
  const opts = buildTilesetLoadOptions({ maximumScreenSpaceError: 20 })
  assert.deepEqual(opts, { maximumScreenSpaceError: 20, enableDebugWireframe: true })
  assert.deepEqual(buildTilesetLoadOptions({ maximumScreenSpaceError: 16 }, { enableDebugWireframe: false }), {
    maximumScreenSpaceError: 16,
    enableDebugWireframe: false,
  })
  assert.equal(clampSse(0.01), 0.25)
  assert.equal(clampSse(999), 128)
  assert.equal(clampSse('bad', 20), 20)
  assert.equal(formatDiagnosticBytes(512), '512 B')
  assert.equal(formatDiagnosticBytes(2048), '2.0 KB')
  assert.equal(formatDiagnosticBytes(52_428_800), '50.0 MB')
})

test('tileset-diagnostics: Mesh 支持线框/素模/SSE 应用与精确基线恢复，且素模不破坏原有自定义着色器', () => {
  const viewer = makeViewer()
  const prevShader = { tag: 'user-effect' }
  const meshLayer = {
    id: 'm1',
    name: '倾斜摄影 Mesh',
    kind: 'mesh',
    visible: true,
    tileset: makeTileset({ maximumScreenSpaceError: 20, customShader: prevShader }),
  }
  assert.equal(supportsWireframe(meshLayer), true)

  const applied = applyTilesetDiagnostics(
    meshLayer,
    { wireframe: true, clay: true, colorizeTiles: true, boundingVolume: true, sse: 2 },
    { viewer, Cesium: RealCesium },
  )
  assert.equal(applied.ok, true)
  assert.deepEqual(applied.warnings, [])
  assert.equal(meshLayer.tileset.debugWireframe, true)
  assert.equal(applied.state.clay, true)
  assert.ok(meshLayer.tileset.customShader instanceof RealCesium.CustomShader)
  assert.equal(meshLayer.tileset.customShader.mode, RealCesium.CustomShaderMode.REPLACE_MATERIAL)
  assert.equal(meshLayer.tileset.customShader.lightingModel, RealCesium.LightingModel.UNLIT)
  assert.equal(meshLayer.tileset.debugColorizeTiles, true)
  assert.equal(meshLayer.tileset.debugShowBoundingVolume, true)
  assert.equal(meshLayer.tileset.maximumScreenSpaceError, 2)
  assert.equal(applied.state.defaultSse, 20)
  assert.equal(applied.state.statistics.triangles, 145_200)
  assert.equal(applied.state.statistics.selectedTiles, 18)
  assert.ok(viewer.renders >= 1)

  const reset = resetTilesetDiagnostics(meshLayer, { viewer, Cesium: RealCesium })
  assert.equal(reset.ok, true)
  assert.equal(meshLayer.tileset.debugWireframe, false)
  assert.equal(reset.state.clay, false)
  assert.equal(meshLayer.tileset.customShader, prevShader, '复位素模应恢复开启前的自定义着色器')
  assert.equal(meshLayer.tileset.debugColorizeTiles, false)
  assert.equal(meshLayer.tileset.debugShowBoundingVolume, false)
  assert.equal(meshLayer.tileset.maximumScreenSpaceError, 20, '复位应恢复首次修改前的 SSE 基线')
})

test('tileset-diagnostics: 3DGS 图层明确拦截三角线框与素模，但允许 SSE 与批量复位', () => {
  const viewer = makeViewer()
  const splatLayer = { id: 'g1', name: '校园 3DGS', kind: '3dgs', visible: true, tileset: makeTileset({ maximumScreenSpaceError: 16 }) }
  assert.equal(supportsWireframe(splatLayer), false)

  const blocked = applyTilesetDiagnostics(splatLayer, { wireframe: true }, { viewer, Cesium: RealCesium })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.reason, 'unsupported_3dgs')
  assert.equal(splatLayer.tileset.debugWireframe, false)

  const blockedClay = applyTilesetDiagnostics(splatLayer, { clay: true }, { viewer, Cesium: RealCesium })
  assert.equal(blockedClay.ok, false)
  assert.equal(blockedClay.reason, 'unsupported_3dgs')
  assert.equal(splatLayer.tileset.customShader, undefined)

  const mixed = applyTilesetDiagnostics(splatLayer, { wireframe: true, clay: true, colorizeTiles: true, sse: 4 }, { viewer, Cesium: RealCesium })
  assert.equal(mixed.ok, true)
  assert.deepEqual(mixed.warnings, ['unsupported_3dgs'])
  assert.equal(splatLayer.tileset.debugWireframe, false)
  assert.equal(splatLayer.tileset.customShader, undefined)
  assert.equal(splatLayer.tileset.debugColorizeTiles, true)
  assert.equal(splatLayer.tileset.maximumScreenSpaceError, 4)

  const count = resetAllTilesetDiagnostics([splatLayer], { viewer, Cesium: RealCesium })
  assert.equal(count, 1)
  assert.equal(splatLayer.tileset.debugColorizeTiles, false)
  assert.equal(splatLayer.tileset.maximumScreenSpaceError, 16)
  assert.equal(readTilesetDiagnostics({ id: 'dead', tileset: { isDestroyed: () => true } }), null)
})

// ---------------------------------------------------------------------------
// 2. camera-pose & bookmarks
// ---------------------------------------------------------------------------

test('camera-pose: 精确提取/序列化/反序列化/瞬移复现完整位姿（含 roll 与 fov）', () => {
  const viewer = makeViewer()
  const pose = captureCameraPose(viewer, RealCesium)
  assert.ok(pose)
  assert.equal(pose.version, 1)
  assert.ok(Math.abs(pose.lon - 114.35521) < 1e-4)
  assert.ok(Math.abs(pose.lat - 30.53214) < 1e-4)
  assert.ok(Math.abs(pose.height - 420.5) < 0.05)
  assert.equal(pose.heading, 125.5)
  assert.equal(pose.pitch, -32.25)
  assert.equal(pose.roll, 1.5)
  assert.equal(pose.fov, 60)
  assert.equal(pose.projection, 'perspective')

  const json = serializeCameraPose(pose)
  const parsed = parseCameraPoseJson(json)
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.pose, pose)

  // 兼容直接粘贴 experiment_meta.json 里的 { camera: ... } 包裹结构
  const wrapped = parseCameraPoseJson(JSON.stringify({ schema: 'v1', camera: pose }))
  assert.equal(wrapped.ok, true)
  assert.deepEqual(wrapped.pose, pose)

  assert.equal(parseCameraPoseJson('   ').reason, 'empty')
  assert.equal(parseCameraPoseJson('{oops').reason, 'invalid_json')
  assert.equal(parseCameraPoseJson('{"lon":200,"lat":0,"height":10}').reason, 'invalid_pose')
  assert.equal(normalizeCameraPose({ lon: 114, lat: 30, height: 100, fov: 200 }), null)

  // 瞬移对齐：必须调用 setView（零飞行误差）并恢复 roll 与 fov
  viewer.camera.frustum.fov = RealCesium.Math.toRadians(45)
  const applied = applyCameraPoseInstant(viewer, RealCesium, { ...pose, fov: 52.5, roll: -3 })
  assert.equal(applied.ok, true)
  assert.equal(viewer.cancelledFlights, 1)
  assert.equal(viewer.setViews.length, 1)
  assert.ok(Math.abs(RealCesium.Math.toDegrees(viewer.camera.frustum.fov) - 52.5) < 1e-6)
  assert.ok(Math.abs(RealCesium.Math.toDegrees(viewer.setViews[0].orientation.roll) - -3) < 1e-6)
})

test('bookmarks: 可选兼容 roll 与 fov，缺省时保持既有结构完全不变', () => {
  const legacy = normalizeBookmarkView({ lon: 114.3, lat: 30.5, height: 500 })
  assert.deepEqual(legacy, { lon: 114.3, lat: 30.5, height: 500, heading: 0, pitch: -45 })

  const precise = normalizeBookmarkView({ lon: 114.3, lat: 30.5, height: 500, heading: 30, pitch: -20, roll: 2.5, fov: 55 })
  assert.equal(precise.roll, 2.5)
  assert.equal(precise.fov, 55)

  const flyCalls = []
  const viewer = { camera: { frustum: { fov: 1 }, flyTo: (o) => flyCalls.push(o) } }
  assert.equal(flyToBookmark(viewer, RealCesium, precise, 0.5), true)
  assert.ok(Math.abs(RealCesium.Math.toDegrees(viewer.camera.frustum.fov) - 55) < 1e-6)
  assert.ok(Math.abs(RealCesium.Math.toDegrees(flyCalls[0].orientation.roll) - 2.5) < 1e-6)
})

// ---------------------------------------------------------------------------
// 3. compare-session & swipe (native SplitDirection single + pair)
// ---------------------------------------------------------------------------

test('compare-session: 原生 SplitDirection 支持 3DGS 单层分屏与 3DGS↔Mesh 双层同屏对比/互换/复位', () => {
  const viewer = makeViewer()
  const splatLayer = { id: 'gs-1', name: '校园 3DGS', kind: '3dgs', visible: true, tileset: makeTileset() }
  const meshLayer = { id: 'mesh-1', name: '倾斜摄影 Mesh', kind: 'mesh', visible: true, tileset: makeTileset() }
  const meshLayer2 = { id: 'mesh-2', name: 'T2 期 Mesh', kind: 'mesh', visible: true, tileset: makeTileset() }
  const layers = [splatLayer, meshLayer, meshLayer2]

  const session = createSwipeSession({
    getCesium: () => RealCesium,
    getViewer: () => viewer,
    getLayers: () => layers,
  })

  // 1) 3DGS 单层原生分屏（无需 ClippingPlaneCollection）
  const single = session.startSplit('gs-1', { ratio: 0.4 })
  assert.equal(single.ok, true)
  assert.equal(single.state.kind, 'split')
  assert.equal(single.state.leftId, 'gs-1')
  assert.equal(splatLayer.tileset.splitDirection, RealCesium.SplitDirection.LEFT)
  assert.equal(splatLayer.tileset.clippingPlanes, null, '原生分屏不得创建 ClippingPlaneCollection')
  assert.equal(viewer.scene.splitPosition, 0.4)

  // 单层互换左右侧
  assert.equal(session.swapSides().ok, true)
  assert.equal(splatLayer.tileset.splitDirection, RealCesium.SplitDirection.RIGHT)
  assert.equal(session.getState().rightId, 'gs-1')

  // 2) 3DGS(左) vs Mesh(右) 双层分屏
  const pair = session.startPair('gs-1', 'mesh-1', { ratio: 0.55 })
  assert.equal(pair.ok, true)
  assert.equal(pair.state.kind, 'pair')
  assert.equal(pair.state.leftId, 'gs-1')
  assert.equal(pair.state.rightId, 'mesh-1')
  assert.equal(splatLayer.tileset.splitDirection, RealCesium.SplitDirection.LEFT)
  assert.equal(meshLayer.tileset.splitDirection, RealCesium.SplitDirection.RIGHT)
  assert.equal(viewer.scene.splitPosition, 0.55)

  // 选同一图层必须拒绝且不破坏正在运行的双层对比
  assert.deepEqual(session.startPair('gs-1', 'gs-1'), { ok: false, reason: 'same_layer' })
  assert.equal(session.getState().kind, 'pair')

  // 拖动比例与一键左右互换
  session.setRatio(0.62)
  assert.equal(viewer.scene.splitPosition, 0.62)
  assert.equal(session.swapSides().ok, true)
  assert.equal(session.getState().leftId, 'mesh-1')
  assert.equal(session.getState().rightId, 'gs-1')
  assert.equal(meshLayer.tileset.splitDirection, RealCesium.SplitDirection.LEFT)
  assert.equal(splatLayer.tileset.splitDirection, RealCesium.SplitDirection.RIGHT)

  // 切换右侧对比层为 T2 期 Mesh，原右侧 3DGS 自动复位为 NONE
  const switched = session.setRightLayer('mesh-2')
  assert.equal(switched.ok, true)
  assert.equal(splatLayer.tileset.splitDirection, RealCesium.SplitDirection.NONE)
  assert.equal(meshLayer.tileset.splitDirection, RealCesium.SplitDirection.LEFT)
  assert.equal(meshLayer2.tileset.splitDirection, RealCesium.SplitDirection.RIGHT)

  // UI 投影（无 tileset）reconcile 不得误停；任一参与层隐藏时必须停止并恢复两层 splitDirection
  const projection = layers.map(({ id, name, visible, kind }) => ({ id, name, visible, kind }))
  assert.equal(session.reconcile({ layers: projection }), false)
  projection[2].visible = false
  assert.equal(session.reconcile({ layers: projection }), true)
  assert.equal(session.getState(), null)
  assert.equal(meshLayer.tileset.splitDirection, RealCesium.SplitDirection.NONE)
  assert.equal(meshLayer2.tileset.splitDirection, RealCesium.SplitDirection.NONE)
  assert.equal(viewer.scene.splitPosition, 0.5)
})

test('compare-session: 卷帘隐藏参与图层的包围体，退出后恢复', () => {
  const viewer = makeViewer()
  const left = { id: 'left', kind: 'mesh', tileset: makeTileset({ debugShowBoundingVolume: true }) }
  const right = { id: 'right', kind: 'mesh', tileset: makeTileset({ debugShowBoundingVolume: true }) }
  const other = { id: 'other', kind: 'mesh', tileset: makeTileset({ debugShowBoundingVolume: true }) }
  const swipe = createSwipeSession({
    getCesium: () => RealCesium,
    getViewer: () => viewer,
    getLayers: () => [left, right, other],
  })
  assert.equal(swipe.startSplit(left.id).ok, true)
  assert.equal(left.tileset.debugShowBoundingVolume, false)
  assert.equal(right.tileset.debugShowBoundingVolume, true)
  assert.equal(swipe.startPair(left.id, right.id).ok, true)
  assert.equal(left.tileset.debugShowBoundingVolume, false)
  assert.equal(right.tileset.debugShowBoundingVolume, false)
  assert.equal(other.tileset.debugShowBoundingVolume, true)
  swipe.stop()
  assert.equal(left.tileset.debugShowBoundingVolume, true)
  assert.equal(right.tileset.debugShowBoundingVolume, true)
})

test('compare-session: 降级与水平轴切换——Mesh split 切水平退回裁剪平面，3DGS 保持垂直安全', () => {
  const viewer = makeViewer()
  const splatLayer = { id: 'gs-1', name: '3DGS', kind: '3dgs', visible: true, tileset: makeTileset() }
  const meshLayer = { id: 'mesh-1', name: 'Mesh', kind: 'mesh', visible: true, tileset: makeTileset() }
  const session = createSwipeSession({
    getCesium: () => RealCesium,
    getViewer: () => viewer,
    getLayers: () => [splatLayer, meshLayer],
  })

  session.startSplit('gs-1')
  assert.equal(session.setOrientation('horizontal').orientation, 'vertical', '3DGS 保持垂直，不走裁剪平面')

  session.startSplit('mesh-1', { ratio: 0.45 })
  const horiz = session.setOrientation('horizontal')
  assert.equal(horiz.kind, '3d')
  assert.equal(horiz.orientation, 'horizontal')
  assert.equal(meshLayer.tileset.splitDirection, RealCesium.SplitDirection.NONE, '离开原生分屏时应复位 splitDirection')
  assert.ok(meshLayer.tileset.clippingPlanes?.enabled, '水平轴应通过共享 ClippingPlaneCollection 生效')

  // 从双层清空右侧 → 平滑降级为单层 split
  session.startPair('gs-1', 'mesh-1', { ratio: 0.6 })
  const downgraded = session.setRightLayer(null)
  assert.equal(downgraded.ok, true)
  assert.equal(downgraded.state.kind, 'split')
  assert.equal(downgraded.state.id, 'gs-1')
  assert.equal(meshLayer.tileset.splitDirection, RealCesium.SplitDirection.NONE)
  session.stop()
})

// ---------------------------------------------------------------------------
// 4. experiment-export
// ---------------------------------------------------------------------------

test('experiment-export: 同机位三联对比组图导出（split + left + right + meta.json）且无痕恢复现场', async () => {
  const viewer = makeViewer()
  const splatLayer = { id: 'gs-1', name: 'VastGaussian 3DGS', kind: '3dgs', visible: true, tileset: makeTileset({ splitDirection: RealCesium.SplitDirection.LEFT }) }
  const meshLayer = { id: 'mesh-1', name: 'ContextCapture Mesh', kind: 'mesh', visible: true, tileset: makeTileset({ splitDirection: RealCesium.SplitDirection.RIGHT, debugWireframe: true, debugShowBoundingVolume: true }) }
  viewer.scene.splitPosition = 0.62

  const snapshots = []
  const overlayCalls = []
  const bundle = await exportComparisonBundle(
    {
      getViewer: () => viewer,
      getCesium: () => RealCesium,
      getLayers: () => [splatLayer, meshLayer],
      getMeta: () => ({ version: '1.6.0' }),
      waitFrames: async () => {},
      renderSnapshot: async (opts) => {
        assert.equal(meshLayer.tileset.debugShowBoundingVolume, false)
        snapshots.push({
          width: opts.width,
          format: opts.format,
          include_hud: opts.include_hud,
          leftShow: splatLayer.tileset.show,
          leftSplit: splatLayer.tileset.splitDirection,
          rightShow: meshLayer.tileset.show,
          rightSplit: meshLayer.tileset.splitDirection,
          splitPosition: viewer.scene.splitPosition,
          hasOverlay: typeof opts.drawOverlay === 'function',
        })
        if (typeof opts.drawOverlay === 'function') {
          const fakeCtx = {
            rects: [],
            texts: [],
            save() {},
            restore() {},
            fillRect(...args) { this.rects.push(args) },
            measureText: (txt) => ({ width: txt.length * 8 }),
            fillText(...args) { this.texts.push(args) },
          }
          opts.drawOverlay(fakeCtx, 1920, 1080)
          overlayCalls.push(fakeCtx)
        }
        return { dataUrl: `data:image/png;base64,SHOT_${snapshots.length}`, width: 1920, height: 1080, format: 'png' }
      },
    },
    {
      leftLayerId: 'gs-1',
      rightLayerId: 'mesh-1',
      ratio: 0.62,
      width: 1920,
      format: 'png',
      includeDivider: true,
      includeLabels: true,
      timestamp: new Date('2026-11-22T02:30:00Z'),
    },
  )

  assert.equal(bundle.mode, 'pair')
  assert.equal(bundle.shots.length, 3)
  assert.deepEqual(bundle.shots.map((s) => s.role), ['split', 'left_only', 'right_only'])
  assert.equal(snapshots[0].leftSplit, RealCesium.SplitDirection.LEFT)
  assert.equal(snapshots[0].rightSplit, RealCesium.SplitDirection.RIGHT)
  assert.equal(snapshots[0].hasOverlay, true)
  assert.equal(overlayCalls.length, 1)
  assert.ok(overlayCalls[0].rects.length >= 2, '分屏图应绘入分割线')
  assert.equal(overlayCalls[0].texts.length, 2, '开启标签时应绘入左右方法标签')

  assert.equal(snapshots[1].leftShow, true)
  assert.equal(snapshots[1].rightShow, false)
  assert.equal(snapshots[1].leftSplit, RealCesium.SplitDirection.NONE)
  assert.equal(snapshots[1].hasOverlay, false)

  assert.equal(snapshots[2].leftShow, false)
  assert.equal(snapshots[2].rightShow, true)
  assert.equal(snapshots[2].rightSplit, RealCesium.SplitDirection.NONE)

  // 元数据校验
  const meta = JSON.parse(bundle.metadataJson)
  assert.equal(meta.schema, 'dsh-digital-earth.research-comparison.v1')
  assert.equal(meta.plugin_version, '1.6.0')
  assert.equal(meta.split_ratio, 0.62)
  assert.equal(meta.camera.fov, 60)
  assert.equal(meta.left.kind, '3dgs')
  assert.equal(meta.right.diagnostics.wireframe, true)
  assert.equal(meta.right.diagnostics.boundingVolume, false)
  assert.equal(meta.files.length, 3)

  // 现场必须无痕恢复
  assert.equal(splatLayer.tileset.show, true)
  assert.equal(splatLayer.tileset.splitDirection, RealCesium.SplitDirection.LEFT)
  assert.equal(meshLayer.tileset.show, true)
  assert.equal(meshLayer.tileset.splitDirection, RealCesium.SplitDirection.RIGHT)
  assert.equal(meshLayer.tileset.debugShowBoundingVolume, true)
  assert.equal(viewer.scene.splitPosition, 0.62)
})

test('experiment-export: 渲染中途异常时必须 100% 回滚现场状态，并支持顺序下载与文件名清洗', async () => {
  const viewer = makeViewer()
  const leftLayer = { id: 'a', name: 'A / 方法:*?1', kind: '3dgs', visible: true, tileset: makeTileset({ splitDirection: RealCesium.SplitDirection.LEFT }) }
  const rightLayer = { id: 'b', name: 'B', kind: 'mesh', visible: true, tileset: makeTileset({ splitDirection: RealCesium.SplitDirection.RIGHT }) }
  viewer.scene.splitPosition = 0.33

  assert.equal(sanitizeFileSlug('A / 方法:*?1'), 'A_方法_1')

  let calls = 0
  await assert.rejects(
    () =>
      exportComparisonBundle(
        {
          getViewer: () => viewer,
          getCesium: () => RealCesium,
          getLayers: () => [leftLayer, rightLayer],
          waitFrames: async () => {},
          renderSnapshot: async () => {
            calls += 1
            if (calls === 2) throw new Error('webgl_context_lost')
            return { dataUrl: 'data:image/png;base64,OK', width: 1280, height: 720, format: 'png' }
          },
        },
        { leftLayerId: 'a', rightLayerId: 'b', ratio: 0.5 },
      ),
    /webgl_context_lost/,
  )

  // 异常后两层状态与分割比例必须全部恢复到调用前
  assert.equal(leftLayer.tileset.show, true)
  assert.equal(leftLayer.tileset.splitDirection, RealCesium.SplitDirection.LEFT)
  assert.equal(rightLayer.tileset.show, true)
  assert.equal(rightLayer.tileset.splitDirection, RealCesium.SplitDirection.RIGHT)
  assert.equal(viewer.scene.splitPosition, 0.33)

  // 验证顺序下载辅助
  const downloads = []
  const origDoc = globalThis.document
  globalThis.document = {
    createElement: () => ({
      href: '',
      download: '',
      click() {
        downloads.push({ href: this.href, download: this.download })
      },
    }),
  }
  try {
    const res = await downloadComparisonBundle(
      {
        shots: [{ filename: 'a.png', dataUrl: 'data:image/png;base64,AA' }],
        metadataFilename: 'meta.json',
        metadataJson: '{"ok":true}',
      },
      { delayMs: 0 },
    )
    assert.equal(res.ok, true)
    assert.equal(res.count, 2)
    assert.deepEqual(downloads.map((d) => d.download), ['a.png', 'meta.json'])
  } finally {
    globalThis.document = origDoc
  }

  // drawSplitFigureOverlay 空上下文安全无抛错
  assert.doesNotThrow(() => drawSplitFigureOverlay(null, 100, 100))
})
