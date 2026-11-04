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
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
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
// Agent bridge: panels listen on `events`, tools wait for receipts on `result`.
const EVENTS_ROUTE = `${API}/events`
const RESULT_ROUTE = `${API}/result`
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

async function metaHandler(req, res) {
  const meta = {
    token: TOKEN,
    cesiumBase: `${API}/cesium/`,
    tilesBase: `${API}/tiles/${TOKEN}/`,
    scanUrl: `${API}/scan`,
    remoteBase: `${API}/remote/${TOKEN}/`,
    sourcesUrl: `${SOURCES_ROUTE}/${TOKEN}`,
    eventsUrl: EVENTS_ROUTE,
    resultUrl: RESULT_ROUTE,
  }
  // Read lazily and never fail the route: an "about" label is not worth a 500.
  const version = await packageVersion()
  if (version !== null) meta.version = version
  sendJson(res, 200, meta)
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

// ---------------------------------------------------------------------------
// Agent bridge (docs/agent-bridge.md)
//
// The Host half of the panel bridge: panels connect over SSE, each with its own
// serial command queue, and the model-facing tools turn calls into `command`
// frames and wait for the matching `POST /result` receipt. Nothing here trusts
// the panel: command ids are random, receipts need the process token, and local
// load paths must already be whitelisted by `/scan`.
// ---------------------------------------------------------------------------

const MAX_RESULT_BODY = 16 * 1024 * 1024
const MAX_PANEL_CONNECTIONS = 8
const PANEL_PING_INTERVAL = 15_000
const PANEL_SESSION_LIMIT = 128
const SCENE_TIMEOUT_MS = 20_000
const CAPTURE_TIMEOUT_MS = 30_000
const CAPTURE_WIDTH_DEFAULT = 1280
const CAPTURE_WIDTH_MIN = 320
const CAPTURE_WIDTH_MAX = 2560
const SCENE_ACTION_LIST = ['status', 'load', 'remove', 'visible', 'basemap', 'terrain', 'fly', 'reset', 'pick']
const SCENE_ACTIONS = new Set(SCENE_ACTION_LIST)
const CAPTURE_FORMAT_LIST = ['png', 'jpeg']
const CAPTURE_FORMATS = new Set(CAPTURE_FORMAT_LIST)
const ABSOLUTE_PATH = /^([a-zA-Z]:[\\/]|\\\\|\/)/
const DATA_URL = /^data:image\/(png|jpeg);base64,([a-z0-9+/=\s]+)$/i

/** Failure codes the bridge can emit, with the hint a model can act on. */
const BRIDGE_ERROR_HINTS = {
  panel_not_open: 'Ask the user to open the Digital Earth panel from the left sidebar, then retry.',
  panel_ambiguous: 'Several Digital Earth panels are open; ask the user to keep one, then retry.',
  bridge_offline: 'The panel connection dropped; ask the user to reopen the Digital Earth panel.',
  timeout: 'The panel did not answer in time; retry once, or ask the user to reload the panel.',
  panel_gone: 'The panel was closed while the command was in flight; ask the user to reopen it.',
  bad_args: 'Check the arguments against the documented earth_scene/earth_capture parameters.',
  needs_user_directory: "Ask the user to open that folder from the panel's local-directory picker first.",
  not_found: 'Nothing matches that id; call earth_scene with action="status" to list the current scene.',
  capture_failed: 'The panel could not produce a usable screenshot; retry once.',
  load_failed: 'The tileset could not be loaded; verify the url/path and retry.',
}

const EARTH_SCENE_DESCRIPTION = '操作已打开的数字地球面板：读取/加载/删除 3D Tiles 图层、切换底图与地形、飞行相机、拾取要素。坐标为 WGS84 十进制度（经度 lon、纬度 lat），高度单位米。不确定当前场景时先 action="status"；不要猜坐标。面板未打开时会返回 panel_not_open，请让用户从左侧边栏打开数字地球。'

const EARTH_CAPTURE_DESCRIPTION = '截取数字地球当前视口为 PNG 存到工作区，返回路径、相机和图层摘要；截图不含工具栏。截完后用 read_image 读取该路径，确认真实画面后再描述。一次对话最多截 1–2 张。'

/**
 * Raw JSON Schema for the model-facing tools. Only the enforced DSH subset is
 * used (type/oneOf/properties/required/additionalProperties/items/enum/const +
 * annotations), so ranges are described in prose and checked in `execute`.
 */
const EARTH_SCENE_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: SCENE_ACTION_LIST,
      description: 'Operation to run; use status first when the current scene is unknown.',
    },
    url: {
      type: 'string',
      description: 'load: http(s) address of a tileset.json, or a tiles URL the panel already shows.',
    },
    path: {
      type: 'string',
      description: 'load: absolute local directory or tileset.json inside a folder the user opened in the panel.',
    },
    name: { type: 'string', description: 'load: optional layer display name.' },
    id: {
      description: 'remove/visible: layer id. basemap/terrain: imagery or terrain source id; null turns it off.',
      oneOf: [
        { type: 'string', description: 'Layer or source id.' },
        { type: 'null', description: 'Turn the current basemap or terrain off.' },
      ],
    },
    visible: { type: 'boolean', description: 'visible: show (true) or hide (false) the layer.' },
    lon: { type: 'number', description: 'fly/pick: WGS84 longitude in decimal degrees (-180..180).' },
    lat: { type: 'number', description: 'fly/pick: WGS84 latitude in decimal degrees (-90..90).' },
    height: { type: 'number', description: 'fly: camera height in metres (default 2000).' },
    heading: { type: 'number', description: 'fly: heading in degrees (default 0).' },
    pitch: { type: 'number', description: 'fly: pitch in degrees (default -45).' },
    duration: { type: 'number', description: 'fly: flight duration in seconds, 0-10 (default 1.5).' },
  },
  required: ['action'],
  additionalProperties: false,
}

