/**
 * v1.4.0 批次 B4 的 QA 套件（task-31）。
 *
 * 只读源码与文档，不碰实现：
 *   - 版本单一来源：package.json 1.4.0、Host/Client FALLBACK_ABOUT、README/CHANGELOG；
 *   - README 中英：1.4.0 徽章/安装示例、六工具名与功能行、结构与链接离线自查；
 *   - CHANGELOG：1.4.0 段落完整（本地路径/分析/着色器/HUD/性能），1.5.0 段落覆盖破坏性变更与架构；
 *   - About：宿主元数据（homepage/issues/team）与客户端兜底、团队与源码 URL；
 *   - Client B4 修复静态断言：F1 re-apply 失败恢复活动预设且不动 entries、
 *     F2 自动选层跳过 3DGS、F3 radius=0 一律回退 0..200；
 *   - 隐私扫描：包内文本文件无个人绝对路径/用户名/常见密钥；.research 不进入 git；
 *   - 模型面回归：提示词 ≤1600、六工具名、描述区无 authorize/skyline/天际线；
 *   - 文档事实边界：着色器仅普通 3D Tiles/无 GLSL、30 FPS 非固定承诺、headless 口径。
 *
 * 边界：本套件是静态与离线文档检查；真实 GPU/WebGL 渲染、安装后的 DSH 手测不在覆盖内，
 * 见 .research/b4-qa-report.md。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SYSTEM_PROMPT_SECTION } from '../index.js'
import { clientSource, hostSource } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readText = (name) => readFile(join(root, name), 'utf8').then((text) => text.replace(/\r\n/g, '\n'))
// Authored client source (src/client/**), not the generated client.js artifact.
const client = clientSource()
const [packageText, readmeZh, readmeEn, changelog, aboutSource, sceneSource, shaderSource, analyzeSource] = await Promise.all([
  readText('package.json'),
  readText('README.md'),
  readText('README.en.md'),
  readText('CHANGELOG.md'),
  readText('src/host/about.js'),
  readText('src/host/tools/scene.js'),
  readText('src/host/tools/shader.js'),
  readText('src/host/tools/analyze.js'),
])
const host = hostSource()

const pkg = JSON.parse(packageText)
const TOOL_NAMES = ['earth_scene', 'earth_capture', 'earth_draw', 'earth_measure', 'earth_analyze', 'earth_shader']

/** 取源码片段：从 start 到其后的 end（含 end），找不到即断言失败。 */
function block(source, start, end) {
  const from = source.indexOf(start)
  assert.ok(from >= 0, `源码中找不到片段起点：${start}`)
  const to = source.indexOf(end, from + start.length)
  assert.ok(to > from, `源码中找不到片段终点：${end}`)
  return source.slice(from, to + end.length)
}

/** 把源码里的纯字面量对象取出来求值；只用于本仓库自己的静态定义。 */
function evalObjectLiteral(source, start, end) {
  const text = block(source, start, end)
  const from = text.indexOf('{')
  const to = text.lastIndexOf('}')
  assert.ok(from >= 0 && to > from, `无法提取对象字面量：${start}`)
  return new Function(`return (${text.slice(from, to + 1)})`)()
}

/** 把 `const X_DESCRIPTION = [ '...', ... ].join('\n')` 还原成模型实际看到的文本。 */
function descriptionOf(source, name) {
  const descBlock = block(source, `const ${name}_DESCRIPTION = [`, `].join('`)
  const lines = [...descBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((match) =>
    match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'),
  )
  assert.ok(lines.length > 0, `${name}_DESCRIPTION 没有可解析的字符串行`)
  return lines.join('\n')
}

// 隐私 pattern 全部运行时拼接，避免测试文件自身出现敏感字面量而被误扫。
const USER = String.fromCharCode(99, 103, 122)
const PERSONAL_PATHS = [['C:', 'Users', USER].join('\\'), ['C:', 'Users', USER].join('/')]
const USER_WORD = new RegExp(`\\b${USER}\\b`)
const SECRET_PATTERNS = [
  new RegExp(['AK', 'IA'].join('') + '[0-9A-Z]{16}'),
  new RegExp(['gh', 'p_'].join('') + '[A-Za-z0-9]{20,}'),
  new RegExp(['s', 'k-'].join('') + '[A-Za-z0-9]{20,}'),
  new RegExp(['-----BEGIN ', 'PRIVATE', ' KEY-----'].join('')),
  new RegExp(['PRIVATE', 'KEY'].join(' ')),
]

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.tgz', '.zip', '.gz',
  '.glb', '.b3dm', '.woff', '.woff2', '.ttf', '.eot', '.wasm',
  // Point-cloud / raster data is binary and can embed machine paths; the privacy
  // scan must skip it rather than read it as text.
  '.npz', '.npy', '.las', '.laz', '.tif', '.tiff',
])
const SKIP_DIRS = new Set(['.git', '.research', 'node_modules', 'vendor', 'dist', 'captures', '.dsh-earth', 'roof_task'])

