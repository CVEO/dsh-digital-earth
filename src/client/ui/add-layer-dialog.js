/**
 * ui/add-layer-dialog.js — the single "add data" surface of the scene card.
 *
 * v1.8 IA pass (D5): adding data never inserts a form into the layer list again.
 * One dialog owns the three routes and starts with "what kind of data is this?":
 *
 *   三维内容   3D Tiles / 3DGS: local folder (host scan) or an online URL
 *   栅格图层   WMS / XYZ / ArcGIS, with the optional time dimension
 *   矢量图层   GeoJSON / Shapefile; the parsed result goes through the same
 *              import pipeline as a drop on the globe
 *
 * Every entry point (card ＋, group ＋, toolbar 数据 ▾) opens this dialog with a
 * preset kind, so the user lands on the right step and can still go back.
 */
import React from 'react'

import { normalizeOverlayDraft } from '../scene/overlay-layers.js'
import { parseTemporalDraft } from '../scene/raster-time.js'
import { readVectorFiles } from '../scene/vector-file.js'
import { vectorErrorText } from '../scene/vector-errors.js'
import { GlyphIcon } from './icons.js'
import { GeotiffRoute } from './geotiff-panel.js'
import { useDialogA11y } from './use-dialog-a11y.js'

const h = React.createElement

const OVERLAY_TYPES = ['wms', 'xyz', 'arcgis']

const EMPTY_DRAFT = {
  type: 'wms',
  name: '',
  url: '',
  layers: '',
  opacity: 0.7,
  timeMode: 'none',
  timesText: '',
  framesText: '',
}

// Labels are functions so every key stays a literal lookup (check-i18n counts them).
const KINDS = [
  { id: '3d', glyph: 'scene', title: (t) => t('layers.addKind3d'), hint: (t) => t('layers.addKind3dHint') },
  { id: 'raster', glyph: 'raster', title: (t) => t('layers.addKindRaster'), hint: (t) => t('layers.addKindRasterHint') },
  { id: 'vector', glyph: 'vector', title: (t) => t('layers.addKindVector'), hint: (t) => t('layers.addKindVectorHint') },
]

