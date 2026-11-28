import { createHash } from 'node:crypto'
import { validSessionId } from '../session.js'
import { visionError } from '../../client/scene/vision-geometry.js'
import { lookupService } from './capability.js'

export async function effectiveVisionConfig(ctx, getService, config, sessionId, signal) {
  if (config.mode !== 'dsh-default') return config
  const sessions = lookupService(ctx, 'sessionController', getService)
  let selected
  if (sessionId && typeof sessions?.projections === 'function') {
    if (!validSessionId(sessionId)) throw visionError('invalid_request')
    const projection = await sessions.projections({ sessionId }, signal)
    selected = projection?.values?.modelSelection?.next
  }
  selected ??= await lookupService(ctx, 'agentDefaultModel', getService)?.currentSelection?.()
  return selected?.provider && selected?.model
    ? { ...config, mode: 'dsh-model', dshModel: { provider: selected.provider, model: selected.model } }
    : config
}

export function modelRouteKey(config) {
  const fields = config.mode === 'openai-compat'
    ? [config.mode, config.openaiCompat?.baseUrl, config.openaiCompat?.model]
    : [config.mode, config.dshModel?.provider, config.dshModel?.model]
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0,24)
}

export async function visionModelDirectory(ctx, getService) {
  const sessions = lookupService(ctx, 'sessionController', getService)
  const catalog = await sessions?.modelCatalog?.()
  return (catalog?.groups ?? []).map(group => ({
    id: group.id, name: group.name,
    models: group.models.map(({ id, name }) => ({ id, name: name || id })),
  }))
}
