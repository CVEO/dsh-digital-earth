/**
 * v1.6 Phase 2 — the capture service (screenshot / Agent snapshot).
 *
 * Extracted from ViewerSurface. Behaviour that matters and can be checked without
 * a real Cesium canvas: chrome hiding around the capture, full-resolution buffer
 * with the tier restored afterwards, data-URL budget, and the capture POST/toast.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createCaptureService } from '../src/client/scene/capture.js'

const t = (key, params) => (params ? `${key}:${params.message ?? params.path ?? params.width ?? ''}` : key)

function fakeDocument({ dataUrl = 'data:image/jpeg;base64,AAAA', click }) {
  return {
    visibilityState: 'visible',
    createElement(tag) {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: click ?? (() => {}),
        }
      }
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {} }),
        toDataURL: () => dataUrl,
      }
    },
  }
}

function makeService(overrides = {}) {
  const viewer = {
    resolutionScale: 0.85,
    resized: 0,
    rendered: 0,
    canvas: { width: 1600, height: 900 },
    resize() {
      this.resized += 1
    },
    render() {
      this.rendered += 1
    },
    ...overrides.viewer,
  }
  const toasts = []
  const hidden = []
  const created = []
  const originalDocument = globalThis.document
  globalThis.document = fakeDocument({ click: () => created.push('click'), ...(overrides.document ?? {}) })
  const service = createCaptureService({
    getViewer: () => viewer,
    getRoot: () => overrides.root ?? { offsetWidth: 800, offsetHeight: 600 },
    getSettings: () => ({ settings: { screenshotHud: false } }),
    getMeta: () => overrides.meta ?? { captureUrl: 'https://host/capture', token: 'tok' },
    getSession: () => 's1',
    t,
    showToast: (text) => toasts.push(text),
    setChromeHidden: (value) => hidden.push(value),
    nextFrames: async () => {},
    drawCaptureOverlay: overrides.drawCaptureOverlay ?? (() => {}),
    drawVectorLabels: overrides.drawVectorLabels,
  })
  return {
    service,
    viewer,
    toasts,
    hidden,
    created,
    restore: () => {
      globalThis.document = originalDocument
    },
  }
}

test('renderSnapshot：隐藏 chrome、强制满分辨率、结束后恢复质量档', async () => {
  const { service, viewer, hidden, restore } = makeService()
  try {
    const shot = await service.renderSnapshot({ width: 1000 })
    assert.equal(hidden[0], true, '默认截图不含 HUD：先隐藏 chrome')
    assert.equal(hidden[hidden.length - 1], false, '结束后必须恢复 chrome')
    assert.equal(viewer.rendered, 1)
    assert.equal(shot.width, 1000)
    assert.equal(shot.height, 563)
    assert.equal(shot.format, 'jpeg')
    assert.equal(viewer.resolutionScale, 0.85, '质量档必须恢复')
  } finally {
    restore()
  }
})

test('renderSnapshot：面板不可见时走离屏渲染（v1.5.2），画布不可绘制才报 hiddenPanel', async () => {
  const { service, viewer, restore } = makeService({ root: { offsetWidth: 10, offsetHeight: 10 } })
  try {
    const shot = await service.renderSnapshot()
    assert.ok(shot.dataUrl.startsWith('data:image/'), 'a hidden tab with a live canvas must still get a picture')
    assert.equal(viewer.rendered, 1, 'the off-screen path performs one explicit render')
  } finally {
    restore()
  }
  // A canvas with no drawable area still fails clearly instead of returning a blank image.
  const blank = makeService({ root: { offsetWidth: 10, offsetHeight: 10 }, viewer: { canvas: { width: 0, height: 0 } } })
  try {
    await assert.rejects(() => blank.service.renderSnapshot(), /agent\.hiddenPanel/)
  } finally {
    blank.restore()
  }
})

test('renderSnapshot：隐藏 HUD 时仍绘入矢量文字，显示 HUD 时先画文字再画 HUD', async () => {
  const painted = []
  const { service, restore } = makeService({
    drawVectorLabels: (_context, width, height) => painted.push(['labels', width, height]),
    drawCaptureOverlay: () => painted.push(['hud']),
  })
  try {
    await service.renderSnapshot({ width: 1000, include_hud: false })
    assert.deepEqual(painted, [['labels', 1000, 563]])
    painted.length = 0
    await service.renderSnapshot({ width: 1000, include_hud: true })
    assert.deepEqual(painted, [['labels', 1000, 563], ['hud']])
  } finally { restore() }
})

test('renderSnapshot：PNG + include_hud 走 HUD 叠加，宽度夹到 480..2560', async () => {
  const { service, restore } = makeService()
  try {
    const shot = await service.renderSnapshot({ width: 9999, format: 'png', include_hud: true })
    assert.equal(shot.format, 'png')
    assert.equal(shot.width, 1600, '宽度不能超过源画布')
    assert.equal(shot.includeHud, true)
  } finally {
    restore()
  }
})

test('captureScene：POST 到宿主 captureUrl 并 toast 保存路径', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => ({ path: '/tmp/shot.jpg', width: 1000, height: 563 }) }
  }
  const { service, toasts, restore } = makeService()
  try {
    const saved = await service.captureScene({ label: 'demo' }, 'sess-1')
    assert.equal(saved.hud, false)
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /token=tok/)
    const body = JSON.parse(calls[0].options.body)
    assert.equal(body.session, 'sess-1')
    assert.equal(body.label, 'demo')
    assert.equal(body.hud, false)
    assert.ok(toasts.some((text) => text.includes('toast.captureSaved')))
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('captureScene：宿主没有 captureUrl 时报 notReady', async () => {
  const { service, restore } = makeService({ meta: {} })
  try {
    await assert.rejects(() => service.captureScene(), /agent\.notReady/)
  } finally {
    restore()
  }
})

test('screenshot：触发下载并 toast', async () => {
  const { service, toasts, restore } = makeService({ document: { click: () => {} } })
  try {
    await service.screenshot()
    assert.ok(toasts.some((text) => text.includes('toast.screenshotSaved')))
  } finally {
    restore()
  }
})
