/**
 * P1「问 Agent」验收：宿主注入路由 + 客户端接线。
 *
 * 这个文件只做验收，不改产品代码：
 *   - `injectHandler(ctx, req, res)` 是导出的测试缝，ctx 由调用方传入，所以用假
 *     agents 服务直接跑：成功注入的消息结构、C0 控制字符清理、4000 字符截断、
 *     405/400/413/503/409/500 各条拒绝路径；
 *   - meta/路由、客户端 `askAgent` 与双语词典属于「还在不在」的接线断言，按源码
 *     切片检查；
 *   - token 安全：注入路由与 token 不得出现在任何工具结果渲染函数或工具定义里。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { injectHandler } from '../index.js'
import { clientSource as readClientSource, hostSource } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const MAX_INJECT_BODY = 16 * 1024
const MAX_INJECT_TEXT = 4000

/** 源码断言必须换行无关：Windows 检出可能是 CRLF。 */
const readSource = async (name) => (await readFile(join(root, name), 'utf8')).replace(/\r\n/g, '\n')
const clientSource = readClientSource()
// v1.5 split: read the owning module for source assertions; `hostAll` is the
// concatenated authored host source and is only used for top-level extraction.
const hostAll = hostSource()
const readHostModule = (rel) => readFileSync(join(root, 'src/host', rel), 'utf8').replace(/\r\n/g, '\n')
const constantsSource = readHostModule('constants.js')
const routesSource = readHostModule('routes.js')
const injectSource = readHostModule('inject.js')

// ---------------------------------------------------------------------------
// 假 ctx / agents / agent / req / res
// ---------------------------------------------------------------------------

function makeAgent(injectImpl) {
  const calls = []
  const agent = {
    calls,
    inject(message) {
      calls.push(message)
      if (typeof injectImpl === 'function') return injectImpl(message)
      return undefined
    },
  }
  return agent
}

function makeAgents(getImpl) {
  const getCalls = []
  const agents = {
    getCalls,
    get(session) {
      getCalls.push(session)
      return getImpl(session)
    },
  }
  return agents
}

function makeContext(agents, { getThrows = false } = {}) {
  const getCalls = []
  const ctx = {
    getCalls,
    get(name) {
      getCalls.push(name)
      if (getThrows) throw new Error('service graph detached')
      return name === 'agents' ? agents : undefined
    },
  }
  return ctx
}

