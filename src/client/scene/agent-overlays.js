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
    return { ...row, entities, geojson: row.kind === 'draw' ? command?.geojson ?? null : null }
  })
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
  const list = Array.isArray(rows) ? rows : []
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
