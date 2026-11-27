/**
 * host/geotiff/cache.js — cache keys and directories for published GeoTIFF tiles.
 *
 * A published raster is keyed by (file identity, render settings):
 *
 *   <cache>/<fileKey>/meta.json              probe + footprint of the source
 *   <cache>/<fileKey>/v-<renderKey>/tiles/z/x/y.png
 *   <cache>/<fileKey>/v-<renderKey>/preview.png
 *
 * `<fileKey>` is a hash of path + size + mtime, so editing the source file in
 * QGIS invalidates the cache without touching a single tile, and re-publishing
 * with different bands/stretch writes a sibling `v-…` directory instead of
 * overwriting the previous look.
 */
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { GEOTIFF_CACHE_DIR } from '../constants.js'

export class CacheError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'CacheError'
    this.code = code
  }
}

const sha1 = (text) => createHash('sha1').update(text).digest('hex')

/** Stable identity of a source file; a replaced file gets a new cache entry. */
export function fileKeyFor({ path, size, mtimeMs }) {
  return sha1(`${path}|${size}|${Math.round(mtimeMs)}`).slice(0, 16)
}

/** Stable identity of a render setting, order-insensitive for the fields we keep. */
export function renderKeyFor(render) {
  const bands = Array.isArray(render?.bands) ? render.bands.join(',') : ''
  const stretch = render?.stretch ?? {}
  // v1 = 256 px geographic pyramid; bump it when tiling/pixel encoding changes.
  return sha1(
    JSON.stringify([
      'v1',
      256,
      bands,
      stretch.mode ?? '',
      stretch.lo ?? '',
      stretch.hi ?? '',
      stretch.min ?? '',
      stretch.max ?? '',
      render?.gamma ?? 1,
      render?.colormap ?? '',
    ]),
  ).slice(0, 8)
}

export function cachePaths({ cacheDir = GEOTIFF_CACHE_DIR, fileKey, renderKey }) {
  if (!/^[0-9a-f]{8,64}$/.test(fileKey)) throw new CacheError('bad_key', 'invalid geotiff cache key')
  const root = join(cacheDir, fileKey)
  const renderDir = renderKey ? join(root, `v-${renderKey}`) : root
  return {
    root,
    metaFile: join(root, 'meta.json'),
    renderDir,
    tilesDir: join(renderDir, 'tiles'),
    previewFile: join(renderDir, 'preview.png'),
  }
}

export async function readMeta(paths) {
  try {
    return JSON.parse(await fs.readFile(paths.metaFile, 'utf8'))
  } catch {
    return null
  }
}

export async function writeMeta(paths, meta) {
  await fs.mkdir(paths.root, { recursive: true })
  await fs.writeFile(paths.metaFile, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

/** Directory size in bytes, for the settings pane's "cache usage" readout. */
export async function cacheUsage(cacheDir = GEOTIFF_CACHE_DIR) {
  let bytes = 0
  let entries = 0
  const walk = async (dir) => {
    let list
    try {
      list = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const item of list) {
      const full = join(dir, item.name)
      if (item.isDirectory()) await walk(full)
      else {
        try {
          bytes += (await fs.stat(full)).size
          entries += 1
        } catch {
          // A tile can be deleted mid-scan; usage is advisory.
        }
      }
    }
  }
  await walk(cacheDir)
  return { bytes, entries }
}

/** Remove every published raster (the settings pane asks before calling this). */
export async function clearCache(cacheDir = GEOTIFF_CACHE_DIR) {
  await fs.rm(cacheDir, { recursive: true, force: true })
}
