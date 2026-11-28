/**
 * scene/ring-area.js — horizontal footprint area (m²) from a lon/lat ring.
 * Local-plane approximation on a mean-radius sphere; shared by the instance
 * segmentation output and any 2D review UI.
 */
const EARTH_RADIUS_M = 6371008.8

export function ringAreaSquareMeters(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0
  const open = ring.slice()
  const first = open[0]
  const last = open[open.length - 1]
  if (Array.isArray(first) && Array.isArray(last) && first[0] === last[0] && first[1] === last[1]) open.pop()
  if (open.length < 3) return 0
  const meanLat = open.reduce((sum, point) => sum + point[1], 0) / open.length
  const cosLat = Math.cos((meanLat * Math.PI) / 180)
  const scale = (Math.PI / 180) * EARTH_RADIUS_M
  let area = 0
  for (let index = 0; index < open.length; index += 1) {
    const current = open[index]
    const next = open[(index + 1) % open.length]
    const x1 = (current[0] - first[0]) * scale * cosLat
    const y1 = (current[1] - first[1]) * scale
    const x2 = (next[0] - first[0]) * scale * cosLat
    const y2 = (next[1] - first[1]) * scale
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}
