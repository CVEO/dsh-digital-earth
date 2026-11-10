/**
 * v1.4.0 批次 B3 的 QA 套件（task-27）。
 *
 * 只读源码，不碰实现：
 *   - normalizeShaderRequest：apply/reset/list 的必填/默认值/范围/跨预设/未知参数
 *     拒绝，错误统一 `earth_shader: ... next: ...` 单行；
 *   - Host 模型面：earth_shader 第 6 个注册、SHADER_ACTIONS/PRESETS、9 属性 schema、
 *     描述 ≤1200、系统提示词 ≤1600 且六工具名齐全、earth_scene 11 action 与
 *     earth_analyze 契约未变；
 *   - Client 静态接线：shader 桥分支先于就绪守卫、CustomShader 构造/覆盖/回滚/
 *     reset 恢复、positionWC 相对高程、四预设片元源码与 uniform、preRender
 *     单一 u_time 监听、3DGS/无 CustomShader 报错、图层删除/卸载清理、
 *     工作台 UI/i18n、六 toolview 行；
 *   - 不新增依赖；shader 状态不进入持久化场景。
 *
 * 边界：这里全是 Host 纯函数与 Client 静态断言；真实 Cesium GPU 的 GLSL 编译、
 * 四预设实际观感、帧率与截图效果由 Lead 在 B4 前手工验证，见
 * .research/b3-qa-report.md。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ANALYZE_ACTIONS,
  SHADER_ACTIONS,
  SHADER_PRESETS,
  SYSTEM_PROMPT_SECTION,
  normalizeAnalyzeRequest,
  normalizeShaderRequest,
} from '../index.js'
import { clientSource, hostSource, readRepoFile } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readText = (name) => readFile(join(root, name), 'utf8').then((text) => text.replace(/\r\n/g, '\n'))
// Authored client source (src/client/**), not the generated client.js artifact.
const client = clientSource()
const [packageText, shaderSource, sceneSource, analyzeSource, registrySource] = await Promise.all([
  readText('package.json'),
  readText('src/host/tools/shader.js'),
  readText('src/host/tools/scene.js'),
  readText('src/host/tools/analyze.js'),
  readText('src/host/tools/registry.js'),
])
const host = hostSource()

/** 取源码片段：从 start 到其后的 end（含 end），找不到即断言失败。 */
function block(source, start, end) {
  const from = source.indexOf(start)
  assert.ok(from >= 0, `源码中找不到片段起点：${start}`)
  const to = source.indexOf(end, from + start.length)
  assert.ok(to > from, `源码中找不到片段终点：${end}`)
  return source.slice(from, to + end.length)
}

/** 把源码里的纯字面量对象取出来求值；只用于本仓库自己的静态定义。 */
function evalObjectLiteral(source, start, end) {
  const text = block(source, start, end)
  const from = text.indexOf('{')
  const to = text.lastIndexOf('}')
  assert.ok(from >= 0 && to > from, `无法提取对象字面量：${start}`)
  return new Function(`return (${text.slice(from, to + 1)})`)()
}

/** 断言 normalizeShaderRequest 拒绝，并返回错误对象供进一步检查。 */
function shaderFailure(payload) {
  let value
  try {
    value = normalizeShaderRequest(payload)
  } catch (error) {
    return error
  }
  assert.fail(`期望 normalizeShaderRequest 拒绝，实际返回：${JSON.stringify(value)}`)
}

/** 拒绝 + Host 错误契约：`earth_shader: ... next: ...` 单行。 */
function rejectsShader(payload, pattern) {
  const error = shaderFailure(payload)
  assert.ok(error instanceof Error, 'normalizeShaderRequest 必须抛出 Error')
  assert.match(error.message, /^earth_shader: /)
  assert.match(error.message, / next: /)
  assert.doesNotMatch(error.message, /\n/)
  if (pattern) assert.match(error.message, pattern)
  return error.message
}

const shaderArgs = (payload) => normalizeShaderRequest(payload).args
const applyPreset = (preset, extra = {}) => ({ action: 'apply', preset, ...extra })

// ---------------------------------------------------------------------------
// Host：normalizeShaderRequest
// ---------------------------------------------------------------------------

test('shader 常量：三个动作与五个预设的冻结顺序', () => {
  assert.deepEqual(SHADER_ACTIONS, ['apply', 'reset', 'list'])
  assert.deepEqual(SHADER_PRESETS, ['height-false-color', 'contour', 'scan', 'water', 'water-depth'])
  assert.match(host, /export const SHADER_ACTIONS = \['apply', 'reset', 'list'\]/)
  assert.match(host, /export const SHADER_PRESETS = \['height-false-color', 'contour', 'scan', 'water', 'water-depth'\]/)
})

test('shader：list 只返回 action，reset 缺省/指定图层且 layer 去空白', () => {
  assert.deepEqual(shaderArgs({ action: 'list' }), { action: 'list' })
  assert.deepEqual(shaderArgs({ action: 'reset' }), { action: 'reset' })
  assert.deepEqual(shaderArgs({ action: 'reset', layer: '  顶层 3D Tiles  ' }), {
    action: 'reset',
    layer: '顶层 3D Tiles',
  })
  rejectsShader({ action: 'reset', layer: '   ' }, /"layer" must be a non-empty/)
  rejectsShader({ action: 'reset', layer: 42 }, /"layer" must be a non-empty/)
})

