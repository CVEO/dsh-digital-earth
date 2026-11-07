/**
 * scene/georef-check.js — spot a 3D Tiles layer that collapsed toward the Earth's
 * centre because its root tile carries no world placement.
 *
 * The plugin deliberately does not infer a CRS from `tileset_info.json` sidecars
 * or rewrite data at runtime. What it can do generically is *notice* the failure:
 * a georeferenced tileset's bounding sphere sits on the globe (≈ 6.37e6 m from the
 * Earth centre), while local metres read as ECEF put it near the origin. The panel
 * then warns instead of leaving the user with a silent black screen.
 */
export const EARTH_SURFACE_MIN_RADIUS_M = 6_200_000
export const EARTH_SURFACE_MAX_RADIUS_M = 6_600_000

/**
 * @param {object} tileset Cesium3DTileset (or a fake with `boundingSphere`)
 * @param {object} Cesium  vendored Cesium namespace
 * @returns {{kind: 'inside_earth'|'outside_earth', distance_m: number}|null}
 */
export function tilesetGeorefIssue(tileset, Cesium) {
  const center = tileset?.boundingSphere?.center
  if (!center) return null
  const magnitude = Cesium?.Cartesian3?.magnitude
  if (typeof magnitude !== 'function') return null
  let distance = Number.NaN
  try {
    distance = magnitude(center)
  } catch {
    return null
  }
  if (!Number.isFinite(distance)) return null
  if (distance >= EARTH_SURFACE_MIN_RADIUS_M && distance <= EARTH_SURFACE_MAX_RADIUS_M) return null
  // A whole-earth / global tileset legitimately centres its bounding sphere at
  // the Earth's centre; only flag small-radius spheres (local metres read as
  // ECEF) so this heuristic stays a false-positive-free signal.
  const radius = Number(tileset?.boundingSphere?.radius)
  if (distance < EARTH_SURFACE_MIN_RADIUS_M && Number.isFinite(radius) && radius >= EARTH_SURFACE_MIN_RADIUS_M) return null
  return { kind: distance < EARTH_SURFACE_MIN_RADIUS_M ? 'inside_earth' : 'outside_earth', distance_m: Math.round(distance) }
}
