/**
 * v1.6 Phase 3 (P3-1) — manual annotation styling, classification (`note`),
 * 3D polygon extrusion editing, label accent stripes, snapshot priority retention,
 * and UI editing controls (AnnotationBody + VectorCard).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const ReactModule = await import('react')
const React = ReactModule.default
const { MESSAGES } = await import('../src/client/messages.js')
const { ANNOTATION_MESSAGES } = await import('../src/client/messages-annotations.js')
const {
  ANNOTATION_KINDS,
  ANNOTATION_MAX_HEIGHT_M,
  ANNOTATION_STYLES,
  annotationExtrusionOf,
  annotationStyleOf,
  nextAnnotationName,
  withAnnotationProperties,
} = await import('../src/client/scene/annotation-model.js')
const { createVectorRenderer, polygonVolume } = await import('../src/client/scene/vector-renderer.js')
const { createVectorLabels } = await import('../src/client/scene/vector-labels.js')
const { VECTOR_COLORS } = await import('../src/client/scene/vector-style.js')
const { createAnnotationTool } = await import('../src/client/scene/annotation-tool.js')
const { createAnnotationActions } = await import('../src/client/scene/annotation-actions.js')
const {
  SCENE_STORE_MAX_BYTES,
  readSceneSnapshot,
  writeSceneSnapshot,
} = await import('../src/client/scene-store.js')
const { AnnotationBody } = await import('../src/client/ui/tool-windows.js')
const { VectorCard } = await import('../src/client/ui/vector-card.js')

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
  const makeEl = (tag) => {
    const children = []
    const elListeners = new Map()
    const classes = new Set()
    const styleProps = {}
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
      offsetWidth: 64,
      offsetHeight: 22,
      style: {
        ...styleProps,
        setProperty(k, v) { el.style[k] = v },
      },
      classList: {
        toggle(name, flag) {
          if (flag) classes.add(name)
          else classes.delete(name)
        },
        contains: (name) => classes.has(name),
      },
      append(node) { children.push(node) },
      appendChild(node) { children.push(node); return node },
      remove() {},
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
        for (const fn of elListeners.get(type) ?? []) fn({ preventDefault() {}, stopPropagation() {}, ...event })
      },
    }
    return el
  }
  fakeDoc = {
    body: null,
    activeElement: null,
    createElement: (tag) => makeEl(tag),
    addEventListener() {},
    removeEventListener() {},
  }
  fakeDoc.body = makeEl('body')
  return { fakeDoc, makeEl }
}

function makeFakeCesium(handlersOut = null) {
  class Color {
    constructor(css = 'white', alpha = 1) {
      this.css = css
      this.alpha = alpha
    }
    withAlpha(alpha) { return new Color(this.css, alpha) }
    static fromCssColorString(css) { return new Color(css, 1) }
  }
  Color.WHITE = new Color('#ffffff', 1)
  Color.BLACK = new Color('#000000', 1)

  class ScreenSpaceEventHandler {
    constructor() {
      this.actions = new Map()
      if (handlersOut) handlersOut.push(this)
    }
    setInputAction(fn, type) { this.actions.set(type, fn) }
    removeInputAction(type) { this.actions.delete(type) }
    emit(type, payload) { this.actions.get(type)?.(payload) }
    destroy() { this.actions.clear() }
  }

  return {
    Color,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType: { LEFT_CLICK: 0, MOUSE_MOVE: 1, RIGHT_CLICK: 2, LEFT_DOUBLE_CLICK: 3 },
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
    CallbackProperty: class { constructor(fn) { this.getValue = fn } },
    PolygonHierarchy: class { constructor(positions, holes = []) { this.positions = positions; this.holes = holes } },
    PolylineOutlineMaterialProperty: class { constructor(opts = {}) { Object.assign(this, opts) } },
    PolylineDashMaterialProperty: class { constructor(opts = {}) { Object.assign(this, opts) } },
    ClassificationType: { BOTH: 1 },
    ArcType: { NONE: 0 },
    LabelStyle: { FILL: 0, OUTLINE: 1, FILL_AND_OUTLINE: 2 },
    VerticalOrigin: { BOTTOM: 1, CENTER: 0 },
    HorizontalOrigin: { CENTER: 0, LEFT: 1, RIGHT: -1 },
    HeightReference: { CLAMP_TO_GROUND: 1 },
    Math: { toDegrees: (rad) => (rad * 180) / Math.PI },
    EllipsoidalOccluder: class { constructor() {} isPointVisible() { return true } },
    SceneTransforms: { worldToWindowCoordinates: (_scene, pos) => ({ x: pos?.x ?? 120, y: pos?.y ?? 90 }) },
  }
}

/**
 * Lightweight synchronous React component test renderer supporting useState,
 * useEffect (deps comparison), useMemo, useCallback, and useRef.
 */
