export function captureSelectionFrame(viewer, screenRing = []) {
  const canvas = viewer?.canvas ?? viewer?.scene?.canvas
  if (typeof document === 'undefined' || !canvas?.clientWidth || !canvas?.clientHeight) return null
  try {
    viewer.render?.()
    const image = document.createElement('canvas')
    const scale = Math.min(1, 1024 / Math.max(canvas.width, canvas.height))
    image.width = Math.round(canvas.width * scale)
    image.height = Math.round(canvas.height * scale)
    if (image.width < 32 || image.height < 32) return null
    const context = image.getContext('2d')
    if (!context) return null
    context.drawImage(canvas, 0, 0, image.width, image.height)
    const ring = screenRing.map((point) => [point.x / canvas.clientWidth, point.y / canvas.clientHeight])
    if (ring.some((point) => point.some((value) => !Number.isFinite(value)))) return null
    if (ring.length) {
      context.beginPath()
      if (ring.length === 1) context.arc(ring[0][0] * image.width, ring[0][1] * image.height, 10, 0, Math.PI * 2)
      else {
        ring.forEach((point, index) => context[index === 0 ? 'moveTo' : 'lineTo'](point[0] * image.width, point[1] * image.height))
        context.closePath()
      }
      context.fillStyle = 'rgba(34,211,238,0.12)'
      context.fill()
      context.lineJoin = 'round'
      context.strokeStyle = '#082f49'
      context.lineWidth = 6
      context.stroke()
      context.strokeStyle = '#67e8f9'
      context.lineWidth = 2
      context.stroke()
    }
    const imageUrl = image.toDataURL('image/jpeg', 0.85)
    if (imageUrl.length > 2_000_000) return null
    return { image: imageUrl, width: image.width, height: image.height, ring, captured_at: new Date().toISOString() }
  } catch { return null }
}

export function createScreenSelectionOverlay(viewer) {
  let element = null
  const clear = () => { element?.remove?.(); element = null }
  return {
    clear,
    update(points) {
      if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') return
      const canvas = viewer.canvas ?? viewer.scene?.canvas
      const host = viewer.container ?? canvas?.parentElement
      if (!host || !canvas?.clientWidth) return
      if (!element) {
        element = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        element.setAttribute('aria-hidden', 'true')
        element.style.cssText = 'position:absolute;pointer-events:none;z-index:9;overflow:visible'
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
        polygon.setAttribute('fill', 'rgba(34,211,238,.16)')
        polygon.setAttribute('stroke', '#67e8f9')
        polygon.setAttribute('stroke-width', '2')
        polygon.setAttribute('stroke-linejoin', 'round')
        polygon.style.filter = 'drop-shadow(0 0 1px #082f49) drop-shadow(0 0 1px #082f49)'
        element.appendChild(polygon)
        host.appendChild(element)
      }
      const canvasRect = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0 }
      const hostRect = host.getBoundingClientRect?.() ?? { left: 0, top: 0 }
      element.style.left = `${canvasRect.left - hostRect.left}px`
      element.style.top = `${canvasRect.top - hostRect.top}px`
      element.setAttribute('width', String(canvas.clientWidth))
      element.setAttribute('height', String(canvas.clientHeight))
      element.firstChild.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '))
    },
  }
}

export function usableSurfaceRing(ground) {
  if (!ground?.complete || ground.points?.length < 3 || !Array.isArray(ground.ring)) return false
  const ring = ground.ring.slice(0, -1)
  const origin = ring[0]
  if (!origin || ring.some((point) => !point.every(Number.isFinite) || Math.abs(point[0] - origin[0]) > 10 || Math.abs(point[1] - origin[1]) > 10)) return false
  if (new Set(ring.map((point) => `${point[0]},${point[1]}`)).size < 3) return false
  const area = ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length]
    return sum + (point[0] - origin[0]) * (next[1] - origin[1]) - (next[0] - origin[0]) * (point[1] - origin[1])
  }, 0)
  if (Math.abs(area) < 1e-20) return false
  const cross = (start, end, point) => (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])
  for (let first = 0; first < ring.length; first++) {
    const start = ring[first], end = ring[(first + 1) % ring.length]
    for (let second = first + 2; second < ring.length; second++) {
      if (first === 0 && second === ring.length - 1) continue
      const other = ring[second], next = ring[(second + 1) % ring.length]
      if (cross(start, end, other) * cross(start, end, next) < 0 && cross(other, next, start) * cross(other, next, end) < 0) return false
    }
  }
  return true
}
