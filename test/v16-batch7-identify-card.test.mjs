/**
 * v1.6 Batch 7 — F4: one rich identify card instead of the thin "pick" card.
 *
 * Requirement #1: after clicking an object the panel used to say almost nothing
 * ("a 3D model"). The card now carries coordinates (copyable), the layer, up to
 * twelve batch-table attributes with an honest "N more" note, measured heights and
 * the existing actions. The legacy pick card is gone; the Agent's raw pickResult
 * data read stays.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const selection = await import('../src/client/scene/selection.js')
const { MESSAGES } = await import('../src/client/messages.js')
const { readRepoFile } = await import('./helpers/source.mjs')

test('coordinateText：六位小数可直接粘贴，非法点返回空串而不是 NaN', () => {
  assert.equal(selection.coordinateText({ lon: 114.3123456, lat: 30.5123456 }), '114.312346, 30.512346')
  assert.equal(selection.coordinateText({ lon: -114.5, lat: 0 }), '-114.500000, 0.000000')
  assert.equal(selection.coordinateText({ lon: 1.23456789, lat: 2.98765432 }, 3), '1.235, 2.988')
  assert.equal(selection.coordinateText({ lon: Number.NaN, lat: 1 }), '')
  assert.equal(selection.coordinateText({ lon: 'x', lat: 1 }), '')
  assert.equal(selection.coordinateText(null), '')
  assert.equal(selection.coordinateText(undefined), '')
})

test('shownProperties：默认预览 12 条，其余给隐藏数量，空表不报错', () => {
  assert.equal(selection.PROPERTY_PREVIEW_LIMIT, 12)
  const many = Array.from({ length: 30 }, (_, index) => ({ name: `p${index}`, value: String(index) }))
  const wide = selection.shownProperties(many)
  assert.equal(wide.shown.length, 12)
  assert.equal(wide.total, 30)
  assert.equal(wide.hidden, 18)
  assert.deepEqual(wide.shown[11], { name: 'p11', value: '11' })

  const narrow = selection.shownProperties([{ name: 'a', value: 'b' }])
  assert.equal(narrow.shown.length, 1)
  assert.equal(narrow.hidden, 0)

  assert.deepEqual(selection.shownProperties(null), { shown: [], total: 0, hidden: 0 })
  assert.deepEqual(selection.shownProperties(undefined, 0), { shown: [], total: 0, hidden: 0 })
})

test('指认卡本身带坐标：卡片点的经纬度会原样出现在坐标行', () => {
  const card = selection.buildSelectionCard({
    point: { lon: 114.3123456, lat: 30.5123456, surface_height_m: 512.34 },
    layer: { id: 'l1', name: '测试图层' },
    identity: { kind: 'tile_feature', name: null, properties: [{ name: 'height', value: '33.2' }] },
    samples: [],
  })
  assert.equal(selection.coordinateText(card.point), '114.312346, 30.512346')
  assert.equal(card.layer.name, '测试图层')
  assert.equal(card.identity.properties.length, 1)
})

test('接线：指认卡有坐标复制与属性计数，ViewerSurface 不再渲染旧拾取卡', () => {
  const overlay = readRepoFile('src/client/ui/selection-overlay.js')
  assert.match(overlay, /coordinateText\(card\?\.point\)/)
  assert.match(overlay, /shownProperties\(card\?\.identity\?\.properties\)/)
  assert.match(overlay, /'coords'/)
  assert.match(overlay, /selection\.copyCoords/)
  assert.match(overlay, /selection\.propertiesCount/)
  assert.match(overlay, /selection\.propertiesMore/)
  assert.match(overlay, /navigator\?\.clipboard/)
  // Copy failure is a toast, not an unhandled rejection.
  assert.match(overlay, /selection\.copyFailed/)

  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.doesNotMatch(surface, /pickInfo/, '旧拾取卡状态必须删除')
  assert.doesNotMatch(surface, /mv-pick mv-glass/, '旧拾取卡标记必须删除')
  assert.match(surface, /const \{ pickResult, onCanvasClick \} = pointerTools/)

  const pointer = readRepoFile('src/client/scene/pointer-tools.js')
  assert.match(pointer, /mode === 'identify' \|\| mode === 'pick'/)
  assert.match(pointer, /return \{ pickResult, onCanvasClick, finishMeasure \}/)
})

test('i18n：坐标/复制/属性计数文案中英齐全', () => {
  const keys = [
    'selection.coordinates',
    'selection.copyCoords',
    'selection.copied',
    'selection.copyFailed',
    'selection.propertiesCount',
    'selection.propertiesMore',
  ]
  for (const key of keys) {
    for (const locale of ['zh', 'en']) {
      assert.equal(typeof MESSAGES[locale][key], 'string', `${locale} 缺少 ${key}`)
    }
  }
  assert.match(MESSAGES.zh['selection.propertiesCount'], /\{shown\}/)
  assert.match(MESSAGES.en['selection.propertiesMore'], /\{n\}/)
})

test('CSS：坐标行与属性更多提示有样式（沿用卡片字号/暗色变量）', () => {
  const css = readRepoFile('src/client/ui/css.js')
  for (const rule of ['.mv-select .coords{', '.mv-select .coords code{', '.mv-select .props-more{']) {
    assert.ok(css.includes(rule), `缺少 ${rule}`)
  }
})
