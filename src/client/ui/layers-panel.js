/**
 * ui/layers-panel.js — the "场景" card: every scene-data surface in one place.
 *
 * v1.8 IA pass: the card is named after what it manages (a scene), and its two
 * tabs split by shape instead of by view:
 *   - 三维    things that stand up in space: annotations, measurements, 3D Tiles
 *             / 3DGS content (ui/layers-entities.js);
 *   - 地表    things draped on the ground: vector layers, raster layers, imagery
 *             basemap and terrain (ui/layers-surface.js).
 *
 * The split used to be 三维 / 地图, but the panel only ever shows one globe and
 * terrain is not 2D data — "体 vs 面" is the distinction users can actually see.
 *
 * This file stays thin on purpose: tabs, header, resize and delegation. Adding
 * data always goes through the AddLayerDialog (WP2), never an inline form.
 */
import React from 'react'

import { LayersEntities, splitEntityRows } from './layers-entities.js'
import { LayersSurface } from './layers-surface.js'
import { ResizeHandle, usePanelResize } from './resizable.js'
import { mergeRefs, useFloatingWindow } from './floating.js'
import { readPanelFlag, writePanelFlag } from './panel-prefs.js'
import { normalizeOverlayDraft } from '../scene/overlay-layers.js'

const h = React.createElement
let nextTabsId = 0

const TAB_KEY = 'layers.tab.surface'

export { normalizeOverlayDraft }

