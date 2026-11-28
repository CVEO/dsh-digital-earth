/**
 * ui/toolbar-settings.js — the toolbar's single settings entry (⚙).
 *
 * Batch B1: theme/appearance left the toolbar. Theme is a persisted setting and
 * already has a full picker in Settings → Appearance, so the toolbar no longer
 * duplicates it with a separate dropdown; the gear opens the settings dialog on
 * its Appearance tab when the caller asks for it.
 */
import React from 'react'

const h = React.createElement

export function ToolbarSettings({ t, setSettingsOpen }) {
  return h(
    'button',
    {
      type: 'button',
      className: 'mv-btn icon',
      title: t('btn.settings'),
      'aria-label': t('btn.settings'),
      onClick: () => setSettingsOpen(true),
    },
    h(
      'svg',
      { viewBox: '0 0 24 24', width: 15, height: 15, 'aria-hidden': true, style: { display: 'block' } },
      h(
        'g',
        { stroke: 'currentColor', strokeWidth: 1.55, fill: 'none', strokeLinecap: 'round' },
        h('circle', { cx: 12, cy: 12, r: 3.2 }),
        h('path', {
          d: 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z',
        }),
      ),
    ),
  )
}