/** 收集包内文本文件（跳过 vendor/.git/.research 等目录与二进制文件）。 */
async function collectTextFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      await collectTextFiles(join(dir, entry.name), out)
      continue
    }
    if (!entry.isFile()) continue
    if (BINARY_EXT.has(extname(entry.name).toLowerCase())) continue
    out.push(join(dir, entry.name))
  }
  return out
}

const markdownLinks = (text) => [...text.matchAll(/\]\(([^()\s]+)\)/g)].map((match) => match[1])
const markdownHeadings = (text) => [...text.matchAll(/^## .+$/gm)].map((match) => match[0])
const codeFences = (text) => (text.match(/^```/gm) ?? []).length

// ---------------------------------------------------------------------------
// 版本与包结构
// ---------------------------------------------------------------------------

test('B4 版本：package.json 为合法 semver，未新增依赖/未改 scripts 与入口', () => {
  assert.equal(pkg.name, '@cveo/dsh-digital-earth')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.equal(pkg.dependencies, undefined, '不得新增 runtime dependencies')
  // v1.5：只允许构建期 esbuild（client.js 由 src/client 构建）。
  assert.deepEqual(Object.keys(pkg.devDependencies ?? {}), ['esbuild'], 'devDependencies 只允许 esbuild')
  assert.equal(pkg.optionalDependencies, undefined)
  assert.equal(pkg.peerDependencies, undefined)
  assert.equal(pkg.license, 'MIT')
  assert.equal(pkg.engines?.dsh, '>=0.2.1-rc.1 <0.3.0-0')
  assert.equal(pkg.exports?.['.'], './index.js')
  assert.equal(pkg.exports?.['./client'], './client.js')
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.equal(pkg.scripts?.test, 'node --test')
  assert.equal(
    pkg.scripts?.check,
    'node --check index.js && node --check client.js && npm run build:client -- --check && node scripts/check-size.mjs && node --test',
  )
  // 发布白名单不包含测试与 QA 资料。
  assert.ok(!(pkg.files ?? []).some((name) => name.startsWith('test/')), 'files 不应包含 test/')
  assert.ok(!(pkg.files ?? []).some((name) => name.startsWith('.research')), 'files 不应包含 .research')
})

test('B4 README 中文：版本徽章/安装示例、六工具与新增功能行', () => {
  // 版本文档不写死具体版本号：README 必须跟随 package.json 的单一来源。
  assert.ok(readmeZh.includes(`版本-${pkg.version}-4f8cff`), 'README.md 版本徽章未跟随 package.json')
  assert.ok(readmeZh.includes(`cveo-dsh-digital-earth-${pkg.version}.tgz`), 'README.md 安装示例未跟随 package.json')
  assert.doesNotMatch(readmeZh, /1\.3\.0/)
  for (const name of TOOL_NAMES) assert.ok(readmeZh.includes(`\`${name}\``), `README.md 缺少工具 ${name}`)
  assert.equal((readmeZh.match(/^\| `earth_[a-z]+` \|/gm) ?? []).length, 6, 'README.md 工具表应为 6 行')
  for (const phrase of ['内置六个工具', '空间分析', '视觉特效', '可折叠面板', '干净截图', '本机绝对路径', '约 5–6 Hz']) {
    assert.ok(readmeZh.includes(phrase), `README.md 缺少功能说明：${phrase}`)
  }
  assert.match(readmeZh, /白名单预设/)
})

