/**
 * v1.7 place-search UI: the settings tab and the rail panel.
 *
 * A provider is now a row with its own service URL and a detail form — the same
 * model as an imagery/terrain source — and users may add custom instances. These
 * tests mount both components against a fake host that applies the same PUT
 * payloads, so the rows, the form, the add/delete flow and the key handling are
 * pinned without a browser.
 *
 * The React stub has no renderer, so this file adds a tiny one: hooks persist by
 * index, a setter marks the tree dirty, and `useEffect` bodies run once and are
 * flushed before the next pass. `view.act(fn)` re-renders after an interaction.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

// The client modules import bare 'react'; map it to the stub, then load them.
register(new URL('./helpers/react-stub-loader.mjs', import.meta.url))
const React = (await import('./helpers/react-stub.mjs')).default
const { PlaceProvidersPanel } = await import('../src/client/ui/place-providers.js')
const { PlaceSearchPanel } = await import('../src/client/ui/place-search.js')

const TYPES = ['tianditu', 'amap', 'photon', 'nominatim']
const NEEDS_KEY = new Set(['tianditu', 'amap'])
const URLS = {
  tianditu: 'https://api.tianditu.gov.cn/v2/search',
  amap: 'https://restapi.amap.com/v3/place/text',
  photon: 'https://photon.komoot.io/api/',
  nominatim: 'https://nominatim.openstreetmap.org/search',
}
const DEFAULTS = { tianditu: true, amap: true, photon: false, nominatim: false }

/** The one translate function used by both components; keys stay visible. */
const t = (key, vars) => (vars ? `${key} ${Object.values(vars).join(' ')}` : key)

// --- a very small hook-aware renderer ---------------------------------------
const ctx = { index: 0, hooks: [], dirty: false, effects: [], ran: new Set(), tree: null }
React.useState = (init) => {
  const i = ctx.index++
  if (!(i in ctx.hooks)) ctx.hooks[i] = typeof init === 'function' ? init() : init
  const set = (value) => {
    const next = typeof value === 'function' ? value(ctx.hooks[i]) : value
    if (next === ctx.hooks[i]) return
    ctx.hooks[i] = next
    ctx.dirty = true
  }
  return [ctx.hooks[i], set]
}
React.useRef = (init) => {
  const i = ctx.index++
  if (!(i in ctx.hooks)) ctx.hooks[i] = { current: init }
  return ctx.hooks[i]
}
React.useEffect = (fn) => { ctx.effects.push([ctx.index++, fn]) }
React.useMemo = (fn) => fn()
React.useCallback = (fn) => fn()

async function mount(Component, props) {
  ctx.index = 0
  ctx.hooks = []
  ctx.ran = new Set()
  const rerender = async () => {
    for (let pass = 0; pass < 20; pass++) {
      ctx.index = 0
      ctx.dirty = false
      ctx.effects = []
      ctx.tree = Component(props)
      let flushed = false
      for (const [index, fn] of ctx.effects) {
        if (ctx.ran.has(index)) continue
        ctx.ran.add(index)
        fn()
        flushed = true
      }
      if (flushed) await new Promise((resolve) => setTimeout(resolve, 0))
      if (!ctx.dirty && !flushed) break
    }
    return ctx.tree
  }
  await rerender()
  return {
    get tree() { return ctx.tree },
    // Async handlers need one macrotask to settle before the next render pass.
    async act(fn) {
      const result = fn()
      if (result && typeof result.then === 'function') await result
      await new Promise((resolve) => setTimeout(resolve, 0))
      return rerender()
    },
  }
}

function findAll(node, match, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const child of node) findAll(child, match, out); return out }
  if (match(node)) out.push(node)
  findAll(node.children ?? node.props?.children, match, out)
  return out
}
const byClass = (tree, name) => findAll(tree, (node) => String(node.props?.className ?? '').split(/\s+/).includes(name))
const findOne = (tree, match) => findAll(tree, match)[0] ?? null
const button = (tree, label) => findOne(tree, (node) => node.type === 'button' && textOf(node).trim() === label)
function textOf(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  return textOf(node.children ?? node.props?.children)
}

