/**
 * scene/initial-scene.js — explicit panel initialization with oblique view
 * and/or whitelisted raster layers (imagery basemap + rasterOverlays).
 *
 * Pure normalization, validation, degradation receipts, canonical idempotency
 * signatures, cold/warm coordination, and viewer application live here so
 * ViewerSurface stays well inside its line budget and every rule is directly
 * unit-testable in Node without a browser.
 */

export const RASTER_LAYER_TYPES = new Set(['xyz', 'arcgis', 'wms'])
export const MAX_INITIAL_RASTER_OVERLAYS = 24
export const DEFAULT_INITIAL_HEIGHT = 1500
export const DEFAULT_OBLIQUE_PITCH = -45
export const DEFAULT_INITIAL_HEADING = 0
export const MIN_INITIAL_HEIGHT = 1
export const MAX_INITIAL_HEIGHT = 40_000_000

const GLOBAL_SCENE_KEY = '__global__'

function cleanString(value, maxLength = 200) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function cleanId(value, fallback) {
  const raw = cleanString(value, 64).replace(/[^a-zA-Z0-9._-]/g, '-')
  return raw !== '' ? raw : fallback
}

function normalizeHeading(value) {
  const mod = ((value % 360) + 360) % 360
  return Object.is(mod, -0) ? 0 : mod
}

function isEventLike(value) {
  return (
    typeof value.preventDefault === 'function' ||
    typeof value.stopPropagation === 'function' ||
    'nativeEvent' in value ||
    'currentTarget' in value
  )
}

/**
 * True when `value` is an explicit scene-open options object (as opposed to
 * undefined, a sessionId string from HeaderButton, or a click event from
 * EarthToolRow).
 */
export function isSceneOpenOptions(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  if (isEventLike(value)) return false
  return (
    Object.hasOwn(value, 'view') ||
    Object.hasOwn(value, 'layers') ||
    Object.hasOwn(value, 'replaceScene') ||
    Object.hasOwn(value, 'initialScene')
  )
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed === '' || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

/**
 * Extract a serializable initial-scene payload from tab props, scope, or
 * `useTabInfo()` return values. Returns `null` when nothing was provided.
 */
export function extractInitialSceneParam(...candidates) {
  for (const raw of candidates) {
    if (raw === null || raw === undefined) continue
    const parsed = parseMaybeJson(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    if (isEventLike(parsed)) continue
    if (parsed.initialScene !== undefined && parsed.initialScene !== null) {
      const nested = parseMaybeJson(parsed.initialScene)
      if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) return nested
    }
    if (parsed.params !== undefined && parsed.params !== null) {
      const fromParams = extractInitialSceneParam(parsed.params)
      if (fromParams !== null) return fromParams
    }
    if (parsed.tab !== undefined && parsed.tab !== null) {
      const fromTab = extractInitialSceneParam(parsed.tab)
      if (fromTab !== null) return fromTab
    }
    if (parsed.scope !== undefined && parsed.scope !== null) {
      const fromScope = extractInitialSceneParam(parsed.scope)
      if (fromScope !== null) return fromScope
    }
    if (isSceneOpenOptions(parsed)) return parsed
  }
  return null
}

function validateRasterUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { ok: false, reason: 'missing_url', message: 'Layer url is required.' }
  }
  const url = rawUrl.trim()
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, reason: 'invalid_url', message: `Unsupported url scheme for raster layer: ${url}` }
  }
  try {
    // Allow tile template placeholders ({z}, {x}, {y}, {s}, {reverseY}, ...).
    new URL(url.replace(/\{[^}]+\}/g, '0'))
  } catch {
    return { ok: false, reason: 'invalid_url', message: `Malformed raster layer url: ${url}` }
  }
  return { ok: true, url }
}

