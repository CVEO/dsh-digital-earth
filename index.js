/**
 * Host half of the 3D viewer plugin.
 *
 * Owns everything the browser must not decide on its own:
 * - a per-process token, so only this UI page can read local files;
 * - same-origin static routes for the vendored CesiumJS build and for the
 *   tileset files under a directory the user picked in the browser;
 * - a directory scan for `tileset.json` and a small CORS-bypass proxy for
 *   online tilesets whose server does not send CORS headers.
 */
import { randomBytes } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url))
const CESIUM_DIR = join(ROOT_DIR, 'vendor', 'cesium')
const TOKEN = randomBytes(12).toString('base64url')
const API = '/api/3dviewer'
// Prefix routes are registered without the trailing slash: the router matches
// `pathname === prefix || pathname.startsWith(prefix + '/')`.
const CESIUM_ROUTE = `${API}/cesium`
const TILES_ROUTE = `${API}/tiles`
const REMOTE_ROUTE = `${API}/remote`
const SOURCES_ROUTE = `${API}/sources`
const MAX_SCAN_ITEMS = 200
const MAX_SCAN_DEPTH = 4
// The source catalog is small JSON owned by this plugin; keep it outside the
// browser so it survives port changes (localStorage is per-origin) and restarts.
const STATE_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'digital-earth')
const SOURCES_FILE = join(STATE_DIR, 'sources.json')
const MAX_SOURCES_BODY = 128 * 1024
const MAX_IMAGERY_SOURCES = 20
const MAX_TERRAIN_SOURCES = 10
const IMAGERY_TYPES = new Set(['xyz', 'arcgis', 'wms'])
const TERRAIN_TYPES = new Set(['arcgis', 'cesium'])
const THEME_MODES = new Set(['auto', 'light', 'dark'])

/**
 * Built-in catalogs, used for a first run and for the "restore defaults"
 * action. Names are brand names rather than translated UI copy, so the same
 * value reads correctly in both locales.
 */
const DEFAULT_SOURCES = {
  imagery: [
    {
      id: 'esri-world-imagery',
      name: 'Esri World Imagery',
      type: 'xyz',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
      credit: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
    {
      id: 'esri-world-topo',
      name: 'Esri World Topographic',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
      credit: 'Esri, HERE, Garmin, FAO, NOAA, USGS, and the GIS User Community',
    },
    {
      id: 'esri-world-street',
      name: 'Esri World Street Map',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer',
      credit: 'Esri, HERE, Garmin, USGS, NGA, and the GIS User Community',
    },
    {
      id: 'esri-light-gray',
      name: 'Esri Light Gray Canvas',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer',
      credit: 'Esri, HERE, Garmin, and the GIS User Community',
    },
    {
      id: 'esri-shaded-relief',
      name: 'Esri World Shaded Relief',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer',
      credit: 'Esri, and the GIS User Community',
    },
    {
      id: 'esri-world-ocean',
      name: 'Esri World Ocean',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer',
      credit: 'Esri, GEBCO, NOAA, and the GIS User Community',
    },
    {
      id: 'esri-world-hillshade',
      name: 'Esri World Hillshade',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer',
      credit: 'Esri, USGS, and the GIS User Community',
    },
  ],
  terrain: [
    {
      id: 'arcgis-world-elevation',
      name: 'ArcGIS WorldElevation3D',
      type: 'arcgis',
      url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
      credit: 'Esri, CGIAR, USGS',
    },
  ],
  settings: { theme: 'auto', imagery: 'esri-world-imagery', terrain: null },
}

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
  '.wasm': 'application/wasm',
  '.terrain': 'application/octet-stream',
  '.b3dm': 'application/octet-stream',
  '.pnts': 'application/octet-stream',
  '.i3dm': 'application/octet-stream',
  '.cmpt': 'application/octet-stream',
  '.spz': 'application/octet-stream',
}

const toB64 = (value) => Buffer.from(value, 'utf8').toString('base64url')
const fromB64 = (value) => Buffer.from(value, 'base64url').toString('utf8')
const segments = (value) => value.split('/').filter((part) => part.length > 0)
const decodeSegment = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(text)
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(data))
}

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_SOURCES))

const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/**
 * Accept only absolute http(s) URLs. Imagery templates legitimately contain
 * placeholders such as `{z}` or `{s}`, so those are neutralised before parsing
 * and the original text is what gets stored.
 */
function cleanUrl(value) {
  const text = cleanText(value, 2048)
  if (text === '') return ''
  try {
    const parsed = new URL(text.replace(/\{[^}]*\}/g, '0'))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? text : ''
  } catch {
    return ''
  }
}

