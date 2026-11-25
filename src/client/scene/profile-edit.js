/**
 * scene/profile-edit.js — F5 profile v2: draggable endpoints + hover readout.
 *
 * The analysis engine owns sampling and the colored line; this module only adds
 * two affordances on top of an active profile result:
 *
 *   1. the two endpoints become draggable handles (same visual language as the
 *      annotation vertices); dropping one re-runs the same profile command with
 *      the new from/to and the same height source;
 *   2. hovering the profile line on the globe reports the nearest sample, while
 *      `setHover` mirrors a chart hover as one readout point on the globe.
 *
 * Nothing here invents heights: the readout always comes from the engine points.
 */

import { PROFILE_SURFACE_OFFSET_M } from '../analysis/math.js'

/** Endpoints of an active profile analysis, or null when it is not a profile. */
export function profileEndpoints(analysis) {
  if (!analysis || analysis.operation !== 'profile') return null
  const result = analysis.result ?? {}
  const from = Array.isArray(result.from) ? result.from : null
  const to = Array.isArray(result.to) ? result.to : null
  if (!from || !to || from.length < 2 || to.length < 2) return null
  return { from: [from[0], from[1]], to: [to[0], to[1]] }
}

/** The single height source a re-run must keep (terrain vs mesh surface). */
export function profileHeightSource(analysis) {
  return analysis?.result?.height_mode === 'terrain' ? 'terrain' : 'tiles'
}

/** Screen-space hit test: nearest sample within `thresholdPx`, else -1. */
export function nearestProfileHit(screens, point, thresholdPx = 16) {
  if (!Array.isArray(screens) || !point) return -1
  let best = -1
  let bestDistance = thresholdPx
  for (let index = 0; index < screens.length; index += 1) {
    const screen = screens[index]
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) continue
    const distance = Math.hypot(screen.x - point.x, screen.y - point.y)
    if (distance <= bestDistance) {
      best = index
      bestDistance = distance
    }
  }
  return best
}

/** Replace one endpoint, keeping the other one untouched. */
export function moveProfileEndpoint(endpoints, index, lonlat) {
  if (!endpoints || !Array.isArray(lonlat) || lonlat.length < 2) return endpoints
  const next = { from: [...endpoints.from], to: [...endpoints.to] }
  next[index === 0 ? 'from' : 'to'] = [lonlat[0], lonlat[1]]
  return next
}

const READOUT_ID = 'profile-readout'
const HANDLE_SIZE = 13

