/**
 * scene/raster-frame-controller.js — unified controller for switching multi-frame
 * raster overlays (L3) and imagery basemaps (L4), keeping Cesium, React UI,
 * Agent `earth_scene frame`, and session snapshot persistence in sync.
 */
import {
  clampFrameIndex,
  describeRasterFrames,
  findFrameIndex,
  resolveRestoredFrameIndex,
  resolveSourceFrames,
} from './raster-time.js'

export function createRasterFrameController({
  getSources,
  getOverlayLayers,
  applyImagery,
  getFrameMap,
  setFrameMap,
  markSceneDirty,
  saveSceneSnapshot,
  t,
}) {
  const catalogSources = () => {
    const config = getSources?.() ?? {}
    const overlays = Array.isArray(config.rasterOverlays) ? config.rasterOverlays : []
    const activeImageryId = config.settings?.imagery ?? null
    const activeImagery =
      activeImageryId && Array.isArray(config.imagery)
        ? config.imagery.find((item) => item.id === activeImageryId) ?? null
        : null
    return { overlays, activeImagery }
  }

  const updateFrameState = (id, index) => {
    const current = getFrameMap?.() ?? {}
    if (current[id] === index) return
    setFrameMap?.({ ...current, [id]: index })
  }

  const findTarget = (token) => {
    const { overlays, activeImagery } = catalogSources()
    const candidates = [
      ...overlays.map((source) => ({ kind: 'raster_overlay', source })),
      ...(activeImagery ? [{ kind: 'imagery', source: activeImagery }] : []),
    ]
    if (!token) {
      const temporal = candidates.filter((item) => resolveSourceFrames(item.source).length >= 2)
      if (temporal.length === 1) return { target: temporal[0], temporal }
      return { target: null, temporal }
    }
    const lowered = token.toLowerCase()
    const byId = candidates.find((item) => item.source.id === token)
    if (byId) return { target: byId, temporal: candidates }
    const byName = candidates.find((item) => String(item.source.name ?? '').toLowerCase() === lowered)
    return { target: byName ?? null, temporal: candidates }
  }

  /** Switch a raster overlay or active imagery basemap to `nextIndex` in place. */
  async function selectFrame(id, nextIndex, { persist = true } = {}) {
    const { overlays, activeImagery } = catalogSources()
    const overlay = overlays.find((item) => item.id === id) ?? null
    const target = overlay
      ? { kind: 'raster_overlay', source: overlay }
      : activeImagery && activeImagery.id === id
        ? { kind: 'imagery', source: activeImagery }
        : null
    if (!target) return { ok: false, reason: 'unknown_layer' }
    const frames = resolveSourceFrames(target.source)
    if (frames.length === 0) return { ok: false, reason: 'not_temporal' }
    const clamped = clampFrameIndex(nextIndex, frames)
    updateFrameState(id, clamped)

    if (target.kind === 'raster_overlay') {
      const outcome = await getOverlayLayers?.()?.setFrame?.(id, clamped)
      if (outcome && !outcome.ok && !outcome.stale) {
        return { ok: false, error: outcome.error || outcome.reason || 'frame switch failed' }
      }
    } else {
      const outcome = await applyImagery?.(id, false, clamped)
      if (outcome && !outcome.ok && !outcome.stale) {
        return { ok: false, error: outcome.error || 'imagery frame switch failed' }
      }
    }
    if (persist) {
      markSceneDirty?.()
      saveSceneSnapshot?.(true)
    }
    return {
      ok: true,
      layer: { id: target.source.id, name: target.source.name, kind: target.kind },
      ...describeRasterFrames(target.source, clamped),
    }
  }

  /** Agent `earth_scene action=frame` handler: validates target & index/time. */
  async function commandFrame({ layer = '', frame, time = '' } = {}) {
    const { target, temporal } = findTarget(layer)
    if (!target) {
      const list = temporal.map((item) => `${item.source.id} (${item.source.name})`).join(', ') || '—'
      if (!layer) throw new Error(t('rasterTime.agentAmbiguous', { list }))
      throw new Error(t('rasterTime.agentUnknownLayer', { name: layer, list }))
    }
    const frames = resolveSourceFrames(target.source)
    if (frames.length < 2) {
      throw new Error(t('rasterTime.agentNoFrames', { name: target.source.name }))
    }
    const targetIndex = findFrameIndex(frames, { frame, time })
    if (targetIndex < 0) {
      const available = frames.map((item) => (item.time ? `${item.index}:${item.time}` : `${item.index}:${item.label}`)).join(', ')
      throw new Error(
        t('rasterTime.agentBadFrame', {
          name: target.source.name,
          value: frame !== undefined ? String(frame) : time,
          available,
        }),
      )
    }
    const result = await selectFrame(target.source.id, targetIndex, { persist: true })
    if (!result.ok) throw new Error(result.error || t('rasterTime.switchFailed', { name: target.source.name }))
    return {
      layer: result.layer,
      frame_count: result.frame_count,
      current_frame: result.current_frame,
      current_label: result.current_label,
      current_time: result.current_time,
      frames: result.frames,
    }
  }

  /** Build the `rasterFrames` map stored inside session snapshots. */
  function snapshotFrames() {
    const { overlays, activeImagery } = catalogSources()
    const current = getFrameMap?.() ?? {}
    const out = {}
    const record = (source) => {
      const frames = resolveSourceFrames(source)
      if (frames.length < 2) return
      const index = clampFrameIndex(current[source.id] ?? 0, frames)
      const active = frames[index]
      out[source.id] = active?.time ? { frame: index, time: active.time } : { frame: index }
    }
    for (const overlay of overlays) record(overlay)
    if (activeImagery) record(activeImagery)
    return out
  }

  /** Apply saved `snapshot.rasterFrames` without moving camera or rebuilding 3D layers. */
  async function restoreFrames(savedFrames) {
    if (!savedFrames || typeof savedFrames !== 'object') return
    const { overlays, activeImagery } = catalogSources()
    for (const overlay of overlays) {
      if (!Object.hasOwn(savedFrames, overlay.id)) continue
      const frames = resolveSourceFrames(overlay)
      if (frames.length < 2) continue
      const restored = resolveRestoredFrameIndex(overlay, savedFrames[overlay.id])
      await selectFrame(overlay.id, restored, { persist: false })
    }
    if (activeImagery && Object.hasOwn(savedFrames, activeImagery.id)) {
      const frames = resolveSourceFrames(activeImagery)
      if (frames.length >= 2) {
        const restored = resolveRestoredFrameIndex(activeImagery, savedFrames[activeImagery.id])
        await selectFrame(activeImagery.id, restored, { persist: false })
      }
    }
  }

  return { selectFrame, commandFrame, snapshotFrames, restoreFrames }
}
