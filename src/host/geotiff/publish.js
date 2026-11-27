/**
 * host/geotiff/publish.js — turn one GeoTIFF into a geographic XYZ pyramid.
 *
 * Work is ordered level 0 upward, tile by tile, and every finished tile is
 * written immediately: a cancelled or crashed job leaves a usable low-resolution
 * layer behind instead of nothing, and a re-run skips the tiles that already
 * exist (resume). The renderer is the same one used by the preview, so what the
 * dialog showed is what the tiles contain.
 *
 * A tile is only rendered where the image actually is (the tile rectangle is
 * clipped to the footprint first). Without that clip, an overview tile would
 * cover the whole world, sample the image every few kilometres, and show noise
 * or nothing at all.
 */
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { openTiffFile } from './tiff.js'
import { describeGeo } from './crs.js'
import { assertPublishable, computeStats, normalizeRender, renderPreview, renderRgba } from './render.js'
import { encodePng } from './png.js'
import { cachePaths, fileKeyFor, readMeta, renderKeyFor, writeMeta } from './cache.js'
import { planPyramid, tileBounds } from './tiling.js'
import { statGeotiff } from './probe.js'

const TILE_SIZE = 256
const PREVIEW_SIZE = 2048

/** Overlap of two geographic boxes, or null. */
export function intersectBounds(a, b) {
  const box = {
    west: Math.max(a.west, b.west),
    east: Math.min(a.east, b.east),
    north: Math.min(a.north, b.north),
    south: Math.max(a.south, b.south),
  }
  return box.east > box.west && box.north > box.south ? box : null
}

/** Source-pixel window of a geographic box, clamped to the image. */
export function sourceWindow(geo, reader, box) {
  const corners = [
    { lon: box.west, lat: box.north },
    { lon: box.east, lat: box.north },
    { lon: box.east, lat: box.south },
    { lon: box.west, lat: box.south },
  ].map((point) => geo.pixelOf(point.lon, point.lat))
  if (corners.some((pixel) => pixel === null)) return null
  const cols = corners.map((pixel) => pixel.col)
  const rows = corners.map((pixel) => pixel.row)
  const col = Math.max(0, Math.min(...cols))
  const row = Math.max(0, Math.min(...rows))
  const endCol = Math.min(reader.width, Math.max(...cols))
  const endRow = Math.min(reader.height, Math.max(...rows))
  if (!(endCol > col) || !(endRow > row)) return null
  return { col, row, width: endCol - col, height: endRow - row }
}

/**
 * Render one tile, or null when the image does not touch it.
 *
 * @returns {Promise<Uint8Array|null>} 256×256 RGBA
 */
export async function renderTile(reader, geo, render, bounds) {
  const clip = intersectBounds(bounds, geo.bbox)
  if (clip === null) return null
  const window = sourceWindow(geo, reader, clip)
  if (window === null) return null
  const tileLonSpan = bounds.east - bounds.west
  const tileLatSpan = bounds.north - bounds.south
  // Place the clipped footprint inside the 256×256 tile canvas.
  const fractionX = (clip.east - clip.west) / tileLonSpan
  const fractionY = (clip.north - clip.south) / tileLatSpan
  const outWidth = Math.max(1, Math.min(TILE_SIZE, Math.round(TILE_SIZE * fractionX)))
  const outHeight = Math.max(1, Math.min(TILE_SIZE, Math.round(TILE_SIZE * fractionY)))
  const offsetX = Math.max(0, Math.min(TILE_SIZE - outWidth, Math.round(((clip.west - bounds.west) / tileLonSpan) * TILE_SIZE)))
  const offsetY = Math.max(0, Math.min(TILE_SIZE - outHeight, Math.round(((bounds.north - clip.north) / tileLatSpan) * TILE_SIZE)))
  const sample = await reader.readWindow({
    col: window.col,
    row: window.row,
    width: window.width,
    height: window.height,
    outWidth,
    outHeight,
    bands: render.bands,
  })
  const rendered = renderRgba(reader, render, sample)
  if (outWidth === TILE_SIZE && outHeight === TILE_SIZE) return rendered
  const canvas = new Uint8Array(TILE_SIZE * TILE_SIZE * 4)
  for (let row = 0; row < outHeight; row += 1) {
    const from = row * outWidth * 4
    canvas.set(rendered.subarray(from, from + outWidth * 4), ((offsetY + row) * TILE_SIZE + offsetX) * 4)
  }
  return canvas
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_TRAILER = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
// Smallest valid PNG: signature + one IHDR chunk + one IEND chunk.
const PNG_MIN_BYTES = 8 + 25 + 12

/** Signature + IEND + minimum length: a fragment with a valid header is broken. */
export function validPngBytes(bytes) {
  return (
    bytes.length >= PNG_MIN_BYTES &&
    bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) &&
    bytes.subarray(bytes.length - PNG_TRAILER.length).equals(PNG_TRAILER)
  )
}

