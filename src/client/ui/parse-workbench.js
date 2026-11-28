/**
 * ui/parse-workbench.js — the 2D extraction workbench body (pure presentation).
 *
 * One panel, no modals and no nested views: header (+ collapsed settings), run
 * button, extent, classes, one status line, the candidate queue and the GeoJSON
 * export. The component reads only the frozen `state` and calls only `actions`;
 * the controller owns the viewer, Cesium, the store and the network. Rendering is
 * `React.createElement` only (no JSX) so the client artifact stays one layer.
 */
import React from 'react'

import { ParseModelSettings } from './parse-model-settings.js'
import { formatArea } from '../format.js'

const h = React.createElement

/* ------------------------------------------------------------------ helpers */

/** Candidates shown by the current filter, in queue order. */
export function filterCandidates(candidates, filter) {
  const list = Array.isArray(candidates) ? candidates : []
  if (filter === 'pending' || filter === 'accepted' || filter === 'rejected') {
    return list.filter((candidate) => candidate?.status === filter)
  }
  return list.slice()
}

export function visibleCandidates(state) {
  return filterCandidates(state?.candidates, state?.filter)
}

/** How many features the current export scope would write. */
export function exportCount(state, scope) {
  if (scope === 'all') {
    const total = state?.counts?.total
    return typeof total === 'number' ? total : (Array.isArray(state?.candidates) ? state.candidates.length : 0)
  }
  const accepted = state?.counts?.accepted
  return typeof accepted === 'number' ? accepted : filterCandidates(state?.candidates, 'accepted').length
}

/** One-line status for the single aria-live row. */
export function statusText(t, state) {
  if (state?.busy === true) {
    if (state?.phase === 'segmenting') {
      const done = Number(state?.progress?.done) || 0
      const total = Number(state?.progress?.total) || 0
      const found = Number(state?.report?.instances) || 0
      const failed = Number(state?.report?.failedWindows) || 0
      return `${t('parse.phaseSegmenting', { done, total })} · ${t('parse.progressFound', { n: found, failed })}`
    }
    if (state?.phase === 'capturing') return t('parse.phaseCapturing')
    return t('parse.phaseWorking')
  }
  if (state?.phase === 'error') return t('parse.phaseError')
  if (state?.phase === 'review') {
    const report = state?.report
    if (report) {
      return t(report.failedWindows ? 'parse.reportLine' : 'parse.reportComplete', {
        n: Number(report.instances) || 0,
        windows: Number(report.windows) || 0,
        failed: Number(report.failedWindows) || 0,
      })
    }
    return t('parse.phaseReview')
  }
  return t('parse.idleHint')
}

const dotStyle = (color) => (typeof color === 'string' && color !== '' ? { '--mv-dot': color } : null)

/** Area cell text; a missing area stays an em dash, never a fabricated number. */
function areaText(value) {
  return typeof value === 'number' && Number.isFinite(value) ? formatArea(value) : '—'
}

/** Stop a child button press from also activating the row underneath it. */
function press(event, run) {
  event?.stopPropagation?.()
  run()
}

function filterEntries(t) {
  return [
    { id: 'all', label: t('parse.filterAllQueue') },
    { id: 'pending', label: t('parse.filterPending') },
    { id: 'accepted', label: t('parse.filterAccepted') },
    { id: 'rejected', label: t('parse.filterRejected') },
  ]
}

/* -------------------------------------------------------------------- header */

function renderHeader(t, state, ui) {
  return h('div', { className: 'mv-parse-head', 'data-row': 'head' }, [
    h('span', { key: 'title', className: 'mv-parse-title' }, t('parse.panelTitle')),
    h('button', {
      key: 'settings', type: 'button', className: 'mv-parse-mini-btn', 'data-action': 'settings-toggle',
      title: t('parse.settingsHint'), 'aria-expanded': ui.settingsOpen === true,
      onClick: () => ui.toggleSettings(),
    }, `${t('parse.settings')} ${ui.settingsOpen ? '▴' : '▾'}`),
  ])
}

