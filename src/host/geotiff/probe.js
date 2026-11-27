/**
 * host/geotiff/probe.js — "what is this file?" without writing anything.
 *
 * The dialog needs an honest answer in a couple of seconds: footprint, CRS,
 * bands, sample depth, nodata, compression and a 2–98% stretch per band. It also
 * needs the *refusals* to be sentences a survey operator can act on (JPEG2000,
 * RPC-only scenes, unsupported EPSG), not stack traces.
 */
import { promises as fs } from 'node:fs'
import { extname, isAbsolute } from 'node:path'
import { openTiffFile, TiffError } from './tiff.js'
import { describeGeo } from './crs.js'
import { assertPublishable, computeStats, defaultRender, normalizeRender } from './render.js'
import { fileKeyFor, renderKeyFor } from './cache.js'

const REJECTED_EXT = new Map([
  ['.jp2', 'JPEG2000 (.jp2) is not supported; convert it to GeoTIFF once (gdal_translate -of GTiff input.jp2 output.tif) or use QGIS "Translate".'],
  ['.j2k', 'JPEG2000 (.j2k) is not supported; convert it to GeoTIFF first.'],
  ['.png', 'PNG has no georeference; export a GeoTIFF (or import the tile set as XYZ).'],
  ['.jpg', 'JPEG has no georeference; export a GeoTIFF instead.'],
])

export class GeotiffProbeError extends Error {
  constructor(code, message, detail = {}) {
    super(message)
    this.name = 'GeotiffProbeError'
    this.code = code
    this.detail = detail
  }
}

export function isGeotiffPath(filePath) {
  const ext = extname(String(filePath ?? '')).toLowerCase()
  return ext === '.tif' || ext === '.tiff'
}

/**
 * Validate a user-picked path. The panel header already proves the request came
 * from a user gesture; this check only rejects obviously unusable inputs early.
 */
export async function statGeotiff(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new GeotiffProbeError('bad_params', 'Missing file path')
  }
  if (!isAbsolute(filePath)) throw new GeotiffProbeError('bad_params', 'The path must be absolute')
  const ext = extname(filePath).toLowerCase()
  if (REJECTED_EXT.has(ext)) throw new GeotiffProbeError('format', REJECTED_EXT.get(ext))
  if (!isGeotiffPath(filePath)) {
    throw new GeotiffProbeError('format', `Unsupported file type "${ext || 'unknown'}"; expected .tif or .tiff`)
  }
  let stat
  try {
    stat = await fs.stat(filePath)
  } catch {
    throw new GeotiffProbeError('not_found', 'File not found; it may have been moved or renamed')
  }
  if (!stat.isFile()) throw new GeotiffProbeError('bad_params', 'The path is not a file')
  if (stat.size === 0) throw new GeotiffProbeError('corrupt', 'The file is empty')
  return stat
}

/**
 * Read one GeoTIFF's identity, CRS, statistics and pyramid plan.
 *
 * @returns {Promise<object>} serialisable probe payload (never includes pixels)
 */
export async function probeGeotiff(filePath) {
  const stat = await statGeotiff(filePath)
  const fileKey = fileKeyFor({ path: filePath, size: stat.size, mtimeMs: stat.mtimeMs })
  let reader
  try {
    reader = await openTiffFile(filePath)
  } catch (error) {
    if (error instanceof TiffError) throw new GeotiffProbeError(error.code, error.message, error.detail)
    throw error
  }
  try {
    let geo
    let stats
    try {
      assertPublishable(reader)
      geo = describeGeo(reader)
      stats = await computeStats(reader)
    } catch (error) {
      // A missing GeoTIFF key or a foreign EPSG is a property of the *file*, so it
      // belongs in the same probe error envelope as a missing file or bad format.
      if (error instanceof TiffError) throw new GeotiffProbeError(error.code, error.message, error.detail)
      throw error
    }
    const render = normalizeRender(reader, { ...defaultRender(reader), stats: stats.bands })
    const { planPyramid } = await import('./tiling.js')
    const pyramid = planPyramid(geo, reader)
    return {
      path: filePath,
      name: filePath.split(/[\\/]/).pop() ?? filePath,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      fileKey,
      renderKey: renderKeyFor(render),
      width: reader.width,
      height: reader.height,
      bands: reader.samplesPerPixel,
      bits: reader.bits,
      sampleFormat: reader.sampleFormat,
      photometric: reader.photometric,
      compression: reader.compression,
      tiled: reader.tiled,
      nodata: reader.nodata,
      crs: {
        kind: geo.kind,
        epsg: geo.epsg,
        name: geo.name,
        units: geo.units,
        zone: geo.zone ?? null,
        south: geo.south ?? false,
      },
      bbox: geo.bbox,
      gsd: geo.gsd,
      stats: stats.bands,
      render,
      pyramid: { levels: pyramid.levels.map((level) => level.z), total: pyramid.total, maxLevel: pyramid.maxLevel, capped: pyramid.capped },
    }
  } finally {
    reader.close()
  }
}
