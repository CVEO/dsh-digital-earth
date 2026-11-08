/**
 * ui/scene-details.js — the dedicated "scene details" surface.
 *
 * The layer panel is a long, narrow list; inlining camera telemetry and per-layer
 * counters into it made both harder to read. This hook owns a separate floating
 * card instead: opened from the layer-panel header (whole scene) or from one
 * layer row (that layer only). The panel only exposes the entry points.
 */
import React from 'react'

import { formatBytes, formatCount } from '../format.js'

const h = React.createElement

export function useSceneDetails({ t, stats, config, layers, analysis, shaderActive }) {
  const [focus, setFocus] = React.useState(null) // null | { layerId: string|null }
  const open = React.useCallback((layerId) => setFocus({ layerId: typeof layerId === 'string' ? layerId : null }), [])
  const close = React.useCallback(() => setFocus(null), [])

  React.useEffect(() => {
    if (!focus) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setFocus(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [focus])

  const focusedLayer = focus?.layerId ? ((layers ?? []).find((layer) => layer.id === focus.layerId) ?? null) : null
  const sourceName = (list, id) => (Array.isArray(list) ? list.find((source) => source.id === id)?.name : null) ?? t('sceneDetails.none')
  const row = (label, value) => h('div', { className: 'mv-sd-row' }, h('span', null, label), h('b', null, value))
  const layerRows = (stats?.layers ?? (layers ?? []).map((layer) => ({ id: layer.id, name: layer.name }))).filter(
    (layer) => focusedLayer === null || layer.id === focusedLayer.id,
  )

  const element = focus
    ? h(
        'div',
        { className: 'mv-scene-details mv-glass', role: 'dialog', 'aria-label': focusedLayer ? t('sceneDetails.layerTitle') : t('sceneDetails.title') },
        h(
          'header',
          null,
          h('b', null, focusedLayer ? t('sceneDetails.layerTitle') : t('sceneDetails.title')),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: close }, '✕'),
        ),
        h(
          'div',
          { className: 'mv-sd-section' },
          h('div', { className: 'mv-sd-title' }, t('sceneDetails.scene')),
          row(t('hud.camera'), stats?.height ?? '—'),
          row(t('hud.heading'), `${stats?.heading ?? '—'} / ${stats?.pitch ?? '—'}`),
          row(t('layers.imagery'), sourceName(config?.imagery, config?.settings?.imagery)),
          row(t('layers.terrain'), sourceName(config?.terrain, config?.settings?.terrain)),
          row(t('sceneDetails.analysis'), analysis ? `${analysis.operation ?? ''}${analysis.layer ? ` · ${analysis.layer}` : ''}` : t('sceneDetails.none')),
          row(t('sceneDetails.shader'), shaderActive?.length ? String(shaderActive.length) : t('sceneDetails.none')),
        ),
        focusedLayer?.georefIssue
          ? h('p', { className: 'mv-sd-warn' }, `⚠ ${t('layers.georefWarning')}`)
          : null,
        h(
          'div',
          { className: 'mv-sd-section' },
          h('div', { className: 'mv-sd-title' }, focusedLayer ? t('sceneDetails.layer') : t('sceneDetails.layers')),
          layerRows.length === 0
            ? h('div', { className: 'mv-sd-empty' }, t('sceneDetails.none'))
            : layerRows.map((layer) =>
                h(
                  'div',
                  { key: layer.id, className: 'mv-sd-layer' },
                  h('b', null, layer.name ?? '—'),
                  h(
                    'span',
                    null,
                    `${t('hud.tiles')} ${formatCount(layer.tiles)} · ${t('hud.pending')} ${formatCount(layer.pending)} · ${t('hud.triangles')} ${formatCount(layer.triangles)} · ${t('hud.cache')} ${formatBytes(layer.memory)}`,
                  ),
                ),
              ),
        ),
      )
    : null

  return { open, close, element }
}
