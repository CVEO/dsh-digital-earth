/**
 * Capture and report storage: write, verify, prune and serve back.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { CAPTURES_DIR, EXPORTS_DIR, FILES_ROUTE, MAX_CAPTURE_BODY, MAX_CAPTURE_FILES, MAX_EXPORT_FILES, MAX_REPORT_BODY, REPORT_FORMATS, TOKEN } from './constants.js'
import { decodeSegment, sanitizeLabel, segments, timeStamp } from './paths.js'
import { requestPath, sendJson, sendText, serveFile, subPath } from './http.js'
import { pruneByMtime } from './fs-util.js'

/**
 * Keep only the newest screenshots so the capture folder cannot grow without
 * bound. Pruning is best effort and must never fail the capture that wrote the
 * newest file.
 *
 * Provenance sidecars (`<image>.json`) never take a slot in MAX_CAPTURE_FILES:
 * the image quota is applied first, then sidecars whose image is gone are
 * removed, so the folder keeps either both files or neither.
 */
async function pruneCaptures(keepName) {
  await pruneByMtime(CAPTURES_DIR, MAX_CAPTURE_FILES, {
    match: (name) => /^earth-.+\.(jpe?g|png)$/i.test(name),
    keepName,
  })
  await pruneCaptureSidecars()
}

/** Remove sidecars whose image no longer exists (pruned, deleted or replaced). */
async function pruneCaptureSidecars() {
  let entries
  try {
    entries = await fs.readdir(CAPTURES_DIR, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(jpe?g|png)\.json$/i.test(entry.name)) continue
    const imageName = entry.name.slice(0, -'.json'.length)
    try {
      await fs.stat(join(CAPTURES_DIR, imageName))
      continue
    } catch {
      // The image is gone: the sidecar is an orphan and would otherwise linger.
    }
    await fs.rm(join(CAPTURES_DIR, entry.name), { force: true }).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Capture metadata sidecar (P0 4.1)
//
// The page reports the camera and scene context with a capture. Only the fields
// listed here are ever accepted or written — everything else in the posted JSON
// is dropped, so a modified page cannot smuggle arbitrary content into the
// sidecar, and every value is bounded/sanitised before it reaches disk.
// ---------------------------------------------------------------------------

const CAPTURE_METADATA_SCHEMA_VERSION = 1
const CAPTURE_METADATA_TEXT_MAX = 120
const CAPTURE_METADATA_KIND_MAX = 24
const CAPTURE_METADATA_LAYERS_MAX = 200

/** A plain JSON object, or null for arrays/primitives. */
const metadataObject = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null)

/** One line of text: control characters stripped, trimmed and length-bounded. */
function metadataText(value, limit = CAPTURE_METADATA_TEXT_MAX) {
  if (typeof value !== 'string') return null
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, limit)
  return text === '' ? null : text
}

/** A finite number inside [min, max], or null. Never coerces strings. */
function metadataNumber(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < min || value > max) return null
  return value
}

/** ISO-8601 timestamp, re-encoded by Date so a malformed string becomes null. */
function metadataTime(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const time = new Date(value.trim())
  return Number.isNaN(time.getTime()) ? null : time.toISOString()
}

/** Camera pose: requires a usable lon/lat; the other fields become null. */
function metadataCamera(value) {
  const source = metadataObject(value)
  if (source === null) return null
  const lon = metadataNumber(source.lon, -180, 180)
  const lat = metadataNumber(source.lat, -90, 90)
  if (lon === null || lat === null) return null
  return {
    lon,
    lat,
    height: metadataNumber(source.height, -11000, 100000000),
    heading: metadataNumber(source.heading, -360, 360),
    pitch: metadataNumber(source.pitch, -90, 90),
  }
}

/** View centre: a WGS84 point with an optional height above the ellipsoid. */
function metadataCenter(value) {
  const source = metadataObject(value)
  if (source === null) return null
  const lon = metadataNumber(source.lon, -180, 180)
  const lat = metadataNumber(source.lat, -90, 90)
  if (lon === null || lat === null) return null
  return { lon, lat, height: metadataNumber(source.height, -11000, 100000000) }
}

/** Layer list: names only, bounded count; entries without a name are dropped. */
function metadataLayers(value) {
  if (!Array.isArray(value)) return []
  const layers = []
  for (const item of value) {
    if (layers.length >= CAPTURE_METADATA_LAYERS_MAX) break
    const layer = metadataObject(item)
    const name = metadataText(layer?.name)
    if (name === null) continue
    layers.push({
      name,
      visible: layer.visible === true,
      kind: metadataText(layer.kind, CAPTURE_METADATA_KIND_MAX),
    })
  }
  return layers
}

/** Build the exact sidecar document: whitelisted fields plus the image size. */
function buildCaptureMetadata(raw, size) {
  const metadata = metadataObject(raw) ?? {}
  return {
    schema_version: CAPTURE_METADATA_SCHEMA_VERSION,
    captured_at: metadataTime(metadata.captured_at),
    camera: metadataCamera(metadata.camera),
    center: metadataCenter(metadata.center),
    layers: metadataLayers(metadata.layers),
    imagery: metadataText(metadata.imagery),
    terrain: metadataText(metadata.terrain),
    plugin_version: metadataText(metadata.plugin_version, CAPTURE_METADATA_KIND_MAX),
    size,
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
  await pruneByMtime(EXPORTS_DIR, MAX_EXPORT_FILES, { keepName })
}

/** POST: the page uploads a rendered screenshot; answer with the stored file. */
export async function captureHandler(req, res) {
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
  const width = Number.isInteger(payload.width) && payload.width > 0 ? payload.width : null
  const height = Number.isInteger(payload.height) && payload.height > 0 ? payload.height : null
  const value = { path: target, url: `${FILES_ROUTE}/${TOKEN}/${name}`, bytes: bytes.length }
  if (width !== null) value.width = width
  if (height !== null) value.height = height
  // Provenance is best effort: a failed sidecar write must never cost the user
  // the picture that is already on disk.
  if (metadataObject(payload.metadata) !== null) {
    const sidecar = buildCaptureMetadata(payload.metadata, { width, height, bytes: bytes.length })
    const sidecarPath = `${target}.json`
    try {
      await fs.writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8')
      value.metadata_path = sidecarPath
      // Echo the validated document back so the panel reports exactly what the
      // sidecar holds instead of re-using its own unvalidated copy.
      value.metadata = sidecar
    } catch {
      // The capture result stays valid without provenance.
    }
  }
  try {
    await pruneCaptures(name)
  } catch {
    // Retention is best effort; the capture itself already succeeded.
  }
  sendJson(res, 200, value)
}

/** GET: serve a captured screenshot back to the page that produced it. */
export function capturesHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'method not allowed')
  const raw = subPath(requestPath(req), FILES_ROUTE)
  if (raw === null) return sendText(res, 404, 'not found')
  const parts = segments(raw)
  const name = parts.length === 2 && parts[0] === TOKEN ? decodeSegment(parts[1]) : null
  if (name === null || !/^[A-Za-z0-9._-]+$/.test(name)) return sendText(res, 403, 'forbidden')
  serveFile(req, res, CAPTURES_DIR, name, 'no-store')
}
