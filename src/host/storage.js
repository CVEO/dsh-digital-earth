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
 */
async function pruneCaptures(keepName) {
  await pruneByMtime(CAPTURES_DIR, MAX_CAPTURE_FILES, {
    match: (name) => /^earth-.+\.(jpe?g|png)$/i.test(name),
    keepName,
  })
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
export function capturesHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'method not allowed')
  const raw = subPath(requestPath(req), FILES_ROUTE)
  if (raw === null) return sendText(res, 404, 'not found')
  const parts = segments(raw)
  const name = parts.length === 2 && parts[0] === TOKEN ? decodeSegment(parts[1]) : null
  if (name === null || !/^[A-Za-z0-9._-]+$/.test(name)) return sendText(res, 403, 'forbidden')
  serveFile(req, res, CAPTURES_DIR, name, 'no-store')
}
