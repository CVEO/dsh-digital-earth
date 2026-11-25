/**
 * scene/layer-telemetry.js — read-only HUD stats, layer source resolution, and
 * runtime counters extracted from ViewerSurface to keep it within its shrinking
 * line budget.
 */

/** Collect HUD camera + per-layer tile/triangle/memory readout. */
export function collectLayerStats({ Cesium, viewer, layers, formatHeight }) {
  if (!Cesium || !viewer) return null
  const layerRows = (Array.isArray(layers) ? layers : []).map((layer) => {
    const statistics = layer.tileset?.statistics ?? {}
    return {
      id: layer.id,
      name: layer.name,
      tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded,
      pending: statistics.numberOfPendingRequests,
      triangles: statistics.numberOfTrianglesSelected,
      memory: layer.tileset?.cacheBytes ?? layer.tileset?.totalMemoryUsageInBytes,
    }
  })
  const heading = Cesium.Math.toDegrees(viewer.camera.heading ?? 0)
  const pitch = Cesium.Math.toDegrees(viewer.camera.pitch ?? 0)
  return {
    height: formatHeight(viewer.camera.positionCartographic.height),
    heading: `${heading.toFixed(0)}°`,
    pitch: `${pitch.toFixed(0)}°`,
    layers: layerRows,
  }
}

/** The original source behind a layer, for the Host inspector. */
export function sourceOfLayer(layer) {
  if (layer?.source) return layer.source
  if (typeof layer?.url === 'string' && /^https?:\/\//i.test(layer.url)) {
    return { kind: 'remote', url: layer.url }
  }
  return null
}

/** Runtime counters merged into the Host report when the panel is online. */
export function layerRuntime(layer) {
  const statistics = layer?.tileset?.statistics ?? {}
  const memory = layer?.tileset?.cacheBytes ?? layer?.tileset?.totalMemoryUsageInBytes
  return {
    tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded ?? 0,
    pending: statistics.numberOfPendingRequests ?? 0,
    triangles: statistics.numberOfTrianglesSelected ?? 0,
    memory: typeof memory === 'number' ? memory : 0,
  }
}
