import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Engine from '../vendor/cesium/index.js'
import { createVectorInteraction } from '../src/client/scene/vector-interaction.js'
import { segmentDistance } from '../src/client/scene/vector-style.js'

class Element extends EventTarget {
  children = []
  dataset = {}
  style = {}
  attributes = {}
  classList = { toggle() {} }
  clientWidth = 800
  clientHeight = 600
  offsetWidth = 180
  offsetHeight = 35
  append(child) { this.children.push(child); child.parent = this }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this) }
  setAttribute(name, value) { this.attributes[name] = value }
  getBoundingClientRect() { return { left: 0, top: 0 } }
  contains(element) { return element === this || this.children.some((child) => child.contains(element)) }
}

function harness() {
  const root = new Element()
  root.ownerDocument = Object.assign(new EventTarget(), { createElement: () => new Element(), body: new Element() })
  root.ownerDocument.activeElement = root.ownerDocument.body
  let tool = null
  let picked = null
  let pickCount = 0
  let selection = null
  let samples = 0
  const Cesium = { ...Engine,
    EllipsoidalOccluder: class { isPointVisible() { return true } },
    SceneTransforms: { worldToWindowCoordinates: (_scene, world) => ({ x: world.x, y: world.y }) },
  }
  const viewer = {
    canvas: new Element(), clock: { currentTime: Engine.JulianDate.now() },
    camera: { positionWC: Engine.Cartesian3.fromDegrees(0, 0, 1000), moveStart: new Engine.Event(), moveEnd: new Engine.Event() },
    entities: new Engine.EntityCollection(),
    scene: { globe: { ellipsoid: Engine.Ellipsoid.WGS84 }, sampleHeightSupported: true,
      sampleHeight() { samples++; return 85 },
      pick() { pickCount++; return picked ? { id: picked } : null }, drillPick: () => [], requestRender() {}, postRender: new Engine.Event() },
  }
  const interaction = createVectorInteraction({ Cesium, viewer, root, getTool: () => tool, onSelect: (value) => { selection = value } })
  const descriptor = { group: {}, title: '测高', kind: '量测' }
  const line = () => interaction.add({ polyline: { positions: [new Engine.Cartesian3(100, 200, 0), new Engine.Cartesian3(300, 200, 0)], material: Engine.Color.BLUE } }, descriptor)
  const label = (ground = false) => interaction.add({ position: Engine.Cartesian3.fromDegrees(0, 0, 42),
    label: { text: '高度 42.00 m', ...(ground ? { heightReference: Engine.HeightReference.CLAMP_TO_GROUND } : {}) } }, descriptor)
  return { root, viewer, interaction, descriptor, line, label, get selection() { return selection }, get samples() { return samples },
    pick(entity) { picked = entity }, tool(value) { tool = value }, get pickCount() { return pickCount } }
}

function move(canvas, buttons = 0) {
  const event = new Event('pointermove')
  Object.assign(event, { clientX: 200, clientY: 200, buttons })
  canvas.dispatchEvent(event)
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 85))

test('矢量交互：细线有屏幕拾取容差，选中显示量测文本，取消恢复原始样式', () => {
  const state = harness()
  try {
    const entity = state.line()
    const material = entity.polyline.material
    state.label()
    assert.equal(state.interaction.click({ x: 200, y: 205 }), true)
    assert.equal(state.selection.summary, '高度 42.00 m')
    assert.equal(entity.polyline.width.getValue(), 7)
    assert.notEqual(entity.polyline.material, material)
    state.interaction.click({ x: 200, y: 208 })
    assert.equal(state.selection, null)
    assert.equal(entity.polyline.width.getValue(), 4.5)
    assert.equal(entity.polyline.material, material)
  } finally { state.interaction.dispose() }
})

