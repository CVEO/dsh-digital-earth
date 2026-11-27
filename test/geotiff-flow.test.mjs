/**
 * Client transport: envelope flattening, job-key authority, token rotation retry.
 *
 * flow.js caches the host token prefix, so each case imports a fresh module
 * instance; otherwise one case's host would answer the next case's request.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const realFetch = globalThis.fetch

const useFetch = (t, handler) => {
  globalThis.fetch = handler
  t.after(() => {
    globalThis.fetch = realFetch
  })
}

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

test('probeFile flattens the host envelope', async (t) => {
  const flow = await import('../src/client/geotiff/flow.js?case=probe')
  const calls = []
  useFetch(t, async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('/meta')) return jsonResponse({ geotiffBase: '/api/3dviewer/geotiff/t0' })
    return jsonResponse({ probe: { path: 'C:/a.tif', fileKey: 'f', renderKey: 'r' } })
  })
  const probe = await flow.probeFile('C:/a.tif')
  assert.equal(probe.fileKey, 'f')
  assert.ok(calls.some((url) => url.endsWith('/probe')))
})

test('overlayFor prefers the finished job keys over the probe keys', async (t) => {
  const flow = await import('../src/client/geotiff/flow.js?case=overlay')
  useFetch(t, async (url) =>
    String(url).endsWith('/meta') ? jsonResponse({ geotiffBase: '/api/3dviewer/geotiff/t1' }) : jsonResponse({}),
  )
  const probe = { name: '正射影像.tif', fileKey: 'probeFile', renderKey: 'probeRender', pyramid: { maxLevel: 9 } }
  const job = { fileKey: 'jobFile', renderKey: 'jobRender', maxLevel: 12 }
  const overlay = await flow.overlayFor(probe, job)
  assert.equal(overlay.url, 'http://localhost/api/3dviewer/geotiff/t1/tiles/jobFile/jobRender/{z}/{x}/{y}.png')
  // The catalog only keeps absolute http(s) URLs; a relative one is dropped on save.
  assert.match(overlay.url, /^https?:\/\//)
  assert.equal(overlay.maximumLevel, 12)
  assert.equal(overlay.tilingScheme, 'geographic')
  assert.equal(overlay.name, '正射影像')
})

test('overlayFor falls back to the probe when no job is supplied', async (t) => {
  const flow = await import('../src/client/geotiff/flow.js?case=fallback')
  useFetch(t, async (url) =>
    String(url).endsWith('/meta') ? jsonResponse({ geotiffBase: '/api/3dviewer/geotiff/t2' }) : jsonResponse({}),
  )
  const overlay = await flow.overlayFor({ name: 'dem.tif', fileKey: 'a', renderKey: 'b', pyramid: { maxLevel: 7 } }, null)
  assert.match(overlay.url, /^http:\/\/localhost\/api\/3dviewer\/geotiff\/t2\/tiles\/a\/b\/\{z\}\/\{x\}\/\{y\}\.png$/)
  assert.equal(overlay.maximumLevel, 7)
})

test('a rotated host token is retried once after re-reading meta', async (t) => {
  const flow = await import('../src/client/geotiff/flow.js?case=retry')
  let baseReads = 0
  let probes = 0
  useFetch(t, async (url) => {
    const target = String(url)
    if (target.endsWith('/meta')) {
      baseReads += 1
      return jsonResponse({ geotiffBase: `/api/3dviewer/geotiff/t${baseReads}` })
    }
    if (target.includes('/t1/probe')) {
      probes += 1
      return jsonResponse({ code: 'http_403', message: 'stale token' }, 403)
    }
    if (target.includes('/t2/probe')) {
      probes += 1
      return jsonResponse({ probe: { fileKey: 'ok', renderKey: 'ok2' } })
    }
    return jsonResponse({ code: 'not_found' }, 404)
  })
  const probe = await flow.probeFile('C:/a.tif')
  assert.equal(probe.fileKey, 'ok')
  assert.equal(baseReads, 2)
  assert.equal(probes, 2)
})

test('uploadGeotiff streams the picked file to the token route with panel intent', async (t) => {
  const flow = await import('../src/client/geotiff/flow.js?case=upload')
  useFetch(t, async (url) =>
    String(url).endsWith('/meta') ? jsonResponse({ geotiffBase: '/api/3dviewer/geotiff/t9' }) : jsonResponse({}),
  )
  const RealXHR = globalThis.XMLHttpRequest
  const seen = { headers: {}, progress: [] }
  class FakeXHR {
    constructor() {
      this.upload = {}
    }
    open(method, url) {
      seen.method = method
      seen.url = url
    }
    setRequestHeader(name, value) {
      seen.headers[name] = value
    }
    send(file) {
      seen.file = file
      queueMicrotask(() => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 512, total: 1024 })
        this.status = 200
        this.responseText = JSON.stringify({ path: 'C:/cache/uploads/a.tif', size: 1024, name: '航测 正射.tif' })
        this.onload?.()
      })
    }
    abort() {
      this.onabort?.()
    }
  }
  globalThis.XMLHttpRequest = FakeXHR
  t.after(() => {
    if (RealXHR === undefined) delete globalThis.XMLHttpRequest
    else globalThis.XMLHttpRequest = RealXHR
  })
  const file = new Blob([new Uint8Array(1024)], { type: 'image/tiff' })
  Object.defineProperty(file, 'name', { value: '航测 正射.tif' })
  const uploaded = await flow.uploadGeotiff(file, { onProgress: (loaded, total) => seen.progress.push([loaded, total]) })
  assert.equal(seen.method, 'POST')
  assert.match(seen.url, /\/api\/3dviewer\/geotiff\/t9\/upload$/)
  assert.equal(seen.headers['x-dsh-panel'], '1')
  assert.equal(decodeURIComponent(seen.headers['x-file-name']), '航测 正射.tif')
  assert.equal(seen.file, file)
  assert.deepEqual(seen.progress, [[512, 1024]])
  assert.equal(uploaded.path, 'C:/cache/uploads/a.tif')
})

test('uploadGeotiff refuses before sending when the host predates the route', async (t) => {
  const flow = await import('../src/client/geotiff/flow.js?case=stale-host')
  useFetch(t, async (url) => (String(url).endsWith('/meta') ? jsonResponse({ token: 'x' }) : jsonResponse({})))
  const RealXHR = globalThis.XMLHttpRequest
  let sent = 0
  class FakeXHR {
    constructor() {
      this.upload = {}
    }
    open() {}
    setRequestHeader() {}
    send() {
      sent += 1
    }
    abort() {}
  }
  globalThis.XMLHttpRequest = FakeXHR
  t.after(() => {
    if (RealXHR === undefined) delete globalThis.XMLHttpRequest
    else globalThis.XMLHttpRequest = RealXHR
  })
  const file = new Blob([new Uint8Array(8)])
  Object.defineProperty(file, 'name', { value: 'a.tif' })
  await assert.rejects(flow.uploadGeotiff(file), (error) => error.code === 'unsupported')
  assert.equal(sent, 0, 'a stale host must not receive the file bytes')
})
