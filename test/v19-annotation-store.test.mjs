/**
 * v1.9 — the review queue store: candidate intake, status flow, patches, undo/redo,
 * copy-on-read and class statistics. These are the guarantees the workbench panel
 * and the export both depend on, so they are locked down without any UI.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const {
  ANNOTATION_CARRIED_KEYS,
  ANNOTATION_PATCHABLE_KEYS,
  ANNOTATION_REFINE_KEYS,
  ANNOTATION_REPLACE_KEYS,
  ANNOTATION_UNDO_LIMIT,
  createAnnotationStore,
} = await import('../src/client/scene/annotation-store.js')

/** Deterministic millisecond clock: every read advances one second. */
function makeClock(start = 1700000000000) {
  let value = start
  return () => {
    value += 1000
    return value
  }
}

const SQUARE = [
  [100, 30],
  [100.001, 30],
  [100.001, 30.001],
  [100, 30.001],
  [100, 30],
]

/** Minimal vision result polygon with optional properties. */
function polygon(properties = {}, coordinates = SQUARE) {
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [coordinates] } }
}

function storeWithClock() {
  return createAnnotationStore({ now: makeClock(), idPrefix: 'A' })
}

test('startRun 返回运行元数据并把队列重置为空', () => {
  const store = storeWithClock()
  const before = store.getState()
  assert.equal(before.run_id, null)
  assert.deepEqual(before.candidates, [])
  assert.deepEqual(before.counts, { total: 0, pending: 0, accepted: 0, rejected: 0 })

  const run = store.startRun({ mode: 'assist', source: '2d', scope: 'aoi', classes: ['建筑'] })
  assert.equal(typeof run.run_id, 'string')
  assert.ok(run.run_id.startsWith('R-'))
  assert.equal(run.mode, 'assist')
  assert.equal(run.source, '2d')
  assert.equal(run.scope, 'aoi')
  assert.deepEqual(run.classes, ['建筑'])
  assert.equal(typeof run.created_at, 'number')

  const state = store.getState()
  assert.equal(state.run_id, run.run_id)
  assert.equal(state.created_at, run.created_at)
})

test('addCandidates 补全 id/status/method/source/run_id/rev 并保留类别字段', () => {
  const store = storeWithClock()
  const run = store.startRun({ mode: 'auto', source: '3d' })
  const ids = store.addCandidates([
    polygon({
      class: '建筑',
      class_key: 'building',
      confidence: 0.82,
      height_m: 12.5,
      height_source: 'dsm',
      floors: 4,
      base_m: 3.2,
      roof_m: 15.7,
      area_m2: 128.4,
      name: '建筑 7',
      hex: '#ffce65',
      note: 'drop me',
    }),
  ])

  assert.deepEqual(ids, ['A-01'])
  const [candidate] = store.all()
  assert.equal(candidate.type, 'Feature')
  assert.deepEqual(candidate.geometry, { type: 'Polygon', coordinates: [SQUARE] })
  const props = candidate.properties
  assert.equal(props.id, 'A-01')
  assert.equal(props.status, 'pending')
  assert.equal(props.method, 'auto')
  assert.equal(props.source, '3d')
  assert.equal(props.run_id, run.run_id)
  assert.equal(props.rev, 1)
  assert.equal(props.class, '建筑')
  assert.equal(props.class_key, 'building')
  assert.equal(props.confidence, 0.82)
  assert.equal(props.height_m, 12.5)
  assert.equal(props.height_source, 'dsm')
  assert.equal(props.floors, 4)
  assert.equal(props.base_m, 3.2)
  assert.equal(props.roof_m, 15.7)
  assert.equal(props.area_m2, 128.4)
  assert.equal(props.name, '建筑 7')
  assert.equal(props.hex, '#ffce65')
  // Only whitelisted properties are carried; review-only leftovers do not stick.
  assert.equal('note' in props, false)
})

