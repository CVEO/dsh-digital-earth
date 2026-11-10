/**
 * ui/resizable.js — pointer/keyboard resize for the floating workbenches.
 *
 * Sizes are panel-only preferences stored in localStorage (never model/host data):
 * the right stack has one width shared by every card; each card can also be given
 * its own height. Handles are real separators (Tab + arrow keys work).
 */
import React from 'react'

const h = React.createElement
const STORAGE_KEY = 'mv.panel-sizes.v1'
const STEP = 16

export function clampSize(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function readPanelSizes() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function savePanelSize(storageKey, size) {
  if (!storageKey || !size) return
  try {
    const all = readPanelSizes()
    const next = { ...all, [storageKey]: { width: size.width ?? null, height: size.height ?? null } }
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota: the drag still works for this mount */
  }
}

function viewportBounds(maxWidth, maxHeight) {
  const width = Number(globalThis.innerWidth) || 1280
  const height = Number(globalThis.innerHeight) || 800
  return {
    maxWidth: Math.max(200, Math.min(maxWidth, width - 24)),
    maxHeight: Math.max(120, Math.min(maxHeight, height - 24)),
  }
}

/**
 * @param {object} options
 * @param {string} options.storageKey  localStorage slot ('right-stack', 'tools', ...)
 * @param {'left'|'right'} [options.widthDirection] left: dragging left grows
 * @param {number} [options.initialWidth]
 * @param {number} [options.initialHeight]
 * @param {number} [options.minWidth] @param {number} [options.maxWidth]
 * @param {number} [options.minHeight] @param {number} [options.maxHeight]
 */
export function usePanelResize({
  storageKey,
  widthDirection = 'left',
  initialWidth = null,
  initialHeight = null,
  minWidth = 240,
  maxWidth = 720,
  minHeight = 140,
  maxHeight = 720,
} = {}) {
  const stored = React.useMemo(() => readPanelSizes()[storageKey] ?? {}, [storageKey])
  const initial = React.useMemo(() => {
    const bounds = viewportBounds(maxWidth, maxHeight)
    return {
      width: Number.isFinite(stored.width) ? clampSize(stored.width, minWidth, bounds.maxWidth) : initialWidth,
      height: Number.isFinite(stored.height) ? clampSize(stored.height, minHeight, bounds.maxHeight) : initialHeight,
    }
  }, [initialHeight, initialWidth, maxHeight, maxWidth, minHeight, minWidth, stored])
  const [size, setSize] = React.useState(initial)
  const ref = React.useRef(null)
  const sizeRef = React.useRef(size)
  sizeRef.current = size

  const finish = React.useCallback(() => {
    const current = sizeRef.current
    if (Number.isFinite(current.width) || Number.isFinite(current.height)) savePanelSize(storageKey, current)
  }, [storageKey])

  const start = React.useCallback(
    (axis) => (event) => {
      if (event?.button !== 0 || !event?.clientX) return
      event.preventDefault()
      event.stopPropagation()
      const element = ref.current
      const rect = element?.getBoundingClientRect?.()
      const startX = event.clientX
      const startY = event.clientY
      const startWidth = Number.isFinite(sizeRef.current.width) ? sizeRef.current.width : rect?.width ?? initialWidth ?? minWidth
      const startHeight = Number.isFinite(sizeRef.current.height) ? sizeRef.current.height : rect?.height ?? initialHeight ?? minHeight
      const previousCursor = document.body.style.cursor
      const previousSelect = document.body.style.userSelect
      document.body.style.cursor = axis === 'width' ? 'ew-resize' : axis === 'height' ? 'ns-resize' : 'nwse-resize'
      document.body.style.userSelect = 'none'
      const move = (moveEvent) => {
        const bounds = viewportBounds(maxWidth, maxHeight)
        const dx = (moveEvent.clientX ?? startX) - startX
        const dy = (moveEvent.clientY ?? startY) - startY
        setSize((current) => {
          const next = { ...current }
          if (axis === 'width' || axis === 'corner') {
            next.width = clampSize(widthDirection === 'right' ? startWidth + dx : startWidth - dx, minWidth, bounds.maxWidth)
          }
          if (axis === 'height' || axis === 'corner') {
            next.height = clampSize(startHeight + dy, minHeight, bounds.maxHeight)
          }
          sizeRef.current = next
          return next
        })
      }
      const stop = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', stop)
        window.removeEventListener('pointercancel', stop)
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousSelect
        finish()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', stop)
      window.addEventListener('pointercancel', stop)
    },
    [finish, initialHeight, initialWidth, maxHeight, maxWidth, minHeight, minWidth, widthDirection],
  )

  const keyboard = React.useCallback(
    (axis) => (event) => {
      const delta = event.shiftKey ? STEP * 3 : STEP
      const current = sizeRef.current
      const bounds = viewportBounds(maxWidth, maxHeight)
      const next = { ...current }
      let handled = true
      if (axis === 'width') {
        const grow = widthDirection === 'right' ? (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0) : (event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0)
        if (grow !== 0) next.width = clampSize((current.width ?? minWidth) + grow * delta, minWidth, bounds.maxWidth)
        else if (event.key === 'Home') next.width = minWidth
        else if (event.key === 'End') next.width = bounds.maxWidth
        else handled = false
      } else if (event.key === 'ArrowUp') next.height = clampSize((current.height ?? minHeight) - delta, minHeight, bounds.maxHeight)
      else if (event.key === 'ArrowDown') next.height = clampSize((current.height ?? minHeight) + delta, minHeight, bounds.maxHeight)
      else if (event.key === 'Home') next.height = minHeight
      else if (event.key === 'End') next.height = bounds.maxHeight
      else handled = false
      if (!handled) return
      event.preventDefault()
      event.stopPropagation()
      sizeRef.current = next
      setSize(next)
      savePanelSize(storageKey, next)
    },
    [maxHeight, maxWidth, minHeight, minWidth, storageKey],
  )

  const style = {
    ...(Number.isFinite(size.width) ? { width: size.width } : {}),
    ...(Number.isFinite(size.height) ? { height: size.height, maxHeight: 'none', flex: '0 0 auto' } : {}),
  }

  return {
    ref,
    size,
    style,
    beginWidth: start('width'),
    beginHeight: start('height'),
    beginCorner: start('corner'),
    keyWidth: keyboard('width'),
    keyHeight: keyboard('height'),
  }
}

export function ResizeHandle({ axis = 'width', edge = 'left', label, value, onPointerDown, onKeyDown }) {
  return h('div', {
    className: `mv-resize-handle mv-resize-${axis} mv-resize-${edge}`,
    role: 'separator',
    tabIndex: 0,
    'aria-label': label,
    'aria-orientation': axis === 'width' ? 'vertical' : 'horizontal',
    'aria-valuenow': Number.isFinite(value) ? Math.round(value) : undefined,
    title: label,
    onPointerDown,
    onKeyDown,
  })
}
