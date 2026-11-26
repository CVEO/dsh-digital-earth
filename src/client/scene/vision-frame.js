import { validateVisionPolygon, visionError } from './vision-geometry.js'
import { heightRange } from './screen-geodesy.js'

const cameraFlags = ['enableInputs', 'enableRotate', 'enableTranslate', 'enableZoom', 'enableTilt', 'enableLook']

function isSceneStillLoading(scene, getLayers) {
  const visibleLayers = (typeof getLayers === 'function' ? getLayers() : []).filter((layer) => layer?.visible !== false && layer?.tileset)
  if (visibleLayers.length > 0) {
    return visibleLayers.some((layer) => {
      if (layer.tileset.tilesLoaded !== false) return false
      const stats = layer.tileset.statistics
      if (!stats) return true
      return !(Number(stats.numberOfTilesWithContentReady ?? stats.numberOfTilesLoaded ?? 0) > 0 || Number(stats.numberOfTrianglesSelected ?? 0) > 0)
    })
  }
  if (scene?.globe?.tilesLoaded !== false) return false
  const renderedGlobeTiles = scene.globe?._surface?._tilesToRender?.length
  return !(typeof renderedGlobeTiles === 'number' && renderedGlobeTiles > 0)
}

export function captureVisionFrame({ viewer, Cesium, anchor, getLayers = () => [], getViewer = () => viewer }) {
  if (!viewer?.scene || !anchor || viewer.isDestroyed?.()) throw visionError('not_ready')
  const canvas = viewer.canvas, scene = viewer.scene
  if (typeof document === 'undefined' || !canvas?.clientWidth || !canvas?.clientHeight || document.visibilityState === 'hidden') throw visionError('not_ready')
  if (isSceneStillLoading(scene, getLayers)) throw visionError('scene_loading')
  viewer.camera.cancelFlight?.()
  const position = Cesium.SceneTransforms.worldToWindowCoordinates(scene, anchor)
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw visionError('not_ready')
  // Send a magnified crop around the target instead of the whole viewport: a
  // building occupies a tiny fraction of a 1024px full screenshot, and vision
  // models return visibly coarser silhouettes the smaller the target is.
  const cssWidth = canvas.clientWidth, cssHeight = canvas.clientHeight
  const side = Math.max(192, Math.min(768, Math.round(Math.min(cssWidth, cssHeight) * 0.45)))
  const crop = {
    left: Math.max(0, Math.min(cssWidth - side, position.x - side / 2)),
    top: Math.max(0, Math.min(cssHeight - side, position.y - side / 2)),
    width: Math.min(side, cssWidth),
    height: Math.min(side, cssHeight),
  }
  const point = [(position.x - crop.left) / crop.width, (position.y - crop.top) / crop.height]
  if (!point.every((number) => Number.isFinite(number) && number >= 0 && number <= 1)) throw visionError('not_ready')
  const control = scene.screenSpaceCameraController
  const saved = Object.fromEntries(cameraFlags.filter((key) => typeof control?.[key] === 'boolean').map((key) => [key, control[key]]))
  const cleanups = []
  let released = false
  const sameValue = (a, b) => {
    if (Object.is(a, b)) return true
    if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
      return Math.abs(a - b) <= 1e-5
    }
    return false
  }
  const signature = () => {
    return [
      getViewer(),
      canvas.width,
      canvas.height,
      canvas.clientWidth,
      canvas.clientHeight,
      scene.mode,
      scene.morphTime,
      viewer.terrainProvider,
      ...['fov', 'aspectRatio', 'near', 'far', 'width', 'left', 'right', 'top', 'bottom', 'xOffset', 'yOffset'].map((key) => viewer.camera.frustum?.[key]),
      ...Array.from(viewer.camera.viewMatrix ?? []),
      ...getLayers().flatMap((layer) => [layer.id, layer.visible, layer.tileset, layer.tileset?.show, ...Array.from(layer.tileset?.modelMatrix ?? [])]),
      ...Object.values(scene.globe?.show === undefined ? {} : { show: scene.globe.show, depth: scene.globe.depthTestAgainstTerrain }),
    ]
  }
  const release = () => {
    if (released) return
    released = true
    for (const cleanup of cleanups) { try { cleanup() } catch {} }
    if (!viewer.isDestroyed?.() && control) {
      for (const [key, value] of Object.entries(saved)) { try { control[key] = value } catch {} }
      try { scene.requestRender?.() } catch {}
    }
  }
  try {
    for (const key of Object.keys(saved)) control[key] = false
    viewer.render()
    if (canvas.width < 32 || canvas.height < 32) throw visionError('not_ready')
    if (isSceneStillLoading(scene, getLayers)) throw visionError('scene_loading')
    const scaleX = canvas.width / cssWidth, scaleY = canvas.height / cssHeight
    const sourceWidth = Math.max(1, Math.round(crop.width * scaleX))
    const sourceHeight = Math.max(1, Math.round(crop.height * scaleY))
    const scale = Math.min(1, 1024 / Math.max(sourceWidth, sourceHeight))
    const image = document.createElement('canvas')
    image.width = Math.max(32, Math.round(sourceWidth * scale))
    image.height = Math.max(32, Math.round(sourceHeight * scale))
    const context = image.getContext('2d')
    if (!context) throw visionError('not_ready')
    context.drawImage(
      canvas,
      Math.round(crop.left * scaleX), Math.round(crop.top * scaleY), sourceWidth, sourceHeight,
      0, 0, image.width, image.height,
    )
    // A tiny crosshair gives the vision model an unambiguous anchor for "the
    // object under the click"; it does not alter the surrounding pixels.
    if (typeof context.beginPath === 'function') {
      const cx = point[0] * image.width, cy = point[1] * image.height
      const arm = Math.max(5, Math.round(image.width * 0.012))
      context.beginPath()
      context.moveTo(cx - arm, cy)
      context.lineTo(cx + arm, cy)
      context.moveTo(cx, cy - arm)
      context.lineTo(cx, cy + arm)
      context.strokeStyle = 'rgba(255,45,85,.95)'
      context.lineWidth = Math.max(2, Math.round(image.width * 0.004))
      context.stroke()
    }
    const dataUrl = image.toDataURL('image/jpeg', 0.85)
    if (dataUrl.length > 2_000_000) throw visionError('too_large')
    const initial = signature()
    // Background 3D Tiles LOD streaming (tileLoad / tileUnload) and unrelated
    // entity updates do NOT move the target in 3D space; watching them caused
    // false `scene_changed` aborts while waiting for the vision model.
    const selected = scene.pick(new Cesium.Cartesian2(position.x, position.y))
    const target = selected?.primitive ?? selected?.tileset ?? null
    return {
      id: globalThis.crypto?.randomUUID?.() ?? `frame-${Date.now()}`,
      dataUrl, point, width: image.width, height: image.height, crop,
      cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, viewer, Cesium, target,
      isValid() {
        if (released || viewer.isDestroyed?.()) return false
        try {
          const current = signature()
          return current.length === initial.length && current.every((value, index) => sameValue(value, initial[index]))
        } catch { return false }
      },
      release,
    }
  } catch (error) { release(); throw error }
}

