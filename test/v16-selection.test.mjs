/**
 * v1.6 B4 — canvas box selection MVP.
 *
 * The point of these tests is the GEODESY, not the pixels: a screen rectangle is
 * sampled along its edges, unprojected through the depth buffer, and turned into
 * a closed WGS84 polygon whose area/perimeter/height range is reported and
 * exported as GeoJSON. A tiny fake Cesium/viewer keeps the test browser-free.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  canvasPosition,
  circleAroundPoint,
  destinationPoint,
  groundRingFromScreen,
  polygonAreaSquareMeters,
  polygonPerimeterMeters,
  rectScreenRing,
  ringToPolygon,
  sampleLassoPath,
} from '../src/client/scene/screen-geodesy.js'
import { getSelectionTool, isSelectionActive, selectionRegion, selectionWaterHeight } from '../src/client/scene/selection-tools.js'
import { mergeDrawGeoJSON, overlayRowsWithEntities, removeAgentOverlay, removeAgentOverlayRows, resolveOverlayRows } from '../src/client/scene/agent-overlays.js'
import { clientSource, readRepoFile } from './helpers/source.mjs'

/** Screen (x, y) in CSS pixels → a synthetic ground point: 1 px = 1 m near 0,0. */
const METERS_PER_DEGREE = 111319.49079327358

class Cartesian2 {
  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }
}

class PolygonHierarchy {
  constructor(positions = []) {
    this.positions = positions
  }
}

const cartographicFromPosition = (position) => ({
  longitude: (position.x / 800) * 0.01,
  latitude: ((800 - position.y) / 800) * 0.01,
  height: 100 + position.y * 0.05,
})

function makeCesium({ skyFromX = Infinity } = {}) {
  const handlerActions = []
  class ScreenSpaceEventHandler {
    constructor() {
      this.actions = new Map()
    }
    setInputAction(action, type) {
      this.actions.set(type, action)
    }
    destroy() {}
  }
  const Cesium = {
    Cartesian2,
    Cartesian3: { fromDegrees: (lon, lat, height) => ({ lon, lat, height }) },
    PolygonHierarchy,
    Cartographic: { fromCartesian: (cartesian) => cartesian?.carto ?? null },
    Color: { fromCssColorString: (css) => ({ css, withAlpha: (alpha) => ({ css, alpha }) }) },
    CallbackProperty: class CallbackProperty {
      constructor(fn) {
        this.fn = fn
      }
    },
    ArcType: { GEODESIC: 1 },
    SceneTransforms: { worldToWindowCoordinates: (scene, cartesian) => cartesian?.screen ?? null },
    ScreenSpaceEventType: { LEFT_DOWN: 1, MOUSE_MOVE: 2, LEFT_UP: 3, RIGHT_CLICK: 4, LEFT_CLICK: 5, LEFT_DOUBLE_CLICK: 6 },
    ScreenSpaceEventHandler,
    _handlerActions: handlerActions,
  }
  return Cesium
}

function makeViewer(Cesium, { missAboveX = Infinity } = {}) {
  const entities = []
  const controller = { enableRotate: true, enableTranslate: true }
  const viewer = {
    canvas: { width: 1000, height: 800, clientWidth: 500, clientHeight: 400 },
    scene: {
      pickPositionSupported: true,
      canvas: { width: 1000, height: 800, clientWidth: 500, clientHeight: 400 },
      screenSpaceCameraController: controller,
      requestRender() {},
      pickPosition: (position) => {
        if (position.x > missAboveX) return null
        return { carto: cartographicFromPosition({ x: position.x, y: position.y }) }
      },
    },
    camera: { getPickRay: () => null },
    entities: {
      add: (options) => {
        entities.push(options)
        return options
      },
      remove: (entity) => {
        const index = entities.indexOf(entity)
        if (index >= 0) entities.splice(index, 1)
      },
    },
    _entities: entities,
    _controller: controller,
    _Cesium: Cesium,
  }
  return viewer
}

function fire(viewer, Cesium, type, event) {
  // The handler instance is created inside the session; reach it through the
  // fake constructor's captured actions is awkward, so expose one active handler.
  const handler = viewer._handler
  assert.ok(handler, 'selection session must install a handler')
  const action = handler.actions.get(type)
  assert.ok(action, `no action registered for ${type}`)
  action(event)
}

