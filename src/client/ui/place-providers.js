/**
 * ui/place-providers.js — Settings → 地名检索: the place-search provider catalog
 * and its management tab.
 *
 * A provider is one configured instance of one adapter type, mirroring the
 * imagery/terrain source rows: name, service URL, optional key, an 启用 switch and
 * a detail form with 取消/保存. The four built-ins exist in every list; the user
 * can add further instances (a self-hosted Photon, a Nominatim mirror, a proxy)
 * and delete those. The host validates and stores the list in
 * `place-search.json` (0600); keys are written once and never read back, so the
 * tab keeps them out of the draft it sends.
 */
import React from 'react'
import { isChinese } from '../i18n.js'

const h = React.createElement

/** Adapter types the host implements; a provider entry is one instance of one. */
export const PLACE_TYPES = Object.freeze(['tianditu', 'amap', 'photon', 'nominatim'])

export const PLACE_TYPE_META = Object.freeze({
  tianditu: { needsKey: true, help: 'https://cloudcenter.tianditu.gov.cn/', url: 'https://api.tianditu.gov.cn/v2/search' },
  amap: { needsKey: true, help: 'https://console.amap.com/dev/key/app', url: 'https://restapi.amap.com/v3/place/text' },
  photon: { needsKey: false, osm: true, url: 'https://photon.komoot.io/api/' },
  nominatim: { needsKey: false, osm: true, policy: 'https://operations.osmfoundation.org/policies/nominatim/', url: 'https://nominatim.openstreetmap.org/search' },
})

export const placeTypeMeta = (type) => PLACE_TYPE_META[type] ?? PLACE_TYPE_META.photon

/** Entry of the current host config, by provider id. */
export const placeProvider = (config, id) => config?.providers?.find((entry) => entry.id === id) ?? null

/** Label for a provider entry (object) or a bare provider id. */
export function providerLabel(t, entry) {
  const item = typeof entry === 'string' ? { id: entry, type: entry, name: '' } : (entry ?? {})
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  return name || t(`places.provider.${item.type ?? item.id ?? 'photon'}`)
}

const isHttpUrl = (value) => /^https?:\/\/\S+$/i.test(String(value ?? '').trim())

