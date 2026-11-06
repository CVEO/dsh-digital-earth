/**
 * "Ask Agent": push a bounded scene summary into the live conversation agent.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { randomUUID } from 'node:crypto'
import { MAX_INJECT_BODY, MAX_INJECT_TEXT } from './constants.js'
import { sendJson, sendText } from './http.js'
import { validSessionId } from './session.js'

/**
 * POST: put the panel's scene summary into the live conversation agent's inbox.
 *
 * The message is injected into the next admitted step, so the user can press
 * "Ask Agent" and then simply type the question. The page is trusted (token +
 * same-origin route), but the text is still bounded and stripped of control
 * characters so a buggy or hostile page cannot flood the model context.
 */
export async function injectHandler(ctx, req, res) {
  if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_INJECT_BODY) {
        req.destroy()
        return sendText(res, 413, 'payload too large')
      }
    }
  } catch {
    return sendText(res, 400, 'bad request')
  }
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return sendText(res, 400, 'invalid json')
  }
  const session = typeof payload?.session === 'string' ? payload.session : ''
  if (!validSessionId(session)) return sendText(res, 400, 'missing or invalid session')
  const text = String(payload?.text ?? '')
    // Drop every C0 control character except tab and newline; keep the two
    // whitespace controls the model can actually use (CR included in the strip).
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, '')
    .trim()
    .slice(0, MAX_INJECT_TEXT)
  if (text === '') return sendText(res, 400, 'missing text')
  let agents
  try {
    agents = ctx.get('agents') ?? ctx.agents
  } catch {
    agents = null
  }
  if (!agents || typeof agents.get !== 'function') {
    return sendJson(res, 503, {
      ok: false,
      error: 'agent_unavailable',
      message: 'The Agent runtime is unavailable in this DSH build.',
    })
  }
  const agent = agents.get(session)
  if (!agent || typeof agent.inject !== 'function') {
    return sendJson(res, 409, {
      ok: false,
      error: 'agent_not_running',
      message: 'This conversation has no running agent. Send a message first, then retry.',
    })
  }
  try {
    agent.inject({
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'digital-earth', form: 'notice', summary: 'Digital Earth scene context' },
    })
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: 'inject_failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
  return sendJson(res, 200, { ok: true })
}
