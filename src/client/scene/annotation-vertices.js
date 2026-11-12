/**
 * scene/annotation-vertices.js — pure geometry for the vertex handles (F2b2).
 *
 * The editor draws one handle per editable vertex and one centre handle; this
 * module decides which vertices exist and where a new one is inserted, so the
 * canvas layer stays thin and the rules stay testable without a browser.
 *
 * Only the outer ring is editable: holes and multi-polygons are read-only for
 * now, because a single-ring editor that also rewrites holes would need a hole
 * selection UI the card does not have yet.
 */

function editableRing(feature) {
  const geometry = feature?.geometry
  if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    return { kind: 'line', ring: geometry.coordinates, closed: false }
  }
  if (geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0])) {
    return { kind: 'area', ring: geometry.coordinates[0], closed: true }
  }
  return null
}

/** Real corner count: a closed polygon ring repeats its first vertex. */
export function vertexCornerCount(ring, closed) {
  if (!Array.isArray(ring) || ring.length === 0) return 0
  if (!closed || ring.length < 2) return ring.length
  const first = ring[0]
  const last = ring[ring.length - 1]
  const duplicated = first?.[0] === last?.[0] && first?.[1] === last?.[1]
  return duplicated ? ring.length - 1 : ring.length
}

/** Handles for the outer ring: one per vertex, never the duplicated closing one. */
export function annotationHandlePoints(feature) {
  const editable = editableRing(feature)
  if (!editable) return []
  const corners = vertexCornerCount(editable.ring, editable.closed)
  const handles = []
  for (let index = 0; index < corners; index += 1) {
    const vertex = editable.ring[index]
    if (!Array.isArray(vertex) || vertex.length < 2) continue
    if (!Number.isFinite(vertex[0]) || !Number.isFinite(vertex[1])) continue
    handles.push({ ringIndex: 0, vertexIndex: index, lon: vertex[0], lat: vertex[1] })
  }
  return handles
}

/** Average of the handles: the whole-feature drag grip. */
export function annotationCenterPoint(handles) {
  if (!Array.isArray(handles) || handles.length === 0) return null
  let lon = 0
  let lat = 0
  for (const handle of handles) {
    lon += handle.lon
    lat += handle.lat
  }
  return { lon: lon / handles.length, lat: lat / handles.length }
}

/**
 * Where Alt+click on a vertex inserts a new one: the midpoint of the segment
 * that follows it (the ring wraps for polygons, the previous segment at the end
 * of a line). Returns the vertex index the new point is inserted AFTER.
 */
export function annotationInsertPoint(feature, vertexIndex) {
  const editable = editableRing(feature)
  if (!editable) return { ok: false, error: 'unsupported_geometry' }
  const corners = vertexCornerCount(editable.ring, editable.closed)
  if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= corners) {
    return { ok: false, error: 'vertex_out_of_range' }
  }
  let after = vertexIndex
  let next = vertexIndex + 1
  if (next >= corners) {
    if (!editable.closed) {
      if (corners < 2) return { ok: false, error: 'too_few_vertices' }
      after = vertexIndex - 1
      next = vertexIndex
    } else {
      next = 0
    }
  }
  const a = editable.ring[after]
  const b = editable.ring[next]
  if (!Array.isArray(a) || !Array.isArray(b)) return { ok: false, error: 'vertex_out_of_range' }
  return { ok: true, after, lon: (a[0] + b[0]) / 2, lat: (a[1] + b[1]) / 2 }
}

/** True when the feature has an editable ring (point/note features do not). */
export function isShapeEditable(feature) {
  return editableRing(feature) !== null
}
