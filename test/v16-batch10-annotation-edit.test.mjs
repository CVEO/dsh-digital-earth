/**
 * v1.6 Batch 10 — F2b2: vertex-level editing of one annotation feature.
 *
 * Geometry rules live in scene/annotation-vertices.js and are pure, so most of
 * this file is behaviour: which handles exist, where a new vertex lands, and
 * that a shape patch replays exactly one command without touching neighbours.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const model = await import('../src/client/scene/annotation-model.js')
const vertices = await import('../src/client/scene/annotation-vertices.js')
const edit = await import('../src/client/scene/annotation-edit.js')
const actions = await import('../src/client/scene/annotation-actions.js')
const editor = await import('../src/client/scene/annotation-editor.js')
const { ANNOTATION_MESSAGES } = await import('../src/client/messages-annotations.js')

const square = {
  type: 'Feature',
  properties: { name: '研究区', kind: 'area' },
  geometry: {
    type: 'Polygon',
    coordinates: [[[114.3, 30.5], [114.4, 30.5], [114.4, 30.6], [114.3, 30.6], [114.3, 30.5]]],
  },
}
const road = {
  type: 'Feature',
  properties: { name: '便道', kind: 'line' },
  geometry: { type: 'LineString', coordinates: [[114.3, 30.5], [114.4, 30.5], [114.5, 30.55]] },
}
const dot = {
  type: 'Feature',
  properties: { name: '点位', kind: 'point' },
  geometry: { type: 'Point', coordinates: [114.3, 30.5] },
}

function fakeState(features) {
  const command = {
    geojson: { type: 'FeatureCollection', features },
    style: 'accent',
    caption: 'test',
    drawn: features.length,
  }
  const state = {
    draw: [],
    measure: [],
    drawCommands: [command],
    measureCommands: [],
    drawnFeatures: features.length,
    measuredCount: 0,
    entityGroups: new WeakMap(),
  }
  const outcomes = []
  const create = () => actions.createAnnotationActions({
    stateRef: { current: state },
    viewerRef: { current: { entities: { remove() {} } } },
    getSelection: () => null,
    draw: (geojson, style, caption) => {
      const next = { geojson, style, caption, drawn: geojson.features.length }
      state.drawCommands.push(next)
      return next
    },
    showToast: (message) => outcomes.push(message),
    t: (key) => key,
    onChanged: () => outcomes.push('changed'),
  })
  return { state, command, outcomes, create }
}

test('vertexCornerCount：闭合环不重复数首点，开口线按原长度', () => {
  const ring = [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]
  assert.equal(vertices.vertexCornerCount(ring, true), 4)
  assert.equal(vertices.vertexCornerCount([[1, 1], [2, 2], [3, 3]], false), 3)
  // A ring whose ends differ is not closed yet; every vertex counts once.
  assert.equal(vertices.vertexCornerCount([[1, 1], [2, 2], [3, 3]], true), 3)
  assert.equal(vertices.vertexCornerCount([], true), 0)
})

test('annotationHandlePoints / annotationCenterPoint：外环手柄与整体拖拽中心', () => {
  const handles = vertices.annotationHandlePoints(square)
  assert.equal(handles.length, 4)
  assert.deepEqual(handles[0], { ringIndex: 0, vertexIndex: 0, lon: 114.3, lat: 30.5 })
  assert.equal(vertices.annotationHandlePoints(road).length, 3)
  assert.deepEqual(vertices.annotationHandlePoints(dot), [])
  assert.equal(vertices.isShapeEditable(square), true)
  assert.equal(vertices.isShapeEditable(dot), false)

  const center = vertices.annotationCenterPoint(handles)
  assert.ok(Math.abs(center.lon - 114.35) < 1e-9)
  assert.ok(Math.abs(center.lat - 30.55) < 1e-9)
  assert.equal(vertices.annotationCenterPoint([]), null)
})

test('annotationInsertPoint：线取后继线段中点，末端退回前一段，面环回绕', () => {
  const middle = vertices.annotationInsertPoint(road, 0)
  assert.equal(middle.ok, true)
  assert.equal(middle.after, 0)
  assert.ok(Math.abs(middle.lon - 114.35) < 1e-9)
  assert.ok(Math.abs(middle.lat - 30.5) < 1e-9)

  const last = vertices.annotationInsertPoint(road, 2)
  assert.equal(last.ok, true)
  assert.equal(last.after, 1)
  assert.ok(Math.abs(last.lon - 114.45) < 1e-9)

  // Polygon: the segment after the last corner wraps to the first one.
  const wrap = vertices.annotationInsertPoint(square, 3)
  assert.equal(wrap.ok, true)
  assert.ok(Math.abs(wrap.lon - 114.3) < 1e-9)
  assert.ok(Math.abs(wrap.lat - 30.55) < 1e-9)

  assert.equal(vertices.annotationInsertPoint(square, 4).ok, false)
  assert.equal(vertices.annotationInsertPoint(dot, 0).ok, false)
})

test('withAnnotationGeometry：替换几何、越界与坏几何都被拒绝', () => {
  const geometry = { type: 'Polygon', coordinates: [[[114.31, 30.51], [114.41, 30.51], [114.41, 30.61], [114.31, 30.51]]] }
  const patched = model.withAnnotationGeometry(square, geometry)
  assert.equal(patched.ok, true)
  assert.deepEqual(patched.feature.geometry, geometry)
  assert.equal(patched.feature.properties.name, '研究区')

  assert.equal(model.withAnnotationGeometry(square, { type: 'Polygon', coordinates: [[[200, 30]]] }).error, 'out_of_bounds')
  assert.equal(model.withAnnotationGeometry(square, {}).error, 'invalid_geometry')
  assert.equal(model.withAnnotationGeometry({ properties: {} }, geometry).error, 'invalid_feature')
})

test('findFeatureInState：从最新命令倒序找同名同类型要素', () => {
  const older = { geojson: { type: 'FeatureCollection', features: [square] }, style: 'accent', drawn: 1 }
  const newer = {
    geojson: { type: 'FeatureCollection', features: [{ ...square, geometry: dot.geometry }, road] },
    style: 'accent',
    drawn: 2,
  }
  const state = { drawCommands: [older, newer] }
  const found = edit.findFeatureInState(state, '研究区', 'area')
  assert.equal(found.command, newer)
  assert.equal(found.index, 0)
  assert.equal(edit.findFeatureInState(state, '研究区', 'line'), null)
  assert.equal(edit.findFeatureInState(state, '', 'area'), null)
})

test('annotation-actions.geometry：只重放一条命令，邻要素与其他命令保持原样', () => {
  const neighbour = { ...road, properties: { name: '邻路', kind: 'line' } }
  const otherCommand = {
    geojson: { type: 'FeatureCollection', features: [{ ...dot, properties: { name: '别的点', kind: 'point' } }] },
    style: 'success',
    drawn: 1,
  }
  const { state, command, outcomes } = fakeState([square, neighbour])
  state.drawCommands.push(otherCommand)
  const beforeNeighbour = JSON.stringify(neighbour)
  const beforeOther = JSON.stringify(otherCommand)
  const nextGeometry = { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.42, 30.5], [114.42, 30.62], [114.3, 30.5]]] }

  const instance = actions.createAnnotationActions({
    stateRef: { current: state },
    viewerRef: { current: { entities: { remove() {} } } },
    getSelection: () => null,
    draw: (geojson, style, caption) => {
      const next = { geojson, style, caption, drawn: geojson.features.length }
      state.drawCommands.push(next)
      return next
    },
    showToast: (message) => outcomes.push(message),
    t: (key) => key,
    onChanged: () => outcomes.push('changed'),
  })
  assert.equal(instance.geometry({ name: '研究区', kind: 'area', geometry: nextGeometry }), true)
  // The edited command was removed and replayed once: one new command, no growth.
  assert.equal(state.drawCommands.length, 2)
  const edited = state.drawCommands[1]
  assert.deepEqual(edited.geojson.features[0].geometry, nextGeometry)
  assert.equal(JSON.stringify(edited.geojson.features[1]), beforeNeighbour)
  assert.equal(JSON.stringify(state.drawCommands[0]), beforeOther)
  assert.ok(outcomes.includes('changed'))
  assert.ok(outcomes.includes('annotation.shapeSaved'))
  assert.equal(edited.drawn, 2)
})

test('annotation-actions.geometry：找不到要素时提示失败且不改命令', () => {
  const { state, outcomes, create } = fakeState([square])
  const instance = create()
  const before = JSON.stringify(state.drawCommands[0])
  assert.equal(instance.geometry({ name: '不存在', kind: 'area', geometry: dot.geometry }), false)
  assert.equal(JSON.stringify(state.drawCommands[0]), before)
  assert.equal(state.drawCommands.length, 1)
  assert.ok(outcomes.includes('annotation.editFailed'))
})

test('annotation-editor：没有 viewer 时安静失败，不抛异常', () => {
  const instance = editor.createAnnotationEditor({
    getCesium: () => null,
    getViewer: () => null,
    getRoot: () => null,
    pickSurface: () => null,
    updateGeometry: () => false,
    showToast: () => {},
    t: (key) => key,
  })
  assert.equal(instance.focus(null), false)
  assert.equal(instance.focus({ feature: square }), false)
  instance.clear()
  instance.dispose()
})

test('i18n：顶点编辑文案中英文齐全', () => {
  const keys = [
    'annotation.vertexHint',
    'annotation.centerHint',
    'annotation.shapeSaved',
    'annotation.vertexInserted',
    'annotation.vertexDeleted',
    'annotation.vertexFailed',
    'annotation.tooFewVertices',
    'annotation.undone',
    'annotation.nothingToUndo',
  ]
  for (const key of keys) {
    assert.equal(typeof ANNOTATION_MESSAGES.zh[key], 'string', `zh ${key}`)
    assert.equal(typeof ANNOTATION_MESSAGES.en[key], 'string', `en ${key}`)
    assert.ok(ANNOTATION_MESSAGES.zh[key].length > 0)
  }
})
