/**
 * scene/shapefile-import.js — minimal ESRI Shapefile reader (client-only).
 *
 * Scope: the panel's local vector import. Parses uncompressed `.shp` (+ optional
 * `.dbf` attributes) into the same FeatureCollection shape as
 * `vector-import.js`, so the panel draws it through the existing overlay renderer.
 * No third-party parser, no host route. Supported shapes: Point/PointZ, MultiPoint,
 * PolyLine/PolyLineZ, Polygon/PolygonZ; Null records are skipped, M/Z/measure
 * payloads are ignored (the panel is 2D/3D on WGS84 lon/lat).
 */
import { countCoordinates, collectLonLat, VECTOR_IMPORT_LIMITS } from './vector-import.js'

const SHP_MAGIC = 9994
const SHAPE_NULL = 0
const SHAPE_POINT = 1
const SHAPE_POLYLINE = 3
const SHAPE_POLYGON = 5
const SHAPE_MULTIPOINT = 8
const SHAPE_POINT_Z = 11
const SHAPE_POLYLINE_Z = 13
const SHAPE_POLYGON_Z = 15
const SHAPE_MULTIPOINT_Z = 18
const SHAPE_POINT_M = 21
const SHAPE_POLYLINE_M = 23
const SHAPE_POLYGON_M = 25
const SHAPE_MULTIPOINT_M = 28

const shapeError = (message) => new Error(`Shapefile: ${message}`)

const lineTypes = new Set([SHAPE_POLYLINE, SHAPE_POLYLINE_Z, SHAPE_POLYLINE_M])
const polygonTypes = new Set([SHAPE_POLYGON, SHAPE_POLYGON_Z, SHAPE_POLYGON_M])
const pointTypes = new Set([SHAPE_POINT, SHAPE_POINT_Z, SHAPE_POINT_M])
const multiPointTypes = new Set([SHAPE_MULTIPOINT, SHAPE_MULTIPOINT_Z, SHAPE_MULTIPOINT_M])

const round = (value) => Math.round(value * 1e7) / 1e7

function dataViewOf(buffer) {
  if (buffer instanceof ArrayBuffer) return new DataView(buffer)
  if (ArrayBuffer.isView(buffer)) return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  throw shapeError('不是二进制文件')
}

/** Ring orientation: negative = clockwise (Shapefile outer ring), positive = hole. */
function ringSignedArea(ring) {
  let sum = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    sum += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1]
  }
  return sum / 2
}

function closeRing(points) {
  if (points.length < 3) return null
  const ring = points.map((point) => [point[0], point[1]])
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first.slice())
  return ring
}

/** Polygon: grouping rings into outer/holes by Shapefile winding. */
function polygonsFromRings(rings) {
  const polygons = []
  let current = null
  for (const ring of rings) {
    const area = ringSignedArea(ring)
    if (area < 0 || current === null) {
      current = { outer: ring, holes: [] }
      polygons.push(current)
    } else {
      current.holes.push(ring)
    }
  }
  return polygons
    .filter((polygon) => polygon.outer.length >= 4)
    .map((polygon) => ({ type: 'Polygon', coordinates: [polygon.outer, ...polygon.holes] }))
}

function readPoint(view, offset) {
  return { type: 'Point', coordinates: [round(view.getFloat64(offset, true)), round(view.getFloat64(offset + 8, true))] }
}

function readMultiPoint(view, offset) {
  const count = view.getInt32(offset + 36, true)
  const points = []
  for (let index = 0; index < count; index += 1) {
    const at = offset + 40 + index * 16
    points.push([round(view.getFloat64(at, true)), round(view.getFloat64(at + 8, true))])
  }
  return { type: 'MultiPoint', coordinates: points }
}

function readParts(view, offset) {
  const partCount = view.getInt32(offset + 36, true)
  const pointCount = view.getInt32(offset + 40, true)
  if (partCount < 0 || pointCount < 0 || partCount > 100000 || pointCount > VECTOR_IMPORT_LIMITS.maxCoordinates * 2) {
    throw shapeError('折线/多边形的 parts/points 数量异常')
  }
  const parts = []
  for (let index = 0; index < partCount; index += 1) parts.push(view.getInt32(offset + 44 + index * 4, true))
  parts.push(pointCount)
  const pointsAt = offset + 44 + partCount * 4
  const segments = []
  for (let index = 0; index < partCount; index += 1) {
    const start = parts[index]
    const end = parts[index + 1]
    if (start < 0 || end > pointCount || end <= start) throw shapeError('折线/多边形的 parts 索引越界')
    const points = []
    for (let pointIndex = start; pointIndex < end; pointIndex += 1) {
      const at = pointsAt + pointIndex * 16
      points.push([round(view.getFloat64(at, true)), round(view.getFloat64(at + 8, true))])
    }
    segments.push(points)
  }
  return segments
}

function geometriesForRecord(view, contentOffset, type) {
  if (type === SHAPE_NULL) return []
  if (pointTypes.has(type)) return [readPoint(view, contentOffset + 4)]
  if (multiPointTypes.has(type)) return [readMultiPoint(view, contentOffset)]
  if (lineTypes.has(type)) {
    const segments = readParts(view, contentOffset)
    const coordinates = segments.filter((points) => points.length >= 2)
    if (coordinates.length === 0) return []
    return [coordinates.length === 1 ? { type: 'LineString', coordinates: coordinates[0] } : { type: 'MultiLineString', coordinates }]
  }
  if (polygonTypes.has(type)) {
    const segments = readParts(view, contentOffset)
    const rings = segments.map(closeRing).filter(Boolean)
    return polygonsFromRings(rings)
  }
  throw shapeError(`不支持的 shape type：${type}`)
}

