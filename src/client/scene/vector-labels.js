import { VECTOR_FONT } from './vector-style.js'

export function createVectorLabels({ Cesium, viewer, root, onHover, onSelect, isInteractive }) {
  const document = root.ownerDocument
  const layer = document.createElement('div')
  layer.className = 'mv-vector-labels'
  root.append(layer)
  const labels = new Map()
  let hovered = null
  let selected = null
  let lastFrame = -Infinity
  const valueOf = (property) => property?.getValue ? property.getValue(viewer.clock.currentTime) : property
  const occluder = new Cesium.EllipsoidalOccluder(viewer.scene.globe.ellipsoid, viewer.camera.positionWC)

  function add(entity, options, group) {
    if (!options.label || !options.position) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'mv-vector-label'
    button.hidden = true
    button.addEventListener('pointerenter', () => onHover(group))
    button.addEventListener('pointerleave', () => onHover(null))
    button.addEventListener('focus', () => onHover(group))
    button.addEventListener('blur', () => onHover(null))
    button.addEventListener('pointerdown', (event) => event.stopPropagation())
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      onSelect(group)
    })
    layer.append(button)
    entity.label.show = false
    const label = { entity, group, options, button, text: '', anchor: null, box: null, size: null }
    labels.set(entity, label)
    refreshAnchors([label])
  }

  function refreshAnchors(targets = labels.values()) {
    for (const label of targets) {
      label.anchor = valueOf(label.entity.position)
      if (label.options.label.heightReference !== Cesium.HeightReference.CLAMP_TO_GROUND) continue
      try {
        const cartographic = Cesium.Cartographic.fromCartesian(label.anchor)
        const height = viewer.scene.sampleHeightSupported
          ? viewer.scene.sampleHeight(cartographic, [...labels.keys()])
          : viewer.scene.globe.getHeight(cartographic)
        if (Number.isFinite(height)) label.anchor = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, height)
      } catch {}
    }
  }

  function update(force = false) {
    const now = performance.now()
    if (!force && now - lastFrame < 32) return
    lastFrame = now
    occluder.cameraPosition = viewer.camera.positionWC
    const width = viewer.canvas.clientWidth
    const height = viewer.canvas.clientHeight
    const occupied = []
    const ordered = [...labels.values()].sort((left, right) =>
      Number(right.group === selected || right.group === hovered) - Number(left.group === selected || left.group === hovered))
    let visible = 0
    for (const label of ordered) {
      const { button, entity, options } = label
      button.disabled = !isInteractive()
      label.box = null
      if (entity.isShowing === false || !label.anchor || visible >= 80 || !occluder.isPointVisible(label.anchor)) { button.hidden = true; continue }
      const point = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, label.anchor)
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x > width || point.y > height) { button.hidden = true; continue }
      const text = String(valueOf(options.label.text) ?? '')
      if (!text) { button.hidden = true; continue }
      if (text !== label.text) {
        button.textContent = text
        button.setAttribute('aria-label', text)
        label.text = text
        label.size = null
      }
      if (!label.size || label.size.canvasWidth !== width) {
        button.hidden = false
        label.size = { width: button.offsetWidth, height: button.offsetHeight, canvasWidth: width }
      }
      const boxWidth = label.size.width
      const boxHeight = label.size.height
      const offset = valueOf(options.label.pixelOffset) ?? { x: 0, y: -20 }
      const left = Math.max(8, Math.min(width - boxWidth - 8, Math.round(point.x + offset.x - boxWidth / 2)))
      const candidates = [Math.round(point.y + offset.y - boxHeight), Math.round(point.y + 16)]
      for (const top of candidates) {
        const box = { left, top, right: left + boxWidth, bottom: top + boxHeight }
        if (top < 8 || box.bottom > height - 8 || occupied.some((other) => box.left < other.right + 6 && box.right > other.left - 6 && box.top < other.bottom + 6 && box.bottom > other.top - 6)) continue
        button.style.left = `${left}px`
        button.style.top = `${top}px`
        label.box = box
        occupied.push(box)
        visible += 1
        break
      }
      button.hidden = label.box === null
    }
  }

  function setState(nextHovered, nextSelected) {
    hovered = nextHovered
    selected = nextSelected
    for (const label of labels.values()) {
      label.button.dataset.state = label.group === selected ? 'selected' : label.group === hovered ? 'hover' : 'idle'
      label.button.setAttribute('aria-pressed', String(label.group === selected))
    }
    update(true)
  }

  function remove(entity) {
    labels.get(entity)?.button.remove()
    labels.delete(entity)
  }

  function paint(context, width, height) {
    update(true)
    const scaleX = width / viewer.canvas.clientWidth
    const scaleY = height / viewer.canvas.clientHeight
    const dark = root.dataset.mvScheme === 'dark'
    context.save()
    context.scale(scaleX, scaleY)
    context.font = VECTOR_FONT
    context.textBaseline = 'middle'
    for (const label of labels.values()) {
      if (!label.box) continue
      const { left, top, right, bottom } = label.box
      context.beginPath()
      context.roundRect(left, top, right - left, bottom - top, 8)
      context.fillStyle = dark ? '#17212f' : '#fcfdff'
      context.fill()
      context.strokeStyle = dark ? '#3c4d63' : '#cad7e3'
      context.lineWidth = 1
      context.stroke()
      context.fillStyle = dark ? '#edf5ff' : '#20344c'
      context.fillText(label.text, left + 11, (top + bottom) / 2)
    }
    context.restore()
  }

  return {
    add, remove, update, refreshAnchors, setState, paint,
    dispose() {
      layer.remove()
      labels.clear()
    },
  }
}
