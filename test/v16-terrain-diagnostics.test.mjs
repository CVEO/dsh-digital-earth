/**
 * Terrain failure UX: a blocked terrain host must not toast on every panel open,
 * and the layer panel must show what happened with a retry.
 *
 * Root cause observed on the user's machine: https://elevation3d.arcgis.com/...
 * times out, so Cesium reports "Request has failed" and the provider is replaced by
 * the ellipsoid. That is a network problem, not a plugin bug — the plugin now keeps
 * it visible inline instead of spamming toasts.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readRepoFile } from './helpers/source.mjs'

const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
const panel = readRepoFile('src/client/ui/layers-panel.js')
const layers3d = readRepoFile('src/client/ui/layers-3d.js')
const messages = readRepoFile('src/client/messages.js')

test('地形失败：自动恢复只在面板内提示，显式切换才 toast', () => {
  assert.match(viewer, /const \[terrainError, setTerrainError\] = React\.useState\(''\)/)
  assert.match(viewer, /const network = \/Request has failed\|Failed to fetch\|NetworkError\|timed out\|timeout\|超时\|网络\/i\.test\(text\)/)
  assert.match(viewer, /const hint = t\(network \? 'terrain\.networkHint' : 'terrain\.failedHint', \{ message: text \}\)/)
  assert.match(viewer, /setTerrainError\(hint\)/)
  assert.match(viewer, /if \(notify\) showToast\(t\(network \? 'toast\.terrainNetwork' : 'toast\.terrainFailed'/)
  // 成功与关闭地形都清空提示。
  assert.match(viewer, /setTerrainError\(''\)/)
})

test('地形失败：面板 L1 下方显示原因 + 重试按钮', () => {
  assert.match(panel, /terrainError,/)
  assert.match(panel, /onRetryTerrain,/)
  // The visible error row lives in the 3D data tab (terrain is 3D data, not a tool).
  assert.match(layers3d, /key: 'terrain-error', className: 'mv-none mv-terrain-error'/)
  assert.match(layers3d, /t\('terrain\.retry'\)/)
  assert.match(viewer, /onRetryTerrain: \(\) => applyTerrain\(sourcesRef\.current\?\.settings\?\.terrain \?\? null, true\)/)
})

test('地形请求仍有 8s 超时护栏，中英文案齐全', () => {
  assert.match(viewer, /await withNetworkTimeout\(terrainProvider\(Cesium, source\)\)/)
  for (const key of ["'terrain.networkHint'", "'terrain.failedHint'", "'terrain.retry'", "'toast.terrainNetwork'"]) {
    const hits = messages.match(new RegExp(key.replaceAll('.', '\\.'), 'g')) ?? []
    assert.ok(hits.length >= 2, `缺少中英文案：${key}`)
  }
})