function cleanId(value, fallback) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(text) ? text : fallback
}

function cleanLevel(value) {
  return Number.isInteger(value) && value >= 0 && value <= 25 ? value : undefined
}

function normalizeSource(kind, raw, index) {
  if (raw === null || typeof raw !== 'object') return null
  const type = cleanText(raw.type, 16).toLowerCase()
  if (!(kind === 'imagery' ? IMAGERY_TYPES : TERRAIN_TYPES).has(type)) return null
  const url = cleanUrl(raw.url)
  if (url === '') return null
  const source = {
    id: cleanId(raw.id, `${kind}-${index + 1}`),
    name: cleanText(raw.name, 60) || `${kind} ${index + 1}`,
    type,
    url,
  }
  const credit = cleanText(raw.credit, 200)
  if (credit !== '') source.credit = credit
  if (kind === 'imagery') {
    const maximumLevel = cleanLevel(raw.maximumLevel)
    if (maximumLevel !== undefined) source.maximumLevel = maximumLevel
    if (raw.tilingScheme === 'geographic' || raw.tilingScheme === 'web-mercator') source.tilingScheme = raw.tilingScheme
    if (raw.reverseY === true) source.reverseY = true
    const subdomains = Array.isArray(raw.subdomains)
      ? raw.subdomains.map((item) => cleanText(item, 8)).filter((item) => item !== '').slice(0, 8)
      : []
    if (subdomains.length > 0) source.subdomains = subdomains
    const layers = cleanText(raw.layers, 200)
    if (layers !== '') source.layers = layers
  } else {
    if (raw.requestVertexNormals === true) source.requestVertexNormals = true
    if (raw.requestWaterMask === true) source.requestWaterMask = true
  }
  return source
}

function normalizeSourceList(kind, raw, fallback) {
  if (!Array.isArray(raw)) return fallback.map((source) => ({ ...source }))
  const limit = kind === 'imagery' ? MAX_IMAGERY_SOURCES : MAX_TERRAIN_SOURCES
  const seen = new Set()
  const sources = []
  for (const [index, item] of raw.slice(0, limit).entries()) {
    const source = normalizeSource(kind, item, index)
    if (source === null) continue
    while (seen.has(source.id)) source.id = `${source.id}-${sources.length + 1}`
    seen.add(source.id)
    sources.push(source)
  }
  return sources
}

/** Pick a stored selection id, but only when it still exists in the list. */
function cleanSelection(value, sources) {
  if (typeof value !== 'string') return null
  return sources.some((source) => source.id === value) ? value : null
}

/** Append built-in presets that the user has not seen yet (id-based, keeps order). */
function withBuiltins(list, builtins, limit) {
  const seen = new Set(list.map((source) => source.id))
  const merged = [...list]
  for (const source of builtins) {
    if (merged.length >= limit) break
    if (seen.has(source.id)) continue
    merged.push({ ...source })
  }
  return merged
}

/** Turn arbitrary request JSON into the catalog persisted on disk. */
function normalizeConfig(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const theme = THEME_MODES.has(input.settings?.theme) ? input.settings.theme : 'auto'
  const imagery = withBuiltins(
    normalizeSourceList('imagery', input.imagery, DEFAULT_SOURCES.imagery),
    DEFAULT_SOURCES.imagery,
    MAX_IMAGERY_SOURCES,
  )
  const terrain = withBuiltins(
    normalizeSourceList('terrain', input.terrain, DEFAULT_SOURCES.terrain),
    DEFAULT_SOURCES.terrain,
    MAX_TERRAIN_SOURCES,
  )
  // A missing selection (older file, first run) falls back to the default choice;
  // an explicit `null` means "basemap/terrain deliberately off" and is preserved.
  const selection = (value, list, fallback) =>
    value === undefined ? cleanSelection(fallback, list) : cleanSelection(value, list)
  return {
    imagery,
    terrain,
    settings: {
      theme,
      imagery: selection(input.settings?.imagery, imagery, DEFAULT_SOURCES.settings.imagery),
      terrain: selection(input.settings?.terrain, terrain, DEFAULT_SOURCES.settings.terrain),
    },
  }
}

async function readSources() {
  let text
  try {
    text = await fs.readFile(SOURCES_FILE, 'utf8')
  } catch {
    return cloneDefaults()
  }
  try {
    return normalizeConfig(JSON.parse(text))
  } catch {
    return cloneDefaults()
  }
}

