/**
 * cursor.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import { formatHeight } from './format.js'
import { t } from './i18n.js'

    //#region cursor sampling --------------------------------------------------

    /** Above this camera height the depth buffer is too coarse to trust. */
    const PICK_POSITION_MAX_CAMERA_HEIGHT = 100000
    /** Steady HUD refresh cadence while the pointer moves (5–6 Hz is plenty). */
    const HUD_SAMPLE_INTERVAL_MS = 180
    /** Quiet time after the last pointer move before the one depth-buffer read. */
    const HUD_SETTLE_MS = 180

    /**
     * Sample the point under the pointer.
     *
     * The globe ray hit always has an answer (ray → ellipsoid), which keeps the
     * readout alive on the bare globe with terrain disabled; a non-flat terrain
     * provider fills in the surface elevation through `globe.getHeight`.
     * `options.pickPosition` additionally reads the depth buffer so a 3D Tiles /
     * glTF surface under the cursor reports its own elevation — that is a GPU→CPU
     * readback, so the HUD only asks for it once the pointer settles. `scene.pick`
     * is deliberately not used here: the pick was only needed to decide whether
     * depth was trustworthy, and `earth_scene pick` remains the way to identify
     * an object.
     */
    function sampleCursor(viewer, Cesium, position, options = {}) {
      const scene = viewer.scene
      const ellipsoid = scene.globe.ellipsoid
      const ray = viewer.camera.getPickRay(position)
      const interval = ray ? Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid) : undefined
      let carto = interval ? ellipsoid.cartesianToCartographic(Cesium.Ray.getPoint(ray, interval.start)) : null
      if (!carto) return null
      carto.height = 0

      let sampled = false
      const cameraHeight = viewer.camera.positionCartographic.height
      if (options.pickPosition === true && scene.pickPositionSupported && cameraHeight < PICK_POSITION_MAX_CAMERA_HEIGHT) {
        try {
          const point = scene.pickPosition(position)
          if (Cesium.defined(point)) {
            const depthCarto = Cesium.Cartographic.fromCartesian(point)
            if (depthCarto && Math.abs(depthCarto.height) < 30000) {
              carto = depthCarto
              sampled = true
            }
          }
        } catch {
          /* keep the ray hit */
        }
      }
      if (!sampled) {
        const provider = scene.globe.terrainProvider
        const flat = provider instanceof Cesium.EllipsoidTerrainProvider
        if (!flat && typeof scene.globe.getHeight === 'function') {
          const terrainHeight = scene.globe.getHeight(carto)
          if (typeof terrainHeight === 'number' && Number.isFinite(terrainHeight)) carto.height = terrainHeight
        } else {
          carto.height = 0
        }
      } else if (scene.globe.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
        // The depth buffer biases the faceted ellipsoid by up to a few
        // kilometres; report sea level instead of a fake elevation.
        if (Math.abs(carto.height) < 100) carto.height = 0
      }
      return carto
    }

    const formatCursor = (Cesium, carto) => {
      const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5)
      const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5)
      const height = Math.abs(carto.height) < 0.05 ? 0 : carto.height
      return `${lon}, ${lat} · ${t('hud.elevation', { value: formatHeight(height) })}`
    }
    //#endregion cursor sampling

export { PICK_POSITION_MAX_CAMERA_HEIGHT, HUD_SAMPLE_INTERVAL_MS, HUD_SETTLE_MS, sampleCursor, formatCursor }
