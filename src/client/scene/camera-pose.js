/**
 * scene/camera-pose.js — exact reproducible camera poses for research figures.
 *
 * Unlike casual view bookmarks (which drop `roll` and `fov` and animate flights),
 * academic figure comparison needs pixel-aligned viewpoints across runs and
 * machines. This module captures, validates, serializes, and instantaneously
 * restores `{ lon, lat, height, heading, pitch, roll, fov, projection }`.
 */

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

const MIN_HEIGHT_M = -1000
const MAX_HEIGHT_M = 40_000_000
const MIN_FOV_DEG = 5
const MAX_FOV_DEG = 175

const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const cleanZero = (value) => (Object.is(value, -0) || Math.abs(value) < 1e-12 ? 0 : value)
const roundTo = (value, decimals) => {
  const factor = 10 ** decimals
  return cleanZero(Math.round(value * factor) / factor)
}

function normalizeHeading(deg) {
  const wrapped = ((deg % 360) + 360) % 360
  return roundTo(wrapped === 360 ? 0 : wrapped, 4)
}

function normalizeRoll(deg) {
  let wrapped = ((deg + 180) % 360 + 360) % 360 - 180
  if (wrapped <= -180) wrapped += 360
  return roundTo(wrapped, 4)
}

function toDegrees(Cesium, radians) {
  if (!finite(radians)) return null
  if (typeof Cesium?.Math?.toDegrees === 'function') return Cesium.Math.toDegrees(radians)
  return radians * RAD_TO_DEG
}

function toRadians(Cesium, degrees) {
  if (typeof Cesium?.Math?.toRadians === 'function') return Cesium.Math.toRadians(degrees)
  return degrees * DEG_TO_RAD
}

/**
 * Capture the exact current camera pose from a Cesium Viewer.
 * Returns null if the viewer/camera is not ready.
 */
export function captureCameraPose(viewer, Cesium) {
  const camera = viewer?.camera
  if (!camera) return null
  let carto = null
  try {
    const pos = camera.positionWC ?? camera.position
    if (pos && typeof Cesium?.Cartographic?.fromCartesian === 'function') {
      carto = Cesium.Cartographic.fromCartesian(pos)
    }
    if (!carto && camera.positionCartographic) {
      carto = camera.positionCartographic
    }
  } catch {
    return null
  }
  const lonDeg = toDegrees(Cesium, carto?.longitude)
  const latDeg = toDegrees(Cesium, carto?.latitude)
  const height = finite(carto?.height) ? carto.height : null
  if (lonDeg === null || latDeg === null || height === null) return null

  const headingDeg = toDegrees(Cesium, camera.heading ?? 0) ?? 0
  const pitchDeg = toDegrees(Cesium, camera.pitch ?? -Math.PI / 4) ?? -45
  const rollDeg = toDegrees(Cesium, camera.roll ?? 0) ?? 0

  const frustum = camera.frustum ?? {}
  const orthoWidth = finite(frustum.width) && frustum.width > 0 ? frustum.width : null
  const rawFovDeg = orthoWidth === null ? toDegrees(Cesium, frustum.fov) : null
  const fov = rawFovDeg !== null && rawFovDeg >= MIN_FOV_DEG && rawFovDeg <= MAX_FOV_DEG ? roundTo(rawFovDeg, 4) : null

  const pose = {
    version: 1,
    lon: roundTo(lonDeg, 7),
    lat: roundTo(latDeg, 7),
    height: roundTo(height, 3),
    heading: normalizeHeading(headingDeg),
    pitch: roundTo(Math.max(-90, Math.min(90, pitchDeg)), 4),
    roll: normalizeRoll(rollDeg),
    fov,
    projection: orthoWidth !== null ? 'orthographic' : 'perspective',
  }
  if (orthoWidth !== null) pose.orthoWidth = roundTo(orthoWidth, 3)
  return pose
}

/**
 * Validate and normalize a pose object.
 * Accepts direct poses `{ lon, lat, height, ... }` or envelopes `{ camera }` / `{ view }`
 * so users can paste directly from `experiment_meta.json` or scene snapshots.
 */