/** Read a DBF attribute table into one plain object per record. */
export function parseDbf(buffer) {
  const view = dataViewOf(buffer)
  if (view.byteLength < 32) throw shapeError('DBF 文件过短')
  const records = view.getUint32(4, true)
  const headerLength = view.getUint16(8, true)
  const recordLength = view.getUint16(10, true)
  if (headerLength < 33 || headerLength > view.byteLength) throw shapeError('DBF 头长度异常')
  if (records > VECTOR_IMPORT_LIMITS.maxFeatures * 4) throw shapeError('DBF 记录过多')
  const fields = []
  for (let offset = 32; offset + 32 <= headerLength - 1; offset += 32) {
    let end = offset
    while (end < offset + 11 && view.getUint8(end) !== 0) end += 1
    const nameBytes = new Uint8Array(view.buffer, view.byteOffset + offset, end - offset)
    const name = new TextDecoder('utf-8').decode(nameBytes).trim()
    const fieldType = String.fromCharCode(view.getUint8(offset + 11))
    const length = view.getUint8(offset + 16)
    const decimals = view.getUint8(offset + 17)
    if (name !== '') fields.push({ name, type: fieldType, length, decimals })
  }
  const decoder = new TextDecoder('utf-8')
  const rows = []
  const start = headerLength
  for (let index = 0; index < records; index += 1) {
    const recordAt = start + index * recordLength
    if (recordAt + recordLength > view.byteLength) break
    if (view.getUint8(recordAt) === 0x2a) continue // deleted record
    const row = {}
    let at = recordAt + 1
    for (const field of fields) {
      const slice = new Uint8Array(view.buffer, view.byteOffset + at, field.length)
      const text = decoder.decode(slice).trim()
      if (field.type === 'N' || field.type === 'F') {
        const number = Number(text)
        row[field.name] = text === '' || !Number.isFinite(number) ? null : number
      } else if (field.type === 'L') {
        row[field.name] = /^[yt]$/i.test(text) ? true : /^[nf]$/i.test(text) ? false : null
      } else {
        row[field.name] = text
      }
      at += field.length
    }
    rows.push(row)
  }
  return rows
}

/**
 * Parse a `.shp` (and optional `.dbf` attributes) into the same vector summary as
 * local GeoJSON import. Throws with a readable reason for unsupported/corrupt data.
 */
export function parseShapefile(shpBuffer, dbfBuffer = null) {
  const view = dataViewOf(shpBuffer)
  if (view.byteLength < 100) throw shapeError('SHP 文件过短')
  if (view.getInt32(0, false) !== SHP_MAGIC) throw shapeError('不是 ESRI Shapefile（文件头 magic 不符）')
  const declaredBytes = view.getInt32(24, false) * 2
  const end = Math.min(view.byteLength, declaredBytes > 100 ? declaredBytes : view.byteLength)
  let offset = 100
  const geometries = []
  const originalIndexes = []
  let recordIndex = 0
  while (offset + 8 <= end) {
    const contentBytes = view.getInt32(offset + 4, false) * 2
    const contentOffset = offset + 8
    if (contentBytes < 4 || contentOffset + contentBytes > view.byteLength) throw shapeError('记录长度越界')
    const type = view.getInt32(contentOffset, true)
    const readable = type !== SHAPE_NULL && geometriesForRecord(view, contentOffset, type)
    if (type === SHAPE_NULL) {
      // Null shape: keep its DBF row aligned with the feature index below.
    } else {
      for (const geometry of readable) {
        geometries.push(geometry)
        originalIndexes.push(recordIndex)
      }
    }
    recordIndex += 1
    offset = contentOffset + contentBytes
  }
  if (geometries.length === 0) throw shapeError('没有可绘制的要素')
  if (geometries.length > VECTOR_IMPORT_LIMITS.maxFeatures) {
    throw shapeError(`要素过多（${geometries.length}），最多 ${VECTOR_IMPORT_LIMITS.maxFeatures} 个`)
  }
  const rows = dbfBuffer ? parseDbf(dbfBuffer) : []
  const features = []
  const geometryTypes = new Set()
  let coordinates = 0
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (let index = 0; index < geometries.length; index += 1) {
    const geometry = geometries[index]
    const counted = countCoordinates(geometry)
    if (counted.invalid) throw shapeError('坐标包含非有限数值')
    coordinates += counted.count
    if (coordinates > VECTOR_IMPORT_LIMITS.maxCoordinates) {
      throw shapeError(`坐标点过多，最多 ${VECTOR_IMPORT_LIMITS.maxCoordinates} 个`)
    }
    geometryTypes.add(geometry.type)
    for (const point of collectLonLat(geometry)) {
      if (point[0] < west) west = point[0]
      if (point[0] > east) east = point[0]
      if (point[1] < south) south = point[1]
      if (point[1] > north) north = point[1]
    }
    const attributes = rows[originalIndexes[index]] ?? {}
    // Prefer a name field for the overlay label when one exists.
    const name = attributes.name ?? attributes.NAME ?? attributes.Name
    features.push({
      type: 'Feature',
      properties: name !== undefined ? { ...attributes, name } : attributes,
      geometry,
    })
  }
  const warnings = []
  if (rows.length > 0 && rows.length !== recordIndex) warnings.push('DBF 记录数与 SHP 要素数不一致，属性可能错位')
  return {
    geojson: { type: 'FeatureCollection', features },
    featureCount: features.length,
    geometryTypes: [...geometryTypes],
    coordinateCount: coordinates,
    bbox: Number.isFinite(west) ? { west, south, east, north } : null,
    warnings,
  }
}
