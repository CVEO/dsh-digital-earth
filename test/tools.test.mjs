/**
 * 绘制 / 量测工具的自检：宿主侧参数归一化 + 浏览器侧接线。
 *
 * 这两条链路上最重要的约定是「模型输入先被宿主收敛」：
 *   - earth_draw 只接受有界、合法的 GeoJSON（FeatureCollection / Feature / 裸几何），
 *     clear 可以单独使用，超限与未知参数必须报出 earth_draw: 前缀的错误；
 *   - earth_measure 按 distance / area / height 校验点数，draw 缺省为 true；
 *   - 浏览器侧必须还挂着四个工具行，runCommand 认识 draw / measure，
 *     collectSceneStatus 报告 annotations，中英词典都有对应文案。
 *
 * 渲染细节（Cesium 实体长什么样）由人工验证，不在这里重复；这里只钉住
 * 「接线还在、门禁还在」，任何一条挂掉都意味着 Agent 的绘制/量测会静默失效。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeDrawRequest, normalizeMeasureRequest } from '../index.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const client = await readFile(join(root, 'client.js'), 'utf8')
const host = await readFile(join(root, 'index.js'), 'utf8')

/** 一个只带坐标的 GeoJSON Feature。 */
const feature = (geometry, properties = {}) => ({ type: 'Feature', properties, geometry })
/** 一个只含 Point 的 Feature。 */
const point = (coordinates) => feature({ type: 'Point', coordinates })
/** 一个 FeatureCollection。 */
const collection = (...features) => ({ type: 'FeatureCollection', features })
/** 断言绘制参数被拒绝，并匹配宿主给出的 earth_draw: 文案。 */
const drawRejects = (raw, pattern) => assert.throws(() => normalizeDrawRequest(raw), pattern)
/** 断言量测参数被拒绝，并匹配宿主给出的 earth_measure: 文案。 */
const measureRejects = (raw, pattern) => assert.throws(() => normalizeMeasureRequest(raw), pattern)

// ---------------------------------------------------------------------------
// earth_draw：宿主侧归一化
// ---------------------------------------------------------------------------

test('draw：合法 FeatureCollection 字符串被解析成归一化 GeoJSON', () => {
  const raw = {
    features: JSON.stringify(
      collection(
        feature(
          { type: 'LineString', coordinates: [[116.4, 39.9], [116.5, 40.0]] },
          { name: ' 路线 ', nested: { drop: true }, count: 2 },
        ),
      ),
    ),
    style: 'alert',
    label: '  标注  ',
  }
  const { args } = normalizeDrawRequest(raw)
  assert.equal(args.clear, false)
  assert.equal(args.style, 'alert')
  assert.equal(args.label, '标注', 'label 应去除首尾空白')
  assert.equal(args.geojson.type, 'FeatureCollection')
  assert.equal(args.geojson.features.length, 1)
  // 只保留标量属性，并用 name 作为显示名；嵌套对象被丢弃。
  assert.deepEqual(args.geojson.features[0], {
    type: 'Feature',
    properties: { name: '路线', count: 2 },
    geometry: { type: 'LineString', coordinates: [[116.4, 39.9], [116.5, 40.0]] },
  })
})

test('draw：裸几何与裸 Feature 都被包装成 FeatureCollection', () => {
  const polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
  const bareGeometry = normalizeDrawRequest({ features: polygon })
  assert.deepEqual(bareGeometry.args.geojson, collection(feature(polygon)))

  const bareFeature = normalizeDrawRequest({ features: feature({ type: 'Point', coordinates: [12, 34] }, { title: ' 站点 ' }) })
  assert.equal(bareFeature.args.geojson.features.length, 1)
  assert.equal(bareFeature.args.geojson.features[0].properties.name, '站点', 'title 应派生成 name')

  const flattened = normalizeDrawRequest({
    features: { type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [1, 2] }, { type: 'Point', coordinates: [3, 4] }] },
  })
  assert.deepEqual(flattened.args.geojson.features.map((item) => item.geometry.coordinates), [[1, 2], [3, 4]])
})

test('draw：clear=true 可以单独使用，清掉旧标注不要求 features', () => {
  assert.deepEqual(normalizeDrawRequest({ clear: true }), { args: { clear: true, style: 'accent' } })
  // 空集合或全空几何配合 clear 时同样合法：没有东西可画，但清空动作有效。
  assert.deepEqual(normalizeDrawRequest({ clear: true, features: collection() }), { args: { clear: true, style: 'accent' } })
  assert.deepEqual(normalizeDrawRequest({ clear: true, features: feature(null) }), { args: { clear: true, style: 'accent' } })
})

