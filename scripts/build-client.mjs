#!/usr/bin/env node
/**
 * Build the Client half artifact.
 *
 * DSH loads a plugin's `./client` export as ONE browser module in the
 * `window.__ModuleLoader__` format, so the authored sources under `src/client/`
 * must be bundled back into the single `client.js` file at the package root.
 * React is never bundled: the module table provides it through the factory's
 * `require`, and bundling a second copy would break hooks.
 *
 * The output is committed (packaging and the DSH loader read it directly) and is
 * verified in CI with `npm run build:client -- --check`, so a stale artifact
 * cannot be published.
 *
 * Usage:
 *   node scripts/build-client.mjs           # build in place
 *   node scripts/build-client.mjs --check   # exit 1 when client.js is stale
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// `root` is a filesystem path, so every child path must be joined with node:path:
// `new URL(relative, windowsPath)` throws ERR_INVALID_URL on Windows.
const root = fileURLToPath(new URL('../', import.meta.url))
const entry = join(root, 'src/client/index.js')
const output = join(root, 'client.js')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

if (!existsSync(entry)) {
  console.error('build:client: src/client/index.js is missing; the client half has not been migrated yet')
  process.exit(1)
}

const result = await build({
    // Absolute working directory + relative entry keeps the module-path comments
    // in the artifact relative, so the build is reproducible on any machine (an
    // absolute path in a committed artifact would leak local directories and make
    // --check fail on every other checkout).
    absWorkingDir: root,
    entryPoints: ['src/client/index.js'],
    bundle: true,
    // The ModuleLoader factory is a CommonJS-shaped scope: it hands us `require`
    // (the browser module table) and consumes whatever the factory returns.
    format: 'cjs',
    platform: 'browser',
    target: ['chrome120', 'edge120', 'firefox120', 'safari17'],
    external: ['react'],
    write: false,
    sourcemap: false,
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'warning',
  })

if (result.outputFiles.length !== 1) {
  console.error(`build:client: expected exactly one output file, got ${result.outputFiles.length}`)
  process.exit(1)
}

const body = result.outputFiles[0].text

// Failure modes this artifact must not have (the smoke test in
// test/client-artifact.test.mjs also executes the result):
//   - React bundled twice => hooks break;
//   - the dynamic Cesium import rewritten away => the globe never loads.
if (!/require\(["']react["']\)/.test(body)) {
  console.error('build:client: the bundle lost require("react"); React must stay external')
  process.exit(1)
}
if (!/import\(/.test(body)) {
  console.error('build:client: the bundle lost the dynamic import for the vendored Cesium build')
  process.exit(1)
}

const banner = `/**
 * Client half of the Digital Earth plugin.
 *
 * GENERATED FILE — do not edit. Author sources in src/client/, then run
 * \`npm run build:client\`. CI fails when this file is not the build output.
 */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
`
// The loader materializes a factory by taking whatever it returns, and some
// consumers treat a `__esModule`-marked object as { default }. Hand back a plain
// object that carries the named exports so both readings find `apply`.
const footer = `    if (module.exports && module.exports.__esModule) {
      var named = {};
      for (var key in module.exports) named[key] = module.exports[key];
      return named;
    }
    return module.exports;
  },
})
`
const artifact = banner + body + footer

if (process.argv.includes('--check')) {
  const current = await readFile(output, 'utf8').catch(() => null)
  if (current !== artifact) {
    console.error('build:client: client.js is out of date; run `npm run build:client`')
    process.exit(1)
  }
  console.log('build:client: client.js is up to date')
} else {
  await writeFile(output, artifact)
  console.log(`build:client: wrote client.js (${Buffer.byteLength(artifact)} bytes)`)
}