function renderSettings(t, state, actions) {
  const catalog = Array.isArray(state?.classes?.catalog) ? state.classes.catalog : []
  return h('div', { className: 'mv-parse-settings', 'data-row': 'settings' }, [
    state?.visionConfigUrl ? h(ParseModelSettings, { key: 'model', t, url: state.visionConfigUrl,
      sessionId: state.sessionId, busy: state.busy, actions }) : null,
    h('label', { key: 'scale', className: 'mv-parse-scale' }, [
      h('input', { key: 'toggle', type: 'checkbox', checked: state?.multiScale === true, disabled: state?.busy,
        onChange: event => actions?.setMultiScale?.(event.target.checked) }),
      t('parse.multiScale'),
    ]),
    h('span', { key: 'scale-detail', className: 'mv-parse-note' }, t('parse.multiScaleHint')),
    h('label', { key: 'locator', className: 'mv-parse-profile', title:t('parse.locatorHint') }, [
      t('parse.locator'),
      h('select', { key:'select', className:'mv-parse-select', value:state?.locator ?? 'joint', disabled:state?.busy,
        'aria-label':t('parse.locator'), onChange:e=>actions?.setLocator?.(e.target.value) }, [
        h('option',{key:'joint',value:'joint'},t('parse.joint')),
        h('option',{key:'names',value:'names'},t('parse.namedLabels')),
        h('option',{key:'separate',value:'separate'},t('parse.separate')),
      ]),
    ]),
    h('label', { key: 'reuse', className: 'mv-parse-scale', title: t('parse.reuseHint') }, [
      h('input', { key: 'toggle', type: 'checkbox', checked: state?.reuse !== false, disabled: state?.busy,
        onChange: event => actions?.setReuse?.(event.target.checked) }),
      t('parse.reuse'),
    ]),
    state?.report?.reusedCalls > 0 ? h('span', { key:'reused', className:'mv-parse-note' }, t('parse.reusedCount', { n:state.report.reusedCalls })) : null,
    state?.report?.modelUsed ? h('span', { key: 'used', className: 'mv-parse-note' }, t('parse.lastModel', { name: state.report.modelUsed })) : null,
    h('details', { key: 'definitions', className: 'mv-parse-definitions' },
      h('summary', null, t('parse.settingsClasses')),
      h('div', { key: 'defs', className: 'mv-parse-defs' }, catalog.map((entry) => h('div', {
      key: entry.key, className: 'mv-parse-def',
    }, [
      h('span', { key: 'name', className: 'mv-parse-def-name' }, entry.custom ? `${entry.name} · ${t('parse.customTag')}` : entry.name),
      h('span', { key: 'text', className: 'mv-parse-def-text' }, entry.definition),
    ])))),
    h('div', { key: 'resolution', className: 'mv-parse-note' }, t('parse.settingsResolution')),
    h('div', { key: 'tiling', className: 'mv-parse-note' }, t('parse.settingsTiling')),
    state?.report?.usage ? h('div', { key: 'tokens', className: 'mv-parse-note' }, t('parse.tokenUsage', {
      n: state.report.usage.totalTokens, measured: state.report.usage.measuredCalls, calls: state.report.calls - (state.report.reusedCalls || 0),
    })) : null,
  ])
}

/* ------------------------------------------------------------------ run/status */

function renderRun(t, state, actions) {
  const busy = state?.busy === true
  const rows = []
  if (busy) {
    rows.push(h('button', {
      key: 'stop', type: 'button', className: 'mv-cta danger mv-parse-run-btn', 'data-action': 'stop',
      title: t('parse.stopHint'), onClick: () => actions?.stop?.(),
    }, t('parse.stop')))
  } else if (state?.confirmRerun === true) {
    const rerun = state?.rerun ?? {}
    rows.push(h('div', {
      key: 'confirm', className: 'mv-parse-confirm', role: 'group',
      'aria-label': t('parse.rerunConfirm', { n: rerun.total ?? 0, accepted: rerun.accepted ?? 0 }),
    }, [
      h('span', { key: 'text', className: 'mv-parse-confirm-text' }, t('parse.rerunConfirm', {
        n: rerun.total ?? 0, accepted: rerun.accepted ?? 0,
      })),
      h('button', {
        key: 'go', type: 'button', className: 'mv-cta primary mv-parse-run-btn', 'data-action': 'confirm-rerun',
        title: t('parse.rerunGo'), onClick: () => actions?.confirmRun?.(),
      }, t('parse.rerunGo')),
      h('button', {
        key: 'no', type: 'button', className: 'mv-parse-mini-btn', 'data-action': 'cancel-rerun',
        title: t('parse.cancel'), onClick: () => actions?.cancelRerun?.(),
      }, t('parse.cancel')),
    ]))
  } else {
    const canRun = state?.canRun === true
    const label = typeof state?.primaryLabel === 'string' && state.primaryLabel !== '' ? state.primaryLabel : t('parse.start')
    rows.push(h('button', {
      key: 'run', type: 'button', className: 'mv-cta primary mv-parse-run-btn', 'data-action': 'run',
      disabled: !canRun, title: state?.reason ?? t('parse.startHint'),
      onClick: () => { if (canRun) actions?.run?.() },
    }, label))
  }
  if (!busy && typeof state?.reason === 'string' && state.reason !== '') {
    rows.push(h('div', { key: 'reason', className: 'mv-parse-reason' }, state.reason))
  }
  return h('div', { className: 'mv-parse-run', 'data-row': 'run' }, rows)
}

