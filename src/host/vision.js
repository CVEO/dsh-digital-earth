/**
 * host/vision.js — backward-compatible facade over the modular `src/host/vision/`
 * engine (three-state capability probing, pluggable vision backends, thinking-model
 * & OpenAI-compatible stream support, and structured diagnostics).
 */
export {
  MAX_BATCH_OBJECTS,
  callVision,
  callVisionBatch,
  classifyProviderError,
  clearProbeCache,
  createDshLlmBackend,
  createOpenAiCompatBackend,
  createVisionBackendRegistry,
  createVisionBatchHandler,
  createVisionConfigHandler,
  createVisionHandler,
  defaultVisionBackends,
  defaultVisionConfig,
  normalizeVisionConfig,
  parseVisionBatchOutput,
  parseVisionOutput,
  readVisionConfig,
  redactVisionConfig,
  resolveVisionModel,
  validateVisionBatchRequest,
  validateVisionRequest,
  writeVisionConfig,
} from './vision/index.js'
