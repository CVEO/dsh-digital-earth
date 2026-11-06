/**
 * Factory-scope state shared by every client module.
 *
 * v1.x kept `appCtx` and `service()` in the single factory closure. The Cesium
 * and meta promise caches live next to their loader (api.js); this module owns
 * only the Cordis context, so any module can read a service without importing
 * the plugin entry (which would be a cycle).
 */

let appCtx = null

/** Called once from `apply(ctx)`; every later service lookup reads this value. */
export const setAppCtx = (value) => {
  appCtx = value
}

/** The mounted Cordis context (null before `apply`); the theme hook needs events. */
export const getAppCtx = () => appCtx

/** Read a Cordis client service without breaking when it is not mounted. */
export const service = (key) => {
  try {
    return appCtx?.get?.(key) ?? undefined
  } catch {
    return undefined
  }
}