/** 假 req：EventEmitter + method/url/headers + 可 async 迭代的 body。 */
function fakeRequest({ method = 'POST', url = '/api/3dviewer/inject/p1-route-token', chunks = [], fail = false } = {}) {
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

async function invoke(ctx, options) {
  const req = fakeRequest(options)
  const res = fakeResponse()
  await injectHandler(ctx, req, res)
  return { req, res }
}

/** 发一条合法 JSON POST，按给定的分段切 body。 */
async function postJson(ctx, payload, { chunks = null, session = 'p1-session-a' } = {}) {
  const body = JSON.stringify({ session, ...payload })
  const parts = chunks ?? [body]
  return invoke(ctx, { chunks: parts })
}

// ---------------------------------------------------------------------------
// 1) 成功注入：消息结构、get/inject 调用次数、会话隔离
// ---------------------------------------------------------------------------

test('P1 POST 有效请求：agents.get(session) 与 agent.inject(message) 各一次，消息结构正确', async () => {
  const agent = makeAgent()
  const agents = makeAgents(() => agent)
  const ctx = makeContext(agents)
  const text = '请描述当前场景'
  const body = JSON.stringify({ session: 'p1-session-a', text })
  // 分三段异步迭代，验证 handler 会累加 body 而不是只看第一块。
  const { res } = await invoke(ctx, { chunks: [body.slice(0, 7), body.slice(7, 25), body.slice(25)] })

  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.deepEqual(jsonOf(res), { ok: true })
  assert.deepEqual(ctx.getCalls, ['agents'])
  assert.deepEqual(agents.getCalls, ['p1-session-a'])
  assert.equal(agent.calls.length, 1)

  const message = agent.calls[0]
  assert.equal(typeof message.id, 'string')
  assert.ok(message.id.length > 0, '消息 id 必须是非空字符串')
  assert.equal(message.role, 'user')
  assert.deepEqual(message.content, [{ type: 'text', text }])
  assert.deepEqual(message.source, {
    kind: 'digital-earth',
    form: 'notice',
    summary: 'Digital Earth scene context',
  })
  // 注入进模型上下文的消息只能带这四个字段，不得夹带 token/URL。
  assert.deepEqual(Object.keys(message).sort(), ['content', 'id', 'role', 'source'])
  assert.doesNotMatch(JSON.stringify(message), /token/i)
})

test('P1 每次 POST 生成新的消息 id，不会复用固定 id', async () => {
  const agent = makeAgent()
  const agents = makeAgents(() => agent)
  const ctx = makeContext(agents)

  await postJson(ctx, { text: '第一次' })
  await postJson(ctx, { text: '第二次' })

  assert.equal(agent.calls.length, 2, '两次 POST 必须各注入一次')
  assert.equal(typeof agent.calls[0].id, 'string')
  assert.notEqual(agent.calls[0].id, agent.calls[1].id)
  assert.deepEqual(agents.getCalls, ['p1-session-a', 'p1-session-a'])
})

// ---------------------------------------------------------------------------
// 2) 文本清理：控制字符、trim、4000 字符截断
// ---------------------------------------------------------------------------

test('P1 清理 C0 控制字符但保留 tab 与换行', async () => {
  const agent = makeAgent()
  const ctx = makeContext(makeAgents(() => agent))
  const text = 'a\u0000b\u0001c\u0008d\u000b\u000ce\u000ef\tTAB\nNEWLINE\u001f!'
  const { res } = await postJson(ctx, { text })

  assert.equal(res.status, 200)
  assert.equal(agent.calls[0].content[0].text, 'abcdef\tTAB\nNEWLINE!')
})

test('P1 首尾空白被 trim（包括剥离控制字符后残留的空白）', async () => {
  const agent = makeAgent()
  const ctx = makeContext(makeAgents(() => agent))
  const { res } = await postJson(ctx, { text: '  \u0000 hi \u0001  ' })

  assert.equal(res.status, 200)
  assert.equal(agent.calls[0].content[0].text, 'hi')
})

test('P1 文本截断到 4000 字符，恰好 4000 字符原样保留', async () => {
  const agent = makeAgent()
  const ctx = makeContext(makeAgents(() => agent))

  const tooLong = 'x'.repeat(MAX_INJECT_TEXT + 1)
  const truncated = await postJson(ctx, { text: tooLong })
  assert.equal(truncated.res.status, 200, '超长文本应截断而不是拒绝')
  assert.equal(agent.calls[0].content[0].text.length, MAX_INJECT_TEXT)
  assert.equal(agent.calls[0].content[0].text, 'x'.repeat(MAX_INJECT_TEXT))

  const exact = 'y'.repeat(MAX_INJECT_TEXT)
  const kept = await postJson(ctx, { text: exact })
  assert.equal(kept.res.status, 200)
  assert.equal(agent.calls[1].content[0].text, exact)
})

// ---------------------------------------------------------------------------
// 3) 拒绝路径：方法、body、session、文本、体积、流错误
// ---------------------------------------------------------------------------

test('P1 非 POST 方法返回 405，且不读 body、不查 agents', async () => {
  const agents = makeAgents(() => makeAgent())
  const ctx = makeContext(agents)
  for (const method of ['GET', 'DELETE', 'PUT']) {
    const { req, res } = await invoke(ctx, { method, chunks: ['{"session":"p1-session-a","text":"hi"}'] })
    assert.equal(res.status, 405, `${method} 必须被拒绝`)
    assert.equal(res.body, 'method not allowed')
    assert.equal(req.iterated, 0, `${method} 不应读取请求体`)
  }
  assert.deepEqual(ctx.getCalls, [])
})

test('P1 非法 JSON（含空 body）返回 400 invalid json', async () => {
  const agents = makeAgents(() => makeAgent())
  const ctx = makeContext(agents)

  const broken = await invoke(ctx, { chunks: ['{broken'] })
  assert.equal(broken.res.status, 400)
  assert.equal(broken.res.body, 'invalid json')

  const empty = await invoke(ctx, { chunks: [] })
  assert.equal(empty.res.status, 400)
  assert.equal(empty.res.body, 'invalid json')

  assert.deepEqual(ctx.getCalls, [], 'JSON 解析失败不应查询 agents')
})

test('P1 缺少或非法 session 返回 400 missing or invalid session', async () => {
  const agents = makeAgents(() => makeAgent())
  const ctx = makeContext(agents)
  const bodies = [
    '{}',
    '{"session":""}',
    '{"session":"bad session"}',
    '{"session":"  "}',
    '{"session":123}',
    'null',
  ]
  for (const body of bodies) {
    const { res } = await invoke(ctx, { chunks: [body] })
    assert.equal(res.status, 400, `body=${body} 必须被拒绝`)
    assert.equal(res.body, 'missing or invalid session')
  }
  assert.deepEqual(ctx.getCalls, [], 'session 非法时不应查询 agents')
})

test('P1 空文本或纯空白文本返回 400 missing text', async () => {
  const agents = makeAgents(() => makeAgent())
  const ctx = makeContext(agents)
  const payloads = [
    { session: 'p1-session-a', text: '' },
    { session: 'p1-session-a', text: '   ' },
    { session: 'p1-session-a' },
    { session: 'p1-session-a', text: '\u0000\u0001\t\n  ' },
  ]
  for (const payload of payloads) {
    const { res } = await invoke(ctx, { chunks: [JSON.stringify(payload)] })
    assert.equal(res.status, 400, `payload=${JSON.stringify(payload)} 必须被拒绝`)
    assert.equal(res.body, 'missing text')
  }
  assert.deepEqual(ctx.getCalls, [], '文本为空时不应查询 agents')
})

test('P1 超过 16KiB 的 body 返回 413 并销毁请求流；恰好 16KiB 不算超限', async () => {
  const agents = makeAgents(() => makeAgent())
  const ctx = makeContext(agents)

  const tooLarge = await invoke(ctx, { chunks: ['x'.repeat(MAX_INJECT_BODY + 1)] })
  assert.equal(tooLarge.res.status, 413)
  assert.equal(tooLarge.res.body, 'payload too large')
  assert.equal(tooLarge.req.destroyed, true, '超限后必须停止读取请求流')
  assert.deepEqual(ctx.getCalls, [])

  const boundary = await invoke(ctx, { chunks: ['y'.repeat(MAX_INJECT_BODY)] })
  assert.equal(boundary.res.status, 400, '恰好 16KiB 应进入 JSON 解析而不是 413')
  assert.equal(boundary.res.body, 'invalid json')
})

test('P1 读取请求流出错返回 400 bad request', async () => {
  const ctx = makeContext(makeAgents(() => makeAgent()))
  const { res } = await invoke(ctx, { fail: true })
  assert.equal(res.status, 400)
  assert.equal(res.body, 'bad request')
})

// ---------------------------------------------------------------------------
// 4) agents 服务状态：503 / fallback / 409 / 500
// ---------------------------------------------------------------------------

test('P1 没有可用 agents 服务返回 503 agent_unavailable（缺服务、get 抛错、服务不完整）', async () => {
  // ctx.get 返回 undefined 且没有 ctx.agents。
  const missing = makeContext(undefined)
  const missingRes = (await postJson(missing, { text: 'hi' })).res
  assert.equal(missingRes.status, 503)
  assert.deepEqual(jsonOf(missingRes), {
    ok: false,
    error: 'agent_unavailable',
    message: 'The Agent runtime is unavailable in this DSH build.',
  })

  // ctx.get 本身抛错（服务图未挂接）也要按不可用处理，而不是 500。
  const throws = makeContext(undefined, { getThrows: true })
  const throwsRes = (await postJson(throws, { text: 'hi' })).res
  assert.equal(throwsRes.status, 503)
  assert.equal(jsonOf(throwsRes).error, 'agent_unavailable')

  // 服务对象没有 get 方法。
  const brokenService = makeContext({ notGet: true })
  const brokenRes = (await postJson(brokenService, { text: 'hi' })).res
  assert.equal(brokenRes.status, 503)
  assert.equal(jsonOf(brokenRes).error, 'agent_unavailable')
})

test('P1 ctx.get 返回 undefined 时回退到 ctx.agents', async () => {
  const agent = makeAgent()
  const agents = makeAgents(() => agent)
  const ctx = {
    agents,
    get() {
      return undefined
    },
  }
  const { res } = await postJson(ctx, { text: 'fallback' })
  assert.equal(res.status, 200)
  assert.deepEqual(jsonOf(res), { ok: true })
  assert.deepEqual(agents.getCalls, ['p1-session-a'])
  assert.equal(agent.calls[0].content[0].text, 'fallback')
})

test('P1 agents.get 未命中或 agent 没有 inject 返回 409 agent_not_running', async () => {
  const cases = [() => null, () => ({}), () => ({ inject: 'not-a-function' })]
  for (const getImpl of cases) {
    const ctx = makeContext(makeAgents(getImpl))
    const { res } = await postJson(ctx, { text: 'hi' })
    assert.equal(res.status, 409)
    const body = jsonOf(res)
    assert.equal(body.ok, false)
    assert.equal(body.error, 'agent_not_running')
    assert.equal(typeof body.message, 'string')
    assert.ok(body.message.length > 0)
  }
})

test('P1 agent.inject 抛错返回 500 inject_failed，且只尝试一次', async () => {
  const agent = makeAgent(() => {
    throw new Error('inbox closed')
  })
  const ctx = makeContext(makeAgents(() => agent))
  const { res } = await postJson(ctx, { text: 'hi' })

  assert.equal(res.status, 500)
  const body = jsonOf(res)
  assert.equal(body.ok, false)
  assert.equal(body.error, 'inject_failed')
  assert.ok(body.message.includes('inbox closed'))
  assert.equal(agent.calls.length, 1)
})

// ---------------------------------------------------------------------------
// 5) meta 与路由接线
// ---------------------------------------------------------------------------

const metaSource = routesSource.slice(routesSource.indexOf('function metaHandler'))

test('P1 meta 暴露 injectUrl，路由以 exact token 方式指向导出的 injectHandler', () => {
  assert.ok(metaSource.includes('injectUrl: `${INJECT_ROUTE}/${TOKEN}`,'), 'metaHandler 必须下发 injectUrl')
  assert.ok(constantsSource.includes('const INJECT_ROUTE = `${API}/inject`'))
  assert.ok(constantsSource.includes('const MAX_INJECT_BODY = 16 * 1024'))
  assert.ok(constantsSource.includes('const MAX_INJECT_TEXT = 4000'))
  assert.ok(injectSource.includes('export async function injectHandler(ctx, req, res) {'))
  assert.ok(injectSource.includes('ctx.get(\'agents\') ?? ctx.agents'))
  assert.ok(
    routesSource.includes("register('exact', `${INJECT_ROUTE}/${TOKEN}`, (req, res) => injectHandler(ctx, req, res))"),
    '注入路由必须精确注册并把 ctx 传给 handler',
  )
})

test('P1 token 安全：injectUrl/INJECT_ROUTE 不出现在工具结果渲染函数与工具定义里', () => {
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
    assert.doesNotMatch(body, /\bTOKEN\b|injectUrl|INJECT_ROUTE/, `${name} 的结果文本不得携带注入路由或 token`)
  }

  const toolSource = [
    readHostModule('tools/scene.js'),
    readHostModule('tools/capture.js'),
    readHostModule('tools/draw.js'),
    readHostModule('tools/measure.js'),
    readHostModule('tools/analyze.js'),
    readHostModule('tools/shader.js'),
  ].join('\n')
  assert.doesNotMatch(toolSource, /injectUrl|INJECT_ROUTE|\bTOKEN\b/)
})

