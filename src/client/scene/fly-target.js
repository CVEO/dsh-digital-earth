/**
 * scene/fly-target.js — coordinate input parsing and "fly to lon/lat" helper.
 *
 * A1 keeps the panel UI unchanged: the existing address bar accepts either a
 * tileset address/path or a coordinate triple such as `113.14,31.02,900`. This
 * module is pure/deterministic so the parsing and flight wiring are unit-testable
 * without Cesium or a real camera.
 */

const MAX_CAMERA_HEIGHT_M = 20_000_000

/**
 * Parse `lon,lat` or `lon,lat,height` (comma / whitespace separated) into a fly
 * target. Returns null for anything that is not a legal WGS84 coordinate, so the
 * caller can fall through to "load URL / local path" behaviour.
 *
 * @param {string} value
 * @returns {{lon:number, lat:number, height:number|null}|null}
 */
export function parseLonLat(value) {
  if (typeof value !== 'string') return null
  const parts = value.trim().split(/[\s,，]+/).filter(Boolean)
  if (parts.length < 2 || parts.length > 3) return null
  const numbers = parts.map((part) => Number(part))
  if (!numbers.every((number) => Number.isFinite(number))) return null
  const [lon, lat, height] = numbers
  if (lon < -180 || lon > 180) return null
  if (lat < -90 || lat > 90) return null
  if (height !== undefined && (height < 0 || height > MAX_CAMERA_HEIGHT_M)) return null
  return { lon, lat, height: height ?? null }
}

/**
 * Fly to a parsed target. The height defaults to the current camera height (so
 * "go to this place" keeps your altitude), and heading/pitch stay as they are.
 * Returns false when the viewer/Cesium/target is not usable.
 */
export function flyToCoordinates(viewer, Cesium, target, duration = 1.2) {
  const camera = viewer?.camera
  if (!camera || !Cesium || !target) return false
  if (!Number.isFinite(target.lon) || !Number.isFinite(target.lat)) return false
  const currentHeight = camera.positionCartographic?.height
  const height = Number.isFinite(target.height)
    ? target.height
    : Number.isFinite(currentHeight)
      ? currentHeight
      : 1500
  const heading = Number.isFinite(target.heading)
    ? target.heading
    : Number.isFinite(camera.heading)
      ? camera.heading
      : 0
  const pitch = Number.isFinite(target.pitch)
    ? target.pitch
    : Number.isFinite(camera.pitch)
      ? camera.pitch
      : -Math.PI / 4
  camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, height),
    orientation: { heading, pitch, roll: 0 },
    duration: Number.isFinite(duration) ? duration : 1.2,
  })
  return true
}