test('addCandidates 的 id 连续递增并尊重调用方给的 method/source', () => {
  const store = storeWithClock()
  store.startRun({ mode: 'auto', source: '3d' })
  const ids = store.addCandidates([
    polygon({ method: 'assist', source: '2d' }),
    polygon({}),
  ])
  assert.deepEqual(ids, ['A-01', 'A-02'])
  const rows = store.all()
  assert.equal(rows[0].properties.method, 'assist')
  assert.equal(rows[0].properties.source, '2d')
  assert.equal(rows[1].properties.method, 'auto')
  assert.equal(rows[1].properties.source, '3d')
})

test('addCandidates 忽略非对象条目并把 geometry 原样带走', () => {
  const store = storeWithClock()
  store.startRun({})
  const geometry = { type: 'Polygon', coordinates: [[[1, 2], [3, 4], [5, 6], [1, 2]]] }
  const ids = store.addCandidates([null, 42, 'x', { type: 'Feature', geometry }])
  assert.deepEqual(ids, ['A-01'])
  assert.deepEqual(store.all()[0].geometry, geometry)
  assert.equal(store.getState().counts.total, 1)
})

test('setStatus 只统计真正变化的条数，非法状态不改动', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon(), polygon(), polygon()])

  assert.equal(store.setStatus(['A-01', 'A-02'], 'accepted'), 2)
  assert.equal(store.setStatus(['A-01', 'A-02'], 'accepted'), 0)
  assert.equal(store.setStatus('A-03', 'rejected'), 1)
  assert.equal(store.setStatus(['A-09'], 'accepted'), 0)
  assert.equal(store.setStatus(['A-01'], 'done'), 0)

  assert.deepEqual(store.getState().counts, { total: 3, pending: 0, accepted: 2, rejected: 1 })
  // Status flow is not a content edit: rev stays 1.
  assert.equal(store.all()[0].properties.rev, 1)
})

test('patch 只接受白名单键并递增 rev', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ name: '建筑 1', height_m: null })])

  assert.equal(store.patch('A-01', { name: '厂房', height_m: 8.5, floors: 3 }), true)
  const patched = store.all()[0].properties
  assert.equal(patched.name, '厂房')
  assert.equal(patched.height_m, 8.5)
  assert.equal(patched.floors, 3)
  assert.equal(patched.rev, 2)

  // Unknown keys only: the call is a no-op, not a success.
  assert.equal(store.patch('A-01', { status: 'accepted', id: 'Z-99', note: 'x' }), false)
  const untouched = store.all()[0].properties
  assert.equal(untouched.rev, 2)
  assert.equal(untouched.id, 'A-01')
  assert.equal(untouched.status, 'pending')

  assert.equal(store.patch('A-99', { name: 'nope' }), false)
  assert.equal(store.patch('A-01', {}), false)
  // undefined is ignored instead of wiping a field.
  assert.equal(store.patch('A-01', { name: undefined }), false)
  assert.equal(store.all()[0].properties.name, '厂房')
  assert.ok(ANNOTATION_PATCHABLE_KEYS.includes('height_source'))
})

test('undo 撤销 addCandidates 清空队列，redo 恢复候选与 id', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ class: '建筑' }), polygon({ class: '水体' })])

  const undone = store.undo()
  assert.equal(undone.ok, true)
  assert.equal(typeof undone.label, 'string')
  assert.deepEqual(store.all(), [])
  assert.equal(store.getState().counts.total, 0)

  const redone = store.redo()
  assert.equal(redone.ok, true)
  assert.equal(redone.label, undone.label)
  assert.deepEqual(store.all().map((row) => row.properties.id), ['A-01', 'A-02'])
})

test('undo 撤销 patch 恢复旧值、rev 与状态', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ name: '建筑 1', height_m: null })])

  store.patch('A-01', { name: '厂房', height_m: 9 })
  assert.equal(store.all()[0].properties.rev, 2)
  store.undo()
  const restored = store.all()[0].properties
  assert.equal(restored.name, '建筑 1')
  assert.equal(restored.height_m, null)
  assert.equal(restored.rev, 1)

  store.redo()
  assert.equal(store.all()[0].properties.name, '厂房')
  assert.equal(store.all()[0].properties.rev, 2)
})

