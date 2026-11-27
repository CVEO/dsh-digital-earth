/**
 * v1.6 Batch 6 — toolbox as an entry index.
 *
 * Requirements #5/#8/#9: the toolbox is now a list of entry points, the basemap
 * list folds, and vector overlays sit above imagery. These tests pin the pure
 * behaviour (catalog navigation, panel prefs, basemap summary) plus the bilingual
 * copy, so the UI wiring can change without breaking the rules.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const catalog = await import('../src/client/ui/tool-catalog.js')
const prefs = await import('../src/client/ui/panel-prefs.js')
const surface = await import('../src/client/ui/layers-surface.js')
const group = await import('../src/client/ui/layer-group.js')
const React = (await import('react')).default
const { MESSAGES } = await import('../src/client/messages.js')
const { ANNOTATION_MESSAGES } = await import('../src/client/messages-annotations.js')

// The scene card is a React component now; render it with hook stubs that honour
// the `useState(initialiser)` contract so `useGroupOpen` resolves its fallback.
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

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object') {
    if (Array.isArray(node.children)) return textOf(node.children)
    return textOf(node.props?.children)
  }
  return ''
}

function renderSurface(config, settings) {
  const prev = React.useState
  React.useState = (init) => [typeof init === 'function' ? init() : init, () => {}]
  try {
    return surface.LayersSurface({ t: (key) => `<${key}>`, config, settings })
  } finally {
    React.useState = prev
  }
}

function imageryHint(config, settings) {
  // `layers-surface.js` renders one LayerGroup per data kind; the imagery group
  // carries the collapsed-header summary as its `hint` prop.
  const imageryGroup = findAll(renderSurface(config, settings), (node) => node?.props?.id === 'imagery')[0]
  assert.ok(imageryGroup, '地表页缺少「影像底图」分组')
  const tree = group.LayerGroup(imageryGroup.props)
  const hint = findAll(tree, (node) => node?.props?.className === 'mv-note mv-lgroup-hint')[0]
  return hint ? textOf(hint) : null
}

test('工具目录：八个入口，顺序稳定、字段齐全、未知 id 不伪造', () => {
  assert.deepEqual(catalog.TOOL_IDS, ['measure', 'select', 'annotation', 'parse', 'analysis', 'compare', 'effects', 'view'])
  assert.equal(new Set(catalog.TOOL_IDS).size, catalog.TOOL_IDS.length)
  assert.deepEqual(catalog.TOOL_ENTRIES.map((entry) => entry.id), catalog.TOOL_IDS)
  for (const entry of catalog.TOOL_ENTRIES) {
    assert.equal(typeof entry.labelKey, 'string')
    assert.equal(typeof entry.hintKey, 'string')
    assert.equal(typeof entry.icon, 'string')
    // The annotation entry borrows the annotation.* copy it shares with its body.
    assert.ok(/^(tools|annotation)\./.test(entry.labelKey))
    assert.ok(/^(tools|annotation)\./.test(entry.hintKey))
  }
  assert.equal(catalog.toolEntry('measure'), catalog.TOOL_ENTRIES[0])
  assert.equal(catalog.toolEntry('nope'), null)
  assert.equal(catalog.toolEntry(undefined), null)
})

test('入口开合：开→切→再点关闭，未知 id 保持当前', () => {
  assert.equal(catalog.nextOpenTool(null, 'measure'), 'measure')
  assert.equal(catalog.nextOpenTool('measure', 'select'), 'select')
  assert.equal(catalog.nextOpenTool('select', 'select'), null)
  assert.equal(catalog.nextOpenTool('select', 'ghost'), 'select')
  assert.equal(catalog.nextOpenTool(null, 'ghost'), null)
})

test('面板折叠状态记在 localStorage，读写失败时退回默认值', () => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
  assert.equal(prefs.readPanelFlag('x', false), false)
  prefs.writePanelFlag('x', true)
  assert.equal(store.get(prefs.STORAGE_PREFIX + 'x'), '1')
  assert.equal(prefs.readPanelFlag('x', false), true)
  prefs.writePanelFlag('x', false)
  assert.equal(store.get(prefs.STORAGE_PREFIX + 'x'), '0')
  assert.equal(prefs.readPanelFlag('x', true), false)
  store.set(prefs.STORAGE_PREFIX + 'y', 'junk')
  assert.equal(prefs.readPanelFlag('y', true), true)
  assert.equal(prefs.IMAGERY_OPEN_KEY, 'layers.imagery.open')

  globalThis.localStorage = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    },
  }
  assert.equal(prefs.readPanelFlag('x', true), true)
  assert.doesNotThrow(() => prefs.writePanelFlag('x', true))
  delete globalThis.localStorage
})

test('底图折叠头摘要：显示当前底图名，未选底图时给明确文案', () => {
  const config = { imagery: [{ id: 'esri', name: 'Esri World Imagery' }, { id: 'osm', name: 'OSM' }] }
  // 折叠时分组头带一行摘要：「当前底图 <名字>」。
  assert.equal(imageryHint(config, { imagery: 'esri' }), '<layers.imageryCurrent> Esri World Imagery')
  assert.equal(imageryHint(config, { imagery: 'osm' }), '<layers.imageryCurrent> OSM')
  // 未选底图 / 没有设置时给明确文案，而不是空摘要。
  assert.equal(imageryHint(config, { imagery: null }), '<layers.imageryCurrent> <layers.imageryNone>')
  assert.equal(imageryHint(config, {}), '<layers.imageryCurrent> <layers.imageryNone>')
  assert.equal(imageryHint(config, { imagery: 'gone' }), '<layers.imageryCurrent> gone')
  // 展开后不再需要摘要（列表本身就是答案）。
  globalThis.localStorage = {
    getItem: (key) => (key === `${prefs.STORAGE_PREFIX}${prefs.groupOpenKey('imagery')}` ? '1' : null),
    setItem() {},
  }
  try {
    assert.equal(imageryHint(config, { imagery: 'esri' }), null)
  } finally {
    delete globalThis.localStorage
  }
})

test('i18n：新文案中英齐全，五个分组标签不再带层级后缀', () => {
  const keys = [
    'tools.measure',
    'tools.select',
    'tools.analysis',
    'tools.effects',
    'tools.view',
    'tools.measureHint',
    'tools.selectHint',
    'tools.analysisHint',
    'tools.effectsHint',
    'tools.viewHint',
    'tools.windowMinimize',
    'tools.windowExpand',
    'tools.windowClose',
    'layers.imageryNone',
    'layers.imageryCurrent',
  ]
  for (const key of keys) {
    for (const locale of ['zh', 'en']) {
      assert.equal(typeof MESSAGES[locale][key], 'string', `${locale} 缺少 ${key}`)
    }
  }
  // v1.8：卡片按「体（三维）/ 面（地表）」重组，组名就是数据种类，不再带
  // （L1）–（L4）层级后缀（后缀曾被误读为图层顺序）。
  for (const key of ['layers.terrain', 'layers.imagery', 'layers.raster', 'layers.vector', 'layers.content']) {
    for (const locale of ['zh', 'en']) {
      assert.equal(typeof MESSAGES[locale][key], 'string', `${locale} 缺少 ${key}`)
      assert.doesNotMatch(MESSAGES[locale][key], /[（(]?L[1-4][）)]?/, `${key} 不应再带层级后缀`)
    }
  }
  // 页签：三维 / 地表（「地图」已并入「地表」，不再有 layers.tab.map）。
  assert.equal(MESSAGES.zh['layers.tab.3d'], '三维')
  assert.equal(MESSAGES.zh['layers.tab.surface'], '地表')
  assert.equal(MESSAGES.en['layers.tab.surface'], 'Surface')
  assert.equal(MESSAGES.zh['layers.tab.map'], undefined)
  assert.equal(MESSAGES.en['layers.tab.map'], undefined)
  // 卡片与工具栏同名 —— 管理的就是一个「场景」。
  assert.equal(MESSAGES.zh['btn.layers'], '场景')
  assert.equal(MESSAGES.zh['layers.title'], '场景')
  // The annotation entry reads annotation.* copy: it must reach the merged catalog.
  for (const locale of ['zh', 'en']) {
    assert.equal(MESSAGES[locale]['annotation.tool'], ANNOTATION_MESSAGES[locale]['annotation.tool'])
    assert.equal(MESSAGES[locale]['annotation.toolHint'], ANNOTATION_MESSAGES[locale]['annotation.toolHint'])
  }
})
