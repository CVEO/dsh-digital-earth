// A single review outline lives outside the adopted layer and its undo history.
export function createInstancePreview() {
  let entity, owner
  function clear() {
    if (entity && !owner?.isDestroyed?.()) {
      owner.entities.remove(entity)
      owner.scene?.requestRender?.()
    }
    entity = owner = null
  }
  function show(viewer, Cesium, feature) {
    clear()
    const ring = feature?.geometry?.coordinates?.[0]
    if (!viewer?.entities?.add || feature?.geometry?.type !== 'Polygon' || !ring?.length) return
    const hex = feature.properties?.color
    const color = Cesium.Color.fromCssColorString(/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#38bdf8')
    const positions = Cesium.Cartesian3.fromDegreesArray(ring.flatMap(([x, y]) => [x, y]))
    owner = viewer
    entity = viewer.entities.add({
      polygon: { hierarchy: new Cesium.PolygonHierarchy(positions), material: color.withAlpha(0.12) },
      polyline: { positions, width: 3, clampToGround: true, material: color },
    })
    viewer.scene?.requestRender?.()
  }
  return { show, clear }
}
