/** Workspace tabs for layers, tools and results. Panel state controls expansion. */
import React from 'react'

import { GlyphIcon, ToolEntryIcon, ToolsIcon, LayersIcon } from './icons.js'

const h = React.createElement

export function ToolbarQuick({ t, showLayers, showTools, showPlaces, showResult, resultDisabled = false, resultUnread = false, onToggleLayers, onToggleTools, onTogglePlaces, onOpenResult }) {
  const entry = (key, icon, label, onClick, active, title = label, disabled = false, unread = false) =>
    h(
      'button',
      {
        key,
        type: 'button',
        className: `mv-btn${active ? ' on' : ''}`,
        title,
        // The unread dot lives on this entry now that the dock has no title row;
        // the extra words keep it perceivable without relying on colour.
        'aria-label': unread ? `${label} · ${t('dock.unread')}` : label,
        'aria-pressed': Boolean(active),
        disabled,
        onClick: disabled ? undefined : onClick,
      },
      h('span', { className: 'mv-btn-icon', 'aria-hidden': true }, icon),
      h('span', { className: 'mv-btn-label' }, label),
      unread ? h('span', { className: 'mv-btn-dot', 'aria-hidden': true }) : null,
    )
  return h(
    React.Fragment,
    null,
    entry('layers', h(LayersIcon), t('btn.layers'), onToggleLayers, showLayers, showLayers ? t('btn.layersHide') : t('btn.layersShow')),
    entry('tools', h(ToolsIcon), t('btn.tools'), onToggleTools, showTools, showTools ? t('btn.toolsHide') : t('btn.toolsShow')),
    entry('places', h(GlyphIcon, { name: 'search' }), t('places.title'), onTogglePlaces, showPlaces, showPlaces ? t('btn.panelHide') : t('btn.panelShow')),
    // D8: with nothing in the result tab the destination stays inert.
    entry('result', h(ToolEntryIcon, { kind: 'analysis' }), t('panel.tab.result'), onOpenResult, showResult, resultDisabled ? t('btn.resultEmpty') : t('panel.tab.result'), resultDisabled, resultUnread && !resultDisabled),
  )
}
