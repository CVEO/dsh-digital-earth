/**
 * analysis/profile-metrics.js — pure math and export helpers for the profile card.
 *
 * The Host/Agent contract keeps returning the same profile result (`points` with
 * distance + height). Everything here is derived client-side so A2 adds no tool
 * parameters: design baseline, cut/fill, slope, 3D length, CSV and standalone SVG.
 *
 * Photogrammetry surfaces include roofs and trees. The numbers are therefore an
 * estimate tied to the sampled surface, not a surveying-grade earthwork quantity;
 * the card repeats that limitation next to the values.
 */

const DEFAULT_WIDTH_M = 7
const MIN_WIDTH_M = 1
const MAX_WIDTH_M = 100
const EMPTY_METRICS = Object.freeze({
  point_count: 0,
  valid_count: 0,
  include_design: true,
  distance_m: 0,
  width_m: DEFAULT_WIDTH_M,
  mode: 'grade',
  length_3d_m: 0,
  start_height_m: null,
  end_height_m: null,
  net_elevation_m: null,
  min_height_m: null,
  max_height_m: null,
  min_at_m: null,
  max_at_m: null,
  relief_m: 0,
  gain_m: 0,
  loss_m: 0,
  slope: { mean_abs_pct: null, max_abs_pct: null, max_at_m: null },
  design_grade_pct: null,
  design: { start_m: null, end_m: null, start_height_m: null, end_height_m: null, level_m: null },
  cut_area_m2: 0,
  fill_area_m2: 0,
  net_area_m2: 0,
  cut_volume_m3: 0,
  fill_volume_m3: 0,
  net_volume_m3: 0,
  series: [],
  warnings: ['no_profile'],
})

const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

function normalizeWidth(value) {
  const number = asNumber(value)
  if (number === null) return DEFAULT_WIDTH_M
  if (number < MIN_WIDTH_M) return MIN_WIDTH_M
  if (number > MAX_WIDTH_M) return MAX_WIDTH_M
  return number
}

function normalizePoints(points) {
  if (!Array.isArray(points)) return []
  return points
    .map((point) => ({
      distance_m: asNumber(point?.distance_m),
      height_m: asNumber(point?.height_m),
    }))
    .filter((point) => point.distance_m !== null)
    .sort((left, right) => left.distance_m - right.distance_m)
}

/**
 * Compute the design reference (grade or level), cut/fill areas and volumes,
 * slope statistics and the 3D (terrain-following) length from profile samples.
 *
 * @param {Array<{distance_m:number,height_m:number|null}>} points
 * @param {{mode?:'grade'|'level', level_m?:number|null, width_m?:number}} [options]
 */
