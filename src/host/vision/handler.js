/**
 * host/vision/handler.js — HTTP route handlers for single-target vision,
 * batch scene parsing, and standalone vision backend configuration.
 *
 * Includes:
 *   - Strict image payload & header validation
 *   - Lease-based concurrency limiter (protects against runaway retries while
 *     auto-recovering orphaned streams after `orphanGraceMs` so the host never
 *     permanently deadlocks into `busy`)
 *   - Structured, secret-scrubbed `diagnostic` payloads on every error
 */
import { MAX_VISION_CONFIG_BODY } from '../constants.js'
import { sendJson, sendText } from '../http.js'
import { visionError } from '../../client/scene/vision-geometry.js'
import { defaultVisionBackends } from './backends/registry.js'
import { clearProbeCache } from './capability.js'
import { normalizeVisionConfig, readVisionConfig, redactVisionConfig, writeVisionConfig } from './config.js'
import { BATCH_CLASSES, MAX_BODY, NEXT, sanitizeDiagnosticDetail } from './prompts.js'

function imageDimensions(data, mediaType) {
  if (mediaType === 'image/png') {
    if (data.length < 33 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.toString('ascii', 12, 16) !== 'IHDR') {
      throw visionError('invalid_request', { stage: 'validate', detail: 'Invalid PNG header.' })
    }
    return [data.readUInt32BE(16), data.readUInt32BE(20)]
  }
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    throw visionError('invalid_request', { stage: 'validate', detail: 'Invalid JPEG header.' })
  }
  let offset = 2
  while (offset + 4 <= data.length) {
    if (data[offset++] !== 0xff) throw visionError('invalid_request', { stage: 'validate', detail: 'Corrupt JPEG marker.' })
    while (data[offset] === 0xff) offset++
    const marker = data[offset++]
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > data.length) break
    const length = data.readUInt16BE(offset)
    if (length < 2 || offset + length > data.length) break
    if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
      return [data.readUInt16BE(offset + 5), data.readUInt16BE(offset + 3)]
    }
    offset += length
  }
  throw visionError('invalid_request', { stage: 'validate', detail: 'Unable to read JPEG dimensions.' })
}

function decodeImagePayload(payload) {
  const match = typeof payload?.image === 'string' && payload.image.match(/^data:(image\/(?:png|jpeg));base64,([a-zA-Z0-9+/]+={0,2})$/)
  if (!match) throw visionError('invalid_request', { stage: 'validate', detail: 'Image must be a base64 PNG or JPEG data URL.' })
  const data = Buffer.from(match[2], 'base64')
  if (data.toString('base64') !== match[2]) throw visionError('invalid_request', { stage: 'validate', detail: 'Invalid base64 image encoding.' })
  if (data.length > 1_500_000) throw visionError('too_large', { stage: 'validate', detail: 'Decoded image exceeds 1.5 MB limit.' })
  const [width, height] = imageDimensions(data, match[1])
  if (width < 32 || height < 32 || width > 1024 || height > 1024) {
    throw visionError('invalid_request', { stage: 'validate', detail: `Image dimensions ${width}x${height} outside 32..1024.` })
  }
  return { data, mediaType: match[1], width, height }
}

export function validateVisionRequest(payload) {
  if (
    !payload ||
    typeof payload.frameId !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(payload.frameId) ||
    !Array.isArray(payload.point) ||
    payload.point.length !== 2 ||
    !payload.point.every((number) => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1)
  ) {
    throw visionError('invalid_request', { stage: 'validate', detail: 'Invalid frameId or normalized click point.' })
  }
  return {
    ...decodeImagePayload(payload),
    point: payload.point,
    frameId: payload.frameId,
    force: payload.force === true,
  }
}

export function validateVisionBatchRequest(payload) {
  if (!payload || typeof payload.frameId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(payload.frameId)) {
    throw visionError('invalid_request', { stage: 'validate', detail: 'Invalid batch frameId.' })
  }
  const scope = payload.scope === 'aoi' ? 'aoi' : 'view'
  const rawClasses = Array.isArray(payload.classes) ? payload.classes : null
  const classes = rawClasses
    ? [...new Set(rawClasses.map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : '')).filter((item) => BATCH_CLASSES.has(item)))]
    : []
  return {
    ...decodeImagePayload(payload),
    frameId: payload.frameId,
    scope,
    classes,
    force: payload.force === true,
  }
}

