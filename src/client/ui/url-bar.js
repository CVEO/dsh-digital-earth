/**
 * ui/url-bar.js — the one-line address/coordinate bar above the globe.
 *
 * Kept as its own component so ViewerSurface does not pay for the markup: the
 * surface only wires state and submit behaviour. Esc closes, Enter submits.
 */
import React from 'react'

const h = React.createElement

export function UrlBar({ value, placeholder, submitLabel, onChange, onSubmit, onClose }) {
  return h(
    'div',
    { className: 'mv-urlbar mv-glass' },
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
  )
}
