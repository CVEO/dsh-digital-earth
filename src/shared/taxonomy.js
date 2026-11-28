/**
 * shared/taxonomy.js — the default ground-feature class catalog used by the
 * extraction workbench, the Host instance prompt and the Agent extraction tool.
 *
 * v1.7.0 v3: extraction is ground-feature instance segmentation only; every class
 * is a 2D vector target. Definitions are part of the prompt, so they must stay
 * short, concrete and mutually exclusive. Custom classes are appended by the user
 * and can be reset back to this catalog.
 */

const MAX_CLASSES = 12
const MAX_LABEL = 16

export const DEFAULT_CLASSES = Object.freeze([
  Object.freeze({
    id: 1, key: 'building', name: '建筑', color: '#f59e0b',
    definition: '单栋建筑屋顶外轮廓，不含立面、阴影、道路和相邻建筑；相邻建筑分成独立实例。',
  }),
  Object.freeze({
    id: 2, key: 'water', name: '水体', color: '#38bdf8',
    definition: '湖泊、池塘、河流等独立水面；堤埂内的水域按可见水面整体。',
  }),
  Object.freeze({
    id: 3, key: 'vegetation', name: '植被', color: '#4ade80',
    definition: '林地、树冠、绿化带等植被覆盖区域；道路与建筑之间的独立绿化也按实例输出。',
  }),
  Object.freeze({
    id: 4, key: 'road', name: '道路', color: '#94a3b8',
    definition: '可见道路路面或道路中心带；被建筑/植被遮挡处断开，不推测被遮挡部分。',
  }),
  Object.freeze({
    id: 5, key: 'vehicle', name: '车辆', color: '#f87272',
    definition: '单辆汽车、卡车等车辆；只输出可见车体，不含阴影。',
  }),
  Object.freeze({
    id: 6, key: 'sports_field', name: '运动场', color: '#a78bfa',
    definition: '跑道、球场等运动场地：跑道与场芯作为一个整体实例，不含周边草地与看台。',
  }),
  Object.freeze({
    id: 7, key: 'farmland', name: '农田', color: '#facc15',
    definition: '耕地、农田地块；按田埂/道路分隔的独立田块输出。',
  }),
  Object.freeze({
    id: 8, key: 'other', name: '其他地物', color: '#c084fc',
    definition: '清晰可见但不属于以上类别的地物，按独立可见图斑输出。',
  }),
])

export const SPORTS_CLASSES = Object.freeze([
  Object.freeze({
    id: 21, key: 'tennis', name: '网球场', color: '#84cc16',
    definition: "One tennis court. Follow the outer doubles playing lines. Exclude the surrounding runoff.",
    descriptionZh: '沿双打边线逐片描绘网球场。',
  }),
  Object.freeze({
    id: 22, key: 'pool', name: '游泳池', color: '#38bdf8',
    definition: "One outdoor swimming pool. Trace the water edge, excluding the deck. Separate adjacent basins.",
    descriptionZh: '沿池水边缘描绘，每个独立池体单独提取。',
  }),
  Object.freeze({
    id: 23, key: 'track', name: '田径场', color: '#ef795d',
    definition: "One oval running track complex. Trace the outer lane boundary as a filled footprint including the infield.",
    descriptionZh: '沿最外圈跑道描绘，场芯计入整座田径场。',
  }),
  Object.freeze({
    id: 24, key: 'pitch', name: '足球场', color: '#4ade80',
    definition: "One football playing pitch with identifiable markings. Follow its touchlines and goal lines.",
    descriptionZh: '按可辨认的边线与底线描绘足球比赛区。',
  }),
])

/** Clamp/sanitize one user custom label; returns '' when unusable. */
export function sanitizeCustomLabel(raw) {
  if (typeof raw !== 'string') return ''
  const clean = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/["'`]/g, '').replace(/\s+/g, ' ').trim()
  return [...clean].length > MAX_LABEL ? [...clean].slice(0, MAX_LABEL).join('') : clean
}

const HASH_COLORS = ['#fb7185', '#f59e0b', '#34d399', '#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#94a3b8']

/** Deterministic colour for a custom class. */
export function customColor(label) {
  let hash = 0
  for (const ch of String(label)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  return HASH_COLORS[hash % HASH_COLORS.length]
}

/** Build one custom class entry (not yet id-assigned). */
export function customClass(label) {
  const clean = sanitizeCustomLabel(label)
  if (clean === '') return null
  return {
    key: `custom:${clean}`,
    name: clean,
    color: customColor(clean),
    definition: `用户自定义类别：${clean}。只输出该类别的独立可见图斑，不要包含周边其他地物。`,
    custom: true,
  }
}

/**
 * Merge default + custom labels into the 1..N catalog sent to the model.
 * Defaults keep their ids; custom entries are appended after the max id.
 * Duplicate/default labels are ignored.
 */
export function buildClassCatalog(customLabels = [], presets = DEFAULT_CLASSES) {
  const catalog = presets.map((entry) => ({ ...entry, custom: false }))
  const seen = new Set(catalog.map((entry) => entry.name))
  let nextId = Math.max(...catalog.map((entry) => entry.id)) + 1
  for (const raw of Array.isArray(customLabels) ? customLabels : []) {
    if (catalog.length >= MAX_CLASSES) break
    const entry = customClass(raw)
    if (!entry || seen.has(entry.name)) continue
    seen.add(entry.name)
    catalog.push({ ...entry, id: nextId })
    nextId += 1
  }
  return catalog
}

export const TAXONOMY_LIMITS = Object.freeze({ maxClasses: MAX_CLASSES, maxLabelLength: MAX_LABEL })
