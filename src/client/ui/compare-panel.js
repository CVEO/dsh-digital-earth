/**
 * ui/compare-panel.js — Scene Compare floating tool window.
 *
 * Unifies three remote-sensing / 3D AI comparison workflows in one compact
 * floating panel (opened from the toolbox `compare` entry):
 *   1. Dual-layer multi-modal split comparison (3DGS <-> Mesh / Mesh <-> Mesh / single layer);
 *   2. Per-layer mesh topology & LOD inspection (wireframe, tile colorize, bounding volume, SSE, live stats);
 *   3. Exact reproducible camera pose JSON (copy / paste instant snap) & aligned multi-frame figure export.
 */
import React from 'react'

import {
  applyCameraPoseInstant,
  captureCameraPose,
  parseCameraPoseJson,
  serializeCameraPose,
} from '../scene/camera-pose.js'
import { downloadComparisonBundle, exportComparisonBundle } from '../scene/experiment-export.js'
import {
  applyTilesetDiagnostics,
  formatDiagnosticBytes,
  readTilesetDiagnostics,
  resetTilesetDiagnostics,
} from '../scene/tileset-diagnostics.js'

const h = React.createElement

const SSE_PRESETS = [1, 4, 16, 32]
const EXPORT_WIDTHS = [1280, 1920, 2560]

/** Synchronous fallback copy for non-secure or restricted embedded WebView contexts. */
function legacyCopyText(text) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0'
  document.body?.appendChild?.(field)
  try {
    field.select()
    return typeof document.execCommand === 'function' ? document.execCommand('copy') : false
  } catch {
    return false
  } finally {
    field.remove?.()
  }
}

function formatLayerOption(t, layer) {
  const kindTag = layer.kind === '3dgs' ? t('compare.kind3dgs') : t('compare.kindMesh')
  const hidden = layer.visible === false ? ` · ${t('compare.hiddenTag')}` : ''
  return `${layer.name} [${kindTag}${hidden}]`
}

