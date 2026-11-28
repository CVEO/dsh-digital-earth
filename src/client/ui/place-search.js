import React from 'react'
import { isChinese } from '../i18n.js'
import { useEscapeLayer } from './escape-stack.js'

const h = React.createElement
const providers = ['tianditu', 'osm']
const pref = 'dsh-digital-earth.place-provider'
const policy = 'https://operations.osmfoundation.org/policies/nominatim/'

function preferred() {
  try { return localStorage.getItem(pref) === 'osm' ? 'osm' : 'tianditu' }
  catch { return 'tianditu' }
}

async function request(url, method, body, signal) {
  if (!url) throw new Error('provider')
  const response = await fetch(url, {
    method, signal, credentials: 'same-origin',
    headers: { 'x-dsh-panel': '1', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'provider')
  return data
}

export function PlaceSearch({ t, url, onFly, onClose }) {
  const [provider, setProvider] = React.useState(preferred)
  const [query, setQuery] = React.useState('')
  const [key, setKey] = React.useState('')
  const [config, setConfig] = React.useState(null)
  const [editing, setEditing] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [results, setResults] = React.useState(null)
  const active = React.useRef(null)
  const input = React.useRef(null)
  const keyField = provider === 'tianditu' && (editing || config?.configured === false)
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noreferrer' }, text)
  const messages = { rejected: t('places.rejected'), key: t('places.keyNeeded'), denied: t('places.denied'), rate: t('places.rate'), camera: t('places.camera'), provider: t('places.failed') }
  useEscapeLayer(() => { onClose(); return true })
  React.useEffect(() => {
    input.current?.focus()
    return () => active.current?.abort()
  }, [])
  React.useEffect(() => {
    if (provider !== 'tianditu') return
    const controller = new AbortController()
    request(url, 'GET', null, controller.signal).then(data => {
      if (!controller.signal.aborted) setConfig(data)
    }).catch(() => { if (!controller.signal.aborted) setError('provider') })
    return () => controller.abort()
  }, [url, provider])

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
    try { localStorage.setItem(pref, next) } catch {}
  }
  async function search(region) {
    reset()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    try {
      if (keyField && key.trim()) {
        await request(url, 'PUT', { token: key.trim() }, controller.signal)
        if (controller.signal.aborted) return
        setConfig({ configured: true, managed: false })
        setEditing(false)
        setKey('')
      }
      const data = await request(url, 'POST', { provider, query, region, language: isChinese() ? 'zh' : 'en' }, controller.signal)
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
  return h('section', { className: 'mv-place mv-glass', 'aria-label': t('places.title') },
    h('header', null, h('strong', null, t('places.title')), h('button', { type: 'button', className: 'mv-icon-btn', 'aria-label': t('btn.close'), onClick: onClose }, '×')),
    h('form', { onSubmit: event => { event.preventDefault(); if (!busy && query.trim()) void search() } },
      h('div', { className: 'mv-place-query' },
        h('input', { ref: input, type: 'search', maxLength: 160, value: query, placeholder: t('places.placeholder'), 'aria-label': t('places.title'), onChange: event => { reset(); setQuery(event.target.value) } }),
        h('button', { type: 'submit', className: 'mv-place-submit', disabled: busy || !query.trim() || (keyField && !key.trim()) }, keyField ? t('places.saveSearch') : t('places.search'))),
      h('div', { className: 'mv-place-source' },
        h('label', null, t('places.source'), h('select', { value: provider, onChange: changeProvider }, providers.map(id => h('option', { key: id, value: id }, id === 'osm' ? 'OpenStreetMap' : t('places.tdt'))))),
        provider === 'tianditu' && config?.configured && !config.managed ? h('button', { type: 'button', className: 'mv-place-link', onClick: () => { reset(); setEditing(!editing); setKey('') } }, editing ? t('btn.cancel') : t('places.changeKey')) : null),
      keyField ? h('label', { className: 'mv-place-key' }, h('span', null, t('places.token'), ' · ', link('https://console.tianditu.gov.cn/', t('places.apply'))),
        h('input', { type: 'password', autoComplete: 'off', maxLength: 128, value: key, onChange: event => setKey(event.target.value) })) : null),
    h('div', { role: 'status', 'aria-live': 'polite', className: 'mv-place-status' }, busy ? t('places.busy') : error ? messages[error] || messages.provider : results?.length === 0 ? t('places.empty') : ''),
    results?.length ? h('ul', null, results.map((row, i) => h('li', { key: i },
      h('button', { type: 'button', className: 'mv-place-row', onClick: () => { if (row.region) void search(row.region); else if (onFly(row)) onClose(); else setError('camera') } },
        h('strong', null, row.name), h('span', null, row.region ? t('places.refine') : row.detail || [row.lon, row.lat].map(n => n.toFixed(4)).join(', ')))))) : null,
    provider === 'osm' ? h('footer', null, link('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors'), link(policy, t('places.policy'))) : null)
}
