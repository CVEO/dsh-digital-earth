/**
 * v1.6.5 — manual measurements become listable overlays.
 *
 * The bug being locked: measuring in the scene left nothing under 场景 → 量测,
 * because the tool kept its result in local entities only. These tests pin the
 * shape of the stored command and the coordinates it carries, plus the flush on
 * tool switch (see v162 for the panel wiring).
 */
import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const { buildMeasureCommand, measureLonLatHeights, measureResultOf } = await import('../src/client/scene/measure-commit.js')
const { commitMeasurementToOverlay, drawMeasurePreview } = await import('../src/client/scene/measure-render.js')

/** Just enough Cesium for the measure helpers: cartographic + geodesic maths. */
function fakeCesium() {
  const toRadians = (value) => (value * Math.PI) / 180
  const fromRadians = (value) => (value * 180) / Math.PI
  class Cartesian3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
  }
  return {
    Cartesian3,
    Cartesian2: class {
      constructor(x = 0, y = 0) {
        this.x = x
        this.y = y
      }
    },
    LabelStyle: { FILL: 1 },
    scene: {},
    PolygonHierarchy: class {
      constructor(positions) {
        this.positions = positions
      }
    },
    BoundingSphere: { fromPoints: (points) => ({ center: points[0] }) },
    EllipsoidGeodesic: class {
      constructor(left, right) {
        // Synthetic cartographics: longitude/latitude are radians on a sphere.
        this.surfaceDistance = Math.hypot(right.longitude - left.longitude, right.latitude - left.latitude) * 6371000
      }
    },
    Cartographic: {
      fromCartesian: (position) =>
        position
          ? {
              longitude: toRadians(position.x / 111320),
              latitude: toRadians(position.y / 111320),
              height: position.z,
            }
          : null,
    },
    Color: {
      WHITE: {},
      fromCssColorString: () => ({ withAlpha: () => ({}) }),
    },
    Math: { toDegrees: fromRadians },
    Transforms: { eastNorthUpToFixedFrame: () => 'enu' },
    Matrix4: class {
      static inverseTransformation() {
        return 'inverse'
      }
      static multiplyByPoint(inverse, point, out) {
        return Object.assign(out, { x: point.x, y: point.y })
      }
    },
  }
}

const at = (x, y, z) => ({ x, y, z })

test('距离量测：结果字段与图层行/导出共用一个形状', () => {
  const Cesium = fakeCesium()
  const points = [at(0, 0, 10), at(1113.2, 0, 10)]
  const result = measureResultOf(Cesium, 'distance', points)
  assert.equal(result.mode, 'distance')
  assert.equal(result.points, 2)
  assert.equal(result.drawn, true)
  assert.ok(result.distance_m > 0)
  assert.equal(result.distance_km, Math.round((result.distance_m / 1000) * 1e4) / 1e4)
})

test('面积量测：周长与面积都来自同一条闭合环', () => {
  const Cesium = fakeCesium()
  const points = [at(0, 0, 0), at(1113.2, 0, 0), at(1113.2, 1113.2, 0)]
  const result = measureResultOf(Cesium, 'area', points)
  assert.equal(result.mode, 'area')
  assert.ok(result.area_m2 > 0)
  assert.ok(result.perimeter_m > 0)
  assert.equal(result.area_km2, Math.round((result.area_m2 / 1e6) * 1e6) / 1e6)
})

test('高度量测：相对高、起止高程、水平距与坡度一起给出', () => {
  const Cesium = fakeCesium()
  const result = measureResultOf(Cesium, 'height', [at(1000, 1000, 23.5), at(1030, 1000, 35.5)])
  assert.equal(result.height_m, 12)
  assert.equal(result.height_from_m, 23.5)
  assert.equal(result.height_to_m, 35.5)
  assert.ok(result.horizontal_m > 20)
  assert.ok(result.slope_deg > 0)
})

