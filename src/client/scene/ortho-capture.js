/**
 * scene/ortho-capture.js — nadir screenshot source for 2D instance extraction.
 *
 * The instance pipeline (scene/instance-segment.js) needs a top-down frame plus a
 * pixel → lon/lat mapping that stays valid while the model requests are in flight.
 * This module is that capture:
 *
 *   save camera + resolutionScale
 *     → optional AOI: centre the camera on the bbox and fit the height
 *     → pitch -90°, heading/roll 0, lock the viewer input
 *     → render at `resolutionScale` and copy the canvas into an offscreen buffer
 *     → expose read(rect) / lonLat(px, py)
 *     → restore() puts the camera, the resolution scale and input locks back
 *
 * Coordinates: `width`, `height` and `read(rect)` are DEVICE pixels
 * (`canvas.width`). Cesium's pick ray expects CSS pixels, so lonLat() converts
 * device → CSS first. Nothing here produces heights: the pipeline is 2D only.
 *
 * This is not a true orthophoto. A perspective camera looking straight down still
 * has parallax at the frame edges, so outlines are approximate; the AOI fit keeps
 * the target near the centre but never removes the projection difference.
 */
import { lockViewerInput } from './viewer-input-lock.js'
import { visionError } from './vision-geometry.js'

const MIN_CANVAS_EDGE = 32
const MAX_READ_EDGE = 1024
const DEFAULT_RESOLUTION_SCALE = 1.2
const JPEG_QUALITY = 0.85
const MAX_DATA_URL_CHARS = 2_000_000
const MIN_CAMERA_HEIGHT = 80
const MAX_CAMERA_HEIGHT = 6000
/** The AOI diagonal is fitted with this margin so no corner is cropped. */
const DIAGONAL_FILL = 1.08
const DEFAULT_FOV = Math.PI / 3
const EARTH_RADIUS_M = 6378137
const METERS_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_M

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const clamp = (value, low, high) => (value < low ? low : value > high ? high : value)
const toDegrees = (radians) => (radians * 180) / Math.PI

function cartographicOf(cartesian, Cesium) {
  if (!cartesian || typeof Cesium?.Cartographic?.fromCartesian !== 'function') return null
  let carto = null
  try {
    carto = Cesium.Cartographic.fromCartesian(cartesian)
  } catch {
    return null
  }
  if (!carto || !isNumber(carto.longitude) || !isNumber(carto.latitude)) return null
  return carto
}

/**
 * Ground point under one viewport position without throwing.
 *
 * Preference order matches the documented 2D path: depth buffer first (it sees
 * 3D Tiles roofs), then the globe ray (terrain or ellipsoid), then the bare
 * ellipsoid for pixels the globe misses.
 */
function groundCartographic(viewer, Cesium, position, allowDepth) {
  const scene = viewer?.scene
  if (allowDepth && scene?.pickPositionSupported === true && typeof scene.pickPosition === 'function') {
    try {
      const carto = cartographicOf(scene.pickPosition(position), Cesium)
      if (carto) return carto
    } catch {
      /* depth pick can fail on sky / unsupported devices: fall through */
    }
  }
  try {
    const ray = viewer?.camera?.getPickRay?.(position)
    if (ray && typeof scene?.globe?.pick === 'function') {
      const carto = cartographicOf(scene.globe.pick(ray, scene), Cesium)
      if (carto) return carto
    }
  } catch {
    /* one missed pixel must not fail the whole capture */
  }
  try {
    if (typeof viewer?.camera?.pickEllipsoid === 'function') {
      const hit = viewer.camera.pickEllipsoid(position, scene?.globe?.ellipsoid)
      const carto = cartographicOf(hit, Cesium)
      if (carto) return carto
    }
  } catch {
    /* no ellipsoid intersection either */
  }
  return null
}

