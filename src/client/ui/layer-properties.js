/**
 * ui/layer-properties.js — the per-layer properties dialog (v1.8 WP3).
 *
 * One place to answer "what is this thing?" for all three scene-data kinds, with
 * the same three tabs every time (信息 / 外观 / 数据) instead of a different
 * mechanism per row type:
 *   - 信息  name, kind, source, counts;
 *   - 外观  visibility, opacity (raster) or the shader entry (3D Tiles);
 *   - 数据  fly to it, data health (3D Tiles), feature list / GeoJSON export.
 *
 * The row `⋯` menu is the entry point (属性…), and destructive actions stay in
 * that same menu so this dialog never needs a "delete" affordance.
 */
import React from 'react'

import { hasRasterTimeline, resolveSourceFrames } from '../scene/raster-time.js'
import { shaderEntrySummary } from './workbench-wiring.js'
import { useDialogA11y } from './use-dialog-a11y.js'

const h = React.createElement

const TABS = ['info', 'look', 'data']

function row(label, value) {
  if (value === null || value === undefined || value === '') return null
  return h(
    'div',
    { key: label, className: 'mv-prop-row' },
    h('span', { className: 'mv-prop-label' }, label),
    h('span', { className: 'mv-prop-value', title: String(value) }, String(value)),
  )
}

