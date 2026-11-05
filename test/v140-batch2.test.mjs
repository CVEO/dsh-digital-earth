/**
 * v1.4.0 批次 B2 的 QA 套件（task-17）。
 *
 * 只读源码，不碰实现：
 *   - normalizeAnalyzeRequest：四动作的必填/范围/默认值/未知参数/错误格式；
 *   - Host 模型面：earth_analyze 的 schema、注册、描述预算、30 s 超时、
 *     结果转发、8 KB 渲染预算、系统提示词预算与旧话术清除；
 *   - Client 静态接线：analyze 桥分支（先于就绪守卫、失败带 next:）、
 *     高程采样优先级、profile/flood/sunlight 引擎、单活动清理、
 *     分析卡/右栈/窄宽/截图隐藏、i18n 键对齐；
 *   - 不新增依赖。
 *
 * 边界：这里全是 Host 纯函数与 Client 静态断言；真实 Cesium GPU/浏览器
 * 效果由 Lead 在 B4 前手工验证，见 .research/b2-qa-report.md。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ANALYZE_ACTIONS,
  normalizeAnalyzeRequest,
  SYSTEM_PROMPT_SECTION,
} from '../index.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readText = (name) => readFile(join(root, name), 'utf8').then((text) => text.replace(/\r\n/g, '\n'))
const [client, host, packageText] = await Promise.all([
  readText('client.js'),
  readText('index.js'),
  readText('package.json'),
])

/** 取源码片段：从 start 到其后的 end（含 end），找不到即断言失败。 */
function block(source, start, end) {
  const from = source.indexOf(start)
  assert.ok(from >= 0, `源码中找不到片段起点：${start}`)
  const to = source.indexOf(end, from + start.length)
  assert.ok(to > from, `源码中找不到片段终点：${end}`)
  return source.slice(from, to + end.length)
}

/** 断言 normalizeAnalyzeRequest 拒绝，并返回错误对象供进一步检查。 */
function analyzeFailure(payload) {
  let value
  try {
    value = normalizeAnalyzeRequest(payload)
  } catch (error) {
    return error
  }
  assert.fail(`期望 normalizeAnalyzeRequest 拒绝，实际返回：${JSON.stringify(value)}`)
}

/** 拒绝 + Host 错误契约：`earth_analyze: ... next: ...` 单行。 */
function rejectsAnalyze(payload, pattern, nextPattern) {
  const error = analyzeFailure(payload)
  assert.ok(error instanceof Error, 'normalizeAnalyzeRequest 必须抛出 Error')
  assert.match(error.message, /^earth_analyze: /)
  assert.match(error.message, /next: /)
  assert.doesNotMatch(error.message, /\n/)
  if (pattern) assert.match(error.message, pattern)
  if (nextPattern) assert.match(error.message, nextPattern)
  return error.message
}

const argsFor = (payload) => normalizeAnalyzeRequest(payload).args
const profileBase = () => ({ action: 'profile', from: [116.39, 39.9], to: [116.5, 40.0] })
const regionBase = () => ({ west: 116.0, south: 39.0, east: 116.5, north: 39.5 })
const floodBase = () => ({ action: 'flood', region: regionBase(), water_height: 30 })

// ---------------------------------------------------------------------------
// Host：normalizeAnalyzeRequest
// ---------------------------------------------------------------------------

test('normalizeAnalyzeRequest：导出、四动作枚举、返回对象只有 args 且字段与契约一致', () => {
  assert.equal(typeof normalizeAnalyzeRequest, 'function')
  assert.deepEqual(ANALYZE_ACTIONS, ['profile', 'flood', 'sunlight', 'clear'])

  const profile = normalizeAnalyzeRequest(profileBase())
  assert.deepEqual(Object.keys(profile), ['args'])
  assert.deepEqual(profile.args, { action: 'profile', from: [116.39, 39.9], to: [116.5, 40.0], samples: 32 })

  const flood = argsFor(floodBase())
  assert.deepEqual(Object.keys(flood).sort(), ['action', 'grid', 'region', 'water_height'])
  assert.deepEqual(flood.region, regionBase())
  assert.equal(flood.water_height, 30)

  assert.deepEqual(argsFor({ action: 'sunlight' }), { action: 'sunlight', show_shadows: true })
  assert.deepEqual(argsFor({ action: 'clear' }), { action: 'clear' })
})

test('normalizeAnalyzeRequest：profile 默认 samples=32、范围 8..64、layer 去空白', () => {
  assert.equal(argsFor(profileBase()).samples, 32)
  assert.equal(argsFor({ ...profileBase(), layer: '  Tiles A  ' }).layer, 'Tiles A')
  for (const samples of [8, 32, 64]) assert.equal(argsFor({ ...profileBase(), samples }).samples, samples)

  rejectsAnalyze({ ...profileBase(), samples: 7 }, /"samples" 7 is outside 8\.\.64/)
  rejectsAnalyze({ ...profileBase(), samples: 65 }, /"samples" 65 is outside 8\.\.64/)
  rejectsAnalyze({ ...profileBase(), samples: 8.5 }, /"samples" must be an integer/)
  rejectsAnalyze({ ...profileBase(), samples: '32' }, /"samples" must be an integer/)
  rejectsAnalyze({ ...profileBase(), samples: null }, /"samples" must be an integer/)
})

test('normalizeAnalyzeRequest：profile 坐标必须是不带高度的合法 [lon, lat]，且不能同点', () => {
  rejectsAnalyze({ ...profileBase(), from: [116.39] }, /"from" must be exactly \[lon, lat\] without a height/)
  rejectsAnalyze({ ...profileBase(), from: [116.39, 39.9, 100] }, /"from" must be exactly \[lon, lat\] without a height/)
  rejectsAnalyze({ ...profileBase(), from: ['116', 39.9] }, /"from" must contain two finite numbers/)
  rejectsAnalyze({ ...profileBase(), from: [116.39, Number.NaN] }, /"from" must contain two finite numbers/)
  rejectsAnalyze({ ...profileBase(), from: [116.39, Number.POSITIVE_INFINITY] }, /"from" must contain two finite numbers/)
  rejectsAnalyze({ ...profileBase(), from: [181, 39.9] }, /"from" longitude 181 is outside -180\.\.180/)
  rejectsAnalyze({ ...profileBase(), to: [116.39, -91] }, /"to" latitude -91 is outside -90\.\.90/)
  rejectsAnalyze({ ...profileBase(), from: [116.39, 39.9], to: [116.39, 39.9] }, /profile "from" and "to" are the same point/)
  // 合法边界值放行。
  assert.deepEqual(argsFor({ ...profileBase(), from: [-180, -90], to: [180, 90] }).from, [-180, -90])
})

