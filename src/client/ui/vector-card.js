import React from 'react'

const h = React.createElement

/**
 * VectorCard — one drawn vector feature. Read-only for agent-drawn previews;
 * editable (name / note / delete / export) when the descriptor carries the
 * command + feature it came from, which is what the annotation layer needs.
 */
export function VectorCard({ selection, onClose, onChange, onDelete, onExport, t }) {
  if (!selection) return null
  const feature = selection.feature ?? null
  const editable = Boolean(feature && selection.command)
  const [name, setName] = React.useState('')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    setName(feature?.properties?.name ?? '')
    setNote(feature?.properties?.note ?? '')
  }, [feature])
  const savedName = feature?.properties?.name ?? ''
  const savedNote = feature?.properties?.note ?? ''
  const dirty = editable && (name.trim() !== savedName || note.trim() !== savedNote)
  const submit = (fn) => {
    if (!fn || busy) return
    setBusy(true)
    try { fn() } finally { setBusy(false) }
  }
  return h('section', { className: 'mv-vector-card', 'aria-label': t('vector.selection') },
    h('header', null,
      h('div', null, h('span', { className: 'eyebrow' }, selection.kind), h('h3', null, selection.title)),
      h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: onClose }, '✕')),
    selection.summary ? h('p', { className: 'summary' }, selection.summary) : null,
    editable ? h('div', { className: 'mv-vector-edit' },
      h('label', null, h('span', null, t('annotation.name')),
        h('input', {
          value: name,
          maxLength: 80,
          placeholder: t('annotation.namePlaceholder'),
          onChange: (event) => setName(event.target.value),
        })),
      h('label', null, h('span', null, t('annotation.note')),
        h('textarea', {
          value: note,
          maxLength: 280,
          rows: 2,
          placeholder: t('annotation.notePlaceholder'),
          onChange: (event) => setNote(event.target.value),
        }))) : null,
    selection.rows?.length ? h('dl', null, selection.rows.map(([itemName, value], index) =>
      h('div', { key: index }, h('dt', null, itemName), h('dd', null, value)))) : null,
    editable ? h('footer', { className: 'mv-vector-actions' },
      h('button', {
        type: 'button', className: 'mv-btn', disabled: !dirty || busy,
        onClick: () => submit(() => onChange?.({ name: name.trim(), note: note.trim() })),
      }, t('annotation.save')),
      h('button', { type: 'button', className: 'mv-btn', disabled: busy, onClick: () => submit(() => onExport?.()) }, t('annotation.export')),
      h('button', { type: 'button', className: 'mv-btn mv-danger', disabled: busy, onClick: () => submit(() => onDelete?.()) }, t('annotation.delete'))) : null,
    h('footer', null, editable ? t('annotation.editHint') : t('vector.selectedHint')))
}
