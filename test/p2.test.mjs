/**
 * P2 场景报告导出验收：宿主 report 路由 + `earth_scene action=report` + 客户端报告构建器。
 *
 * 这个文件只做验收，不改产品代码：
 *   - `reportHandler(req, res)` 是导出测试缝；EXPORTS_DIR 在模块加载时由 DSH_HOME
 *     固化，所以先建临时 DSH_HOME，再动态 import ../index.js，最后在 after() 里还原
 *     环境变量并清理目录；
 *   - SCENE_ACTIONS / normalizeSceneRequest / renderReportResult 是模块内实现，按源码
 *     切片断言（见每个测试里的注释）；
 *   - 客户端 buildSceneReport / runCommand / Data 菜单 / locale 属于接线断言。
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { clientSource as readClientSource, hostSource } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const MAX_REPORT_BODY = 16 * 1024 * 1024
const MAX_EXPORT_FILES = 200

/** 源码断言必须换行无关：Windows 检出可能是 CRLF。 */
const readSource = async (name) => (await readFile(join(root, name), 'utf8')).replace(/\r\n/g, '\n')
const clientSource = readClientSource()
// v2.0 split: implementation lives in src/host; source assertions read the
// owning module, `hostAll` is only used to extract top-level functions.
const hostAll = hostSource()
const readHostModule = (rel) => readFileSync(join(root, 'src/host', rel), 'utf8').replace(/\r\n/g, '\n')
const constantsSource = readHostModule('constants.js')
const routesSource = readHostModule('routes.js')
const storageSource = readHostModule('storage.js')
const sceneSource = readHostModule('tools/scene.js')
const commandsSource = readHostModule('commands.js')

