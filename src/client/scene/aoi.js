/**
 * scene/aoi.js — ground-polygon AOI helpers shared by the extraction panel.
 */
const AOI_KINDS = new Set(['rectangle', 'polygon', 'lasso', 'area', 'vision'])

/** True when a viewer selection describes a ground polygon usable as an AOI. */
export function isAoiSelectionCapable(selection) {
  if (!selection || !AOI_KINDS.has(selection.kind)) return false
  const hasPositions = Array.isArray(selection.positions) && selection.positions.length >= 3
  const hasRing = Array.isArray(selection.ring) && selection.ring.length >= 3
  return hasPositions || hasRing
}

/** WGS84 bbox from a selection ring; null when the ring is unusable or crosses 180°. */
export function bboxFromSelection(selection) {
  if (!isAoiSelectionCapable(selection) || !Array.isArray(selection.ring)) return null
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const point of selection.ring) {
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue
    west = Math.min(west, point[0]); east = Math.max(east, point[0])
    south = Math.min(south, point[1]); north = Math.max(north, point[1])
  }
  if (![west, south, east, north].every(Number.isFinite)) return null
  if (east - west >= 180) return null
  return { west, south, east, north }
}
