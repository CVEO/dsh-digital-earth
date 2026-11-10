/**
 * scene/canvas-input.js — the panel's canvas input router.
 *
 * One place owns LEFT_CLICK / LEFT_DOUBLE_CLICK / RIGHT_CLICK so ViewerSurface
 * stays inside its line budget and selection/profile gestures can yield the
 * canvas cleanly. Dependencies are injected; no React state lives here.
 */
export function installCanvasInput({
  Cesium,
  viewer,
  getViewer,
  getTool,
  onCanvasClick,
  finishMeasure,
  sampleCursor,
  flyToCartographic,
  isSelectionActive,
  onCancelProfile,
}) {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction(
    (event) => {
      if (isSelectionActive?.()) return
      onCanvasClick(event.position)
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  )
  handler.setInputAction(
    (event) => {
      // A canvas-selection gesture owns the canvas while it is drawing.
      if (isSelectionActive?.()) return
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
