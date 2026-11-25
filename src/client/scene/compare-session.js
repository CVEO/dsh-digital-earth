/**
 * scene/compare-session.js — native Cesium SplitDirection engine for single-layer
 * and dual-layer (A vs B) 3D comparison.
 *
 * CesiumJS 1.147.0 natively supports `tileset.splitDirection` (`SplitDirection.LEFT` /
 * `RIGHT`) on BOTH traditional 3D Tiles meshes/point clouds (ModelSplitterPipelineStage)
 * AND 3D Gaussian Splatting (`GaussianSplatPrimitive.prototype.update` syncs
 * `tileset.splitDirection` and discards fragments against `czm_splitPosition`).
 *
 * Benefits over ClippingPlaneCollection:
 *   - Enables 3DGS <-> Mesh, 3DGS <-> 3DGS, Mesh <-> Mesh, PointCloud <-> Mesh
 *     side-by-side comparison on the exact same camera viewpoint;
 *   - Zero per-frame preRender clipping plane projection overhead;
 *   - Zero conflict with `earth_analyze action=clip` clipping collections.
 *
 * Horizontal single-layer Mesh swipe continues to use `ClippingPlaneCollection`
 * in `swipe.js` because Cesium's `scene.splitPosition` is vertical-only.
 */

export function splitDirectionValues(Cesium) {
  return {
    NONE: Cesium?.SplitDirection?.NONE ?? 0,
    LEFT: Cesium?.SplitDirection?.LEFT ?? -1,
    RIGHT: Cesium?.SplitDirection?.RIGHT ?? 1,
  }
}

function setTilesetSplit(tileset, value) {
  if (!tileset) return
  try {
    if (typeof tileset.isDestroyed === 'function' && tileset.isDestroyed()) return
    tileset.splitDirection = value
  } catch {
    /* tileset may already be torn down */
  }
}

function setSceneSplit(viewer, ratio) {
  if (!viewer?.scene) return
  try {
    viewer.scene.splitPosition = ratio
  } catch {
    /* viewer may be tearing down */
  }
}

function isLayerUsable(layer) {
  if (!layer || layer.visible === false || !layer.tileset) return false
  if (typeof layer.tileset.isDestroyed === 'function' && layer.tileset.isDestroyed()) return false
  return true
}

/**
 * Start a native single-layer vertical split (works on 3DGS, Mesh, and PointCloud).
 * `side === 'left'` keeps the layer on the left half; `'right'` keeps it on the right.
 */
export function createSingleSplitState({ Cesium, viewer, layer, ratio, side = 'left' }) {
  if (!viewer?.scene || !isLayerUsable(layer)) {
    return { ok: false, reason: 'unavailable' }
  }
  const dirs = splitDirectionValues(Cesium)
  const resolvedSide = side === 'right' ? 'right' : 'left'
  const previousSplitDirection = layer.tileset.splitDirection ?? dirs.NONE
  const previousSplitPosition = typeof viewer.scene.splitPosition === 'number' ? viewer.scene.splitPosition : 0.5

  setTilesetSplit(layer.tileset, resolvedSide === 'right' ? dirs.RIGHT : dirs.LEFT)
  setSceneSplit(viewer, ratio)

  return {
    ok: true,
    active: {
      kind: 'split',
      id: layer.id,
      name: layer.name,
      layerKind: layer.kind ?? null,
      side: resolvedSide,
      ratio,
      orientation: 'vertical',
      tileset: layer.tileset,
      previousSplitDirection,
      previousSplitPosition,
    },
  }
}

/**
 * Start a native dual-layer A (LEFT) vs B (RIGHT) split.
 * Supports any combination of 3DGS / Mesh / PointCloud tilesets.
 */
export function createPairSplitState({ Cesium, viewer, leftLayer, rightLayer, ratio }) {
  if (!viewer?.scene || !isLayerUsable(leftLayer) || !isLayerUsable(rightLayer)) {
    return { ok: false, reason: 'unavailable' }
  }
  if (leftLayer.id === rightLayer.id || leftLayer.tileset === rightLayer.tileset) {
    return { ok: false, reason: 'same_layer' }
  }
  const dirs = splitDirectionValues(Cesium)
  const previousLeftSplitDirection = leftLayer.tileset.splitDirection ?? dirs.NONE
  const previousRightSplitDirection = rightLayer.tileset.splitDirection ?? dirs.NONE
  const previousSplitPosition = typeof viewer.scene.splitPosition === 'number' ? viewer.scene.splitPosition : 0.5

  setTilesetSplit(leftLayer.tileset, dirs.LEFT)
  setTilesetSplit(rightLayer.tileset, dirs.RIGHT)
  setSceneSplit(viewer, ratio)

  return {
    ok: true,
    active: {
      kind: 'pair',
      id: leftLayer.id,
      name: leftLayer.name,
      leftId: leftLayer.id,
      leftName: leftLayer.name,
      leftKind: leftLayer.kind ?? null,
      leftTileset: leftLayer.tileset,
      previousLeftSplitDirection,
      rightId: rightLayer.id,
      rightName: rightLayer.name,
      rightKind: rightLayer.kind ?? null,
      rightTileset: rightLayer.tileset,
      previousRightSplitDirection,
      ratio,
      orientation: 'vertical',
      previousSplitPosition,
    },
  }
}

