/**
 * host/vision/backends/registry.js — extensible backend registry.
 *
 * Built-in modes:
 *   - 'dsh-default' / 'dsh-model' -> dsh-llm adapter
 *   - 'openai-compat'             -> standalone OpenAI-compatible HTTP VLM adapter
 *
 * Future extensions (e.g. Phase 3 'sam-http' or 'vlm+sam' composite pipeline)
 * register here via `registerVisionBackend(mode, factory)` without modifying
 * HTTP handlers or frontend Cesium projection code.
 */
import { createDshLlmBackend } from './dsh-llm.js'
import { createOpenAiCompatBackend } from './openai-compat.js'

const factories = new Map([
  ['dsh-default', (deps) => createDshLlmBackend(deps)],
  ['dsh-model', (deps) => createDshLlmBackend(deps)],
  ['openai-compat', (deps) => createOpenAiCompatBackend(deps)],
])

export function createVisionBackendRegistry(extra = null) {
  const local = new Map(factories)
  if (extra && typeof extra === 'object') {
    for (const [mode, factory] of Object.entries(extra)) {
      if (typeof factory === 'function') local.set(mode, factory)
    }
  }
  return {
    register(mode, factory) {
      if (typeof mode === 'string' && mode && typeof factory === 'function') local.set(mode, factory)
    },
    modes() {
      return [...local.keys()]
    },
    resolve({ ctx, getService, config, fetchImpl }) {
      const mode = config?.mode && local.has(config.mode) ? config.mode : 'dsh-default'
      const factory = local.get(mode)
      return factory({ ctx, getService, config, fetchImpl })
    },
  }
}

export const defaultVisionBackends = createVisionBackendRegistry()
