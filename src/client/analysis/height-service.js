/**
 * analysis/height-service.js — the single elevation sampler for analyses.
 *
 * Before v1.6 every analysis called `analysisElevation` directly, which had two
 * problems:
 *   - the value could come from the 3D Tiles surface (which is roofs/foliage, not
 *     ground) or from terrain, and the result never said which;
 *   - `tileset.getHeight` only looks at the *currently selected* tiles, so the
 *     same profile could report different heights after the camera moved.
 *
 * This service makes the source explicit and mode-driven:
 *   - `surface` (default): 3D Tiles first, terrain as the fallback;
 *   - `ground`: terrain ONLY — a flood analysis that needs bare ground must not
 *     silently use roofs;
 * every sample carries `source: 'tiles' | 'terrain' | 'none'`, and a run reports
 * its dominant source plus human-readable warnings that the panel forwards to
 * the Agent instead of hiding the caveat.
 *
 * It also de-duplicates probes through a small cache (profile/flood grids repeat
 * cartographic positions far more often than expected) and enforces a sample
 * budget so a future viewshed cannot freeze the panel.
 */

/** Resolution used when caching a probe (metres): far below any real terrain grid. */
const CACHE_DEGREES = 1e-7

/** Default upper bound for one analysis run; sampled positions past it are skipped. */
export const DEFAULT_SAMPLE_BUDGET = 600

export const HEIGHT_SOURCES = ['tiles', 'terrain', 'none']

function isThenable(value) {
  return value !== null && typeof value === 'object' && typeof value.then === 'function'
}

/**
 * @param {object} options
 * @param {object} options.Cesium vendored Cesium namespace
 * @param {object} options.viewer Cesium.Viewer (or a fake in tests)
 * @param {object|null} [options.layer] the 3D Tiles layer the analysis targets
 */
export function createHeightService({ Cesium, viewer, layer = null } = {}) {
  const cache = new Map()
  const warnings = new Set()
  const counts = { tiles: 0, terrain: 0, none: 0 }

  const terrainProvider = () => {
    try {
      return viewer?.scene?.globe?.terrainProvider ?? null
    } catch {
      return null
    }
  }

  const hasRealTerrain = () => {
    const provider = terrainProvider()
    if (!provider) return false
    const Ellipsoid = Cesium?.EllipsoidTerrainProvider
    if (typeof Ellipsoid === 'function' && provider instanceof Ellipsoid) return false
    return true
  }

  const targetTileset = () => {
    if (!layer || layer.visible === false) return null
    const tileset = layer.tileset
    return tileset && typeof tileset.getHeight === 'function' ? tileset : null
  }

  const cacheKey = (carto, mode) =>
    `${mode}|${Math.round(carto.longitude / CACHE_DEGREES)}|${Math.round(carto.latitude / CACHE_DEGREES)}`

  async function fromTiles(carto) {
    const tileset = targetTileset()
    if (!tileset) return null
    try {
      const raw = tileset.getHeight(carto, viewer.scene)
      const value = isThenable(raw) ? await raw : raw
      if (typeof value === 'number' && Number.isFinite(value)) return value
    } catch {
      /* a tileset without pick support simply has no surface height */
    }
    return null
  }

  function fromTerrain(carto) {
    if (!hasRealTerrain()) return null
    try {
      const value = viewer.scene.globe.getHeight(carto)
      if (typeof value === 'number' && Number.isFinite(value)) return value
    } catch {
      /* not sampled yet (tile not loaded) -> no value, never a fake zero */
    }
    return null
  }

  /**
   * Sample one position. Returns `{ height, source }` or null when the chosen
   * source has no value. v1.5.2 uses exactly one source per run:
   *   - `tiles`   only `3D Tiles getHeight` (never falls back to terrain);
   *   - `terrain` only the terrain provider (never reads roofs).
   */
  async function sample(carto, { mode = 'tiles' } = {}) {
    if (!carto) return null
    const heightMode = mode === 'terrain' ? 'terrain' : 'tiles'
    const key = cacheKey(carto, heightMode)
    if (cache.has(key)) return cache.get(key)

    let result = null
    if (heightMode === 'terrain') {
      const terrain = fromTerrain(carto)
      if (terrain !== null) result = { height: terrain, source: 'terrain' }
      else warnings.add('terrain_height_unavailable')
    } else {
      const tiles = await fromTiles(carto)
      if (tiles !== null) {
        result = { height: tiles, source: 'tiles' }
        warnings.add('surface_height_from_tiles')
      } else {
        warnings.add('tiles_height_unavailable')
      }
    }
    counts[result ? result.source : 'none'] += 1
    cache.set(key, result)
    return result
  }

  /**
   * Sample many positions sequentially (Cesium tileset.getHeight is synchronous
   * but terrain pick can be async) with a hard budget. Returns the values in
   * input order plus the run's single source and warnings.
   */
  async function sampleMany(cartos, { mode = 'tiles', budget = DEFAULT_SAMPLE_BUDGET } = {}) {
    const list = Array.isArray(cartos) ? cartos : []
    const values = []
    for (let index = 0; index < list.length; index += 1) {
      if (index >= budget) break
      values.push(await sample(list[index], { mode }))
    }
    if (list.length > budget) warnings.add('sample_budget_truncated')
    return { values, ...report() }
  }

  /** Source/warning summary for the result object the tool returns. */
  function report() {
    const source = counts.tiles >= counts.terrain && counts.tiles > 0 ? 'tiles' : counts.terrain > 0 ? 'terrain' : 'none'
    return {
      height_source: source,
      height_sources: { ...counts },
      warnings: [...warnings],
    }
  }

  return {
    sample,
    sampleMany,
    report,
    /** Whether a real (non-ellipsoid) terrain provider is installed. */
    hasRealTerrain,
    /** Test seam: drop the probe cache (a new run re-samples). */
    reset() {
      cache.clear()
      warnings.clear()
      counts.tiles = 0
      counts.terrain = 0
      counts.none = 0
    },
  }
}
