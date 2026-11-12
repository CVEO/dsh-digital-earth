/**
 * v1.7 P0 — guided tour ("导览故事条") and distance-adaptive camera flights.
 *
 * A tour = saved bookmarks (view + caption) played as stops: fly, dwell, advance,
 * and the user can take over at any time. Pure functions here; the React story
 * bar is wired in ui/tour-bar.js + ui/layers-panel.js.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_BOOKMARK_CAPTION,
  addBookmark,
  flyToBookmark,
  normalizeBookmarks,
  updateBookmarkCaption,
} from '../src/client/scene/bookmarks.js'
import { cameraView, flightDuration, viewDistanceM } from '../src/client/scene/motion.js'
import {
  TOUR_MAX_DURATION,
  TOUR_MIN_DURATION,
  TOUR_MIN_STOPS,
  buildTour,
  stepIndex,
  stopCaption,
  tourDuration,
} from '../src/client/scene/tour.js'
import { MESSAGES } from '../src/client/messages.js'
import { clientSource, readRepoFile } from './helpers/source.mjs'

const view = (extra = {}) => ({ lon: 114.3, lat: 30.5, height: 800, heading: 15, pitch: -40, ...extra })

/** Minimal Cesium/viewer double: just enough for cameraView / flyToBookmark. */
function fakeCamera(positionCarto = { longitude: 0, latitude: 0, height: 0 }) {
  const calls = []
  const viewer = {
    camera: {
      positionWC: { carto: positionCarto },
      heading: 0,
      pitch: 0,
      flyTo: (options) => calls.push(options),
    },
  }
  const Cesium = {
    Cartesian3: { fromDegrees: (lon, lat, height) => ({ lon, lat, height }) },
    Cartographic: { fromCartesian: (position) => position?.carto ?? null },
    Math: { toRadians: (degrees) => (degrees * Math.PI) / 180, toDegrees: (radians) => (radians * 180) / Math.PI },
  }
  return { viewer, Cesium, calls }
}

test('motion：距离按经纬度+高差计算；1.2 / 1.6 / 2.4 s 三档且非法距离回落到最快', () => {
  const oneDegreeLat = viewDistanceM({ lon: 0, lat: 0, height: 0 }, { lon: 0, lat: 1, height: 0 })
  assert.ok(oneDegreeLat > 110000 && oneDegreeLat < 112000)
  assert.equal(viewDistanceM({ lon: 0, lat: 0, height: 0 }, { lon: 0, lat: 0, height: 500 }), 500)
  assert.equal(viewDistanceM(null, null), 0)

  assert.equal(flightDuration(0), 1.2)
  assert.equal(flightDuration(500), 1.2)
  assert.equal(flightDuration(1999), 1.2)
  assert.equal(flightDuration(2000), 1.6)
  assert.equal(flightDuration(49000), 1.6)
  assert.equal(flightDuration(50000), 2.4)
  assert.equal(flightDuration(6000000), 2.4)
  assert.equal(flightDuration(Number.NaN), 1.2)
  assert.equal(flightDuration(1000, { min: 1.6, mid: 2, max: 2.4 }), 1.6)
})

test('cameraView：把相机换算成 view 对象；相机缺失时返回 null', () => {
  const { viewer, Cesium } = fakeCamera({ longitude: Math.PI / 2, latitude: 0.5, height: 900 })
  const current = cameraView(viewer, Cesium)
  assert.ok(Math.abs(current.lon - 90) < 1e-9)
  assert.ok(Math.abs(current.lat - 28.64788975654116) < 1e-6)
  assert.equal(current.height, 900)
  assert.equal(cameraView(null, Cesium), null)
  assert.equal(cameraView({ camera: null }, Cesium), null)
})

test('书签 caption：新增可选字段向后兼容，旧数据读出为空串，超长截断', () => {
  const legacy = normalizeBookmarks([{ id: 'a', name: '旧收藏', view: view() }])
  assert.equal(legacy[0].caption, '')
  const added = addBookmark([], view(), '山顶', { caption: '从这里能看到整个校区' })
  assert.equal(added.bookmark.caption, '从这里能看到整个校区')
  const long = addBookmark([], view(), 'x', { caption: 'a'.repeat(500) })
  assert.equal(long.bookmark.caption.length, MAX_BOOKMARK_CAPTION)
  const edited = updateBookmarkCaption(added.list, added.bookmark.id, '  新的说明  ')
  assert.equal(edited[0].caption, '新的说明')
  assert.equal(updateBookmarkCaption(edited, 'missing', 'x').length, 1)
  // Round trip through storage keeps the caption.
  assert.deepEqual(normalizeBookmarks(edited), edited)
})

