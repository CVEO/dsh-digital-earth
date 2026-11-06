/**
 * scene/quality.js — the render-quality tiers of the panel.
 *
 * The panel lives beside a chat window and runs on the user's GPU, so "smooth"
 * and "beautiful" are a real trade-off: a photogrammetry layer plus streaming
 * terrain can miss the 16.7 ms vsync, which Chromium shows as a drop from 60 to
 * 30 FPS. These tiers bundle the knobs that move that boundary, so the user can
 * switch instead of guessing which of five settings matter.
 *
 * `resolutionScale` / `globe.maximumScreenSpaceError` / `globe.tileCacheSize` /
 * `tileset.maximumScreenSpaceError` are applied live; `msaaSamples` is a
 * context-creation option, so it only takes effect the next time the panel
 * mounts (documented in the settings hint).
 */

/** Valid tier names, in the order the settings control lists them. */
export const QUALITY_MODES = ['balanced', 'high']

/** Tier used when the catalog has no (or an unknown) quality value. */
export const DEFAULT_QUALITY = 'balanced'

const PROFILES = {
  /**
   * Balanced (default): ~28 % fewer pixels, coarser terrain/photogrammetry LOD.
   * The visual difference is mostly at silhouettes; motion stays smooth.
   */
  balanced: {
    resolutionScale: 0.85,
    msaaSamples: 2,
    globeMaximumScreenSpaceError: 3,
    globeTileCacheSize: 200,
    tilesetMaximumScreenSpaceError: 20,
  },
  /** High: full resolution at the Cesium defaults, for screenshots and reviews. */
  high: {
    resolutionScale: 1,
    msaaSamples: 4,
    globeMaximumScreenSpaceError: 2,
    globeTileCacheSize: 100,
    tilesetMaximumScreenSpaceError: 16,
  },
}

/** Coerce anything the catalog may hold into a known tier. */
export function normalizeQuality(value) {
  return QUALITY_MODES.includes(value) ? value : DEFAULT_QUALITY
}

/** The knob values of one tier (a copy, so callers cannot mutate the table). */
export function qualityProfile(value) {
  return { ...PROFILES[normalizeQuality(value)] }
}

/**
 * Apply a tier to a live viewer.
 *
 * `tilesets` lets the caller pass the currently loaded 3D Tiles so their LOD is
 * switched too; new tilesets should be created with the profile's
 * `tilesetMaximumScreenSpaceError` (see the load path).
 */
export function applyQuality(viewer, value, tilesets = []) {
  if (!viewer) return qualityProfile(value)
  const profile = qualityProfile(value)
  viewer.resolutionScale = profile.resolutionScale
  const globe = viewer.scene?.globe
  if (globe) {
    globe.maximumScreenSpaceError = profile.globeMaximumScreenSpaceError
    globe.tileCacheSize = profile.globeTileCacheSize
  }
  for (const tileset of tilesets) {
    if (tileset) tileset.maximumScreenSpaceError = profile.tilesetMaximumScreenSpaceError
  }
  return profile
}
