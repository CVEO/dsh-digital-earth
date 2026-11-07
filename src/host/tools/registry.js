/**
 * System-prompt section and the exactly-six-tool agent registration.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { createAnalyzeTool } from './analyze.js'
import { createCaptureTool } from './capture.js'
import { createDrawTool } from './draw.js'
import { createMeasureTool } from './measure.js'
import { createSceneTool } from './scene.js'
import { createShaderTool } from './shader.js'

export const SYSTEM_PROMPT_SECTION = [
  'Digital earth panel: 3D Tiles, splats, imagery, terrain. Six tools drive it: earth_scene (scene read/write), earth_capture (snapshot), earth_draw (GeoJSON), earth_measure (distance/area/height), earth_analyze (profile/flood/sunlight/clip/skyline), earth_shader (white-listed presets).',
  '',
  '- The panel opens automatically when a call needs it; if it does not attach, ask the user to open it from the chat header globe button, then retry.',
  '- Local paths: pass the absolute path directly to earth_scene load/inspect; a new folder gets one confirmation dialog. On denial/timeout, stop and report; do not retry.',
  '- Call earth_scene status only when you need the current camera, layers or sources; load and fly return the view.',
  '- earth_scene actions: status, list, load, remove, visible, basemap, terrain, fly, reset, pick, inspect, report.',
  '- earth_capture saves an image and returns its path; use read_image if supported, else the JSON; never embed a local path in Markdown.',
  '- earth_draw adds GeoJSON; earth_measure returns distance/area/height; both draw by default. Coordinates from the user, status/pick or loaded data; never guess.',
  '- earth_analyze runs one analysis at a time (profile, flood, sunlight, clip or skyline); clear removes it; it needs loaded height data and reports its height source plus warnings.',
  '- earth_shader applies whitelisted presets (height-false-color, contour, scan, water, water-depth), lists or resets; no custom GLSL.',
  '- Report only tool state; never claim unverified data.',
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
