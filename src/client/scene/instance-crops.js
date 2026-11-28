// Convert normalized detector boxes to context crops in the frozen frame.
// The proposal is only a camera window. It never becomes a feature.
// With a broad catalog a detector can return one extent for an entire row of
// roofs or put a road and its surroundings in a single box. Give footprints and
// road surfaces their own localization pass. Small catalogs use one request.
export function classWindows(windows, classes, separateClasses = false) {
  if (separateClasses && classes.length > 1) return windows.flatMap(w => classes.map(c => ({
    ...w, id: w.id + '/class' + c.id, classIds: [c.id],
  })))
  if (classes.length <= 4) return windows
  const groups = [
    classes.filter(c => c.key === 'building'),
    classes.filter(c => c.key === 'road'),
    classes.filter(c => c.key !== 'building' && c.key !== 'road'),
  ].filter(group => group.length)
  if (groups.length === 1) return windows
  return windows.flatMap(window => groups.map((group, i) => ({
    ...window, id: window.id + '/c' + (i+1), classIds: group.map(c => c.id),
  })))
}

export function traceWindows(boxes, window, width, height, classes) {
  const tasks = []
  for (const [i, item] of boxes.entries()) {
    const cls = classes.get(String(item.classId)), b = item.box
    if (!cls || !Array.isArray(b) || b.length !== 4 || !b.every(n => Number.isFinite(n) && n >= 0 && n <= 1000)) continue
    const {rect,core} = window
    const x = rect.left + rect.width * (b[0]+b[2]) / 2000
    const y = rect.top + rect.height * (b[1]+b[3]) / 2000
    const w = rect.width * (b[2]-b[0]) / 1000
    const h = rect.height * (b[3]-b[1]) / 1000
    if (w < 2 || h < 2 || x < core.left || x >= core.left+core.width || y < core.top || y >= core.top+core.height) continue
    const dx = Math.min(511, Math.max(5, w*0.78)), dy = Math.min(511, Math.max(5, h*0.78))
    const left = Math.max(0, Math.floor(x-dx)), top = Math.max(0, Math.floor(y-dy))
    const right = Math.min(width, Math.ceil(x+dx)), bottom = Math.min(height, Math.ceil(y+dy))
    const targetRect = {left, top, width:right-left, height:bottom-top}
    tasks.push({id:`${window.id}/o${i+1}`, depth:window.depth, rect:targetRect, core,
      mode:'trace', classId:item.classId, proposal:{left:x-w/2,top:y-h/2,width:w,height:h}})
  }
  // Detectors often list a whole class before the next one. A short budget
  // should still sample each detected class.
  const byClass = new Map()
  for (const task of tasks) {
    if (!byClass.has(task.classId)) byClass.set(task.classId, [])
    byClass.get(task.classId).push(task)
  }
  const ordered = []
  for (let i = 0; ordered.length < tasks.length; i++) {
    for (const group of byClass.values()) if (group[i]) ordered.push(group[i])
  }
  return ordered
}

export const TRACE_ANGLE = Math.PI / 7

// Map a rotated square probe back to 0..1000 in the original crop. Corners
// outside the photographed region are padding and cannot define an outline.
export function unrotateOutline(points) {
  const cos = Math.cos(TRACE_ANGLE), sin = Math.sin(TRACE_ANGLE)
  const ring = []
  for (const [x, y] of points) {
    const px = 500 + (x-500)*cos + (y-500)*sin
    const py = 500 - (x-500)*sin + (y-500)*cos
    if (px < -8 || px > 1008 || py < -8 || py > 1008) return null
    ring.push([px,py].map(n => Math.round(Math.max(0, Math.min(1000,n)))))
  }
  return ring
}

export function agreesWithProposal(candidate, window) {
  const a = candidate.bbox, b = window.proposal
  // A tight proposal was deliberately padded. A ring filling that padded
  // canvas is an image-frame echo, even if the detector predicted a real object.
  if (candidate.areaPx >= window.rect.width * window.rect.height * 0.94) return false
  const overlap = Math.max(0, Math.min(a.right,b.left+b.width)-Math.max(a.left,b.left)) *
    Math.max(0, Math.min(a.bottom,b.top+b.height)-Math.max(a.top,b.top))
  const union = a.width*a.height + b.width*b.height - overlap
  return union > 0 && overlap/union >= 0.28
}
