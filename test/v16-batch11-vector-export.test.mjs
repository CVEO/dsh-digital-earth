/**
 * v1.6 Batch 11 — F3: export the vector overlay layer (download / host / chat).
 *
 * The merge and the ceilings are pure; the delivery paths are tested with a fake
 * fetch so a failed host route or a missing session cannot look like success.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const exporter = await import('../src/client/scene/vector-export.js')
const serviceModule = await import('../src/client/scene/vector-export-service.js')
const { EXPORT_MESSAGES } = await import('../src/client/messages-export.js')
const { MESSAGES } = await import('../src/client/messages.js')

const square = {
  type: 'Feature',
  properties: { name: '研究区', kind: 'area', source: 'manual' },
  geometry: {
    type: 'Polygon',
    coordinates: [[[114.3, 30.5], [114.4, 30.5], [114.4, 30.6], [114.3, 30.6], [114.3, 30.5]]],
  },
}
const dot = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [114.32, 30.52] } }

const drawCommand = { geojson: { type: 'FeatureCollection', features: [square, dot] }, style: 'accent', drawn: 2 }
const measureCommand = {
  mode: 'distance',
  points: [{ lon: 114.3, lat: 30.5 }, { lon: 114.31, lat: 30.5 }],
  draw: true,
  result: { total_m: 962.3 },
}

function fakeState() {
  return { drawCommands: [drawCommand], measureCommands: [measureCommand] }
}

function makeService({ meta = { exportVectorUrl: '/export/vector/token', injectUrl: '/inject/token' }, session = 'session-1', fetchImpl } = {}) {
  const toasts = []
  const calls = []
  const fetchShim = fetchImpl ?? (async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return { ok: true, json: async () => ({ path: 'C:/dsh/exports/earth-vector-1.geojson', count: 3, bytes: 100 }) }
  })
  const service = serviceModule.createVectorExport({
    stateRef: { current: fakeState() },
    getMeta: () => meta,
    getSession: () => session,
    showToast: (message) => toasts.push(message),
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    fetchImpl: fetchShim,
  })
  return { service, toasts, calls }
}

test('collectVectorFeatures：标注与量测合并，来源属性补齐，不修改原对象', () => {
  const before = JSON.stringify({ drawCommand, measureCommand })
  const built = exporter.collectVectorFeatures(fakeState())
  assert.equal(built.ok, true)
  assert.equal(built.features.length, 3)
  const [area, point, measure] = built.features
  assert.equal(area.properties.name, '研究区')
  assert.deepEqual(area.properties.provenance, { source: 'manual', tool: 'annotation', basis: 'measured' })
  // An unnamed import still exports: a stable, non-invented fallback name.
  assert.equal(point.properties.name, 'annotation-2')
  assert.equal(point.properties.kind, 'point')
  assert.equal(measure.geometry.type, 'LineString')
  assert.equal(measure.properties.source, 'measure')
  assert.equal(measure.properties.distance_m, 962.3)
  assert.deepEqual(measure.properties.provenance, { source: 'measure', tool: 'measure', basis: 'measured' })
  assert.equal(JSON.stringify({ drawCommand, measureCommand }), before)
})

test('collectVectorFeatures：空层与两种上限都返回明确错误', () => {
  assert.equal(exporter.collectVectorFeatures({ drawCommands: [], measureCommands: [] }).error, 'empty')
  assert.equal(JSON.parse(JSON.stringify(exporter.collectVectorFeatures({ drawCommands: [] }))).ok, false)
  const many = { drawCommands: [{ geojson: { type: 'FeatureCollection', features: new Array(501).fill(square) }, style: 'accent', drawn: 501 }] }
  assert.equal(exporter.collectVectorFeatures(many).error, 'too_many_features')
  const dense = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: new Array(20001).fill([114.3, 30.5]) },
      },
    ],
  }
  assert.equal(
    exporter.collectVectorFeatures({ drawCommands: [{ geojson: dense, style: 'accent', drawn: 1 }] }).error,
    'too_many_coordinates',
  )
})

test('vectorExport：坐标 6 位、bbox 正确、文本可被重新解析', () => {
  const noisy = {
    type: 'Feature',
    properties: { name: '噪声' },
    geometry: { type: 'LineString', coordinates: [[114.123456789, 30.987654321], [114.2, 30.9]] },
  }
  const built = exporter.collectVectorFeatures({ drawCommands: [{ geojson: { type: 'FeatureCollection', features: [noisy] }, style: 'accent', drawn: 1 }] })
  const coordinates = built.features[0].geometry.coordinates
  assert.deepEqual(coordinates[0], [114.123457, 30.987654])
  const bbox = exporter.vectorBbox(built.features)
  assert.equal(bbox.west, 114.123457)
  assert.equal(bbox.east, 114.2)
  assert.equal(bbox.south, 30.9)
  assert.equal(bbox.north, 30.987654)
  const collection = exporter.vectorExportCollection(built.features, { name: ' 矢量叠加 ' })
  assert.equal(collection.name, '矢量叠加')
  assert.equal(collection.type, 'FeatureCollection')
  assert.deepEqual(JSON.parse(exporter.vectorExportText(collection)), collection)
  assert.match(exporter.vectorExportFileName('2026-11-12T20:30:00Z'), /^vector-overlay-2026-11-12T20-30-00Z\.geojson$/)
})

test('service.save：POST 到 page-only 路由并提示路径', async () => {
  const { service, toasts, calls } = makeService()
  const saved = await service.save()
  assert.equal(saved.path, 'C:/dsh/exports/earth-vector-1.geojson')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/export/vector/token')
  assert.equal(calls[0].body.kind, 'vector')
  assert.equal(calls[0].body.features.length, 3)
  assert.ok(toasts.some((toast) => toast.startsWith('vectorExport.saved')))
  assert.ok(toasts.some((toast) => toast.includes('C:/dsh/exports/earth-vector-1.geojson')))
})

test('service.send：没有会话时只提示，不发请求', async () => {
  const { service, toasts, calls } = makeService({ session: null })
  assert.equal(service.canSend(), false)
  assert.equal(await service.send(), null)
  assert.equal(calls.length, 0)
  assert.ok(toasts.includes('vectorExport.noSession'))
})

test('service.send：新版宿主一次请求写文件并附到对话，不再注入路径', async () => {
  const calls = []
  const toasts = []
  const meta = { exportVectorUrl: '/export/vector/token', injectUrl: '/inject/token', exportVectorChatUrl: '/export/vector/chat/token' }
  const service = serviceModule.createVectorExport({
    stateRef: { current: fakeState() },
    getMeta: () => meta,
    getSession: () => 'session-1',
    showToast: (message) => toasts.push(message),
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ ok: true, injected: true, attached: true, path: 'C:/dsh/exports/earth-vector-2.geojson', count: 3 }) }
    },
  })
  const receipt = await service.send()
  assert.equal(receipt.attached, true)
  assert.equal(calls.length, 1, '附件路由只需一次请求')
  assert.equal(calls[0].url, '/export/vector/chat/token')
  assert.equal(calls[0].body.kind, 'vector')
  assert.equal(calls[0].body.session, 'session-1')
  assert.equal(calls[0].body.features.length, 3)
  assert.ok(calls[0].body.text.includes('114.3'), '通知里带上真实 bbox')
  assert.ok(toasts.some((toast) => toast.startsWith('vectorExport.sentAttached')))
})

test('service.send：宿主没能附上附件时，如实提示文件已保存', async () => {
  const toasts = []
  const service = serviceModule.createVectorExport({
    stateRef: { current: fakeState() },
    getMeta: () => ({ exportVectorChatUrl: '/export/vector/chat/token', injectUrl: '/inject/token' }),
    getSession: () => 'session-1',
    showToast: (message) => toasts.push(message),
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ ok: true, injected: true, attached: false, reason: 'attachment_unavailable', path: 'C:/dsh/exports/earth-vector-3.geojson', count: 3 }),
    }),
  })
  const receipt = await service.send()
  assert.equal(receipt.attached, false)
  assert.equal(toasts.some((toast) => toast.startsWith('vectorExport.sentAttached')), false, '不得谎称附件')
  assert.ok(toasts.some((toast) => toast.startsWith('vectorExport.saved')))
  assert.ok(toasts.some((toast) => toast.includes('earth-vector-3.geojson')))
})

test('service.send：旧宿主没有附件路由时，先写文件再把路径注入对话', async () => {
  const { service, toasts, calls } = makeService()
  assert.equal(service.canSend(), true)
  const saved = await service.send()
  assert.equal(saved.path, 'C:/dsh/exports/earth-vector-1.geojson')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, '/inject/token')
  assert.equal(calls[1].body.session, 'session-1')
  assert.ok(calls[1].body.text.includes('C:/dsh/exports/earth-vector-1.geojson'))
  assert.ok(calls[1].body.text.includes('114.3'))
  assert.ok(toasts.some((toast) => toast.startsWith('vectorExport.sent')))
})

test('service：宿主失败或无导出接口时给出可执行的下一步', async () => {
  const failing = makeService({ fetchImpl: async () => ({ ok: false, status: 413, json: async () => ({}) }) })
  assert.equal(await failing.service.save(), null)
  assert.ok(failing.toasts.some((toast) => toast.startsWith('vectorExport.failed')))

  const noRoute = makeService({ meta: {} })
  assert.equal(await noRoute.service.save(), null)
  assert.ok(noRoute.toasts.includes('vectorExport.hostUnavailable'))
  assert.equal(noRoute.calls.length, 0)
})

test('service.download：无浏览器环境时报告失败而不是假成功', () => {
  const { service, toasts } = makeService()
  assert.equal(service.download(), false)
  assert.ok(toasts.some((toast) => toast.startsWith('vectorExport.failed')))
})

test('i18n：导出文案中英齐全并已并入主表', () => {
  for (const key of Object.keys(EXPORT_MESSAGES.zh)) {
    assert.equal(typeof EXPORT_MESSAGES.en[key], 'string', `en ${key}`)
    assert.equal(MESSAGES.zh[key], EXPORT_MESSAGES.zh[key], `zh table ${key}`)
    assert.equal(MESSAGES.en[key], EXPORT_MESSAGES.en[key], `en table ${key}`)
  }
})

test('vectorCoordinateCount / vectorBbox：GeometryCollection 递归计数与取界', () => {
  const collection = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'LineString', coordinates: [[114.3, 30.5], [114.4, 30.6]] },
        { type: 'Point', coordinates: [114.5, 30.7] },
      ],
    },
  }
  assert.equal(exporter.vectorCoordinateCount([collection]), 3)
  assert.deepEqual(exporter.vectorBbox([collection]), { west: 114.3, south: 30.5, east: 114.5, north: 30.7 })
})

test('service.send：连点两次只写一个文件、只发一次请求', async () => {
  const meta = { exportVectorUrl: '/export/vector/token', injectUrl: '/inject/token', exportVectorChatUrl: '/export/vector/chat/token' }
  const calls = []
  let settle = null
  const { service } = makeService({
    meta,
    fetchImpl: (url) => {
      calls.push(url)
      return new Promise((resolve) => {
        settle = () => resolve({ ok: true, json: async () => ({ injected: true, attached: true, path: 'C:/dsh/exports/earth-vector-1.geojson', count: 2 }) })
      })
    },
  })
  const first = service.send()
  const second = service.send()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(calls.length, 1, 'the in-flight send must be reused')
  settle()
  const [a, b] = await Promise.all([first, second])
  assert.equal(a, b)
  assert.equal(calls.length, 1)
})
