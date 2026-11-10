/**
 * v1.5.2 sun-timeline tests (P0 4.5).
 *
 * The meeting bugs were all about SCENE STATE and TIME SEMANTICS, so these tests
 * drive the real controller with fake Cesium/viewer objects (no browser):
 *   - enabling the timeline must save and then SHOW skyAtmosphere / skyBox / sun
 *     (the light theme turns the sky off, which is why no sun was visible);
 *   - closing it must restore the exact previous lighting/background state;
 *   - night must stay readable (brightness cap, `night` flag for the UI hint);
 *   - readout must report the BROWSER time zone + UTC offset of the local date,
 *     so a French dataset is not silently read as UTC.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createSunTimeline,
  nightBrightness,
  sunClockLabel,
  sunDataOffsetMinutes,
  sunDateAtOffset,
  sunLocalDate,
  sunTimezone,
  sunTodayInput,
  utcOffsetLabel,
  utcOffsetLabelFromMinutes,
  SUN_NIGHT_MIN_BRIGHTNESS,
} from '../src/client/scene/sun-timeline.js'
import { readRepoFile } from './helpers/source.mjs'

class Vec {
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

/**
 * Minimal Cesium surface: enough of the ephemeris/transform classes to make
 * analysisSunAngles return a controlled altitude, plus clock/light/stage classes
 * for apply(). `sunInertial` is a getter so one fixture can flip day <-> night.
 */
function makeCesium({ sunInertial = () => new Vec(0, 0, 1) } = {}) {
  const Cesium = {
    JulianDate: { fromDate: (date) => ({ date }) },
    SunLight: class SunLight {},
    ShadowMode: { ENABLED: 1, DISABLED: 0 },
    PostProcessStageLibrary: { createBrightnessStage: () => ({ uniforms: { brightness: 1 }, enabled: true }) },
    Simon1994PlanetaryPositions: { computeSunPositionInEarthInertialFrame: () => sunInertial() },
    Transforms: {
      computeIcrfToFixedMatrix: () => ({}),
      computeTemeToPseudoFixedMatrix: () => ({}),
      eastNorthUpToFixedFrame: () => ({}),
    },
    Matrix3: { multiplyByVector: (matrix, vector) => new Vec(vector.x, vector.y, vector.z) },
    Matrix4: {
      getColumn: (matrix, index, target) => {
        Object.assign(target, index === 0 ? { x: 1, y: 0, z: 0, w: 0 } : { x: 0, y: 1, z: 0, w: 0 })
        return target
      },
    },
    Cartesian3: Vec,
    Cartesian4: Vec4,
    Cartographic: { fromCartesian: () => ({ longitude: 0.05, latitude: 0.79, height: 0 }) },
    Ellipsoid: { WGS84: { geodeticSurfaceNormalCartographic: () => new Vec(0, 0, 1) } },
    Color: { fromCssColorString: (css) => ({ css }) },
    Math: {
      clamp: (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value)),
      toDegrees: (radians) => (radians * 180) / Math.PI,
    },
  }
  Vec.normalize = (vector, result) => {
    const length = Math.hypot(vector.x, vector.y, vector.z) || 1
    result.x = vector.x / length
    result.y = vector.y / length
    result.z = vector.z / length
    return result
  }
  Vec.dot = (left, right) => left.x * right.x + left.y * right.y + left.z * right.z
  Vec.fromRadians = () => new Vec(0, 0, 1)
  return Cesium
}

/** Viewer with every sky switch in its "light theme turned it off" state. */
function makeViewer({ withSky = true } = {}) {
  const stages = []
  const tileset = { shadows: 0, boundingSphere: { center: new Vec(0, 0, 0) } }
  const layer = { visible: true, tileset }
  const scene = {
    globe: { enableLighting: false, showGroundAtmosphere: false },
    shadowMap: { enabled: false, softShadows: false, darkness: 0 },
    light: 'old-light',
    backgroundColor: 'old-bg',
    postProcessStages: {
      add: (stage) => stages.push(stage),
      remove: (stage) => stages.splice(stages.indexOf(stage), 1),
    },
    requestRender() {},
  }
  if (withSky) {
    scene.skyAtmosphere = { show: false }
    scene.skyBox = { show: false }
    scene.sun = { show: false }
  }
  const viewer = {
    clock: { shouldAnimate: true, currentTime: 'old-time' },
    scene,
    shadows: false,
  }
  return { viewer, layer, tileset, stages }
}

