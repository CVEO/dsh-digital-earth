/**
 * ui/cards.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { formatDistance, formatHeight } from '../format.js'
import { profileCsv, profileMetrics, profileSvg } from '../analysis/profile-metrics.js'
import { SHADER_PRIMARY_PRESETS } from '../shader/presets.js'
import { ElevationLegend, elevationSliderBounds, useShaderElevation } from './shader-elevation.js'
import { AnalysisProfileChart } from './profile-chart.js'
import { downloadText } from '../scene/download.js'
import { ResizeHandle, usePanelResize } from './resizable.js'

const h = React.createElement

    //#region analysis card ----------------------------------------------------

    const analysisMetric = (value, digits = 1) =>
      typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'

    const profileChartLabels = (t) => ({
      title: t('analysis.title.profile'),
      distance: t('profile.axisDistance'),
      elevation: t('profile.axisElevation'),
      terrain: t('profile.terrain'),
      surfaceLength: t('profile.surfaceLength'),
      slopeMean: t('profile.slopeMean'),
      note: t('profile.note'),
    })

    /** Full-size profile preview; the card keeps a thumbnail that opens this. */
    function ProfileChartDialog({ metrics, t, onClose }) {
      const dialogRef = React.useRef(null)
      React.useEffect(() => {
        const previous = document.activeElement
        dialogRef.current?.focus()
        const onKey = (event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
          if (event.key === 'Tab') {
            const buttons = [...(dialogRef.current?.querySelectorAll('button:not([disabled]),[href],input,select,textarea,[tabindex="0"]') ?? [])]
            const first = buttons[0], last = buttons.at(-1)
            if (!first) { event.preventDefault(); return }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus() }
          }
        }
        document.addEventListener('keydown', onKey, true)
        return () => { document.removeEventListener('keydown', onKey, true); if (previous?.isConnected) previous.focus() }
      }, [])

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
          { ref: dialogRef, tabIndex: -1, className: 'mv-chart-dialog', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'mv-chart-title' },
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
                onClick: () => downloadText(`elevation-profile-${Date.now()}.csv`, profileCsv(metrics), 'text/csv;charset=utf-8'),
              },
              t('profile.exportCsv'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mv-cta',
                onClick: () => downloadText(`elevation-profile-${Date.now()}.svg`, svg, 'image/svg+xml'),
              },
              t('profile.exportSvg'),
            ),
            h('span', { className: 'mv-chart-note' }, t('profile.note')),
          ),
        ),
      )
    }

    /** Floating result card for the single active analysis. */
    function AnalysisCard({ state, t, onClose, hoverIndex = null, onHover }) {
      const [open, setOpen] = React.useState(true)
      const [chartOpen, setChartOpen] = React.useState(false)
      const resize = usePanelResize({ storageKey: 'analysis', initialHeight: null, minHeight: 180, maxHeight: 680 })
      if (!state || !state.result) return null
      const result = state.result
      const operation = state.operation
      const profile = operation === 'profile' ? profileMetrics(result.points, { includeDesign: false }) : null
      const showProfile = Boolean(profile && profile.valid_count >= 2)
      // v1.5.2: the chart is the first thing in the body (the stats below used to
      // push it out of the card), the source row pins the single height source of
      // this run, and at most two warnings explain any approximation.
      const heightSource =
        typeof result.height_source === 'string' && result.height_source !== '' ? result.height_source : null
      const warningCodes = (Array.isArray(result.warnings) ? result.warnings : [])
        .filter((code) => typeof code === 'string' && code.trim() !== '')
        .slice(0, 2)
      const chartBlock =
        operation === 'profile'
          ? showProfile
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'profile-chart-thumb',
                  title: t('profile.expandChart'),
                  'aria-label': t('profile.expandChart'),
                  onClick: () => setChartOpen(true),
                },
                h(AnalysisProfileChart, { points: result.points, t, hoverIndex, onHover }),
                h('span', { className: 'profile-chart-hint' }, t('profile.expandChart')),
              )
            : h(AnalysisProfileChart, { points: result.points, t, hoverIndex, onHover })
          : null
      const rows = []
      const row = (key, label, value) =>
        rows.push(h('div', { key, className: 'stat' }, h('span', null, label), h('b', null, value)))
      if (operation === 'profile') {
        const stats = result.stats ?? {}
        row('length', t('analysis.length'), formatDistance(result.length_m ?? 0))
        if (showProfile) {
          row('surfaceLength', t('profile.surfaceLength'), formatDistance(profile.length_3d_m))
          row('startEnd', t('profile.startEndHeight'), `${formatHeight(profile.start_height_m)} → ${formatHeight(profile.end_height_m)}`)
          const net = profile.net_elevation_m ?? 0
          row('netChange', t('profile.netChange'), `${net >= 0 ? '+' : ''}${formatHeight(net)}`)
        }
        row('min', t('analysis.minHeight'), formatHeight(stats.min_height ?? 0))
        row('max', t('analysis.maxHeight'), formatHeight(stats.max_height ?? 0))
        row('relief', t('analysis.relief'), formatHeight(stats.relief_m ?? 0))
        row('gain', t('analysis.gain'), formatHeight(stats.gain_m ?? 0))
        row('loss', t('analysis.loss'), formatHeight(stats.loss_m ?? 0))
        if (showProfile) {
          row('slopeMean', t('profile.slopeMean'), `${analysisMetric(profile.slope.mean_abs_pct)}%`)
          row(
            'slopeMax',
            t('profile.slopeMax'),
            `${analysisMetric(profile.slope.max_abs_pct)}% · ${formatDistance(profile.slope.max_at_m ?? 0)}`,
          )
        }
        row('samples', t('analysis.samples'), `${result.samples ?? 0}`)
        if (Array.isArray(result.from) && Array.isArray(result.to) && result.from.length >= 2 && result.to.length >= 2) {
          row(
            'endpoints',
            t('profile.endpoints'),
            `${Number(result.from[0]).toFixed(4)}, ${Number(result.from[1]).toFixed(4)} → ${Number(result.to[0]).toFixed(4)}, ${Number(result.to[1]).toFixed(4)}`,
          )
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
        if (typeof result.coverage_ratio === 'number') {
          row(
            'coverage',
            t('flood.coverage'),
            `${analysisMetric(result.coverage_ratio * 100, 1)}% (${result.samples_with_data ?? 0}/${result.samples_total ?? result.samples_with_data ?? 0})`,
          )
        }
        if (typeof result.unknown_km2 === 'number' && result.unknown_km2 > 0) {
          row('unknownArea', t('flood.unknownArea'), `${analysisMetric(result.unknown_km2, 3)} km²`)
        }
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
        { className: 'mv-card mv-analysis', ref: resize.ref, style: resize.style, role: 'region', 'aria-label': t(`analysis.title.${operation}`) },
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
              chartBlock,
              heightSource
                ? h(
                    'div',
                    { key: 'source', className: 'stat' },
                    h('span', null, t('analysis.source')),
                    h('b', null, t(`analysis.source.${heightSource}`)),
                  )
                : null,
              warningCodes.length > 0
                ? h(
                    'p',
                    { key: 'warnings', className: 'warnings', title: warningCodes.join(' · ') },
                    `${t('analysis.warnings')}: ${warningCodes.join(' · ')}`,
                  )
                : null,
              state.layerName
                ? h('div', { className: 'layer', title: state.layerName }, `${t('analysis.layer')}: ${state.layerName}`)
                : null,
              ...rows,
              showProfile
                ? h(
                    'div',
                    { key: 'profile-tools', className: 'profile-tools' },
                    h(
                      'div',
                      { className: 'profile-row' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-cta',
                          onClick: () =>
                            downloadText(`elevation-profile-${Date.now()}.csv`, profileCsv(profile), 'text/csv;charset=utf-8'),
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
                              `elevation-profile-${Date.now()}.svg`,
                              profileSvg(profile, profileChartLabels(t)),
                              'image/svg+xml',
                            ),
                        },
                        t('profile.exportSvg'),
                      ),
                    ),
                    h('p', { className: 'profile-note' }, t('profile.hoverChartHint')),
                  )
                : null,
              h('p', { className: 'hint' }, t('analysis.hint')),
            )
          : null,
        chartOpen && showProfile
          ? h(ProfileChartDialog, { key: 'chart-dialog', metrics: profile, t, onClose: () => setChartOpen(false) })
          : null,
        h(ResizeHandle, {
          axis: 'height',
          edge: 'bottom',
          label: t('resize.height'),
          value: resize.size.height,
          onPointerDown: resize.beginHeight,
          onKeyDown: resize.keyHeight,
        }),
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
      const resize = usePanelResize({
        storageKey: 'shader',
        widthDirection: 'right',
        initialWidth: 340,
        minWidth: 260,
        maxWidth: 720,
        minHeight: 220,
        maxHeight: 760,
      })
      const visibleLayers = layers.filter((layer) => layer.visible)
      // form.preset is a string for one preset or an ordered array for a stack;
      // the helper keeps the rest of the card stack-agnostic.
      const selectedPresets = Array.isArray(form.preset) ? form.preset : [form.preset]
      const presetLabel = (value) =>
        (Array.isArray(value) ? value : [value]).map((item) => t(`shader.preset.${item}`)).join(' + ')
      // The workbench presents the four everyday looks. `contour` stays in the
      // tool whitelist for contract compatibility but is not offered here: on a
      // 3D mesh it renders as jagged bands, and the meeting asked to drop it.
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
      // The engine's default range comes from the tileset bounding volume, which
      // can span far beyond the visible roofs and flatten the ramp into one colour.
      // Once the visible-surface sampling finishes, seed the form with that range
      // so the default look matches what the user sees (the button can resample).
      const sampledRange = elevation.range?.source === 'visible_surface' ? elevation.range : null
      const heightPreset = selectedPresets.includes('height-false-color')
      const sampledRangeKey = sampledRange ? `${sampledRange.minimum}|${sampledRange.maximum}` : ''
      React.useEffect(() => {
        if (!sampledRange || !heightPreset) return
        if (form.minHeight !== '' || form.maxHeight !== '') return
        onField('minHeight', String(sampledRange.minimum))
        onField('maxHeight', String(sampledRange.maximum))
      }, [sampledRangeKey, heightPreset, form.minHeight, form.maxHeight])
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

      // One chip per preset; primary and advanced sections share the same behaviour
      // (toggle inside the ordered stack, order badge).
      const presetChip = (preset) => {
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
        { className: 'mv-card mv-shader', ref: resize.ref, style: resize.style, role: 'region', 'aria-label': t('shader.title') },
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
            h('p', { className: 'hint target-hint' }, t('shader.targetHint')),
          ),
          h(
            'div',
            { className: 'field' },
            h('label', null, t('shader.presetLabel')),
            h(
              'div',
              { className: 'presets primary' },
              ...SHADER_PRIMARY_PRESETS.map((preset) => presetChip(preset)),
            ),
            h('p', { className: 'hint' }, t('shader.stackHint')),
            h('p', { className: 'hint single-hint' }, t('shader.singleHint')),
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
        h(ResizeHandle, {
          axis: 'corner',
          edge: 'corner',
          label: t('resize.size'),
          value: resize.size.width,
          onPointerDown: resize.beginCorner,
          onKeyDown: resize.keyWidth,
        }),
      )
    }
    //#endregion shader workbench

export { analysisMetric, AnalysisProfileChart, AnalysisCard, ShaderWorkbench }
