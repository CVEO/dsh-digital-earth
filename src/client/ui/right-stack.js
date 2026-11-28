/**
 * ui/right-stack.js — adapter between the viewer state and the panel rail.
 *
 * v1.7 Panel System 2.0: this file no longer owns tab/float rules. It maps the
 * viewer's data (layers, tool workspace, analysis result, object selection) onto
 * the four destinations of `panel-state.js` and renders them through the single
 * `panel-rail.js`. The old stacking/floating code is gone; a panel can only be
 * docked, one at a time, in the right rail.
 */
import React from 'react'

import { AnalysisCard } from './cards.js'
import { LayersPanel } from './layers-panel.js'
import { PlaceSearchPanel } from './place-search.js'
import { ToolsPanel } from './tools-panel.js'
import { ToolWindow } from './tool-window.js'
import { ToolBody } from './tool-windows.js'
import { toolEntry } from './tool-catalog.js'
import { PanelRail } from './panel-rail.js'
import { ReportPreview } from './report-preview.js'
import {
  panelReducer,
  readPanelState,
  visiblePanelTabs,
  writePanelState,
} from './panel-state.js'

const h = React.createElement

function ResultEmpty({ t }) {
  return h(
    'div',
    { className: 'mv-panel-empty' },
    h('h3', null, t('panel.result.emptyTitle')),
    h('p', null, t('panel.result.emptyBody')),
  )
}

