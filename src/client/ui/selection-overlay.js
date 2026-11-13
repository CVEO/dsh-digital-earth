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
import { VisionSelect } from './vision-select.js'
import { getSelectionTool } from '../scene/selection-tools.js'
import { coordinateText, groundSourceLabelKey, shownProperties } from '../scene/selection.js'

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

export function SelectionOverlay({ active, apiRef, controller, renderSnapshot, t, showToast, onMeasure, onSelectArea, onVisionCommit, onVisionManual }) {
  const [card, setCard] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [errorLine, setErrorLine] = React.useState('')
  const [exporting, setExporting] = React.useState(false)
  const [visionOpen, setVisionOpen] = React.useState(false)
  const [showAllProps, setShowAllProps] = React.useState(false)
  const visionPendingRef = React.useRef(false)
  const anchorRef = React.useRef(null)
  const bracketRef = React.useRef(null)
  const chipRef = React.useRef(null)
  const requestRef = React.useRef(null)
  const validityRef = React.useRef(null)
  const dismiss = React.useCallback(() => {
    requestRef.current?.abort()
    requestRef.current = null
    validityRef.current = null
    anchorRef.current = null
    visionPendingRef.current = false
    if (bracketRef.current) bracketRef.current.style.display = 'none'
    setCard(null)
    setBusy(false)
    setErrorLine('')
    setVisionOpen(false)
    setShowAllProps(false)
  }, [])
  // Tools-card "AI 目标圈选" arms this: the next successful identify opens the
  // vision dialog directly instead of showing a blocking toast.
  const requestVision = React.useCallback(() => {
    visionPendingRef.current = true
    setVisionOpen(false)
  }, [])

  const identify = React.useCallback(
    async (position) => {
      if (!controller) return
      requestRef.current?.abort()
      const request = new AbortController()
      requestRef.current = request
      const current = () => requestRef.current === request && !request.signal.aborted
      setBusy(true)
      setErrorLine('')
      setCard(null)
      setVisionOpen(false)
      setShowAllProps(false)
      try {
        const result = await controller.identifyAt(position, { signal: request.signal })
        if (!current()) return
        if (result?.isValid && !result.isValid()) { dismiss(); return }
        validityRef.current = result?.isValid ?? null
        anchorRef.current = result?.anchor ?? null
        setCard(result?.card ?? null)
        if (visionPendingRef.current) {
          visionPendingRef.current = false
          setVisionOpen(true)
        }
      } catch (error) {
        if (!current()) return
        const reason = error instanceof Error ? error.message : String(error)
        // A click on the sky is a normal miss, not an error: stay quiet and let the
        // user pick again (identify is the default pointer mode now).
        if (reason === 'no_surface' || reason === 'cancelled') {
          setErrorLine('')
          setCard(null)
        } else {
          setErrorLine(reason === 'not_ready' ? t('selection.notReady') : t('selection.failed'))
          setCard(null)
        }
      } finally {
        if (current()) setBusy(false)
      }
    },
    [controller, t, dismiss],
  )

  // The panel's canvas-click path calls whatever this ref holds while the tool is
  // active (ViewerSurface keeps the click loop in scene/pointer-tools.js).
  React.useEffect(() => {
    if (!apiRef) return undefined
    identify.cancel = dismiss
    identify.requestVision = requestVision
    apiRef.current = active ? identify : null
    return () => {
      if (apiRef) apiRef.current = null
    }
  }, [apiRef, active, identify, dismiss, requestVision])

  // Leaving the tool drops the selection; the player can always pick again.
  React.useEffect(() => {
    if (active) return
    dismiss()
  }, [active, dismiss])
  React.useEffect(() => () => { requestRef.current?.abort(); if (bracketRef.current) bracketRef.current.style.display = 'none' }, [])

  // Keep the brackets glued to the picked point. Direct style writes only.
  React.useEffect(() => {
    if (!active || !card) return undefined
    const viewer = controller?.getViewer?.()
    const Cesium = controller?.getCesium?.()
    const anchor = anchorRef.current
    if (!viewer || !Cesium || !anchor) return undefined
    const scene = viewer.scene
    const update = () => {
      if (validityRef.current && !validityRef.current()) { dismiss(); return }
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
      if (bracketRef.current) bracketRef.current.style.display = 'none'
      try {
        scene.postRender.removeEventListener(update)
      } catch {
        /* viewer already destroyed */
      }
    }
  }, [active, card, controller, dismiss])

  // Esc closes the card but keeps the tool armed for the next pick.
  React.useEffect(() => {
    if (!active) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        dismiss()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, dismiss])

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
    dismiss()
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

  // Turn the picked point into an honest approximate AOI in the Tools card; it is
  // deliberately NOT called a building footprint (pick data cannot supply that).
  const selectAround = () => {
    if (!card || typeof onSelectArea !== 'function') return
    onSelectArea(card)
    dismiss()
  }

  if (!active) return null

  const surface = factOf(card, 'surface_height')
  const object = factOf(card, 'object_height')
  const above = factOf(card, 'above_median')
  const groundSourceFact = factOf(card, 'ground_source')
  const confidenceChip = (basis) => {
    const tier = CONFIDENCE_TIER[basis] ?? CONFIDENCE_TIER.inferred
    return h('span', { className: `mv-sel-conf ${tier.tone}`, title: t(tier.key) }, t(tier.key))
  }
  const limitations = Array.isArray(card?.limitations) ? card.limitations : []
  const radii = card?.sampling?.radii_m ?? [30, 60, 120]
  // Batch-table attributes are the real answer to "what is this object"; start with
  // a bounded preview and let the user expand all attributes in place.
  const propertyInfo = shownProperties(card?.identity?.properties)
  const allProperties = Array.isArray(card?.identity?.properties) ? card.identity.properties : []
  const properties = showAllProps ? allProperties : propertyInfo.shown
  const hitKindKey = `selection.hitKind.${card?.identity?.kind ?? 'scene'}`
  const featureId = card?.identity?.featureId
  const samplingMin = card?.sampling?.min
  const samplingMax = card?.sampling?.max
  const samplingSpread = card?.sampling?.spread
  const lonLat = coordinateText(card?.point)
  // Clipboard may be unavailable (insecure context, denied permission): copying is
  // a convenience, so a failure is a toast, never an error dialog.
  const copyCoordinates = () => {
    if (lonLat === '') return
    const done = () => showToast(t('selection.copied'))
    try {
      const clipboard = globalThis.navigator?.clipboard
      if (clipboard && typeof clipboard.writeText === 'function') {
        Promise.resolve(clipboard.writeText(lonLat)).then(done, () => showToast(t('selection.copyFailed')))
        return
      }
    } catch {
      /* fall through to the toast below */
    }
    showToast(t('selection.copyFailed'))
  }
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
    card && visionOpen
      ? h(VisionSelect, { controller, anchor: anchorRef.current, t, onClose: () => setVisionOpen(false), onCommit: onVisionCommit,
          onManual: () => { onVisionManual?.(); getSelectionTool(controller.getViewer(), { getCesium: controller.getCesium, t, showToast })?.start('lasso') } })
      : null,
    card && !visionOpen
      ? h(
          'div',
          { className: 'mv-select mv-glass' },
          h(
            'header',
            null,
            h('span', { className: 'kind' }, t('selection.resultLabel')),
            h(
              'button',
              { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: dismiss },
              '✕',
            ),
          ),
          h('h3', null, card.identity?.name ?? t(TITLE_KEY[card.identity?.kind] ?? TITLE_KEY.tile_feature)),
          h('p', { className: 'layer' }, card.layer?.name ?? t('selection.unknownLayer')),
          h(
            'div',
            { className: 'mv-sel-meta' },
            h('span', { className: 'mv-sel-meta-chip' }, t(hitKindKey)),
            groundSourceFact
              ? h('span', { className: 'mv-sel-meta-chip' }, t(groundSourceLabelKey(groundSourceFact.value)))
              : null,
            featureId != null
              ? h('span', { className: 'mv-sel-meta-chip' }, t('selection.featureId', { id: featureId }))
              : null,
          ),
          lonLat !== ''
            ? h(
                'div',
                { className: 'coords' },
                h('span', { className: 'key' }, t('selection.coordinates')),
                h('code', { title: t('selection.copyCoords') }, lonLat),
                h(
                  'button',
                  { type: 'button', className: 'mv-icon-btn', title: t('selection.copyCoords'), 'aria-label': t('selection.copyCoords'), onClick: copyCoordinates },
                  '⧉',
                ),
              )
            : null,
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
          properties.length > 0
            ? h(
                'div',
                { className: 'props' },
                h(
                  'span',
                  { className: 'props-title' },
                  propertyInfo.hidden > 0
                    ? t('selection.propertiesCount', { shown: properties.length, total: propertyInfo.total })
                    : t('selection.properties'),
                ),
                ...properties.map((property, index) =>
                  h(
                    'div',
                    { key: `${property.name}-${index}`, className: 'prop' },
                    h('span', { title: property.name }, property.name),
                    h('b', { title: property.value }, property.value),
                  ),
                ),
                propertyInfo.hidden > 0
                  ? h(
                      React.Fragment,
                      null,
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-sel-props-toggle',
                          'aria-expanded': showAllProps,
                          title: t('selection.propertiesMore', { n: propertyInfo.hidden }),
                          onClick: () => setShowAllProps((open) => !open),
                        },
                        showAllProps
                          ? t('selection.propertiesCollapse', { shown: propertyInfo.shown.length })
                          : t('selection.propertiesShowAll', { total: propertyInfo.total }),
                      ),
                    )
                  : null,
              )
            : null,
          samplingMin != null && samplingMax != null
            ? h(
                'p',
                { className: 'sampling' },
                t('selection.neighborBand', {
                  min: Math.round(samplingMin),
                  max: Math.round(samplingMax),
                  spread: Math.round(samplingSpread ?? 0),
                }),
              )
            : null,
          h(
            'p',
            { className: 'sampling', title: t('selection.samplingHint') },
            t('selection.sampling', { count: card.sampling?.count ?? 0, radii: radii.join('/') }),
          ),
          showFootnote ? h('p', { className: 'footnote' }, t('selection.footnote')) : null,
          h(
            'div',
            { className: 'actions' },
            typeof onVisionCommit === 'function' ? h('button', { type: 'button', className: 'mv-cta', title: t('vision.actionHint'), onClick: () => setVisionOpen(true) }, t('vision.action')) : null,
            h('button', { type: 'button', className: 'mv-cta', title: t('selection.flyHint'), onClick: flyNear }, t('selection.fly')),
            h('button', { type: 'button', className: 'mv-cta', title: t('selection.measureHint'), onClick: measure }, t('selection.measure')),
            h(
              'button',
              { type: 'button', className: 'mv-cta primary', title: t('selection.exportHint'), disabled: exporting, onClick: takeAway },
              exporting ? t('selection.exporting') : t('selection.takeAway'),
            ),
          ),
          typeof onSelectArea === 'function'
            ? h(
                'div',
                { className: 'actions secondary' },
                h(
                  'button',
                  { type: 'button', className: 'mv-cta', title: t('selection.approximate'), onClick: selectAround },
                  t('selection.areaAction'),
                ),
              )
            : null,
        )
      : null,
  )
}
