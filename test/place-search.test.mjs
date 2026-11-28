import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DEFAULT_ENABLED, amapResults, createPlaceHandler, normalizePlaceConfig, osmResults, photonResults, tiandituResults, validateProviders } from '../src/host/place-search.js'
import { placeBounds } from '../src/client/scene/fly-target.js'

const ok = { status: { infocode: 1000 } }
const area = { name: '武汉市', lonlat: '114.3,30.6', bound: '113.7,29.9,115.1,31.4' }
const osm = { name: 'Wuhan', lon: '114.3', lat: '30.6', boundingbox: ['29.9', '31.4', '113.7', '115.1'] }
const amap = { status: '1', pois: [{ name: '武汉大学', pname: '湖北省', cityname: '武汉市', adname: '武昌区', address: '八一路 299 号', location: '114.361,30.537' }] }
const photon = { type: 'FeatureCollection', features: [{ properties: { name: '武汉市', state: '湖北省', country: '中国', extent: [113.696, 31.362, 115.076, 29.972] }, geometry: { coordinates: [114.292, 30.578] } }] }

const URLS = {
  tianditu: 'https://api.tianditu.gov.cn/v2/search',
  amap: 'https://restapi.amap.com/v3/place/text',
  photon: 'https://photon.komoot.io/api/',
  nominatim: 'https://nominatim.openstreetmap.org/search',
}
const TYPES = ['tianditu', 'amap', 'photon', 'nominatim']

/** The shipped list, optionally patched per provider, as the settings tab would send it. */
const providers = (patch = {}) => TYPES.map(type => ({
  id: type, name: '', type, url: URLS[type], enabled: DEFAULT_ENABLED[type], ...(patch[type] ?? {}),
}))
const custom = (patch = {}) => ({ id: 'photon-lan', name: '内网 Photon', type: 'photon', url: 'https://geo.lan/photon/', enabled: true, ...patch })

async function call(handler, method, data, panel = true) {
  const req = Readable.from(data === undefined ? [] : [JSON.stringify(data)])
  Object.assign(req, { method, headers: panel ? { 'x-dsh-panel': '1' } : {} })
  const res = { writeHead(status) { this.status = status }, end(raw) { this.body = JSON.parse(raw) } }
  await handler(req, res)
  return res
}

test('place search fits every provider extent and skips invalid POIs', () => {
  const [a] = tiandituResults({ ...ok, area, pois: [{ name: 'bad', lonlat: ',30' }] })
  const [b] = osmResults([osm])
  const [c] = photonResults(photon)
  const [d] = amapResults(amap)
  assert.deepEqual(placeBounds(a), { west: 113.7, south: 29.9, east: 115.1, north: 31.4 })
  assert.deepEqual(placeBounds(a), placeBounds(b))
  // Photon `extent` is [west, north, east, south] and must be reordered, not trusted.
  assert.deepEqual(c.bbox, { west: 113.696, south: 29.972, east: 115.076, north: 31.362 })
  assert.equal(d.name, '武汉大学')
  assert.equal(d.detail, '湖北省 · 武汉市 · 武昌区 · 八一路 299 号')
  const dBox = placeBounds(d)
  assert.equal(dBox.west, 114.361 - 0.005)
  assert.equal(dBox.south, 30.537 - 0.005)
  assert.equal(dBox.east, 114.361 + 0.005)
  assert.equal(dBox.north, 30.537 + 0.005)
  assert.deepEqual(osmResults([{ ...osm, lon: '181' }, { ...osm, lat: null }]), [])
  assert.deepEqual(photonResults({ features: [null, { properties: {}, geometry: { coordinates: [1, 2] } }] }), [])
  assert.deepEqual(tiandituResults({ status: { infocode: 3001 } }), [])
  assert.throws(() => tiandituResults({ code: 308010 }))
  assert.throws(() => photonResults({}), /provider/)
  assert.throws(() => amapResults({ status: '0', info: 'INVALID_USER_KEY' }), /denied/)
  assert.throws(() => amapResults({ status: '0', info: 'DAILY_QUERY_OVER_LIMIT' }), /rate/)
  assert.ok(placeBounds({ lon: 0, lat: 0 }).west < 0)
})

