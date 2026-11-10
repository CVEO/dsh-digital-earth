import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getSelectionTool, cancelSelection, disposeSelection, isSelectionActive } from '../src/client/scene/selection-tools.js'

function hookHarness() {
  const hooks = [], effects = []
  let cursor = 0
  const slot = (factory) => { const index = cursor++; return hooks[index] ??= factory() }
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) { const state = slot(() => ({ value: initial })); return [state.value, (value) => { state.value = value }] },
    useRef(initial) { return slot(() => ({ current: initial })) },
    useCallback(callback) { return callback },
    useEffect(callback, dependencies) {
      const effect = slot(() => ({}))
      if (!effect.dependencies || dependencies.some((value, index) => !Object.is(value, effect.dependencies[index]))) {
        effects.push(() => { effect.cleanup?.(); effect.dependencies = dependencies; effect.cleanup = callback() })
      }
    },
  }
  return { React, render(component, props) { cursor = 0; const tree = component(props); effects.splice(0).forEach((effect) => effect()); return tree },
    values: () => hooks.slice(0, 4).map((hook) => hook.value), unmount() { hooks.forEach((hook) => hook.cleanup?.()) } }
}

test('指认：最后一次请求获胜，加载中取消及卸载使迟到结果失效', async () => {
  const harness = hookHarness()
  globalThis.__earthAuditReact = harness.React
  const source = (await readFile(new URL('../src/client/ui/selection-overlay.js', import.meta.url), 'utf8'))
    .replace("import React from 'react'", 'const React = globalThis.__earthAuditReact')
    .replace("import { VisionSelect } from './vision-select.js'", 'const VisionSelect = () => null')
    .replace("'../scene/selection-tools.js'", JSON.stringify(new URL('../src/client/scene/selection-tools.js', import.meta.url).href))
  const { SelectionOverlay } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
  delete globalThis.__earthAuditReact
  const oldDocument = globalThis.document
  const listeners = new Map()
  globalThis.document = { addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: (type) => listeners.delete(type) }
  const pending = []
  const props = { active: true, apiRef: {}, controller: { identifyAt: () => new Promise((resolve) => pending.push(resolve)) }, t: (key) => key }
  try {
    harness.render(SelectionOverlay, props)
    const first = props.apiRef.current({ x: 1, y: 1 })
    const second = props.apiRef.current({ x: 2, y: 2 })
    pending[1]({ card: { id: 'B' } }); await second
    pending[0]({ card: { id: 'A' } }); await first
    assert.equal(harness.values()[0].id, 'B')
    const third = props.apiRef.current({ x: 3, y: 3 })
    listeners.get('keydown')({ key: 'Escape' })
    pending[2]({ card: { id: 'C' } }); await third
    assert.equal(harness.values()[0], null)
    assert.equal(harness.values()[1], false)
    const fourth = props.apiRef.current({ x: 4, y: 4 })
    harness.unmount()
    pending[3]({ card: { id: 'D' } }); await fourth
    assert.equal(harness.values()[0], null)
  } finally { harness.unmount(); if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument }
})

test('选择会话：取消恢复全部相机开关，dispose 移除会话并释放处理器', () => {
  const handlers = []
  const controller = { enableRotate: true, enableTranslate: false, enableTilt: true, enableLook: false, enableZoom: true }
  const saved = { ...controller }
  const Cesium = { ScreenSpaceEventType: { LEFT_DOWN: 1, MOUSE_MOVE: 2, LEFT_UP: 3, RIGHT_CLICK: 4 },
    ScreenSpaceEventHandler: class { constructor() { this.actions = new Map(); handlers.push(this) } setInputAction(callback, type) { this.actions.set(type, callback) } destroy() { this.destroyed = true } } }
  const viewer = { scene: { canvas: {}, screenSpaceCameraController: controller }, entities: { remove() {} } }
  let activations = 0
  const tool = getSelectionTool(viewer, { getCesium: () => Cesium, onActivate() { activations++; assert.equal(isSelectionActive(viewer), false) } })
  tool.start('rect')
  handlers[0].actions.get(1)({ position: { x: 10, y: 10 } })
  assert.ok(Object.values(controller).every((value) => value === false))
  cancelSelection(viewer)
  assert.deepEqual(controller, saved)
  assert.equal(handlers[0].destroyed, true)
  tool.start('rect')
  assert.equal(activations, 2)
  disposeSelection(viewer)
  assert.equal(isSelectionActive(viewer), false)
  assert.equal(handlers[1].destroyed, true)
  assert.notEqual(getSelectionTool(viewer, {}), tool)
  disposeSelection(viewer)
})
