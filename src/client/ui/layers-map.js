/**
 * ui/layers-map.js — the "地图" tab of the layer card: pure 2D data.
 *
 * Order follows what a map is built from: vector overlays (L2, the data users
 * bring) → raster overlays (L3) → imagery basemap (L4, usually one pre-selected
 * source, so the full list stays folded until asked for). Terrain and 3D Tiles live
 * in the 3D tab; analysis/measure/sun/bookmarks live in the tool windows, so this
 * file never mixes data layers with tools.
 */
import React from 'react'

import { normalizeOverlayDraft } from '../scene/overlay-layers.js'
import { readVectorFiles } from '../scene/vector-file.js'
import { vectorErrorText } from '../scene/vector-errors.js'
import { EyeIcon } from './icons.js'
import { IMAGERY_OPEN_KEY, readPanelFlag, writePanelFlag } from './panel-prefs.js'

const h = React.createElement

const OVERLAY_TYPES = ['wms', 'xyz', 'arcgis']

export { normalizeOverlayDraft }

/** Name of the active basemap, shown on the folded group header. */
export function imagerySummary(t, config, settings) {
  const sources = Array.isArray(config?.imagery) ? config.imagery : []
  if (settings?.imagery == null) return t('layers.imageryNone')
  const active = sources.find((source) => source.id === settings.imagery)
  return active?.name ?? String(settings.imagery)
}