const makeSun = (Cesium, viewer, layers) =>
  createSunTimeline({ getCesium: () => Cesium, getViewer: () => viewer, getLayers: () => layers })

test('nightBrightness：白天为 1（不改画面），夜间下限 0.5，不再把画面压成黑屏', () => {
  assert.equal(SUN_NIGHT_MIN_BRIGHTNESS, 0.5)
  assert.equal(nightBrightness(90), 1)
  assert.equal(nightBrightness(12), 1)
  assert.ok(nightBrightness(0) < 1)
  assert.ok(nightBrightness(0) > SUN_NIGHT_MIN_BRIGHTNESS)
  assert.equal(nightBrightness(-6), SUN_NIGHT_MIN_BRIGHTNESS)
  assert.equal(nightBrightness(-90), SUN_NIGHT_MIN_BRIGHTNESS)
  assert.equal(nightBrightness(Number.NaN), 1)
  assert.equal(nightBrightness(undefined), 1)
  // Getting darker as the sun sets, never past the floor (a negative factor
  // would be pure black in Cesium's brightness stage).
  let previous = 1
  for (let altitude = 12; altitude >= -10; altitude -= 1) {
    const value = nightBrightness(altitude)
    assert.ok(value <= previous + 1e-9, `altitude ${altitude} should not brighten`)
    assert.ok(value >= SUN_NIGHT_MIN_BRIGHTNESS - 1e-9)
    previous = value
  }
})

test('夜间滤镜的 Cesium 语义：brightness 是 mix 系数，负值 = 黑屏（原 -0.38 的根因）', () => {
  const cesium = readRepoFile('vendor/cesium/index.js')
  assert.match(cesium, /vec3 target = vec3\(0\.0\)/)
  assert.match(cesium, /mix\(target, rgb, brightness\)/)
  // The controller must keep the factor positive, whatever the altitude.
  assert.ok(nightBrightness(-90) > 0)
})

test('apply 保存并打开天空/太阳/地面大气，restore 精确还原进入前状态', () => {
  // One controller, one viewer: the sun direction is mutable so the same
  // snapshot/night-stage survives the day -> night transition.
  const orbit = { sun: new Vec(0, 0, 1) }
  const Cesium = makeCesium({ sunInertial: () => orbit.sun })
  const { viewer, layer, tileset, stages } = makeViewer()
  const sun = makeSun(Cesium, viewer, [layer])

  assert.equal(sun.apply(new Date(2026, 6, 1, 12, 0), { shadows: true }), true)
  // Sky and sun must be VISIBLE while the timeline is on.
  assert.equal(viewer.scene.skyAtmosphere.show, true)
  assert.equal(viewer.scene.skyBox.show, true)
  assert.equal(viewer.scene.sun.show, true)
  assert.equal(viewer.scene.globe.showGroundAtmosphere, true)
  // Lighting/shadow/clock, same semantics as before.
  assert.equal(viewer.clock.shouldAnimate, false)
  assert.equal(viewer.scene.globe.enableLighting, true)
  assert.equal(viewer.shadows, true)
  assert.equal(viewer.scene.shadowMap.enabled, true)
  assert.equal(viewer.scene.shadowMap.softShadows, true)
  assert.equal(viewer.scene.shadowMap.darkness, 0.35)
  assert.equal(tileset.shadows, Cesium.ShadowMode.ENABLED)
  assert.ok(viewer.scene.light instanceof Cesium.SunLight)
  // Daytime: the night filter exists but is off (factor 1 = untouched).
  assert.equal(stages.length, 1)
  assert.equal(stages[0].uniforms.brightness, 1)
  assert.equal(stages[0].enabled, false)

  // Night (sun straight down): the filter dims toward black but is floored,
  // so the frame stays readable instead of becoming a black screen.
  orbit.sun = new Vec(0, 0, -1)
  assert.equal(sun.apply(new Date(2026, 6, 1, 23, 0)), true)
  assert.equal(stages.length, 1, 'a second apply must reuse the one night stage')
  assert.equal(stages[0].uniforms.brightness, SUN_NIGHT_MIN_BRIGHTNESS)
  assert.equal(stages[0].enabled, true)

  // Someone else may repaint the background while the timeline is on.
  viewer.scene.backgroundColor = 'mutated-bg'
  assert.equal(sun.restore(), true)
  assert.equal(stages.length, 0)
  assert.equal(viewer.clock.shouldAnimate, true)
  assert.equal(viewer.clock.currentTime, 'old-time')
  assert.equal(viewer.scene.globe.enableLighting, false)
  assert.equal(viewer.scene.globe.showGroundAtmosphere, false)
  assert.equal(viewer.shadows, false)
  assert.equal(viewer.scene.shadowMap.enabled, false)
  assert.equal(viewer.scene.shadowMap.softShadows, false)
  assert.equal(viewer.scene.shadowMap.darkness, 0)
  assert.equal(tileset.shadows, 0)
  assert.equal(viewer.scene.light, 'old-light')
  assert.equal(viewer.scene.backgroundColor, 'old-bg')
  assert.equal(viewer.scene.skyAtmosphere.show, false)
  assert.equal(viewer.scene.skyBox.show, false)
  assert.equal(viewer.scene.sun.show, false)
})

