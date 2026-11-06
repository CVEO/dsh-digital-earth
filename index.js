/**
 * Host entry of the Digital Earth plugin.
 *
 * v2.0 split: every implementation module lives under src/host/. This file only
 * injects the DSH services, wires the plugin at startup, and re-exports the
 * public seams the test suite imports from the package root.
 */
import { createBridge } from './src/host/bridge.js'
import { createRecentDirectories } from './src/host/directories.js'
import { mountEarthCommand } from './src/host/commands.js'
import { registerRoutes } from './src/host/routes.js'
import { mountAgentTools } from './src/host/tools/registry.js'

export const inject = ['webServer', 'connection']

export function apply(ctx) {
  // Directories this page opened through `/scan`; tile files are served only from
  // them, so a token holder cannot read arbitrary paths on the machine.
  const allowedDirs = new Set()
  // Commands from Host tools to the open panel live for the plugin lifetime.
  const bridge = createBridge(allowedDirs)
  // Remembered folders are re-allowed in the background: apply() never blocks on disk.
  const directories = createRecentDirectories(allowedDirs)
  void directories.restore().catch(() => {})
  registerRoutes(ctx, { allowedDirs, bridge, directories })
  mountAgentTools(ctx, bridge, allowedDirs)
  mountEarthCommand(ctx, bridge)
}

export { createBridge } from './src/host/bridge.js'
export { renderEarthCommandStatus } from './src/host/commands.js'
export { mergeRecentDirectories } from './src/host/directories.js'
export { injectHandler } from './src/host/inject.js'
export { isLocalResolutionAllowed, resolveLocalTileset } from './src/host/local-resolve.js'
export { sceneSnapshotFile, sceneSnapshotHandler } from './src/host/snapshots.js'
export { normalizeConfig } from './src/host/sources.js'
export { reportHandler } from './src/host/storage.js'
export { ANALYZE_ACTIONS, normalizeAnalyzeRequest } from './src/host/tools/analyze.js'
export { normalizeDrawRequest } from './src/host/tools/draw.js'
export { normalizeMeasureRequest } from './src/host/tools/measure.js'
export { SYSTEM_PROMPT_SECTION } from './src/host/tools/registry.js'
export { SHADER_ACTIONS, SHADER_PRESETS, normalizeShaderRequest } from './src/host/tools/shader.js'
