export const VECTOR_COLORS = Object.freeze({
  accent: '#38c9ff',
  alert: '#ff7081',
  success: '#44d7ad',
  warm: '#ffce65',
  violet: '#b5a0ff',
})

export const VECTOR_FONT = '500 13px "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif'

export function vectorLabel(Cesium, text, extra = {}) {
  return {
    text,
    font: VECTOR_FONT,
    style: Cesium.LabelStyle.FILL,
    fillColor: Cesium.Color.WHITE,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString('#17212f').withAlpha(0.94),
    backgroundPadding: new Cesium.Cartesian2(10, 7),
    pixelOffset: new Cesium.Cartesian2(0, -20),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    ...extra,
  }
}

export function vectorLineMaterial(Cesium, color, outlineWidth = 1.25) {
  return new Cesium.PolylineOutlineMaterialProperty({
    color,
    outlineColor: Cesium.Color.fromCssColorString('#071522').withAlpha(0.95),
    outlineWidth,
  })
}

export function styleVectorOptions(Cesium, options) {
  const result = { ...options }
  if (options.point) {
    result.point = {
      ...options.point,
      pixelSize: 8,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1.5,
    }
  }
  if (options.polyline) {
    const line = options.polyline
    const color = line.material
    result.polyline = {
      ...line,
      width: 4.5,
      ...(color instanceof Cesium.Color ? { material: vectorLineMaterial(Cesium, color) } : {}),
      ...(line.clampToGround ? { classificationType: Cesium.ClassificationType.BOTH } : { arcType: Cesium.ArcType.NONE }),
    }
    if (line.depthFailMaterial && color instanceof Cesium.Color) {
      result.polyline.depthFailMaterial = new Cesium.PolylineDashMaterialProperty({
        color: color.withAlpha(0.55),
        dashLength: 14,
      })
    }
  }
  if (options.polygon) {
    const hasElevation =
      options.polygon.perPositionHeight === true ||
      options.polygon.extrudedHeight != null ||
      options.polygon.height != null
    result.polygon = {
      ...options.polygon,
      outline: hasElevation ? (options.polygon.outline ?? true) : false,
    }
    if (options.polygon.material instanceof Cesium.Color) {
      result.polygon.material = options.polygon.material.withAlpha(hasElevation ? 0.34 : 0.16)
    }
    if (!hasElevation) result.polygon.classificationType = Cesium.ClassificationType.BOTH
  }
  if (options.rectangle && options.rectangle.material instanceof Cesium.Color) {
    result.rectangle = { ...options.rectangle, material: options.rectangle.material.withAlpha(0.24), outline: false }
  }
  if (options.label) result.label = vectorLabel(Cesium, options.label.text, options.label)
  return result
}

export function segmentDistance(point, start, end) {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared))
  return Math.hypot(point.x - start.x - fraction * deltaX, point.y - start.y - fraction * deltaY)
}
