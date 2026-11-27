/**
 * host/geotiff/http.js — the `/api/3dviewer/geotiff/<token>/…` endpoints.
 *
 *   GET  scan?dir=…                     list .tif/.tiff in a folder the user picked
 *   POST upload (raw body)              copy a picked file into the cache and return its path
 *   POST probe {path}                   identity + CRS + stats + refused formats
 *   POST publish {path, render}         → 202 {jobId}
 *   GET  job/<id>, DELETE job/<id>      progress / cancel
 *   GET  preview/<fileKey>/<renderKey>.png
 *   GET  tiles/<fileKey>/<renderKey>/<z>/<x>/<y>.png
 *   GET  cache                          disk usage of the publish cache
 *
 * The scan/probe/publish routes require the panel header: they act on host paths
 * and must only run for a gesture the user made in this page. Tile and preview
 * reads are token-scoped and never touch a user folder outside the cache.
 */
import { createWriteStream, promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { sendJson, sendText } from '../http.js'
import { GEOTIFF_CACHE_DIR, PANEL_HEADER } from '../constants.js'
import { isSafeOpenedDirectory, isWithinDirectory, realPathOr } from '../paths.js'
import { probeGeotiff, statGeotiff } from './probe.js'
import { createGeotiffJobs } from './jobs.js'
import { cachePaths, cacheUsage, fileKeyFor, readMeta, writeMeta } from './cache.js'
import { validPngBytes } from './publish.js'
import { openTiffFile } from './tiff.js'
import { describeGeo } from './crs.js'
import { normalizeRender, renderPreview } from './render.js'
import { encodePng } from './png.js'

const MAX_LIST = 50
// A single GeoTIFF can be several gigabytes; the upload is a local stream, not
// a JSON body, so it gets its own limit and directory.
const MAX_UPLOAD = 8 * 1024 * 1024 * 1024
const MAX_UPLOADS_KEPT = 12
const KEY_RE = /^[0-9a-f]{8,64}$/
const RENDER_RE = /^[0-9a-f]{6,16}$/
const TILE_RE = /^(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/

function panelRequest(req) {
  return req.headers?.[PANEL_HEADER] === '1'
}

async function readJsonBody(req, limit = 8 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) return null
    chunks.push(chunk)
  }
  if (size === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

// Keep the actionable tail of a host message; only drop stack traces.
const short = (message) => String(message).split('\n')[0].trim()

/**
 * @param {object} options
 * @param {Set<string>} [options.allowedDirs] folders opened from the panel; when
 *   present, probe/publish refuse paths outside them. Tiles/previews never use it.
 */
export function createGeotiffRoutes({ cacheDir = GEOTIFF_CACHE_DIR, jobs, allowedDirs = null, onFolderOpened = null } = {}) {
  const queue = jobs ?? createGeotiffJobs({ cacheDir })
  const previews = new Map()

  const pruneUploads = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.incoming-')) continue
      const full = join(dir, entry.name)
      const stat = await fs.stat(full).catch(() => null)
      if (stat) files.push({ full, mtime: stat.mtimeMs })
    }
    files.sort((a, b) => b.mtime - a.mtime)
    for (const stale of files.slice(MAX_UPLOADS_KEPT)) await fs.rm(stale.full, { force: true }).catch(() => {})
  }

  const outsideAllowed = async (candidate) => {
    if (!(allowedDirs instanceof Set)) return false
    const realFile = await realPathOr(resolve(candidate))
    const real = dirname(realFile)
    // Compare the resolved directory only: a junction/symlink placed inside an
    // allowed folder points outside it and must not inherit that trust.
    for (const root of allowedDirs) {
      if (isWithinDirectory(real, root)) return false
    }
    return true
  }

  const previewFor = async (fileKey, renderKey) => {
    const paths = cachePaths({ cacheDir, fileKey, renderKey })
    try {
      const bytes = await fs.readFile(paths.previewFile)
      // A preview written by an older/crashed build may be half a PNG; treat it
      // like a cache miss and render a fresh one.
      if (validPngBytes(bytes)) return bytes
    } catch {
      // Fall through: the preview is generated from meta.json on first request.
    }
    const key = `${fileKey}:${renderKey}`
    if (!previews.has(key)) {
      previews.set(
        key,
        (async () => {
          const meta = await readMeta(paths)
          if (!meta?.path) return null
          const reader = await openTiffFile(meta.path)
          try {
            const geo = describeGeo(reader)
            const render = normalizeRender(reader, meta.render ?? {})
            render.stats = meta.stats ?? render.stats
            const preview = await renderPreview(reader, geo, render, { maxSize: 2048 })
            const bytes = encodePng(preview.width, preview.height, preview.rgba)
            await fs.mkdir(paths.renderDir, { recursive: true })
            const temp = `${paths.previewFile}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`
            try {
              await fs.writeFile(temp, bytes)
              await fs.rename(temp, paths.previewFile)
            } catch (error) {
              await fs.rm(temp, { force: true }).catch(() => {})
              throw error
            }
            return bytes
          } finally {
            reader.close()
          }
        })().finally(() => previews.delete(key)),
      )
    }
    return previews.get(key)
  }

  const sendPng = async (res, bytes) => {
    res.writeHead(200, {
      'content-type': 'image/png',
      'content-length': String(bytes.length),
      'cache-control': 'public, max-age=3600',
    })
    res.end(bytes)
  }

  /**
   * Route one request below `${GEO_ROUTE}/${TOKEN}/`.
   * @returns {Promise<boolean>} whether the path matched a geotiff route
   */
  const handler = async (req, res, rest) => {
    const [head, ...tail] = rest.split('/').filter((part) => part !== '')
    if (head === 'scan' && req.method === 'GET') {
      if (!panelRequest(req)) return sendText(res, 403, 'scan requests must come from the panel'), true
      let parsed
      try {
        parsed = new URL(req.url, 'http://localhost')
      } catch {
        return sendText(res, 400, 'bad request'), true
      }
      const dir = parsed.searchParams.get('dir')
      if (!dir) return sendText(res, 400, 'missing dir'), true
      const resolvedDir = resolve(dir)
      if (!isSafeOpenedDirectory(dir) || !isSafeOpenedDirectory(resolvedDir)) {
        return sendJson(res, 400, { code: 'unsafe_dir', message: 'cannot scan a filesystem root, UNC path or relative folder' }), true
      }
      const realDir = await realPathOr(resolvedDir)
      if (!isSafeOpenedDirectory(realDir)) {
        return sendJson(res, 400, { code: 'unsafe_dir', message: 'the folder resolves to a filesystem root or network share' }), true
      }
      let stat
      try {
        stat = await fs.stat(realDir)
      } catch {
        return sendText(res, 404, 'folder not found'), true
      }
      if (!stat.isDirectory()) return sendText(res, 400, 'not a folder'), true
      if (allowedDirs instanceof Set) {
        allowedDirs.add(resolvedDir)
        allowedDirs.add(realDir)
      }
      try {
        onFolderOpened?.(resolvedDir, realDir)
      } catch {
        // Remembering the folder is a convenience, not a precondition.
      }
      let entries
      try {
        entries = await fs.readdir(realDir, { withFileTypes: true })
      } catch {
        return sendText(res, 404, 'folder not found'), true
      }
      const files = []
      let jp2 = 0
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const ext = extname(entry.name).toLowerCase()
        if (ext === '.jp2' || ext === '.j2k') jp2 += 1
        if (ext !== '.tif' && ext !== '.tiff') continue
        const full = join(realDir, entry.name)
        let size = 0
        try {
          size = (await fs.stat(full)).size
        } catch {
          continue
        }
        files.push({ name: entry.name, path: full, size })
      }
      // The UI promises the largest files first; sort before trimming so a
      // folder with hundreds of tiles still offers its real orthos.
      files.sort((a, b) => b.size - a.size)
      const truncated = files.length > MAX_LIST
      return sendJson(res, 200, { dir: realDir, files: files.slice(0, MAX_LIST), jp2, truncated }), true
    }
    if (head === 'upload' && req.method === 'POST') {
      if (!panelRequest(req)) return sendText(res, 403, 'upload requests must come from the panel'), true
      let headerName = String(req.headers['x-file-name'] ?? 'upload.tif')
      try {
        headerName = decodeURIComponent(headerName)
      } catch {
        headerName = 'upload.tif'
      }
      const original = basename(headerName).slice(0, 120)
      const ext = extname(original).toLowerCase()
      if (ext !== '.tif' && ext !== '.tiff') {
        return sendJson(res, 400, { code: 'not_tiff', message: 'choose a .tif or .tiff file' }), true
      }
      const dir = join(cacheDir, 'uploads')
      await fs.mkdir(dir, { recursive: true })
      const target = join(dir, `${randomUUID()}${ext}`)
      const temp = `${target}.incoming-${process.pid}`
      let size = 0
      const limit = new Transform({
        transform(chunk, _encoding, callback) {
          size += chunk.length
          if (size > MAX_UPLOAD) {
            const error = new Error('uploaded file is larger than 8 GB')
            error.code = 'too_large'
            callback(error)
            return
          }
          callback(null, chunk)
        },
      })
      try {
        await pipeline(req, limit, createWriteStream(temp))
        if (size === 0) throw Object.assign(new Error('empty file'), { code: 'empty' })
        await fs.rename(temp, target)
      } catch (error) {
        await fs.rm(temp, { force: true }).catch(() => {})
        if (error?.code === 'too_large') return sendJson(res, 413, { code: 'too_large', message: error.message }), true
        if (error?.code === 'empty') return sendJson(res, 400, { code: 'truncated', message: 'the file is empty' }), true
        throw error
      }
      if (allowedDirs instanceof Set) {
        allowedDirs.add(dir)
        allowedDirs.add(await realPathOr(dir))
      }
      // The upload target is a private cache copy, not a remembered user folder.
      void pruneUploads(dir).catch(() => {})
      return sendJson(res, 200, { path: target, size, name: original }), true
    }
    if (head === 'probe' && req.method === 'POST') {
      if (!panelRequest(req)) return sendText(res, 403, 'probe requests must come from the panel'), true
      const body = await readJsonBody(req)
      if (body === null || typeof body?.path !== 'string') return sendText(res, 400, 'bad request'), true
      if (await outsideAllowed(body.path)) {
        return sendJson(res, 403, { code: 'not_allowed', message: 'choose the folder from the panel first' }), true
      }
      try {
        const probe = await probeGeotiff(body.path)
        const paths = cachePaths({ cacheDir, fileKey: probe.fileKey })
        await writeMeta(paths, {
          version: 1,
          path: probe.path,
          name: probe.name,
          fileKey: probe.fileKey,
          size: probe.size,
          mtimeMs: probe.mtimeMs,
          render: probe.render,
          stats: probe.stats,
          bbox: probe.bbox,
          crs: probe.crs,
          width: probe.width,
          height: probe.height,
          bands: probe.bands,
          bits: probe.bits,
          nodata: probe.nodata,
          maxLevel: probe.pyramid.maxLevel,
          levels: probe.pyramid.levels,
          tileCount: probe.pyramid.total,
          tileSize: 256,
        })
        return sendJson(res, 200, { probe }), true
      } catch (error) {
        return sendJson(res, 400, { code: error?.code ?? 'probe_failed', message: short(error?.message ?? String(error)) }), true
      }
    }
    if (head === 'publish' && req.method === 'POST') {
      if (!panelRequest(req)) return sendText(res, 403, 'publish requests must come from the panel'), true
      const body = await readJsonBody(req, 32 * 1024)
      if (body === null || typeof body?.path !== 'string') return sendText(res, 400, 'bad request'), true
      if (await outsideAllowed(body.path)) {
        return sendJson(res, 403, { code: 'not_allowed', message: 'choose the folder from the panel first' }), true
      }
      try {
        // Probe already cached identity + stats under the file key; re-running the
        // full statistics pass here would double the work before a queued job.
        const stat = await statGeotiff(body.path)
        const fileKey = fileKeyFor({ path: body.path, size: stat.size, mtimeMs: stat.mtimeMs })
        const cached = await readMeta(cachePaths({ cacheDir, fileKey }))
        const job = queue.start({
          filePath: body.path,
          render: body.render,
          fileName: cached?.name ?? basename(body.path),
        })
        return sendJson(res, 202, { jobId: job.id, job }), true
      } catch (error) {
        const status = error?.code === 'too_many_jobs' ? 429 : 400
        return sendJson(res, status, { code: error?.code ?? 'publish_failed', message: short(error?.message ?? String(error)) }), true
      }
    }
    if (head === 'job' && tail.length === 1) {
      if (req.method === 'GET') {
        const status = queue.status(tail[0])
        return (status ? sendJson(res, 200, status) : sendText(res, 404, 'job not found')), true
      }
      if (req.method === 'DELETE') {
        const status = queue.cancel(tail[0])
        return (status ? sendJson(res, 200, status) : sendText(res, 404, 'job not found')), true
      }
      return sendText(res, 405, 'method not allowed'), true
    }
    if (head === 'preview' && tail.length === 2 && req.method === 'GET') {
      const [fileKey, renderFile] = tail
      const renderKey = renderFile.replace(/\.png$/i, '')
      if (!KEY_RE.test(fileKey) || !RENDER_RE.test(renderKey)) return sendText(res, 403, 'forbidden'), true
      try {
        const bytes = await previewFor(fileKey, renderKey)
        if (bytes === null) return sendText(res, 404, 'preview not found'), true
        await sendPng(res, bytes)
      } catch {
        sendText(res, 404, 'preview not found')
      }
      return true
    }
    if (head === 'tiles' && tail.length === 5 && req.method === 'GET') {
      const [fileKey, renderKey, z, tileX, tileFile] = tail
      if (!KEY_RE.test(fileKey) || !RENDER_RE.test(renderKey)) return sendText(res, 403, 'forbidden'), true
      const match = TILE_RE.exec(`${z}/${tileX}/${tileFile}`)
      if (!match) return sendText(res, 403, 'forbidden'), true
      const paths = cachePaths({ cacheDir, fileKey, renderKey })
      const target = join(paths.tilesDir, match[1], match[2], `${match[3]}.png`)
      try {
        const bytes = await fs.readFile(target)
        await sendPng(res, bytes)
      } catch {
        sendText(res, 404, 'not found')
      }
      return true
    }
    if (head === 'cache' && req.method === 'GET') {
      const usage = await cacheUsage(cacheDir)
      return sendJson(res, 200, usage), true
    }
    return false
  }

  return { handler, queue, cacheDir }
}
