/**
 * v1.6 Batch 11 — F3 host half: POST /export/vector writes one .geojson, and
 * POST /export/vector/chat also hands the same bytes to the conversation as a
 * real `{ type: 'file' }` attachment (F3 real-attachment upgrade).
 *
 * Same test seam as the evidence pack (test/v17-export.test.mjs): DSH_HOME is
 * redirected before index.js is imported because EXPORTS_DIR is module-level.
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync, readdirSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hostSource } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readSource = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n')
const constantsSource = readSource('src/host/constants.js')
const routesSource = readSource('src/host/routes.js')
const indexSource = readSource('index.js')
const toolSource = readdirSync(join(root, 'src/host/tools'))
  .filter((name) => name.endsWith('.js'))
  .map((name) => readSource(`src/host/tools/${name}`))
  .join('\n')

const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-v16-vector-'))
process.env.DSH_HOME = home
const host = await import(new URL('../index.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

const exportsDir = join(home, 'digital-earth', 'exports')

function fakeRequest({ method = 'POST', chunks = [] } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.headers = { host: 'localhost:3000', 'sec-fetch-site': 'same-origin' }
  req.destroy = () => {}
  req[Symbol.asyncIterator] = async function* iterate() {
    for (const chunk of chunks) yield chunk
  }
  return req
}

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

async function callExport(body, options = {}) {
  const req = fakeRequest({ ...options, chunks: body === undefined ? [] : [JSON.stringify(body)] })
  const res = fakeResponse()
  await host.vectorExportHandler(req, res)
  return res
}

/** Minimal stand-in for the DSH services the chat route looks up. */
function fakeContext({ agent = null, saveFile = null } = {}) {
  const injected = []
  const fakeAgent = agent === null ? null : {
    inject(message) {
      if (agent === 'throw') throw new Error('agent closed')
      injected.push(message)
    },
  }
  const services = {
    agents: { get: (session) => (session === 'session-1' ? fakeAgent : null) },
    attachments: saveFile === null ? {} : { saveFile },
  }
  return {
    injected,
    ctx: { get: (name) => services[name] ?? null },
  }
}

async function callChat(body, context, options = {}) {
  const req = fakeRequest({ ...options, chunks: body === undefined ? [] : [JSON.stringify(body)] })
  const res = fakeResponse()
  await host.vectorChatHandler(context.ctx, req, res)
  return res
}

const chatFeature = () => feature('研究区', [[114.3, 30.5], [114.4, 30.6]])

const feature = (name, coordinates) => ({
  type: 'Feature',
  properties: { name },
  geometry: { type: 'LineString', coordinates },
})

async function exportNames() {
  try {
    return await readdir(exportsDir)
  } catch {
    return []
  }
}

test('vector export：200，绝对路径落在 exports，内容与计数/bbox 正确', async () => {
  assert.equal(typeof host.vectorExportHandler, 'function')
  const features = [feature('测线', [[114.3, 30.5], [114.4, 30.6]])]
  const res = await callExport({ kind: 'vector', name: ' 矢量叠加 ', features })
  assert.equal(res.status, 200)
  const ack = JSON.parse(res.body)
  assert.equal(isAbsolute(ack.path), true)
  assert.equal(dirname(ack.path), exportsDir)
  // A CJK-only label sanitizes to nothing; the content still keeps the name.
  assert.match(basename(ack.path), /^earth-vector-\d{8}-\d{6}-[0-9a-f]{8}(-[0-9A-Za-z_-]+)?\.geojson$/)
  assert.equal(ack.count, 1)
  assert.deepEqual(ack.bbox, { west: 114.3, south: 30.5, east: 114.4, north: 30.6 })
  const content = await readFile(ack.path, 'utf8')
  assert.deepEqual(JSON.parse(content), { type: 'FeatureCollection', name: '矢量叠加', features })
  assert.equal(content, JSON.stringify({ type: 'FeatureCollection', name: '矢量叠加', features }, null, 2))
  assert.equal(ack.bytes, Buffer.byteLength(content, 'utf8'))
  assert.equal((await stat(ack.path)).size, ack.bytes)
  assert.equal(res.body.includes('token'), false, '响应不得回显 token')
  assert.deepEqual((await exportNames()).filter((name) => name.endsWith('.tmp')), [], '不得残留 .tmp')
})

