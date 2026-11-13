/**
 * scene/vector-renderer.js — render Agent/user GeoJSON overlays and measurements into Cesium.
 *
 * Extracted from ViewerSurface.js so the viewer stays under its size budget and
 * the vector rendering logic can be unit-tested cleanly without a full React tree.
 */
import { formatArea, formatDistance, formatValue, geodesicLength, planarArea } from '../format.js'
import { ensureAnnotationFeatureId } from './annotation-model.js'
import { addAgentGroundLabel, agentLabelText, agentOverlayColor, agentSurfaceHeight } from './overlay-helpers.js'
import { VECTOR_COLORS, vectorLabel } from './vector-style.js'

export function createVectorRenderer({ getState, getVector, t, markSceneDirty, syncOverlayCount }) {
  /**
   * Draw a host-validated GeoJSON FeatureCollection. Every annotation is
   * ground-draped so it stays visible on terrain and imagery; optional
   * GeoJSON heights are therefore ignored here (measurements keep them).
   */
  function drawAgentOverlay(Cesium, viewer, geojson, style, caption) {
    const state = getState()
    const vector = getVector()
    const firstEntity = state.draw.length
    const color = agentOverlayColor(Cesium, style)
    const byType = { points: 0, lines: 0, polygons: 0 }
    const bbox = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }
    let drawn = 0
    let descriptor = null
    // F2: descriptors of this command, so a feature can be edited in place.
    const descriptors = []
    const add = (options) => {
      const entity = vector.add(options, descriptor)
      state.draw.push(entity)
      return entity
    }
    const track = (coordinates) => {
      if (Array.isArray(coordinates)) {
        if (typeof coordinates[0] === 'number' && coordinates.length >= 2) {
          const [lon, lat] = coordinates
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            bbox.west = Math.min(bbox.west, lon)
            bbox.south = Math.min(bbox.south, lat)
            bbox.east = Math.max(bbox.east, lon)
            bbox.north = Math.max(bbox.north, lat)
          }
        } else {
          for (const item of coordinates) track(item)
        }
      }
    }
    const flat2d = (positions) => {
      // Cesium's fromDegreesArray takes lon/lat pairs; optional heights are
      // dropped on purpose here because these primitives are ground-draped.
      const flat = []
      for (const position of positions) {
        if (!Array.isArray(position) || position.length < 2) continue
        flat.push(position[0], position[1])
      }
      return flat
    }
    const nameOf = (properties) => {
      const name = properties?.name
      return typeof name === 'string' && name.trim() !== '' ? name.trim() : ''
    }
    const drawLine = (coordinates, name) => {
      if (!Array.isArray(coordinates) || coordinates.length < 2) return
      add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(flat2d(coordinates)),
          width: 3,
          material: color,
          depthFailMaterial: color.withAlpha(0.55),
          clampToGround: true,
        },
      })
      byType.lines += 1
      drawn += 1
      track(coordinates)
      if (name !== '') {
        const middle = coordinates[Math.floor(coordinates.length / 2)]
        addAgentGroundLabel(Cesium, add, middle[0], middle[1], name)
      }
    }
    const drawPolygon = (rings, name) => {
      if (!Array.isArray(rings) || rings.length === 0 || !Array.isArray(rings[0])) return
      const outer = Cesium.Cartesian3.fromDegreesArray(flat2d(rings[0]))
      if (outer.length < 3) return
      const holes = rings.slice(1).map((ring) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat2d(ring))))
      add({ polygon: { hierarchy: new Cesium.PolygonHierarchy(outer, holes), material: color.withAlpha(0.26), outline: false, perPositionHeight: false } })
      // Ground polygons do not draw an outline reliably, so trace the rings.
      for (const ring of rings) {
        if (!Array.isArray(ring) || ring.length < 2) continue
        const closed = ring.slice()
        const first = closed[0]
        const last = closed[closed.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first)
        add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(flat2d(closed)),
            width: 2,
            material: color,
            depthFailMaterial: color.withAlpha(0.55),
            clampToGround: true,
          },
        })
      }
      byType.polygons += 1
      drawn += 1
      for (const ring of rings) track(ring)
      if (name !== '') {
        let lon = 0
        let lat = 0
        for (const position of rings[0]) {
          lon += position[0]
          lat += position[1]
        }
        addAgentGroundLabel(Cesium, add, lon / rings[0].length, lat / rings[0].length, name)
      }
    }
    const drawPoint = (coordinates, name) => {
      if (!Array.isArray(coordinates) || coordinates.length < 2) return
      add({
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
        point: {
          pixelSize: 11,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
      byType.points += 1
      drawn += 1
      track(coordinates)
      if (name !== '') addAgentGroundLabel(Cesium, add, coordinates[0], coordinates[1], name)
    }
    const drawGeometry = (geometry, properties, feature) => {
      if (geometry === null || typeof geometry !== 'object') return
      const label = agentLabelText(nameOf(properties), caption)
      descriptor = {
        group: {},
        kind: t('layers.vectorDrawn'),
        title: label || t('layers.vectorDrawn'),
        summary: t(`vector.geometry.${String(geometry.type ?? '').replace('Multi', '')}`),
        feature: feature ?? null,
        command: null,
        rows: Object.entries(properties ?? {})
          .filter(([key]) => key !== 'name' && key !== 'feature_id')
          .slice(0, 12)
          .map(([key, value]) => [key, formatValue(value)]),
      }
      descriptors.push(descriptor)
      switch (geometry.type) {
        case 'GeometryCollection':
          for (const child of geometry.geometries ?? []) drawGeometry(child, properties, feature)
          break
        case 'Point':
          drawPoint(geometry.coordinates, label)
          break
        case 'MultiPoint':
          for (const position of geometry.coordinates ?? []) drawPoint(position, label)
          break
        case 'LineString':
          drawLine(geometry.coordinates, label)
          break
        case 'MultiLineString':
          for (const line of geometry.coordinates ?? []) drawLine(line, label)
          break
        case 'Polygon':
          drawPolygon(geometry.coordinates, label)
          break
        case 'MultiPolygon':
          for (const polygon of geometry.coordinates ?? []) drawPolygon(polygon, label)
          break
        default:
          break
      }
    }
    const rawFeatures = Array.isArray(geojson?.features) ? geojson.features : []
    const features = rawFeatures.map((item) => (item?.type === 'Feature' ? ensureAnnotationFeatureId(item) : item))
    const storedGeojson = geojson && typeof geojson === 'object' ? { ...geojson, features } : geojson
    for (const feature of features) {
      if (feature?.geometry?.type === 'GeometryCollection') {
        for (const child of feature.geometry.geometries ?? []) {
          drawGeometry(child, feature.properties, feature)
        }
      } else {
        drawGeometry(feature?.geometry, feature?.properties, feature)
      }
    }
    state.drawnFeatures += drawn
    if (drawn > 0) {
      const command = {
        geojson: storedGeojson,
        style,
        drawn,
        ...(typeof caption === 'string' && caption !== '' ? { caption } : {}),
      }
      state.entityGroups.set(command, state.draw.slice(firstEntity))
      state.drawCommands.push(command)
      // F2: the card can now address the exact command + feature behind an entity.
      for (const item of descriptors) {
        item.command = command
        vector?.refresh?.(item)
      }
      markSceneDirty()
    }
    syncOverlayCount()
    const rounded = (value, digits = 6) => Math.round(value * 10 ** digits) / 10 ** digits
    const hasBox = Number.isFinite(bbox.west) && Number.isFinite(bbox.east)
    return {
      drawn,
      by_type: byType,
      bbox: hasBox
        ? { west: rounded(bbox.west), south: rounded(bbox.south), east: rounded(bbox.east), north: rounded(bbox.north) }
        : null,
    }
  }

  /** Compute and (by default) draw a measurement; returns structured values. */
  function measureAgentOverlay(Cesium, viewer, args) {
    const state = getState()
    const vector = getVector()
    const firstEntity = state.measure.length
    const mode = args.mode
    const points = Array.isArray(args.points) ? args.points : []
    const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits
    if (points.length < 2) throw new Error(t('agent.badMeasure', { message: 'need at least 2 points' }))
    const located = points.map((position) => {
      const lon = position[0]
      const lat = position[1]
      const height = Number.isFinite(position[2]) ? position[2] : agentSurfaceHeight(Cesium, viewer, lon, lat)
      return { lon, lat, height }
    })
    const ground = located.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 0))
    const draw = args.draw !== false
    const color = Cesium.Color.fromCssColorString(VECTOR_COLORS.accent)
    const descriptor = { group: {}, kind: t('layers.vectorMeasured'), title: t(`tool.${mode}`), summary: '' }
    const add = (options) => {
      const entity = vector.add(options, descriptor)
      state.measure.push(entity)
      return entity
    }
    const dot = (lon, lat, height) =>
      add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        point: {
          pixelSize: 8,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    const result = { mode, points: points.length, drawn: draw }
    if (mode === 'distance') {
      const distance = geodesicLength(Cesium, ground)
      result.distance_m = round(distance)
      result.distance_km = round(distance / 1000, 4)
      if (draw) {
        for (const point of located) dot(point.lon, point.lat, point.height)
        add({
          polyline: {
            positions: ground,
            width: 3,
            material: color,
            depthFailMaterial: color.withAlpha(0.55),
            clampToGround: true,
          },
        })
        const last = located[located.length - 1]
        addAgentGroundLabel(Cesium, add, last.lon, last.lat, t('measure.total', { value: formatDistance(distance) }))
      }
    } else if (mode === 'area') {
      if (points.length < 3) throw new Error(t('agent.badMeasure', { message: 'area needs at least 3 points' }))
      const area = planarArea(Cesium, ground)
      const perimeter = geodesicLength(Cesium, [...ground, ground[0]])
      result.area_m2 = round(area)
      result.area_km2 = round(area / 1e6, 6)
      result.perimeter_m = round(perimeter)
      if (draw) {
        add({ polygon: { hierarchy: new Cesium.PolygonHierarchy(ground), material: color.withAlpha(0.28), outline: false, perPositionHeight: false } })
        add({
          polyline: {
            positions: [...ground, ground[0]],
            width: 3,
            material: color,
            depthFailMaterial: color.withAlpha(0.55),
            clampToGround: true,
          },
        })
        let lon = 0
        let lat = 0
        for (const point of located) {
          lon += point.lon
          lat += point.lat
        }
        addAgentGroundLabel(Cesium, add, lon / located.length, lat / located.length, t('measure.areaLabel', { value: formatArea(area) }))
      }
    } else if (mode === 'height') {
      if (points.length !== 2) throw new Error(t('agent.badMeasure', { message: 'height needs exactly 2 points' }))
      const from = located[0]
      const to = located[1]
      const delta = to.height - from.height
      const horizontal = new Cesium.EllipsoidGeodesic(
        Cesium.Cartographic.fromDegrees(from.lon, from.lat, from.height),
        Cesium.Cartographic.fromDegrees(to.lon, to.lat, to.height),
      ).surfaceDistance
      const slope = horizontal > 0 ? (Math.atan2(delta, horizontal) * 180) / Math.PI : 0
      result.height_m = round(delta)
      result.height_from_m = round(from.height)
      result.height_to_m = round(to.height)
      result.horizontal_m = round(horizontal)
      result.slope_deg = round(slope, 2)
      if (draw) {
        for (const point of located) dot(point.lon, point.lat, point.height)
        add({
          polyline: {
            positions: located.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height)),
            width: 3,
            material: color,
            depthFailMaterial: color.withAlpha(0.55),
          },
        })
        add({
          position: Cesium.Cartesian3.fromDegrees(to.lon, to.lat, to.height),
          label: vectorLabel(
            Cesium,
            t('measure.height', { value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m`, distance: formatDistance(horizontal) }),
          ),
        })
      }
    } else {
      throw new Error(t('agent.badMeasure', { message: `unsupported mode ${String(mode)}` }))
    }
    // `measured_points` counts what is currently drawn, matching the entity
    // count in `overlays`; a numeric-only measurement adds no overlay.
    if (draw) {
      state.measuredCount += points.length
      const command = { mode, points, draw: true, result }
      state.entityGroups.set(command, state.measure.slice(firstEntity))
      state.measureCommands.push(command)
      markSceneDirty()
    }
    syncOverlayCount()
    descriptor.summary = state.measure.slice(firstEntity).map((entity) => entity.label?.text?.getValue?.()).filter(Boolean).join(' · ')
    vector?.refresh?.(descriptor)
    return result
  }
  //#endregion Agent overlays

  return { drawAgentOverlay, measureAgentOverlay }
}
