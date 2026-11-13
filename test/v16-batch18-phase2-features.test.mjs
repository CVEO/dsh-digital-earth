/**
 * v16 batch 18 — Phase 2 tests: richer identify card + Entity/Feature property
 * inspection, 3D extruded polygons + snapshot round-trip, and building height
 * estimation + one-click building vector layer extraction.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { MESSAGES } = await import('../src/client/messages.js')
const { groundSourceLabelKey, normalizeIdentity } = await import('../src/client/scene/selection.js')
const { createSelectionController } = await import('../src/client/scene/selection-controller.js')
const { SelectionOverlay } = await import('../src/client/ui/selection-overlay.js')
const { createVectorRenderer, polygonVolume } = await import('../src/client/scene/vector-renderer.js')
const { styleVectorOptions } = await import('../src/client/scene/vector-style.js')
const { readSceneSnapshot, writeSceneSnapshot } = await import('../src/client/scene-store.js')
const batch = await import('../src/client/scene/vision-batch.js')
const { ParseBody } = await import('../src/client/ui/parse-review.js')

const t = (key, vars = {}) => {
  let out = key
  for (const [k, v] of Object.entries(vars)) out += `:${k}=${v}`
  return out
}

function createRenderer(rootFn, getProps) {
  const states = new Map()
  const refs = new Map()
  const effects = new Map()
  let rerender = null
  function renderComponent(Component, props, path) {
    let slot = 0
    const pendingEffects = []
    const saved = {
      useState: React.useState,
      useRef: React.useRef,
      useCallback: React.useCallback,
      useMemo: React.useMemo,
      useEffect: React.useEffect,
    }
    React.useState = (initial) => {
      const key = `${path}#s${slot++}`
      if (!states.has(key)) states.set(key, typeof initial === 'function' ? initial() : initial)
      const setState = (next) => {
        const cur = states.get(key)
        states.set(key, typeof next === 'function' ? next(cur) : next)
        rerender?.()
      }
      return [states.get(key), setState]
    }
    React.useRef = (initial) => {
      const key = `${path}#r${slot++}`
      if (!refs.has(key)) refs.set(key, { current: initial })
      return refs.get(key)
    }
    React.useCallback = (fn) => fn
    React.useMemo = (fn) => fn()
    React.useEffect = (fn, deps) => {
      const key = `${path}#e${slot++}`
      const prev = effects.get(key)
      const changed =
        !prev ||
        deps === undefined ||
        deps.length !== prev.deps.length ||
        deps.some((d, i) => !Object.is(d, prev.deps[i]))
      if (changed) pendingEffects.push({ key, fn, deps: deps ?? [] })
    }
    let rendered
    try {
      rendered = expand(Component(props), path)
    } finally {
      Object.assign(React, saved)
    }
    for (const item of pendingEffects) {
      effects.get(item.key)?.cleanup?.()
      const cleanup = typeof item.fn === 'function' ? item.fn() : undefined
      effects.set(item.key, { deps: item.deps, cleanup: typeof cleanup === 'function' ? cleanup : null })
    }
    return rendered
  }
  function expand(node, path) {
    if (node == null || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map((item, idx) => expand(item, `${path}[${idx}]`))
    if (typeof node.type === 'function') {
      const props = { ...(node.props || {}), children: node.children }
      return renderComponent(node.type, props, `${path}/${node.type.name || 'Fn'}`)
    }
    if (node.type === React.Fragment) {
      return { type: 'fragment', props: node.props || {}, children: (node.children || []).map((c, idx) => expand(c, `${path}.f${idx}`)) }
    }
    return { type: node.type, props: node.props || {}, children: (node.children || []).map((c, idx) => expand(c, `${path}.${idx}`)) }
  }
  let tree = null
  rerender = () => { tree = renderComponent(rootFn, getProps(), 'root') }
  rerender()
  return { tree: () => tree }
}

function findAll(node, predicate, acc = []) {
  if (!node || typeof node !== 'object') return acc
  if (Array.isArray(node)) { for (const i of node) findAll(i, predicate, acc); return acc }
  if (predicate(node)) acc.push(node)
  if (Array.isArray(node.children)) for (const c of node.children) findAll(c, predicate, acc)
  return acc
}

function textOf(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.children)
}

function hasClass(node, cls) {
  return String(node?.props?.className || '').split(/\s+/).includes(cls)
}

test('Pick identity preserves featureId, maps ground sources, and reads Entity PropertyBag attributes', async () => {
  const id = normalizeIdentity({ kind: 'tile_feature', featureId: 42, properties: [{ name: 'floors', value: '12' }] })
  assert.equal(id.featureId, 42)
  assert.equal(groundSourceLabelKey('tileset'), 'selection.groundSource.tileset')
  assert.equal(groundSourceLabelKey('3d_tiles'), 'selection.groundSource.tileset')
  assert.equal(groundSourceLabelKey('terrain'), 'selection.groundSource.terrain')
  assert.equal(groundSourceLabelKey('ellipsoid'), 'selection.groundSource.ellipsoid')
  assert.equal(groundSourceLabelKey('none'), 'selection.groundSource.none')

  class FakeEntity {
    constructor() {
      this.id = 'bldg-1'
      this.name = 'Tower A'
      this.properties = {
        propertyNames: ['height_m', 'use'],
        height_m: { getValue: () => 48.5 },
        use: 'office',
      }
    }
  }
  class FakeTileFeature {}
  class FakeTileset {}
  const fakeCesium = {
    Entity: FakeEntity,
    Cesium3DTileFeature: FakeTileFeature,
    Cesium3DTileset: FakeTileset,
    Cartesian2: class { constructor(x, y) { this.x = x; this.y = y } },
    Cartographic: class {
      constructor(lon, lat, height = 0) { this.longitude = lon; this.latitude = lat; this.height = height }
      static fromCartesian(c) { return { longitude: c.lon, latitude: c.lat, height: c.h ?? 0 } }
    },
    Math: {
      toDegrees: (r) => (r * 180) / Math.PI,
      toRadians: (d) => (d * Math.PI) / 180,
    },
  }
  const fakeViewer = {
    clock: { currentTime: 't0' },
    scene: {
      pickPositionSupported: true,
      pickPosition: () => ({ lon: 114 * Math.PI / 180, lat: 30 * Math.PI / 180, h: 52 }),
      pick: () => ({ id: new FakeEntity() }),
      globe: { getHeight: () => 4 },
    },
    isDestroyed: () => false,
  }
  const controller = createSelectionController({
    getViewer: () => fakeViewer,
    getCesium: () => fakeCesium,
    getLayers: () => [],
  })
  const result = await controller.identifyAt({ x: 100, y: 100 })
  assert.equal(result.card.identity.kind, 'entity')
  assert.equal(result.card.identity.name, 'Tower A')
  assert.deepEqual(result.card.identity.properties, [
    { name: 'height_m', value: '48.5' },
    { name: 'use', value: 'office' },
  ])
})

test('SelectionOverlay renders metadata chips and toggles expanding >12 attributes', async () => {
  const props20 = Array.from({ length: 20 }, (_, i) => ({ name: `attr_${i}`, value: `val_${i}` }))
  const controller = {
    getViewer: () => null,
    getCesium: () => null,
    identifyAt: async () => ({
      anchor: { x: 1, y: 2, z: 3 },
      card: {
        id: 'c1',
        point: { lon: 114.3, lat: 30.5, surface_height_m: 38.4 },
        layer: { id: 'l1', name: 'Campus Model' },
        identity: { kind: 'tile_feature', featureId: 88, name: 'Building 88', properties: props20 },
        sampling: { count: 24, radii_m: [30, 60, 120], min: 10, max: 42, spread: 32, median: 15 },
        facts: [
          { key: 'surface_height', value: 38.4, basis: 'measured' },
          { key: 'object_height', value: 28.4, basis: 'estimated' },
          { key: 'above_median', value: 23.4, basis: 'estimated' },
          { key: 'ground_source', value: 'tileset', basis: 'measured' },
        ],
        limitations: [],
      },
    }),
  }
  const savedDoc = globalThis.document
  globalThis.document = { addEventListener: () => {}, removeEventListener: () => {} }
  const apiRef = { current: null }
  try {
    const renderer = createRenderer(SelectionOverlay, () => ({
      active: true,
      apiRef,
      controller,
      t,
      showToast: () => {},
    }))

    await apiRef.current({ x: 10, y: 10 })
    let root = renderer.tree()
    const chips = findAll(root, (n) => hasClass(n, 'mv-sel-meta-chip')).map(textOf)
    assert.ok(chips.includes('selection.hitKind.tile_feature'))
    assert.ok(chips.includes('selection.groundSource.tileset'))
    assert.ok(chips.some((c) => c.includes('selection.featureId:id=88')))
    assert.ok(textOf(root).includes('selection.neighborBand:min=10:max=42:spread=32'))

    // Initially renders 12 properties + expand toggle.
    assert.equal(findAll(root, (n) => hasClass(n, 'prop')).length, 12)
    const toggleBtn = findAll(root, (n) => hasClass(n, 'mv-sel-props-toggle'))[0]
    assert.ok(toggleBtn && textOf(toggleBtn).includes('selection.propertiesShowAll:total=20'))
    toggleBtn.props.onClick()

    root = renderer.tree()
    assert.equal(findAll(root, (n) => hasClass(n, 'prop')).length, 20)
    const collapseBtn = findAll(root, (n) => hasClass(n, 'mv-sel-props-toggle'))[0]
    assert.ok(textOf(collapseBtn).includes('selection.propertiesCollapse:shown=12'))
  } finally {
    globalThis.document = savedDoc
  }
})

test('polygonVolume & vector-renderer support 3D extruded polygons and preserve 2D flat default', () => {
  assert.equal(polygonVolume({}, [[[0, 0], [1, 0], [1, 1], [0, 0]]]), null)
  assert.deepEqual(polygonVolume({ ground_height_m: 10, extruded_height_m: 32 }, []), {
    mode: 'extruded',
    baseHeight: 10,
    extrudedHeight: 32,
  })
  assert.deepEqual(polygonVolume({ height_m: 18 }, []), {
    mode: 'extruded',
    baseHeight: 0,
    extrudedHeight: 18,
  })
  assert.equal(polygonVolume({ height_m: 18, extruded: false }, []), null)
  assert.deepEqual(polygonVolume({ mode3d: true }, [[[0, 0, 12], [1, 0, 12], [1, 1, 12]]]), {
    mode: '3d',
    perPositionHeight: true,
  })

  class FakeColor {
    static fromCssColorString() { return new FakeColor() }
    withAlpha(alpha) { return { alpha, _color: true } }
  }
  const fakeCesium = {
    Color: FakeColor,
    PolygonHierarchy: class { constructor(outer, holes) { this.outer = outer; this.holes = holes } },
    Cartesian3: {
      fromDegrees: (lon, lat, h = 0) => ({ lon, lat, h }),
      fromDegreesArray: (flat) => {
        const pts = []
        for (let i = 0; i < flat.length; i += 2) pts.push({ lon: flat[i], lat: flat[i + 1] })
        return pts
      },
      fromDegreesArrayHeights: (flat) => {
        const pts = []
        for (let i = 0; i < flat.length; i += 3) pts.push({ lon: flat[i], lat: flat[i + 1], h: flat[i + 2] })
        return pts
      },
    },
    Cartesian2: class { constructor(x, y) { this.x = x; this.y = y } },
    HeightReference: { CLAMP_TO_GROUND: 'CLAMP', NONE: 'NONE' },
    ClassificationType: { BOTH: 'BOTH' },
    ArcType: { NONE: 'NONE' },
    PolylineOutlineMaterialProperty: class { constructor(o) { Object.assign(this, o) } },
    PolylineDashMaterialProperty: class { constructor(o) { Object.assign(this, o) } },
    LabelStyle: { FILL: 0 },
  }
  const added = []
  const state = { draw: [], drawCommands: [], measure: [], entityGroups: new Map(), drawnFeatures: 0 }
  const renderer = createVectorRenderer({
    getState: () => state,
    getVector: () => ({ add: (opts) => { added.push(opts); return opts } }),
    t,
    markSceneDirty: () => {},
    syncOverlayCount: () => {},
  })
  const ring = [[114.3, 30.5], [114.301, 30.5], [114.301, 30.501], [114.3, 30.501], [114.3, 30.5]]
  renderer.drawAgentOverlay(fakeCesium, {}, {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: 'Library', class: 'building', ground_height_m: 12, roof_height_m: 36, height_m: 24, extruded_height_m: 36 },
      geometry: { type: 'Polygon', coordinates: [ring] },
    }],
  }, 'violet')

  const polyEntity = added.find((item) => item.polygon)
  const lineEntity = added.find((item) => item.polyline)
  const labelEntity = added.find((item) => item.label)
  assert.equal(polyEntity.polygon.height, 12)
  assert.equal(polyEntity.polygon.extrudedHeight, 36)
  assert.equal(polyEntity.polygon.outline, true)
  assert.equal(lineEntity.polyline.clampToGround, false)
  assert.equal(lineEntity.polyline.positions[0].h, 36)
  assert.equal(labelEntity.position.h, 37.5)
  assert.equal(labelEntity.label.heightReference, 'NONE')

  // styleVectorOptions skips ClassificationType.BOTH for elevated/extruded polygons, preserves it for 2D.
  const styled3d = styleVectorOptions(fakeCesium, { polygon: { height: 0, extrudedHeight: 20, material: new FakeColor() } })
  assert.equal(styled3d.polygon.classificationType, undefined)
  assert.equal(styled3d.polygon.outline, true)
  const styled2d = styleVectorOptions(fakeCesium, { polygon: { perPositionHeight: false, material: new FakeColor() } })
  assert.equal(styled2d.polygon.classificationType, 'BOTH')
  assert.equal(styled2d.polygon.outline, false)
})

test('scene-store save/reload round-trips 3D extruded building properties and Z coordinates cleanly', () => {
  const storageMap = new Map()
  const originalWindow = globalThis.window
  const storage = {
    get length() { return storageMap.size },
    key: (idx) => Array.from(storageMap.keys())[idx] ?? null,
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
  }
  globalThis.window = { localStorage: storage }
  try {
    const largePad = 'x'.repeat(250_000)
    const snapshot = {
      view: null,
      layers: [],
      annotations: {
        draw: [{
          geojson: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: {
                name: '3D Block',
                kind: 'area',
                class: 'building',
                ground_height_m: 15,
                roof_height_m: 45,
                height_m: 30,
                extruded_height_m: 45,
                extruded: true,
                area_m2: 640.5,
                note: largePad.slice(0, 100),
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[[114.3, 30.5, 15], [114.301, 30.5, 15], [114.301, 30.501, 15], [114.3, 30.5, 15]]],
              },
            }],
          },
          style: 'violet',
          caption: 'Buildings',
        }],
        measure: [],
      },
      analysis: null,
      shaders: [],
    }
    const saved = writeSceneSnapshot('test-3d-session', snapshot)
    assert.ok(saved)
    const loaded = readSceneSnapshot('test-3d-session')
    const feat = loaded.annotations.draw[0].geojson.features[0]
    assert.equal(feat.properties.height_m, 30)
    assert.equal(feat.properties.extruded_height_m, 45)
    assert.equal(feat.properties.extruded, true)
    assert.equal(feat.properties.area_m2, 640.5)
    assert.deepEqual(feat.geometry.coordinates[0][0], [114.3, 30.5, 15])
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('vision-batch estimates building height/area, toggles 3D extrusion, and filters buildings', () => {
  // Perimeter ground height = 10m; interior roof pick at anchor [0.3, 0.3] (x=30, y=30) = 34m.
  const fakeCesium = {
    Cartesian2: class { constructor(x, y) { this.x = x; this.y = y } },
    Cartesian3: { fromDegrees: (lon, lat, height = 0) => ({ lon, lat, height }) },
    PolygonHierarchy: class { constructor(pts) { this.pts = pts } },
    Cartographic: {
      fromCartesian: (c) => ({
        longitude: c.lon * Math.PI / 180,
        latitude: c.lat * Math.PI / 180,
        height: c.h,
      }),
    },
    Math: { toDegrees: (r) => (r * 180) / Math.PI },
    Color: { fromCssColorString: () => ({ withAlpha: () => ({}) }) },
  }
  const entities = []
  const fakeViewer = {
    scene: {
      pickPositionSupported: true,
      pickPosition: (pos) => {
        const inside = Math.hypot(pos.x - 30, pos.y - 30) < 5
        return {
          lon: 114.3 + pos.x * 0.0001,
          lat: 30.5 + pos.y * 0.0001,
          h: inside ? 34 : 10,
        }
      },
      globe: { pick: () => null, tilesLoaded: true },
      requestRender: () => {},
    },
    camera: { getPickRay: () => null, cancelFlight: () => {} },
    render: () => {},
    entities: { add: (e) => { entities.push(e); return e }, remove: () => {} },
    isDestroyed: () => false,
  }
  const frame = {
    id: 'f-bldg',
    viewer: fakeViewer,
    Cesium: fakeCesium,
    crop: { left: 0, top: 0, width: 100, height: 100 },
    cssWidth: 100,
    cssHeight: 100,
    point: [0.5, 0.5],
    isValid: () => true,
  }
  const square = [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]]
  const { features } = batch.projectBatchObjects(frame, [
    { class: 'building', confidence: 0.9, polygon: square },
    { class: 'vegetation', confidence: 0.7, polygon: [[0.5, 0.5], [0.7, 0.5], [0.7, 0.7], [0.5, 0.7]] },
  ], { t })
  assert.equal(features.length, 2)
  const bldg = features[0]
  assert.equal(bldg.properties.ground_height_m, 10)
  assert.equal(bldg.properties.roof_height_m, 34)
  assert.equal(bldg.properties.height_m, 24)
  assert.ok(bldg.properties.area_m2 > 0)

  const extruded = batch.applyExtrusionToFeatures(features, true)
  assert.equal(extruded[0].properties.extruded, true)
  assert.equal(extruded[0].properties.extruded_height_m, 34)

  const flat = batch.applyExtrusionToFeatures(extruded, false)
  assert.equal(flat[0].properties.extruded, false)
  assert.equal(flat[0].properties.extruded_height_m, undefined)
  assert.equal(flat[0].properties.height_m, 24)

  assert.equal(batch.filterBatchFeatures(features, 'building').length, 1)
  batch.drawBatchPreview(fakeCesium, fakeViewer, [bldg], { extrude: true })
  assert.ok(entities.some((e) => e.polygon?.extrudedHeight === 34))
})

test('ParseBody offers building filter, 3D extrusion toggle, and one-click extract buildings layer', async () => {
  const fakeCesium = {
    Cartesian2: class { constructor(x, y) { this.x = x; this.y = y } },
    Cartesian3: { fromDegrees: (lon, lat, height = 0) => ({ lon, lat, height }) },
    PolygonHierarchy: class { constructor(pts) { this.pts = pts } },
    Cartographic: {
      fromCartesian: (c) => ({ longitude: c.lon * Math.PI / 180, latitude: c.lat * Math.PI / 180, height: c.h }),
    },
    Math: { toDegrees: (r) => (r * 180) / Math.PI },
    Color: { fromCssColorString: () => ({ withAlpha: () => ({}) }) },
  }
  const fakeViewer = {
    canvas: { clientWidth: 100, clientHeight: 100, width: 100, height: 100 },
    scene: {
      pickPositionSupported: true,
      pickPosition: (pos) => ({
        lon: 114.3 + pos.x * 0.0001,
        lat: 30.5 + pos.y * 0.0001,
        h: Math.hypot(pos.x - 30, pos.y - 30) < 5 ? 30 : 10,
      }),
      globe: { pick: () => null, tilesLoaded: true },
      requestRender: () => {},
    },
    camera: { getPickRay: () => null, cancelFlight: () => {} },
    render: () => {},
    entities: { add: (e) => e, remove: () => {} },
    isDestroyed: () => false,
  }
  const savedDoc = globalThis.document
  const savedFetch = globalThis.fetch
  globalThis.document = {
    visibilityState: 'visible',
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,ok' }),
  }
  globalThis.fetch = async (url) => {
    if (String(url).includes('meta')) return { ok: true, json: async () => ({ visionBatchUrl: '/api/vision-batch' }) }
    return {
      ok: true,
      json: async () => ({
        ok: true,
        objects: [
          { class: 'building', confidence: 0.92, polygon: [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]] },
          { class: 'road', confidence: 0.75, polygon: [[0.6, 0.6], [0.8, 0.6], [0.8, 0.8], [0.6, 0.8]] },
        ],
      }),
    }
  }
  const adopted = []
  try {
    const renderer = createRenderer(ParseBody, () => ({
      t,
      getCesium: () => fakeCesium,
      getViewer: () => fakeViewer,
      getLayers: () => [],
      showToast: () => {},
      onAdoptParse: (collection, label) => { adopted.push({ collection, label }); return true },
    }))

    const runBtn = findAll(renderer.tree(), (n) => n.type === 'button' && textOf(n).includes('parse.run'))[0]
    await runBtn.props.onClick()

    let root = renderer.tree()
    const bldgFilterBtn = findAll(root, (n) => hasClass(n, 'mv-parse-filter') && textOf(n).includes('parse.filterBuildings'))[0]
    assert.ok(bldgFilterBtn)
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-parse-row')).length, 2)
    bldgFilterBtn.props.onClick()

    root = renderer.tree()
    assert.equal(findAll(root, (n) => hasClass(n, 'mv-parse-row')).length, 1)
    assert.ok(textOf(root).includes('≈20m'))

    const extractBtn = findAll(root, (n) => n.type === 'button' && textOf(n).includes('parse.adoptBuildings'))[0]
    assert.ok(extractBtn)
    extractBtn.props.onClick()

    assert.equal(adopted.length, 1)
    assert.equal(adopted[0].label, 'parse.buildingsLayerName')
    assert.equal(adopted[0].collection.features.length, 1)
    assert.equal(adopted[0].collection.features[0].properties.class, 'building')
    assert.equal(adopted[0].collection.features[0].properties.extruded, true)
    assert.equal(adopted[0].collection.features[0].properties.extruded_height_m, 30)
  } finally {
    globalThis.document = savedDoc
    globalThis.fetch = savedFetch
  }
})

test('Phase 2 zh/en i18n keys exist in MESSAGES', () => {
  const keys = [
    'selection.propertiesShowAll',
    'selection.propertiesCollapse',
    'selection.hitKind.tile_feature',
    'selection.hitKind.tileset',
    'selection.hitKind.entity',
    'selection.hitKind.scene',
    'selection.groundSource.tileset',
    'selection.groundSource.terrain',
    'selection.groundSource.ellipsoid',
    'selection.groundSource.none',
    'selection.featureId',
    'selection.neighborBand',
    'parse.filterAll',
    'parse.filterBuildings',
    'parse.extrude3d',
    'parse.buildingsLayerName',
    'parse.adoptBuildings',
  ]
  for (const key of keys) {
    assert.ok(typeof MESSAGES.zh[key] === 'string' && MESSAGES.zh[key].length > 0, `missing zh key ${key}`)
    assert.ok(typeof MESSAGES.en[key] === 'string' && MESSAGES.en[key].length > 0, `missing en key ${key}`)
  }
})