function groundPick(viewer, position) {
  try {
    const ray = viewer.camera?.getPickRay?.(position)
    if (ray && typeof viewer.scene?.globe?.pick === 'function') {
      const hit = viewer.scene.globe.pick(ray, viewer.scene)
      if (hit) return hit
    }
    if (typeof viewer.camera?.pickEllipsoid === 'function') {
      return viewer.camera.pickEllipsoid(position, viewer.scene?.globe?.ellipsoid)
    }
  } catch {
    /* best effort: one edge may be over sky */
  }
  return null
}

export function projectVisionPolygon(frame, result) {
  if (!frame.isValid()) throw visionError('scene_changed')
  const { polygon } = validateVisionPolygon(result, frame.point)
  const { viewer, Cesium } = frame
  const crop = frame.crop ?? { left: 0, top: 0, width: frame.cssWidth, height: frame.cssHeight }
  if (!viewer.scene.pickPositionSupported) throw visionError('depth_unavailable')
  viewer.render()
  if (!frame.isValid()) throw visionError('scene_changed')
  const rawPoints = []
  let misses = 0
  let fallback = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index], end = polygon[(index + 1) % polygon.length]
    for (let step = 0; step < 2; step += 1) {
      const x = start[0] + (end[0] - start[0]) * step / 2
      const y = start[1] + (end[1] - start[1]) * step / 2
      const position = new Cesium.Cartesian2(crop.left + x * crop.width, crop.top + y * crop.height)
      // A silhouette edge often falls on sky, ground or a neighbouring mesh, where
      // pickPosition has no depth. Do not discard the whole outline: use the globe
      // underneath as a conservative fallback and keep the rest of the valid ring.
      let cartesian = viewer.scene.pickPosition(position)
      let isFallback = false
      if (!cartesian) {
        cartesian = groundPick(viewer, position)
        if (cartesian) {
          fallback += 1
          isFallback = true
        }
      }
      const cartographic = cartesian && Cesium.Cartographic.fromCartesian(cartesian)
      if (!cartographic || ![cartographic.longitude, cartographic.latitude, cartographic.height].every(Number.isFinite)) {
        misses += 1
        continue
      }
      rawPoints.push({
        cartesian,
        lon: Cesium.Math.toDegrees(cartographic.longitude),
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height,
        isFallback,
      })
    }
  }
  const depthHeights = rawPoints.filter((pt) => !pt.isFallback).map((pt) => pt.height).sort((a, b) => a - b)
  let kept = rawPoints
  if (depthHeights.length >= 3 && fallback > 0) {
    // Drop bare-ellipsoid fallback spikes (e.g. 0m globe under a 400m 3D Tileset).
    const medianDepthH = depthHeights[Math.floor(depthHeights.length / 2)]
    const filtered = []
    for (const pt of rawPoints) {
      if (pt.isFallback && Math.abs(pt.height - medianDepthH) > 30) {
        misses += 1
        fallback -= 1
        continue
      }
      filtered.push(pt)
    }
    if (filtered.length >= 3) kept = filtered
  }
  const points = kept.map(({ cartesian, lon, lat, height }) => ({ cartesian, lon, lat, height }))
  if (points.length < 3) throw visionError('depth_unavailable')
  if (!frame.isValid()) throw visionError('scene_changed')
  const totalSamples = polygon.length * 2
  const missRatio = totalSamples > 0 ? Math.round((misses / totalSamples) * 1000) / 1000 : 0
  const depthSource =
    fallback === 0 ? 'scene_depth' : fallback < points.length ? 'mixed_ground_fallback' : 'ground_fallback'
  const warnings = []
  if (fallback > 0) warnings.push('depth_fallback')
  if (misses > 0) warnings.push('depth_partial')
  const ring = points.map((point) => [point.lon, point.lat])
  ring.push(ring[0].slice())
  return {
    points,
    ring,
    complete: misses === 0,
    misses,
    missRatio,
    depth_source: depthSource,
    heightRange: heightRange(points.map((point) => point.height)),
    approximate: true,
    warnings,
  }
}
