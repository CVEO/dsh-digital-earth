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
 * verified in CI with `git diff --exit-code client.js` after a fresh build, so a
 * stale artifact cannot be published.
 *
 * Usage:
 *   node scripts/build-client.mjs           # build in place
 *   node scripts/build-client.mjs --check   # exit 1 when client.js is stale
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = new URL('../', import.meta.url)
const entry = fileURLToPath(new URL('src/client/index.js', root))
const output = fileURLToPath(new URL('client.js', root))
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))

const result = await build({
  entryPoints: [entry],
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
const footer = `    return module.exports;
  },
})
`
const artifact = banner + result.outputFiles[0].text + footer

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
