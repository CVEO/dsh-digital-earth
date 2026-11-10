/**
 * v1.5.2 P0 4.1 — capture camera metadata and the JSON sidecar.
 *
 * The Agent capture used to hand back only a file path. These tests pin the
 * additive provenance contract end to end:
 *
 *   - the page reports captured_at/camera/center/layers/imagery/terrain/version;
 *   - the Host accepts only whitelisted metadata fields, writes `<image>.json`
 *     next to the picture and echoes the validated document back;
 *   - a failed sidecar write never fails the capture;
 *   - pruning keeps the image quota (50) and removes orphan sidecars;
 *   - the earth_capture tool result and its rendered text carry the full camera
 *     pose, the capture time and the sidecar path (six-tool contract unchanged).
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, promises as nodeFs, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRepoFile } from './helpers/source.mjs'

// The Host resolves DSH_HOME once at import time, so point it at a throwaway
// folder BEFORE loading any project module. `node --test` runs each file in its
// own process, so this cannot leak into the other suites.
const HOME = mkdtempSync(join(tmpdir(), 'dsh-capture-metadata-'))
process.env.DSH_HOME = HOME

const { TOKEN, CAPTURES_DIR, MAX_CAPTURE_FILES } = await import('../src/host/constants.js')
const { captureHandler } = await import('../src/host/storage.js')
const { createCaptureTool } = await import('../src/host/tools/capture.js')
const { createCaptureService } = await import('../src/client/scene/capture.js')
const { createCommandBridge } = await import('../src/client/scene/command-bridge.js')

const t = (key, params) => (params ? `${key}:${params.message ?? params.path ?? params.width ?? ''}` : key)

after(() => {
  rmSync(HOME, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Client: what the panel reports with a capture.
// ---------------------------------------------------------------------------

function fakeDocument() {
  return {
    visibilityState: 'visible',
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {} }),
        toDataURL: () => 'data:image/jpeg;base64,AAAA',
      }
    },
  }
}

function fakeViewer() {
  return {
    resolutionScale: 1,
    canvas: { width: 1280, height: 720, clientWidth: 1280, clientHeight: 720 },
    resize() {},
    render() {},
    camera: {
      positionCartographic: { longitude: (116.4 * Math.PI) / 180, latitude: (39.9 * Math.PI) / 180, height: 2500 },
      heading: (37 * Math.PI) / 180,
      pitch: (-45 * Math.PI) / 180,
      pickEllipsoid: () => null,
      getPickRay: () => null,
    },
    scene: { pickPositionSupported: false, globe: { pick: () => null, ellipsoid: {} } },
  }
}

/** Just enough Cesium for the view-centre pick. */
function fakeCesium(center = { longitude: (116.4 * Math.PI) / 180, latitude: (39.9 * Math.PI) / 180, height: 48 }) {
  return {
    Cartesian2: class {
      constructor(x, y) {
        this.x = x
        this.y = y
      }
    },
    Cartographic: { fromCartesian: () => center },
  }
}

function makeCaptureService({ viewer, Cesium }) {
  globalThis.document = fakeDocument()
  return createCaptureService({
    getViewer: () => viewer,
    getRoot: () => ({ offsetWidth: 800, offsetHeight: 600 }),
    getSettings: () => ({
      settings: { screenshotHud: false, imagery: 'esri', terrain: 'ellipsoid' },
      imagery: [{ id: 'esri', name: 'Esri Imagery' }],
      terrain: [{ id: 'ellipsoid', name: 'Ellipsoid' }],
    }),
    getMeta: () => ({ captureUrl: 'https://host/capture', token: 'tok', version: '1.8.2' }),
    getSession: () => 's1',
    getCesium: () => Cesium,
    getLayers: () => [
      { id: 'l1', name: 'Clermont', visible: true, kind: 'mesh' },
      { id: 'l2', name: 'Splat', visible: false, kind: '3dgs' },
      { id: 'l3', name: '', visible: true, kind: null },
    ],
    t,
    showToast: () => {},
    setChromeHidden: () => {},
    nextFrames: async () => {},
    drawCaptureOverlay: () => {},
  })
}

