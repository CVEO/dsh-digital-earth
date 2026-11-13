/**
 * ui/tools-panel.js — the toolbox: an INDEX of tool entry points.
 *
 * Meeting 2026-11-12: the old card rendered every control of every tool inline, so
 * the entry points were buried in a long scroll. It now lists one row per tool;
 * clicking a row opens that tool's panel above the index (ui/tool-window.js) and
 * the actual controls live in ui/tool-windows.js. Data layers stay in the layer
 * card, so this file never renders a layer list.
 *
 * Presentational apart from "which window is open / minimized", which is pure UI
 * state and stays here instead of leaking into ViewerSurface.
 */
import React from 'react'

import { ResizeHandle, usePanelResize } from './resizable.js'
import { TOOLS_MINIMIZED_KEY, readPanelFlag, writePanelFlag } from './panel-prefs.js'
import { TOOL_ENTRIES, selectToolWindow, toolEntry } from './tool-catalog.js'
import { ToolEntryIcon } from './icons.js'
import { ToolBody } from './tool-windows.js'
import { ToolWindow } from './tool-window.js'

const h = React.createElement

export function ToolsPanel({
  t,
  tool,
  analysis,
  shaderActive,
  onCollapse,
  onStartTool,
  onClearMeasure,
  onStartProfile,
  onStartAnnotation,
  onAdoptParse,
  onClearAnalysis,
  onOpenShader,
  getCesium,
  getViewer,
  getLayers,
  getCurrentView,
  onFlyView,
  onStartTour,
  showToast,
  runAnalysis,
  getTerrainActive,
  getOverlayRows,
  onRemoveOverlayRows,
  onAskSelection,
  onVisionSelect,
  onActivateSelection,
}) {
  const resize = usePanelResize({ storageKey: 'tools', initialHeight: null, minHeight: 160, maxHeight: 700 })
  const [openTool, setOpenTool] = React.useState(null)
  const [minimized, setMinimized] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const [indexMinimized, setIndexMinimized] = React.useState(() => readPanelFlag(TOOLS_MINIMIZED_KEY, false))
  const entry = toolEntry(openTool)

  const openToolById = (id) => {
    const next = selectToolWindow({ openTool, minimized }, id)
    setOpenTool(next.openTool)
    setMinimized(next.minimized)
    if (next.openTool !== openTool) setExpanded(false)
  }

  const toggleIndexMinimized = () => {
    setIndexMinimized((value) => {
      const next = !value
      writePanelFlag(TOOLS_MINIMIZED_KEY, next)
      return next
    })
  }

  // A tool window opens with a hint of what it is for, and the row that owns it
  // reads as active so the two surfaces never disagree.
  const row = (item) =>
    h(
      'button',
      {
        key: item.id,
        type: 'button',
        className: `mv-tool-entry${openTool === item.id ? ' on' : ''}`,
        'aria-pressed': openTool === item.id,
        title: t(item.hintKey),
        onClick: () => openToolById(item.id),
      },
      h('span', { className: 'mv-tool-entry-icon' }, h(ToolEntryIcon, { kind: item.icon })),
      h('span', { className: 'mv-tool-entry-name' }, t(item.labelKey)),
      openTool === item.id ? h('span', { className: 'mv-tool-entry-dot', 'aria-hidden': true }) : null,
    )

  const bodyProps = {
    t,
    tool,
    analysis,
    shaderActive,
    onStartTool,
    onClearMeasure,
    onStartProfile,
    onStartAnnotation,
    onAdoptParse,
    onClearAnalysis,
    onOpenShader,
    getCesium,
    getViewer,
    getLayers,
    getCurrentView,
    onFlyView,
    onStartTour,
    showToast,
    runAnalysis,
    getTerrainActive,
    getOverlayRows,
    onRemoveOverlayRows,
    onAskSelection,
    onVisionSelect,
    onActivateSelection,
  }

  return h(
    React.Fragment,
    null,
    entry
      ? h(
          ToolWindow,
          {
            t,
            entry,
            minimized,
            expanded,
            onToggleMinimize: () => setMinimized((value) => !value),
            onToggleExpand: () => {
              setMinimized(false)
              setExpanded((value) => !value)
            },
            onClose: () => {
              setOpenTool(null)
              setMinimized(false)
              setExpanded(false)
            },
          },
          h(ToolBody, { entryId: entry.id, ...bodyProps }),
        )
      : null,
    h(
      'div',
      { className: `mv-tools mv-glass${indexMinimized ? ' minimized' : ''}`, ref: resize.ref, style: indexMinimized ? undefined : resize.style },
      h(
        'header',
        null,
        h(
          'span',
          { className: 'mv-tools-title' },
          h('span', null, t('tools.title')),
          entry && indexMinimized ? h('span', { className: 'mv-tools-active-pill' }, t(entry.labelKey)) : null,
        ),
        h(
          'div',
          { className: 'mv-head-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'mv-icon-btn',
              title: t(indexMinimized ? 'tools.indexExpand' : 'tools.indexMinimize'),
              'aria-label': t(indexMinimized ? 'tools.indexExpand' : 'tools.indexMinimize'),
              'aria-expanded': !indexMinimized,
              onClick: toggleIndexMinimized,
            },
            indexMinimized ? '▸' : '▾',
          ),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('tools.collapse'), 'aria-label': t('tools.collapse'), onClick: onCollapse }, '✕'),
        ),
      ),
      indexMinimized ? null : h('div', { className: 'mv-tool-index', role: 'group', 'aria-label': t('tools.index') }, ...TOOL_ENTRIES.map(row)),
      indexMinimized
        ? null
        : h(ResizeHandle, {
            axis: 'height',
            edge: 'bottom',
            label: t('resize.height'),
            value: resize.size.height,
            onPointerDown: resize.beginHeight,
            onKeyDown: resize.keyHeight,
          }),
    ),
  )
}
