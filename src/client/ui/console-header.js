/**
 * ui/console-header.js — what the one console header row says.
 *
 * The dock used to repeat the destination name in a second title row of its own.
 * That row is gone: the header now carries "where am I" on the left, plus (in the
 * tools master/detail) the open tool's name and the back chevron. Keeping this
 * derivation pure avoids growing ViewerSurface just to compute three strings.
 */
import { PANEL_TAB_LABELS } from './panel-state.js'
import { toolEntry } from './tool-catalog.js'

/** Ids of the open tool windows, oldest first; accepts strings or `{id}`. */
export function openToolIds(windows) {
  return (Array.isArray(windows) ? windows : [])
    .map((item) => (typeof item === 'string' ? item : item?.id))
    .filter(Boolean)
}

/**
 * @returns {{tab: string, panelLabel: string, panelDetail: string|null, toolId: string|null}}
 */
export function consoleHeader({ t, activeTab = null, lastTab = null, windows = [], toolIndexShown = false }) {
  const tab = activeTab ?? lastTab ?? 'layers'
  const labelKey = PANEL_TAB_LABELS[tab]
  const ids = openToolIds(windows)
  const toolId = ids.length > 0 ? ids[ids.length - 1] : null
  const entry = toolId ? toolEntry(toolId) : null
  const panelDetail = tab === 'tools' && entry && !toolIndexShown ? t(entry.labelKey) : null
  return { tab, panelLabel: labelKey ? t(labelKey) : t('dock.title'), panelDetail, toolId }
}

/**
 * Context close/clear action for embedded panels whose own `<header>` is hidden
 * inside the unified right rail (`result` analysis/report, `object` details/card).
 */
export function consoleCloseAction({
  t,
  activeTab = null,
  analysis = null,
  reportPreview = null,
  hasObject = false,
  onCloseAnalysis = null,
  onCloseReport = null,
  onCloseObject = null,
}) {
  if (activeTab === 'result') {
    if (reportPreview?.html && typeof onCloseReport === 'function') {
      return { onClosePanel: onCloseReport, closePanelLabel: t('report.close'), closePanelDanger: false }
    }
    if (analysis?.result && typeof onCloseAnalysis === 'function') {
      const label = analysis.operation === 'profile' ? t('profile.clear') : t('layers.analysisClear')
      return { onClosePanel: onCloseAnalysis, closePanelLabel: label, closePanelDanger: true }
    }
  }
  if (activeTab === 'object' && hasObject && typeof onCloseObject === 'function') {
    return { onClosePanel: onCloseObject, closePanelLabel: t('btn.close'), closePanelDanger: false }
  }
  return { onClosePanel: null, closePanelLabel: '', closePanelDanger: false }
}
