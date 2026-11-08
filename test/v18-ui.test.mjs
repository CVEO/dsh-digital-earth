/**
 * v1.8 UI tests: compass heading, sun-time apply/restore, manual profile state
 * machine, and the wiring of the two-tab layer panel.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { headingDegrees } from '../src/client/scene/heading.js'
import { createSunTimeline, nightBrightness } from '../src/client/scene/sun-timeline.js'
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

test('夜间滤镜：太阳高度决定压暗强度，白天为 0，夜间封顶', () => {
  assert.equal(nightBrightness(30), 0)
  assert.equal(nightBrightness(12), 0)
  assert.ok(nightBrightness(0) < -0.2)
  assert.ok(nightBrightness(0) > -0.38)
  assert.equal(nightBrightness(-6), -0.38)
  assert.equal(nightBrightness(-20), -0.38)
  assert.equal(nightBrightness(Number.NaN), 0)
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
  assert.match(layers, /key: 'list-map'/)
  assert.match(layers, /key: 'list-3d'/)
  assert.match(layers, /t\('layers\.tab\.map'\)/)
  assert.match(layers, /t\('layers\.tab\.3d'\)/)
  assert.match(layers, /t\('profile\.draw'\)/)
  assert.match(layers, /h\(SunTimeline,/)

  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['layers.tab.map', 'layers.tab.3d', 'compass.reset', 'profile.draw', 'sun.title', 'sun.hint']) {
    assert.equal((messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []).length, 2, `缺少中英 ${key}`)
  }

  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  assert.match(surface, /h\(Compass,/)
  assert.match(surface, /createProfileTool/)
  assert.match(surface, /onProfilePoint/)
  assert.match(surface, /RIGHT_CLICK/)
  assert.match(surface, /profileTool\.cancel/)
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
