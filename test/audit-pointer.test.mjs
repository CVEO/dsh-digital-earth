import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPointerIntent } from '../src/client/scene/pointer-intent.js'
import { installCanvasInput } from '../src/client/scene/canvas-input.js'
import { canvasPosition } from '../src/client/scene/screen-geodesy.js'

test('拖拽绕回、取消和选择手势结束不能穿透为指认', () => {
  const actions = new Map()
  let owned = false, clicks = 0
  const Cesium = { ScreenSpaceEventType: { LEFT_DOWN: 1, MOUSE_MOVE: 2, LEFT_CLICK: 3, LEFT_DOUBLE_CLICK: 4, RIGHT_CLICK: 5 },
    ScreenSpaceEventHandler: class { setInputAction(action, type) { actions.set(type, action) } destroy() {} } }
  const handler = installCanvasInput({ Cesium, viewer: { scene: { canvas: {} } }, isSelectionActive: () => owned, onCanvasClick: () => clicks++ })
  actions.get(1)({ position: { x: 100, y: 100 } })
  actions.get(2)({ endPosition: { x: 200, y: 100 } })
  actions.get(2)({ endPosition: { x: 100, y: 100 } })
  actions.get(3)({ position: { x: 100, y: 100 } })
  assert.equal(clicks, 0)
  owned = true
  actions.get(1)({ position: { x: 100, y: 100 } })
  owned = false
  actions.get(3)({ position: { x: 100, y: 100 } })
  assert.equal(clicks, 0)
  actions.get(1)({ position: { x: 100, y: 100 } })
  actions.get(3)({ position: { x: 102, y: 100 } })
  assert.equal(clicks, 1)
  handler.destroy()
  const intent = createPointerIntent()
  intent.down({ x: 0, y: 0 }); intent.cancel()
  assert.equal(intent.allowsClick(), false)
})

test('CSS 坐标不随 DPR 和渲染比例变化', () => {
  class Cartesian2 { constructor(x, y) { this.x = x; this.y = y } }
  for (const scale of [0.75, 1, 1.5, 2]) {
    const viewer = { canvas: { clientWidth: 500, clientHeight: 400, width: 500 * scale, height: 400 * scale } }
    assert.deepEqual(canvasPosition(viewer, { x: 250, y: 200 }, { Cartesian2 }), new Cartesian2(250, 200))
  }
})
