/**
 * P0 批次验收：宿主场景快照路由、`/earth` 命令、meta 接线、客户端快照重放与截图缩略图。
 *
 * 这个文件只做验收，不改产品代码：
 *   - 宿主快照路由用真实导出 `sceneSnapshotHandler` 跑一遍 PUT→GET 往返，
 *     文件必须落在本次测试的临时 DSH_HOME 下（DSH_HOME 在动态 import 之前设置，
 *     因为 index.js 在模块加载时就把 SCENES_DIR 固化了）；
 *   - `renderEarthCommandStatus` 是纯函数，直接断言摘要文本；
 *   - `/earth` 命令、meta、客户端接线与 locale 属于「还在不在」的接线断言，按源码
 *     切片检查，不做浏览器渲染测试。
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hostSource } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/** 源码断言必须换行无关：Windows 检出可能是 CRLF。 */
const readSource = async (name) => (await readFile(join(root, name), 'utf8')).replace(/\r\n/g, '\n')

const indexSource = await readSource('index.js')
// v2.0 split: implementation lives in src/host; `host` is the concatenated
// authored host source (safe for top-level function extraction), while
// adjacency-sensitive slices read the owning module on purpose.
const hostAll = hostSource()
const readHostModule = (rel) => readFileSync(join(root, 'src/host', rel), 'utf8').replace(/\r\n/g, '\n')
const constantsSource = readHostModule('constants.js')
const routesSource = readHostModule('routes.js')
const commandsSource = readHostModule('commands.js')
const sceneSource = readHostModule('tools/scene.js')
const captureSource = readHostModule('tools/capture.js')
const clientSource = await readSource('client.js')

