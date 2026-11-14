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
export const DEFAULT_SAMPLE_BUDGET = 800

/** Parallel Cesium GPU pick batch size so profiles stay responsive without stalling frames. */
const TILES_BATCH_SIZE = 32
const PROBE_TIMEOUT_MS = 8000

export const HEIGHT_SOURCES = ['tiles', 'terrain', 'none']

function isThenable(value) {
  return value !== null && typeof value === 'object' && typeof value.then === 'function'
}

function withTimeout(promise, ms = PROBE_TIMEOUT_MS) {
  if (!isThenable(promise)) return Promise.resolve(promise)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('height probe timed out')), ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function isTilesetHit(object, tileset) {
  if (!object || !tileset) return false
  return (
    object === tileset ||
    object.primitive === tileset ||
    object.tileset === tileset ||
    object.content?.tileset === tileset ||
    object.primitive?.tileset === tileset
  )
}

function collectExcludedPrimitives(scene, tileset) {
  const excluded = []
  const walk = (collection) => {
    const length = collection?.length
    if (typeof length !== 'number' || typeof collection?.get !== 'function') return
    for (let index = 0; index < length; index += 1) {
      const item = collection.get(index)
      if (!item || item === tileset) continue
      if (typeof item.get === 'function' && typeof item.length === 'number') walk(item)
      else excluded.push(item)
    }
  }
  walk(scene?.primitives)
  return excluded
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
    if (!layer || layer.visible === false || !layer.tileset) return null
    const tileset = layer.tileset
    return typeof tileset.getHeight === 'function' ||
      (viewer?.scene?.sampleHeightSupported !== false && typeof viewer?.scene?.pickFromRayMostDetailed === 'function')
      ? tileset
      : null
  }

  const cacheKey = (carto, mode) =>
    `${mode}|${Math.round(carto.longitude / CACHE_DEGREES)}|${Math.round(carto.latitude / CACHE_DEGREES)}`

  const skyRayForCarto = (carto) => {
    const scene = viewer?.scene
    if (!scene || typeof Cesium?.Ray !== 'function' || typeof Cesium?.Cartesian3?.fromRadians !== 'function') return null
    const ellipsoid = scene.globe?.ellipsoid || Cesium.Ellipsoid?.WGS84
    if (!ellipsoid || typeof ellipsoid.geodeticSurfaceNormalCartographic !== 'function') return null
    let topHeight = 9000
    try {
      const globeHeight = typeof scene.globe?.getHeight === 'function' ? scene.globe.getHeight(carto) : null
      if (typeof globeHeight === 'number' && Number.isFinite(globeHeight)) {
        topHeight = Math.max(9000, globeHeight + 2000)
      }
    } catch {
      /* fall back to standard _defaultMaxTerrainHeight ceiling */
    }
    const origin = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, topHeight, ellipsoid)
    const up = ellipsoid.geodeticSurfaceNormalCartographic(carto)
    if (!origin || !up) return null
    const direction = typeof Cesium.Cartesian3?.negate === 'function'
      ? Cesium.Cartesian3.negate(up, new Cesium.Cartesian3())
      : new Cesium.Cartesian3(-up.x, -up.y, -up.z)
    return new Cesium.Ray(origin, direction)
  }

  const heightFromCartesian = (position) => {
    if (!position) return null
    const ellipsoid = viewer?.scene?.globe?.ellipsoid || Cesium?.Ellipsoid?.WGS84
    const carto = typeof ellipsoid?.cartesianToCartographic === 'function'
      ? ellipsoid.cartesianToCartographic(position)
      : typeof Cesium?.Cartographic?.fromCartesian === 'function'
        ? Cesium.Cartographic.fromCartesian(position)
        : null
    const height = carto?.height
    return typeof height === 'number' && Number.isFinite(height) ? height : null
  }

  async function fromTilesMostDetailed(carto, tileset, exclude) {
    const scene = viewer?.scene
    if (!scene || scene.sampleHeightSupported === false || typeof scene.pickFromRayMostDetailed !== 'function') {
      return null
    }
    const ray = skyRayForCarto(carto)
    if (!ray) return null
    try {
      const hit = await withTimeout(scene.pickFromRayMostDetailed(ray, exclude))
      if (hit && isTilesetHit(hit.object, tileset)) {
        const height = heightFromCartesian(hit.position)
        if (height !== null) return height
      }
      // If terrain globe occluded a lower 3D Tiles surface, re-pick once offscreen with globe hidden.
      const globe = scene.globe
      if (globe?.show && typeof scene.pickFromRay === 'function') {
        const prevShow = globe.show
        globe.show = false
        try {
          const underHit = scene.pickFromRay(ray, exclude)
          if (underHit && isTilesetHit(underHit.object, tileset)) {
            const height = heightFromCartesian(underHit.position)
            if (height !== null) return height
          }
        } finally {
          globe.show = prevShow
        }
      }
    } catch {
      /* fall back to tileset.getHeight below */
    }
    return null
  }

  async function fromTiles(carto, exclude = null) {
    const tileset = targetTileset()
    if (!tileset) return null
    const excluded = exclude ?? collectExcludedPrimitives(viewer?.scene, tileset)
    const detailed = await fromTilesMostDetailed(carto, tileset, excluded)
    if (detailed !== null) return detailed
    if (typeof tileset.getHeight !== 'function') return null
    try {
      const raw = tileset.getHeight(carto, viewer?.scene)
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

  async function probeBatch(pending, heightMode) {
    const resolved = new Map()
    if (pending.length === 0) return resolved
    if (heightMode === 'terrain') {
      if (!hasRealTerrain()) {
        for (const item of pending) resolved.set(item.key, null)
        return resolved
      }
      const provider = terrainProvider()
      let detailed = null
      if (typeof Cesium?.sampleTerrainMostDetailed === 'function' && typeof Cesium?.Cartographic === 'function') {
        try {
          const copies = pending.map((item) => new Cesium.Cartographic(item.carto.longitude, item.carto.latitude, 0))
          await withTimeout(Cesium.sampleTerrainMostDetailed(provider, copies))
          detailed = copies
        } catch {
          detailed = null
        }
      }
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index]
        const sampledHeight = detailed?.[index]?.height
        const height =
          typeof sampledHeight === 'number' && Number.isFinite(sampledHeight)
            ? sampledHeight
            : fromTerrain(item.carto)
        resolved.set(item.key, height !== null ? { height, source: 'terrain' } : null)
      }
      return resolved
    }

    const tileset = targetTileset()
    if (!tileset) {
      for (const item of pending) resolved.set(item.key, null)
      return resolved
    }
    const exclude = collectExcludedPrimitives(viewer?.scene, tileset)
    for (let offset = 0; offset < pending.length; offset += TILES_BATCH_SIZE) {
      const chunk = pending.slice(offset, offset + TILES_BATCH_SIZE)
      await Promise.all(
        chunk.map(async (item) => {
          const height = await fromTiles(item.carto, exclude)
          resolved.set(item.key, height !== null ? { height, source: 'tiles' } : null)
        }),
      )
    }
    return resolved
  }

  function commitProbeResult(key, result, heightMode) {
    if (result) {
      if (result.source === 'tiles') warnings.add('surface_height_from_tiles')
    } else {
      warnings.add(heightMode === 'terrain' ? 'terrain_height_unavailable' : 'tiles_height_unavailable')
    }
    counts[result ? result.source : 'none'] += 1
    cache.set(key, result)
    return result
  }

  /**
   * Sample one position. Returns `{ height, source }` or null when the chosen
   * source has no value. Uses one source per run:
   *   - `tiles`   3D Tiles surface only (most-detailed ray pick + `tileset.getHeight` fallback);
   *   - `terrain` terrain provider only (`sampleTerrainMostDetailed` + `globe.getHeight` fallback).
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
   * Sample many positions in parallel GPU pick batches (`tiles`) or via
   * `sampleTerrainMostDetailed` (`terrain`) with deduplication and a hard budget.
   */
  async function sampleMany(cartos, { mode = 'tiles', budget = DEFAULT_SAMPLE_BUDGET } = {}) {
    const list = Array.isArray(cartos) ? cartos : []
    const heightMode = mode === 'terrain' ? 'terrain' : 'tiles'
    const limit = Math.min(list.length, budget)
    const slots = new Array(limit)
    const pending = []
    const pendingKeys = new Set()

    for (let index = 0; index < limit; index += 1) {
      const carto = list[index]
      if (!carto) {
        slots[index] = { kind: 'empty' }
        continue
      }
      const key = cacheKey(carto, heightMode)
      if (cache.has(key)) {
        slots[index] = { kind: 'cached', result: cache.get(key) }
      } else {
        slots[index] = { kind: 'pending', key }
        if (!pendingKeys.has(key)) {
          pendingKeys.add(key)
          pending.push({ key, carto })
        }
      }
    }

    const resolved = await probeBatch(pending, heightMode)
    const values = new Array(limit)
    for (let index = 0; index < limit; index += 1) {
      const slot = slots[index]
      if (slot.kind === 'empty') {
        values[index] = null
      } else if (slot.kind === 'cached') {
        values[index] = slot.result
      } else if (cache.has(slot.key)) {
        values[index] = cache.get(slot.key)
      } else {
        values[index] = commitProbeResult(slot.key, resolved.get(slot.key) ?? null, heightMode)
      }
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
