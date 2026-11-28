/**
 * scene/annotation-scheme.js — the class vocabulary of the extraction workbench.
 *
 * Users may ask for any class ("建筑", "温室", "光伏板"), not just the six presets
 * the vision prompt used to know. Everything here is pure so the host payload, the
 * review queue, the canvas legend and the export all agree on one label set:
 *
 *   label (user-visible, may be Chinese) → key (preset id or `custom:<label>`)
 *
 * Presets keep the existing colours; custom classes get a stable colour picked
 * from the shared vector palette by label hash (same class = same colour).
 */
import { VECTOR_COLORS, parseClassColor } from './vector-style.js'

export const PRESET_CLASS_KEYS = Object.freeze(['building', 'vegetation', 'water', 'road', 'vehicle', 'other'])
export const MAX_CLASSES = 8
export const MAX_CLASS_LABEL = 16

const PRESET_SET = new Set(PRESET_CLASS_KEYS)

/** Common Chinese/English spellings mapped onto the six presets. */
const SYNONYMS = new Map([
  ['建筑', 'building'], ['建筑物', 'building'], ['房屋', 'building'], ['楼房', 'building'], ['楼', 'building'],
  ['住宅', 'building'], ['厂房', 'building'], ['building', 'building'], ['buildings', 'building'],
  ['植被', 'vegetation'], ['树', 'vegetation'], ['树木', 'vegetation'], ['林地', 'vegetation'], ['草地', 'vegetation'],
  ['绿化', 'vegetation'], ['vegetation', 'vegetation'], ['trees', 'vegetation'], ['tree', 'vegetation'],
  ['水', 'water'], ['水体', 'water'], ['河流', 'water'], ['河', 'water'], ['湖', 'water'], ['水面', 'water'],
  ['水域', 'water'], ['water', 'water'],
  ['道路', 'road'], ['路', 'road'], ['公路', 'road'], ['街道', 'road'], ['路面', 'road'], ['road', 'road'], ['roads', 'road'],
  ['车辆', 'vehicle'], ['车', 'vehicle'], ['汽车', 'vehicle'], ['卡车', 'vehicle'], ['货车', 'vehicle'],
  ['vehicle', 'vehicle'], ['vehicles', 'vehicle'], ['cars', 'vehicle'], ['car', 'vehicle'],
  ['其他', 'other'], ['其它', 'other'], ['other', 'other'],
])

const CUSTOM_PALETTE = Object.freeze([
  VECTOR_COLORS.accent,
  VECTOR_COLORS.warm,
  VECTOR_COLORS.success,
  VECTOR_COLORS.alert,
  VECTOR_COLORS.violet,
])

const CONTROL_CHARS = /[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/
const STRIP_CHARS = /["'`<>{}[\]\\|]/g

/** Trim, collapse whitespace and reject unusable class labels (no prompt injection). */
export function sanitizeClassLabel(raw) {
  if (typeof raw !== 'string') return null
  if (CONTROL_CHARS.test(raw)) return null
  const collapsed = raw.replace(STRIP_CHARS, ' ').replace(/\s+/g, ' ').trim()
  if (!collapsed) return null
  if ([...collapsed].length > MAX_CLASS_LABEL) return null
  return collapsed
}

/** Preset key for a known label, else `custom:<label>`. */
export function classKeyOf(label) {
  const clean = sanitizeClassLabel(label)
  if (!clean) return null
  const lower = clean.toLowerCase()
  if (PRESET_SET.has(lower)) return lower
  return SYNONYMS.get(clean) ?? SYNONYMS.get(lower) ?? `custom:${clean}`
}

/** Stable colour: presets keep their vector style colour, custom labels hash into the palette. */
export function classHex(labelOrKey) {
  const key = String(labelOrKey ?? '')
  if (PRESET_SET.has(key)) return parseClassColor(key).hex
  const label = key.startsWith('custom:') ? key.slice(7) : key
  let hash = 0
  for (const character of label) hash = (hash * 31 + character.codePointAt(0)) % 997
  return CUSTOM_PALETTE[hash % CUSTOM_PALETTE.length]
}

/** Display text for a class entry; presets are translated, custom labels are literal. */
export function classLabel(entry, t) {
  if (!entry) return ''
  if (entry.custom === true || !entry.labelKey) return entry.label ?? ''
  return typeof t === 'function' ? t(entry.labelKey) : entry.label ?? entry.key
}

/** The six preset chips, in palette order. */
export function presetEntries() {
  return PRESET_CLASS_KEYS.map((key) => ({
    key,
    labelKey: `parse.class.${key}`,
    label: null,
    custom: false,
    hex: parseClassColor(key).hex,
    on: false,
  }))
}

/** One custom chip; returns null when the label is empty/too long/unsafe. */
export function customEntry(label) {
  const clean = sanitizeClassLabel(label)
  if (!clean) return null
  return { key: classKeyOf(clean), label: clean, labelKey: null, custom: true, hex: classHex(clean), on: true }
}

/** Normalise a raw user list into custom entries (deduped, capped, invalid dropped). */
export function customEntries(labels) {
  const out = []
  const seen = new Set()
  for (const label of Array.isArray(labels) ? labels : []) {
    const entry = customEntry(label)
    if (!entry || seen.has(entry.key)) continue
    if (PRESET_SET.has(entry.key)) continue
    seen.add(entry.key)
    out.push(entry)
    if (out.length >= MAX_CLASSES) break
  }
  return out
}

/** Entry for any class label/key; used by the queue and the export. */
export function entryFor(value) {
  const raw = typeof value === 'string' ? value : value?.label ?? value?.key
  if (!raw) return null
  if (raw.startsWith('custom:')) {
    const label = sanitizeClassLabel(raw.slice(7))
    if (!label) return null
    return { key: `custom:${label}`, label, labelKey: null, custom: true, hex: classHex(label), on: false }
  }
  const key = classKeyOf(raw)
  if (!key) return null
  if (PRESET_SET.has(key)) {
    return { key, labelKey: `parse.class.${key}`, label: null, custom: false, hex: parseClassColor(key).hex, on: false }
  }
  const label = key.startsWith('custom:') ? key.slice(7) : raw
  return { key, label, labelKey: null, custom: true, hex: classHex(label), on: false }
}

/**
 * Match a class string returned by the vision model against the requested entries.
 * Returns the requested entry (so the chip colour/label wins) or null.
 */
export function matchClass(returned, entries) {
  const candidate = typeof returned === 'string' ? returned.trim() : ''
  if (!candidate) return null
  const list = Array.isArray(entries) ? entries : []
  const lower = candidate.toLowerCase()
  for (const entry of list) {
    if (!entry) continue
    if (entry.key === candidate || entry.key === lower) return entry
    if (entry.custom && entry.label && entry.label.toLowerCase() === lower) return entry
    if (!entry.custom && entry.labelKey) {
      const presetKey = entry.key
      if (SYNONYMS.get(candidate) === presetKey || SYNONYMS.get(lower) === presetKey) return entry
    }
  }
  // No requested match: fall back to the generic preset so the row is never blank.
  return entryFor('other')
}

/** Whether this entry should appear in the "全部类别" state. */
export function isAllClasses(entries) {
  return !Array.isArray(entries) || entries.length === 0
}