test('没有天空对象的场景：用可见背景色兜底，restore 还原原背景色', () => {
  const Cesium = makeCesium()
  // withSky: false models a context whose sky box/atmosphere were disposed (or
  // never created); without a fallback the frame would stay pure black.
  const { viewer, layer } = makeViewer({ withSky: false })
  const sun = makeSun(Cesium, viewer, [layer])

  assert.equal(sun.apply(new Date(2026, 6, 1, 12, 0)), true)
  assert.deepEqual(viewer.scene.backgroundColor, { css: '#0b1a2b' })
  assert.equal(sun.restore(), true)
  assert.equal(viewer.scene.backgroundColor, 'old-bg')
})

test('restore 幂等：第二次 restore 无快照、不报错、可再次 apply', () => {
  const Cesium = makeCesium()
  const { viewer, layer, stages } = makeViewer()
  const sun = makeSun(Cesium, viewer, [layer])

  assert.equal(sun.restore(), false)
  assert.equal(sun.apply(new Date(2026, 6, 1, 9, 0)), true)
  assert.equal(sun.restore(), true)
  assert.equal(sun.restore(), false)
  assert.equal(stages.length, 0)
  // The viewer state is untouched by the second restore.
  assert.equal(viewer.scene.skyAtmosphere.show, false)
  // A fresh apply after restore takes a new snapshot.
  assert.equal(sun.apply(new Date(2026, 6, 1, 9, 0)), true)
  assert.equal(viewer.scene.skyAtmosphere.show, true)
  assert.equal(sun.restore(), true)
  assert.equal(viewer.scene.skyAtmosphere.show, false)
})

test('apply 失败可诊断：返回 false 并给出原因，UI 才可能提示而不是静默', () => {
  const missingViewer = createSunTimeline({ getCesium: () => makeCesium(), getViewer: () => null, getLayers: () => [] })
  assert.equal(missingViewer.apply(new Date()), false)
  assert.equal(typeof missingViewer.getError(), 'string')
  assert.ok(missingViewer.getError().length > 0)

  const { viewer, layer } = makeViewer()
  const badDate = makeSun(makeCesium(), viewer, [layer])
  assert.equal(badDate.apply('2026-07-01'), false)
  assert.match(badDate.getError(), /date|Date/)
  assert.equal(badDate.apply(new Date(Number.NaN)), false)

  // A Cesium call that throws must not escape; the reason is kept for the UI.
  const throwing = {
    JulianDate: {
      fromDate: () => {
        throw new Error('cuberoot failed')
      },
    },
  }
  const crashing = makeSun(throwing, viewer, [layer])
  assert.equal(crashing.apply(new Date(2026, 6, 1, 12, 0)), false)
  assert.match(crashing.getError(), /cuberoot failed/)
})

