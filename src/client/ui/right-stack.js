/**
 * ui/right-stack.js — the right-hand floating column.
 *
 * Keeps ViewerSurface from owning the growing prop plumbing of the analysis,
 * layer and tools cards. The three cards share one column so an analysis result
 * never overlaps the layer list; layers and tools are separate cards by design
 * (data vs. functions), each independently closable.
 */
import React from 'react'

import { AnalysisCard } from './cards.js'
import { LayersPanel } from './layers-panel.js'
import { ToolsPanel } from './tools-panel.js'
import { ToolWindow } from './tool-window.js'
import { ToolBody } from './tool-windows.js'
import { toolEntry } from './tool-catalog.js'
import { ResizeHandle, usePanelResize } from './resizable.js'

const h = React.createElement

export function RightStack({
  t,
  analysis,
  onCloseAnalysis,
  analysisHover,
  onAnalysisHover,
  layersPanel,
  showLayers,
  toolsPanel,
  showTools,
  openWindows = [],
  onSelectTool,
  onCloseToolWindow,
  onToggleMinimizeTool,
  onToggleExpandTool,
}) {
  const resize = usePanelResize({ storageKey: 'right-stack', initialWidth: 300, minWidth: 240, maxWidth: 720 })
  const visibleWindows = Array.isArray(openWindows) ? openWindows.filter((win) => Boolean(toolEntry(win?.id))) : []
  if (!analysis && !showLayers && !showTools && visibleWindows.length === 0) return null
  const dockEmpty = !analysis && !showLayers && !showTools
  return h(
    'div',
    { className: 'mv-right', ref: resize.ref, style: resize.style },
    h(ResizeHandle, {
      axis: 'width',
      edge: 'left',
      label: t('resize.width'),
      value: resize.size.width,
      onPointerDown: resize.beginWidth,
      onKeyDown: resize.keyWidth,
    }),
    analysis
      ? h(AnalysisCard, {
          key: 'analysis',
          state: analysis,
          t,
          onClose: onCloseAnalysis,
          hoverIndex: analysisHover,
          onHover: onAnalysisHover,
          onStartProfile: toolsPanel?.onStartProfile,
        })
      : null,
    ...visibleWindows.map((win, idx) => {
      const entry = toolEntry(win.id)
      return h(
        ToolWindow,
        {
          key: `win-${win.id}`,
          t,
          entry,
          minimized: Boolean(win.minimized),
          expanded: Boolean(win.expanded),
          autoFloat: true,
          floatIndex: idx,
          dockEmpty,
          onToggleMinimize: () => onToggleMinimizeTool?.(win.id),
          onToggleExpand: () => onToggleExpandTool?.(win.id),
          onClose: () => onCloseToolWindow?.(win.id),
        },
        h(ToolBody, {
          t,
          ...(toolsPanel ?? {}),
          entryId: win.id,
          openRequest: toolsPanel?.openRequest?.id === win.id ? toolsPanel.openRequest : null,
        }),
      )
    }),
    showLayers ? h(LayersPanel, { key: 'layers', t, ...layersPanel }) : null,
    showTools
      ? h(ToolsPanel, {
          key: 'tools',
          t,
          ...(toolsPanel ?? {}),
          openWindows: visibleWindows,
          onSelectTool,
          onCloseTool: onCloseToolWindow,
        })
      : null,
  )
}
