/**
 * host/vision.js — backward-compatible facade over the modular `src/host/vision/`
 * engine (three-state capability probing, pluggable vision backends, thinking-model
 * & OpenAI-compatible stream support, and structured diagnostics).
 */
export {
  INSTANCE_SYSTEM,
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
  createVisionInstancesHandler,
  defaultVisionBackends,
  defaultVisionConfig,
  instanceUserText,
  normalizeInstanceClasses,
  normalizeVisionConfig,
  parseInstanceAnswer,
  parseVisionBatchOutput,
  parseVisionOutput,
  readVisionConfig,
  redactVisionConfig,
  resolveVisionModel,
  validateVisionBatchRequest,
  validateVisionInstancesRequest,
  validateVisionRequest,
  writeVisionConfig,
} from './vision/index.js'
