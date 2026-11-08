import React from 'react'
import { shaderHeightRange } from '../shader/presets.js'
import { cachedElevationRange, sampleElevationRange } from '../shader/elevation-range.js'

const h = React.createElement

export function useShaderElevation(target, getScene) {
  const tileset = target?.layer?.tileset
  const sceneRef = React.useRef(getScene)
  sceneRef.current = getScene
  const abortRef = React.useRef(null)
  const [range, setRange] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const refresh = React.useCallback(async (force = false) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { Cesium, viewer } = sceneRef.current?.() ?? {}
    if (!tileset || !Cesium || !viewer) { setRange(null); setBusy(false); return null }
    const fallback = shaderHeightRange(Cesium, tileset, null)
    const cached = cachedElevationRange(tileset)
    setRange({ ...fallback, ...cached })
    if (cached && !force) { setBusy(false); return cached }
    setBusy(true)
    try {
      const sampled = await sampleElevationRange(Cesium, viewer, tileset, controller.signal)
      if (controller.signal.aborted) return null
      const result = sampled ? { ...fallback, ...sampled } : fallback
      setRange(result)
      return result
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }, [tileset])
  React.useEffect(() => {
    void refresh()
    return () => abortRef.current?.abort()
  }, [refresh])
  return { range, busy, refresh }
}

export function elevationSliderBounds(range, form) {
  const minimum = range?.minimum ?? 0
  const maximum = range?.maximum ?? 200
  const padding = Math.max(2, (maximum - minimum) * 0.1)
  const presets = Array.isArray(form.preset) ? form.preset : [form.preset]
  const values = [minimum, maximum, ...['minHeight', 'maxHeight', 'waterHeight'].map((key) => form[key] === '' ? key === 'waterHeight' && presets.includes('water-depth') ? 0 : null : Number(form[key]))].filter(Number.isFinite)
  return { min: Math.max(-1000, Math.floor(Math.min(...values) - padding)), max: Math.min(9000, Math.ceil(Math.max(...values) + padding)), step: maximum - minimum < 20 ? 0.1 : 1 }
}

export function ElevationLegend({ range, minimum, maximum, t, onFit, busy }) {
  const outside = range && (maximum < range.minimum || minimum > range.maximum)
  return h('div', { className: 'mv-elevation-legend' },
    h('p', null, t('shader.elevationPurpose')),
    h('div', { className: 'ramp', role: 'img', 'aria-label': t('shader.elevationScale', { min: minimum.toFixed(1), max: maximum.toFixed(1) }) }),
    h('div', { className: 'ticks' }, h('span', null, `${minimum.toFixed(1)} m`), h('span', null, `${((minimum + maximum) / 2).toFixed(1)} m`), h('span', null, `${maximum.toFixed(1)} m`)),
    h('p', { className: outside ? 'warning' : '' }, outside ? t('shader.rangeOutside') : t(range?.source === 'visible_surface' ? 'shader.rangeSampled' : 'shader.rangeBounds')),
    h('button', { type: 'button', className: 'mv-cta', disabled: busy, onClick: onFit }, t(busy ? 'shader.rangeReading' : 'shader.fitRange')))
}
