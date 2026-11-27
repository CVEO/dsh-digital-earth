/**
 * WP5/WP6 transport: byte ranges and the GeoTIFF tile/preview endpoints.
 *
 * Cesium asks for `Range` on large local files, and the tile pyramid is a plain
 * PNG tree, so these tests exercise the real file server with a fake response
 * object instead of standing up an HTTP listener.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Writable } from 'node:stream'

import { parseRange, serveFile } from '../src/host/http.js'
import { createGeotiffRoutes } from '../src/host/geotiff/http.js'
import { publishGeotiff } from '../src/host/geotiff/publish.js'
import { makeGeotiff } from './helpers/tiff-fixture.mjs'

const scratch = async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-geotiff-http-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

const fakeResponse = () => {
  const chunks = []
  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })
  res.status = 0
  res.headers = {}
  res.chunks = chunks
  res.writeHead = (status, headers = {}) => {
    res.status = status
    res.headers = headers
  }
  res.done = new Promise((resolve) => res.once('finish', resolve))
  return res
}

const body = (res) => Buffer.concat(res.chunks)

test('parseRange: full, open-ended, suffix and invalid ranges', () => {
  assert.equal(parseRange(undefined, 100), null)
  assert.equal(parseRange('bytes=0-9', 100).start, 0)
  assert.equal(parseRange('bytes=0-9', 100).end, 9)
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 })
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 })
  assert.deepEqual(parseRange('bytes=0-500', 100), { start: 0, end: 99 }, 'clamps past EOF')
  assert.equal(parseRange('bytes=100-', 100), 'invalid')
  assert.equal(parseRange('bytes=9-2', 100), 'invalid')
  assert.equal(parseRange('bytes=-', 100), 'invalid')
  assert.equal(parseRange('items=0-1', 100), null, 'not a byte range: ignore the header')
  assert.equal(parseRange('bytes=0-1', 0), 'invalid')
})

test('serveFile: 200 advertises ranges, 206 returns exactly the slice, 416 rejects', async (t) => {
  const dir = await scratch(t)
  const file = join(dir, 'data.bin')
  await writeFile(file, Buffer.from('0123456789'))

  const full = fakeResponse()
  await serveFile({ method: 'GET', headers: {} }, full, dir, 'data.bin', 'no-store')
  await full.done
  assert.equal(full.status, 200)
  assert.equal(full.headers['accept-ranges'], 'bytes')
  assert.equal(body(full).toString(), '0123456789')

  const slice = fakeResponse()
  await serveFile({ method: 'GET', headers: { range: 'bytes=2-5' } }, slice, dir, 'data.bin', 'no-store')
  await slice.done
  assert.equal(slice.status, 206)
  assert.equal(slice.headers['content-range'], 'bytes 2-5/10')
  assert.equal(slice.headers['content-length'], '4')
  assert.equal(body(slice).toString(), '2345')

  const head = fakeResponse()
  await serveFile({ method: 'HEAD', headers: { range: 'bytes=0-1' } }, head, dir, 'data.bin', 'no-store')
  await head.done
  assert.equal(head.status, 206)
  assert.equal(body(head).length, 0, 'HEAD never carries a body')

  const bad = fakeResponse()
  await serveFile({ method: 'GET', headers: { range: 'bytes=50-60' } }, bad, dir, 'data.bin', 'no-store')
  await bad.done
  assert.equal(bad.status, 416)
  assert.equal(bad.headers['content-range'], 'bytes */10')
})

