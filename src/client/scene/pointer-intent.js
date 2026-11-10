export function createPointerIntent(getOwner = () => false) {
  let start = null
  let blocked = false
  return {
    down(position) {
      start = position ? { x: position.x, y: position.y } : null
      blocked = Boolean(getOwner())
    },
    move(position) {
      if (start && position && Math.hypot(position.x - start.x, position.y - start.y) > 5) blocked = true
    },
    cancel() { blocked = true },
    allowsClick: () => !blocked,
  }
}

export function watchPointerCancellation(canvas, intent) {
  const cancel = () => intent.cancel()
  const touch = (event) => { if (event.touches?.length > 1) cancel() }
  const target = typeof window === 'undefined' ? null : window
  canvas?.addEventListener?.('pointercancel', cancel, true)
  canvas?.addEventListener?.('touchcancel', cancel, true)
  canvas?.addEventListener?.('touchstart', touch, true)
  target?.addEventListener('blur', cancel)
  return () => {
    canvas?.removeEventListener?.('pointercancel', cancel, true)
    canvas?.removeEventListener?.('touchcancel', cancel, true)
    canvas?.removeEventListener?.('touchstart', touch, true)
    target?.removeEventListener('blur', cancel)
  }
}
