/**
 * ui/parse-review.js — F6 scene parsing panel body (Plan C self-contained).
 *
 * Self-contained workflow: draw a ground AOI (rect/lasso) or use the current
 * view, pick target classes (building/road/vegetation/water/vehicle), run the
 * vision parser with actionable diagnostics (including sent-frame preview when
 * objects fail projection), then review, toggle 3D extrusion, and adopt.
 */
import React from 'react'

import { loadMeta } from '../api.js'
import { formatArea } from '../format.js'
import { getSelectionTool, peekSelection, subscribeSelection } from '../scene/selection-tools.js'
import { parseClassColor } from '../scene/vector-style.js'
import {
  PARSE_CLASSES,
  applyExtrusionToFeatures,
  batchClassCounts,
  batchFeatureCollection,
  captureSceneFrame,
  clearBatchPreview,
  compareBatchFeatures,
  dedupeBatchFeatures,
  drawBatchPreview,
  filterBatchFeatures,
  isAoiSelectionCapable,
  projectBatchObjects,
  refineBatchMetricsWithHeightService,
  requestSceneParse,
} from '../scene/vision-batch.js'

const h = React.createElement
const TARGET_CLASSES = ['building', 'road', 'vegetation', 'water', 'vehicle']

function candidateMetricText(properties, t) {
  const parts = []
  const height = properties?.height_m
  const floors = properties?.est_floors
  const area = properties?.area_m2
  if (typeof height === 'number' && Number.isFinite(height) && height >= 0.5) {
    parts.push(`≈${Math.round(height)}m`)
  }
  if (typeof floors === 'number' && Number.isFinite(floors) && floors >= 1 && typeof t === 'function') {
    parts.push(t('parse.floors', { n: floors }))
  }
  if (typeof area === 'number' && Number.isFinite(area) && area > 0) {
    parts.push(area >= 1e4 ? `${(area / 1e4).toFixed(2)}ha` : `${Math.round(area)}m²`)
  }
  return parts.join(' · ')
}

function errorText(t, code) {
  const text = t(`parse.err.${code}`)
  return text === `parse.err.${code}` ? code : text
}

function confidenceText(t, value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? t('parse.confidence', { n: Math.round(value * 100) })
    : t('parse.confidenceUnknown')
}

