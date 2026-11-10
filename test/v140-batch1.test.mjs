/**
 * v1.4.0 批次 B1 的 QA 套件（task-12）。
 *
 * 只读源码，不改实现：
 *   - resolveLocalTileset：文件/目录/缺失自愈/多候选/根与 UNC/白名单与越界链接；
 *   - normalizeConfig：旧配置缺省 showLayers/showHud=true、显式 false 保持、往返；
 *   - 系统提示词预算：≤1600 字符、四旧工具名仍在、不再写“Data → Open local
 *     folder / 手动打开目录 / 必须先 status”等旧话术；
 *   - 模型可见 action 不含内部 authorize（安全边界）；
 *   - client.js 静态接线：authorize/PathAccessDialog、showLayers/showHud、HUD 采样、
 *     docked 全屏图标与窄宽布局；
 *   - package.json 未引入依赖、测试入口存在。
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  isLocalResolutionAllowed,
  normalizeConfig,
  resolveLocalTileset,
  SYSTEM_PROMPT_SECTION,
} from '../index.js'
import { clientSource, hostSource } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readText = (name) => readFile(join(root, name), 'utf8').then((text) => text.replace(/\r\n/g, '\n'))
// Authored client source (src/client/**), not the generated client.js artifact.
const client = clientSource()
const [packageText, sceneSource, bridgeSource] = await Promise.all([
  readText('package.json'),
  readText('src/host/tools/scene.js'),
  readText('src/host/bridge.js'),
])
const host = hostSource()

const temporary = []
after(async () => {
  // Junction/symlink 只删链接本身，目标目录也在列表里，顺序无关。
  for (const directory of temporary) await rm(directory, { recursive: true, force: true }).catch(() => {})
})

async function makeTemp(label) {
  const directory = await mkdtemp(join(tmpdir(), `dsh-b1-qa-${label}-`))
  temporary.push(directory)
  return directory
}

const writeTileset = async (directory, name = 'tileset.json') => {
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, name), '{}')
}

/** 取源码片段：从 start 到其后的 end（含 end），找不到即断言失败。 */
function block(source, start, end) {
  const from = source.indexOf(start)
  assert.ok(from >= 0, `源码中找不到片段起点：${start}`)
  const to = source.indexOf(end, from + start.length)
  assert.ok(to > from, `源码中找不到片段终点：${end}`)
  return source.slice(from, to + end.length)
}

/** 断言 reject 且 LocalPathError 的稳定 code 与文案片段一致。 */
async function rejectsWithCode(promise, code, pattern) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `期望错误码 ${code}，实际为 ${error.code}：${error.message}`)
    if (pattern) assert.match(error.message, pattern)
    assert.match(error.message, /^\[[a-z_]+\]/)
    return true
  })
}

// ---------------------------------------------------------------------------
// resolveLocalTileset
// ---------------------------------------------------------------------------

test('resolveLocalTileset：存在的文件直接用 realpath 返回 kind=file', async () => {
  const fixture = await makeTemp('file')
  const file = join(fixture, 'tileset.json')
  await writeTileset(fixture)

  const resolution = await resolveLocalTileset(file)
  assert.equal(resolution.kind, 'file')
  assert.equal(resolution.requested, resolve(file))
  assert.equal(resolution.path, await realpath(file))
  assert.equal(resolution.directory, dirname(await realpath(file)))
  // 直接文件不标记 resolvedFrom，即使 realpath 改变了大小写。
  assert.equal(resolution.resolvedFrom, undefined)

  // 聊天复制带引号/换行时先规范化，不要求模型自己清理。
  const quoted = await resolveLocalTileset(`\n"${file}"\n`)
  assert.equal(quoted.path, resolution.path)
})

test('resolveLocalTileset：目录下唯一 tileset.json 返回 kind=directory 与 resolvedFrom', async () => {
  const fixture = await makeTemp('directory')
  await writeTileset(join(fixture, 'deep'))

  const resolution = await resolveLocalTileset(fixture)
  assert.equal(resolution.kind, 'directory')
  assert.equal(resolution.requested, resolve(fixture))
  assert.equal(resolution.path, await realpath(join(fixture, 'deep', 'tileset.json')))
  assert.equal(resolution.directory, dirname(resolution.path))
  assert.equal(resolution.resolvedFrom, resolve(fixture))
})

