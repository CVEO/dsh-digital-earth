/**
 * ui/profile-chart.js — the small distance–elevation SVG used by the analysis card.
 *
 * Split out of cards.js (which is near its line budget) when F5 added chart→globe
 * hover: the chart now reports the nearest sample index and can draw a readout,
 * so it owns a little behaviour instead of being pure markup.
 */
import React from 'react'
import { formatDistance, formatHeight } from '../format.js'
import { nearestProfileIndex } from '../analysis/profile-metrics.js'

const h = React.createElement

/** SVG distance–elevation chart; gaps in the sampled data stay visible. */
export function AnalysisProfileChart({ points, t, hoverIndex = null, onHover }) {
  if (!Array.isArray(points) || points.length < 2) return null
  const width = 260
  const height = 92
  const padX = 10
  const padY = 12
  const valid = points.filter((point) => point && typeof point.height_m === 'number' && Number.isFinite(point.height_m))
  if (valid.length < 2) return null
  const maxDistance = Math.max(...points.map((point) => Number(point.distance_m) || 0), 1)
  const minimum = Math.min(...valid.map((point) => point.height_m))
  const maximum = Math.max(...valid.map((point) => point.height_m))
  const range = maximum - minimum || 1
  const x = (distance) => padX + (width - padX * 2) * Math.min(1, Math.max(0, distance / maxDistance))
  const y = (value) => height - padY - (height - padY * 2) * ((value - minimum) / range)
  const segments = []
  let current = []
  for (const point of points) {
    const heightValue = point ? point.height_m : null
    if (typeof heightValue === 'number' && Number.isFinite(heightValue)) {
      const distance = Number(point.distance_m) || 0
      current.push(`${x(distance).toFixed(1)},${y(heightValue).toFixed(1)}`)
    } else if (current.length > 0) {
      segments.push(current.join(' '))
      current = []
    }
  }
  if (current.length > 0) segments.push(current.join(' '))
  // Chart → globe readout: the same sample index drives the ground marker.
  const hoverPoint = Number.isInteger(hoverIndex) && hoverIndex >= 0 ? points[hoverIndex] : null
  const hoverValid = Boolean(hoverPoint && typeof hoverPoint.height_m === 'number' && Number.isFinite(hoverPoint.height_m))
  const hoverDistance = hoverValid ? Number(hoverPoint.distance_m) || 0 : 0
  const onPointerMove = (event) => {
    if (typeof onHover !== 'function') return
    const rect = event?.currentTarget?.getBoundingClientRect?.()
    const widthPx = rect && rect.width > 0 ? rect.width : width
    const leftPx = rect?.left ?? 0
    onHover(nearestProfileIndex(points, (event.clientX - leftPx) / widthPx))
  }
  const onPointerLeave = () => {
    if (typeof onHover === 'function') onHover(null)
  }
  return h(
    'svg',
    {
      className: 'chart',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': t('analysis.chart'),
      onPointerMove,
      onPointerLeave,
    },
    h('line', { x1: padX, y1: height - padY, x2: width - padX, y2: height - padY, stroke: 'var(--mv-line)' }),
    ...segments.map((pointsText, index) =>
      h('polyline', {
        key: `segment-${index}`,
        points: pointsText,
        fill: 'none',
        stroke: 'var(--mv-profile-line)',
        strokeWidth: 3,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      }),
    ),
    h('text', { x: padX, y: padY - 3 }, formatHeight(maximum)),
    h('text', { x: padX, y: height - 2 }, formatHeight(minimum)),
    h('text', { x: width - padX, y: height - 2, textAnchor: 'end' }, formatDistance(maxDistance)),
    hoverValid
      ? h(
          'g',
          null,
          h('line', {
            x1: x(hoverDistance),
            y1: padY,
            x2: x(hoverDistance),
            y2: height - padY,
            stroke: 'var(--mv-line-strong, rgba(125,211,252,0.75))',
            strokeDasharray: '3 3',
          }),
          h('circle', { cx: x(hoverDistance), cy: y(hoverPoint.height_m), r: 3, fill: 'var(--mv-profile-line)' }),
          h(
            'text',
            { x: width - padX, y: padY - 3, textAnchor: 'end' },
            `${formatDistance(hoverDistance)} · ${formatHeight(hoverPoint.height_m)}`,
          ),
        )
      : null,
  )
}
