/**
 * scene/selection-tools.js — canvas selection sessions and their overlays.
 *
 * v1.6 B4 MVP: rectangle (drag) selection → ground polygon → area/perimeter →
 * GeoJSON export. The session is keyed by viewer in a WeakMap, so the Tools card
 * can unmount/remount without losing a committed selection, and ViewerSurface can
 * cheaply ask `isSelectionActive(viewer)` before routing its own canvas clicks.
 *
 * The selection geometry is drawn with Cesium entities on the picked surface; no
 * analyses run automatically and no Agent tool contract changes.
 */
import {
  circleAroundPoint,
  groundPointFromScreen,
  groundRingFromScreen,
  heightRange,
  polygonAreaSquareMeters,
  polygonPerimeterMeters,
  rectScreenRing,
  ringToPolygon,
  sampleLassoPath,
} from './screen-geodesy.js'

const sessions = new WeakMap()
const SELECTION_COLOR = '#2563eb'
const MIN_DRAG_PX = 4

/** True while a selection gesture is installing its own canvas handler. */
export function isSelectionActive(viewer) {
  const tool = viewer ? sessions.get(viewer) : null
  return Boolean(tool && typeof tool.isActive === 'function' && tool.isActive())
}

/** Committed selection for a viewer without creating a session (for ask/report). */
export function peekSelection(viewer) {
  const tool = viewer ? sessions.get(viewer) : null
  return tool && typeof tool.getSelection === 'function' ? tool.getSelection() : null
}

/**
 * WGS84 bounding region of a selection for the flood/analysis APIs. Returns null
 * when there is no usable ring or when the span exceeds the analysis limits
 * (10° per side), so callers can explain instead of sending an invalid region.
 */
export function selectionRegion(selection) {
  const ring = Array.isArray(selection?.ring) ? selection.ring : []
  if (ring.length < 4) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const point of ring) {
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue
    if (point[0] < west) west = point[0]
    if (point[0] > east) east = point[0]
    if (point[1] < south) south = point[1]
    if (point[1] > north) north = point[1]
  }
  if (!(east > west) || !(north > south)) return null
  if (east - west > 10 || north - south > 10) return null
  return { west, south, east, north }
}

/** Flood water height for a selection: the lowest sampled boundary elevation. */
export function selectionWaterHeight(selection) {
  const minimum = selection?.heightRange?.min
  return Number.isFinite(minimum) ? Math.round(minimum) : 0
}

/** Create/refresh the per-viewer selection session (deps are updated each time). */
export function getSelectionTool(viewer, deps) {
  if (!viewer) return null
  let tool = sessions.get(viewer)
  if (!tool) {
    tool = createSelectionSession(viewer)
    sessions.set(viewer, tool)
  }
  tool.deps = { ...(tool.deps ?? {}), ...deps }
  return tool
}