function captureWithFetchedJson(json, deps) {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => json }
  }
  const restoreDocument = globalThis.document
  return {
    calls,
    service: makeCaptureService(deps),
    restore() {
      globalThis.fetch = originalFetch
      globalThis.document = restoreDocument
    },
  }
}

test('captureScene：POST 携带完整相机/场景元数据', async () => {
  const viewer = fakeViewer()
  viewer.scene.pickPositionSupported = true
  viewer.scene.pickPosition = () => ({ x: 1, y: 2, z: 3 })
  const run = captureWithFetchedJson({ path: '/captures/earth-a.jpg', width: 1280, height: 720, bytes: 12 }, { viewer, Cesium: fakeCesium() })
  try {
    const saved = await run.service.captureScene({ label: 'meta' }, 'sess-1')
    assert.equal(run.calls.length, 1)
    const body = JSON.parse(run.calls[0].options.body)
    assert.equal(body.label, 'meta')
    assert.equal(new Date(body.metadata.captured_at).toISOString(), body.metadata.captured_at, 'captured_at 必须是 ISO 时间')
    assert.deepEqual(body.metadata.camera, { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45 })
    assert.deepEqual(body.metadata.center, { lon: 116.4, lat: 39.9, height: 48 })
    // 空名字的图层不发；kind 保留 mesh/3dgs 以便读者解释图层类型。
    assert.deepEqual(body.metadata.layers, [
      { name: 'Clermont', visible: true, kind: 'mesh' },
      { name: 'Splat', visible: false, kind: '3dgs' },
    ])
    assert.equal(body.metadata.imagery, 'Esri Imagery')
    assert.equal(body.metadata.terrain, 'Ellipsoid')
    assert.equal(body.metadata.plugin_version, '1.8.2')
    // 旧宿主没有 metadata 回显：回调方仍拿到页面自己算出的元数据。
    assert.equal(saved.metadata.camera.heading, 37)
    assert.equal(saved.metadata_path, null)
  } finally {
    run.restore()
  }
})

test('captureScene：中心点取不到时 center 为 null，不编造坐标', async () => {
  const run = captureWithFetchedJson({ path: '/captures/earth-b.jpg' }, { viewer: fakeViewer(), Cesium: null })
  try {
    await run.service.captureScene()
    const body = JSON.parse(run.calls[0].options.body)
    assert.equal(body.metadata.center, null)
    assert.deepEqual(body.metadata.camera, { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45 })
  } finally {
    run.restore()
  }
})

test('captureScene：优先使用宿主回传的已校验元数据与 metadata_path', async () => {
  const echoed = {
    schema_version: 1,
    captured_at: '2026-05-01T02:00:00.000Z',
    camera: null,
    center: null,
    layers: [],
    imagery: null,
    terrain: null,
    plugin_version: null,
    size: { width: 1280, height: 720, bytes: 12 },
  }
  const run = captureWithFetchedJson(
    { path: '/captures/earth-c.jpg', metadata_path: '/captures/earth-c.jpg.json', metadata: echoed },
    { viewer: fakeViewer(), Cesium: null },
  )
  try {
    const saved = await run.service.captureScene()
    assert.equal(saved.metadata.captured_at, echoed.captured_at)
    assert.equal(saved.metadata_path, '/captures/earth-c.jpg.json')
  } finally {
    run.restore()
  }
})

test('ViewerSurface 把 Cesium 与图层列表注入 capture service', () => {
  const source = readRepoFile('src/client/viewer/ViewerSurface.js')
  const wiring = source.slice(
    source.indexOf('const capture = createCaptureService({'),
    source.indexOf('const { renderSnapshot, screenshot, captureScene } = capture'),
  )
  assert.match(wiring, /getCesium: \(\) => cesiumRef\.current/)
  assert.match(wiring, /getLayers: \(\) => layersRef\.current/)
})

// ---------------------------------------------------------------------------
// Host: captureHandler writes the whitelisted sidecar.
// ---------------------------------------------------------------------------

