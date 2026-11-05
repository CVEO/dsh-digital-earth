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
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createReadStream, readFileSync, promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'
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
// Remembered-folder list for the panel's data menu. This is page-only data: the
// page opened those folders itself, and no tool result ever exposes them.
const DIRECTORIES_ROUTE = `${API}/directories`
// Per-session scene snapshots. The panel writes them to the host so a remounted
// tab (or a DSH restart that changes the page origin) can restore camera, layers
// and overlays; the response is page-only data and never reaches a tool result.
const SCENE_ROUTE = `${API}/scene`
// The panel's "ask Agent" button injects a scene summary into the running
// conversation agent. Bound both directions: the page can only push text, and
// the host caps how much of it can ever enter the model context.
const INJECT_ROUTE = `${API}/inject`
const MAX_INJECT_BODY = 16 * 1024
const MAX_INJECT_TEXT = 4000
// Scene reports are whole documents (optionally with an embedded screenshot).
const REPORT_ROUTE = `${API}/report`
const REPORT_FORMATS = new Set(['html', 'markdown'])
const MAX_REPORT_BODY = 16 * 1024 * 1024
const MAX_EXPORT_FILES = 200
const MAX_SCENE_BODY = 512 * 1024
const MAX_SCENE_FILES = 50
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
// Folders the user opened in the panel, remembered across DSH restarts so the
// agent may load the same data again without another panel gesture.
const DIRECTORIES_FILE = join(STATE_DIR, 'directories.json')
const MAX_RECENT_DIRECTORIES = 20
const CAPTURES_DIR = resolve(STATE_DIR, 'captures')
const EXPORTS_DIR = resolve(STATE_DIR, 'exports')
const SCENES_DIR = resolve(STATE_DIR, 'scenes')
const PACKAGE_FILE = join(ROOT_DIR, 'package.json')
const MAX_SOURCES_BODY = 128 * 1024
const MAX_BRIDGE_BODY = 256 * 1024
const MAX_CAPTURE_BODY = 16 * 1024 * 1024
const MAX_CAPTURE_FILES = 50
// Signed tile and WMS URLs carry their credentials in the query string, which
// the panel appends verbatim to the proxy path. Keep it bounded: the proxy must
// never turn into a way to make the host issue very long upstream URLs.
const MAX_REMOTE_QUERY = 2048
// Static tileset health check: bounded request/response sizes, bounded BFS and
// one shared 8 s budget for every remote read of a single inspection.
const INSPECT_ROUTE = `${API}/inspect`
const MAX_INSPECT_BODY = 64 * 1024
const MAX_INSPECT_JSON = 8 * 1024 * 1024
const MAX_INSPECT_CONTENT_BYTES = 256 * 1024 * 1024
const MAX_INSPECT_CONTENT_CHECKS = 200
const MAX_INSPECT_TILESETS = 50
const MAX_INSPECT_ISSUES = 200
const MAX_INSPECT_REPORTS = 100
const INSPECT_FETCH_TIMEOUT_MS = 8000
// The bridge command lets the panel resolve a layer source first; the contract
// keeps that budget at 20 s or more, independent of the normal scene budget.
const INSPECT_BRIDGE_TIMEOUT_MS = 30000
const REPORT_DIR = resolve(STATE_DIR, 'reports')
// SPZ (Niantic Gaussian splat) header: magic, version, numPoints as little-endian
// uint32 values. Only used for a best-effort local check; a parse failure is a
// warning and never fails the inspection.
const SPZ_MAGIC = 0x5053474e
const BRIDGE_HEARTBEAT_MS = 15000
const SCENE_TIMEOUT_MS = 20000
const CAPTURE_TIMEOUT_MS = 40000
// Drawing and measurement are browser-side and synchronous, so a stuck tab is
// the only slow case; 15 s leaves room for a first frame without holding a turn.
const DRAW_TIMEOUT_MS = 15000
const MEASURE_TIMEOUT_MS = 15000
// A report may capture a screenshot and build a document before the host writes
// it, so it gets a longer budget than a plain scene action.
const REPORT_TIMEOUT_MS = 45000
// Bounded model input: one call may add at most this many annotations and
// coordinates, so a runaway GeoJSON cannot freeze the panel.
const MAX_DRAW_FEATURES = 500
const MAX_DRAW_COORDINATES = 20000
const MAX_MEASURE_POINTS = 200
const MIN_MEASURE_POINTS = 2
// A tool call can arrive before the panel tab exists: the client half opens the
// docked panel on demand and then connects its SSE stream. The bridge waits this
// long for that connection so the first call in a closed conversation works.
const PANEL_ATTACH_GRACE_MS = 8000
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
  settings: { theme: 'auto', imagery: 'esri-world-imagery', terrain: null, screenshotHud: false, showLayers: true, showHud: true },
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
  version: '1.4.0',
  homepage: 'https://github.com/CVEO/dsh-digital-earth',
  issues: 'https://github.com/CVEO/dsh-digital-earth/issues',
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
    // Not a package.json field of this plugin: the repository issues page is a
    // fixed fact, so the About tab does not depend on the publish metadata.
    issues: FALLBACK_ABOUT.issues,
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
export function normalizeConfig(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const theme = THEME_MODES.has(input.settings?.theme) ? input.settings.theme : 'auto'
  // The layer list and HUD default to visible; only an explicit false hides
  // them, so catalogs written by older versions keep both controls visible.
  const showLayers = input.settings?.showLayers !== false
  const showHud = input.settings?.showHud !== false
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
      showLayers,
      showHud,
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

// ---------------------------------------------------------------------------
// Remembered folders (directories.json). `/scan` remains the only way a folder
// enters the allowlist, but that gesture is a user decision: remembering it lets
// the agent load the same data after a DSH restart without asking again. The
// list is page-only data for the panel's data menu; it never reaches tool
// results, so absolute local paths stay between the host and this page.
// ---------------------------------------------------------------------------

/**
 * Test seam: pure merge for the remembered-folder list. The new entry becomes
 * the newest item, a duplicate path keeps only its newest position, and the
 * result is capped at `max`. Neither argument is mutated.
 */
export function mergeRecentDirectories(list, entry, max = MAX_RECENT_DIRECTORIES) {
  const entries = []
  if (entry !== null && typeof entry === 'object' && typeof entry.path === 'string' && entry.path.trim() !== '') {
    const at = typeof entry.at === 'string' && entry.at !== '' ? entry.at : new Date().toISOString()
    entries.push({ path: entry.path.trim(), at })
  }
  if (Array.isArray(list)) entries.push(...list)
  return sanitizeRecentDirectories(entries, max)
}

/** Deduplicate by path, keep arrival order (newest first), cap the length. */
function sanitizeRecentDirectories(entries, max = MAX_RECENT_DIRECTORIES) {
  const limit = Number.isInteger(max) && max > 0 ? max : MAX_RECENT_DIRECTORIES
  const seen = new Set()
  const clean = []
  for (const item of entries) {
    if (item === null || typeof item !== 'object') continue
    if (typeof item.path !== 'string' || item.path.trim() === '') continue
    const path = item.path.trim()
    if (seen.has(path)) continue
    seen.add(path)
    clean.push({ path, at: typeof item.at === 'string' ? item.at : '' })
    if (clean.length >= limit) break
  }
  return clean
}

async function readRecentDirectories() {
  let text
  try {
    text = await fs.readFile(DIRECTORIES_FILE, 'utf8')
  } catch {
    return []
  }
  try {
    const parsed = JSON.parse(text)
    const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.directories) ? parsed.directories : []
    return sanitizeRecentDirectories(entries)
  } catch {
    return []
  }
}