function makeTool(viewer, Cesium, overrides = {}) {
  const events = { commits: [], cancels: 0, toasts: [] }
  // Capture the handler instance created by the session.
  const Original = Cesium.ScreenSpaceEventHandler
  Cesium.ScreenSpaceEventHandler = class extends Original {
    constructor(canvas) {
      super(canvas)
      viewer._handler = this
    }
  }
  const tool = getSelectionTool(viewer, {
    getCesium: () => Cesium,
    t: (key) => key,
    showToast: (text) => events.toasts.push(text),
    onCommit: (selection) => events.commits.push(selection),
    onCancel: () => {
      events.cancels += 1
    },
    onClear: () => {},
    ...overrides,
  })
  return { tool, events }
}

test('屏幕量测：保留 CSS 像素、矩形边采样、地面环闭合与 GeoJSON', () => {
  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  const pixel = canvasPosition(viewer, { x: 250, y: 200 }, Cesium)
  assert.deepEqual({ x: pixel.x, y: pixel.y }, { x: 250, y: 200 })

  const ring = rectScreenRing({ x: 100, y: 100 }, { x: 300, y: 300 }, 6)
  assert.equal(ring.length, 24, '4 edges × 6 samples each')
  assert.deepEqual(ring[0], { x: 100, y: 100 })
  assert.deepEqual(ring[6], { x: 300, y: 100 })

  const ground = groundRingFromScreen(viewer, Cesium, ring)
  assert.equal(ground.complete, true)
  assert.ok(ground.points.length >= 3)
  assert.equal(ground.ring.length, ground.points.length + 1, 'ring is closed for GeoJSON')
  assert.deepEqual(ground.ring[0], ground.ring.at(-1))
  const polygon = ringToPolygon(ground.points.map((point) => [point.lon, point.lat]))
  assert.equal(polygon.type, 'Polygon')
  assert.deepEqual(polygon.coordinates[0][0], polygon.coordinates[0].at(-1))
  assert.ok(ground.heightRange.min <= ground.heightRange.max)
})

test('天空/地平线命中失败：计数 misses，全部失败时不产出几何', () => {
  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium, { missAboveX: 250 })
  const ring = rectScreenRing({ x: 100, y: 100 }, { x: 300, y: 300 }, 6)
  const partial = groundRingFromScreen(viewer, Cesium, ring)
  assert.ok(partial.misses > 0)
  assert.equal(partial.complete, false)
  assert.ok(partial.points.length >= 3, 'the visible part is still usable')

  const viewerSky = makeViewer(makeCesium(), { missAboveX: -1 })
  const none = groundRingFromScreen(viewerSky, makeCesium(), ring)
  assert.equal(none.points.length, 0)
  assert.equal(none.complete, false)
})

test('面积/周长纯函数：1°×1° 赤道附近与已知椭球尺度一致', () => {
  const ring = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ]
  const area = polygonAreaSquareMeters(ring)
  const perimeter = polygonPerimeterMeters(ring)
  const side = METERS_PER_DEGREE
  assert.ok(Math.abs(area - side * side) / (side * side) < 0.02, `area ${area}`)
  assert.ok(Math.abs(perimeter - 4 * side) / (4 * side) < 0.01, `perimeter ${perimeter}`)
  // 1° longitude shrinks with latitude: area at 60°N is about half.
  const north = polygonAreaSquareMeters([
    [0, 60],
    [1, 60],
    [1, 61],
    [0, 61],
    [0, 60],
  ])
  assert.ok(north < area * 0.6 && north > area * 0.4, `north area ${north}`)
  assert.equal(polygonAreaSquareMeters([[0, 0], [1, 0]]), 0)
})

test('会话：拖拽提交矩形、导出 GeoJSON、清除后不残留', () => {
  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  const { tool, events } = makeTool(viewer, Cesium)

  assert.equal(isSelectionActive(viewer), false)
  assert.equal(tool.start(), true, tool.getLastError() ?? '')
  assert.equal(isSelectionActive(viewer), true)

  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  assert.equal(viewer._controller.enableRotate, false, 'camera rotation is off while drawing')
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 300, y: 300 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_UP, { position: { x: 300, y: 300 } })

  assert.equal(events.commits.length, 1)
  const selection = events.commits[0]
  assert.equal(selection.kind, 'rectangle')
  assert.ok(selection.area_m2 > 0)
  assert.ok(selection.perimeter_m > 0)
  assert.equal(isSelectionActive(viewer), false)
  assert.equal(viewer._controller.enableRotate, true, 'camera restored after the drag')
  assert.ok(viewer._entities.length >= 2, 'committed polygon + outline are drawn')

  const geojson = tool.exportGeoJSON()
  assert.equal(geojson.type, 'FeatureCollection')
  assert.equal(geojson.features.length, 1)
  const properties = geojson.features[0].properties
  assert.equal(properties.kind, 'digital-earth-selection')
  assert.ok(properties.area_m2 > 0)
  assert.ok(properties.perts === undefined)
  assert.equal(properties.height_reference, 'ellipsoid')
  assert.ok(properties.height_min_m <= properties.height_max_m)

  tool.clear()
  assert.equal(tool.getSelection(), null)
  assert.equal(tool.exportGeoJSON(), null)
  assert.equal(viewer._entities.length, 0, '清除后实体不残留')
})

