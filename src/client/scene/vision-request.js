import { validateVisionPolygon, visionError } from './vision-geometry.js'

export async function visionRequest(url, { frame, signal, force = false, fetchImpl = fetch } = {}) {
  if (typeof url !== 'string' || !url) throw visionError('unavailable')
  const targetUrl = !frame && force
    ? `${url}${url.includes('?') ? '&' : '?'}force=1`
    : url
  const response = await fetchImpl(targetUrl, {
    method: frame ? 'POST' : 'GET',
    credentials: 'same-origin',
    signal,
    headers: frame ? { 'content-type': 'application/json', 'x-dsh-panel': 'vision' } : {},
    ...(frame
      ? {
          body: JSON.stringify({
            frameId: frame.id,
            image: frame.dataUrl,
            point: frame.point,
            ...(force ? { force: true } : {}),
          }),
        }
      : {}),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.ok !== true) {
    throw visionError(typeof result?.code === 'string' ? result.code : 'model_failed', {
      diagnostic: result?.diagnostic ?? null,
      next: result?.next ?? null,
    })
  }
  if (!frame) return result
  if (result.frameId !== frame.id || !frame.isValid()) throw visionError('scene_changed')
  const validated = validateVisionPolygon(result, frame.point)
  if (result.shape === 'box' && validated.polygon.length === 4) {
    const [first, second, third, fourth] = validated.polygon
    if (first[1] === second[1] && second[0] === third[0] && third[1] === fourth[1] && fourth[0] === first[0]) validated.shape = 'box'
  }
  return {
    ...validated,
    model: result.model,
    ...(result.provider ? { provider: result.provider } : {}),
    ...(result.backend ? { backend: result.backend } : {}),
    ...(result.capability ? { capability: result.capability } : {}),
    ...(result.repaired || validated.repaired ? { repaired: true } : {}),
  }
}
