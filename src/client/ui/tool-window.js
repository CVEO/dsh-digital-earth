/**
 * ui/tool-window.js — the concrete panel a toolbox entry opens.
 *
 * One window at a time, opened above the index it belongs to. It can be minimized
 * to its title bar (the canvas keeps the tool state) and closed, and it remembers
 * its height in the same panel-size slot family as the other cards. It never
 * floats over the canvas: the right column is the only owner of layout, so narrow
 * docked layouts cannot end up with a window half off-screen.
 */
import React from 'react'

import { ToolEntryIcon } from './icons.js'
import { ResizeHandle, usePanelResize } from './resizable.js'

const h = React.createElement

export function ToolWindow({ t, entry, minimized = false, onToggleMinimize, onClose, children }) {
  const resize = usePanelResize({ storageKey: 'tool-window', initialHeight: 260, minHeight: 150, maxHeight: 560 })
  if (!entry) return null
  const label = t(entry.labelKey)
  const toggleLabel = minimized ? t('tools.windowExpand') : t('tools.windowMinimize')
  return h(
    'section',
    {
      className: `mv-toolwin mv-glass${minimized ? ' minimized' : ''}`,
      ref: resize.ref,
      style: minimized ? undefined : resize.style,
      'aria-label': label,
    },
    h(
      'header',
      null,
      h('span', { className: 'mv-toolwin-title' }, h(ToolEntryIcon, { kind: entry.icon }), h('span', null, label)),
      h(
        'div',
        { className: 'mv-head-actions' },
        h('button', { type: 'button', className: 'mv-icon-btn', title: toggleLabel, 'aria-label': toggleLabel, 'aria-expanded': !minimized, onClick: onToggleMinimize }, minimized ? '▸' : '▾'),
        h('button', { type: 'button', className: 'mv-icon-btn', title: t('tools.windowClose'), 'aria-label': t('tools.windowClose'), onClick: onClose }, '✕'),
      ),
    ),
    minimized ? null : h('div', { className: 'mv-toolwin-body' }, children),
    minimized
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
