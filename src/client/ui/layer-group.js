/**
 * ui/layer-group.js — one collapsible group of the scene card.
 *
 * v1.8 IA pass: every group in the scene card (annotations, measurements, 3D
 * content, vector / raster layers, imagery, terrain) now shares one header so
 * the eye can scan one rhythm instead of six bespoke blocks. The header is the
 * only place that toggles the group; the body is a flat sibling wrapper so the
 * rows keep the existing `.mv-layer` layout and the narrow dock still scrolls
 * as one list.
 *
 * Collapse state is a UI preference only (never scene data) and is persisted
 * per group id through panel-prefs.js.
 */
import React from 'react'

import { groupOpenKey, readPanelFlag, writePanelFlag } from './panel-prefs.js'

const h = React.createElement

/** `[open, toggle]` for one group, persisted under `mv.pref.lgroup.<id>.open`. */
export function useGroupOpen(id, fallback = true) {
  const [open, setOpen] = React.useState(() => readPanelFlag(groupOpenKey(id), fallback))
  const toggle = React.useCallback(() => {
    setOpen((value) => {
      writePanelFlag(groupOpenKey(id), !value)
      return !value
    })
  }, [id])
  return [open, toggle]
}

/**
 * Group header + optional body.
 *
 * `actions` renders before the chevron's title row on the right; `empty` is the
 * empty-state sentence shown in place of an absent body; `children` wins when
 * present. `count` is rendered as `· N` so counts never compete with the title.
 */
/** `3` when everything is visible, `2/3` once one row is hidden. */
export function groupCount(rows) {
  const total = rows.length
  const hidden = rows.filter((row) => row?.visible === false || row?.hidden === true).length
  return hidden > 0 ? `${total - hidden}/${total}` : String(total)
}

export function LayerGroup({ t, id, title, count, open, onToggle, actions, empty, hint, children }) {
  const body = children ?? (empty ? h('p', { className: 'mv-none' }, empty) : null)
  const toggleLabel = open ? t('layers.groupCollapse') : t('layers.groupExpand')
  return h(
    'div',
    { className: `mv-lgroup${open ? ' open' : ''}`, 'data-group': id },
    h(
      'div',
      { className: 'mv-group' },
      h(
        'button',
        {
          type: 'button',
          className: 'mv-group-toggle',
          'aria-expanded': open,
          // The body only exists while open, so the reference must not either.
          ...(open ? { 'aria-controls': `mv-lgroup-body-${id}` } : {}),
          title: toggleLabel,
          onClick: onToggle,
        },
        h('span', { className: `mv-group-chevron${open ? ' open' : ''}`, 'aria-hidden': true }, '▸'),
        h('span', { className: 'mv-group-title' }, title),
        count === undefined || count === null ? null : h('span', { className: 'mv-group-count' }, `· ${count}`),
      ),
      actions ? h('div', { className: 'mv-group-actions' }, actions) : null,
    ),
    hint ? h('p', { className: 'mv-note mv-lgroup-hint' }, hint) : null,
    open ? h('div', { id: `mv-lgroup-body-${id}`, className: 'mv-lgroup-body' }, body) : null,
  )
}
