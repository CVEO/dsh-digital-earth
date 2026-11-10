import { vectorError } from './vector-errors.js'

export function validateVectorGeometry(geometry, depth = 0) {
  if (depth > 32 || !geometry || typeof geometry !== 'object') throw vectorError('几何结构嵌套过深或无效')
  const position = (point) => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite) &&
    Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90
  const positions = (points, minimum) => Array.isArray(points) && points.length >= minimum && points.every(position)
  const ring = (points) => positions(points, 4) && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]
  const polygon = (rings) => Array.isArray(rings) && rings.length > 0 && rings.every(ring)
  const coordinates = geometry.coordinates
  let valid = false
  switch (geometry.type) {
    case 'Point': valid = position(coordinates); break
    case 'MultiPoint': valid = positions(coordinates, 1); break
    case 'LineString': valid = positions(coordinates, 2); break
    case 'MultiLineString': valid = Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every((line) => positions(line, 2)); break
    case 'Polygon': valid = polygon(coordinates); break
    case 'MultiPolygon': valid = Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(polygon); break
    case 'GeometryCollection':
      valid = Array.isArray(geometry.geometries) && geometry.geometries.length > 0
      if (valid) geometry.geometries.forEach((child) => validateVectorGeometry(child, depth + 1))
      break
  }
  if (!valid) throw vectorError('几何结构无效，坐标必须是 WGS84 经纬度，线至少两点，面环闭合且至少四点')
}
