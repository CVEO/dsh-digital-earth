import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./helpers/react-stub-loader.mjs', import.meta.url)
const { LayerRow } = await import('../src/client/ui/layer-row.js')
const { LayersPanel } = await import('../src/client/ui/layers-panel.js')

test('图层行：子按钮的 Enter/Space 不触发父行特效编辑', () => {
  let edits = 0, prevented = 0
  const row = LayerRow({ t: (key) => key, layer: { id: 'a', name: 'A', visible: true }, shader: { preset: 'scan' }, onEditShader: () => edits++ })
  const target = {}, button = {}
  for (const key of ['Enter', ' ']) row.props.onKeyDown({ key, target: button, currentTarget: target, preventDefault: () => prevented++ })
  assert.equal(edits, 0)
  assert.equal(prevented, 0)
  row.props.onKeyDown({ key: 'Enter', target, currentTarget: target, preventDefault: () => prevented++ })
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