// ---------------------------------------------------------------------------
// 6) 客户端接线：locale、askAgent、工具栏按钮
// ---------------------------------------------------------------------------

const localeLines = clientSource.split('\n')
const zhLine = localeLines.indexOf('      zh: {')
const enLine = localeLines.indexOf('      en: {')
const fallbackAboutLine = localeLines.indexOf('    const FALLBACK_ABOUT = {')
const zhMessages = localeLines.slice(zhLine, enLine).join('\n')
const enMessages = localeLines.slice(enLine, fallbackAboutLine).join('\n')

/** 取某语言块里 `'key': 'value'` 的 value（模板不参与）。 */
function localeValue(table, key) {
  const match = new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'([^']*)'`).exec(table)
  return match === null ? null : match[1]
}

test('P1 中文与英文词典都包含 Ask Agent 按钮与三个 toast 文案', () => {
  assert.ok(zhLine !== -1, 'client.js 应内联中文词典')
  assert.ok(enLine > zhLine, 'client.js 应内联英文词典')
  assert.ok(fallbackAboutLine > enLine)

  const keys = ['btn.askAgent', 'toast.askAgentSent', 'toast.askAgentFailed', 'toast.askAgentNoSession']
  for (const key of keys) {
    const zh = localeValue(zhMessages, key)
    const en = localeValue(enMessages, key)
    assert.ok(zh !== null && zh !== '', `中文词典缺少 ${key}`)
    assert.ok(en !== null && en !== '', `英文词典缺少 ${key}`)
    assert.match(zh, /[\u4e00-\u9fff]/, `${key} 的中文文案不应是英文回退`)
    assert.match(en, /^[\x20-\x7e]*$/, `${key} 的英文文案不应含中文`)
  }
  // toast.askAgentFailed 必须保留 {message} 占位符，客户端要传错误原因。
  assert.ok(localeValue(zhMessages, 'toast.askAgentFailed').includes('{message}'))
  assert.ok(localeValue(enMessages, 'toast.askAgentFailed').includes('{message}'))
})

