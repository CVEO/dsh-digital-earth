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

/** One catalog entry: `name`/`definition` are Chinese, the `En` twins serve the English UI and prompt. */
const entry = (id, key, name, nameEn, color, definition, definitionEn) => Object.freeze({ id, key, name, nameEn, color, definition, definitionEn })

export const DEFAULT_CLASSES = Object.freeze([
  entry(1, 'building', '建筑', 'Building', '#f59e0b',
    '单栋建筑屋顶外轮廓，不含立面、阴影、道路和相邻建筑；相邻建筑分成独立实例。',
    'One building roof footprint. Exclude facades, shadows, roads and adjacent buildings; keep adjacent buildings as separate instances.'),
  entry(2, 'water', '水体', 'Water', '#38bdf8',
    '湖泊、池塘、河流等独立水面；堤埂内的水域按可见水面整体。',
    'One lake, pond or river surface. Treat the water body inside its banks as one visible surface.'),
  entry(3, 'vegetation', '植被', 'Vegetation', '#4ade80',
    '林地、树冠、绿化带等植被覆盖区域；道路与建筑之间的独立绿化也按实例输出。',
    'Woodland, tree crowns or green belts; also output standalone greenery between roads and buildings as its own instance.'),
  entry(4, 'road', '道路', 'Road', '#94a3b8',
    '可见道路路面或道路中心带；被建筑/植被遮挡处断开，不推测被遮挡部分。',
    'Visible road surface or carriageway band. Break where buildings or vegetation cover it; never infer occluded parts.'),
  entry(5, 'vehicle', '车辆', 'Vehicle', '#f87272',
    '单辆汽车、卡车等车辆；只输出可见车体，不含阴影。',
    'One car or truck. Draw the visible body only, without its shadow.'),
  entry(6, 'sports_field', '运动场', 'Sports field', '#a78bfa',
    '跑道、球场等运动场地：跑道与场芯作为一个整体实例，不含周边草地与看台。',
    'Running tracks and courts as one instance each: keep the track and its infield together, exclude surrounding grass and stands.'),
  entry(7, 'farmland', '农田', 'Farmland', '#facc15',
    '耕地、农田地块；按田埂/道路分隔的独立田块输出。',
    'Cultivated plots, split at ridges or roads into separate instances.'),
  entry(8, 'other', '其他地物', 'Other feature', '#c084fc',
    '清晰可见但不属于以上类别的地物，按独立可见图斑输出。',
    'Clearly visible features outside the other classes, one visible patch per instance.'),
])

export const SPORTS_CLASSES = Object.freeze([
  entry(21, 'tennis', '网球场', 'Tennis court', '#84cc16',
    '沿双打边线逐片描绘网球场。',
    'One tennis court. Follow the outer doubles playing lines. Exclude the surrounding runoff.'),
  entry(22, 'pool', '游泳池', 'Swimming pool', '#38bdf8',
    '沿池水边缘描绘，每个独立池体单独提取。',
    'One outdoor swimming pool. Trace the water edge, excluding the deck. Separate adjacent basins.'),
  entry(23, 'track', '田径场', 'Athletics track', '#ef795d',
    '沿最外圈跑道描绘，场芯计入整座田径场。',
    'One oval running track complex. Trace the outer lane boundary as a filled footprint including the infield.'),
  entry(24, 'pitch', '足球场', 'Football pitch', '#4ade80',
    '按可辨认的边线与底线描绘足球比赛区。',
    'One football playing pitch with identifiable markings. Follow its touchlines and goal lines.'),
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

/** Build one custom class entry (not yet id-assigned); the definition follows the UI language. */
export function customClass(label, language = 'zh') {
  const clean = sanitizeCustomLabel(label)
  if (clean === '') return null
  return {
    key: `custom:${clean}`,
    name: clean,
    color: customColor(clean),
    definition: language === 'en'
      ? `User-defined class: ${clean}. Output only this class as separate visible patches, without surrounding features.`
      : `用户自定义类别：${clean}。只输出该类别的独立可见图斑，不要包含周边其他地物。`,
    custom: true,
  }
}

/**
 * Merge default + custom labels into the 1..N catalog sent to the model.
 * Defaults keep their ids; custom entries are appended after the max id.
 * Duplicate/default labels are ignored. `language` only picks the display name
 * and the prompt definition; `key` and colours are language-independent.
 */
export function buildClassCatalog(customLabels = [], presets = DEFAULT_CLASSES, language = 'zh') {
  const english = language === 'en'
  const catalog = presets.map((item) => ({
    id: item.id,
    key: item.key,
    name: english ? item.nameEn : item.name,
    color: item.color,
    definition: english ? item.definitionEn : item.definition,
    custom: false,
  }))
  const seen = new Set(catalog.map((item) => item.name))
  let nextId = Math.max(...catalog.map((item) => item.id)) + 1
  for (const raw of Array.isArray(customLabels) ? customLabels : []) {
    if (catalog.length >= MAX_CLASSES) break
    const custom = customClass(raw, language)
    if (!custom || seen.has(custom.name)) continue
    seen.add(custom.name)
    catalog.push({ ...custom, id: nextId })
    nextId += 1
  }
  return catalog
}

export const TAXONOMY_LIMITS = Object.freeze({ maxClasses: MAX_CLASSES, maxLabelLength: MAX_LABEL })
