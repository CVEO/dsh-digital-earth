/**
 * ui/use-dialog-a11y.js — the shared modal keyboard contract for panel dialogs.
 *
 * Every panel dialog needs the same three behaviours, and each copy used to
 * implement them slightly differently:
 *   - Escape cancels, captured phase so the innermost dialog wins over the
 *     panel's own Escape stack;
 *   - Tab wraps inside the dialog instead of leaving for the host app;
 *   - focus returns to the element that opened the dialog on close.
 *
 * Contract: `const dialogRef = useDialogA11y({ open, onEscape, restoreFocus })`
 * and put `ref: dialogRef` on the element carrying `role: 'dialog'`.
 * `open: false` detaches every listener and keeps the hook cheap for dialogs
 * that stay mounted but hidden.
 */
import React from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogA11y({ open = true, onEscape, restoreFocus = true } = {}) {
  const dialogRef = React.useRef(null)
  const restoreRef = React.useRef(null)
  // Latest handler without re-running the effect for inline closures.
  const handlerRef = React.useRef({ onEscape })
  handlerRef.current = { onEscape }

  React.useEffect(() => {
    if (!open) return undefined
    restoreRef.current = typeof document !== 'undefined' ? document.activeElement : null
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // Consume it here: the dialog is the innermost layer.
        event.preventDefault()
        event.stopPropagation()
        handlerRef.current.onEscape?.()
        return
      }
      if (event.key !== 'Tab') return
      const nodes = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? []).filter((node) => !node.disabled)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const previous = restoreRef.current
      if (restoreFocus && previous && typeof previous.focus === 'function' && previous.isConnected) previous.focus()
    }
  }, [open, restoreFocus])

  return dialogRef
}