function normalizeRasterEntry(raw, { target, fallbackId, fallbackName, isOverlay }, ignored) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    ignored.push({ target, reason: 'invalid_entry', message: 'Layer entry must be an object.' })
    return null
  }
  const rawId = typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim() : undefined
  const type = cleanString(raw.type, 24).toLowerCase()
  if (!RASTER_LAYER_TYPES.has(type)) {
    ignored.push({
      target,
      ...(rawId ? { id: rawId } : {}),
      reason: 'unknown_layer_type',
      message: type
        ? `Unsupported layer type "${type}"; only xyz, arcgis, and wms are allowed.`
        : 'Missing layer type; only xyz, arcgis, and wms are allowed.',
    })
    return null
  }
  const urlCheck = validateRasterUrl(raw.url)
  if (!urlCheck.ok) {
    ignored.push({
      target,
      ...(rawId ? { id: rawId } : {}),
      reason: urlCheck.reason,
      message: urlCheck.message,
    })
    return null
  }
  const entry = {
    id: cleanId(raw.id, fallbackId),
    name: cleanString(raw.name, 60) || fallbackName,
    type,
    url: urlCheck.url,
  }
  const credit = cleanString(raw.credit, 200)
  if (credit !== '') entry.credit = credit
  if (typeof raw.maximumLevel === 'number' && Number.isFinite(raw.maximumLevel) && raw.maximumLevel >= 0) {
    entry.maximumLevel = Math.min(24, Math.floor(raw.maximumLevel))
  }
  if (raw.tilingScheme === 'geographic' || raw.tilingScheme === 'web-mercator') {
    entry.tilingScheme = raw.tilingScheme
  }
  if (raw.reverseY === true) entry.reverseY = true
  if (Array.isArray(raw.subdomains)) {
    const subdomains = raw.subdomains.map((item) => cleanString(item, 8)).filter(Boolean).slice(0, 8)
    if (subdomains.length > 0) entry.subdomains = subdomains
  }
  const wmsLayers = cleanString(raw.layers, 200)
  if (wmsLayers !== '') entry.layers = wmsLayers
  if (isOverlay) {
    const rawOpacity = raw.opacity
    entry.opacity = typeof rawOpacity === 'number' && Number.isFinite(rawOpacity)
      ? Math.min(1, Math.max(0, rawOpacity))
      : 1
    entry.visible = raw.visible !== false
  }
  return entry
}

function normalizeView(raw, ignored) {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    ignored.push({ target: 'view', reason: 'invalid_coordinates', message: 'view must be an object containing lon and lat.' })
    return null
  }
  const lonValid = typeof raw.lon === 'number' && Number.isFinite(raw.lon) && raw.lon >= -180 && raw.lon <= 180
  const latValid = typeof raw.lat === 'number' && Number.isFinite(raw.lat) && raw.lat >= -90 && raw.lat <= 90
  if (!lonValid) {
    ignored.push({ target: 'view.lon', reason: 'invalid_coordinates', message: 'view.lon must be a finite number in [-180, 180].' })
  }
  if (!latValid) {
    ignored.push({ target: 'view.lat', reason: 'invalid_coordinates', message: 'view.lat must be a finite number in [-90, 90].' })
  }
  if (!lonValid || !latValid) return null

  let height = DEFAULT_INITIAL_HEIGHT
  if (raw.height !== undefined && raw.height !== null) {
    if (typeof raw.height === 'number' && Number.isFinite(raw.height) && raw.height >= MIN_INITIAL_HEIGHT && raw.height <= MAX_INITIAL_HEIGHT) {
      height = raw.height
    } else {
      ignored.push({
        target: 'view.height',
        reason: 'invalid_height',
        message: `view.height must be in [${MIN_INITIAL_HEIGHT}, ${MAX_INITIAL_HEIGHT}]; fell back to ${DEFAULT_INITIAL_HEIGHT}.`,
      })
    }
  }

  let heading = DEFAULT_INITIAL_HEADING
  if (raw.heading !== undefined && raw.heading !== null) {
    if (typeof raw.heading === 'number' && Number.isFinite(raw.heading)) {
      heading = normalizeHeading(raw.heading)
    } else {
      ignored.push({
        target: 'view.heading',
        reason: 'invalid_heading',
        message: `view.heading must be a finite number; fell back to ${DEFAULT_INITIAL_HEADING}.`,
      })
    }
  }

  let pitch = DEFAULT_OBLIQUE_PITCH
  if (raw.pitch !== undefined && raw.pitch !== null) {
    if (typeof raw.pitch === 'number' && Number.isFinite(raw.pitch) && raw.pitch >= -90 && raw.pitch <= 0) {
      pitch = raw.pitch
    } else {
      ignored.push({
        target: 'view.pitch',
        reason: 'invalid_pitch',
        message: `view.pitch must be a finite number in [-90, 0]; fell back to ${DEFAULT_OBLIQUE_PITCH}.`,
      })
    }
  }

  return { lon: raw.lon, lat: raw.lat, height, heading, pitch }
}

