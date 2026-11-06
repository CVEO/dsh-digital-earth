/**
 * scene/ask-agent.js — "Ask Agent": capture + inject a scene summary.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2. The fresh snapshot is a bonus; the
 * textual summary (camera/layers/overlays/analysis/shaders) is what the Agent needs
 * and is built even when capture or status fail. Injection never wakes an idle
 * agent — it lands on the next step.
 */
export function createAskAgent(deps) {
  const metaRef = { get current() { return deps.getMeta() } }
  const sessionRef = { get current() { return deps.getSession() } }
  const showToast = deps.showToast
  const t = deps.t
  const captureScene = deps.captureScene
  const collectSceneStatus = deps.collectSceneStatus
  const shaderActiveList = deps.shaderActiveList
  const message = deps.message

      async function askAgent() {
        const analysis = deps.getAnalysis()
        const meta = metaRef.current
        const session = sessionRef.current
        if (!meta?.injectUrl || typeof session !== 'string' || session === '') {
          showToast(t('toast.askAgentNoSession'))
          return
        }
        let snapshotPath = ''
        try {
          const saved = await captureScene({}, session)
          snapshotPath = typeof saved.path === 'string' ? saved.path : ''
        } catch {
          // A fresh image is a bonus; the textual summary still helps.
        }
        let status = null
        try {
          status = await collectSceneStatus()
        } catch {
          status = null
        }
        const lines = [
          '[Digital Earth scene context] The user is looking at this scene and will ask a follow-up about it.',
        ]
        if (status !== null) {
          const view = status.view ?? {}
          if (Number.isFinite(view.lon) && Number.isFinite(view.lat)) {
            lines.push(
              `Camera: lon=${view.lon}, lat=${view.lat}, height=${view.height} m, heading=${view.heading}°, pitch=${view.pitch}°.`,
            )
          }
          const layerText =
            Array.isArray(status.layers) && status.layers.length > 0
              ? status.layers.map((layer) => `${layer.name}${layer.visible === false ? ' (hidden)' : ''}`).join(', ')
              : 'none'
          lines.push(`Layers: ${layerText}.`)
          lines.push(`Imagery: ${status.imagery?.name ?? 'none'}; terrain: ${status.terrain?.name ?? 'none'}.`)
          const annotations = status.annotations ?? {}
          lines.push(
            `Agent overlays: ${annotations.drawn_features ?? 0} annotated features, ${annotations.measured_points ?? 0} measured points.`,
          )
        }
        if (analysis !== null && analysis.result) {
          const result = analysis.result
          if (result.operation === 'profile' && result.stats) {
            lines.push(
              `Analysis (profile): length=${result.length_m} m, relief=${result.stats.relief_m} m, min=${result.stats.min_height} m, max=${result.stats.max_height} m, samples=${result.samples}.`,
            )
          } else if (result.operation === 'flood') {
            lines.push(
              `Analysis (flood): water=${result.water_height} m, area=${result.area_km2} km², inundated=${result.inundated_km2} km², ratio=${result.inundated_ratio}, max depth=${result.depth_max_m} m.`,
            )
          } else if (result.operation === 'sunlight') {
            lines.push(
              `Analysis (sunlight): datetime=${result.datetime}, altitude=${result.sun?.altitude_deg}°, azimuth=${result.sun?.azimuth_deg}°, shadows=${result.shadows_enabled === true ? 'on' : 'off'}.`,
            )
          }
        }
        const shaders = shaderActiveList()
        if (shaders.length > 0) {
          lines.push(`Shaders: ${shaders.map((item) => `${item.layer}=${item.preset}`).join(', ')}.`)
        }
        if (snapshotPath !== '') lines.push(`Snapshot: ${snapshotPath}`)
        lines.push('Answer from the scene state above; do not invent data that is not in it.')
        try {
          const response = await fetch(meta.injectUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session, text: lines.join('\n') }),
          })
          const data = await response.json().catch(() => null)
          if (!response.ok || data?.ok !== true) throw new Error(data?.message ?? `HTTP ${response.status}`)
          showToast(t('toast.askAgentSent'))
        } catch (error) {
          showToast(t('toast.askAgentFailed', { message: message(error) }))
        }
      }


  return { askAgent }
}
