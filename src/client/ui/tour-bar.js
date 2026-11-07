/**
 * ui/tour-bar.js — the guided tour story bar (v1.7 P0).
 *
 * A stop is one saved camera view plus one sentence: the camera flies there, the
 * caption changes, and the next stop follows after a short dwell. The user owns
 * the camera — a pointer-down anywhere outside the bar pauses playback
 * immediately, which is the "take over" gesture the plan asked for.
 *
 * The hook owns the playback state (the bar lives at the panel root, not inside
 * the layer card) and returns the element to render.
 */
import React from 'react'

import { TOUR_DWELL_MS, TOUR_MIN_STOPS, buildTour, stepIndex, stopCaption, tourDuration } from '../scene/tour.js'

export function useTour({ t, showToast, getCurrentView, onFlyView, onFinish }) {
  const [state, setState] = React.useState(null)
  const barRef = React.useRef(null)
  // ViewerSurface recreates its callbacks every render; keep the last ones in a
  // ref so the playback effect only depends on the tour state itself.
  const apiRef = React.useRef({})
  apiRef.current = { t, showToast, getCurrentView, onFlyView, onFinish }

  const stop = React.useCallback(() => {
    setState(null)
  }, [])

  const start = React.useCallback(
    (bookmarks) => {
      const stops = buildTour(bookmarks)
      if (stops.length < TOUR_MIN_STOPS) {
        if (typeof showToast === 'function') showToast(t('tour.needStops'))
        return false
      }
      setState({ stops, index: 0, playing: true })
      return true
    },
    [showToast, t],
  )

  // Playback driver: fly to the current stop, then advance after flight + dwell.
  // Wrapping past the last stop ends the tour with one clean screenshot.
  React.useEffect(() => {
    if (!state || !state.playing) return undefined
    const api = apiRef.current
    const current = state.stops[state.index]
    if (!current) return undefined
    const from = typeof api.getCurrentView === 'function' ? api.getCurrentView() : null
    const duration = tourDuration(from, current.view)
    if (typeof api.onFlyView === 'function') api.onFlyView(current.view, duration)
    const timer = setTimeout(() => {
      const next = stepIndex(state.index, 1, state.stops.length)
      if (next === 0) {
        setState(null)
        if (typeof api.onFinish === 'function') api.onFinish()
        if (typeof api.showToast === 'function') api.showToast(api.t('tour.finished'))
        return
      }
      setState((previous) => (previous ? { ...previous, index: next } : null))
    }, Math.round(duration * 1000) + TOUR_DWELL_MS)
    return () => clearTimeout(timer)
  }, [state])

  // Take-over gesture: any pointer-down outside the story bar pauses playback.
  React.useEffect(() => {
    if (!state || !state.playing) return undefined
    const onPointerDown = (event) => {
      const bar = barRef.current
      if (bar && event.target instanceof Node && bar.contains(event.target)) return
      setState((previous) => (previous ? { ...previous, playing: false } : null))
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [state])

  // Esc ends the tour without saving the end-of-tour screenshot.
  React.useEffect(() => {
    if (!state) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setState(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state])

  const current = state ? state.stops[state.index] : null
  const element = state
    ? h(
        'div',
        { ref: barRef, className: 'mv-tour mv-glass', role: 'region', 'aria-label': t('tour.title') },
        h(
          'div',
          { className: 'mv-tour-head' },
          h('b', null, t('tour.title')),
          h('span', { className: 'mv-tour-progress' }, t('tour.progress', { index: state.index + 1, total: state.stops.length })),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('tour.exit'), 'aria-label': t('tour.exit'), onClick: stop }, '✕'),
        ),
        h('p', { className: 'mv-tour-caption' }, stopCaption(current, state.index, t)),
        h(
          'div',
          { className: 'mv-tour-actions' },
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('tour.prev'), 'aria-label': t('tour.prev'), onClick: () => setState((previous) => (previous ? { ...previous, index: stepIndex(previous.index, -1, previous.stops.length), playing: true } : null)) }, '⏮'),
          h(
            'button',
            {
              type: 'button',
              className: 'mv-cta primary',
              onClick: () => setState((previous) => (previous ? { ...previous, playing: !previous.playing } : null)),
            },
            state.playing ? t('tour.pause') : t('tour.play'),
          ),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('tour.next'), 'aria-label': t('tour.next'), onClick: () => setState((previous) => (previous ? { ...previous, index: stepIndex(previous.index, 1, previous.stops.length), playing: true } : null)) }, '⏭'),
        ),
        h('p', { className: 'mv-tour-hint' }, t('tour.hint')),
      )
    : null

  return { start, stop, element }
}