test('normalizeAnalyzeRequest：profile 拒绝 flood/sunlight 专用参数并指向正确 action', () => {
  const cases = [
    ['region', regionBase(), /use action "flood"/],
    ['water_height', 10, /use action "flood"/],
    ['grid', 8, /use action "flood"/],
    ['datetime', '2026-11-05T12:00:00Z', /use action "sunlight"/],
    ['show_shadows', true, /use action "sunlight"/],
  ]
  for (const [key, value, next] of cases) {
    rejectsAnalyze(
      { ...profileBase(), [key]: value },
      new RegExp(`action "profile" does not accept "${key}"`),
      next,
    )
  }
})

test('normalizeAnalyzeRequest：flood 默认 grid=12、water_height -1000..9000、整数栅格 4..24', () => {
  const flood = argsFor(floodBase())
  assert.equal(flood.grid, 12)
  assert.equal(argsFor({ ...floodBase(), water_height: -1000 }).water_height, -1000)
  assert.equal(argsFor({ ...floodBase(), water_height: 9000 }).water_height, 9000)
  assert.equal(argsFor({ ...floodBase(), water_height: 0.5 }).water_height, 0.5)
  for (const grid of [4, 12, 24]) assert.equal(argsFor({ ...floodBase(), grid }).grid, grid)

  rejectsAnalyze({ ...floodBase(), water_height: -1001 }, /"water_height" -1001 is outside -1000\.\.9000/)
  rejectsAnalyze({ ...floodBase(), water_height: 9001 }, /"water_height" 9001 is outside -1000\.\.9000/)
  rejectsAnalyze({ ...floodBase(), water_height: '30' }, /"water_height" must be a finite number/)
  rejectsAnalyze({ ...floodBase(), water_height: null }, /"water_height" must be a finite number/)
  rejectsAnalyze({ ...floodBase(), grid: 3 }, /"grid" 3 is outside 4\.\.24/)
  rejectsAnalyze({ ...floodBase(), grid: 25 }, /"grid" 25 is outside 4\.\.24/)
  rejectsAnalyze({ ...floodBase(), grid: 6.5 }, /"grid" must be an integer/)
})

test('normalizeAnalyzeRequest：flood region 结构、顺序、经纬范围与 10 度跨度', () => {
  rejectsAnalyze({ action: 'flood', water_height: 10 }, /flood needs "region" with west, south, east and north/)
  rejectsAnalyze({ action: 'flood', region: regionBase() }, /flood needs "water_height" in meters/)
  rejectsAnalyze(
    { ...floodBase(), region: { west: 0, south: 0, east: 1 } },
    /"region" is missing "north"/,
  )
  rejectsAnalyze(
    { ...floodBase(), region: { ...regionBase(), center: 1 } },
    /"region" does not accept "center"/,
  )
  rejectsAnalyze({ ...floodBase(), region: null }, /"region" must be an object with west, south, east and north/)
  rejectsAnalyze(
    { ...floodBase(), region: { west: 2, south: 0, east: 2, north: 1 } },
    /"region\.west" must be less than "region\.east"/,
  )
  rejectsAnalyze(
    { ...floodBase(), region: { west: 0, south: 1, east: 1, north: 1 } },
    /"region\.south" must be less than "region\.north"/,
  )
  rejectsAnalyze(
    { ...floodBase(), region: { west: 0, south: 0, east: 10.5, north: 1 } },
    /"region" longitude span 10\.5 exceeds 10 degrees/,
    /narrow the flood area to at most 10 degrees of longitude/,
  )
  rejectsAnalyze(
    { ...floodBase(), region: { west: 0, south: 0, east: 1, north: 10.5 } },
    /"region" latitude span 10\.5 exceeds 10 degrees/,
    /narrow the flood area to at most 10 degrees of latitude/,
  )
  rejectsAnalyze(
    { ...floodBase(), region: { west: -181, south: 0, east: 1, north: 1 } },
    /"region\.west" -181 is outside -180\.\.180/,
  )
  rejectsAnalyze(
    { ...floodBase(), region: { west: 0, south: 0, east: 1, north: 91 } },
    /"region\.north" 91 is outside -90\.\.90/,
  )
  // 恰好 10 度跨度是合法的（容差 1e-9）。
  const edge = argsFor({ ...floodBase(), region: { west: 0, south: 0, east: 10, north: 10 } })
  assert.deepEqual(edge.region, { west: 0, south: 0, east: 10, north: 10 })
})

test('normalizeAnalyzeRequest：sunlight 默认 show_shadows=true、datetime 保留调用方原文', () => {
  const plain = argsFor({ action: 'sunlight' })
  assert.deepEqual(plain, { action: 'sunlight', show_shadows: true })
  assert.equal(Object.hasOwn(plain, 'datetime'), false)
  assert.equal(argsFor({ action: 'sunlight', show_shadows: false }).show_shadows, false)
  assert.equal(argsFor({ action: 'sunlight', layer: '  Tiles  ' }).layer, 'Tiles')

  const iso = '2026-11-05T12:00:00Z'
  assert.equal(argsFor({ action: 'sunlight', datetime: iso }).datetime, iso)
  // 去空白但不重写时间串（契约要求 Host 不改写，面板可解析同一时刻）。
  assert.equal(argsFor({ action: 'sunlight', datetime: ` ${iso}\n` }).datetime, iso)
  assert.equal(argsFor({ action: 'sunlight', datetime: '2026-11-05T12:00:00.000+08:00' }).datetime, '2026-11-05T12:00:00.000+08:00')
})

