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
  assert.match(client, /className: 'mv-hud-heading'/)
  assert.match(client, /className: 'row mv-hud-layer'/)
  // FPS 占位语义不变（v1.5 契约）。
  assert.match(client, /fps === null \? '—' : fps/)
})

test('HUD 主行仍包含光标、高程、朝向三类读数（不缺功能）', () => {
  const hud = readRepoFile('src/client/ui/hud.js')
  for (const marker of ['mv-hud-cursor', 'mv-hud-camera', 'mv-hud-heading', 'labels.pointer', 'labels.camera', 'labels.heading']) {
    assert.ok(hud.includes(marker), `HUD 缺少 ${marker}`)
  }
})
