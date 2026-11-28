import React from 'react'

const h = React.createElement
const modeLabels = { 'dsh-default': 'parse.mode.dsh-default', 'dsh-model': 'parse.mode.dsh-model', 'openai-compat': 'parse.mode.openai-compat' }

async function requestConfig(url, session, signal, config) {
  const headers = { 'x-dsh-panel': 'vision-config' }
  if (session) headers['x-dsh-session'] = session
  if (config) headers['content-type'] = 'application/json'
  const response = await fetch(url, { method: config ? 'PUT' : 'GET', headers,
    credentials: 'same-origin', signal, ...(config ? { body: JSON.stringify(config) } : {}) })
  if (!response.ok) throw Error('vision_config')
  const result = await response.json()
  if (!result.ok || !result.config) throw Error('vision_config')
  return result
}

export function ParseModelSettings({ t, url, sessionId, busy, actions }) {
  const [saved, setSaved] = React.useState(null)
  const [draft, setDraft] = React.useState(null)
  const [directory, setDirectory] = React.useState(null)
  const [error, setError] = React.useState(false)
  const [writing, setWriting] = React.useState(false)
  const [reload, setReload] = React.useState(0)
  const controller = React.useRef(null)
  React.useEffect(() => {
    const gate = new AbortController()
    controller.current = gate
    setSaved(null); setDraft(null); setDirectory(null); setError(false)
    requestConfig(url, sessionId, gate.signal).then(result => {
      if (!gate.signal.aborted) {
        setSaved(result); setDraft(result.config)
      }
    }).catch(() => { if (!gate.signal.aborted) setError(true) })
    return () => gate.abort()
  }, [url, sessionId, reload])

  const mode = draft?.mode
  React.useEffect(() => {
    if (mode !== 'dsh-model' || directory !== null) return
    const gate = new AbortController()
    fetch(url, { credentials: 'same-origin', headers: { 'x-dsh-panel': 'vision-model-directory' }, signal: gate.signal })
      .then(async response => {
        if (!response.ok) throw Error('model_directory')
        const result = await response.json()
        if (!gate.signal.aborted) setDirectory(result.directory ?? [])
      }).catch(() => { if (!gate.signal.aborted) setDirectory([]) })
    return () => gate.abort()
  }, [mode, directory, url])

  const status = error ? h('div', { role: 'alert', className: 'mv-parse-invalid' }, [
    t('parse.modelConfigError'), ' ',
    h('button', { key: 'retry', type: 'button', className: 'mv-parse-mini-btn',
      onClick: () => setReload(n => n+1), disabled: busy || writing }, t('parse.retry')),
  ]) : null
  if (!draft) return status || h('span', { role: 'status', className: 'mv-parse-note' }, t('parse.loadingModels'))

  const dsh = draft.dshModel, api = draft.openaiCompat
  const update = (key, value) => setDraft(old => ({ ...old, [key]: value }))
  const field = (label, input) => h('label', { key: label, className: 'mv-parse-model-field' }, [h('span', { key: 'label' }, t(label)), React.cloneElement(input, { 'aria-label': t(label) })])
  const select = (value, onChange, opts) => h('select', { key: 'input', className: 'mv-parse-select',
    value, onChange: e => onChange(e.target.value) }, opts)
  const option = (id, label) => h('option', { key: id, value: id }, label)
  const input = (value, onChange, type = 'text', placeholder) => h('input', { key: 'input', className: 'mv-parse-inline-input',
    value: value || '', type, placeholder, autoComplete: 'off', spellCheck: false, onChange: e => onChange(e.target.value) })

  const ds = draft.mode === 'dsh-model', external = draft.mode === 'openai-compat'
  const active = saved.probe?.model || saved.config[saved.config.mode === 'openai-compat' ? 'openaiCompat' : 'dshModel']?.model
  const fields = [
    h('legend', { key: 'legend' }, t('parse.modelTitle')),
    field('parse.modelSource', select(draft.mode, v => update('mode', v), Object.entries(modeLabels).map(([id, key]) => option(id, t(key))))),
  ]
  if (ds) {
    const groupsAvailable = directory ?? []
    const models = groupsAvailable.find(group => group.id === dsh.provider)?.models ?? []
    const setProvider = provider => update('dshModel', { provider, model: groupsAvailable.find(g => g.id === provider)?.models[0]?.id || '' })
    if (directory === null) {
      fields.push(h('span', { key:'catalog-loading', role:'status', className:'mv-parse-note' }, t('parse.loadingModels')))
    } else if (directory.length) {
      const groups = directory.map(g => option(g.id, g.name || g.id))
      if (!directory.some(g => g.id === dsh.provider)) groups.unshift(option(dsh.provider, dsh.provider || t('parse.chooseProvider')))
      fields.push(field('parse.modelProvider', select(dsh.provider, setProvider, groups)))
    } else fields.push(field('parse.modelProvider', input(dsh.provider, setProvider)))
    const setModel = model => update('dshModel', { ...dsh, model })
    if (directory !== null && models.length) {
      const options = models.map(m => option(m.id, m.name || m.id))
      if (!models.some(m => m.id === dsh.model)) options.unshift(option(dsh.model, dsh.model || t('parse.chooseModel')))
      fields.push(field('parse.modelId', select(dsh.model, setModel, options)))
    } else if (directory !== null) fields.push(field('parse.modelId', input(dsh.model, setModel)))
  }
  if (external) {
    const setApi = (key, value) => update('openaiCompat', { ...api, [key]: value })
    fields.push(field('parse.apiUrl', input(api.baseUrl, v => setApi('baseUrl', v), 'url', 'https://…/v1')),
      field('parse.modelId', input(api.model, v => setApi('model', v))),
      field('parse.apiKey', input(api.apiKey, v => setApi('apiKey', v), 'password',
        api.hasApiKey && api.baseUrl === saved.config.openaiCompat.baseUrl ? t('parse.keyKept') : t('parse.keyOptional'))))
  }

  async function save() {
    const gate = controller.current
    if (!gate || gate.signal.aborted || busy || writing) return
    setWriting(true); setError(false); actions?.setModelSaving?.(true)
    try {
      const result = await requestConfig(url, sessionId, gate.signal, draft)
      if (!gate.signal.aborted) { setSaved(result); setDraft(result.config) }
    } catch { if (!gate.signal.aborted) setError(true) }
    finally { if (!gate.signal.aborted) setWriting(false); actions?.setModelSaving?.(false) }
  }
  const valid = ds ? dsh.provider.trim() && dsh.model.trim() : !external || (/^https?:\/\//i.test(api.baseUrl) && api.model.trim())
  fields.push(h('div', { key: 'save', className: 'mv-parse-model-apply' }, [
    h('button', { key: 'apply', type: 'button', className: 'mv-parse-mini-btn', 'data-model-apply': '1',
      disabled: !valid || JSON.stringify(saved.config) === JSON.stringify(draft), onClick: save }, t('parse.applyModel')),
    h('span', { key: 'current', className: 'mv-parse-note', role: 'status' },
      saved.probe?.code === 'model_not_visual' ? t('parse.err.model_not_visual') : saved.probe?.ok === false ? t('parse.modelUnavailable') : t('parse.activeModel', { name: active || t('parse.mode.dsh-default') })),
  ]), status)
  return h('fieldset', { className: 'mv-parse-model', disabled: busy || writing }, fields)
}
