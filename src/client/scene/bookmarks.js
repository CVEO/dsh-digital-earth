/**
 * scene/bookmarks.js — named camera bookmarks ("视角收藏").
 *
 * Client-only feature: a bookmark stores the camera view (lon/lat/height/heading/
 * pitch) in localStorage, so a user can jump between analysis viewpoints without
 * asking the Agent to replay a fly command. No tool contract changes: the panel
 * talks to the Cesium viewer directly, exactly like the reset/fly buttons.
 */

export const BOOKMARK_STORAGE_KEY = 'dsh-de:bookmarks:v1'
export const MAX_BOOKMARKS = 20

const finite = (value) => typeof value === 'number' && Number.isFinite(value)

/** Accept only complete, sane camera views (missing/wrong fields are dropped). */
export function normalizeBookmarkView(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const view = { lon: Number(raw.lon), lat: Number(raw.lat), height: Number(raw.height), heading: Number(raw.heading), pitch: Number(raw.pitch) }
  if (!finite(view.lon) || !finite(view.lat) || !finite(view.height)) return null
  if (!finite(view.heading)) view.heading = 0
  if (!finite(view.pitch)) view.pitch = -45
  if (view.lon < -180 || view.lon > 180 || view.lat < -90 || view.lat > 90) return null
  if (view.height < 0 || view.height > 40000000) return null
  return view
}

/** Normalise a persisted list: valid views only, unique ids, capped length. */
export function normalizeBookmarks(raw, max = MAX_BOOKMARKS) {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set()
  const bookmarks = []
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue
    const id = typeof item.id === 'string' && item.id !== '' ? item.id : null
    if (id === null || seen.has(id)) continue
    const view = normalizeBookmarkView(item.view)
    if (view === null) continue
    seen.add(id)
    bookmarks.push({
      id,
      name: typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim().slice(0, 60) : '视角',
      view,
      createdAt: finite(item.createdAt) ? item.createdAt : 0,
    })
    if (bookmarks.length >= max) break
  }
  return bookmarks
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Load bookmarks; an absent/corrupt value is an empty list, never an exception. */
export function loadBookmarks(storage = defaultStorage()) {
  if (!storage || typeof storage.getItem !== 'function') return []
  try {
    return normalizeBookmarks(JSON.parse(storage.getItem(BOOKMARK_STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

/** Persist bookmarks; returns false when storage is unavailable/full. */
export function saveBookmarks(list, storage = defaultStorage()) {
  if (!storage || typeof storage.setItem !== 'function') return false
  try {
    storage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(normalizeBookmarks(list)))
    return true
  } catch {
    return false
  }
}

/**
 * Add one bookmark at the front. The name defaults to "视角 N"; ids stay unique.
 * Returns the new list plus the created bookmark.
 */
export function addBookmark(list, view, name, { now = Date.now(), idFactory } = {}) {
  const normalized = normalizeBookmarkView(view)
  if (normalized === null) return { list: normalizeBookmarks(list), bookmark: null }
  const bookmarks = normalizeBookmarks(list)
  const id = typeof idFactory === 'function' ? String(idFactory()) : `bm-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const bookmark = {
    id,
    name: typeof name === 'string' && name.trim() !== '' ? name.trim().slice(0, 60) : `视角 ${bookmarks.length + 1}`,
    view: normalized,
    createdAt: now,
  }
  return { list: [bookmark, ...bookmarks].slice(0, MAX_BOOKMARKS), bookmark }
}

/** Remove one bookmark by id; unknown ids are a no-op. */
export function removeBookmark(list, id) {
  return normalizeBookmarks(list).filter((item) => item.id !== id)
}

/** Fly the camera to a stored view. Returns false for unusable input. */
export function flyToBookmark(viewer, Cesium, view, duration = 1.2) {
  const normalized = normalizeBookmarkView(view)
  if (!viewer?.camera || !Cesium?.Cartesian3 || normalized === null) return false
  try {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(normalized.lon, normalized.lat, normalized.height),
      orientation: {
        heading: Cesium.Math.toRadians(normalized.heading),
        pitch: Cesium.Math.toRadians(normalized.pitch),
        roll: 0,
      },
      duration,
    })
    return true
  } catch {
    return false
  }
}