// ---------------------------------------------------------------------------
// 宿主半边：DSH_HOME 必须在 import 之前设置，index.js 的 EXPORTS_DIR 是模块级常量，
// 晚一步设置报告就会写进真实用户目录。
// ---------------------------------------------------------------------------
const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-p2-'))
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
function fakeRequest({ method = 'POST', url = '/api/3dviewer/report/p2-route-token', chunks = [], fail = false } = {}) {
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

async function callReport(options) {
  const req = fakeRequest(options)
  const res = fakeResponse()
  await host.reportHandler(req, res)
  return { req, res }
}

async function exportNames() {
  try {
    return await readdir(exportsDir)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// 1) reportHandler：写入、格式、路径、拒绝路径
// ---------------------------------------------------------------------------

test('P2 reportHandler 已导出，html 报告写入临时 DSH_HOME 的 exports 目录', async () => {
  assert.equal(typeof host.reportHandler, 'function')

  const content = '<!doctype html><h1>场景报告</h1>'
  const body = JSON.stringify({ format: 'html', content, label: 'scene report' })
  // 分两段异步迭代，验证 handler 会累加 body。
  const { res } = await callReport({ chunks: [body.slice(0, 10), body.slice(10)] })

  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  const ack = jsonOf(res)
  assert.equal(ack.format, 'html')
  assert.equal(ack.bytes, Buffer.byteLength(content, 'utf8'))
  assert.equal(typeof ack.path, 'string')
  // 目标目录固定为 <临时 DSH_HOME>/digital-earth/exports，页面不能自选路径。
  assert.equal(dirname(ack.path), exportsDir)
  assert.equal(relative(resolve(home), resolve(ack.path)).startsWith('..'), false)
  assert.match(basename(ack.path), /^earth-report-\d{8}-\d{6}-[0-9a-f]{8}-scene-report\.html$/)
  assert.equal(await readFile(ack.path, 'utf8'), content)
  // 响应只是 path/format/bytes，不得回显 token 或内部路由。
  assert.doesNotMatch(res.body, /token|3dviewer/i)
})

test('P2 markdown 报告写入 .md；缺省 format 默认 html', async () => {
  const markdown = '# 场景报告\n\n- 图层: 无\n'
  const mdRes = (await callReport({ chunks: [JSON.stringify({ format: 'markdown', content: markdown })] })).res
  assert.equal(mdRes.status, 200)
  const mdAck = jsonOf(mdRes)
  assert.equal(mdAck.format, 'markdown')
  assert.match(basename(mdAck.path), /^earth-report-\d{8}-\d{6}-[0-9a-f]{8}\.md$/)
  assert.equal(await readFile(mdAck.path, 'utf8'), markdown)

  const defaultRes = (await callReport({ chunks: [JSON.stringify({ content: '<p>plain</p>' })] })).res
  assert.equal(defaultRes.status, 200)
  const defaultAck = jsonOf(defaultRes)
  assert.equal(defaultAck.format, 'html', '缺省 format 必须回退 html')
  assert.match(basename(defaultAck.path), /\.html$/)
  assert.equal(await readFile(defaultAck.path, 'utf8'), '<p>plain</p>')
})

test('P2 label 被清洗，报告路径不会逃出 exports 目录', async () => {
  const traversal = '../../evil name/../x y'
  const { res } = await callReport({ chunks: [JSON.stringify({ format: 'html', content: 'x', label: traversal })] })
  assert.equal(res.status, 200)
  const ack = jsonOf(res)
  assert.equal(dirname(ack.path), exportsDir, 'label 不得影响目标目录')
  assert.match(basename(ack.path), /^earth-report-\d{8}-\d{6}-[0-9a-f]{8}-evil-name-x-y\.html$/)
  assert.doesNotMatch(basename(ack.path), /[\\/]|\.\./)

  const numeric = (await callReport({ chunks: [JSON.stringify({ format: 'html', content: 'y', label: 42 })] })).res
  assert.equal(numeric.status, 200)
  assert.match(basename(jsonOf(numeric).path), /^earth-report-\d{8}-\d{6}-[0-9a-f]{8}\.html$/, '非字符串 label 应被忽略')
})

test('P2 GET/PUT 等非 POST 方法返回 405，且不读请求体、不写文件', async () => {
  const before = (await exportNames()).length
  for (const method of ['GET', 'PUT', 'HEAD', 'DELETE']) {
    const { req, res } = await callReport({ method, chunks: [JSON.stringify({ format: 'html', content: 'nope' })] })
    assert.equal(res.status, 405, `${method} 必须被拒绝`)
    assert.equal(res.body, 'method not allowed')
    assert.equal(req.iterated, 0, `${method} 不应读取请求体`)
  }
  assert.equal((await exportNames()).length, before, '被拒绝的方法不应写文件')
})

test('P2 非法 format 返回 400 invalid format', async () => {
  const before = (await exportNames()).length
  for (const format of ['pdf', 'HTML', 'markdown ', '', 'md', 'markdown\n']) {
    const { res } = await callReport({ chunks: [JSON.stringify({ format, content: '<p>x</p>' })] })
    assert.equal(res.status, 400, `format=${JSON.stringify(format)} 必须被拒绝`)
    assert.equal(res.body, 'invalid format')
  }
  assert.equal((await exportNames()).length, before, '非法 format 不应写文件')
})

test('P2 空内容/缺内容返回 400 empty report', async () => {
  const before = (await exportNames()).length
  const bodies = [
    JSON.stringify({ format: 'html', content: '' }),
    JSON.stringify({ format: 'html', content: '   \n\t ' }),
    JSON.stringify({ format: 'html' }),
    JSON.stringify({ format: 'html', content: 123 }),
    'null',
  ]
  for (const body of bodies) {
    const { res } = await callReport({ chunks: [body] })
    assert.equal(res.status, 400, `body=${body} 必须被拒绝`)
    assert.equal(res.body, 'empty report')
  }
  assert.equal((await exportNames()).length, before, '空内容不应写文件')
})

test('P2 非法 JSON（含空 body）返回 400 invalid json', async () => {
  const broken = await callReport({ chunks: ['{broken'] })
  assert.equal(broken.res.status, 400)
  assert.equal(broken.res.body, 'invalid json')

  const empty = await callReport({ chunks: [] })
  assert.equal(empty.res.status, 400)
  assert.equal(empty.res.body, 'invalid json')
})

test('P2 超过 16 MiB 的 body 返回 413 并销毁请求流；恰好 16 MiB 不算超限', async () => {
  const before = (await exportNames()).length
  // 每块 1 MiB：16 块恰好等于上限，17 块超限。
  const chunk = 'x'.repeat(MAX_REPORT_BODY / 16)

  // 17 MiB：第 17 块让 body 超过 16 MiB 上限。
  const tooLarge = await callReport({ chunks: Array.from({ length: 17 }, () => chunk) })
  assert.equal(tooLarge.res.status, 413)
  assert.equal(tooLarge.res.body, 'payload too large')
  assert.equal(tooLarge.req.destroyed, true, '超限后必须停止读取请求流')
  assert.equal((await exportNames()).length, before, '超限 body 不应写文件')

  // 恰好 16 MiB：不触发 413，继续走到 JSON 解析。
  const boundary = await callReport({ chunks: Array.from({ length: 16 }, () => chunk) })
  assert.equal(boundary.res.status, 400)
  assert.equal(boundary.res.body, 'invalid json')

  // 上限值来自源码常量，避免测试里硬编码一个与产品脱节的数字。
  assert.ok(constantsSource.includes('const MAX_REPORT_BODY = 16 * 1024 * 1024'))
  const handlerSource = topLevelFunction(hostAll, 'reportHandler')
  assert.ok(handlerSource.includes('if (body.length > MAX_REPORT_BODY) {'))
  assert.ok(handlerSource.includes('req.destroy()'))
  assert.ok(handlerSource.includes("return sendText(res, 413, 'payload too large')"))
})

test('P2 读取请求流出错返回 400 bad request', async () => {
  const { res } = await callReport({ fail: true })
  assert.equal(res.status, 400)
  assert.equal(res.body, 'bad request')
})

test('P2 exports 目录只保留最新 MAX_EXPORT_FILES=200 份报告', async () => {
  assert.ok(constantsSource.includes('const MAX_EXPORT_FILES = 200'))
  assert.ok(storageSource.includes('function pruneExports(keepName)'))
  assert.ok(storageSource.includes('void pruneExports(name).catch(() => {})'))

  await mkdir(exportsDir, { recursive: true })
  // 造 201 份旧文件，让目录超过上限。
  await Promise.all(
    Array.from({ length: 201 }, (_, index) => writeFile(join(exportsDir, `dummy-${String(index).padStart(3, '0')}.html`), 'x')),
  )
  const content = '<p>prune me last</p>'
  const { res } = await callReport({ chunks: [JSON.stringify({ format: 'html', content })] })
  assert.equal(res.status, 200)
  const ack = jsonOf(res)

  // 裁剪是 fire-and-forget：轮询到目录回到上限，断言最新报告仍然存在。
  const deadline = Date.now() + 5000
  let count = Infinity
  while (Date.now() < deadline) {
    count = (await exportNames()).length
    if (count <= MAX_EXPORT_FILES) break
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25))
  }
  assert.equal(count, MAX_EXPORT_FILES, 'exports 目录应被裁剪回 200 份')
  assert.equal(await readFile(ack.path, 'utf8'), content, '本次写入的报告不能被裁掉')
  assert.ok(!(await exportNames()).includes('dummy-000.html'), '最旧的报告应被删除')
})

// ---------------------------------------------------------------------------
// 2) meta / 路由 / 渲染函数接线
// ---------------------------------------------------------------------------

const metaSource = routesSource.slice(routesSource.indexOf('function metaHandler'))

test('P2 meta 暴露 reportUrl，路由以 exact token 方式指向导出的 reportHandler', () => {
  assert.ok(metaSource.includes('reportUrl: `${REPORT_ROUTE}/${TOKEN}`,'), 'metaHandler 必须下发 reportUrl')
  assert.ok(constantsSource.includes('const REPORT_ROUTE = `${API}/report`'))
  assert.ok(constantsSource.includes("const REPORT_FORMATS = new Set(['html', 'markdown'])"))
  assert.ok(constantsSource.includes("const EXPORTS_DIR = resolve(STATE_DIR, 'exports')"))
  assert.ok(storageSource.includes('export async function reportHandler(req, res) {'))
  // 报告只能写进固定目录：文件名由宿主生成，页面只提供内容。
  assert.ok(storageSource.includes('const target = join(EXPORTS_DIR, name)'))
  assert.ok(storageSource.includes("await fs.writeFile(target, content, 'utf8')"))
  assert.ok(
    routesSource.includes("register('exact', `${REPORT_ROUTE}/${TOKEN}`, reportHandler)"),
    'report 路由必须精确注册到导出的 handler',
  )
})

test('P2 renderReportResult 接入 report 结果渲染（当前为模块内函数，未导出）', () => {
  const renderSource = topLevelFunction(hostAll, 'renderReportResult')
  assert.ok(renderSource.includes('Scene report written: ${path}'))
  assert.ok(renderSource.includes('Format: ${format}${bytes}.'))
  assert.ok(renderSource.includes('Sections: ${value.sections.join'))
  assert.ok(renderSource.includes('Skipped: ${value.failed.join'))
  assert.ok(renderSource.includes('Call present with this path to show the report to the user.'))

  const createScene = sceneSource.slice(sceneSource.indexOf('function createSceneTool'))
  assert.ok(createScene.includes("value.operation === 'report'"))
  assert.ok(createScene.includes('renderReportResult(value)'))

  // 事实记录：当前实现把 renderReportResult 留在模块内，无法直接单测。
  // 若将来导出，可把这里换成 typeof host.renderReportResult === 'function'。
  assert.equal('renderReportResult' in host, false, 'renderReportResult 目前不是导出测试缝')
})

test('P2 token 安全：REPORT_ROUTE/reportUrl 不出现在工具结果渲染函数与工具定义里', () => {
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
  for (const name of renderFunctions) {
    const body = topLevelFunction(hostAll, name)
    assert.doesNotMatch(body, /\bTOKEN\b|reportUrl|REPORT_ROUTE/, `${name} 的结果文本不得携带导出路由或 token`)
  }

  const toolSource = [
    sceneSource,
    readHostModule('tools/capture.js'),
    readHostModule('tools/draw.js'),
    readHostModule('tools/measure.js'),
    readHostModule('tools/analyze.js'),
    readHostModule('tools/shader.js'),
  ].join('\n')
  assert.doesNotMatch(toolSource, /reportUrl|REPORT_ROUTE|\bTOKEN\b/)
  assert.ok(toolSource.includes('scrubToken('), 'report 结果也要经过 scrubToken')
})

// ---------------------------------------------------------------------------
// 3) earth_scene report 动作（模块内实现，源码断言）
// ---------------------------------------------------------------------------

test('P2 SCENE_ACTIONS 注册 report 动作与 format/title/include_capture 参数', () => {
  const sceneActions = sourceSlice(sceneSource, 'const SCENE_ACTIONS = {', 'const SCENE_ACTION_NAMES')
  assert.ok(sceneActions.includes("report: ['format', 'title', 'include_capture'],"))
  const actions = [...sceneActions.matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1])
  assert.deepEqual(actions, [
    'status',
    'list',
    'load',
    'remove',
    'visible',
    'basemap',
    'terrain',
    'fly',
    'reset',
    'pick',
    'inspect',
    'report',
  ])
  assert.equal(actions.length, 12, '契约测试按 12 个 action 对齐')

  const sceneParameters = sourceSlice(sceneSource, 'const SCENE_PARAMETERS = {', 'const SCENE_DESCRIPTION')
  assert.ok(sceneParameters.includes("enum: ['html', 'markdown'],"))
  assert.ok(sceneParameters.includes('report: output format. Default html'))
  assert.ok(sceneParameters.includes('report: report title, up to 120 characters.'))
  assert.ok(sceneParameters.includes('report: also capture the current view'))
  assert.ok(sceneParameters.includes("required: ['action']"))
  assert.ok(sceneParameters.includes('additionalProperties: false'))

  const description = sceneSource.slice(sceneSource.indexOf('const SCENE_DESCRIPTION = ['))
  assert.ok(description.includes('- report: write a scene report'))
})

