/**
 * ui/report-preview.js — the generated scene report, opened in the rail.
 *
 * The report is self-contained HTML built by scene/report.js. Rendering it with
 * `srcDoc` keeps the page in the panel (no host file URL, no new browser tab)
 * while the sandbox blocks scripts from the document.
 */
import React from 'react'

const h = React.createElement

export function ReportPreview({ t, report, onClose }) {
  if (!report?.html) return null
  const title = typeof report.title === 'string' && report.title ? report.title : t('menu.report')
  return h(
    'div',
    { className: 'mv-report-preview' },
    h(
      'header',
      { className: 'mv-report-preview-head' },
      h('span', { className: 'mv-report-preview-title', title }, title),
      h(
        'button',
        {
          type: 'button',
          className: 'mv-icon-btn',
          title: t('btn.close'),
          'aria-label': t('report.close'),
          onClick: onClose,
        },
        '✕',
      ),
    ),
    h('iframe', {
      className: 'mv-report-preview-frame',
      title,
      srcDoc: report.html,
      sandbox: '',
      referrerPolicy: 'no-referrer',
    }),
  )
}
