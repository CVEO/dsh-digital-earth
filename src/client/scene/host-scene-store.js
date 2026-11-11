/**
 * scene/host-scene-store.js — the host-backed scene snapshot store.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2 (the component was at its line
 * budget). The host store survives origin changes; localStorage is the fallback.
 * Reads time out after 3 s, writes are throttled to one PUT per 10 s unless forced
 * (unmount / page hide), and an oversized body stays local-only.
 *
 * The inner function names stay identical to the ones the structural tests know,
 * and the factory takes lazy dependencies so it never holds a stale meta ref.
 */
export function createHostSceneStore({
  getMeta,
  loadMeta,
  normalizeSceneSnapshot,
  readSceneSnapshot,
  writeSceneSnapshot,
  hostTimeoutMs = 3000,
  saveIntervalMs = 10000,
  maxBodyLength = 512 * 1024,
}) {
  const metaRef = {
    get current() {
      return getMeta()
    },
  }
  const HOST_SCENE_TIMEOUT_MS = hostTimeoutMs
  const lastHostSceneSaveRef = { current: 0 }
  let pendingTimer = null
  let pendingPayload = null

  /** Read the host-persisted snapshot; null when absent or unreachable. */
  async function readHostSceneSnapshot(session) {
    const meta = metaRef.current ?? (await loadMeta().catch(() => null))
    if (!meta?.sceneUrl) return null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HOST_SCENE_TIMEOUT_MS)
    try {
      const response = await fetch(
        `${meta.sceneUrl}?token=${encodeURIComponent(meta.token)}&session=${encodeURIComponent(session)}`,
        { credentials: 'same-origin', signal: controller.signal },
      )
      if (!response.ok) return null
      const data = await response.json()
      const normalized = normalizeSceneSnapshot(data?.snapshot)
      const savedAt = typeof data?.snapshot?.savedAt === 'string' && data.snapshot.savedAt !== ''
        ? data.snapshot.savedAt
        : typeof data?.savedAt === 'string' && data.savedAt !== ''
          ? data.savedAt
          : ''
      if (normalized !== null && !normalized.savedAt && savedAt !== '') {
        normalized.savedAt = savedAt
      }
      return normalized
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /** Push one snapshot body to the host store, throttled unless forced. */
  function saveHostSceneSnapshot(session, body, force = false) {
    const meta = metaRef.current
    if (!meta?.sceneUrl) return
    const now = Date.now()
    if (!force && now - lastHostSceneSaveRef.current < saveIntervalMs) {
      pendingPayload = { session, body }
      if (pendingTimer === null) {
        const waitMs = Math.max(50, saveIntervalMs - (now - lastHostSceneSaveRef.current))
        pendingTimer = setTimeout(() => {
          pendingTimer = null
          const next = pendingPayload
          pendingPayload = null
          if (next) saveHostSceneSnapshot(next.session, next.body, true)
        }, waitMs)
        pendingTimer?.unref?.()
      }
      return
    }
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    pendingPayload = null
    lastHostSceneSaveRef.current = now
    let text = ''
    try {
      text = JSON.stringify({ session, snapshot: body })
    } catch {
      return
    }
    // Mirror the host body limit so an oversized scene stays local-only.
    if (text.length > maxBodyLength) return
    try {
      void fetch(meta.sceneUrl, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: text,
        keepalive: true,
      }).catch(() => {})
    } catch {
      // The host store is best effort; the local cache already has the scene.
    }
  }

  /** Prefer the fresher snapshot between host and local; fall back when offline. */
  async function loadSceneSnapshot(session) {
    const hostSnapshot = await readHostSceneSnapshot(session)
    if (hostSnapshot !== null) {
      let localSnapshot = null
      try {
        localSnapshot = readSceneSnapshot(session)
      } catch {
        localSnapshot = null
      }
      if (
        localSnapshot !== null &&
        typeof localSnapshot.savedAt === 'string' &&
        typeof hostSnapshot.savedAt === 'string' &&
        localSnapshot.savedAt > hostSnapshot.savedAt
      ) {
        saveHostSceneSnapshot(session, localSnapshot, true)
        return localSnapshot
      }
      try {
        writeSceneSnapshot(session, hostSnapshot)
      } catch {
        // Keeping the local cache warm is a convenience, not a requirement.
      }
      return hostSnapshot
    }
    return readSceneSnapshot(session)
  }

  return { readHostSceneSnapshot, saveHostSceneSnapshot, loadSceneSnapshot }
}
