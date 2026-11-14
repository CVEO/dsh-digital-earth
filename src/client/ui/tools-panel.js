/**
 * ui/tools-panel.js — the toolbox: an independent LAUNCHER INDEX of tools.
 *
 * The active tool windows (Selection, Measure, Analysis, etc.) live outside this
 * drawer in RightStack / ToolWorkspace, so collapsing Tools never closes or
 * cancels Selection or any other opened workbench.
 */
import React from 'react'

import { ResizeHandle, usePanelResize } from './resizable.js'
import { mergeRefs, useFloatingWindow } from './floating.js'
import { TOOLS_MINIMIZED_KEY, readPanelFlag, writePanelFlag } from './panel-prefs.js'
import { TOOL_ENTRIES, toolEntry } from './tool-catalog.js'
import { ToolEntryIcon } from './icons.js'

const h = React.createElement

export function ToolsPanel({
  t,
  openWindows = [],
  onSelectTool,
  onCollapse,
}) {
  const resize = usePanelResize({
    storageKey: 'tools',
    widthDirection: 'right',
    initialWidth: null,
    minWidth: 220,
    maxWidth: 620,
    initialHeight: null,
    minHeight: 160,
    maxHeight: 700,
  })
  const floating = useFloatingWindow({
    storageKey: 'tools',
    title: t('tools.title'),
    t,
    hasExplicitWidth: Boolean(resize.size.width),
  })
  const [indexMinimized, setIndexMinimized] = React.useState(() => readPanelFlag(TOOLS_MINIMIZED_KEY, false))

  const activeEntries = (Array.isArray(openWindows) ? openWindows : [])
    .map((win) => toolEntry(typeof win === 'string' ? win : win?.id))
    .filter(Boolean)
  const openSet = new Set(activeEntries.map((item) => item.id))

  const toggleIndexMinimized = () => {
    setIndexMinimized((value) => {
      const next = !value
      writePanelFlag(TOOLS_MINIMIZED_KEY, next)
      return next
    })
  }

  const row = (item) => {
    const active = openSet.has(item.id)
    return h(
      'button',
      {
        key: item.id,
        type: 'button',
        className: `mv-tool-entry${active ? ' on' : ''}`,
        'aria-pressed': active,
        title: t(item.hintKey),
        onClick: () => onSelectTool?.(item.id),
      },
      h('span', { className: 'mv-tool-entry-icon' }, h(ToolEntryIcon, { kind: item.icon })),
      h('span', { className: 'mv-tool-entry-name' }, t(item.labelKey)),
      active ? h('span', { className: 'mv-tool-entry-dot', 'aria-hidden': true }) : null,
    )
  }

  const panelStyle = indexMinimized
    ? floating.moved
      ? floating.style
      : { zIndex: floating.zIndex }
    : floating.moved
      ? { ...floating.style, ...resize.style }
      : { ...floating.style, height: resize.style?.height, maxHeight: resize.style?.maxHeight }

  return h(
    'div',
    {
      className: `mv-tools mv-glass ${floating.className}${indexMinimized ? ' minimized' : ''}`,
      ref: mergeRefs(floating.ref, resize.ref),
      style: panelStyle,
      ...floating.panelProps,
    },
    h(
      'header',
      floating.headerProps,
      floating.dragHandle,
      h(
        'span',
        { className: 'mv-tools-title' },
        h('span', null, t('tools.title')),
        activeEntries.length > 0 && !indexMinimized
          ? h('span', { className: 'mv-tools-count' }, t('tools.openCount', { n: activeEntries.length }))
          : null,
        indexMinimized
          ? activeEntries.map((entry) =>
              h(
                'button',
                {
                  key: entry.id,
                  type: 'button',
                  className: 'mv-tools-active-pill',
                  onClick: () => onSelectTool?.(entry.id),
                },
                t(entry.labelKey),
              ),
            )
          : null,
      ),
      h(
        'div',
        { className: 'mv-head-actions' },
        floating.resetButton,
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
    floating.liveRegion,
    indexMinimized
      ? null
      : h(
          'div',
          { className: 'mv-tool-index-wrap' },
          h('div', { className: 'mv-tool-index', role: 'group', 'aria-label': t('tools.index') }, ...TOOL_ENTRIES.map(row)),
          h('p', { className: 'mv-tools-hint' }, t('tools.independentHint')),
        ),
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
    indexMinimized || !floating.moved
      ? null
      : h(ResizeHandle, {
          axis: 'corner',
          edge: 'corner',
          label: t('resize.size'),
          value: resize.size.width,
          onPointerDown: resize.beginCorner,
          onKeyDown: resize.keyWidth,
        }),
  )
}
