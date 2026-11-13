/**
 * Page-only "take away" evidence pack: the panel posts a report card (and an
 * optional screenshot) and the host writes both files under DSH_HOME/exports.
 *
 * This route has no tool counterpart and is never named in a tool result: the
 * user takes the evidence, while the model never learns its destination.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { EXPORTS_DIR, MAX_DRAW_COORDINATES, MAX_DRAW_FEATURES, MAX_EVIDENCE_JSON, MAX_EXPORT_BODY, MAX_EXPORT_FILES, MAX_INJECT_TEXT } from './constants.js'
import { sanitizeLabel, timeStamp } from './paths.js'
import { sendJson, sendText } from './http.js'
import { pruneByMtime } from './fs-util.js'
import { validSessionId } from './session.js'

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

/** Visit every coordinate tree inside a geometry, including nested GeometryCollections. */
function walkGeometry(geometry, visit) {
  if (geometry === null || typeof geometry !== 'object') return
  if (geometry.type === 'GeometryCollection') {
    if (Array.isArray(geometry.geometries)) for (const child of geometry.geometries) walkGeometry(child, visit)
    return
  }
  visit(geometry.coordinates)
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
  for (const feature of features) walkGeometry(feature?.geometry, visit)
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

/** Resolve one optional DSH service without assuming this host version has it. */
function lookupService(ctx, name) {
  try {
    return ctx?.get?.(name) ?? ctx?.[name] ?? null
  } catch {
    return null
  }
}

/**
 * Validate one vector export envelope; answers 4xx itself and returns null on refusal.
 *
 * The page has already validated the features it drew, so the host re-checks
 * only what keeps the folder and the conversation safe and bounded: envelope
 * shape, the earth_draw ceilings, and a finite coordinate count.
 */
function vectorFeaturesOf(payload, res) {
  if (payload?.kind !== 'vector') {
    sendText(res, 400, 'invalid kind')
    return null
  }
  const features = Array.isArray(payload.features) ? payload.features : null
  if (features === null || features.length === 0) {
    sendText(res, 400, 'empty vector layer')
    return null
  }
  if (features.length > MAX_DRAW_FEATURES) {
    sendText(res, 413, 'too many features')
    return null
  }
  let coordinates = 0
  let invalid = false
  let tooMany = false
  // A GeometryCollection has no coordinates of its own: recurse so nested trees
  // cannot smuggling an unbounded number of vertices past the ceiling.
  const checkGeometry = (geometry, depth) => {
    if (invalid || tooMany) return
    if (geometry === null || typeof geometry !== 'object' || !VECTOR_GEOMETRY_TYPES.has(geometry.type)) {
      invalid = true
      return
    }
    if (geometry.type === 'GeometryCollection') {
      if (depth >= 4 || !Array.isArray(geometry.geometries)) {
        invalid = true
        return
      }
      for (const child of geometry.geometries) checkGeometry(child, depth + 1)
      return
    }
    walkGeometry(geometry, (tree) => {
      if (invalid || tooMany) return
      coordinates += countCoordinates(tree)
      if (coordinates > MAX_DRAW_COORDINATES) tooMany = true
    })
  }
  for (const feature of features) {
    if (feature?.type !== 'Feature') {
      invalid = true
      break
    }
    checkGeometry(feature.geometry, 0)
    if (invalid || tooMany) break
  }
  if (invalid) {
    sendText(res, 400, 'invalid feature')
    return null
  }
  if (tooMany) {
    sendText(res, 413, 'too many coordinates')
    return null
  }
  return features
}

/** Write one host-named .geojson for validated features; answers 413/500 on refusal. */
async function writeVectorFile(features, rawName, res) {
  const name = typeof rawName === 'string' ? rawName.trim().slice(0, 120) : ''
  const geojson = { type: 'FeatureCollection', ...(name === '' ? {} : { name }), features }
  const content = JSON.stringify(geojson, null, 2)
  const contentBytes = Buffer.byteLength(content, 'utf8')
  if (contentBytes > MAX_EXPORT_BODY - 1024) {
    sendText(res, 413, 'vector too large')
    return null
  }
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
    sendText(res, 500, `vector save failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
  void pruneExports(fileName).catch(() => {})
  return { fileName, filePath, content, contentBytes, bbox: bboxOfFeatures(features) }
}

/** Bounded, control-character-free notice text; falls back to a host-owned sentence. */
function noticeText(value, fallback) {
  const cleaned = String(value ?? '')
    // Keep the same whitespace controls the inject route keeps (tab, newline).
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, '')
    .trim()
    .slice(0, MAX_INJECT_TEXT - 400)
  return cleaned === '' ? fallback : cleaned
}

/**
 * POST: write one .geojson of the current vector overlay layer.
 *
 * Nothing here is a tool route, so the model never learns the path from a tool
 * result; the user takes the file.
 */
export async function vectorExportHandler(req, res) {
  const payload = await readJsonBody(req, res)
  if (payload === undefined) return
  const features = vectorFeaturesOf(payload, res)
  if (features === null) return
  const written = await writeVectorFile(features, payload.name, res)
  if (written === null) return
  sendJson(res, 200, {
    path: written.filePath,
    bytes: written.contentBytes,
    count: features.length,
    bbox: written.bbox,
  })
}

/**
 * POST: write one .geojson AND hand the same bytes to the live conversation.
 *
 * This is the real-attachment half of F3: the file becomes a durable
 * `{ type: 'file' }` content block, which the chat client renders as a file
 * card, and the model receives only the host file handle text. When the
 * mounted attachment provider cannot store verbatim files, or the agent is not
 * running, the route still writes the file and reports the path, so the user
 * never loses the export. The route answers 200 after the file exists; the
 * receipt says exactly what happened (injected / attached flags).
 */
export async function vectorChatHandler(ctx, req, res) {
  const payload = await readJsonBody(req, res)
  if (payload === undefined) return
  const session = typeof payload?.session === 'string' ? payload.session : ''
  if (!validSessionId(session)) return sendText(res, 400, 'missing or invalid session')
  const features = vectorFeaturesOf(payload, res)
  if (features === null) return
  const written = await writeVectorFile(features, payload.name, res)
  if (written === null) return
  const receipt = {
    ok: true,
    path: written.filePath,
    bytes: written.contentBytes,
    count: features.length,
    bbox: written.bbox,
    injected: false,
    attached: false,
  }
  const agents = lookupService(ctx, 'agents')
  const attachments = lookupService(ctx, 'attachments')
  let agent = null
  try {
    agent = agents && typeof agents.get === 'function' ? agents.get(session) : null
  } catch {
    agent = null
  }
  if (!agent || typeof agent.inject !== 'function') {
    sendJson(res, 200, { ...receipt, reason: 'agent_not_running' })
    return
  }
  // The notice names the file and its path; the page never has to echo either.
  const text = `${noticeText(payload.text, `Digital Earth vector overlay: ${written.fileName}`)}
\n\nFile: ${written.fileName} (${written.contentBytes} bytes)
\nPath: ${written.filePath}`
  let attachment = null
  if (attachments !== null && typeof attachments.saveFile === 'function') {
    try {
      attachment = await attachments.saveFile({
        data: Buffer.from(written.content, 'utf8'),
        name: written.fileName,
      })
    } catch {
      // Providers without verbatim file storage reject; the path notice still works.
      attachment = null
    }
  }
  const content = [{ type: 'text', text }]
  if (attachment !== null) content.push({ type: 'file', attachment })
  try {
    agent.inject({
      id: randomUUID(),
      role: 'user',
      content,
      source: { kind: 'digital-earth', form: 'notice', summary: 'Digital Earth vector overlay file' },
    })
  } catch (error) {
    sendJson(res, 200, {
      ...receipt,
      reason: 'inject_failed',
      message: error instanceof Error ? error.message : String(error),
    })
    return
  }
  sendJson(res, 200, {
    ...receipt,
    injected: true,
    attached: attachment !== null,
    ...(attachment === null ? { reason: 'attachment_unavailable' } : { attachment: { name: attachment.name, bytes: attachment.bytes } }),
  })
}
