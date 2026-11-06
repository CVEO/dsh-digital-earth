/**
 * v1.6 Phase 2 (first slice) — the analysis engine is its own module.
 *
 * ViewerSurface hit its line budget, so the profile/flood/sunlight engine moved to
 * src/client/analysis/engine.js behind a factory that receives lazy ref getters.
 * These assertions keep the split from silently reverting (someone pasting the
 * engine back into the component) and keep the line budget honest.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readRepoFile, clientSource } from './helpers/source.mjs'

const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
const engine = readRepoFile('src/client/analysis/engine.js')

test('拆分：分析引擎在单独模块里，ViewerSurface 只保留接线', () => {
  for (const fn of ['analyzeProfile', 'analyzeFlood', 'analyzeSunlight', 'analyzeCommand', 'clearAnalysis', 'restoreAnalysisScene']) {
    assert.ok(engine.includes(fn), `engine 缺少 ${fn}`)
    assert.ok(!viewer.includes(`const ${fn} = async`), `ViewerSurface 仍内联 ${fn}`)
  }
  assert.match(viewer, /import \{ createAnalysisEngine \} from '\.\.\/analysis\/engine\.js'/)
  assert.match(viewer, /const analysisEngine = createAnalysisEngine\(\{/)
  assert.match(viewer, /const clearAnalysis = \(\) => analysisEngine\.clear\(\)/)
  assert.match(viewer, /const analyzeCommand = \(args = \{\}\) => analysisEngine\.command\(args\)/)
})

test('拆分：engine 用惰性 ref getter，不持有过期的 viewer/layer 列表', () => {
  assert.match(engine, /export function createAnalysisEngine\(deps\)/)
  for (const getter of ['getCesium', 'getViewer', 'getLayers', 'findLayer', 'setAnalysis', 'markSceneDirty']) {
    assert.ok(engine.includes(getter), `engine 依赖缺少 ${getter}`)
  }
  assert.match(engine, /get current\(\) \{ return deps\.getViewer\(\) \}/)
  assert.match(viewer, /getViewer: \(\) => viewerRef\.current/)
})

test('拆分：引擎块标记与错误契约原样保留（旧结构测试仍然有效）', () => {
  assert.match(engine, /\/\/#region analysis engine/)
  assert.match(engine, /\/\/#endregion analysis engine/)
  // 每个引擎错误仍带 next:（v140-batch2 的结构断言依赖它）。
  const block = engine.slice(engine.indexOf('//#region analysis engine'), engine.indexOf('//#endregion analysis engine'))
  const throws = [...block.matchAll(/throw new Error\(/g)]
  assert.ok(throws.length >= 10, `引擎异常分支过少：${throws.length}`)
  for (const match of throws) {
    const tail = block.slice(match.index, match.index + 600)
    assert.match(tail, /next:/, '引擎错误缺少 next:')
  }
})

test('拆分：行数预算收紧后两条约束都成立', () => {
  assert.ok(viewer.split('\n').length < 3800, `ViewerSurface 行数 ${viewer.split('\n').length} 超过 3800`)
  assert.ok(engine.split('\n').length < 600, `engine 行数 ${engine.split('\n').length} 超过 600`)
  // 引擎不再依赖任何 React 组件状态，只有一个纯工厂导出。
  assert.doesNotMatch(engine, /React\./)
})
