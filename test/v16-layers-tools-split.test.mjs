/**
 * v1.6 IA split — data layers and tools are separate surfaces.
 *
 * Meeting 116–140: the "三维" tab mixed vector overlays, analysis, sun and view
 * bookmarks with 3D Tiles; measure sat next to layers. This test locks the new
 * boundaries so the split cannot silently regress into one God component:
 *   - layer card = data only (3D tab: terrain + 3D Tiles/3DGS; map tab: imagery,
 *     raster, vector);
 *   - tools card = functions only (measure, profile/flood-entries, sun, effects,
 *     view bookmarks);
 *   - ViewerSurface composes through ui/right-stack.js, not hundreds of lines of
 *     inline card markup.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clientSource, readRepoFile } from './helpers/source.mjs'

const layerPanel = () => readRepoFile('src/client/ui/layers-panel.js')
const layers3d = () => readRepoFile('src/client/ui/layers-3d.js')
const layersMap = () => readRepoFile('src/client/ui/layers-map.js')
const toolsPanel = () => readRepoFile('src/client/ui/tools-panel.js')
const rightStack = () => readRepoFile('src/client/ui/right-stack.js')
const viewer = () => readRepoFile('src/client/viewer/ViewerSurface.js')

test('图层卡只做数据：3D=地形+3D Tiles/3DGS，地图=底图+栅格+矢量', () => {
  const shell = layerPanel()
  assert.match(shell, /import \{ Layers3D \}/)
  assert.match(shell, /import \{ LayersMap/)
  assert.match(shell, /useState\('3d'\)/)
  // The shell must not render tools or data groups itself.
  for (const forbidden of ['SunTimeline', 'loadBookmarks', 'AnalysisCard', 'profile.draw', 'tools.analysis', 'LayerRow']) {
    assert.doesNotMatch(shell, new RegExp(forbidden.replaceAll('.', '\\.')), `图层卡外壳不应包含 ${forbidden}`)
  }

  const three = layers3d()
  assert.match(three, /t\('layers\.terrain'\)/)
  assert.match(three, /t\('layers\.content'\)/)
  assert.match(three, /import \{ LayerRow \}/)
  for (const forbidden of [
    'SunTimeline',
    'ToolsBookmarks',
    "t('bookmarks.",
    "t('profile.",
    "t('layers.vector')",
    "t('layers.imagery')",
    "t('layers.raster')",
  ]) {
    assert.ok(!three.includes(forbidden), `三维数据 Tab 不应包含 ${forbidden}`)
  }

  const map = layersMap()
  assert.match(map, /t\('layers\.imagery'\)/)
  assert.match(map, /t\('layers\.raster'\)/)
  assert.match(map, /t\('layers\.vector'\)/)
  for (const forbidden of [
    'Layers3D',
    'LayerRow',
    "t('layers.terrain')",
    "t('layers.content')",
    'SunTimeline',
    "t('profile.",
  ]) {
    assert.ok(!map.includes(forbidden), `地图数据 Tab 不应包含 ${forbidden}`)
  }
})

test('工具卡只做功能：量测/分析/日照/视觉特效/视角，不出现数据图层控件', () => {
  const tools = toolsPanel()
  for (const key of ['tools.measure', 'tools.analysis', 'tools.sun', 'tools.effects', 'tools.view']) {
    assert.match(tools, new RegExp(`t\\('${key.replaceAll('.', '\\.')}'\\)`), `工具卡缺少 ${key}`)
  }
  assert.match(tools, /MEASURE_TOOLS/)
  assert.match(tools, /t\('profile\.draw'\)/)
  assert.match(tools, /h\(SunTimeline,/)
  assert.match(tools, /ToolsBookmarks/)
  for (const forbidden of ['Layers3D', 'LayersMap', 'LayerRow', 'onOverlayAdd', 'onSelectTerrain', 'onToggleLayer']) {
    assert.doesNotMatch(tools, new RegExp(forbidden.replaceAll('.', '\\.')), `工具卡不应包含数据图层 ${forbidden}`)
  }
})

test('右栈组合三张卡，ViewerSurface 不再内联图层/分析卡标记', () => {
  const stack = rightStack()
  assert.match(stack, /import \{ AnalysisCard \}/)
  assert.match(stack, /import \{ LayersPanel \}/)
  assert.match(stack, /import \{ ToolsPanel \}/)
  assert.match(stack, /className: 'mv-right'/)

  const surface = viewer()
  assert.match(surface, /import \{ RightStack \}/)
  assert.match(surface, /h\(RightStack, \{/)
  assert.doesNotMatch(surface, /import \{ LayersPanel \}/, 'ViewerSurface 不应直接 import 图层卡')
  assert.doesNotMatch(surface, /h\(AnalysisCard, \{/, 'ViewerSurface 不应内联分析卡')
})

test('工具卡入口与 i18n：工具栏单一「工具」入口，中英文案齐全', () => {
  const client = clientSource()
  assert.match(client, /h\(ToolbarQuick, \{/)
  assert.match(client, /onToggleTools: \(\) => setShowTools/)
  assert.match(client, /showTools,/)
  assert.match(client, /const \[showTools, setShowTools\] = React\.useState\(true\)/)
  // Measure lives in the Tools card; the toolbar is a plain 「工具」 toggle (no
  // dropdown/arrow), opening the right-hand workbench directly.
  const quick = readRepoFile('src/client/ui/toolbar-quick.js')
  assert.match(quick, /t\('btn\.tools'\)/)
  assert.doesNotMatch(quick, /MenuItem|menu\(/)
  assert.doesNotMatch(client, /menu\(\s*'measure'/)

  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['btn.tools', 'tools.title', 'tools.measure', 'tools.analysis', 'tools.sun', 'tools.effects', 'tools.view']) {
    const hits = messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.equal(hits.length, 2, `缺少中英 ${key}`)
  }
})

test('工具栏外观/设置菜单独立：ViewerSurface 不再内联主题下拉', () => {
  const menus = readRepoFile('src/client/ui/toolbar-menus.js')
  assert.match(menus, /ThemeIcon/)
  assert.match(menus, /theme\.auto/)
  assert.match(menus, /btn\.settings/)
  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /ToolbarMenus/)
  assert.doesNotMatch(surface, /ThemeIcon/)
})

test('AI 圈选入口：工具卡注入截图，Agent 读图后用 earth_draw 落图（无新工具）', () => {
  const tools = readRepoFile('src/client/ui/tools-panel.js')
  assert.match(tools, /onAskAgent/)
  assert.match(tools, /tools\.askAgentLook/)
  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /onAskAgent: askAgent/)
  const ask = readRepoFile('src/client/scene/ask-agent.js')
  assert.match(ask, /read_image on that snapshot/)
  assert.match(ask, /draw the result with earth_draw/)
  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['tools.askAgentLook', 'tools.askAgentLookHint']) {
    const hits = messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.equal(hits.length, 2, `缺少中英 ${key}`)
  }
})
