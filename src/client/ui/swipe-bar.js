/**
 * ui/swipe-bar.js — interactive split-screen swipe overlay & React hook.
 *
 * Renders a non-blocking split line (`.mv-swipe` has `pointer-events: none`;
 * only the handle and floating pill capture pointer events) so the user can
 * rotate, pan, and zoom the globe freely while comparing:
 *   - single-layer split ("with layer" vs. "without layer") for Mesh, 3DGS, or 2D raster;
 *   - dual-layer split (Left layer A vs. Right layer B) for 3DGS <-> Mesh,
 *     3DGS <-> 3DGS, or Mesh <-> Mesh via native Cesium `SplitDirection`.
 */
import React from 'react'
import { clampSwipeRatio, createSwipeSession } from '../scene/swipe.js'

const h = React.createElement

/**
 * Layers the swipe session must see: the engine needs the full runtime objects
 * (`tileset`, `kind`), while the React state passed to the panel is a lightweight
 * projection without them. Prefer the full source when the caller provides one.
 */
export function engineLayersOf(deps) {
  const full = deps?.getLayers?.()
  if (Array.isArray(full)) return full
  return Array.isArray(deps?.layers) ? deps.layers : []
}

function toastForReason(api, reason) {
  const msgKey =
    reason === 'unsupported_3dgs'
      ? 'swipe.unsupported3dgs'
      : reason === 'conflict'
        ? 'swipe.conflict'
        : reason === 'same_layer'
          ? 'compare.sameLayer'
          : 'swipe.unavailable'
  api.showToast?.(api.t?.(msgKey) ?? msgKey)
}

