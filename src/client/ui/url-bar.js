/**
 * ui/url-bar.js — the one-line address/coordinate bar above the globe.
 *
 * Kept as its own component so ViewerSurface does not pay for the markup: the
 * surface only wires state and submit behaviour. Esc closes, Enter submits.
 */
import React from 'react'

import { focusFloatingWindow, useFloatingZIndex } from './floating.js'

const h = React.createElement
const WINDOW_KEY = 'urlbar'

export function UrlBar({ value, placeholder, submitLabel, closeLabel = 'Close', onChange, onSubmit, onClose }) {
  const zIndex = useFloatingZIndex(WINDOW_KEY)
  const focus = () => focusFloatingWindow(WINDOW_KEY)
  return h(
    'div',
    { className: 'mv-urlbar mv-glass', style: { zIndex }, onPointerDownCapture: focus, onFocusCapture: focus },
    h('input', {
      autoFocus: true,
      value,
      placeholder,
      onChange: (event) => onChange(event.target.value),
      onKeyDown: (event) => {
        if (event.key === 'Enter') onSubmit()
        if (event.key === 'Escape') onClose()
      },
    }),
    h('button', { type: 'button', onClick: onSubmit }, submitLabel),
    h(
      'button',
      {
        type: 'button',
        className: 'mv-urlbar-close',
        title: closeLabel,
        'aria-label': closeLabel,
        onClick: onClose,
      },
      '✕',
    ),
  )
}
