/**
 * v1.7.0 — host-side orthophoto instance segmentation.
 *
 * Pins the instance protocol ported from the standalone
 * `llm_instance_segmentation` project: the `{"o":[[classId,[[x,y],...]],...]}`
 * answer envelope with integer 0..1000 coordinates, the class table validator
 * (1..8 classes, de-fanged name/definition), the `/vision-instances/<TOKEN>`
 * request validator, the single-concurrency handler, and its route + meta entry.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import {
  INSTANCE_SYSTEM,
  instanceUserText,
  normalizeInstanceClasses,
  parseInstanceAnswer,
} from '../src/host/vision/instances.js'
import { createVisionInstancesHandler, validateVisionInstancesRequest } from '../src/host/vision/handler.js'
import { createOpenAiCompatBackend } from '../src/host/vision/backends/openai-compat.js'
import { registerRoutes } from '../src/host/routes.js'

const CLASSES = [
  { id: 1, name: '水体', definition: '独立水面或塘口，含堤埂内水域' },
  { id: 2, name: '运动场', definition: '跑道含场芯的整体外轮廓' },
]

function pngDataUrl(width = 64, height = 64) {
  const data = Buffer.alloc(33)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(data)
  data.write('IHDR', 12)
  data.writeUInt32BE(width, 16)
  data.writeUInt32BE(height, 20)
  return `data:image/png;base64,${data.toString('base64')}`
}

function payload(overrides = {}) {
  return {
    image: pngDataUrl(),
    classes: CLASSES,
    mode: 'polygon',
    ...overrides,
  }
}

function answer(rows) {
  return JSON.stringify({ o: rows })
}

function request({ method = 'POST', body = payload(), headers = {}, raw } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.headers = { host: 'localhost:3000', 'sec-fetch-site': 'same-origin', 'x-dsh-panel': 'vision-instances', ...headers }
  req[Symbol.asyncIterator] = async function* () {
    if (method === 'POST') yield Buffer.from(raw ?? JSON.stringify(body))
  }
  return req
}

function response() {
  return Object.assign(new EventEmitter(), {
    writableEnded: false,
    destroyed: false,
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

test('实例解析：合法 {"o":[...]} 返回 classId 与整数多边形，并跳过 think/代码围栏', () => {
  const text = '<think>先看水体和跑道</think>\n```json\n' + answer([
    [1, [[100, 200], [300, 200], [300, 400], [100, 400]]],
    [2, [[500, 500], [700, 550], [650, 700], [480, 650]]],
  ]) + '\n```'
  const instances = parseInstanceAnswer(text, CLASSES)
  assert.equal(instances.length, 2)
  assert.deepEqual(instances[0], { classId: 1, polygon: [[100, 200], [300, 200], [300, 400], [100, 400]] })
  assert.equal(instances[1].classId, 2)
  for (const point of instances[1].polygon) {
    assert.ok(Number.isInteger(point[0]) && Number.isInteger(point[1]))
  }
})

test('实例解析：空结果 {"o":[]} 是合法的“本块无匹配”', () => {
  assert.deepEqual(parseInstanceAnswer('{"o":[]}', CLASSES), [])
})

test('实例解析：坏 JSON 或缺少 o 数组都返回 invalid_result', () => {
  for (const text of ['not json at all', '{"instances":[]}', '{"o":"nope"}', '[1,2,3]', '']) {
    assert.throws(() => parseInstanceAnswer(text, CLASSES), { code: 'invalid_result' }, text)
  }
})

test('实例解析：非法 classId、越界/小数坐标、错误行形状都返回 invalid_result', () => {
  const cases = [
    answer([[9, [[0, 0], [100, 0], [100, 100]]]]), // unknown classId
    answer([['1', [[0, 0], [100, 0], [100, 100]]]]), // string classId
    answer([[1, [[0, 0], [100, 0], [0, 1001]]]]), // y out of range
    answer([[1, [[-1, 0], [100, 0], [0, 100]]]]), // x negative
    answer([[1, [[0, 0], [100.5, 0], [0, 100]]]]), // fractional
    answer([[1, [[0, 0], [100, 0]]]]), // too few vertices
    answer([[1]]), // not a [classId, polygon] pair
    answer([[1, [[0, 0], [10, 0], [0, 10]], 9]]), // extra row element
  ]
  for (const text of cases) {
    assert.throws(() => parseInstanceAnswer(text, CLASSES), { code: 'invalid_result' }, text)
  }
})

test('实例解析：退化多边形与超过 64 个顶点返回 invalid_result', () => {
  const collinear = answer([[1, [[0, 0], [100, 0], [200, 0]]]])
  assert.throws(() => parseInstanceAnswer(collinear, CLASSES), { code: 'invalid_result' })
  const collapsed = answer([[1, [[10, 10], [10, 10], [10, 10]]]])
  assert.throws(() => parseInstanceAnswer(collapsed, CLASSES), { code: 'invalid_result' })
  const circle = Array.from({ length: 65 }, (_, index) => [
    Math.round(500 + 200 * Math.cos((index / 65) * Math.PI * 2)),
    Math.round(500 + 200 * Math.sin((index / 65) * Math.PI * 2)),
  ])
  assert.throws(() => parseInstanceAnswer(answer([[1, circle]]), CLASSES), { code: 'invalid_result' })
  // A closed ring (last vertex repeats the first) is accepted once de-duplicated.
  const closed = parseInstanceAnswer(answer([[1, [[0, 0], [100, 0], [100, 100], [0, 0]]]]), CLASSES)
  assert.equal(closed[0].polygon.length, 3)
})

test('实例提示词：要求分割全部实例、相邻分开、只描可见轮廓、拒绝轴对齐框、0..1000 整数坐标', () => {
  assert.match(INSTANCE_SYSTEM, /segment all matching instances/i)
  assert.match(INSTANCE_SYSTEM, /adjacent instances separately/i)
  assert.match(INSTANCE_SYSTEM, /visible exterior outline/i)
  assert.match(INSTANCE_SYSTEM, /axis-aligned 4-point bounding box is invalid/i)
  assert.match(INSTANCE_SYSTEM, /integers in 0\.\.1000/)
  assert.match(INSTANCE_SYSTEM, /JSON/i)
  const userText = instanceUserText({ width: 640, height: 480, classes: CLASSES })
  assert.match(userText, /640 x 480/)
  for (const item of CLASSES) {
    assert.ok(userText.includes(String(item.id)), `class id ${item.id}`)
    assert.ok(userText.includes(item.name), `class name ${item.name}`)
    assert.ok(userText.includes(item.definition), `class definition ${item.definition}`)
  }
  assert.match(userText, /0\.\.1000/)
})

test('类别规范化：清洗控制字符/引号/反引号并折叠空白，按 id 去重', () => {
  const { classes } = normalizeInstanceClasses([
    { id: 1, name: '  水\u0000体" 塘 ', definition: '独立水面`或塘口\n含堤埂内水域' },
    { id: 1, name: '水体副本', definition: '重复 id 应被忽略' },
    { id: 2, name: "运动场'", definition: '跑道含场芯的整体外轮廓' },
  ])
  assert.equal(classes.length, 2)
  assert.deepEqual(classes[0], { id: 1, name: '水 体 塘', definition: '独立水面或塘口 含堤埂内水域' })
  assert.equal(classes[1].name, '运动场')
})

test('类别规范化：对象入参保留并夹紧 maxTokens', () => {
  assert.deepEqual(normalizeInstanceClasses(CLASSES), { classes: CLASSES.map((item) => ({ ...item })) })
  assert.equal(normalizeInstanceClasses({ classes: CLASSES, maxTokens: 1600 }).maxTokens, 1600)
  assert.equal(normalizeInstanceClasses({ classes: CLASSES, maxTokens: 999999 }).maxTokens, 8192)
  assert.equal(normalizeInstanceClasses({ classes: CLASSES, maxTokens: 10 }).maxTokens, 256)
  assert.throws(() => normalizeInstanceClasses({ classes: CLASSES, maxTokens: 'many' }), { code: 'invalid_request' })
})

test('类别规范化：空表、超过 12 类、超长名称/定义、非法 id 抛 invalid_request', () => {
  const invalid = [
    [],
    Array.from({ length: 13 }, (_, index) => ({ id: index + 1, name: `类${index + 1}`, definition: '定义' })),
    [{ id: 0, name: '水体', definition: '定义' }],
    [{ id: 1.5, name: '水体', definition: '定义' }],
    [{ id: '1', name: '水体', definition: '定义' }],
    [{ id: 1, name: '', definition: '定义' }],
    [{ id: 1, name: '水'.repeat(17), definition: '定义' }],
    [{ id: 1, name: '水体', definition: '' }],
    [{ id: 1, name: '水体', definition: '定'.repeat(121) }],
    [null],
  ]
  for (const input of invalid) {
    assert.throws(() => normalizeInstanceClasses(input), { code: 'invalid_request' }, JSON.stringify(input))
  }
})

test('请求校验：接受合法 body，补全默认 polygon 模式并保留图片尺寸', () => {
  const input = validateVisionInstancesRequest(payload({ mode: undefined, frameId: 'ignored', force: true }))
  assert.equal(input.mediaType, 'image/png')
  assert.equal(input.width, 64)
  assert.equal(input.height, 64)
  assert.equal(input.mode, 'polygon')
  assert.equal(input.force, true)
  assert.deepEqual(input.classes, CLASSES)
  assert.ok(Buffer.isBuffer(input.data))
  assert.equal(validateVisionInstancesRequest(payload({ maxTokens: 1200 })).maxTokens, 1200)
})

test('请求校验：错误 mode、坏图片、非法类别都返回 invalid_request', () => {
  const cases = [
    payload({ mode: 'seeds' }),
    payload({ image: 'data:image/svg+xml;base64,PHN2Zy8+' }),
    payload({ image: pngDataUrl(16, 16) }),
    payload({ classes: [] }),
    payload({ classes: [{ id: 1, name: '水'.repeat(20), definition: '定义' }] }),
    null,
  ]
  for (const body of cases) {
    assert.throws(() => validateVisionInstancesRequest(body), { code: 'invalid_request' }, JSON.stringify(body))
  }
})

test('实例处理器：校验面板头，串接后端 extractInstances 且响应不带 frameId', async () => {
  const calls = []
  const fakeBackend = {
    id: 'fake',
    async extractInstances(input, signal, options) {
      calls.push({ input, hasSignal: Boolean(signal), options })
      return {
        instances: [{ classId: 1, polygon: [[10, 10], [100, 10], [100, 100]] }],
        usage: null,
        finish: 'stop',
        backend: 'fake',
        provider: 'fake-provider',
        model: 'fake-model',
        capability: 'supported',
      }
    },
  }
  const options = {
    backends: { resolve: () => fakeBackend },
    loadConfig: async () => ({}),
  }
  const res = await invoke(createVisionInstancesHandler({}, options))
  assert.equal(res.status, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.instances, [{ classId: 1, polygon: [[10, 10], [100, 10], [100, 100]] }])
  assert.equal(body.model, 'fake-model')
  assert.equal(body.finish, 'stop')
  assert.equal(Object.hasOwn(body, 'frameId'), false)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].input.mode, 'polygon')
  assert.equal(calls[0].hasSignal, true)

  const forbidden = await invoke(createVisionInstancesHandler({}, options), {
    headers: { 'x-dsh-panel': 'vision' },
  })
  assert.equal(forbidden.status, 403)
})

test('实例处理器：默认 dsh-llm 后端把类别写进用户文本并解析 0..1000 多边形', async () => {
  const calls = { saves: [], streams: [] }
  const attachment = { attachmentId: 'instance-image', width: 64, height: 64, mediaType: 'image/png' }
  const services = {
    agentDefaultModel: { currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }) },
    attachments: { saveImage: async (input) => { calls.saves.push(input); return attachment } },
    llm: {
      resolveModelInfo: async () => ({ inputModalities: ['text', 'image'], reasoning: { efforts: [{ id: 'high' }, { id: 'off' }] } }),
      stream(options) {
        calls.streams.push(options)
        return (async function* () {
          yield { type: 'text-delta', index: 0, text: '```json\n' }
          yield { type: 'text-delta', index: 0, text: answer([[1, [[20, 30], [400, 30], [400, 300], [20, 300]]]]) }
          yield { type: 'text-delta', index: 0, text: '\n```' }
          yield { type: 'finish', reason: { kind: 'stop' } }
        })()
      },
    },
  }
  const ctx = { get: (name) => services[name] }
  const res = await invoke(createVisionInstancesHandler(ctx))
  assert.equal(res.status, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.backend, 'dsh-llm')
  assert.equal(body.provider, 'test-provider')
  assert.equal(body.model, 'test-model')
  assert.equal(body.finish, 'stop')
  assert.equal(body.usage, null)
  assert.deepEqual(body.instances, [{ classId: 1, polygon: [[20, 30], [400, 30], [400, 300], [20, 300]] }])
  assert.equal(calls.saves.length, 1)
  assert.equal(calls.streams.length, 1)
  const streamOptions = calls.streams[0]
  assert.equal(streamOptions.system, INSTANCE_SYSTEM)
  assert.equal(streamOptions.maxTokens, 1600)
  const userText = streamOptions.messages[0].content[0].text
  assert.ok(userText.includes('水体'))
  assert.ok(userText.includes('独立水面或塘口，含堤埂内水域'))
  assert.equal(streamOptions.messages[0].content[1].attachment, attachment)
})

test('openai-compat 后端：extractInstances 走 chat completions 并按实例协议解析', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) })
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ choices: [{ message: { content: answer([[2, [[10, 10], [100, 10], [100, 100]]]]) }, finish_reason: 'stop' }] })
      },
    }
  }
  const backend = createOpenAiCompatBackend({
    config: { openaiCompat: { baseUrl: 'http://vision.example/v1', model: 'vlm-test' } },
    fetchImpl,
  })
  const signal = new AbortController().signal
  const result = await backend.extractInstances(
    { data: Buffer.from('fake-jpeg'), mediaType: 'image/jpeg', width: 64, height: 64, classes: CLASSES },
    signal,
  )
  assert.equal(result.backend, 'openai-compat')
  assert.equal(result.model, 'vlm-test')
  assert.equal(result.finish, 'stop')
  assert.deepEqual(result.instances, [{ classId: 2, polygon: [[10, 10], [100, 10], [100, 100]] }])
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'http://vision.example/v1/chat/completions')
  assert.equal(requests[0].body.messages[0].content, INSTANCE_SYSTEM)
  assert.ok(requests[0].body.messages[1].content[0].text.includes('水体'))
  assert.equal(requests[0].body.max_tokens, 4096)
})

test('实例路由：注册 /vision-instances、meta 公布地址，且旧 /vision 与 /vision-batch 仍在', async () => {
  const registered = []
  const ctx = {
    webServer: { register(route) { registered.push(route); return () => {} } },
    effect: (callback) => callback(),
  }
  registerRoutes(ctx, {
    allowedDirs: new Set(),
    bridge: { dispose() {} },
    directories: { list: () => [], rememberScannedDirectory() {} },
  })
  const instances = registered.filter((entry) => entry.path.includes('/vision-instances/'))
  assert.equal(instances.length, 1)
  assert.equal(instances[0].kind, 'exact')
  assert.match(instances[0].path, /\/vision-instances\/[a-zA-Z0-9_-]+$/)
  assert.equal(registered.filter((entry) => entry.path.includes('/vision-batch/')).length, 1)
  assert.equal(registered.filter((entry) => /\/vision\//.test(entry.path)).length, 1)

  const meta = response()
  const metaRoute = registered.find((entry) => entry.path.endsWith('/meta'))
  await metaRoute.handler(request({ method: 'GET' }), meta)
  assert.equal(meta.json().visionInstancesUrl, instances[0].path)
  assert.equal(meta.json().visionBatchUrl.includes('/vision-batch/'), true)
})

test('DSH 默认视觉传输支持定位及四图描边，并按图号还原局部坐标', async () => {
  let next, request
  const attachment = { attachmentId: 'qa', width: 64, height: 64, mediaType: 'image/png' }
  const services = {
    agentDefaultModel: { currentSelection: () => ({provider:'provider-qa',model:'model-qa'}) },
    attachments: {saveImage: async () => attachment},
    llm: {
      resolveModelInfo: async () => ({inputModalities:['image','text']}),
      async *stream(opts) {
        request = opts
        yield {type:'text-delta',index:0,text:JSON.stringify(next)}
        yield {type:'finish',reason:{kind:'stop'}}
      },
    },
  }
  const handler=createVisionInstancesHandler({get:key=>services[key]}, {loadConfig:async()=>({mode:'dsh-default'})})
  next=[{label:'水体',bbox_2d:[120,180,360,400]}]
  const locate=await invoke(handler,{body:payload({mode:'locate'})})
  assert.equal(locate.status,200)
  assert.deepEqual(locate.json().boxes,[{classId:1,box:[120,180,360,400]}])
  assert.equal(request.messages[0].content[0].attachment,attachment)
  next={slots:[{slot:1,polygon:null},{slot:2,polygon:[[560,100],[800,120],[700,400]]}]}
  const batch=await invoke(handler,{body:payload({mode:'trace_batch',slots:[1,2]})})
  assert.equal(batch.status,200)
  assert.deepEqual(batch.json().instances,[{slot:2,classId:2,polygon:[[120,200],[600,240],[400,800]]}])
})

test('the host reports measured tokens for an unparsable external response', async () => {
  const config={mode:'openai-compat',openaiCompat:{baseUrl:'https://example.test/v1',model:'test'}}
  const handler=createVisionInstancesHandler({},{
    loadConfig:async()=>config,
    fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'length',message:{content:'['}}],usage:{total_tokens:119}})}),
  })
  const r=await invoke(handler,{body:payload({mode:'locate',namedLabels:true})})
  assert.equal(r.json().ok,false)
  assert.equal(r.json().code,'invalid_result')
  assert.deepEqual(r.json().usage,{total_tokens:119})
})