test('P2 normalizeSceneRequest 处理 report 默认值/标题截断/参数校验，createSceneTool 用 REPORT_TIMEOUT_MS', () => {
  const normalize = sceneSource.slice(sceneSource.indexOf('function normalizeSceneRequest'))
  assert.ok(normalize.includes("case 'report': {"))
  assert.ok(normalize.includes("const format = raw.format === undefined ? 'html' : raw.format"))
  assert.ok(normalize.includes('if (typeof format !== \'string\' || !REPORT_FORMATS.has(format)) {'))
  assert.ok(normalize.includes('report "format" must be "html" or "markdown".'))
  assert.ok(normalize.includes('if (typeof raw.title !== \'string\') throw sceneError(\'report "title" must be a string.\')'))
  assert.ok(normalize.includes('const title = raw.title.trim().slice(0, 120)'))
  assert.ok(normalize.includes("if (title !== '') args.title = title"))
  assert.ok(normalize.includes('if (raw.include_capture !== undefined) {'))
  assert.ok(normalize.includes('if (typeof raw.include_capture !== \'boolean\') throw sceneError(\'report "include_capture" must be true or false.\')'))
  assert.ok(normalize.includes('args.include_capture = raw.include_capture'))

  assert.ok(constantsSource.includes('const REPORT_TIMEOUT_MS = 45000'))
  const createScene = sceneSource.slice(sceneSource.indexOf('function createSceneTool'))
  assert.ok(createScene.includes("const timeout = request.action === 'report' ? REPORT_TIMEOUT_MS : SCENE_TIMEOUT_MS"))
  assert.ok(createScene.includes("value.operation === 'report'"))
})

