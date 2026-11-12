/**
 * v1.6 F0 — clipping collection lifecycle (`src/client/scene/clip-collections.js`).
 *
 * Regression for the clip-analysis crash: `earth_analyze action=clip` and the
 * swipe comparison both clipped tilesets by assigning `tileset.clippingPlanes`.
 * Cesium's setter destroys the previous collection *and its clipping texture*,
 * while tile draw commands may still reference that texture, so closing the
 * comparison (or clearing a clip) stopped rendering with
 * "Cannot read properties of undefined (_target)".
 *
 * The fix is one shared registry per tileset: create once, reuse, and only ever
 * toggle `enabled`. These tests pin that behaviour — they assert object identity
 * and flags, not source strings.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readRepoFile } from './helpers/source.mjs'

import {
  acquireClipCollection,
  clipCollectionOf,
  clipOwnerOf,
  CLIP_OWNER_ANALYSIS,
  CLIP_OWNER_SWIPE,
  releaseClipCollection,
  setClipPlane,
} from '../src/client/scene/clip-collections.js'

class FakePlane {
  constructor(normal, distance) {
    this.normal = normal
    this.distance = distance
  }
}

class FakeCollection {
  constructor({ planes = [], enabled = true, edgeWidth = 1.5, edgeColor = null } = {}) {
    this.planes = [...planes]
    this.enabled = enabled
    this.edgeWidth = edgeWidth
    this.edgeColor = edgeColor
    this.destroyed = false
    this.destroyCalls = 0
  }

  get(index) {
    return this.planes[index] ?? null
  }

  isDestroyed() {
    return this.destroyed
  }

  destroy() {
    this.destroyCalls += 1
    this.destroyed = true
  }
}

const fakeCesium = {
  ClippingPlane: FakePlane,
  ClippingPlaneCollection: FakeCollection,
  Color: { fromCssColorString: (css) => ({ css }) },
}

const plane = (normal, distance) => ({ normal, distance })
const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }

const acquire = (tileset, owner, next = plane(down, -100)) =>
  acquireClipCollection(fakeCesium, tileset, {
    owner,
    planes: [next],
    edgeWidth: 1.5,
    edgeColor: null,
  })

test('F0 裁剪集合：首次 acquire 创建并挂载，第二次复用同一实例', () => {
  const tileset = { clippingPlanes: null }
  const first = acquire(tileset, CLIP_OWNER_SWIPE)
  assert.equal(first.ok, true)
  assert.equal(first.reused, false)
  assert.equal(tileset.clippingPlanes, first.collection)
  assert.equal(first.collection.enabled, true)
  assert.equal(clipCollectionOf(tileset), first.collection)
  assert.equal(clipOwnerOf(tileset), CLIP_OWNER_SWIPE)

  const second = acquire(tileset, CLIP_OWNER_SWIPE, plane(down, -120))
  assert.equal(second.ok, true)
  assert.equal(second.reused, true)
  assert.equal(second.collection, first.collection, '同一 tileset 必须复用同一个集合')
  assert.equal(second.collection.get(0).distance, -120, '复用时要就地更新平面')
  assert.equal(tileset.clippingPlanes.destroyCalls, 0, '复用路径不允许销毁集合')
})

test('F0 裁剪集合：release 只置 enabled=false，集合仍挂在 tileset 上（永不移除）', () => {
  const tileset = { clippingPlanes: null }
  const { collection } = acquire(tileset, CLIP_OWNER_SWIPE)
  assert.equal(releaseClipCollection(tileset, CLIP_OWNER_SWIPE), true)
  assert.equal(collection.enabled, false)
  assert.equal(tileset.clippingPlanes, collection, '退出后集合必须保留（赋 undefined 会销毁纹理并崩渲染）')
  assert.equal(collection.destroyCalls, 0)
  assert.equal(clipOwnerOf(tileset), null)

  // 再次 acquire（比如剖切换手）复用同一实例并重新启用。
  const again = acquire(tileset, CLIP_OWNER_ANALYSIS, plane(up, -150))
  assert.equal(again.ok, true)
  assert.equal(again.collection, collection)
  assert.equal(collection.enabled, true)
  assert.equal(collection.get(0).distance, -150)
})

test('F0 裁剪集合：另一个 owner 在用 → conflict，且不夺走、不销毁、不改平面', () => {
  const tileset = { clippingPlanes: null }
  const { collection } = acquire(tileset, CLIP_OWNER_SWIPE, plane(down, -60))
  const before = { ...collection.get(0), enabled: collection.enabled }

  const stolen = acquire(tileset, CLIP_OWNER_ANALYSIS, plane(up, 999))
  assert.equal(stolen.ok, false)
  assert.equal(stolen.reason, 'conflict')
  assert.equal(stolen.owner, CLIP_OWNER_SWIPE)
  assert.equal(tileset.clippingPlanes, collection)
  assert.equal(collection.enabled, true)
  assert.equal(collection.get(0).distance, before.distance, '冲突时不得改动别人的平面')
  assert.equal(collection.destroyCalls, 0)

  // 非 owner 也不能把它关掉（否则剖切会被卷帘顺手清掉）。
  assert.equal(releaseClipCollection(tileset, CLIP_OWNER_ANALYSIS), false)
  assert.equal(collection.enabled, true)
})

test('F0 裁剪集合：外部已挂 clippingPlanes → conflict，外部集合原样保留', () => {
  const foreign = new FakeCollection({ planes: [new FakePlane(up, 1)] })
  const tileset = { clippingPlanes: foreign }
  const result = acquire(tileset, CLIP_OWNER_ANALYSIS)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'conflict')
  assert.equal(tileset.clippingPlanes, foreign, '外部集合不得被替换')
  assert.equal(foreign.enabled, true)
  assert.equal(foreign.destroyCalls, 0)
  assert.equal(clipCollectionOf(tileset), null, '外部集合不进入登记表')
})

test('F0 裁剪集合：集合随 tileset 销毁后，下一次 acquire 重建而不是复用死对象', () => {
  const tileset = { clippingPlanes: null }
  const first = acquire(tileset, CLIP_OWNER_SWIPE)
  first.collection.destroy()
  const second = acquire(tileset, CLIP_OWNER_ANALYSIS, plane(up, -10))
  assert.equal(second.ok, true)
  assert.notEqual(second.collection, first.collection)
  assert.equal(second.collection.enabled, true)
  assert.equal(tileset.clippingPlanes, second.collection)
})

test('F0 裁剪集合：缺少 Cesium 裁剪 API 或平面非法 → unavailable，不触碰 tileset', () => {
  const tileset = { clippingPlanes: null }
  assert.equal(
    acquireClipCollection({}, tileset, { owner: CLIP_OWNER_SWIPE, planes: [plane(up, -1)] }).reason,
    'unavailable',
  )
  assert.equal(acquireClipCollection(fakeCesium, tileset, { owner: CLIP_OWNER_SWIPE, planes: [] }).reason, 'unavailable')
  assert.equal(
    acquireClipCollection(fakeCesium, tileset, { owner: CLIP_OWNER_SWIPE, planes: [plane(up, Number.NaN)] }).reason,
    'unavailable',
  )
  assert.equal(tileset.clippingPlanes, null)
})

test('F0 裁剪集合：setClipPlane 就地改 single plane，非法输入返回 false', () => {
  const collection = new FakeCollection({ planes: [new FakePlane({ ...up }, 5)] })
  assert.equal(setClipPlane(collection, plane({ x: 1, y: 0, z: 0 }, -9)), true)
  assert.equal(collection.get(0).normal.x, 1)
  assert.equal(collection.get(0).distance, -9)
  assert.equal(setClipPlane(collection, { normal: { x: 0, y: 0, z: 1 }, distance: Number.NaN }), false)
  assert.equal(setClipPlane(null, plane(up, 1)), false)
})

// ---------------------------------------------------------------------------
// Engine wiring: the crash source must be gone, both features share the registry
// ---------------------------------------------------------------------------

test('F0 engine：剖切与恢复都走共享登记表，源码中不再给 clippingPlanes 赋值', () => {
  const engine = readRepoFile('src/client/analysis/engine.js')
  assert.match(engine, /acquireClipCollection\(Cesium, tileset, \{/)
  assert.match(engine, /releaseClipCollection\(target\.tileset, CLIP_OWNER_ANALYSIS\)/)
  assert.match(engine, /\[clip_conflict\]/)
  assert.doesNotMatch(engine, /clippingPlanes\s*=/, 'engine 不得直接给 tileset.clippingPlanes 赋值')
  assert.doesNotMatch(engine, /clippingPlanes = previous/, '旧的回滚赋 undefined 分支必须消失')
  assert.doesNotMatch(engine, /new Cesium\.ClippingPlaneCollection/, '集合创建只属于 clip-collections.js')

  const swipe = readRepoFile('src/client/scene/swipe.js')
  assert.match(swipe, /acquireClipCollection\(Cesium, layer\.tileset, \{/)
  assert.match(swipe, /releaseClipCollection\(current\.tileset, CLIP_OWNER_SWIPE\)/)
  assert.doesNotMatch(swipe, /clippingPlanes\s*=/, '卷帘同样不得直接赋值')
})