export function RightStack({
  t,
  analysis,
  onCloseAnalysis,
  reportPreview = null,
  onCloseReport,
  analysisHover,
  onAnalysisHover,
  layersPanel,
  showLayers,
  toolsPanel,
  showTools,
  placesPanel = null,
  openWindows = [],
  onSelectTool,
  onCloseToolWindow,
  busy = false,
  dockRequest = null,
  objectPanel = null,
  onActiveTab,
  onUnread,
  // Master/detail of the tools destination. The console header owns the back
  // affordance, so the state is lifted to the viewer: the header can show
  // "工具 · 量测" and switch back without a second label row inside the panel.
  showToolIndex = false,
  onShowToolIndex,
}) {
  const windows = Array.isArray(openWindows) ? openWindows : []
  const windowIds = windows.map((win) => (typeof win === 'string' ? win : win?.id)).filter(Boolean)
  const activeToolId = windowIds.length ? windowIds[windowIds.length - 1] : null
  const hasResult = Boolean(analysis?.result)
  const hasObject = Boolean(objectPanel?.key)
  const available = visiblePanelTabs({ hasResult, hasObject }).filter((id) => {
    if (id === 'layers') return Boolean(showLayers)
    if (id === 'tools') return Boolean(showTools || activeToolId)
    if (id === 'places') return Boolean(placesPanel)
    return true
  })
  const availableSignature = available.join('|')

  const [state, setState] = React.useState(() =>
    panelReducer(readPanelState(), { type: 'prune', available }),
  )
  const dispatch = React.useCallback((action) => setState((current) => panelReducer(current, action)), [])

  // Keep the active tab valid when a panel closes/disappears.
  React.useEffect(() => {
    dispatch({ type: 'prune', available })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSignature])

  React.useEffect(() => {
    writePanelState(state)
  }, [state])

  React.useEffect(() => {
    onActiveTab?.(state.collapsed ? null : state.activeTab)
  }, [state.activeTab, state.collapsed, onActiveTab])

  React.useEffect(() => {
    onUnread?.(state.unread)
  }, [state.unread.result, state.unread.object, onUnread])

  // Automatic result focus follows the confirmed policy: only an idle, expanded
  // rail switches; otherwise the result tab gets an unread dot.
  const prevResultRef = React.useRef(analysis?.result)
  const lockedByTool = Boolean(activeToolId) && state.activeTab === 'tools'
  React.useEffect(() => {
    const result = analysis?.result
    if (result && result !== prevResultRef.current) dispatch({ type: 'resultArrived', busy: busy || lockedByTool })
    prevResultRef.current = result
  }, [analysis?.result, busy, lockedByTool])

  const prevObjectRef = React.useRef(objectPanel?.key)
  React.useEffect(() => {
    const key = objectPanel?.key
    if (key && key !== prevObjectRef.current) dispatch({ type: 'objectArrived', busy: busy || lockedByTool })
    else if (!key) dispatch({ type: 'objectCleared' })
    prevObjectRef.current = key
  }, [objectPanel?.key, busy, lockedByTool])

  const prevReportRef = React.useRef(null)
  React.useEffect(() => {
    const key = reportPreview?.key
    if (key && key !== prevReportRef.current) dispatch({ type: 'activate', tabId: 'result' })
    prevReportRef.current = key
  }, [reportPreview?.key, dispatch])

  // Toolbar domain buttons: focus the destination, or toggle the rail closed when
  // it is already the active destination. No panel is closed by a toolbar click.
  const pendingRequestRef = React.useRef(null)
  React.useEffect(() => {
    if (!dockRequest?.kind) return
    pendingRequestRef.current = ['layers', 'tools', 'places', 'result', 'object'].includes(dockRequest.kind) ? dockRequest.kind : null
  }, [dockRequest?.seq, dockRequest?.kind])
  React.useEffect(() => {
    const tabId = pendingRequestRef.current
    if (!tabId) return
    if (!available.includes(tabId)) return
    pendingRequestRef.current = null
    dispatch({ type: 'toggle', tabId })
  }, [dockRequest?.seq, availableSignature])

  if (!available.length) return null

  const panels = []
  if (showLayers) {
    panels.push({
      id: 'layers',
      node: h(LayersPanel, { key: 'layers', t, ...(layersPanel ?? {}), embedded: true }),
    })
  }
  if (showTools || activeToolId) {
    const entry = activeToolId ? toolEntry(activeToolId) : null
    const detail = activeToolId && entry && !showToolIndex
    panels.push({
      id: 'tools',
      node: detail
        ? h(
            'div',
            { key: 'tools', className: 'mv-panel-detail' },
            h(
              ToolWindow,
              {
                t,
                entry,
                embedded: true,
                onClose: () => {
                  onShowToolIndex?.(true)
                  onCloseToolWindow?.(activeToolId)
                },
              },
              h(ToolBody, {
                t,
                ...(toolsPanel ?? {}),
                entryId: activeToolId,
                openRequest: toolsPanel?.openRequest?.id === activeToolId ? toolsPanel.openRequest : null,
              }),
            ),
          )
        : h(ToolsPanel, {
            key: 'tools',
            t,
            ...(toolsPanel ?? {}),
            embedded: true,
            onSelectTool: (toolId) => {
              onShowToolIndex?.(false)
              onSelectTool?.(toolId)
            },
            onCloseTool: onCloseToolWindow,
          }),
    })
  }
  if (placesPanel) {
    panels.push({ id: 'places', node: h(PlaceSearchPanel, { key: 'places', t, ...placesPanel }) })
  }
  if (reportPreview?.html) {
    panels.push({
      id: 'result',
      node: h(ReportPreview, { key: 'report-preview', t, report: reportPreview, onClose: onCloseReport }),
    })
  } else if (hasResult) {
    panels.push({
      id: 'result',
      node: h(AnalysisCard, {
        key: 'result',
        state: analysis,
        t,
        onClose: onCloseAnalysis,
        hoverIndex: analysisHover,
        onHover: onAnalysisHover,
        onStartProfile: toolsPanel?.onStartProfile,
        embedded: true,
      }),
    })
  } else {
    panels.push({ id: 'result', node: h(ResultEmpty, { key: 'result', t }) })
  }
  if (hasObject) {
    panels.push({ id: 'object', node: h('div', { key: 'object', className: 'mv-panel-object' }, objectPanel.node) })
  }

  return h(PanelRail, {
    t,
    tabs: available.map((id) => ({ id })),
    activeTab: state.activeTab,
    collapsed: state.collapsed,
    width: state.width,
    panels,
    onActivate: (tabId) => dispatch({ type: 'activate', tabId }),
    onCollapse: () => dispatch({ type: 'collapse' }),
    onExpand: () => dispatch({ type: 'expand' }),
    onWidth: (width) => dispatch({ type: 'setWidth', width }),
  })
}
