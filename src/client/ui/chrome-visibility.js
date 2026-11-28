/**
 * ui/chrome-visibility.js — hide the whole scene chrome (toolbar + dock).
 *
 * This is deliberately separate from the dock's collapsed state: collapsing
 * keeps the toolbar, while hiding gives the scene the full window. The state is
 * a UI preference only and never touches scene data.
 */
import React from 'react'

import { GlyphIcon } from './icons.js'
import { readPanelFlag, writePanelFlag } from './panel-prefs.js'

const h = React.createElement

export const CHROME_HIDDEN_KEY = 'chrome.hidden'

/** One surface for the toolbar and the dock; hidden as a unit. */
export function ChromeShell({ hidden, children }) {
  return h(
    'div',
    {
      className: `mv-chrome${hidden ? ' is-hidden' : ''}`,
      'aria-hidden': hidden ? 'true' : undefined,
      inert: hidden ? '' : undefined,
    },
    children,
  )
}

/** Live status plus the restore handle; kept outside the hidden chrome tree. */
export function ChromeA11y({ t, status, hidden, onShow }) {
  const show = () => {
    onShow?.()
    globalThis.setTimeout?.(() => {
      if (typeof document !== 'undefined') document.querySelector('.mv-chrome-hide')?.focus?.()
    }, 0)
  }
  return h(
    React.Fragment,
    null,
    h('span', { className: 'mv-sr-only', role: 'status', 'aria-live': 'polite' }, status),
    hidden
      ? h(
          'button',
          {
            type: 'button',
            className: 'mv-chrome-reveal mv-glass',
            title: `${t('dock.showChrome')} (H)`,
            'aria-label': t('dock.showChrome'),
            'aria-expanded': false,
            'aria-keyshortcuts': 'H',
            autoFocus: true,
            onClick: show,
          },
          h(GlyphIcon, { name: 'view' }),
        )
      : null,
  )
}

const isTyping = (target) => {
  if (!target || typeof target.closest !== 'function') return false
  return target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

/** Pure shortcut gate shared by the hook and its tests. */
export function isChromeShortcut(event, target, dialogOpen = false) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false
  if (String(event.key).toLowerCase() !== 'h') return false
  if (isTyping(target)) return false
  return !dialogOpen
}

/** `[hidden, toggle]`, persisted under `mv.pref.chrome.hidden`. */
export function useChromeVisibility() {
  const [hidden, setHidden] = React.useState(() => readPanelFlag(CHROME_HIDDEN_KEY, false))
  const toggle = React.useCallback(() => setHidden((value) => !value), [])

  React.useEffect(() => {
    writePanelFlag(CHROME_HIDDEN_KEY, hidden)
  }, [hidden])

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const dialogOpen = typeof document !== 'undefined' && typeof document.querySelector === 'function' && Boolean(document.querySelector('[role="dialog"]'))
      if (!isChromeShortcut(event, event.target, dialogOpen)) return
      event.preventDefault()
      setHidden((value) => !value)
    }
    globalThis.addEventListener?.('keydown', onKeyDown)
    return () => globalThis.removeEventListener?.('keydown', onKeyDown)
  }, [])

  return [hidden, toggle]
}
