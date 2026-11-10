import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createVisionHandler, validateVisionRequest } from '../src/host/vision.js'
import { registerRoutes } from '../src/host/routes.js'

const outline = { polygon: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]] }
const finish = { type: 'finish', reason: { kind: 'stop' } }
const tick = () => new Promise((resolve) => setImmediate(resolve))

function payload(overrides = {}) {
  const data = Buffer.alloc(33)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(data)
  data.write('IHDR', 12)
  data.writeUInt32BE(640, 16)
  data.writeUInt32BE(480, 20)
  return { frameId: 'frame-test', point: [0.5, 0.5], image: `data:image/png;base64,${data.toString('base64')}`, ...overrides }
}

function context({ modalities = ['text', 'image'], chunks, stream } = {}) {
  const calls = { saves: [], streams: [] }
  const attachment = { attachmentId: 'test-image', width: 640, height: 480, mediaType: 'image/png' }
  const services = {
    agentDefaultModel: { currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }) },
    attachments: { saveImage: async (input) => { calls.saves.push(input); return attachment } },
    llm: {
      resolveModelInfo: async () => ({ inputModalities: modalities, reasoning: { efforts: [{ id: 'high' }, { id: 'low' }, { id: 'off' }] } }),
      stream(options) {
        calls.streams.push(options)
        if (stream) return stream(options)
        return (async function* () { yield* chunks ?? [{ type: 'text-delta', index: 0, text: JSON.stringify(outline) }, finish] })()
      },
    },
  }
  return { get: (name) => services[name], calls, services, attachment }
}

function request({ method = 'POST', body = payload(), headers = {}, raw } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.headers = { host: 'localhost:3000', 'sec-fetch-site': 'same-origin', 'x-dsh-panel': 'vision', ...headers }
  req[Symbol.asyncIterator] = async function* () { if (method === 'POST') yield Buffer.from(raw ?? JSON.stringify(body)) }
  return req
}

function response() {
  return Object.assign(new EventEmitter(), {
    writableEnded: false, destroyed: false,
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body) { this.body = body; this.writableEnded = true },
    json() { return JSON.parse(this.body) },
  })
}

async function invoke(handler, options) {
  const req = request(options), res = response()
  await handler(req, res)
  assert.equal(req.listenerCount('aborted'), 0)
  assert.equal(res.listenerCount('close'), 0)
  return res
}

test('视觉直连：一次图片调用，无 tools/历史；完整文本块不重复拼接', async () => {
  const ctx = context({ chunks: [
    { type: 'reasoning-delta', index: 0, text: 'ignored reasoning' },
    { type: 'text-delta', index: 1, text: '{"poly' },
    { type: 'block-end', index: 1, block: { type: 'text', text: JSON.stringify(outline) } }, finish,
  ] })
  const res = await invoke(createVisionHandler(ctx))
  assert.equal(res.status, 200)
  assert.deepEqual(res.json().polygon, outline.polygon)
  assert.equal(res.json().frameId, 'frame-test')
  assert.equal(res.json().approximate, true)
  assert.equal(ctx.calls.saves.length, 1)
  assert.equal(ctx.calls.streams.length, 1)
  const options = ctx.calls.streams[0]
  assert.equal(options.messages.length, 1)
  assert.equal(options.messages[0].content[1].attachment, ctx.attachment)
  assert.equal(options.messages[0].content[1].type, 'image')
  assert.equal(options.reasoningEffort, 'off')
  assert.equal(options.maxTokens, 1200)
  assert.equal(options.tools, undefined)
  assert.equal(typeof options.system, 'string')
})

test('视觉能力探测不存图、不产生模型调用；不支持/未知能力直接拒绝', async () => {
  const ctx = context()
  assert.equal((await invoke(createVisionHandler(ctx), { method: 'GET' })).status, 200)
  assert.deepEqual(ctx.calls, { saves: [], streams: [] })
  for (const [modalities, code] of [[['text'], 'model_not_visual'], [null, 'model_unknown']]) {
    const unavailable = context({ modalities })
    const res = await invoke(createVisionHandler(unavailable))
    assert.equal(res.json().code, code)
    assert.equal(res.json().next, 'change_model')
    assert.deepEqual(unavailable.calls, { saves: [], streams: [] })
  }
  const res = await invoke(createVisionHandler({ get() { throw new Error('missing') } }))
  assert.equal(res.status, 503)
  assert.equal(res.json().next, 'manual')
})

test('视觉输入：大小、图片格式、坐标、帧号和请求头均有边界', async () => {
  for (const overrides of [{ point: [2, 0] }, { point: ['0.5', 0.5] }, { frameId: '../x' }, { image: 'data:image/svg+xml;base64,PHN2Zy8+' }, { image: 'data:image/png;base64,abc=' }]) {
    assert.throws(() => validateVisionRequest(payload(overrides)), { code: 'invalid_request' })
  }
  const input = validateVisionRequest(payload())
  input.data.writeUInt32BE(2000, 16)
  assert.throws(() => validateVisionRequest(payload({ image: `data:image/png;base64,${input.data.toString('base64')}` })), { code: 'invalid_request' })
  const ctx = context(), handler = createVisionHandler(ctx)
  assert.equal((await invoke(handler, { raw: '{bad' })).status, 400)
  assert.equal((await invoke(handler, { raw: 'x'.repeat(2_200_001) })).status, 413)
  assert.equal((await invoke(handler, { headers: { 'x-dsh-panel': '' } })).status, 403)
  assert.equal((await invoke(handler, { method: 'DELETE' })).status, 405)
  assert.equal(ctx.calls.streams.length, 0)
})