function renderStatus(t, state) {
  return h('div', {
    className: 'mv-parse-status', role: 'status', 'aria-live': 'polite', 'data-row': 'status',
  }, statusText(t, state))
}

function renderError(t, state, actions) {
  const error = state?.error
  if (!error) return null
  const message = typeof error.message === 'string' && error.message !== '' ? error.message : t('parse.err.model_failed')
  return h('div', { className: 'mv-parse-error', 'data-error': error.code ?? 'error', role: 'alert' }, [
    h('div', { key: 'msg', className: 'mv-parse-error-msg' }, message),
    h('button', {
      key: 'retry', type: 'button', className: 'mv-parse-mini-btn', 'data-action': 'retry',
      title: t('parse.retry'), onClick: () => actions?.run?.(),
    }, t('parse.retry')),
  ])
}

/* --------------------------------------------------------------- extent/classes */

function renderScope(t, state, actions) {
  const busy = state?.busy === true
  const scope = state?.scope ?? 'view'
  const aoi = state?.aoi ?? {}
  const drawing = aoi.drawing === true
  const rows = [h('div', {
    key: 'seg', className: 'mv-parse-seg', role: 'group', 'aria-label': t('parse.scopeLabel'),
  }, [
    h('button', {
      key: 'view', type: 'button', 'data-scope': 'view', 'aria-pressed': scope === 'view',
      className: `mv-parse-seg-btn${scope === 'view' ? ' on' : ''}`, disabled: busy,
      title: t('parse.scopeCurrent'), onClick: () => actions?.setScope?.('view'),
    }, t('parse.scopeCurrent')),
    h('button', {
      key: 'aoi', type: 'button', 'data-scope': 'aoi', 'aria-pressed': scope === 'aoi',
      className: `mv-parse-seg-btn${scope === 'aoi' ? ' on' : ''}`, disabled: busy,
      title: t('parse.scopeDrawHint'),
      onClick: () => {
        actions?.setScope?.('aoi')
        if (aoi.ready !== true && drawing !== true) actions?.startDrawAoi?.('rect')
      },
    }, t('parse.scopeDraw')),
  ])]
  if (scope === 'aoi') {
    const drawEntries = [{ id: 'rect', label: aoi.ready === true ? t('parse.aoiRedraw') : t('parse.aoiDraw') }]
    rows.push(h('div', { key: 'aoi', className: 'mv-parse-aoi' }, [
      ...drawEntries.map(({ id, label }) => h('button', {
        key: id, type: 'button', className: 'mv-parse-mini-btn', 'data-draw': id,
        disabled: busy, title: drawing ? t('parse.drawing') : label,
        onClick: () => actions?.startDrawAoi?.(id),
      }, drawing ? t('parse.drawing') : label)),
      aoi.ready === true
        ? h('button', {
            key: 'clear', type: 'button', className: 'mv-parse-mini-btn', 'data-aoi-clear': '1',
            disabled: busy, title: t('parse.aoiClear'), onClick: () => actions?.clearAoi?.(),
          }, t('parse.aoiClear'))
        : null,
      h('span', { key: 'note', className: 'mv-parse-note' }, aoi.ready === true
        ? t('parse.aoiReadyLabel', { area: Number.isFinite(aoi.area_m2) ? formatArea(aoi.area_m2) : '—' })
        : t('parse.needAoi')),
    ]))
  }
  return h('div', { className: 'mv-parse-sec', 'data-row': 'scope' }, rows)
}