async function writeSources(config) {
  await fs.mkdir(STATE_DIR, { recursive: true })
  const temporary = `${SOURCES_FILE}.tmp`
  await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  await fs.rename(temporary, SOURCES_FILE)
}

/** Hosts the proxy must never reach: loopback, private ranges and link-local. */
function blockedHost(origin) {
  let hostname
  try {
    hostname = new URL(origin).hostname.toLowerCase()
  } catch {
    return true
  }
  if (hostname.startsWith('[')) return true
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
}

function within(root, target) {
  const prefix = root.endsWith(sep) ? root : root + sep
  return target === root || target.startsWith(prefix)
}

/** Percent-encoded pathname of a request; the router hands route handlers only (req, res). */
function requestPath(req) {
  try {
    return new URL(req.url ?? '/', 'http://localhost').pathname
  } catch {
    return '/'
  }
}

/** The raw path below a prefix route, or `null` when the request is not below it. */
function subPath(pathname, prefix) {
  if (pathname === prefix) return ''
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length + 1)
  return null
}

async function serveFile(req, res, root, relPath, cacheControl) {
  if (relPath === '') return sendText(res, 404, 'not found')
  const target = resolve(root, relPath)
  if (!within(root, target)) return sendText(res, 403, 'forbidden')
  let stat
  try {
    stat = await fs.stat(target)
  } catch {
    return sendText(res, 404, 'not found')
  }
  if (!stat.isFile()) return sendText(res, 404, 'not found')
  res.writeHead(200, {
    'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'content-length': String(stat.size),
    'cache-control': cacheControl,
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(target)
    .on('error', () => res.destroy())
    .pipe(res)
}

function metaHandler(req, res) {
  sendJson(res, 200, {
    token: TOKEN,
    cesiumBase: `${API}/cesium/`,
    tilesBase: `${API}/tiles/${TOKEN}/`,
    scanUrl: `${API}/scan`,
    remoteBase: `${API}/remote/${TOKEN}/`,
    sourcesUrl: `${SOURCES_ROUTE}/${TOKEN}`,
  })
}

/** GET: the current catalog plus the built-ins the UI can restore. */
async function sourcesHandler(req, res) {
  sendJson(res, 200, { config: await readSources(), defaults: cloneDefaults() })
}

/** PUT: replace the catalog, normalised so a malformed entry cannot reach Cesium. */
async function saveSourcesHandler(req, res) {
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_SOURCES_BODY) {
        req.destroy()
        return sendText(res, 413, 'payload too large')
      }
    }
  } catch {
    return sendText(res, 400, 'bad request')
  }
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return sendText(res, 400, 'invalid json')
  }
  const config = normalizeConfig(parsed)
  try {
    await writeSources(config)
  } catch (error) {
    return sendText(res, 500, `save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  sendJson(res, 200, { config })
}

function cesiumHandler(req, res) {
  const raw = subPath(requestPath(req), CESIUM_ROUTE)
  if (raw === null || raw === '') return sendText(res, 404, 'not found')
  const relPath = decodeSegment(raw)
  if (relPath === null) return sendText(res, 400, 'bad path')
  serveFile(req, res, resolve(CESIUM_DIR), relPath, 'public, max-age=86400')
}

function tilesHandler(req, res, allowedDirs) {
  const raw = subPath(requestPath(req), TILES_ROUTE)
  if (raw === null) return sendText(res, 403, 'forbidden')
  const parts = segments(raw)
  if (parts[0] !== TOKEN || parts.length < 2) return sendText(res, 403, 'forbidden')
  const dir = fromB64(parts[1])
  // Only absolute Windows or POSIX directories, and only ones the user opened.
  if (!/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(dir) || !allowedDirs.has(resolve(dir))) {
    return sendText(res, 403, 'forbidden')
  }
  const relParts = []
  for (const part of parts.slice(2)) {
    const decoded = decodeSegment(part)
    if (decoded === null || decoded.includes('\0') || decoded === '..') {
      return sendText(res, 403, 'forbidden')
    }
    relParts.push(decoded)
  }
  serveFile(req, res, resolve(dir), relParts.join(sep), 'public, max-age=60')
}

async function scanHandler(req, res, allowedDirs) {
  let parsed
  try {
    parsed = new URL(req.url, 'http://localhost')
  } catch {
    return sendText(res, 400, 'bad request')
  }
  const dir = parsed.searchParams.get('dir')
  if (parsed.searchParams.get('token') !== TOKEN || !dir) return sendText(res, 403, 'forbidden')
  allowedDirs.add(resolve(dir))
  const files = await findTilesets(dir)
  const items = files.map((file) => {
    const rel = file
      .slice(dir.length)
      .replace(/^[\\/]+/, '')
      .split(/[\\/]/)
      .map(encodeURIComponent)
      .join('/')
    return {
      name: file.slice(dir.length).replace(/^[\\/]+/, ''),
      url: `${API}/tiles/${TOKEN}/${encodeURIComponent(toB64(dir))}/${rel}`,
    }
  })
  sendJson(res, 200, { items })
}

async function findTilesets(dir) {
  const found = []
  async function walk(current, depth) {
    if (found.length >= MAX_SCAN_ITEMS) return
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (found.length >= MAX_SCAN_ITEMS) return
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        if (depth < MAX_SCAN_DEPTH) await walk(full, depth + 1)
      } else if (entry.name.toLowerCase() === 'tileset.json') {
        found.push(full)
      }
    }
  }
  await walk(dir, 0)
  return found
}

async function remoteHandler(req, res) {
  const raw = subPath(requestPath(req), REMOTE_ROUTE)
  if (raw === null) return sendText(res, 403, 'forbidden')
  const parts = segments(raw)
  if (parts[0] !== TOKEN || parts.length < 2) return sendText(res, 403, 'forbidden')
  const origin = fromB64(parts[1])
  if (!/^https?:\/\/[^/]+$/i.test(origin) || blockedHost(origin)) return sendText(res, 403, 'forbidden')
  const relParts = []
  for (const part of parts.slice(2)) {
    const decoded = decodeSegment(part)
    if (decoded === null || decoded.includes('\0')) return sendText(res, 403, 'forbidden')
    relParts.push(decoded)
  }
  const target = `${origin}/${relParts.join('/')}`
  try {
    const upstream = await fetch(target, { redirect: 'follow' })
    if (!upstream.ok || upstream.body === null) {
      return sendText(res, upstream.status === 200 ? 502 : upstream.status, `upstream ${upstream.status}`)
    }
    res.writeHead(200, {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    Readable.fromWeb(upstream.body).pipe(res)
  } catch (error) {
    sendText(res, 502, `proxy failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export const inject = ['webServer', 'connection']

export function apply(ctx) {
  // Directories this page opened through `/scan`; tile files are served only from
  // them, so a token holder cannot read arbitrary paths on the machine.
  const allowedDirs = new Set()

  // The host web server has no auth or origin policy of its own, so every route
  // below asks the DSH Connection service to reject foreign or unauthenticated
  // requests, and fails closed whenever that answer is doubtful.
  const rejection = (req) => {
    const headers = req.headers ?? {}
    const site = headers['sec-fetch-site']
    if (site === 'cross-site') return 403
    const origin = headers.origin
    if (typeof origin === 'string' && origin !== 'null' && headers.host) {
      try {
        if (new URL(origin).host !== headers.host) return 403
      } catch {
        return 403
      }
    }
    let connection
    try {
      connection = ctx.get('connection') ?? ctx.connection
    } catch {
      connection = null
    }
    if (connection && typeof connection.requestRejection === 'function') {
      try {
        const code = connection.requestRejection(req)
        return code === undefined || code === null || code === false ? undefined : typeof code === 'number' ? code : 403
      } catch {
        return 403
      }
    }
    // Older hosts without that fence: only this page's own requests may pass.
    return site === 'same-origin' || site === 'none' ? undefined : 403
  }

  const register = (kind, path, handler) =>
    ctx.webServer.register({
      kind,
      path,
      handler(req, res) {
        const code = rejection(req)
        if (code) return sendText(res, code, 'forbidden')
        return handler(req, res)
      },
    })

  ctx.effect(() => {
    const disposers = [
      register('exact', `${API}/meta`, metaHandler),
      register('prefix', CESIUM_ROUTE, cesiumHandler),
      register('prefix', TILES_ROUTE, (req, res) => tilesHandler(req, res, allowedDirs)),
      register('prefix', REMOTE_ROUTE, remoteHandler),
      register('exact', `${API}/scan`, (req, res) => scanHandler(req, res, allowedDirs)),
      register('exact', `${SOURCES_ROUTE}/${TOKEN}`, (req, res) =>
        req.method === 'GET' ? sourcesHandler(req, res) : req.method === 'PUT' ? saveSourcesHandler(req, res) : sendText(res, 405, 'method not allowed'),
      ),
    ]
    return () => {
      for (const dispose of disposers) {
        if (typeof dispose === 'function') dispose()
      }
    }
  }, 'digital-earth api routes')
}

