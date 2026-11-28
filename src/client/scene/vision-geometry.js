export const visionError = (code, extra = null) =>
  Object.assign(new Error(code), { code }, extra && typeof extra === 'object' ? extra : {})

const MAX_BATCH_OBJECTS = 40
const MAX_MODEL_CLASS_CHARS = 24

/**
 * The workbench may ask for any class ("温室", "光伏板"), so the parser accepts
 * arbitrary labels instead of a fixed whitelist. Unsafe or oversized labels are
 * dropped; synonym mapping onto preset classes happens later in annotation-scheme.
 */
function normalizeModelClass(value) {
  if (typeof value !== 'string') return ''
  const collapsed = value.replace(/[\u0000-\u001f\u007f"'`]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!collapsed || [...collapsed].length > MAX_MODEL_CLASS_CHARS) return ''
  return collapsed
}

const cross = (start, end, point) => (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])

function onSegment(start, end, point) {
  return Math.abs(cross(start, end, point)) < 1e-10 && point[0] >= Math.min(start[0], end[0]) - 1e-10 &&
    point[0] <= Math.max(start[0], end[0]) + 1e-10 && point[1] >= Math.min(start[1], end[1]) - 1e-10 && point[1] <= Math.max(start[1], end[1]) + 1e-10
}

export function ringCrossesItself(polygon) {
  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i], end = polygon[(i+1) % polygon.length]
    for (let j = i+2; j < polygon.length; j++) {
      if (i === 0 && j === polygon.length-1) continue
      const from = polygon[j], to = polygon[(j+1) % polygon.length]
      if ((cross(start,end,from)*cross(start,end,to) < 0 && cross(from,to,start)*cross(from,to,end) < 0) ||
          onSegment(start,end,from) || onSegment(start,end,to) || onSegment(from,to,start) || onSegment(from,to,end)) return true
    }
  }
  return false
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

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function parseRawVertices(polygon) {
  return polygon.map((vertex) => {
    const raw = Array.isArray(vertex) ? vertex : vertex && typeof vertex === 'object' ? [vertex.x, vertex.y] : null
    if (!raw || raw.length !== 2) throw visionError('invalid_result', { stage: 'geometry', detail: 'Vertex must be [x, y].' })
    const x = Number(raw[0]), y = Number(raw[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw visionError('invalid_result', { stage: 'geometry', detail: 'Vertex coordinates must be finite numbers.' })
    return [x, y]
  })
}

function scaleVertices(rawVertices, divisor) {
  let clamped = false
  const out = rawVertices.map(([x, y]) => {
    const nx = x / divisor[0]
    const ny = y / divisor[1]
    if (nx < -0.03 || nx > 1.03 || ny < -0.03 || ny > 1.03) return null
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) clamped = true
    return [clamp01(nx), clamp01(ny)]
  })
  if (out.some((item) => item === null)) return null
  return { vertices: out, clamped }
}

function resolveCoordinateCandidates(rawVertices, options = {}) {
  const width = Number(options?.width), height = Number(options?.height)
  const hasSize = Number.isFinite(width) && Number.isFinite(height) && width > 1 && height > 1
  const hint = typeof options?.coordSpace === 'string' ? options.coordSpace.toLowerCase() : 'auto'

  if (hint === 'unit') return [{ space: 'unit', divisor: [1, 1] }]
  if (hint === 'percent') return [{ space: 'percent', divisor: [100, 100] }]
  if (hint === 'thousand') return [{ space: 'thousand', divisor: [1000, 1000] }]
  if (hint === 'pixel' && hasSize) return [{ space: 'pixel', divisor: [width, height] }]

  const flat = rawVertices.flatMap((vertex) => vertex)
  const maximum = Math.max(0, ...flat)
  const minimum = Math.min(0, ...flat)
  if (maximum <= 1.03 && minimum >= -0.03) {
    return [{ space: 'unit', divisor: [1, 1] }]
  }

  const candidates = []
  const maxDim = hasSize ? Math.max(width, height) : 0
  const fitsPixel = hasSize &&
    rawVertices.every(([x, y]) => x >= -width * 0.03 && x <= width * 1.03 && y >= -height * 0.03 && y <= height * 1.03) &&
    (maximum > 100 || maxDim <= 100)
  if (fitsPixel) candidates.push({ space: 'pixel', divisor: [width, height] })

  if (maximum > 100 && maximum <= 1030 && minimum >= -30) {
    const sameAsPixel = fitsPixel && width === 1000 && height === 1000
    if (!sameAsPixel) candidates.push({ space: 'thousand', divisor: [1000, 1000] })
  }
  if (maximum <= 103 && minimum >= -3) {
    candidates.push({ space: 'percent', divisor: [100, 100] })
  }
  return candidates
}

function normalizeVerticesWithSpace(polygon, options = {}, point = null) {
  const rawVertices = parseRawVertices(polygon)
  const candidates = resolveCoordinateCandidates(rawVertices, options)
  if (candidates.length === 0) {
    throw visionError('invalid_result', { stage: 'geometry', detail: 'Coordinates outside supported 0..1 / 0..100 / 0..1000 / pixel ranges.' })
  }
  const evaluated = []
  for (const candidate of candidates) {
    const scaled = scaleVertices(rawVertices, candidate.divisor)
    if (!scaled) continue
    let score = 0
    if (point) {
      const inside = containsVisionPoint(scaled.vertices, point)
      const dist = inside ? 0 : distanceToPolygon(scaled.vertices, point)
      // Strongly prefer the coordinate system under which the click falls inside
      // (disambiguates 0..1000 VLM coordinates vs 0..width pixel coordinates).
      score = inside ? 1000 - dist : Math.max(0, 100 - dist * 500)
      if (inside) {
        let cx = 0, cy = 0
        for (const [vx, vy] of scaled.vertices) { cx += vx; cy += vy }
        cx /= scaled.vertices.length
        cy /= scaled.vertices.length
        score -= Math.hypot(cx - point[0], cy - point[1]) * 10
      }
    }
    evaluated.push({ ...candidate, ...scaled, score })
  }
  if (evaluated.length === 0) {
    throw visionError('invalid_result', { stage: 'geometry', detail: 'Coordinates out of valid bounds.' })
  }
  if (point && evaluated.length > 1) {
    evaluated.sort((a, b) => b.score - a.score)
  }
  return evaluated[0]
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points
  let maxDist = -1
  let split = 0
  const start = points[0]
  const end = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = pointSegmentDistance(points[i], start, end)
    if (dist > maxDist) {
      maxDist = dist
      split = i
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, split + 1), epsilon)
    const right = douglasPeucker(points.slice(split), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [start, end]
}

export function simplifyRingToLimit(ring, maxVertices = 32) {
  if (ring.length <= maxVertices) return { ring, simplified: false }
  const closed = [...ring, ring[0]]
  for (const eps of [0.001, 0.002, 0.004, 0.008, 0.015, 0.025, 0.04, 0.06]) {
    const reduced = douglasPeucker(closed, eps)
    const open = reduced.length > 1 ? reduced.slice(0, -1) : reduced
    if (open.length >= 3 && open.length <= maxVertices) {
      return { ring: open, simplified: true }
    }
  }
  // Uniform stride fallback if every epsilon collapsed or kept too many points.
  const stride = Math.ceil(ring.length / maxVertices)
  const sampled = ring.filter((_, index) => index % stride === 0).slice(0, maxVertices)
  return { ring: sampled, simplified: true }
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

function extractRawShape(value) {
  let polygon = value?.polygon ?? value?.points ?? value?.vertices ?? (Array.isArray(value) ? value : value?.coordinates)
  let shape = Array.isArray(polygon) ? 'polygon' : 'box'
  const bbox = Array.isArray(value?.bbox) ? value.bbox : Array.isArray(value?.box) ? value.box
    : value?.bbox && typeof value.bbox === 'object' ? [value.bbox.left, value.bbox.top, value.bbox.right, value.bbox.bottom] : null
  if (!polygon && Array.isArray(bbox) && bbox.length === 4) {
    const [left, top, right, bottom] = bbox.map(Number)
    if (!(right > left && bottom > top)) throw visionError('invalid_result', { stage: 'geometry', detail: 'Invalid bbox ordering.' })
    polygon = [[left, top], [right, top], [right, bottom], [left, bottom]]
  }
  // Model-side box_2d convention: [ymin, xmin, ymax, xmax]
  if (!polygon && Array.isArray(value?.box_2d) && value.box_2d.length === 4) {
    const [ymin, xmin, ymax, xmax] = value.box_2d.map(Number)
    if (!(xmax > xmin && ymax > ymin)) throw visionError('invalid_result', { stage: 'geometry', detail: 'Invalid box_2d ordering.' })
    polygon = [[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax]]
    shape = 'box'
  }
  return { polygon, shape }
}

export function validateVisionPolygon(value, point, options = {}) {
  const { polygon: rawPolygon, shape } = extractRawShape(value)
  if (!Array.isArray(rawPolygon)) {
    throw visionError(value?.polygon === null ? 'no_target' : 'invalid_result', {
      stage: 'geometry',
      detail: value?.polygon === null ? 'Model reported no target at click.' : 'Output did not contain polygon or bbox.',
    })
  }
  const mergedOptions = {
    ...options,
    ...(typeof value?.coord_space === 'string' && !options?.coordSpace ? { coordSpace: value.coord_space } : {}),
  }
  const norm = normalizeVerticesWithSpace(rawPolygon, mergedOptions, point)
  let polygon = norm.vertices
  let repaired = norm.clamped
  if (polygon.length > 1 && polygon[0].every((number, index) => number === polygon.at(-1)[index])) polygon.pop()
  polygon = simplifyPolygon(polygon)
  if (polygon.length > 32) {
    const reduced = simplifyRingToLimit(polygon, 32)
    polygon = reduced.ring
    repaired = repaired || reduced.simplified
  }
  if (polygon.length < 3 || polygon.length > 32 || new Set(polygon.map((vertex) => vertex.join(','))).size !== polygon.length) {
    throw visionError('invalid_result', { stage: 'geometry', detail: `Polygon vertex count or uniqueness invalid (${polygon.length}).` })
  }
  if (ringCrossesItself(polygon)) throw visionError('invalid_result', { stage: 'geometry', detail: 'Polygon is self-intersecting.' })
  let area = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index], end = polygon[(index + 1) % polygon.length]
    area += start[0] * end[1] - end[0] * start[1]
  }
  if (Math.abs(area) / 2 < 0.00001 || Math.abs(area) / 2 > 0.85) {
    throw visionError('invalid_result', { stage: 'geometry', detail: 'Polygon area outside valid bounds.' })
  }
  // The click is the user's anchor; allow it to sit just outside the model's
  // approximate silhouette (edges are commonly off by a few pixels).
  if (point && !containsVisionPoint(polygon, point) && distanceToPolygon(polygon, point) > 0.1) {
    throw visionError('invalid_result', { stage: 'geometry', detail: 'Click point lies too far outside predicted outline.' })
  }
  return { polygon, shape, approximate: true, coordSpace: norm.space, ...(repaired ? { repaired: true } : {}) }
}