function renderClasses(t, state, actions, ui) {
  const busy = state?.busy === true
  const catalog = Array.isArray(state?.classes?.catalog) ? state.classes.catalog : []
  const chips = catalog.map((entry) => h('button', {
    key: entry.key, type: 'button', 'data-class': entry.key, 'aria-pressed': entry.on === true,
    className: `mv-parse-chip${entry.on === true ? ' on' : ''}`, disabled: busy,
    title: entry.definition ? `${entry.name} · ${entry.definition}` : entry.name,
    onClick: () => actions?.toggleClass?.(entry.key),
  }, [
    h('span', { key: 'dot', className: 'mv-parse-dot', style: dotStyle(entry.color), 'aria-hidden': true }),
    entry.name,
  ]))
  if (ui.customOpen) {
    chips.push(h('input', {
      key: 'custom-input', type: 'text', className: 'mv-parse-inline-input', value: ui.customDraft,
      placeholder: t('parse.customClass'), 'aria-label': t('parse.customInputLabel'), title: t('parse.customInputLabel'),
      disabled: busy,
      onChange: (event) => ui.setCustomDraft(event?.target?.value ?? ''),
      onKeyDown: (event) => {
        if (event?.key === 'Enter') { event.preventDefault?.(); ui.submitCustom() }
        else if (event?.key === 'Escape') { event.preventDefault?.(); ui.closeCustom() }
      },
    }))
    chips.push(h('button', {
      key: 'custom-save', type: 'button', className: 'mv-parse-mini-btn', 'data-custom-save': '1',
      disabled: busy, title: t('parse.customSave'), onClick: () => ui.submitCustom(),
    }, t('parse.customSave')))
    chips.push(h('button', {
      key: 'custom-cancel', type: 'button', className: 'mv-parse-mini-btn',
      disabled: busy, title: t('parse.cancel'), onClick: () => ui.closeCustom(),
    }, t('parse.cancel')))
  } else {
    chips.push(h('button', {
      key: 'custom-add', type: 'button', className: 'mv-parse-chip mv-parse-chip-add', 'data-class-add': '1',
      disabled: busy, title: t('parse.customHint'), onClick: () => ui.openCustom(),
    }, t('parse.customClass')))
  }
  chips.push(h('button', {
    key: 'reset', type: 'button', className: 'mv-parse-mini-btn', 'data-action': 'reset-classes',
    disabled: busy, title: t('parse.classResetHint'), onClick: () => actions?.resetClasses?.(),
  }, t('parse.classReset')))
  return h('div', { className: 'mv-parse-sec', 'data-row': 'classes' }, [
    h('label', { key: 'profile', className: 'mv-parse-profile' }, [
      t('parse.classProfile'),
      h('select', { key: 'choice', className: 'mv-parse-select', disabled: busy, value: state?.classes?.profile ?? 'general',
        'aria-label': t('parse.classProfile'), onChange: e => actions?.setClassProfile?.(e.target.value) }, [
          h('option', { key: 'general', value: 'general' }, t('parse.generalProfile')),
          h('option', { key: 'sports', value: 'sports' }, t('parse.sportsProfile')),
      ]),
    ]),
    h('div', { key: 'chips', className: 'mv-parse-chips', role: 'group', 'aria-label': t('parse.classesLabel') }, chips),
    ui.customError ? h('div', { key: 'invalid', className: 'mv-parse-invalid', role: 'alert' }, t('parse.customInvalid')) : null,
    h('div', { key: 'summary', className: 'mv-parse-note' }, state?.classes?.summary ?? ''),
  ])
}

/* ------------------------------------------------------------------- the queue */

