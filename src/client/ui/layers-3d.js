/**
 * ui/layers-3d.js — the "三维" tab of the layer card: pure 3D data.
 *
 * Content: terrain source (the ground the 3D data sits on) and the loaded
 * 3D Tiles / 3DGS content layers. Analysis, sun, measure and view bookmarks are
 * tools and live in the tools card, never here.
 */
import React from 'react'

import { LayerRow } from './layer-row.js'

const h = React.createElement

export function Layers3D({
  t,
  config,
  settings,
  layers,
  terrainError,
  onSelectTerrain,
  onRetryTerrain,
  terrainActive,
  shaderActive,
  onFlyLayer,
  onFrameAll,
  onToggleLayer,
  onInspectLayer,
  onRemoveLayer,
  onEditLayerShader,
  onShowSceneDetails,
}) {
  const radioRow = (key, label, active, onClick) =>
    h(
      'button',
      { key, type: 'button', className: `mv-layer mv-choice${active ? ' on' : ''}`, 'aria-pressed': active, onClick },
      h('span', { className: 'name' }, label),
      h('span', { className: 'tick', 'aria-hidden': true }, active ? '✓' : ''),
    )
  const shaderFor = (layer) =>
    (shaderActive ?? []).find(
      (entry) => entry.layerId === layer.id || (entry.layerId === undefined && entry.layer === layer.name),
    ) ?? null

  return h(
    'div',
    { key: 'list-3d', className: 'mv-layer-list' },
    // ---- L1 terrain -----------------------------------------------------------
    h('div', { key: 'g1', className: 'mv-group' }, h('div', { className: 'mv-group-title' }, t('layers.terrain'))),
    radioRow('t-off', t('menu.terrainOff'), terrainActive === null, () => onSelectTerrain(null)),
    ...(config?.terrain ?? []).map((source) =>
      radioRow(`t-${source.id}`, source.name, settings?.terrain === source.id, () => onSelectTerrain(source.id)),
    ),
    terrainError
      ? h(
          'div',
          { key: 'terrain-error', className: 'mv-none mv-terrain-error' },
          h('span', null, terrainError),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('terrain.retry'), 'aria-label': t('terrain.retry'), onClick: onRetryTerrain }, '↻'),
        )
      : null,
    // ---- 3D content -----------------------------------------------------------
    h(
      'div',
      { key: 'g6', className: 'mv-group' },
      h('div', { className: 'mv-group-title' }, `${t('layers.content')} · ${layers.length}`),
      layers.length > 0
        ? h('button', { type: 'button', className: 'mv-cta', onClick: onFrameAll }, t('layers.frameAll'))
        : null,
    ),
    layers.length === 0
      ? h('div', { key: 'no-3d', className: 'mv-none' }, t('layers.contentEmpty'))
      : layers.map((layer) =>
          h(LayerRow, {
            key: layer.id,
            t,
            layer,
            shader: shaderFor(layer),
            onFlyLayer,
            onToggleLayer,
            onInspectLayer,
            onRemoveLayer,
            onEditShader: onEditLayerShader,
            onShowSceneDetails,
          }),
        ),
  )
}
