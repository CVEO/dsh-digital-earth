/**
 * v20 — client Agent extraction helper: class resolution + payload compaction.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { resolveAgentClasses, compactExtractionCollection, runAgentExtraction } = await import('../src/client/scene/agent-extract.js')

test('resolveAgentClasses：默认全部 8 类，支持默认类名/key 与自定义类', () => {
  const all = resolveAgentClasses([])
  assert.equal(all.length, 8)
  assert.equal(all[0].key, 'building')

  const selected = resolveAgentClasses(['building', '水体'])
  assert.deepEqual(selected.map((entry) => entry.name), ['建筑', '水体'])

  assert.deepEqual(resolveAgentClasses(['水体', '温室', '水体', '建筑']).map(c => c.id), [2, 9, 1])
  const custom = resolveAgentClasses(['温室'])
  assert.equal(custom.length, 1)
  assert.equal(custom[0].name, '温室')
  assert.match(custom[0].definition, /用户自定义/)
})

test('compactExtractionCollection：返回上限内 GeoJSON 并标记截断', () => {
  const features = Array.from({ length: 5 }, (_, index) => ({ type: 'Feature', properties: { id: index } }))
  const compact = compactExtractionCollection({ type: 'FeatureCollection', features }, 3)
  assert.equal(compact.count, 5)
  assert.equal(compact.truncated, true)
  assert.equal(compact.collection.features.length, 3)
})

test('runAgentExtraction：clear 只清叠加层，不调用分割', async () => {
  let removed = 0
  const value = await runAgentExtraction({
    viewer: {}, Cesium: {}, clear: true,
    clearAgent: () => { removed += 1; return { removed: 4 } },
  })
  assert.equal(removed, 1)
  assert.equal(value.count, 0)
  assert.equal(value.report.cleared, 4)
})
