/**
 * scene/parse-overlay.js — keep the adopted extraction result as ONE overlay layer.
 *
 * Extraction candidates live in the workbench store; only accepted ones reach the
 * annotation overlay. Every status change re-syncs the whole accepted set, so the
 * layer always mirrors the queue (rejecting an accepted candidate removes its
 * geometry instead of leaving an orphan). Re-syncing removes the previous command
 * and replays a new one, which keeps the undo history to one entry per change the
 * user made in the workbench rather than one per candidate.
 */
import { removeAgentOverlay } from './agent-overlays.js'

export function createParseOverlaySync({ getState, getViewer, draw, onChanged, t, style = 'violet' }) {
  let command = null
  let caption = null

  // Snapshot restore rebuilds drawCommands objects, so the original identity can be
  // gone. The caption is unique to extraction output and survives a rebuild: fall
  // back to the last layer with it instead of leaking one stale layer per sync.
  const findByCaption = (list) => {
    if (!caption) return -1
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (list[index]?.caption === caption) return index
    }
    return -1
  }

  const clearCurrent = () => {
    const state = getState?.()
    const viewer = getViewer?.()
    const list = Array.isArray(state?.drawCommands) ? state.drawCommands : []
    let index = command ? list.indexOf(command) : -1
    if (index < 0) index = findByCaption(list)
    command = null
    if (index < 0 || !state || !viewer) return
    try { removeAgentOverlay(state, viewer, 'draw', index) } catch { /* layer already gone */ }
  }

  return {
    sync(collection, nextCaption) {
      const state = getState?.()
      if (!state) return false
      caption = typeof nextCaption === 'string' && nextCaption ? nextCaption : (typeof t === 'function' ? t('parse.layerName') : 'extract')
      clearCurrent()
      const features = Array.isArray(collection?.features) ? collection.features : []
      if (features.length > 0) {
        const before = Array.isArray(state.drawCommands) ? state.drawCommands.length : 0
        try {
          draw({ ...collection, features }, style, caption, 'user')
          command = Array.isArray(state.drawCommands) ? state.drawCommands[before] ?? null : null
        } catch {
          command = null
          return false
        }
      }
      try { onChanged?.({ features: features.length }) } catch { /* count refresh is best effort */ }
      return true
    },
    clear() { clearCurrent() },
  }
}