test('框选反馈：拖动不反复读取深度，松开按最终位置采样；天空区域保留为可提问的画面范围', () => {
  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  const original = viewer.scene.pickPosition
  let picks = 0
  viewer.scene.pickPosition = (position) => { picks++; return original(position) }
  const { tool, events } = makeTool(viewer, Cesium)
  tool.start('rect')
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 200, y: 200 } })
  assert.equal(picks, 0)
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_UP, { position: { x: 300, y: 300 } })
  assert.ok(picks >= 24 && picks <= 128)
  assert.equal(events.commits[0].approximate, true)
  assert.equal(events.commits[0].source, 'screen-visible-surface')
  assert.equal(viewer._entities.find((item) => item.polyline).polyline.clampToGround, true)
  tool.start('rect')
  viewer.scene.pickPosition = () => null
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_UP, { position: { x: 300, y: 300 } })
  assert.equal(tool.getSelection().kind, 'screen')
  assert.equal(tool.exportGeoJSON(), null)
  assert.equal(tool.getSelection().area_m2, undefined)
  assert.equal(viewer._controller.enableRotate, true)
})

test('会话：右键取消恢复相机、不提交；再次框选替换旧结果', () => {
  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  const { tool, events } = makeTool(viewer, Cesium)

  tool.start()
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 200, y: 200 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.RIGHT_CLICK, {})
  assert.equal(events.commits.length, 0)
  assert.equal(events.cancels, 1)
  assert.equal(isSelectionActive(viewer), false)
  assert.equal(viewer._controller.enableRotate, true)

  tool.start()
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 240, y: 240 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_UP, { position: { x: 240, y: 240 } })
  assert.equal(events.commits.length, 1)
  const first = events.commits[0].area_m2
  tool.start()
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 320, y: 320 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_UP, { position: { x: 320, y: 320 } })
  assert.ok(events.commits[1].area_m2 > first, 'a larger box replaces the selection')
})

test('选区→分析：WGS84 范围、默认水位与超限拒绝', () => {
  const selection = {
    kind: 'rectangle',
    ring: [
      [3.16, 45.79],
      [3.17, 45.79],
      [3.17, 45.8],
      [3.16, 45.8],
      [3.16, 45.79],
    ],
    heightRange: { min: 342.4, max: 501.9, mean: 400 },
  }
  assert.deepEqual(selectionRegion(selection), { west: 3.16, south: 45.79, east: 3.17, north: 45.8 })
  assert.equal(selectionWaterHeight(selection), 342, '水位取边界最低高程（取整）')
  assert.equal(selectionWaterHeight({}), 0)
  assert.equal(selectionRegion(null), null)
  assert.equal(selectionRegion({ ring: [[0, 0], [1, 1]] }), null)
  // The flood API caps each side at 10°; oversize selections are rejected clearly.
  assert.equal(
    selectionRegion({ ring: [[0, 0], [12, 0], [12, 1], [0, 1], [0, 0]] }),
    null,
  )
})

