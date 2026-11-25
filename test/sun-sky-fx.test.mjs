import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  SUN_SKY_STAGE_NAME,
  buildSunSkyFragmentShader,
  computeSunBackdropProfile,
} from '../src/client/scene/sun-sky-fx.js'
import {
  SUN_NIGHT_MIN_BRIGHTNESS,
  createSunTimeline,
  sunDateAtOffset,
} from '../src/client/scene/sun-timeline.js'
import { readRepoFile } from './helpers/source.mjs'

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }
}

class Vec4 {
  constructor(x = 0, y = 0, z = 0, w = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }
}

function makeRichCesium({ sunInertial = () => new Vec3(0, 0, 1) } = {}) {
  class FakePostProcessStage {
    constructor({ name, fragmentShader, uniforms }) {
      this.name = name
      this.fragmentShader = fragmentShader
      this.uniforms = { ...uniforms }
      this.enabled = true
    }
  }
  const Cesium = {
    JulianDate: { fromDate: (date) => ({ date }) },
    SunLight: class SunLight {},
    ShadowMode: { ENABLED: 1, DISABLED: 0 },
    SceneMode: { SCENE2D: 2, SCENE3D: 3 },
    DynamicAtmosphereLightingType: { NONE: 0, SCENE_LIGHT: 1, SUNLIGHT: 2 },
    PostProcessStage: FakePostProcessStage,
    PostProcessStageLibrary: { createBrightnessStage: () => ({ uniforms: { brightness: 1 }, enabled: true }) },
    Simon1994PlanetaryPositions: { computeSunPositionInEarthInertialFrame: () => sunInertial() },
    Transforms: {
      computeIcrfToFixedMatrix: () => ({}),
      computeTemeToPseudoFixedMatrix: () => ({}),
      eastNorthUpToFixedFrame: () => ({}),
    },
    Matrix3: { multiplyByVector: (_m, v) => new Vec3(v.x, v.y, v.z) },
    Matrix4: {
      getColumn: (_m, idx, target) => {
        Object.assign(target, idx === 0 ? { x: 1, y: 0, z: 0, w: 0 } : { x: 0, y: 1, z: 0, w: 0 })
        return target
      },
    },
    Cartesian3: Vec3,
    Cartesian4: Vec4,
    Cartographic: { fromCartesian: () => ({ longitude: 0.05, latitude: 0.79, height: 0 }) },
    Ellipsoid: { WGS84: { geodeticSurfaceNormalCartographic: () => new Vec3(0, 0, 1) } },
    Color: { fromCssColorString: (css) => ({ css }) },
    Math: {
      clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
      toDegrees: (rad) => (rad * 180) / Math.PI,
    },
  }
  Vec3.normalize = (v, r) => {
    const len = Math.hypot(v.x, v.y, v.z) || 1
    r.x = v.x / len
    r.y = v.y / len
    r.z = v.z / len
    return r
  }
  Vec3.dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
  Vec3.fromRadians = () => new Vec3(0, 0, 1)
  return Cesium
}

function makeRichViewer() {
  const stages = []
  const tileset = { shadows: 0, boundingSphere: { center: new Vec3(0, 0, 0) } }
  const layer = { visible: true, tileset }
  const scene = {
    mode: 3,
    context: { depthTexture: true },
    globe: {
      enableLighting: false,
      showGroundAtmosphere: false,
      dynamicAtmosphereLighting: false,
      dynamicAtmosphereLightingFromSun: false,
    },
    atmosphere: { dynamicLighting: 0 },
    skyAtmosphere: {
      show: false,
      perFragmentAtmosphere: false,
      atmosphereLightIntensity: 50,
      atmosphereMieCoefficient: new Vec3(21e-6, 21e-6, 21e-6),
      saturationShift: 0,
    },
    skyBox: { show: false },
    sun: { show: false, glowFactor: 1 },
    shadowMap: { enabled: false, softShadows: false, darkness: 0 },
    light: 'old-light',
    backgroundColor: 'old-bg',
    postProcessStages: {
      add: (stage) => stages.push(stage),
      remove: (stage) => {
        const i = stages.indexOf(stage)
        if (i >= 0) stages.splice(i, 1)
      },
    },
    requestRender() {},
  }
  const viewer = {
    clock: { shouldAnimate: true, currentTime: 'old-time' },
    scene,
    shadows: false,
  }
  return { viewer, layer, stages }
}

test('computeSunBackdropProfile：昼夜/黄昏关键帧渐变连续、无突变且边界收敛', () => {
  const night = computeSunBackdropProfile(-18)
  const twilight = computeSunBackdropProfile(-6)
  const sunset = computeSunBackdropProfile(0)
  const golden = computeSunBackdropProfile(8)
  const noon = computeSunBackdropProfile(60)

  assert.equal(night.sunIntensity, 0)
  assert.equal(night.starAmount, 1)
  assert.equal(night.skyBoxVisible, true)

  assert.ok(sunset.sunsetGlow[0] > sunset.sunsetGlow[2], 'sunset glow is warm red-orange')
  assert.ok(sunset.horizon[0] > noon.horizon[0], 'sunset horizon is warmer than noon')
  assert.ok(golden.sunGlowFactor > 2.0)

  assert.equal(noon.starAmount, 0)
  assert.equal(noon.skyBoxVisible, false)
  assert.ok(noon.zenith[2] > noon.zenith[0], 'noon zenith is blue')

  // Clamping & NaN safety
  assert.deepEqual(computeSunBackdropProfile(-90), night)
  assert.deepEqual(computeSunBackdropProfile(90), noon)
  assert.equal(computeSunBackdropProfile(Number.NaN).altitude, 30)
  assert.ok(twilight.starAmount > sunset.starAmount)
})

