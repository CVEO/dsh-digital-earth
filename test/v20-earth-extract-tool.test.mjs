/**
 * v20 — earth_extract Agent tool: schema, extent/class validation, bridge call.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { createExtractTool } = await import('../src/host/tools/extract.js')

function fakeBridge(result = { count: 2, geojson: { type: 'FeatureCollection', features: [] } }) {
  const calls = []
  return {
    calls,
    connectedSessions: () => ['session-1'],
    async run(sessionId, action, args, timeout, signal) {
      calls.push({ sessionId, action, args, timeout, signal })
      return result
    },
  }
}

const exec = { agent: { id: 'session-1' } }

test('earth_extract classes：返回默认 8 类，不需要面板', async () => {
  const bridge = fakeBridge()
  const tool = createExtractTool(bridge)
  assert.equal(tool.name, 'earth_extract')
  const value = await tool.execute({ action: 'classes' }, exec)
  assert.equal(value.classes.length, 8)
  assert.ok(value.classes.some((entry) => entry.key === 'building'))
  assert.equal(bridge.calls.length, 0)
})

test('earth_extract: bbox + classes 经桥接发给面板，返回 GeoJSON 摘要', async () => {
  const bridge = fakeBridge()
  const tool = createExtractTool(bridge)
  const value = await tool.execute({
    action: 'extract',
    bbox: { west: 114.3, south: 30.5, east: 114.31, north: 30.51 },
    classes: ['building', '水体'],
    max_features: 50,
  }, exec)
  assert.equal(bridge.calls.length, 1)
  assert.equal(bridge.calls[0].action, 'extract')
  assert.deepEqual(bridge.calls[0].args.bbox, { west: 114.3, south: 30.5, east: 114.31, north: 30.51 })
  assert.deepEqual(bridge.calls[0].args.classes, ['building', '水体'])
  assert.equal(bridge.calls[0].args.max_features, 50)
  assert.equal(value.count, 2)
  const text = tool.output.render({}, value)[0].text
  assert.match(text, /Extracted 2 2D instance/)
  assert.match(text, /drawn in the panel/)
})

test('earth_extract: 省略 bbox 时用当前视口；clear 走清除动作', async () => {
  const bridge = fakeBridge({ cleared: true })
  const tool = createExtractTool(bridge)
  await tool.execute({ action: 'extract' }, exec)
  assert.equal(bridge.calls[0].args.bbox, undefined)
  await tool.execute({ action: 'clear' }, exec)
  assert.equal(bridge.calls[1].args.clear, true)
})

test('earth_extract: 非法 bbox/类别/action 直接拒绝，不调用面板', async () => {
  const bridge = fakeBridge()
  const tool = createExtractTool(bridge)
  await assert.rejects(() => tool.execute({ action: 'extract', bbox: { west: 10, south: 0, east: 5, north: 10 } }, exec), /west<east/)
  await assert.rejects(() => tool.execute({ action: 'extract', bbox: { west: -181, south: 0, east: 1, north: 1 } }, exec), /outside WGS84/)
  await assert.rejects(() => tool.execute({ action: 'extract', classes: Array.from({ length: 13 }, (_, index) => `c${index}`) }, exec), /at most 12/)
  await assert.rejects(() => tool.execute({ action: 'nope' }, exec), /unknown action/)
  assert.equal(bridge.calls.length, 0)
})
