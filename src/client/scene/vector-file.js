/**
 * scene/vector-file.js — browser File objects → parsed vector summary.
 *
 * Shared by the Map-tab file picker and the globe's drag-and-drop handler, so both
 * entry points accept exactly the same formats and report the same errors. Pure
 * enough to test with fake File-like objects; no DOM and no host route.
 */
import { parseShapefile } from './shapefile-import.js'
import { normalizeVectorGeoJSON, VECTOR_IMPORT_LIMITS } from './vector-import.js'
import { vectorError } from './vector-errors.js'

const isShp = (name) => /\.shp$/i.test(name)
const isDbf = (name) => /\.dbf$/i.test(name)
const isGeo = (name) => /\.(geojson|json)$/i.test(name)

/**
 * @param {File[]} files one or more selected/dropped files
 * @returns {Promise<{parsed: object, name: string}>} vector summary + display name
 */
export async function readVectorFiles(files) {
  const list = Array.from(files ?? [])
  for (const file of list) if (file.size > VECTOR_IMPORT_LIMITS.maxBytes) throw vectorError('文件超过 8 MB，请先裁剪')
  if (list.filter((file) => isShp(file.name)).length > 1) throw vectorError('请选择一组同名文件，不支持多个 SHP 同时导入')
  const shp = list.find((file) => isShp(file.name))
  const stem = (name) => name.replace(/\.[^.]+$/, '').toLowerCase()
  const companion = (extension) => list.find((file) => stem(file.name) === stem(shp?.name ?? '') && file.name.toLowerCase().endsWith(extension))
  const dbf = companion('.dbf')
  const geos = list.filter((file) => isGeo(file.name))
  if (shp) {
    if (!dbf && list.some((file) => isDbf(file.name))) throw vectorError('SHP 与 DBF 必须同名配对')
    const prj = companion('.prj'), cpg = companion('.cpg')
    if (prj) {
      const projection = await prj.text()
      if (/PROJCS|PROJCRS|PROJECTEDCRS/i.test(projection) || !/GEOGCS|GEOGCRS|GEODCRS/i.test(projection) || !/WGS[ _]?84|WGS[ _]?1984|World Geodetic System 1984/i.test(projection) || !/degree|\b0\.0174532925/i.test(projection) || /PRIMEM\s*\[\s*"[^"]+"\s*,\s*(?!0(?:\.0*)?\s*[,\]])/i.test(projection)) throw vectorError('仅支持 WGS84 经纬度，请先转换投影')
    }
    let encoding = cpg ? (await cpg.text()).replace(/^\uFEFF/, '').trim() : 'utf-8'
    encoding = ({ '65001': 'utf-8', '936': 'gbk', '1252': 'windows-1252' })[encoding] ?? encoding
    try { new TextDecoder(encoding) } catch { throw vectorError('不支持该 DBF 编码') }
    if (typeof shp.arrayBuffer !== 'function') throw new Error('File.arrayBuffer unavailable')
    const parsed = parseShapefile(await shp.arrayBuffer(), dbf ? await dbf.arrayBuffer() : null, { encoding, projectionKnown: Boolean(prj) })
    return { parsed, name: shp.name }
  }
  if (geos.length === 1) {
    if (typeof geos[0].text !== 'function') throw new Error('File.text unavailable')
    const parsed = normalizeVectorGeoJSON(await geos[0].text())
    return { parsed, name: geos[0].name }
  }
  if (geos.length > 1) {
    const features = []
    for (const file of geos) {
      if (typeof file.text !== 'function') throw new Error('File.text unavailable')
      const parsed = normalizeVectorGeoJSON(await file.text())
      features.push(...parsed.geojson.features)
    }
    const merged = normalizeVectorGeoJSON(JSON.stringify({ type: 'FeatureCollection', features }))
    return { parsed: merged, name: geos.map((file) => file.name).join(', ') }
  }
  throw vectorError('vector_file_unsupported')
}

/** True when a drop/file list contains at least one supported extension. */
export function hasVectorFile(files) {
  return Array.from(files ?? []).some((file) => isShp(file.name) || isDbf(file.name) || isGeo(file.name))
}

export function isVectorDrag(dataTransfer) {
  return Array.from(dataTransfer?.types ?? []).includes('Files') || hasVectorFile(dataTransfer?.files)
}
