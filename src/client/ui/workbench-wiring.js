/**
 * ui/workbench-wiring.js — the shader workbench's connection to the bridge.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2 (the component was at its line
 * budget). The card itself (`ShaderWorkbench` in cards.js) stays presentational;
 * this module owns the form→bridge mapping:
 *   - preset chips toggle an ordered stack of 1..3 (never empty, max three);
 *   - `form` numbers become bridge params only for presets present in the stack;
 *   - apply/reset call the panel's `shaderCommand` and report through `showToast`.
 *
 * The pure helpers are exported so the mapping is unit-testable without React.
 */
import { shaderGaussianLayer, shaderHeightRange } from '../shader/presets.js'

/**
 * Toggle one preset in the form's stack. `form.preset` is a string for a single
 * preset or an ordered array for a stack; clicking the last selected chip is
 * ignored so the form always keeps at least one preset.
 */
export function toggleShaderPreset(form, preset) {
  const current = Array.isArray(form.preset) ? form.preset : [form.preset]
  const next = current.includes(preset)
    ? current.filter((item) => item !== preset)
    : current.length >= 3
      ? current
      : [...current, preset]
  if (next.length === 0) return form
  return { ...form, preset: next.length === 1 ? next[0] : next }
}

/** Turn the workbench form into a bridge-shaped `apply` argument object. */
export function buildShaderFormArgs(form) {
  const selected = Array.isArray(form.preset) ? form.preset : [form.preset]
  const args = { action: 'apply', preset: selected.length === 1 ? selected[0] : selected }
  if (form.layerId) args.layer = form.layerId
  const readNumber = (key) => (form[key] === '' ? undefined : Number(form[key]))
  const has = (preset) => selected.includes(preset)
  if (has('height-false-color')) {
    const minimum = readNumber('minHeight')
    const maximum = readNumber('maxHeight')
    if (minimum !== undefined) args.min_height = minimum
    if (maximum !== undefined) args.max_height = maximum
  }
  if (has('contour')) {
    const interval = readNumber('interval')
    if (interval !== undefined) args.interval = interval
  }
  if (has('scan') || has('water')) {
    const speed = readNumber('speed')
    if (speed !== undefined) args.speed = speed
  }
  if (has('water')) {
    const amplitude = readNumber('amplitude')
    const opacity = readNumber('opacity')
    if (amplitude !== undefined) args.amplitude = amplitude
    if (opacity !== undefined) args.opacity = opacity
  }
  if (has('water-depth')) {
    const waterHeight = readNumber('waterHeight')
    const depthMax = readNumber('depthMax')
    if (waterHeight !== undefined) args.water_height = waterHeight
    if (depthMax !== undefined) args.depth_max = depthMax
  }
  return args
}

/** Move one preset inside the ordered stack (±1). Unknown/edge moves are no-ops. */
export function moveShaderPreset(form, preset, delta) {
  const current = Array.isArray(form.preset) ? [...form.preset] : [form.preset]
  const from = current.indexOf(preset)
  const to = from + delta
  if (from < 0 || to < 0 || to >= current.length) return form
  current.splice(from, 1)
  current.splice(to, 0, preset)
  return { ...form, preset: current.length === 1 ? current[0] : current }
}

/**
 * Resolve which layer the workbench will act on: an explicit choice wins, otherwise
 * the topmost visible non-3DGS layer (the same auto rule the engine applies).
 */
export function resolveWorkbenchTarget(layers, form) {
  const list = Array.isArray(layers) ? layers : []
  const explicit = form.layerId ? list.find((layer) => layer.id === form.layerId) ?? null : null
  if (explicit) return { layer: explicit, auto: false }
  let gaussianOnly = false
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const layer = list[index]
    if (!layer.visible) continue
    if (shaderGaussianLayer(layer.tileset, layer)) {
      gaussianOnly = true
      continue
    }
    return { layer, auto: true }
  }
  const layer = { layer: null, auto: true, gaussianOnly }
  return layer
}

