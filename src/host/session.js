/**
 * Session targeting, token redaction and the shared bridge/tool protocol strings.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { TOKEN } from './constants.js'

export const PANEL_CLOSED_MESSAGE = 'The Digital Earth panel did not attach in time. Ask the user to open the digital earth tab with the globe button in the chat header, then retry.'
export const SESSION_FALLBACK_NOTE = 'No session id was supplied by this tool call; the only connected digital earth panel session was used.'

/**
 * Which browser session should run this command. The tool execution normally
 * carries the conversation's session id; a fallback covers transports that do
 * not, as long as exactly one panel session is connected.
 */
export function resolveSessionTarget(bridge, exec) {
  const direct = exec?.agent?.session?.id ?? exec?.agent?.id
  if (typeof direct === 'string' && validSessionId(direct)) return { sessionId: direct, fallback: false }
  const connected = bridge.connectedSessions()
  if (connected.length === 1) return { sessionId: connected[0], fallback: true }
  return null
}

export function asResultObject(value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value
  return { result: value === undefined ? null : value }
}

/**
 * The per-process token authorises local file reads, so it must never reach the
 * model. Any string below a tool result that still carries it is redacted; the
 * page can echo token-bearing urls in status/list payloads.
 */
export function scrubToken(value) {
  if (typeof value === 'string') {
    return value.includes(TOKEN) ? value.split(TOKEN).join('[token redacted]') : value
  }
  if (Array.isArray(value)) return value.map(scrubToken)
  if (value !== null && typeof value === 'object') {
    const cleaned = {}
    for (const [key, item] of Object.entries(value)) cleaned[key] = scrubToken(item)
    return cleaned
  }
  return value
}

export function validSessionId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u0020]/.test(value)
}

export const sceneError = (message) => new Error(`earth_scene: ${message}`)