test('draw：非法 JSON、空要素、缺 features 都被拒绝', () => {
  drawRejects({ features: '{ not json' }, /earth_draw: "features" must be valid GeoJSON JSON/)
  drawRejects({ features: collection() }, /earth_draw: "features" contains no drawable features/)
  drawRejects({}, /earth_draw: needs "features" with GeoJSON to draw, or clear=true/)
})

test('draw：越界经纬度被拒绝', () => {
  drawRejects({ features: point([180.5, 0]) }, /earth_draw: longitude 180\.5 is outside -180\.\.180 degrees/)
  drawRejects({ features: point([0, -90.5]) }, /earth_draw: latitude -90\.5 is outside -90\.\.90 degrees/)
  drawRejects({ features: point([0, 0, 10000001]) }, /earth_draw: height must be within/)
})

test('draw：不支持的几何类型被拒绝', () => {
  drawRejects({ features: { type: 'Circle', coordinates: [0, 0] } }, /earth_draw: unsupported geometry type "Circle"/)
  drawRejects(
    { features: feature({ type: 'CircularString', coordinates: [[0, 0], [1, 1]] }) },
    /earth_draw: unsupported geometry type "CircularString"/,
  )
  // 没有 geometry 的 Feature 被跳过：既不是错误类型，也没有可画的东西。
  drawRejects({ features: feature(undefined) }, /earth_draw: "features" contains no drawable features/)
})

test('draw：500 要素与 20000 坐标是上限，逐个越界都被拒绝', () => {
  const features = (count) => collection(...Array.from({ length: count }, () => point([0, 0])))
  assert.equal(normalizeDrawRequest({ features: features(500) }).args.geojson.features.length, 500)
  drawRejects({ features: features(501) }, /earth_draw: the GeoJSON has more than 500 features/)

  const coordinates = (count) => ({ type: 'MultiPoint', coordinates: Array.from({ length: count }, (_, index) => [index % 180, 0]) })
  assert.equal(normalizeDrawRequest({ features: coordinates(20000) }).args.geojson.features[0].geometry.coordinates.length, 20000)
  drawRejects({ features: coordinates(20001) }, /earth_draw: the GeoJSON has more than 20000 coordinates/)
})

test('draw：未知参数、非法 style、非对象入参都被拒绝', () => {
  drawRejects({ clear: true, zoom: 3 }, /earth_draw: it does not accept "zoom"; accepted arguments: features, style, label, clear/)
  drawRejects({ clear: true, style: 'rainbow' }, /earth_draw: "style" must be one of accent, alert, success, warm, violet/)
  drawRejects({ clear: true, style: 42 }, /earth_draw: "style" must be one of/)
  drawRejects([], /earth_draw: the arguments must be an object/)
  drawRejects({ clear: 'yes' }, /earth_draw: "clear" must be true or false/)
})

test('draw：style 缺省 accent，label 截断到 80 字符', () => {
  const { args } = normalizeDrawRequest({ clear: true, label: 'x'.repeat(200) })
  assert.equal(args.style, 'accent')
  assert.equal(args.label.length, 80)
  assert.equal('label' in normalizeDrawRequest({ clear: true }).args, false, '没有 label 时不应带空字段')
})

// ---------------------------------------------------------------------------
// earth_measure：宿主侧归一化
// ---------------------------------------------------------------------------

test('measure：distance / area / height 的点数规则', () => {
  const distance = normalizeMeasureRequest({ mode: 'distance', points: [[1, 2], [3, 4]] })
  assert.deepEqual(distance.args, { mode: 'distance', points: [[1, 2], [3, 4]], draw: true, clear: false })
  assert.equal(normalizeMeasureRequest({ mode: 'area', points: [[0, 0], [1, 0], [1, 1]] }).args.points.length, 3)
  // 三维点保留高度。
  assert.deepEqual(
    normalizeMeasureRequest({ mode: 'height', points: [[0, 0, 100], [1, 1, 250]] }).args.points,
    [[0, 0, 100], [1, 1, 250]],
  )

  measureRejects({ mode: 'distance', points: [[1, 2]] }, /earth_measure: "points" needs at least 2 positions/)
  measureRejects({ mode: 'area', points: [[1, 2], [3, 4]] }, /earth_measure: area needs at least 3 points/)
  measureRejects({ mode: 'height', points: [[0, 0], [1, 1], [2, 2]] }, /earth_measure: height needs exactly 2 points/)
})