/** A crash can leave a zero-byte or half-written file behind; never reuse it. */
async function validPng(path) {
  let handle
  try {
    const stat = await fs.stat(path)
    if (stat.size < PNG_MIN_BYTES) return false
    handle = await fs.open(path, 'r')
    const head = Buffer.alloc(PNG_SIGNATURE.length)
    const tail = Buffer.alloc(PNG_TRAILER.length)
    const headRead = await handle.read(head, 0, head.length, 0)
    const tailRead = await handle.read(tail, 0, tail.length, stat.size - PNG_TRAILER.length)
    return headRead.bytesRead === head.length && head.equals(PNG_SIGNATURE) && tailRead.bytesRead === tail.length && tail.equals(PNG_TRAILER)
  } catch {
    return false
  } finally {
    await handle?.close().catch(() => {})
  }
}

async function writePngAtomic(target, bytes) {
  const temp = `${target}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`
  try {
    await fs.writeFile(temp, bytes)
    await fs.rename(temp, target)
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {})
    throw error
  }
}

/**
 * Publish (or resume) a GeoTIFF pyramid.
 *
 * @param {object} options
 * @param {string} options.filePath
 * @param {object} [options.render] render settings from the dialog; defaults fill unknown fields
 * @param {string} [options.cacheDir]
 * @param {AbortSignal} [options.signal]
 * @param {(progress:object)=>void} [options.onProgress]
 */
export async function publishGeotiff({ filePath, render: rawRender, cacheDir, signal, onProgress = () => {} }) {
  const stat = await statGeotiff(filePath)
  const fileKey = fileKeyFor({ path: filePath, size: stat.size, mtimeMs: stat.mtimeMs })
  const reader = await openTiffFile(filePath)
  try {
    assertPublishable(reader)
    const geo = describeGeo(reader)
    const stats = await computeStats(reader)
    const render = normalizeRender(reader, { ...(rawRender ?? {}), stats: stats.bands })
    render.stats = stats.bands
    const renderKey = renderKeyFor(render)
    const paths = cachePaths({ cacheDir, fileKey, renderKey })
    const plan = planPyramid(geo, reader, { tileSize: TILE_SIZE })
    const meta = {
      version: 1,
      path: filePath,
      name: (filePath.split(/[\\/]/).pop() ?? filePath).replace(/\.tiff?$/i, ''),
      fileKey,
      renderKey,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      width: reader.width,
      height: reader.height,
      bands: reader.samplesPerPixel,
      bits: reader.bits,
      compression: reader.compression,
      nodata: reader.nodata,
      crs: { kind: geo.kind, epsg: geo.epsg, name: geo.name, units: geo.units, zone: geo.zone ?? null, south: geo.south ?? false },
      bbox: geo.bbox,
      gsd: geo.gsd,
      stats: stats.bands,
      render,
      maxLevel: plan.maxLevel,
      levels: plan.levels.map((level) => level.z),
      tileCount: plan.total,
      tileSize: TILE_SIZE,
      capped: plan.capped,
    }
    await writeMeta(paths, meta)

    // A preview is cheap next to the pyramid and doubles as the dialog image.
    if (!(await validPng(paths.previewFile))) {
      const preview = await renderPreview(reader, geo, render, { maxSize: PREVIEW_SIZE })
      await fs.mkdir(paths.renderDir, { recursive: true })
      await writePngAtomic(paths.previewFile, encodePng(preview.width, preview.height, preview.rgba))
    }

    let done = 0
    const total = plan.total
    if (total > 0) onProgress({ state: 'running', done, total, level: 0, maxLevel: plan.maxLevel, readyLevel: -1 })
    for (const level of plan.levels) {
      for (const tile of level.tiles) {
        if (signal?.aborted) return { canceled: true, fileKey, renderKey, meta, done, total }
        const target = join(paths.tilesDir, String(tile.z), String(tile.x), `${tile.y}.png`)
        if (await validPng(target)) {
          done += 1
          continue
        }
        const canvas = await renderTile(reader, geo, render, tileBounds(tile.z, tile.x, tile.y))
        if (canvas !== null) {
          await fs.mkdir(dirname(target), { recursive: true })
          await writePngAtomic(target, encodePng(TILE_SIZE, TILE_SIZE, canvas))
        }
        done += 1
        onProgress({ state: 'running', done, total, level: level.z, maxLevel: plan.maxLevel, readyLevel: level.z })
      }
      onProgress({ state: 'running', done, total, level: level.z, maxLevel: plan.maxLevel, readyLevel: level.z, levelDone: true })
    }
    return { canceled: false, fileKey, renderKey, meta: { ...meta, done, total }, done, total }
  } finally {
    reader.close()
  }
}

/** Read a cached meta.json for a published key without re-opening the source. */
export async function readPublishedMeta({ cacheDir, fileKey }) {
  return readMeta(cachePaths({ cacheDir, fileKey }))
}
