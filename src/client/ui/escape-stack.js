/**
 * ui/escape-stack.js — one Escape key, one owner.
 *
 * The panel used to attach ~16 independent `keydown` listeners. Two of them
 * firing for the same press meant one Escape closed a popover *and* the tool
 * behind it, and the order depended on how effects happened to be registered.
 *
 * Layers are registered while open (later = higher). A single window listener
 * walks the stack from the top and stops at the first layer that returns
 * anything other than `false`:
 *
 *   const onEscape = useEscapeLayer((event) => { closeMenu(); return true }, menuOpen)
 *
 * Dialogs keep their own capture-phase listener: capture runs before this
 * window (bubble) listener and stops propagation, so an open modal always wins
 * without joining the stack.
 */
import React from 'react'

const layers = []
let listening = false

function isEscape(event) {
  return event?.key === 'Escape' || event?.key === 'Esc'
}

function onKeyDown(event) {
  if (!isEscape(event)) return
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index]
    if (!layer || typeof layer.handler !== 'function') continue
    // `false` explicitly declines (e.g. focus is outside the surface); any
    // other return value consumes the press.
    if (layer.handler(event) !== false) return
  }
}

function ensureListening() {
  if (listening || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return
  document.addEventListener('keydown', onKeyDown)
  listening = true
}

function stopListening() {
  if (!listening || typeof document === 'undefined' || typeof document.removeEventListener !== 'function') return
  document.removeEventListener('keydown', onKeyDown)
  listening = false
}

/** Register a handler; returns its disposer. Exported for tests and non-React code. */
export function registerEscapeLayer(handler) {
  if (typeof handler !== 'function') throw new TypeError('registerEscapeLayer(handler) needs a function')
  const layer = { handler }
  layers.push(layer)
  ensureListening()
  return () => {
    const index = layers.indexOf(layer)
    if (index >= 0) layers.splice(index, 1)
    if (layers.length === 0) stopListening()
  }
}

/** Number of active layers (tests / diagnostics only). */
export function escapeLayerCount() {
  return layers.length
}

/**
 * React layer: registered while `active`, always calling the latest handler so
 * inline closures do not re-register on every render.
 */
export function useEscapeLayer(handler, active = true) {
  const handlerRef = React.useRef(handler)
  handlerRef.current = handler
  React.useEffect(() => {
    if (!active) return undefined
    return registerEscapeLayer((event) => handlerRef.current?.(event))
  }, [active])
}
