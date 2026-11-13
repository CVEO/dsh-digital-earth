/**
 * scene/annotation-tool.js — click to draw a point, line or area annotation (F2b).
 *
 * Mirrors scene/profile-tool.js: the module owns its own ScreenSpaceEventHandler
 * while the tool is active, so the first click reacts immediately and the draft
 * follows the cursor. Geometry is handed to the caller as one plain GeoJSON
 * Feature; naming, drawing, persistence and selection stay in the viewer.
 *
 * Gestures: click adds a vertex, double-click (>=2/3 vertices) finishes, Enter
 * finishes, Esc or right click cancels. A point finishes on its first click.
 */
const DRAFT_COLOR = '#f472b6'
const DRAFT_WIDTH = 2.5
const MARKER_PIXELS = 7

// One session per viewer: ViewerSurface re-creates the tool every render, and the
// canvas click route may belong to an older instance than the start button.
const sessions = new WeakMap()

export function createAnnotationTool({ getCesium, getViewer, pickSurface, setTool, showToast, t, onFinish }) {
  const sessionFor = () => {
    const viewer = getViewer?.()
    if (!viewer) return null
    let state = sessions.get(viewer)
    if (!state) {
      state = { kind: null, style: null, points: [], entities: [], handler: null, cursor: null, keydown: null }
      sessions.set(viewer, state)
    }
    return state
  }

  const removeEntities = (state) => {
    const viewer = getViewer?.()
    if (viewer) {
      for (const entity of state.entities) {
        try {
          viewer.entities.remove(entity)
        } catch {
          /* already detached */
        }
      }
    }
    state.entities = []
  }

  const addEntity = (state, options) => {
    const viewer = getViewer?.()
    if (!viewer) return null
    try {
      const entity = viewer.entities.add(options)
      state.entities.push(entity)
      return entity
    } catch {
      return null
    }
  }

  const draftColor = (Cesium) => Cesium.Color?.fromCssColorString?.(DRAFT_COLOR) ?? Cesium.Color.WHITE

  const destroyHandler = (state) => {
    if (state.handler) {
      try { state.handler.destroy() } catch { /* Cesium may already be gone */ }
      state.handler = null
    }
    if (state.keydown && typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener('keydown', state.keydown)
      state.keydown = null
    }
  }

  const positionsOf = (state, Cesium) => {
    const read = () => {
      const list = state.points.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat))
      if (state.cursor) list.push(state.cursor)
      return list
    }
    return typeof Cesium.CallbackProperty === 'function' ? new Cesium.CallbackProperty(read, false) : read()
  }

  const drawDraft = (state, Cesium) => {
    if (state.points.length === 0) return
    const color = draftColor(Cesium)
    for (const [index, point] of state.points.entries()) {
      addEntity(state, {
        id: `annotation-draft-${index}-${Date.now()}`,
        position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat),
        point: {
          pixelSize: MARKER_PIXELS,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    }
    if (state.points.length >= 2) {
      addEntity(state, {
        id: `annotation-draft-line-${Date.now()}`,
        polyline: {
          positions: positionsOf(state, Cesium),
          width: DRAFT_WIDTH,
          material: color,
          arcType: Cesium.ArcType?.GEODESIC,
          depthFailMaterial: typeof color.withAlpha === 'function' ? color.withAlpha(0.35) : undefined,
        },
      })
    }
    if (state.kind === 'area' && state.points.length >= 3 && typeof Cesium.PolygonHierarchy === 'function') {
      addEntity(state, {
        id: `annotation-draft-fill-${Date.now()}`,
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const ring = state.points.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat))
            if (state.cursor) ring.push(state.cursor)
            return new Cesium.PolygonHierarchy(ring)
          }, false),
          material: typeof color.withAlpha === 'function' ? color.withAlpha(0.22) : color,
        },
      })
    }
    try { getViewer?.().scene.requestRender?.() } catch { /* no render loop to nudge */ }
  }

  const syncDraft = (state) => {
    removeEntities(state)
    const Cesium = getCesium?.()
    if (Cesium) drawDraft(state, Cesium)
  }

  const clear = () => {
    const state = sessionFor()
    if (!state) return
    destroyHandler(state)
    removeEntities(state)
    state.kind = null
    state.style = null
    state.points = []
    state.cursor = null
  }

  const finish = (reason = 'click') => {
    const Cesium = getCesium?.()
    const state = sessionFor()
    if (!Cesium || !state || !state.kind) return
    // A double-click fires two LEFT_CLICK events before LEFT_DOUBLE_CLICK; the
    // second one landed on the same spot, so drop the duplicate vertex.
    const points = reason === 'double' && state.points.length > 1 ? state.points.slice(0, -1) : state.points.slice()
    const kind = state.kind
    const style = state.style
    const singlePoint = kind === 'point' || kind === 'note'
    const minimum = kind === 'area' ? 3 : 2
    if (!singlePoint && points.length < minimum) {
      showToast(t(kind === 'area' ? 'annotation.needArea' : 'annotation.needLine'))
      return
    }
    const coordinates = points.map((point) => [point.lon, point.lat])
    if (kind === 'area') coordinates.push([points[0].lon, points[0].lat])
    const geometry = singlePoint
      ? { type: 'Point', coordinates: coordinates[0] }
      : kind === 'area'
        ? { type: 'Polygon', coordinates: [coordinates] }
        : { type: 'LineString', coordinates }
    clear()
    setTool(null)
    if (typeof onFinish === 'function') {
      onFinish({
        type: 'Feature',
        properties: { kind, source: 'manual', ...(style ? { style } : {}) },
        geometry,
      })
    }
  }

  function installHandler(state) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const canvas = viewer?.scene?.canvas
    const EventHandler = Cesium?.ScreenSpaceEventHandler
    if (!EventHandler || !canvas) return
    const events = Cesium.ScreenSpaceEventType
    destroyHandler(state)
    const handler = new EventHandler(canvas)
    handler.setInputAction((event) => {
      const surface = pickSurface?.(event?.position)
      if (!surface) {
        showToast(t('toast.noSurface'))
        return
      }
      const current = sessionFor()
      if (!current || !current.kind) return
      let carto = null
      try { carto = Cesium.Cartographic.fromCartesian(surface) } catch { carto = null }
      if (!carto) return
      current.points.push({
        lon: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude),
      })
      current.cursor = surface
      if (current.kind === 'point' || current.kind === 'note') {
        finish('click')
        return
      }
      syncDraft(current)
      showToast(t(`annotation.${current.kind}Hint`, { n: current.points.length }))
    }, events.LEFT_CLICK)
    handler.setInputAction((event) => {
      const current = sessionFor()
      if (!current || !current.kind) return
      const surface = pickSurface?.(event?.endPosition ?? event?.position)
      current.cursor = surface ?? current.cursor
      try { viewer.scene.requestRender?.() } catch { /* no render loop to nudge */ }
    }, events.MOUSE_MOVE)
    handler.setInputAction(() => finish('double'), events.LEFT_DOUBLE_CLICK)
    handler.setInputAction(() => cancel(), events.RIGHT_CLICK)
    state.handler = handler
    state.keydown = (event) => {
      if (event?.key === 'Escape') cancel()
      if (event?.key === 'Enter') finish('enter')
    }
    if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('keydown', state.keydown)
  }

  function start(kind = 'point', style = null) {
    clear()
    setTool('annotate')
    const state = sessionFor()
    if (!state) return
    state.kind = kind
    state.style = typeof style === 'string' && style !== '' ? style : null
    showToast(t(`annotation.${kind}Start`))
    installHandler(state)
  }

  /** Drop the draft without touching the active tool (another tool took over). */
  function abort() {
    clear()
  }

  function cancel() {
    const state = sessionFor()
    const wasActive = Boolean(state?.kind)
    clear()
    if (wasActive) setTool(null)
  }

  return { start, cancel, abort, clear, dispose: clear }
}
