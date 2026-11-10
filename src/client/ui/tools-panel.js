/**
 * ui/tools-panel.js — the "工具" card: everything that ACTS on the data.
 *
 * Meeting 132–140: analysis, measure, sun and view bookmarks must not sit next to
 * the layer list. This card is the tools home; the layer card only manages data.
 * It is presentational: every action is a callback owned by ViewerSurface.
 */
import React from 'react'

import { SunTimeline } from './sun-timeline.js'
import { ToolsBookmarks } from './tools-bookmarks.js'
import { SelectionTool } from './selection-tool.js'
import { ResizeHandle, usePanelResize } from './resizable.js'

const h = React.createElement

const MEASURE_TOOLS = [
  ['distance', 'tool.distance'],
  ['area', 'tool.area'],
  ['height', 'tool.height'],
  ['pick', 'tool.pick'],
]

export function ToolsPanel({
  t,
  tool,
  analysis,
  shaderActive,
  onCollapse,
  onStartTool,
  onClearMeasure,
  onStartProfile,
  onClearAnalysis,
  onOpenShader,
  getCesium,
  getViewer,
  getLayers,
  getCurrentView,
  onFlyView,
  onStartTour,
  showToast,
  runAnalysis,
  getTerrainActive,
  getOverlayRows,
  onRemoveOverlayRows,
  onAskAgent,
  onAskSelection,
  onVisionSelect,
  onActivateSelection,
}) {
  const resize = usePanelResize({ storageKey: 'tools', initialHeight: null, minHeight: 160, maxHeight: 700 })
  const group = (key, title, children) =>
    h('section', { key, className: 'mv-tool-group' }, h('h3', { className: 'mv-group-title' }, title), h('div', { className: 'mv-tool-group-body' }, children))

  return h(
    'div',
    { className: 'mv-tools mv-glass', ref: resize.ref, style: resize.style },
    h(
      'header',
      null,
      h('span', null, t('tools.title')),
      h(
        'div',
        { className: 'mv-head-actions' },
        h('button', { type: 'button', className: 'mv-icon-btn', title: t('tools.collapse'), 'aria-label': t('tools.collapse'), onClick: onCollapse }, '✕'),
      ),
    ),
    h(
      'div',
      { className: 'mv-tool-list' },
      group(
        'measure',
        t('tools.measure'),
        h(
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
        ),
      ),
      // Canvas selection is a tool, not a layer: box-select ground regions and
      // turn them into area/perimeter/GeoJSON without typing coordinates.
      group(
        'select',
        t('tools.select'),
        h(
          React.Fragment,
          null,
          h(SelectionTool, { t, getCesium, getViewer, showToast, runAnalysis, getTerrainActive, getOverlayRows, onRemoveOverlayRows, onActivateSelection, onAskSelection }),
          typeof onVisionSelect === 'function' ? h('button', { type: 'button', className: 'mv-cta', title: t('vision.actionHint'), onClick: onVisionSelect }, t('vision.title')) : null,
          // AI 圈选 entry: Ask Agent injects a fresh screenshot + scene summary; the
          // Agent can then read_image and draw with earth_draw. No new tool.
          typeof onAskAgent === 'function'
            ? h(
                'button',
                { type: 'button', className: 'mv-cta', title: t('tools.askAgentLookHint'), onClick: onAskAgent },
                t('tools.askAgentLook'),
              )
            : null,
        ),
      ),
      group(
        'analysis',
        t('tools.analysis'),
        h(
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
        ),
      ),
      group(
        'sun',
        t('tools.sun'),
        h(SunTimeline, {
          t,
          getCesium,
          getViewer,
          getLayers,
          onBeforeEnable: onClearAnalysis,
          active: true,
        }),
      ),
      group(
        'effects',
        t('tools.effects'),
        h(
          React.Fragment,
          null,
          h('button', { type: 'button', className: 'mv-cta', onClick: onOpenShader }, t('btn.shaderShow')),
          h(
            'p',
            { className: 'mv-none' },
            shaderActive.length > 0 ? t('tools.effectsActive', { n: shaderActive.length }) : t('tools.effectsEmpty'),
          ),
        ),
      ),
      group('view', t('tools.view'), h(ToolsBookmarks, { t, getCurrentView, onFlyView, onStartTour })),
    ),
    h(ResizeHandle, {
      axis: 'height',
      edge: 'bottom',
      label: t('resize.height'),
      value: resize.size.height,
      onPointerDown: resize.beginHeight,
      onKeyDown: resize.keyHeight,
    }),
  )
}
