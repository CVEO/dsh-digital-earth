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
import { ANNOTATION_STYLES } from '../scene/annotation-model.js'
import { VECTOR_COLORS } from '../scene/vector-style.js'

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
  const [source, setSource] = React.useState('tiles')
  const [samples, setSamples] = React.useState(32)
  return h(
    React.Fragment,
    null,
    h('button', { type: 'button', className: 'mv-cta primary', onClick: () => onStartProfile({ source, samples }) }, t('profile.draw')),
    h('p', { className: 'mv-none' }, t('profile.subtitle')),
    h(
      'div',
      { className: 'mv-profile-opts' },
      h(
        'label',
        { className: 'mv-profile-opt' },
        h('span', null, t('profile.sourceLabel')),
        h(
          'select',
          {
            value: source,
            'aria-label': t('profile.sourceLabel'),
            onChange: (event) => setSource(event.target.value),
          },
          h('option', { value: 'tiles' }, t('profile.sourceTiles')),
          h('option', { value: 'terrain' }, t('profile.sourceTerrain')),
        ),
      ),
      h(
        'label',
        { className: 'mv-profile-opt' },
        h('span', null, t('profile.samplesLabel')),
        h(
          'select',
          {
            value: String(samples),
            'aria-label': t('profile.samplesLabel'),
            onChange: (event) => setSamples(Number(event.target.value) || 32),
          },
          h('option', { value: '16' }, t('profile.samplesOption', { n: 16 })),
          h('option', { value: '32' }, t('profile.samplesOption', { n: 32 })),
          h('option', { value: '64' }, t('profile.samplesOption', { n: 64 })),
        ),
      ),
    ),
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
  const list = Array.isArray(shaderActive) ? shaderActive : []
  return h(
    React.Fragment,
    null,
    h('button', { type: 'button', className: 'mv-cta primary', onClick: onOpenShader }, t('btn.shaderShow')),
    list.length > 0
      ? h(
          'div',
          { className: 'mv-tool-effects-list' },
          ...list.slice(0, 6).map((entry) =>
            h(
              'div',
              { key: entry.layerId ?? entry.layer, className: 'mv-layer has-shader' },
              h('span', { className: 'name', title: entry.layer }, entry.layer),
              h('span', { className: 'mv-tools-active-pill' }, Array.isArray(entry.presets) ? entry.presets.join(' + ') : entry.preset),
            ),
          ),
        )
      : null,
    h('p', { className: 'mv-none' }, list.length > 0 ? t('tools.effectsActive', { n: list.length }) : t('tools.effectsEmpty')),
  )
}

export function ViewBody({ t, getCurrentView, onFlyView, onStartTour }) {
  return h(ToolsBookmarks, { t, getCurrentView, onFlyView, onStartTour })
}

export function AnnotationBody({ t, onStartAnnotation }) {
  const [style, setStyle] = React.useState('accent')
  return h(
    React.Fragment,
    null,
    h(
      'div',
      { className: 'mv-tool-grid' },
      ...['point', 'line', 'area', 'note'].map((kind) =>
        h(
          'button',
          {
            key: kind,
            type: 'button',
            className: 'mv-cta',
            onClick: () => (typeof onStartAnnotation === 'function' ? onStartAnnotation(kind, style) : null),
          },
          t(`annotation.draw${kind[0].toUpperCase()}${kind.slice(1)}`),
        ),
      ),
    ),
    h(
      'div',
      { className: 'mv-anno-palette', role: 'radiogroup', 'aria-label': t('annotation.styleLabel') },
      h('span', { className: 'mv-anno-palette-label' }, t('annotation.styleLabel')),
      h(
        'div',
        { className: 'mv-swatch-row' },
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
