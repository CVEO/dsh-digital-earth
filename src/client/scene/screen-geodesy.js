/**
 * scene/screen-geodesy.js — screen pixels ↔ ground geometry.
 *
 * The selection tools work in screen space (a drag is a screen gesture), then
 * each sampled point is unprojected through Cesium's depth buffer (3D Tiles
 * surface) or the globe ray (bare ellipsoid). Metaphor: the screen rectangle is
 * a rubber sheet pressed onto the terrain — corners alone are not enough on an
 * oblique camera, so edges are sampled too.
 *
 * Pure metric helpers (area/perimeter) live here as well so they are unit-tested
 * without a browser or GPU.
 */
import { pickSurfaceAt } from './pick-surface.js'

const EARTH_RADIUS_M = 6378137
const DEG = 180 / Math.PI

/** CSS pixel position → canvas pixel position (handles DPR / CSS scaling). */
export function canvasPosition(viewer, position, Cesium) {
  const canvas = viewer?.canvas
  if (!canvas || !Cesium || typeof Cesium.Cartesian2 !== 'function') return null
  const cssWidth = canvas.clientWidth || canvas.width
  const cssHeight = canvas.clientHeight || canvas.height
  if (!(cssWidth > 0) || !(cssHeight > 0)) return null
  const scaleX = canvas.width / cssWidth
  const scaleY = canvas.height / cssHeight
  return new Cesium.Cartesian2(Math.round(position.x * scaleX), Math.round(position.y * scaleY))
}

/**
 * One screen point → WGS84 ground point. Returns null for sky / horizon misses.
 * `source` reports which pick path produced the point (diagnostics).
 */
export function unprojectGround(viewer, Cesium, position) {
  const cartesian = pickSurfaceAt(viewer, position)
  if (!cartesian) return null
  let carto = null
  try {
    carto = Cesium.Cartographic.fromCartesian(cartesian)
  } catch {
    carto = null
  }
  if (!carto || !Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) return null
  return {
    cartesian,
    lon: carto.longitude * DEG,
    lat: carto.latitude * DEG,
    height: Number.isFinite(carto.height) ? carto.height : 0,
  }
}

/** The four screen corners of a drag, clockwise from the press point. */
export function rectScreenRing(start, end, stepsPerEdge = 6) {
  const corners = [
    { x: start.x, y: start.y },
    { x: end.x, y: start.y },
    { x: end.x, y: end.y },
    { x: start.x, y: end.y },
  ]
  const ring = []
  const steps = Math.max(1, Math.round(stepsPerEdge))
  for (let edge = 0; edge < 4; edge += 1) {
    const from = corners[edge]
    const to = corners[(edge + 1) % 4]
    for (let index = 0; index < steps; index += 1) {
      const fraction = index / steps
      ring.push({ x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction })
    }
  }
  return ring
}

/**
 * Unproject a screen ring to ground points. Misses are dropped; `complete` says
 * whether the whole ring landed on the visible surface, and `misses` counts them
 * so the UI can warn instead of pretending the selection is exact.
 */
export function groundRingFromScreen(viewer, Cesium, screenRing) {
  const points = []
  let misses = 0
  for (const screen of screenRing) {
    const pixel = canvasPosition(viewer, screen, Cesium)
    const point = pixel ? unprojectGround(viewer, Cesium, pixel) : null
    if (!point) {
      misses += 1
      continue
    }
    points.push(point)
  }
  if (points.length < 3) return { points: [], complete: false, misses, ring: [] }
  const ring = points.map((point) => [roundCoordinate(point.lon), roundCoordinate(point.lat)])
  ring.push(ring[0].slice())
  return {
    points,
    ring,
    complete: misses === 0,
    misses,
    heightRange: heightRange(points.map((point) => point.height)),
  }
}

const roundCoordinate = (value) => Math.round(value * 1e6) / 1e6

/** Min/max/mean boundary height (approximation; boundary samples only). */
export function heightRange(heights) {
  const valid = heights.filter((value) => Number.isFinite(value))
  if (valid.length === 0) return null
  let minimum = Infinity
  let maximum = -Infinity
  let sum = 0
  for (const value of valid) {
    if (value < minimum) minimum = value
    if (value > maximum) maximum = value
    sum += value
  }
  return { min: minimum, max: maximum, mean: sum / valid.length }
}

