/**
 * Temporal validation and normalization for multi-frame imagery sources and
 * L3 raster overlays (`frames` and/or `times` + `{time}` / WMS TIME).
 *
 * Invalid temporal definitions reject the single offending catalog entry
 * (`ok: false`) instead of silently truncating or letting malformed URLs /
 * timestamps reach Cesium or the remote proxy.
 */
import { MAX_RASTER_FRAMES } from './constants.js'
import { cleanText, cleanUrl, isPlainObject } from './sanitize.js'

const MAX_TIME_LENGTH = 40
const MAX_FRAME_LABEL_LENGTH = 80

const YEAR_RE = /^(\d{4})$/
const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:(Z)|([+-])(\d{2}):(\d{2}))?$/

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

function validCalendarDate(year, month, day) {
  if (year < 1000 || year > 9999) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > daysInMonth(year, month)) return false
  return true
}

/**
 * Validate a strict ISO-8601 date/time subset suitable for tile templates and
 * OGC WMS `TIME` parameters (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or ISO datetime).
 * Returns the cleaned string, or `''` when invalid.
 */
export function cleanTimeString(value) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  if (text.length < 4 || text.length > MAX_TIME_LENGTH) return ''
  if (/[\u0000-\u001f\u007f-\u009f]/.test(text)) return ''

  let match = YEAR_RE.exec(text)
  if (match) {
    const year = Number(match[1])
    return year >= 1000 && year <= 9999 ? text : ''
  }

  match = YEAR_MONTH_RE.exec(text)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    return year >= 1000 && year <= 9999 && month >= 1 && month <= 12 ? text : ''
  }

  match = DATE_RE.exec(text)
  if (match) {
    return validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) ? text : ''
  }

  match = DATETIME_RE.exec(text)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = match[6] === undefined ? 0 : Number(match[6])
  if (!validCalendarDate(year, month, day)) return ''
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return ''
  if (match[9] !== undefined) {
    const tzHour = Number(match[10])
    const tzMinute = Number(match[11])
    if (tzHour < 0 || tzHour > 23 || tzMinute < 0 || tzMinute > 59) return ''
  }
  return text
}

export const isValidTimeString = (value) => cleanTimeString(value) !== ''

/**
 * Normalize optional temporal fields (`frames` and/or `times`) on an imagery
 * source. Returns `{ ok: true, url, frames?, times? }` or `{ ok: false }`.
 */
export function normalizeTemporalImagery(raw, type) {
  const hasRawUrl = Object.hasOwn(raw, 'url') && raw.url !== undefined && raw.url !== null && raw.url !== ''
  const baseUrl = hasRawUrl ? cleanUrl(raw.url) : ''
  if (hasRawUrl && baseUrl === '') return { ok: false }

  const hasFrames = Object.hasOwn(raw, 'frames') && raw.frames !== undefined
  const hasTimes = Object.hasOwn(raw, 'times') && raw.times !== undefined

  if (!hasFrames && !hasTimes) {
    return baseUrl === '' ? { ok: false } : { ok: true, url: baseUrl }
  }

  let times = null
  if (hasTimes) {
    if (!Array.isArray(raw.times) || raw.times.length === 0 || raw.times.length > MAX_RASTER_FRAMES) {
      return { ok: false }
    }
    times = []
    for (const item of raw.times) {
      const cleaned = cleanTimeString(item)
      if (cleaned === '') return { ok: false }
      times.push(cleaned)
    }
  }

  let frames = null
  if (hasFrames) {
    if (!Array.isArray(raw.frames) || raw.frames.length === 0 || raw.frames.length > MAX_RASTER_FRAMES) {
      return { ok: false }
    }
    if (times !== null && raw.frames.length !== times.length) {
      return { ok: false }
    }
    frames = []
    for (let index = 0; index < raw.frames.length; index += 1) {
      const entry = raw.frames[index]
      if (!isPlainObject(entry)) return { ok: false }
      const frameUrl = cleanUrl(entry.url)
      if (frameUrl === '') return { ok: false }
      const hasEntryTime = Object.hasOwn(entry, 'time') && entry.time !== undefined && entry.time !== null && entry.time !== ''
      const entryTime = hasEntryTime ? cleanTimeString(entry.time) : ''
      if (hasEntryTime && entryTime === '') return { ok: false }
      const pairedTime = times !== null ? times[index] : ''
      if (entryTime !== '' && pairedTime !== '' && entryTime !== pairedTime) return { ok: false }
      const effectiveTime = entryTime || pairedTime
      if (frameUrl.includes('{time}') && effectiveTime !== '') {
        if (cleanUrl(frameUrl.replaceAll('{time}', effectiveTime)) === '') return { ok: false }
      }
      const label = cleanText(entry.label, MAX_FRAME_LABEL_LENGTH) || effectiveTime
      if (label === '') return { ok: false }
      frames.push({
        label,
        url: frameUrl,
        ...(entryTime !== '' ? { time: entryTime } : {}),
      })
    }
  } else if (times !== null) {
    if (baseUrl === '') return { ok: false }
    if (type !== 'wms' && !baseUrl.includes('{time}')) return { ok: false }
    if (baseUrl.includes('{time}') && cleanUrl(baseUrl.replaceAll('{time}', times[0])) === '') {
      return { ok: false }
    }
  }

  const resolvedUrl = baseUrl || (frames !== null ? frames[0].url : '')
  if (resolvedUrl === '') return { ok: false }

  return {
    ok: true,
    url: resolvedUrl,
    ...(frames !== null ? { frames } : {}),
    ...(times !== null ? { times } : {}),
  }
}