export function AddLayerDialog({
  t,
  request,
  onClose,
  onOpenLocal,
  onOpenUrl,
  recentDirs,
  onOpenRecent,
  onPickLocalTiles,
  onOverlayAdd,
  onImportVector,
}) {
  const open = Boolean(request)
  const [kind, setKind] = React.useState(request?.kind ?? null)
  const [draft, setDraft] = React.useState(EMPTY_DRAFT)
  const [rasterMode, setRasterMode] = React.useState(request?.rasterMode === 'geotiff' ? 'geotiff' : 'online')
  const [error, setError] = React.useState('')
  const [vectorError, setVectorError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [geoBusy, setGeoBusy] = React.useState(false)
  const fileRef = React.useRef(null)
  // Esc, X, the backdrop and Back all go through one gate: a running publish
  // must be canceled explicitly from the route, never abandoned by a stray Esc.
  const locked = geoBusy
  const requestClose = () => {
    if (locked) return
    onClose?.()
  }
  const dialogRef = useDialogA11y({ open, onEscape: requestClose })

  React.useEffect(() => {
    if (!open) return
    setKind(request?.kind ?? null)
    setDraft(EMPTY_DRAFT)
    setRasterMode(request?.rasterMode === 'geotiff' ? 'geotiff' : 'online')
    setError('')
    setVectorError('')
    setGeoBusy(false)
  }, [open, request?.kind, request?.rasterMode, request?.token])

  if (!open) return null
  const titleId = 'mv-add-layer-title'
  const patch = (next) => setDraft((current) => ({ ...current, ...next }))

  const draftErrorText = () => {
    if (draft.timeMode !== 'none') {
      const parsed = parseTemporalDraft({
        mode: draft.timeMode,
        type: draft.type,
        url: draft.url,
        timesText: draft.timesText,
        framesText: draft.framesText,
      })
      if (!parsed.ok) {
        if (parsed.code === 'too_many_frames') return t('rasterTime.errTooMany')
        if (parsed.code === 'invalid_time') return t('rasterTime.errBadTime', { value: parsed.value ?? '' })
        if (parsed.code === 'missing_time_placeholder') return t('rasterTime.errMissingPlaceholder')
        if (parsed.code === 'invalid_frame_line' || parsed.code === 'empty_frames') return t('rasterTime.errBadFrameLine')
      }
    }
    return t('layers.overlayInvalid')
  }

  const submitRaster = () => {
    const next = normalizeOverlayDraft(draft)
    if (next === null) {
      setError(draftErrorText())
      return
    }
    onOverlayAdd?.(next)
    setDraft(EMPTY_DRAFT)
    setRasterMode('online')
    setError('')
    onClose?.()
  }

  const submitVector = async (files) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setVectorError('')
    try {
      const { parsed, name } = await readVectorFiles(files)
      onImportVector?.(parsed, name)
      onClose?.()
    } catch (failure) {
      const reason =
        failure?.message === 'vector_file_unsupported' ? t('layers.importNeedFile') : vectorErrorText(failure, t)
      setVectorError(t('layers.importFailed', { message: reason }))
    } finally {
      setBusy(false)
    }
  }

  const field = (label, control, hint) =>
    h(
      'label',
      { className: 'mv-field' },
      h('span', null, label),
      control,
      hint ? h('em', { className: 'mv-field-hint' }, hint) : null,
    )

  const back = () =>
    kind === null
      ? null
      : h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn mv-dialog-back',
            title: t('layers.addBack'),
            'aria-label': t('layers.addBack'),
            disabled: locked,
            onClick: () => (locked ? undefined : setKind(null)),
          },
          '‹',
        )

  const kindChooser = () =>
    h(
      'div',
      { className: 'mv-add-kinds' },
      ...KINDS.map((entry) =>
        h(
          'button',
          { key: entry.id, type: 'button', className: 'mv-add-kind', onClick: () => setKind(entry.id) },
          h('span', { className: 'mv-add-kind-icon', 'aria-hidden': true }, h(GlyphIcon, { name: entry.glyph, size: 20 })),
          h('b', null, entry.title(t)),
          h('span', { className: 'mv-add-kind-hint' }, entry.hint(t)),
        ),
      ),
    )

  const body3d = () =>
    h(
      React.Fragment,
      null,
      h('p', { className: 'mv-note' }, t('layers.add3dHint')),
      h(
        'div',
        { className: 'mv-add-routes' },
        h(
          'button',
          { type: 'button', className: 'mv-add-route', onClick: () => { onClose?.(); onOpenLocal?.() } },
          h(GlyphIcon, { name: 'folder', size: 18 }),
          h('span', null, h('b', null, t('btn.openLocal')), h('em', null, t('menu.add3dLocalHint'))),
        ),
        h(
          'button',
          { type: 'button', className: 'mv-add-route', onClick: () => { onClose?.(); onOpenUrl?.() } },
          h(GlyphIcon, { name: 'link', size: 18 }),
          h('span', null, h('b', null, t('btn.openUrl')), h('em', null, t('menu.add3dUrlHint'))),
        ),
      ),
      Array.isArray(recentDirs) && recentDirs.length > 0
        ? h(
            'div',
            { className: 'mv-add-recents' },
            h('p', { className: 'mv-menu-section' }, t('menu.recentDirs')),
            ...recentDirs.map((entry) =>
              h(
                'button',
                {
                  key: entry.dir,
                  type: 'button',
                  className: 'mv-add-recent',
                  title: entry.dir,
                  onClick: () => {
                    onClose?.()
                    onOpenRecent?.(entry.dir)
                  },
                },
                h(GlyphIcon, { name: 'history', size: 14 }),
                h('span', { className: 'ellipsis' }, entry.name),
              ),
            ),
          )
        : null,
    )

  const rasterModeTabs = () =>
    h(
      'div',
      { className: 'mv-geo-tabs', role: 'group', 'aria-label': t('layers.addKindRaster') },
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': rasterMode === 'online',
          className: `mv-geo-tab${rasterMode === 'online' ? ' on' : ''}`,
          disabled: locked,
          title: locked ? t('geotiff.locked') : undefined,
          onClick: () => (locked ? undefined : setRasterMode('online')),
        },
        t('geotiff.tabOnline'),
      ),
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': rasterMode === 'geotiff',
          className: `mv-geo-tab${rasterMode === 'geotiff' ? ' on' : ''}`,
          disabled: locked,
          title: locked ? t('geotiff.locked') : undefined,
          onClick: () => (locked ? undefined : setRasterMode('geotiff')),
        },
        t('geotiff.tabLocal'),
      ),
    )

  const bodyRasterOnline = () =>
    h(
      React.Fragment,
      null,
      field(
        t('layers.overlayType'),
        h(
          'select',
          { value: draft.type, onChange: (event) => patch({ type: event.target.value }) },
          ...OVERLAY_TYPES.map((type) => h('option', { key: type, value: type }, type.toUpperCase())),
        ),
      ),
      field(
        t('layers.overlayName'),
        h('input', { value: draft.name, onChange: (event) => patch({ name: event.target.value }) }),
      ),
      field(
        t('layers.overlayUrl'),
        h('input', { value: draft.url, placeholder: 'https://…', onChange: (event) => patch({ url: event.target.value }) }),
        t('menu.addRasterUrlHint'),
      ),
      onPickLocalTiles
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
                  patch({ type: 'xyz', url, name: draft.name.trim() !== '' ? draft.name : name })
                  setError('')
                })()
              },
            },
            t('settings.field.localTiles'),
          )
        : null,
      draft.type === 'wms'
        ? field(
            t('layers.overlayLayers'),
            h('input', { value: draft.layers, placeholder: 'flood:risk', onChange: (event) => patch({ layers: event.target.value }) }),
          )
        : null,
      field(
        t('layers.overlayOpacity'),
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          value: Math.round(draft.opacity * 100),
          onChange: (event) => patch({ opacity: Number(event.target.value) / 100 }),
        }),
      ),
      field(
        t('rasterTime.modeLabel'),
        h(
          'select',
          {
            value: draft.timeMode,
            onChange: (event) => {
              patch({ timeMode: event.target.value })
              setError('')
            },
          },
          h('option', { value: 'none' }, t('rasterTime.modeNone')),
          h('option', { value: 'times' }, t('rasterTime.modeTimes')),
          h('option', { value: 'frames' }, t('rasterTime.modeFrames')),
        ),
      ),
      draft.timeMode === 'times'
        ? field(
            t('rasterTime.timesLabel'),
            h('textarea', {
              value: draft.timesText,
              placeholder: t('rasterTime.timesPlaceholder'),
              onChange: (event) => patch({ timesText: event.target.value }),
            }),
            t('rasterTime.timesHint'),
          )
        : null,
      draft.timeMode === 'frames'
        ? field(
            t('rasterTime.framesLabel'),
            h('textarea', {
              value: draft.framesText,
              placeholder: t('rasterTime.framesPlaceholder'),
              onChange: (event) => patch({ framesText: event.target.value }),
            }),
          )
        : null,
      error ? h('p', { className: 'mv-note mv-danger' }, error) : null,
    )

  const bodyRaster = () =>
    h(
      React.Fragment,
      null,
      rasterModeTabs(),
      rasterMode === 'geotiff'
        ? h(GeotiffRoute, {
            t,
            onPickFolder: onPickLocalTiles ? () => onPickLocalTiles({ pickDirOnly: true }) : null,
            onOverlayAdd,
            onClose,
            onBusyChange: setGeoBusy,
          })
        : bodyRasterOnline(),
    )

  const bodyVector = () =>
    h(
      React.Fragment,
      null,
      h('p', { className: 'mv-note' }, t('layers.addVectorHint')),
      h('input', {
        ref: fileRef,
        type: 'file',
        accept: '.geojson,.json,.shp,.dbf,.prj,.cpg',
        multiple: true,
        hidden: true,
        onChange: (event) => {
          void submitVector(event.target.files)
          event.target.value = ''
        },
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'mv-add-route',
          disabled: busy,
          onClick: () => fileRef.current?.click(),
        },
        h(GlyphIcon, { name: 'import', size: 18 }),
        h('span', null, h('b', null, busy ? t('layers.importing') : t('layers.importVector')), h('em', null, t('layers.importFormats'))),
      ),
      vectorError ? h('p', { className: 'mv-note mv-danger' }, vectorError) : null,
    )

  const footer =
    kind === 'raster' && rasterMode === 'online'
      ? h(
          'div',
          { className: 'footer' },
          h('div', null),
          h(
            'div',
            { className: 'mv-dialog-actions' },
            h('button', { type: 'button', className: 'mv-cta', onClick: onClose }, t('btn.cancel')),
            h('button', { type: 'button', className: 'mv-cta primary', onClick: submitRaster }, t('layers.overlayAdd')),
          ),
        )
      : null

  return h(
    'div',
    {
      className: 'mv-modal mv-add-layer-modal',
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) requestClose()
      },
    },
    h(
      'div',
      { ref: dialogRef, className: 'mv-dialog mv-add-layer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h(
        'header',
        null,
        back(),
        h('b', { id: titleId }, kind === null ? t('layers.addTitle') : KINDS.find((entry) => entry.id === kind).title(t)),
        h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn',
            title: locked ? t('geotiff.locked') : t('btn.close'),
            'aria-label': t('btn.close'),
            disabled: locked,
            onClick: requestClose,
          },
          '✕',
        ),
      ),
      h(
        'div',
        { className: 'body' },
        kind === null ? kindChooser() : kind === '3d' ? body3d() : kind === 'raster' ? bodyRaster() : bodyVector(),
      ),
      footer,
    ),
  )
}