test('normalizeAnalyzeRequest：sunlight datetime 可解析且 UTC 年份 1900..2200，show_shadows 必须是布尔', () => {
  rejectsAnalyze({ action: 'sunlight', datetime: '' }, /"datetime" must be an ISO 8601 date\/time string/)
  rejectsAnalyze({ action: 'sunlight', datetime: '   ' }, /"datetime" must be an ISO 8601 date\/time string/)
  rejectsAnalyze({ action: 'sunlight', datetime: 123 }, /"datetime" must be an ISO 8601 date\/time string/)
  rejectsAnalyze({ action: 'sunlight', datetime: null }, /"datetime" must be an ISO 8601 date\/time string/)
  rejectsAnalyze({ action: 'sunlight', datetime: 'not-a-date' }, /"datetime" is not a valid date\/time/)
  rejectsAnalyze({ action: 'sunlight', datetime: '2026-13-45T99:99:99Z' }, /"datetime" is not a valid date\/time/)
  rejectsAnalyze({ action: 'sunlight', datetime: '1899-12-31T23:59:59Z' }, /"datetime" year 1899 is outside 1900\.\.2200/)
  rejectsAnalyze({ action: 'sunlight', datetime: '2201-01-01T00:00:00Z' }, /"datetime" year 2201 is outside 1900\.\.2200/)
  // 年份边界是闭区间。
  assert.equal(argsFor({ action: 'sunlight', datetime: '1900-01-01T00:00:00Z' }).datetime, '1900-01-01T00:00:00Z')
  assert.equal(argsFor({ action: 'sunlight', datetime: '2200-12-31T23:59:59Z' }).datetime, '2200-12-31T23:59:59Z')
  rejectsAnalyze({ action: 'sunlight', show_shadows: 'yes' }, /"show_shadows" must be true or false/)
  rejectsAnalyze({ action: 'sunlight', show_shadows: 1 }, /"show_shadows" must be true or false/)
  rejectsAnalyze({ action: 'sunlight', show_shadows: null }, /"show_shadows" must be true or false/)
})

test('normalizeAnalyzeRequest：clear 不接受其他参数，未知参数/缺失或非法 action 一律拒绝', () => {
  assert.deepEqual(normalizeAnalyzeRequest({ action: 'clear' }), { args: { action: 'clear' } })
  rejectsAnalyze(
    { action: 'clear', layer: 'Tiles' },
    /action "clear" does not accept "layer"/,
    /clear takes no other arguments and removes the active analysis/,
  )
  rejectsAnalyze(
    { action: 'clear', from: [116.39, 39.9] },
    /action "clear" does not accept "from"/,
    /use action "profile"/,
  )
  const unknown = rejectsAnalyze({ action: 'clear', zoom: 3 }, /it does not accept "zoom"; accepted arguments:/)
  for (const name of ['action', 'layer', 'from', 'to', 'samples', 'region', 'water_height', 'grid', 'datetime', 'show_shadows']) {
    assert.match(unknown, new RegExp(name))
  }

  for (const raw of [{}, null, undefined, { action: 'PROFILE' }, { action: 'skyline' }]) {
    rejectsAnalyze(raw, /"action" must be one of profile, flood, sunlight, clear/)
  }
  for (const raw of ['x', 42, [], true, 0]) {
    rejectsAnalyze(raw, /the arguments must be an object/)
  }
})

