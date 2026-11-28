import { readFile } from 'node:fs/promises'
import { PANEL_HEADER, PLACE_KEY_FILE } from './constants.js'
import { writeJsonAtomic } from './fs-util.js'
import { sendJson } from './http.js'

const limit = 8
const list = value => Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []
const label = value => typeof value === 'string' ? value.trim().slice(0, 400) : ''
const fail = (status, code) => Object.assign(new Error(code), { status, code })

function coords(parts, ranges) {
  if (!Array.isArray(parts) || parts.length !== ranges.length) return null
  const values = parts.map(value => (typeof value === 'number' || label(value)) ? Number(value) : NaN)
  return values.every((n, i) => Number.isFinite(n) && Math.abs(n) <= ranges[i]) ? values : null
}

function bounds(parts) {
  const values = coords(parts, [180, 90, 180, 90])
  if (!values) return null
  const [west, south, east, north] = values
  return east > west && north > south ? { west, south, east, north } : null
}

export function tiandituResults(data) {
  const status = String(list(data?.status)[0]?.infocode ?? '')
  if (status === '3001') return []
  if (status !== '1000') throw fail(502, 'provider')
  const rows = []
  for (const a of [...list(data.area), ...list(data.pois)]) {
    const point = coords(label(a?.lonlat).split(','), [180, 90])
    if (!point || !label(a.name)) continue
    const detail = [...new Set([a.province, a.city, a.county, a.address].map(label).filter(Boolean))].join(' · ')
    rows.push({ name: label(a.name), detail, lon: point[0], lat: point[1], bbox: bounds(label(a.bound).split(',')) })
  }
  if (!rows.length && Number(data.resultType) === 2) {
    const seen = new Set()
    for (const stats of list(data.statistics)) {
      for (const city of [...list(stats.priorityCitys), ...list(stats.allAdmins)]) {
        const region = String(city?.adminCode ?? '')
        if (!/^\d{9}$/.test(region) || !label(city.name) || seen.has(region)) continue
        seen.add(region)
        rows.push({ name: label(city.name), region })
      }
    }
  }
  return rows.slice(0, limit)
}

export function osmResults(data) {
  if (!Array.isArray(data)) throw fail(502, 'provider')
  const rows = []
  for (const place of data) {
    const point = coords([place?.lon, place?.lat], [180, 90])
    const display = label(place?.display_name)
    const name = label(place?.name) || display.split(',')[0]
    if (!point || !name) continue
    const [s, n, w, e] = Array.isArray(place.boundingbox) ? place.boundingbox : []
    const detail = display.startsWith(name + ',') ? display.slice(name.length + 1).trim() : display === name ? '' : display
    rows.push({ name, detail, lon: point[0], lat: point[1], bbox: bounds([w, s, e, n]) })
  }
  return rows.slice(0, limit)
}

async function readInput(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk)
    if (size > 4096) throw fail(413, 'input')
    chunks.push(Buffer.from(chunk))
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()) }
  catch { throw fail(400, 'input') }
}

export function createPlaceHandler({ fetchImpl = fetch, env = process.env, keyFile = PLACE_KEY_FILE, now = Date.now } = {}) {
  const cache = new Map()
  let nextOsm = 0
  let osmProxy
  async function getKey() {
    if (env.TIANDITU_TOKEN?.trim()) return env.TIANDITU_TOKEN.trim()
    try { return label(JSON.parse(await readFile(keyFile, 'utf8')).token) }
    catch (err) { if (err.code === 'ENOENT') return ''; throw err }
  }
  return async function places(req, res) {
    if (req.headers?.[PANEL_HEADER] !== '1') return sendJson(res, 403, { error: 'forbidden' })
    try {
      if (req.method === 'GET') return sendJson(res, 200, { configured: Boolean(await getKey()), managed: Boolean(env.TIANDITU_TOKEN?.trim()) })
      if (!['POST', 'PUT'].includes(req.method)) throw fail(405, 'method')
      const body = await readInput(req)
      if (req.method === 'PUT') {
        const token = body?.token
        if (env.TIANDITU_TOKEN?.trim() || typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(token)) throw fail(400, 'input')
        await writeJsonAtomic(keyFile, { token }, { mode: 0o600 })
        return sendJson(res, 200, { configured: true })
      }
      const query = typeof body?.query === 'string' ? body.query.trim() : ''
      const { provider, region } = body ?? {}
      if (!query || query.length > 160 || !['tianditu', 'osm'].includes(provider) || (region != null && (provider !== 'tianditu' || !/^\d{9}$/.test(String(region))))) throw fail(400, 'input')
      const language = body.language === 'zh' ? 'zh' : 'en'
      let url, cacheKey
      if (provider === 'tianditu') {
        const token = await getKey()
        if (!token) throw fail(409, 'key')
        url = new URL('https://api.tianditu.gov.cn/v2/search')
        const scope = region ? { queryType: 12, specify: String(region) } : { queryType: 1, level: 12, mapBound: '-180,-90,180,90' }
        url.search = new URLSearchParams({ postStr: JSON.stringify({ keyWord: query, ...scope, start: 0, count: limit }), type: 'query', tk: token })
      } else {
        url = new URL(env.DSH_NOMINATIM_SEARCH_URL || 'https://nominatim.openstreetmap.org/search')
        url.searchParams.set('q', query)
        url.searchParams.set('format', 'jsonv2')
        url.searchParams.set('limit', String(limit))
        url.searchParams.set('accept-language', language)
        cacheKey = url.href
        const hit = cache.get(cacheKey)
        if (hit && hit.expires > now()) return sendJson(res, 200, { results: hit.rows })
        if (now() < nextOsm) throw fail(429, 'rate')
        nextOsm = now() + 1100
      }
      // Domestic requests go directly to Tianditu. Overseas lookups respect the desktop proxy and NO_PROXY.
      const proxyEnabled = provider === 'osm' && (env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY)
      if (proxyEnabled && !osmProxy) {
        // DSH Desktop supplies undici. Standalone hosts can use Node's native fetch transport.
        osmProxy = import('undici').then(({ EnvHttpProxyAgent }) => new EnvHttpProxyAgent()).catch(() => undefined)
      }
      const response = await fetchImpl(url, { ...(proxyEnabled && { dispatcher: await osmProxy }), headers: { 'User-Agent': 'DSH-Digital-Earth (+https://github.com/CVEO/dsh-digital-earth)', Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(12000) })
      if (response.status === 429) throw fail(429, 'rate')
      if (provider === 'tianditu' && [401, 403].includes(response.status)) throw fail(403, 'denied')
      if (provider === 'tianditu' && response.status === 400) throw fail(400, 'rejected')
      if (!response.ok) throw fail(502, 'provider')
      const data = await response.json()
      const rows = provider === 'osm' ? osmResults(data) : tiandituResults(data)
      if (cacheKey) {
        cache.set(cacheKey, { rows, expires: now() + 86400000 })
        if (cache.size > 256) cache.delete(cache.keys().next().value)
      }
      return sendJson(res, 200, { results: rows })
    } catch (err) {
      return sendJson(res, err.status || 502, { error: err.status ? err.code : 'provider' })
    }
  }
}