const EARTH_CAPTURE_PARAMETERS = {
  type: 'object',
  properties: {
    width: {
      type: 'integer',
      description: 'Output width in pixels, 320-2560 (default 1280); height keeps the viewport ratio.',
    },
    format: { type: 'string', enum: CAPTURE_FORMAT_LIST, description: 'Image format (default png).' },
  },
  additionalProperties: false,
}

/**
 * Shared output envelope. The success payload varies per action, so the schema
 * only pins down the `ok` discriminator and lets the action-specific fields
 * through; `render` is what the model actually reads.
 */
const BRIDGE_TOOL_OUTPUT = {
  schema: {
    type: 'object',
    description: 'Structured tool result. Success carries the action payload; failure carries code/message/hint.',
    properties: {
      ok: { type: 'boolean', description: 'Whether the operation succeeded.' },
      code: { type: 'string', description: 'Machine-readable failure code (failure only).' },
      message: { type: 'string', description: 'Human-readable failure detail (failure only).' },
      hint: { type: 'string', description: 'Suggested next step for the model (failure only).' },
    },
    required: ['ok'],
    additionalProperties: true,
  },
  render: (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
}

const SYSTEM_PROMPT_SECTION = {
  name: 'digital-earth',
  order: 550,
  text: `## Digital Earth panel
- earth_scene operates the user's open 3D globe panel; earth_capture saves a PNG of the viewport.
- Coordinates are WGS84 decimal degrees (lon/lat). Heights are meters. Never guess coordinates; use status.
- Call earth_scene(action="status") before changing a view you have not seen this turn.
- panel_not_open means the user must open the Digital Earth panel from the left sidebar; don't retry blindly.
- After changing the view, capture once and use read_image before describing what is visible.
- Loading local files is limited to directories the user picked in the panel.`,
}

const errorMessage = (error) => (error instanceof Error ? error.message : String(error))
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const finiteNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** `ctx.logger` when the host provides one, console otherwise: a bridge warning must never throw. */
function warnWith(ctx, message) {
  try {
    if (typeof ctx.logger?.warn === 'function') {
      ctx.logger.warn(message)
      return
    }
  } catch {
    // fall through to console
  }
  console.warn(message)
}

/** Optional service lookup: absent on hosts that do not mount the service. */
function serviceOf(ctx, name) {
  try {
    const service = ctx.get(name)
    if (service !== undefined && service !== null) return service
  } catch {
    // fall through to the direct property
  }
  try {
    return ctx[name]
  } catch {
    return undefined
  }
}

let cachedPackageVersion
/** This package's version for `/meta`, omitted when the manifest cannot be read. */
async function packageVersion() {
  if (cachedPackageVersion !== undefined) return cachedPackageVersion
  try {
    const manifest = JSON.parse(await fs.readFile(new URL('./package.json', import.meta.url), 'utf8'))
    cachedPackageVersion = typeof manifest?.version === 'string' && manifest.version !== '' ? manifest.version : null
  } catch {
    cachedPackageVersion = null
  }
  return cachedPackageVersion
}

/** Read a JSON receipt body with a hard byte cap; a body of exactly the cap is allowed. */
function readRequestBody(req, limit) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    req.on('data', (chunk) => {
      if (tooLarge) return
      size += chunk.length
      if (size > limit) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => finish({ tooLarge, text: tooLarge ? '' : Buffer.concat(chunks).toString('utf8') }))
    req.on('error', () => finish({ tooLarge: false, text: '', error: true }))
    req.on('close', () => finish({ tooLarge: false, text: '', error: true }))
  })
}