function createRenderer(renderFn) {
  const prev = {
    useState: React.useState,
    useEffect: React.useEffect,
    useMemo: React.useMemo,
    useCallback: React.useCallback,
    useRef: React.useRef,
  }
  const states = []
  const refs = []
  const memos = []
  const effects = []
  let tree = null

  function depsChanged(next, previous) {
    if (!next || !previous || next.length !== previous.length) return true
    return next.some((v, i) => !Object.is(v, previous[i]))
  }

  function render() {
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
    if (pendingEffects.length) {
      for (const item of pendingEffects) {
        if (typeof item.prevCleanup === 'function') item.prevCleanup()
        const slot = { deps: item.deps, cleanup: undefined }
        effects[item.idx] = slot
        slot.cleanup = item.effect()
      }
      // Effects may call setState synchronously on mount/prop change — re-read latest tree.
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

function withMemoryLocalStorage(run) {
  const previousWindow = globalThis.window
  const map = new Map()
  const localStorage = {
    get length() { return map.size },
    key(index) { return [...map.keys()][index] ?? null },
    getItem(key) { return map.has(key) ? map.get(key) : null },
    setItem(key, value) { map.set(key, String(value)) },
    removeItem(key) { map.delete(key) },
  }
  globalThis.window = { ...(previousWindow ?? {}), localStorage }
  return Promise.resolve()
    .then(() => run(localStorage, map))
    .finally(() => {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
    })
}

// ---------------------------------------------------------------------------
// 1. Model: kind ('note'), style presets, 3D extrusion & nextAnnotationName
// ---------------------------------------------------------------------------

test('annotation-model：note 类型、style 校验、3D 拉伸属性归一化与 nextAnnotationName i18n 修复', () => {
  assert.deepEqual(ANNOTATION_KINDS, ['point', 'line', 'area', 'note'])
  assert.deepEqual(ANNOTATION_STYLES, ['accent', 'alert', 'success', 'warm', 'violet'])
  assert.equal(ANNOTATION_MAX_HEIGHT_M, 5000)

  // Previously used plural `annotations.kind.*` causing fallback raw keys; now localized via `annotation.kind.*`.
  assert.equal(nextAnnotationName([], 'area', tZh), '面 1')
  assert.equal(nextAnnotationName([{ properties: { kind: 'area', name: '面 1' } }], 'area', tZh), '面 2')
  assert.equal(nextAnnotationName([], 'note', tZh), '注记 1')

  assert.equal(annotationStyleOf({ properties: { style: 'violet' } }), 'violet')
  assert.equal(annotationStyleOf({ properties: { style: 'bad' } }, 'warm'), 'warm')

  assert.deepEqual(annotationExtrusionOf({ properties: { extruded: false, extruded_height_m: 40 } }), {
    enabled: false,
    height_m: 40,
    has_height: true,
    base_height_m: 0,
  })
  assert.deepEqual(annotationExtrusionOf({ properties: { height_m: 28.5, base_height_m: 4 } }), {
    enabled: true,
    height_m: 28.5,
    has_height: true,
    base_height_m: 4,
  })

  const poly = {
    type: 'Feature',
    properties: { name: '园区', kind: 'area', roof_height_m: 18 },
    geometry: { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.31, 30.5], [114.31, 30.51], [114.3, 30.5]]] },
  }
  const patchedRes = withAnnotationProperties(poly, {
    kind: 'note',
    style: 'alert',
    extruded: true,
    height_m: 42.345,
  })
  assert.equal(patchedRes.ok, true)
  const patched = patchedRes.feature
  assert.equal(patched.properties.kind, 'note')
  assert.equal(patched.properties.style, 'alert')
  assert.equal(patched.properties.extruded, true)
  assert.equal(patched.properties.height_m, 42.35)
  assert.equal(patched.properties.extruded_height_m, 42.35)
  assert.equal(patched.properties.roof_height_m, 42.35)

  const flattenedRes = withAnnotationProperties(patched, { extruded: false })
  assert.equal(flattenedRes.ok, true)
  assert.equal(flattenedRes.feature.properties.extruded, false)

  assert.deepEqual(withAnnotationProperties(poly, { style: 'neon' }), { ok: false, error: 'invalid_style' })
  assert.deepEqual(withAnnotationProperties(poly, { extruded: 'yes' }), { ok: false, error: 'invalid_extruded' })
  assert.deepEqual(withAnnotationProperties(poly, { height_m: -5 }), { ok: false, error: 'invalid_height' })
  assert.deepEqual(
    withAnnotationProperties(poly, { height_m: ANNOTATION_MAX_HEIGHT_M + 1 }),
    { ok: false, error: 'invalid_height' },
  )
})