// ---------------------------------------------------------------------------
// 4) /earth 命令：report 分支
// ---------------------------------------------------------------------------

const commandSource = commandsSource.slice(commandsSource.indexOf('function mountEarthCommand'))

test('P2 /earth 命令新增 report [html|markdown] 分支与用法文案', () => {
  assert.ok(commandSource.includes("input: { hint: 'status | capture [label] | report [html|markdown] | clear | open' }"))
  assert.ok(commandSource.includes("if (sub === 'report') {"))
  assert.ok(commandSource.includes("const requested = (words[0] ?? 'html').toLowerCase()"))
  assert.ok(commandSource.includes("const format = requested === 'markdown' || requested === 'md' ? 'markdown' : 'html'"))
  assert.ok(
    commandSource.includes("bridge.run(target.sessionId, 'report', { format, include_capture: true }, REPORT_TIMEOUT_MS)"),
  )
  assert.ok(commandSource.includes('`Scene report written: ${path}`'))
  assert.ok(commandSource.includes("text: path === '' ? 'Scene report written.'"))
  assert.ok(commandSource.includes('/earth report [html|markdown]'))
  // 命令结果留在命令 UI：不得写进模型消息通道。
  assert.doesNotMatch(commandSource, /systemPrompt|scope\.tools|addMessage|messages\.push/)
})

