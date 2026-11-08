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
 */
export function createCaptureService({ getViewer, getRoot, getSettings, getMeta, getSession, t, showToast, setChromeHidden, nextFrames, drawCaptureOverlay, drawVectorLabels }) {
  const MAX_CAPTURE_DATAURL = 7_500_000

  /** Render the canvas at the requested width and return a data URL. */
  async function renderSnapshot(options = {}) {
    const viewer = getViewer()
    if (!viewer) throw new Error(t('agent.noViewer'))
    const root = getRoot()
    const hidden =
      !root ||
      root.offsetWidth < 32 ||
      root.offsetHeight < 32 ||
      (typeof document !== 'undefined' && document.visibilityState === 'hidden')
    if (hidden) throw new Error(t('agent.hiddenPanel'))
    const width = Math.round(Math.min(Math.max(Number(options.width) || 1280, 480), 2560))
    const format = options.format === 'png' ? 'png' : 'jpeg'
    const settings = getSettings()?.settings ?? {}
    const includeHud = typeof options.include_hud === 'boolean' ? options.include_hud : settings.screenshotHud === true
    if (!includeHud) setChromeHidden(true)
    try {
      // Let CSS hide the chrome before the next frame is drawn, with a bound
      // so a backgrounded tab fails clearly instead of timing out later.
      await Promise.race([
        nextFrames(2),
        new Promise((_, reject) => setTimeout(() => reject(new Error(t('agent.hiddenPanel'))), 1500)),
      ])
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
      if (!includeHud) setChromeHidden(false)
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
      }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const saved = await response.json()
    showToast(
      t('toast.captureSaved', {
        width: saved.width,
        height: saved.height,
        path: saved.name ?? saved.path ?? '',
      }),
    )
    return { ...saved, hud: shot.includeHud }
  }

  return { renderSnapshot, screenshot, captureScene }
}