// ---------------------------------------------------------------------------
// 2. Renderer & labels: per-feature style color, extruded:false opt-out, stripes
// ---------------------------------------------------------------------------

test('vector-renderer & labels：单要素 style 染色、extruded:false 取消拉伸及标牌左侧色条', () => {
  const flatVol = polygonVolume({ extruded: false, extruded_height_m: 35, height_m: 35 }, [])
  assert.equal(flatVol, null, 'extruded === false 时即便有高度字段也不再拉伸')

  const raisedVol = polygonVolume({ extruded: true, height_m: 25, base_height_m: 5 }, [])
  assert.deepEqual(raisedVol, { mode: 'extruded', baseHeight: 5, extrudedHeight: 30 })

  const Cesium = makeFakeCesium()
  const state = {
    draw: [],
    measure: [],
    drawCommands: [],
    measureCommands: [],
    drawnFeatures: 0,
    measuredCount: 0,
    entityGroups: new WeakMap(),
  }
  const added = []
  const vectorStub = {
    add: (opts, desc) => {
      const entity = { ...opts, id: `ent-${added.length}` }
      added.push({ entity, desc })
      return entity
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

  const viewer = { scene: { requestRender() {} }, entities: { remove() {} } }
  const fc = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: 'P-alert', kind: 'note', style: 'alert' }, geometry: { type: 'Point', coordinates: [114.3, 30.5] } },
      { type: 'Feature', properties: { name: 'Poly-violet', kind: 'area', style: 'violet', extruded: false, height_m: 40 }, geometry: { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.31, 30.5], [114.31, 30.51], [114.3, 30.5]]] } },
    ],
  }
  renderer.drawAgentOverlay(Cesium, viewer, fc, 'accent', 'test')
  const ptEntry = added.find((item) => item.entity.point)
  const polyEntry = added.find((item) => item.entity.polygon)
  assert.ok(ptEntry && polyEntry)
  assert.equal(ptEntry.desc.style, 'alert')
  assert.equal(ptEntry.desc.featureKind, 'note')
  assert.equal(ptEntry.entity.point.color.css, VECTOR_COLORS.alert)
  assert.equal(polyEntry.desc.style, 'violet')
  assert.equal(polyEntry.entity.polygon.material.css, VECTOR_COLORS.violet)
  assert.equal(polyEntry.entity.polygon.extrudedHeight, undefined)

  // Verify label pill receives dataset.style, --mv-label-accent, dataset.kind & paints stripe on canvas
  const { fakeDoc, makeEl } = makeFakeDom()
  const prevDoc = globalThis.document
  globalThis.document = fakeDoc
  try {
    const root = makeEl('div')
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
    const canvas = makeEl('canvas')
    canvas.clientWidth = 800
    canvas.clientHeight = 600
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
    const labelViewer = {
      canvas,
      clock: { currentTime: 0 },
      camera: { positionWC: { x: 0, y: 0, z: 10000 } },
      scene: {
        canvas,
        globe: { ellipsoid: {} },
        postRender: makeSignal(),
        camera: { position: { x: 0, y: 0, z: 10000 }, positionWC: { x: 0, y: 0, z: 10000 } },
        cartesianToCanvasCoordinates: (_pos, out = {}) => { out.x = 120; out.y = 90; return out },
      },
    }
    const labels = createVectorLabels({
      Cesium,
      viewer: labelViewer,
      root,
      onHover: () => {},
      onSelect: () => {},
      isInteractive: () => true,
    })
    labels.add(
      { position: { getValue: () => ({ x: 100, y: 80, z: 10 }) }, label: { show: true, text: { getValue: () => 'P-alert' } } },
      { position: { x: 100, y: 80, z: 10 }, label: { text: 'P-alert' } },
      'group-1',
      ptEntry.desc,
    )
    const button = root.children[0].children[0]
    assert.equal(button.dataset.style, 'alert')
    assert.equal(button.dataset.kind, 'note')
    assert.equal(button.style['--mv-label-accent'], VECTOR_COLORS.alert)

    // Render one frame so cached positions/visibility exist, then invoke paint()
    labelViewer.scene.postRender.raise()
    const fillRectCalls = []
    const ctx = {
      save() {},
      scale() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillRect(...args) { fillRectCalls.push({ args, fillStyle: ctx.fillStyle }) },
      fillText() {},
      measureText: (txt) => ({ width: String(txt).length * 7 }),
      font: '',
      textBaseline: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    }
    labels.paint(ctx, 800, 600)
    assert.ok(fillRectCalls.length >= 1, 'Canvas 截图重绘时应绘制左侧强调色条')
    assert.equal(fillRectCalls[0].args[2], 3)
    assert.equal(fillRectCalls[0].fillStyle, VECTOR_COLORS.alert)
    labels.dispose()
  } finally {
    globalThis.document = prevDoc
  }
})

