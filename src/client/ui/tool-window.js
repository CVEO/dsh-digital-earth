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

const h = React.createElement

export function ToolWindow({
  t,
  entry,
  minimized = false,
  expanded = false,
  onToggleMinimize,
  onToggleExpand,
  onClose,
  children,
}) {
  const resize = usePanelResize({ storageKey: 'tool-window', initialHeight: 260, minHeight: 150, maxHeight: 560 })
  if (!entry) return null
  const label = t(entry.labelKey)
  const toggleLabel = minimized ? t('tools.windowExpand') : t('tools.windowMinimize')
  const zoomLabel = expanded ? t('tools.windowRestore') : t('tools.windowZoom')
  const bodyStyle = minimized
    ? undefined
    : expanded
      ? { ...resize.style, height: 'min(480px, 60vh)', maxHeight: 'none', flex: '0 0 auto' }
      : resize.style

  return h(
    'section',
    {
      className: `mv-toolwin mv-glass${minimized ? ' minimized' : ''}${expanded && !minimized ? ' expanded' : ''}`,
      ref: resize.ref,
      style: bodyStyle,
      'aria-label': label,
    },
    h(
      'header',
      null,
      h(
        'span',
        { className: 'mv-toolwin-title' },
        h('span', { className: 'mv-toolwin-badge' }, h(ToolEntryIcon, { kind: entry.icon, size: 14 })),
        h('span', null, label),
      ),
      h(
        'div',
        { className: 'mv-head-actions' },
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
    minimized ? null : h('div', { className: 'mv-toolwin-body' }, children),
    minimized || expanded
      ? null
      : h(ResizeHandle, {
          axis: 'height',
          edge: 'bottom',
          label: t('resize.height'),
          value: resize.size.height,
          onPointerDown: resize.beginHeight,
          onKeyDown: resize.keyHeight,
        }),
  )
}
