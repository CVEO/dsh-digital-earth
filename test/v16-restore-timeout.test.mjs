/**
 * v1.6 fix — reopening the panel must not stay stuck on "正在加载三维引擎".
 *
 * Root cause: init awaited `restoreSceneSnapshot(savedScene)` before `setPhase('ready')`.
 * A saved layer whose folder was no longer served (or a remote tileset whose request
 * never settled) could keep that await pending forever, leaving the loading overlay
 * up even though the globe was already drawn.
 *
 * Contract now: the camera view is restored first (local data), the panel becomes
 * ready before any saved layer loads, and every restored layer load is raced against
 * a timeout so stale data is skipped with a toast instead of blocking the UI.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readRepoFile } from './helpers/source.mjs'

const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
const messages = readRepoFile('src/client/messages.js')

test('恢复：每层加载与本地目录解析都有超时护栏', () => {
  assert.match(viewer, /const RESTORE_LAYER_TIMEOUT_MS = 8000/)
  assert.match(viewer, /const restoreTimedOut = Symbol\('restore-timeout'\)/)
  assert.match(viewer, /const withRestoreTimeout = \(promise, ms = RESTORE_LAYER_TIMEOUT_MS\) =>/)
  assert.match(viewer, /await withRestoreTimeout\(localPathToUrl\(source\.path\), 3000\)/)
  assert.match(viewer, /await withRestoreTimeout\(loadTileset\(url, item\.name, source, \{ fly: false \}\)\)/)
  assert.match(viewer, /if \(layer === restoreTimedOut\)/)
  assert.match(viewer, /if \(url === restoreTimedOut\)/)
})

test('恢复：先应用相机视角，再加载图层（避免迟到回跳）', () => {
  const restore = viewer.slice(
    viewer.indexOf('async function restoreSceneSnapshot(snapshot)'),
    viewer.indexOf('//#endregion scene snapshot'),
  )
  const viewIndex = restore.indexOf('if (snapshot.view !== null)')
  const layerIndex = restore.indexOf('for (const item of snapshot.layers)')
  assert.notEqual(viewIndex, -1, '缺少相机恢复')
  assert.notEqual(layerIndex, -1, '缺少图层恢复')
  assert.ok(viewIndex < layerIndex, '相机必须最先应用，网络图层之后加载')
})

test('恢复：面板先就绪，恢复在后台执行（不再阻塞 loading 覆盖层）', () => {
  const init = viewer.slice(
    viewer.indexOf('const savedScene = typeof sessionId'),
    viewer.indexOf('settleReadyWaiters(error instanceof Error'),
  )
  const readyIndex = init.indexOf("setPhase('ready')")
  const restoreIndex = init.indexOf('void restoreSceneSnapshot(savedScene)')
  assert.notEqual(readyIndex, -1)
  assert.notEqual(restoreIndex, -1)
  assert.ok(readyIndex < restoreIndex, 'setPhase(ready) 必须在后台恢复之前')
  assert.ok(
    init.indexOf('sceneRestoredRef.current =') < readyIndex,
    '必须先标记恢复决策，避免晚到 effect 再恢复一次',
  )
  assert.doesNotMatch(init, /await restoreSceneSnapshot\(savedScene\)/, '不得再阻塞等待恢复')
})

test('恢复：超时只 toast 一次且带中英文案', () => {
  assert.match(viewer, /showToast\(t\('toast\.restoreTimeout'\)\)/)
  for (const lang of ['恢复上次场景时部分图层超时', 'Some layers from the previous scene timed out']) {
    assert.ok(messages.includes(lang), `缺少文案：${lang}`)
  }
  const zh = messages.indexOf("'toast.restoreTimeout'")
  const en = messages.indexOf("'toast.restoreTimeout'", zh + 1)
  assert.notEqual(en, -1, '中英字典都应包含该键')
})