test('undo 撤销 remove 恢复原有顺序', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ class: '建筑' }), polygon({ class: '水体' }), polygon({ class: '道路' })])

  assert.equal(store.remove(['A-02']), 1)
  assert.deepEqual(store.all().map((row) => row.properties.id), ['A-01', 'A-03'])

  assert.equal(store.undo().ok, true)
  assert.deepEqual(store.all().map((row) => row.properties.id), ['A-01', 'A-02', 'A-03'])
  assert.equal(store.remove([]), 0)
  assert.equal(store.remove(['A-77']), 0)
})

test('undo 撤销 setStatus，撤销栈上限为 50', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon()])

  store.setStatus(['A-01'], 'accepted')
  assert.equal(store.all()[0].properties.status, 'accepted')
  store.undo()
  assert.equal(store.all()[0].properties.status, 'pending')

  // 60 patch steps + the initial add step: only the newest 50 can be undone.
  for (let index = 1; index <= 60; index += 1) store.patch('A-01', { name: `n${index}` })
  let undoneCount = 0
  while (store.undo().ok) undoneCount += 1
  assert.equal(undoneCount, ANNOTATION_UNDO_LIMIT)
  assert.equal(ANNOTATION_UNDO_LIMIT, 50)
})

test('新的修改会清空 redo 栈', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon()])
  store.patch('A-01', { name: 'a' })
  store.undo()
  assert.equal(store.redo().ok, true)

  store.patch('A-01', { name: 'b' })
  assert.equal(store.redo().ok, false)
})

test('accepted()/all()/getState() 返回深拷贝，UI 改动不会写回 store', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ name: '建筑 1', class: '建筑', class_key: 'building' })])
  store.setStatus(['A-01'], 'accepted')

  const acceptedRows = store.accepted()
  acceptedRows[0].properties.name = '被 UI 改掉'
  acceptedRows[0].properties.status = 'rejected'
  acceptedRows[0].geometry.coordinates[0][0][0] = 0

  const allRows = store.all()
  allRows[0].properties.name = '又被改掉'

  const state = store.getState()
  state.candidates[0].properties.name = '第三次'

  const stored = store.all()[0]
  assert.equal(stored.properties.name, '建筑 1')
  assert.equal(stored.properties.status, 'accepted')
  assert.equal(stored.geometry.coordinates[0][0][0], 100)
  assert.equal(store.accepted().length, 1)
  assert.equal(store.getState().candidates[0].properties.name, '建筑 1')
})

test('stats 按类别分组并给出合计与已采纳数', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([
    polygon({ class: '建筑', class_key: 'building' }),
    polygon({ class: '水体', class_key: 'water' }),
    polygon({ class: '建筑', class_key: 'building' }),
    polygon({ class: '其他' }),
  ])
  store.setStatus(['A-01', 'A-02'], 'accepted')
  store.setStatus(['A-04'], 'rejected')

  const stats = store.stats()
  assert.equal(stats.total, 4)
  assert.equal(stats.pending, 1)
  assert.equal(stats.accepted, 2)
  assert.equal(stats.rejected, 1)
  assert.deepEqual(stats.byClass, [
    { key: 'building', label: '建筑', count: 2, accepted: 1 },
    { key: 'water', label: '水体', count: 1, accepted: 1 },
    { key: '其他', label: '其他', count: 1, accepted: 0 },
  ])
  // Groups sum to the queue total, so the panel cannot show a lying header.
  const sum = stats.byClass.reduce((total, group) => total + group.count, 0)
  assert.equal(sum, stats.total)
})

