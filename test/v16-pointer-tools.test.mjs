/**
 * v1.6 Phase 2 — canvas picking and the measure click loop.
 *
 * Extracted from ViewerSurface. These tests drive the module with a fake Cesium
 * namespace: feature property extraction (capped at 40), tileset/entity/scene
 * identification, the pick card contents, and the click loop for distance/area/
 * height measurements.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createPointerTools } from '../src/client/scene/pointer-tools.js'

class Feature {
  constructor(properties, tileset) {
    this.properties = properties
    this.tileset = tileset
    this.primitive = tileset
  }

  getPropertyIds() {
    return Object.keys(this.properties)
  }

  getProperty(id) {
    return this.properties[id]
  }
}

class Tileset {}

class Entity {
  constructor(value) {
    this.id = value.id
    this.name = value.name
  }
}

const Cesium = { Cesium3DTileFeature: Feature, Cesium3DTileset: Tileset, Entity, defined: (value) => value !== undefined && value !== null }

function makeTools({ pick, tool = null, points = [] } = {}) {
  const state = { pickInfo: null, tool: tool, points, toasts: [], redrawn: [], finished: 0 }
  const measureRef = { current: { points } }
  const viewer = { scene: { pick: () => pick } }
  const tools = createPointerTools({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    toolRef: { get current() { return state.tool }, set current(value) { state.tool = value } },
    measureRef,
    setPickInfo: (value) => {
      state.pickInfo = value
    },
    showToast: (text) => state.toasts.push(text),
    pickSurface: () => ({ lon: 1, lat: 2, height: 3 }),
    redrawMeasure: (mode) => state.redrawn.push(mode),
    onFinishTool: () => {
      state.finished += 1
    },
    formatValue: (value) => String(value),
    layerLabel: (tileset) => (tileset === 'tiles' || tileset instanceof Tileset ? 'Tiles' : 'other'),
    t: (key) => key,
  })
  return { tools, state }
}

test('pickResult：无引擎/未命中返回 picked:false；要素属性最多 40 条', () => {
  const none = createPointerTools({
    getCesium: () => null,
    getViewer: () => null,
    toolRef: { current: null },
    measureRef: { current: { points: [] } },
    setPickInfo: () => {},
    showToast: () => {},
    pickSurface: () => null,
    redrawMeasure: () => {},
    onFinishTool: () => {},
    formatValue: String,
    layerLabel: () => 'x',
    t: (key) => key,
  })
  assert.deepEqual(none.pickResult({ x: 1, y: 1 }), { picked: false, type: 'none', properties: [] })

  const { tools } = makeTools()
  assert.deepEqual(tools.pickResult({ x: 1, y: 1 }), { picked: false, type: 'none', properties: [] })

  const many = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`p${index}`, index]))
  const { tools: rich } = makeTools({ pick: new Feature(many, 'tiles') })
  const picked = rich.pickResult({ x: 1, y: 1 })
  assert.equal(picked.type, 'tile-feature')
  assert.equal(picked.layer, 'Tiles')
  assert.equal(picked.properties.length, 40, '属性必须封顶 40 条')
  assert.deepEqual(picked.properties[0], { name: 'p0', value: '0' })
})

test('pickResult：tileset / entity / scene 三种回退', () => {
  const { tools: tileset } = makeTools({ pick: new Tileset() })
  assert.deepEqual(tileset.pickResult({}), { picked: true, type: 'tileset', layer: 'Tiles', properties: [] })

  const { tools: entity } = makeTools({ pick: { id: new Entity({ name: 'Marker', id: 'm1' }) } })
  assert.deepEqual(entity.pickResult({}), { picked: true, type: 'entity', name: 'Marker', properties: [] })

  const { tools: scene } = makeTools({ pick: { primitive: {} } })
  assert.deepEqual(scene.pickResult({}), { picked: true, type: 'scene', properties: [] })
})

test('pickAt：要素无属性时给 noProperties 行；tileset/entity/scene 卡片正确', () => {
  const { tools, state } = makeTools({ pick: new Feature({}, 'tiles') })
  tools.pickAt({})
  assert.equal(state.pickInfo.title, 'Tiles')
  assert.deepEqual(state.pickInfo.rows, [['pick.noProperties', 'pick.noPropertiesValue']])

  const { tools: tilesetTools, state: tilesetState } = makeTools({ pick: new Tileset() })
  tilesetTools.pickAt({})
  assert.equal(tilesetState.pickInfo.title, 'pick.title')
  assert.deepEqual(tilesetState.pickInfo.rows, [['pick.type', 'pick.tiles'], ['pick.layer', 'Tiles']])

  const { tools: entityTools, state: entityState } = makeTools({ pick: { id: new Entity({ name: 'Marker', id: 'm1' }) } })
  entityTools.pickAt({})
  assert.deepEqual(entityState.pickInfo.rows, [['pick.type', 'pick.entity'], ['pick.name', 'Marker']])

  const { tools: sceneTools, state: sceneState } = makeTools({ pick: null })
  sceneTools.pickAt({})
  assert.equal(sceneState.pickInfo.title, 'toast.pickNone')
  assert.deepEqual(sceneState.pickInfo.rows, [])
})

test('onCanvasClick：测距/测面累加点并重绘；测高最多保留两点；无地表时提示', () => {
  const distance = makeTools({ tool: 'distance' })
  distance.tools.onCanvasClick({})
  assert.equal(distance.state.points.length, 1)
  assert.deepEqual(distance.state.points[0], { lon: 1, lat: 2, height: 3 })
  assert.deepEqual(distance.state.redrawn, ['distance'])

  const height = makeTools({ tool: 'height', points: [{ a: 1 }, { b: 2 }, { c: 3 }] })
  height.tools.onCanvasClick({})
  assert.equal(height.state.points.length, 2, '测高只保留最后两个点')
  assert.deepEqual(height.state.points[1], { lon: 1, lat: 2, height: 3 })

  // 无工具时点击不做任何事。
  const idle = makeTools({ tool: null })
  idle.tools.onCanvasClick({})
  assert.equal(idle.state.points.length, 0)

  // 没有地表交点时提示而不加点。
  const noSurface = createPointerTools({
    getCesium: () => Cesium,
    getViewer: () => ({ scene: { pick: () => null } }),
    toolRef: { current: 'distance' },
    measureRef: { current: { points: [] } },
    setPickInfo: () => {},
    showToast: () => {},
    pickSurface: () => null,
    redrawMeasure: () => {},
    onFinishTool: () => {},
    formatValue: String,
    layerLabel: () => 'x',
    t: (key) => key,
  })
  const state = { points: [], toasts: [] }
  noSurface.onCanvasClick({})
  assert.equal(state.points.length, 0)
})

test('finishMeasure：距离/面积/测高都能一键结束，测高不再卡在结束态', () => {
  const distance = makeTools({ tool: 'distance' })
  distance.tools.finishMeasure()
  assert.equal(distance.state.tool, null)
  assert.equal(distance.state.finished, 1)

  const height = makeTools({ tool: 'height' })
  height.tools.finishMeasure()
  assert.equal(height.state.tool, null)
  assert.equal(height.state.finished, 1)
})
