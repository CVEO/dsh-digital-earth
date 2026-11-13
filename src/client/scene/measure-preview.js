/**
 * scene/measure-preview.js — live MOUSE_MOVE rubber-band preview for manual
 * distance, area and height measurements.
 *
 * Ephemeral entities live directly on viewer.entities (never vectorRef) so hover
 * feedback never pollutes saved overlays or triggers scene dirty snapshots, and
 * clears automatically whenever the tool switches, cancels or resets.
 */
import { VECTOR_COLORS, vectorLabel } from './vector-style.js'

const isMeasureTool = (mode) => mode === 'distance' || mode === 'area' || mode === 'height'

const isPreviewActive = (mode, points) => {
  if (!Array.isArray(points) || points.length === 0) return false
  if (mode === 'height') return points.length === 1
  return mode === 'distance' || mode === 'area'
}

export function createMeasurePreview({
  getCesium,
  getViewer,
  toolRef,
  measureRef,
  pickSurface,
  geodesicLength,
  planarArea,
  formatDistance,
  formatArea,
  t,
}) {
  const state = {
    entities: [],
    installedKey: null,
    cursor: null,
    lastPos: null,
  }

  function removeEntities() {
    const viewer = getViewer?.()
    if (viewer?.entities) {
      for (const entity of state.entities) {
        try {
          viewer.entities.remove(entity)
        } catch {
          /* already detached */
        }
      }
    }
    state.entities = []
    state.installedKey = null
  }

  function requestRender() {
    try {
      getViewer?.()?.scene?.requestRender?.()
    } catch {
      /* headless viewer or already disposed */
    }
  }

  function prop(Cesium, getter, fallback) {
    return typeof Cesium.CallbackProperty === 'function'
      ? new Cesium.CallbackProperty(getter, false)
      : fallback
  }

  function dashMaterial(Cesium, color, dashLength = 12) {
    return typeof Cesium.PolylineDashMaterialProperty === 'function'
      ? new Cesium.PolylineDashMaterialProperty({ color, dashLength })
      : color
  }

  function previewLabelOptions(Cesium, readPosition, readText) {
    const offset = typeof Cesium.Cartesian2 === 'function' ? new Cesium.Cartesian2(16, -18) : undefined
    const base = typeof Cesium.LabelStyle !== 'undefined' && typeof Cesium.Cartesian2 === 'function'
      ? vectorLabel(Cesium, '', { ...(offset ? { pixelOffset: offset } : {}) })
      : { text: '', ...(offset ? { pixelOffset: offset } : {}) }
    return {
      ...base,
      position: prop(Cesium, readPosition, readPosition()),
      text: prop(Cesium, readText, readText()),
      show: prop(Cesium, () => Boolean(state.cursor), false),
    }
  }

  function buildHeightCorners(Cesium, anchor, cursor) {
    const left = Cesium.Cartographic.fromCartesian(anchor)
    const right = Cesium.Cartographic.fromCartesian(cursor)
    if (!left || !right) return null
    const horiz = new Cesium.EllipsoidGeodesic(left, right).surfaceDistance
    const delta = right.height - left.height
    const corner = typeof Cesium.Cartesian3?.fromRadians === 'function'
      ? Cesium.Cartesian3.fromRadians(left.longitude, left.latitude, right.height)
      : null
    return { horiz, delta, corner }
  }

  function installEntities(Cesium, viewer, mode, points) {
    removeEntities()
    if (!viewer?.entities || !Cesium) return
    const key = `${mode}:${points.length}`
    state.installedKey = key
    const base = typeof Cesium.Color?.fromCssColorString === 'function'
      ? Cesium.Color.fromCssColorString(VECTOR_COLORS.accent)
      : Cesium.Color?.WHITE
    const strokeColor = typeof base?.withAlpha === 'function' ? base.withAlpha(0.92) : base
    const guideColor = typeof base?.withAlpha === 'function' ? base.withAlpha(0.65) : base
    const fillColor = typeof base?.withAlpha === 'function' ? base.withAlpha(0.16) : base
    const depthColor = typeof base?.withAlpha === 'function' ? base.withAlpha(0.32) : base
    const anchor = points[points.length - 1]

    const add = (options) => {
      try {
        const entity = viewer.entities.add({ id: `measure-preview-${state.entities.length}-${Date.now()}`, ...options })
        state.entities.push(entity)
        return entity
      } catch {
        return null
      }
    }

    const line = (positionsGetter, color, width = 2, dashLength = 12) =>
      add({
        polyline: {
          positions: prop(Cesium, positionsGetter, [anchor, anchor]),
          width,
          material: dashMaterial(Cesium, color, dashLength),
          ...(depthColor ? { depthFailMaterial: dashMaterial(Cesium, depthColor, dashLength) } : {}),
        },
        show: prop(Cesium, () => Boolean(state.cursor), false),
      })

    if (mode === 'distance') {
      line(() => (state.cursor ? [anchor, state.cursor] : [anchor, anchor]), strokeColor, 2.2)
      add(
        previewLabelOptions(
          Cesium,
          () => state.cursor ?? anchor,
          () => {
            if (!state.cursor) return ''
            try {
              const seg = geodesicLength(Cesium, [anchor, state.cursor])
              if (points.length === 1) return `+${formatDistance(seg)}`
              const total = geodesicLength(Cesium, [...points, state.cursor])
              return t('measure.previewSegment', { seg: formatDistance(seg), total: formatDistance(total) })
            } catch {
              return ''
            }
          },
        ),
      )
      return
    }

    if (mode === 'area') {
      if (points.length === 1) {
        line(() => (state.cursor ? [anchor, state.cursor] : [anchor, anchor]), strokeColor, 2.2)
        add(
          previewLabelOptions(
            Cesium,
            () => state.cursor ?? anchor,
            () => {
              if (!state.cursor) return ''
              try {
                return formatDistance(geodesicLength(Cesium, [anchor, state.cursor]))
              } catch {
                return ''
              }
            },
          ),
        )
        return
      }
      if (typeof Cesium.PolygonHierarchy === 'function') {
        add({
          polygon: {
            hierarchy: prop(
              Cesium,
              () => new Cesium.PolygonHierarchy(state.cursor ? [...points, state.cursor] : points),
              new Cesium.PolygonHierarchy(points),
            ),
            perPositionHeight: true,
            material: fillColor,
            outline: false,
          },
          show: prop(Cesium, () => Boolean(state.cursor), false),
        })
      }
      line(() => (state.cursor ? [anchor, state.cursor, points[0]] : [anchor, points[0]]), strokeColor, 2.2)
      add(
        previewLabelOptions(
          Cesium,
          () => state.cursor ?? anchor,
          () => {
            if (!state.cursor) return ''
            try {
              const area = planarArea(Cesium, [...points, state.cursor])
              return t('measure.previewArea', { area: formatArea(area) })
            } catch {
              return ''
            }
          },
        ),
      )
      return
    }

    if (mode === 'height') {
      line(() => (state.cursor ? [anchor, state.cursor] : [anchor, anchor]), strokeColor, 2.2)
      line(
        () => {
          if (!state.cursor) return [anchor, anchor]
          try {
            const info = buildHeightCorners(Cesium, anchor, state.cursor)
            return info?.corner ? [anchor, info.corner, state.cursor] : [anchor, state.cursor]
          } catch {
            return [anchor, anchor]
          }
        },
        guideColor,
        1.6,
        8,
      )
      add(
        previewLabelOptions(
          Cesium,
          () => state.cursor ?? anchor,
          () => {
            if (!state.cursor) return ''
            try {
              const info = buildHeightCorners(Cesium, anchor, state.cursor)
              if (!info || !Number.isFinite(info.delta) || !Number.isFinite(info.horiz)) return ''
              const signed = `${info.delta >= 0 ? '+' : ''}${info.delta.toFixed(2)} m`
              return t('measure.previewHeight', { height: signed, distance: formatDistance(info.horiz) })
            } catch {
              return ''
            }
          },
        ),
      )
    }
  }

  function clear() {
    const hadAnything = state.entities.length > 0 || state.cursor !== null
    removeEntities()
    state.cursor = null
    state.lastPos = null
    if (hadAnything) requestRender()
  }

  function sync(overrideMode) {
    const mode = overrideMode ?? toolRef?.current
    const points = measureRef?.current?.points ?? []
    if (!isMeasureTool(mode) || !isPreviewActive(mode, points)) {
      clear()
      return
    }
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer) return
    // Reset hover cursor immediately after a click commits a vertex so the
    // preview waits for the next mouse movement rather than drawing a zero edge.
    state.cursor = null
    state.lastPos = null
    installEntities(Cesium, viewer, mode, points)
    requestRender()
  }

  function onMove(position) {
    const mode = toolRef?.current
    if (!isMeasureTool(mode)) {
      if (state.entities.length > 0) clear()
      return
    }
    const points = measureRef?.current?.points ?? []
    if (!isPreviewActive(mode, points)) {
      if (state.entities.length > 0) clear()
      return
    }
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return
    if (state.lastPos && Math.abs(position.x - state.lastPos.x) < 0.5 && Math.abs(position.y - state.lastPos.y) < 0.5) {
      return
    }
    state.lastPos = { x: position.x, y: position.y }

    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer) return
    const key = `${mode}:${points.length}`
    if (state.installedKey !== key) installEntities(Cesium, viewer, mode, points)

    const surface = pickSurface?.(position) ?? null
    if (!surface) {
      if (state.cursor !== null) {
        state.cursor = null
        requestRender()
      }
      return
    }
    state.cursor = surface
    requestRender()
  }

  return { clear, sync, onMove, dispose: clear }
}