/** Partition layers into shader-eligible visible mesh layers and skipped counts. */
export function eligibleShaderLayers(layers) {
  const list = Array.isArray(layers) ? layers : []
  const eligible = []
  let skippedHidden = 0
  let skippedGaussian = 0
  for (const layer of list) {
    if (!layer || layer.visible === false) {
      if (layer) skippedHidden += 1
      continue
    }
    if (shaderGaussianLayer(layer.tileset, layer)) {
      skippedGaussian += 1
      continue
    }
    eligible.push(layer)
  }
  return { eligible, skippedHidden, skippedGaussian }
}

/**
 * Derive one shared min/max height range across multiple mesh layers when the
 * user has not locked explicit bounds, so adjacent blocks keep uniform colors.
 */
export function combinedShaderElevationRange(Cesium, layers, form, heightRangeFn = shaderHeightRange) {
  const selected = Array.isArray(form?.preset) ? form.preset : [form?.preset]
  if (!selected.includes('height-false-color')) return null
  if (form?.minHeight !== '' || form?.maxHeight !== '') return null
  if (!Cesium || !Array.isArray(layers) || layers.length < 2) return null
  const ranges = []
  for (const layer of layers) {
    try {
      const range = heightRangeFn(Cesium, layer.tileset, null)
      if (Number.isFinite(range?.minimum) && Number.isFinite(range?.maximum) && range.maximum > range.minimum) {
        ranges.push(range)
      }
    } catch {
      /* ignore layers without usable bounds */
    }
  }
  if (ranges.length === 0) return null
  const bounded = ranges.filter((range) => range.bounds === true)
  const pool = bounded.length > 0 ? bounded : ranges
  let minimum = Infinity
  let maximum = -Infinity
  for (const range of pool) {
    if (range.minimum < minimum) minimum = range.minimum
    if (range.maximum > maximum) maximum = range.maximum
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || !(maximum > minimum)) return null
  return { min_height: minimum, max_height: maximum }
}

/** Bridge param names -> workbench form fields. */
export const SHADER_PARAM_FORM_KEYS = {
  min_height: 'minHeight',
  max_height: 'maxHeight',
  interval: 'interval',
  speed: 'speed',
  amplitude: 'amplitude',
  opacity: 'opacity',
  water_height: 'waterHeight',
  depth_max: 'depthMax',
}

/** Blank form values, shared by the component state and the "edit existing" loader. */
export const SHADER_FORM_DEFAULTS = {
  layerId: '',
  preset: 'height-false-color',
  minHeight: '',
  maxHeight: '',
  interval: '20',
  speed: '1',
  amplitude: '1',
  opacity: '0.75',
  waterHeight: '',
  depthMax: '',
}

/**
 * Turn an active shader entry (layer + ordered presets + saved params) back into the
 * workbench form, so clicking a shader row in the layer panel edits that exact effect.
 */
export function formFromShaderEntry(entry) {
  const selected = Array.isArray(entry?.preset) ? [...entry.preset] : entry?.preset ? [entry.preset] : []
  const preset = selected.length > 0 ? (selected.length === 1 ? selected[0] : selected) : SHADER_FORM_DEFAULTS.preset
  const form = { ...SHADER_FORM_DEFAULTS, layerId: typeof entry?.layerId === 'string' ? entry.layerId : '', preset }
  for (const [param, key] of Object.entries(SHADER_PARAM_FORM_KEYS)) {
    const value = entry?.params?.[param]
    if (typeof value === 'number' && Number.isFinite(value)) form[key] = String(value)
  }
  return form
}

/**
 * Human-readable parameter summary for the layer-panel hover tooltip.
 * Unknown/absent params are skipped, so the tooltip matches the applied stack.
 */
export function shaderEntrySummary(t, entry) {
  const presets = Array.isArray(entry?.preset) ? entry.preset : entry?.preset ? [entry.preset] : []
  const parts = []
  for (const [param, key] of Object.entries(SHADER_PARAM_FORM_KEYS)) {
    const value = entry?.params?.[param]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    parts.push(`${t(`shader.param.${key}`)} ${value}`)
  }
  const presetText = presets.map((item) => t(`shader.preset.${item}`)).join(' + ')
  return t('shader.entryTooltip', {
    layer: entry?.layer ?? '',
    presets: presetText,
    params: parts.join(' · ') || t('shader.entryNoParams'),
  })
}

/** `contour + scan` style label for a preset or a stack. */
export function shaderStackLabel(t, preset) {
  return (Array.isArray(preset) ? preset : [preset]).map((item) => t(`shader.preset.${item}`)).join(' + ')
}