test('city statistics refine the original term without pretending to be POIs', () => {
  const city = { name: '武汉市', adminCode: '156420100', count: 2 }
  assert.deepEqual(tiandituResults({ ...ok, resultType: 2, statistics: { priorityCitys: [city], allAdmins: [city] } }), [{ name: '武汉市', region: '156420100' }])
})

test('stored config normalizes providers and migrates every older file shape', () => {
  const fresh = normalizePlaceConfig(null)
  assert.equal(fresh.version, 4)
  assert.deepEqual(fresh.providers.map(p => [p.id, p.type, p.enabled]), [
    ['tianditu', 'tianditu', true], ['amap', 'amap', true], ['photon', 'photon', false], ['nominatim', 'nominatim', false],
  ])
  // A provider carries its own service URL, so a custom instance is just data.
  assert.deepEqual(fresh.providers.map(p => p.url), TYPES.map(type => URLS[type]))
  assert.equal(fresh.selected, '')

  // v1 `{token}` and v2 `{provider, keys}` fold into the Tianditu/Amap entries.
  assert.equal(normalizePlaceConfig({ token: 'legacy' }).providers[0].key, 'legacy')
  assert.equal(normalizePlaceConfig({ keys: { amap: 'abc_DEF-1', tianditu: 'bad key' } }).providers[1].key, 'abc_DEF-1')
  assert.equal(normalizePlaceConfig({ keys: { tianditu: 'bad key' } }).providers[0].key, undefined)
  assert.equal(normalizePlaceConfig({ provider: 'osm' }).selected, '')
  assert.equal(normalizePlaceConfig({ provider: 'photon' }).selected, 'photon')

  // v3 `{enabled}` map keeps its non-default flags.
  assert.deepEqual(normalizePlaceConfig({ enabled: { photon: true, nominatim: 'yes', tianditu: false } }).providers.map(p => p.enabled), [false, true, true, false])

  // v4 keeps custom instances, drops junk, and env only seeds the legacy URLs.
  const saved = normalizePlaceConfig({
    selected: 'photon-lan',
    providers: [{ id: 'photon', name: '', type: 'photon', url: 'https://x.example/api', enabled: true }, custom(), { id: 'nope', type: 'osm', url: 'https://y.example' }, { id: 'amap' }],
  })
  assert.deepEqual(saved.providers.map(p => p.id), [...TYPES, 'photon-lan'])
  assert.equal(saved.providers[2].url, 'https://x.example/api')
  assert.equal(saved.selected, 'photon-lan')
  const seeded = normalizePlaceConfig({ provider: 'photon' }, { DSH_PHOTON_SEARCH_URL: 'https://photon.example/api' })
  assert.equal(seeded.providers[2].url, 'https://photon.example/api')
})

test('the settings list is validated before anything is stored', () => {
  assert.equal(validateProviders(providers()).length, 4)
  assert.deepEqual(validateProviders([...providers(), custom()]).at(-1), { id: 'photon-lan', name: '内网 Photon', type: 'photon', url: 'https://geo.lan/photon/', enabled: true })
  assert.throws(() => validateProviders([]), /input/)
  assert.throws(() => validateProviders(providers().slice(0, 3)), /input/, 'built-in providers may not be removed')
  assert.throws(() => validateProviders([...providers(), custom({ type: 'osm' })]), /input/)
  assert.throws(() => validateProviders([...providers(), custom({ name: '  ' })]), /input/)
  assert.throws(() => validateProviders([...providers(), custom({ url: 'geo.lan/photon' })]), /input/)
  assert.throws(() => validateProviders([...providers(), custom({ id: 'bad id' })]), /input/)
  assert.throws(() => validateProviders([...providers(), custom({ id: 'photon' })]), /input/, 'duplicate ids')
  assert.throws(() => validateProviders([...providers(), ...TYPES.map(() => custom({ id: 'p1' }))].slice(0, 9)), /input/, 'at most 12 providers')
  // A built-in entry may not be renamed to another adapter type.
  assert.throws(() => validateProviders([...providers().slice(1), { ...providers()[0], type: 'photon' }]), /input/)
})

