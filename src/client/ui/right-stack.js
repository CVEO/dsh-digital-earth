/**
 * ui/right-stack.js — the right-hand floating column.
 *
 * Keeps ViewerSurface from owning the growing prop plumbing of the analysis,
 * layer and tools cards. The three cards share one column so an analysis result
 * never overlaps the layer list; layers and tools are separate cards by design
 * (data vs. functions), each independently closable.
 */
import React from 'react'

import { AnalysisCard } from './cards.js'
import { LayersPanel } from './layers-panel.js'
import { ToolsPanel } from './tools-panel.js'

const h = React.createElement

export function RightStack({ t, analysis, onCloseAnalysis, layersPanel, showLayers, toolsPanel, showTools }) {
  if (!analysis && !showLayers && !showTools) return null
  return h(
    'div',
    { className: 'mv-right' },
    analysis ? h(AnalysisCard, { key: 'analysis', state: analysis, t, onClose: onCloseAnalysis }) : null,
    showLayers ? h(LayersPanel, { key: 'layers', t, ...layersPanel }) : null,
    showTools ? h(ToolsPanel, { key: 'tools', t, ...toolsPanel }) : null,
  )
}
