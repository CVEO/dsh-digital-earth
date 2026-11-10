/**
 * Token-free path helpers: host blocking, filesystem-safe labels and timestamps.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { promises as fs } from 'node:fs'
import { isAbsolute, parse, resolve, sep } from 'node:path'

export const toB64 = (value) => Buffer.from(value, 'utf8').toString('base64url')
export const fromB64 = (value) => Buffer.from(value, 'base64url').toString('utf8')
export const segments = (value) => value.split('/').filter((part) => part.length > 0)
export const decodeSegment = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

/** Hosts the proxy must never reach: loopback, private ranges and link-local. */
export function blockedHost(origin) {  let hostname
  try {
    hostname = new URL(origin).hostname.toLowerCase().replace(/\.+$/, '')
  } catch {
    return true
  }
  if (hostname.startsWith('[')) return true
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true
  // The URL parser normalises numeric IPv4 spellings, but reject the raw forms
  // too (decimal `2130706433`, hex `0x7f000001`) in case a parser does not.
  const rawHost = origin.replace(/^https?:\/\//i, '').split(/[/?#:]/)[0].toLowerCase().replace(/\.+$/, '')
  if (/^\d+$/.test(rawHost) || /^0x[0-9a-f]+$/.test(rawHost)) return true
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
}

/** `fs.realpath` that falls back to the resolved input when the path is missing. */
export async function realPathOr(value) {
  try {
    return await fs.realpath(value)
  } catch {
    return resolve(value)
  }
}

/** A filesystem root (`C:\`, `C:/`, `/`, a UNC share root): never a data folder. */
export function isFilesystemRoot(value) {
  const resolved = resolve(value)
  return parse(resolved).root === resolved
}

const IS_WINDOWS = process.platform === 'win32'

/** Comparison key: resolved, and case-folded on Windows where paths are case-insensitive. */
const pathKey = (value) => {
  const resolved = resolve(value)
  return IS_WINDOWS ? resolved.toLowerCase() : resolved
}

export function isWithinDirectory(target, root) {
  const targetKey = pathKey(target)
  const rootKey = pathKey(root)
  if (targetKey === rootKey) return true
  return targetKey.startsWith(rootKey.endsWith(sep) ? rootKey : `${rootKey}${sep}`)
}

/** Windows UNC paths (`\\host\share`) and their `//host/share` spelling. */
export function isUncPath(value) {
  const text = typeof value === 'string' ? value : ''
  return text.startsWith('\\\\') || /^\/\/[^/]/.test(text)
}

/**
 * A folder the panel may open or serve: absolute, not a filesystem/share root
 * and not a UNC / extended-length / device path.
 *
 * Junction and symlink targets are checked with this too, so a harmless-looking
 * folder name that resolves to `C:\` (or to a share) never enters the allowlist.
 */
export function isSafeOpenedDirectory(value) {
  if (typeof value !== 'string' || value.trim() === '') return false
  if (!isAbsolute(value)) return false
  const resolved = resolve(value)
  if (isFilesystemRoot(resolved) || isUncPath(resolved)) return false
  // `\\?\C:\` and `\\.\C:` resolve to a drive root / UNC spelling on Windows;
  // reject the raw spelling as well so no parser difference can slip through.
  if (/^\\\\[?.]\\/.test(value) || /^\\\\[?.]\\/.test(resolved)) return false
  return true
}

export function sanitizeLabel(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function timeStamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}
