/**
 * scene/shader-engine.js — the four whitelisted 3D Tiles look presets.
 *
 * Dependencies are injected (lazy ref getters + the two state refs + the layer
 * resolver), so the module never holds a stale viewer across panel remounts.
 */
import { samePresetStack, shaderFail, shaderFragmentSource, shaderHeightRange, SHADER_PRESETS, shaderGaussianLayer, shaderUniforms, shaderValidateRequest } from '../shader/presets.js'
import { message } from '../format.js'

const comparisonSessions = new WeakMap()

/**
 * @param {object} deps
 * @param {Function} deps.getCesium () => Cesium namespace
 * @param {Function} deps.getViewer () => current Cesium.Viewer
 * @param {Function} deps.getLayers () => current 3D Tiles layer list
 * @param {Function} deps.findLayer (token) => layer | null
 * @param {object}   deps.entries   ref: layer id -> shader entry
 * @param {object}   deps.tickRef   ref: { viewer, tick } | null
 * @param {Function} deps.setShaderActive React state setter for the workbench list
 */
export function createShaderEngine(deps) {
  // Same-name shims keep the moved block byte-for-byte identical to the old one.
  const cesiumRef = { get current() { return deps.getCesium() } }
  const viewerRef = { get current() { return deps.getViewer() } }
  const layersRef = { get current() { return deps.getLayers() } }
  const findLayer = deps.findLayer
  const shaderEntriesRef = deps.entries
  const shaderTickRef = deps.tickRef
  const setShaderActive = deps.setShaderActive
  /** layer id -> { original } while the workbench previews the un-shaded look. */
  if (!comparisonSessions.has(shaderEntriesRef)) comparisonSessions.set(shaderEntriesRef, new Map())
  const comparisons = comparisonSessions.get(shaderEntriesRef)
  /** How the last resolveShaderLayer() found its target: 'auto' or 'layer'. */
  let shaderResolveMode = 'auto'

      //#region shader engine ----------------------------------------------------
      // One active preset per layer. The active presets are part of the persisted
      // scene snapshot so a remounted panel redraws them; the original customShader
      // (usually null) is saved per layer and put back on reset / layer removal.
      const shaderResult = (operation, preset, layer) => ({
        operation,
        preset: preset ?? null,
        layer: layer ?? null,
        // Apply tells the model whether the layer was picked automatically or named.
        ...(operation === 'apply' ? { target: shaderResolveMode } : {}),
        // D-18 additive: the ordered stack (one entry for a single preset).
        stack: Array.isArray(preset) ? preset.slice() : preset ? [preset] : [],
        active: shaderActiveList(),
        presets: SHADER_PRESETS.slice(),
      })

      const shaderActiveList = () => {
        // A stale entry (removed or hidden layer) must never show up as active.
        pruneShaderEntries()
        const order = new Map(layersRef.current.map((layer, index) => [layer.id, index]))
        return [...shaderEntriesRef.current.values()]
          .sort((left, right) => (order.get(left.layer.id) ?? 0) - (order.get(right.layer.id) ?? 0))
          .map((entry) => ({ layer: entry.layerName, layerId: entry.layer.id, preset: entry.preset, params: { ...entry.params } }))
      }

      const refreshShaderActive = () => setShaderActive(shaderActiveList())

      /** Register the single u_time tick only when the first preset becomes active. */
      function ensureShaderTick() {
        const viewer = viewerRef.current
        if (!viewer || shaderTickRef.current) return
        const tick = () => {
          const seconds = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000
          for (const entry of shaderEntriesRef.current.values()) {
            const shader = entry.shader
            if (!shader || !shader.uniforms || !('u_time' in shader.uniforms)) continue
            try {
              shader.setUniform('u_time', seconds)
            } catch {
              /* an already replaced shader is detached from the tileset */
            }
          }
        }
        try {
          viewer.scene.preRender.addEventListener(tick)
          shaderTickRef.current = { viewer, tick }
        } catch {
          shaderTickRef.current = null
        }
      }

      function releaseShaderTick() {
        const handle = shaderTickRef.current
        shaderTickRef.current = null
        if (!handle) return
        try {
          handle.viewer.scene.preRender.removeEventListener(handle.tick)
        } catch {
          /* the viewer may already be destroyed */
        }
      }

      /**
       * Defensive cleanup before any read of the active list: a layer can vanish
       * (removed) or be switched off while its entry is still in the map — e.g. a
       * visibility change from the layer panel or the earth_scene visible command.
       * Such an entry would otherwise report an invisible layer as shaded and keep
       * the shared u_time tick alive, so it is restored to the layer's original
       * shader and dropped. A refreshed layer row for the same id is re-pointed at
       * the new object so the workbench list keeps naming the live layer.
       */
      function pruneShaderEntries() {
        let pruned = false
        for (const entry of [...shaderEntriesRef.current.values()]) {
          const layer = layersRef.current.find((item) => item.id === entry.layer.id)
          if (layer && layer.visible !== false) {
            entry.layer = layer
            entry.layerName = layer.name
            continue
          }
          pruned = true
          shaderEntriesRef.current.delete(entry.layer.id)
          comparisons.delete(entry.layer.id)
          // A removed layer needs no restore; a hidden one gets its original shader back.
          if (layer) restoreShaderEntry(entry)
        }
        if (pruned) {
          if (shaderEntriesRef.current.size === 0) releaseShaderTick()
          refreshShaderActive()
        }
        return pruned
      }

      /** End the original-look comparison on one layer and put the preset back. */
      function finishCompare(layerId) {
        if (!comparisons.has(layerId)) return false
        comparisons.delete(layerId)
        const entry = shaderEntriesRef.current.get(layerId)
        if (entry && entry.layer && entry.layer.tileset) {
          try {
            entry.layer.tileset.customShader = entry.shader
          } catch {
            /* the layer may be detached mid-comparison */
          }
        }
        return true
      }

      function restoreShaderEntry(entry) {
        try {
          entry.layer.tileset.customShader = entry.previous ?? undefined
          return null
        } catch (error) {
          return error
        }
      }

      /** Layer removal: drop its preset and the tick when nothing is left. */
      function detachShaderForLayer(id, restore) {
        const entries = shaderEntriesRef.current
        const entry = entries.get(id)
        if (!entry) return false
        entries.delete(id)
        finishCompare(id)
        if (restore) restoreShaderEntry(entry)
        refreshShaderActive()
        if (entries.size === 0) releaseShaderTick()
        return true
      }

      function resolveShaderLayer(token) {
        if (token) {
          const layer = findLayer(token)
          if (!layer) {
            throw shaderFail(`未找到图层 "${token}"。`, '用 earth_scene 的 list 动作查看当前图层名。')
          }
          shaderResolveMode = 'layer'
          return layer
        }
        let gaussianOnly = false
        for (let index = layersRef.current.length - 1; index >= 0; index -= 1) {
          const layer = layersRef.current[index]
          if (!layer.visible) continue
          // Auto-selection skips 3DGS so a splat layer on top cannot shadow a usable
          // 3D Tiles layer below; an explicit layer still gets the exact 3DGS error.
          if (shaderGaussianLayer(layer.tileset, layer)) {
            gaussianOnly = true
            continue
          }
          shaderResolveMode = 'auto'
          return layer
        }
        if (gaussianOnly) {
          throw shaderFail(
            '当前视图没有可用的 3D Tiles 图层（可见图层均为 3DGS）。',
            '加载或显示普通 3D Tiles 图层后重试。',
          )
        }
        throw shaderFail('当前视图没有可见的 3D Tiles 图层。', '先加载或显示 3D Tiles 图层后重试。')
      }

      function applyShader(request) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) throw shaderFail('三维引擎尚未就绪。', '打开数字地球面板后重试。')
        if (typeof Cesium.CustomShader !== 'function') {
          throw shaderFail('当前 Cesium 不支持 CustomShader。', '升级 Cesium 版本或换用其他可视化方式。')
        }
        const layer = resolveShaderLayer(request.layer)
        if (layer.visible === false) {
          // The scene would immediately prune an effect on an invisible layer, so
          // report the real reason instead of a false "applied" success.
          throw shaderFail(`图层 "${layer.name}" 当前为隐藏状态。`, '先在图层面板显示该图层，再应用视觉特效。')
        }
        if (shaderGaussianLayer(layer.tileset, layer)) {
          // Exact wording from the frozen B3 contract (used by QA and the model).
          throw new Error('shader: 3DGS 图层不支持该预设。next: 换 3D Tiles 图层。')
        }
        // Applying a look ends any original-look comparison on this layer.
        finishCompare(layer.id)
        // The contract fallback for a not-yet-loaded tileset is 0..200, not the
        // camera altitude: the dataset centre must not depend on where we look.
        const range = shaderHeightRange(Cesium, layer.tileset, null)
        if (request.params.min_height !== undefined) range.minimum = request.params.min_height
        if (request.params.max_height !== undefined) range.maximum = request.params.max_height
        if (!(range.maximum > range.minimum)) {
          throw shaderFail(`高程范围无效（${range.minimum}..${range.maximum}）。`, '传入 min_height < max_height。')
        }
        const existing = shaderEntriesRef.current.get(layer.id)
        // Slider previews re-apply the same stack constantly. Updating the uniforms
        // of the compiled CustomShader avoids a GLSL recompile per keystroke and
        // keeps the original shader saved for reset unchanged.
        if (existing && samePresetStack(existing.preset, request.preset) && typeof existing.shader?.setUniform === 'function') {
          const uniforms = shaderUniforms(Cesium, request.presets ?? request.preset, request.params, range)
          try {
            for (const [name, uniform] of Object.entries(uniforms)) existing.shader.setUniform(name, uniform.value)
          } catch (error) {
            throw shaderFail(`更新着色器参数失败（${message(error)}）。`, '换一个预设或重置后重试。')
          }
          existing.params = { ...request.params }
          return shaderResult('apply', request.preset, layer.name)
        }
        const options = {
          uniforms: shaderUniforms(Cesium, request.presets ?? request.preset, request.params, range),
          fragmentShaderText: shaderFragmentSource(request.presets ?? request.preset),
        }
        const stack = Array.isArray(request.presets) ? request.presets : [request.preset]
        if ((stack.includes('water') || stack.includes('water-depth')) && Cesium.CustomShaderTranslucencyMode?.INHERIT !== undefined) {
          options.translucencyMode = Cesium.CustomShaderTranslucencyMode.INHERIT
        }
        let shader = null
        try {
          shader = new Cesium.CustomShader(options)
        } catch (error) {
          throw shaderFail(`预设着色器构造失败（${message(error)}）。`, '换一个预设或重置后重试。')
        }
        // Re-applying on the same layer keeps the very first saved shader so reset
        // never restores a preset we applied ourselves.
        const previous = existing ? existing.previous : (layer.tileset.customShader ?? null)
        try {
          layer.tileset.customShader = shader
          if (layer.tileset.customShader !== shader) throw new Error('图层拒绝了 customShader 赋值')
        } catch (error) {
          // Restore the preset that is still active (not the layer's original shader)
          // so the entries, shader list and workbench keep matching the scene. Only
          // when even that restore fails do we drop the stale entry.
          let restored = false
          try {
            if (existing) {
              layer.tileset.customShader = existing.shader ?? undefined
              restored = layer.tileset.customShader === (existing.shader ?? undefined)
            } else {
              layer.tileset.customShader = previous ?? undefined
              restored = layer.tileset.customShader === (previous ?? undefined)
            }
          } catch {
            restored = false
          }
          if (!restored) {
            if (existing) {
              shaderEntriesRef.current.delete(layer.id)
              if (shaderEntriesRef.current.size === 0) releaseShaderTick()
              refreshShaderActive()
            }
            throw shaderFail(
              `预设应用失败（${message(error)}），且原有着色器恢复失败。`,
              '重新加载该图层或刷新面板后重试。',
            )
          }
          throw shaderFail(`预设应用失败（${message(error)}）。`, '换一个预设或重置后重试。')
        }
        shaderEntriesRef.current.set(layer.id, {
          layer,
          layerName: layer.name,
          preset: request.preset,
          params: { ...request.params },
          previous,
          shader,
        })
        ensureShaderTick()
        refreshShaderActive()
        return shaderResult('apply', request.preset, layer.name)
      }

      function resetShader(layerToken) {
        // Drop entries for layers that disappeared or were hidden first, so reset
        // never restores an original shader onto an entry the scene already lost.
        pruneShaderEntries()
        const entries = shaderEntriesRef.current
        let targetLayerName = null
        let targets = []
        if (layerToken) {
          const layer = findLayer(layerToken)
          if (!layer) {
            throw shaderFail(`未找到图层 "${layerToken}"。`, '用 earth_scene 的 list 动作查看当前图层名。')
          }
          targetLayerName = layer.name
          const entry = entries.get(layer.id)
          if (entry) targets = [entry]
        } else {
          targets = [...entries.values()]
        }
        let failure = null
        for (const entry of targets) {
          finishCompare(entry.layer.id)
          entries.delete(entry.layer.id)
          const error = restoreShaderEntry(entry)
          if (error && !failure) failure = error
        }
        // No comparison may survive a reset: the workbench must not keep showing the
        // original look as if a preset were still applied.
        comparisons.clear()
        if (entries.size === 0) releaseShaderTick()
        refreshShaderActive()
        if (failure) {
          throw shaderFail(`恢复原有着色器失败（${message(failure)}）。`, '重试 reset，或换一个预设后重置。')
        }
        return shaderResult('reset', null, targetLayerName)
      }

      /**
       * Workbench "original look" comparison: temporarily put the layer's original
       * shader back without forgetting the applied preset, so releasing the toggle
       * (or applying/resetting/closing) restores the shaded view exactly.
       */
      function compareShader(layerToken, enabled) {
        const layer = resolveShaderLayer(layerToken)
        const entry = shaderEntriesRef.current.get(layer.id)
        if (enabled) {
          if (!entry) {
            throw shaderFail('当前图层还没有应用着色器，无法对比。', '先应用一个预设，再点「原图对比」。')
          }
          if (!comparisons.has(layer.id)) {
            comparisons.set(layer.id, { original: entry.previous ?? null })
            try {
              layer.tileset.customShader = entry.previous ?? undefined
            } catch (error) {
              comparisons.delete(layer.id)
              throw shaderFail(`原图对比失败（${message(error)}）。`, '重试，或先重置该图层再对比。')
            }
          }
          return { compared: true, layer: layer.name }
        }
        finishCompare(layer.id)
        return { compared: false, layer: layer.name }
      }

      /**
       * Bridge entry for the B3 `shader` command: apply / reset / list. Argument
       * validation runs before the viewer check so a malformed call gets the same
       * actionable message even on a cold panel.
       */
      async function shaderCommand(args = {}) {
        const request = shaderValidateRequest(args)
        if (request instanceof Error) throw request
        if (request.operation === 'list') return shaderResult('list', null, null)
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) throw shaderFail('三维引擎尚未就绪。', '打开数字地球面板后重试。')
        if (request.operation === 'reset') return resetShader(request.layer)
        return applyShader(request)
      }
      //#endregion shader engine

  return {
    /** Bridge entry: apply / reset / list. */
    command: (args = {}) => shaderCommand(args),
    /** Active presets in layer order (workbench, snapshot and report). */
    activeList: () => shaderActiveList(),
    /** Layer removal / teardown: forget the preset and stop the tick when idle. */
    detachForLayer: (id, restore) => detachShaderForLayer(id, restore),
    /** Detach the u_time tick without touching the entries (viewer teardown). */
    releaseTick: () => releaseShaderTick(),
    /** Workbench: temporarily swap to the layer's original look / restore. */
    compare: (layer, enabled) => compareShader(layer, enabled),
  }
}
