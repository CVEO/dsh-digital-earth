/**
 * v16 batch 23 — Phase 4 tests: AOI cropped scene parsing, HeightService
 * exterior-buffer building height & floor estimation, BatchTable fusion,
 * categorical colors/sorting, and L2 whole-layer 2D/3D toggle.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const React = (await import('react')).default
const { MESSAGES } = await import('../src/client/messages.js')
const { PARSE_CLASS_STYLES, VECTOR_COLORS, parseClassColor } = await import('../src/client/scene/vector-style.js')
const batch = await import('../src/client/scene/vision-batch.js')
const hostVision = await import('../src/host/vision.js')
const {
  buildAgentOverlayDetails,
  buildAgentOverlayExtrusions,
  buildAgentOverlayList,
  commandExtrusionSummary,
} = await import('../src/client/scene/agent-overlays.js')
const { createAnnotationActions } = await import('../src/client/scene/annotation-actions.js')
const { polygonVolume } = await import('../src/client/scene/vector-renderer.js')
const { ParseBody } = await import('../src/client/ui/parse-review.js')
const { LayersMap } = await import('../src/client/ui/layers-map.js')
const { SelectionTool } = await import('../src/client/ui/selection-tool.js')
const { getSelectionTool } = await import('../src/client/scene/selection-tools.js')

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
      effects.set(item.key, { deps: item.deps, cleanup: null })
      const cleanup = typeof item.fn === 'function' ? item.fn() : undefined
      if (typeof cleanup === 'function') {
        effects.set(item.key, { deps: item.deps, cleanup })
      }
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
  return { tree: () => tree, rerender }
}

function findAll(node, predicate, acc = []) {
  if (!node || typeof node !== 'object') return acc
  if (Array.isArray(node)) { for (const i of node) findAll(i, predicate, acc); return acc }
  if (predicate(node)) acc.push(node)
  if (Array.isArray(node.children)) for (const c of node.children) findAll(c, predicate, acc)
  return acc
}

function hasClass(node, name) {
  return typeof node?.props?.className === 'string' && node.props.className.split(/\s+/).includes(name)
}

function textOf(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.children)
}

function pngDataUrl(width = 128, height = 128) {
  const buffer = Buffer.alloc(40)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function makeFakeCesium() {
  return {
    Cartesian2: class { constructor(x, y) { this.x = x; this.y = y } },
    Cartesian3: { fromDegrees: (lon, lat, height = 0) => ({ lon, lat, h: height, height }) },
    Cartographic: {
      fromDegrees: (lon, lat, height = 0) => ({ longitude: (lon * Math.PI) / 180, latitude: (lat * Math.PI) / 180, height }),
      fromCartesian: (c) => ({ longitude: (c.lon * Math.PI) / 180, latitude: (c.lat * Math.PI) / 180, height: c.h ?? 0 }),
    },
    PolygonHierarchy: class { constructor(pts) { this.pts = pts } },
    Math: { toDegrees: (r) => (r * 180) / Math.PI },
    Color: { fromCssColorString: (hex) => ({ hex, withAlpha: (a) => ({ hex, alpha: a }) }) },
    EllipsoidTerrainProvider: class {},
    SceneTransforms: {
      worldToWindowCoordinates: (_scene, pos) => ({ x: (pos.lon - 114.3) * 10000, y: (pos.lat - 30.5) * 10000 }),
    },
  }
}

function makeFakeViewer({ globeHeight = null, tilesLoaded = true, pick = null } = {}) {
  return {
    canvas: { clientWidth: 400, clientHeight: 300, width: 800, height: 600 },
    scene: {
      pickPositionSupported: true,
      pickPosition: (pos) => ({ lon: 114.3 + pos.x * 0.0001, lat: 30.5 + pos.y * 0.0001, h: 12 }),
      pick,
      globe: {
        pick: () => null,
        tilesLoaded,
        terrainProvider: globeHeight ? { ready: true } : null,
        getHeight: globeHeight ? (carto) => globeHeight(carto) : undefined,
      },
      requestRender: () => {},
    },
    camera: { getPickRay: () => null, cancelFlight: () => {} },
    render: () => {},
    entities: { add: (e) => e, remove: () => {} },
    isDestroyed: () => false,
  }
}

test('AOI crop: computeSelectionScreenCrop handles ground selections vs non-AOI and offscreen', () => {
  const Cesium = makeFakeCesium()
  const viewer = makeFakeViewer()

  assert.equal(batch.computeSelectionScreenCrop(viewer, Cesium, null).reason, 'no_selection')
  assert.equal(batch.computeSelectionScreenCrop(viewer, Cesium, { kind: 'point', lon: 114.31, lat: 30.51 }).reason, 'no_selection')
  assert.equal(batch.computeSelectionScreenCrop(viewer, Cesium, { kind: 'objects', rows: [] }).reason, 'no_selection')

  const offscreen = {
    kind: 'rectangle',
    positions: [
      Cesium.Cartesian3.fromDegrees(114.9, 30.9, 0),
      Cesium.Cartesian3.fromDegrees(114.95, 30.9, 0),
      Cesium.Cartesian3.fromDegrees(114.95, 30.95, 0),
    ],
  }
  assert.equal(batch.computeSelectionScreenCrop(viewer, Cesium, offscreen).reason, 'aoi_offscreen')

  const inside = {
    kind: 'rectangle',
    area_m2: 1850,
    positions: [
      Cesium.Cartesian3.fromDegrees(114.31, 30.51, 0), // (100, 100)
      Cesium.Cartesian3.fromDegrees(114.32, 30.51, 0), // (200, 100)
      Cesium.Cartesian3.fromDegrees(114.32, 30.52, 0), // (200, 200)
      Cesium.Cartesian3.fromDegrees(114.31, 30.52, 0), // (100, 200)
    ],
  }
  const cropped = batch.computeSelectionScreenCrop(viewer, Cesium, inside)
  assert.equal(cropped.ok, true)
  assert.deepEqual(cropped.crop, { left: 86, top: 86, width: 128, height: 128 })
})

test('AOI capture + requestSceneParse + host vision validation pass scope aoi cleanly', async () => {
  const Cesium = makeFakeCesium()
  const viewer = makeFakeViewer()
  const drawCalls = []
  const savedDoc = globalThis.document
  globalThis.document = {
    visibilityState: 'visible',
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args) => drawCalls.push(args) }),
      toDataURL: () => 'data:image/jpeg;base64,aoi',
    }),
  }
  try {
    const selection = {
      kind: 'lasso',
      area_m2: 900,
      positions: [
        Cesium.Cartesian3.fromDegrees(114.31, 30.51, 0), // (100, 100)
        Cesium.Cartesian3.fromDegrees(114.32, 30.51, 0), // (200, 100)
        Cesium.Cartesian3.fromDegrees(114.32, 30.52, 0), // (200, 200)
      ],
    }
    const frame = batch.captureSceneFrame({ viewer, Cesium, getLayers: () => [], selection, scope: 'aoi' })
    assert.equal(frame.scope, 'aoi')
    assert.deepEqual(frame.crop, { left: 86, top: 86, width: 128, height: 128 })
    // 2x device pixel ratio (canvas 800x600 over CSS 400x300): sx=172, sy=172, sw=256, sh=256
    assert.deepEqual(drawCalls[0].slice(1, 5), [172, 172, 256, 256])

    const sent = []
    await batch.requestSceneParse('/api/vision-batch', {
      frame,
      fetchImpl: async (_url, init) => {
        sent.push(JSON.parse(init.body))
        return { ok: true, json: async () => ({ ok: true, objects: [] }) }
      },
    })
    assert.equal(sent[0].scope, 'aoi')

    const validImage = pngDataUrl(128, 128)
    const validAoi = hostVision.validateVisionBatchRequest({
      frameId: 'f1',
      image: validImage,
      scope: 'aoi',
    })
    assert.equal(validAoi.scope, 'aoi')
    assert.equal(validAoi.width, 128)
    assert.equal(hostVision.validateVisionBatchRequest({ frameId: 'f2', image: validImage }).scope, 'view')

    let promptSeen = ''
    const mockModel = {
      provider: 'mock',
      model: 'vision-test',
      attachments: { saveImage: async () => ({ width: 128, height: 128 }) },
      llm: {
        async *stream(req) {
          promptSeen = req.messages[0].content.find((c) => c.type === 'text')?.text ?? ''
          yield {
            type: 'text-delta',
            index: 0,
            text: JSON.stringify({ objects: [{ class: 'building', confidence: 0.9, polygon: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]] }] }),
          }
          yield { type: 'finish', reason: { kind: 'stop' } }
        },
      },
    }
    const res = await hostVision.callVisionBatch(mockModel, validAoi, new AbortController().signal)
    assert.equal(res.objects.length, 1)
    assert.match(promptSeen, /cropped region-of-interest \(AOI\)/i)
  } finally {
    globalThis.document = savedDoc
  }
})

test('Building estimation: BatchTable metadata fusion + floor formula + HeightService exterior buffer ground', async () => {
  const Cesium = makeFakeCesium()
  assert.equal(batch.buildingFloorEstimate(null), null)
  assert.equal(batch.buildingFloorEstimate(1.9), null)
  assert.equal(batch.buildingFloorEstimate(2.5), 1)
  assert.equal(batch.buildingFloorEstimate(24), 8)

  // BatchTable pick case
  const viewerPick = makeFakeViewer({
    pick: () => ({
      getPropertyIds: () => ['building_name', 'height_m', 'floors'],
      getProperty: (k) => ({ building_name: '图书馆', height_m: 36, floors: 12 })[k],
    }),
  })
  const frameWithPick = {
    id: 'f-pick',
    viewer: viewerPick,
    Cesium,
    crop: { left: 0, top: 0, width: 100, height: 100 },
    cssWidth: 100,
    cssHeight: 100,
    point: [0.5, 0.5],
    isValid: () => true,
  }
  const square = [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]]
  const { features: metaFeatures } = batch.projectBatchObjects(frameWithPick, [
    { class: 'building', confidence: 0.88, polygon: square },
  ], { t })
  assert.equal(metaFeatures[0].properties.name, '图书馆')
  assert.equal(metaFeatures[0].properties.height_m, 36)
  assert.equal(metaFeatures[0].properties.est_floors, 12)
  assert.equal(metaFeatures[0].properties.height_source, 'batch_table')
  assert.equal(metaFeatures[0].properties.style, PARSE_CLASS_STYLES.building)

  // HeightService tileset refinement: roof inside [114.302..114.304, 30.502..30.504] is 48m,
  // surrounding exterior ring is 10m ground even though screen pickPosition only reported flat 12m!
  const fakeTileset = {
    ready: true,
    getHeight: (carto) => {
      const lon = (carto.longitude * 180) / Math.PI
      const lat = (carto.latitude * 180) / Math.PI
      const inside = lon >= 114.302 && lon <= 114.304 && lat >= 30.502 && lat <= 30.504
      return inside ? 48 : 10
    },
  }
  const viewerNoPick = makeFakeViewer()
  const frameFlatDepth = {
    id: 'f-hs',
    viewer: viewerNoPick,
    Cesium,
    crop: { left: 0, top: 0, width: 100, height: 100 },
    cssWidth: 100,
    cssHeight: 100,
    point: [0.5, 0.5],
    isValid: () => true,
  }
  const { features: flatDepthFeatures } = batch.projectBatchObjects(frameFlatDepth, [
    { class: 'building', confidence: 0.9, polygon: square },
  ], { t })
  assert.equal(flatDepthFeatures[0].properties.height_m, undefined)

  const refined = await batch.refineBatchMetricsWithHeightService(frameFlatDepth, flatDepthFeatures, {
    getLayers: () => [{ id: 'l1', visible: true, tileset: fakeTileset }],
  })
  assert.equal(refined.refined, 1)
  assert.equal(refined.features[0].properties.ground_height_m, 10)
  assert.equal(refined.features[0].properties.roof_height_m, 48)
  assert.equal(refined.features[0].properties.height_m, 38)
  assert.equal(refined.features[0].properties.est_floors, 13)
  assert.equal(refined.features[0].properties.height_source, 'tiles_height_service')

  // Terrain-only fallback: refines ground_height_m without overwriting depth-buffer roof height
  const terrainViewer = makeFakeViewer({ globeHeight: () => 15 })
  const terrainFrame = { ...frameFlatDepth, viewer: terrainViewer }
  const preTerrainFeatures = [{
    ...flatDepthFeatures[0],
    properties: { ...flatDepthFeatures[0].properties, ground_height_m: 20, roof_height_m: 45, height_m: 25 },
  }]
  const terrainRefined = await batch.refineBatchMetricsWithHeightService(terrainFrame, preTerrainFeatures, { getLayers: () => [] })
  assert.equal(terrainRefined.refined, 1)
  assert.equal(terrainRefined.features[0].properties.ground_height_m, 15)
  assert.equal(terrainRefined.features[0].properties.roof_height_m, 45)
  assert.equal(terrainRefined.features[0].properties.height_m, 30)
  assert.equal(terrainRefined.features[0].properties.est_floors, 10)
  assert.equal(terrainRefined.features[0].properties.height_source, 'terrain_height_service')
})

test('Categorical colors + sorting + ParseBody AOI workflow and dynamic filters', async () => {
  const Cesium = makeFakeCesium()
  const entities = []
  const viewer = {
    ...makeFakeViewer(),
    entities: { add: (e) => { entities.push(e); return e }, remove: () => {} },
  }
  for (const kind of batch.PARSE_CLASSES) {
    const c = parseClassColor(kind)
    assert.ok(c.hex && VECTOR_COLORS[c.styleKey])
  }
  batch.drawBatchPreview(Cesium, viewer, [
    {
      type: 'Feature',
      properties: { class: 'vegetation', style: 'success' },
      geometry: { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.301, 30.5], [114.301, 30.501], [114.3, 30.5]]] },
    },
  ])
  assert.equal(entities[0].polyline.material.hex, VECTOR_COLORS.success)

  const sortedByH = batch.sortBatchFeatures([
    { properties: { name: 'Low', height_m: 10, area_m2: 400 } },
    { properties: { name: 'None' } },
    { properties: { name: 'Tall', height_m: 45, area_m2: 120 } },
  ], 'height')
  assert.deepEqual(sortedByH.map((f) => f.properties.name), ['Tall', 'Low', 'None'])

  const savedDoc = globalThis.document
  const savedFetch = globalThis.fetch
  const fetchBodies = []
  globalThis.document = {
    visibilityState: 'visible',
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,ok' }),
  }
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('meta')) return { ok: true, json: async () => ({ visionBatchUrl: '/api/vision-batch' }) }
    fetchBodies.push(JSON.parse(init.body))
    return {
      ok: true,
      json: async () => ({
        ok: true,
        objects: [
          { class: 'building', confidence: 0.9, polygon: [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]] },
          { class: 'vegetation', confidence: 0.8, polygon: [[0.6, 0.6], [0.8, 0.6], [0.8, 0.8], [0.6, 0.8]] },
        ],
      }),
    }
  }
  const activeSelection = {
    kind: 'rectangle',
    area_m2: 1200,
    positions: [
      Cesium.Cartesian3.fromDegrees(114.305, 30.505, 0),
      Cesium.Cartesian3.fromDegrees(114.32, 30.505, 0),
      Cesium.Cartesian3.fromDegrees(114.32, 30.52, 0),
      Cesium.Cartesian3.fromDegrees(114.305, 30.52, 0),
    ],
  }
  try {
    const renderer = createRenderer(ParseBody, () => ({
      t,
      getCesium: () => Cesium,
      getViewer: () => viewer,
      getLayers: () => [],
      getSelection: () => activeSelection,
      openRequest: { id: 'parse', aoiSeq: 1, seq: 1 },
      showToast: () => {},
      onAdoptParse: () => true,
    }))
    const scopeBtns = findAll(renderer.tree(), (n) => hasClass(n, 'mv-parse-scope-btn'))
    assert.equal(scopeBtns.length, 2)
    assert.equal(scopeBtns[1].props['aria-pressed'], true)

    const runBtn = findAll(renderer.tree(), (n) => n.type === 'button' && textOf(n).includes('parse.run'))[0]
    await runBtn.props.onClick()
    assert.equal(fetchBodies[0].scope, 'aoi')

    const root = renderer.tree()
    assert.ok(findAll(root, (n) => hasClass(n, 'mv-parse-aoi-tag')).length === 1)
    assert.ok(findAll(root, (n) => hasClass(n, 'mv-parse-filter') && textOf(n).includes('parse.class.vegetation')).length === 1)
    assert.ok(findAll(root, (n) => hasClass(n, 'mv-parse-dot')).length >= 2)
    assert.ok(findAll(root, (n) => hasClass(n, 'mv-parse-class')).length === 2)
    assert.ok(findAll(root, (n) => hasClass(n, 'mv-parse-sort-btn')).length === 3)
  } finally {
    globalThis.document = savedDoc
    globalThis.fetch = savedFetch
  }
})

test('L2 whole-layer 2D/3D toggle: commandExtrusionSummary, toggleLayerExtrusion, LayersMap, and SelectionTool Parse AOI', () => {
  const bldgLayer = {
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { feature_id: 'b1', name: '塔楼', class: 'building', style: 'warm', ground_height_m: 10, roof_height_m: 40, height_m: 30, est_floors: 10, extruded: true, extruded_height_m: 40 },
          geometry: { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.301, 30.5], [114.301, 30.501], [114.3, 30.5]]] },
        },
      ],
    },
    style: 'warm',
    caption: '提取建筑',
    entities: [],
    drawn: 1,
  }
  const flatLayer = {
    geojson: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { feature_id: 'p1', name: '地块' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
      ],
    },
    style: 'accent',
    caption: '纯面图层',
    entities: [],
    drawn: 1,
  }
  const state = { draw: [], measure: [], drawCommands: [bldgLayer, flatLayer], measureCommands: [], drawnFeatures: 2, measuredCount: 0 }

  // 5-key lock preserved!
  const list = buildAgentOverlayList(state)
  assert.deepEqual(Object.keys(list[0]).sort(), ['detail', 'id', 'index', 'kind', 'label'])
  const extrusions = buildAgentOverlayExtrusions(state)
  assert.deepEqual(extrusions[0], { canExtrude: true, extruded: true, heightCount: 1, extrudedCount: 1 })
  assert.deepEqual(extrusions[1], { canExtrude: false, extruded: false, heightCount: 0, extrudedCount: 0 })

  const toasts = []
  const viewer = { entities: { remove: () => {} } }
  const actions = createAnnotationActions({
    stateRef: { current: state },
    viewerRef: { current: viewer },
    getSelection: () => null,
    draw: (geojson, style, caption) => { state.drawCommands.push({ geojson, style, caption, entities: [], drawn: 1 }) },
    showToast: (m) => toasts.push(m),
    t,
    onChanged: () => {},
  })

  // Height-less layer returns false
  assert.equal(actions.toggleLayerExtrusion(1), false)
  // Toggle building layer 3D -> 2D
  assert.equal(actions.toggleLayerExtrusion(0), true)
  const cmdAfter2d = state.drawCommands[state.drawCommands.length - 1]
  const feat2d = cmdAfter2d.geojson.features[0]
  assert.equal(feat2d.properties.extruded, false)
  assert.equal(feat2d.properties.height_m, 30)
  assert.equal(polygonVolume(feat2d.properties, feat2d.geometry.coordinates), null)
  assert.equal(commandExtrusionSummary(cmdAfter2d).extruded, false)
  assert.equal(toasts[toasts.length - 1], 'layers.layerFlattened2d')

  // Toggle back 2D -> 3D (note rebuildDrawCommand replaces command index in drawCommands)
  const rebuiltIdx = state.drawCommands.indexOf(cmdAfter2d)
  assert.equal(actions.toggleLayerExtrusion(rebuiltIdx), true)
  const cmdAfter3d = state.drawCommands[rebuiltIdx]
  const feat3d = cmdAfter3d.geojson.features[0]
  assert.equal(feat3d.properties.extruded, true)
  assert.deepEqual(polygonVolume(feat3d.properties, feat3d.geometry.coordinates), { mode: 'extruded', baseHeight: 10, extrudedHeight: 40 })
  assert.equal(toasts[toasts.length - 1], 'layers.layerExtruded3d')

  // LayersMap button rendering + callback
  const toggled = []
  const mapRenderer = createRenderer(LayersMap, () => ({
    t,
    config: { imagery: [], rasterOverlays: [] },
    settings: {},
    agentOverlays: list,
    overlayDetails: buildAgentOverlayDetails(state),
    overlayExtrusions: { 0: { canExtrude: true, extruded: true }, 1: { canExtrude: false, extruded: false } },
    onToggleOverlayExtrude: (idx) => toggled.push(idx),
  }))
  const dimBtns = findAll(mapRenderer.tree(), (n) => hasClass(n, 'mv-layer-dim-btn'))
  assert.equal(dimBtns.length, 1)
  assert.equal(textOf(dimBtns[0]), '3D')
  assert.equal(dimBtns[0].props['aria-pressed'], true)
  dimBtns[0].props.onClick()
  assert.deepEqual(toggled, [0])

  // SelectionTool shows "selection.parseAoi" when a ground selection is active
  const selViewer = { ...makeFakeViewer(), isDestroyed: () => false }
  const selCalls = []
  const selRenderer = createRenderer(SelectionTool, () => ({
    t,
    getCesium: () => makeFakeCesium(),
    getViewer: () => selViewer,
    showToast: () => {},
    onParseSelection: (sel) => selCalls.push(sel),
  }))
  const selTool = getSelectionTool(selViewer)
  selTool.selectAreaAround({ lon: 114.31, lat: 30.51, radiusM: 30, height: 12 })
  const parseAoiBtn = findAll(selRenderer.tree(), (n) => n.type === 'button' && textOf(n).includes('selection.parseAoi'))[0]
  assert.ok(parseAoiBtn)
  parseAoiBtn.props.onClick()
  assert.equal(selCalls.length, 1)
  assert.equal(selCalls[0].kind, 'area')
})

test('Phase 4 zh/en i18n keys exist symmetrically in MESSAGES', () => {
  const keys = [
    'parse.stage.heights',
    'parse.scopeView',
    'parse.scopeAoi',
    'parse.scopeAoiReady',
    'parse.scopeAoiNone',
    'parse.aoiTag',
    'parse.filterClass',
    'parse.sortDefault',
    'parse.sortHeight',
    'parse.sortArea',
    'parse.floors',
    'parse.err.aoi_offscreen',
    'selection.parseAoi',
    'selection.parseAoiHint',
    'layers.switch3d',
    'layers.switch2d',
    'layers.layerExtruded3d',
    'layers.layerFlattened2d',
  ]
  for (const key of keys) {
    assert.equal(typeof MESSAGES.zh[key], 'string', `missing zh key ${key}`)
    assert.equal(typeof MESSAGES.en[key], 'string', `missing en key ${key}`)
    assert.ok(MESSAGES.zh[key].trim().length > 0)
    assert.ok(MESSAGES.en[key].trim().length > 0)
  }
})
