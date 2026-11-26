/**
 * host/vision/backends/openai-compat.js — standalone OpenAI-compatible HTTP VLM
 * backend adapter. Allows connecting supercomputing DeepSeek, MiMo 2.6 Flash,
 * Qwen-VL, vLLM, SGLang, or Ollama vision endpoints independently of DSH's
 * global chat model and without relying on DSH static capability metadata.
 */
import { parseVisionBatchOutput, parseVisionOutput, visionError } from '../../../client/scene/vision-geometry.js'
import { classifyProviderError } from '../capability.js'
import { BATCH_SYSTEM, SINGLE_SYSTEM, buildBatchUserText, buildSingleUserText, sanitizeDiagnosticDetail } from '../prompts.js'

function chatCompletionsUrl(baseUrl) {
  const clean = String(baseUrl || '').replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(clean)) return clean
  return `${clean}/chat/completions`
}

function extractMessageText(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null
  const content = choice?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
      .join('')
  }
  return ''
}

async function postChatCompletion({ endpoint, apiKey, body, signal, fetchImpl }) {
  const headers = { 'content-type': 'application/json' }
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  const rawText = await response.text().catch(() => '')
  let parsed = null
  try { parsed = JSON.parse(rawText) } catch { /* non-JSON error body */ }
  if (!response.ok) {
    const errMsg = parsed?.error?.message || parsed?.message || rawText || `HTTP ${response.status}`
    const err = new Error(`HTTP ${response.status}: ${errMsg}`)
    err.status = response.status
    throw err
  }
  return parsed
}

async function runOpenAiVisionCall(cfg, { system, userText, input, maxTokens, signal, fetchImpl }) {
  const endpoint = chatCompletionsUrl(cfg.baseUrl)
  const dataUrl = `data:${input.mediaType};base64,${input.data.toString('base64')}`
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: maxTokens,
    temperature: 0,
    stream: false,
  }

  let responseJson
  try {
    responseJson = await postChatCompletion({ endpoint, apiKey: cfg.apiKey, body, signal, fetchImpl })
  } catch (error) {
    const classified = classifyProviderError(error)
    if (classified.retryableParamError && !signal.aborted) {
      const retryBody = { ...body }
      delete retryBody.temperature
      responseJson = await postChatCompletion({ endpoint, apiKey: cfg.apiKey, body: retryBody, signal, fetchImpl })
    } else {
      throw Object.assign(visionError(classified.code), {
        stage: 'stream',
        backend: 'openai-compat',
        provider: 'openai-compat',
        model: cfg.model,
        detail: classified.detail,
      })
    }
  }

  const text = extractMessageText(responseJson)
  if (!text) {
    const finishReason = responseJson?.choices?.[0]?.finish_reason ?? 'unknown'
    throw Object.assign(visionError('model_failed'), {
      stage: 'parse',
      backend: 'openai-compat',
      provider: 'openai-compat',
      model: cfg.model,
      detail: sanitizeDiagnosticDetail(`Empty content from endpoint (finish_reason=${finishReason}).`),
    })
  }
  return text
}

export function createOpenAiCompatBackend({ config, fetchImpl = globalThis.fetch }) {
  const cfg = config?.openaiCompat ?? {}

  function assertConfigured() {
    if (!cfg.baseUrl || !cfg.model) {
      throw Object.assign(visionError('model_unknown'), {
        stage: 'probe',
        backend: 'openai-compat',
        provider: 'openai-compat',
        model: cfg.model || '',
        detail: 'OpenAI-compatible vision endpoint requires both baseUrl and model.',
      })
    }
    if (typeof fetchImpl !== 'function') {
      throw Object.assign(visionError('unavailable'), {
        stage: 'probe',
        backend: 'openai-compat',
        detail: 'Fetch API is unavailable in host runtime.',
      })
    }
  }

  return {
    id: 'openai-compat',
    async probe() {
      assertConfigured()
      return {
        ok: true,
        backend: 'openai-compat',
        provider: 'openai-compat',
        model: cfg.model,
        capability: 'unknown',
        warnings: ['external_endpoint'],
      }
    },
    async extractSingle(input, signal) {
      assertConfigured()
      const text = await runOpenAiVisionCall(cfg, {
        system: SINGLE_SYSTEM,
        userText: buildSingleUserText(input),
        input,
        maxTokens: cfg.maxTokens || 4096,
        signal,
        fetchImpl,
      })
      const parsed = parseVisionOutput(text, input.point, {
        width: input.width,
        height: input.height,
        coordSpace: cfg.coordSpace || 'auto',
      })
      return { ...parsed, backend: 'openai-compat', provider: 'openai-compat', model: cfg.model, capability: 'supported' }
    },
    async extractBatch(input, signal) {
      assertConfigured()
      const text = await runOpenAiVisionCall(cfg, {
        system: BATCH_SYSTEM,
        userText: buildBatchUserText(input),
        input,
        maxTokens: Math.max(cfg.maxTokens || 4096, 6000),
        signal,
        fetchImpl,
      })
      const parsed = parseVisionBatchOutput(text, {
        width: input.width,
        height: input.height,
        coordSpace: cfg.coordSpace || 'auto',
      })
      return { ...parsed, backend: 'openai-compat', provider: 'openai-compat', model: cfg.model, capability: 'supported' }
    },
  }
}
