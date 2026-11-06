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
import { shaderGaussianLayer } from '../shader/presets.js'

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
    if (shaderGaussianLayer(layer.tileset)) {
      gaussianOnly = true
      continue
    }
    return { layer, auto: true }
  }
  return { layer: null, auto: true, gaussianOnly }
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
export function createWorkbenchWiring({ getForm, getLayers, setShaderForm, shaderCommand, showToast, t, shaderCompare }) {
  const field = (key, value) => setShaderForm((form) => ({ ...form, [key]: value }))
  const formLayer = () => getLayers().find((layer) => layer.id === getForm().layerId) ?? null
  const target = () => resolveWorkbenchTarget(getLayers(), getForm())
  let applyTimer = null
  let applying = false
  let queued = false
  let lastSilentError = ''

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

  return {
    /** Set one form field (layerId / numeric inputs). */
    field,
    /** Toggle a preset chip in the stack. */
    toggle: (preset) => setShaderForm((form) => toggleShaderPreset(form, preset)),
    /** Reorder one preset inside the stack (the array order is the compose order). */
    move: (preset, delta) => setShaderForm((form) => moveShaderPreset(form, preset, delta)),
    /** The layer the card should show under "automatic selection". */
    target,
    /** Debounced silent apply for slider previews; repeated calls merge into one. */
    preview: () => {
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
