import { createHash } from 'node:crypto'
import { sendJson, sendText } from './http.js'
import { validSessionId } from './session.js'
import { validateVisionRequest } from './vision.js'

function service(ctx, name) {
  try { return ctx.get?.(name) ?? ctx[name] } catch { return null }
}

export function createSelectionQuestionHandler(ctx, { getService } = {}) {
  const requests = new Map()
  return async (req, res) => {
    const fail = (status, code, next = 'retry') => sendJson(res, status, { ok: false, code, next })
    if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
    if (req.headers?.['x-dsh-panel'] !== 'selection-question') return fail(403, 'forbidden', 'reload')
    let payload
    try {
      let body = '', size = 0
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk)
        if (size > 2_200_000) return fail(413, 'too_large', 'retake')
        body += chunk
      }
      payload = JSON.parse(body)
    } catch { return fail(400, 'invalid_request', 'edit') }
    if (!validSessionId(payload?.session) || typeof payload.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(payload.requestId) ||
        typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > 16000) return fail(400, 'invalid_request', 'edit')
    const text = payload.text.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim()
    if (!text) return fail(400, 'invalid_request', 'edit')
    let image = null
    if (payload.image !== undefined && payload.image !== null) {
      try { image = validateVisionRequest({ frameId: payload.requestId, point: [0.5, 0.5], image: payload.image }) }
      catch { return fail(400, 'invalid_image', 'retake') }
    }
    let controller = null
    try {
      controller = typeof getService === 'function' ? getService('sessionController') : null
    } catch {
      controller = null
    }
    controller = controller ?? service(ctx, 'sessionController')
    if (typeof controller?.prompt !== 'function') return fail(503, 'unavailable', 'copy_to_chat')
    const key = `${payload.session}:${payload.requestId}`
    const fingerprint = createHash('sha256').update(text).update(payload.image ?? '').digest('hex')
    let entry = requests.get(key)
    if (entry && entry.fingerprint !== fingerprint) return fail(409, 'request_conflict', 'edit')
    if (!entry) {
      for (const [id, item] of requests) if (item.settled && Date.now() - item.time > 600_000) requests.delete(id)
      if (requests.size >= 64) {
        const oldest = [...requests].find(([, item]) => item.settled)
        if (oldest) requests.delete(oldest[0])
        else return fail(429, 'busy')
      }
      const content = [{ type: 'text', text }]
      if (image) content.push({ type: 'image', mediaType: image.mediaType, data: image.data.toString('base64'), name: 'digital-earth-selection.jpg' })
      entry = { fingerprint, time: Date.now(), settled: false }
      requests.set(key, entry)
      entry.promise = Promise.resolve().then(() => controller.prompt({
        requestId: `digital-earth-${payload.requestId}`, sessionId: payload.session, mode: 'queue', content,
      }, new AbortController().signal)).then((result) => {
        if (result?.accepted !== true) throw new Error('Prompt was not acknowledged')
        return { status: 200, body: { ok: true, accepted: true, image: Boolean(image), requestId: payload.requestId } }
      }).catch((error) => {
        requests.delete(key)
        const details = `${error?.code ?? ''} ${error?.message ?? ''} ${JSON.stringify(error?.data ?? error?.details ?? {})}`
        const code = /MODEL_DOES_NOT_SUPPORT_IMAGES|does not support image/i.test(details) ? 'model_not_visual'
          : /not-found|not found/i.test(details) ? 'session_unavailable' : 'send_failed'
        return { status: 409, body: { ok: false, code, next: code === 'model_not_visual' ? 'change_model_or_text' : 'retry' } }
      }).finally(() => { entry.settled = true })
    }
    const result = await entry.promise
    if (!res.destroyed && !res.writableEnded) sendJson(res, result.status, result.body)
  }
}