/** Replace the remembered list atomically, with the catalog's temp+rename rule. */
async function writeRecentDirectories(list) {
  await fs.mkdir(STATE_DIR, { recursive: true })
  const temporary = `${DIRECTORIES_FILE}.tmp-${randomBytes(6).toString('hex')}`
  try {
    await fs.writeFile(temporary, `${JSON.stringify(list, null, 2)}\n`, 'utf8')
    await renameWithRetry(temporary, DIRECTORIES_FILE)
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

/** Best effort: a read-only DSH home must never fail a panel request. */
function persistRecentDirectories(list) {
  return writeRecentDirectories(list).catch(() => {})
}

/**
 * GET: folders remembered from earlier sessions. This response is data for the
 * page only — it is never merged into a tool result, so the token-bearing route
 * cannot hand absolute local paths to the model.
 */
async function directoriesHandler(getDirectories, req, res) {
  const entries = typeof getDirectories === 'function' ? getDirectories() : []
  const directories = []
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (directories.length >= MAX_RECENT_DIRECTORIES) break
    // A moved or unmounted folder stays listed with exists:false so the user
    // can see why loading from it would fail.
    let exists = false
    try {
      await fs.access(entry.path)
      exists = true
    } catch {
      // Missing on purpose; the flag above is the answer.
    }
    directories.push({ path: entry.path, name: basename(entry.path), at: entry.at, exists })
  }
  sendJson(res, 200, { directories })
}

// ---------------------------------------------------------------------------
// Per-session scene snapshots: the panel persists camera, layers and overlays so
// a remounted tab restores them. The JSON is page-only data and never enters a
// tool result; the session id is hashed into the file name.
// ---------------------------------------------------------------------------

/** Deterministic, filesystem-safe file name for one session id. */
export function sceneSnapshotFile(sessionId) {
  return join(SCENES_DIR, `${createHash('sha256').update(sessionId).digest('hex')}.json`)
}

/** GET/PUT one session's scene snapshot. */
export async function sceneSnapshotHandler(req, res) {
  let parsed
  try {
    parsed = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    return sendText(res, 400, 'bad request')
  }
  const session = parsed.searchParams.get('session') ?? ''
  if (!validSessionId(session)) return sendText(res, 400, 'missing or invalid session')
  const file = sceneSnapshotFile(session)
  if (req.method === 'GET') {
    try {
      const stored = JSON.parse(await fs.readFile(file, 'utf8'))
      if (
        stored === null ||
        typeof stored !== 'object' ||
        stored.session !== session ||
        stored.snapshot === null ||
        typeof stored.snapshot !== 'object'
      ) {
        return sendJson(res, 200, { snapshot: null })
      }
      return sendJson(res, 200, {
        snapshot: stored.snapshot,
        savedAt: typeof stored.savedAt === 'string' ? stored.savedAt : null,
      })
    } catch {
      // Missing, unreadable or corrupt: the page falls back to its local cache.
      return sendJson(res, 200, { snapshot: null })
    }
  }
  if (req.method !== 'PUT') return sendText(res, 405, 'method not allowed')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_SCENE_BODY) {
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
  const snapshot = payload?.snapshot
  if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return sendText(res, 400, 'invalid snapshot')
  }
  const stored = { version: 1, session, savedAt: new Date().toISOString(), snapshot }
  try {
    await fs.mkdir(SCENES_DIR, { recursive: true })
    const temporary = `${file}.tmp-${randomBytes(6).toString('hex')}`
    try {
      await fs.writeFile(temporary, JSON.stringify(stored), 'utf8')
      await renameWithRetry(temporary, file)
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {})
      throw error
    }
  } catch (error) {
    return sendText(res, 500, `save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  void pruneSceneSnapshots().catch(() => {})
  return sendJson(res, 200, { ok: true, savedAt: stored.savedAt })
}

/** Keep the newest MAX_SCENE_FILES snapshots; older sessions are dropped. */
async function pruneSceneSnapshots() {
  let entries
  try {
    entries = await fs.readdir(SCENES_DIR, { withFileTypes: true })
  } catch {
    return
  }
  const files = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      const info = await fs.stat(join(SCENES_DIR, entry.name))
      files.push({ name: entry.name, mtime: info.mtimeMs })
    } catch {
      // The file disappeared while listing; nothing to prune.
    }
  }
  if (files.length <= MAX_SCENE_FILES) return
  files.sort((left, right) => left.mtime - right.mtime)
  for (let index = 0; index < files.length - MAX_SCENE_FILES; index += 1) {
    await fs.rm(join(SCENES_DIR, files[index].name), { force: true }).catch(() => {})
  }
}

/**
 * POST: put the panel's scene summary into the live conversation agent's inbox.
 *
 * The message is injected into the next admitted step, so the user can press
 * "Ask Agent" and then simply type the question. The page is trusted (token +
 * same-origin route), but the text is still bounded and stripped of control
 * characters so a buggy or hostile page cannot flood the model context.
 */
export async function injectHandler(ctx, req, res) {
  if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_INJECT_BODY) {
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
  const session = typeof payload?.session === 'string' ? payload.session : ''
  if (!validSessionId(session)) return sendText(res, 400, 'missing or invalid session')
  const text = String(payload?.text ?? '')
    // Drop every C0 control character except tab and newline; keep the two
    // whitespace controls the model can actually use (CR included in the strip).
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, '')
    .trim()
    .slice(0, MAX_INJECT_TEXT)
  if (text === '') return sendText(res, 400, 'missing text')
  let agents
  try {
    agents = ctx.get('agents') ?? ctx.agents
  } catch {
    agents = null
  }
  if (!agents || typeof agents.get !== 'function') {
    return sendJson(res, 503, {
      ok: false,
      error: 'agent_unavailable',
      message: 'The Agent runtime is unavailable in this DSH build.',
    })
  }
  const agent = agents.get(session)
  if (!agent || typeof agent.inject !== 'function') {
    return sendJson(res, 409, {
      ok: false,
      error: 'agent_not_running',
      message: 'This conversation has no running agent. Send a message first, then retry.',
    })
  }
  try {
    agent.inject({
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'digital-earth', form: 'notice', summary: 'Digital Earth scene context' },
    })
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: 'inject_failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
  return sendJson(res, 200, { ok: true })
}

/** Hosts the proxy must never reach: loopback, private ranges and link-local. */
function blockedHost(origin) {  let hostname
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

/** Case-folded on Windows: the filesystem there is case-insensitive. */
function within(root, target) {
  return isWithinDirectory(target, root)
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

// ---------------------------------------------------------------------------
// Local tileset resolution (v1.4.0). A tool call may point at a folder, at a
// file that has moved, or at a path below a folder the user has not opened yet.
// Resolution reads filesystem metadata only (never file contents) inside a
// bounded search; when the resolved file is outside the allowlist the bridge
// asks the panel for one-time permission.
// ---------------------------------------------------------------------------

/** The panel dialog timeout is independent from SCENE_TIMEOUT_MS. */
const LOCAL_ACCESS_TIMEOUT_MS = 30000
const LOCAL_SEARCH_DEPTH = 3
const LOCAL_SEARCH_ITEMS = 200
const LOCAL_ANCESTOR_HOPS = 2
const LOCAL_CANDIDATE_LIMIT = 10

/** A local path failure with a stable code and one actionable next step. */
class LocalPathError extends Error {
  constructor(code, summary, next) {
    super(`[${code}] ${summary} next: ${next}`)
    this.name = 'LocalPathError'
    this.code = code
  }
}

const localPathError = (code, summary, next) => new LocalPathError(code, summary, next)

/** Strip chat-copy noise (line breaks, wrapping quotes) without guessing. */
function normalizeLocalInput(value) {
  if (typeof value !== 'string') return ''
  let text = value.replace(/[\r\n]+/g, ' ').trim()
  for (;;) {
    if (text.length < 2) break
    const quote = text[0]
    if ((quote !== '"' && quote !== "'") || text[text.length - 1] !== quote) break
    text = text.slice(1, -1).trim()
  }
  return text
}

/** Bounded BFS: at most LOCAL_SEARCH_ITEMS entries and LOCAL_SEARCH_DEPTH levels. */
async function searchLocalTilesets(base) {
  const found = []
  let visited = 0
  let truncated = false
  const queue = [{ directory: base, depth: 0 }]
  while (queue.length > 0 && !truncated) {
    const { directory, depth } = queue.shift()
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (visited >= LOCAL_SEARCH_ITEMS) {
        truncated = true
        break
      }
      visited += 1
      if (entry.isDirectory()) {
        if (depth < LOCAL_SEARCH_DEPTH) queue.push({ directory: join(directory, entry.name), depth: depth + 1 })
      } else if (entry.isFile() && entry.name.toLowerCase() === 'tileset.json') {
        found.push(join(directory, entry.name))
      }
    }
  }
  return { found, visited, truncated }
}

/** Resolve and keep only files whose real path stays inside the searched folder. */
async function insideFolder(files, base) {
  const inside = []
  for (const file of files) {
    const real = await realPathOr(file)
    if (isWithinDirectory(real, base)) inside.push(real)
  }
  return inside
}

function ambiguousLocalPath(base, files) {
  const shown = files.slice(0, LOCAL_CANDIDATE_LIMIT).map((file) => relative(base, file).split(sep).join('/'))
  const more = files.length > shown.length ? `, and ${files.length - shown.length} more` : ''
  return localPathError(
    'ambiguous_local_path',
    `found ${files.length} tileset.json files under "${base}": ${shown.join(', ')}${more}.`,
    'call again with the exact path of the tileset.json you want.',
  )
}

/** A real search base must never be a drive/share root reached through a junction. */
function assertSearchBase(base, requested) {
  if (isUncPath(base) || isFilesystemRoot(base)) {
    throw localPathError(
      'invalid_local_path',
      `"${requested}" resolves to a filesystem or share root.`,
      'pass a folder below a root, not the root itself.',
    )
  }
}

/**
 * Resolve a model-supplied local path to one concrete tileset.json.
 *
 * - an existing file is used as-is;
 * - an existing folder is searched (depth <= 3, <= 200 entries) for the unique
 *   tileset.json below it;
 * - a missing path climbs at most two parent folders and searches the nearest
 *   existing one, so a renamed/moved folder still heals in one call;
 * - roots and UNC paths are refused, and every returned real path is re-checked
 *   against the folder that was searched (symlink escapes are dropped);
 * - when `allowedDirs` is given, the final file must also stay inside one of
 *   them, otherwise the call fails with access_denied.
 *
 * Test seam: exported for unit tests; also used by earth_scene load/inspect.
 */
export async function resolveLocalTileset(rawPath, allowedDirs = null) {
  const requested = normalizeLocalInput(rawPath)
  if (requested === '') {
    throw localPathError('invalid_local_path', 'the local path is empty.', 'pass an absolute path to a tileset.json.')
  }
  if (!isAbsolute(requested)) {
    throw localPathError('invalid_local_path', `"${requested}" is not an absolute path.`, 'pass an absolute path, not a relative one.')
  }
  const resolved = resolve(requested)
  if (isUncPath(resolved)) {
    throw localPathError('invalid_local_path', 'UNC network paths are not supported.', 'copy the data to a local drive and pass that path.')
  }
  if (isFilesystemRoot(resolved)) {
    throw localPathError('invalid_local_path', `"${resolved}" is a filesystem or share root.`, 'pass a folder below a root, not the root itself.')
  }
  let stat = null
  try {
    stat = await fs.stat(resolved)
  } catch {
    stat = null
  }
  let kind = 'missing'
  let base = null
  let target = null
  let files = []
  let truncated = false
  if (stat !== null && stat.isFile()) {
    kind = 'file'
    target = await realPathOr(resolved)
  } else if (stat !== null && stat.isDirectory()) {
    kind = 'directory'
    base = await realPathOr(resolved)
    assertSearchBase(base, resolved)
    const searched = await searchLocalTilesets(base)
    files = await insideFolder(searched.found, base)
    truncated = searched.truncated
  } else {
    // A missing path heals only when a parent within two levels exists; the
    // search never climbs to a drive/share root.
    let ancestor = null
    let candidate = dirname(resolved)
    for (let hop = 0; hop < LOCAL_ANCESTOR_HOPS && candidate !== '' && candidate !== null; hop += 1) {
      if (isUncPath(candidate) || isFilesystemRoot(candidate)) break
      let ancestorStat = null
      try {
        ancestorStat = await fs.stat(candidate)
      } catch {
        ancestorStat = null
      }
      if (ancestorStat !== null && ancestorStat.isDirectory()) {
        ancestor = candidate
        break
      }
      const parent = dirname(candidate)
      if (parent === candidate) break
      candidate = parent
    }
    if (ancestor === null) {
      throw localPathError(
        'path_not_found',
        `"${resolved}" does not exist and no existing parent folder was found within ${LOCAL_ANCESTOR_HOPS} levels.`,
        'check the path, then retry.',
      )
    }
    base = await realPathOr(ancestor)
    assertSearchBase(base, resolved)
    const searched = await searchLocalTilesets(base)
    files = await insideFolder(searched.found, base)
    truncated = searched.truncated
  }
  if (target !== null && (isUncPath(target) || isFilesystemRoot(target))) {
    throw localPathError('invalid_local_path', `"${resolved}" resolves to an unsupported network path.`, 'copy the data to a local drive and pass that path.')
  }
  if (target === null) {
    if (files.length === 0) {
      const limit = truncated ? ` (the search stopped at ${LOCAL_SEARCH_ITEMS} entries)` : ''
      const summary = kind === 'missing'
        ? `"${resolved}" does not exist and no tileset.json was found below its nearest existing parent "${base}"`
        : `no tileset.json was found below "${base}"`
      throw localPathError('no_tileset_found', `${summary}${limit}.`, 'pass the exact tileset.json path, or a folder that contains one.')
    }
    if (files.length > 1) throw ambiguousLocalPath(base, files)
    target = files[0]
  }
  const resolution = {
    requested: resolved,
    path: target,
    directory: dirname(target),
    kind,
  }
  // Only a healed path needs to be reported; a direct file is already what the
  // caller asked for (even when realpath normalises its case).
  if (kind !== 'file' && target !== resolved) resolution.resolvedFrom = resolved
  if (allowedDirs !== null && allowedDirs !== undefined && !isLocalResolutionAllowed(resolution, allowedDirs)) {
    throw localPathError(
      'access_denied',
      `the folder for "${resolved}" has not been opened in the Digital Earth panel.`,
      'ask the user to allow it in the panel; do not retry until they do.',
    )
  }
  return resolution
}

/** True when the resolved real file is inside one of the user-opened folders. */
export function isLocalResolutionAllowed(resolution, allowedDirs) {
  if (resolution === null || typeof resolution?.path !== 'string' || resolution.path === '') return false
  const folders = allowedDirs instanceof Set ? [...allowedDirs] : Array.isArray(allowedDirs) ? allowedDirs : []
  for (const folder of folders) {
    if (typeof folder !== 'string' || folder === '') continue
    if (isWithinDirectory(resolution.path, folder)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Local tileset georeferencing (v1.4.0 fix for OSGB-derived data).
//
// Some OSGB -> 3D Tiles converters write a tileset whose root tile has no
// `transform` and whose bounding volume is a plain local box: the GLB vertices
// are metres in an east-north-up frame, and the frame origin is recorded in a
// sibling `tileset_info.json` (`srs` + `srs_origin`). Cesium reads those metres
// as ECEF, so the whole scene collapses to within a few kilometres of the earth's
// centre: `flyTo` dives to the core (the globe then looks off-centre) and the
// tiles flicker in and out of the frustum as the camera moves through them.
//
// The host already serves every byte of a local tileset, so it derives the
// missing root transform from that sibling file instead of asking the user to
// rebuild the dataset. Nothing on disk is modified, and a tileset that already
// carries a world placement (`transform` or `region`) passes through untouched.
// ---------------------------------------------------------------------------

const GEOREF_INFO_FILE = 'tileset_info.json'
const MAX_GEOREF_JSON = 16 * 1024 * 1024
// CGCS2000 ellipsoid; WGS84 and CGCS2000 differ by well under a millimetre here.
const GEOREF_SEMI_MAJOR = 6378137
const GEOREF_FLATTENING = 1 / 298.257222101

/**
 * Gauss-Krueger frame of a CGCS2000 EPSG code, or null when the plugin cannot
 * place it without a projection database. The four Chinese families are
 * contiguous, so the central meridian and the false easting follow from the code
 * alone: 6-degree zones 13-23 (EPSG 4491-4501), 6-degree central meridians
 * 75E-135E (4502-4512), 3-degree zones 25-45 (4513-4533) and 3-degree central
 * meridians 75E-135E (4534-4554). EPSG:4547 is the 3-degree 114E frame.
 */
export function gaussKrugerFrame(srs) {
  const match = /^epsg:(\d+)$/i.exec(String(srs ?? '').trim())
  if (match === null) return null
  const code = Number(match[1])
  // Zone-numbered variants carry the zone as an easting prefix, so the false
  // easting is zone * 1e6 + 500 km rather than a flat 500 km.
  if (code >= 4491 && code <= 4501) {
    const zone = code - 4478
    return { centralMeridian: zone * 6, falseEasting: zone * 1e6 + 500000 }
  }
  if (code >= 4502 && code <= 4512) return { centralMeridian: 75 + (code - 4502) * 6, falseEasting: 500000 }
  if (code >= 4513 && code <= 4533) {
    const zone = code - 4488
    return { centralMeridian: zone * 3, falseEasting: zone * 1e6 + 500000 }
  }
  if (code >= 4534 && code <= 4554) return { centralMeridian: 75 + (code - 4534) * 3, falseEasting: 500000 }
  return null
}

/** Inverse transverse Mercator (Snyder series), accurate to about a millimetre in China. */
function gaussKrugerToGeodetic(easting, northing, frame) {
  const a = GEOREF_SEMI_MAJOR
  const e2 = GEOREF_FLATTENING * (2 - GEOREF_FLATTENING)
  const ep2 = e2 / (1 - e2)
  const rectifying = a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256)
  const mu = northing / rectifying
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const foot =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  const sin = Math.sin(foot)
  const cos = Math.cos(foot)
  const tan = Math.tan(foot)
  const n1 = a / Math.sqrt(1 - e2 * sin * sin)
  const r1 = (a * (1 - e2)) / (1 - e2 * sin * sin) ** 1.5
  const t1 = tan * tan
  const c1 = ep2 * cos * cos
  const d = (easting - frame.falseEasting) / n1
  const lat =
    foot -
    ((n1 * tan) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720)
  const lon =
    (frame.centralMeridian * Math.PI) / 180 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
      cos
  return { lon: (lon * 180) / Math.PI, lat: (lat * 180) / Math.PI }
}

function geodeticToEcef(lon, lat, height) {
  const a = GEOREF_SEMI_MAJOR
  const e2 = GEOREF_FLATTENING * (2 - GEOREF_FLATTENING)
  const lambda = (lon * Math.PI) / 180
  const phi = (lat * Math.PI) / 180
  const sin = Math.sin(phi)
  const cos = Math.cos(phi)
  const n = a / Math.sqrt(1 - e2 * sin * sin)
  return [(n + height) * cos * Math.cos(lambda), (n + height) * cos * Math.sin(lambda), (n * (1 - e2) + height) * sin]
}

/** East-north-up -> ECEF, packed the way a 3D Tiles root `transform` wants it. */
function eastNorthUpTransform(lon, lat, height) {
  const lambda = (lon * Math.PI) / 180
  const phi = (lat * Math.PI) / 180
  const sinLambda = Math.sin(lambda)
  const cosLambda = Math.cos(lambda)
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const origin = geodeticToEcef(lon, lat, height)
  return [
    -sinLambda,
    cosLambda,
    0,
    0,
    -sinPhi * cosLambda,
    -sinPhi * sinLambda,
    cosPhi,
    0,
    cosPhi * cosLambda,
    cosPhi * sinLambda,
    sinPhi,
    0,
    origin[0],
    origin[1],
    origin[2],
    1,
  ]
}

/**
 * Derive the missing root transform of an OSGB-derived local tileset from its
 * `tileset_info.json`. Returns null when the metadata is absent, incomplete or
 * names a CRS this plugin cannot place without a projection database.
 */
export function deriveLocalGeoreference(tilesetInfo) {
  if (tilesetInfo === null || typeof tilesetInfo !== 'object') return null
  const origin = tilesetInfo.srs_origin
  if (!Array.isArray(origin) || origin.length < 2) return null
  // `srs_origin` is [easting, northing, height] in the projected CRS; the third
  // value is the ellipsoid height of the local frame origin.
  const easting = Number(origin[0])
  const northing = Number(origin[1])
  const height = origin.length > 2 ? Number(origin[2]) : 0
  if (!Number.isFinite(easting) || !Number.isFinite(northing) || !Number.isFinite(height)) return null
  const frame = gaussKrugerFrame(tilesetInfo.srs)
  if (frame === null) return null
  const { lon, lat } = gaussKrugerToGeodetic(easting, northing, frame)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return null
  return {
    crs: String(tilesetInfo.srs).toUpperCase(),
    lon,
    lat,
    height,
    transform: eastNorthUpTransform(lon, lat, height),
  }
}

/** True when the root already carries a world placement Cesium can use as-is. */
export function tilesetRootIsGeoreferenced(root) {
  if (root === null || typeof root !== 'object') return false
  if (Array.isArray(root.transform) && root.transform.length === 16) return true
  const volume = root.boundingVolume
  return volume !== null && typeof volume === 'object' && volume.region !== undefined
}

/**
 * Add the derived root transform to a parsed tileset document.
 * Returns `{ document, georeference }`, or null when the document is already
 * georeferenced or no transform can be derived from the metadata.
 */
export function georeferenceTilesetDocument(document, tilesetInfo) {
  if (document === null || typeof document !== 'object') return null
  const root = document.root
  if (root === null || typeof root !== 'object') return null
  if (tilesetRootIsGeoreferenced(root)) return null
  const georeference = deriveLocalGeoreference(tilesetInfo)
  if (georeference === null) return null
  const transform = georeference.transform
  // `root.transform` is prepended to the tile hierarchy, so it lifts every child
  // out of local metres without touching the per-tile bounding volumes.
  return { document: { ...document, root: { ...root, transform } }, georeference }
}

/** Read `tileset_info.json` next to a local tileset; null when absent or invalid. */
async function readTilesetInfoFile(directory) {
  try {
    const text = await fs.readFile(join(directory, GEOREF_INFO_FILE), 'utf8')
    if (text.length > MAX_GEOREF_JSON) return null
    return JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

/**
 * True when a directory between `directory` and the opened root already holds a
 * `tileset.json`. Such a document is most likely an external tileset referenced
 * from that ancestor: the ancestor's root transform already applies to it, so a
 * second ENU transform would place it twice as far from the origin.
 */
async function hasAncestorTileset(rootDir, directory) {
  if (pathKey(directory) === pathKey(rootDir)) return false
  let current = dirname(directory)
  for (;;) {
    try {
      if ((await fs.stat(join(current, 'tileset.json'))).isFile()) return true
    } catch {
      // A missing ancestor document is the normal case; keep walking.
    }
    if (pathKey(current) === pathKey(rootDir)) return false
    const parent = dirname(current)
    if (!isWithinDirectory(parent, rootDir)) return false
    current = parent
  }
}

/**
 * Serve a local `tileset.json` with a derived root transform when the sibling
 * metadata says the document is still in local metres. Returns false when the
 * request should fall through to the plain file server, so an ordinary tileset
 * (or any read failure) keeps the old byte-for-byte behaviour.
 */
export async function serveGeoreferencedTileset(req, res, rootDir, relPath, cacheControl) {
  if (relPath === '' || basename(relPath).toLowerCase() !== 'tileset.json') return false
  const target = resolve(rootDir, relPath)
  if (!within(rootDir, target)) return false
  if (!isWithinDirectory(await realPathOr(target), await realPathOr(rootDir))) return false
  let stat
  try {
    stat = await fs.stat(target)
  } catch {
    return false
  }
  if (!stat.isFile() || stat.size > MAX_GEOREF_JSON) return false
  let document
  try {
    document = JSON.parse((await fs.readFile(target, 'utf8')).replace(/^\uFEFF/, ''))
  } catch {
    return false
  }
  if (tilesetRootIsGeoreferenced(document?.root)) return false
  // A nested document that hangs off an ancestor tileset is already transformed
  // by that ancestor; only a dataset's own top-level document needs the patch.
  if (await hasAncestorTileset(rootDir, dirname(target))) return false
  const patched = georeferenceTilesetDocument(document, await readTilesetInfoFile(dirname(target)))
  if (patched === null) return false
  const body = Buffer.from(JSON.stringify(patched.document), 'utf8')
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': cacheControl,
  })
  if (req.method === 'HEAD') {
    res.end()
    return true
  }
  res.end(body)
  return true
}

// ---------------------------------------------------------------------------
// Data health check (v1.2.0). A static analysis of one tileset.json runs on the
// host, so the panel button and the earth_scene "inspect" action share the same
// report. It is independent from the scene bridge and never changes the scene.
// ---------------------------------------------------------------------------

/** A failure that maps onto the frozen /inspect failure response. */
class InspectError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'InspectError'
    this.code = code
  }
}

// The frozen contract lists exactly these codes and HTTP statuses.
const INSPECT_FAILURE_STATUS = {
  forbidden: 403,
  invalid_source: 400,
  invalid_json: 400,
  too_large: 413,
  unreachable: 502,
  timeout: 502,
  internal: 502,
}

const INSPECT_FORBIDDEN_MESSAGE = 'This local path is outside the folders the user opened in the Digital Earth panel. Ask the user to open that folder in the panel, then retry.'

const INSPECT_CONTENT_KINDS = {
  b3dm: 'b3dm',
  glb: 'glb',
  gltf: 'glb',
  pnts: 'pnts',
  spz: 'spz',
}

const INSPECT_SUPPORTED_EXTENSIONS = new Set(['KHR_gaussian_splatting'])

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function inspectTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** A short, token-free slug for the report file name. */
function inspectSlug(label) {
  const raw = typeof label === 'string' ? scrubToken(label) : ''
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return slug === '' ? 'tileset' : slug
}

function inspectSourceLabel(source) {
  if (source.kind === 'remote') {
    try {
      return new URL(source.url).hostname
    } catch {
      return 'tileset'
    }
  }
  const parent = basename(dirname(source.path))
  if (parent !== '' && parent !== '.' && parent !== sep) return parent
  return basename(source.path)
}

/** Validate a source spec from the panel route or from the agent tool. */
function normalizeInspectSource(raw) {
  if (!isPlainObject(raw)) throw new InspectError('invalid_source', 'source must be an object with kind "local" or "remote".')
  if (raw.kind === 'local') {
    if (typeof raw.path !== 'string' || raw.path.trim() === '') {
      throw new InspectError('invalid_source', 'local source.path must be a non-empty string.')
    }
    const path = raw.path.trim()
    if (!isAbsolute(path)) throw new InspectError('invalid_source', `local source.path must be an absolute path, got ${JSON.stringify(path)}.`)
    return { kind: 'local', path: resolve(path) }
  }
  if (raw.kind === 'remote') {
    if (typeof raw.url !== 'string' || raw.url.trim() === '') {
      throw new InspectError('invalid_source', 'remote source.url must be a non-empty string.')
    }
    const url = raw.url.trim()
    if (!isHttpUrl(url)) throw new InspectError('invalid_source', `remote source.url must be an absolute http(s) URL, got ${JSON.stringify(url)}.`)
    return { kind: 'remote', url }
  }
  throw new InspectError('invalid_source', 'source.kind must be "local" or "remote".')
}

/** Keep only the four numeric runtime counters; null when the panel sent none. */
function normalizeInspectRuntime(raw) {
  if (!isPlainObject(raw)) return null
  const value = {}
  for (const key of ['tiles', 'pending', 'triangles', 'memory']) {
    const item = raw[key]
    if (typeof item === 'number' && Number.isFinite(item) && item >= 0) value[key] = item
  }
  return Object.keys(value).length === 0 ? null : value
}

/** Windows UNC paths (`\\host\share`) and their `//host/share` spelling. */
function isUncPath(value) {
  const text = typeof value === 'string' ? value : ''
  return text.startsWith('\\\\') || /^\/\/[^/]/.test(text)
}

/**
 * Containment check shared by the entry path and every derived local read
 * (external tileset JSON, deep content stat, SPZ header): lexical containment
 * below an opened folder plus a realpath containment check on both sides.
 * Returns the resolved path when it may be read, or `null` when it may not.
 * Derived refs additionally refuse UNC paths, so a tileset document can never
 * make the host touch an SMB share even when a network folder was opened.
 */
async function inspectAllowedLocalPath(path, allowedDirs, { derived = false } = {}) {
  const target = resolve(path)
  if (derived && isUncPath(target)) return null
  const realTarget = await realPathOr(target)
  for (const allowed of allowedDirs) {
    const realAllowed = await realPathOr(allowed)
    const lexical = isWithinDirectory(target, allowed) || isWithinDirectory(target, realAllowed)
    if (lexical && isWithinDirectory(realTarget, realAllowed)) return target
  }
  return null
}

/** Local tileset files may come only from a folder the user opened in the panel. */
async function inspectLocalPath(path, allowedDirs) {
  const target = await inspectAllowedLocalPath(path, allowedDirs)
  if (target === null) throw new InspectError('forbidden', INSPECT_FORBIDDEN_MESSAGE)
  return target
}

const inspectRemaining = (deadline) => deadline - Date.now()

async function inspectReadLocalJson(path, deadline) {
  let stat
  try {
    stat = await fs.stat(path)
  } catch {
    throw new InspectError('invalid_source', `cannot read the tileset JSON at ${path}.`)
  }
  if (!stat.isFile()) throw new InspectError('invalid_source', `the tileset path is not a file: ${path}.`)
  if (stat.size > MAX_INSPECT_JSON) {
    throw new InspectError('too_large', `the tileset JSON is ${stat.size} bytes, above the ${MAX_INSPECT_JSON / (1024 * 1024)} MB inspection limit.`)
  }
  if (inspectRemaining(deadline) <= 0) throw new InspectError('timeout', 'the inspection exceeded its 8 s budget.')
  return { text: await fs.readFile(path, 'utf8'), bytes: stat.size, label: path }
}

async function inspectFetchRemote(url, deadline, method = 'GET') {
  if (blockedHost(url)) throw new InspectError('forbidden', 'the remote tileset URL points at a local or private address.')
  const remaining = inspectRemaining(deadline)
  if (remaining <= 0) throw new InspectError('timeout', 'the inspection exceeded its 8 s budget.')
  const controller = new AbortController()
  // One deadline for the whole exchange: the timer stays armed while the body
  // is read, so a slow or endless response body cannot outlive the 8 s budget.
  const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(remaining, INSPECT_FETCH_TIMEOUT_MS)))
  timer.unref?.()
  try {
    let response
    try {
      response = await fetch(url, { method, redirect: 'manual', signal: controller.signal })
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        throw new InspectError('timeout', 'fetching the remote tileset timed out.')
      }
      throw new InspectError('unreachable', `could not fetch the remote tileset: ${error instanceof Error ? error.message : String(error)}.`)
    }
    if (response.status >= 300 && response.status < 400) {
      throw new InspectError('unreachable', 'the remote tileset redirects; redirects are not followed.')
    }
    if (!response.ok) throw new InspectError('unreachable', `the remote tileset answered HTTP ${response.status}.`)
    if (method === 'HEAD') return { response }
    const reported = Number(response.headers?.get?.('content-length'))
    if (Number.isFinite(reported) && reported > MAX_INSPECT_JSON) {
      throw new InspectError('too_large', `the remote tileset JSON is ${reported} bytes, above the ${MAX_INSPECT_JSON / (1024 * 1024)} MB inspection limit.`)
    }
    if (response.body === null) return { text: '', bytes: 0, label: url }
    const reader = response.body.getReader()
    const chunks = []
    let total = 0
    for (;;) {
      if (inspectRemaining(deadline) <= 0) {
        throw new InspectError('timeout', 'the inspection exceeded its 8 s budget while reading the remote tileset body.')
      }
      let step
      try {
        step = await reader.read()
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') {
          throw new InspectError('timeout', 'reading the remote tileset body timed out.')
        }
        throw new InspectError('unreachable', `could not read the remote tileset body: ${error instanceof Error ? error.message : String(error)}.`)
      }
      if (step.done) break
      total += step.value.byteLength
      if (total > MAX_INSPECT_JSON) {
        // Stop the transfer immediately: a rejected report must never buffer the
        // whole oversized body first.
        controller.abort()
        reader.cancel().catch(() => {})
        throw new InspectError('too_large', `the remote tileset JSON is above the ${MAX_INSPECT_JSON / (1024 * 1024)} MB inspection limit.`)
      }
      chunks.push(Buffer.from(step.value))
    }
    return { text: Buffer.concat(chunks).toString('utf8'), bytes: total, label: url }
  } finally {
    clearTimeout(timer)
  }
}

