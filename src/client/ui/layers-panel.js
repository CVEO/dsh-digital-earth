/**
 * ui/layers-panel.js — the unified layer panel.
 *
 * v1.6 replaces the separate 底图 / 地形 toolbar menus and the inline 3D Tiles
 * card with one panel that mirrors the display stack, bottom to top:
 *
 *   L1 地形      single choice (or "no terrain")
 *   L2 影像底图  single choice (or "no basemap")
 *   L3 栅格叠加  multiple WMS/XYZ rasters, each with opacity + visibility
 *   L4 矢量叠加  read-only summary of Agent draw/measure overlays
 *   + 三维内容层 the loaded 3D Tiles, with fly / visibility / health / remove
 *
 * The panel is presentational: every action is a callback owned by ViewerSurface,
 * which keeps the scene logic (and the overlay stack) in one place. The one
 * exception is the local "add overlay" form state, which never leaves this file.
 */
import React from 'react'

import { normalizeOverlayDraft } from '../scene/overlay-layers.js'
import { addBookmark, loadBookmarks, removeBookmark, saveBookmarks } from '../scene/bookmarks.js'

const h = React.createElement

const OVERLAY_TYPES = ['wms', 'xyz', 'arcgis']

export { normalizeOverlayDraft }

export function LayersPanel({
  t,
  config,
  settings,
  layers,
  annotations,
  onCollapse,
  onSelectTerrain,
  onSelectImagery,
  onFlyLayer,
  onFrameAll,
  onToggleLayer,
  onInspectLayer,
  onRemoveLayer,
  onOverlayAdd,
  onOverlayRemove,
  onOverlayOpacity,
  onOverlayVisible,
  onOverlayMove,
  onClearVector,
  agentOverlays,
  onRemoveAgentOverlay,
  analysis,
  onClearAnalysis,
  getCurrentView,
  onFlyView,
}) {
  const [adding, setAdding] = React.useState(false)
  const [draft, setDraft] = React.useState({ type: 'wms', name: '', url: '', layers: '', opacity: 0.7 })
  const [error, setError] = React.useState('')
  // Camera bookmarks (视角收藏) are client-only: stored in localStorage, no Agent
  // contract involved. The panel owns the list; flying is a callback.
  const [bookmarks, setBookmarks] = React.useState(() => loadBookmarks())
  const [bookmarkNotice, setBookmarkNotice] = React.useState('')

  const sourceName = (list, id) => list?.find((item) => item.id === id)?.name ?? null
  const terrainActive = sourceName(config?.terrain, settings?.terrain)
  const imageryActive = sourceName(config?.imagery, settings?.imagery)
  const overlays = Array.isArray(config?.rasterOverlays) ? config.rasterOverlays : []
  const drawn = annotations?.drawn_features ?? 0
  const measured = annotations?.measured_points ?? 0

  const radioRow = (key, label, active, onClick) =>
    h(
      'button',
      {
        key,
        type: 'button',
        className: `mv-layer mv-choice${active ? ' on' : ''}`,
        'aria-pressed': active,
        onClick,
      },
      h('span', { className: 'name' }, label),
      h('span', { className: 'tick', 'aria-hidden': true }, active ? '✓' : ''),
    )

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

  const field = (label, input) => h('div', { className: 'mv-field' }, h('label', null, label), input)

  const saveCurrentBookmark = () => {
    const view = typeof getCurrentView === 'function' ? getCurrentView() : null
    if (!view) {
      setBookmarkNotice(t('bookmarks.noView'))
      return
    }
    const result = addBookmark(bookmarks, view, null)
    if (!result.bookmark) return
    setBookmarks(result.list)
    setBookmarkNotice(saveBookmarks(result.list) ? '' : t('bookmarks.saveFailed'))
  }

  const deleteBookmark = (id) => {
    const next = removeBookmark(bookmarks, id)
    setBookmarks(next)
    saveBookmarks(next)
  }

  return h(
    'div',
    { className: 'mv-layers mv-glass' },
    h(
      'header',
      null,
      h('span', null, t('layers.title')),
      h(
        'div',
        { className: 'mv-head-actions' },
        layers.length > 0
          ? h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.frameAll'), 'aria-label': t('layers.frameAll'), onClick: onFrameAll }, '⛶')
          : null,
        h(
          'button',
          { type: 'button', className: 'mv-icon-btn', title: t('layers.collapse'), 'aria-label': t('layers.collapse'), onClick: onCollapse },
          '✕',
        ),
      ),
    ),
    h(
      'div',
      { className: 'mv-layer-list' },
      // ---- L1 terrain --------------------------------------------------------
      h('div', { key: 'g1', className: 'mv-group' }, h('div', { className: 'mv-group-title' }, t('layers.terrain'))),
      radioRow('t-off', t('menu.terrainOff'), terrainActive === null, () => onSelectTerrain(null)),
      ...(config?.terrain ?? []).map((source) =>
        radioRow(`t-${source.id}`, source.name, settings?.terrain === source.id, () => onSelectTerrain(source.id)),
      ),
      // ---- L2 imagery basemap ------------------------------------------------
      h('div', { key: 'g2', className: 'mv-group' }, h('div', { className: 'mv-group-title' }, t('layers.imagery'))),
      radioRow('i-off', t('menu.none'), imageryActive === null, () => onSelectImagery(null)),
      ...(config?.imagery ?? []).map((source) =>
        radioRow(`i-${source.id}`, source.name, settings?.imagery === source.id, () => onSelectImagery(source.id)),
      ),
      // ---- L3 raster overlays ------------------------------------------------
      h(
        'div',
        { key: 'g3', className: 'mv-group' },
        h('div', { className: 'mv-group-title' }, `${t('layers.raster')}${overlays.length ? ` · ${overlays.length}` : ''}`),
        h(
          'button',
          { type: 'button', className: 'mv-cta', onClick: () => setAdding((value) => !value) },
          adding ? t('layers.overlayCancel') : t('layers.addOverlay'),
        ),
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
              h('button', {
                type: 'button',
                className: `mv-icon-btn${overlay.visible === false ? ' on' : ''}`,
                title: overlay.visible === false ? t('btn.hidden') : t('btn.visible'),
                onClick: () => onOverlayVisible(overlay.id, overlay.visible === false),
              }, overlay.visible === false ? '◌' : '◉'),
              h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.overlayDown'), disabled: index === 0, onClick: () => onOverlayMove(overlay.id, -1) }, '↑'),
              h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.overlayUp'), disabled: index === overlays.length - 1, onClick: () => onOverlayMove(overlay.id, 1) }, '↓'),
              h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.overlayRemove'), onClick: () => onOverlayRemove(overlay.id) }, '✕'),
            ),
          ),
      // ---- L4 vector overlays ------------------------------------------------
      h('div', { key: 'g4', className: 'mv-group' }, h('div', { className: 'mv-group-title' }, t('layers.vector'))),
      h(
        'div',
        { key: 'vector-row', className: 'mv-layer' },
        h('span', { className: 'name' }, `${t('layers.vectorDrawn')} ${drawn} · ${t('layers.vectorMeasured')} ${measured}`),
        h('button', { type: 'button', className: 'mv-icon-btn', title: t('tool.clear'), onClick: onClearVector }, '✕'),
      ),
      // Editable per-item list: each Agent draw/measure command is one row.
      ...(Array.isArray(agentOverlays) ? agentOverlays : []).map((row) =>
        h(
          'div',
          { key: row.id, className: 'mv-layer' },
          h('span', { className: 'name', title: row.detail }, `${row.label} · ${row.detail}`),
          h(
            'button',
            { type: 'button', className: 'mv-icon-btn', title: t('layers.vectorRemove'), onClick: () => onRemoveAgentOverlay(row.kind, row.index) },
            '✕',
          ),
        ),
      ),
      // ---- analysis (Agent-driven; the panel owns the entry + the clear) ------
      h('div', { key: 'g5', className: 'mv-group' }, h('div', { className: 'mv-group-title' }, t('layers.analysis'))),
      analysis
        ? h(
            'div',
            { key: 'analysis-row', className: 'mv-layer' },
            h(
              'span',
              { className: 'name' },
              `${analysis.operation ?? t('layers.analysis')}${typeof analysis.layer === 'string' && analysis.layer !== '' ? ` · ${analysis.layer}` : ''}`,
            ),
            h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.analysisClear'), onClick: onClearAnalysis }, '✕'),
          )
        : h('div', { key: 'analysis-hint', className: 'mv-none' }, t('layers.analysisHint')),
      // ---- camera bookmarks (client-only, localStorage) ----------------------
      h(
        'div',
        { key: 'g6b', className: 'mv-group' },
        h('div', { className: 'mv-group-title' }, `${t('bookmarks.title')}${bookmarks.length > 0 ? ` · ${bookmarks.length}` : ''}`),
        h('button', { type: 'button', className: 'mv-cta', onClick: saveCurrentBookmark }, t('bookmarks.save')),
      ),
      bookmarkNotice !== '' ? h('div', { key: 'bm-notice', className: 'mv-none' }, bookmarkNotice) : null,
      bookmarks.length === 0
        ? h('div', { key: 'bm-empty', className: 'mv-none' }, t('bookmarks.empty'))
        : bookmarks.map((item) =>
            h(
              'div',
              { key: item.id, className: 'mv-layer' },
              h('span', { className: 'name', title: t('bookmarks.flyHint'), onClick: () => onFlyView(item.view) }, item.name),
              h('button', { type: 'button', className: 'mv-icon-btn', title: t('bookmarks.remove'), onClick: () => deleteBookmark(item.id) }, '✕'),
            ),
          ),
      // ---- 3D Tiles content --------------------------------------------------
      h('div', { key: 'g6', className: 'mv-group' }, h('div', { className: 'mv-group-title' }, `${t('layers.content')} · ${layers.length}`)),
      ...layers.map((layer) =>
        h(
          'div',
          { key: layer.id, className: `mv-layer${layer.visible ? '' : ' off'}` },
          h('span', { className: 'name', title: layer.name, onClick: () => onFlyLayer(layer.id) }, layer.name),
          h('button', { type: 'button', className: `mv-icon-btn${layer.visible ? '' : ' on'}`, title: layer.visible ? t('btn.visible') : t('btn.hidden'), onClick: () => onToggleLayer(layer.id) }, layer.visible ? '◉' : '◌'),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.flyTo'), 'aria-label': t('btn.flyTo'), onClick: () => onFlyLayer(layer.id) }, '⌖'),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.health'), 'aria-label': t('btn.health'), onClick: () => onInspectLayer(layer.id) }, '⌕'),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.delete'), 'aria-label': t('btn.delete'), onClick: () => onRemoveLayer(layer.id) }, '✕'),
        ),
      ),
    ),
  )
}
