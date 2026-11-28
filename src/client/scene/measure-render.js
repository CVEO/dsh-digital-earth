/**
 * scene/measure-render.js — the measuring tool's drawing and its promotion into
 * the shared overlay list.
 *
 * Manual measurements used to be purely local entities: they disappeared when the
 * tool changed and never appeared under 场景 → 量测. The fix is to keep drawing in
 * this module and, when the tool ends, transfer the finished geometry into the
 * agent-overlay lists (origin 'user') so it survives, lists, flies, hides and
 * exports like every other overlay.
 *
 * Both entry points are DOM-free apart from the viewer they are handed, which
 * keeps them testable with a fake Cesium/viewer pair.
 */
import { formatArea, formatDistance, geodesicLength, planarArea } from '../format.js'
import { VECTOR_COLORS, vectorLabel } from './vector-style.js'
import { buildMeasureCommand, measureResultOf } from './measure-commit.js'

/**
 * Redraw the in-progress measurement. Keeps `state.result` in the persisted
 * shape because leaving the tool commits exactly this command.
 *
 * @param {object} args
 * @param {object} args.Cesium
 * @param {object} args.viewer
 * @param {{entities: object[], points: object[], mode?: string|null, result?: object|null}} args.state
 * @param {string} args.mode 'distance' | 'area' | 'height'
 * @param {Function} args.t i18n
 * @param {{add: Function, refresh: Function}} args.vector vector renderer
 * @param {(info: object|null) => void} args.onInfo HUD strip update
 */
export function drawMeasurePreview({ Cesium, viewer, state, mode, t, vector, onInfo }) {
  if (!Cesium || !viewer || !state) return
  for (const entity of state.entities) viewer.entities.remove(entity)
  state.entities = []
  const points = state.points
  state.mode = mode
  state.result = measureResultOf(Cesium, mode, points)
  const descriptor = { group: 'local-measure', kind: t('layers.vectorMeasured'), title: t(`tool.${mode}`), summary: '' }
  const add = (options) => {
    const entity = vector.add(options, descriptor)
    state.entities.push(entity)
    return entity
  }
  const accent = Cesium.Color.fromCssColorString(VECTOR_COLORS.accent)
  const label = (position, text) => add({ position, label: vectorLabel(Cesium, text) })
  for (const position of points) {
    add({
      position,
      point: {
        pixelSize: 6,
        color: accent,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }
  if (mode === 'distance' && points.length >= 2) {
    add({ polyline: { positions: points, width: 2, material: accent, depthFailMaterial: accent } })
    const total = geodesicLength(Cesium, points)
    label(points[points.length - 1], t('measure.total', { value: formatDistance(total) }))
    onInfo?.({ text: t('measure.distance', { value: formatDistance(total) }) })
  } else if (mode === 'area' && points.length >= 3) {
    add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(points),
        perPositionHeight: true,
        material: accent.withAlpha(0.28),
        outline: true,
        outlineColor: accent,
      },
    })
    add({ polyline: { positions: [...points, points[0]], width: 2.5, material: accent, depthFailMaterial: accent.withAlpha(0.3) } })
    const area = planarArea(Cesium, points)
    const center = Cesium.BoundingSphere.fromPoints(points).center
    label(center, t('measure.areaLabel', { value: formatArea(area) }))
    onInfo?.({ text: t('measure.area', { value: formatArea(area) }) })
  } else if (mode === 'height' && points.length === 2) {
    add({
      polyline: { positions: points, width: 2, material: accent, depthFailMaterial: accent.withAlpha(0.3) },
    })
    const left = Cesium.Cartographic.fromCartesian(points[0])
    const right = Cesium.Cartographic.fromCartesian(points[1])
    const delta = right.height - left.height
    const horizontal = new Cesium.EllipsoidGeodesic(left, right).surfaceDistance
    const text = t('measure.height', {
      value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m`,
      distance: formatDistance(horizontal),
    })
    label(points[1], text)
    onInfo?.({ text })
  } else {
    onInfo?.({ text: t('measure.start') })
  }
  descriptor.summary = state.entities.map((entity) => entity.label?.text?.getValue?.()).filter(Boolean).join(' · ')
  vector.refresh(descriptor)
}

/**
 * Move the finished measurement's entities into the overlay lists.
 *
 * Entities are transferred, not redrawn, so nothing changes visually; only the
 * ownership becomes permanent. Returns the stored command so the caller can run
 * its own bookkeeping, or `null` when there is nothing worth keeping.
 */
export function commitMeasurementToOverlay({ Cesium, state, overlay }) {
  if (!Cesium || !state || !overlay) return null
  const result = state.result ?? measureResultOf(Cesium, state.mode, state.points)
  const command = buildMeasureCommand(Cesium, { mode: state.mode, points: state.points, result })
  if (!command) return null
  const entities = Array.isArray(state.entities) ? state.entities : []
  if (entities.length > 0) overlay.entityGroups.set(command, entities)
  for (const entity of entities) overlay.measure.push(entity)
  overlay.measureCommands.push(command)
  overlay.measuredCount += command.points.length
  // The entities belong to the command now; the measuring tool starts clean.
  state.entities = []
  state.points = []
  state.result = null
  state.mode = null
  return command
}
