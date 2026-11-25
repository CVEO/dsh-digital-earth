import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./helpers/react-stub-loader.mjs', import.meta.url)
const { LayerRow } = await import('../src/client/ui/layer-row.js')
const { LayersPanel } = await import('../src/client/ui/layers-panel.js')

test('图层行：整行不再响应点击/回车；只有 ✦ 外观按钮打开工作台', () => {
  let edits = 0
  const row = LayerRow({ t: (key) => key, layer: { id: 'a', name: 'A', visible: true }, shader: { preset: 'scan' }, onEditShader: () => edits++ })
  // 迁移阶段 0：删除整行点击开特效，避免误触；✦ 才是外观入口。
  assert.equal(row.props.onClick, undefined, '整行点击不再打开特效工作台')
  assert.equal(row.props.onKeyDown, undefined)
  const buttons = (row.children ?? []).filter((child) => child?.type === 'button')
  const editBtn = buttons.find((btn) => (btn.children ?? []).includes('✦'))
  assert.ok(editBtn, '层行必须保留 ✦ 外观入口')
  editBtn.props.onClick({ stopPropagation() {} })
  assert.equal(edits, 1)
})

test('图层页签：面板关联、方向键和不同实例的标识互不冲突', () => {
  const props = { t: (key) => key, layers: [], config: {}, settings: {} }
  const tree = LayersPanel(props)
  const tabs = tree.children.find((child) => child?.props?.role === 'tablist')
  const panel = tree.children.find((child) => child?.props?.role === 'tabpanel')
  const buttons = tabs.children
  assert.equal(buttons[0].props['aria-controls'], panel.props.id)
  assert.equal(panel.props['aria-labelledby'], buttons[0].props.id)
  assert.equal(buttons[1].props.tabIndex, -1)
  let focusSelector = ''
  tabs.props.ref.current = { querySelector: (selector) => ({ focus() { focusSelector = selector } }) }
  tabs.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} })
  assert.equal(focusSelector, '[data-tab="map"]')
  const another = LayersPanel(props)
  assert.notEqual(another.children.find((child) => child?.props?.role === 'tabpanel').props.id, panel.props.id)
})