test('B4 README 英文：版本徽章/安装示例、六工具与对应功能行', () => {
  assert.ok(readmeEn.includes(`version-${pkg.version}-4f8cff`), 'README.en.md version badge does not follow package.json')
  assert.ok(readmeEn.includes(`cveo-dsh-digital-earth-${pkg.version}.tgz`), 'README.en.md install example does not follow package.json')
  assert.doesNotMatch(readmeEn, /1\.3\.0/)
  for (const name of TOOL_NAMES) assert.ok(readmeEn.includes(`\`${name}\``), `README.en.md 缺少工具 ${name}`)
  assert.equal((readmeEn.match(/^\| `earth_[a-z]+` \|/gm) ?? []).length, 6, 'README.en.md 工具表应为 6 行')
  for (const phrase of [
    'Six built-in tools', 'Spatial analysis', 'Visual effects', 'Collapsible panels',
    'Clean snapshots', 'absolute local path', '5–6 Hz',
  ]) {
    assert.ok(readmeEn.includes(phrase), `README.en.md 缺少功能说明：${phrase}`)
  }
  assert.match(readmeEn, /white-listed presets/)
})

test('B4 README 中英对齐：章节数、工具行、安装命令与代码围栏一致', () => {
  const zhHeadings = markdownHeadings(readmeZh)
  const enHeadings = markdownHeadings(readmeEn)
  assert.equal(zhHeadings.length, 7, `README.md 章节数异常：${zhHeadings.length}`)
  assert.equal(enHeadings.length, zhHeadings.length, '中英 README 章节数必须一致')
  assert.equal(codeFences(readmeZh), 2)
  assert.equal(codeFences(readmeEn), 2)
  for (const text of [readmeZh, readmeEn]) {
    assert.match(text, /dsh plugin --profile <profile> add @cveo\/dsh-digital-earth/)
    assert.match(text, /\[README\.md\]\(README\.md\)|\[中文\]\(README\.md\)/)
    assert.match(text, /\[README\.en\.md\]\(README\.en\.md\)|\[English\]\(README\.en\.md\)/)
  }
  // 中英文同一位置的能力项行长一致，说明功能表没有单边漂移。
  const zhRows = [...readmeZh.matchAll(/^\| (.+?) \| (.+?) \|$/gm)].length
  const enRows = [...readmeEn.matchAll(/^\| (.+?) \| (.+?) \|$/gm)].length
  assert.equal(zhRows, enRows, '中英 README 表格行数必须一致')
})

test('B4 README 链接与本地资源：离线可判定的值均有效，无占位/死链', () => {
  const allowedHttp = [
    'https://img.shields.io/badge/',
    'https://github.com/CVEO/dsh-digital-earth',
    'https://www.whu-cveo.com/',
  ]
  for (const [label, text] of [['README.md', readmeZh], ['README.en.md', readmeEn]]) {
    const links = markdownLinks(text)
    assert.ok(links.length >= 8, `${label} 链接过少：${links.length}`)
    for (const link of links) {
      if (/^https?:\/\//.test(link)) {
        assert.ok(
          allowedHttp.some((prefix) => link.startsWith(prefix)),
          `${label} 出现未预期外链：${link}`,
        )
        continue
      }
      assert.match(link, /^[A-Za-z0-9._/-]+$/, `${label} 链接格式异常：${link}`)
      assert.ok(existsSync(join(root, link)), `${label} 本地链接目标不存在：${link}`)
    }
    for (const autolink of [...text.matchAll(/<(https?:\/\/[^>\s]+)>/g)].map((match) => match[1])) {
      assert.ok(allowedHttp.some((prefix) => autolink.startsWith(prefix)), `${label} 自动链接异常：${autolink}`)
    }
    assert.doesNotMatch(text, /TODO|example\.com|localhost|127\.0\.0\.1/)
  }
})

