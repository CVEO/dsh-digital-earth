/**
 * scene/raster-time.js — pure temporal imagery model helpers (browser-free).
 *
 * Shared by the L3 overlay stack, L4 basemap switching, scene status/bridge,
 * session snapshot restoration, and the Map-tab timeline UI. Mirrors the host's
 * strict ISO-8601 date/time and URL constraints so drafts validated in the
 * panel match `PUT /sources` normalization.
 */

export const MAX_RASTER_FRAMES = 60

const MAX_TIME_LENGTH = 40
const MAX_FRAME_LABEL_LENGTH = 80
const MAX_URL_LENGTH = 2048

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

/** Strict ISO-8601 subset validator matching `src/host/raster-time.js`. */
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

/** Mirror host `cleanUrl`: absolute http(s) URL with `{...}` placeholders allowed. */
export function cleanRasterUrl(value) {
  if (typeof value !== 'string') return ''
  const text = value.trim().slice(0, MAX_URL_LENGTH)
  if (text === '') return ''
  try {
    const parsed = new URL(text.replace(/\{[^}]*\}/g, '0'))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? text : ''
  } catch {
    return ''
  }
}

function substituteTime(url, time) {
  if (typeof url !== 'string' || !time) return typeof url === 'string' ? url : ''
  return url.includes('{time}') ? url.replaceAll('{time}', time) : url
}

/**
 * Resolve a catalog imagery source / raster overlay into an ordered array of
 * playable frames: `[{ index, label, url, time }]`. Non-temporal sources return `[]`.
 */
export function resolveSourceFrames(source) {
  if (!source || typeof source !== 'object') return []
  const rawFrames = Array.isArray(source.frames) ? source.frames : null
  const rawTimes = Array.isArray(source.times) ? source.times : null

  if (rawFrames && rawFrames.length > 0) {
    const out = []
    for (let index = 0; index < rawFrames.length; index += 1) {
      const entry = rawFrames[index]
      if (!entry || typeof entry !== 'object' || typeof entry.url !== 'string' || entry.url.trim() === '') continue
      const entryTime = cleanTimeString(entry.time)
      const pairedTime = rawTimes && typeof rawTimes[index] === 'string' ? cleanTimeString(rawTimes[index]) : ''
      const time = entryTime || pairedTime || null
      const url = substituteTime(entry.url.trim(), time)
      const label =
        (typeof entry.label === 'string' ? entry.label.trim().slice(0, MAX_FRAME_LABEL_LENGTH) : '') ||
        time ||
        `#${index + 1}`
      out.push({ index: out.length, label, url, time })
    }
    return out
  }

  if (rawTimes && rawTimes.length > 0 && typeof source.url === 'string' && source.url.trim() !== '') {
    const baseUrl = source.url.trim()
    const out = []
    for (const rawTime of rawTimes) {
      const time = cleanTimeString(rawTime)
      if (!time) continue
      out.push({
        index: out.length,
        label: time,
        url: substituteTime(baseUrl, time),
        time,
      })
    }
    return out
  }

  return []
}

/** True when a source has at least two periods and should expose a timeline. */
export function hasRasterTimeline(source) {
  return resolveSourceFrames(source).length >= 2
}

/** Clamp a candidate frame index into `[0, frames.length - 1]`. */
export function clampFrameIndex(index, frames) {
  if (!Array.isArray(frames) || frames.length === 0) return 0
  const numeric = Number(index)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(frames.length - 1, Math.max(0, Math.trunc(numeric)))
}

/**
 * Look up a frame index by exact 0-based `frame` integer or by `time` (matches
 * exact `frame.time` first, then case-insensitive exact `frame.label`).
 * Returns `-1` when not found.
 */
export function findFrameIndex(frames, { frame, time } = {}) {
  if (!Array.isArray(frames) || frames.length === 0) return -1
  if (frame !== undefined && frame !== null) {
    if (!Number.isInteger(frame) || frame < 0 || frame >= frames.length) return -1
    return frame
  }
  if (typeof time === 'string') {
    const token = time.trim()
    if (token === '') return -1
    const byTime = frames.findIndex((item) => item.time === token)
    if (byTime >= 0) return byTime
    const lowered = token.toLowerCase()
    const byLabel = frames.findIndex((item) => item.label.toLowerCase() === lowered)
    if (byLabel >= 0) return byLabel
  }
  return -1
}

