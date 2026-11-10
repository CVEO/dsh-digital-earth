/**
 * scene/vector-import.js — parse a local GeoJSON file for the vector overlay.
 *
 * Client-only and dependency-free: the browser File API reads the file, this module
 * validates and bounds it, then the panel draws it through the existing Agent
 * overlay renderer (same styling/clear path as `earth_draw`). Limits keep a huge
 * FeatureCollection from freezing the panel; every failure has a readable reason.
 */
export const VECTOR_IMPORT_LIMITS = {
  maxFeatures: 500,
  maxCoordinates: 20000,
  maxBytes: 8 * 1024 * 1024,
}

const GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

const importError = (message) => new Error(message)

/** Recursively count coordinate pairs and reject non-finite numbers. */
export function countCoordinates(value) {
  let count = 0
  let invalid = false
  const visit = (node) => {
    if (invalid || node === null || node === undefined) return
    if (Array.isArray(node)) {
      // A coordinate pair is [number, number] (optionally with height).
      if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
        if (!Number.isFinite(node[0]) || !Number.isFinite(node[1])) invalid = true
        else count += 1
        return
      }
      for (const item of node) visit(item)
      return
    }
    if (typeof node === 'object') {
      if (node.type === 'GeometryCollection') return visit(node.geometries)
      if (node.coordinates !== undefined) return visit(node.coordinates)
    }
    invalid = true
  }
  visit(value)
  return { count, invalid }
}

/** A GeoJSON FeatureCollection, normalised from FC / Feature / bare geometry. */
export function normalizeVectorGeoJSON(text) {
  if (typeof text !== 'string' || text.trim() === '') throw importError('文件为空')
  if (text.length > VECTOR_IMPORT_LIMITS.maxBytes) throw importError('文件超过 8 MB，请先裁剪')
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw importError('不是合法的 JSON')
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw importError('不是 GeoJSON 对象')
  let features
  if (data.type === 'FeatureCollection') {
    if (!Array.isArray(data.features)) throw importError('FeatureCollection 缺少 features 数组')
    features = data.features
  } else if (data.type === 'Feature') {
    features = [data]
  } else if (GEOMETRY_TYPES.has(data.type)) {
    features = [{ type: 'Feature', properties: {}, geometry: data }]
  } else {
    throw importError(`不支持的 GeoJSON 类型：${String(data.type)}`)
  }
  if (features.length === 0) throw importError('没有可绘制的要素')
  if (features.length > VECTOR_IMPORT_LIMITS.maxFeatures) {
    throw importError(`要素过多（${features.length}），最多 ${VECTOR_IMPORT_LIMITS.maxFeatures} 个`)
  }

  const kept = []
  const geometryTypes = new Set()
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  let coordinates = 0
  for (const feature of features) {
    if (feature === null || typeof feature !== 'object' || feature.type !== 'Feature') continue
    const geometry = feature.geometry
    if (geometry === null || typeof geometry !== 'object') continue
    if (!GEOMETRY_TYPES.has(geometry.type)) {
      throw importError(`不支持的几何类型：${String(geometry.type)}`)
    }
    const counted = countCoordinates(geometry)
    if (counted.invalid) throw importError('坐标必须是有限的经纬度数字')
    coordinates += counted.count
    if (coordinates > VECTOR_IMPORT_LIMITS.maxCoordinates) {
      throw importError(`坐标点过多，最多 ${VECTOR_IMPORT_LIMITS.maxCoordinates} 个`)
    }
    geometryTypes.add(geometry.type)
    const collected = collectLonLat(geometry)
    for (const point of collected) {
      if (point[0] < west) west = point[0]
      if (point[0] > east) east = point[0]
      if (point[1] < south) south = point[1]
      if (point[1] > north) north = point[1]
    }
    kept.push({
      type: 'Feature',
      properties: feature.properties !== null && typeof feature.properties === 'object' ? feature.properties : {},
      geometry,
    })
  }
  if (kept.length === 0) throw importError('没有可绘制的要素')
  return {
    geojson: { type: 'FeatureCollection', features: kept },
    featureCount: kept.length,
    geometryTypes: [...geometryTypes],
    coordinateCount: coordinates,
    bbox: Number.isFinite(west) ? { west, south, east, north } : null,
  }
}

/** Flatten every [lon, lat] pair (GeometryCollection included) for the bbox. */
export function collectLonLat(node) {
  const points = []
  const visit = (value) => {
    if (Array.isArray(value)) {
      if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        points.push([value[0], value[1]])
        return
      }
      for (const item of value) visit(item)
      return
    }
    if (value && typeof value === 'object') {
      if (Array.isArray(value.geometries)) {
        for (const item of value.geometries) visit(item)
        return
      }
      if (value.coordinates !== undefined) visit(value.coordinates)
    }
  }
  visit(node)
  return points
}