function renderRow(t, state, actions, candidate) {
  const id = candidate?.id
  const busy = state?.busy === true
  const selected = Array.isArray(state?.selected) && state.selected.includes(id)
  const active = state?.activeId === id
  const status = candidate?.status ?? 'pending'
  const classText = candidate?.className || candidate?.classKey || t('parse.class.other')
  const icon = (key, action, glyph, label, run) => h('button', {
    key, type: 'button', className: 'mv-parse-icon-btn', 'data-id': id, 'data-row-action': action,
    disabled: busy, title: label, 'aria-label': label,
    onClick: (event) => press(event, run),
  }, glyph)
  const buttons = []
  if (status === 'pending') {
    buttons.push(
      icon('adopt', 'adopt', '✓', t('parse.adopt'), () => actions?.adopt?.([id])),
      icon('reject', 'reject', '✕', t('parse.reject'), () => actions?.reject?.([id])),
    )
  } else if (status === 'accepted') {
    buttons.push(
      icon('restore', 'restore', '↺', t('parse.restore'), () => actions?.restore?.([id])),
      icon('reject', 'reject', '✕', t('parse.reject'), () => actions?.reject?.([id])),
    )
  } else {
    buttons.push(
      icon('adopt', 'adopt', '✓', t('parse.adopt'), () => actions?.adopt?.([id])),
      icon('restore', 'restore', '↺', t('parse.restore'), () => actions?.restore?.([id])),
    )
  }
  buttons.push(
    icon('remove', 'remove', '⌫', t('parse.remove'), () => actions?.remove?.([id])),
    icon('fly', 'fly', '⌖', t('parse.flyTo'), () => actions?.flyTo?.(id)),
  )
  return h('div', { key: id, role: 'listitem', className: 'mv-parse-item-wrap', 'data-id': id }, h('div', {
    className: `mv-parse-row mv-parse-item${selected ? ' on' : ''}${active ? ' active' : ''}`,
    'data-item-id': id,
    onClick: () => { if (!busy) actions?.activate?.(id) },
  }, [
    h('input', {
      key: 'select', type: 'checkbox', className: 'mv-parse-check', checked: selected,
      'data-select': String(id), 'aria-label': t('parse.selectRow', { name: classText }),
      title: t('parse.selectRow', { name: classText }),
      onClick: (event) => event?.stopPropagation?.(),
      onChange: () => {
        const current = Array.isArray(state?.selected) ? state.selected : []
        const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
        actions?.select?.(next)
      },
    }),
    h('span', { key: 'dot', className: 'mv-parse-dot', style: dotStyle(candidate?.color), 'aria-hidden': true }),
    h('button', { key: 'class', type: 'button', className: 'mv-parse-item-class', disabled: busy,
      title: t('parse.previewOutline'), 'aria-label': t('parse.previewCandidate', { name: classText }),
      onClick: event => press(event, () => actions?.activate?.(id)),
    }, classText),
    candidate?.clippedAtTileEdge === true
      ? h('span', { key: 'clipped', className: 'mv-parse-item-tag', title: t('parse.clippedHint') }, t('parse.clippedTag'))
      : null,
    h('span', { key: 'area', className: 'mv-parse-item-area', title: t('parse.areaLabel') }, areaText(candidate?.area_m2)),
    h('span', { key: 'actions', className: 'mv-parse-item-actions' }, buttons),
  ]))
}

function renderQueue(t, state, actions) {
  const busy = state?.busy === true
  const rows = visibleCandidates(state)
  const counts = state?.counts ?? {}
  const pending = Number(counts.pending) || 0
  return h('div', { className: 'mv-parse-queue', 'data-row': 'queue' }, [
    h('div', { key: 'head', className: 'mv-parse-queue-head' }, [
      h('span', { key: 'counts', className: 'mv-parse-queue-counts' }, t('parse.queueCounts', {
        n: Number(counts.total) || 0, pending, accepted: Number(counts.accepted) || 0,
      })),
      h('span', { key: 'tools', className: 'mv-parse-queue-tools', role: 'group', 'aria-label': t('parse.filterLabel') }, [
        h('select', {
          key: 'filter', className: 'mv-parse-select', 'data-filter-select': '1', value: state?.filter ?? 'all',
          'aria-label': t('parse.filterLabel'), title: t('parse.filterLabel'),
          disabled: busy,
          onChange: (event) => actions?.setFilter?.(event?.target?.value ?? 'all'),
        }, filterEntries(t).map((entry) => h('option', { key: entry.id, value: entry.id }, entry.label))),
        h('button', {
          key: 'pending', type: 'button', className: 'mv-parse-mini-btn', 'data-queue-action': 'select-pending',
          disabled: busy || pending === 0, title: t('parse.selectPending'),
          onClick: () => actions?.select?.(
            (state?.candidates ?? []).filter((candidate) => candidate?.status === 'pending').map((candidate) => candidate.id),
          ),
        }, t('parse.selectPending')),
        h('button', {
          key: 'adopt-selected', type: 'button', className: 'mv-parse-mini-btn', 'data-queue-action': 'adopt-selected',
          disabled: busy || !Array.isArray(state?.selected) || state.selected.length === 0,
          title: t('parse.adoptSelected'), onClick: () => actions?.adopt?.(state?.selected ?? []),
        }, t('parse.adoptSelected')),
        h('button', {
          key: 'reject-selected', type: 'button', className: 'mv-parse-mini-btn', 'data-queue-action': 'reject-selected',
          disabled: busy || !Array.isArray(state?.selected) || state.selected.length === 0,
          title: t('parse.rejectSelected'), onClick: () => actions?.reject?.(state?.selected ?? []),
        }, t('parse.rejectSelected')),
        h('button', {
          key: 'undo', type: 'button', className: 'mv-parse-icon-btn', 'data-action': 'undo',
          disabled: busy, title: t('parse.undoHint'), 'aria-label': t('parse.undo'), onClick: () => actions?.undo?.(),
        }, '↶'),
        h('button', {
          key: 'redo', type: 'button', className: 'mv-parse-icon-btn', 'data-action': 'redo',
          disabled: busy, title: t('parse.redoHint'), 'aria-label': t('parse.redo'), onClick: () => actions?.redo?.(),
        }, '↷'),
      ]),
    ]),
    h('div', { key: 'rows', className: 'mv-parse-rows', role: 'list', 'aria-label': t('parse.queueLabel') }, rows.length > 0
      ? rows.map((candidate) => renderRow(t, state, actions, candidate))
      : h('div', { role: 'listitem', className: 'mv-parse-empty' }, t('parse.queueEmpty'))),
  ])
}

