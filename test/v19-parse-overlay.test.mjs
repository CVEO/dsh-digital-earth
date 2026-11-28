/**
 * v19 — 提取叠加层同步：无论面板重渲染还是快照恢复，都只保留一层。
 *
 * 真实故障：ViewerSurface 是普通渲染函数，每次 re-render 都会新建 sync 实例；
 * 快照恢复也会重建 drawCommands 里的对象。只靠对象身份找"上一次的命令"会漏删，
 * 采纳两次后地球上叠出两层、拒绝后旧几何还在。这里用假的 state/viewer 锁住修复。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { createParseOverlaySync } = await import('../src/client/scene/parse-overlay.js')

function makeState() {
  return {
    drawCommands: [],
    measureCommands: [],
    draw: [],
    entityGroups: new Map(),
    drawnFeatures: 0,
  }
}

function makeViewer() {
  const removed = []
  return { entities: { remove: (entity) => removed.push(entity) }, removed }
}

function makeSync(state, viewer, drawn) {
  return createParseOverlaySync({
    getState: () => state,
    getViewer: () => viewer,
    t: (key) => key,
    draw: (collection, style, caption) => {
      const command = { caption, collection, drawn: 0 }
      state.drawCommands.push(command)
      state.entityGroups.set(command, [])
      drawn.push(collection.features.length)
    },
    onChanged: () => {},
  })
}

const collection = (count) => ({
  type: 'FeatureCollection',
  features: Array.from({ length: count }, (_, index) => ({ type: 'Feature', properties: { id: `P-${index}` }, geometry: null })),
})

test('同步两次只保留一层：新实例也能删掉旧实例画的那层', () => {
  const state = makeState()
  const viewer = makeViewer()
  const drawn = []
  const first = makeSync(state, viewer, drawn)
  first.sync(collection(1), 'extract-layer')
  assert.equal(state.drawCommands.length, 1)

  // 面板重渲染 → 新实例（旧实例的闭包 command 已丢）
  const second = makeSync(state, viewer, drawn)
  second.sync(collection(2), 'extract-layer')
  assert.equal(state.drawCommands.length, 1, '第二次同步后仍只能有一层提取结果')
  assert.equal(state.drawCommands[0].collection.features.length, 2, '保留最新一层')
})

test('快照恢复重建命令对象后，clear 仍能清掉提取层', () => {
  const state = makeState()
  const viewer = makeViewer()
  const drawn = []
  const sync = makeSync(state, viewer, drawn)
  sync.sync(collection(1), 'extract-layer')

  // 快照恢复：drawCommands 重新解析，对象身份变化
  state.drawCommands = state.drawCommands.map((command) => JSON.parse(JSON.stringify(command)))
  const restored = makeSync(state, viewer, drawn)
  restored.sync(collection(0), 'extract-layer')
  assert.equal(state.drawCommands.length, 0, '清空时应按标题找到并删除旧层')
})

test('拒绝到空集合：sync 后不残留提取层', () => {
  const state = makeState()
  const viewer = makeViewer()
  const drawn = []
  const sync = makeSync(state, viewer, drawn)
  sync.sync(collection(3), 'extract-layer')
  sync.sync(collection(0), 'extract-layer')
  assert.equal(state.drawCommands.length, 0)
  assert.deepEqual(drawn, [3], '空集合不应新增图层')
})