export function createProfileEdit({ getCesium, getViewer, getRoot, pickSurface, onRecompute, onHover, showToast, t }) {
  const sessions = new WeakMap()

  const sessionFor = () => {
    const viewer = getViewer?.()
    if (!viewer) return null
    let state = sessions.get(viewer)
    if (!state) {
      state = { analysis: null, endpoints: null, layer: null, handles: [], readoutEl: null, readoutIndex: null, handler: null, tick: null, samples: [], handlePositions: [], hover: null, dragging: null, listeners: null, readout: null }
      sessions.set(viewer, state)
    }
    return state
  }

  const requestRender = () => {
    try {
      getViewer?.()?.scene?.requestRender?.()
    } catch {
      /* no render loop */
    }
  }

  function removeReadout(state) {
    if (state.readoutEl) state.readoutEl.style.display = 'none'
    state.readoutIndex = null
    const viewer = getViewer?.()
    if (!viewer || !state.readout) return
    try {
      viewer.entities.remove(state.readout)
    } catch {
      /* already gone */
    }
    state.readout = null
  }

  function clearDom(state) {
    for (const handle of state.handles) handle.remove()
    state.handles = []
    state.readoutEl?.remove?.()
    state.readoutEl = null
    state.layer?.remove()
    state.layer = null
  }

  function clearListeners(state) {
    const viewer = getViewer?.()
    if (state.handler) {
      try {
        state.handler.destroy()
      } catch {
        /* Cesium gone */
      }
      state.handler = null
    }
    if (state.tick && viewer?.scene?.postRender) {
      try {
        viewer.scene.postRender.removeEventListener(state.tick)
      } catch {
        /* already detached */
      }
      state.tick = null
    }
    if (state.listeners && typeof document !== 'undefined') {
      const { move, up } = state.listeners
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerup', up, true)
      state.listeners = null
    }
    state.dragging = null
  }

  /** Sample positions at the profile height + 2 m, plus their canvas points. */
  function samplePositions(state) {
    const Cesium = getCesium?.()
    const analysis = state.analysis
    const endpoints = state.endpoints
    const points = analysis?.result?.points
    if (!Cesium || !endpoints || !Array.isArray(points) || points.length === 0) return []
    const geodesic = new Cesium.EllipsoidGeodesic(
      Cesium.Cartographic.fromDegrees(endpoints.from[0], endpoints.from[1]),
      Cesium.Cartographic.fromDegrees(endpoints.to[0], endpoints.to[1]),
    )
    const lastDistance = Number(points[points.length - 1]?.distance_m)
    const lengthM = Number(analysis?.result?.length_m)
    const totalDistance =
      Number.isFinite(lengthM) && lengthM > 0
        ? lengthM
        : Number.isFinite(lastDistance) && lastDistance > 0
          ? lastDistance
          : 0
    const step = points.length > 1 ? 1 / (points.length - 1) : 0
    return points.map((sample, index) => {
      const distanceM = Number(sample?.distance_m)
      const rawFraction =
        totalDistance > 0 && Number.isFinite(distanceM)
          ? distanceM / totalDistance
          : index * step
      const fraction = Math.min(1, Math.max(0, rawFraction))
      const carto = geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic())
      const height = typeof sample?.height_m === 'number' ? sample.height_m : 0
      return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height + PROFILE_SURFACE_OFFSET_M)
    })
  }

  function canvasToRootOffset() {
    const canvasRect = getViewer?.()?.scene?.canvas?.getBoundingClientRect?.()
    const rootRect = getRoot?.()?.getBoundingClientRect?.()
    if (!canvasRect || !rootRect) return { x: 0, y: 0 }
    return { x: canvasRect.left - rootRect.left, y: canvasRect.top - rootRect.top }
  }

  function paint(state) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const scene = viewer?.scene
    if (!Cesium || !scene || typeof scene.cartesianToCanvasCoordinates !== 'function') return
    const offset = canvasToRootOffset()
    for (const handle of state.handles) {
      const index = Number(handle.dataset.index)
      if (state.dragging && state.dragging.index === index) continue
      const cartesian = state.handlePositions[index]
      if (!cartesian) {
        handle.style.display = 'none'
        continue
      }
      const screen = scene.cartesianToCanvasCoordinates(cartesian)
      if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
        handle.style.display = 'none'
        continue
      }
      handle.style.display = ''
      handle.style.transform = `translate(${offset.x + screen.x - HANDLE_SIZE / 2}px, ${offset.y + screen.y - HANDLE_SIZE / 2}px)`
    }
    if (state.hover !== null) {
      if (state.readoutIndex !== state.hover) paintReadout(state, state.hover)
      else positionReadoutDom(state, state.hover, offset)
    }
  }

  function positionReadoutDom(state, index, cachedOffset = null) {
    const el = state.readoutEl
    if (!el) return
    const scene = getViewer?.()?.scene
    const cartesian = state.samples[index]
    if (!scene || !cartesian || typeof scene.cartesianToCanvasCoordinates !== 'function') {
      el.style.display = 'none'
      return
    }
    const screen = scene.cartesianToCanvasCoordinates(cartesian)
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
      el.style.display = 'none'
      return
    }
    const offset = cachedOffset ?? canvasToRootOffset()
    const canvasWidth = scene.canvas?.clientWidth || 0
    const x = offset.x + (canvasWidth > 0 ? Math.max(76, Math.min(canvasWidth - 76, screen.x)) : screen.x)
    const y = offset.y + screen.y
    const flipBelow = screen.y < 52
    el.dataset.placement = flipBelow ? 'bottom' : 'top'
    el.style.display = 'inline-flex'
    el.style.transform = flipBelow
      ? `translate3d(${Math.round(x)}px, ${Math.round(y + 14)}px, 0) translate(-50%, 0)`
      : `translate3d(${Math.round(x)}px, ${Math.round(y - 14)}px, 0) translate(-50%, -100%)`
  }

  function updateReadoutDom(state, distanceValue, heightValue) {
    const el = state.readoutEl
    if (!el) return
    const distEl = el.querySelector?.('.mv-pr-dist .mv-pr-val')
    const elevWrap = el.querySelector?.('.mv-pr-elev')
    const elevEl = el.querySelector?.('.mv-pr-elev .mv-pr-val')
    const elevUnit = el.querySelector?.('.mv-pr-elev .mv-pr-unit')
    if (distEl) distEl.textContent = distanceValue
    if (elevEl) elevEl.textContent = heightValue ?? '—'
    if (elevUnit) elevUnit.style.display = heightValue !== null ? '' : 'none'
    if (elevWrap) elevWrap.classList?.toggle?.('empty', heightValue === null)
  }

  function canvasPoint(event) {
    const viewer = getViewer?.()
    const canvas = viewer?.scene?.canvas
    const rect = canvas?.getBoundingClientRect?.()
    const Cesium = getCesium?.()
    if (!rect || !Cesium?.Cartesian2) return null
    return new Cesium.Cartesian2(event.clientX - rect.left, event.clientY - rect.top)
  }

  function surfaceLonLat(position) {
    const Cesium = getCesium?.()
    const surface = position ? pickSurface?.(position) : null
    if (!Cesium || !surface) return null
    try {
      const carto = Cesium.Cartographic.fromCartesian(surface)
      return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)]
    } catch {
      return null
    }
  }

  function installPointer(state) {
    if (typeof document === 'undefined') return
    const move = (event) => {
      const current = state.dragging
      if (!current) return
      const handle = state.handles[current.index]
      if (handle) {
        const rootRect = getRoot?.()?.getBoundingClientRect?.()
        const x = rootRect ? event.clientX - rootRect.left : event.clientX
        const y = rootRect ? event.clientY - rootRect.top : event.clientY
        handle.style.display = ''
        handle.style.transform = `translate(${x - HANDLE_SIZE / 2}px, ${y - HANDLE_SIZE / 2}px)`
      }
      current.position = canvasPoint(event) ?? current.position
    }
    const up = () => {
      const current = state.dragging
      state.dragging = null
      if (!current) return
      const lonlat = surfaceLonLat(current.position)
      const endpoints = state.endpoints
      if (!lonlat || !endpoints) {
        showToast(t('profile.recomputeFailed', { message: t('toast.noSurface') }))
        requestRender()
        return
      }
      // A drag that lands on the same point must not throw the user's run away.
      const previous = current.index === 0 ? endpoints.from : endpoints.to
      if (Math.abs(previous[0] - lonlat[0]) < 1e-9 && Math.abs(previous[1] - lonlat[1]) < 1e-9) {
        requestRender()
        return
      }
      const next = moveProfileEndpoint(endpoints, current.index, lonlat)
      showToast(t('profile.recomputing'))
      try {
        void Promise.resolve(
          onRecompute?.({ from: next.from, to: next.to, source: profileHeightSource(state.analysis) }),
        ).catch((error) => showToast(t('profile.recomputeFailed', { message: error?.message ?? String(error) })))
      } catch (error) {
        showToast(t('profile.recomputeFailed', { message: error?.message ?? String(error) }))
      }
    }
    document.addEventListener('pointermove', move, true)
    document.addEventListener('pointerup', up, true)
    state.listeners = { move, up }
  }

  function installHover(state) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const canvas = viewer?.scene?.canvas
    const EventHandler = Cesium?.ScreenSpaceEventHandler
    const moveType = Cesium?.ScreenSpaceEventType?.MOUSE_MOVE
    if (!EventHandler || !canvas || moveType === undefined) return
    try {
      const handler = new EventHandler(canvas)
      handler.setInputAction((event) => {
        const scene = viewer?.scene
        if (!scene || typeof scene.cartesianToCanvasCoordinates !== 'function') return
        const screens = state.samples.map((cartesian) => scene.cartesianToCanvasCoordinates(cartesian))
        const index = nearestProfileHit(screens, event?.endPosition)
        const next = index >= 0 ? index : null
        if (next === state.hover) return
        state.hover = next
        if (next === null) removeReadout(state)
        else paintReadout(state, next)
        if (typeof onHover === 'function') onHover(state.hover)
        requestRender()
      }, moveType)
      state.handler = handler
    } catch {
      state.handler = null
    }
  }

  function paintReadout(state, index) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    const point = state.analysis?.result?.points?.[index]
    const cartesian = state.samples[index]
    if (!Cesium || !viewer || !point || !cartesian) return
    const distanceNum = Number(point.distance_m)
    const distNumStr = (Number.isFinite(distanceNum) ? distanceNum : 0).toFixed(1)
    const distance = `${distNumStr} m`
    const hasHeight = typeof point.height_m === 'number' && Number.isFinite(point.height_m)
    const heightNumStr = hasHeight ? point.height_m.toFixed(1) : null
    const text = hasHeight
      ? t('profile.hoverReadout', { distance, height: `${heightNumStr} m` })
      : t('profile.hoverEmpty', { distance })
    if (state.readoutIndex !== index) {
      removeReadout(state)
      state.readoutIndex = index
      try {
        state.readout = viewer.entities.add({
          id: `${READOUT_ID}-${index}`,
          position: cartesian,
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString('#38bdf8') ?? Cesium.Color.WHITE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text,
            show: !state.readoutEl,
            font: '600 12px "Segoe UI", "PingFang SC", sans-serif',
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: (Cesium.Color.fromCssColorString('#0f172a') ?? Cesium.Color.BLACK).withAlpha?.(0.88) ?? Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin?.BOTTOM ?? 0,
            pixelOffset: new Cesium.Cartesian2(0, -16),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
      } catch {
        state.readout = null
      }
    }
    updateReadoutDom(state, distNumStr, heightNumStr)
    positionReadoutDom(state, index)
  }

  /** Rebuild the affordances for the current analysis (or tear them down). */
  function sync(analysis) {
    const state = sessionFor()
    if (!state) return
    clearListeners(state)
    clearDom(state)
    removeReadout(state)
    state.hover = null
    state.analysis = analysis ?? null
    state.endpoints = profileEndpoints(analysis)
    state.samples = state.endpoints ? samplePositions(state) : []
    state.handlePositions = state.samples.length > 0 ? [state.samples[0], state.samples[state.samples.length - 1]] : []
    if (!state.endpoints) return

    const root = getRoot?.()
    if (root && typeof document !== 'undefined') {
      const layer = document.createElement('div')
      layer.className = 'mv-vertex-layer'
      root.appendChild(layer)
      state.layer = layer
      const label = [t('profile.dragStart'), t('profile.dragEnd')]
      state.handles = [0, 1].map((index) => {
        const handle = document.createElement('div')
        handle.className = 'mv-vertex center'
        handle.dataset.index = String(index)
        handle.title = label[index]
        handle.setAttribute('role', 'slider')
        handle.setAttribute('aria-label', label[index])
        handle.addEventListener('pointerdown', (event) => {
          event.preventDefault()
          event.stopPropagation()
          state.dragging = { index, position: null }
          handle.style.cursor = 'grabbing'
        })
        layer.appendChild(handle)
        return handle
      })
      const pill = document.createElement('div')
      pill.className = 'mv-profile-readout'
      pill.style.display = 'none'
      const makeSpan = (cls, text = '') => {
        const el = document.createElement('span')
        el.className = cls
        if (text) el.textContent = text
        return el
      }
      const distWrap = makeSpan('mv-pr-item mv-pr-dist')
      distWrap.appendChild(makeSpan('mv-pr-val'))
      distWrap.appendChild(makeSpan('mv-pr-unit', 'm'))
      const elevWrap = makeSpan('mv-pr-item mv-pr-elev')
      elevWrap.appendChild(makeSpan('mv-pr-k', '▲'))
      elevWrap.appendChild(makeSpan('mv-pr-val'))
      elevWrap.appendChild(makeSpan('mv-pr-unit', 'm'))
      pill.appendChild(makeSpan('mv-pr-dot'))
      pill.appendChild(distWrap)
      pill.appendChild(makeSpan('mv-pr-sep'))
      pill.appendChild(elevWrap)
      root.appendChild(pill)
      state.readoutEl = pill
      installPointer(state)
    }
    installHover(state)
    const viewer = getViewer?.()
    if (viewer?.scene?.postRender && typeof viewer.scene.postRender.addEventListener === 'function') {
      state.tick = () => paint(state)
      viewer.scene.postRender.addEventListener(state.tick)
    }
    paint(state)
    requestRender()
  }

  /** Chart → globe: mirror a chart hover as one readout point. */
  function setHover(index) {
    const state = sessionFor()
    if (!state) return
    const next = Number.isInteger(index) && index >= 0 && index < state.samples.length ? index : null
    if (state.hover === next) return
    state.hover = next
    if (next === null) removeReadout(state)
    else paintReadout(state, next)
    requestRender()
  }

  function clear() {
    const state = sessionFor()
    if (!state) return
    clearListeners(state)
    clearDom(state)
    removeReadout(state)
    state.analysis = null
    state.endpoints = null
    state.samples = []
    state.hover = null
    if (typeof onHover === 'function') onHover(null)
  }

  return { sync, setHover, clear, dispose: clear }
}

/** Exposed for the wiring test: labels use the shared profile drag hints. */
export const PROFILE_EDIT_KEYS = ['profile.dragStart', 'profile.dragEnd', 'profile.recomputing', 'profile.recomputeFailed']
