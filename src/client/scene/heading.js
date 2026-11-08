/**
 * scene/heading.js — small pure helpers for the compass.
 */
/** Camera heading (radians) → 0..360 degrees clockwise from north. */
export function headingDegrees(heading) {
  if (typeof heading !== 'number' || !Number.isFinite(heading)) return 0
  const degrees = (heading * 180) / Math.PI
  return ((degrees % 360) + 360) % 360
}