test('vector export：名字被清洗，不能逃出 exports 目录', async () => {
  const res = await callExport({ kind: 'vector', name: '../../evil name/*stars*', features: [feature('x', [[114.3, 30.5], [114.4, 30.6]])] })
  assert.equal(res.status, 200)
  const ack = JSON.parse(res.body)
  assert.equal(dirname(ack.path), exportsDir)
  assert.doesNotMatch(basename(ack.path), /[\\/]|\.\./)
  assert.match(basename(ack.path), /-evil-name-stars\.geojson$/)

  // A non-string name is ignored entirely; the envelope then has no name key.
  const unnamed = await callExport({ kind: 'vector', name: 42, features: [feature('y', [[114.3, 30.5], [114.4, 30.6]])] })
  assert.equal(unnamed.status, 200)
  assert.equal(Object.hasOwn(JSON.parse(await readFile(JSON.parse(unnamed.body).path, 'utf8')), 'name'), false)
})

test('vector export：方法、kind、空数组、非法要素与超限都返回明确状态码', async () => {
  const before = (await exportNames()).length
  assert.equal((await callExport({ kind: 'vector', features: [feature('a', [[114.3, 30.5], [114.4, 30.6]])] }, { method: 'GET' })).status, 405)
  assert.equal((await callExport({ kind: 'evidence', features: [] })).status, 400)
  assert.equal((await callExport({ kind: 'vector', features: [] })).body, 'empty vector layer')
  assert.equal((await callExport({ kind: 'vector', features: 'nope' })).status, 400)

  for (const bad of [
    { type: 'FeatureCollection', properties: {}, geometry: null },
    { geojson: {}, properties: {} },
    { type: 'Feature', properties: {}, geometry: { type: 'Circle', coordinates: [114.3, 30.5] } },
  ]) {
    const res = await callExport({ kind: 'vector', features: [bad] })
    assert.equal(res.status, 400, JSON.stringify(bad))
    assert.equal(res.body, 'invalid feature')
  }

  const many = await callExport({ kind: 'vector', features: new Array(501).fill(feature('m', [[114.3, 30.5], [114.4, 30.6]])) })
  assert.equal(many.status, 413)
  assert.equal(many.body, 'too many features')

  const dense = await callExport({
    kind: 'vector',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: new Array(20001).fill([114.3, 30.5]) } }],
  })
  assert.equal(dense.status, 413)
  assert.equal(dense.body, 'too many coordinates')
  assert.equal((await exportNames()).length, before, '被拒绝的请求不应写文件')
})

test('vector chat：写文件并以真文件附件注入对话，模型侧只拿到句柄文本', async () => {
  const saved = []
  const { ctx, injected } = fakeContext({
    agent: 'ok',
    saveFile: async (input) => {
      saved.push(input)
      return { name: input.name, bytes: input.data.length }
    },
  })
  const res = await callChat(
    { kind: 'vector', session: 'session-1', name: '研究区', features: [chatFeature()], text: '请以附件为准。' },
    { ctx, injected },
  )
  assert.equal(res.status, 200)
  const receipt = JSON.parse(res.body)
  assert.equal(receipt.ok, true)
  assert.equal(receipt.injected, true)
  assert.equal(receipt.attached, true)
  assert.equal(receipt.count, 1)
  assert.equal(dirname(receipt.path), exportsDir)
  assert.equal(receipt.attachment.name, basename(receipt.path))
  assert.equal(injected.length, 1)
  const message = injected[0]
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'digital-earth')
  assert.equal(typeof message.id, 'string')
  assert.equal(message.content.length, 2)
  assert.equal(message.content[0].type, 'text')
  assert.ok(message.content[0].text.includes('请以附件为准。'))
  assert.ok(message.content[0].text.includes(basename(receipt.path)))
  assert.ok(message.content[0].text.includes(receipt.path))
  assert.deepEqual(message.content[1], { type: 'file', attachment: { name: receipt.attachment.name, bytes: receipt.attachment.bytes } })
  // saveFile gets the exact bytes that landed on disk.
  const content = await readFile(receipt.path, 'utf8')
  assert.equal(saved.length, 1)
  assert.equal(saved[0].name, basename(receipt.path))
  assert.equal(Buffer.compare(saved[0].data, Buffer.from(content, 'utf8')), 0)
})