/** Half-tangents of the viewport in Cesium's frustum convention. */
function viewHalfTangents(camera, cssWidth, cssHeight) {
  const frustum = camera?.frustum
  const fov = isNumber(frustum?.fov) && frustum.fov > 0.1 && frustum.fov < Math.PI - 0.1 ? frustum.fov : DEFAULT_FOV
  const aspect = isNumber(frustum?.aspectRatio) && frustum.aspectRatio > 0
    ? frustum.aspectRatio
    : cssHeight > 0 ? cssWidth / cssHeight : 1
  const half = fov / 2
  // Cesium applies `fov` to the wider axis: horizontal for landscape viewports,
  // vertical for portrait ones.
  if (aspect > 1) return { tanX: Math.tan(half), tanY: Math.tan(half) / aspect }
  return { tanX: Math.tan(half) * aspect, tanY: Math.tan(half) }
}

function bboxSpansMeters(bbox) {
  const meanLat = (bbox.south + bbox.north) / 2
  const widthM = (bbox.east - bbox.west) * METERS_PER_DEGREE * Math.cos((meanLat * Math.PI) / 180)
  const heightM = (bbox.north - bbox.south) * METERS_PER_DEGREE
  return { widthM, heightM }
}

/**
 * Nadir camera height that keeps an AOI bbox inside the viewport.
 *
 * A perspective camera covers `2 * height * tan(halfFov)` metres at the ground,
 * so the bbox diagonal is fitted into the narrower of the two view directions.
 * The result is clamped to 80..6000 m: an AOI too large for the clamp stays
 * cropped, which the returned framing bbox reports honestly.
 */
function fitNadirHeight(bbox, camera, cssWidth, cssHeight) {
  const { widthM, heightM } = bboxSpansMeters(bbox)
  const diagonalM = Math.hypot(widthM, heightM)
  const { tanX, tanY } = viewHalfTangents(camera, cssWidth, cssHeight)
  const halfTan = Math.max(1e-9, Math.min(tanX, tanY))
  const raw = (diagonalM * DIAGONAL_FILL) / (2 * halfTan)
  if (!isNumber(raw)) return MIN_CAMERA_HEIGHT
  return clamp(Math.round(raw), MIN_CAMERA_HEIGHT, MAX_CAMERA_HEIGHT)
}

function validateBbox(bbox) {
  if (bbox == null) return null
  if (typeof bbox !== 'object') throw visionError('invalid_request', { stage: 'ortho_capture', detail: 'bbox must be an object.' })
  const { west, south, east, north } = bbox
  if (![west, south, east, north].every(isNumber)) {
    throw visionError('invalid_request', { stage: 'ortho_capture', detail: 'bbox corners must be finite numbers.' })
  }
  if (!(west < east) || !(south < north)) {
    throw visionError('invalid_request', { stage: 'ortho_capture', detail: 'bbox must satisfy west < east and south < north.' })
  }
  if (west < -180 || east > 180 || south < -90 || north > 90) {
    throw visionError('invalid_request', { stage: 'ortho_capture', detail: 'bbox must be inside WGS84 degrees (antimeridian AOIs are not supported).' })
  }
  return { west, south, east, north }
}

function saveCameraView(camera, Cesium) {
  const position = camera.position
  let snapshot = position
  try {
    if (position && typeof position.clone === 'function') snapshot = position.clone()
    else if (Cesium?.Cartesian3?.clone) snapshot = Cesium.Cartesian3.clone(position)
  } catch {
    snapshot = position
  }
  return {
    position: snapshot ?? null,
    heading: camera.heading,
    pitch: camera.pitch,
    roll: camera.roll,
  }
}

function applyCameraView(camera, view) {
  if (!view || !view.position) return
  const orientation = { heading: view.heading, pitch: view.pitch, roll: view.roll }
  if (typeof camera.setView === 'function') {
    camera.setView({ destination: view.position, orientation })
    return
  }
  // A minimal fake camera may only expose assignable fields.
  camera.position = view.position
  if (isNumber(orientation.heading)) camera.heading = orientation.heading
  if (isNumber(orientation.pitch)) camera.pitch = orientation.pitch
  if (isNumber(orientation.roll)) camera.roll = orientation.roll
}

