/**
 * scene/canvas-input.js — the panel's canvas input router.
 *
 * One place owns LEFT_CLICK / LEFT_DOUBLE_CLICK / RIGHT_CLICK so ViewerSurface
 * stays inside its line budget and selection/profile gestures can yield the
 * canvas cleanly. Dependencies are injected; no React state lives here.
 */
import { createPointerIntent, watchPointerCancellation } from './pointer-intent.js'

export function installCanvasInput({
  Cesium,
  viewer,
  getViewer,
  getTool,
  onCanvasClick,
  onPointerMove,
  finishMeasure,
  sampleCursor,
  flyToCartographic,
  isSelectionActive,
  onCancelProfile,
}) {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  const intent = createPointerIntent(isSelectionActive)
  handler.setInputAction((event) => intent.down(event.position), Cesium.ScreenSpaceEventType.LEFT_DOWN)
  handler.setInputAction((event) => {
    intent.move(event.endPosition)
    if (!isSelectionActive?.()) onPointerMove?.(event.endPosition)
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  const unwatch = watchPointerCancellation(viewer.scene.canvas, intent)
  const destroy = handler.destroy.bind(handler)
  handler.destroy = () => { unwatch(); return destroy() }
  handler.setInputAction(
    (event) => {
      if (isSelectionActive?.() || !intent.allowsClick()) return
      onCanvasClick(event.position)
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  )
  handler.setInputAction(
    (event) => {
      // A canvas-selection gesture owns the canvas while it is drawing.
      if (isSelectionActive?.() || !intent.allowsClick()) return
      // A double click finishes a measurement when a measure tool is active; in
      // 指认 mode it still centres the point under the cursor.
      if (getTool?.() && getTool() !== 'identify') {
        finishMeasure()
        return
      }
      const viewerNow = getViewer?.()
      if (!viewerNow?.scene) return
      const carto = sampleCursor(viewerNow, Cesium, event.position, { pickPosition: true })
      if (carto) flyToCartographic(viewerNow, Cesium, carto)
    },
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  )
  handler.setInputAction(
    () => {
      if (getTool?.() === 'profile') onCancelProfile?.()
    },
    Cesium.ScreenSpaceEventType.RIGHT_CLICK,
  )
  return handler
}
