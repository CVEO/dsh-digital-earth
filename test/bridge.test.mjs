/**
 * Agent bridge contract tests (SSE command channel + screenshot receipt).
 *
 * The Host half is exercised end-to-end against a real `node:http` server, so
 * SSE framing, the receipt route and the capture files are the real artifacts.
 * A fake Cordis context only supplies the services `index.js` reads.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { apply } from '../index.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))

/** A real 1x1 PNG; its length is what byte-for-byte assertions compare against. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64')

const SCENE_SNAPSHOT = {
  ready: true,
  camera: { lon: 114.36082, lat: 30.54012, height: 812, heading: 23.1, pitch: -35 },
  layers: [{ id: 'layer-1', name: 'building', visible: true, tiles: 12, pending: 0, triangles: 340000 }],
  basemap: { id: 'esri-world-imagery', name: 'Esri World Imagery' },
  terrain: null,
  measure: { tool: null, points: 0 },
  uiBusy: false,
}

// ---------------------------------------------------------------------------
// Fake host: services, routes, server, SSE client
// ---------------------------------------------------------------------------

async function startBridge(t) {
  const routes = []
  const tools = []
  const sections = []
  const disposers = []
  const tempRoot = await mkdtemp(join(tmpdir(), 'dsh-earth-bridge-'))
  const workspace = join(tempRoot, 'workspace')
  await mkdir(workspace, { recursive: true })

  const services = {
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    connection: { requestRejection: () => undefined },
    tools: {
      register(definition) {
        tools.push(definition)
        return () => {}
      },
    },
    systemPrompt: {
      section(section) {
        sections.push(section)
        return () => {}
      },
    },
    workingDirectory: { ensure: async () => workspace },
    logger: { warn() {} },
  }

  const ctx = {
    effect(fn) {
      const dispose = fn()
      disposers.push(dispose)
      return dispose
    },
    get(name) {
      return services[name]
    },
    webServer: services.webServer,
    connection: services.connection,
    logger: services.logger,
  }

  apply(ctx)

  const server = createServer((req, res) => {
    let pathname = '/'
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    } catch {
      pathname = '/'
    }
    const route = routes.find((candidate) =>
      candidate.kind === 'exact' ? pathname === candidate.path : pathname === candidate.path || pathname.startsWith(`${candidate.path}/`),
    )
    if (route === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    Promise.resolve()
      .then(() => route.handler(req, res))
      .catch((error) => {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end(String(error))
      })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  const metaResponse = await fetch(`${base}/api/3dviewer/meta`)
  const meta = await metaResponse.json()

  const clients = new Set()
  t.after(async () => {
    for (const client of clients) client.close()
    clients.clear()
    await new Promise((resolve) => {
      server.closeAllConnections?.()
      server.close(() => resolve())
    })
    for (const dispose of disposers) {
      try {
        dispose?.()
      } catch {
        // Best effort during teardown.
      }
    }
    await rm(tempRoot, { recursive: true, force: true })
  })

  const sessionSignal = new AbortController()
  return {
    ctx,
    base,
    meta,
    routes,
    tools,
    sections,
    workspace,
    tempRoot,
    scene: () => tools.find((definition) => definition.name === 'earth_scene'),
    capture: () => tools.find((definition) => definition.name === 'earth_capture'),
    exec: (sessionId = 'session-a') => ({ agent: { id: sessionId }, signal: sessionSignal.signal }),
    result: (body) => postResult(base, meta.token, body),
    scan: (directory) =>
      fetch(`${base}/api/3dviewer/scan?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(directory)}`),
    async connect(options = {}) {
      const client = await connectEvents(base, meta.token, options)
      clients.add(client)
      return client
    },
  }
}

async function postResult(base, token, body) {
  const url = new URL('/api/3dviewer/result', base)
  url.searchParams.set('token', token)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: response.status, json, text }
}

/** Minimal SSE parser: frames are separated by a blank line. */
function parseFrame(frame) {
  let event = 'message'
  const data = []
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
  }
  if (data.length === 0) return null
  return { event, data: JSON.parse(data.join('\n')) }
}

