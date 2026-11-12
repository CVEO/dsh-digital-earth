/**
 * v1.6 Batch 2 — Scene snapshot consistency (F01), large GeoJSON compaction (F02),
 * clip/skyline & stacked-shader schema completeness (F10), and water/shader engine lifecycle.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const {
  SCENE_STORE_VERSION,
  SCENE_STORE_MAX_BYTES,
  normalizeSceneSnapshot,
  readSceneSnapshot,
  writeSceneSnapshot,
} = await import('../src/client/scene-store.js')
const { createHostSceneStore } = await import('../src/client/scene/host-scene-store.js')
const { createShaderEngine } = await import('../src/client/scene/shader-engine.js')
const { SHADER_FRAGMENT_SOURCES } = await import('../src/client/shader/presets.js')

function withMemoryLocalStorage(run) {
  const previousWindow = globalThis.window
  const map = new Map()
  const localStorage = {
    get length() {
      return map.size
    },
    key(index) {
      return [...map.keys()][index] ?? null
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
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
// F10: normalizeSceneSnapshot supports clip/skyline analyses & stacked shaders
// ---------------------------------------------------------------------------

test('F10: normalizeSceneSnapshot 保留 clip / skyline 分析与 1..3 层叠加着色器预设', () => {
  for (const action of ['profile', 'flood', 'sunlight', 'clip', 'skyline']) {
    const snap = normalizeSceneSnapshot({
      v: SCENE_STORE_VERSION,
      savedAt: '2026-04-19T12:00:00.000Z',
      view: { lon: 114.3, lat: 30.5, height: 800, heading: 0, pitch: -45 },
      layers: [],
      annotations: { draw: [], measure: [] },
      analysis: { action, water_height: 35 },
      shaders: [
        { layer: 'city', preset: ['water', 'height-false-color'], params: { water_height: 28 } },
        { layer: 'terrain-mesh', preset: 'scan', params: { speed: 1.2 } },
      ],
    })
    assert.ok(snap)
    assert.equal(snap.savedAt, '2026-04-19T12:00:00.000Z')
    assert.equal(snap.analysis?.action, action, `${action} 分析必须在恢复时保留`)
    assert.equal(snap.shaders.length, 2)
    assert.deepEqual(snap.shaders[0].preset, ['water', 'height-false-color'])
    assert.equal(snap.shaders[1].preset, 'scan')
  }

  // 非法叠加栈（空数组、超过 3 个、含空串）仍被过滤
  const filtered = normalizeSceneSnapshot({
    v: SCENE_STORE_VERSION,
    layers: [],
    shaders: [
      { layer: 'a', preset: [] },
      { layer: 'b', preset: ['water', 'scan', 'contour', 'water-depth'] },
      { layer: 'c', preset: ['water', ''] },
    ],
  })
  assert.deepEqual(filtered.shaders, [])
})

// ---------------------------------------------------------------------------
// F01: Freshness comparison between localStorage and Host snapshot + trailing flush
// ---------------------------------------------------------------------------

test('F01: 10 秒节流窗口内本地删空图层或标注后刷新，loadSceneSnapshot 选用更新的本地快照并同步回宿主', async () => {
  await withMemoryLocalStorage(async () => {
    const hostPutBodies = []
    let hostStored = {
      savedAt: '2026-04-19T10:00:00.000Z',
      snapshot: {
        v: SCENE_STORE_VERSION,
        savedAt: '2026-04-19T10:00:00.000Z',
        view: { lon: 114.3, lat: 30.5, height: 1000, heading: 0, pitch: -45 },
        layers: [{ name: 'old-tileset', source: { path: 'D:/data/tileset.json' }, visible: true }],
        annotations: {
          draw: [{ geojson: { type: 'FeatureCollection', features: [] }, style: 'accent', drawn: 1 }],
          measure: [],
        },
        analysis: null,
        shaders: [],
      },
    }

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url, options = {}) => {
      if (options.method === 'PUT') {
        const parsed = JSON.parse(options.body)
        hostPutBodies.push(parsed)
        hostStored = { savedAt: parsed.snapshot.savedAt, snapshot: parsed.snapshot }
        return { ok: true }
      }
      return {
        ok: true,
        json: async () => hostStored,
      }
    }

    try {
      const store = createHostSceneStore({
        getMeta: () => ({ sceneUrl: 'https://host/scene', token: 'tok' }),
        loadMeta: async () => ({ sceneUrl: 'https://host/scene', token: 'tok' }),
        normalizeSceneSnapshot,
        readSceneSnapshot,
        writeSceneSnapshot,
        saveIntervalMs: 10000,
      })

      // 用户清空了图层和标注并写入本地（时间戳晚于宿主旧快照）
      writeSceneSnapshot('sess-f01', {
        savedAt: '2026-04-19T10:00:05.000Z',
        view: { lon: 114.3, lat: 30.5, height: 1000, heading: 0, pitch: -45 },
        layers: [],
        annotations: { draw: [], measure: [] },
        analysis: null,
        shaders: [],
      })

      const restored = await store.loadSceneSnapshot('sess-f01')
      assert.deepEqual(restored.layers, [], '已删除的旧图层不得复活')
      assert.deepEqual(restored.annotations.draw, [], '已清空的标注不得复活')
      assert.equal(hostPutBodies.length, 1, '更新的本地快照应立即回写宿主')
      assert.deepEqual(hostPutBodies[0].snapshot.layers, [])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('F01: 节流窗口内的写入会在窗口到期后自动补发最新快照（trailing flush）', async () => {
  const puts = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === 'PUT') puts.push(JSON.parse(options.body))
    return { ok: true }
  }
  try {
    const store = createHostSceneStore({
      getMeta: () => ({ sceneUrl: 'https://host/scene', token: 'tok' }),
      loadMeta: async () => ({ sceneUrl: 'https://host/scene', token: 'tok' }),
      normalizeSceneSnapshot,
      readSceneSnapshot: () => null,
      writeSceneSnapshot: () => null,
      saveIntervalMs: 80,
    })

    store.saveHostSceneSnapshot('s-trail', { seq: 1 })
    store.saveHostSceneSnapshot('s-trail', { seq: 2 })
    store.saveHostSceneSnapshot('s-trail', { seq: 3 })
    assert.equal(puts.length, 1, '窗口内只立即发送第 1 次')
    assert.equal(puts[0].snapshot.seq, 1)

    await new Promise((resolve) => setTimeout(resolve, 130))
    assert.equal(puts.length, 2, '节流窗口结束后自动补发最后一次状态')
    assert.equal(puts[1].snapshot.seq, 3)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ---------------------------------------------------------------------------
// F02: Large GeoJSON compaction & progressive retention under 512 KB
// ---------------------------------------------------------------------------

test('F02: 超 512 KB 的高精度多属性 GeoJSON 自动压缩坐标与属性并完整保留全部要素、测量和分析', async () => {
  await withMemoryLocalStorage(async () => {
    // 构造约 590 KB 的原始 GeoJSON（480 个多边形要素，带高精度坐标和冗长属性）
    const features = Array.from({ length: 480 }, (_, idx) => {
      const baseLon = 114.30000012345678 + (idx % 20) * 0.00100098765432
      const baseLat = 30.50000012345678 + Math.floor(idx / 20) * 0.00100098765432
      return {
        type: 'Feature',
        id: `bldg-${idx}`,
        properties: {
          name: `建筑-${idx}`,
          category: 'residential',
          floors: 18,
          unused_blob_1: 'x'.repeat(280),
          unused_blob_2: 'y'.repeat(280),
          extra_13: 'dropped',
          extra_14: 'dropped',
          extra_15: 'dropped',
          extra_16: 'dropped',
          extra_17: 'dropped',
          extra_18: 'dropped',
          extra_19: 'dropped',
          extra_20: 'dropped',
          extra_21: 'dropped',
          extra_22: 'dropped',
          extra_23: 'dropped',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [baseLon, baseLat, 45.123456789],
              [baseLon + 0.0005123456789, baseLat, 45.123456789],
              [baseLon + 0.0005123456789, baseLat + 0.0005123456789, 45.123456789],
              [baseLon, baseLat + 0.0005123456789, 45.123456789],
              [baseLon, baseLat, 45.123456789],
            ],
          ],
        },
      }
    })

    const rawSnapshot = {
      view: { lon: 114.31, lat: 30.51, height: 1200, heading: 0, pitch: -50 },
      layers: [{ name: 'wuhan', source: { path: 'D:/data/wuhan/tileset.json' }, visible: true }],
      annotations: {
        draw: [{ geojson: { type: 'FeatureCollection', features }, style: 'accent', drawn: features.length, caption: 'GeoJSON: buildings.geojson' }],
        measure: [{ mode: 'distance', points: [[114.3, 30.5, 20], [114.31, 30.51, 22]], draw: true, result: { distance_m: 1480 } }],
      },
      analysis: { action: 'flood', water_height: 32 },
      shaders: [{ layer: 'wuhan', preset: ['water', 'height-false-color'], params: { water_height: 32 } }],
    }

    assert.ok(JSON.stringify(rawSnapshot).length > SCENE_STORE_MAX_BYTES, '测试前提：原始快照超过 512 KB')

    const body = writeSceneSnapshot('sess-f02', rawSnapshot)
    assert.ok(body, '压缩后必须成功写入快照')
    assert.ok(JSON.stringify({ session: 'sess-f02', snapshot: body }).length <= SCENE_STORE_MAX_BYTES, '压缩后连同宿主信封也必须在 512 KB 以内')

    const restored = readSceneSnapshot('sess-f02')
    assert.ok(restored)
    assert.equal(restored.annotations.draw.length, 1, '绘制指令不得被整包清空')
    assert.equal(restored.annotations.draw[0].geojson.features.length, 480, '480 个要素应全部保留')
    assert.equal(restored.annotations.draw[0].geojson.features[0].id, 'bldg-0', 'feature.id 必须保留')
    assert.equal(restored.annotations.measure.length, 1, '测量结果不得被连坐清空')
    assert.equal(restored.analysis?.action, 'flood', '分析状态不得被连坐清空')
    assert.deepEqual(restored.shaders[0].preset, ['water', 'height-false-color'])
  })
})

test('F02: 压缩仍装不下时必须记录 compacted 标记，恢复时报告省略数量，小快照不得残留旧标记', async () => {
  const blob = 'p'.repeat(400)
  const heavyProperties = {}
  for (let index = 0; index < 20; index += 1) heavyProperties[`field_${index}`] = `${blob}${index}`
  // 40 个 draw 指令 × 10 个重属性要素，远超 512 KB；坐标与属性压缩后仍装不下，只能丢掉最旧的指令。
  const makeFeatures = (commandIndex) =>
    Array.from({ length: 10 }, (_, featureIndex) => ({
      type: 'Feature',
      id: `cmd${commandIndex}-f${featureIndex}`,
      properties: { name: `区块${commandIndex}-${featureIndex}`, ...heavyProperties },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [114.3 + commandIndex * 0.001, 30.5, 0],
            [114.3005 + commandIndex * 0.001, 30.5, 0],
            [114.3005 + commandIndex * 0.001, 30.5005, 0],
            [114.3 + commandIndex * 0.001, 30.5005, 0],
            [114.3 + commandIndex * 0.001, 30.5, 0],
          ],
        ],
      },
    }))
  const draw = Array.from({ length: 40 }, (_, commandIndex) => ({
    geojson: { type: 'FeatureCollection', features: makeFeatures(commandIndex) },
    style: 'accent',
    drawn: 10,
    caption: `chunk-${commandIndex}.geojson`,
  }))

  await withMemoryLocalStorage(() => {
    const body = writeSceneSnapshot('sess-f02-marker', {
      view: { lon: 114.3, lat: 30.5, height: 1200, heading: 0, pitch: -50 },
      layers: [],
      annotations: { draw, measure: [] },
      analysis: null,
      shaders: [],
    })
    assert.ok(body, '超出配额时仍必须写入精简后的快照')
    assert.equal(body.compacted?.level, 'features', '必须标记精简级别')
    assert.ok(body.compacted.dropped_draw > 0, '必须报告省略的标注指令数量')
    assert.ok(JSON.stringify({ session: 'sess-f02-marker', snapshot: body }).length <= SCENE_STORE_MAX_BYTES)

    const restored = readSceneSnapshot('sess-f02-marker')
    assert.ok(restored.compacted, '恢复时必须带上精简标记，供面板提示用户')
    assert.equal(restored.compacted.dropped_draw, body.compacted.dropped_draw)
    assert.ok(restored.annotations.draw.length < draw.length)
    // The oldest surviving command may keep only part of its features, hence +1.
    assert.equal(restored.annotations.draw.length, draw.length - body.compacted.dropped_draw + 1)
    const keptFeatures = restored.annotations.draw.reduce((sum, cmd) => sum + cmd.geojson.features.length, 0)
    assert.equal(keptFeatures, 400 - body.compacted.dropped_features, '省略要素数必须与恢复后的实际要素数互补')

    // 之后的小快照必须清掉上一次的标记，否则界面会误报省略。
    const small = writeSceneSnapshot('sess-f02-marker', {
      view: { lon: 114.3, lat: 30.5, height: 500, heading: 0, pitch: -45 },
      layers: [],
      annotations: { draw: [], measure: [] },
      analysis: null,
      shaders: [],
    })
    assert.ok(small)
    assert.equal(small.compacted, undefined, '小快照不得携带上一次的 compacted')
    assert.equal(readSceneSnapshot('sess-f02-marker').compacted, undefined)
  })
})

// ---------------------------------------------------------------------------
// Section 5.2: Water close-up ripple octave & shader engine u_time preservation
// ---------------------------------------------------------------------------

test('Water 与 ShaderEngine：近景波纹分量存在，调参不重置 u_time，tick 触发 requestRender', async () => {
  assert.match(SHADER_FRAGMENT_SOURCES.water, /smoothstep\(0\.08, 0\.45, footprint\)/, 'water 必须包含近景街区/单体尺度的细波纹分量')

  let renderRequests = 0
  const listeners = new Set()
  const setUniformCalls = []
  class FakeCustomShader {
    constructor(options) {
      this.uniforms = {}
      for (const [k, v] of Object.entries(options.uniforms ?? {})) this.uniforms[k] = { value: v.value }
    }
    setUniform(name, value) {
      setUniformCalls.push([name, value])
      this.uniforms[name] = { value }
    }
  }
  const Cesium = {
    CustomShader: FakeCustomShader,
    CustomShaderTranslucencyMode: { INHERIT: 1 },
    UniformType: { VEC3: 'vec3', FLOAT: 'float' },
    Cartesian3: { fromDegrees: () => ({ x: 6378137, y: 0, z: 0 }) },
    Cartographic: { fromCartesian: () => ({ height: 20 }) },
  }
  const viewer = {
    scene: {
      requestRender: () => {
        renderRequests += 1
      },
      preRender: {
        addEventListener: (fn) => listeners.add(fn),
        removeEventListener: (fn) => listeners.delete(fn),
      },
    },
  }
  const layer = {
    id: 'l1',
    name: 'CityMesh',
    visible: true,
    kind: 'tiles',
    tileset: { customShader: null, root: { boundingVolume: { minimumHeight: 0, maximumHeight: 120 } } },
  }
  const entries = { current: new Map() }
  const tickRef = { current: null }
  const activeSnapshots = []

  const engine = createShaderEngine({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    getLayers: () => [layer],
    findLayer: () => layer,
    entries,
    tickRef,
    setShaderActive: (list) => activeSnapshots.push(list),
  })

  await engine.command({ action: 'apply', preset: 'water', speed: 1.0, amplitude: 1.0 })
  assert.equal(listeners.size, 1)
  const [tick] = [...listeners]
  tick()
  const timeAfterTick = layer.tileset.customShader.uniforms.u_time.value
  assert.ok(timeAfterTick > 0, 'preRender tick 应推进 u_time')
  const rendersBeforeSlider = renderRequests

  // 拖动滑块原位更新同一个 preset 的参数：u_time 不得被重置回 0，且 activeSnapshots 必须刷新新参数
  await engine.command({ action: 'apply', preset: 'water', speed: 2.0, amplitude: 1.8 })
  assert.equal(layer.tileset.customShader.uniforms.u_time.value, timeAfterTick, '滑块实时预览更新参数时不得把 u_time 重置为 0')
  assert.equal(activeSnapshots.at(-1)?.[0]?.params?.speed, 2.0, '原位更新参数后应同步更新 shaderActive 状态')
  assert.ok(renderRequests > rendersBeforeSlider, '原位更新参数与 tick 应请求重绘')
})
