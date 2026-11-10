/**
 * earth_analyze model-facing renderer.
 *
 * v1.5.2 split: the text renderer grew past the analyze.js line budget; it only
 * needs the result object plus message formatting, so it lives in its own module.
 */
import { formatMeasureDistance } from './measure.js'
import { isPlainObject } from '../sanitize.js'

/** Keep the model-facing analysis text plus its JSON inside one UTF-8 budget. */
const ANALYZE_RENDER_LIMIT = 8 * 1024

function formatAnalyzeCoordinate(position) {
  return Array.isArray(position) && position.length === 2 && position.every((value) => Number.isFinite(value))
    ? `[${position[0]}, ${position[1]}]`
    : 'unknown'
}

function formatAnalyzeSquareKilometers(squareKilometers) {
  return Number.isFinite(squareKilometers) ? `${squareKilometers.toFixed(3)} km²` : 'unknown'
}

/** Keep the analysis result inside its UTF-8 budget without splitting characters. */
function truncateAnalyzeText(text, note) {
  if (Buffer.byteLength(text, 'utf8') <= ANALYZE_RENDER_LIMIT) return text
  const budget = Math.max(0, ANALYZE_RENDER_LIMIT - Buffer.byteLength(note, 'utf8'))
  let head = ''
  let used = 0
  for (const character of text) {
    const size = Buffer.byteLength(character, 'utf8')
    if (used + size > budget) break
    head += character
    used += size
  }
  return `${head}${note}`
}

