/**
 * ui/confirm-dialog.js — the single accessible confirmation dialog for
 * destructive panel actions.
 *
 * Why a module instead of `window.confirm`: the panel lives inside a host app
 * (desktop `dsh-app://app` or the web shell), where a blocking native dialog
 * steals focus from the whole window, cannot explain scope (how many objects,
 * which origin), and cannot offer a third choice ("only measurements").
 *
 * Contract:
 *   <ConfirmDialog open title message? detail? confirmLabel cancelLabel?
 *                  secondaryLabel? danger? onConfirm onCancel onSecondary />
 *
 * The dialog owns the shared modal behaviour the panel needs everywhere:
 * focus trap, initial focus on the safe button, restore focus on close, and
 * Escape = cancel (captured before panel-level Esc handlers).
 */
import React from 'react'
import { useDialogA11y } from './use-dialog-a11y.js'

const h = React.createElement

export function ConfirmDialog({
  open,
  title,
  message = '',
  detail = '',
  confirmLabel,
  cancelLabel,
  secondaryLabel = '',
  danger = false,
  onConfirm,
  onCancel,
  onSecondary,
}) {
  const cancelRef = React.useRef(null)
  // Latest handlers without re-running the effect (parents pass inline closures).
  const handlersRef = React.useRef({ onCancel })
  handlersRef.current = { onCancel }

  const dialogRef = useDialogA11y({ open, onEscape: () => handlersRef.current.onCancel?.() })

  // Initial focus on the safe button, not the destructive one.
  React.useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open) return null
  const titleId = 'mv-confirm-title'
  return h(
    'div',
    {
      className: 'mv-modal mv-confirm-modal',
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) onCancel?.()
      },
    },
    h(
      'div',
      {
        ref: dialogRef,
        className: 'mv-dialog mv-confirm',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        ...(detail !== '' ? { 'aria-describedby': 'mv-confirm-detail' } : {}),
      },
      h('header', null, h('b', { id: titleId }, title)),
      h(
        'div',
        { className: 'body' },
        message !== '' ? h('p', { className: 'mv-confirm-message' }, message) : null,
        detail !== '' ? h('p', { id: 'mv-confirm-detail', className: 'mv-note' }, detail) : null,
      ),
      h(
        'div',
        { className: 'footer' },
        h('div', null),
        h(
          'div',
          { className: 'right' },
          secondaryLabel !== '' && typeof onSecondary === 'function'
            ? h('button', { type: 'button', className: 'mv-cta', onClick: onSecondary }, secondaryLabel)
            : null,
          h('button', { ref: cancelRef, type: 'button', className: 'mv-cta', onClick: onCancel }, cancelLabel),
          h(
            'button',
            { type: 'button', className: `mv-cta${danger ? ' danger' : ' primary'}`, onClick: onConfirm },
            confirmLabel,
          ),
        ),
      ),
    ),
  )
}

/**
 * Promise helper for components that prefer `const ok = await confirm({...})`.
 * Returns `true` for confirm, `'secondary'` for the third choice, `false` on
 * cancel/Escape/backdrop click.
 */
export function useConfirm() {
  const [request, setRequest] = React.useState(null)
  const resolveRef = React.useRef(null)
  const settle = (value) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setRequest(null)
    if (resolve) resolve(value)
  }
  const confirm = (options) =>
    new Promise((resolve) => {
      // Superseding a pending confirmation resolves it as cancel, never silently.
      if (resolveRef.current) resolveRef.current(false)
      resolveRef.current = resolve
      setRequest({ ...options, open: true })
    })
  const dialog = request
    ? h(ConfirmDialog, {
        ...request,
        onConfirm: () => settle(true),
        onCancel: () => settle(false),
        // The caller may supply only a label for the third choice; the handler is
        // always ours so the promise never stays pending.
        ...(request.secondaryLabel !== '' || typeof request.onSecondary === 'function'
          ? { onSecondary: () => settle('secondary') }
          : {}),
      })
    : null
  return { confirm, dialog }
}
