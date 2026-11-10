/**
 * ui/reveal-panel.js — bring the Digital Earth tab to the front.
 *
 * Used before a modal the user must answer (local-path authorisation) and before
 * a capture in a hidden tab, so work is not silently done off-screen. Prefer the
 * chat-adjacent right sidebar; fall back to the immersive panel.
 */
import { service } from '../runtime.js'

export function revealPanel() {
  try {
    const rightbar = service('sidebarRight')
    if (rightbar && typeof rightbar.openTab === 'function') {
      rightbar.openTab('digital-earth')
      return true
    }
  } catch {
    // No on-screen session: fall through to the immersive panel.
  }
  try {
    const layout = service('layout')
    if (layout && typeof layout.selectPanel === 'function') {
      layout.selectPanel('digital-earth')
      return true
    }
  } catch {
    // A host without a layout service cannot auto-reveal.
  }
  return false
}
