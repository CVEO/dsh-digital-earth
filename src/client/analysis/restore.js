/**
 * analysis/restore.js — undo what a sunlight or clip analysis changed.
 *
 * Extracted from analysis/engine.js (which has a 700-line budget): the engine
 * decides analysis results, while this module owns the scene-state snapshot
 * replay. It only touches viewer settings the analysis saved beforehand.
 */
import { CLIP_OWNER_ANALYSIS, releaseClipCollection } from '../scene/clip-collections.js'

/**
 * Replay one saved scene snapshot (`restore`) against the live viewer.
 * Best-effort: the viewer may be mid-teardown when a panel unmounts.
 */
export function applyAnalysisRestore(viewer, layers, restore) {
  if (!viewer || !restore) return
  try {
    if (typeof restore.enableLighting === 'boolean') viewer.scene.globe.enableLighting = restore.enableLighting
    if (typeof restore.shadowMapEnabled === 'boolean') viewer.scene.shadowMap.enabled = restore.shadowMapEnabled
    if (typeof restore.shouldAnimate === 'boolean') viewer.clock.shouldAnimate = restore.shouldAnimate
    if (restore.currentTime) viewer.clock.currentTime = restore.currentTime
    for (const saved of restore.tilesets ?? []) {
      const layer = layers.find((item) => item.id === saved.id)
      if (layer && layer.tileset) layer.tileset.shadows = saved.shadows
    }
    // clip: disable the shared collection instead of unassigning it — the Cesium
    // setter destroys the clipping texture a tile draw command may still use.
    if (restore.clipping) {
      const target = restore.clipping.layer
      if (target && target.tileset) releaseClipCollection(target.tileset, CLIP_OWNER_ANALYSIS)
    }
  } catch {
    /* the viewer may be mid-teardown; state restoration is best-effort */
  }
}