// ---------------------------------------------------------------------------
// 5) 客户端：locale、buildSceneReport、runCommand、Data 菜单、量测结果
// ---------------------------------------------------------------------------

const localeLines = clientSource.split('\n')
const zhLine = localeLines.indexOf('      zh: {')
const enLine = localeLines.indexOf('      en: {')
const fallbackAboutLine = localeLines.indexOf('    const FALLBACK_ABOUT = {')
const zhMessages = localeLines.slice(zhLine, enLine).join('\n')
const enMessages = localeLines.slice(enLine, fallbackAboutLine).join('\n')

/** 取某语言块里 `'key': 'value'` 的 value。 */
function localeValue(table, key) {
  const match = new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'([^']*)'`).exec(table)
  return match === null ? null : match[1]
}

test('P2 中文与英文词典都有 menu.report 与 report toast 文案（带占位符）', () => {
  assert.ok(zhLine !== -1, 'client.js 应内联中文词典')
  assert.ok(enLine > zhLine, 'client.js 应内联英文词典')
  assert.ok(fallbackAboutLine > enLine)

  const keys = ['menu.report', 'toast.reportSaved', 'toast.reportFailed']
  for (const key of keys) {
    const zh = localeValue(zhMessages, key)
    const en = localeValue(enMessages, key)
    assert.ok(zh !== null && zh !== '', `中文词典缺少 ${key}`)
    assert.ok(en !== null && en !== '', `英文词典缺少 ${key}`)
    assert.match(zh, /[\u4e00-\u9fff]/, `${key} 的中文文案不应是英文回退`)
    assert.match(en, /^[\x20-\x7e]*$/, `${key} 的英文文案不应含中文`)
  }
  assert.ok(localeValue(zhMessages, 'toast.reportSaved').includes('{path}'))
  assert.ok(localeValue(enMessages, 'toast.reportSaved').includes('{path}'))
  assert.ok(localeValue(zhMessages, 'toast.reportFailed').includes('{message}'))
  assert.ok(localeValue(enMessages, 'toast.reportFailed').includes('{message}'))
})

