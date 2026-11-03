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
import { createReadStream, readFileSync, promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, isAbsolute, join, parse, resolve, sep } from 'node:path'
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
const BRIDGE_ROUTE = `${API}/bridge`
const CAPTURE_ROUTE = `${API}/capture`
const FILES_ROUTE = `${API}/files`
// Opening a local folder registers it in the agent allowlist. Only the panel's
// own fetch can send a custom header, so /scan requires this header: a model
// that makes Cesium request a same-origin GET (for example load url=...) cannot
// forge it and therefore cannot widen the allowlist.
const PANEL_HEADER = 'x-dsh-panel'
const MAX_SCAN_ITEMS = 200
const MAX_SCAN_DEPTH = 4
// The source catalog is small JSON owned by this plugin; keep it outside the
// browser so it survives port changes (localStorage is per-origin) and restarts.
const STATE_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'digital-earth')
const SOURCES_FILE = join(STATE_DIR, 'sources.json')
const CAPTURES_DIR = resolve(STATE_DIR, 'captures')
const PACKAGE_FILE = join(ROOT_DIR, 'package.json')
const MAX_SOURCES_BODY = 128 * 1024
const MAX_BRIDGE_BODY = 256 * 1024
const MAX_CAPTURE_BODY = 16 * 1024 * 1024
const MAX_CAPTURE_FILES = 50
const BRIDGE_HEARTBEAT_MS = 15000
const SCENE_TIMEOUT_MS = 20000
const CAPTURE_TIMEOUT_MS = 40000
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
  settings: { theme: 'auto', imagery: 'esri-world-imagery', terrain: null, screenshotHud: false },
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

const FALLBACK_ABOUT = {
  version: '1.1.0',
  homepage: 'https://github.com/CVEO/dsh-digital-earth',
  team: { name: '武汉大学 CVEO 课题组', url: 'https://www.whu-cveo.com/' },
}

/**
 * About-tab facts for the client. package.json is the single source of the
 * version, so a release bump needs no code edit; constants cover a checkout
 * whose package file is missing or malformed.
 */
function readAbout() {
  let record = {}
  try {
    const parsed = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) record = parsed
  } catch {
    record = {}
  }
  const version = cleanText(record.version, 32)
  const homepage = cleanUrl(record.homepage)
  const team = record.team !== null && typeof record.team === 'object' ? record.team : {}
  const teamName = cleanText(team.name, 60)
  const teamUrl = cleanUrl(team.url)
  return {
    version: version !== '' ? version : FALLBACK_ABOUT.version,
    homepage: homepage !== '' ? homepage : FALLBACK_ABOUT.homepage,
    team: {
      name: teamName !== '' ? teamName : FALLBACK_ABOUT.team.name,
      url: teamUrl !== '' ? teamUrl : FALLBACK_ABOUT.team.url,
    },
  }
}

const ABOUT = readAbout()

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
      screenshotHud: input.settings?.screenshotHud === true,
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

/**
 * Replace the catalog atomically. Windows antivirus filters can hold a freshly
 * written file for a moment, so a transient rename failure is retried briefly
 * instead of failing the save.
 */
async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to)
      return
    } catch (error) {
      const transient = error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'EBUSY'
      if (!transient || attempt >= 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
    }
  }
}

