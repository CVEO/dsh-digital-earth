/**
 * ui/profile-bar.js — canvas-level floating bar for an active elevation profile.
 *
 * Manual distance/area/height measurements show a bottom floating pill with an
 * explicit clear button. Elevation profile used to leave only ground handles on
 * the globe while hiding its clear action inside a collapsed tool window. This
 * bar gives an active profile the exact same one-click view / redraw / clear
 * affordance right on the canvas.
 */
import React from 'react'
import { formatDistance, formatHeight } from '../format.js'

const h = React.createElement

export function ProfileBar({ t, analysis, hidden = false, resultOpen = false, onOpenResult, onRedraw, onClear }) {
  if (hidden || analysis?.operation !== 'profile' || !analysis?.result) return null
  const result = analysis.result
  const summary = t('profile.barSummary', {
    length: formatDistance(result.length_m ?? 0),
    relief: formatHeight(result.stats?.relief_m ?? 0),
  })
  return h(
    'div',
    { className: 'mv-measure mv-profile-bar mv-glass', role: 'region', 'aria-label': t('analysis.title.profile') },
    h('span', { className: 'text' }, summary),
    h(
      'div',
      { className: 'mv-measure-actions' },
      !resultOpen && typeof onOpenResult === 'function'
        ? h('button', { type: 'button', className: 'mv-measure-end', onClick: onOpenResult }, t('profile.viewChart'))
        : null,
      typeof onRedraw === 'function'
        ? h('button', { type: 'button', className: 'mv-measure-end', onClick: onRedraw }, t('analysis.redrawProfile'))
        : null,
      typeof onClear === 'function'
        ? h('button', { type: 'button', className: 'mv-measure-end danger', onClick: onClear }, t('profile.clear'))
        : null,
    ),
  )
}