test('measure：mode 是枚举，缺失或未知取值都被拒绝', () => {
  measureRejects({ mode: 'volume', points: [[1, 2], [3, 4]] }, /earth_measure: "mode" must be one of distance, area, height/)
  measureRejects({ points: [[1, 2], [3, 4]] }, /earth_measure: "mode" must be one of/)
  measureRejects({ mode: '', points: [[1, 2], [3, 4]] }, /earth_measure: "mode" must be one of/)
})

test('measure：draw 缺省 true，draw=false 与 clear 布尔值生效', () => {
  assert.equal(normalizeMeasureRequest({ mode: 'distance', points: [[1, 2], [3, 4]] }).args.draw, true)
  assert.deepEqual(
    normalizeMeasureRequest({ mode: 'distance', points: [[1, 2], [3, 4]], draw: false, clear: true }).args,
    { mode: 'distance', points: [[1, 2], [3, 4]], draw: false, clear: true },
  )
  measureRejects({ mode: 'distance', points: [[1, 2], [3, 4]], draw: 'yes' }, /earth_measure: "draw" must be true or false/)
  measureRejects({ mode: 'distance', points: [[1, 2], [3, 4]], clear: 1 }, /earth_measure: "clear" must be true or false/)
})

test('measure：点形状、非有限数与坐标范围都被拒绝', () => {
  measureRejects({ mode: 'distance', points: [[1], [3, 4]] }, /earth_measure: points\[0\] must be \[lon, lat\] or \[lon, lat, height\]/)
  measureRejects({ mode: 'distance', points: [[1, 2, 3, 4], [3, 4]] }, /earth_measure: points\[0\] must be/)
  measureRejects({ mode: 'distance', points: ['x', [3, 4]] }, /earth_measure: points\[0\] must be/)
  measureRejects({ mode: 'distance', points: [['1', 2], [3, 4]] }, /earth_measure: points\[0\] must contain finite numbers/)
  measureRejects({ mode: 'distance', points: [[Number.NaN, 0], [3, 4]] }, /earth_measure: points\[0\] must contain finite numbers/)
  measureRejects({ mode: 'distance', points: [[181, 0], [3, 4]] }, /earth_measure: points\[0\] longitude 181 is outside -180\.\.180 degrees/)
  measureRejects({ mode: 'distance', points: [[0, 91], [3, 4]] }, /earth_measure: points\[0\] latitude 91 is outside -90\.\.90 degrees/)
  measureRejects({ mode: 'distance', points: [[0, 0, 10000001], [3, 4]] }, /earth_measure: points\[0\] height must be within/)
  measureRejects({ mode: 'distance', points: 'nope' }, /earth_measure: "points" must be an array/)
})

test('measure：未知参数、非对象入参与 200 点上限', () => {
  measureRejects(
    { mode: 'distance', points: [[1, 2], [3, 4]], style: 'x' },
    /earth_measure: it does not accept "style"; accepted arguments: mode, points, draw, clear/,
  )
  measureRejects([], /earth_measure: the arguments must be an object/)
  assert.equal(
    normalizeMeasureRequest({ mode: 'distance', points: Array.from({ length: 200 }, (_, index) => [index % 180, 0]) }).args.points.length,
    200,
  )
  measureRejects(
    { mode: 'distance', points: Array.from({ length: 201 }, () => [0, 0]) },
    /earth_measure: "points" is limited to 200 positions per call/,
  )
})

// ---------------------------------------------------------------------------
// 浏览器侧接线：只读 client.js 文本，防止两个工具在界面上「失踪」
// ---------------------------------------------------------------------------

test('客户端：四个地球工具都注册了 tool.call.toolview 工具行', () => {
  assert.match(client, /name: 'tool\.call\.toolview'/)
  for (const tool of ['earth_scene', 'earth_capture', 'earth_draw', 'earth_measure']) {
    assert.match(client, new RegExp(`key: '${tool}'`), `缺少 ${tool} 的工具行注册`)
  }
  const registrations = client.match(/name: 'tool\.call\.toolview'/g) ?? []
  assert.ok(registrations.length >= 4, `tool.call.toolview 至少注册 4 次，实际 ${registrations.length}`)
})

