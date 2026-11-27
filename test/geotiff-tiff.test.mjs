/**
 * Reader-level regression tests: the code paths a real ortho exercises but the
 * strip-based probe tests never touch (tiles, big-endian predictor, truncated
 * files, block-cache pressure, pyramid caps).
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { openTiff, TiffError } from '../src/host/geotiff/tiff.js'
import { planPyramid } from '../src/host/geotiff/tiling.js'
import { makeGeotiff } from './helpers/tiff-fixture.mjs'

const sourceOf = (buffer) => ({
  size: buffer.length,
  read: async (offset, length) => buffer.subarray(offset, offset + length),
})

test('tiled TIFF: a window survives block-cache eviction without NaN holes', async () => {
  const size = 512
  const buffer = makeGeotiff({
    width: size,
    height: size,
    samples: 3,
    tileSize: 128,
    pixel: (x, y, band) => (x + y + band * 40) % 256,
    geo: { epsg: 4326, pixelSize: [0.0001, 0.0001], origin: [116.3, 39.9] },
  })
  // 512² RGB = 768 KB decoded; a 64 KB cache evicts blocks mid-window.
  const reader = await openTiff(sourceOf(buffer), { cacheLimit: 64 * 1024 })
  const sample = await reader.readWindow({ outWidth: 64, outHeight: 64 })
  assert.equal(sample.width, 64)
  for (const band of sample.bands) {
    assert.equal(band.some((value) => Number.isNaN(value)), false, 'no pixel may turn into NaN')
  }
  // Top-left 8× box average of (x + y + band*40) around (3.5, 3.5).
  // 8×8 box around (4,4) of (x + y + band*40).
  assert.ok(Math.abs(sample.bands[0][0] - 8) < 0.6, `band0 sample ${sample.bands[0][0]}`)
  assert.ok(Math.abs(sample.bands[2][0] - 88) < 0.6, `band2 sample ${sample.bands[2][0]}`)
  reader.close()
})

test('big-endian 16-bit predictor 2 decodes to the source values', async () => {
  const buffer = makeGeotiff({
    width: 64,
    height: 32,
    samples: 1,
    bits: 16,
    endian: 'MM',
    predictor: 2,
    pixel: (x, y) => (x * 501 + y * 33) % 65536,
    geo: { epsg: 4326, pixelSize: [0.001, 0.001], origin: [113, 31] },
  })
  const reader = await openTiff(sourceOf(buffer))
  assert.equal(reader.width, 64)
  const sample = await reader.readWindow({ outWidth: 64, outHeight: 32 })
  let mismatches = 0
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      if (sample.bands[0][y * 64 + x] !== (x * 501 + y * 33) % 65536) mismatches += 1
    }
  }
  assert.equal(mismatches, 0)
  reader.close()
})

test('32-bit samples with predictor 2 are restored exactly', async () => {
  const buffer = makeGeotiff({
    width: 16,
    height: 8,
    samples: 1,
    bits: 32,
    predictor: 2,
    pixel: (x, y) => 100000 + x * 7 - y * 3,
    geo: { epsg: 4326, pixelSize: [0.001, 0.001], origin: [113, 31] },
  })
  const reader = await openTiff(sourceOf(buffer))
  const sample = await reader.readWindow({ outWidth: 16, outHeight: 8 })
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      assert.equal(sample.bands[0][y * 16 + x], 100000 + x * 7 - y * 3, `32-bit predictor sample at ${x},${y}`)
    }
  }
  reader.close()
})

test('16-bit signed samples keep their sign and nodata value', async () => {
  const buffer = makeGeotiff({
    width: 32,
    height: 16,
    samples: 1,
    bits: 16,
    signed: true,
    pixel: (x, y) => -1000 + x * 10 - y * 3,
    geo: { epsg: 4326, pixelSize: [0.001, 0.001], origin: [113, 31] },
  })
  const reader = await openTiff(sourceOf(buffer))
  const sample = await reader.readWindow({ outWidth: 32, outHeight: 16 })
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      assert.equal(sample.bands[0][y * 32 + x], -1000 + x * 10 - y * 3, `signed sample at ${x},${y}`)
    }
  }
  reader.close()
})

test('a truncated file is a TiffError, not a RangeError from Buffer', async () => {
  const full = makeGeotiff({
    width: 32,
    height: 16,
    samples: 3,
    pixel: (x, y, band) => x + y + band,
    geo: { epsg: 4326, pixelSize: [0.01, 0.01], origin: [120, 30] },
  })
  // Cut inside the IFD: the directory declares 12 bytes per entry it cannot read.
  await assert.rejects(
    () => openTiff(sourceOf(full.subarray(0, 24))),
    (error) => error instanceof TiffError && (error.code === 'truncated' || error.code === 'corrupt'),
  )
})

test('a corrupt block byte count is refused instead of allocating the file', async () => {
  const buffer = makeGeotiff({
    width: 16,
    height: 16,
    samples: 1,
    pixel: (x, y) => x + y,
    geo: { epsg: 4326, pixelSize: [0.01, 0.01], origin: [120, 30] },
  })
  const reader = await openTiff(sourceOf(buffer))
  // Pretend the single strip points past EOF.
  const target = Buffer.from(buffer)
  const entry = findTag(target, 273)
  target.writeUInt32LE(target.length + 4096, entry + 8)
  const broken = await openTiff(sourceOf(target))
  await assert.rejects(
    () => broken.readWindow({ outWidth: 8, outHeight: 8 }),
    (error) => error instanceof TiffError && error.code === 'corrupt',
  )
})

test('pyramid caps are reported, including a maxLevel that is reached', async () => {
  const geo = { bbox: { west: 113, south: 31, east: 114, north: 32 }, gsd: { x: 0.05, y: 0.05 } }
  const reader = { width: 50_000, height: 50_000 }
  const fine = planPyramid(geo, reader, { maxLevel: 18, maxTiles: 1_000_000 })
  assert.equal(fine.capped, false)
  assert.ok(fine.maxLevel <= 18)

  const capped = planPyramid(geo, reader, { maxLevel: 18, maxTiles: 40 })
  assert.equal(capped.capped, true, 'a trimmed level must be reported')

  const limited = planPyramid(geo, reader, { maxLevel: 2, maxTiles: 1_000_000 })
  assert.equal(limited.capped, true, 'stopping at maxLevel must be reported')
})

/** Address of the IFD entry value slot for `tag` (classic little-endian TIFF). */
function findTag(buffer, tag) {
  const ifd = buffer.readUInt32LE(4)
  const count = buffer.readUInt16LE(ifd)
  for (let index = 0; index < count; index += 1) {
    const at = ifd + 2 + index * 12
    if (buffer.readUInt16LE(at) === tag) return at
  }
  throw new Error(`tag ${tag} not found`)
}
