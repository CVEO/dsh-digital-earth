/**
 * Small validators shared by the catalogs, the schemas and the inspector.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */

export const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/**
 * Accept only absolute http(s) URLs. Imagery templates legitimately contain
 * placeholders such as `{z}` or `{s}`, so those are neutralised before parsing
 * and the original text is what gets stored.
 */
export function cleanUrl(value) {
  const text = cleanText(value, 2048)
  if (text === '') return ''
  try {
    const parsed = new URL(text.replace(/\{[^}]*\}/g, '0'))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? text : ''
  } catch {
    return ''
  }
}

export function cleanId(value, fallback) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(text) ? text : fallback
}

export function cleanLevel(value) {
  return Number.isInteger(value) && value >= 0 && value <= 25 ? value : undefined
}

export const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
