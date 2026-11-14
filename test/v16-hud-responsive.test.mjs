/**
 * Narrow-window HUD: the readout must stay a readable single-line instrument, not
 * collapse into a vertical column of single characters (the docked 632px case).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clientSource, readRepoFile } from './helpers/source.mjs'

test('HUD 基础样式：不再预留 330px、文本禁止换行、行内 flex 不折行', () => {
  const css = readRepoFile('src/client/ui/css.js')
  assert.match(css, /\.mv-hud\{[^}]*max-width:min\(640px,calc\(100% - 20px\)\)/)
  assert.match(css, /\.mv-hud\{[^}]*white-space:nowrap/)
  assert.match(css, /\.mv-hud\{[^}]*pointer-events:none/)
  assert.doesNotMatch(css, /max-width:calc\(100% - 330px\)/)
  assert.match(css, /\.mv-hud \.row\{[^}]*flex-wrap:nowrap/)
  assert.match(css, /\.mv-hud \.row\{[^}]*align-items:baseline/)
  assert.match(css, /\.mv-hud \.row>span\{flex:none;white-space:nowrap\}/)
  assert.match(css, /\.mv-hud b\{[^}]*tabular-nums[^}]*white-space:nowrap/)
})

test('窄面板：优先保留光标/高程主读数，隐藏次要遥测', () => {
  const css = readRepoFile('src/client/ui/css.js')
  // Docked container queries (the sidebar tab) and viewport fallback.
  for (const marker of [
    '@container (max-width: 560px)',
    '.mv-root.mv-docked .mv-hud .mv-hud-camera',
    '.mv-root.mv-docked .mv-hud .mv-hud-heading',
    '.mv-root.mv-docked .mv-hud .mv-hud-layer{display:none}',
    '@container (max-width: 420px)',
    '.mv-root.mv-docked .mv-hud .mv-hud-fps{display:none}',
    '@media (max-width: 760px)',
    '.mv-hud .mv-hud-camera,.mv-hud .mv-hud-heading,.mv-hud .mv-hud-layer{display:none}',
    '@media (max-width: 480px)',
    '.mv-hud .mv-hud-fps{display:none}',
  ]) {
    assert.ok(css.includes(marker), `缺少窄宽规则：${marker}`)
  }
  // 主读数行仍是第一行，且带稳定 class 供窄宽隐藏。
  const client = clientSource()
  assert.match(client, /className: 'row mv-hud-primary'/)
  assert.match(client, /className: 'mv-hud-camera'/)
  assert.match(client, /className: 'mv-hud-fps'/)
  // v1.7 P0：默认 HUD 5 个数字；详细模式（设置开关，默认关）才恢复朝向/逐层统计。
  assert.match(client, /className: 'mv-hud-heading'/)
  assert.match(client, /className: 'row mv-hud-layer'/)
  assert.match(client, /detailed: hudDetailed/)
  const details = readRepoFile('src/client/ui/scene-details.js')
  assert.match(details, /className: [`']mv-scene-details/)
  assert.match(details, /t\('hud\.heading'\)/)
  assert.match(details, /t\('sceneDetails\.layers'\)/)
  const panel = readRepoFile('src/client/ui/layers-panel.js')
  assert.doesNotMatch(panel, /className: 'mv-details'/)
  // FPS 占位语义不变（v1.5 契约）。
  assert.match(client, /fps === null \? '—' : fps/)
})

test('HUD 主行默认只保留光标与高程读数，详细模式才加回朝向/图层统计', () => {
  const hud = readRepoFile('src/client/ui/hud.js')
  for (const marker of ['mv-hud-cursor', 'mv-hud-camera', 'labels.pointer', 'labels.camera', 'mv-hud-primary']) {
    assert.ok(hud.includes(marker), `HUD 缺少 ${marker}`)
  }
  assert.match(hud, /detailed = false/, '详细模式必须默认关闭')
  assert.match(hud, /detailed\s*\?\s*h\('span', \{ className: 'mv-hud-heading' \}/)
  assert.match(hud, /detailed\s*\?\s*\(stats\.layers \?\? \[\]\)\.map/)
})
