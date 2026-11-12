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
import { EXPORTS_DIR, MAX_DRAW_COORDINATES, MAX_DRAW_FEATURES, MAX_EVIDENCE_JSON, MAX_EXPORT_BODY, MAX_EXPORT_FILES } from './constants.js'
import { sanitizeLabel, timeStamp } from './paths.js'
import { sendJson, sendText } from './http.js'
import { pruneByMtime } from './fs-util.js'

const IMAGE_DATA_URL = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/
const VECTOR_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

/**
 * Read and parse a bounded JSON body; answers the request itself on failure and
 * returns `undefined` (JSON `null` is a valid body and must reach the handler).
 */
async function readJsonBody(req, res) {
  if (req.method !== 'POST') {
    sendText(res, 405, 'method not allowed')
    return undefined
  }
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_EXPORT_BODY) {
        req.destroy()
        sendText(res, 413, 'payload too large')
        return undefined
      }
    }
  } catch {
    sendText(res, 400, 'bad request')
    return undefined
  }
  try {
    return JSON.parse(body)
  } catch {
    sendText(res, 400, 'invalid json')
    return undefined
  }
}

/** Leaf [lon, lat] pairs in any GeoJSON coordinate tree. */
function countCoordinates(node) {
  if (!Array.isArray(node)) return 0
  if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') return 1
  let total = 0
  for (const item of node) total += countCoordinates(item)
  return total
}

/** Bounding box of a FeatureCollection, in degrees; null when nothing numeric. */
function bboxOfFeatures(features) {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  const visit = (node) => {
    if (!Array.isArray(node)) return
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      if (!Number.isFinite(node[0]) || !Number.isFinite(node[1])) return
      west = Math.min(west, node[0])
      east = Math.max(east, node[0])
      south = Math.min(south, node[1])
      north = Math.max(north, node[1])
      return
    }
    for (const item of node) visit(item)
  }
  for (const feature of features) visit(feature?.geometry?.coordinates)
  return Number.isFinite(west) ? { west, south, east, north } : null
}

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
  const payload = await readJsonBody(req, res)
  if (payload === undefined) return
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

/**
 * POST: write one .geojson of the current vector overlay layer.
 *
 * The page has already validated the features it drew, so the host re-checks
 * only what keeps the folder safe and bounded: the envelope shape, the same
 * feature/coordinate ceilings as earth_draw, the payload size and the host-owned
 * file name. Nothing here is a tool route, so the model never learns the path.
 */
export async function vectorExportHandler(req, res) {
  const payload = await readJsonBody(req, res)
  if (payload === undefined) return
  if (payload?.kind !== 'vector') return sendText(res, 400, 'invalid kind')
  const features = Array.isArray(payload.features) ? payload.features : null
  if (features === null || features.length === 0) return sendText(res, 400, 'empty vector layer')
  if (features.length > MAX_DRAW_FEATURES) return sendText(res, 413, 'too many features')
  let coordinates = 0
  for (const feature of features) {
    const geometry = feature?.geometry
    if (feature?.type !== 'Feature' || geometry === null || typeof geometry !== 'object' || !VECTOR_GEOMETRY_TYPES.has(geometry.type)) {
      return sendText(res, 400, 'invalid feature')
    }
    coordinates += countCoordinates(geometry.coordinates)
    if (coordinates > MAX_DRAW_COORDINATES) return sendText(res, 413, 'too many coordinates')
  }
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : ''
  const geojson = { type: 'FeatureCollection', ...(name === '' ? {} : { name }), features }
  const content = JSON.stringify(geojson, null, 2)
  const contentBytes = Buffer.byteLength(content, 'utf8')
  if (contentBytes > MAX_EXPORT_BODY - 1024) return sendText(res, 413, 'vector too large')
  const label = sanitizeLabel(name)
  const base = `earth-vector-${timeStamp()}-${randomBytes(4).toString('hex')}${label === '' ? '' : `-${label}`}`
  const fileName = `${base}.geojson`
  const filePath = join(EXPORTS_DIR, fileName)
  const tempPath = `${filePath}.tmp`
  try {
    await fs.mkdir(EXPORTS_DIR, { recursive: true })
    // Temp file + rename: a half-written export never appears as a real one.
    await fs.writeFile(tempPath, content, 'utf8')
    await fs.rename(tempPath, filePath)
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {})
    return sendText(res, 500, `vector save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  void pruneExports(fileName).catch(() => {})
  sendJson(res, 200, {
    path: filePath,
    bytes: contentBytes,
    count: features.length,
    bbox: bboxOfFeatures(features),
  })
}
