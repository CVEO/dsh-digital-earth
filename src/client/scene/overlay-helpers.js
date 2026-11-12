/**
 * scene/overlay-helpers.js — small shared helpers for the drawn overlay layer.
 *
 * The viewer draws agent overlays, measurements and annotations with the same
 * colours and the same ground-draped labels; keeping those helpers outside the
 * component keeps ViewerSurface inside its size budget and makes the behaviour
 * reusable by the annotation tool.
 */
import { VECTOR_COLORS, vectorLabel } from './vector-style.js'

/** Cesium colour for a style preset, falling back to the accent colour. */
export function agentOverlayColor(Cesium, style) {
  const css = VECTOR_COLORS[style] ?? VECTOR_COLORS.accent
  try {
    return Cesium.Color.fromCssColorString(css)
  } catch {
    return Cesium.Color.DODGERBLUE
  }
}

/** Surface height at a lon/lat when terrain is loaded, otherwise 0. */
export function agentSurfaceHeight(Cesium, viewer, lon, lat) {
  try {
    const height = viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lon, lat))
    if (Number.isFinite(height)) return height
  } catch {
    // No terrain provider: the ellipsoid surface is height 0.
  }
  return 0
}

/** Label text for a feature: its name, else the command caption, else ''. */
export function agentLabelText(text, value) {
  return typeof text === 'string' && text !== '' ? text : typeof value === 'string' ? value : ''
}

/** Add a result label anchored on a ground point. */
export function addAgentGroundLabel(Cesium, add, lon, lat, text) {
  return add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    label: vectorLabel(Cesium, text, {
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    }),
  })
}
