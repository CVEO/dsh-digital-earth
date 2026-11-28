/**
 * ui/use-row-menu.js — open/close state for the scene card's row ⋯ menus.
 *
 * D7 (v1.8): this release only guarantees Esc + focus management for row menus.
 * Closing on a pointerdown outside the list is the missing half: without it a
 * menu stays open until another row is clicked. The hook owns that listener and
 * the panel owns the rows, so both tabs share one implementation.
 */
import React from 'react'

export function useRowMenu() {
  const [openId, setOpenId] = React.useState(null)
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (openId === null || typeof document === 'undefined') return undefined
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpenId(null)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener?.('pointerdown', close, true)
  }, [openId])

  return { openId, setOpenId, ref }
}