// ---------------------------------------------------------------------------
// 3. Snapshot compaction priority: keep style/kind/extrusion even over 16 keys
// ---------------------------------------------------------------------------

test('scene-store：快照压缩触发时优先保留 kind/style/extruded/height_m 等核心字段', async () => {
  await withMemoryLocalStorage(async () => {
    const fillerFeatures = Array.from({ length: 480 }, (_, idx) => {
      const lon = 114.3 + (idx % 20) * 0.001
      const lat = 30.5 + Math.floor(idx / 20) * 0.001
      return {
        type: 'Feature',
        properties: {
          name: `building-${idx}`,
          kind: 'area',
          style: 'warm',
          extruded: true,
          height_m: 24,
          extra_1: 'x'.repeat(600),
          extra_2: 'y'.repeat(600),
          z01: 'a', z02: 'b', z03: 'c', z04: 'd', z05: 'e', z06: 'f', z07: 'g',
          z08: 'h', z09: 'i', z10: 'j', z11: 'k', z12: 'l', z13: 'm', z14: 'n', z15: 'o',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[[lon, lat], [lon + 0.0005, lat], [lon + 0.0005, lat + 0.0005], [lon, lat + 0.0005], [lon, lat]]],
        },
      }
    })
    const raw = {
      view: { lon: 114.31, lat: 30.51, height: 1200, heading: 0, pitch: -45 },
      layers: [],
      annotations: {
        draw: [{ geojson: { type: 'FeatureCollection', features: fillerFeatures }, style: 'warm', drawn: fillerFeatures.length }],
        measure: [],
      },
    }
    assert.ok(JSON.stringify(raw).length > SCENE_STORE_MAX_BYTES)
    const body = writeSceneSnapshot('sess-p3-1', raw)
    assert.ok(body)
    const restored = readSceneSnapshot('sess-p3-1')
    assert.ok(restored)
    const f0 = restored.annotations.draw[0].geojson.features[0]
    assert.equal(f0.properties.kind, 'area')
    assert.equal(f0.properties.style, 'warm')
    assert.equal(f0.properties.extruded, true)
    assert.equal(f0.properties.height_m, 24)
  })
})

// ---------------------------------------------------------------------------
// 4. Annotation tool ('note' + custom style) & annotationActions.add forwarding
// ---------------------------------------------------------------------------

