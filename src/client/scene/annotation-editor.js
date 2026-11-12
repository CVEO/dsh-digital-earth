/**
 * scene/annotation-editor.js — drag the vertices of a selected annotation (F2b2).
 *
 * The handles are DOM elements layered over the Cesium canvas, not Cesium
 * entities: clicking a handle therefore never reaches the canvas click route, so
 * identify / measure / profile keep their exact behaviour while editing.
 *
 * A drag moves only the handles (cheap DOM transforms); on pointerup the feature
 * geometry is patched through the annotation actions and the draw command is
 * replayed once. Commit targets the feature by name+kind (see
 * scene/annotation-edit.js#findFeatureInState) because every replay replaces the
 * command and the selection is cleared after a save.
 *
 * Gestures: drag a vertex, drag the centre handle to move the whole shape,
 * double-click a vertex to delete it, Alt+click a vertex to insert a vertex on
 * the segment that follows it, Ctrl/Cmd+Z to undo, Esc to leave editing.
 */
import {
  annotationCenterPoint,
  annotationHandlePoints,
  annotationInsertPoint,
  isShapeEditable,
} from './annotation-vertices.js'
import {
  deleteAnnotationVertex,
  insertAnnotationVertex,
  moveAnnotationVertex,
  translateAnnotation,
} from './annotation-model.js'

const HANDLE_LIMIT = 64
const DRAG_THRESHOLD = 3
const DRAG_HISTORY_LIMIT = 20

const sessions = new WeakMap()

function pointerPosition(event) {
  return { clientX: event.clientX, clientY: event.clientY }
}

