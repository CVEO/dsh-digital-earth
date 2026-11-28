/**
 * v1.6.5 — one console header row.
 *
 * The dock used to repeat the destination name in a 30px title row of its own,
 * with the unread dot and a separate in-panel back button. That row is gone: the
 * header (TopBar) shows the destination, "工具 · 量测" for a tool detail, and the
 * unread dot sits on the 结果 destination. These tests pin the derivation and the
 * markup contract without a browser.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const { consoleHeader, openToolIds } = await import('../src/client/ui/console-header.js')
const { ToolbarQuick } = await import('../src/client/ui/toolbar-quick.js')
const { TopBar } = await import('../src/client/ui/topbar.js')
const { boundsHost } = await import('../src/client/ui/resizable.js')

const t = (key) => key
const kids = (node) => {
  const children = node?.props?.children
  return Array.isArray(children) ? children : [children]
}
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('顶栏标题：目的地名来自当前页签，收起时沿用最后一个', () => {
  assert.equal(consoleHeader({ t, activeTab: 'tools' }).panelLabel, 'tools.title')
  assert.equal(consoleHeader({ t, activeTab: null, lastTab: 'result' }).panelLabel, 'panel.tab.result')
  assert.equal(consoleHeader({ t, activeTab: null, lastTab: null }).panelLabel, 'layers.title')
  assert.equal(consoleHeader({ t, activeTab: 'unknown' }).panelLabel, 'dock.title')
})

test('工具详情：工具名只在工具体可见时追加，返回索引后只留目的地名', () => {
  const windows = [{ id: 'measure' }]
  const detail = consoleHeader({ t, activeTab: 'tools', windows, toolIndexShown: false })
  assert.equal(detail.toolId, 'measure')
  assert.ok(detail.panelDetail)
  assert.equal(detail.panelLabel, 'tools.title')

  const index = consoleHeader({ t, activeTab: 'tools', windows, toolIndexShown: true })
  assert.equal(index.panelDetail, null)

  // A tool window in another destination never leaks into the title.
  assert.equal(consoleHeader({ t, activeTab: 'layers', windows }).panelDetail, null)
})

test('工具窗口 id 兼容字符串与 {id}，最后一个即当前', () => {
  assert.deepEqual(openToolIds(['a', { id: 'b' }, null]), ['a', 'b'])
  assert.equal(consoleHeader({ t, activeTab: 'tools', windows: ['a', { id: 'b' }] }).toolId, 'b')
})

test('结果目的地承担未读点：aria-label 带上未读文案，非当前目的地才亮', () => {
  const base = { t, showLayers: false, showTools: false, showPlaces: false, showResult: false, onToggleLayers: () => {}, onToggleTools: () => {}, onTogglePlaces: () => {}, onOpenResult: () => {} }
  const unread = ToolbarQuick({ ...base, resultDisabled: false, resultUnread: true })
  const resultButton = kids(unread)[3]
  assert.ok(resultButton, '结果入口存在')
  assert.match(resultButton.props['aria-label'], /dock\.unread/)
  assert.ok(
    kids(resultButton).some((child) => child?.props?.className === 'mv-btn-dot'),
    '未读点应出现在结果目的地上',
  )

  const quiet = ToolbarQuick({ ...base, resultDisabled: false, resultUnread: false })
  assert.equal(kids(quiet).some((node) => kids(node).some((child) => child?.props?.className === 'mv-btn-dot')), false)

  // An empty result tab stays inert and never shows an unread dot.
  const disabled = ToolbarQuick({ ...base, resultDisabled: true, resultUnread: true })
  assert.equal(kids(disabled).some((node) => kids(node).some((child) => child?.props?.className === 'mv-btn-dot')), false)
})

test('顶栏结构：左标题 / 右动作，返回箭头只在详情时出现', () => {
  const props = {
    t,
    menuRef: { current: null },
    openMenu: null,
    setOpenMenu: () => {},
    data: { recentDirs: [], recentUrls: [] },
    view: { showHud: false },
    output: {},
    quick: { showLayers: false, showTools: true, showResult: false, onToggleLayers: () => {}, onToggleTools: () => {}, onOpenResult: () => {} },
    panelLabel: 'tools.title',
    onOpenSettings: () => {},
    onToggleChrome: () => {},
  }
  const index = TopBar({ ...props, panelDetail: null })
  const head = kids(index)[0]
  const actions = kids(index)[1]
  assert.equal(head.props.className, 'mv-top-head')
  assert.equal(actions.props.className, 'mv-actions')
  assert.ok(kids(head).some((node) => node?.props?.className === 'mv-top-title'), '标题在最左')
  assert.equal(kids(actions).filter((node) => node?.props?.className === 'mv-top-back').length, 0)

  let back = 0
  const detail = TopBar({ ...props, panelDetail: 'tools.measure', onBack: () => { back += 1 } })
  const detailKids = kids(kids(detail)[0])
  const button = detailKids.find((node) => node?.props?.className === 'mv-top-back')
  assert.ok(button, '详情页应有返回箭头')
  button.props.onClick()
  assert.equal(back, 1)
  const detailText = detailKids.find((node) => node?.props?.className === 'mv-top-detail')
  assert.match(String(kids(detailText)), /tools\.measure/)
})

test('菜单在左、面板组在中、设置与隐藏按钮在右，隐藏/显示按钮使用同一套定位变量', () => {
  const topbar = read('src/client/ui/topbar.js')
  const css = read('src/client/ui/css.js')
  const order = ["menu(\n        'data'", "menu('view'", "menu('output'", "className: 'mv-quick'", 'h(ToolbarSettings', 'mv-chrome-hide']
  let cursor = -1
  for (const marker of order) {
    const next = topbar.indexOf(marker)
    assert.ok(next > cursor, `顶栏顺序不对：${marker}`)
    cursor = next
  }
  assert.match(css, /\.mv-chrome\{[^}]*top:var\(--mv-console-top/)
  assert.match(css, /\.mv-chrome-reveal\{[^}]*top:calc\(var\(--mv-console-top/)
  assert.match(css, /\.mv-chrome-reveal\{[^}]*width:26px;height:26px/)
})

test('调宽边界按面板视口（mv-root）而不是贴内容的控制台外壳计算', () => {
  const root = { clientWidth: 900, clientHeight: 700 }
  const chrome = { clientWidth: 320, clientHeight: 400, parentElement: root, closest: (selector) => (selector === '.mv-root' ? root : null) }
  const handle = { closest: (selector) => (selector === '.mv-root' ? root : null), parentElement: chrome }
  assert.equal(boundsHost(handle), root, '拖拽时应按面板视口算最大宽度')
  // 非 DOM 环境回退到父节点，保证旧测试与 SSR 不崩。
  assert.equal(boundsHost({ closest: () => null, parentElement: chrome }), chrome)
  assert.equal(boundsHost(null), null)
})
