/**
 * scene/sun-timeline.js — apply a sun time to the Cesium scene and restore it.
 *
 * Scope is deliberately small: clock + SunLight + terrain lighting + the shadow
 * map + the sky/sun visibility + the whole-frame night tone. The panel's sun
 * slider owns the date; this module only writes/restores scene state and reads
 * the sun angles for the UI. It never draws a sun-path dome and never touches
 * the six Agent tools.
 *
 * Two rules drive the scene work:
 *   1. Enabling the timeline must SHOW the sky and the sun. The panel's theme
 *      effect turns `skyAtmosphere.show` off in the light scheme, which leaves
 *      no sky and no sun disc — so apply() saves every sky switch it touches and
 *      turns them on; restore() puts the exact previous values back.
 *   2. Night must not be a black screen. Cesium's brightness stage mixes toward
 *      black, so the whole-frame factor is floored at SUN_NIGHT_MIN_BRIGHTNESS
 *      and the readout carries a `night` flag so the UI can explain the darker
 *      frame instead of hiding it.
 *
 * Time semantics are explicit: callers pass a `Date` built from BROWSER LOCAL
 * wall-clock fields (see sunLocalDate), and readout() reports the resolved IANA
 * zone plus the UTC offset of that instant. The sun position is computed from
 * the absolute instant, so a French dataset gets the sun position that belongs
 * to that local time.
 */
import { analysisObserver, analysisSunAngles } from '../analysis/math.js'

/** Brightness factor at deep night. Cesium's brightness stage is
 * `mix(black, color, brightness)` (see vendor/cesium: czm_brightness stage), so
 * a NEGATIVE value renders pure black — the original "-0.38" was literally the
 * black screen. 0.5 dims every material (including unlit photogrammetry) to half
 * without hiding it; 1.0 is untouched daylight. */
export const SUN_NIGHT_MIN_BRIGHTNESS = 0.5

const pad2 = (value) => String(value).padStart(2, '0')

/**
 * Local-clock date built from a `YYYY-MM-DD` input and minutes after midnight.
 * The fields go straight into the `Date` constructor, which is local time by
 * definition — never UTC — matching the slider's semantics.
 */
export function sunLocalDate(day, minutes) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ''))
  const fallback = new Date()
  const year = match ? Number(match[1]) : fallback.getFullYear()
  const month = match ? Number(match[2]) : fallback.getMonth() + 1
  const date = match ? Number(match[3]) : fallback.getDate()
  const total = Number.isFinite(Number(minutes)) ? Math.max(0, Math.min(1439, Math.round(Number(minutes)))) : 0
  return new Date(year, month - 1, date, Math.floor(total / 60), total % 60, 0, 0)
}

/** Today's date as the `YYYY-MM-DD` value a `<input type="date">` expects (local). */
export function sunTodayInput() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** `HH:MM` label for minutes after local midnight. */
export function sunClockLabel(minutes) {
  const total = Number.isFinite(Number(minutes)) ? Math.max(0, Math.min(1439, Math.round(Number(minutes)))) : 0
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}

/**
 * UTC offset of one local instant, e.g. `+08:00` / `-04:00`.
 * `getTimezoneOffset()` is UTC-minus-local, so the sign is inverted for the
 * `UTC±HH:MM` convention the UI displays.
 */
export function utcOffsetLabel(date) {
  const at = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const minutes = -at.getTimezoneOffset()
  const sign = minutes < 0 ? '-' : '+'
  const absolute = Math.abs(minutes)
  return `${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`
}

/** Browser-local time-zone id plus the UTC offset of that instant. */
export function sunTimezone(date) {
  const at = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  let timezone = 'UTC'
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    /* keep the UTC label */
  }
  return { timezone, utcOffset: utcOffsetLabel(at) }
}

/**
 * Mean-solar UTC offset for a longitude: the sun crosses one degree of longitude
 * in 4 minutes, so a scene at 3.17°E runs about 13 minutes ahead of UTC. This is
 * what "地方时（按画面经度）" means in the timeline: not a civil zone with DST,
 * but the local solar clock of the data the user is looking at, which is what
 * makes a demo in France feel right without guessing a political time zone.
 */
export function sunDataOffsetMinutes(longitude) {
  if (!Number.isFinite(longitude)) return null
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180
  return Math.round(normalized * 4)
}

/** `UTC±HH:MM` label for a UTC offset expressed in minutes. */
export function utcOffsetLabelFromMinutes(minutes) {
  const total = Number.isFinite(Number(minutes)) ? Math.round(Number(minutes)) : 0
  const sign = total < 0 ? '-' : '+'
  const absolute = Math.abs(total)
  return `${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`
}

