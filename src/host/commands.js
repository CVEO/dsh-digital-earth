/**
 * The /earth slash command and its one-screen status summary.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { CAPTURE_TIMEOUT_MS, DRAW_TIMEOUT_MS, REPORT_TIMEOUT_MS, SCENE_TIMEOUT_MS } from './constants.js'
import { asResultObject, resolveSessionTarget } from './session.js'
import { isPlainObject } from './sanitize.js'

/** One-screen summary for the `/earth status` command result. */
export function renderEarthCommandStatus(value) {
  const view = isPlainObject(value.view) ? value.view : {}
  const camera = []
  if (Number.isFinite(view.lon) && Number.isFinite(view.lat)) camera.push(`${view.lon}, ${view.lat}`)
  if (Number.isFinite(view.height)) camera.push(`${view.height} m`)
  if (Number.isFinite(view.heading)) camera.push(`heading ${view.heading}°, pitch ${view.pitch}°`)
  const layers = Array.isArray(value.layers) ? value.layers : []
  const layerText =
    layers.length === 0
      ? 'none'
      : layers.map((layer) => `${layer.name}${layer.visible === false ? ' (hidden)' : ''}`).join(', ')
  const imagery = isPlainObject(value.imagery) ? value.imagery.name : 'none'
  const terrain = isPlainObject(value.terrain) ? value.terrain.name : 'none'
  const annotations = isPlainObject(value.annotations) ? value.annotations : {}
  return [
    'Digital earth status',
    `Camera: ${camera.join(' · ') || 'unknown'}`,
    `Layers: ${layerText}`,
    `Imagery: ${imagery}; terrain: ${terrain}`,
    `Agent overlays: ${annotations.drawn_features ?? 0} annotated features, ${annotations.measured_points ?? 0} measured points`,
  ].join('\n')
}

/**
 * `/earth` slash command: direct user control of the panel without a model turn.
 * The command result stays in the command UI; nothing here enters the model
 * context, matching the DSH command contract.
 */
export function mountEarthCommand(ctx, bridge) {
  ctx.inject(['commands'], (scope) => {
    scope.effect(
      () =>
        scope.commands.register({
          name: 'earth',
          description: 'Digital earth panel: status, capture, clear annotations, or open it from the globe button.',
          input: { hint: 'status | capture [label] | report [html|markdown] | clear | open' },
          handler: async ({ agent, rawInput }) => {
            const target = resolveSessionTarget(bridge, { agent })
            if (target === null) {
              return {
                kind: 'error',
                text: 'The digital earth panel is not connected for this conversation. Open it with the globe button in the chat header, then retry.',
              }
            }
            const words = String(rawInput ?? '')
              .trim()
              .split(/\s+/)
              .filter(Boolean)
            const sub = (words.shift() ?? 'help').toLowerCase()
            try {
              if (sub === 'status') {
                const value = asResultObject(await bridge.run(target.sessionId, 'status', {}, SCENE_TIMEOUT_MS))
                return { kind: 'success', text: renderEarthCommandStatus(value) }
              }
              if (sub === 'capture') {
                const label = words.join(' ').trim().slice(0, 80)
                const ack = asResultObject(
                  await bridge.run(target.sessionId, 'capture', label === '' ? {} : { label }, CAPTURE_TIMEOUT_MS),
                )
                const path = typeof ack.path === 'string' ? ack.path : ''
                return { kind: 'success', text: path === '' ? 'Snapshot saved.' : `Snapshot saved: ${path}` }
              }
              if (sub === 'clear') {
                await bridge.run(target.sessionId, 'draw', { clear: true }, DRAW_TIMEOUT_MS)
                return { kind: 'success', text: 'Cleared the Agent annotations and measurements from the panel.' }
              }
              if (sub === 'report') {
                const requested = (words[0] ?? 'html').toLowerCase()
                const format = requested === 'markdown' || requested === 'md' ? 'markdown' : 'html'
                const value = asResultObject(
                  await bridge.run(target.sessionId, 'report', { format, include_capture: true }, REPORT_TIMEOUT_MS),
                )
                const path = typeof value.path === 'string' ? value.path : ''
                return {
                  kind: 'success',
                  text: path === '' ? 'Scene report written.' : `Scene report written: ${path}`,
                }
              }
              if (sub === 'open') {
                return {
                  kind: 'success',
                  text: 'The digital earth tab opens by itself on the next earth tool call, or click the globe button in the chat header.',
                }
              }
              return {
                kind: 'success',
                text: 'Usage: /earth status | /earth capture [label] | /earth report [html|markdown] | /earth clear | /earth open',
              }
            } catch (error) {
              return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
            }
          },
        }),
      'digital-earth /earth command',
    )
  })
}
