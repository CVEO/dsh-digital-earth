/**
 * v1.5.2 visual effects — productisation of the shader workbench (P0 4.4/4.12).
 *
 * The bridge contract is frozen (five whitelisted presets, 1..3 stacking, apply /
 * reset / list). What changes is presentation and scene hygiene:
 *   - the card's primary grid holds the four everyday looks; contour is no longer
 *     presented (tool whitelist keeps it for contract compatibility);
 *   - water ripples are long enough (≈50–100 m) to animate at a city overview;
 *   - scan is back to the 1.5 sweep speed/band so the moving stripe is visible;
 *   - the engine prunes stale entries (removed/hidden layer), restores the original
 *     shader and releases the u_time tick, so reset / hide never leave a residue.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

import {
  SHADER_ADVANCED_PRESETS,
  SHADER_FRAGMENT_SOURCES,
  SHADER_MAX_STACK,
  SHADER_PRESETS,
  SHADER_PRIMARY_PRESETS,
} from '../src/client/shader/presets.js'
import { SHADER_ACTIONS, SHADER_PRESETS as HOST_SHADER_PRESETS } from '../src/host/tools/shader.js'
import { readRepoFile } from './helpers/source.mjs'

// shader-engine.js pulls format.js -> i18n.js, which imports React (the DSH host
// provides it at runtime; the repo has no React dependency). A local loader maps
// that specifier to a stub so the engine itself can be executed here.
register('./helpers/react-stub-loader.mjs', import.meta.url)
const { createShaderEngine } = await import('../src/client/scene/shader-engine.js')

// ---------------------------------------------------------------------------
// Contract: presentation grouping never touches the six-tool surface
// ---------------------------------------------------------------------------

test('契约冻结：earth_shader 仍是五个白名单预设，PRIMARY/ADVANCED 只是 UI 分组', () => {
  assert.deepEqual([...HOST_SHADER_PRESETS], ['height-false-color', 'contour', 'scan', 'water', 'water-depth'])
  assert.deepEqual([...SHADER_PRESETS], [...HOST_SHADER_PRESETS])
  assert.deepEqual([...SHADER_ACTIONS], ['apply', 'reset', 'list'])
  assert.equal(SHADER_MAX_STACK, 3, '1..3 叠加能力必须保留')
  assert.deepEqual([...SHADER_PRIMARY_PRESETS], ['height-false-color', 'scan', 'water', 'water-depth'])
  assert.deepEqual([...SHADER_ADVANCED_PRESETS], ['contour'])
  assert.deepEqual([...SHADER_PRIMARY_PRESETS, ...SHADER_ADVANCED_PRESETS].sort(), [...SHADER_PRESETS].sort())
})

// ---------------------------------------------------------------------------
// Water: visible ripples from a city overview, no shimmer in a close-up
// ---------------------------------------------------------------------------

test('water：波纹空间频率约 0.06（≈50–100 m 波长），fwidth 淡出阈值 5–40 m，u_time 持续动画', () => {
  const water = SHADER_FRAGMENT_SOURCES.water
  assert.match(water, /vec2 position = vec2\(dot\(local, east\), dot\(local, north\)\) \* 0\.06/)
  assert.match(water, /fwidth\(position\)/)
  assert.match(water, /1\.0 - smoothstep\(5\.0, 40\.0, footprint\)/)
  // 动画靠 u_time 驱动，speed 参数仍然生效。
  assert.match(water, /float time = u_time \* max\(u_speed, 0\.1\)/)
  assert.match(water, /sin\(dot\(position, vec2\(1\.7, 0\.65\)\) - time\)/)
  // 波纹真正影响颜色（不是静态一层蓝），并保留水面覆盖（淹没分析）语义。
  assert.match(water, /\(u_amplitude \/ \(1\.0 \+ u_amplitude\)\) \* 3\.0/, '默认幅度下必须可见')
  assert.match(water, /clamp\(0\.5 \+ ripple \* 0\.5, 0\.0, 1\.0\)/)
  assert.match(water, /mix\(material\.diffuse, waterColor, u_opacity \* coverage \* 0\.72\)/)
  assert.match(water, /u_waterMask/)
  // 近景淡出靠 fwidth 阈值，避免高密度闪烁：阈值下限必须明显大于旧值 0.35。
  assert.ok(water.includes('smoothstep(5.0, 40.0'), '淡出区间必须移到城市尺度')
  assert.ok(water.length <= 8 * 1024, 'water 源码超 8 KB')
})

// ---------------------------------------------------------------------------
// Scan: aligned with the 1.5 look
// ---------------------------------------------------------------------------

test('scan：恢复 1.5 的扫描节奏（约 8 s 一圈、带约 5% 高程跨度）且从默认视角可见', () => {
  const scan = SHADER_FRAGMENT_SOURCES.scan
  // 1.5.0 的旧实现：fract(u_time * speed * 0.12) + smoothstep(0, 0.05, d) 的亮带。
  assert.match(scan, /fract\(u_time \* max\(u_speed, 0\.1\) \* 0\.12\)/)
  assert.match(scan, /1\.0 - smoothstep\(0\.0, 0\.045, distanceToBand\)/)
  // 带的核心必须高权重混入亮色，同时整体只做适度压暗（旧版 0.6，不能更夸张）。
  assert.match(scan, /clamp\(glow \* 0\.45 \+ band \* 0\.55, 0\.0, 1\.0\)/)
  assert.match(scan, /material\.diffuse \*= 0\.72/)
  assert.match(scan, /u_maxHeight - u_minHeight/)
  assert.ok(scan.length <= 8 * 1024)
})

// ---------------------------------------------------------------------------
// Engine: stale-entry pruning / thorough reset / explicit target
// ---------------------------------------------------------------------------

function makeCesium() {
  class FakeCustomShader {
    constructor(options) {
      this.options = options
      this.uniforms = {}
      for (const [name, uniform] of Object.entries(options.uniforms ?? {})) this.uniforms[name] = { value: uniform.value }
      this.fragmentShaderText = options.fragmentShaderText
    }
    setUniform(name, value) {
      this.uniforms[name] = { value }
    }
  }
  return {
    CustomShader: FakeCustomShader,
    CustomShaderTranslucencyMode: { INHERIT: 1 },
    UniformType: { VEC3: 'vec3', FLOAT: 'float' },
    Cartesian3: { fromDegrees: () => ({ x: 6378137, y: 0, z: 0 }) },
    Cartographic: { fromCartesian: () => ({ height: 20 }) },
  }
}

function makeLayer(id) {
  return {
    id,
    name: id.toUpperCase(),
    visible: true,
    kind: 'tiles',
    tileset: { customShader: null, root: { boundingVolume: { minimumHeight: 0, maximumHeight: 100 } } },
  }
}

function createHarness(layers) {
  const Cesium = makeCesium()
  const listeners = new Set()
  const viewer = {
    scene: {
      preRender: {
        addEventListener: (fn) => listeners.add(fn),
        removeEventListener: (fn) => listeners.delete(fn),
      },
    },
  }
  const entries = { current: new Map() }
  const tickRef = { current: null }
  const updates = []
  const findLayer = (token) => {
    const value = typeof token === 'string' ? token.trim() : ''
    if (value === '') return null
    return (
      layers.find((layer) => layer.id === value) ??
      layers.find((layer) => layer.name.toLowerCase() === value.toLowerCase()) ??
      null
    )
  }
  const engine = createShaderEngine({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    getLayers: () => layers,
    findLayer,
    entries,
    tickRef,
    setShaderActive: (list) => updates.push(list),
  })
  return { engine, layers, entries, tickRef, listeners, updates, Cesium }
}

test('engine：图层被隐藏后 activeList 清理 stale entry、恢复原有着色器并释放 tick', async () => {
  const a = makeLayer('a')
  const harness = createHarness([a])
  const applied = await harness.engine.command({ action: 'apply', preset: 'water' })
  assert.equal(applied.operation, 'apply')
  assert.equal(applied.layer, 'A', 'apply 返回必须说明目标图层')
  assert.equal(applied.preset, 'water')
  assert.equal(applied.target, 'auto', '缺省入口必须标记为自动选层')
  assert.equal(harness.entries.current.size, 1)
  assert.ok(a.tileset.customShader instanceof harness.Cesium.CustomShader)
  assert.equal(harness.listeners.size, 1, '动画 tick 在第一个特效时注册')

  // 图层被别的路径直接隐藏（不是经 setLayerVisible）：下一次读取 active 必须自愈。
  a.visible = false
  assert.deepEqual(harness.engine.activeList(), [])
  assert.equal(harness.entries.current.size, 0, 'stale entry 必须删除')
  assert.equal(a.tileset.customShader, undefined, '必须恢复图层原有的 shader')
  assert.equal(harness.tickRef.current, null, '没有特效时 tick 必须释放')
  assert.equal(harness.listeners.size, 0)
  assert.deepEqual(harness.updates.at(-1), [], 'refreshShaderActive 必须同步成空列表')
})

test('engine：图层被移除后 activeList 同样清理，且不会留下双 active', async () => {
  const a = makeLayer('a')
  const b = makeLayer('b')
  const layers = [a, b]
  const harness = createHarness(layers)
  await harness.engine.command({ action: 'apply', preset: 'height-false-color', layer: 'a' })
  await harness.engine.command({ action: 'apply', preset: 'scan', layer: 'b' })
  assert.equal(harness.engine.activeList().length, 2)
  assert.equal(harness.listeners.size, 1, '多个特效共用一个 tick')

  layers.length = 0 // both tilesets removed from the scene
  assert.deepEqual(harness.engine.activeList(), [])
  assert.equal(harness.entries.current.size, 0)
  assert.equal(harness.tickRef.current, null, '移除后的特效不能继续驱动 tick')
})

test('engine：显式 layer 返回 target="layer"；隐藏图层应用特效会给出可执行错误', async () => {
  const a = makeLayer('a')
  const b = makeLayer('b')
  const harness = createHarness([a, b])
  const auto = await harness.engine.command({ action: 'apply', preset: 'water-depth' })
  assert.equal(auto.target, 'auto')
  assert.equal(auto.layer, 'B', '自动选最上层可见图层')
  const explicit = await harness.engine.command({ action: 'apply', preset: 'height-false-color', layer: 'a' })
  assert.equal(explicit.target, 'layer')
  assert.equal(explicit.layer, 'A')
  assert.equal(explicit.preset, 'height-false-color')

  b.visible = false
  await assert.rejects(
    harness.engine.command({ action: 'apply', preset: 'water', layer: 'b' }),
    (error) => /^shader: /.test(error.message) && /next: /.test(error.message),
    '给隐藏图层应用特效必须报错而不是假装成功',
  )
})

test('engine：reset all 彻底清空 entries / comparisons / tick，并恢复原有着色器', async () => {
  const originalA = { kind: 'original-a' }
  const a = makeLayer('a')
  a.tileset.customShader = originalA
  const b = makeLayer('b')
  const harness = createHarness([a, b])
  await harness.engine.command({ action: 'apply', preset: 'water', layer: 'a' })
  await harness.engine.command({ action: 'apply', preset: 'scan', layer: 'b' })
  // 进入原图对比，reset 必须同时结束对比（不能把图层留在原始外观）。
  await harness.engine.compare('a', true)
  assert.notEqual(a.tileset.customShader, harness.entries.current.get('a').shader)

  const reset = await harness.engine.command({ action: 'reset' })
  assert.equal(reset.operation, 'reset')
  assert.deepEqual(reset.active, [])
  assert.equal(harness.entries.current.size, 0)
  assert.equal(a.tileset.customShader, originalA, '原有的自定义 shader 必须恢复')
  assert.equal(b.tileset.customShader, undefined)
  assert.equal(harness.tickRef.current, null)
  assert.equal(harness.listeners.size, 0)
  await assert.throws(() => harness.engine.compare('a', true), /还没有应用着色器/, '对比状态必须随 reset 清除')
})

test('engine：reset 单层只清该层，其余特效和 tick 保留', async () => {
  const a = makeLayer('a')
  const b = makeLayer('b')
  const harness = createHarness([a, b])
  await harness.engine.command({ action: 'apply', preset: 'water', layer: 'a' })
  await harness.engine.command({ action: 'apply', preset: 'water-depth', layer: 'b' })
  const reset = await harness.engine.command({ action: 'reset', layer: 'a' })
  assert.deepEqual(reset.active.map((entry) => entry.layer), ['B'])
  assert.equal(harness.entries.current.size, 1)
  assert.equal(a.tileset.customShader, undefined)
  assert.ok(b.tileset.customShader instanceof harness.Cesium.CustomShader)
  assert.ok(harness.tickRef.current !== null, '另一个图层仍在动画，tick 不能被释放')
  assert.equal(harness.listeners.size, 1)
})

test('engine：同层重复应用仍是唯一 entry；叠加数组不因 UI 分组而失效', async () => {
  const a = makeLayer('a')
  const harness = createHarness([a])
  const stacked = await harness.engine.command({ action: 'apply', preset: ['water', 'height-false-color'], min_height: 0, max_height: 80 })
  assert.deepEqual(stacked.stack, ['water', 'height-false-color'])
  assert.equal(harness.entries.current.size, 1)
  const again = await harness.engine.command({ action: 'apply', preset: 'scan' })
  assert.deepEqual(again.stack, ['scan'], '同层换特效会替换而不是叠加第二个 entry')
  assert.equal(harness.entries.current.size, 1)
  assert.equal(harness.engine.activeList().length, 1)

  const listed = await harness.engine.command({ action: 'list' })
  assert.equal(listed.operation, 'list')
  assert.deepEqual(listed.presets, [...SHADER_PRESETS])
})

test('engine 源码：prune / reset 的清理逻辑与 target 标记都在（结构护栏）', () => {
  const engine = readRepoFile('src/client/scene/shader-engine.js')
  assert.match(engine, /function pruneShaderEntries\(\)/)
  assert.match(engine, /entry\.layer\.id/)
  assert.match(engine, /comparisons\.delete\(entry\.layer\.id\)/)
  assert.match(engine, /const layer = layersRef\.current\.find\(\(item\) => item\.id === entry\.layer\.id\)/)
  assert.match(engine, /comparisons\.clear\(\)/, 'reset 必须清空对比状态')
  assert.match(engine, /target: shaderResolveMode/, 'apply 结果必须说明 auto/layer')
  assert.ok(engine.split('\n').length < 400, 'shader-engine 行数预算 400')
})

// ---------------------------------------------------------------------------
// Workbench presentation: only the four primary looks, no contour entry
// ---------------------------------------------------------------------------

test('cards/css：只展示四个主效果，等高线入口与高级区已移除', () => {
  const cards = readRepoFile('src/client/ui/cards.js')
  assert.match(cards, /\.\.\.SHADER_PRIMARY_PRESETS\.map\(/)
  assert.doesNotMatch(cards, /SHADER_ADVANCED_PRESETS\.map/, '界面不得再渲染等高线分组')
  assert.doesNotMatch(cards, /\.\.\.SHADER_PRESETS\.map/, '工作台不得平铺全部预设')
  assert.doesNotMatch(cards, /shader\.advanced/, '高级效果分组已移除')
  assert.match(cards, /t\('shader\.targetHint'\)/, '必须说明特效只作用于 mesh 3D Tiles')
  assert.match(cards, /t\('shader\.singleHint'\)/)
  // 高程渐变默认使用可见表面采样范围，而不是包围体范围（避免整片平色）。
  assert.match(cards, /elevation\.range\?\.source === 'visible_surface'/)
  assert.match(cards, /String\(sampledRange\.minimum\)/)
  // 应用 / 重置 / 对比逻辑保持。
  for (const marker of ['runApply', 'runResetLayer', 'runResetAll', 'toggleCompare', 'onPreset(preset)']) {
    assert.ok(cards.includes(marker), `工作台缺少 ${marker}`)
  }
  const css = readRepoFile('src/client/ui/css.js')
  assert.doesNotMatch(css, /\.mv-shader \.advanced\{/, '高级效果样式应一并移除')
  // 旧的三列网格保持不变；四个主效果时第 4 个横跨整行，避免空单元格。
  assert.match(css, /\.mv-shader \.presets\{display:grid;grid-template-columns:repeat\(3,1fr\)/)
  assert.match(css, /\.mv-shader \.presets\.primary \.preset:nth-child\(4\)\{grid-column:1\/-1\}/)
})

test('ViewerSurface：隐藏图层立即 detach 特效，行数仍在预算内', () => {
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /function setLayerVisible\(id, visible\) \{/)
  assert.match(viewer, /if \(!visible\) detachShaderForLayer\(id, true\)/)
  assert.match(viewer, /function removeLayer\(id\) \{[\s\S]{0,900}?detachShaderForLayer\(id, false\)/, '图层删除仍保留 detach')
  const lines = viewer.endsWith('\n') ? viewer.split('\n').length - 1 : viewer.split('\n').length
  assert.ok(lines <= 2930, `ViewerSurface 行数 ${lines} 超过预算 2930`)
})
