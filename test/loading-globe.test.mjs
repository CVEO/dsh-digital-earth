import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGlobeProjection, renderGlobePixels } from '../src/client/ui/loading-globe-renderer.js'

test('loading globe projects a circle with transparent corners and visible cardinal edges', () => {
  const projection = buildGlobeProjection(80, 512, 256)
  const alpha = (pixelX, pixelY) => projection.pixels[(pixelY * 80 + pixelX) * 4 + 3]
  assert.equal(alpha(0, 0), 0)
  assert.equal(alpha(79, 79), 0)
  assert.equal(alpha(40, 40), 255)
  assert.ok(alpha(40, 0) > 0)
  assert.ok(alpha(0, 40) > 0)
  assert.equal(alpha(40, 0), alpha(40, 79))
  assert.equal(alpha(0, 40), alpha(79, 40))
})

test('loading globe uses finite spherical coordinates within the texture latitude range', () => {
  const projection = buildGlobeProjection(80, 512, 256)
  for (let index = 0; index < 80 * 80; index++) {
    if (!projection.pixels[index * 4 + 3]) continue
    assert.ok(Number.isFinite(projection.longitude[index]))
    assert.ok(projection.latitude[index] >= 0 && projection.latitude[index] <= 255)
  }
})

test('loading globe turns through different continents and loops without a jump', () => {
  const texture = new Uint8ClampedArray(32 * 16 * 4)
  for (let index = 0; index < 32 * 16; index++) texture[index * 4] = index % 32 < 16 ? 255 : 0
  const projection = buildGlobeProjection(40, 32, 16)
  const initial = renderGlobePixels(projection, texture, 0).slice()
  const halfTurn = renderGlobePixels(projection, texture, 12000).slice()
  assert.notDeepEqual(initial, halfTurn)
  assert.deepEqual(initial, renderGlobePixels(projection, texture, 24000))
  for (let index = 3; index < initial.length; index += 4) assert.equal(initial[index], halfTurn[index])
})
