/**
 * ui/cards.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { formatDistance, formatHeight } from '../format.js'
import { profileCsv, profileMetrics, profileSvg } from '../analysis/profile-metrics.js'
import { SHADER_PRESETS } from '../shader/presets.js'
import { ElevationLegend, elevationSliderBounds, useShaderElevation } from './shader-elevation.js'

const h = React.createElement

    //#region analysis card ----------------------------------------------------

    const analysisMetric = (value, digits = 1) =>
      typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'

    const formatVolume = (value) =>
      typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value).toLocaleString()} m³` : '—'

    const clampProfileWidth = (value) => {
      const number = Number(value)
      if (!Number.isFinite(number)) return 7
      return Math.min(100, Math.max(1, Math.round(number)))
    }

    const profileChartLabels = (t) => ({
      title: t('analysis.title.profile'),
      distance: t('profile.axisDistance'),
      elevation: t('profile.axisElevation'),
      terrain: t('profile.terrain'),
      design: t('profile.design'),
      cut: t('profile.cut'),
      fill: t('profile.fill'),
      note: t('profile.note'),
    })

    /** Client-side file download for profile CSV/SVG (no Host round-trip). */
    function downloadText(filename, text, mime) {
      if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return false
      const blob = new Blob([text], { type: mime })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return true
    }

    /** SVG distance–elevation chart; gaps in the sampled data stay visible. */
    function AnalysisProfileChart({ points, t }) {
      if (!Array.isArray(points) || points.length < 2) return null
      const width = 260
      const height = 92
      const padX = 10
      const padY = 12
      const valid = points.filter(
        (point) => point && typeof point.height_m === 'number' && Number.isFinite(point.height_m),
      )
      if (valid.length < 2) return null
      const maxDistance = Math.max(...points.map((point) => Number(point.distance_m) || 0), 1)
      const minimum = Math.min(...valid.map((point) => point.height_m))
      const maximum = Math.max(...valid.map((point) => point.height_m))
      const range = maximum - minimum || 1
      const x = (distance) => padX + (width - padX * 2) * Math.min(1, Math.max(0, distance / maxDistance))
      const y = (value) => height - padY - (height - padY * 2) * ((value - minimum) / range)
      const segments = []
      let current = []
      for (const point of points) {
        const heightValue = point ? point.height_m : null
        if (typeof heightValue === 'number' && Number.isFinite(heightValue)) {
          const distance = Number(point.distance_m) || 0
          current.push(`${x(distance).toFixed(1)},${y(heightValue).toFixed(1)}`)
        } else if (current.length > 0) {
          segments.push(current.join(' '))
          current = []
        }
      }
      if (current.length > 0) segments.push(current.join(' '))
      return h(
        'svg',
        {
          className: 'chart',
          viewBox: `0 0 ${width} ${height}`,
          role: 'img',
          'aria-label': t('analysis.chart'),
        },
        h('line', {
          x1: padX,
          y1: height - padY,
          x2: width - padX,
          y2: height - padY,
          stroke: 'var(--mv-line)',
        }),
        ...segments.map((pointsText, index) =>
          h('polyline', {
            key: `segment-${index}`,
            points: pointsText,
            fill: 'none',
            stroke: 'var(--mv-profile-line)',
            strokeWidth: 3,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
          }),
        ),
        h('text', { x: padX, y: padY - 3 }, formatHeight(maximum)),
        h('text', { x: padX, y: height - 2 }, formatHeight(minimum)),
        h('text', { x: width - padX, y: height - 2, textAnchor: 'end' }, formatDistance(maxDistance)),
      )
    }

    /** Full-size profile preview; the card keeps a thumbnail that opens this. */
    function ProfileChartDialog({ metrics, t, onClose }) {
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onClose])

      const svg = profileSvg(metrics, profileChartLabels(t))
      const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      return h(
        'div',
        {
          className: 'mv-modal mv-chart-modal',
          onPointerDown: (event) => event.target === event.currentTarget && onClose(),
        },
        h(
          'div',
          { className: 'mv-chart-dialog', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'mv-chart-title' },
          h(
            'header',
            null,
            h('b', { id: 'mv-chart-title' }, t('profile.chartTitle')),
            h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: onClose }, '✕'),
          ),
          h('div', { className: 'mv-chart-body' }, h('img', { src, alt: t('profile.chartTitle') })),
          h(
            'div',
            { className: 'mv-chart-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'mv-cta',
                onClick: () => downloadText(`profile-${Date.now()}.csv`, profileCsv(metrics), 'text/csv;charset=utf-8'),
              },
              t('profile.exportCsv'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mv-cta',
                onClick: () => downloadText(`profile-${Date.now()}.svg`, svg, 'image/svg+xml'),
              },
              t('profile.exportSvg'),
            ),
            h('span', { className: 'mv-chart-note' }, t('profile.note')),
          ),
        ),
      )
    }

    /** Floating result card for the single active analysis. */
    function AnalysisCard({ state, t, onClose }) {
      const [open, setOpen] = React.useState(true)
      // A2 profile extras are display-side only: the Agent contract stays the same.
      const [profileMode, setProfileMode] = React.useState('grade')
      const [profileWidth, setProfileWidth] = React.useState(7)
      const [chartOpen, setChartOpen] = React.useState(false)
      if (!state || !state.result) return null
      const result = state.result
      const operation = state.operation
      const profile = operation === 'profile' ? profileMetrics(result.points, { mode: profileMode, width_m: profileWidth }) : null
      const showProfile = Boolean(profile && profile.valid_count >= 2)
      const rows = []
      const row = (key, label, value) =>
        rows.push(h('div', { key, className: 'stat' }, h('span', null, label), h('b', null, value)))
      if (operation === 'profile') {
        const stats = result.stats ?? {}
        row('length', t('analysis.length'), formatDistance(result.length_m ?? 0))
        row('min', t('analysis.minHeight'), formatHeight(stats.min_height ?? 0))
        row('max', t('analysis.maxHeight'), formatHeight(stats.max_height ?? 0))
        row('relief', t('analysis.relief'), formatHeight(stats.relief_m ?? 0))
        row('gain', t('analysis.gain'), formatHeight(stats.gain_m ?? 0))
        row('loss', t('analysis.loss'), formatHeight(stats.loss_m ?? 0))
        row('samples', t('analysis.samples'), `${result.samples ?? 0}`)
        if (showProfile) {
          row('slopeMean', t('profile.slopeMean'), `${analysisMetric(profile.slope.mean_abs_pct)}%`)
          row(
            'slopeMax',
            t('profile.slopeMax'),
            `${analysisMetric(profile.slope.max_abs_pct)}% · ${formatDistance(profile.slope.max_at_m ?? 0)}`,
          )
          row('designGrade', t('profile.designGrade'), `${analysisMetric(profile.design_grade_pct)}%`)
          row('cut', t('profile.cut'), formatVolume(profile.cut_volume_m3))
          row('fill', t('profile.fill'), formatVolume(profile.fill_volume_m3))
          row('net', t('profile.net'), formatVolume(profile.net_volume_m3))
        }
      } else if (operation === 'flood') {
        row('water', t('analysis.waterHeight'), formatHeight(result.water_height ?? 0))
        row('area', t('analysis.area'), `${analysisMetric(result.area_km2, 3)} km²`)
        row('inundated', t('analysis.inundated'), `${analysisMetric(result.inundated_km2, 3)} km²`)
        row('ratio', t('analysis.inundatedRatio'), `${analysisMetric((result.inundated_ratio ?? 0) * 100, 1)}%`)
        row('depthMax', t('analysis.depthMax'), formatHeight(result.depth_max_m ?? 0))
        row('depthMean', t('analysis.depthMean'), formatHeight(result.depth_mean_m ?? 0))
        row(
          'samples',
          t('analysis.inundatedSamples'),
          `${result.samples_inundated ?? 0} / ${result.samples_with_data ?? 0}`,
        )
        const region = result.region ?? {}
        row(
          'region',
          t('analysis.region'),
          `${analysisMetric(region.west, 2)}, ${analysisMetric(region.south, 2)} – ${analysisMetric(region.east, 2)}, ${analysisMetric(region.north, 2)}`,
        )
      } else if (operation === 'sunlight') {
        let dateText = String(result.datetime ?? '')
        try {
          dateText = new Date(result.datetime).toLocaleString()
        } catch {
          /* keep the raw ISO text */
        }
        row('datetime', t('analysis.datetime'), dateText)
        row('altitude', t('analysis.altitude'), `${analysisMetric(result.sun?.altitude_deg, 2)}°`)
        row('azimuth', t('analysis.azimuth'), `${analysisMetric(result.sun?.azimuth_deg, 2)}°`)
        row('shadows', t('analysis.shadows'), result.shadows_enabled ? t('analysis.shadowsOn') : t('analysis.shadowsOff'))
        row('daylight', t('analysis.daylight'), result.night ? t('analysis.night') : t('analysis.day'))
      } else if (operation === 'skyline') {
        row('angle', t('analysis.skylineAngle'), `${analysisMetric(result.max_angle_deg, 2)}°`)
        row('distance', t('analysis.skylineDistance'), formatDistance(result.max_distance_m ?? 0))
        row('eye', t('analysis.skylineEye'), formatHeight(result.eye_height_m ?? 0))
        row('samples', t('analysis.samples'), `${result.samples ?? 0}`)
      } else if (operation === 'clip') {
        row('height', t('analysis.clipHeight'), formatHeight(result.height ?? 0))
        row(
          'keep',
          t('analysis.clipKeep'),
          result.keep === 'above' ? t('analysis.clipKeepAbove') : t('analysis.clipKeepBelow'),
        )
        row('planes', t('analysis.clipPlanes'), `${result.planes ?? 1}`)
      }
      return h(
        'div',
        { className: 'mv-card mv-analysis', role: 'region', 'aria-label': t(`analysis.title.${operation}`) },
        h(
          'header',
          null,
          h('span', { className: 'title' }, t(`analysis.title.${operation}`)),
          h(
            'button',
            {
              type: 'button',
              className: 'mv-icon-btn',
              title: open ? t('analysis.collapse') : t('analysis.expand'),
              'aria-label': open ? t('analysis.collapse') : t('analysis.expand'),
              'aria-expanded': open,
              onClick: () => setOpen(!open),
            },
            open ? '▾' : '▸',
          ),
          h(
            'button',
            { type: 'button', className: 'mv-icon-btn', title: t('analysis.close'), 'aria-label': t('analysis.close'), onClick: onClose },
            '✕',
          ),
        ),
        open
          ? h(
              'div',
              { className: 'body' },
              state.layerName
                ? h('div', { className: 'layer', title: state.layerName }, `${t('analysis.layer')}: ${state.layerName}`)
                : null,
              ...rows,
              operation === 'profile' && !showProfile ? h(AnalysisProfileChart, { points: result.points, t }) : null,
              showProfile
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'profile-chart-thumb',
                      title: t('profile.expandChart'),
                      'aria-label': t('profile.expandChart'),
                      onClick: () => setChartOpen(true),
                    },
                    h(AnalysisProfileChart, { points: result.points, t }),
                    h('span', { className: 'profile-chart-hint' }, t('profile.expandChart')),
                  )
                : null,
              showProfile
                ? h(
                    'div',
                    { key: 'profile-tools', className: 'profile-tools' },
                    h(
                      'div',
                      { className: 'profile-row' },
                      h(
                        'select',
                        {
                          value: profileMode,
                          'aria-label': t('profile.baseline'),
                          onChange: (event) => setProfileMode(event.target.value),
                        },
                        h('option', { value: 'grade' }, t('profile.mode.grade')),
                        h('option', { value: 'level' }, t('profile.mode.level')),
                      ),
                      h(
                        'label',
                        { className: 'profile-width' },
                        t('profile.width'),
                        h('input', {
                          type: 'number',
                          min: 1,
                          max: 100,
                          step: 1,
                          value: profileWidth,
                          'aria-label': t('profile.width'),
                          onChange: (event) => setProfileWidth(clampProfileWidth(event.target.value)),
                        }),
                      ),
                    ),
                    h(
                      'div',
                      { className: 'profile-row' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-cta',
                          onClick: () =>
                            downloadText(`profile-${Date.now()}.csv`, profileCsv(profile), 'text/csv;charset=utf-8'),
                        },
                        t('profile.exportCsv'),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-cta',
                          onClick: () =>
                            downloadText(
                              `profile-${Date.now()}.svg`,
                              profileSvg(profile, profileChartLabels(t)),
                              'image/svg+xml',
                            ),
                        },
                        t('profile.exportSvg'),
                      ),
                    ),
                    h('p', { className: 'profile-note' }, t('profile.note')),
                  )
                : null,
              h('p', { className: 'hint' }, t('analysis.hint')),
            )
          : null,
        chartOpen && showProfile
          ? h(ProfileChartDialog, { key: 'chart-dialog', metrics: profile, t, onClose: () => setChartOpen(false) })
          : null,
      )
    }
    //#endregion analysis card

    //#region shader workbench ------------------------------------------------
    /**
     * B3 workbench: a compact floating card. It can pick a visible layer, one or up
     * to three of the five presets (D-17 stacking) and their bounded parameters; it
     * never edits GLSL. v1.6 second pass: readable solid card, at-a-glance preset
     * thumbnails, explicit target layer, ordered stack controls, sliders with an
     * optional live preview and a press-to-compare original view.
     */
    function ShaderWorkbench({
      t,
      layers,
      form,
      active,
      target,
      getScene,
      onClose,
      onLayer,
      onPreset,
      onPresetMove,
      onField,
      onPreview,
      onCompare,
      onApply,
      onResetLayer,
      onResetAll,
    }) {
      const visibleLayers = layers.filter((layer) => layer.visible)
      // form.preset is a string for one preset or an ordered array for a stack;
      // the helper keeps the rest of the card stack-agnostic.
      const selectedPresets = Array.isArray(form.preset) ? form.preset : [form.preset]
      const presetLabel = (value) =>
        (Array.isArray(value) ? value : [value]).map((item) => t(`shader.preset.${item}`)).join(' + ')
      const [live, setLive] = React.useState(false)
      const [comparing, setComparing] = React.useState(false)
      const comparingRef = React.useRef(false)
      // Leaving the card must never leave the layer in "original look" mode.
      React.useEffect(
        () => () => {
          if (comparingRef.current) onCompare(false)
        },
        [],
      )
      const targetName = target?.layer?.name ?? ''
      const elevation = useShaderElevation(target, getScene)
      const bounds = elevationSliderBounds(elevation.range, form)
      const rangeMinimum = form.minHeight === '' ? elevation.range?.minimum ?? 0 : Number(form.minHeight)
      const rangeMaximum = form.maxHeight === '' ? elevation.range?.maximum ?? 200 : Number(form.maxHeight)
      const fitRange = async () => {
        const range = await elevation.refresh(true)
        if (!range) return
        onField('minHeight', '')
        onField('maxHeight', '')
        if (live) onPreview()
      }
      const changeField = (key, value) => {
        onField(key, value)
        if (live) onPreview()
      }
      const toggleCompare = () => {
        const next = !comparing
        setComparing(next)
        comparingRef.current = next
        onCompare(next)
      }
      // Applying/resetting while the original is shown would leave the button in the
      // wrong state (the engine ends the comparison by itself), so close it first.
      const stopCompare = () => {
        if (!comparingRef.current) return
        comparingRef.current = false
        setComparing(false)
        onCompare(false)
      }
      const runApply = () => {
        stopCompare()
        onApply()
      }
      const runResetLayer = () => {
        stopCompare()
        onResetLayer()
      }
      const runResetAll = () => {
        stopCompare()
        onResetAll()
      }

      const sliderField = (key, labelKey, min, max, step, fallback = '') =>
        h(
          'div',
          { className: 'param', key },
          h('div', { className: 'param-head' }, h('label', { htmlFor: `mv-shader-${key}` }, t(labelKey))),
          h(
            'div',
            { className: 'param-controls' },
            h('input', {
              className: 'slider',
              type: 'range',
              min,
              max,
              step,
              value: form[key] === '' ? fallback : form[key],
              'aria-label': t(labelKey),
              onChange: (event) => changeField(key, event.target.value),
            }),
            h('input', {
              className: 'number',
              id: `mv-shader-${key}`,
              type: 'number',
              inputMode: 'decimal',
              step: 'any',
              value: form[key],
              placeholder: t('shader.param.auto'),
              onChange: (event) => changeField(key, event.target.value),
            }),
          ),
        )

      // Parameters are the union of the selected presets (each preset contributes
      // its own bounded fields, shown in selection order).
      const paramRows = []
      if (selectedPresets.includes('height-false-color')) {
        paramRows.push(
          sliderField('minHeight', 'shader.param.minHeight', bounds.min, bounds.max, bounds.step, String(rangeMinimum)),
          sliderField('maxHeight', 'shader.param.maxHeight', bounds.min, bounds.max, bounds.step, String(rangeMaximum)),
        )
      }
      if (selectedPresets.includes('contour')) paramRows.push(sliderField('interval', 'shader.param.interval', 1, 500, 1, '20'))
      if (selectedPresets.includes('scan') || selectedPresets.includes('water')) {
        paramRows.push(sliderField('speed', 'shader.param.speed', 0.1, 10, 0.1, '1'))
      }
      if (selectedPresets.includes('water')) {
        paramRows.push(sliderField('amplitude', 'shader.param.amplitude', 0.1, 5, 0.1, '1'), sliderField('opacity', 'shader.param.opacity', 0.05, 1, 0.05, '0.75'))
      }
      if (selectedPresets.includes('water-depth')) {
        paramRows.push(sliderField('waterHeight', 'shader.param.waterHeight', bounds.min, bounds.max, bounds.step, '0'), sliderField('depthMax', 'shader.param.depthMax', 0.5, Math.max(50, Math.min(500, Number(form.depthMax) || 50, (elevation.range?.maximum ?? 50) - (elevation.range?.minimum ?? 0))), 0.5, '50'))
      }
      const params = paramRows.length > 0 ? h('div', { className: 'params' }, ...paramRows) : null

      // At-a-glance previews: colour ramp / isolines / moving band / ripples / depth.
      const thumb = (preset) => {
        const viewBox = '0 0 96 40'
        const common = { viewBox, preserveAspectRatio: 'none', className: 'thumb-svg', 'aria-hidden': true }
        if (preset === 'height-false-color') {
          return h(
            'svg',
            common,
            h(
              'defs',
              null,
              h(
                'linearGradient',
                { id: 'mv-thumb-ramp', x1: '0', y1: '0', x2: '1', y2: '0' },
                h('stop', { offset: '0', stopColor: '#172466' }),
                h('stop', { offset: '0.28', stopColor: '#157db3' }),
                h('stop', { offset: '0.52', stopColor: '#3dcc99' }),
                h('stop', { offset: '0.78', stopColor: '#fcc951' }),
                h('stop', { offset: '1', stopColor: '#f05c4d' }),
              ),
            ),
            h('rect', { width: '96', height: '40', fill: 'url(#mv-thumb-ramp)', opacity: '0.9' }),
            h('path', { d: 'M0 34 L18 22 L34 28 L52 12 L70 18 L96 6 L96 40 L0 40 Z', fill: 'rgba(8,14,24,.35)' }),
          )
        }
        if (preset === 'contour') {
          return h(
            'svg',
            common,
            h('rect', { width: '96', height: '40', fill: '#0e1620' }),
            ...[0, 1, 2, 3].map((index) =>
              h('path', {
                key: index,
                d: `M0 ${10 + index * 7} C 16 ${4 + index * 8}, 32 ${18 + index * 6}, 48 ${10 + index * 7} S 80 ${2 + index * 9}, 96 ${12 + index * 6}`,
                fill: 'none',
                stroke: '#9fdcff',
                strokeWidth: '1.4',
                opacity: 0.85 - index * 0.12,
              }),
            ),
          )
        }
        if (preset === 'scan') {
          return h(
            'svg',
            common,
            h('rect', { width: '96', height: '40', fill: '#0b1119' }),
            ...[0, 1, 2, 3, 4].map((index) =>
              h('line', { key: index, x1: '0', y1: 8 + index * 8, x2: '96', y2: 8 + index * 8, stroke: '#243244', strokeWidth: '0.5' }),
            ),
            h(
              'defs',
              null,
              h(
                'linearGradient',
                { id: 'mv-thumb-scan', x1: '0', y1: '0', x2: '1', y2: '0' },
                h('stop', { offset: '0', stopColor: 'rgba(55,230,255,0)' }),
                h('stop', { offset: '0.5', stopColor: 'rgba(55,230,255,.85)' }),
                h('stop', { offset: '1', stopColor: 'rgba(55,230,255,0)' }),
              ),
            ),
            h('rect', { x: '30', y: '14', width: '36', height: '12', fill: 'url(#mv-thumb-scan)' }),
          )
        }
        if (preset === 'water') {
          return h(
            'svg',
            common,
            h(
              'defs',
              null,
              h(
                'linearGradient',
                { id: 'mv-thumb-water', x1: '0', y1: '0', x2: '0', y2: '1' },
                h('stop', { offset: '0', stopColor: '#0b2b52' }),
                h('stop', { offset: '1', stopColor: '#1b6fae' }),
              ),
            ),
            h('rect', { width: '96', height: '40', fill: 'url(#mv-thumb-water)' }),
            ...[0, 1, 2].map((index) =>
              h('path', {
                key: index,
                d: `M0 ${14 + index * 8} Q 12 ${8 + index * 8}, 24 ${14 + index * 8} T 48 ${14 + index * 8} T 72 ${14 + index * 8} T 96 ${14 + index * 8}`,
                fill: 'none',
                stroke: '#9fd7ff',
                strokeWidth: '1.3',
                opacity: 0.5,
              }),
            ),
          )
        }
        return h(
          'svg',
          common,
          h(
            'defs',
            null,
            h(
              'linearGradient',
              { id: 'mv-thumb-depth', x1: '0', y1: '0', x2: '0', y2: '1' },
              h('stop', { offset: '0', stopColor: '#67e8f9' }),
              h('stop', { offset: '0.55', stopColor: '#0e7490' }),
              h('stop', { offset: '1', stopColor: '#0b1e4b' }),
            ),
          ),
          h('rect', { width: '96', height: '40', fill: 'url(#mv-thumb-depth)' }),
          h('line', { x1: '0', y1: '16', x2: '96', y2: '16', stroke: 'rgba(255,255,255,.65)', strokeWidth: '0.8' }),
        )
      }

      const orderList =
        selectedPresets.length > 1
          ? h(
              'div',
              { className: 'order', role: 'list', 'aria-label': t('shader.orderLabel') },
              ...selectedPresets.map((preset, index) =>
                h(
                  'div',
                  { key: preset, className: 'order-item', role: 'listitem' },
                  h('span', { className: 'index' }, `${index + 1}`),
                  h('span', { className: 'order-name', title: t(`shader.preset.${preset}`) }, t(`shader.preset.${preset}`)),
                  h(
                    'button',
                    { type: 'button', className: 'mv-icon-btn', title: t('shader.moveUp'), disabled: index === 0, onClick: () => onPresetMove(preset, -1) },
                    '↑',
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'mv-icon-btn', title: t('shader.moveDown'), disabled: index === selectedPresets.length - 1, onClick: () => onPresetMove(preset, 1) },
                    '↓',
                  ),
                  h('button', { type: 'button', className: 'mv-icon-btn', title: t('shader.removePreset'), onClick: () => onPreset(preset) }, '✕'),
                ),
              ),
            )
          : null

      return h(
        'div',
        { className: 'mv-card mv-shader', role: 'region', 'aria-label': t('shader.title') },
        h(
          'header',
          null,
          h('span', { className: 'title' }, t('shader.title')),
          h('span', { className: 'subtitle' }, targetName !== '' ? t('shader.targetChip', { name: targetName }) : t('shader.targetNone')),
          h(
            'button',
            { type: 'button', className: 'mv-icon-btn', title: t('shader.close'), 'aria-label': t('shader.close'), onClick: onClose },
            '✕',
          ),
        ),
        h(
          'div',
          { className: 'body' },
          h(
            'div',
            { className: 'field' },
            h('label', { htmlFor: 'mv-shader-layer' }, t('shader.layerLabel')),
            h(
              'select',
              {
                id: 'mv-shader-layer',
                value: form.layerId,
                disabled: visibleLayers.length === 0,
                onChange: (event) => onLayer(event.target.value),
              },
              h('option', { value: '' }, targetName !== '' ? t('shader.layerAutoNamed', { name: targetName }) : t('shader.layerAuto')),
              ...visibleLayers.map((layer) => h('option', { key: layer.id, value: layer.id }, layer.name)),
            ),
            h(
              'p',
              { className: 'target-line' },
              targetName === ''
                ? t('shader.targetNone')
                : target?.auto
                  ? t('shader.targetAuto', { name: targetName })
                  : t('shader.targetFixed', { name: targetName }),
            ),
          ),
          h(
            'div',
            { className: 'field' },
            h('label', null, t('shader.presetLabel')),
            h(
              'div',
              { className: 'presets' },
              ...SHADER_PRESETS.map((preset) => {
                const selected = selectedPresets.includes(preset)
                const order = selected ? selectedPresets.indexOf(preset) + 1 : 0
                return h(
                  'button',
                  {
                    key: preset,
                    type: 'button',
                    className: `preset${selected ? ' on' : ''}`,
                    title: t(`shader.preset.${preset}`),
                    'aria-pressed': selected,
                    onClick: () => onPreset(preset),
                  },
                  h('span', { className: 'thumb' }, thumb(preset)),
                  h('span', { className: 'preset-name' }, t(`shader.preset.${preset}`)),
                  order > 0 ? h('span', { className: 'order-badge', 'aria-hidden': true }, `${order}`) : null,
                )
              }),
            ),
            h('p', { className: 'hint' }, t('shader.stackHint')),
          ),
          orderList,
          selectedPresets.includes('height-false-color') ? h(ElevationLegend, { range: elevation.range, minimum: rangeMinimum, maximum: rangeMaximum, t, busy: elevation.busy, onFit: fitRange }) : null,
          selectedPresets.includes('water') ? h('p', { className: 'hint' }, t(selectedPresets.includes('water-depth') ? 'shader.waterMasked' : 'shader.waterPurpose')) : null,
          params,
          h(
            'label',
            { className: 'live-row' },
            h('input', {
              type: 'checkbox',
              checked: live,
              onChange: (event) => {
                setLive(event.target.checked)
                if (event.target.checked) onPreview()
              },
            }),
            h('span', null, t('shader.livePreview')),
          ),
          h(
            'div',
            { className: 'row' },
            h('button', { type: 'button', className: 'mv-cta primary', disabled: visibleLayers.length === 0 || elevation.busy, onClick: runApply }, t('shader.apply')),
            h(
              'button',
              {
                type: 'button',
                className: `mv-cta${comparing ? ' on' : ''}`,
                disabled: visibleLayers.length === 0,
                'aria-pressed': comparing,
                title: t('shader.compareHint'),
                onClick: toggleCompare,
              },
              comparing ? t('shader.compareOn') : t('shader.compare'),
            ),
          ),
          h(
            'div',
            { className: 'row' },
            h('button', { type: 'button', className: 'mv-cta', onClick: runResetLayer }, t('shader.resetLayer')),
            h('button', { type: 'button', className: 'mv-cta', disabled: active.length === 0, onClick: runResetAll }, t('shader.resetAll')),
          ),
          h(
            'div',
            { className: 'active' },
            h('b', null, t('shader.active')),
            active.length === 0
              ? h('span', { className: 'empty' }, t('shader.activeEmpty'))
              : active.map((entry) =>
                  h(
                    'div',
                    { key: entry.layer, className: 'item' },
                    h('span', { title: entry.layer }, entry.layer),
                    h('span', { className: 'applied-tag' }, t('shader.appliedTag')),
                    h('em', null, presetLabel(entry.preset)),
                  ),
                ),
          ),
          visibleLayers.length === 0 ? h('p', { className: 'hint' }, t('shader.noLayers')) : null,
        ),
      )
    }
    //#endregion shader workbench

export { analysisMetric, AnalysisProfileChart, AnalysisCard, ShaderWorkbench }
