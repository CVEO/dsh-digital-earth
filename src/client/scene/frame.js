/**
 * scene/frame.js — camera helpers that are pure with respect to React state.
 *
 * Two small "make it feel direct" capabilities live here instead of inside
 * ViewerSurface (which is at its line budget):
 *   - one click frames ALL visible 3D Tiles layers (there was only per-layer fly);
 *   - double-clicking the globe flies to the point under the cursor.
 * Both take the Cesium namespace as an argument so the maths is unit-testable
 * with a tiny fake.
 */
import { flightDuration } from './motion.js'

/**
 * Bounding sphere that encloses every visible layer's tileset.
 *
 * Cesium already keeps `tileset.boundingSphere` up to date; here we only merge
 * them: centre = mean of the centres, radius = max(centre→layer centre + radius).
 * A null result means "nothing visible to frame".
 */
export function combinedBoundingSphere(Cesium, layers) {
  const spheres = (Array.isArray(layers) ? layers : [])
    .filter((layer) => layer && layer.visible !== false && layer.tileset && layer.tileset.boundingSphere)
    .map((layer) => layer.tileset.boundingSphere)
  if (spheres.length === 0) return null
  if (spheres.length === 1) return spheres[0]
  const sum = new Cesium.Cartesian3(0, 0, 0)
  for (const sphere of spheres) Cesium.Cartesian3.add(sum, sphere.center, sum)
  const center = Cesium.Cartesian3.divideByScalar(sum, spheres.length, new Cesium.Cartesian3())
  let radius = 0
  for (const sphere of spheres) {
    const distance = Cesium.Cartesian3.distance(center, sphere.center)
    radius = Math.max(radius, distance + sphere.radius)
  }
  return new Cesium.BoundingSphere(center, radius)
}

/** Frame every visible 3D Tiles layer, or return false when there is nothing to frame. */
export function frameAllLayers(viewer, Cesium, layers, duration) {
  if (!viewer || !Cesium) return false
  const sphere = combinedBoundingSphere(Cesium, layers)
  if (sphere === null) return false
  // A little margin so the data does not touch the viewport edges.
  const target = new Cesium.BoundingSphere(sphere.center, sphere.radius * 1.15)
  // Undefined duration → distance-adaptive, so framing a whole province does not
  // feel like a jump cut while a single block still snaps quickly.
  const travel = Number.isFinite(duration)
    ? duration
    : flightDuration(Cesium.Cartesian3.distance(viewer.camera.positionWC, target.center))
  viewer.camera.flyToBoundingSphere(target, { duration: travel })
  return true
}

/**
 * Fly to a cartographic point under the cursor while keeping the current heading,
 * pitch and altitude — this is "bring that spot to the centre", not "dive at it".
 * Returns false when the viewer or the point is unusable.
 */
export function flyToCartographic(viewer, Cesium, carto, duration = 0.8) {
  const camera = viewer?.camera
  if (!camera || !Cesium || !carto) return false
  if (!Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) return false
  const height = camera.positionCartographic.height
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height),
    orientation: { heading: camera.heading, pitch: camera.pitch, roll: 0 },
    duration,
  })
  return true
}