function createSelectionSession(viewer) {
  const state = {
    mode: null,
    dragStart: null,
    lassoPath: [],
    lastMoveAt: 0,
    lastScreenRing: [],
    previewPositions: [],
    previewEntity: null,
    committedEntities: [],
    objectBox: null,
    objectRect: null,
    selection: null,
    handler: null,
    keyHandler: null,
    savedController: null,
  }

  const t = (key, vars) => {
    try {
      return typeof tool.deps?.t === 'function' ? tool.deps.t(key, vars) : key
    } catch {
      return key
    }
  }
  const toast = (text) => tool.deps?.showToast?.(text)
  const now = () => new Date().toISOString()

  function color(Cesium, alpha = 1) {
    try {
      return Cesium.Color.fromCssColorString(SELECTION_COLOR).withAlpha(alpha)
    } catch {
      return undefined
    }
  }

  function removeEntity(entity) {
    if (!entity) return
    try {
      viewer.entities.remove(entity)
    } catch {
      /* already detached */
    }
  }

  function clearEntities() {
    removeEntity(state.previewEntity)
    state.previewEntity = null
    for (const entity of state.committedEntities) removeEntity(entity)
    state.committedEntities = []
  }

  function disableCamera() {
    const controller = viewer.scene?.screenSpaceCameraController
    if (!controller || state.savedController) return
    state.savedController = {
      enableRotate: controller.enableRotate,
      enableTranslate: controller.enableTranslate,
    }
    try {
      controller.enableRotate = false
      controller.enableTranslate = false
    } catch {
      /* older Cesium may lack the flags */
    }
  }

  function restoreCamera() {
    const controller = viewer.scene?.screenSpaceCameraController
    const saved = state.savedController
    state.savedController = null
    if (!controller || !saved) return
    try {
      if (saved.enableRotate !== undefined) controller.enableRotate = saved.enableRotate
      if (saved.enableTranslate !== undefined) controller.enableTranslate = saved.enableTranslate
    } catch {
      /* best effort */
    }
  }

  function destroyHandler() {
    if (state.handler) {
      try {
        state.handler.destroy()
      } catch {
        /* Cesium may already be gone */
      }
      state.handler = null
    }
    if (state.keyHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', state.keyHandler)
      state.keyHandler = null
    }
  }

  /** Screen-space marquee box for object selection (DOM, independent of Cesium). */
  function clearObjectBox() {
    if (state.objectBox?.parentNode) state.objectBox.parentNode.removeChild(state.objectBox)
    state.objectBox = null
    state.objectRect = null
  }

  function updateObjectBox(rect) {
    state.objectRect = rect
    if (typeof document === 'undefined') return
    const host = viewer.container ?? viewer.scene?.canvas?.parentElement
    if (!host) return
    if (!state.objectBox) {
      const box = document.createElement('div')
      box.className = 'mv-marquee'
      box.style.cssText = 'position:absolute;pointer-events:none;z-index:9;border:1.5px dashed #2f81f7;background:rgba(47,129,247,.10);border-radius:2px'
      host.appendChild(box)
      state.objectBox = box
    }
    state.objectBox.style.left = `${Math.min(rect.x1, rect.x2)}px`
    state.objectBox.style.top = `${Math.min(rect.y1, rect.y2)}px`
    state.objectBox.style.width = `${Math.abs(rect.x2 - rect.x1)}px`
    state.objectBox.style.height = `${Math.abs(rect.y2 - rect.y1)}px`
  }

  /** World positions of one overlay entity (position / polyline / polygon). */
  function entityCartesians(viewerNow, entity) {
    const time = viewerNow.clock?.currentTime
    const valueOf = (property) => {
      try {
        const value = property && typeof property.getValue === 'function' ? property.getValue(time) : property
        return Array.isArray(value) ? value : value ? [value] : []
      } catch {
        return []
      }
    }
    const points = []
    points.push(...valueOf(entity?.position))
    points.push(...valueOf(entity?.polyline?.positions))
    const hierarchy = valueOf(entity?.polygon?.hierarchy)[0]
    if (Array.isArray(hierarchy?.positions)) points.push(...hierarchy.positions)
    if (Array.isArray(entity?.polygon?.hierarchy?.getValue?.(time)?.positions)) {
      points.push(...entity.polygon.hierarchy.getValue(time).positions)
    }
    return points
  }

  function rowsInScreenBox(Cesium, rows, rect) {
    const viewerNow = viewer
    const left = Math.min(rect.x1, rect.x2)
    const right = Math.max(rect.x1, rect.x2)
    const top = Math.min(rect.y1, rect.y2)
    const bottom = Math.max(rect.y1, rect.y2)
    const selected = []
    for (const row of Array.isArray(rows) ? rows : []) {
      const entities = Array.isArray(row?.entities) ? row.entities : []
      const hit = entities.some((entity) =>
        entityCartesians(viewerNow, entity).some((cartesian) => {
          let point = null
          try {
            point = Cesium.SceneTransforms.worldToWindowCoordinates(viewerNow.scene, cartesian)
          } catch {
            point = null
          }
          if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false
          return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
        }),
      )
      if (hit) selected.push({ kind: row.kind, index: row.index, label: row.label, detail: row.detail })
    }
    return selected
  }

  function ensurePreview(Cesium) {    if (state.previewEntity) return
    try {
      state.previewEntity = viewer.entities.add({
        id: `selection-preview-${Date.now()}`,
        show: true,
        polygon: {
          hierarchy: new Cesium.CallbackProperty(
            () => (state.previewPositions.length >= 3 ? new Cesium.PolygonHierarchy(state.previewPositions) : undefined),
            false,
          ),
          material: color(Cesium, 0.18),
          perPositionHeight: true,
        },
      })
    } catch {
      state.previewEntity = null
    }
  }

  /** Draw the committed polygon + outline (shared by gestures and AOI helper). */
  function drawCommittedShape(Cesium, selection) {
    try {
      state.committedEntities.push(
        viewer.entities.add({
          id: `selection-polygon-${Date.now()}`,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(selection.positions),
            material: color(Cesium, 0.22),
            perPositionHeight: true,
          },
        }),
        viewer.entities.add({
          id: `selection-outline-${Date.now()}`,
          polyline: {
            positions: [...selection.positions, selection.positions[0]],
            width: 3,
            arcType: Cesium.ArcType?.GEODESIC,
            material: color(Cesium),
            depthFailMaterial: color(Cesium, 0.5),
          },
        }),
      )
    } catch {
      /* the readout still works without a rendered outline */
    }
  }

  function commitSelection(Cesium, ground, kind = 'rectangle') {
    const last = ground.ring[ground.ring.length - 1]
    const ring = last && last[0] === ground.ring[0][0] && last[1] === ground.ring[0][1] ? ground.ring.slice() : [...ground.ring, ground.ring[0].slice()]
    const selection = {
      kind,
      ring,
      polygon: ringToPolygon(ground.points.map((point) => [point.lon, point.lat])),
      positions: ground.points.map((point) => point.cartesian),
      area_m2: polygonAreaSquareMeters(ring),
      perimeter_m: polygonPerimeterMeters(ring),
      heightRange: ground.heightRange,
      complete: ground.complete,
      misses: ground.misses,
      created_at: now(),
    }
    drawCommittedShape(Cesium, selection)
    state.selection = selection
    if (!ground.complete) toast(t('selection.partial'))
    tool.deps?.onCommit?.(selection)
  }

  /**
   * Programmatic approximate AOI around a point (identify card "select around").
   * The ring is a true geodesic circle, but heights are flat at the picked point:
   * it is an AOI, not a building footprint, and the UI marks it as approximate.
   */
  function selectAreaAround({ lon, lat, radiusM = 15, height = 0 } = {}) {
    const Cesium = tool.deps?.getCesium?.()
    if (!Cesium || !Number.isFinite(lon) || !Number.isFinite(lat)) return null
    cancel()
    clearSelection()
    const ring = circleAroundPoint([lon, lat], radiusM, 16)
    if (ring.length < 4) return null
    const level = Number.isFinite(height) ? height + 1 : 0.5
    const positions = ring.slice(0, -1).map(([x, y]) => Cesium.Cartesian3.fromDegrees(x, y, level))
    const selection = {
      kind: 'area',
      ring,
      polygon: ringToPolygon(ring),
      positions,
      area_m2: polygonAreaSquareMeters(ring),
      perimeter_m: polygonPerimeterMeters(ring),
      heightRange: Number.isFinite(height) ? { min: height, max: height, mean: height } : null,
      complete: true,
      approximate: true,
      created_at: now(),
    }
    state.selection = selection
    drawCommittedShape(Cesium, selection)
    tool.deps?.onCommit?.(selection)
    return selection
  }

  function commitPoint(Cesium, ground) {
    const selection = {
      kind: 'point',
      lon: ground.lon,
      lat: ground.lat,
      height: Number.isFinite(ground.height) ? Math.round(ground.height) : null,
      point: [ground.lon, ground.lat],
      area_m2: 0,
      perimeter_m: 0,
      heightRange: Number.isFinite(ground.height)
        ? { min: ground.height, max: ground.height, mean: ground.height }
        : null,
      complete: true,
      created_at: now(),
    }
    try {
      state.committedEntities.push(
        viewer.entities.add({
          id: `selection-point-${Date.now()}`,
          position: ground.cartesian,
          point: {
            pixelSize: 10,
            color: color(Cesium),
            outlineColor: color(Cesium, 1) ?? undefined,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }),
      )
    } catch {
      /* the readout still works without a rendered marker */
    }
    state.selection = selection
    tool.deps?.onCommit?.(selection)
  }

  function finish() {
    const Cesium = tool.deps?.getCesium?.()
    const screenRing = state.lastScreenRing
    state.mode = null
    destroyHandler()
    restoreCamera()
    removeEntity(state.previewEntity)
    state.previewEntity = null
    state.dragStart = null
    if (!Cesium || screenRing.length < 3) {
      toast(t('selection.tooSmall'))
      tool.deps?.onCancel?.()
      return
    }
    const ground = groundRingFromScreen(viewer, Cesium, screenRing)
    if (ground.points.length < 3) {
      toast(t('selection.tooSmall'))
      tool.deps?.onCancel?.()
      return
    }
    commitSelection(Cesium, ground, 'rectangle')
  }

  function finishLasso() {
    const Cesium = tool.deps?.getCesium?.()
    const path = sampleLassoPath(state.lassoPath)
    state.mode = null
    state.lassoPath = []
    destroyHandler()
    restoreCamera()
    removeEntity(state.previewEntity)
    state.previewEntity = null
    state.previewPositions = []
    if (!Cesium || path.length < 3) {
      toast(t('selection.tooSmall'))
      tool.deps?.onCancel?.()
      return
    }
    const ground = groundRingFromScreen(viewer, Cesium, path)
    if (ground.points.length < 3) {
      toast(t('selection.tooSmall'))
      tool.deps?.onCancel?.()
      return
    }
    commitSelection(Cesium, ground, 'lasso')
  }

  function finishObjects() {
    const Cesium = tool.deps?.getCesium?.()
    const rect = state.objectRect
    state.mode = null
    destroyHandler()
    restoreCamera()
    clearObjectBox()
    if (!Cesium || !rect) {
      tool.deps?.onCancel?.()
      return
    }
    const rows = tool.deps?.getOverlayRows?.() ?? []
    const selected = rowsInScreenBox(Cesium, rows, rect)
    if (selected.length === 0) {
      toast(t('selection.objectsEmpty'))
      tool.deps?.onCancel?.()
      return
    }
    const selection = { kind: 'objects', rows: selected, created_at: now() }
    state.selection = selection
    tool.deps?.onCommit?.(selection)
  }

  function cancel() {
    if (!state.mode && !state.previewEntity) {
      clearObjectBox()
      return
    }
    state.mode = null
    state.dragStart = null
    state.lassoPath = []
    state.previewPositions = []
    state.lastScreenRing = []
    destroyHandler()
    restoreCamera()
    removeEntity(state.previewEntity)
    state.previewEntity = null
    clearObjectBox()
    tool.deps?.onCancel?.()
  }

  function start(mode = 'rect') {
    const Cesium = tool.deps?.getCesium?.()
    if (!Cesium || !viewer.scene?.canvas) {
      toast(t('agent.notReady'))
      return false
    }
    cancel()
    clearSelection()
    state.mode = mode === 'point' || mode === 'lasso' || mode === 'objects' ? mode : 'rect'
    state.dragStart = null
    state.lassoPath = []
    state.lastMoveAt = 0
    state.lastScreenRing = []
    state.previewPositions = []
    clearObjectBox()
    try {
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
      if (state.mode === 'point') {
        handler.setInputAction((event) => {
          if (!event?.position) return
          const ground = groundPointFromScreen(viewer, Cesium, event.position)
          if (!ground) {
            toast(t('toast.noSurface'))
            return
          }
          state.mode = null
          destroyHandler()
          commitPoint(Cesium, ground)
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
      } else if (state.mode === 'lasso') {
        handler.setInputAction((event) => {
          if (!event?.position) return
          state.lassoPath = [{ x: event.position.x, y: event.position.y }]
          disableCamera()
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
        handler.setInputAction((event) => {
          if (!state.mode || state.lassoPath.length === 0 || !event?.endPosition) return
          const point = event.endPosition
          const last = state.lassoPath[state.lassoPath.length - 1]
          if (Math.hypot(point.x - last.x, point.y - last.y) < 4) return
          state.lassoPath.push({ x: point.x, y: point.y })
          // Preview is throttled: unprojecting the whole path every mouse move is
          // wasteful, and the path is thinned before it reaches Cesium anyway.
          const now = Date.now()
          if (now - state.lastMoveAt < 60) return
          state.lastMoveAt = now
          const previewPath = sampleLassoPath(state.lassoPath, { minSpacing: 4, maxPoints: 80 })
          const ground = groundRingFromScreen(viewer, Cesium, previewPath)
          state.previewPositions = ground.points.map((item) => item.cartesian)
          ensurePreview(Cesium)
          viewer.scene.requestRender?.()
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
        handler.setInputAction((event) => {
          if (!state.mode) return
          if (event?.position) {
            const last = state.lassoPath[state.lassoPath.length - 1]
            if (!last || Math.hypot(event.position.x - last.x, event.position.y - last.y) >= 1) {
              state.lassoPath.push({ x: event.position.x, y: event.position.y })
            }
          }
          finishLasso()
        }, Cesium.ScreenSpaceEventType.LEFT_UP)
      } else if (state.mode === 'objects') {
        handler.setInputAction((event) => {
          if (!event?.position) return
          state.dragStart = { x: event.position.x, y: event.position.y }
          updateObjectBox({ x1: event.position.x, y1: event.position.y, x2: event.position.x, y2: event.position.y })
          disableCamera()
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
        handler.setInputAction((event) => {
          if (!state.mode || !state.dragStart || !event?.endPosition) return
          updateObjectBox({ x1: state.dragStart.x, y1: state.dragStart.y, x2: event.endPosition.x, y2: event.endPosition.y })
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
        handler.setInputAction((event) => {
          if (!state.mode) return
          if (state.dragStart && event?.position) {
            updateObjectBox({ x1: state.dragStart.x, y1: state.dragStart.y, x2: event.position.x, y2: event.position.y })
          }
          finishObjects()
        }, Cesium.ScreenSpaceEventType.LEFT_UP)
      } else {
        handler.setInputAction((event) => {
          if (!event?.position || !state.mode) return
          state.dragStart = { x: event.position.x, y: event.position.y }
          disableCamera()
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
        handler.setInputAction((event) => {
          if (!state.mode || !state.dragStart || !event?.endPosition) return
          const start = state.dragStart
          const end = event.endPosition
          const dx = end.x - start.x
          const dy = end.y - start.y
          if (Math.hypot(dx, dy) < MIN_DRAG_PX) return
          const screenRing = rectScreenRing(start, end, 6)
          const ground = groundRingFromScreen(viewer, Cesium, screenRing)
          state.lastScreenRing = screenRing
          state.previewPositions = ground.points.map((point) => point.cartesian)
          ensurePreview(Cesium)
          viewer.scene.requestRender?.()
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
        handler.setInputAction((event) => {
          if (!state.mode) return
          if (!state.dragStart) return
          const end = event?.position
          if (end && Math.hypot(end.x - state.dragStart.x, end.y - state.dragStart.y) >= MIN_DRAG_PX) {
            state.lastScreenRing = rectScreenRing(state.dragStart, end, 6)
          }
          finish()
        }, Cesium.ScreenSpaceEventType.LEFT_UP)
      }
      handler.setInputAction(() => cancel(), Cesium.ScreenSpaceEventType.RIGHT_CLICK)
      state.handler = handler
      if (typeof document !== 'undefined') {
        state.keyHandler = (event) => {
          if (event.key === 'Escape') cancel()
        }
        document.addEventListener('keydown', state.keyHandler)
      }
      return true
    } catch (error) {
      state.mode = null
      destroyHandler()
      restoreCamera()
      state.lastError = error?.message ?? String(error)
      toast(t('agent.notReady'))
      return false
    }
  }

  function clearSelection() {
    clearEntities()
    clearObjectBox()
    state.selection = null
    state.lassoPath = []
    state.previewPositions = []
    state.lastScreenRing = []
  }

  function clear() {
    cancel()
    clearSelection()
    tool.deps?.onClear?.()
  }

  function exportGeoJSON() {
    if (!state.selection) return null
    const selection = state.selection
    // Object marquee selects existing panel rows, not a new spatial geometry.
    if (selection.kind === 'objects') return null
    const point = selection.kind === 'point'
    const geometry = point ? { type: 'Point', coordinates: [selection.lon, selection.lat] } : selection.polygon
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry,
          properties: {
            kind: 'digital-earth-selection',
            shape: selection.kind,
            ...(point
              ? {
                  lon: selection.lon,
                  lat: selection.lat,
                  height_m: round(selection.height),
                }
              : {
                  area_m2: Math.round(selection.area_m2),
                  perimeter_m: Math.round(selection.perimeter_m),
                  verts: Math.max(0, selection.ring.length - 1),
                }),
            height_min_m: selection.heightRange ? round(selection.heightRange.min) : null,
            height_max_m: selection.heightRange ? round(selection.heightRange.max) : null,
            height_mean_m: selection.heightRange ? round(selection.heightRange.mean) : null,
            complete: selection.complete,
            height_reference: 'ellipsoid',
            created_at: selection.created_at,
          },
        },
      ],
    }
  }

  const round = (value) => (Number.isFinite(value) ? Math.round(value * 10) / 10 : null)

  function dispose() {
    clearSelection()
    cancel()
    sessions.delete(viewer)
  }

  const tool = {
    deps: {},
    start,
    cancel,
    clear,
    dispose,
    exportGeoJSON,
    selectAreaAround,
    isActive: () => Boolean(state.mode),
    getMode: () => state.mode,
    getSelection: () => state.selection,
    getLastError: () => state.lastError ?? null,
  }
  return tool
}

export { polygonAreaSquareMeters, polygonPerimeterMeters, heightRange }
