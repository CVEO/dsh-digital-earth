import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const tick = () => new Promise((resolve) => setImmediate(resolve))

function harness() {
  const hooks = [], effects = []
  let cursor = 0, unmounted = false, lateUpdates = 0
  const slot = (create) => hooks[cursor++] ??= create()
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const state = slot(() => ({ value: initial }))
      return [state.value, (value) => {
        if (unmounted) lateUpdates++
        state.value = typeof value === 'function' ? value(state.value) : value
      }]
    },
    useRef(initial) { return slot(() => ({ current: initial })) },
    useEffect(callback, dependencies) {
      const effect = slot(() => ({}))
      if (!effect.dependencies || dependencies.some((value, index) => !Object.is(value, effect.dependencies[index]))) {
        effects.push(() => { effect.cleanup?.(); effect.dependencies = dependencies; effect.cleanup = callback() })
      }
    },
  }
  return { React,
    render(component, props) { cursor = 0; const tree = component(props); effects.splice(0).forEach((effect) => effect()); return tree },
    state: () => hooks[0].value,
    lateUpdates: () => lateUpdates,
    unmount() { if (unmounted) return; unmounted = true; hooks.forEach((hook) => hook.cleanup?.()) },
  }
}

async function setup({ failure, hold = false } = {}) {
  const ui = harness(), calls = [], commits = []
  const oldDocument = globalThis.document
  let restoredFocus = false, closed = 0, manual = 0, resolvePending, valid = true, released = false, projectionFails = false
  globalThis.document = { activeElement: { isConnected: true, focus() { restoredFocus = true } } }
  const frame = { id: 'frame-test', dataUrl: 'image', width: 640, height: 480, point: [0.5, 0.5],
    release() { released = true }, isValid: () => valid && !released }
  const ground = { complete: true, points: [1, 2, 3] }
  globalThis.__earthVisionTestDeps = { React: ui.React,
    captureVisionFrame: () => frame,
    projectVisionPolygon() { if (projectionFails) throw Object.assign(new Error(), { code: 'depth_unavailable' }); return ground },
    async visionRequest(url, options) {
      calls.push(options)
      if (!options.frame) {
        if (failure) throw Object.assign(new Error(), { code: failure })
        return { ok: true }
      }
      if (hold) return new Promise((resolve) => { resolvePending = resolve })
      return { polygon: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]], shape: 'polygon', model: 'test-model' }
    },
  }
  const source = (await readFile(new URL('../src/client/ui/vision-select.js', import.meta.url), 'utf8'))
    .replace("import React from 'react'", 'const { React } = globalThis.__earthVisionTestDeps')
    .replace("import { captureVisionFrame, projectVisionPolygon } from '../scene/vision-frame.js'", 'const { captureVisionFrame, projectVisionPolygon } = globalThis.__earthVisionTestDeps')
    .replace("import { visionRequest } from '../scene/vision-request.js'", 'const { visionRequest } = globalThis.__earthVisionTestDeps')
  const { VisionSelect } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + `#${Math.random()}`)
  delete globalThis.__earthVisionTestDeps
  const props = { controller: { getMeta: () => ({ visionUrl: '/vision/token' }), getViewer: () => ({}), getCesium: () => ({}), getLayers: () => [] },
    anchor: {}, t: (key) => key, onClose() { closed++; ui.unmount() }, onCommit: (selection) => commits.push(selection), onManual() { manual++ } }
  const render = () => ui.render(VisionSelect, props)
  return { ui, calls, commits, frame, ground, render,
    resolve() { resolvePending({ polygon: [], shape: 'polygon' }) }, invalidate() { valid = false }, failProjection() { projectionFails = true },
    closed: () => closed, manual: () => manual, focused: () => restoredFocus, released: () => released,
    restore() { ui.unmount(); if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument },
  }
}

function button(tree, label) {
  if (!tree || typeof tree !== 'object') return null
  if (tree.type === 'button' && tree.children.includes(label)) return tree
  for (const child of tree.children ?? []) { const found = button(child, label); if (found) return found }
  return null
}

test('视觉预览：结果出现不提交，确认才提交；关闭恢复焦点和相机资源', async () => {
  const env = await setup()
  try {
    env.render(); await tick()
    assert.equal(env.ui.state().phase, 'preview')
    assert.equal(env.commits.length, 0)
    assert.equal(env.calls.length, 2)
    button(env.render(), 'vision.accept').props.onClick()
    assert.deepEqual(env.commits, [env.ground])
    assert.equal(env.closed(), 1)
    assert.equal(env.released(), true)
    assert.equal(env.focused(), true)
  } finally { env.restore() }
})

test('视觉预览：取消中断请求，迟到响应不提交、不更新已卸载 UI', async () => {
  const env = await setup({ hold: true })
  try {
    env.render(); await tick()
    button(env.render(), 'vision.cancel').props.onClick()
    assert.equal(env.calls[1].signal.aborted, true)
    assert.equal(env.released(), true)
    env.resolve(); await tick()
    assert.equal(env.commits.length, 0)
    assert.equal(env.ui.lateUpdates(), 0)
    assert.equal(env.calls.length, 2)
  } finally { env.restore() }
})

test('视觉预览：非视觉模型不取景；失败提供手动入口，不转交 Agent', async () => {
  const env = await setup({ failure: 'model_not_visual' })
  try {
    env.render(); await tick()
    assert.equal(env.ui.state().error, 'model_not_visual')
    assert.equal(env.ui.state().frame, null)
    assert.equal(env.calls.length, 1)
    button(env.render(), 'vision.manual').props.onClick()
    assert.equal(env.closed(), 1)
    assert.equal(env.manual(), 1)
    assert.equal(env.commits.length, 0)
  } finally { env.restore() }
})

test('视觉预览：深度失败保留预览并禁用采用；场景变化使结果失效', async () => {
  const env = await setup()
  try {
    env.render(); await tick()
    env.failProjection()
    button(env.render(), 'vision.accept').props.onClick()
    assert.equal(env.ui.state().error, 'depth_unavailable')
    assert.equal(button(env.render(), 'vision.accept').props.disabled, true)
    assert.equal(env.commits.length, 0)
    env.invalidate()
    await new Promise((resolve) => setTimeout(resolve, 180))
    assert.equal(env.ui.state().error, 'scene_changed')
    assert.equal(env.released(), true)
    assert.equal(env.calls.length, 2)
  } finally { env.restore() }
})