function formatCount(value) {
  const num = Number(value) || 0
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}K`
  return String(Math.round(num))
}

function pickInitialRight(layers, leftId) {
  const left = layers.find((item) => item.id === leftId)
  const others = layers.filter((item) => item.id !== leftId && item.visible !== false)
  if (others.length === 0) return ''
  // Prefer pairing opposite modality (e.g. 3DGS vs Mesh) when available.
  const cross = left?.kind ? others.find((item) => item.kind && item.kind !== left.kind) : null
  return (cross ?? others[0]).id
}

export function ComparePanel({
  t,
  layers = [],
  getLayers,
  getViewer,
  getCesium,
  getMeta,
  renderSnapshot,
  showToast,
  swipe,
}) {
  const list = Array.isArray(layers) ? layers : []
  const swipeState = swipe?.state ?? null
  const isActive = Boolean(swipeState && swipeState.kind !== 'raster')

  const [leftId, setLeftId] = React.useState(() => {
    if (swipeState?.kind === 'pair') return swipeState.leftId
    if (swipeState?.kind === 'split' || swipeState?.kind === '3d') return swipeState.id
    return (list.find((item) => item.visible !== false) ?? list[0])?.id ?? ''
  })
  const [rightId, setRightId] = React.useState(() => {
    if (swipeState?.kind === 'pair') return swipeState.rightId
    const initLeft = (list.find((item) => item.visible !== false) ?? list[0])?.id ?? ''
    return initLeft ? pickInitialRight(list, initLeft) : ''
  })
  const [inspectId, setInspectId] = React.useState(() => {
    const preferred = list.find((item) => item.visible !== false && item.kind !== '3dgs') ?? list[0]
    return preferred?.id ?? ''
  })
  const [draftRatio, setDraftRatio] = React.useState(0.5)
  const [diagRev, setDiagRev] = React.useState(0)
  const [poseOpen, setPoseOpen] = React.useState(false)
  const [poseText, setPoseText] = React.useState('')
  const [statusMsg, setStatusMsg] = React.useState('')
  const lastStatusRef = React.useRef('')
  const [exportDivider, setExportDivider] = React.useState(true)
  const [exportLabels, setExportLabels] = React.useState(false)
  const [exportWidth, setExportWidth] = React.useState(1920)
  const [exporting, setExporting] = React.useState(false)

  // Live-region helper: append NBSP when repeating the exact same message so screen readers re-announce.
  const announce = React.useCallback((message) => {
    const next = message === lastStatusRef.current ? `${message}\u00A0` : message
    lastStatusRef.current = message
    setStatusMsg(next)
  }, [])

  // Sync dropdown selections with live layer list and active swipe state.
  React.useEffect(() => {
    if (swipeState?.kind === 'pair') {
      setLeftId(swipeState.leftId)
      setRightId(swipeState.rightId)
      setDraftRatio(swipeState.ratio)
      return
    }
    if (swipeState?.kind === 'split' || swipeState?.kind === '3d') {
      setLeftId(swipeState.id)
      setRightId('')
      setDraftRatio(swipeState.ratio)
      return
    }
    if (list.length === 0) {
      setLeftId('')
      setRightId('')
      return
    }
    const hasLeft = list.some((item) => item.id === leftId)
    const nextLeft = hasLeft ? leftId : (list.find((item) => item.visible !== false) ?? list[0]).id
    if (!hasLeft) setLeftId(nextLeft)
    if (rightId && (!list.some((item) => item.id === rightId) || rightId === nextLeft)) {
      setRightId(pickInitialRight(list, nextLeft))
    }
  }, [list, swipeState, leftId, rightId])

  React.useEffect(() => {
    if (list.length === 0) {
      if (inspectId !== '') setInspectId('')
      return
    }
    if (!list.some((item) => item.id === inspectId)) {
      const preferred = list.find((item) => item.visible !== false && item.kind !== '3dgs') ?? list[0]
      setInspectId(preferred?.id ?? '')
    }
  }, [list, inspectId])

  // Refresh live tileset diagnostics/statistics at 1 Hz while panel is open.
  React.useEffect(() => {
    if (list.length === 0) return undefined
    const timer = setInterval(() => setDiagRev((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [list.length])

  const runtimeLayers = typeof getLayers === 'function' ? getLayers() : []
  const inspectLayer = runtimeLayers.find((item) => item.id === inspectId) ?? null
  const diag = React.useMemo(() => {
    void diagRev
    return inspectLayer ? readTilesetDiagnostics(inspectLayer) : null
  }, [inspectLayer, diagRev, swipeState])

  const ratio = isActive ? swipeState.ratio : draftRatio
  const pct = Math.round(ratio * 100)

  const handleLeftChange = (nextLeft) => {
    setLeftId(nextLeft)
    const nextRight = rightId === nextLeft ? '' : rightId
    if (rightId === nextLeft) setRightId('')
    if (isActive && swipe) {
      if (nextRight) swipe.startPair(nextLeft, nextRight, { ratio })
      else swipe.startSplit(nextLeft, { ratio })
    }
  }

  const handleRightChange = (nextRight) => {
    setRightId(nextRight)
    if (isActive && swipe) {
      if (nextRight) swipe.startPair(leftId, nextRight, { ratio })
      else swipe.startSplit(leftId, { ratio })
    }
  }

  const handleToggleCompare = () => {
    if (!swipe) return
    if (isActive) {
      swipe.stop()
      return
    }
    if (!leftId) {
      showToast?.(t('compare.unavailable'))
      return
    }
    if (rightId) swipe.startPair(leftId, rightId, { ratio })
    else swipe.startSplit(leftId, { ratio })
  }

  const handleSwap = () => {
    if (isActive && swipe) {
      swipe.swapSides()
      return
    }
    if (rightId) {
      setLeftId(rightId)
      setRightId(leftId)
    }
  }

  const handleRatio = (nextRatio) => {
    setDraftRatio(nextRatio)
    if (isActive) swipe?.setRatio?.(nextRatio)
  }

  const patchDiagnostics = (patch) => {
    if (!inspectLayer) return
    const res = applyTilesetDiagnostics(inspectLayer, patch, { viewer: getViewer?.(), Cesium: getCesium?.() })
    if (!res.ok && res.reason === 'unsupported_3dgs') {
      showToast?.(t('compare.wireframe3dgsHint'))
      announce(t('compare.wireframe3dgsHint'))
      return
    }
    setDiagRev((n) => n + 1)
  }

  const handleResetInspect = () => {
    if (!inspectLayer) return
    resetTilesetDiagnostics(inspectLayer, { viewer: getViewer?.(), Cesium: getCesium?.() })
    setDiagRev((n) => n + 1)
  }

  const handleCopyPose = async () => {
    const pose = captureCameraPose(getViewer?.(), getCesium?.())
    const json = serializeCameraPose(pose)
    if (!json) {
      announce(t('compare.poseInvalid'))
      return
    }
    let copied = false
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(json)
        copied = true
      }
    } catch {
      copied = false
    }
    if (!copied) copied = legacyCopyText(json)
    if (copied) {
      showToast?.(t('compare.poseCopied'))
      announce(t('compare.poseCopied'))
    } else {
      setPoseText(json)
      setPoseOpen(true)
      announce(t('compare.poseCopyFailed'))
    }
  }

  const handleApplyPose = () => {
    const parsed = parseCameraPoseJson(poseText)
    if (!parsed.ok) {
      const msg = t(parsed.reason === 'empty' ? 'compare.poseEmpty' : 'compare.poseInvalid')
      announce(msg)
      showToast?.(msg)
      return
    }
    const applied = applyCameraPoseInstant(getViewer?.(), getCesium?.(), parsed.pose)
    if (!applied.ok) {
      announce(t('compare.poseInvalid'))
      return
    }
    showToast?.(t('compare.poseApplied'))
    announce(t('compare.poseApplied'))
    setPoseOpen(false)
  }

  const handleExport = async () => {
    if (exporting || !leftId || typeof renderSnapshot !== 'function') return
    setExporting(true)
    try {
      const bundle = await exportComparisonBundle(
        {
          getViewer,
          getCesium,
          getLayers,
          getMeta,
          renderSnapshot,
        },
        {
          leftLayerId: leftId,
          rightLayerId: rightId || null,
          ratio,
          width: exportWidth,
          format: 'png',
          includeDivider: exportDivider,
          includeLabels: exportLabels,
        },
      )
      const saved = await downloadComparisonBundle(bundle)
      const msg = t('compare.exportDone', { n: saved.count })
      showToast?.(msg)
      announce(msg)
    } catch (error) {
      const msg = t('compare.exportFailed', { message: error?.message ?? String(error) })
      showToast?.(msg)
      announce(msg)
    } finally {
      setExporting(false)
    }
  }

  const is3dgsInspect = diag ? !diag.supportsWireframe : inspectLayer?.kind === '3dgs'

  return h(
    'div',
    { className: 'mv-compare' },
    // ---- Section 1: Dual-layer split comparison ----
    h(
      'section',
      { className: 'mv-compare-sec' },
      h(
        'div',
        { className: 'mv-compare-sec-head' },
        h('span', { className: 'mv-compare-sec-title' }, t('compare.sectionSplit')),
      ),
      list.length === 0
        ? h('p', { className: 'mv-none' }, t('compare.noLayers'))
        : h(
            React.Fragment,
            null,
            h(
              'label',
              { className: 'mv-compare-field' },
              h('span', null, t('compare.leftLayer')),
              h(
                'select',
                {
                  value: leftId,
                  'aria-label': t('compare.leftLayer'),
                  onChange: (event) => handleLeftChange(event.target.value),
                },
                ...list.map((layer) => h('option', { key: layer.id, value: layer.id }, formatLayerOption(t, layer))),
              ),
            ),
            h(
              'label',
              { className: 'mv-compare-field' },
              h('span', null, t('compare.rightLayer')),
              h(
                'select',
                {
                  value: rightId,
                  'aria-label': t('compare.rightLayer'),
                  onChange: (event) => handleRightChange(event.target.value),
                },
                h('option', { value: '' }, t('compare.rightNone')),
                ...list
                  .filter((layer) => layer.id !== leftId)
                  .map((layer) => h('option', { key: layer.id, value: layer.id }, formatLayerOption(t, layer))),
              ),
            ),
            h(
              'div',
              { className: 'mv-compare-row' },
              h(
                'button',
                {
                  type: 'button',
                  className: `mv-cta${isActive ? '' : ' primary'}`,
                  'aria-pressed': isActive,
                  disabled: !leftId,
                  onClick: handleToggleCompare,
                },
                isActive ? t('compare.stop') : t('compare.start'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  disabled: !isActive && !rightId,
                  onClick: handleSwap,
                },
                t('compare.swap'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  onClick: () => handleRatio(0.5),
                },
                t('compare.center'),
              ),
            ),
            h(
              'label',
              { className: 'mv-compare-slider-row' },
              h('span', null, t('compare.ratio')),
              h('input', {
                type: 'range',
                min: 5,
                max: 95,
                value: pct,
                'aria-label': t('compare.ratio'),
                onChange: (event) => handleRatio(Number(event.target.value) / 100),
              }),
              h('b', null, `${pct}%`),
            ),
          ),
    ),

    // ---- Section 2: Mesh topology & LOD inspection ----
    list.length > 0
      ? h(
          'section',
          { className: 'mv-compare-sec' },
          h(
            'div',
            { className: 'mv-compare-sec-head' },
            h('span', { className: 'mv-compare-sec-title' }, t('compare.sectionInspect')),
            h(
              'button',
              { type: 'button', className: 'mv-compare-sse-pill', disabled: !diag, onClick: handleResetInspect },
              t('compare.resetInspect'),
            ),
          ),
          h(
            'label',
            { className: 'mv-compare-field' },
            h('span', null, t('compare.inspectTarget')),
            h(
              'select',
              {
                value: inspectId,
                'aria-label': t('compare.inspectTarget'),
                onChange: (event) => setInspectId(event.target.value),
              },
              ...list.map((layer) => h('option', { key: layer.id, value: layer.id }, formatLayerOption(t, layer))),
            ),
          ),
          h(
            'div',
            { className: 'mv-compare-toggles' },
            h(
              'button',
              {
                type: 'button',
                className: 'mv-cta',
                disabled: !diag || is3dgsInspect,
                'aria-pressed': Boolean(diag?.wireframe),
                title: is3dgsInspect ? t('compare.wireframe3dgsHint') : t('compare.wireframe'),
                onClick: () => patchDiagnostics({ wireframe: !diag?.wireframe }),
              },
              `${diag?.wireframe ? '☑' : '☐'} ${t('compare.wireframe')}`,
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mv-cta',
                disabled: !diag || is3dgsInspect,
                'aria-pressed': Boolean(diag?.clay),
                title: is3dgsInspect ? t('compare.wireframe3dgsHint') : t('compare.clayHint'),
                onClick: () => patchDiagnostics({ clay: !diag?.clay }),
              },
              `${diag?.clay ? '☑' : '☐'} ${t('compare.clay')}`,
            ),
          ),
          is3dgsInspect ? h('p', { className: 'mv-compare-warn' }, t('compare.wireframe3dgsHint')) : null,
          h(
            'div',
            { className: 'mv-compare-sse-row', title: t('compare.sseHint') },
            h('span', { className: 'mv-compare-sec-title' }, t('compare.sse')),
            ...SSE_PRESETS.map((preset) =>
              h(
                'button',
                {
                  key: preset,
                  type: 'button',
                  className: `mv-compare-sse-pill${diag && Math.abs(diag.sse - preset) < 0.05 ? ' on' : ''}`,
                  disabled: !diag,
                  onClick: () => patchDiagnostics({ sse: preset }),
                },
                String(preset),
              ),
            ),
            h('input', {
              type: 'number',
              className: 'mv-compare-sse-input',
              min: 0.25,
              max: 128,
              step: 0.5,
              disabled: !diag,
              'aria-label': t('compare.sse'),
              value: diag ? diag.sse : 16,
              onChange: (event) => {
                const num = Number(event.target.value)
                if (Number.isFinite(num)) patchDiagnostics({ sse: num })
              },
            }),
          ),
          diag
            ? h(
                'div',
                { className: 'mv-compare-stats' },
                h('span', null, t('compare.statTiles'), h('b', null, String(diag.statistics.selectedTiles))),
                h('span', null, t('compare.statTriangles'), h('b', null, formatCount(diag.statistics.triangles))),
                h('span', null, t('compare.statMemory'), h('b', null, formatDiagnosticBytes(diag.statistics.totalMemoryBytes))),
                h('span', null, t('compare.statPending'), h('b', null, String(diag.statistics.pendingRequests))),
              )
            : null,
        )
      : null,

    // ---- Section 3: Exact camera pose & multi-frame figure export ----
    h(
      'section',
      { className: 'mv-compare-sec' },
      h(
        'div',
        { className: 'mv-compare-sec-head' },
        h('span', { className: 'mv-compare-sec-title' }, t('compare.sectionPoseExport')),
      ),
      h(
        'div',
        { className: 'mv-compare-row' },
        h('button', { type: 'button', className: 'mv-cta', onClick: handleCopyPose }, t('compare.copyPose')),
        h(
          'button',
          {
            type: 'button',
            className: 'mv-cta',
            'aria-expanded': poseOpen,
            onClick: () => setPoseOpen((open) => !open),
          },
          poseOpen ? t('compare.cancelPose') : t('compare.pastePose'),
        ),
      ),
      poseOpen
        ? h(
            'div',
            { className: 'mv-compare-pose-box' },
            h('textarea', {
              value: poseText,
              placeholder: t('compare.posePlaceholder'),
              'aria-label': t('compare.pastePose'),
              onChange: (event) => setPoseText(event.target.value),
            }),
            h(
              'div',
              { className: 'mv-compare-row' },
              h('button', { type: 'button', className: 'mv-cta primary', onClick: handleApplyPose }, t('compare.applyPose')),
              h('button', { type: 'button', className: 'mv-cta', onClick: () => setPoseOpen(false) }, t('compare.cancelPose')),
            ),
          )
        : null,
      list.length > 0
        ? h(
            React.Fragment,
            null,
            h(
              'div',
              { className: 'mv-compare-checks' },
              h(
                'label',
                { className: 'mv-compare-check' },
                h('input', {
                  type: 'checkbox',
                  checked: exportDivider,
                  onChange: (event) => setExportDivider(event.target.checked),
                }),
                h('span', null, t('compare.exportDivider')),
              ),
              h(
                'label',
                { className: 'mv-compare-check' },
                h('input', {
                  type: 'checkbox',
                  checked: exportLabels,
                  onChange: (event) => setExportLabels(event.target.checked),
                }),
                h('span', null, t('compare.exportLabels')),
              ),
            ),
            h(
              'label',
              { className: 'mv-compare-field' },
              h('span', null, t('compare.exportWidth')),
              h(
                'select',
                {
                  value: String(exportWidth),
                  'aria-label': t('compare.exportWidth'),
                  onChange: (event) => setExportWidth(Number(event.target.value) || 1920),
                },
                ...EXPORT_WIDTHS.map((w) => h('option', { key: w, value: String(w) }, `${w} px`)),
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mv-cta primary',
                disabled: exporting || !leftId || typeof renderSnapshot !== 'function',
                onClick: handleExport,
              },
              exporting ? t('compare.exporting') : t('compare.exportBtn'),
            ),
            h('p', { className: 'mv-none' }, t('compare.exportHint')),
          )
        : null,
      h('div', { className: 'mv-compare-status', role: 'status' }, statusMsg),
    ),
  )
}