function normalizeLayers(raw, ignored) {
  let imagery = null
  const overlays = []
  const seenOverlayIds = new Set()

  const pushOverlay = (item, target, index) => {
    if (overlays.length >= MAX_INITIAL_RASTER_OVERLAYS) {
      ignored.push({
        target,
        ...(item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim() ? { id: item.id.trim() } : {}),
        reason: 'max_overlays_exceeded',
        message: `At most ${MAX_INITIAL_RASTER_OVERLAYS} raster overlays are supported.`,
      })
      return
    }
    const normalized = normalizeRasterEntry(
      item,
      { target, fallbackId: `init-overlay-${index + 1}`, fallbackName: `Overlay ${index + 1}`, isOverlay: true },
      ignored,
    )
    if (normalized === null) return
    let id = normalized.id
    let suffix = 2
    while (seenOverlayIds.has(id)) {
      id = `${normalized.id}-${suffix}`
      suffix += 1
    }
    normalized.id = id
    seenOverlayIds.add(id)
    overlays.push(normalized)
  }

  if (Array.isArray(raw)) {
    raw.forEach((item, index) => {
      const target = `layers[${index}]`
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        ignored.push({ target, reason: 'invalid_entry', message: 'Layer entry must be an object.' })
        return
      }
      const role = cleanString(item.role ?? item.kind, 24).toLowerCase()
      const explicitOverlay = role === 'overlay' || role === 'rasteroverlay' || role === 'raster-overlay'
      const explicitImagery = role === 'imagery' || role === 'basemap'
      if (!explicitOverlay && (explicitImagery || imagery === null)) {
        const candidate = normalizeRasterEntry(
          item,
          { target, fallbackId: `init-imagery-${index + 1}`, fallbackName: 'Initial Basemap', isOverlay: false },
          ignored,
        )
        if (candidate !== null) {
          if (imagery === null) imagery = candidate
          else pushOverlay(item, target, index)
        }
        return
      }
      pushOverlay(item, target, index)
    })
    return { imagery, rasterOverlays: overlays }
  }

  if (raw !== null && typeof raw === 'object') {
    if (raw.imagery !== undefined && raw.imagery !== null) {
      if (typeof raw.imagery === 'string') {
        const id = raw.imagery.trim()
        if (id !== '') imagery = { catalogId: id }
        else ignored.push({ target: 'layers.imagery', reason: 'invalid_entry', message: 'layers.imagery id must not be empty.' })
      } else {
        imagery = normalizeRasterEntry(
          raw.imagery,
          { target: 'layers.imagery', fallbackId: 'init-imagery', fallbackName: 'Initial Basemap', isOverlay: false },
          ignored,
        )
      }
    }
    if (raw.rasterOverlays !== undefined && raw.rasterOverlays !== null) {
      if (!Array.isArray(raw.rasterOverlays)) {
        ignored.push({ target: 'layers.rasterOverlays', reason: 'invalid_entry', message: 'layers.rasterOverlays must be an array.' })
      } else {
        raw.rasterOverlays.forEach((item, index) => {
          pushOverlay(item, `layers.rasterOverlays[${index}]`, index)
        })
      }
    }
    return { imagery, rasterOverlays: overlays }
  }

  ignored.push({ target: 'layers', reason: 'invalid_entry', message: 'layers must be an object or array.' })
  return { imagery: null, rasterOverlays: [] }
}

/**
 * Validate and normalize caller-supplied initial scene options. Never throws.
 */
export function normalizeInitialScene(rawOptions, fallbackSessionId = null) {
  const ignored = []
  const unwrapped = parseMaybeJson(rawOptions)
  const input =
    unwrapped !== null && typeof unwrapped === 'object' && !Array.isArray(unwrapped)
      ? unwrapped.initialScene && typeof unwrapped.initialScene === 'object'
        ? { ...unwrapped.initialScene, sessionId: unwrapped.sessionId ?? unwrapped.initialScene.sessionId }
        : unwrapped
      : null

  if (input === null) {
    if (rawOptions !== undefined && rawOptions !== null) {
      ignored.push({ target: 'options', reason: 'invalid_entry', message: 'Initial scene options must be an object.' })
    }
    return {
      active: false,
      sessionId: typeof fallbackSessionId === 'string' && fallbackSessionId.trim() !== '' ? fallbackSessionId.trim() : null,
      view: null,
      layers: null,
      hasLayers: false,
      replaceScene: false,
      rasterOnly: false,
      skipSnapshot: false,
      fallbackBasemap: false,
      ignored,
      signature: '',
    }
  }

  const rawSession = input.sessionId ?? fallbackSessionId
  const sessionId = typeof rawSession === 'string' && rawSession.trim() !== '' ? rawSession.trim() : null
  const hasView = input.view !== undefined && input.view !== null
  const hasLayers = input.layers !== undefined && input.layers !== null
  const explicitReplace = typeof input.replaceScene === 'boolean' ? input.replaceScene : null
  const view = hasView ? normalizeView(input.view, ignored) : null
  const layers = hasLayers ? normalizeLayers(input.layers, ignored) : null
  const rasterOnly = hasLayers
  const replaceScene = explicitReplace !== null ? explicitReplace : rasterOnly
  const skipSnapshot = replaceScene || rasterOnly
  const fallbackBasemap = (rasterOnly && layers.imagery === null) || (!rasterOnly && replaceScene)
  const active = hasView || hasLayers || explicitReplace === true

  const canonical = active
    ? {
        sessionId,
        view,
        layers,
        replaceScene,
        rasterOnly,
        skipSnapshot,
      }
    : null

  return {
    active,
    sessionId,
    view,
    layers,
    hasLayers,
    replaceScene,
    rasterOnly,
    skipSnapshot,
    fallbackBasemap,
    ignored,
    signature: canonical ? JSON.stringify(canonical) : '',
  }
}