/** Frozen issue code for an external tileset document that could not be loaded. */
function inspectExternalLoadIssueCode(error, location) {
  const code = error instanceof InspectError ? error.code : 'internal'
  if (code === 'invalid_json' || code === 'too_large') return code
  return location.kind === 'local' ? 'content_missing' : 'content_unreachable'
}

function inspectParseJson(text, label) {
  try {
    const value = JSON.parse(text)
    if (!isPlainObject(value)) throw new Error('the top-level JSON value is not an object')
    return value
  } catch (error) {
    throw new InspectError('invalid_json', `the tileset JSON at ${label} is not a valid 3D Tiles document: ${error instanceof Error ? error.message : String(error)}.`)
  }
}

/** Resolve a tile content uri against the document that declared it. */
function resolveInspectUri(base, uri) {
  if (typeof uri !== 'string' || uri.trim() === '') return null
  const raw = uri.trim()
  const scheme = /^[a-z][a-z0-9+.-]*:/i.test(raw)
  if (base.kind === 'remote') {
    if (scheme) return /^https?:\/\//i.test(raw) ? { kind: 'remote', value: raw } : null
    try {
      return { kind: 'remote', value: new URL(raw, base.url).href }
    } catch {
      return null
    }
  }
  if (scheme) return /^https?:\/\//i.test(raw) ? { kind: 'remote', value: raw } : null
  return { kind: 'local', value: resolve(base.dir, raw.split('?')[0].split('#')[0]) }
}

function inspectLocation(resolved) {
  if (resolved.kind === 'local') return { kind: 'local', value: resolved.value, dir: dirname(resolved.value) }
  return { kind: 'remote', value: resolved.value }
}

function inspectBoundingVolume(value) {
  if (!isPlainObject(value)) return null
  const key = ['box', 'region', 'sphere'].find((name) => Array.isArray(value[name]))
  if (key === undefined) return null
  const numbers = value[key]
  if (!numbers.every((item) => typeof item === 'number' && Number.isFinite(item))) return null
  if (key === 'box' && numbers.length !== 12) return null
  if (key === 'region' && numbers.length !== 6) return null
  if (key === 'sphere' && numbers.length !== 4) return null
  return { type: key, center: key === 'region' ? null : numbers.slice(0, 3), region: key === 'region' ? numbers.slice() : null }
}

function inspectContentRefs(tile) {
  const refs = []
  const push = (content) => {
    if (!isPlainObject(content)) return
    const uri = typeof content.uri === 'string' ? content.uri : typeof content.url === 'string' ? content.url : ''
    if (uri.trim() !== '') refs.push(uri.trim())
  }
  if (Array.isArray(tile.content)) {
    for (const content of tile.content) push(content)
  } else {
    push(tile.content)
  }
  return refs
}

function inspectIssue(issues, level, code, message, path) {
  if (issues.length >= MAX_INSPECT_ISSUES) {
    issues.dropped = (issues.dropped ?? 0) + 1
    return
  }
  const issue = { level, code, message }
  if (typeof path === 'string' && path !== '') issue.path = path
  issues.push(issue)
}

function inspectRootGeometricError(doc) {
  if (!isPlainObject(doc?.root)) return null
  const error = doc.root.geometricError
  return typeof error === 'number' && Number.isFinite(error) ? error : null
}

/** Walk every tile of one tileset document and fold its statistics into state. */
function inspectDocTiles(doc, docLabel, state, base, isRootDoc) {
  const roots = []
  if (isPlainObject(doc.root)) roots.push(doc.root)
  else if (Array.isArray(doc.tiles)) for (const tile of doc.tiles) if (isPlainObject(tile)) roots.push(tile)
  if (roots.length === 0) return { roots: 0, docDepth: 0 }
  const stack = roots.map((tile, index) => ({ tile, path: index === 0 ? `${docLabel}:root` : `${docLabel}:tiles[${index}]`, depth: 0 }))
  let docDepth = 0
  while (stack.length > 0) {
    const { tile, path, depth } = stack.pop()
    state.tiles += 1
    if (depth > docDepth) docDepth = depth
    const children = Array.isArray(tile.children) ? tile.children.filter((item) => isPlainObject(item)) : []
    const refs = inspectContentRefs(tile)
    if (Array.isArray(tile.children) && children.length === 0 && refs.length === 0) {
      inspectIssue(state.issues, 'warn', 'empty_children', 'a tile declares no content and no children.', path)
    }
    if (Object.hasOwn(tile, 'geometricError')) {
      const error = tile.geometricError
      if (typeof error !== 'number' || !Number.isFinite(error) || error < 0) {
        inspectIssue(state.issues, 'warn', 'geometric_error_invalid', `tile geometricError must be a finite number >= 0, got ${JSON.stringify(error)}.`, path)
      }
    }
    if (Object.hasOwn(tile, 'boundingVolume') && inspectBoundingVolume(tile.boundingVolume) === null) {
      inspectIssue(state.issues, 'warn', 'bounding_volume_invalid', 'tile boundingVolume must be a box, region or sphere with the right number of finite numbers.', path)
    }
    for (const uri of refs) {
      state.contents += 1
      const extension = extname(uri.split('?')[0].split('#')[0]).slice(1).toLowerCase()
      const resolved = resolveInspectUri(base, uri)
      if (extension === 'json') {
        state.externalFiles += 1
        if (resolved !== null) state.externalTilesets.push({ location: inspectLocation(resolved), label: uri })
      } else if (INSPECT_CONTENT_KINDS[extension] !== undefined) {
        state.kinds[INSPECT_CONTENT_KINDS[extension]] += 1
      }
      if (extension === 'spz') state.spzCount += 1
      state.contentRefs.push({ uri, extension, resolved })
      if (isRootDoc && depth === 0) state.rootContents.push({ uri, extension, resolved })
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ tile: children[index], path: `${path}.children[${index}]`, depth: depth + 1 })
    }
  }
  return { roots: roots.length, docDepth }
}

async function inspectSpzHeader(path) {
  let handle
  try {
    handle = await fs.open(path, 'r')
    const buffer = Buffer.alloc(16)
    const { bytesRead } = await handle.read(buffer, 0, 16, 0)
    if (bytesRead < 12) return { ok: false, reason: 'file is shorter than the SPZ header' }
    const magic = buffer.readUInt32LE(0)
    const version = buffer.readUInt32LE(4)
    const points = buffer.readUInt32LE(8)
    if (magic !== SPZ_MAGIC) return { ok: false, reason: `unexpected SPZ magic 0x${magic.toString(16)}` }
    if (version !== 1 && version !== 2) return { ok: false, reason: `unsupported SPZ version ${version}` }
    if (points === 0) return { ok: false, reason: 'SPZ file declares zero splats' }
    return { ok: true, version, points }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    if (handle !== undefined) await handle.close().catch(() => {})
  }
}

/** Deep check: local content files are stat'ed, remote root contents are HEADed. */
async function inspectDeepContents(state, source, deadline, allowedDirs) {
  if (source.kind === 'local') {
    let checked = 0
    for (const item of state.contentRefs) {
      if (item.resolved === null || item.resolved.kind !== 'local') continue
      if (checked >= MAX_INSPECT_CONTENT_CHECKS) break
      checked += 1
      // Derived content paths get the same allowlist + realpath check as the
      // entry path; an escape is a warning and the file is never touched.
      const target = await inspectAllowedLocalPath(item.resolved.value, allowedDirs, { derived: true })
      if (target === null) {
        inspectIssue(state.issues, 'warn', 'content_unreachable', 'a content file is outside the folders the user opened in the panel; it was not read.')
        continue
      }
      let stat
      try {
        stat = await fs.stat(target)
      } catch {
        inspectIssue(state.issues, 'warn', 'content_missing', `content file not found: ${item.uri}`, target)
        continue
      }
      if (!stat.isFile()) {
        inspectIssue(state.issues, 'warn', 'content_missing', `content path is not a file: ${item.uri}`, target)
        continue
      }
      if (stat.size > MAX_INSPECT_CONTENT_BYTES) {
        inspectIssue(state.issues, 'warn', 'content_too_large', `content file is ${stat.size} bytes: ${item.uri}`, target)
      }
      if (item.extension === 'spz') {
        // Only reached for a path that passed the allowlist + realpath check.
        const header = await inspectSpzHeader(target)
        if (header.ok) {
          inspectIssue(state.issues, 'info', 'gaussian_splatting_ok', `SPZ header ok: version ${header.version}, ${header.points} splats.`, item.uri)
        } else {
          inspectIssue(state.issues, 'warn', 'spz_header_invalid', `SPZ header could not be parsed: ${header.reason}.`, item.uri)
        }
      }
    }
    return
  }
  for (const item of state.rootContents) {
    if (item.resolved === null || item.resolved.kind !== 'remote') continue
    if (item.extension === 'spz') {
      inspectIssue(state.issues, 'info', 'gaussian_splatting_ok', 'remote .spz content detected; its header is not read for remote files.', item.uri)
      continue
    }
    if (inspectRemaining(deadline) <= 0) break
    try {
      const { response } = await inspectFetchRemote(item.resolved.value, deadline, 'HEAD')
      const reported = Number(response.headers?.get?.('content-length'))
      if (Number.isFinite(reported) && reported > MAX_INSPECT_CONTENT_BYTES) {
        inspectIssue(state.issues, 'warn', 'content_too_large', `content file is ${reported} bytes: ${item.uri}`, item.uri)
      }
    } catch (error) {
      const code = error instanceof InspectError ? error.code : 'internal'
      inspectIssue(state.issues, 'warn', 'content_unreachable', `content file could not be reached (${code}): ${item.uri}`, item.uri)
    }
  }
}

async function analyzeTileset(source, options = {}) {
  // allowedDirs is a Set in the running plugin; an array keeps the analyser
  // usable from tests and from any future caller.
  const allowedDirs = options.allowedDirs instanceof Set || Array.isArray(options.allowedDirs) ? options.allowedDirs : []
  const deep = options.deep === true
  const runtime = normalizeInspectRuntime(options.runtime)
  const deadline = Date.now() + INSPECT_FETCH_TIMEOUT_MS
  let rootLocation
  if (source.kind === 'local') {
    const target = await inspectLocalPath(source.path, allowedDirs)
    rootLocation = { kind: 'local', value: target, dir: dirname(target) }
  } else {
    if (blockedHost(source.url)) throw new InspectError('forbidden', 'the remote tileset URL points at a local or private address. Use a public http(s) URL.')
    rootLocation = { kind: 'remote', value: source.url }
  }
  const state = {
    tiles: 0,
    contents: 0,
    externalFiles: 0,
    maxDepth: 0,
    kinds: { b3dm: 0, glb: 0, pnts: 0, gaussianSplatting: false, spz: false },
    extensionsUsed: new Set(),
    extensionsRequired: new Set(),
    issues: [],
    contentRefs: [],
    rootContents: [],
    externalTilesets: [],
    documents: 0,
    spzCount: 0,
  }
  let rootDoc = null
  let rootBytes = 0
  const queue = [{ location: rootLocation, isRoot: true, label: source.kind === 'local' ? source.path : source.url }]
  const seen = new Set()
  while (queue.length > 0 && state.documents < MAX_INSPECT_TILESETS) {
    const entry = queue.shift()
    if (seen.has(entry.location.value)) continue
    seen.add(entry.location.value)
    let loaded
    try {
      if (entry.location.kind === 'local') {
        // The entry path was already validated; every derived tileset JSON is
        // re-checked against the allowlist and its realpath before it is read.
        const target = entry.isRoot
          ? entry.location.value
          : await inspectAllowedLocalPath(entry.location.value, allowedDirs, { derived: true })
        if (target === null) {
          if (entry.isRoot) throw new InspectError('forbidden', INSPECT_FORBIDDEN_MESSAGE)
          inspectIssue(state.issues, 'warn', 'content_unreachable', 'an external tileset is outside the folders the user opened in the panel; it was not read.')
          continue
        }
        if (!entry.isRoot) entry.location = { ...entry.location, value: target, dir: dirname(target) }
        loaded = await inspectReadLocalJson(target, deadline)
      } else {
        loaded = await inspectFetchRemote(entry.location.value, deadline)
      }
    } catch (error) {
      if (entry.isRoot) throw error
      const code = inspectExternalLoadIssueCode(error, entry.location)
      inspectIssue(state.issues, 'error', code, `could not load an external tileset: ${error instanceof Error ? error.message : String(error)}`, entry.label)
      continue
    }
    let doc
    try {
      doc = inspectParseJson(loaded.text, loaded.label)
    } catch (error) {
      if (entry.isRoot) throw error
      inspectIssue(state.issues, 'error', 'invalid_json', `external tileset is not valid JSON: ${entry.label}`, entry.label)
      continue
    }
    if (entry.isRoot) {
      rootDoc = doc
      rootBytes = loaded.bytes
      inspectRootDocument(doc, entry.label, state)
      await inspectRootGeoreference(doc, entry.location.kind === 'local' ? entry.location.dir : null, state, entry.label)
    }
    state.documents += 1
    if (Array.isArray(doc.extensionsUsed)) {
      for (const extension of doc.extensionsUsed) if (typeof extension === 'string') state.extensionsUsed.add(extension)
    }
    if (Array.isArray(doc.extensionsRequired)) {
      for (const extension of doc.extensionsRequired) if (typeof extension === 'string') state.extensionsRequired.add(extension)
    }
    const base = entry.location.kind === 'local' ? { kind: 'local', dir: entry.location.dir } : { kind: 'remote', url: entry.location.value }
    const before = state.externalTilesets.length
    const walked = inspectDocTiles(doc, entry.label, state, base, entry.isRoot)
    if (walked.docDepth > state.maxDepth) state.maxDepth = walked.docDepth
    for (const external of state.externalTilesets.slice(before)) queue.push({ ...external, isRoot: false })
    state.externalTilesets.length = before
  }
  if (queue.length > 0) {
    inspectIssue(state.issues, 'warn', 'too_large', `inspection stopped after ${MAX_INSPECT_TILESETS} tileset documents; deeper tilesets were not read.`)
  }
  for (const extension of [...state.extensionsRequired].sort()) {
    if (!INSPECT_SUPPORTED_EXTENSIONS.has(extension)) {
      inspectIssue(state.issues, 'warn', 'unsupported_extension', `the tileset requires extension "${extension}", which this inspection does not verify.`)
    }
  }
  const hasSplatExtension = state.extensionsUsed.has('KHR_gaussian_splatting') || state.extensionsRequired.has('KHR_gaussian_splatting')
  state.kinds.spz = state.spzCount > 0
  state.kinds.gaussianSplatting = hasSplatExtension || state.kinds.spz
  if (state.kinds.gaussianSplatting) {
    inspectIssue(
      state.issues,
      'info',
      'gaussian_splatting_ok',
      hasSplatExtension ? 'KHR_gaussian_splatting extension detected; the panel can render these Gaussian splats.' : '.spz content detected (Gaussian splatting).',
    )
  }
  if (deep) await inspectDeepContents(state, source, deadline, allowedDirs)
  // The issue list itself stays at the limit; the truncation count is a
  // separate field so `issues` never grows past MAX_INSPECT_ISSUES.
  const droppedIssues = Number.isInteger(state.issues.dropped) ? state.issues.dropped : 0
  const rootBoundingVolume = inspectBoundingVolume(rootDoc?.root?.boundingVolume)
  const rootGeometricError = inspectRootGeometricError(rootDoc)
  const ok = !state.issues.some((issue) => issue.level === 'error')
  const scenes = isPlainObject(rootDoc) && Array.isArray(rootDoc.scenes) && rootDoc.scenes.length > 0
    ? rootDoc.scenes.filter((scene) => isPlainObject(scene)).map((scene) => ({
      geometricError: Number.isFinite(scene.geometricError) ? scene.geometricError : rootGeometricError,
      tilesetCount: 1,
    }))
    : [{ geometricError: rootGeometricError, tilesetCount: 1 }]
  const report = {
    ok,
    source: { kind: source.kind, label: inspectSourceLabel(source), bytes: rootBytes },
    asset: {
      version: typeof rootDoc?.asset?.version === 'string' ? rootDoc.asset.version : null,
      minVersion: typeof rootDoc?.asset?.minVersion === 'string' ? rootDoc.asset.minVersion : null,
      generator: typeof rootDoc?.asset?.generator === 'string' ? rootDoc.asset.generator : null,
    },
    root: {
      geometricError: rootGeometricError,
      boundingVolume: {
        type: rootBoundingVolume?.type ?? null,
        center: rootBoundingVolume?.center ?? null,
        region: rootBoundingVolume?.region ?? null,
      },
      children: isPlainObject(rootDoc?.root) && Array.isArray(rootDoc.root.children) ? rootDoc.root.children.length : 0,
      depth: state.maxDepth,
    },
    counts: {
      tiles: state.tiles,
      contents: state.contents,
      externalFiles: state.externalFiles,
      extensionsUsed: [...state.extensionsUsed].sort(),
    },
    kinds: state.kinds,
    scenes,
    issues: state.issues,
  }
  if (droppedIssues > 0) report.issuesDropped = droppedIssues
  if (runtime !== null) report.runtime = runtime
  return scrubToken(report)
}

/** Validate the root document: asset version, root tile and its refined values. */
function inspectRootDocument(doc, label, state) {
  const version = typeof doc.asset?.version === 'string' ? doc.asset.version.trim() : ''
  if (version !== '' && !/^1(\.|$)/.test(version)) {
    inspectIssue(state.issues, 'error', 'asset_version_unsupported', `asset.version "${version}" is not supported; this panel targets 3D Tiles 1.x.`, `${label}:asset.version`)
  }
  const root = isPlainObject(doc.root) ? doc.root : null
  if (root === null && (!Array.isArray(doc.tiles) || doc.tiles.length === 0)) {
    inspectIssue(state.issues, 'error', 'no_root', 'the tileset has neither a root tile nor a tiles array.', label)
    return
  }
  if (root !== null) {
    if (!Object.hasOwn(root, 'geometricError')) {
      inspectIssue(state.issues, 'warn', 'no_geometric_error', 'the root tile has no geometricError, so refinement distances are undefined.', `${label}:root`)
    } else if (typeof root.geometricError !== 'number' || !Number.isFinite(root.geometricError) || root.geometricError < 0) {
      inspectIssue(state.issues, 'error', 'geometric_error_invalid', 'the root tile geometricError must be a finite number >= 0.', `${label}:root`)
    }
    if (inspectBoundingVolume(root.boundingVolume) === null) {
      inspectIssue(state.issues, 'error', 'bounding_volume_invalid', 'the root tile needs a boundingVolume with a box, region or sphere.', `${label}:root.boundingVolume`)
    }
  }
}

/**
 * Report how a root document will be placed on the globe, and why it will not be
 * when that is the case. This is the diagnostic half of the serve-time
 * georeferencing: a document that /tiles cannot repair must never fail silently,
 * because the visible symptom (data near the earth's centre, `flyTo` diving to
 * the core) says nothing about the cause. `directory` is the folder of a local
 * document, or null for a remote one (its metadata cannot be read cross-origin).
 */