export function profileMetrics(points, options = {}) {
  const series = normalizePoints(points)
  const pointCount = series.length
  if (pointCount < 2) return { ...EMPTY_METRICS, point_count: pointCount, series }

  const includeDesign = options.includeDesign !== false
  const warnings = []
  const mode = options.mode === 'level' ? 'level' : 'grade'
  const widthInput = asNumber(options.width_m)
  const width = normalizeWidth(widthInput)
  if (widthInput !== null && width !== widthInput) warnings.push('width_clamped')

  const valid = series.filter((point) => point.height_m !== null)
  if (valid.length < 2) {
    return { ...EMPTY_METRICS, point_count: pointCount, valid_count: valid.length, include_design: includeDesign, mode, width_m: width, series }
  }
  if (valid.length < pointCount) warnings.push('profile_gaps')

  const first = valid[0]
  const last = valid[valid.length - 1]
  const span = last.distance_m - first.distance_m
  const startHeight = first.height_m
  const endHeight = last.height_m

  let minHeight = first.height_m
  let maxHeight = first.height_m
  let minAt = first.distance_m
  let maxAt = first.distance_m
  let gainM = 0
  let lossM = 0
  for (let index = 0; index < valid.length; index += 1) {
    const point = valid[index]
    if (point.height_m < minHeight) {
      minHeight = point.height_m
      minAt = point.distance_m
    }
    if (point.height_m > maxHeight) {
      maxHeight = point.height_m
      maxAt = point.distance_m
    }
    if (index > 0) {
      const stepDelta = point.height_m - valid[index - 1].height_m
      if (stepDelta > 0) gainM += stepDelta
      else lossM -= stepDelta
    }
  }

  let level = null
  if (mode === 'level') {
    const requested = asNumber(options.level_m)
    if (requested !== null) level = requested
    else {
      level = Math.min(...valid.map((point) => point.height_m))
      warnings.push('level_from_min')
    }
  }

  const designAt = (distance) => {
    if (mode === 'level') return level
    if (!(span > 0)) return startHeight
    const ratio = Math.min(1, Math.max(0, (distance - first.distance_m) / span))
    return startHeight + (endHeight - startHeight) * ratio
  }

  let cutArea = 0
  let fillArea = 0
  let slopeSum = 0
  let slopeCount = 0
  let maxSlope = 0
  let maxSlopeAt = null
  let length3d = 0
  const out = []

  for (let index = 0; index < series.length; index += 1) {
    const point = series[index]
    const design = point.distance_m >= first.distance_m && point.distance_m <= last.distance_m ? designAt(point.distance_m) : null
    const delta = point.height_m !== null && design !== null ? point.height_m - design : null
    const next = series[index + 1]
    const nextDesign = next && next.distance_m >= first.distance_m && next.distance_m <= last.distance_m ? designAt(next.distance_m) : null

    let slope = null
    if (point.height_m !== null && next?.height_m !== undefined && next.height_m !== null) {
      const dd = next.distance_m - point.distance_m
      if (dd > 0) {
        slope = ((next.height_m - point.height_m) / dd) * 100
        slopeSum += Math.abs(slope)
        slopeCount += 1
        length3d += Math.hypot(dd, next.height_m - point.height_m)
        if (Math.abs(slope) > maxSlope) {
          maxSlope = Math.abs(slope)
          maxSlopeAt = point.distance_m + dd / 2
        }
      }
    }

    if (point.height_m !== null && design !== null && next && next.height_m !== null && nextDesign !== null) {
      const dd = next.distance_m - point.distance_m
      if (dd > 0) {
        const diff0 = point.height_m - design
        const diff1 = next.height_m - nextDesign
        if (diff0 >= 0 && diff1 >= 0) cutArea += ((diff0 + diff1) / 2) * dd
        else if (diff0 <= 0 && diff1 <= 0) fillArea += ((-diff0 - diff1) / 2) * dd
        else {
          const ratio = diff0 / (diff0 - diff1)
          const a = (diff0 / 2) * dd * ratio
          const b = (diff1 / 2) * dd * (1 - ratio)
          if (diff0 > 0) {
            cutArea += a
            fillArea += -b
          } else {
            fillArea += -a
            cutArea += b
          }
        }
      }
    }

    out.push({
      distance_m: point.distance_m,
      height_m: point.height_m,
      design_m: design,
      delta_m: delta,
      slope_pct: slope,
    })
  }

  const meanAbsSlope = slopeCount > 0 ? slopeSum / slopeCount : null
  const designGrade = mode === 'level' || !(span > 0) ? 0 : ((endHeight - startHeight) / span) * 100

  return {
    point_count: pointCount,
    valid_count: valid.length,
    include_design: includeDesign,
    distance_m: last.distance_m - first.distance_m,
    width_m: width,
    mode,
    length_3d_m: length3d,
    start_height_m: startHeight,
    end_height_m: endHeight,
    net_elevation_m: endHeight - startHeight,
    min_height_m: minHeight,
    max_height_m: maxHeight,
    min_at_m: minAt,
    max_at_m: maxAt,
    relief_m: maxHeight - minHeight,
    gain_m: gainM,
    loss_m: lossM,
    slope: { mean_abs_pct: meanAbsSlope, max_abs_pct: maxSlope || null, max_at_m: maxSlopeAt },
    design_grade_pct: designGrade,
    design: {
      start_m: first.distance_m,
      end_m: last.distance_m,
      start_height_m: startHeight,
      end_height_m: endHeight,
      level_m: level,
    },
    cut_area_m2: cutArea,
    fill_area_m2: fillArea,
    net_area_m2: cutArea - fillArea,
    cut_volume_m3: cutArea * width,
    fill_volume_m3: fillArea * width,
    net_volume_m3: (cutArea - fillArea) * width,
    series: out,
    warnings,
  }
}

const csvNumber = (value) => (finite(value) ? Number(value).toFixed(2) : '')

/** Plain CSV: distance / terrain / design / delta / segment slope (or terrain+slope without earthwork). */
export function profileCsv(metrics) {
  if (metrics?.include_design === false) {
    const rows = ['distance_m,height_m,slope_pct']
    for (const row of metrics?.series ?? []) {
      rows.push([csvNumber(row.distance_m), csvNumber(row.height_m), csvNumber(row.slope_pct)].join(','))
    }
    return `${rows.join('\r\n')}\r\n`
  }
  const rows = ['distance_m,terrain_m,design_m,delta_m,slope_pct']
  for (const row of metrics?.series ?? []) {
    rows.push([csvNumber(row.distance_m), csvNumber(row.height_m), csvNumber(row.design_m), csvNumber(row.delta_m), csvNumber(row.slope_pct)].join(','))
  }
  return `${rows.join('\r\n')}\r\n`
}