test('annotation-tool & actions：note 单击即落点且透传所选 style 到矢量渲染', () => {
  const handlers = []
  const Cesium = makeFakeCesium(handlers)
  const viewer = {
    scene: { canvas: {} },
    entities: { add: (spec) => ({ ...spec }), remove() {} },
  }
  const finished = []
  let activeTool = null
  const tool = createAnnotationTool({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    pickSurface: () => ({ lon: 114.331, lat: 30.542, height: 22 }),
    setTool: (v) => { activeTool = v },
    showToast: () => {},
    t: tZh,
    onFinish: (feature) => finished.push(feature),
  })

  tool.start('note', 'violet')
  assert.equal(activeTool, 'annotate')
  assert.equal(handlers.length, 1)
  handlers[0].emit(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 100, y: 100 } })
  assert.equal(finished.length, 1)
  assert.deepEqual(finished[0].properties, { kind: 'note', source: 'manual', style: 'violet' })
  assert.equal(finished[0].geometry.type, 'Point')

  // annotationActions.add forwards feature.properties.style into draw(geojson, style, caption)
  const drawCalls = []
  const actions = createAnnotationActions({
    stateRef: { current: { drawCommands: [] } },
    viewerRef: { current: viewer },
    getSelection: () => null,
    draw: (geojson, style, caption) => {
      drawCalls.push({ geojson, style, caption })
      return { drawn: 1 }
    },
    showToast: () => {},
    t: tZh,
  })
  actions.add(finished[0])
  assert.equal(drawCalls.length, 1)
  assert.equal(drawCalls[0].style, 'violet')
  assert.equal(drawCalls[0].geojson.features[0].properties.name, '注记 1')
})

// ---------------------------------------------------------------------------
// 5. UI: AnnotationBody (4 kinds + 5 swatches) & VectorCard (kind/style/3D/hints)
// ---------------------------------------------------------------------------

test('AnnotationBody：2×2 类型网格与 5 色标选择器联动传入 onStartAnnotation(kind, style)', () => {
  const calls = []
  const r = createRenderer(() => AnnotationBody({ t: tZh, onStartAnnotation: (k, s) => calls.push([k, s]) }))
  try {
    const swatches = findNodes(r.getTree(), (n) => n.type === 'button' && String(n.props?.className).includes('mv-swatch'))
    assert.equal(swatches.length, 5)
    assert.equal(swatches[0].props['aria-checked'], true)

    // Pick 'alert' swatch (index 1), then start 'note'
    swatches[1].props.onClick()
    const noteBtn = findNodes(r.getTree(), (n) => n.type === 'button' && textOf(n).includes('注记'))[0]
    assert.ok(noteBtn, '应渲染注记绘制按钮')
    noteBtn.props.onClick()
    assert.deepEqual(calls, [['note', 'alert']])
  } finally {
    r.cleanup()
  }
})