test('host config round trip: default provider, key write, restart and region codes', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const keyFile = join(dir, 'place-search.json')
  const calls = []
  const fetchImpl = async url => { calls.push(url); return Response.json({ ...ok, area, pois: [area] }) }
  const handler = createPlaceHandler({ env: {}, keyFile, fetchImpl })
  assert.equal((await call(handler, 'POST', { provider: 'tianditu', query: '武汉' }, false)).status, 403)
  const initial = (await call(handler, 'GET')).body
  // Photon and Nominatim ship disabled, so a keyless install falls back to the
  // first enabled provider (Tianditu) and asks for its key instead of guessing.
  assert.equal(initial.provider, 'tianditu')
  assert.equal(initial.selected, '')
  assert.deepEqual(initial.providers.map(p => [p.id, p.enabled, p.builtin, p.configured]), [
    ['tianditu', true, true, false], ['amap', true, true, false], ['photon', false, true, false], ['nominatim', false, true, false],
  ])
  assert.deepEqual(initial.providers.map(p => p.needsKey), [true, true, false, false])
  assert.equal((await call(handler, 'POST', { provider: 'tianditu', query: '武汉' })).body.error, 'key')
  assert.equal(calls.length, 0)

  assert.equal((await call(handler, 'PUT', { selected: 'tianditu' })).body.selected, 'tianditu')
  const saved = (await call(handler, 'PUT', { keys: { tianditu: 'example-token' } })).body
  assert.equal(saved.providers[0].configured, true)
  assert.equal((await call(handler, 'PUT', { keys: { tianditu: 'bad key' } })).status, 400)
  const restarted = createPlaceHandler({ env: {}, keyFile, fetchImpl })
  assert.equal((await call(restarted, 'GET')).body.provider, 'tianditu')
  assert.equal((await call(restarted, 'POST', { provider: 'tianditu', query: '武汉', region: 156420100 })).body.results[0].name, '武汉市')
  assert.equal(calls[0].hostname, 'api.tianditu.gov.cn')
  assert.equal(calls[0].searchParams.get('tk'), 'example-token')
  assert.equal(JSON.parse(calls[0].searchParams.get('postStr')).specify, '156420100')
  assert.equal((await call(restarted, 'POST', { provider: 'tianditu', query: '' })).status, 400)
  assert.equal((await call(restarted, 'POST', { provider: 'tianditu', query: '武汉', region: 420100 })).status, 400, 'Tianditu wants a 9-digit adcode')
  assert.equal((await call(restarted, 'POST', { provider: 'photon', query: '武汉' })).body.error, 'disabled')
  // The file keeps the key inside the provider entry (0600), not in a side map.
  const stored = JSON.parse(await readFile(keyFile, 'utf8'))
  assert.equal(stored.version, 4)
  assert.equal(stored.providers.find(p => p.id === 'tianditu').key, 'example-token')
})

test('a host-managed Tianditu token cannot be overwritten from the panel', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const handler = createPlaceHandler({ env: { TIANDITU_TOKEN: 'private' }, keyFile: join(dir, 'p.json'), fetchImpl: async () => Response.json({ ...ok, area }) })
  const body = (await call(handler, 'GET')).body
  assert.equal(body.providers[0].managed, true)
  assert.equal(body.providers[0].configured, true)
  assert.equal(body.provider, 'tianditu')
  assert.equal((await call(handler, 'PUT', { keys: { tianditu: 'mine' } })).status, 400)
  assert.equal((await call(handler, 'PUT', { providers: providers({ tianditu: { key: 'mine', enabled: true } }) })).status, 400)
  // Other fields of the managed entry stay editable.
  assert.equal((await call(handler, 'PUT', { providers: providers({ tianditu: { enabled: false } }) })).status, 200)
})

