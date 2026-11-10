/**
 * Every HTTP route plus the DSH-connection rejection fence.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { resolve, sep } from 'node:path'
import { promises as fs } from 'node:fs'
import { Readable, pipeline } from 'node:stream'
import { ABOUT } from './about.js'
import { API, BRIDGE_ROUTE, CAPTURE_ROUTE, CESIUM_DIR, CESIUM_ROUTE, DIRECTORIES_ROUTE, EXPORT_ROUTE, FILES_ROUTE, INJECT_ROUTE, INSPECT_ROUTE, MAX_REMOTE_QUERY, PANEL_HEADER, REMOTE_PROXY_MAX_BYTES, REMOTE_PROXY_TIMEOUT_MS, REMOTE_ROUTE, REPORT_ROUTE, SCENE_ROUTE, SOURCES_ROUTE, TILES_ROUTE, TOKEN } from './constants.js'
import { blockedHost, decodeSegment, fromB64, isFilesystemRoot, isSafeOpenedDirectory, isUncPath, realPathOr, segments, toB64 } from './paths.js'
import { bridgeHandler } from './bridge.js'
import { captureHandler, capturesHandler, reportHandler } from './storage.js'
import { evidenceExportHandler } from './export.js'
import { directoriesHandler } from './directories.js'
import { injectHandler } from './inject.js'
import { inspectHandler } from './inspect/handler.js'
import { requestPath, requestQuery, sendJson, sendText, serveFile, subPath } from './http.js'
import { saveSourcesHandler, sourcesHandler } from './sources.js'
import { sceneSnapshotHandler } from './snapshots.js'
import { MAX_SCAN_DEPTH, MAX_SCAN_ITEMS } from './constants.js'
import { scanTilesets } from './fs-util.js'

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
    // Page-only "take away" evidence-pack destination (never a model-facing URL).
    exportUrl: `${EXPORT_ROUTE}/${TOKEN}`,
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

function cesiumHandler(req, res) {
  const raw = subPath(requestPath(req), CESIUM_ROUTE)
  if (raw === null || raw === '') return sendText(res, 404, 'not found')
  const relPath = decodeSegment(raw)
  if (relPath === null) return sendText(res, 400, 'bad path')
  serveFile(req, res, resolve(CESIUM_DIR), relPath, 'public, max-age=86400')
}

export async function tilesHandler(req, res, allowedDirs) {
  const raw = subPath(requestPath(req), TILES_ROUTE)
  if (raw === null) return sendText(res, 403, 'forbidden')
  const parts = segments(raw)
  if (parts[0] !== TOKEN || parts.length < 2) return sendText(res, 403, 'forbidden')
  const dir = fromB64(parts[1])
  // Only absolute Windows or POSIX directories, and only ones the user opened.
  if (!/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(dir)) return sendText(res, 403, 'forbidden')
  const resolvedDir = resolve(dir)
  const realDir = await realPathOr(resolvedDir)
  // Defend against a remembered entry from an older build whose allowlist may
  // have been widened by a junction: the served root itself must never be a
  // drive/share root.
  if (!isSafeOpenedDirectory(resolvedDir) || !isSafeOpenedDirectory(realDir)) return sendText(res, 403, 'forbidden')
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
  // Serve from the real path: a junction's lexical root is not its real root,
  // and serveFile repeats the containment check on the target file.
  await serveFile(req, res, realDir, relPath, 'public, max-age=60')
}

export async function scanHandler(req, res, allowedDirs, onOpened) {
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
  // Check the raw spelling too: `\\?\C:\` and junctions only reveal their real
  // target after realpath, which is checked below before anything is added.
  if (!isSafeOpenedDirectory(dir) || !isSafeOpenedDirectory(resolvedDir)) {
    return sendText(res, 400, 'scanning a filesystem root, UNC path or non-absolute path is not allowed')
  }
  const realDir = await realPathOr(resolvedDir)
  if (!isSafeOpenedDirectory(realDir)) {
    return sendText(res, 400, 'the folder resolves to a filesystem root or network share; open a subfolder instead')
  }
  let stat
  try {
    stat = await fs.stat(realDir)
  } catch {
    return sendText(res, 404, 'folder not found')
  }
  if (!stat.isDirectory()) return sendText(res, 400, 'the scanned path is not a folder')
  // Record both spellings so a path remembered by the page still matches after
  // a symlinked or junctioned folder is resolved by the filesystem. Both have
  // already passed the root/UNC check, and tilesHandler re-checks the real path.
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
  const { found: files } = await scanTilesets(resolvedDir, { depth: MAX_SCAN_DEPTH, limit: MAX_SCAN_ITEMS })
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
  let upstream
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, REMOTE_PROXY_TIMEOUT_MS)
  timer.unref?.()
  try {
    // Redirects are refused: a harmless host could otherwise bounce the proxy
    // to a loopback/private address that `blockedHost` already rejected.
    upstream = await fetch(target, { redirect: 'manual', signal: controller.signal })
  } catch (error) {
    clearTimeout(timer)
    return sendText(res, 502, `proxy failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    clearTimeout(timer)
    return sendText(res, 403, 'forbidden')
  }
  if (!upstream.ok || upstream.body === null) {
    clearTimeout(timer)
    return sendText(res, upstream.status === 200 ? 502 : upstream.status, `upstream ${upstream.status}`)
  }
  res.writeHead(200, {
    'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  streamRemoteBody(Readable.fromWeb(upstream.body), req, res, { controller, timer })
}

/**
 * Pipe one proxied upstream body to the page without ever leaving an unhandled
 * stream error behind. Upstream servers can abort mid-body (CDN hiccups, a
 * hostile tileset host); before this helper existed the raw `.pipe()` let that
 * error escape as an uncaught exception and could take the Host process down.
 *
 * Exported as a test seam: `streamRemoteBody` is exercised with a Readable that
 * errors after the first chunk and a fake response, and must neither throw nor
 * leave the response open.
 */
