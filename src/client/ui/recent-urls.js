/**
 * ui/recent-urls.js — remembered online 3D Tiles addresses (page-local).
 *
 * Local folders are remembered by the Host after a `/scan` gesture; a remote URL
 * typed into the address bar had no equivalent and vanished on reload. This list
 * is deliberately localStorage-only: a signed tileset URL may carry a token, so
 * it must never travel to the Host or into a tool result. Reads and writes are
 * best-effort (private mode, exhausted quota) and the file is pure data — the
 * menu lives in ui/data-menu.js.
 */

export const RECENT_URLS_KEY = 'dsh.digital-earth.recentUrls'
export const RECENT_URLS_LIMIT = 8
const RECENT_URL_MAX_LENGTH = 2048
const RECENT_URL_LABEL_MAX = 72

function storageOf(storage) {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Only absolute http(s) addresses are remembered; anything else returns null. */
export function sanitizeRecentUrl(value) {
  if (typeof value !== 'string') return null
  const url = value.trim()
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return null
  if (url.length > RECENT_URL_MAX_LENGTH) return null
  return url
}

/** Compact menu label: host plus the dataset folder, never the query string. */
export function recentUrlLabel(url) {
  const clean = sanitizeRecentUrl(url)
  if (clean === null) return ''
  try {
    const parsed = new URL(clean)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const tail = segments.length > 0 ? segments[segments.length - 1] : ''
    // A tileset.json tail identifies every dataset, so name the folder above it.
    const folder = tail === 'tileset.json' ? (segments.length > 1 ? segments[segments.length - 2] : '') : tail
    const label = folder !== '' ? `${parsed.hostname}/${folder}` : parsed.hostname
    return label.length > RECENT_URL_LABEL_MAX ? `${label.slice(0, RECENT_URL_LABEL_MAX - 1)}…` : label
  } catch {
    return clean.slice(0, RECENT_URL_LABEL_MAX)
  }
}

/** Deduplicate by URL, keep the newest first and cap the list. */
function sanitizeRecentUrls(list) {
  const clean = []
  const seen = new Set()
  for (const item of Array.isArray(list) ? list : []) {
    const raw = typeof item === 'string' ? item : item?.url
    const url = sanitizeRecentUrl(raw)
    if (url === null || seen.has(url)) continue
    seen.add(url)
    clean.push({ url, at: typeof item?.at === 'string' ? item.at : '' })
    if (clean.length >= RECENT_URLS_LIMIT) break
  }
  return clean
}

export function readRecentUrls(storage) {
  const target = storageOf(storage)
  if (target === null) return []
  try {
    const text = target.getItem(RECENT_URLS_KEY)
    if (typeof text !== 'string' || text === '') return []
    return sanitizeRecentUrls(JSON.parse(text))
  } catch {
    return []
  }
}

export function rememberRecentUrl(list, url, at = new Date().toISOString()) {
  const clean = sanitizeRecentUrl(url)
  const previous = sanitizeRecentUrls(list)
  if (clean === null) return previous
  return sanitizeRecentUrls([{ url: clean, at }, ...previous.filter((entry) => entry.url !== clean)])
}

export function writeRecentUrls(list, storage) {
  const target = storageOf(storage)
  if (target === null) return false
  try {
    target.setItem(RECENT_URLS_KEY, JSON.stringify(sanitizeRecentUrls(list)))
    return true
  } catch {
    return false
  }
}