test('shader：五预设默认值与显式边界值按契约透传', () => {
  // height-false-color 不补默认高程，交由 Client 用 boundingSphere 估算。
  assert.deepEqual(shaderArgs(applyPreset('height-false-color')), {
    action: 'apply',
    preset: 'height-false-color',
  })
  assert.deepEqual(shaderArgs(applyPreset('height-false-color', { min_height: -1000, max_height: 9000 })), {
    action: 'apply',
    preset: 'height-false-color',
    min_height: -1000,
    max_height: 9000,
  })
  assert.deepEqual(shaderArgs(applyPreset('contour')), { action: 'apply', preset: 'contour', interval: 20 })
  assert.deepEqual(shaderArgs(applyPreset('contour', { interval: 500 })), {
    action: 'apply',
    preset: 'contour',
    interval: 500,
  })
  assert.deepEqual(shaderArgs(applyPreset('scan')), { action: 'apply', preset: 'scan', speed: 1 })
  assert.deepEqual(shaderArgs(applyPreset('scan', { speed: 0.1 })), { action: 'apply', preset: 'scan', speed: 0.1 })
  assert.deepEqual(shaderArgs(applyPreset('water')), {
    action: 'apply',
    preset: 'water',
    speed: 1,
    amplitude: 1,
    opacity: 0.75,
  })
  assert.deepEqual(shaderArgs(applyPreset('water', { speed: 10, amplitude: 5, opacity: 0.05 })), {
    action: 'apply',
    preset: 'water',
    speed: 10,
    amplitude: 5,
    opacity: 0.05,
  })
  // D-17 water-depth：默认 water_height=0、depth_max=50；边界值 0.5..500。
  assert.deepEqual(shaderArgs(applyPreset('water-depth')), {
    action: 'apply',
    preset: 'water-depth',
    water_height: 0,
    depth_max: 50,
  })
  assert.deepEqual(shaderArgs(applyPreset('water-depth', { water_height: 321.5, depth_max: 500 })), {
    action: 'apply',
    preset: 'water-depth',
    water_height: 321.5,
    depth_max: 500,
  })
  rejectsShader(applyPreset('water-depth', { water_height: 9001 }), /"water_height" 9001 is outside -1000\.\.9000/)
  rejectsShader(applyPreset('water-depth', { depth_max: 0.4 }), /"depth_max" 0\.4 is outside 0\.5\.\.500/)
  rejectsShader(applyPreset('water-depth', { speed: 2 }), /does not accept "speed"/)
})

test('shader：height-false-color 可只给单边界，同时给出必须 min<max', () => {
  assert.deepEqual(shaderArgs(applyPreset('height-false-color', { min_height: 10 })), {
    action: 'apply',
    preset: 'height-false-color',
    min_height: 10,
  })
  assert.deepEqual(shaderArgs(applyPreset('height-false-color', { max_height: 200 })), {
    action: 'apply',
    preset: 'height-false-color',
    max_height: 200,
  })
  rejectsShader(applyPreset('height-false-color', { min_height: 20, max_height: 20 }), /must be less than/)
  rejectsShader(applyPreset('height-false-color', { min_height: 30, max_height: 20 }), /must be less than/)
})

test('shader：数值参数范围与有限数类型全部拒绝', () => {
  rejectsShader(applyPreset('contour', { interval: 0.9 }), /outside 1\.\.500/)
  rejectsShader(applyPreset('contour', { interval: 500.1 }), /outside 1\.\.500/)
  rejectsShader(applyPreset('scan', { speed: 0.09 }), /outside 0\.1\.\.10/)
  rejectsShader(applyPreset('scan', { speed: 10.1 }), /outside 0\.1\.\.10/)
  rejectsShader(applyPreset('water', { amplitude: 0.09 }), /outside 0\.1\.\.5/)
  rejectsShader(applyPreset('water', { amplitude: 5.1 }), /outside 0\.1\.\.5/)
  rejectsShader(applyPreset('water', { opacity: 0.04 }), /outside 0\.05\.\.1/)
  rejectsShader(applyPreset('water', { opacity: 1.01 }), /outside 0\.05\.\.1/)
  rejectsShader(applyPreset('height-false-color', { min_height: -1000.1 }), /outside -1000\.\.9000/)
  rejectsShader(applyPreset('height-false-color', { max_height: 9000.1 }), /outside -1000\.\.9000/)
  for (const value of ['200', Number.NaN, Number.POSITIVE_INFINITY, true]) {
    rejectsShader(applyPreset('contour', { interval: value }), /must be a finite number/)
  }
})

test('shader：跨预设参数按预设白名单拒绝，并给出可执行 next:', () => {
  rejectsShader(applyPreset('contour', { speed: 1 }), /action "apply" does not accept "speed"/)
  rejectsShader(applyPreset('contour', { min_height: 0 }), /action "apply" does not accept "min_height"/)
  rejectsShader(applyPreset('water', { interval: 20 }), /action "apply" does not accept "interval"/)
  rejectsShader(applyPreset('scan', { amplitude: 1 }), /action "apply" does not accept "amplitude"/)
  rejectsShader(applyPreset('height-false-color', { interval: 20 }), /action "apply" does not accept "interval"/)
})

test('shader：apply 缺失/非法 preset、未知参数与非对象输入全部拒绝', () => {
  rejectsShader({ action: 'apply' }, /"preset" must be one preset or an array of 1\.\.3 presets/)
  rejectsShader(applyPreset('glsl'), /unknown preset "glsl"/)
  // 任意 GLSL 源码字段都必须是未知参数，不能被静默忽略。
  rejectsShader(applyPreset('contour', { glsl: 'void main() {}' }), /does not accept "glsl"/)
  rejectsShader(applyPreset('contour', { source: 'void main() {}' }), /does not accept "source"/)
  rejectsShader(applyPreset('scan', { fragmentShaderText: 'x' }), /does not accept "fragmentShaderText"/)
  rejectsShader({}, /"action" must be one of apply, reset, list/)
  rejectsShader({ action: 'draw' }, /"action" must be one of/)
  rejectsShader({ action: 'APPLY' }, /"action" must be one of/)
  for (const raw of ['apply', 42, true, []]) {
    rejectsShader(raw, /the arguments must be an object/)
  }
  // null/undefined 按缺少 action 拒绝，与 B2 analyze 行为一致。
  rejectsShader(null, /"action" must be one of/)
  rejectsShader(undefined, /"action" must be one of/)
})