test('矢量交互：悬停面与同组边线一起反馈，离开恢复；拖动与绘制不进行拾取', async () => {
  const state = harness()
  try {
    const line = state.line()
    const polygon = state.interaction.add({ polygon: { hierarchy: [Engine.Cartesian3.fromDegrees(0, 0), Engine.Cartesian3.fromDegrees(1, 0), Engine.Cartesian3.fromDegrees(0, 1)], material: Engine.Color.BLUE } }, state.descriptor)
    state.pick(polygon)
    move(state.viewer.canvas)
    await settle()
    assert.equal(line.polyline.width.getValue(), 6)
    assert.equal(polygon.polygon.material.color.getValue().alpha, 0.23)
    state.viewer.canvas.dispatchEvent(new Event('pointerleave'))
    assert.equal(line.polyline.width.getValue(), 4.5)
    assert.equal(polygon.polygon.material.color.getValue().alpha, 0.16)
    const reads = state.pickCount
    move(state.viewer.canvas)
    state.viewer.canvas.dispatchEvent(new Event('pointerdown'))
    move(state.viewer.canvas, 1)
    await settle()
    assert.equal(state.pickCount, reads)
    state.viewer.camera.moveStart.raiseEvent()
    move(state.viewer.canvas)
    await settle()
    assert.equal(state.pickCount, reads)
    state.viewer.camera.moveEnd.raiseEvent()
    state.tool('area')
    move(state.viewer.canvas)
    await settle()
    assert.equal(state.pickCount, reads)
    assert.equal(state.interaction.click({ x: 200, y: 200 }), false)
  } finally { state.interaction.dispose() }
})

test('矢量交互：删除已选组后移除卡片与标签，销毁后不再响应鼠标', async () => {
  const state = harness()
  const line = state.line()
  const label = state.label()
  state.pick(line)
  state.interaction.click({ x: 200, y: 200 })
  assert.ok(state.selection)
  state.viewer.entities.remove(line)
  state.viewer.entities.remove(label)
  assert.equal(state.selection, null)
  assert.equal(state.root.children[0].children.length, 0)
  const reads = state.pickCount
  state.interaction.dispose()
  assert.equal(state.root.children.length, 0)
  move(state.viewer.canvas)
  await settle()
  assert.equal(state.pickCount, reads)
})

test('标签锚点：显式测量高程不贴回地面，只有地表标注采样模型高度', () => {
  const state = harness()
  try {
    const measured = state.label()
    assert.equal(state.samples, 0)
    assert.equal(measured.label.show.getValue(), false)
    const ground = state.label(true)
    assert.equal(state.samples, 1)
    assert.ok(Math.abs(Engine.Cartographic.fromCartesian(measured.position.getValue()).height - 42) < 0.001)
    state.viewer.camera.moveEnd.raiseEvent()
    assert.equal(state.samples, 2)
    state.viewer.entities.remove(ground)
  } finally { state.interaction.dispose() }
})

test('标签：原生字体安全转义，不插入 HTML；截图会绘入可见标签', () => {
  const state = harness()
  try {
    state.interaction.add({ position: new Engine.Cartesian3(300, 300, 0), label: { text: '<b>面积 120 m²</b>' } }, state.descriptor)
    const button = state.root.children[0].children[0]
    assert.equal(button.textContent, '<b>面积 120 m²</b>')
    assert.equal(button.attributes['aria-label'], button.textContent)
    const texts = []
    const context = { save() {}, restore() {}, scale() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, fillText(text) { texts.push(text) } }
    state.interaction.drawLabels(context, 1600, 1200)
    assert.deepEqual(texts, ['<b>面积 120 m²</b>'])
    state.tool('distance')
    state.interaction.drawLabels(context, 800, 600)
    assert.equal(button.disabled, true)
  } finally { state.interaction.dispose() }
})

test('屏幕线段距离：端点和退化线段保持有界', () => {
  assert.equal(segmentDistance({ x: 4, y: 3 }, { x: 0, y: 0 }, { x: 0, y: 0 }), 5)
  assert.equal(segmentDistance({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 10)
})

test('Esc：画布未获焦点时也能取消选择，输入对话时不干扰', () => {
  const state = harness()
  try {
    state.pick(state.line())
    state.interaction.click({ x: 200, y: 200 })
    const press = () => {
      const event = new Event('keydown')
      Object.assign(event, { key: 'Escape' })
      state.root.ownerDocument.dispatchEvent(event)
    }
    state.root.ownerDocument.activeElement = new Element()
    press()
    assert.ok(state.selection)
    state.root.ownerDocument.activeElement = state.root.ownerDocument.body
    press()
    assert.equal(state.selection, null)
  } finally { state.interaction.dispose() }
})
