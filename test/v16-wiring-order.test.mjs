/**
 * v1.6 wiring-order guard.
 *
 * The Phase-2 extractions wire factories (`createCaptureService`, `createAskAgent`,
 * `createSceneReport`, `createCommandBridge`, …) during render, passing handlers
 * and refs by reference. A wiring that references a `const` declared LATER in the
 * same function body throws a TDZ ReferenceError on first render — the panel goes
 * white even though the bundle builds and all structural tests pass.
 *
 * This test walks every wiring block and fails when a dependency resolves to a
 * `const`/`let` defined after the wiring. Function declarations are allowed: they
 * are hoisted, so referencing them earlier is safe.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readRepoFile } from './helpers/source.mjs'

const SOURCE_PATH = 'src/client/viewer/ViewerSurface.js'
const WIRINGS = [
  'const hostSceneStore = createHostSceneStore(',
  'const pointerTools = createPointerTools(',
  'const capture = createCaptureService(',
  'const askAgentService = createAskAgent(',
  'const sceneReport = createSceneReport(',
  'const sceneStatus = createSceneStatus(',
  'const commandBridge = createCommandBridge(',
  'const analysisEngine = createAnalysisEngine(',
  'const shaderEngine = createShaderEngine(',
  'const workbench = createWorkbenchWiring(',
]

function definitionOf(lines, name) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (new RegExp(`^\\s*(const|let|var)\\s+${name}\\s*[=,]`).test(line)) return { index, kind: 'const' }
    if (new RegExp(`^\\s*(async\\s+)?function\\s+${name}\\s*\\(`).test(line)) return { index, kind: 'function' }
  }
  return null
}

function dependenciesOf(lines, start) {
  let end = start + 1
  while (end < lines.length && lines[end].trim() !== '})') end += 1
  const names = []
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index]
    const named = /^\s+([A-Za-z_$][\w$]*):\s*(.*)$/.exec(line)
    if (named) {
      // `name: () => something()` is lazy: the inner reference is read at call
      // time (after render), so a later const is safe.
      if (named[2].includes('=>')) continue
      names.push(named[1])
      continue
    }
    const shorthand = /^\s+([A-Za-z_$][\w$]*),\s*$/.exec(line)
    if (shorthand) names.push(shorthand[1])
  }
  return names
}

test('所有渲染期工厂接线只引用已定义/可提升的依赖（防止 TDZ 白屏）', () => {
  const lines = readRepoFile(SOURCE_PATH).split('\n')
  const offenders = []
  for (const marker of WIRINGS) {
    const start = lines.findIndex((line) => line.includes(marker))
    assert.notEqual(start, -1, `找不到接线：${marker}`)
    for (const name of dependenciesOf(lines, start)) {
      const definition = definitionOf(lines, name)
      if (definition === null) continue // imported (top of file) or global
      if (definition.kind === 'const' && definition.index > start) {
        offenders.push(`${marker.trim()} 在第 ${start + 1} 行引用了第 ${definition.index + 1} 行才定义的 const ${name}`)
      }
    }
  }
  assert.deepEqual(offenders, [], `发现前向 const 引用（首帧渲染会白屏）：\n${offenders.join('\n')}`)
})

test('collectSceneStatus 必须是可提升的函数（askAgent/report 接线早于其定义）', () => {
  const source = readRepoFile(SOURCE_PATH)
  assert.match(source, /function collectSceneStatus\(\) \{/, 'collectSceneStatus 必须是 function 声明而不是 const')
  assert.doesNotMatch(source, /const collectSceneStatus\s*=/)
})
