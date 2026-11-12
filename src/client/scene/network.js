/**
 * Host-path joining and network timeouts shared by the viewer surface.
 *
 * Provider/service requests (terrain metadata, imagery capabilities, tileset
 * JSON) can hang on a bad network or a stale host route. Every network step that
 * gates the UI is raced against this timeout so the panel can fall back instead
 * of leaving the loading overlay up forever.
 */
export const NETWORK_TIMEOUT_MS = 8000

export function joinLocalPath(dir, rel) {
  return `${String(dir).replace(/[\\/]+$/, '')}/${String(rel).replace(/\\/g, '/')}`
}

/** Build the helpers once per surface so `t` stays the injected translator. */
export function createNetwork({ t }) {
  function withNetworkTimeout(promise, ms = NETWORK_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(t('toast.requestTimeout', { seconds: Math.round(ms / 1000) }))), ms),
      ),
    ])
  }
  return { joinLocalPath, withNetworkTimeout }
}
