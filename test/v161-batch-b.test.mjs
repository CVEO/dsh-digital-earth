/**
 * v1.6.1 Batch B — UI regrouping, interaction safety, tokens and gates.
 *
 * Batch A pinned the destructive-action semantics; Batch B is the visible
 * re-grouping plus the shared interaction/a11y base and the new repository
 * gates. These assertions are the contract for what the user now sees:
 *   B1 toolbar 13 → 7 entries, data menu slimmed, layer-row overflow menu;
 *   B2 shared dialog a11y + announced toast + no blocking native dialogs;
 *   B3 host tokens only (no hardcoded theme palettes, every var defined);
 *   B4 remembered sizes clamp to the panel container, chart modal in-panel;
 *   B5 the three gates exist and are wired into `npm run check`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

import { clientSource, readRepoFile } from './helpers/source.mjs'

register('./helpers/react-stub-loader.mjs', import.meta.url)
const { LayerRow } = await import('../src/client/ui/layer-row.js')

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const client = clientSource()

function findAll(node, pred, out = []) {
  if (!node) return out
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, pred, out)
    return out
  }
  if (typeof node === 'object') {
    if (pred(node)) out.push(node)
    if (Array.isArray(node.children)) findAll(node.children, pred, out)
    else if (node.props?.children) findAll(node.props.children, pred, out)
  }
  return out
}

test('B1 工具栏收敛：数据/视图/输出三个菜单 + 图层·工具·结果 一个分段组', () => {
  const quick = readRepoFile('src/client/ui/toolbar-quick.js')
  // 三个域按钮：图层 / 工具 / 结果，画成同一段 .mv-quick。
  for (const key of ['layers', 'tools', 'result']) {
    assert.ok(quick.includes(`entry('${key}'`), `工具栏缺少 ${key} 入口`)
  }
  assert.ok(!quick.includes("entry('analysis'"), '分析并入工具与结果，不再单占工具栏')
  assert.ok(!quick.includes("entry('view'"), '视图是菜单，不是工具域按钮')
  assert.ok(!quick.includes("entry('select'"), '选择回归工具卡，不占用工具栏')
  assert.ok(!quick.includes('openToolCount'))

  // 顶层入口：数据 ▾ | 图层·工具·结果 | 视图 ▾ | 输出 ▾ | ⚙。
  const topbar = readRepoFile('src/client/ui/topbar.js')
  assert.ok(topbar.includes("className: 'mv-quick'"), '图层/工具/结果应合成一段 .mv-quick')
  assert.ok(topbar.includes('dataMenuItems('))
  assert.ok(topbar.includes('viewMenuItems('))
  assert.ok(topbar.includes('outputMenuItems('))
  assert.ok(topbar.includes('ToolbarSettings'))
  assert.equal((topbar.match(/\n\s+menu\(/g) ?? []).length, 3, '只有 数据/视图/输出 三个下拉菜单')
  for (const marker of ['t(\'btn.data\')', 't(\'btn.view\')', 't(\'btn.output\')']) {
    assert.ok(topbar.includes(marker), `顶层缺少 ${marker}`)
  }

  // 输出 = 带走什么：截图 / 报告 / 导出矢量 / 交给 Agent / 并排打开。
  const output = readRepoFile('src/client/ui/toolbar-output.js')
  for (const marker of ['onScreenshot', 'onReport', 'onExportVector', 'onAskAgent', 'onOpenBeside']) {
    assert.ok(output.includes(marker), `输出菜单缺少 ${marker}`)
  }
  assert.ok(!output.includes('onToggleHud'), 'HUD 属于视图，不留在输出菜单')
  assert.ok(!output.includes('onResetView'), '复位视角属于视图，不留在输出菜单')

  // 视图 = 怎么看：复位 / HUD / 全屏 / 书签 / 场景详情。
  const view = readRepoFile('src/client/ui/toolbar-view.js')
  for (const marker of ['onResetView', 'onToggleHud', 'onToggleFullscreen', 'onOpenBookmarks', 'onShowSceneDetails']) {
    assert.ok(view.includes(marker), `视图菜单缺少 ${marker}`)
  }
  assert.ok(!view.includes('onScreenshot'), '截图属于输出，不留在视图菜单')

  // 数据菜单只负责数据。
  const dataMenu = readRepoFile('src/client/ui/data-menu.js')
  assert.ok(!dataMenu.includes('menu.report'))
  assert.ok(!dataMenu.includes('tool.clear'))
  // 主题只有设置对话框一个入口。
  assert.ok(readRepoFile('src/client/ui/toolbar-settings.js').includes("t('btn.settings')"))
  assert.ok(!client.includes('ToolbarMenus'))
})

test('B1 图层行：整行不响应点击，✦ 是唯一外观入口，次要动作在溢出菜单', () => {
  const row = readRepoFile('src/client/ui/layer-row.js')
  assert.ok(!row.includes('onClick: openShader'), '整行点击不再打开特效工作台')
  assert.ok(row.includes('mv-row-menu'), '溢出菜单是行壳的通用能力')
  assert.ok(row.includes('mv-row-more'), '⋯ 是打开溢出菜单的唯一按钮')

  // 行壳是纯展示：根节点不挂 onClick，点名称才是「飞向」。
  const order = []
  const tree = LayerRow({
    t: (key) => key,
    id: 'layer-a',
    name: '倾斜摄影 A',
    menu: [
      { key: 'fly', label: 'btn.flyTo', onClick: () => order.push('fly') },
      { key: 'swipe', label: 'swipe.toggle', disabled: true, checked: true },
      { key: 'sep', sep: true },
      { key: 'remove', label: 'btn.delete', danger: true, onClick: () => order.push('remove') },
    ],
    menuOpen: true,
    onMenuToggle: (next) => order.push(`toggle:${next}`),
    onNameClick: () => order.push('name'),
  })
  assert.equal(tree.props.onClick, undefined, '整行不再响应点击')
  const more = findAll(tree, (node) => typeof node?.props?.className === 'string' && node.props.className.includes('mv-row-more'))[0]
  assert.ok(more, '缺少溢出菜单按钮')
  assert.equal(more.props['aria-haspopup'], 'menu')
  assert.equal(more.props['aria-expanded'], true)
  const items = findAll(tree, (node) => node?.type?.name === 'MenuItem')
  assert.equal(items.length, 3, '飞向 / 分屏 / 删除，分隔线不算菜单项')
  assert.equal(items[1].props.disabled, true, 'disabled 透传给菜单项')
  assert.equal(items[2].props.danger, true, '删除项是危险色')
  // 选中菜单项：先关菜单，再执行动作（行不再自己管菜单开合）。
  items[0].props.onClick()
  assert.deepEqual(order, ['toggle:null', 'fly'])

  // ✦ 外观入口住在三维内容行；3DGS 点云没有着色器，按钮禁用。
  const layers = readRepoFile('src/client/ui/layers-entities.js')
  assert.ok(layers.includes('mv-icon-btn mv-shader-edit'))
  assert.ok(layers.includes('disabled: is3dgs'))
  assert.ok(layers.includes("t('layers.appearance3dgs')"))
  // 每行的次要动作：飞向 / 属性… / 分屏（随可见性禁用）/ 删除。
  for (const action of ['onFlyLayer', 'onOpenLayerProperties', 'onSwipeLayer', 'onRemoveLayer']) {
    assert.ok(layers.includes(action), `溢出菜单缺少 ${action}`)
  }
  assert.ok(layers.includes('disabled: !layer.visible'), '隐藏的图层不能开分屏')
  // 单层体检不再是行内动作，而是「属性…」对话框里的入口。
  assert.ok(!layers.includes('onInspectLayer'))
  assert.ok(readRepoFile('src/client/ui/layer-properties.js').includes('onInspectLayer'))
})

test('B1 工具索引按域分组，目录顺序保持既有契约', () => {
  const catalog = readRepoFile('src/client/ui/tool-catalog.js')
  assert.ok(catalog.includes('export const TOOL_GROUPS'))
  assert.ok(catalog.includes('export function toolGroups'))
  const ids = [...catalog.matchAll(/id: '([a-z]+)'/g)].map((match) => match[1])
  assert.deepEqual(ids.slice(0, 8), ['measure', 'select', 'annotation', 'parse', 'analysis', 'compare', 'effects', 'view'])
  const panel = readRepoFile('src/client/ui/tools-panel.js')
  assert.ok(panel.includes('toolGroups()'))
  assert.ok(panel.includes('mv-tool-group-title'))
})

test('B2 共享对话框无障碍基线与 toast 公告', () => {
  const hook = readRepoFile('src/client/ui/use-dialog-a11y.js')
  assert.ok(hook.includes('export function useDialogA11y'))
  assert.ok(hook.includes("event.key === 'Escape'"))
  assert.ok(hook.includes("event.key !== 'Tab'"))
  assert.ok(hook.includes('restoreFocus'))
  // 确认框与设置/授权/健康/扫描对话框都走同一套焦点陷阱。
  for (const file of ['src/client/ui/confirm-dialog.js', 'src/client/ui/dialogs.js']) {
    assert.ok(readRepoFile(file).includes('useDialogA11y'), `${file} 未接入共享对话框钩子`)
  }
  // toast 对读屏可见。
  assert.match(client, /role: 'status', 'aria-live': 'polite'/)
})

test('B2 面板内不再使用阻塞式原生对话框', () => {
  for (const file of ['src/client/ui/dialogs.js', 'src/client/ui/confirm-dialog.js', 'src/client/viewer/ViewerSurface.js']) {
    const source = readRepoFile(file)
    assert.ok(!/window\.(confirm|alert|prompt)\s*\(/.test(source), `${file} 仍有阻塞式原生对话框`)
  }
  // 设置对话框的确认/提示改走面板能力。
  const dialogs = readRepoFile('src/client/ui/dialogs.js')
  assert.ok(dialogs.includes('askConfirm'))
  assert.ok(dialogs.includes('notify?.'))
  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.ok(surface.includes('askConfirm: confirm,'))
  assert.ok(surface.includes('notify: showToast,'))
})

test('B3 调色板来自宿主令牌：无硬编码主题块，引用的变量都有定义', () => {
  const css = readRepoFile('src/client/ui/css.js')
  assert.ok(!css.includes('[data-mv-theme="dark"]{--mv-bg'))
  assert.ok(!css.includes('[data-mv-theme="light"]{--mv-bg'))
  assert.ok(css.includes('[data-mv-scheme="dark"]'))
  for (const name of ['--mv-fg', '--mv-surface-hi', '--mv-line-strong']) {
    assert.ok(css.includes(`${name}:`), `根级缺少 ${name} 定义`)
  }
})

test('B4 窄面板：尺寸夹取相对容器，图表弹层在面板内', () => {
  const resizable = readRepoFile('src/client/ui/resizable.js')
  assert.ok(resizable.includes('function containerBounds'))
  assert.ok(resizable.includes('ResizeObserver'))
  assert.ok(resizable.includes('containerBounds(ref.current'))
  const css = readRepoFile('src/client/ui/css.js')
  const chart = css.slice(css.indexOf('.mv-chart-modal{'), css.indexOf('.mv-chart-modal{') + 60)
  assert.ok(chart.includes('position:absolute'), '纵断面图表应相对面板定位')
})

test('B5 工程门禁存在并接入 npm run check', () => {
  for (const gate of ['check-i18n.mjs', 'check-tokens.mjs', 'check-a11y.mjs']) {
    assert.ok(readFileSync(join(root, 'scripts', gate), 'utf8').length > 500, `${gate} 缺失或为空`)
    assert.ok(pkg.scripts.check.includes(gate), `${gate} 未接入 check`)
  }
  const messages = readRepoFile('src/client/messages.js')
  assert.ok(messages.includes(`version: '${pkg.version}'`), 'messages fallback follows package.json')
  assert.ok(readRepoFile('src/host/about.js').includes(`version: '${pkg.version}'`), 'about follows package.json')
  assert.ok(readRepoFile('README.md').includes('画面与输出'))
})
