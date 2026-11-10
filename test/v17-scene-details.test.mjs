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

test('场景详情是独立浮层：可从整场景或单个图层打开', () => {
  const details = readRepoFile('src/client/ui/scene-details.js')
  assert.match(details, /export function useSceneDetails/)
  assert.match(details, /focus\.layerId/)
  assert.match(details, /className: 'mv-scene-details mv-glass'/)
  assert.match(details, /sceneDetails\.scene/)
  assert.match(details, /sceneDetails\.analysis/)
  assert.match(details, /sceneDetails\.shader/)
  assert.match(details, /formatCount\(layer\.tiles\)/)
  assert.match(details, /formatBytes\(layer\.memory\)/)

  const panel = readRepoFile('src/client/ui/layers-panel.js')
  assert.doesNotMatch(panel, /className: 'mv-details'/)
  assert.doesNotMatch(panel, /t\('layers\.details'\)/)
  assert.match(panel, /onShowSceneDetails\?\.\(\)/)
  const row = readRepoFile('src/client/ui/layer-row.js')
  assert.match(row, /onShowSceneDetails\?\.\(layer\.id\)/)

  const client = clientSource()
  assert.match(client, /useSceneDetails\(\{/)
  assert.match(client, /sceneDetails\.element/)
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
  const capturing = css.match(/\.mv-root\.mv-capturing [^{]+\{visibility:hidden!important\}/)?.[0] ?? ''
  assert.ok(capturing.includes('.mv-scene-details'))
})
