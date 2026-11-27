/**
 * loadSources must rebase the nested `{config, defaults}` envelope, not the
 * envelope itself. The host token rewrite is covered in geotiff-persist.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSources } from '../src/client/api.js'

test('a saved local GeoTIFF overlay follows the current page origin', async (t) => {
  const realFetch = globalThis.fetch
  const realLocation = globalThis.location
  t.after(() => {
    globalThis.fetch = realFetch
    if (realLocation === undefined) delete globalThis.location
    else globalThis.location = realLocation
  })
  globalThis.location = { href: 'http://127.0.0.1:1096/index.html', protocol: 'http:', host: '127.0.0.1:1096' }
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        config: {
          rasterOverlays: [
            { type: 'xyz', name: 'ortho', url: 'http://127.0.0.1:1095/api/3dviewer/geotiff/tok/tiles/a/b/{z}/{x}/{y}.png' },
          ],
        },
        defaults: { rasterOverlays: [] },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )

  const payload = await loadSources({ sourcesUrl: '/api/3dviewer/sources' })
  assert.equal(
    payload.config.rasterOverlays[0].url,
    'http://127.0.0.1:1096/api/3dviewer/geotiff/tok/tiles/a/b/{z}/{x}/{y}.png',
  )
  assert.deepEqual(payload.defaults, { rasterOverlays: [] })
})

test('a remote URL that looks like a GeoTIFF route keeps its origin', async (t) => {
  const realFetch = globalThis.fetch
  const realLocation = globalThis.location
  t.after(() => {
    globalThis.fetch = realFetch
    if (realLocation === undefined) delete globalThis.location
    else globalThis.location = realLocation
  })
  globalThis.location = { href: 'http://127.0.0.1:1096/index.html', protocol: 'http:', host: '127.0.0.1:1096' }
  const remote = 'https://evil.example/api/3dviewer/geotiff/tok/tiles/a/b/{z}/{x}/{y}.png'
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ config: { rasterOverlays: [{ type: 'xyz', url: remote }] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  const payload = await loadSources({ sourcesUrl: '/api/3dviewer/sources' })
  assert.equal(payload.config.rasterOverlays[0].url, remote)
})

test('a non-GeoTIFF xyz URL keeps its origin', async (t) => {
  const realFetch = globalThis.fetch
  const realLocation = globalThis.location
  t.after(() => {
    globalThis.fetch = realFetch
    if (realLocation === undefined) delete globalThis.location
    else globalThis.location = realLocation
  })
  globalThis.location = { href: 'http://127.0.0.1:1096/index.html', protocol: 'http:', host: '127.0.0.1:1096' }
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ config: { rasterOverlays: [{ type: 'xyz', url: 'https://example.com/{z}/{x}/{y}.png' }] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  const payload = await loadSources({ sourcesUrl: '/api/3dviewer/sources' })
  assert.equal(payload.config.rasterOverlays[0].url, 'https://example.com/{z}/{x}/{y}.png')
})