const askAgentSource = sourceSlice(clientSource, 'async function askAgent', 'function setLayerVisible')

test('P1 askAgent 走 meta.injectUrl，POST {session,text}，并区分成功/失败 toast', () => {
  assert.ok(askAgentSource.includes('const meta = metaRef.current'))
  assert.ok(askAgentSource.includes('const session = sessionRef.current'))
  assert.ok(askAgentSource.includes('if (!meta?.injectUrl || typeof session !== \'string\' || session === \'\') {'))
  assert.ok(askAgentSource.includes("showToast(t('toast.askAgentNoSession'))"))
  assert.ok(askAgentSource.includes('fetch(meta.injectUrl, {'))
  assert.ok(askAgentSource.includes("method: 'POST',"))
  assert.ok(askAgentSource.includes('body: JSON.stringify({ session, text: lines.join(\'\\n\') })'))
  assert.ok(askAgentSource.includes("showToast(t('toast.askAgentSent'))"))
  assert.ok(askAgentSource.includes("showToast(t('toast.askAgentFailed', { message: message(error) }))"))
  // 宿主契约：handler 读 payload.session / payload.text。
  assert.ok(askAgentSource.includes('{ session, text: lines.join'))
  // 先拍图、再取场景状态、最后 POST：顺序错了摘要就会缺数据。
  const captureAt = askAgentSource.indexOf('const saved = await captureScene({}, session)')
  const statusAt = askAgentSource.indexOf('status = await collectSceneStatus()')
  const fetchAt = askAgentSource.indexOf('fetch(meta.injectUrl')
  assert.ok(captureAt !== -1 && statusAt !== -1 && fetchAt !== -1)
  assert.ok(captureAt < statusAt && statusAt < fetchAt)
})