/** Resolve a persisted `{ frame, time? }` snapshot entry back to a valid index. */
export function resolveRestoredFrameIndex(source, saved) {
  const frames = resolveSourceFrames(source)
  if (frames.length === 0) return 0
  if (saved !== null && typeof saved === 'object') {
    if (typeof saved.time === 'string' && saved.time !== '') {
      const byTime = frames.findIndex((item) => item.time === saved.time)
      if (byTime >= 0) return byTime
    }
    return clampFrameIndex(saved.frame, frames)
  }
  return clampFrameIndex(saved, frames)
}

/**
 * Produce the effective single-frame imagery source passed to `imageryProvider`.
 * Non-temporal sources are returned untouched.
 */
export function resolveFrameSource(source, frameIndex = 0) {
  const frames = resolveSourceFrames(source)
  if (frames.length === 0) return source
  const active = frames[clampFrameIndex(frameIndex, frames)]
  const effective = { ...source, url: active.url }
  if (source.type === 'wms' && active.time) effective.wmsTime = active.time
  return effective
}

/** Stable comparison signature for temporal source changes. */
export function temporalSignature(source) {
  const frames = resolveSourceFrames(source)
  if (frames.length === 0) return ''
  return frames.map((item) => `${item.label}\0${item.url}\0${item.time ?? ''}`).join('\n')
}

/**
 * Compact, additive temporal status payload for `earth_scene status`.
 * Returns `null` for ordinary non-temporal sources so their schema stays unchanged.
 */
export function describeRasterFrames(source, frameIndex = 0) {
  const frames = resolveSourceFrames(source)
  if (frames.length === 0) return null
  const idx = clampFrameIndex(frameIndex, frames)
  const active = frames[idx]
  return {
    frame_count: frames.length,
    current_frame: idx,
    current_label: active.label,
    current_time: active.time,
    frames: frames.map((item) => ({
      index: item.index,
      label: item.label,
      ...(item.time ? { time: item.time } : {}),
    })),
  }
}

/**
 * Parse and validate the optional temporal inputs from the "add overlay" form.
 * Supports:
 *   - `mode === 'none'`: single-frame overlay
 *   - `mode === 'times'`: newline/comma-separated ISO dates + template/WMS URL
 *   - `mode === 'frames'`: one frame per line (`label | url` or `label | url | time`)
 */
export function parseTemporalDraft({ mode = 'none', type = 'wms', url = '', timesText = '', framesText = '' } = {}) {
  if (!mode || mode === 'none') return { ok: true }
  if (mode === 'times') {
    const rawTokens = String(timesText ?? '')
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter((item) => item !== '')
    if (rawTokens.length === 0) return { ok: false, code: 'empty_times' }
    if (rawTokens.length > MAX_RASTER_FRAMES) return { ok: false, code: 'too_many_frames' }
    const times = []
    for (const token of rawTokens) {
      const cleaned = cleanTimeString(token)
      if (!cleaned) return { ok: false, code: 'invalid_time', value: token }
      times.push(cleaned)
    }
    const baseUrl = cleanRasterUrl(url)
    if (!baseUrl) return { ok: false, code: 'invalid_url' }
    if (type !== 'wms' && !baseUrl.includes('{time}')) return { ok: false, code: 'missing_time_placeholder' }
    return { ok: true, url: baseUrl, times }
  }
  if (mode === 'frames') {
    const lines = String(framesText ?? '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item !== '')
    if (lines.length === 0) return { ok: false, code: 'empty_frames' }
    if (lines.length > MAX_RASTER_FRAMES) return { ok: false, code: 'too_many_frames' }
    const frames = []
    for (const line of lines) {
      const parts = line.split('|').map((part) => part.trim())
      if (parts.length < 2 || parts.length > 3) return { ok: false, code: 'invalid_frame_line', value: line }
      const label = parts[0].slice(0, MAX_FRAME_LABEL_LENGTH)
      const frameUrl = cleanRasterUrl(parts[1])
      const rawTime = parts[2] ?? ''
      const time = rawTime !== '' ? cleanTimeString(rawTime) : ''
      if (!label) return { ok: false, code: 'invalid_frame_line', value: line }
      if (!frameUrl) return { ok: false, code: 'invalid_url', value: parts[1] }
      if (rawTime !== '' && !time) return { ok: false, code: 'invalid_time', value: rawTime }
      frames.push({ label, url: frameUrl, ...(time ? { time } : {}) })
    }
    return { ok: true, url: cleanRasterUrl(url) || frames[0].url, frames }
  }
  return { ok: false, code: 'invalid_mode' }
}