/** Normalize one panel receipt into the bridge's internal result shape. */
function normalizeBridgeResult(receipt) {
  if (receipt.ok === true) return { ok: true, data: receipt.data ?? {} }
  const code = typeof receipt.code === 'string' && receipt.code !== '' ? receipt.code.slice(0, 64) : 'bridge_offline'
  const message = typeof receipt.message === 'string' && receipt.message !== '' ? receipt.message.slice(0, 600) : 'The Digital Earth panel rejected the command.'
  return { ok: false, code, message }
}

/** Tool-facing failure: never throw, always explain what the model can do next. */
function bridgeFailure(code, message) {
  const result = { ok: false, code: typeof code === 'string' && code !== '' ? code.slice(0, 64) : 'bridge_offline' }
  result.message = typeof message === 'string' && message !== '' ? message.slice(0, 600) : 'The Digital Earth bridge rejected the request.'
  const hint = BRIDGE_ERROR_HINTS[result.code]
  if (hint !== undefined) result.hint = hint
  return result
}

/** Tool-facing success: a scene snapshot is spread so the model reads camera/layers directly. */
function bridgeSuccess(data) {
  if (isRecord(data)) return { ...data, ok: true }
  return { ok: true, data: data ?? null }
}

/**
 * The directory `/scan` must have whitelisted for a `load.path`, or null.
 * `tileset.json` paths are judged by their parent directory because that is
 * what `/scan` records and what the tiles route can serve from.
 */
function whitelistedTilesDir(path, allowedDirs) {
  if (typeof path !== 'string' || !ABSOLUTE_PATH.test(path)) return null
  const resolved = resolve(path)
  const dir = basename(resolved).toLowerCase() === 'tileset.json' ? dirname(resolved) : resolved
  return allowedDirs.has(dir) ? dir : null
}

/**
 * Validate and map one `earth_scene` call onto the client command args.
 * Returns `{ ok: true, args }` or a ready-made failure object; `load` with a
 * non-whitelisted local path never reaches the wire.
 */
