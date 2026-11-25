/**
 * scene/bookmarks.js — named camera bookmarks ("视角收藏").
 *
 * Client-only feature: a bookmark stores the camera view (lon/lat/height/heading/
 * pitch) in localStorage, so a user can jump between analysis viewpoints without
 * asking the Agent to replay a fly command. No tool contract changes: the panel
 * talks to the Cesium viewer directly, exactly like the reset/fly buttons.
 */

import { cameraView, flightDuration, viewDistanceM } from './motion.js'

export const BOOKMARK_STORAGE_KEY = 'dsh-de:bookmarks:v1'
export const MAX_BOOKMARKS = 20
/** One sentence per stop, used by the tour story bar (v1.7 P0). */
export const MAX_BOOKMARK_CAPTION = 120
/** Max serialized thumbnail size (small 160x96 JPEG data URL). */
export const MAX_BOOKMARK_THUMB = 40_000

const finite = (value) => typeof value === 'number' && Number.isFinite(value)

/** Captions are free text; empty is the normal "no sentence yet" state. */
const normalizeCaption = (value) => (typeof value === 'string' ? value.trim().slice(0, MAX_BOOKMARK_CAPTION) : '')

/** Accept only small inline image data URLs for thumbnails. */
const normalizeThumb = (value) =>
  typeof value === 'string' && value.startsWith('data:image/') && value.length <= MAX_BOOKMARK_THUMB ? value : ''

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Human-readable spatial readout for a saved camera view (pure, zero network). */
export function formatBookmarkMeta(view) {
  const normalized = normalizeBookmarkView(view)
  if (!normalized) return null
  const alt = normalized.height >= 1000
    ? `${(normalized.height / 1000).toFixed(normalized.height >= 10000 ? 1 : 2)} km`
    : `${Math.round(normalized.height)} m`
  const headingDeg = ((Math.round(normalized.heading) % 360) + 360) % 360
  const compass = COMPASS_8[Math.round(headingDeg / 45) % 8]
  const pitchDeg = Math.round(normalized.pitch)
  const latStr = `${Math.abs(normalized.lat).toFixed(4)}°${normalized.lat >= 0 ? 'N' : 'S'}`
  const lonStr = `${Math.abs(normalized.lon).toFixed(4)}°${normalized.lon >= 0 ? 'E' : 'W'}`
  return {
    alt,
    headingDeg,
    compass,
    pitchDeg,
    coords: `${latStr}, ${lonStr}`,
  }
}

/** Capture a lightweight 160×96 center-cropped JPEG thumbnail of the current WebGL canvas. */
export function captureBookmarkThumbnail(viewer, { width = 160, height = 96, quality = 0.62 } = {}) {
  try {
    if (typeof document === 'undefined' || !viewer?.canvas || viewer.isDestroyed?.()) return ''
    const source = viewer.canvas
    if (!(source.width > 0) || !(source.height > 0)) return ''
    viewer.render?.()
    const target = document.createElement('canvas')
    target.width = width
    target.height = height
    const ctx = target.getContext?.('2d')
    if (!ctx) return ''
    const srcRatio = source.width / source.height
    const dstRatio = width / height
    let sx = 0, sy = 0, sw = source.width, sh = source.height
    if (srcRatio > dstRatio) {
      sw = Math.round(source.height * dstRatio)
      sx = Math.round((source.width - sw) / 2)
    } else {
      sh = Math.round(source.width / dstRatio)
      sy = Math.round((source.height - sh) / 2)
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
    const dataUrl = target.toDataURL('image/jpeg', quality)
    return normalizeThumb(dataUrl)
  } catch {
    return ''
  }
}

/** Accept only complete, sane camera views (missing/wrong fields are dropped). */
export function normalizeBookmarkView(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const view = { lon: Number(raw.lon), lat: Number(raw.lat), height: Number(raw.height), heading: Number(raw.heading), pitch: Number(raw.pitch) }
  if (!finite(view.lon) || !finite(view.lat) || !finite(view.height)) return null
  if (!finite(view.heading)) view.heading = 0
  if (!finite(view.pitch)) view.pitch = -45
  if (view.lon < -180 || view.lon > 180 || view.lat < -90 || view.lat > 90) return null
  if (view.height < 0 || view.height > 40000000) return null
  if (raw.roll !== undefined && raw.roll !== null && raw.roll !== '') {
    const roll = Number(raw.roll)
    if (finite(roll) && roll >= -360 && roll <= 360) view.roll = roll
  }
  if (raw.fov !== undefined && raw.fov !== null && raw.fov !== '') {
    const fov = Number(raw.fov)
    if (finite(fov) && fov >= 5 && fov <= 175) view.fov = fov
  }
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
      // Additive since v1.7: older saved lists simply have no caption or thumbnail.
      caption: normalizeCaption(item.caption),
      thumb: normalizeThumb(item.thumb),
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

/** Persist bookmarks; drops thumbnails if storage quota is tight, returns false when unavailable. */
export function saveBookmarks(list, storage = defaultStorage()) {
  if (!storage || typeof storage.setItem !== 'function') return false
  const normalized = normalizeBookmarks(list)
  try {
    storage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(normalized))
    return true
  } catch {
    try {
      const compact = normalized.map((item) => ({ ...item, thumb: '' }))
      storage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(compact))
      return true
    } catch {
      return false
    }
  }
}

