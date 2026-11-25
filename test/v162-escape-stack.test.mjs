/**
 * v1.6.2 — global Escape stack (B 遗留收口).
 *
 * One window listener, LIFO layers, and the topmost handler alone consumes the
 * press. The second block proves the panel-level listeners that used to race
 * now go through the stack (dialogs stay on their capture-phase listener).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

const listeners = new Map()
const previousDocument = globalThis.document
globalThis.document = {
  addEventListener(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(handler)
  },
  removeEventListener(type, handler) {
    listeners.get(type)?.delete(handler)
  },
}

const { registerEscapeLayer, escapeLayerCount } = await import('../src/client/ui/escape-stack.js')

const press = (key = 'Escape') => {
  const event = { key, prevented: false, stopped: false }
  for (const handler of listeners.get('keydown') ?? []) handler(event)
  return event
}

test.after(() => {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
})

test('栈式消费：只有最上层处理一次 Esc，低层不重复触发', () => {
  const calls = []
  const disposeBottom = registerEscapeLayer(() => {
    calls.push('bottom')
    return true
  })
  const disposeTop = registerEscapeLayer(() => {
    calls.push('top')
    return true
  })
  assert.equal(escapeLayerCount(), 2)

  press()
  assert.deepEqual(calls, ['top'], '一次 Esc 只交给最上层')
  press('Enter')
  assert.deepEqual(calls, ['top'], '非 Esc 不触发')

  disposeTop()
  press()
  assert.deepEqual(calls, ['top', 'bottom'], '顶层注销后由下一层接手')
  disposeBottom()
  press()
  assert.deepEqual(calls, ['top', 'bottom'], '栈空后不再触发')
  assert.equal(escapeLayerCount(), 0)
  assert.equal(listeners.get('keydown')?.size ?? 0, 0, '空栈时移除 window/document 监听')
})

test('返回 false 表示“不归我”，事件继续下传；latest handler 不为闭包失效', () => {
  const calls = []
  let handle = () => {
    calls.push('first')
    return false
  }
  const disposeBottom = registerEscapeLayer(() => {
    calls.push('bottom')
    return true
  })
  const disposeTop = registerEscapeLayer(() => handle())
  press()
  assert.deepEqual(calls, ['first', 'bottom'], '顶层拒绝后下层仍可处理')

  calls.length = 0
  handle = () => {
    calls.push('latest')
    return true
  }
  press()
  assert.deepEqual(calls, ['latest'], '处理函数保持最新闭包')
  disposeTop()
  disposeBottom()
})

test('面板级 Esc 监听已迁入统一栈（对话框保留 capture 监听）', () => {
  const repo = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const viewer = repo('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /useEscapeLayer\(\(\) => \{\s*setScan\(null\)/)
  assert.match(viewer, /useEscapeLayer\(\(\) => \{\s*finishMeasure\(\)/)
  assert.doesNotMatch(viewer, /if \(event\.key === 'Escape'\) finishMeasure\(\)/)
  assert.match(repo('src/client/ui/tour-bar.js'), /useEscapeLayer\(\(\) => \{\s*setState\(null\)/)
  assert.match(repo('src/client/ui/scene-details.js'), /useEscapeLayer\(\(\) => \{\s*setFocus\(null\)/)
  assert.match(repo('src/client/ui/panel-rail.js'), /useEscapeLayer\(\(event\) => \{/)
  // The modal still owns capture so it beats the whole stack.
  assert.match(repo('src/client/ui/use-dialog-a11y.js'), /addEventListener\('keydown', onKeyDown, true\)/)
})
