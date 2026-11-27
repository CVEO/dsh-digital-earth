/**
 * host/geotiff/render.js — band selection, statistics and the RGBA renderer.
 *
 * The same render settings drive the dialog preview and the published XYZ tiles,
 * so what the operator approves on screen is what the globe shows afterwards.
 * Defaults are chosen for survey data rather than for photos: 16-bit imagery gets
 * a 2–98% percentile stretch (otherwise it looks black), single band is grey, a
 * palette TIFF keeps its palette, and nodata becomes transparent.
 */
import { TiffError } from './tiff.js'

/** Percentile of a numeric array (0..100), ignoring NaN. */
function percentile(values, fraction) {
  if (values.length === 0) return Number.NaN
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (sorted.length === 0) return Number.NaN
  const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))
  return sorted[at]
}

/**
 * Sample the image (through its overview-free reader) and describe every band.
 * 128×128 samples are enough for a stable 2–98% stretch and keep a 2 GB file fast.
 */
export async function computeStats(reader, { sampleSize = 128 } = {}) {
  const sample = await reader.readWindow({ outWidth: sampleSize, outHeight: sampleSize })
  const bands = []
  for (let band = 0; band < sample.bands.length; band += 1) {
    const values = Array.from(sample.bands[band]).filter(
      (value) => Number.isFinite(value) && (reader.nodata === null || value !== reader.nodata),
    )
    const sorted = values.slice().sort((a, b) => a - b)
    bands.push({
      index: band,
      min: sorted.length > 0 ? sorted[0] : Number.NaN,
      max: sorted.length > 0 ? sorted[sorted.length - 1] : Number.NaN,
      p2: percentile(values, 0.02),
      p98: percentile(values, 0.98),
      mean: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN,
    })
  }
  return { bands }
}

/** Default band mapping: RGB for colour imagery, band 1 for single band. */
export function defaultRender(reader) {
  const colorBands = reader.samplesPerPixel >= 3 ? [0, 1, 2] : [0]
  return {
    bands: colorBands,
    stretch: { mode: 'percentile', lo: 2, hi: 98 },
    gamma: 1,
    colormap: colorBands.length === 1 ? 'gray' : null,
    resampling: 'bilinear',
  }
}

/** Coerce an untrusted render object (from the panel) into a usable setting. */
export function normalizeRender(reader, raw) {
  const base = defaultRender(reader)
  if (raw === null || typeof raw !== 'object') return base
  const maxBand = reader.samplesPerPixel - 1
  const wanted = Array.isArray(raw.bands) ? raw.bands : []
  const bands = wanted
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= maxBand)
  if (bands.length !== 0 && bands.length !== 1 && bands.length !== 3) return base
  const stretchRaw = raw.stretch && typeof raw.stretch === 'object' ? raw.stretch : {}
  const mode = ['percentile', 'minmax', 'manual'].includes(stretchRaw.mode) ? stretchRaw.mode : base.stretch.mode
  // NaN becomes null over JSON (the dialog probes, the host publishes), so an
  // absent bound must stay absent instead of silently becoming 0.
  const clamp = (value, fallback) =>
    value === null || value === undefined || !Number.isFinite(Number(value)) ? fallback : Number(value)
  const gamma = clamp(raw.gamma, 1)
  return {
    bands: bands.length > 0 ? bands : base.bands,
    stretch: {
      mode,
      lo: Math.min(50, Math.max(0, clamp(stretchRaw.lo, 2))),
      hi: Math.max(50, Math.min(100, clamp(stretchRaw.hi, 98))),
      min: clamp(stretchRaw.min, Number.NaN),
      max: clamp(stretchRaw.max, Number.NaN),
    },
    gamma: Math.min(4, Math.max(0.2, gamma)),
    colormap: typeof raw.colormap === 'string' ? raw.colormap : base.colormap,
    resampling: raw.resampling === 'nearest' ? 'nearest' : 'bilinear',
  }
}

/** A colour ramp for single-band data; returns [r,g,b] 0..255. */
const RAMPS = {
  gray: (value) => [value, value, value],
  viridis: (value) => {
    const stops = [
      [68, 1, 84],
      [59, 82, 139],
      [33, 145, 140],
      [94, 201, 98],
      [253, 231, 37],
    ]
    const at = (value / 255) * (stops.length - 1)
    const low = Math.min(stops.length - 1, Math.floor(at))
    const high = Math.min(stops.length - 1, low + 1)
    const t = at - low
    return stops[low].map((channel, index) => Math.round(channel + (stops[high][index] - channel) * t))
  },
  terrain: (value) => {
    const stops = [
      [40, 80, 160],
      [80, 150, 90],
      [200, 190, 120],
      [150, 110, 80],
      [255, 255, 255],
    ]
    const at = (value / 255) * (stops.length - 1)
    const low = Math.min(stops.length - 1, Math.floor(at))
    const high = Math.min(stops.length - 1, low + 1)
    const t = at - low
    return stops[low].map((channel, index) => Math.round(channel + (stops[high][index] - channel) * t))
  },
}

