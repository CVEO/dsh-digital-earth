/**
 * Imagery/terrain source catalog: defaults, normalization, persistence and routes.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { promises as fs } from 'node:fs'
import { API, IMAGERY_TYPES, MAX_IMAGERY_SOURCES, MAX_SOURCES_BODY, MAX_TERRAIN_SOURCES, SOURCES_FILE, TERRAIN_TYPES, THEME_MODES, TOKEN } from './constants.js'
import { cleanId, cleanLevel, cleanText, cleanUrl } from './sanitize.js'
import { normalizeTemporalImagery } from './raster-time.js'
import { sendJson, sendText } from './http.js'
import { writeJsonAtomic } from './fs-util.js'

/**
 * Render-quality tiers accepted from the catalog. Kept in sync with
 * src/client/scene/quality.js by test/v16-quality.test.mjs.
 */
const QUALITY_MODES = new Set(['balanced', 'high'])

/** Maximum number of L3 raster overlays the catalog accepts (each is a GPU layer). */
const MAX_RASTER_OVERLAYS = 24
const WORLD_IMAGERY_ID = 'esri-world-imagery'
const WORLD_IMAGERY_URL = 'https://wi.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const LEGACY_WORLD_IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

/**
 * Built-in catalogs, used for a first run and for the "restore defaults"
 * action. Names are brand names rather than translated UI copy, so the same
 * value reads correctly in both locales.
 */
const DEFAULT_SOURCES = {
  imagery: [
    {
      id: WORLD_IMAGERY_ID,
      name: 'Esri World Imagery',
      type: 'xyz',
      url: WORLD_IMAGERY_URL,
      // wi.maptiles.arcgis.com serves WGS84 (EPSG:4326, 2x1 level-0 grid), not
      // Web Mercator; omitting this causes Cesium to request ocean tiles.
      tilingScheme: 'geographic',
      maximumLevel: 19,
      credit: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
    {
      id: 'esri-world-topo',
      name: 'Esri World Topographic',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
      credit: 'Esri, HERE, Garmin, FAO, NOAA, USGS, and the GIS User Community',
    },
    {
      id: 'esri-world-street',
      name: 'Esri World Street Map',
      type: 'arcgis',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer',
      credit: 'Esri, HERE, Garmin, USGS, NGA, and the GIS User Community',
    },
  ],
  terrain: [
    {
      id: 'arcgis-world-elevation',
      name: 'ArcGIS WorldElevation3D',
      type: 'arcgis',
      url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
      credit: 'Esri, CGIAR, USGS',
    },
  ],
  // L3 raster overlays: extra imagery layers above the basemap (business rasters,
  // WMS results, classification maps). Each entry is an imagery source plus an
  // opacity/visibility pair, so it reuses the same provider mapping.
  rasterOverlays: [],
  settings: {
    theme: 'auto',
    imagery: WORLD_IMAGERY_ID,
    terrain: null,
    screenshotHud: false,
    showLayers: true,
    showHud: true,
    // Render quality tier: 'balanced' trades a little sharpness for smoothness,
    // 'high' uses full resolution and Cesium's default LOD. See
    // src/client/scene/quality.js for the knob table.
    quality: 'balanced',
    // Off by default: underground pipes and buried models stay visible.
    terrainDepthTest: false,
    // HUD detail mode: off keeps the instrument at five numbers (FPS, cursor,
    // camera height); on restores heading/pitch and per-layer counters there.
    hudDetailed: false,
  },
}

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_SOURCES))

/**
 * The GeoTIFF tile route embeds the per-process host token. A catalog written
 * before a DSH restart holds the old token, so replace just that segment with
 * the current one; fileKey/renderKey (the cache identity) stay untouched.
 */
const GEO_TILES_URL = /^(https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?)\/api\/3dviewer\/geotiff\/[^/]+(\/tiles\/.+)$/
function refreshGeotiffToken(url) {
  // Loopback only. A catalog URL can point anywhere, and the token unlocks all
  // local routes; rewriting it into an external origin would leak the credential.
  const match = GEO_TILES_URL.exec(url)
  return match === null ? url : `${match[1]}${API}/geotiff/${TOKEN}${match[2]}`
}