test('normalizeAnalyzeRequest：所有拒绝都走统一 earth_analyze 错误前缀且带可执行 next', () => {
  // Host 只有一个构造点：分析错误必须经过它，自然获得 next:。
  assert.equal((host.match(/new Error\(`earth_analyze:/g) ?? []).length, 1)
  const helper = block(host, 'const analyzeError =', 'function normalizeAnalyzeLayer')
  assert.match(helper, /new Error\(`earth_analyze: \$\{message\} next: \$\{next\}`\)/)
  assert.match(helper, /check the argument against the earth_analyze schema and retry\./)

  const invalid = [
    {},
    { action: 'nope' },
    { action: 'profile', from: [1, 2] },
    { action: 'profile', from: [1, 2], to: [3, 'x'] },
    { action: 'flood', water_height: 1 },
    { action: 'flood', region: { west: 0, south: 0, east: 1, north: 1 }, water_height: 'x' },
    { action: 'sunlight', datetime: 'bad' },
    { action: 'sunlight', datetime: '2026-01-01T00:00:00Z', show_shadows: 'x' },
    { action: 'clear', layer: 'x' },
    { action: 'clear', bogus: 1 },
  ]
  for (const payload of invalid) {
    const message = rejectsAnalyze(payload)
    assert.match(message, /^earth_analyze: .+ next: .+$/)
  }
})

// ---------------------------------------------------------------------------
// Host：工具 schema / 描述 / 桥接 / 渲染 / 提示词
// ---------------------------------------------------------------------------

test('earth_analyze schema：注册于六工具集，10 个参数、required action、两处 additionalProperties:false', () => {
  const params = block(host, 'const ANALYZE_PARAMETERS = {', '\n}')
  const properties = [...params.matchAll(/^    ([a-z_]+): \{/gm)].map((match) => match[1])
  assert.deepEqual(properties, [
    'action', 'layer', 'from', 'to', 'samples', 'region', 'water_height', 'grid', 'datetime', 'show_shadows',
  ])
  assert.match(params, /enum: ANALYZE_ACTIONS/)
  assert.match(params, /required: \['action'\]/)
  assert.match(params, /required: ANALYZE_REGION_KEYS/)
  // 顶层与 region 各一处，且不把分析参数写进 earth_scene schema。
  assert.equal((params.match(/additionalProperties: false/g) ?? []).length, 2)
  assert.match(params, /minimum: ANALYZE_MIN_SAMPLES/)
  assert.match(params, /maximum: ANALYZE_MAX_SAMPLES/)
  assert.match(params, /default \$\{ANALYZE_DEFAULT_SAMPLES\}/)
  assert.match(params, /minimum: ANALYZE_MIN_GRID/)
  assert.match(params, /maximum: ANALYZE_MAX_GRID/)
  assert.match(params, /default \$\{ANALYZE_DEFAULT_GRID\}/)
  assert.match(params, /minimum: ANALYZE_MIN_WATER_HEIGHT/)
  assert.match(params, /maximum: ANALYZE_MAX_WATER_HEIGHT/)
  assert.match(params, /minimum: -180, maximum: 180/)
  assert.match(params, /minimum: -90, maximum: 90/)

  assert.match(host, /scope\.tools\.register\(createAnalyzeTool\(bridge\)\)/)
  // B3：earth_shader 是第六个工具，注册总数随之 5→6。
  assert.equal((host.match(/scope\.tools\.register\(/g) ?? []).length, 6)

  const tool = block(host, 'function createAnalyzeTool(bridge) {', '\n}')
  assert.match(tool, /name: ANALYZE_TOOL_NAME/)
  assert.match(tool, /description: ANALYZE_DESCRIPTION/)
  assert.match(tool, /parameters: ANALYZE_PARAMETERS/)
  assert.match(tool, /schema: \{ type: 'object' \}/)
  assert.match(tool, /render: \(_args, value\) => \[\{ type: 'text', text: renderAnalyzeResult\(value\) \}\]/)
  assert.match(host, /const ANALYZE_TOOL_NAME = 'earth_analyze'/)
})

test('earth_analyze 工具描述 ≤1200 字符，覆盖单活动/clear/坐标来源/数据已加载/不猜数值', () => {
  // 描述是源码里的字符串数组，测试按实现拼回来量预算，避免硬编码字符数。
  const descBlock = block(host, 'const ANALYZE_DESCRIPTION = [', "].join('")
  const lines = [...descBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((match) =>
    match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'),
  )
  assert.equal(lines.length, 5)
  const description = lines.join('\n')
  assert.ok(description.length <= 1200, `earth_analyze 描述超预算：${description.length} 字符`)
  assert.ok(description.length >= 500, `earth_analyze 描述过短：${description.length} 字符`)

  assert.match(description, /One analysis at a time: profile, flood and sunlight replace the previous active analysis; clear removes it/)
  assert.match(description, /reports what was cleared/)
  assert.match(description, /load data first/)
  assert.match(description, /never guess missing values/)
  assert.match(description, /the panel returns an error when it has no height data/)
  assert.match(description, /Take coordinates from the user/)
  assert.match(description, /topmost visible 3D Tiles layer/)
  assert.match(description, /compact metrics, not a full sampling grid/)
  assert.match(description, /earth_capture/)
  assert.doesNotMatch(description, /skyline|天际线/i)
})

test('earth_analyze 执行：30 s 超时、analyze 桥命令、scrubToken/asResultObject、会话回退', () => {
  assert.match(host, /const ANALYZE_TIMEOUT_MS = 30000/)
  const tool = block(host, 'function createAnalyzeTool(bridge) {', '\n}')
  assert.match(tool, /const request = normalizeAnalyzeRequest\(args\)/)
  assert.match(tool, /const target = resolveSessionTarget\(bridge, exec\)/)
  assert.match(tool, /if \(target === null\) throw new Error\(PANEL_CLOSED_MESSAGE\)/)
  assert.match(tool, /bridge\.run\(target\.sessionId, 'analyze', request\.args, ANALYZE_TIMEOUT_MS, exec\.signal\)/)
  assert.match(tool, /scrubToken\(asResultObject\(await bridge\.run/)
  assert.match(tool, /if \(target\.fallback\) value\.session_fallback = SESSION_FALLBACK_NOTE/)
  // 结果对象原样转发给 Host 渲染器，不重命名 Client 字段。
  assert.match(tool, /return value/)
})

test('earth_analyze 渲染：8 KB 上限、UTF-8 安全截断、四种 operation 的字段与 JSON 兜底', () => {
  assert.match(host, /const ANALYZE_RENDER_LIMIT = 8 \* 1024/)
  const truncate = block(host, 'function truncateAnalyzeText(text, note) {', '\n}')
  assert.match(truncate, /Buffer\.byteLength\(text, 'utf8'\) <= ANALYZE_RENDER_LIMIT/)
  assert.match(truncate, /for \(const character of text\)/)
  assert.match(truncate, /Buffer\.byteLength\(character, 'utf8'\)/)
  assert.match(truncate, /return `\$\{head\}\$\{note\}`/)

  const render = block(host, 'function renderAnalyzeResult(value) {', '\n}')
  for (const operation of ['profile', 'flood', 'sunlight', 'clear']) {
    assert.match(render, new RegExp(`operation === '${operation}'`))
  }
  // profile 统计字段。
  for (const field of ['min_height', 'max_height', 'relief_m', 'gain_m', 'loss_m']) {
    assert.match(render, new RegExp(`stats\\.${field}`))
  }
  // flood 结果字段与“不倾倒全量网格”的说明。
  for (const field of ['area_km2', 'inundated_km2', 'inundated_ratio', 'depth_max_m', 'depth_mean_m', 'samples_with_data', 'samples_inundated']) {
    assert.match(render, new RegExp(`value\\.${field}`))
  }
  assert.match(render, /value\.region/)
  assert.match(render, /value\.water_height/)
  assert.match(render, /value\.grid/)
  // sunlight 结果字段。
  assert.match(render, /const sun = isPlainObject\(value\.sun\) \? value\.sun : \{\}/)
  assert.match(render, /sun\.altitude_deg/)
  assert.match(render, /sun\.azimuth_deg/)
  assert.match(render, /value\.night === true/)
  assert.match(render, /value\.shadows_enabled === true/)
  // clear 的处理与兜底 JSON（超预算时截断并提示）。
  assert.match(render, /Array\.isArray\(value\.cleared\)/)
  assert.match(render, /JSON: \$\{json\}/)
  assert.match(render, /analysis JSON truncated at \$\{ANALYZE_RENDER_LIMIT\} UTF-8 bytes/)
})

test('系统提示词：≤1600 字符、五工具名、analyze 一句，且不出现内部命令/天际线/旧话术', () => {
  const prompt = SYSTEM_PROMPT_SECTION
  assert.ok(prompt.length <= 1600, `提示词超预算：${prompt.length} 字符`)
  assert.ok(prompt.length >= 1400, `提示词过短：${prompt.length} 字符`)
  for (const name of ['earth_scene', 'earth_capture', 'earth_draw', 'earth_measure', 'earth_analyze']) {
    assert.match(prompt, new RegExp(name))
  }
  assert.match(prompt, /plus earth_analyze/)
  assert.match(prompt, /earth_analyze runs one analysis at a time \(profile, flood, sunlight\), or clear removes it; it needs loaded height data\./)
  // B1 语义保留。
  assert.match(prompt, /pass the absolute path directly to earth_scene load\/inspect/)
  assert.match(prompt, /one confirmation dialog/)
  assert.match(prompt, /status only when you need the current camera/)
  assert.match(prompt, /\[code\]/)
  assert.match(prompt, /never retry access_denied or access_timeout/)
  assert.equal((prompt.match(/opens automatically/g) ?? []).length, 1)

  assert.doesNotMatch(prompt, /skyline|天际线/i)
  assert.doesNotMatch(prompt, /authorize/i)
  assert.doesNotMatch(prompt, /Data\s*(?:→|->|>)/i)
  assert.doesNotMatch(prompt, /Open local folder|手动打开目录/)
  assert.doesNotMatch(prompt, /必须先|强制先/)
})

test('earth_scene 契约：12 个 action（含 report），模型面不出现 authorize/skyline', () => {
  const scene = block(host, 'const SCENE_ACTIONS = {', '\n}')
  const names = [...scene.matchAll(/^  ([a-z]+): \[/gm)].map((match) => match[1])
  assert.equal(names.length, 12)
  assert.deepEqual(names, [
    'status', 'list', 'load', 'remove', 'visible', 'basemap', 'terrain', 'fly', 'reset', 'pick', 'inspect', 'report',
  ])
  assert.doesNotMatch(scene, /authorize|skyline/)
  assert.match(host, /const SCENE_ACTION_NAMES = Object\.keys\(SCENE_ACTIONS\)/)

  const params = block(host, 'const ANALYZE_PARAMETERS = {', '\n}')
  assert.doesNotMatch(params, /authorize|skyline|天际线/)
})

// ---------------------------------------------------------------------------
// Client：桥分支 / 采样 / 三个引擎
// ---------------------------------------------------------------------------

test('client analyze 桥分支：先于就绪守卫，失败强制带 next:，clear 返回被清类型', () => {
  // runCommand 内才有一处“未就绪”守卫；文件里还有别的同名守卫，必须定位到本函数。
  const runCommandStart = client.indexOf('async function runCommand(action, args = {}, session = null) {')
  assert.ok(runCommandStart > 0, '找不到 runCommand 派发器')
  const analyzeIndex = client.indexOf("if (action === 'analyze') {", runCommandStart)
  const readyGuard = client.indexOf(
    "if (!Cesium || !viewer) throw new Error(t('agent.notReady'))",
    runCommandStart,
  )
  assert.ok(analyzeIndex > runCommandStart, '缺少 analyze 桥分支')
  assert.ok(readyGuard > analyzeIndex, 'analyze 分支必须在通用就绪守卫之前，冷面板失败也带 next:')

  const branch = block(client, "if (action === 'analyze') {", "if (!Cesium || !viewer) throw new Error(t('agent.notReady'))")
  assert.match(branch, /return await analyzeCommand\(args\)/)
  assert.match(branch, /if \(text\.includes\('next:'\)\) throw error/)
  assert.match(branch, /throw new Error\(`\$\{text\} next: /)

  const command = block(client, 'async function analyzeCommand(args = {}) {', '\n      }')
  assert.match(command, /const operation = typeof args\.action === 'string' \? args\.action\.trim\(\) : ''/)
  assert.match(command, /if \(operation === 'clear'\)/)
  assert.match(command, /const cleared = clearAnalysis\(\)/)
  assert.match(command, /return \{ operation: 'clear', layer: null, cleared \}/)
  assert.match(command, /不支持的分析类型/)
  assert.match(command, /next: 使用 profile \/ flood \/ sunlight \/ clear/)
  // 先解析图层再清旧分析：图层写错不会破坏屏幕上的有效分析。
  assert.match(command, /const requested = typeof args\.layer === 'string' \? args\.layer\.trim\(\) : ''/)
  assert.match(command, /layer = findLayer\(requested\)/)
  assert.match(command, /未找到图层/)
  assert.match(command, /for \(let index = layersRef\.current\.length - 1; index >= 0; index -= 1\)/)
  assert.match(command, /if \(layersRef\.current\[index\]\.visible\)/)
  assert.match(command, /\/\/ Single active analysis: the new result replaces the previous one\./)
  assert.match(command, /clearAnalysis\(\)/)
  assert.match(command, /if \(operation === 'profile'\) result = await analyzeProfile\(Cesium, viewer, layer, args\)/)
  assert.match(command, /else if \(operation === 'flood'\) result = await analyzeFlood\(Cesium, viewer, layer, args\)/)
  assert.match(command, /else result = analyzeSunlight\(Cesium, viewer, layer, args\)/)
  // 分析命令本身进入快照，重新挂载时可重放；图层按名称记录，避免 id 变化。
  assert.match(command, /analysisCommandRef\.current = \{/)

  // 引擎内每个 throw new Error(...) 的消息都自带 next:（面板侧兜底之外的第二道保证）。
  const engine = block(client, '//#region analysis engine', '//#endregion analysis engine')
  const throws = [...engine.matchAll(/throw new Error\(/g)]
  assert.ok(throws.length >= 10, `分析引擎异常分支过少：${throws.length}`)
  for (const match of throws) {
    const tail = engine.slice(match.index, match.index + 600)
    assert.match(tail, /next:/, `缺少 next: 的分析错误：${tail.slice(0, 120)}`)
  }
})

test('client 高程采样：可见 3D Tiles getHeight 优先（同步/Promise），globe 兜底，无值为 null', () => {
  const core = block(client, 'const analysisElevation = async', '/** Sun angles')
  assert.match(core, /const tileset = layer && layer\.visible \? layer\.tileset : null/)
  assert.match(core, /if \(tileset && typeof tileset\.getHeight === 'function'\)/)
  assert.match(core, /const value = tileset\.getHeight\(carto, scene\)/)
  assert.match(core, /value && typeof value\.then === 'function' \? await value : value/)
  assert.match(core, /if \(typeof height === 'number' && Number\.isFinite\(height\)\) return height/)
  assert.match(core, /const height = scene\.globe\.getHeight\(carto\)/)
  assert.match(core, /return null/)
  assert.doesNotMatch(core, /return 0\b/)
  // 3D Tiles 在前、globe 在后；两处异常都降级，不伪造 0。
  assert.ok(core.indexOf('tileset.getHeight(carto, scene)') < core.indexOf('scene.globe.getHeight(carto)'))
  assert.match(core, /catch \{\n\s+\/\* fall back to the globe \*\//)
  assert.match(core, /catch \{\n\s+\/\* no terrain provider: leave the sample empty \*\//)
})

test('client profile 引擎：samples 8..64 默认 32、测地线采样、≥2 有效点、stats/色带/起终点实体', () => {
  const profile = block(client, 'const analyzeProfile = async', 'const analyzeFlood = async')
  assert.match(profile, /const from = analysisLonLat\(args\.from\)/)
  assert.match(profile, /const to = analysisLonLat\(args\.to\)/)
  // 非法坐标在面板侧也拒绝一次（Host 已校验，这里是纵深防御）。
  assert.match(profile, /`from`\/`to` must be \[lon, lat\] pairs/)
  assert.match(profile, /analysisInteger\(args\.samples, 32, 8, 64\)/)
  assert.match(profile, /new Cesium\.EllipsoidGeodesic\(/)
  assert.match(profile, /geodesic\.interpolateUsingFraction\(fraction/)
  assert.match(profile, /if \(withData < ANALYSIS_MIN_SAMPLES\)/)
  assert.match(profile, /当前视图中没有可采样的高程数据，先加载 3D Tiles 或地形再试。/)
  assert.match(profile, /next: 用 earth_scene 的 list 查看可见图层/)
  for (const field of ['min_height', 'max_height', 'relief_m', 'gain_m', 'loss_m']) {
    assert.match(profile, new RegExp(`${field}: analysisRound`))
  }
  // 数据缺口跳过，不跨缺口臆造起伏。
  assert.match(profile, /if \(point\.height_m === null\) continue/)
  assert.match(profile, /id: `profile-line-\$\{index\}`/)
  assert.match(profile, /marker\('profile-start'/)
  assert.match(profile, /marker\('profile-end'/)
  assert.match(profile, /analysisColorAt\(Cesium/)
  // 结果字段与契约一致，且驱动分析卡。
  assert.match(profile, /operation: 'profile'/)
  assert.match(profile, /from,\n\s+to,\n\s+samples,/)
  assert.match(profile, /length_m: analysisRound\(length, 1\)/)
  assert.match(profile, /points,/)
  assert.match(profile, /setAnalysis\(\{ operation: 'profile'/)
})

test('client flood 引擎：region/water_height/grid 校验、格元面积有限、grid² 采样、水面/边框/标签实体', () => {
  const flood = block(client, 'const analyzeFlood = async', 'const analyzeSunlight =')
  assert.match(flood, /const region = analysisRegion\(args\.region\)/)
  assert.match(flood, /分析范围过小，无法计算格元面积。next: 扩大 region 后重试。/)
  assert.match(flood, /const waterHeight = Number\(args\.water_height\)/)
  assert.match(flood, /water_height` must be a finite number in metres/)
  assert.match(flood, /analysisInteger\(args\.grid, 12, 4, 24\)/)
  assert.match(flood, /new Cesium\.EllipsoidGeodesic\(/)
  assert.match(flood, /const cellArea = Math\.abs\(cellWidth \* cellHeight\)/)
  assert.match(flood, /if \(!Number\.isFinite\(cellArea\) \|\| cellArea <= 0\)/)
  assert.match(flood, /for \(let row = 0; row < grid; row \+= 1\)/)
  assert.match(flood, /for \(let column = 0; column < grid; column \+= 1\)/)
  assert.match(flood, /Promise\.all\(probes\.map\(\(carto\) => analysisElevation/)
  assert.match(flood, /if \(withData === 0\)/)
  // 水面矩形在 water_height 处，半透明 + 边框；另有边框线与水位标签。
  assert.match(flood, /id: 'flood-water'/)
  assert.match(flood, /rectangle: \{/)
  assert.match(flood, /height: waterHeight/)
  assert.match(flood, /withAlpha\(0\.38\)/)
  assert.match(flood, /outline: true/)
  assert.match(flood, /id: 'flood-border'/)
  assert.match(flood, /id: 'flood-label'/)
  // 结果字段严格按契约（面积/水深四舍五入，采样计数是整数直接透传）。
  for (const field of ['cell_area_m2', 'area_km2', 'inundated_km2', 'inundated_ratio', 'depth_max_m', 'depth_mean_m']) {
    assert.match(flood, new RegExp(`${field}: analysisRound`))
  }
  assert.match(flood, /samples_with_data: withData/)
  assert.match(flood, /samples_inundated: inundated/)
  assert.match(flood, /operation: 'flood'/)
  assert.match(flood, /setAnalysis\(\{ operation: 'flood'/)
})

test('client sunlight 引擎：光照/阴影/时钟/3D Tiles ShadowMode，并保存与恢复进入前状态', () => {
  const sunlight = block(client, 'const analyzeSunlight =', 'async function analyzeCommand')
  assert.match(sunlight, /const showShadows = args\.show_shadows !== false/)
  assert.match(sunlight, /analysisSunAngles\(Cesium, date, observer\)/)
  assert.match(sunlight, /scene\.globe\.enableLighting = true/)
  assert.match(sunlight, /scene\.shadowMap\.enabled = true/)
  assert.match(sunlight, /scene\.shadowMap\.softShadows = true/)
  assert.match(sunlight, /scene\.shadowMap\.darkness = 0\.35/)
  assert.match(sunlight, /if \(!showShadows\) scene\.shadowMap\.enabled = false/)
  assert.match(sunlight, /viewer\.clock\.currentTime = Cesium\.JulianDate\.fromDate\(date\)/)
  assert.match(sunlight, /viewer\.clock\.shouldAnimate = false/)
  assert.match(sunlight, /item\.tileset\.shadows = Cesium\.ShadowMode\.ENABLED/)
  assert.match(sunlight, /if \(!showShadows\) item\.tileset\.shadows = Cesium\.ShadowMode\.DISABLED/)
  assert.match(sunlight, /id: 'sun-label'/)
  assert.match(sunlight, /analysis\.sunLabel/)
  // 恢复快照覆盖 enableLighting / shadowMap.enabled / clock / tileset.shadows。
  assert.match(sunlight, /enableLighting: scene\.globe\.enableLighting/)
  assert.match(sunlight, /shadowMapEnabled: scene\.shadowMap \? scene\.shadowMap\.enabled : null/)
  assert.match(sunlight, /shouldAnimate: viewer\.clock\.shouldAnimate/)
  assert.match(sunlight, /currentTime: viewer\.clock\.currentTime \? viewer\.clock\.currentTime\.clone\(\) : null/)
  assert.match(sunlight, /shadows: item\.tileset\.shadows/)
  // 结果字段与契约一致。
  assert.match(sunlight, /datetime: date\.toISOString\(\)/)
  assert.match(sunlight, /sun: \{ altitude_deg: sun\.altitude, azimuth_deg: sun\.azimuth \}/)
  assert.match(sunlight, /shadows_enabled: showShadows/)
  assert.match(sunlight, /night: sun\.altitude < 0/)
  assert.match(sunlight, /setAnalysis\(\{ operation: 'sunlight'/)

  const restore = block(client, 'const restoreAnalysisScene = () => {', '\n      }')
  assert.match(restore, /viewer\.scene\.globe\.enableLighting = restore\.enableLighting/)
  assert.match(restore, /viewer\.scene\.shadowMap\.enabled = restore\.shadowMapEnabled/)
  assert.match(restore, /viewer\.clock\.currentTime = restore\.currentTime/)
  assert.match(restore, /layer\.tileset\.shadows = saved\.shadows/)
  assert.match(restore, /analysisRef\.current\.restore = null/)

  // 太阳角度基于 Cesium 星历，并对 1.147 的法向量 API 做了正确适配。
  const sun = block(client, 'const analysisSunAngles =', 'const analysisObserver')
  assert.match(sun, /Simon1994PlanetaryPositions/)
  assert.match(sun, /computeIcrfToFixedMatrix/)
  assert.match(sun, /computeTemeToPseudoFixedMatrix/)
  assert.match(sun, /geodeticSurfaceNormalCartographic/)
  assert.match(sun, /eastNorthUpToFixedFrame/)
})

// ---------------------------------------------------------------------------
// Client：单活动分析 / 分析卡 / i18n / 依赖
// ---------------------------------------------------------------------------

test('client 单活动分析：analysis- 实体前缀独立于 agent-，clear 移除实体并恢复场景，删图层联动清理', () => {
  assert.match(client, /const ANALYSIS_ENTITY_PREFIX = 'analysis-'/)
  assert.match(client, /const entity = viewer\.entities\.add\(\{ \.\.\.options, id: `\$\{ANALYSIS_ENTITY_PREFIX\}\$\{options\.id\}` \}\)/)
  assert.match(client, /state\.entities\.push\(entity\)/)
  assert.match(client, /const analysisRef = React\.useRef\(\{ operation: null, layerId: null, layerName: null, entities: \[\], restore: null \}\)/)

  const clear = block(client, 'function clearAnalysis() {', '\n      }')
  assert.match(clear, /const cleared = state\.operation \? \[state\.operation\] : \[\]/)
  assert.match(clear, /viewer\.entities\.remove\(entity\)/)
  assert.match(clear, /state\.entities = \[\]/)
  assert.match(clear, /restoreAnalysisScene\(\)/)
  assert.match(clear, /state\.operation = null/)
  assert.match(clear, /state\.layerId = null/)
  assert.match(clear, /state\.layerName = null/)
  assert.match(clear, /setAnalysis\(null\)/)
  assert.match(clear, /markSceneDirty\(\)/)
  assert.match(clear, /return cleared/)
  // clear 只认 analysis- 前缀实体，绝不碰 agent- 标注。
  assert.doesNotMatch(clear, /agent-/)

  // 删除图层时若正是分析数据源，主动 clear。
  assert.match(client, /if \(analysisRef\.current\.layerId === id\) clearAnalysis\(\)/)
  // F2（Expert round1 FAIL）：collectSceneStatus 不再附带 analysis 字段，
  // 原有 status 字段（measureTool/annotations/snapshot/viewport）保持不动。
  const status = block(client, 'async function collectSceneStatus() {', '\n      }')
  assert.doesNotMatch(status, /analysis/)
  for (const field of ['measureTool:', 'annotations:', 'snapshot:', 'viewport:']) {
    assert.match(status, new RegExp(field))
  }
})

test('client toolview：六个地球工具行（含 earth_analyze/earth_shader），TOOL_SUMMARY_KEYS 与中英文案对齐', () => {
  // F1/B3：earth_analyze、earth_shader 都有聊天工具行，冷启动即可自动打开面板。
  assert.equal((client.match(/name: 'tool\.call\.toolview'/g) ?? []).length, 6)
  const toolviews = [...client.matchAll(/name: 'tool\.call\.toolview', key: '([a-z_]+)'/g)].map((match) => match[1])
  assert.deepEqual(toolviews, ['earth_scene', 'earth_capture', 'earth_draw', 'earth_measure', 'earth_analyze', 'earth_shader'])
  // 六个工具行共用 EarthToolRow：非 earth_scene 工具走 TOOL_SUMMARY_KEYS。
  assert.match(client, /function EarthToolRow\(\{ toolName, phase, block, callId \}\)/)
  assert.match(client, /rightbar\.openTab\('digital-earth'\)/)
  assert.match(client, /if \(phase === 'result' \|\| openedRef\.current\) return/)

  const summaryKeys = block(client, 'const TOOL_SUMMARY_KEYS = {', '\n    }')
  assert.match(summaryKeys, /earth_analyze: 'tool\.action\.analyze'/)
  assert.match(summaryKeys, /earth_shader: 'tool\.action\.shader'/)
  for (const [tool, key] of [['earth_capture', 'capture'], ['earth_draw', 'draw'], ['earth_measure', 'measure']]) {
    assert.match(summaryKeys, new RegExp(`${tool}: 'tool\\.action\\.${key}'`))
  }
  // zh/en 两本词典都有 tool.action.analyze（键集合一致性由 i18n 测试兜底）。
  assert.equal((client.match(/'tool\.action\.analyze':/g) ?? []).length, 2)
})

test('client 分析卡与布局：右上方浮动卡、SVG 剖面、折叠/关闭、≤300px、窄屏与截图隐藏', () => {
  // analysisMetric 定义在 card region 内、图表函数之前，单独断言。
  assert.match(client, /const analysisMetric = \(value, digits = 1\) =>/)
  const card = block(client, 'function AnalysisProfileChart', '//#endregion analysis card')
  assert.match(card, /function AnalysisProfileChart\(\{ points, t \}\)/)
  assert.match(card, /viewBox: `0 0 \$\{width\} \$\{height\}`/)
  assert.match(card, /h\('polyline'/)
  // 数据缺口分段绘制，不把缺口连成直线。
  assert.match(card, /segments\.push\(current\.join\(' '\)\)/)
  assert.match(card, /className: 'mv-card mv-analysis'/)
  assert.match(card, /role: 'region'/)
  assert.match(card, /analysis\.title\.\$\{operation\}/)
  assert.match(card, /t\('analysis\.close'\)/)
  assert.match(card, /'aria-expanded': open/)
  assert.match(card, /t\('analysis\.collapse'\)/)
  assert.match(card, /t\('analysis\.expand'\)/)
  assert.match(card, /function AnalysisCard\(\{ state, t, onClose \}\)/)

  // 右栈与 300px 宽度上限（右栈样式块跨过图层卡样式，到分析卡提示行为止）。
  const layout = block(client, '.mv-right{', '.mv-analysis .hint{')
  assert.match(layout, /width:min\(300px,calc\(100% - 20px\)\)/)
  assert.match(layout, /max-height:calc\(100% - 150px\)/)
  assert.match(layout, /\.mv-analysis\{[^}]*max-width:300px/)
  assert.match(layout, /max-height:min\(62%,380px\)/)
  assert.match(layout, /\.mv-analysis>header \.title\{[^}]*text-overflow:ellipsis/)

  // 窄宽（docked 420px 容器）不越界，且不与图层卡重叠。
  const narrow = block(client, '@container (max-width: 420px){', '\n}')
  assert.match(narrow, /\.mv-root\.mv-docked \.mv-right\{top:92px;right:12px;width:min\(300px,calc\(100% - 24px\)\);max-height:calc\(100% - 236px\)\}/)
  assert.match(narrow, /\.mv-root\.mv-docked \.mv-right \.mv-analysis\{max-width:100%\}/)
  assert.match(narrow, /\.mv-root\.mv-docked \.mv-right \.mv-layers\{position:static;top:auto;right:auto;width:100%;max-height:none\}/)

  // 截图干净模式隐藏分析卡（与 HUD/工具栏一致）。
  assert.match(client, /\.mv-root\.mv-capturing[^{]*\.mv-analysis/)
  assert.match(client, /\.mv-root\.mv-capturing[^{]*\.mv-right/)

  // 面板把分析卡挂在右栈，关闭按钮走 clearAnalysis。
  assert.match(client, /key: 'right', className: 'mv-right'/)
  assert.match(client, /h\(AnalysisCard, \{ key: 'analysis', state: analysis, t, onClose: \(\) => clearAnalysis\(\) \}\)/)
})

test('client i18n：analysis.* 37 个键中英对齐，关键文案都在', () => {
  const zhStart = client.indexOf('\n      zh: {')
  const enStart = client.indexOf('\n      en: {', zhStart)
  const end = client.indexOf('\n    }', enStart)
  assert.ok(zhStart > 0 && enStart > zhStart && end > enStart, 'i18n 字典结构变化，无法切片')
  const parseKeys = (text) => [...text.matchAll(/^        '([^']+)':/gm)].map((match) => match[1])
  const zhKeys = parseKeys(client.slice(zhStart, enStart))
  const enKeys = parseKeys(client.slice(enStart, end))
  assert.ok(zhKeys.length > 200, `中文键过少：${zhKeys.length}`)
  assert.deepEqual(zhKeys, enKeys, '中英字典键集合/顺序必须完全一致')

  const analysisKeys = zhKeys.filter((key) => key.startsWith('analysis.'))
  assert.equal(analysisKeys.length, 37)
  for (const key of [
    'analysis.title.profile',
    'analysis.title.flood',
    'analysis.title.sunlight',
    'analysis.layer',
    'analysis.collapse',
    'analysis.expand',
    'analysis.close',
    'analysis.chart',
    'analysis.hint',
    'analysis.waterLabel',
    'analysis.sunLabel',
    'analysis.night',
    'analysis.day',
    'analysis.shadowsOn',
    'analysis.shadowsOff',
  ]) {
    assert.ok(analysisKeys.includes(key), `缺少 i18n 键 ${key}`)
  }
})

test('QA 不引入新依赖：package.json 无 dependencies/devDependencies，脚本仍覆盖检查与全量测试', () => {
  const pkg = JSON.parse(packageText)
  assert.equal(pkg.dependencies, undefined)
  assert.equal(pkg.devDependencies, undefined)
  assert.equal(pkg.scripts.test, 'node --test')
  assert.match(pkg.scripts.check, /node --check index\.js/)
  assert.match(pkg.scripts.check, /node --check client\.js/)
  assert.match(pkg.scripts.check, /node --test/)
})