/**
 * Absolute instant for a wall-clock time interpreted in a fixed-offset zone.
 * `sunLocalDate` builds the browser-local fields (the wall clock the user reads);
 * this helper re-anchors those fields at the selected offset so the resulting
 * Date is the true UTC instant the slider means.
 */
export function sunDateAtOffset(day, minutes, offsetMinutes) {
  const wall = sunLocalDate(day, minutes)
  const wallUtc = Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate(), wall.getHours(), wall.getMinutes(), 0, 0)
  const offset = Number.isFinite(Number(offsetMinutes)) ? Math.round(Number(offsetMinutes)) : 0
  return new Date(wallUtc - offset * 60000)
}

/**
 * Night brightness factor from solar altitude (degrees). 1 in daylight, ramping
 * down through twilight and floored at SUN_NIGHT_MIN_BRIGHTNESS so unlit
 * photogrammetry and terrain both darken without disappearing. The value is the
 * Cesium brightness-stage factor (mix towards black).
 */
export function nightBrightness(altitude) {
  if (!Number.isFinite(altitude)) return 1
  if (altitude >= 12) return 1
  if (altitude <= -6) return SUN_NIGHT_MIN_BRIGHTNESS
  return 1 - (1 - SUN_NIGHT_MIN_BRIGHTNESS) * ((12 - altitude) / 18)
}

