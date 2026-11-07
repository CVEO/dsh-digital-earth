/**
 * v1.7 P0 follow-up — HUD detail mode.
 *
 * The P0 instrument pass cut the HUD to five numbers. Users who want the old
 * telemetry get it back through an explicit, persisted switch (Settings →
 * Appearance, off by default) instead of the HUD growing back silently.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

import { MESSAGES } from '../src/client/messages.js'
import { clientSource, readRepoFile } from './helpers/source.mjs'

const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-hud-detailed-'))
process.env.DSH_HOME = home
const { normalizeConfig } = await import(new URL('../index.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

test('normalizeConfig：hudDetailed 默认关闭、显式 true 持久化、非法值回落 false', () => {
  assert.equal(normalizeConfig({}).settings.hudDetailed, false)
  assert.equal(normalizeConfig({ settings: {} }).settings.hudDetailed, false)
  assert.equal(normalizeConfig({ settings: { hudDetailed: true } }).settings.hudDetailed, true)
  assert.equal(normalizeConfig({ settings: { hudDetailed: 'yes' } }).settings.hudDetailed, false)
  // 往返：Host 保存后再读回来仍是同一个选择。
  const roundtrip = normalizeConfig(normalizeConfig({ settings: { hudDetailed: true } }))
  assert.equal(roundtrip.settings.hudDetailed, true)
})

test('HUD 默认 5 个数字，详细模式才渲染朝向与逐层统计', () => {
  const hud = readRepoFile('src/client/ui/hud.js')
  // primary row: FPS value + cursor value + camera height (3 <b>);
  // detailed: heading/pitch (1) and one layer row (name + 4 counters = 5).
  assert.equal((hud.match(/h\('b'/g) ?? []).length, 3 + 1 + 5)
  // 详细分支：朝向/俯仰 span 与逐层行；默认分支不渲染这些。
  assert.match(hud, /detailed[\s\S]*?mv-hud-heading/)
  assert.match(hud, /detailed[\s\S]*?mv-hud-layer/)
  assert.match(hud, /formatCount\(row\.tiles\)/)
  assert.match(hud, /formatBytes\(row\.memory\)/)
  assert.match(hud, /detailed = false/)

  const client = clientSource()
  assert.match(client, /const hudDetailed = sources\?\.settings\?\.hudDetailed === true/)
  assert.match(client, /detailed: hudDetailed/)
  assert.match(client, /heading: t\('hud\.heading'\)/)
  assert.match(client, /tiles: t\('hud\.tiles'\)/)
})

test('设置面板有「HUD 详细模式」开关，且写回 settings.hudDetailed', () => {
  const dialogs = readRepoFile('src/client/ui/dialogs.js')
  assert.match(dialogs, /t\('settings\.hudDetailed'\)/)
  assert.match(dialogs, /settings: \{ \.\.\.current\.settings, hudDetailed: event\.target\.checked \}/)
  assert.match(dialogs, /checked: draft\.settings\.hudDetailed === true/)

  for (const locale of ['zh', 'en']) {
    assert.equal(typeof MESSAGES[locale]['settings.hudDetailed'], 'string', `缺少 ${locale} 标题`)
    assert.equal(typeof MESSAGES[locale]['settings.hudDetailedHint'], 'string', `缺少 ${locale} 说明`)
  }
})

test('不受影响：默认 HUD 仍不渲染逐层行，窄面板规则继续隐藏次要遥测', () => {
  const css = readRepoFile('src/client/ui/css.js')
  for (const marker of [
    '.mv-root.mv-docked .mv-hud .mv-hud-heading',
    '.mv-root.mv-docked .mv-hud .mv-hud-layer{display:none}',
    '.mv-root.mv-docked .mv-hud .mv-hud-fps{display:none}',
  ]) {
    assert.ok(css.includes(marker), `缺少窄宽规则：${marker}`)
  }
})