export async function inspectRootGeoreference(doc, directory, state, label) {
  const root = isPlainObject(doc?.root) ? doc.root : null
  if (root === null || tilesetRootIsGeoreferenced(root)) return
  const info = directory === null || directory === undefined ? null : await readTilesetInfoFile(directory)
  const georeference = deriveLocalGeoreference(info)
  if (georeference !== null) {
    inspectIssue(
      state.issues,
      'info',
      'georeference_derived',
      `the root tile has no transform; the panel georeferences it from tileset_info.json as ${georeference.crs} (${georeference.lon.toFixed(6)}, ${georeference.lat.toFixed(6)}).`,
      `${label}:root`,
    )
    return
  }
  if (info !== null) {
    // The metadata exists but names a CRS this plugin cannot project. Saying so
    // is the only honest answer: the dataset will still render at the core.
    inspectIssue(
      state.issues,
      'warn',
      'georeference_unsupported',
      `tileset_info.json declares srs ${JSON.stringify(info.srs ?? null)}, which this panel cannot place without a projection database; its local metres are read as ECEF, so the data renders near the earth's centre. Supported: CGCS2000 Gauss-Krueger EPSG 4491-4554.`,
      `${label}:root`,
    )
    return
  }
  inspectIssue(
    state.issues,
    'warn',
    'no_georeference',
    "the root tile has no transform or region, so its bounding volumes are read as ECEF and a dataset in local metres renders near the earth's centre. Add a root transform, or a sibling tileset_info.json with srs + srs_origin.",
    `${label}:root`,
  )
}

