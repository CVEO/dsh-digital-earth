/**
 * First-render smoke test: execute the shipped client bundle and render the panel
 * component tree once. This is the only test that can catch runtime wiring errors
 * (TDZ, missing import, bad factory deps) that build cleanly and pass all static
 * tests but blank the real panel — two such bugs shipped in v1.6 before this test
 * existed (`collectSceneStatus` TDZ and an unimported `createWorkbenchWiring`).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { renderPanelOnce } from './helpers/render-smoke.mjs'

test('渲染冒烟：client.js 能加载、插件能注册，面板首帧渲染不抛异常', () => {
  const result = renderPanelOnce()
  // ViewerPanel -> ViewerSurface -> LayersPanel/卡片等；至少要有几层真正执行过。
  assert.ok(result.rendered >= 5, `渲染到的组件过少：${result.rendered}`)
})
