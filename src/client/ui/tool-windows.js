/**
 * ui/tool-windows.js — the bodies of the tool windows opened from the index.
 *
 * Each body is a small dedicated component so a tool can grow (or be replaced)
 * without touching the index or ViewerSurface. All actions stay callbacks owned by
 * ViewerSurface; these components only lay controls out.
 */
import React from 'react'

import { SunTimeline } from './sun-timeline.js'
import { ToolsBookmarks } from './tools-bookmarks.js'
import { SelectionTool } from './selection-tool.js'
import { ParseBody } from './parse-review.js'

const h = React.createElement

/**
 * Identify (read one object under the pointer) is the default canvas behaviour, so
 * it is not a measure mode here; the measure window only draws geometry.
 */
export const MEASURE_TOOLS = [
  ['distance', 'tool.distance'],
  ['area', 'tool.area'],
  ['height', 'tool.height'],
]

export function MeasureBody({ t, tool, onStartTool, onClearMeasure }) {
  return h(
    React.Fragment,
    null,
    h(
      'div',
      { className: 'mv-tool-grid' },
      ...MEASURE_TOOLS.map(([mode, labelKey]) =>
        h(
          'button',
          {
            key: mode,
            type: 'button',
            className: `mv-cta${tool === mode ? ' primary' : ''}`,
            'aria-pressed': tool === mode,
            onClick: () => onStartTool(tool === mode ? null : mode),
          },
          t(labelKey),
        ),
      ),
    ),
    h('button', { type: 'button', className: 'mv-cta', onClick: onClearMeasure }, t('tool.clear')),
    h('p', { className: 'mv-none' }, t('tools.measureHint')),
  )
}

export function SelectBody({
  t,
  getCesium,
  getViewer,
  showToast,
  runAnalysis,
  getTerrainActive,
  getOverlayRows,
  onRemoveOverlayRows,
  onActivateSelection,
  onAskSelection,
  onVisionSelect,
}) {
  return h(
    React.Fragment,
    null,
    h(SelectionTool, { t, getCesium, getViewer, showToast, runAnalysis, getTerrainActive, getOverlayRows, onRemoveOverlayRows, onActivateSelection, onAskSelection }),
    typeof onVisionSelect === 'function' ? h('button', { type: 'button', className: 'mv-cta', title: t('vision.actionHint'), onClick: onVisionSelect }, t('vision.title')) : null,
    // Ask Agent lives in the top toolbar only: one entry point for "hand the view
    // to the conversation", instead of a second one hiding inside the toolbox.
    h('p', { className: 'mv-none' }, t('tools.selectHint')),
  )
}

export function AnalysisBody({ t, analysis, onStartProfile, onClearAnalysis, getCesium, getViewer, getLayers }) {
  return h(
    React.Fragment,
    null,
    h('button', { type: 'button', className: 'mv-cta', onClick: onStartProfile }, t('profile.draw')),
    analysis
      ? h(
          'div',
          { className: 'mv-layer' },
          h(
            'span',
            { className: 'name' },
            `${
              typeof analysis.operation === 'string' && analysis.operation !== ''
                ? t(`analysis.title.${analysis.operation}`)
                : t('layers.analysis')
            }${typeof analysis.layerName === 'string' && analysis.layerName !== '' ? ` · ${analysis.layerName}` : ''}`,
          ),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('layers.analysisClear'), 'aria-label': t('layers.analysisClear'), onClick: onClearAnalysis }, '✕'),
        )
      : null,
    h('p', { className: 'mv-none' }, t('tools.analysisHint')),
    h('div', { className: 'mv-group-title' }, t('tools.sun')),
    h(SunTimeline, { t, getCesium, getViewer, getLayers, onBeforeEnable: onClearAnalysis, active: true }),
  )
}

export function EffectsBody({ t, shaderActive, onOpenShader }) {
  return h(
    React.Fragment,
    null,
    h('button', { type: 'button', className: 'mv-cta', onClick: onOpenShader }, t('btn.shaderShow')),
    h('p', { className: 'mv-none' }, shaderActive.length > 0 ? t('tools.effectsActive', { n: shaderActive.length }) : t('tools.effectsEmpty')),
  )
}

export function ViewBody({ t, getCurrentView, onFlyView, onStartTour }) {
  return h(ToolsBookmarks, { t, getCurrentView, onFlyView, onStartTour })
}

export function AnnotationBody({ t, onStartAnnotation }) {
  return h(
    React.Fragment,
    null,
    h(
      'div',
      { className: 'mv-tool-grid' },
      ...['point', 'line', 'area'].map((kind) =>
        h(
          'button',
          {
            key: kind,
            type: 'button',
            className: 'mv-cta',
            onClick: () => (typeof onStartAnnotation === 'function' ? onStartAnnotation(kind) : null),
          },
          t(`annotation.draw${kind[0].toUpperCase()}${kind.slice(1)}`),
        ),
      ),
    ),
    h('p', { className: 'mv-none' }, t('annotation.drawHint')),
  )
}

/** Route one open window id to its body; unknown ids render nothing. */
export function ToolBody({ entryId, ...rest }) {
  if (entryId === 'measure') return h(MeasureBody, rest)
  if (entryId === 'select') return h(SelectBody, rest)
  if (entryId === 'annotation') return h(AnnotationBody, rest)
  if (entryId === 'parse') return h(ParseBody, rest)
  if (entryId === 'analysis') return h(AnalysisBody, rest)
  if (entryId === 'effects') return h(EffectsBody, rest)
  if (entryId === 'view') return h(ViewBody, rest)
  return null
}
