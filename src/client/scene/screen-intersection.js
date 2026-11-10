const valueAt = (property, time) => typeof property?.getValue === 'function' ? property.getValue(time) : property

function inside(point, ring) {
  let hit = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const start = ring[index], end = ring[previous]
    if (!start || !end) continue
    if ((start.y > point.y) !== (end.y > point.y) && point.x < (end.x - start.x) * (point.y - start.y) / (end.y - start.y) + start.x) hit = !hit
  }
  return hit
}

function segmentHits(start, end, box) {
  if (!start || !end) return false
  let enter = 0, leave = 1
  const deltaX = end.x - start.x, deltaY = end.y - start.y
  for (const [direction, distance] of [[-deltaX, start.x - box.left], [deltaX, box.right - start.x], [-deltaY, start.y - box.top], [deltaY, box.bottom - start.y]]) {
    if (direction === 0) { if (distance < 0) return false; continue }
    const ratio = distance / direction
    if (direction < 0) enter = Math.max(enter, ratio)
    else leave = Math.min(leave, ratio)
    if (enter > leave) return false
  }
  return true
}

export function entityIntersectsScreenBox(Cesium, viewer, entity, box) {
  const time = viewer.clock?.currentTime
  if (!entity || entity.isShowing === false || valueAt(entity.show, time) === false) return false
  const project = (cartesian) => {
    if (!cartesian) return null
    try {
      const point = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesian)
      return Number.isFinite(point?.x) && Number.isFinite(point?.y) ? point : null
    } catch { return null }
  }
  const pointInside = (point) => point && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
  const pathHits = (points, closed = false) => {
    if (points.some(pointInside)) return true
    for (let index = 1; index < points.length; index += 1) if (segmentHits(points[index - 1], points[index], box)) return true
    return closed && points.length > 2 && segmentHits(points.at(-1), points[0], box)
  }
  try {
    if (pointInside(project(valueAt(entity.position, time)))) return true
    const line = valueAt(entity.polyline?.positions, time)
    if (valueAt(entity.polyline?.show, time) !== false && Array.isArray(line) && pathHits(line.map(project))) return true
    if (valueAt(entity.polygon?.show, time) === false) return false
    const hierarchy = valueAt(entity.polygon?.hierarchy, time)
    if (!Array.isArray(hierarchy?.positions)) return false
    const projected = (node) => ({ positions: node.positions.map(project), holes: (node.holes ?? []).filter((hole) => Array.isArray(hole.positions)).map(projected) })
    const polygons = (node, depth = 0) => {
      const outer = node.positions
      if (pathHits(outer, true)) return true
      const holes = node.holes
      if (depth % 2 === 0 && outer.every(Boolean)) {
        const corner = { x: box.left, y: box.top }
        if (inside(corner, outer) && !holes.some((hole) => inside(corner, hole.positions))) return true
      }
      return holes.some((hole) => polygons(hole, depth + 1))
    }
    return polygons(projected(hierarchy))
  } catch { return false }
}

export function rowsInScreenBox(Cesium, viewer, rows, rect) {
  const box = { left: Math.min(rect.x1, rect.x2), right: Math.max(rect.x1, rect.x2), top: Math.min(rect.y1, rect.y2), bottom: Math.max(rect.y1, rect.y2) }
  const hits = new WeakMap()
  return (Array.isArray(rows) ? rows : []).filter((row) => (row.entities ?? []).some((entity) => {
    if (!entity || typeof entity !== 'object') return false
    if (!hits.has(entity)) hits.set(entity, entityIntersectsScreenBox(Cesium, viewer, entity, box))
    return hits.get(entity)
  })).map((row) => ({ selectionId: row.selectionId, kind: row.kind, index: row.index, label: row.label, detail: row.detail }))
}