/**
 * Build an in-memory catalog projection for a raster-initialized scene without
 * mutating or persisting the user's global `sources.json`.
 */
export function buildInitialRasterCatalog(baseConfig, defaultsConfig, normalized) {
  const safeBase = baseConfig && typeof baseConfig === 'object' ? baseConfig : { imagery: [], terrain: [], rasterOverlays: [], settings: {} }
  const safeDefaults = defaultsConfig && typeof defaultsConfig === 'object' ? defaultsConfig : safeBase
  const fallbackImageryId =
    safeDefaults.settings?.imagery ??
    safeBase.settings?.imagery ??
    safeDefaults.imagery?.[0]?.id ??
    safeBase.imagery?.[0]?.id ??
    null

  if (!normalized || (!normalized.hasLayers && !normalized.replaceScene)) {
    return {
      config: safeBase,
      activeImageryId: safeBase.settings?.imagery ?? fallbackImageryId,
      fallbackImageryId,
      rasterOverlays: Array.isArray(safeBase.rasterOverlays) ? safeBase.rasterOverlays : [],
      fallbackBasemap: false,
    }
  }

  const baseImagery = Array.isArray(safeBase.imagery) ? safeBase.imagery : []
  const defaultImagery = Array.isArray(safeDefaults.imagery) ? safeDefaults.imagery : []
  const mergedImagery = baseImagery.map((item) => ({ ...item }))
  for (const item of defaultImagery) {
    if (!mergedImagery.some((existing) => existing.id === item.id)) mergedImagery.push({ ...item })
  }

  let activeImageryId = fallbackImageryId
  let fallbackBasemap = true
  const requestedImagery = normalized.layers?.imagery ?? null

  if (requestedImagery !== null) {
    if (typeof requestedImagery.catalogId === 'string') {
      const found = mergedImagery.find(
        (item) => item.id === requestedImagery.catalogId || item.name === requestedImagery.catalogId,
      )
      if (found) {
        activeImageryId = found.id
        fallbackBasemap = false
      }
    } else {
      const idx = mergedImagery.findIndex((item) => item.id === requestedImagery.id)
      if (idx >= 0) mergedImagery[idx] = { ...requestedImagery }
      else mergedImagery.unshift({ ...requestedImagery })
      activeImageryId = requestedImagery.id
      fallbackBasemap = false
    }
  }

  const rasterOverlays = Array.isArray(normalized.layers?.rasterOverlays)
    ? normalized.layers.rasterOverlays.map((item) => ({ ...item }))
    : []

  const config = {
    ...safeBase,
    imagery: mergedImagery,
    rasterOverlays,
    settings: {
      ...(safeBase.settings ?? {}),
      imagery: activeImageryId,
      terrain: null,
    },
  }

  return { config, activeImageryId, fallbackImageryId, rasterOverlays, fallbackBasemap }
}

/**
 * Apply a normalized initial scene to a live Cesium viewer (used on both cold
 * mount and warm re-open). Clears historical 3D/vector/analysis/shader state
 * whenever `skipSnapshot` is true, applies whitelisted raster layers with
 * default-basemap fallback, and positions the camera to the oblique `view`.
 */