function createConcurrencyLimiter(limit, orphanGraceMs = 5000) {
  const slots = new Map()
  let seq = 0

  return {
    acquire() {
      if (slots.size >= limit) {
        throw visionError('busy', { stage: 'queue', detail: 'Vision concurrency limit reached.' })
      }
      const id = ++seq
      slots.set(id, { timer: null })
      return id
    },
    release(id) {
      const slot = slots.get(id)
      if (!slot) return
      if (slot.timer) clearTimeout(slot.timer)
      slots.delete(id)
    },
    orphan(id) {
      const slot = slots.get(id)
      if (!slot || slot.timer) return
      const timer = setTimeout(() => {
        slots.delete(id)
      }, orphanGraceMs)
      timer.unref?.()
      slot.timer = timer
    },
  }
}

async function readJsonBody(req, maxBytes, signal) {
  let length = 0
  const chunks = []
  for await (const chunk of req) {
    signal?.throwIfAborted()
    const buffer = Buffer.from(chunk)
    length += buffer.length
    if (length > maxBytes) throw visionError('too_large', { stage: 'validate', detail: 'Request body exceeds size limit.' })
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw visionError('invalid_request', { stage: 'validate', detail: 'Malformed JSON request body.' })
  }
}

function queryForceFlag(req) {
  try {
    const parsed = new URL(req.url || '/', 'http://localhost')
    return parsed.searchParams.get('force') === '1' || parsed.searchParams.get('force') === 'true'
  } catch {
    return false
  }
}

function buildDiagnostic(error, code, backendId = null) {
  const detail = sanitizeDiagnosticDetail(error?.detail || (error?.message && error.message !== code ? error.message : ''))
  return {
    stage: typeof error?.stage === 'string' ? error.stage : 'unknown',
    ...(error?.backend || backendId ? { backend: error?.backend || backendId } : {}),
    ...(typeof error?.provider === 'string' && error.provider ? { provider: error.provider } : {}),
    ...(typeof error?.model === 'string' && error.model ? { model: error.model } : {}),
    ...(error?.canForce === true ? { canForce: true } : {}),
    ...(detail ? { detail } : {}),
  }
}

function statusForCode(code) {
  if (code === 'timeout') return 504
  if (code === 'unavailable' || code === 'busy') return 503
  if (code === 'too_large') return 413
  if (code === 'invalid_request') return 400
  if (code === 'model_failed') return 502
  return 422
}

function makeVisionRouteHandler(ctx, {
  panelHeader,
  maxConcurrent,
  timeoutMs,
  orphanGraceMs = 5000,
  getService,
  backends = defaultVisionBackends,
  loadConfig = readVisionConfig,
  fetchImpl = globalThis.fetch,
  validate,
  runBackend,
}) {
  const limiter = createConcurrencyLimiter(maxConcurrent, orphanGraceMs)

  return async function visionRouteHandler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) return sendText(res, 405, 'method not allowed')
    if (req.method === 'POST' && req.headers?.['x-dsh-panel'] !== panelHeader) return sendText(res, 403, 'forbidden')

    const controller = new AbortController()
    const cancel = () => { if (!res.writableEnded) controller.abort(visionError('cancelled')) }
    req.once?.('aborted', cancel)
    res.once?.('close', cancel)
    const aborted = new Promise((_, reject) =>
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }),
    )
    const timer = setTimeout(() => controller.abort(visionError('timeout', { stage: 'stream', detail: `Vision request exceeded ${Math.round(timeoutMs / 1000)}s timeout.` })), timeoutMs)

    let activeSlot = null
    let backendId = null
    const work = async () => {
      const config = await loadConfig()
      const backend = backends.resolve({ ctx, getService, config, fetchImpl })
      backendId = backend.id
      if (req.method === 'GET') {
        return await backend.probe(controller.signal, { force: queryForceFlag(req) })
      }
      const payload = await readJsonBody(req, MAX_BODY, controller.signal)
      const input = validate(payload)
      const slot = limiter.acquire()
      activeSlot = slot
      try {
        const result = await runBackend(backend, input, controller.signal)
        return { ok: true, frameId: input.frameId, ...result }
      } finally {
        limiter.release(slot)
        if (activeSlot === slot) activeSlot = null
      }
    }

    try {
      const result = await Promise.race([work(), aborted])
      if (!res.destroyed) sendJson(res, 200, result)
    } catch (error) {
      if (activeSlot !== null) limiter.orphan(activeSlot)
      const code = Object.hasOwn(NEXT, error?.code) ? error.code : 'model_failed'
      controller.abort(visionError(code))
      if (!res.destroyed) {
        sendJson(res, statusForCode(code), {
          ok: false,
          code,
          next: NEXT[code],
          diagnostic: buildDiagnostic(error, code, backendId),
        })
      }
    } finally {
      clearTimeout(timer)
      req.removeListener?.('aborted', cancel)
      res.removeListener?.('close', cancel)
    }
  }
}

