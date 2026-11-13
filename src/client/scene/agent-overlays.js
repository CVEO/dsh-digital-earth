/**
 * scene/agent-overlays.js — Agent draw/measure overlay bookkeeping.
 *
 * v1.6 Phase 2: ViewerSurface kept the entity lists, the "clear all" sweep and (now
 * that L4 is editable) per-row removal. The pure list builder and the entity
 * removal helpers live here so they are testable and the component stays thin.
 *
 * State shape (owned by ViewerSurface):
 *   { draw: Entity[], measure: Entity[], drawnFeatures, measuredCount,
 *     drawCommands: [{ geojson, style, caption?, entities, drawn }],
 *     measureCommands: [{ mode, points, draw, result, entities }] }
 */

/** Remove the entities of one kind (or everything) and reset the matching counters. */
export function clearAgentOverlays(state, viewer, kind = 'all') {
  const drop = (entities) => {
    if (!viewer) return
    for (const entity of entities) {
      try {
        viewer.entities.remove(entity)
      } catch {
        /* already detached */
      }
    }
  }
  if (kind === 'all' || kind === 'draw') {
    drop(state.draw)
    state.draw = []
    state.drawnFeatures = 0
    state.drawCommands = []
  }
  if (kind === 'all' || kind === 'measure') {
    drop(state.measure)
    state.measure = []
    state.measuredCount = 0
    state.measureCommands = []
  }
}

const commandIds = new WeakMap()
let nextCommandId = 0

function commandId(command) {
  if (!command || typeof command !== 'object') return null
  if (!commandIds.has(command)) commandIds.set(command, `overlay-${++nextCommandId}`)
  return commandIds.get(command)
}

function geojsonFeatureCount(geojson) {
  if (geojson === null || typeof geojson !== 'object') return 0
  if (geojson.type === 'FeatureCollection') return Array.isArray(geojson.features) ? geojson.features.length : 0
  if (geojson.type === 'Feature' || geojson.type === 'GeometryCollection') return 1
  return typeof geojson.type === 'string' ? 1 : 0
}

function measureDetail(command) {
  const result = command?.result ?? {}
  if (command?.mode === 'distance' && Number.isFinite(result.distance_m)) return `${result.distance_m.toFixed(1)} m`
  if (command?.mode === 'area' && Number.isFinite(result.area_m2)) return `${result.area_m2.toFixed(1)} m²`
  if (command?.mode === 'height' && Number.isFinite(result.height_m)) return `${result.height_m.toFixed(2)} m`
  return ''
}

/** Extract metadata for every feature inside one draw command (for L2 overlay browser). */
export function overlayFeatureList(command) {
  const geojson = command?.geojson
  if (!geojson || typeof geojson !== 'object') return []
  const list = geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)
    ? geojson.features
    : geojson.type === 'Feature'
      ? [geojson]
      : []
  const defaultStyle = typeof command?.style === 'string' && command.style !== '' ? command.style : 'accent'
  const items = []
  for (let featureIndex = 0; featureIndex < list.length; featureIndex += 1) {
    const feature = list[featureIndex]
    if (!feature || typeof feature !== 'object') continue
    const props = feature.properties ?? {}
    items.push({
      featureIndex,
      featureId: typeof props.feature_id === 'string' ? props.feature_id : '',
      name: typeof props.name === 'string' && props.name.trim() !== '' ? props.name.trim() : null,
      geometryType: typeof feature.geometry?.type === 'string' ? feature.geometry.type : 'Geometry',
      kind: typeof props.kind === 'string' ? props.kind : null,
      style: typeof props.style === 'string' && props.style !== '' ? props.style : defaultStyle,
    })
  }
  return items
}

/** Per-overlay feature details keyed by draw command index. */
export function buildAgentOverlayDetails(state) {
  const details = {}
  const commands = Array.isArray(state?.drawCommands) ? state.drawCommands : []
  for (let index = 0; index < commands.length; index += 1) {
    details[index] = overlayFeatureList(commands[index])
  }
  return details
}