export async function applyInitialSceneToViewer(deps, normalized) {
  if (!normalized?.active) return { applied: false, fallbackBasemap: false }
  const {
    Cesium,
    viewer,
    baseConfig,
    defaultsConfig,
    setRestoring,
    clearLiveScene,
    setInMemorySources,
    applyImagery,
    syncOverlays,
    clearTerrain,
    markApplied,
  } = deps

  setRestoring?.(true)
  let fallbackBasemap = normalized.fallbackBasemap
  try {
    if (normalized.skipSnapshot) {
      clearLiveScene?.()
    }

    if (normalized.hasLayers || normalized.replaceScene) {
      const plan = buildInitialRasterCatalog(baseConfig, defaultsConfig, normalized)
      fallbackBasemap = plan.fallbackBasemap
      setInMemorySources?.(plan.config)
      clearTerrain?.()
      let outcome = await applyImagery(plan.activeImageryId, false)
      if (!outcome?.ok && plan.fallbackImageryId && plan.fallbackImageryId !== plan.activeImageryId) {
        fallbackBasemap = true
        setInMemorySources?.({
          ...plan.config,
          settings: { ...plan.config.settings, imagery: plan.fallbackImageryId },
        })
        outcome = await applyImagery(plan.fallbackImageryId, false)
      }
      await syncOverlays(plan.rasterOverlays)
    }

    if (normalized.view !== null && Cesium && viewer?.camera) {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          normalized.view.lon,
          normalized.view.lat,
          normalized.view.height,
        ),
        orientation: {
          heading: Cesium.Math.toRadians(normalized.view.heading),
          pitch: Cesium.Math.toRadians(normalized.view.pitch),
          roll: 0,
        },
      })
    }

    markApplied?.(normalized.signature)
    return { applied: true, fallbackBasemap }
  } finally {
    setRestoring?.(false)
  }
}

function publicSceneSummary(normalized) {
  return {
    view: normalized.view ? { ...normalized.view } : null,
    layers: normalized.layers
      ? {
          imagery: normalized.layers.imagery ? { ...normalized.layers.imagery } : null,
          rasterOverlays: normalized.layers.rasterOverlays.map((item) => ({ ...item })),
        }
      : null,
    replaceScene: normalized.replaceScene,
    rasterOnly: normalized.rasterOnly,
  }
}

/**
 * Coordinates cold-open pending requests and warm-open mounted viewers so
 * repeated calls with identical parameters are idempotent (focus only, never
 * stacking duplicate tabs or leaking stale 3D content).
 */
export function createInitialSceneCoordinator() {
  const pending = new Map()
  const viewers = new Set()

  function findMountedViewer(sessionId) {
    let fallback = null
    for (const entry of viewers) {
      const currentSession = entry.getSessionId?.() ?? null
      if (sessionId !== null && currentSession === sessionId) return entry
      if (sessionId === null && currentSession !== null) fallback = entry
      else if (fallback === null) fallback = entry
    }
    return fallback
  }

  return {
    registerViewer(controller) {
      viewers.add(controller)
      return () => {
        viewers.delete(controller)
      }
    },

    clearPending(sessionId = null) {
      if (sessionId !== null) pending.delete(sessionId)
      pending.delete(GLOBAL_SCENE_KEY)
    },

    peekPending(sessionId = null) {
      if (typeof sessionId === 'string' && sessionId !== '' && pending.has(sessionId)) {
        return pending.get(sessionId)
      }
      return pending.get(GLOBAL_SCENE_KEY) ?? null
    },

    consumePending(sessionId = null) {
      if (typeof sessionId === 'string' && sessionId !== '' && pending.has(sessionId)) {
        const value = pending.get(sessionId)
        pending.delete(sessionId)
        return value
      }
      if (pending.has(GLOBAL_SCENE_KEY)) {
        const value = pending.get(GLOBAL_SCENE_KEY)
        pending.delete(GLOBAL_SCENE_KEY)
        return value
      }
      return null
    },

    dispatch(rawOptions, openTabFn = () => false) {
      const normalized = normalizeInitialScene(rawOptions)
      const matched = normalized.active ? findMountedViewer(normalized.sessionId) : null

      if (!normalized.active) {
        const opened = Boolean(openTabFn(normalized))
        return {
          ok: true,
          opened,
          reused: false,
          fallbackBasemap: false,
          scene: publicSceneSummary(normalized),
          ignored: normalized.ignored,
        }
      }

      if (matched !== null) {
        const reused = Boolean(matched.isIdempotentMatch?.(normalized.signature))
        const opened = Boolean(openTabFn(normalized))
        if (!reused) {
          void Promise.resolve(matched.apply?.(normalized)).catch(() => {})
        }
        return {
          ok: true,
          opened,
          reused,
          fallbackBasemap: normalized.fallbackBasemap,
          scene: publicSceneSummary(normalized),
          ignored: normalized.ignored,
        }
      }

      const key = normalized.sessionId ?? GLOBAL_SCENE_KEY
      pending.set(key, normalized)
      const opened = Boolean(openTabFn(normalized))
      return {
        ok: true,
        opened,
        reused: false,
        fallbackBasemap: normalized.fallbackBasemap,
        scene: publicSceneSummary(normalized),
        ignored: normalized.ignored,
      }
    },
  }
}

export const initialSceneCoordinator = createInitialSceneCoordinator()
