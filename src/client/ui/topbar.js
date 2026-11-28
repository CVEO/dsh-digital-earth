/** Console header, action menus and workspace navigation. ViewerSurface owns menu state. */
import React from 'react'

import { GlyphIcon } from './icons.js'
import { MenuItem } from './menu-item.js'
import { dataMenuItems } from './data-menu.js'
import { outputMenuItems } from './toolbar-output.js'
import { viewMenuItems } from './toolbar-view.js'
import { ToolbarQuick } from './toolbar-quick.js'
import { ToolbarSettings } from './toolbar-settings.js'

const h = React.createElement

export function TopBar({
  t,
  menuRef,
  openMenu,
  setOpenMenu,
  data,
  view,
  output,
  quick,
  panelLabel = '',
  panelDetail = null,
  onBack = null,
  onClosePanel = null,
  closePanelLabel = '',
  closePanelDanger = false,
  onOpenSettings,
  onToggleChrome,
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
          'data-mv-menu': id,
          'aria-haspopup': 'menu',
          'aria-expanded': openMenu === id,
          'aria-label': label,
          title: label,
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
      { key: 'head', className: 'mv-top-head' },
      panelDetail && typeof onBack === 'function'
        ? h(
            'button',
            {
              type: 'button',
              className: 'mv-top-back',
              title: t('dock.back'),
              'aria-label': t('dock.back'),
              onClick: onBack,
            },
            '‹',
          )
        : null,
      h('span', { key: 'title', className: 'mv-top-title', title: panelLabel }, panelLabel),
      panelDetail ? h('span', { key: 'detail', className: 'mv-top-detail', title: panelDetail }, `· ${panelDetail}`) : null,
      typeof onClosePanel === 'function'
        ? h(
            'button',
            {
              key: 'close',
              type: 'button',
              className: `mv-top-close${closePanelDanger ? ' danger' : ''}`,
              title: closePanelLabel || t('btn.close'),
              'aria-label': closePanelLabel || t('btn.close'),
              onClick: onClosePanel,
            },
            '✕',
          )
        : null,
    ),
    h(
      'div',
      { ref: menuRef, className: 'mv-actions' },
      menu(
        'data',
        t('btn.data'),
        dataMenuItems({ h, MenuItem, t, closeMenu, ...data }),
        h(GlyphIcon, { name: 'folder' }),
      ),
      menu('view', t('btn.view'), viewMenuItems({ h, MenuItem, t, closeMenu, ...view }), h(GlyphIcon, { name: 'view' })),
      menu('output', t('btn.output'), outputMenuItems({ h, MenuItem, t, closeMenu, ...output }), h(GlyphIcon, { name: 'export' })),
      h('i', { key: 's1', className: 'mv-sep' }),
      h('div', { key: 'quick', className: 'mv-quick', role: 'group', 'aria-label': t('panel.title') }, h(ToolbarQuick, { t, ...quick })),
      h('i', { key: 's2', className: 'mv-sep' }),
      h(ToolbarSettings, { t, setSettingsOpen: onOpenSettings }),
      h(
        'button',
        {
          key: 'hide-chrome',
          type: 'button',
          className: 'mv-icon-btn mv-chrome-hide',
          title: `${t('dock.hideChrome')} (H)`,
          'aria-label': t('dock.hideChrome'),
          'aria-keyshortcuts': 'H',
          onClick: onToggleChrome,
        },
        h(GlyphIcon, { name: 'hide' }),
      ),
    ),
  )
}