test('视觉结果：拒绝工具、坏 JSON、自交、偏离点击及不完整输出；不重试', async () => {
  const cases = [
    [[{ type: 'tool-call-delta', text: 'shell' }], 'invalid_result'],
    [[{ type: 'block-end', block: { type: 'tool-call' } }], 'invalid_result'],
    [[{ type: 'text-delta', text: 'not json' }, finish], 'invalid_result'],
    [[{ type: 'text-delta', text: '{"polygon":null}' }, finish], 'no_target'],
    [[{ type: 'text-delta', text: JSON.stringify({ polygon: [[0.2, 0.2], [0.8, 0.8], [0.8, 0.2], [0.2, 0.8]] }) }, finish], 'invalid_result'],
    [[{ type: 'text-delta', text: '{"bbox":[0,0,0.1,0.1]}' }, finish], 'invalid_result'],
    [[{ type: 'text-delta', text: JSON.stringify(outline) }], 'model_failed'],
    [[{ type: 'finish', reason: { kind: 'max-tokens' } }], 'model_failed'],
  ]
  for (const [chunks, code] of cases) {
    const ctx = context({ chunks })
    const res = await invoke(createVisionHandler(ctx))
    assert.equal(res.json().code, code)
    assert.equal(ctx.calls.streams.length, 1)
  }
})

test('视觉超时/取消：中断信号到达模型，不重试，连接事件被清理', async () => {
  for (const cancel of [false, true]) {
    const ctx = context({ stream: () => (async function* () { await new Promise(() => {}) })() })
    const handler = createVisionHandler(ctx, { timeoutMs: 30 })
    const req = request(), res = response()
    const pending = handler(req, res)
    await tick()
    if (cancel) { res.destroyed = true; res.emit('close') }
    await pending
    assert.equal(ctx.calls.streams.length, 1)
    assert.equal(ctx.calls.streams[0].signal.aborted, true)
    assert.equal(req.listenerCount('aborted'), 0)
    assert.equal(res.listenerCount('close'), 0)
    if (!cancel) { assert.equal(res.status, 504); assert.equal(res.json().code, 'timeout') }
    else assert.equal(res.body, undefined)
  }
})

test('视觉并发：模型忽略取消时仍占槽位，避免重复点击无限调用', async () => {
  const ctx = context({ stream: () => (async function* () { await new Promise(() => {}) })() })
  const handler = createVisionHandler(ctx, { timeoutMs: 30 })
  const first = invoke(handler), second = invoke(handler)
  await tick()
  assert.equal((await invoke(handler)).json().code, 'busy')
  await Promise.all([first, second])
  assert.equal((await invoke(handler)).json().code, 'busy')
  assert.equal(ctx.calls.streams.length, 2)
})

test('视觉附件：尺寸缺失或比例变化时不发送给模型；输出总长度受限', async () => {
  for (const dimensions of [{ width: undefined }, { height: 0 }, { width: 320 }]) {
    const ctx = context()
    Object.assign(ctx.attachment, dimensions)
    const res = await invoke(createVisionHandler(ctx))
    assert.equal(res.json().code, 'model_failed')
    assert.equal(ctx.calls.streams.length, 0)
  }
  const ctx = context({ chunks: [
    { type: 'block-end', index: 0, block: { type: 'text', text: 'x'.repeat(5000) } },
    { type: 'block-end', index: 1, block: { type: 'text', text: 'x'.repeat(5000) } }, finish,
  ] })
  assert.equal((await invoke(createVisionHandler(ctx))).json().code, 'invalid_result')
})

test('视觉路由：独立 token 地址复用身份和同源校验，meta 只对面板公布入口', async () => {
  const registered = []
  const ctx = context()
  ctx.webServer = { register(route) { registered.push(route); return () => {} } }
  ctx.effect = (callback) => callback()
  registerRoutes(ctx, { allowedDirs: new Set(), bridge: { dispose() {} }, directories: { list: () => [], rememberScannedDirectory() {} } })
  const route = registered.find((entry) => entry.path.includes('/vision/'))
  assert.equal(route.kind, 'exact')
  assert.match(route.path, /\/vision\/[a-zA-Z0-9_-]+$/)
  assert.equal(registered.filter((entry) => entry.path.includes('/vision/')).length, 1)
  const req = request({ method: 'GET', headers: { origin: 'https://foreign.example' } }), res = response()
  await route.handler(req, res)
  assert.equal(res.status, 403)
  const accepted = response()
  await route.handler(request({ method: 'GET' }), accepted)
  assert.equal(accepted.status, 200)
  const meta = response()
  await registered.find((entry) => entry.path.endsWith('/meta')).handler(request({ method: 'GET' }), meta)
  assert.equal(meta.json().visionUrl, route.path)
  assert.equal(ctx.calls.streams.length, 0)
})
