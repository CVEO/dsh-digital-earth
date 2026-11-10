import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createSelectionQuestionHandler } from '../src/host/selection-question.js'
import { registerRoutes } from '../src/host/routes.js'

function image() {
  const data = Buffer.alloc(33)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(data)
  data.write('IHDR', 12)
  data.writeUInt32BE(640, 16)
  data.writeUInt32BE(480, 20)
  return `data:image/png;base64,${data.toString('base64')}`
}

const payload = (overrides = {}) => ({ session: 'session-test', requestId: 'question-test', text: 'What is inside this selection?', image: image(), ...overrides })
function request(body = payload(), headers = {}) {
  return { method: 'POST', headers: { 'x-dsh-panel': 'selection-question', ...headers },
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)) } }
}
function response() {
  return Object.assign(new EventEmitter(), { writeHead(status) { this.status = status }, end(body) { this.body = body }, json() { return JSON.parse(this.body) } })
}
async function invoke(handler, body, headers) {
  const res = response()
  await handler(request(body, headers), res)
  return res
}

test('选区提问：走公开 prompt 并排队，图片按原生 PromptContentPart 提交，不使用 inject', async () => {
  const calls = []
  const handler = createSelectionQuestionHandler({ get: (name) => name === 'sessionController' ? {
    async prompt(value, signal) { calls.push(value); assert.equal(signal.aborted, false); return { accepted: true } },
  } : undefined })
  const result = await invoke(handler)
  assert.equal(result.status, 200)
  assert.equal(result.json().accepted, true)
  assert.equal(result.json().image, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].sessionId, 'session-test')
  assert.equal(calls[0].mode, 'queue')
  assert.equal(calls[0].requestId, 'digital-earth-question-test')
  assert.equal(calls[0].content[0].type, 'text')
  assert.equal(calls[0].content[1].type, 'image')
  assert.equal(calls[0].content[1].mediaType, 'image/png')
  assert.equal(calls[0].content[1].data, image().split(',')[1])
  assert.equal(calls[0].content[1].attachment, undefined)
})

test('选区提问：并发重复点击与已接收后的重试只提交一次，更改内容必须换请求', async () => {
  let calls = 0, accept
  const handler = createSelectionQuestionHandler({ sessionController: { prompt() { calls++; return new Promise((resolve) => { accept = resolve }) } } })
  const first = invoke(handler), second = invoke(handler)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls, 1)
  accept({ accepted: true })
  assert.equal((await first).status, 200)
  assert.equal((await second).status, 200)
  assert.equal((await invoke(handler)).status, 200)
  assert.equal(calls, 1)
  assert.equal((await invoke(handler, payload({ text: 'different' }))).json().code, 'request_conflict')
  assert.equal(calls, 1)
})

test('选区提问：模型拒绝图片时明确失败，用户选择纯文字后才重新提交', async () => {
  let calls = 0
  const handler = createSelectionQuestionHandler({ sessionController: { async prompt(value) {
    calls++
    if (value.content.some((part) => part.type === 'image')) throw new Error('Model does not support image input. MODEL_DOES_NOT_SUPPORT_IMAGES')
    return { accepted: true }
  } } })
  const failed = await invoke(handler)
  assert.equal(failed.status, 409)
  assert.equal(failed.json().code, 'model_not_visual')
  assert.equal(failed.json().next, 'change_model_or_text')
  assert.equal(calls, 1)
  const textOnly = await invoke(handler, payload({ image: undefined }))
  assert.equal(textOnly.json().image, false)
  assert.equal(calls, 2)
})

test('选区提问：未知宿主诚实降级，坏图片、超长上下文和非面板请求不进入 Agent', async () => {
  const unavailable = await invoke(createSelectionQuestionHandler({}))
  assert.equal(unavailable.status, 503)
  assert.equal(unavailable.json().next, 'copy_to_chat')
  let calls = 0
  const handler = createSelectionQuestionHandler({ sessionController: { prompt() { calls++; return { accepted: true } } } })
  for (const body of [payload({ image: 'data:image/png;base64,AAAA' }), payload({ text: 'a'.repeat(16001) }), payload({ session: '' }), payload({ requestId: '../question' })]) {
    assert.equal((await invoke(handler, body)).status, 400)
  }
  assert.equal((await invoke(handler, payload(), { 'x-dsh-panel': '' })).status, 403)
  assert.equal(calls, 0)
})

test('选区提问：路由仍受同源、连接与 token 路径保护', async () => {
  const routes = []
  const ctx = { webServer: { register(route) { routes.push(route) } }, effect(callback) { callback() },
    get(name) { return name === 'connection' ? { requestRejection: () => 401 } : undefined } }
  registerRoutes(ctx, { allowedDirs: new Set(), bridge: {}, directories: {} })
  const route = routes.find((item) => item.path.includes('/selection-question/'))
  assert.ok(route)
  assert.equal(route.kind, 'exact')
  assert.ok(route.path.split('/').at(-1).length > 10)
  const denied = response()
  await route.handler(request(payload(), { 'sec-fetch-site': 'cross-site' }), denied)
  assert.equal(denied.status, 403)
  const unauthorized = response()
  await route.handler(request(), unauthorized)
  assert.equal(unauthorized.status, 401)
})