test('resolveLocalTileset：缺失路径在最近存在的祖先下自愈为 kind=missing', async () => {
  const fixture = await makeTemp('heal')
  await writeTileset(join(fixture, 'real'))

  const requested = join(fixture, 'renamed', 'tileset.json')
  const resolution = await resolveLocalTileset(requested)
  assert.equal(resolution.kind, 'missing')
  assert.equal(resolution.requested, resolve(requested))
  assert.equal(resolution.resolvedFrom, resolve(requested))
  assert.equal(resolution.path, await realpath(join(fixture, 'real', 'tileset.json')))
})

test('resolveLocalTileset：多候选返回 ambiguous_local_path，最多列 10 条', async () => {
  const fixture = await makeTemp('ambiguous')
  for (let index = 1; index <= 12; index += 1) {
    await writeTileset(join(fixture, `d${String(index).padStart(2, '0')}`))
  }

  await rejectsWithCode(
    resolveLocalTileset(join(fixture, 'typo', 'tileset.json')),
    'ambiguous_local_path',
    /found 12 tileset\.json files/,
  )
  const error = await resolveLocalTileset(join(fixture, 'typo', 'tileset.json')).catch((reason) => reason)
  assert.match(error.message, /d10\/tileset\.json/)
  // 超过 10 条只显示计数，不把整棵树倒给模型。
  assert.doesNotMatch(error.message, /d11\/tileset\.json/)
  assert.match(error.message, /and 2 more/)
  assert.match(error.message, /next: call again with the exact path/)
})

test('resolveLocalTileset：无候选与搜索上限 200 项的稳定错误码', async () => {
  const empty = await makeTemp('empty')
  await rejectsWithCode(resolveLocalTileset(empty), 'no_tileset_found', /no tileset\.json was found below/)

  // 201 个目录项：第 201 个 tileset.json 不会被读到，文案必须说明搜索被截断。
  const bounded = await makeTemp('bounded')
  for (let index = 0; index < 200; index += 1) {
    await writeFile(join(bounded, `f${String(index).padStart(3, '0')}.txt`), '')
  }
  await writeFile(join(bounded, 'tileset.json'), '{}')
  await rejectsWithCode(resolveLocalTileset(bounded), 'no_tileset_found', /stopped at 200 entries/)
})

test('resolveLocalTileset：不存在且没有近祖先时快速 path_not_found', async () => {
  const fixture = await makeTemp('gone')
  await rejectsWithCode(
    resolveLocalTileset(join(fixture, 'ghost1', 'ghost2', 'tileset.json')),
    'path_not_found',
    /within 2 levels/,
  )
})

test('resolveLocalTileset：空/相对/文件系统根/UNC 一律 invalid_local_path', async () => {
  await rejectsWithCode(resolveLocalTileset(''), 'invalid_local_path', /empty/)
  await rejectsWithCode(resolveLocalTileset('   '), 'invalid_local_path', /empty/)
  await rejectsWithCode(resolveLocalTileset(123), 'invalid_local_path', /empty/)
  await rejectsWithCode(resolveLocalTileset('tiles/tileset.json'), 'invalid_local_path', /not an absolute path/)

  const filesystemRoot = parse(resolve(process.cwd())).root
  await rejectsWithCode(resolveLocalTileset(filesystemRoot), 'invalid_local_path', /root/)

  const unc = process.platform === 'win32'
    ? '\\\\server\\share\\tileset.json'
    : '\\\\server\\share\\tileset.json'
  await rejectsWithCode(resolveLocalTileset(unc), 'invalid_local_path', /UNC|not an absolute path/)
})

