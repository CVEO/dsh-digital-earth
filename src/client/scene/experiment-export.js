/**
 * scene/experiment-export.js — reproducible multi-frame research comparison exporter.
 *
 * Captures pixel-aligned figure triplets from the exact same camera pose:
 *   - Pair mode (A vs B): `compare_split`, `left_only_<A>`, `right_only_<B>`, + `experiment_meta.json`
 *   - Single mode (with/without A): `compare_split`, `with_<A>`, `without_<A>`, + `experiment_meta.json`
 *
 * Every temporary visibility / splitDirection / splitPosition mutation runs inside
 * a strict `try / finally` rollback so even a mid-export failure leaves the live
 * scene untouched.
 */
import { captureCameraPose } from './camera-pose.js'
import { splitDirectionValues } from './compare-session.js'
import { pauseTileBounds, readTilesetDiagnostics } from './tileset-diagnostics.js'

const clampRatio = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0.5
  return Math.min(0.95, Math.max(0.05, num))
}

/** Produce a clean cross-platform filename slug (ASCII + CJK preserved, unsafe chars removed). */
export function sanitizeFileSlug(raw, fallback = 'layer') {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return cleaned || fallback
}

/** Draw an optional crisp split divider (and subtle labels) onto the exported split canvas. */
export function drawSplitFigureOverlay(context, width, height, { ratio = 0.5, includeDivider = true, includeLabels = false, leftLabel = '', rightLabel = '' } = {}) {
  if (!context || width <= 0 || height <= 0) return
  const x = Math.round(clampRatio(ratio) * width)
  if (includeDivider) {
    context.save()
    context.fillStyle = 'rgba(15, 23, 42, 0.55)'
    context.fillRect(x - 2, 0, 4, height)
    context.fillStyle = 'rgba(255, 255, 255, 0.94)'
    context.fillRect(x - 1, 0, 2, height)
    context.restore()
  }
  if (includeLabels && (leftLabel || rightLabel)) {
    const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.02))
    const padX = Math.round(fontSize * 0.65)
    const padY = Math.round(fontSize * 0.38)
    const margin = Math.round(fontSize * 0.9)
    context.save()
    context.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif`
    context.textBaseline = 'top'
    const paintBadge = (text, alignRight) => {
      if (!text) return
      const metrics = context.measureText(text)
      const boxW = Math.ceil(metrics.width + padX * 2)
      const boxH = Math.ceil(fontSize * 1.25 + padY * 2)
      const bx = alignRight ? width - margin - boxW : margin
      const by = margin
      context.fillStyle = 'rgba(15, 23, 42, 0.72)'
      context.fillRect(bx, by, boxW, boxH)
      context.fillStyle = '#f8fafc'
      context.fillText(text, bx + padX, by + padY)
    }
    paintBadge(leftLabel, false)
    paintBadge(rightLabel, true)
    context.restore()
  }
}

function defaultWaitFrames() {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve()
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function layerMetadataSnapshot(layer) {
  if (!layer) return null
  const diag = readTilesetDiagnostics(layer)
  return {
    id: layer.id,
    name: layer.name,
    kind: layer.kind ?? null,
    diagnostics: diag
      ? {
          wireframe: diag.wireframe,
          clay: diag.clay,
          colorizeTiles: diag.colorizeTiles,
          boundingVolume: diag.boundingVolume,
          maximumScreenSpaceError: diag.sse,
        }
      : null,
    statistics: diag?.statistics ?? null,
  }
}

/**
 * Run a reproducible same-viewpoint comparison export and return:
 *   `{ mode, prefix, shots: [{ role, filename, dataUrl, width, height, format }], metadata, metadataFilename, metadataJson }`
 */
export async function exportComparisonBundle(
  { getViewer, getCesium, getLayers, getMeta, renderSnapshot, waitFrames = defaultWaitFrames },
  options = {},
) {
  const viewer = getViewer?.()
  const Cesium = getCesium?.()
  const layers = Array.isArray(getLayers?.()) ? getLayers() : []
  if (!viewer?.scene || typeof renderSnapshot !== 'function') {
    throw new Error('viewer_unavailable')
  }

  const leftLayer = options.leftLayerId ? layers.find((item) => item.id === options.leftLayerId) ?? null : null
  const rightLayer = options.rightLayerId ? layers.find((item) => item.id === options.rightLayerId) ?? null : null
  if (!leftLayer?.tileset) throw new Error('missing_left_layer')
  if (rightLayer && rightLayer.id === leftLayer.id) throw new Error('same_layer')

  const mode = rightLayer?.tileset ? 'pair' : 'single'
  const ratio = clampRatio(options.ratio ?? viewer.scene.splitPosition ?? 0.5)
  const format = options.format === 'jpeg' ? 'jpeg' : 'png'
  const ext = format === 'jpeg' ? 'jpg' : 'png'
  const width = Math.round(Math.min(Math.max(Number(options.width) || 1920, 480), 2560))
  const includeDivider = options.includeDivider !== false
  const includeLabels = options.includeLabels === true
  const includeSolo = options.includeSolo !== false
  const dirs = splitDirectionValues(Cesium)

  const stamp = (options.timestamp instanceof Date ? options.timestamp : new Date())
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
  const prefix = `compare_${stamp}`
  const leftSlug = sanitizeFileSlug(leftLayer.name, 'left')
  const rightSlug = rightLayer ? sanitizeFileSlug(rightLayer.name, 'right') : ''

  const camera = captureCameraPose(viewer, Cesium)
  let leftMeta
  let rightMeta

  // Snapshot original live state for guaranteed rollback.
  const prevSplitPosition = viewer.scene.splitPosition
  const prevLeft = {
    visible: leftLayer.visible,
    show: leftLayer.tileset.show,
    splitDirection: leftLayer.tileset.splitDirection,
  }
  const prevRight = rightLayer?.tileset
    ? {
        visible: rightLayer.visible,
        show: rightLayer.tileset.show,
        splitDirection: rightLayer.tileset.splitDirection,
      }
    : null

  const shots = []
  const captureStep = async (role, filename, drawOverlay = null) => {
    viewer.scene.requestRender?.()
    await waitFrames()
    const shot = await renderSnapshot({
      width,
      format,
      include_hud: false,
      drawOverlay: drawOverlay ?? undefined,
    })
    shots.push({
      role,
      filename,
      dataUrl: shot.dataUrl,
      width: shot.width,
      height: shot.height,
      format: shot.format,
    })
  }

  const resumeLeftBounds = pauseTileBounds(leftLayer.tileset)
  let resumeRightBounds
  try {
    if (rightLayer?.tileset) resumeRightBounds = pauseTileBounds(rightLayer.tileset)
    leftMeta = layerMetadataSnapshot(leftLayer)
    rightMeta = layerMetadataSnapshot(rightLayer)
    // 1. Split view (A LEFT vs B RIGHT, or A LEFT vs bare ground)
    leftLayer.tileset.show = true
    leftLayer.tileset.splitDirection = dirs.LEFT
    if (rightLayer?.tileset) {
      rightLayer.tileset.show = true
      rightLayer.tileset.splitDirection = dirs.RIGHT
    }
    viewer.scene.splitPosition = ratio
    const overlay =
      includeDivider || includeLabels
        ? (ctx, w, h) =>
            drawSplitFigureOverlay(ctx, w, h, {
              ratio,
              includeDivider,
              includeLabels,
              leftLabel: leftLayer.name,
              rightLabel: rightLayer ? rightLayer.name : '',
            })
        : null
    await captureStep('split', `${prefix}_split.${ext}`, overlay)

    if (includeSolo) {
      // 2. Left-only view (A full screen, B hidden)
      leftLayer.tileset.show = true
      leftLayer.tileset.splitDirection = dirs.NONE
      if (rightLayer?.tileset) {
        rightLayer.tileset.show = false
        rightLayer.tileset.splitDirection = dirs.NONE
      }
      await captureStep(
        mode === 'pair' ? 'left_only' : 'with_layer',
        mode === 'pair' ? `${prefix}_left_${leftSlug}.${ext}` : `${prefix}_with_${leftSlug}.${ext}`,
      )

      // 3. Right-only view (B full screen, A hidden; or bare ground in single mode)
      leftLayer.tileset.show = false
      leftLayer.tileset.splitDirection = dirs.NONE
      if (rightLayer?.tileset) {
        rightLayer.tileset.show = true
        rightLayer.tileset.splitDirection = dirs.NONE
      }
      await captureStep(
        mode === 'pair' ? 'right_only' : 'without_layer',
        mode === 'pair' ? `${prefix}_right_${rightSlug}.${ext}` : `${prefix}_without_${leftSlug}.${ext}`,
      )
    }
  } finally {
    resumeLeftBounds()
    resumeRightBounds?.()
    // Restore exact pre-export tileset & split state regardless of errors.
    leftLayer.visible = prevLeft.visible
    leftLayer.tileset.show = prevLeft.show
    leftLayer.tileset.splitDirection = prevLeft.splitDirection
    if (rightLayer?.tileset && prevRight) {
      rightLayer.visible = prevRight.visible
      rightLayer.tileset.show = prevRight.show
      rightLayer.tileset.splitDirection = prevRight.splitDirection
    }
    viewer.scene.splitPosition = prevSplitPosition
    viewer.scene.requestRender?.()
  }

  const meta = getMeta?.() ?? null
  const metadata = {
    schema: 'dsh-digital-earth.research-comparison.v1',
    exported_at: new Date().toISOString(),
    cesium_version: typeof Cesium?.VERSION === 'string' ? Cesium.VERSION : null,
    plugin_version: typeof meta?.version === 'string' ? meta.version : null,
    mode,
    split_ratio: ratio,
    include_divider: includeDivider,
    include_labels: includeLabels,
    camera,
    left: leftMeta,
    right: rightMeta,
    files: shots.map(({ role, filename, width: w, height: h, format: fmt }) => ({
      role,
      filename,
      width: w,
      height: h,
      format: fmt,
    })),
  }
  const metadataFilename = `${prefix}_meta.json`
  const metadataJson = JSON.stringify(metadata, null, 2)
  return { mode, prefix, shots, metadata, metadataFilename, metadataJson }
}

/** Trigger sequential browser file downloads for every image + metadata JSON in the bundle. */
export async function downloadComparisonBundle(bundle, { delayMs = 120 } = {}) {
  if (!bundle || typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return { ok: false, count: 0 }
  }
  const pause = () => (delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve())
  let count = 0
  for (const shot of bundle.shots ?? []) {
    const link = document.createElement('a')
    link.href = shot.dataUrl
    link.download = shot.filename
    link.click()
    count += 1
    await pause()
  }
  if (typeof bundle.metadataJson === 'string' && bundle.metadataFilename) {
    const link = document.createElement('a')
    let revoke = null
    if (typeof Blob === 'function' && typeof URL?.createObjectURL === 'function') {
      const url = URL.createObjectURL(new Blob([bundle.metadataJson], { type: 'application/json;charset=utf-8' }))
      link.href = url
      revoke = () => URL.revokeObjectURL(url)
    } else {
      link.href = `data:application/json;charset=utf-8,${encodeURIComponent(bundle.metadataJson)}`
    }
    link.download = bundle.metadataFilename
    link.click()
    count += 1
    if (revoke) setTimeout(revoke, 1500)
  }
  return { ok: true, count }
}