/** Resolve the ground centre the current (possibly oblique) camera is looking at. */
function currentNadirTarget(viewer, Cesium, canvas) {
  const cssWidth = Math.max(1, canvas.clientWidth || canvas.width)
  const cssHeight = Math.max(1, canvas.clientHeight || canvas.height)
  const carto = viewer.camera?.positionCartographic
  const fallbackAltitude = isNumber(carto?.height) ? carto.height : MIN_CAMERA_HEIGHT
  const ground = groundCartographic(viewer, Cesium, new Cesium.Cartesian2(cssWidth / 2, cssHeight / 2), true)
  if (ground) {
    return { lon: toDegrees(ground.longitude), lat: toDegrees(ground.latitude), altitude: fallbackAltitude }
  }
  // Over a horizon or a blank globe the camera cartographic is still a usable
  // centre: turning it nadir there is better than refusing the capture.
  if (isNumber(carto?.longitude) && isNumber(carto?.latitude)) {
    return { lon: toDegrees(carto.longitude), lat: toDegrees(carto.latitude), altitude: fallbackAltitude }
  }
  return null
}

/**
 * Render `frames` frames and yield between them so Cesium can resize the drawing
 * buffer (resolutionScale) and finish a frame before pixels are copied.
 */
async function settleFrames(viewer, frames = 2) {
  const schedule = typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : (callback) => setTimeout(callback, 0)
  for (let index = 0; index < frames; index += 1) {
    viewer.render()
    await new Promise((resolve) => { schedule(resolve) })
  }
}

function normalizeDeviceRect(rect, width, height) {
  if (!rect || typeof rect !== 'object') {
    throw visionError('invalid_request', { stage: 'ortho_read', detail: 'read(rect) requires pixel rect.' })
  }
  const left = Math.round(Number(rect.left))
  const top = Math.round(Number(rect.top))
  const rectWidth = Math.round(Number(rect.width))
  const rectHeight = Math.round(Number(rect.height))
  if (![left, top, rectWidth, rectHeight].every(isNumber) || rectWidth < 1 || rectHeight < 1) {
    throw visionError('invalid_request', { stage: 'ortho_read', detail: 'read(rect) requires positive integer bounds.' })
  }
  const safeLeft = clamp(left, 0, width - 1)
  const safeTop = clamp(top, 0, height - 1)
  const safeWidth = Math.min(rectWidth, width - safeLeft)
  const safeHeight = Math.min(rectHeight, height - safeTop)
  if (!(safeWidth > 0) || !(safeHeight > 0)) {
    throw visionError('invalid_request', { stage: 'ortho_read', detail: 'read(rect) lies outside the captured canvas.' })
  }
  return { left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight }
}

/**
 * Stable camera/view fingerprint taken while the ortho frame is frozen.
 *
 * Input locking stops the user from moving the camera, but a programmatic
 * `flyTo`/`zoomTo` (or a panel resize) would silently invalidate every
 * pixel→lon/lat conversion, so the pipeline re-checks this fingerprint before
 * trusting projected geometry.
 */
function cameraSignature(viewer, camera) {
  const position = camera.positionWC ?? camera.position
  return [
    viewer.canvas.width,
    viewer.canvas.height,
    viewer.canvas.clientWidth,
    viewer.canvas.clientHeight,
    viewer.resolutionScale,
    viewer.scene?.mode,
    viewer.scene?.morphTime,
    camera.heading,
    camera.pitch,
    camera.roll,
    position?.x,
    position?.y,
    position?.z,
    position?.lon,
    position?.lat,
    position?.height,
  ]
}

function sameSignature(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
  return left.every((value, index) => {
    const other = right[index]
    if (Object.is(value, other)) return true
    if (isNumber(value) && isNumber(other)) return Math.abs(value - other) <= 1e-9
    return false
  })
}