/**
 * @param {object} deps
 * @param {Function} deps.getForm () => current shader form
 * @param {Function} deps.getLayers () => current 3D Tiles layer list
 * @param {Function} deps.setShaderForm React state setter for the form
 * @param {Function} deps.shaderCommand bridge entry: apply / reset / list
 * @param {Function} deps.showToast (text) => void
 * @param {Function} deps.t translate function
 */
export function createWorkbenchWiring({
  getForm,
  getLayers,
  setShaderForm,
  shaderCommand,
  showToast,
  t,
  shaderCompare,
  getScene,
  openLocal,
  openRecent,
  openUrl,
  pickLocalTiles,
}) {
  const field = (key, value) => setShaderForm((form) => ({ ...form, [key]: value }))
  const formLayer = () => getLayers().find((layer) => layer.id === getForm().layerId) ?? null
  const target = () => resolveWorkbenchTarget(getLayers(), getForm())
  let applyTimer = null
  let applying = false
  let queued = false
  let lastSilentError = ''
  let disposed = false

  const runApply = async (silent) => {
    try {
      const result = await shaderCommand(buildShaderFormArgs(getForm()))
      if (!silent) showToast(t('toast.shaderApplied', { preset: shaderStackLabel(t, result.preset), layer: result.layer }))
      lastSilentError = ''
      return result
    } catch (error) {
      const text = messageOf(error)
      // A dragged slider can fail the same validation on every tick; only report a
      // changed error, and always report an explicit apply.
      if (!silent || text !== lastSilentError) showToast(text)
      lastSilentError = silent ? text : ''
      return null
    }
  }

  async function applyAllInternal(overrideForm = null) {
    const { eligible, skippedHidden, skippedGaussian } = eligibleShaderLayers(getLayers())
    if (eligible.length === 0) {
      showToast(skippedGaussian > 0 && skippedHidden === 0 ? t('shaderSync.gaussianOnly') : t('shader.noLayers'))
      return { applied: [], skippedHidden, skippedGaussian, failed: [] }
    }
    const activeForm = overrideForm ?? getForm()
    const baseArgs = buildShaderFormArgs(activeForm)
    delete baseArgs.layer
    const sharedRange = combinedShaderElevationRange(getScene?.()?.Cesium ?? null, eligible, activeForm)
    if (sharedRange) Object.assign(baseArgs, sharedRange)
    const applied = []
    const failed = []
    let lastPreset = baseArgs.preset
    for (const layer of eligible) {
      try {
        const result = await shaderCommand({ ...baseArgs, layer: layer.id })
        applied.push(layer.name)
        if (result?.preset) lastPreset = result.preset
      } catch (error) {
        failed.push({ layer: layer.name, error: messageOf(error) })
      }
    }
    if (applied.length > 0 && failed.length === 0) {
      const skipped = skippedHidden + skippedGaussian
      const presetText = shaderStackLabel(t, lastPreset)
      showToast(
        skipped > 0
          ? t('shaderSync.doneSkipped', { preset: presetText, n: applied.length, skipped })
          : t('shaderSync.done', { preset: presetText, n: applied.length }),
      )
    } else if (applied.length > 0) {
      showToast(t('shaderSync.partial', { ok: applied.length, fail: failed.length }))
    } else if (failed.length > 0) {
      showToast(failed[0].error)
    }
    return { applied, skippedHidden, skippedGaussian, failed }
  }

  return {
    activate() { disposed = false },
    dispose() { disposed = true; clearTimeout(applyTimer); applyTimer = null; queued = false },
    /** Set one form field (layerId / numeric inputs). */
    field,
    /** Toggle a preset chip in the stack. */
    toggle: (preset) => setShaderForm((form) => toggleShaderPreset(form, preset)),
    /** Reorder one preset inside the stack (the array order is the compose order). */
    move: (preset, delta) => setShaderForm((form) => moveShaderPreset(form, preset, delta)),
    /** The layer the card should show under "automatic selection". */
    target,
    /** Load an applied shader row into the form (edit-in-place). */
    loadEntry: (entry) => setShaderForm(formFromShaderEntry(entry)),
    /** Apply the current workbench stack (or an explicit form) to all visible mesh layers. */
    async applyAll(overrideForm = null) {
      if (disposed) return { applied: [], skippedHidden: 0, skippedGaussian: 0, failed: [] }
      if (applyTimer !== null) {
        clearTimeout(applyTimer)
        applyTimer = null
      }
      return await applyAllInternal(overrideForm)
    },
    /** Load an existing active layer effect into the workbench and sync it to all visible mesh layers. */
    async syncEntryToAll(entry) {
      if (!entry || disposed) return null
      const nextForm = formFromShaderEntry(entry)
      setShaderForm(nextForm)
      if (applyTimer !== null) {
        clearTimeout(applyTimer)
        applyTimer = null
      }
      return await applyAllInternal(nextForm)
    },
    /** Open local 3D directory picker from the 3D layer tab. */
    openLocal: (...args) => openLocal?.(...args),
    /** Re-open a recently authorised directory from the 3D layer tab. */
    openRecent: (...args) => openRecent?.(...args),
    /** Open the online/local address bar from the 3D layer tab. */
    openUrl: (...args) => openUrl?.(...args),
    /** Pick a local XYZ tile pyramid folder from the Map tab. */
    pickLocalTiles: (...args) => pickLocalTiles?.(...args),
    /** Reset one specific layer's shader (used by the layer-panel row ✕). */
    async resetLayerFor(token) {
      try {
        const result = await shaderCommand({ action: 'reset', layer: token })
        showToast(result.layer ? t('toast.shaderReset', { layer: result.layer }) : t('toast.shaderResetAll'))
      } catch (error) {
        showToast(messageOf(error))
      }
    },
    /** Debounced silent apply for slider previews; repeated calls merge into one. */
    preview: () => {
      if (disposed) return
      if (applyTimer !== null) clearTimeout(applyTimer)
      applyTimer = setTimeout(() => {
        applyTimer = null
        void applyInternal(true)
      }, 180)
    },
    async apply() {
      if (applyTimer !== null) {
        clearTimeout(applyTimer)
        applyTimer = null
      }
      await applyInternal(false)
    },
    /** Hold/release the original-look comparison. Closes itself if it cannot run. */
    async compare(enabled) {
      try {
        const resolved = target()
        if (!resolved.layer) {
          showToast(t('shader.noLayers'))
          return null
        }
        return await shaderCompare(resolved.layer.id, enabled)
      } catch (error) {
        showToast(messageOf(error))
        return null
      }
    },
    async resetLayer() {
      try {
        const visible = getLayers().filter((layer) => layer.visible)
        const resolved = target().layer ?? formLayer() ?? visible[visible.length - 1] ?? null
        if (!resolved) {
          showToast(t('shader.noLayers'))
          return
        }
        const result = await shaderCommand({ action: 'reset', layer: resolved.id })
        showToast(result.layer ? t('toast.shaderReset', { layer: result.layer }) : t('toast.shaderResetAll'))
      } catch (error) {
        showToast(messageOf(error))
      }
    },
    async resetAll() {
      try {
        await shaderCommand({ action: 'reset' })
        showToast(t('toast.shaderResetAll'))
      } catch (error) {
        showToast(messageOf(error))
      }
    },
  }

  /** Serialise applies so rapid slider previews never interleave two shader builds. */
  async function applyInternal(silent) {
    if (disposed) return
    if (applying) {
      queued = true
      return
    }
    applying = true
    try {
      await runApply(silent)
    } finally {
      applying = false
    }
    if (queued) {
      queued = false
      await applyInternal(silent)
    }
  }
}

