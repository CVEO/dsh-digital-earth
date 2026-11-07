/**
 * v1.7 P0 — the instrument pass: HUD budget, vignette/entrance motion, the
 * selection card wiring and the "scene details" home for technical telemetry.
 *
 * The visual spec is deliberately narrow: one accent colour, one task card, at
 * most six HUD numbers, and no "fake button" that looks available but is not.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clientSource, readRepoFile } from './helpers/source.mjs'
import { MESSAGES } from '../src/client/messages.js'

test('HUD ≤6 个常驻数字：FPS + 光标经纬/高程 + 相机高度，遥测移入场景详情', () => {
  const hud = readRepoFile('src/client/ui/hud.js')
  // One primary row with three value slots: fps, cursor (lon/lat/elevation), camera height.
  assert.equal((hud.match(/h\('b'/g) ?? []).length, 3)
  assert.equal((hud.match(/h\('span'/g) ?? []).length, 3)
  assert.match(hud, /Five numbers total/)
  assert.doesNotMatch(hud, /mv-hud-heading/)
  assert.doesNotMatch(hud, /mv-hud-layer/)
  assert.doesNotMatch(hud, /formatCount|formatBytes/)

  const panel = readRepoFile('src/client/ui/layers-panel.js')
  assert.match(panel, /t\('layers\.details'\)/)
  assert.match(panel, /t\('hud\.heading'\)/)
  assert.match(panel, /formatCount\(row\.tiles\)/)
  assert.match(panel, /formatBytes\(row\.memory\)/)
})

test('视觉包：四角压暗、卡片入场动效、截图时隐藏新浮层', () => {
  const css = readRepoFile('src/client/ui/css.js')
  assert.match(css, /\.mv-root::after\{content:"";position:absolute;inset:0;z-index:3;pointer-events:none;background:radial-gradient/)
  assert.match(css, /\.mv-root\[data-mv-theme="light"\]::after\{/)
  assert.match(css, /@keyframes mv-fade\{from\{opacity:0\}to\{opacity:1\}\}/)
  assert.match(css, /\.mv-select\{[^}]*animation:mv-fade \.2s cubic-bezier\(\.16,1,\.3,1\)/)
  // The card stays within the 340 px budget from the plan.
  assert.match(css, /\.mv-select\{[^}]*width:min\(340px/)
  // Corner brackets + height leader live in screen space.
  for (const marker of ['.mv-sel-anchor .c.tl', '.mv-sel-anchor .c.br', '.mv-sel-anchor .leader', '.mv-sel-anchor .chip']) {
    assert.ok(css.includes(marker), `缺少 ${marker}`)
  }
  // A capture must stay clean: every new floating element is hidden.
  const capturing = css.match(/\.mv-root\.mv-capturing [^{]+\{visibility:hidden!important\}/)?.[0] ?? ''
  for (const marker of ['.mv-select', '.mv-sel-anchor', '.mv-sel-hint', '.mv-tour']) {
    assert.ok(capturing.includes(marker), `截图应隐藏 ${marker}`)
  }
  assert.match(css, /\.mv-tour\{position:absolute/)
  assert.match(css, /\.mv-caption\{/)
  assert.match(css, /\.mv-details \.row\{/)
})

test('指认卡片接线：三个动作都真实可用（无假按钮）', () => {
  const overlay = readRepoFile('src/client/ui/selection-overlay.js')
  assert.match(overlay, /onClick: flyNear/)
  assert.match(overlay, /onClick: measure/)
  assert.match(overlay, /onClick: takeAway/)
  assert.match(overlay, /flyTo\(\{[\s\S]*?pitch: Cesium\.Math\.toRadians\(-35\)/)
  assert.match(overlay, /renderSnapshot\(\{ format: 'png' \}\)/)
  assert.match(overlay, /controller\.exportEvidence\(card, snapshot\)/)
  // Confidence is a red / amber / green high / medium / low chip; the card never
  // says "certain / likely / guessed".
  assert.match(overlay, /selection\.confidence\.high/)
  assert.match(overlay, /selection\.confidence\.medium/)
  assert.match(overlay, /selection\.confidence\.low/)
  assert.match(overlay, /mv-sel-conf \$\{tier\.tone\}/)
  assert.equal(MESSAGES.zh['selection.confidence.high'], '高置信度')
  assert.equal(MESSAGES.zh['selection.confidence.medium'], '中置信度')
  assert.equal(MESSAGES.zh['selection.confidence.low'], '低置信度')
  assert.doesNotMatch(JSON.stringify(MESSAGES.zh), /确定（来源数据）|很可能（几何估计）|我猜（视觉推断）/)
  const cssSource = readRepoFile('src/client/ui/css.js')
  assert.match(cssSource, /\.mv-sel-conf\.high\{color:#4ade80\}/)
  assert.match(cssSource, /\.mv-sel-conf\.medium\{color:#f0b84b\}/)
  assert.match(cssSource, /\.mv-sel-conf\.low\{color:#ff8b8b\}/)
  assert.doesNotMatch(cssSource, /mv-sel-dot/)

  const client = clientSource()
  assert.match(client, /iconButton\(h\(IdentifyIcon\), t\('btn\.identifyHint'\), \(\) => setToolMode\(tool === 'identify' \? null : 'identify'\), tool === 'identify'\)/)
  assert.match(client, /active: tool === 'identify'/)
  assert.match(client, /measureRef\.current\.points = \[anchor\]/)
  assert.match(client, /redrawMeasure\('height'\)/)
})

test('大气与相机节奏：地平线有大气，复位与框全使用自适应/更长时长', () => {
  const client = clientSource()
  assert.match(client, /viewer\.scene\.globe\.showGroundAtmosphere/)
  assert.match(client, /viewer\.scene\.skyAtmosphere\.show/)
  // Reset is the longest flight in the panel: 2.4 s, not the old 1.2 s yank.
  assert.match(client, /destination: Cesium\.Cartesian3\.fromDegrees\(104, 31, 14000000\),[\s\S]{0,220}duration: 2\.4/)
  // Layer fly + frame-all derive their duration from the actual distance.
  assert.match(client, /viewer\.flyTo\(layer\.tileset, \{ duration: flightDuration\(distance\) \}\)/)
  assert.match(client, /flyToBoundingSphere\(target, \{ duration: travel \}\)/)
})

test('不回归：v1.6 的 HUD/图层/着色器接线仍在，新增面板未挤占既有入口', () => {
  const client = clientSource()
  assert.match(client, /h\(StatusHud, \{ key: 'hud', fps, stats, viewerRef, cesiumRef, labels: hudLabels, readoutRef: captureReadoutRef \}\)/)
  assert.match(client, /h\(LayersPanel, \{/)
  assert.match(client, /shaderActive,/)
  assert.match(client, /className: 'mv-hud mv-glass'/)
  // The new card renders at the panel root, next to the existing analysis column.
  assert.match(client, /h\(SelectionOverlay, \{/)
  assert.match(client, /stats,\n\s*onStartTour: tour\.start,/)
})