test('resolveLocalTileset：allowedDirs 之外返回 access_denied，之内放行', async () => {
  const fixture = await makeTemp('allow')
  await writeTileset(join(fixture, 'allowed'))
  await writeTileset(join(fixture, 'outside'))

  const allowedDir = await realpath(join(fixture, 'allowed'))
  const allowedFile = join(allowedDir, 'tileset.json')
  const outsideFile = join(await realpath(join(fixture, 'outside')), 'tileset.json')

  const resolution = await resolveLocalTileset(allowedFile, new Set([allowedDir]))
  assert.equal(resolution.path, await realpath(allowedFile))
  // 数组形式同样可用（inspect 的调用方就是这么传的）。
  assert.equal((await resolveLocalTileset(allowedFile, [allowedDir])).path, resolution.path)

  await rejectsWithCode(
    resolveLocalTileset(outsideFile, new Set([allowedDir])),
    'access_denied',
    /has not been opened in the Digital Earth panel/,
  )

  // 白名单是目录边界而不是字符串前缀：allowed-sibling 不算 inside。
  assert.equal(isLocalResolutionAllowed({ path: join(allowedDir, 'a', 'tileset.json') }, new Set([allowedDir])), true)
  assert.equal(isLocalResolutionAllowed({ path: `${allowedDir}-sibling/tileset.json` }, new Set([allowedDir])), false)
  assert.equal(isLocalResolutionAllowed(null, new Set([allowedDir])), false)
})

test('resolveLocalTileset：BFS 不跟随符号链接/junction 越界，显式越界被白名单拒绝', async (t) => {
  const fixture = await makeTemp('link')
  const outside = await makeTemp('outside')
  await writeTileset(join(fixture, 'inside'))
  await writeTileset(join(outside, 'evil'))

  try {
    await symlink(outside, join(fixture, 'escape'), 'junction')
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error.code)) {
      t.skip(`当前环境不允许创建 junction/symlink：${error.code}`)
      return
    }
    throw error
  }

  // 目录 BFS 只认真正的目录：junction 指向的越界 tileset 不会被收集。
  const resolution = await resolveLocalTileset(fixture)
  assert.equal(resolution.kind, 'directory')
  assert.equal(resolution.path, await realpath(join(fixture, 'inside', 'tileset.json')))

  // 显式把 junction 当目录请求时，realpath 会落到真实越界目标；带白名单即拒绝。
  const escaped = await resolveLocalTileset(join(fixture, 'escape'))
  assert.equal(escaped.path, await realpath(join(outside, 'evil', 'tileset.json')))
  assert.equal(isLocalResolutionAllowed(escaped, new Set([await realpath(fixture)])), false)
  await rejectsWithCode(
    resolveLocalTileset(join(fixture, 'escape'), new Set([await realpath(fixture)])),
    'access_denied',
    /has not been opened/,
  )
})

// ---------------------------------------------------------------------------
// normalizeConfig
// ---------------------------------------------------------------------------

test('normalizeConfig：旧配置缺省 showLayers/showHud=true，显式 false 保持并往返', () => {
  const legacy = normalizeConfig({ settings: { theme: 'dark' } })
  assert.equal(legacy.settings.showLayers, true)
  assert.equal(legacy.settings.showHud, true)
  assert.equal(legacy.settings.theme, 'dark')
  assert.equal(legacy.settings.screenshotHud, false)
  assert.ok(legacy.imagery.length > 0)
  assert.ok(legacy.terrain.length > 0)

  const hidden = normalizeConfig({ settings: { showLayers: false, showHud: false } })
  assert.equal(hidden.settings.showLayers, false)
  assert.equal(hidden.settings.showHud, false)

  const explicit = normalizeConfig({ settings: { showLayers: true, showHud: true } })
  assert.equal(explicit.settings.showLayers, true)
  assert.equal(explicit.settings.showHud, true)

  // 往返：持久化后再读一次，设置不能漂移。
  const roundtrip = normalizeConfig(hidden)
  assert.deepEqual(roundtrip.settings, hidden.settings)

  // 非对象输入（旧文件损坏/首次运行）回落到默认可见。
  for (const raw of [null, undefined, 'broken', 42]) {
    assert.equal(normalizeConfig(raw).settings.showLayers, true)
    assert.equal(normalizeConfig(raw).settings.showHud, true)
  }
})

// ---------------------------------------------------------------------------
// 系统提示词与模型可见 action
// ---------------------------------------------------------------------------

