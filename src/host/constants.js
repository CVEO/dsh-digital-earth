/**
 * Process token, route prefixes, limits, state paths and static MIME/catalog constants.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url))
export const CESIUM_DIR = join(ROOT_DIR, 'vendor', 'cesium')
export const TOKEN = randomBytes(12).toString('base64url')
export const API = '/api/3dviewer'
// Prefix routes are registered without the trailing slash: the router matches
// `pathname === prefix || pathname.startsWith(prefix + '/')`.
export const CESIUM_ROUTE = `${API}/cesium`
export const TILES_ROUTE = `${API}/tiles`
export const REMOTE_ROUTE = `${API}/remote`
export const SOURCES_ROUTE = `${API}/sources`
export const BRIDGE_ROUTE = `${API}/bridge`
export const CAPTURE_ROUTE = `${API}/capture`
export const FILES_ROUTE = `${API}/files`
// Remembered-folder list for the panel's data menu. This is page-only data: the
// page opened those folders itself, and no tool result ever exposes them.
export const DIRECTORIES_ROUTE = `${API}/directories`
// Per-session scene snapshots. The panel writes them to the host so a remounted
// tab (or a DSH restart that changes the page origin) can restore camera, layers
// and overlays; the response is page-only data and never reaches a tool result.
export const SCENE_ROUTE = `${API}/scene`
// The panel's "ask Agent" button injects a scene summary into the running
// conversation agent. Bound both directions: the page can only push text, and
// the host caps how much of it can ever enter the model context.
export const INJECT_ROUTE = `${API}/inject`
export const MAX_INJECT_BODY = 16 * 1024
export const MAX_INJECT_TEXT = 4000
// Scene reports are whole documents (optionally with an embedded screenshot).
export const REPORT_ROUTE = `${API}/report`
export const REPORT_FORMATS = new Set(['html', 'markdown'])
export const MAX_REPORT_BODY = 16 * 1024 * 1024
// "Take away" evidence pack: the panel posts a card plus an optional screenshot
// and the user saves the written files. Page-only: no tool ever mentions it.
export const EXPORT_ROUTE = `${API}/export`
export const MAX_EXPORT_BODY = 16 * 1024 * 1024
export const MAX_EVIDENCE_JSON = 256 * 1024
export const MAX_EXPORT_FILES = 200
export const MAX_SCENE_BODY = 512 * 1024
export const MAX_SCENE_FILES = 50
// Opening a local folder registers it in the agent allowlist. Only the panel's
// own fetch can send a custom header, so /scan requires this header: a model
// that makes Cesium request a same-origin GET (for example load url=...) cannot
// forge it and therefore cannot widen the allowlist.
export const PANEL_HEADER = 'x-dsh-panel'
export const MAX_SCAN_ITEMS = 200
export const MAX_SCAN_DEPTH = 4
// The source catalog is small JSON owned by this plugin; keep it outside the
// browser so it survives port changes (localStorage is per-origin) and restarts.
const STATE_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'digital-earth')
export const SOURCES_FILE = join(STATE_DIR, 'sources.json')
// Folders the user opened in the panel, remembered across DSH restarts so the
// agent may load the same data again without another panel gesture.
export const DIRECTORIES_FILE = join(STATE_DIR, 'directories.json')
export const MAX_RECENT_DIRECTORIES = 20
export const CAPTURES_DIR = resolve(STATE_DIR, 'captures')
export const EXPORTS_DIR = resolve(STATE_DIR, 'exports')
export const SCENES_DIR = resolve(STATE_DIR, 'scenes')
export const PACKAGE_FILE = join(ROOT_DIR, 'package.json')
export const MAX_SOURCES_BODY = 128 * 1024
export const MAX_BRIDGE_BODY = 256 * 1024
export const MAX_CAPTURE_BODY = 16 * 1024 * 1024
export const MAX_CAPTURE_FILES = 50
// Signed tile and WMS URLs carry their credentials in the query string, which
// the panel appends verbatim to the proxy path. Keep it bounded: the proxy must
// never turn into a way to make the host issue very long upstream URLs.
export const MAX_REMOTE_QUERY = 2048
// Remote tileset proxy: a browser whose direct request is blocked (CORS, mixed
// content) falls back to this proxy. Bound the upstream exchange so a stalled or
// hostile server cannot hold a response forever or stream unbounded data.
export const REMOTE_PROXY_TIMEOUT_MS = 30000
export const REMOTE_PROXY_MAX_BYTES = 512 * 1024 * 1024
// Static tileset health check: bounded request/response sizes, bounded BFS and
// one shared 8 s budget for every remote read of a single inspection.
export const INSPECT_ROUTE = `${API}/inspect`
export const MAX_INSPECT_BODY = 64 * 1024
export const MAX_INSPECT_JSON = 8 * 1024 * 1024
export const MAX_INSPECT_CONTENT_BYTES = 256 * 1024 * 1024
export const MAX_INSPECT_CONTENT_CHECKS = 200
export const MAX_INSPECT_TILESETS = 50
export const MAX_INSPECT_ISSUES = 200
export const MAX_INSPECT_REPORTS = 100
export const INSPECT_FETCH_TIMEOUT_MS = 8000
// The bridge command lets the panel resolve a layer source first; the contract
// keeps that budget at 20 s or more, independent of the normal scene budget.
export const INSPECT_BRIDGE_TIMEOUT_MS = 30000
export const REPORT_DIR = resolve(STATE_DIR, 'reports')
// SPZ (Niantic Gaussian splat) header: magic, version, numPoints as little-endian
// uint32 values. Only used for a best-effort local check; a parse failure is a
// warning and never fails the inspection.
export const SPZ_MAGIC = 0x5053474e
export const BRIDGE_HEARTBEAT_MS = 15000
export const SCENE_TIMEOUT_MS = 20000
// Loading a remote/local tileset can legitimately take longer than a scene read:
// a direct fetch plus the CORS proxy fallback each get a 15 s client budget, so
// the Host must allow the whole load rather than time out between the two.
export const LOAD_TIMEOUT_MS = 40000
export const CAPTURE_TIMEOUT_MS = 40000
// Drawing and measurement are browser-side and synchronous, so a stuck tab is
// the only slow case; 15 s leaves room for a first frame without holding a turn.
export const DRAW_TIMEOUT_MS = 15000
export const MEASURE_TIMEOUT_MS = 15000
// A report may capture a screenshot and build a document before the host writes
// it, so it gets a longer budget than a plain scene action.
export const REPORT_TIMEOUT_MS = 45000
// Bounded model input: one call may add at most this many annotations and
// coordinates, so a runaway GeoJSON cannot freeze the panel.
export const MAX_DRAW_FEATURES = 500
export const MAX_DRAW_COORDINATES = 20000
export const MAX_MEASURE_POINTS = 200
export const MIN_MEASURE_POINTS = 2
// A tool call can arrive before the panel tab exists: the client half opens the
// docked panel on demand and then connects its SSE stream. The bridge waits this
// long for that connection so the first call in a closed conversation works.
export const PANEL_ATTACH_GRACE_MS = 8000
export const MAX_IMAGERY_SOURCES = 20
export const MAX_TERRAIN_SOURCES = 10
export const IMAGERY_TYPES = new Set(['xyz', 'arcgis', 'wms'])
export const TERRAIN_TYPES = new Set(['arcgis', 'cesium'])
export const THEME_MODES = new Set(['auto', 'light', 'dark'])

export const MIME = {
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

// Browser-side height sampling and shadow setup can be slow; the frozen B2
// contract fixes this command timeout at 30 s.
export const ANALYZE_TIMEOUT_MS = 30000

// Shader commands only touch existing Cesium materials, but compiling a
// CustomShader can still take a moment on a large tileset.
export const SHADER_TIMEOUT_MS = 30000
