import React from 'react'
import {
  ANNOTATION_KINDS,
  ANNOTATION_MAX_ATTR_KEY,
  ANNOTATION_MAX_ATTR_VALUE,
  ANNOTATION_MAX_HEIGHT_M,
  ANNOTATION_RESERVED_KEYS,
  ANNOTATION_STANDARD_KEYS,
  ANNOTATION_STYLES,
  annotationExtrusionOf,
  annotationKindOf,
  annotationStyleOf,
  extractCustomAttributes,
} from '../scene/annotation-model.js'
import { VECTOR_COLORS } from '../scene/vector-style.js'

const h = React.createElement

/**
 * VectorCard — one drawn vector feature. Read-only for agent-drawn previews;
 * editable (name / note / kind / style / coords / 3D extrusion / custom GeoJSON
 * attributes / delete / export / send to chat) when the descriptor carries the
 * command + feature it came from.
 */
export function VectorCard({ selection, onClose, onChange, onDelete, onExport, onSendToChat, t }) {
  const feature = selection?.feature ?? null
  const command = selection?.command ?? null
  const editable = Boolean(selection && feature && command)
  const geomType = feature?.geometry?.type ?? ''
  const isPoint = geomType === 'Point' && Array.isArray(feature?.geometry?.coordinates)
  const savedLon = isPoint && Number.isFinite(feature.geometry.coordinates[0]) ? feature.geometry.coordinates[0] : null
  const savedLat = isPoint && Number.isFinite(feature.geometry.coordinates[1]) ? feature.geometry.coordinates[1] : null
  const savedLonText = savedLon !== null ? String(Math.round(savedLon * 1e6) / 1e6) : ''
  const savedLatText = savedLat !== null ? String(Math.round(savedLat * 1e6) / 1e6) : ''
  const isPolygon = geomType === 'Polygon' || geomType === 'MultiPolygon'
  const shapeEditable = Boolean(editable && (geomType === 'LineString' || geomType === 'Polygon'))

  const savedName = feature?.properties?.name ?? ''
  const savedNote = feature?.properties?.note ?? ''
  const savedKind = annotationKindOf(feature)
  const savedStyle = annotationStyleOf(feature, command?.style ?? 'accent')
  const savedExtrusion = annotationExtrusionOf(feature)
  const savedAttrs = React.useMemo(() => extractCustomAttributes(feature), [feature])

  const [name, setName] = React.useState('')
  const [note, setNote] = React.useState('')
  const [kind, setKind] = React.useState('point')
  const [style, setStyle] = React.useState('accent')
  const [extruded, setExtruded] = React.useState(false)
  const [heightInput, setHeightInput] = React.useState('15')
  const [lonInput, setLonInput] = React.useState('')
  const [latInput, setLatInput] = React.useState('')
  const nextAttrId = React.useRef(1)
  const [attrs, setAttrs] = React.useState([])
  const [attrsOpen, setAttrsOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    setName(savedName)
    setNote(savedNote)
    setKind(savedKind)
    setStyle(savedStyle)
    const ext = annotationExtrusionOf(feature)
    setExtruded(ext.enabled)
    setHeightInput(String(ext.height_m))
    setLonInput(savedLonText)
    setLatInput(savedLatText)
    setAttrs(
      savedAttrs.map((item) => ({
        id: `attr-${nextAttrId.current++}`,
        key: item.key,
        value: item.text,
        editable: item.editable,
        preserveObject: !item.editable,
      })),
    )
    setAttrsOpen(savedAttrs.length > 0 && savedAttrs.length <= 6)
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

  const trimmedLon = lonInput.trim()
  const trimmedLat = latInput.trim()
  const parsedLon = Number(trimmedLon)
  const parsedLat = Number(trimmedLat)
  const coordsValid =
    !isPoint ||
    (trimmedLon !== '' &&
      trimmedLat !== '' &&
      Number.isFinite(parsedLon) &&
      Number.isFinite(parsedLat) &&
      Math.abs(parsedLon) <= 180 &&
      Math.abs(parsedLat) <= 90)
  const coordsChanged = isPoint && (trimmedLon !== savedLonText || trimmedLat !== savedLatText)

  const seenAttrKeys = new Set()
  let attrsInvalid = false
  for (const item of attrs) {
    const cleanKey = item.key.replace(/\s+/g, ' ').trim().slice(0, ANNOTATION_MAX_ATTR_KEY)
    if (
      cleanKey === '' ||
      ANNOTATION_RESERVED_KEYS.has(cleanKey) ||
      ANNOTATION_STANDARD_KEYS.has(cleanKey) ||
      seenAttrKeys.has(cleanKey)
    ) {
      attrsInvalid = true
      break
    }
    seenAttrKeys.add(cleanKey)
  }
  const attrsChanged =
    attrs.length !== savedAttrs.length ||
    attrs.some((item, index) => {
      const saved = savedAttrs[index]
      if (!saved) return true
      if (item.key.replace(/\s+/g, ' ').trim().slice(0, ANNOTATION_MAX_ATTR_KEY) !== saved.key) return true
      if (item.preserveObject) return false
      return item.value.trim().slice(0, ANNOTATION_MAX_ATTR_VALUE) !== saved.text.trim().slice(0, ANNOTATION_MAX_ATTR_VALUE)
    })

  const dirty =
    editable &&
    heightValid &&
    coordsValid &&
    !attrsInvalid &&
    (name.trim() !== savedName ||
      note.trim() !== savedNote ||
      kind !== savedKind ||
      style !== savedStyle ||
      heightChanged ||
      coordsChanged ||
      attrsChanged)

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
    if (isPoint && coordsChanged && coordsValid) {
      const alt = Array.isArray(feature.geometry.coordinates) && Number.isFinite(feature.geometry.coordinates[2])
        ? [feature.geometry.coordinates[2]]
        : []
      patch.geometry = { type: 'Point', coordinates: [parsedLon, parsedLat, ...alt] }
    }
    if (attrsChanged) {
      patch.attributes = attrs.map((item) =>
        item.preserveObject
          ? { key: item.key, preserveObject: true }
          : { key: item.key.trim(), value: item.value },
      )
    }
    onChange?.(patch)
  }

  const rows = !editable && Array.isArray(selection.rows) ? selection.rows : []
  const complexAttrCount = attrs.filter((item) => item.preserveObject).length
  const addAttrRow = () => {
    setAttrs((prev) => [
      ...prev,
      { id: `attr-${nextAttrId.current++}`, key: '', value: '', editable: true, preserveObject: false },
    ])
    setAttrsOpen(true)
  }
  const updateAttrRow = (id, field, value) => {
    setAttrs((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }
  const removeAttrRow = (id) => {
    setAttrs((prev) => prev.filter((item) => item.id !== id))
  }

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
          isPoint
            ? h(
                'div',
                { className: 'mv-vector-field' },
                h('span', { className: 'mv-vector-field-label' }, t('annotation.pointCoords')),
                h(
                  'div',
                  { className: 'mv-point-coords' },
                  h(
                    'label',
                    null,
                    h('span', null, t('annotation.lon')),
                    h('input', {
                      type: 'number',
                      step: '0.000001',
                      min: -180,
                      max: 180,
                      value: lonInput,
                      'aria-label': t('annotation.lon'),
                      onChange: (event) => setLonInput(event.target.value),
                    }),
                  ),
                  h(
                    'label',
                    null,
                    h('span', null, t('annotation.lat')),
                    h('input', {
                      type: 'number',
                      step: '0.000001',
                      min: -90,
                      max: 90,
                      value: latInput,
                      'aria-label': t('annotation.lat'),
                      onChange: (event) => setLatInput(event.target.value),
                    }),
                  ),
                ),
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
          h(
            'div',
            { className: 'mv-attr-box' },
            h(
              'div',
              { className: 'mv-attr-head' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-attr-toggle',
                  'aria-expanded': attrsOpen,
                  'aria-label': t(attrsOpen ? 'annotation.attributesCollapse' : 'annotation.attributesExpand'),
                  onClick: () => setAttrsOpen((open) => !open),
                },
                h('span', { 'aria-hidden': true }, attrsOpen ? '▾' : '▸'),
                h('span', null, `${t('annotation.attributes')}${attrs.length ? ` (${attrs.length})` : ''}`),
              ),
              h(
                'button',
                { type: 'button', className: 'mv-attr-add', onClick: addAttrRow },
                t('annotation.addAttribute'),
              ),
            ),
            attrsOpen && attrs.length > 0
              ? h(
                  'div',
                  { className: 'mv-attr-list' },
                  ...attrs.map((item) =>
                    h(
                      'div',
                      { key: item.id, className: 'mv-attr-row' },
                      h('input', {
                        type: 'text',
                        maxLength: ANNOTATION_MAX_ATTR_KEY,
                        value: item.key,
                        readOnly: item.preserveObject,
                        placeholder: t('annotation.attrKeyPlaceholder'),
                        'aria-label': t('annotation.attrKeyPlaceholder'),
                        onChange: (event) => updateAttrRow(item.id, 'key', event.target.value),
                      }),
                      item.preserveObject
                        ? h('span', { className: 'mv-attr-json', title: item.value }, item.value)
                        : h('input', {
                            type: 'text',
                            maxLength: ANNOTATION_MAX_ATTR_VALUE,
                            value: item.value,
                            placeholder: t('annotation.attrValuePlaceholder'),
                            'aria-label': item.key || t('annotation.attrValuePlaceholder'),
                            onChange: (event) => updateAttrRow(item.id, 'value', event.target.value),
                          }),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-icon-btn',
                          title: t('annotation.attrDelete'),
                          'aria-label': t('annotation.attrDelete'),
                          onClick: () => removeAttrRow(item.id),
                        },
                        '✕',
                      ),
                    ),
                  ),
                )
              : null,
            attrsOpen && complexAttrCount > 0
              ? h('span', { className: 'mv-attr-hint' }, t('annotation.attrsComplexHint', { n: complexAttrCount }))
              : null,
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
          typeof onSendToChat === 'function'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mv-btn',
                  disabled: busy,
                  title: t('annotation.sendToChatHint'),
                  onClick: () => submit(() => onSendToChat(feature, name.trim() || savedName)),
                },
                t('annotation.sendToChat'),
              )
            : null,
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
