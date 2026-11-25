import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerRoutes } from '../src/host/routes.js'

function mountRoutes(connection) {
  const routes = new Map()
  const ctx = {
    get: (name) => (name === 'connection' ? connection : undefined),
    webServer: {
      register(route) {
        routes.set(route.path, route)
        return () => routes.delete(route.path)
      },
    },
    effect: (fn) => fn(),
  }
  registerRoutes(ctx, {
    allowedDirs: new Set(),
    bridge: { dispose() {} },
    directories: { list: () => [], rememberScannedDirectory() {} },
    getService: () => null,
  })
  return routes
}

async function invokeMeta(routes, headers, peer) {
  const route = routes.get('/api/3dviewer/meta')
  const res = Object.assign(new EventEmitter(), {
    status: undefined,
    body: undefined,
    writeHead(status) {
      this.status = status
    },
    setHeader() {},
    end(body) {
      this.body = body
    },
  })
  const req = { method: 'GET', url: '/api/3dviewer/meta', headers }
  await route.handler(req, res, peer)
  return res
}

test('routes auth: 每条注册路由都显式声明 auth: required', () => {
  const routes = mountRoutes(null)
  assert.ok(routes.size >= 17)
  for (const route of routes.values()) {
    assert.equal(route.auth, 'required', `route ${route.path} should require auth`)
  }
})

test('routes auth: DSH 0.2.2-rc.2+ Desktop 代理移除 Sec-Fetch-Site/Origin，WebServer 传入活跃 peer 时放行', async () => {
  let admitCalled = 0
  const routes = mountRoutes({
    admit() {
      admitCalled++
      return { rejection: 503 }
    },
  })
  const livePeer = { id: 'peer-desktop', principal: { kind: 'owner' }, signal: new AbortController().signal }

  // Desktop forwardWebRequest strips Origin & Sec-Fetch-Site, leaving only Host (+ desktop session cookie).
  const ok = await invokeMeta(routes, { host: '127.0.0.1:58954', cookie: 'dsh-desktop-session=abc' }, livePeer)
  assert.equal(ok.status, 200)
  assert.equal(admitCalled, 0, 'should trust WebServer-admitted peer without redundant admit()')
  assert.ok(JSON.parse(ok.body).token)

  // Already-aborted peer must be rejected with 401.
  const aborted = new AbortController()
  aborted.abort()
  const stale = await invokeMeta(routes, { host: '127.0.0.1:58954' }, { id: 'peer-dead', signal: aborted.signal })
  assert.equal(stale.status, 401)
  assert.equal(stale.body, 'unauthorized')

  // Cross-site or mismatched Origin still fails closed even if a caller passes a peer.
  const crossSite = await invokeMeta(routes, { host: '127.0.0.1:58954', 'sec-fetch-site': 'cross-site' }, livePeer)
  assert.equal(crossSite.status, 403)
  const badOrigin = await invokeMeta(routes, { host: '127.0.0.1:58954', origin: 'dsh-app://app' }, livePeer)
  assert.equal(badOrigin.status, 403)
})

test('routes auth: 无 peer 时优先调用 connection.admit(request)，遵循 ConnectionTrustRequest 与 PeerAdmission 契约', async () => {
  const seen = []
  const livePeer = { id: 'peer-1', signal: new AbortController().signal }
  const routes = mountRoutes({
    admit(request) {
      seen.push(request)
      if (!request.headers.host) return { rejection: 403 }
      if (request.headers.cookie === 'dsh-desktop-session=ok') return { peer: livePeer }
      if (request.headers.cookie === 'broken') return { rejection: 503 }
      return { rejection: 401 }
    },
  })

  // Desktop proxy shape without Sec-Fetch-Site/Origin passes via admit()
  const desktopOk = await invokeMeta(routes, { host: '127.0.0.1:58954', cookie: 'dsh-desktop-session=ok' })
  assert.equal(desktopOk.status, 200)
  assert.equal(typeof seen[0].url, 'string', 'ConnectionTrustRequest.url must be string, not URL object')
  assert.equal(seen[0].url, '/api/3dviewer/meta')
  assert.equal(seen[0].method, 'GET')

  // Browser same-origin shape passes via admit()
  const browserOk = await invokeMeta(routes, {
    host: '127.0.0.1:58954',
    'sec-fetch-site': 'same-origin',
    cookie: 'dsh-desktop-session=ok',
  })
  assert.equal(browserOk.status, 200)

  // Missing credential -> 401 unauthorized
  const unauth = await invokeMeta(routes, { host: '127.0.0.1:58954' })
  assert.equal(unauth.status, 401)
  assert.equal(unauth.body, 'unauthorized')

  // Auth provider error -> 503 authentication unavailable
  const unavailable = await invokeMeta(routes, { host: '127.0.0.1:58954', cookie: 'broken' })
  assert.equal(unavailable.status, 503)
  assert.equal(unavailable.body, 'authentication unavailable')

  // Malformed/empty admit() return or exception fails closed with 403
  const emptyAdmit = mountRoutes({ admit() {} })
  assert.equal((await invokeMeta(emptyAdmit, { host: '127.0.0.1:58954' })).status, 403)
  const throwingAdmit = mountRoutes({
    admit() {
      throw new Error('boom')
    },
  })
  assert.equal((await invokeMeta(throwingAdmit, { host: '127.0.0.1:58954' })).status, 403)
})

test('routes auth: 兼容旧宿主 requestRejection 与无 connection 时的 fail-closed 回退', async () => {
  const legacyAllow = mountRoutes({ requestRejection: () => undefined })
  assert.equal((await invokeMeta(legacyAllow, { host: '127.0.0.1:58954' })).status, 200)

  const legacyDeny = mountRoutes({ requestRejection: () => 401 })
  const denied = await invokeMeta(legacyDeny, { host: '127.0.0.1:58954' })
  assert.equal(denied.status, 401)
  assert.equal(denied.body, 'unauthorized')

  // No connection service at all: only explicit same-origin / none passes.
  const noConn = mountRoutes(null)
  assert.equal((await invokeMeta(noConn, { host: '127.0.0.1:58954' })).status, 403)
  assert.equal((await invokeMeta(noConn, { host: '127.0.0.1:58954', 'sec-fetch-site': 'same-origin' })).status, 200)
  assert.equal((await invokeMeta(noConn, { host: '127.0.0.1:58954', 'sec-fetch-site': 'cross-site' })).status, 403)
})
