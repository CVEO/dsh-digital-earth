/**
 * ui/toolbar-quick.js — the toolbar's data/tool cluster.
 *
 * Measure lives inside the Tools card, so the toolbar has no 量测 dropdown: one
 * plain 「工具」 button opens the right-hand Tools workbench, 「图层」 toggles the
 * data layer card. No arrow/menu — the card itself is the tool surface.
 */
import React from 'react'

const h = React.createElement

export function ToolbarQuick({ t, showLayers, showTools, onToggleLayers, onToggleTools, button }) {
  return h(
    React.Fragment,
    null,
    button(t('btn.tools'), onToggleTools, showTools, undefined, showTools ? t('btn.toolsHide') : t('btn.toolsShow')),
    button(
      t('btn.layers'),
      onToggleLayers,
      // The layer card is the only place to pick terrain/basemap now, so it must
      // be reachable even with zero 3D Tiles loaded.
      showLayers,
      undefined,
      showLayers ? t('btn.layersHide') : t('btn.layersShow'),
    ),
  )
}