test('客户端：runCommand 处理 draw / measure，并保留叠加层清理入口', () => {
  assert.match(client, /if \(action === 'draw'\) \{/)
  assert.match(client, /if \(action === 'measure'\) \{/)
  assert.match(client, /function drawAgentOverlay\(Cesium, viewer, geojson, style, caption\)/)
  assert.match(client, /function measureAgentOverlay\(Cesium, viewer, args\)/)
  assert.match(client, /function clearAgentOverlays\(kind = 'all'\)/)
  // 清空必须真的从 viewer 上移除实体，否则再画会叠加出旧标注。
  assert.match(client, /viewer\.entities\.remove\(entity\)/)
  // 三种量测都要产出宿主渲染器认识的结果字段。
  assert.match(client, /result\.distance_m = round\(distance\)/)
  assert.match(client, /result\.area_m2 = round\(area\)/)
  assert.match(client, /result\.height_m = round\(delta\)/)
  // 绘制结果要带回 by_type / bbox，宿主的 renderDrawResult 依赖它们。
  assert.match(client, /by_type: byType,/)
  assert.match(client, /bbox: hasBox/)
})

test('客户端：collectSceneStatus 报告 annotations 计数', () => {
  assert.match(client, /annotations: \{/)
  assert.match(client, /drawn_features: agentOverlayRef\.current\.drawnFeatures/)
  assert.match(client, /measured_points: agentOverlayRef\.current\.measuredCount/)
  assert.match(client, /overlays: agentOverlayRef\.current\.draw\.length \+ agentOverlayRef\.current\.measure\.length/)
})

test('客户端：中英词典都登记了 draw / measure / 清理文案', () => {
  const messagesStart = client.indexOf('const MESSAGES = {')
  const zhIndex = client.indexOf('zh: {', messagesStart)
  const enIndex = client.indexOf('en: {', zhIndex)
  assert.ok(messagesStart >= 0 && zhIndex > messagesStart && enIndex > zhIndex, 'client.js 中应能定位中英词典')

  // 词典对象在行首 4 个空格处结束；en 之后的闭括号就是 MESSAGES 的结尾。
  const messagesEnd = client.indexOf('\n    }', enIndex)
  const zhDictionary = client.slice(zhIndex, enIndex)
  const enDictionary = client.slice(enIndex, messagesEnd === -1 ? undefined : messagesEnd)
  assert.match(zhDictionary, /zh: \{/)
  assert.match(enDictionary, /en: \{/)

  for (const key of ['tool.action.draw', 'tool.action.measure', 'menu.clearAgent', 'agent.clearedOverlays']) {
    assert.ok(zhDictionary.includes(`'${key}'`), `中文词典缺少 ${key}`)
    assert.ok(enDictionary.includes(`'${key}'`), `英文词典缺少 ${key}`)
  }
})

test('客户端：自动打开面板仍只在实时阶段触发', () => {
  assert.match(client, /if \(phase === 'result' \|\| openedRef\.current\) return/)
  assert.match(client, /readAutoOpen\(\)/)
})

// ---------------------------------------------------------------------------
// 宿主侧接线：四个工具与系统提示词段落
// ---------------------------------------------------------------------------

test('宿主：导出两个归一化函数，且四个工具都在 mountAgentTools 里注册', () => {
  assert.equal(typeof normalizeDrawRequest, 'function')
  assert.equal(typeof normalizeMeasureRequest, 'function')
  assert.match(host, /const DRAW_TOOL_NAME = 'earth_draw'/)
  assert.match(host, /const MEASURE_TOOL_NAME = 'earth_measure'/)
  for (const call of [
    'scope\\.tools\\.register\\(createSceneTool\\(bridge, allowedDirs\\)\\)',
    'scope\\.tools\\.register\\(createCaptureTool\\(bridge\\)\\)',
    'scope\\.tools\\.register\\(createDrawTool\\(bridge\\)\\)',
    'scope\\.tools\\.register\\(createMeasureTool\\(bridge\\)\\)',
  ]) {
    assert.match(host, new RegExp(call))
  }
  assert.equal((host.match(/scope\.tools\.register\(/g) ?? []).length, 4, '应恰好注册四个 Agent 工具')
  assert.match(host, /name: DRAW_TOOL_NAME/)
  assert.match(host, /name: MEASURE_TOOL_NAME/)
})

test('宿主：系统提示词段落提到四个工具', () => {
  assert.match(host, /earth_scene, earth_capture, earth_draw and earth_measure/)
  assert.match(host, /earth_draw adds GeoJSON annotations/)
  assert.match(host, /earth_measure returns distance\/area\/height numbers/)
})
