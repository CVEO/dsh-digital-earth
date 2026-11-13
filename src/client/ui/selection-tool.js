/**
 * ui/selection-tool.js — the canvas selection tool inside the Tools card.
 *
 * Two gestures: point pick (coords/height + skyline) and rectangle drag (ground
 * polygon → area/perimeter/boundary height). Both feed the same summary/actions
 * and export GeoJSON. Scene work lives in scene/selection-tools.js.
 */
import React from 'react'

import { formatArea, formatDistance, formatHeight } from '../format.js'
import { mergeDrawGeoJSON, resolveOverlayRows } from '../scene/agent-overlays.js'
import { destinationPoint } from '../scene/screen-geodesy.js'
import { downloadText } from '../scene/download.js'
import { getSelectionTool, selectionRegion, selectionWaterHeight } from '../scene/selection-tools.js'
import { SelectionQuestion } from './selection-question.js'

const h = React.createElement

function summaryText(t, selection) {
  if (selection.kind === 'screen') return t('selection.surfaceUnavailable')
  if (selection.kind === 'objects') {
    return (selection.rows ?? []).map((row) => row.label).join('; ')
  }
  if (selection.kind === 'point') {
    return `${t('selection.lon')}: ${selection.lon}; ${t('selection.lat')}: ${selection.lat}; ${t('selection.height')}: ${
      selection.height === null ? '—' : `${selection.height} m`
    }`
  }
  const area = formatArea(selection.area_m2)
  const perimeter = formatDistance(selection.perimeter_m)
  const verts = Math.max(0, selection.ring.length - 1)
  return `${t('selection.area')}: ${area}; ${t('selection.perimeter')}: ${perimeter}; ${t('selection.vertices')}: ${verts}`
}

