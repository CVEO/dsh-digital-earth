/**
 * Artifact smoke test: the shipped `client.js` must register exactly one module
 * factory with the DSH module loader, and that factory must materialize into the
 * plugin shape the harness consumes (`{ inject, apply }`).
 *
 * This is the only test that executes the artifact rather than reading source
 * text, so it keeps working across the v2.0 split (monolith -> esbuild bundle)
 * and catches the two failure modes that a source-only test cannot:
 *   - a stale/empty artifact (build not run, or source moved but not rebuilt);
 *   - an entry-shape regression introduced by the bundler (default export,
 *     __esModule interop, factory returning undefined).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PACKAGE = '@cveo/dsh-digital-earth'

/** Minimal React stand-in: the factory only needs createElement at load time. */
const reactStub = {
  createElement: () => ({}),
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  Fragment: Symbol('Fragment'),
}

function materializeClient() {
  const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  const registrations = []
  const context = {
    window: { __ModuleLoader__: { load: (registration) => registrations.push(registration) } },
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => 0 },
    document: undefined,
    navigator: undefined,
    location: undefined,
  }
  vm.runInNewContext(code, context, { filename: 'client.js' })
  return { registrations, context }
}

test('产物冒烟：client.js 注册唯一一个模块工厂，id 与包名一致', () => {
  const { registrations } = materializeClient()
  assert.equal(registrations.length, 1, '必须恰好调用一次 __ModuleLoader__.load')
  const [registration] = registrations
  assert.equal(registration.id, PACKAGE)
  assert.equal(typeof registration.factory, 'function')
})

test('产物冒烟：工厂返回 { inject, apply }，apply 是函数（loader 直接消费该对象）', () => {
  const { registrations } = materializeClient()
  const require = (spec) => {
    if (spec === 'react') return reactStub
    throw new Error(`artifact smoke: unexpected require(${spec})`)
  }
  const exported = registrations[0].factory(require)
  assert.ok(exported !== null && typeof exported === 'object', '工厂必须返回模块导出对象')
  assert.equal(typeof exported.apply, 'function', '模块导出缺少 apply')
  assert.ok(Array.isArray(exported.inject), '模块导出缺少 inject 数组')
  // The esbuild CJS interop may add __esModule/default; the loader reads named
  // exports, so a `default` wrapper must still expose apply.
  if (exported.default !== undefined) {
    assert.equal(typeof exported.default.apply, 'function', 'default 导出缺少 apply')
  }
})

test('产物冒烟：不打包第二份 React（hooks 会因此失效）', () => {
  const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  // A bundled React would ship its own createElement/useState implementation.
  assert.doesNotMatch(code, /react\.development\.js|react\.production\.min\.js/)
  assert.doesNotMatch(code, /ReactCurrentDispatcher/)
  // The artifact must keep the module-table require for React.
  assert.match(code, /require\(["']react["']\)/)
})
