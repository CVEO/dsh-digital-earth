/**
 * scene/capture.js — scene snapshots (canvas → data URL) for screenshots and the
 * Agent capture bridge.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2. The chrome (toolbars / HUD) is
 * hidden before grabbing the frame, the buffer is always rendered at full
 * resolution (the balanced tier trades sharpness for motion; a capture wants the
 * picture), and the data URL is bounded (7.5 MB) with JPEG quality steps before
 * failing clearly.
 *
 * Dependencies are injected so this module holds no React state: viewer/root refs
 * arrive as getters, and chrome/HUD helpers plus the frame scheduler are passed in.
 *
 * v1.5.2 P0 4.1: an Agent capture also reports the camera pose and scene context
 * it was taken from (lon/lat/height/heading/pitch, view centre, layers, imagery,
 * terrain, plugin version) so the Host can store a provenance sidecar next to the
 * image. Every number is read from Cesium and null when unavailable — never
 * guessed.
 */
import { pickSurfaceAt } from './pick-surface.js'

const RAD_TO_DEG = 180 / Math.PI
const roundCoordinate = (value) => Math.round(value * 1e6) / 1e6

/** A finite number, or null: capture metadata must never invent a value. */
const finiteNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** A drawable size (>= 2): `clientWidth` is 0 while a background tab is laid out. */
const positiveNumber = (value) => {
  const number = finiteNumber(value)
  return number === null || number < 2 ? null : number
}

/** Camera pose at capture time (degrees, metres), or null before the viewer is ready. */
function cameraMetadata(viewer) {
  const camera = viewer?.camera
  const carto = camera?.positionCartographic
  if (!carto) return null
  const lon = finiteNumber(carto.longitude)
  const lat = finiteNumber(carto.latitude)
  const height = finiteNumber(carto.height)
  if (lon === null || lat === null || height === null) return null
  const heading = finiteNumber(camera.heading)
  const pitch = finiteNumber(camera.pitch)
  return {
    lon: roundCoordinate(lon * RAD_TO_DEG),
    lat: roundCoordinate(lat * RAD_TO_DEG),
    height: Math.round(height),
    heading: heading === null ? null : Math.round(heading * RAD_TO_DEG),
    pitch: pitch === null ? null : Math.round(pitch * RAD_TO_DEG),
  }
}

/**
 * The point under the middle of the canvas: the 3D surface first, the ellipsoid
 * as the fallback. Null when the ray misses the globe (sky) or Cesium is absent.
 */
function centerMetadata(viewer, Cesium) {
  if (!viewer || !Cesium || typeof Cesium.Cartesian2 !== 'function') return null
  const canvas = viewer.canvas
  if (!canvas || !viewer.camera || !viewer.scene) return null
  const width = positiveNumber(canvas.clientWidth) ?? positiveNumber(canvas.width)
  const height = positiveNumber(canvas.clientHeight) ?? positiveNumber(canvas.height)
  if (width === null || height === null) return null
  const position = new Cesium.Cartesian2(Math.round(width / 2), Math.round(height / 2))
  let cartesian = null
  try {
    cartesian = pickSurfaceAt(viewer, position) ?? viewer.camera.pickEllipsoid(position, viewer.scene.globe?.ellipsoid) ?? null
  } catch {
    cartesian = null
  }
  if (!cartesian) return null
  let carto = null
  try {
    if (typeof Cesium.Cartographic?.fromCartesian === 'function') {
      carto = Cesium.Cartographic.fromCartesian(cartesian)
    } else if (typeof viewer.scene.globe?.ellipsoid?.cartesianToCartographic === 'function') {
      carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian)
    }
  } catch {
    carto = null
  }
  const lon = finiteNumber(carto?.longitude)
  const lat = finiteNumber(carto?.latitude)
  if (lon === null || lat === null) return null
  const elevation = finiteNumber(carto.height)
  return {
    lon: roundCoordinate(lon * RAD_TO_DEG),
    lat: roundCoordinate(lat * RAD_TO_DEG),
    height: elevation === null ? null : Math.round(elevation),
  }
}