export function createVisionHandler(ctx, options = {}) {
  return makeVisionRouteHandler(ctx, {
    panelHeader: 'vision',
    maxConcurrent: 2,
    timeoutMs: 60000,
    ...options,
    validate: validateVisionRequest,
    runBackend: (backend, input, signal) => backend.extractSingle(input, signal, { force: input.force }),
  })
}

export function createVisionBatchHandler(ctx, options = {}) {
  return makeVisionRouteHandler(ctx, {
    panelHeader: 'vision-batch',
    maxConcurrent: 1,
    timeoutMs: 90000,
    ...options,
    validate: validateVisionBatchRequest,
    runBackend: (backend, input, signal) => backend.extractBatch(input, signal, { force: input.force }),
  })
}

export function createVisionConfigHandler(ctx, {
  getService,
  backends = defaultVisionBackends,
  loadConfig = readVisionConfig,
  saveConfig = writeVisionConfig,
  fetchImpl = globalThis.fetch,
} = {}) {
  return async function visionConfigHandler(req, res) {
    if (!['GET', 'PUT'].includes(req.method)) return sendText(res, 405, 'method not allowed')
    if (req.method === 'PUT' && req.headers?.['x-dsh-panel'] !== 'vision-config') return sendText(res, 403, 'forbidden')
    try {
      if (req.method === 'GET') {
        const config = await loadConfig()
        const backend = backends.resolve({ ctx, getService, config, fetchImpl })
        let probe = null
        try {
          probe = await backend.probe(new AbortController().signal, { force: false })
        } catch (error) {
          const code = Object.hasOwn(NEXT, error?.code) ? error.code : 'model_failed'
          probe = { ok: false, code, next: NEXT[code], diagnostic: buildDiagnostic(error, code, backend.id) }
        }
        return sendJson(res, 200, { ok: true, config: redactVisionConfig(config), probe, modes: backends.modes() })
      }
      const existing = await loadConfig()
      const raw = await readJsonBody(req, MAX_VISION_CONFIG_BODY)
      const next = normalizeVisionConfig(raw, existing)
      const saved = await saveConfig(next)
      clearProbeCache()
      const backend = backends.resolve({ ctx, getService, config: saved, fetchImpl })
      let probe = null
      try {
        probe = await backend.probe(new AbortController().signal, { force: false })
      } catch (error) {
        const code = Object.hasOwn(NEXT, error?.code) ? error.code : 'model_failed'
        probe = { ok: false, code, next: NEXT[code], diagnostic: buildDiagnostic(error, code, backend.id) }
      }
      return sendJson(res, 200, { ok: true, config: redactVisionConfig(saved), probe, modes: backends.modes() })
    } catch (error) {
      const code = Object.hasOwn(NEXT, error?.code) ? error.code : 'invalid_request'
      return sendJson(res, statusForCode(code), { ok: false, code, diagnostic: buildDiagnostic(error, code) })
    }
  }
}