test('画面地方时：按经度每度 4 分钟推导 UTC 偏移，墙钟按所选时区换算绝对时刻', () => {
  // 3.17°E (Clermont) ≈ +13 min mean solar; west longitudes are negative.
  assert.equal(sunDataOffsetMinutes(3.17), 13)
  assert.equal(sunDataOffsetMinutes(-120), -480)
  assert.equal(sunDataOffsetMinutes(0), 0)
  assert.equal(sunDataOffsetMinutes(Number.NaN), null)
  assert.equal(utcOffsetLabelFromMinutes(13), '+00:13')
  assert.equal(utcOffsetLabelFromMinutes(-480), '-08:00')
  assert.equal(utcOffsetLabelFromMinutes(0), '+00:00')

  // 12:00 at UTC+01:00 is 11:00Z; 12:00 at UTC-08:00 is 20:00Z.
  const plusOne = sunDateAtOffset('2026-07-01', 12 * 60, 60)
  assert.equal(plusOne.getTime(), Date.UTC(2026, 6, 1, 11, 0, 0, 0))
  const minusEight = sunDateAtOffset('2026-07-01', 12 * 60, -480)
  assert.equal(minusEight.getTime(), Date.UTC(2026, 6, 1, 20, 0, 0, 0))
  // Browser-local helper and offset helper agree at the browser offset.
  const local = sunLocalDate('2026-07-01', 12 * 60)
  const sameInstant = sunDateAtOffset('2026-07-01', 12 * 60, -local.getTimezoneOffset())
  assert.equal(sameInstant.getTime(), local.getTime())
})

test('sceneLongitude：用当前可见图层中心（否则相机）推导画面经度，未就绪返回 null', () => {
  const Cesium = makeCesium()
  const { viewer, layer } = makeViewer()
  const sun = makeSun(Cesium, viewer, [layer])
  // Fake Cartographic.fromCartesian returns longitude 0.05 rad = 2.86°.
  const longitude = sun.sceneLongitude()
  assert.ok(Number.isFinite(longitude))
  assert.ok(Math.abs(longitude - Cesium.Math.toDegrees(0.05)) < 1e-9)
  assert.equal(sunDataOffsetMinutes(longitude), Math.round(Cesium.Math.toDegrees(0.05) * 4))
  assert.equal(makeSun(Cesium, null, []).sceneLongitude(), null)
})

test('readout：返回夜间标志、浏览器时区与当前时刻的 UTC 偏移', () => {
  const date = new Date(2026, 6, 1, 12, 0)
  const { viewer, layer } = makeViewer()

  const daySun = makeSun(makeCesium({ sunInertial: () => new Vec(0, 0, 1) }), viewer, [layer])
  const day = daySun.readout(date)
  assert.ok(day)
  assert.equal(day.altitude, 90)
  assert.equal(day.azimuth, 0)
  assert.equal(day.night, false)
  assert.equal(day.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone)
  assert.match(day.utcOffset, /^[+-]\d{2}:\d{2}$/)

  // The offset is local-minus-UTC for the SELECTED instant (DST aware).
  const sign = day.utcOffset.startsWith('-') ? -1 : 1
  const [hours, minutes] = day.utcOffset.slice(1).split(':').map(Number)
  // `-date.getTimezoneOffset()` is -0 in a UTC CI runner; compare numeric zero,
  // not object identity (strictEqual distinguishes 0 from -0).
  assert.equal(sign * (hours * 60 + minutes), -date.getTimezoneOffset() || 0)

  // Below the horizon: night flag, UI can explain the darker frame.
  const nightSun = makeSun(makeCesium({ sunInertial: () => new Vec(0, 0, -1) }), viewer, [layer])
  const night = nightSun.readout(date)
  assert.ok(night)
  assert.equal(night.altitude, -90)
  assert.equal(night.night, true)

  // No ready viewer => null (the UI shows dashes, never a fake sun).
  assert.equal(makeSun(makeCesium(), null, [layer]).readout(date), null)
})

