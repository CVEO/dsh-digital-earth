/**
 * scene/annotation-edit.js — rewrite one drawn feature in place (F2).
 *
 * Vector layers are stored as draw commands (one command per earth_draw call or
 * file import), and Cesium entities are created from that command. Renaming or
 * deleting a single feature therefore means: copy the command's GeoJSON, patch
 * one feature, remove the old entities and replay the command.
 *
 * The replay callback is injected because drawAgentOverlay lives in the viewer
 * component; this module owns the bookkeeping (which command, which feature) and
 * the safety rules, not the Cesium details.
 */
import { removeAgentOverlay } from './agent-overlays.js'
import { withAnnotationProperties } from './annotation-model.js'

/** Find a feature inside a command, by identity first and by content after a rebuild. */
export function locateFeature(command, feature) {
  const list = command?.geojson?.features
  if (!Array.isArray(list) || feature === null || typeof feature !== 'object') return -1
  const identity = list.indexOf(feature)
  if (identity >= 0) return identity
  const name = feature.properties?.name ?? null
  const kind = feature.properties?.kind ?? null
  const geometry = JSON.stringify(feature.geometry ?? null)
  return list.findIndex((item) => {
    if (item === null || typeof item !== 'object') return false
    if ((item.properties?.name ?? null) !== name) return false
    if ((item.properties?.kind ?? null) !== kind) return false
    return JSON.stringify(item.geometry ?? null) === geometry
  })
}

/**
 * Replace one command's features. An empty list removes the command entirely.
 * Returns {ok:true, command} with the replayed command (or null when removed).
 */
export function rebuildDrawCommand(state, viewer, command, features, replay) {
  if (!state || !Array.isArray(state.drawCommands)) return { ok: false, error: 'invalid_state' }
  const index = state.drawCommands.indexOf(command)
  if (index < 0) return { ok: false, error: 'command_not_found' }
  const list = Array.isArray(features) ? features : []
  if (list.length === 0) {
    removeAgentOverlay(state, viewer, 'draw', index)
    return { ok: true, command: null }
  }
  const nextGeojson = { ...command.geojson, features: list }
  // Replay after removal so entity groups and the command list stay in sync.
  removeAgentOverlay(state, viewer, 'draw', index)
  const next = typeof replay === 'function' ? replay(nextGeojson, command.style, command.caption) : null
  if (!next) return { ok: false, error: 'replay_failed' }
  return { ok: true, command: next }
}

/** Rename / annotate / reclassify one feature; geometry is untouched. */
export function updateAnnotationFeature(state, viewer, selection, patch, replay) {
  const command = selection?.command
  const feature = selection?.feature
  if (!command || !feature) return { ok: false, error: 'no_annotation' }
  const index = locateFeature(command, feature)
  if (index < 0) return { ok: false, error: 'feature_not_found' }
  const patched = withAnnotationProperties(feature, patch)
  if (!patched.ok) return patched
  const features = command.geojson.features.slice()
  features[index] = patched.feature
  return rebuildDrawCommand(state, viewer, command, features, replay)
}

/** Delete one feature; deleting the last feature deletes the whole command. */
export function deleteAnnotationFeature(state, viewer, selection, replay) {
  const command = selection?.command
  const feature = selection?.feature
  if (!command || !feature) return { ok: false, error: 'no_annotation' }
  const index = locateFeature(command, feature)
  if (index < 0) return { ok: false, error: 'feature_not_found' }
  const features = command.geojson.features
    .slice(0, index)
    .concat(command.geojson.features.slice(index + 1))
  return rebuildDrawCommand(state, viewer, command, features, replay)
}

/** GeoJSON text of one feature, rounded by the model before writing. */
export function annotationFeatureText(feature, name = 'annotation') {
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name,
      features: [feature],
    },
    null,
    2,
  )
}
