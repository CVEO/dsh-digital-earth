/**
 * host/geotiff/crs.js — GeoTIFF georeference → WGS84.
 *
 * The raster side only needs three answers: where the image is on the globe, how
 * big one pixel is, and how to convert a lon/lat tile corner back into source
 * pixel coordinates. That is a small, closed set of projections:
 *
 *   geographic (EPSG:4326/4269/4267/4258)   degrees, lon/lat
 *   Web Mercator (EPSG:3857/900913)         analytic inverse
 *   WGS84 UTM north/south (EPSG:326xx/327xx) analytic inverse
 *
 * Anything else is rejected with the EPSG code and a readable next step instead
 * of silently placing the image somewhere it does not belong — a wrong-CRS
 * orthophoto is worse than no orthophoto.
 */
import { TiffError } from './tiff.js'

const A = 6378137
const F = 1 / 298.257223563
const E2 = F * (2 - F)
const K0 = 0.9996

const GEOGRAPHIC_EPSG = new Set([4326, 4269, 4267, 4258, 4979])

/** Geographic names for the panel; unknown codes stay readable as "EPSG:n". */
const NAMES = {
  4326: 'WGS 84',
  4269: 'NAD83',
  4267: 'NAD27',
  4258: 'ETRS89',
  3857: 'Web Mercator',
  900913: 'Web Mercator',
}

/** Inverse WGS84 UTM (easting/northing metres → lon/lat degrees). */
function utmToLonLat(easting, northing, zone, south) {
  const x = easting - 500000
  const y = south ? northing - 10000000 : northing
  const m = y / K0
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256))
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
  const sinPhi = Math.sin(phi1)
  const cosPhi = Math.cos(phi1)
  const tanPhi = Math.tan(phi1)
  const n1 = A / Math.sqrt(1 - E2 * sinPhi * sinPhi)
  const t1 = tanPhi * tanPhi
  const c1 = (E2 / (1 - E2)) * cosPhi * cosPhi
  const r1 = (A * (1 - E2)) / (1 - E2 * sinPhi * sinPhi) ** 1.5
  const d = x / (n1 * K0)
  const lat =
    phi1 -
    ((n1 * tanPhi) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * (E2 / (1 - E2))) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * (E2 / (1 - E2)) - 3 * c1 * c1) * d ** 6) / 720)
  const lon =
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * (E2 / (1 - E2)) + 24 * t1 * t1) * d ** 5) / 120) /
    cosPhi
  return {
    lon: ((zone - 1) * 6 - 180 + 3 + (lon * 180) / Math.PI + 540) % 360 - 180,
    lat: (lat * 180) / Math.PI,
  }
}

/** Inverse Web Mercator (metres → lon/lat degrees). */
function mercatorToLonLat(x, y) {
  const lon = (x / A) * (180 / Math.PI)
  const lat = (2 * Math.atan(Math.exp(y / A)) - Math.PI / 2) * (180 / Math.PI)
  return { lon, lat }
}

/**
 * Forward transform lon/lat → source CRS, used to turn a tile's geographic
 * footprint into a source pixel window.
 */
function utmFromLonLat(lon, lat, zone, south) {
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180
  const lonOrigin = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180
  const ep2 = E2 / (1 - E2)
  const n = A / Math.sqrt(1 - E2 * Math.sin(latRad) ** 2)
  const t = Math.tan(latRad) ** 2
  const c = ep2 * Math.cos(latRad) ** 2
  const a = Math.cos(latRad) * (lonRad - lonOrigin)
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256) * latRad -
      ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * latRad) +
      ((15 * E2 * E2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * latRad) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * latRad))
  const easting =
    K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * a ** 5) / 120) + 500000
  let northing =
    K0 *
    (m +
      n *
        Math.tan(latRad) *
        ((a * a) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * a ** 6) / 720))
  if (south) northing += 10000000
  return { x: easting, y: northing }
}

function mercatorFromLonLat(lon, lat) {
  return { x: (lon * Math.PI * A) / 180, y: A * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) }
}

/**
 * @param {object} reader result of openTiff()
 * @returns {{ kind:'geographic'|'projected'|'mercator'|'utm', epsg:number, name:string,
 *   units:'deg'|'m', zone?:number, south?:boolean, bbox:{west,south,east,north},
 *   gsd:{x:number,y:number}, toLonLat:(x:number,y:number)=>{lon:number,lat:number},
 *   fromLonLat:(lon:number,lat:number)=>{x:number,y:number} }}
 */
