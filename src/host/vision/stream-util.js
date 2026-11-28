/**
 * host/vision/stream-util.js — resilient DSH `llm.stream` consumer shared by
 * single-target and batch vision calls.
 *
 * Fixes cross-provider incompatibilities:
 *   - ignores trailing usage/metadata chunks arriving after `finish`
 *   - raises token/reasoning byte budgets for thinking models lacking reasoningEffort=off
 *   - accepts stop / end_turn / eos / completed finish reasons
 *   - performs one parameter-stripped retry if a gateway rejects temperature or reasoningEffort (HTTP 400)
 */
import { visionError } from '../../client/scene/vision-geometry.js'
import { classifyProviderError } from './capability.js'

const NORMAL_FINISH_KINDS = new Set(['stop', 'end_turn', 'eos', 'completed'])

async function consumeStreamOnce(llm, requestOptions, { signal, maxTextChars, maxTotalBytes, onUsage }) {
  const blocks = new Map()
  let totalBytes = 0
  let finished = false
  let finishKind = null
  const stream = llm.stream(requestOptions)

  for await (const chunk of stream) {
    signal.throwIfAborted()
    if (!chunk || typeof chunk !== 'object') continue
    if (chunk.type === 'tool-call-delta' || chunk.blockType === 'tool-call' || chunk.block?.type === 'tool-call') {
      throw Object.assign(visionError('invalid_result'), {
        stage: 'stream',
        detail: 'Model attempted a tool call during direct vision extraction.',
      })
    }
    if (chunk.type === 'usage') {
      const total = chunk.usage?.totalTokens
      if (Number.isSafeInteger(total) && total >= 0) onUsage?.({ total_tokens:total })
      continue
    }
    // Many OpenAI-compatible relays emit a trailing `usage` / `metadata` event
    // after `finish`; ignore benign post-finish events while still rejecting tool calls.
    if (finished) {
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string' && chunk.text.length > 0) {
        throw Object.assign(visionError('invalid_result'), {
          stage: 'stream',
          detail: 'Unexpected text chunk received after finish event.',
        })
      }
      continue
    }

    if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
      totalBytes += typeof chunk.text === 'string' ? chunk.text.length : 0
      if (totalBytes > maxTotalBytes) {
        throw Object.assign(visionError('invalid_result'), {
          stage: 'stream',
          detail: 'Model stream output exceeded safety byte budget.',
        })
      }
      if (chunk.type === 'text-delta') {
        if (typeof chunk.text !== 'string') {
          throw Object.assign(visionError('invalid_result'), {
            stage: 'stream',
            detail: 'Malformed non-string text-delta chunk.',
          })
        }
        blocks.set(chunk.index ?? 0, (blocks.get(chunk.index ?? 0) ?? '') + chunk.text)
      }
    }
    if (chunk.type === 'block-end' && chunk.block?.type === 'text') {
      if (typeof chunk.block.text !== 'string' || chunk.block.text.length > maxTextChars) {
        throw Object.assign(visionError('invalid_result'), {
          stage: 'stream',
          detail: 'Model text block exceeded length limit.',
        })
      }
      blocks.set(chunk.index ?? 0, chunk.block.text)
    }
    if ([...blocks.values()].reduce((total, text) => total + text.length, 0) > maxTextChars) {
      throw Object.assign(visionError('invalid_result'), {
        stage: 'stream',
        detail: 'Combined model text exceeded length limit.',
      })
    }
    if (chunk.type === 'finish') {
      finishKind = typeof chunk.reason?.kind === 'string' ? chunk.reason.kind.toLowerCase() : ''
      if (finishKind === 'aborted') {
        throw Object.assign(visionError('cancelled'), { stage: 'stream', detail: 'Model stream aborted.' })
      }
      if (!NORMAL_FINISH_KINDS.has(finishKind)) {
        throw Object.assign(visionError('model_failed'), {
          stage: 'stream',
          detail: finishKind === 'max-tokens' || finishKind === 'length'
            ? 'Model output truncated at max_tokens (thinking model may need a higher token budget).'
            : `Model finished with unexpected reason: ${finishKind || 'unknown'}.`,
        })
      }
      finished = true
    }
  }

  if (!finished) {
    throw Object.assign(visionError('model_failed'), {
      stage: 'stream',
      detail: 'Model stream ended before emitting a finish event.',
    })
  }
  return [...blocks.values()].join('')
}

/**
 * Execute one DSH `llm.stream` call with automatic parameter fallback when a
 * gateway rejects `temperature` or `reasoningEffort` (HTTP 400).
 */
export async function streamVisionText(model, { system, messages, maxTokens, maxTextChars, maxTotalBytes, signal, onUsage }) {
  const baseOptions = {
    provider: model.provider,
    model: model.model,
    ...(model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {}),
    system,
    maxTokens,
    temperature: 0,
    signal,
    messages,
  }
  try {
    return await consumeStreamOnce(model.llm, baseOptions, { signal, maxTextChars, maxTotalBytes, onUsage })
  } catch (error) {
    const classified = classifyProviderError(error)
    if (classified.retryableParamError && !signal.aborted) {
      const stripped = {
        provider: model.provider,
        model: model.model,
        system,
        maxTokens,
        signal,
        messages,
      }
      return await consumeStreamOnce(model.llm, stripped, { signal, maxTextChars, maxTotalBytes, onUsage })
    }
    if (error?.code) throw error
    throw Object.assign(visionError(classified.code), {
      stage: 'stream',
      provider: model.provider,
      model: model.model,
      detail: classified.detail,
    })
  }
}
