/**
 * host/vision/index.js — public entry point for the modular vision engine.
 */
export { MAX_BATCH_OBJECTS } from './prompts.js'
export { parseVisionBatchOutput, parseVisionOutput } from '../../client/scene/vision-geometry.js'
export { clearProbeCache, classifyProviderError, resolveDshVisionModel as resolveVisionModel } from './capability.js'
export { defaultVisionConfig, normalizeVisionConfig, readVisionConfig, redactVisionConfig, writeVisionConfig } from './config.js'
export { callVisionBatchWithDshModel as callVisionBatch, callVisionWithDshModel as callVision, createDshLlmBackend } from './backends/dsh-llm.js'
export { createOpenAiCompatBackend } from './backends/openai-compat.js'
export { createVisionBackendRegistry, defaultVisionBackends } from './backends/registry.js'
export { INSTANCE_SYSTEM, instanceUserText, normalizeInstanceClasses, parseInstanceAnswer } from './instances.js'
export { createVisionBatchHandler, createVisionConfigHandler, createVisionHandler, createVisionInstancesHandler, validateVisionBatchRequest, validateVisionInstancesRequest, validateVisionRequest } from './handler.js'