export function ParseBody({ t, getCesium, getViewer, getLayers, showToast, onAdoptParse, openRequest, getSelection, onActivateSelection }) {
  const [stage, setStage] = React.useState(null)
  const [scope, setScope] = React.useState(() => ((openRequest?.aoiSeq ?? 0) > 0 ? 'aoi' : 'view'))
  const [parsedScope, setParsedScope] = React.useState('view')
  const [drawMode, setDrawMode] = React.useState(null)
  const [selectionTick, setSelectionTick] = React.useState(0)
  const [targets, setTargets] = React.useState(() => new Set())
  const [candidates, setCandidates] = React.useState([])
  const [selected, setSelected] = React.useState(() => new Set())
  const [filter, setFilter] = React.useState('all')
  const [sortBy, setSortBy] = React.useState('default')
  const [extrude3d, setExtrude3d] = React.useState(true)
  const [skipped, setSkipped] = React.useState(0)
  const [error, setError] = React.useState(null)
  const [diag, setDiag] = React.useState(null)
  const [hasRun, setHasRun] = React.useState(false)
  const previewRef = React.useRef([])
  const aliveRef = React.useRef(true)
  const abortRef = React.useRef(null)
  const lastAoiSeqRef = React.useRef(openRequest?.aoiSeq ?? 0)

  const viewer = getViewer?.()

  React.useEffect(() => {
    const seq = openRequest?.aoiSeq ?? 0
    if (seq > 0 && seq !== lastAoiSeqRef.current) {
      lastAoiSeqRef.current = seq
      setScope('aoi')
      setSelectionTick((n) => n + 1)
    }
  }, [openRequest?.aoiSeq])

  React.useEffect(() => {
    if (!viewer) return undefined
    return subscribeSelection(viewer, ({ type, selection }) => {
      if (!aliveRef.current) return
      setSelectionTick((n) => n + 1)
      if (type === 'commit') {
        setDrawMode(null)
        if (isAoiSelectionCapable(selection)) setScope('aoi')
      } else if (type === 'cancel') {
        setDrawMode(null)
      } else if (type === 'clear') {
        setDrawMode(null)
      }
    })
  }, [viewer])

  React.useEffect(() => () => {
    aliveRef.current = false
    abortRef.current?.abort?.()
    abortRef.current = null
    clearBatchPreview(getViewer(), previewRef.current)
  }, [])

  // Read live AOI selection (re-evaluated whenever selectionTick advances).
  void selectionTick
  const activeSelection = (typeof getSelection === 'function' ? getSelection() : null) ?? peekSelection(viewer)
  const aoiReady = isAoiSelectionCapable(activeSelection)
  const effectiveScope = scope === 'aoi' && aoiReady ? 'aoi' : 'view'

  const bus = typeof stage === 'string'
  const stageText = stage ? t(`parse.stage.${stage}`) : ''

  const startDrawAoi = (mode) => {
    const currentViewer = getViewer?.()
    if (!currentViewer) {
      showToast?.(t('agent.notReady'))
      return
    }
    const tool = getSelectionTool(currentViewer, {
      getCesium,
      t,
      showToast,
      onActivate: onActivateSelection,
    })
    if (!tool) return
    if (drawMode !== null) {
      tool.cancel()
      setDrawMode(null)
      if (drawMode === mode) return
    }
    setScope('aoi')
    if (tool.start(mode)) setDrawMode(mode)
  }

  const clearAoi = () => {
    const currentViewer = getViewer?.()
    if (currentViewer) getSelectionTool(currentViewer, {})?.clear()
    setDrawMode(null)
    setSelectionTick((n) => n + 1)
  }

  const toggleTarget = (kind) => {
    if (kind === 'all') {
      setTargets(new Set())
      return
    }
    setTargets((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      if (next.size >= TARGET_CLASSES.length) return new Set()
      return next
    })
  }

  const redrawPreview = (items, nextExtrude) => {
    const Cesium = getCesium()
    const currentViewer = getViewer()
    if (!currentViewer) return
    clearBatchPreview(currentViewer, previewRef.current)
    if (Cesium && items.length > 0) {
      previewRef.current = drawBatchPreview(Cesium, currentViewer, items, { extrude: nextExtrude })
    }
  }

  const resetPreview = () => {
    clearBatchPreview(getViewer(), previewRef.current)
    setCandidates([])
    setSelected(new Set())
    setFilter('all')
    setSortBy('default')
    setSkipped(0)
    setError(null)
    setDiag(null)
    setHasRun(false)
  }

  const cancelParse = () => {
    abortRef.current?.abort?.()
  }

  const parse = async () => {
    if (bus) return
    if (scope === 'aoi' && !aoiReady) {
      showToast?.(t('parse.scopeAoiNone'))
      return
    }
    const Cesium = getCesium()
    const currentViewer = getViewer()
    if (!Cesium || !currentViewer) { setError('not_ready'); return }
    resetPreview()
    setHasRun(true)
    let frame = null
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    abortRef.current = controller
    const targetList = targets.size > 0 ? [...targets] : null
    try {
      setStage('capture')
      frame = captureSceneFrame({
        viewer: currentViewer,
        Cesium,
        getLayers: typeof getLayers === 'function' ? getLayers : () => [],
        selection: activeSelection,
        scope: effectiveScope,
      })
      setStage('request')
      const meta = await loadMeta()
      if (!aliveRef.current || controller?.signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'cancelled' })
      if (!meta?.visionBatchUrl) throw Object.assign(new Error('unavailable'), { code: 'unavailable' })
      const payload = await requestSceneParse(meta.visionBatchUrl, { frame, classes: targetList, signal: controller?.signal })
      if (!aliveRef.current) return
      const filteredObjects = targetList
        ? payload.objects.filter((item) => targetList.includes(item?.class))
        : payload.objects
      setStage('project')
      const projected = projectBatchObjects(frame, filteredObjects, { t })
      let resolvedFeatures = projected.features
      if (resolvedFeatures.length > 0) {
        setStage('heights')
        const refined = await refineBatchMetricsWithHeightService(frame, resolvedFeatures, {
          getLayers: typeof getLayers === 'function' ? getLayers : () => [],
        })
        if (!aliveRef.current) return
        resolvedFeatures = refined.features
      }
      const deduped = dedupeBatchFeatures(resolvedFeatures)
      if (!aliveRef.current) return
      if (deduped.length === 0) {
        setDiag({
          rawCount: filteredObjects.length,
          thumbUrl: frame.dataUrl,
          width: frame.width,
          height: frame.height,
        })
        setError(filteredObjects.length > 0 ? 'all_skipped' : 'no_target')
        return
      }
      setParsedScope(frame.scope === 'aoi' ? 'aoi' : 'view')
      setCandidates(deduped)
      setSelected(new Set(deduped.map((_, index) => index)))
      setFilter('all')
      setSkipped(projected.skipped)
      setDiag(null)
      previewRef.current = drawBatchPreview(Cesium, currentViewer, deduped, { extrude: extrude3d })
      showToast(t('parse.candidates', { n: deduped.length }))
    } catch (failure) {
      if (!aliveRef.current) return
      const code = controller?.signal?.aborted || failure?.name === 'AbortError' ? 'cancelled' : (failure?.code ?? 'model_failed')
      if (frame?.dataUrl && code !== 'cancelled') {
        setDiag({ rawCount: 0, thumbUrl: frame.dataUrl, width: frame.width, height: frame.height })
      }
      setError(code)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      try { frame?.release?.() } catch { /* frame release is best effort */ }
      if (aliveRef.current) setStage(null)
    }
  }

  const toggle = (index) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const counts = batchClassCounts(candidates)
  const buildingCount = counts.building ?? 0
  const extraClasses = PARSE_CLASSES.filter((kind) => kind !== 'building' && (counts[kind] ?? 0) > 0)
  const visibleEntries = candidates
    .map((feature, index) => ({ feature, index }))
    .filter(({ feature }) => filter === 'all' || feature?.properties?.class === filter)
    .sort((left, right) => compareBatchFeatures(left.feature, right.feature, sortBy) || (left.index - right.index))

  const changeFilter = (nextFilter) => {
    setFilter(nextFilter)
    redrawPreview(filterBatchFeatures(candidates, nextFilter), extrude3d)
  }

  const toggleExtrude = () => {
    const next = !extrude3d
    setExtrude3d(next)
    redrawPreview(filterBatchFeatures(candidates, filter), next)
  }

  const adoptFeatures = (rawFeatures, label) => {
    if (rawFeatures.length === 0) { showToast(t('parse.adoptSelected')); return }
    const features = applyExtrusionToFeatures(rawFeatures, extrude3d)
    const ok = typeof onAdoptParse === 'function'
      ? onAdoptParse(batchFeatureCollection(features, label), label)
      : false
    if (ok !== false) {
      clearBatchPreview(getViewer(), previewRef.current)
      setCandidates([])
      setSelected(new Set())
      setFilter('all')
      setHasRun(false)
    }
  }

  const adopt = (indexes) => {
    adoptFeatures(candidates.filter((_, index) => indexes.has(index)), t('tools.parse'))
  }

  const selectedBuildings = candidates.filter((feature, index) => selected.has(index) && feature?.properties?.class === 'building')
  const adoptBuildings = () => {
    const list = selectedBuildings.length > 0 ? selectedBuildings : filterBatchFeatures(candidates, 'building')
    adoptFeatures(list, t('parse.buildingsLayerName'))
  }

  const aoiAreaText = aoiReady && Number.isFinite(activeSelection?.area_m2) ? formatArea(activeSelection.area_m2) : '—'
  const runDisabled = bus || (scope === 'aoi' && !aoiReady)

  return h(
    'div',
    { className: 'mv-parse' },
    h(
      'div',
      { className: 'mv-parse-scope' },
      h(
        'button',
        {
          type: 'button',
          className: `mv-parse-scope-btn${scope === 'view' ? ' on' : ''}`,
          'aria-pressed': scope === 'view',
          disabled: bus,
          onClick: () => setScope('view'),
        },
        t('parse.scopeView'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: `mv-parse-scope-btn${scope === 'aoi' ? ' on' : ''}`,
          'aria-pressed': scope === 'aoi',
          disabled: bus,
          title: t(aoiReady ? 'parse.scopeAoiReady' : 'parse.scopeAoiNone'),
          onClick: () => setScope('aoi'),
        },
        t('parse.scopeAoi'),
      ),
    ),
    scope === 'aoi'
      ? aoiReady
        ? h(
            'div',
            { className: 'mv-parse-aoi-bar' },
            h(
              'span',
              { className: 'mv-parse-aoi-bar-info' },
              h('span', { className: 'mv-parse-aoi-bar-dot', 'aria-hidden': true }),
              t('parse.aoiReadyLabel', { area: aoiAreaText }),
            ),
            h(
              'span',
              { className: 'mv-parse-aoi-bar-actions' },
              h('button', { type: 'button', className: 'mv-parse-mini-btn', disabled: bus, onClick: () => startDrawAoi('rect') }, t('parse.drawRect')),
              h('button', { type: 'button', className: 'mv-parse-mini-btn', disabled: bus, onClick: () => startDrawAoi('lasso') }, t('parse.drawLasso')),
              h('button', { type: 'button', className: 'mv-parse-mini-btn', disabled: bus, onClick: clearAoi }, t('parse.aoiClear')),
            ),
          )
        : h(
            'div',
            { className: 'mv-parse-aoi-box' },
            h(
              'div',
              { className: 'mv-tool-grid' },
              h(
                'button',
                { type: 'button', className: `mv-cta${drawMode === 'rect' ? ' primary' : ''}`, 'aria-pressed': drawMode === 'rect', disabled: bus, onClick: () => startDrawAoi('rect') },
                t(drawMode === 'rect' ? 'parse.drawRectActive' : 'parse.drawRect'),
              ),
              h(
                'button',
                { type: 'button', className: `mv-cta${drawMode === 'lasso' ? ' primary' : ''}`, 'aria-pressed': drawMode === 'lasso', disabled: bus, onClick: () => startDrawAoi('lasso') },
                t(drawMode === 'lasso' ? 'parse.drawLassoActive' : 'parse.drawLasso'),
              ),
            ),
            h('p', { className: 'mv-none', style: { margin: 0, padding: 0 } }, t(drawMode ? 'parse.drawHint' : 'parse.scopeAoiNone')),
          )
      : null,
    h(
      'div',
      { className: 'mv-parse-targets' },
      h('span', { className: 'mv-parse-sec-label' }, t('parse.targetsLabel')),
      h(
        'div',
        { className: 'mv-parse-target-row' },
        h(
          'button',
          {
            type: 'button',
            className: `mv-parse-target${targets.size === 0 ? ' on' : ''}`,
            'aria-pressed': targets.size === 0,
            disabled: bus,
            onClick: () => toggleTarget('all'),
          },
          t('parse.targetsAll'),
        ),
        ...TARGET_CLASSES.map((kind) =>
          h(
            'button',
            {
              key: kind,
              type: 'button',
              className: `mv-parse-target${targets.has(kind) ? ' on' : ''}`,
              'aria-pressed': targets.has(kind),
              disabled: bus,
              onClick: () => toggleTarget(kind),
            },
            h('span', { className: 'mv-parse-dot', 'aria-hidden': true, style: { background: parseClassColor(kind).hex } }),
            t(`parse.class.${kind}`),
          ),
        ),
      ),
    ),
    h(
      'div',
      { className: 'mv-parse-run-row' },
      h(
        'button',
        { type: 'button', className: 'mv-cta primary', disabled: runDisabled, onClick: parse },
        bus ? t('parse.running', { stage: stageText }) : t('parse.run'),
      ),
      bus
        ? h('button', { type: 'button', className: 'mv-cta', onClick: cancelParse }, t('parse.cancel'))
        : candidates.length > 0
          ? h('button', { type: 'button', className: 'mv-cta', onClick: resetPreview }, t('parse.clear'))
          : null,
    ),
    error
      ? h(
          'div',
          { className: 'mv-parse-diag', role: 'status' },
          h(
            'span',
            null,
            error === 'all_skipped' && diag?.rawCount > 0
              ? t('parse.diagAllSkipped', { n: diag.rawCount })
              : t('parse.failed', { reason: errorText(t, error) }),
          ),
          diag?.thumbUrl
            ? h(
                'div',
                { className: 'mv-parse-diag-thumb' },
                h('img', { src: diag.thumbUrl, alt: t('parse.diagSnapshot', { w: diag.width, h: diag.height }) }),
                h('span', null, t('parse.diagSnapshot', { w: diag.width, h: diag.height })),
              )
            : null,
        )
      : null,
    candidates.length > 0
      ? h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'mv-parse-head' },
          h('span', { className: 'mv-parse-count' }, t('parse.candidates', { n: candidates.length })),
          parsedScope === 'aoi' ? h('span', { className: 'mv-parse-aoi-tag' }, t('parse.aoiTag')) : null,
          h('span', { className: 'mv-parse-selected' }, t('parse.selected', { n: selected.size, total: candidates.length })),
        ),
        h(
          'div',
          { className: 'mv-parse-controls' },
          h(
            'div',
            { className: 'mv-parse-filters' },
            h(
              'button',
              { type: 'button', className: `mv-parse-filter${filter === 'all' ? ' on' : ''}`, 'aria-pressed': filter === 'all', onClick: () => changeFilter('all') },
              t('parse.filterAll', { n: candidates.length }),
            ),
            buildingCount > 0
              ? h(
                  'button',
                  { type: 'button', className: `mv-parse-filter${filter === 'building' ? ' on' : ''}`, 'aria-pressed': filter === 'building', onClick: () => changeFilter('building') },
                  h('span', { className: 'mv-parse-dot', 'aria-hidden': true, style: { background: parseClassColor('building').hex } }),
                  t('parse.filterBuildings', { n: buildingCount }),
                )
              : null,
            ...extraClasses.map((kind) =>
              h(
                'button',
                {
                  key: kind,
                  type: 'button',
                  className: `mv-parse-filter${filter === kind ? ' on' : ''}`,
                  'aria-pressed': filter === kind,
                  onClick: () => changeFilter(kind),
                },
                h('span', { className: 'mv-parse-dot', 'aria-hidden': true, style: { background: parseClassColor(kind).hex } }),
                t('parse.filterClass', { label: t(`parse.class.${kind}`), n: counts[kind] }),
              ),
            ),
          ),
          h(
            'div',
            { className: 'mv-parse-sort' },
            ...['default', 'height', 'area'].map((mode) =>
              h(
                'button',
                {
                  key: mode,
                  type: 'button',
                  className: `mv-parse-sort-btn${sortBy === mode ? ' on' : ''}`,
                  'aria-pressed': sortBy === mode,
                  onClick: () => setSortBy(mode),
                },
                t(`parse.sort${mode.charAt(0).toUpperCase()}${mode.slice(1)}`),
              ),
            ),
          ),
          h(
            'label',
            { className: 'mv-parse-toggle' },
            h('input', { type: 'checkbox', checked: extrude3d, onChange: toggleExtrude }),
            h('span', null, t('parse.extrude3d')),
          ),
        ),
        skipped > 0 ? h('p', { className: 'mv-none' }, t('parse.skipped', { n: skipped })) : null,
        h(
          'div',
          { className: 'mv-parse-list' },
          ...visibleEntries.map(({ feature, index }) => {
            const props = feature.properties ?? {}
            const kind = props.class ?? 'other'
            const color = parseClassColor(kind, props.style)
            const metrics = candidateMetricText(props, t)
            return h(
              'label',
              { key: `${index}-${props.name ?? index}`, className: `mv-parse-row${selected.has(index) ? ' on' : ''}` },
              h('input', {
                type: 'checkbox',
                checked: selected.has(index),
                onChange: () => toggle(index),
              }),
              h('span', { className: 'mv-parse-dot', 'aria-hidden': true, style: { background: color.hex } }),
              h('span', { className: 'mv-parse-class' }, t(`parse.class.${kind}`)),
              h('span', { className: 'mv-parse-name' }, props.name ?? ''),
              metrics !== '' ? h('span', { className: 'mv-parse-metrics' }, metrics) : null,
              h('span', { className: 'mv-parse-conf' }, confidenceText(t, props.confidence)),
            )
          }),
        ),
        h(
          'div',
          { className: 'mv-actions' },
          buildingCount > 0
            ? h('button', { type: 'button', className: 'mv-cta primary', onClick: adoptBuildings }, t('parse.adoptBuildings', { n: selectedBuildings.length > 0 ? selectedBuildings.length : buildingCount }))
            : null,
          h('button', { type: 'button', className: 'mv-cta', onClick: () => adopt(new Set(candidates.map((_, index) => index))) }, t('parse.adoptAll')),
          h('button', { type: 'button', className: 'mv-btn', onClick: () => adopt(selected) }, t('parse.adoptSelected')),
        ),
      )
      : hasRun && !error
        ? h('p', { className: 'mv-none' }, t('parse.empty'))
        : null,
    h('p', { className: 'mv-parse-foot' }, t('parse.hint')),
  )
}