/**
 * Scene provenance for one capture. Shape is fixed and additive-only; the Host
 * re-validates every field before it reaches disk or a tool result.
 */
function captureMetadata({ viewer, Cesium, meta, config, layers }) {
  const imageryId = config?.settings?.imagery
  const terrainId = config?.settings?.terrain
  const imagery = Array.isArray(config?.imagery) ? config.imagery.find((item) => item?.id === imageryId) : null
  const terrain = Array.isArray(config?.terrain) ? config.terrain.find((item) => item?.id === terrainId) : null
  return {
    captured_at: new Date().toISOString(),
    camera: cameraMetadata(viewer),
    center: centerMetadata(viewer, Cesium),
    layers: (Array.isArray(layers) ? layers : [])
      .filter((layer) => typeof layer?.name === 'string' && layer.name !== '')
      .slice(0, 200)
      .map((layer) => ({ name: layer.name, visible: layer.visible === true, kind: typeof layer.kind === 'string' ? layer.kind : null })),
    imagery: typeof imagery?.name === 'string' ? imagery.name : null,
    terrain: typeof terrain?.name === 'string' ? terrain.name : null,
    plugin_version: typeof meta?.version === 'string' ? meta.version : null,
  }
}

export function createCaptureService({ getViewer, getRoot, getSettings, getMeta, getSession, getCesium, getLayers, t, showToast, setChromeHidden, nextFrames, revealPanel, drawCaptureOverlay, drawVectorLabels }) {
  const MAX_CAPTURE_DATAURL = 7_500_000

  /** The panel is "hidden" when its tab is not laid out or the whole window is hidden. */
  const panelIsHidden = () => {
    const root = getRoot()
    return (
      !root ||
      root.offsetWidth < 32 ||
      root.offsetHeight < 32 ||
      (typeof document !== 'undefined' && document.visibilityState === 'hidden')
    )
  }

  /** Render the canvas at the requested width and return a data URL. */
  async function renderSnapshot(options = {}) {
    const viewer = getViewer()
    if (!viewer) throw new Error(t('agent.noViewer'))
    let hidden = panelIsHidden()
    // A screenshot belongs to the user, not to whichever tab happens to be
    // focused: try to bring the panel forward first, then render it off-screen.
    // v1.5.1 refused outright, so agent runs could never capture while the user
    // was reading the chat or the window was in the background.
    if (hidden && typeof revealPanel === 'function') {
      try {
        revealPanel()
      } catch {
        // Revealing is best-effort; the off-screen path below still runs.
      }
      await new Promise((resolve) => setTimeout(resolve, 180))
      hidden = panelIsHidden()
    }
    const width = Math.round(Math.min(Math.max(Number(options.width) || 1280, 480), 2560))
    const format = options.format === 'png' ? 'png' : 'jpeg'
    const settings = getSettings()?.settings ?? {}
    const includeHud = typeof options.include_hud === 'boolean' ? options.include_hud : settings.screenshotHud === true
    const chromeHidden = !includeHud && !hidden
    if (chromeHidden) setChromeHidden(true)
    try {
      // A hidden tab has no next animation frame to wait for. Cesium can still
      // render into its existing canvas on demand, so skip the two-frame wait and
      // let the explicit render below produce the picture.
      if (!hidden) {
        // Let CSS hide the chrome before the next frame is drawn, with a bound
        // so a backgrounded tab fails clearly instead of timing out later.
        await Promise.race([
          nextFrames(2),
          new Promise((_, reject) => setTimeout(() => reject(new Error(t('agent.hiddenPanel'))), 1500)),
        ])
      }
      // Captures always use the full-quality buffer: the balanced tier trades
      // sharpness for motion, and the user asked for a picture, not a frame
      // budget. The tier's scale is restored afterwards.
      const previousResolutionScale = viewer.resolutionScale
      viewer.resolutionScale = 1
      try {
        viewer.resize()
        viewer.render()
        const canvas = viewer.canvas
        const sourceWidth = canvas?.width ?? 0
        const sourceHeight = canvas?.height ?? 0
        if (sourceWidth < 32 || sourceHeight < 32) throw new Error(t('agent.hiddenPanel'))
        let scale = 1
        let quality = 0.9
        let targetWidth = 0
        let targetHeight = 0
        let dataUrl = ''
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const drawWidth = Math.max(320, Math.round(width * scale))
          targetWidth = Math.min(drawWidth, sourceWidth)
          targetHeight = Math.max(1, Math.round((targetWidth * sourceHeight) / sourceWidth))
          const target = document.createElement('canvas')
          target.width = targetWidth
          target.height = targetHeight
          const context = target.getContext('2d')
          context.drawImage(canvas, 0, 0, targetWidth, targetHeight)
          drawVectorLabels?.(context, targetWidth, targetHeight)
          if (includeHud) drawCaptureOverlay(context, targetWidth, targetHeight)
          dataUrl = format === 'png' ? target.toDataURL('image/png') : target.toDataURL('image/jpeg', quality)
          if (dataUrl.length <= MAX_CAPTURE_DATAURL) break
          if (format === 'jpeg') quality = Math.max(0.5, quality - 0.15)
          else scale *= 0.75
        }
        if (dataUrl.length > MAX_CAPTURE_DATAURL) throw new Error(t('agent.captureTooLarge'))
        return { dataUrl, width: targetWidth, height: targetHeight, includeHud, format }
      } finally {
        viewer.resolutionScale = previousResolutionScale
        viewer.resize()
      }
    } finally {
      if (chromeHidden) setChromeHidden(false)
    }
  }

  async function screenshot() {
    try {
      const shot = await renderSnapshot({ format: 'png' })
      const link = document.createElement('a')
      link.href = shot.dataUrl
      link.download = `digital-earth-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      link.click()
      showToast(t('toast.screenshotSaved'))
    } catch (error) {
      showToast(t('toast.screenshotFailed', { message: error?.message ?? String(error) }))
    }
  }

  /** Snapshot the scene and hand the file to the Host for the Agent to read. */
  async function captureScene(options = {}, session = null) {
    const meta = getMeta()
    if (!meta?.captureUrl) throw new Error(t('agent.notReady'))
    const shot = await renderSnapshot(options)
    const metadata = captureMetadata({
      viewer: getViewer(),
      Cesium: typeof getCesium === 'function' ? getCesium() : null,
      meta,
      config: typeof getSettings === 'function' ? getSettings() : null,
      layers: typeof getLayers === 'function' ? getLayers() : [],
    })
    const response = await fetch(`${meta.captureUrl}?token=${encodeURIComponent(meta.token)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session: session ?? getSession() ?? '',
        dataUrl: shot.dataUrl,
        width: shot.width,
        height: shot.height,
        hud: shot.includeHud,
        label: typeof options.label === 'string' ? options.label : '',
        metadata,
      }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const saved = await response.json()
    // The Host echoes the validated metadata back, so the caller reports exactly
    // what the sidecar holds; an older Host has no echo and the page's copy stays.
    const echoed = saved !== null && typeof saved === 'object' && saved.metadata !== null && typeof saved.metadata === 'object' && !Array.isArray(saved.metadata) ? saved.metadata : null
    showToast(
      t('toast.captureSaved', {
        width: saved.width,
        height: saved.height,
        path: saved.name ?? saved.path ?? '',
      }),
    )
    return {
      ...saved,
      hud: shot.includeHud,
      metadata: echoed ?? metadata,
      metadata_path: typeof saved.metadata_path === 'string' ? saved.metadata_path : null,
    }
  }

  return { renderSnapshot, screenshot, captureScene }
}
