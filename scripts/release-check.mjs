#!/usr/bin/env node
/**
 * scripts/release-check.mjs — local, READ-ONLY release dry-run.
 *
 * The publish workflow is tag-only and refuses a tag that does not equal
 * `v<package.json version>` on main. This script checks everything that can be
 * verified locally BEFORE a tag exists, and never publishes, tags or pushes:
 *
 *   1. version is a plain semver and the same in package.json / README badges /
 *      Host About / Client About / CHANGELOG top heading;
 *   2. client.js is reproducible (`build-client --check`);
 *   3. every authored file is inside the size budget;
 *   4. `npm pack --dry-run` includes the files the plugin needs at runtime and the
 *      packed package.json version matches;
 *   5. the git worktree is clean (warning only) and the intended tag is printed.
 *
 * Usage: npm run release:check
 * The version is intentionally held at 1.5.1; this script enforces whatever
 * package.json says instead of hard-coding a release number.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8')
const problems = []
const warnings = []
const ok = (condition, message) => {
  if (condition) console.log(`ok   ${message}`)
  else problems.push(message)
}
const warn = (condition, message) => {
  if (condition) console.log(`ok   ${message}`)
  else {
    warnings.push(message)
    console.log(`warn ${message}`)
  }
}

// ---- 1. version single source ---------------------------------------------
const pkg = JSON.parse(read('package.json'))
const version = pkg.version
ok(typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version), `package.json version is semver (${version})`)

const changelog = read('CHANGELOG.md')
ok(changelog.startsWith(`# Changelog\n\n## ${version}\n`), `CHANGELOG top heading is ## ${version}`)
ok(read('README.md').includes(`版本-${version}-`), `README.md badge shows ${version}`)
ok(read('README.en.md').includes(`version-${version}-`), `README.en.md badge shows ${version}`)
ok(read('src/host/about.js').includes(`version: '${version}'`), `Host About version is ${version}`)
ok(read('src/client/messages.js').includes(`version: '${version}'`), `Client About version is ${version}`)
ok(read('README.md').includes(`cveo-dsh-digital-earth-${version}.tgz`), `README install example uses the ${version} tarball`)

// ---- 2./3. artifact + architecture gates ----------------------------------
const run = (args) => execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' })
try {
  run(['scripts/build-client.mjs', '--check'])
  console.log('ok   client.js is reproducible from src/client')
} catch {
  problems.push('client.js is out of date (run npm run build:client)')
}
try {
  run(['scripts/check-size.mjs'])
  console.log('ok   authored files are inside the size budget')
} catch {
  problems.push('size guard failed')
}

// ---- 4. pack dry-run ------------------------------------------------------
let packed = null
try {
  // Windows needs the shell to resolve npm.cmd; POSIX runs npm directly.
  const raw =
    process.platform === 'win32'
      ? execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm pack --dry-run --json'], {
          cwd: ROOT,
          encoding: 'utf8',
        })
      : execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8' })
  const parsed = JSON.parse(raw)
  packed = Array.isArray(parsed) ? parsed[0] : parsed
} catch (error) {
  problems.push(`npm pack --dry-run failed: ${error?.message ?? error}`)
}
if (packed) {
  const files = Array.isArray(packed.files) ? packed.files.map((entry) => entry.path) : []
  const required = ['package.json', 'index.js', 'client.js', 'src/host', 'src/client', 'vendor/cesium', 'CHANGELOG.md']
  for (const prefix of required) {
    ok(files.some((file) => file === prefix || file.startsWith(`${prefix}/`)), `package contains ${prefix}`)
  }
  ok(packed.version === version, `packed version is ${version} (got ${packed.version})`)
  ok(packed.filename === `cveo-dsh-digital-earth-${version}.tgz`, `packed filename is cveo-dsh-digital-earth-${version}.tgz`)
}

// ---- 5. worktree + intended tag ------------------------------------------
try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()
  warn(dirty === '', dirty === '' ? 'git worktree is clean' : `git worktree has ${dirty.split('\n').length} uncommitted change(s)`)
} catch {
  warnings.push('git is not available; tag checks must be done manually')
}

console.log('')
console.log(`Release target: v${version}`)
console.log('Dry-run only: nothing was tagged, committed, pushed or published.')
console.log('Publish path (after main + CI): tag exactly v' + version + ' on main, then the tag-only workflow publishes.')
if (warnings.length > 0) console.log(`Warnings: ${warnings.length} (non-blocking)`)
if (problems.length > 0) {
  console.error(`\nFAILED: ${problems.length} blocking problem(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('release:check passed.')
