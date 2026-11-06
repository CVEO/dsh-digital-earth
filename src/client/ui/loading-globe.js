import React from 'react'

import { EARTH_MASK } from './earth-mask.js'
import { buildGlobeProjection, renderGlobePixels } from './loading-globe-renderer.js'

export function LoadingGlobe() {
  const canvasRef = React.useRef(null)
  React.useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!context) return
    const size = Math.round(80 * Math.min(window.devicePixelRatio || 1, 2))
    canvas.width = size
    canvas.height = size
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const image = new Image()
    let frame = 0
    let texture = null
    let projection = null
    let lastDraw = -Infinity
    const started = performance.now()
    const output = context.createImageData(size, size)
    const draw = (now) => {
      frame = 0
      if (!texture || document.hidden) return
      if (reducedMotion.matches || now - lastDraw >= 1000 / 30) {
        output.data.set(renderGlobePixels(projection, texture, reducedMotion.matches ? 0 : now - started))
        context.putImageData(output, 0, 0)
        lastDraw = now
      }
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw)
    }
    const resume = () => {
      cancelAnimationFrame(frame)
      lastDraw = -Infinity
      draw(performance.now())
    }
    image.onload = () => {
      const map = document.createElement('canvas')
      map.width = image.width
      map.height = image.height
      const mapContext = map.getContext('2d')
      if (!mapContext) return
      mapContext.drawImage(image, 0, 0)
      texture = mapContext.getImageData(0, 0, image.width, image.height).data
      projection = buildGlobeProjection(size, image.width, image.height)
      resume()
    }
    image.src = EARTH_MASK
    reducedMotion.addEventListener('change', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      cancelAnimationFrame(frame)
      image.onload = null
      reducedMotion.removeEventListener('change', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [])
  return React.createElement('div', { className: 'mv-spinner', 'aria-hidden': true },
    React.createElement('canvas', { ref: canvasRef, className: 'mv-loading-globe' }))
}
