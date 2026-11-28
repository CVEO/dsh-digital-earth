import { readFile } from 'node:fs/promises'
import { PANEL_HEADER, PLACE_KEY_FILE } from './constants.js'
import { writeJsonAtomic } from './fs-util.js'
import { sendJson } from './http.js'

/**
 * Host-side place search for the digital earth panel.
 *
 * The panel never talks to a geocoding service directly: it posts one query and
 * the host resolves it with a configured provider, which keeps service keys in
 * the host state directory and avoids browser CORS.
 *
 * A provider is one configured instance of one of four adapter types; the user
 * manages the list in 设置 → 地名检索 exactly like an imagery or terrain source
 * list (name, service URL, key, enable switch, plus custom instances such as a
 * self-hosted Photon or a Nominatim mirror):
 *
 *   - tianditu  中文地名/行政区/POI，需要服务端 tk（`TIANDITU_TOKEN` 可托管）
 *   - amap      地址与 POI，需要「Web 服务」key
 *   - photon    OpenStreetMap 索引，无需密钥（可指向自建实例）
 *   - nominatim OpenStreetMap 官方公共实例，无需密钥，遵守其公共实例使用政策
 *
 * Every adapter returns the same result shape `{name, detail, lon, lat, bbox?,
 * region?}`. Photon and Nominatim ship disabled and only enabled providers are
 * queried or offered. Service availability and terms belong to the provider, not
 * to this plugin. Providers, keys and the selection live in `place-search.json`
 * (mode 0600).
 */

const limit = 8
/** Adapter implementations. A provider entry is one instance of one of these. */
export const PLACE_TYPES = Object.freeze(['tianditu', 'amap', 'photon', 'nominatim'])
const NEEDS_KEY = new Set(['tianditu', 'amap'])
const DEFAULT_URL = Object.freeze({
  tianditu: 'https://api.tianditu.gov.cn/v2/search',
  amap: 'https://restapi.amap.com/v3/place/text',
  photon: 'https://photon.komoot.io/api/',
  nominatim: 'https://nominatim.openstreetmap.org/search',
})
/** Key-based providers are on by default; the keyless OSM ones are opt-in. */
export const DEFAULT_ENABLED = Object.freeze({ tianditu: true, amap: true, photon: false, nominatim: false })
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/
const CONFIG_VERSION = 4
const MAX_PROVIDERS = 12
const USER_AGENT = 'DSH-Digital-Earth (+https://github.com/CVEO/dsh-digital-earth)'

const list = value => Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []
const label = value => typeof value === 'string' ? value.trim().slice(0, 400) : ''
const fail = (status, code) => Object.assign(new Error(code), { status, code })
const unique = parts => [...new Set(parts.map(label).filter(Boolean))].join(' · ')
const isBuiltinId = id => PLACE_TYPES.includes(id)

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
    rows.push({ name: label(a.name), detail: unique([a.province, a.city, a.county, a.address]), lon: point[0], lat: point[1], bbox: bounds(label(a.bound).split(',')) })
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

/** Amap 地址/POI 检索：`status:"1"` 为成功，`status:"0"` 的业务码由 info 区分。 */
export function amapResults(data) {
  if (!data || String(data.status) !== '1') {
    const info = String(data?.info ?? '')
    if (/KEY|SIGNATURE|USER/i.test(info)) throw fail(403, 'denied')
    if (/LIMIT|QUOTA|QPS/i.test(info)) throw fail(429, 'rate')
    throw fail(502, 'provider')
  }
  const rows = []
  for (const poi of list(data.pois)) {
    const point = coords(label(poi?.location).split(','), [180, 90])
    if (!point || !label(poi.name)) continue
    rows.push({ name: label(poi.name), detail: unique([poi.pname, poi.cityname, poi.adname, poi.address]), lon: point[0], lat: point[1] })
  }
  return rows.slice(0, limit)
}

/** Photon：GeoJSON FeatureCollection，`extent` 顺序是 [west, north, east, south]。 */
export function photonResults(data) {
  if (!Array.isArray(data?.features)) throw fail(502, 'provider')
  const rows = []
  for (const feature of data.features) {
    const props = feature?.properties ?? {}
    const point = coords(feature?.geometry?.coordinates, [180, 90])
    const name = label(props.name) || label(props.street) || label(props.city)
    if (!point || !name) continue
    const [west, north, east, south] = Array.isArray(props.extent) ? props.extent : []
    const detail = unique([props.street, props.district, props.city, props.state, props.country].filter(part => label(part) !== name))
    rows.push({ name, detail, lon: point[0], lat: point[1], bbox: bounds([west, south, east, north]) })
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
    if (size > 8192) throw fail(413, 'input')
    chunks.push(Buffer.from(chunk))
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()) }
  catch { throw fail(400, 'input') }
}

