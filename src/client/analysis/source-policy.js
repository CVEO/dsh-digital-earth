/**
 * analysis/source-policy.js — which height source and layer one analysis run uses.
 *
 * v1.5.2 contract: exactly one height source per run. profile/skyline accept
 * "tiles" (3D Tiles surface; mesh only) or "terrain"; flood accepts "terrain"
 * (strict ground) or "surface" (explicit approximation). A 3DGS layer has no
 * sampleable surface height and is never picked silently. Extracted from the
 * analysis engine to keep that file inside its line budget.
 */
const allowedSourcesFor = (operation) => (operation === 'flood' ? ['terrain', 'surface'] : ['tiles', 'terrain'])

export function resolveAnalysisTarget({ operation, args = {}, layers = [], findLayer }) {
  const heightOperation = operation === 'profile' || operation === 'flood' || operation === 'skyline'
  let source = ''
  let nextArgs = args
  if (heightOperation) {
    const rawSource = typeof args.source === 'string' ? args.source.trim() : ''
    const allowedSources = allowedSourcesFor(operation)
    if (rawSource !== '' && !allowedSources.includes(rawSource)) {
      throw new Error(
        `analysis: source "${rawSource}" 不适用于 ${operation}。next: 使用 ${allowedSources.map((item) => `"${item}"`).join(' 或 ')}。`,
      )
    }
    source = rawSource !== '' ? rawSource : operation === 'flood' ? 'terrain' : 'tiles'
    nextArgs = { ...args, source }
  }
  let layer = null
  if (heightOperation && source === 'terrain') {
    // Terrain-only runs do not need a 3D Tiles layer at all; a layer that happens
    // to be loaded must not leak its surface heights into the run.
    layer = null
  } else {
    const requested = typeof args.layer === 'string' ? args.layer.trim() : ''
    if (requested !== '') {
      layer = findLayer(requested)
      if (!layer) {
        throw new Error(`analysis: 未找到图层 "${requested}"。next: 用 earth_scene 的 list 动作查看当前图层名。`)
      }
      if (source !== '' && source !== 'terrain' && layer.kind === '3dgs') {
        throw new Error(
          'analysis: [unsupported_layer] 3DGS 图层不提供可采样的表面高程。next: 选择 source="terrain" 并加载地形，或改用 mesh 3D Tiles 图层。',
        )
      }
    } else if (heightOperation) {
      // tiles/surface mode needs a visible mesh layer; a 3DGS layer cannot supply
      // surface heights and must not be picked silently.
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        const candidate = layers[index]
        if (candidate.visible && candidate.kind !== '3dgs') {
          layer = candidate
          break
        }
      }
      if (layer === null) {
        throw new Error(
          'analysis: [no_height_data] 当前没有可用于高程采样的 mesh 3D Tiles 图层（3DGS 不提供表面高程）。next: 加载 mesh 3D Tiles，或改用 source="terrain" 并先加载地形。',
        )
      }
    } else {
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        if (layers[index].visible) {
          layer = layers[index]
          break
        }
      }
    }
  }
  return { args: nextArgs, source, layer }
}
