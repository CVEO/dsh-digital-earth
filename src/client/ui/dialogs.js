/**
 * ui/dialogs.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { clone } from '../format.js'
import { FALLBACK_ABOUT } from '../messages.js'
import { readAutoOpen, writeAutoOpen } from '../preferences.js'

const h = React.createElement

    //#region sources dialog ---------------------------------------------------

    const SOURCE_TYPES = {
      imagery: ['xyz', 'arcgis', 'wms'],
      terrain: ['arcgis', 'cesium'],
    }
    const SOURCE_TYPE_KEY = {
      xyz: 'settings.type.xyz',
      arcgis: 'settings.type.arcgis',
      wms: 'settings.type.wms',
      cesium: 'settings.type.cesium',
    }

    const emptySource = (kind) => ({
      id: `${kind}-${Date.now().toString(36)}`,
      name: '',
      type: SOURCE_TYPES[kind][0],
      url: '',
      credit: '',
    })

    function SourceForm({ kind, source, onPickLocal, onChange, onCancel, t }) {
      const set = (patch) => onChange({ ...source, ...patch })
      const field = (label, input) => h('div', { className: 'mv-field' }, h('label', null, label), input)
      const pickTiles = async () => {
        if (typeof onPickLocal !== 'function') return
        const url = await onPickLocal()
        if (url) set({ type: 'xyz', url, maximumLevel: source.maximumLevel ?? 18 })
      }
      const text = (key, value, placeholder) =>
        h('input', {
          key,
          value: value ?? '',
          placeholder: placeholder ?? '',
          onChange: (event) => set({ [key]: event.target.value }),
        })
      return h(
        'div',
        { className: 'mv-form' },
        h(
          'div',
          { className: 'grid' },
          field(t('settings.field.name'), text('name')),
          field(
            t('settings.field.type'),
            h(
              'select',
              { value: source.type, onChange: (event) => set({ type: event.target.value }) },
              SOURCE_TYPES[kind].map((type) => h('option', { key: type, value: type }, t(SOURCE_TYPE_KEY[type]))),
            ),
          ),
        ),
        field(t('settings.field.url'), text('url', source.url, kind === 'imagery' ? 'https://…/{z}/{x}/{y}.png' : 'https://…')),
        field(t('settings.field.credit'), text('credit', source.credit)),
        kind === 'imagery' && source.type === 'xyz'
          ? h(
              'div',
              { className: 'grid' },
              field(
                t('settings.field.maxLevel'),
                h('input', {
                  type: 'number',
                  min: 0,
                  max: 25,
                  value: source.maximumLevel ?? '',
                  onChange: (event) =>
                    set({ maximumLevel: event.target.value === '' ? undefined : Number(event.target.value) }),
                }),
              ),
              field(
                t('settings.field.tilingScheme'),
                h(
                  'select',
                  {
                    value: source.tilingScheme ?? 'web-mercator',
                    onChange: (event) => set({ tilingScheme: event.target.value }),
                  },
                  h('option', { value: 'web-mercator' }, t('settings.tiling.webMercator')),
                  h('option', { value: 'geographic' }, t('settings.tiling.geographic')),
                ),
              ),
              field(
                t('settings.field.subdomains'),
                h('input', {
                  value: (source.subdomains ?? []).join(','),
                  onChange: (event) =>
                    set({
                      subdomains: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter((item) => item !== ''),
                    }),
                }),
              ),
            )
          : null,
        kind === 'imagery' && source.type === 'xyz'
          ? h(
              'div',
              { className: 'grid' },
              h(
                'div',
                { className: 'mv-field check' },
                h('input', {
                  id: 'mv-reverse-y',
                  type: 'checkbox',
                  checked: source.reverseY === true,
                  onChange: (event) => set({ reverseY: event.target.checked }),
                }),
                h('label', { htmlFor: 'mv-reverse-y' }, t('settings.field.tms')),
              ),
              h(
                'div',
                { className: 'mv-field' },
                h(
                  'button',
                  { type: 'button', className: 'mv-cta', onClick: pickTiles },
                  t('settings.field.localTiles'),
                ),
              ),
            )
          : null,
        kind === 'imagery' && source.type === 'wms'
          ? field(t('settings.field.layers'), text('layers', source.layers))
          : null,
        kind === 'terrain'
          ? h(
              'div',
              { className: 'grid' },
              h(
                'div',
                { className: 'mv-field check' },
                h('input', {
                  id: 'mv-normals',
                  type: 'checkbox',
                  checked: source.requestVertexNormals === true,
                  onChange: (event) => set({ requestVertexNormals: event.target.checked }),
                }),
                h('label', { htmlFor: 'mv-normals' }, t('settings.field.normals')),
              ),
              h(
                'div',
                { className: 'mv-field check' },
                h('input', {
                  id: 'mv-water',
                  type: 'checkbox',
                  checked: source.requestWaterMask === true,
                  onChange: (event) => set({ requestWaterMask: event.target.checked }),
                }),
                h('label', { htmlFor: 'mv-water' }, t('settings.field.waterMask')),
              ),
            )
          : null,
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
          h('button', { type: 'button', className: 'mv-cta', onClick: onCancel }, t('btn.cancel')),
        ),
      )
    }

    function SourcesDialog({ config, defaults, environmentDark, themeMode, onPickLocal, onSave, onClose, messages, meta, bridgeOn, bridgeReload }) {
      const t = messages
      const [draft, setDraft] = React.useState(() => clone(config))
      const [tab, setTab] = React.useState('imagery')
      const [editing, setEditing] = React.useState(null)
      // Local form-row helper: `field` is also defined inside SourceForm, but the
      // Appearance tab renders one here, outside that component's scope.
      const field = (label, input) =>
        h('div', { className: 'mv-field' }, h('label', null, label), input)
      // Auto-open is a browser preference, not part of the Host source catalog, so
      // it stays outside `draft` and applies the moment the checkbox changes.
      const [autoOpen, setAutoOpen] = React.useState(readAutoOpen)
      const activeId = (kind) => (kind === 'imagery' ? draft.settings.imagery : draft.settings.terrain)

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          onClose()
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [onClose])

      const setSources = (kind, list) => setDraft((current) => ({ ...current, [kind]: list }))
      const selectSource = (kind, id) =>
        setDraft((current) => ({
          ...current,
          settings: { ...current.settings, [kind]: id },
        }))
      const addSource = (kind) => {
        const source = emptySource(kind)
        setSources(kind, [...draft[kind], source])
        setEditing({ kind, id: source.id })
      }
      const removeSource = (kind, id) => {
        setSources(
          kind,
          draft[kind].filter((item) => item.id !== id),
        )
        if (draft.settings[kind] === id) selectSource(kind, null)
        if (editing?.id === id) setEditing(null)
      }
      const updateSource = (kind, source) =>
        setSources(
          kind,
          draft[kind].map((item) => (item.id === source.id ? source : item)),
        )
      const save = () => {
        for (const kind of ['imagery', 'terrain']) {
          if (draft[kind].some((source) => source.name.trim() === '' || source.url.trim() === '')) {
            window.alert(t('settings.required'))
            return
          }
        }
        onSave(draft)
      }
      const restore = () => {
        if (!window.confirm(t('settings.restoreConfirm'))) return
        setDraft(clone(defaults))
        setEditing(null)
      }
      const segments = [
        ['auto', 'theme.auto'],
        ['light', 'theme.light'],
        ['dark', 'theme.dark'],
      ]
      const rowsFor = (kind) =>
        draft[kind].map((source) =>
          editing?.kind === kind && editing.id === source.id
            ? h(SourceForm, {
                key: source.id,
                kind,
                source,
                t,
                onPickLocal,
                onChange: (next) => updateSource(kind, next),
                onCancel: () => setEditing(null),
              })
            : h(
                'div',
                { key: source.id, className: 'mv-src' },
                h('span', {
                  className: `radio${activeId(kind) === source.id ? ' on' : ''}`,
                  role: 'radio',
                  'aria-checked': activeId(kind) === source.id,
                  tabIndex: 0,
                  onClick: () => selectSource(kind, activeId(kind) === source.id ? null : source.id),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') selectSource(kind, source.id)
                  },
                }),
                h(
                  'div',
                  { className: 'meta' },
                  h('b', null, source.name),
                  h('span', null, source.url),
                ),
                h('span', { className: 'badge' }, t(SOURCE_TYPE_KEY[source.type] ?? source.type)),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mv-icon-btn',
                    title: t('btn.edit'),
                    onClick: () => setEditing({ kind, id: source.id }),
                  },
                  '✎',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mv-icon-btn',
                    title: t('btn.delete'),
                    onClick: () => {
                      if (window.confirm(t('settings.deleteConfirm', { name: source.name }))) removeSource(kind, source.id)
                    },
                  },
                  '✕',
                ),
              ),
        )

      const appearance = h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('p', { className: 'mv-note' }, t('theme.appearanceHint')),
        h(
          'div',
          { className: 'mv-seg', role: 'radiogroup' },
          segments.map(([value, key]) =>
            h(
              'button',
              {
                key: value,
                type: 'button',
                className: themeMode === value ? 'on' : '',
                role: 'radio',
                'aria-checked': themeMode === value,
                onClick: () => setDraft((current) => ({ ...current, settings: { ...current.settings, theme: value } })),
              },
              t(key),
            ),
          ),
        ),
        h('p', { className: 'mv-note' }, `${t('theme.auto')} · ${environmentDark ? t('theme.dark') : t('theme.light')}`),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.autoOpenPanel')),
            h('span', null, t('settings.autoOpenPanelHint')),
          ),
          h('input', {
            type: 'checkbox',
            checked: autoOpen,
            onChange: (event) => {
              setAutoOpen(event.target.checked)
              writeAutoOpen(event.target.checked)
            },
          }),
        ),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.screenshotHud')),
            h('span', null, t('settings.screenshotHudHint')),
          ),
          h('input', {
            type: 'checkbox',
            checked: draft.settings.screenshotHud === true,
            onChange: (event) =>
              setDraft((current) => ({
                ...current,
                settings: { ...current.settings, screenshotHud: event.target.checked },
              })),
          }),
        ),
        field(
          t('settings.quality'),
          h(
            'select',
            {
              value: draft.settings.quality === 'high' ? 'high' : 'balanced',
              onChange: (event) =>
                setDraft((current) => ({
                  ...current,
                  settings: { ...current.settings, quality: event.target.value },
                })),
            },
            h('option', { value: 'balanced' }, t('settings.qualityBalanced')),
            h('option', { value: 'high' }, t('settings.qualityHigh')),
          ),
        ),
        h('p', { className: 'mv-note' }, t('settings.qualityHint')),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.terrainDepthTest')),
            h('span', null, t('settings.terrainDepthTestHint')),
          ),
          h('input', {
            type: 'checkbox',
            // Missing/false = off: underground content stays visible, matching the
            // Cesium default and the documented behaviour before v1.5.
            checked: draft.settings.terrainDepthTest === true,
            onChange: (event) =>
              setDraft((current) => ({
                ...current,
                settings: { ...current.settings, terrainDepthTest: event.target.checked },
              })),
          }),
        ),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.showLayers')),
            h('span', null, t('settings.showLayersHint')),
          ),
          h('input', {
            type: 'checkbox',
            checked: draft.settings.showLayers !== false,
            onChange: (event) =>
              setDraft((current) => ({
                ...current,
                settings: { ...current.settings, showLayers: event.target.checked },
              })),
          }),
        ),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.showHud')),
            h('span', null, t('settings.showHudHint')),
          ),
          h('input', {
            type: 'checkbox',
            checked: draft.settings.showHud !== false,
            onChange: (event) =>
              setDraft((current) => ({
                ...current,
                settings: { ...current.settings, showHud: event.target.checked },
              })),
          }),
        ),
      )

      const homepage = meta?.homepage ?? FALLBACK_ABOUT.homepage
      // Prefer the Host's issues URL; older hosts only send homepage, whose
      // conventional sibling is /issues, so both paths stay useful.
      const issuesUrl = meta?.issues ?? `${String(homepage).replace(/\/+$/, '')}/issues`
      const teamUrl = meta?.team?.url ?? FALLBACK_ABOUT.teamUrl
      const about = h(
        'div',
        { className: 'mv-about' },
        h('p', { className: 'intro' }, t('about.intro')),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.version')),
          h('span', null, meta?.version ?? FALLBACK_ABOUT.version),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.homepage')),
          h('a', { href: homepage, target: '_blank', rel: 'noopener noreferrer' }, homepage),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.issues')),
          h('a', { href: issuesUrl, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub Issues'),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.team')),
          h(
            'div',
            { className: 'team' },
            h('a', { href: teamUrl, target: '_blank', rel: 'noopener noreferrer' }, meta?.team?.name ?? t('about.teamName')),
            h('small', null, teamUrl),
          ),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.agent')),
          h('span', null, bridgeReload ? t('about.agent.stale') : bridgeOn ? t('about.agent.on') : t('about.agent.off')),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.licenseLabel')),
          h('span', null, t('about.license')),
        ),
      )

      return h(
        'div',
        { className: 'mv-modal', onPointerDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'mv-dialog', role: 'dialog', 'aria-modal': true },
          h(
            'header',
            null,
            h('b', null, t('settings.title')),
            h('button', { type: 'button', className: 'mv-icon-btn', onClick: onClose, title: t('btn.close') }, '✕'),
          ),
          h(
            'div',
            { className: 'mv-tabs' },
            [['imagery', 'settings.tab.imagery'], ['terrain', 'settings.tab.terrain'], ['appearance', 'settings.tab.appearance'], ['about', 'settings.tab.about']].map(
              ([value, key]) =>
                h(
                  'button',
                  {
                    key: value,
                    type: 'button',
                    className: `mv-tab${tab === value ? ' on' : ''}`,
                    onClick: () => setTab(value),
                  },
                  t(key),
                ),
            ),
          ),
          h(
            'div',
            { className: 'body' },
            tab === 'about'
              ? about
              : tab === 'appearance'
                ? appearance
                : h(
                    React.Fragment,
                    null,
                    h('p', { className: 'mv-note' }, t(tab === 'imagery' ? 'settings.imageryHint' : 'settings.terrainHint')),
                    rowsFor(tab),
                    draft[tab].length === 0 && editing === null
                      ? h('p', { className: 'mv-note' }, t('settings.empty'))
                      : null,
                    h(
                      'div',
                      { style: { display: 'flex', justifyContent: 'flex-start' } },
                      h('button', { type: 'button', className: 'mv-cta', onClick: () => addSource(tab) }, `+ ${t('btn.add')}`),
                    ),
                  ),
          ),
          h(
            'div',
            { className: 'footer' },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 } },
              h('button', { type: 'button', className: 'mv-cta', onClick: restore }, t('btn.restore')),
            ),
            h(
              'div',
              { className: 'right' },
              h('button', { type: 'button', className: 'mv-cta', onClick: onClose }, t('btn.cancel')),
              h('button', { type: 'button', className: 'mv-cta primary', onClick: save }, t('btn.save')),
            ),
          ),
        ),
      )
    }
    //#endregion sources dialog

    //#region data health dialog ----------------------------------------------

    /**
     * Read-only report dialog for the Host data-health inspector. The panel
     * never analyses tilesets itself: it posts the layer source and renders
     * whatever the Host returns.
     */
    function HealthDialog({ state, messages: t, onClose, onCopy }) {
      const report = state?.report ?? null
      const issues = Array.isArray(report?.issues) ? report.issues : []
      const extensions = Array.isArray(report?.counts?.extensionsUsed) ? report.counts.extensionsUsed : []
      const kind = report?.source?.kind === 'remote' ? 'health.kind.remote' : 'health.kind.local'
      const rows = report
        ? [
            ['health.source', `${t(kind)} · ${report.source?.label ?? t('health.unknown')}`],
            ['health.assetVersion', report.asset?.version ?? t('health.unknown')],
            ['health.tiles', String(report.counts?.tiles ?? 0)],
            ['health.contents', String(report.counts?.contents ?? 0)],
            ['health.depth', String(report.root?.depth ?? 0)],
            ['health.rootError', String(report.root?.geometricError ?? t('health.unknown'))],
            ['health.extensions', extensions.length > 0 ? extensions.join(', ') : t('health.unknown')],
          ]
        : []
      const runtime = report?.runtime ?? null
      const reportPath = state?.reportPath ?? report?.reportPath ?? ''
      const body = state?.loading
        ? h(
            'div',
            { className: 'mv-health-loading' },
            h('div', { className: 'mv-spinner' }),
            h('p', { className: 'mv-note' }, t('health.loading')),
          )
        : state?.error
          ? h('p', { className: 'mv-note' }, t('health.failed', { message: state.error }))
          : report
            ? h(
                'div',
                { className: 'mv-health-body' },
                h(
                  'div',
                  { className: 'mv-health-rows' },
                  rows.map(([key, value]) =>
                    h(
                      'div',
                      { className: 'row', key },
                      h('span', { className: 'key' }, t(key)),
                      h('span', { className: 'value' }, value),
                    ),
                  ),
                ),
                h(
                  'div',
                  { className: 'mv-health-section' },
                  h('b', null, `${t('health.issues')} · ${issues.length}`),
                  issues.length > 0
                    ? h(
                        'ul',
                        { className: 'issues' },
                        issues.map((issue, index) =>
                          h(
                            'li',
                            { key: `${issue.code}-${index}`, className: `lvl-${issue.level}` },
                            h('span', { className: 'badge' }, t(`health.level.${issue.level}`)),
                            h('code', null, issue.code),
                            h('span', { className: 'msg' }, issue.message),
                          ),
                        ),
                      )
                    : h('p', { className: 'mv-note' }, t('health.noIssues')),
                ),
                runtime
                  ? h(
                      'div',
                      { className: 'mv-health-section' },
                      h('b', null, t('health.runtime')),
                      h(
                        'div',
                        { className: 'mv-health-runtime' },
                        `${t('hud.tiles')} ${runtime.tiles ?? 0} · ${t('hud.pending')} ${runtime.pending ?? 0} · ${t('hud.triangles')} ${runtime.triangles ?? 0}`,
                      ),
                    )
                  : null,
                h(
                  'div',
                  { className: 'mv-health-path' },
                  h('span', { className: 'key' }, t('health.reportPath')),
                  h('code', { title: reportPath }, reportPath || t('health.unknown')),
                  reportPath
                    ? h('button', { type: 'button', className: 'mv-cta', onClick: onCopy }, t('health.copy'))
                    : null,
                ),
              )
            : null
      return h(
        'div',
        { className: 'mv-modal', onPointerDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'mv-dialog mv-health', role: 'dialog', 'aria-modal': true },
          h(
            'header',
            null,
            h('b', null, state?.layer ? `${t('health.title')} · ${state.layer}` : t('health.title')),
            h('button', { type: 'button', className: 'mv-icon-btn', onClick: onClose, title: t('btn.close') }, '✕'),
          ),
          h('div', { className: 'body' }, body),
        ),
      )
    }
    //#endregion data health dialog

    //#region local path authorisation -----------------------------------------

    /**
     * Modal shown by the internal `authorize` bridge command before the Host may
     * read a local folder. It only presents the request and wires its buttons:
     * the actual `/scan` registration runs in the surface handler, so the bridge
     * ack is sent only after that request succeeded.
     */
    function PathAccessDialog({ request, busy, t, onAllow, onDeny }) {
      const denyRef = React.useRef(null)
      React.useEffect(() => {
        denyRef.current?.focus?.()
      }, [])
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          onDeny()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onDeny])
      const action =
        request.request === 'load'
          ? t('access.request.load')
          : request.request === 'inspect'
            ? t('access.request.inspect')
            : t('access.request.generic')
      const row = (key, value) =>
        value
          ? h('div', { key, className: 'row' }, h('span', { className: 'key' }, t(key)), h('code', { title: value }, value))
          : null
      return h(
        'div',
        { className: 'mv-modal', onPointerDown: (event) => event.target === event.currentTarget && !busy && onDeny() },
        h(
          'div',
          { className: 'mv-dialog mv-access', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'mv-access-title' },
          h(
            'header',
            null,
            h('b', { id: 'mv-access-title' }, `${t('access.title')} · ${action}`),
            h('button', { type: 'button', className: 'mv-icon-btn', onClick: onDeny, disabled: busy, title: t('btn.close') }, '✕'),
          ),
          h(
            'div',
            { className: 'body' },
            h('p', { className: 'mv-note' }, t('access.body')),
            h(
              'div',
              { className: 'mv-access-path' },
              row('access.path', request.path),
              row('access.dir', request.directory),
              request.resolved ? row('access.target', request.target) : null,
            ),
            request.kind === 'missing' ? h('p', { className: 'mv-note' }, t('access.missing')) : null,
            request.resolved ? h('p', { className: 'mv-note' }, t('access.resolved')) : null,
          ),
          h(
            'div',
            { className: 'footer' },
            h(
              'div',
              { className: 'right' },
              h('button', { ref: denyRef, type: 'button', className: 'mv-cta', onClick: onDeny, disabled: busy }, t('access.cancel')),
              h(
                'button',
                { type: 'button', className: 'mv-cta primary', onClick: onAllow, disabled: busy },
                busy ? t('access.allowing') : t('access.allow'),
              ),
            ),
          ),
        ),
      )
    }
    //#endregion local path authorisation

export { SOURCE_TYPES, SOURCE_TYPE_KEY, emptySource, SourceForm, SourcesDialog, HealthDialog, PathAccessDialog }
