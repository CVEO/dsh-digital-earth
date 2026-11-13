import React from 'react'
import {
  ANNOTATION_KINDS,
  ANNOTATION_MAX_HEIGHT_M,
  ANNOTATION_STYLES,
  annotationExtrusionOf,
  annotationKindOf,
  annotationStyleOf,
} from '../scene/annotation-model.js'
import { VECTOR_COLORS } from '../scene/vector-style.js'

const h = React.createElement
const EDITABLE_HIDDEN_KEYS = new Set(['note', 'kind', 'style', 'extruded', 'extruded_height_m', 'extrudedHeight', 'height_m'])

/**
 * VectorCard — one drawn vector feature. Read-only for agent-drawn previews;
 * editable (name / note / kind / style / 3D extrusion / delete / export) when
 * the descriptor carries the command + feature it came from.
 */
export function VectorCard({ selection, onClose, onChange, onDelete, onExport, t }) {
  const feature = selection?.feature ?? null
  const command = selection?.command ?? null
  const editable = Boolean(selection && feature && command)
  const geomType = feature?.geometry?.type ?? ''
  const isPolygon = geomType === 'Polygon' || geomType === 'MultiPolygon'
  const shapeEditable = Boolean(editable && (geomType === 'LineString' || geomType === 'Polygon'))

  const savedName = feature?.properties?.name ?? ''
  const savedNote = feature?.properties?.note ?? ''
  const savedKind = annotationKindOf(feature)
  const savedStyle = annotationStyleOf(feature, command?.style ?? 'accent')
  const savedExtrusion = annotationExtrusionOf(feature)

  const [name, setName] = React.useState('')
  const [note, setNote] = React.useState('')
  const [kind, setKind] = React.useState('point')
  const [style, setStyle] = React.useState('accent')
  const [extruded, setExtruded] = React.useState(false)
  const [heightInput, setHeightInput] = React.useState('15')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    setName(savedName)
    setNote(savedNote)
    setKind(savedKind)
    setStyle(savedStyle)
    const ext = annotationExtrusionOf(feature)
    setExtruded(ext.enabled)
    setHeightInput(String(ext.height_m))
  }, [feature, command])

  if (!selection) return null

  const trimmedHeight = heightInput.trim()
  const parsedHeight = Number(trimmedHeight)
  const heightValid =
    !isPolygon ||
    !extruded ||
    (trimmedHeight !== '' && Number.isFinite(parsedHeight) && parsedHeight > 0 && parsedHeight <= ANNOTATION_MAX_HEIGHT_M)
  const heightChanged =
    isPolygon &&
    (extruded !== savedExtrusion.enabled ||
      (extruded && heightValid && Math.abs(parsedHeight - savedExtrusion.height_m) > 1e-4))
  const dirty =
    editable &&
    heightValid &&
    (name.trim() !== savedName ||
      note.trim() !== savedNote ||
      kind !== savedKind ||
      style !== savedStyle ||
      heightChanged)

  const submit = (fn) => {
    if (!fn || busy) return
    setBusy(true)
    try {
      fn()
    } finally {
      setBusy(false)
    }
  }

  const savePatch = () => {
    const patch = {
      name: name.trim(),
      note: note.trim(),
      kind,
      style,
    }
    if (isPolygon) {
      if (extruded) {
        patch.extruded = true
        patch.height_m = Math.round(parsedHeight * 100) / 100
      } else if (savedExtrusion.enabled || feature?.properties?.extruded !== undefined || savedExtrusion.has_height) {
        patch.extruded = false
      }
    }
    onChange?.(patch)
  }

  const rows = (Array.isArray(selection.rows) ? selection.rows : []).filter(
    ([rowKey]) => !editable || !EDITABLE_HIDDEN_KEYS.has(rowKey),
  )

  return h(
    'section',
    { className: 'mv-vector-card', 'aria-label': t('vector.selection') },
    h(
      'header',
      null,
      h(
        'div',
        null,
        h('span', { className: 'eyebrow' }, selection.kind),
        h('h3', null, selection.title),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'mv-icon-btn',
          title: t('btn.close'),
          'aria-label': t('btn.close'),
          onClick: onClose,
        },
        '✕',
      ),
    ),
    selection.summary ? h('p', { className: 'summary' }, selection.summary) : null,
    editable
      ? h(
          'div',
          { className: 'mv-vector-edit' },
          h(
            'label',
            null,
            h('span', null, t('annotation.name')),
            h('input', {
              value: name,
              maxLength: 80,
              placeholder: t('annotation.namePlaceholder'),
              onChange: (event) => setName(event.target.value),
            }),
          ),
          h(
            'div',
            { className: 'mv-vector-row-2' },
            h(
              'label',
              null,
              h('span', null, t('annotation.kindLabel')),
              h(
                'select',
                {
                  value: kind,
                  'aria-label': t('annotation.kindLabel'),
                  onChange: (event) => setKind(event.target.value),
                },
                ...ANNOTATION_KINDS.map((item) => h('option', { key: item, value: item }, t(`annotation.kind.${item}`))),
              ),
            ),
            h(
              'div',
              { className: 'mv-vector-field' },
              h('span', { className: 'mv-vector-field-label' }, t('annotation.styleLabel')),
              h(
                'div',
                { className: 'mv-swatch-row', role: 'radiogroup', 'aria-label': t('annotation.styleLabel') },
                ...ANNOTATION_STYLES.map((preset) =>
                  h('button', {
                    key: preset,
                    type: 'button',
                    className: `mv-swatch${style === preset ? ' on' : ''}`,
                    style: { '--mv-swatch': VECTOR_COLORS[preset] },
                    title: t(`annotation.style.${preset}`),
                    'aria-label': t(`annotation.style.${preset}`),
                    'aria-checked': style === preset,
                    role: 'radio',
                    onClick: () => setStyle(preset),
                  }),
                ),
              ),
            ),
          ),
          isPolygon
            ? h(
                'div',
                { className: 'mv-extrude-box' },
                h(
                  'label',
                  { className: 'mv-extrude-toggle' },
                  h('input', {
                    type: 'checkbox',
                    checked: extruded,
                    onChange: (event) => setExtruded(Boolean(event.target.checked)),
                  }),
                  h('span', null, t('annotation.extrude3d')),
                ),
                extruded
                  ? h(
                      'label',
                      { className: 'mv-extrude-height' },
                      h('span', null, t('annotation.extrudeHeight')),
                      h('input', {
                        type: 'number',
                        min: 0.5,
                        max: ANNOTATION_MAX_HEIGHT_M,
                        step: 0.5,
                        value: heightInput,
                        'aria-label': t('annotation.extrudeHeight'),
                        onChange: (event) => setHeightInput(event.target.value),
                      }),
                    )
                  : h('span', { className: 'mv-extrude-hint' }, t('annotation.extrudeHint')),
              )
            : null,
          h(
            'label',
            null,
            h('span', null, t('annotation.note')),
            h('textarea', {
              value: note,
              maxLength: 280,
              rows: 2,
              placeholder: t('annotation.notePlaceholder'),
              onChange: (event) => setNote(event.target.value),
            }),
          ),
        )
      : null,
    rows.length
      ? h(
          'dl',
          null,
          rows.map(([itemName, value], index) =>
            h('div', { key: index }, h('dt', null, itemName), h('dd', null, value)),
          ),
        )
      : null,
    shapeEditable ? h('p', { className: 'mv-vector-shortcuts' }, t('annotation.shortcutHint')) : null,
    editable
      ? h(
          'footer',
          { className: 'mv-vector-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'mv-btn',
              disabled: !dirty || busy,
              onClick: () => submit(savePatch),
            },
            t('annotation.save'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mv-btn',
              disabled: busy,
              onClick: () => submit(() => onExport?.()),
            },
            t('annotation.export'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mv-btn mv-danger',
              disabled: busy,
              onClick: () => submit(() => onDelete?.()),
            },
            t('annotation.delete'),
          ),
        )
      : null,
    h('footer', null, editable ? t('annotation.editHint') : t('vector.selectedHint')),
  )
}
