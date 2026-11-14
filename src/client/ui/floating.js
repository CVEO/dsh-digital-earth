/**
 * ui/floating.js — free 2D window movement, viewport clamping, keyboard nudging,
 * focus z-index layering, and dock reset for all panels and tool windows.
 */
import React from 'react'

const h = React.createElement

export const POSITION_STORAGE_KEY = 'mv.panel.pos.v1'
const BASE_Z_INDEX = 12
const DRAG_THRESHOLD_PX = 4

let focusOrder = []
const focusListeners = new Set()

function notifyFocus() {
  for (const listener of focusListeners) listener()
}

export function resetFloatingFocusOrder() {
  focusOrder = []
}

export function focusFloatingWindow(storageKey) {
  if (!storageKey) return
  if (focusOrder[focusOrder.length - 1] === storageKey) return
  focusOrder = focusOrder.filter((key) => key !== storageKey)
  focusOrder.push(storageKey)
  notifyFocus()
}

export function getFloatingZIndex(storageKey, fallback = BASE_Z_INDEX) {
  const idx = storageKey ? focusOrder.indexOf(storageKey) : -1
  return idx >= 0 ? BASE_Z_INDEX + Math.min(idx + 1, 12) : fallback
}

function readAllSavedPositions() {
  try {
    const raw = globalThis.localStorage?.getItem(POSITION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function readSavedPos(storageKey) {
  if (!storageKey) return null
  const entry = readAllSavedPositions()[storageKey]
  if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)) return null
  const result = { x: Math.round(entry.x), y: Math.round(entry.y) }
  if (Number.isFinite(entry.width) && entry.width > 0) result.width = Math.round(entry.width)
  return result
}

export function writeSavedPos(storageKey, pos) {
  if (!storageKey) return
  try {
    const next = readAllSavedPositions()
    if (!pos) delete next[storageKey]
    else {
      next[storageKey] = {
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        ...(Number.isFinite(pos.width) && pos.width > 0 ? { width: Math.round(pos.width) } : null),
      }
    }
    if (Object.keys(next).length === 0) globalThis.localStorage?.removeItem(POSITION_STORAGE_KEY)
    else globalThis.localStorage?.setItem(POSITION_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private-mode storage errors */
  }
}

export function clampWindowPos(pos, panelRect, rootRect, margin = 8, topOffset = 52) {
  const width = Math.max(0, Number(panelRect?.width) || 0)
  const height = Math.max(0, Number(panelRect?.height) || 0)
  const rootW = Math.max(width + margin * 2, Number(rootRect?.width) || 0)
  const rootH = Math.max(height + topOffset + margin, Number(rootRect?.height) || 0)
  const maxX = Math.max(margin, rootW - width - margin)
  const maxY = Math.max(topOffset, rootH - height - margin)
  return {
    x: Math.round(Math.min(maxX, Math.max(margin, Number(pos?.x) || 0))),
    y: Math.round(Math.min(maxY, Math.max(topOffset, Number(pos?.y) || 0))),
  }
}

export function nudgeWindowPos(pos, key, shiftKey = false) {
  const step = shiftKey ? 48 : 16
  const x = Number(pos?.x) || 0
  const y = Number(pos?.y) || 0
  if (key === 'ArrowLeft') return { x: x - step, y }
  if (key === 'ArrowRight') return { x: x + step, y }
  if (key === 'ArrowUp') return { x, y: y - step }
  if (key === 'ArrowDown') return { x, y: y + step }
  return null
}

/**
 * When a tool window opens on desktop while the right column already holds
 * Layers/Tools, cascade it cleanly beside the right stack instead of crushing
 * existing docked cards. Returns null on narrow panes or when dock is empty.
 */
export function defaultToolFloatPos(slotIndex, panelRect, rootRect, dockRect) {
  const rootW = Number(rootRect?.width) || 0
  const dockH = Number(dockRect?.height) || 0
  if (rootW < 780 || dockH <= 20) return null
  const panelW = Math.max(260, Number(panelRect?.width) || 300)
  const rightColLeft = (Number(dockRect?.left) || 0) - (Number(rootRect?.left) || 0)
  const idx = Math.max(0, Number(slotIndex) || 0)
  const cascadeX = (idx % 3) * 18
  const cascadeY = (idx % 5) * 28
  const clamped = clampWindowPos(
    { x: rightColLeft - panelW - 12 - cascadeX, y: 60 + cascadeY },
    { width: panelW, height: Number(panelRect?.height) || 280 },
    rootRect,
  )
  return { ...clamped, width: Math.round(panelW) }
}

export function mergeRefs(...refs) {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(node)
      else ref.current = node
    }
  }
}

function measureDom(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null
  const root = el.closest?.('.mv-root')
  if (!root || typeof root.getBoundingClientRect !== 'function') return null
  const rootRect = root.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const op = el.offsetParent || root
  const opRect = typeof op.getBoundingClientRect === 'function' ? op.getBoundingClientRect() : rootRect
  return { root, rootRect, elRect, op, opRect }
}