export function createSunTimeline({ getCesium, getViewer, getLayers }) {
  let saved = null
  let lastError = null

  const topLayer = () => {
    const layers = getLayers?.() ?? []
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      if (layers[index]?.visible && layers[index]?.tileset) return layers[index]
    }
    return null
  }

  // Only existing values are recorded (`undefined` stays `undefined`), so
  // restore() never invents a scene object that was absent before enable.
  const snapshot = (viewer) => ({
    enableLighting: viewer.scene?.globe?.enableLighting,
    shadowMapEnabled: viewer.scene?.shadowMap?.enabled,
    shadowMapSoftShadows: viewer.scene?.shadowMap?.softShadows,
    shadowMapDarkness: viewer.scene?.shadowMap?.darkness,
    viewerShadows: viewer.shadows,
    shouldAnimate: viewer.clock?.shouldAnimate,
    currentTime: viewer.clock?.currentTime,
    light: viewer.scene?.light,
    backgroundColor: viewer.scene?.backgroundColor,
    skyAtmosphereShow: viewer.scene?.skyAtmosphere ? viewer.scene.skyAtmosphere.show : undefined,
    skyBoxShow: viewer.scene?.skyBox ? viewer.scene.skyBox.show : undefined,
    sunShow: viewer.scene?.sun ? viewer.scene.sun.show : undefined,
    groundAtmosphere: viewer.scene?.globe ? viewer.scene.globe.showGroundAtmosphere : undefined,
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

  /**
   * Make the sky and the sun visible again. The light theme effect in
   * ViewerSurface turns these off; the timeline needs them on so the user can
   * see a sky and a sun disc at all. A background-colour fallback covers a
   * context that has neither atmosphere nor sky box.
   */
  const showSky = (Cesium, scene) => {
    // Only touch switches that exist on this scene object; restore() reverses
    // exactly the ones present in the snapshot.
    if (scene.skyAtmosphere?.show !== undefined) scene.skyAtmosphere.show = true
    if (scene.atmosphere?.show !== undefined) scene.atmosphere.show = true
    if (scene.sun?.show !== undefined) scene.sun.show = true
    if (scene.skyBox?.show !== undefined) scene.skyBox.show = true
    if (scene.globe?.showGroundAtmosphere !== undefined) scene.globe.showGroundAtmosphere = true
    if (!scene.skyAtmosphere && !scene.skyBox) {
      try {
        if (typeof Cesium.Color?.fromCssColorString === 'function') {
          scene.backgroundColor = Cesium.Color.fromCssColorString('#0b1a2b')
        }
      } catch {
        /* background colour is optional */
      }
    }
  }

  /** Apply one instant. Returns false when the viewer/Cesium is not ready. */
  function apply(date, { shadows = true } = {}) {
    lastError = null
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer) {
      lastError = 'viewer / Cesium is not ready'
      return false
    }
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      lastError = 'invalid date: expected a browser-local Date'
      return false
    }
    try {
      if (!saved) saved = snapshot(viewer)
      const scene = viewer.scene ?? {}
      const julian = Cesium.JulianDate.fromDate(date)
      viewer.clock.shouldAnimate = false
      viewer.clock.currentTime = julian
      scene.light = new Cesium.SunLight()
      if (scene.globe) scene.globe.enableLighting = true
      showSky(Cesium, scene)
      viewer.shadows = shadows
      if (scene.shadowMap) {
        scene.shadowMap.enabled = shadows
        scene.shadowMap.softShadows = true
        scene.shadowMap.darkness = 0.35
      }
      const mode = shadows ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED
      for (const layer of getLayers?.() ?? []) {
        if (layer?.tileset) layer.tileset.shadows = mode
      }
      // Darken the whole frame, including unlit photogrammetry, so night is a
      // scene-wide tone change rather than a lighting calculation that only some
      // materials participate in. The stage factor is mix(black, color, b):
      // b=1 means untouched, b=0 would be black, so the floor stays above zero.
      const stage = ensureNightStage(Cesium, viewer)
      if (stage) {
        const angles = readout(date)
        const brightness = nightBrightness(angles?.altitude)
        if (stage.uniforms) stage.uniforms.brightness = brightness
        stage.enabled = brightness < 0.999
      }
      scene.requestRender?.()
      return true
    } catch (error) {
      lastError = error?.message || String(error)
      return false
    }
  }

  /** Restore exactly what the scene looked like before the first apply. */
  function restore() {
    const viewer = getViewer?.()
    if (!saved) return false
    // Clear the snapshot first so a throw during restore cannot leave stale
    // state that a second restore would replay.
    const previous = saved
    saved = null
    if (!viewer) return false
    try {
      const scene = viewer.scene ?? {}
      if (previous.enableLighting !== undefined && scene.globe) scene.globe.enableLighting = previous.enableLighting
      if (previous.shadowMapEnabled !== undefined && scene.shadowMap) scene.shadowMap.enabled = previous.shadowMapEnabled
      if (previous.shadowMapSoftShadows !== undefined && scene.shadowMap) scene.shadowMap.softShadows = previous.shadowMapSoftShadows
      if (previous.shadowMapDarkness !== undefined && scene.shadowMap) scene.shadowMap.darkness = previous.shadowMapDarkness
      if (previous.viewerShadows !== undefined) viewer.shadows = previous.viewerShadows
      if (previous.shouldAnimate !== undefined) viewer.clock.shouldAnimate = previous.shouldAnimate
      if (previous.currentTime) viewer.clock.currentTime = previous.currentTime
      if (previous.light !== undefined) scene.light = previous.light
      if (previous.backgroundColor !== undefined) scene.backgroundColor = previous.backgroundColor
      if (previous.skyAtmosphereShow !== undefined && scene.skyAtmosphere) scene.skyAtmosphere.show = previous.skyAtmosphereShow
      if (previous.skyBoxShow !== undefined && scene.skyBox) scene.skyBox.show = previous.skyBoxShow
      if (previous.sunShow !== undefined && scene.sun) scene.sun.show = previous.sunShow
      if (previous.groundAtmosphere !== undefined && scene.globe) scene.globe.showGroundAtmosphere = previous.groundAtmosphere
      for (const [layer, value] of previous.tilesetShadows) {
        if (layer?.tileset && value !== undefined) layer.tileset.shadows = value
      }
      if (previous.nightStage && scene.postProcessStages) scene.postProcessStages.remove(previous.nightStage)
      scene.requestRender?.()
    } catch {
      /* viewer may be mid-teardown; restore is best-effort */
    }
    return true
  }

  /** Reason the last apply() returned false (diagnostic for the UI). */
  function getError() {
    return lastError
  }

  /** Current sun altitude/azimuth at the dataset centre (or camera). */
  function readout(date) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer || !(date instanceof Date) || Number.isNaN(date.getTime())) return null
    let observer = null
    try {
      observer = analysisObserver(Cesium, viewer, topLayer())
    } catch {
      return null
    }
    if (!observer) return null
    const angles = analysisSunAngles(Cesium, date, observer)
    if (!angles) return null
    const meta = sunTimezone(date)
    return {
      altitude: angles.altitude,
      azimuth: angles.azimuth,
      // Below the horizon counts as night; the UI explains the darker frame.
      night: angles.altitude < 0,
      timezone: meta.timezone,
      utcOffset: meta.utcOffset,
    }
  }

  /**
   * Longitude of the current scene reference (top visible layer centre, else the
   * camera). The timeline uses it to derive the data-local mean solar offset; null
   * when the viewer is not ready so the UI can fall back to browser local time.
   */
  function sceneLongitude() {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer) return null
    try {
      const observer = analysisObserver(Cesium, viewer, topLayer())
      if (!observer || !Number.isFinite(observer.longitude)) return null
      return Cesium.Math.toDegrees(observer.longitude)
    } catch {
      return null
    }
  }

  return { apply, restore, readout, getError, sceneLongitude }
}