/** Write the report JSON, then keep only the newest reports. The absolute path is
 * added to the report itself as well, so the panel can copy it from either place. */async function writeInspectReport(report) {
  await fs.mkdir(REPORT_DIR, { recursive: true })
  const base = `${inspectTimestamp()}-${inspectSlug(report.source?.label)}`
  let handle
  let target
  // `wx` makes create-or-fail atomic, so two inspections in the same second get
  // different files instead of racing between exists() and writeFile().
  for (let attempt = 0; attempt < 100; attempt += 1) {
    target = join(REPORT_DIR, attempt === 0 ? `${base}.json` : `${base}-${attempt + 1}.json`)
    try {
      handle = await fs.open(target, 'wx')
      break
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  if (handle === undefined) throw new InspectError('internal', 'could not create a unique inspection report file.')
  report.reportPath = target
  try {
    await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`, 'utf8')
  } finally {
    await handle.close().catch(() => {})
  }
  try {
    await pruneInspectReports()
  } catch {
    // Retention is best effort; the report itself already exists.
  }
  return report
}

/** Keep the newest 100 report files, deleting the oldest first. */
async function pruneInspectReports() {
  let names
  try {
    names = await fs.readdir(REPORT_DIR)
  } catch {
    return
  }
  const reports = names.filter((name) => /^\d{8}-\d{6}-.+\.json$/.test(name))
  if (reports.length <= MAX_INSPECT_REPORTS) return
  const stats = await Promise.all(reports.map(async (name) => {
    try {
      return { name, stat: await fs.stat(join(REPORT_DIR, name)) }
    } catch {
      return null
    }
  }))
  const present = stats.filter((item) => item !== null).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs || b.name.localeCompare(a.name))
  for (const item of present.slice(MAX_INSPECT_REPORTS)) {
    try {
      await fs.rm(join(REPORT_DIR, item.name), { force: true })
    } catch {
      // Best effort only.
    }
  }
}

/** POST /api/3dviewer/inspect: the panel's data health check endpoint. */
async function inspectHandler(req, res, allowedDirs) {
  if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
  let parsed
  try {
    parsed = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    return sendText(res, 400, 'bad request')
  }
  if (parsed.searchParams.get('token') !== TOKEN) return sendText(res, 403, 'forbidden')
  if (req.headers?.[PANEL_HEADER] !== '1') return sendText(res, 403, 'inspect requests must come from the panel')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (Buffer.byteLength(body, 'utf8') > MAX_INSPECT_BODY) {
        req.destroy()
        return sendInspectFailure(res, 'too_large', `inspect request body exceeds ${MAX_INSPECT_BODY / 1024} KiB.`)
      }
    }
  } catch {
    return sendInspectFailure(res, 'invalid_json', 'could not read the inspect request body.')
  }
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return sendInspectFailure(res, 'invalid_json', 'inspect request body is not valid JSON.')
  }
  if (!isPlainObject(payload)) return sendInspectFailure(res, 'invalid_source', 'inspect request body must be a JSON object.')
  if (payload.deep !== undefined && typeof payload.deep !== 'boolean') {
    return sendInspectFailure(res, 'invalid_source', 'inspect "deep" must be true or false.')
  }
  if (payload.runtime !== undefined && payload.runtime !== null && normalizeInspectRuntime(payload.runtime) === null) {
    return sendInspectFailure(res, 'invalid_source', 'inspect "runtime" must contain numeric tiles/pending/triangles/memory counters.')
  }
  let source
  try {
    source = normalizeInspectSource(payload.source)
  } catch (error) {
    return sendInspectFailure(res, error instanceof InspectError ? error.code : 'invalid_source', error instanceof Error ? error.message : String(error))
  }
  try {
    const report = await analyzeTileset(source, {
      deep: payload.deep === true,
      runtime: payload.runtime,
      allowedDirs,
    })
    await writeInspectReport(report)
    sendJson(res, 200, scrubToken({ ok: true, reportPath: report.reportPath, report }))
  } catch (error) {
    if (error instanceof InspectError) return sendInspectFailure(res, error.code, error.message)
    sendInspectFailure(res, 'internal', error instanceof Error ? error.message : String(error))
  }
}

function sendInspectFailure(res, code, message) {
  const status = INSPECT_FAILURE_STATUS[code] ?? 502
  sendJson(res, status, { ok: false, code, error: scrubToken(typeof message === 'string' ? message : 'inspection failed') })
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

/**
 * Query string of the request target, read from the raw request line so encoded
 * separators stay intact. The panel appends a remote URL's `?query` after the
 * encoded path; it belongs to the upstream URL, not to the final path segment.
 */
function requestQuery(req) {
  const raw = typeof req.url === 'string' ? req.url : ''
  const mark = raw.indexOf('?')
  if (mark < 0) return ''
  return raw.slice(mark + 1)
}

/**
 * Reject a proxy query that could make the host issue a malformed or unsafe
 * upstream request. Returns `{ status, message }`, or `null` when it is fine.
 */
function remoteQueryDenial(query) {
  if (query.length > MAX_REMOTE_QUERY) {
    return { status: 400, message: `remote query string is longer than ${MAX_REMOTE_QUERY} characters` }
  }
  let decoded
  try {
    decoded = decodeURIComponent(query)
  } catch {
    return { status: 403, message: 'remote query string is not valid percent-encoding' }
  }
  // CRLF would break out of a header if a future upstream ever echoed the query
  // into one, and other control characters have no place in a tile URL. Check
  // both the raw text and its decoded form (`%0d%0a` must not slip through).
  if (/[\u0000-\u001f\u007f-\u009f]/.test(query) || /[\u0000-\u001f\u007f-\u009f]/.test(decoded)) {
    return { status: 403, message: 'remote query string must not contain control characters' }
  }
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
    // Page-only list of folders the user opened before (data menu); the host
    // already re-allowed them, so the page never needs to re-register them.
    directoriesUrl: `${DIRECTORIES_ROUTE}/${TOKEN}`,
    // Captures are served back through the token route; chat tool rows use this
    // prefix to render a thumbnail without exposing the token to the model.
    filesUrl: `${FILES_ROUTE}/${TOKEN}/`,
    // Page-only scene snapshot store, so a remount or restart can restore a scene.
    sceneUrl: `${SCENE_ROUTE}/${TOKEN}`,
    // "Ask Agent" pushes a bounded scene summary into the live conversation.
    injectUrl: `${INJECT_ROUTE}/${TOKEN}`,
    // Scene reports are written by the host under DSH_HOME/exports.
    reportUrl: `${REPORT_ROUTE}/${TOKEN}`,
    version: ABOUT.version,
    homepage: ABOUT.homepage,
    issues: ABOUT.issues,
    team: { name: ABOUT.team.name, url: ABOUT.team.url },
    bridgeUrl: BRIDGE_ROUTE,
    captureUrl: CAPTURE_ROUTE,
    // The panel posts data health check requests here; it needs the URL because
    // the page no longer guesses routes from scanUrl.
    inspectUrl: INSPECT_ROUTE,
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
  const relPath = relParts.join(sep)
  // OSGB-derived local tilesets often ship without a root `transform`; the host
  // derives one from the sibling tileset_info.json so Cesium places them on the
  // globe instead of reading local metres as ECEF coordinates.
  if (await serveGeoreferencedTileset(req, res, resolvedDir, relPath, 'public, max-age=60')) return
  // serveFile repeats the real-path containment check on the target file.
  await serveFile(req, res, resolvedDir, relPath, 'public, max-age=60')
}

async function scanHandler(req, res, allowedDirs, onOpened) {
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
  // This gesture is the user's decision, so remember the folder (and its
  // resolved spelling) for later sessions; a failed save never fails the scan.
  if (typeof onOpened === 'function') {
    try {
      onOpened(resolvedDir, realDir)
    } catch {
      // The remembered list is a convenience, not a precondition.
    }
  }
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
  // The query is forwarded to the upstream URL as-is, never decoded into the
  // path segments above.
  const query = requestQuery(req)
  if (query !== '') {
    const denial = remoteQueryDenial(query)
    if (denial !== null) return sendText(res, denial.status, denial.message)
  }
  const target = `${origin}/${relParts.join('/')}${query === '' ? '' : `?${query}`}`
  // Re-check the final URL: a malformed target or a query that made the parser
  // pick a different host must never reach the network.
  if (blockedHost(target)) return sendText(res, 403, 'forbidden')
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
const DRAW_TOOL_NAME = 'earth_draw'
const MEASURE_TOOL_NAME = 'earth_measure'
const ANALYZE_TOOL_NAME = 'earth_analyze'
const SHADER_TOOL_NAME = 'earth_shader'
const SCENE_RENDER_LIMIT = 4096
// Browser-side height sampling and shadow setup can be slow; the frozen B2
// contract fixes this command timeout at 30 s.
const ANALYZE_TIMEOUT_MS = 30000
// Model-facing analysis text plus its JSON fallback; never dump a full flood
// sampling grid or every profile point past this budget.
const ANALYZE_RENDER_LIMIT = 8 * 1024
// Shader commands only touch existing Cesium materials, but compiling a
// CustomShader can still take a moment on a large tileset.
const SHADER_TIMEOUT_MS = 30000
const CAPTURE_NOTE = 'Image file written. If this model can read images, call read_image with this path; otherwise rely on earth_scene status JSON. To show the image to the user, call present with the path; never embed a local path in Markdown image syntax.'
const PANEL_CLOSED_MESSAGE = 'The Digital Earth panel did not attach in time. Ask the user to open the digital earth tab with the globe button in the chat header, then retry.'
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
  inspect: ['layer', 'path', 'url', 'deep'],
  report: ['format', 'title', 'include_capture'],
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
      description: 'load: absolute http(s) URL of a tileset.json; exactly one of url or path. inspect: absolute http(s) tileset.json URL to analyze.',
    },
    path: {
      type: 'string',
      description: 'load: absolute local path; a tileset.json file, or a folder/moved path that resolves to the unique tileset.json below it. A new folder needs one user confirmation in the panel. inspect: the same local path; an already allowed file works while the panel is closed.',
    },
    layer: {
      type: 'string',
      description: 'remove/visible: layer id from status.layers, or its exact name. inspect: analyze this loaded layer after the panel resolves its source; the panel must be open.',
    },
    deep: {
      type: 'boolean',
      description: 'inspect: true also checks content files (local: existence and size of up to 200 contents; remote: reachability of root content). Default false.',
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
    format: {
      type: 'string',
      enum: ['html', 'markdown'],
      description: 'report: output format. Default html (self-contained, screenshot embedded).',
    },
    title: {
      type: 'string',
      description: 'report: report title, up to 120 characters. Default "Digital Earth scene report".',
    },
    include_capture: {
      type: 'boolean',
      description: 'report: also capture the current view and embed/link it in the report. Default true.',
    },
  },
  required: ['action'],
  additionalProperties: false,
}

const SCENE_DESCRIPTION = [
  'Read, change or health-check the interactive digital earth panel (CesiumJS): 3D Tiles and Gaussian splat layers, imagery basemap, terrain and camera.',
  '',
  'Actions:',
  '- status: view, layers, imagery, terrain, sources, viewport, snapshot, measureTool and busy state.',
  '- list: layers, sources, active imagery and terrain only (no camera/view).',
  '- load: add a layer from url (online tileset.json) or path (absolute local tileset.json; a folder or moved path resolves to the unique tileset.json below it; new local folders get one panel confirmation). Returns view, layers_count and, when the path was healed, resolved_from.',
  '- remove: remove a layer by layer id or name.',
  '- visible: show or hide one layer.',
  '- basemap: switch the imagery source, or pass "none" to turn the basemap off.',
  '- terrain: switch the terrain source, or pass "none" to turn terrain off.',
  '- fly: move the camera; returns the resulting view.',
  '- reset: return to the global view.',
  '- pick: identify whatever is at the center of the view.',
  '- inspect: static data health check of a tileset without changing the scene. Pass layer (panel resolves its source, merges runtime counters), or path/url; deep checks content files. Returns a compact summary plus a host report path.',
  '- report: write a scene report (HTML self-contained or Markdown) with camera, layers, basemap/terrain, Agent overlays and measurements, the active analysis and shader presets, plus an embedded/linked screenshot; returns the absolute host path. Call present with that path for the user.',
  '',
  'The panel JSON result is the authoritative scene state.',
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
  '',
  'By default the image follows the panel screenshot setting (usually a clean view); set include_hud true to burn in the coordinate HUD and team credit. The DOM toolbar is never part of the image.',
  'If this model can read images, call read_image on the returned path; otherwise describe the scene only from earth_scene status JSON.',
  'To show the image to the user, call present with its path. Never embed a local path in Markdown image syntax: the chat cannot load it and renders a broken preview.',
].join('\n')

const DRAW_STYLES = ['accent', 'alert', 'success', 'warm', 'violet']
const MAX_DRAW_LABEL = 80

const DRAW_PARAMETERS = {
  type: 'object',
  properties: {
    features: {
      type: 'string',
      description: 'GeoJSON as a JSON string: a FeatureCollection, a Feature, or a bare geometry (Point / MultiPoint / LineString / MultiLineString / Polygon / MultiPolygon / GeometryCollection). WGS84 coordinates as [lon, lat] or [lon, lat, height] in degrees and meters. Required unless clear is true.',
    },
    style: {
      type: 'string',
      enum: DRAW_STYLES,
      description: 'Colour preset for the new annotations. Default accent.',
    },
    label: {
      type: 'string',
      description: `Optional caption for the whole annotation set (up to ${MAX_DRAW_LABEL} characters). Feature properties.name becomes the per-feature label when present.`,
    },
    clear: {
      type: 'boolean',
      description: 'true first removes every overlay the Agent drew earlier in this panel (annotations and measurements); it may be used alone.',
    },
  },
  additionalProperties: false,
}

const DRAW_DESCRIPTION = [
  'Draw annotations on the interactive digital earth panel: points, lines, polygons and labels from GeoJSON the Agent provides.',
  'Use it to show the user where something is — mark sites, outline areas, trace routes, label features. The overlay stays until a later call passes clear=true.',
  'Coordinates are WGS84 degrees; height is optional meters. Do not guess coordinates: take them from the user, from earth_scene status/pick, or from geodata the user provided. One call accepts up to 500 features and 20000 coordinates.',
  'Returns compact JSON with the count by geometry type and the bounding box.',
].join('\n')

const MEASURE_MODES = ['distance', 'area', 'height']

const MEASURE_PARAMETERS = {
  type: 'object',
  properties: {
    mode: {
      type: 'string',
      enum: MEASURE_MODES,
      description: 'distance: geodesic length along the points; area: planar area of the polygon (perimeter included); height: height difference between the first and last point, with horizontal distance and slope.',
    },
    points: {
      type: 'array',
      description: 'Ordered points, each [lon, lat] or [lon, lat, height] (WGS84 degrees, meters). distance needs 2+, area needs 3+, height needs exactly 2. Up to 200 points.',
      items: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    draw: {
      type: 'boolean',
      description: 'Draw the measurement (points, line or polygon, and a result label) on the globe. Default true.',
    },
    clear: {
      type: 'boolean',
      description: 'true first removes every overlay the Agent drew earlier in this panel (annotations and measurements).',
    },
  },
  required: ['mode', 'points'],
  additionalProperties: false,
}

const MEASURE_DESCRIPTION = [
  'Measure on the digital earth panel and return the numeric result: geodesic distance along points, area of a polygon, or the height difference between two points.',
  'Coordinates are WGS84 degrees. distance and area are measured on the ellipsoid surface; height mode uses each point\'s height when provided, otherwise the terrain/globe surface height the panel reports. Measure only where the user asked or where the scene shows a real feature.',
  'By default the measurement is also drawn on the globe (points, line/polygon and a label) so the user can see it; pass draw=false for a numeric-only answer, and clear=true to remove earlier Agent overlays first.',
  'Returns compact JSON with meters/degrees plus a rendered summary; call earth_capture to show it.',
].join('\n')

// ---------------------------------------------------------------------------
// earth_analyze: one active terrain analysis at a time (profile/flood/sunlight),
// plus clear. The Host owns strict model-input validation and the compact text;
// the panel owns sampling, Cesium entities and the analysis card.
// ---------------------------------------------------------------------------

export const ANALYZE_ACTIONS = ['profile', 'flood', 'sunlight', 'clear']
const ANALYZE_PARAMETER_NAMES = new Set([
  'action',
  'layer',
  'from',
  'to',
  'samples',
  'region',
  'water_height',
  'grid',
  'datetime',
  'show_shadows',
])
const ANALYZE_REGION_KEYS = ['west', 'south', 'east', 'north']
const ANALYZE_MIN_SAMPLES = 8
const ANALYZE_MAX_SAMPLES = 64
const ANALYZE_DEFAULT_SAMPLES = 32
const ANALYZE_MIN_GRID = 4
const ANALYZE_MAX_GRID = 24
const ANALYZE_DEFAULT_GRID = 12
const ANALYZE_MIN_WATER_HEIGHT = -1000
const ANALYZE_MAX_WATER_HEIGHT = 9000
const ANALYZE_MAX_REGION_SPAN = 10
const ANALYZE_MIN_YEAR = 1900
const ANALYZE_MAX_YEAR = 2200

const ANALYZE_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ANALYZE_ACTIONS,
      description: 'profile: elevation along the from→to line; flood: water height over a region; sunlight: sun position and shadows at a time; clear: remove the active analysis.',
    },
    layer: {
      type: 'string',
      description: 'Layer name or id from earth_scene status. Omit it to use the topmost visible 3D Tiles layer.',
    },
    from: {
      type: 'array',
      items: { type: 'number' },
      description: 'profile start as [lon, lat] WGS84 degrees (-180..180, -90..90), without a height. Required for profile.',
    },
    to: {
      type: 'array',
      items: { type: 'number' },
      description: 'profile end as [lon, lat] WGS84 degrees (-180..180, -90..90), without a height. Required for profile.',
    },
    samples: {
      type: 'integer',
      minimum: ANALYZE_MIN_SAMPLES,
      maximum: ANALYZE_MAX_SAMPLES,
      description: `profile sample count, ${ANALYZE_MIN_SAMPLES}..${ANALYZE_MAX_SAMPLES}; default ${ANALYZE_DEFAULT_SAMPLES}.`,
    },
    region: {
      type: 'object',
      properties: {
        west: { type: 'number', minimum: -180, maximum: 180 },
        south: { type: 'number', minimum: -90, maximum: 90 },
        east: { type: 'number', minimum: -180, maximum: 180 },
        north: { type: 'number', minimum: -90, maximum: 90 },
      },
      required: ANALYZE_REGION_KEYS,
      additionalProperties: false,
      description: `flood area in WGS84 degrees, required for flood: west<east, south<north, and each span at most ${ANALYZE_MAX_REGION_SPAN} degrees.`,
    },
    water_height: {
      type: 'number',
      minimum: ANALYZE_MIN_WATER_HEIGHT,
      maximum: ANALYZE_MAX_WATER_HEIGHT,
      description: `flood water height in meters, ${ANALYZE_MIN_WATER_HEIGHT}..${ANALYZE_MAX_WATER_HEIGHT}; required for flood.`,
    },
    grid: {
      type: 'integer',
      minimum: ANALYZE_MIN_GRID,
      maximum: ANALYZE_MAX_GRID,
      description: `flood samples per side, ${ANALYZE_MIN_GRID}..${ANALYZE_MAX_GRID}; default ${ANALYZE_DEFAULT_GRID} (grid² samples).`,
    },
    datetime: {
      type: 'string',
      description: 'sunlight ISO 8601 date/time; defaults to now and must fall within the years 1900..2200.',
    },
    show_shadows: {
      type: 'boolean',
      description: 'sunlight shadows on or off; default true.',
    },
  },
  required: ['action'],
  additionalProperties: false,
}

const ANALYZE_DESCRIPTION = [
  'Analyze the digital earth panel: profile elevation along a line, flood a region at a water height, check sunlight and shadows, or clear the active analysis.',
  'One analysis at a time: profile, flood and sunlight replace the previous active analysis; clear removes it and reports what was cleared.',
  'Elevations and depths come from loaded 3D Tiles or terrain heights, so load data first and never guess missing values; the panel returns an error when it has no height data.',
  'Take coordinates from the user, from earth_scene status/pick, or from loaded data; never guess. The layer is optional and defaults to the topmost visible 3D Tiles layer.',
  'Returns compact metrics, not a full sampling grid; call earth_capture if the user should see the drawn result.',
].join('\n')

// ---------------------------------------------------------------------------
// earth_shader: four fixed look presets applied by the panel through
// Cesium.CustomShader. The Host never accepts GLSL, only a whitelisted preset
// and its bounded parameters; the panel owns shader compilation and cleanup.
// ---------------------------------------------------------------------------

export const SHADER_ACTIONS = ['apply', 'reset', 'list']
export const SHADER_PRESETS = ['height-false-color', 'contour', 'scan', 'water']
const SHADER_PARAMETER_NAMES = new Set([
  'action',
  'layer',
  'preset',
  'min_height',
  'max_height',
  'interval',
  'speed',
  'amplitude',
  'opacity',
])
const SHADER_PRESET_PARAMETERS = {
  'height-false-color': new Set(['min_height', 'max_height']),
  contour: new Set(['interval']),
  scan: new Set(['speed']),
  water: new Set(['speed', 'amplitude', 'opacity']),
}
const SHADER_MIN_HEIGHT = -1000
const SHADER_MAX_HEIGHT = 9000
const SHADER_MIN_INTERVAL = 1
const SHADER_MAX_INTERVAL = 500
const SHADER_DEFAULT_INTERVAL = 20
const SHADER_MIN_SPEED = 0.1
const SHADER_MAX_SPEED = 10
const SHADER_DEFAULT_SPEED = 1
const SHADER_MIN_AMPLITUDE = 0.1
const SHADER_MAX_AMPLITUDE = 5
const SHADER_DEFAULT_AMPLITUDE = 1
const SHADER_MIN_OPACITY = 0.05
const SHADER_MAX_OPACITY = 1
const SHADER_DEFAULT_OPACITY = 0.75

const SHADER_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: SHADER_ACTIONS,
      description: 'apply: add or replace one whitelisted shader preset on a layer; reset: clear the shader from one layer or all layers; list: report active shaders and available presets.',
    },
    layer: {
      type: 'string',
      description: 'apply/reset: layer name or id from earth_scene status. apply defaults to the topmost visible 3D Tiles layer; omit layer on reset to clear every shader.',
    },
    preset: {
      type: 'string',
      enum: SHADER_PRESETS,
      description: 'apply: one whitelisted look preset. height-false-color: elevation color ramp; contour: height isolines; scan: moving height band; water: translucent animated water surface.',
    },
    min_height: {
      type: 'number',
      minimum: SHADER_MIN_HEIGHT,
      maximum: SHADER_MAX_HEIGHT,
      description: 'height-false-color: optional lower elevation in meters. When both min_height and max_height are given, min_height must be lower.',
    },
    max_height: {
      type: 'number',
      minimum: SHADER_MIN_HEIGHT,
      maximum: SHADER_MAX_HEIGHT,
      description: 'height-false-color: optional upper elevation in meters. When both min_height and max_height are given, max_height must be higher.',
    },
    interval: {
      type: 'number',
      minimum: SHADER_MIN_INTERVAL,
      maximum: SHADER_MAX_INTERVAL,
      description: `contour: spacing between isolines in meters, ${SHADER_MIN_INTERVAL}..${SHADER_MAX_INTERVAL}; default ${SHADER_DEFAULT_INTERVAL}.`,
    },
    speed: {
      type: 'number',
      minimum: SHADER_MIN_SPEED,
      maximum: SHADER_MAX_SPEED,
      description: `scan/water: animation speed, ${SHADER_MIN_SPEED}..${SHADER_MAX_SPEED}; default ${SHADER_DEFAULT_SPEED}.`,
    },
    amplitude: {
      type: 'number',
      minimum: SHADER_MIN_AMPLITUDE,
      maximum: SHADER_MAX_AMPLITUDE,
      description: `water: wave amplitude, ${SHADER_MIN_AMPLITUDE}..${SHADER_MAX_AMPLITUDE}; default ${SHADER_DEFAULT_AMPLITUDE}.`,
    },
    opacity: {
      type: 'number',
      minimum: SHADER_MIN_OPACITY,
      maximum: SHADER_MAX_OPACITY,
      description: `water: surface opacity, ${SHADER_MIN_OPACITY}..${SHADER_MAX_OPACITY}; default ${SHADER_DEFAULT_OPACITY}.`,
    },
  },
  required: ['action'],
  additionalProperties: false,
}

const SHADER_DESCRIPTION = [
  'Apply one of four whitelisted look presets to a loaded 3D Tiles layer: height-false-color (elevation color ramp), contour (height isolines), scan (moving height band) and water (translucent animated water surface).',
  'apply adds or replaces the single shader on the chosen layer; different layers can show different presets, but applying again to the same layer replaces its shader. reset clears one layer or every active shader; list reports active shaders and presets.',
  'No custom GLSL is accepted; only these presets exist, so the model cannot inject shader source. Load 3D Tiles first: with no loaded 3D Tiles layer, or on 3DGS splats and layers without Cesium.CustomShader support, apply returns an error instead of a partial shader.',
  'Parameters use meters and seconds: height-false-color takes optional min_height/max_height, contour interval (default 20), scan speed (default 1), water speed/amplitude/opacity (defaults 1/1/0.75).',
  'Returns compact text plus JSON with operation, preset, layer, active and presets; call earth_capture if the user should see the shaded view.',
].join('\n')

export const SYSTEM_PROMPT_SECTION = [
  'The digital earth panel has 3D Tiles, splats, imagery and terrain. Control it with earth_scene, earth_capture, earth_draw and earth_measure, plus earth_analyze, plus earth_shader.',
  '',
  '- The panel opens automatically when a call needs it; if it does not attach, ask the user to open it from the chat header globe button, then retry.',
  '- Local paths: pass the absolute path directly to earth_scene load/inspect; a new folder gets one confirmation dialog and the call continues when allowed. If denied or timed out, stop and report; do not retry.',
  '- Call earth_scene status only when you need the current camera, layers or sources; load and fly return the view, so no confirmation call.',
  '- earth_scene actions: status, list, load, remove, visible, basemap, terrain, fly, reset, pick, inspect; its JSON is authoritative.',
  '- earth_capture saves an image and returns its path; read it with read_image if supported, else use the JSON. Call present to show a file; never embed a local path in Markdown.',
  '- earth_draw adds GeoJSON annotations and earth_measure returns distance/area/height numbers, both draw by default. Take coordinates from the user, status/pick or loaded data; never guess.',
  '- earth_analyze runs one analysis at a time (profile, flood, sunlight), or clear removes it; it needs loaded height data.',
  '- earth_shader applies whitelisted presets (height-false-color, contour, scan, water), lists them or resets; no custom GLSL.',
  '- Report only state the tools returned; never claim unverified data.',
  '- Errors start with a [code] and one next: step; follow it; never retry access_denied or access_timeout.',
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

const drawError = (message) => new Error(`earth_draw: ${message}`)

const measureError = (message) => new Error(`earth_measure: ${message}`)

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
      const hasPath = typeof raw.path === 'string'
      const path = hasPath ? raw.path : ''
      if (url !== '' && hasPath && path.trim() !== '') throw sceneError('load takes either "url" or "path", not both.')
      if (url !== '') {
        if (!isHttpUrl(url)) throw sceneError(`load "url" must be an absolute http(s) URL, got ${JSON.stringify(url)}.`)
        args.url = url
      } else if (hasPath) {
        // The bridge resolves folders and healed paths and returns a typed
        // [invalid_local_path] error for unusable input.
        args.path = path
      } else {
        throw sceneError('load needs "url" (online tileset.json) or "path" (absolute local path).')
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
    case 'inspect': {
      for (const key of ['url', 'path', 'layer']) {
        if (raw[key] !== undefined && typeof raw[key] !== 'string') throw sceneError(`inspect "${key}" must be a string.`)
      }
      const url = typeof raw.url === 'string' ? raw.url.trim() : ''
      const path = typeof raw.path === 'string' ? raw.path.trim() : ''
      const layer = typeof raw.layer === 'string' ? raw.layer.trim() : ''
      const given = [url !== '', path !== '', layer !== ''].filter((item) => item).length
      if (given === 0) throw sceneError('inspect needs exactly one of "layer" (a layer loaded in the panel), "path" (local tileset.json) or "url" (http(s) tileset.json).')
      if (given > 1) throw sceneError('inspect takes exactly one of "layer", "path" or "url", not several.')
      if (url !== '') {
        if (!isHttpUrl(url)) throw sceneError(`inspect "url" must be an absolute http(s) URL, got ${JSON.stringify(url)}.`)
        args.url = url
      } else if (path !== '') {
        // Folders and healed paths are resolved by the bridge, which returns
        // [invalid_local_path] for unusable input.
        args.path = path
      } else {
        args.layer = layer
      }
      if (raw.deep !== undefined) {
        if (typeof raw.deep !== 'boolean') throw sceneError('inspect "deep" must be true or false.')
        args.deep = raw.deep
      }
      break
    }
    case 'report': {
      const format = raw.format === undefined ? 'html' : raw.format
      if (typeof format !== 'string' || !REPORT_FORMATS.has(format)) {
        throw sceneError('report "format" must be "html" or "markdown".')
      }
      args.format = format
      if (raw.title !== undefined) {
        if (typeof raw.title !== 'string') throw sceneError('report "title" must be a string.')
        const title = raw.title.trim().slice(0, 120)
        if (title !== '') args.title = title
      }
      if (raw.include_capture !== undefined) {
        if (typeof raw.include_capture !== 'boolean') throw sceneError('report "include_capture" must be true or false.')
        args.include_capture = raw.include_capture
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

// ---------------------------------------------------------------------------
// earth_draw / earth_measure: browser-side overlays. The Host validates the
// model input (bounded size, real WGS84 positions) and forwards a normalized
// payload; the panel owns the Cesium entities and the numeric geometry.
// ---------------------------------------------------------------------------

const DRAW_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

/** Validate one GeoJSON position; `position` may carry an optional height. */
function validateDrawPosition(position) {
  if (!Array.isArray(position) || position.length < 2 || position.length > 3) {
    throw drawError('every GeoJSON position must be [lon, lat] or [lon, lat, height].')
  }
  for (const value of position) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw drawError('GeoJSON coordinates must be finite numbers.')
    }
  }
  const [lon, lat, height] = position
  if (lon < -180 || lon > 180) throw drawError(`longitude ${lon} is outside -180..180 degrees.`)
  if (lat < -90 || lat > 90) throw drawError(`latitude ${lat} is outside -90..90 degrees.`)
  if (position.length === 3 && Math.abs(height) > 10000000) {
    throw drawError('height must be within ±10,000,000 meters.')
  }
}

/**
 * Reject degenerate geometry up front: a LineString with one position or a
 * Polygon ring with two would otherwise draw nothing (or a NaN label) while the
 * tool reports success, which is worse for the model than an actionable error.
 */
function validateDrawGeometryShape(type, coordinates) {
  const isPosition = (value) => Array.isArray(value) && typeof value[0] === 'number'
  const requireArray = (value, message) => {
    if (!Array.isArray(value) || value.length === 0) throw drawError(message)
    return value
  }
  // A positions array must be an array *of positions*, not one position passed
  // by mistake (e.g. a LineString with coordinates [1, 2]).
  const requirePositions = (value, message, minimum) => {
    if (!Array.isArray(value) || value.length < minimum || !value.every(isPosition)) throw drawError(message)
    return value
  }
  switch (type) {
    case 'Point':
      validateDrawPosition(coordinates)
      return
    case 'MultiPoint':
      requirePositions(coordinates, 'a MultiPoint needs a non-empty array of [lon, lat] positions.', 1)
      return
    case 'LineString':
      requirePositions(coordinates, 'a LineString needs at least 2 positions.', 2)
      return
    case 'MultiLineString':
      for (const line of requireArray(coordinates, 'a MultiLineString needs at least one line.')) {
        requirePositions(line, 'every MultiLineString line needs at least 2 positions.', 2)
      }
      return
    case 'Polygon':
      for (const ring of requireArray(coordinates, 'a Polygon needs at least one ring.')) {
        requirePositions(ring, 'every Polygon ring needs at least 3 positions.', 3)
      }
      return
    case 'MultiPolygon':
      for (const polygon of requireArray(coordinates, 'a MultiPolygon needs at least one polygon.')) {
        for (const ring of requireArray(polygon, 'every MultiPolygon polygon needs at least one ring.')) {
          requirePositions(ring, 'every Polygon ring needs at least 3 positions.', 3)
        }
      }
      return
    default:
      throw drawError(`unsupported geometry type ${JSON.stringify(type)}; supported: ${[...DRAW_GEOMETRY_TYPES].join(', ')}.`)
  }
}

/**
 * Walk a GeoJSON coordinates value (any nesting depth) and validate every
 * position in place. A position is an array whose first entry is a number.
 */
function collectDrawPositions(value, positions) {
  if (!Array.isArray(value)) throw drawError('GeoJSON coordinates must be nested arrays of numbers.')
  if (value.length === 0) return
  if (typeof value[0] === 'number') {
    validateDrawPosition(value)
    positions.push(value)
    return
  }
  for (const item of value) collectDrawPositions(item, positions)
}

/** Keep only scalar feature properties and derive a display name, when any. */
function drawFeatureProperties(feature) {
  const source = feature?.properties
  const properties = {}
  if (source !== null && typeof source === 'object' && !Array.isArray(source)) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') properties[key] = value
    }
  }
  for (const key of ['name', 'title', 'label']) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim() !== '') {
      properties.name = value.trim().slice(0, 120)
      break
    }
  }
  return properties
}

/** Validate and flatten GeoJSON into a bounded FeatureCollection the panel draws. */
function normalizeDrawGeoJson(input) {
  let document = input
  if (typeof document === 'string') {
    try {
      document = JSON.parse(document)
    } catch (error) {
      throw drawError(`"features" must be valid GeoJSON JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw drawError('"features" must be a GeoJSON object (FeatureCollection, Feature or a geometry).')
  }
  const features = []
  const state = { coordinates: 0 }
  const addFeature = (feature) => {
    const geometry = feature?.geometry
    // GeoJSON allows a null geometry; it has nothing to draw.
    if (geometry === null || geometry === undefined) return
    const type = geometry?.type
    if (typeof type !== 'string' || !DRAW_GEOMETRY_TYPES.has(type)) {
      throw drawError(`unsupported geometry type ${JSON.stringify(type)}; supported: ${[...DRAW_GEOMETRY_TYPES].join(', ')}.`)
    }
    if (type === 'GeometryCollection') {
      if (!Array.isArray(geometry.geometries)) throw drawError('a GeometryCollection needs a geometries array.')
      for (const child of geometry.geometries) addFeature({ properties: feature.properties, geometry: child })
      return
    }
    validateDrawGeometryShape(type, geometry.coordinates)
    const positions = []
    collectDrawPositions(geometry.coordinates, positions)
    state.coordinates += positions.length
    if (state.coordinates > MAX_DRAW_COORDINATES) {
      throw drawError(`the GeoJSON has more than ${MAX_DRAW_COORDINATES} coordinates; split it into several calls.`)
    }
    features.push({
      type: 'Feature',
      properties: drawFeatureProperties(feature),
      geometry: { type, coordinates: geometry.coordinates },
    })
    if (features.length > MAX_DRAW_FEATURES) {
      throw drawError(`the GeoJSON has more than ${MAX_DRAW_FEATURES} features; split it into several calls.`)
    }
  }
  if (document.type === 'FeatureCollection') {
    if (!Array.isArray(document.features)) throw drawError('a FeatureCollection needs a features array.')
    for (const feature of document.features) {
      if (feature === null || typeof feature !== 'object' || feature.type !== 'Feature') {
        throw drawError('every entry of a FeatureCollection must be a GeoJSON Feature.')
      }
      addFeature(feature)
    }
  } else if (document.type === 'Feature') {
    addFeature(document)
  } else {
    addFeature({ geometry: document, properties: {} })
  }
  return { type: 'FeatureCollection', features }
}

/** Validate the model-facing earth_draw arguments and build the bridge command. */
export function normalizeDrawRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (typeof input !== 'object' || Array.isArray(input)) throw drawError('the arguments must be an object.')
  const accepted = new Set(['features', 'style', 'clear', 'label'])
  for (const key of Object.keys(input)) {
    if (accepted.has(key)) continue
    throw drawError(`it does not accept "${key}"; accepted arguments: features, style, label, clear.`)
  }
  if (input.clear !== undefined && typeof input.clear !== 'boolean') {
    throw drawError('"clear" must be true or false.')
  }
  const clear = input.clear === true
  let style = 'accent'
  if (input.style !== undefined) {
    if (typeof input.style !== 'string' || !DRAW_STYLES.includes(input.style)) {
      throw drawError(`"style" must be one of ${DRAW_STYLES.join(', ')}.`)
    }
    style = input.style
  }
  let label = ''
  if (input.label !== undefined) {
    if (typeof input.label !== 'string') throw drawError('"label" must be a string.')
    label = input.label.trim().slice(0, MAX_DRAW_LABEL)
  }
  const args = { clear, style }
  if (label !== '') args.label = label
  if (input.features !== undefined && input.features !== null) {
    const geojson = normalizeDrawGeoJson(input.features)
    if (geojson.features.length === 0 && !clear) {
      throw drawError('"features" contains no drawable features; pass at least one Point, LineString or Polygon, or use clear=true.')
    }
    if (geojson.features.length > 0) args.geojson = geojson
  } else if (!clear) {
    throw drawError('needs "features" with GeoJSON to draw, or clear=true to remove the overlays the Agent drew earlier.')
  }
  return { args }
}

/** Validate one [lon, lat] or [lon, lat, height] measurement point. */
function normalizeMeasurePoint(position, index) {
  const label = `points[${index}]`
  if (!Array.isArray(position) || position.length < 2 || position.length > 3) {
    throw measureError(`${label} must be [lon, lat] or [lon, lat, height].`)
  }
  for (const value of position) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw measureError(`${label} must contain finite numbers.`)
    }
  }
  const [lon, lat, height] = position
  if (lon < -180 || lon > 180) throw measureError(`${label} longitude ${lon} is outside -180..180 degrees.`)
  if (lat < -90 || lat > 90) throw measureError(`${label} latitude ${lat} is outside -90..90 degrees.`)
  if (position.length === 3 && Math.abs(height) > 10000000) throw measureError(`${label} height must be within ±10,000,000 meters.`)
  return position.length === 3 ? [lon, lat, height] : [lon, lat]
}