const buildReportSource = sourceSlice(clientSource, 'async function buildSceneReport', 'function setLayerVisible')

test('P2 buildSceneReport 选择 html/markdown，include_capture 控制 captureScene 并内嵌 base64 截图', () => {
  assert.ok(buildReportSource.includes("const format = args.format === 'markdown' ? 'markdown' : 'html'"))
  assert.ok(buildReportSource.includes("args.title.trim() !== '' ? args.title.trim().slice(0, 120) : L.title"))
  // 截图是可选的：include_capture === false 时不做 captureScene。
  assert.ok(buildReportSource.includes('if (args.include_capture !== false) {'))
  assert.ok(buildReportSource.includes('const saved = await captureScene({}, sessionRef.current)'))
  // html 报告把截图读成 blob 再 base64 内嵌，离线也能看。
  assert.ok(buildReportSource.includes("mime: 'image/jpeg'"))
  assert.ok(buildReportSource.includes("fetch(saved.url, { credentials: 'same-origin' })"))
  assert.ok(buildReportSource.includes('const blob = await response.blob()'))
  assert.ok(buildReportSource.includes('capture.base64 = arrayBufferToBase64(await blob.arrayBuffer())'))
  assert.ok(buildReportSource.includes('if (capture.path !== \'\') sections.push(\'snapshot\')'))
  // html 转义与 base64 辅助函数存在，且 btoa 走二进制字符串。
  assert.ok(clientSource.includes('const escapeHtml = (value) =>'))
  assert.ok(clientSource.includes('const arrayBufferToBase64 = (buffer) =>'))
  assert.ok(clientSource.includes('return btoa(binary)'))
  assert.ok(clientSource.includes("return '&amp;'"))
  assert.ok(clientSource.includes("return '&lt;'"))
  assert.ok(clientSource.includes("return '&gt;'"))
})

test('P2 buildSceneReport 汇总相机/图层/环境/叠加/量测/分析/着色器/截图并生成两种格式', () => {
  // 场景数据来源。
  assert.ok(buildReportSource.includes('const status = await collectSceneStatus().catch(() => null)'))
  assert.ok(buildReportSource.includes('const view = status?.view ?? null'))
  assert.ok(buildReportSource.includes('const layers = Array.isArray(status?.layers) ? status.layers : []'))
  assert.ok(buildReportSource.includes('const annotations = status?.annotations ?? {}'))
  assert.ok(buildReportSource.includes('const environment = `${L.imagery}: ${status?.imagery?.name ?? L.none}; ${L.terrain}: ${status?.terrain?.name ?? L.none}`'))
  assert.ok(buildReportSource.includes('const overlayLine = `${L.annotatedFeatures}: ${annotations.drawn_features ?? 0}'))

  // 量测结果从 measureCommands 里取（P1 批次新增的 result 字段）。
  assert.ok(buildReportSource.includes('agentOverlayRef.current.measureCommands'))
  assert.ok(buildReportSource.includes('.map((command) => command?.result)'))
  assert.ok(buildReportSource.includes("if (result.mode === 'distance') return `${L.distance}: ${formatDistance(result.distance_m)}`"))
  assert.ok(buildReportSource.includes("if (result.mode === 'area') return `${L.area}: ${formatArea(result.area_m2)}`"))
  assert.ok(buildReportSource.includes("if (result.mode === 'height') {"))
  assert.ok(buildReportSource.includes("if (measurements.length > 0) sections.push('measurements')"))

  // 分析三种操作与着色器预设。
  assert.ok(buildReportSource.includes("if (result.operation === 'profile') {"))
  assert.ok(buildReportSource.includes("} else if (result.operation === 'flood') {"))
  assert.ok(buildReportSource.includes("} else if (result.operation === 'sunlight') {"))
  assert.ok(buildReportSource.includes("if (analysisText !== '') sections.push('analysis')"))
  assert.ok(buildReportSource.includes('const shaders = shaderActiveList()'))
  assert.ok(buildReportSource.includes("if (shaders.length > 0) sections.push('shaders')"))
  assert.ok(buildReportSource.includes("sections.unshift('camera', 'layers')"))
  assert.ok(buildReportSource.includes("sections.splice(2, 0, 'basemap & terrain')"))

  // Markdown 与自包含 HTML 两种输出。
  assert.ok(buildReportSource.includes('`# ${title}`'))
  assert.ok(buildReportSource.includes('| --- | --- |'))
  assert.ok(buildReportSource.includes('![${L.snapshot}](${capture.path})'))
  assert.ok(buildReportSource.includes('<!doctype html>'))
  assert.ok(buildReportSource.includes('<style>'))
  assert.ok(buildReportSource.includes('src="data:${escapeHtml(capture.mime)};base64,${capture.base64}"'))
  assert.ok(buildReportSource.includes('<h1>${escapeHtml(title)}</h1>'))
  assert.ok(buildReportSource.includes("lang=\"${chinese ? 'zh-CN' : 'en'}\""))
  assert.ok(buildReportSource.includes("return { format, title, content, label: 'scene', sections, failed }"))
})