export function DragHandle({ t, onPointerDown, onKeyDown }) {
  const label = typeof t === 'function' ? t('window.dragHint') : 'Drag to move'
  return h(
    'button',
    {
      type: 'button',
      'data-drag-handle': '1',
      className: 'mv-drag-handle',
      title: label,
      'aria-label': label,
      onPointerDown,
      onKeyDown,
    },
    '⋮⋮',
  )
}

export function ResetDockButton({ t, visible, onClick }) {
  if (!visible) return null
  const label = typeof t === 'function' ? t('window.resetDock') : 'Reset position'
  return h(
    'button',
    {
      type: 'button',
      className: 'mv-icon-btn mv-dock-reset',
      title: label,
      'aria-label': label,
      onClick,
    },
    '↺',
  )
}

export function useFloatingWindow({
  storageKey,
  title = '',
  t,
  autoFloat = false,
  floatIndex = 0,
  dockEmpty = false,
  hasExplicitWidth = false,
}) {
  const panelRef = React.useRef(null)
  const dragCleanupRef = React.useRef(null)
  const autoTriedRef = React.useRef(false)
  const [savedPos, setSavedPos] = React.useState(() => (storageKey ? readSavedPos(storageKey) : null))
  const [autoPos, setAutoPos] = React.useState(null)
  const [dragPos, setDragPos] = React.useState(null)
  const [dragging, setDragging] = React.useState(false)
  const [announcement, setAnnouncement] = React.useState('')
  const [delta, setDelta] = React.useState({ dx: 0, dy: 0, rootW: 0, rootH: 0 })
  const [, setFocusTick] = React.useState(0)

  React.useEffect(() => {
    const listener = () => setFocusTick((n) => n + 1)
    focusListeners.add(listener)
    return () => focusListeners.delete(listener)
  }, [])

  React.useEffect(() => () => dragCleanupRef.current?.(), [])

  const activePos = dragPos ?? savedPos ?? autoPos
  const moved = activePos !== null
  const userMoved = savedPos !== null

  const syncLayout = React.useCallback(() => {
    const m = measureDom(panelRef.current)
    if (!m) return null
    const dx = Math.round(m.opRect.left - m.rootRect.left)
    const dy = Math.round(m.opRect.top - m.rootRect.top)
    const rootW = Math.round(m.rootRect.width)
    const rootH = Math.round(m.rootRect.height)
    setDelta((prev) => (prev.dx === dx && prev.dy === dy && prev.rootW === rootW && prev.rootH === rootH ? prev : { dx, dy, rootW, rootH }))
    if (savedPos === null && autoFloat && !autoTriedRef.current) {
      autoTriedRef.current = true
      if (!dockEmpty) {
        const nextAuto = defaultToolFloatPos(floatIndex, m.elRect, m.rootRect, m.opRect)
        if (nextAuto) setAutoPos(nextAuto)
      }
    }
    return { ...m, dx, dy, rootW, rootH }
  }, [savedPos, autoFloat, floatIndex, dockEmpty])

  React.useEffect(() => {
    const info = syncLayout()
    if (!info) return undefined
    const onResize = () => {
      const m = measureDom(panelRef.current)
      if (!m) return
      setDelta({
        dx: Math.round(m.opRect.left - m.rootRect.left),
        dy: Math.round(m.opRect.top - m.rootRect.top),
        rootW: Math.round(m.rootRect.width),
        rootH: Math.round(m.rootRect.height),
      })
      if (savedPos) {
        const clamped = clampWindowPos(savedPos, m.elRect, m.rootRect)
        if (clamped.x !== savedPos.x || clamped.y !== savedPos.y) {
          const next = { ...savedPos, ...clamped }
          setSavedPos(next)
          writeSavedPos(storageKey, next)
        }
      } else if (autoPos) {
        const clamped = clampWindowPos(autoPos, m.elRect, m.rootRect)
        if (clamped.x !== autoPos.x || clamped.y !== autoPos.y) setAutoPos({ ...autoPos, ...clamped })
      }
    }
    let observer = null
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(onResize)
      observer.observe(info.root)
    }
    globalThis.addEventListener?.('resize', onResize)
    return () => {
      observer?.disconnect()
      globalThis.removeEventListener?.('resize', onResize)
    }
  }, [syncLayout, savedPos, autoPos, storageKey])

  const announce = React.useCallback(
    (key, pos) => {
      if (typeof t !== 'function') return
      setAnnouncement(t(key, { title, x: pos?.x ?? 0, y: pos?.y ?? 0 }))
    },
    [t, title],
  )

  const startDrag = React.useCallback(
    (event) => {
      if (event?.__mvDragHandled) return
      if (event?.button !== undefined && event.button !== 0) return
      const el = panelRef.current
      const m = measureDom(el)
      if (!m) return
      event.__mvDragHandled = true
      focusFloatingWindow(storageKey)
      const startX = event.clientX
      const startY = event.clientY
      const cur = dragPos ?? savedPos ?? autoPos
      const originX = cur ? cur.x : Math.round(m.elRect.left - m.rootRect.left)
      const originY = cur ? cur.y : Math.round(m.elRect.top - m.rootRect.top)
      const lockedW = cur?.width ?? Math.round(m.elRect.width)
      setDelta({
        dx: Math.round(m.opRect.left - m.rootRect.left),
        dy: Math.round(m.opRect.top - m.rootRect.top),
        rootW: Math.round(m.rootRect.width),
        rootH: Math.round(m.rootRect.height),
      })
      const target = event.currentTarget
      try {
        target?.setPointerCapture?.(event.pointerId)
      } catch {
        /* ignore synthetic pointerId failures */
      }
      let active = false
      let latest = { x: originX, y: originY, width: lockedW }
      const doc = el.ownerDocument ?? globalThis.document
      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== undefined && event.pointerId !== undefined && moveEvent.pointerId !== event.pointerId) return
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        if (!active && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
        if (!active) {
          active = true
          setDragging(true)
        }
        const liveMetrics = measureDom(panelRef.current) ?? m
        const clamped = clampWindowPos({ x: originX + dx, y: originY + dy }, liveMetrics.elRect, liveMetrics.rootRect)
        latest = { x: clamped.x, y: clamped.y, width: lockedW }
        setDragPos(latest)
      }
      const finish = () => {
        dragCleanupRef.current?.()
        dragCleanupRef.current = null
        setDragging(false)
        setDragPos(null)
        if (!active) return
        setAutoPos(null)
        setSavedPos(latest)
        writeSavedPos(storageKey, latest)
        announce('window.moved', latest)
      }
      doc?.addEventListener?.('pointermove', onMove)
      doc?.addEventListener?.('pointerup', finish)
      doc?.addEventListener?.('pointercancel', finish)
      target?.addEventListener?.('lostpointercapture', finish)
      dragCleanupRef.current = () => {
        doc?.removeEventListener?.('pointermove', onMove)
        doc?.removeEventListener?.('pointerup', finish)
        doc?.removeEventListener?.('pointercancel', finish)
        target?.removeEventListener?.('lostpointercapture', finish)
      }
    },
    [dragPos, savedPos, autoPos, storageKey, announce],
  )

  const onHeaderPointerDown = React.useCallback(
    (event) => {
      if (event?.__mvDragHandled) return
      const target = event?.target
      const blocked = target?.closest?.('button, input, select, textarea, a, label, [data-no-drag]')
      const handle = target?.closest?.('[data-drag-handle]')
      if (blocked && !handle) return
      startDrag(event)
    },
    [startDrag],
  )

  const onHandleKeyDown = React.useCallback(
    (event) => {
      const m = measureDom(panelRef.current)
      const cur = activePos ?? (m ? { x: Math.round(m.elRect.left - m.rootRect.left), y: Math.round(m.elRect.top - m.rootRect.top), width: Math.round(m.elRect.width) } : { x: 24, y: 64 })
      const nudged = nudgeWindowPos(cur, event.key, Boolean(event.shiftKey))
      if (!nudged) return
      event.preventDefault?.()
      focusFloatingWindow(storageKey)
      const next = m ? { ...clampWindowPos(nudged, m.elRect, m.rootRect), width: cur.width ?? Math.round(m.elRect.width) } : nudged
      setAutoPos(null)
      setSavedPos(next)
      writeSavedPos(storageKey, next)
      announce('window.moved', next)
    },
    [activePos, storageKey, announce],
  )

  const resetDock = React.useCallback(() => {
    setAutoPos(null)
    setSavedPos(null)
    setDragPos(null)
    writeSavedPos(storageKey, null)
    announce('window.docked')
  }, [storageKey, announce])

  const zIndex = getFloatingZIndex(storageKey, BASE_Z_INDEX)
  const style = moved
    ? {
        position: 'absolute',
        left: `${Math.round(activePos.x - delta.dx)}px`,
        top: `${Math.round(activePos.y - delta.dy)}px`,
        right: 'auto',
        bottom: 'auto',
        margin: 0,
        zIndex,
        ...(delta.rootW > 0 ? { maxWidth: `${Math.max(220, delta.rootW - 16)}px` } : null),
        ...(delta.rootH > 0 ? { maxHeight: `${Math.max(200, delta.rootH - 64)}px` } : null),
        ...(!hasExplicitWidth && activePos.width && delta.rootW > 0
          ? { width: `${Math.min(activePos.width, Math.max(220, delta.rootW - 16))}px` }
          : null),
      }
    : { zIndex }

  return {
    ref: panelRef,
    moved,
    userMoved,
    dragging,
    zIndex,
    style,
    className: `mv-floating${moved ? ' moved' : ''}${dragging ? ' dragging' : ''}`,
    panelProps: { onPointerDownCapture: () => focusFloatingWindow(storageKey) },
    headerProps: { className: 'mv-window-header', onPointerDown: onHeaderPointerDown },
    dragHandle: h(DragHandle, { t, onPointerDown: startDrag, onKeyDown: onHandleKeyDown }),
    resetButton: h(ResetDockButton, { t, visible: userMoved, onClick: resetDock }),
    liveRegion: h('span', { className: 'mv-sr-only', 'aria-live': 'polite' }, announcement),
  }
}