/** Strip <think> / <thought> / <reasoning> wrappers emitted by thinking VLMs. */
export function stripReasoningTags(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/<(?:think|thought|reasoning)\b[^>]*>[\s\S]*?<\/(?:think|thought|reasoning)>/gi, '')
    .replace(/<(?:think|thought|reasoning)\b[^>]*>[\s\S]*$/gi, '')
    .trim()
}

const VISION_KEYS = ['polygon', 'objects', 'bbox', 'box', 'box_2d', 'points', 'vertices', 'coordinates', 'items', 'detections']

function hasVisionKey(obj) {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj) && VISION_KEYS.some((key) => Object.hasOwn(obj, key))
}

function scanBalancedJsonObjects(text) {
  const found = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1
        if (depth === 0 && start >= 0) {
          const slice = text.slice(start, i + 1)
          try {
            const parsed = JSON.parse(slice)
            if (parsed && typeof parsed === 'object') found.push(parsed)
          } catch { /* skip non-JSON braces */ }
          start = -1
        }
      }
    }
  }
  return found
}

export function extractVisionJson(text) {
  const cleaned = stripReasoningTags(text)
  const direct = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    const parsed = JSON.parse(direct)
    if (parsed && typeof parsed === 'object') return parsed
  } catch { /* fall through to fenced & balanced-brace scan */ }

  // Prefer fenced JSON blocks first (scanning from last to first).
  const fenced = [...cleaned.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  for (let i = fenced.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(fenced[i][1].trim())
      if (hasVisionKey(parsed)) return parsed
    } catch { /* try next block */ }
  }

  const objects = scanBalancedJsonObjects(cleaned)
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    if (hasVisionKey(objects[i])) return objects[i]
  }
  if (objects.length > 0) return objects[objects.length - 1]
  throw visionError('invalid_result', { stage: 'parse', detail: 'Model output did not contain a valid JSON object.' })
}

