import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./helpers/react-stub-loader.mjs', import.meta.url)
const { LayersEntities } = await import('../src/client/ui/layers-entities.js')
const { LayerRow } = await import('../src/client/ui/layer-row.js')
const { LayersPanel } = await import('../src/client/ui/layers-panel.js')
const ReactStub = (await import('./helpers/react-stub.mjs')).default

/**
 * The shared react stub returns a lazy `useState` initializer as the value itself
 * (`useState: (initial) => [initial, () => {}]`). The scene card defers both the
 * active tab and the per-group folds to callbacks, so run the initializers the
 * way React would before inspecting the returned tree. Patching the stub's own
 * object (the same module instance the client modules import) keeps the client
 * code untouched.
 */
function withLazyState(run) {
  const original = ReactStub.useState
  ReactStub.useState = (initial) => [typeof initial === 'function' ? initial() : initial, () => {}]
  try {
    return run()
  } finally {
    ReactStub.useState = original
  }
}

const findAll = (node, out = []) => {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, out)
    return out
  }
  out.push(node)
  if (node.children) findAll(node.children, out)
  return out
}

const isSceneRow = (node) => typeof node?.props?.className === 'string' && /^mv-layer(\s|$)/.test(node.props.className)

test('场景行：整行不再响应点击/回车；只有外观图标按钮打开外观工作台', () => {
  const edited = []
  const layer = { id: 'a', name: 'A', visible: true }
  const shader = { layerId: 'a', preset: 'scan' }
  const tree = LayersEntities({
    t: (key) => key,
    layers: [layer],
    shaderActive: [shader],
    agentOverlays: [],
    overlayDetails: {},
    overlayExtrusions: {},
    onEditLayerShader: (target, current) => edited.push({ target, current }),
    onToggleLayer() {},
    onRemoveLayer() {},
    onFlyLayer() {},
    onSwipeLayer() {},
    onOpenLayerProperties() {},
  })
  const contentRow = findAll(tree).find((node) => node?.props?.id === 'layer-a')
  assert.ok(contentRow, '三维内容分组应给出该图层的行定义')
  // 迁移阶段 0：删除整行点击开特效，避免误触；外观按钮才是入口（v1.9 起是
  // 16px stroke SVG，不再是 ✦ 字符）。
  const rendered = LayerRow(contentRow.props)
  const rows = findAll(rendered).filter(isSceneRow)
  assert.equal(rows.length, 1, '三维内容分组应渲染一条场景行')
  assert.equal(rows[0].props.onClick, undefined, '整行点击不再打开特效工作台')
  assert.equal(rows[0].props.onKeyDown, undefined)
  const editBtn = findAll(rendered).find(
    (node) => node?.type === 'button' && String(node?.props?.className ?? '').includes('mv-shader-edit'),
  )
  assert.ok(editBtn, '层行必须保留外观图标入口')
  const editIcon = editBtn.children?.[0]
  assert.equal(editIcon?.props?.kind, 'shader', '外观入口是 stroke 图标组件，不是 Unicode 字符')
  assert.equal(editIcon?.props?.size, 15)
  editBtn.props.onClick({ stopPropagation() {} })
  assert.equal(edited.length, 1)
  assert.equal(edited[0].target, layer, '外观按钮只打开自己那一层的外观')
  assert.equal(edited[0].current, shader, '外观按钮带上该层已应用的特效')
})

test('场景页签：面板关联、方向键和不同实例的标识互不冲突', () => {
  const props = { t: (key) => key, layers: [], config: {}, settings: {} }
  const { tabs, panel, buttons } = withLazyState(() => {
    const tree = LayersPanel(props)
    const tabs = tree.children.find((child) => child?.props?.role === 'tablist')
    const panel = tree.children.find((child) => child?.props?.role === 'tabpanel')
    return { tree, tabs, panel, buttons: tabs.children }
  })
  assert.equal(buttons.length, 2)
  assert.equal(buttons[0].props['data-tab'], '3d')
  assert.equal(buttons[1].props['data-tab'], 'surface')
  assert.equal(buttons[0].props['aria-controls'], panel.props.id)
  assert.equal(panel.props['aria-labelledby'], buttons[0].props.id, '默认页签必须标注当前面板')
  assert.equal(buttons[0].props['aria-selected'], true)
  assert.equal(buttons[1].props['aria-selected'], false)
  assert.equal(panel.props.className, 'mv-data-panel')
  assert.equal(buttons[0].props.tabIndex, 0)
  assert.equal(buttons[1].props.tabIndex, -1)
  let focusSelector = ''
  tabs.props.ref.current = { querySelector: (selector) => ({ focus() { focusSelector = selector } }) }
  tabs.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} })
  assert.equal(focusSelector, '[data-tab="surface"]')
  tabs.props.onKeyDown({ key: 'Home', preventDefault() {} })
  assert.equal(focusSelector, '[data-tab="3d"]')
  tabs.props.onKeyDown({ key: 'End', preventDefault() {} })
  assert.equal(focusSelector, '[data-tab="surface"]')
  const another = withLazyState(() => LayersPanel(props))
  const anotherPanel = another.children.find((child) => child?.props?.role === 'tabpanel')
  assert.notEqual(anotherPanel.props.id, panel.props.id)
  assert.notEqual(anotherPanel.props['aria-labelledby'], panel.props['aria-labelledby'])
})
