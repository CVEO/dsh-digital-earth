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
import { createInstanceCache } from './instance-cache.js'
import { effectiveVisionConfig, modelRouteKey, visionModelDirectory } from './model-selection.js'
import { MAX_VISION_CONFIG_BODY } from '../constants.js'
import { sendJson, sendText } from '../http.js'
import { visionError } from '../../client/scene/vision-geometry.js'
import { defaultVisionBackends } from './backends/registry.js'
import { clearProbeCache } from './capability.js'
import { normalizeVisionConfig, readVisionConfig, redactVisionConfig, writeVisionConfig } from './config.js'
import { normalizeInstanceClasses } from './instances.js'
import { MAX_BODY, NEXT, sanitizeDiagnosticDetail } from './prompts.js'

const MAX_BATCH_CLASSES = 8
const MAX_BATCH_CLASS_CHARS = 16
const MAX_BATCH_CLASS_SCAN = 64
const MAX_VISION_TARGET_CHARS = 24

export function imageDimensions(data, mediaType) {
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

export function decodeImagePayload(payload) {
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

/**
 * Normalize the optional user target category/name for single-target outlines.
 * Same de-fanging as batch classes (strip control characters, quotes and
 * backticks, collapse whitespace), bounded to 24 characters; anything invalid or
 * empty is dropped instead of failing the request, so the prompt falls back to
 * the neutral "the clicked object" wording.
 */
function normalizeVisionTarget(raw) {
  if (typeof raw !== 'string') return ''
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/["'`\u201c\u201d\u2018\u2019]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned || [...cleaned].length > MAX_VISION_TARGET_CHARS) return ''
  return cleaned
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
    target: normalizeVisionTarget(payload.target),
    force: payload.force === true,
  }
}

/**
 * Normalize one requested class label. Classes are free-form user labels in any
 * language, so this only bounds and de-fangs them: strip control characters,
 * newlines, quotes and backticks (prompt-injection / JSON-breakout surface),
 * collapse whitespace, and drop labels that are empty or too long.
 */
function normalizeBatchClass(raw) {
  if (typeof raw !== 'string') return ''
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/["'`\u201c\u201d\u2018\u2019]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned || [...cleaned].length > MAX_BATCH_CLASS_CHARS) return ''
  return cleaned
}

/**
 * Validation (not whitelisting): arbitrary user classes are accepted, bounded to
 * 8 entries, deduplicated case-insensitively (first spelling wins), and invalid
 * entries are dropped instead of failing the whole request. An empty result
 * means "no class restriction".
 */
function normalizeBatchClasses(rawClasses) {
  if (!Array.isArray(rawClasses)) return []
  const classes = []
  const seen = new Set()
  for (const raw of rawClasses.slice(0, MAX_BATCH_CLASS_SCAN)) {
    if (classes.length >= MAX_BATCH_CLASSES) break
    const label = normalizeBatchClass(raw)
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    classes.push(label)
  }
  return classes
}

export function validateVisionBatchRequest(payload) {
  if (!payload || typeof payload.frameId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(payload.frameId)) {
    throw visionError('invalid_request', { stage: 'validate', detail: 'Invalid batch frameId.' })
  }
  const scope = payload.scope === 'aoi' ? 'aoi' : 'view'
  return {
    ...decodeImagePayload(payload),
    frameId: payload.frameId,
    scope,
    classes: normalizeBatchClasses(payload.classes),
    force: payload.force === true,
  }
}

export function validateVisionInstancesRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw visionError('invalid_request', { stage: 'validate', detail: 'Vision instances body must be a JSON object.' })
  }
  const mode = payload.mode === undefined || payload.mode === null ? 'polygon' : payload.mode
  if (!['polygon', 'locate', 'trace', 'trace_batch'].includes(mode)) {
    throw visionError('invalid_request', { stage: 'validate', detail: "Expected polygon, locate or trace." })
  }
  // classes/maxTokens are normalized by the shared instance protocol module so
  // the HTTP route and the pure parser agree on bounds and de-fanging.
  const { classes, maxTokens } = normalizeInstanceClasses(payload)
  let slots
  if (mode === 'trace_batch') {
    slots = payload.slots
    if (!Array.isArray(slots) || slots.length < 2 || slots.length > 4 ||
        !slots.every(id => classes.some(cls => cls.id === id))) throw visionError('invalid_request', { stage: 'validate' })
  }
  if (mode === 'trace' && classes.length !== 1) throw visionError('invalid_request', { stage: 'validate' })
  return {
    ...decodeImagePayload(payload),
    classes,
    mode,
    ...(slots ? { slots } : {}),
    ...(mode === 'locate' && payload.namedLabels === true ? { namedLabels: true } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
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
  const cache = panelHeader === 'vision-instances' ? createInstanceCache() : null

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
      const saved = await loadConfig()
      const instances = panelHeader === 'vision-instances'
      const config = instances ? await effectiveVisionConfig(ctx, getService, saved, req.headers?.['x-dsh-session'], controller.signal) : saved
      const route = instances ? modelRouteKey(config) : null
      if (instances && req.headers?.['x-dsh-model-route'] && req.headers['x-dsh-model-route'] !== route) {
        throw visionError('model_changed')
      }
      const backend = backends.resolve({ ctx, getService, config, fetchImpl })
      backendId = backend.id
      if (req.method === 'GET') {
        return await backend.probe(controller.signal, { force: queryForceFlag(req) })
      }
      const payload = await readJsonBody(req, MAX_BODY, controller.signal)
      const input = validate(payload)
      const key = cache && req.headers?.['x-dsh-reuse'] === '1'
        ? cache.key(route, req.headers?.['x-dsh-session'] ?? '', input, config) : null
      if (key) {
        const previous = cache.get(key)
        if (previous) return { ok:true, ...previous, modelRoute:route }
      }
      const slot = limiter.acquire()
      activeSlot = slot
      try {
        const result = await runBackend(backend, input, controller.signal)
        if (key && !controller.signal.aborted) cache.put(key, result)
        // Single-target and batch responses carry the frameId; the instances
        // route omits it instead of emitting an undefined placeholder.
        return { ok: true, ...(input.frameId ? { frameId: input.frameId } : {}), ...result, ...(instances ? { modelRoute: route } : {}) }
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
          ...(Number.isSafeInteger(error?.usage?.total_tokens) && error.usage.total_tokens >= 0
            ? { usage:{ total_tokens:error.usage.total_tokens } } : {}),
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

export function createVisionInstancesHandler(ctx, options = {}) {
  return makeVisionRouteHandler(ctx, {
    panelHeader: 'vision-instances',
    maxConcurrent: 1,
    timeoutMs: 90000,
    ...options,
    validate: validateVisionInstancesRequest,
    runBackend: (backend, input, signal) => {
      if (typeof backend.extractInstances !== 'function') {
        throw Object.assign(visionError('unavailable'), {
          stage: 'backend',
          backend: backend.id,
          detail: 'The active vision backend does not implement instance segmentation.',
        })
      }
      return backend.extractInstances(input, signal, { force: input.force })
    },
  })
}

export function createVisionConfigHandler(ctx, {
  getService,
  backends = defaultVisionBackends,
  loadConfig = readVisionConfig,
  saveConfig = writeVisionConfig,
  fetchImpl = globalThis.fetch,
} = {}) {
  async function describe(config, sessionId) {
    const signal = AbortSignal.timeout(10000)
    let backend, probe
    try {
      const effective = await effectiveVisionConfig(ctx, getService, config, sessionId, signal)
      backend = backends.resolve({ ctx, getService, config:effective, fetchImpl })
      probe = await backend.probe(signal, { force:false })
    } catch (error) {
      const code = Object.hasOwn(NEXT, error?.code) ? error.code : 'model_failed'
      probe = { ok:false, code, next:NEXT[code], diagnostic:buildDiagnostic(error, code, backend?.id) }
    }
    return { ok:true, config:redactVisionConfig(config), probe, modes:backends.modes() }
  }

  return async function visionConfigHandler(req, res) {
    if (!['GET', 'PUT'].includes(req.method)) return sendText(res, 405, 'method not allowed')
    if (req.method === 'PUT' && req.headers?.['x-dsh-panel'] !== 'vision-config') return sendText(res, 403, 'forbidden')
    try {
      if (req.method === 'GET') {
        if (req.headers?.['x-dsh-panel'] === 'vision-model-directory') {
          return sendJson(res, 200, { ok: true, directory: await visionModelDirectory(ctx, getService) })
        }
        return sendJson(res, 200, await describe(await loadConfig(), req.headers?.['x-dsh-session']))
      }
      const existing = await loadConfig()
      const raw = await readJsonBody(req, MAX_VISION_CONFIG_BODY)
      const next = normalizeVisionConfig(raw, existing)
      if ((next.mode === 'dsh-model' && (!next.dshModel.provider || !next.dshModel.model)) ||
          (next.mode === 'openai-compat' && (!next.openaiCompat.baseUrl || !next.openaiCompat.model))) {
        throw visionError('invalid_request')
      }
      const saved = await saveConfig(next)
      clearProbeCache()
      return sendJson(res, 200, await describe(saved, req.headers?.['x-dsh-session']))
    } catch (error) {
      const code = Object.hasOwn(NEXT, error?.code) ? error.code : 'invalid_request'
      return sendJson(res, statusForCode(code), { ok: false, code, diagnostic: buildDiagnostic(error, code) })
    }
  }
}