test('buildSunSkyFragmentShader：使用 Cesium 1.147.0 已验证的 WebGL2 / built-in uniforms', () => {
  const glsl = buildSunSkyFragmentShader()
  for (const token of [
    'uniform sampler2D colorTexture',
    'uniform sampler2D depthTexture',
    'czm_sunDirectionEC',
    'czm_sunDirectionWC',
    'czm_inverseViewRotation',
    'czm_inverseProjection',
    'czm_projection',
    'czm_viewerPositionWC',
    'czm_viewport',
    'u_brightness',
    'u_fxEnabled',
    'out_FragColor',
  ]) {
    assert.ok(glsl.includes(token), `missing GLSL token: ${token}`)
  }
})

test('createSunTimeline + sky-fx：开启应用动态大气与天幕 stage，切换 effects / 昼夜与 restore 完整还原', () => {
  const orbit = { sun: new Vec3(0, 0, 1) }
  const Cesium = makeRichCesium({ sunInertial: () => orbit.sun })
  const { viewer, layer, stages } = makeRichViewer()
  const sun = createSunTimeline({ getCesium: () => Cesium, getViewer: () => viewer, getLayers: () => [layer] })

  assert.equal(sun.apply(new Date(2026, 6, 1, 12, 0), { shadows: true, effects: true }), true)
  assert.equal(stages.length, 1)
  assert.equal(stages[0].name, SUN_SKY_STAGE_NAME)
  assert.equal(stages[0].enabled, true)
  assert.equal(stages[0].uniforms.u_fxEnabled, 1)
  assert.equal(stages[0].uniforms.u_brightness, 1)
  assert.equal(viewer.scene.atmosphere.dynamicLighting, Cesium.DynamicAtmosphereLightingType.SUNLIGHT)
  assert.equal(viewer.scene.skyAtmosphere.perFragmentAtmosphere, true)
  assert.equal(viewer.scene.globe.dynamicAtmosphereLighting, true)
  assert.equal(viewer.scene.globe.dynamicAtmosphereLightingFromSun, true)
  assert.ok(viewer.scene.sun.glowFactor > 1.5)
  assert.equal(viewer.scene.skyBox.show, false, 'daytime hides night star skyBox when custom sky curtain runs')

  // Night transition keeps stage single, fades stars in, restores skyBox & clamps brightness >= 0.5
  orbit.sun = new Vec3(0, 0, -1)
  assert.equal(sun.apply(new Date(2026, 6, 1, 23, 0), { shadows: true, effects: true }), true)
  assert.equal(stages.length, 1)
  assert.equal(stages[0].uniforms.u_brightness, SUN_NIGHT_MIN_BRIGHTNESS)
  assert.equal(stages[0].uniforms.u_starAmount, 1)
  assert.equal(viewer.scene.skyBox.show, true)

  // Turn effects off during daytime: atmosphere settings revert while timeline stays enabled
  orbit.sun = new Vec3(0, 0, 1)
  assert.equal(sun.apply(new Date(2026, 6, 1, 12, 0), { shadows: true, effects: false }), true)
  assert.equal(stages[0].uniforms.u_fxEnabled, 0)
  assert.equal(stages[0].enabled, false)
  assert.equal(viewer.scene.atmosphere.dynamicLighting, 0)
  assert.equal(viewer.scene.skyAtmosphere.perFragmentAtmosphere, false)
  assert.equal(viewer.scene.sun.glowFactor, 1)
  assert.equal(viewer.scene.skyBox.show, true)

  // Restore reverts all pre-timeline flags & removes the post-process stage
  assert.equal(sun.restore(), true)
  assert.equal(stages.length, 0)
  assert.equal(viewer.scene.atmosphere.dynamicLighting, 0)
  assert.equal(viewer.scene.skyAtmosphere.show, false)
  assert.equal(viewer.scene.skyAtmosphere.perFragmentAtmosphere, false)
  assert.equal(viewer.scene.globe.dynamicAtmosphereLighting, false)
  assert.equal(viewer.scene.globe.dynamicAtmosphereLightingFromSun, false)
  assert.equal(viewer.scene.sun.glowFactor, 1)
  assert.equal(viewer.scene.skyBox.show, false)
})

test('sunDateAtOffset 支持亚分钟平滑推进而不破坏整分钟结果', () => {
  const whole = sunDateAtOffset('2026-07-01', 12 * 60, 0)
  const halfMin = sunDateAtOffset('2026-07-01', 12 * 60 + 0.5, 0)
  assert.equal(halfMin.getTime() - whole.getTime(), 30_000)
})

test('UI 与中英文文案：包含播放/暂停、倍速、天幕与太阳特效开关且成对存在', () => {
  const ui = readRepoFile('src/client/ui/sun-timeline.js')
  assert.match(ui, /PLAYBACK_SPEEDS = \[15, 60, 180\]/)
  assert.match(ui, /requestAnimationFrame/)
  assert.match(ui, /sun\.play/)
  assert.match(ui, /sun\.pause/)
  assert.match(ui, /sun\.effects/)

  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['sun.effects', 'sun.play', 'sun.pause', 'sun.speed.15', 'sun.speed.60', 'sun.speed.180', 'sun.fxHint']) {
    assert.equal(
      (messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []).length,
      2,
      `missing zh/en i18n pair for ${key}`,
    )
  }
})