test('本地时间语义：日期输入与滑杆按浏览器本地墙钟构造 Date，不是 UTC', () => {
  const date = sunLocalDate('2026-07-01', 12 * 60 + 30)
  assert.equal(date.getFullYear(), 2026)
  assert.equal(date.getMonth(), 6)
  assert.equal(date.getDate(), 1)
  assert.equal(date.getHours(), 12)
  assert.equal(date.getMinutes(), 30)
  assert.equal(date.getTime(), new Date(2026, 6, 1, 12, 30, 0, 0).getTime())
  // Minutes are clamped to one day, not rolled into the next date.
  assert.equal(sunLocalDate('2026-07-01', 5000).getHours(), 23)
  assert.equal(sunLocalDate('2026-07-01', 5000).getMinutes(), 59)
  assert.equal(sunLocalDate('2026-07-01', -10).getHours(), 0)

  assert.match(sunTodayInput(), /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(sunClockLabel(0), '00:00')
  assert.equal(sunClockLabel(9 * 60 + 5), '09:05')
  assert.equal(sunClockLabel(1439), '23:59')

  // sunTimezone reports the same zone as readout and a canonical UTC offset.
  const meta = sunTimezone(date)
  assert.equal(meta.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone)
  assert.match(meta.utcOffset, /^[+-]\d{2}:\d{2}$/)
  assert.equal(utcOffsetLabel(date), meta.utcOffset)
})

test('apply 与 readout 用同一绝对时刻（法国数据时间与太阳位置一致）', () => {
  const seen = []
  const Cesium = makeCesium()
  const fromDate = Cesium.JulianDate.fromDate
  Cesium.JulianDate.fromDate = (date) => {
    seen.push(date.getTime())
    return fromDate(date)
  }
  const { viewer, layer } = makeViewer()
  const sun = makeSun(Cesium, viewer, [layer])

  const localDate = sunLocalDate('2026-07-01', 10 * 60) // 10:00 browser local
  assert.equal(sun.apply(localDate), true)
  const readout = sun.readout(localDate)
  assert.ok(readout)
  // The scene clock and the sun readout both use that exact instant.
  const expectedInstant = new Date(2026, 6, 1, 10, 0, 0, 0).getTime()
  assert.ok(seen.length >= 2, 'apply + readout both convert the same local Date')
  assert.ok(seen.every((instant) => instant === expectedInstant))
  assert.equal(viewer.clock.currentTime.date.getTime(), localDate.getTime())
})

test('UI 源码：时区切换/画面地方时/夜间解释，并在 apply 失败时给出提示', () => {
  const ui = readRepoFile('src/client/ui/sun-timeline.js')
  assert.match(ui, /ZONE_MODES = \['scene', 'browser', 'utc'\]/)
  assert.match(ui, /sun\.zone\.\$\{mode\}/)
  const messages = readRepoFile('src/client/messages-v18.js')
  for (const key of ['sun.zone.scene', 'sun.zone.browser', 'sun.zone.utc', 'sun.zone.sceneLabel', 'sun.zone.browserLabel']) {
    assert.equal(
      (messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []).length,
      2,
      `缺少中英时区文案 ${key}`,
    )
  }
  assert.match(ui, /sun\.timezoneHint/)
  assert.match(ui, /sun\.nightHint/)
  assert.match(ui, /sun\.applyFailed/)
  assert.match(ui, /sunDateAtOffset/)
  assert.match(ui, /sunDataOffsetMinutes/)
  assert.match(ui, /sceneLongitude/)
  assert.match(ui, /getError/)
  assert.match(ui, /mv-sun-zone/)
  assert.match(ui, /mv-sun-alert/)
  assert.match(ui, /readout\?\.night/)
  // The conversion to an absolute instant lives in the scene helper; the UI must
  // not quietly reinterpret the wall clock as UTC on its own.
  assert.doesNotMatch(ui, /Date\.UTC/)

  const scene = readRepoFile('src/client/scene/sun-timeline.js')
  assert.match(scene, /skyAtmosphere/)
  assert.match(scene, /skyBox/)
  assert.match(scene, /sun\.show/)
  assert.match(scene, /backgroundColor/)
  assert.match(scene, /showGroundAtmosphere/)
  assert.match(scene, /SUN_NIGHT_MIN_BRIGHTNESS/)
  assert.match(scene, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/)
  assert.match(scene, /export function sunDataOffsetMinutes/)
  assert.match(scene, /export function sunDateAtOffset/)
  assert.match(scene, /function sceneLongitude/)
})