test('B4 版本单一来源：Host/Client FALLBACK_ABOUT 与 package 一致，文档不残留 1.3.0', () => {
  const hostAbout = evalObjectLiteral(aboutSource, 'const FALLBACK_ABOUT = {', '\n}')
  const clientAbout = evalObjectLiteral(client, 'const FALLBACK_ABOUT = {', '\n    }')
  assert.equal(hostAbout.version, pkg.version)
  assert.equal(clientAbout.version, pkg.version)

  // Host 以 package.json 为单一来源；常量只是文件缺失/损坏时的兜底。
  const readAbout = block(aboutSource, 'function readAbout() {', 'const ABOUT = readAbout()')
  assert.match(readAbout, /readFileSync\(PACKAGE_FILE, 'utf8'\)/)
  assert.match(readAbout, /version: version !== '' \? version : FALLBACK_ABOUT\.version/)
  assert.match(readAbout, /homepage: homepage !== '' \? homepage : FALLBACK_ABOUT\.homepage/)
  assert.match(readAbout, /issues: FALLBACK_ABOUT\.issues/)
  assert.match(readAbout, /name: teamName !== '' \? teamName : FALLBACK_ABOUT\.team\.name/)
  assert.equal(JSON.parse(packageText).team, undefined, 'package.json 没有 team 字段，About 团队必须走 Host 兜底')

  for (const [label, text] of [['README.md', readmeZh], ['README.en.md', readmeEn], ['src/host', host], ['client.js', client]]) {
    assert.ok(!text.includes('1.3.0'), `${label} 残留 1.3.0`)
  }
  const versions = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)$/gm)].map((match) => match[1])
  assert.ok(versions.length >= 3, 'CHANGELOG 版本条目过少')
  // 最新 CHANGELOG 条目必须等于 package.json 版本，而不是写死某个发布号。
  assert.equal(versions[0], pkg.version, 'CHANGELOG 最新版本必须与 package.json 一致')
  assert.ok(versions.includes('1.3.0'), 'CHANGELOG 必须保留历史版本条目')
  // 1.4.0 现在是合并版（未发布前吸收了 1.5–1.7 的功能），因此只需保证历史顺序从新到旧。
  assert.ok(versions.indexOf('1.3.0') > versions.indexOf('1.4.0'), 'CHANGELOG 版本条目必须从新到旧排列')
  assert.ok(changelog.indexOf('## 1.4.0') < changelog.indexOf('## 1.3.0'))
})

test('B4 CHANGELOG：1.4.0 段落完整，且 1.5.0 段落覆盖破坏性变更与架构改动', () => {
  const section = changelog.slice(changelog.indexOf('## 1.4.0'), changelog.indexOf('## 1.3.0'))
  assert.ok(section.length > 500, `CHANGELOG 1.4.0 段落过短：${section.length}`)
  for (const phrase of [
    '本地绝对路径直接授权', 'access_denied', 'access_timeout', '图层与 HUD 可折叠',
    'HUD 指针采样', 'earth_analyze', 'earth_shader', '第 5 个工具', '第 6 个工具', '第六工具与六条 toolview',
    '截图默认干净画面', '关于页签', '30 FPS', 'headless / SwiftShader', '1.4.0',
  ]) {
    assert.ok(section.includes(phrase), `CHANGELOG 1.4.0 缺少：${phrase}`)
  }
  assert.match(section, /profile/)
  assert.match(section, /height-false-color/)
  // v1.4.0 段落是面向用户的发布说明，不应出现内部流程/未落地功能词。
  assert.doesNotMatch(section, /发布|release|上线|天际线|skyline/i)
  assert.doesNotMatch(changelog, /\bTODO\b/)

  // v1.5.0 段落必须写清破坏性变更与架构改动（升级者只看这一节）。
  const v15 = changelog.slice(changelog.indexOf('## 1.5.0'), changelog.indexOf('## 1.4.0'))
  assert.ok(v15.length > 800, `CHANGELOG 1.5.0 段落过短：${v15.length}`)
  for (const phrase of [
    '不兼容变更', 'tileset_info.json', 'tileset_not_georeferenced',
    'scene.postRender', 'DOM Fullscreen', 'terrainDepthTest',
    'src/host/**', 'src/client/**', 'build:client', 'check-size',
  ]) {
    assert.ok(v15.includes(phrase), `CHANGELOG 1.5.0 缺少：${phrase}`)
  }
})

