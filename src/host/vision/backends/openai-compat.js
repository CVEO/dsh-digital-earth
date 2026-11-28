/**
 * host/vision/backends/openai-compat.js — standalone OpenAI-compatible HTTP VLM
 * backend adapter. Connects any OpenAI-compatible vision endpoint (hosted model
 * APIs, vLLM, SGLang, Ollama) independently of DSH's global chat model and without
 * relying on DSH static capability metadata.
 */
import { parseVisionBatchOutput, parseVisionOutput, visionError } from '../../../client/scene/vision-geometry.js'
import { classifyProviderError } from '../capability.js'
import { GROUND_SYSTEM, groundPrompt, parseGrounded } from '../grounded-instances.js'
import { INSTANCE_SYSTEM, instanceUserText, parseInstanceAnswer } from '../instances.js'
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
  const image = { type: 'image_url', image_url: { url: dataUrl } }
  const instruction = { type: 'text', text: userText }
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: system === GROUND_SYSTEM ? [image, instruction] : [instruction, image],
      },
    ],
    max_tokens: maxTokens,
    temperature: 0,
    stream: false,
  }

  // Servers that need a chat-template switch (for example a model whose reasoning
  // budget must be off for a JSON-only vision answer) declare it in the vision
  // configuration instead of being special-cased per hostname in this file.
  const templateKwargs = cfg.chatTemplateKwargs
  if (templateKwargs && typeof templateKwargs === 'object' && Object.keys(templateKwargs).length > 0) {
    body.chat_template_kwargs = { ...templateKwargs }
  }

  let responseJson
  try {
    responseJson = await postChatCompletion({ endpoint, apiKey: cfg.apiKey, body, signal, fetchImpl })
  } catch (error) {
    const classified = classifyProviderError(error)
    if (classified.retryableParamError && !signal?.aborted) {
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
      usage: responseJson?.usage,
      detail: sanitizeDiagnosticDetail(`Empty content from endpoint (finish_reason=${finishReason}).`),
    })
  }
  return { text, usage: responseJson?.usage ?? null, finish: responseJson?.choices?.[0]?.finish_reason ?? null }
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
      const { text } = await runOpenAiVisionCall(cfg, {
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
      const { text } = await runOpenAiVisionCall(cfg, {
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
    async extractInstances(input, signal) {
      assertConfigured()
      const grounded = ['locate', 'trace', 'trace_batch'].includes(input.mode)
      const { text, usage, finish } = await runOpenAiVisionCall(cfg, {
        system: grounded ? GROUND_SYSTEM : INSTANCE_SYSTEM,
        userText: grounded ? groundPrompt(input) : instanceUserText(input),
        input,
        // Instance answers are compact polygons; never go below the shared floor
        // even when the endpoint config asked for a smaller single-outline budget.
        maxTokens: input.maxTokens ?? (input.mode === 'trace' ? 768 : input.mode === 'trace_batch' ? 1100 : Math.max(cfg.maxTokens || 4096, 2400)),
        signal,
        fetchImpl,
      })
      try {
        if (finish === 'length') throw visionError('invalid_result', { stage:'parse', detail:'Instance answer reached the token limit.' })
        const shapes = grounded ? parseGrounded(text, input) : { instances: parseInstanceAnswer(text, input.classes) }
        return { ...shapes, usage, finish, backend:'openai-compat', provider:'openai-compat', model:cfg.model, capability:'supported' }
      } catch (error) {
        throw Object.assign(error, { usage })
      }
    },
  }
}