test('geotiff routes: publish then serve preview and tile PNGs', async (t) => {
  const dir = await scratch(t)
  const raster = join(dir, 'ortho.tif')
  await writeFile(
    raster,
    makeGeotiff({
      width: 48,
      height: 48,
      samples: 3,
      pixel: (x, y, band) => 30 + x * 4 + y + band * 20,
      geo: { epsg: 4326, pixelSize: [0.002, 0.002], origin: [113, 31] },
    }),
  )
  const cacheDir = join(dir, 'cache')
  const published = await publishGeotiff({ filePath: raster, cacheDir })

  const queue = {
    start: () => ({ id: 'job00001', state: 'queued' }),
    status: (id) => (id === 'job00001' ? { id, state: 'done', done: 1, total: 1 } : null),
    cancel: (id) => (id === 'job00001' ? { id, state: 'canceled' } : null),
    busy: false,
  }
  const routes = createGeotiffRoutes({ cacheDir, jobs: queue })
  const call = async (method, rest, url = `http://localhost/api/3dviewer/geotiff/t${rest ? `/${rest}` : ''}`, headers = {}) => {
    const res = fakeResponse()
    const matched = await routes.handler({ method, url, headers }, res, rest)
    if (matched) await res.done
    return { matched, res }
  }

  const preview = await call('GET', `preview/${published.fileKey}/${published.renderKey}.png`)
  assert.equal(preview.matched, true)
  assert.equal(preview.res.status, 200)
  assert.equal(preview.res.headers['content-type'], 'image/png')
  assert.deepEqual(body(preview.res).subarray(0, 4), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

  const meta = await import('../src/host/geotiff/publish.js').then((mod) => mod.readPublishedMeta({ cacheDir, fileKey: published.fileKey }))
  const z = meta.levels[meta.levels.length - 1]
  // The pyramid only writes tiles that touch the footprint; request one of those.
  const tilesRoot = join(cacheDir, published.fileKey, `v-${published.renderKey}`, 'tiles')
  const names = []
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else names.push(full)
    }
  }
  await walk(tilesRoot)
  assert.ok(names.length > 0)
  const relative = names[0].slice(tilesRoot.length + 1).split(/[\\/]/).join('/')
  const tile = await call('GET', `tiles/${published.fileKey}/${published.renderKey}/${relative}`)
  assert.equal(tile.matched, true)
  assert.equal(tile.res.status, 200, `a published tile (${relative}) is served`)
  assert.deepEqual(body(tile.res).subarray(0, 4), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

  const missing = await call('GET', `tiles/${published.fileKey}/${published.renderKey}/${z}/0/9999.png`)
  assert.equal(missing.res.status, 404, 'a tile outside the footprint 404s instead of erroring')

  const badKey = await call('GET', 'tiles/not-a-key/abcdef01/0/0/0.png')
  assert.equal(badKey.res.status, 403, 'malformed keys never reach the filesystem')

  const job = await call('GET', 'job/job00001')
  assert.equal(job.res.status, 200)
  assert.ok(body(job.res).toString().includes('done'))
})

const jsonRequest = (payload) => {
  const bodyText = Buffer.from(JSON.stringify(payload))
  return {
    method: 'POST',
    url: 'http://localhost/api/3dviewer/geotiff/t/probe',
    headers: { 'x-dsh-panel': '1', 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      yield bodyText
    },
  }
}

const callRequest = async (routes, req, rest) => {
  const res = fakeResponse()
  const matched = await routes.handler(req, res, rest)
  if (matched) await res.done
  return { matched, res }
}

test('geotiff routes: probe JSON survives the wire and names the published tiles', async (t) => {
  const dir = await scratch(t)
  const raster = join(dir, 'ortho.tif')
  await writeFile(
    raster,
    makeGeotiff({
      width: 64,
      height: 64,
      samples: 3,
      pixel: (x, y, band) => (x * 3 + y + band * 20) % 256,
      geo: { epsg: 4326, pixelSize: [0.001, 0.001], origin: [113, 31] },
    }),
  )
  const cacheDir = join(dir, 'cache')
  let started = null
  const queue = {
    start: (args) => {
      started = args
      return { id: 'job00001', state: 'queued' }
    },
    status: () => null,
    cancel: () => null,
    busy: false,
  }
  const routes = createGeotiffRoutes({ cacheDir, jobs: queue })

  const probed = await callRequest(routes, jsonRequest({ path: raster }), 'probe')
  assert.equal(probed.res.status, 200)
  const probe = JSON.parse(body(probed.res).toString()).probe
  assert.ok(probe.renderKey)

  const published = await publishGeotiff({ filePath: raster, render: probe.render, cacheDir })
  assert.equal(published.renderKey, probe.renderKey, 'the wire must not change the render key')
  assert.equal(published.fileKey, probe.fileKey)

  const startedRes = await callRequest(routes, jsonRequest({ path: raster, render: probe.render }), 'publish')
  assert.equal(startedRes.res.status, 202)
  assert.deepEqual(started.render, probe.render, 'publish keeps the settings the dialog approved')

  const tileDir = join(cacheDir, probe.fileKey, `v-${probe.renderKey}`, 'tiles')
  const names = []
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else names.push(full)
    }
  }
  await walk(tileDir)
  const relative = names[0].slice(tileDir.length + 1).split(/[\\/]/).join('/')
  const tile = await callRequest(routes, { method: 'GET', url: 'http://localhost/x', headers: {} }, `tiles/${probe.fileKey}/${probe.renderKey}/${relative}`)
  assert.equal(tile.res.status, 200, 'the preview key also serves the published tile')
})