export function LayersPanel({
  t,
  config,
  settings,
  layers,
  onCollapse,
  onSelectTerrain,
  onSelectImagery,
  terrainError,
  onRetryTerrain,
  onFlyLayer,
  onFrameAll,
  onToggleLayer,
  onRemoveLayer,
  shaderActive,
  onEditLayerShader,
  onOpenLayerProperties,
  onAddLayer,
  onOverlayRemove,
  onOverlayVisible,
  onOverlayMove,
  agentOverlays,
  overlayDetails,
  overlayExtrusions,
  onToggleOverlayExtrude,
  onToggleOverlayVisible,
  onRemoveAgentOverlay,
  onFlyAgentOverlay,
  onFlyAgentFeature,
  onRemoveAgentFeature,
  onClearAnnotations,
  onClearMeasurements,
  onClearImports,
  onSelectAgentFeature,
  onExportOverlay,
  onSendOverlay,
  canSend,
  onQuickAnnotate,
  onOpenMeasure,
  onShowSceneDetails,
  swipeState,
  onSwipeLayer,
  onOverlaySwipe,
  vectorExport,
  rasterFrames,
  onSelectRasterFrame,
  embedded = false,
  forceFloat = false,
  onFloatingChange,
}) {
  // The 3D tab is primary: the 3D Tiles the user loaded is why the panel is open.
  const [tab, setTab] = React.useState(() => (readPanelFlag(TAB_KEY, false) ? 'surface' : '3d'))
  const selectTab = React.useCallback((next) => {
    setTab(next)
    writePanelFlag(TAB_KEY, next === 'surface')
  }, [])
  const resize = usePanelResize({
    storageKey: 'layers',
    widthDirection: 'right',
    initialWidth: null,
    minWidth: 240,
    maxWidth: 680,
    initialHeight: null,
    minHeight: 120,
    maxHeight: 620,
  })
  const floating = useFloatingWindow({
    storageKey: 'layers',
    title: t('layers.title'),
    t,
    forceFloat,
    restoreSaved: false,
    hasExplicitWidth: Boolean(resize.size.width),
  })
  React.useEffect(() => {
    onFloatingChange?.(floating.moved)
  }, [floating.moved, onFloatingChange])
  const tabsId = React.useMemo(() => `mv-data-${++nextTabsId}`, [])
  const tabsRef = React.useRef(null)
  const onTabKey = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? '3d' : event.key === 'End' ? 'surface' : tab === '3d' ? 'surface' : '3d'
    selectTab(next)
    tabsRef.current?.querySelector(`[data-tab="${next}"]`)?.focus()
  }
  const sourceName = (list, id) => list?.find((item) => item.id === id)?.name ?? null
  const terrainActive = sourceName(config?.terrain, settings?.terrain)
  const { annotations, measurements, imports } = splitEntityRows(agentOverlays)
  const overlayCount = Array.isArray(config?.rasterOverlays) ? config.rasterOverlays.length : 0
  const entitiesCount = layers.length + annotations.length + measurements.length
  const surfaceCount = imports.length + overlayCount
  const panelStyle = embedded
    ? undefined
    : floating.moved
      ? { ...floating.style, ...resize.style }
      : { ...floating.style, height: resize.style?.height, maxHeight: resize.style?.maxHeight }

  const tabButton = (value, label, count) =>
    h(
      'button',
      {
        type: 'button',
        id: `${tabsId}-${value}`,
        'data-tab': value,
        role: 'tab',
        tabIndex: tab === value ? 0 : -1,
        'aria-controls': `${tabsId}-panel`,
        'aria-selected': tab === value,
        className: `mv-layer-tab${tab === value ? ' on' : ''}`,
        onClick: () => selectTab(value),
      },
      `${label}${count > 0 ? ` · ${count}` : ''}`,
    )

  return h(
    'div',
    {
      className: `mv-layers mv-glass ${floating.className}${embedded ? ' in-dock' : ''}`,
      ref: mergeRefs(floating.ref, resize.ref),
      style: panelStyle,
      ...floating.panelProps,
    },
    h(
      'header',
      floating.headerProps,
      floating.dragHandle,
      h('span', { className: 'title' }, t('layers.title')),
      h(
        'div',
        { className: 'mv-head-actions' },
        floating.resetButton,
        h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn mv-head-add',
            title: t('layers.addLayer'),
            'aria-label': t('layers.addLayer'),
            onClick: () => onAddLayer?.(null),
          },
          '＋',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn',
            title: t('sceneDetails.openHint'),
            'aria-label': t('sceneDetails.openHint'),
            onClick: () => onShowSceneDetails?.(),
          },
          'ⓘ',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn',
            title: t('layers.collapse'),
            'aria-label': t('layers.collapse'),
            onClick: onCollapse,
          },
          '✕',
        ),
      ),
    ),
    floating.liveRegion,
    h(
      'div',
      {
        key: 'layer-tabs',
        ref: tabsRef,
        className: 'mv-layer-tabs',
        role: 'tablist',
        'aria-label': t('layers.title'),
        onKeyDown: onTabKey,
      },
      tabButton('3d', t('layers.tab.3d'), entitiesCount),
      tabButton('surface', t('layers.tab.surface'), surfaceCount),
    ),
    h(
      'div',
      { id: `${tabsId}-panel`, role: 'tabpanel', 'aria-labelledby': `${tabsId}-${tab}`, className: 'mv-data-panel' },
      tab === '3d'
        ? h(LayersEntities, {
            t,
            layers,
            shaderActive,
            agentOverlays,
            overlayDetails,
            overlayExtrusions,
            onFlyLayer,
            onFrameAll,
            onToggleLayer,
            onRemoveLayer,
            onEditLayerShader,
            onOpenLayerProperties,
            swipeState,
            onSwipeLayer,
            onAddLayer,
            onQuickAnnotate,
            onOpenMeasure,
            onFlyAgentOverlay,
            onFlyAgentFeature,
            onRemoveAgentFeature,
            onRemoveAgentOverlay,
            onToggleOverlayExtrude,
            onToggleOverlayVisible,
            onSelectAgentFeature,
            onExportOverlay,
            onSendOverlay,
            canSend,
            onClearAnnotations,
            onClearMeasurements,
          })
        : h(LayersSurface, {
            t,
            config,
            settings,
            terrainActive,
            terrainError,
            onSelectTerrain,
            onRetryTerrain,
            onSelectImagery,
            onOverlayRemove,
            onOverlayVisible,
            onOverlayMove,
            onOverlaySwipe,
            onOpenLayerProperties,
            swipeState,
            vectorExport,
            rasterFrames,
            onSelectRasterFrame,
            importedOverlays: imports,
            overlayDetails,
            onFlyAgentOverlay,
            onFlyAgentFeature,
            onRemoveAgentFeature,
            onRemoveAgentOverlay,
            onSelectAgentFeature,
            onExportOverlay,
            onSendOverlay,
            canSend,
            onToggleOverlayVisible,
            onClearImports,
            onAddLayer,
          }),
    ),
    h(ResizeHandle, {
      axis: 'height',
      edge: 'bottom',
      label: t('resize.height'),
      value: resize.size.height,
      onPointerDown: resize.beginHeight,
      onKeyDown: resize.keyHeight,
      min: resize.minHeight,
      max: resize.maxHeight,
    }),
    floating.moved
      ? h(ResizeHandle, {
          axis: 'corner',
          edge: 'corner',
          label: t('resize.size'),
          value: resize.size.width,
          onPointerDown: resize.beginCorner,
          onKeyDown: resize.keyWidth,
          min: resize.minWidth,
          max: resize.maxWidth,
        })
      : null,
  )
}