/** Local copy so this module does not pull the whole format/i18n graph. */
function messageOf(error) {
  return error && typeof error.message === 'string' && error.message !== '' ? error.message : String(error)
}

/**
 * Translate a `/scan` or local-path error into task-language copy:
 *   - 403 / forbidden -> directory not authorised or token expired;
 *   - 404 / folder not found -> path unreadable on the Host machine;
 *   - 400 / root / UNC -> unsupported root or network share;
 *   - anything else -> fallback `toast.scanFailed`.
 */
export function formatScanFailure(t, error) {
  const status = error?.status
  const raw = `${error?.detail ?? ''} ${messageOf(error)}`
  if (status === 403 || /\b403\b|forbidden|access_denied|not been opened/i.test(raw)) {
    return t('toast.scanForbidden')
  }
  if (status === 404 || /\b404\b|folder not found|ENOENT|does not exist/i.test(raw)) {
    return t('toast.scanNotFound')
  }
  if (status === 400 || /\b400\b|filesystem root|UNC path|network share|not a folder/i.test(raw)) {
    return t('toast.scanInvalidDir')
  }
  return t('toast.scanFailed', { message: messageOf(error) })
}

/**
 * Local directory picker, remembered-folder loader and multi-tileset scan handoff.
 * Extracted from ViewerSurface so the 3D tab, Map tab, Data menu and empty overlay
 * share one implementation and ViewerSurface stays below its line budget.
 */