/** Validate the model-facing earth_measure arguments and build the bridge command. */
export function normalizeMeasureRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (typeof input !== 'object' || Array.isArray(input)) throw measureError('the arguments must be an object.')
  const accepted = new Set(['mode', 'points', 'draw', 'clear'])
  for (const key of Object.keys(input)) {
    if (accepted.has(key)) continue
    throw measureError(`it does not accept "${key}"; accepted arguments: mode, points, draw, clear.`)
  }
  const mode = input.mode
  if (typeof mode !== 'string' || !MEASURE_MODES.includes(mode)) {
    throw measureError(`"mode" must be one of ${MEASURE_MODES.join(', ')}.`)
  }
  if (!Array.isArray(input.points)) {
    throw measureError('"points" must be an array of [lon, lat] or [lon, lat, height] positions.')
  }
  if (input.points.length < MIN_MEASURE_POINTS) {
    throw measureError(`"points" needs at least ${MIN_MEASURE_POINTS} positions.`)
  }
  if (input.points.length > MAX_MEASURE_POINTS) {
    throw measureError(`"points" is limited to ${MAX_MEASURE_POINTS} positions per call.`)
  }
  const points = input.points.map((position, index) => normalizeMeasurePoint(position, index))
  if (mode === 'area' && points.length < 3) throw measureError('area needs at least 3 points.')
  if (mode === 'height' && points.length !== 2) throw measureError('height needs exactly 2 points (the first and the last).')
  if (input.draw !== undefined && typeof input.draw !== 'boolean') throw measureError('"draw" must be true or false.')
  if (input.clear !== undefined && typeof input.clear !== 'boolean') throw measureError('"clear" must be true or false.')
  return { args: { mode, points, draw: input.draw !== false, clear: input.clear === true } }
}

// ---------------------------------------------------------------------------
// earth_analyze: model-facing input normalization
// ---------------------------------------------------------------------------

const analyzeError = (message, next = 'check the argument against the earth_analyze schema and retry.') =>
  new Error(`earth_analyze: ${message} next: ${next}`)

function normalizeAnalyzeLayer(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw analyzeError(
      '"layer" must be a non-empty layer name or id from earth_scene status.',
      'omit "layer" to use the topmost visible 3D Tiles layer, or pass the exact name from earth_scene list.',
    )
  }
  return value.trim()
}

function normalizeAnalyzeCoordinate(raw, label) {
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw analyzeError(
      `"${label}" must be exactly [lon, lat] without a height.`,
      'send two WGS84 numbers, for example [116.39, 39.9].',
    )
  }
  for (const value of raw) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw analyzeError(
        `"${label}" must contain two finite numbers.`,
        'send [lon, lat] as decimal degrees, for example [116.39, 39.9].',
      )
    }
  }
  const [lon, lat] = raw
  if (lon < -180 || lon > 180) {
    throw analyzeError(
      `"${label}" longitude ${lon} is outside -180..180 degrees.`,
      'send a longitude between -180 and 180.',
    )
  }
  if (lat < -90 || lat > 90) {
    throw analyzeError(
      `"${label}" latitude ${lat} is outside -90..90 degrees.`,
      'send a latitude between -90 and 90.',
    )
  }
  return [lon, lat]
}

function normalizeAnalyzeNumber(raw, label, min, max) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw analyzeError(
      `"${label}" must be a finite number.`,
      `send "${label}" as a number between ${min} and ${max}.`,
    )
  }
  if (raw < min || raw > max) {
    throw analyzeError(
      `"${label}" ${raw} is outside ${min}..${max}.`,
      `send "${label}" within ${min}..${max}.`,
    )
  }
  return raw
}

function normalizeAnalyzeInteger(raw, label, min, max, fallback) {
  if (raw === undefined) return fallback
  if (!Number.isInteger(raw)) {
    throw analyzeError(
      `"${label}" must be an integer.`,
      `send "${label}" as an integer between ${min} and ${max}.`,
    )
  }
  if (raw < min || raw > max) {
    throw analyzeError(
      `"${label}" ${raw} is outside ${min}..${max}.`,
      `send "${label}" within ${min}..${max}.`,
    )
  }
  return raw
}

function normalizeAnalyzeRegion(raw) {
  if (!isPlainObject(raw)) {
    throw analyzeError(
      '"region" must be an object with west, south, east and north.',
      'send the flood area as {west, south, east, north} in WGS84 degrees.',
    )
  }
  for (const key of Object.keys(raw)) {
    if (ANALYZE_REGION_KEYS.includes(key)) continue
    throw analyzeError(
      `"region" does not accept "${key}".`,
      'use exactly west, south, east and north.',
    )
  }
  for (const key of ANALYZE_REGION_KEYS) {
    if (!Object.hasOwn(raw, key)) {
      throw analyzeError(
        `"region" is missing "${key}"; it needs west, south, east and north.`,
        'send all four WGS84 degree boundaries.',
      )
    }
  }
  const west = normalizeAnalyzeNumber(raw.west, 'region.west', -180, 180)
  const south = normalizeAnalyzeNumber(raw.south, 'region.south', -90, 90)
  const east = normalizeAnalyzeNumber(raw.east, 'region.east', -180, 180)
  const north = normalizeAnalyzeNumber(raw.north, 'region.north', -90, 90)
  if (west >= east) {
    throw analyzeError(
      '"region.west" must be less than "region.east".',
      'send a west boundary that lies west of the east boundary.',
    )
  }
  if (south >= north) {
    throw analyzeError(
      '"region.south" must be less than "region.north".',
      'send a south boundary that lies south of the north boundary.',
    )
  }
  if (east - west > ANALYZE_MAX_REGION_SPAN + 1e-9) {
    throw analyzeError(
      `"region" longitude span ${Number((east - west).toFixed(6))} exceeds ${ANALYZE_MAX_REGION_SPAN} degrees.`,
      `narrow the flood area to at most ${ANALYZE_MAX_REGION_SPAN} degrees of longitude.`,
    )
  }
  if (north - south > ANALYZE_MAX_REGION_SPAN + 1e-9) {
    throw analyzeError(
      `"region" latitude span ${Number((north - south).toFixed(6))} exceeds ${ANALYZE_MAX_REGION_SPAN} degrees.`,
      `narrow the flood area to at most ${ANALYZE_MAX_REGION_SPAN} degrees of latitude.`,
    )
  }
  return { west, south, east, north }
}

/** Reject known-but-irrelevant arguments for the chosen action before running it. */
function rejectAnalyzeKeys(input, action, allowed) {
  for (const key of Object.keys(input)) {
    if (key === 'action' || allowed.has(key)) continue
    let next
    if (key === 'region' || key === 'water_height' || key === 'grid') {
      next = 'use action "flood" for these arguments.'
    } else if (key === 'datetime' || key === 'show_shadows') {
      next = 'use action "sunlight" for these arguments.'
    } else if (key === 'from' || key === 'to' || key === 'samples') {
      next = 'use action "profile" for these arguments.'
    } else if (action === 'clear') {
      next = 'clear takes no other arguments and removes the active analysis.'
    } else {
      next = `remove "${key}" or choose the action that accepts it.`
    }
    throw analyzeError(`action "${action}" does not accept "${key}".`, next)
  }
}

/** Validate the model-facing earth_analyze arguments and build the bridge command. */
export function normalizeAnalyzeRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (!isPlainObject(input)) throw analyzeError('the arguments must be an object.')
  for (const key of Object.keys(input)) {
    if (key !== 'action' && !ANALYZE_PARAMETER_NAMES.has(key)) {
      throw analyzeError(
        `it does not accept "${key}"; accepted arguments: ${[...ANALYZE_PARAMETER_NAMES].join(', ')}.`,
        'remove the unknown argument and retry.',
      )
    }
  }
  const action = input.action
  if (typeof action !== 'string' || !ANALYZE_ACTIONS.includes(action)) {
    throw analyzeError(
      `"action" must be one of ${ANALYZE_ACTIONS.join(', ')}.`,
      'choose profile, flood, sunlight or clear.',
    )
  }
  if (action === 'clear') {
    rejectAnalyzeKeys(input, 'clear', new Set())
    return { args: { action } }
  }

  const args = { action }
  if (input.layer !== undefined) args.layer = normalizeAnalyzeLayer(input.layer)

  if (action === 'profile') {
    rejectAnalyzeKeys(input, 'profile', new Set(['layer', 'from', 'to', 'samples']))
    if (!Object.hasOwn(input, 'from')) {
      throw analyzeError('profile needs "from" as [lon, lat].', 'send the profile start and end points.')
    }
    if (!Object.hasOwn(input, 'to')) {
      throw analyzeError('profile needs "to" as [lon, lat].', 'send the profile start and end points.')
    }
    args.from = normalizeAnalyzeCoordinate(input.from, 'from')
    args.to = normalizeAnalyzeCoordinate(input.to, 'to')
    if (args.from[0] === args.to[0] && args.from[1] === args.to[1]) {
      throw analyzeError(
        'profile "from" and "to" are the same point.',
        'choose two distinct positions along the profile line.',
      )
    }
    args.samples = normalizeAnalyzeInteger(
      input.samples,
      'samples',
      ANALYZE_MIN_SAMPLES,
      ANALYZE_MAX_SAMPLES,
      ANALYZE_DEFAULT_SAMPLES,
    )
    return { args }
  }

  if (action === 'flood') {
    rejectAnalyzeKeys(input, 'flood', new Set(['layer', 'region', 'water_height', 'grid']))
    if (!Object.hasOwn(input, 'region')) {
      throw analyzeError('flood needs "region" with west, south, east and north.', 'send the flood area.')
    }
    if (!Object.hasOwn(input, 'water_height')) {
      throw analyzeError('flood needs "water_height" in meters.', 'send the water height to test against the terrain.')
    }
    args.region = normalizeAnalyzeRegion(input.region)
    args.water_height = normalizeAnalyzeNumber(
      input.water_height,
      'water_height',
      ANALYZE_MIN_WATER_HEIGHT,
      ANALYZE_MAX_WATER_HEIGHT,
    )
    args.grid = normalizeAnalyzeInteger(input.grid, 'grid', ANALYZE_MIN_GRID, ANALYZE_MAX_GRID, ANALYZE_DEFAULT_GRID)
    return { args }
  }

  // sunlight
  rejectAnalyzeKeys(input, 'sunlight', new Set(['layer', 'datetime', 'show_shadows']))
  if (input.datetime !== undefined) {
    if (typeof input.datetime !== 'string' || input.datetime.trim() === '') {
      throw analyzeError('"datetime" must be an ISO 8601 date/time string.', 'send a time such as 2026-11-05T12:00:00Z.')
    }
    const milliseconds = Date.parse(input.datetime.trim())
    if (!Number.isFinite(milliseconds)) {
      throw analyzeError('"datetime" is not a valid date/time.', 'send an ISO 8601 time such as 2026-11-05T12:00:00Z.')
    }
    const date = new Date(milliseconds)
    const year = date.getUTCFullYear()
    if (year < ANALYZE_MIN_YEAR || year > ANALYZE_MAX_YEAR) {
      throw analyzeError(
        `"datetime" year ${year} is outside ${ANALYZE_MIN_YEAR}..${ANALYZE_MAX_YEAR}.`,
        `choose a time within the years ${ANALYZE_MIN_YEAR}..${ANALYZE_MAX_YEAR}.`,
      )
    }
    // Keep the caller's exact ISO string; Date.parse above established that the
    // panel can turn it into the same instant without the Host rewriting it.
    args.datetime = input.datetime.trim()
  }
  if (input.show_shadows !== undefined && typeof input.show_shadows !== 'boolean') {
    throw analyzeError('"show_shadows" must be true or false.', 'pass true to enable shadows or false to disable them.')
  }
  args.show_shadows = input.show_shadows !== false
  return { args }
}

// ---------------------------------------------------------------------------
// earth_shader: model-facing input normalization
// ---------------------------------------------------------------------------

const shaderError = (message, next = 'check the argument against the earth_shader schema and retry.') =>
  new Error(`earth_shader: ${message} next: ${next}`)

function normalizeShaderLayer(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw shaderError(
      '"layer" must be a non-empty layer name or id from earth_scene status.',
      'omit "layer" to use the topmost visible 3D Tiles layer, or pass the exact name from earth_scene list.',
    )
  }
  return value.trim()
}

function normalizeShaderNumber(raw, label, min, max) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw shaderError(
      `"${label}" must be a finite number.`,
      `send "${label}" as a number between ${min} and ${max}.`,
    )
  }
  if (raw < min || raw > max) {
    throw shaderError(
      `"${label}" ${raw} is outside ${min}..${max}.`,
      `send "${label}" within ${min}..${max}.`,
    )
  }
  return raw
}

/** Reject known-but-irrelevant arguments for the chosen shader action/preset. */
function rejectShaderKeys(input, action, allowed) {
  for (const key of Object.keys(input)) {
    if (key === 'action' || allowed.has(key)) continue
    let next
    if (action === 'list') {
      next = 'list accepts only "action"; call apply or reset to change a shader.'
    } else if (action === 'reset') {
      next = 'reset accepts only "action" and an optional "layer"; use action "apply" to add a shader.'
    } else if (key === 'min_height' || key === 'max_height') {
      next = 'use preset "height-false-color" for elevation bounds.'
    } else if (key === 'interval') {
      next = 'use preset "contour" for interval.'
    } else if (key === 'speed') {
      next = 'use preset "scan" or "water" for speed.'
    } else if (key === 'amplitude' || key === 'opacity') {
      next = 'use preset "water" for this parameter.'
    } else {
      next = `remove "${key}" or choose the action that accepts it.`
    }
    throw shaderError(`action "${action}" does not accept "${key}".`, next)
  }
}

/** Validate the model-facing earth_shader arguments and build the bridge command. */
export function normalizeShaderRequest(raw) {
  const input = raw === null || raw === undefined ? {} : raw
  if (!isPlainObject(input)) throw shaderError('the arguments must be an object.')
  for (const key of Object.keys(input)) {
    if (key !== 'action' && !SHADER_PARAMETER_NAMES.has(key)) {
      throw shaderError(
        `it does not accept "${key}"; accepted arguments: ${[...SHADER_PARAMETER_NAMES].join(', ')}.`,
        'remove the unknown argument and retry.',
      )
    }
  }
  const action = input.action
  if (typeof action !== 'string' || !SHADER_ACTIONS.includes(action)) {
    throw shaderError(
      `"action" must be one of ${SHADER_ACTIONS.join(', ')}.`,
      'choose apply, reset or list.',
    )
  }
  if (action === 'list') {
    rejectShaderKeys(input, 'list', new Set())
    return { args: { action } }
  }
  if (action === 'reset') {
    rejectShaderKeys(input, 'reset', new Set(['layer']))
    const args = { action }
    if (input.layer !== undefined) args.layer = normalizeShaderLayer(input.layer)
    return { args }
  }

  const preset = input.preset
  if (typeof preset !== 'string' || !SHADER_PRESETS.includes(preset)) {
    throw shaderError(
      `apply needs "preset"; "preset" must be one of ${SHADER_PRESETS.join(', ')}.`,
      'choose height-false-color, contour, scan or water.',
    )
  }
  rejectShaderKeys(input, 'apply', new Set(['layer', 'preset', ...SHADER_PRESET_PARAMETERS[preset]]))
  const args = { action, preset }
  if (input.layer !== undefined) args.layer = normalizeShaderLayer(input.layer)

  if (preset === 'height-false-color') {
    const hasMin = input.min_height !== undefined
    const hasMax = input.max_height !== undefined
    const min = hasMin ? normalizeShaderNumber(input.min_height, 'min_height', SHADER_MIN_HEIGHT, SHADER_MAX_HEIGHT) : undefined
    const max = hasMax ? normalizeShaderNumber(input.max_height, 'max_height', SHADER_MIN_HEIGHT, SHADER_MAX_HEIGHT) : undefined
    if (hasMin && hasMax && min >= max) {
      throw shaderError(
        '"min_height" must be less than "max_height".',
        'send a lower bound below the upper bound, or omit both to use the layer extent.',
      )
    }
    if (hasMin) args.min_height = min
    if (hasMax) args.max_height = max
  } else if (preset === 'contour') {
    args.interval = input.interval === undefined
      ? SHADER_DEFAULT_INTERVAL
      : normalizeShaderNumber(input.interval, 'interval', SHADER_MIN_INTERVAL, SHADER_MAX_INTERVAL)
  } else if (preset === 'scan') {
    args.speed = input.speed === undefined
      ? SHADER_DEFAULT_SPEED
      : normalizeShaderNumber(input.speed, 'speed', SHADER_MIN_SPEED, SHADER_MAX_SPEED)
  } else {
    args.speed = input.speed === undefined
      ? SHADER_DEFAULT_SPEED
      : normalizeShaderNumber(input.speed, 'speed', SHADER_MIN_SPEED, SHADER_MAX_SPEED)
    args.amplitude = input.amplitude === undefined
      ? SHADER_DEFAULT_AMPLITUDE
      : normalizeShaderNumber(input.amplitude, 'amplitude', SHADER_MIN_AMPLITUDE, SHADER_MAX_AMPLITUDE)
    args.opacity = input.opacity === undefined
      ? SHADER_DEFAULT_OPACITY
      : normalizeShaderNumber(input.opacity, 'opacity', SHADER_MIN_OPACITY, SHADER_MAX_OPACITY)
  }
  return { args }
}

/** Compact host-side distance text for model-facing renderers. */
function formatMeasureDistance(meters) {
  if (!Number.isFinite(meters)) return 'unknown'
  return meters >= 1000 ? `${(meters / 1000).toFixed(3)} km (${meters.toFixed(1)} m)` : `${meters.toFixed(2)} m`
}

/** Compact host-side area text for model-facing renderers. */
function formatMeasureArea(squareMeters) {
  if (!Number.isFinite(squareMeters)) return 'unknown'
  if (squareMeters >= 1e6) return `${(squareMeters / 1e6).toFixed(3)} km² (${Math.round(squareMeters)} m²)`
  return `${squareMeters.toFixed(1)} m²`
}

function renderDrawResult(value) {
  const lines = []
  if (value.cleared === true) lines.push('Cleared the overlays the Agent drew earlier on the digital earth.')
  const drawn = Number.isInteger(value.drawn) ? value.drawn : 0
  if (drawn > 0) {
    const byType = isPlainObject(value.by_type) ? value.by_type : {}
    const parts = ['points', 'lines', 'polygons']
      .filter((key) => Number.isInteger(byType[key]) && byType[key] > 0)
      .map((key) => `${key}=${byType[key]}`)
    lines.push(`Drew ${drawn} feature${drawn === 1 ? '' : 's'} on the digital earth${parts.length > 0 ? ` (${parts.join(', ')})` : ''}.`)
    const bbox = isPlainObject(value.bbox) ? value.bbox : null
    if (bbox !== null) {
      lines.push(`Bounding box: west=${bbox.west}, south=${bbox.south}, east=${bbox.east}, north=${bbox.north}.`)
    }
    if (typeof value.label === 'string' && value.label !== '') lines.push(`Label: ${value.label}`)
    lines.push('Call earth_capture if the user should see the annotated view.')
  } else if (value.cleared !== true) {
    lines.push('No features were drawn.')
  }
  return lines.join('\n')
}

