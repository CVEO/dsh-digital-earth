/**
 * ui/topbar.js — the top strip of the panel: brand/status + the five entries.
 *
 * One axis, left to right: **data in → work → look → take away → configure**
 *
 *   数据 ▾ | 场景 · 工具 · 结果 | 视图 ▾ | 输出 ▾ | ⚙
 *
 * - 数据 / 视图 / 输出 are menus because they are action sets;
 * - 场景 / 工具 / 结果 are the rail's three destinations, drawn as one segmented
 *   group so they read as "one workspace", not three unrelated buttons;
 * - the domain's name and the menu's content match: 输出 no longer hides the HUD
 *   toggle, 视图 no longer hides the screenshot.
 *
 * Menu open state and the outside-click / Escape effect stay in ViewerSurface
 * (the recents refresh keys off `openMenu`); this component is presentation only.
 */
import React from 'react'

import { GlyphIcon, ViewerIcon } from './icons.js'
import { MenuItem } from './menu-item.js'
import { dataMenuItems } from './data-menu.js'
import { outputMenuItems } from './toolbar-output.js'
import { viewMenuItems } from './toolbar-view.js'
import { ToolbarQuick } from './toolbar-quick.js'
import { ToolbarSettings } from './toolbar-settings.js'

const h = React.createElement

export function TopBar({
  t,
  status,
  menuRef,
  openMenu,
  setOpenMenu,
  data,
  view,
  output,
  quick,
  onOpenSettings,
}) {
  const closeMenu = () => setOpenMenu(null)
  const menu = (id, label, items, icon) =>
    h(
      'div',
      { key: id, className: `mv-menu mv-data-menu${openMenu === id ? ' open' : ''}` },
      h(
        'button',
        {
          type: 'button',
          className: `mv-btn${openMenu === id ? ' on' : ''}`,
          'aria-haspopup': 'menu',
          'aria-expanded': openMenu === id,
          onClick: () => setOpenMenu(openMenu === id ? null : id),
        },
        icon ? h('span', { className: 'mv-btn-icon', 'aria-hidden': true }, icon) : null,
        h('span', { className: 'mv-btn-label' }, `${label} ▾`),
      ),
      openMenu === id
        ? h('div', { className: 'mv-menu-panel mv-glass', role: 'menu', 'aria-label': label }, items)
        : null,
    )

  return h(
    'div',
    { key: 'top', className: `mv-top${openMenu ? ' menu-open' : ''}` },
    h(
      'div',
      { className: 'mv-brand mv-glass' },
      h(ViewerIcon, { size: 18 }),
      h('b', null, t('panel.title')),
      status ? h('span', { className: 'mv-brand-status', role: 'status' }, status) : null,
    ),
    h(
      'div',
      { ref: menuRef, className: 'mv-actions mv-glass' },
      menu(
        'data',
        t('btn.data'),
        dataMenuItems({ h, MenuItem, t, closeMenu, ...data }),
        h(GlyphIcon, { name: 'folder' }),
      ),
      h('i', { key: 's1', className: 'mv-sep' }),
      h('div', { key: 'quick', className: 'mv-quick', role: 'group', 'aria-label': t('panel.title') }, h(ToolbarQuick, { t, ...quick })),
      h('i', { key: 's2', className: 'mv-sep' }),
      menu('view', t('btn.view'), viewMenuItems({ h, MenuItem, t, closeMenu, ...view }), h(GlyphIcon, { name: 'view' })),
      menu('output', t('btn.output'), outputMenuItems({ h, MenuItem, t, closeMenu, ...output }), h(GlyphIcon, { name: 'export' })),
      h(ToolbarSettings, { t, setSettingsOpen: onOpenSettings }),
    ),
  )
}
