/**
 * host/geotiff/tiling.js — geographic (EPSG:4326) XYZ tiling for published rasters.
 *
 * The panel already speaks XYZ, so a published GeoTIFF is just another
 * `{z}/{x}/{y}.png` layer. We deliberately use Cesium's GeographicTilingScheme
 * (two tiles wide at level 0, Y from the north) instead of Web Mercator: imagery
 * in projected metres (UTM) reprojects once here, and the globe never has to
 * guess a tiling scheme per layer.
 */

/** Bounding box of one geographic tile, in degrees. */
export function tileBounds(z, x, y) {
  // Cesium's GeographicTilingScheme: two 180°×180° root tiles, equally split
  // at every level below (column count 2^(z+1), row count 2^z).
  const span = 180 / 2 ** z
  return {
    west: -180 + x * span,
    east: -180 + (x + 1) * span,
    north: 90 - y * span,
    south: 90 - (y + 1) * span,
  }
}

/** Tiles of one level that intersect a footprint. */
export function tilesForLevel(level, bbox) {
  // Cesium's GeographicTilingScheme: level 0 is two 180°×180° tiles, so the
  // column count is 2^(z+1) while the row count is 2^z.
  const span = 180 / 2 ** level
  const countX = 2 ** (level + 1)
  const countY = 2 ** level
  const xMin = Math.max(0, Math.min(countX - 1, Math.floor((bbox.west + 180) / span)))
  const xMax = Math.max(0, Math.min(countX - 1, Math.floor((bbox.east - 1e-9 + 180) / span)))
  const yMin = Math.max(0, Math.min(countY - 1, Math.floor((90 - bbox.north) / span)))
  const yMax = Math.max(0, Math.min(countY - 1, Math.floor((90 - bbox.south - 1e-9) / span)))
  const tiles = []
  for (let y = yMin; y <= yMax; y += 1) {
    for (let x = xMin; x <= xMax; x += 1) tiles.push({ z: level, x, y })
  }
  return tiles
}

/**
 * Plan the pyramid: levels 0..N covering the footprint, stopping when the tile
 * resolution reaches the source resolution (or when the tile count would explode).
 *
 * @param {{bbox:object,gsd:{x:number,y:number}}} geo
 * @param {{width:number,height:number}} reader
 */
export function planPyramid(geo, reader, { maxLevel = 18, maxTiles = 12000, tileSize = 256 } = {}) {
  const levels = []
  let total = 0
  let capped = false
  const width = reader.width
  const height = reader.height
  const lonSpanDeg = Math.max(1e-9, geo.bbox.east - geo.bbox.west)
  const latSpanDeg = Math.max(1e-9, geo.bbox.north - geo.bbox.south)
  for (let z = 0; z <= maxLevel; z += 1) {
    const tiles = tilesForLevel(z, geo.bbox)
    if (tiles.length === 0) break
    // Ground resolution of one tile pixel at this level, in metres.
    const lonPerPixel = (180 / 2 ** z) / tileSize
    const latPerPixel = lonPerPixel
    const midLat = (geo.bbox.north + geo.bbox.south) / 2
    const groundX = lonPerPixel * 111320 * Math.cos((midLat * Math.PI) / 180)
    const groundY = latPerPixel * 110574
    const sourceX = lonSpanDeg === 0 ? 0 : (lonSpanDeg * 111320 * Math.cos((midLat * Math.PI) / 180)) / width
    const sourceY = (latSpanDeg * 110574) / height
    levels.push({ z, tiles, groundX, groundY, resolutionReached: groundX <= sourceX && groundY <= sourceY })
    total += tiles.length
    if (total > maxTiles) {
      // Trim the level that pushed us over, then stop; the panel shows the cap.
      levels.pop()
      total -= tiles.length
      capped = true
      break
    }
    if (groundX <= sourceX * 0.75 && groundY <= sourceY * 0.75) break
  }
  const maxZ = levels.length > 0 ? levels[levels.length - 1].z : 0
  if (maxZ >= maxLevel) capped = true
  const resolutionReached = levels.length > 0 && levels[levels.length - 1].resolutionReached === true
  return { levels, total, maxLevel: maxZ, capped, resolutionReached }
}
