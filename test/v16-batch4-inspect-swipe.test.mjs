/**
 * v1.6 Batch 4 — F12 (3D Tiles 1.1 inspector accuracy) & Requirement B (Layer Swipe Comparison):
 * - F12: `tile.contents` (1.1), ECEF boundingVolume world placement without root transform,
 *        and accurate `meshGlb` / `uninspectedGlb` when GLB count > MAX_GLB_CONTENT_CHECKS (16).
 * - Requirement B: 3D Tiles screen-aligned vertical/horizontal ClippingPlane in local frame,
 *        2D raster `splitDirection` + `splitPosition`, 3DGS explicit rejection & disabled UI button,
 *        camera-rotation `preRender` sync, and exact state restoration on exit/hide/remove.
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

import * as RealCesium from '../vendor/cesium/index.js'

const { analyzeTileset } = await import('../src/host/inspect/analyze.js')
const { computeSwipeClipPlane, createSwipeSession } = await import('../src/client/scene/swipe.js')
const { LayerRow } = await import('../src/client/ui/layer-row.js')
const { engineLayersOf } = await import('../src/client/ui/swipe-bar.js')
const { MESSAGES } = await import('../src/client/messages.js')
const { clientSource } = await import('./helpers/source.mjs')

const workspaces = []
after(async () => {
  for (const dir of workspaces) await rm(dir, { recursive: true, force: true })
})

function makeGlb(json) {
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
  const padding = (4 - (jsonBuffer.length % 4)) % 4
  const jsonChunk = Buffer.concat([jsonBuffer, Buffer.alloc(padding, 0x20)])
  const header = Buffer.alloc(12)
  header.write('glTF', 0, 'ascii')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length, 8)
  const chunkHeader = Buffer.alloc(8)
  chunkHeader.writeUInt32LE(jsonChunk.length, 0)
  chunkHeader.writeUInt32LE(0x4e4f534a, 4)
  return Buffer.concat([header, chunkHeader, jsonChunk])
}

// ---------------------------------------------------------------------------
// F12: 3D Tiles 1.1 `tile.contents`, ECEF world placement, and >16 GLB sampling
// ---------------------------------------------------------------------------

test('F12: analyzeTileset 识别 3D Tiles 1.1 tile.contents 数组与无根 transform 的 ECEF 世界坐标包围盒', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-de-f12-11-'))
  workspaces.push(root)
  const meshGlb = makeGlb({ asset: { version: '2.0', generator: 'cesium-1.1-exporter' }, meshes: [{ primitives: [] }] })
  await writeFile(join(root, 'part-a.glb'), meshGlb)
  await writeFile(join(root, 'part-b.glb'), meshGlb)

  // 无 root.transform、无 region，但 boundingVolume.box 中心已在地球表面 ECEF 坐标 (-2260000, 5009000, 3219000)
  // 且使用 3D Tiles 1.1 的 `contents` 数组与 `3DTILES_multiple_contents` 扩展
  const doc = {
    asset: { version: '1.1' },
    extensionsUsed: ['3DTILES_multiple_contents', '3DTILES_metadata'],
    extensionsRequired: ['3DTILES_multiple_contents'],
    geometricError: 64,
    root: {
      boundingVolume: {
        box: [-2260000, 5009000, 3219000, 100, 0, 0, 0, 100, 0, 0, 0, 50],
      },
      geometricError: 16,
      contents: [{ uri: 'part-a.glb' }, { uri: 'part-b.glb' }],
    },
  }
  const tilesetPath = join(root, 'tileset.json')
  await writeFile(tilesetPath, JSON.stringify(doc))

  const report = await analyzeTileset({ kind: 'local', path: tilesetPath }, { allowedDirs: new Set([root]) })
  assert.equal(report.ok, true, 'ECEF 地球表面坐标包围盒不应误判为 tileset_not_georeferenced')
  assert.equal(report.root.hasWorldPlacement, true)
  assert.equal(report.counts.contents, 2, '3D Tiles 1.1 tile.contents 中的两个 GLB 均应被统计')
  assert.equal(report.kinds.glb, 2)
  assert.equal(report.kinds.meshGlb, 2)
  assert.ok(!report.issues.some((i) => i.code === 'tileset_not_georeferenced'))
  assert.ok(!report.issues.some((i) => i.code === 'unsupported_extension'))
})

test('F12: 超过 16 个 GLB 的纯 3DGS 数据集抽样检查后，未抽样 GLB 不得误计入 meshGlb', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-de-f12-splat25-'))
  workspaces.push(root)
  const splatGlb = makeGlb({
    asset: { version: '2.0', generator: '3dgs-converter' },
    extensionsUsed: ['KHR_gaussian_splatting'],
    extensionsRequired: ['KHR_gaussian_splatting'],
    meshes: [{ primitives: [] }],
  })
  const children = []
  for (let i = 0; i < 25; i += 1) {
    const name = `tile_${i}.glb`
    await writeFile(join(root, name), splatGlb)
    children.push({
      boundingVolume: { region: [-0.01, -0.01, -0.01, 0.01, 0.01, 0.01] },
      geometricError: 1,
      content: { uri: name },
    })
  }
  const tilesetPath = join(root, 'tileset.json')
  await writeFile(
    tilesetPath,
    JSON.stringify({
      asset: { version: '1.1' },
      geometricError: 50,
      root: {
        boundingVolume: { region: [-0.01, -0.01, -0.01, 0.01, 0.01, 0.01] },
        geometricError: 10,
        children,
      },
    }),
  )

  const report = await analyzeTileset({ kind: 'local', path: tilesetPath }, { allowedDirs: new Set([root]) })
  assert.equal(report.kinds.glb, 25)
  assert.equal(report.contentChecked, 16)
  assert.equal(report.kinds.gaussianSplatGlb, 16)
  assert.equal(report.kinds.meshGlb, 0, '未抽样的 9 个 GLB 不得被减法误判为 meshGlb')
  assert.equal(report.kinds.uninspectedGlb, 9)
  assert.equal(report.kinds.gaussianSplatting, true)
})

// ---------------------------------------------------------------------------
// Requirement B: Swipe Comparison (3D Tiles local clipping plane + 2D raster + 3DGS guard)
// ---------------------------------------------------------------------------

test('需求 B: computeSwipeClipPlane 垂直/水平卷帘平面在局部坐标系下精确分割视锥左右与上下', () => {
  // 局部坐标系：原点在 (0, 0, 6378137)，c0=East(+X), c1=North(+Y), c2=Up(+Z)
  const origin = new RealCesium.Cartesian3(0, 0, 6378137)
  const enuMatrix = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    origin.x, origin.y, origin.z, 1,
  ]
  const tileset = {
    boundingSphere: { center: origin },
    clippingPlanesOriginMatrix: enuMatrix,
  }
  // 相机位于局部原点正上方 200 m（世界坐标 (0, 0, 6378337)），朝向正下 (-Z)，Right 为 +X，Up 为 +Y
  const camera = {
    positionWC: new RealCesium.Cartesian3(0, 0, 6378337),
    directionWC: new RealCesium.Cartesian3(0, 0, -1),
    rightWC: new RealCesium.Cartesian3(1, 0, 0),
    upWC: new RealCesium.Cartesian3(0, 1, 0),
    frustum: { fov: Math.PI / 2, fovy: Math.PI / 2, aspectRatio: 1 },
  }
  const evalPlane = (p, pl) => pl.normal.x * p.x + pl.normal.y * p.y + pl.normal.z * p.z + pl.distance

  // 1) 默认垂直居中（ratio = 0.5）：左侧（x < 0）保留（> 0），右侧（x > 0）裁掉（< 0）
  const vertCenter = computeSwipeClipPlane(RealCesium, camera, tileset, { ratio: 0.5, orientation: 'vertical' })
  assert.ok(evalPlane(new RealCesium.Cartesian3(-50, 0, 0), vertCenter) > 0, '左半屏局部点 (x=-50) 应保留')
  assert.ok(evalPlane(new RealCesium.Cartesian3(50, 0, 0), vertCenter) < 0, '右半屏局部点 (x=+50) 应被裁掉')

  // 2) 垂直左移到 ratio = 0.25：画面中心点 (x=0, y=0, z=0) 位于分割线右侧，应被裁掉（< 0）
  const vertLeft = computeSwipeClipPlane(RealCesium, camera, tileset, { ratio: 0.25, orientation: 'vertical' })
  assert.ok(evalPlane(new RealCesium.Cartesian3(0, 0, 0), vertLeft) < 0, 'ratio=0.25 时屏幕中心点应在无图层侧')
  assert.ok(evalPlane(new RealCesium.Cartesian3(-150, 0, 0), vertLeft) > 0, 'ratio=0.25 时极左侧点 (x=-150) 仍在有图层侧')

  // 3) 切换为水平居中（ratio = 0.5, orientation = 'horizontal'）：上半屏（y > 0）保留（> 0），下半屏（y < 0）裁掉（< 0）
  const horizCenter = computeSwipeClipPlane(RealCesium, camera, tileset, { ratio: 0.5, orientation: 'horizontal' })
  assert.ok(evalPlane(new RealCesium.Cartesian3(0, 50, 0), horizCenter) > 0, '上半屏局部点 (y=+50) 应保留')
  assert.ok(evalPlane(new RealCesium.Cartesian3(0, -50, 0), horizCenter) < 0, '下半屏局部点 (y=-50) 应被裁掉')
})

test('需求 B: createSwipeSession 支持 3D Tiles 与 2D 栅格卷帘、相机旋转实时更新、隐藏自动退出与无残留恢复，并拒绝 3DGS', () => {
  const origin = new RealCesium.Cartesian3(0, 0, 6378137)
  const preRenderListeners = new Set()
  const viewer = {
    canvas: { clientWidth: 800, clientHeight: 600 },
    camera: {
      positionWC: new RealCesium.Cartesian3(0, 0, 6378337),
      directionWC: new RealCesium.Cartesian3(0, 0, -1),
      rightWC: new RealCesium.Cartesian3(1, 0, 0),
      upWC: new RealCesium.Cartesian3(0, 1, 0),
      frustum: { fov: Math.PI / 3, fovy: Math.PI / 3, aspectRatio: 1 },
    },
    scene: {
      splitPosition: 0.5,
      requestRender() {},
      preRender: {
        addEventListener(fn) {
          preRenderListeners.add(fn)
          return () => preRenderListeners.delete(fn)
        },
      },
    },
  }
  const meshLayer = {
    id: 'layer-mesh',
    name: '城市实景 Mesh',
    kind: 'mesh',
    visible: true,
    tileset: {
      boundingSphere: { center: origin },
      clippingPlanesOriginMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, origin.x, origin.y, origin.z, 1],
      clippingPlanes: null,
    },
  }
  const splatLayer = {
    id: 'layer-3dgs',
    name: '高斯泼溅图层',
    kind: '3dgs',
    visible: true,
    tileset: { boundingSphere: { center: origin } },
  }
  const rasterImageryLayer = { splitDirection: 0 }
  const layers = [meshLayer, splatLayer]
  const overlays = [{ id: 'ov-1', name: '历史正射影像', visible: true }]

  const session = createSwipeSession({
    getCesium: () => RealCesium,
    getViewer: () => viewer,
    getLayers: () => layers,
    getOverlayLayers: () => ({
      list: () => overlays,
      getLayer: (id) => (id === 'ov-1' ? rasterImageryLayer : null),
    }),
  })

  // 1) 3DGS 图层明确拒绝
  assert.deepEqual(session.start3d('layer-3dgs'), { ok: false, reason: 'unsupported_3dgs' })
  assert.equal(session.getState(), null)

  // 2) 3D Tiles 图层开启卷帘、拖动比例、切换水平方向、相机旋转更新
  const started3d = session.start3d('layer-mesh')
  assert.equal(started3d.ok, true)
  assert.ok(meshLayer.tileset.clippingPlanes, '应挂载 ClippingPlaneCollection')
  assert.equal(preRenderListeners.size, 1, '应注册 preRender 相机跟随监听')

  session.setRatio(0.7)
  assert.equal(session.getState().ratio, 0.7)
  session.setOrientation('horizontal')
  assert.equal(session.getState().orientation, 'horizontal')

  // 模拟相机旋转 90°（Right 变为 +Y，Up 变为 -X），触发 preRender 后裁剪平面法向实时跟随屏幕
  viewer.camera.rightWC = new RealCesium.Cartesian3(0, 1, 0)
  viewer.camera.upWC = new RealCesium.Cartesian3(-1, 0, 0)
  for (const fn of preRenderListeners) fn()
  const updatedPlane = meshLayer.tileset.clippingPlanes.get(0)
  assert.ok(Math.abs(updatedPlane.normal.x - -1) < 0.5, '相机旋转后水平分割面法向应跟随新的相机 Up 方向 (-X)')

  // 目标图层隐藏时自动退出：集合保留但禁用（Cesium 的 setter 赋 undefined 会
  // destroy() 集合与裁剪纹理，而 tile 绘制命令仍引用它 → 渲染崩溃 "(_target)"）
  meshLayer.visible = false
  assert.equal(session.reconcile({ layers, overlays }), true)
  assert.equal(session.getState(), null)
  assert.ok(meshLayer.tileset.clippingPlanes, '退出后集合必须保留在 tileset 上')
  assert.equal(meshLayer.tileset.clippingPlanes.enabled, false, '退出后必须用 enabled=false 关闭裁剪而非移除')
  assert.equal(preRenderListeners.size, 0, '退出后必须移除 preRender 监听')

  // 3) 2D 栅格叠加图层开启卷帘、拖动更新 splitPosition、退出完全恢复
  const startedRaster = session.startRaster('ov-1')
  assert.equal(startedRaster.ok, true)
  assert.equal(rasterImageryLayer.splitDirection, RealCesium.SplitDirection.LEFT)
  assert.equal(viewer.scene.splitPosition, 0.5)

  session.setRatio(0.35)
  assert.equal(viewer.scene.splitPosition, 0.35)
  session.stop()
  assert.equal(rasterImageryLayer.splitDirection, 0, '退出后 splitDirection 恢复为 NONE(0)')
  assert.equal(viewer.scene.splitPosition, 0.5, '退出后 splitPosition 恢复原值')

  // 4) UI 层行：3DGS 图层的卷帘按钮置灰并带有原因说明，中英文案成对
  const row3dgs = LayerRow({
    t: (k) => MESSAGES.zh[k] ?? k,
    layer: splatLayer,
    shader: null,
    swipeActive: false,
    onFlyLayer() {},
    onToggleLayer() {},
    onInspectLayer() {},
    onRemoveLayer() {},
    onEditShader() {},
    onSwipeLayer() {},
  })
  const buttons = (row3dgs.children ?? []).filter((child) => child?.type === 'button')
  const swipeBtn = buttons.find((btn) => (btn.children ?? []).includes('◧'))
  assert.ok(swipeBtn, '图层行应渲染 ◧ 卷帘对比按钮')
  assert.equal(swipeBtn.props.disabled, true, '3DGS 图层的卷帘按钮必须置灰禁用')
  assert.match(swipeBtn.props.title, /3DGS 图层不支持裁剪卷帘对比/)
  assert.equal(typeof MESSAGES.en['swipe.unsupported3dgs'], 'string')
})

// ---------------------------------------------------------------------------
// Regression (1.5.2 local build): the React state passed to the panel is a
// projection without the runtime `tileset`, and `useSwipe` used to hand that
// projection to the engine. Every 3D swipe therefore failed with "unavailable"
// even though the layer row showed the eye open. The engine must read the full
// layer source, and the projection must still expose `kind` for the 3DGS guard.
// ---------------------------------------------------------------------------
test('需求 B 回归：卷帘引擎读取完整图层（含 tileset），不读 UI 投影', () => {
  const tileset = { name: 'tileset' }
  const full = [{ id: 'a', name: 'a', visible: true, kind: 'mesh', tileset }]
  const projection = [{ id: 'a', name: 'a', visible: true, kind: 'mesh' }]
  assert.equal(engineLayersOf({ getLayers: () => full, layers: projection }), full, '有完整来源时必须用完整图层')
  assert.equal(engineLayersOf({ layers: projection }), projection, '没有完整来源时退回投影，不得抛错')
  assert.deepEqual(engineLayersOf({}), [], '缺失来源时返回空数组而不是 undefined')

  const client = clientSource()
  assert.match(client, /getLayers: \(\) => layersRef\.current/, 'useSwipe 必须收到完整图层来源')
  assert.match(client, /kind: layer\.kind/, 'UI 投影必须携带 kind，否则 3DGS 按钮无法置灰')
})

// ---------------------------------------------------------------------------
// Regression (1.5.2 local build): `useSwipe` reconciles the session with the
// lightweight UI projection, which has no `tileset`. The engine used to treat
// that as "layer disappeared" and stopped the session on the first effect, so
// the split line never appeared and nothing visibly happened after the click.
// ---------------------------------------------------------------------------
test('需求 B 回归：用 UI 投影 reconcile 不得误停 3D 卷帘会话', () => {
  const Cesium = RealCesium
  const eye = new Cesium.Cartesian3(0, 0, 1000)
  const camera = {
    positionWC: eye,
    directionWC: new Cesium.Cartesian3(0, 0, -1),
    upWC: new Cesium.Cartesian3(0, 1, 0),
    rightWC: new Cesium.Cartesian3(1, 0, 0),
    frustum: { aspectRatio: 800 / 600, fovy: Math.PI / 3 },
  }
  const center = new Cesium.Cartesian3(0, 0, 6378137)
  const tileset = {
    boundingSphere: { center },
    clippingPlanesOriginMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(center),
    clippingPlanes: null,
  }
  const full = [{ id: 'layer-1', name: 'layer', visible: true, kind: 'mesh', tileset }]
  const projection = [{ id: 'layer-1', name: 'layer', visible: true, kind: 'mesh' }]
  const preRender = { listeners: [], addEventListener(fn) { this.listeners.push(fn); return () => {} }, removeEventListener() {} }
  const viewer = { camera, scene: { preRender, requestRender() {} }, canvas: { clientWidth: 800, clientHeight: 600 } }

  const session = createSwipeSession({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    getLayers: () => full,
  })
  const res = session.start3d('layer-1')
  assert.equal(res.ok, true, '完整图层应能启动 3D 卷帘')
  assert.equal(session.reconcile({ layers: projection }), false, 'UI 投影不含 tileset 时不得停掉会话')
  assert.equal(session.getState()?.id, 'layer-1')
  assert.equal(session.reconcile({ layers: [{ id: 'layer-1', visible: false }] }), true, '图层隐藏时必须退出')
  assert.equal(session.getState(), null)
  assert.ok(tileset.clippingPlanes, '退出后集合保留')
  assert.equal(tileset.clippingPlanes.enabled, false, '退出后仅禁用裁剪')
})

// ---------------------------------------------------------------------------
// Regression: assigning `undefined` to `tileset.clippingPlanes` destroys the
// collection and its clipping texture while tile draw commands still reference
// it, so Cesium stops rendering with "Cannot read properties of undefined
// (_target)". A layer already clipped by the clip analysis is a conflict.
// ---------------------------------------------------------------------------
test('需求 B 回归：已有剖切分析的图层拒绝卷帘，不抢占 clippingPlanes', () => {
  const Cesium = RealCesium
  const center = new Cesium.Cartesian3(0, 0, 6378137)
  const foreign = new Cesium.ClippingPlaneCollection({
    planes: [new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 0, -1), 0)],
  })
  const tileset = {
    boundingSphere: { center },
    clippingPlanesOriginMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(center),
    clippingPlanes: foreign,
  }
  const camera = {
    positionWC: new Cesium.Cartesian3(0, 0, 1000),
    directionWC: new Cesium.Cartesian3(0, 0, -1),
    upWC: new Cesium.Cartesian3(0, 1, 0),
    rightWC: new Cesium.Cartesian3(1, 0, 0),
    frustum: { aspectRatio: 4 / 3, fovy: Math.PI / 3 },
  }
  const viewer = { camera, scene: { preRender: { addEventListener: () => () => {} }, requestRender() {} }, canvas: { clientWidth: 800, clientHeight: 600 } }
  const session = createSwipeSession({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    getLayers: () => [{ id: 'layer-1', name: 'layer', visible: true, kind: 'mesh', tileset }],
  })
  const res = session.start3d('layer-1')
  assert.equal(res.ok, false)
  assert.equal(res.reason, 'conflict')
  assert.equal(tileset.clippingPlanes, foreign, '外部剖切集合不得被替换')
})