export function streamRemoteBody(source, req, res, options = {}) {
  const controller = options.controller ?? new AbortController()
  const timer = options.timer ?? null
  const maxBytes =
    Number.isFinite(options.maxBytes) && options.maxBytes > 0 ? Math.floor(options.maxBytes) : REMOTE_PROXY_MAX_BYTES
  let finished = false
  let bytes = 0
  const finish = () => {
    if (finished) return
    finished = true
    if (timer !== null) clearTimeout(timer)
    try {
      controller.abort()
    } catch {
      /* aborting an already settled fetch is a no-op */
    }
  }
  // A page that navigates away or a browser that retries must cancel upstream:
  // otherwise the host keeps streaming a response nobody will read.
  req?.on?.('close', () => {
    finish()
    if (typeof source.destroy === 'function') source.destroy()
  })
  res?.on?.('close', finish)
  source.on?.('data', (chunk) => {
    if (finished) return
    bytes += chunk?.length ?? 0
    if (bytes > maxBytes) {
      finish()
      try {
        source.destroy(new Error('upstream body exceeds the proxy size limit'))
      } catch {
        /* already destroyed */
      }
      if (typeof res.destroy === 'function') res.destroy()
    }
  })
  pipeline(source, res, (error) => {
    finish()
    if (error && typeof res.destroy === 'function') res.destroy()
  })
}

/**
 * Install every HTTP route. The host web server has no auth or origin policy of
 * its own, so each route asks the DSH Connection service to reject foreign or
 * unauthenticated requests, and fails closed whenever that answer is doubtful.
 */
export function registerRoutes(ctx, { allowedDirs, bridge, directories }) {
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
      register('exact', `${API}/scan`, (req, res) => scanHandler(req, res, allowedDirs, directories.rememberScannedDirectory)),
      register('exact', `${SOURCES_ROUTE}/${TOKEN}`, (req, res) =>
        req.method === 'GET' ? sourcesHandler(req, res) : req.method === 'PUT' ? saveSourcesHandler(req, res) : sendText(res, 405, 'method not allowed'),
      ),
      register('exact', `${DIRECTORIES_ROUTE}/${TOKEN}`, (req, res) =>
        req.method === 'GET' ? directoriesHandler(() => directories.list(), req, res) : sendText(res, 405, 'method not allowed'),
      ),
      register('exact', `${SCENE_ROUTE}/${TOKEN}`, sceneSnapshotHandler),
      register('exact', `${INJECT_ROUTE}/${TOKEN}`, (req, res) => injectHandler(ctx, req, res)),
      register('exact', `${REPORT_ROUTE}/${TOKEN}`, reportHandler),
      register('exact', `${EXPORT_ROUTE}/${TOKEN}`, evidenceExportHandler),
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
}
