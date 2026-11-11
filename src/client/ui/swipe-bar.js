/**
 * ui/swipe-bar.js — interactive split-screen swipe overlay & React hook (Requirement B).
 *
 * Renders a non-blocking split line (`.mv-swipe` has `pointer-events: none`;
 * only the handle and floating pill capture pointer events) so the user can
 * rotate, pan, and zoom the globe freely while comparing "with layer" vs.
 * "without layer".
 */
import React from 'react'
import { clampSwipeRatio, createSwipeSession } from '../scene/swipe.js'

const h = React.createElement

export function useSwipe({ t, showToast, layers, overlays, getCesium, getViewer, getOverlayLayers }) {
  const [state, setState] = React.useState(null)
  const containerRef = React.useRef(null)
  const draggingRef = React.useRef(false)
  const depsRef = React.useRef({})
  depsRef.current = { t, showToast, layers, overlays, getCesium, getViewer, getOverlayLayers }

  const sessionRef = React.useRef(null)
  if (!sessionRef.current) {
    sessionRef.current = createSwipeSession({
      getCesium: () => depsRef.current.getCesium?.(),
      getViewer: () => depsRef.current.getViewer?.(),
      getLayers: () => depsRef.current.layers ?? [],
      getOverlayLayers: () => depsRef.current.getOverlayLayers?.(),
    })
  }

  const stop = React.useCallback(() => {
    sessionRef.current?.stop()
    setState(null)
  }, [])

  const toggle3d = React.useCallback((layerId) => {
    const current = sessionRef.current?.getState()
    if (current && current.kind === '3d' && current.id === layerId) {
      stop()
      return false
    }
    const res = sessionRef.current.start3d(layerId)
    if (!res.ok) {
      const api = depsRef.current
      const msgKey = res.reason === 'unsupported_3dgs' ? 'swipe.unsupported3dgs' : 'swipe.unavailable'
      api.showToast?.(api.t?.(msgKey) ?? msgKey)
      return false
    }
    setState(res.state)
    return true
  }, [stop])

  const toggleRaster = React.useCallback((overlayId) => {
    const current = sessionRef.current?.getState()
    if (current && current.kind === 'raster' && current.id === overlayId) {
      stop()
      return false
    }
    const res = sessionRef.current.startRaster(overlayId)
    if (!res.ok) {
      const api = depsRef.current
      api.showToast?.(api.t?.('swipe.unavailable') ?? 'swipe.unavailable')
      return false
    }
    setState(res.state)
    return true
  }, [stop])

  React.useEffect(() => {
    if (!state) return
    if (sessionRef.current?.reconcile({ layers: layers ?? [], overlays: overlays ?? [] })) {
      setState(null)
    }
  }, [state, layers, overlays])

  React.useEffect(() => {
    if (!state || typeof document === 'undefined') return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      stop()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [state, stop])

  React.useEffect(() => () => sessionRef.current?.stop(), [])

  const updateRatioFromClient = (clientX, clientY) => {
    const current = sessionRef.current?.getState()
    if (!current) return
    const viewer = depsRef.current.getViewer?.()
    const box =
      containerRef.current?.getBoundingClientRect?.() ??
      viewer?.canvas?.getBoundingClientRect?.() ??
      { left: 0, top: 0, width: viewer?.canvas?.clientWidth || 1, height: viewer?.canvas?.clientHeight || 1 }
    const raw =
      current.orientation === 'horizontal'
        ? (clientY - box.top) / Math.max(1, box.height)
        : (clientX - box.left) / Math.max(1, box.width)
    const next = sessionRef.current.setRatio(clampSwipeRatio(raw))
    if (next) setState(next)
  }

  const onHandlePointerDown = (event) => {
    event.preventDefault()
    event.stopPropagation()
    draggingRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onHandlePointerMove = (event) => {
    if (!draggingRef.current) return
    event.preventDefault()
    updateRatioFromClient(event.clientX, event.clientY)
  }

  const onHandlePointerUp = (event) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const onHandleKeyDown = (event) => {
    const current = sessionRef.current?.getState()
    if (!current) return
    const delta =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -0.05
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 0.05
          : 0
    if (delta === 0) return
    event.preventDefault()
    event.stopPropagation()
    const next = sessionRef.current.setRatio(current.ratio + delta)
    if (next) setState(next)
  }

  const toggleOrientation = () => {
    const current = sessionRef.current?.getState()
    if (!current || current.kind === 'raster') return
    const next = sessionRef.current.setOrientation(current.orientation === 'horizontal' ? 'vertical' : 'horizontal')
    if (next) setState(next)
  }

  const horiz = state?.orientation === 'horizontal'
  const pct = state ? `${(state.ratio * 100).toFixed(1)}%` : '50%'
  const element = state
    ? h(
        'div',
        {
          key: 'swipe',
          ref: containerRef,
          className: `mv-swipe ${horiz ? 'horiz' : 'vert'}`,
          'data-capture-hide': '1',
        },
        h(
          'div',
          {
            className: 'mv-swipe-line',
            style: horiz ? { top: pct } : { left: pct },
          },
          h('span', { className: 'mv-swipe-badge with' }, t('swipe.withLayer', { name: state.name })),
          h(
            'div',
            {
              className: 'mv-swipe-handle',
              role: 'slider',
              tabIndex: 0,
              title: t('swipe.dragHint'),
              'aria-label': t('swipe.dragHint'),
              'aria-valuemin': 5,
              'aria-valuemax': 95,
              'aria-valuenow': Math.round(state.ratio * 100),
              onPointerDown: onHandlePointerDown,
              onPointerMove: onHandlePointerMove,
              onPointerUp: onHandlePointerUp,
              onPointerCancel: onHandlePointerUp,
              onKeyDown: onHandleKeyDown,
            },
            horiz ? '═' : '║',
          ),
          h('span', { className: 'mv-swipe-badge without' }, t('swipe.withoutLayer', { name: state.name })),
        ),
        h(
          'div',
          { className: 'mv-swipe-bar mv-glass' },
          h('span', { className: 'mv-swipe-title' }, `${t('swipe.title')} · ${state.name}`),
          h(
            'button',
            {
              type: 'button',
              className: 'mv-cta',
              disabled: state.kind === 'raster',
              title: state.kind === 'raster' ? t('swipe.rasterVerticalOnly') : t('swipe.switchAxis'),
              onClick: toggleOrientation,
            },
            horiz ? t('swipe.vertical') : t('swipe.horizontal'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mv-cta',
              onClick: stop,
            },
            t('swipe.exit'),
          ),
        ),
      )
    : null

  return { state, toggle3d, toggleRaster, stop, element }
}
