/**
 * ESM loader that maps the bare `react` specifier to the local stub below.
 *
 * The client modules import React for hooks, but the repository intentionally does
 * not depend on the React package (the DSH host provides it at runtime and the
 * client artifact keeps `require("react")`). Structural tests read source; tests
 * that need to execute a client module with a React import register this loader
 * and then `await import()` the module.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react') {
    return { url: new URL('./react-stub.mjs', import.meta.url).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