export function createLocalDirectoryWiring({
  metaRef,
  getWorkspace,
  scanLocalDirectory,
  addTileset,
  joinLocalPath,
  b64url,
  folderName,
  setRecentDirs,
  setScan,
  setBusy,
  setOpenMenu,
  showToast,
  t,
}) {
  const itemLabel = (name) => String(name ?? '').split(/[\\/]/).filter(Boolean).slice(-2).join('/')

  const handleScannedItems = async (dir, data) => {
    const items = Array.isArray(data?.items) ? data.items : []
    if (items.length === 0) {
      showToast(t('toast.scanEmpty'))
      return
    }
    if (items.length === 1 && (!data?.truncated || String(items[0]?.name ?? '').toLowerCase() === 'tileset.json')) {
      const [item] = items
      await addTileset(item.url, itemLabel(item.name), {
        kind: 'local',
        path: joinLocalPath(dir, item.name),
      })
      return
    }
    setScan({ dir, items, truncated: Boolean(data?.truncated), limit: data?.limit })
  }

  const refreshRecentDirs = async () => {
    const url = metaRef.current?.directoriesUrl
    if (typeof url !== 'string' || url === '') return
    try {
      const response = await fetch(url, { credentials: 'same-origin' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const list = Array.isArray(data?.directories) ? data.directories : []
      const entries = []
      for (const entry of list) {
        const dir = typeof entry === 'string' ? entry : entry?.path
        if (typeof dir !== 'string' || dir === '') continue
        entries.push({ dir, name: typeof entry?.name === 'string' && entry.name !== '' ? entry.name : folderName(dir) })
        if (entries.length >= 5) break
      }
      setRecentDirs(entries)
    } catch (error) {
      setRecentDirs([])
      showToast(formatScanFailure(t, error))
    }
  }

  async function openRecentDirectory(dir) {
    setOpenMenu(null)
    setBusy(t('toast.busyDirectory'))
    try {
      const data = await scanLocalDirectory(metaRef.current, dir)
      void refreshRecentDirs()
      await handleScannedItems(dir, data)
    } catch (error) {
      showToast(formatScanFailure(t, error))
    } finally {
      setBusy('')
    }
  }

  async function pickLocal() {
    setOpenMenu(null)
    const workspace = getWorkspace()
    if (!workspace) {
      showToast(t('toast.dialogUnavailable'))
      return
    }
    setBusy(t('toast.busyDirectory'))
    try {
      const dir = await workspace.pickDirectory()
      if (!dir) return
      const data = await scanLocalDirectory(metaRef.current, dir)
      void refreshRecentDirs()
      await handleScannedItems(dir, data)
    } catch (error) {
      showToast(formatScanFailure(t, error))
    } finally {
      setBusy('')
    }
  }

  async function pickLocalTiles(options = {}) {
    const workspace = getWorkspace()
    if (!workspace) {
      showToast(t('toast.dialogUnavailable'))
      return null
    }
    try {
      const dir = await workspace.pickDirectory()
      if (!dir) return null
      await scanLocalDirectory(metaRef.current, dir)
      void refreshRecentDirs()
      const folder = dir.replace(/\\/g, '/').replace(/\/+$/, '')
      const url = `${metaRef.current.tilesBase}${encodeURIComponent(b64url(folder))}/{z}/{x}/{y}.png`
      return options?.withMeta ? { url, name: folderName(folder) } : url
    } catch (error) {
      showToast(formatScanFailure(t, error))
      return null
    }
  }

  return { refreshRecentDirs, openRecentDirectory, pickLocal, pickLocalTiles }
}