function renderAnalyzeResult(value) {
  if (!isPlainObject(value)) return truncateAnalyzeText(String(value), '\n[analysis result truncated]')
  const operation = typeof value.operation === 'string' ? value.operation : 'unknown'
  const layer = typeof value.layer === 'string' && value.layer !== '' ? ` on layer ${value.layer}` : ''
  const lines = []

  if (operation === 'profile') {
    const details = []
    if (value.from !== undefined && value.to !== undefined) {
      details.push(`from ${formatAnalyzeCoordinate(value.from)} to ${formatAnalyzeCoordinate(value.to)}`)
    }
    if (Number.isFinite(value.length_m)) details.push(formatMeasureDistance(value.length_m))
    if (Number.isInteger(value.samples)) details.push(`${value.samples} samples`)
    lines.push(`Profile${layer}${details.length > 0 ? `: ${details.join(', ')}` : ' completed'}.`)
    const stats = isPlainObject(value.stats) ? value.stats : {}
    const height = []
    if (Number.isFinite(stats.min_height)) height.push(`min ${stats.min_height.toFixed(1)} m`)
    if (Number.isFinite(stats.max_height)) height.push(`max ${stats.max_height.toFixed(1)} m`)
    if (Number.isFinite(stats.relief_m)) height.push(`relief ${stats.relief_m.toFixed(1)} m`)
    if (Number.isFinite(stats.gain_m)) height.push(`gain ${stats.gain_m.toFixed(1)} m`)
    if (Number.isFinite(stats.loss_m)) height.push(`loss ${stats.loss_m.toFixed(1)} m`)
    if (height.length > 0) lines.push(`Elevation: ${height.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the drawn profile.')
  } else if (operation === 'flood') {
    const details = []
    if (isPlainObject(value.region)) {
      const { west, south, east, north } = value.region
      if ([west, south, east, north].every((number) => Number.isFinite(number))) {
        details.push(`region [${west}, ${south}, ${east}, ${north}]`)
      }
    }
    if (Number.isFinite(value.water_height)) details.push(`water ${value.water_height} m`)
    if (Number.isInteger(value.grid)) details.push(`grid ${value.grid}×${value.grid}`)
    lines.push(`Flood${layer}${details.length > 0 ? `: ${details.join(', ')}` : ' completed'}.`)
    const area = []
    if (Number.isFinite(value.area_km2)) area.push(`area ${formatAnalyzeSquareKilometers(value.area_km2)}`)
    if (Number.isFinite(value.inundated_km2)) {
      area.push(`inundated ${formatAnalyzeSquareKilometers(value.inundated_km2)}`)
      if (Number.isFinite(value.area_km2) && value.area_km2 > 0) {
        area.push(`${((value.inundated_km2 / value.area_km2) * 100).toFixed(1)}% of area`)
      }
    }
    if (Number.isFinite(value.inundated_ratio)) area.push(`${(value.inundated_ratio * 100).toFixed(1)}% of sampled cells`)
    if (area.length > 0) lines.push(`Coverage: ${area.join(', ')}.`)
    if (value.surface_approx === true) {
      lines.push('Surface approximation: heights come from the 3D Tiles surface and include roofs and vegetation; not a bare-ground flood result.')
    }
    const depth = []
    if (Number.isFinite(value.depth_max_m)) depth.push(`max ${value.depth_max_m.toFixed(2)} m`)
    if (Number.isFinite(value.depth_mean_m)) depth.push(`mean ${value.depth_mean_m.toFixed(2)} m`)
    if (depth.length > 0) lines.push(`Depth: ${depth.join(', ')}.`)
    const samples = []
    if (Number.isInteger(value.samples_with_data)) samples.push(`${value.samples_with_data} with height data`)
    if (Number.isInteger(value.samples_inundated)) samples.push(`${value.samples_inundated} inundated`)
    if (samples.length > 0) lines.push(`Samples: ${samples.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the shaded flood area.')
  } else if (operation === 'sunlight') {
    const sun = isPlainObject(value.sun) ? value.sun : {}
    const details = [value.datetime ?? 'current time']
    if (Number.isFinite(sun.altitude_deg)) details.push(`altitude ${sun.altitude_deg.toFixed(1)}°`)
    if (Number.isFinite(sun.azimuth_deg)) details.push(`azimuth ${sun.azimuth_deg.toFixed(1)}°`)
    details.push(value.night === true ? 'night' : 'day')
    details.push(value.shadows_enabled === true ? 'shadows on' : 'shadows off')
    lines.push(`Sunlight${layer}: ${details.join(', ')}.`)
    lines.push('Call earth_capture if the user should see the sun position or shadows.')
  } else if (operation === 'skyline') {
    const details = []
    if (Number.isFinite(value.max_angle_deg)) details.push(`max elevation angle ${value.max_angle_deg.toFixed(2)}°`)
    if (Number.isFinite(value.max_distance_m)) details.push(`at ${formatMeasureDistance(value.max_distance_m)}`)
    if (Number.isInteger(value.samples)) details.push(`${value.samples} samples`)
    lines.push(`Skyline${layer}${details.length > 0 ? `: ${details.join(', ')}` : ' completed'}.`)
    lines.push('Call earth_capture if the user should see the skyline profile.')
  } else if (operation === 'clip') {
    const height = Number.isFinite(value.height) ? `${value.height} m` : 'unknown height'
    const keep = value.keep === 'above' ? 'above' : 'below'
    const planes = Number.isInteger(value.planes) ? value.planes : 1
    lines.push(`Clip${layer}: plane at ${height}, keeping ${keep} it (${planes} clipping plane${planes === 1 ? '' : 's'}).`)
    lines.push('Call earth_capture if the user should see the section, or earth_analyze action=clear to remove the clip.')
  } else if (operation === 'clear') {
    const cleared = Array.isArray(value.cleared) ? value.cleared.filter((item) => typeof item === 'string') : []
    lines.push(cleared.length > 0 ? `Cleared the active analysis (${cleared.join(', ')}).` : 'No active analysis was cleared.')
  } else {
    lines.push(`Analysis (${operation}) completed.`)
  }

  // Provenance is part of the model-facing text: a profile measured on the 3D
  // Tiles surface is not a bare-ground profile, and a flood that used roofs must
  // say so instead of quietly reporting a wrong inundated area.
  if (typeof value.height_source === 'string' && value.height_source !== '') {
    const mode = typeof value.height_mode === 'string' ? `, ${value.height_mode} mode` : ''
    lines.push(`Height source: ${value.height_source}${mode}.`)
  } else if (typeof value.source === 'string' && value.source !== '') {
    lines.push(`Height source: ${value.source}.`)
  }
  if (Array.isArray(value.warnings) && value.warnings.length > 0) {
    const warnings = value.warnings.filter((item) => typeof item === 'string')
    if (warnings.length > 0) lines.push(`Warnings: ${warnings.join(', ')}.`)
  }

  let json
  try {
    json = JSON.stringify(value)
  } catch {
    json = null
  }
  const summary = lines.join('\n')
  if (typeof json !== 'string') return truncateAnalyzeText(summary, '\n[analysis result truncated]')
  return truncateAnalyzeText(
    `${summary}\nJSON: ${json}`,
    `\n[analysis JSON truncated at ${ANALYZE_RENDER_LIMIT} UTF-8 bytes]`,
  )
}

export { renderAnalyzeResult, ANALYZE_RENDER_LIMIT }