export function normalizeCameraPose(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const src =
    raw.camera && typeof raw.camera === 'object' && !Array.isArray(raw.camera)
      ? raw.camera
      : raw.view && typeof raw.view === 'object' && !Array.isArray(raw.view)
        ? raw.view
        : raw

  const lon = Number(src.lon)
  const lat = Number(src.lat)
  const height = Number(src.height)
  if (!finite(lon) || !finite(lat) || !finite(height)) return null
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
  if (height < MIN_HEIGHT_M || height > MAX_HEIGHT_M) return null

  const rawHeading = src.heading === undefined || src.heading === null ? 0 : Number(src.heading)
  const rawPitch = src.pitch === undefined || src.pitch === null ? -45 : Number(src.pitch)
  const rawRoll = src.roll === undefined || src.roll === null ? 0 : Number(src.roll)
  if (!finite(rawHeading) || !finite(rawPitch) || !finite(rawRoll)) return null
  if (rawPitch < -90 || rawPitch > 90) return null

  let fov = null
  if (src.fov !== undefined && src.fov !== null && src.fov !== '') {
    const parsedFov = Number(src.fov)
    if (!finite(parsedFov) || parsedFov < MIN_FOV_DEG || parsedFov > MAX_FOV_DEG) return null
    fov = roundTo(parsedFov, 4)
  }

  const isOrtho = src.projection === 'orthographic'
  let orthoWidth = null
  if (isOrtho && src.orthoWidth !== undefined && src.orthoWidth !== null) {
    const parsedWidth = Number(src.orthoWidth)
    if (!finite(parsedWidth) || parsedWidth <= 0) return null
    orthoWidth = roundTo(parsedWidth, 3)
  }

  const pose = {
    version: 1,
    lon: roundTo(lon, 7),
    lat: roundTo(lat, 7),
    height: roundTo(height, 3),
    heading: normalizeHeading(rawHeading),
    pitch: roundTo(rawPitch, 4),
    roll: normalizeRoll(rawRoll),
    fov,
    projection: isOrtho && orthoWidth !== null ? 'orthographic' : 'perspective',
  }
  if (orthoWidth !== null) pose.orthoWidth = orthoWidth
  return pose
}

/** Parse a pasted JSON string into a validated camera pose. */
export function parseCameraPoseJson(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, reason: 'empty', pose: null }
  }
  let parsed
  try {
    parsed = JSON.parse(text.trim())
  } catch {
    return { ok: false, reason: 'invalid_json', pose: null }
  }
  const pose = normalizeCameraPose(parsed)
  if (!pose) return { ok: false, reason: 'invalid_pose', pose: null }
  return { ok: true, pose }
}

/** Format a validated pose as indented reproducible JSON. */
export function serializeCameraPose(rawPose) {
  const pose = normalizeCameraPose(rawPose)
  if (!pose) return ''
  return JSON.stringify(pose, null, 2)
}

/**
 * Snap the camera instantaneously (`setView`, zero flight easing drift) to a pose.
 * Restores heading, pitch, roll, and perspective FOV (or orthographic width).
 */
export function applyCameraPoseInstant(viewer, Cesium, rawPose) {
  const pose = normalizeCameraPose(rawPose)
  if (!pose) return { ok: false, reason: 'invalid_pose', pose: null }
  if (!viewer?.camera || typeof viewer.camera.setView !== 'function' || typeof Cesium?.Cartesian3?.fromDegrees !== 'function') {
    return { ok: false, reason: 'unavailable', pose: null }
  }
  try {
    viewer.camera.cancelFlight?.()
    const frustum = viewer.camera.frustum
    if (pose.projection === 'perspective' && pose.fov !== null && frustum && 'fov' in frustum) {
      frustum.fov = toRadians(Cesium, pose.fov)
    } else if (pose.projection === 'orthographic' && finite(pose.orthoWidth) && frustum && 'width' in frustum) {
      frustum.width = pose.orthoWidth
    }
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(pose.lon, pose.lat, pose.height),
      orientation: {
        heading: toRadians(Cesium, pose.heading),
        pitch: toRadians(Cesium, pose.pitch),
        roll: toRadians(Cesium, pose.roll),
      },
    })
    viewer.scene?.requestRender?.()
    return { ok: true, pose }
  } catch {
    return { ok: false, reason: 'unavailable', pose: null }
  }
}