test('Amap searches with its own key and reports quota separately from a bad key', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const urls = []
  let reply = () => Response.json(amap)
  const handler = createPlaceHandler({ env: {}, keyFile: join(dir, 'p.json'), fetchImpl: async url => { urls.push(url); return reply() } })
  await call(handler, 'PUT', { providers: providers({ amap: { key: 'amap-key' } }), selected: 'amap' })
  const hit = await call(handler, 'POST', { provider: 'amap', query: '武汉大学', region: 420100 })
  assert.equal(hit.body.results[0].name, '武汉大学')
  assert.equal(urls[0].hostname, 'restapi.amap.com')
  assert.equal(urls[0].searchParams.get('key'), 'amap-key')
  assert.equal(urls[0].searchParams.get('city'), '420100')
  // Identical queries are cached instead of burning the daily quota again.
  assert.equal((await call(handler, 'POST', { provider: 'amap', query: '武汉大学', region: 420100 })).status, 200)
  assert.equal(urls.length, 1)
  reply = () => Response.json({ status: '0', info: 'INVALID_USER_KEY' })
  const denied = await call(handler, 'POST', { provider: 'amap', query: '武汉', region: 420100 })
  assert.equal(denied.status, 403)
  assert.equal(denied.body.error, 'denied')
})

test('Photon answers without a service key once the user enables it', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const urls = []
  const handler = createPlaceHandler({ env: {}, keyFile: join(dir, 'p.json'), fetchImpl: async url => { urls.push(url); return Response.json(photon) } })
  assert.equal((await call(handler, 'POST', { query: '武汉', language: 'zh' })).body.error, 'key')
  await call(handler, 'PUT', { providers: providers({ tianditu: { enabled: false }, amap: { enabled: false }, photon: { enabled: true } }), selected: 'photon' })
  const hit = await call(handler, 'POST', { query: '武汉', language: 'zh' })
  assert.equal(hit.body.results[0].name, '武汉市')
  assert.equal(urls[0].hostname, 'photon.komoot.io')
  assert.equal(urls[0].searchParams.has('key'), false)
  assert.equal(urls[0].searchParams.get('limit'), '8')
  await call(handler, 'POST', { provider: 'photon', query: '武汉', language: 'en' })
  assert.equal(urls.length, 2)
  assert.equal(urls[1].searchParams.get('lang'), 'en')
})

test('Nominatim caches by query and language, rate limits across clients and follows a custom instance', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  let clock = 5000
  const requests = []
  const handler = createPlaceHandler({ env: {}, keyFile: join(dir, 'p.json'), now: () => clock,
    fetchImpl: async (url, init) => {
      assert.equal(url.origin, 'https://search.example.org')
      assert.equal(url.searchParams.has('tk'), false)
      assert.match(init.headers['User-Agent'], /DSH-Digital-Earth/)
      requests.push(url)
      return Response.json([osm])
    } })
  // A user-added Nominatim instance with its own service URL, exactly like a source row.
  await call(handler, 'PUT', { providers: [...providers(), { id: 'osm-mirror', name: 'OSM 镜像', type: 'nominatim', url: 'https://search.example.org/search', enabled: true }], selected: 'osm-mirror' })
  const q = { provider: 'osm-mirror', query: 'Wuhan', language: 'en' }
  assert.equal((await call(handler, 'POST', q)).status, 200)
  assert.equal((await call(handler, 'POST', q)).body.results.length, 1)
  assert.equal((await call(handler, 'POST', { ...q, language: 'zh' })).status, 429)
  clock += 1100
  assert.equal((await call(handler, 'POST', { ...q, language: 'zh' })).status, 200)
  assert.equal(requests.length, 2)
})

test('custom providers are added, renamed, re-pointed and removed without touching keys', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const keyFile = join(dir, 'p.json')
  const urls = []
  const handler = createPlaceHandler({ env: {}, keyFile, fetchImpl: async url => { urls.push(url); return Response.json(photon) } })
  // Key travels once, then the settings tab can rewrite the list without it.
  await call(handler, 'PUT', { keys: { tianditu: 'example-token' } })
  const added = (await call(handler, 'PUT', { providers: [...providers(), custom()] })).body
  assert.deepEqual(added.providers.at(-1), {
    id: 'photon-lan', name: '内网 Photon', type: 'photon', url: 'https://geo.lan/photon/',
    enabled: true, builtin: false, needsKey: false, configured: false, managed: false,
  })
  assert.equal(added.providers[0].configured, true, 'a list save keeps the stored key')
  const hit = await call(handler, 'POST', { provider: 'photon-lan', query: '武汉' })
  assert.equal(hit.status, 200)
  assert.equal(urls[0].origin, 'https://geo.lan')
  // Re-point it at another mirror.
  const moved = (await call(handler, 'PUT', { providers: [...providers(), custom({ url: 'https://geo2.lan/search' })] })).body
  assert.equal(moved.providers.at(-1).url, 'https://geo2.lan/search')
  await call(handler, 'POST', { provider: 'photon-lan', query: '武汉' })
  assert.equal(urls[1].origin, 'https://geo2.lan')
  // Removing it drops the selection and makes the id unknown to the host.
  const removed = (await call(handler, 'PUT', { providers: providers() })).body
  assert.equal(removed.providers.length, 4)
  assert.equal(removed.selected, '')
  assert.equal((await call(handler, 'POST', { provider: 'photon-lan', query: '武汉' })).status, 400)
  // Clearing a key needs an explicit empty string; the file is 0600 either way.
  const cleared = (await call(handler, 'PUT', { providers: providers({ tianditu: { key: '' } }) })).body
  assert.equal(cleared.providers[0].configured, false)
})

