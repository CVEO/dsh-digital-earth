/**
 * ui/scene-dialogs.js — the two scene-card dialogs, rendered from one place.
 *
 * v1.8 WP2/WP3: adding data (AddLayerDialog) and per-layer properties
 * (LayerProperties) are overlays, not inline forms. They are pure presenters, so
 * ViewerSurface keeps the state and handlers and this module keeps the JSX, which
 * also keeps the ViewerSurface line budget honest.
 */
import React from 'react'

import { AddLayerDialog } from './add-layer-dialog.js'
import { LayerProperties } from './layer-properties.js'

const h = React.createElement

export function SceneDialogs({
  t,
  request,
  selection,
  layers,
  config,
  settings,
  agentOverlays,
  overlayDetails,
  shaderActive,
  workbench,
  recentDirs,
  onCloseAdd,
  onCloseProps,
  onOverlayAdd,
  onImportVector,
  onFlyLayer,
  onToggleLayer,
  onInspectLayer,
  onOverlayOpacity,
  onOverlayVisible,
  onEditLayerShader,
  onSelectAgentFeature,
  onExportOverlay,
  onFlyAgentOverlay,
}) {
  return h(
    React.Fragment,
    null,
    h(AddLayerDialog, {
      key: 'add-layer',
      t,
      request,
      onClose: onCloseAdd,
      onOpenLocal: workbench?.openLocal,
      onOpenUrl: workbench?.openUrl,
      recentDirs,
      onOpenRecent: workbench?.openRecent,
      // The raster dialog uses the same picker for two routes: local XYZ
      // (withMeta) and a folder scan for GeoTIFF publishing (pickDirOnly).
      onPickLocalTiles: (options) =>
        workbench?.pickLocalTiles?.(options?.pickDirOnly ? { pickDirOnly: true } : { withMeta: true }),
      onOverlayAdd,
      onImportVector,
    }),
    selection
      ? h(LayerProperties, {
          key: 'layer-props',
          t,
          selection,
          layers,
          config,
          settings,
          agentOverlays,
          overlayDetails,
          shaderActive,
          onClose: onCloseProps,
          onFlyLayer,
          onToggleLayer,
          onInspectLayer,
          onOverlayOpacity,
          onOverlayVisible,
          onEditLayerShader,
          onSelectAgentFeature,
          onExportOverlay,
          onFlyAgentOverlay,
        })
      : null,
  )
}
