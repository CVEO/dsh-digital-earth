/**
 * scene/measure-commit.js — turn a finished manual measurement into a stored
 * overlay command.
 *
 * The measuring tool used to keep its result only in local entities: leaving the
 * tool (结束 / Esc / another tool) dropped the result out of the 量测 list, so it
 * could not be flown to, hidden, removed or exported. The fix is to hand the
 * finished measurement to the same command model the Agent uses:
 *
 *   { mode, points: [[lon, lat, height], ...], draw: true, result, origin: 'user' }
 *
 * `origin: 'user'` keeps it out of every Agent sweep, but the user-facing clears
 * and the export still see it. Everything here is pure (Cesium is injected) so
 * the result numbers and the coordinate conversion are testable without a
 * viewer or a browser.
 */
import { geodesicLength, planarArea } from '../format.js'

const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits
const degrees = (radians) => (radians * 180) / Math.PI

/**
 * Result numbers for one completed measurement, using the same field names as
 * `measureAgentOverlay` so the layer row and the export keep one shape.
 * Returns null while the measurement is still incomplete.
 */
export function measureResultOf(Cesium, mode, points) {
  if (!Cesium || !Array.isArray(points)) return null
  if (mode === 'distance' && points.length >= 2) {
    const distance = geodesicLength(Cesium, points)
    return {
      mode,
      points: points.length,
      drawn: true,
      distance_m: round(distance, 1),
      distance_km: round(distance / 1000, 4),
    }
  }
  if (mode === 'area' && points.length >= 3) {
    const area = planarArea(Cesium, points)
    const perimeter = geodesicLength(Cesium, [...points, points[0]])
    return {
      mode,
      points: points.length,
      drawn: true,
      area_m2: round(area, 1),
      area_km2: round(area / 1e6, 6),
      perimeter_m: round(perimeter, 1),
    }
  }
  if (mode === 'height' && points.length === 2) {
    const left = Cesium.Cartographic.fromCartesian(points[0])
    const right = Cesium.Cartographic.fromCartesian(points[1])
    if (!left || !right) return null
    const height = right.height - left.height
    const horizontal = new Cesium.EllipsoidGeodesic(left, right).surfaceDistance
    return {
      mode,
      points: 2,
      drawn: true,
      height_m: round(height, 2),
      height_from_m: round(left.height, 2),
      height_to_m: round(right.height, 2),
      horizontal_m: round(horizontal, 1),
      slope_deg: horizontal > 0 ? round(degrees(Math.atan2(height, horizontal)), 1) : null,
    }
  }
  return null
}

/** Cartesian positions → JSON-safe `[lon, lat, height]` triples, or null. */
export function measureLonLatHeights(Cesium, points) {
  if (!Cesium || !Array.isArray(points)) return null
  const out = []
  for (const position of points) {
    const carto = position ? Cesium.Cartographic.fromCartesian(position) : null
    if (!carto) return null
    out.push([round(degrees(carto.longitude), 7), round(degrees(carto.latitude), 7), round(carto.height, 2)])
  }
  return out.length > 0 ? out : null
}

/**
 * The persisted command for a finished manual measurement, or null when it is
 * incomplete. Heights are kept because a manual measurement is a 3D gesture; the
 * snapshot restore re-projects it onto the surface like any other overlay.
 */
export function buildMeasureCommand(Cesium, { mode = null, points = [], result = null, origin = 'user' } = {}) {
  if (!result) return null
  const coords = measureLonLatHeights(Cesium, points)
  if (!coords) return null
  return { mode, points: coords, draw: true, result, origin }
}
