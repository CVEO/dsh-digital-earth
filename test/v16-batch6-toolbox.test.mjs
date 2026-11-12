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
const layersMap = await import('../src/client/ui/layers-map.js')
const { MESSAGES } = await import('../src/client/messages.js')
const { ANNOTATION_MESSAGES } = await import('../src/client/messages-annotations.js')

test('工具目录：七个入口，顺序稳定、字段齐全、未知 id 不伪造', () => {
  assert.deepEqual(catalog.TOOL_IDS, ['measure', 'select', 'annotation', 'parse', 'analysis', 'effects', 'view'])
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
  const t = (key) => `<${key}>`
  const config = { imagery: [{ id: 'esri', name: 'Esri World Imagery' }, { id: 'osm', name: 'OSM' }] }
  assert.equal(layersMap.imagerySummary(t, config, { imagery: 'esri' }), 'Esri World Imagery')
  assert.equal(layersMap.imagerySummary(t, config, { imagery: null }), '<layers.imageryNone>')
  assert.equal(layersMap.imagerySummary(t, config, {}), '<layers.imageryNone>')
  assert.equal(layersMap.imagerySummary(t, config, { imagery: 'gone' }), 'gone')
})

test('i18n：新文案中英齐全，L2 矢量 / L4 底图标签已换位', () => {
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
    'layers.imageryFold',
    'layers.imageryUnfold',
  ]
  for (const key of keys) {
    for (const locale of ['zh', 'en']) {
      assert.equal(typeof MESSAGES[locale][key], 'string', `${locale} 缺少 ${key}`)
    }
  }
  assert.match(MESSAGES.zh['layers.imagery'], /L4/)
  assert.match(MESSAGES.en['layers.imagery'], /L4/)
  assert.match(MESSAGES.zh['layers.vector'], /L2/)
  assert.match(MESSAGES.en['layers.vector'], /L2/)
  // The annotation entry reads annotation.* copy: it must reach the merged catalog.
  for (const locale of ['zh', 'en']) {
    assert.equal(MESSAGES[locale]['annotation.tool'], ANNOTATION_MESSAGES[locale]['annotation.tool'])
    assert.equal(MESSAGES[locale]['annotation.toolHint'], ANNOTATION_MESSAGES[locale]['annotation.toolHint'])
  }
})
