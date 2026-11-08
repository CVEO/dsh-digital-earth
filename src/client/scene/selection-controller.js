/**
 * scene/selection-controller.js — the viewer-side half of "指认" (v1.7 P0).
 *
 * Reads what is actually under a pixel (3D Tiles feature / tileset / entity),
 * samples the surface on a ring of neighbours through the shared HeightService,
 * then hands ui/selection-overlay.js a plain card object. No React state and no
 * tool contract here: the panel owns the UI, and the Agent still only has the
 * frozen six tools.
 */
import { createHeightService } from '../analysis/height-service.js'
import { pickSurfaceAt } from './pick-surface.js'
import { postEvidence } from './evidence-export.js'
import { cameraView } from './motion.js'
import { SELECTION_MAX_PROPERTIES, buildSelectionCard, selectionOffsets } from './selection.js'

/** Format one batch-table value for the card (bounded, string-only). */
function formatProperty(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.slice(0, 160)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value).slice(0, 160)
  } catch {
    return String(value).slice(0, 160)
  }
}

/**
 * @param {object} deps
 * @param {Function} deps.getViewer () => Cesium.Viewer
 * @param {Function} deps.getCesium () => Cesium namespace
 * @param {Function} deps.getLayers () => loaded 3D Tiles layer list
 * @param {Function} deps.getMeta   () => host meta (version + exportUrl)
 */
export function createSelectionController({ getViewer, getCesium, getLayers, getMeta } = {}) {
  /** Map a picked Cesium primitive back to the layer the panel loaded. */
  function findLayer(tileset) {
    const list = typeof getLayers === 'function' ? getLayers() : []
    return (Array.isArray(list) ? list : []).find((layer) => layer && layer.tileset === tileset) ?? null
  }

  /** Classify a pick without assuming any feature metadata exists. */
  function classifyPick(picked, Cesium) {
    if (picked === undefined || picked === null) return { kind: 'scene', tileset: null, properties: [] }
    if (typeof Cesium?.Cesium3DTileFeature === 'function' && picked instanceof Cesium.Cesium3DTileFeature) {
      const properties = []
      try {
        for (const id of picked.getPropertyIds()) {
          if (properties.length >= SELECTION_MAX_PROPERTIES) break
          properties.push({ name: String(id), value: formatProperty(picked.getProperty(id)) })
        }
      } catch {
        /* a feature without a usable batch table still has geometry */
      }
      return { kind: 'tile_feature', tileset: picked.primitive ?? picked.tileset ?? null, properties }
    }
    const primitive = picked?.primitive ?? picked
    if (typeof Cesium?.Cesium3DTileset === 'function' && primitive instanceof Cesium.Cesium3DTileset) {
      return { kind: 'tileset', tileset: primitive, properties: [] }
    }
    if (picked?.id && typeof Cesium?.Entity === 'function' && picked.id instanceof Cesium.Entity) {
      return { kind: 'entity', name: String(picked.id.name ?? picked.id.id ?? ''), properties: [] }
    }
    return { kind: 'scene', tileset: null, properties: [] }
  }

  /** Current camera as a plain view object (used by the evidence pack). */
  function currentView() {
    return cameraView(getViewer(), getCesium())
  }

  /**
   * Identify the object at a screen position.
   * Resolves `{ card, anchor }`; rejects with `no_surface` / `not_ready` when the
   * pixel has no usable surface under it.
   */
  async function identifyAt(position) {
    const viewer = getViewer()
    const Cesium = getCesium()
    if (!viewer || !Cesium) throw new Error('not_ready')
    const anchor = pickSurfaceAt(viewer, position)
    const carto = anchor ? Cesium.Cartographic.fromCartesian(anchor) : null
    if (!carto) throw new Error('no_surface')
    const lon = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    const classified = classifyPick(viewer.scene.pick(position), Cesium)
    const layer = findLayer(classified.tileset)
    const identity = {
      kind: classified.kind,
      name: classified.name ?? null,
      properties: classified.properties ?? [],
    }
    // Ring sampling: 8 bearings × 3 radii. The shared HeightService decides
    // tiles-vs-terrain per probe and never returns a fake zero.
    const heightService = createHeightService({ Cesium, viewer, layer })
    const samples = []
    for (const offset of selectionOffsets({ lon, lat })) {
      const probe = new Cesium.Cartographic(Cesium.Math.toRadians(offset.lon), Cesium.Math.toRadians(offset.lat))
      let sample = null
      try {
        sample = await heightService.sample(probe, { mode: 'surface' })
      } catch {
        sample = null
      }
      samples.push({
        distance_m: offset.distance_m,
        bearing_deg: offset.bearing_deg,
        height_m: sample && typeof sample.height === 'number' ? sample.height : null,
        source: sample?.source ?? 'none',
      })
    }
    const card = buildSelectionCard({
      point: { lon, lat, surface_height_m: carto.height },
      layer,
      identity,
      samples,
    })
    return { card, anchor }
  }

  /**
   * Write the evidence pack next to a clean PNG. The host route is page-only: the
   * page supplies the token-bearing URL and the card JSON; the host never lets
   * the page choose an arbitrary destination.
   */
  async function exportEvidence(card, snapshot = null) {
    const meta = typeof getMeta === 'function' ? getMeta() : null
    return postEvidence({
      card,
      view: currentView(),
      pluginVersion: meta?.version ?? null,
      exportUrl: meta?.exportUrl ?? null,
      snapshot,
    })
  }

  return { identifyAt, exportEvidence, currentView, getViewer, getCesium }
}
