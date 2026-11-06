/**
 * scene/pointer-tools.js — canvas picking and the measure-tool click loop.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2: identify what is under a screen
 * position (3D Tiles feature / tileset / entity / scene), fill the pick card,
 * collect measurement points on click and finish the tool. Refs are injected so
 * the module never re-creates React state; the chip itself stays in the component.
 */
export function createPointerTools(deps) {
  const cesiumRef = { get current() { return deps.getCesium() } }
  const viewerRef = { get current() { return deps.getViewer() } }
  const toolRef = deps.toolRef
  const measureRef = deps.measureRef
  const setPickInfo = deps.setPickInfo
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

      function pickAt(position) {
        const result = pickResult(position)
        if (!result.picked) {
          setPickInfo({ title: t('toast.pickNone'), rows: [] })
          return
        }
        if (result.type === 'tile-feature') {
          const rows = result.properties.map((entry) => [entry.name, entry.value])
          if (rows.length === 0) rows.push([t('pick.noProperties'), t('pick.noPropertiesValue')])
          setPickInfo({ title: result.layer, rows })
          return
        }
        if (result.type === 'tileset') {
          setPickInfo({
            title: t('pick.title'),
            rows: [
              [t('pick.type'), t('pick.tiles')],
              [t('pick.layer'), result.layer],
            ],
          })
          return
        }
        if (result.type === 'entity') {
          setPickInfo({
            title: t('pick.title'),
            rows: [
              [t('pick.type'), t('pick.entity')],
              [t('pick.name'), result.name],
            ],
          })
          return
        }
        setPickInfo({ title: t('pick.title'), rows: [[t('pick.type'), t('pick.scene')]] })
      }

      function onCanvasClick(position) {
        const mode = toolRef.current
        if (mode === null) return
        if (mode === 'pick') {
          pickAt(position)
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
        if (toolRef.current === 'distance' || toolRef.current === 'area') {
          toolRef.current = null
          onFinishTool()
        }
      }


  return { pickResult, pickAt, onCanvasClick, finishMeasure }
}