const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`

function fakeRequest(payload) {
  const body = JSON.stringify(payload)
  return {
    method: 'POST',
    url: `/api/3dviewer/capture?token=${TOKEN}`,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body)
    },
    destroy() {},
  }
}

function fakeResponse() {
  return {
    status: 0,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(body) {
      this.body = body ?? ''
    },
  }
}

async function postCapture(payload) {
  const req = fakeRequest({ dataUrl: JPEG_DATA_URL, width: 640, height: 360, ...payload })
  const res = fakeResponse()
  await captureHandler(req, res)
  return { res, body: res.status === 200 ? JSON.parse(res.body) : res.body }
}

test('captureHandler：白名单元数据写成 <image>.json sidecar，图片字段保持不变', async () => {
  const { res, body } = await postCapture({
    label: 'sidecar',
    metadata: {
      captured_at: '2026-05-01T10:00:00+08:00',
      camera: { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45, secret: 'x' },
      center: { lon: 116.41, lat: 39.91, height: 48, junk: null },
      layers: [{ name: 'Clermont', visible: true, kind: 'mesh' }, { name: '', visible: true }, 7],
      imagery: 'Esri',
      terrain: 'Ellipsoid',
      plugin_version: '1.8.2',
      injected: '<script>alert(1)</script>',
      url: 'https://evil.example/x',
    },
  })
  assert.equal(res.status, 200)
  assert.match(body.path, /[\\/]captures[\\/]earth-[\w-]+\.jpg$/)
  assert.equal(typeof body.url, 'string')
  assert.equal(body.bytes, 4)
  assert.equal(body.width, 640)
  assert.equal(body.height, 360)
  assert.equal(body.metadata_path, `${body.path}.json`)
  const sidecar = JSON.parse(readFileSync(body.metadata_path, 'utf8'))
  assert.deepEqual(Object.keys(sidecar), [
    'schema_version',
    'captured_at',
    'camera',
    'center',
    'layers',
    'imagery',
    'terrain',
    'plugin_version',
    'size',
  ])
  assert.equal(sidecar.schema_version, 1)
  assert.equal(sidecar.captured_at, '2026-05-01T02:00:00.000Z', '时间统一规范成 UTC ISO')
  assert.deepEqual(sidecar.camera, { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45 })
  assert.deepEqual(sidecar.center, { lon: 116.41, lat: 39.91, height: 48 })
  assert.deepEqual(sidecar.layers, [{ name: 'Clermont', visible: true, kind: 'mesh' }])
  assert.equal(sidecar.imagery, 'Esri')
  assert.equal(sidecar.terrain, 'Ellipsoid')
  assert.equal(sidecar.plugin_version, '1.8.2')
  assert.deepEqual(sidecar.size, { width: 640, height: 360, bytes: 4 })
  const raw = readFileSync(body.metadata_path, 'utf8')
  assert.ok(!raw.includes('injected') && !raw.includes('<script>') && !raw.includes('https://evil.example'))
  // 回显给页面的就是落盘的那份文档。
  assert.deepEqual(body.metadata, sidecar)
})

test('captureHandler：非法或越界值被丢弃，sidecar 只留合法内容', async () => {
  const { body } = await postCapture({
    metadata: {
      captured_at: 'not-a-date',
      camera: { lon: 999, lat: '39.9', height: 'high' },
      center: { lat: 1 },
      layers: 'nope',
      imagery: 42,
      terrain: '\u0000bad\r\nname',
    },
  })
  const sidecar = JSON.parse(readFileSync(body.metadata_path, 'utf8'))
  assert.equal(sidecar.captured_at, null)
  assert.equal(sidecar.camera, null)
  assert.equal(sidecar.center, null)
  assert.deepEqual(sidecar.layers, [])
  assert.equal(sidecar.imagery, null)
  assert.equal(sidecar.terrain, 'bad name', '控制字符被替换并裁剪')
})

test('captureHandler：metadata 不是对象时截图仍然成功，只是没有 sidecar', async () => {
  const { res, body } = await postCapture({ metadata: 'not-an-object' })
  assert.equal(res.status, 200)
  assert.equal(typeof body.path, 'string')
  assert.equal(body.metadata_path, undefined)
})

test('captureHandler：sidecar 写失败不影响截图成功（best effort）', async () => {
  const originalWriteFile = nodeFs.writeFile
  nodeFs.writeFile = async (file, ...rest) => {
    if (typeof file === 'string' && file.endsWith('.json')) throw new Error('disk full')
    return originalWriteFile.call(nodeFs, file, ...rest)
  }
  try {
    const { res, body } = await postCapture({ metadata: { camera: { lon: 1, lat: 2, height: 3, heading: 0, pitch: 0 } } })
    assert.equal(res.status, 200)
    assert.equal(typeof body.path, 'string')
    assert.equal(body.metadata_path, undefined, 'sidecar 失败不能回传路径')
    assert.equal(statSync(body.path).size, 4, '图片必须已经完整落盘')
  } finally {
    nodeFs.writeFile = originalWriteFile
  }
})

// ---------------------------------------------------------------------------
// Host: pruning keeps the image quota and drops orphan sidecars.
// ---------------------------------------------------------------------------

test('pruneCaptures：图片仍按配额保留，孤儿 sidecar 一并清理', async () => {
  mkdirSync(CAPTURES_DIR, { recursive: true })
  const base = Math.floor(Date.now() / 1000) - 10000
  for (let index = 0; index < 60; index += 1) {
    const name = `earth-20260101-000000-seed${String(index).padStart(2, '0')}.jpg`
    const image = join(CAPTURES_DIR, name)
    writeFileSync(image, Buffer.from([0xff]))
    writeFileSync(`${image}.json`, '{"schema_version":1}\n')
    utimesSync(image, base + index, base + index)
    utimesSync(`${image}.json`, base + index, base + index)
  }
  const { body } = await postCapture({ label: 'prune', metadata: { camera: { lon: 116, lat: 39, height: 10, heading: 0, pitch: -90 } } })
  const names = readdirSync(CAPTURES_DIR)
  const images = names.filter((name) => /^earth-.+\.(jpe?g|png)$/i.test(name))
  const sidecars = names.filter((name) => name.endsWith('.json'))
  assert.equal(images.length, MAX_CAPTURE_FILES, 'sidecar 不能挤掉图片配额')
  assert.ok(sidecars.length <= images.length, 'sidecar 数量不能超过图片数量')
  assert.ok(existsSync(`${body.path}.json`), '新截图的 sidecar 必须保留')
  for (const sidecar of sidecars) {
    const image = join(CAPTURES_DIR, sidecar.slice(0, -'.json'.length))
    assert.ok(existsSync(image), `孤儿 sidecar 必须删除：${sidecar}`)
  }
})

// ---------------------------------------------------------------------------
// Host: the earth_capture tool result and its rendered text.
// ---------------------------------------------------------------------------

function makeCaptureTool(ack) {
  const calls = []
  const bridge = {
    connectedSessions: () => ['s1'],
    run: async (...args) => {
      calls.push(args)
      return ack
    },
  }
  return { tool: createCaptureTool(bridge), calls }
}

function writeCapturedImage(name) {
  mkdirSync(CAPTURES_DIR, { recursive: true })
  const image = join(CAPTURES_DIR, name)
  writeFileSync(image, Buffer.from([0xff, 0xd8]))
  return image
}

test('createCaptureTool：结果与 render 文本带完整相机、时间与 sidecar 路径', async () => {
  const image = writeCapturedImage('earth-20260101-120000-tool.jpg')
  const sidecar = `${image}.json`
  writeFileSync(sidecar, '{}')
  const { tool } = makeCaptureTool({
    path: image,
    bytes: 2,
    width: 640,
    height: 360,
    hud_hidden: true,
    captured_at: '2026-05-01T02:00:00.000Z',
    camera: { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45 },
    center: { lon: 116.41, lat: 39.91, height: 48 },
    layers: [{ name: 'Clermont', visible: true, kind: 'mesh' }, { name: 'Splat', visible: false, kind: '3dgs' }],
    layers_visible: 1,
    metadata_path: sidecar,
  })
  const value = await tool.execute({}, { agent: { session: { id: 's1' } } })
  assert.equal(value.captured_at, '2026-05-01T02:00:00.000Z')
  assert.deepEqual(value.camera, { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45 })
  assert.deepEqual(value.center, { lon: 116.41, lat: 39.91, height: 48 })
  assert.equal(value.layers.length, 2)
  assert.equal(value.metadata_path, sidecar)
  const text = tool.output.render({}, value)[0].text
  assert.ok(text.startsWith(`Captured image: ${image}`), '首行保持 Captured image: <path> 以兼容缩略图解析')
  assert.match(text, /lon=116\.4, lat=39\.9, height=2500m, heading=37°, pitch=-45°/)
  assert.ok(text.includes('time=2026-05-01T02:00:00.000Z'))
  assert.ok(text.includes(`Capture metadata sidecar: ${sidecar}`))
  assert.ok(text.includes('Splat (hidden)'))
})

test('createCaptureTool：旧面板只回 view 时 camera 仍完整（向后兼容）', async () => {
  const image = writeCapturedImage('earth-20260101-120001-legacy.jpg')
  const view = { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45 }
  const { tool } = makeCaptureTool({ path: image, bytes: 2, view })
  const value = await tool.execute({}, { agent: { session: { id: 's1' } } })
  assert.deepEqual(value.camera, view)
  assert.equal(value.captured_at, undefined)
  assert.equal(value.metadata_path, undefined)
  const text = tool.output.render({}, value)[0].text
  assert.match(text, /heading=37°, pitch=-45°/)
  assert.doesNotMatch(text, /time=/)
})

// ---------------------------------------------------------------------------
// Client bridge: the capture command maps the additive fields.
// ---------------------------------------------------------------------------

test('capture 命令：返回 additive 元数据字段，view/url 契约不变', async () => {
  const bridge = createCommandBridge({
    getLayers: () => [{ id: 'l1', name: 'Clermont', visible: true, kind: 'mesh' }],
    getCesium: () => null,
    getViewer: () => null,
    getSources: () => ({ imagery: [], terrain: [], settings: {} }),
    getMeta: () => ({}),
    getAgentOverlays: () => ({ draw: [], measure: [] }),
    t,
    collectSceneStatus: async () => ({ view: { lon: 1, lat: 2, height: 3, heading: 4, pitch: 5 } }),
    captureScene: async () => ({
      path: '/captures/earth-d.jpg',
      url: 'https://host/earth-d.jpg?token=secret',
      width: 640,
      height: 360,
      bytes: 9,
      hud: false,
      metadata_path: '/captures/earth-d.jpg.json',
      metadata: {
        captured_at: '2026-05-01T02:00:00.000Z',
        camera: { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45 },
        center: { lon: 116.41, lat: 39.91, height: 48 },
        layers: [{ name: 'Clermont', visible: true, kind: 'mesh' }],
      },
    }),
    redactUrl: (url) => String(url).replace(/token=[^&]+/, 'token=***'),
  })
  const captured = await bridge.runCommand('capture', {}, 's1')
  assert.equal(captured.url, 'https://host/earth-d.jpg?token=***')
  assert.deepEqual(captured.view, { lon: 1, lat: 2, height: 3, heading: 4, pitch: 5 })
  assert.equal(captured.captured_at, '2026-05-01T02:00:00.000Z')
  assert.deepEqual(captured.camera, { lon: 116.4, lat: 39.9, height: 2500, heading: 37, pitch: -45 })
  assert.deepEqual(captured.center, { lon: 116.41, lat: 39.91, height: 48 })
  assert.deepEqual(captured.layers, [{ name: 'Clermont', visible: true, kind: 'mesh' }])
  assert.equal(captured.metadata_path, '/captures/earth-d.jpg.json')
  assert.equal(captured.layers_visible, 1)
})
