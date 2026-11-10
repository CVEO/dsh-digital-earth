/**
 * scene/vector-file.js — browser File objects → parsed vector summary.
 *
 * Shared by the Map-tab file picker and the globe's drag-and-drop handler, so both
 * entry points accept exactly the same formats and report the same errors. Pure
 * enough to test with fake File-like objects; no DOM and no host route.
 */
import { parseShapefile } from './shapefile-import.js'
import { normalizeVectorGeoJSON } from './vector-import.js'

const isShp = (name) => /\.shp$/i.test(name)
const isDbf = (name) => /\.dbf$/i.test(name)
const isGeo = (name) => /\.(geojson|json)$/i.test(name)

/**
 * @param {File[]} files one or more selected/dropped files
 * @returns {Promise<{parsed: object, name: string}>} vector summary + display name
 */
export async function readVectorFiles(files) {
  const list = Array.from(files ?? [])
  const shp = list.find((file) => isShp(file.name))
  const dbf = list.find((file) => isDbf(file.name))
  const geo = list.find((file) => isGeo(file.name))
  if (shp) {
    if (typeof shp.arrayBuffer !== 'function') throw new Error('File.arrayBuffer unavailable')
    const parsed = parseShapefile(await shp.arrayBuffer(), dbf ? await dbf.arrayBuffer() : null)
    return { parsed, name: shp.name }
  }
  if (geo) {
    if (typeof geo.text !== 'function') throw new Error('File.text unavailable')
    const parsed = normalizeVectorGeoJSON(await geo.text())
    return { parsed, name: geo.name }
  }
  throw new Error('vector_file_unsupported')
}

/** True when a drop/file list contains at least one supported extension. */
export function hasVectorFile(files) {
  return Array.from(files ?? []).some((file) => isShp(file.name) || isDbf(file.name) || isGeo(file.name))
}
