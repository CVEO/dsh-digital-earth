/**
 * WP5: publish a GeoTIFF as a geographic XYZ pyramid, resume, cancel, queue.
 *
 * The pyramid is the layer the panel actually loads, so these tests check the
 * files on disk (meta, preview, tiles) and the job semantics the dialog polls,
 * not just the returned counters.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { publishGeotiff, readPublishedMeta } from '../src/host/geotiff/publish.js'
import { probeGeotiff } from '../src/host/geotiff/probe.js'
import { createGeotiffJobs } from '../src/host/geotiff/jobs.js'
import { makeGeotiff } from './helpers/tiff-fixture.mjs'

const scratch = async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-geotiff-pub-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47])

const writeRaster = async (dir) => {
  const file = join(dir, 'ortho.tif')
  await writeFile(
    file,
    makeGeotiff({
      width: 64,
      height: 64,
      samples: 3,
      pixel: (x, y, band) => 24 + x * 3 + y + band * 30,
      geo: { epsg: 4326, pixelSize: [0.002, 0.002], origin: [113.0, 31.0] },
    }),
  )
  return file
}

const walkTiles = async (dir) => {
  const found = []
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else found.push(full)
    }
  }
  await walk(dir).catch(() => {})
  return found
}

test('publish: writes meta, preview and PNG tiles that cover the footprint', async (t) => {
  const dir = await scratch(t)
  const file = await writeRaster(dir)
  const cacheDir = join(dir, 'cache')
  const progress = []

  const result = await publishGeotiff({ filePath: file, cacheDir, onProgress: (entry) => progress.push(entry) })
  assert.equal(result.canceled, false)
  assert.ok(result.done > 0)
  assert.equal(result.done, result.total)
  assert.ok(progress.length > 0)
  assert.equal(progress.at(-1).total, result.total)

  // The dialog previews with the probe's keys and then loads publish's tiles;
  // if these diverged the preview would 404 on the finished pyramid.
  const probe = await probeGeotiff(file)
  assert.equal(probe.fileKey, result.fileKey)
  assert.equal(probe.renderKey, result.renderKey)

  const meta = await readPublishedMeta({ cacheDir, fileKey: result.fileKey })
  assert.equal(meta.name, 'ortho')
  assert.equal(meta.crs.epsg, 4326)
  assert.equal(meta.tileSize, 256)
  assert.equal(meta.tileCount, result.total)
  assert.ok(meta.levels.length > 0)
  assert.equal(meta.renderKey, result.renderKey)

  const preview = await readFile(join(cacheDir, result.fileKey, `v-${result.renderKey}`, 'preview.png'))
  assert.deepEqual(preview.subarray(0, 4), PNG_SIGNATURE)

  const tiles = await walkTiles(join(cacheDir, result.fileKey, `v-${result.renderKey}`, 'tiles'))
  assert.ok(tiles.length > 0, 'at least one tile covers the footprint')
  assert.ok(tiles.length <= result.total)
  const one = await readFile(tiles[0])
  assert.deepEqual(one.subarray(0, 4), PNG_SIGNATURE)
  assert.equal(one.readUInt32BE(16), 256, 'tiles are 256 px wide')
})

test('publish: a second run resumes and leaves finished tiles untouched', async (t) => {
  const dir = await scratch(t)
  const file = await writeRaster(dir)
  const cacheDir = join(dir, 'cache')

  const first = await publishGeotiff({ filePath: file, cacheDir })
  const tilesDir = join(cacheDir, first.fileKey, `v-${first.renderKey}`, 'tiles')
  const before = await walkTiles(tilesDir)
  const stamps = new Map()
  for (const tile of before) stamps.set(tile, (await stat(tile)).mtimeMs)

  await new Promise((resolve) => setTimeout(resolve, 20))
  const second = await publishGeotiff({ filePath: file, cacheDir })
  assert.equal(second.fileKey, first.fileKey)
  assert.equal(second.renderKey, first.renderKey)
  assert.equal(second.done, second.total)
  const after = await walkTiles(tilesDir)
  assert.equal(after.length, before.length, 'resume must not add or drop tiles')
  for (const tile of after) assert.equal((await stat(tile)).mtimeMs, stamps.get(tile), 'existing tiles are reused')
})

test('publish: an aborted signal stops early and keeps the low levels usable', async (t) => {
  const dir = await scratch(t)
  const file = await writeRaster(dir)
  const cacheDir = join(dir, 'cache')
  const controller = new AbortController()
  let seen = 0

  const result = await publishGeotiff({
    filePath: file,
    cacheDir,
    signal: controller.signal,
    onProgress: (entry) => {
      seen += 1
      if (entry.done >= 4) controller.abort()
    },
  })
  assert.equal(result.canceled, true)
  assert.ok(seen > 0)
  assert.ok(result.done < result.total)
  const tiles = await walkTiles(join(cacheDir, result.fileKey, `v-${result.renderKey}`, 'tiles'))
  assert.ok(tiles.length > 0, 'completed tiles survive a cancel')

  // The already-finished levels are exactly what the panel can show right away.
  const resumed = await publishGeotiff({ filePath: file, cacheDir })
  assert.equal(resumed.canceled, false)
  assert.equal(resumed.done, resumed.total)
})

test('jobs: one publish runs at a time, status carries progress, cancel works', async (t) => {
  const dir = await scratch(t)
  const file = await writeRaster(dir)
  const cacheDir = join(dir, 'cache')
  const jobs = createGeotiffJobs({ cacheDir })
  t.after(() => jobs.cancelAll?.())

  const job = jobs.start({ filePath: file })
  assert.equal(job.state, 'running')
  const known = jobs.status(job.id)
  assert.ok(known)
  assert.equal(known.filePath ?? undefined, undefined, 'public job does not leak the absolute path')

  const waited = await new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const current = jobs.status(job.id)
      if (current?.state === 'done') {
        clearInterval(timer)
        resolve(current)
      } else if (current?.state === 'failed') {
        clearInterval(timer)
        reject(new Error(current.error?.message ?? 'job failed'))
      }
    }, 25)
  })
  assert.equal(waited.state, 'done')
  assert.equal(waited.done, waited.total)
  assert.ok(waited.fileKey && waited.renderKey)
  assert.ok(waited.maxLevel >= 0)
})

test('jobs: a queued publish reports queued and can be canceled before it starts', async (t) => {
  const dir = await scratch(t)
  const file = await writeRaster(dir)
  const cacheDir = join(dir, 'cache')
  let release = null
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const jobs = createGeotiffJobs({
    cacheDir,
    publish: async () => {
      await gate
      return { canceled: true, done: 0, total: 1, fileKey: 'x', renderKey: 'y', meta: {} }
    },
  })

  const first = jobs.start({ filePath: file })
  const second = jobs.start({ filePath: file })
  assert.equal(jobs.busy, true)
  assert.equal(first.state, 'running')
  assert.equal(jobs.status(second.id).state, 'queued')

  const canceled = jobs.cancel(second.id)
  assert.equal(canceled.state, 'canceled')
  assert.equal(canceled.canceled, true)

  jobs.cancel(first.id)
  release()
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(jobs.status(first.id).state, 'canceled')
})

test('publish: a truncated tile from a crash is rewritten, not reused', async (t) => {
  const dir = await scratch(t)
  const raster = join(dir, 'ortho.tif')
  await writeFile(
    raster,
    makeGeotiff({
      width: 64,
      height: 64,
      samples: 3,
      pixel: (x, y, band) => (x + y + band * 30) % 256,
      geo: { epsg: 4326, pixelSize: [0.001, 0.001], origin: [113, 31] },
    }),
  )
  const cacheDir = join(dir, 'cache')
  const first = await publishGeotiff({ filePath: raster, cacheDir })
  const tilesRoot = join(cacheDir, first.fileKey, `v-${first.renderKey}`, 'tiles')
  const names = []
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else names.push(full)
    }
  }
  await walk(tilesRoot)
  const victim = names[0]
  // Signature intact, only 24 bytes: the old check accepted this as a tile.
  await writeFile(victim, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]))
  const preview = join(cacheDir, first.fileKey, `v-${first.renderKey}`, 'preview.png')
  await writeFile(preview, Buffer.from([0, 0]))

  const second = await publishGeotiff({ filePath: raster, cacheDir })
  assert.equal(second.renderKey, first.renderKey)
  const repaired = await readFile(victim)
  assert.deepEqual(repaired.subarray(0, 4), Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'tile was rewritten')
  assert.ok(repaired.length > 24, 'the fragment was replaced by a full PNG')
  const repairedPreview = await readFile(preview)
  assert.deepEqual(repairedPreview.subarray(0, 4), Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'preview was rewritten')
})

test('jobs: the queue refuses more live work than its cap', async () => {
  const { createGeotiffJobs } = await import('../src/host/geotiff/jobs.js')
  const never = () => new Promise(() => {})
  const jobs = createGeotiffJobs({ cacheDir: 'unused', publish: never, maxJobs: 1 })
  jobs.start({ filePath: 'C:/a.tif' })
  assert.throws(() => jobs.start({ filePath: 'C:/b.tif' }), (error) => error.code === 'too_many_jobs')
})