export function createAnnotationEditor({ getCesium, getViewer, getRoot, pickSurface, updateGeometry, showToast, t }) {
  const sessionFor = () => {
    const viewer = getViewer?.()
    if (!viewer) return null
    let state = sessions.get(viewer)
    if (!state) {
      state = {
        feature: null,
        target: null,
        entries: [],
        layer: null,
        centerPoint: null,
        dragging: null,
        history: [],
        keydown: null,
        frame: null,
        listeners: null,
      }
      sessions.set(viewer, state)
    }
    return state
  }

  const lonLatAt = (event) => {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const canvas = viewer?.scene?.canvas
    if (!Cesium || !canvas || typeof pickSurface !== 'function') return null
    const rect = canvas.getBoundingClientRect()
    const position = new Cesium.Cartesian2(event.clientX - rect.left, event.clientY - rect.top)
    const surface = pickSurface(position)
    if (!surface) return null
    try {
      const carto = Cesium.Cartographic.fromCartesian(surface)
      return { lon: Cesium.Math.toDegrees(carto.longitude), lat: Cesium.Math.toDegrees(carto.latitude) }
    } catch {
      return null
    }
  }

  const setCameraInputs = (enabled) => {
    const viewer = getViewer?.()
    const controller = viewer?.scene?.screenSpaceCameraController
    if (controller) controller.enableInputs = enabled
  }

  // ---------------------------------------------------------------------------
  // DOM layer
  // ---------------------------------------------------------------------------

  const ensureLayer = (state) => {
    const document = globalThis.document
    const root = getRoot?.()
    if (!document || !root) return null
    if (state.layer && state.layer.isConnected) return state.layer
    const layer = document.createElement('div')
    layer.className = 'mv-vertex-layer'
    layer.setAttribute('data-annotation-editor', '1')
    root.appendChild(layer)
    state.layer = layer
    return layer
  }

  const removeLayer = (state) => {
    if (state.layer && typeof state.layer.remove === 'function') state.layer.remove()
    state.layer = null
    state.entries = []
    state.centerPoint = null
  }

  const positionHandles = (state) => {
    if (!state.layer || state.entries.length === 0) return
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const root = getRoot?.()
    if (!Cesium || !viewer || !root) return
    const scene = viewer.scene
    const canvas = scene?.canvas
    if (!canvas || typeof scene.cartesianToCanvasCoordinates !== 'function') return
    const canvasRect = canvas.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const offsetX = canvasRect.left - rootRect.left
    const offsetY = canvasRect.top - rootRect.top
    for (const entry of state.entries) {
      const point = entry.kind === 'center' ? state.centerPoint : { lon: entry.lon, lat: entry.lat }
      if (!point) {
        entry.el.style.display = 'none'
        continue
      }
      let windowPoint = null
      try {
        const carto = Cesium.Cartographic.fromDegrees(point.lon, point.lat)
        const ground = scene.globe?.getHeight?.(carto)
        const height = Number.isFinite(ground) ? ground + 2 : 0
        windowPoint = scene.cartesianToCanvasCoordinates(
          Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height),
        )
      } catch {
        windowPoint = null
      }
      if (!windowPoint || !Number.isFinite(windowPoint.x) || !Number.isFinite(windowPoint.y)) {
        entry.el.style.display = 'none'
        continue
      }
      entry.el.style.display = ''
      entry.el.style.transform = `translate(${offsetX + windowPoint.x}px, ${offsetY + windowPoint.y}px)`
    }
  }

  // ---------------------------------------------------------------------------
  // Commit / history
  // ---------------------------------------------------------------------------

  const refreshFeature = (state) => {
    const handles = annotationHandlePoints(state.feature)
    state.centerPoint = annotationCenterPoint(handles)
    return handles
  }

  const addHistory = (state, entry) => {
    state.history.push(entry)
    while (state.history.length > DRAG_HISTORY_LIMIT) state.history.shift()
  }

  const commit = (state, nextFeature, beforeFeature, messageKey) => {
    const target = state.target
    if (!target || !beforeFeature) return false
    const ok = updateGeometry(
      {
        name: target.name,
        kind: target.kind,
        geometry: nextFeature.geometry,
        previous: beforeFeature.geometry,
      },
      messageKey,
    )
    if (!ok) {
      state.feature = beforeFeature
      refreshFeature(state)
      return false
    }
    addHistory(state, {
      name: target.name,
      kind: target.kind,
      previous: beforeFeature.geometry,
      current: nextFeature.geometry,
    })
    state.feature = nextFeature
    state.target = { name: target.name, kind: target.kind, geometry: nextFeature.geometry }
    refreshFeature(state)
    return true
  }

  const undo = (state) => {
    const entry = state.history.pop()
    if (!entry) {
      showToast(t('annotation.nothingToUndo'))
      return false
    }
    const ok = updateGeometry(
      { name: entry.name, kind: entry.kind, geometry: entry.previous, previous: entry.current },
      'annotation.undone',
    )
    if (!ok) {
      state.history.push(entry)
      return false
    }
    state.feature = { ...state.feature, geometry: entry.previous }
    state.target = { name: entry.name, kind: entry.kind, geometry: entry.previous }
    refreshFeature(state)
    return true
  }

  // ---------------------------------------------------------------------------
  // Gestures
  // ---------------------------------------------------------------------------

  const removeDragListeners = (state) => {
    const document = globalThis.document
    if (!document || !state.listeners) return
    document.removeEventListener('pointermove', state.listeners.move)
    document.removeEventListener('pointerup', state.listeners.up)
    document.removeEventListener('pointercancel', state.listeners.up)
    state.listeners = null
  }

  const finishDrag = (state) => {
    const drag = state.dragging
    state.dragging = null
    removeDragListeners(state)
    setCameraInputs(true)
    if (!drag) return
    if (!drag.moved) {
      // A click on a handle is not an edit: drop the preview.
      state.feature = drag.snapshot
      refreshFeature(state)
      return
    }
    commit(state, state.feature, drag.snapshot, 'annotation.shapeSaved')
  }

  const onDragMove = (state, event) => {
    const drag = state.dragging
    if (!drag) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    const point = lonLatAt(event)
    if (!point) return
    drag.moved = true
    const next = drag.entry.kind === 'center'
      ? translateAnnotation(drag.snapshot, point.lon - drag.origin.lon, point.lat - drag.origin.lat)
      : moveAnnotationVertex(drag.snapshot, 0, drag.entry.vertexIndex, point.lon, point.lat)
    if (!next.ok) return
    state.feature = next.feature
    refreshFeature(state)
    try { getViewer?.().scene.requestRender?.() } catch { /* no render loop to nudge */ }
  }

  const startDrag = (state, event, entry) => {
    const origin = lonLatAt(event)
    if (!origin) return
    state.dragging = {
      entry,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      snapshot: state.feature,
      moved: false,
    }
    setCameraInputs(false)
    const document = globalThis.document
    const move = (moveEvent) => onDragMove(state, moveEvent)
    const up = () => finishDrag(state)
    state.listeners = { move, up }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const insertVertex = (state, entry) => {
    const point = annotationInsertPoint(state.feature, entry.vertexIndex)
    if (!point.ok) {
      showToast(t('annotation.vertexFailed'))
      return false
    }
    const next = insertAnnotationVertex(state.feature, 0, point.after, point.lon, point.lat)
    if (!next.ok) {
      showToast(t('annotation.vertexFailed'))
      return false
    }
    const before = state.feature
    if (commit(state, next.feature, before, 'annotation.vertexInserted')) {
      rebuildHandles(state)
      return true
    }
    return false
  }

  const deleteVertex = (state, entry) => {
    const next = deleteAnnotationVertex(state.feature, 0, entry.vertexIndex)
    if (!next.ok) {
      showToast(t(next.error === 'too_few_vertices' ? 'annotation.tooFewVertices' : 'annotation.vertexFailed'))
      return false
    }
    const before = state.feature
    if (commit(state, next.feature, before, 'annotation.vertexDeleted')) {
      rebuildHandles(state)
      return true
    }
    return false
  }

  const onHandlePointerDown = (state, event, entry) => {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (entry.kind === 'vertex' && event.altKey) {
      insertVertex(state, entry)
      return
    }
    startDrag(state, event, entry)
  }

  // ---------------------------------------------------------------------------
  // Handle lifecycle
  // ---------------------------------------------------------------------------

  const rebuildHandles = (state) => {
    removeLayer(state)
    if (!state.feature) return
    const layer = ensureLayer(state)
    const document = globalThis.document
    if (!layer || !document) return
    const handles = refreshFeature(state)
    if (handles.length === 0 || handles.length > HANDLE_LIMIT) return
    for (const handle of handles) {
      const entry = { kind: 'vertex', ringIndex: handle.ringIndex, vertexIndex: handle.vertexIndex, lon: handle.lon, lat: handle.lat }
      const el = document.createElement('div')
      el.className = 'mv-vertex'
      el.setAttribute('role', 'button')
      el.setAttribute('tabindex', '-1')
      el.title = t('annotation.vertexHint')
      el.addEventListener('pointerdown', (event) => onHandlePointerDown(state, event, entry))
      el.addEventListener('dblclick', (event) => {
        event.preventDefault()
        event.stopPropagation()
        deleteVertex(state, entry)
      })
      layer.appendChild(el)
      entry.el = el
      state.entries.push(entry)
    }
    if (state.centerPoint) {
      const entry = { kind: 'center' }
      const el = document.createElement('div')
      el.className = 'mv-vertex center'
      el.setAttribute('role', 'button')
      el.setAttribute('tabindex', '-1')
      el.title = t('annotation.centerHint')
      el.addEventListener('pointerdown', (event) => onHandlePointerDown(state, event, entry))
      layer.appendChild(el)
      entry.el = el
      state.entries.push(entry)
    }
    positionHandles(state)
  }

  const detachFrame = (state) => {
    const viewer = getViewer?.()
    if (state.frame && viewer?.scene?.postRender) {
      viewer.scene.postRender.removeEventListener(state.frame)
    }
    state.frame = null
  }

  const attachFrame = (state) => {
    const viewer = getViewer?.()
    if (state.frame || !viewer?.scene?.postRender) return
    state.frame = () => positionHandles(state)
    viewer.scene.postRender.addEventListener(state.frame)
  }

  const detachKeys = (state) => {
    const document = globalThis.document
    if (state.keydown && document) document.removeEventListener('keydown', state.keydown)
    state.keydown = null
  }

  const attachKeys = (state) => {
    const document = globalThis.document
    if (state.keydown || !document) return
    state.keydown = (event) => {
      const active = document.activeElement
      if (active && active !== document.body && !event.target?.closest?.('.mv-root')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        state.feature = null
        state.target = null
        removeLayer(state)
        detachKeys(state)
        return
      }
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'z') {
        event.preventDefault()
        undo(state)
      }
    }
    document.addEventListener('keydown', state.keydown)
  }

  const clear = () => {
    const state = sessionFor()
    if (!state) return
    finishDrag(state)
    removeDragListeners(state)
    detachFrame(state)
    detachKeys(state)
    removeLayer(state)
    state.feature = null
    state.target = null
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const focus = (selection) => {
    clear()
    const feature = selection?.feature
    const name = typeof feature?.properties?.name === 'string' ? feature.properties.name : ''
    const kind = feature?.properties?.kind ?? null
    // The commit path addresses a feature by name+kind; asking the user to name
    // an import first is honest, while editing an unnamed feature would fail
    // only after the drag.
    if (!feature || !kind || name === '' || !isShapeEditable(feature)) return false
    const state = sessionFor()
    if (!state) return false
    state.feature = feature
    state.target = { name, kind, geometry: feature.geometry }
    state.history = []
    rebuildHandles(state)
    attachFrame(state)
    attachKeys(state)
    return true
  }

  function dispose() {
    const state = sessionFor()
    if (!state) return
    clear()
    state.history = []
  }

  return { focus, clear, dispose }
}
