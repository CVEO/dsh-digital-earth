/**
 * ui/toolbar-menus.js — the toolbar's theme and settings controls.
 *
 * Extracted from ViewerSurface (v1.7 line-budget pass): the appearance dropdown
 * and the settings gear are pure props-in/JSX-out, so they do not need the live
 * scene refs. The data/fullscreen/etc. buttons stay in the viewer.
 */
import React from 'react'

import { MenuItem } from './menu-item.js'
import { ThemeIcon } from './icons.js'

const h = React.createElement

export function ToolbarMenus({ t, themeMode, resolvedDark, openMenu, setOpenMenu, setTheme, setSettingsOpen }) {
  return h(
    React.Fragment,
    null,
    h(
      'div',
      { key: 'appearance', className: 'mv-menu' },
      h(
        'button',
        {
          type: 'button',
          className: 'mv-btn icon',
          title: `${t('btn.appearance')} · ${t(themeMode === 'auto' ? 'theme.auto' : themeMode === 'light' ? 'theme.light' : 'theme.dark')}`,
          'aria-haspopup': 'menu',
          onClick: () => setOpenMenu(openMenu === 'appearance' ? null : 'appearance'),
        },
        h(ThemeIcon, { mode: resolvedDark ? 'dark' : 'light' }),
      ),
      openMenu === 'appearance'
        ? h(
            'div',
            { className: 'mv-menu-panel mv-glass' },
            [
              ['auto', 'theme.auto'],
              ['light', 'theme.light'],
              ['dark', 'theme.dark'],
            ].map(([mode, label]) =>
              h(
                MenuItem,
                {
                  key: mode,
                  active: themeMode === mode,
                  onClick: () => setTheme(mode),
                },
                t(label),
              ),
            ),
          )
        : null,
    ),
    h(
      'button',
      {
        key: 'settings',
        type: 'button',
        className: 'mv-btn icon',
        title: t('btn.settings'),
        onClick: () => setSettingsOpen(true),
      },
      h(
        'svg',
        { viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': true, style: { display: 'block' } },
        h(
          'g',
          { stroke: 'currentColor', strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round' },
          h('circle', { cx: 12, cy: 12, r: 3.2 }),
          h('path', {
            d: 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z',
          }),
        ),
      ),
    ),
  )
}