/** Fake host route with the same PUT semantics as src/host/place-search.js. */
function fakeHost({ keys = {}, enabled = {}, urls = {}, provider } = {}) {
  const state = {
    selected: provider ?? '',
    providers: TYPES.map((type) => ({
      id: type,
      name: '',
      type,
      url: urls[type] ?? URLS[type],
      enabled: enabled[type] ?? DEFAULTS[type],
      key: keys[type] ?? '',
    })),
  }
  const calls = []
  const describe = () => {
    const on = state.providers.filter((entry) => entry.enabled)
    const defaultProvider = on.find((entry) => entry.id === state.selected)?.id ?? on.find((entry) => NEEDS_KEY.has(entry.type) && entry.key)?.id ?? on[0]?.id ?? ''
    return {
      version: 4,
      selected: state.selected,
      provider: defaultProvider,
      providers: state.providers.map((entry) => ({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        url: entry.url,
        enabled: entry.enabled,
        builtin: entry.id === entry.type,
        needsKey: NEEDS_KEY.has(entry.type),
        configured: Boolean(entry.key),
        managed: false,
      })),
    }
  }
  const reply = (data) => ({ ok: true, json: async () => data })
  const original = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ url, method: init.method, body })
    if (init.method === 'PUT') {
      if (Array.isArray(body?.providers)) {
        state.providers = body.providers.map((incoming) => {
          const previous = state.providers.find((entry) => entry.id === incoming.id)
          const key = incoming.key === undefined ? previous?.key ?? '' : incoming.key
          return { id: incoming.id, name: incoming.name, type: incoming.type, url: incoming.url, enabled: incoming.enabled !== false, key }
        })
      }
      if (body?.selected !== undefined) state.selected = body.selected
      if (body?.keys) {
        for (const [id, value] of Object.entries(body.keys)) {
          const entry = state.providers.find((item) => item.id === id)
          if (entry) entry.key = value
        }
      }
      return reply(describe())
    }
    if (init.method === 'POST') return reply({ results: [{ name: '武汉', detail: '湖北省', lon: 114.3, lat: 30.6 }] })
    return reply(describe())
  }
  return { state, calls, describe, restore: () => { globalThis.fetch = original } }
}

