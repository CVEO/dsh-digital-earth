/**
 * shader/presets.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */

    //#region shader core ------------------------------------------------------
    // B3 shader presets. The model and the workbench can only pick from this
    // white list; no arbitrary GLSL ever reaches Cesium. Every preset modifies
    // only the fragment material (diffuse/alpha), so lighting and geometry stay
    // untouched and a broken shader cannot corrupt the scene.
    const SHADER_PRESETS = ['height-false-color', 'contour', 'scan', 'water', 'water-depth']
    /** D-17: at most three presets may be stacked into one composed shader. */
    const SHADER_MAX_STACK = 3
    /** Hard cap from the B3 contract: one preset source stays well under 8 KB. */
    const SHADER_SOURCE_LIMIT = 8 * 1024
    const SHADER_HEIGHT_FLOOR = -1000
    const SHADER_HEIGHT_CEILING = 9000
    const SHADER_PARAM_LIMITS = {
      min_height: [-1000, 9000],
      max_height: [-1000, 9000],
      interval: [1, 500],
      speed: [0.1, 10],
      amplitude: [0.1, 5],
      opacity: [0.05, 1],
      water_height: [-1000, 9000],
      depth_max: [0.5, 500],
    }
    const SHADER_PRESET_PARAMS = {
      'height-false-color': ['min_height', 'max_height'],
      contour: ['interval'],
      scan: ['speed'],
      water: ['speed', 'amplitude', 'opacity'],
      'water-depth': ['water_height', 'depth_max'],
    }
    const SHADER_PRESET_DEFAULTS = {
      'height-false-color': {},
      contour: { interval: 20 },
      scan: { speed: 1 },
      water: { speed: 1, amplitude: 1, opacity: 0.75 },
      'water-depth': { water_height: 0, depth_max: 50 },
    }

    const shaderClamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum)
    const shaderFinite = (value) => typeof value === 'number' && Number.isFinite(value)
    /** All failures are model-facing: one `shader:` prefix and one actionable `next:`. */
    const shaderFail = (message, next) => new Error(`shader: ${message} next: ${next}`)

    /**
     * Normalise bridge arguments against the frozen B3 contract. Returns either a
     * request object or an Error carrying the model-facing message (never throws),
     * so both runCommand and the workbench share exactly one validation path.
     */
    function shaderValidateRequest(args = {}) {
      const raw = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
      const action = typeof raw.action === 'string' ? raw.action.trim() : ''
      if (action !== 'apply' && action !== 'reset' && action !== 'list') {
        return shaderFail(`不支持的操作 "${String(raw.action)}"。`, '使用 apply / reset / list。')
      }
      if (raw.layer !== undefined && raw.layer !== null && typeof raw.layer !== 'string') {
        return shaderFail('layer 必须是图层名或 id 字符串。', '传入字符串后重试。')
      }
      const layer = typeof raw.layer === 'string' && raw.layer.trim() !== '' ? raw.layer.trim() : null
      const keys = Object.keys(raw).filter((key) => key !== 'action')

      if (action === 'list') {
        if (keys.length > 0) return shaderFail(`list 不接受参数 "${keys[0]}"。`, '只传 action: "list"。')
        return { operation: 'list' }
      }
      if (action === 'reset') {
        const extra = keys.filter((key) => key !== 'layer')
        if (extra.length > 0) return shaderFail(`reset 不接受参数 "${extra[0]}"。`, 'reset 只接受 action 与可选的 layer。')
        return { operation: 'reset', layer }
      }

      // D-17: `preset` may also be an ordered array of 1..3 presets and is then
      // composed into one shader (each preset's fragment body gets its own block
      // scope so local variable names cannot collide).
      const rawPresets = Array.isArray(raw.preset) ? raw.preset : typeof raw.preset === 'string' ? [raw.preset] : []
      const presets = rawPresets.map((item) => (typeof item === 'string' ? item.trim() : ''))
      if (presets.length === 0 || presets.length > SHADER_MAX_STACK) {
        return shaderFail(
          `preset 需要 1..${SHADER_MAX_STACK} 个预设，实际 ${presets.length} 个。`,
          '传入一个预设字符串，或 1..3 个预设的数组（按顺序叠加）。',
        )
      }
      for (const preset of presets) {
        if (!SHADER_PRESETS.includes(preset)) {
          return shaderFail(
            `不支持的预设 "${String(preset)}"。`,
            '使用 height-false-color / contour / scan / water / water-depth。',
          )
        }
      }
      if (new Set(presets).size !== presets.length) {
        return shaderFail('预设不能重复。', '每个预设只列一次；顺序即叠加顺序。')
      }
      const allowedParams = new Set(presets.flatMap((preset) => SHADER_PRESET_PARAMS[preset]))
      const allowed = new Set(['preset', 'layer', ...allowedParams])
      const extra = keys.filter((key) => !allowed.has(key))
      if (extra.length > 0) {
        return shaderFail(
          `预设 ${presets.join(' + ')} 不接受参数 "${extra[0]}"。`,
          `只使用 ${['preset', 'layer', ...allowedParams].join(', ')}。`,
        )
      }
      const params = {}
      for (const preset of presets) Object.assign(params, SHADER_PRESET_DEFAULTS[preset])
      for (const key of allowedParams) {
        const value = raw[key]
        if (value === undefined || value === null) continue
        if (!shaderFinite(value)) return shaderFail(`参数 ${key} 必须是有限数字。`, '传入数字后重试。')
        const [minimum, maximum] = SHADER_PARAM_LIMITS[key]
        if (value < minimum || value > maximum) {
          return shaderFail(`参数 ${key}=${value} 超出 ${minimum}..${maximum}。`, '调整到合法范围后重试。')
        }
        params[key] = value
      }
      if (
        presets.includes('height-false-color') &&
        params.min_height !== undefined &&
        params.max_height !== undefined &&
        !(params.min_height < params.max_height)
      ) {
        return shaderFail('min_height 必须小于 max_height。', '调整两个高度后重试。')
      }
      return {
        operation: 'apply',
        preset: presets.length === 1 ? presets[0] : presets,
        presets,
        layer,
        params,
      }
    }

    /** ext list detection: Cesium 1.147 keeps tileset JSON extensions in `_extensionsUsed`. */
    function shaderTilesetExtensions(tileset) {
      const lists = [tileset?.extensionsUsed, tileset?._extensionsUsed, tileset?.root?.extensionsUsed]
      const values = []
      for (const list of lists) {
        if (!Array.isArray(list)) continue
        for (const item of list) {
          if (typeof item === 'string' && !values.includes(item)) values.push(item)
        }
      }
      return values
    }

    /** 3DGS splats have no per-vertex GLSL material Cesium.CustomShader can edit. */
    function shaderGaussianLayer(tileset) {
      if (shaderTilesetExtensions(tileset).includes('KHR_gaussian_splatting')) return true
      if (typeof tileset?.hasExtension === 'function') {
        try {
          return tileset.hasExtension('KHR_gaussian_splatting') === true
        } catch {
          return false
        }
      }
      return false
    }

    /**
     * Relative height on the dataset: |positionWC| - |centre| + centreHeight is a
     * tangent-plane approximation that works for any tileset orientation. The
     * default range comes from the bounding sphere; the contract fallback is 0..200.
     */
    function shaderHeightRange(Cesium, tileset, fallbackCenter) {
      let center =
        tileset?.boundingSphere?.center ?? tileset?.root?.boundingSphere?.center ?? fallbackCenter ?? null
      if (!center) center = Cesium.Cartesian3.fromDegrees(0, 0, 0)
      let centerHeight = 0
      try {
        const carto = Cesium.Cartographic.fromCartesian(center)
        if (carto && shaderFinite(carto.height)) centerHeight = carto.height
      } catch {
        centerHeight = 0
      }
      const rawRadius = Number(tileset?.boundingSphere?.radius ?? tileset?.root?.boundingSphere?.radius)
      const radius = shaderFinite(rawRadius) ? Math.abs(rawRadius) : 0
      let minimum = 0
      let maximum = 0
      if (radius > 0) {
        minimum = shaderClamp(centerHeight - radius, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING)
        maximum = shaderClamp(centerHeight + radius, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING)
      }
      // Contract fallback when there is no usable bounding volume: a zero-radius
      // (point-like) sphere also uses 0..200, exactly as the frozen contract says.
      // User-supplied min_height/max_height still override this range later.
      if (!(maximum > minimum)) {
        minimum = 0
        maximum = 200
      }
      return { center, centerHeight, minimum, maximum, estimated: radius > 0 }
    }

    /** Per-preset uniform map; every value is finite and inside the contract bounds. */
    function shaderUniforms(Cesium, preset, params, range) {
      const presets = Array.isArray(preset) ? preset : [preset]
      const uniforms = {
        u_center: { type: Cesium.UniformType.VEC3, value: range.center },
        u_centerHeight: { type: Cesium.UniformType.FLOAT, value: range.centerHeight },
      }
      if (presets.includes('height-false-color') || presets.includes('scan')) {
        uniforms.u_minHeight = { type: Cesium.UniformType.FLOAT, value: range.minimum }
        uniforms.u_maxHeight = { type: Cesium.UniformType.FLOAT, value: range.maximum }
      }
      if (presets.includes('contour')) {
        uniforms.u_interval = { type: Cesium.UniformType.FLOAT, value: params.interval ?? 20 }
      }
      if (presets.includes('scan') || presets.includes('water')) {
        uniforms.u_speed = { type: Cesium.UniformType.FLOAT, value: params.speed ?? 1 }
        uniforms.u_time = { type: Cesium.UniformType.FLOAT, value: 0 }
      }
      if (presets.includes('water')) {
        uniforms.u_amplitude = { type: Cesium.UniformType.FLOAT, value: params.amplitude ?? 1 }
        uniforms.u_opacity = { type: Cesium.UniformType.FLOAT, value: params.opacity ?? 0.75 }
      }
      if (presets.includes('water-depth')) {
        uniforms.u_waterHeight = { type: Cesium.UniformType.FLOAT, value: params.water_height ?? 0 }
        uniforms.u_depthMax = { type: Cesium.UniformType.FLOAT, value: params.depth_max ?? 50 }
      }
      return uniforms
    }

    /**
     * Compose one 1..3 preset shader. A single preset returns its original source
     * unchanged (so per-preset contracts stay byte-identical); stacked presets run
     * in array order, each fragment body wrapped in its own block scope so local
     * variables (height/span/band/ripple…) cannot collide, and the composed source
     * is still checked against the 8 KB whitelist limit.
     */
    function shaderFragmentSource(preset) {
      const presets = Array.isArray(preset) ? preset : [preset]
      const original = (item) => {
        const source = SHADER_FRAGMENT_SOURCES[item]
        if (typeof source !== 'string' || source.length === 0 || source.length > SHADER_SOURCE_LIMIT) {
          throw shaderFail(`预设 ${String(item)} 的着色器源码无效。`, '联系面板维护者检查预设定义。')
        }
        return source
      }
      if (presets.length === 1) return original(presets[0])
      const blocks = presets.map((item) => {
        const source = original(item)
        const match = /void fragmentMain\(FragmentInput fsInput, inout czm_modelMaterial material\) \{([\s\S]*)\}\s*$/.exec(source)
        if (!match) {
          throw shaderFail(`预设 ${item} 的着色器结构无效。`, '联系面板维护者检查预设定义。')
        }
        return `  // ${item}\n  {${match[1]}}`
      })
      const composed = `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {\n${blocks.join('\n')}\n}`
      if (composed.length > SHADER_SOURCE_LIMIT) {
        throw shaderFail(`叠加后的着色器源码超过 ${SHADER_SOURCE_LIMIT} 字节。`, '减少叠加的预设数量。')
      }
      return composed
    }

    // Fragments only touch `material.diffuse` / `material.alpha`. Cesium declares
    // the uniforms from the CustomShader uniform map, so they are never re-declared
    // here; `fsInput.attributes.positionWC` is auto-wired by Cesium when referenced.
    const SHADER_FRAGMENT_SOURCES = {
      'height-false-color': `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float span = max(u_maxHeight - u_minHeight, 1.0);
  float t = clamp((height - u_minHeight) / span, 0.0, 1.0);
  vec3 low = vec3(0.16, 0.36, 0.86);
  vec3 midLow = vec3(0.20, 0.78, 0.36);
  vec3 mid = vec3(0.96, 0.90, 0.22);
  vec3 midHigh = vec3(0.98, 0.56, 0.14);
  vec3 high = vec3(0.92, 0.18, 0.16);
  vec3 ramp = t < 0.25
    ? mix(low, midLow, t / 0.25)
    : t < 0.5
      ? mix(midLow, mid, (t - 0.25) / 0.25)
      : t < 0.75
        ? mix(mid, midHigh, (t - 0.5) / 0.25)
        : mix(midHigh, high, (t - 0.75) / 0.25);
  material.diffuse = mix(material.diffuse, ramp, 0.85);
}`,
      contour: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float spacing = max(u_interval, 1.0);
  float band = fract(height / spacing);
  float edge = min(band, 1.0 - band);
  float line = 1.0 - smoothstep(0.0, 0.08, edge);
  vec3 contourColor = vec3(0.98, 0.84, 0.28);
  material.diffuse = mix(material.diffuse, contourColor, line);
}`,
      scan: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float span = max(u_maxHeight - u_minHeight, 1.0);
  float t = clamp((height - u_minHeight) / span, 0.0, 1.0);
  float sweep = fract(u_time * max(u_speed, 0.1) * 0.12);
  float distanceToBand = abs(t - sweep);
  float band = 1.0 - smoothstep(0.0, 0.05, distanceToBand);
  vec3 scanColor = vec3(0.32, 0.95, 1.0);
  material.diffuse = mix(material.diffuse * 0.6, scanColor, band);
}`,
      water: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float waveA = sin(height * 0.35 + u_time * u_speed * 1.6);
  float waveB = sin(height * 0.72 - u_time * u_speed * 2.4);
  float ripple = clamp(0.5 + (waveA * 0.35 + waveB * 0.15) * u_amplitude, 0.0, 1.0);
  vec3 waterColor = mix(vec3(0.03, 0.16, 0.38), vec3(0.24, 0.62, 0.92), ripple);
  material.diffuse = mix(material.diffuse, waterColor, u_opacity);
  material.alpha = mix(material.alpha, 0.92, u_opacity * 0.5);
}`,
      // D-17: colour geometry by how deep it sits below a chosen water plane; the
      // depth ramp is fixed (never user-supplied color) so the whitelist stays intact.
      'water-depth': `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float depth = u_waterHeight - height;
  float t = clamp(depth / max(u_depthMax, 0.5), 0.0, 1.0);
  float submerged = step(0.0, depth);
  vec3 shallow = vec3(0.36, 0.78, 0.96);
  vec3 deep = vec3(0.02, 0.10, 0.38);
  material.diffuse = mix(material.diffuse, mix(shallow, deep, t), submerged * 0.9);
  material.alpha = mix(material.alpha, 1.0, submerged * 0.35);
}`,
    }
    //#endregion shader core

export { SHADER_PRESETS, SHADER_MAX_STACK, SHADER_SOURCE_LIMIT, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING, SHADER_PARAM_LIMITS, SHADER_PRESET_PARAMS, SHADER_PRESET_DEFAULTS, shaderClamp, shaderFinite, shaderFail, shaderValidateRequest, shaderTilesetExtensions, shaderGaussianLayer, shaderHeightRange, shaderUniforms, shaderFragmentSource, SHADER_FRAGMENT_SOURCES }
