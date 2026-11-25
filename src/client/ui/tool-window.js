/**
 * ui/tool-window.js — the concrete panel a toolbox entry opens.
 *
 * One window at a time, opened above the index it belongs to. Supports three
 * clear window controls matching desktop expectations: zoom/expand height,
 * minimize to its title bar (preserving active canvas tool state), and close,
 * plus drag-resizable height persisted via localStorage.
 */
import React from 'react'

import { ToolEntryIcon } from './icons.js'
import { ResizeHandle, usePanelResize } from './resizable.js'
import { mergeRefs, useFloatingWindow } from './floating.js'

const h = React.createElement

export function ToolWindow({
  t,
  entry,
  minimized = false,
  expanded = false,
  autoFloat = false,
  forceFloat = false,
  embedded = false,
  floatIndex = 0,
  dockEmpty = false,
  onFloatingChange,
  onToggleMinimize,
  onToggleExpand,
  onClose,
  children,
}) {
  const resize = usePanelResize({
    storageKey: 'tool-window',
    widthDirection: 'right',
    initialWidth: null,
    minWidth: 240,
    maxWidth: 680,
    initialHeight: 260,
    minHeight: 150,
    maxHeight: 560,
  })
  const label = entry ? t(entry.labelKey) : ''
  const floating = useFloatingWindow({
    storageKey: entry ? `toolwin.${entry.id}` : 'toolwin.none',
    title: label,
    t,
    autoFloat,
    forceFloat,
    floatIndex,
    dockEmpty,
    restoreSaved: false,
    hasExplicitWidth: Boolean(resize.size.width),
  })
  React.useEffect(() => {
    onFloatingChange?.(floating.moved)
  }, [floating.moved, onFloatingChange])
  if (!entry) return null
  const toggleLabel = minimized ? t('tools.windowExpand') : t('tools.windowMinimize')
  const zoomLabel = expanded ? t('tools.windowRestore') : t('tools.windowZoom')
  const dockedResize = { height: resize.style?.height, maxHeight: resize.style?.maxHeight }
  const baseStyle = floating.moved
    ? { ...floating.style, ...resize.style }
    : { ...floating.style, ...dockedResize }
  const bodyStyle = embedded
    ? undefined
    : minimized
      ? floating.moved
        ? floating.style
        : undefined
      : expanded
        ? { ...baseStyle, height: 'min(480px, 60vh)', maxHeight: 'none', flex: '0 0 auto' }
        : baseStyle

  return h(
    'section',
    {
      className: `mv-toolwin mv-glass ${floating.className}${minimized ? ' minimized' : ''}${expanded && !minimized ? ' expanded' : ''}${embedded ? ' in-dock' : ''}`,
      ref: mergeRefs(floating.ref, resize.ref),
      style: bodyStyle,
      'aria-label': label,
      ...floating.panelProps,
    },
    h(
      'header',
      floating.headerProps,
      floating.dragHandle,
      h(
        'span',
        { className: 'mv-toolwin-title' },
        h('span', { className: 'mv-toolwin-badge' }, h(ToolEntryIcon, { kind: entry.icon, size: 14 })),
        h('span', null, label),
      ),
      h(
        'div',
        { className: 'mv-head-actions' },
        floating.resetButton,
        typeof onToggleExpand === 'function'
          ? h(
              'button',
              {
                type: 'button',
                className: `mv-icon-btn${expanded && !minimized ? ' on' : ''}`,
                title: zoomLabel,
                'aria-label': zoomLabel,
                'aria-pressed': expanded && !minimized,
                onClick: onToggleExpand,
              },
              expanded && !minimized ? '⤡' : '⤢',
            )
          : null,
        h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn',
            title: toggleLabel,
            'aria-label': toggleLabel,
            'aria-expanded': !minimized,
            onClick: onToggleMinimize,
          },
          minimized ? '▸' : '▾',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn',
            title: t('tools.windowClose'),
            'aria-label': t('tools.windowClose'),
            onClick: onClose,
          },
          '✕',
        ),
      ),
    ),
    floating.liveRegion,
    minimized && !embedded ? null : h('div', { className: 'mv-toolwin-body' }, children),
    minimized || expanded
      ? null
      : h(ResizeHandle, {
          axis: 'height',
          edge: 'bottom',
          label: t('resize.height'),
          value: resize.size.height,
          onPointerDown: resize.beginHeight,
          onKeyDown: resize.keyHeight,
          min: resize.minHeight,
          max: resize.maxHeight,
        }),
    minimized || expanded || !floating.moved
      ? null
      : h(ResizeHandle, {
          axis: 'corner',
          edge: 'corner',
          label: t('resize.size'),
          value: resize.size.width,
          onPointerDown: resize.beginCorner,
          onKeyDown: resize.keyWidth,
          min: resize.minWidth,
          max: resize.maxWidth,
        }),
  )
}
