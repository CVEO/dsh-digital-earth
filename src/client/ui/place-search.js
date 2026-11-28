import React from 'react'
import { isChinese } from '../i18n.js'
import { placeErrorMessage, placeProvider, placeRequest, placeTypeMeta, providerLabel } from './place-providers.js'

const h = React.createElement
const pref = 'dsh-digital-earth.place-provider'

function preferred() {
  try { return localStorage.getItem(pref) || '' } catch { return '' }
}

function remember(id) {
  try { localStorage.setItem(pref, id) } catch { /* private mode */ }
}

/**
 * Place-search panel body (right rail destination "地名检索").
 *
 * The provider list lives on the host (`/places/<token>`), so every client sees
 * the same configuration and no key is ever mirrored into browser storage. Only
 * enabled providers are offered; the list is editable in 设置 → 地名检索
 * (each provider carries its own service URL and may be a custom instance). The
 * panel keeps the last selection for first paint only.
 */
export function PlaceSearchPanel({ t, url, onFly }) {
  const [config, setConfig] = React.useState(null)
  const [provider, setProvider] = React.useState(preferred)
  const [query, setQuery] = React.useState('')
  const [key, setKey] = React.useState('')
  const [editing, setEditing] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [results, setResults] = React.useState(null)
  const active = React.useRef(null)
  const enabled = (config?.providers ?? []).filter((entry) => entry.enabled)
  const usable = enabled.some((entry) => entry.id === provider) ? provider : (enabled[0]?.id ?? '')
  const entry = placeProvider(config, usable)
  const meta = placeTypeMeta(entry?.type)
  const configured = entry?.configured === true
  const managed = entry?.managed === true
  const keyField = Boolean(usable) && meta.needsKey && !managed && (editing || !configured)
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noreferrer' }, text)

  React.useEffect(() => () => active.current?.abort(), [])
  React.useEffect(() => {
    const controller = new AbortController()
    placeRequest(url, 'GET', null, controller.signal).then((data) => {
      if (controller.signal.aborted) return
      setConfig(data)
      const next = data.selected || data.provider
      if (next) { setProvider(next); remember(next) }
    }).catch(() => { if (!controller.signal.aborted) setError('provider') })
    return () => controller.abort()
  }, [url])

  // The Settings tab can switch a provider off while this panel is open.
  React.useEffect(() => {
    if (config && usable && usable !== provider) { setProvider(usable); remember(usable) }
  }, [config, usable, provider])

  function reset() {
    active.current?.abort()
    setResults(null)
    setBusy(false)
    setError('')
  }

  function changeProvider(event) {
    reset()
    const next = event.target.value
    setProvider(next)
    setEditing(false)
    setKey('')
    remember(next)
    // Persist the choice host-side so the Settings tab and other clients agree.
    void placeRequest(url, 'PUT', { selected: next }).then(setConfig).catch(() => {})
  }

  async function search(region) {
    reset()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    try {
      if (keyField && key.trim()) {
        setConfig(await placeRequest(url, 'PUT', { keys: { [usable]: key.trim() } }, controller.signal))
        if (controller.signal.aborted) return
        setEditing(false)
        setKey('')
      }
      const data = await placeRequest(url, 'POST', { provider: usable, query, region, language: isChinese() ? 'zh' : 'en' }, controller.signal)
      if (!controller.signal.aborted) setResults(data.results)
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message)
        if (err.message === 'key') setEditing(true)
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const status = !usable
    ? t('places.noneEnabled')
    : busy
      ? t('places.busy')
      : error ? placeErrorMessage(t, error, entry)
        : results?.length === 0 ? t('places.empty')
          : ''

  return h('div', { className: 'mv-places', 'aria-label': t('places.title') },
    h('form', { onSubmit: (event) => { event.preventDefault(); if (!busy && usable && query.trim()) void search() } },
      h('div', { className: 'mv-places-query' },
        h('input', { type: 'search', maxLength: 160, value: query, placeholder: t('places.placeholder'), 'aria-label': t('places.title'), disabled: !usable, onChange: (event) => { reset(); setQuery(event.target.value) } }),
        h('button', { type: 'submit', className: 'mv-places-submit', disabled: busy || !usable || !query.trim() || (keyField && !key.trim()) }, keyField ? t('places.saveSearch') : t('places.search'))),
      usable
        ? h('div', { className: 'mv-places-source' },
            h('label', null, t('places.source'), h('select', { value: usable, onChange: changeProvider }, enabled.map((item) => h('option', { key: item.id, value: item.id }, providerLabel(t, item))))),
            keyField ? null : configured && !managed && meta.needsKey
              ? h('button', { type: 'button', className: 'mv-place-link', onClick: () => { reset(); setEditing(!editing); setKey('') } }, editing ? t('btn.cancel') : t('places.changeKey'))
              : null)
        : null,
      keyField
        ? h('label', { className: 'mv-places-key' },
            h('span', { className: 'mv-places-key-head' },
              h('strong', null, `${providerLabel(t, entry)} · ${t('settings.places.keyLabel')}`),
              meta.help ? link(meta.help, `${t('settings.places.getKey')} ↗`) : null),
            h('input', { type: 'password', autoComplete: 'off', maxLength: 128, value: key, placeholder: managed ? t('settings.places.managed') : t('settings.places.keyLabel'), 'aria-label': `${providerLabel(t, entry)} · ${t('settings.places.keyLabel')}`, onChange: (event) => setKey(event.target.value) }))
        : null),
    h('div', { role: 'status', 'aria-live': 'polite', className: `mv-places-status${error ? ' is-error' : ''}` }, status),
    results?.length
      ? h('ul', null, results.map((row, i) => h('li', { key: i },
          // A result flies the camera and keeps the panel open, so several places
          // can be compared without reopening the search.
          h('button', { type: 'button', className: 'mv-places-row', onClick: () => { if (row.region) void search(row.region); else if (!onFly(row)) setError('camera') } },
            h('strong', null, row.name), h('span', null, row.region ? t('places.refine') : row.detail || [row.lon, row.lat].map((n) => n.toFixed(4)).join(', '))))))
      : null,
    meta.osm && usable
      ? h('footer', null,
          link('https://www.openstreetmap.org/copyright', t('places.attribution')),
          meta.policy ? link(meta.policy, t('places.policy')) : null)
      : null)
}