/** One request against the host place route; throws the host's error code. */
export async function placeRequest(url, method, body, signal) {
  if (!url) throw new Error('provider')
  const response = await fetch(url, {
    method,
    signal,
    credentials: 'same-origin',
    headers: { 'x-dsh-panel': '1', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'provider')
  return data
}

/** Turn a host error code into one sentence that names the provider. */
export function placeErrorMessage(t, code, entry) {
  const name = providerLabel(t, entry)
  const key = {
    key: 'places.keyNeeded',
    denied: 'places.denied',
    rate: 'places.rate',
    rejected: 'places.rejected',
    input: 'places.rejected',
    disabled: 'places.disabled',
    camera: 'places.camera',
    provider: 'places.failed',
  }[code] ?? 'places.failed'
  return t(key, { name })
}

export function PlaceProvidersPanel({ t, url, askConfirm }) {
  const [config, setConfig] = React.useState(null)
  const [loadError, setLoadError] = React.useState('')
  // `editing` is { mode: 'edit' | 'add', builtin }; `form` holds the draft fields.
  const [editing, setEditing] = React.useState(null)
  const [form, setForm] = React.useState(null)
  const [busy, setBusy] = React.useState('')
  const [status, setStatus] = React.useState(null)
  const language = isChinese() ? 'zh' : 'en'
  const list = config?.providers ?? []

  React.useEffect(() => {
    const controller = new AbortController()
    placeRequest(url, 'GET', null, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setConfig(data) })
      .catch((err) => { if (!controller.signal.aborted) setLoadError(err.message) })
    return () => controller.abort()
  }, [url])

  /** Send the whole list; the host keeps stored keys for entries without a key field. */
  async function commit(nextList, id) {
    setBusy(id ?? 'list')
    setStatus(null)
    try {
      setConfig(await placeRequest(url, 'PUT', { providers: nextList }))
      if (id) setStatus({ kind: 'ok', text: t('settings.places.saved') })
      return true
    } catch (err) {
      setStatus({ kind: 'fail', text: placeErrorMessage(t, err.message, id) })
      return false
    } finally { setBusy('') }
  }

  const toggle = (entry, on) =>
    commit(list.map((item) => (item.id === entry.id ? { ...item, enabled: on } : item)), entry.id)

  function startEdit(entry) {
    setStatus(null)
    setEditing({ mode: 'edit', builtin: entry.builtin === true })
    setForm({ id: entry.id, name: entry.name, type: entry.type, url: entry.url, key: '', clearKey: false })
  }

  function startAdd() {
    const type = 'photon'
    setStatus(null)
    setEditing({ mode: 'add', builtin: false })
    setForm({ id: `place-${Date.now().toString(36)}`, name: '', type, url: placeTypeMeta(type).url, key: '', clearKey: false })
  }

  function cancelForm() {
    setEditing(null)
    setForm(null)
  }

  async function saveForm() {
    const name = form.name.trim()
    const meta = placeTypeMeta(form.type)
    if (!editing.builtin && !name) { setStatus({ kind: 'fail', text: t('settings.places.customNeedsName') }); return }
    if (!isHttpUrl(form.url)) { setStatus({ kind: 'fail', text: t('settings.places.badUrl') }); return }
    const previous = placeProvider(config, form.id)
    const entry = {
      id: form.id,
      name,
      type: form.type,
      url: form.url.trim(),
      enabled: previous?.enabled ?? true,
    }
    if (meta.needsKey && form.key.trim()) entry.key = form.key.trim()
    else if (meta.needsKey && form.clearKey) entry.key = ''
    const exists = list.some((item) => item.id === form.id)
    const nextList = exists
      ? list.map((item) => (item.id === form.id ? { ...item, ...entry } : item))
      : [...list, entry]
    if (await commit(nextList, form.id)) cancelForm()
  }

  async function remove(entry) {
    const accepted = await askConfirm?.({
      title: t('settings.confirmDeleteTitle'),
      message: t('settings.deleteConfirm', { name: providerLabel(t, entry) }),
      confirmLabel: t('btn.delete'),
      cancelLabel: t('btn.cancel'),
      danger: true,
    })
    if (accepted) await commit(list.filter((item) => item.id !== entry.id), '')
  }

  async function runTest(entry) {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
    setBusy(entry.id)
    setStatus({ kind: 'busy', text: t('settings.places.testing') })
    try {
      const data = await placeRequest(url, 'POST', { provider: entry.id, query: isChinese() ? '武汉' : 'Paris', language })
      const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started)
      setStatus({ kind: 'ok', text: t('settings.places.testOk', { n: data?.results?.length ?? 0, ms }) })
    } catch (err) {
      setStatus({ kind: 'fail', text: t('settings.places.testFail', { reason: placeErrorMessage(t, err.message, entry) }) })
    } finally { setBusy('') }
  }

  const link = (href, text) => h('a', { className: 'mv-place-link', href, target: '_blank', rel: 'noreferrer' }, text)
  const field = (label, input, hint) =>
    h('div', { className: 'mv-field' },
      h('label', null, label),
      input,
      hint ? h('small', { className: 'mv-field-hint' }, hint) : null)
  const change = (patch) => setForm((current) => ({ ...current, ...patch }))

  function formView() {
    const meta = placeTypeMeta(form.type)
    const previous = placeProvider(config, form.id)
    const managed = previous?.managed === true
    const keyState = managed
      ? t('settings.places.managed')
      : previous?.configured ? t('settings.places.configured') : t('settings.places.notConfigured')
    return h('div', { className: 'mv-provider-form', key: form.id },
      field(t('settings.places.nameLabel'),
        h('input', {
          type: 'text',
          maxLength: 120,
          value: form.name,
          placeholder: t(`places.provider.${form.type}`),
          onChange: (event) => change({ name: event.target.value }),
        }),
        editing.builtin ? t('settings.places.builtinNameHint') : null),
      field(t('settings.places.typeLabel'),
        h('select', {
          value: form.type,
          disabled: editing.builtin,
          onChange: (event) => {
            const type = event.target.value
            // Switching the adapter resets the URL to that adapter's documented endpoint.
            change({ type, url: placeTypeMeta(type).url, key: '', clearKey: false })
          },
        }, PLACE_TYPES.map((type) => h('option', { key: type, value: type }, t(`places.provider.${type}`)))),
        t(`settings.places.note.${form.type}`)),
      field(t('settings.places.urlLabel'),
        h('input', {
          type: 'text',
          maxLength: 400,
          spellCheck: false,
          value: form.url,
          placeholder: meta.url,
          onChange: (event) => change({ url: event.target.value }),
        }),
        t('settings.places.urlHint')),
      meta.needsKey && !managed
        ? h('div', { className: 'mv-field' },
            h('label', null, `${t('settings.places.keyLabel')} · ${keyState}`),
            h('input', {
              type: 'password',
              autoComplete: 'off',
              maxLength: 128,
              value: form.key,
              placeholder: previous?.configured ? '••••••••' : t('settings.places.keyLabel'),
              onChange: (event) => change({ key: event.target.value, clearKey: false }),
            }),
            h('div', { className: 'mv-provider-foot' },
              h('small', { className: 'mv-field-hint' }, t('settings.places.keyOptional')),
              form.clearKey ? h('small', { className: 'mv-provider-state danger' }, t('settings.places.keyWillClear')) : null,
              previous?.configured
                ? h('button', { type: 'button', className: 'mv-place-link', onClick: () => change({ key: '', clearKey: true }) }, t('settings.places.clearKey'))
                : null))
        : null,
      h('div', { className: 'mv-provider-foot' },
        meta.help ? link(meta.help, `${t('settings.places.getKey')} ↗`) : null,
        meta.policy ? link(meta.policy, t('places.policy')) : null,
        form.url.trim() !== meta.url
          ? h('button', { type: 'button', className: 'mv-place-link', onClick: () => change({ url: meta.url }) }, t('settings.places.restoreUrl'))
          : null),
      h('div', { className: 'mv-provider-actions' },
        h('button', { type: 'button', className: 'mv-cta', onClick: cancelForm }, t('btn.cancel')),
        h('button', { type: 'button', className: 'mv-cta primary', disabled: busy === form.id, onClick: () => void saveForm() }, t('btn.save'))))
  }

  function row(entry) {
    const meta = placeTypeMeta(entry.type)
    const on = entry.enabled === true
    const keyState = entry.managed
      ? t('settings.places.managed')
      : entry.needsKey ? (entry.configured ? t('settings.places.configured') : t('settings.places.notConfigured')) : t('settings.places.noKey')
    const testable = on && (!entry.needsKey || entry.configured)
    return h('div', { key: entry.id, className: `mv-src mv-provider${on ? ' on' : ''}` },
      h('input', {
        type: 'checkbox',
        role: 'switch',
        className: 'mv-switch',
        checked: on,
        disabled: busy === entry.id,
        'aria-label': t('settings.places.enableLabel', { name: providerLabel(t, entry) }),
        onChange: (event) => void toggle(entry, event.target.checked),
      }),
      h('div', { className: 'meta' },
        h('b', null, providerLabel(t, entry)),
        h('span', { title: entry.url }, entry.url),
        h('span', null, `${t(`places.provider.${entry.type}`)} · ${keyState}`)),
      h('span', { className: 'badge' }, entry.builtin ? t('settings.places.builtin') : t('settings.places.custom')),
      h('button', {
        type: 'button',
        className: 'mv-icon-btn',
        title: t('settings.places.test'),
        'aria-label': `${t('settings.places.test')} · ${providerLabel(t, entry)}`,
        disabled: !testable || busy === entry.id,
        onClick: () => void runTest(entry),
      }, '⟳'),
      h('button', {
        type: 'button',
        className: 'mv-icon-btn',
        title: t('settings.places.edit'),
        'aria-label': `${t('settings.places.edit')} · ${providerLabel(t, entry)}`,
        onClick: () => startEdit(entry),
      }, '✎'),
      entry.builtin
        ? null
        : h('button', {
            type: 'button',
            className: 'mv-icon-btn',
            title: t('settings.places.delete'),
            'aria-label': `${t('settings.places.delete')} · ${providerLabel(t, entry)}`,
            onClick: () => void remove(entry),
          }, '✕'))
  }

  if (!config) {
    return h('div', null, h('p', { className: 'mv-note' }, loadError ? placeErrorMessage(t, loadError, 'photon') : t('toast.loadingData')))
  }
  const statusLine = status
    ? h('p', { className: `mv-provider-state${status.kind === 'fail' ? ' danger' : ''}`, role: 'status' }, status.text)
    : null
  return h('div', { className: 'mv-providers' },
    h('p', { className: 'mv-note' }, t('settings.places.hint')),
    list.map((entry) => (editing?.mode === 'edit' && form && entry.id === form.id ? formView() : row(entry))),
    editing?.mode === 'add' && form
      ? formView()
      : h('button', { type: 'button', className: 'mv-cta mv-providers-add', onClick: startAdd, disabled: busy !== '' }, `+ ${t('settings.places.add')}`),
    statusLine,
    h('p', { className: 'mv-note' }, t('settings.places.defaultNote')),
    h('p', { className: 'mv-note mv-disclaimer' }, t('settings.places.thirdParty')))
}