test('提示词预算：SYSTEM_PROMPT_SECTION ≤1600 字符且四工具名仍在', () => {
  assert.ok(SYSTEM_PROMPT_SECTION.length <= 1600, `提示词段超预算：${SYSTEM_PROMPT_SECTION.length} 字符`)
  assert.ok(SYSTEM_PROMPT_SECTION.length >= 400, '提示词段过短，可能丢了关键信息')
  for (const name of ['earth_scene', 'earth_capture', 'earth_draw', 'earth_measure']) {
    assert.match(SYSTEM_PROMPT_SECTION, new RegExp(name))
  }
  // 面板自动打开只说明一次，避免重复 attach 话术。
  assert.equal((SYSTEM_PROMPT_SECTION.match(/opens automatically/g) ?? []).length, 1)
})

test('提示词不再包含 Data 菜单/手动开目录/强制先 status 的旧话术', () => {
  assert.doesNotMatch(SYSTEM_PROMPT_SECTION, /Data\s*(?:→|->|>)/i)
  assert.doesNotMatch(SYSTEM_PROMPT_SECTION, /Open local folder/i)
  assert.doesNotMatch(SYSTEM_PROMPT_SECTION, /手动打开目录/)
  assert.doesNotMatch(SYSTEM_PROMPT_SECTION, /必须先/)
  assert.doesNotMatch(
    SYSTEM_PROMPT_SECTION,
    /(?:must|always|first)\s+(?:call|run)\s+earth_scene\s+status/i,
  )
  // 新语义：路径直达 + 面板一次授权、status 只在需要时调用、错误带 [code] 且不重试。
  assert.match(SYSTEM_PROMPT_SECTION, /pass the absolute path directly to earth_scene load\/inspect/)
  assert.match(SYSTEM_PROMPT_SECTION, /one confirmation dialog/)
  assert.match(SYSTEM_PROMPT_SECTION, /status only when you need the current camera/)
  assert.match(SYSTEM_PROMPT_SECTION, /\[code\]/)
  assert.match(SYSTEM_PROMPT_SECTION, /never retry access_denied or access_timeout/)
})

test('模型可见 SCENE_ACTIONS 不含内部 authorize，authorize 只走桥内部命令', () => {
  const actions = block(sceneSource, 'const SCENE_ACTIONS = {', '\n}')
  assert.doesNotMatch(actions, /authorize/)
  for (const action of ['status', 'list', 'load', 'remove', 'visible', 'basemap', 'terrain', 'fly', 'reset', 'pick', 'inspect']) {
    assert.match(actions, new RegExp(`\\b${action}:`))
  }
  assert.match(sceneSource, /const SCENE_ACTION_NAMES = Object\.keys\(SCENE_ACTIONS\)/)
  // 内部授权命令由 createBridge 派发；它不是 SCENE_PARAMETERS 的 action 枚举来源。
  assert.match(bridgeSource, /dispatch\(sessionId, 'authorize', authorizeArgs\(action, resolution\), authorizeTimeoutMs, signal\)/)
})

// ---------------------------------------------------------------------------
// client.js 静态接线
// ---------------------------------------------------------------------------

