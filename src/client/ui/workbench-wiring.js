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
export function createWorkbenchWiring({ getForm, getLayers, setShaderForm, shaderCommand, showToast, t }) {
  const field = (key, value) => setShaderForm((form) => ({ ...form, [key]: value }))
  const formLayer = () => getLayers().find((layer) => layer.id === getForm().layerId) ?? null

  return {
    /** Set one form field (layerId / numeric inputs). */
    field,
    /** Toggle a preset chip in the stack. */
    toggle: (preset) => setShaderForm((form) => toggleShaderPreset(form, preset)),
    async apply() {
      try {
        const result = await shaderCommand(buildShaderFormArgs(getForm()))
        showToast(t('toast.shaderApplied', { preset: shaderStackLabel(t, result.preset), layer: result.layer }))
      } catch (error) {
        showToast(messageOf(error))
      }
    },
    async resetLayer() {
      try {
        const visible = getLayers().filter((layer) => layer.visible)
        const target = formLayer() ?? visible[visible.length - 1] ?? null
        if (!target) {
          showToast(t('shader.noLayers'))
          return
        }
        const result = await shaderCommand({ action: 'reset', layer: target.id })
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
}

/** Local copy so this module does not pull the whole format/i18n graph. */
function messageOf(error) {
  return error && typeof error.message === 'string' && error.message !== '' ? error.message : String(error)
}
