/**
 * 发布前的结构性自检。
 *
 * 这些断言只覆盖「包能不能被 DSH 正确安装」这件事，不测渲染逻辑：
 * 名字、入口、patch、files 白名单、许可证、以及宿主入口能否被 Node 加载。
 * 任何一条挂掉，发布出去的包都会出现「装得上但加载不了」或「加载了但没入口」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const patch = await readFile(join(root, pkg.dsh?.bundle?.patch ?? ''), 'utf8')

const exists = async (rel) => {
  try {
    await access(join(root, rel))
    return true
  } catch {
    return false
  }
}

test('包名是合法的小写 scoped 名', () => {
  assert.match(pkg.name, /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/)
})

test('版本号是 semver', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
})

test('以 ESM 发布', () => {
  assert.equal(pkg.type, 'module')
})

test('宿主与客户端两个入口都存在', async () => {
  const entry = typeof pkg.exports?.['.'] === 'string' ? pkg.exports['.'] : pkg.exports?.['.']?.default
  const client = typeof pkg.exports?.['./client'] === 'string' ? pkg.exports['./client'] : pkg.exports?.['./client']?.default
  assert.ok(entry, 'exports["."] 缺失')
  assert.ok(client, 'exports["./client"] 缺失')
  assert.ok(await exists(entry), `入口文件不存在：${entry}`)
  assert.ok(await exists(client), `客户端文件不存在：${client}`)
})

test('files 白名单覆盖全部运行期资源', () => {
  const files = new Set(pkg.files ?? [])
  for (const required of ['index.js', 'client.js', 'cordis.patch.yml', 'vendor/cesium']) {
    assert.ok(files.has(required), `files 缺少 ${required}，发布后会在运行期 404`)
  }
})

test('cordis.patch.yml 按包名引用本包', () => {
  const names = [...patch.matchAll(/^\s*name:\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map((m) => m[1])
  assert.ok(names.includes(pkg.name), `patch 里的 name 与包名不一致：${names.join(', ')}`)
})

test('bundle manifest 指向存在的 patch 文件', async () => {
  assert.ok(pkg.dsh?.bundle?.patch, '缺少 dsh.bundle.patch，dsh plugin add 不会激活任何层')
  assert.ok(await exists(pkg.dsh.bundle.patch))
})

test('客户端声明了 web 平台与注入服务', () => {
  assert.equal(pkg.dsh?.client?.platform, 'web')
  assert.ok(Array.isArray(pkg.dsh?.client?.inject) && pkg.dsh.client.inject.length > 0)
})

test('声明了 dsh 版本范围', () => {
  assert.ok(pkg.engines?.dsh, '缺少 engines.dsh，装到不兼容宿主上会直接崩')
  assert.match(pkg.engines.dsh, /^[><=^~]/)
})

test('发布配置为公开，且仓库地址是 https 形式', () => {
  assert.equal(pkg.publishConfig?.access, 'public')
  assert.match(pkg.repository?.url ?? '', /^git\+https:\/\/|^https:\/\//)
})

test('许可证文件与声明一致', async () => {
  assert.equal(pkg.license, 'MIT')
  const license = await readFile(join(root, 'LICENSE'), 'utf8')
  assert.match(license, /MIT License/)
})

test('NOTICE 覆盖随包分发的 CesiumJS', async () => {
  const notice = await readFile(join(root, 'NOTICE'), 'utf8')
  assert.match(notice, /CesiumJS/)
  assert.match(notice, /Apache/i)
})

test('商店卡片元信息齐全（icon + 双语 locale）', async () => {
  // 市场卡片的标题/简介取自 locale，图标取自 package.json 的顶层 icon 字段；
  // 缺 icon 时卡片会退化成默认占位图。
  assert.equal(pkg.icon, './icon.svg')
  assert.ok((pkg.files ?? []).includes('icon.svg'), 'files 缺少 icon.svg，安装后图标 404')
  for (const lang of ['zh', 'en']) {
    const meta = JSON.parse(await readFile(join(root, `locale/${lang}.json`), 'utf8'))
    assert.ok(meta.meta?.title, `locale/${lang}.json 缺少 meta.title`)
    assert.ok(meta.meta?.description, `locale/${lang}.json 缺少 meta.description`)
  }
})

test('宿主入口可被 Node 加载并导出 apply', async () => {
  const mod = await import(pathToFileURL(join(root, 'index.js')).href)
  assert.equal(typeof mod.apply, 'function')
  assert.ok(Array.isArray(mod.inject), 'inject 必须是数组，否则依赖注入顺序不保证')
})

test('客户端入口走 DSH 模块加载器', async () => {
  const client = await readFile(join(root, 'client.js'), 'utf8')
  assert.match(client, /__ModuleLoader__\.load\(/)
})
