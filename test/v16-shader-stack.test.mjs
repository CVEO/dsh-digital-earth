/**
 * v1.6 S2-P2 — stacked shader presets (D-17, second half).
 *
 * `preset` accepts one whitelisted preset or an ordered array of 1..3. Stacked
 * presets are composed into ONE CustomShader: each fragment body gets its own GLSL
 * block scope (so local variables like `height` cannot collide), uniforms are the
 * union of the selected presets, defaults merge in array order, and the composed
 * source is still checked against the 8 KB whitelist limit.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { SHADER_MAX_STACK, SHADER_PRESETS, shaderFragmentSource, shaderUniforms, shaderValidateRequest } from '../src/client/shader/presets.js'
import { normalizeShaderRequest } from '../src/host/tools/shader.js'
import { hostSource, readRepoFile } from './helpers/source.mjs'

const hostArgs = (raw) => normalizeShaderRequest(raw).args
const hostRejects = (raw, pattern) => {
  assert.throws(() => normalizeShaderRequest(raw), (error) => {
    assert.match(error.message, /^earth_shader: /)
    assert.match(error.message, / next: /)
    if (pattern) assert.match(error.message, pattern)
    return true
  })
}
const clientRejects = (raw, pattern) => {
  const result = shaderValidateRequest(raw)
  assert.ok(result instanceof Error, `期望校验失败，实际返回：${JSON.stringify(result)}`)
  assert.match(result.message, /^shader: /)
  assert.match(result.message, / next: /)
  if (pattern) assert.match(result.message, pattern)
}

// ---------------------------------------------------------------------------
// Host contract
// ---------------------------------------------------------------------------

test('宿主：preset 数组 1..3 个，保留顺序；单个字符串仍返回字符串', () => {
  assert.equal(SHADER_MAX_STACK, 3)
  assert.deepEqual(hostArgs({ action: 'apply', preset: ['contour', 'scan'] }), {
    action: 'apply',
    preset: ['contour', 'scan'],
    interval: 20,
    speed: 1,
  })
  assert.deepEqual(hostArgs({ action: 'apply', preset: 'contour' }), { action: 'apply', preset: 'contour', interval: 20 })
  assert.deepEqual(hostArgs({ action: 'apply', preset: ['water', 'height-false-color'], min_height: 0, max_height: 100 }), {
    action: 'apply',
    preset: ['water', 'height-false-color'],
    speed: 1,
    amplitude: 1,
    opacity: 0.75,
    min_height: 0,
    max_height: 100,
  })
  // 重复预设与超过 3 个都被拒绝。
  hostRejects({ action: 'apply', preset: ['water', 'water'] }, /duplicates/)
  hostRejects({ action: 'apply', preset: ['contour', 'scan', 'water', 'water-depth'] }, /1\.\.3 presets/)
  hostRejects({ action: 'apply', preset: ['nope'] }, /unknown preset "nope"/)
  // 数组里的预设共享参数并集；不属于并集的参数拒绝。
  hostRejects({ action: 'apply', preset: ['contour'], speed: 2 }, /does not accept "speed"/)
})

test('宿主：schema 允许 string 或 1..3 数组，仍是白名单枚举', () => {
  const host = hostSource()
  assert.match(host, /oneOf: \[\n\s+\{ type: 'string', enum: SHADER_PRESETS \},/)
  assert.match(host, /maxItems: SHADER_MAX_STACK/)
  assert.match(host, /uniqueItems: true/)
})

test('宿主：渲染文本把叠加预设显示为 a + b', () => {
  const host = hostSource()
  assert.match(host, /Array\.isArray\(value\.preset\)/)
  assert.match(host, /\.join\(' \+ '\)/)
})

// ---------------------------------------------------------------------------
// Client validation + composition
// ---------------------------------------------------------------------------

test('client：数组校验通过并返回 presets，顺序与参数并集正确', () => {
  const request = shaderValidateRequest({ action: 'apply', preset: ['contour', 'water-depth'], interval: 50, depth_max: 80 })
  assert.equal(request.operation, 'apply')
  assert.deepEqual(request.presets, ['contour', 'water-depth'])
  assert.deepEqual(request.preset, ['contour', 'water-depth'])
  assert.equal(request.params.interval, 50)
  assert.equal(request.params.depth_max, 80)
  // water-depth 的默认值也参与合并。
  assert.equal(request.params.water_height, 0)
})

test('client：重复 / 超过 3 个 / 非法预设 / 跨预设多余参数都被拒绝', () => {
  clientRejects({ action: 'apply', preset: ['scan', 'scan'] }, /预设不能重复/)
  clientRejects({ action: 'apply', preset: ['contour', 'scan', 'water', 'water-depth'] }, /1\.\.3 个预设/)
  clientRejects({ action: 'apply', preset: ['nope'] }, /不支持的预设/)
  clientRejects({ action: 'apply', preset: ['contour'], amplitude: 1 }, /不接受参数 "amplitude"/)
})

test('client：叠加源码按顺序各包一层块作用域，单预设源码保持原样', () => {
  const single = shaderFragmentSource('contour')
  assert.match(single, /void fragmentMain\(FragmentInput fsInput, inout czm_modelMaterial material\) \{/)
  assert.doesNotMatch(single, /\{\s*\/\/ contour/)

  const stacked = shaderFragmentSource(['contour', 'scan'])
  assert.match(stacked, /\/\/ contour\n  \{[\s\S]*?u_interval/)
  assert.match(stacked, /\/\/ scan\n  \{[\s\S]*?u_time/)
  // 每个 body 独立作用域：花括号成对且顺序为 contour 先、scan 后。
  assert.ok(stacked.indexOf('// contour') < stacked.indexOf('// scan'))
  assert.ok(stacked.length < 8 * 1024)
  assert.equal((stacked.match(/void fragmentMain/g) ?? []).length, 1, '叠加后只能有一个 fragmentMain')
})

test('client：uniform 取所选预设的并集', () => {
  const Cesium = { UniformType: { VEC3: 'vec3', FLOAT: 'float' } }
  const range = { center: { x: 1, y: 2, z: 3 }, centerHeight: 10, minimum: 0, maximum: 100 }
  const uniforms = shaderUniforms(Cesium, ['contour', 'scan', 'water-depth'], { interval: 30, speed: 2 }, range)
  for (const key of ['u_center', 'u_centerHeight', 'u_interval', 'u_minHeight', 'u_speed', 'u_waterHeight', 'u_depthMax']) {
    assert.ok(key in uniforms, `叠加后缺少 uniform ${key}`)
  }
  assert.equal(uniforms.u_interval.value, 30)
  assert.equal(uniforms.u_minHeight.value, 0)
  assert.equal(uniforms.u_maxHeight.value, 100)
  // 单个预设不需要的 uniform 不能被无端声明。
  const contourOnly = shaderUniforms(Cesium, ['contour'], { interval: 20 }, range)
  assert.equal('u_speed' in contourOnly, false)
  assert.equal('u_waterHeight' in contourOnly, false)
})

test('engine：apply 使用 presets 数组，并识别 water/water-depth 的透明模式', () => {
  const engine = readRepoFile('src/client/scene/shader-engine.js')
  assert.match(engine, /shaderUniforms\(Cesium, request\.presets \?\? request\.preset, request\.params, range\)/)
  assert.match(engine, /shaderFragmentSource\(request\.presets \?\? request\.preset\)/)
  assert.match(engine, /const stack = Array\.isArray\(request\.presets\) \? request\.presets : \[request\.preset\]/)
  assert.match(engine, /stack\.includes\('water'\) \|\| stack\.includes\('water-depth'\)/)
})

test('client 预设清单仍冻结为五个（叠加不新增预设）', () => {
  assert.deepEqual([...SHADER_PRESETS], ['height-false-color', 'contour', 'scan', 'water', 'water-depth'])
})
