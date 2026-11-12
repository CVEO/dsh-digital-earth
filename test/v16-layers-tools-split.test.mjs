/**
 * v1.6 IA split — data layers and tools are separate surfaces.
 *
 * Meeting 116–140: the "三维" tab mixed vector overlays, analysis, sun and view
 * bookmarks with 3D Tiles; measure sat next to layers. This test locks the new
 * boundaries so the split cannot silently regress into one God component:
 *   - layer card = data only (3D tab: terrain + 3D Tiles/3DGS; map tab: vector,
 *     raster, folded imagery);
 *   - toolbox = an INDEX of tool entry points (ui/tool-catalog.js), the concrete
 *     panels live in ui/tool-windows.js and open through ui/tool-window.js;
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
const toolCatalog = () => readRepoFile('src/client/ui/tool-catalog.js')
const toolWindows = () => readRepoFile('src/client/ui/tool-windows.js')
const rightStack = () => readRepoFile('src/client/ui/right-stack.js')
const viewer = () => readRepoFile('src/client/viewer/ViewerSurface.js')

test('图层卡只做数据：3D=地形+3D Tiles/3DGS，地图=矢量+栅格+底图', () => {
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
  // Order is what the user asked for: vector overlays (L2) first, folded imagery (L4) last.
  const g2 = map.indexOf("key: 'g2'")
  const g3 = map.indexOf("key: 'g3'")
  const g4 = map.indexOf("key: 'g4'")
  assert.ok(g2 > 0 && g3 > g2 && g4 > g3, '地图 Tab 的组顺序必须是 L2 矢量 → L3 栅格 → L4 底图')
  // The basemap list is folded by default and remembers its fold state.
  assert.match(map, /readPanelFlag\(IMAGERY_OPEN_KEY/)
  assert.match(map, /writePanelFlag\(IMAGERY_OPEN_KEY/)
  assert.match(map, /mv-group-toggle/)
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

test('工具箱只做入口：目录表 + 一行一入口，具体控件在工具窗口里', () => {
  const catalog = toolCatalog()
  assert.match(catalog, /export const TOOL_ENTRIES/)
  for (const id of ['measure', 'select', 'analysis', 'effects', 'view']) {
    assert.match(catalog, new RegExp(`id: '${id}'`), `工具目录缺少 ${id}`)
  }
  assert.match(catalog, /export function nextOpenTool/)
  // Placeholder entries are forbidden: the catalog only lists panels that exist.
  assert.doesNotMatch(catalog, /disabled: true/, '工具目录不应列出不可用的入口')

  const tools = toolsPanel()
  assert.match(tools, /TOOL_ENTRIES\.map/)
  assert.match(tools, /h\(\s*ToolWindow,/)
  assert.match(tools, /h\(ToolBody, \{ entryId/)
  assert.match(tools, /mv-tool-entry/)
  // The index owns no tool controls: they moved to ui/tool-windows.js.
  for (const forbidden of ['MEASURE_TOOLS', 'SunTimeline', 'ToolsBookmarks', 'SelectionTool', "t('profile.draw')"]) {
    assert.ok(!tools.includes(forbidden), `工具箱入口不应内联 ${forbidden}`)
  }
  for (const forbidden of ['Layers3D', 'LayersMap', 'LayerRow', 'onOverlayAdd', 'onSelectTerrain', 'onToggleLayer']) {
    assert.doesNotMatch(tools, new RegExp(forbidden.replaceAll('.', '\\.')), `工具箱不应包含数据图层 ${forbidden}`)
  }

  // The window chrome: minimize to title bar, close, own height, no floating.
  const window = readRepoFile('src/client/ui/tool-window.js')
  for (const key of ['tools.windowMinimize', 'tools.windowExpand', 'tools.windowClose']) {
    assert.match(window, new RegExp(`t\\('${key.replaceAll('.', '\\.')}'\\)`), `工具窗口缺少 ${key}`)
  }
  assert.match(window, /usePanelResize/)
  assert.match(window, /storageKey: 'tool-window'/)
  assert.match(window, /minimized \? null : h\('div', \{ className: 'mv-toolwin-body' \}/)

  // The bodies keep every existing control so nothing was lost in the move.
  const bodies = toolWindows()
  assert.match(bodies, /MEASURE_TOOLS/)
  assert.match(bodies, /t\('profile\.draw'\)/)
  assert.match(bodies, /h\(SunTimeline,/)
  assert.match(bodies, /ToolsBookmarks/)
  assert.match(bodies, /SelectionTool/)
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
  // Measure lives in the toolbox; the toolbar is a plain 「工具」 toggle (no
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

test('AI 看图单一入口：只在顶部工具栏，工具箱里不再重复一个按钮', () => {
  const tools = toolsPanel()
  assert.doesNotMatch(tools, /askAgentLook|onAskAgent/, '工具箱不应再出现第二个问 AI 入口')
  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /sessionId \? iconButton\(h\(AskAgentIcon\), t\('btn\.askAgent'\), askAgent\) : null/)
  const ask = readRepoFile('src/client/scene/ask-agent.js')
  assert.match(ask, /read_image on that snapshot/)
  assert.match(ask, /Only draw with earth_draw when geographic anchors or verified geometry/)
  assert.match(ask, /screen pixels alone cannot recover a precise building footprint/)
  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['tools.askAgentLook', 'tools.askAgentLookHint']) {
    const hits = messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.equal(hits.length, 2, `缺少中英 ${key}`)
  }
})

test('工作台可缩放：右栏宽度 + 工具箱/窗口/图层/分析高度 + 着色器角手柄', () => {
  const read = (path) => readRepoFile(path)
  assert.match(read('src/client/ui/right-stack.js'), /usePanelResize/)
  assert.match(read('src/client/ui/right-stack.js'), /ResizeHandle/)
  for (const file of ['src/client/ui/tools-panel.js', 'src/client/ui/tool-window.js', 'src/client/ui/layers-panel.js', 'src/client/ui/cards.js']) {
    assert.match(read(file), /usePanelResize/)
    assert.match(read(file), /ResizeHandle/)
  }
  const cards = read('src/client/ui/cards.js')
  assert.match(cards, /storageKey: 'shader'/)
  assert.match(cards, /beginCorner/)
  const css = read('src/client/ui/css.js')
  for (const cls of ['.mv-resize-handle', '.mv-resize-width', '.mv-resize-height', '.mv-resize-corner']) {
    assert.ok(css.includes(cls), '缺少 ' + cls)
  }
  const messages = read('src/client/messages-v18.js')
  for (const key of ['resize.width', 'resize.height', 'resize.size']) {
    const hits = messages.match(new RegExp("'" + key.replaceAll('.', '\\.') + "':", 'g')) ?? []
    assert.equal(hits.length, 2, '缺少中英 ' + key)
  }
})