// ---------------------------------------------------------------------------
// 宿主半边：DSH_HOME 必须在 import 之前设置，index.js 的 STATE_DIR/SCENES_DIR
// 是模块级常量，晚一步设置快照就会写进真实用户目录。
// ---------------------------------------------------------------------------
const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-p0-'))
process.env.DSH_HOME = home
const host = await import(new URL('../index.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

const scenesDir = join(home, 'digital-earth', 'scenes')
const sessionId = (name) => `p0-${name}-session`
const sceneUrl = (session) => `/api/3dviewer/scene/p0-route-token?session=${encodeURIComponent(session)}`

/** 假 req：EventEmitter + method/url/headers + 可 async 迭代的 body。 */
function fakeRequest({ method = 'GET', url = '/', chunks = [] } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: 'localhost:3000', 'sec-fetch-site': 'same-origin' }
  req.destroyed = false
  req.destroy = () => {
    req.destroyed = true
  }
  req[Symbol.asyncIterator] = async function* iterate() {
    for (const chunk of chunks) yield chunk
  }
  return req
}

/** 假 res：记录 writeHead/end/write，供断言状态码、响应头与 JSON 体。 */
function fakeResponse() {
  const res = {
    status: null,
    headers: {},
    body: '',
    writeHead(status, headers) {
      res.status = status
      res.headers = headers ?? {}
    },
    write(chunk) {
      res.body += String(chunk)
      return true
    },
    end(chunk) {
      if (chunk !== undefined) res.body += String(chunk)
    },
  }
  return res
}

const json = (res) => JSON.parse(res.body)

async function callSceneHandler(options) {
  const req = fakeRequest(options)
  const res = fakeResponse()
  await host.sceneSnapshotHandler(req, res)
  return { req, res }
}

// ---------------------------------------------------------------------------
// 1) 宿主场景快照路由：导出面、往返、文件位置、拒绝路径
// ---------------------------------------------------------------------------

test('P0 宿主导出测试缝存在，且 sceneSnapshotFile 是确定性的 sha256 文件名', () => {
  assert.equal(typeof host.sceneSnapshotHandler, 'function')
  assert.equal(typeof host.sceneSnapshotFile, 'function')
  assert.equal(typeof host.renderEarthCommandStatus, 'function')
  assert.equal(typeof host.apply, 'function')

  const first = host.sceneSnapshotFile(sessionId('stable'))
  const second = host.sceneSnapshotFile(sessionId('stable'))
  assert.equal(first, second, '同一会话必须映射到同一文件')
  assert.notEqual(first, host.sceneSnapshotFile(sessionId('other')), '不同会话不能共用快照文件')

  const session = sessionId('stable')
  const digest = createHash('sha256').update(session).digest('hex')
  assert.equal(basename(first), `${digest}.json`)
  assert.equal(dirname(first), scenesDir, '快照必须落在本次临时 DSH_HOME 的 scenes 目录')
  assert.equal(relative(resolve(home), resolve(first)).startsWith('..'), false)
})

test('P0 PUT→GET 往返：同一会话取回完全相同的快照 JSON 与 savedAt', async () => {
  const session = sessionId('roundtrip')
  const snapshot = {
    v: 2,
    view: { lon: 116.391, lat: 39.907, height: 1200, heading: 45, pitch: -30 },
    layers: [{ name: 'b3dm 图层', source: { kind: 'local', path: 'C:\\tiles' }, visible: true }],
    annotations: { draw: [{ geojson: { type: 'Point', coordinates: [116.39, 39.9] } }], measure: [] },
    analysis: { action: 'profile', from: [116.3, 39.9], to: [116.4, 39.9] },
    shaders: [{ layer: 'b3dm 图层', preset: 'contour', params: { interval: 20 } }],
  }
  const body = JSON.stringify({ session, snapshot })
  // 拆成三段异步迭代，验证 handler 会累加 body 而不是只看第一块。
  const { res: putRes } = await callSceneHandler({
    method: 'PUT',
    url: sceneUrl(session),
    chunks: [body.slice(0, 10), body.slice(10, 60), body.slice(60)],
  })
  assert.equal(putRes.status, 200)
  assert.equal(putRes.headers['content-type'], 'application/json; charset=utf-8')
  const ack = json(putRes)
  assert.equal(ack.ok, true)
  assert.equal(typeof ack.savedAt, 'string')

  const file = host.sceneSnapshotFile(session)
  const stored = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(stored.version, 1)
  assert.equal(stored.session, session)
  assert.equal(stored.savedAt, ack.savedAt)
  assert.deepEqual(stored.snapshot, snapshot)

  const { res: getRes } = await callSceneHandler({ url: sceneUrl(session) })
  assert.equal(getRes.status, 200)
  const payload = json(getRes)
  assert.deepEqual(payload.snapshot, snapshot)
  assert.equal(payload.savedAt, ack.savedAt)
})

test('P0 GET 对没有快照的合法会话返回 {snapshot:null}，不建文件', async () => {
  const session = sessionId('unknown')
  const { res } = await callSceneHandler({ url: sceneUrl(session) })
  assert.equal(res.status, 200)
  assert.deepEqual(json(res), { snapshot: null })
  await assert.rejects(readFile(host.sceneSnapshotFile(session), 'utf8'), '只读 GET 不应创建快照文件')
})

test('P0 GET 对损坏文件或会话不匹配的存档回退为 {snapshot:null}', async () => {
  const corrupt = sessionId('corrupt')
  const corruptFile = host.sceneSnapshotFile(corrupt)
  await mkdir(scenesDir, { recursive: true })
  await writeFile(corruptFile, '{not json', 'utf8')
  const corruptRes = (await callSceneHandler({ url: sceneUrl(corrupt) })).res
  assert.equal(corruptRes.status, 200)
  assert.deepEqual(json(corruptRes), { snapshot: null })

  const mismatched = sessionId('mismatched')
  const mismatchFile = host.sceneSnapshotFile(mismatched)
  await writeFile(
    mismatchFile,
    JSON.stringify({ version: 1, session: 'somebody-else', savedAt: '2026-01-01T00:00:00.000Z', snapshot: { v: 2 } }),
    'utf8',
  )
  const mismatchRes = (await callSceneHandler({ url: sceneUrl(mismatched) })).res
  assert.equal(mismatchRes.status, 200)
  assert.deepEqual(json(mismatchRes), { snapshot: null })
})

test('P0 缺少或非法 session 被拒绝（400），非法包括空白与超长', async () => {
  const missing = (await callSceneHandler({ url: '/api/3dviewer/scene/p0-route-token' })).res
  assert.equal(missing.status, 400)
  assert.equal(missing.body, 'missing or invalid session')

  const blank = (await callSceneHandler({ url: sceneUrl(' ') })).res
  assert.equal(blank.status, 400)
  assert.equal(blank.body, 'missing or invalid session')

  const tooLong = (await callSceneHandler({ url: sceneUrl('a'.repeat(201)) })).res
  assert.equal(tooLong.status, 400)
  assert.equal(tooLong.body, 'missing or invalid session')
})

test('P0 非 GET/PUT 方法被拒绝（405），且不会写快照文件', async () => {
  const session = sessionId('method')
  const { res } = await callSceneHandler({
    method: 'POST',
    url: sceneUrl(session),
    chunks: [JSON.stringify({ session, snapshot: { v: 2 } })],
  })
  assert.equal(res.status, 405)
  assert.equal(res.body, 'method not allowed')
  await assert.rejects(readFile(host.sceneSnapshotFile(session), 'utf8'), 'POST 不应写出快照文件')
})

test('P0 超过 512KB 的 PUT body 被拒绝（413）且销毁请求流', async () => {
  const session = sessionId('oversized')
  const { req, res } = await callSceneHandler({
    method: 'PUT',
    url: sceneUrl(session),
    chunks: ['x'.repeat(512 * 1024 + 1)],
  })
  assert.equal(res.status, 413)
  assert.equal(res.body, 'payload too large')
  assert.equal(req.destroyed, true, '超限后必须停止读取请求流')
  await assert.rejects(readFile(host.sceneSnapshotFile(session), 'utf8'), '超限 body 不应落盘')
})

test('P0 非法 JSON（400 invalid json）与非对象 snapshot（400 invalid snapshot）被拒绝', async () => {
  const session = sessionId('badjson')
  const badJson = (await callSceneHandler({ method: 'PUT', url: sceneUrl(session), chunks: ['{broken'] })).res
  assert.equal(badJson.status, 400)
  assert.equal(badJson.body, 'invalid json')

  const missingSnapshot = (await callSceneHandler({ method: 'PUT', url: sceneUrl(session), chunks: ['{}'] })).res
  assert.equal(missingSnapshot.status, 400)
  assert.equal(missingSnapshot.body, 'invalid snapshot')

  const arraySnapshot = (await callSceneHandler({ method: 'PUT', url: sceneUrl(session), chunks: ['{"snapshot":[]}'] })).res
  assert.equal(arraySnapshot.status, 400)
  assert.equal(arraySnapshot.body, 'invalid snapshot')

  await assert.rejects(readFile(host.sceneSnapshotFile(session), 'utf8'), '被拒绝的 PUT 不应落盘')
})

// ---------------------------------------------------------------------------
// 2) renderEarthCommandStatus：一屏摘要 + 空输入容忍
// ---------------------------------------------------------------------------

test('P0 renderEarthCommandStatus 汇总相机、图层、影像、地形与叠加层计数', () => {
  const text = host.renderEarthCommandStatus({
    view: { lon: 116.39, lat: 39.9, height: 1200, heading: 45, pitch: -30 },
    layers: [{ name: '北京 b3dm', visible: true }, { name: '3DGS', visible: false }],
    imagery: { name: 'Esri World Imagery' },
    terrain: { name: 'Cesium World Terrain' },
    annotations: { drawn_features: 3, measured_points: 4 },
  })
  const lines = text.split('\n')
  assert.equal(lines[0], 'Digital earth status')
  assert.equal(lines[1], 'Camera: 116.39, 39.9 · 1200 m · heading 45°, pitch -30°')
  assert.equal(lines[2], 'Layers: 北京 b3dm, 3DGS (hidden)')
  assert.equal(lines[3], 'Imagery: Esri World Imagery; terrain: Cesium World Terrain')
  assert.equal(lines[4], 'Agent overlays: 3 annotated features, 4 measured points')
})

test('P0 renderEarthCommandStatus 容忍空输入，不输出 undefined', () => {
  const text = host.renderEarthCommandStatus({})
  assert.equal(text.split('\n')[1], 'Camera: unknown')
  assert.equal(text.split('\n')[2], 'Layers: none')
  assert.equal(text.split('\n')[3], 'Imagery: none; terrain: none')
  assert.equal(text.split('\n')[4], 'Agent overlays: 0 annotated features, 0 measured points')
  assert.doesNotMatch(text, /undefined|NaN/)

  // 图层名缺失时按字符串插值处理，但可见性标记不能误加。
  const partial = host.renderEarthCommandStatus({ layers: [{ name: 'only' }] })
  assert.equal(partial.split('\n')[2], 'Layers: only')
})

// ---------------------------------------------------------------------------
// 3) /earth 命令接线（宿主源码）
// ---------------------------------------------------------------------------

const commandSource = commandsSource.slice(commandsSource.indexOf('function mountEarthCommand'))

test('P0 /earth 已注册：name、input hint 与 status/capture/report/clear/open 分支齐备', () => {
  assert.match(commandSource, /scope\.commands\.register\(\{/)
  assert.ok(commandSource.includes("name: 'earth',"))
  assert.ok(commandSource.includes("input: { hint: 'status | capture [label] | report [html|markdown] | clear | open' },"))
  assert.ok(commandSource.includes("if (sub === 'status') {"))
  assert.ok(commandSource.includes("if (sub === 'capture') {"))
  assert.ok(commandSource.includes("if (sub === 'report') {"))
  assert.ok(commandSource.includes("if (sub === 'clear') {"))
  assert.ok(commandSource.includes("if (sub === 'open') {"))
  assert.ok(
    commandSource.includes('Usage: /earth status | /earth capture [label] | /earth report [html|markdown] | /earth clear | /earth open'),
  )
  // capture 必须把标签写进截图参数，clear 必须调用 draw clear。
  assert.ok(commandSource.includes('bridge.run(target.sessionId, \'capture\''))
  assert.ok(commandSource.includes("bridge.run(target.sessionId, 'draw', { clear: true }"))
  // 命令必须在 apply() 里挂载，否则注册代码是死代码。
  assert.ok(indexSource.includes('mountEarthCommand(ctx, bridge)'))
  assert.ok(commandsSource.includes("ctx.inject(['commands'], (scope) => {"))
})

test('P0 /earth 失败返回 kind:error，成功返回 kind:success，命令结果不写入模型消息', () => {
  assert.ok(commandSource.includes("kind: 'error'"))
  assert.ok(commandSource.includes("kind: 'success'"))
  // 面板未连接与执行异常都必须走 error 分支，而不是抛给模型上下文。
  assert.match(commandSource, /if \(target === null\) \{\s*return \{\s*kind: 'error'/)
  assert.match(commandSource, /catch \(error\) \{\s*return \{ kind: 'error'/)
  // 命令结果留在命令 UI：只注入 commands 服务，不得触碰 systemPrompt / tools /
  // 任何会话消息 API（`error.message` 是普通属性，不在此列）。
  assert.match(commandSource, /ctx\.inject\(\['commands'\], \(scope\) => \{/)
  assert.doesNotMatch(commandSource, /ctx\.inject\(\['(?:tools|systemPrompt|agents|chat)/)
  assert.doesNotMatch(commandSource, /\bsystemPrompt\b/)
  assert.doesNotMatch(commandSource, /\bscope\.tools\b/)
  assert.doesNotMatch(commandSource, /\b(?:addMessage|appendMessage|messages\.push|toolResult)\b/)
})

// ---------------------------------------------------------------------------
// 4) meta 接线：filesUrl / sceneUrl，且 token 不进入任何工具结果文本
// ---------------------------------------------------------------------------

const metaSource = routesSource.slice(routesSource.indexOf('function metaHandler'))

test('P0 meta 下发 filesUrl 与 sceneUrl（都带 per-process token）', () => {
  const meta = {
    filesUrl: routesSource.includes('filesUrl: `${FILES_ROUTE}/${TOKEN}/`,'),
    sceneUrl: routesSource.includes('sceneUrl: `${SCENE_ROUTE}/${TOKEN}`,')
  }
  assert.equal(meta.filesUrl, true, 'metaHandler 必须下发 filesUrl')
  assert.equal(meta.sceneUrl, true, 'metaHandler 必须下发 sceneUrl')
  assert.ok(metaSource.includes('token: TOKEN,'))
  assert.ok(constantsSource.includes('const SCENE_ROUTE = `${API}/scene`'))
  assert.ok(constantsSource.includes('const FILES_ROUTE = `${API}/files`'))
})

test('P0 场景快照路由按 exact 方式注册并复用导出的 handler', () => {
  assert.ok(routesSource.includes("register('exact', `${SCENE_ROUTE}/${TOKEN}`, sceneSnapshotHandler)"))
  assert.ok(constantsSource.includes('const MAX_SCENE_BODY = 512 * 1024'))
  assert.ok(constantsSource.includes('const MAX_SCENE_FILES = 50'))
  assert.ok(readHostModule('snapshots.js').includes('function pruneSceneSnapshots()'))
})

test('P0 token 不出现在工具结果渲染函数与 capture 结果值里', () => {
  const renderFunctions = [
    'renderSceneResult',
    'renderCaptureResult',
    'renderDrawResult',
    'renderMeasureResult',
    'renderAnalyzeResult',
    'renderShaderResult',
    'renderInspectResult',
  ]
  for (const name of renderFunctions) {
    const body = topLevelFunction(hostAll, name)
    assert.doesNotMatch(body, /\bTOKEN\b|filesUrl|sceneUrl/, `${name} 的结果文本不得携带 token 或缺省 URL`)
  }

  const captureValue = topLevelFunction(hostAll, 'captureResultValue')
  assert.doesNotMatch(captureValue, /\burl\s*:/, '截图工具结果不得带 url 字段')
  assert.ok(captureValue.includes('isWithinDirectory(target, CAPTURES_DIR)'), '截图路径必须校验在 captures 目录内')

  const toolSource = [
    sceneSource,
    captureSource,
    readHostModule('tools/draw.js'),
    readHostModule('tools/measure.js'),
    readHostModule('tools/analyze.js'),
    readHostModule('tools/shader.js'),
  ].join('\n')
  assert.equal((toolSource.match(/scrubToken\(/g) ?? []).length, 6, '六个工具都要经过 scrubToken')
  assert.doesNotMatch(toolSource, /\bTOKEN\b/)
})

// ---------------------------------------------------------------------------
// 5) 客户端接线（源码）：归一化、快照、恢复、宿主读写、缩略图
// ---------------------------------------------------------------------------

test('P0 normalizeSceneSnapshot 接受 analysis {action:profile} 与 shaders [{layer,preset,params}]', () => {
  const normalizeSource = sourceSlice(clientSource, 'const SNAPSHOT_ANALYSIS_ACTIONS', 'function readSceneSnapshot')
  assert.ok(normalizeSource.includes("const SNAPSHOT_ANALYSIS_ACTIONS = ['profile', 'flood', 'sunlight']"))
  assert.match(normalizeSource, /SNAPSHOT_ANALYSIS_ACTIONS\.includes\(analysis\.action\)/)
  assert.ok(normalizeSource.includes('analysis: isSnapshotAnalysis(snapshot.analysis) ? snapshot.analysis : null,'))
  assert.ok(normalizeSource.includes('const shaders = Array.isArray(snapshot.shaders)'))
  assert.ok(normalizeSource.includes('.filter(isSnapshotShader).map((item) => ({'))
  assert.ok(normalizeSource.includes('params: item.params !== null && typeof item.params === \'object\' ? item.params : {},'))

  const shaderGuard = sourceSlice(clientSource, 'const isSnapshotShader', 'function normalizeSceneSnapshot')
  assert.ok(shaderGuard.includes("typeof item.layer === 'string' && typeof item.preset === 'string'"))
})

test('P0 currentSceneSnapshot 写入 analysisCommandRef.current 与 shaderEntriesRef 预设', () => {
  const current = sourceSlice(clientSource, 'const currentSceneSnapshot = () => {', 'const saveSceneSnapshot = (forceHost = false) => {')
  assert.ok(current.includes('analysis: analysisCommandRef.current,'))
  assert.ok(current.includes('shaders: [...shaderEntriesRef.current.values()].map((entry) => ({'))
  assert.ok(current.includes('layer: entry.layerName,'))
  assert.ok(current.includes('preset: entry.preset,'))
  assert.ok(current.includes('params: { ...entry.params },'))
})

test('P0 restoreSceneSnapshot 重放 shaderCommand 与 analyzeCommand', () => {
  const restore = sourceSlice(clientSource, 'async function restoreSceneSnapshot', '//#endregion scene snapshot')
  assert.ok(restore.includes('await shaderCommand({ action: \'apply\', preset: item.preset, layer: item.layer, ...(item.params ?? {}) })'))
  assert.ok(restore.includes('await analyzeCommand(snapshot.analysis)'))
  assert.ok(restore.includes('for (const item of snapshot.shaders)'))
  assert.ok(restore.includes('snapshot.analysis !== null'))
})

test('P0 宿主快照读写存在：readHostSceneSnapshot/saveHostSceneSnapshot/loadSceneSnapshot，localStorage 回退', () => {
  const readHost = sourceSlice(clientSource, 'async function readHostSceneSnapshot', 'function saveHostSceneSnapshot')
  assert.ok(readHost.includes('if (!meta?.sceneUrl) return null'))
  assert.ok(readHost.includes('normalizeSceneSnapshot(data?.snapshot)'))

  const saveHost = sourceSlice(clientSource, 'function saveHostSceneSnapshot', 'async function loadSceneSnapshot')
  assert.ok(saveHost.includes("method: 'PUT',"))
  assert.ok(saveHost.includes('keepalive: true,'))
  assert.ok(saveHost.includes('if (text.length > 512 * 1024) return'), '客户端必须镜像宿主 512KB 上限')

  const load = sourceSlice(clientSource, 'async function loadSceneSnapshot', 'const markSceneDirty')
  assert.ok(load.includes('const hostSnapshot = await readHostSceneSnapshot(session)'))
  assert.ok(load.includes('return readSceneSnapshot(session)'), '宿主不可达时必须回退到 localStorage')
})

test('P0 卸载与 pagehide 都强制保存场景（saveSceneSnapshot(true)）', () => {
  const cleanup = sourceSlice(clientSource, '// Capture the last scene before the viewer is destroyed.', 'viewerRef.current = null')
  assert.ok(cleanup.includes('saveSceneSnapshot(true)'), '卸载时必须强制写一次宿主')

  const flush = sourceSlice(clientSource, 'const flush = () => {', "window.addEventListener('pagehide', flush)")
  assert.ok(flush.includes('saveSceneSnapshot(true)'), 'pagehide 时必须强制写一次宿主')
  assert.ok(clientSource.includes("window.addEventListener('pagehide', flush)"))
  assert.ok(clientSource.includes("document.addEventListener('visibilitychange', onVisibility)"))
})

test('P0 earth_capture 工具行用 meta.filesUrl 渲染 thumb 缩略图，文案走 tool.thumbOpen', () => {
  const row = sourceSlice(clientSource, 'function EarthToolRow', '//#endregion agent tool rows')
  assert.ok(row.includes("if (toolName !== 'earth_capture' || phase !== 'result' || block?.isError === true) return undefined"))
  assert.ok(row.includes('const match = /Captured image:\\s*(.+)/.exec(text)'))
  assert.ok(row.includes("if (typeof meta?.filesUrl !== 'string' || meta.filesUrl === '') return"))
  assert.ok(row.includes('setThumbUrl(`${meta.filesUrl}${encodeURIComponent(file)}`)'))
  assert.ok(row.includes("className: 'thumb',"))
  assert.ok(row.includes("title: t('tool.thumbOpen'),"))
  assert.ok(row.includes("h('img', { src: thumbUrl, alt: '', loading: 'lazy' })"))
  // 缩略图槽位必须挂在 earth_capture 上，否则聊天里不会有预览。
  assert.ok(clientSource.includes("key: 'earth_capture', locale: NS }, EarthToolRow)"))
})

// ---------------------------------------------------------------------------
// 6) 双语 locale：tool.thumbOpen
// ---------------------------------------------------------------------------

test('P0 中文与英文词典都包含 tool.thumbOpen 文案', () => {
  const lines = clientSource.split('\n')
  const zhLine = lines.indexOf('      zh: {')
  const enLine = lines.indexOf('      en: {')
  assert.notEqual(zhLine, -1, 'client.js 应内联中文词典')
  assert.notEqual(enLine, -1, 'client.js 应内联英文词典')
  assert.ok(enLine > zhLine)
  const fallbackLine = lines.indexOf('    const FALLBACK_ABOUT = {')
  assert.ok(fallbackLine > enLine)

  const zhMessages = lines.slice(zhLine, enLine).join('\n')
  const enMessages = lines.slice(enLine, fallbackLine).join('\n')
  assert.ok(zhMessages.includes("'tool.thumbOpen': '查看截图',"))
  assert.ok(enMessages.includes("'tool.thumbOpen': 'Open snapshot',"))
})

// ---------------------------------------------------------------------------
// 源码切片辅助
// ---------------------------------------------------------------------------

/** 按起止标记切一段源码；标记缺失直接失败，避免空切片让断言假通过。 */
function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `源码中找不到起点：${startMarker}`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(end, -1, `源码中找不到终点：${endMarker}`)
  return source.slice(start, end)
}

/** 取一个顶层 `function name(...)` 到它独占一行的 `}` 为止。 */
function topLevelFunction(source, name) {
  const lines = source.split('\n')
  const prefixes = [
    `function ${name}(`,
    `async function ${name}(`,
    `export function ${name}(`,
    `export async function ${name}(`,
  ]
  const start = lines.findIndex((line) => prefixes.some((prefix) => line.startsWith(prefix)))
  assert.notEqual(start, -1, `源码中找不到顶层函数 ${name}`)
  let end = start + 1
  while (end < lines.length && lines[end] !== '}') end += 1
  assert.ok(end < lines.length, `顶层函数 ${name} 缺少结束行`)
  return lines.slice(start, end + 1).join('\n')
}
