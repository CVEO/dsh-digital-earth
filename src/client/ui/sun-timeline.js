/**
 * ui/sun-timeline.js — the sun-time control that lives in the layer card's
 * "三维" tab. Scope: date + time slider + time-zone mode + sun readout + shadows.
 * No sun-path dome, no third-party solar library, no tool-contract change.
 *
 * Time semantics are explicit. The slider is a wall-clock time in the SELECTED
 * zone:
 *   - 画面地方时 (default): mean solar time derived from the current scene/layer
 *     longitude, so a French dataset behaves like French local time without
 *     guessing a political IANA zone (and before any layer loads it falls back to
 *     the browser zone);
 *   - 浏览器本地: the browser's IANA zone;
 *   - UTC.
 * The absolute instant is then handed to Cesium, so the sun position always
 * belongs to the instant the user reads on screen.
 */
import React from 'react'

import {
  createSunTimeline,
  sunClockLabel,
  sunDataOffsetMinutes,
  sunDateAtOffset,
  sunLocalDate,
  sunTimezone,
  sunTodayInput,
  utcOffsetLabelFromMinutes,
} from '../scene/sun-timeline.js'

const h = React.createElement

const ZONE_MODES = ['scene', 'browser', 'utc']

/** Read one t() key without letting a missing key break the whole card. */
function translate(t, key, vars) {
  try {
    const text = vars === undefined ? t(key) : t(key, vars)
    return typeof text === 'string' ? text : ''
  } catch {
    return ''
  }
}