async function writeSources(config) {
  await fs.mkdir(STATE_DIR, { recursive: true })
  // A unique temporary name keeps two concurrent saves from sharing one file;
  // the rename stays atomic, so readers see either the old or the new catalog.
  const temporary = `${SOURCES_FILE}.tmp-${randomBytes(6).toString('hex')}`
  try {
    await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    await renameWithRetry(temporary, SOURCES_FILE)
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

/** Hosts the proxy must never reach: loopback, private ranges and link-local. */
function blockedHost(origin) {
  let hostname
  try {
    hostname = new URL(origin).hostname.toLowerCase().replace(/\.+$/, '')
  } catch {
    return true
  }
  if (hostname.startsWith('[')) return true
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true
  // The URL parser normalises numeric IPv4 spellings, but reject the raw forms
  // too (decimal `2130706433`, hex `0x7f000001`) in case a parser does not.
  const rawHost = origin.replace(/^https?:\/\//i, '').split(/[/?#:]/)[0].toLowerCase().replace(/\.+$/, '')
  if (/^\d+$/.test(rawHost) || /^0x[0-9a-f]+$/.test(rawHost)) return true
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
}

function within(root, target) {
  const prefix = root.endsWith(sep) ? root : root + sep
  return target === root || target.startsWith(prefix)
}

/** `fs.realpath` that falls back to the resolved input when the path is missing. */
async function realPathOr(value) {
  try {
    return await fs.realpath(value)
  } catch {
    return resolve(value)
  }
}

/** A filesystem root (`C:\`, `C:/`, `/`, a UNC share root): never a data folder. */
function isFilesystemRoot(value) {
  const resolved = resolve(value)
  return parse(resolved).root === resolved
}

const LOCAL_DIR_NOT_OPENED_MESSAGE = `This local directory has not been opened in the Digital Earth panel yet. Ask the user to pick it once via the panel's Data → Open local folder, then retry.`

const LOCAL_PATH_NOT_ABSOLUTE_MESSAGE = 'earth_scene load "path" must be an absolute file path inside a folder the user opened in the Digital Earth panel.'

const IS_WINDOWS = process.platform === 'win32'

/** Comparison key: resolved, and case-folded on Windows where paths are case-insensitive. */
const pathKey = (value) => {
  const resolved = resolve(value)
  return IS_WINDOWS ? resolved.toLowerCase() : resolved
}

function isWithinDirectory(target, root) {
  const targetKey = pathKey(target)
  const rootKey = pathKey(root)
  if (targetKey === rootKey) return true
  return targetKey.startsWith(rootKey.endsWith(sep) ? rootKey : `${rootKey}${sep}`)
}

/**
 * A local `load` may only read below a directory the user opened in the panel.
 * The `/scan` endpoint is a UI registration endpoint, not an authorisation for
 * the agent: the *containing directory* of the tileset must already be in the
 * allowlist, so an agent cannot widen access by pointing `/scan` at a folder of
 * its own choosing. Returns an actionable message, or `null` when allowed.
 */
function loadPathDenial(action, args, allowedDirs) {
  if (action !== 'load' || typeof args?.path !== 'string') return null
  const raw = args.path
  if (raw.trim() === '' || !isAbsolute(raw)) return LOCAL_PATH_NOT_ABSOLUTE_MESSAGE
  const directory = dirname(resolve(raw))
  for (const allowed of allowedDirs) {
    if (isWithinDirectory(directory, allowed)) return null
  }
  return LOCAL_DIR_NOT_OPENED_MESSAGE
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
  // A symlink or junction below the root must not escape it: compare the
  // resolved real paths, not just the lexical ones.
  if (!isWithinDirectory(await realPathOr(target), await realPathOr(root))) return sendText(res, 403, 'forbidden')
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
    version: ABOUT.version,
    homepage: ABOUT.homepage,
    team: { name: ABOUT.team.name, url: ABOUT.team.url },
    bridgeUrl: BRIDGE_ROUTE,
    captureUrl: CAPTURE_ROUTE,
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

async function tilesHandler(req, res, allowedDirs) {
  const raw = subPath(requestPath(req), TILES_ROUTE)
  if (raw === null) return sendText(res, 403, 'forbidden')
  const parts = segments(raw)
  if (parts[0] !== TOKEN || parts.length < 2) return sendText(res, 403, 'forbidden')
  const dir = fromB64(parts[1])
  // Only absolute Windows or POSIX directories, and only ones the user opened.
  if (!/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(dir)) return sendText(res, 403, 'forbidden')
  const resolvedDir = resolve(dir)
  const realDir = await realPathOr(resolvedDir)
  if (!allowedDirs.has(resolvedDir) && !allowedDirs.has(realDir)) return sendText(res, 403, 'forbidden')
  const relParts = []
  for (const part of parts.slice(2)) {
    const decoded = decodeSegment(part)
    if (decoded === null || decoded.includes('\0') || decoded === '..') {
      return sendText(res, 403, 'forbidden')
    }
    relParts.push(decoded)
  }
  // serveFile repeats the real-path containment check on the target file.
  await serveFile(req, res, resolvedDir, relParts.join(sep), 'public, max-age=60')
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
  // The allowlist may only grow from a user gesture in the panel, never from a
  // URL the model can cause Cesium to load; the panel's fetch adds this header.
  if (req.headers?.[PANEL_HEADER] !== '1') return sendText(res, 403, 'scan requests must come from the panel')
  const resolvedDir = resolve(dir)
  // Registering a drive/UNC/share root would hand the agent every file on it.
  if (isFilesystemRoot(resolvedDir)) return sendText(res, 400, 'scanning a filesystem root is not allowed')
  // Record both spellings so a path remembered by the page still matches after
  // a symlinked or junctioned folder is resolved by the filesystem.
  const realDir = await realPathOr(resolvedDir)
  allowedDirs.add(resolvedDir)
  allowedDirs.add(realDir)
  const files = await findTilesets(resolvedDir)
  const items = files.map((file) => {
    const rel = file
      .slice(resolvedDir.length)
      .replace(/^[\\/]+/, '')
      .split(/[\\/]/)
      .map(encodeURIComponent)
      .join('/')
    return {
      name: file.slice(resolvedDir.length).replace(/^[\\/]+/, ''),
      url: `${API}/tiles/${TOKEN}/${encodeURIComponent(toB64(resolvedDir))}/${rel}`,
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
    // Redirects are refused: a harmless host could otherwise bounce the proxy
    // to a loopback/private address that `blockedHost` already rejected.
    const upstream = await fetch(target, { redirect: 'manual' })
    if (upstream.status >= 300 && upstream.status < 400) return sendText(res, 403, 'forbidden')
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

const SCENE_TOOL_NAME = 'earth_scene'
const CAPTURE_TOOL_NAME = 'earth_capture'
const SCENE_RENDER_LIMIT = 4096
const CAPTURE_NOTE = 'Image file written. If this model can read images, call read_image with this path; otherwise rely on earth_scene status JSON.'
const PANEL_CLOSED_MESSAGE = '数字地球面板未打开：请点击聊天标题栏右侧的地球按钮（或在对话中输入“打开数字地球”）。'
const SESSION_FALLBACK_NOTE = 'No session id was supplied by this tool call; the only connected digital earth panel session was used.'

const SCENE_ACTIONS = {
  status: [],
  list: [],
  load: ['url', 'path'],
  remove: ['layer'],
  visible: ['layer', 'visible'],
  basemap: ['imagery'],
  terrain: ['terrain'],
  fly: ['lon', 'lat', 'height', 'heading', 'pitch', 'duration'],
  reset: [],
  pick: [],
}
const SCENE_ACTION_NAMES = Object.keys(SCENE_ACTIONS)
const CAPTURE_ARG_NAMES = new Set(['width', 'format', 'include_hud', 'label'])
const CAPTURE_FORMATS = new Set(['jpeg', 'png'])
const DEFAULT_CAPTURE_WIDTH = 1280
const MIN_CAPTURE_WIDTH = 480
const MAX_CAPTURE_WIDTH = 2560

const SCENE_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: SCENE_ACTION_NAMES,
      description: 'Operation to run.',
    },
    url: {
      type: 'string',
      description: 'load: absolute http(s) URL of a tileset.json; exactly one of url or path.',
    },
    path: {
      type: 'string',
      description: 'load: absolute path of a tileset.json inside a folder the user opened in the panel; exactly one of url or path.',
    },
    layer: {
      type: 'string',
      description: 'remove/visible: layer id from status.layers, or its exact name.',
    },
    visible: {
      type: 'boolean',
      description: 'visible: true shows the layer, false hides it.',
    },
    imagery: {
      type: 'string',
      description: 'basemap: imagery source id from status.sources.imagery; pass "none" to turn the basemap off.',
    },
    terrain: {
      type: 'string',
      description: 'terrain: terrain source id from status.sources.terrain; pass "none" to turn terrain off.',
    },
    lon: { type: 'number', description: 'fly: target longitude in degrees.' },
    lat: { type: 'number', description: 'fly: target latitude in degrees.' },
    height: { type: 'number', description: 'fly: camera height in meters; default 1500.' },
    heading: { type: 'number', description: 'fly: heading in degrees clockwise from north; default 0.' },
    pitch: { type: 'number', description: 'fly: pitch in degrees, -90 looks straight down; default -45.' },
    duration: { type: 'number', description: 'fly: flight time in seconds; default 1.2.' },
  },
  required: ['action'],
  additionalProperties: false,
}

const SCENE_DESCRIPTION = [
  'Read or change the interactive digital earth panel (CesiumJS) open in this conversation: 3D Tiles and Gaussian splat layers, imagery basemap, terrain and camera.',
  'The panel must already be open; otherwise the call fails with an instruction you should relay to the user.',
  '',
  'Actions:',
  '- status: returns view{lon,lat,height,heading,pitch}, layers, imagery, terrain, sources, viewport, snapshot and measureTool, plus busy state. Start here.',
  '- list: layers, sources, active imagery and terrain only (no camera/view), lighter than status.',
  '- load: add a layer from url (online tileset.json) or path (local tileset.json inside a folder the user opened in the panel).',
  '- remove: remove a layer by layer id or name.',
  '- visible: show or hide one layer.',
  '- basemap: switch the imagery source, or pass "none" to turn the basemap off.',
  '- terrain: switch the terrain source, or pass "none" to turn terrain off.',
  '- fly: move the camera.',
  '- reset: return to the global view.',
  '- pick: identify whatever is at the center of the view.',
  '',
  'Returns the panel JSON result for the action; that result is the authoritative scene state.',
].join('\n')

const CAPTURE_PARAMETERS = {
  type: 'object',
  properties: {
    width: {
      type: 'integer',
      minimum: MIN_CAPTURE_WIDTH,
      maximum: MAX_CAPTURE_WIDTH,
      description: 'Target image width in output image pixels (capped by the panel canvas size); height follows the panel aspect ratio. Default 1280.',
    },
    format: {
      type: 'string',
      enum: ['jpeg', 'png'],
      description: 'Image encoding. Default jpeg.',
    },
    include_hud: {
      type: 'boolean',
      description: 'true burns the coordinate HUD and team credit into the image (the DOM toolbar is never included); omit to use the panel screenshot setting (usually hidden).',
    },
    label: {
      type: 'string',
      description: 'Short scene label for this capture, used in the file name.',
    },
  },
  additionalProperties: false,
}

const CAPTURE_DESCRIPTION = [
  'Save the current digital earth view as an image file on the host and return its absolute path.',
  'The panel must already be open; set up the camera and scene with earth_scene first.',
  '',
  'By default the image follows the panel screenshot setting (usually a clean view); set include_hud true to burn in the coordinate HUD and team credit. The DOM toolbar is never part of the image.',
  'If this model can read images, call read_image on the returned path; otherwise describe the scene only from earth_scene status JSON.',
].join('\n')

const SYSTEM_PROMPT_SECTION = [
  'The Web UI has an interactive digital earth panel (CesiumJS) that renders 3D Tiles, Gaussian splats, imagery basemaps and terrain. Control it with earth_scene and earth_capture.',
  '',
  '- The panel must be open in this conversation first (earth button in the chat header). When it is not, the tools return an actionable error; relay that instruction instead of retrying blindly.',
  '- Call earth_scene with action "status" before changing anything, so changes build on the real camera, layers and sources; "list" is the lighter variant.',
  '- Local data can be loaded only from a folder the user opened once in the panel, because the host keeps an allowlist. Never guess an absolute path. If a local load is refused, ask the user to open the folder from the panel data setting, then retry.',
  '- earth_scene actions: status, list, load, remove, visible, basemap, terrain, fly, reset, pick.',
  '- earth_capture saves a screenshot to the host and returns its absolute path; by default it follows the panel screenshot setting (usually the HUD stays hidden). If the model can read images, call read_image on that path; otherwise rely on earth_scene status JSON. Never describe scene content you did not receive.',
  '- Report only the state the tools returned; never claim data is loaded or visible when the result does not say so.',
].join('\n')

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const timeoutMessage = (action, timeoutMs) =>
  `The digital earth panel did not answer the "${action}" command within ${Math.round(timeoutMs / 1000)}s. Make sure the panel is still open and has finished loading, then retry.`

// Only the newest connection of a session receives commands, so several open
// tabs cannot run one command twice; older tabs stay connected but idle.
const MULTI_TAB_HINT = ' Several panel tabs are connected for this session and only the most recently opened one receives commands; switch to that tab (or reopen the panel here) and retry.'

const sceneError = (message) => new Error(`earth_scene: ${message}`)

const captureError = (message) => new Error(`earth_capture: ${message}`)

function requireSceneString(raw, key, action) {
  const value = raw[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw sceneError(`${action} needs "${key}" as a non-empty string.`)
  }
  return value.trim()
}

function nullableSceneString(raw, key, action) {
  const value = raw[key]
  if (value === null) return null
  if (typeof value === 'string' && value.trim() !== '') {
    const trimmed = value.trim()
    // The DSH schema subset has no `type: ['string', 'null']`, so the schema
    // advertises the string "none" and it is normalised to null here.
    return trimmed.toLowerCase() === 'none' ? null : trimmed
  }
  throw sceneError(`${action} "${key}" must be a source id string, or "none" to turn it off.`)
}

/** Validate the model-facing arguments and build the command the browser executes. */
function normalizeSceneRequest(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw sceneError('the arguments must be an object with an "action" field.')
  }
  const action = raw.action
  if (typeof action !== 'string' || !Object.hasOwn(SCENE_ACTIONS, action)) {
    throw sceneError(`"action" must be one of ${SCENE_ACTION_NAMES.join(', ')}.`)
  }
  const allowed = SCENE_ACTIONS[action]
  for (const key of Object.keys(raw)) {
    if (key === 'action' || allowed.includes(key)) continue
    throw sceneError(`action "${action}" does not accept "${key}"; accepted arguments: action${allowed.length === 0 ? '' : `, ${allowed.join(', ')}`}.`)
  }
  const args = {}
  switch (action) {
    case 'load': {
      const url = typeof raw.url === 'string' ? raw.url.trim() : ''
      const path = typeof raw.path === 'string' ? raw.path.trim() : ''
      if (url !== '' && path !== '') throw sceneError('load takes either "url" or "path", not both.')
      if (url === '' && path === '') {
        throw sceneError('load needs "url" (online tileset.json) or "path" (local tileset.json inside a folder the user opened in the panel).')
      }
      if (url !== '') {
        if (!isHttpUrl(url)) throw sceneError(`load "url" must be an absolute http(s) URL, got ${JSON.stringify(url)}.`)
        args.url = url
      } else {
        args.path = path
      }
      break
    }
    case 'remove':
      args.layer = requireSceneString(raw, 'layer', action)
      break
    case 'visible':
      if (typeof raw.visible !== 'boolean') throw sceneError('visible needs "visible" as true or false.')
      args.layer = requireSceneString(raw, 'layer', action)
      args.visible = raw.visible
      break
    case 'basemap':
      if (!Object.hasOwn(raw, 'imagery')) {
        throw sceneError('basemap needs "imagery" (a source id from status.sources.imagery, or "none" to turn the basemap off).')
      }
      args.imagery = nullableSceneString(raw, 'imagery', action)
      break
    case 'terrain':
      if (!Object.hasOwn(raw, 'terrain')) {
        throw sceneError('terrain needs "terrain" (a source id from status.sources.terrain, or "none" to turn terrain off).')
      }
      args.terrain = nullableSceneString(raw, 'terrain', action)
      break
    case 'fly': {
      for (const key of ['lon', 'lat']) {
        if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) {
          throw sceneError(`fly needs "${key}" as a finite number of degrees.`)
        }
        args[key] = raw[key]
      }
      if (args.lon < -180 || args.lon > 180) throw sceneError('fly "lon" must be between -180 and 180 degrees.')
      if (args.lat < -90 || args.lat > 90) throw sceneError('fly "lat" must be between -90 and 90 degrees.')
      for (const key of ['height', 'heading', 'pitch', 'duration']) {
        if (raw[key] === undefined) continue
        if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) {
          throw sceneError(`fly "${key}" must be a finite number.`)
        }
        args[key] = raw[key]
      }
      break
    }
    default:
      break
  }
  return { action, args }
}

/** Validate capture options and build the capture command, passed through as-is. */
function normalizeCaptureRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (typeof input !== 'object' || Array.isArray(input)) throw captureError('the arguments must be an object.')
  for (const key of Object.keys(input)) {
    if (CAPTURE_ARG_NAMES.has(key)) continue
    throw captureError(`it does not accept "${key}"; accepted arguments: width, format, include_hud, label.`)
  }
  const width = input.width === undefined ? DEFAULT_CAPTURE_WIDTH : input.width
  if (!Number.isInteger(width) || width < MIN_CAPTURE_WIDTH || width > MAX_CAPTURE_WIDTH) {
    throw captureError(`"width" must be an integer between ${MIN_CAPTURE_WIDTH} and ${MAX_CAPTURE_WIDTH} pixels.`)
  }
  const format = input.format === undefined ? 'jpeg' : input.format
  if (!CAPTURE_FORMATS.has(format)) throw captureError('"format" must be "jpeg" or "png".')
  // An explicit boolean wins; otherwise the key is left out so the page can
  // fall back to its own screenshot setting (usually HUD hidden).
  const includeHud = input.include_hud
  if (includeHud !== undefined && typeof includeHud !== 'boolean') throw captureError('"include_hud" must be true or false.')
  const label = input.label === undefined ? '' : input.label
  if (typeof label !== 'string') throw captureError('"label" must be a string.')
  const args = { width, format }
  if (includeHud !== undefined) args.include_hud = includeHud
  const trimmedLabel = label.trim().slice(0, 80)
  if (trimmedLabel !== '') args.label = trimmedLabel
  return { args, includeHud }
}

/**
 * Which browser session should run this command. The tool execution normally
 * carries the conversation's session id; a fallback covers transports that do
 * not, as long as exactly one panel session is connected.
 */
function resolveSessionTarget(bridge, exec) {
  const direct = exec?.agent?.session?.id ?? exec?.agent?.id
  if (typeof direct === 'string' && validSessionId(direct)) return { sessionId: direct, fallback: false }
  const connected = bridge.connectedSessions()
  if (connected.length === 1) return { sessionId: connected[0], fallback: true }
  return null
}

function asResultObject(value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value
  return { result: value === undefined ? null : value }
}

/**
 * The per-process token authorises local file reads, so it must never reach the
 * model. Any string below a tool result that still carries it is redacted; the
 * page can echo token-bearing urls in status/list payloads.
 */
function scrubToken(value) {
  if (typeof value === 'string') {
    return value.includes(TOKEN) ? value.split(TOKEN).join('[token redacted]') : value
  }
  if (Array.isArray(value)) return value.map(scrubToken)
  if (value !== null && typeof value === 'object') {
    const cleaned = {}
    for (const [key, item] of Object.entries(value)) cleaned[key] = scrubToken(item)
    return cleaned
  }
  return value
}

/**
 * Session-scoped command bridge between the Host tools and the browser panel.
 *
 * Each open tab holds one SSE connection. A command is delivered only to the
 * newest connection of its session, so several open tabs can never run the same
 * load or capture twice; older tabs keep their stream and heartbeat but stay
 * idle. The first acknowledgement settles the call, and calls for one session
 * run one at a time so concurrent tool calls cannot interleave camera changes.
 */
function createBridge(allowedDirs) {
  const sessions = new Map()
  const pending = new Map()
  const queues = new Map()
  let sequence = 0

  const connectedSessions = () =>
    [...sessions.keys()].filter((sessionId) => (sessions.get(sessionId)?.size ?? 0) > 0)

  const writeFrame = (connection, frame) => {
    if (connection.closed) return false
    try {
      connection.res.write(frame)
      return true
    } catch {
      connection.detach()
      return false
    }
  }

  const attach = (sessionId, req, res) => {
    const connections = sessions.get(sessionId) ?? new Set()
    sessions.set(sessionId, connections)
    const connection = { res, closed: false, timer: null, detach: null }
    const detach = () => {
      if (connection.closed) return
      connection.closed = true
      if (connection.timer !== null) clearInterval(connection.timer)
      connections.delete(connection)
      if (connections.size === 0 && sessions.get(sessionId) === connections) sessions.delete(sessionId)
    }
    connection.detach = detach
    connections.add(connection)
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.write('retry: 3000\n\n')
    res.write(`event: hello\ndata: ${JSON.stringify({ session: sessionId })}\n\n`)
    connection.timer = setInterval(() => {
      if (connection.closed) return
      try {
        res.write(': ping\n\n')
      } catch {
        detach()
      }
    }, BRIDGE_HEARTBEAT_MS)
    connection.timer.unref?.()
    req.on('close', detach)
    req.on('error', detach)
    return connection
  }

  /** Run one task after every earlier task of the same session settled. */
  const enqueue = (sessionId, task) => {
    const previous = queues.get(sessionId) ?? Promise.resolve()
    const current = previous.then(task, task)
    let tail
    tail = current
      .then(() => undefined, () => undefined)
      .finally(() => {
        if (queues.get(sessionId) === tail) queues.delete(sessionId)
      })
    queues.set(sessionId, tail)
    return current
  }

  const run = (sessionId, action, args, timeoutMs, signal) => {
    // Local loads are gated here, before the command reaches any browser tab:
    // the panel's `/scan` call made afterwards can only re-register a folder
    // the user already opened.
    const denial = loadPathDenial(action, args, allowedDirs)
    if (denial !== null) return Promise.reject(new Error(denial))
    const deadline = Date.now() + timeoutMs
    return enqueue(sessionId, () => new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error(`The "${action}" command was cancelled before it reached the digital earth panel.`))
        return
      }
      const connections = sessions.get(sessionId)
      if (!connections || connections.size === 0) {
        reject(new Error(PANEL_CLOSED_MESSAGE))
        return
      }
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        reject(new Error(timeoutMessage(action, timeoutMs) + (connections.size > 1 ? MULTI_TAB_HINT : '')))
        return
      }
      const id = `earth-${Date.now().toString(36)}-${(sequence += 1)}`
      let abortListener = null
      const job = {
        session: sessionId,
        settled: false,
        timer: null,
        finish: (error, value) => {
          if (job.settled) return
          job.settled = true
          if (job.timer !== null) clearTimeout(job.timer)
          if (abortListener !== null) signal?.removeEventListener?.('abort', abortListener)
          pending.delete(id)
          if (error) reject(error)
          else resolve(value === undefined ? {} : value)
        },
      }
      abortListener = () => job.finish(new Error(`The "${action}" command was cancelled.`))
      signal?.addEventListener?.('abort', abortListener, { once: true })
      pending.set(id, job)
      const timerMessage = timeoutMessage(action, timeoutMs) + (connections.size > 1 ? MULTI_TAB_HINT : '')
      job.timer = setTimeout(() => job.finish(new Error(timerMessage)), remaining)
      job.timer.unref?.()
      const frame = `event: command\ndata: ${JSON.stringify({ id, action, args })}\n\n`
      // Only the newest attachment executes: an older tab that still has the
      // panel open must stay idle instead of running the command a second time.
      const newest = [...connections].pop()
      if (!newest || !writeFrame(newest, frame)) job.finish(new Error(PANEL_CLOSED_MESSAGE))
    }))
  }

  /** Settle a pending command from the browser acknowledgement, first ack wins. */
  const settle = (sessionId, id, payload) => {
    const job = pending.get(id)
    if (!job || job.settled || job.session !== sessionId) return false
    if (payload.ok === true) {
      job.finish(null, payload.result)
      return true
    }
    const message = typeof payload.error === 'string' && payload.error.trim() !== ''
      ? scrubToken(payload.error.trim().slice(0, 2000))
      : 'The digital earth panel reported the command as failed without an error message.'
    job.finish(new Error(message))
    return true
  }

  const dispose = () => {
    for (const job of [...pending.values()]) {
      if (!job.settled) job.finish(new Error('The digital earth bridge was unloaded before the command completed.'))
    }
    pending.clear()
    for (const connections of [...sessions.values()]) {
      for (const connection of [...connections]) {
        connection.closed = true
        if (connection.timer !== null) clearInterval(connection.timer)
        try {
          connection.res.end()
        } catch {
          // The page is already gone.
        }
      }
    }
    sessions.clear()
    queues.clear()
  }

  return { attach, run, settle, connectedSessions, dispose }
}