function connectEvents(base, token, options = {}) {
  const url = new URL('/api/3dviewer/events', base)
  url.searchParams.set('token', token)
  if (options.session !== undefined) url.searchParams.set('session', options.session)
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { headers: { accept: 'text/event-stream' } }, (res) => {
      const client = {
        status: res.statusCode,
        headers: res.headers,
        frames: [],
        events: [],
        waiters: [],
        closeWaiters: [],
        closed: false,
        close() {
          req.destroy()
        },
        nextEvent(timeoutMs = 4000) {
          if (client.events.length > 0) return Promise.resolve(client.events.shift())
          if (client.closed) return Promise.reject(new Error('SSE stream already ended'))
          return new Promise((resolveEvent, rejectEvent) => {
            const waiter = {
              resolve: (event) => {
                clearTimeout(timer)
                resolveEvent(event)
              },
              reject: (error) => {
                clearTimeout(timer)
                rejectEvent(error)
              },
            }
            const timer = setTimeout(() => {
              const index = client.waiters.indexOf(waiter)
              if (index >= 0) client.waiters.splice(index, 1)
              rejectEvent(new Error('timed out waiting for an SSE event'))
            }, timeoutMs)
            client.waiters.push(waiter)
          })
        },
        async expectNoEvent(ms = 150) {
          await delay(ms)
          assert.equal(client.events.length, 0, `unexpected SSE event: ${JSON.stringify(client.events[0])}`)
        },
        waitForClose(timeoutMs = 3000) {
          if (client.closed) return Promise.resolve(true)
          return new Promise((resolveClose, rejectClose) => {
            const timer = setTimeout(() => rejectClose(new Error('SSE stream did not close')), timeoutMs)
            client.closeWaiters.push(() => {
              clearTimeout(timer)
              resolveClose(true)
            })
          })
        },
      }

      let buffer = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        buffer += chunk
        let index
        while ((index = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, index)
          buffer = buffer.slice(index + 2)
          if (frame === '') continue
          client.frames.push(frame)
          const event = parseFrame(frame)
          if (event !== null) {
            client.events.push(event)
            while (client.waiters.length > 0 && client.events.length > 0) {
              client.waiters.shift().resolve(client.events.shift())
            }
          }
        }
      })
      res.on('error', () => {
        client.closed = true
      })
      res.on('close', () => {
        client.closed = true
        for (const waiter of client.waiters.splice(0)) waiter.reject(new Error('SSE stream closed'))
        for (const closeWaiter of client.closeWaiters.splice(0)) closeWaiter()
      })
      resolve(client)
    })
    req.on('error', (error) => reject(error))
    req.end()
  })
}

/** Reject a promise after real milliseconds, even while global timers are mocked. */
function rejectAfter(promise, ms, message) {
  return Promise.race([
    promise,
    delay(ms).then(() => {
      throw new Error(message)
    }),
  ])
}

// ---------------------------------------------------------------------------
// §10.1 — meta
// ---------------------------------------------------------------------------

test('meta advertises the bridge endpoints and the package version', async (t) => {
  const env = await startBridge(t)
  assert.equal(typeof env.meta.token, 'string')
  assert.equal(env.meta.eventsUrl, '/api/3dviewer/events')
  assert.equal(env.meta.resultUrl, '/api/3dviewer/result')
  assert.equal(env.meta.version, pkg.version)
})

// ---------------------------------------------------------------------------
// §10.2 — SSE hello + command round-trip
// ---------------------------------------------------------------------------

test('SSE sends retry and hello with the required streaming headers', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  assert.equal(client.status, 200)
  assert.match(client.headers['content-type'], /text\/event-stream/)
  assert.equal(client.headers['cache-control'], 'no-store')
  assert.match(String(client.headers.connection), /keep-alive/i)
  assert.equal(client.headers['x-accel-buffering'], 'no')
  const hello = await client.nextEvent()
  assert.equal(hello.event, 'hello')
  assert.equal(typeof hello.data.panelId, 'string')
  assert.ok(hello.data.panelId.length > 0)
  assert.equal(hello.data.session, null)
  assert.ok(client.frames.some((frame) => frame === 'retry: 3000'))
})

test('earth_scene(status) round-trips through a command and its receipt', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent() // hello
  const pending = env.scene().execute({ action: 'status' }, env.exec())
  const command = await client.nextEvent()
  assert.equal(command.event, 'command')
  assert.match(command.data.id, /^c-/)
  assert.equal(command.data.action, 'status')
  assert.deepEqual(command.data.args, {})
  const receipt = await env.result({ id: command.data.id, ok: true, data: SCENE_SNAPSHOT })
  assert.equal(receipt.status, 200)
  assert.deepEqual(receipt.json, { accepted: true })
  const value = await pending
  assert.equal(value.ok, true)
  assert.deepEqual(value.camera, SCENE_SNAPSHOT.camera)
  assert.deepEqual(value.layers, SCENE_SNAPSHOT.layers)
  assert.equal(value.ready, true)
})

