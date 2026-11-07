/**
 * ui/selection-overlay.js — the "指认" card, corner brackets and height leader.
 *
 * v1.7 P0, panel-only: the card answers three questions from the data itself
 * (where / how high / what is unknown) and offers the three next moves (fly
 * closer / measure / take away). It never invents a building name — when the
 * layer has no feature metadata the title stays "未命名对象（瓦片内要素）".
 *
 * The brackets track the picked 3D point through `scene.postRender` with direct
 * DOM writes, so following the camera costs no React re-render.
 */
import React from 'react'

const h = React.createElement

/** Confidence tiers shown next to each fact: measured / estimated / inferred. */
const BASIS_LABEL = { measured: 'selection.basis.certain', estimated: 'selection.basis.likely', inferred: 'selection.basis.guess' }

function factOf(card, key) {
  const facts = Array.isArray(card?.facts) ? card.facts : []
  return facts.find((fact) => fact && fact.key === key) ?? null
}

function numberText(value, suffix = ' m') {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}${suffix}` : '—'
}

export function SelectionOverlay({ active, apiRef, controller, renderSnapshot, t, showToast, onMeasure }) {
  const [card, setCard] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [errorLine, setErrorLine] = React.useState('')
  const [exporting, setExporting] = React.useState(false)
  const anchorRef = React.useRef(null)
  const bracketRef = React.useRef(null)
  const chipRef = React.useRef(null)

  const identify = React.useCallback(
    async (position) => {
      if (!controller) return
      setBusy(true)
      setErrorLine('')
      setCard(null)
      try {
        const result = await controller.identifyAt(position)
        anchorRef.current = result?.anchor ?? null
        setCard(result?.card ?? null)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        setErrorLine(reason === 'no_surface' ? t('selection.noSurface') : reason === 'not_ready' ? t('selection.notReady') : t('selection.failed'))
        setCard(null)
      } finally {
        setBusy(false)
      }
    },
    [controller, t],
  )

  // The panel's canvas-click path calls whatever this ref holds while the tool is
  // active (ViewerSurface keeps the click loop in scene/pointer-tools.js).
  React.useEffect(() => {
    if (!apiRef) return undefined
    apiRef.current = active ? identify : null
    return () => {
      if (apiRef) apiRef.current = null
    }
  }, [apiRef, active, identify])

  // Leaving the tool drops the selection; the player can always pick again.
  React.useEffect(() => {
    if (active) return
    anchorRef.current = null
    setCard(null)
    setBusy(false)
    setErrorLine('')
  }, [active])

  // Keep the brackets glued to the picked point. Direct style writes only.
  React.useEffect(() => {
    if (!active || !card) return undefined
    const viewer = controller?.getViewer?.()
    const Cesium = controller?.getCesium?.()
    const anchor = anchorRef.current
    if (!viewer || !Cesium || !anchor) return undefined
    const scene = viewer.scene
    const update = () => {
      const element = bracketRef.current
      if (!element) return
      let point = null
      try {
        point = Cesium.SceneTransforms.worldToWindowCoordinates(scene, anchor)
      } catch {
        point = null
      }
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        element.style.display = 'none'
        return
      }
      element.style.display = ''
      element.style.transform = `translate(${Math.round(point.x)}px,${Math.round(point.y)}px)`
    }
    scene.postRender.addEventListener(update)
    update()
    return () => {
      try {
        scene.postRender.removeEventListener(update)
      } catch {
        /* viewer already destroyed */
      }
    }
  }, [active, card, controller])

  // Esc closes the card but keeps the tool armed for the next pick.
  React.useEffect(() => {
    if (!card) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setCard(null)
        anchorRef.current = null
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [card])

  const flyNear = () => {
    const viewer = controller?.getViewer?.()
    const Cesium = controller?.getCesium?.()
    if (!viewer || !Cesium || !card) return
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          card.point.lon,
          card.point.lat,
          (card.point.surface_height_m ?? 0) + 120,
        ),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 },
        duration: 1.2,
      })
      setCard(null)
      anchorRef.current = null
    } catch {
      /* a destroyed viewer is not worth a toast */
    }
  }

  const measure = () => {
    if (!card || typeof onMeasure !== 'function') return
    onMeasure(anchorRef.current ?? null, card)
    setCard(null)
    anchorRef.current = null
  }

  const takeAway = async () => {
    if (!card || exporting) return
    setExporting(true)
    try {
      const snapshot = typeof renderSnapshot === 'function' ? await renderSnapshot({ format: 'png' }) : null
      const saved = await controller.exportEvidence(card, snapshot)
      showToast(t('selection.saved', { path: saved?.path ?? '' }))
    } catch (error) {
      showToast(t('selection.saveFailed', { message: error instanceof Error ? error.message : String(error) }))
    } finally {
      setExporting(false)
    }
  }

  if (!active) return null

  const surface = factOf(card, 'surface_height')
  const object = factOf(card, 'object_height')
  const above = factOf(card, 'above_median')
  const dot = (basis) =>
    h(
      'span',
      { className: `mv-sel-dot ${basis === 'measured' ? 'certain' : basis === 'estimated' ? 'likely' : 'guess'}`, title: t(BASIS_LABEL[basis] ?? BASIS_LABEL.inferred) },
    )
  const unknowns = Array.isArray(card?.unknowns) ? card.unknowns : []
  const limitations = Array.isArray(card?.limitations) ? card.limitations : []
  const radii = card?.sampling?.radii_m ?? [30, 60, 120]

  return h(
    React.Fragment,
    null,
    h(
      'div',
      { ref: bracketRef, className: 'mv-sel-anchor', style: { display: 'none' }, 'aria-hidden': true },
      h('i', { className: 'c tl' }),
      h('i', { className: 'c tr' }),
      h('i', { className: 'c bl' }),
      h('i', { className: 'c br' }),
      h('span', { className: 'leader' }),
      h('b', { ref: chipRef, className: 'chip' }, object && object.value !== null ? `≈ ${numberText(object.value, ' m')}` : t('selection.noHeight')),
    ),
    busy
      ? h('div', { className: 'mv-select mv-select-loading mv-glass', role: 'status' }, h('div', { className: 'mv-spinner' }), h('span', null, t('selection.reading')))
      : null,
    errorLine !== ''
      ? h(
          'div',
          { className: 'mv-select mv-glass' },
          h('div', { className: 'mv-select-error' }, h('span', null, errorLine)),
        )
      : null,
    card
      ? h(
          'div',
          { className: 'mv-select mv-glass' },
          h(
            'header',
            null,
            h('span', { className: 'kind' }, t(`selection.kind.${card.identity?.kind ?? 'scene'}`)),
            h(
              'button',
              { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: () => { setCard(null); anchorRef.current = null } },
              '✕',
            ),
          ),
          h('h3', null, card.identity?.name ?? t('selection.unnamed')),
          h(
            'p',
            { className: 'layer' },
            `${card.layer?.name ?? t('selection.unknownLayer')} · ${card.point.lon.toFixed(5)}, ${card.point.lat.toFixed(5)}`,
          ),
          h(
            'div',
            { className: 'facts' },
            surface
              ? h(
                  'div',
                  { className: 'fact' },
                  dot('measured'),
                  h('span', { className: 'key' }, t('selection.surfaceHeight')),
                  h('b', null, numberText(surface.value)),
                )
              : null,
            object
              ? h(
                  'div',
                  { className: 'fact' },
                  dot(object.basis),
                  h('span', { className: 'key' }, t('selection.objectHeight')),
                  h('b', null, numberText(object.value)),
                  h('em', null, t('selection.sampled', { n: object.sample_count ?? 0 })),
                )
              : null,
            above
              ? h(
                  'div',
                  { className: 'fact' },
                  dot(above.basis),
                  h('span', { className: 'key' }, t('selection.aboveMedian')),
                  h('b', null, typeof above.value === 'number' ? `${above.value > 0 ? '+' : ''}${above.value} m` : '—'),
                )
              : null,
          ),
          h('p', { className: 'sampling' }, t('selection.sampling', { count: card.sampling?.count ?? 0, radii: radii.join('/') })),
          unknowns.length
            ? h(
                'p',
                { className: 'unknowns' },
                h('span', null, `${t('selection.unknowns')}：`),
                unknowns.map((code) => t(`selection.unknown.${code}`)).join(' / '),
              )
            : null,
          limitations.length
            ? h(
                'ul',
                { className: 'limits' },
                limitations.slice(0, 3).map((code) => h('li', { key: code }, t(`selection.limit.${code}`))),
              )
            : null,
          h(
            'div',
            { className: 'actions' },
            h('button', { type: 'button', className: 'mv-cta', onClick: flyNear }, t('selection.fly')),
            h('button', { type: 'button', className: 'mv-cta', onClick: measure }, t('selection.measure')),
            h('button', { type: 'button', className: 'mv-cta primary', disabled: exporting, onClick: takeAway }, exporting ? t('selection.exporting') : t('selection.takeAway')),
          ),
          h('p', { className: 'hint' }, t('selection.exportHint')),
        )
      : null,
    active && !card && !busy && errorLine === ''
      ? h('div', { className: 'mv-sel-hint mv-glass' }, t('selection.hint'))
      : null,
  )
}
