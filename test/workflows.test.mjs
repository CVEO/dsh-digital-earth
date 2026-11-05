/**
 * 发布工程自检：GitHub Actions 工作流的结构断言。
 *
 * 维护文档（分支模型、发版手册、PR 模板、Agent 桥协议）已移出插件仓库，
 * 因此这里只守发布链路本身的关键约定：
 *   - CI 必须同时覆盖 main 与 develop、Ubuntu/Windows 与 Node 22/24、且真实打包冒烟；
 *   - Publish 必须保留 OIDC、版本探测跳过、tag 与 package.json 版本一致性校验。
 *
 * 这里刻意不引入 YAML 解析库（本项目零运行期依赖、测试只依赖 Node 内置能力）。
 * 断言失败通常意味着有人重构了 workflow 却漏掉了发布守卫，请先补齐再合入。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (rel) => readFile(join(root, rel), 'utf8')

const ci = await read('.github/workflows/ci.yml')
const publish = await read('.github/workflows/publish.yml')

test('工作流使用空格缩进（YAML 不允许 tab 缩进）', () => {
  for (const [name, text] of [['ci.yml', ci], ['publish.yml', publish]]) {
    assert.doesNotMatch(text, /^\t/m, `${name} 使用了 tab 缩进`)
  }
})

test('CI 在 push 与 PR 上同时覆盖 main 和 develop', () => {
  assert.match(ci, /^on:/m)
  assert.match(ci, /push:\s*\n\s*branches:\s*\[[^\]]*main[^\]]*develop\]/)
  assert.match(ci, /pull_request:\s*\n\s*branches:\s*\[[^\]]*main[^\]]*develop\]/)
})

test('CI 在 Ubuntu 与 Windows 上跑 Node 22 / 24 矩阵', () => {
  // 行尾/路径类回归只在 Windows 复现：Ubuntu 单腿会让 CRLF checkout 与
  // POSIX-only 写法一直绿到发布前才发现。
  assert.match(ci, /runs-on:\s*\$\{\{\s*matrix\.os\s*\}\}/)
  assert.match(ci, /matrix:\s*\n\s*os:\s*\[ubuntu-latest,\s*windows-latest\]/)
  assert.match(ci, /node:\s*\[22,\s*24\]/)
  assert.match(ci, /node-version:\s*\$\{\{\s*matrix\.node\s*\}\}/)
})

test('CI 的 Windows 腿用 bash 跑同一套冒烟脚本', () => {
  // windows-latest 的默认 shell 是 pwsh，`set -euo pipefail` / trap / tar -C
  // 都会直接报错；显式统一成 bash（Windows 上是 Git Bash）才不会让 Windows
  // 腿变成「装得上但一跑就挂」的装饰品。
  assert.match(ci, /defaults:\s*\n\s*run:\s*\n\s*shell:\s*bash/)
})

test('CI 依次做语法检查、结构测试、打包清单与打包冒烟', () => {
  assert.match(ci, /node --check index\.js && node --check client\.js/)
  assert.match(ci, /node --test/)
  assert.match(ci, /npm pack --dry-run/)
  // 冒烟必须来自真实 tarball，而不是只跑 dry-run
  assert.match(ci, /npm pack --silent/)
  assert.match(ci, /tar -xzf/)
  assert.match(ci, /--input-type=module/)
  // Windows 的 ESM loader 不接受盘符绝对路径，冒烟脚本必须转成 file:// URL，
  // 否则 ubuntu 绿、windows 红。
  assert.match(ci, /pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(ci, /typeof m\.apply/)
  assert.match(ci, /process\.exit\(1\)/)
  // 顺序：语法检查 → 测试 → 打包冒烟
  assert.ok(ci.indexOf('node --test') < ci.indexOf('npm pack --silent'), '测试应在打包冒烟之前')
})

test('CI 权限最小化，且并发时取消旧任务', () => {
  assert.match(ci, /permissions:\s*\n\s*contents:\s*read/)
  assert.match(ci, /cancel-in-progress:\s*true/)
  assert.match(ci, /actions\/checkout@v6/)
  assert.match(ci, /actions\/setup-node@v6/)
  assert.match(ci, /package-manager-cache:\s*false/)
})

test('Publish 只在 v* tag 与手动 dispatch 时触发，push main 不再发版', () => {
  // main 只做代码合入：合并不会把版本发到 npm，发版由维护者打 tag 决定。
  const onBlock = publish.slice(publish.indexOf('on:'), publish.indexOf('permissions:'))
  assert.doesNotMatch(onBlock, /branches:/, '发布工作流不应再按分支 push 触发')
  assert.match(onBlock, /tags:\s*\['v\*'\]/)
  assert.match(onBlock, /workflow_dispatch:/)
})

test('Publish 用 OIDC Trusted Publishing 并升级 npm 到支持版本', () => {
  assert.match(publish, /id-token:\s*write/) // OIDC 必需
  assert.match(publish, /contents:\s*read/)
  assert.match(publish, /registry-url:\s*'https:\/\/registry\.npmjs\.org'/)
  assert.match(publish, /npm install -g npm@latest/)
  assert.match(publish, /11\.5\.1/) // Trusted Publishing 的最低 npm 版本
})

test('Publish 在真正发布前重跑完整校验', () => {
  assert.match(publish, /node --check index\.js && node --check client\.js/)
  assert.match(publish, /node --test/)
  assert.match(publish, /npm pack --dry-run/)
  assert.match(publish, /npm pack --silent/)
  assert.match(publish, /--input-type=module/)

  const testsAt = publish.indexOf('name: Structural tests')
  const smokeAt = publish.indexOf('name: Package smoke test')
  const publishAt = publish.indexOf('name: Publish to npm')
  assert.ok(testsAt >= 0 && smokeAt >= 0 && publishAt >= 0, '缺少测试 / 冒烟 / 发布步骤')
  assert.ok(testsAt < publishAt, '发布前必须重跑 node --test')
  assert.ok(smokeAt < publishAt, '发布前必须重跑打包冒烟')
})

test('Publish 探测 npm 上是否已有该版本，已存在则跳过并 notice', () => {
  assert.match(publish, /id:\s*probe/)
  assert.match(publish, /npm view "\$NAME@\$VERSION"/)
  assert.match(publish, /published=true/)
  assert.match(publish, /published=false/)
  assert.match(publish, /if:\s*steps\.probe\.outputs\.published == 'false'/)
  assert.match(publish, /if:\s*steps\.probe\.outputs\.published == 'true'/)
  assert.match(publish, /::notice::/)
  assert.match(publish, /npm publish/)
})

test('Publish 校验 tag 与 package.json 版本一致（tag 失败 / 手动发布仅警告）', () => {
  assert.match(publish, /fetch-depth:\s*0/) // 需要全量 tag
  assert.match(publish, /REF_TYPE/)
  assert.match(publish, /REF_NAME/)
  assert.match(publish, /v\$VERSION/)
  assert.match(publish, /::error::/)
  assert.match(publish, /::warning::/)
  assert.match(publish, /git tag --list 'v\*'/)
})

test('Publish 使用 environment 与不可取消的并发组', () => {
  assert.match(publish, /environment:\s*npm/)
  assert.match(publish, /concurrency:\s*\n\s*group:\s*publish-\$\{\{\s*github\.ref\s*\}\}/)
  assert.match(publish, /cancel-in-progress:\s*false/)
})

test('仓库统一声明 LF 行尾，避免 Windows 上的 CRLF checkout 让结构测试失败', async () => {
  // 结构测试用 "\n" 断言源码文本；Git for Windows 默认 core.autocrlf=true 会把
  // 工作区写成 CRLF，于是同一份代码在 Windows 上跑测试会红、在 Linux 上却是绿的。
  // .gitattributes 的 eol=lf 优先级高于 core.autocrlf，保证两个平台一致。
  const attrs = await read('.gitattributes')
  assert.match(attrs, /^\* text=auto eol=lf$/m)

  // 显式列出的扩展名即使有人改 core.autocrlf 也仍然是 LF。
  for (const ext of ['js', 'mjs', 'cjs', 'json', 'md', 'yml', 'yaml', 'css', 'html', 'svg']) {
    assert.match(attrs, new RegExp(`^\\*\\.${ext}\\s+text eol=lf$`, 'm'), `缺少 *.$ext 的 LF 规则`)
  }

  // 二进制资产不能被当成文本做行尾转换。
  for (const ext of ['png', 'jpg', 'jpeg', 'tgz']) {
    assert.match(attrs, new RegExp(`^\\*\\.${ext}\\s+binary$`, 'm'), `缺少 *.$ext 的 binary 标记`)
  }

  // vendor/ 下是真正随包分发的 JS：整体标成 binary 会让它失去 diff 与行尾归一。
  assert.doesNotMatch(attrs, /^vendor\/\*\*\s+binary$/m)
})