test('vector chat：附件存储不可用时降级为路径通知，文件仍然落盘', async () => {
  const { ctx, injected } = fakeContext({
    agent: 'ok',
    saveFile: async () => {
      throw new Error('provider has no verbatim storage')
    },
  })
  const res = await callChat({ kind: 'vector', session: 'session-1', features: [chatFeature()] }, { ctx, injected })
  assert.equal(res.status, 200)
  const receipt = JSON.parse(res.body)
  assert.equal(receipt.injected, true)
  assert.equal(receipt.attached, false)
  assert.equal(receipt.reason, 'attachment_unavailable')
  assert.equal((await stat(receipt.path)).isFile(), true)
  assert.equal(injected[0].content.length, 1)
  assert.equal(injected[0].content[0].type, 'text')
  assert.ok(injected[0].content[0].text.includes('File: '))
})

test('vector chat：没有 agent 时只报告 agent_not_running，文件仍然可用', async () => {
  const { ctx, injected } = fakeContext({ agent: null })
  const res = await callChat({ kind: 'vector', session: 'session-1', features: [chatFeature()] }, { ctx, injected })
  assert.equal(res.status, 200)
  const receipt = JSON.parse(res.body)
  assert.equal(receipt.injected, false)
  assert.equal(receipt.attached, false)
  assert.equal(receipt.reason, 'agent_not_running')
  assert.equal((await stat(receipt.path)).isFile(), true)
  assert.equal(injected.length, 0)

  // A closed agent is a normal outcome too: the file exists, the notice did not.
  const throwing = fakeContext({ agent: 'throw', saveFile: async (input) => ({ name: input.name, bytes: input.data.length }) })
  const failed = await callChat({ kind: 'vector', session: 'session-1', features: [chatFeature()] }, throwing)
  assert.equal(failed.status, 200)
  const lost = JSON.parse(failed.body)
  assert.equal(lost.injected, false)
  assert.equal(lost.reason, 'inject_failed')
  assert.equal((await stat(lost.path)).isFile(), true)
})

test('vector chat：会话缺失/非法与要素非法时拒绝且不写文件', async () => {
  const before = (await exportNames()).length
  for (const session of [undefined, '', 'has space', 42]) {
    const { ctx, injected } = fakeContext({ agent: 'ok' })
    const res = await callChat({ kind: 'vector', session, features: [chatFeature()] }, { ctx, injected })
    assert.equal(res.status, 400, String(session))
    assert.equal(res.body, 'missing or invalid session')
    assert.equal(injected.length, 0)
  }
  const { ctx, injected } = fakeContext({ agent: 'ok' })
  const bad = await callChat({ kind: 'vector', session: 'session-1', features: [] }, { ctx, injected })
  assert.equal(bad.status, 400)
  assert.equal(bad.body, 'empty vector layer')
  assert.equal((await exportNames()).length, before, '被拒绝的请求不应写文件')
})

test('vector export：路由/常量/meta/index 接线正确，且工具源码不知道这条路由', () => {
  assert.ok(constantsSource.includes('export const EXPORT_VECTOR_ROUTE = `${API}/export/vector`'))
  assert.ok(routesSource.includes("register('exact', `${EXPORT_VECTOR_ROUTE}/${TOKEN}`, vectorExportHandler)"))
  assert.ok(routesSource.includes('exportVectorUrl: `${EXPORT_VECTOR_ROUTE}/${TOKEN}`'))
  assert.ok(indexSource.includes('vectorExportHandler'))
  assert.doesNotMatch(routesSource, /register\('prefix', EXPORT_VECTOR_ROUTE/, '矢量导出不得注册为无 token 前缀路由')
  assert.doesNotMatch(toolSource, /exportVectorUrl|EXPORT_VECTOR_ROUTE|earth-vector/, '工具源码不得引用页面专用导出路由或文件名')
  assert.ok(readSource('src/host/export.js').includes('earth-vector-'))
  // Chat route: same token discipline, a one-shot export+attach endpoint.
  assert.ok(constantsSource.includes('export const EXPORT_VECTOR_CHAT_ROUTE = `${API}/export/vector/chat`'))
  assert.ok(routesSource.includes("register('exact', `${EXPORT_VECTOR_CHAT_ROUTE}/${TOKEN}`"))
  assert.ok(routesSource.includes('exportVectorChatUrl: `${EXPORT_VECTOR_CHAT_ROUTE}/${TOKEN}`'))
  assert.ok(indexSource.includes('vectorChatHandler'))
  assert.doesNotMatch(routesSource, /register\('prefix', EXPORT_VECTOR_CHAT_ROUTE/, '附件导出不得注册为无 token 前缀路由')
  assert.doesNotMatch(toolSource, /exportVectorChatUrl|EXPORT_VECTOR_CHAT_ROUTE/, '工具源码不得引用页面专用附件路由')
})