/** Framing bbox of the captured frame, from the four lonLat corners. */
function framingBbox(source) {
  const lastX = Math.max(0, source.width - 1)
  const lastY = Math.max(0, source.height - 1)
  const corners = [[0, 0], [lastX, 0], [lastX, lastY], [0, lastY]]
  const points = []
  for (const [x, y] of corners) {
    const point = source.lonLat(x, y)
    // One corner over the horizon means the framing rectangle is not a bbox:
    // report null instead of a rectangle that would silently clip valid data.
    if (!point) return null
    points.push(point)
  }
  return {
    west: Math.min(...points.map((point) => point.lon)),
    south: Math.min(...points.map((point) => point.lat)),
    east: Math.max(...points.map((point) => point.lon)),
    north: Math.max(...points.map((point) => point.lat)),
  }
}

/**
 * Capture a nadir frame and return its pixel source plus a release hook.
 *
 * @param {object} options
 * @param {object} options.viewer Cesium viewer (canvas, scene, camera, render)
 * @param {object} options.Cesium Cesium namespace
 * @param {{west:number,south:number,east:number,north:number}|null} [options.bbox]
 *   AOI to centre and fit; null keeps the current centre and height.
 * @param {number} [options.resolutionScale] device pixel multiplier, min 1
 * @returns {Promise<{
 *   source: {
 *     width: number, height: number,
 *     bbox: {west:number,south:number,east:number,north:number}|null,
 *     cameraLocked: true,
 *     isValid: () => boolean,
 *     read: (rect: {left:number,top:number,width:number,height:number}) => string,
 *     lonLat: (px:number, py:number) => ({lon:number,lat:number}|null),
 *     restore: () => void,
 *   },
 *   restore: () => void, width: number, height: number,
 *   bbox: {west:number,south:number,east:number,north:number}|null, cameraHeight: number,
 * }>}
 * @throws code `not_ready` | `invalid_request` | `too_large`
 */