test('subscribe 同步通知、退订后不再收到状态', () => {
  const store = storeWithClock()
  const seen = []
  const unsubscribe = store.subscribe((state) => seen.push(state))
  store.startRun({})
  store.addCandidates([polygon()])
  assert.equal(seen.length, 2)
  assert.equal(seen[0].candidates.length, 0)
  assert.equal(seen[1].candidates.length, 1)

  unsubscribe()
  store.addCandidates([polygon()])
  assert.equal(seen.length, 2)

  // A throwing listener must not break the store or the other listeners.
  const other = []
  store.subscribe(() => {
    throw new Error('listener boom')
  })
  store.subscribe((state) => other.push(state.counts.total))
  store.setStatus(['A-01'], 'accepted')
  assert.deepEqual(other, [2])
})

test('startRun 重置队列、id 编号与撤销历史', () => {
  const store = storeWithClock()
  const first = store.startRun({ mode: 'auto' })
  store.addCandidates([polygon(), polygon()])
  assert.equal(store.undo().ok, true)

  const second = store.startRun({ mode: 'manual' })
  assert.notEqual(second.run_id, first.run_id)
  assert.deepEqual(store.all(), [])
  assert.equal(store.undo().ok, false)
  assert.equal(store.redo().ok, false)

  const ids = store.addCandidates([polygon()])
  assert.deepEqual(ids, ['A-01'])
  assert.equal(store.all()[0].properties.run_id, second.run_id)
})

test('ANNOTATION_REFINE_KEYS 覆盖精修落库字段，候选携带 outline_source 与 outline_quality', () => {
  assert.ok(ANNOTATION_REFINE_KEYS.includes('outline_source'))
  assert.ok(ANNOTATION_REFINE_KEYS.includes('refine_state'))
  for (const key of ['outline_quality', 'refine_attempts', 'refine_bbox_iou', 'refine_area_ratio']) {
    assert.ok(ANNOTATION_REFINE_KEYS.includes(key))
  }
  // replaceGeometry 的允许键 = 审查字段 ∪ 精修字段；面积是派生数据，必须能刷新。
  assert.ok(ANNOTATION_PATCHABLE_KEYS.includes('area_m2'))
  assert.ok(ANNOTATION_REPLACE_KEYS.includes('area_m2'))
  assert.ok(ANNOTATION_REPLACE_KEYS.includes('refine_state'))
  // 既有来源字段不许丢。
  for (const key of ['shape', 'source_kind', 'class_raw', 'outline_source', 'outline_quality']) {
    assert.ok(ANNOTATION_CARRIED_KEYS.includes(key))
  }

  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ outline_source: 'box', outline_quality: 'clipped' })])
  const props = store.all()[0].properties
  assert.equal(props.outline_source, 'box')
  assert.equal(props.outline_quality, 'clipped')
})

test('replaceGeometry 批量替换几何只提交一次，每个变更要素 rev+1 且继承类别与高度', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([
    polygon({ class: '建筑', class_key: 'building', confidence: 0.82, height_m: 12.5, height_source: 'dsm', area_m2: 128.4 }),
    polygon({ class: '水体' }),
    polygon({ class: '道路' }),
  ])
  const untouchedGeometry = store.all()[1].geometry
  const seen = []
  store.subscribe((state) => seen.push(state))
  const undoBefore = store.history().undo

  const refined = {
    type: 'Polygon',
    coordinates: [[[100, 30], [100.002, 30], [100.002, 30.002], [100, 30.002], [100, 30]]],
  }
  const changed = store.replaceGeometry([
    {
      id: 'A-01',
      geometry: refined,
      properties: {
        outline_source: 'refined',
        outline_quality: 'ok',
        refine_state: 'refined',
        refine_attempts: 1,
        refine_bbox_iou: 0.78,
        refine_area_ratio: 0.94,
        area_m2: 210.5,
      },
    },
    { id: 'A-03', geometry: refined, properties: { outline_source: 'refined', refine_state: 'failed' } },
  ])

  assert.equal(changed, 2)
  // 一次 commit = 一步撤销 = 一次通知。
  assert.equal(store.history().undo, undoBefore + 1)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].candidates.length, 3)

  const rows = store.all()
  assert.deepEqual(rows[0].geometry, refined)
  assert.deepEqual(rows[2].geometry, refined)
  // 未列出的候选完全不动。
  assert.deepEqual(rows[1].geometry, untouchedGeometry)
  assert.equal(rows[0].properties.rev, 2)
  assert.equal(rows[1].properties.rev, 1)
  assert.equal(rows[2].properties.rev, 2)
  // 精修继承类别/高度/置信度/状态，只新增来源与质量字段。
  assert.equal(rows[0].properties.class, '建筑')
  assert.equal(rows[0].properties.class_key, 'building')
  assert.equal(rows[0].properties.confidence, 0.82)
  assert.equal(rows[0].properties.height_m, 12.5)
  assert.equal(rows[0].properties.height_source, 'dsm')
  assert.equal(rows[0].properties.status, 'pending')
  assert.equal(rows[0].properties.outline_source, 'refined')
  assert.equal(rows[0].properties.outline_quality, 'ok')
  assert.equal(rows[0].properties.refine_state, 'refined')
  assert.equal(rows[0].properties.refine_attempts, 1)
  assert.equal(rows[0].properties.refine_bbox_iou, 0.78)
  assert.equal(rows[0].properties.refine_area_ratio, 0.94)
  assert.equal(rows[0].properties.area_m2, 210.5)
  assert.equal(rows[2].properties.refine_state, 'failed')
})

