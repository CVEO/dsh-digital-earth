/**
 * Client half entry point (esbuild input for `npm run build:client`).
 *
 * DSH loads `client.js` as one `window.__ModuleLoader__` module; esbuild bundles
 * this file (React stays external) and the build script wraps the result in the
 * loader banner. The named exports are exactly what the loader consumes:
 * `{ inject, apply }`.
 */
import plugin, { apply, inject } from './plugin.js'

export { apply, inject }
export default plugin
