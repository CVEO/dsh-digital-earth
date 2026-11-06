/**
 * scene/status.js — the scene status object reported by `earth_scene status`.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2. Fields are additive: old keys keep
 * their names/semantics, new keys (render quality, raster_overlays) explain the
 * scene state the Agent reads. Refs arrive as getters, so no stale viewer is held.
 */
export function createSceneStatus(deps) {
  const cesiumRef = { get current() { return deps.getCesium() } }
  const viewerRef = { get current() { return deps.getViewer() } }
  const sourcesRef = { get current() { return deps.getSources() } }
  const layersRef = { get current() { return deps.getLayers() } }
  const overlayLayersRef = { get current() { return deps.getOverlayLayers() } }
  const agentOverlayRef = { get current() { return deps.getAgentOverlays() } }
  const toolRef = { get current() { return deps.getToolMode() } }
  const t = deps.t
  const redactUrl = deps.redactUrl
  const normalizeQuality = deps.normalizeQuality

      async function collectSceneStatus() {
        const fps = deps.getFps()
        const busy = deps.getBusy()
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) throw new Error(t('agent.notReady'))
        const carto = viewer.camera.positionCartographic
        const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} }
        const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null
        const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null
        const round = (value) => Math.round(value * 1e6) / 1e6
        return {
          ready: true,
          view: {
            lon: round(Cesium.Math.toDegrees(carto.longitude)),
            lat: round(Cesium.Math.toDegrees(carto.latitude)),
            height: Math.round(carto.height),
            heading: Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0)),
            pitch: Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0)),
          },
          layers: layersRef.current.map((layer) => {
            const statistics = layer.tileset.statistics ?? {}
            return {
              id: layer.id,
              name: layer.name,
              visible: layer.visible,
              url: redactUrl(layer.url),
              tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded ?? 0,
              pending: statistics.numberOfPendingRequests ?? 0,
              triangles: statistics.numberOfTrianglesSelected ?? 0,
            }
          }),
          imagery: imagery ? { id: imagery.id, name: imagery.name } : null,
          terrain: terrain ? { id: terrain.id, name: terrain.name } : null,
          sources: {
            imagery: config.imagery.map((item) => ({ id: item.id, name: item.name })),
            terrain: config.terrain.map((item) => ({ id: item.id, name: item.name })),
          },
          viewport: { width: viewer.canvas.width, height: viewer.canvas.height },
          // L3 raster overlays above the basemap, in stack order (additive field).
          raster_overlays: overlayLayersRef.current?.list() ?? [],
          // Render health is additive: `fps` is null while the scene is idle (no
          // render pass for 2 s) and the terrain depth-test flag is the user's
          // current choice, so an Agent can explain a "model looks flat/buried"
          // report instead of guessing.
          render: {
            fps: fps === null ? null : Math.round(fps),
            idle: fps === null,
            terrain_depth_test: viewer.scene.globe.depthTestAgainstTerrain === true,
            // Quality tier + the effective scale, so "why is it blurry / slow"
            // has an answer in the scene state instead of a guess.
            quality: normalizeQuality(config.settings.quality),
            resolution_scale: viewer.resolutionScale,
            globe_maximum_screen_space_error: viewer.scene.globe.maximumScreenSpaceError,
          },
          snapshot: { includeHud: config.settings.screenshotHud === true },
          measureTool: toolRef.current,
          annotations: {
            drawn_features: agentOverlayRef.current.drawnFeatures,
            measured_points: agentOverlayRef.current.measuredCount,
            overlays: agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length,
          },
          busy: busy || '',
        }
      }


  return { collectSceneStatus }
}
