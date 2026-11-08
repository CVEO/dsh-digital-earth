/**
 * scene/sun-timeline.js — apply a sun time to the Cesium scene and restore it.
 *
 * Scope is deliberately small: clock + SunLight + terrain lighting + the shadow
 * map. The panel's sun slider owns the date; this module only writes/restores
 * scene state and reads the sun angles for the UI. It never draws a sun-path
 * dome and never touches the six Agent tools.
 */
import { analysisObserver, analysisSunAngles } from '../analysis/math.js'

/**
 * Night filter strength from solar altitude (degrees). 0 in daylight, ramping
 * down through twilight and capped at night so unlit photogrammetry and terrain
 * both darken without disappearing. The value is the Cesium brightness uniform.
 */
export function nightBrightness(altitude) {
  if (!Number.isFinite(altitude)) return 0
  if (altitude >= 12) return 0
  if (altitude <= -6) return -0.38
  return -0.38 * ((12 - altitude) / 18)
}

export function createSunTimeline({ getCesium, getViewer, getLayers }) {
  let saved = null

  const topLayer = () => {
    const layers = getLayers?.() ?? []
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      if (layers[index]?.visible && layers[index]?.tileset) return layers[index]
    }
    return null
  }

  const snapshot = (viewer) => ({
    enableLighting: viewer.scene?.globe?.enableLighting,
    shadowMapEnabled: viewer.scene?.shadowMap?.enabled,
    viewerShadows: viewer.shadows,
    shouldAnimate: viewer.clock?.shouldAnimate,
    currentTime: viewer.clock?.currentTime,
    light: viewer.scene?.light,
    tilesetShadows: (getLayers?.() ?? []).map((layer) => [layer, layer?.tileset?.shadows]),
    nightStage: null,
  })

  /** Create the whole-scene night filter once; it also lands in captures. */
  const ensureNightStage = (Cesium, viewer) => {
    if (saved?.nightStage) return saved.nightStage
    try {
      const stage = Cesium.PostProcessStageLibrary?.createBrightnessStage?.()
      if (!stage || !viewer.scene?.postProcessStages) return null
      stage.enabled = false
      viewer.scene.postProcessStages.add(stage)
      if (saved) saved.nightStage = stage
      return stage
    } catch {
      return null
    }
  }

  /** Apply one instant. Returns false when the viewer/Cesium is not ready. */
  function apply(date, { shadows = true } = {}) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer || !(date instanceof Date)) return false
    try {
      if (!saved) saved = snapshot(viewer)
      const julian = Cesium.JulianDate.fromDate(date)
      viewer.clock.shouldAnimate = false
      viewer.clock.currentTime = julian
      viewer.scene.light = new Cesium.SunLight()
      if (viewer.scene.globe) viewer.scene.globe.enableLighting = true
      viewer.shadows = shadows
      if (viewer.scene.shadowMap) {
        viewer.scene.shadowMap.enabled = shadows
        viewer.scene.shadowMap.softShadows = true
        viewer.scene.shadowMap.darkness = 0.35
      }
      const mode = shadows ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED
      for (const layer of getLayers?.() ?? []) {
        if (layer?.tileset) layer.tileset.shadows = mode
      }
      // Darken the whole frame, including unlit photogrammetry, so night is a
      // scene-wide tone change rather than a lighting calculation that only some
      // materials participate in.
      const stage = ensureNightStage(Cesium, viewer)
      if (stage) {
        const angles = readout(date)
        stage.uniforms.brightness = nightBrightness(angles?.altitude)
        stage.enabled = stage.uniforms.brightness < -0.01
      }
      viewer.scene.requestRender?.()
      return true
    } catch {
      return false
    }
  }

  /** Restore exactly what the scene looked like before the first apply. */
  function restore() {
    const viewer = getViewer?.()
    if (!viewer || !saved) return false
    try {
      if (saved.enableLighting !== undefined && viewer.scene.globe) viewer.scene.globe.enableLighting = saved.enableLighting
      if (saved.shadowMapEnabled !== undefined && viewer.scene.shadowMap) viewer.scene.shadowMap.enabled = saved.shadowMapEnabled
      if (saved.viewerShadows !== undefined) viewer.shadows = saved.viewerShadows
      if (saved.shouldAnimate !== undefined) viewer.clock.shouldAnimate = saved.shouldAnimate
      if (saved.currentTime) viewer.clock.currentTime = saved.currentTime
      if (saved.light) viewer.scene.light = saved.light
      for (const [layer, value] of saved.tilesetShadows) {
        if (layer?.tileset && value !== undefined) layer.tileset.shadows = value
      }
      if (saved.nightStage && viewer.scene?.postProcessStages) viewer.scene.postProcessStages.remove(saved.nightStage)
      viewer.scene.requestRender?.()
    } catch {
      /* viewer may be mid-teardown; restore is best-effort */
    }
    saved = null
    return true
  }

  /** Current sun altitude/azimuth at the dataset centre (or camera). */
  function readout(date) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer || !(date instanceof Date)) return null
    let observer = null
    try {
      observer = analysisObserver(Cesium, viewer, topLayer())
    } catch {
      return null
    }
    if (!observer) return null
    return analysisSunAngles(Cesium, date, observer)
  }

  return { apply, restore, readout }
}