test('接线：选择动作直连现有分析引擎与 Ask Agent，不新增工具', () => {
  const tool = readRepoFile('src/client/ui/selection-tool.js')
  assert.match(tool, /selectionRegion\(selection\)/)
  assert.match(tool, /selectionWaterHeight\(selection\)/)
  assert.match(tool, /action: 'flood'/)
  assert.match(tool, /source: terrain \? 'terrain' : 'surface'/)
  assert.match(tool, /t\('selection\.flood'\)/)

  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /runAnalysis: analyzeCommand,/)
  assert.match(viewer, /getTerrainActive: \(\) => Boolean\(sourcesRef\.current\?\.settings\?\.terrain\)/)
  assert.match(viewer, /getSelection: \(\) => peekSelection\(viewerRef\.current\)/)

  const ask = readRepoFile('src/client/scene/ask-agent.js')
  assert.match(ask, /getSelection/)
  assert.match(ask, /Selection \(\$\{selection\.kind/)
  assert.match(ask, /ring=\$\{JSON\.stringify\(rounded\)\}/)
})

test('点选：单击取点得到经纬度/高程，导出 GeoJSON Point，可算天际线方向', () => {
  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  const { tool, events } = makeTool(viewer, Cesium)

  tool.start('point')
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 200, y: 300 } })
  assert.equal(events.commits.length, 1)
  const selection = events.commits[0]
  assert.equal(selection.kind, 'point')
  assert.ok(Number.isFinite(selection.lon) && Number.isFinite(selection.lat))
  assert.ok(Number.isFinite(selection.height))
  assert.equal(isSelectionActive(viewer), false)

  const geojson = tool.exportGeoJSON()
  assert.equal(geojson.features[0].geometry.type, 'Point')
  assert.ok(Array.isArray(geojson.features[0].geometry.coordinates))
  assert.equal(geojson.features[0].properties.kind, 'digital-earth-selection')
  assert.ok(Number.isFinite(geojson.features[0].properties.height_m))

  // Skyline default direction: 300 m along the camera heading from the point.
  const north = destinationPoint([0, 0], 300, 0)
  assert.ok(Math.abs(north[0]) < 1e-9)
  assert.ok(Math.abs(north[1] - 300 / 111319.49079327358) < 1e-6)
  const east = destinationPoint([0, 0], 300, 90)
  assert.ok(Math.abs(east[0] - 300 / 111319.49079327358) < 1e-6)
  tool.clear()
})

test('点选接线：工具卡点选/天际线入口，工具栏「工具」直开工作台', () => {
  const tool = readRepoFile('src/client/ui/selection-tool.js')
  assert.match(tool, /selection\.point/)
  assert.match(tool, /selection\.pointHint/)
  assert.match(tool, /action: 'skyline'/)
  assert.match(tool, /destinationPoint\(/)
  assert.match(tool, /selection\.skylineFailed/)

  // No dropdown/arrow on the toolbar: the Tools card is the surface.
  const quick = readRepoFile('src/client/ui/toolbar-quick.js')
  assert.match(quick, /t\('btn\.tools'\)/)
  assert.doesNotMatch(quick, /MenuItem|menu\(/)
  const tools = readRepoFile('src/client/ui/tools-panel.js')
  assert.match(tools, /tool\.distance/)
  assert.match(tools, /t\('profile\.draw'\)/)
  const client = clientSource()
  assert.doesNotMatch(client, /menu\(\s*'measure'/)
})

test('套索：自由手绘路径抽稀+上限，松开后生成多边形选区', () => {
  const dense = Array.from({ length: 40 }, (_, index) => ({ x: index * 5, y: Math.sin(index / 4) * 40 + 200 }))
  const thinned = sampleLassoPath(dense, { minSpacing: 8, maxPoints: 120 })
  assert.ok(thinned.length < dense.length, '路径必须抽稀')
  assert.deepEqual(thinned[0], dense[0])
  assert.deepEqual(thinned.at(-1), dense.at(-1))
  const capped = sampleLassoPath(dense, { minSpacing: 1, maxPoints: 10 })
  assert.equal(capped.length, 10, '点数必须有上限')
  assert.deepEqual(sampleLassoPath(null), [])

  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  const { tool, events } = makeTool(viewer, Cesium)
  tool.start('lasso')
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  for (const [x, y] of [[150, 100], [200, 150], [200, 250], [150, 300], [100, 300]]) {
    fire(viewer, Cesium, Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x, y } })
  }
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_UP, { position: { x: 100, y: 300 } })
  assert.equal(events.commits.length, 1)
  const selection = events.commits[0]
  assert.equal(selection.kind, 'lasso')
  assert.ok(selection.area_m2 > 0)
  assert.equal(isSelectionActive(viewer), false)
  assert.equal(viewer._controller.enableRotate, true)
  const geojson = tool.exportGeoJSON()
  assert.equal(geojson.features[0].geometry.type, 'Polygon')
  assert.equal(geojson.features[0].properties.shape, 'lasso')
  tool.clear()
})