const runReportSource = sourceSlice(clientSource, "if (action === 'report') {", "throw new Error(t('agent.badAction'")

test('P2 runCommand report 分支 POST meta.reportUrl 并返回 operation:report（不带 token/URL）', () => {
  assert.ok(runReportSource.includes('const meta = metaRef.current'))
  assert.ok(runReportSource.includes("if (!meta?.reportUrl) throw new Error(t('agent.notReady'))"))
  assert.ok(runReportSource.includes('const report = await buildSceneReport(args)'))
  assert.ok(runReportSource.includes('fetch(meta.reportUrl, {'))
  assert.ok(runReportSource.includes("method: 'POST',"))
  assert.ok(runReportSource.includes('body: JSON.stringify(report),'))
  assert.ok(runReportSource.includes('if (!response.ok) throw new Error(`HTTP ${response.status}`)'))
  assert.ok(runReportSource.includes('const saved = await response.json()'))
  assert.ok(runReportSource.includes("operation: 'report',"))
  assert.ok(runReportSource.includes('path: saved.path,'))
  assert.ok(runReportSource.includes('format: saved.format ?? report.format,'))
  assert.ok(runReportSource.includes('bytes: saved.bytes,'))
  assert.ok(runReportSource.includes('title: report.title,'))
  assert.ok(runReportSource.includes('sections: report.sections,'))
  assert.ok(runReportSource.includes('failed: report.failed,'))
  // 模型可见的结果只有本地路径与元数据，不得回显 token-bearing URL。
  assert.doesNotMatch(runReportSource, /\burl\s*:/)
  assert.doesNotMatch(runReportSource, /\btoken\b/i)
})

test('P2 数据菜单 menu.report 调用 runCommand("report",{format:"html"}) 并提示成功/失败', () => {
  const menuSource = sourceSlice(clientSource, "key: 'report',", "t('menu.report'),")
  assert.ok(menuSource.includes("const value = await runCommand('report', { format: 'html' })"))
  assert.ok(menuSource.includes("showToast(t('toast.reportSaved', { path: value.path }))"))
  assert.ok(menuSource.includes("showToast(t('toast.reportFailed', { message: message(error) }))"))
  assert.ok(menuSource.includes('setOpenMenu(null)'))
  assert.ok(clientSource.includes("t('menu.report'),"))
})

test('P2 measureCommands 记录量测 result，供报告引用', () => {
  const measureSource = sourceSlice(clientSource, 'function measureAgentOverlay', '//#endregion Agent overlays')
  assert.ok(measureSource.includes('const result = { mode, points: points.length, drawn: draw }'))
  assert.ok(measureSource.includes('state.measureCommands.push({ mode, points, draw: true, result })'))
  assert.ok(measureSource.includes('return result'))
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
