/**
 * scene/profile-tool.js — manual two-click profile.
 *
 * The user clicks a start and an end point on the globe. The module turns those
 * picks into the same `{ from, to, samples }` command the Agent uses, so the
 * existing analysis engine owns sampling, the colored line, the result card and
 * the scene snapshot.
 *
 * v1.5.2: the first click must react immediately, so this module owns its own
 * ScreenSpaceEventHandler on viewer.scene.canvas (MOUSE_MOVE): a dashed draft
 * polyline follows the cursor from the start marker. The second click freezes
 * the draft to [start, end] at once and then hands the command to the analysis
 * engine; the draft disappears when the run settles, success or failure. Esc /
 * right click / cancel destroy the handler and every draft entity.
 */
const DRAFT_COLOR = '#2563eb'
const DRAFT_WIDTH = 2.5
const FIXED_WIDTH = 3

// One session per viewer. ViewerSurface re-creates the tool object on every
// render and the click route may belong to an older instance than the start
// button, so state must be shared (a plain closure would split the draft in two).
const sessions = new WeakMap()

export function createProfileTool({ getCesium, getViewer, pickSurface, setTool, runAnalysis, showToast, t }) {
  const sessionFor = () => {
    const viewer = getViewer?.()
    if (!viewer) return null
    let state = sessions.get(viewer)
    if (!state) {
      state = { points: [], entities: [], handler: null, start: null, cursor: null, locked: false, run: 0 }
      sessions.set(viewer, state)
    }
    return state
  }

  function removeEntities(state) {
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

  function destroyHandler(state) {
    if (!state.handler) return
    try {
      state.handler.destroy()
    } catch {
      /* Cesium may already be gone */
    }
    state.handler = null
  }

  function addEntity(state, options) {
    const viewer = getViewer?.()
    if (!viewer) return null
    try {
      const entity = viewer.entities.add(options)
      state.entities.push(entity)
      return entity
    } catch {
      /* a viewer without entities still profiles; the draft is cosmetic */
      return null
    }
  }

  const draftColor = (Cesium) => Cesium.Color.fromCssColorString(DRAFT_COLOR) ?? Cesium.Color.WHITE

  const dashMaterial = (Cesium) =>
    typeof Cesium.PolylineDashMaterialProperty === 'function'
      ? new Cesium.PolylineDashMaterialProperty({ color: draftColor(Cesium), dashLength: 14 })
      : draftColor(Cesium)

  const polyline = (Cesium, positions, width, material) => {
    const options = { positions, width, material }
    if (Cesium.ArcType && Cesium.ArcType.GEODESIC !== undefined) options.arcType = Cesium.ArcType.GEODESIC
    // A picked point sits exactly on the tile surface, so a 2.5 px line would
    // z-fight; the depth-fail colour keeps the draft readable (35% alpha).
    const color = draftColor(Cesium)
    if (typeof color.withAlpha === 'function') options.depthFailMaterial = color.withAlpha(0.35)
    return options
  }

  function marker(state, Cesium, cartesian, index) {
    return addEntity(state, {
      id: `profile-draft-${index}-${Date.now()}`,
      position: cartesian,
      point: {
        pixelSize: index === 1 ? 8 : 9,
        color: draftColor(Cesium),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  // The draft line reads its end from the session every frame: MOUSE_MOVE only
  // moves the cursor point, so hovering never rebuilds the entity.
  const draftPositions = (state, Cesium) => {
    const read = () => [state.start, state.cursor ?? state.start]
    return typeof Cesium.CallbackProperty === 'function' ? new Cesium.CallbackProperty(read, false) : read()
  }

  // start() owns this handler (ViewerSurface is not touched): it is the only
  // thing that makes the first click feel immediate.
  function installHandler(state) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const canvas = viewer?.scene?.canvas
    const EventHandler = Cesium?.ScreenSpaceEventHandler
    const moveType = Cesium?.ScreenSpaceEventType?.MOUSE_MOVE
    if (!state || !EventHandler || !canvas || moveType === undefined) return
    destroyHandler(state)
    try {
      const handler = new EventHandler(canvas)
      handler.setInputAction((event) => {
        const position = event?.endPosition
        if (!position) return
        const current = sessionFor()
        if (!current) return
        const surface = pickSurface?.(position)
        if (!surface) return
        current.cursor = surface
        try {
          viewer.scene.requestRender?.()
        } catch {
          /* no render loop to nudge */
        }
      }, moveType)
      state.handler = handler
    } catch {
      state.handler = null
    }
  }

  function clear() {
    const state = sessionFor()
    if (!state) return
    destroyHandler(state)
    removeEntities(state)
    state.points = []
    state.start = null
    state.cursor = null
    state.locked = false
  }

  function start() {
    clear()
    setTool('profile')
    showToast(t('profile.clickStart'))
    const state = sessionFor()
    if (!state) return
    state.run += 1
    installHandler(state)
  }

  function cancel() {
    clear()
    setTool(null)
  }

  function onPoint(position) {
    const Cesium = getCesium?.()
    const state = sessionFor()
    if (!Cesium || !state || state.locked) return
    const surface = pickSurface?.(position)
    if (!surface) {
      showToast(t('toast.noSurface'))
      return
    }
    let carto = null
    try {
      carto = Cesium.Cartographic.fromCartesian(surface)
    } catch {
      carto = null
    }
    if (!carto) {
      showToast(t('toast.noSurface'))
      return
    }
    const point = { lon: Cesium.Math.toDegrees(carto.longitude), lat: Cesium.Math.toDegrees(carto.latitude) }
    state.points.push(point)
    if (state.points.length === 1) {
      // Immediate feedback: start marker + dashed draft line that follows the
      // cursor (the MOUSE_MOVE handler only updates state.cursor).
      state.start = surface
      state.cursor = surface
      marker(state, Cesium, surface, 1)
      addEntity(state, {
        id: `profile-draft-line-${Date.now()}`,
        polyline: polyline(Cesium, draftPositions(state, Cesium), DRAFT_WIDTH, dashMaterial(Cesium)),
      })
      showToast(t('profile.clickEnd'))
      return
    }
    // Second click: freeze the draft to [start, end] BEFORE the async analysis so
    // the user sees the selection at once; the run settles the same entities.
    state.locked = true
    destroyHandler(state)
    state.cursor = surface
    const from = state.points[0]
    const to = state.points[1]
    const runId = state.run
    removeEntities(state)
    marker(state, Cesium, state.start ?? surface, 1)
    marker(state, Cesium, surface, 2)
    addEntity(state, {
      id: `profile-draft-fixed-${Date.now()}`,
      polyline: polyline(Cesium, [state.start ?? surface, surface], FIXED_WIDTH, draftColor(Cesium)),
    })
    showToast(t('profile.running'))
    void (async () => {
      try {
        await runAnalysis({ action: 'profile', from: [from.lon, from.lat], to: [to.lon, to.lat], samples: 32 })
      } catch (error) {
        showToast(t('profile.failed', { message: error?.message ?? String(error) }))
      } finally {
        // Success or failure: the engine owns the final line, the draft goes. A
        // newer run (restarted meanwhile) keeps its own draft and tool mode.
        const current = sessionFor()
        if (current && current.run === runId) {
          clear()
          setTool(null)
        }
      }
    })()
  }

  return { start, onPoint, cancel, clear, dispose: clear }
}
