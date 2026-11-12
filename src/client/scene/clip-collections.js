/**
 * scene/clip-collections.js — one shared, reusable ClippingPlaneCollection per tileset.
 *
 * Why this module exists
 * ----------------------
 * Cesium's `tileset.clippingPlanes` setter destroys the previous collection
 * (`ClippingPlaneCollection.setOwner` -> `destroy()`), including its clipping
 * texture, while tile draw commands may still reference that texture. Assigning
 * a new value — or worse, `undefined` — therefore crashes the renderer with
 * "Cannot read properties of undefined (_target)" and rendering stops.
 *
 * Two features clip tilesets: the swipe comparison and `earth_analyze
 * action=clip`. They used to own separate collections, so finishing one could
 * destroy the other's collection, or restore `previous ?? undefined`. This
 * module is the single registry: a collection is created once per tileset,
 * reused, and **only ever disabled** — never unassigned or destroyed while the
 * tileset lives.
 *
 * Ownership keeps the two features from fighting: a collection has at most one
 * owner (`'swipe'` or `'analysis'`). Acquiring a collection another owner holds
 * is refused with `reason: 'conflict'` instead of silently stealing it, and an
 * externally assigned collection (some other plugin clipped the tileset) is
 * never touched.
 *
 * Contract: one plane per collection. Both callers clip with a single plane;
 * extra planes are ignored on purpose so the registry stays simple.
 */
export const CLIP_OWNER_SWIPE = 'swipe'
export const CLIP_OWNER_ANALYSIS = 'analysis'

/** tileset -> { collection, owner } */
const registry = new WeakMap()

function liveEntry(tileset) {
  if (!tileset || typeof tileset !== 'object') return null
  const entry = registry.get(tileset)
  if (!entry) return null
  const destroyed =
    typeof entry.collection?.isDestroyed === 'function' ? entry.collection.isDestroyed() : false
  if (destroyed) {
    registry.delete(tileset)
    return null
  }
  return entry
}

/** The collection this module owns for `tileset`, or `null`. */
export function clipCollectionOf(tileset) {
  return liveEntry(tileset)?.collection ?? null
}

/** Current owner (`'swipe'` / `'analysis'`) of the registered collection, or `null`. */
export function clipOwnerOf(tileset) {
  return liveEntry(tileset)?.owner ?? null
}

/**
 * Write one plane into a collection in place.
 *
 * Cesium's `ClippingPlane` keeps `normal` and `distance` as mutable fields, so
 * a preRender hook can retarget the plane without rebuilding the collection
 * (which would recreate the GL objects and the clipping texture every frame).
 */
export function setClipPlane(collection, plane) {
  if (!collection || !plane || !plane.normal || !Number.isFinite(plane.distance)) return false
  const target = typeof collection.get === 'function' ? collection.get(0) : null
  if (!target) return false
  try {
    if (target.normal && typeof target.normal === 'object') {
      target.normal.x = plane.normal.x
      target.normal.y = plane.normal.y
      target.normal.z = plane.normal.z
    } else {
      target.normal = plane.normal
    }
    target.distance = plane.distance
    return true
  } catch {
    return false
  }
}

/**
 * Take ownership of the tileset's clipping collection, creating it on first use.
 *
 * Returns `{ ok: true, collection, reused }`, or `{ ok: false, reason, owner }`
 * with `reason` one of:
 *   - `'conflict'`    — another owner holds it, or an external collection is
 *                       already assigned to the tileset. Nothing was changed.
 *   - `'unavailable'` — Cesium clipping APIs missing, or tileset rejected the
 *                       assignment (3DGS / destroyed tileset / unsupported).
 */
export function acquireClipCollection(Cesium, tileset, options = {}) {
  const { owner, planes, edgeWidth = 1.5, edgeColor } = options
  if (!Cesium || !tileset || !owner) return { ok: false, reason: 'unavailable' }
  if (
    typeof Cesium.ClippingPlaneCollection !== 'function' ||
    typeof Cesium.ClippingPlane !== 'function'
  ) {
    return { ok: false, reason: 'unavailable' }
  }
  const plane = Array.isArray(planes) ? planes[0] : null
  if (!plane || !plane.normal || !Number.isFinite(plane.distance)) {
    return { ok: false, reason: 'unavailable' }
  }

  const entry = liveEntry(tileset)
  const cached = entry?.collection ?? null
  let existing = null
  try {
    existing = tileset.clippingPlanes ?? null
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  // A collection destroyed with its owner is still referenced by the property but
  // can never draw again, so replacing it is safe (and the only way to recover).
  if (existing !== null && typeof existing.isDestroyed === 'function' && existing.isDestroyed()) {
    existing = null
  }
  // Another plugin/feature assigned its own collection: never replace it.
  if (existing !== null && existing !== cached) {
    return { ok: false, reason: 'conflict', owner: entry?.owner ?? null }
  }
  // Our collection is in use by the other clipping feature.
  if (entry && entry.owner !== null && entry.owner !== owner) {
    return { ok: false, reason: 'conflict', owner: entry.owner }
  }

  let collection = cached
  if (collection === null) {
    try {
      collection = new Cesium.ClippingPlaneCollection({
        planes: [new Cesium.ClippingPlane(plane.normal, plane.distance)],
        enabled: true,
        edgeWidth,
        edgeColor: edgeColor ?? undefined,
      })
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    registry.set(tileset, { collection, owner })
  } else {
    setClipPlane(collection, plane)
    try {
      collection.enabled = true
      if (typeof edgeWidth === 'number') collection.edgeWidth = edgeWidth
      if (edgeColor && typeof collection.edgeColor?.clone === 'function') {
        collection.edgeColor = edgeColor
      }
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    entry.owner = owner
  }

  if (tileset.clippingPlanes !== collection) {
    try {
      tileset.clippingPlanes = collection
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    if (tileset.clippingPlanes !== collection) {
      return { ok: false, reason: 'unavailable' }
    }
  }
  return { ok: true, collection, reused: cached !== null }
}

/**
 * Stop clipping: disable the registered collection, never remove it.
 *
 * Only the current owner may release, so one feature cannot switch off the
 * other's clip. Returns `true` when the collection was disabled. The collection
 * stays assigned to the tileset (disabled) and is reused by the next acquire —
 * re-assigning or unassigning is exactly what crashes the renderer.
 */
export function releaseClipCollection(tileset, owner) {
  const entry = liveEntry(tileset)
  if (!entry) return false
  if (owner !== undefined && entry.owner !== owner) return false
  try {
    entry.collection.enabled = false
  } catch {
    return false
  }
  entry.owner = null
  return true
}
