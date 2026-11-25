/**
 * ui/layer-row.js — one 3D Tiles / 3DGS content row.
 *
 * Batch B1 (图层行溢出菜单): a row keeps only its primary actions inline —
 * visibility, the appearance (✦) entry and a "more" (⋯) button. Fly-to, data
 * health, scene details, swipe comparison and remove live in the overflow menu,
 * so a row with every capability no longer shows five 15px buttons.
 *
 * Menus are controlled by the parent (Layers3D owns the open row id): the row
 * stays a pure props-in/JSX-out component.
 */
import React from 'react'

import { EyeIcon } from './icons.js'
import { MenuItem } from './menu-item.js'
import { shaderEntrySummary } from './workbench-wiring.js'

const h = React.createElement

export function LayerRow({
  t,
  layer,
  shader,
  swipeActive,
  menuOpen = false,
  onMenuToggle,
  onFlyLayer,
  onToggleLayer,
  onInspectLayer,
  onRemoveLayer,
  onEditShader,
  onShowSceneDetails,
  onSwipeLayer,
}) {
  const stop = (event) => event.stopPropagation()
  const summary = shader ? shaderEntrySummary(t, shader) : ''
  const openShader = () => onEditShader(layer, shader)
  const is3dgs = layer.kind === '3dgs'
  const action = (key, label, handler, options = {}) =>
    h(
      MenuItem,
      {
        key,
        disabled: Boolean(options.disabled),
        title: options.title,
        active: Boolean(options.active),
        onClick: options.disabled
          ? undefined
          : () => {
              onMenuToggle?.(null)
              handler()
            },
      },
      label,
    )
  return h(
    'div',
    { className: `mv-layer${layer.visible ? '' : ' off'}${shader ? ' has-shader' : ''}${menuOpen ? ' menu-open' : ''}`, title: summary ? `${layer.name} — ${summary}` : layer.name },
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
    // Appearance entry: a layer's effects belong to the layer itself (audit
    // §3.3), so ✦ is the single visual-effects door — also when none is active.
    // 3DGS splats have no sampleable surface for the presets, so the entry is
    // disabled with the reason instead of opening a workbench that would fail.
    h(
      'button',
      {
        type: 'button',
        className: `mv-icon-btn mv-shader-edit${shader ? ' on' : ''}`,
        title: is3dgs ? t('layers.appearance3dgs') : summary ? `${t('shader.editEntry')} · ${summary}` : t('layers.appearance'),
        'aria-label': is3dgs ? t('layers.appearance3dgs') : summary ? t('shader.editEntry') : t('layers.appearance'),
        disabled: is3dgs,
        onClick: (event) => {
          stop(event)
          if (is3dgs) return
          openShader()
        },
      },
      '✦',
    ),
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
    h(
      'button',
      {
        type: 'button',
        className: `mv-icon-btn mv-row-more${menuOpen ? ' on' : ''}`,
        title: t('layers.more'),
        'aria-label': t('layers.more'),
        'aria-haspopup': 'menu',
        'aria-expanded': menuOpen,
        onClick: (event) => {
          stop(event)
          onMenuToggle?.(menuOpen ? null : layer.id)
        },
      },
      '⋯',
    ),
    menuOpen
      ? h(
          'div',
          { className: 'mv-row-menu mv-glass', role: 'menu', 'aria-label': t('layers.more') },
          action('fly', t('btn.flyTo'), () => onFlyLayer(layer.id)),
          action('health', t('btn.health'), () => onInspectLayer(layer.id)),
          action('details', t('sceneDetails.openLayerHint'), () => onShowSceneDetails?.(layer.id)),
          onSwipeLayer
            ? action('swipe', t('swipe.toggle'), () => onSwipeLayer(layer.id), {
                disabled: is3dgs || !layer.visible,
                active: Boolean(swipeActive),
                title: is3dgs ? t('swipe.unsupported3dgs') : undefined,
              })
            : null,
          h('i', { key: 'sep', className: 'mv-sep' }),
          action('remove', t('btn.delete'), () => onRemoveLayer(layer.id)),
        )
      : null,
  )
}