test('VectorCard：分类/色标/面拉伸控件、快捷键提示按几何显隐、属性表去重与脏检查保存', () => {
  const polygonFeature = {
    type: 'Feature',
    properties: {
      name: '试验区',
      kind: 'area',
      style: 'accent',
      note: '',
      owner: '遥感组',
      extruded: true,
      height_m: 15,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[114.3, 30.5], [114.31, 30.5], [114.31, 30.51], [114.3, 30.5]]],
    },
  }
  let selection = {
    kind: '面要素',
    title: '试验区',
    summary: '多边形 · 4 顶点',
    feature: polygonFeature,
    command: { geojson: { type: 'FeatureCollection', features: [polygonFeature] }, style: 'accent', drawn: 1 },
    rows: [
      ['note', '备注'],
      ['kind', 'area'],
      ['style', 'accent'],
      ['extruded', 'true'],
      ['height_m', '15 m'],
      ['owner', '遥感组'],
    ],
  }
  const savedPatches = []
  const r = createRenderer(() =>
    VectorCard({
      selection,
      onClose: () => {},
      onChange: (patch) => savedPatches.push(patch),
      onDelete: () => {},
      onExport: () => {},
      t: tZh,
    }),
  )
  try {
    // 1) Editable feature hides <dl> and shows custom attribute (`owner`) inside .mv-attr-row
    const dts = findNodes(r.getTree(), (n) => n.type === 'dt').map((n) => textOf(n))
    assert.deepEqual(dts, [])
    const attrRows = findNodes(r.getTree(), (n) => String(n.props?.className).includes('mv-attr-row'))
    assert.equal(attrRows.length, 1)
    const attrInputs = findNodes(attrRows[0], (n) => n.type === 'input')
    assert.equal(attrInputs[0].props.value, 'owner')
    assert.equal(attrInputs[1].props.value, '遥感组')

    // 2) Shortcuts banner visible for Polygon
    const shortcuts = findNodes(r.getTree(), (n) => String(n.props?.className).includes('mv-vector-shortcuts'))
    assert.equal(shortcuts.length, 1)

    // 3) Save disabled before any edit
    const findSaveBtn = () => findNodes(r.getTree(), (n) => n.type === 'button' && textOf(n) === tZh('annotation.save'))[0]
    assert.equal(findSaveBtn().props.disabled, true)

    // 4) Change kind, style swatch ('warm'), height_m (28)
    const select = findNodes(r.getTree(), (n) => n.type === 'select')[0]
    select.props.onChange({ target: { value: 'note' } })

    const warmSwatch = findNodes(
      r.getTree(),
      (n) => n.type === 'button' && String(n.props?.className).includes('mv-swatch') && n.props?.title === tZh('annotation.style.warm'),
    )[0]
    warmSwatch.props.onClick()

    const heightInput = findNodes(r.getTree(), (n) => n.type === 'input' && n.props?.type === 'number')[0]
    heightInput.props.onChange({ target: { value: '28' } })

    assert.equal(findSaveBtn().props.disabled, false)
    findSaveBtn().props.onClick()
    assert.deepEqual(savedPatches[0], {
      name: '试验区',
      note: '',
      kind: 'note',
      style: 'warm',
      extruded: true,
      height_m: 28,
    })

    // 5) Uncheck 3D extrusion checkbox -> emits extruded: false
    const checkbox = findNodes(r.getTree(), (n) => n.type === 'input' && n.props?.type === 'checkbox')[0]
    checkbox.props.onChange({ target: { checked: false } })
    findSaveBtn().props.onClick()
    assert.equal(savedPatches[1].extruded, false)
    assert.equal(savedPatches[1].height_m, undefined)

    // 6) Switch to Point selection -> extrusion box & shortcuts banner hidden
    selection = {
      kind: '点要素',
      title: '注记 1',
      feature: {
        type: 'Feature',
        properties: { name: '注记 1', kind: 'note', style: 'accent' },
        geometry: { type: 'Point', coordinates: [114.3, 30.5] },
      },
      command: { geojson: { type: 'FeatureCollection', features: [] }, style: 'accent', drawn: 1 },
      rows: [],
    }
    r.rerender()
    assert.equal(findNodes(r.getTree(), (n) => String(n.props?.className).includes('mv-extrude-box')).length, 0)
    assert.equal(findNodes(r.getTree(), (n) => String(n.props?.className).includes('mv-vector-shortcuts')).length, 0)
  } finally {
    r.cleanup()
  }
})

// ---------------------------------------------------------------------------
// 6. i18n parity check for annotation catalog
// ---------------------------------------------------------------------------

test('messages-annotations：Phase 3 新增中英文案键完全对齐且非空', () => {
  const zhKeys = Object.keys(ANNOTATION_MESSAGES.zh).sort()
  const enKeys = Object.keys(ANNOTATION_MESSAGES.en).sort()
  assert.deepEqual(zhKeys, enKeys)
  for (const key of zhKeys) {
    assert.equal(typeof ANNOTATION_MESSAGES.zh[key], 'string')
    assert.ok(ANNOTATION_MESSAGES.zh[key].length > 0, `zh.${key} 不应为空`)
    assert.equal(typeof ANNOTATION_MESSAGES.en[key], 'string')
    assert.ok(ANNOTATION_MESSAGES.en[key].length > 0, `en.${key} 不应为空`)
  }
})
