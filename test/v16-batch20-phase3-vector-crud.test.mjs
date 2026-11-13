/**
 * v1.6 Phase 3 (P3-2) — Vertex-edit continuity (selectByFeature + Ctrl+Z undo),
 * Point coordinate editing, Custom GeoJSON attribute CRUD, per-overlay & per-feature
 * vector browser in LayersMap, per-overlay/feature chat export, and i18n parity.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const ReactModule = await import('react')
const React = ReactModule.default
const { MESSAGES } = await import('../src/client/messages.js')
const { ANNOTATION_MESSAGES } = await import('../src/client/messages-annotations.js')
const { EXPORT_MESSAGES } = await import('../src/client/messages-export.js')
const {
  annotationFeatureId,
  extractCustomAttributes,
  withAnnotationProperties,
} = await import('../src/client/scene/annotation-model.js')
const { createAnnotationActions } = await import('../src/client/scene/annotation-actions.js')
const { createAnnotationEditor } = await import('../src/client/scene/annotation-editor.js')
const {
  buildAgentOverlayDetails,
  buildAgentOverlayList,
  flyToOverlayFeature,
  overlayFeatureList,
} = await import('../src/client/scene/agent-overlays.js')
const { createVectorInteraction } = await import('../src/client/scene/vector-interaction.js')
const { createVectorRenderer } = await import('../src/client/scene/vector-renderer.js')
const { createVectorExport } = await import('../src/client/scene/vector-export-service.js')
const { LayersMap } = await import('../src/client/ui/layers-map.js')
const { VectorCard } = await import('../src/client/ui/vector-card.js')
const { ToolsPanel } = await import('../src/client/ui/tools-panel.js')

function tZh(key, params) {
  let text = MESSAGES.zh[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v))
  }
  return text
}

function makeSignal() {
  const listeners = new Set()
  return {
    addEventListener(fn) { listeners.add(fn) },
    removeEventListener(fn) { listeners.delete(fn) },
    raise(...args) { for (const fn of listeners) fn(...args) },
  }
}

function makeFakeDom() {
  let fakeDoc
  const docListeners = new Map()
  const makeEl = (tag) => {
    const children = []
    const elListeners = new Map()
    const classes = new Set()
    const el = {
      tagName: tag.toUpperCase(),
      get ownerDocument() { return fakeDoc },
      children,
      dataset: {},
      attributes: new Map(),
      className: '',
      textContent: '',
      hidden: false,
      disabled: false,
      isConnected: true,
      offsetWidth: 64,
      offsetHeight: 22,
      style: {
        setProperty(k, v) { el.style[k] = v },
      },
      classList: {
        toggle(name, flag) {
          if (flag) classes.add(name)
          else classes.delete(name)
        },
        contains: (name) => classes.has(name),
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      closest: (selector) => (selector === '.mv-root' ? fakeDoc.root : null),
      append(node) { children.push(node) },
      appendChild(node) { children.push(node); return node },
      remove() { el.isConnected = false },
      contains(node) { return node === el || children.includes(node) },
      setAttribute(k, v) { el.attributes.set(k, String(v)) },
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
        for (const fn of elListeners.get(type) ?? []) {
          fn({ preventDefault() {}, stopPropagation() {}, ...event })
        }
      },
    }
    return el
  }
  fakeDoc = {
    body: null,
    activeElement: null,
    root: null,
    createElement: (tag) => makeEl(tag),
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, [])
      docListeners.get(type).push(fn)
    },
    removeEventListener(type, fn) {
      const list = docListeners.get(type)
      if (!list) return
      const idx = list.indexOf(fn)
      if (idx >= 0) list.splice(idx, 1)
    },
    emit(type, event = {}) {
      for (const fn of [...(docListeners.get(type) ?? [])]) {
        fn({ preventDefault() {}, stopPropagation() {}, ...event })
      }
    },
  }
  fakeDoc.body = makeEl('body')
  fakeDoc.root = makeEl('div')
  return { fakeDoc, makeEl }
}

function makeFakeCesium() {
  class Color {
    constructor(css = 'white', alpha = 1) {
      this.css = css
      this.alpha = alpha
    }
    clone() { return new Color(this.css, this.alpha) }
    withAlpha(alpha) { return new Color(this.css, alpha) }
    static fromCssColorString(css) { return new Color(css, 1) }
    static lerp(a, _b, _t, result) {
      const target = result ?? new Color()
      target.css = a?.css ?? 'white'
      target.alpha = a?.alpha ?? 1
      return target
    }
  }
  Color.WHITE = new Color('#ffffff', 1)
  Color.BLACK = new Color('#000000', 1)

  return {
    Color,
    Math: {
      toDegrees: (rad) => (rad * 180) / Math.PI,
      toRadians: (deg) => (deg * Math.PI) / 180,
    },
    Rectangle: {
      fromDegrees: (w, s, e, n) => ({ west: w, south: s, east: e, north: n }),
    },
    Cartesian2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y } },
    Cartesian3: {
      distance: (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0), (a?.z ?? 0) - (b?.z ?? 0)),
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
        return new Cartographic(((pos?.lon ?? 0) * Math.PI) / 180, ((pos?.lat ?? 0) * Math.PI) / 180, pos?.height ?? 0)
      }
    },
    EllipsoidalOccluder: class { isPointVisible() { return true } },
    SceneTransforms: {
      worldToWindowCoordinates: (_scene, pos) => ({ x: (pos.lon - 114) * 1000, y: (pos.lat - 30) * 1000 }),
    },
    CallbackProperty: class { constructor(fn) { this.getValue = fn } },
    PolygonHierarchy: class { constructor(positions, holes = []) { this.positions = positions; this.holes = holes } },
    PolylineOutlineMaterialProperty: class { constructor(opts = {}) { Object.assign(this, opts) } },
    PolylineDashMaterialProperty: class { constructor(opts = {}) { Object.assign(this, opts) } },
    ClassificationType: { BOTH: 1 },
    ArcType: { NONE: 0 },
    LabelStyle: { FILL: 0, OUTLINE: 1, FILL_AND_OUTLINE: 2 },
    VerticalOrigin: { BOTTOM: 1, CENTER: 0 },
    HeightReference: { CLAMP_TO_GROUND: 1, RELATIVE_TO_GROUND: 2 },
  }
}

function makeFakeViewer({ flyCalls } = {}) {
  const collectionChanged = makeSignal()
  const list = []
  return {
    canvas: {
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    },
    scene: {
      canvas: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      },
      globe: {
        ellipsoid: {},
        getHeight: () => 0,
      },
      screenSpaceCameraController: { enableInputs: true },
      postRender: makeSignal(),
      requestRender() {},
      cartesianToCanvasCoordinates: (pos) => ({ x: (pos.lon - 114) * 1000, y: (pos.lat - 30) * 1000 }),
      pick() { return null },
      drillPick() { return [] },
    },
    clock: { currentTime: 0 },
    camera: {
      positionWC: { x: 0, y: 0, z: 0 },
      moveStart: makeSignal(),
      moveEnd: makeSignal(),
      flyTo(opts) { if (flyCalls) flyCalls.push(opts) },
    },
    entities: {
      collectionChanged,
      add(opts) {
        const entity = { ...opts }
        list.push(entity)
        return entity
      },
      remove(entity) {
        const idx = list.indexOf(entity)
        if (idx >= 0) {
          list.splice(idx, 1)
          collectionChanged.raise(list, [], [entity])
        }
      },
    },
  }
}

function createRenderer(renderFn) {
  const states = []
  const refs = []
  const memos = []
  const effects = []
  let tree = null
  const prev = {
    useState: React.useState,
    useRef: React.useRef,
    useMemo: React.useMemo,
    useEffect: React.useEffect,
    useCallback: React.useCallback,
  }
  const depsChanged = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))

  const render = () => {
    let stateIdx = 0
    let refIdx = 0
    let memoIdx = 0
    let effectIdx = 0
    const pendingEffects = []

    React.useState = (init) => {
      const idx = stateIdx++
      if (!(idx in states)) states[idx] = typeof init === 'function' ? init() : init
      const setState = (updater) => {
        const nextVal = typeof updater === 'function' ? updater(states[idx]) : updater
        if (!Object.is(nextVal, states[idx])) {
          states[idx] = nextVal
          render()
        }
      }
      return [states[idx], setState]
    }
    React.useRef = (init) => {
      const idx = refIdx++
      if (!(idx in refs)) refs[idx] = { current: init }
      return refs[idx]
    }
    React.useMemo = (factory, deps) => {
      const idx = memoIdx++
      if (!memos[idx] || depsChanged(deps, memos[idx].deps)) {
        memos[idx] = { deps, value: factory() }
      }
      return memos[idx].value
    }
    React.useCallback = (fn, deps) => React.useMemo(() => fn, deps)
    React.useEffect = (effect, deps) => {
      const idx = effectIdx++
      const prevEntry = effects[idx]
      if (!prevEntry || depsChanged(deps, prevEntry.deps)) {
        pendingEffects.push({ idx, effect, deps, prevCleanup: prevEntry?.cleanup })
      }
    }

    tree = renderFn()
    for (const item of pendingEffects) {
      if (typeof item.prevCleanup === 'function') item.prevCleanup()
      const slot = { deps: item.deps, cleanup: undefined }
      effects[item.idx] = slot
      slot.cleanup = item.effect()
    }
    return tree
  }

  render()
  return {
    getTree: () => tree,
    rerender: () => render(),
    cleanup() {
      for (const entry of effects) {
        if (typeof entry?.cleanup === 'function') entry.cleanup()
      }
      Object.assign(React, prev)
    },
  }
}

function findNodes(node, predicate, out = []) {
  if (!node) return out
  if (Array.isArray(node)) {
    for (const child of node) findNodes(child, predicate, out)
    return out
  }
  if (typeof node === 'object') {
    if (predicate(node)) out.push(node)
    if (Array.isArray(node.children)) findNodes(node.children, predicate, out)
  }
  return out
}

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object') return textOf(node.children)
  return ''
}

// ---------------------------------------------------------------------------
// 1. annotation-model: custom GeoJSON attributes CRUD & complex object safety
// ---------------------------------------------------------------------------

test('annotation-model：自定义扩展属性提取、增删改查、保留结构化对象与非法键拒绝', () => {
  const baseFeature = {
    type: 'Feature',
    properties: {
      feature_id: 'f-attr-1',
      name: '林地斑块',
      kind: 'area',
      style: 'success',
      source: 'manual',
      provenance: 'vision',
      owner: '调查一队',
      area_ha: 12.5,
      verified: true,
      meta: { sensor: 'GF-2', bands: [1, 2, 3] },
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[114.3, 30.5], [114.31, 30.5], [114.31, 30.51], [114.3, 30.5]]],
    },
  }

  const extracted = extractCustomAttributes(baseFeature)
  assert.deepEqual(
    extracted.map((a) => ({ key: a.key, editable: a.editable, text: a.text })),
    [
      { key: 'owner', editable: true, text: '调查一队' },
      { key: 'area_ha', editable: true, text: '12.5' },
      { key: 'verified', editable: true, text: 'true' },
      { key: 'meta', editable: false, text: '{"sensor":"GF-2","bands":[1,2,3]}' },
    ],
  )

  // Modify owner + area_ha + verified, delete owner? No, replace full custom set: drop owner, add landuse, keep meta verbatim
  const updated = withAnnotationProperties(baseFeature, {
    attributes: [
      { key: 'area_ha', value: '18.25' },
      { key: 'verified', value: 'false' },
      { key: 'landuse', value: '常绿阔叶林' },
      { key: 'meta', preserveObject: true },
    ],
  })
  assert.equal(updated.ok, true)
  const nextProps = updated.feature.properties
  assert.equal(nextProps.owner, undefined)
  assert.equal(nextProps.area_ha, 18.25)
  assert.equal(nextProps.verified, false)
  assert.equal(nextProps.landuse, '常绿阔叶林')
  assert.deepEqual(nextProps.meta, { sensor: 'GF-2', bands: [1, 2, 3] })
  // System & reserved properties stay untouched
  assert.equal(nextProps.feature_id, 'f-attr-1')
  assert.equal(nextProps.source, 'manual')
  assert.equal(nextProps.provenance, 'vision')

  // Reject invalid/reserved/duplicate keys
  assert.equal(withAnnotationProperties(baseFeature, { attributes: [{ key: '  ', value: 'x' }] }).error, 'invalid_attribute_key')
  assert.equal(withAnnotationProperties(baseFeature, { attributes: [{ key: 'provenance', value: 'fake' }] }).error, 'reserved_attribute_key')
  assert.equal(withAnnotationProperties(baseFeature, { attributes: [{ key: 'name', value: 'dup' }] }).error, 'reserved_attribute_key')
  assert.equal(
    withAnnotationProperties(baseFeature, { attributes: [{ key: 'tag', value: '1' }, { key: 'tag', value: '2' }] }).error,
    'duplicate_attribute_key',
  )
})

// ---------------------------------------------------------------------------
// 2. Vertex edit selection & Ctrl+Z undo continuity across replays
// ---------------------------------------------------------------------------

test('selectByFeature + annotationEditor：连续拖顶点回放保持选中且 Ctrl+Z 逐步撤销', () => {
  const { fakeDoc } = makeFakeDom()
  const prevDocument = globalThis.document
  globalThis.document = fakeDoc
  try {
    const Cesium = makeFakeCesium()
    const viewer = makeFakeViewer()
    const state = {
      draw: [],
      measure: [],
      drawnFeatures: 0,
      measuredCount: 0,
      drawCommands: [],
      measureCommands: [],
      entityGroups: new WeakMap(),
    }
    let selection = null
    let currentTool = 'annotate' // Programmatic selectByFeature works even while annotation tool is active
    const vector = createVectorInteraction({
      Cesium,
      viewer,
      root: fakeDoc.root,
      getTool: () => currentTool,
      onSelect: (sel) => { selection = sel },
    })
    const renderer = createVectorRenderer({
      getState: () => state,
      getVector: () => vector,
      t: tZh,
      markSceneDirty() {},
      syncOverlayCount() {},
    })
    const toasts = []
    let editor
    const actions = createAnnotationActions({
      stateRef: { current: state },
      viewerRef: { current: viewer },
      getSelection: () => selection,
      draw: (geojson, style, caption) => renderer.drawAgentOverlay(Cesium, viewer, geojson, style, caption),
      showToast: (msg) => toasts.push(msg),
      t: tZh,
      onChanged: (event) => {
        if ((event?.action === 'geometry' || event?.action === 'update') && event.command && event.feature) {
          assert.equal(vector.selectByFeature(event.command, event.feature), true)
        } else {
          vector.clearSelection()
        }
        editor.focus(selection)
      },
    })
    editor = createAnnotationEditor({
      getCesium: () => Cesium,
      getViewer: () => viewer,
      getRoot: () => fakeDoc.root,
      pickSurface: (pos) => ({ lon: 114 + pos.x / 1000, lat: 30 + pos.y / 1000, height: 0 }),
      updateGeometry: actions.geometry,
      showToast: (msg) => toasts.push(msg),
      t: tZh,
    })

    // Draw initial triangle polygon
    assert.equal(
      actions.add({
        type: 'Feature',
        properties: { kind: 'area', style: 'accent' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[114.2, 30.2], [114.4, 30.2], [114.4, 30.4], [114.2, 30.2]]],
        },
      }),
      true,
    )
    const initialCmd = state.drawCommands[0]
    const initialFeat = initialCmd.geojson.features[0]
    const featId = annotationFeatureId(initialFeat)
    assert.ok(featId !== '')

    // Select feature and verify editor focuses + places 3 vertex + 1 center handle
    assert.equal(vector.selectByFeature(initialCmd, initialFeat), true)
    assert.ok(selection)
    assert.equal(editor.focus(selection), true)
    let layer = fakeDoc.root.children.at(-1)
    assert.equal(layer.children.length, 4)

    // Drag 1: move vertex 0 to [114.25, 30.25]
    layer.children[0].emit('pointerdown', { button: 0, clientX: 200, clientY: 200 })
    fakeDoc.emit('pointermove', { clientX: 250, clientY: 250 })
    fakeDoc.emit('pointerup', {})
    assert.ok(selection, '第1次拖顶点回放后选中态应保持')
    assert.ok(Math.abs(selection.feature.geometry.coordinates[0][0][0] - 114.25) < 1e-6)

    // Drag 2: move vertex 1 to [114.48, 30.22]
    layer = fakeDoc.root.children.at(-1)
    layer.children[1].emit('pointerdown', { button: 0, clientX: 400, clientY: 200 })
    fakeDoc.emit('pointermove', { clientX: 480, clientY: 220 })
    fakeDoc.emit('pointerup', {})
    assert.ok(selection, '第2次拖顶点回放后选中态应继续保持')
    assert.ok(Math.abs(selection.feature.geometry.coordinates[0][1][0] - 114.48) < 1e-6)

    // Rename in VectorCard without losing vertex undo history
    assert.equal(actions.update({ name: '改名研究区' }), true)
    assert.equal(selection.feature.properties.name, '改名研究区')

    // Ctrl+Z undo #1 -> reverts Drag 2, preserves Drag 1 + new name
    fakeDoc.emit('keydown', { key: 'z', ctrlKey: true, target: fakeDoc.root })
    assert.ok(Math.abs(selection.feature.geometry.coordinates[0][1][0] - 114.4) < 1e-6)
    assert.ok(Math.abs(selection.feature.geometry.coordinates[0][0][0] - 114.25) < 1e-6)
    assert.equal(selection.feature.properties.name, '改名研究区')

    // Ctrl+Z undo #2 -> reverts Drag 1 back to original [114.2, 30.2]
    fakeDoc.emit('keydown', { key: 'z', ctrlKey: true, target: fakeDoc.root })
    assert.ok(Math.abs(selection.feature.geometry.coordinates[0][0][0] - 114.2) < 1e-6)

    // Ctrl+Z when empty shows nothingToUndo
    fakeDoc.emit('keydown', { key: 'z', ctrlKey: true, target: fakeDoc.root })
    assert.equal(toasts.at(-1), tZh('annotation.nothingToUndo'))

    editor.dispose()
    vector.dispose()
  } finally {
    globalThis.document = prevDocument
  }
})

// ---------------------------------------------------------------------------
// 3. agent-overlays details/flyToFeature + annotation-actions.removeFeature
// ---------------------------------------------------------------------------

test('agent-overlays & annotation-actions：明细列表提取、单要素飞往、单要素删除不误删同层兄弟要素', () => {
  const Cesium = makeFakeCesium()
  const flyCalls = []
  const viewer = makeFakeViewer({ flyCalls })
  const state = {
    draw: [],
    measure: [],
    drawnFeatures: 0,
    measuredCount: 0,
    drawCommands: [],
    measureCommands: [],
    entityGroups: new WeakMap(),
  }
  const vector = createVectorInteraction({ Cesium, viewer, root: makeFakeDom().fakeDoc.root, getTool: () => 'identify', onSelect() {} })
  const renderer = createVectorRenderer({
    getState: () => state,
    getVector: () => vector,
    t: tZh,
    markSceneDirty() {},
    syncOverlayCount() {},
  })

  const fc = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'A区', kind: 'area', style: 'warm' },
        geometry: { type: 'Polygon', coordinates: [[[114.1, 30.1], [114.2, 30.1], [114.2, 30.2], [114.1, 30.1]]] },
      },
      {
        type: 'Feature',
        properties: { kind: 'point', style: 'alert' },
        geometry: { type: 'Point', coordinates: [114.3, 30.3] },
      },
    ],
  }
  renderer.drawAgentOverlay(Cesium, viewer, fc, 'accent', 'GeoJSON: survey.geojson')

  // Locked 5-key shape check
  const summaryRows = buildAgentOverlayList(state)
  assert.deepEqual(Object.keys(summaryRows[0]).sort(), ['detail', 'id', 'index', 'kind', 'label'])

  const details = buildAgentOverlayDetails(state)
  assert.equal(details[0].length, 2)
  assert.deepEqual(details[0].map((item) => ({
    featureIndex: item.featureIndex,
    name: item.name,
    geometryType: item.geometryType,
    kind: item.kind,
    style: item.style,
  })), [
    { featureIndex: 0, name: 'A区', geometryType: 'Polygon', kind: 'area', style: 'warm' },
    { featureIndex: 1, name: null, geometryType: 'Point', kind: 'point', style: 'alert' },
  ])

  // Fly to single point feature
  assert.equal(flyToOverlayFeature(viewer, Cesium, state.drawCommands[0].geojson.features[1]), true)
  assert.equal(flyCalls.length, 1)

  const toasts = []
  const actions = createAnnotationActions({
    stateRef: { current: state },
    viewerRef: { current: viewer },
    getSelection: () => null,
    draw: (geojson, style, caption) => renderer.drawAgentOverlay(Cesium, viewer, geojson, style, caption),
    showToast: (msg) => toasts.push(msg),
    t: tZh,
    onChanged() {},
  })

  // Delete index 1 -> index 0 remains intact
  assert.equal(actions.removeFeature(0, 1), true)
  assert.equal(state.drawCommands.length, 1)
  assert.equal(state.drawCommands[0].geojson.features.length, 1)
  assert.equal(state.drawCommands[0].geojson.features[0].properties.name, 'A区')

  // Delete remaining feature -> overlay removed cleanly
  assert.equal(actions.removeFeature(0, 0), true)
  assert.equal(state.drawCommands.length, 0)
  assert.equal(actions.removeFeature(0, 0), false)
  assert.match(toasts.at(-1), /feature_not_found/)
  vector.dispose()
})

// ---------------------------------------------------------------------------
// 4. vector-export-service: downloadOverlay / sendOverlay / sendFeature
// ---------------------------------------------------------------------------

test('vector-export-service：按层下载、按层发送对话附件与单要素发送及降级通知', async () => {
  const f1 = {
    type: 'Feature',
    properties: { name: '区1', kind: 'area', source: 'manual' },
    geometry: { type: 'Polygon', coordinates: [[[114.1, 30.1], [114.2, 30.1], [114.2, 30.2], [114.1, 30.1]]] },
  }
  const f2 = {
    type: 'Feature',
    properties: { name: '点2', kind: 'point', source: 'manual' },
    geometry: { type: 'Point', coordinates: [114.5, 30.5] },
  }
  const stateRef = {
    current: {
      drawCommands: [
        { geojson: { type: 'FeatureCollection', features: [f1] }, style: 'accent', caption: 'GeoJSON: site_a.geojson' },
        { geojson: { type: 'FeatureCollection', features: [f2] }, style: 'warm', caption: '点位图层' },
      ],
      measureCommands: [],
    },
  }
  const toasts = []
  const requests = []
  const downloads = []
  const prevDoc = globalThis.document
  globalThis.document = {
    body: {
      appendChild(el) { downloads.push({ filename: el.download, href: el.href }) },
      removeChild() {},
    },
    createElement: () => ({ style: {}, click() {}, remove() {} }),
  }
  const prevCreate = globalThis.URL?.createObjectURL
  const prevRevoke = globalThis.URL?.revokeObjectURL
  let createdBlobs = []
  if (globalThis.URL) {
    globalThis.URL.createObjectURL = (blob) => { createdBlobs.push(blob); return 'blob://mock' }
    globalThis.URL.revokeObjectURL = () => {}
  }

  let currentMeta = { exportVectorChatUrl: '/export/vector/chat', exportVectorUrl: '/export/vector', injectUrl: '/inject' }
  const service = createVectorExport({
    stateRef,
    getMeta: () => currentMeta,
    getSession: () => 'sess-p32',
    showToast: (m) => toasts.push(m),
    t: tZh,
    fetchImpl: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) })
      if (url === '/export/vector/chat') return { ok: true, json: async () => ({ path: 'C:/exp/out.geojson', injected: true, attached: true }) }
      if (url === '/export/vector') return { ok: true, json: async () => ({ path: 'C:/exp/fallback.geojson' }) }
      return { ok: true, json: async () => ({ ok: true }) }
    },
  })

  try {
    // 1) downloadOverlay(0)
    assert.equal(service.downloadOverlay(0), true)
    assert.equal(downloads[0].filename, 'site_a.geojson.geojson')
    assert.equal(toasts.at(-1), tZh('vectorExport.downloaded', { count: 1 }))

    // 2) sendOverlay(1) via attachment route
    const r1 = await service.sendOverlay(1)
    assert.equal(r1.attached, true)
    assert.equal(requests[0].url, '/export/vector/chat')
    assert.equal(requests[0].body.name, '点位图层')
    assert.equal(requests[0].body.features.length, 1)
    assert.equal(requests[0].body.features[0].properties.name, '点2')
    assert.equal(toasts.at(-1), tZh('vectorExport.sentAttached', { count: 1 }))

    // 3) sendFeature fallback when host has no attachment route
    currentMeta = { exportVectorUrl: '/export/vector', injectUrl: '/inject' }
    const r2 = await service.sendFeature(f1, '区1')
    assert.equal(r2.path, 'C:/exp/fallback.geojson')
    assert.equal(requests[1].url, '/export/vector')
    assert.equal(requests[1].body.name, '区1')
    assert.equal(requests[2].url, '/inject')
    assert.equal(toasts.at(-1), tZh('vectorExport.sent', { count: 1 }))
  } finally {
    globalThis.document = prevDoc
    if (globalThis.URL) {
      globalThis.URL.createObjectURL = prevCreate
      globalThis.URL.revokeObjectURL = prevRevoke
    }
  }
})

// ---------------------------------------------------------------------------
// 5. UI: LayersMap feature list + quick draw, ToolsPanel openRequest, VectorCard CRUD
// ---------------------------------------------------------------------------

test('LayersMap：展开要素列表、按层导出/发对话、点选/飞往/删除单要素与 +绘制标注入口', () => {
  const calls = []
  const r = createRenderer(() =>
    LayersMap({
      t: tZh,
      config: { imagery: [{ id: 'osm', name: 'OSM' }], rasterOverlays: [] },
      settings: { imagery: 'osm' },
      onSelectImagery() {},
      onOverlayAdd() {},
      onOverlayRemove() {},
      onOverlayOpacity() {},
      onOverlayVisible() {},
      onOverlayMove() {},
      agentOverlays: [{ id: 'draw-0', kind: 'draw', index: 0, label: 'GeoJSON: plot.geojson', detail: '2 要素' }],
      overlayDetails: {
        0: [
          { featureIndex: 0, featureId: 'f0', name: '农田1', geometryType: 'Polygon', kind: 'area', style: 'warm' },
          { featureIndex: 1, featureId: 'f1', name: null, geometryType: 'Point', kind: 'point', style: 'alert' },
        ],
      },
      annotations: { drawn_features: 2, measured_points: 0 },
      onQuickAnnotate: () => calls.push(['quickAnnotate']),
      onSelectAgentFeature: (o, f) => calls.push(['select', o, f]),
      onFlyAgentFeature: (o, f) => calls.push(['flyFeat', o, f]),
      onRemoveAgentFeature: (o, f) => calls.push(['removeFeat', o, f]),
      onFlyAgentOverlay: (k, i) => calls.push(['flyOverlay', k, i]),
      onRemoveAgentOverlay: (k, i) => calls.push(['removeOverlay', k, i]),
      vectorExport: {
        canSend: () => true,
        download() { calls.push(['downloadAll']) },
        send() { calls.push(['sendAll']) },
        downloadOverlay(i) { calls.push(['downloadOverlay', i]) },
        sendOverlay(i) { calls.push(['sendOverlay', i]) },
      },
    }),
  )
  try {
    // Subactions include both 导入矢量 & + 绘制标注
    const quickBtn = findNodes(r.getTree(), (n) => n.type === 'button' && textOf(n) === tZh('annotation.quickDraw'))[0]
    assert.ok(quickBtn)
    quickBtn.props.onClick()

    // Per-overlay download & send-to-chat
    const dlOverlayBtn = findNodes(r.getTree(), (n) => n.type === 'button' && n.props?.title === tZh('layers.overlayExportHint'))[0]
    const sendOverlayBtn = findNodes(r.getTree(), (n) => n.type === 'button' && n.props?.title === tZh('layers.overlayChatHint'))[0]
    assert.ok(dlOverlayBtn && sendOverlayBtn)
    dlOverlayBtn.props.onClick()
    sendOverlayBtn.props.onClick()

    // Expand feature rows
    const toggleBtn = findNodes(r.getTree(), (n) => n.type === 'button' && String(n.props?.className).includes('mv-overlay-toggle'))[0]
    assert.ok(toggleBtn)
    toggleBtn.props.onClick()

    const picks = findNodes(r.getTree(), (n) => n.type === 'button' && String(n.props?.className).includes('mv-overlay-feature-pick'))
    assert.equal(picks.length, 2)
    assert.match(textOf(picks[0]), /农田1.*Polygon/)
    assert.match(textOf(picks[1]), /要素 #2.*Point/)
    picks[0].props.onClick()

    const featRows = findNodes(r.getTree(), (n) => n.props?.className === 'mv-overlay-feature')
    const btns1 = findNodes(featRows[1], (n) => n.type === 'button')
    btns1[1].props.onClick() // fly
    btns1[2].props.onClick() // delete

    assert.deepEqual(calls, [
      ['quickAnnotate'],
      ['downloadOverlay', 0],
      ['sendOverlay', 0],
      ['select', 0, 0],
      ['flyFeat', 0, 1],
      ['removeFeat', 0, 1],
    ])
  } finally {
    r.cleanup()
  }
})

test('ToolsPanel：支持外部 openRequest 直接打开标注子窗口', () => {
  let req = null
  const r = createRenderer(() =>
    ToolsPanel({
      t: tZh,
      tool: 'identify',
      analysis: null,
      shaderActive: [],
      openRequest: req,
      onCollapse() {},
      onStartAnnotation() {},
    }),
  )
  try {
    assert.equal(findNodes(r.getTree(), (n) => n.props?.entryId === 'annotation').length, 0)
    req = { id: 'annotation', seq: 1 }
    r.rerender()
    assert.equal(findNodes(r.getTree(), (n) => n.props?.entryId === 'annotation').length, 1)
  } finally {
    r.cleanup()
  }
})

test('VectorCard：点位经纬度编辑、自定义属性增删改查、复杂对象保护与发到对话', () => {
  const pointFeature = {
    type: 'Feature',
    properties: {
      name: '气象站 A',
      kind: 'point',
      style: 'accent',
      note: '',
      elevation_m: 38.5,
      sensor_meta: { model: 'AWS-2' },
    },
    geometry: { type: 'Point', coordinates: [114.3, 30.5, 42] },
  }
  const patches = []
  const sent = []
  let selection = {
    kind: '点要素',
    title: '气象站 A',
    feature: pointFeature,
    command: { geojson: { type: 'FeatureCollection', features: [pointFeature] }, style: 'accent', drawn: 1 },
    rows: [],
  }
  const r = createRenderer(() =>
    VectorCard({
      selection,
      onClose() {},
      onChange: (p) => patches.push(p),
      onDelete() {},
      onExport() {},
      onSendToChat: (f, name) => sent.push([f, name]),
      t: tZh,
    }),
  )
  try {
    const lonInput = findNodes(r.getTree(), (n) => n.type === 'input' && n.props?.['aria-label'] === tZh('annotation.lon'))[0]
    const latInput = findNodes(r.getTree(), (n) => n.type === 'input' && n.props?.['aria-label'] === tZh('annotation.lat'))[0]
    assert.ok(lonInput && latInput)
    lonInput.props.onChange({ target: { value: '114.356' } })
    latInput.props.onChange({ target: { value: '30.512' } })

    // Add a custom attribute row
    const addBtn = findNodes(r.getTree(), (n) => n.type === 'button' && textOf(n) === tZh('annotation.addAttribute'))[0]
    addBtn.props.onClick()
    let rows = findNodes(r.getTree(), (n) => String(n.props?.className).includes('mv-attr-row'))
    assert.equal(rows.length, 3)

    // Empty key blocks Save button
    const findSave = () => findNodes(r.getTree(), (n) => n.type === 'button' && textOf(n) === tZh('annotation.save'))[0]
    assert.equal(findSave().props.disabled, true)

    // Reserved key also blocks Save
    const newRowInputs = findNodes(rows[2], (n) => n.type === 'input')
    newRowInputs[0].props.onChange({ target: { value: 'provenance' } })
    newRowInputs[1].props.onChange({ target: { value: 'bad' } })
    assert.equal(findSave().props.disabled, true)

    // Valid key + edit first attribute + delete second attribute? Wait: keep complex row[1], modify newRow -> Save
    newRowInputs[0].props.onChange({ target: { value: 'station_code' } })
    newRowInputs[1].props.onChange({ target: { value: 'W-09' } })
    const row0Inputs = findNodes(rows[0], (n) => n.type === 'input')
    row0Inputs[1].props.onChange({ target: { value: '41.2' } })

    assert.equal(findSave().props.disabled, false)
    findSave().props.onClick()

    assert.equal(patches.length, 1)
    assert.deepEqual(patches[0].geometry, { type: 'Point', coordinates: [114.356, 30.512, 42] })
    assert.deepEqual(patches[0].attributes, [
      { key: 'elevation_m', value: '41.2' },
      { key: 'sensor_meta', preserveObject: true },
      { key: 'station_code', value: 'W-09' },
    ])

    // Send to chat button
    const sendBtn = findNodes(r.getTree(), (n) => n.type === 'button' && textOf(n) === tZh('annotation.sendToChat'))[0]
    assert.ok(sendBtn)
    sendBtn.props.onClick()
    assert.equal(sent.length, 1)
    assert.equal(sent[0][1], '气象站 A')

    // Read-only (!editable) selection still renders <dl>
    selection = { kind: '量测', title: '距离', summary: '100 m', rows: [['水平距离', '100 m']] }
    r.rerender()
    assert.deepEqual(findNodes(r.getTree(), (n) => n.type === 'dt').map(textOf), ['水平距离'])
  } finally {
    r.cleanup()
  }
})

test('i18n：messages-annotations 与 messages-export 中英键值完全对齐且非空', () => {
  for (const dict of [ANNOTATION_MESSAGES, EXPORT_MESSAGES]) {
    const zh = Object.keys(dict.zh).sort()
    const en = Object.keys(dict.en).sort()
    assert.deepEqual(zh, en)
    for (const key of zh) {
      assert.ok(typeof dict.zh[key] === 'string' && dict.zh[key].length > 0, `zh.${key}`)
      assert.ok(typeof dict.en[key] === 'string' && dict.en[key].length > 0, `en.${key}`)
    }
  }
})