test('P1 askAgent 汇总相机/图层/叠加层、profile/flood/sunlight 分析、着色器与截图路径', () => {
  // 截图作为上下文交给 Agent，失败不阻断文字摘要。
  assert.ok(askAgentSource.includes('const saved = await captureScene({}, session)'))
  assert.ok(askAgentSource.includes("snapshotPath = typeof saved.path === 'string' ? saved.path : ''"))
  assert.ok(askAgentSource.includes("lines.push(`Snapshot: ${snapshotPath}`)"))

  // 相机与图层摘要来自 collectSceneStatus。
  assert.ok(askAgentSource.includes('status = await collectSceneStatus()'))
  assert.ok(askAgentSource.includes('[Digital Earth scene context]'))
  assert.ok(askAgentSource.includes('`Camera: lon=${view.lon}'))
  assert.ok(askAgentSource.includes('`Layers: ${layerText}.`'))
  assert.ok(askAgentSource.includes('`Imagery: ${status.imagery?.name'))
  assert.ok(askAgentSource.includes('Agent overlays:'))

  // 三种分析分支各自成段。
  assert.ok(askAgentSource.includes("result.operation === 'profile'"))
  assert.ok(askAgentSource.includes("result.operation === 'flood'"))
  assert.ok(askAgentSource.includes("result.operation === 'sunlight'"))
  assert.ok(askAgentSource.includes('Analysis (profile):'))
  assert.ok(askAgentSource.includes('Analysis (flood):'))
  assert.ok(askAgentSource.includes('Analysis (sunlight):'))

  // 活动着色器预设。
  assert.ok(askAgentSource.includes('const shaders = shaderActiveList()'))
  assert.ok(askAgentSource.includes('Shaders:'))
})

test('P1 工具栏仅在存在会话时渲染 Ask Agent 按钮，且依赖的采集/状态/分析函数都在', () => {
  assert.ok(clientSource.includes("sessionId ? button(t('btn.askAgent'), askAgent) : null"))
  // askAgent 依赖的三个基础设施仍然存在。
  assert.ok(clientSource.includes('async function captureScene(options = {}, session = null)'))
  assert.ok(clientSource.includes('async function collectSceneStatus()'))
  assert.ok(clientSource.includes('const shaderActiveList = () => {'))
  // analysis 状态由渲染层持有，askAgent 读的是同一份结果。
  assert.ok(clientSource.includes('const [analysis, setAnalysis] = React.useState(null)'))
  assert.ok(askAgentSource.includes('if (analysis !== null && analysis.result) {'))
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