test('识别点→近似选区：圆环面积接近 πr²，会话提交并标记 approximate', () => {
  const ring = circleAroundPoint([3.17, 45.79], 15, 16)
  assert.equal(ring.length, 17, '16 段圆环 + 闭合点')
  assert.deepEqual(ring[0], ring.at(-1))
  const area = polygonAreaSquareMeters(ring)
  const expected = Math.PI * 15 * 15
  assert.ok(Math.abs(area - expected) / expected < 0.03, `area ${area}`)
  assert.ok(circleAroundPoint(null, 10).length === 0)

  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  const { tool, events } = makeTool(viewer, Cesium)
  const selection = tool.selectAreaAround({ lon: 3.17, lat: 45.79, radiusM: 15, height: 100 })
  assert.ok(selection)
  assert.equal(selection.kind, 'area')
  assert.equal(selection.approximate, true)
  assert.ok(selection.area_m2 > 0)
  assert.equal(events.commits.length, 1, '程序化选区也要通知 UI')
  assert.equal(tool.exportGeoJSON().features[0].geometry.type, 'Polygon')
  assert.ok(viewer._entities.length >= 2, 'AOI 多边形与描边已绘制')
  tool.clear()
})

test('接线：识别卡「框选此点周围」→ 程序化 AOI，不冒充建筑轮廓', () => {
  const overlay = readRepoFile('src/client/ui/selection-overlay.js')
  assert.match(overlay, /onSelectArea/)
  assert.match(overlay, /const selectAround = \(\) =>/)
  assert.match(overlay, /t\('selection\.areaAction'\)/)
  assert.match(overlay, /t\('selection\.approximate'\)/)
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /onSelectArea: \(card\) =>/)
  assert.match(viewer, /selectAreaAround\?\.\(\{ lon: card\.point\.lon/)
  assert.match(viewer, /setShowTools\(true\)/)
  const tool = readRepoFile('src/client/ui/selection-tool.js')
  assert.match(tool, /selection\.approximate/)
  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['selection.areaAction', 'selection.approximate']) {
    const hits = messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.equal(hits.length, 2, `缺少中英 ${key}`)
  }
})

test('对象框选：投影命中已有标注，批量选择/删除，不新增空间几何', () => {
  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  // The test doubles expose a fake screen position through SceneTransforms.
  const groups = [
    { kind: 'draw', index: 0, label: '标注 1', entities: [{ position: { screen: { x: 150, y: 150 } } }] },
    { kind: 'measure', index: 0, label: '量测 1', entities: [{ position: { screen: { x: 900, y: 700 } } }] },
  ]
  const { tool, events } = makeTool(viewer, Cesium, { getOverlayRows: () => groups })

  tool.start('objects')
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 250, y: 250 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_UP, { position: { x: 250, y: 250 } })
  assert.equal(events.commits.length, 1)
  const selection = events.commits[0]
  assert.equal(selection.kind, 'objects')
  assert.equal(selection.rows.length, 1)
  assert.equal(selection.rows[0].label, '标注 1')
  assert.equal(tool.exportGeoJSON(), null, '对象框选不是新的 GeoJSON 几何')
  assert.equal(isSelectionActive(viewer), false)
  assert.equal(viewer._controller.enableRotate, true)
  tool.clear()
})

test('对象选择：列表变动后导出和删除仍指向原对象，失效选择不会删除新对象', () => {
  const Cesium = makeCesium()
  const viewer = makeViewer(Cesium)
  const commands = ['A', 'B', 'C'].map((name) => ({
    caption: name,
    drawn: 1,
    geojson: { type: 'Feature', properties: { name }, geometry: { type: 'Point', coordinates: [0, 0] } },
  }))
  const state = { drawCommands: commands.slice(), measureCommands: [], draw: [], measure: [], drawnFeatures: 3, measuredCount: 0, entityGroups: new WeakMap() }
  commands.forEach((command, index) => state.entityGroups.set(command, [{ position: { screen: { x: index === 1 ? 150 : 500, y: 150 } } }]))
  const { tool } = makeTool(viewer, Cesium, { getOverlayRows: () => overlayRowsWithEntities(state) })
  tool.start('objects')
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 100, y: 100 } })
  fire(viewer, Cesium, Cesium.ScreenSpaceEventType.LEFT_UP, { position: { x: 200, y: 200 } })
  const selected = tool.getSelection().rows
  assert.equal(selected.length, 1)
  assert.equal(selected[0].label, 'B')
  removeAgentOverlay(state, viewer, 'draw', 0)
  const exported = mergeDrawGeoJSON(resolveOverlayRows(selected, overlayRowsWithEntities(state)))
  assert.deepEqual(exported.features, [commands[1].geojson])
  assert.equal(removeAgentOverlayRows(state, viewer, [...selected, ...selected]), 1)
  assert.deepEqual(state.drawCommands.map((command) => command.caption), ['C'])
  assert.equal(removeAgentOverlayRows(state, viewer, selected), 0)
  assert.equal(mergeDrawGeoJSON(resolveOverlayRows(selected, overlayRowsWithEntities(state))), null)
  state.drawCommands = commands.map((command) => ({ ...command }))
  assert.equal(removeAgentOverlayRows(state, viewer, selected), 0)
  tool.dispose()
})

