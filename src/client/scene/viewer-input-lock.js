/**
 * scene/viewer-input-lock.js — lock camera input while a capture/segmentation
 * run is reading pixels, with nesting so overlapping frames cannot unlock early.
 */
const cameraFlags = ['enableInputs', 'enableRotate', 'enableTranslate', 'enableZoom', 'enableTilt', 'enableLook']

// Capturing a frame must not move the camera while a model request is in flight.
// Save the six controller flags once per controller and restore them when the
// LAST holder releases: an assist retry (or a caller that already locked the
// view) must not unlock input under the feet of a capture still reading pixels.
const viewerInputLocks = new WeakMap()

export function lockViewerInput(viewer) {
  const control = viewer?.scene?.screenSpaceCameraController
  if (!control || typeof control !== 'object') return { restore() {} }
  let lock = viewerInputLocks.get(control)
  if (!lock) {
    lock = { count: 0, saved: {} }
    viewerInputLocks.set(control, lock)
  }
  if (lock.count === 0) {
    lock.saved = Object.fromEntries(
      cameraFlags.filter((key) => typeof control[key] === 'boolean').map((key) => [key, control[key]]),
    )
    for (const key of Object.keys(lock.saved)) {
      try { control[key] = false } catch { /* a stubbed controller must not block capture */ }
    }
  }
  lock.count += 1
  let restored = false
  return {
    restore() {
      if (restored) return
      restored = true
      lock.count = Math.max(0, lock.count - 1)
      if (lock.count > 0) return
      viewerInputLocks.delete(control)
      if (viewer?.isDestroyed?.()) return
      for (const [key, value] of Object.entries(lock.saved)) {
        try { control[key] = value } catch { /* best effort */ }
      }
      try { viewer.scene?.requestRender?.() } catch { /* best effort */ }
    },
  }
}
