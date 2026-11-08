const ranges = new WeakMap()

export const cachedElevationRange = (tileset) => tileset ? ranges.get(tileset) ?? null : null

export async function sampleElevationRange(Cesium, viewer, tileset, signal) {
  const scene = viewer?.scene
  if (!tileset || !scene?.pickPositionSupported) return null
  const heights = []
  const canvas = scene.canvas
  for (const vertical of [0.3, 0.45, 0.6, 0.75]) {
    if (signal?.aborted || viewer.isDestroyed?.() || tileset.isDestroyed?.()) return null
    for (const horizontal of [0.2, 0.4, 0.6, 0.8]) {
      const position = new Cesium.Cartesian2(canvas.clientWidth * horizontal, canvas.clientHeight * vertical)
      try {
        const picked = scene.pick(position)
        if (picked?.primitive !== tileset && picked?.tileset !== tileset) continue
        const point = scene.pickPosition(position)
        const height = point ? Cesium.Cartographic.fromCartesian(point)?.height : null
        if (Number.isFinite(height)) heights.push(height)
      } catch {}
    }
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  if (signal?.aborted || heights.length < 4) return null
  const low = Math.min(...heights)
  const high = Math.max(...heights)
  const padding = Math.max(1, (high - low) * 0.05)
  const range = { minimum: Math.floor(low - padding), maximum: Math.ceil(high + padding), count: heights.length, source: 'visible_surface' }
  ranges.set(tileset, range)
  return range
}
