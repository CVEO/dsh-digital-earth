import { test } from 'node:test'
import assert from 'node:assert/strict'
import { askSelectionQuestion, selectionQuestionContext } from '../src/client/scene/selection-question.js'
import { captureSelectionFrame, usableSurfaceRing } from '../src/client/scene/selection-frame.js'
import { polygonAreaSquareMeters, ringToPolygon } from '../src/client/scene/screen-geodesy.js'
import { SELECTION_MESSAGES } from '../src/client/messages-selection.js'
import { MESSAGES } from '../src/client/messages.js'

const selection = () => ({ kind: 'rectangle', approximate: true, complete: true, created_at: 'original-time',
  ring: [[113, 31], [113.001, 31], [113.001, 31.001], [113, 31]],
  area_m2: 100, frame: { image: 'saved-image', captured_at: 'selection-time', ring: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]] } })

test('选区提问：使用选中时的图片与范围，不重新截图、不下载、不注入无问题上下文', async () => {
  const original = globalThis.fetch
  const calls = []
  let accept
  globalThis.fetch = (url, options) => { calls.push({ url, body: JSON.parse(options.body), options }); return new Promise((resolve) => { accept = resolve }) }
  let session = 'original-session'
  try {
    const chosen = selection()
    const result = askSelectionQuestion({ getMeta: () => ({ questionUrl: '/selection-question' }), getSession: () => session },
      { selection: chosen, question: '这里是什么？', requestId: 'question-test' })
    session = 'another-session'
    assert.equal(calls.length, 1)
    assert.equal(calls[0].body.session, 'original-session')
    assert.equal(calls[0].body.image, 'saved-image')
    assert.match(calls[0].body.text, /这里是什么？/)
    assert.match(calls[0].body.text, /selection-time/)
    assert.match(calls[0].body.text, /or an exact building footprint/)
    assert.match(calls[0].body.text, /Do not download data, write scripts/)
    assert.equal(calls[0].options.credentials, 'same-origin')
    accept({ ok: true, json: async () => ({ ok: true, accepted: true }) })
    assert.equal((await result).accepted, true)
  } finally { globalThis.fetch = original }
})

test('选区提问：纯文字与旧宿主降级明确，未确认回执不显示成功', async () => {
  const original = globalThis.fetch
  const deps = { getMeta: () => ({ questionUrl: '/question' }), getSession: () => 'session' }
  try {
    let body
    globalThis.fetch = async (url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ ok: true, accepted: true }) } }
    await askSelectionQuestion(deps, { question: 'question', selection: selection(), includeImage: false, requestId: 'same-id' })
    assert.equal(body.image, undefined)
    await assert.rejects(askSelectionQuestion({ ...deps, getMeta: () => ({}) }, { question: 'question', selection: selection() }), { code: 'unavailable' })
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) })
    await assert.rejects(askSelectionQuestion(deps, { question: 'question', selection: selection() }), { code: 'send_failed' })
    globalThis.fetch = async () => { throw new Error('network') }
    await assert.rejects(askSelectionQuestion(deps, { question: 'question', selection: selection() }), { code: 'delivery_unknown' })
  } finally { globalThis.fetch = original }
})

test('选区画面：CSS 像素正确归一化，长边限 1024，选区描边与原图一起保存', () => {
  const previous = globalThis.document
  const calls = []
  const context = Object.fromEntries(['drawImage', 'beginPath', 'arc', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke'].map((key) => [key, (...args) => calls.push([key, ...args])]))
  const image = { getContext: () => context, toDataURL: () => 'data:image/jpeg;base64,c2F2ZWQ=' }
  globalThis.document = { createElement: () => image }
  try {
    const frame = captureSelectionFrame({ canvas: { width: 2000, height: 1000, clientWidth: 500, clientHeight: 250 }, render() {} }, [{ x: 125, y: 50 }, { x: 375, y: 50 }, { x: 375, y: 200 }])
    assert.deepEqual(frame.ring, [[0.25, 0.2], [0.75, 0.2], [0.75, 0.8]])
    assert.equal(frame.width, 1024)
    assert.equal(frame.height, 512)
    assert.deepEqual(calls.find((call) => call[0] === 'moveTo'), ['moveTo', 256, 102.4])
    assert.equal(calls.filter((call) => call[0] === 'stroke').length, 2)
    assert.equal(context.strokeStyle, '#67e8f9')
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous }
})

test('选区几何：拒绝部分命中与自交环，小面积计算避免大坐标抵消且三角形可导出', () => {
  const ring = [[113, 31], [113.000001, 31], [113.000001, 31.000001], [113, 31.000001], [113, 31]]
  assert.equal(usableSurfaceRing({ ring, points: [1, 2, 3, 4], complete: true }), true)
  assert.equal(usableSurfaceRing({ ring, points: [1, 2, 3, 4], complete: false }), false)
  const crossed = [ring[0], ring[2], ring[1], ring[3], ring[0]]
  assert.equal(usableSurfaceRing({ ring: crossed, points: [1, 2, 3, 4], complete: true }), false)
  const expected = (111319.49079327358e-6) ** 2 * Math.cos(31 * Math.PI / 180)
  assert.ok(Math.abs(polygonAreaSquareMeters(ring) - expected) / expected < 1e-6)
  assert.equal(ringToPolygon(ring.slice(0, 3)).coordinates[0].length, 4)
  const context = selectionQuestionContext({ kind: 'screen', complete: false, frame: selection().frame })
  assert.equal(context.ring, undefined)
  assert.deepEqual(context.image_selection, selection().frame.ring)
})

test('选区提问：中英文文案成对，真实目录中的提示覆盖旧的纯量测说明', () => {
  assert.deepEqual(Object.keys(SELECTION_MESSAGES.zh).sort(), Object.keys(SELECTION_MESSAGES.en).sort())
  assert.match(MESSAGES.zh['selection.dragHint'], /松开后直接提问/)
  assert.match(MESSAGES.en['selection.dragHint'], /release to ask/)
})
