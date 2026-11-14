/**
 * High-precision elevation profile tests:
 *   - adaptive ~1 m base density + midpoint edge refinement for flat bridges/walls
 *   - non-uniform geodesic distance alignment & +0.5 m offset in profile-edit
 *   - localized AnalysisCard warning copy
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

await import('react')
const { MESSAGES } = await import('../src/client/messages.js')
const {
  PROFILE_AUTO_MAX_BASE,
  PROFILE_MAX_SAMPLES,
  PROFILE_MIN_BASE_SAMPLES,
  PROFILE_SURFACE_OFFSET_M,
  autoProfileSamples,
  collectProfileRefinementFractions,
  sampleProfileEntries,
} = await import('../src/client/analysis/math.js')
const { createProfileEdit } = await import('../src/client/scene/profile-edit.js')
const { AnalysisCard } = await import('../src/client/ui/cards.js')

function translate(dict = MESSAGES.zh) {
  return (key, params) => {
    let text = dict[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v))
    }
    return text
  }
}

function collectText(node, out = []) {
  if (node == null || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out)
    return out
  }
  if (typeof node.type === 'function') {
    return collectText(node.type({ ...(node.props ?? {}), children: node.children }), out)
  }
  if (node.children) collectText(node.children, out)
  return out
}

function findElements(node, pred, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) findElements(item, pred, out)
    return out
  }
  if (typeof node.type === 'function') {
    return findElements(node.type({ ...(node.props ?? {}), children: node.children }), pred, out)
  }
  if (pred(node)) out.push(node)
  if (node.children) findElements(node.children, pred, out)
  return out
}

test('autoProfileSamples：短距保底 64 点，中距按约 1 m 加密，长距封顶 320 点', () => {
  assert.equal(autoProfileSamples(0), PROFILE_MIN_BASE_SAMPLES)
  assert.equal(autoProfileSamples(25), PROFILE_MIN_BASE_SAMPLES)
  assert.equal(autoProfileSamples(246), 247)
  assert.equal(autoProfileSamples(1500), PROFILE_AUTO_MAX_BASE)
})

test('桥梁平顶与陡坎剖面：自适应密度 + 边缘二分加密保持平直桥面与锐利桥台', async () => {
  const length = 246
  const Cesium = { Cartographic: class {} }
  const geodesic = {
    interpolateUsingFraction(fraction) {
      return { fraction, longitude: fraction, latitude: 0.5 }
    },
  }
  const sampler = {
    async sampleMany(probes) {
      const values = probes.map((carto) => {
        const d = carto.fraction * length
        const height = d >= 110 && d <= 134 ? 27.4 : 2.0
        return { height, source: 'tiles' }
      })
      return { values }
    },
  }

  const baseSamples = autoProfileSamples(length)
  const { entries, points, withData } = await sampleProfileEntries({
    Cesium,
    geodesic,
    length,
    baseSamples,
    maxPoints: PROFILE_MAX_SAMPLES,
    heightMode: 'tiles',
    sampler,
  })

  assert.equal(withData, points.length)
  assert.ok(points.length > baseSamples, '桥台陡坎应触发额外二分加密点')
  assert.ok(points.length <= PROFILE_MAX_SAMPLES)

  // Bridge deck points remain flat at 27.4 m across the 24 m span.
  const deckPoints = points.filter((p) => p.distance_m >= 110 && p.distance_m <= 134)
  assert.ok(deckPoints.length >= 24, `桥面应保留至少 24 个采样点，实际 ${deckPoints.length}`)
  assert.ok(deckPoints.every((p) => p.height_m === 27.4), '桥面高程应保持平坦一致')

  // Refinement clustered sub-meter points right around both abutment walls (110 m & 134 m).
  const leftTransition = entries.filter((e) => e.fraction * length > 108.5 && e.fraction * length < 111.5)
  assert.ok(leftTransition.length >= 5, '桥台边缘应被二分加密到亚米级')

  // Flat sections should not generate refinement probes.
  const flatEntries = [
    { fraction: 0, height: 10 },
    { fraction: 0.5, height: 10.2 },
    { fraction: 1, height: 10.1 },
  ]
  assert.deepEqual(collectProfileRefinementFractions(flatEntries, 100, 32), [])
})

test('profile-edit：非均匀距离采样点按真实 distance_m 放置三维标点，并显示 0.1 m 读数', () => {
  const entities = []
  const Cesium = {
    EllipsoidGeodesic: class {
      interpolateUsingFraction(fraction) {
        return { longitude: fraction, latitude: 0 }
      }
    },
    Cartographic: class {
      static fromDegrees(lon, lat) { return { lon, lat } }
    },
    Cartesian3: {
      fromRadians: (lon, lat, height) => ({ lon, lat, height }),
      distance: (a, b) => Math.hypot(a.lon - b.lon, a.lat - b.lat, (a.height ?? 0) - (b.height ?? 0)),
    },
    Color: {
      WHITE: {},
      fromCssColorString: () => ({ withAlpha: () => ({}) }),
    },
    LabelStyle: { FILL_AND_OUTLINE: 0 },
    VerticalOrigin: { BOTTOM: 0 },
    Cartesian2: class {
      constructor(x, y) { this.x = x; this.y = y }
    },
  }
  const viewer = {
    scene: { canvas: { style: {} }, requestRender() {} },
    entities: {
      add(spec) {
        entities.push(spec)
        return spec
      },
      remove() {},
    },
  }
  const root = { querySelector: () => null, contains: () => false }
  const editor = createProfileEdit({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    getRoot: () => root,
    t: translate(),
  })

  editor.sync({
    operation: 'profile',
    result: {
      from: [114.0, 30.0],
      to: [114.001, 30.0],
      length_m: 100,
      height_mode: 'tiles',
      points: [
        { distance_m: 0, height_m: 2 },
        { distance_m: 20, height_m: 2 },
        { distance_m: 20.5, height_m: 27.4 },
        { distance_m: 100, height_m: 27.4 },
      ],
    },
  })

  // Hovering index 2 (20.5 m) must map to fraction 0.205, NOT uniform 2/3 ≈ 0.667.
  editor.setHover(2)
  const readout = entities.find((e) => typeof e.id === 'string' && e.id.startsWith('profile-readout-'))
  assert.ok(readout, 'setHover 应添加三维高程读数实体')
  assert.ok(Math.abs(readout.position.lon - 0.205) < 1e-6, `预期 fraction=0.205，实际 ${readout.position.lon}`)
  assert.equal(readout.position.height, 27.4 + PROFILE_SURFACE_OFFSET_M)
  assert.equal(readout.label.text, '20.5 m · 27.4 m')
})

test('AnalysisCard：提示信息以本地化可读文案展示并在 title 保留原始状态码', () => {
  const card = AnalysisCard({
    t: translate(),
    state: {
      operation: 'profile',
      layerName: 'Viaduct',
      result: {
        length_m: 246,
        samples: 260,
        height_mode: 'tiles',
        height_source: 'tiles',
        warnings: ['surface_height_from_tiles', 'tiles_height_unavailable'],
        stats: { min_height: 1.5, max_height: 27.4, relief_m: 25.9, gain_m: 30.2, loss_m: 28.4 },
        points: [
          { distance_m: 0, height_m: 2 },
          { distance_m: 120, height_m: 27.4 },
          { distance_m: 246, height_m: 2 },
        ],
      },
    },
    onClear: () => {},
  })

  const warningEl = findElements(card, (el) => el.props?.className === 'warnings')[0]
  assert.ok(warningEl, 'AnalysisCard 应渲染 warnings 段落')
  assert.equal(warningEl.props.title, 'surface_height_from_tiles · tiles_height_unavailable')
  const text = collectText(warningEl).join('')
  assert.match(text, /3D Tiles 表面采样/)
  assert.match(text, /部分点位未命中 3D Tiles/)
  assert.doesNotMatch(text, /surface_height_from_tiles/)
})
