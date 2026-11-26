/**
 * Cross-model compatibility & modular vision refactor test suite:
 *   - Third-party / supercomputing DeepSeek / MiMo 2.6 Flash capability & stream quirks
 *   - <think> tag stripping, balanced-brace JSON scanning, 0..1000 coordinate disambiguation
 *   - Douglas-Peucker simplification (>32 vertices), box_2d support, slight out-of-bounds clamp
 *   - Post-finish usage chunk tolerance, thinking-model maxTokens elevation, HTTP 400 param retry
 *   - Standalone OpenAI-compatible HTTP backend & vision.json config persistence/redaction
 *   - Lease-based concurrency slot recovery after orphaned timeout
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import {
  extractVisionJson,
  parseVisionBatchOutput,
  parseVisionOutput,
  stripReasoningTags,
  validateVisionPolygon,
} from '../src/client/scene/vision-geometry.js'
import {
  clearProbeCache,
  createVisionBatchHandler,
  createVisionConfigHandler,
  createVisionHandler,
  defaultVisionConfig,
  normalizeVisionConfig,
  readVisionConfig,
  redactVisionConfig,
  writeVisionConfig,
} from '../src/host/vision.js'

const tempDir = await mkdtemp(join(tmpdir(), 'dsh-vision-compat-'))
const configFile = join(tempDir, 'vision.json')

after(async () => {
  clearProbeCache()
  await rm(tempDir, { recursive: true, force: true })
})

const SQUARE = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]
const FINISH = { type: 'finish', reason: { kind: 'stop' } }

function pngPayload(width = 384, height = 384, overrides = {}) {
  const data = Buffer.alloc(33)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(data)
  data.write('IHDR', 12)
  data.writeUInt32BE(width, 16)
  data.writeUInt32BE(height, 20)
  return { frameId: 'frame-compat', point: [0.5, 0.5], image: `data:image/png;base64,${data.toString('base64')}`, ...overrides }
}

function makeReq({ method = 'POST', url = '/api/3dviewer/vision/t', body = pngPayload(), headers = {} } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: 'localhost:3000', 'sec-fetch-site': 'same-origin', 'x-dsh-panel': 'vision', ...headers }
  req[Symbol.asyncIterator] = async function* () {
    if (method === 'POST' || method === 'PUT') yield Buffer.from(JSON.stringify(body))
  }
  return req
}

function makeRes() {
  return Object.assign(new EventEmitter(), {
    writableEnded: false,
    destroyed: false,
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body) { this.body = body; this.writableEnded = true },
    json() { return JSON.parse(this.body) },
  })
}

async function callHandler(handler, opts) {
  const req = makeReq(opts)
  const res = makeRes()
  await handler(req, res)
  return res
}

function fakeCtx({
  provider = 'scnet-deepseek',
  model = 'deepseek-vl-thinking',
  resolveModelInfo = async () => null,
  streamImpl,
  width = 384,
  height = 384,
} = {}) {
  const streams = []
  const services = {
    agentDefaultModel: { currentSelection: async () => ({ provider, model }) },
    attachments: { saveImage: async () => ({ attachmentId: 'img-1', width, height, mediaType: 'image/png' }) },
    llm: {
      resolveModelInfo,
      stream(opts) {
        streams.push(opts)
        return streamImpl(opts, streams.length)
      },
    },
  }
  return { get: (name) => services[name], streams }
}

// ---------------------------------------------------------------------------
// 1. Geometry & JSON resilience (MiMo / Supercomputing / Thinking VLMs)
// ---------------------------------------------------------------------------

test('解析容错：剥离 <think> 块（含示例大括号）并提取最后一个有效 JSON 轮廓', () => {
  const raw = [
    '<think>用户需要返回 {"polygon": [[x, y], ...]} 这种格式，我先看红十字中心位置大概在 [0.5, 0.5] 附近的教学楼屋顶...</think>',
    '以下是检测到的目标轮廓：',
    '```json',
    JSON.stringify({ polygon: SQUARE }),
    '```',
  ].join('\n')
  assert.ok(!stripReasoningTags(raw).includes('教学楼'))
  assert.deepEqual(extractVisionJson(raw).polygon, SQUARE)
  const parsed = parseVisionOutput(raw, [0.5, 0.5], { width: 384, height: 384 })
  assert.deepEqual(parsed.polygon, SQUARE)
})

test('多坐标系自适应：MiMo/Qwen 0..1000 坐标系在 384x384 与 768x768 裁剪图下均正确归一', () => {
  // 384x384 crop: coordinates up to 780 exceed pixel width -> unambiguously 0..1000
  const mimoSmall = parseVisionOutput(
    JSON.stringify({ polygon: [[220, 240], [780, 240], [780, 760], [220, 760]] }),
    [0.5, 0.5],
    { width: 384, height: 384 },
  )
  assert.equal(mimoSmall.coordSpace, 'thousand')
  assert.deepEqual(mimoSmall.polygon[0], [0.22, 0.24])

  // 768x768 crop: click at [0.25, 0.25], model outputs 0..1000 box [150..350]
  // Under pixel (div 768): [0.195..0.456] (center ~0.325)
  // Under 1000 (div 1000): [0.15..0.35] (center 0.25 -> exact click match!)
  const mimoAmbiguous = parseVisionOutput(
    JSON.stringify({ polygon: [[150, 150], [350, 150], [350, 350], [150, 350]] }),
    [0.25, 0.25],
    { width: 768, height: 768 },
  )
  assert.equal(mimoAmbiguous.coordSpace, 'thousand')
  assert.deepEqual(mimoAmbiguous.polygon[0], [0.15, 0.15])

  // Gemini / MiMo box_2d: [ymin, xmin, ymax, xmax] in 0..1000
  const box2d = validateVisionPolygon({ box_2d: [200, 300, 700, 800] }, [0.55, 0.45], { width: 400, height: 400 })
  assert.equal(box2d.shape, 'box')
  assert.equal(box2d.coordSpace, 'thousand')
  assert.deepEqual(box2d.polygon, [[0.3, 0.2], [0.8, 0.2], [0.8, 0.7], [0.3, 0.7]])
})

test('几何温和修复：超过 32 顶点的精细多边形自动 DP 抽稀，微小越界自动 clamp', () => {
  // Generate 48-vertex circle around (0.5, 0.5)
  const ring48 = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2
    return [0.5 + Math.cos(a) * 0.25, 0.5 + Math.sin(a) * 0.25]
  })
  const simplified = validateVisionPolygon({ polygon: ring48 }, [0.5, 0.5])
  assert.ok(simplified.polygon.length >= 3 && simplified.polygon.length <= 32)
  assert.equal(simplified.repaired, true)

  // Slight overshoot [-0.01, 1.01] clamped to [0, 1]
  const clamped = validateVisionPolygon(
    { polygon: [[-0.01, 0.2], [0.7, 0.2], [0.7, 0.8], [-0.01, 0.8]] },
    [0.35, 0.5],
  )
  assert.equal(clamped.polygon[0][0], 0)
  assert.equal(clamped.repaired, true)
})

test('批量解析兼容：支持 <think> 标签、全批次一致的 0..1000 坐标与 detections 别名', () => {
  const raw = [
    '<think>检查图中 {"objects": []} 建筑</think>',
    JSON.stringify({
      detections: [
        { class: 'building', confidence: 0.9, polygon: [[100, 100], [400, 100], [400, 400], [100, 400]] },
        { class: 'road', confidence: 0.8, polygon: [[600, 600], [900, 600], [900, 850], [600, 850]] },
      ],
    }),
  ].join('\n')
  const parsed = parseVisionBatchOutput(raw, { width: 512, height: 512 })
  assert.equal(parsed.objects.length, 2)
  assert.equal(parsed.objects[0].class, 'building')
  // Both top-left (<=512) and bottom-right (>512) objects share the batch-inferred 0..1000 scale!
  assert.deepEqual(parsed.objects[0].polygon[0], [0.1, 0.1])
  assert.deepEqual(parsed.objects[1].polygon[0], [0.6, 0.6])
})

// ---------------------------------------------------------------------------
// 2. DSH LLM stream compatibility (supercomputing DeepSeek / MiMo / thinking)
// ---------------------------------------------------------------------------

test('超算/第三方模型：无 inputModalities 元数据、思考模型高配额、finish 后带 usage 尾包均正常走通', async () => {
  clearProbeCache()
  const ctx = fakeCtx({
    provider: 'scnet-deepseek',
    model: 'deepseek-vl-thinking',
    resolveModelInfo: async () => { throw new Error('unknown custom provider') },
    streamImpl: async function* () {
      yield { type: 'reasoning-delta', index: 0, text: 'thinking... '.repeat(200) }
      yield { type: 'text-delta', index: 1, text: `<think>draft {"polygon":[]}</think>{"polygon":[[200,200],[800,200],[800,800],[200,800]]}` }
      yield { type: 'finish', reason: { kind: 'end_turn' } }
      // Trailing usage chunk emitted by many OpenAI-compatible proxies after finish
      yield { type: 'usage', usage: { inputTokens: 1000, outputTokens: 200 } }
    },
  })
  const handler = createVisionHandler(ctx, { loadConfig: async () => defaultVisionConfig() })
  const res = await callHandler(handler)
  assert.equal(res.status, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.coordSpace, 'thousand')
  assert.deepEqual(body.polygon, SQUARE)
  assert.equal(ctx.streams.length, 1)
  // Thinking/unknown models automatically get higher maxTokens budget (4096 instead of 1200)
  assert.equal(ctx.streams[0].maxTokens, 4096)
})

test('参数降级重试：网关返回 HTTP 400 拒绝 temperature 时剥离可选参数重试一次并成功', async () => {
  clearProbeCache()
  const ctx = fakeCtx({
    provider: 'mimo-relay',
    model: 'mimo-2.6-flash',
    resolveModelInfo: async () => ({ inputModalities: ['text', 'image'] }),
    streamImpl: (opts, callNo) => (async function* () {
      if (callNo === 1 && opts.temperature !== undefined) {
        const err = new Error('Unsupported parameter: temperature is not supported by this model')
        err.status = 400
        throw err
      }
      yield { type: 'text-delta', index: 0, text: JSON.stringify({ polygon: SQUARE }) }
      yield FINISH
    })(),
  })
  const handler = createVisionHandler(ctx, { loadConfig: async () => defaultVisionConfig() })
  const res = await callHandler(handler)
  assert.equal(res.status, 200)
  assert.equal(ctx.streams.length, 2)
  assert.equal(ctx.streams[1].temperature, undefined)
})

test('强制试探与失败缓存：静态标为 text 时可用 force=true 试探，底层确认不支持后缓存拦截', async () => {
  clearProbeCache()
  const ctx = fakeCtx({
    provider: 'custom-prov',
    model: 'mimo-2.6-flash',
    resolveModelInfo: async () => ({ inputModalities: ['text'] }),
    streamImpl: () => (async function* () {
      yield { type: 'text-delta', index: 0, text: JSON.stringify({ polygon: SQUARE }) }
      yield FINISH
    })(),
  })
  const handler = createVisionHandler(ctx, { loadConfig: async () => defaultVisionConfig() })
  const blocked = await callHandler(handler)
  assert.equal(blocked.status, 422)
  assert.equal(blocked.json().code, 'model_not_visual')
  assert.equal(blocked.json().diagnostic.canForce, true)

  // User clicks "Try anyway" -> force: true succeeds!
  const forced = await callHandler(handler, { body: pngPayload(384, 384, { force: true }) })
  assert.equal(forced.status, 200)
  assert.deepEqual(forced.json().polygon, SQUARE)

  // Now simulate a model that truly rejects images downstream -> cached as model_not_visual
  const textOnlyCtx = fakeCtx({
    provider: 'scnet',
    model: 'deepseek-text-only',
    resolveModelInfo: async () => null,
    streamImpl: () => (async function* () {
      throw new Error('MODEL_DOES_NOT_SUPPORT_IMAGES: image_url is not supported')
    })(),
  })
  const h2 = createVisionHandler(textOnlyCtx, { loadConfig: async () => defaultVisionConfig() })
  const firstFail = await callHandler(h2)
  assert.equal(firstFail.json().code, 'model_not_visual')
  assert.equal(textOnlyCtx.streams.length, 1)
  // Second attempt without force hits probe cache without spending another request
  const cachedFail = await callHandler(h2)
  assert.equal(cachedFail.json().code, 'model_not_visual')
  assert.equal(textOnlyCtx.streams.length, 1)
})

// ---------------------------------------------------------------------------
// 3. Standalone OpenAI-compatible backend & config persistence/redaction
// ---------------------------------------------------------------------------

test('独立 OpenAI 兼容视觉后端：直连超算/MiMo 接口，密钥持久化脱敏回显，不触碰 DSH llm', async () => {
  const saved = await writeVisionConfig({
    mode: 'openai-compat',
    openaiCompat: {
      baseUrl: 'https://scnet.example.test/v1/',
      apiKey: 'sk-super-secret-123456',
      model: 'mimo-2.6-flash',
      coordSpace: 'thousand',
    },
  }, configFile)
  assert.equal(saved.openaiCompat.baseUrl, 'https://scnet.example.test/v1')
  const redacted = redactVisionConfig(await readVisionConfig(configFile))
  assert.equal(redacted.openaiCompat.hasApiKey, true)
  assert.equal(redacted.openaiCompat.apiKey, undefined)
  assert.ok(!JSON.stringify(redacted).includes('sk-super-secret-123456'))

  // Updating config without apiKey preserves existing secret
  const updated = normalizeVisionConfig({
    mode: 'openai-compat',
    openaiCompat: { baseUrl: 'https://scnet.example.test/v1', model: 'deepseek-vl-2', apiKey: '' },
  }, saved)
  assert.equal(updated.openaiCompat.apiKey, 'sk-super-secret-123456')

  // Execute single + batch through OpenAI-compatible HTTP endpoint
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) })
    const isBatch = JSON.parse(init.body).messages[0].content.includes('remote-sensing')
    const content = isBatch
      ? JSON.stringify({ objects: [{ class: 'building', confidence: 0.85, polygon: [[100, 100], [500, 100], [500, 500], [100, 500]] }] })
      : JSON.stringify({ polygon: [[200, 200], [800, 200], [800, 800], [200, 800]] })
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }),
    }
  }
  const emptyCtx = { get: () => null }
  const singleHandler = createVisionHandler(emptyCtx, { loadConfig: () => readVisionConfig(configFile), fetchImpl })
  const resSingle = await callHandler(singleHandler)
  assert.equal(resSingle.status, 200)
  assert.equal(resSingle.json().backend, 'openai-compat')
  assert.deepEqual(resSingle.json().polygon, SQUARE)
  assert.equal(requests[0].url, 'https://scnet.example.test/v1/chat/completions')
  assert.equal(requests[0].headers.authorization, 'Bearer sk-super-secret-123456')

  const batchHandler = createVisionBatchHandler(emptyCtx, { loadConfig: () => readVisionConfig(configFile), fetchImpl })
  const resBatch = await callHandler(batchHandler, {
    headers: { 'x-dsh-panel': 'vision-batch' },
    body: { frameId: 'b1', image: pngPayload(512, 512).image },
  })
  assert.equal(resBatch.status, 200)
  assert.equal(resBatch.json().objects.length, 1)

  // Config HTTP route GET / PUT redacts secrets
  const cfgHandler = createVisionConfigHandler(emptyCtx, {
    loadConfig: () => readVisionConfig(configFile),
    saveConfig: (c) => writeVisionConfig(c, configFile),
    fetchImpl,
  })
  const getRes = await callHandler(cfgHandler, { method: 'GET' })
  assert.equal(getRes.status, 200)
  assert.equal(getRes.json().config.openaiCompat.hasApiKey, true)
  assert.ok(!getRes.body.includes('sk-super-secret-123456'))
})

// ---------------------------------------------------------------------------
// 4. Lease-based concurrency recovery (no permanent busy lock after timeout)
// ---------------------------------------------------------------------------

test('并发防泄漏：超时且下游流忽略中止信号时，超过宽限期后槽位自动回收不再永久 busy', async () => {
  clearProbeCache()
  let callIndex = 0
  const ctx = fakeCtx({
    provider: 'slow-gw',
    model: 'slow-vl',
    resolveModelInfo: async () => ({ inputModalities: ['text', 'image'] }),
    streamImpl: () => {
      callIndex += 1
      if (callIndex === 1) return (async function* () { await new Promise(() => {}) })()
      return (async function* () {
        yield { type: 'text-delta', index: 0, text: JSON.stringify({ polygon: SQUARE }) }
        yield FINISH
      })()
    },
  })
  const handler = createVisionHandler(ctx, {
    maxConcurrent: 1,
    timeoutMs: 25,
    orphanGraceMs: 40,
    loadConfig: async () => defaultVisionConfig(),
  })
  const first = await callHandler(handler)
  assert.equal(first.status, 504)
  assert.equal(first.json().code, 'timeout')
  // During grace window, slot is still held
  const duringGrace = await callHandler(handler)
  assert.equal(duringGrace.json().code, 'busy')
  // After orphanGraceMs, slot recovers and next call succeeds
  await new Promise((r) => setTimeout(r, 60))
  const recovered = await callHandler(handler)
  assert.equal(recovered.status, 200)
  assert.deepEqual(recovered.json().polygon, SQUARE)
})
