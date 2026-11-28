/**
 * host/vision/capability.js — three-state model capability probing, error
 * classification, and short-lived probe caching so third-party / custom
 * providers (OpenAI-compatible relays, self-hosted servers) are never
 * prematurely blocked by missing DSH static metadata.
 */
import { visionError } from '../../client/scene/vision-geometry.js'
import { sanitizeDiagnosticDetail } from './prompts.js'

const PROBE_CACHE_TTL_MS = 5 * 60 * 1000
const probeCache = new Map()

export function clearProbeCache() {
  probeCache.clear()
}

export function probeCacheKey(provider, model) {
  return `${provider ?? ''}::${model ?? ''}`
}

export function recordProbeOutcome(provider, model, supported, reason = '') {
  if (!provider || !model) return
  probeCache.set(probeCacheKey(provider, model), {
    supported: Boolean(supported),
    reason: sanitizeDiagnosticDetail(reason, 160),
    at: Date.now(),
  })
}

export function readProbeOutcome(provider, model) {
  if (!provider || !model) return null
  const entry = probeCache.get(probeCacheKey(provider, model))
  if (!entry) return null
  if (Date.now() - entry.at > PROBE_CACHE_TTL_MS) {
    probeCache.delete(probeCacheKey(provider, model))
    return null
  }
  return entry
}

export function lookupService(ctx, name, getService) {
  if (typeof getService === 'function') {
    try {
      const value = getService(name)
      if (value) return value
    } catch {
      /* fall through to ctx lookup */
    }
  }
  try {
    return ctx?.get?.(name, false) ?? ctx?.[name] ?? null
  } catch {
    return null
  }
}

function errorText(error) {
  if (!error) return ''
  const parts = [
    error.code,
    error.status,
    error.message,
    typeof error.data === 'string' ? error.data : error.data ? JSON.stringify(error.data) : '',
    typeof error.details === 'string' ? error.details : error.details ? JSON.stringify(error.details) : '',
  ]
  return parts.filter(Boolean).join(' ')
}

/**
 * Inspect a downstream provider/HTTP error and classify it into an actionable
 * vision error code + diagnostic detail + whether a parameter-stripped retry
 * is safe.
 */
export function classifyProviderError(error) {
  if (error?.code && ['unavailable', 'model_not_visual', 'model_unknown', 'busy', 'timeout', 'cancelled', 'no_target', 'invalid_result', 'invalid_request', 'too_large'].includes(error.code)) {
    return {
      code: error.code,
      detail: sanitizeDiagnosticDetail(error.detail || error.message || error.code),
      retryableParamError: false,
    }
  }
  if (error?.name === 'AbortError') {
    return { code: 'cancelled', detail: 'Request aborted.', retryableParamError: false }
  }
  const text = errorText(error)
  if (/MODEL_DOES_NOT_SUPPORT_IMAGES|does not support image|image_url.*not support|not support.*image|vision.*not support|multimodal.*not support|cannot process image|invalid content type.*image/i.test(text)) {
    return {
      code: 'model_not_visual',
      detail: sanitizeDiagnosticDetail(text || 'Provider reported that this model does not accept image inputs.'),
      retryableParamError: false,
    }
  }
  const status = Number(error?.status ?? error?.statusCode ?? 0)
  const isParamReject = (status === 400 || /\b400\b|invalid_request_error|unsupported parameter|unknown parameter/i.test(text)) &&
    /\b(temperature|reasoning_effort|reasoningEffort|max_completion_tokens)\b/i.test(text)
  if (isParamReject) {
    return {
      code: 'model_failed',
      detail: sanitizeDiagnosticDetail(text),
      retryableParamError: true,
    }
  }
  if (/timed? ?out|ETIMEDOUT|ECONNRESET/i.test(text)) {
    return {
      code: 'timeout',
      detail: sanitizeDiagnosticDetail(text || 'Upstream model connection timed out.'),
      retryableParamError: false,
    }
  }
  return {
    code: 'model_failed',
    detail: sanitizeDiagnosticDetail(text || 'Upstream vision model call failed.'),
    retryableParamError: false,
  }
}

/**
 * Resolve a DSH-managed model with three-state capability detection:
 *   - 'supported': metadata explicitly lists 'image' in inputModalities
 *   - 'unknown':   metadata missing / resolveModelInfo failed -> allow optimistic call
 *   - 'unsupported': metadata explicitly excludes 'image' -> reject unless `force` is true
 */
export async function resolveDshVisionModel(ctx, signal, getService, options = {}) {
  const { overrideSelection = null, force = false, allowUnverified = true } = options
  const llm = lookupService(ctx, 'llm', getService)
  const attachments = lookupService(ctx, 'attachments', getService)
  const defaults = lookupService(ctx, 'agentDefaultModel', getService)
  if (typeof llm?.stream !== 'function' || !(typeof attachments?.saveImage === 'function' || typeof attachments?.saveImages === 'function')) {
    throw Object.assign(visionError('unavailable'), {
      stage: 'probe',
      detail: 'Host llm or attachments service is unavailable (expected saveImage or saveImages).',
    })
  }
  let selection = overrideSelection
  if (!selection?.provider || !selection?.model) {
    if (typeof defaults?.currentSelection !== 'function') {
      throw Object.assign(visionError('unavailable'), {
        stage: 'probe',
        detail: 'Host agentDefaultModel service is unavailable.',
      })
    }
    selection = await defaults.currentSelection()
  }
  if (typeof selection?.provider !== 'string' || !selection.provider || typeof selection?.model !== 'string' || !selection.model) {
    throw Object.assign(visionError('model_unknown'), {
      stage: 'probe',
      detail: 'No active model is selected in DSH.',
    })
  }

  let info = null
  if (typeof llm.resolveModelInfo === 'function') {
    try {
      info = await llm.resolveModelInfo(selection.provider, selection.model, signal)
    } catch {
      info = null
    }
  }

  let capability = 'unknown'
  const warnings = []
  if (Array.isArray(info?.inputModalities)) {
    if (info.inputModalities.includes('image')) {
      capability = 'supported'
    } else {
      capability = 'unsupported'
    }
  } else {
    warnings.push('modality_undeclared')
  }

  const cached = readProbeOutcome(selection.provider, selection.model)
  if (cached && cached.supported === false && !force) {
    throw Object.assign(visionError('model_not_visual'), {
      stage: 'probe',
      provider: selection.provider,
      model: selection.model,
      canForce: true,
      detail: cached.reason || 'Previous attempt reported this model does not support images.',
    })
  }

  if (capability === 'unsupported' && !force) {
    throw Object.assign(visionError('model_not_visual'), {
      stage: 'probe',
      provider: selection.provider,
      model: selection.model,
      canForce: true,
      detail: 'Model metadata does not declare image input.',
    })
  }
  if (capability === 'unknown' && !allowUnverified && !force) {
    throw Object.assign(visionError('model_unknown'), {
      stage: 'probe',
      provider: selection.provider,
      model: selection.model,
      canForce: true,
      detail: 'Model metadata did not declare inputModalities.',
    })
  }
  if (capability === 'unsupported' && force) {
    warnings.push('modality_forced')
  }

  const efforts = Array.isArray(info?.reasoning?.efforts) ? info.reasoning.efforts : []
  const effort = ['off', 'none', 'disabled', 'minimal', 'low'].find((id) => efforts.some((item) => item?.id === id))

  return {
    llm,
    attachments,
    provider: selection.provider,
    model: selection.model,
    capability,
    warnings,
    ...(effort ? { reasoningEffort: effort } : {}),
  }
}
