/**
 * v1.6 S1-2 — the L3 raster-overlay stack.
 *
 * The basemap is one replaceable ImageryLayer; overlays are a separate ordered
 * stack above it (business rasters, WMS results, classification maps), each with
 * its own opacity and visibility. These tests cover the stack manager with a fake
 * imagery-layer collection, the host catalog normalization that persists it, and
 * the panel wiring (stack order, mount/save reconciliation, status reporting).
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

import { createOverlayLayers } from '../src/client/scene/overlay-layers.js'
import { clientSource } from './helpers/source.mjs'

const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-overlays-'))
process.env.DSH_HOME = home
const { normalizeConfig } = await import(new URL('../index.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

/** Minimal stand-in for Cesium.ImageryLayerCollection. */
function fakeViewer() {
  const layers = []
  const collection = {
    addImageryProvider(provider, index) {
      const layer = { provider, alpha: 1, show: true, destroyed: false }
      const at = index === undefined ? layers.length : index
      layers.splice(at, 0, layer)
      collection.length = layers.length
      return layer
    },
    remove(layer, destroy) {
      const index = layers.indexOf(layer)
      if (index >= 0) layers.splice(index, 1)
      if (destroy) layer.destroyed = true
      collection.length = layers.length
    },
    get(index) {
      return layers[index]
    },
    length: 0,
  }
  return { layers, scene: { imageryLayers: collection }, destroyed: false }
}

const source = (id, extra = {}) => ({
  id,
  name: id,
  type: 'wms',
  url: `https://example.test/${id}`,
  layers: 'layer',
  opacity: 0.6,
  visible: true,
  ...extra,
})

const providerFor = async (Cesium, item) => ({ url: item.url })

test('叠加图层：add 把图层加到堆栈顶部并应用透明度/显隐', async () => {
  const viewer = fakeViewer()
  const stack = createOverlayLayers({ Cesium: {}, viewer, providerFactory: providerFor })
  await stack.add(source('flood', { opacity: 0.4 }))
  await stack.add(source('class-2024'))
  assert.equal(stack.size(), 2)
  assert.equal(viewer.layers.length, 2)
  assert.equal(viewer.layers[0].alpha, 0.4)
  assert.equal(viewer.layers[0].show, true)
  assert.equal(viewer.layers[1].alpha, 0.6)
  assert.deepEqual(
    stack.list().map((item) => item.id),
    ['flood', 'class-2024'],
  )
})

test('叠加图层：sync 幂等——同一份 catalog 反复应用不会重复加层', async () => {
  const viewer = fakeViewer()
  const stack = createOverlayLayers({ Cesium: {}, viewer, providerFactory: providerFor })
  const catalog = [source('a'), source('b')]
  await stack.sync(catalog)
  const second = await stack.sync(catalog)
  assert.deepEqual(second, { added: 0, removed: 0, updated: 2, failed: 0 })
  assert.equal(viewer.layers.length, 2)
})

test('叠加图层：sync 增删改——新增、移除、改透明度、改 URL 重建', async () => {
  const viewer = fakeViewer()
  const stack = createOverlayLayers({ Cesium: {}, viewer, providerFactory: providerFor })
  await stack.sync([source('a'), source('b')])
  const summary = await stack.sync([source('a', { opacity: 0.2 }), source('c'), source('b', { url: 'https://example.test/moved' })])
  // a: opacity update; c: added; b: URL changed so the layer is rebuilt (remove +
  // add), which counts as an add here.
  assert.deepEqual(summary, { added: 2, removed: 0, updated: 1, failed: 0 })
  assert.deepEqual(stack.list().map((item) => item.id).sort(), ['a', 'b', 'c'])
  assert.equal(viewer.layers[0].alpha, 0.2)
  // Removing from the catalog removes the live layer too.
  const removal = await stack.sync([source('a')])
  assert.deepEqual(removal, { added: 0, removed: 2, updated: 1, failed: 0 })
  assert.deepEqual(stack.list().map((item) => item.id), ['a'])
  assert.equal(viewer.layers.length, 1)
})

test('叠加图层：单个图层失败只回调 onError，不影响其余图层', async () => {
  const viewer = fakeViewer()
  const errors = []
  const stack = createOverlayLayers({
    Cesium: {},
    viewer,
    providerFactory: async (Cesium, item) => {
      if (item.id === 'bad') throw new Error('capabilities 404')
      return { url: item.url }
    },
    onError: (error, item) => errors.push(`${item.id}:${error.message}`),
  })
  const summary = await stack.sync([source('bad'), source('good')])
  assert.deepEqual(summary, { added: 1, removed: 0, updated: 0, failed: 1 })
  assert.deepEqual(errors, ['bad:capabilities 404'])
  assert.deepEqual(stack.list().map((item) => item.id), ['good'])
})

