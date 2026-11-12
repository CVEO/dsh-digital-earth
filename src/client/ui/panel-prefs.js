/**
 * ui/panel-prefs.js — tiny boolean preferences for the floating cards.
 *
 * Only panel chrome is stored (which groups are folded open); never scene or model
 * data. Every read/write is best-effort because localStorage throws in private
 * mode and when the quota is exhausted.
 */

export const STORAGE_PREFIX = 'mv.pref.'

export function readPanelFlag(key, fallback = false) {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + key)
    if (raw === '1') return true
    if (raw === '0') return false
    return fallback
  } catch {
    return fallback
  }
}

export function writePanelFlag(key, value) {
  try {
    globalThis.localStorage?.setItem(STORAGE_PREFIX + key, value ? '1' : '0')
  } catch {
    /* private mode / quota: the toggle still works for this mount */
  }
}

export const IMAGERY_OPEN_KEY = 'layers.imagery.open'