/** A service URL we are willing to store and call: absolute http(s), no template junk. */
function serviceUrl(value) {
  const text = label(value)
  if (text.length < 8) return ''
  try {
    const url = new URL(text)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.search.includes('{') ? url.href : ''
  } catch { return '' }
}

const builtinProvider = (type, { enabled, url, key } = {}) => ({
  id: type,
  name: '',
  type,
  url: serviceUrl(url) || DEFAULT_URL[type],
  enabled: typeof enabled === 'boolean' ? enabled : DEFAULT_ENABLED[type],
  ...(key ? { key } : {}),
})

/** Normalize one stored entry; returns null when it is not storable at all. */
function normalizeProvider(entry, seen = new Set()) {
  if (!entry || typeof entry !== 'object') return null
  const id = label(entry.id)
  const type = label(entry.type)
  if (!ID_PATTERN.test(id) || seen.has(id) || !PLACE_TYPES.includes(type)) return null
  if (isBuiltinId(id) && id !== type) return null
  const name = label(entry.name).slice(0, 120)
  if (!isBuiltinId(id) && !name) return null
  const url = serviceUrl(entry.url) || DEFAULT_URL[type]
  const key = label(entry.key)
  return {
    id,
    name,
    type,
    url,
    enabled: entry.enabled !== false,
    ...(NEEDS_KEY.has(type) && key && TOKEN_PATTERN.test(key) ? { key } : {}),
  }
}

/**
 * Normalize a stored config. Older files are migrated on read:
 *   v1 `{token}` → v2 `{provider, keys}` → v3 `{provider, keys, enabled}` → v4
 * `{version, selected, providers}`. Built-in providers always exist; custom ones
 * are kept in file order. `env` only seeds the built-in service URLs of a legacy
 * file, so `DSH_PHOTON_SEARCH_URL` / `DSH_NOMINATIM_SEARCH_URL` keep working.
 */
export function normalizePlaceConfig(raw, env = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const legacyKeys = source.keys && typeof source.keys === 'object' ? source.keys : {}
  const enabledMap = source.enabled && typeof source.enabled === 'object' ? source.enabled : {}
  const stored = Array.isArray(source.providers) ? source.providers.filter((entry) => entry && typeof entry === 'object') : null
  const providers = []
  const seen = new Set()
  for (const type of PLACE_TYPES) {
    const found = stored?.find((entry) => label(entry.id) === type && label(entry.type) === type)
    const key = label(found?.key) || label(type === 'tianditu' ? legacyKeys.tianditu ?? source.token : legacyKeys[type])
    const valid = key && TOKEN_PATTERN.test(key) ? key : ''
    const seeded = found
      ? normalizeProvider({ ...found, key: valid }, seen)
      : builtinProvider(type, {
          enabled: enabledMap[type],
          url: label(env[type === 'photon' ? 'DSH_PHOTON_SEARCH_URL' : type === 'nominatim' ? 'DSH_NOMINATIM_SEARCH_URL' : '']),
          key: valid,
        })
    if (!seeded) continue
    seen.add(type)
    providers.push(seeded)
  }
  for (const entry of stored ?? []) {
    if (isBuiltinId(label(entry.id))) continue
    const extra = normalizeProvider(entry, seen)
    if (!extra || providers.length >= MAX_PROVIDERS) continue
    seen.add(extra.id)
    providers.push(extra)
  }
  const selected = label(source.selected ?? source.provider)
  return {
    version: CONFIG_VERSION,
    selected: providers.some((entry) => entry.id === selected) ? selected : '',
    providers,
  }
}

/**
 * Validate a provider list coming from the settings tab. Keys are handled apart
 * (the panel never receives them back), so this only checks the editable fields.
 */
export function validateProviders(entries) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_PROVIDERS) throw fail(400, 'input')
  const seen = new Set()
  const out = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') throw fail(400, 'input')
    const id = label(entry.id)
    const type = label(entry.type)
    if (!ID_PATTERN.test(id) || seen.has(id) || !PLACE_TYPES.includes(type)) throw fail(400, 'input')
    if (isBuiltinId(id) && id !== type) throw fail(400, 'input')
    const name = label(entry.name).slice(0, 120)
    if (!isBuiltinId(id) && !name) throw fail(400, 'input')
    const url = serviceUrl(entry.url)
    if (!url) throw fail(400, 'input')
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') throw fail(400, 'input')
    seen.add(id)
    out.push({ id, name, type, url, enabled: entry.enabled !== false })
  }
  for (const type of PLACE_TYPES) if (!seen.has(type)) throw fail(400, 'input')
  return out
}

