/**
 * ui/panel-state.js — pure state kernel for Panel System 2.0.
 *
 * The rail has exactly five destinations: 图层 / 工具 / 地名检索 / 结果 / 对象. Everything a
 * panel can do is a transition on this small record, so the rules are testable
 * without React, Cesium or a browser:
 *
 *   - one active tab, one active tool window (master/detail) at a time;
 *   - a click on the active tab collapses the rail, a click on another tab
 *     switches to it and expands;
 *   - automatic arrivals (analysis result / picked object) may steal focus only
 *     while the user is idle and the rail is expanded; otherwise they only mark
 *     an unread dot;
 *   - unavailable tabs (`result` with no result, `object` with no selection) are
 *     pruned to 图层 (falling back to 工具), so the rail never opens a dead tab.
 *
 * Nothing in here touches the DOM or localStorage; `readPanelState` /
 * `writePanelState` are the only storage edges and both tolerate corrupt data.
 */
export const PANEL_STORAGE_KEY = 'mv.ui.v2'
export const PANEL_LEGACY_DOCK_KEY = 'mv.rightDock.v1'
export const PANEL_TABS = Object.freeze(['layers', 'tools', 'places', 'result', 'object'])
export const PANEL_TAB_LABELS = Object.freeze({
  layers: 'layers.title',
  tools: 'tools.title',
  places: 'places.title',
  result: 'panel.tab.result',
  object: 'panel.tab.object',
})
export const PANEL_DEFAULT_WIDTH = 300
export const PANEL_MIN_WIDTH = 240
export const PANEL_MAX_WIDTH = 720
export const PANEL_WIDTH_STEP = 10

const FALLBACK_ORDER = ['layers', 'tools', 'places', 'result', 'object']

export function isPanelTab(value) {
  return PANEL_TABS.includes(value)
}

export function clampPanelWidth(value, fallback = PANEL_DEFAULT_WIDTH) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(n)))
}

export function createPanelState(patch = {}) {
  const base = {
    activeTab: 'layers',
    collapsed: false,
    width: PANEL_DEFAULT_WIDTH,
    openTool: null,
    unread: { result: false, object: false },
    objectSeq: 0,
  }
  return normalizePanelState({ ...base, ...patch })
}

/**
 * Accepts anything that may have come from storage or an old render and returns
 * a valid state. `null` becomes the default state; a stale `activeTab` falls back
 * to the first available tab.
 */
export function normalizePanelState(raw, { available = PANEL_TABS } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return createPanelState()
  const availableTabs = Array.isArray(available) && available.length ? available : PANEL_TABS
  const activeTab = availableTabs.includes(raw.activeTab) ? raw.activeTab : availableTabs[0]
  const unreadRaw = raw.unread && typeof raw.unread === 'object' ? raw.unread : {}
  const next = {
    activeTab,
    collapsed: raw.collapsed === true,
    width: clampPanelWidth(raw.width),
    openTool: typeof raw.openTool === 'string' && raw.openTool ? raw.openTool : null,
    unread: {
      result: unreadRaw.result === true,
      object: unreadRaw.object === true,
    },
    objectSeq: Number.isFinite(Number(raw.objectSeq)) ? Math.max(0, Math.round(Number(raw.objectSeq))) : 0,
  }
  // Reducers call normalize on every action. Returning the same object when the
  // normalized values already match keeps no-op transitions reference-stable
  // (React can skip a render, and tests can assert `===`).
  if (
    raw.activeTab === next.activeTab &&
    raw.collapsed === next.collapsed &&
    raw.width === next.width &&
    raw.openTool === next.openTool &&
    raw.objectSeq === next.objectSeq &&
    unreadRaw.result === next.unread.result &&
    unreadRaw.object === next.unread.object
  ) {
    return raw
  }
  return next
}

function clearUnread(state, tabId) {
  if (!state.unread[tabId]) return state
  return { ...state, unread: { ...state.unread, [tabId]: false } }
}

/**
 * Automatic focus policy. `busy` covers measuring / annotating / parsing /
 * dragging; while busy the arrival is only marked unread. A collapsed rail also
 * stays collapsed so a background result never expands the workspace.
 */
function arrive(state, tabId, busy) {
  if (busy || state.collapsed) {
    if (state.unread[tabId]) return state
    return { ...state, unread: { ...state.unread, [tabId]: true } }
  }
  if (state.activeTab === tabId && !state.unread[tabId]) return state
  return { ...state, activeTab: tabId, unread: { ...state.unread, [tabId]: false } }
}