function renderMeasureResult(value) {
  const lines = []
  if (value.cleared === true) lines.push('Cleared the overlays the Agent drew earlier on the digital earth.')
  if (value.mode === 'distance' && Number.isFinite(value.distance_m)) {
    lines.push(`Geodesic distance: ${formatMeasureDistance(value.distance_m)} across ${Number.isInteger(value.points) ? value.points : '?'} points.`)
  } else if (value.mode === 'area' && Number.isFinite(value.area_m2)) {
    const perimeter = Number.isFinite(value.perimeter_m) ? `, perimeter ${formatMeasureDistance(value.perimeter_m)}` : ''
    lines.push(`Area: ${formatMeasureArea(value.area_m2)}${perimeter}.`)
  } else if (value.mode === 'height' && Number.isFinite(value.height_m)) {
    const sign = value.height_m >= 0 ? '+' : ''
    const horizontal = Number.isFinite(value.horizontal_m) ? ` over ${formatMeasureDistance(value.horizontal_m)} horizontal distance` : ''
    const slope = Number.isFinite(value.slope_deg) ? ` (slope ${value.slope_deg.toFixed(1)}°)` : ''
    lines.push(`Height difference: ${sign}${value.height_m.toFixed(2)} m${horizontal}${slope}.`)
  } else {
    lines.push(`Measurement (${String(value.mode)}) completed.`)
  }
  if (value.drawn === true) lines.push('The measurement is drawn on the globe; call earth_capture if the user should see it.')
  return lines.join('\n')
}

function formatAnalyzeCoordinate(position) {
  return Array.isArray(position) && position.length === 2 && position.every((value) => Number.isFinite(value))
    ? `[${position[0]}, ${position[1]}]`
    : 'unknown'
}

function formatAnalyzeSquareKilometers(squareKilometers) {
  return Number.isFinite(squareKilometers) ? `${squareKilometers.toFixed(3)} km²` : 'unknown'
}

/** Keep the analysis result inside its UTF-8 budget without splitting characters. */
function truncateAnalyzeText(text, note) {
  if (Buffer.byteLength(text, 'utf8') <= ANALYZE_RENDER_LIMIT) return text
  const budget = Math.max(0, ANALYZE_RENDER_LIMIT - Buffer.byteLength(note, 'utf8'))
  let head = ''
  let used = 0
  for (const character of text) {
    const size = Buffer.byteLength(character, 'utf8')
    if (used + size > budget) break
    head += character
    used += size
  }
  return `${head}${note}`
}

