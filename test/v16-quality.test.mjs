/**
 * v1.6 S1 — render quality tiers.
 *
 * Two layers of coverage:
 *  - behaviour: the pure tier table (src/client/scene/quality.js) and the host
 *    catalog normalization that persists the user's choice;
 *  - wiring: the panel actually applies the tier (viewer creation, settings save,
 *    status) and the settings dialog exposes it.
 *
 * The "terrainDepthTest was dropped by normalizeConfig" bug is pinned here too:
 * the host catalog is the single persisted copy of the settings, so any field
 * the client stores must survive normalization or it silently resets.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_QUALITY, QUALITY_MODES, applyQuality, normalizeQuality, qualityProfile } from '../src/client/scene/quality.js'
import { clientSource } from './helpers/source.mjs'

// constants.js fixes STATE_DIR at import time, so point DSH_HOME at a temp dir
// before the host entry is loaded.
const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-quality-'))
process.env.DSH_HOME = home
const { normalizeConfig } = await import(new URL('../index.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Behaviour: the tier table
// ---------------------------------------------------------------------------

test('质量档：只有 balanced / high 两个合法值，未知值回退默认', () => {
  assert.deepEqual(QUALITY_MODES, ['balanced', 'high'])
  assert.equal(DEFAULT_QUALITY, 'balanced')
  assert.equal(normalizeQuality('high'), 'high')
  assert.equal(normalizeQuality('balanced'), 'balanced')
  for (const bad of [undefined, null, '', 'ultra', 1, {}]) {
    assert.equal(normalizeQuality(bad), 'balanced')
  }
})

test('质量档：均衡更省，高清回到 Cesium 默认；均衡的分辨率/地形/瓦片三种 LOD 都更粗', () => {
  const balanced = qualityProfile('balanced')
  const high = qualityProfile('high')
  assert.equal(balanced.resolutionScale, 0.85)
  assert.equal(balanced.msaaSamples, 2)
  assert.equal(high.resolutionScale, 1)
  assert.equal(high.msaaSamples, 4)
  // Terrain and photogrammetry LOD must both be coarser in the balanced tier;
  // higher screen-space error = fewer selected tiles = cheaper frames.
  assert.ok(balanced.globeMaximumScreenSpaceError > high.globeMaximumScreenSpaceError)
  assert.ok(balanced.tilesetMaximumScreenSpaceError > high.tilesetMaximumScreenSpaceError)
  // Cache is larger when tiles are coarser to avoid refetching while panning.
  assert.ok(balanced.globeTileCacheSize >= high.globeTileCacheSize)
  // Callers may mutate the returned profile; the table must not change.
  balanced.resolutionScale = 99
  assert.equal(qualityProfile('balanced').resolutionScale, 0.85)
})

test('质量档：applyQuality 把档位写到 viewer 与已加载的 tileset 上', () => {
  const tileset = { maximumScreenSpaceError: 16 }
  const viewer = {
    resolutionScale: 1,
    scene: { globe: { maximumScreenSpaceError: 2, tileCacheSize: 100 } },
  }
  applyQuality(viewer, 'balanced', [tileset, null])
  assert.equal(viewer.resolutionScale, 0.85)
  assert.equal(viewer.scene.globe.maximumScreenSpaceError, 3)
  assert.equal(viewer.scene.globe.tileCacheSize, 200)
  assert.equal(tileset.maximumScreenSpaceError, 20)
  applyQuality(viewer, 'high', [tileset])
  assert.equal(viewer.resolutionScale, 1)
  assert.equal(viewer.scene.globe.maximumScreenSpaceError, 2)
  assert.equal(tileset.maximumScreenSpaceError, 16)
  // A null viewer must not throw (quality save can race a destroyed panel).
  assert.doesNotThrow(() => applyQuality(null, 'balanced'))
})

// ---------------------------------------------------------------------------
// Behaviour: host catalog persistence
// ---------------------------------------------------------------------------

test('normalizeConfig：quality 与 terrainDepthTest 会持久化，未知/缺省值有安全默认', () => {
  const defaults = normalizeConfig({})
  assert.equal(defaults.settings.quality, 'balanced')
  assert.equal(defaults.settings.terrainDepthTest, false)

  const high = normalizeConfig({ settings: { quality: 'high', terrainDepthTest: true } })
  assert.equal(high.settings.quality, 'high')
  assert.equal(high.settings.terrainDepthTest, true)

  const junk = normalizeConfig({ settings: { quality: 'ultra', terrainDepthTest: 'yes' } })
  assert.equal(junk.settings.quality, 'balanced')
  assert.equal(junk.settings.terrainDepthTest, false)

  // Round-trip: what the client wrote must come back identical (this is the bug
  // that made the depth-test switch reset on every settings save).
  const roundtrip = normalizeConfig(high)
  assert.equal(roundtrip.settings.quality, 'high')
  assert.equal(roundtrip.settings.terrainDepthTest, true)
})

test('normalizeConfig：新增字段不改变原有 settings 行为', () => {
  const legacy = normalizeConfig({ settings: { theme: 'dark' } })
  assert.equal(legacy.settings.theme, 'dark')
  assert.equal(legacy.settings.showLayers, true)
  assert.equal(legacy.settings.showHud, true)
  assert.equal(legacy.settings.screenshotHud, false)
})

// ---------------------------------------------------------------------------
// Wiring: the panel actually applies and exposes the tier
// ---------------------------------------------------------------------------

test('接线：viewer 创建时读取档位（msaaSamples 是创建期参数），随后立即 applyQuality', () => {
  const client = clientSource()
  assert.match(client, /msaaSamples: qualityProfile\(catalog\.config\.settings\?\.quality\)\.msaaSamples/)
  assert.match(client, /applyQuality\(viewer, catalog\.config\.settings\?\.quality\)/)
  assert.match(client, /import \{ applyQuality, normalizeQuality, qualityProfile \} from '\.\.\/scene\/quality\.js'/)
})

test('接线：加载 3D Tiles 时两条 fromUrl 路径都使用档位的瓦片 LOD', () => {
  const client = clientSource()
  assert.match(client, /maximumScreenSpaceError: qualityProfile\(sourcesRef\.current\?\.settings\?\.quality\)\.tilesetMaximumScreenSpaceError/)
  const fromUrlCalls = client.match(/\.fromUrl\([^\n]*tilesetOptions\)/g) ?? []
  assert.ok(fromUrlCalls.length >= 2, `两条 fromUrl 都应带 tilesetOptions，实际 ${fromUrlCalls.length}`)
})

test('接线：保存设置时档位变化会即时重应用（含已加载图层），并出现在 status.render', () => {
  const client = clientSource()
  assert.match(client, /normalizeQuality\(current\?\.settings\?\.quality\) !== normalizeQuality\(next\.settings\.quality\)/)
  assert.match(client, /applyQuality\(\s*viewerRef\.current,\s*next\.settings\.quality,\s*layersRef\.current\.map/)
  assert.match(client, /quality: normalizeQuality\(config\.settings\.quality\)/)
  assert.match(client, /resolution_scale: viewer\.resolutionScale/)
})

test('接线：截图始终使用满分辨率，结束后恢复当前档位', () => {
  const client = clientSource()
  // Balanced renders at 0.85; a capture must not inherit that softness.
  assert.match(client, /const previousResolutionScale = viewer\.resolutionScale/)
  assert.match(client, /viewer\.resolutionScale = 1/)
  assert.match(client, /viewer\.resolutionScale = previousResolutionScale/)
})

test('接线：设置面板提供质量下拉，双语文案齐全', () => {
  const client = clientSource()
  assert.match(client, /t\('settings\.quality'\)/)
  assert.match(client, /t\('settings\.qualityBalanced'\)/)
  assert.match(client, /t\('settings\.qualityHigh'\)/)
  for (const key of ['settings.quality', 'settings.qualityHint', 'settings.qualityBalanced', 'settings.qualityHigh']) {
    const zh = client.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.ok(zh.length >= 2, `locale 缺少 ${key}（中英各一条），实际 ${zh.length}`)
  }
})
