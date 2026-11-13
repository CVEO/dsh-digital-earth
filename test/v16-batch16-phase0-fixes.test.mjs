/**
 * Phase 0 fixes & structural refactor behavior tests:
 *  1) vector-interaction enables pick/hover/labels under `'identify'` tool mode
 *  2) profile-edit uses root-relative coordinates on paint and pointermove drag
 *  3) vector-export reads `result.distance_m` for exported distance measurements
 *  4) annotation-editor / annotation-actions / vector-renderer support stable `feature_id`
 *     (unnamed/duplicate-name GeoJSON features) and pass `feature` inside GeometryCollection
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const { createVectorInteraction } = await import('../src/client/scene/vector-interaction.js')
const { createProfileEdit } = await import('../src/client/scene/profile-edit.js')
const { collectVectorFeatures } = await import('../src/client/scene/vector-export.js')
const { createAnnotationActions } = await import('../src/client/scene/annotation-actions.js')
const { createAnnotationEditor } = await import('../src/client/scene/annotation-editor.js')
const { findFeatureByTarget } = await import('../src/client/scene/annotation-edit.js')
const { createVectorRenderer } = await import('../src/client/scene/vector-renderer.js')

function makeSignal() {
  const listeners = new Set()
  return {
    addEventListener(fn) { listeners.add(fn) },
    removeEventListener(fn) { listeners.delete(fn) },
    raise(...args) { for (const fn of listeners) fn(...args) },
  }
}

function makeFakeDom() {
  const listeners = new Map()
  const makeEl = (tag) => {
    const children = []
    const elListeners = new Map()
    const classes = new Set()
    const el = {
      tagName: tag.toUpperCase(),
      children,
      style: {},
      dataset: {},
      attributes: new Map(),
      className: '',
      hidden: false,
      disabled: false,
      offsetWidth: 40,
      offsetHeight: 20,
      classList: {
        toggle(name, flag) {
          if (flag) classes.add(name)
          else classes.delete(name)
        },
        has: (name) => classes.has(name),
      },
      append(node) { children.push(node) },
      appendChild(node) { children.push(node); return node },
      remove() {},
      contains(node) { return node === el || children.includes(node) },
      setAttribute(key, value) { el.attributes.set(key, String(value)) },
      addEventListener(type, fn) {
        if (!elListeners.has(type)) elListeners.set(type, [])
        elListeners.get(type).push(fn)
      },
      removeEventListener(type, fn) {
        const list = elListeners.get(type)
        if (!list) return
        const idx = list.indexOf(fn)
        if (idx >= 0) list.splice(idx, 1)
      },
      emit(type, event = {}) {
        for (const fn of elListeners.get(type) ?? []) fn({ preventDefault() {}, stopPropagation() {}, ...event })
      },
    }
    return el
  }
  const fakeDoc = {
    body: makeEl('body'),
    activeElement: null,
    createElement: (tag) => makeEl(tag),
    addEventListener(type, fn, capture) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push({ fn, capture })
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type)
      if (!list) return
      const idx = list.findIndex((item) => item.fn === fn)
      if (idx >= 0) list.splice(idx, 1)
    },
    dispatch(type, event = {}) {
      for (const item of [...(listeners.get(type) ?? [])]) {
        item.fn({ preventDefault() {}, stopPropagation() {}, ...event })
      }
    },
  }
  return { fakeDoc, makeEl }
}

function makeFakeCesium() {
  class Color {
    constructor(r = 1, g = 1, b = 1, a = 1) { Object.assign(this, { red: r, green: g, blue: b, alpha: a }) }
    withAlpha(alpha) { return new Color(this.red, this.green, this.blue, alpha) }
    static fromCssColorString() { return new Color(0.2, 0.6, 0.9, 1) }
    static lerp(left, right, _t, out) { Object.assign(out, left); return out }
  }
  Color.WHITE = new Color(1, 1, 1, 1)
  Color.BLACK = new Color(0, 0, 0, 1)
  return {
    Color,
    Cartesian2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y } },
    Cartesian3: {
      fromDegrees: (lon, lat, height = 0) => ({ lon, lat, height }),
      fromRadians: (lon, lat, height = 0) => ({ lon: (lon * 180) / Math.PI, lat: (lat * 180) / Math.PI, height }),
      fromDegreesArray: (flat) => {
        const out = []
        for (let i = 0; i + 1 < flat.length; i += 2) out.push({ lon: flat[i], lat: flat[i + 1], height: 0 })
        return out
      },
    },
    Cartographic: class Cartographic {
      constructor(longitude = 0, latitude = 0, height = 0) {
        this.longitude = longitude
        this.latitude = latitude
        this.height = height
      }
      static fromDegrees(lon, lat, height = 0) {
        return new Cartographic((lon * Math.PI) / 180, (lat * Math.PI) / 180, height)
      }
      static fromCartesian(pos) {
        return new Cartographic((pos.lon * Math.PI) / 180, (pos.lat * Math.PI) / 180, pos.height ?? 0)
      }
    },
    EllipsoidGeodesic: class {
      constructor(a, b) {
        this.a = a
        this.b = b
        this.surfaceDistance = Math.hypot((b.longitude - a.longitude) * 6371000, (b.latitude - a.latitude) * 6371000)
      }
      interpolateUsingFraction(frac, out = {}) {
        out.longitude = this.a.longitude + (this.b.longitude - this.a.longitude) * frac
        out.latitude = this.a.latitude + (this.b.latitude - this.a.latitude) * frac
        return out
      }
    },
    PolygonHierarchy: class { constructor(positions, holes = []) { this.positions = positions; this.holes = holes } },
    PolylineOutlineMaterialProperty: class { constructor(opts = {}) { Object.assign(this, opts) } },
    PolylineDashMaterialProperty: class { constructor(opts = {}) { Object.assign(this, opts) } },
    ClassificationType: { BOTH: 1 },
    ArcType: { NONE: 0 },
    LabelStyle: { FILL: 0 },
    HeightReference: { CLAMP_TO_GROUND: 1 },
    VerticalOrigin: { BOTTOM: 1 },
    Math: { toDegrees: (rad) => (rad * 180) / Math.PI },
    EllipsoidalOccluder: class { constructor() {} isPointVisible() { return true } },
    SceneTransforms: { worldToWindowCoordinates: (_scene, pos) => ({ x: pos?.x ?? 50, y: pos?.y ?? 50 }) },
  }
}

test('Bug 1：vector-interaction 在默认 identify 模式下响应点选与悬停，测量模式下禁用', () => {
  const { fakeDoc, makeEl } = makeFakeDom()
  const prevDoc = globalThis.document
  globalThis.document = fakeDoc
  try {
    const Cesium = makeFakeCesium()
    const root = makeEl('div')
    root.ownerDocument = fakeDoc
    const canvas = makeEl('canvas')
    canvas.clientWidth = 800
    canvas.clientHeight = 600
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
    const entities = []
    const viewer = {
      canvas,
      clock: { currentTime: 0 },
      camera: { positionWC: { x: 0, y: 0, z: 7000000 }, moveStart: makeSignal(), moveEnd: makeSignal() },
      scene: {
        globe: { ellipsoid: {} },
        postRender: makeSignal(),
        requestRender() {},
        pick: () => ({ id: entities[0] }),
        drillPick: () => [],
      },
      entities: {
        collectionChanged: makeSignal(),
        add: (options) => {
          const entity = { ...options, id: undefined }
          entities.push(entity)
          return entity
        },
      },
    }
    let currentTool = 'identify'
    const selected = []
    const interaction = createVectorInteraction({
      Cesium,
      viewer,
      root,
      onSelect: (desc) => selected.push(desc),
      getTool: () => currentTool,
    })
    const descriptor = { group: {}, kind: 'drawn', title: '区域 A', summary: 'Polygon' }
    interaction.add({ polygon: { hierarchy: {} } }, descriptor)

    // Default 'identify' mode must allow picking and trigger onSelect.
    assert.equal(interaction.click({ x: 100, y: 100 }), true)
    assert.equal(selected.length, 1)
    assert.equal(selected[0].title, '区域 A')

    // Other interactive modes like 'distance' must stay isolated.
    currentTool = 'distance'
    assert.equal(interaction.click({ x: 100, y: 100 }), false)
    assert.equal(selected.length, 1)
    interaction.dispose()
  } finally {
    globalThis.document = prevDoc
  }
})

test('Bug 2：profile-edit 手柄在 root 与 canvas 偏移时使用相对 root 的坐标', () => {
  const { fakeDoc, makeEl } = makeFakeDom()
  const prevDoc = globalThis.document
  globalThis.document = fakeDoc
  try {
    const Cesium = makeFakeCesium()
    const root = makeEl('div')
    root.getBoundingClientRect = () => ({ left: 400, top: 80, width: 500, height: 600 })
    const canvas = makeEl('canvas')
    canvas.getBoundingClientRect = () => ({ left: 420, top: 100, width: 460, height: 560 })
    const viewer = {
      scene: {
        canvas,
        postRender: makeSignal(),
        requestRender() {},
        cartesianToCanvasCoordinates: (pos) => (pos.lon < 114.35 ? { x: 100, y: 200 } : { x: 300, y: 250 }),
      },
      entities: { remove() {} },
    }
    const controller = createProfileEdit({
      getCesium: () => Cesium,
      getViewer: () => viewer,
      getRoot: () => root,
      pickSurface: () => ({ lon: 114.36, lat: 30.52, height: 10 }),
      onRecompute: () => {},
      showToast: () => {},
      t: (k) => k,
    })
    controller.sync({
      operation: 'profile',
      result: {
        from: [114.3, 30.5],
        to: [114.4, 30.6],
        points: [{ distance_m: 0, height_m: 10 }, { distance_m: 100, height_m: 20 }],
      },
    })
    const layer = root.children[0]
    assert.equal(layer.children.length, 2)
    // canvas offset relative to root is (+20, +20); handle 0 screen (100, 200) -> 120 - 6.5, 220 - 6.5
    assert.equal(layer.children[0].style.transform, 'translate(113.5px, 213.5px)')

    // Drag start & pointermove at viewport clientX=520, clientY=280 -> root-relative (120, 200) -> 113.5, 193.5
    layer.children[0].emit('pointerdown', { clientX: 520, clientY: 280 })
    fakeDoc.dispatch('pointermove', { clientX: 520, clientY: 280 })
    assert.equal(layer.children[0].style.transform, 'translate(113.5px, 193.5px)')
    fakeDoc.dispatch('pointerup', { clientX: 520, clientY: 280 })
    controller.dispose()
  } finally {
    globalThis.document = prevDoc
  }
})

test('Bug 3：collectVectorFeatures 从 measure 命令读取 distance_m', () => {
  const state = {
    drawCommands: [],
    measureCommands: [
      {
        mode: 'distance',
        draw: true,
        points: [[114.3, 30.5], [114.31, 30.51]],
        result: { mode: 'distance', points: 2, drawn: true, distance_m: 1472.5 },
      },
    ],
  }
  const collected = collectVectorFeatures(state)
  assert.equal(collected.ok, true)
  assert.equal(collected.features.length, 1)
  assert.equal(collected.features[0].properties.distance_m, 1472.5)
})

test('Bug 4：未命名与重名 GeoJSON 要素通过稳定 feature_id 独立编辑和撤销，GeometryCollection 子描述符携带 feature', () => {
  const { fakeDoc, makeEl } = makeFakeDom()
  const prevDoc = globalThis.document
  globalThis.document = fakeDoc
  try {
    const Cesium = makeFakeCesium()
    const root = makeEl('div')
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
    const canvas = makeEl('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
    const viewer = {
      scene: { canvas, postRender: makeSignal(), requestRender() {}, cartesianToCanvasCoordinates: () => ({ x: 50, y: 50 }) },
      entities: { remove() {} },
    }
    const state = {
      draw: [],
      measure: [],
      drawCommands: [],
      measureCommands: [],
      drawnFeatures: 0,
      measuredCount: 0,
      entityGroups: new WeakMap(),
    }
    const addedDescriptors = []
    const vectorStub = {
      add: (opts, desc) => {
        addedDescriptors.push(desc)
        return { ...opts }
      },
      refresh: () => {},
    }
    const renderer = createVectorRenderer({
      getState: () => state,
      getVector: () => vectorStub,
      t: (k) => k,
      markSceneDirty: () => {},
      syncOverlayCount: () => {},
    })

    // Render 2 unnamed polygons + 1 GeometryCollection
    const geojson = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.31, 30.5], [114.31, 30.51], [114.3, 30.5]]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[114.5, 30.5], [114.51, 30.5], [114.51, 30.51], [114.5, 30.5]]] } },
        {
          type: 'Feature',
          properties: { note: 'combo' },
          geometry: {
            type: 'GeometryCollection',
            geometries: [
              { type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [114.4, 30.5] }] },
            ],
          },
        },
      ],
    }
    const summary = renderer.drawAgentOverlay(Cesium, viewer, geojson, 'accent', 'import')
    assert.equal(summary.drawn, 3)

    const drawnFeatures = state.drawCommands[0].geojson.features
    const id0 = drawnFeatures[0].properties.feature_id
    const id1 = drawnFeatures[1].properties.feature_id
    assert.ok(id0 && id1 && id0 !== id1, 'each unnamed feature receives a distinct feature_id')

    // GeometryCollection nested child descriptor must still reference its parent feature
    const childDescriptor = addedDescriptors.find((d) => d.summary === 'vector.geometry.Point')
    assert.ok(childDescriptor?.feature?.properties?.feature_id)

    const actions = createAnnotationActions({
      stateRef: { current: state },
      viewerRef: { current: viewer },
      getSelection: () => null,
      draw: (g, s, c) => renderer.drawAgentOverlay(Cesium, viewer, g, s, c),
      showToast: () => {},
      t: (k) => k,
    })

    const editor = createAnnotationEditor({
      getCesium: () => Cesium,
      getViewer: () => viewer,
      getRoot: () => root,
      pickSurface: () => null,
      updateGeometry: (target) => actions.geometry(target),
      showToast: () => {},
      t: (k) => k,
    })

    // Focus the second unnamed polygon — must succeed even without a name!
    assert.equal(editor.focus({ feature: drawnFeatures[1] }), true)
    const foundTarget = findFeatureByTarget(state, { id: id1 })
    assert.equal(foundTarget.index, 1)

    // Patch second unnamed polygon via actions.geometry({ id }) and verify first is untouched
    const moved = { type: 'Polygon', coordinates: [[[114.52, 30.52], [114.53, 30.52], [114.53, 30.53], [114.52, 30.52]]] }
    assert.equal(actions.geometry({ id: id1, geometry: moved }), true)
    assert.deepEqual(state.drawCommands[0].geojson.features[0].geometry, drawnFeatures[0].geometry)
    assert.deepEqual(state.drawCommands[0].geojson.features[1].geometry, moved)
    editor.dispose()
  } finally {
    globalThis.document = prevDoc
  }
})