test('a v1.7.0 token file keeps working after the upgrade', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const keyFile = join(dir, 'place-search.json')
  await writeFile(keyFile, JSON.stringify({ token: 'legacy-token' }))
  const urls = []
  const handler = createPlaceHandler({ env: {}, keyFile, fetchImpl: async url => { urls.push(url); return Response.json({ ...ok, area }) } })
  assert.equal((await call(handler, 'GET')).body.providers[0].configured, true)
  assert.equal((await call(handler, 'POST', { query: '武汉' })).status, 200)
  assert.equal(urls[0].searchParams.get('tk'), 'legacy-token')
})

test('a selection of a disabled provider is reported as empty until it is enabled', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const keyFile = join(dir, 'p.json')
  const handler = createPlaceHandler({ env: {}, keyFile, fetchImpl: async () => Response.json(photon) })
  await call(handler, 'PUT', { selected: 'nominatim' })
  const saved = (await call(handler, 'GET')).body
  assert.equal(saved.selected, '', 'disabled provider is not the selection any more')
  assert.equal(saved.providers[3].enabled, false)
  await call(handler, 'PUT', { providers: providers({ nominatim: { enabled: true } }) })
  const back = (await call(handler, 'GET')).body
  assert.equal(back.selected, 'nominatim', 'enabling restores the stored choice')
  assert.equal(back.provider, 'nominatim')
})

test('only enabled providers answer, and turning them all off leaves none', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-places-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const urls = []
  const keyFile = join(dir, 'p.json')
  const handler = createPlaceHandler({ env: {}, keyFile, fetchImpl: async url => { urls.push(url); return Response.json(photon) } })
  // Disabled provider: rejected before any network call, with its own code.
  const off = await call(handler, 'PUT', { providers: providers({ photon: { enabled: false }, nominatim: { enabled: false } }) })
  assert.equal(off.status, 200)
  assert.equal((await call(handler, 'POST', { provider: 'photon', query: '武汉' })).status, 400)
  assert.equal((await call(handler, 'POST', { provider: 'photon', query: '武汉' })).body.error, 'disabled')
  assert.equal(urls.length, 0)
  // Enabling it is enough: no key needed, and the flag survives a restart.
  await call(handler, 'PUT', { providers: providers({ tianditu: { enabled: false }, amap: { enabled: false }, photon: { enabled: true } }), selected: 'photon' })
  assert.equal((await call(handler, 'POST', { query: '武汉' })).status, 200)
  assert.equal(urls[0].hostname, 'photon.komoot.io')
  const restarted = createPlaceHandler({ env: {}, keyFile, fetchImpl: async url => { urls.push(url); return Response.json(photon) } })
  const body = (await call(restarted, 'GET')).body
  assert.equal(body.providers[2].enabled, true)
  assert.equal(body.provider, 'photon')
  // Turning everything off leaves no provider; the panel must explain that, not guess.
  await call(restarted, 'PUT', {
    providers: providers({ tianditu: { enabled: false }, amap: { enabled: false } }),
    selected: 'photon',
  })
  const none = (await call(restarted, 'GET')).body
  assert.equal(none.provider, '')
  assert.equal(none.selected, '')
  assert.equal((await call(restarted, 'POST', { query: '武汉' })).body.error, 'disabled')
})
