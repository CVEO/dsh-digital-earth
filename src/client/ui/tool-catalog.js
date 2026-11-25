/**
 * ui/tool-catalog.js — the toolbox is an INDEX of entry points, not a form.
 *
 * Meeting 2026-11-12: the tools card had grown into a long scrolling column that
 * mixed every control inline, so the entry points were buried. The card now shows
 * one row per tool and the concrete panel opens on top of it (ui/tool-window.js).
 *
 * Only entries whose panel actually exists are listed: a disabled placeholder
 * would look like a feature that shipped broken.
 *
 * Pure data + pure reducers, so the browser and the tests share one definition.
 */

export const TOOL_ENTRIES = [
  { id: 'measure', labelKey: 'tools.measure', hintKey: 'tools.measureHint', icon: 'measure' },
  { id: 'select', labelKey: 'tools.select', hintKey: 'tools.selectHint', icon: 'select' },
  { id: 'annotation', labelKey: 'annotation.tool', hintKey: 'annotation.toolHint', icon: 'annotation' },
  { id: 'parse', labelKey: 'tools.parse', hintKey: 'tools.parseHint', icon: 'parse' },
  { id: 'analysis', labelKey: 'tools.analysis', hintKey: 'tools.analysisHint', icon: 'analysis' },
  { id: 'compare', labelKey: 'tools.compare', hintKey: 'tools.compareHint', icon: 'compare' },
  { id: 'effects', labelKey: 'tools.effects', hintKey: 'tools.effectsHint', icon: 'effects' },
  { id: 'view', labelKey: 'tools.view', hintKey: 'tools.viewHint', icon: 'view' },
]

export const TOOL_IDS = TOOL_ENTRIES.map((entry) => entry.id)

/**
 * Index headings (Batch B1). Visual grouping only: the groups follow the frozen
 * TOOL_IDS order (measure, select, annotation, parse, analysis, effects, view),
 * so opening a tool from a heading never reorders the reducer's definition.
 */
export const TOOL_GROUPS = [
  { titleKey: 'tools.group.measure', ids: ['measure', 'select', 'annotation', 'parse'] },
  { titleKey: 'tools.group.analysis', ids: ['analysis', 'compare'] },
  { titleKey: 'tools.group.view', ids: ['effects', 'view'] },
]

/** TOOL_ENTRIES split into their headings, still in TOOL_IDS order. */
export function toolGroups() {
  return TOOL_GROUPS.map((group) => ({
    titleKey: group.titleKey,
    entries: group.ids.map((id) => toolEntry(id)).filter(Boolean),
  })).filter((group) => group.entries.length > 0)
}

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

/**
 * Window state reducer for clicking a toolbox entry:
 * - clicking a new entry opens it expanded;
 * - clicking the active entry while minimized expands it;
 * - clicking the active expanded entry toggles it closed.
 */
export function selectToolWindow(state, clicked) {
  const current = state?.openTool ?? null
  const minimized = Boolean(state?.minimized)
  if (!toolEntry(clicked)) return { openTool: current, minimized }
  if (current === clicked && minimized) return { openTool: clicked, minimized: false }
  const next = current === clicked ? null : clicked
  return { openTool: next, minimized: false }
}
