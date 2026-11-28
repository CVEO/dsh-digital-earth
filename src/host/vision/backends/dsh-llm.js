/**
 * host/vision/backends/dsh-llm.js — VisionBackend adapter for DSH's built-in
 * `llm.stream` + `attachments.saveImage` services (supports both default chat
 * model and an explicit DSH provider/model override).
 */
import { parseVisionBatchOutput, parseVisionOutput, visionError } from '../../../client/scene/vision-geometry.js'
import { classifyProviderError, recordProbeOutcome, resolveDshVisionModel } from '../capability.js'
import { GROUND_SYSTEM, groundPrompt, parseGrounded } from '../grounded-instances.js'
import { INSTANCE_SYSTEM, instanceUserText, parseInstanceAnswer } from '../instances.js'
import { BATCH_SYSTEM, SINGLE_SYSTEM, buildBatchUserText, buildSingleUserText } from '../prompts.js'
import { streamVisionText } from '../stream-util.js'

async function saveVisionAttachment(model, input, name, signal) {
  // DSH 0.2.2+ exposes saveImages([{data,mediaType}]) and returns refs in order;
  // older hosts exposed saveImage({data,mediaType,name}). Support both so a
  // plugin update does not break when the host attachment service changes.
  let attachment
  if (typeof model.attachments.saveImage === 'function') {
    attachment = await model.attachments.saveImage({ data: input.data, mediaType: input.mediaType, name })
  } else if (typeof model.attachments.saveImages === 'function') {
    const refs = await model.attachments.saveImages([{ data: input.data, mediaType: input.mediaType }])
    attachment = Array.isArray(refs) ? refs[0] : null
  }
  signal.throwIfAborted()
  if (
    !attachment ||
    ![attachment.width, attachment.height].every((size) => Number.isFinite(size) && size > 0) ||
    Math.abs(attachment.width / attachment.height - input.width / input.height) > 0.01
  ) {
    throw Object.assign(visionError('model_failed'), {
      stage: 'attachment',
      provider: model.provider,
      model: model.model,
      detail: 'Attachment storage returned invalid or distorted image dimensions.',
    })
  }
  return attachment
}

export async function callVisionWithDshModel(model, input, signal) {
  const attachment = await saveVisionAttachment(model, input, 'digital-earth-vision', signal)
  // Keep 1200 maxTokens when reasoning is explicitly disabled; raise budget to
  // 4096 for thinking/custom models that do not expose reasoningEffort=off.
  const maxTokens = model.reasoningEffort ? 1200 : 4096
  const maxTotalBytes = model.reasoningEffort ? 32768 : 131072
  try {
    const text = await streamVisionText(model, {
      system: SINGLE_SYSTEM,
      maxTokens,
      maxTextChars: 8192,
      maxTotalBytes,
      signal,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildSingleUserText(input) },
          { type: 'image', attachment },
        ],
      }],
    })
    recordProbeOutcome(model.provider, model.model, true)
    return parseVisionOutput(text, input.point, { width: input.width, height: input.height })
  } catch (error) {
    const classified = classifyProviderError(error)
    if (classified.code === 'model_not_visual') {
      recordProbeOutcome(model.provider, model.model, false, classified.detail)
    }
    throw Object.assign(visionError(classified.code), {
      stage: error?.stage ?? 'stream',
      provider: model.provider,
      model: model.model,
      detail: error?.detail ?? classified.detail,
    })
  }
}

export async function callVisionBatchWithDshModel(model, input, signal) {
  const attachment = await saveVisionAttachment(model, input, 'digital-earth-vision-batch', signal)
  const maxTokens = model.reasoningEffort ? 2000 : 6000
  const maxTotalBytes = model.reasoningEffort ? 65536 : 196608
  try {
    const text = await streamVisionText(model, {
      system: BATCH_SYSTEM,
      maxTokens,
      maxTextChars: 16384,
      maxTotalBytes,
      signal,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildBatchUserText(input) },
          { type: 'image', attachment },
        ],
      }],
    })
    recordProbeOutcome(model.provider, model.model, true)
    return parseVisionBatchOutput(text, { width: input.width, height: input.height })
  } catch (error) {
    const classified = classifyProviderError(error)
    if (classified.code === 'model_not_visual') {
      recordProbeOutcome(model.provider, model.model, false, classified.detail)
    }
    throw Object.assign(visionError(classified.code), {
      stage: error?.stage ?? 'stream',
      provider: model.provider,
      model: model.model,
      detail: error?.detail ?? classified.detail,
    })
  }
}

