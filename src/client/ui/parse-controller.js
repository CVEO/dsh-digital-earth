/**
 * ui/parse-controller.js — state machine behind the 2D extraction workbench.
 *
 * One panel: choose the extent, confirm the classes, extract, review. The
 * controller owns everything mutable that is not React (class selection, AOI,
 * the queue store, the one in-flight run, undo history, the accepted overlay and
 * the GeoJSON download). Extraction itself is scene/instance-segment.js and
 * returns flat WGS84 footprints: no heights, no refinement, no 3D geometry.
 */
import { buildGeoJsonExport, suggestedFilename } from '../scene/annotation-export.js'
import { createAnnotationStore } from '../scene/annotation-store.js'
import { downloadText } from '../scene/download.js'
import { createInstancePreview } from '../scene/instance-preview.js'
import { segmentInstances } from '../scene/instance-segment.js'
import { getSelectionTool, peekSelection, subscribeSelection } from '../scene/selection-tools.js'
import { bboxFromSelection, isAoiSelectionCapable } from '../scene/aoi.js'
import { DEFAULT_CLASSES, SPORTS_CLASSES, TAXONOMY_LIMITS, buildClassCatalog, sanitizeCustomLabel } from '../../shared/taxonomy.js'
import { isChinese } from '../i18n.js'
import { bindParseSnapshot } from './parse-snapshot.js'

const FILTERS = new Set(['all', 'pending', 'accepted', 'rejected'])
const EXPORT_SCOPES = new Set(['accepted', 'all'])
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const round1 = (value) => Math.round(value * 10) / 10

/** Normalise one run report: the UI needs the counters, not the window list. */
function reportOf(report) {
  if (!report || typeof report !== 'object') return null
  return {
    reusedCalls: Number(report.reusedCalls) || 0,
    modelUsed: report.modelUsed ?? null,
    calls: Number(report.calls) || 0,
    usage: report.usage ?? null,
    windows: Number(report.windows) || 0,
    failedWindows: Array.isArray(report.failedWindows) ? report.failedWindows.length : Number(report.failedWindows) || 0,
    complete: report.complete === true,
    instances: Number(report.instances) || 0,
    durationMs: Number(report.durationMs) || 0,
  }
}

/** Translate a failure code; unknown codes fall back to the model failure copy. */
function failText(t, code) {
  switch (code) {
    case 'unavailable': return t('parse.err.unavailable')
    case 'model_not_visual': return t('parse.err.model_not_visual')
    case 'model_changed': return t('parse.modelChanged')
    case 'model_unknown': return t('parse.err.model_unknown')
    case 'invalid_request': return t('parse.err.invalid_request')
    case 'too_large': return t('parse.err.too_large')
    case 'not_ready': return t('parse.err.not_ready')
    case 'busy': return t('parse.err.busy')
    case 'timeout': return t('parse.err.timeout')
    case 'scene_changed': return t('parse.err.scene_changed')
    default: return t('parse.err.model_failed')
  }
}

/** Ring of a committed selection in degrees, or null when it has no usable area. */
function ringOf(selection, Cesium) {
  if (Array.isArray(selection?.ring) && selection.ring.length >= 3) {
    const ring = selection.ring
      .filter((point) => Array.isArray(point) && isNumber(point[0]) && isNumber(point[1]))
      .map((point) => [point[0], point[1]])
    return ring.length >= 3 ? ring : null
  }
  const positions = Array.isArray(selection?.positions) ? selection.positions : []
  if (positions.length < 3 || typeof Cesium?.Cartographic?.fromCartesian !== 'function') return null
  try {
    const ring = positions.map((position) => {
      const carto = Cesium.Cartographic.fromCartesian(position)
      if (!carto || !isNumber(carto.longitude) || !isNumber(carto.latitude)) throw new Error('no ground point')
      return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)]
    })
    return ring.length >= 3 ? ring : null
  } catch {
    return null
  }
}