function validSessionId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u0020]/.test(value)
}

function bridgeHandler(bridge) {
  return (req, res) => {
    let parsed
    try {
      parsed = new URL(req.url ?? '/', 'http://localhost')
    } catch {
      return sendText(res, 400, 'bad request')
    }
    if (parsed.searchParams.get('token') !== TOKEN) return sendText(res, 403, 'forbidden')
    if (req.method === 'GET') {
      const session = parsed.searchParams.get('session') ?? ''
      if (!validSessionId(session)) return sendText(res, 400, 'missing or invalid session')
      bridge.attach(session, req, res)
      return
    }
    if (req.method === 'POST') return bridgeAck(bridge, req, res)
    return sendText(res, 405, 'method not allowed')
  }
}

/** POST: the browser acknowledges one command; unknown or stale ids are ignored. */
async function bridgeAck(bridge, req, res) {
  try {
    let body = ''
    try {
      for await (const chunk of req) {
        body += chunk
        if (body.length > MAX_BRIDGE_BODY) {
          req.destroy()
          return sendText(res, 413, 'payload too large')
        }
      }
    } catch {
      return sendText(res, 400, 'bad request')
    }
    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      return sendText(res, 400, 'invalid json')
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return sendText(res, 400, 'invalid ack')
    }
    const session = typeof payload.session === 'string' ? payload.session : ''
    const id = typeof payload.id === 'string' ? payload.id : ''
    if (session !== '' && id !== '') bridge.settle(session, id, payload)
    res.writeHead(204, { 'cache-control': 'no-store' })
    res.end()
  } catch {
    if (!res.writableEnded) sendText(res, 400, 'bad ack')
  }
}

