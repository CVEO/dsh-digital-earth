/**
 * ui/menu-item.js — authored module of the Digital Earth client half.
 *
 * One menu row for every toolbar and row menu: optional leading icon, label,
 * trailing hint (shortcut / count), a displaced check mark for toggle entries
 * and a danger tone for destructive ones. Keeping this in one place is what
 * makes the "数据 / 视图 / 输出" menus and the per-row overflow menu look and
 * behave the same.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'

/** Shared spacer for item lists that group actions (数据 / 视图 / 输出 menus). */
export const MENU_SEP = { width: 'auto', height: '.5px', margin: '4px 8px' }

const h = React.createElement

function MenuItem({
  onClick,
  children,
  title,
  disabled = false,
  danger = false,
  checked,
  icon = null,
  hint = '',
  role,
}) {
  const isCheck = checked !== undefined
  const classes = [
    'mv-menu-item',
    disabled ? 'is-disabled' : '',
    danger ? 'is-danger' : '',
    icon ? 'has-icon' : '',
    isCheck ? 'is-check' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return h(
    'button',
    {
      type: 'button',
      className: classes,
      role: role ?? (isCheck ? 'menuitemcheckbox' : 'menuitem'),
      ...(isCheck ? { 'aria-checked': Boolean(checked) } : {}),
      onClick: disabled ? undefined : onClick,
      title: title ?? (typeof children === 'string' ? children : undefined),
      disabled,
    },
    h('span', { className: 'mv-menu-check', 'aria-hidden': true }, isCheck && checked ? '✓' : ''),
    icon ? h('span', { className: 'mv-menu-icon', 'aria-hidden': true }, icon) : null,
    h('span', { className: 'mv-menu-label' }, children),
    hint ? h('span', { className: 'mv-menu-hint' }, hint) : null,
  )
}

export { MenuItem }