/* -------------------------------------------------------------------- export */

function renderExport(t, state, actions, ui) {
  const busy = state?.busy === true
  const scope = ui.exportScope === 'all' ? 'all' : 'accepted'
  const count = exportCount(state, scope)
  const disabled = busy || count === 0
  return h('div', { className: 'mv-parse-export', 'data-row': 'export' }, [
    h('div', { key: 'scope', className: 'mv-parse-export-row', role: 'group', 'aria-label': t('parse.exportScopeLabel') }, [
      h('button', {
        key: 'accepted', type: 'button', 'data-export-scope': 'accepted', 'aria-pressed': scope === 'accepted',
        className: `mv-parse-chip${scope === 'accepted' ? ' on' : ''}`, disabled: busy,
        title: t('parse.filterAccepted'), onClick: () => ui.setExportScope('accepted'),
      }, t('parse.filterAccepted')),
      h('button', {
        key: 'all', type: 'button', 'data-export-scope': 'all', 'aria-pressed': scope === 'all',
        className: `mv-parse-chip${scope === 'all' ? ' on' : ''}`, disabled: busy,
        title: t('parse.filterAllQueue'), onClick: () => ui.setExportScope('all'),
      }, t('parse.filterAllQueue')),
    ]),
    count === 0 && Number(state?.counts?.total) > 0
      ? h('div', { key: 'need', className: 'mv-parse-note' }, t('parse.exportNeedAccept'))
      : null,
    h('div', { key: 'do', className: 'mv-parse-export-row' }, h('button', {
      key: 'export', type: 'button', className: 'mv-cta primary mv-parse-export-do', 'data-action': 'export',
      disabled, title: disabled ? t('parse.exportBlocked') : t('parse.exportHint'),
      onClick: () => { if (!disabled) actions?.exportGeoJson?.(scope) },
    }, t('parse.exportDo', { n: count }))),
  ])
}

/* --------------------------------------------------------------- local state */

function useWorkbenchUi(t, state, actions) {
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [customOpen, setCustomOpen] = React.useState(false)
  const [customDraft, setCustomDraft] = React.useState('')
  const [customError, setCustomError] = React.useState(false)
  const [exportScope, setExportScope] = React.useState('accepted')

  const toggleSettings = () => setSettingsOpen((open) => !open)
  const openCustom = () => { setCustomOpen(true); setCustomError(false) }
  const closeCustom = () => { setCustomOpen(false); setCustomDraft(''); setCustomError(false) }
  const submitCustom = () => {
    const label = String(customDraft ?? '').trim()
    if (label === '') { setCustomError(true); return }
    actions?.addCustomClass?.(label)
    setCustomDraft('')
    setCustomError(false)
    setCustomOpen(false)
  }
  return {
    settingsOpen, toggleSettings,
    customOpen, customDraft, customError,
    setCustomDraft, openCustom, closeCustom, submitCustom,
    exportScope, setExportScope,
  }
}

/* ---------------------------------------------------------------- component */

export function ParseWorkbench({ t, state, actions }) {
  const translate = typeof t === 'function' ? t : (key) => key
  const ui = useWorkbenchUi(translate, state, actions)
  return h('div', { className: 'mv-parse mv-parse-workbench' }, [
    renderHeader(translate, state, ui),
    ui.settingsOpen ? renderSettings(translate, state, actions) : null,
    renderScope(translate, state, actions),
    renderClasses(translate, state, actions, ui),
    renderRun(translate, state, actions),
    renderStatus(translate, state),
    renderError(translate, state, actions),
    renderQueue(translate, state, actions),
    renderExport(translate, state, actions, ui),
  ])
}
