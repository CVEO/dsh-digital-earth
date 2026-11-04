/**
 * Client 侧 Agent 桥的结构性自检。
 *
 * `client.js` 是给浏览器 `__ModuleLoader__` 用的模块，不能在 Node 里直接 import，
 * 所以这里只做源码结构断言：桥接关键路径（EventSource / 回执 / 9 个 action /
 * 截图 / 关于页 / 双语键集合）是否真的存在。断言尽量对准「契约里必须出现的东西」，
 * 不对实现细节（行号、变量名）做脆弱的匹配。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = await readFile(join(root, 'client.js'), 'utf8')

/** 断言源码里存在某个模式；失败时只输出短标签，避免刷屏整份源码。 */
const has = (pattern, label) => assert.ok(pattern.test(source), `client.js 缺少：${label}`)

/** 从 MESSAGES 的某个语言块里取出所有 `'key':`。 */
const keysIn = (body) => [...body.matchAll(/^\s{8}'([^']+)':/gm)].map((match) => match[1])

const zhStart = source.indexOf('      zh: {')
const enStart = source.indexOf('      en: {')
const localeEnd = source.indexOf('const localeId')

test('客户端入口走 DSH 模块加载器', () => {
  has(/__ModuleLoader__\.load\(/, '模块加载器入口')
})

test('SSE 桥使用 meta 里的 eventsUrl / resultUrl / token', () => {
  has(/new EventSource\(/, 'EventSource 连接')
  has(/eventsUrl/, 'eventsUrl')
  has(/resultUrl/, 'resultUrl')
  has(/encodeURIComponent\(meta\.token\)/, 'token 查询参数')
  // 命令事件与握手事件
  has(/addEventListener\('command'/, 'command 事件')
  has(/addEventListener\('hello'/, 'hello 事件')
  // 卸载时关闭连接，不手写重连循环
  has(/source\?\.close\(\)/, '卸载关闭 EventSource')
  assert.doesNotMatch(source, /setInterval\([^)]*eventSource/i)
})

test('回执 POST 到 resultUrl 并带上 id/ok/data 或错误码', () => {
  has(/method: 'POST'/, 'POST 回执')
  has(/credentials: 'same-origin'/, '同源回执')
  has(/JSON\.stringify\(\{ id, \.\.\.payload \}\)/, '回执 body 形状')
  has(/ok: false, code: 'bad_args'/, 'bad_args 回执')
  has(/code: 'capture_failed'/, 'capture_failed 回执')
  has(/code: 'load_failed'/, 'load_failed 回执')
  has(/code: 'not_found'/, 'not_found 回执')
})

test('命令串行执行且同一 id 只执行一次（上限 64）', () => {
  has(/chain = chain\s*\.then\(/, '串行 Promise 链')
  has(/seen\.has\(id\)/, '重复 id 去重')
  has(/seenOrder\.length > 64/, '去重上限 64')
})

test('9 个 scene action + capture 全部实现', () => {
  for (const action of ['status', 'load', 'remove', 'visible', 'basemap', 'terrain', 'fly', 'reset', 'pick', 'capture']) {
    has(new RegExp(`case '${action}':`), `action：${action}`)
  }
  // fly 的角度/高度/时长必须校验后再转弧度
  has(/Cesium\.Math\.toRadians\(heading\)/, 'fly heading 转弧度')
  has(/Cesium\.Math\.toRadians\(pitch\)/, 'fly pitch 转弧度')
  has(/duration < 0 \|\| duration > 10/, 'fly duration 范围校验')
  // pick 通过经纬度投影到屏幕坐标
  has(/Cesium\.SceneTransforms\.worldToWindowCoordinates/, 'pick 屏幕坐标投影')
})

test('sceneSnapshot 输出紧凑、可直接喂模型的字段', () => {
  has(/function sceneSnapshot\(/, 'sceneSnapshot')
  for (const field of ['ready:', 'camera,', 'layers:', 'basemap:', 'terrain:', 'measure:', 'uiBusy:'])
    has(new RegExp(field.replace(':', '\\s*:')), `sceneSnapshot 字段 ${field.replace(':', '')}`)
  has(/numberOfTrianglesSelected/, '图层三角面统计')
  has(/toFixed\(6\)/, '经纬度 6 位小数')
  has(/layerRows\.slice\(0, 20\)/, '图层最多 20 条')
  has(/snapshot\.truncated = true/, 'truncated 标记')
  // 不把瓦片树 / base64 塞进 status
  assert.doesNotMatch(source, /sceneSnapshot[\s\S]{0,400}?dataUrl/)
})

test('addTileset 返回创建的图层，失败抛给调用方', () => {
  has(/async function addTileset\(url, name\)/, 'addTileset')
  has(/return layer/, 'addTileset 返回 layer')
  has(/throw new Error\('viewer not ready'\)/, 'addTileset 未就绪时抛错')
  has(/loadTilesetFromUi/, 'UI 侧兜底 toast')
})

test('capture 走 viewer.render → toBlob → 缩放 → dataUrl', () => {
  has(/function captureScene\(args/, 'captureScene')
  has(/viewer\.render\(\)/, '截图前 render')
  has(/viewer\.canvas\.toBlob/, 'toBlob')
  has(/context\.drawImage\(viewer\.canvas/, '离屏 canvas 缩放')
  has(/canvas\.toDataURL\(/, 'toDataURL')
  has(/Math\.max\(320, Math\.min\(2560/, '宽度夹在 320–2560')
  has(/dataUrl,/, 'dataUrl 回执')
})

test('工具栏截图变成菜单，并新增复制场景摘要', () => {
  has(/copySceneSummary/, 'copySceneSummary')
  has(/navigator\.clipboard\.writeText/, '剪贴板写入')
  has(/menu\('capture', t\('btn\.screenshot'\)/, '截图菜单')
  has(/'capture\.copySummary'/, '复制场景摘要菜单项')
  has(/'capture\.save'/, '保存截图菜单项')
})

test('Agent 连接状态点只在连接成功时渲染', () => {
  has(/className: 'mv-agent-dot'/, 'agent 状态点')
  has(/bridge === 'on'/, '连接状态判断')
  has(/\.mv-agent-dot\{/, 'agent 状态点样式')
  has(/var\(--mv-accent,#4da3ff\)/, '状态点颜色')
})

test('设置对话框新增「关于」页签与页脚 GitHub 链接', () => {
  has(/\['about', 'settings\.tab\.about'\]/, '关于页签')
  has(/function SourcesDialog\(\{[^)]*meta/, 'SourcesDialog 接收 meta')
  has(/meta\?\.version \?\? '—'/, '版本号回退')
  has(/github\.com\/CVEO\/dsh-digital-earth/, 'GitHub 仓库地址')
  has(/www\.whu-cveo\.com/, '课题组地址')
  has(/'MIT'/, 'MIT 许可证')
  has(/settings\.about\.cesium/, 'Cesium 署名')
  // 页脚两个轻量链接都用 .mv-team
  assert.ok(source.split("className: 'mv-team'").length >= 3, '页脚缺少 GitHub 轻量链接')
})

test('双语 MESSAGES 键集合一致且无重复', () => {
  assert.ok(zhStart > 0 && enStart > zhStart && localeEnd > enStart)
  const zhKeys = keysIn(source.slice(zhStart, enStart))
  const enKeys = keysIn(source.slice(enStart, localeEnd))
  assert.ok(zhKeys.length > 100, `zh 键解析异常：${zhKeys.length}`)
  assert.equal(new Set(zhKeys).size, zhKeys.length, 'zh 存在重复键')
  assert.equal(new Set(enKeys).size, enKeys.length, 'en 存在重复键')
  assert.deepEqual([...new Set(zhKeys)].sort(), [...new Set(enKeys)].sort())
  for (const key of [
    'capture.save',
    'capture.copySummary',
    'toast.sceneCopied',
    'toast.sceneCopyFailed',
    'toast.clipboardUnavailable',
    'toast.loaded',
    'toast.removed',
    'toast.visibleOn',
    'toast.visibleOff',
    'toast.flew',
    'toast.viewReset',
    'settings.tab.about',
    'settings.about.version',
    'settings.about.repository',
    'settings.about.team',
    'settings.about.license',
    'settings.about.bundled',
    'settings.about.cesium',
    'agent.connected',
    'agent.prefix',
  ]) {
    assert.ok(zhKeys.includes(key), `zh 缺少键：${key}`)
    assert.ok(enKeys.includes(key), `en 缺少键：${key}`)
  }
})