test('geotiff routes: probe/publish are limited to folders opened from the panel', async (t) => {
  const dir = await scratch(t)
  const folder = join(dir, 'ortho')
  await mkdir(folder, { recursive: true })
  const raster = join(folder, 'a.tif')
  await writeFile(
    raster,
    makeGeotiff({ width: 16, height: 16, samples: 3, pixel: (x, y, b) => x + y + b }),
  )
  const outside = join(dir, 'outside.tif')
  await writeFile(outside, makeGeotiff({ width: 16, height: 16, samples: 3, pixel: (x, y, b) => x + y + b }))

  const allowedDirs = new Set()
  const routes = createGeotiffRoutes({ cacheDir: join(dir, 'cache'), jobs: {}, allowedDirs })

  const denied = await callRequest(routes, jsonRequest({ path: outside }), 'probe')
  assert.equal(denied.res.status, 403)
  assert.equal(JSON.parse(body(denied.res).toString()).code, 'not_allowed')

  const scanned = await callRequest(
    routes,
    { method: 'GET', url: `http://localhost/x?dir=${encodeURIComponent(folder)}`, headers: { 'x-dsh-panel': '1' } },
    'scan',
  )
  assert.equal(scanned.res.status, 200)
  assert.ok(allowedDirs.size >= 1, 'the scanned folder joins the allowlist')

  const allowed = await callRequest(routes, jsonRequest({ path: raster }), 'probe')
  assert.equal(allowed.res.status, 200)
})

test('geotiff routes: scan and publish require the panel header', async (t) => {
  const dir = await scratch(t)
  const routes = createGeotiffRoutes({ cacheDir: join(dir, 'cache'), jobs: {} })
  const noHeader = { method: 'GET', url: `http://localhost/x?dir=${encodeURIComponent(dir)}`, headers: {} }
  const scanned = await callRequest(routes, noHeader, 'scan')
  assert.equal(scanned.res.status, 403)
  const published = await callRequest(
    routes,
    { ...jsonRequest({ path: join(dir, 'a.tif') }), headers: { 'content-type': 'application/json' } },
    'publish',
  )
  assert.equal(published.res.status, 403)
})

test('geotiff upload: a panel file goes to the cache and is immediately probe-able', async (t) => {
  const dir = await scratch(t)
  const cacheDir = join(dir, 'cache')
  const bytes = makeGeotiff({
    width: 32,
    height: 16,
    samples: 3,
    pixel: (x, y, band) => (x + y + band * 9) % 256,
    geo: { epsg: 4326, pixelSize: [0.001, 0.001], origin: [113, 31] },
  })
  const allowedDirs = new Set()
  const routes = createGeotiffRoutes({ cacheDir, allowedDirs })
  const upload = {
    method: 'POST',
    url: 'http://localhost/api/3dviewer/geotiff/t/upload',
    headers: { 'x-dsh-panel': '1', 'x-file-name': encodeURIComponent('航测 正射.tif') },
    async *[Symbol.asyncIterator]() {
      yield bytes
    },
  }
  const uploaded = await callRequest(routes, upload, 'upload')
  assert.equal(uploaded.res.status, 200)
  const payload = JSON.parse(body(uploaded.res).toString())
  assert.equal(payload.name, '航测 正射.tif')
  assert.equal(payload.size, bytes.length)
  assert.ok(payload.path.endsWith('.tif'))
  assert.equal((await readFile(payload.path)).length, bytes.length)

  const probed = await callRequest(routes, jsonRequest({ path: payload.path }), 'probe')
  assert.equal(probed.res.status, 200, 'the upload directory joins the allowlist')
  const probe = JSON.parse(body(probed.res).toString()).probe
  assert.equal(probe.width, 32)
  assert.equal(probe.height, 16)
})

test('geotiff upload: panel intent and a TIFF name are both required', async (t) => {
  const dir = await scratch(t)
  const routes = createGeotiffRoutes({ cacheDir: join(dir, 'cache'), allowedDirs: new Set() })
  const bytes = Buffer.from('not a tiff')
  const request = (headers) => ({
    method: 'POST',
    url: 'http://localhost/api/3dviewer/geotiff/t/upload',
    headers,
    async *[Symbol.asyncIterator]() {
      yield bytes
    },
  })
  const noIntent = await callRequest(routes, request({ 'x-file-name': 'a.tif' }), 'upload')
  assert.equal(noIntent.res.status, 403)
  const wrongName = await callRequest(routes, request({ 'x-dsh-panel': '1', 'x-file-name': 'a.png' }), 'upload')
  assert.equal(wrongName.res.status, 400)
  assert.equal(JSON.parse(body(wrongName.res).toString()).code, 'not_tiff')
})
