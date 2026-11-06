/**
 * v1.6 Phase 2 — L4 vector overlays are editable.
 *
 * ViewerSurface keeps the entities; `src/client/scene/agent-overlays.js` owns the
 * row list and the per-row removal (entity group + command + counters). A command
 * stores its entities in a WeakMap (`state.entityGroups`) so scene snapshots stay
 * JSON-clean, which is asserted here as well.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildAgentOverlayList, clearAgentOverlays, removeAgentOverlay } from '../src/client/scene/agent-overlays.js'
import { readRepoFile } from './helpers/source.mjs'

const entity = (id) => ({ id })
const fakeViewer = () => {
  const removed = []
  return {
    removed,
    entities: {
      remove: (item) => {
        removed.push(item.id)
      },
    },
  }
}

const state = () => ({
  draw: [entity('d1'), entity('d2'), entity('d3')],
  measure: [entity('m1'), entity('m2')],
  drawnFeatures: 3,
  measuredCount: 2,
  drawCommands: [
    { geojson: { type: 'Point' }, style: 'accent', drawn: 1, caption: '风险点' },
    { geojson: { type: 'FeatureCollection', features: [{}, {}] }, style: 'alert', drawn: 2 },
  ],
  measureCommands: [
    { mode: 'distance', points: [[0, 0], [0, 1]], draw: true, result: { distance_m: 1234.5 } },
    { mode: 'area', points: [[0, 0], [0, 1], [1, 1]], draw: true, result: { area_m2: 9876.5 } },
  ],
  entityGroups: new WeakMap(),
})

function seedGroups(s) {
  s.entityGroups.set(s.drawCommands[0], [s.draw[0]])
  s.entityGroups.set(s.drawCommands[1], [s.draw[1], s.draw[2]])
  s.entityGroups.set(s.measureCommands[0], [s.measure[0]])
  s.entityGroups.set(s.measureCommands[1], [s.measure[1]])
  return s
}

test('列表：标注与量测各一行，带名称/要素数/量测值', () => {
  const rows = buildAgentOverlayList(seedGroups(state()))
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[0], { id: 'draw-0', kind: 'draw', index: 0, label: '风险点', detail: '1 要素' })
  assert.deepEqual(rows[1].label, '标注 2')
  assert.equal(rows[1].detail, '2 要素')
  assert.equal(rows[2].label, '量测 1')
  assert.ok(rows[2].detail.includes('distance'))
  assert.ok(rows[2].detail.includes('1234.5 m'))
  assert.ok(rows[3].detail.includes('area'))
  assert.ok(rows[3].detail.includes('9876.5 m²'))
  // 空状态给空列表，面板不会崩。
  assert.deepEqual(buildAgentOverlayList({ drawCommands: [], measureCommands: [] }), [])
})

test('移除单行：删除实体组 + 命令 + 计数，其它行不受影响', () => {
  const s = seedGroups(state())
  const viewer = fakeViewer()
  assert.equal(removeAgentOverlay(s, viewer, 'draw', 1), true)
  assert.deepEqual(viewer.removed, ['d2', 'd3'])
  assert.equal(s.drawCommands.length, 1)
  assert.equal(s.draw.length, 1, 'draw 实体列表同步缩短')
  assert.equal(s.drawnFeatures, 1)
  assert.equal(s.measureCommands.length, 2, '量测行不受影响')

  assert.equal(removeAgentOverlay(s, viewer, 'measure', 0), true)
  assert.deepEqual(viewer.removed, ['d2', 'd3', 'm1'])
  // 第一条量测有 2 个点：2-2 = 0。
  assert.equal(s.measuredCount, 0)
  assert.equal(removeAgentOverlay(s, viewer, 'measure', 9), false)
  assert.equal(removeAgentOverlay(s, viewer, 'nope', 0), false)
})

test('清除：all / draw / measure 各自清实体与计数', () => {
  const all = seedGroups(state())
  const viewer = fakeViewer()
  clearAgentOverlays(all, viewer, 'all')
  assert.equal(all.draw.length + all.measure.length, 0)
  assert.equal(all.drawnFeatures, 0)
  assert.equal(all.measuredCount, 0)
  assert.equal(all.drawCommands.length + all.measureCommands.length, 0)
  assert.equal(viewer.removed.length, 5)

  const drawOnly = seedGroups(state())
  clearAgentOverlays(drawOnly, fakeViewer(), 'draw')
  assert.equal(drawOnly.drawCommands.length, 0)
  assert.equal(drawOnly.measureCommands.length, 2, 'measure 应保留')
  assert.equal(drawOnly.measure.length, 2)

  // viewer 已销毁时不抛错。
  const gone = seedGroups(state())
  clearAgentOverlays(gone, null, 'all')
  assert.equal(gone.draw.length, 0)
})

test('快照安全：实体只放在 WeakMap 里，命令 JSON 保持干净', () => {
  const s = seedGroups(state())
  const json = JSON.stringify({ draw: s.drawCommands, measure: s.measureCommands })
  assert.match(json, /风险点/)
  assert.doesNotMatch(json, /d1|m1/, '实体对象不能进入快照 JSON')
  // 源码层面确认 ViewerSurface 使用的是 entityGroups 而不是命令内嵌实体。
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(viewer, /entityGroups: new WeakMap\(\)/)
  assert.match(viewer, /state\.entityGroups\.set\(command, state\.draw\.slice\(firstEntity\)\)/)
  assert.match(viewer, /state\.entityGroups\.set\(command, state\.measure\.slice\(firstEntity\)\)/)
  assert.match(viewer, /agentOverlays: buildAgentOverlayList\(agentOverlayRef\.current\)/)
})