export function parseVisionOutput(text, point, options = {}) {
  if (typeof text !== 'string' || text.length > 16384) {
    throw visionError('invalid_result', { stage: 'parse', detail: 'Model output text missing or exceeds length limit.' })
  }
  return validateVisionPolygon(extractVisionJson(text), point, options)
}

function normalizeBatchPolygon(item, options = {}) {
  let rawPoly = item?.polygon ?? item?.points ?? item?.vertices
  if (!Array.isArray(rawPoly)) {
    try {
      rawPoly = extractRawShape(item).polygon
    } catch {
      return null
    }
  }
  if (!Array.isArray(rawPoly) || rawPoly.length < 3) return null
  try {
    const norm = normalizeVerticesWithSpace(rawPoly, options, null)
    let ring = norm.vertices.map(([x, y]) => [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000])
    const deduped = []
    for (const pt of ring) {
      const last = deduped[deduped.length - 1]
      if (!last || Math.abs(last[0] - pt[0]) > 1e-6 || Math.abs(last[1] - pt[1]) > 1e-6) deduped.push(pt)
    }
    if (deduped.length > 1) {
      const first = deduped[0], last = deduped[deduped.length - 1]
      if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) deduped.pop()
    }
    if (deduped.length > 32) {
      ring = simplifyRingToLimit(deduped, 32).ring
    } else {
      ring = deduped
    }
    return ring.length >= 3 ? ring : null
  } catch {
    return null
  }
}