/** Geodesic perimeter (metres) of a lon/lat ring, duplicated last point allowed. */
export function polygonPerimeterMeters(ring) {
  if (!Array.isArray(ring) || ring.length < 2) return 0
  let total = 0
  for (let index = 1; index < ring.length; index += 1) {
    total += haversineMeters(ring[index - 1], ring[index])
  }
  return total
}

function haversineMeters(from, to) {
  const lat1 = (from[1] * Math.PI) / 180
  const lat2 = (to[1] * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLon = ((to[0] - from[0]) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Local-tangent-plane area (m²) of a lon/lat ring: accurate enough for a
 * business-area readout at city scale, and honest about being approximate.
 */
export function polygonAreaSquareMeters(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0
  const unique = ring.slice()
  const first = unique[0]
  const last = unique[unique.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) unique.pop()
  if (unique.length < 3) return 0
  const meanLat = unique.reduce((sum, point) => sum + point[1], 0) / unique.length
  const cosLat = Math.cos((meanLat * Math.PI) / 180)
  const scale = (Math.PI / 180) * EARTH_RADIUS_M
  let area = 0
  for (let index = 0; index < unique.length; index += 1) {
    const current = unique[index]
    const next = unique[(index + 1) % unique.length]
    const x1 = current[0] * scale * cosLat
    const y1 = current[1] * scale
    const x2 = next[0] * scale * cosLat
    const y2 = next[1] * scale
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

/** GeoJSON Polygon (closed ring) for a selection's lon/lat ring. */
export function ringToPolygon(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return null
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  return { type: 'Polygon', coordinates: [closed ? ring.slice() : [...ring, ring[0].slice()]] }
}

/**
 * Destination point on a sphere from a start lon/lat, a distance in metres and a
 * bearing in degrees clockwise from north. Used to give the skyline tool a
 * default viewing direction from the current camera heading — the user picks a
 * point, not a target coordinate.
 */
export function destinationPoint(from, distanceM, bearingDeg) {
  if (!Array.isArray(from) || !Number.isFinite(from[0]) || !Number.isFinite(from[1])) return null
  const distance = Number.isFinite(distanceM) ? Math.max(0, distanceM) : 0
  const bearing = ((Number.isFinite(bearingDeg) ? bearingDeg : 0) * Math.PI) / 180
  const lat1 = (from[1] * Math.PI) / 180
  const lon1 = (from[0] * Math.PI) / 180
  const angular = distance / EARTH_RADIUS_M
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing))
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  const normalizeLon = ((((lon2 * DEG + 180) % 360) + 360) % 360) - 180
  return [Math.round(normalizeLon * 1e6) / 1e6, Math.round((lat2 * DEG) * 1e6) / 1e6]
}

/** One screen point → ground point (null when the ray misses the surface). */
export function groundPointFromScreen(viewer, Cesium, screen) {
  const pixel = canvasPosition(viewer, screen, Cesium)
  return pixel ? unprojectGround(viewer, Cesium, pixel) : null
}

/**
 * A regular-polygon approximation of a circle around a lon/lat point. Used by the
 * identify card's "select around this point" action: an HONEST approximate AOI,
 * not a building footprint (pick data cannot supply that boundary).
 */
export function circleAroundPoint(center, radiusM, steps = 16) {
  if (!Array.isArray(center) || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return []
  const count = Math.max(8, Math.min(64, Math.round(steps)))
  const radius = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 15
  const ring = []
  for (let index = 0; index < count; index += 1) {
    ring.push(destinationPoint(center, radius, (index * 360) / count))
  }
  ring.push(ring[0].slice())
  return ring
}

/**
 * Thin a freehand lasso path: keep points at least `minSpacing` screen pixels
 * apart (plus the last point) and cap the count so picking stays bounded.
 */
export function sampleLassoPath(points, { minSpacing = 4, maxPoints = 120 } = {}) {
  const list = Array.isArray(points) ? points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)) : []
  if (list.length === 0) return []
  const spacing = Math.max(1, minSpacing)
  const kept = [list[0]]
  let last = list[0]
  for (let index = 1; index < list.length; index += 1) {
    const point = list[index]
    if (Math.hypot(point.x - last.x, point.y - last.y) >= spacing) {
      kept.push(point)
      last = point
    }
  }
  const final = list[list.length - 1]
  if (kept[kept.length - 1] !== final) kept.push(final)
  const limit = Math.max(4, Math.round(maxPoints))
  if (kept.length <= limit) return kept
  const sampled = []
  for (let index = 0; index < limit; index += 1) {
    sampled.push(kept[Math.round((index * (kept.length - 1)) / (limit - 1))])
  }
  return sampled
}