test('client 授权接线：authorize 内部命令、PathAccessDialog、先 /scan 再 ack、拒绝不重试', () => {
  assert.match(client, /action === 'authorize'/)
  assert.match(client, /function PathAccessDialog\(\{ request, busy, t, onAllow, onDeny \}\)/)
  assert.match(client, /const normalizeAccessRequest = \(args = \{\}\) =>/)
  assert.match(client, /const askPathAccess = \(request\) =>/)
  assert.match(client, /const settleAccess = \(outcome\) =>/)
  assert.match(client, /const allowPathAccess = async \(\) =>/)
  // 允许必须先把目录交给 /scan（token + x-dsh-panel 头 + 同源），成功后才 ack。
  assert.match(client, /await scanLocalDirectory\(metaRef\.current, request\.directory\)/)
  assert.match(client, /settleAccess\(\{ allowed: true, directory: request\.directory \}\)/)
  assert.match(client, /headers: \{ 'x-dsh-panel': '1' \}/)
  assert.match(client, /credentials: 'same-origin'/)
  // 拒绝/超时以 access_denied 收尾，且分支内只有一次 askPathAccess（不重试）。
  const branch = block(
    client,
    "if (action === 'authorize') {",
    "if (action === 'status') return collectSceneStatus()",
  )
  assert.match(branch, /throw new Error\(`access_denied: \$\{decision\.message \|\| t\('access\.denied'\)\}`\)/)
  assert.match(branch, /const decision = await askPathAccess\(request\)/)
  assert.equal((branch.match(/askPathAccess\(/g) ?? []).length, 1)
  assert.doesNotMatch(branch, /for\s*\(|while\s*\(/)
  assert.match(client, /ACCESS_TIMEOUT_MS = 28000/)
  // 授权只需要 DOM，不需要等 Cesium 就绪（否则会吃掉 Host 的 30 s 期限）。
  assert.match(client, /if \(payload\.action !== 'authorize'\) await waitForPanelReady\(\)/)
})

test('client showLayers/showHud：默认可见、工具栏切换、收起、设置持久化', () => {
  assert.match(client, /const showLayers = sources\?\.settings\?\.showLayers !== false/)
  assert.match(client, /const showHud = sources\?\.settings\?\.showHud !== false/)
  // 图层面板（v1.6 起是唯一入口）：默认可见、标题栏可收起；即使没有加载
  // 3D Tiles 也能打开，因为地形/底图的选择只能从面板里做。
  assert.match(client, /analysis \|\| showLayers/)
  assert.match(client, /onCollapse: \(\) => updateSettings\(\{ showLayers: false \}\)/)
  assert.match(client, /t\('layers\.collapse'\)/)
  // 工具栏两个图标按钮写回设置。
  assert.match(client, /updateSettings\(\{ showLayers: !showLayers \}\)/)
  assert.match(client, /updateSettings\(\{ showHud: !showHud \}\)/)
  assert.match(client, /showHud \? t\('btn\.hudHide'\) : t\('btn\.hudShow'\)/)
  // 隐藏 HUD 时不渲染组件（timer 随卸载清理）。
  assert.match(client, /stats && showHud/)
  // 设置对话框与 sources 持久化往返。
  assert.match(client, /draft\.settings\.showLayers !== false/)
  assert.match(client, /draft\.settings\.showHud !== false/)
  assert.match(client, /settings: \{ \.\.\.current\.settings, showLayers: event\.target\.checked \}/)
  assert.match(client, /settings: \{ \.\.\.current\.settings, showHud: event\.target\.checked \}/)
  const update = block(client, 'const updateSettings = (patch, notify) => {', '\n      }')
  assert.match(update, /commitSources\(\{ \.\.\.current, settings: \{ \.\.\.current\.settings, \.\.\.patch \} \}, notify\)/)
})

test('client HUD 采样：拖动不采样、停手一次 depth read、周期不 scene.pick、卸载清理', () => {
  assert.match(client, /const PICK_POSITION_MAX_CAMERA_HEIGHT = 100000/)
  assert.match(client, /const HUD_SAMPLE_INTERVAL_MS = 180/)
  assert.match(client, /const HUD_SETTLE_MS = 180/)

  const sample = block(client, 'function sampleCursor(', 'const formatCursor =')
  assert.doesNotMatch(sample, /scene\.pick\(/)
  assert.match(
    sample,
    /options\.pickPosition === true && scene\.pickPositionSupported && cameraHeight < PICK_POSITION_MAX_CAMERA_HEIGHT/,
  )
  assert.match(sample, /scene\.pickPosition\(position\)/)

  const hud = block(
    client,
    'const pointer = { x: 0, y: 0, inside: false, dirty: false, dragging: false }',
    '}, [])',
  )
  // 停手后的唯一一次采样允许 depth readback；拖动期间连 settle 都跳过。
  assert.match(hud, /if \(pointer\.dragging\) return/)
  assert.match(hud, /sampleInto\(true\)/)
  // 周期路径只做无 depth 采样，且拖动/无变化时直接返回。
  assert.match(hud, /if \(pointer\.dragging \|\| !pointer\.dirty\) return/)
  assert.match(hud, /sampleInto\(false\)/)
  assert.match(hud, /if \(!pointer\.dragging\) armSettle\(\)/)
  assert.match(hud, /window\.addEventListener\('pointerup'/)
  assert.match(hud, /window\.addEventListener\('pointercancel'/)
  assert.match(hud, /clearTimeout\(settleTimer\)/)
  assert.match(hud, /clearInterval\(timer\)/)
  assert.match(hud, /readoutRef\.current = null/)

  // HUD 不再使用 scene.pick()；两处合法用法是 earth_scene pick 与 v1.7 指认卡片。
  assert.equal((client.match(/scene\.pick\(/g) ?? []).length, 4)
  assert.match(client, /const picked = viewer\.scene\.pick\(position\)/)
  assert.match(client, /const classified = classifyPick\(viewer\.scene\.pick\(position\), Cesium\)/)
  // 截图是“已停稳”的显式读取：显式要求 pickPosition。
  assert.match(client, /sampleCursor\(viewer, Cesium, center, \{ pickPosition: true \}\)/)
})

test('client 显示：停靠 / 真全屏（DOM Fullscreen API），不再重复“最大化侧栏”', () => {
  assert.match(client, /const FullscreenIcon = \(\{ size = 15 \}\) =>/)
  assert.match(client, /M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5/)
  assert.match(client, /const iconButton = \(icon, title, onClick, active\)/)
  assert.match(client, /className: `mv-btn icon\$\{active \? ' on' : ''\}`/)
  assert.match(client, /'aria-label': title/)
  assert.match(client, /'aria-pressed': active === undefined \? undefined : active/)
  // v1.6：全屏只有一个入口；dock 不再有“最大化侧栏”（DSH 自带侧栏布局）。
  assert.doesNotMatch(client, /togglePaneFullscreen/)
  assert.doesNotMatch(client, /btn\.maximize/)
  assert.match(client, /docked \? null : button\(t\('btn\.beside'\), openBeside\)/)
  assert.match(client, /iconButton\(h\(FullscreenIcon\), fullscreen \? t\('btn\.fullscreenExit'\) : t\('btn\.fullscreenTitle'\), toggleDomFullscreen, fullscreen\)/)
  // 真全屏：面板根节点调用 DOM Fullscreen API，并在 fullscreenchange 里同步状态。
  assert.match(client, /const toggleDomFullscreen = \(\) => \{/)
  assert.match(client, /root\.requestFullscreen\(\{ navigationUI: 'hide' \}\)/)
  assert.match(client, /document\.exitFullscreen\(\)/)
  assert.match(client, /addEventListener\('fullscreenchange'/)
  assert.match(client, /\.mv-root:fullscreen\{position:fixed;inset:0;width:100vw;height:100vh/)
  assert.doesNotMatch(client, /btn\.immersive/)
  assert.match(client, /\.mv-btn:focus-visible\{outline:2px solid var\(--mv-accent\);outline-offset:1px\}/)
})

test('client 窄宽 dock：420px 容器查询收起分隔符并收窄图层卡', () => {
  assert.match(client, /@container \(max-width: 420px\)\{/)
  const query = block(client, '@container (max-width: 420px){', '\n}')
  assert.match(query, /\.mv-root\.mv-docked \.mv-actions \.mv-sep\{display:none\}/)
  assert.match(query, /\.mv-root\.mv-docked \.mv-actions \.mv-btn\{padding:6px 7px\}/)
  assert.match(query, /\.mv-root\.mv-docked \.mv-layers\{top:92px;right:12px;width:min\(284px,calc\(100% - 24px\)\)\}/)
})

// ---------------------------------------------------------------------------
// 依赖与脚本
// ---------------------------------------------------------------------------

test('QA 不引入运行时依赖：dependencies 必须为空，devDependencies 只允许构建期 esbuild', () => {
  const pkg = JSON.parse(packageText)
  assert.equal(pkg.dependencies, undefined)
  // v1.5：client.js 由 src/client 构建为单一产物，esbuild 是唯一的构建期依赖。
  assert.deepEqual(Object.keys(pkg.devDependencies ?? {}), ['esbuild'])
  assert.equal(pkg.scripts.test, 'node --test')
  assert.match(pkg.scripts.check, /node --check index\.js/)
  assert.match(pkg.scripts.check, /node --check client\.js/)
  assert.match(pkg.scripts.check, /node --test/)
})