/** Update split position ratio for a `split` or `pair` session. */
export function applySplitRatio(active, viewer, ratio) {
  if (!active || (active.kind !== 'split' && active.kind !== 'pair')) return false
  active.ratio = ratio
  setSceneSplit(viewer, ratio)
  return true
}

/**
 * Swap left/right sides in place:
 *   - In `pair` mode, swaps left and right layers and flips LEFT/RIGHT on both tilesets;
 *   - In `split` mode, flips which side of the divider displays the single layer.
 */
export function swapSplitSides(active, Cesium) {
  if (!active) return false
  const dirs = splitDirectionValues(Cesium)
  if (active.kind === 'pair') {
    const nextLeft = {
      id: active.rightId,
      name: active.rightName,
      kind: active.rightKind,
      tileset: active.rightTileset,
      prev: active.previousRightSplitDirection,
    }
    const nextRight = {
      id: active.leftId,
      name: active.leftName,
      kind: active.leftKind,
      tileset: active.leftTileset,
      prev: active.previousLeftSplitDirection,
    }
    active.id = nextLeft.id
    active.name = nextLeft.name
    active.leftId = nextLeft.id
    active.leftName = nextLeft.name
    active.leftKind = nextLeft.kind
    active.leftTileset = nextLeft.tileset
    active.previousLeftSplitDirection = nextLeft.prev
    active.rightId = nextRight.id
    active.rightName = nextRight.name
    active.rightKind = nextRight.kind
    active.rightTileset = nextRight.tileset
    active.previousRightSplitDirection = nextRight.prev
    setTilesetSplit(active.leftTileset, dirs.LEFT)
    setTilesetSplit(active.rightTileset, dirs.RIGHT)
    return true
  }
  if (active.kind === 'split') {
    active.side = active.side === 'right' ? 'left' : 'right'
    setTilesetSplit(active.tileset, active.side === 'right' ? dirs.RIGHT : dirs.LEFT)
    return true
  }
  return false
}

/** Cleanly restore every tileset's `splitDirection` and `scene.splitPosition`. */
export function restoreSplitSession(active, Cesium, viewer) {
  if (!active) return false
  const dirs = splitDirectionValues(Cesium)
  if (active.kind === 'split') {
    setTilesetSplit(active.tileset, active.previousSplitDirection ?? dirs.NONE)
    setSceneSplit(viewer, active.previousSplitPosition ?? 0.5)
    return true
  }
  if (active.kind === 'pair') {
    setTilesetSplit(active.leftTileset, active.previousLeftSplitDirection ?? dirs.NONE)
    setTilesetSplit(active.rightTileset, active.previousRightSplitDirection ?? dirs.NONE)
    setSceneSplit(viewer, active.previousSplitPosition ?? 0.5)
    return true
  }
  return false
}

/**
 * Check whether the active `split` / `pair` session's layers still exist and stay visible.
 * Accepts lightweight UI projections (no `tileset` required on the projection rows).
 */
export function shouldStopSplitSession(active, layers = []) {
  if (!active) return false
  if (active.kind === 'split') {
    const found = layers.find((item) => item.id === active.id)
    return !found || found.visible === false
  }
  if (active.kind === 'pair') {
    const left = layers.find((item) => item.id === active.leftId)
    const right = layers.find((item) => item.id === active.rightId)
    return !left || left.visible === false || !right || right.visible === false
  }
  return false
}

/** Project internal active state into an immutable UI-friendly descriptor. */
export function formatSplitState(active) {
  if (!active) return null
  if (active.kind === 'split') {
    return {
      kind: 'split',
      mode: 'split',
      id: active.id,
      name: active.name,
      layerKind: active.layerKind,
      side: active.side,
      leftId: active.side === 'left' ? active.id : null,
      leftName: active.side === 'left' ? active.name : null,
      leftKind: active.side === 'left' ? active.layerKind : null,
      rightId: active.side === 'right' ? active.id : null,
      rightName: active.side === 'right' ? active.name : null,
      rightKind: active.side === 'right' ? active.layerKind : null,
      ratio: active.ratio,
      orientation: 'vertical',
    }
  }
  if (active.kind === 'pair') {
    return {
      kind: 'pair',
      mode: 'pair',
      id: active.leftId,
      name: active.leftName,
      leftId: active.leftId,
      leftName: active.leftName,
      leftKind: active.leftKind,
      rightId: active.rightId,
      rightName: active.rightName,
      rightKind: active.rightKind,
      ratio: active.ratio,
      orientation: 'vertical',
    }
  }
  return null
}
