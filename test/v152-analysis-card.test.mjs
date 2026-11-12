/**
 * v1.5.2 analysis card + manual profile feedback.
 *
 * Two regressions drove this file:
 *   1. The profile chart was the LAST body child, so the stats pushed it out of
 *      the card (the acceptance review could not see the chart at all). The chart
 *      must now be the first body child and the card must state its single
 *      height source (plus up to two warnings).
 *   2. The manual profile tool only reacted on the SECOND click. The first click
 *      must show a start marker + a dashed draft line that follows the cursor,
 *      and the second click must freeze that line BEFORE the async analysis.
 *
 * The module is driven with a fake Cesium namespace: no browser, no WebGL.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createProfileTool } from '../src/client/scene/profile-tool.js'
import { readRepoFile } from './helpers/source.mjs'

const cards = readRepoFile('src/client/ui/cards.js')
const css = readRepoFile('src/client/ui/css.js')
const profileTool = readRepoFile('src/client/scene/profile-tool.js')
const messages = readRepoFile('src/client/messages.js')

test('分析卡：剖面图是 body 第一个子节点，在图层行与指标之前', () => {
  const cardStart = cards.indexOf('function AnalysisCard')
  assert.ok(cardStart > 0, '找不到 AnalysisCard')
  const bodyStart = cards.indexOf("className: 'body'", cardStart)
  const chartUsed = cards.indexOf('chartBlock,', bodyStart)
  const layerUsed = cards.indexOf("className: 'layer'", bodyStart)
  const rowsUsed = cards.indexOf('...rows,', bodyStart)
  assert.ok(chartUsed > bodyStart, 'body 中没有 chartBlock')
  assert.ok(chartUsed < layerUsed, '剖面图必须在图层行之前')
  assert.ok(layerUsed < rowsUsed, '图层行必须在指标之前')
  // chartBlock 自身：有缩略图按钮路径，也有无指标时的普通图表路径。
  const chartBlock = cards.slice(cards.indexOf('const chartBlock ='), cards.indexOf('const rows = []'))
  assert.match(chartBlock, /className: 'profile-chart-thumb'/)
  assert.match(chartBlock, /h\(AnalysisProfileChart, \{ points: result\.points, t, hoverIndex, onHover \}\)/)
  assert.match(chartBlock, /onClick: \(\) => setChartOpen\(true\)/)
})

test('分析卡：高程来源与 warnings 渲染，缺失时省略', () => {
  assert.match(cards, /const heightSource =/)
  assert.match(cards, /result\.height_source/)
  assert.match(cards, /t\('analysis\.source'\)/)
  assert.match(cards, /t\(`analysis\.source\.\$\{heightSource\}`\)/)
  assert.match(cards, /const warningCodes =/)
  assert.match(cards, /result\.warnings/)
  assert.match(cards, /\.slice\(0, 2\)/)
  assert.match(cards, /t\('analysis\.warnings'\)/)
  // 无数据时返回 null（省略整行），不是空字符串。
  assert.match(cards, /heightSource\s*\n?\s*\?/)

  // i18n 由 Lead 统一维护：这些 key 必须中英成对存在。
  for (const key of [
    'analysis.source',
    'analysis.source.tiles',
    'analysis.source.terrain',
    'analysis.source.surface',
    'analysis.source.none',
    'analysis.warnings',
  ]) {
    assert.equal(
      (messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []).length,
      2,
      `缺少中英 ${key}`,
    )
  }
  assert.match(messages, /'analysis\.title\.profile': '三维剖面'/)
})

test('分析卡样式：图表不再被底部挤出，窄面板也够高', () => {
  const start = css.indexOf('.mv-analysis{')
  const end = css.indexOf('.mv-chart-modal{')
  assert.ok(start > 0 && end > start, '找不到 analysis 样式段')
  const analysis = css.slice(start, end)
  assert.match(analysis, /max-height:min\(72%,460px\)/)
  assert.match(analysis, /\.mv-analysis \.chart\{[^}]*margin-top:0/)
  assert.match(analysis, /\.mv-analysis \.profile-chart-thumb\{[^}]*flex:none/)
  assert.match(analysis, /\.mv-analysis \.warnings\{/)
  assert.match(css, /\.mv-root\.mv-docked \.mv-analysis\{max-height:min\(72%,460px\)\}/)
})

test('人工剖面源码：自建 MOUSE_MOVE handler、草稿虚线、销毁路径', () => {
  assert.match(profileTool, /ScreenSpaceEventHandler/)
  assert.match(profileTool, /MOUSE_MOVE/)
  assert.match(profileTool, /new EventHandler\(canvas\)/)
  assert.match(profileTool, /handler\.destroy\(\)/)
  assert.match(profileTool, /CallbackProperty/)
  assert.match(profileTool, /polyline:/)
  assert.match(profileTool, /PolylineDashMaterialProperty/)
  assert.match(profileTool, /dispose: clear/)
  // 六工具契约不变：仍是同一个 profile 命令。
  assert.match(profileTool, /action: 'profile'/)
  assert.match(profileTool, /from: \[from\.lon, from\.lat\]/)
  assert.match(profileTool, /to: \[to\.lon, to\.lat\]/)
  assert.match(profileTool, /samples: 32/)
})

function makeHarness() {
  const handlers = []
  const entities = []
  const inner = {
    toasts: [],
    calls: [],
    tool: 'profile',
    renderRequests: 0,
    picks: 0,
    pending: null,
    resolveRun: null,
    rejectRun: null,
  }
  class Handler {
    constructor(canvas) {
      this.canvas = canvas
      this.actions = new Map()
      this.destroyed = false
      handlers.push(this)
    }
    setInputAction(action, type) {
      this.actions.set(type, action)
    }
    destroy() {
      this.destroyed = true
    }
  }
  class CallbackProperty {
    constructor(read) {
      this.read = read
    }
    getValue() {
      return this.read()
    }
  }
  const viewer = {
    scene: { canvas: { id: 'canvas' }, requestRender: () => (inner.renderRequests += 1) },
    entities: {
      add: (options) => {
        const entity = { options, removed: false }
        entities.push(entity)
        return entity
      },
      remove: (entity) => {
        if (entity) entity.removed = true
      },
    },
  }
  const Cesium = {
    ScreenSpaceEventHandler: Handler,
    ScreenSpaceEventType: { MOUSE_MOVE: 'MOUSE_MOVE' },
    CallbackProperty,
    PolylineDashMaterialProperty: class {
      constructor(options) {
        this.options = options
      }
    },
    ArcType: { GEODESIC: 0 },
    Color: { WHITE: { css: 'white' }, fromCssColorString: (value) => ({ css: value }) },
    Cartographic: {
      fromCartesian: (cartesian) => ({ longitude: cartesian.lon, latitude: cartesian.lat }),
    },
    Math: { toDegrees: (radians) => radians },
  }
  const tool = createProfileTool({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    pickSurface: () => {
      inner.picks += 1
      return { lon: inner.picks / 10, lat: inner.picks / 20, pick: inner.picks }
    },
    setTool: (mode) => {
      inner.tool = mode
    },
    runAnalysis: (args) => {
      inner.calls.push(args)
      if (!inner.pending) return Promise.resolve()
      return inner.pending
    },
    showToast: (text) => inner.toasts.push(text),
    t: (key, params) => (params ? `${key}:${params.message}` : key),
  })
  const flush = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }
  const addedPolylines = () => entities.filter((entity) => Boolean(entity.options?.polyline))
  return { tool, Cesium, viewer, handlers, entities, inner, addedPolylines, flush }
}

test('人工剖面：首次点击立刻有起点 marker 与草稿线，移动鼠标更新终点', () => {
  const harness = makeHarness()
  const { tool, handlers, inner, addedPolylines } = harness
  tool.start()
  assert.equal(handlers.length, 1, 'start() 必须自建 MOUSE_MOVE handler')
  const handler = handlers[0]
  const move = handler.actions.get('MOUSE_MOVE')
  assert.equal(typeof move, 'function')

  tool.onPoint({ x: 1, y: 1 })
  assert.equal(inner.calls.length, 0, '第一次点击不调用分析')
  assert.ok(inner.toasts.includes('profile.clickEnd'))
  const polylines = addedPolylines()
  assert.equal(polylines.length, 1, '第一次点击必须画出草稿线')
  const draft = polylines[0].options.polyline
  assert.ok(draft.positions instanceof harness.Cesium.CallbackProperty, '草稿线终点必须跟随光标')
  const before = draft.positions.getValue()
  assert.equal(before.length, 2)
  assert.deepEqual(before[0], before[1], '未移动时草稿线是零长度的起点段')

  move({ endPosition: { x: 2, y: 2 } })
  const after = draft.positions.getValue()
  assert.deepEqual(after[1], { lon: 0.2, lat: 0.1, pick: 2 }, 'MOUSE_MOVE 必须更新草稿线终点')
  assert.ok(inner.renderRequests >= 1, '移动后必须请求重绘')
})

test('人工剖面：第二次点击立即固定草稿线，分析成功后再清理', async () => {
  const harness = makeHarness()
  const { tool, handlers, entities, inner, addedPolylines } = harness
  inner.pending = new Promise((resolve) => {
    inner.resolveRun = resolve
  })
  tool.start()
  tool.onPoint({ x: 1, y: 1 })
  tool.onPoint({ x: 3, y: 3 })
  assert.equal(inner.calls.length, 1, '第二次点击必须立刻调用 runAnalysis')
  assert.equal(handlers[0].destroyed, true, '固定后不能再跟随鼠标')
  // 分析尚未返回：草稿线必须已经是固定两点，终点 marker 已出现。
  const fixed = addedPolylines().at(-1).options.polyline
  assert.ok(Array.isArray(fixed.positions), '固定线段必须是具体两点，不是回调')
  assert.equal(fixed.positions.length, 2)
  assert.deepEqual(fixed.positions[1], { lon: 0.2, lat: 0.1, pick: 2 })
  const endMarker = entities.find((entity) => entity.options?.id?.includes('profile-draft-2'))
  assert.ok(endMarker, '第二次点击必须显示终点 marker')
  assert.equal(addedPolylines().at(-1).removed, false, '分析返回前固定草稿线必须保留')
  assert.equal(endMarker.removed, false, '分析返回前终点 marker 必须保留')

  inner.resolveRun()
  await inner.pending
  await harness.flush()
  assert.equal(inner.tool, null, '分析结束后退出工具')
  assert.equal(entities.every((entity) => entity.removed), true, '分析结束后草稿实体必须全部移除')
  const args = inner.calls[0]
  assert.equal(args.action, 'profile')
  assert.deepEqual(args.from, [0.1, 0.05])
  assert.deepEqual(args.to, [0.2, 0.1])
  assert.equal(args.samples, 32)
})

test('人工剖面：分析失败也清理草稿并 toast', async () => {
  const harness = makeHarness()
  const { tool, entities, inner } = harness
  inner.pending = new Promise((_, reject) => {
    inner.rejectRun = reject
  })
  tool.start()
  tool.onPoint({ x: 1, y: 1 })
  tool.onPoint({ x: 3, y: 3 })
  inner.rejectRun(new Error('boom'))
  await harness.flush()
  assert.ok(
    inner.toasts.some((text) => text.startsWith('profile.failed')),
    '失败必须 toast profile.failed',
  )
  assert.equal(entities.every((entity) => entity.removed), true)
  assert.equal(inner.tool, null)
})

test('人工剖面：cancel / dispose 销毁 handler 与实体，cancel 退出工具', () => {
  const harness = makeHarness()
  const { tool, handlers, entities, inner } = harness
  tool.start()
  tool.onPoint({ x: 1, y: 1 })
  tool.cancel()
  assert.equal(handlers[0].destroyed, true, 'cancel 必须销毁 handler')
  assert.equal(entities.every((entity) => entity.removed), true, 'cancel 必须移除草稿实体')
  assert.equal(inner.tool, null)

  // dispose 是卸载路径：只清理，不碰 React 的工具状态。
  const second = makeHarness()
  second.tool.start()
  second.tool.onPoint({ x: 1, y: 1 })
  second.tool.dispose()
  assert.equal(second.handlers[0].destroyed, true, 'dispose 必须销毁 handler')
  assert.equal(second.entities.every((entity) => entity.removed), true)
})

test('人工剖面：固定后的第三次点击被忽略，不会重复发起分析', async () => {
  const harness = makeHarness()
  const { tool, inner } = harness
  inner.pending = new Promise((resolve) => {
    inner.resolveRun = resolve
  })
  tool.start()
  tool.onPoint({ x: 1, y: 1 })
  tool.onPoint({ x: 3, y: 3 })
  tool.onPoint({ x: 5, y: 5 })
  assert.equal(inner.calls.length, 1, '锁定后不再发起第二次分析')
  inner.resolveRun()
  await harness.flush()
})

test('人工剖面：无地表交点的点击只提示，不画草稿', () => {
  const viewer = { entities: { add: () => ({ removed: false }), remove: () => {} }, scene: { canvas: {} } }
  const Cesium = {
    ScreenSpaceEventHandler: class {
      setInputAction() {}
      destroy() {}
    },
    ScreenSpaceEventType: { MOUSE_MOVE: 'MOUSE_MOVE' },
    Cartographic: { fromCartesian: () => ({ longitude: 0, latitude: 0 }) },
    Math: { toDegrees: (value) => value },
    Color: { WHITE: {}, fromCssColorString: () => ({}) },
  }
  const toasts = []
  let added = 0
  viewer.entities.add = () => {
    added += 1
    return { removed: false }
  }
  const tool = createProfileTool({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    pickSurface: () => null,
    setTool: () => {},
    runAnalysis: async () => {},
    showToast: (text) => toasts.push(text),
    t: (key) => key,
  })
  tool.start()
  tool.onPoint({ x: 1, y: 1 })
  assert.equal(added, 0)
  assert.ok(toasts.includes('toast.noSurface'))
})
