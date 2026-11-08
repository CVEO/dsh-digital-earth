/**
 * v1.6 release readiness — `npm run release:check`.
 *
 * The publish workflow is tag-only (tag must equal v<package.json version> on
 * main). Before a tag exists, `scripts/release-check.mjs` verifies everything that
 * can be checked locally and MUST stay read-only: no publish, no tag, no push.
 * These assertions pin the script contract and the version single-source rules.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { readRepoFile } from './helpers/source.mjs'

const script = readRepoFile('scripts/release-check.mjs')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('release:check：npm script 已接线，且脚本是只读 dry-run', () => {
  assert.equal(pkg.scripts['release:check'], 'node scripts/release-check.mjs')
  // 绝不能自动发布会造成副作用的命令。
  assert.doesNotMatch(script, /npm publish|git tag|git push|npm version/i)
  assert.match(script, /Dry-run only: nothing was tagged, committed, pushed or published\./)
  assert.match(script, /Release target: v\$\{version\}/)
})

test('release:check：校验版本单源（package/README 徽章/About/CHANGELOG 顶部）', () => {
  assert.match(script, /CHANGELOG top heading is ## \$\{version\}/)
  assert.match(script, /README\.md badge shows \$\{version\}/)
  assert.match(script, /README\.en\.md badge shows \$\{version\}/)
  assert.match(script, /Host About version is \$\{version\}/)
  assert.match(script, /Client About version is \$\{version\}/)
  assert.match(script, /cveo-dsh-digital-earth-\$\{version\}\.tgz/)
})

test('release:check：跑产物可复现、架构预算与 npm pack dry-run', () => {
  assert.match(script, /scripts\/build-client\.mjs', '--check'/)
  assert.match(script, /scripts\/check-size\.mjs/)
  assert.match(script, /npm pack --dry-run --json/)
  for (const required of ['index.js', 'client.js', 'src/host', 'src/client', 'vendor/cesium', 'CHANGELOG.md']) {
    assert.ok(script.includes(`'${required}'`), `pack 校验缺少 ${required}`)
  }
  // Windows 下 npm 是 npm.cmd，必须走 shell；否则 ENOENT。
  assert.match(script, /process\.platform === 'win32'/)
})

test('release:check：当前版本保持 1.5.1，且 tag 目标即 v1.5.1', () => {
  assert.equal(pkg.version, '1.5.1')
  const changelog = readRepoFile('CHANGELOG.md')
  assert.ok(changelog.startsWith('# Changelog\n\n## 1.5.1\n'))
  assert.ok(readRepoFile('README.md').includes('版本-1.5.1-'))
  assert.ok(readRepoFile('src/host/about.js').includes("version: '1.5.1'"))
  assert.ok(readRepoFile('src/client/messages.js').includes("version: '1.5.1'"))
})
