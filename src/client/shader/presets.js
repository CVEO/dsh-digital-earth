/**
 * shader/presets.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */

import { cachedElevationRange } from './elevation-range.js'

    //#region shader core ------------------------------------------------------
    // B3 shader presets. The model and the workbench can only pick from this
    // white list; no arbitrary GLSL ever reaches Cesium. Every preset modifies
    // only the fragment material (diffuse/alpha), so lighting and geometry stay
    // untouched and a broken shader cannot corrupt the scene.
    const SHADER_PRESETS = ['height-false-color', 'contour', 'scan', 'water', 'water-depth']
    /**
     * Contract-compatibility grouping only: the workbench now offers the four
     * primary looks. `contour` stays in the tool whitelist (frozen preset enum)
     * but is no longer presented in the UI — on a 3D mesh it renders as jagged
     * bands, so the meeting asked to drop it from the product surface.
     */
    const SHADER_PRIMARY_PRESETS = ['height-false-color', 'scan', 'water', 'water-depth']
    const SHADER_ADVANCED_PRESETS = ['contour']
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

    /**
     * Whether two preset selections (string or ordered array) are the same stack.
     * Used by the engine to update uniforms of an already-compiled CustomShader
     * instead of rebuilding it while the user drags a slider.
     */
    function samePresetStack(left, right) {
      const a = Array.isArray(left) ? left : left === null || left === undefined ? [] : [left]
      const b = Array.isArray(right) ? right : right === null || right === undefined ? [] : [right]
      if (a.length !== b.length) return false
      for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false
      return true
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

    /**
     * 3DGS splats have no per-vertex GLSL material Cesium.CustomShader can edit.
     * `layer.kind` is set by the load-time content inspection (v1.5.2): a dataset
     * can declare KHR_gaussian_splatting inside its GLBs only, where the tileset
     * extension list never shows it.
     */
    function shaderGaussianLayer(tileset, layer = null) {
      if (layer !== null && typeof layer === 'object' && layer.kind === '3dgs') return true
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
     * Real vertical extent of a tileset when the root bounding volume exposes one.
     *
     * Photogrammetry tilesets usually carry a region volume with explicit min/max
     * heights, or an oriented box whose up-axis support equals the height half-range.
     * Using that extent makes the elevation ramp span the actual data instead of the
     * bounding-sphere radius, which is dominated by the horizontal size and used to
     * collapse every surface into one flat colour.
     */
    function shaderTilesetExtent(Cesium, tileset) {
      const root = tileset?.root
      const volume = root?.boundingVolume
      if (!volume) return null
      if (shaderFinite(volume.minimumHeight) && shaderFinite(volume.maximumHeight) && volume.maximumHeight > volume.minimumHeight) {
        return { minimum: volume.minimumHeight, maximum: volume.maximumHeight }
      }
      const obb = volume.obb ?? root?._boundingVolume?.obb
      if (obb?.center && obb?.halfAxes && typeof Cesium?.Matrix3?.getColumn === 'function') {
        try {
          const up = Cesium.Cartesian3.normalize(Cesium.Cartesian3.clone(obb.center), new Cesium.Cartesian3())
          const column = new Cesium.Cartesian3()
          let support = 0
          for (let index = 0; index < 3; index += 1) {
            Cesium.Matrix3.getColumn(obb.halfAxes, index, column)
            support += Math.abs(Cesium.Cartesian3.dot(column, up))
          }
          const centerHeight = Cesium.Cartographic.fromCartesian(obb.center)?.height
          if (shaderFinite(centerHeight) && support > 0.5) {
            return { minimum: centerHeight - support, maximum: centerHeight + support }
          }
        } catch {
          // A malformed/unknown bounding volume simply falls back to the sphere.
        }
      }
      return null
    }

    /**
     * Relative height on the dataset: |positionWC| - |centre| + centreHeight is a
     * tangent-plane approximation that works for any tileset orientation. The range
     * prefers the root bounding volume's real vertical extent; otherwise it comes
     * from the bounding sphere, and the contract fallback is 0..200.
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
      const extent = cachedElevationRange(tileset) ?? shaderTilesetExtent(Cesium, tileset)
      if (extent) {
        const minimum = shaderClamp(extent.minimum, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING)
        const maximum = shaderClamp(extent.maximum, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING)
        if (maximum > minimum) return { center, centerHeight, minimum, maximum, estimated: true, bounds: true }
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
        uniforms.u_waterMask = { type: Cesium.UniformType.FLOAT, value: presets.includes('water-depth') ? 1 : 0 }
        uniforms.u_waterHeight = { type: Cesium.UniformType.FLOAT, value: params.water_height ?? 0 }
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
    //
    // Art direction: a muted perceptual ramp + baked-shading modulation keeps the
    // photogrammetry detail readable, contour/water use cool "instrument" palettes
    // instead of flat paint, and every effect stays within one fragment pass.
    const SHADER_FRAGMENT_SOURCES = {
      'height-false-color': `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float span = max(u_maxHeight - u_minHeight, 1.0);
  float t = clamp((height - u_minHeight) / span, 0.0, 1.0);
  // Deep indigo -> cyan -> mint -> amber -> coral: a modern elevation ramp that
  // stays legible on both dark and light imagery.
  vec3 c0 = vec3(0.09, 0.14, 0.40);
  vec3 c1 = vec3(0.08, 0.49, 0.70);
  vec3 c2 = vec3(0.24, 0.80, 0.60);
  vec3 c3 = vec3(0.99, 0.79, 0.32);
  vec3 c4 = vec3(0.94, 0.36, 0.30);
  vec3 ramp = t < 0.25
    ? mix(c0, c1, t / 0.25)
    : t < 0.5
      ? mix(c1, c2, (t - 0.25) / 0.25)
      : t < 0.75
        ? mix(c2, c3, (t - 0.5) / 0.25)
        : mix(c3, c4, (t - 0.75) / 0.25);
  // Photogrammetry textures already bake in roof/wall shading; reusing their
  // luminance keeps the volume that a flat colour would erase.
  float lum = clamp(dot(material.diffuse, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  ramp *= 0.74 + 0.52 * lum;
  // Faint topographic bands: readable as elevation without looking like a poster.
  float shade = abs(fract(t * 8.0) - 0.5) * 2.0;
  ramp *= 0.95 + 0.05 * shade;
  material.diffuse = mix(material.diffuse, ramp, 0.72);
}`,
      contour: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float spacing = max(u_interval, 1.0);
  float band = fract(height / spacing);
  float edge = min(band, 1.0 - band);
  // Two line weights: a crisp 1x grid plus a brighter 5x "major" contour.
  float minor = 1.0 - smoothstep(0.0, 0.050, edge);
  float majorBand = fract(height / (spacing * 5.0));
  float majorEdge = min(majorBand, 1.0 - majorBand);
  float major = 1.0 - smoothstep(0.0, 0.022, majorEdge);
  // Cool instrument tint instead of a yellow wash; imagery detail stays visible.
  float tint = 0.5 + 0.5 * sin(height * 0.0026);
  vec3 base = mix(vec3(0.07, 0.15, 0.26), vec3(0.13, 0.30, 0.40), tint);
  vec3 lineColor = mix(vec3(0.62, 0.86, 1.0), vec3(0.97, 1.0, 1.0), major);
  material.diffuse = mix(material.diffuse, base, 0.22);
  material.diffuse = mix(material.diffuse, lineColor, clamp(minor * 0.5 + major * 0.5, 0.0, 1.0));
}`,
      scan: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float span = max(u_maxHeight - u_minHeight, 1.0);
  float t = clamp((height - u_minHeight) / span, 0.0, 1.0);
  // Aligned with the 1.5 sweep: one full pass in ~8 s, a band about 5% of the
  // height span, so the moving stripe is obvious from the default camera.
  float sweep = fract(u_time * max(u_speed, 0.1) * 0.12);
  float distanceToBand = abs(t - sweep);
  float band = 1.0 - smoothstep(0.0, 0.045, distanceToBand);
  float glow = exp(-distanceToBand * 18.0);
  vec3 scanTint = mix(vec3(0.12, 0.62, 0.86), vec3(0.72, 1.0, 0.94), band);
  // Dim the surface a little so the bright band reads as a live instrument sweep,
  // but keep enough baked detail to place the swept height in context.
  material.diffuse *= 0.72;
  material.diffuse = mix(material.diffuse, scanTint, clamp(glow * 0.45 + band * 0.55, 0.0, 1.0));
}`,
      water: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  vec3 local = fsInput.attributes.positionWC - u_center;
  vec3 up = normalize(u_center);
  vec3 east = normalize(cross(vec3(0.0, 0.0, 1.0), up) + vec3(0.00001, 0.0, 0.0));
  vec3 north = cross(up, east);
  // Position in metres, scaled down ~0.06: the ripples are ~50-100 m long, so they
  // stay visible from a city overview instead of collapsing into one flat colour.
  vec2 position = vec2(dot(local, east), dot(local, north)) * 0.06;
  float time = u_time * max(u_speed, 0.1) * 0.9;
  float w1 = sin(dot(position, vec2(1.7, 0.65)) - time);
  float w2 = sin(dot(position, vec2(-0.8, 2.1)) - time * 0.73);
  float w3 = sin(dot(position, vec2(3.1, 1.8)) + time * 1.13);
  float detail = (w1 * 0.5 + w2 * 0.3 + w3 * 0.2) * (u_amplitude / (1.0 + u_amplitude)) * 3.0;
  // fwidth(position) is metres per pixel: the 50-100 m waves fade out between 5 and
  // 40 m/px so a close-up view loses the texture instead of shimmering.
  float footprint = max(length(fwidth(position)), 0.01);
  float fade = 1.0 - smoothstep(5.0, 40.0, footprint);
  float ripple = detail * fade;
  // The default amplitude (1) must already read as moving water, not a flat tint:
  // crest swings across most of the ramp and a stronger glint marks the wave tops.
  float crest = clamp(0.5 + ripple * 0.5, 0.0, 1.0);
  vec3 waterColor = mix(vec3(0.015, 0.12, 0.22), vec3(0.13, 0.42, 0.50), crest);
  float glint = pow(clamp(ripple, 0.0, 1.0), 3.0) * 0.32;
  waterColor += vec3(0.55, 0.75, 0.77) * glint;
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float coverage = mix(1.0, 1.0 - smoothstep(u_waterHeight - 0.3, u_waterHeight + 0.3, height), u_waterMask);
  material.diffuse = mix(material.diffuse, waterColor, u_opacity * coverage * 0.72);
}`,
      // D-17: colour geometry by how deep it sits below a chosen water plane; the
      // depth ramp is fixed (never user-supplied color) so the whitelist stays intact.
      'water-depth': `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float depth = u_waterHeight - height;
  float t = clamp(depth / max(u_depthMax, 0.5), 0.0, 1.0);
  float submerged = smoothstep(-0.8, 0.8, depth);
  vec3 shallow = vec3(0.46, 0.94, 0.93);
  vec3 mid = vec3(0.10, 0.52, 0.72);
  vec3 deep = vec3(0.02, 0.07, 0.22);
  vec3 ramp = t < 0.5 ? mix(shallow, mid, t / 0.5) : mix(mid, deep, (t - 0.5) / 0.5);
  // Faint depth bands every 20% of the ramp plus a brighter shoreline edge.
  float bands = abs(fract(t * 5.0) - 0.5) * 2.0;
  ramp *= 0.93 + 0.07 * bands;
  float shore = 1.0 - smoothstep(0.0, 0.035, abs(depth) / max(u_depthMax, 0.5));
  ramp = mix(ramp, vec3(0.86, 1.0, 1.0), shore * 0.5);
  material.diffuse = mix(material.diffuse, ramp, submerged * 0.86);
  material.alpha = mix(material.alpha, 1.0, submerged * 0.35);
}`,
    }
    //#endregion shader core

export { SHADER_PRESETS, SHADER_PRIMARY_PRESETS, SHADER_ADVANCED_PRESETS, SHADER_MAX_STACK, samePresetStack, SHADER_SOURCE_LIMIT, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING, SHADER_PARAM_LIMITS, SHADER_PRESET_PARAMS, SHADER_PRESET_DEFAULTS, shaderClamp, shaderFinite, shaderFail, shaderValidateRequest, shaderTilesetExtensions, shaderGaussianLayer, shaderTilesetExtent, shaderHeightRange, shaderUniforms, shaderFragmentSource, SHADER_FRAGMENT_SOURCES }