export function SunTimeline({ t, getCesium, getViewer, getLayers, onBeforeEnable, active }) {
  const [enabled, setEnabled] = React.useState(false)
  const [zoneMode, setZoneMode] = React.useState('scene')
  const [day, setDay] = React.useState(sunTodayInput)
  const [minutes, setMinutes] = React.useState(10 * 60)
  const [shadows, setShadows] = React.useState(true)
  const [readout, setReadout] = React.useState(null)
  const [failed, setFailed] = React.useState(null)
  const sunRef = React.useRef(null)
  // The layer list changes as data loads; keep the latest getter without
  // recreating the scene controller (which would lose its restore snapshot).
  const layersRef = React.useRef(getLayers)
  layersRef.current = getLayers
  if (!sunRef.current) {
    sunRef.current = createSunTimeline({ getCesium, getViewer, getLayers: () => layersRef.current?.() })
  }

  // Offset of the selected wall-clock zone from UTC, in minutes.
  const offsetFor = (mode, dayValue, minuteValue) => {
    if (mode === 'utc') return 0
    const browserOffset = -sunLocalDate(dayValue, minuteValue).getTimezoneOffset()
    if (mode === 'browser') return browserOffset
    const sceneOffset = sunDataOffsetMinutes(sunRef.current?.sceneLongitude?.() ?? null)
    return sceneOffset ?? browserOffset
  }
  const offsetMinutes = offsetFor(zoneMode, day, minutes)
  const offsetLabel = utcOffsetLabelFromMinutes(offsetMinutes)
  const sceneLon = sunRef.current?.sceneLongitude?.() ?? null
  const sceneOffset = sunDataOffsetMinutes(sceneLon)
  // "scene" degrades to browser local before any layer/camera fixes a longitude.
  const effectiveMode = zoneMode === 'scene' && sceneOffset === null ? 'browser' : zoneMode
  const browserZone = sunTimezone(sunLocalDate(day, minutes)).timezone
  const zoneLabel =
    effectiveMode === 'scene'
      ? translate(t, 'sun.zone.sceneLabel', { lon: (sceneLon ?? 0).toFixed(2), offset: offsetLabel })
      : effectiveMode === 'utc'
        ? `UTC${offsetLabel}`
        : translate(t, 'sun.zone.browserLabel', { zone: browserZone, offset: offsetLabel })
  const dateFor = (dayValue, minuteValue, mode) => sunDateAtOffset(dayValue, minuteValue, offsetFor(mode, dayValue, minuteValue))

  const apply = (nextDay, nextMinutes, nextShadows, mode = zoneMode) => {
    const ok = sunRef.current.apply(dateFor(nextDay, nextMinutes, mode), { shadows: nextShadows })
    if (!ok) {
      setReadout(null)
      setFailed(sunRef.current.getError() || '')
      return false
    }
    setFailed(null)
    setReadout(sunRef.current.readout(dateFor(nextDay, nextMinutes, mode)))
    return true
  }

  const toggle = (next) => {
    if (next) {
      onBeforeEnable?.()
      setEnabled(true)
      apply(day, minutes, shadows)
    } else {
      sunRef.current.restore()
      setEnabled(false)
      setReadout(null)
      setFailed(null)
    }
  }

  const changeDay = (next) => {
    setDay(next)
    if (enabled) apply(next, minutes, shadows)
  }

  const changeMinutes = (next) => {
    setMinutes(next)
    if (enabled) apply(day, next, shadows)
  }

  const changeShadows = (next) => {
    setShadows(next)
    if (enabled) apply(day, minutes, next)
  }

  const changeZone = (next) => {
    if (!ZONE_MODES.includes(next)) return
    setZoneMode(next)
    if (enabled) apply(day, minutes, shadows, next)
  }

  // The card lives in the "三维" tab: leaving that tab must restore the scene.
  React.useEffect(() => {
    if (active !== false || !enabled) return
    sunRef.current.restore()
    setEnabled(false)
    setReadout(null)
    setFailed(null)
  }, [active, enabled])

  React.useEffect(
    () => () => {
      sunRef.current?.restore()
    },
    [],
  )

  const failureText = () => {
    const reason = typeof failed === 'string' ? failed : ''
    let text = translate(t, 'sun.applyFailed', { message: reason })
    if (text.includes('{message}')) text = text.split('{message}').join(reason)
    // Missing key / missing host interpolation still yields a diagnosable line.
    if (text === '' || text === 'sun.applyFailed') {
      text = `${translate(t, 'sun.title') || 'Sun timeline'}: ${reason || '—'}`
    }
    return text
  }

  const notes = []
  if (failed) {
    notes.push(h('p', { key: 'failed', className: 'mv-sun-note mv-sun-alert' }, failureText()))
  } else if (readout?.night) {
    notes.push(h('p', { key: 'night', className: 'mv-sun-note mv-sun-night' }, translate(t, 'sun.nightHint')))
  }
  notes.push(h('p', { key: 'tz', className: 'mv-sun-note' }, translate(t, 'sun.timezoneHint')))
  if (readout) {
    notes.push(h('p', { key: 'sky', className: 'mv-sun-note' }, translate(t, 'sun.skyHint')))
  }

  return h(
    'div',
    { className: 'mv-sun' },
    h(
      'div',
      { className: 'mv-sun-head' },
      h('b', null, t('sun.title')),
      h(
        'label',
        { className: 'mv-sun-toggle' },
        h('input', { type: 'checkbox', checked: enabled, onChange: (event) => toggle(event.target.checked) }),
        t('sun.enable'),
      ),
    ),
    enabled
      ? h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'mv-sun-row' },
            h('span', null, t('sun.date')),
            h('input', { type: 'date', value: day, 'aria-label': t('sun.date'), onChange: (event) => changeDay(event.target.value) }),
            h('span', { className: 'mv-sun-clock' }, sunClockLabel(minutes)),
          ),
          h('input', {
            className: 'mv-sun-range',
            type: 'range',
            min: 0,
            max: 1439,
            step: 5,
            value: minutes,
            'aria-label': t('sun.time'),
            onChange: (event) => changeMinutes(Number(event.target.value)),
          }),
          h(
            'div',
            { className: 'mv-sun-row' },
            h('span', null, t('sun.zone')),
            h(
              'select',
              { value: zoneMode, 'aria-label': t('sun.zone'), onChange: (event) => changeZone(event.target.value) },
              ...ZONE_MODES.map((mode) => h('option', { key: mode, value: mode }, translate(t, `sun.zone.${mode}`))),
            ),
          ),
          h('div', { className: 'mv-sun-zone' }, zoneLabel),
          h(
            'div',
            { className: 'mv-sun-readout' },
            h('span', null, `${t('sun.altitude')} ${readout ? `${readout.altitude.toFixed(1)}°` : '—'}`),
            h('span', null, `${t('sun.azimuth')} ${readout ? `${readout.azimuth.toFixed(1)}°` : '—'}`),
          ),
          h(
            'label',
            { className: 'mv-sun-check' },
            h('input', { type: 'checkbox', checked: shadows, onChange: (event) => changeShadows(event.target.checked) }),
            t('sun.shadows'),
          ),
          notes,
        )
      : h('p', { className: 'mv-none' }, t('sun.hint')),
  )
}
