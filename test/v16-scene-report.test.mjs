/**
 * v1.6 Phase 2 — the scene report builder is its own module.
 *
 * The p2 suite already pins the report TEXT rules against the source; these tests
 * exercise `createSceneReport(deps)` for real: Markdown vs self-contained HTML, the
 * section list, capture opt-out/failure, and that stale/empty state degrades to
 * "none" instead of throwing.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createSceneReport } from '../src/client/scene/report.js'

const formatDistance = (meters) => `${Math.round(meters)} m`
const formatArea = (area) => `${Math.round(area)} m²`

function makeReport(overrides = {}) {
  return createSceneReport({
    getSession: () => 's1',
    getAgentOverlays: () => ({
      measureCommands: [{ result: { mode: 'distance', distance_m: 1234 } }, { result: { mode: 'area', area_m2: 5000 } }],
    }),
    getAnalysis: () => ({
      result: { operation: 'profile', length_m: 2000, stats: { relief_m: 123 } },
    }),
    captureScene: async () => ({ path: '/tmp/shot.jpg', width: 1000, height: 563, url: '' }),
    collectSceneStatus: async () => ({
      view: { lon: 114.3, lat: 30.5, height: 800, heading: 10, pitch: -45 },
      layers: [
        { name: 'A', visible: true },
        { name: 'B', visible: false },
      ],
      imagery: { name: 'Esri' },
      terrain: { name: 'ArcGIS' },
      annotations: { drawn_features: 3, measured_points: 5 },
    }),
    shaderActiveList: () => [{ layer: 'A', preset: 'contour' }],
    formatDistance,
    formatArea,
    escapeHtml: (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    message: (error) => (error && typeof error.message === 'string' ? error.message : String(error)),
    arrayBufferToBase64: () => 'AAAA',
    isChinese: () => false,
    ...overrides,
  })
}

test('Markdown 报告：相机/图层表/环境/叠加/量测/分析/着色器/截图小节齐全', async () => {
  const report = await makeReport().buildSceneReport({ format: 'markdown' })
  assert.equal(report.format, 'markdown')
  assert.equal(report.label, 'scene')
  for (const section of ['camera', 'layers', 'basemap & terrain', 'measurements', 'analysis', 'shaders', 'snapshot']) {
    assert.ok(report.sections.includes(section), `缺少小节 ${section}`)
  }
  assert.match(report.content, /^# Digital Earth scene report/)
  assert.match(report.content, /\| Name \| Visibility \|/)
  assert.match(report.content, /\| A \| visible \|/)
  assert.match(report.content, /\| B \| hidden \|/)
  assert.match(report.content, /Distance: 1234 m/)
  assert.match(report.content, /Area: 5000 m²/)
  assert.match(report.content, /3D profile: 2000 m/)
  assert.match(report.content, /A — contour/)
  assert.match(report.content, /!\[Current view\]\(\/tmp\/shot\.jpg\)/)
  assert.deepEqual(report.failed, [])
})

test('HTML 报告：自包含、转义图层名、内嵌 base64 截图', async () => {
  const html = await makeReport({
    captureScene: async () => ({ path: '/tmp/shot.jpg', width: 10, height: 10, url: 'https://host/shot.jpg' }),
  }).buildSceneReport({ format: 'html', title: 'My <Scene>' })
  assert.match(html.content, /<!doctype html>/)
  assert.match(html.content, /<title>My &lt;Scene&gt;<\/title>/)
  assert.match(html.content, /<table>/)
  assert.match(html.content, /<td>A<\/td>/)
  // fetch 默认不可用（测试里没 stub）→ 保留路径，不内嵌 base64。
  assert.match(html.content, /\/tmp\/shot\.jpg/)
  assert.doesNotMatch(html.content, /data:image/)
})

test('include_capture=false 不截图、不产生 snapshot 小节', async () => {
  let captures = 0
  const report = await makeReport({
    captureScene: async () => {
      captures += 1
      return { path: '/tmp/x.jpg' }
    },
  }).buildSceneReport({ format: 'markdown', include_capture: false })
  assert.equal(captures, 0)
  assert.equal(report.sections.includes('snapshot'), false)
})

test('截图失败只记入 failed，报告仍然生成', async () => {
  const report = await makeReport({
    captureScene: async () => {
      throw new Error('agent: hiddenPanel next: show the panel')
    },
  }).buildSceneReport({ format: 'markdown' })
  assert.equal(report.sections.includes('snapshot'), false)
  assert.ok(report.failed.some((line) => line.startsWith('snapshot: ')))
  assert.match(report.content, /Digital Earth scene report/)
})

test('状态不可用/无分析时退化为 none，不抛错', async () => {
  const report = await makeReport({
    collectSceneStatus: async () => {
      throw new Error('cold viewer')
    },
    getAnalysis: () => null,
    getAgentOverlays: () => ({ measureCommands: [] }),
    shaderActiveList: () => [],
    captureScene: async () => ({ path: '' }),
  }).buildSceneReport({ format: 'markdown' })
  assert.match(report.content, /Camera/)
  assert.match(report.content, /- none/)
  assert.equal(report.sections.includes('measurements'), false)
  assert.equal(report.sections.includes('analysis'), false)
  assert.equal(report.sections.includes('shaders'), false)
})