function normalizeSource(kind, raw, index) {
  if (raw === null || typeof raw !== 'object') return null
  const type = cleanText(raw.type, 16).toLowerCase()
  if (!(kind === 'imagery' ? IMAGERY_TYPES : TERRAIN_TYPES).has(type)) return null
  let url = ''
  let temporal = null
  if (kind === 'imagery') {
    temporal = normalizeTemporalImagery(raw, type)
    if (!temporal.ok) return null
    url = refreshGeotiffToken(temporal.url)
  } else {
    url = cleanUrl(raw.url)
    if (url === '') return null
  }
  const source = {
    id: cleanId(raw.id, `${kind}-${index + 1}`),
    name: cleanText(raw.name, 60) || `${kind} ${index + 1}`,
    type,
    url,
  }
  const credit = cleanText(raw.credit, 200)
  if (credit !== '') source.credit = credit
  if (kind === 'imagery') {
    const maximumLevel = cleanLevel(raw.maximumLevel)
    if (maximumLevel !== undefined) source.maximumLevel = maximumLevel
    if (raw.tilingScheme === 'geographic' || raw.tilingScheme === 'web-mercator') source.tilingScheme = raw.tilingScheme
    if (raw.reverseY === true) source.reverseY = true
    const subdomains = Array.isArray(raw.subdomains)
      ? raw.subdomains.map((item) => cleanText(item, 8)).filter((item) => item !== '').slice(0, 8)
      : []
    if (subdomains.length > 0) source.subdomains = subdomains
    const layers = cleanText(raw.layers, 200)
    if (layers !== '') source.layers = layers
    if (temporal.frames) source.frames = temporal.frames
    if (temporal.times) source.times = temporal.times
  } else {
    if (raw.requestVertexNormals === true) source.requestVertexNormals = true
    if (raw.requestWaterMask === true) source.requestWaterMask = true
  }
  return source
}

function normalizeSourceList(kind, raw, fallback) {
  if (!Array.isArray(raw)) return fallback.map((source) => ({ ...source }))
  const limit = kind === 'imagery' ? MAX_IMAGERY_SOURCES : MAX_TERRAIN_SOURCES
  const seen = new Set()
  const sources = []
  for (const [index, item] of raw.slice(0, limit).entries()) {
    const source = normalizeSource(kind, item, index)
    if (source === null) continue
    while (seen.has(source.id)) source.id = `${source.id}-${sources.length + 1}`
    seen.add(source.id)
    sources.push(source)
  }
  return sources
}

/**
 * Normalize the L3 raster-overlay list: an overlay is an imagery source plus an
 * opacity (0..1) and a visibility flag. Invalid entries are dropped rather than
 * failing the whole catalog, and ids are de-duplicated the same way source lists
 * are, so a hand-edited sources.json cannot break the panel.
 */
function normalizeRasterOverlays(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const overlays = []
  for (const [index, item] of raw.slice(0, MAX_RASTER_OVERLAYS * 4).entries()) {
    if (overlays.length >= MAX_RASTER_OVERLAYS) break
    const source = normalizeSource('imagery', item, index)
    if (source === null) continue
    while (seen.has(source.id)) source.id = `${source.id}-${overlays.length + 1}`
    seen.add(source.id)
    const rawOpacity = item.opacity
    const opacity = Number.isFinite(rawOpacity) ? Math.min(1, Math.max(0, rawOpacity)) : 1
    overlays.push({ ...source, opacity, visible: item.visible !== false })
  }
  return overlays
}

/** Pick a stored selection id, but only when it still exists in the list. */
function cleanSelection(value, sources) {
  if (typeof value !== 'string') return null
  return sources.some((source) => source.id === value) ? value : null
}

/** Append built-in presets that the user has not seen yet (id-based, keeps order). */
function withBuiltins(list, builtins, limit) {
  const seen = new Set(list.map((source) => source.id))
  const merged = [...list]
  for (const source of builtins) {
    if (merged.length >= limit) break
    if (seen.has(source.id)) continue
    merged.push({ ...source })
  }
  return merged
}

