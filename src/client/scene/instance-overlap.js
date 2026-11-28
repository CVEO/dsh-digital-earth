// Compare the traced interiors. Two diagonal strips can share most of a bbox
// without sharing any ground. Integrate paired scanline intervals in the
// intersection of their bboxes; touching edges contribute zero area.
function intervals(ring, y) {
  const xs = []
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i]
    if ((y1 > y) !== (y2 > y)) xs.push(x1 + (x2 - x1) * (y - y1) / (y2 - y1))
  }
  return xs.sort((a, b) => a - b)
}

export function sameFootprint(a, b, minimumOverlap) {
  const minArea = Math.min(a.areaPx, b.areaPx)
  const maxArea = Math.max(a.areaPx, b.areaPx)
  const nearSeam = a.windowId !== b.windowId && (a.clipped || b.clipped)
  if (!nearSeam && minArea < maxArea * 0.55) return false
  const top = Math.max(a.bbox.top, b.bbox.top)
  const bottom = Math.min(a.bbox.bottom, b.bbox.bottom)
  const step = (bottom - top) / 24
  let area = 0
  for (let row = 0; row < 24; row++) {
    const y = top + (row + 0.5) * step
    const left = intervals(a.pixels, y), right = intervals(b.pixels, y)
    let i = 0, j = 0
    while (i + 1 < left.length && j + 1 < right.length) {
      area += step * Math.max(0, Math.min(left[i+1], right[j+1]) - Math.max(left[i], right[j]))
      if (left[i+1] < right[j+1]) i += 2
      else j += 2
    }
  }
  return area > minArea * (a.windowId === b.windowId ? 0.9 : minimumOverlap)
}