function sceneCommandArgs(action, raw, allowedDirs) {
  const args = {}
  const bad = (message) => ({ ok: false, code: 'bad_args', message })
  switch (action) {
    case 'status':
    case 'reset':
      return { ok: true, args }
    case 'load': {
      const url = typeof raw.url === 'string' ? raw.url.trim() : ''
      const path = typeof raw.path === 'string' ? raw.path.trim() : ''
      if (url !== '') {
        // Absolute http(s), or a tiles URL the panel itself handed out (already
        // same-origin and token-scoped, so it needs no extra permission check).
        const panelUrl = url.startsWith(`${TILES_ROUTE}/`) || url.startsWith(`${REMOTE_ROUTE}/`)
        if (!panelUrl && !/^https?:\/\//i.test(url)) return bad('url must be an absolute http(s) URL or a panel tiles URL')
        args.url = url.slice(0, 2048)
      } else if (path !== '') {
        if (whitelistedTilesDir(path, allowedDirs) === null) {
          return {
            ok: false,
            code: 'needs_user_directory',
            message: `"${path}" is not inside a folder the user opened in the panel, so it was not forwarded.`,
          }
        }
        args.path = path
      } else {
        return bad('load needs url or path')
      }
      if (typeof raw.name === 'string' && raw.name.trim() !== '') args.name = raw.name.trim().slice(0, 120)
      return { ok: true, args }
    }
    case 'remove': {
      if (typeof raw.id !== 'string' || raw.id.trim() === '') return bad('remove needs a layer id')
      args.id = raw.id.trim()
      return { ok: true, args }
    }
    case 'visible': {
      if (typeof raw.id !== 'string' || raw.id.trim() === '') return bad('visible needs a layer id')
      if (typeof raw.visible !== 'boolean') return bad('visible needs a boolean visible flag')
      args.id = raw.id.trim()
      args.visible = raw.visible
      return { ok: true, args }
    }
    case 'basemap':
    case 'terrain': {
      if (Object.hasOwn(raw, 'id')) {
        if (raw.id === null || raw.id === '') args.id = null
        else if (typeof raw.id === 'string' && raw.id.trim() !== '') args.id = raw.id.trim()
        else return bad(`${action} id must be a source id string or null to turn it off`)
      }
      return { ok: true, args }
    }
    case 'fly': {
      const lon = finiteNumber(raw.lon)
      const lat = finiteNumber(raw.lat)
      if (lon === null || lat === null) return bad('fly needs numeric lon and lat')
      if (lon < -180 || lon > 180) return bad('lon must be between -180 and 180')
      if (lat < -90 || lat > 90) return bad('lat must be between -90 and 90')
      args.lon = lon
      args.lat = lat
      const duration = finiteNumber(raw.duration)
      if (raw.duration !== undefined && duration === null) return bad('duration must be a number of seconds')
      if (duration !== null && (duration < 0 || duration > 10)) return bad('duration must be between 0 and 10 seconds')
      for (const key of ['height', 'heading', 'pitch']) {
        if (raw[key] === undefined) continue
        const value = finiteNumber(raw[key])
        if (value === null) return bad(`${key} must be a number`)
        args[key] = value
      }
      if (duration !== null) args.duration = duration
      return { ok: true, args }
    }
    case 'pick': {
      const lon = finiteNumber(raw.lon)
      const lat = finiteNumber(raw.lat)
      if (lon === null || lat === null) return bad('pick needs numeric lon and lat')
      if (lon < -180 || lon > 180) return bad('lon must be between -180 and 180')
      if (lat < -90 || lat > 90) return bad('lat must be between -90 and 90')
      args.lon = lon
      args.lat = lat
      return { ok: true, args }
    }
    default:
      return bad('unsupported action')
  }
}

/** Decode `data:image/(png|jpeg);base64,…`, accepting only real PNG/JPEG bytes. */
function decodeCaptureImage(dataUrl) {
  if (typeof dataUrl !== 'string') return null
  const match = DATA_URL.exec(dataUrl)
  if (match === null) return null
  let buffer
  try {
    buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64')
  } catch {
    return null
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { format: 'png', buffer }
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { format: 'jpeg', buffer }
  }
  return null
}

/** `<yyyyMMdd-HHmmss>-<4 hex chars>`, so captures sort by time and never collide. */
function captureBaseName(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${stamp}-${randomBytes(2).toString('hex')}`
}

/** The session working directory when available, the plugin state dir otherwise. */
async function captureDirectory(ctx, exec) {
  try {
    const workingDirectory = serviceOf(ctx, 'workingDirectory')
    if (workingDirectory !== undefined && workingDirectory !== null && typeof workingDirectory.ensure === 'function') {
      const cwd = await workingDirectory.ensure(exec?.agent, exec?.signal)
      if (typeof cwd === 'string' && cwd.trim() !== '') return join(cwd, '.dsh-earth', 'captures')
    }
  } catch (error) {
    warnWith(ctx, `digital-earth: could not resolve the session working directory for the capture: ${errorMessage(error)}`)
  }
  return join(STATE_DIR, 'captures')
}

/** Write the PNG/JPEG plus its JSON sidecar; returns the tool payload or a failure. */
async function saveCapture(ctx, exec, data, requestedWidth) {
  const image = decodeCaptureImage(isRecord(data) ? data.dataUrl : undefined)
  if (image === null) return bridgeFailure('capture_failed', 'The panel returned no usable image data.')
  const scene = isRecord(data?.scene) ? data.scene : null
  const camera = isRecord(data?.camera) ? data.camera : isRecord(scene?.camera) ? scene.camera : null
  const layers = Array.isArray(data?.layers) ? data.layers : Array.isArray(scene?.layers) ? scene.layers : null
  const width = Number.isInteger(data?.width) && data.width > 0 ? data.width : requestedWidth
  const height = Number.isInteger(data?.height) && data.height > 0 ? data.height : null
  const directory = await captureDirectory(ctx, exec)
  try {
    await fs.mkdir(directory, { recursive: true })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const base = captureBaseName()
      const imagePath = join(directory, `${base}.${image.format}`)
      try {
        // `wx` keeps a concurrent capture from silently overwriting this one.
        await fs.writeFile(imagePath, image.buffer, { flag: 'wx' })
      } catch (error) {
        if (error?.code === 'EEXIST') continue
        throw error
      }
      const sidecarPath = join(directory, `${base}.json`)
      const metadata = {
        capturedAt: new Date().toISOString(),
        image: { path: imagePath, format: image.format, width, height, bytes: image.buffer.length },
      }
      if (scene !== null) metadata.scene = scene
      if (camera !== null) metadata.camera = camera
      if (layers !== null) metadata.layers = layers
      await fs.writeFile(sidecarPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
      return {
        ok: true,
        path: imagePath,
        sidecar: sidecarPath,
        width,
        height,
        bytes: image.buffer.length,
        format: image.format,
        camera,
        layers,
        hint: `Use read_image on "${imagePath}" to inspect the capture before describing it.`,
      }
    }
  } catch (error) {
    return bridgeFailure('capture_failed', `The capture could not be written to disk: ${errorMessage(error)}`)
  }
  return bridgeFailure('capture_failed', 'A unique capture file name could not be allocated; retry once.')
}

/**
 * Process-local panel registry plus the per-panel serial command queue.
 * `connect` owns SSE registration, `handleResult` resolves in-flight commands,
 * `dispatch` is what the tools call, and `closeAll` runs on plugin disposal.
 */
function createBridge({ warn }) {
  const panels = new Map()
  const pending = new Map()

  const writeRaw = (res, text) => {
    if (res.writableEnded === true || res.destroyed === true) return false
    try {
      res.write(text)
      return true
    } catch (error) {
      warn(`digital-earth: SSE write failed: ${errorMessage(error)}`)
      return false
    }
  }

  const writeEvent = (res, event, data) => writeRaw(res, `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  /** Drop one panel: stop pinging, fail its in-flight command, end the stream. */
  const closePanel = (panel, code) => {
    if (panel.closed === true) return
    panel.closed = true
    panels.delete(panel.id)
    if (panel.ping !== null) {
      clearInterval(panel.ping)
      panel.ping = null
    }
    for (const [id, entry] of pending) {
      if (entry.panelId !== panel.id) continue
      pending.delete(id)
      clearTimeout(entry.timer)
      entry.resolve({ ok: false, code, message: 'The Digital Earth panel closed before the command finished.' })
    }
    try {
      panel.res.end()
    } catch {
      // Already gone; nothing left to close.
    }
  }

  const connect = (req, res) => {
    if (req.method !== 'GET') return sendText(res, 403, 'forbidden')
    let url
    try {
      url = new URL(req.url ?? '/', 'http://localhost')
    } catch {
      return sendText(res, 400, 'bad request')
    }
    if (url.searchParams.get('token') !== TOKEN) return sendText(res, 403, 'forbidden')
    const claimed = url.searchParams.get('session')
    const session = typeof claimed === 'string' && claimed.trim() !== '' ? claimed.trim().slice(0, PANEL_SESSION_LIMIT) : null
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.flushHeaders?.()
    const panel = {
      id: `panel-${randomBytes(9).toString('base64url')}`,
      session,
      res,
      ping: null,
      closed: false,
      tail: Promise.resolve(),
    }
    panels.set(panel.id, panel)
    writeRaw(res, 'retry: 3000\n\n')
    writeEvent(res, 'hello', { panelId: panel.id, session })
    panel.ping = setInterval(() => {
      writeRaw(res, ': ping\n\n')
    }, PANEL_PING_INTERVAL)
    panel.ping.unref?.()
    const disconnect = () => closePanel(panel, 'panel_gone')
    req.on('close', disconnect)
    res.on('close', disconnect)
    // Keep the registry bounded; the oldest connection loses, like a rolling log.
    while (panels.size > MAX_PANEL_CONNECTIONS) {
      const oldest = panels.values().next().value
      if (oldest === undefined) break
      closePanel(oldest, 'panel_gone')
    }
    return undefined
  }

  const handleResult = async (req, res) => {
    if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
    let url
    try {
      url = new URL(req.url ?? '/', 'http://localhost')
    } catch {
      return sendText(res, 400, 'bad request')
    }
    if (url.searchParams.get('token') !== TOKEN) return sendText(res, 403, 'forbidden')
    const body = await readRequestBody(req, MAX_RESULT_BODY)
    if (body.tooLarge === true) return sendJson(res, 413, { accepted: false })
    if (body.error === true) return sendJson(res, 400, { accepted: false })
    let receipt
    try {
      receipt = JSON.parse(body.text)
    } catch {
      return sendJson(res, 400, { accepted: false })
    }
    if (
      !isRecord(receipt) ||
      typeof receipt.id !== 'string' ||
      receipt.id === '' ||
      receipt.id.length > 200 ||
      typeof receipt.ok !== 'boolean'
    ) {
      return sendJson(res, 400, { accepted: false })
    }
    const entry = pending.get(receipt.id)
    if (entry === undefined) return sendJson(res, 404, { accepted: false })
    pending.delete(receipt.id)
    clearTimeout(entry.timer)
    entry.resolve(normalizeBridgeResult(receipt))
    return sendJson(res, 200, { accepted: true })
  }

  /**
   * Session match first, then the single-panel fallback. A stale or absent
   * session on the panel side is normal (the panel may not know the session
   * id), so one connection is always unambiguous.
   */
  const selectPanel = (exec) => {
    const all = [...panels.values()]
    if (all.length === 0) return { ok: false, code: 'panel_not_open', message: 'No Digital Earth panel is connected.' }
    const session = exec?.agent?.id
    if (typeof session === 'string' && session !== '') {
      const matches = all.filter((panel) => panel.session === session)
      if (matches.length === 1) return { panel: matches[0] }
      if (matches.length > 1) {
        return { ok: false, code: 'panel_ambiguous', message: `${matches.length} panels report the current session.` }
      }
    }
    if (all.length === 1) return { panel: all[0] }
    return {
      ok: false,
      code: 'panel_ambiguous',
      message: `${all.length} panels are connected and none reports the current session.`,
    }
  }

  /** Send one command frame and wait for its receipt, the panel going away, or the deadline. */
  const runCommand = (panel, action, args, timeoutMs) =>
    new Promise((resolve) => {
      if (panel.closed === true) {
        resolve({ ok: false, code: 'panel_gone', message: 'The Digital Earth panel is no longer connected.' })
        return
      }
      const id = `c-${randomBytes(8).toString('base64url')}`
      const timer = setTimeout(() => {
        if (pending.delete(id) === false) return
        resolve({ ok: false, code: 'timeout', message: `The panel did not answer within ${Math.round(timeoutMs / 1000)} s.` })
      }, timeoutMs)
      timer.unref?.()
      pending.set(id, { panelId: panel.id, timer, resolve })
      if (writeEvent(panel.res, 'command', { id, action, args }) === false) {
        pending.delete(id)
        clearTimeout(timer)
        resolve({ ok: false, code: 'bridge_offline', message: 'The command could not be written to the panel stream.' })
      }
    })

  /** Queue one command behind the panel's previous one; commands never overlap. */
  const dispatch = async (exec, action, args, timeoutMs) => {
    const selection = selectPanel(exec)
    if (selection.panel === undefined) return selection
    const panel = selection.panel
    const run = panel.tail.then(() => runCommand(panel, action, args, timeoutMs))
    panel.tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const closeAll = () => {
    for (const panel of [...panels.values()]) closePanel(panel, 'panel_gone')
  }

  return { connect, handleResult, dispatch, closeAll }
}

/** `earth_scene`: validate locally, then one serialized command round-trip. */
function createEarthSceneTool({ bridge, allowedDirs }) {
  return {
    name: 'earth_scene',
    description: EARTH_SCENE_DESCRIPTION,
    parameters: EARTH_SCENE_PARAMETERS,
    timeoutMs: SCENE_TIMEOUT_MS,
    output: BRIDGE_TOOL_OUTPUT,
    async execute(rawArgs, exec) {
      const args = isRecord(rawArgs) ? rawArgs : {}
      const action = typeof args.action === 'string' ? args.action : ''
      if (!SCENE_ACTIONS.has(action)) {
        return bridgeFailure('bad_args', `action must be one of ${SCENE_ACTION_LIST.join(', ')}`)
      }
      const prepared = sceneCommandArgs(action, args, allowedDirs)
      if (prepared.ok === false) return bridgeFailure(prepared.code, prepared.message)
      const result = await bridge.dispatch(exec, action, prepared.args, SCENE_TIMEOUT_MS)
      if (result.ok === true) return bridgeSuccess(result.data)
      return bridgeFailure(result.code, result.message)
    },
  }
}

/** `earth_capture`: request a canvas screenshot, then persist it in the workspace. */
function createEarthCaptureTool({ ctx, bridge }) {
  return {
    name: 'earth_capture',
    description: EARTH_CAPTURE_DESCRIPTION,
    parameters: EARTH_CAPTURE_PARAMETERS,
    timeoutMs: CAPTURE_TIMEOUT_MS,
    output: BRIDGE_TOOL_OUTPUT,
    async execute(rawArgs, exec) {
      const args = isRecord(rawArgs) ? rawArgs : {}
      let width = CAPTURE_WIDTH_DEFAULT
      if (args.width !== undefined) {
        if (!Number.isInteger(args.width) || args.width < CAPTURE_WIDTH_MIN || args.width > CAPTURE_WIDTH_MAX) {
          return bridgeFailure('bad_args', `width must be an integer between ${CAPTURE_WIDTH_MIN} and ${CAPTURE_WIDTH_MAX}`)
        }
        width = args.width
      }
      let format = 'png'
      if (args.format !== undefined) {
        if (!CAPTURE_FORMATS.has(args.format)) return bridgeFailure('bad_args', "format must be 'png' or 'jpeg'")
        format = args.format
      }
      const result = await bridge.dispatch(exec, 'capture', { width, format }, CAPTURE_TIMEOUT_MS)
      if (result.ok !== true) return bridgeFailure(result.code, result.message)
      try {
        return await saveCapture(ctx, exec, result.data, width)
      } catch (error) {
        return bridgeFailure('capture_failed', `The capture could not be saved: ${errorMessage(error)}`)
      }
    },
  }
}

export const inject = ['webServer', 'connection']

export function apply(ctx) {
  // Directories this page opened through `/scan`; tile files are served only from
  // them, so a token holder cannot read arbitrary paths on the machine.
  const allowedDirs = new Set()
  const warn = (message) => warnWith(ctx, message)
  // The bridge lives for the plugin instance: connections close on dispose.
  const bridge = createBridge({ warn })

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
      // Long-lived SSE stream: one connection per mounted panel.
      register('exact', EVENTS_ROUTE, (req, res) => bridge.connect(req, res)),
      register('exact', RESULT_ROUTE, (req, res) => bridge.handleResult(req, res)),
      register('exact', `${SOURCES_ROUTE}/${TOKEN}`, (req, res) =>
        req.method === 'GET' ? sourcesHandler(req, res) : req.method === 'PUT' ? saveSourcesHandler(req, res) : sendText(res, 405, 'method not allowed'),
      ),
    ]
    return () => {
      for (const dispose of disposers) {
        if (typeof dispose === 'function') dispose()
      }
      bridge.closeAll()
    }
  }, 'digital-earth api routes')

  // Model-facing tools are optional: a composition without `tools` just keeps
  // the static viewer working.
  ctx.effect(() => {
    const tools = serviceOf(ctx, 'tools')
    if (tools === undefined || tools === null || typeof tools.register !== 'function') return () => {}
    const disposers = []
    for (const definition of [createEarthSceneTool({ bridge, allowedDirs }), createEarthCaptureTool({ ctx, bridge })]) {
      try {
        const dispose = tools.register(definition)
        if (typeof dispose === 'function') disposers.push(dispose)
      } catch (error) {
        warn(`digital-earth: could not register ${definition.name}: ${errorMessage(error)}`)
      }
    }
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'digital-earth agent tools')

  // One short prompt section is enough for the model to find the tools and not
  // guess coordinates; it is removed together with the other registrations.
  ctx.effect(() => {
    const systemPrompt = serviceOf(ctx, 'systemPrompt')
    if (systemPrompt === undefined || systemPrompt === null || typeof systemPrompt.section !== 'function') return () => {}
    try {
      const dispose = systemPrompt.section(SYSTEM_PROMPT_SECTION)
      return typeof dispose === 'function' ? dispose : () => {}
    } catch (error) {
      warn(`digital-earth: could not register the system prompt section: ${errorMessage(error)}`)
      return () => {}
    }
  }, 'digital-earth system prompt')
}

