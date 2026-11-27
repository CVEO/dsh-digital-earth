/**
 * Persistence boundary: a GeoTIFF overlay survives a catalog save/restart.
 *
 * The client now hands the catalog an absolute tile URL; the host rewrites only
 * the process-token segment when it loads, because the cache identity lives in
 * fileKey/renderKey and must not change across restarts.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { TOKEN } from '../src/host/constants.js'
import { normalizeConfig } from '../src/host/sources.js'

const overlayUrl = (url) => ({ type: 'xyz', name: 'ortho', url, tilingScheme: 'geographic', maximumLevel: 12, opacity: 1 })

test('a saved GeoTIFF tile URL keeps its cache identity and refreshes the token', () => {
  const stale = 'http://127.0.0.1:1095/api/3dviewer/geotiff/OLDTOKEN/tiles/abc123/def456/{z}/{x}/{y}.png'
  const config = normalizeConfig({ rasterOverlays: [overlayUrl(stale)] })
  assert.equal(config.rasterOverlays.length, 1, 'the overlay is not dropped')
  assert.equal(
    config.rasterOverlays[0].url,
    `http://127.0.0.1:1095/api/3dviewer/geotiff/${TOKEN}/tiles/abc123/def456/{z}/{x}/{y}.png`,
  )
})

test('a relative tile URL is still rejected (client must send an origin)', () => {
  const config = normalizeConfig({ rasterOverlays: [overlayUrl('/api/3dviewer/geotiff/t/tiles/a/b/{z}/{x}/{y}.png')] })
  assert.equal(config.rasterOverlays.length, 0)
})

test('the token is never copied into a non-loopback URL', () => {
  const remote = 'https://evil.example/api/3dviewer/geotiff/OLDTOKEN/tiles/a/b/{z}/{x}/{y}.png'
  const config = normalizeConfig({ rasterOverlays: [overlayUrl(remote)] })
  assert.equal(config.rasterOverlays.length, 1)
  assert.equal(config.rasterOverlays[0].url, remote, 'external URL must not receive the host token')
  assert.ok(!config.rasterOverlays[0].url.includes(TOKEN))
})

test('unrelated xyz URLs are left exactly as written', () => {
  const url = 'https://example.com/tiles/{z}/{x}/{y}.png'
  const config = normalizeConfig({ rasterOverlays: [overlayUrl(url)] })
  assert.equal(config.rasterOverlays[0].url, url)
})
