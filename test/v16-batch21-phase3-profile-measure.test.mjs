/**
 * v1.6 Phase 3 (P3-3) — Profile overhaul (elevation profile clarity, source &
 * sample density controls, clean terrain/surface chart & metrics without
 * roadbed cut/fill clutter) + live MOUSE_MOVE rubber-band preview for manual
 * distance / area / height measurements.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const ReactModule = await import('react')
const React = ReactModule.default
const { MESSAGES } = await import('../src/client/messages.js')
const { PROFILE_MESSAGES } = await import('../src/client/messages-profile.js')
const { profileMetrics, profileCsv, profileSvg } = await import('../src/client/analysis/profile-metrics.js')
const { AnalysisProfileChart } = await import('../src/client/ui/profile-chart.js')
const { AnalysisCard } = await import('../src/client/ui/cards.js')
const { AnalysisBody } = await import('../src/client/ui/tool-windows.js')
const { createProfileTool } = await import('../src/client/scene/profile-tool.js')
const { createMeasurePreview } = await import('../src/client/scene/measure-preview.js')
const { installCanvasInput } = await import('../src/client/scene/canvas-input.js')

const SAMPLES = [
  { distance_m: 0, height_m: 42 },
  { distance_m: 100, height_m: 60 },
  { distance_m: 200, height_m: 54 },
  { distance_m: 300, height_m: 38 },
]

function t(dict = MESSAGES.zh) {
  return (key, params) => {
    let text = dict[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v))
    }
    return text
  }
}

function renderStub(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node
  if (typeof node.type === 'function') {
    return renderStub(node.type({ ...(node.props ?? {}), children: node.children }))
  }
  return node
}

function collectText(raw, out = []) {
  const node = renderStub(raw)
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out)
    return out
  }
  if (Array.isArray(node.children)) collectText(node.children, out)
  else if (node?.props?.children) collectText(node.props.children, out)
  return out
}

function findElements(raw, predicate, out = []) {
  const node = renderStub(raw)
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, out)
    return out
  }
  if (predicate(node)) out.push(node)
  if (Array.isArray(node.children)) findElements(node.children, predicate, out)
  else if (node.props?.children) findElements(node.props.children, predicate, out)
  return out
}

test('profileMetrics/CSV/SVG (includeDesign: false)：输出高程纵断面核心指标，不含道路挖填方', () => {
  const metrics = profileMetrics(SAMPLES, { includeDesign: false })
  assert.equal(metrics.include_design, false)
  assert.equal(metrics.start_height_m, 42)
  assert.equal(metrics.end_height_m, 38)
  assert.equal(metrics.net_elevation_m, -4)
  assert.equal(metrics.min_height_m, 38)
  assert.equal(metrics.min_at_m, 300)
  assert.equal(metrics.max_height_m, 60)
  assert.equal(metrics.max_at_m, 100)
  assert.equal(metrics.relief_m, 22)
  assert.equal(metrics.gain_m, 18)
  assert.equal(metrics.loss_m, 22)

  const csv = profileCsv(metrics).trim().split(/\r\n/)
  assert.equal(csv[0], 'distance_m,height_m,slope_pct')
  assert.equal(csv.length, 5)
  assert.ok(!csv[0].includes('design_m'))

  const svg = profileSvg(metrics, { title: '高程纵断面', terrain: '采样表面', surfaceLength: '贴表面长度', slopeMean: '平均坡度' })
  assert.ok(svg.startsWith('<svg'))
  assert.ok(svg.includes('fill="#dbeafe"'), 'should draw clean elevation area shading')
  assert.ok(svg.includes('max 60.0 m') && svg.includes('min 38.0 m'), 'should mark extrema')
  assert.ok(!svg.includes('#c2610a'), 'must not draw roadbed design line when includeDesign is false')
})

test('AnalysisCard & AnalysisProfileChart：展示高程纵断面核心统计且无路宽/挖填方控件', () => {
  const translate = t(MESSAGES.zh)
  const tree = AnalysisCard({
    t: translate,
    state: {
      operation: 'profile',
      layerName: 'Campus Mesh',
      result: {
        length_m: 300,
        samples: 32,
        height_source: 'tiles',
        from: [113.14, 31.02],
        to: [113.143, 31.021],
        stats: { min_height: 38, max_height: 60, relief_m: 22, gain_m: 18, loss_m: 22 },
        points: SAMPLES,
      },
    },
    onClose: () => {},
  })
  const text = collectText(tree).join(' | ')
  assert.ok(text.includes('高程纵断面'))
  assert.ok(text.includes('贴表面长度'))
  assert.ok(text.includes('起 / 终高程'))
  assert.ok(text.includes('起终点高差'))
  assert.ok(text.includes('起终点坐标'))
  assert.ok(!text.includes('路宽'), 'must remove unwanted road width input')
  assert.ok(!text.includes('起终点坡线'), 'must remove unwanted earthwork baseline select')
  assert.ok(!text.includes('挖方'), 'must remove cut earthwork row')
  assert.ok(!text.includes('填方'), 'must remove fill earthwork row')

  const chartEl = AnalysisProfileChart({ points: SAMPLES, t: translate, hoverIndex: 1 })
  const polys = findElements(chartEl, (el) => el.type === 'polygon')
  const circles = findElements(chartEl, (el) => el.type === 'circle')
  assert.equal(polys.length, 1, 'thumbnail should include filled area polygon')
  assert.equal(circles.length, 2, 'peak dot + hover marker dot')
})

test('AnalysisBody & createProfileTool：支持切换高程采样目标（三维表面/纯地形）与采样点数（16/32/64）', async () => {
  const started = []
  const translate = t(MESSAGES.zh)
  const body = AnalysisBody({
    t: translate,
    analysis: null,
    onStartProfile: (opts) => started.push(opts),
    onClearAnalysis: () => {},
    getCesium: () => null,
    getViewer: () => null,
    getLayers: () => [],
  })
  const selects = findElements(body, (el) => el.type === 'select')
  assert.equal(selects.length, 2, 'should expose elevation source and sample density selects')
  const drawBtn = findElements(body, (el) => el.type === 'button' && collectText(el).join('') === '绘制高程纵断面')[0]
  assert.ok(drawBtn)
  drawBtn.props.onClick()
  assert.deepEqual(started[0], { source: 'tiles', samples: 32 })

  const calls = []
  let picks = 0
  const Cesium = {
    ScreenSpaceEventHandler: class { setInputAction() {} destroy() {} },
    ScreenSpaceEventType: { MOUSE_MOVE: 'MOUSE_MOVE' },
    CallbackProperty: class { constructor(read) { this.read = read } getValue() { return this.read() } },
    ArcType: { GEODESIC: 0 },
    Color: { WHITE: {}, fromCssColorString: () => ({ withAlpha: () => ({}) }) },
    Cartographic: { fromCartesian: (c) => ({ longitude: c.lon, latitude: c.lat }) },
    Math: { toDegrees: (v) => v },
  }
  const viewer = {
    scene: { canvas: {}, requestRender: () => {} },
    entities: { add: () => ({}), remove: () => {} },
  }
  const profileTool = createProfileTool({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    pickSurface: () => { picks += 1; return { lon: picks * 0.1, lat: picks * 0.1 } },
    setTool: () => {},
    runAnalysis: async (args) => calls.push(args),
    showToast: () => {},
    t: (k) => k,
  })
  profileTool.start({ source: 'terrain', samples: 64 })
  profileTool.onPoint({ x: 1, y: 1 })
  profileTool.onPoint({ x: 2, y: 2 })
  await Promise.resolve()
  assert.deepEqual(calls[0], {
    action: 'profile',
    from: [0.1, 0.1],
    to: [0.2, 0.2],
    samples: 64,
    source: 'terrain',
  })
})

function makeMeasureHarness(initialTool = 'distance', initialPoints = []) {
  const entities = []
  let renders = 0
  let pickCount = 0
  let nextPick = { x: 10, y: 20, z: 30, lon: 1.0, lat: 0.5, height: 15 }
  const state = { tool: initialTool, points: [...initialPoints] }
  class CallbackProperty {
    constructor(read) { this.read = read }
    getValue() { return this.read() }
  }
  const color = () => ({ withAlpha: () => color() })
  const Cesium = {
    CallbackProperty,
    PolylineDashMaterialProperty: class { constructor(o) { this.options = o } },
    PolygonHierarchy: class { constructor(positions) { this.positions = positions } },
    Cartesian2: class { constructor(x, y) { this.x = x; this.y = y } },
    Cartesian3: { fromRadians: (lon, lat, height) => ({ lon, lat, height, isCorner: true }) },
    Cartographic: { fromCartesian: (p) => ({ longitude: p.lon ?? 0, latitude: p.lat ?? 0, height: p.height ?? 0 }) },
    EllipsoidGeodesic: class {
      constructor(a, b) {
        this.surfaceDistance = Math.hypot((b.longitude - a.longitude) * 100, (b.latitude - a.latitude) * 100)
      }
    },
    Color: { WHITE: color(), fromCssColorString: color },
    LabelStyle: { FILL: 1 },
  }
  const viewer = {
    scene: { requestRender: () => { renders += 1 } },
    entities: {
      add: (options) => {
        const entity = { options, removed: false }
        entities.push(entity)
        return entity
      },
      remove: (entity) => { if (entity) entity.removed = true },
    },
  }
  const preview = createMeasurePreview({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    toolRef: { get current() { return state.tool }, set current(v) { state.tool = v } },
    measureRef: { get current() { return state } },
    pickSurface: () => { pickCount += 1; return nextPick },
    geodesicLength: (_, pts) => pts.reduce((sum, pt, idx) => (idx === 0 ? 0 : sum + Math.hypot(pt.x - pts[idx - 1].x, pt.y - pts[idx - 1].y)), 0),
    planarArea: (_, pts) => pts.length * 100,
    formatDistance: (m) => `${m.toFixed(1)} m`,
    formatArea: (a) => `${a.toFixed(0)} m²`,
    t: t(MESSAGES.en),
  })
  return {
    preview,
    state,
    entities,
    get renders() { return renders },
    get pickCount() { return pickCount },
    setPick: (v) => { nextPick = v },
  }
}

test('createMeasurePreview：未落点或非量测模式不触发 pick；测距/测面/测高均实时跟随 MOUSE_MOVE 并正确清理', () => {
  // Before point 1 -> zero pickSurface overhead
  const idle = makeMeasureHarness('distance', [])
  idle.preview.onMove({ x: 50, y: 50 })
  assert.equal(idle.pickCount, 0)
  assert.equal(idle.entities.length, 0)

  const identify = makeMeasureHarness('identify', [{ x: 0, y: 0, height: 10 }])
  identify.preview.onMove({ x: 50, y: 50 })
  assert.equal(identify.pickCount, 0)

  // Distance mode: 1st point -> dashed rubber-band + cursor distance badge; 2nd point -> segment + total
  const p1 = { x: 0, y: 0, height: 10 }
  const dist = makeMeasureHarness('distance', [p1])
  dist.preview.sync('distance')
  dist.setPick({ x: 30, y: 40, height: 10 })
  dist.preview.onMove({ x: 100, y: 120 })
  const line = dist.entities.find((e) => e.options.polyline)
  const label = dist.entities.find((e) => e.options.label || typeof e.options.text === 'object')
  assert.ok(line && label, 'distance preview installs dashed polyline + cursor label')
  assert.equal(line.options.polyline.positions.getValue().length, 2)
  assert.equal(line.options.show.getValue(), true)
  assert.equal(label.options.text.getValue(), '+50.0 m')

  dist.state.points.push({ x: 30, y: 40, height: 10 })
  dist.preview.sync('distance')
  dist.setPick({ x: 30, y: 50, height: 10 })
  dist.preview.onMove({ x: 110, y: 125 })
  const label2 = dist.entities.filter((e) => !e.removed && e.options.text).at(-1)
  assert.equal(label2.options.text.getValue(), '+10.0 m · Total 60.0 m')

  // Off-surface hover hides preview without leaving artifacts
  dist.setPick(null)
  dist.preview.onMove({ x: 130, y: 140 })
  const line2 = dist.entities.filter((e) => !e.removed && e.options.polyline).at(-1)
  assert.equal(line2.options.show.getValue(), false)

  dist.preview.clear()
  assert.equal(dist.entities.every((e) => e.removed), true)

  // Area mode with >= 2 points -> live polygon + closing boundary + area preview
  const area = makeMeasureHarness('area', [{ x: 0, y: 0 }, { x: 10, y: 0 }])
  area.preview.sync('area')
  area.setPick({ x: 5, y: 8 })
  area.preview.onMove({ x: 60, y: 60 })
  const poly = area.entities.find((e) => e.options.polygon)
  const boundary = area.entities.find((e) => e.options.polyline)
  const areaLabel = area.entities.find((e) => e.options.text)
  assert.ok(poly && boundary && areaLabel)
  assert.equal(poly.options.polygon.hierarchy.getValue().positions.length, 3)
  assert.equal(boundary.options.polyline.positions.getValue().length, 3)
  assert.equal(areaLabel.options.text.getValue(), 'Preview area 300 m²')

  // Height mode with 1 point -> hypotenuse + right-angle plumb guide + Δh label; clears after 2nd click
  const height = makeMeasureHarness('height', [{ lon: 0, lat: 0, height: 10 }])
  height.preview.sync('height')
  height.setPick({ lon: 0.03, lat: 0.04, height: 22.5 })
  height.preview.onMove({ x: 80, y: 90 })
  const heightLines = height.entities.filter((e) => e.options.polyline)
  const heightLabel = height.entities.find((e) => e.options.text)
  assert.equal(heightLines.length, 2, 'height preview shows direct line and vertical/horizontal plumb guide')
  assert.equal(heightLines[1].options.polyline.positions.getValue().length, 3)
  assert.equal(heightLabel.options.text.getValue(), 'Δh +12.50 m · horiz 5.0 m')

  height.state.points.push({ lon: 0.03, lat: 0.04, height: 22.5 })
  height.preview.sync('height')
  assert.equal(height.entities.every((e) => e.removed), true, 'clears ephemeral height preview once 2nd point finishes')
})

test('canvas-input 与 i18n：MOUSE_MOVE 在未进行框选时转发给量测预览，中英文案成对存在', () => {
  const actions = new Map()
  const moves = []
  let selecting = false
  const Cesium = {
    ScreenSpaceEventType: { LEFT_DOWN: 1, MOUSE_MOVE: 2, LEFT_CLICK: 3, LEFT_DOUBLE_CLICK: 4, RIGHT_CLICK: 5 },
    ScreenSpaceEventHandler: class { setInputAction(fn, type) { actions.set(type, fn) } destroy() {} },
  }
  const handler = installCanvasInput({
    Cesium,
    viewer: { scene: { canvas: {} } },
    isSelectionActive: () => selecting,
    onPointerMove: (pos) => moves.push(pos),
  })
  actions.get(2)({ endPosition: { x: 12, y: 34 } })
  selecting = true
  actions.get(2)({ endPosition: { x: 56, y: 78 } })
  handler.destroy()
  assert.deepEqual(moves, [{ x: 12, y: 34 }])

  for (const key of Object.keys(PROFILE_MESSAGES.zh)) {
    assert.ok(typeof PROFILE_MESSAGES.en[key] === 'string' && PROFILE_MESSAGES.en[key].length > 0, `missing en key ${key}`)
    assert.equal(MESSAGES.zh[key], PROFILE_MESSAGES.zh[key])
    assert.equal(MESSAGES.en[key], PROFILE_MESSAGES.en[key])
  }
})
