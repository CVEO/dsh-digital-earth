/**
 * ui/layer-row.js — one 3D Tiles / 3DGS content row.
 *
 * Presentational only: visibility, fly-to, data health, remove, and the effect
 * badge/edit affordance. Extracted from layers-panel so the layer card stays a
 * thin shell and the tools card never needs to duplicate row markup.
 */
import React from 'react'

import { EyeIcon } from './icons.js'
import { shaderEntrySummary } from './workbench-wiring.js'

const h = React.createElement

export function LayerRow({ t, layer, shader, onFlyLayer, onToggleLayer, onInspectLayer, onRemoveLayer, onEditShader, onShowSceneDetails }) {
  const stop = (event) => event.stopPropagation()
  const summary = shader ? shaderEntrySummary(t, shader) : ''
  const openShader = () => onEditShader(layer, shader)
  return h(
    'div',
    {
      className: `mv-layer${layer.visible ? '' : ' off'}${shader ? ' has-shader' : ''}`,
      title: shader ? `${layer.name} — ${summary}` : layer.name,
      ...(shader
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: openShader,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                openShader()
              }
            },
          }
        : {}),
    },
    layer.georefIssue
      ? h('span', { className: 'mv-warn', title: t('layers.georefWarning'), 'aria-label': t('layers.georefWarning') }, '⚠')
      : null,
    h(
      'span',
      {
        className: 'name',
        title: layer.name,
        onClick: (event) => {
          stop(event)
          onFlyLayer(layer.id)
        },
      },
      layer.name,
    ),
    shader
      ? h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn mv-shader-edit',
            title: `${t('shader.editEntry')} · ${summary}`,
            'aria-label': t('shader.editEntry'),
            onClick: (event) => {
              stop(event)
              openShader()
            },
          },
          '✦',
        )
      : null,
    h(
      'button',
      {
        type: 'button',
        className: `mv-icon-btn${layer.visible ? '' : ' on'}`,
        title: layer.visible ? t('btn.hidden') : t('btn.visible'),
        'aria-label': layer.visible ? t('btn.hidden') : t('btn.visible'),
        onClick: (event) => {
          stop(event)
          onToggleLayer(layer.id)
        },
      },
      h(EyeIcon, { size: 15, off: !layer.visible }),
    ),
    h('button', { type: 'button', className: 'mv-icon-btn', title: t('sceneDetails.openLayerHint'), 'aria-label': t('sceneDetails.openLayerHint'), onClick: (event) => { stop(event); onShowSceneDetails?.(layer.id) } }, 'ⓘ'),
    h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.flyTo'), 'aria-label': t('btn.flyTo'), onClick: (event) => { stop(event); onFlyLayer(layer.id) } }, '⌖'),
    h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.health'), 'aria-label': t('btn.health'), onClick: (event) => { stop(event); onInspectLayer(layer.id) } }, '⌕'),
    h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.delete'), 'aria-label': t('btn.delete'), onClick: (event) => { stop(event); onRemoveLayer(layer.id) } }, '✕'),
  )
}
