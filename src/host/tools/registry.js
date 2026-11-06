/**
 * System-prompt section and the exactly-six-tool agent registration.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { createAnalyzeTool } from './analyze.js'
import { createCaptureTool } from './capture.js'
import { createDrawTool } from './draw.js'
import { createMeasureTool } from './measure.js'
import { createSceneTool } from './scene.js'
import { createShaderTool } from './shader.js'

export const SYSTEM_PROMPT_SECTION = [
  'The digital earth panel has 3D Tiles, splats, imagery and terrain. Control it with earth_scene, earth_capture, earth_draw and earth_measure, plus earth_analyze, plus earth_shader.',
  '',
  '- The panel opens automatically when a call needs it; if it does not attach, ask the user to open it from the chat header globe button, then retry.',
  '- Local paths: pass the absolute path directly to earth_scene load/inspect; a new folder gets one confirmation dialog and the call continues when allowed. If denied or timed out, stop and report; do not retry.',
  '- Call earth_scene status only when you need the current camera, layers or sources; load and fly return the view, so no confirmation call.',
  '- earth_scene actions: status, list, load, remove, visible, basemap, terrain, fly, reset, pick, inspect; its JSON is authoritative.',
  '- earth_capture saves an image and returns its path; read it with read_image if supported, else use the JSON. Call present to show a file; never embed a local path in Markdown.',
  '- earth_draw adds GeoJSON annotations and earth_measure returns distance/area/height numbers, both draw by default. Take coordinates from the user, status/pick or loaded data; never guess.',
  '- earth_analyze runs one analysis at a time (profile, flood, sunlight), or clear removes it; it needs loaded height data.',
  '- earth_shader applies whitelisted presets (height-false-color, contour, scan, water), lists them or resets; no custom GLSL.',
  '- Report only state the tools returned; never claim unverified data.',
  '- Errors start with a [code] and one next: step; follow it; never retry access_denied or access_timeout.',
].join('\n')

/**
 * Agent tools and the prompt section are optional: mount them only when the
 * host provides the tools and system-prompt services, so the panel HTTP API
 * keeps working in a build without an agent runtime.
 */
export function mountAgentTools(ctx, bridge, allowedDirs) {
  ctx.inject(['tools', 'systemPrompt'], (scope) => {
    scope.effect(() => {
      const disposers = [
        scope.tools.register(createSceneTool(bridge, allowedDirs)),
        scope.tools.register(createCaptureTool(bridge)),
        scope.tools.register(createDrawTool(bridge)),
        scope.tools.register(createMeasureTool(bridge)),
        scope.tools.register(createAnalyzeTool(bridge)),
        scope.tools.register(createShaderTool(bridge)),
        scope.systemPrompt.section({
          name: 'plugin:digital-earth',
          order: 810,
          text: SYSTEM_PROMPT_SECTION,
        }),
      ]
      return () => {
        for (const dispose of disposers) {
          if (typeof dispose !== 'function') continue
          try {
            dispose()
          } catch {
            // One broken contribution must not strand the others.
          }
        }
      }
    }, 'digital-earth agent tools')
  })
}