/** Retired featureless stock Esri canvas/relief/ocean layers pruned during catalog upgrade. */
const RETIRED_STOCK_IMAGERY = new Map([
  ['esri-light-gray', 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer'],
  ['esri-shaded-relief', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer'],
  ['esri-world-ocean', 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer'],
  ['esri-world-hillshade', 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer'],
])

const normalizeImageryUrl = (url) => (typeof url === 'string' ? url.trim().replace(/\/+$/, '').toLowerCase() : '')

function pruneRetiredStockImagery(list, activeId) {
  return list.filter((source) => {
    if (source.id === activeId) return true
    const retiredUrl = RETIRED_STOCK_IMAGERY.get(source.id)
    if (!retiredUrl) return true
    return normalizeImageryUrl(source.url) !== normalizeImageryUrl(retiredUrl)
  })
}

function migrateStockImagery(source) {
  if (source.id !== WORLD_IMAGERY_ID || source.type !== 'xyz') return source
  const normalized = normalizeImageryUrl(source.url)
  if (
    normalized === normalizeImageryUrl(LEGACY_WORLD_IMAGERY_URL) ||
    normalized === normalizeImageryUrl(WORLD_IMAGERY_URL)
  ) {
    return { ...source, url: WORLD_IMAGERY_URL, tilingScheme: 'geographic' }
  }
  return source
}

/** Turn arbitrary request JSON into the catalog persisted on disk. */
export function normalizeConfig(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const theme = THEME_MODES.has(input.settings?.theme) ? input.settings.theme : 'auto'
  // The layer list and HUD default to visible; only an explicit false hides
  // them, so catalogs written by older versions keep both controls visible.
  const showLayers = input.settings?.showLayers !== false
  const showHud = input.settings?.showHud !== false
  // Render quality and terrain occlusion are client-side render choices, but the
  // catalog is the single persisted copy of the settings, so they must survive
  // normalization (dropping them here silently reset the user's choice).
  const quality = QUALITY_MODES.has(input.settings?.quality) ? input.settings.quality : 'balanced'
  const terrainDepthTest = input.settings?.terrainDepthTest === true
  // HUD detail is off unless explicitly enabled, so catalogs written by older
  // versions keep the five-number instrument.
  const hudDetailed = input.settings?.hudDetailed === true
  const imagery = withBuiltins(
    pruneRetiredStockImagery(
      normalizeSourceList('imagery', input.imagery, DEFAULT_SOURCES.imagery).map(migrateStockImagery),
      input.settings?.imagery,
    ),
    DEFAULT_SOURCES.imagery,
    MAX_IMAGERY_SOURCES,
  )
  const terrain = withBuiltins(
    normalizeSourceList('terrain', input.terrain, DEFAULT_SOURCES.terrain),
    DEFAULT_SOURCES.terrain,
    MAX_TERRAIN_SOURCES,
  )
  // A missing selection (older file, first run) falls back to the default choice;
  // an explicit `null` means "basemap/terrain deliberately off" and is preserved.
  const selection = (value, list, fallback) =>
    value === undefined ? cleanSelection(fallback, list) : cleanSelection(value, list)
  return {
    imagery,
    terrain,
    rasterOverlays: normalizeRasterOverlays(input.rasterOverlays),
    settings: {
      theme,
      imagery: selection(input.settings?.imagery, imagery, DEFAULT_SOURCES.settings.imagery),
      terrain: selection(input.settings?.terrain, terrain, DEFAULT_SOURCES.settings.terrain),
      screenshotHud: input.settings?.screenshotHud === true,
      showLayers,
      showHud,
      quality,
      terrainDepthTest,
      hudDetailed,
    },
  }
}


async function readSources() {
  let text
  try {
    text = await fs.readFile(SOURCES_FILE, 'utf8')
  } catch {
    return cloneDefaults()
  }
  try {
    return normalizeConfig(JSON.parse(text))
  } catch {
    return cloneDefaults()
  }
}

export async function sourcesHandler(req, res) {
  sendJson(res, 200, { config: await readSources(), defaults: cloneDefaults() })
}

/** PUT: replace the catalog, normalised so a malformed entry cannot reach Cesium. */
export async function saveSourcesHandler(req, res) {
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_SOURCES_BODY) {
        req.destroy()
        return sendText(res, 413, 'payload too large')
      }
    }
  } catch {
    return sendText(res, 400, 'bad request')
  }
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return sendText(res, 400, 'invalid json')
  }
  const config = normalizeConfig(parsed)
  try {
    await writeSources(config)
  } catch (error) {
    return sendText(res, 500, `save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  sendJson(res, 200, { config })
}

/** Replace the catalog atomically; see writeJsonAtomic for the rename rule. */
async function writeSources(config) {
  await writeJsonAtomic(SOURCES_FILE, config)
}
