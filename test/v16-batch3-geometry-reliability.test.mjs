/**
 * v1.6 Batch 3 — Numerical geometry & reliability tests:
 * - F03: ClippingPlane world-to-local transform (ENU, rotated, scaled matrices)
 * - F04: Vision polygon partial depth (`complete: false`, `missRatio`, `depth_source`)
 * - F05: Bridge `event: cancel` SSE propagation on AbortSignal
 * - F07/F09: Raster overlay reordering in Cesium `imageryLayers` & basemap race guard
 * - F14/F15: Flood valid coverage ratio, unsampled area, and `low_sample_coverage` warning
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

import * as RealCesium from '../vendor/cesium/index.js'

const { analysisClipPlane, analysisLocalizeClipPlane } = await import('../src/client/analysis/math.js')
const { createAnalysisEngine } = await import('../src/client/analysis/engine.js')
const { captureVisionFrame, projectVisionPolygon } = await import('../src/client/scene/vision-frame.js')
const { getSelectionTool, disposeSelection } = await import('../src/client/scene/selection-tools.js')
const { createOverlayLayers } = await import('../src/client/scene/overlay-layers.js')
const { createBridge } = await import('../src/host/bridge.js')

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }
}

// ---------------------------------------------------------------------------
// F03: Numerical verification of local clipping plane under ENU / rotated / scaled frames
// ---------------------------------------------------------------------------

test('F03: analysisLocalizeClipPlane 将世界坐标剖切面精确变换到 ENU 局部坐标与旋转缩放矩阵', () => {
  // 模拟地球表面某点：中心在 ECEF (0, 0, 6378237)，对应椭球高 100 m，局部 Up 为 +Z
  const R = 6378137
  const center = new Vec3(0, 0, R + 100)
  const fakeCesium = {
    Cartesian3: Object.assign(Vec3, {
      multiplyByScalar: (v, s, out = new Vec3()) => {
        out.x = v.x * s
        out.y = v.y * s
        out.z = v.z * s
        return out
      },
      add: (a, b, out = new Vec3()) => {
        out.x = a.x + b.x
        out.y = a.y + b.y
        out.z = a.z + b.z
        return out
      },
      dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
      negate: (v, out = new Vec3()) => {
        out.x = -v.x
        out.y = -v.y
        out.z = -v.z
        return out
      },
      clone: (v, out = new Vec3()) => {
        out.x = v.x
        out.y = v.y
        out.z = v.z
        return out
      },
    }),
    Cartographic: {
      fromCartesian: (p) => ({ longitude: 0, latitude: Math.PI / 2, height: p.z - R }),
    },
    Ellipsoid: {
      WGS84: {
        geodeticSurfaceNormal: () => new Vec3(0, 0, 1),
      },
    },
  }

  // 1) 标准 ENU 局部坐标系（原点在 center，c0=East(1,0,0), c1=North(0,1,0), c2=Up(0,0,1)）
  const enuMatrix = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    center.x, center.y, center.z, 1,
  ]
  const planeBelow = analysisClipPlane(fakeCesium, center, 150, 'below')
  assert.equal(planeBelow.distance, R + 150, '未局部化前是世界坐标距地心距离（约 6378 km）')

  analysisLocalizeClipPlane(fakeCesium, planeBelow, { clippingPlanesOriginMatrix: enuMatrix }, center)
  assert.ok(Math.abs(planeBelow.normal.x) < 1e-12)
  assert.ok(Math.abs(planeBelow.normal.y) < 1e-12)
  assert.ok(Math.abs(planeBelow.normal.z - -1) < 1e-12, 'keep=below 在 ENU 下法向应为 (0,0,-1)')
  assert.ok(Math.abs(planeBelow.distance - 50) < 1e-9, '局部距离应为相对中心高差 +50 m，而非 6378 km')

  // 局部点 z=+40 m（高程 140 m，平面下方）应保留（>0）；z=+60 m（高程 160 m，平面上方）应裁掉（<0）
  const evalPlane = (p, pl) => pl.normal.x * p.x + pl.normal.y * p.y + pl.normal.z * p.z + pl.distance
  assert.ok(evalPlane(new Vec3(12, -8, 40), planeBelow) > 0, '140 m 处顶点必须保留')
  assert.ok(evalPlane(new Vec3(12, -8, 60), planeBelow) < 0, '160 m 处顶点必须被裁掉')

  // 2) 含旋转 + 2 倍均匀缩放的局部变换矩阵：c0=(0,2,0), c1=(-2,0,0), c2=(0,0,2), 原点在 center+(10,20,30)
  const scaledRotatedMatrix = [
    0, 2, 0, 0,
    -2, 0, 0, 0,
    0, 0, 2, 0,
    center.x + 10, center.y + 20, center.z + 30, 1,
  ]
  const planeAbove = analysisClipPlane(fakeCesium, center, 150, 'above')
  analysisLocalizeClipPlane(fakeCesium, planeAbove, { clippingPlanesOriginMatrix: scaledRotatedMatrix }, center)
  // 原点高程为 100+30=130 m，剖切面在 150 m（世界高差 +20 m），因局部 Z 轴放大 2 倍，局部 z=10 刚好在剖切面上
  assert.ok(Math.abs(evalPlane(new Vec3(5, -3, 10), planeAbove)) < 1e-9, '局部 z=10 应精确落在 150 m 剖切面上')
  assert.ok(evalPlane(new Vec3(5, -3, 15), planeAbove) > 0, 'keep=above 时局部 z=15（160 m）应保留')
  assert.ok(evalPlane(new Vec3(5, -3, 5), planeAbove) < 0, 'keep=above 时局部 z=5（140 m）应裁掉')
})

// ---------------------------------------------------------------------------
// F04: Vision polygon partial depth sets complete=false and carries missRatio/depth_source
// ---------------------------------------------------------------------------

test('F04: projectVisionPolygon 在部分采样点无深度时返回 complete=false、missRatio 与 depth_source 并贯通到导出 GeoJSON', () => {
  const oldDocument = globalThis.document
  globalThis.document = {
    visibilityState: 'visible',
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toDataURL: () => 'data:image/jpeg;base64,TEST',
    }),
  }
  let pickCount = 0
  const Cesium = {
    Cartesian2: class {
      constructor(x, y) {
        this.x = x
        this.y = y
      }
    },
    SceneTransforms: { worldToWindowCoordinates: () => ({ x: 250, y: 200 }) },
    Cartographic: {
      fromCartesian: (v) => ({ longitude: (v.x * Math.PI) / 180000, latitude: (v.y * Math.PI) / 180000, height: 25 }),
    },
    Math: { toDegrees: (rad) => (rad * 180) / Math.PI },
  }
  const viewer = {
    canvas: { width: 1000, height: 800, clientWidth: 500, clientHeight: 400 },
    camera: { viewMatrix: [1, 0, 0, 1], frustum: { fov: 1 }, cancelFlight() {} },
    isDestroyed: () => false,
    render() {},
    entities: {
      collectionChanged: { addEventListener: () => () => {} },
      add: (o) => o,
      remove() {},
    },
    scene: {
      screenSpaceCameraController: { enableInputs: true },
      pickPositionSupported: true,
      primitives: { length: 1 },
      globe: { tilesLoaded: true, show: true, depthTestAgainstTerrain: true },
      pick: () => ({ primitive: {} }),
      pickPosition(pos) {
        pickCount += 1
        // 8 个采样点中前 6 个命中深度，后 2 个落入天空（无深度且无地球交点）
        return pickCount <= 6 ? { x: pos.x, y: pos.y } : null
      },
      requestRender() {},
    },
  }

  try {
    const frame = captureVisionFrame({ viewer, Cesium, anchor: {}, getLayers: () => [] })
    const polygon = [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.8, 0.8],
      [0.2, 0.8],
    ]
    const ground = projectVisionPolygon(frame, { polygon })
    frame.release()

    assert.equal(ground.complete, false, '存在丢失深度点时 complete 必须为 false')
    assert.equal(ground.misses, 2)
    assert.equal(ground.missRatio, 0.25)
    assert.equal(ground.depth_source, 'scene_depth')
    assert.ok(ground.warnings.includes('depth_partial'))

    const tool = getSelectionTool(viewer, { getCesium: () => Cesium })
    assert.equal(tool.commitVision(ground), true, '有效顶点数 >=3 的部分轮廓应可提交为近似选区')
    const exported = tool.exportGeoJSON()
    const props = exported.features[0].properties
    assert.equal(props.complete, false)
    assert.equal(props.misses, 2)
    assert.equal(props.miss_ratio, 0.25)
    assert.equal(props.depth_source, 'scene_depth')
    assert.deepEqual(props.warnings, ['depth_partial'])
  } finally {
    disposeSelection(viewer)
    if (oldDocument === undefined) delete globalThis.document
    else globalThis.document = oldDocument
  }
})

// ---------------------------------------------------------------------------
// F05: Bridge emits `event: cancel` SSE frame when AbortSignal aborts
// ---------------------------------------------------------------------------

test('F05: Host bridge 在工具调用被取消时向面板 SSE 流发送 event: cancel 帧', async () => {
  const bridge = createBridge([], { attachGraceMs: 50 })
  const frames = []
  const req = {
    url: '/bridge/tok?session=s-cancel',
    headers: { host: 'localhost:3000' },
    on() {},
  }
  const res = {
    statusCode: 200,
    writeHead() {},
    setHeader() {},
    flushHeaders() {},
    write(chunk) {
      frames.push(String(chunk))
      return true
    },
    end() {},
  }
  bridge.attach('s-cancel', req, res)

  const controller = new AbortController()
  const promise = bridge.run('s-cancel', 'fly', { lon: 114.3, lat: 30.5, height: 800 }, 5000, controller.signal)
  await new Promise((resolve) => setImmediate(resolve))
  controller.abort()

  await assert.rejects(promise, (err) => err.bridgeKind === 'cancelled')
  assert.ok(
    frames.some((frame) => frame.startsWith('event: cancel\n') && frame.includes('"action":"fly"')),
    '取消时必须向客户端发送 event: cancel 帧',
  )
  bridge.dispose()
})

// ---------------------------------------------------------------------------
// F09: Raster overlay reordering updates Cesium imageryLayers order
// ---------------------------------------------------------------------------

test('F09: overlayLayers.sync 在顺序调整后同步重排 list() 与 Cesium imageryLayers 顺序', async () => {
  const stack = []
  const viewer = {
    scene: {
      imageryLayers: {
        addImageryProvider(provider) {
          const layer = { provider, alpha: 1, show: true }
          stack.push(layer)
          return layer
        },
        remove(layer) {
          const idx = stack.indexOf(layer)
          if (idx >= 0) stack.splice(idx, 1)
        },
        raiseToTop(layer) {
          const idx = stack.indexOf(layer)
          if (idx >= 0) {
            stack.splice(idx, 1)
            stack.push(layer)
          }
        },
      },
    },
  }
  const overlays = createOverlayLayers({
    Cesium: {},
    viewer,
    providerFactory: async (_Cesium, source) => ({ id: source.id }),
  })

  const a = { id: 'ov-a', name: 'A', type: 'xyz', url: 'https://example.com/a/{z}/{x}/{y}.png', opacity: 1, visible: true }
  const b = { id: 'ov-b', name: 'B', type: 'xyz', url: 'https://example.com/b/{z}/{x}/{y}.png', opacity: 1, visible: true }
  await overlays.sync([a, b])
  assert.deepEqual(overlays.list().map((item) => item.id), ['ov-a', 'ov-b'])
  assert.deepEqual(stack.map((item) => item.provider.id), ['ov-a', 'ov-b'])

  await overlays.sync([b, a])
  assert.deepEqual(overlays.list().map((item) => item.id), ['ov-b', 'ov-a'], 'list() 顺序必须更新')
  assert.deepEqual(stack.map((item) => item.provider.id), ['ov-b', 'ov-a'], 'Cesium imageryLayers 叠放顺序必须同步更新')
})

// ---------------------------------------------------------------------------
// F15: Flood analysis reports coverage_ratio, unknown_km2, and low_sample_coverage warning
// ---------------------------------------------------------------------------

test('F15: 淹没分析在 4×4 网格仅少数点有高程时报告 coverage_ratio、unknown_km2 与 low_sample_coverage 警告', async () => {
  let sampleIdx = 0
  const viewer = {
    entities: { add: (e) => e, remove() {} },
    scene: {
      globe: {
        ellipsoid: RealCesium.Ellipsoid.WGS84,
        terrainProvider: { availability: {} },
        getHeight() {
          sampleIdx += 1
          // 16 个格点中仅 2 个格点有高程（20 m），其余 14 个返回 undefined
          return sampleIdx <= 2 ? 20 : undefined
        },
      },
    },
  }
  const engine = createAnalysisEngine({
    getCesium: () => RealCesium,
    getViewer: () => viewer,
    getLayers: () => [],
    findLayer: () => null,
    state: { current: { operation: null, layerId: null, layerName: null, entities: [], restore: null } },
    commandRef: { current: null },
    setAnalysis() {},
    markSceneDirty() {},
    t: (k) => k,
  })

  const result = await engine.command({
    action: 'flood',
    region: { west: 114.3, south: 30.5, east: 114.304, north: 30.504 },
    water_height: 25,
    grid: 4,
    source: 'terrain',
  })

  assert.equal(result.samples_total, 16)
  assert.equal(result.samples_with_data, 2)
  assert.equal(result.samples_missing, 14)
  assert.equal(result.coverage_ratio, 0.125, '有效采样率应为 2/16 = 0.125')
  assert.ok(result.unknown_km2 > 0, '未采样面积必须大于 0')
  assert.ok(result.warnings.includes('low_sample_coverage'), '采样覆盖率低于 50% 时必须给出 low_sample_coverage 警告')
})
