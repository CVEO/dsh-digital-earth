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
  swipeState,
  onSwipeLayer,
  onOpenLocal,
  onOpenUrl,
  recentDirs,
  onOpenRecent,
}) {
  const [addOpen, setAddOpen] = React.useState(false)
  const addBtnRef = React.useRef(null)
  const addMenuRef = React.useRef(null)
  React.useEffect(() => {
    if (!addOpen || typeof document === 'undefined') return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setAddOpen(false)
    }
    const onPointerDown = (event) => {
      if (addMenuRef.current?.contains?.(event.target) || addBtnRef.current?.contains?.(event.target)) return
      setAddOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [addOpen])
  const recents = Array.isArray(recentDirs) ? recentDirs : []
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
      h(
        'div',
        { className: 'mv-group-actions' },
        layers.length > 0
          ? h('button', { type: 'button', className: 'mv-cta', onClick: onFrameAll }, t('layers.frameAll'))
          : null,
        h(
          'button',
          {
            ref: addBtnRef,
            type: 'button',
            className: `mv-cta${addOpen ? ' primary' : ''}`,
            'aria-expanded': addOpen,
            'aria-haspopup': 'menu',
            'aria-controls': 'mv-add-3d-menu',
            onClick: () => setAddOpen((value) => !value),
          },
          addOpen ? t('layers.overlayCancel') : t('layers.add3d'),
        ),
      ),
    ),
    addOpen
      ? h(
          'div',
          { id: 'mv-add-3d-menu', ref: addMenuRef, key: 'add-3d-menu', className: 'mv-overlay-form mv-add3d-menu', role: 'menu' },
          h(
            'button',
            {
              key: 'add-local',
              type: 'button',
              role: 'menuitem',
              className: 'mv-cta primary',
              onClick: () => {
                setAddOpen(false)
                onOpenLocal?.()
              },
            },
            t('btn.openLocal'),
          ),
          h(
            'button',
            {
              key: 'add-url',
              type: 'button',
              role: 'menuitem',
              className: 'mv-cta',
              onClick: () => {
                setAddOpen(false)
                onOpenUrl?.()
              },
            },
            t('layers.openUrl'),
          ),
          recents.length > 0
            ? h('span', { key: 'recent-label', className: 'mv-menu-label' }, t('menu.recentDirs'))
            : null,
          ...recents.map((entry) =>
            h(
              'button',
              {
                key: entry.dir,
                type: 'button',
                role: 'menuitem',
                className: 'mv-cta',
                title: entry.dir,
                onClick: () => {
                  setAddOpen(false)
                  onOpenRecent?.(entry.dir)
                },
              },
              entry.name,
            ),
          ),
        )
      : null,
    layers.length === 0
      ? h('div', { key: 'no-3d', className: 'mv-none' }, t('layers.contentEmpty'))
      : layers.map((layer) =>
          h(LayerRow, {
            key: layer.id,
            t,
            layer,
            shader: shaderFor(layer),
            swipeActive: swipeState?.kind === '3d' && swipeState?.id === layer.id,
            onFlyLayer,
            onToggleLayer,
            onInspectLayer,
            onRemoveLayer,
            onEditShader: onEditLayerShader,
            onShowSceneDetails,
            onSwipeLayer,
          }),
        ),
  )
}
