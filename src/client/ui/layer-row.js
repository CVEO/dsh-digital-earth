/**
 * ui/layer-row.js — one row of the scene card.
 *
 * v1.8 IA pass: the card now lists four different kinds of scene data (3D Tiles
 * / 3DGS, annotations, measurements, raster and vector layers), so a row is a
 * shell with slots instead of a 3D-only component:
 *
 *   [warn] [lead: eye / radio / colour dot] [name + meta] [trail: 1 action] [⋯]
 *
 * Only the primary action stays inline (`trail`); everything else lives in the
 * overflow menu, which every row gets for free. Menus are controlled by the
 * parent so the row stays a pure props-in/JSX-out component (Batch B1 contract).
 */
import React from 'react'

import { EyeIcon, LayerActionIcon } from './icons.js'
import { MenuItem } from './menu-item.js'

const h = React.createElement

/** Visibility toggle used by rows whose layer can be hidden without a reload. */
export function RowEye({ t, visible, onToggle }) {
  return h(
    'button',
    {
      type: 'button',
      className: `mv-icon-btn${visible ? '' : ' is-off'}`,
      title: visible ? t('btn.hidden') : t('btn.visible'),
      'aria-label': visible ? t('btn.hidden') : t('btn.visible'),
      'aria-pressed': !visible,
      onClick: onToggle,
    },
    h(EyeIcon, { size: 15, off: !visible }),
  )
}

/** Colour dot standing in for a vector/annotation row's style. */
export function RowDot({ color }) {
  return h('span', { className: 'mv-row-dot', 'aria-hidden': true, style: { background: color } })
}

/**
 * Row shell.
 *
 * `menu` is an ordered array of `{ key, label, onClick, disabled?, active?,
 * danger?, checked?, sep? }`; `sep: true` entries render a divider and ignore
 * the other fields. `children` is the expanded body (feature list, timeline).
 */
export function LayerRow({
  t,
  id,
  name,
  meta = '',
  title = '',
  warn = false,
  warnTitle = '',
  off = false,
  selected = false,
  className = '',
  lead = null,
  trail = null,
  menu = null,
  menuOpen = false,
  onMenuToggle,
  onNameClick,
  onNameDoubleClick,
  children = null,
}) {
  const label = title || name
  // The list is the scrollport, so a menu hanging below a low row would be
  // clipped. Flip it above the row when there is not enough room underneath.
  const moreRef = React.useRef?.(null) ?? { current: null }
  const [up, setUp] = React.useState(false)
  React.useLayoutEffect?.(() => {
    if (!menuOpen) {
      setUp(false)
      return
    }
    const button = moreRef.current
    const list = button?.closest?.('.mv-layer-list')
    if (!button || !list) return
    const rect = button.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    const needed = 44 + (menu?.length ?? 0) * 34
    setUp(listRect.bottom - rect.bottom < needed)
  }, [menuOpen, menu])
  return h(
    'div',
    {
      className: `mv-layer${off ? ' off' : ''}${selected ? ' selected' : ''}${menuOpen ? ' menu-open' : ''}${
        className ? ` ${className}` : ''
      }`,
      title: label,
      // Esc closes the overflow menu wherever focus sits inside the row; the
      // menu is parent-controlled, so this is the only keyboard dismiss path.
      onKeyDown:
        menuOpen && onMenuToggle
          ? (event) => {
              if (event.key !== 'Escape') return
              event.stopPropagation()
              onMenuToggle(null)
            }
          : undefined,
    },
    warn ? h('span', { className: 'mv-warn', title: warnTitle, 'aria-label': warnTitle }, '⚠') : null,
    lead,
    h(
      'span',
      {
        className: 'name',
        onClick: onNameClick
          ? (event) => {
              event.stopPropagation()
              onNameClick()
            }
          : undefined,
        onDoubleClick: onNameDoubleClick
          ? (event) => {
              event.stopPropagation()
              onNameDoubleClick()
            }
          : undefined,
      },
      h('span', { className: 'mv-row-name' }, name),
      meta ? h('span', { className: 'mv-row-meta' }, meta) : null,
    ),
    trail,
    menu && menu.length > 0
      ? h(
          'button',
          {
            type: 'button',
            ref: (node) => {
              moreRef.current = node
            },
            className: `mv-icon-btn mv-row-more${menuOpen ? ' on' : ''}`,
            title: t('layers.more'),
            'aria-label': t('layers.more'),
            'aria-haspopup': 'menu',
            'aria-expanded': menuOpen,
            onClick: (event) => {
              event.stopPropagation()
              onMenuToggle?.(menuOpen ? null : id)
            },
          },
          h(LayerActionIcon, { kind: 'more', size: 15 }),
        )
      : null,
    menu && menuOpen
      ? h(
          'div',
          { className: `mv-row-menu mv-glass${up ? ' up' : ''}`, role: 'menu', 'aria-label': t('layers.more') },
          menu.map((item, index) =>
            item?.sep
              ? h('i', { key: item.key ?? `sep-${index}`, className: 'mv-sep' })
              : h(
                  MenuItem,
                  {
                    key: item.key ?? `item-${index}`,
                    disabled: Boolean(item.disabled),
                    danger: Boolean(item.danger),
                    checked: item.checked,
                    hint: item.hint ?? '',
                    title: item.title,
                    onClick: () => {
                      onMenuToggle?.(null)
                      item.onClick?.()
                    },
                  },
                  item.label,
                ),
          ),
        )
      : null,
    children,
  )
}
