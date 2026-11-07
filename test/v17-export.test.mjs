/**
 * v1.7 页面专用「带走」证据包导出验收：宿主 /export 路由 + meta 接线 + token 安全。
 *
 * 这个文件只做验收，不改产品代码：
 *   - `evidenceExportHandler(req, res)` 是导出测试缝；EXPORTS_DIR 在模块加载时由
 *     DSH_HOME 固化，所以先建临时 DSH_HOME，再动态 import ../index.js，最后在
 *     after() 里还原环境变量并清理目录；
 *   - 路由/meta/index 接线按源码切片断言（与 P2 的写法一致）；
 *   - 该路由是页面专用的：工具源码与工具结果文本都不得出现它的路径或 token。
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync, readdirSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hostSource } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const MAX_EXPORT_BODY = 16 * 1024 * 1024
const MAX_EVIDENCE_JSON = 256 * 1024

/** 源码断言必须换行无关：Windows 检出可能是 CRLF。 */
const readSource = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n')
const constantsSource = readSource('src/host/constants.js')
const routesSource = readSource('src/host/routes.js')
const indexSource = readSource('index.js')
const exportSource = readSource('src/host/export.js')
const hostAll = hostSource()
const toolNames = readdirSync(join(root, 'src/host/tools'))
  .filter((name) => name.endsWith('.js'))
  .sort()
const toolSource = toolNames.map((name) => readSource(`src/host/tools/${name}`)).join('\n')