test('对象导出：合并选中标注的 GeoJSON，量测不参与', () => {
  const rows = [
    {
      kind: 'draw',
      geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { a: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } }] },
    },
    { kind: 'draw', geojson: { type: 'Feature', properties: { b: 2 }, geometry: { type: 'Point', coordinates: [1, 1] } } },
    { kind: 'draw', geojson: { type: 'LineString', coordinates: [[2, 2], [3, 3]] } },
    { kind: 'measure', label: '量测 1' },
    { kind: 'draw', geojson: null },
  ]
  const merged = mergeDrawGeoJSON(rows)
  assert.equal(merged.type, 'FeatureCollection')
  assert.equal(merged.features.length, 3)
  assert.equal(merged.features[2].geometry.type, 'LineString')
  assert.equal(mergeDrawGeoJSON([{ kind: 'measure' }]), null)
  assert.equal(mergeDrawGeoJSON(null), null)
})

test('对象行：带实体列表与批量删除（按 kind 降序避免索引错位）', () => {
  const state = {
    draw: [],
    measure: [],
    drawnFeatures: 2,
    measuredCount: 2,
    drawCommands: [{ geojson: { type: 'FeatureCollection', features: [{}, {}] }, caption: 'A', drawn: 2 }],
    measureCommands: [{ mode: 'distance', points: [{}, {}], result: { distance_m: 12.3 } }],
    entityGroups: new WeakMap(),
  }
  const destroyed = []
  const viewer = { entities: { remove: (entity) => destroyed.push(entity) } }
  const drawEntities = [{}, {}]
  state.entityGroups.set(state.drawCommands[0], drawEntities)
  state.entityGroups.set(state.measureCommands[0], [{}])
  state.draw.push(...drawEntities)
  state.measure.push({})

  const rows = overlayRowsWithEntities(state)
  assert.equal(rows.length, 2)
  assert.equal(rows.find((row) => row.kind === 'draw').entities.length, 2)

  const removed = removeAgentOverlayRows(state, viewer, rows)
  assert.equal(removed, 2)
  assert.equal(state.drawCommands.length, 0)
  assert.equal(state.measureCommands.length, 0)
  assert.equal(state.drawnFeatures, 0)
  assert.equal(state.measuredCount, 0)
  assert.equal(destroyed.length, 3)
})

test('接线：工具卡包含选择工具，ViewerSurface 在选择时让出画布点击', () => {
  const tools = readRepoFile('src/client/ui/tools-panel.js')
  assert.match(tools, /import \{ SelectionTool \}/)
  assert.match(tools, /t\('tools\.select'\)/)
  assert.match(tools, /h\(SelectionTool, /)
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /isSelectionActive\(viewerRef\.current\)/)
  assert.match(viewer, /showToast,/)
  assert.match(tools, /getOverlayRows/)
  assert.match(tools, /onRemoveOverlayRows/)
  assert.match(viewer, /getOverlayRows: \(\) => \{/)
  assert.match(viewer, /manualMeasurementRow\(measureRef\.current\.entities/)
  assert.match(viewer, /removeAgentOverlayRows/)
  const selectionTool = readRepoFile('src/client/ui/selection-tool.js')
  assert.match(selectionTool, /selection\.objects/)
  assert.match(selectionTool, /selection\.objectsRemove/)
  assert.match(selectionTool, /selection\.objectsExport/)
  assert.match(selectionTool, /mergeDrawGeoJSON/)
  // Six-tool contract is untouched: selection is panel-only.
  const contract = readRepoFile('test/v16-contract.test.mjs')
  assert.match(contract, /earth_scene', 'earth_capture'/)
})