// ---------------------------------------------------------------------------
// §10.3 — capture file on disk
// ---------------------------------------------------------------------------

test('earth_capture writes the image bytes and a JSON sidecar', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  const pending = env.capture().execute({ width: 640, format: 'png' }, env.exec())
  const command = await client.nextEvent()
  assert.equal(command.data.action, 'capture')
  assert.deepEqual(command.data.args, { width: 640, format: 'png' })
  const receipt = await env.result({
    id: command.data.id,
    ok: true,
    data: {
      dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
      width: 640,
      height: 480,
      camera: SCENE_SNAPSHOT.camera,
      layers: SCENE_SNAPSHOT.layers,
    },
  })
  assert.equal(receipt.status, 200)
  const value = await pending
  assert.equal(value.ok, true)
  assert.equal(value.bytes, PNG_BYTES.length)
  assert.equal(value.width, 640)
  assert.equal(value.height, 480)
  assert.match(value.path, /\.dsh-earth[\\/]captures[\\/]\d{8}-\d{6}-[0-9a-f]{4}\.png$/)
  assert.ok(value.path.startsWith(join(env.workspace, '.dsh-earth', 'captures')))
  assert.deepEqual(await readFile(value.path), PNG_BYTES)
  const sidecar = JSON.parse(await readFile(value.sidecar, 'utf8'))
  assert.equal(sidecar.image.width, 640)
  assert.equal(sidecar.image.height, 480)
  assert.equal(sidecar.image.bytes, PNG_BYTES.length)
  assert.deepEqual(sidecar.camera, SCENE_SNAPSHOT.camera)
  assert.deepEqual(sidecar.layers, SCENE_SNAPSHOT.layers)
})

// ---------------------------------------------------------------------------
// §10.4 — no panel, timeout
// ---------------------------------------------------------------------------

test('earth_scene reports panel_not_open when no panel is connected', async (t) => {
  const env = await startBridge(t)
  const value = await env.scene().execute({ action: 'status' }, env.exec())
  assert.equal(value.ok, false)
  assert.equal(value.code, 'panel_not_open')
  assert.match(value.hint, /sidebar/i)
})

test('an unanswered command times out and leaves no pending receipt', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  t.mock.timers.enable({ apis: ['setTimeout'], now: 0 })
  try {
    const pending = env.scene().execute({ action: 'status' }, env.exec())
    const command = await rejectAfter(client.nextEvent(), 2000, 'no command frame was sent')
    assert.equal(command.data.action, 'status')
    t.mock.timers.tick(20_000)
    const value = await pending
    assert.equal(value.ok, false)
    assert.equal(value.code, 'timeout')
    // The receipt for the timed-out id must now be rejected as unknown.
    const receipt = await env.result({ id: command.data.id, ok: true, data: {} })
    assert.equal(receipt.status, 404)
  } finally {
    t.mock.timers.reset()
  }
})

// ---------------------------------------------------------------------------
// §10.5 — local path whitelist
// ---------------------------------------------------------------------------

test('load rejects a folder the user never opened and never sends a command', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  const outside = join(env.tempRoot, 'outside', 'tileset.json')
  const value = await env.scene().execute({ action: 'load', path: outside }, env.exec())
  assert.equal(value.ok, false)
  assert.equal(value.code, 'needs_user_directory')
  await client.expectNoEvent(150)
})

test('load forwards a path after /scan whitelists its folder', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  const folder = join(env.tempRoot, 'scene')
  const tilesetPath = join(folder, 'tileset.json')
  await mkdir(folder, { recursive: true })
  await writeFile(tilesetPath, '{"asset":{"version":"1.0"}}', 'utf8')
  const scan = await env.scan(folder)
  assert.equal(scan.status, 200)
  const pending = env.scene().execute({ action: 'load', path: tilesetPath }, env.exec())
  const command = await client.nextEvent()
  assert.equal(command.data.action, 'load')
  assert.equal(command.data.args.path, tilesetPath)
  await env.result({ id: command.data.id, ok: true, data: { layer: { id: 'layer-1', name: 'scene' }, count: 1 } })
  const value = await pending
  assert.equal(value.ok, true)
  assert.equal(value.count, 1)
  assert.equal(value.layer.id, 'layer-1')

  // A tiles URL the panel handed out (same-origin, token-scoped) needs no /scan entry.
  const panelUrl = `${env.meta.tilesBase}${encodeURIComponent('scene')}/tileset.json`
  const urlPending = env.scene().execute({ action: 'load', url: panelUrl, name: 'panel scene' }, env.exec())
  const urlCommand = await client.nextEvent()
  assert.equal(urlCommand.data.action, 'load')
  assert.equal(urlCommand.data.args.url, panelUrl)
  assert.equal(urlCommand.data.args.name, 'panel scene')
  await env.result({ id: urlCommand.data.id, ok: true, data: { layer: { id: 'layer-2' }, count: 1 } })
  assert.equal((await urlPending).ok, true)
})

