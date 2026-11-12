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

export const clampSwipeRatio = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0.5
  return Math.min(0.95, Math.max(0.05, num))
}

/**
 * One reusable clipping collection per tileset.
 *
 * Cesium's `tileset.clippingPlanes` setter destroys the previous collection
 * (`ClippingPlaneCollection.setOwner` -> `destroy()`), including its clipping
 * texture. Removing the collection while tile draw commands still reference that
 * texture crashes the renderer ("Cannot read properties of undefined (_target)").
 * So a swipe session never removes it: it disables the collection instead, which
 * makes Cesium rebuild the shaders without clipping while keeping the GL objects
 * alive. The map also avoids create/destroy churn across repeated swipes.
 */
const swipeCollections = new WeakMap()

/** Write the computed plane into the collection's single plane. */
function applyPlane(collection, localized) {
  const plane = typeof collection.get === 'function' ? collection.get(0) : null
  if (!plane) return false
  if (plane.normal && typeof plane.normal === 'object') {
    plane.normal.x = localized.normal.x
    plane.normal.y = localized.normal.y
    plane.normal.z = localized.normal.z
  } else {
    plane.normal = localized.normal
  }
  plane.distance = localized.distance
  return true
}

/**
 * Compute the screen-aligned clipping plane for a 3D Tileset at normalized
 * split ratio `r ∈ [0, 1]` and localize it into the tileset's local frame.
 *
 * Kept side (> 0):
 *   - `orientation === 'vertical'`   → left of the split line (`x_ndc < 2r - 1`)
 *   - `orientation === 'horizontal'` → above the split line (`y_ndc > 1 - 2r`)
 */
export function computeSwipeClipPlane(Cesium, camera, tileset, { ratio = 0.5, orientation = 'vertical', canvas = null } = {}) {
  if (!Cesium || !camera || !tileset) return null
  const eye = camera.positionWC ?? camera.position
  const dir = camera.directionWC ?? camera.direction
  const right = camera.rightWC ?? camera.right
  const up = camera.upWC ?? camera.up
  if (!eye || !dir || !right || !up) return null

  const r = clampSwipeRatio(ratio)
  const aspect =
    Number(camera.frustum?.aspectRatio) ||
    (canvas?.clientWidth > 0 && canvas?.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1)
  const fov = Number(camera.frustum?.fov) || Math.PI / 3
  const fovy =
    Number(camera.frustum?.fovy) ||
    (aspect > 1 ? 2 * Math.atan(Math.tan(fov / 2) / aspect) : fov)
  const tanHalfY = Math.tan(fovy / 2)
  const tanHalfX = tanHalfY * aspect

  let nx = 0
  let ny = 0
  let nz = 0
  if (orientation === 'horizontal') {
    const v = 1 - 2 * r
    const k = v * tanHalfY
    nx = up.x - k * dir.x
    ny = up.y - k * dir.y
    nz = up.z - k * dir.z
  } else {
    const u = 2 * r - 1
    const k = u * tanHalfX
    nx = -right.x + k * dir.x
    ny = -right.y + k * dir.y
    nz = -right.z + k * dir.z
  }
  const len = Math.hypot(nx, ny, nz)
  if (!(len > 0)) return null
  nx /= len
  ny /= len
  nz /= len

  const normal = new Cesium.Cartesian3(nx, ny, nz)
  const distance = -(nx * eye.x + ny * eye.y + nz * eye.z)
  const plane = { normal, distance, pointOnPlane: eye, keep: orientation === 'horizontal' ? 'top' : 'left' }
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
    applyPlane(active.collection, localized)
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
        if (current.collection) current.collection.enabled = false
      } catch {
        /* collection may already be destroyed with its tileset */
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

    const cached = swipeCollections.get(layer.tileset) ?? null
    const existing = layer.tileset.clippingPlanes ?? null
    // Another owner (the clip analysis) already clips this tileset; two
    // collections cannot be composed, so refuse instead of fighting it.
    if (existing !== null && existing !== cached) {
      return { ok: false, reason: 'conflict' }
    }
    let collection = cached
    if (collection === null || collection.isDestroyed?.()) {
      collection = new Cesium.ClippingPlaneCollection({
        planes: [new Cesium.ClippingPlane(initial.normal, initial.distance)],
        enabled: true,
        edgeWidth: 1.5,
        edgeColor: Cesium.Color?.fromCssColorString?.('#38bdf8') ?? undefined,
      })
      swipeCollections.set(layer.tileset, collection)
    } else {
      applyPlane(collection, initial)
      collection.enabled = true
    }
    if (layer.tileset.clippingPlanes !== collection) {
      try {
        layer.tileset.clippingPlanes = collection
      } catch {
        return { ok: false, reason: 'unavailable' }
      }
    }
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