function inferBatchCoordSpace(rawList, options = {}) {
  const hint = typeof options?.coordSpace === 'string' ? options.coordSpace.toLowerCase() : 'auto'
  if (hint && hint !== 'auto') return hint
  const width = Number(options?.width), height = Number(options?.height)
  const hasSize = Number.isFinite(width) && Number.isFinite(height) && width > 1 && height > 1
  let globalMax = 0
  for (const item of rawList) {
    let rawPoly = item?.polygon ?? item?.points ?? item?.vertices
    if (!Array.isArray(rawPoly)) {
      try { rawPoly = extractRawShape(item).polygon } catch { rawPoly = null }
    }
    if (!Array.isArray(rawPoly)) continue
    for (const vertex of rawPoly) {
      const pair = Array.isArray(vertex) ? vertex : vertex && typeof vertex === 'object' ? [vertex.x, vertex.y] : null
      if (!pair || pair.length !== 2) continue
      const x = Number(pair[0]), y = Number(pair[1])
      if (Number.isFinite(x)) globalMax = Math.max(globalMax, x)
      if (Number.isFinite(y)) globalMax = Math.max(globalMax, y)
    }
  }
  if (globalMax <= 1.03) return 'unit'
  if (hasSize && globalMax > Math.max(width, height) * 1.03 && globalMax <= 1030) return 'thousand'
  if (!hasSize && globalMax > 100 && globalMax <= 1030) return 'thousand'
  if (hasSize && globalMax <= Math.max(width, height) * 1.03 && (globalMax > 100 || Math.max(width, height) <= 100)) return 'pixel'
  if (globalMax <= 103) return 'percent'
  return 'auto'
}

export function parseVisionBatchOutput(text, options = {}) {
  if (typeof text !== 'string' || text.length > 32768) {
    throw visionError('invalid_result', { stage: 'parse', detail: 'Batch model output missing or exceeds length limit.' })
  }
  const payload = extractVisionJson(text)
  const rawList = Array.isArray(payload?.objects)
    ? payload.objects
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.detections)
        ? payload.detections
        : null
  if (!Array.isArray(rawList)) {
    throw visionError('invalid_result', { stage: 'parse', detail: 'Batch JSON did not contain an objects array.' })
  }
  const batchSlice = rawList.slice(0, MAX_BATCH_OBJECTS * 2)
  const resolvedSpace = inferBatchCoordSpace(batchSlice, options)
  const batchOptions = { ...options, coordSpace: resolvedSpace }
  const objects = []
  let dropped = 0
  for (const item of batchSlice) {
    const kind = normalizeModelClass(
      typeof item?.class === 'string'
        ? item.class
        : typeof item?.category === 'string'
          ? item.category
          : typeof item?.label === 'string'
            ? item.label
            : '',
    )
    const polygon = normalizeBatchPolygon(item, batchOptions)
    const confidence = typeof item?.confidence === 'number' && Number.isFinite(item.confidence)
      ? Math.min(1, Math.max(0, item.confidence))
      : null
    if (kind === '' || polygon === null) { dropped += 1; continue }
    objects.push({ class: kind, confidence, polygon })
    if (objects.length >= MAX_BATCH_OBJECTS) break
  }
  if (objects.length === 0) throw visionError('no_target', { stage: 'parse', detail: 'No valid objects found in batch output.' })
  return { objects, dropped }
}

/**
 * True when a normalized outline is just an axis-aligned bounding box (4 vertices,
 * two distinct x values and two distinct y values). VLMs often answer with a
 * detection box although the prompt asks for a silhouette; the workbench labels
 * those candidates as boxes instead of passing them off as instance polygons.
 */
export function polygonLooksLikeBox(polygon, tolerance = 0.004) {
  if (!Array.isArray(polygon) || polygon.length !== 4) return false
  const xs = []
  const ys = []
  for (const vertex of polygon) {
    if (!Array.isArray(vertex) || vertex.length < 2) return false
    if (!Number.isFinite(vertex[0]) || !Number.isFinite(vertex[1])) return false
    if (!xs.some((value) => Math.abs(value - vertex[0]) <= tolerance)) xs.push(vertex[0])
    if (!ys.some((value) => Math.abs(value - vertex[1]) <= tolerance)) ys.push(vertex[1])
  }
  return xs.length === 2 && ys.length === 2
}
