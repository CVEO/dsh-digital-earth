import assert from 'node:assert/strict'
import test from 'node:test'
import { createAnnotationTool } from '../src/client/scene/annotation-tool.js'
import { ANNOTATION_MESSAGES } from '../src/client/messages-annotations.js'

const DEG = Math.PI / 180

function fakeCesium() {
  const handlers = []
  class ScreenSpaceEventHandler {
    constructor(canvas) {
      this.canvas = canvas
      this.actions = new Map()
      this.destroyed = false
      handlers.push(this)
    }
    setInputAction(fn, type) {
      this.actions.set(type, fn)
    }
    fire(type, event) {
      this.actions.get(type)?.(event)
    }
    destroy() {
      this.destroyed = true
    }
  }
  class CallbackProperty {
    constructor(fn, isConstant) {
      this.fn = fn
      this.isConstant = isConstant
    }
  }
  class PolygonHierarchy {
    constructor(positions) {
      this.positions = positions
    }
  }
  return {
    handlers,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType: {
      LEFT_CLICK: 0,
      MOUSE_MOVE: 1,
      LEFT_DOUBLE_CLICK: 2,
      RIGHT_CLICK: 3,
    },
    CallbackProperty,
    PolygonHierarchy,
    ArcType: { GEODESIC: 0 },
    Cartesian3: { fromDegrees: (lon, lat) => ({ lon, lat }) },
    Cartographic: {
      fromCartesian: (surface) => ({ longitude: surface.lon * DEG, latitude: surface.lat * DEG }),
    },
    Math: { toDegrees: (rad) => rad / DEG },
    Color: {
      WHITE: { withAlpha: () => ({}) },
      fromCssColorString: () => ({ withAlpha: (alpha) => ({ alpha }) }),
    },
  }
}

function makeHarness() {
  const Cesium = fakeCesium()
  const added = []
  const removed = []
  const viewer = {
    scene: { canvas: {}, requestRender() {} },
    entities: {
      add: (options) => {
        const entity = { options }
        added.push(entity)
        return entity
      },
      remove: (entity) => removed.push(entity),
    },
  }
  const calls = { setTool: [], finish: [], toast: [] }
  const tool = createAnnotationTool({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    pickSurface: (position) => ({ lon: position.lon, lat: position.lat }),
    setTool: (mode) => calls.setTool.push(mode),
    showToast: (message) => calls.toast.push(message),
    t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
    onFinish: (feature) => calls.finish.push(feature),
  })
  const handler = () => Cesium.handlers.at(-1)
  return { Cesium, viewer, added, removed, calls, tool, handler }
}

test('a point annotation finishes on the first click and leaves the tool', () => {
  const h = makeHarness()
  h.tool.start('point')
  assert.deepEqual(h.calls.setTool, ['annotate'])
  assert.equal(h.calls.toast.at(-1), 'annotation.pointStart')

  h.handler().fire(0, { position: { lon: 114.3, lat: 30.5 } })

  assert.equal(h.calls.finish.length, 1)
  const feature = h.calls.finish[0]
  assert.equal(feature.type, 'Feature')
  assert.equal(feature.properties.kind, 'point')
  assert.equal(feature.properties.source, 'manual')
  assert.equal(feature.geometry.type, 'Point')
  const [lon, lat] = feature.geometry.coordinates
  assert.ok(Math.abs(lon - 114.3) < 1e-9)
  assert.ok(Math.abs(lat - 30.5) < 1e-9)
  assert.equal(h.calls.setTool.at(-1), null)
  assert.ok(h.handler().destroyed, 'the draft handler is torn down after finishing')
})

test('a line drops the duplicated double-click vertex and keeps three points', () => {
  const h = makeHarness()
  h.tool.start('line')
  const click = (lon, lat) => h.handler().fire(0, { position: { lon, lat } })
  click(114.3, 30.5)
  click(114.31, 30.5)
  click(114.32, 30.5)
  click(114.32, 30.5) // the double-click lands on the same spot before the event
  h.handler().fire(2, {})

  assert.equal(h.calls.finish.length, 1)
  const feature = h.calls.finish[0]
  assert.equal(feature.geometry.type, 'LineString')
  assert.equal(feature.geometry.coordinates.length, 3)
  assert.ok(Math.abs(feature.geometry.coordinates[2][0] - 114.32) < 1e-9)
})

test('an area closes its ring when finished', () => {
  const h = makeHarness()
  h.tool.start('area')
  const click = (lon, lat) => h.handler().fire(0, { position: { lon, lat } })
  click(114.3, 30.5)
  click(114.31, 30.5)
  click(114.31, 30.51)
  click(114.31, 30.51)
  h.handler().fire(2, {})

  const feature = h.calls.finish[0]
  assert.equal(feature.geometry.type, 'Polygon')
  const ring = feature.geometry.coordinates[0]
  assert.equal(ring.length, 4)
  assert.deepEqual(ring[0], ring.at(-1))
})

test('a double-click with too few vertices warns instead of finishing', () => {
  const h = makeHarness()
  h.tool.start('line')
  h.handler().fire(0, { position: { lon: 114.3, lat: 30.5 } })
  h.handler().fire(2, {})

  assert.equal(h.calls.finish.length, 0)
  assert.equal(h.calls.toast.at(-1), 'annotation.needLine')
  assert.equal(h.calls.setTool.at(-1), 'annotate')
})

test('the second click of an area shows the running vertex count', () => {
  const h = makeHarness()
  h.tool.start('area')
  h.handler().fire(0, { position: { lon: 114.3, lat: 30.5 } })
  h.handler().fire(0, { position: { lon: 114.31, lat: 30.5 } })
  h.handler().fire(0, { position: { lon: 114.31, lat: 30.51 } })
  assert.equal(h.calls.toast.at(-1), 'annotation.areaHint:{"n":3}')
})

test('abort drops the draft without changing the active tool', () => {
  const h = makeHarness()
  h.tool.start('line')
  h.handler().fire(0, { position: { lon: 114.3, lat: 30.5 } })
  assert.ok(h.added.length > 0, 'draft markers were drawn')
  h.calls.setTool.length = 0
  h.tool.abort()
  assert.deepEqual(h.calls.setTool, [])
  assert.equal(h.calls.finish.length, 0)
  assert.ok(h.removed.length > 0)
})

test('cancel drops the draft and hands the canvas back to identify', () => {
  const h = makeHarness()
  h.tool.start('area')
  h.handler().fire(0, { position: { lon: 114.3, lat: 30.5 } })
  h.tool.cancel()
  assert.equal(h.calls.setTool.at(-1), null)
  assert.equal(h.calls.finish.length, 0)
})

test('the annotation strings exist in both languages, including the new entries', () => {
  const keys = [
    'annotation.tool',
    'annotation.toolHint',
    'annotation.drawPoint',
    'annotation.drawLine',
    'annotation.drawArea',
    'annotation.drawHint',
    'annotation.pointStart',
    'annotation.lineStart',
    'annotation.areaStart',
    'annotation.pointHint',
    'annotation.lineHint',
    'annotation.areaHint',
    'annotation.needLine',
    'annotation.needArea',
    'annotation.added',
  ]
  for (const key of keys) {
    assert.equal(typeof ANNOTATION_MESSAGES.zh[key], 'string', `zh ${key}`)
    assert.equal(typeof ANNOTATION_MESSAGES.en[key], 'string', `en ${key}`)
  }
  assert.match(ANNOTATION_MESSAGES.zh['annotation.areaHint'], /\{n\}/)
})
