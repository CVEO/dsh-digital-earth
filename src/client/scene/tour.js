/**
 * scene/tour.js — bookmark-driven guided tour ("导览故事条", v1.7 P0).
 *
 * A tour is the saved camera views played back as stops: the camera flies to each
 * stop, the caption changes, and the user can pause or take over at any moment.
 * It is deliberately NOT the parked keyframe recorder from `wip/feature-bomb`:
 * there is no recording, no WebM, no timeline scrubbing — just bookmarks plus
 * text. Pure functions only; the React story bar is ui/tour-bar.js.
 */
import { normalizeBookmarkView } from './bookmarks.js'
import { flightDuration, viewDistanceM } from './motion.js'

/** Flight window for tour stops: a little slower than a single bookmark hop. */
export const TOUR_MIN_DURATION = 1.6
export const TOUR_MID_DURATION = 2.0
export const TOUR_MAX_DURATION = 2.4
/** How long a stop stays on screen after the flight lands. */
export const TOUR_DWELL_MS = 2200
/** Playing a tour needs at least a start and an end. */
export const TOUR_MIN_STOPS = 2

/**
 * Normalise bookmarks into tour stops (invalid views dropped, captions trimmed).
 * A stop without a caption still plays; the bar falls back to "第 N 站".
 */
export function buildTour(bookmarks) {
  const list = Array.isArray(bookmarks) ? bookmarks : []
  const stops = []
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue
    const view = normalizeBookmarkView(item.view)
    if (view === null) continue
    stops.push({
      id: typeof item.id === 'string' ? item.id : `stop-${stops.length + 1}`,
      name: typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim().slice(0, 60) : '',
      caption: typeof item.caption === 'string' ? item.caption.trim().slice(0, 120) : '',
      view,
    })
  }
  return stops
}

/** Move through a stop list with wrap-around (negative deltas work too). */
export function stepIndex(index, delta, length) {
  const size = Number.isInteger(length) ? length : 0
  if (size <= 0) return 0
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0
  return (((Math.trunc(index) + step) % size) + size) % size
}

/** Sentence shown for one stop; falls back to "第 N 站" for uncaptioned stops. */
export function stopCaption(stop, index, t) {
  if (stop && typeof stop.caption === 'string' && stop.caption.trim() !== '') return stop.caption.trim()
  const n = (Number.isInteger(index) ? index : 0) + 1
  return typeof t === 'function' ? t('tour.stop', { n }) : `第 ${n} 站`
}

/** Adaptive flight time between two stops (1.6 / 2.0 / 2.4 s). */
export function tourDuration(fromView, toView) {
  if (!fromView || !toView) return TOUR_MIN_DURATION
  return flightDuration(viewDistanceM(fromView, toView), {
    min: TOUR_MIN_DURATION,
    mid: TOUR_MID_DURATION,
    max: TOUR_MAX_DURATION,
  })
}