export function LayerProperties({
  t,
  selection,
  layers,
  config,
  agentOverlays,
  overlayDetails,
  settings,
  shaderActive,
  onClose,
  onFlyLayer,
  onFlyAgentOverlay,
  onToggleLayer,
  onInspectLayer,
  onOverlayOpacity,
  onOverlayVisible,
  onEditLayerShader,
  onSelectAgentFeature,
  onExportOverlay,
}) {
  const open = Boolean(selection)
  const dialogRef = useDialogA11y({ open, onEscape: onClose })
  const [tab, setTab] = React.useState('info')
  const propTabLabel = {
    info: t('layers.propsTab.info'),
    look: t('layers.propsTab.look'),
    data: t('layers.propsTab.data'),
  }

  React.useEffect(() => {
    if (open) setTab('info')
  }, [open, selection?.kind, selection?.id, selection?.index])

  if (!open) return null

  const kind = selection.kind
  let name = ''
  let kindLabel = ''
  let source = ''
  let tint = ''
  if (kind === '3d') {
    const layer = (layers ?? []).find((entry) => entry.id === selection.id)
    if (!layer) return null
    const shader = (shaderActive ?? []).find((entry) => entry.layerId === layer.id) ?? null
    name = layer.name
    kindLabel = layer.kind === '3dgs' ? t('layers.kindSplats') : t('layers.kindTiles')
    source = layer.url || layer.path || ''
    tint = shader ? shaderEntrySummary(t, shader) : ''
    const titleId = 'mv-prop-title'
    const tabs = TABS.map((entry) =>
      h(
        'button',
        {
          key: entry,
          type: 'button',
          role: 'tab',
          className: `mv-tab${tab === entry ? ' on' : ''}`,
          'aria-selected': tab === entry,
          onClick: () => setTab(entry),
        },
        propTabLabel[entry],
      ),
    )
    const body =
      tab === 'info'
        ? h(
            'div',
            { className: 'mv-prop-body' },
            row(t('layers.propsName'), name),
            row(t('layers.propsKind'), kindLabel),
            row(t('layers.propsSource'), source),
            row(t('layers.propsShader'), tint || t('layers.propsShaderNone')),
            row(t('layers.propsVisible'), layer.visible ? t('layers.propsShown') : t('layers.propsHidden')),
          )
        : tab === 'look'
          ? h(
              'div',
              { className: 'mv-prop-body' },
              h(
                'button',
                { type: 'button', className: 'mv-cta', onClick: () => onToggleLayer?.(layer.id) },
                layer.visible ? t('layers.propsHide') : t('layers.propsShow'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  disabled: layer.kind === '3dgs',
                  title: layer.kind === '3dgs' ? t('layers.appearance3dgs') : '',
                  onClick: () => {
                    onClose?.()
                    onEditLayerShader?.(layer, shader)
                  },
                },
                t('layers.appearance'),
              ),
            )
          : h(
              'div',
              { className: 'mv-prop-body' },
              h('button', { type: 'button', className: 'mv-cta', onClick: () => onFlyLayer?.(layer.id) }, t('btn.flyTo')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  onClick: () => {
                    onClose?.()
                    onInspectLayer?.(layer.id)
                  },
                },
                t('layers.propsHealth'),
              ),
            )
    return h(
      'div',
      { className: 'mv-modal mv-prop-modal', onPointerDown: (event) => event.target === event.currentTarget && onClose?.() },
      h(
        'div',
        { ref: dialogRef, className: 'mv-dialog mv-props', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
        h(
          'header',
          null,
          h('b', { id: titleId }, `${t('layers.properties')} · ${name}`),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: onClose }, '✕'),
        ),
        h('div', { className: 'mv-tabs', role: 'tablist' }, ...tabs),
        body,
      ),
    )
  }

  if (kind === 'raster') {
    // Overlays are a scene setting (settings.overlays); config.rasterOverlays is
    // the legacy catalogue, read as a fallback so either shape resolves.
    const overlay = [...(settings?.overlays ?? []), ...(config?.rasterOverlays ?? [])].find(
      (entry) => entry.id === selection.id,
    )
    if (!overlay) return null
    const titleId = 'mv-prop-title'
    const frames = hasRasterTimeline(overlay) ? resolveSourceFrames(overlay) : []
    const tabs = TABS.map((entry) =>
      h(
        'button',
        {
          key: entry,
          type: 'button',
          role: 'tab',
          className: `mv-tab${tab === entry ? ' on' : ''}`,
          'aria-selected': tab === entry,
          onClick: () => setTab(entry),
        },
        propTabLabel[entry],
      ),
    )
    const body =
      tab === 'info'
        ? h(
            'div',
            { className: 'mv-prop-body' },
            row(t('layers.propsName'), overlay.name),
            row(t('layers.propsKind'), String(overlay.type).toUpperCase()),
            row(t('layers.propsSource'), overlay.url),
            row(t('layers.propsFrames'), frames.length > 0 ? String(frames.length) : ''),
            row(t('layers.propsVisible'), overlay.visible === false ? t('layers.propsHidden') : t('layers.propsShown')),
          )
        : tab === 'look'
          ? h(
              'div',
              { className: 'mv-prop-body' },
              h(
                'label',
                { className: 'mv-field' },
                h('span', null, t('layers.overlayOpacity')),
                h('input', {
                  type: 'range',
                  min: 0,
                  max: 100,
                  value: Math.round((overlay.opacity ?? 1) * 100),
                  onChange: (event) => onOverlayOpacity?.(overlay.id, Number(event.target.value) / 100),
                }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  onClick: () => onOverlayVisible?.(overlay.id, overlay.visible === false),
                },
                overlay.visible === false ? t('layers.propsShow') : t('layers.propsHide'),
              ),
            )
          : h(
              'div',
              { className: 'mv-prop-body' },
              row(t('layers.propsSource'), overlay.url),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-cta',
                  onClick: () => {
                    void navigator.clipboard?.writeText?.(overlay.url ?? '')
                  },
                },
                t('layers.propsCopyUrl'),
              ),
            )
    return h(
      'div',
      { className: 'mv-modal mv-prop-modal', onPointerDown: (event) => event.target === event.currentTarget && onClose?.() },
      h(
        'div',
        { ref: dialogRef, className: 'mv-dialog mv-props', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
        h(
          'header',
          null,
          h('b', { id: titleId }, `${t('layers.properties')} · ${overlay.name}`),
          h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: onClose }, '✕'),
        ),
        h('div', { className: 'mv-tabs', role: 'tablist' }, ...tabs),
        body,
      ),
    )
  }

  // Vector / annotation overlay: features come from the shared overlay index.
  const overlayRow = (agentOverlays ?? []).find((entry) => entry.index === selection.index)
  if (!overlayRow) return null
  const features = Array.isArray(overlayDetails?.[selection.index]) ? overlayDetails[selection.index] : []
  const titleId = 'mv-prop-title-vector'
  const body = h(
    'div',
    { className: 'mv-prop-body' },
    row(t('layers.propsName'), overlayRow.label),
    row(t('layers.propsKind'), t('layers.propsVector')),
    row(t('layers.propsFeatures'), String(features.length)),
    h(
      'button',
      {
        type: 'button',
        className: 'mv-cta',
        onClick: () => {
          onClose?.()
          onFlyAgentOverlay?.(overlayRow.kind, selection.index)
        },
      },
      t('btn.flyTo'),
    ),
    features.length > 0 && onSelectAgentFeature
      ? h(
          'button',
          {
            type: 'button',
            className: 'mv-cta',
            onClick: () => {
              onClose?.()
              onSelectAgentFeature(selection.index, features[0]?.featureIndex ?? 0)
            },
          },
          t('layers.propsEditFeatures'),
        )
      : null,
    onExportOverlay
      ? h(
          'button',
          { type: 'button', className: 'mv-cta', onClick: () => onExportOverlay(selection.index) },
          t('layers.exportVector'),
        )
      : null,
  )
  return h(
    'div',
    { className: 'mv-modal mv-prop-modal', onPointerDown: (event) => event.target === event.currentTarget && onClose?.() },
    h(
      'div',
      { ref: dialogRef, className: 'mv-dialog mv-props', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h(
        'header',
        null,
        h('b', { id: titleId }, `${t('layers.properties')} · ${overlayRow.label}`),
        h('button', { type: 'button', className: 'mv-icon-btn', title: t('btn.close'), 'aria-label': t('btn.close'), onClick: onClose }, '✕'),
      ),
      body,
    ),
  )
}
