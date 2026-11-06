/**
 * A minimal browser/React harness that executes the built client bundle and does
 * one full render pass of the panel component tree.
 *
 * Why this exists: structural tests read source text and cannot catch runtime
 * errors that only happen on first render — a TDZ `const` referenced too early or
 * a factory used without its import both build cleanly and pass every unit test,
 * yet blank the whole panel. This harness caught exactly those two v1.6 bugs.
 *
 * It is intentionally a smoke test, not a DOM implementation: just enough React
 * (hooks as no-ops), DOM (elements, classList, attributes), and window stubs for
 * the component bodies to execute. Any exception propagates to the caller.
 */
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { repoRoot } from './source.mjs'

const bundle = () => readFileSync(`${repoRoot()}client.js`, 'utf8')

function fakeElement(tag) {
  const element = {
    tag,
    style: {},
    children: [],
    attributes: {},
    textContent: '',
    className: '',
    id: '',
    dataset: {},
    setAttribute(name, value) {
      element.attributes[name] = value
    },
    getAttribute(name) {
      return element.attributes[name] ?? null
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(element.attributes, name)
    },
    removeAttribute(name) {
      delete element.attributes[name]
    },
    classList: {
      _set: new Set(),
      add(...names) {
        for (const name of names) this._set.add(name)
      },
      remove(...names) {
        for (const name of names) this._set.delete(name)
      },
      contains(name) {
        return this._set.has(name)
      },
      toggle(name, force) {
        if (force === undefined) this._set.has(name) ? this._set.delete(name) : this._set.add(name)
        else if (force) this._set.add(name)
        else this._set.delete(name)
      },
    },
    appendChild(child) {
      element.children.push(child)
      return child
    },
    append(...items) {
      element.children.push(...items)
    },
    removeChild(child) {
      element.children = element.children.filter((item) => item !== child)
    },
    insertBefore(child) {
      return child
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
    closest: () => null,
    focus() {},
    click() {},
    cloneNode() {
      return fakeElement(tag)
    },
  }
  return element
}

function fakeDocument() {
  return {
    createElement: (tag) => fakeElement(tag),
    createElementNS: (_ns, tag) => fakeElement(tag),
    createTextNode: (text) => ({ textContent: text }),
    head: fakeElement('head'),
    body: fakeElement('body'),
    documentElement: fakeElement('html'),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    visibilityState: 'visible',
    readyState: 'complete',
    fullscreenElement: null,
    exitFullscreen: async () => {},
  }
}

function fakeReact() {
  return {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props ?? {}), children: children.length ? children : undefined },
    }),
    Fragment: Symbol('Fragment'),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useRef: (init) => ({ current: init }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    memo: (component) => component,
    forwardRef: (render) => render,
    createContext: (value) => ({ Provider: Symbol('Provider'), _value: value }),
    useContext: (context) => context?._value,
  }
}

/**
 * Execute the bundle, register the plugin into a fake Cordis context and render the
 * `main` panel component tree once.
 *
 * @returns {{ rendered: number }}
 */
export function renderPanelOnce() {
  const documentStub = fakeDocument()
  const localStorageStub = {
    _data: new Map(),
    getItem(key) {
      return this._data.has(key) ? this._data.get(key) : null
    },
    setItem(key, value) {
      this._data.set(key, String(value))
    },
    removeItem(key) {
      this._data.delete(key)
    },
  }
  const windowStub = {
    document: documentStub,
    localStorage: localStorageStub,
    location: { href: 'http://127.0.0.1/', origin: 'http://127.0.0.1', reload() {}, search: '' },
    navigator: { language: 'zh-CN', languages: ['zh-CN'], userAgent: 'node' },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    devicePixelRatio: 1,
    innerWidth: 1200,
    innerHeight: 800,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '', blob: async () => ({}) }),
    EventSource: class {
      addEventListener() {}
      removeEventListener() {}
      close() {}
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    performance: { now: () => Date.now() },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
    __ModuleLoader__: { load: (entry) => { windowStub.__entry = entry } },
  }
  windowStub.window = windowStub
  windowStub.globalThis = windowStub

  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage: localStorageStub,
    navigator: windowStub.navigator,
    location: windowStub.location,
    matchMedia: windowStub.matchMedia,
    devicePixelRatio: 1,
    requestAnimationFrame: windowStub.requestAnimationFrame,
    cancelAnimationFrame: windowStub.cancelAnimationFrame,
    fetch: windowStub.fetch,
    EventSource: windowStub.EventSource,
    ResizeObserver: windowStub.ResizeObserver,
    performance: windowStub.performance,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    Blob: class {},
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(bundle(), sandbox, { filename: 'client.js' })

  const entry = windowStub.__entry
  if (!entry) throw new Error('client.js did not register with window.__ModuleLoader__')
  const react = fakeReact()
  const exportsObject = entry.factory((id) => {
    if (id === 'react') return react
    throw new Error(`unexpected require(${id})`)
  })

  const components = []
  const fakeCtx = {
    effect: (fn) => (typeof fn === 'function' ? fn() : fn),
    inject: (deps, cb) => {
      if (Array.isArray(deps)) cb(fakeCtx)
    },
    locale: { register: () => {}, bind: () => (key) => key },
    slots: {
      inject: (name, cb) => {
        try {
          cb()
        } catch (error) {
          throw new Error(`slots.inject(${name}) threw: ${error.message}`)
        }
      },
      register: (options, component) => {
        components.push({ options, component })
        return { dispose() {} }
      },
    },
    sidebarRightTabs: { register: () => ({ dispose() {} }) },
    uiWorkspace: { register: () => ({ dispose() {} }) },
    theme: { register: () => ({ dispose() {} }) },
  }

  const plugin = exportsObject.default ?? exportsObject
  if (typeof plugin?.apply !== 'function') throw new Error('plugin.apply missing')
  plugin.apply(fakeCtx)

  const main = components.find((item) => item.options?.name === 'main')
  if (!main) throw new Error('main panel component not registered')

  const translate = (key) => key
  let rendered = 0
  const walk = (element, depth = 0) => {
    if (element === null || element === undefined || depth > 24) return
    if (Array.isArray(element)) {
      for (const child of element) walk(child, depth + 1)
      return
    }
    if (typeof element !== 'object') return
    const type = element.type
    if (typeof type === 'function') {
      rendered += 1
      walk(type(element.props ?? {}), depth + 1)
      return
    }
    if (element.props && element.props.children !== undefined) walk(element.props.children, depth + 1)
  }
  walk(main.component({ t: translate }))
  return { rendered }
}