// ---------------------------------------------------------------------------
// §10.6 — unknown receipt id, bad args
// ---------------------------------------------------------------------------

test('unknown receipt ids are rejected with 404', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  const receipt = await env.result({ id: 'c-does-not-exist', ok: true, data: {} })
  assert.equal(receipt.status, 404)
  assert.deepEqual(receipt.json, { accepted: false })
  const revoked = await postResult(env.base, 'wrong-token', { id: 'c-x', ok: true })
  assert.equal(revoked.status, 403)
})

test('invalid actions and arguments fail locally with bad_args', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  const invalid = [
    {},
    { action: 'explode' },
    { action: 'fly' },
    { action: 'fly', lon: 500, lat: 0 },
    { action: 'fly', lon: 114, lat: 0, duration: 60 },
    { action: 'remove' },
    { action: 'visible', id: 'layer-1' },
    { action: 'load' },
    { action: 'load', url: 'file:///tmp/tileset.json' },
  ]
  for (const args of invalid) {
    const value = await env.scene().execute(args, env.exec())
    assert.equal(value.ok, false, JSON.stringify(args))
    assert.equal(value.code, 'bad_args', JSON.stringify(args))
  }
  for (const args of [{ width: 100 }, { width: 1.5 }, { format: 'webp' }]) {
    const value = await env.capture().execute(args, env.exec())
    assert.equal(value.ok, false, JSON.stringify(args))
    assert.equal(value.code, 'bad_args', JSON.stringify(args))
  }
  await client.expectNoEvent(150)
})

// ---------------------------------------------------------------------------
// §10.7 — tool schemas + prompt section
// ---------------------------------------------------------------------------

const SCHEMA_KEYWORDS = new Set([
  'type',
  'oneOf',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
  'description',
  'title',
  'default',
  'examples',
])

function walkSchema(node, path) {
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) walkSchema(item, `${path}[${index}]`)
    return
  }
  if (node === null || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    assert.ok(SCHEMA_KEYWORDS.has(key), `unsupported schema keyword ${key} at ${path}`)
    if (key === 'properties') {
      for (const [name, child] of Object.entries(value)) walkSchema(child, `${path}.properties.${name}`)
    } else if (key === 'items' || key === 'oneOf') {
      walkSchema(value, `${path}.${key}`)
    }
  }
}

test('tools declare valid model-facing schemas and render JSON text', async (t) => {
  const env = await startBridge(t)
  assert.equal(env.tools.length, 2)
  const scene = env.scene()
  assert.equal(scene.name, 'earth_scene')
  assert.ok(scene.description.length > 0 && scene.description.length <= 400)
  assert.equal(scene.parameters.type, 'object')
  assert.equal(scene.parameters.additionalProperties, false)
  assert.deepEqual(scene.parameters.required, ['action'])
  assert.deepEqual(scene.parameters.properties.action.enum, [
    'status',
    'load',
    'remove',
    'visible',
    'basemap',
    'terrain',
    'fly',
    'reset',
    'pick',
  ])
  assert.equal(scene.timeoutMs, 20000)
  assert.equal(scene.output.schema.type, 'object')
  assert.ok(scene.output.schema.required.includes('ok'))
  walkSchema(scene.parameters, 'earth_scene.parameters')
  walkSchema(scene.output.schema, 'earth_scene.output')

  const capture = env.capture()
  assert.equal(capture.name, 'earth_capture')
  assert.equal(capture.parameters.properties.width.type, 'integer')
  assert.deepEqual(capture.parameters.properties.format.enum, ['png', 'jpeg'])
  assert.equal(capture.timeoutMs, 30000)
  walkSchema(capture.parameters, 'earth_capture.parameters')
  walkSchema(capture.output.schema, 'earth_capture.output')

  assert.deepEqual(scene.output.render({ action: 'status' }, { ok: true }), [
    { type: 'text', text: JSON.stringify({ ok: true }, null, 2) },
  ])

  assert.equal(env.sections.length, 1)
  assert.equal(env.sections[0].name, 'digital-earth')
  assert.equal(env.sections[0].order, 550)
  assert.match(env.sections[0].text, /## Digital Earth panel/)
})

// ---------------------------------------------------------------------------
// Extra: serial queue, disconnects, panel selection, connection cap
// ---------------------------------------------------------------------------

test('every scene action maps to the documented command args', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  const cases = [
    [{ action: 'status' }, {}],
    [{ action: 'load', url: 'https://example.com/tileset.json' }, { url: 'https://example.com/tileset.json' }],
    [{ action: 'remove', id: 'layer-1' }, { id: 'layer-1' }],
    [{ action: 'visible', id: 'layer-1', visible: false }, { id: 'layer-1', visible: false }],
    [{ action: 'basemap', id: null }, { id: null }],
    [{ action: 'basemap' }, {}],
    [{ action: 'terrain', id: 'arcgis-world-elevation' }, { id: 'arcgis-world-elevation' }],
    [
      { action: 'fly', lon: 114.36, lat: 30.54, height: 500, heading: 10, pitch: -40, duration: 2 },
      { lon: 114.36, lat: 30.54, height: 500, heading: 10, pitch: -40, duration: 2 },
    ],
    [{ action: 'reset' }, {}],
    [{ action: 'pick', lon: 114.36, lat: 30.54 }, { lon: 114.36, lat: 30.54 }],
  ]
  for (const [args, expected] of cases) {
    const pending = env.scene().execute(args, env.exec())
    const command = await client.nextEvent()
    assert.equal(command.data.action, args.action)
    assert.deepEqual(command.data.args, expected)
    await env.result({ id: command.data.id, ok: true, data: { acknowledged: args.action } })
    assert.equal((await pending).ok, true)
  }
})

