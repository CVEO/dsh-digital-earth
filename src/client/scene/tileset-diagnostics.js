/**
 * scene/tileset-diagnostics.js — per-tileset research diagnostics & load options.
 *
 * Manages runtime inspection controls for 3D Tiles layers (wireframe topology,
 * LOD tile colorization, bounding volumes, per-layer SSE overrides) and reads
 * Cesium3DTileset.statistics snapshots cleanly.
 *
 * CesiumJS 1.147.0 note:
 *   Passing `enableDebugWireframe: true` at tileset construction enables
 *   `tileset.debugWireframe` without warning; on WebGL 2, GltfLoader does NOT
 *   retain extra CPU index arrays (`&& !context.webgl2`), so initial load has
 *   zero extra RAM/VRAM cost until wireframe is actively toggled on.
 *   3DGS layers (`layer.kind === '3dgs'`) have no triangle mesh, so wireframe
 *   is explicitly rejected with `reason: 'unsupported_3dgs'`.
 */

export const SSE_MIN = 0.25
export const SSE_MAX = 128

export const DEFAULT_DIAGNOSTICS = Object.freeze({
  wireframe: false,
  clay: false,
  colorizeTiles: false,
  boundingVolume: false,
})

/**
 * Studio clay shader using screen-space geometric face normals (`dFdx`/`dFdy`
 * on `positionEC`), so it works on 100% of 3D Tiles meshes — including
 * `KHR_materials_unlit` photogrammetry tiles without vertex normals — and
 * reveals true triangle facets, creases, warps, and floating artifacts.
 */
export const CLAY_FRAGMENT_SHADER = `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  vec3 posEC = fsInput.attributes.positionEC;
  vec3 rawN = cross(dFdx(posEC), dFdy(posEC));
  float nLen = length(rawN);
  vec3 nEC = nLen > 1e-6 ? rawN / nLen : vec3(0.0, 0.0, 1.0);
  vec3 viewDir = normalize(-posEC);
  if (dot(nEC, viewDir) < 0.0) nEC = -nEC;
  float key = max(dot(nEC, normalize(vec3(0.45, 0.72, 0.53))), 0.0);
  float fill = max(dot(nEC, normalize(vec3(-0.62, 0.24, 0.75))), 0.0);
  float hemi = 0.5 + 0.5 * nEC.y;
  float rim = pow(1.0 - max(dot(nEC, viewDir), 0.0), 2.4);
  float crease = clamp(length(fwidth(nEC)) * 0.42, 0.0, 0.28);
  float shade = clamp(0.18 + 0.62 * key + 0.18 * fill + 0.14 * hemi, 0.0, 1.0);
  vec3 clay = mix(vec3(0.42, 0.46, 0.53), vec3(0.92, 0.90, 0.87), shade);
  clay = clay * (1.0 - crease) + vec3(0.12, 0.14, 0.17) * rim;
  material.diffuse = clamp(clay, 0.0, 1.0);
  material.alpha = 1.0;
}`

/** tileset -> baseline snapshot recorded before first diagnostic mutation */
const baselineByTileset = new WeakMap()
const pausedBoundsByTileset = new WeakMap()
/** tileset -> { shader, previous } while Clay inspection mode owns customShader */
const clayStateByTileset = new WeakMap()

function isClayActive(tileset) {
  const entry = clayStateByTileset.get(tileset)
  return Boolean(entry && tileset?.customShader === entry.shader)
}

function createClayCustomShader(Cesium) {
  if (!Cesium || typeof Cesium.CustomShader !== 'function') return null
  return new Cesium.CustomShader({
    mode: Cesium.CustomShaderMode?.REPLACE_MATERIAL,
    lightingModel: Cesium.LightingModel?.UNLIT,
    fragmentShaderText: CLAY_FRAGMENT_SHADER,
  })
}

function setClayMode(tileset, enabled, Cesium) {
  if (enabled) {
    if (isClayActive(tileset)) return true
    const shader = createClayCustomShader(Cesium)
    if (!shader) return false
    const previous = tileset.customShader
    clayStateByTileset.set(tileset, { shader, previous })
    tileset.customShader = shader
    return true
  }
  const entry = clayStateByTileset.get(tileset)
  clayStateByTileset.delete(tileset)
  if (entry && tileset.customShader === entry.shader) {
    tileset.customShader = entry.previous ?? undefined
  }
  return true
}

function setBoundingVolume(tileset, enabled) {
  const paused = pausedBoundsByTileset.get(tileset)
  if (paused) paused.enabled = enabled
  else tileset.debugShowBoundingVolume = enabled
}

export function pauseTileBounds(tileset) {
  let paused = pausedBoundsByTileset.get(tileset)
  if (!paused) {
    paused = { enabled: Boolean(tileset.debugShowBoundingVolume), count: 0 }
    tileset.debugShowBoundingVolume = false
    pausedBoundsByTileset.set(tileset, paused)
  }
  paused.count += 1
  let released = false
  return () => {
    if (released) return
    released = true
    paused.count -= 1
    if (paused.count > 0) return
    pausedBoundsByTileset.delete(tileset)
    if (!tileset.isDestroyed?.()) tileset.debugShowBoundingVolume = paused.enabled
  }
}

