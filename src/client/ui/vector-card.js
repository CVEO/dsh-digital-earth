import React from 'react'

const h = React.createElement

export function VectorCard({ selection, onClose, t }) {
  if (!selection) return null
  return h('section', { className: 'mv-vector-card', 'aria-label': t('vector.selection') },
    h('header', null,
      h('div', null, h('span', { className: 'eyebrow' }, selection.kind), h('h3', null, selection.title)),
      h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: onClose }, '✕')),
    selection.summary ? h('p', { className: 'summary' }, selection.summary) : null,
    selection.rows?.length ? h('dl', null, selection.rows.map(([name, value], index) =>
      h('div', { key: index }, h('dt', null, name), h('dd', null, value)))) : null,
    h('footer', null, t('vector.selectedHint')))
}
