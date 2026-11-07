/**
 * scene/motion.js — distance-adaptive camera flights.
 *
 * A fixed 1.2 s works for a city block and feels rushed when the camera jumps
 * across a province (the toolbar's reset goes from the ground to 14,000 km). The
 * panel therefore picks the duration from the actual camera→target distance:
 * close hops stay quick, long hops get the time they need. The Agent contract is
 * untouched — `earth_scene fly` still honours an explicit `duration`.
 */

const EARTH_RADIUS_M = 6371008.8

const toRad = (degrees) => (degrees * Math.PI) / 180

/** Ground distance between two lon/lat points plus their height difference. */
export function viewDistanceM(from, to) {
  if (!from || !to) return 0
  const lat1 = Number(from.lat)
  const lon1 = Number(from.lon)
  const lat2 = Number(to.lat)
  const lon2 = Number(to.lon)
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return 0
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const ground = 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
  const dh = Number(from.height)
  const targetDh = Number(to.height)
  const vertical = Number.isFinite(dh) && Number.isFinite(targetDh) ? targetDh - dh : 0
  return Math.hypot(ground, vertical)
}

/**
 * Pick a flight duration from a distance. Three tiers keep the rhythm readable:
 * under 2 km → `min` (1.2 s), under 50 km → `mid` (1.6 s), beyond → `max` (2.4 s).
 */
export function flightDuration(distanceM, { min = 1.2, mid = 1.6, max = 2.4 } = {}) {
  const low = Number.isFinite(min) ? min : 1.2
  const middle = Number.isFinite(mid) ? Math.max(mid, low) : Math.max(1.6, low)
  const high = Number.isFinite(max) ? Math.max(max, middle) : Math.max(2.4, middle)
  if (typeof distanceM !== 'number' || !Number.isFinite(distanceM) || distanceM <= 0) return low
  if (distanceM < 2000) return low
  if (distanceM < 50000) return middle
  return high
}

/**
 * The current camera as a plain view object (the same shape bookmarks store), or
 * null when the viewer is not ready. Used to measure how far a flight will go.
 */
export function cameraView(viewer, Cesium) {
  const camera = viewer?.camera
  if (!camera || !Cesium?.Cartographic) return null
  try {
    const position = camera.positionWC ?? camera.position
    const carto = Cesium.Cartographic.fromCartesian(position)
    if (!carto) return null
    return {
      lon: Cesium.Math.toDegrees(carto.longitude),
      lat: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      heading: Cesium.Math.toDegrees(camera.heading ?? 0),
      pitch: Cesium.Math.toDegrees(camera.pitch ?? 0),
    }
  } catch {
    return null
  }
}
