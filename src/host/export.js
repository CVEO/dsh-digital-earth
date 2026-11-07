/**
 * Page-only "take away" evidence pack: the panel posts a report card (and an
 * optional screenshot) and the host writes both files under DSH_HOME/exports.
 *
 * This route has no tool counterpart and is never named in a tool result: the
 * user takes the evidence, while the model never learns its destination.
 */
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { EXPORTS_DIR, MAX_EVIDENCE_JSON, MAX_EXPORT_BODY, MAX_EXPORT_FILES } from './constants.js'
import { sanitizeLabel, timeStamp } from './paths.js'
import { sendJson, sendText } from './http.js'
import { pruneByMtime } from './fs-util.js'

const IMAGE_DATA_URL = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/

/** Keep the newest exports so the folder cannot grow without bound. */
async function pruneExports(keepName) {
  await pruneByMtime(EXPORTS_DIR, MAX_EXPORT_FILES, { keepName })
}

/**
 * POST: write one evidence pack (card JSON plus optional image) and answer with
 * the absolute paths. Both names are host-generated, so the page can never pick
 * a destination outside DSH_HOME/exports.
 */
export async function evidenceExportHandler(req, res) {
  if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_EXPORT_BODY) {
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
  if (payload?.kind !== 'evidence') return sendText(res, 400, 'invalid kind')
  const card = payload.card
  if (card === null || typeof card !== 'object' || Array.isArray(card)) {
    return sendText(res, 400, 'invalid evidence')
  }
  const content = JSON.stringify(card, null, 2)
  const contentBytes = Buffer.byteLength(content, 'utf8')
  if (contentBytes > MAX_EVIDENCE_JSON) return sendText(res, 413, 'evidence too large')
  let image = null
  if (payload.image !== undefined) {
    const match = typeof payload.image === 'string' ? IMAGE_DATA_URL.exec(payload.image) : null
    if (match === null) return sendText(res, 400, 'invalid image data')
    const bytes = Buffer.from(match[2], 'base64')
    if (bytes.length === 0) return sendText(res, 400, 'empty image data')
    image = { bytes, extension: match[1] === 'png' ? 'png' : 'jpg' }
  }
  const label = sanitizeLabel(payload.label)
  const base = `earth-evidence-${timeStamp()}-${randomBytes(4).toString('hex')}${label === '' ? '' : `-${label}`}`
  const jsonName = `${base}.json`
  const jsonPath = join(EXPORTS_DIR, jsonName)
  const imagePath = image === null ? null : join(EXPORTS_DIR, `${base}.${image.extension}`)
  try {
    await fs.mkdir(EXPORTS_DIR, { recursive: true })
    await fs.writeFile(jsonPath, content, 'utf8')
    if (image !== null) await fs.writeFile(imagePath, image.bytes)
  } catch (error) {
    // A half-written pack would be worse than no pack: remove what this call wrote.
    await fs.rm(jsonPath, { force: true }).catch(() => {})
    if (imagePath !== null) await fs.rm(imagePath, { force: true }).catch(() => {})
    return sendText(res, 500, `evidence save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  void pruneExports(jsonName).catch(() => {})
  sendJson(res, 200, {
    path: jsonPath,
    bytes: contentBytes,
    image_path: imagePath,
    image_bytes: image === null ? null : image.bytes.length,
  })
}