/** Model-facing/panel-facing rows for the L4 vector overlay list. */
export function buildAgentOverlayList(state) {
  const rows = []
  for (let index = 0; index < state.drawCommands.length; index += 1) {
    const command = state.drawCommands[index]
    const count = geojsonFeatureCount(command?.geojson)
    rows.push({
      id: `draw-${index}`,
      kind: 'draw',
      index,
      label: typeof command?.caption === 'string' && command.caption !== '' ? command.caption : `标注 ${index + 1}`,
      detail: `${count || command?.drawn || 0} 要素`,
    })
  }
  for (let index = 0; index < state.measureCommands.length; index += 1) {
    const command = state.measureCommands[index]
    rows.push({
      id: `measure-${index}`,
      kind: 'measure',
      index,
      label: `量测 ${index + 1}`,
      detail: `${command?.mode ?? 'measure'}${measureDetail(command) === '' ? '' : ` · ${measureDetail(command)}`}`,
    })
  }
  return rows
}

/**
 * Overlay rows plus their Cesium entities (screen-space object marquee). The
 * entityGroups WeakMap is kept inside this module's state; rows are throwaway.
 */
export function overlayRowsWithEntities(state) {
  if (!state) return []
  return buildAgentOverlayList(state).map((row) => {
    const command = row.kind === 'draw' ? state.drawCommands[row.index] : state.measureCommands[row.index]
    const entities = state.entityGroups?.get(command) ?? []
    return { ...row, selectionId: commandId(command), entities, geojson: row.kind === 'draw' ? command?.geojson ?? null : null }
  })
}

export function resolveOverlayRows(selected, current) {
  const ids = new Set((Array.isArray(selected) ? selected : []).map((row) => row?.selectionId).filter(Boolean))
  return (Array.isArray(current) ? current : []).filter((row) => ids.has(row.selectionId))
}

/** The live manual measurement is selectable by the object marquee too. */
export function manualMeasurementRow(entities, label, detail = '') {
  if (!Array.isArray(entities) || entities.length === 0) return null
  return { selectionId: 'manual-measure', kind: 'manual', index: 0, label, detail, entities, geojson: null }
}

/** Merge the GeoJSON of selected draw rows (measures carry no geometry). */
export function mergeDrawGeoJSON(rows) {
  const features = []
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || row.kind !== 'draw' || !row.geojson) continue
    if (row.geojson.type === 'FeatureCollection' && Array.isArray(row.geojson.features)) {
      features.push(...row.geojson.features)
    } else if (row.geojson.type === 'Feature') {
      features.push(row.geojson)
    } else if (typeof row.geojson.type === 'string') {
      features.push({ type: 'Feature', properties: {}, geometry: row.geojson })
    }
  }
  return features.length > 0 ? { type: 'FeatureCollection', features } : null
}

/** Remove several overlay rows at once (descending per kind keeps indexes valid). */
export function removeAgentOverlayRows(state, viewer, rows) {
  const list = resolveOverlayRows(rows, overlayRowsWithEntities(state))
  let removed = 0
  for (const kind of ['draw', 'measure']) {
    const indexes = list
      .filter((row) => row && row.kind === kind && Number.isInteger(row.index))
      .map((row) => row.index)
      .sort((a, b) => b - a)
    for (const index of indexes) {
      if (removeAgentOverlay(state, viewer, kind, index)) removed += 1
    }
  }
  return removed
}

/**
 * Remove one listed row: its entities, its command and its contribution to the
 * counters. Returns false when the row no longer exists.
 */
