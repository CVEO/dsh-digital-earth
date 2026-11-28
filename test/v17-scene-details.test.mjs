/**
 * Scene details as a dedicated surface.
 *
 * The layer panel is a long, narrow list; inlining camera telemetry and per-layer
 * counters made both harder to read. The panel now only has entry points: an ⓘ in
 * the header (whole scene) and an ⓘ on each 3D Tiles row (that layer only).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MESSAGES } from '../src/client/messages.js'
import { clientSource, readRepoFile } from './helpers/source.mjs'

test('场景详情是对象页签内容：整场景入口在场景卡头部与视图菜单', () => {
  const details = readRepoFile('src/client/ui/scene-details.js')
  assert.match(details, /export function useSceneDetails/)
  assert.match(details, /focus\.layerId/)
  assert.match(details, /mv-scene-details/)
  assert.match(details, /embedded \? ' in-dock' : ''/)
  assert.match(details, /isOpen: Boolean\(focus\)/)
  assert.match(details, /sceneDetails\.scene/)
  assert.match(details, /sceneDetails\.analysis/)
  assert.match(details, /sceneDetails\.shader/)
  assert.match(details, /formatCount\(layer\.tiles\)/)
  assert.match(details, /formatBytes\(layer\.memory\)/)

  const panel = readRepoFile('src/client/ui/layers-panel.js')
  assert.doesNotMatch(panel, /className: 'mv-details'/)
  assert.doesNotMatch(panel, /t\('layers\.details'\)/)
  // 整场景入口：卡片头部的 ⓘ（＋ 添加数据、✕ 收起，各司其职）。
  assert.match(panel, /onShowSceneDetails\?\.\(\)/)
  assert.match(panel, /t\('sceneDetails\.openHint'\)/)
  // 第二个入口：视图 ▾ 菜单里的「场景详情」。
  const view = readRepoFile('src/client/ui/toolbar-view.js')
  assert.match(view, /onShowSceneDetails/)
  assert.match(view, /t\('sceneDetails\.title'\)/)
  // 图层行不再有单独的场景详情入口：单层详情改由「属性…」对话框承担。
  const rows = readRepoFile('src/client/ui/layers-entities.js')
  assert.doesNotMatch(rows, /onShowSceneDetails/)
  assert.match(rows, /onOpenLayerProperties\?\.\(\{ kind: '3d', id: layer\.id \}\)/)

  const client = clientSource()
  assert.match(client, /useSceneDetails\(\{/)
  assert.match(client, /sceneDetails\.isOpen/)
  assert.match(client, /node: sceneDetails\.element/)
  assert.match(client, /onShowSceneDetails: sceneDetails\.open/)
})

test('工具栏与左上状态不再显示图层数字（避免误读为三维内容层数量）', () => {
  const client = clientSource()
  assert.doesNotMatch(client, /\$\{t\('btn\.layers'\)\}\$\{layers\.length/)
  assert.doesNotMatch(client, /t\('panel\.status\.layers'/)
})

test('i18n 与样式：场景详情中英齐全，截图时隐藏', () => {
  for (const key of [
    'sceneDetails.title',
    'sceneDetails.layerTitle',
    'sceneDetails.scene',
    'sceneDetails.layers',
    'sceneDetails.analysis',
    'sceneDetails.shader',
    'sceneDetails.openHint',
    'sceneDetails.openLayerHint',
  ]) {
    assert.equal(typeof MESSAGES.zh[key], 'string', `缺少 zh ${key}`)
    assert.equal(typeof MESSAGES.en[key], 'string', `缺少 en ${key}`)
  }
  const css = readRepoFile('src/client/ui/css.js')
  assert.match(css, /\.mv-scene-details\{/)
  assert.doesNotMatch(css, /mv-capturing/, '截图契约 A：位图来自 canvas，不靠隐藏 DOM')
})