test('shader：reset/list 多余参数拒绝，错误统一单行且只有一个构造点', () => {
  rejectsShader({ action: 'list', layer: 'a' }, /list accepts only "action"/)
  rejectsShader({ action: 'list', preset: 'contour' }, /list accepts only "action"/)
  rejectsShader({ action: 'reset', preset: 'contour' }, /reset accepts only "action" and an optional "layer"/)
  rejectsShader({ action: 'reset', interval: 20 }, /reset accepts only/)
  // 所有拒绝都带 next: 且单行（上面已逐条检查），这里再钉住唯一构造点与导出。
  assert.match(host, /const shaderError = \(message, next =/)
  assert.equal((host.match(/new Error\(`earth_shader: /g) ?? []).length, 1)
  assert.match(host, /export function normalizeShaderRequest\(raw\)/)
})

// ---------------------------------------------------------------------------
// Host：工具注册 / schema / 描述 / 提示词 / 回归
// ---------------------------------------------------------------------------

test('宿主：earth_shader 是第 6 个注册工具，execute 走 session/桥接/scrub/fallback', () => {
  const disposers = block(registrySource, 'const disposers = [', ']')
  const calls = [...disposers.matchAll(/scope\.tools\.register\((create[A-Za-z]+Tool)\(/g)].map((match) => match[1])
  assert.deepEqual(calls, [
    'createSceneTool',
    'createCaptureTool',
    'createDrawTool',
    'createMeasureTool',
    'createAnalyzeTool',
    'createShaderTool',
  ])
  assert.equal((host.match(/scope\.tools\.register\(/g) ?? []).length, 6)
  assert.match(host, /const SHADER_TOOL_NAME = 'earth_shader'/)
  assert.match(host, /const SHADER_TIMEOUT_MS = 30000/)

  const tool = block(shaderSource, 'function createShaderTool(bridge) {', 'return value\n    },\n  }\n}')
  assert.match(tool, /name: SHADER_TOOL_NAME/)
  assert.match(tool, /description: SHADER_DESCRIPTION/)
  assert.match(tool, /parameters: SHADER_PARAMETERS/)
  assert.match(tool, /render: \(_args, value\) => \[\{ type: 'text', text: renderShaderResult\(value\) \}\]/)
  assert.match(tool, /const request = normalizeShaderRequest\(args\)/)
  assert.match(tool, /const target = resolveSessionTarget\(bridge, exec\)/)
  assert.match(tool, /if \(target === null\) throw new Error\(PANEL_CLOSED_MESSAGE\)/)
  assert.match(tool, /scrubToken\(asResultObject\(await bridge\.run\(target\.sessionId, 'shader', request\.args, SHADER_TIMEOUT_MS, exec\.signal\)\)\)/)
  assert.match(tool, /if \(target\.fallback\) value\.session_fallback = SESSION_FALLBACK_NOTE/)
})

test('宿主：earth_shader schema 11 属性、required action、additionalProperties:false、无 GLSL 字段', () => {
  const params = block(shaderSource, 'const SHADER_PARAMETERS = {', '\n}')
  const properties = [...params.matchAll(/^    ([a-z_]+): \{/gm)].map((match) => match[1])
  assert.deepEqual(properties, [
    'action', 'layer', 'preset', 'min_height', 'max_height', 'interval', 'speed', 'amplitude', 'opacity', 'water_height', 'depth_max',
  ])
  assert.match(params, /enum: SHADER_ACTIONS/)
  assert.match(params, /enum: SHADER_PRESETS/)
  assert.match(params, /required: \['action'\]/)
  assert.equal((params.match(/additionalProperties: false/g) ?? []).length, 1)
  // 数值参数的上下界都引用常量，不在 schema 里散落魔法数。
  for (const constant of [
    'SHADER_MIN_HEIGHT',
    'SHADER_MAX_HEIGHT',
    'SHADER_MIN_INTERVAL',
    'SHADER_MAX_INTERVAL',
    'SHADER_MIN_SPEED',
    'SHADER_MAX_SPEED',
    'SHADER_MIN_AMPLITUDE',
    'SHADER_MAX_AMPLITUDE',
    'SHADER_MIN_OPACITY',
    'SHADER_MAX_OPACITY',
    'SHADER_MIN_DEPTH_MAX',
    'SHADER_MAX_DEPTH_MAX',
  ]) {
    assert.match(params, new RegExp(constant))
  }
  // 默认值写进描述，模型不用猜。
  assert.match(params, /default \$\{SHADER_DEFAULT_INTERVAL\}/)
  assert.match(params, /default \$\{SHADER_DEFAULT_SPEED\}/)
  assert.match(params, /default \$\{SHADER_DEFAULT_AMPLITUDE\}/)
  assert.match(params, /default \$\{SHADER_DEFAULT_OPACITY\}/)
  assert.match(params, /default \$\{SHADER_DEFAULT_WATER_HEIGHT\}/)
  assert.match(params, /default \$\{SHADER_DEFAULT_DEPTH_MAX\}/)
  // 模型面不得出现任意着色器源码字段。
  assert.doesNotMatch(params, /glsl|fragmentShader|vertexShader|shaderSource/i)
})

test('宿主：earth_shader 描述 ≤1200 字符，覆盖四预设/覆盖语义/reset/无自定义 GLSL/3DGS/先加载', () => {
  const descBlock = block(shaderSource, 'const SHADER_DESCRIPTION = [', "].join('")
  const lines = [...descBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((match) =>
    match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'),
  )
  assert.equal(lines.length, 5)
  const description = lines.join('\n')
  assert.ok(description.length <= 1200, `earth_shader 描述超预算：${description.length} 字符`)
  assert.ok(description.length >= 900, `earth_shader 描述过短：${description.length} 字符`)

  for (const preset of SHADER_PRESETS) {
    assert.match(description, new RegExp(preset))
  }
  assert.match(description, /apply adds or replaces the single shader on the chosen layer/)
  assert.match(description, /applying again to the same layer replaces its shader/)
  assert.match(description, /reset clears one layer or every active shader/)
  assert.match(description, /No custom GLSL is accepted/)
  assert.match(description, /3DGS splats/)
  assert.match(description, /Load 3D Tiles first/)
  assert.match(description, /earth_capture/)
  assert.doesNotMatch(description, /authorize|skyline|天际线/i)
})

test('系统提示词：≤1600、六工具名齐全、shader 一句，且无 Data 菜单/手动目录/必须先 status', () => {
  const prompt = SYSTEM_PROMPT_SECTION
  assert.ok(prompt.length <= 1600, `提示词超预算：${prompt.length} 字符`)
  assert.ok(prompt.length >= 1400, `提示词过短：${prompt.length} 字符`)
  for (const name of ['earth_scene', 'earth_capture', 'earth_draw', 'earth_measure', 'earth_analyze', 'earth_shader']) {
    assert.match(prompt, new RegExp(name))
  }
  assert.match(prompt, /Six tools drive it/)
  assert.match(
    prompt,
    /earth_shader applies whitelisted presets \(height-false-color, contour, scan, water, water-depth\), lists or resets; no custom GLSL\./,
  )
  // B1/B2 语义必须保留，B3 只追加 shader 一句。
  assert.match(prompt, /pass the absolute path directly to earth_scene load\/inspect/)
  assert.match(prompt, /one confirmation dialog/)
  assert.match(prompt, /status only when you need the current camera/)
  assert.match(prompt, /\[code\]/)
  assert.match(prompt, /never retry access_denied or access_timeout/)
  assert.equal((prompt.match(/opens automatically/g) ?? []).length, 1)

  assert.doesNotMatch(prompt, /authorize/i)
  assert.doesNotMatch(prompt, /Data\s*(?:→|->|>)/i)
  assert.doesNotMatch(prompt, /Open local folder|手动打开目录/)
  assert.doesNotMatch(prompt, /必须先|强制先/)
})

test('回归：earth_scene 12 action（含 report），earth_analyze 契约与注册未被 B3 改动', () => {
  const scene = block(sceneSource, 'const SCENE_ACTIONS = {', '\n}')
  const names = [...scene.matchAll(/^  ([a-z]+): \[/gm)].map((match) => match[1])
  assert.equal(names.length, 12)
  assert.deepEqual(names, [
    'status', 'list', 'load', 'remove', 'visible', 'basemap', 'terrain', 'fly', 'reset', 'pick', 'inspect', 'report',
  ])
  assert.doesNotMatch(scene, /authorize|skyline|shader/)

  assert.deepEqual(ANALYZE_ACTIONS, ['profile', 'flood', 'sunlight', 'clip', 'skyline', 'clear'])
  assert.equal(normalizeAnalyzeRequest({ action: 'clear' }).args.action, 'clear')
  assert.throws(
    () => normalizeAnalyzeRequest({ action: 'shader' }),
    (error) => /^earth_analyze: /.test(error.message) && /next: /.test(error.message),
  )
  assert.match(host, /const ANALYZE_TIMEOUT_MS = 30000/)
  assert.match(host, /scope\.tools\.register\(createAnalyzeTool\(bridge\)\)/)
  const analyzeParams = block(analyzeSource, 'const ANALYZE_PARAMETERS = {', '\n}')
  assert.equal([...analyzeParams.matchAll(/^    ([a-z_]+): \{/gm)].length, 13)
  assert.doesNotMatch(analyzeParams, /preset|min_height|interval|amplitude|opacity/)
})

// ---------------------------------------------------------------------------
// Client：桥分支 / 校验 / 预设源码 / 高程 / 引擎
// ---------------------------------------------------------------------------

test('client shader 桥分支：先于通用就绪守卫、失败补 next:、统一走 shaderCommand', () => {
  const branchAt = client.indexOf("if (action === 'shader') {")
  const guardAt = client.indexOf("if (!Cesium || !viewer) throw new Error(t('agent.notReady'))", branchAt)
  assert.ok(branchAt > 0, '找不到 shader 桥分支')
  assert.ok(guardAt > branchAt, 'shader 分支必须位于通用就绪守卫之前，冷面板也要有 next:')

  const branch = block(client, "if (action === 'shader') {", '\n        }')
  assert.match(branch, /return await shaderCommand\(args\)/)
  assert.match(branch, /if \(text\.includes\('next:'\)\) throw error/)
  assert.match(branch, /next: 用 earth_scene 的 list 动作确认图层后，先 shader reset 再重试/)

  const command = block(client, 'async function shaderCommand(args = {}) {', '\n      }')
  assert.match(command, /const request = shaderValidateRequest\(args\)/)
  assert.match(command, /if \(request instanceof Error\) throw request/)
  assert.match(command, /if \(request\.operation === 'list'\) return shaderResult\('list', null, null\)/)
  assert.match(command, /三维引擎尚未就绪/)
  assert.match(command, /if \(request\.operation === 'reset'\) return resetShader\(request\.layer\)/)
  assert.match(command, /return applyShader\(request\)/)

  // 契约结果五个字段恒存在，active 按图层顺序排序。
  const result = block(client, 'const shaderResult = (operation, preset, layer) => ({', '\n      })')
  for (const field of ['operation,', 'preset: preset ?? null', 'layer: layer ?? null', 'active: shaderActiveList()', 'presets: SHADER_PRESETS.slice()']) {
    assert.ok(result.includes(field), `shaderResult 缺少字段：${field}`)
  }
  const active = block(client, 'const shaderActiveList = () => {', '\n      }')
  assert.match(active, /new Map\(layersRef\.current\.map\(\(layer, index\) => \[layer\.id, index\]\)\)/)
  assert.match(active, /\.sort\(\(left, right\) =>/)
  assert.match(active, /\.map\(\(entry\) => \(\{ layer: entry\.layerName, layerId: entry\.layer\.id, preset: entry\.preset, params: \{ \.\.\.entry\.params \} \}\)\)/)
})

test('client shader 校验：白名单/默认值/范围/跨预设/reset/list 多余参数都由唯一入口拒绝', () => {
  const validate = block(client, 'function shaderValidateRequest(args = {}) {', '\n    }')
  assert.match(validate, /action !== 'apply' && action !== 'reset' && action !== 'list'/)
  assert.match(validate, /return shaderFail\(`不支持的操作/)
  assert.match(validate, /for \(const preset of presets\) \{\n\s+if \(!SHADER_PRESETS\.includes\(preset\)\)/)
  assert.match(validate, /const allowedParams = new Set\(presets\.flatMap\(\(preset\) => SHADER_PRESET_PARAMS\[preset\]\)\)/)
  assert.match(validate, /for \(const preset of presets\) Object\.assign\(params, SHADER_PRESET_DEFAULTS\[preset\]\)/)
  assert.match(validate, /if \(!shaderFinite\(value\)\) return shaderFail/)
  assert.match(validate, /if \(value < minimum \|\| value > maximum\)/)
  assert.match(validate, /shaderFail\('min_height 必须小于 max_height。'/)
  // 校验函数返回 Error 而不是 throw，调用方统一决定桥错误包装。
  assert.doesNotMatch(validate, /\bthrow\b/)

  assert.match(client, /const SHADER_PRESETS = \['height-false-color', 'contour', 'scan', 'water', 'water-depth'\]/)
  assert.match(client, /const SHADER_PARAM_LIMITS = \{/)
  assert.match(client, /min_height: \[-1000, 9000\]/)
  assert.match(client, /interval: \[1, 500\]/)
  assert.match(client, /speed: \[0\.1, 10\]/)
  assert.match(client, /amplitude: \[0\.1, 5\]/)
  assert.match(client, /opacity: \[0\.05, 1\]/)
  assert.match(client, /water_height: \[-1000, 9000\]/)
  assert.match(client, /depth_max: \[0\.5, 500\]/)
  const defaults = block(client, 'const SHADER_PRESET_DEFAULTS = {', '\n    }')
  assert.match(defaults, /contour: \{ interval: 20 \}/)
  assert.match(defaults, /scan: \{ speed: 1 \}/)
  assert.match(defaults, /water: \{ speed: 1, amplitude: 1, opacity: 0\.75 \}/)
  assert.match(defaults, /'water-depth': \{ water_height: 0, depth_max: 50 \}/)
})

test('client 五预设：仅片元 fragmentMain、只改 diffuse/alpha、源码 ≤8 KB、uniform 按预设齐全', () => {
  const sources = evalObjectLiteral(client, 'const SHADER_FRAGMENT_SOURCES = {', '//#endregion shader core')
  assert.deepEqual(Object.keys(sources), ['height-false-color', 'contour', 'scan', 'water', 'water-depth'])
  for (const preset of SHADER_PRESETS) {
    const source = sources[preset]
    assert.equal(typeof source, 'string', `${preset} 源码必须是字符串`)
    assert.ok(source.length <= 8 * 1024, `${preset} 源码超 8 KB：${source.length}`)
    assert.match(source, /void fragmentMain\(FragmentInput fsInput, inout czm_modelMaterial material\)/)
    assert.match(source, /material\.diffuse/)
    assert.doesNotMatch(source, /void main\s*\(/)
    assert.doesNotMatch(source, /attribute |varying |void vertexMain|gl_Position/)
  }
  assert.match(sources['height-false-color'], /length\(fsInput\.attributes\.positionWC\)/)
  assert.match(sources.contour, /fract\(height \/ spacing\)/)
  assert.match(sources.scan, /u_time/)
  assert.doesNotMatch(sources.water, /material\.alpha/)
  assert.match(client, /const SHADER_SOURCE_LIMIT = 8 \* 1024/)
  assert.match(client, /function shaderFragmentSource\(preset\) \{/)
  assert.match(client, /fragmentShaderText: shaderFragmentSource\(request\.presets \?\? request\.preset\)/)
  assert.doesNotMatch(client, /vertexShaderText/)

  const uniforms = block(client, 'function shaderUniforms(Cesium, preset, params, range) {', '\n    }')
  assert.match(uniforms, /u_center: \{ type: Cesium\.UniformType\.VEC3, value: range\.center \}/)
  assert.match(uniforms, /u_centerHeight: \{ type: Cesium\.UniformType\.FLOAT, value: range\.centerHeight \}/)
  assert.match(uniforms, /presets\.includes\('height-false-color'\) \|\| presets\.includes\('scan'\)/)
  assert.match(uniforms, /uniforms\.u_minHeight/)
  assert.match(uniforms, /uniforms\.u_maxHeight/)
  assert.match(uniforms, /uniforms\.u_interval = \{ type: Cesium\.UniformType\.FLOAT, value: params\.interval \?\? 20 \}/)
  assert.match(uniforms, /presets\.includes\('scan'\) \|\| presets\.includes\('water'\)/)
  assert.match(uniforms, /uniforms\.u_speed/)
  assert.match(uniforms, /uniforms\.u_time = \{ type: Cesium\.UniformType\.FLOAT, value: 0 \}/)
  assert.match(uniforms, /uniforms\.u_amplitude = \{ type: Cesium\.UniformType\.FLOAT, value: params\.amplitude \?\? 1 \}/)
  assert.match(uniforms, /uniforms\.u_opacity = \{ type: Cesium\.UniformType\.FLOAT, value: params\.opacity \?\? 0\.75 \}/)
  // D-17 water-depth：固定深度色带，参数只有水面高程与最大映射深度。
  assert.match(sources['water-depth'], /u_waterHeight/)
  assert.match(sources['water-depth'], /u_depthMax/)
  assert.match(sources['water-depth'], /submerged/)
  assert.match(uniforms, /presets\.includes\('water-depth'\)/)
  assert.match(uniforms, /uniforms\.u_waterHeight = \{ type: Cesium\.UniformType\.FLOAT, value: params\.water_height \?\? 0 \}/)
  assert.match(uniforms, /uniforms\.u_depthMax = \{ type: Cesium\.UniformType\.FLOAT, value: params\.depth_max \?\? 50 \}/)
})

test('client 高程：positionWC 相对数据中心 ECEF、boundingSphere 估算、0..200 回退并夹到 -1000..9000', () => {
  assert.match(client, /const SHADER_HEIGHT_FLOOR = -1000/)
  assert.match(client, /const SHADER_HEIGHT_CEILING = 9000/)
  assert.match(client, /float height = length\(fsInput\.attributes\.positionWC\) - length\(u_center\) \+ u_centerHeight;/)

  const range = block(client, 'function shaderHeightRange(Cesium, tileset, fallbackCenter) {', '\n    }')
  assert.match(range, /tileset\?\.boundingSphere\?\.center \?\? tileset\?\.root\?\.boundingSphere\?\.center \?\? fallbackCenter \?\? null/)
  assert.match(range, /Cesium\.Cartographic\.fromCartesian\(center\)/)
  assert.match(range, /const radius = shaderFinite\(rawRadius\) \? Math\.abs\(rawRadius\) : 0/)
  assert.match(range, /minimum = shaderClamp\(centerHeight - radius, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING\)/)
  assert.match(range, /maximum = shaderClamp\(centerHeight \+ radius, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING\)/)
  // 契约指定的无包围球回退：0..200，不依赖相机高度。
  assert.match(range, /if \(!\(maximum > minimum\)\) \{\n        minimum = 0\n        maximum = 200\n      \}/)
  assert.match(range, /return \{ center, centerHeight, minimum, maximum, estimated: radius > 0 \}/)
})

test('client 引擎：CustomShader 构造、同层覆盖保留最初 previous、赋值失败回滚、reset 恢复原 shader', () => {
  const apply = block(client, 'function applyShader(request) {', '\n      }')
  assert.match(apply, /if \(typeof Cesium\.CustomShader !== 'function'\)/)
  assert.match(apply, /const layer = resolveShaderLayer\(request\.layer\)/)
  assert.match(apply, /const range = shaderHeightRange\(Cesium, layer\.tileset, null\)/)
  assert.match(apply, /request\.params\.min_height/)
  assert.match(apply, /request\.params\.max_height/)
  assert.match(apply, /const options = \{/)
  assert.match(apply, /fragmentShaderText: shaderFragmentSource\(request\.presets \?\? request\.preset\)/)
  assert.match(apply, /shader = new Cesium\.CustomShader\(options\)/)
  assert.match(apply, /options\.translucencyMode = Cesium\.CustomShaderTranslucencyMode\.INHERIT/)
  // 重复 apply 同一层时保留最早的 previous，避免 reset 恢复成自己造出来的 shader。
  assert.match(apply, /const previous = existing \? existing\.previous : \(layer\.tileset\.customShader \?\? null\)/)
  assert.match(apply, /layer\.tileset\.customShader = shader/)
  assert.match(apply, /if \(layer\.tileset\.customShader !== shader\) throw new Error/)
  assert.match(apply, /layer\.tileset\.customShader = previous \?\? undefined/)
  assert.match(apply, /shaderEntriesRef\.current\.set\(layer\.id, \{/)
  assert.match(apply, /ensureShaderTick\(\)/)
  assert.match(apply, /return shaderResult\('apply', request\.preset, layer\.name\)/)
  // 构造失败与赋值失败都必须带下一步，不允许留下半失效图层。
  assert.match(apply, /预设着色器构造失败/)
  assert.match(apply, /预设应用失败/)
  assert.match(apply, /'换一个预设或重置后重试。'/)

  const reset = block(client, 'function resetShader(layerToken) {', '\n      }')
  assert.match(reset, /const entry = entries\.get\(layer\.id\)/)
  assert.match(reset, /restoreShaderEntry\(entry\)/)
  assert.match(reset, /if \(entries\.size === 0\) releaseShaderTick\(\)/)
  assert.match(reset, /return shaderResult\('reset', null, targetLayerName\)/)
  const restore = block(client, 'function restoreShaderEntry(entry) {', '\n      }')
  assert.match(restore, /entry\.layer\.tileset\.customShader = entry\.previous \?\? undefined/)
  // 图层删除与面板卸载都清空 shader 状态。
  const remove = block(client, 'function removeLayer(id) {', '\n      }')
  assert.match(remove, /detachShaderForLayer\(id, false\)/)
  assert.match(client, /releaseShaderTick\(\)\n\s+shaderEntriesRef\.current\.clear\(\)/)
})

test('client u_time：单 preRender 监听、u_time uniform、首个 shader 注册、最后撤销时移除', () => {
  const ensure = block(client, 'function ensureShaderTick() {', '\n      }')
  assert.match(ensure, /if \(!viewer \|\| shaderTickRef\.current\) return/)
  assert.match(ensure, /viewer\.scene\.preRender\.addEventListener\(tick\)/)
  assert.match(ensure, /if \(!shader \|\| !shader\.uniforms \|\| !\('u_time' in shader\.uniforms\)\) continue/)
  assert.match(ensure, /shader\.setUniform\('u_time', seconds\)/)
  assert.match(ensure, /typeof performance !== 'undefined' \? performance\.now\(\) : Date\.now\(\)/)
  const release = block(client, 'function releaseShaderTick() {', '\n      }')
  assert.match(release, /handle\.viewer\.scene\.preRender\.removeEventListener\(handle\.tick\)/)
  assert.match(release, /shaderTickRef\.current = null/)
  // reset 后 entries 为空才移除监听；detach 图层同理。
  const detach = block(client, 'function detachShaderForLayer(id, restore) {', '\n      }')
  assert.match(detach, /if \(entries\.size === 0\) releaseShaderTick\(\)/)
  assert.match(detach, /if \(restore\) restoreShaderEntry\(entry\)/)
})

test('client 错误：3DGS/无 CustomShader/无可见图层/未知图层都是 shader: ... next: 单行', () => {
  assert.ok(client.includes("new Error('shader: 3DGS 图层不支持该预设。next: 换 3D Tiles 图层。')"))
  assert.ok(client.includes("shaderFail('当前 Cesium 不支持 CustomShader。', '升级 Cesium 版本或换用其他可视化方式。')"))
  assert.equal((client.match(/new Error\(`shader: /g) ?? []).length, 1)
  const fail = client.match(/const shaderFail = [^\n]+/)
  assert.ok(fail, '找不到 shaderFail 定义')
  assert.match(fail[0], /new Error\(`shader: \$\{message\} next: \$\{next\}`\)/)

  const gaussian = block(client, 'function shaderGaussianLayer(tileset, layer = null) {', '\n    }')
  assert.match(gaussian, /KHR_gaussian_splatting/)
  assert.match(gaussian, /hasExtension\('KHR_gaussian_splatting'\)/)
  const extensions = block(client, 'function shaderTilesetExtensions(tileset) {', '\n    }')
  assert.match(extensions, /tileset\?\._extensionsUsed/)
  assert.match(extensions, /tileset\?\.root\?\.extensionsUsed/)

  const layer = block(client, 'function resolveShaderLayer(token) {', '\n      }')
  assert.match(layer, /未找到图层/)
  assert.match(layer, /用 earth_scene 的 list 动作查看当前图层名/)
  assert.match(layer, /当前视图没有可见的 3D Tiles 图层/)
  assert.match(layer, /先加载或显示 3D Tiles 图层后重试/)
})

// ---------------------------------------------------------------------------
// Client：工作台 UI / 接线 / i18n
// ---------------------------------------------------------------------------

test('client 工作台：可见图层/五预设可叠加/按预设并集参数/应用与重置/活动列表/无 GLSL 编辑入口', () => {
  const card = block(client, 'function ShaderWorkbench({', '//#endregion shader workbench')
  assert.match(card, /const visibleLayers = layers\.filter\(\(layer\) => layer\.visible\)/)
  assert.match(card, /t\('shader\.layerAuto'\)/)
  assert.match(card, /const selectedPresets = Array\.isArray\(form\.preset\) \? form\.preset : \[form\.preset\]/)
  // 视觉特效：主网格四个日常效果，等高线入口已从界面移除（工具白名单保留）。
  assert.match(card, /\.\.\.SHADER_PRIMARY_PRESETS\.map\(/)
  assert.doesNotMatch(card, /SHADER_ADVANCED_PRESETS/)
  assert.match(card, /t\('shader\.targetHint'\)/)
  assert.match(card, /t\(`shader\.preset\.\$\{preset\}`\)/)
  // v1.6 工作台 2.0：滑杆 + 缩略图 + 目标图层 + 顺序 + 实时预览 + 原图对比。
  for (const key of ['minHeight', 'maxHeight', 'interval', 'speed', 'amplitude', 'opacity', 'waterHeight', 'depthMax']) {
    assert.match(card, new RegExp(`sliderField\\('${key}'`))
  }
  assert.match(card, /const thumb = \(preset\) =>/)
  assert.match(card, /className: 'thumb-svg'/)
  assert.match(card, /t\('shader\.targetAuto'/)
  assert.match(card, /t\('shader\.layerAutoNamed'/)
  assert.match(card, /t\('shader\.orderLabel'\)/)
  assert.match(card, /onPresetMove\(preset, -1\)/)
  assert.match(card, /onPresetMove\(preset, 1\)/)
  assert.match(card, /t\('shader\.livePreview'\)/)
  assert.match(card, /onPreview\(\)/)
  assert.match(card, /t\('shader\.compare'\)/)
  assert.match(card, /t\('shader\.appliedTag'\)/)
  assert.match(card, /t\('shader\.stackHint'\)/)
  assert.match(card, /t\('shader\.apply'\)/)
  assert.match(card, /t\('shader\.resetLayer'\)/)
  assert.match(card, /t\('shader\.resetAll'\)/)
  assert.match(card, /t\('shader\.active'\)/)
  assert.match(card, /t\('shader\.activeEmpty'\)/)
  assert.match(card, /t\('shader\.stackHint'\)/)
  assert.match(card, /t\('shader\.apply'\)/)
  assert.match(card, /t\('shader\.resetLayer'\)/)
  assert.match(card, /t\('shader\.resetAll'\)/)
  assert.match(card, /t\('shader\.active'\)/)
  assert.match(card, /t\('shader\.activeEmpty'\)/)
  // 工作台不提供 textarea/contentEditable 或原始 GLSL 编辑。
  assert.doesNotMatch(card, /textarea|contentEditable|<input[^>]*type: 'text'/i)
  assert.doesNotMatch(card, /glsl/i)

  const form = block(client, 'const [shaderForm, setShaderForm] = React.useState({', '\n      })')
  assert.match(form, /layerId: ''/)
  assert.match(form, /preset: 'height-false-color'/)
  assert.match(form, /interval: '20'/)
  assert.match(form, /speed: '1'/)
  assert.match(form, /amplitude: '1'/)
  assert.match(form, /opacity: '0\.75'/)
  assert.match(form, /waterHeight: ''/)
  assert.match(form, /depthMax: ''/)
  // 工作台只拼 bridge 形状参数，校验/图层解析统一由 shaderCommand 承担；D-17 起按叠加并集拼参数。
  // 这些映射在 v1.6 Phase 2 抽到 src/client/ui/workbench-wiring.js。
  const wiring = readRepoFile('src/client/ui/workbench-wiring.js')
  assert.ok(wiring.includes('export function toggleShaderPreset(form, preset)'), '缺少 toggleShaderPreset')
  assert.match(wiring, /const selected = Array\.isArray\(form\.preset\) \? form\.preset : \[form\.preset\]/)
  assert.match(wiring, /const has = \(preset\) => selected\.includes\(preset\)/)
  assert.match(wiring, /if \(has\('height-false-color'\)\)/)
  assert.match(wiring, /if \(has\('water-depth'\)\)/)
  assert.match(wiring, /const result = await shaderCommand\(buildShaderFormArgs\(getForm\(\)\)\)/)
  assert.match(wiring, /shaderCommand\(\{ action: 'reset', layer: resolved\.id \}\)/)
  assert.match(wiring, /export function moveShaderPreset\(form, preset, delta\)/)
  assert.match(wiring, /export function resolveWorkbenchTarget\(layers, form\)/)
  assert.match(wiring, /const target = \(\) => resolveWorkbenchTarget\(getLayers\(\), getForm\(\)\)/)
  assert.match(wiring, /shaderCompare\(resolved\.layer\.id, enabled\)/)
  assert.match(wiring, /await shaderCommand\(\{ action: 'reset' \}\)/)
  assert.match(client, /const workbench = useWorkbenchWiring\(\{/)
  assert.match(client, /onPreset: workbench\.toggle,/)
})

test('client 工作台 UI：工具栏按钮、可读卡片、三列缩略图、窄宽可滚动、截图隐藏', () => {
  assert.match(client, /function ShaderIcon\(/)
  assert.match(client, /h\(ShaderIcon\)/)
  assert.match(client, /shaderOpen \? t\('btn\.shaderHide'\) : t\('btn\.shaderShow'\)/)
  assert.match(client, /\(\) => setShaderOpen\(\(value\) => !value\)/)

  const rule = block(client, '.mv-shader{', '}')
  assert.match(rule, /position:absolute/)
  assert.match(rule, /top:60px/)
  // 2.0 卡片加宽到 340px 并改为实底磨砂，提升可读性。
  assert.match(rule, /width:min\(340px,calc\(100% - 20px\)\)/)
  assert.match(rule, /backdrop-filter:blur\(14px\)/)
  assert.match(rule, /--shader-mint:#3ddc97/)
  assert.match(rule, /max-height:calc\(100% - 150px\)/)
  assert.match(rule, /overflow:hidden/)
  assert.match(client, /\.mv-shader \.body\{[^}]*overflow:auto/)
  assert.match(client, /\.mv-shader \.presets\{[^}]*grid-template-columns:repeat\(3,1fr\)/)
  assert.match(client, /\.mv-shader \.preset \.thumb\{/)
  assert.match(client, /\.mv-shader \.param \.slider\{/)
  assert.match(client, /\.mv-shader \.order-badge\{/)
  const docked = block(client, '.mv-root.mv-docked .mv-shader{', '}')
  assert.match(docked, /width:min\(320px,calc\(100% - 40px\)\)/)
  assert.match(client, /\.mv-root\.mv-capturing[^{]*\.mv-shader/)
  // 工作台挂载由 shaderOpen 控制，关闭走 onClose。
  assert.match(client, /shaderOpen\n\s+\? h\(ShaderWorkbench, \{/)
  assert.match(client, /onClose: \(\) => \{\n\s+void workbench\.compare\(false\)/)
})

test('client 接线与 i18n：六 toolview 含 earth_shader、摘要键、shader.* 44 键中英对齐', () => {
  const toolviews = [...client.matchAll(/name: 'tool\.call\.toolview', key: '([a-z_]+)'/g)].map((match) => match[1])
  assert.deepEqual(toolviews, [
    'earth_scene', 'earth_capture', 'earth_draw', 'earth_measure', 'earth_analyze', 'earth_shader',
  ])
  assert.match(client, /earth_shader: 'tool\.action\.shader'/)
  assert.equal((client.match(/'tool\.action\.shader':/g) ?? []).length, 2)
  assert.match(client, /'tool\.action\.shader': '视觉特效'/)
  assert.match(client, /'tool\.action\.shader': 'Visual effects'/)

  const zhStart = client.indexOf('\n      zh: {')
  const enStart = client.indexOf('\n      en: {', zhStart)
  const end = client.indexOf('\n    }', enStart)
  assert.ok(zhStart > 0 && enStart > zhStart && end > enStart, 'i18n 字典结构变化，无法切片')
  const parseKeys = (text) => [...text.matchAll(/^        '([^']+)':/gm)].map((match) => match[1])
  const zhKeys = parseKeys(client.slice(zhStart, enStart))
  const enKeys = parseKeys(client.slice(enStart, end))
  assert.ok(zhKeys.length > 200, `中文键过少：${zhKeys.length}`)
  assert.deepEqual(zhKeys, enKeys, '中英字典键集合/顺序必须完全一致')

  const shaderKeys = zhKeys.filter((key) => key.startsWith('shader.'))
  assert.equal(shaderKeys.length, 46)
  for (const key of [
    'shader.title',
    'shader.close',
    'shader.layerLabel',
    'shader.layerAuto',
    'shader.presetLabel',
    'shader.preset.height-false-color',
    'shader.preset.contour',
    'shader.preset.scan',
    'shader.preset.water',
    'shader.param.minHeight',
    'shader.param.maxHeight',
    'shader.param.auto',
    'shader.param.interval',
    'shader.param.speed',
    'shader.param.amplitude',
    'shader.param.opacity',
    'shader.apply',
    'shader.resetLayer',
    'shader.resetAll',
    'shader.active',
    'shader.activeEmpty',
    'shader.noLayers',
  ]) {
    assert.ok(shaderKeys.includes(key), `缺少 i18n 键 ${key}`)
  }
  // 工具栏/提示/摘要键也在两本词典里。
  for (const prefix of ['btn.shader', 'toast.shader']) {
    assert.equal(zhKeys.filter((key) => key.startsWith(prefix)).length, prefix === 'btn.shader' ? 2 : 3)
  }
})

// ---------------------------------------------------------------------------
// QA 边界
// ---------------------------------------------------------------------------

test('QA 边界：不新增依赖，分析/着色器状态进入持久化场景快照', () => {
  const pkg = JSON.parse(packageText)
  assert.equal(pkg.dependencies, undefined)
  // v1.5：client.js 由 src/client 构建为单一产物，esbuild 是唯一的构建期依赖。
  assert.deepEqual(Object.keys(pkg.devDependencies ?? {}), ['esbuild'])
  assert.equal(pkg.scripts.test, 'node --test')
  assert.match(pkg.scripts.check, /node --check index\.js/)
  assert.match(pkg.scripts.check, /node --check client\.js/)

  // P0: the active analysis command and shader presets are part of the snapshot
  // so a remounted panel redraws them; only the command, never the entities.
  const snapshot = block(client, 'const currentSceneSnapshot = () => {', 'const saveSceneSnapshot')
  assert.match(snapshot, /analysis: analysisCommandRef\.current/)
  assert.match(snapshot, /shaders: \[\.\.\.shaderEntriesRef\.current\.values\(\)\]/)
  assert.match(snapshot, /preset: entry\.preset/)
  assert.match(client, /const saveSceneSnapshot = \(forceHost = false\) => \{/)
  assert.match(client, /restoreSceneSnapshot\(snapshot\)/)
  assert.match(client, /await shaderCommand\(\{ action: 'apply', preset: item\.preset, layer: item\.layer/)
  assert.match(client, /await analyzeCommand\(snapshot\.analysis\)/)
})
