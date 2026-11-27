/**
 * WP5: local GeoTIFF probe — CRS, bands, statistics and readable refusals.
 *
 * These tests write real (tiny) TIFFs with the shared fixture and read them back
 * through the production reader, so the fixture and the decoder have to agree on
 * offsets, compression, predictor and the GeoTIFF key directory.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { probeGeotiff, GeotiffProbeError } from '../src/host/geotiff/probe.js'
import { makeGeotiff } from './helpers/tiff-fixture.mjs'

const scratch = async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-geotiff-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

const ramp = (x, y, band) => 20 + x * 3 + y * 2 + band * 40

test('probe: geographic RGB GeoTIFF reports EPSG:4326, bbox, bands and a stretch', async (t) => {
  const dir = await scratch(t)
  const file = join(dir, 'ortho-4326.tif')
  await writeFile(
    file,
    makeGeotiff({ width: 32, height: 16, samples: 3, pixel: ramp, geo: { epsg: 4326, pixelSize: [0.01, 0.01], origin: [120, 30] } }),
  )

  const probe = await probeGeotiff(file)
  assert.equal(probe.width, 32)
  assert.equal(probe.height, 16)
  assert.equal(probe.bands, 3)
  assert.deepEqual(probe.bits, [8, 8, 8])
  assert.equal(probe.crs.epsg, 4326)
  assert.equal(probe.crs.kind, 'geographic')
  assert.ok(Math.abs(probe.bbox.west - 120) < 1e-9)
  assert.ok(Math.abs(probe.bbox.east - 120.32) < 1e-9)
  assert.ok(Number.isFinite(probe.gsd.x) && probe.gsd.x > 0)
  assert.equal(probe.stats.length, 3)
  for (const band of probe.stats) assert.ok(band.max > band.min)
  // The render plan is what the dialog shows and what GET preview caches.
  assert.deepEqual(probe.render.bands, [0, 1, 2])
  assert.ok(probe.pyramid.total > 0)
  assert.ok(probe.pyramid.maxLevel >= 0)
})

test('probe: 16-bit Deflate + predictor 2 decodes and keeps the value range', async (t) => {
  const dir = await scratch(t)
  const file = join(dir, 'dem-16bit.tif')
  await writeFile(
    file,
    makeGeotiff({
      width: 24,
      height: 24,
      samples: 1,
      bits: 16,
      compression: 'deflate',
      predictor: 2,
      pixel: (x, y) => 1000 + x * 137 + y * 11,
      geo: { epsg: 4326, pixelSize: [1 / 6000, 1 / 6000], origin: [113, 31] },
    }),
  )

  const probe = await probeGeotiff(file)
  assert.deepEqual(probe.bits, [16])
  assert.equal(probe.bands, 1)
  assert.equal(probe.stats[0].min, 1000)
  assert.equal(probe.stats[0].max, 1000 + 23 * 137 + 23 * 11)
  assert.deepEqual(probe.render.bands, [0])
})

test('probe: WGS84 UTM 50N is accepted and its bbox is converted to degrees', async (t) => {
  const dir = await scratch(t)
  const file = join(dir, 'ortho-utm.tif')
  await writeFile(
    file,
    makeGeotiff({
      width: 8,
      height: 8,
      samples: 1,
      pixel: () => 90,
      geo: { epsg: 32650, projected: true, pixelSize: [0.5, 0.5], origin: [500000, 3430000] },
    }),
  )

  const probe = await probeGeotiff(file)
  assert.equal(probe.crs.epsg, 32650)
  assert.equal(probe.crs.kind, 'utm')
  assert.equal(probe.crs.zone, 50)
  assert.equal(probe.crs.south, false)
  assert.ok(probe.bbox.west > 110 && probe.bbox.west < 125)
  assert.ok(probe.bbox.south > 25 && probe.bbox.south < 35)
  assert.ok(probe.bbox.east > probe.bbox.west)
})

test('probe refusals: JPEG2000, no georeference, foreign EPSG and JPEG name the next step', async (t) => {
  const dir = await scratch(t)
  const jp2 = join(dir, 'scene.jp2')
  await writeFile(jp2, Buffer.from('dummy'))
  await assert.rejects(
    probeGeotiff(jp2),
    (error) => error instanceof GeotiffProbeError && error.code === 'format' && /gdal_translate/.test(error.message),
    'JPEG2000 must be refused with a conversion hint',
  )

  const noGeo = join(dir, 'plain.tif')
  await writeFile(noGeo, makeGeotiff({ width: 8, height: 8, samples: 3, pixel: () => 128, geo: { noGeo: true } }))
  await assert.rejects(
    probeGeotiff(noGeo),
    (error) => error instanceof GeotiffProbeError && error.code === 'georef',
  )

  const wrongCrs = join(dir, 'osgb.tif')
  await writeFile(
    wrongCrs,
    makeGeotiff({ width: 8, height: 8, samples: 1, pixel: () => 1, geo: { epsg: 27700, projected: true, pixelSize: [2, 2], origin: [400000, 300000] } }),
  )
  await assert.rejects(
    probeGeotiff(wrongCrs),
    (error) => error instanceof GeotiffProbeError && error.code === 'crs' && error.message.includes('27700'),
    'an unsupported authority code must be named',
  )

  const jpeg = join(dir, 'photo.jpg')
  await writeFile(jpeg, Buffer.from('dummy'))
  await assert.rejects(probeGeotiff(jpeg), (error) => error instanceof GeotiffProbeError && error.code === 'format')
})