const finiteNonNeg = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0)

/** Clamp maximumScreenSpaceError to a safe interactive range. */
export function clampSse(value, fallback = 16) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.round(Math.min(SSE_MAX, Math.max(SSE_MIN, num)) * 100) / 100
}

/**
 * Build Cesium3DTileset.fromUrl options from a base options object.
 * Centralizes `enableDebugWireframe` so direct and proxied loads stay identical.
 */
export function buildTilesetLoadOptions(base = {}, { enableDebugWireframe = true } = {}) {
  const options = base && typeof base === 'object' ? { ...base } : {}
  options.enableDebugWireframe = Boolean(enableDebugWireframe)
  return options
}

/** True when the layer is backed by a live non-3DGS tileset that can render triangle wireframes. */
export function supportsWireframe(layer) {
  const tileset = layer?.tileset
  if (!tileset || typeof tileset !== 'object') return false
  if (typeof tileset.isDestroyed === 'function' && tileset.isDestroyed()) return false
  return layer.kind !== '3dgs'
}

/** Format byte sizes for diagnostics readouts and metadata summaries. */
export function formatDiagnosticBytes(bytes) {
  const value = finiteNonNeg(bytes)
  if (value < 1024) return `${Math.round(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Read live Cesium3DTilesetStatistics into a plain serializable object. */
export function readTilesetStatistics(tileset) {
  if (!tileset || typeof tileset !== 'object') {
    return {
      selectedTiles: 0,
      visitedTiles: 0,
      loadedTiles: 0,
      pendingRequests: 0,
      triangles: 0,
      points: 0,
      geometryBytes: 0,
      texturesBytes: 0,
      batchTableBytes: 0,
      totalMemoryBytes: 0,
    }
  }
  const s = tileset.statistics ?? {}
  const geometryBytes = finiteNonNeg(s.geometryByteLength)
  const texturesBytes = finiteNonNeg(s.texturesByteLength)
  const batchTableBytes = finiteNonNeg(s.batchTableByteLength)
  const totalMemoryBytes =
    finiteNonNeg(tileset.cacheBytes) ||
    finiteNonNeg(tileset.totalMemoryUsageInBytes) ||
    geometryBytes + texturesBytes + batchTableBytes
  return {
    selectedTiles: finiteNonNeg(s.selected),
    visitedTiles: finiteNonNeg(s.visited),
    loadedTiles: finiteNonNeg(s.numberOfTilesWithContentReady ?? s.numberOfTilesLoaded),
    pendingRequests: finiteNonNeg(s.numberOfPendingRequests),
    triangles: finiteNonNeg(s.numberOfTrianglesSelected),
    points: finiteNonNeg(s.numberOfPointsSelected),
    geometryBytes,
    texturesBytes,
    batchTableBytes,
    totalMemoryBytes,
  }
}

function ensureBaseline(tileset) {
  let baseline = baselineByTileset.get(tileset)
  if (!baseline) {
    baseline = {
      wireframe: Boolean(tileset.debugWireframe),
      clay: isClayActive(tileset),
      colorizeTiles: Boolean(tileset.debugColorizeTiles),
      boundingVolume: pausedBoundsByTileset.get(tileset)?.enabled ?? Boolean(tileset.debugShowBoundingVolume),
      sse: clampSse(tileset.maximumScreenSpaceError, 16),
    }
    baselineByTileset.set(tileset, baseline)
  }
  return baseline
}

function requestSceneRender(viewer) {
  try {
    viewer?.scene?.requestRender?.()
  } catch {
    /* viewer may be tearing down */
  }
}

/** Read current diagnostic flags and statistics for one loaded layer. */
export function readTilesetDiagnostics(layer) {
  const tileset = layer?.tileset
  if (!tileset || typeof tileset !== 'object') return null
  if (typeof tileset.isDestroyed === 'function' && tileset.isDestroyed()) return null
  const baseline = baselineByTileset.get(tileset)
  const sse = clampSse(tileset.maximumScreenSpaceError, 16)
  return {
    layerId: layer.id,
    name: layer.name,
    kind: layer.kind ?? null,
    visible: layer.visible !== false,
    supportsWireframe: supportsWireframe(layer),
    wireframe: Boolean(tileset.debugWireframe),
    clay: isClayActive(tileset),
    colorizeTiles: Boolean(tileset.debugColorizeTiles),
    boundingVolume: Boolean(tileset.debugShowBoundingVolume),
    boundingVolumePaused: pausedBoundsByTileset.has(tileset),
    sse,
    defaultSse: baseline ? baseline.sse : sse,
    statistics: readTilesetStatistics(tileset),
  }
}

/**
 * Safely apply a diagnostic patch (`wireframe`, `clay`, `colorizeTiles`, `boundingVolume`, `sse`)
 * onto a layer's Cesium3DTileset.
 */
export function applyTilesetDiagnostics(layer, patch = {}, { viewer = null, Cesium = null } = {}) {
  const tileset = layer?.tileset
  if (!tileset || typeof tileset !== 'object' || (typeof tileset.isDestroyed === 'function' && tileset.isDestroyed())) {
    return { ok: false, reason: 'unavailable', warnings: [], state: null }
  }
  const hasWireframe = Object.prototype.hasOwnProperty.call(patch, 'wireframe')
  const hasClay = Object.prototype.hasOwnProperty.call(patch, 'clay')
  const hasColorize = Object.prototype.hasOwnProperty.call(patch, 'colorizeTiles')
  const hasBBox = Object.prototype.hasOwnProperty.call(patch, 'boundingVolume')
  const hasSse = Object.prototype.hasOwnProperty.call(patch, 'sse')

  const warnings = []
  const wantMeshOnly = (hasWireframe && Boolean(patch.wireframe)) || (hasClay && Boolean(patch.clay))
  if (wantMeshOnly && !supportsWireframe(layer)) {
    const hasOther =
      hasColorize ||
      hasBBox ||
      hasSse ||
      (hasWireframe && !patch.wireframe) ||
      (hasClay && !patch.clay)
    if (!hasOther) {
      return { ok: false, reason: 'unsupported_3dgs', warnings: ['unsupported_3dgs'], state: readTilesetDiagnostics(layer) }
    }
    warnings.push('unsupported_3dgs')
  }

  const baseline = ensureBaseline(tileset)
  try {
    if (hasWireframe) {
      const wantWireframe = Boolean(patch.wireframe)
      if (!wantWireframe || supportsWireframe(layer)) {
        tileset.debugWireframe = wantWireframe
      }
    }
    if (hasClay) {
      const wantClay = Boolean(patch.clay)
      if (!wantClay || supportsWireframe(layer)) {
        if (!setClayMode(tileset, wantClay, Cesium)) {
          return { ok: false, reason: 'unavailable', warnings, state: readTilesetDiagnostics(layer) }
        }
      }
    }
    if (hasColorize) {
      tileset.debugColorizeTiles = Boolean(patch.colorizeTiles)
    }
    if (hasBBox) {
      setBoundingVolume(tileset, Boolean(patch.boundingVolume))
    }
    if (hasSse) {
      tileset.maximumScreenSpaceError = clampSse(patch.sse, baseline.sse)
    }
  } catch {
    return { ok: false, reason: 'unavailable', warnings, state: readTilesetDiagnostics(layer) }
  }

  requestSceneRender(viewer)
  return { ok: true, warnings, state: readTilesetDiagnostics(layer) }
}

/** Restore one layer's diagnostic flags and SSE back to its pre-diagnostic baseline. */
export function resetTilesetDiagnostics(layer, { viewer = null, Cesium = null, defaultSse } = {}) {
  const tileset = layer?.tileset
  if (!tileset || typeof tileset !== 'object' || (typeof tileset.isDestroyed === 'function' && tileset.isDestroyed())) {
    return { ok: false, reason: 'unavailable', state: null }
  }
  const baseline = baselineByTileset.get(tileset)
  const targetSse = Number.isFinite(Number(defaultSse))
    ? clampSse(defaultSse, 16)
    : (baseline?.sse ?? clampSse(tileset.maximumScreenSpaceError, 16))
  try {
    tileset.debugWireframe = baseline ? baseline.wireframe : false
    setClayMode(tileset, baseline ? baseline.clay : false, Cesium)
    tileset.debugColorizeTiles = baseline ? baseline.colorizeTiles : false
    setBoundingVolume(tileset, baseline?.boundingVolume ?? false)
    tileset.maximumScreenSpaceError = targetSse
  } catch {
    return { ok: false, reason: 'unavailable', state: readTilesetDiagnostics(layer) }
  }
  baselineByTileset.delete(tileset)
  requestSceneRender(viewer)
  return { ok: true, state: readTilesetDiagnostics(layer) }
}

/** Restore diagnostics on every layer in `layers`; returns number of layers reset. */
export function resetAllTilesetDiagnostics(layers = [], options = {}) {
  let count = 0
  for (const layer of Array.isArray(layers) ? layers : []) {
    const tileset = layer?.tileset
    if (!tileset) continue
    const dirty =
      baselineByTileset.has(tileset) ||
      isClayActive(tileset) ||
      Boolean(tileset.debugWireframe) ||
      Boolean(tileset.debugColorizeTiles) ||
      Boolean(tileset.debugShowBoundingVolume)
    if (!dirty) continue
    if (resetTilesetDiagnostics(layer, options).ok) count += 1
  }
  return count
}