// ---------------------------------------------------------------------------
// 宿主半边：DSH_HOME 必须在 import 之前设置，constants.js 的 EXPORTS_DIR 是模块级
// 常量，晚一步设置证据包就会写进真实用户目录。
// ---------------------------------------------------------------------------
const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-v17-'))
process.env.DSH_HOME = home
const host = await import(new URL('../index.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

const exportsDir = join(home, 'digital-earth', 'exports')

// ---------------------------------------------------------------------------
// 假 req / res 与调用辅助
// ---------------------------------------------------------------------------

/** 假 req：EventEmitter + method/url/headers + 可 async 迭代的 body。 */
function fakeRequest({ method = 'POST', url = '/api/3dviewer/export/v17-route-token', chunks = [], fail = false } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: 'localhost:3000', 'sec-fetch-site': 'same-origin' }
  req.iterated = 0
  req.destroyed = false
  req.destroy = () => {
    req.destroyed = true
  }
  req[Symbol.asyncIterator] = async function* iterate() {
    if (fail) {
      req.iterated += 1
      throw new Error('request stream broke')
    }
    for (const chunk of chunks) {
      req.iterated += 1
      yield chunk
    }
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

const jsonOf = (res) => JSON.parse(res.body)

async function callExport(options) {
  const req = fakeRequest(options)
  const res = fakeResponse()
  await host.evidenceExportHandler(req, res)
  return { req, res }
}

async function exportNames() {
  try {
    return await readdir(exportsDir)
  } catch {
    return []
  }
}

const dataUrl = (mime, bytes) => `data:${mime};base64,${bytes.toString('base64')}`
const evidenceBody = (value) => JSON.stringify({ kind: 'evidence', ...value })

// ---------------------------------------------------------------------------
// 1) 成功路径：证据 JSON + 可选截图
// ---------------------------------------------------------------------------

test('v17 evidence + image：200，写入 JSON 与 PNG，内容/字节/绝对路径正确', async () => {
  assert.equal(typeof host.evidenceExportHandler, 'function')
  const card = {
    title: '场景证据',
    camera: { lon: 114.3, lat: 30.5, height: 1500 },
    layers: ['a', 'b'],
    note: 'base64 image follows',
  }
  const imageBytes = Buffer.from('fake png payload for the evidence pack')
  const body = evidenceBody({ label: 'take away', card, image: dataUrl('image/png', imageBytes) })
  // 分两段异步迭代，验证 handler 会累加 body。
  const { res } = await callExport({ chunks: [body.slice(0, 20), body.slice(20)] })

  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  const ack = jsonOf(res)
  assert.equal(isAbsolute(ack.path), true, 'path 必须是绝对路径')
  assert.equal(dirname(ack.path), exportsDir, '目标目录固定为 <临时 DSH_HOME>/digital-earth/exports')
  assert.equal(relative(resolve(home), resolve(ack.path)).startsWith('..'), false)
  assert.match(basename(ack.path), /^earth-evidence-\d{8}-\d{6}-[0-9a-f]{8}-take-away\.json$/)

  const content = await readFile(ack.path, 'utf8')
  assert.equal(content, JSON.stringify(card, null, 2), '卡片以 2 空格缩进序列化')
  assert.deepEqual(JSON.parse(content), card)
  assert.equal(ack.bytes, Buffer.byteLength(content, 'utf8'))
  assert.equal((await stat(ack.path)).size, ack.bytes)

  assert.equal(ack.image_bytes, imageBytes.length)
  assert.equal(typeof ack.image_path, 'string')
  assert.equal(dirname(ack.image_path), exportsDir)
  assert.match(basename(ack.image_path), /^earth-evidence-\d{8}-\d{6}-[0-9a-f]{8}-take-away\.png$/)
  assert.deepEqual(await readFile(ack.image_path), imageBytes, '截图字节必须原样落盘')

  // 响应只是路径/字节数，不得回显 token 或内部路由。
  assert.doesNotMatch(res.body, /token|3dviewer/i)
})

test('v17 无 image 时 image_path/image_bytes 为 null，只写一个 .json', async () => {
  const before = new Set(await exportNames())
  const card = { kind: 'no-image', ok: true }
  const { res } = await callExport({ chunks: [evidenceBody({ card })] })
  assert.equal(res.status, 200)
  const ack = jsonOf(res)
  assert.equal(ack.image_path, null)
  assert.equal(ack.image_bytes, null)
  assert.deepEqual(JSON.parse(await readFile(ack.path, 'utf8')), card)
  const added = (await exportNames()).filter((name) => !before.has(name))
  assert.deepEqual(added, [basename(ack.path)], '本次调用只应新增 JSON 文件')
})

test('v17 jpeg data URL 落盘为 .jpg 扩展名', async () => {
  const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const { res } = await callExport({
    chunks: [evidenceBody({ card: { kind: 'jpeg' }, image: dataUrl('image/jpeg', imageBytes) })],
  })
  assert.equal(res.status, 200)
  const ack = jsonOf(res)
  assert.match(basename(ack.image_path), /\.jpg$/)
  assert.equal(ack.image_bytes, imageBytes.length)
  assert.deepEqual(await readFile(ack.image_path), imageBytes)
})

// ---------------------------------------------------------------------------
// 2) 拒绝路径：方法、kind、card、image、请求流
// ---------------------------------------------------------------------------

test('v17 非 POST 返回 405 且不读 body；kind/card 非法返回 400', async () => {
  const before = (await exportNames()).length
  for (const method of ['GET', 'PUT', 'HEAD', 'DELETE']) {
    const { req, res } = await callExport({ method, chunks: [evidenceBody({ card: {} })] })
    assert.equal(res.status, 405, `${method} 必须被拒绝`)
    assert.equal(res.body, 'method not allowed')
    assert.equal(req.iterated, 0, `${method} 不应读取请求体`)
  }

  for (const body of [
    JSON.stringify({ kind: 'report', card: {} }),
    JSON.stringify({ kind: 'Evidence', card: {} }),
    JSON.stringify({ card: {} }),
    JSON.stringify({ kind: 'evidence-report', card: {} }),
    'null',
  ]) {
    const { res } = await callExport({ chunks: [body] })
    assert.equal(res.status, 400, `body=${body} 必须被拒绝`)
    assert.equal(res.body, 'invalid kind')
  }

  for (const card of [undefined, null, [], 'text', 42, true]) {
    const { res } = await callExport({ chunks: [evidenceBody({ card })] })
    assert.equal(res.status, 400, `card=${JSON.stringify(card)} 必须被拒绝`)
    assert.equal(res.body, 'invalid evidence')
  }

  const brokenJson = await callExport({ chunks: ['{broken'] })
  assert.equal(brokenJson.res.status, 400)
  assert.equal(brokenJson.res.body, 'invalid json')
  const emptyBody = await callExport({ chunks: [] })
  assert.equal(emptyBody.res.status, 400)
  assert.equal(emptyBody.res.body, 'invalid json')
  assert.equal((await exportNames()).length, before, '被拒绝的请求不应写文件')
})

test('v17 非法 image data URL / 空 base64 / 请求流出错均返回 400', async () => {
  const before = (await exportNames()).length
  for (const image of [
    'data:image/gif;base64,AAAA',
    'data:image/png;base64,@@@@',
    'data:image/png;base64,',
    'not-a-data-url',
    '',
    42,
  ]) {
    const { res } = await callExport({ chunks: [evidenceBody({ card: { kind: 'bad-image' }, image })] })
    assert.equal(res.status, 400, `image=${JSON.stringify(image)} 必须被拒绝`)
    assert.equal(res.body, 'invalid image data')
  }

  // 正则允许 '=' 填充，但解码后 0 字节：拒绝为 empty image data。
  const empty = await callExport({ chunks: [evidenceBody({ card: { kind: 'empty' }, image: 'data:image/png;base64,====' })] })
  assert.equal(empty.res.status, 400)
  assert.equal(empty.res.body, 'empty image data')

  const brokenStream = await callExport({ fail: true })
  assert.equal(brokenStream.res.status, 400)
  assert.equal(brokenStream.res.body, 'bad request')
  assert.equal((await exportNames()).length, before, '被拒绝的请求不应写文件')
})

// ---------------------------------------------------------------------------
// 3) 上限：body 16 MiB、card 256 KiB
// ---------------------------------------------------------------------------

test('v17 超过 MAX_EVIDENCE_JSON 的 card 返回 413 evidence too large，且不留半份文件', async () => {
  assert.ok(constantsSource.includes('const MAX_EVIDENCE_JSON = 256 * 1024'))
  assert.ok(constantsSource.includes('const MAX_EXPORT_BODY = 16 * 1024 * 1024'))
  assert.ok(exportSource.includes('if (contentBytes > MAX_EVIDENCE_JSON) return sendText(res, 413, \'evidence too large\')'))

  const before = new Set(await exportNames())
  const card = { text: 'x'.repeat(MAX_EVIDENCE_JSON + 1024) }
  const { res } = await callExport({ chunks: [evidenceBody({ card })] })
  assert.equal(res.status, 413)
  assert.equal(res.body, 'evidence too large')
  assert.deepEqual((await exportNames()).filter((name) => !before.has(name)), [], '超限 card 不应留下任何文件')

  // 恰好 256 KiB 的合法 card 不触发 413（按 UTF-8 字节、2 空格缩进计算边界）。
  const baseBytes = Buffer.byteLength(JSON.stringify({ text: '' }, null, 2), 'utf8')
  const exact = { text: 'y'.repeat(MAX_EVIDENCE_JSON - baseBytes) }
  assert.equal(Buffer.byteLength(JSON.stringify(exact, null, 2), 'utf8'), MAX_EVIDENCE_JSON)
  const ok = await callExport({ chunks: [evidenceBody({ card: exact })] })
  assert.equal(ok.res.status, 200)
})

test('v17 超过 16 MiB 的 body 返回 413 并销毁请求流', async () => {
  const before = (await exportNames()).length
  // 每块 1 MiB：17 块超限，16 块恰好等于上限（继续走到 JSON 解析）。
  const chunk = 'x'.repeat(MAX_EXPORT_BODY / 16)
  const tooLarge = await callExport({ chunks: Array.from({ length: 17 }, () => chunk) })
  assert.equal(tooLarge.res.status, 413)
  assert.equal(tooLarge.res.body, 'payload too large')
  assert.equal(tooLarge.req.destroyed, true, '超限后必须停止读取请求流')
  assert.equal((await exportNames()).length, before, '超限 body 不应写文件')

  const boundary = await callExport({ chunks: Array.from({ length: 16 }, () => chunk) })
  assert.equal(boundary.res.status, 400)
  assert.equal(boundary.res.body, 'invalid json')
})

// ---------------------------------------------------------------------------
// 4) label 清洗：路径分隔符 / 星号不能逃出 exports 目录
// ---------------------------------------------------------------------------

test('v17 label 被 sanitizeLabel 清洗，文件名不含分隔符且留在 exports 目录', async () => {
  const label = '../../evil name/*stars*'
  const { res } = await callExport({ chunks: [evidenceBody({ card: { kind: 'label' }, label })] })
  assert.equal(res.status, 200)
  const ack = jsonOf(res)
  assert.equal(dirname(ack.path), exportsDir, 'label 不得影响目标目录')
  assert.match(basename(ack.path), /^earth-evidence-[0-9A-Za-z_-]+\.json$/)
  assert.doesNotMatch(basename(ack.path), /[\\/]|\.\./)
  assert.match(basename(ack.path), /-evil-name-stars\.json$/)
  assert.equal(await readFile(ack.path, 'utf8'), JSON.stringify({ kind: 'label' }, null, 2))

  // 非字符串 label 被忽略，文件名不带后缀。
  const numeric = await callExport({ chunks: [evidenceBody({ card: { kind: 'label-2' }, label: 42 })] })
  assert.equal(numeric.res.status, 200)
  assert.match(basename(jsonOf(numeric.res).path), /^earth-evidence-\d{8}-\d{6}-[0-9a-f]{8}\.json$/)
})

// ---------------------------------------------------------------------------
// 5) 接线：constants / routes / meta / index 导出
// ---------------------------------------------------------------------------

test('v17 meta 暴露 exportUrl，路由以 exact token 方式注册 evidenceExportHandler，index 重导出', () => {
  const metaSource = routesSource.slice(routesSource.indexOf('function metaHandler'))
  assert.ok(metaSource.includes('exportUrl: `${EXPORT_ROUTE}/${TOKEN}`,'), 'metaHandler 必须下发 exportUrl')
  assert.ok(constantsSource.includes('export const EXPORT_ROUTE = `${API}/export`'))
  assert.ok(constantsSource.includes('export const MAX_EXPORT_BODY = 16 * 1024 * 1024'))
  assert.ok(constantsSource.includes("export const EXPORTS_DIR = resolve(STATE_DIR, 'exports')"))
  assert.ok(exportSource.includes('export async function evidenceExportHandler(req, res) {'))
  assert.ok(
    routesSource.includes("register('exact', `${EXPORT_ROUTE}/${TOKEN}`, evidenceExportHandler)"),
    'export 路由必须精确注册到导出的 handler',
  )
  assert.ok(routesSource.includes('${EXPORT_ROUTE}/${TOKEN}'), '路由必须带 token 作用域')
  assert.doesNotMatch(routesSource, /register\('prefix', EXPORT_ROUTE/, '证据包路由不得注册为无 token 的前缀路由')
  assert.ok(indexSource.includes("export { evidenceExportHandler } from './src/host/export.js'"))
  assert.equal(typeof host.evidenceExportHandler, 'function')

  // 写入固定目录、复用 pruneByMtime 的保留策略。
  assert.ok(exportSource.includes('const jsonPath = join(EXPORTS_DIR, jsonName)'))
  assert.ok(exportSource.includes('await fs.mkdir(EXPORTS_DIR, { recursive: true })'))
  assert.ok(exportSource.includes('await pruneByMtime(EXPORTS_DIR, MAX_EXPORT_FILES, { keepName })'))
  assert.ok(exportSource.includes('void pruneExports(jsonName).catch(() => {})'))
})

// ---------------------------------------------------------------------------
// 6) token 安全：页面专用路由不得出现在工具源码/工具结果文本里
// ---------------------------------------------------------------------------

const renderFunctions = [
  'renderSceneResult',
  'renderCaptureResult',
  'renderDrawResult',
  'renderMeasureResult',
  'renderAnalyzeResult',
  'renderShaderResult',
  'renderInspectResult',
  'renderReportResult',
]

test('v17 token 安全：工具源码与工具结果文本不含 EXPORT_ROUTE/exportUrl/TOKEN', () => {
  for (const name of renderFunctions) {
    const body = topLevelFunction(hostAll, name)
    assert.doesNotMatch(body, /\bTOKEN\b|exportUrl|EXPORT_ROUTE/, `${name} 的结果文本不得携带证据包路由或 token`)
  }

  assert.ok(toolNames.length > 0)
  assert.doesNotMatch(toolSource, /exportUrl|EXPORT_ROUTE|\bTOKEN\b/, '工具源码不得引用页面专用证据包路由')
  assert.doesNotMatch(toolSource, /earth-evidence|evidenceExportHandler/, '工具源码不应知道证据包文件名或 handler')
  assert.ok(toolSource.includes('scrubToken('), '工具结果必须经过 scrubToken')
})

// ---------------------------------------------------------------------------
// 源码切片辅助
// ---------------------------------------------------------------------------

/** 取一个顶层 `function name(...)` / `async function name(...)` 到它独占一行的 `}` 为止。 */
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
