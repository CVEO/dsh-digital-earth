/**
 * v1.6 S1-3 — the unified layer panel.
 *
 * The panel replaces the separate 底图 / 地形 menus and the inline 3D Tiles card
 * with one display-order stack (L1 terrain, L2 basemap, L3 raster overlays,
 * L4 vector, + 3D Tiles). These tests pin the form rules (pure), the four
 * sections, and the wiring: the panel only emits callbacks, ViewerSurface owns
 * the scene + persistence.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalizeOverlayDraft } from '../src/client/scene/overlay-layers.js'
import { clientSource } from './helpers/source.mjs'

// ---------------------------------------------------------------------------
// Behaviour: the inline "add overlay" form rules
// ---------------------------------------------------------------------------

test('叠加层表单：WMS 必须有地址与图层名，XYZ/ArcGIS 只要求地址', () => {
  assert.equal(normalizeOverlayDraft({ type: 'wms', url: 'https://e/wms' }), null, 'WMS 缺图层名应拒绝')
  const wms = normalizeOverlayDraft({ type: 'wms', url: ' https://e/wms ', layers: ' flood:risk ', name: ' 内涝 ' })
  assert.deepEqual(wms, { name: '内涝', type: 'wms', url: 'https://e/wms', layers: 'flood:risk', opacity: 1, visible: true })

  const xyz = normalizeOverlayDraft({ type: 'xyz', url: 'https://e/{z}/{x}/{y}.png' })
  assert.equal(xyz.layers, undefined)
  assert.equal(xyz.name, '叠加图层', '未填名称时给一个可用默认值')

  assert.equal(normalizeOverlayDraft({ type: 'mvt', url: 'https://e' }), null, '不支持的类型')
  assert.equal(normalizeOverlayDraft({ type: 'xyz', url: '   ' }), null, '空地址')
  assert.equal(normalizeOverlayDraft(null), null)
})

test('叠加层表单：透明度夹到 0..1，非数字回落 1', () => {
  assert.equal(normalizeOverlayDraft({ type: 'xyz', url: 'https://e', opacity: 0.4 }).opacity, 0.4)
  assert.equal(normalizeOverlayDraft({ type: 'xyz', url: 'https://e', opacity: 9 }).opacity, 1)
  assert.equal(normalizeOverlayDraft({ type: 'xyz', url: 'https://e', opacity: -3 }).opacity, 0)
  assert.equal(normalizeOverlayDraft({ type: 'xyz', url: 'https://e', opacity: 'abc' }).opacity, 1)
})

// ---------------------------------------------------------------------------
// Structure: one panel with the four display layers
// ---------------------------------------------------------------------------

test('面板结构：四层 + 三维内容层都有分区标题，且面板组件导出并渲染', () => {
  const client = clientSource()
  assert.match(client, /export function LayersPanel\(/, '缺少 LayersPanel 组件')
  for (const key of ['layers.terrain', 'layers.imagery', 'layers.raster', 'layers.vector', 'layers.content']) {
    assert.match(client, new RegExp(`t\\('${key.replaceAll('.', '\\.')}'\\)`), `面板缺少分区 ${key}`)
  }
  // 底图/地形选择、叠加层表单、矢量统计都在面板里。
  assert.match(client, /onSelectTerrain: changeTerrain/)
  assert.match(client, /onSelectImagery: changeImagery/)
  assert.match(client, /layers\.overlayAdd/)
  assert.match(client, /layers\.vectorDrawn/)
})

test('工具栏：底图/地形两个菜单已移除，图层按钮是唯一入口（无图层时也可打开）', () => {
  const client = clientSource()
  assert.doesNotMatch(client, /menu\(\s*'basemap'/, '底图菜单应移除')
  assert.doesNotMatch(client, /menu\(\s*'terrain'/, '地形菜单应移除')
  // 图层按钮必须常驻可用：面板同时承担地形/底图选择，所以激活态只看 showLayers。
  assert.doesNotMatch(client, /showLayers && layers\.length > 0/)
  assert.match(client, /t\('btn\.layersHide'\) : t\('btn\.layersShow'\)/)
})

// ---------------------------------------------------------------------------
// Wiring: panel actions persist the catalog and reconcile the live stack
// ---------------------------------------------------------------------------

test('接线：叠加层增删改查都先写回 catalog，再 sync 实时图层堆栈', () => {
  const client = clientSource()
  const persist = client.match(/persistOverlays\(/g) ?? []
  assert.ok(persist.length >= 5, `persistOverlays 应被增删改调用，实际 ${persist.length}`)
  for (const [prop, fn] of [
    ['onOverlayAdd', 'addOverlay'],
    ['onOverlayRemove', 'removeOverlay'],
    ['onOverlayOpacity', 'setOverlayOpacity'],
    ['onOverlayVisible', 'setOverlayVisible'],
    ['onOverlayMove', 'moveOverlay'],
  ]) {
    assert.match(client, new RegExp(`${prop}: ${fn}`), `LayersPanel 缺少回调 ${prop}`)
  }
  // 增删/换序走 sync；透明度/显隐直接作用于图层对象（避免重建 provider）。
  assert.match(client, /overlayLayersRef\.current\?\.sync\(next\)/)
  assert.match(client, /overlayLayersRef\.current\?\.setOpacity\(id, opacity\)/)
  assert.match(client, /overlayLayersRef\.current\?\.setVisible\(id, visible\)/)
})

test('接线：面板拿到矢量统计与清除动作，且 3D Tiles 行仍保留定位/显隐/体检/移除', () => {
  const client = clientSource()
  assert.match(client, /annotations: \{\s*drawn_features: agentOverlayRef\.current\.drawnFeatures/)
  assert.match(client, /onClearVector: \(\) => clearAgentOverlays\('all'\)/)
  for (const handler of ['onFlyLayer', 'onToggleLayer', 'onInspectLayer', 'onRemoveLayer']) {
    assert.match(client, new RegExp(`${handler}: `), `三维内容层缺少 ${handler}`)
  }
})
