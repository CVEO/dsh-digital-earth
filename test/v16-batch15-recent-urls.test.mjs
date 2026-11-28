/**
 * v16 batch 15 — remembered online tileset addresses (the Data menu parity item).
 *
 * The list is page-local on purpose: a signed tileset URL must never reach the
 * Host or a tool result, so these tests pin the sanitising, the dedupe/cap and
 * the fact that loading an address records it while local paths do not.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'

register('./helpers/react-stub-loader.mjs', import.meta.url)

import { readRepoFile } from './helpers/source.mjs'
import {
  RECENT_URLS_LIMIT,
  readRecentUrls,
  recentUrlLabel,
  recordRecentTilesetUrl,
  rememberRecentUrl,
  sanitizeRecentUrl,
  writeRecentUrls,
} from '../src/client/ui/recent-urls.js'

// messages/data-menu pull in ui/icons.js (React) — import them after the loader.
const { MESSAGES } = await import('../src/client/messages.js')
const { dataMenuItems } = await import('../src/client/ui/data-menu.js')

function fakeStorage(initial = null) {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next
    },
    raw: () => value,
  }
}

test('only absolute http(s) addresses are remembered', () => {
  assert.equal(sanitizeRecentUrl('  https://example.com/a/tileset.json  '), 'https://example.com/a/tileset.json')
  assert.equal(sanitizeRecentUrl('http://localhost:8080/tileset.json'), 'http://localhost:8080/tileset.json')
  for (const bad of ['ftp://example.com/a.json', 'file:///D:/a.json', 'javascript:alert(1)', '', '   ', null, 42, 'https://example.com/a b.json']) {
    assert.equal(sanitizeRecentUrl(bad), null, `expected null for ${String(bad)}`)
  }
  assert.equal(sanitizeRecentUrl(`https://example.com/${'a'.repeat(2048)}`), null)
})

test('menu labels show the host and the dataset folder, never the query string', () => {
  assert.equal(recentUrlLabel('https://example.com/data/tileset.json'), 'example.com/data')
  assert.equal(recentUrlLabel('https://cdn.example.com/data/city/tileset.json'), 'cdn.example.com/city')
  assert.equal(recentUrlLabel('https://example.com/tileset.json'), 'example.com')
  assert.equal(recentUrlLabel('https://example.com/scene/model.json'), 'example.com/model.json')
  assert.equal(recentUrlLabel('https://example.com/a/tileset.json?token=secret'), 'example.com/a')
  assert.equal(recentUrlLabel('not a url'), '')
  assert.ok(recentUrlLabel(`https://example.com/${'a'.repeat(200)}.json`).length <= 72)
})

test('remembering an address dedupes, moves it to the top and caps the list', () => {
  let list = []
  for (let index = 0; index < RECENT_URLS_LIMIT + 3; index += 1) {
    list = rememberRecentUrl(list, `https://example.com/${index}/tileset.json`, `at-${index}`)
  }
  assert.equal(list.length, RECENT_URLS_LIMIT)
  assert.equal(list[0].url, `https://example.com/${RECENT_URLS_LIMIT + 2}/tileset.json`)
  assert.equal(list[0].at, `at-${RECENT_URLS_LIMIT + 2}`)
  assert.equal(rememberRecentUrl(list, 'ftp://example.com/x').length, RECENT_URLS_LIMIT)
  const moved = rememberRecentUrl(list, list[list.length - 1].url, 'newest')
  assert.equal(moved[0].url, list[list.length - 1].url)
  assert.equal(moved[0].at, 'newest')
  assert.equal(moved.length, RECENT_URLS_LIMIT)
})

test('reading tolerates missing, empty and corrupt storage and sanitises entries', () => {
  assert.deepEqual(readRecentUrls(fakeStorage(null)), [])
  assert.deepEqual(readRecentUrls(fakeStorage('')), [])
  assert.deepEqual(readRecentUrls(fakeStorage('{oops')), [])
  assert.deepEqual(readRecentUrls(fakeStorage('{"url":"https://example.com/a"}')), [])
  const storage = fakeStorage(
    JSON.stringify([
      { url: 'https://example.com/a/tileset.json', at: 't1' },
      { url: 'ftp://example.com/b', at: 't2' },
      { url: 'https://example.com/a/tileset.json', at: 't3' },
      'https://example.com/c/tileset.json',
    ]),
  )
  assert.deepEqual(readRecentUrls(storage), [
    { url: 'https://example.com/a/tileset.json', at: 't1' },
    { url: 'https://example.com/c/tileset.json', at: '' },
  ])
  const throwing = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {},
  }
  assert.deepEqual(readRecentUrls(throwing), [])
})

test('writing stores the sanitised list and never throws on a dead store', () => {
  const storage = fakeStorage(null)
  assert.equal(writeRecentUrls([{ url: 'https://example.com/a/tileset.json', at: 't1' }, { url: 'bad' }], storage), true)
  assert.deepEqual(JSON.parse(storage.raw()), [{ url: 'https://example.com/a/tileset.json', at: 't1' }])
  const throwing = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota')
    },
  }
  assert.equal(writeRecentUrls([], throwing), false)
  // An explicit null storage means "nowhere to write", not "use the global one".
  assert.equal(writeRecentUrls([{ url: 'https://example.com/a' }], null), false)
  assert.equal(writeRecentUrls([{ url: 'https://example.com/a' }]), false)
})

test('loaded remote sources persist and snapshot recovery preserves recent-use order', () => {
  const storage = fakeStorage()
  const city = { kind: 'remote', url: 'https://example.com/city/tileset.json?key=foo' }
  const hills = { kind: 'remote', url: 'https://example.com/hills/tileset.json' }
  const older = { kind: 'remote', url: 'https://example.com/older/tileset.json' }
  recordRecentTilesetUrl([], city, { storage })
  recordRecentTilesetUrl([], hills, { storage })
  recordRecentTilesetUrl([], city, { restored: true, storage })
  recordRecentTilesetUrl([], older, { restored: true, storage })
  assert.deepEqual(readRecentUrls(storage).map(({ url }) => url), [hills.url, city.url, older.url])
  recordRecentTilesetUrl([], city, { storage })
  recordRecentTilesetUrl([], { kind: 'local', url: 'http://localhost/files/tileset.json' }, { storage })
  assert.deepEqual(readRecentUrls(storage).map(({ url }) => url), [city.url, hills.url, older.url])
})

test('the Data menu shows address actions and history before recent folders and closes before acting', () => {
  const h = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() })
  const MenuItem = 'MenuItem'
  const calls = []
  const items = dataMenuItems({
    h,
    MenuItem,
    t: (key) => key,
    recentDirs: [{ dir: 'D:/data/city', name: 'city' }],
    recentUrls: [{ url: 'https://example.com/data/tileset.json', at: 't1' }],
    agentOverlayCount: 1,
    closeMenu: () => calls.push('close'),
    onOpenLocal: () => calls.push('local'),
    onOpenRecentDirectory: (dir) => calls.push(`dir:${dir}`),
    onOpenRecentUrl: (url) => calls.push(`url:${url}`),
    onClearAgent: () => calls.push('clearAgent'),
    onToggleUrlBar: () => calls.push('urlbar'),


  })
  // v1.8：菜单按 添加 / 最近 / 管理 分组，组标签是本地化 key。
  const groupLabels = items.filter((item) => item.type === 'span').map((item) => item.children[0])
  assert.deepEqual(groupLabels, ['menu.recent', 'menu.manage'])
  // “加载地址…”是显式动作，必须排在“最近”分组之前，历史只做快捷方式。
  const openUrlIndex = items.findIndex((item) => item.children?.[0] === 'menu.loadAddress')
  const recentLabelIndex = items.findIndex((item) => item.type === 'span' && item.children?.[0] === 'menu.recent')
  assert.ok(openUrlIndex >= 0 && openUrlIndex < recentLabelIndex)
  const urlItem = items.find((item) => item.props.title === 'https://example.com/data/tileset.json')
  assert.ok(urlItem, 'the address row keeps the full URL as its tooltip')
  assert.equal(urlItem.children[0].children[0], 'example.com/data')
  urlItem.props.onClick()
  assert.deepEqual(calls, ['close', 'url:https://example.com/data/tileset.json'])
  // 最近目录排在最近地址之后，且同为历史项。
  const dirItem = items.find((item) => item.props.title === 'D:/data/city')
  assert.ok(dirItem, 'recent folders keep their own history row')
  assert.ok(items.indexOf(dirItem) > items.indexOf(urlItem))
  // B1 数据菜单瘦身：场景报告移到「输出」，数据菜单只管数据。
  assert.ok(!items.some((item) => item.children?.[0] === 'menu.report'))
  assert.ok(!items.some((item) => item.children?.[0] === 'tool.clear'))
  const clear = items.find((item) => item.children?.[0] === 'menu.clearAgent')
  clear.props.onClick()
  assert.deepEqual(calls.slice(-2), ['close', 'clearAgent'])
  assert.ok(items.some((item) => item.type === 'i'), 'the separator survives the extraction')
})

test('ViewerSurface remembers only remotely loaded addresses and the data menu shows the recent group label', () => {
  const surface = readRepoFile('src/client/viewer/ViewerSurface.js')
  // 菜单条目由 TopBar 组装，但最近地址状态与飞行仍在 ViewerSurface 里。
  assert.match(surface, /onOpenRecentUrl: openRecentUrl/)
  assert.match(surface, /React\.useState\(\(\) => readRecentUrls\(\)\)/)
  assert.match(surface, /layersRef\.current\.push\(layer\)[\s\S]*?recordRecentTilesetUrl\(previousUrls, source, \{ restored: options\.fly === false \}\)/)
  assert.match(surface, /function openRecentUrl\(url\)/)
  assert.match(surface, /void addTileset\(url, recentUrlLabel\(url\), \{ kind: 'remote', url \}\)/)
  assert.match(readRepoFile('src/client/ui/topbar.js'), /dataMenuItems\(/)
  const menuModule = readRepoFile('src/client/ui/data-menu.js')
  assert.match(menuModule, /t\('menu\.recent'\)/)
  assert.match(menuModule, /recentUrlLabel\(entry\.url\)/)
  for (const locale of ['zh', 'en']) {
    assert.equal(typeof MESSAGES[locale]['menu.recent'], 'string')
    assert.notEqual(MESSAGES[locale]['menu.recent'], '')
  }
})