export function removeAgentOverlay(state, viewer, kind, index) {
  if (kind === 'draw') {
    const command = state.drawCommands[index]
    if (!command) return false
    const entities = state.entityGroups?.get(command) ?? []
    state.drawCommands.splice(index, 1)
    state.entityGroups?.delete(command)
    for (const entity of entities) {
      try {
        viewer?.entities?.remove(entity)
      } catch {
        /* already detached */
      }
      const at = state.draw.indexOf(entity)
      if (at >= 0) state.draw.splice(at, 1)
    }
    state.drawnFeatures = Math.max(0, state.drawnFeatures - (Number.isFinite(command.drawn) ? command.drawn : entities.length))
    return true
  }
  if (kind === 'measure') {
    const command = state.measureCommands[index]
    if (!command) return false
    const entities = state.entityGroups?.get(command) ?? []
    state.measureCommands.splice(index, 1)
    state.entityGroups?.delete(command)
    for (const entity of entities) {
      try {
        viewer?.entities?.remove(entity)
      } catch {
        /* already detached */
      }
      const at = state.measure.indexOf(entity)
      if (at >= 0) state.measure.splice(at, 1)
    }
    const points = Array.isArray(command.points) ? command.points.length : 0
    state.measuredCount = Math.max(0, state.measuredCount - points)
    return true
  }
  return false
}

/** Extract [lon, lat] pairs from a GeoJSON object or coordinate array. */
function collectOverlayLonLat(node) {
  const points = []
  const visit = (value) => {
    if (Array.isArray(value)) {
      if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        if (Number.isFinite(value[0]) && Number.isFinite(value[1])) points.push([value[0], value[1]])
        return
      }
      for (const item of value) visit(item)
      return
    }
    if (value && typeof value === 'object') {
      if (Array.isArray(value.features)) for (const item of value.features) visit(item)
      else if (Array.isArray(value.geometries)) for (const item of value.geometries) visit(item)
      else if (value.geometry) visit(value.geometry)
      else if (value.coordinates !== undefined) visit(value.coordinates)
    }
  }
  visit(node)
  return points
}

/** Fly the camera to a {west, south, east, north} bounding box. */
export function flyToBbox(viewer, Cesium, bbox) {
  const camera = viewer?.camera
  if (!camera || !Cesium || !bbox) return false
  const { west, south, east, north } = bbox
  if (![west, south, east, north].every(Number.isFinite)) return false
  const spanLon = Math.max(0, east - west)
  const spanLat = Math.max(0, north - south)
  if ((spanLon > 1e-5 || spanLat > 1e-5) && typeof Cesium.Rectangle?.fromDegrees === 'function') {
    const padLon = Math.max(spanLon * 0.18, 0.0008)
    const padLat = Math.max(spanLat * 0.18, 0.0008)
    camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        Math.max(-180, west - padLon),
        Math.max(-90, south - padLat),
        Math.min(180, east + padLon),
        Math.min(90, north + padLat),
      ),
      duration: 1.0,
    })
    return true
  }
  const lon = (west + east) / 2
  const lat = (south + north) / 2
  const approxMeters = Math.max(spanLon, spanLat) * 111_000
  const height = Math.max(800, Math.min(2_500_000, approxMeters > 0 ? approxMeters * 2.4 : 1200))
  camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
    duration: 1.0,
  })
  return true
}

function bboxOfNode(node) {
  const points = collectOverlayLonLat(node)
  if (points.length === 0) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [lon, lat] of points) {
    if (lon < west) west = lon
    if (lon > east) east = lon
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return { west, south, east, north }
}

/** Fly the camera to one vector overlay row (draw or measure command). */
export function flyToAgentOverlay(state, viewer, Cesium, kind, index) {
  if (!state || !viewer || !Cesium) return false
  const command = kind === 'draw' ? state.drawCommands?.[index] : kind === 'measure' ? state.measureCommands?.[index] : null
  if (!command) return false
  const bbox = bboxOfNode(kind === 'draw' ? command.geojson : command.points)
  return bbox ? flyToBbox(viewer, Cesium, bbox) : false
}

/** Fly the camera to one GeoJSON feature inside an overlay. */
export function flyToOverlayFeature(viewer, Cesium, feature) {
  if (!viewer || !Cesium || !feature) return false
  const bbox = bboxOfNode(feature)
  return bbox ? flyToBbox(viewer, Cesium, bbox) : false
}
