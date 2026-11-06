/**
 * ui/cards.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { formatDistance, formatHeight } from '../format.js'
import { SHADER_PRESETS } from '../shader/presets.js'

const h = React.createElement

    //#region analysis card ----------------------------------------------------

    const analysisMetric = (value, digits = 1) =>
      typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'

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
            stroke: 'var(--mv-accent)',
            strokeWidth: 1.7,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
          }),
        ),
        h('text', { x: padX, y: padY - 3 }, formatHeight(maximum)),
        h('text', { x: padX, y: height - 2 }, formatHeight(minimum)),
        h('text', { x: width - padX, y: height - 2, textAnchor: 'end' }, formatDistance(maxDistance)),
      )
    }

    /** Floating result card for the single active analysis. */
    function AnalysisCard({ state, t, onClose }) {
      const [open, setOpen] = React.useState(true)
      if (!state || !state.result) return null
      const result = state.result
      const operation = state.operation
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
              operation === 'profile' ? h(AnalysisProfileChart, { points: result.points, t }) : null,
              h('p', { className: 'hint' }, t('analysis.hint')),
            )
          : null,
      )
    }
    //#endregion analysis card

    //#region shader workbench ------------------------------------------------
    /**
     * B3 workbench: a compact floating card. It can pick a visible layer, one of
     * the four presets and that preset's bounded parameters; it never edits GLSL.
     */
    function ShaderWorkbench({
      t,
      layers,
      form,
      active,
      onClose,
      onLayer,
      onPreset,
      onField,
      onApply,
      onResetLayer,
      onResetAll,
    }) {
      const visibleLayers = layers.filter((layer) => layer.visible)
      const numberField = (key, labelKey, placeholder) =>
        h(
          'div',
          { className: 'field', key },
          h('label', { htmlFor: `mv-shader-${key}` }, t(labelKey)),
          h('input', {
            id: `mv-shader-${key}`,
            type: 'number',
            inputMode: 'decimal',
            step: 'any',
            value: form[key],
            placeholder: placeholder ?? '',
            onChange: (event) => onField(key, event.target.value),
          }),
        )

      let params = null
      if (form.preset === 'height-false-color') {
        const auto = t('shader.param.auto')
        params = h(
          'div',
          { className: 'params' },
          numberField('minHeight', 'shader.param.minHeight', auto),
          numberField('maxHeight', 'shader.param.maxHeight', auto),
        )
      } else if (form.preset === 'contour') {
        params = h('div', { className: 'params' }, numberField('interval', 'shader.param.interval'))
      } else if (form.preset === 'scan') {
        params = h('div', { className: 'params' }, numberField('speed', 'shader.param.speed'))
      } else {
        params = h(
          'div',
          { className: 'params' },
          numberField('speed', 'shader.param.speed'),
          numberField('amplitude', 'shader.param.amplitude'),
          numberField('opacity', 'shader.param.opacity'),
        )
      }

      return h(
        'div',
        { className: 'mv-card mv-shader', role: 'region', 'aria-label': t('shader.title') },
        h(
          'header',
          null,
          h('span', { className: 'title' }, t('shader.title')),
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
              h('option', { value: '' }, t('shader.layerAuto')),
              ...visibleLayers.map((layer) => h('option', { key: layer.id, value: layer.id }, layer.name)),
            ),
          ),
          h(
            'div',
            { className: 'field' },
            h('label', null, t('shader.presetLabel')),
            h(
              'div',
              { className: 'presets' },
              ...SHADER_PRESETS.map((preset) =>
                h(
                  'button',
                  {
                    key: preset,
                    type: 'button',
                    className: `preset${form.preset === preset ? ' on' : ''}`,
                    title: t(`shader.preset.${preset}`),
                    'aria-pressed': form.preset === preset,
                    onClick: () => onPreset(preset),
                  },
                  t(`shader.preset.${preset}`),
                ),
              ),
            ),
          ),
          params,
          h(
            'div',
            { className: 'row' },
            h('button', { type: 'button', className: 'mv-cta primary', disabled: visibleLayers.length === 0, onClick: onApply }, t('shader.apply')),
            h('button', { type: 'button', className: 'mv-cta', onClick: onResetLayer }, t('shader.resetLayer')),
            h('button', { type: 'button', className: 'mv-cta', disabled: active.length === 0, onClick: onResetAll }, t('shader.resetAll')),
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
                    h('em', null, t(`shader.preset.${entry.preset}`)),
                  ),
                ),
          ),
          visibleLayers.length === 0 ? h('p', { className: 'hint' }, t('shader.noLayers')) : null,
        ),
      )
    }
    //#endregion shader workbench

export { analysisMetric, AnalysisProfileChart, AnalysisCard, ShaderWorkbench }
