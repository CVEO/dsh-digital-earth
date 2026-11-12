/**
 * ui/tool-catalog.js — the toolbox is an INDEX of entry points, not a form.
 *
 * Meeting 2026-11-12: the tools card had grown into a long scrolling column that
 * mixed every control inline, so the entry points were buried. The card now shows
 * one row per tool and the concrete panel opens on top of it (ui/tool-window.js).
 *
 * Only entries whose panel actually exists are listed: a disabled placeholder
 * would look like a feature that shipped broken. Annotations and AI scene parsing
 * join this catalog when their panels land.
 *
 * Pure data + pure reducers, so the browser and the tests share one definition.
 */

export const TOOL_ENTRIES = [
  { id: 'measure', labelKey: 'tools.measure', hintKey: 'tools.measureHint', icon: 'measure' },
  { id: 'select', labelKey: 'tools.select', hintKey: 'tools.selectHint', icon: 'select' },
  { id: 'annotation', labelKey: 'annotation.tool', hintKey: 'annotation.toolHint', icon: 'annotation' },
  { id: 'analysis', labelKey: 'tools.analysis', hintKey: 'tools.analysisHint', icon: 'analysis' },
  { id: 'effects', labelKey: 'tools.effects', hintKey: 'tools.effectsHint', icon: 'effects' },
  { id: 'view', labelKey: 'tools.view', hintKey: 'tools.viewHint', icon: 'view' },
]

export const TOOL_IDS = TOOL_ENTRIES.map((entry) => entry.id)

export function toolEntry(id) {
  return TOOL_ENTRIES.find((entry) => entry.id === id) ?? null
}

/**
 * Clicking the entry of the open window toggles it closed; another entry switches
 * the window in place. Keeping this pure lets the UI and the tests agree on the
 * "one window at a time" rule.
 */
export function nextOpenTool(current, clicked) {
  if (!toolEntry(clicked)) return current
  return current === clicked ? null : clicked
}
