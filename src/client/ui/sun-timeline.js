/**
 * ui/sun-timeline.js — the sun-time control that lives in the layer card's
 * "三维" tab. Scope: date + local time slider + sun readout + shadows toggle.
 * No sun-path dome, no third-party solar library, no tool-contract change.
 */
import React from 'react'

import { createSunTimeline } from '../scene/sun-timeline.js'

const h = React.createElement

const pad2 = (value) => String(value).padStart(2, '0')

function todayInput() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function composeDate(day, minutes) {
  const [year, month, date] = String(day).split('-').map(Number)
  const hours = Math.floor(minutes / 60)
  return new Date(year, (month || 1) - 1, date || 1, hours, minutes % 60, 0, 0)
}

const clockLabel = (minutes) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`

export function SunTimeline({ t, getCesium, getViewer, getLayers, onBeforeEnable, active }) {
  const [enabled, setEnabled] = React.useState(false)
  const [day, setDay] = React.useState(todayInput)
  const [minutes, setMinutes] = React.useState(10 * 60)
  const [shadows, setShadows] = React.useState(true)
  const [readout, setReadout] = React.useState(null)
  const sunRef = React.useRef(null)
  // The layer list changes as data loads; keep the latest getter without
  // recreating the scene controller (which would lose its restore snapshot).
  const layersRef = React.useRef(getLayers)
  layersRef.current = getLayers
  if (!sunRef.current) {
    sunRef.current = createSunTimeline({ getCesium, getViewer, getLayers: () => layersRef.current?.() })
  }

  const apply = (nextDay, nextMinutes, nextShadows) => {
    const date = composeDate(nextDay, nextMinutes)
    const ok = sunRef.current.apply(date, { shadows: nextShadows })
    setReadout(ok ? sunRef.current.readout(date) : null)
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

  // The card lives in the "三维" tab: leaving that tab must restore the scene.
  React.useEffect(() => {
    if (active !== false || !enabled) return
    sunRef.current.restore()
    setEnabled(false)
    setReadout(null)
  }, [active, enabled])

  React.useEffect(
    () => () => {
      sunRef.current?.restore()
    },
    [],
  )

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
            h('span', { className: 'mv-sun-clock' }, clockLabel(minutes)),
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
        )
      : h('p', { className: 'mv-none' }, t('sun.hint')),
  )
}