function renderAnalyzeResult(value) {
  if (!isPlainObject(value)) return truncateAnalyzeText(String(value), '\n[analysis result truncated]')
  const operation = typeof value.operation === 'string' ? value.operation : 'unknown'
  const layer = typeof value.layer === 'string' && value.layer !== '' ? ` on layer ${value.layer}` : ''
  const lines = []

  if (operation === 'profile') {
    const details = []
    if (value.from !== undefined && value.to !== undefined) {
      details.push(`from ${formatAnalyzeCoordinate(value.from)} to ${formatAnalyzeCoordinate(value.to)}`)
    }
    if (Number.isFinite(value.length_m)) details.push(formatMeasureDistance(value.length_m))
    if (Number.isInteger(value.samples)) details.push(`${value.samples} samples`)
    lines.push(`Profile${layer}${details.length > 0 ? `: ${details.join(', ')}` : ' completed'}.`)
    const stats = isPlainObject(value.stats) ? value.stats : {}
    const height = []
    if (Number.isFinite(stats.min_height)) height.push(`min ${stats.min_height.toFixed(1)} m`)
    if (Number.isFinite(stats.max_height)) height.push(`max ${stats.max_height.toFixed(1)} m`)
    if (Number.isFinite(stats.relief_m)) height.push(`relief ${stats.relief_m.toFixed(1)} m`)
    if (Number.isFinite(stats.gain_m)) height.push(`gain ${stats.gain_m.toFixed(1)} m`)
    if (Number.isFinite(stats.loss_m)) height.push(`loss ${stats.loss_m.toFixed(1)} m`)
    if (height.length > 0) lines.push(`Elevation: ${height.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the drawn profile.')
  } else if (operation === 'flood') {
    const details = []
    if (isPlainObject(value.region)) {
      const { west, south, east, north } = value.region
      if ([west, south, east, north].every((number) => Number.isFinite(number))) {
        details.push(`region [${west}, ${south}, ${east}, ${north}]`)
      }
    }
    if (Number.isFinite(value.water_height)) details.push(`water ${value.water_height} m`)
    if (Number.isInteger(value.grid)) details.push(`grid ${value.grid}×${value.grid}`)
    lines.push(`Flood${layer}${details.length > 0 ? `: ${details.join(', ')}` : ' completed'}.`)
    const area = []
    if (Number.isFinite(value.area_km2)) area.push(`area ${formatAnalyzeSquareKilometers(value.area_km2)}`)
    if (Number.isFinite(value.inundated_km2)) area.push(`inundated ${formatAnalyzeSquareKilometers(value.inundated_km2)}`)
    if (Number.isFinite(value.inundated_ratio)) area.push(`${(value.inundated_ratio * 100).toFixed(1)}% inundated`)
    if (area.length > 0) lines.push(`Coverage: ${area.join(', ')}.`)
    const depth = []
    if (Number.isFinite(value.depth_max_m)) depth.push(`max ${value.depth_max_m.toFixed(2)} m`)
    if (Number.isFinite(value.depth_mean_m)) depth.push(`mean ${value.depth_mean_m.toFixed(2)} m`)
    if (depth.length > 0) lines.push(`Depth: ${depth.join(', ')}.`)
    const samples = []
    if (Number.isInteger(value.samples_with_data)) samples.push(`${value.samples_with_data} with height data`)
    if (Number.isInteger(value.samples_inundated)) samples.push(`${value.samples_inundated} inundated`)
    if (samples.length > 0) lines.push(`Samples: ${samples.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the shaded flood area.')
  } else if (operation === 'sunlight') {
    const sun = isPlainObject(value.sun) ? value.sun : {}
    const details = [value.datetime ?? 'current time']
    if (Number.isFinite(sun.altitude_deg)) details.push(`altitude ${sun.altitude_deg.toFixed(1)}°`)
    if (Number.isFinite(sun.azimuth_deg)) details.push(`azimuth ${sun.azimuth_deg.toFixed(1)}°`)
    details.push(value.night === true ? 'night' : 'day')
    details.push(value.shadows_enabled === true ? 'shadows on' : 'shadows off')
    lines.push(`Sunlight${layer}: ${details.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the sun position or shadows.')
  } else if (operation === 'clear') {
    const cleared = Array.isArray(value.cleared) ? value.cleared.filter((item) => typeof item === 'string') : []
    lines.push(cleared.length > 0 ? `Cleared the active analysis (${cleared.join(', ')}).` : 'No active analysis was cleared.')
  } else {
    lines.push(`Analysis (${operation}) completed.`)
  }

  let json
  try {
    json = JSON.stringify(value)
  } catch {
    json = null
  }
  const summary = lines.join('\n')
  if (typeof json !== 'string') return truncateAnalyzeText(summary, '\n[analysis result truncated]')
  return truncateAnalyzeText(
    `${summary}\nJSON: ${json}`,
    `\n[analysis JSON truncated at ${ANALYZE_RENDER_LIMIT} UTF-8 bytes]`,
  )
}

function renderShaderResult(value) {
  if (!isPlainObject(value)) return String(value)
  const operation = typeof value.operation === 'string' ? value.operation : 'unknown'
  const preset = typeof value.preset === 'string' && value.preset !== '' ? value.preset : null
  const layer = typeof value.layer === 'string' && value.layer !== '' ? value.layer : null
  const active = []
  for (const entry of Array.isArray(value.active) ? value.active : []) {
    if (!isPlainObject(entry)) continue
    const activeLayer = typeof entry.layer === 'string' && entry.layer !== '' ? entry.layer : 'unknown layer'
    const activePreset = typeof entry.preset === 'string' && entry.preset !== '' ? entry.preset : 'unknown preset'
    active.push(`${activeLayer} (${activePreset})`)
    if (active.length >= 20) {
      active.push('...')
      break
    }
  }
  const presets = (Array.isArray(value.presets) ? value.presets : SHADER_PRESETS)
    .filter((entry) => typeof entry === 'string' && entry !== '')
    .slice(0, SHADER_PRESETS.length)
  const lines = []
  if (operation === 'apply') {
    lines.push(`Applied shader${preset === null ? '' : ` preset ${preset}`}${layer === null ? ' to the default layer' : ` on layer ${layer}`}.`)
  } else if (operation === 'reset') {
    lines.push(layer === null ? 'Reset every active shader.' : `Reset the shader on layer ${layer}.`)
  } else if (operation === 'list') {
    lines.push('Shader list.')
  } else {
    lines.push(`Shader command (${operation}) completed.`)
  }
  lines.push(active.length > 0 ? `Active shaders: ${active.join(', ')}.` : 'Active shaders: none.')
  lines.push(`Available presets: ${presets.length > 0 ? presets.join(', ') : 'unknown'}.`)
  let json
  try {
    json = JSON.stringify(value)
  } catch {
    json = null
  }
  return typeof json === 'string' ? `${lines.join('\n')}\nJSON: ${json}` : lines.join('\n')
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
 *
 * A tool call may arrive before the panel exists: the client half opens the
 * docked tab on demand. `waitForAttach` therefore holds the command for a short
 * grace period (options.attachGraceMs) while the tab connects, instead of
 * failing the first call in a closed conversation.
 *
 * Test seam: exported so the host bridge can be exercised without a web server.
 */
export function createBridge(allowedDirs, options = {}) {
  const sessions = new Map()
  const pending = new Map()
  const queues = new Map()
  // One waiter set per session id: the attach waiters of that session.
  const attachWaiters = new Map()
  const requestedGrace = options?.attachGraceMs
  const attachGraceMs = Number.isFinite(requestedGrace) && requestedGrace >= 0 ? requestedGrace : PANEL_ATTACH_GRACE_MS
  // Panel access dialogs get their own deadline; it is independent from the
  // scene-command timeout and can be shortened by tests.
  const requestedAuthorize = options?.authorizeTimeoutMs
  const authorizeTimeoutMs = Number.isFinite(requestedAuthorize) && requestedAuthorize > 0 ? requestedAuthorize : LOCAL_ACCESS_TIMEOUT_MS
  let sequence = 0

  const connectedSessions = () =>
    [...sessions.keys()].filter((sessionId) => (sessions.get(sessionId)?.size ?? 0) > 0)

  const hasConnection = (sessionId) => (sessions.get(sessionId)?.size ?? 0) > 0

  /** Wake every attach waiter of a session; a real connection replaces the wait. */
  const wakeAttachWaiters = (sessionId) => {
    const waiters = attachWaiters.get(sessionId)
    if (!waiters) return
    for (const waiter of [...waiters]) waiter.finish(true)
  }

  /**
   * Resolve true once a connection for the session exists, false after the
   * timeout or on abort, true immediately when a tab is already connected.
   */
  const waitForAttach = (sessionId, timeoutMs, signal) => {
    if (hasConnection(sessionId)) return Promise.resolve(true)
    return new Promise((resolveWait) => {
      const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0
      if (limit === 0) {
        resolveWait(false)
        return
      }
      const waiters = attachWaiters.get(sessionId) ?? new Set()
      attachWaiters.set(sessionId, waiters)
      let timer = null
      const waiter = {
        done: false,
        finish: (attached) => {
          if (waiter.done) return
          waiter.done = true
          if (timer !== null) clearTimeout(timer)
          signal?.removeEventListener?.('abort', onAbort)
          waiters.delete(waiter)
          if (waiters.size === 0 && attachWaiters.get(sessionId) === waiters) attachWaiters.delete(sessionId)
          resolveWait(attached)
        },
      }
      const onAbort = () => waiter.finish(false)
      waiters.add(waiter)
      timer = setTimeout(() => waiter.finish(false), limit)
      // Keep this short timer ref'd: unref'ing it lets a test runner (or a
      // draining event loop) end the process while the awaited attach promise is
      // still pending, which surfaces as "Promise resolution is still pending".
      timer.ref?.()
      signal?.addEventListener?.('abort', onAbort, { once: true })
      // `abort` may have fired between the check above and the listener.
      if (signal?.aborted) waiter.finish(false)
    })
  }

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
    // The stream is live: release any tool call that was waiting for this tab.
    wakeAttachWaiters(sessionId)
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

  const bridgeFailure = (kind, message) => {
    const error = new Error(message)
    error.bridgeKind = kind
    return error
  }

  /** Send one command to the newest connection of a session and await its ack. */
  const dispatch = (sessionId, action, args, timeoutMs, signal) => new Promise((resolveCommand, rejectCommand) => {
    const cancelledMessage = `The "${action}" command was cancelled before it reached the digital earth panel.`
    if (signal?.aborted) {
      rejectCommand(bridgeFailure('cancelled', cancelledMessage))
      return
    }
    const connections = sessions.get(sessionId)
    if (!connections || connections.size === 0) {
      rejectCommand(bridgeFailure('closed', PANEL_CLOSED_MESSAGE))
      return
    }
    // The timeout starts when this command is actually dispatched, not when it
    // was queued behind an earlier one for the same session.
    if (!(timeoutMs > 0)) {
      rejectCommand(bridgeFailure('timeout', timeoutMessage(action, timeoutMs) + (connections.size > 1 ? MULTI_TAB_HINT : '')))
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
        if (error) rejectCommand(error)
        else resolveCommand(value === undefined ? {} : value)
      },
    }
    abortListener = () => job.finish(bridgeFailure('cancelled', `The "${action}" command was cancelled.`))
    signal?.addEventListener?.('abort', abortListener, { once: true })
    pending.set(id, job)
    const timerMessage = timeoutMessage(action, timeoutMs) + (connections.size > 1 ? MULTI_TAB_HINT : '')
    job.timer = setTimeout(() => job.finish(bridgeFailure('timeout', timerMessage)), timeoutMs)
    job.timer.unref?.()
    const frame = `event: command\ndata: ${JSON.stringify({ id, action, args })}\n\n`
    // Only the newest attachment executes: an older tab that still has the
    // panel open must stay idle instead of running the command a second time.
    const newest = [...connections].pop()
    if (!newest || !writeFrame(newest, frame)) job.finish(bridgeFailure('closed', PANEL_CLOSED_MESSAGE))
  })

  /** The model-supplied absolute path of a load/inspect call, or null. */
  const localPathRequest = (action, args) => {
    if (action !== 'load' && action !== 'inspect') return null
    return typeof args?.path === 'string' ? args.path : null
  }

  const authorizeArgs = (action, resolution) => ({
    request: action,
    path: resolution.requested,
    target: resolution.path,
    directory: resolution.directory,
    kind: resolution.kind,
    resolved: resolution.path !== resolution.requested,
  })

  /**
   * Ask the panel for one-time access to a resolved folder. Any denial becomes
   * `access_denied`; the independent dialog deadline becomes `access_timeout`.
   * Neither case retries: a retry needs a fresh tool call from the model.
   */
  const requestAuthorization = async (sessionId, action, resolution, signal) => {
    try {
      return await dispatch(sessionId, 'authorize', authorizeArgs(action, resolution), authorizeTimeoutMs, signal)
    } catch (error) {
      if (error?.bridgeKind === 'timeout') {
        throw localPathError(
          'access_timeout',
          `the user did not answer the access request for "${resolution.directory}" within ${Math.round(authorizeTimeoutMs / 1000)}s.`,
          'ask the user to allow the folder, then retry once when they are ready.',
        )
      }
      if (error?.bridgeKind === 'cancelled' || error?.bridgeKind === 'closed') throw error
      throw localPathError(
        'access_denied',
        `the user did not allow "${resolution.directory}".`,
        'stop and report this; do not retry.',
      )
    }
  }

  // Wait for the tab outside the queue and start the command deadline only once
  // it is attached: the panel's start-up time must not eat SCENE_TIMEOUT_MS.
  const run = async (sessionId, action, args, timeoutMs, signal) => {
    const requestedPath = localPathRequest(action, args)
    let resolution = null
    if (requestedPath !== null) {
      // Local paths are resolved from filesystem metadata before a tab is
      // needed; failures here carry their own [code] and never open a dialog.
      resolution = await resolveLocalTileset(requestedPath)
      // `inspect path` runs on the host, so an already allowed file keeps
      // working with the panel closed.
      if (action === 'inspect' && isLocalResolutionAllowed(resolution, allowedDirs)) return { ...resolution }
    }
    if (signal?.aborted) {
      throw bridgeFailure('cancelled', `The "${action}" command was cancelled before it reached the digital earth panel.`)
    }
    const attached = await waitForAttach(sessionId, attachGraceMs, signal)
    if (!attached) {
      // An abort is the caller's own cancellation, not a missing panel.
      if (signal?.aborted) {
        throw bridgeFailure('cancelled', `The "${action}" command was cancelled before it reached the digital earth panel.`)
      }
      throw bridgeFailure('closed', PANEL_CLOSED_MESSAGE)
    }
    return enqueue(sessionId, async () => {
      let current = resolution
      if (requestedPath !== null) {
        if (current === null) current = await resolveLocalTileset(requestedPath)
        if (!isLocalResolutionAllowed(current, allowedDirs)) {
          // Order matters: wait for the tab, ask for permission, re-check the
          // allowlist (and the path) from scratch, then continue the original
          // load/inspect. No retry on denial or timeout.
          await requestAuthorization(sessionId, action, current, signal)
          current = await resolveLocalTileset(requestedPath)
          if (!isLocalResolutionAllowed(current, allowedDirs)) {
            throw localPathError(
              'access_denied',
              `the folder for "${current.requested}" was not added to the panel allowlist.`,
              'stop and report this; do not retry.',
            )
          }
        }
        if (action === 'inspect') return { ...current }
      }
      const commandArgs = current === null ? args : { ...args, path: current.path }
      const result = await dispatch(sessionId, action, commandArgs, timeoutMs, signal)
      if (current !== null && action === 'load') {
        // The panel returns view/layers_count; a healed path adds the original
        // request so the model can report what it actually loaded.
        const value = asResultObject(result)
        if (current.resolvedFrom !== undefined && value.resolved_from === undefined) value.resolved_from = current.resolvedFrom
        if (typeof value.layers_count !== 'number' && Array.isArray(value.layers)) value.layers_count = value.layers.length
        return value
      }
      return result
    })
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
    // Pending attach waiters must not outlive the plugin and reject later.
    for (const waiters of [...attachWaiters.values()]) {
      for (const waiter of [...waiters]) waiter.finish(false)
    }
    attachWaiters.clear()
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

  return { attach, waitForAttach, run, settle, connectedSessions, dispose }
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

/**
 * POST: write a scene report (HTML or Markdown) built by the panel and answer
 * with its absolute path. Reports live under DSH_HOME/exports, so the page can
 * never choose an arbitrary destination, and the folder keeps the newest names.
 */
export async function reportHandler(req, res) {
  if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_REPORT_BODY) {
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
  const format = typeof payload?.format === 'string' ? payload.format : 'html'
  if (!REPORT_FORMATS.has(format)) return sendText(res, 400, 'invalid format')
  const content = typeof payload?.content === 'string' ? payload.content : ''
  if (content.trim() === '') return sendText(res, 400, 'empty report')
  const extension = format === 'markdown' ? 'md' : 'html'
  const label = sanitizeLabel(payload?.label)
  const name = `earth-report-${timeStamp()}-${randomBytes(4).toString('hex')}${label === '' ? '' : `-${label}`}.${extension}`
  const target = join(EXPORTS_DIR, name)
  try {
    await fs.mkdir(EXPORTS_DIR, { recursive: true })
    await fs.writeFile(target, content, 'utf8')
  } catch (error) {
    return sendText(res, 500, `report save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  void pruneExports(name).catch(() => {})
  sendJson(res, 200, { path: target, format, bytes: Buffer.byteLength(content, 'utf8') })
}

/** Keep the newest reports/exports so the folder cannot grow without bound. */
async function pruneExports(keepName) {
  const entries = await fs.readdir(EXPORTS_DIR, { withFileTypes: true })
  const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  if (names.length <= MAX_EXPORT_FILES) return
  const stats = []
  for (const name of names) {
    try {
      stats.push({ name, mtime: (await fs.stat(join(EXPORTS_DIR, name))).mtimeMs })
    } catch {
      stats.push({ name, mtime: 0 })
    }
  }
  stats.sort((left, right) => right.mtime - left.mtime || (left.name < right.name ? 1 : -1))
  let remaining = stats.length
  for (let index = stats.length - 1; index >= 0 && remaining > MAX_EXPORT_FILES; index -= 1) {
    if (stats[index].name === keepName) continue
    await fs.rm(join(EXPORTS_DIR, stats[index].name), { force: true })
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

/** Model-facing summary for `earth_scene action=report`. */
function renderReportResult(value) {
  const path = typeof value.path === 'string' ? value.path : ''
  const format = typeof value.format === 'string' ? value.format : 'html'
  const bytes = Number.isFinite(value.bytes) ? ` (${value.bytes} bytes)` : ''
  const lines = [`Scene report written: ${path}`, `Format: ${format}${bytes}.`]
  if (Array.isArray(value.sections) && value.sections.length > 0) lines.push(`Sections: ${value.sections.join(', ')}.`)
  if (Array.isArray(value.failed) && value.failed.length > 0) lines.push(`Skipped: ${value.failed.join('; ')}.`)
  lines.push('Call present with this path to show the report to the user.')
  return lines.join('\n')
}

function renderSceneResult(value) {  let text
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
  const hud = value.hud_hidden === true
    ? '; HUD and toolbars hidden'
    : value.hud_hidden === false
      ? '; HUD visible in the image'
      : ''
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

/** Model-facing error text for an inspection failure, always with a next step. */
function inspectToolError(error) {
  if (!(error instanceof InspectError)) return error instanceof Error ? error.message : String(error)
  switch (error.code) {
    case 'forbidden': return error.message
    case 'invalid_source': return `The inspect source is not valid: ${error.message}`
    case 'invalid_json': return 'The tileset JSON is malformed, so it cannot be analyzed. Fix or replace the file, then retry.'
    case 'too_large': return 'The tileset JSON is larger than the 8 MB inspection limit. Inspect a smaller or split tileset.'
    case 'unreachable': return `The tileset could not be fetched: ${error.message} Check the URL and network, then retry.`
    case 'timeout': return 'The data inspection timed out after 8 s. Retry, or inspect a local tileset instead.'
    default: return `The data inspection failed: ${error.message}`
  }
}

/** Compact tool value: the full report stays on the host and in the panel. */
function inspectToolValue(report, layer) {
  const value = {
    operation: 'inspect',
    ok: report.ok,
    source: report.source,
    asset: report.asset,
    root: report.root,
    counts: report.counts,
    kinds: report.kinds,
    scenes: report.scenes,
    issues: report.issues.slice(0, 10),
    issues_total: report.issues.length,
    report_path: report.reportPath,
  }
  if (Number.isInteger(report.issuesDropped) && report.issuesDropped > 0) value.issues_dropped = report.issuesDropped
  if (report.runtime !== undefined) value.runtime = report.runtime
  if (typeof layer === 'string' && layer !== '') value.layer = layer
  return scrubToken(value)
}

async function inspectSceneAction(bridge, allowedDirs, args, exec) {
  let source
  let runtime = null
  let layer = null
  let fallback = false
  if (typeof args.layer === 'string') {
    const target = resolveSessionTarget(bridge, exec)
    if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
    fallback = target.fallback === true
    const ack = asResultObject(await bridge.run(target.sessionId, 'inspect', { layer: args.layer, deep: args.deep === true }, INSPECT_BRIDGE_TIMEOUT_MS, exec.signal))
    layer = typeof ack.layer === 'string' && ack.layer.trim() !== '' ? ack.layer.trim() : args.layer
    try {
      source = normalizeInspectSource(ack.source)
    } catch {
      throw sceneError('the panel could not resolve this layer to a local path or an http(s) URL. Reload the layer in the panel, then retry.')
    }
    runtime = normalizeInspectRuntime(ack.runtime)
  } else if (typeof args.path === 'string') {
    // Reuse the bridge's local-path resolution and authorization. With no
    // connected panel, an already allowed file can still be inspected.
    const target = resolveSessionTarget(bridge, exec)
    let resolution
    if (target === null) {
      resolution = await resolveLocalTileset(args.path)
      if (!isLocalResolutionAllowed(resolution, allowedDirs)) throw new Error(PANEL_CLOSED_MESSAGE)
    } else {
      fallback = target.fallback === true
      resolution = await bridge.run(target.sessionId, 'inspect', { path: args.path }, INSPECT_BRIDGE_TIMEOUT_MS, exec.signal)
      if (typeof resolution?.path !== 'string' || resolution.path === '') {
        throw sceneError('the panel did not return a resolved local path for this inspection.')
      }
    }
    source = { kind: 'local', path: resolution.path }
  } else {
    source = { kind: 'remote', url: args.url }
  }
  let report
  try {
    report = await analyzeTileset(source, { deep: args.deep === true, runtime, allowedDirs })
    await writeInspectReport(report)
  } catch (error) {
    throw sceneError(inspectToolError(error))
  }
  const value = inspectToolValue(report, layer)
  if (fallback) value.session_fallback = SESSION_FALLBACK_NOTE
  return value
}

function renderInspectResult(value) {
  const source = isPlainObject(value.source) ? value.source : {}
  const kind = typeof source.kind === 'string' ? source.kind : 'unknown'
  const label = typeof source.label === 'string' ? source.label : ''
  const bytes = Number.isFinite(source.bytes) ? `, ${source.bytes} bytes` : ''
  const lines = [`Data health: ok=${value.ok === true ? 'true' : 'false'} (${kind}${label !== '' ? ` ${label}` : ''}${bytes}).`]
  const asset = isPlainObject(value.asset) ? value.asset : {}
  const assetParts = []
  if (typeof value.layer === 'string') assetParts.push(`layer=${value.layer}`)
  assetParts.push(`version=${asset.version ?? 'unknown'}`)
  if (typeof asset.minVersion === 'string') assetParts.push(`minVersion=${asset.minVersion}`)
  if (typeof asset.generator === 'string') assetParts.push(`generator=${asset.generator}`)
  lines.push(`Asset: ${assetParts.join(', ')}.`)
  const root = isPlainObject(value.root) ? value.root : {}
  const boundingType = isPlainObject(root.boundingVolume) && typeof root.boundingVolume.type === 'string' ? root.boundingVolume.type : 'none'
  lines.push(`Root: geometricError=${root.geometricError ?? 'null'}, boundingVolume=${boundingType}, children=${Number.isInteger(root.children) ? root.children : 0}, depth=${Number.isInteger(root.depth) ? root.depth : 0}.`)
  const counts = isPlainObject(value.counts) ? value.counts : {}
  const extensions = Array.isArray(counts.extensionsUsed) && counts.extensionsUsed.length > 0 ? `, extensions=[${counts.extensionsUsed.join(', ')}]` : ''
  lines.push(`Counts: tiles=${counts.tiles ?? 0}, contents=${counts.contents ?? 0}, externalFiles=${counts.externalFiles ?? 0}${extensions}.`)
  const kinds = isPlainObject(value.kinds) ? value.kinds : {}
  lines.push(`Kinds: b3dm=${kinds.b3dm ?? 0}, glb=${kinds.glb ?? 0}, pnts=${kinds.pnts ?? 0}, gaussianSplatting=${kinds.gaussianSplatting === true ? 'true' : 'false'}, spz=${kinds.spz === true ? 'true' : 'false'}.`)
  const runtime = isPlainObject(value.runtime) ? value.runtime : null
  if (runtime !== null) {
    const parts = ['tiles', 'pending', 'triangles', 'memory'].filter((key) => Number.isFinite(runtime[key])).map((key) => `${key}=${runtime[key]}`)
    if (parts.length > 0) lines.push(`Panel runtime: ${parts.join(', ')}.`)
  }
  const issues = Array.isArray(value.issues) ? value.issues : []
  const total = Number.isInteger(value.issues_total) ? value.issues_total : issues.length
  if (issues.length === 0) {
    lines.push('Issues: none.')
  } else {
    lines.push(`Issues (${issues.length} of ${total}):`)
    for (const issue of issues) {
      if (!isPlainObject(issue)) continue
      const level = typeof issue.level === 'string' ? issue.level : 'info'
      const code = typeof issue.code === 'string' ? issue.code : 'unknown'
      const message = typeof issue.message === 'string' ? issue.message : ''
      const path = typeof issue.path === 'string' && issue.path !== '' ? ` (${issue.path})` : ''
      lines.push(`- [${level}] ${code}: ${message}${path}`)
    }
  }
  if (total > issues.length) lines.push(`... ${total - issues.length} more issues are in the report file.`)
  const dropped = Number.isInteger(value.issues_dropped) ? value.issues_dropped : 0
  if (dropped > 0) lines.push(`... ${dropped} further issues were omitted at the ${MAX_INSPECT_ISSUES}-issue limit.`)
  if (typeof value.report_path === 'string') lines.push(`Report: ${value.report_path}`)
  return lines.join('\n')
}

function createSceneTool(bridge, allowedDirs) {
  return {
    name: SCENE_TOOL_NAME,
    description: SCENE_DESCRIPTION,
    parameters: SCENE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{
        type: 'text',
        text: isPlainObject(value) && value.operation === 'inspect'
          ? renderInspectResult(value)
          : isPlainObject(value) && value.operation === 'report'
            ? renderReportResult(value)
            : renderSceneResult(value),
      }],
    },
    async execute(args, exec = {}) {
      const request = normalizeSceneRequest(args)
      if (request.action === 'inspect') return inspectSceneAction(bridge, allowedDirs, request.args, exec)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const timeout = request.action === 'report' ? REPORT_TIMEOUT_MS : SCENE_TIMEOUT_MS
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, request.action, request.args, timeout, exec.signal)))
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

function createDrawTool(bridge) {
  return {
    name: DRAW_TOOL_NAME,
    description: DRAW_DESCRIPTION,
    parameters: DRAW_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderDrawResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeDrawRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'draw', request.args, DRAW_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}

function createMeasureTool(bridge) {
  return {
    name: MEASURE_TOOL_NAME,
    description: MEASURE_DESCRIPTION,
    parameters: MEASURE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderMeasureResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeMeasureRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'measure', request.args, MEASURE_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}

function createAnalyzeTool(bridge) {
  return {
    name: ANALYZE_TOOL_NAME,
    description: ANALYZE_DESCRIPTION,
    parameters: ANALYZE_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderAnalyzeResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeAnalyzeRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'analyze', request.args, ANALYZE_TIMEOUT_MS, exec.signal)))
      if (target.fallback) value.session_fallback = SESSION_FALLBACK_NOTE
      return value
    },
  }
}

function createShaderTool(bridge) {
  return {
    name: SHADER_TOOL_NAME,
    description: SHADER_DESCRIPTION,
    parameters: SHADER_PARAMETERS,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: renderShaderResult(value) }],
    },
    async execute(args, exec = {}) {
      const request = normalizeShaderRequest(args)
      const target = resolveSessionTarget(bridge, exec)
      if (target === null) throw new Error(PANEL_CLOSED_MESSAGE)
      const value = scrubToken(asResultObject(await bridge.run(target.sessionId, 'shader', request.args, SHADER_TIMEOUT_MS, exec.signal)))
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
function mountAgentTools(ctx, bridge, allowedDirs) {
  ctx.inject(['tools', 'systemPrompt'], (scope) => {
    scope.effect(() => {
      const disposers = [
        scope.tools.register(createSceneTool(bridge, allowedDirs)),
        scope.tools.register(createCaptureTool(bridge)),
        scope.tools.register(createDrawTool(bridge)),
        scope.tools.register(createMeasureTool(bridge)),
        scope.tools.register(createAnalyzeTool(bridge)),
        scope.tools.register(createShaderTool(bridge)),
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

/** One-screen summary for the `/earth status` command result. */
export function renderEarthCommandStatus(value) {
  const view = isPlainObject(value.view) ? value.view : {}
  const camera = []
  if (Number.isFinite(view.lon) && Number.isFinite(view.lat)) camera.push(`${view.lon}, ${view.lat}`)
  if (Number.isFinite(view.height)) camera.push(`${view.height} m`)
  if (Number.isFinite(view.heading)) camera.push(`heading ${view.heading}°, pitch ${view.pitch}°`)
  const layers = Array.isArray(value.layers) ? value.layers : []
  const layerText =
    layers.length === 0
      ? 'none'
      : layers.map((layer) => `${layer.name}${layer.visible === false ? ' (hidden)' : ''}`).join(', ')
  const imagery = isPlainObject(value.imagery) ? value.imagery.name : 'none'
  const terrain = isPlainObject(value.terrain) ? value.terrain.name : 'none'
  const annotations = isPlainObject(value.annotations) ? value.annotations : {}
  return [
    'Digital earth status',
    `Camera: ${camera.join(' · ') || 'unknown'}`,
    `Layers: ${layerText}`,
    `Imagery: ${imagery}; terrain: ${terrain}`,
    `Agent overlays: ${annotations.drawn_features ?? 0} annotated features, ${annotations.measured_points ?? 0} measured points`,
  ].join('\n')
}

/**
 * `/earth` slash command: direct user control of the panel without a model turn.
 * The command result stays in the command UI; nothing here enters the model
 * context, matching the DSH command contract.
 */
function mountEarthCommand(ctx, bridge) {
  ctx.inject(['commands'], (scope) => {
    scope.effect(
      () =>
        scope.commands.register({
          name: 'earth',
          description: 'Digital earth panel: status, capture, clear annotations, or open it from the globe button.',
          input: { hint: 'status | capture [label] | report [html|markdown] | clear | open' },
          handler: async ({ agent, rawInput }) => {
            const target = resolveSessionTarget(bridge, { agent })
            if (target === null) {
              return {
                kind: 'error',
                text: 'The digital earth panel is not connected for this conversation. Open it with the globe button in the chat header, then retry.',
              }
            }
            const words = String(rawInput ?? '')
              .trim()
              .split(/\s+/)
              .filter(Boolean)
            const sub = (words.shift() ?? 'help').toLowerCase()
            try {
              if (sub === 'status') {
                const value = asResultObject(await bridge.run(target.sessionId, 'status', {}, SCENE_TIMEOUT_MS))
                return { kind: 'success', text: renderEarthCommandStatus(value) }
              }
              if (sub === 'capture') {
                const label = words.join(' ').trim().slice(0, 80)
                const ack = asResultObject(
                  await bridge.run(target.sessionId, 'capture', label === '' ? {} : { label }, CAPTURE_TIMEOUT_MS),
                )
                const path = typeof ack.path === 'string' ? ack.path : ''
                return { kind: 'success', text: path === '' ? 'Snapshot saved.' : `Snapshot saved: ${path}` }
              }
              if (sub === 'clear') {
                await bridge.run(target.sessionId, 'draw', { clear: true }, DRAW_TIMEOUT_MS)
                return { kind: 'success', text: 'Cleared the Agent annotations and measurements from the panel.' }
              }
              if (sub === 'report') {
                const requested = (words[0] ?? 'html').toLowerCase()
                const format = requested === 'markdown' || requested === 'md' ? 'markdown' : 'html'
                const value = asResultObject(
                  await bridge.run(target.sessionId, 'report', { format, include_capture: true }, REPORT_TIMEOUT_MS),
                )
                const path = typeof value.path === 'string' ? value.path : ''
                return {
                  kind: 'success',
                  text: path === '' ? 'Scene report written.' : `Scene report written: ${path}`,
                }
              }
              if (sub === 'open') {
                return {
                  kind: 'success',
                  text: 'The digital earth tab opens by itself on the next earth tool call, or click the globe button in the chat header.',
                }
              }
              return {
                kind: 'success',
                text: 'Usage: /earth status | /earth capture [label] | /earth report [html|markdown] | /earth clear | /earth open',
              }
            } catch (error) {
              return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
            }
          },
        }),
      'digital-earth /earth command',
    )
  })
}

export const inject = ['webServer', 'connection']

export function apply(ctx) {
  // Directories this page opened through `/scan`; tile files are served only from
  // them, so a token holder cannot read arbitrary paths on the machine.
  const allowedDirs = new Set()

  // Folders remembered from earlier sessions. They are re-allowed below and
  // listed for the panel's data menu; `/scan` stays the only way to add one.
  let recentDirectories = []

  /** Record one folder the user opened; persisting is best effort and silent. */
  // Writes are serialised like the source catalog: two quick scans must never
  // let an older snapshot land after a newer one. The snapshot is captured at
  // call time so the queued write persists exactly the list that gesture saw.
  let persistChain = Promise.resolve()
  const rememberDirectory = (directory) => {
    recentDirectories = mergeRecentDirectories(recentDirectories, { path: directory, at: new Date().toISOString() })
    const snapshot = recentDirectories
    persistChain = persistChain.then(() => persistRecentDirectories(snapshot)).catch(() => {})
  }

  const rememberScannedDirectory = (resolvedDir, realDir) => {
    // Record the resolved spelling last, so the page lists the path the user
    // actually picked first; a junctioned folder contributes both spellings.
    if (realDir !== resolvedDir) rememberDirectory(realDir)
    rememberDirectory(resolvedDir)
  }

  /**
   * Restore remembered folders into the allowlist. A missing or unreadable
   * folder (unmounted drive, deleted directory) is skipped, and one bad entry
   * must never fail plugin startup; everything here swallows its errors.
   */
  const restoreRememberedDirectories = async () => {
    const entries = await readRecentDirectories()
    const restored = []
    for (const entry of entries) {
      try {
        const directory = resolve(entry.path)
        // A drive/share root would hand the agent every file on it.
        if (isFilesystemRoot(directory)) continue
        restored.push(entry)
        try {
          await fs.access(directory)
        } catch {
          continue
        }
        allowedDirs.add(directory)
        // Restore has no user gesture behind it, so it must not follow a folder
        // that was since replaced by a junction to a drive root: that would hand
        // the agent a whole drive. `/scan` keeps its own realpath check.
        const realDirectory = await realPathOr(directory)
        if (!isFilesystemRoot(realDirectory)) allowedDirs.add(realDirectory)
      } catch {
        // Best effort: keep loading the remaining entries.
      }
    }
    recentDirectories = sanitizeRecentDirectories([...recentDirectories, ...restored])
  }

  // Commands from Host tools to the open panel live for the plugin lifetime.
  const bridge = createBridge(allowedDirs)

  // Never block apply() on disk: the panel routes exist immediately and the
  // remembered folders join the allowlist as soon as the file is read.
  void restoreRememberedDirectories().catch(() => {})

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
      register('exact', `${API}/scan`, (req, res) => scanHandler(req, res, allowedDirs, rememberScannedDirectory)),
      register('exact', `${SOURCES_ROUTE}/${TOKEN}`, (req, res) =>
        req.method === 'GET' ? sourcesHandler(req, res) : req.method === 'PUT' ? saveSourcesHandler(req, res) : sendText(res, 405, 'method not allowed'),
      ),
      register('exact', `${DIRECTORIES_ROUTE}/${TOKEN}`, (req, res) =>
        req.method === 'GET' ? directoriesHandler(() => recentDirectories, req, res) : sendText(res, 405, 'method not allowed'),
      ),
      register('exact', `${SCENE_ROUTE}/${TOKEN}`, sceneSnapshotHandler),
      register('exact', `${INJECT_ROUTE}/${TOKEN}`, (req, res) => injectHandler(ctx, req, res)),
      register('exact', `${REPORT_ROUTE}/${TOKEN}`, reportHandler),
      register('exact', BRIDGE_ROUTE, bridgeHandler(bridge)),
      register('exact', CAPTURE_ROUTE, captureHandler),
      register('exact', INSPECT_ROUTE, (req, res) => inspectHandler(req, res, allowedDirs)),
      register('prefix', FILES_ROUTE, capturesHandler),
    ]
    return () => {
      for (const dispose of disposers) {
        if (typeof dispose === 'function') dispose()
      }
      bridge.dispose()
    }
  }, 'digital-earth api routes')

  mountAgentTools(ctx, bridge, allowedDirs)
  mountEarthCommand(ctx, bridge)
}

