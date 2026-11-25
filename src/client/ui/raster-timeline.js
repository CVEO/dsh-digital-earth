/**
 * ui/raster-timeline.js — inline multi-period imagery frame timeline.
 *
 * Rendered directly below a temporal raster overlay or active imagery basemap
 * inside the Map tab of the layer card (only when frame count >= 2). Named
 * "影像期次" / "Imagery frames" to stay clearly distinct from the "日照时间轴"
 * (Sun timeline) inside the Analysis tool window.
 */
import React from 'react'

import { clampFrameIndex, resolveSourceFrames } from '../scene/raster-time.js'

const h = React.createElement

const PLAYBACK_SPEEDS = [
  { label: '0.5×', ms: 2000 },
  { label: '1×', ms: 1000 },
  { label: '2×', ms: 500 },
]

export function RasterTimeline({ t, source, frameIndex = 0, disabled = false, onSelectFrame }) {
  const frames = React.useMemo(() => resolveSourceFrames(source), [source])
  const [playing, setPlaying] = React.useState(false)
  const [speedIdx, setSpeedIdx] = React.useState(1)
  const current = clampFrameIndex(frameIndex, frames)
  const currentRef = React.useRef(current)
  currentRef.current = current
  const selectRef = React.useRef(onSelectFrame)
  selectRef.current = onSelectFrame

  // Pause automatically if the layer is hidden or drops below 2 frames.
  React.useEffect(() => {
    if ((disabled || frames.length < 2) && playing) setPlaying(false)
  }, [disabled, frames.length, playing])

  React.useEffect(() => {
    if (!playing || disabled || frames.length < 2) return undefined
    const intervalMs = PLAYBACK_SPEEDS[speedIdx]?.ms ?? 1000
    const timer = setInterval(() => {
      const next = (currentRef.current + 1) % frames.length
      selectRef.current?.(source.id, next)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [playing, disabled, frames.length, speedIdx, source?.id])

  if (frames.length < 2) return null

  const active = frames[current]
  const first = frames[0]
  const last = frames[frames.length - 1]
  const showDate = Boolean(active.time && active.time !== active.label)
  const valueText = showDate
    ? `${active.label} · ${active.time} (${current + 1}/${frames.length})`
    : `${active.label} (${current + 1}/${frames.length})`

  const stepBy = (delta) => {
    setPlaying(false)
    const next = (current + delta + frames.length) % frames.length
    onSelectFrame?.(source.id, next)
  }

  return h(
    'div',
    {
      className: `mv-rtime${disabled ? ' dim' : ''}`,
      'data-raster-timeline': source.id,
      role: 'region',
      'aria-label': t('rasterTime.sliderLabel', { name: source.name }),
    },
    h(
      'div',
      { className: 'mv-rtime-head' },
      h('span', { className: 'mv-rtime-tag' }, t('rasterTime.title')),
      h(
        'span',
        { className: 'mv-rtime-current', title: valueText },
        h('span', { className: 'mv-rtime-label' }, active.label),
        showDate ? h('span', { className: 'mv-rtime-date' }, active.time) : null,
      ),
      h('span', { className: 'mv-rtime-count' }, `${current + 1}/${frames.length}`),
    ),
    h('input', {
      type: 'range',
      className: 'mv-rtime-range',
      min: 0,
      max: frames.length - 1,
      step: 1,
      value: current,
      'aria-label': t('rasterTime.sliderLabel', { name: source.name }),
      'aria-valuetext': valueText,
      style: {
        '--attr-min': 0,
        '--attr-max': frames.length - 1,
        '--control-value': current,
      },
      onChange: (event) => {
        setPlaying(false)
        onSelectFrame?.(source.id, Number(event.target.value))
      },
    }),
    h(
      'div',
      { className: 'mv-rtime-bounds', 'aria-hidden': true },
      h('span', null, first.time || first.label),
      h('span', null, last.time || last.label),
    ),
    h(
      'div',
      { className: 'mv-rtime-controls' },
      h(
        'button',
        {
          type: 'button',
          className: 'mv-rtime-btn',
          title: t('rasterTime.prev'),
          'aria-label': t('rasterTime.prev'),
          onClick: () => stepBy(-1),
        },
        '⏮',
      ),
      h(
        'button',
        {
          type: 'button',
          className: `mv-rtime-btn play${playing ? ' on' : ''}`,
          disabled,
          'aria-pressed': playing,
          onClick: () => setPlaying((prev) => !prev),
        },
        playing ? `⏸ ${t('rasterTime.pause')}` : `▶ ${t('rasterTime.play')}`,
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'mv-rtime-btn',
          title: t('rasterTime.next'),
          'aria-label': t('rasterTime.next'),
          onClick: () => stepBy(1),
        },
        '⏭',
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'mv-rtime-btn speed',
          title: t('rasterTime.speed'),
          'aria-label': t('rasterTime.speed'),
          onClick: () => setSpeedIdx((prev) => (prev + 1) % PLAYBACK_SPEEDS.length),
        },
        PLAYBACK_SPEEDS[speedIdx].label,
      ),
    ),
  )
}
