export const visionError = (code) => Object.assign(new Error(code), { code })

const cross = (start, end, point) => (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])

function onSegment(start, end, point) {
  return Math.abs(cross(start, end, point)) < 1e-10 && point[0] >= Math.min(start[0], end[0]) - 1e-10 &&
    point[0] <= Math.max(start[0], end[0]) + 1e-10 && point[1] >= Math.min(start[1], end[1]) - 1e-10 && point[1] <= Math.max(start[1], end[1]) + 1e-10
}

export function containsVisionPoint(polygon, point) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[index], end = polygon[previous]
    if (onSegment(start, end, point)) return true
    if ((start[1] > point[1]) !== (end[1] > point[1]) && point[0] < (end[0] - start[0]) * (point[1] - start[1]) / (end[1] - start[1]) + start[0]) inside = !inside
  }
  return inside
}

function pointSegmentDistance(point, start, end) {
  const dx = end[0] - start[0], dy = end[1] - start[1]
  const length = dx * dx + dy * dy
  if (length === 0) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length))
  return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy))
}

/** Distance from a normalized point to the polygon boundary (target clicks may sit on an edge). */
export function distanceToPolygon(polygon, point) {
  let minimum = Infinity
  for (let index = 0; index < polygon.length; index += 1) {
    minimum = Math.min(minimum, pointSegmentDistance(point, polygon[index], polygon[(index + 1) % polygon.length]))
  }
  return minimum
}

function normalizeVertices(polygon, options) {
  let vertices = polygon.map((vertex) => {
    const raw = Array.isArray(vertex) ? vertex : vertex && typeof vertex === 'object' ? [vertex.x, vertex.y] : null
    if (!raw || raw.length !== 2) throw visionError('invalid_result')
    const x = Number(raw[0]), y = Number(raw[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw visionError('invalid_result')
    return [x, y]
  })
  const width = Number(options?.width), height = Number(options?.height)
  const maximum = Math.max(0, ...vertices.flatMap((vertex) => vertex))
  if (maximum > 1) {
    const isPixel = Number.isFinite(width) && Number.isFinite(height) && width > 1 && height > 1 &&
      maximum <= Math.max(width, height) * 1.02 &&
      vertices.every(([x, y]) => x >= 0 && x <= width * 1.02 && y >= 0 && y <= height * 1.02) &&
      (maximum > 100 || Math.max(width, height) <= 100)
    const divisor = isPixel ? [width, height] : maximum <= 100 ? [100, 100] : null
    if (!divisor) throw visionError('invalid_result')
    vertices = vertices.map(([x, y]) => [x / divisor[0], y / divisor[1]])
  }
  if (!vertices.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw visionError('invalid_result')
  return vertices
}

function simplifyPolygon(polygon) {
  const unique = []
  for (const vertex of polygon) {
    const previous = unique[unique.length - 1]
    if (!previous || previous[0] !== vertex[0] || previous[1] !== vertex[1]) unique.push(vertex)
  }
  const cleaned = []
  for (let index = 0; index < unique.length; index += 1) {
    const previous = unique[(index - 1 + unique.length) % unique.length]
    const current = unique[index]
    const next = unique[(index + 1) % unique.length]
    // Drop near-collinear interior points the model added along a straight edge.
    if (Math.abs(cross(previous, current, next)) > 1e-8) cleaned.push(current)
  }
  return cleaned.length >= 3 ? cleaned : unique
}

export function validateVisionPolygon(value, point, options = {}) {
  let polygon = value?.polygon ?? value?.points ?? value?.vertices ?? (Array.isArray(value) ? value : value?.coordinates)
  const shape = Array.isArray(polygon) ? 'polygon' : 'box'
  const bbox = Array.isArray(value?.bbox) ? value.bbox : Array.isArray(value?.box) ? value.box
    : value?.bbox && typeof value.bbox === 'object' ? [value.bbox.left, value.bbox.top, value.bbox.right, value.bbox.bottom] : null
  if (!polygon && Array.isArray(bbox) && bbox.length === 4) {
    const [left, top, right, bottom] = bbox.map(Number)
    if (!(right > left && bottom > top)) throw visionError('invalid_result')
    polygon = [[left, top], [right, top], [right, bottom], [left, bottom]]
  }
  if (!Array.isArray(polygon)) throw visionError(value?.polygon === null ? 'no_target' : 'invalid_result')
  polygon = normalizeVertices(polygon, options)
  if (polygon.length > 1 && polygon[0].every((number, index) => number === polygon.at(-1)[index])) polygon.pop()
  polygon = simplifyPolygon(polygon)
  if (polygon.length < 3 || polygon.length > 32 || new Set(polygon.map((vertex) => vertex.join(','))).size !== polygon.length) throw visionError('invalid_result')
  let area = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index], end = polygon[(index + 1) % polygon.length]
    area += start[0] * end[1] - end[0] * start[1]
    for (let other = index + 1; other < polygon.length; other += 1) {
      if (other === index + 1 || (index === 0 && other === polygon.length - 1)) continue
      const from = polygon[other], to = polygon[(other + 1) % polygon.length]
      if ((cross(start, end, from) * cross(start, end, to) < 0 && cross(from, to, start) * cross(from, to, end) < 0) ||
          onSegment(start, end, from) || onSegment(start, end, to) || onSegment(from, to, start) || onSegment(from, to, end)) throw visionError('invalid_result')
    }
  }
  if (Math.abs(area) / 2 < 0.00001 || Math.abs(area) / 2 > 0.85) throw visionError('invalid_result')
  // The click is the user's anchor; allow it to sit just outside the model's
  // approximate silhouette (edges are commonly off by a few pixels).
  if (point && !containsVisionPoint(polygon, point) && distanceToPolygon(polygon, point) > 0.08) throw visionError('invalid_result')
  return { polygon, shape, approximate: true }
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(cleaned) } catch { /* find the first complete object below */ }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw visionError('invalid_result')
  try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { throw visionError('invalid_result') }
}

export function parseVisionOutput(text, point, options = {}) {
  if (typeof text !== 'string' || text.length > 8192) throw visionError('invalid_result')
  return validateVisionPolygon(extractJson(text), point, options)
}