export async function callVisionInstancesWithDshModel(model, input, signal) {
  const attachment = await saveVisionAttachment(model, input, 'digital-earth-vision-instances', signal)
  // Polygon instance answers are compact even for a dense tile; thinking models
  // keep a smaller budget because their reasoning tokens share the same cap.
  const grounded = ['locate', 'trace', 'trace_batch'].includes(input.mode)
  const maxTokens = input.maxTokens ?? (model.reasoningEffort ? 1600 : 2400)
  let usage = null
  const maxTotalBytes = model.reasoningEffort ? 65536 : 196608
  try {
    const text = await streamVisionText(model, {
      onUsage: value => { usage = value },
      system: grounded ? GROUND_SYSTEM : INSTANCE_SYSTEM,
      maxTokens,
      maxTextChars: 16384,
      maxTotalBytes,
      signal,
      messages: [{
        role: 'user',
        content: [
          ...(grounded ? [
            { type: 'image', attachment },
            { type: 'text', text: groundPrompt(input) },
          ] : [
            { type: 'text', text: instanceUserText(input) },
            { type: 'image', attachment },
          ]),
        ],
      }],
    })
    recordProbeOutcome(model.provider, model.model, true)
    const shapes = grounded ? parseGrounded(text, input) : { instances: parseInstanceAnswer(text, input.classes) }
    return { ...shapes, usage, finish: 'stop' }
  } catch (error) {
    const classified = classifyProviderError(error)
    if (classified.code === 'model_not_visual') {
      recordProbeOutcome(model.provider, model.model, false, classified.detail)
    }
    throw Object.assign(visionError(classified.code), {
      stage: error?.stage ?? 'stream',
      provider: model.provider,
      model: model.model,
      detail: error?.detail ?? classified.detail,
      usage,
    })
  }
}

export function createDshLlmBackend({ ctx, getService, config }) {
  const overrideSelection = config?.mode === 'dsh-model' && config?.dshModel?.provider && config?.dshModel?.model
    ? config.dshModel
    : null
  const allowUnverified = config?.allowUnverifiedModalities !== false

  return {
    id: 'dsh-llm',
    async probe(signal, { force = false } = {}) {
      const model = await resolveDshVisionModel(ctx, signal, getService, { overrideSelection, force, allowUnverified })
      return {
        ok: true,
        backend: 'dsh-llm',
        provider: model.provider,
        model: model.model,
        capability: model.capability,
        warnings: model.warnings,
      }
    },
    async extractSingle(input, signal, { force = false } = {}) {
      const model = await resolveDshVisionModel(ctx, signal, getService, { overrideSelection, force, allowUnverified })
      signal.throwIfAborted()
      const result = await callVisionWithDshModel(model, input, signal)
      return {
        ...result,
        backend: 'dsh-llm',
        provider: model.provider,
        model: model.model,
        capability: model.capability,
      }
    },
    async extractBatch(input, signal, { force = false } = {}) {
      const model = await resolveDshVisionModel(ctx, signal, getService, { overrideSelection, force, allowUnverified })
      signal.throwIfAborted()
      const result = await callVisionBatchWithDshModel(model, input, signal)
      return {
        ...result,
        backend: 'dsh-llm',
        provider: model.provider,
        model: model.model,
        capability: model.capability,
      }
    },
    async extractInstances(input, signal, { force = false } = {}) {
      const model = await resolveDshVisionModel(ctx, signal, getService, { overrideSelection, force, allowUnverified })
      signal.throwIfAborted()
      const result = await callVisionInstancesWithDshModel(model, input, signal)
      return {
        ...result,
        backend: 'dsh-llm',
        provider: model.provider,
        model: model.model,
        capability: model.capability,
      }
    },
  }
}
