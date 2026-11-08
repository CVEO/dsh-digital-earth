/**
 * ui/selection-overlay.js — the "指认" card, corner brackets and height leader.
 *
 * v1.7 P0, panel-only: the card answers three questions from the data itself
 * (where / how high / what is unknown) and offers the three next moves (approach
 * the object / measure its height / export the evidence). It never invents a
 * building name — when the layer has no feature metadata the title follows the
 * hit level ("unnamed feature inside a tile" vs "whole-tile hit only").
 *
 * The brackets track the picked 3D point through `scene.postRender` with direct
 * DOM writes, so following the camera costs no React re-render.
 */
import React from 'react'

const h = React.createElement

/**
 * Confidence tiers shown on each fact: one chip, colour-coded green / amber / red
 * for high / medium / low. The wording is deliberately "confidence", not
 * "certain / likely / guessed": a geometric estimate is still an estimate.
 */
const CONFIDENCE_TIER = {
  measured: { key: 'selection.confidence.high', tone: 'high' },
  estimated: { key: 'selection.confidence.medium', tone: 'medium' },
  inferred: { key: 'selection.confidence.low', tone: 'low' },
}

/**
 * The title must agree with the hit level: a whole-tile pick is not a "feature",
 * and a feature hit without metadata is not an "unidentified object".
 */
const TITLE_KEY = {
  tile_feature: 'selection.unnamed',
  tileset: 'selection.unnamed.tileset',
  entity: 'selection.unnamed.entity',
  scene: 'selection.unnamed.scene',
}

function factOf(card, key) {
  const facts = Array.isArray(card?.facts) ? card.facts : []
  return facts.find((fact) => fact && fact.key === key) ?? null
}

/**
 * Instrument readout formatting. The default is whole metres: a 24-point
 * neighbourhood estimate must not look like it has decimetre accuracy.
 */
function numberText(value, suffix = ' m', digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return `${rounded}${suffix}`
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
    // Frame the picked point itself (not "some height above its lon/lat"): a
    // bounding sphere + HeadingPitchRange puts it in the view centre at a real
    // 120 m distance. The old height+120 destination aimed the camera at a point
    // beside the object, so the object drifted off-centre.
    const anchor = anchorRef.current
    const target = anchor ?? Cesium.Cartesian3.fromDegrees(card.point.lon, card.point.lat, card.point.surface_height_m ?? 0)
    const range = 120
    const pitch = Cesium.Math.toRadians(-35)
    const heading = viewer.camera.heading ?? 0
    try {
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, 2), {
        offset: new Cesium.HeadingPitchRange(heading, pitch, range),
        duration: 1.4,
      })
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
  const confidenceChip = (basis) => {
    const tier = CONFIDENCE_TIER[basis] ?? CONFIDENCE_TIER.inferred
    return h('span', { className: `mv-sel-conf ${tier.tone}`, title: t(tier.key) }, t(tier.key))
  }
  const limitations = Array.isArray(card?.limitations) ? card.limitations : []
  const radii = card?.sampling?.radii_m ?? [30, 60, 120]
  // The card stays quiet: only the one caveat a user must not miss stays visible,
  // and it is a single small line. The full unknowns/limitations still travel in
  // the exported evidence JSON.
  const showFootnote = limitations.includes('no_building_identity') || limitations.includes('tile_feature_only')

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
            h('span', { className: 'kind' }, t('selection.resultLabel')),
            h(
              'button',
              { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: () => { setCard(null); anchorRef.current = null } },
              '✕',
            ),
          ),
          h('h3', null, card.identity?.name ?? t(TITLE_KEY[card.identity?.kind] ?? TITLE_KEY.tile_feature)),
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
                  h('span', { className: 'key' }, t('selection.surfaceHeight')),
                  h('b', null, numberText(surface.value)),
                  confidenceChip('measured'),
                )
              : null,
            object
              ? h(
                  'div',
                  { className: 'fact' },
                  h('span', { className: 'key' }, t('selection.objectHeight')),
                  h('b', null, numberText(object.value)),
                  confidenceChip(object.basis),
                )
              : null,
            above
              ? h(
                  'div',
                  { className: 'fact' },
                  h('span', { className: 'key', title: t('selection.aboveMedianHint') }, t('selection.aboveMedian')),
                  h(
                    'b',
                    null,
                    typeof above.value === 'number'
                      ? `${Math.round(above.value) > 0 ? '+' : ''}${Math.round(above.value)} m`
                      : '—',
                  ),
                  confidenceChip(above.basis),
                )
              : null,
          ),
          h(
            'p',
            { className: 'sampling', title: t('selection.samplingHint') },
            t('selection.sampling', { count: card.sampling?.count ?? 0, radii: radii.join('/') }),
          ),
          showFootnote ? h('p', { className: 'footnote' }, t('selection.footnote')) : null,
          h(
            'div',
            { className: 'actions' },
            h('button', { type: 'button', className: 'mv-cta', title: t('selection.flyHint'), onClick: flyNear }, t('selection.fly')),
            h('button', { type: 'button', className: 'mv-cta', title: t('selection.measureHint'), onClick: measure }, t('selection.measure')),
            h(
              'button',
              { type: 'button', className: 'mv-cta primary', title: t('selection.exportHint'), disabled: exporting, onClick: takeAway },
              exporting ? t('selection.exporting') : t('selection.takeAway'),
            ),
          ),
        )
      : null,
    active && !card && !busy && errorLine === ''
      ? h('div', { className: 'mv-sel-hint mv-glass' }, t('selection.hint'))
      : null,
  )
}