export function useSwipe({ t, showToast, layers, overlays, getCesium, getViewer, getOverlayLayers, getLayers }) {
  const [state, setState] = React.useState(null)
  const containerRef = React.useRef(null)
  const draggingRef = React.useRef(false)
  const depsRef = React.useRef({})
  depsRef.current = { t, showToast, layers, overlays, getCesium, getViewer, getOverlayLayers, getLayers }

  const sessionRef = React.useRef(null)
  if (!sessionRef.current) {
    sessionRef.current = createSwipeSession({
      getCesium: () => depsRef.current.getCesium?.(),
      getViewer: () => depsRef.current.getViewer?.(),
      getLayers: () => engineLayersOf(depsRef.current),
      getOverlayLayers: () => depsRef.current.getOverlayLayers?.(),
    })
  }

  const stop = React.useCallback(() => {
    sessionRef.current?.stop()
    setState(null)
  }, [])

  const runAction = React.useCallback((fn, { silent = false } = {}) => {
    let res
    try {
      res = fn(sessionRef.current)
    } catch {
      res = { ok: false, reason: 'unavailable' }
    }
    if (!res?.ok) {
      if (!silent) toastForReason(depsRef.current, res?.reason)
      return res ?? { ok: false, reason: 'unavailable' }
    }
    setState(res.state)
    return res
  }, [])

  const startSplit = React.useCallback(
    (layerId, options) => runAction((session) => session.startSplit(layerId, options)),
    [runAction],
  )

  const startPair = React.useCallback(
    (leftLayerId, rightLayerId, options) => runAction((session) => session.startPair(leftLayerId, rightLayerId, options)),
    [runAction],
  )

  const swapSides = React.useCallback(() => runAction((session) => session.swapSides(), { silent: true }), [runAction])

  const setLeftLayer = React.useCallback(
    (leftLayerId) => runAction((session) => session.setLeftLayer(leftLayerId)),
    [runAction],
  )

  const setRightLayer = React.useCallback(
    (rightLayerId) => runAction((session) => session.setRightLayer(rightLayerId)),
    [runAction],
  )

  const setRatio = React.useCallback((nextRatio) => {
    const next = sessionRef.current?.setRatio(clampSwipeRatio(nextRatio))
    if (next) setState(next)
    return next
  }, [])

  const toggle3d = React.useCallback(
    (layerId) => {
      const current = sessionRef.current?.getState()
      if (current && (current.kind === '3d' || current.kind === 'split') && current.id === layerId) {
        stop()
        return false
      }
      const res = startSplit(layerId)
      return Boolean(res?.ok)
    },
    [stop, startSplit],
  )

  const toggleRaster = React.useCallback(
    (overlayId) => {
      const current = sessionRef.current?.getState()
      if (current && current.kind === 'raster' && current.id === overlayId) {
        stop()
        return false
      }
      const res = runAction((session) => session.startRaster(overlayId))
      return Boolean(res?.ok)
    },
    [stop, runAction],
  )

  React.useEffect(() => {
    if (!state) return
    if (sessionRef.current?.reconcile({ layers: engineLayersOf(depsRef.current), overlays: overlays ?? [] })) {
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
    setRatio(raw)
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
    setRatio(current.ratio + delta)
  }

  const toggleOrientation = () => {
    const current = sessionRef.current?.getState()
    if (!current || current.kind === 'raster' || current.kind === 'pair') return
    if (current.kind === 'split' && current.layerKind === '3dgs') return
    const next = sessionRef.current.setOrientation(current.orientation === 'horizontal' ? 'vertical' : 'horizontal')
    if (next) setState(next)
  }

  const visible3d = (Array.isArray(layers) ? layers : []).filter((item) => item.visible !== false)
  const isPair = state?.kind === 'pair'
  const isSplit = state?.kind === 'split'
  const is3dLike = state && state.kind !== 'raster'
  const horiz = state?.orientation === 'horizontal'
  const pct = state ? `${(state.ratio * 100).toFixed(1)}%` : '50%'
  const pctInt = state ? `${Math.round(state.ratio * 100)}%` : '50%'

  const leftBadgeText = !state
    ? ''
    : isPair
      ? t('swipe.leftLabel', { name: state.leftName })
      : isSplit && state.side === 'right'
        ? t('swipe.withoutLayer', { name: state.name })
        : t('swipe.withLayer', { name: state.name })
  const rightBadgeText = !state
    ? ''
    : isPair
      ? t('swipe.rightLabel', { name: state.rightName })
      : isSplit && state.side === 'right'
        ? t('swipe.withLayer', { name: state.name })
        : t('swipe.withoutLayer', { name: state.name })

  const activeLeftId = isPair ? state.leftId : state?.id ?? ''
  const rightCandidates = is3dLike ? visible3d.filter((item) => item.id !== activeLeftId) : []
  const axisDisabled =
    !state || state.kind === 'raster' || isPair || (isSplit && state.layerKind === '3dgs')
  const axisTitle =
    state?.kind === 'raster'
      ? t('swipe.rasterVerticalOnly')
      : isPair || (isSplit && state?.layerKind === '3dgs')
        ? t('swipe.horizontalUnsupported3dgs')
        : t('swipe.switchAxis')

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
          h('span', { className: 'mv-swipe-badge with' }, leftBadgeText),
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
          h('span', { className: 'mv-swipe-badge without' }, rightBadgeText),
        ),
        h(
          'div',
          { className: 'mv-swipe-bar mv-glass' },
          h(
            'span',
            { className: 'mv-swipe-title' },
            isPair ? `${state.leftName} ↔ ${state.rightName}` : `${t('swipe.title')} · ${state.name}`,
          ),
          h('span', { className: 'mv-swipe-pct' }, pctInt),
          rightCandidates.length > 0
            ? h(
                'select',
                {
                  className: 'mv-swipe-select',
                  value: isPair ? state.rightId : '',
                  title: t('swipe.rightPicker'),
                  'aria-label': t('swipe.rightPicker'),
                  onChange: (event) => setRightLayer(event.target.value || null),
                },
                h('option', { value: '' }, t('swipe.rightNone')),
                ...rightCandidates.map((item) => h('option', { key: item.id, value: item.id }, item.name)),
              )
            : null,
          isPair || isSplit
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  title: t('swipe.swap'),
                  'aria-label': t('swipe.swap'),
                  onClick: swapSides,
                },
                '⇄',
              )
            : null,
          !isPair
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  disabled: axisDisabled,
                  title: axisTitle,
                  onClick: toggleOrientation,
                },
                horiz ? t('swipe.vertical') : t('swipe.horizontal'),
              )
            : null,
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

  return {
    state,
    toggle3d,
    toggleRaster,
    startSplit,
    startPair,
    swapSides,
    setLeftLayer,
    setRightLayer,
    setRatio,
    stop,
    element,
  }
}
