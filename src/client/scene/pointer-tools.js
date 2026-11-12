/**
 * scene/pointer-tools.js — canvas picking and the measure-tool click loop.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2: identify what is under a screen
 * position (3D Tiles feature / tileset / entity / scene), collect measurement
 * points on click and finish the tool. Refs are injected so the module never
 * re-creates React state.
 *
 * The v1.6 pick card is gone: "pick" now routes to the identify card, which shows
 * the same attributes plus surface height, coordinates and export actions. The
 * raw pickResult() stays because the Agent bridge uses it as a data read.
 */
export function createPointerTools(deps) {
  const cesiumRef = { get current() { return deps.getCesium() } }
  const viewerRef = { get current() { return deps.getViewer() } }
  const toolRef = deps.toolRef
  const measureRef = deps.measureRef
  const showToast = deps.showToast
  const pickSurface = deps.pickSurface
  const redrawMeasure = deps.redrawMeasure
  const onFinishTool = deps.onFinishTool
  const formatValue = deps.formatValue
  const layerLabel = deps.layerLabel
  const t = deps.t

      function pickResult(position) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { picked: false, type: 'none', properties: [] }
        const picked = viewer.scene.pick(position)
        if (!Cesium.defined(picked)) return { picked: false, type: 'none', properties: [] }
        if (picked instanceof Cesium.Cesium3DTileFeature) {
          const properties = []
          for (const id of picked.getPropertyIds()) {
            if (properties.length >= 40) break
            properties.push({ name: id, value: formatValue(picked.getProperty(id)) })
          }
          return {
            picked: true,
            type: 'tile-feature',
            layer: layerLabel(picked.primitive ?? picked.tileset),
            properties,
          }
        }
        const primitive = picked?.primitive ?? picked
        if (primitive instanceof Cesium.Cesium3DTileset) {
          return { picked: true, type: 'tileset', layer: layerLabel(primitive), properties: [] }
        }
        if (picked?.id instanceof Cesium.Entity) {
          return { picked: true, type: 'entity', name: String(picked.id.name ?? picked.id.id), properties: [] }
        }
        return { picked: true, type: 'scene', properties: [] }
      }

      function onCanvasClick(position) {
        const mode = toolRef.current
        // Vector selections win over the default identify click, otherwise a user
        // could never select an annotation again after identify became default.
        if ((!mode || mode === 'pick' || mode === 'identify') && deps.onOverlayClick?.(position)) return
        if (mode === null) return
        // v1.7 P0 "指认": the overlay owns the read, this module only routes the
        // click so the measure loop below is untouched. "pick" is an alias kept
        // for host commands and old sessions: it opens the same rich card.
        if (mode === 'identify' || mode === 'pick') {
          if (typeof deps.onIdentify === 'function') deps.onIdentify(position)
          return
        }
        if (mode === 'profile') {
          if (typeof deps.onProfilePoint === 'function') deps.onProfilePoint(position)
          return
        }
        const surface = pickSurface(position)
        if (!surface) {
          showToast(t('toast.noSurface'))
          return
        }
        measureRef.current.points.push(surface)
        if (mode === 'height' && measureRef.current.points.length > 2) {
          measureRef.current.points.splice(0, measureRef.current.points.length - 2)
        }
        redrawMeasure(mode)
      }

      function finishMeasure() {
        // Height/profile are measurements too: previously only distance/area left
        // the tool, so 结束 (or double-click/Esc) on a height result did nothing
        // and the HUD kept offering 结束 forever.
        if (['distance', 'area', 'height', 'profile'].includes(toolRef.current)) {
          toolRef.current = null
          onFinishTool()
        }
      }


  return { pickResult, onCanvasClick, finishMeasure }
}