test('replaceGeometry 只应用白名单属性、忽略未知 id 与非法条目', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ class: '建筑', confidence: 0.82, height_m: 9 })])
  const refined = { type: 'Polygon', coordinates: [[[100, 30], [100.003, 30], [100.003, 30.003], [100, 30]]] }
  const undoBefore = store.history().undo

  const changed = store.replaceGeometry([
    { id: 'A-99', geometry: refined, properties: { refine_state: 'refined' } },
    { geometry: refined, properties: { refine_state: 'refined' } },
    null,
    42,
    'A-01',
    { id: 'A-01', properties: { status: 'accepted', confidence: 0.01, id: 'Z-99', note: '内部字段', refine_state: 'refined' } },
  ])

  assert.equal(changed, 1)
  const props = store.all()[0].properties
  assert.equal(props.id, 'A-01')
  assert.equal(props.status, 'pending')
  assert.equal(props.confidence, 0.82)
  assert.equal(props.height_m, 9)
  assert.equal(props.class, '建筑')
  assert.equal(props.refine_state, 'refined')
  assert.equal('note' in props, false)
  // 未知 id / 非对象 / 缺 id 的条目都不产生额外提交。
  assert.equal(store.history().undo, undoBefore + 1)
  assert.equal(store.replaceGeometry([]), 0)
  assert.equal(store.replaceGeometry(null), 0)
  assert.equal(store.replaceGeometry([{ id: 'A-01', properties: { status: 'rejected' } }]), 0)
  assert.equal(store.replaceGeometry([{ id: 'A-01', geometry: null }]), 0)
  assert.equal(store.history().undo, undoBefore + 1)
  assert.equal(store.all()[0].properties.status, 'pending')
})

test('replaceGeometry 一次 undo 回滚整批几何与属性，redo 可恢复', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ name: '建筑 1' }), polygon({ name: '建筑 2' })])
  const before = store.all()
  const refined = { type: 'Polygon', coordinates: [[[100, 30], [100.004, 30], [100.004, 30.004], [100, 30]]] }

  assert.equal(store.replaceGeometry([
    { id: 'A-01', geometry: refined, properties: { outline_source: 'refined', refine_state: 'refined', area_m2: 300 } },
    { id: 'A-02', geometry: refined, properties: { outline_source: 'box', refine_state: 'skipped' } },
  ]), 2)
  assert.equal(store.history().undo, 2)

  const undone = store.undo()
  assert.equal(undone.ok, true)
  assert.equal(typeof undone.label, 'string')
  const restored = store.all()
  assert.deepEqual(restored, before)
  assert.equal(restored[0].properties.rev, 1)
  assert.equal('refine_state' in restored[0].properties, false)
  assert.equal(store.history().undo, 1)

  assert.equal(store.redo().ok, true)
  assert.deepEqual(store.all()[0].geometry, refined)
  assert.equal(store.all()[0].properties.rev, 2)
  assert.equal(store.all()[0].properties.refine_state, 'refined')
})

