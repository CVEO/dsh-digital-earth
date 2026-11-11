/**
 * scene/ask-agent.js — "Ask Agent": capture + inject a scene summary.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2. The fresh snapshot is a bonus; the
 * textual summary (camera/layers/overlays/analysis/shaders) is what the Agent needs
 * and is built even when capture or status fail. Injection never wakes an idle
 * agent — it lands on the next step.
 */
import { askSelectionQuestion } from './selection-question.js'

export function createAskAgent(deps) {
  const metaRef = { get current() { return deps.getMeta() } }
  const sessionRef = { get current() { return deps.getSession() } }
  const showToast = deps.showToast
  const t = deps.t
  const captureScene = deps.captureScene
  const collectSceneStatus = deps.collectSceneStatus
  const shaderActiveList = deps.shaderActiveList
  const message = deps.message
  const getSelection = deps.getSelection

      async function askAgent() {
        const analysis = deps.getAnalysis()
        const meta = metaRef.current
        const session = sessionRef.current
        if (!meta?.injectUrl || typeof session !== 'string' || session === '') {
          showToast(t('toast.askAgentNoSession'))
          return
        }
        let snapshotPath = ''
        let savedMetadata = null
        try {
          const saved = await captureScene({}, session)
          snapshotPath = typeof saved.path === 'string' ? saved.path : ''
          savedMetadata = saved?.metadata !== null && typeof saved?.metadata === 'object' ? saved.metadata : null
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
        if (typeof savedMetadata?.captured_at === 'string' && savedMetadata.captured_at !== '') {
          lines.push(`Captured at: ${savedMetadata.captured_at}.`)
        }
        if (status !== null) {
          const view =
            savedMetadata?.camera !== null && typeof savedMetadata?.camera === 'object'
              ? savedMetadata.camera
              : status.view ?? {}
          if (Number.isFinite(view.lon) && Number.isFinite(view.lat)) {
            lines.push(
              `Camera: lon=${view.lon}, lat=${view.lat}, height=${view.height} m, heading=${view.heading}°, pitch=${view.pitch}°.`,
            )
          }
          const capturedLayers = Array.isArray(savedMetadata?.layers) && savedMetadata.layers.length > 0 ? savedMetadata.layers : status.layers
          const layerText =
            Array.isArray(capturedLayers) && capturedLayers.length > 0
              ? capturedLayers.map((layer) => `${layer.name}${layer.visible === false ? ' (hidden)' : ''}`).join(', ')
              : 'none'
          lines.push(`Layers: ${layerText}.`)
          lines.push(`Imagery: ${status.imagery?.name ?? 'none'}; terrain: ${status.terrain?.name ?? 'none'}.`)
          const annotations = status.annotations ?? {}
          lines.push(
            `Agent overlays: ${annotations.drawn_features ?? 0} annotated features, ${annotations.measured_points ?? 0} measured points.`,
          )
        }
        // A canvas selection is the user's current spatial context; send a compact
        // ring so the Agent can reason about "this area" without asking for coords.
        const selection = typeof getSelection === 'function' ? getSelection() : null
        if (selection && selection.kind === 'point') {
          lines.push(
            `Selection (point): lon=${selection.lon}, lat=${selection.lat}, height=${selection.height ?? 'unknown'} m.`,
          )
        } else if (selection && selection.kind === 'objects' && Array.isArray(selection.rows)) {
          lines.push(
            `Selected overlays (${selection.rows.length}): ${selection.rows.map((row) => row.label).filter(Boolean).join('; ')}`,
          )
        } else if (selection && Array.isArray(selection.ring) && selection.ring.length >= 4) {
          const rounded = selection.ring.map((point) => [Number(point[0].toFixed(6)), Number(point[1].toFixed(6))])
          lines.push(
            `Selection (${selection.kind ?? 'polygon'}): area=${Math.round(selection.area_m2 ?? 0)} m², perimeter=${Math.round(selection.perimeter_m ?? 0)} m, vertices=${Math.max(0, selection.ring.length - 1)}, complete=${selection.complete !== false}, approximate=${selection.approximate === true}; ring=${JSON.stringify(rounded)}`,
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
          } else if (result.operation === 'clip') {
            lines.push(`Analysis (clip): height=${result.height} m, keep=${result.keep}.`)
          } else if (result.operation === 'skyline') {
            lines.push(`Analysis (skyline): max_angle=${result.max_angle_deg}°, max_distance=${result.max_distance_m} m, eye=${result.eye_height_m} m.`)
          }
        }
        const shaders = shaderActiveList()
        if (shaders.length > 0) {
          lines.push(`Shaders: ${shaders.map((item) => `${item.layer}=${item.preset}`).join(', ')}.`)
        }
        if (snapshotPath !== '') {
          lines.push(`Snapshot: ${snapshotPath}`)
          // AI 圈选 through the normal Agent: the screenshot is a real file, so the
          // Agent can read it and draw the result with the frozen earth_draw tool.
          lines.push(
            'If the user asks to identify, outline or locate what is visible, call read_image on that snapshot first. Only draw with earth_draw when geographic anchors or verified geometry support the coordinates; screen pixels alone cannot recover a precise building footprint. Ask for anchors when missing and label approximate regions. Never guess unseen geometry.',
          )
        }
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
          showToast(t(snapshotPath ? 'toast.askAgentSent' : 'toast.askAgentTextOnly'))
        } catch (error) {
          showToast(t('toast.askAgentFailed', { message: message(error) }))
        }
      }


  return { askAgent, askSelection: (options) => askSelectionQuestion(deps, options) }
}
