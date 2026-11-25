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
  const resize = usePanelResize({ storageKey: 'right-stack', initialWidth: width, minWidth: 240, maxWidth: 720 })
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

  const tabList = h(
    'div',
    { className: 'mv-dock-tablist', role: 'tablist', 'aria-label': ariaLabel ?? t('dock.tabs') },
    ...tabs.map((tab) =>
      h(
        'span',
        { key: tab.id, className: `mv-dock-tabitem${tab.id === activeTab ? ' on' : ''}` },
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            id: `mv-dock-tab-${tab.id}`,
            'aria-selected': tab.id === activeTab,
            'aria-controls': `mv-dock-panel-${tab.id}`,
            tabIndex: tab.id === activeTab ? 0 : -1,
            className: `mv-dock-tab${tab.id === activeTab ? ' on' : ''}`,
            title: tabLabel(t, tab.id),
            onClick: () => onActivate?.(tab.id),
            onKeyDown: (event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                const index = tabs.findIndex((item) => item.id === tab.id)
                const delta = event.key === 'ArrowRight' ? 1 : -1
                const next = tabs[(index + delta + tabs.length) % tabs.length]
                if (next) onActivate?.(next.id)
              } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault()
                const next = event.key === 'Home' ? tabs[0] : tabs[tabs.length - 1]
                if (next) onActivate?.(next.id)
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onActivate?.(tab.id)
              }
            },
          },
          h('span', { className: 'mv-dock-tab-icon', 'aria-hidden': true }, tabIcon(tab.id)),
          h('span', { className: 'mv-dock-tab-label' }, tabLabel(t, tab.id)),
          unread[tab.id] ? h('span', { className: 'mv-dock-dot', 'aria-label': t('dock.unread') }) : null,
        ),
      ),
    ),
  )

  const actions = h(
    'div',
    { className: 'mv-dock-actions' },
    h(
      'button',
      {
        type: 'button',
        className: 'mv-icon-btn',
        title: t('dock.collapse'),
        'aria-label': t('dock.collapse'),
        'aria-expanded': true,
        onClick: () => onCollapse?.(),
      },
      '▸',
    ),
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
      className: `mv-right mv-dock mv-glass${collapsed ? ' is-collapsed' : ''}`,
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
    h('div', { className: 'mv-dock-tabs' }, ...(collapsed ? [pill] : [tabList, actions])),
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
            'aria-labelledby': `mv-dock-tab-${panel.id}`,
            className: 'mv-dock-panel',
            hidden: collapsed || panel.id !== activeTab,
          },
          panel.node,
        ),
      ),
    ),
  )
}
