/**
 * ui/compass.js — the small always-visible compass.
 *
 * The needle is driven from Cesium's camera event and written straight to the
 * DOM, so a rotating camera never triggers a React re-render. Clicking it flies
 * the camera back to north while keeping the current position, pitch and height.
 */
import React from 'react'

import { headingDegrees } from '../scene/heading.js'

const h = React.createElement

// Tick marks are static; only the red/grey needle rotates. A 15° step keeps the
// 58 px face readable while still reading as a compass rose rather than an icon.
const TICKS = Array.from({ length: 24 }, (_, index) => {
  const angle = (index * 15 * Math.PI) / 180
  const major = index % 6 === 0
  const inner = major ? 20.4 : 22.4
  return {
    key: `tick-${index}`,
    x1: 28 + Math.sin(angle) * inner,
    y1: 28 - Math.cos(angle) * inner,
    x2: 28 + Math.sin(angle) * 25.2,
    y2: 28 - Math.cos(angle) * 25.2,
    width: major ? 1 : 0.55,
    opacity: major ? 0.6 : 0.32,
  }
})

export function Compass({ getViewer, t }) {
  const needleRef = React.useRef(null)
  const viewerRef = React.useRef(null)

  React.useEffect(() => {
    const viewer = getViewer?.()
    viewerRef.current = viewer
    if (!viewer) return undefined
    const apply = () => {
      const camera = viewer.camera
      if (!camera || !needleRef.current) return
      // Facing east (heading 90°) puts north on the left: rotate the needle by -heading.
      needleRef.current.style.transform = `rotate(${-headingDegrees(camera.heading)}deg)`
    }
    apply()
    const remove = viewer.camera?.changed?.addEventListener?.(apply)
    const sceneRemove = viewer.scene?.postRender?.addEventListener?.(apply)
    return () => {
      if (typeof remove === 'function') remove()
      else viewer.camera?.changed?.removeEventListener?.(apply)
      if (typeof sceneRemove === 'function') sceneRemove()
      else viewer.scene?.postRender?.removeEventListener?.(apply)
    }
  }, [getViewer])

  const resetNorth = () => {
    const viewer = viewerRef.current ?? getViewer?.()
    const camera = viewer?.camera
    if (!camera) return
    viewer.camera.flyTo({
      destination: camera.positionWC,
      orientation: { heading: 0, pitch: camera.pitch, roll: 0 },
      duration: 0.5,
    })
  }

  return h(
    'button',
    {
      type: 'button',
      className: 'mv-compass',
      title: t('compass.reset'),
      'aria-label': t('compass.reset'),
      onClick: resetNorth,
    },
    h(
      'svg',
      { viewBox: '0 0 56 56', width: 56, height: 56, 'aria-hidden': true },
      h('circle', { cx: 28, cy: 28, r: 26, fill: 'none', stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.4 }),
      h('circle', { cx: 28, cy: 28, r: 20.8, fill: 'none', stroke: 'currentColor', strokeWidth: 0.55, opacity: 0.28 }),
      ...TICKS.map((tick) =>
        h('line', {
          key: tick.key,
          x1: tick.x1,
          y1: tick.y1,
          x2: tick.x2,
          y2: tick.y2,
          stroke: 'currentColor',
          strokeWidth: tick.width,
          opacity: tick.opacity,
        }),
      ),
      h('text', { x: 28, y: 10.6, textAnchor: 'middle', fontSize: 7, fontWeight: 700, fill: 'var(--mv-accent)' }, 'N'),
      h('text', { x: 46.8, y: 30.4, textAnchor: 'middle', fontSize: 6, fontWeight: 600, fill: 'currentColor', opacity: 0.66 }, 'E'),
      h('text', { x: 28, y: 49.8, textAnchor: 'middle', fontSize: 6, fontWeight: 600, fill: 'currentColor', opacity: 0.66 }, 'S'),
      h('text', { x: 9.2, y: 30.4, textAnchor: 'middle', fontSize: 6, fontWeight: 600, fill: 'currentColor', opacity: 0.66 }, 'W'),
      h(
        'g',
        { ref: needleRef, className: 'mv-compass-rose' },
        h('path', { d: 'M28 13 32.2 28 28 26.2 23.8 28Z', fill: '#e5484d' }),
        h('path', { d: 'M28 43 23.8 28 28 29.8 32.2 28Z', fill: 'currentColor', opacity: 0.52 }),
        h('circle', { cx: 28, cy: 28, r: 2.1, fill: 'var(--mv-glass-strong, #fff)', stroke: 'currentColor', strokeWidth: 0.6, opacity: 0.95 }),
      ),
    ),
  )
}