test('commands are serialized per panel', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  const first = env.scene().execute({ action: 'status' }, env.exec())
  const firstCommand = await client.nextEvent()
  assert.equal(firstCommand.data.action, 'status')
  const second = env.scene().execute({ action: 'fly', lon: 114.36, lat: 30.54 }, env.exec())
  await client.expectNoEvent(200) // the fly command must wait for the status receipt
  await env.result({ id: firstCommand.data.id, ok: true, data: { camera: SCENE_SNAPSHOT.camera } })
  assert.equal((await first).ok, true)
  const secondCommand = await client.nextEvent()
  assert.equal(secondCommand.data.action, 'fly')
  assert.deepEqual(secondCommand.data.args, { lon: 114.36, lat: 30.54 })
  await env.result({ id: secondCommand.data.id, ok: true, data: { camera: SCENE_SNAPSHOT.camera } })
  assert.equal((await second).ok, true)
})

test('closing the panel fails the in-flight command with panel_gone', async (t) => {
  const env = await startBridge(t)
  const client = await env.connect()
  await client.nextEvent()
  const pending = env.scene().execute({ action: 'status' }, env.exec())
  await client.nextEvent()
  client.close()
  const value = await rejectAfter(pending, 3000, 'the in-flight command was not rejected')
  assert.equal(value.ok, false)
  assert.equal(value.code, 'panel_gone')
})

test('a session-matched panel wins; otherwise multiple panels are ambiguous', async (t) => {
  const env = await startBridge(t)
  const first = await env.connect({ session: 'session-a' })
  await first.nextEvent()
  const second = await env.connect({ session: 'session-b' })
  await second.nextEvent()

  const pending = env.scene().execute({ action: 'status' }, env.exec('session-b'))
  const command = await second.nextEvent()
  assert.equal(command.data.action, 'status')
  await first.expectNoEvent(120)
  await env.result({ id: command.data.id, ok: true, data: { ready: true } })
  assert.equal((await pending).ok, true)

  const ambiguous = await env.scene().execute({ action: 'status' }, env.exec('session-c'))
  assert.equal(ambiguous.ok, false)
  assert.equal(ambiguous.code, 'panel_ambiguous')
  await first.expectNoEvent(120)
  await second.expectNoEvent(120)
})

test('at most eight panel connections stay registered', async (t) => {
  const env = await startBridge(t)
  const clients = []
  for (let index = 0; index < 9; index += 1) {
    const client = await env.connect({ session: `session-${index}` })
    await client.nextEvent()
    clients.push(client)
  }
  await clients[0].waitForClose(3000)
  assert.equal(clients[0].closed, true)
  const pending = env.scene().execute({ action: 'status' }, env.exec('session-8'))
  const command = await clients[8].nextEvent()
  assert.equal(command.data.action, 'status')
  await env.result({ id: command.data.id, ok: true, data: { ready: true } })
  assert.equal((await pending).ok, true)
})
