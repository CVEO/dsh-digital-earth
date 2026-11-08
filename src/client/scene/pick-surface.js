/**
 * scene/pick-surface.js — turn a screen position into a world point.
 *
 * Prefer Cesium's depth-buffer pick (works on 3D Tiles and 3DGS), then fall back
 * to the globe ray so the bare ellipsoid also returns a point. Kept as a module
 * so the measure/profile click loops share one implementation.
 */
export function pickSurfaceAt(viewer, position) {
  if (!viewer) return null
  if (viewer.scene.pickPositionSupported) {
    try {
      const picked = viewer.scene.pickPosition(position)
      if (picked) return picked
    } catch {
      /* fall through to the globe ray pick */
    }
  }
  const ray = viewer.camera.getPickRay(position)
  return ray ? viewer.scene.globe.pick(ray, viewer.scene) ?? null : null
}
