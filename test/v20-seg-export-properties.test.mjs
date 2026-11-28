/**
 * v20 — 2D extraction properties must survive store → GeoJSON export.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { createAnnotationStore } = await import('../src/client/scene/annotation-store.js')
const { buildGeoJsonExport } = await import('../src/client/scene/annotation-export.js')

test('提取属性经 store 后导出：class/class_name/color/source 不丢，仍为 2D', () => {
  const store = createAnnotationStore()
  store.startRun({ mode: 'auto', source: 'ortho', scope: 'view', classes: ['water'] })
  const [id] = store.addCandidates([{
    type: 'Feature',
    properties: {
      class: '水体', class_key: 'water', class_name: '水体', color: '#38bdf8',
      clippedAtTileEdge: true, source: 'ortho', source_kind: 'ortho', area_m2: 812.3,
    },
    geometry: { type: 'Polygon', coordinates: [[[114.3, 30.5], [114.301, 30.5], [114.301, 30.501], [114.3, 30.5]]] },
  }])
  store.setStatus([id], 'accepted')
  const exported = buildGeoJsonExport(store.accepted(), { withZ: false })
  assert.equal(exported.count, 1)
  const props = exported.collection.features[0].properties
  assert.equal(props.class, '水体')
  assert.equal(props.class_name, '水体')
  assert.equal(props.color, '#38bdf8')
  assert.equal(props.source, 'ortho')
  assert.equal(props.clippedAtTileEdge, true)
  const ring = exported.collection.features[0].geometry.coordinates[0][0]
  assert.equal(ring.length, 2, '2D geometry has no Z')
})
