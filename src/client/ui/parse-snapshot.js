/**
 * ui/parse-snapshot.js — compact persistence payload for the extraction queue.
 *
 * The scene snapshot keeps the adopted overlay; this payload keeps the review
 * queue (ids/status/geometry/provenance) so a page refresh can continue reviewing
 * instead of paying for a new extraction. Capped well below localStorage limits.
 */
export const PARSE_SNAPSHOT_LIMIT = 500

export function buildParseSnapshot(store, counts) {
  if (!store || typeof store.all !== 'function') return null
  const rows = store.all()
  const candidates = rows.slice(0, PARSE_SNAPSHOT_LIMIT)
  return {
    version: 2,
    savedAt: Date.now(),
    counts: counts ?? null,
    candidates,
    truncated: Math.max(0, rows.length - candidates.length),
  }
}

export function restoreParseSnapshot(store, payload) {
  if (!store || typeof store.hydrate !== 'function') return 0
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : []
  if (candidates.length === 0) return 0
  return store.hydrate(candidates)
}

/** Bind persistence helpers to one controller/queue without owning UI state. */
export function bindParseSnapshot({ store, getCounts, onRestored }) {
  return {
    snapshotPayload() { return buildParseSnapshot(store, getCounts?.()) },
    restoreSnapshot(payload) {
      const count = restoreParseSnapshot(store, payload)
      if (count === 0) return false
      const first = store.getState().candidates[0]
      onRestored?.(first?.properties?.id ?? null)
      return true
    },
  }
}