function nextDefaultName(bookmarks) {
  let maxNumber = bookmarks.length
  for (const item of bookmarks) {
    const match = typeof item.name === 'string' ? item.name.trim().match(/^视角\s*(\d+)$/) : null
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]))
  }
  return `视角 ${maxNumber + 1}`
}

/**
 * Append one bookmark at the end so viewpoints stay in chronological tour order (1 -> 2 -> 3).
 * Default names auto-increment past any existing "视角 N" without duplicates.
 */
export function addBookmark(list, view, name, { now = Date.now(), idFactory, caption, thumb } = {}) {
  const normalized = normalizeBookmarkView(view)
  if (normalized === null) return { list: normalizeBookmarks(list), bookmark: null }
  const bookmarks = normalizeBookmarks(list)
  const id = typeof idFactory === 'function' ? String(idFactory()) : `bm-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const bookmark = {
    id,
    name: typeof name === 'string' && name.trim() !== '' ? name.trim().slice(0, 60) : nextDefaultName(bookmarks),
    caption: normalizeCaption(caption),
    thumb: normalizeThumb(thumb),
    view: normalized,
    createdAt: now,
  }
  return { list: [...bookmarks, bookmark].slice(-MAX_BOOKMARKS), bookmark }
}

/** Rename one bookmark; empty names are ignored so labels never go blank. */
export function renameBookmark(list, id, name) {
  const trimmed = typeof name === 'string' ? name.trim().slice(0, 60) : ''
  if (trimmed === '') return normalizeBookmarks(list)
  return normalizeBookmarks(list).map((item) => (item.id === id ? { ...item, name: trimmed } : item))
}

/** Move one bookmark up (-1) or down (+1) in tour playback order. */
export function moveBookmark(list, id, delta) {
  const items = normalizeBookmarks(list)
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return items
  const target = index + (delta < 0 ? -1 : delta > 0 ? 1 : 0)
  if (target < 0 || target >= items.length || target === index) return items
  const next = items.slice()
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

/** Update an existing bookmark's camera view (and optional thumbnail) in place. */
export function updateBookmarkView(list, id, view, { thumb } = {}) {
  const normalized = normalizeBookmarkView(view)
  if (normalized === null) return normalizeBookmarks(list)
  const nextThumb = thumb !== undefined ? normalizeThumb(thumb) : undefined
  return normalizeBookmarks(list).map((item) =>
    item.id === id ? { ...item, view: normalized, ...(nextThumb !== undefined ? { thumb: nextThumb } : {}) } : item,
  )
}

/** Replace one bookmark's caption (tour stop text); unknown ids are a no-op. */
export function updateBookmarkCaption(list, id, caption) {
  return normalizeBookmarks(list).map((item) => (item.id === id ? { ...item, caption: normalizeCaption(caption) } : item))
}

/** Remove one bookmark by id; unknown ids are a no-op. */
export function removeBookmark(list, id) {
  return normalizeBookmarks(list).filter((item) => item.id !== id)
}

/**
 * Fly the camera to a stored view. Returns false for unusable input.
 *
 * `duration` stays optional and backwards compatible: when the caller does not
 * pin it, the flight time follows the distance from the current camera, so a hop
 * across a province is not rushed while a bookmark next door stays instant.
 */
export function flyToBookmark(viewer, Cesium, view, duration) {
  const normalized = normalizeBookmarkView(view)
  if (!viewer?.camera || !Cesium?.Cartesian3 || normalized === null) return false
  const travel = Number.isFinite(duration)
    ? duration
    : flightDuration(viewDistanceM(cameraView(viewer, Cesium), normalized))
  try {
    if (finite(normalized.fov) && viewer.camera.frustum && 'fov' in viewer.camera.frustum) {
      viewer.camera.frustum.fov = Cesium.Math.toRadians(normalized.fov)
    }
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(normalized.lon, normalized.lat, normalized.height),
      orientation: {
        heading: Cesium.Math.toRadians(normalized.heading),
        pitch: Cesium.Math.toRadians(normalized.pitch),
        roll: finite(normalized.roll) ? Cesium.Math.toRadians(normalized.roll) : 0,
      },
      duration: travel,
    })
    return true
  } catch {
    return false
  }
}
