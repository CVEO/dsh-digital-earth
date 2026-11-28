import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPlaceHandler, osmResults, tiandituResults } from '../src/host/place-search.js'
import { placeBounds } from '../src/client/scene/fly-target.js'

const ok = { status: { infocode: 1000 } }
const area = { name: '武汉市', lonlat: '114.3,30.6', bound: '113.7,29.9,115.1,31.4' }
const osm = { name: 'Wuhan', lon: '114.3', lat: '30.6', boundingbox: ['29.9', '31.4', '113.7', '115.1'] }

async function call(handler, method, data, panel = true) {
  const req = Readable.from(data === undefined ? [] : [JSON.stringify(data)])
  Object.assign(req, { method, headers: panel ? { 'x-dsh-panel': '1' } : {} })
  const res = { writeHead(status) { this.status = status }, end(raw) { this.body = JSON.parse(raw) } }
  await handler(req, res)
  return res
}

test('place search fits both provider extents and skips invalid POIs', () => {
  const [a] = tiandituResults({ ...ok, area, pois: [{ name: 'bad', lonlat: ',30' }] })
  const [b] = osmResults([osm])
  assert.deepEqual(placeBounds(a), { west: 113.7, south: 29.9, east: 115.1, north: 31.4 })
  assert.deepEqual(placeBounds(a), placeBounds(b))
  assert.deepEqual(osmResults([{ ...osm, lon: '181' }, { ...osm, lat: null }]), [])
  assert.deepEqual(tiandituResults({ status: { infocode: 3001 } }), [])
  assert.throws(() => tiandituResults({ code: 308010 }))
  assert.ok(placeBounds({ lon: 0, lat: 0 }).west < 0)
})

test('city statistics refine the original term without pretending to be POIs', () => {
  const city = { name: '武汉市', adminCode: '156420100', count: 2 }
  assert.deepEqual(tiandituResults({ ...ok, resultType: 2, statistics: { priorityCitys: [city], allAdmins: [city] } }), [{ name: '武汉市', region: '156420100' }])
})

test('domestic key survives a host restart, is masked and goes only to Tianditu', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const calls = []
  const opts = { env: {}, keyFile: join(dir, 'key.json'), fetchImpl: async url => {
    calls.push(url)
    return Response.json({ ...ok, area })
  } }
  const handler = createPlaceHandler(opts)
  const q = { provider: 'tianditu', query: '武汉', region: '156420100' }
  assert.equal((await call(handler, 'POST', q, false)).status, 403)
  assert.equal((await call(handler, 'POST', q)).body.error, 'key')
  assert.equal(calls.length, 0)
  assert.equal((await call(handler, 'PUT', { token: 'example-token' })).status, 200)
  const restarted = createPlaceHandler(opts)
  assert.deepEqual((await call(restarted, 'GET')).body, { configured: true, managed: false })
  assert.equal((await call(restarted, 'POST', q)).body.results[0].name, '武汉市')
  assert.equal(calls[0].hostname, 'api.tianditu.gov.cn')
  assert.equal(calls[0].searchParams.get('tk'), 'example-token')
  assert.equal(JSON.parse(calls[0].searchParams.get('postStr')).specify, '156420100')
  assert.equal((await call(restarted, 'POST', { ...q, query: '' })).status, 400)
})

test('OSM caches by query and language, rate limits across clients and supports another endpoint', async () => {
  let clock = 5000
  const requests = []
  const handler = createPlaceHandler({ env: { TIANDITU_TOKEN: 'private', DSH_NOMINATIM_SEARCH_URL: 'https://search.example.org/search' }, now: () => clock,
    fetchImpl: async (url, init) => {
      assert.equal(url.origin, 'https://search.example.org')
      assert.equal(url.searchParams.has('tk'), false)
      assert.match(init.headers['User-Agent'], /DSH-Digital-Earth/)
      requests.push(url)
      return Response.json([osm])
    } })
  const q = { provider: 'osm', query: 'Wuhan', language: 'en' }
  assert.equal((await call(handler, 'POST', q)).status, 200)
  assert.equal((await call(handler, 'POST', q)).body.results.length, 1)
  assert.equal((await call(handler, 'POST', { ...q, language: 'zh' })).status, 429)
  clock += 1100
  assert.equal((await call(handler, 'POST', { ...q, language: 'zh' })).status, 200)
  assert.equal(requests.length, 2)
})