test('未完成的量测不产出结果，也不会被存成空要素', () => {
  const Cesium = fakeCesium()
  assert.equal(measureResultOf(Cesium, 'distance', [at(0, 0, 0)]), null)
  assert.equal(measureResultOf(Cesium, 'area', [at(0, 0, 0), at(1, 0, 0)]), null)
  assert.equal(measureResultOf(Cesium, 'height', [at(0, 0, 0)]), null)
  assert.equal(buildMeasureCommand(Cesium, { mode: 'distance', points: [at(0, 0, 0)], result: null }), null)
})

test('命令是 origin=user 的 [lon,lat,height] 三元组，量测不会被 Agent 清理波及', () => {
  const Cesium = fakeCesium()
  const points = [at(1000, 2000, 5), at(1100, 2000, 5)]
  const result = measureResultOf(Cesium, 'distance', points)
  const command = buildMeasureCommand(Cesium, { mode: 'distance', points, result })
  assert.equal(command.origin, 'user')
  assert.equal(command.draw, true)
  assert.equal(command.mode, 'distance')
  assert.equal(command.result, result)
  assert.equal(command.points.length, 2)
  for (const [lon, lat, height] of command.points) {
    assert.ok(Number.isFinite(lon) && Number.isFinite(lat) && Number.isFinite(height))
  }
})

test('测量经纬高来自 Cartesian，越界几何按 null 处理而不是猜', () => {
  const Cesium = fakeCesium()
  assert.equal(measureLonLatHeights(Cesium, [null]), null)
  assert.equal(measureLonLatHeights(Cesium, []), null)
  assert.deepEqual(measureLonLatHeights(Cesium, [at(111320, 0, 1)]), [[1, 0, 1]])
})

test('提交把实体转成 overlay 命令：计数增加、测量状态清空、实体不重画', () => {
  const Cesium = fakeCesium()
  const removed = []
  const entity = { label: { text: { getValue: () => '12.0 m' } } }
  const state = {
    entities: [entity],
    points: [at(0, 0, 0), at(0.001, 0, 0)],
    mode: 'distance',
    result: measureResultOf(Cesium, 'distance', [at(0, 0, 0), at(0.001, 0, 0)]),
  }
  const overlay = { draw: [], measure: [], drawnFeatures: 0, measuredCount: 0, drawCommands: [], measureCommands: [], entityGroups: new WeakMap() }
  const command = commitMeasurementToOverlay({ Cesium, state, overlay })
  assert.ok(command)
  assert.equal(overlay.measure.length, 1)
  assert.equal(overlay.measureCommands.length, 1)
  assert.equal(overlay.measuredCount, 2)
  assert.equal(overlay.entityGroups.get(command)[0], entity, '实体被转移而不是重建')
  assert.deepEqual(state.entities, [])
  assert.deepEqual(state.points, [])
  assert.equal(state.mode, null)
  assert.equal(state.result, null)
  assert.equal(commitMeasurementToOverlay({ Cesium, state, overlay }), null, '空状态不重复提交')
  assert.equal(removed.length, 0)
})

test('预览绘制保留 state.result，供离开工具时直接提交', () => {
  const Cesium = fakeCesium()
  const drawn = []
  const entity = { label: { text: { getValue: () => 'x' } } }
  const state = { entities: [], points: [at(0, 0, 0), at(0.001, 0, 0)], mode: null, result: null }
  const vector = {
    add: (options) => {
      drawn.push(options)
      return entity
    },
    refresh: () => {},
  }
  const infos = []
  drawMeasurePreview({
    Cesium,
    viewer: { entities: { remove: () => {} } },
    state,
    mode: 'distance',
    t: (key) => key,
    vector,
    onInfo: (info) => infos.push(info),
  })
  assert.equal(state.entities.length, drawn.length)
  assert.equal(state.mode, 'distance')
  assert.equal(state.result.mode, 'distance')
  assert.equal(infos.length, 1)
  assert.ok(drawn.some((options) => options.polyline), '距离量测画线')
})
