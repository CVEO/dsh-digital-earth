/**
 * ui/parse-session.js — keep one workbench controller alive across tab switches.
 *
 * The right panel unmounts a tool body when the user visits another destination,
 * but extraction candidates are session data: switching to the layer list and
 * back must not drop a half-reviewed queue. The controller lives here (one per
 * page, tied to the current viewer) and is only disposed when the page or the
 * viewer is replaced.
 *
 * P1c snapshot v2: when the panel runs inside a DSH sidebar session, the queue is
 * also mirrored to localStorage (debounced) and restored on the next mount. The
 * scene snapshot keeps the adopted overlay; this module keeps the review queue
 * that produced it, so a page refresh no longer forces a paid re-extraction.
 */
import { createParseController } from './parse-controller.js'

let current = null
let boundViewer = null
let saveTimer = null
let unsubscribe = null
let boundKey = null

const STORAGE_PREFIX = 'mv.parse.queue.'
const MAX_PERSISTED = 500

function storage() {
  try {
    const store = globalThis.localStorage
    if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return null
    return store
  } catch {
    return null
  }
}

function sessionKey(ctx) {
  const session = typeof ctx?.getSession === 'function' ? ctx.getSession() : null
  if (typeof session !== 'string' || session === '') return null
  return `${STORAGE_PREFIX}${session}`
}

function readPayload(key) {
  const store = storage()
  if (!store || !key) return null
  try {
    const raw = store.getItem(key)
    if (typeof raw !== 'string' || raw === '') return null
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.candidates)) return null
    return data
  } catch {
    return null
  }
}

function writePayload(key, controller) {
  const store = storage()
  if (!store || !key || !controller) return
  try {
    const payload = typeof controller.snapshotPayload === 'function' ? controller.snapshotPayload() : null
    if (!payload) return
    store.setItem(key, JSON.stringify(payload))
  } catch {
    /* quota/private mode: persistence is best effort */
  }
}

function scheduleSave(key, controller) {
  if (!key) return
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    writePayload(key, controller)
  }, 400)
}

function disposeCurrent() {
  if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null }
  try { unsubscribe?.() } catch { /* best effort */ }
  unsubscribe = null
  current?.dispose()
  current = null
  boundViewer = null
  boundKey = null
}

export function parseSession(ctx) {
  const viewer = ctx?.getViewer?.() ?? null
  const key = sessionKey(ctx)
  if (current && (viewer !== boundViewer || key !== boundKey)) resetParseSession()
  if (!current) {
    current = createParseController(ctx)
    boundViewer = viewer
    boundKey = key
    const restored = readPayload(boundKey)
    if (restored) {
      current.restoreSnapshot(restored)
      if (Number(restored.truncated) > 0 && typeof ctx.t === 'function') {
        current.notify?.(ctx.t('parse.restoreTruncated', { n: restored.truncated }))
      }
    }
    if (boundKey) {
      unsubscribe = current.subscribe(() => scheduleSave(boundKey, current))
    }
  } else {
    // The panel may remount with a newer dictionary/toast callback; the
    // controller outlives it, so refresh the accessors it reads.
    current.updateContext?.(ctx)
  }
  return current
}

export function resetParseSession() {
  if (current && boundKey) writePayload(boundKey, current)
  disposeCurrent()
}

/** Persist immediately (page hide / explicit flush). */
export function flushParseSession() {
  if (current && boundKey) writePayload(boundKey, current)
}

// The debounce window is short; this guarantees the latest queue on tab close.
try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', flushParseSession)
  }
} catch { /* no window: unit tests / SSR */ }

/** Test/inspection helper: how many candidates a persisted payload keeps. */
export const PARSE_PERSIST_LIMIT = MAX_PERSISTED