function paletteLookup(colorMap) {
  if (!Array.isArray(colorMap) || colorMap.length < 768) return null
  const table = []
  for (let index = 0; index < 256; index += 1) {
    table.push([
      Math.round((colorMap[index] ?? 0) / 257),
      Math.round((colorMap[256 + index] ?? 0) / 257),
      Math.round((colorMap[512 + index] ?? 0) / 257),
    ])
  }
  return table
}

/**
 * Render a read window into RGBA bytes.
 *
 * @param {object} reader
 * @param {{bands:object[],stretch:object,gamma:number,colormap:string|null}} render normalized settings
 * @param {{width:number,height:number,bands:Float32Array[]}} sample readWindow output
 */
export function renderRgba(reader, render, sample) {
  const { width, height, bands } = sample
  const rgba = new Uint8Array(width * height * 4)
  const allBands = Array.isArray(reader.bits) && reader.bits.length > 0 ? reader.bits : [8]
  const stats = render.stats ?? []
  const ranges = render.bands.map((bandIndex, slot) => {
    // stats[] is indexed by source band; the output slot can differ when the
    // caller reorders bands (native 4-band RGBA, NIR composites).
    const bandStats = stats[bandIndex] ?? stats[slot] ?? {}
    if (render.stretch.mode === 'manual' && Number.isFinite(render.stretch.min) && Number.isFinite(render.stretch.max)) {
      return [render.stretch.min, render.stretch.max]
    }
    if (render.stretch.mode === 'minmax' && Number.isFinite(bandStats.min) && Number.isFinite(bandStats.max)) {
      return [bandStats.min, bandStats.max]
    }
    if (Number.isFinite(bandStats.p2) && Number.isFinite(bandStats.p98) && bandStats.p98 > bandStats.p2) {
      return [bandStats.p2, bandStats.p98]
    }
    return [0, Math.max(1, (allBands[bandIndex] ?? 8) === 8 ? 255 : 65535)]
  })
  const gamma = render.gamma ?? 1
  const palette = paletteLookup(reader.colorMap)
  const ramp = RAMPS[render.colormap] ?? RAMPS.gray
  const scale = (value, [min, max]) => {
    if (!Number.isFinite(value)) return Number.NaN
    const normalized = max === min ? 0 : (value - min) / (max - min)
    const clamped = Math.min(1, Math.max(0, normalized))
    return gamma === 1 ? clamped : clamped ** (1 / gamma)
  }
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * 4
    if (render.bands.length >= 3) {
      const red = scale(bands[0][pixel], ranges[0])
      const green = scale(bands[1][pixel], ranges[1])
      const blue = scale(bands[2][pixel], ranges[2])
      if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) {
        rgba[at + 3] = 0
        continue
      }
      rgba[at] = Math.round(red * 255)
      rgba[at + 1] = Math.round(green * 255)
      rgba[at + 2] = Math.round(blue * 255)
      rgba[at + 3] = 255
      continue
    }
    const value = bands[0][pixel]
    if (Number.isNaN(value)) {
      rgba[at + 3] = 0
      continue
    }
    if (palette) {
      const index = Math.min(255, Math.max(0, Math.round(value)))
      const [red, green, blue] = palette[index]
      rgba[at] = red
      rgba[at + 1] = green
      rgba[at + 2] = blue
      rgba[at + 3] = 255
      continue
    }
    const normalized = scale(value, ranges[0])
    const [red, green, blue] = ramp(Math.round(normalized * 255))
    rgba[at] = red
    rgba[at + 1] = green
    rgba[at + 2] = blue
    rgba[at + 3] = 255
  }
  return rgba
}

/**
 * Render a whole-image preview at no more than `maxSize` pixels on the long edge.
 * @returns {Promise<{width:number,height:number,rgba:Uint8Array}>}
 */
export async function renderPreview(reader, geo, render, { maxSize = 2048 } = {}) {
  const aspect = reader.width / reader.height
  const width = Math.max(1, Math.round(aspect >= 1 ? Math.min(maxSize, reader.width) : Math.min(maxSize, reader.height) * aspect))
  const height = Math.max(1, Math.round(aspect >= 1 ? Math.min(maxSize, reader.width) / aspect : Math.min(maxSize, reader.height)))
  const sample = await reader.readWindow({ outWidth: width, outHeight: height, bands: render.bands })
  const rgba = renderRgba(reader, render, sample)
  return { width, height, rgba, bands: sample.bands }
}

/** Reject a file before any decode when its container is outside our scope. */
export function assertPublishable(reader) {
  if (reader.samplesPerPixel > 4) {
    throw new TiffError('bands', `Unsupported ${reader.samplesPerPixel}-band TIFF (max 4)`)
  }
  if (reader.photometric === 3 && !Array.isArray(reader.colorMap)) {
    throw new TiffError('palette', 'Palette TIFF is missing its colour map')
  }
}