export function SelectionTool({ t, getCesium, getViewer, showToast, runAnalysis, getTerrainActive, getOverlayRows, onRemoveOverlayRows, onActivateSelection, onAskSelection }) {
  const [selection, setSelection] = React.useState(null)
  const [activeMode, setActiveMode] = React.useState(null)
  const toolRef = React.useRef(null)
  const viewer = typeof getViewer === 'function' ? getViewer() : null
  const commit = () => {
    setSelection(toolRef.current?.getSelection() ?? null)
    setActiveMode(null)
  }
  if (viewer) {
    toolRef.current = getSelectionTool(viewer, {
      getCesium,
      t,
      showToast,
      getOverlayRows,
      onActivate: onActivateSelection,
      onCommit: commit,
      onCancel: () => setActiveMode(null),
      onClear: () => {
        setSelection(null)
        setActiveMode(null)
      },
    })
  }
  // The session survives Tools-card unmounts, so rehydrate its state on mount.
  React.useEffect(() => {
    setSelection(toolRef.current?.getSelection() ?? null)
    setActiveMode(toolRef.current?.isActive() ? toolRef.current?.getMode?.() ?? null : null)
  }, [viewer])
  // Closing the Tools card while drawing must not leave a dangling canvas handler.
  React.useEffect(() => { const session = toolRef.current; return () => session?.cancel() }, [viewer])

  const start = (mode) => {
    const tool = toolRef.current
    if (!tool) {
      showToast?.(t('agent.notReady'))
      return
    }
    if (activeMode !== null) {
      tool.cancel()
      setActiveMode(null)
      if (activeMode === mode) return
    }
    if (tool.start(mode)) setActiveMode(mode)
  }

  const clear = () => {
    toolRef.current?.clear()
    setSelection(null)
    setActiveMode(null)
  }

  const exportGeoJSON = () => {
    const data = toolRef.current?.exportGeoJSON?.()
    if (!data) return
    const ok = downloadText(`selection-${Date.now()}.geojson`, JSON.stringify(data, null, 2), 'application/geo+json')
    showToast?.(t(ok ? 'selection.exported' : 'selection.exportFailed'))
  }

  const copySummary = () => {
    if (!selection) return
    const text = summaryText(t, selection)
    try {
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null
      if (clipboard?.writeText) {
        void clipboard.writeText(text).then(
          () => showToast?.(t('selection.copied')),
          () => showToast?.(t('selection.copyFailed')),
        )
        return
      }
    } catch {
      /* fall through to the toast */
    }
    showToast?.(t('selection.copyFailed'))
  }

  // Selection → analysis: reuse the panel's analysis command. Flood uses the
  // selection bbox and the lowest sampled boundary height; skyline uses the picked
  // point plus the current camera heading as a 300 m default view direction.
  const analyze = async (args, failureKey) => {
    if (typeof runAnalysis !== 'function') {
      showToast?.(t('agent.notReady'))
      return
    }
    try {
      await runAnalysis(args)
    } catch (error) {
      showToast?.(t(failureKey, { message: error?.message ?? String(error) }))
    }
  }
  const flood = () => {
    if (!selection) return
    const region = selectionRegion(selection)
    if (!region) {
      showToast?.(t('selection.tooSmall'))
      return
    }
    const terrain = typeof getTerrainActive === 'function' ? getTerrainActive() : false
    void analyze(
      { action: 'flood', region, water_height: selectionWaterHeight(selection), source: terrain ? 'terrain' : 'surface' },
      'selection.floodFailed',
    )
  }
  const skyline = () => {
    if (!selection || selection.kind !== 'point') return
    const camera = viewer?.camera
    const heading = camera && Number.isFinite(camera.heading) ? (camera.heading * 180) / Math.PI : 0
    const target = destinationPoint([selection.lon, selection.lat], 300, heading)
    if (!target) return
    const terrain = typeof getTerrainActive === 'function' ? getTerrainActive() : false
    void analyze(
      { action: 'skyline', from: [selection.lon, selection.lat], to: target, source: terrain ? 'terrain' : 'tiles' },
      'selection.skylineFailed',
    )
  }

  const isPoint = selection?.kind === 'point'
  const isObjects = selection?.kind === 'objects'
  const isScreen = selection?.kind === 'screen'
  const removeObjects = () => {
    const rows = selection?.rows ?? []
    const removed = typeof onRemoveOverlayRows === 'function' ? onRemoveOverlayRows(rows) : 0
    showToast?.(t('selection.objectsRemoved', { n: Number.isFinite(removed) ? removed : rows.length }))
    clear()
  }
  const exportObjects = () => {
    const merged = mergeDrawGeoJSON(resolveOverlayRows(selection?.rows, getOverlayRows?.()))
    if (!merged) {
      showToast?.(t('selection.objectsNoGeometry'))
      return
    }
    const ok = downloadText(`selection-objects-${Date.now()}.geojson`, JSON.stringify(merged, null, 2), 'application/geo+json')
    showToast?.(t(ok ? 'selection.objectsExported' : 'selection.exportFailed', { n: merged.features.length }))
  }
  const stats = []
  if (isObjects) {
    const rows = Array.isArray(selection.rows) ? selection.rows : []
    stats.push(
      h('div', { key: 'count', className: 'stat' }, h('span', null, t('selection.objectsSelected')), h('b', null, String(rows.length))),
      ...rows.slice(0, 8).map((row, index) =>
        h(
          'div',
          { key: `row-${index}-${row.kind}-${row.index}`, className: 'stat' },
          h('span', null, row.label ?? `${row.kind} ${row.index + 1}`),
          h('b', null, row.detail ?? ''),
        ),
      ),
    )
  } else if (selection?.kind === 'point') {
    stats.push(
      h('div', { key: 'lon', className: 'stat' }, h('span', null, t('selection.lon')), h('b', null, selection.lon.toFixed(6))),
      h('div', { key: 'lat', className: 'stat' }, h('span', null, t('selection.lat')), h('b', null, selection.lat.toFixed(6))),
      h(
        'div',
        { key: 'height', className: 'stat' },
        h('span', null, t('selection.height')),
        h('b', null, selection.height === null ? '—' : formatHeight(selection.height)),
      ),
    )
  } else if (selection && !isScreen) {
    stats.push(
      h('div', { key: 'area', className: 'stat' }, h('span', null, t('selection.area')), h('b', null, formatArea(selection.area_m2))),
      h('div', { key: 'perimeter', className: 'stat' }, h('span', null, t('selection.perimeter')), h('b', null, formatDistance(selection.perimeter_m))),
      selection.heightRange
        ? h(
            'div',
            { key: 'height', className: 'stat' },
            h('span', null, t('selection.heightRange')),
            h('b', null, `${formatHeight(selection.heightRange.min)} – ${formatHeight(selection.heightRange.max)}`),
          )
        : null,
      h('div', { key: 'verts', className: 'stat' }, h('span', null, t('selection.vertices')), h('b', null, `${Math.max(0, selection.ring.length - 1)}`)),
    )
  }

  return h(
    'div',
    { className: 'mv-selection' },
    h(
      'div',
      { className: 'mv-selection-actions mv-selection-modes' },
      h(
        'button',
        { type: 'button', className: `mv-cta${activeMode === 'point' ? ' primary' : ''}`, 'aria-pressed': activeMode === 'point', onClick: () => start('point') },
        t(activeMode === 'point' ? 'selection.pointActive' : 'selection.point'),
      ),
      h(
        'button',
        { type: 'button', className: `mv-cta${activeMode === 'lasso' ? ' primary' : ''}`, 'aria-pressed': activeMode === 'lasso', onClick: () => start('lasso') },
        t(activeMode === 'lasso' ? 'selection.lassoActive' : 'selection.lasso'),
      ),
      h(
        'button',
        { type: 'button', className: `mv-cta${activeMode === 'rect' ? ' primary' : ''}`, 'aria-pressed': activeMode === 'rect', onClick: () => start('rect') },
        t(activeMode === 'rect' ? 'selection.rectActive' : 'selection.rect'),
      ),
      h(
        'button',
        { type: 'button', className: `mv-cta${activeMode === 'objects' ? ' primary' : ''}`, 'aria-pressed': activeMode === 'objects', onClick: () => start('objects') },
        t(activeMode === 'objects' ? 'selection.objectsActive' : 'selection.objects'),
      ),
    ),
    h(
      'p',
      { className: 'mv-none' },
      t(
        activeMode === 'point'
          ? 'selection.pointHint'
          : activeMode === 'lasso'
            ? 'selection.lassoHint'
            : activeMode === 'objects'
              ? 'selection.objectsHint'
              : activeMode === 'rect'
                ? 'selection.dragHint'
                : 'selection.hint',
      ),
    ),
    selection
      ? h(
          React.Fragment,
          null,
          h(SelectionQuestion, { key: `${selection.created_at}-${selection.kind}`, selection, t, onAskSelection, showToast }),
          ...stats,
          selection.approximate && !isScreen ? h('p', { key: 'approx', className: 'mv-none' }, t(selection.kind === 'vision' ? 'vision.selectionApproximate' : selection.source === 'screen-visible-surface' ? 'selection.surfaceApproximate' : 'selection.approximate')) : null,
          selection.complete ? null : h('p', { key: 'partial', className: 'mv-none' }, t(isScreen ? 'selection.surfaceUnavailable' : 'selection.partial')),
          isScreen ? null : isObjects
            ? h(
                'div',
                { className: 'mv-selection-actions' },
                h('button', { type: 'button', className: 'mv-cta', onClick: removeObjects }, t('selection.objectsRemove')),
                h('button', { type: 'button', className: 'mv-cta', onClick: exportObjects }, t('selection.objectsExport')),
                h('button', { type: 'button', className: 'mv-cta', onClick: copySummary }, t('selection.objectsCopy')),
              )
            : isPoint
              ? h(
                  'div',
                  { className: 'mv-selection-actions' },
                  h('button', { type: 'button', className: 'mv-cta', onClick: () => void skyline() }, t('selection.skyline')),
                  h('button', { type: 'button', className: 'mv-cta', onClick: exportGeoJSON }, t('selection.export')),
                )
              : h(
                  'div',
                  { className: 'mv-selection-actions' },
                  h('button', { type: 'button', className: 'mv-cta', title: t('selection.floodBounds'), onClick: () => void flood() }, t('selection.flood')),
                  h('button', { type: 'button', className: 'mv-cta', onClick: exportGeoJSON }, t('selection.export')),
                ),
          h(
            'div',
            { className: 'mv-selection-actions' },
            isObjects ? null : h('button', { type: 'button', className: 'mv-cta', onClick: copySummary }, t('selection.copy')),
            h('button', { type: 'button', className: 'mv-cta', onClick: clear }, t('selection.clear')),
          ),
        )
      : null,
  )
}
