import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Cesium from '../vendor/cesium/index.js'
import { cachedElevationRange, sampleElevationRange } from '../src/client/shader/elevation-range.js'
import { shaderHeightRange, shaderUniforms } from '../src/client/shader/presets.js'

test('高程适配只接受目标图层的可见表面，并将范围用于实际着色', async () => {
  const tileset = { boundingSphere: new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(113.14, 31.02, 80), 500) }
  let probes = 0
  const viewer = { scene: { pickPositionSupported: true, canvas: { clientWidth: 800, clientHeight: 600 },
    pick: () => ({ primitive: ++probes <= 2 ? {} : tileset }),
    pickPosition: () => Cesium.Cartesian3.fromDegrees(113.14, 31.02, 75 + probes),
  } }
  const previousFrame = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = (resolve) => setTimeout(resolve, 0)
  try {
    const range = await sampleElevationRange(Cesium, viewer, tileset)
    assert.equal(range.count, 14)
    assert.ok(range.minimum < 78 && range.maximum > 91)
    assert.ok(range.maximum - range.minimum < 20)
    assert.equal(cachedElevationRange(tileset), range)
    const applied = shaderHeightRange(Cesium, tileset)
    assert.equal(applied.minimum, range.minimum)
    assert.equal(applied.maximum, range.maximum)
    assert.equal(await sampleElevationRange(Cesium, viewer, {}, AbortSignal.abort()), null)
  } finally { globalThis.requestAnimationFrame = previousFrame }
})

test('高程采样不足不写入虚假范围，水波与水深叠加时使用同一水位', async () => {
  const tileset = {}
  const previousFrame = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = (resolve) => setTimeout(resolve, 0)
  try {
    const scene = { pickPositionSupported: true, canvas: {clientWidth: 800, clientHeight: 600}, pick: () => null }
    assert.equal(await sampleElevationRange(Cesium, {scene}, tileset), null)
    assert.equal(cachedElevationRange(tileset), null)
  } finally { globalThis.requestAnimationFrame = previousFrame }
  const range = {center: Cesium.Cartesian3.UNIT_X, centerHeight: 0, minimum: 0, maximum: 100}
  assert.equal(shaderUniforms(Cesium, 'water', {}, range).u_waterMask.value, 0)
  const masked = shaderUniforms(Cesium, ['water', 'water-depth'], {water_height: 84}, range)
  assert.equal(masked.u_waterMask.value, 1)
  assert.equal(masked.u_waterHeight.value, 84)
})
