/**
 * scene/swipe.js — single-layer swipe comparison engine (Requirement B).
 *
 * Compares "with this layer" (left / top of the divider) against "without this
 * layer" (right / bottom of the divider) for either:
 *   - a 3D Tiles mesh layer via a screen-aligned ClippingPlane projected into
 *     the tileset's local clipping origin frame (`analysisLocalizeClipPlane`);
 *   - a 2D raster overlay via Cesium's native `ImageryLayer.splitDirection`
 *     (`SplitDirection.LEFT`) + `scene.splitPosition`.
 *
 * 3DGS layers (`layer.kind === '3dgs'`) do not support clipping planes in Cesium
 * and are explicitly rejected so the UI never pretends swipe works on splats.
 */
import { analysisLocalizeClipPlane } from '../analysis/math.js'
import {
  acquireClipCollection,
  CLIP_OWNER_SWIPE,
  releaseClipCollection,
  setClipPlane,
} from './clip-collections.js'

export const clampSwipeRatio = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0.5
  return Math.min(0.95, Math.max(0.05, num))
}

// Clipping collection lifetime lives in `clip-collections.js`: one collection per
// tileset shared with `earth_analyze action=clip`, disabled (never unassigned or
// destroyed) when a session ends. Assigning a new collection or `undefined`
// destroys the clipping texture a tile draw command may still reference, which
// crashes the renderer with "Cannot read properties of undefined (_target)".

const positive = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

/**
 * Orthographic frustums have no FOV, so screen fractions map to world distances:
 * prefer the frustum width, fall back to an off-center left/right span, then to a
 * height-derived width. Returns 0 for perspective frustums.
 */
const orthoFrustumWidth = (frustum, aspect) => {
  const width = positive(frustum.width)
  if (width > 0) return width
  const left = Number(frustum.left)
  const right = Number(frustum.right)
  if (Number.isFinite(left) && Number.isFinite(right) && right > left) return right - left
  const height = positive(frustum.height)
  return height > 0 ? height * aspect : 0
}
/**
 * Compute the screen-aligned clipping plane for a 3D Tileset at normalized
 * split ratio r in [0, 1] and localize it into the tileset local frame.
 *
 * Kept side (> 0):
 *   - orientation === 'vertical'   -> left of the split line (x_ndc < 2r - 1)
 *   - orientation === 'horizontal' -> above the split line (y_ndc > 1 - 2r)
 *
 * Perspective and orthographic cameras are both handled: a perspective plane tilts
 * along the view direction by tan(fov/2), while an orthographic plane stays parallel
 * to the view direction and is offset by a world distance instead.
 */
