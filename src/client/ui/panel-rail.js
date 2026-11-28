/**
 * ui/panel-rail.js — the one right-hand rail of Panel System 2.0.
 *
 * The rail is deliberately dumb: it renders the panel bodies it is given and
 * reports intent (`onActivate` / `onCollapse` / `onExpand`). All rules live in
 * `panel-state.js`, so the same component works for the real workspace and for
 * tests.
 *
 * v1.6.5: the destination's name moved into the console header (the toolbar row
 * above), so the rail no longer repeats it in a second title row — the panel body
 * starts directly under the header. The rail still owns the console width: it is
 * the only width the user drags, and the header follows it through the
 * `--mv-console-width` variable so the top and bottom of the console never
 * disagree.
 *
 * Invariants:
 *   - exactly one visible `role=tabpanel`; every other panel stays mounted
 *     (`hidden`) so drafts and scroll positions survive switches;
 *   - collapsed and expanded share one tree shape, so collapsing never unmounts
 *     a panel;
 *   - no per-tab close button: closing is the panel's own explicit action, and
 *     the rail has exactly one collapse entry.
 */
import React from 'react'

import { ResizeHandle, usePanelResize } from './resizable.js'
import { useEscapeLayer } from './escape-stack.js'

const h = React.createElement

function tabLabel(t, tabId) {
  if (tabId === 'layers') return t('panel.tab.layers')
  if (tabId === 'tools') return t('panel.tab.tools')
  if (tabId === 'places') return t('places.title')
  if (tabId === 'object') return t('panel.tab.object')
  return t('panel.tab.result')
}

export function PanelRail({
  t,
  tabs = [],
  activeTab,
  collapsed = false,
  width = 300,
  panels = [],
  onActivate,
  onCollapse,
  onExpand,
  onWidth,
  ariaLabel = null,
}) {
  // The pre-fix clamp pinned every saved width to the 280px minimum, so a stored
  // 280 is not a user choice; start from the panel-state width instead.
  const resize = usePanelResize({
    storageKey: 'right-stack-2',
    initialWidth: width >= 300 ? width : 300,
    minWidth: 280,
    maxWidth: 720,
  })
  const railRef = React.useRef(null)
  const lastReportedWidth = React.useRef(null)

  React.useEffect(() => {
    const next = resize.size.width
    if (Number.isFinite(next) && next !== lastReportedWidth.current) {
      lastReportedWidth.current = next
      onWidth?.(next)
    }
  }, [resize.size.width, onWidth])

  // The console shell hugs its content, so the rail hands it the one width the
  // toolbar must share. Setting it on the shell (a DOM style, not React state)
  // avoids a re-render of the whole viewer on every drag pixel.
  const syncConsoleWidth = (node, value, isCollapsed = collapsed) => {
    const chrome = node?.closest?.('.mv-chrome')
    if (!chrome?.style) return
    if (!isCollapsed && Number.isFinite(value)) chrome.style.setProperty('--mv-console-width', `${Math.round(value) + 1}px`)
    else chrome.style.removeProperty('--mv-console-width')
  }

  React.useEffect(() => {
    syncConsoleWidth(railRef.current, resize.size.width, collapsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resize.size.width, collapsed])

  const railRefCallback = (node) => {
    railRef.current = node
    if (!node) return
    resize.ref.current = node
    syncConsoleWidth(node, resize.size.width, collapsed)
  }

  // Esc while focus is inside a panel collapses the rail; it never closes data.
  useEscapeLayer((event) => {
    if (collapsed) return false
    const root = railRef.current
    if (!root || typeof root.contains !== 'function' || !root.contains(event.target)) return false
    onCollapse?.()
    return true
  }, !collapsed)

  if (!tabs.length) return null

  return h(
    'div',
    {
      className: `mv-right mv-dock${collapsed ? ' is-collapsed' : ''}`,
      'data-dock': 'right',
      ref: railRefCallback,
      // width comes from the console variable; the panel fills it so both rows
      // of the console are always the same width.
      style: collapsed ? undefined : { width: '100%' },
      'aria-label': ariaLabel ?? undefined,
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