/** WGS84 bbox of a ring; null for an antimeridian crossing or an empty span. */
function bboxOf(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const point of ring) {
    const lon = Array.isArray(point) ? point[0] : NaN
    const lat = Array.isArray(point) ? point[1] : NaN
    if (!isNumber(lon) || !isNumber(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
    west = Math.min(west, lon)
    east = Math.max(east, lon)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }
  if (!(west < east) || !(south < north) || east - west > 180) return null
  return { west, south, east, north }
}

export function createParseController(ctx) {
  let context = ctx
  const store = createAnnotationStore()
  const preview = createInstancePreview()
  const listeners = new Set()
  const t = (key, vars) => (typeof context.t === 'function' ? context.t(key, vars) : key)
  const toast = (message) => { try { context.showToast?.(message) } catch { /* toast is best effort */ } }

  let profile = 'general'
  const presets = () => profile === 'sports' ? SPORTS_CLASSES : DEFAULT_CLASSES
  const customLabels = []
  let selectedKeys = new Set(DEFAULT_CLASSES.map((entry) => entry.key))
  let phase = 'idle'
  let modelSaving = false
  let reuse = true
  let locator = 'joint'
  let multiScale = false
  let busy = false
  let progress = null
  let report = null
  let error = null
  let scope = 'view'
  let filter = 'all'
  let selected = []
  let activeId = null
  let confirmRerun = false
  let drawing = null
  let aoi = null
  let abort = null
  let disposed = false
  let unsubscribe = null

  const viewerOf = () => context.getViewer?.() ?? null
  const cesiumOf = () => context.getCesium?.() ?? null
  const emit = () => { if (!disposed) for (const listener of listeners) { try { listener() } catch { /* isolation */ } } }
  const changed = () => { emit() }
  const catalog = () => buildClassCatalog(customLabels, presets(), isChinese() ? 'zh' : 'en')
  const selectedEntries = () => catalog().filter((entry) => selectedKeys.has(entry.key))
  const aoiReady = () => Boolean(aoi && aoi.bbox)
  const firstId = () => store.getState().candidates[0]?.properties?.id ?? null

  const summaryText = () => {
    const list = catalog()
    const picked = list.filter((entry) => selectedKeys.has(entry.key))
    if (picked.length === 0) return t('parse.classesNone')
    if (picked.length === list.length) return t('parse.classesAll', { n: list.length })
    const names = picked.map((entry) => entry.name)
    if (names.length <= 2) return t('parse.classesOnly', { label: names.join(t('parse.listSeparator')) })
    return t('parse.classesCount', { n: names.length })
  }

  const reasonOf = () => {
    if (modelSaving) return t('parse.savingModel')
    if (busy) return null
    if (!viewerOf() || !cesiumOf()) return t('parse.err.not_ready')
    if (selectedEntries().length === 0) return t('parse.needClasses')
    if (scope === 'aoi' && !aoiReady()) return t('parse.needAoi')
    return null
  }

  const candidateRows = () => store.getState().candidates.map((feature) => {
    const properties = feature?.properties ?? {}
    return {
      id: properties.id,
      classKey: typeof properties.class_key === 'string' ? properties.class_key : '',
      className: typeof properties.class_name === 'string' ? properties.class_name : '',
      color: typeof properties.color === 'string' ? properties.color : '',
      area_m2: isNumber(properties.area_m2) ? round1(properties.area_m2) : null,
      clippedAtTileEdge: properties.clippedAtTileEdge === true,
      status: properties.status ?? 'pending',
    }
  })

  function getState() {
    const stats = store.stats()
    const counts = { total: stats.total, pending: stats.pending, accepted: stats.accepted, rejected: stats.rejected }
    const reason = reasonOf()
    return {
      phase,
      reuse,
      locator,
      multiScale,
      visionConfigUrl: context.getMeta?.()?.visionConfigUrl,
      sessionId: context.getSession?.(),
      busy,
      progress,
      classes: {
        profile,
        catalog: catalog().map((entry) => ({
          id: entry.id,
          key: entry.key,
          name: entry.name,
          color: entry.color,
          definition: entry.definition,
          custom: entry.custom === true,
          on: selectedKeys.has(entry.key),
        })),
        custom: customLabels.slice(),
        summary: summaryText(),
      },
      scope,
      aoi: {
        ready: aoiReady(),
        area_m2: isNumber(aoi?.area_m2) ? round1(aoi.area_m2) : null,
        drawing: Boolean(drawing),
      },
      candidates: candidateRows(),
      counts,
      filter,
      selected: selected.slice(),
      activeId,
      report,
      error,
      canRun: !busy && reason === null,
      reason,
      confirmRerun,
      rerun: confirmRerun ? { total: counts.total, accepted: counts.accepted } : null,
      primaryLabel: busy ? t('parse.stop') : (counts.total > 0 ? t('parse.rerun') : t('parse.start')),
    }
  }

  /** Only accepted candidates reach the annotation overlay: one layer, replaced. */
  const syncOverlay = () => {
    preview.clear()
    try {
      context.onSyncParse?.({ type: 'FeatureCollection', features: store.accepted() }, t('parse.layerName'))
    } catch { /* overlay sync must never break the queue */ }
  }

  const addCandidates = (features, { replace = true } = {}) => {
    // Replace only after a successful run: a failed/cancelled run keeps the queue.
    if (replace) store.startRun({ mode: 'instances', source: 'ortho', scope, classes: selectedEntries().map((entry) => entry.key) })
    if (Array.isArray(features) && features.length > 0) store.addCandidates(features)
    selected = []
    activeId = firstId()
    syncOverlay()
    changed()
  }

  const stopDrawing = () => {
    if (drawing) {
      try { getSelectionTool(viewerOf(), {})?.cancel?.() } catch { /* best effort */ }
    }
    drawing = null
  }

  const adoptSelection = (selection) => {
    const ring = ringOf(selection, cesiumOf())
    const bbox = ring ? bboxOf(ring) : null
    if (!bbox) return false
    aoi = { bbox, ring, area_m2: isNumber(selection?.area_m2) ? round1(selection.area_m2) : null }
    return true
  }

  const onSelection = (event) => {
    if (disposed) return
    const type = event?.type
    if (type === 'commit') {
      // A selection committed outside the workbench is never hijacked as an AOI.
      if (!drawing && scope !== 'aoi') return
      drawing = null
      if (!adoptSelection(event?.selection)) {
        aoi = null
        toast(t('parse.err.antimeridian'))
        changed()
        return
      }
      scope = 'aoi'
      confirmRerun = false
      changed()
      return
    }
    if (type === 'cancel') {
      if (!drawing) return
      drawing = null
      changed()
      return
    }
    if (type === 'clear') {
      drawing = null
      aoi = null
      changed()
    }
  }

  const attach = () => {
    try {
      unsubscribe?.()
      unsubscribe = subscribeSelection(viewerOf(), onSelection)
    } catch {
      unsubscribe = null
    }
  }
  attach()

  const executeRun = async () => {
    if (busy || modelSaving) return
    const viewer = viewerOf()
    const Cesium = cesiumOf()
    if (!viewer || !Cesium) { error = { code: 'not_ready', message: failText(t, 'not_ready') }; phase = 'error'; emit(); return }
    const entries = selectedEntries()
    if (entries.length === 0) { toast(t('parse.needClasses')); return }
    if (scope === 'aoi' && !aoiReady()) { toast(t('parse.needAoi')); return }
    const meta = context.getMeta?.() ?? {}
    if (typeof meta?.visionInstancesUrl !== 'string' || meta.visionInstancesUrl.trim() === '') {
      error = { code: 'unavailable', message: failText(t, 'unavailable') }
      phase = 'error'
      emit()
      return
    }
    preview.clear()
    busy = true
    phase = 'capturing'
    progress = null
    report = null
    error = null
    confirmRerun = false
    emit()
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    abort = controller
    let failedWindows = 0
    try {
      const result = await segmentInstances({
        viewer,
        Cesium,
        meta,
        sessionId: context.getSession?.(),
        multiScale,
        namedLabels: locator === 'names',
        separateClasses: locator === 'separate',
        reuse,
        bbox: scope === 'aoi' ? aoi?.bbox ?? null : null,
        classes: entries.map((entry) => ({
          id: entry.id, name: entry.name, definition: entry.definition, key: entry.key, color: entry.color,
        })),
        signal: controller?.signal ?? null,
        onProgress: (event) => {
          if (disposed) return
          phase = 'segmenting'
          const done = Number(event?.done) || 0
          progress = { done, total: Number(event?.total) || 0 }
          if (event?.error) failedWindows += 1
          report = { calls: done, windows: Number(event?.total) || 0, failedWindows, complete: false, instances: Number(event?.found) || 0, durationMs: 0 }
          emit()
        },
      })
      if (disposed) return
      report = reportOf(result?.report)
      const features = Array.isArray(result?.collection?.features) ? result.collection.features : []
      const prepared = features.map((feature, index) => {
        const props = feature?.properties ?? {}
        const className = typeof props.class_name === 'string' && props.class_name !== '' ? props.class_name : (props.class_key ?? '')
        return {
          ...feature,
          properties: {
            ...props,
            class: className,
            class_key: typeof props.class_key === 'string' ? props.class_key : className,
            class_name: className,
            color: typeof props.color === 'string' ? props.color : '',
            name: typeof props.name === 'string' && props.name !== '' ? props.name : `${className} ${index + 1}`,
            source: 'ortho',
            source_kind: 'ortho',
          },
        }
      })
      if (result?.cancelled === true) {
        if (prepared.length > 0) addCandidates(prepared, { replace: false })
        error = null
        phase = store.getState().candidates.length > 0 ? 'review' : 'idle'
        progress = null
        toast(t('parse.cancelledPartial', { n: prepared.length }))
        return
      }
      if (prepared.length === 0 && report?.complete === false) {
        error = { code: 'partial_failed', message: t('parse.partialFailed') }
        phase = 'error'
        progress = null
        return
      }
      addCandidates(prepared, { replace: true })
      error = null
      phase = 'review'
      progress = null
      const failed = report?.failedWindows ?? 0
      if (features.length > 0 && failed > 0) toast(t('parse.candidatesPartial', { n: features.length, failed }))
      else if (features.length > 0) toast(t('parse.candidates', { n: features.length }))
      else toast(t('parse.noInstances'))
    } catch (failure) {
      if (disposed) return
      const aborted = controller?.signal?.aborted === true || failure?.name === 'AbortError'
      if (aborted) {
        error = null
        phase = store.getState().candidates.length > 0 ? 'review' : 'idle'
        progress = null
        toast(t('parse.cancelled'))
      } else {
        const code = typeof failure?.code === 'string' && failure.code !== '' ? failure.code : 'model_failed'
        error = { code, message: failText(t, code) }
        phase = 'error'
        progress = null
      }
    } finally {
      if (abort === controller) abort = null
      if (!disposed) {
        busy = false
        if (error === null && (phase !== 'review')) phase = store.getState().candidates.length > 0 ? 'review' : 'idle'
        emit()
      }
    }
  }

  /** One run at a time; a reviewed queue asks for an inline confirmation first. */
  const startRun = () => {
    if (busy) return
    if (store.getState().candidates.length > 0) { confirmRerun = true; emit(); return }
    void executeRun()
  }

  const runExport = (nextScope) => {
    const target = EXPORT_SCOPES.has(nextScope) ? nextScope : 'accepted'
    const features = target === 'all' ? store.all() : store.accepted()
    const { collection, count } = buildGeoJsonExport(features)
    if (count === 0) { toast(t('parse.exportEmpty')); return false }
    const written = downloadText(suggestedFilename(), JSON.stringify(collection, null, 2), 'application/geo+json')
    if (!written) { toast(t('parse.exportEmpty')); return false }
    toast(t('parse.exported', { n: count }))
    return true
  }

  const setStatus = (ids, status, toastKey) => {
    const list = normalizeIds(ids)
    if (list.length === 0) return
    store.setStatus(list, status)
    const reviewed = new Set(list)
    selected = selected.filter(id => !reviewed.has(id))
    syncOverlay()
    if (toastKey) toast(t(toastKey, { n: list.length }))
    changed()
  }

  const afterHistory = (step) => {
    if (busy || !step().ok) return
    const live = new Set(store.getState().candidates.map((feature) => feature.properties.id))
    selected = selected.filter((id) => live.has(id))
    if (!live.has(activeId)) activeId = firstId()
    syncOverlay()
    changed()
  }

  const actions = {
    setModelSaving(on) { modelSaving = on === true; emit() },
    setReuse(on) { if (!busy) { reuse = on === true; emit() } },
    setLocator(mode) { if (!busy && ['joint','names','separate'].includes(mode)) { locator = mode; emit() } },
    setMultiScale(on) { if (!busy) { multiScale = on === true; emit() } },
    setScope(next) {
      if (busy) return
      confirmRerun = false
      scope = next === 'aoi' ? 'aoi' : 'view'
      if (scope === 'aoi' && !aoi) {
        const live = peekSelection(viewerOf())
        if (isAoiSelectionCapable(live)) adoptSelection(live)
      }
      changed()
    },
    startDrawAoi(kind = 'rect') {
      if (busy) return
      const viewer = viewerOf()
      if (!viewer) { toast(t('parse.err.not_ready')); return }
      let tool = null
      try {
        tool = getSelectionTool(viewer, {
          getCesium: context.getCesium,
          t,
          showToast: context.showToast,
          onActivate: context.onActivateSelection,
        })
      } catch {
        tool = null
      }
      if (!tool) { toast(t('parse.err.not_ready')); return }
      const mode = kind === 'polygon' ? 'polygon' : 'rect'
      let started = false
      try { started = tool.start(mode) !== false } catch { started = false }
      scope = 'aoi'
      drawing = started ? { kind: mode } : null
      confirmRerun = false
      changed()
    },
    clearAoi() {
      if (busy) return
      stopDrawing()
      aoi = null
      confirmRerun = false
      try { getSelectionTool(viewerOf(), {})?.clear?.() } catch { /* best effort */ }
      changed()
    },
    setClassProfile(next) {
      if (busy || !['general','sports'].includes(next) || next === profile) return
      profile = next
      selectedKeys = new Set(presets().map(entry => entry.key))
      confirmRerun = false
      changed()
    },
    toggleClass(key) {
      if (busy || typeof key !== 'string' || !catalog().some((entry) => entry.key === key)) return
      if (selectedKeys.has(key)) selectedKeys.delete(key)
      else selectedKeys.add(key)
      confirmRerun = false
      changed()
    },
    addCustomClass(label) {
      if (busy) return
      const clean = sanitizeCustomLabel(label)
      if (clean === '') { toast(t('parse.customInvalid')); return }
      const existing = catalog().find((entry) => entry.name === clean || entry.key === clean)
      if (existing) { selectedKeys.add(existing.key); changed(); return }
      if (catalog().length >= TAXONOMY_LIMITS.maxClasses) { toast(t('parse.classLimit')); return }
      customLabels.push(clean)
      selectedKeys.add(`custom:${clean}`)
      confirmRerun = false
      changed()
    },
    resetClasses() {
      if (busy) return
      customLabels.length = 0
      selectedKeys = new Set(presets().map((entry) => entry.key))
      confirmRerun = false
      changed()
    },
    run() { startRun() },
    confirmRun() {
      if (busy) return
      confirmRerun = false
      void executeRun()
    },
    cancelRerun() { confirmRerun = false; changed() },
    stop() {
      if (!busy) return
      try { abort?.abort?.() } catch { /* best effort */ }
      stopDrawing()
      emit()
    },
    setFilter(next) {
      if (!FILTERS.has(next)) return
      filter = next
      selected = []
      const rows = store.getState().candidates
      const visible = (filter === 'all' ? rows : rows.filter((feature) => (feature?.properties?.status ?? 'pending') === filter))
        .map((feature) => feature.properties.id)
      activeId = visible.includes(activeId) ? activeId : (visible[0] ?? null)
      changed()
    },
    select(ids) {
      const wanted = new Set(Array.isArray(ids) ? ids : [])
      selected = store.getState().candidates.map((feature) => feature.properties.id).filter((id) => wanted.has(id))
      emit()
    },
    activate(id) {
      if (busy) return
      activeId = typeof id === 'string' ? id : null
      const feature = store.getState().candidates.find(item => item.properties?.id === activeId)
      preview.show(viewerOf(), cesiumOf(), feature)
      emit()
    },
    deactivate() { stopDrawing(); preview.clear() },
    adopt(ids) { setStatus(ids, 'accepted', 'parse.adopted') },
    reject(ids) { setStatus(ids, 'rejected') },
    restore(ids) { setStatus(ids, 'pending') },
    remove(ids) {
      const list = normalizeIds(ids)
      if (list.length === 0) return
      store.remove(list)
      const live = new Set(store.getState().candidates.map((feature) => feature.properties.id))
      selected = selected.filter((id) => live.has(id))
      if (!live.has(activeId)) activeId = firstId()
      syncOverlay()
      changed()
    },
    undo() { afterHistory(() => store.undo()) },
    redo() { afterHistory(() => store.redo()) },
    flyTo(id) {
      const viewer = viewerOf()
      const Cesium = cesiumOf()
      if (!viewer || !Cesium) return
      const ring = store.getState().candidates.find((item) => item.properties?.id === id)?.geometry?.coordinates?.[0]
      const lons = Array.isArray(ring) ? ring.map((point) => point?.[0]).filter(isNumber) : []
      const lats = Array.isArray(ring) ? ring.map((point) => point?.[1]).filter(isNumber) : []
      if (lons.length < 2 || lats.length < 2) return
      const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)]
      const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)]
      if (!(maxLon > minLon) || !(maxLat > minLat)) return
      const altitude = Math.max(150, Math.min(6000, ((maxLon - minLon) + (maxLat - minLat)) * 111320 * 2.2))
      actions.activate(id)
      try {
        viewer.camera?.flyTo?.({
          destination: Cesium.Cartesian3.fromDegrees((minLon + maxLon) / 2, (minLat + maxLat) / 2, altitude),
          orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
          duration: 0.9,
        })
      } catch { /* the camera may already be flying */ }
      emit()
    },
    exportGeoJson(nextScope) { return runExport(nextScope) },
    clearAll() {
      const ids = store.getState().candidates.map((feature) => feature.properties.id)
      if (ids.length > 0) store.remove(ids)
      selected = []
      activeId = null
      confirmRerun = false
      error = null
      report = null
      phase = 'idle'
      progress = null
      syncOverlay()
      changed()
    },
  }

  const snapshotBridge = bindParseSnapshot({
    store,
    getCounts: () => {
      const stats = store.stats()
      return { total: stats.total, pending: stats.pending, accepted: stats.accepted, rejected: stats.rejected }
    },
    onRestored: (firstId) => {
      activeId = firstId
      selected = []
      error = null
      phase = store.getState().candidates.length > 0 ? 'review' : 'idle'
      changed()
    },
  })

  const snapshotPayload = () => {
    const base = snapshotBridge.snapshotPayload()
    return base ? { ...base, customClasses: customLabels.slice(), scope, multiScale, locator, reuse, profile, selectedKeys: [...selectedKeys] } : null
  }

  const restoreSnapshot = (payload) => {
    if (!payload || typeof payload !== 'object') return false
    profile = payload?.profile === 'sports' ? 'sports' : 'general'
    selectedKeys = new Set(presets().map(entry => entry.key))
    const labels = Array.isArray(payload?.customClasses)
      ? payload.customClasses.map((label) => sanitizeCustomLabel(label)).filter((label) => label !== '')
      : []
    customLabels.length = 0
    customLabels.push(...labels.slice(0, TAXONOMY_LIMITS.maxClasses))
    for (const label of customLabels) selectedKeys.add(`custom:${label}`)
    if (Array.isArray(payload?.selectedKeys)) {
      const known = new Set(catalog().map(entry => entry.key))
      selectedKeys = new Set(payload.selectedKeys.filter(key => known.has(key)))
    }
    reuse = payload?.reuse !== false
    locator = ['names','separate'].includes(payload?.locator) ? payload.locator : 'joint'
    multiScale = payload?.multiScale === true
    const restored = snapshotBridge.restoreSnapshot(payload)
    if (payload?.scope === 'aoi' || payload?.scope === 'view') scope = payload.scope
    if (!restored && labels.length === 0 && !Array.isArray(payload.selectedKeys)) return false
    if (!restored) phase = 'idle'
    // The bridge emits when it hydrated a queue; emit again for the restored scope.
    changed()
    return true
  }

  return {
    getState,
    updateContext(next) { if (next && typeof next === 'object') context = next },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    actions,
    refresh() { attach(); changed() },
    dispose() {
      disposed = true
      preview.clear()
      try { abort?.abort?.() } catch { /* best effort */ }
      stopDrawing()
      try { unsubscribe?.() } catch { /* best effort */ }
      unsubscribe = null
      listeners.clear()
    },
    snapshotPayload,
    restoreSnapshot,
    notify(message) { toast(message) },
    // Exposed for tests: the queue and the selection event entry point.
    store,
    _onSelection: onSelection,
  }
}

/** Accept a single id or a list and drop everything that is not a store id. */
function normalizeIds(ids) {
  if (typeof ids === 'string') return ids === '' ? [] : [ids]
  if (!Array.isArray(ids)) return []
  return ids.filter((id) => typeof id === 'string' && id !== '')
}
