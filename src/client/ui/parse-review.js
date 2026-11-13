/**
 * ui/parse-review.js — F6 scene parsing panel body.
 *
 * One button captures the current view, asks the host for object outlines, then
 * reviews them here. Nothing is adopted until the user confirms: results are AI
 * inference, so the panel keeps "preview" and "adopted into the annotation layer"
 * visually separate. The component owns its own state so ViewerSurface only
 * passes the annotation sink (one prop) and stays inside its line budget.
 */
import React from 'react'

import { loadMeta } from '../api.js'
import {
  applyExtrusionToFeatures,
  batchClassCounts,
  batchFeatureCollection,
  captureSceneFrame,
  clearBatchPreview,
  dedupeBatchFeatures,
  drawBatchPreview,
  filterBatchFeatures,
  projectBatchObjects,
  requestSceneParse,
} from '../scene/vision-batch.js'

const h = React.createElement

function candidateMetricText(properties) {
  const parts = []
  const height = properties?.height_m
  const area = properties?.area_m2
  if (typeof height === 'number' && Number.isFinite(height) && height >= 0.5) {
    parts.push(`≈${Math.round(height)}m`)
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

export function ParseBody({ t, getCesium, getViewer, getLayers, showToast, onAdoptParse }) {
  const [stage, setStage] = React.useState(null)
  const [candidates, setCandidates] = React.useState([])
  const [selected, setSelected] = React.useState(() => new Set())
  const [filter, setFilter] = React.useState('all')
  const [extrude3d, setExtrude3d] = React.useState(true)
  const [skipped, setSkipped] = React.useState(0)
  const [error, setError] = React.useState(null)
  const previewRef = React.useRef([])
  const aliveRef = React.useRef(true)

  React.useEffect(() => () => { aliveRef.current = false; clearBatchPreview(getViewer(), previewRef.current) }, [])

  const bus = typeof stage === 'string'
  const stageText = stage ? t(`parse.stage.${stage}`) : ''

  const redrawPreview = (items, nextExtrude) => {
    const Cesium = getCesium()
    const viewer = getViewer()
    if (!viewer) return
    clearBatchPreview(viewer, previewRef.current)
    if (Cesium && items.length > 0) {
      previewRef.current = drawBatchPreview(Cesium, viewer, items, { extrude: nextExtrude })
    }
  }

  const resetPreview = () => {
    clearBatchPreview(getViewer(), previewRef.current)
    setCandidates([])
    setSelected(new Set())
    setFilter('all')
    setSkipped(0)
    setError(null)
  }

  const parse = async () => {
    if (bus) return
    const Cesium = getCesium()
    const viewer = getViewer()
    if (!Cesium || !viewer) { setError('not_ready'); return }
    resetPreview()
    let frame = null
    try {
      setStage('capture')
      frame = captureSceneFrame({ viewer, Cesium, getLayers: typeof getLayers === 'function' ? getLayers : () => [] })
      setStage('request')
      const meta = await loadMeta()
      if (!meta?.visionBatchUrl) throw Object.assign(new Error('unavailable'), { code: 'unavailable' })
      const payload = await requestSceneParse(meta.visionBatchUrl, { frame })
      if (!aliveRef.current) return
      setStage('project')
      const projected = projectBatchObjects(frame, payload.objects, { t })
      const deduped = dedupeBatchFeatures(projected.features)
      if (!aliveRef.current) return
      if (deduped.length === 0) { setError('no_target'); return }
      setCandidates(deduped)
      setSelected(new Set(deduped.map((_, index) => index)))
      setFilter('all')
      setSkipped(projected.skipped)
      previewRef.current = drawBatchPreview(Cesium, viewer, deduped, { extrude: extrude3d })
      showToast(t('parse.candidates', { n: deduped.length }))
    } catch (failure) {
      if (!aliveRef.current) return
      setError(failure?.code ?? 'model_failed')
    } finally {
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
  const visibleEntries = candidates
    .map((feature, index) => ({ feature, index }))
    .filter(({ feature }) => filter === 'all' || feature?.properties?.class === filter)

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

  return h(
    'div',
    { className: 'mv-parse' },
    h(
      'div',
      { className: 'mv-tool-grid' },
      h(
        'button',
        { type: 'button', className: 'mv-cta', disabled: bus, onClick: parse },
        bus ? t('parse.running', { stage: stageText }) : t('parse.run'),
      ),
      candidates.length > 0
        ? h('button', { type: 'button', className: 'mv-cta', onClick: resetPreview }, t('parse.clear'))
        : null,
    ),
    error
      ? h('p', { className: 'mv-warn' }, t('parse.failed', { reason: errorText(t, error) }))
      : null,
    candidates.length > 0
      ? h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'mv-parse-head' },
          h('span', { className: 'mv-parse-count' }, t('parse.candidates', { n: candidates.length })),
          h('span', { className: 'mv-parse-selected' }, t('parse.selected', { n: selected.size, total: candidates.length })),
        ),
        h(
          'div',
          { className: 'mv-parse-controls' },
          h(
            'div',
            { className: 'mv-parse-filters' },
            h('button', { type: 'button', className: `mv-parse-filter${filter === 'all' ? ' on' : ''}`, onClick: () => changeFilter('all') }, t('parse.filterAll', { n: candidates.length })),
            buildingCount > 0
              ? h('button', { type: 'button', className: `mv-parse-filter${filter === 'building' ? ' on' : ''}`, onClick: () => changeFilter('building') }, t('parse.filterBuildings', { n: buildingCount }))
              : null,
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
            const metrics = candidateMetricText(feature.properties)
            return h(
              'label',
              { key: `${index}-${feature.properties?.name ?? index}`, className: `mv-parse-row${selected.has(index) ? ' on' : ''}` },
              h('input', {
                type: 'checkbox',
                checked: selected.has(index),
                onChange: () => toggle(index),
              }),
              h('span', { className: 'mv-parse-name' }, feature.properties?.name ?? ''),
              metrics !== '' ? h('span', { className: 'mv-parse-metrics' }, metrics) : null,
              h('span', { className: 'mv-parse-conf' }, confidenceText(t, feature.properties?.confidence)),
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
      : h('p', { className: 'mv-none' }, t('parse.empty')),
    h('p', { className: 'mv-none' }, t('parse.hint')),
  )
}