export function computeSwipeClipPlane(Cesium, camera, tileset, { ratio = 0.5, orientation = 'vertical', canvas = null } = {}) {
  if (!Cesium || !camera || !tileset) return null
  const eye = camera.positionWC ?? camera.position
  const dir = camera.directionWC ?? camera.direction
  const right = camera.rightWC ?? camera.right
  const up = camera.upWC ?? camera.up
  if (!eye || !dir || !right || !up) return null

  const r = clampSwipeRatio(ratio)
  const frustum = camera.frustum ?? {}
  const canvasAspect =
    canvas?.clientWidth > 0 && canvas?.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1
  const aspect = positive(frustum.aspectRatio) || canvasAspect || 1
  const orthoWidth = orthoFrustumWidth(frustum, aspect)
  const orthoHeight = orthoWidth > 0 ? positive(frustum.height) || orthoWidth / aspect : 0
  const perspective = orthoWidth <= 0
  const fov = positive(frustum.fov) || Math.PI / 3
  // Cesium's perspective fov is horizontal in a wide viewport and vertical in a tall
  // one, so fovy may only be derived by dividing when the aspect ratio is above one.
  const fovy = perspective
    ? positive(frustum.fovy) || (aspect > 1 ? 2 * Math.atan(Math.tan(fov / 2) / aspect) : fov)
    : 0
  const tanHalfY = perspective ? Math.tan(fovy / 2) : 0
  const tanHalfX = perspective ? tanHalfY * aspect : 0
  if (!Number.isFinite(tanHalfY) || !Number.isFinite(tanHalfX)) return null

  let nx = 0
  let ny = 0
  let nz = 0
  let px = eye.x
  let py = eye.y
  let pz = eye.z
  if (orientation === 'horizontal') {
    const v = 1 - 2 * r
    if (perspective) {
      const k = v * tanHalfY
      nx = up.x - k * dir.x
      ny = up.y - k * dir.y
      nz = up.z - k * dir.z
    } else {
      const offset = v * (orthoHeight / 2)
      nx = up.x
      ny = up.y
      nz = up.z
      px = eye.x + up.x * offset
      py = eye.y + up.y * offset
      pz = eye.z + up.z * offset
    }
  } else {
    const u = 2 * r - 1
    if (perspective) {
      const k = u * tanHalfX
      nx = -right.x + k * dir.x
      ny = -right.y + k * dir.y
      nz = -right.z + k * dir.z
    } else {
      const offset = u * (orthoWidth / 2)
      nx = -right.x
      ny = -right.y
      nz = -right.z
      px = eye.x + right.x * offset
      py = eye.y + right.y * offset
      pz = eye.z + right.z * offset
    }
  }
  const len = Math.hypot(nx, ny, nz)
  if (!(len > 0)) return null
  nx /= len
  ny /= len
  nz /= len

  const normal = new Cesium.Cartesian3(nx, ny, nz)
  const pointOnPlane = new Cesium.Cartesian3(px, py, pz)
  const distance = -(nx * px + ny * py + nz * pz)
  const plane = { normal, distance, pointOnPlane, keep: orientation === 'horizontal' ? 'top' : 'left' }
  const center = tileset.boundingSphere?.center ?? null
  return analysisLocalizeClipPlane(Cesium, plane, tileset, center)
}
export function createSwipeSession({ getCesium, getViewer, getLayers, getOverlayLayers } = {}) {
  let active = null

  function requestRender() {
    try {
      getViewer?.()?.scene?.requestRender?.()
    } catch {
      /* viewer may be tearing down */
    }
  }

  function update3dPlane() {
    if (!active || active.kind !== '3d') return
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer?.camera || !active.tileset || !active.collection) return
    const localized = computeSwipeClipPlane(Cesium, viewer.camera, active.tileset, {
      ratio: active.ratio,
      orientation: active.orientation,
      canvas: viewer.canvas ?? viewer.scene?.canvas ?? null,
    })
    if (!localized) return
    setClipPlane(active.collection, localized)
  }

  function stop() {
    if (!active) return false
    const current = active
    active = null
    const viewer = getViewer?.()
    const Cesium = getCesium?.()
    if (current.kind === '3d') {
      if (current.removePreRender) {
        try {
          current.removePreRender()
        } catch {
          /* ignore */
        }
      }
      // Never unassign the collection: Cesium's setter destroys it and its
      // texture while tile draw commands may still reference them, which stops
      // rendering with "Cannot read properties of undefined (_target)".
      // Disabling makes the tileset rebuild its shaders without clipping.
      try {
        releaseClipCollection(current.tileset, CLIP_OWNER_SWIPE)
      } catch {
        /* tileset may already be destroyed */
      }
    } else if (current.kind === 'raster') {
      if (current.imageryLayer) {
        try {
          current.imageryLayer.splitDirection = current.previousSplitDirection ?? (Cesium?.SplitDirection?.NONE ?? 0)
        } catch {
          /* ignore */
        }
      }
      if (viewer?.scene) {
        try {
          viewer.scene.splitPosition = current.previousSplitPosition ?? 0.5
        } catch {
          /* ignore */
        }
      }
    }
    requestRender()
    return true
  }

  function start3d(layerId, { ratio = 0.5, orientation = 'vertical' } = {}) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const layers = getLayers?.() ?? []
    const layer = layers.find((item) => item.id === layerId)
    if (!Cesium || !viewer || !layer || layer.visible === false || !layer.tileset) {
      return { ok: false, reason: 'unavailable' }
    }
    if (layer.kind === '3dgs') {
      return { ok: false, reason: 'unsupported_3dgs' }
    }
    if (typeof Cesium.ClippingPlaneCollection !== 'function' || typeof Cesium.ClippingPlane !== 'function') {
      return { ok: false, reason: 'unavailable' }
    }
    stop()
    const r = clampSwipeRatio(ratio)
    const orient = orientation === 'horizontal' ? 'horizontal' : 'vertical'
    let initial
    try {
      initial = computeSwipeClipPlane(Cesium, viewer.camera, layer.tileset, {
        ratio: r,
        orientation: orient,
        canvas: viewer.canvas ?? viewer.scene?.canvas ?? null,
      })
    } catch {
      // An unexpected camera/tileset shape must not crash the click handler.
      return { ok: false, reason: 'unavailable' }
    }
    if (!initial) return { ok: false, reason: 'unavailable' }

    // One shared collection per tileset, owned by whoever clips it right now.
    // A conflict means the clip analysis (or another plugin) is already
    // clipping: refuse instead of stealing or destroying its collection.
    const acquired = acquireClipCollection(Cesium, layer.tileset, {
      owner: CLIP_OWNER_SWIPE,
      planes: [{ normal: initial.normal, distance: initial.distance }],
      edgeWidth: 1.5,
      edgeColor: Cesium.Color?.fromCssColorString?.('#38bdf8') ?? undefined,
    })
    if (!acquired.ok) return { ok: false, reason: acquired.reason === 'conflict' ? 'conflict' : 'unavailable' }
    const collection = acquired.collection
    const onPreRender = () => update3dPlane()
    let removePreRender = null
    if (typeof viewer.scene?.preRender?.addEventListener === 'function') {
      removePreRender = viewer.scene.preRender.addEventListener(onPreRender)
    }
    active = {
      kind: '3d',
      id: layer.id,
      name: layer.name,
      ratio: r,
      orientation: orient,
      tileset: layer.tileset,
      collection,
      removePreRender:
        typeof removePreRender === 'function'
          ? removePreRender
          : () => viewer.scene?.preRender?.removeEventListener?.(onPreRender),
    }
    requestRender()
    return { ok: true, state: getState() }
  }

  function startRaster(overlayId, { ratio = 0.5 } = {}) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const overlayLayers = getOverlayLayers?.()
    const list = overlayLayers?.list?.() ?? []
    const meta = list.find((item) => item.id === overlayId)
    const imageryLayer = overlayLayers?.getLayer?.(overlayId) ?? null
    if (!viewer?.scene || !meta || meta.visible === false || !imageryLayer) {
      return { ok: false, reason: 'unavailable' }
    }
    stop()
    const r = clampSwipeRatio(ratio)
    const previousSplitDirection = imageryLayer.splitDirection
    const previousSplitPosition = viewer.scene.splitPosition
    imageryLayer.splitDirection = Cesium?.SplitDirection?.LEFT ?? -1
    viewer.scene.splitPosition = r
    active = {
      kind: 'raster',
      id: meta.id,
      name: meta.name,
      ratio: r,
      orientation: 'vertical',
      imageryLayer,
      previousSplitDirection,
      previousSplitPosition,
    }
    requestRender()
    return { ok: true, state: getState() }
  }

  function setRatio(nextRatio) {
    if (!active) return null
    active.ratio = clampSwipeRatio(nextRatio)
    if (active.kind === '3d') {
      update3dPlane()
    } else if (active.kind === 'raster') {
      const viewer = getViewer?.()
      if (viewer?.scene) viewer.scene.splitPosition = active.ratio
    }
    requestRender()
    return getState()
  }

  function setOrientation(nextOrientation) {
    if (!active) return null
    if (active.kind === 'raster') return getState()
    active.orientation = nextOrientation === 'horizontal' ? 'horizontal' : 'vertical'
    update3dPlane()
    requestRender()
    return getState()
  }

  function reconcile({ layers = [], overlays = [] } = {}) {
    if (!active) return false
    if (active.kind === '3d') {
      const found = layers.find((item) => item.id === active.id)
      // Only existence/visibility matter here: callers may reconcile with the
      // lightweight UI projection, which has no `tileset`. Requiring it would
      // stop the session on the first reconciliation and the overlay would
      // never appear. The session already holds the runtime tileset reference.
      if (!found || found.visible === false) {
        stop()
        return true
      }
    } else if (active.kind === 'raster') {
      const found = overlays.find((item) => item.id === active.id)
      if (!found || found.visible === false) {
        stop()
        return true
      }
    }
    return false
  }

  function getState() {
    if (!active) return null
    return {
      kind: active.kind,
      id: active.id,
      name: active.name,
      ratio: active.ratio,
      orientation: active.orientation,
    }
  }

  return {
    start3d,
    startRaster,
    setRatio,
    setOrientation,
    reconcile,
    stop,
    getState,
  }
}