test('replaceGeometry 支持只写属性，同批同 id 只递增一次 rev', () => {
  const store = storeWithClock()
  store.startRun({})
  store.addCandidates([polygon({ name: '建筑 1' })])
  const geometry = store.all()[0].geometry

  assert.equal(store.replaceGeometry([{ id: 'A-01', properties: { outline_source: 'box', area_m2: 456.7 } }]), 1)
  const row = store.all()[0]
  assert.deepEqual(row.geometry, geometry)
  assert.equal(row.properties.outline_source, 'box')
  assert.equal(row.properties.area_m2, 456.7)
  assert.equal(row.properties.rev, 2)

  // 同一批里两条同 id 更新合并成一次内容编辑，后写入的值生效。
  const refined = { type: 'Polygon', coordinates: [[[100, 30], [100.005, 30], [100.005, 30.005], [100, 30]]] }
  const changed = store.replaceGeometry([
    { id: 'A-01', properties: { outline_source: 'refined', refine_state: 'refined' } },
    { id: 'A-01', geometry: refined, properties: { refine_attempts: 2, area_m2: 789 } },
  ])
  assert.equal(changed, 1)
  const merged = store.all()[0]
  assert.deepEqual(merged.geometry, refined)
  assert.equal(merged.properties.outline_source, 'refined')
  assert.equal(merged.properties.refine_state, 'refined')
  assert.equal(merged.properties.refine_attempts, 2)
  assert.equal(merged.properties.area_m2, 789)
  assert.equal(merged.properties.rev, 3)
})

test('hydrate：刷新后恢复队列，保留 id/status/rev/geometry，历史清空', async () => {
  const store = createAnnotationStore()
  store.startRun({ mode: 'auto', source: 'tiles3d', scope: 'view', classes: ['building'] })
  const ids = store.addCandidates([
    { type: 'Feature', properties: { class: 'building', class_key: 'building', height_m: 12 }, geometry: { type: 'Polygon', coordinates: [[[1, 2], [3, 2], [3, 4], [1, 2]]] } },
    { type: 'Feature', properties: { class: 'road', class_key: 'road' }, geometry: { type: 'Polygon', coordinates: [[[5, 6], [7, 6], [7, 8], [5, 6]]] } },
  ])
  store.setStatus([ids[0]], 'accepted')
  const saved = store.all()

  const restored = createAnnotationStore()
  const count = restored.hydrate(saved)
  assert.equal(count, 2)
  const rows = restored.all()
  assert.equal(rows[0].properties.id, ids[0])
  assert.equal(rows[0].properties.status, 'accepted')
  assert.equal(rows[1].properties.status, 'pending')
  assert.deepEqual(rows[0].geometry, saved[0].geometry)
  assert.equal(restored.history().undo, 0, '恢复后的会话没有可撤销历史')
  assert.equal(restored.accepted().length, 1)
})

test('hydrate 后追加候选：id 从恢复的最大编号继续，不重复', async () => {
  const store = createAnnotationStore()
  store.startRun({ mode: 'auto', source: 'tiles3d', scope: 'view', classes: ['building'] })
  const ids = store.addCandidates([
    { type: 'Feature', properties: { class: 'building' }, geometry: null },
    { type: 'Feature', properties: { class: 'building' }, geometry: null },
  ])
  const saved = store.all()
  const restored = createAnnotationStore()
  restored.hydrate(saved)
  const [nextId] = restored.addCandidates([{ type: 'Feature', properties: { class: 'building' }, geometry: null }])
  assert.equal(ids[0], 'A-01')
  assert.equal(nextId, 'A-03', '刷新后追加不能与恢复的 id 冲突')
  assert.equal(new Set(restored.all().map((row) => row.properties.id)).size, 3)
})
