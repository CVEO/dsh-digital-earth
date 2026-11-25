/**
 * v1.6 feature — camera bookmarks ("视角收藏") and the single fullscreen entry.
 *
 * Bookmarks are client-only: a named camera view persisted in localStorage, listed
 * in the layer panel, click to fly, ✕ to delete. No tool contract changes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  addBookmark,
  BOOKMARK_STORAGE_KEY,
  captureBookmarkThumbnail,
  flyToBookmark,
  formatBookmarkMeta,
  loadBookmarks,
  moveBookmark,
  normalizeBookmarkView,
  normalizeBookmarks,
  removeBookmark,
  renameBookmark,
  saveBookmarks,
  updateBookmarkView,
} from '../src/client/scene/bookmarks.js'
import { clientSource, readRepoFile } from './helpers/source.mjs'

const view = (extra = {}) => ({ lon: 114.3, lat: 30.5, height: 800, heading: 15, pitch: -40, ...extra })

test('view 校验：缺/越界字段被拒绝，heading/pitch 缺省补齐', () => {
  assert.deepEqual(normalizeBookmarkView(view()), view())
  assert.deepEqual(normalizeBookmarkView({ lon: 1, lat: 2, height: 3 }), { lon: 1, lat: 2, height: 3, heading: 0, pitch: -45 })
  assert.equal(normalizeBookmarkView(null), null)
  assert.equal(normalizeBookmarkView({ lon: 200, lat: 0, height: 10 }), null, '经度越界')
  assert.equal(normalizeBookmarkView({ lon: 0, lat: 95, height: 10 }), null, '纬度越界')
  assert.equal(normalizeBookmarkView({ lon: 0, lat: 0, height: -5 }), null, '高度为负')
})

test('列表规范化：丢弃非法项、id 去重、名称回退、封顶 20 条', () => {
  const list = normalizeBookmarks([
    { id: 'a', name: '  山顶  ', view: view() },
    { id: 'a', name: 'dup', view: view() },
    { id: 'b', name: '', view: view({ lon: 120 }) },
    { id: 'c', view: { lon: 'x' } },
    { id: 'd', name: 'bad height', view: view({ height: 1e9 }) },
    'nope',
  ])
  assert.deepEqual(list.map((item) => item.id), ['a', 'b'])
  assert.equal(list[0].name, '山顶')
  assert.equal(list[1].name, '视角')
  const many = Array.from({ length: 30 }, (_, index) => ({ id: `b${index}`, name: `B${index}`, view: view() }))
  assert.equal(normalizeBookmarks(many).length, 20)
})

test('load/save：往返、缺失/损坏/不可用存储都安全', () => {
  const data = new Map()
  const storage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  }
  assert.deepEqual(loadBookmarks(storage), [])
  const list = normalizeBookmarks([{ id: 'a', name: 'A', view: view() }])
  assert.equal(saveBookmarks(list, storage), true)
  assert.equal(data.has(BOOKMARK_STORAGE_KEY), true)
  assert.deepEqual(loadBookmarks(storage), list)

  data.set(BOOKMARK_STORAGE_KEY, '{not json')
  assert.deepEqual(loadBookmarks(storage), [], '损坏的 JSON 应回退为空列表')
  assert.deepEqual(loadBookmarks(null), [])
  assert.equal(saveBookmarks(list, null), false)
  const broken = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('quota')
    },
  }
  assert.deepEqual(loadBookmarks(broken), [])
  assert.equal(saveBookmarks(list, broken), false)
})

test('add/remove/rename/move/update：按 1→2→3 顺序追加、编号不冲突、支持重命名与调序与缩略图', () => {
  const first = addBookmark([], view(), null, { now: 1000, idFactory: () => 'id-1', thumb: 'data:image/jpeg;base64,AAA' })
  assert.equal(first.bookmark.name, '视角 1')
  assert.equal(first.bookmark.thumb, 'data:image/jpeg;base64,AAA')
  assert.equal(first.list.length, 1)
  const second = addBookmark(first.list, view({ lon: 120 }), '  东侧  ', { now: 2000, idFactory: () => 'id-2' })
  assert.deepEqual(second.list.map((item) => item.id), ['id-1', 'id-2'], '新收藏应按导览顺序追加在末尾')
  assert.equal(second.bookmark.name, '东侧')
  assert.equal(second.bookmark.createdAt, 2000)

  // Deleting an earlier item must not cause the next auto-generated name to collide.
  const third = addBookmark(second.list, view({ lon: 121 }), null, { now: 3000, idFactory: () => 'id-3' })
  assert.equal(third.bookmark.name, '视角 3')
  const withoutSecond = removeBookmark(third.list, 'id-2')
  const fourth = addBookmark(withoutSecond, view({ lon: 122 }), null, { now: 4000, idFactory: () => 'id-4' })
  assert.equal(fourth.bookmark.name, '视角 4')

  const rejected = addBookmark(second.list, { lon: 999, lat: 0, height: 0 }, null)
  assert.equal(rejected.bookmark, null)
  assert.equal(rejected.list.length, 2)

  assert.deepEqual(removeBookmark(second.list, 'id-2').map((item) => item.id), ['id-1'])
  assert.deepEqual(removeBookmark(second.list, 'missing').map((item) => item.id), ['id-1', 'id-2'])

  // Rename, reorder and in-place view recapture
  const renamed = renameBookmark(second.list, 'id-1', '  南门入口  ')
  assert.equal(renamed[0].name, '南门入口')
  assert.equal(renameBookmark(renamed, 'id-1', '   ')[0].name, '南门入口')

  const moved = moveBookmark(renamed, 'id-2', -1)
  assert.deepEqual(moved.map((item) => item.id), ['id-2', 'id-1'])
  assert.deepEqual(moveBookmark(moved, 'id-2', -1).map((item) => item.id), ['id-2', 'id-1'])

  const recaptured = updateBookmarkView(moved, 'id-2', view({ height: 320 }), { thumb: 'data:image/jpeg;base64,BBB' })
  assert.equal(recaptured[0].view.height, 320)
  assert.equal(recaptured[0].thumb, 'data:image/jpeg;base64,BBB')

  // Spatial readout formatting
  const meta = formatBookmarkMeta({ lon: 3.0815, lat: 45.7742, height: 412, heading: 45, pitch: -38 })
  assert.equal(meta.alt, '412 m')
  assert.equal(meta.compass, 'NE')
  assert.equal(meta.pitchDeg, -38)
  assert.equal(meta.coords, '45.7742°N, 3.0815°E')
  assert.equal(captureBookmarkThumbnail(null), '')
})

test('flyToBookmark：把视角换算成弧度并调用相机；非法输入返回 false', () => {
  const calls = []
  const viewer = { camera: { flyTo: (options) => calls.push(options) } }
  const Cesium = {
    Cartesian3: { fromDegrees: (lon, lat, height) => ({ lon, lat, height }) },
    Math: { toRadians: (degrees) => (degrees * Math.PI) / 180 },
  }
  assert.equal(flyToBookmark(viewer, Cesium, view(), 0.8), true)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].destination, { lon: 114.3, lat: 30.5, height: 800 })
  assert.equal(calls[0].duration, 0.8)
  assert.equal(calls[0].orientation.roll, 0)
  assert.equal(flyToBookmark(viewer, Cesium, null), false)
  assert.equal(flyToBookmark(null, Cesium, view()), false)
})

test('接线：工具卡有收藏区，ViewerSurface 传入当前视角与飞行回调', () => {
  // Bookmarks are a tool, not a layer: they moved to ui/tools-bookmarks.js during
  // the data/tools split, and the tools card owns the group title.
  const panel = readRepoFile('src/client/ui/tools-bookmarks.js')
  assert.match(panel, /loadBookmarks\(\)/)
  assert.match(panel, /addBookmark\(bookmarks, view, null/)
  assert.match(panel, /saveBookmarks\(result\.list\)/)
  assert.match(panel, /removeBookmark\(bookmarks, id\)/)
  assert.match(panel, /t\('bookmarks\.save'\)/)
  const tools = readRepoFile('src/client/ui/tool-catalog.js')
  assert.match(tools, /'tools\.view'/)
  assert.match(readRepoFile('src/client/ui/tool-windows.js'), /ToolsBookmarks/)

  const client = clientSource()
  assert.match(client, /getCurrentView: \(\) => currentSceneSnapshot\(\)\?\.view \?\? null/)
  assert.match(client, /onFlyView: \(view\) => flyToBookmark\(viewerRef\.current, cesiumRef\.current, view\)/)

  const messages = readRepoFile('src/client/messages.js')
  for (const key of ['bookmarks.title', 'bookmarks.save', 'bookmarks.empty', 'bookmarks.remove', 'bookmarks.noView']) {
    const hits = messages.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []
    assert.ok(hits.length >= 2, `缺少中英 i18n：${key}`)
  }
})

test('全屏：只保留一个入口，不再有“最大化侧栏”', () => {
  const client = clientSource()
  assert.doesNotMatch(client, /togglePaneFullscreen/)
  assert.doesNotMatch(client, /btn\.maximize/)
  assert.ok(readRepoFile('src/client/ui/toolbar-output.js').includes('onToggleFullscreen'))
  assert.ok(readRepoFile('src/client/ui/toolbar-output.js').includes("t('btn.fullscreenExit') : t('btn.fullscreenTitle')"))

})
