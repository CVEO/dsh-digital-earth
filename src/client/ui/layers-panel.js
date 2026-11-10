/**
 * ui/layers-panel.js — the layer card shell: pure data layers, two tabs.
 *
 * v1.6 IA pass (meeting 116–140): the layer card only manages DATA. The 3D tab
 * holds terrain + 3D Tiles/3DGS; the map tab holds imagery, raster overlays and
 * vector overlays. Tools (measure, profile, sun, analysis, view bookmarks,
 * visual effects) moved to ui/tools-panel.js so "数据" and "功能" no longer share
 * one list. This file is deliberately thin: tabs + header + delegation.
 */
import React from 'react'

import { Layers3D } from './layers-3d.js'
import { LayersMap, normalizeOverlayDraft } from './layers-map.js'

const h = React.createElement

export { normalizeOverlayDraft }

export function LayersPanel({
  t,
  config,
  settings,
  layers,
  annotations,
  onCollapse,
  onSelectTerrain,
  onSelectImagery,
  terrainError,
  onRetryTerrain,
  onFlyLayer,
  onFrameAll,
  onToggleLayer,
  onInspectLayer,
  onRemoveLayer,
  shaderActive,
  onEditLayerShader,
  onOverlayAdd,
  onOverlayRemove,
  onOverlayOpacity,
  onOverlayVisible,
  onOverlayMove,
  onClearVector,
  agentOverlays,
  onRemoveAgentOverlay,
  onImportVector,
  onShowSceneDetails,
}) {
  // The 3D data tab is primary: the 3D Tiles the user loaded is why the panel is
  // open, while the map holds the supporting 2D sources.
  const [tab, setTab] = React.useState('3d')
  const sourceName = (list, id) => list?.find((item) => item.id === id)?.name ?? null
  const terrainActive = sourceName(config?.terrain, settings?.terrain)

  return h(
    'div',
    { className: 'mv-layers mv-glass' },
    h(
      'header',
      null,
      h('span', null, t('layers.title')),
      h(
        'div',
        { className: 'mv-head-actions' },
        h(
          'button',
          { type: 'button', className: 'mv-icon-btn', title: t('sceneDetails.openHint'), 'aria-label': t('sceneDetails.openHint'), onClick: () => onShowSceneDetails?.() },
          'ⓘ',
        ),
        h(
          'button',
          { type: 'button', className: 'mv-icon-btn', title: t('layers.collapse'), 'aria-label': t('layers.collapse'), onClick: onCollapse },
          '✕',
        ),
      ),
    ),
    h(
      'div',
      { key: 'layer-tabs', className: 'mv-layer-tabs', role: 'tablist' },
      h(
        'button',
        { type: 'button', role: 'tab', 'aria-selected': tab === '3d', className: `mv-layer-tab${tab === '3d' ? ' on' : ''}`, onClick: () => setTab('3d') },
        `${t('layers.tab.3d')}${layers.length ? ` · ${layers.length}` : ''}`,
      ),
      h(
        'button',
        { type: 'button', role: 'tab', 'aria-selected': tab === 'map', className: `mv-layer-tab${tab === 'map' ? ' on' : ''}`, onClick: () => setTab('map') },
        t('layers.tab.map'),
      ),
    ),
    tab === '3d'
      ? h(Layers3D, {
          t,
          config,
          settings,
          layers,
          terrainActive,
          terrainError,
          onSelectTerrain,
          onRetryTerrain,
          onFlyLayer,
          onFrameAll,
          onToggleLayer,
          onInspectLayer,
          onRemoveLayer,
          shaderActive,
          onEditLayerShader,
          onShowSceneDetails,
        })
      : h(LayersMap, {
          t,
          config,
          settings,
          onSelectImagery,
          onOverlayAdd,
          onOverlayRemove,
          onOverlayOpacity,
          onOverlayVisible,
          onOverlayMove,
          annotations,
          agentOverlays,
          onClearVector,
          onRemoveAgentOverlay,
          onImportVector,
        }),
  )
}
