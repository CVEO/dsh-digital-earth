/**
 * v1.5 core contract tests (SPEC-v1.5 §3/§S5/§S6/§A6).
 *
 * These are STRUCTURAL guards on purpose: they assert that a deleted or replaced
 * mechanism cannot come back (the rAF FPS meter, the tileset_info.json rewrite,
 * the sidebar "fullscreen" misnomer) and that the new contracts exist where the
 * host and the panel meet. Behaviour tests for the same areas live next to the
 * module they exercise once the v1.5 split lands.
 *
 * Source access goes through test/helpers/source.mjs, so this file keeps working
 * while index.js/client.js are still monoliths and after they become barrels.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clientSource, hostSource } from './helpers/source.mjs'

// ---------------------------------------------------------------------------
// S5 / A7 — FPS must be real render throughput
// ---------------------------------------------------------------------------

test('v2 FPS：计数 scene.postRender 真实渲染帧，不再用 requestAnimationFrame 冒充', () => {
  const client = clientSource()
  // The old meter counted window rAF callbacks; that call shape must be gone.
  assert.doesNotMatch(client, /raf = requestAnimationFrame\(tick\)/, 'rAF 计帧必须移除')
  assert.doesNotMatch(client, /const tick = \(now\) => \{\s*\n\s*frames \+= 1/)
  assert.match(client, /scene\.postRender\.addEventListener\(onFrame\)/, '必须计数 Cesium 渲染帧')
  assert.match(client, /scene\.postRender\.removeEventListener\(onFrame\)/, '卸载时必须解绑')
})

test('v2 FPS：静止 ≥2s / 页面隐藏 / 上下文丢失都判为空闲，HUD 显示破折号而不是 0', () => {
  const client = clientSource()
  assert.match(
    client,
    /const idle = lost \|\| document\.visibilityState === 'hidden' \|\| now - lastFrameAt > 2000/,
    '缺少空闲判定',
  )
  assert.match(client, /fps === null \? '—' : fps/, 'HUD 空闲时必须显示 —')
  assert.match(client, /const \[fps, setFps\] = React\.useState\(null\)/, 'fps 初值必须表示“未知/空闲”')
  assert.match(client, /addEventListener\('webglcontextlost', onLost\)/, '上下文丢失必须重置计数')
  assert.match(client, /ema \* 0\.8 \+ instant \* 0\.2/, '帧率需要 EMA 平滑')
})

test('v2 FPS：earth_scene status 暴露 render.fps / idle / terrain_depth_test', () => {
  const client = clientSource()
  assert.match(client, /render: \{\s*\n\s*fps: fps === null \? null : Math\.round\(fps\),/, 'status 缺少 render.fps')
  assert.match(client, /idle: fps === null,/, 'status 缺少 render.idle')
  assert.match(client, /terrain_depth_test: viewer\.scene\.globe\.depthTestAgainstTerrain === true/, 'status 缺少 depth test 状态')
})

// ---------------------------------------------------------------------------
// S6 — display semantics: maximize sidebar vs real fullscreen, depth toggle
// ---------------------------------------------------------------------------

test('v2 显示三态：真全屏走 DOM Fullscreen API，侧栏最大化单独命名', () => {
  const client = clientSource()
  assert.match(client, /const toggleDomFullscreen = \(\) => \{/)
  assert.match(client, /await root\.requestFullscreen\(\{ navigationUI: 'hide' \}\)/)
  assert.match(client, /await document\.exitFullscreen\(\)/)
  assert.match(client, /document\.addEventListener\('fullscreenchange', onChange\)/)
  assert.match(client, /\.mv-root:fullscreen\{position:fixed;inset:0;width:100vw;height:100vh/)
  assert.doesNotMatch(client, /btn\.immersive/, '“全屏查看”误名必须删除')
})

test('v2 深度测试：地形遮挡是 Globe 属性开关，默认关、切地形后重放、不重建 viewer', () => {
  const client = clientSource()
  assert.match(client, /function applyGlobeDepthTest\(\)/)
  assert.match(
    client,
    /viewer\.scene\.globe\.depthTestAgainstTerrain = sourcesRef\.current\?\.settings\?\.terrainDepthTest === true/,
    '默认必须为关（严格等于 true 才开）',
  )
  // Re-applied after a terrain switch and after saving settings, never by rebuilding.
  assert.ok(client.split('applyGlobeDepthTest()').length - 1 >= 3, 'applyGlobeDepthTest 必须在初始化/切地形/保存设置处调用')
  assert.doesNotMatch(client, /new Cesium\.Viewer\([\s\S]{0,400}terrainDepthTest/, '深度测试不得进入 viewer 构造参数')
  assert.match(client, /'settings\.terrainDepthTest'/, '设置项缺少文案')
})

// ---------------------------------------------------------------------------
// S2 / A6 — standard tileset.json only
// ---------------------------------------------------------------------------

test('v2 数据契约：宿主不再读取或改写 tileset_info.json 等厂商 sidecar', () => {
  const host = hostSource()
  for (const removed of [
    'GEOREF_INFO_FILE',
    'serveGeoreferencedTileset',
    'deriveLocalGeoreference',
    'georeferenceTilesetDocument',
    'inspectRootGeoreference',
    'gaussKrugerFrame',
    'gaussKrugerToGeodetic',
    'readTilesetInfoFile',
  ]) {
    assert.doesNotMatch(host, new RegExp(`\\b${removed}\\b`), `兼容层残留：${removed}`)
  }
  // /tiles must be a plain static file server again (no JSON rewrite stage).
  assert.match(host, /await serveFile\(req, res, resolvedDir, relPath/)
})

test('v2 数据契约：inspect 用 tileset_not_georeferenced 错误报告缺失的世界定位', () => {
  const host = hostSource()
  assert.match(host, /'tileset_not_georeferenced'/, '缺少缺失地理参考的诊断码')
  assert.match(host, /const hasTransform = Array\.isArray\(root\.transform\) && root\.transform\.length === 16/)
  assert.match(host, /const hasRegion = isPlainObject\(root\.boundingVolume\) && root\.boundingVolume\.region !== undefined/)
  // It must be an ERROR (report.ok === false), not a silent info line.
  assert.match(host, /state\.issues,\s*\n\s*'error',\s*\n\s*'tileset_not_georeferenced'/)
})

// ---------------------------------------------------------------------------
// S4 — frozen tool surface
// ---------------------------------------------------------------------------

test('v2 工具面冻结：六个工具，earth_scene 十二个 action，分析三种 + clear', () => {
  const host = hostSource()
  for (const name of ['earth_scene', 'earth_capture', 'earth_draw', 'earth_measure', 'earth_analyze', 'earth_shader']) {
    assert.match(host, new RegExp(`'${name}'`), `缺少工具 ${name}`)
  }
  const sceneActions = host.match(/const SCENE_ACTIONS = \{([\s\S]*?)\n\}/)
  assert.ok(sceneActions, '找不到 SCENE_ACTIONS')
  const names = [...sceneActions[1].matchAll(/^\s{2}([a-z]+):/gm)].map((match) => match[1])
  assert.deepEqual(names, [
    'status',
    'list',
    'load',
    'remove',
    'visible',
    'basemap',
    'terrain',
    'fly',
    'reset',
    'pick',
    'inspect',
    'report',
  ])
  const analyzeActions = host.match(/ANALYZE_ACTIONS = \[([^\]]*)\]/)
  assert.ok(analyzeActions, '找不到 ANALYZE_ACTIONS')
  assert.deepEqual(
    analyzeActions[1].split(',').map((item) => item.trim().replaceAll("'", '')).filter(Boolean),
    ['profile', 'flood', 'sunlight', 'clip', 'skyline', 'clear'],
  )
  // D-16 approved clip for 1.6; the rest of the parked analyses stay unreachable
  // until their own release (skyline is next on the v1.6 list).
  for (const parked of ['viewshed', 'los', 'envelope', 'compare', 'tour', 'highlight']) {
    assert.doesNotMatch(host, new RegExp(`(action|ACTIONS)[^\\n]{0,80}'${parked}'`), `已 park 的动作复活：${parked}`)
  }
})