test('设置 → 地名检索：每行带服务地址与启用开关，内置与自定义可区分', async () => {
  const host = fakeHost()
  try {
    const view = await mount(PlaceProvidersPanel, { t, url: '/places', askConfirm: async () => true })
    const tree = view.tree
    const rows = byClass(tree, 'mv-provider')
    assert.equal(rows.length, 4, '四个内置服务商各一行')
    assert.deepEqual(byClass(tree, 'mv-switch').map((node) => node.props.checked), [true, true, false, false])
    const text = textOf(tree)
    assert.match(text, /https:\/\/api\.tianditu\.gov\.cn\/v2\/search/, '行内展示服务地址')
    assert.match(text, /https:\/\/photon\.komoot\.io\/api\//)
    assert.match(text, /settings\.places\.builtin/)
    // Only custom rows can be deleted.
    assert.equal(findAll(tree, (node) => node.props?.title === 'settings.places.delete').length, 0)
    assert.ok(button(tree, '+ settings.places.add'), '有添加入口')
    assert.equal(/国内|mainland China|海外/.test(text), false)
    assert.match(text, /settings\.places\.thirdParty/, '第三方服务声明必须出现')
  } finally { host.restore() }
})

test('地名检索详情表单：编辑内置服务商的服务地址，密钥不随列表回传', async () => {
  const host = fakeHost({ keys: { tianditu: 'secret-token' } })
  try {
    const view = await mount(PlaceProvidersPanel, { t, url: '/places', askConfirm: async () => true })
    const edit = findAll(view.tree, (node) => node.type === 'button' && node.props?.title === 'settings.places.edit')
    assert.equal(edit.length, 4)
    let tree = await view.act(() => edit[0].props.onClick())
    assert.equal(byClass(tree, 'mv-provider-form').length, 1, '编辑时该行展开为表单')
    const urlInput = findOne(tree, (node) => node.type === 'input' && node.props?.maxLength === 400)
    assert.equal(urlInput.props.value, URLS.tianditu)
    tree = await view.act(() => urlInput.props.onChange({ target: { value: 'https://proxy.lan/tdt/v2/search' } }))
    const save = findOne(tree, (node) => node.type === 'button' && String(node.props?.className ?? '').includes('primary'))
    tree = await view.act(() => save.props.onClick())
    const put = host.calls.filter((call) => call.method === 'PUT').at(-1)
    assert.equal(put.body.providers[0].url, 'https://proxy.lan/tdt/v2/search')
    assert.equal('key' in put.body.providers[0], false, '设置页从不接收或回传密钥')
    assert.equal(host.state.providers[0].key, 'secret-token', '宿主保留已存密钥')
    assert.equal(byClass(tree, 'mv-provider-form').length, 0, '保存后收起表单')
    assert.match(textOf(tree), /https:\/\/proxy\.lan\/tdt\/v2\/search/)
    // 内置行的类型不可改，避免把内置服务商改成别的适配器。
    assert.equal(findAll(view.tree, (node) => node.type === 'select').length, 0)
    const reopen = findAll(view.tree, (node) => node.type === 'button' && node.props?.title === 'settings.places.edit')[0]
    tree = await view.act(() => reopen.props.onClick())
    assert.equal(findOne(tree, (node) => node.type === 'select').props.disabled, true)
  } finally { host.restore() }
})

test('添加自定义服务商：选择适配器类型、填写地址与名称后写入宿主列表', async () => {
  const host = fakeHost()
  try {
    const view = await mount(PlaceProvidersPanel, { t, url: '/places', askConfirm: async () => true })
    let tree = await view.act(() => button(view.tree, '+ settings.places.add').props.onClick())
    assert.equal(byClass(tree, 'mv-provider-form').length, 1)
    // A new entry starts as a Photon instance pointed at the documented endpoint.
    const typeSelect = findOne(tree, (node) => node.type === 'select')
    assert.equal(typeSelect.props.value, 'photon')
    assert.deepEqual(findAll(typeSelect, (node) => node.type === 'option').map((node) => node.props.value), TYPES)
    const urlInput = findOne(tree, (node) => node.type === 'input' && node.props?.maxLength === 400)
    assert.equal(urlInput.props.value, URLS.photon)
    tree = await view.act(() => urlInput.props.onChange({ target: { value: 'https://geo.lan/photon/' } }))
    const nameInput = findOne(tree, (node) => node.type === 'input' && node.props?.maxLength === 120)
    tree = await view.act(() => nameInput.props.onChange({ target: { value: '内网 Photon' } }))
    const save = findOne(tree, (node) => node.type === 'button' && String(node.props?.className ?? '').includes('primary'))
    tree = await view.act(() => save.props.onClick())
    const put = host.calls.filter((call) => call.method === 'PUT').at(-1)
    const added = put.body.providers.at(-1)
    assert.equal(added.name, '内网 Photon')
    assert.equal(added.type, 'photon')
    assert.equal(added.url, 'https://geo.lan/photon/')
    assert.equal(added.enabled, true)
    assert.match(added.id, /^place-[a-z0-9]+$/, '自定义服务商使用生成的 id')
    assert.equal(byClass(tree, 'mv-provider').length, 5)
    assert.equal(findAll(tree, (node) => node.props?.title === 'settings.places.delete').length, 1, '只有自定义行可删除')
    // A custom entry without a name is refused before any request.
    const before = host.calls.length
    tree = await view.act(() => button(view.tree, '+ settings.places.add').props.onClick())
    const emptySave = findOne(tree, (node) => node.type === 'button' && String(node.props?.className ?? '').includes('primary'))
    tree = await view.act(() => emptySave.props.onClick())
    assert.equal(host.calls.length, before, '缺名称时不会发请求')
    assert.match(textOf(tree), /settings\.places\.customNeedsName/)
    // Switching the adapter resets the URL to that adapter's endpoint.
    const name2 = findOne(tree, (node) => node.type === 'input' && node.props?.maxLength === 120)
    tree = await view.act(() => name2.props.onChange({ target: { value: '镜像' } }))
    const select2 = findOne(tree, (node) => node.type === 'select')
    tree = await view.act(() => select2.props.onChange({ target: { value: 'nominatim' } }))
    assert.equal(findOne(tree, (node) => node.type === 'input' && node.props?.maxLength === 400).props.value, URLS.nominatim)
    assert.match(textOf(tree), /settings\.places\.note\.nominatim/)
  } finally { host.restore() }
})

test('删除自定义服务商需要确认，取消则不发送列表', async () => {
  const host = fakeHost()
  try {
    const asked = []
    const deny = async (options) => { asked.push(options); return false }
    const view = await mount(PlaceProvidersPanel, { t, url: '/places', askConfirm: deny })
    // Add one so there is something deletable.
    let tree = await view.act(() => button(view.tree, '+ settings.places.add').props.onClick())
    tree = await view.act(() => findOne(tree, (node) => node.type === 'input' && node.props?.maxLength === 120).props.onChange({ target: { value: '内网 Photon' } }))
    tree = await view.act(() => findOne(tree, (node) => String(node.props?.className ?? '').includes('primary')).props.onClick())
    const puts = host.calls.filter((call) => call.method === 'PUT').length
    const remove = findAll(tree, (node) => node.type === 'button' && node.props?.title === 'settings.places.delete')[0]
    await view.act(() => remove.props.onClick())
    assert.equal(asked.length, 1)
    assert.match(asked[0].message, /settings\.deleteConfirm/)
    assert.equal(asked[0].danger, true)
    assert.equal(host.calls.filter((call) => call.method === 'PUT').length, puts, '取消后不发请求')
    assert.equal(byClass(view.tree, 'mv-provider').length, 5)
  } finally { host.restore() }
})

test('地名检索面板：只列出已启用的服务，按 id 提供服务与归属', async () => {
  const host = fakeHost({ enabled: { tianditu: true, amap: false, photon: true, nominatim: false }, provider: 'photon' })
  try {
    const view = await mount(PlaceSearchPanel, { t, url: '/places', onFly: () => true })
    const options = findAll(view.tree, (node) => node.type === 'option')
    assert.deepEqual(options.map((node) => node.props.value), ['tianditu', 'photon'], '未启用的服务商不出现在面板里')
    assert.equal(byClass(view.tree, 'mv-places').length, 1, '面板正文使用 rail 面板样式而不是弹窗定位')
    assert.match(textOf(view.tree), /places\.attribution/)
    assert.equal(byClass(view.tree, 'mv-place').length, 0, '旧弹窗容器必须删除')
    // Choosing another provider persists the selection host-side.
    const select = findOne(view.tree, (node) => node.type === 'select')
    await view.act(() => select.props.onChange({ target: { value: 'tianditu' } }))
    assert.deepEqual(host.calls.filter((call) => call.method === 'PUT').at(-1).body, { selected: 'tianditu' })
  } finally { host.restore() }
})

test('地名检索面板：没有任何服务商启用时给出提示而不是发请求', async () => {
  const host = fakeHost({ enabled: { tianditu: false, amap: false, photon: false, nominatim: false } })
  try {
    const view = await mount(PlaceSearchPanel, { t, url: '/places', onFly: () => true })
    assert.match(textOf(view.tree), /places\.noneEnabled/)
    assert.equal(findAll(view.tree, (node) => node.type === 'option').length, 0)
    assert.equal(findOne(view.tree, (node) => node.type === 'input' && node.props?.type === 'search').props.disabled, true)
    assert.equal(host.calls.filter((call) => call.method === 'POST').length, 0)
  } finally { host.restore() }
})

test('设置三个 tab 都提供「启用」开关，地名检索 tab 支持增删改', async () => {
  const { readRepoFile } = await import('./helpers/source.mjs')
  const dialogs = readRepoFile('src/client/ui/dialogs.js')
  assert.equal((dialogs.match(/role: 'switch'/g) ?? []).length, 1, '影像底图/地形共用一行开关模板')
  assert.match(dialogs, /settings\.sourceEnable/, '开关必须有可读的无障碍名称')
  assert.match(dialogs, /h\(PlaceProvidersPanel, \{ t, url: meta\?\.placesUrl, askConfirm \}\)/, '地名检索 tab 复用服务商管理面板并传入删除确认')
  assert.match(dialogs, /'settings\.tab\.imagery'\], \['terrain', 'settings\.tab\.terrain'\], \['places'/, '三个 tab 顺序：影像底图、地形、地名检索')
  assert.equal(/className: `radio/.test(dialogs), false, '来源行不再使用单选圆点')
  const catalog = readRepoFile('src/client/ui/place-providers.js')
  assert.match(catalog, /export const PLACE_TYPES = Object\.freeze\(\['tianditu', 'amap', 'photon', 'nominatim'\]\)/)
  assert.match(catalog, /settings\.places\.urlLabel/, '每行详情表单都有服务地址字段')
  assert.match(catalog, /settings\.places\.add/, '可以添加自定义服务商')
})