export function describeGeo(reader) {
  const tiepoint = reader.tiepoint ?? []
  const scale = reader.pixelScale ?? []
  const matrix = reader.transformation ?? []
  const geokeys = reader.geokeys ?? {}
  const key = (id) => geokeys[id]?.value
  const projected = key(3072)
  const geographic = key(2048) ?? key(2049)

  const hasTiepoint = tiepoint.length >= 6
  const hasMatrix = matrix.length >= 16
  if (!hasTiepoint && !hasMatrix) {
    // CRS keys alone only name the datum; they do not say where the image sits.
    throw new TiffError(
      'georef',
      'This TIFF has no geographic reference (missing ModelTiepoint/ModelTransformation). If it is an RPC satellite scene, rectify it first; otherwise export a GeoTIFF from QGIS.',
    )
  }
  if (hasTiepoint && scale.length >= 2 && (!(scale[0] > 0) || !(scale[1] > 0))) {
    throw new TiffError('georef', 'GeoTIFF pixel scale is missing or negative')
  }

  const affine =
    matrix.length >= 16
      ? {
          toModel: (col, row) => ({ x: matrix[0] * col + matrix[1] * row + matrix[3], y: matrix[4] * col + matrix[5] * row + matrix[7] }),
          toPixel: (x, y) => {
            const det = matrix[0] * matrix[5] - matrix[1] * matrix[4]
            if (Math.abs(det) < 1e-12) return null
            const dx = x - matrix[3]
            const dy = y - matrix[7]
            return { col: (matrix[5] * dx - matrix[1] * dy) / det, row: (-matrix[4] * dx + matrix[0] * dy) / det }
          },
        }
      : (() => {
          const [i0, j0, , x0, y0] = tiepoint.length >= 6 ? tiepoint : [0, 0, 0, 0, 0]
          const sx = scale[0] ?? 1
          // GeoTIFF pixel scale is positive with Y increasing southwards.
          const sy = -(scale[1] ?? 1)
          return {
            toModel: (col, row) => ({ x: x0 + (col - i0) * sx, y: y0 + (row - j0) * sy }),
            toPixel: (x, y) => ({ col: i0 + (x - x0) / sx, row: j0 + (y - y0) / sy }),
          }
        })()

  let kind
  let epsg
  let zone
  let south = false
  if (projected) {
    epsg = projected
    if (projected === 3857 || projected === 900913) kind = 'mercator'
    else if (projected >= 32601 && projected <= 32660) {
      kind = 'utm'
      zone = projected - 32600
    } else if (projected >= 32701 && projected <= 32760) {
      kind = 'utm'
      zone = projected - 32700
      south = true
    } else {
      throw new TiffError(
        'crs',
        `Projected CRS EPSG:${projected} is not supported yet. Reproject to EPSG:4326 / 3857 / WGS84 UTM in QGIS, or publish an XYZ tile set elsewhere.`,
        { epsg: projected },
      )
    }
  } else {
    epsg = geographic ?? 4326
    if (!GEOGRAPHIC_EPSG.has(epsg)) {
      throw new TiffError(
        'crs',
        `Geographic CRS EPSG:${epsg} is not recognised; export to EPSG:4326 or a WGS84 UTM zone.`,
        { epsg },
      )
    }
    kind = 'geographic'
  }

  const toLonLat =
    kind === 'geographic'
      ? (x, y) => ({ lon: x, lat: y })
      : kind === 'mercator'
        ? mercatorToLonLat
        : (x, y) => utmToLonLat(x, y, zone, south)
  const fromLonLat =
    kind === 'geographic'
      ? (lon, lat) => ({ x: lon, y: lat })
      : kind === 'mercator'
        ? mercatorFromLonLat
        : (lon, lat) => utmFromLonLat(lon, lat, zone, south)

  const corners = [
    affine.toModel(0, 0),
    affine.toModel(reader.width, 0),
    affine.toModel(reader.width, reader.height),
    affine.toModel(0, reader.height),
  ].map((point) => toLonLat(point.x, point.y))
  const lons = corners.map((point) => point.lon)
  const lats = corners.map((point) => point.lat)
  const bbox = {
    west: Math.max(-180, Math.min(...lons)),
    east: Math.min(180, Math.max(...lons)),
    south: Math.max(-90, Math.min(...lats)),
    north: Math.min(90, Math.max(...lats)),
  }
  if (!(bbox.east > bbox.west) || !(bbox.north > bbox.south)) {
    throw new TiffError('georef', 'GeoTIFF georeference is degenerate (zero-size footprint)')
  }
  const center = toLonLat(affine.toModel(reader.width / 2, reader.height / 2).x, affine.toModel(reader.width / 2, reader.height / 2).y)
  const pixelSize =
    matrix.length >= 16
      ? { x: Math.hypot(matrix[0], matrix[4]), y: Math.hypot(matrix[1], matrix[5]) }
      : { x: Math.abs(scale[0] ?? 0), y: Math.abs(scale[1] ?? 0) }
  const unitPerPixel = kind === 'geographic' ? null : Math.hypot(pixelSize.x, pixelSize.y) / Math.SQRT2
  const gsd = {
    x: kind === 'geographic' ? pixelSize.x * 111320 * Math.cos((center.lat * Math.PI) / 180) : unitPerPixel ?? 0,
    y: kind === 'geographic' ? pixelSize.y * 110574 : unitPerPixel ?? 0,
  }
  return {
    kind,
    epsg,
    name: NAMES[epsg] ?? (kind === 'utm' ? `WGS 84 / UTM ${zone}${south ? 'S' : 'N'}` : `EPSG:${epsg}`),
    units: kind === 'geographic' ? 'deg' : 'm',
    zone,
    south,
    bbox,
    gsd,
    affine,
    toLonLat,
    fromLonLat,
    /** Source pixel of a WGS84 coordinate, or null when the CRS cannot invert it. */
    pixelOf(lon, lat) {
      const model = fromLonLat(lon, lat)
      const pixel = affine.toPixel(model.x, model.y)
      return pixel && Number.isFinite(pixel.col) && Number.isFinite(pixel.row) ? pixel : null
    },
  }
}