const escapeXml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/**
 * Standalone SVG chart (no external assets), suitable for a report or a slide.
 * `labels` supplies localized text; numbers come from `profileMetrics`.
 */
export function profileSvg(metrics, labels = {}) {
  const width = 900
  const height = 400
  const pad = { left: 58, right: 18, top: 58, bottom: 78 }
  const series = Array.isArray(metrics?.series) ? metrics.series : []
  const valid = series.filter((row) => finite(row.height_m))
  if (valid.length < 2) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 360"></svg>'
  const showDesign = metrics?.include_design !== false
  const designRows = showDesign ? series.filter((row) => finite(row.height_m) && finite(row.design_m)) : []
  const distances = series.map((row) => row.distance_m)
  const maxDistance = Math.max(...distances, 1)
  const values = [...valid.map((row) => row.height_m), ...designRows.map((row) => row.design_m)]
  let minValue = Math.min(...values)
  let maxValue = Math.max(...values)
  const valueRange = maxValue - minValue || 1
  minValue -= valueRange * 0.06
  maxValue += valueRange * 0.06
  const floorY = height - pad.bottom
  const x = (value) => pad.left + (width - pad.left - pad.right) * Math.min(1, Math.max(0, value / maxDistance))
  const y = (value) => floorY - (height - pad.top - pad.bottom) * ((value - minValue) / (maxValue - minValue))

  const segments = []
  const areaPolygons = []
  let current = []
  let currentCoords = []
  const flushSegment = () => {
    if (current.length === 0) return
    segments.push(current.join(' '))
    if (!showDesign && currentCoords.length >= 2) {
      const firstPx = currentCoords[0].px
      const lastPx = currentCoords[currentCoords.length - 1].px
      areaPolygons.push(
        `<polygon points="${firstPx},${floorY.toFixed(1)} ${current.join(' ')} ${lastPx},${floorY.toFixed(1)}" fill="#dbeafe" fill-opacity="0.72"/>`,
      )
    }
    current = []
    currentCoords = []
  }
  for (const row of series) {
    if (finite(row.height_m)) {
      const px = x(row.distance_m).toFixed(1)
      const py = y(row.height_m).toFixed(1)
      current.push(`${px},${py}`)
      currentCoords.push({ px, py })
    } else {
      flushSegment()
    }
  }
  flushSegment()

  const polygons = []
  if (showDesign) {
    for (let index = 0; index < series.length - 1; index += 1) {
      const left = series[index]
      const right = series[index + 1]
      if (!finite(left.height_m) || !finite(right.height_m) || !finite(left.design_m) || !finite(right.design_m)) continue
      const above = left.height_m >= left.design_m && right.height_m >= right.design_m
      const below = left.height_m <= left.design_m && right.height_m <= right.design_m
      const color = above ? '#f6c9c9' : below ? '#cfe8d5' : '#efefdf'
      polygons.push(
        `<polygon points="${x(left.distance_m).toFixed(1)},${y(left.height_m).toFixed(1)} ${x(right.distance_m).toFixed(1)},${y(right.height_m).toFixed(1)} ${x(right.distance_m).toFixed(1)},${y(right.design_m).toFixed(1)} ${x(left.distance_m).toFixed(1)},${y(left.design_m).toFixed(1)}" fill="${color}"/>`,
      )
    }
  }

  const ticks = []
  for (let index = 0; index <= 4; index += 1) {
    const value = minValue + ((maxValue - minValue) * index) / 4
    const py = y(value)
    ticks.push(`<line x1="${pad.left}" y1="${py.toFixed(1)}" x2="${width - pad.right}" y2="${py.toFixed(1)}" stroke="#e9edf2"/>`)
    ticks.push(`<text x="${pad.left - 8}" y="${(py + 4).toFixed(1)}" text-anchor="end" fill="#6b7280" font-size="11">${value.toFixed(0)}</text>`)
  }
  for (let index = 0; index <= 4; index += 1) {
    const value = (maxDistance * index) / 4
    const px = x(value)
    ticks.push(`<text x="${px.toFixed(1)}" y="${height - 50}" text-anchor="middle" fill="#6b7280" font-size="11">${Math.round(value)}</text>`)
  }

  const design = labels.design ?? 'Design'
  const terrain = labels.terrain ?? 'Surface'
  const title = labels.title ?? 'Elevation profile'
  const terrainLines = segments.map(
    (pointsText) =>
      `<polyline points="${pointsText}" fill="none" stroke="#1d4ed8" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>`,
  )
  const extremaMarkers = []
  if (!showDesign && finite(metrics.max_height_m) && finite(metrics.max_at_m)) {
    const mx = x(metrics.max_at_m)
    const my = y(metrics.max_height_m)
    extremaMarkers.push(`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4.5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5"/>`)
    extremaMarkers.push(`<text x="${Math.min(width - pad.right - 36, mx + 8).toFixed(1)}" y="${Math.max(pad.top + 12, my - 8).toFixed(1)}" fill="#1e3a8a" font-size="11" font-weight="600">max ${metrics.max_height_m.toFixed(1)} m</text>`)
  }
  if (!showDesign && finite(metrics.min_height_m) && finite(metrics.min_at_m)) {
    const vx = x(metrics.min_at_m)
    const vy = y(metrics.min_height_m)
    extremaMarkers.push(`<circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="4.5" fill="#0f766e" stroke="#ffffff" stroke-width="1.5"/>`)
    extremaMarkers.push(`<text x="${Math.min(width - pad.right - 36, vx + 8).toFixed(1)}" y="${Math.min(floorY - 6, vy + 16).toFixed(1)}" fill="#115e59" font-size="11" font-weight="600">min ${metrics.min_height_m.toFixed(1)} m</text>`)
  }
  const summaryRight = showDesign
    ? `${(metrics.distance_m / 1000).toFixed(2)} km · ${labels.cut ?? 'Cut'} ${Math.round(metrics.cut_volume_m3).toLocaleString()} m³ · ${labels.fill ?? 'Fill'} ${Math.round(metrics.fill_volume_m3).toLocaleString()} m³`
    : `${(metrics.distance_m / 1000).toFixed(2)} km · ${labels.surfaceLength ?? '3D'} ${(metrics.length_3d_m / 1000).toFixed(2)} km · ${labels.slopeMean ?? 'Slope'} ${finite(metrics.slope?.mean_abs_pct) ? `${metrics.slope.mean_abs_pct.toFixed(1)}%` : '—'}`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" font-family="system-ui, 'Segoe UI', 'Microsoft YaHei', sans-serif">`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    `<text x="${pad.left}" y="26" font-size="17" font-weight="600" fill="#111827">${escapeXml(title)}</text>`,
    `<text x="${pad.left}" y="44" fill="#9ca3af" font-size="10">${escapeXml(labels.note ?? '')}</text>`,
    ...ticks,
    ...areaPolygons,
    ...polygons,
    ...terrainLines,
    ...extremaMarkers,
    designRows.length >= 2
      ? `<line x1="${x(designRows[0].distance_m).toFixed(1)}" y1="${y(designRows[0].design_m).toFixed(1)}" x2="${x(designRows[designRows.length - 1].distance_m).toFixed(1)}" y2="${y(designRows[designRows.length - 1].design_m).toFixed(1)}" stroke="#c2610a" stroke-width="2.8" stroke-dasharray="8 5"/>`
      : '',
    `<line x1="${pad.left}" y1="${height - 34}" x2="${pad.left + 20}" y2="${height - 34}" stroke="#1d4ed8" stroke-width="3.2"/>`,
    `<text x="${pad.left + 26}" y="${height - 30}" fill="#6b7280" font-size="11">${escapeXml(terrain)}</text>`,
    showDesign
      ? `<line x1="${pad.left + 100}" y1="${height - 34}" x2="${pad.left + 120}" y2="${height - 34}" stroke="#c2610a" stroke-width="2.8" stroke-dasharray="8 5"/><text x="${pad.left + 126}" y="${height - 30}" fill="#6b7280" font-size="11">${escapeXml(design)}</text>`
      : '',
    `<text x="${width - pad.right}" y="${height - 12}" text-anchor="end" fill="#6b7280" font-size="11">${escapeXml(labels.distance ?? 'Distance (m)')}</text>`,
    `<text x="${width - pad.right}" y="40" text-anchor="end" fill="#9ca3af" font-size="11">${escapeXml(summaryRight)}</text>`,
    '</svg>',
  ].join('')
}

/**
 * Chart hover → sample index: the sample closest to `ratio` of the max distance.
 * Returns -1 when the series has no usable distance (never a guessed 0).
 */
export function nearestProfileIndex(points, ratio) {
  if (!Array.isArray(points) || points.length === 0) return -1
  const maximum = points.reduce((best, point) => Math.max(best, asNumber(point?.distance_m) ?? 0), 0)
  if (!(maximum > 0)) return -1
  const clamped = Math.min(1, Math.max(0, asNumber(ratio) ?? 0))
  const target = clamped * maximum
  let index = -1
  let bestDistance = Number.POSITIVE_INFINITY
  for (let position = 0; position < points.length; position += 1) {
    const distance = asNumber(points[position]?.distance_m)
    if (distance === null) continue
    const delta = Math.abs(distance - target)
    if (delta < bestDistance) {
      index = position
      bestDistance = delta
    }
  }
  return index
}
