/**
 * v1.6 S1-5 — additive-contract close-out.
 *
 * The 1.6 work added fields (quality, raster overlays) to two places the Agent
 * and the panel both read: the persisted catalog (`sources.json` → `normalizeConfig`)
 * and `earth_scene status`. Neither may rename or drop an older field, and the
 * frozen six-tool surface must not drift. These tests are the guard that makes
 * "additive only" enforceable instead of a convention.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

import { clientSource, hostSource } from './helpers/source.mjs'

const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-contract-'))
process.env.DSH_HOME = home
const { normalizeConfig, ANALYZE_ACTIONS, SHADER_PRESETS } = await import(new URL('../index.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Catalog contract
// ---------------------------------------------------------------------------

test('catalog 契约：顶层四个字段固定（imagery / terrain / rasterOverlays / settings）', () => {
  const config = normalizeConfig({})
  assert.deepEqual(Object.keys(config).sort(), ['imagery', 'rasterOverlays', 'settings', 'terrain'])
})

test('catalog 契约：settings 键集合固定，新增项不得挤掉旧项', () => {
  const { settings } = normalizeConfig({})
  assert.deepEqual(Object.keys(settings).sort(), [
    'imagery',
    'quality',
    'screenshotHud',
    'showHud',
    'showLayers',
    'terrain',
    'terrainDepthTest',
    'theme',
  ])
  // 类型也不能漂移（旧客户端按这些类型读）。
  assert.equal(typeof settings.theme, 'string')
  assert.equal(settings.imagery, 'esri-world-imagery')
  assert.equal(settings.terrain, null)
  assert.equal(settings.screenshotHud, false)
  assert.equal(settings.showLayers, true)
  assert.equal(settings.showHud, true)
  assert.equal(settings.quality, 'balanced')
  assert.equal(settings.terrainDepthTest, false)
})

test('catalog 契约：叠加层条目的字段允许集合固定（L3 面板与 Agent 都按它读）', () => {
  const config = normalizeConfig({
    rasterOverlays: [
      { id: 'w', name: 'W', type: 'wms', url: 'https://e/wms', layers: 'a:b', opacity: 0.5 },
      { id: 'x', name: 'X', type: 'xyz', url: 'https://e/{z}/{x}/{y}.png' },
    ],
  })
  const [wms, xyz] = config.rasterOverlays
  // WMS carries the layer name; XYZ does not. Both carry the stack fields.
  assert.deepEqual(Object.keys(wms).sort(), ['id', 'layers', 'name', 'opacity', 'type', 'url', 'visible'])
  assert.deepEqual(Object.keys(xyz).sort(), ['id', 'name', 'opacity', 'type', 'url', 'visible'])
  assert.equal(wms.layers, 'a:b')
  assert.equal(xyz.layers, undefined)
})

// ---------------------------------------------------------------------------
// earth_scene status contract (additive fields only)
// ---------------------------------------------------------------------------

test('status 契约：既有字段仍在，render 的字段是加法（fps/idle/depth + 1.6 三项）', () => {
  const client = clientSource()
  // 1.3–1.5 就有的字段，任何一个都不能消失或改名。
  for (const key of ['ready:', 'view:', 'layers:', 'imagery:', 'terrain:', 'sources:', 'viewport:', 'snapshot:', 'measureTool:', 'annotations:', 'busy:']) {
    assert.match(client, new RegExp(`\\b${key}`), `status 缺少既有字段 ${key}`)
  }
  for (const key of ['fps:', 'idle:', 'terrain_depth_test:', 'quality:', 'resolution_scale:', 'globe_maximum_screen_space_error:']) {
    assert.match(client, new RegExp(`\\b${key}`), `status.render 缺少字段 ${key}`)
  }
  assert.match(client, /raster_overlays: overlayLayersRef\.current\?\.list\(\) \?\? \[\]/)
})

// ---------------------------------------------------------------------------
// Frozen tool surface
// ---------------------------------------------------------------------------

test('工具契约：仍是六个工具，scene 12 个 action，analyze 4 个，shader 4 个预设', () => {
  const host = hostSource()
  const tools = ['earth_scene', 'earth_capture', 'earth_draw', 'earth_measure', 'earth_analyze', 'earth_shader']
  for (const name of tools) assert.match(host, new RegExp(`'${name}'`), `缺少工具 ${name}`)
  assert.equal([...host.matchAll(/create\w+Tool\(/g)].length >= 6, true, '工具工厂不足 6 个')

  const sceneBlock = host.match(/const SCENE_ACTIONS = \{([\s\S]*?)\n\}/)
  assert.ok(sceneBlock, '找不到 SCENE_ACTIONS')
  const sceneActions = [...sceneBlock[1].matchAll(/^\s{2}([a-z]+):/gm)].map((match) => match[1])
  assert.deepEqual(sceneActions, ['status', 'list', 'load', 'remove', 'visible', 'basemap', 'terrain', 'fly', 'reset', 'pick', 'inspect', 'report'])

  assert.deepEqual([...ANALYZE_ACTIONS], ['profile', 'flood', 'sunlight', 'clear'])
  assert.deepEqual([...SHADER_PRESETS], ['height-false-color', 'contour', 'scan', 'water'])
})

// ---------------------------------------------------------------------------
// Version single-source (1.6.0)
// ---------------------------------------------------------------------------

test('版本单源：package / Host About / Client About / README / CHANGELOG 顶部一致', async () => {
  const { readRepoFile } = await import('./helpers/source.mjs')
  const pkg = JSON.parse(readRepoFile('package.json'))
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.match(readRepoFile('src/host/about.js'), new RegExp(`version: '${pkg.version.replaceAll('.', '\\.')}'`))
  assert.match(readRepoFile('src/client/messages.js'), new RegExp(`version: '${pkg.version.replaceAll('.', '\\.')}'`))
  assert.ok(readRepoFile('README.md').includes(`版本-${pkg.version}-4f8cff`))
  assert.ok(readRepoFile('CHANGELOG.md').startsWith(`# Changelog\n\n## ${pkg.version}\n`))
})