test('叠加图层：setOpacity / setVisible / remove / clear 都作用于真实图层对象', async () => {
  const viewer = fakeViewer()
  const stack = createOverlayLayers({ Cesium: {}, viewer, providerFactory: providerFor })
  await stack.add(source('a'))
  await stack.add(source('b'))
  await stack.setOpacity('a', 0.25)
  await stack.setVisible('b', false)
  assert.equal(viewer.layers[0].alpha, 0.25)
  assert.equal(viewer.layers[1].show, false)
  // Out-of-range opacity is clamped, unknown ids are a no-op.
  await stack.setOpacity('a', 9)
  assert.equal(viewer.layers[0].alpha, 1)
  assert.equal(await stack.setOpacity('missing', 0.5), false)
  assert.equal(await stack.remove('a'), true)
  assert.equal(await stack.remove('a'), false)
  await stack.clear()
  assert.equal(stack.size(), 0)
  assert.equal(viewer.layers.length, 0)
})

test('叠加图层：viewer 销毁后排队操作不抛错（dispose 与 destroy 竞争）', async () => {
  const viewer = fakeViewer()
  const stack = createOverlayLayers({ Cesium: {}, viewer, providerFactory: providerFor })
  await stack.add(source('a'))
  // Simulate the scene disappearing between the enqueue and the execution.
  viewer.scene = undefined
  await assert.doesNotReject(() => stack.dispose())
  assert.equal(stack.size(), 0)
})

// ---------------------------------------------------------------------------
// Host catalog schema v2
// ---------------------------------------------------------------------------

test('catalog：rasterOverlays 缺省为空数组，合法项被规范化并持久化', () => {
  const defaults = normalizeConfig({})
  assert.deepEqual(defaults.rasterOverlays, [])

  const config = normalizeConfig({
    rasterOverlays: [
      { id: 'flood', name: '内涝风险 WMS', type: 'wms', url: 'https://example.test/wms', layers: 'flood:risk', opacity: 0.45 },
      { id: 'class', name: '分类图', type: 'xyz', url: 'https://example.test/{z}/{x}/{y}.png', visible: false, opacity: 2 },
    ],
  })
  assert.equal(config.rasterOverlays.length, 2)
  assert.equal(config.rasterOverlays[0].opacity, 0.45)
  assert.equal(config.rasterOverlays[0].visible, true)
  assert.equal(config.rasterOverlays[0].layers, 'flood:risk')
  // opacity is clamped into 0..1 and visible defaults to true
  assert.equal(config.rasterOverlays[1].opacity, 1)
  assert.equal(config.rasterOverlays[1].visible, false)
  // Round-trip: the persisted shape must be stable.
  assert.deepEqual(normalizeConfig(config).rasterOverlays, config.rasterOverlays)
})

test('catalog：非法/超量叠加层被丢弃而不是让整份配置失败', () => {
  const config = normalizeConfig({
    rasterOverlays: [
      { id: 'ok', type: 'wms', url: 'https://example.test/wms', layers: 'x' },
      { id: 'bad-type', type: 'nope', url: 'https://example.test/x' },
      { id: 'bad-url', type: 'wms', url: '' },
      null,
      'nope',
    ],
  })
  assert.deepEqual(config.rasterOverlays.map((item) => item.id), ['ok'])

  const many = Array.from({ length: 12 }, (_, index) => ({
    id: `o${index}`,
    type: 'xyz',
    url: `https://example.test/${index}/{z}/{x}/{y}.png`,
  }))
  assert.equal(normalizeConfig({ rasterOverlays: many }).rasterOverlays.length, 8)
})

test('catalog：重复 id 自动改唯一，已有配置（无 rasterOverlays 字段）不受影响', () => {
  const config = normalizeConfig({
    settings: { quality: 'high' },
    rasterOverlays: [
      { id: 'dup', type: 'xyz', url: 'https://example.test/a/{z}/{x}/{y}.png' },
      { id: 'dup', type: 'xyz', url: 'https://example.test/b/{z}/{x}/{y}.png' },
    ],
  })
  const ids = config.rasterOverlays.map((item) => item.id)
  assert.equal(new Set(ids).size, 2)
  assert.equal(config.settings.quality, 'high')
})

// ---------------------------------------------------------------------------
// Panel wiring
// ---------------------------------------------------------------------------

test('接线：底图固定加在第 0 层，叠加层在上；挂载与保存都会 sync', () => {
  const client = clientSource()
  assert.match(client, /addImageryProvider\(provider, 0\)/)
  assert.match(client, /overlayLayersRef\.current = createOverlayLayers\(\{/)
  assert.match(client, /await overlayLayersRef\.current\.sync\(catalog\.config\.rasterOverlays \?\? \[\]\)/)
  assert.match(client, /overlayLayersRef\.current\?\.sync\(next\.rasterOverlays \?\? \[\]\)/)
  assert.match(client, /overlayLayersRef\.current\?\.dispose\(\)/)
})

test('接线：status 暴露 raster_overlays，失败走 toast 而不是整面板错误', () => {
  const client = clientSource()
  assert.match(client, /raster_overlays: overlayLayersRef\.current\?\.list\(\) \?\? \[\]/)
  assert.match(client, /t\('toast\.overlayFailed'/)
  const key = 'toast\\.overlayFailed'
  const hits = client.match(new RegExp(`'${key}':`, 'g')) ?? []
  assert.ok(hits.length >= 2, `locale 缺少 toast.overlayFailed（中英各一条），实际 ${hits.length}`)
})
