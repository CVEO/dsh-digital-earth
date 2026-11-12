/**
 * scene/annotation-actions.js — edit/delete/export one drawn annotation feature.
 *
 * The viewer owns the draw commands, the card owns the draft text and this
 * module owns the flow: patch the feature, replay the command, refresh counts,
 * close the card and tell the user. Kept out of ViewerSurface so the component
 * stays under its size budget.
 */
import { downloadText } from '../ui/cards.js'
import { annotationFeatureText, deleteAnnotationFeature, findFeatureInState, rebuildDrawCommand, updateAnnotationFeature } from './annotation-edit.js'
import { annotationFeaturesOfCommands, annotationKindOf, nextAnnotationName, normalizeAnnotation, withAnnotationGeometry } from './annotation-model.js'

export function createAnnotationActions({ stateRef, viewerRef, getSelection, draw, showToast, t, onChanged }) {
  const selectionOf = () => (typeof getSelection === 'function' ? getSelection() : null)

  // Replay a draw command after a feature changed. drawAgentOverlay appends the
  // new command, so the last entry in drawCommands is the live one.
  const replay = (geojson, style, caption) => {
    draw(geojson, style, caption)
    const commands = stateRef.current.drawCommands
    return commands[commands.length - 1] ?? null
  }

  const finish = (result, messageKey) => {
    if (!result?.ok) {
      showToast(t('annotation.editFailed', { reason: result?.error ?? 'unknown' }))
      return false
    }
    if (typeof onChanged === 'function') onChanged()
    showToast(t(messageKey))
    return true
  }

  const run = (mutate, messageKey) => finish(
    mutate(stateRef.current, viewerRef.current, selectionOf(), replay),
    messageKey,
  )

  return {
    /** Draw one new hand-drawn feature, auto-named so it is never anonymous. */
    add: (feature) => {
      const state = stateRef.current
      const name = nextAnnotationName(annotationFeaturesOfCommands(state.drawCommands), annotationKindOf(feature), t)
      const normalized = normalizeAnnotation({ ...feature, properties: { ...feature.properties, name } })
      if (!normalized.ok) {
        showToast(t('annotation.editFailed', { reason: normalized.error }))
        return false
      }
      draw({ type: 'FeatureCollection', features: [normalized.feature] }, 'accent', name)
      if (typeof onChanged === 'function') onChanged()
      showToast(t('annotation.added', { name }))
      return true
    },
    /**
     * Replace the geometry of the feature called {name, kind}. Vertex drags use
     * this instead of the selection because every replay replaces the command,
     * and the card closes after a save — the name is the stable handle.
     */
    geometry: (target, messageKey = 'annotation.shapeSaved') => {
      const found = findFeatureInState(stateRef.current, target?.name, target?.kind)
      if (!found) {
        showToast(t('annotation.editFailed', { reason: 'feature_not_found' }))
        return false
      }
      const patched = withAnnotationGeometry(found.feature, target?.geometry)
      if (!patched.ok) {
        showToast(t('annotation.editFailed', { reason: patched.error }))
        return false
      }
      const features = found.command.geojson.features.slice()
      features[found.index] = patched.feature
      return finish(
        rebuildDrawCommand(stateRef.current, viewerRef.current, found.command, features, replay),
        messageKey,
      )
    },
    update: (patch) => run(
      (state, viewer, selection, replayCommand) => updateAnnotationFeature(state, viewer, selection, patch, replayCommand),
      'annotation.saved',
    ),
    remove: () => run(
      (state, viewer, selection, replayCommand) => deleteAnnotationFeature(state, viewer, selection, replayCommand),
      'annotation.deleted',
    ),
    export: () => {
      const feature = selectionOf()?.feature
      if (!feature) return false
      const name = String(feature.properties?.name ?? 'annotation').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60) || 'annotation'
      downloadText(`${name}.geojson`, annotationFeatureText(feature, name), 'application/geo+json')
      showToast(t('annotation.exported', { name: `${name}.geojson` }))
      return true
    },
  }
}