export function panelReducer(state, action) {
  const current = normalizePanelState(state)
  switch (action?.type) {
    case 'activate': {
      const tabId = action.tabId
      if (!isPanelTab(tabId)) return current
      if (current.activeTab === tabId && !current.collapsed) {
        return clearUnread(current, tabId)
      }
      return clearUnread({ ...current, activeTab: tabId, collapsed: false }, tabId)
    }
    case 'toggle': {
      const tabId = action.tabId
      if (!isPanelTab(tabId)) return current
      if (current.activeTab === tabId) {
        return clearUnread({ ...current, collapsed: !current.collapsed }, tabId)
      }
      return clearUnread({ ...current, activeTab: tabId, collapsed: false }, tabId)
    }
    case 'collapse':
      return current.collapsed ? current : { ...current, collapsed: true }
    case 'expand':
      return current.collapsed ? { ...current, collapsed: false } : current
    case 'setWidth': {
      const width = clampPanelWidth(action.width, current.width)
      return width === current.width ? current : { ...current, width }
    }
    case 'openTool': {
      const toolId = typeof action.toolId === 'string' && action.toolId ? action.toolId : null
      if (!toolId) return current
      if (current.openTool === toolId && current.activeTab === 'tools' && !current.collapsed) return current
      return {
        ...current,
        activeTab: 'tools',
        collapsed: false,
        openTool: toolId,
        unread: { ...current.unread, object: current.unread.object },
      }
    }
    case 'closeTool':
      return current.openTool === null ? current : { ...current, openTool: null }
    case 'resultArrived':
      return arrive(current, 'result', Boolean(action.busy))
    case 'objectArrived': {
      const next = arrive(current, 'object', Boolean(action.busy))
      const objectSeq = Number.isFinite(Number(action.seq)) ? Math.max(0, Math.round(Number(action.seq))) : next.objectSeq
      return objectSeq === next.objectSeq ? next : { ...next, objectSeq }
    }
    case 'objectCleared':
      return {
        ...current,
        activeTab: current.activeTab === 'object' ? 'layers' : current.activeTab,
        unread: { ...current.unread, object: false },
        objectSeq: 0,
      }
    case 'clearUnread': {
      const tabId = action.tabId
      if (!isPanelTab(tabId) || !current.unread[tabId]) return current
      return clearUnread(current, tabId)
    }
    case 'prune': {
      const available = Array.isArray(action.available) ? action.available.filter(isPanelTab) : PANEL_TABS
      if (available.includes(current.activeTab)) return current
      const nextTab = FALLBACK_ORDER.find((tab) => available.includes(tab)) ?? 'tools'
      return { ...current, activeTab: nextTab, collapsed: current.collapsed }
    }
    case 'hydrate':
      return normalizePanelState(action.state)
    default:
      return current
  }
}

/**
 * The tabs a rail should render, in stable order. `layers`/`tools` are the
 * baseline workspace; `result` and `object` appear only when they have content.
 */
export function visiblePanelTabs({ hasResult = false, hasObject = false } = {}) {
  return PANEL_TABS.filter((id) => {
    if (id === 'object') return hasObject
    return true
  })
}

const LEGACY_TAB_MAP = {
  analysis: 'result',
  result: 'result',
  layers: 'layers',
  tools: 'tools',
  object: 'object',
}

function normalizeLegacyDock(raw) {
  if (!raw || typeof raw !== 'object') return null
  let activeTab = LEGACY_TAB_MAP[raw.activeId] ?? 'layers'
  let openTool = null
  if (typeof raw.activeId === 'string' && raw.activeId.startsWith('toolwin:')) {
    activeTab = 'tools'
    openTool = raw.activeId.slice('toolwin:'.length) || null
  }
  return {
    activeTab,
    openTool,
    collapsed: raw.collapsed === true,
    width: raw.width,
  }
}

/**
 * Read v2 preferences, then fall back to the v1.6.2 dock key. A `result` tab
 * remembered from an old analysis that no longer exists is pruned by the host
 * through `prune`, not here (this function has no data access).
 */
export function readPanelState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(PANEL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const state = normalizePanelState(parsed)
      return parsed?.version === 2 ? state : state
    }
    const legacyRaw = storage?.getItem?.(PANEL_LEGACY_DOCK_KEY)
    if (legacyRaw) {
      const legacy = normalizeLegacyDock(JSON.parse(legacyRaw))
      if (legacy) return createPanelState(legacy)
    }
  } catch {
    /* corrupt storage: fall through to defaults */
  }
  return createPanelState()
}

export function writePanelState(state, storage = globalThis.localStorage) {
  try {
    const normalized = normalizePanelState(state)
    storage?.setItem?.(PANEL_STORAGE_KEY, JSON.stringify({ version: 2, ...normalized }))
  } catch {
    /* private mode: keep the in-memory state only */
  }
}