export async function captureOrtho({ viewer, Cesium, bbox = null, resolutionScale = DEFAULT_RESOLUTION_SCALE, signal } = {}) {
  const scene = viewer?.scene
  const canvas = viewer?.canvas
  if (!viewer || !scene || !canvas || viewer.isDestroyed?.()) throw visionError('not_ready', { stage: 'ortho_capture' })
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') throw visionError('not_ready', { stage: 'ortho_capture' })
  if (document.visibilityState === 'hidden') throw visionError('not_ready', { stage: 'ortho_capture', detail: 'Page is hidden; pixels would be stale.' })
  if (!Cesium || typeof Cesium.Cartesian2 !== 'function' || typeof Cesium.Cartographic?.fromCartesian !== 'function') {
    throw visionError('not_ready', { stage: 'ortho_capture', detail: 'Cesium namespace is incomplete.' })
  }
  if (typeof Cesium.Cartesian3?.fromDegrees !== 'function' || typeof Cesium.Math?.toDegrees !== 'function') {
    throw visionError('not_ready', { stage: 'ortho_capture', detail: 'Cesium projection helpers are missing.' })
  }
  const camera = viewer.camera
  if (!camera || typeof viewer.render !== 'function') throw visionError('not_ready', { stage: 'ortho_capture' })
  const cssWidth = Math.max(1, canvas.clientWidth || 0)
  const cssHeight = Math.max(1, canvas.clientHeight || 0)
  if (canvas.clientWidth > 0 && canvas.clientHeight > 0 && (canvas.clientWidth < MIN_CANVAS_EDGE || canvas.clientHeight < MIN_CANVAS_EDGE)) {
    throw visionError('not_ready', { stage: 'ortho_capture', detail: 'Viewport is too small for a capture.' })
  }
  const requestedBbox = validateBbox(bbox)

  try { camera.cancelFlight?.() } catch { /* no flight in progress */ }
  const savedView = saveCameraView(camera, Cesium)
  const savedResolutionScale = viewer.resolutionScale
  const inputLock = lockViewerInput(viewer)
  let restored = false
  let offscreen = null
  let width = 0
  let height = 0
  let cameraHeight = MIN_CAMERA_HEIGHT

  const restore = () => {
    if (restored) return
    restored = true
    try {
      if (savedResolutionScale !== undefined) viewer.resolutionScale = savedResolutionScale
    } catch { /* a destroyed viewer must not mask the capture error */ }
    try { applyCameraView(camera, savedView) } catch { /* best effort */ }
    try { inputLock.restore() } catch { /* the viewer may be gone */ }
    try { viewer.scene?.requestRender?.() } catch { /* best effort */ }
  }

  try {
    const scale = isNumber(resolutionScale) && resolutionScale > 0 ? Math.max(1, resolutionScale) : DEFAULT_RESOLUTION_SCALE
    let target = null
    if (requestedBbox) {
      cameraHeight = fitNadirHeight(requestedBbox, camera, cssWidth, cssHeight)
      target = {
        lon: (requestedBbox.west + requestedBbox.east) / 2,
        lat: (requestedBbox.south + requestedBbox.north) / 2,
        altitude: cameraHeight,
      }
    } else {
      const centre = currentNadirTarget(viewer, Cesium, canvas)
      if (!centre) throw visionError('not_ready', { stage: 'ortho_capture', detail: 'Camera centre cannot be resolved on the globe.' })
      // Keep the altitude the user framed with; only the orientation changes.
      cameraHeight = isNumber(centre.altitude) && centre.altitude > 0 ? centre.altitude : MIN_CAMERA_HEIGHT
      target = { lon: centre.lon, lat: centre.lat, altitude: cameraHeight }
    }

    viewer.resolutionScale = scale
    // Setting resolutionScale flags the widget for a resize, but a headless
    // `viewer.render()` does not always run the widget's resize pass; calling it
    // explicitly makes the drawing buffer match the requested scale.
    try {
      if (typeof viewer.resize === 'function') viewer.resize()
    } catch { /* a custom viewer may not expose resize */ }
    applyCameraView(camera, {
      position: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, target.altitude),
      heading: 0,
      pitch: -Math.PI / 2,
      roll: 0,
    })
    await settleFrames(viewer, 2)
    const deadline = Date.now() + 8000
    while (scene.globe?.tilesLoaded === false) {
      if (signal?.aborted) throw visionError('cancelled')
      if (Date.now() >= deadline || document.visibilityState === 'hidden') {
        throw visionError('not_ready', { stage: 'ortho_capture', detail: 'Imagery has not finished loading.' })
      }
      await settleFrames(viewer, 1)
    }
    if (!(canvas.width >= MIN_CANVAS_EDGE) || !(canvas.height >= MIN_CANVAS_EDGE)) {
      throw visionError('not_ready', { stage: 'ortho_capture', detail: 'Drawing buffer is too small after render.' })
    }
    width = canvas.width
    height = canvas.height
    const cssScaleX = cssWidth / width
    const cssScaleY = cssHeight / height

    offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height
    const context = offscreen.getContext('2d')
    if (!context || typeof context.drawImage !== 'function') {
      throw visionError('not_ready', { stage: 'ortho_capture', detail: '2D canvas context is unavailable.' })
    }
    // Copy in the SAME synchronous task as the last render: Cesium clears the
    // drawing buffer between frames (preserveDrawingBuffer=false by default).
    const entities = viewer.entities
    const wasVisible = entities?.show === true
    try {
      if (wasVisible) entities.show = false
      viewer.render()
      context.drawImage(canvas, 0, 0)
    } finally {
      if (wasVisible) entities.show = true
    }
    const initialSignature = cameraSignature(viewer, camera)

    const source = {
      width,
      height,
      bbox: null,
      cameraLocked: true,
      /** False once restored, the camera/view moved, or the viewport resized. */
      isValid() {
        if (restored) return false
        try {
          return sameSignature(initialSignature, cameraSignature(viewer, camera))
        } catch {
          return false
        }
      },
      /**
       * Crop one device-pixel rect out of the frozen frame as a JPEG data URL.
       * The host accepts images up to 1024 px and ~1.5 MB decoded, so the rect
       * edge (MAX_READ_EDGE) and the data URL length are guarded here.
       */
      read(rect, minLongEdge = 0) {
        if (restored) {
          throw visionError('not_ready', { stage: 'ortho_read', detail: 'Capture was restored; read() is no longer valid.' })
        }
        const crop = normalizeDeviceRect(rect, width, height)
        if (crop.width > MAX_READ_EDGE || crop.height > MAX_READ_EDGE) {
          throw visionError('too_large', {
            stage: 'ortho_read',
            detail: `Crop ${crop.width}x${crop.height} exceeds the ${MAX_READ_EDGE}px instance limit.`,
          })
        }
        const panel = document.createElement('canvas')
        const scale = Math.max(1, Math.min(MAX_READ_EDGE, minLongEdge) / Math.max(crop.width, crop.height))
        panel.width = Math.max(1, Math.round(crop.width * scale))
        panel.height = Math.max(1, Math.round(crop.height * scale))
        const panelContext = panel.getContext('2d')
        if (!panelContext || typeof panelContext.drawImage !== 'function') {
          throw visionError('not_ready', { stage: 'ortho_read', detail: '2D canvas context is unavailable.' })
        }
        panelContext.drawImage(offscreen, crop.left, crop.top, crop.width, crop.height, 0, 0, panel.width, panel.height)
        let dataUrl = null
        try {
          dataUrl = panel.toDataURL('image/jpeg', JPEG_QUALITY)
        } catch {
          // A tainted (cross-origin) canvas or an exhausted browser canvas
          // budget cannot be encoded; report it instead of sending garbage.
          throw visionError('not_ready', { stage: 'ortho_read', detail: 'Canvas could not be encoded (tainted or too large).' })
        }
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg')) {
          throw visionError('not_ready', { stage: 'ortho_read', detail: 'Canvas could not encode a JPEG.' })
        }
        if (dataUrl.length > MAX_DATA_URL_CHARS) {
          throw visionError('too_large', { stage: 'ortho_read', detail: 'JPEG data URL is larger than 2 MB.' })
        }
        return dataUrl
      },
      readTurned(rect, angle) {
        const panel = document.createElement('canvas')
        panel.width = panel.height = 384
        const ctx = panel.getContext('2d')
        ctx.fillStyle = '#222'
        ctx.fillRect(0, 0, 384, 384)
        ctx.translate(192, 192)
        ctx.rotate(angle)
        ctx.drawImage(offscreen, rect.left, rect.top, rect.width, rect.height, -192, -192, 384, 384)
        return panel.toDataURL('image/jpeg', JPEG_QUALITY)
      },
      readSheet(tasks) {
        const sheet = document.createElement('canvas')
        sheet.width = sheet.height = 576
        const ctx = sheet.getContext('2d')
        ctx.fillStyle = '#222'
        ctx.fillRect(0, 0, 576, 576)
        for (const [i, task] of tasks.entries()) {
          const { left, top, width, height } = task.rect
          const x = (i % 2) * 288, y = Math.floor(i / 2) * 288
          ctx.drawImage(offscreen, left, top, width, height, x, y, 288, 288)
          ctx.fillStyle = '#182024'
          ctx.fillRect(x, y, 21, 21)
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 15px sans-serif'
          ctx.fillText(String(i + 1), x + 6, y + 16)
        }
        return sheet.toDataURL('image/jpeg', JPEG_QUALITY)
      },
      /** Device pixel → WGS84 ground point; null when the pixel has no surface. */
      lonLat(px, py) {
        if (restored || !isNumber(px) || !isNumber(py)) return null
        if (px < -1 || py < -1 || px > width + 1 || py > height + 1) return null
        const cssX = clamp(px, 0, width - 1e-6) * cssScaleX
        const cssY = clamp(py, 0, height - 1e-6) * cssScaleY
        const carto = groundCartographic(viewer, Cesium, new Cesium.Cartesian2(cssX, cssY), true)
        if (!carto) return null
        return { lon: toDegrees(carto.longitude), lat: toDegrees(carto.latitude) }
      },
      restore,
    }
    const bboxOut = framingBbox(source)
    source.bbox = bboxOut

    return { source, restore, width, height, bbox: bboxOut, cameraHeight }
  } catch (error) {
    restore()
    throw error
  }
}