test('flyToBookmark：未指定时长时按距离自适应，显式时长仍被尊重', () => {
  const near = fakeCamera({ longitude: 114.3 * (Math.PI / 180), latitude: 30.5 * (Math.PI / 180), height: 800 })
  assert.equal(flyToBookmark(near.viewer, near.Cesium, view()), true)
  assert.equal(near.calls[0].duration, 1.2, '同城短途保持 1.2 s')
  assert.equal(near.calls[0].orientation.roll, 0)

  const far = fakeCamera({ longitude: 0, latitude: 0, height: 0 })
  assert.equal(flyToBookmark(far.viewer, far.Cesium, view({ lon: 120, lat: 31 })), true)
  assert.equal(far.calls[0].duration, 2.4, '跨省长途给足 2.4 s')

  const pinned = fakeCamera({ longitude: 0, latitude: 0, height: 0 })
  assert.equal(flyToBookmark(pinned.viewer, pinned.Cesium, view(), 0.8), true)
  assert.equal(pinned.calls[0].duration, 0.8)
})

test('tour：站点构建丢弃非法视角、保留 caption、播放需要 ≥2 站', () => {
  const stops = buildTour([
    { id: 'a', name: 'A', caption: ' 第一站说明 ', view: view() },
    { id: 'b', name: 'B', view: view({ lon: 115 }) },
    { id: 'c', caption: '坏视角', view: { lon: 999 } },
  ])
  assert.equal(stops.length, 2)
  assert.equal(stops[0].caption, '第一站说明')
  assert.equal(stops[1].caption, '')
  assert.equal(stops[1].name, 'B')
  assert.equal(TOUR_MIN_STOPS, 2)
  assert.equal(buildTour([]).length, 0)
})

test('tour：stepIndex 环绕、stopCaption 回退、tourDuration 落在 1.6–2.4 s', () => {
  assert.equal(stepIndex(0, 1, 3), 1)
  assert.equal(stepIndex(2, 1, 3), 0)
  assert.equal(stepIndex(0, -1, 3), 2)
  assert.equal(stepIndex(5, 1, 0), 0)

  const t = (key, params) => `${key}:${params?.n ?? ''}`
  assert.equal(stopCaption({ caption: '看这里' }, 0, t), '看这里')
  assert.equal(stopCaption({ caption: '' }, 2, t), 'tour.stop:3')
  assert.equal(stopCaption(null, 0, t), 'tour.stop:1')

  const nearStop = tourDuration(view({ height: 800 }), view({ height: 900 }))
  assert.equal(nearStop, TOUR_MIN_DURATION)
  const midStop = tourDuration(view({ lon: 0, lat: 0 }), view({ lon: 0.1, lat: 0 }))
  assert.ok(midStop > TOUR_MIN_DURATION && midStop < TOUR_MAX_DURATION)
  const farStop = tourDuration(view({ lon: 0, lat: 0 }), view({ lon: 120, lat: 31 }))
  assert.equal(farStop, TOUR_MAX_DURATION)
  assert.equal(tourDuration(null, null), TOUR_MIN_DURATION)
})

test('i18n：导览/指认文案中英齐全（含 caption 占位符）', () => {
  for (const key of [
    'tour.title',
    'tour.start',
    'tour.needStops',
    'tour.stop',
    'tour.progress',
    'tour.play',
    'tour.pause',
    'tour.prev',
    'tour.next',
    'tour.exit',
    'tour.finished',
    'tour.hint',
    'bookmarks.captionPlaceholder',
    'layers.details',
  ]) {
    assert.equal(typeof MESSAGES.zh[key], 'string', `缺少 zh ${key}`)
    assert.equal(typeof MESSAGES.en[key], 'string', `缺少 en ${key}`)
  }
})

test('接线：工具卡有播放按钮 + 说明输入，面板根渲染故事条并支持拖动接管', () => {
  // Bookmarks/tour are tools (data/tools split), so the editing UI lives in
  // ui/tools-bookmarks.js and the group in ui/tools-panel.js.
  const panel = readRepoFile('src/client/ui/tools-bookmarks.js')
  assert.match(panel, /onStartTour/)
  assert.match(panel, /t\('tour\.start'\)/)
  assert.match(panel, /className: 'mv-caption'/)
  assert.match(panel, /updateBookmarkCaption/)
  const tools = readRepoFile('src/client/ui/tool-catalog.js')
  assert.match(tools, /'tools\.view'/)
  assert.match(readRepoFile('src/client/ui/tool-windows.js'), /ToolsBookmarks/)

  const bar = readRepoFile('src/client/ui/tour-bar.js')
  assert.match(bar, /document\.addEventListener\('pointerdown', onPointerDown, true\)/)
  assert.match(bar, /bar\.contains\(event\.target\)/)
  assert.match(bar, /TOUR_DWELL_MS/)
  assert.match(bar, /onFinish/)

  const client = clientSource()
  assert.match(client, /onStartTour: tour\.start/)
  assert.match(client, /tour\.element/)
  assert.match(client, /onFinish: \(\) => void screenshot\(\)/)
  assert.match(client, /\.mv-tour\{position:absolute/)
})
