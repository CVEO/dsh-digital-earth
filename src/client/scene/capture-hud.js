/**
 * scene/capture-hud.js — burn the coordinate HUD and team credit into a capture.
 *
 * The panel chrome is a DOM overlay and can never be rasterised with the WebGL
 * canvas, so "include HUD" means drawing the readouts into the exported image
 * with Canvas 2D. Moved out of ViewerSurface (line budget) with the refs injected
 * as getters, so the painter holds no React state.
 */
import { formatCursor, sampleCursor } from '../cursor.js'
import { FALLBACK_ABOUT } from '../messages.js'

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.arcTo(x + width, y, x + width, y + r, r)
  context.lineTo(x + width, y + height - r)
  context.arcTo(x + width, y + height, x + width - r, y + height, r)
  context.lineTo(x + r, y + height)
  context.arcTo(x, y + height, x, y + height - r, r)
  context.lineTo(x, y + r)
  context.arcTo(x, y, x + r, y, r)
  context.closePath()
}

/**
 * @param {object} deps
 * @param {Function} deps.getViewer  () => Cesium.Viewer
 * @param {Function} deps.getCesium  () => Cesium namespace
 * @param {Function} deps.getSources () => source catalog (imagery / terrain names)
 * @param {Function} deps.getLayers  () => loaded 3D Tiles layers
 * @param {Function} deps.getMeta    () => host meta (team credit)
 * @param {Function} deps.getReadout () => last pointer readout text, or null
 * @param {Function} deps.t          i18n lookup
 */
export function createCaptureHud({ getViewer, getCesium, getSources, getLayers, getMeta, getReadout, t }) {
  return function drawCaptureOverlay(context, width, height) {
    const viewer = getViewer()
    const Cesium = getCesium()
    if (!viewer || !Cesium) return
    const font = Math.max(11, Math.min(24, Math.round(width * 0.0155)))
    const padding = Math.max(10, Math.round(font * 0.75))
    const lineGap = Math.round(font * 1.6)
    const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
    const lon = cartographic ? Cesium.Math.toDegrees(cartographic.longitude).toFixed(4) : '—'
    const lat = cartographic ? Cesium.Math.toDegrees(cartographic.latitude).toFixed(4) : '—'
    const cameraHeight = cartographic ? Math.round(cartographic.height) : 0
    const heading = Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0))
    const pitch = Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0))
    const config = getSources() ?? { imagery: [], terrain: [], settings: {} }
    const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null
    const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null
    const lastReadout = getReadout()
    let pointerText = lastReadout || ''
    if (!pointerText) {
      const center = new Cesium.Cartesian2(
        Math.round(viewer.canvas.clientWidth / 2),
        Math.round(viewer.canvas.clientHeight / 2),
      )
      const carto = sampleCursor(viewer, Cesium, center, { pickPosition: true })
      if (carto) pointerText = formatCursor(Cesium, carto)
    }
    const layers = getLayers() ?? []
    const visibleCount = layers.filter((layer) => layer.visible).length
    const lines = [
      `${lastReadout ? t('hud.pointer') : t('hud.center')}  ${pointerText || t('hud.empty')}`,
      `${t('hud.camera')} ${cameraHeight} m · ${t('hud.heading')} ${heading}° · ${pitch}°`,
      `${t('hud.layers')} ${visibleCount}/${layers.length} · ${imagery?.name ?? '—'} · ${terrain?.name ?? '—'}`,
      `${t('hud.cameraPos')} ${lon}, ${lat}`,
    ]
    const family = '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    context.save()
    context.font = `${font}px ${family}`
    context.textBaseline = 'top'
    context.textAlign = 'left'
    const textWidth = Math.max(...lines.map((line) => context.measureText(line).width))
    const boxWidth = Math.min(width - padding * 2, textWidth + padding * 2)
    const boxHeight = lines.length * lineGap + padding * 2
    const boxX = padding
    const boxY = height - boxHeight - padding
    context.fillStyle = 'rgba(8, 12, 18, 0.6)'
    roundedRectPath(context, boxX, boxY, boxWidth, boxHeight, Math.round(font * 0.65))
    context.fill()
    lines.forEach((line, index) => {
      context.fillStyle = index === 0 ? '#eef4ff' : '#c5d2e2'
      context.fillText(line, boxX + padding, boxY + padding + index * lineGap)
    })
    const title = t('panel.title')
    const aboutMeta = getMeta()
    const teamName = aboutMeta?.team?.name ?? t('about.teamName')
    let teamHost = 'www.whu-cveo.com'
    try {
      teamHost = new URL(aboutMeta?.team?.url ?? FALLBACK_ABOUT.teamUrl).host || teamHost
    } catch {
      /* keep the static fallback */
    }
    context.font = `600 ${font}px ${family}`
    context.fillStyle = 'rgba(240, 246, 255, 0.9)'
    context.shadowColor = 'rgba(0, 0, 0, 0.45)'
    context.shadowBlur = Math.round(font * 0.6)
    context.fillText(title, padding, padding)
    const credit = `${teamName} · ${teamHost}`
    context.textAlign = 'right'
    context.font = `${Math.max(10, Math.round(font * 0.85))}px ${family}`
    context.fillStyle = 'rgba(238, 244, 255, 0.85)'
    context.fillText(credit, width - padding, height - padding - font)
    context.restore()
  }
}
