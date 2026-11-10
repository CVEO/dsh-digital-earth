/**
 * v1.8 UI tests: compass heading, sun-time apply/restore, manual profile state
 * machine, and the wiring of the two-tab layer panel.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { headingDegrees } from '../src/client/scene/heading.js'
import { createSunTimeline, nightBrightness, SUN_NIGHT_MIN_BRIGHTNESS } from '../src/client/scene/sun-timeline.js'
import { createProfileTool } from '../src/client/scene/profile-tool.js'
import { readRepoFile } from './helpers/source.mjs'

test('指南针：heading 弧度到 0..360 度，非法值回 0', () => {
  assert.equal(headingDegrees(0), 0)
  assert.equal(headingDegrees(Math.PI / 2), 90)
  assert.equal(headingDegrees(-Math.PI / 2), 270)
  assert.equal(headingDegrees(2 * Math.PI), 0)
  assert.equal(headingDegrees(Number.NaN), 0)
  assert.equal(headingDegrees(undefined), 0)
})

test('夜间滤镜：太阳高度决定压暗强度，白天为 1，夜间有下限', () => {
  assert.equal(nightBrightness(30), 1)
  assert.equal(nightBrightness(12), 1)
  // v1.5.2: Cesium's brightness stage is mix(black, color, factor), so the old
  // negative value rendered a fully black frame at night; the factor stays > 0.
  assert.equal(SUN_NIGHT_MIN_BRIGHTNESS, 0.5)
  assert.ok(nightBrightness(0) < 1)
  assert.ok(nightBrightness(0) > SUN_NIGHT_MIN_BRIGHTNESS)
  assert.equal(nightBrightness(-6), SUN_NIGHT_MIN_BRIGHTNESS)
  assert.equal(nightBrightness(-20), SUN_NIGHT_MIN_BRIGHTNESS)
  assert.equal(nightBrightness(Number.NaN), 1)
})

test('日照：apply 写入时钟/光照/阴影，restore 恢复进入前状态', () => {
  const tileset = { shadows: 0 }
  const layer = { visible: true, tileset }
  const stages = []
  const viewer = {
    clock: { shouldAnimate: true, currentTime: 'old-time' },
    scene: {
      globe: { enableLighting: false },
      shadowMap: { enabled: false },
      light: 'old-light',
      postProcessStages: { add: (stage) => stages.push(stage), remove: (stage) => stages.splice(stages.indexOf(stage), 1) },
      requestRender() {},
    },
    shadows: false,
  }
  const Cesium = {
    JulianDate: { fromDate: (date) => ({ date }) },
    SunLight: class SunLight {},
    ShadowMode: { ENABLED: 1, DISABLED: 0 },
    PostProcessStageLibrary: { createBrightnessStage: () => ({ uniforms: { brightness: 0.5 }, enabled: true }) },
  }
  const sun = createSunTimeline({ getCesium: () => Cesium, getViewer: () => viewer, getLayers: () => [layer] })

  assert.equal(sun.apply(new Date(2026, 10, 8, 10, 0), { shadows: true }), true)
  assert.equal(stages.length, 1)
  assert.equal(viewer.clock.shouldAnimate, false)
  assert.equal(viewer.scene.globe.enableLighting, true)
  assert.equal(viewer.shadows, true)
  assert.equal(viewer.scene.shadowMap.enabled, true)
  assert.equal(tileset.shadows, 1)
  assert.ok(viewer.scene.light instanceof Cesium.SunLight)

  // A second apply must not overwrite the original restore snapshot.
  viewer.clock.shouldAnimate = true
  sun.apply(new Date(2026, 10, 8, 12, 0), { shadows: false })
  assert.equal(sun.restore(), true)
  assert.equal(stages.length, 0)
  assert.equal(viewer.clock.shouldAnimate, true)
  assert.equal(viewer.scene.globe.enableLighting, false)
  assert.equal(viewer.shadows, false)
  assert.equal(viewer.scene.shadowMap.enabled, false)
  assert.equal(tileset.shadows, 0)
  assert.equal(viewer.scene.light, 'old-light')
  assert.equal(sun.readout(new Date()), null)
})

test('人工剖面：第一次点存点，第二次点自动调用既有 profile 命令', async () => {
  let tool = null
  const calls = []
  const toasts = []
  let added = 0
  const viewer = { entities: { add: () => ({ id: ++added }), remove() {} } }
  const Cesium = {
    Cartographic: { fromCartesian: () => ({ longitude: 1, latitude: 0.5 }) },
    Math: { toDegrees: (radians) => (radians * 180) / Math.PI },
    Color: { fromCssColorString: () => ({}), WHITE: {} },
  }
  const profile = createProfileTool({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    pickSurface: () => ({}),
    setTool: (mode) => {
      tool = mode
    },
    runAnalysis: async (args) => calls.push(args),
    showToast: (text) => toasts.push(text),
    t: (key) => key,
  })

  profile.start()
  assert.equal(tool, 'profile')
  profile.onPoint({ x: 1, y: 2 })
  assert.equal(calls.length, 0)
  assert.ok(toasts.includes('profile.clickEnd'))
  profile.onPoint({ x: 3, y: 4 })
  await Promise.resolve()
  assert.equal(tool, null)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].action, 'profile')
  assert.equal(calls[0].from.length, 2)
  assert.equal(calls[0].to.length, 2)
  assert.equal(calls[0].samples, 32)
})

test('人工剖面：cancel 清掉草稿并退出工具', () => {
  let tool = 'profile'
  let removed = 0
  const viewer = { entities: { add: () => ({}), remove: () => (removed += 1) } }
  const Cesium = {
    Cartographic: { fromCartesian: () => ({ longitude: 1, latitude: 0.5 }) },
    Math: { toDegrees: (radians) => radians },
    Color: { fromCssColorString: () => ({}), WHITE: {} },
  }
  const profile = createProfileTool({
    getCesium: () => Cesium,
    getViewer: () => viewer,
    pickSurface: () => ({}),
    setTool: (mode) => {
      tool = mode
    },
    runAnalysis: async () => {},
    showToast: () => {},
    t: (key) => key,
  })
  profile.start()
  profile.onPoint({ x: 1, y: 2 })
  profile.cancel()
  assert.equal(tool, null)
  assert.ok(removed >= 1)
})

test('剖面卡：缩略图可展开大图，大图内继续导出', () => {
  const cards = readRepoFile('src/client/ui/cards.js')
  assert.match(cards, /ProfileChartDialog/)
  assert.match(cards, /profile-chart-thumb/)
  assert.match(cards, /profile\.expandChart/)
  assert.match(cards, /profileSvg\(metrics, profileChartLabels\(t\)\)/)
  assert.match(cards, /onPointerDown: \(event\) => event\.target === event\.currentTarget && onClose\(\)/)

  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['profile.chartTitle', 'profile.expandChart']) {
    assert.equal((messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []).length, 2, `缺少中英 ${key}`)
  }
})

test('两个 Tab + 指南针 + 日照/剖面接线都在源码里', () => {
  const layers = readRepoFile('src/client/ui/layers-panel.js')
  assert.match(layers, /className: 'mv-layer-tabs'/)
  // 3D 数据优先：三维 Tab 在前且默认打开，地图 Tab 在后。
  assert.match(layers, /useState\('3d'\)/)
  assert.ok(
    layers.indexOf("t('layers.tab.3d')") < layers.indexOf("t('layers.tab.map')"),
    '三维 Tab 必须排在 地图 Tab 前面',
  )
  assert.match(layers, /t\('layers\.tab\.map'\)/)
  assert.match(layers, /t\('layers\.tab\.3d'\)/)
  // Data tabs are separate modules; tools (profile/sun) live in the tools card.
  assert.match(readRepoFile('src/client/ui/layers-map.js'), /key: 'list-map'/)
  assert.match(readRepoFile('src/client/ui/layers-3d.js'), /key: 'list-3d'/)
  const tools = readRepoFile('src/client/ui/tools-panel.js')
  assert.match(tools, /t\('profile\.draw'\)/)
  assert.match(tools, /h\(SunTimeline,/)
  // IA guard: the layer card never grows tools back, the tools card never grows
  // data-layer rows. This is what keeps the refactor from turning into a pile.
  for (const forbidden of ['SunTimeline', 'loadBookmarks', 'profile.draw', 'tools.analysis']) {
    assert.doesNotMatch(layers, new RegExp(forbidden.replaceAll('.', '\\.')), `图层卡不应包含工具：${forbidden}`)
  }
  for (const forbidden of ['Layers3D', 'LayersMap', 'LayerRow', 'onOverlayAdd']) {
    assert.doesNotMatch(tools, new RegExp(forbidden.replaceAll('.', '\\.')), `工具卡不应包含数据图层：${forbidden}`)
  }

  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['layers.tab.map', 'layers.tab.3d', 'compass.reset', 'profile.draw', 'sun.title', 'sun.hint']) {
    assert.equal((messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []).length, 2, `缺少中英 ${key}`)
  }

  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /h\(Compass,/)
  assert.match(surface, /createProfileTool/)
  assert.match(surface, /onProfilePoint/)
  assert.match(surface, /profileTool\.cancel/)
  // Canvas input routing (click / double-click / right-click) lives in its own module.
  const input = readRepoFile('src/client/scene/canvas-input.js')
  assert.match(input, /RIGHT_CLICK/)
  assert.match(input, /LEFT_DOUBLE_CLICK/)
  assert.match(input, /isSelectionActive/)
  const pluginSource = readRepoFile('src/client/plugin.js')
  assert.match(pluginSource, /betterSidebar/)
  assert.match(pluginSource, /registerTab/)
  assert.match(pluginSource, /order: -1/)
  assert.match(readRepoFile('src/client/scene/pointer-tools.js'), /mode === 'profile'/)
  assert.match(readRepoFile('src/client/ui/compass.js'), /headingDegrees/)
  assert.match(readRepoFile('src/client/ui/compass.js'), /mv-compass-rose/)
  assert.match(readRepoFile('src/client/ui/compass.js'), /TICKS/)

  const sun = readRepoFile('src/client/scene/sun-timeline.js')
  assert.match(sun, /createSunTimeline/)
  assert.match(sun, /SunLight/)
  assert.match(sun, /createBrightnessStage/)
  assert.match(readRepoFile('src/client/ui/sun-timeline.js'), /mv-sun-range/)
})