export function LayersMap({
  t,
  config,
  settings,
  onSelectImagery,
  onOverlayAdd,
  onOverlayRemove,
  onOverlayOpacity,
  onOverlayVisible,
  onOverlayMove,
  agentOverlays,
  annotations,
  onClearVector,
  onRemoveAgentOverlay,
  onFlyAgentOverlay,
  onImportVector,
  onPickLocalTiles,
  swipeState,
  onOverlaySwipe,
  vectorExport,
}) {
  const [adding, setAdding] = React.useState(false)
  const [draft, setDraft] = React.useState({ type: 'wms', name: '', url: '', layers: '', opacity: 0.7 })
  const [error, setError] = React.useState('')
  const [vectorError, setVectorError] = React.useState('')
  const [imageryOpen, setImageryOpen] = React.useState(() => readPanelFlag(IMAGERY_OPEN_KEY, false))
  const fileRef = React.useRef(null)
  const overlays = Array.isArray(config?.rasterOverlays) ? config.rasterOverlays : []
  const drawn = annotations?.drawn_features ?? 0
  const measured = annotations?.measured_points ?? 0
  const field = (label, input) => h('div', { className: 'mv-field' }, h('label', null, label), input)
  const radioRow = (key, label, active, onClick) =>
    h(
      'button',
      { key, type: 'button', className: `mv-layer mv-choice${active ? ' on' : ''}`, 'aria-pressed': active, onClick },
      h('span', { className: 'name' }, label),
      h('span', { className: 'tick', 'aria-hidden': true }, active ? '✓' : ''),
    )

  const toggleImagery = () => {
    setImageryOpen((value) => {
      const next = !value
      writePanelFlag(IMAGERY_OPEN_KEY, next)
      return next
    })
  }

  const submitDraft = () => {
    const next = normalizeOverlayDraft(draft)
    if (next === null) {
      setError(t('layers.overlayInvalid'))
      return
    }
    onOverlayAdd(next)
    setAdding(false)
    setError('')
    setDraft({ type: 'wms', name: '', url: '', layers: '', opacity: 0.7 })
  }

  return h(
    'div',
    { key: 'list-map', className: 'mv-layer-list' },
    // ---- L2 vector overlays (2D data, not a 3D layer) --------------------------
    h(
      'div',
      { key: 'g2', className: 'mv-group' },
      h('div', { className: 'mv-group-title' }, t('layers.vector')),
      h(
        'div',
        { className: 'mv-group-actions' },
        h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.vectorExportHint'), 'aria-label': t('layers.exportVector'), disabled: !vectorExport, onClick: () => vectorExport?.download() }, '⤓'),
        h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.vectorExportHint'), 'aria-label': t('layers.vectorToChat'), disabled: !vectorExport?.canSend?.(), onClick: () => { void vectorExport?.send() } }, '➤'),
      ),
      h('button', { type: 'button', className: 'mv-cta', onClick: () => fileRef.current?.click() }, t('layers.importVector')),
    ),
    h('input', {
      key: 'import-vector-input',
      ref: fileRef,
      type: 'file',
      multiple: true,
      accept: '.geojson,.json,.shp,.dbf,.prj,.cpg,application/geo+json,application/json',
      hidden: true,
      onChange: (event) => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        if (files.length === 0) return
        void (async () => {
          try {
            const { parsed, name } = await readVectorFiles(files)
            setVectorError('')
            onImportVector?.(parsed, name)
          } catch (failure) {
            const reason = failure?.message === 'vector_file_unsupported' ? t('layers.importNeedFile') : vectorErrorText(failure, t)
            setVectorError(t('layers.importFailed', { message: reason }))
          }
        })()
      },
    }),
    vectorError !== '' ? h('p', { key: 'vector-error', className: 'mv-note' }, vectorError) : null,
    h(
      'div',
      { key: 'vector-row', className: 'mv-layer' },
      h('span', { className: 'name' }, `${t('layers.vectorDrawn')} ${drawn} · ${t('layers.vectorMeasured')} ${measured}`),
      h('button', { type: 'button', className: 'mv-icon-btn', title: t('tool.clear'), 'aria-label': t('tool.clear'), onClick: onClearVector }, '✕'),
    ),
    ...(Array.isArray(agentOverlays) ? agentOverlays : []).map((row) =>
      h(
        'div',
        { key: row.id, className: 'mv-layer' },
        h('span', { className: 'name', title: row.detail }, `${row.label} · ${row.detail}`),
        typeof onFlyAgentOverlay === 'function'
          ? h(
              'button',
              {
                type: 'button',
                className: 'mv-icon-btn',
                title: t('btn.flyTo'),
                'aria-label': t('btn.flyTo'),
                onClick: () => onFlyAgentOverlay(row.kind, row.index),
              },
              '◎',
            )
          : null,
        h(
          'button',
          { type: 'button', className: 'mv-icon-btn', title: t('layers.vectorRemove'), 'aria-label': t('layers.vectorRemove'), onClick: () => onRemoveAgentOverlay(row.kind, row.index) },
          '✕',
        ),
      ),
    ),
    // ---- L3 raster overlays ---------------------------------------------------
    h(
      'div',
      { key: 'g3', className: 'mv-group' },
      h('div', { className: 'mv-group-title' }, `${t('layers.raster')}${overlays.length ? ` · ${overlays.length}` : ''}`),
      h('button', { type: 'button', className: 'mv-cta', onClick: () => setAdding((value) => !value) }, adding ? t('layers.overlayCancel') : t('layers.addOverlay')),
    ),
    adding
      ? h(
          'div',
          { key: 'add-form', className: 'mv-overlay-form' },
          field(
            t('layers.overlayType'),
            h(
              'select',
              { value: draft.type, onChange: (event) => setDraft((current) => ({ ...current, type: event.target.value })) },
              OVERLAY_TYPES.map((type) => h('option', { key: type, value: type }, type.toUpperCase())),
            ),
          ),
          field(t('layers.overlayName'), h('input', { value: draft.name, onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })) })),
          field(t('layers.overlayUrl'), h('input', { value: draft.url, placeholder: 'https://…', onChange: (event) => setDraft((current) => ({ ...current, url: event.target.value })) })),
          typeof onPickLocalTiles === 'function'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  onClick: () => {
                    void (async () => {
                      const picked = await onPickLocalTiles()
                      if (!picked) return
                      const url = typeof picked === 'string' ? picked : picked.url
                      const name = typeof picked === 'object' && picked.name ? picked.name : ''
                      if (!url) return
                      setDraft((current) => ({
                        ...current,
                        type: 'xyz',
                        url,
                        name: current.name.trim() !== '' ? current.name : name,
                      }))
                      setError('')
                    })()
                  },
                },
                t('settings.field.localTiles'),
              )
            : null,
          draft.type === 'wms'
            ? field(t('layers.overlayLayers'), h('input', { value: draft.layers, placeholder: 'flood:risk', onChange: (event) => setDraft((current) => ({ ...current, layers: event.target.value })) }))
            : null,
          field(
            t('layers.overlayOpacity'),
            h('input', {
              type: 'range',
              min: 0,
              max: 100,
              value: Math.round(draft.opacity * 100),
              onChange: (event) => setDraft((current) => ({ ...current, opacity: Number(event.target.value) / 100 })),
            }),
          ),
          error ? h('p', { className: 'mv-note' }, error) : null,
          h('button', { type: 'button', className: 'mv-cta primary', onClick: submitDraft }, t('layers.overlayAdd')),
        )
      : null,
    overlays.length === 0 && !adding
      ? h('div', { key: 'no-overlay', className: 'mv-none' }, t('layers.emptyRaster'))
      : overlays.map((overlay, index) =>
          h(
            'div',
            { key: overlay.id, className: `mv-layer mv-overlay-row${overlay.visible === false ? ' off' : ''}` },
            h('span', { className: 'name', title: overlay.url }, overlay.name),
            h('input', {
              className: 'mv-opacity',
              type: 'range',
              min: 0,
              max: 100,
              title: t('layers.overlayOpacity'),
              'aria-label': t('layers.overlayOpacity'),
              value: Math.round((overlay.opacity ?? 1) * 100),
              onChange: (event) => onOverlayOpacity(overlay.id, Number(event.target.value) / 100),
            }),
            h(
              'button',
              {
                type: 'button',
                className: `mv-icon-btn${overlay.visible === false ? ' on' : ''}`,
                title: overlay.visible === false ? t('btn.visible') : t('btn.hidden'),
                'aria-label': overlay.visible === false ? t('btn.visible') : t('btn.hidden'),
                onClick: () => onOverlayVisible(overlay.id, overlay.visible === false),
              },
              h(EyeIcon, { size: 15, off: overlay.visible === false }),
            ),
            onOverlaySwipe
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: `mv-icon-btn${swipeState?.kind === 'raster' && swipeState?.id === overlay.id ? ' on' : ''}`,
                    disabled: overlay.visible === false,
                    title: t('swipe.toggle'),
                    'aria-label': t('swipe.toggle'),
                    'aria-pressed': Boolean(swipeState?.kind === 'raster' && swipeState?.id === overlay.id),
                    onClick: () => onOverlaySwipe(overlay.id),
                  },
                  '◧',
                )
              : null,
            h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.overlayDown'), 'aria-label': t('layers.overlayDown'), disabled: index === 0, onClick: () => onOverlayMove(overlay.id, -1) }, '↑'),
            h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.overlayUp'), 'aria-label': t('layers.overlayUp'), disabled: index === overlays.length - 1, onClick: () => onOverlayMove(overlay.id, 1) }, '↓'),
            h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.overlayRemove'), 'aria-label': t('layers.overlayRemove'), onClick: () => onOverlayRemove(overlay.id) }, '✕'),
          ),
        ),
    // ---- L4 imagery basemap (folded: one source is normally in use) ------------
    h(
      'div',
      { key: 'g4', className: 'mv-group' },
      h(
        'button',
        {
          type: 'button',
          className: 'mv-group-toggle',
          'aria-expanded': imageryOpen,
          title: imageryOpen ? t('layers.imageryFold') : t('layers.imageryUnfold'),
          onClick: toggleImagery,
        },
        h('span', { className: 'mv-group-title' }, t('layers.imagery')),
        h('span', { className: 'mv-group-current' }, imagerySummary(t, config, settings)),
        h('span', { className: `mv-group-chevron${imageryOpen ? ' open' : ''}`, 'aria-hidden': true }, '›'),
      ),
    ),
    imageryOpen ? radioRow('i-off', t('menu.none'), settings?.imagery == null, () => onSelectImagery(null)) : null,
    imageryOpen ? (config?.imagery ?? []).map((source) => radioRow(`i-${source.id}`, source.name, settings?.imagery === source.id, () => onSelectImagery(source.id))) : null,
  )
}
