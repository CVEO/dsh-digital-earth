/**
 * v1.6 Batch 8 — F2a: annotations are real GeoJSON features you can name, note,
 * delete and export from the selection card.
 *
 * The model functions are pure, so most of this file is behaviour, not source
 * matching: a rename must round-trip through a replayed command, a vertex edit
 * must keep a closed ring closed, and a delete must never leave an empty card.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const model = await import('../src/client/scene/annotation-model.js')
const edit = await import('../src/client/scene/annotation-edit.js')
const actions = await import('../src/client/scene/annotation-actions.js')
const { MESSAGES } = await import('../src/client/messages.js')
const { readRepoFile } = await import('./helpers/source.mjs')

const polygon = {
  type: 'Feature',
  properties: { name: '研究区' },
  geometry: { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.4, 30.5], [114.4, 30.6], [114.3, 30.5]]] },
}
const line = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: [[114.3, 30.5], [114.4, 30.6]] },
}

function commandOf(feature) {
  return { geojson: { type: 'FeatureCollection', features: [feature] }, style: 'accent', drawn: 1 }
}

function fakeState(feature) {
  const command = commandOf(feature)
  return {
    state: {
      draw: [],
      measure: [],
      drawCommands: [command],
      measureCommands: [],
      drawnFeatures: 1,
      measuredCount: 0,
      entityGroups: new WeakMap(),
    },
    command,
    viewer: { entities: { remove() {} } },
  }
}

test('annotationKindOf：显式 kind 优先，否则按几何类型推断', () => {
  assert.equal(model.annotationKindOf(polygon), 'area')
  assert.equal(model.annotationKindOf(line), 'line')
  assert.equal(model.annotationKindOf({ geometry: { type: 'Point', coordinates: [1, 2] } }), 'point')
  assert.equal(model.annotationKindOf({ geometry: { type: 'MultiPolygon', coordinates: [] } }), 'area')
  assert.equal(model.annotationKindOf({ properties: { kind: 'note' }, geometry: { type: 'Point' } }), 'note')
  assert.equal(model.annotationKindOf(null), 'note')
  assert.equal(model.ANNOTATION_COORDINATE_DECIMALS, 6)
  assert.equal(model.ANNOTATION_MAX_NAME, 80)
  assert.equal(model.ANNOTATION_MAX_NOTE, 280)
})

test('withAnnotationProperties：去空格、限长、空值即删除，其他属性保留', () => {
  const kept = model.withAnnotationProperties(
    { type: 'Feature', properties: { name: '旧', elevation: 12 }, geometry: polygon.geometry },
    { name: '  新名称  ', note: '  备注  ' },
  )
  assert.equal(kept.ok, true)
  assert.equal(kept.feature.properties.name, '新名称')
  assert.equal(kept.feature.properties.note, '备注')
  assert.equal(kept.feature.properties.elevation, 12)

  const cleared = model.withAnnotationProperties(polygon, { name: '' })
  assert.equal(cleared.ok, true)
  assert.equal('name' in cleared.feature.properties, false)

  const long = model.withAnnotationProperties(polygon, { name: 'x'.repeat(200) })
  assert.equal(long.feature.properties.name.length, model.ANNOTATION_MAX_NAME)
  assert.equal(model.withAnnotationProperties(null, { name: 'a' }).ok, false)
})

test('moveAnnotationVertex：闭合环的首点移动必须带动末点，环始终闭合', () => {
  const moved = model.moveAnnotationVertex(polygon, 0, 0, 114.35, 30.55)
  assert.equal(moved.ok, true)
  const ring = moved.feature.geometry.coordinates[0]
  assert.deepEqual(ring[0], [114.35, 30.55])
  assert.deepEqual(ring[ring.length - 1], [114.35, 30.55])
  assert.equal(model.moveAnnotationVertex(polygon, 0, 0, Number.NaN, 30).ok, false)
  assert.equal(model.moveAnnotationVertex(polygon, 0, 9, 114, 30).ok, false)
})

test('insert/delete 顶点：拒绝重复的闭合点，插点后仍闭合，删到 <3 角拒绝', () => {
  const ring = polygon.geometry.coordinates[0]
  const duplicate = model.insertAnnotationVertex(polygon, 0, ring.length - 1, 114.32, 30.52)
  assert.equal(duplicate.ok, false)

  const inserted = model.insertAnnotationVertex(polygon, 0, ring.length - 2, 114.32, 30.52)
  assert.equal(inserted.ok, true)
  const next = inserted.feature.geometry.coordinates[0]
  assert.equal(next.length, ring.length + 1)
  assert.deepEqual(next[0], next[next.length - 1])

  const triangle = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
  }
  assert.equal(model.deleteAnnotationVertex(triangle, 0, 0).ok, false)
  assert.equal(model.deleteAnnotationVertex(line, 0, 0).ok, false)
  assert.equal(model.deleteAnnotationVertex(polygon, 0, ring.length - 1).ok, false)

  const square = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
  }
  const removed = model.deleteAnnotationVertex(square, 0, 1)
  assert.equal(removed.ok, true)
  const nextRing = removed.feature.geometry.coordinates[0]
  assert.equal(nextRing.length, 4)
  assert.deepEqual(nextRing[0], nextRing[nextRing.length - 1])
})

test('translateAnnotation 与 nextAnnotationName：整体平移、名字避重', () => {
  const shifted = model.translateAnnotation(polygon, 0.1, -0.2)
  assert.equal(shifted.ok, true)
  assert.ok(Math.abs(shifted.feature.geometry.coordinates[0][0][0] - 114.4) < 1e-9)
  assert.ok(Math.abs(shifted.feature.geometry.coordinates[0][0][1] - 30.3) < 1e-9)
  const named = model.nextAnnotationName([{ properties: { name: '研究区 1' } }], 'area', () => '研究区')
  assert.equal(named, '研究区 2')
})

test('annotation-edit：改名后回放同一命令，几何与样式保留；删最后一条即删命令', () => {
  const { state, command, viewer } = fakeState(polygon)
  const replayed = []
  const replay = (geojson, style, caption) => {
    const next = { geojson, style, caption }
    replayed.push(next)
    state.drawCommands.push(next)
    return next
  }
  const selection = { command, feature: command.geojson.features[0] }
  const renamed = edit.updateAnnotationFeature(state, viewer, selection, { name: '采样区 A' }, replay)
  assert.equal(renamed.ok, true)
  assert.equal(replayed.length, 1)
  assert.equal(replayed[0].style, 'accent')
  assert.equal(replayed[0].geojson.features[0].properties.name, '采样区 A')
  assert.equal(replayed[0].geojson.features[0].geometry.type, 'Polygon')
  assert.equal(state.drawCommands.length, 1)

  const fresh = fakeState(polygon)
  const removed = edit.deleteAnnotationFeature(fresh.state, fresh.viewer, {
    command: fresh.command,
    feature: fresh.command.geojson.features[0],
  }, replay)
  assert.equal(removed.ok, true)
  assert.equal(removed.command, null)
  assert.equal(fresh.state.drawCommands.length, 0)
})

test('annotation-actions：编辑失败给出原因，成功才刷新并提示', () => {
  const { state, command, viewer } = fakeState(polygon)
  const toasts = []
  let changed = 0
  const api = actions.createAnnotationActions({
    stateRef: { current: state },
    viewerRef: { current: viewer },
    getSelection: () => ({ command, feature: command.geojson.features[0] }),
    draw: (geojson, style) => {
      const next = { geojson, style }
      state.drawCommands.push(next)
      return next
    },
    showToast: (text) => toasts.push(text),
    t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
    onChanged: () => { changed += 1 },
  })
  assert.equal(api.update({ name: 'A' }), true)
  assert.equal(changed, 1)
  assert.equal(toasts.at(-1), 'annotation.saved')
  assert.equal(api.export(), true)
  assert.equal(toasts.at(-1).startsWith('annotation.exported'), true)
})

test('卡片接线：可编辑输入框与三个动作都在，面板仍用原有样式类', async () => {
  const card = await readRepoFile('src/client/ui/vector-card.js')
  assert.match(card, /annotation\.name/)
  assert.match(card, /annotation\.note/)
  assert.match(card, /textarea/)
  assert.match(card, /annotation\.save/)
  assert.match(card, /annotation\.delete/)
  assert.match(card, /annotation\.export/)
  assert.match(card, /mv-vector-card/)
  assert.match(card, /onChange\?\./)

  const surface = await readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /createAnnotationActions\(\{/)
  assert.match(surface, /onChange: annotations\.update/)
  assert.match(surface, /onDelete: annotations\.remove/)
  assert.match(surface, /onExport: annotations\.export/)

  // The editor reuses the card shell: inputs sit inside .mv-vector-card.
  const vectorCss = await readRepoFile('src/client/ui/vector-css.js')
  assert.match(vectorCss, /\.mv-vector-card \.mv-vector-edit\{/)
  assert.match(vectorCss, /\.mv-vector-card \.mv-vector-actions\{/)

  const zh = MESSAGES.zh
  const en = MESSAGES.en
  for (const key of ['annotation.name', 'annotation.note', 'annotation.save', 'annotation.delete', 'annotation.export', 'annotation.editHint', 'annotation.editFailed']) {
    assert.equal(typeof zh[key], 'string', key)
    assert.equal(typeof en[key], 'string', key)
  }
})
