/**
 * ui/panel-rail.js — the one right-hand rail of Panel System 2.0.
 *
 * The rail is deliberately dumb: it renders the tabs and panel bodies it is
 * given and reports intent (`onActivate` / `onCollapse` / `onExpand`). All rules
 * live in `panel-state.js`, so the same component works for the real workspace
 * and for tests.
 *
 * Invariants:
 *   - exactly one visible `role=tabpanel`; every other panel stays mounted
 *     (`hidden`) so drafts and scroll positions survive tab switches;
 *   - collapsed and expanded share one tree shape, so collapsing never unmounts
 *     a panel;
 *   - no per-tab close button: closing is the panel's own explicit action, and
 *     the rail has exactly one collapse entry.
 */
import React from 'react'

import { LayersIcon, ToolEntryIcon, ToolsIcon } from './icons.js'
import { ResizeHandle, usePanelResize } from './resizable.js'
import { useEscapeLayer } from './escape-stack.js'

const h = React.createElement

function tabLabel(t, tabId) {
  if (tabId === 'layers') return t('panel.tab.layers')
  if (tabId === 'tools') return t('panel.tab.tools')
  if (tabId === 'object') return t('panel.tab.object')
  return t('panel.tab.result')
}

function tabIcon(tabId) {
  if (tabId === 'layers') return LayersIcon ? h(LayersIcon) : null
  if (tabId === 'tools') return ToolsIcon ? h(ToolsIcon) : null
  if (tabId === 'object') return h(ToolEntryIcon, { kind: 'select' })
  return h(ToolEntryIcon, { kind: 'analysis' })
}

export function PanelRail({
  t,
  tabs = [],
  activeTab,
  collapsed = false,
  unread = {},
  width = 300,
  panels = [],
  onActivate,
  onCollapse,
  onExpand,
  onWidth,
  ariaLabel = null,
}) {
  const resize = usePanelResize({ storageKey: 'right-stack', initialWidth: width, minWidth: 280, maxWidth: 720 })
  const railRef = React.useRef(null)
  const lastReportedWidth = React.useRef(null)

  React.useEffect(() => {
    const next = resize.size.width
    if (Number.isFinite(next) && next !== lastReportedWidth.current) {
      lastReportedWidth.current = next
      onWidth?.(next)
    }
  }, [resize.size.width, onWidth])

  // Esc while focus is inside a panel collapses the rail; it never closes data.
  useEscapeLayer((event) => {
    if (collapsed) return false
    const root = railRef.current
    if (!root || typeof root.contains !== 'function' || !root.contains(event.target)) return false
    onCollapse?.()
    return true
  }, !collapsed)

  if (!tabs.length) return null

  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.id

  // One navigation level only: the toolbar quick group is the switcher; the
  // dock body carries just the active destination as a section title.
  const activeName = activeLabel ? tabLabel(t, activeLabel) : t('dock.title')
  const head = h(
    'div',
    { className: 'mv-dock-head' },
    h('span', { className: 'mv-dock-head-icon', 'aria-hidden': true }, tabIcon(activeLabel)),
    h('span', { className: 'mv-dock-head-title' }, activeName),
    tabs.some((tab) => unread[tab.id])
      ? h('span', { className: 'mv-dock-dot', role: 'status', 'aria-label': t('dock.unread') })
      : null,
  )

  const unreadCount = tabs.filter((tab) => unread[tab.id]).length
  const pill = h(
    'button',
    {
      type: 'button',
      className: 'mv-dock-pill',
      title: t('dock.expand'),
      'aria-label': t('dock.expand'),
      'aria-expanded': false,
      onClick: () => onExpand?.(),
    },
    h('span', { className: 'mv-dock-pill-icon', 'aria-hidden': true }, tabIcon(activeLabel)),
    h('span', { className: 'mv-dock-pill-label' }, activeLabel ? tabLabel(t, activeLabel) : t('dock.title')),
    unreadCount > 0 ? h('span', { className: 'mv-dock-badge', 'aria-label': t('dock.unread') }, String(unreadCount)) : null,
    h('span', { className: 'mv-dock-pill-arrow', 'aria-hidden': true }, '◂'),
  )

  return h(
    'div',
    {
      className: `mv-right mv-dock${collapsed ? ' is-collapsed' : ''}`,
      'data-dock': 'right',
      ref: collapsed
        ? railRef
        : (node) => {
            railRef.current = node
            resize.ref.current = node
          },
      style: collapsed ? undefined : resize.style,
    },
    collapsed
      ? null
      : h(ResizeHandle, {
          axis: 'width',
          edge: 'left',
          label: t('resize.width'),
          value: resize.size.width,
          onPointerDown: resize.beginWidth,
          onKeyDown: resize.keyWidth,
          min: resize.minWidth,
          max: resize.maxWidth,
        }),
    h('div', { className: 'mv-dock-tabs' }, ...(collapsed ? [pill] : [head])),
    h(
      'div',
      { className: 'mv-dock-body' },
      ...panels.map((panel) =>
        h(
          'div',
          {
            key: panel.id,
            id: `mv-dock-panel-${panel.id}`,
            role: 'tabpanel',
            'aria-label': tabLabel(t, panel.id),
            className: 'mv-dock-panel',
            hidden: collapsed || panel.id !== activeTab,
          },
          panel.node,
        ),
      ),
    ),
  )
}
