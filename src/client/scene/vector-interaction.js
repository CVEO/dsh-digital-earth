import { annotationFeatureId } from './annotation-model.js'
import { createVectorLabels } from './vector-labels.js'
import { segmentDistance, styleVectorOptions, vectorLineMaterial } from './vector-style.js'

export function createVectorInteraction({ Cesium, viewer, root, getTool, onSelect }) {
  const document = root.ownerDocument
  const entries = new Map()
  const groups = new Map()
  let hovered = null
  let selected = null
  let moving = false
  let timer = null
  let pointer = null
  let disposed = false
  const valueOf = (property) => property?.getValue ? property.getValue(viewer.clock.currentTime) : property
  const groupOf = (picked) => entries.get(picked?.id ?? picked?.primitive?.id)?.group ?? null
  const enabled = () => !moving && (!getTool() || getTool() === 'pick' || getTool() === 'identify')
  const labels = createVectorLabels({ Cesium, viewer, root, onHover: setHover, onSelect: select, isInteractive: enabled })

  function applyState(group) {
    if (!group) return
    const active = group === selected || group === hovered
    for (const entity of groups.get(group)?.entities ?? []) {
      const entry = entries.get(entity)
      for (const [graphic, property, original] of entry.originals) graphic[property] = original
      if (!active) continue
      if (entity.polyline) {
        const isSelected = group === selected
        entity.polyline.width = valueOf(entry.width) + (isSelected ? 2.5 : 1.5)
        const material = entry.options.polyline.material
        if (material instanceof Cesium.PolylineOutlineMaterialProperty) {
          const color = Cesium.Color.lerp(valueOf(material.color), Cesium.Color.WHITE, isSelected ? 0.4 : 0.2, new Cesium.Color())
          entity.polyline.material = vectorLineMaterial(Cesium, color, isSelected ? 1.75 : 1.5)
        }
      }
      if (entity.point) entity.point.pixelSize = 11
      for (const kind of ['polygon', 'rectangle']) {
        const graphic = entity[kind]
        const color = entry.options[kind]?.material
        if (graphic && color instanceof Cesium.Color) graphic.material = color.withAlpha(group === selected ? 0.3 : 0.23)
      }
    }
  }

  function setHover(group) {
    if (disposed || group && !enabled()) return
    if (hovered === group) return
    const previous = hovered
    hovered = group
    applyState(previous)
    applyState(group)
    labels.setState(hovered, selected)
    root.classList.toggle('mv-vector-hovering', Boolean(group))
    viewer.scene.requestRender()
  }

  function select(group, force = false) {
    if (disposed || (group && !force && !enabled())) return false
    const previous = selected
    selected = group
    applyState(previous)
    applyState(group)
    labels.setState(hovered, selected)
    const record = groups.get(group)
    const summary = record && [...record.entities].map((entity) => valueOf(entity.label?.text)).filter(Boolean).join(' · ')
    onSelect(record ? { ...record.descriptor, summary: summary && summary !== record.descriptor.title ? summary : record.descriptor.summary, id: group } : null)
    viewer.scene.requestRender()
    return Boolean(record)
  }

  function hit(position) {
    if (!enabled() || groups.size === 0) return null
    const scene = viewer.scene
    const direct = groupOf(scene.pick(position, 9, 9))
    if (direct) return direct
    for (const picked of scene.drillPick(position, 8, 9, 9) ?? []) {
      const group = groupOf(picked)
      if (group) return group
    }
    let budget = 512
    let closest = 6
    let found = null
    const occluder = new Cesium.EllipsoidalOccluder(scene.globe.ellipsoid, viewer.camera.positionWC)
    for (const [entity, entry] of entries) {
      if (!entity.polyline || valueOf(entity.polyline.clampToGround) || entity.isShowing === false || budget <= 0) continue
      const positions = valueOf(entity.polyline.positions) ?? []
      let previous = null
      for (const world of positions) {
        if (--budget < 0) break
        const point = occluder.isPointVisible(world) ? Cesium.SceneTransforms.worldToWindowCoordinates(scene, world) : null
        if (point && previous) {
          const distance = segmentDistance(position, previous, point)
          if (distance < closest) {
            closest = distance
            found = entry.group
          }
        }
        previous = point
      }
    }
    return found
  }

  function move(event) {
    if (event.buttons || !enabled()) {
      leave()
      return
    }
    const rect = viewer.canvas.getBoundingClientRect()
    pointer = new Cesium.Cartesian2(event.clientX - rect.left, event.clientY - rect.top)
    if (timer !== null || groups.size === 0) return
    timer = setTimeout(() => {
      timer = null
      if (enabled() && pointer) setHover(hit(pointer))
    }, 60)
  }

  function leave() {
    clearTimeout(timer)
    timer = null
    pointer = null
    setHover(null)
  }

  function removed(collection, added, removedEntities) {
    for (const entity of removedEntities) {
      const entry = entries.get(entity)
      if (!entry) continue
      labels.remove(entity)
      entries.delete(entity)
      const record = groups.get(entry.group)
      record.entities.delete(entity)
      if (record.entities.size > 0) continue
      if (hovered === entry.group) setHover(null)
      if (selected === entry.group) select(null)
      groups.delete(entry.group)
    }
  }

  function onKey(event) {
    const active = document.activeElement
    if (event.key === 'Escape' && (!active || active === document.body || root.contains(active))) {
      leave()
      select(null)
    }
  }
  const onStart = () => { moving = true; leave() }
  const onEnd = () => { moving = false; labels.refreshAnchors(); labels.update(true) }
  const onFrame = () => labels.update()
  viewer.canvas.addEventListener('pointermove', move)
  viewer.canvas.addEventListener('pointerleave', leave)
  viewer.canvas.addEventListener('pointerdown', leave)
  document.addEventListener('keydown', onKey)
  viewer.camera.moveStart.addEventListener(onStart)
  viewer.camera.moveEnd.addEventListener(onEnd)
  viewer.scene.postRender.addEventListener(onFrame)
  viewer.entities.collectionChanged.addEventListener(removed)

  function add(options, descriptor) {
    const styled = styleVectorOptions(Cesium, options)
    const entity = viewer.entities.add(styled)
    const group = descriptor.group
    const record = groups.get(group) ?? { descriptor, entities: new Set() }
    record.entities.add(entity)
    groups.set(group, record)
    const originals = []
    if (entity.polyline) originals.push([entity.polyline, 'width', entity.polyline.width], [entity.polyline, 'material', entity.polyline.material])
    if (entity.point) originals.push([entity.point, 'pixelSize', entity.point.pixelSize])
    for (const kind of ['polygon', 'rectangle']) if (entity[kind]) originals.push([entity[kind], 'material', entity[kind].material])
    entries.set(entity, { group, options: styled, originals, width: entity.polyline?.width })
    labels.add(entity, styled, group, descriptor)
    labels.setState(hovered, selected)
    applyState(group)
    viewer.scene.requestRender()
    return entity
  }

  return {
    add,
    click(position) {
      if (!enabled()) return false
      return select(hit(position))
    },
    clearSelection() { leave(); select(null) },
    selectByFeature(command, matchFeature) {
      if (!command || !matchFeature) return false
      const targetId = annotationFeatureId(matchFeature)
      const targetName = matchFeature.properties?.name ?? null
      const targetKind = matchFeature.properties?.kind ?? null
      const targetGeometry = targetId === '' ? JSON.stringify(matchFeature.geometry ?? null) : null
      for (const [group, record] of groups) {
        const desc = record?.descriptor
        if (!desc || desc.command !== command) continue
        const candidate = desc.feature
        if (!candidate) continue
        if (candidate === matchFeature) return select(group, true)
        if (targetId !== '' && annotationFeatureId(candidate) === targetId) return select(group, true)
        if (
          targetId === '' &&
          (candidate.properties?.name ?? null) === targetName &&
          (candidate.properties?.kind ?? null) === targetKind &&
          JSON.stringify(candidate.geometry ?? null) === targetGeometry
        ) {
          return select(group, true)
        }
      }
      return false
    },
    refresh(descriptor) {
      const record = groups.get(descriptor.group)
      if (!record) return
      record.descriptor = descriptor
      if (selected === descriptor.group) onSelect({ ...descriptor, id: selected })
    },
    drawLabels: labels.paint,
    dispose() {
      leave()
      selected = null
      disposed = true
      for (const group of groups.keys()) applyState(group)
      viewer.canvas.removeEventListener('pointermove', move)
      viewer.canvas.removeEventListener('pointerleave', leave)
      viewer.canvas.removeEventListener('pointerdown', leave)
      document.removeEventListener('keydown', onKey)
      viewer.camera.moveStart.removeEventListener(onStart)
      viewer.camera.moveEnd.removeEventListener(onEnd)
      viewer.scene.postRender.removeEventListener(onFrame)
      viewer.entities.collectionChanged.removeEventListener(removed)
      labels.dispose()
      entries.clear()
      groups.clear()
    },
  }
}