function sanitizeLabel(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function timeStamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/**
 * Keep only the newest screenshots so the capture folder cannot grow without
 * bound. Pruning is best effort and must never fail the capture that wrote the
 * newest file.
 */
async function pruneCaptures(keepName) {
  const entries = await fs.readdir(CAPTURES_DIR, { withFileTypes: true })
  const names = entries
    .filter((entry) => entry.isFile() && /^earth-.+\.(jpe?g|png)$/i.test(entry.name))
    .map((entry) => entry.name)
  if (names.length <= MAX_CAPTURE_FILES) return
  const stats = []
  for (const name of names) {
    try {
      stats.push({ name, mtime: (await fs.stat(join(CAPTURES_DIR, name))).mtimeMs })
    } catch {
      stats.push({ name, mtime: 0 })
    }
  }
  stats.sort((a, b) => b.mtime - a.mtime || (a.name < b.name ? 1 : -1))
  let remaining = stats.length
  // Delete from the oldest end, never the file written by this capture.
  for (let index = stats.length - 1; index >= 0 && remaining > MAX_CAPTURE_FILES; index -= 1) {
    const item = stats[index]
    if (item.name === keepName) continue
    await fs.rm(join(CAPTURES_DIR, item.name), { force: true })
    remaining -= 1
  }
}

/** POST: the page uploads a rendered screenshot; answer with the stored file. */
async function captureHandler(req, res) {
  if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
  let parsed
  try {
    parsed = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    return sendText(res, 400, 'bad request')
  }
  if (parsed.searchParams.get('token') !== TOKEN) return sendText(res, 403, 'forbidden')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_CAPTURE_BODY) {
        req.destroy()
        return sendText(res, 413, 'payload too large')
      }
    }
  } catch {
    return sendText(res, 400, 'bad request')
  }
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return sendText(res, 400, 'invalid json')
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return sendText(res, 400, 'invalid capture')
  }
  const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : ''
  const image = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (image === null) return sendText(res, 400, 'invalid image data')
  const bytes = Buffer.from(image[2], 'base64')
  if (bytes.length === 0) return sendText(res, 400, 'empty image data')
  const extension = image[1] === 'png' ? 'png' : 'jpg'
  const label = sanitizeLabel(payload.label)
  const name = `earth-${timeStamp()}-${randomBytes(4).toString('hex')}${label === '' ? '' : `-${label}`}.${extension}`
  const target = join(CAPTURES_DIR, name)
  try {
    await fs.mkdir(CAPTURES_DIR, { recursive: true })
    await fs.writeFile(target, bytes)
  } catch (error) {
    return sendText(res, 500, `capture save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  const value = { path: target, url: `${FILES_ROUTE}/${TOKEN}/${name}`, bytes: bytes.length }
  if (Number.isInteger(payload.width) && payload.width > 0) value.width = payload.width
  if (Number.isInteger(payload.height) && payload.height > 0) value.height = payload.height
  try {
    await pruneCaptures(name)
  } catch {
    // Retention is best effort; the capture itself already succeeded.
  }
  sendJson(res, 200, value)
}

/** GET: serve a captured screenshot back to the page that produced it. */
function capturesHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'method not allowed')
  const raw = subPath(requestPath(req), FILES_ROUTE)
  if (raw === null) return sendText(res, 404, 'not found')
  const parts = segments(raw)
  const name = parts.length === 2 && parts[0] === TOKEN ? decodeSegment(parts[1]) : null
  if (name === null || !/^[A-Za-z0-9._-]+$/.test(name)) return sendText(res, 403, 'forbidden')
  serveFile(req, res, CAPTURES_DIR, name, 'no-store')
}

/** Turn a capture acknowledgement into the tool result, verified against the disk. */
async function captureResultValue(ack, request) {
  const result = asResultObject(ack)
  const reported = typeof result.path === 'string' ? result.path.trim() : ''
  if (reported === '') {
    throw captureError('the panel did not report a written image file; the capture failed. Retry, and if it keeps failing check the browser console for canvas or WebGL errors.')
  }
  const target = resolve(reported)
  if (!within(CAPTURES_DIR, target)) {
    throw captureError('the panel reported an image path outside the host capture folder; no file was returned.')
  }
  let stat
  try {
    stat = await fs.stat(target)
  } catch {
    throw captureError('the captured image file is missing on disk; retry the capture.')
  }
  if (!stat.isFile() || stat.size === 0) throw captureError('the captured image file is empty; retry the capture.')
  // No file url in the tool result: it would carry the per-process token and
  // the model only needs the absolute path to read the image back.
  const value = {
    path: target,
    bytes: stat.size,
    hud_hidden: typeof result.hud_hidden === 'boolean'
      ? result.hud_hidden
      : typeof result.hud === 'boolean'
        ? !result.hud
        : request.includeHud !== true,
    note: CAPTURE_NOTE,
  }
  if (Number.isInteger(result.width) && result.width > 0) value.width = result.width
  if (Number.isInteger(result.height) && result.height > 0) value.height = result.height
  // The page reports the camera as `view`; expose it as `camera` so the model
  // gets place context next to the image. `camera` is accepted for older pages.
  const view = result.view !== null && typeof result.view === 'object' && !Array.isArray(result.view) ? result.view : result.camera
  if (view !== null && typeof view === 'object' && !Array.isArray(view)) value.camera = view
  if (Number.isInteger(result.layers_visible) && result.layers_visible >= 0) value.layers_visible = result.layers_visible
  return value
}

function renderSceneResult(value) {
  let text
  try {
    text = JSON.stringify(value)
  } catch {
    return '[digital earth result is not JSON serializable]'
  }
  if (typeof text !== 'string') return 'null'
  if (Buffer.byteLength(text, 'utf8') <= SCENE_RENDER_LIMIT) return text
  // Cut on code-point boundaries so a surrogate pair or multi-byte character is
  // never split, and keep the budget in UTF-8 bytes rather than JS characters.
  let head = ''
  let used = 0
  for (const character of text) {
    const size = Buffer.byteLength(character, 'utf8')
    if (used + size > SCENE_RENDER_LIMIT) break
    head += character
    used += size
  }
  return `${head}\n[result truncated at ${SCENE_RENDER_LIMIT} UTF-8 bytes; request a narrower earth_scene action for the rest]`
}

function renderCaptureResult(value) {
  const lines = [`Captured image: ${value.path}`]
  const dimensions = Number.isInteger(value.width) && Number.isInteger(value.height) ? `${value.width}x${value.height} px, ` : ''
  const hud = value.hud_hidden === true ? '; HUD and toolbars hidden' : ''
  lines.push(`${dimensions}${value.bytes} bytes${hud}.`)
  const context = []
  const camera = value.camera !== null && typeof value.camera === 'object' && !Array.isArray(value.camera) ? value.camera : null
  if (camera !== null) {
    if (Number.isFinite(camera.lon)) context.push(`lon=${camera.lon}`)
    if (Number.isFinite(camera.lat)) context.push(`lat=${camera.lat}`)
    if (Number.isFinite(camera.height)) context.push(`height=${camera.height}m`)
  }
  if (Number.isInteger(value.layers_visible)) context.push(`layers_visible=${value.layers_visible}`)
  if (context.length > 0) lines.push(`Camera and scene context: ${context.join(', ')}.`)
  if (typeof value.note === 'string') lines.push(value.note)
  return lines.join('\n')
}

function createSceneTool(bridge) {
  return {
    name: SCENE_TOOL_NAME,
    description: SCENE_DESCRIPTION,
    parameters: SCENE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderSceneResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeSceneRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, request.action, request.args, SCENE_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}

function createCaptureTool(bridge) {
  return {
    name: CAPTURE_TOOL_NAME,
    description: CAPTURE_DESCRIPTION,
    parameters: CAPTURE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderCaptureResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeCaptureRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const ack = await bridge.run(target.sessionId, 'capture', request.args, CAPTURE_TIMEOUT_MS, exec.signal)
      const value = scrubToken(await captureResultValue(ack, request))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}

/**
 * Agent tools and the prompt section are optional: mount them only when the
 * host provides the tools and system-prompt services, so the panel HTTP API
 * keeps working in a build without an agent runtime.
 */
function mountAgentTools(ctx, bridge) {
  ctx.inject(['tools', 'systemPrompt'], (scope) => {
    scope.effect(() => {
      const disposers = [
        scope.tools.register(createSceneTool(bridge)),
        scope.tools.register(createCaptureTool(bridge)),
        scope.systemPrompt.section({
          name: 'plugin:digital-earth',
          order: 810,
          text: SYSTEM_PROMPT_SECTION,
        }),
      ]
      return () => {
        for (const dispose of disposers) {
          if (typeof dispose !== 'function') continue
          try {
            dispose()
          } catch {
            // One broken contribution must not strand the others.
          }
        }
      }
    }, 'digital-earth agent tools')
  })
}

export const inject = ['webServer', 'connection']

export function apply(ctx) {
  // Directories this page opened through `/scan`; tile files are served only from
  // them, so a token holder cannot read arbitrary paths on the machine.
  const allowedDirs = new Set()

  // Commands from Host tools to the open panel live for the plugin lifetime.
  const bridge = createBridge(allowedDirs)

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
      register('exact', BRIDGE_ROUTE, bridgeHandler(bridge)),
      register('exact', CAPTURE_ROUTE, captureHandler),
      register('prefix', FILES_ROUTE, capturesHandler),
    ]
    return () => {
      for (const dispose of disposers) {
        if (typeof dispose === 'function') dispose()
      }
      bridge.dispose()
    }
  }, 'digital-earth api routes')

  mountAgentTools(ctx, bridge)
}