test('B4 About：源码/Issues/团队与 URL 正确，客户端 meta 优先且兜底可用', () => {
  const hostAbout = evalObjectLiteral(aboutSource, 'const FALLBACK_ABOUT = {', '\n}')
  assert.equal(hostAbout.homepage, 'https://github.com/CVEO/dsh-digital-earth')
  assert.equal(hostAbout.issues, 'https://github.com/CVEO/dsh-digital-earth/issues')
  assert.equal(hostAbout.team.name, '武汉大学 CVEO 课题组')
  assert.equal(hostAbout.team.url, 'https://www.whu-cveo.com/')

  const clientAbout = evalObjectLiteral(client, 'const FALLBACK_ABOUT = {', '\n    }')
  assert.equal(clientAbout.homepage, hostAbout.homepage)
  assert.equal(clientAbout.teamUrl, hostAbout.team.url)

  const about = block(client, 'const homepage = meta?.homepage ?? FALLBACK_ABOUT.homepage', "h('span', null, t('about.license'))")
  assert.match(about, /meta\?\.version \?\? FALLBACK_ABOUT\.version/)
  assert.match(about, /meta\?\.issues \?\? `\$\{String\(homepage\)\.replace/)
  assert.match(about, /meta\?\.team\?\.url \?\? FALLBACK_ABOUT\.teamUrl/)
  assert.match(about, /meta\?\.team\?\.name \?\? t\('about\.teamName'\)/)
  assert.match(client, /'about\.teamName': '武汉大学 CVEO 课题组'/)
  assert.match(client, /'about\.teamName': 'Wuhan University CVEO Research Group'/)
  for (const key of ['about.version', 'about.homepage', 'about.issues', 'about.team', 'about.license']) {
    assert.ok(client.includes(`'${key}':`), `缺少 i18n 键 ${key}`)
  }
})

// ---------------------------------------------------------------------------
// Client B4 修复：F1 / F2 / F3
// ---------------------------------------------------------------------------

test('B4 F1：同层 re-apply 失败恢复活动预设且 entries 不变，恢复失败才删 entry', () => {
  // v1.6：同预设滑杆更新走 fast-path，先返回一次 shaderResult，因此用下一个函数作为边界。
  const apply = block(client, 'function applyShader(request) {', '      function resetShader(layerToken) {')
  assert.match(apply, /const existing = shaderEntriesRef\.current\.get\(layer\.id\)/)
  assert.match(apply, /const previous = existing \? existing\.previous : \(layer\.tileset\.customShader \?\? null\)/)

  const assignTry = apply.indexOf('try {\n          layer.tileset.customShader = shader')
  assert.ok(assignTry > 0, 'applyShader 缺少 customShader 赋值 try 块')
  const catchBlock = apply.slice(assignTry, apply.indexOf('shaderEntriesRef.current.set(layer.id, {'))
  assert.ok(catchBlock.length > 200, 'F1 失败处理块过短')
  // 恢复的是“当前仍活动的旧预设”，不是进入 B3 前的原始 shader。
  assert.match(catchBlock, /Restore the preset that is still active/)
  assert.match(catchBlock, /let restored = false/)
  const existingBranch = catchBlock.slice(catchBlock.indexOf('if (existing) {'), catchBlock.indexOf('} else {'))
  assert.match(existingBranch, /layer\.tileset\.customShader = existing\.shader \?\? undefined/)
  assert.match(existingBranch, /restored = layer\.tileset\.customShader === \(existing\.shader \?\? undefined\)/)
  assert.doesNotMatch(existingBranch, /previous/, 'existing 分支不得回滚到 previous')
  assert.match(catchBlock, /layer\.tileset\.customShader = previous \?\? undefined/)
  assert.match(catchBlock, /restored = layer\.tileset\.customShader === \(previous \?\? undefined\)/)
  assert.doesNotMatch(existingBranch, /shaderEntriesRef\.current\.(?:delete|set)/, '恢复成功时不得改 entries')

  // 双重失败：删过期 entry、必要时释放 tick、刷新 active，再抛“恢复失败”单行错误。
  const doubleFail = catchBlock.slice(catchBlock.indexOf('if (!restored) {'))
  assert.match(doubleFail, /shaderEntriesRef\.current\.delete\(layer\.id\)/)
  assert.match(doubleFail, /if \(shaderEntriesRef\.current\.size === 0\) releaseShaderTick\(\)/)
  assert.match(doubleFail, /refreshShaderActive\(\)/)
  assert.match(doubleFail, /预设应用失败（\$\{message\(error\)\}），且原有着色器恢复失败。/)
  assert.match(doubleFail, /'重新加载该图层或刷新面板后重试。'/)
  assert.equal((doubleFail.match(/next: /g) ?? []).length, 0, '错误由 shaderFail 统一追加 next:')

  // 普通失败路径保持原错误；entries 只在 try/catch 成功之后写入。
  assert.ok(
    catchBlock.includes("throw shaderFail(`预设应用失败（${message(error)}）。`, '换一个预设或重置后重试。')"),
    '普通失败路径必须保持原错误',
  )
  const setIndex = apply.indexOf('shaderEntriesRef.current.set(layer.id, {')
  assert.ok(setIndex > apply.indexOf('if (!restored) {'), 'entries.set 必须在失败处理之后')
  assert.match(apply.slice(setIndex), /preset: request\.preset/)
  assert.match(apply.slice(setIndex), /previous,\s*\n\s*shader,/)
})

test('B4 F2：自动选层从最上层向下跳过 3DGS，显式图层与全 3DGS 错误保持契约', () => {
  const resolve = block(client, 'function resolveShaderLayer(token) {', '\n      function applyShader(request)')
  assert.ok(resolve.indexOf('if (token) {') < resolve.indexOf('for (let index = layersRef.current.length - 1'), '显式 token 必须先于自动遍历')
  const tokenBranch = resolve.slice(resolve.indexOf('if (token) {'), resolve.indexOf('let gaussianOnly = false'))
  assert.match(tokenBranch, /const layer = findLayer\(token\)/)
  assert.match(tokenBranch, /return layer/)
  assert.doesNotMatch(tokenBranch, /shaderGaussianLayer/, '显式 token 不应被自动跳过逻辑过滤')

  assert.match(resolve, /for \(let index = layersRef\.current\.length - 1; index >= 0; index -= 1\)/)
  assert.match(resolve, /if \(!layer\.visible\) continue/)
  const gaussianStart = resolve.indexOf('if (shaderGaussianLayer(layer.tileset, layer)) {')
  assert.ok(gaussianStart > 0, 'resolveShaderLayer 缺少 3DGS 跳过分支')
  const skip = resolve.slice(gaussianStart, resolve.indexOf('return layer', gaussianStart))
  assert.match(skip, /gaussianOnly = true/)
  assert.match(skip, /continue/)
  assert.match(resolve, /Auto-selection skips 3DGS/)
  assert.match(resolve, /'当前视图没有可用的 3D Tiles 图层（可见图层均为 3DGS）。'/)
  assert.match(resolve, /'加载或显示普通 3D Tiles 图层后重试。'/)
  assert.match(resolve, /'当前视图没有可见的 3D Tiles 图层。'/)
  assert.match(resolve, /'先加载或显示 3D Tiles 图层后重试。'/)
  // 每个错误恰好一个可执行 next:（由 shaderFail 追加）。
  const nextCounts = [...resolve.matchAll(/shaderFail\(([\s\S]*?)\)\n/g)].map((match) => (match[1].match(/next: /g) ?? []).length)
  assert.ok(nextCounts.every((count) => count === 0), 'next: 必须由 shaderFail 统一追加')

  // v1.6：同预设滑杆更新走 fast-path，先返回一次 shaderResult，因此用下一个函数作为边界。
  const apply = block(client, 'function applyShader(request) {', '      function resetShader(layerToken) {')
  assert.ok(apply.indexOf('const layer = resolveShaderLayer(request.layer)') < apply.indexOf("throw new Error('shader: 3DGS 图层不支持该预设。next: 换 3D Tiles 图层。')"))
  assert.match(apply, /throw new Error\('shader: 3DGS 图层不支持该预设。next: 换 3D Tiles 图层。'\)/)
})

test('B4 F3：radius=0 一律回退 0..200，无 centerHeight±50 分支，显式 min/max 仍覆盖', () => {
  const range = block(client, 'function shaderHeightRange(Cesium, tileset, fallbackCenter) {', '\n    }')
  assert.match(range, /if \(radius > 0\) \{/)
  assert.doesNotMatch(range, /centerHeight !== 0/, 'radius=0 不得再走 centerHeight 分支')
  assert.doesNotMatch(range, /centerHeight\s*[+-]\s*50/, '不得保留 centerHeight±50 的回退分支')
  assert.match(range, /minimum = shaderClamp\(centerHeight - radius, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING\)/)
  assert.match(range, /maximum = shaderClamp\(centerHeight \+ radius, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING\)/)
  assert.match(range, /if \(!\(maximum > minimum\)\) \{\s*minimum = 0\s*maximum = 200/)
  assert.match(range, /estimated: radius > 0/)
  assert.match(range, /zero-radius/)
  assert.match(range, /0\.\.200/)

  // v1.6：同预设滑杆更新走 fast-path，先返回一次 shaderResult，因此用下一个函数作为边界。
  const apply = block(client, 'function applyShader(request) {', '      function resetShader(layerToken) {')
  const call = apply.indexOf('const range = shaderHeightRange(Cesium, layer.tileset, null)')
  assert.ok(call > 0, 'applyShader 必须调用 shaderHeightRange')
  assert.ok(apply.indexOf('if (request.params.min_height !== undefined) range.minimum = request.params.min_height') > call)
  assert.ok(apply.indexOf('if (request.params.max_height !== undefined) range.maximum = request.params.max_height') > call)
  assert.match(apply, /高程范围无效（\$\{range\.minimum\}\.\.\$\{range\.maximum\}）。/)
})

// ---------------------------------------------------------------------------
// 模型面回归、隐私与文档事实
// ---------------------------------------------------------------------------

test('B4 模型面回归：提示词 ≤1600 六工具名与完整 action 清单，描述区无 authorize', () => {
  const prompt = SYSTEM_PROMPT_SECTION
  assert.ok(prompt.length <= 1600, `提示词超预算：${prompt.length}`)
  assert.ok(prompt.length >= 1400, `提示词过短：${prompt.length}`)
  for (const name of TOOL_NAMES) assert.ok(prompt.includes(name), `提示词缺少 ${name}`)
  assert.match(prompt, /Six tools drive it/)
  assert.match(prompt, /earth_scene actions: status, list, load, remove, visible, basemap, terrain, fly, reset, pick, inspect, report\./)
  assert.match(prompt, /earth_analyze runs one analysis at a time \(profile, flood, sunlight, clip or skyline\)/)
  assert.doesNotMatch(prompt, /authorize/i)

  const region = sceneSource.slice(sceneSource.indexOf('const SCENE_DESCRIPTION = ['))
  assert.doesNotMatch(region, /authorize|skyline|天际线/i)
  assert.doesNotMatch(region, /fragmentShader|vertexShader/i)

  const shaderDesc = descriptionOf(shaderSource, 'SHADER')
  const analyzeDesc = descriptionOf(analyzeSource, 'ANALYZE')
  assert.ok(shaderDesc.length <= 1200, `earth_shader 描述超预算：${shaderDesc.length}`)
  assert.ok(analyzeDesc.length <= 1200, `earth_analyze 描述超预算：${analyzeDesc.length}`)
  assert.doesNotMatch(shaderDesc, /authorize|skyline|天际线/i)
  // D-16：skyline 已是 1.6 的正式分析，analyze 描述必须提到它；未批准的能力仍禁止。
  assert.match(analyzeDesc, /skyline elevation-angle profile/)
  assert.doesNotMatch(analyzeDesc, /天际线|authorize|viewshed|line of sight/i)
})

test('B4 回归：六工具注册/六条描述/六 toolview 未被文档任务破坏', () => {
  const registrations = [...host.matchAll(/scope\.tools\.register\(create([A-Z][a-z]+)Tool\(bridge(?:, [A-Za-z]+)?\)\)/g)].map((match) => match[1])
  assert.deepEqual(registrations, ['Scene', 'Capture', 'Draw', 'Measure', 'Analyze', 'Shader'])
  for (const name of ['SCENE', 'CAPTURE', 'DRAW', 'MEASURE', 'ANALYZE', 'SHADER']) {
    assert.ok(host.includes(`const ${name}_DESCRIPTION = [`), `缺少 ${name}_DESCRIPTION`)
  }
  const toolviews = [...client.matchAll(/name: 'tool\.call\.toolview', key: '([a-z_]+)'/g)].map((match) => match[1])
  assert.deepEqual(toolviews, TOOL_NAMES)
  // earth_scene 走通用的 tool.action.generic，其余五个各有摘要键。
  const summaryKeys = block(client, 'const TOOL_SUMMARY_KEYS = {', '\n    }')
  for (const name of TOOL_NAMES.slice(1)) {
    assert.match(summaryKeys, new RegExp(`${name}: 'tool\\.action\\.`), `TOOL_SUMMARY_KEYS 缺少 ${name}`)
  }
  assert.doesNotMatch(summaryKeys, /earth_scene:/)
  assert.match(client, /TOOL_SUMMARY_KEYS\[toolName\] \?\? 'tool\.action\.generic'/)
})

test('B4 隐私：包内文本文件无个人绝对路径/用户名/常见密钥，.research 不进入 git', async () => {
  const files = await collectTextFiles(root)
  assert.ok(files.length >= 20, `扫描文本文件过少：${files.length}（隐私扫描失效？）`)
  const findings = []
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    for (const personal of PERSONAL_PATHS) {
      if (text.includes(personal)) findings.push(`${file}: 个人绝对路径 ${personal}`)
    }
    if (USER_WORD.test(text)) findings.push(`${file}: 出现本机用户名`)
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) findings.push(`${file}: 命中密钥 pattern ${pattern}`)
    }
  }
  assert.deepEqual(findings, [], `隐私扫描命中：\n${findings.join('\n')}`)

  const gitignore = await readText('.gitignore')
  for (const entry of ['.research/', 'node_modules/', 'dist/', 'captures/', '.dsh-earth/']) {
    assert.ok(gitignore.split(/\r?\n/).includes(entry), `.gitignore 缺少 ${entry}`)
  }
  assert.ok(!(pkg.files ?? []).some((name) => name.startsWith('test/') || name.startsWith('.research')))
  if (existsSync(join(root, '.git'))) {
    const tracked = execFileSync('git', ['ls-files', '--', '.research'], { cwd: root, encoding: 'utf8' })
    assert.equal(tracked.trim(), '', `.research 不得被 git 跟踪：\n${tracked}`)
    const checkIgnore = execFileSync('git', ['check-ignore', '.research/'], { cwd: root, encoding: 'utf8' })
    // Directory-only patterns need the trailing slash; `.research` alone does not
    // match `.research/` and made this assertion fail on every clean checkout.
    assert.equal(checkIgnore.trim(), '.research/')
  }
})

test('B4 文档边界：能力范围与截图默认值写清楚', () => {
  // README 面向用户，保持能力范围与截图默认值，不再设置“已知限制”章节。
  assert.match(readmeZh, /白名单预设/)
  assert.match(readmeZh, /截图目录只保留最近 50 张/)
  assert.match(readmeZh, /手动与 Agent 截图默认只保留三维画面/)

  assert.match(readmeEn, /white-listed presets/)
  assert.match(readmeEn, /Manual and Agent snapshots keep only the 3D view by default/)

  // CHANGELOG 的性能口径必须写明实测环境边界，不承诺固定帧率。
  const section = changelog.slice(changelog.indexOf('## 1.4.0'), changelog.indexOf('## 1.3.0'))
  assert.match(section, /非 headless \/ SwiftShader|非 headless/)
  assert.match(section, /不作为固定指标|随显卡/)
})
