import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

function harness() {
  const hooks = [], effects = []
  let cursor = 0, unmounted = false, late = 0
  const slot = (create) => hooks[cursor++] ??= create()
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const state = slot(() => ({ value: initial }))
      return [state.value, (value) => { if (unmounted) late++; state.value = value }]
    },
    useRef(initial) { return slot(() => ({ current: initial })) },
    useEffect(callback, dependencies) {
      const effect = slot(() => ({}))
      if (!effect.dependencies || dependencies.some((value, index) => !Object.is(value, effect.dependencies[index]))) {
        effects.push(() => { effect.cleanup?.(); effect.dependencies = dependencies; effect.cleanup = callback() })
      }
    },
  }
  return { React, render(component, props) { cursor = 0; const tree = component(props); effects.splice(0).forEach((effect) => effect()); return tree },
    unmount() { unmounted = true; hooks.forEach((hook) => hook.cleanup?.()) }, late: () => late }
}
const nodes = (tree) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...tree.children.flatMap(nodes)]
async function setup() {
  const ui = harness()
  globalThis.__earthQuestionReact = ui.React
  const source = (await readFile(new URL('../src/client/ui/selection-question.js', import.meta.url), 'utf8'))
    .replace("import React from 'react'", 'const React = globalThis.__earthQuestionReact')
    .replace("'../scene/selection-question.js'", JSON.stringify(new URL('../src/client/scene/selection-question.js', import.meta.url).href))
  const { SelectionQuestion } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#' + Math.random())
  delete globalThis.__earthQuestionReact
  return { ui, component: SelectionQuestion }
}

test('选区提问 UI：默认展开但不自动调用；快捷问题、重复提交、失败重试与确认回执', async () => {
  const { ui, component } = await setup()
  const calls = []
  let settle, reject
  const props = { selection: { kind: 'point', lon: 113, lat: 31, frame: { image: 'saved-view' } }, t: (key) => key,
    onAskSelection(options) { calls.push(options); return new Promise((resolve, fail) => { settle = resolve; reject = fail }) } }
  let tree = ui.render(component, props)
  assert.equal(tree.type, 'form')
  assert.equal(calls.length, 0)
  assert.equal(nodes(tree).find((node) => node.props?.type === 'submit').props.disabled, true)
  nodes(tree).find((node) => node.type === 'textarea').props.onChange({ target: { value: '这里是什么？' } })
  tree = ui.render(component, props)
  const first = tree.props.onSubmit({ preventDefault() {} })
  await tree.props.onSubmit({ preventDefault() {} })
  assert.equal(calls.length, 1)
  reject(Object.assign(new Error('unknown'), { code: 'delivery_unknown' }))
  await first
  tree = ui.render(component, props)
  assert.equal(nodes(tree).find((node) => node.props?.role === 'alert').children[0], 'question.error.delivery_unknown')
  const second = tree.props.onSubmit({ preventDefault() {} })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].requestId, calls[1].requestId)
  settle({ accepted: true })
  await second
  tree = ui.render(component, props)
  assert.ok(nodes(tree).some((node) => node.props?.role === 'status' && node.children.includes('question.sent')))
  assert.equal(nodes(tree).find((node) => node.props?.type === 'submit').props.disabled, true)
  ui.unmount()
})

test('选区提问 UI：关闭保留入口；离开选区后迟到的回执不更新卸载组件', async () => {
  const { ui, component } = await setup()
  let accept
  const props = { selection: { kind: 'screen' }, t: (key) => key,
    onAskSelection: () => new Promise((resolve) => { accept = resolve }) }
  let tree = ui.render(component, props)
  nodes(tree).find((node) => node.props?.['aria-label'] === 'question.close').props.onClick()
  tree = ui.render(component, props)
  assert.equal(tree.type, 'button')
  tree.props.onClick()
  tree = ui.render(component, props)
  nodes(tree).find((node) => node.type === 'textarea').props.onChange({ target: { value: 'question' } })
  tree = ui.render(component, props)
  const pending = tree.props.onSubmit()
  ui.unmount()
  accept({ accepted: true })
  await pending
  assert.equal(ui.late(), 0)
})