export function createPlaceHandler({ fetchImpl = fetch, env = process.env, keyFile = PLACE_KEY_FILE, now = Date.now } = {}) {
  const cache = new Map()
  let nextNominatim = 0
  let proxyAgent
  const managedToken = label(env.TIANDITU_TOKEN)
  const keyOf = (entry) => (entry.id === 'tianditu' && managedToken ? managedToken : entry.key ?? '')

  async function readConfig() {
    try { return normalizePlaceConfig(JSON.parse(await readFile(keyFile, 'utf8')), env) }
    catch (err) { if (err.code === 'ENOENT') return normalizePlaceConfig(null, env); throw err }
  }

  /** Selected provider while it is enabled, else a keyed one, else the first enabled. */
  function defaultProvider(config) {
    const enabled = config.providers.filter((entry) => entry.enabled)
    if (config.selected && enabled.some((entry) => entry.id === config.selected)) return config.selected
    const keyed = enabled.find((entry) => NEEDS_KEY.has(entry.type) && keyOf(entry))
    return keyed?.id ?? enabled[0]?.id ?? ''
  }

  function describe(config) {
    return {
      version: CONFIG_VERSION,
      // A choice only counts while its provider is enabled, so the panel can show
      // the usable default instead of one it cannot query.
      selected: config.selected && config.providers.some((entry) => entry.id === config.selected && entry.enabled) ? config.selected : '',
      provider: defaultProvider(config),
      providers: config.providers.map((entry) => ({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        url: entry.url,
        enabled: entry.enabled,
        builtin: entry.id === entry.type,
        needsKey: NEEDS_KEY.has(entry.type),
        configured: Boolean(keyOf(entry)),
        managed: entry.id === 'tianditu' && Boolean(managedToken),
      })),
    }
  }

  async function proxyDispatcher(type) {
    const useProxy = (type === 'photon' || type === 'nominatim')
      && (env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY)
    if (!useProxy) return undefined
    if (!proxyAgent) {
      // DSH Desktop supplies undici. Standalone hosts can use Node's native fetch transport.
      proxyAgent = import('undici').then(({ EnvHttpProxyAgent }) => new EnvHttpProxyAgent()).catch(() => undefined)
    }
    return proxyAgent
  }

  function requestUrl(entry, query, region, language) {
    let url
    try { url = new URL(entry.url) } catch { throw fail(502, 'provider') }
    const cacheParts = [entry.id, entry.url, query, region ?? '', language]
    if (entry.type === 'tianditu') {
      const token = keyOf(entry)
      if (!token) throw fail(409, 'key')
      const scope = region ? { queryType: 12, specify: region } : { queryType: 1, level: 12, mapBound: '-180,-90,180,90' }
      url.search = new URLSearchParams({ postStr: JSON.stringify({ keyWord: query, ...scope, start: 0, count: limit }), type: 'query', tk: token })
      return { url, cacheKey: cacheParts.join('|'), parse: tiandituResults }
    }
    if (entry.type === 'amap') {
      const token = keyOf(entry)
      if (!token) throw fail(409, 'key')
      const params = { keywords: query, offset: String(limit), page: '1', extensions: 'base', key: token }
      if (region) params.city = region
      url.search = new URLSearchParams(params)
      return { url, cacheKey: cacheParts.join('|'), parse: amapResults }
    }
    if (entry.type === 'photon') {
      url.searchParams.set('q', query)
      url.searchParams.set('limit', String(limit))
      if (language === 'en') url.searchParams.set('lang', 'en')
      return { url, cacheKey: [cacheParts.join('|'), url.href].join('|'), parse: photonResults }
    }
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('accept-language', language)
    return { url, cacheKey: url.href, parse: osmResults }
  }

  return async function places(req, res) {
    if (req.headers?.[PANEL_HEADER] !== '1') return sendJson(res, 403, { error: 'forbidden' })
    try {
      if (req.method === 'GET') return sendJson(res, 200, describe(await readConfig()))
      if (!['POST', 'PUT'].includes(req.method)) throw fail(405, 'method')
      const body = await readInput(req)

      if (req.method === 'PUT') {
        const current = await readConfig()
        const next = { version: CONFIG_VERSION, selected: current.selected, providers: current.providers }
        let changed = false
        if (body?.providers !== undefined) {
          // Keys never travel with the list: keep the stored one per id unless the
          // panel explicitly sends a replacement or an empty string.
          const incoming = validateProviders(body.providers)
          next.providers = incoming.map((entry) => {
            const previous = current.providers.find((item) => item.id === entry.id)
            const raw = body.providers.find((item) => label(item?.id) === entry.id)
            const key = raw?.key
            if (key === undefined) return previous?.key && NEEDS_KEY.has(entry.type) ? { ...entry, key: previous.key } : entry
            if (managedToken && entry.id === 'tianditu') throw fail(400, 'managed')
            const text = label(key)
            if (!text) return entry
            if (!TOKEN_PATTERN.test(text)) throw fail(400, 'input')
            return { ...entry, key: text }
          })
          changed = true
        }
        if (body?.selected !== undefined) {
          const id = label(body.selected)
          if (id !== '' && !next.providers.some((entry) => entry.id === id)) throw fail(400, 'input')
          next.selected = id
          changed = true
        }
        const incomingKeys = body?.keys && typeof body.keys === 'object' ? body.keys : null
        if (incomingKeys) {
          for (const [id, value] of Object.entries(incomingKeys)) {
            const index = next.providers.findIndex((entry) => entry.id === id)
            if (index < 0) throw fail(400, 'input')
            if (managedToken && id === 'tianditu') throw fail(400, 'managed')
            const text = label(value)
            const entry = { ...next.providers[index] }
            if (!text) delete entry.key
            else if (!TOKEN_PATTERN.test(text)) throw fail(400, 'input')
            else entry.key = text
            next.providers[index] = entry
            changed = true
          }
        }
        if (!changed) throw fail(400, 'input')
        await writeJsonAtomic(keyFile, next, { mode: 0o600 })
        return sendJson(res, 200, describe(next))
      }

      const query = typeof body?.query === 'string' ? body.query.trim() : ''
      if (!query || query.length > 160) throw fail(400, 'input')
      const language = body.language === 'zh' ? 'zh' : 'en'
      const config = await readConfig()
      const wanted = body?.provider === undefined || body?.provider === '' ? '' : label(body.provider)
      if (wanted && !config.providers.some((entry) => entry.id === wanted)) throw fail(400, 'input')
      const resolved = wanted || defaultProvider(config)
      const entry = config.providers.find((item) => item.id === resolved)
      // Only enabled providers are queried; the panel also filters its list, so
      // this is the guard for a stale client or a hand-written request.
      if (!entry || !entry.enabled) throw fail(400, 'disabled')
      // Region refine is adapter specific: Tianditu takes a 9-digit adcode, Amap a 6-digit city code.
      const regionText = body.region == null || body.region === '' ? null : String(body.region)
      if (regionText && !(entry.type === 'tianditu' ? /^\d{9}$/.test(regionText) : entry.type === 'amap' ? /^\d{6}$/.test(regionText) : false)) throw fail(400, 'input')
      const { url, cacheKey, parse } = requestUrl(entry, query, regionText, language)
      const hit = cache.get(cacheKey)
      if (hit && hit.expires > now()) return sendJson(res, 200, { results: hit.rows })
      if (entry.type === 'nominatim') {
        if (now() < nextNominatim) throw fail(429, 'rate')
        nextNominatim = now() + 1100
      }
      const proxy = await proxyDispatcher(entry.type)
      const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json' }
      const response = await fetchImpl(url, { ...(proxy && { dispatcher: proxy }), headers, redirect: 'error', signal: AbortSignal.timeout(12000) })
      if (response.status === 429) throw fail(429, 'rate')
      if (NEEDS_KEY.has(entry.type) && [401, 403].includes(response.status)) throw fail(403, 'denied')
      if (NEEDS_KEY.has(entry.type) && response.status === 400) throw fail(400, 'rejected')
      if (!response.ok) throw fail(502, 'provider')
      const rows = parse(await response.json())
      cache.set(cacheKey, { rows, expires: now() + 86400000 })
      if (cache.size > 256) cache.delete(cache.keys().next().value)
      return sendJson(res, 200, { results: rows })
    } catch (err) {
      return sendJson(res, err.status || 502, { error: err.status ? err.code : 'provider' })
    }
  }
}
