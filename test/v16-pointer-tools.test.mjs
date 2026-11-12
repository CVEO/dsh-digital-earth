/**
 * v1.6 Phase 2 — canvas picking and the measure click loop.
 *
 * Extracted from ViewerSurface. These tests drive the module with a fake Cesium
 * namespace: feature property extraction (capped at 40), tileset/entity/scene
 * identification, and the click loop for distance/area/height measurements.
 *
 * F4: the old pick card is gone — "pick" now routes to the identify card (same
 * attributes plus height, coordinates and export). pickResult() stays because the
 * Agent bridge uses it as a raw data read.
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

function makeTools({ pick, tool = null, points = [], surface = { lon: 1, lat: 2, height: 3 }, overlayHit = false } = {}) {
  const state = { tool, points, toasts: [], redrawn: [], finished: 0, identified: [], overlayClicks: 0 }
  const measureRef = { current: { points } }
  const viewer = { scene: { pick: () => pick } }
  const tools = createPointerTools({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    toolRef: { get current() { return state.tool }, set current(value) { state.tool = value } },
    measureRef,
    showToast: (text) => state.toasts.push(text),
    pickSurface: () => surface,
    redrawMeasure: (mode) => state.redrawn.push(mode),
    onFinishTool: () => {
      state.finished += 1
    },
    onIdentify: (position) => state.identified.push(position),
    onOverlayClick: () => {
      state.overlayClicks += 1
      return overlayHit
    },
    formatValue: (value) => String(value),
    layerLabel: (tileset) => (tileset === 'tiles' || tileset instanceof Tileset ? 'Tiles' : 'other'),
    t: (key) => key,
  })
  return { tools, state }
}

function bareTools(overrides = {}) {
  return createPointerTools({
    getCesium: () => null,
    getViewer: () => null,
    toolRef: { current: null },
    measureRef: { current: { points: [] } },
    showToast: () => {},
    pickSurface: () => null,
    redrawMeasure: () => {},
    onFinishTool: () => {},
    formatValue: String,
    layerLabel: () => 'x',
    t: (key) => key,
    ...overrides,
  })
}

test('pickResult：无引擎/未命中返回 picked:false；要素属性最多 40 条', () => {
  assert.deepEqual(bareTools().pickResult({ x: 1, y: 1 }), { picked: false, type: 'none', properties: [] })

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

test('pick 与 identify 都打开指认卡：pick 只是旧会话/命令的别名', () => {
  const pick = makeTools({ tool: 'pick' })
  pick.tools.onCanvasClick({ x: 1, y: 2 })
  assert.deepEqual(pick.state.identified, [{ x: 1, y: 2 }])
  assert.equal(pick.state.points.length, 0, 'pick 不再进入量测累点分支')

  const identify = makeTools({ tool: 'identify' })
  identify.tools.onCanvasClick({ x: 3, y: 4 })
  assert.deepEqual(identify.state.identified, [{ x: 3, y: 4 }])

  // A vector annotation under the cursor wins over identify: otherwise an
  // annotation could never be selected again after identify became default.
  const overlay = makeTools({ tool: 'pick', overlayHit: true })
  overlay.tools.onCanvasClick({})
  assert.equal(overlay.state.overlayClicks, 1)
  assert.equal(overlay.state.identified.length, 0)

  // makeTools does not expose pickAt any more: the card is owned by the overlay.
  assert.equal(typeof pick.tools.pickAt, 'undefined')
})

test('onCanvasClick：测距/测面累加测点并重绘；测高最多保留两点；无地表时提示', () => {
  const distance = makeTools({ tool: 'distance' })
  distance.tools.onCanvasClick({})
  assert.equal(distance.state.points.length, 1)
  assert.deepEqual(distance.state.points[0], { lon: 1, lat: 2, height: 3 })
  assert.deepEqual(distance.state.redrawn, ['distance'])

  const height = makeTools({ tool: 'height', points: [{ a: 1 }, { b: 2 }, { c: 3 }] })
  height.tools.onCanvasClick({})
  assert.equal(height.state.points.length, 2, '测高只保留最后两个点')
  assert.deepEqual(height.state.points[1], { lon: 1, lat: 2, height: 3 })

  const idle = makeTools({ tool: null })
  idle.tools.onCanvasClick({})
  assert.equal(idle.state.points.length, 0)

  const noSurface = makeTools({ tool: 'distance', surface: null })
  noSurface.tools.onCanvasClick({})
  assert.equal(noSurface.state.points.length, 0)
  assert.deepEqual(noSurface.state.toasts, ['toast.noSurface'])
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
