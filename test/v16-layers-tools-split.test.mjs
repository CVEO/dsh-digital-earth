/**
 * v1.6 IA split — data layers and tools are separate surfaces (v1.8 names).
 *
 * Meeting 116–140: the "三维" tab mixed vector overlays, analysis, sun and view
 * bookmarks with 3D Tiles; measure sat next to layers. This test locks the new
 * boundaries so the split cannot silently regress into one God component:
 *   - scene card = data only (三维 tab: annotations / measurements / 3D content;
 *     地表 tab: vector, raster, folded imagery, terrain);
 *   - toolbox = an INDEX of tool entry points (ui/tool-catalog.js), the concrete
 *     panels live in ui/tool-windows.js and open through ui/tool-window.js;
 *   - ViewerSurface composes through ui/right-stack.js, not hundreds of lines of
 *     inline card markup.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clientSource, readRepoFile } from './helpers/source.mjs'

const layerPanel = () => readRepoFile('src/client/ui/layers-panel.js')
const layersEntities = () => readRepoFile('src/client/ui/layers-entities.js')
const layersSurface = () => readRepoFile('src/client/ui/layers-surface.js')
const layerGroup = () => readRepoFile('src/client/ui/layer-group.js')
const addLayerDialog = () => readRepoFile('src/client/ui/add-layer-dialog.js')
const toolsPanel = () => readRepoFile('src/client/ui/tools-panel.js')
const toolCatalog = () => readRepoFile('src/client/ui/tool-catalog.js')
const toolWindows = () => readRepoFile('src/client/ui/tool-windows.js')
const rightStack = () => readRepoFile('src/client/ui/right-stack.js')
const viewer = () => readRepoFile('src/client/viewer/ViewerSurface.js')

test('场景卡只做数据：三维=标注+量测+3D Tiles/3DGS，地表=矢量+栅格+影像+地形', () => {
  const shell = layerPanel()
  assert.match(shell, /import \{[^}]*LayersEntities[^}]*\} from '\.\/layers-entities\.js'/)
  assert.match(shell, /import \{[^}]*LayersSurface[^}]*\} from '\.\/layers-surface\.js'/)
  // 3D 数据优先：没有用户偏好时默认三维页签，地表是备选。
  assert.match(shell, /readPanelFlag\(TAB_KEY, false\) \? 'surface' : '3d'/)
  assert.match(shell, /className: 'mv-data-panel'/)
  assert.match(shell, /t\('layers\.title'\)/)
  // The shell must not render tools or data groups itself.
  for (const forbidden of ['SunTimeline', 'loadBookmarks', 'AnalysisCard', 'profile.draw', 'tools.analysis', 'LayerRow', 'LayerGroup']) {
    assert.doesNotMatch(shell, new RegExp(forbidden.replaceAll('.', '\\.')), `场景卡外壳不应包含 ${forbidden}`)
  }

  const entities = layersEntities()
  assert.match(entities, /t\('layers\.annotations'\)/)
  assert.match(entities, /t\('layers\.measurements'\)/)
  assert.match(entities, /t\('layers\.content'\)/)
  assert.match(entities, /import \{[^}]*LayerRow[^}]*\} from '\.\/layer-row\.js'/)
  // Group order is what the user asked for: 标注 → 量测 → 三维内容.
  const ga = entities.indexOf("id: 'annotations'")
  const gm = entities.indexOf("id: 'measurements'")
  const gc = entities.indexOf("id: 'content'")
  assert.ok(ga > 0 && gm > ga && gc > gm, '三维页签分组顺序必须是 标注 → 量测 → 三维内容')
  for (const forbidden of [
    'SunTimeline',
    'ToolsBookmarks',
    "t('bookmarks.",
    "t('profile.",
    "t('layers.vector')",
    "t('layers.imagery')",
    "t('layers.raster')",
    "t('layers.terrain')",
  ]) {
    assert.ok(!entities.includes(forbidden), `三维数据 Tab 不应包含 ${forbidden}`)
  }

  const surface = layersSurface()
  assert.match(surface, /t\('layers\.vector'\)/)
  assert.match(surface, /t\('layers\.raster'\)/)
  assert.match(surface, /t\('layers\.imagery'\)/)
  assert.match(surface, /t\('layers\.terrain'\)/)
  // Order is what the user asked for: 矢量 → 栅格 → 影像底图 → 地形.
  const gv = surface.indexOf("id: 'vector'")
  const gr = surface.indexOf("id: 'raster'")
  const gi = surface.indexOf("id: 'imagery'")
  const gt = surface.indexOf("id: 'terrain'")
  assert.ok(gv > 0 && gr > gv && gi > gr && gt > gi, '地表页签的分组顺序必须是 矢量 → 栅格 → 影像底图 → 地形')
  // The basemap list is folded by default and remembers its fold state; while
  // folded the active source stays visible as a one-line summary.
  assert.match(surface, /useGroupOpen\('imagery', false\)/)
  assert.match(surface, /t\('layers\.imageryCurrent'\)/)
  assert.match(layerGroup(), /groupOpenKey\(id\)/)
  // One shared group header owns the toggle/chevron for both tabs.
  assert.match(layerGroup(), /mv-group-toggle/)
  assert.match(layerGroup(), /aria-expanded/)
  // No inline raster form anymore: adding data goes through AddLayerDialog.
  assert.ok(!surface.includes('normalizeOverlayDraft'), '地表 Tab 不应再内联叠加层表单')
  assert.match(addLayerDialog(), /normalizeOverlayDraft/)
  for (const forbidden of [
    'LayersEntities',
    'SunTimeline',
    "t('profile.",
    "t('layers.content')",
    "t('layers.annotations')",
    "t('layers.measurements')",
  ]) {
    assert.ok(!surface.includes(forbidden), `地表数据 Tab 不应包含 ${forbidden}`)
  }
})

test('工具箱只做入口：目录表 + 一行一入口，具体控件在工具窗口里', () => {
  const catalog = toolCatalog()
  assert.match(catalog, /export const TOOL_ENTRIES/)
  for (const id of ['measure', 'select', 'annotation', 'parse', 'analysis', 'effects', 'view']) {
    assert.match(catalog, new RegExp(`id: '${id}'`), `工具目录缺少 ${id}`)
  }
  assert.match(catalog, /export function nextOpenTool/)
  // Placeholder entries are forbidden: the catalog only lists panels that exist.
  assert.doesNotMatch(catalog, /disabled: true/, '工具目录不应列出不可用的入口')

  const tools = toolsPanel()
  assert.ok(tools.includes('toolGroups()'))

  assert.match(tools, /mv-tool-entry/)
  assert.match(tools, /useFloatingWindow/)
  // The index owns no tool controls: they moved to ui/tool-windows.js and render in RightStack.
  for (const forbidden of ['MEASURE_TOOLS', 'SunTimeline', 'ToolsBookmarks', 'SelectionTool', "t('profile.draw')"]) {
    assert.ok(!tools.includes(forbidden), `工具箱入口不应内联 ${forbidden}`)
  }
  for (const forbidden of ['LayersEntities', 'LayersSurface', 'LayerRow', 'onOverlayAdd', 'onSelectTerrain', 'onToggleLayer']) {
    assert.doesNotMatch(tools, new RegExp(forbidden.replaceAll('.', '\\.')), `工具箱不应包含数据图层 ${forbidden}`)
  }

  // The window chrome: minimize to title bar, close, own height + free 2D drag.
  const window = readRepoFile('src/client/ui/tool-window.js')
  for (const key of ['tools.windowMinimize', 'tools.windowExpand', 'tools.windowClose']) {
    assert.match(window, new RegExp(`t\\('${key.replaceAll('.', '\\.')}'\\)`), `工具窗口缺少 ${key}`)
  }
  assert.match(window, /usePanelResize/)
  assert.match(window, /useFloatingWindow/)
  assert.match(window, /storageKey: 'tool-window'/)
  // v1.6.2 Batch D：停靠态忽略最小化（页签本身就是唯一可见面板），
  // 浮动窗口仍可最小化到标题栏。
  assert.match(window, /minimized && !embedded \? null : h\('div', \{ className: 'mv-toolwin-body' \}/)
  assert.match(window, /embedded = false/)
  assert.match(window, /forceFloat = false/)

  const stack = rightStack()
  assert.match(stack, /h\(\s*ToolWindow,/)
  assert.match(stack, /h\(ToolBody, \{/)

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
  const rail = readRepoFile('src/client/ui/panel-rail.js')
  assert.match(rail, /className: `mv-right mv-dock mv-glass/)
  assert.match(rail, /ResizeHandle/)

  const surface = viewer()
  assert.match(surface, /import \{ RightStack \}/)
  assert.match(surface, /h\(RightStack, \{/)
  assert.doesNotMatch(surface, /import \{ LayersPanel \}/, 'ViewerSurface 不应直接 import 图层卡')
  assert.doesNotMatch(surface, /h\(AnalysisCard, \{/, 'ViewerSurface 不应内联分析卡')
})

test('工具卡入口与 i18n：工具栏单一「工具」入口，中英文案齐全', () => {
  const client = clientSource()
  assert.match(client, /h\(ToolbarQuick, \{/)
  // v1.6.2：工具入口聚焦「工具」页签；右栏决定切页签/收起。
  assert.match(client, /onToggleTools: \(\) => \{\s*if \(!showTools\) setShowTools\(true\)\s*requestDock\('tools'\)/)
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

test('工具栏只保留设置入口：主题并入设置对话框外观页', () => {
  const settings = readRepoFile('src/client/ui/toolbar-settings.js')
  assert.ok(settings.includes("t('btn.settings')"))
  assert.ok(settings.includes('setSettingsOpen'))
  // v1.8: the top strip is one TopBar component; ViewerSurface no longer assembles
  // the gear/menus inline, so the single settings entry must live in TopBar.
  const topbar = readRepoFile('src/client/ui/topbar.js')
  assert.ok(topbar.includes('ToolbarSettings'))
  assert.match(topbar, /h\(ToolbarSettings, \{[^}]*setSettingsOpen: onOpenSettings[^}]*\}\)/)
  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.ok(surface.includes('h(TopBar, {'))
  assert.ok(!surface.includes('ThemeIcon'))
  assert.ok(!surface.includes('ToolbarMenus'))
  // 主题选择器仍在设置对话框的外观页：单一入口不丢能力。
  const dialogs = readRepoFile('src/client/ui/dialogs.js')
  assert.ok(dialogs.includes("['auto', 'theme.auto']"))
  // 工具栏没有第二个主题入口。
  for (const menu of ['src/client/ui/data-menu.js', 'src/client/ui/toolbar-view.js', 'src/client/ui/toolbar-output.js']) {
    assert.ok(!readRepoFile(menu).includes('theme'), `${menu} 不应再带主题入口`)
  }
})

test('AI 看图单一入口：只在顶部工具栏，工具箱里不再重复一个按钮', () => {
  const tools = toolsPanel()
  assert.doesNotMatch(tools, /askAgentLook|onAskAgent/, '工具箱不应再出现第二个问 AI 入口')
  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.ok(surface.includes('onAskAgent: askAgent,'), '问 Agent 移到「画面与输出」菜单')
  assert.ok(readRepoFile('src/client/ui/toolbar-output.js').includes("t('btn.askAgent')"))

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
  assert.match(read('src/client/ui/panel-rail.js'), /usePanelResize/)
  assert.match(read('src/client/ui/panel-rail.js'), /ResizeHandle/)
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
