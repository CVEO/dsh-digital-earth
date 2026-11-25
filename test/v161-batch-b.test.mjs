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
import { fileURLToPath } from 'node:url'

import { clientSource, readRepoFile } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const client = clientSource()

test('B1 工具栏收敛：6 个顶层入口，选择不再是工具栏开关', () => {
  const quick = readRepoFile('src/client/ui/toolbar-quick.js')
  // 三个域按钮：图层 / 工具 / 结果；数据、输出、设置各自一个入口。
  for (const key of ['layers', 'tools', 'result']) {
    assert.ok(quick.includes(`entry('${key}'`), `工具栏缺少 ${key} 入口`)
  }
  assert.ok(!quick.includes("entry('analysis'"), '分析并入工具与结果，不再单占工具栏')
  assert.ok(!quick.includes("entry('view'"), '视图并入工具与输出菜单')
  assert.ok(!quick.includes("entry('select'"), '选择回归工具卡，不占用工具栏')
  assert.ok(!quick.includes('openToolCount'))
  assert.ok(client.includes('dataMenuItems'))
  assert.ok(client.includes('outputMenuItems'))
  assert.ok(client.includes('ToolbarSettings'))
  const output = readRepoFile('src/client/ui/toolbar-output.js')
  for (const marker of ['onScreenshot', 'onReport', 'onToggleHud', 'onResetView', 'onToggleFullscreen', 'onAskAgent', 'onOpenBeside']) {
    assert.ok(output.includes(marker), `画面与输出菜单缺少 ${marker}`)
  }
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
  assert.ok(row.includes('mv-icon-btn mv-shader-edit'))
  assert.ok(row.includes('disabled: is3dgs'))
  assert.ok(row.includes("t('layers.appearance3dgs')"))
  assert.ok(row.includes('mv-row-menu'))
  for (const action of ['onFlyLayer', 'onInspectLayer', 'onSwipeLayer', 'onRemoveLayer']) {
    assert.ok(row.includes(action), `溢出菜单缺少 ${action}`)
  }
  const layers = readRepoFile('src/client/ui/layers-3d.js')
  assert.ok(layers.includes("event.key !== 'Escape'"))
  assert.ok(layers.includes('setRowMenu(null)'))
  assert.ok(layers.includes('.mv-row-menu'))
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
