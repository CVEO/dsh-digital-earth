/**
 * ui/layers-surface.js — the "地表" tab of the scene card.
 *
 * Everything that is draped on the ground, listed in array order (index 0 is the
 * top row; raster draw order follows the same array, bottom first):
 *   矢量图层 → 栅格图层 → 影像底图 → 地形
 *
 * The imagery basemap and terrain are single-choice sources (only one can be
 * active); the two layer lists are stacked and ordered. Terrain used to live in
 * the 3D tab even though imagery lived here: both are "the ground", so they now
 * share one tab and one control style.
 *
 * Adding data never happens inline anymore: every "＋" opens the AddLayerDialog
 * (ui/add-layer-dialog.js), so the list never jumps while a form is open.
 */
import React from 'react'

import { hasRasterTimeline } from '../scene/raster-time.js'
import { VECTOR_COLORS } from '../scene/vector-style.js'
import { LayerGroup, groupCount, useGroupOpen } from './layer-group.js'
import { GlyphIcon, LayerActionIcon } from './icons.js'
import { LayerRow, RowDot, RowEye } from './layer-row.js'
import { RasterTimeline } from './raster-timeline.js'
import { useRowMenu } from './use-row-menu.js'

const h = React.createElement

const OVERLAY_KIND_LABEL = { wms: 'WMS', xyz: 'XYZ', arcgis: 'ArcGIS' }

export function LayersSurface({
  t,
  config,
  settings,
  terrainActive,
  terrainError,
  onSelectTerrain,
  onRetryTerrain,
  onSelectImagery,
  onOverlayAdd,
  onOverlayRemove,
  onOverlayOpacity,
  onOverlayVisible,
  onOverlayMove,
  onOverlaySwipe,
  onOpenLayerProperties,
  swipeState,
  vectorExport,
  rasterFrames,
  onSelectRasterFrame,
  importedOverlays,
  overlayDetails,
  onFlyAgentOverlay,
  onFlyAgentFeature,
  onRemoveAgentFeature,
  onSelectAgentFeature,
  onRemoveAgentOverlay,
  onExportOverlay,
  onSendOverlay,
  canSend,
  onToggleOverlayVisible,
  onClearImports,
  onAddLayer,
}) {
  const rowMenu = useRowMenu()
  const [expanded, setExpanded] = React.useState({})
  const [openVector, toggleVector] = useGroupOpen('vector')
  const [openRaster, toggleRaster] = useGroupOpen('raster')
  const [openImagery, toggleImagery] = useGroupOpen('imagery', false)
  const [openTerrain, toggleTerrain] = useGroupOpen('terrain')
  const overlays = Array.isArray(config?.rasterOverlays) ? config.rasterOverlays : []
  const imports = Array.isArray(importedOverlays) ? importedOverlays : []
  const imagerySources = Array.isArray(config?.imagery) ? config.imagery : []
  const terrainSources = Array.isArray(config?.terrain) ? config.terrain : []
  const activeImagerySource =
    settings?.imagery != null ? imagerySources.find((source) => source.id === settings.imagery) ?? null : null
  const imagerySummary =
    settings?.imagery == null ? t('layers.imageryNone') : activeImagerySource?.name ?? String(settings.imagery)
  const activeTerrainSource =
    terrainActive == null ? null : terrainSources.find((source) => source.id === terrainActive) ?? null
  const terrainSummary =
    terrainActive == null ? t('layers.terrainNone') : activeTerrainSource?.name ?? String(terrainActive)

  const radioRow = (key, label, active, onClick) =>
    h(
      'button',
      { key, type: 'button', className: `mv-layer mv-choice${active ? ' on' : ''}`, 'aria-pressed': active, onClick },
      h('span', { className: 'name' }, h('span', { className: 'mv-row-name' }, label)),
      h('span', { className: 'tick', 'aria-hidden': true }, active ? '✓' : ''),
    )

  const action = (icon, label, onClick, disabled = false) =>
    h(
      'button',
      { type: 'button', className: 'mv-icon-btn', title: label, 'aria-label': label, disabled, onClick: disabled ? undefined : onClick },
      h(GlyphIcon, { name: icon, size: 15 }),
    )

  const clearButton = (label, count, onClick) =>
    h(
      'button',
      {
        type: 'button',
        className: 'mv-icon-btn',
        title: `${label}${count > 0 ? ` · ${count}` : ''}`,
        'aria-label': label,
        disabled: count === 0,
        onClick: count === 0 ? undefined : onClick,
      },
      h(LayerActionIcon, { kind: 'delete', size: 15 }),
    )

  const featureCount = (row) => {
    const features = Array.isArray(overlayDetails?.[row.index]) ? overlayDetails[row.index] : []
    return features.length
  }

  // Feature rows are shared by imported layers and annotations: one list shape,
  // so the same editing affordances exist wherever a vector layer is listed.
  const featureRow = (row, feat) =>
    h(
      'div',
      { key: feat.featureId || `${row.id}-${feat.featureIndex}`, className: 'mv-overlay-feature' },
      h(
        'button',
        {
          type: 'button',
          className: 'mv-overlay-feature-pick',
          title: t('layers.featureSelectHint'),
          onClick: () => onSelectAgentFeature?.(row.index, feat.featureIndex),
        },
        h('span', {
          className: 'mv-overlay-feature-dot',
          'aria-hidden': true,
          style: { background: VECTOR_COLORS[feat.style] ?? VECTOR_COLORS.accent },
        }),
        h('span', { className: 'mv-overlay-feature-name' }, feat.name ?? t('layers.featureUnnamed', { n: feat.featureIndex + 1 })),
        h('span', { className: 'mv-overlay-feature-tag' }, feat.geometryType),
      ),
      onFlyAgentFeature
        ? h(
            'button',
            {
              type: 'button',
              className: 'mv-icon-btn mv-overlay-feature-act',
              title: t('btn.flyTo'),
              'aria-label': t('btn.flyTo'),
              onClick: () => onFlyAgentFeature(row.index, feat.featureIndex),
            },
            h(LayerActionIcon, { kind: 'locate', size: 15 }),
          )
        : null,
      onRemoveAgentFeature
        ? h(
            'button',
            {
              type: 'button',
              className: 'mv-icon-btn mv-overlay-feature-act',
              title: t('btn.delete'),
              'aria-label': t('btn.delete'),
              onClick: () => onRemoveAgentFeature(row.index, feat.featureIndex),
            },
            h(LayerActionIcon, { kind: 'delete', size: 15 }),
          )
        : null,
    )

  const importRow = (row) => {
    const features = Array.isArray(overlayDetails?.[row.index]) ? overlayDetails[row.index] : []
    const count = featureCount(row)
    const isOpen = Boolean(expanded[`import-${row.id}`])
    const color = VECTOR_COLORS[features[0]?.style] ?? VECTOR_COLORS.accent
    const rowId = `import-${row.id}`
    return h(
      'div',
      { key: row.id, className: 'mv-lgroup-item' },
      h(LayerRow, {
      t,
      id: rowId,
      name: row.label,
      meta: count > 0 ? `${count} ${t('layers.propsFeaturesUnit')}` : row.detail,
      off: row.hidden === true,
      lead: h(
        React.Fragment,
        null,
        h(RowEye, {
          t,
          visible: row.hidden !== true,
          onToggle: () => onToggleOverlayVisible?.(row.kind, row.index, row.hidden === true),
        }),
        features.length > 0
          ? h(
              'button',
              {
                type: 'button',
                className: 'mv-icon-btn mv-overlay-toggle',
                title: isOpen ? t('layers.overlayCollapseFeatures') : t('layers.overlayExpandFeatures'),
                'aria-label': isOpen ? t('layers.overlayCollapseFeatures') : t('layers.overlayExpandFeatures'),
                'aria-expanded': isOpen,
                onClick: () => setExpanded((prev) => ({ ...prev, [rowId]: !prev[rowId] })),
              },
              isOpen ? '▾' : '▸',
            )
          : null,
        h(RowDot, { color }),
      ),
      trail: onFlyAgentOverlay
        ? h(
            'button',
            {
              type: 'button',
              className: 'mv-icon-btn mv-row-fly',
              title: t('btn.flyTo'),
              'aria-label': t('btn.flyTo'),
              onClick: () => onFlyAgentOverlay?.(row.kind, row.index),
            },
            h(LayerActionIcon, { kind: 'locate', size: 15 }),
          )
        : null,
      menu: [
        { key: 'fly', label: t('btn.flyTo'), onClick: () => onFlyAgentOverlay?.(row.kind, row.index) },
        { key: 'props', label: t('layers.properties'), onClick: () => onOpenLayerProperties?.({ kind: 'vector', index: row.index }) },
        onExportOverlay ? { key: 'export', label: t('layers.exportVector'), onClick: () => onExportOverlay(row.index) } : null,
        onSendOverlay
          ? {
              key: 'send',
              label: t('layers.vectorToChat'),
              disabled: canSend === false,
              onClick: () => onSendOverlay(row.index),
            }
          : null,
        { key: 'sep', sep: true },
        { key: 'remove', label: t('layers.vectorRemove'), danger: true, onClick: () => onRemoveAgentOverlay?.(row.kind, row.index) },
      ].filter(Boolean),
      menuOpen: rowMenu.openId === rowId,
      onMenuToggle: rowMenu.setOpenId,
      onNameClick: () => onFlyAgentOverlay?.(row.kind, row.index),
      onNameDoubleClick: () => onOpenLayerProperties?.({ kind: 'vector', index: row.index }),
      }),
      features.length > 0 && isOpen
        ? h(
            'div',
            { className: 'mv-overlay-features' },
            ...features.map((feat) => featureRow(row, feat)),
          )
        : null,
    )
  }

  const overlayRow = (overlay, index) => {
    const percent = Math.round((overlay.opacity ?? 1) * 100)
    const swipeOn = swipeState?.kind === 'raster' && swipeState?.id === overlay.id
    const kid = `raster-${overlay.id}`
    return h(
      'div',
      { key: overlay.id, className: 'mv-lgroup-item' },
      h(LayerRow, {
        t,
        id: kid,
        name: overlay.name,
        meta: `${OVERLAY_KIND_LABEL[overlay.type] ?? String(overlay.type).toUpperCase()} · ${percent}%${
          hasRasterTimeline(overlay) ? ` · ${t('rasterTime.badge')}` : ''
        }`,
        title: overlay.url,
        off: overlay.visible === false,
        lead: h(RowEye, {
          t,
          visible: overlay.visible !== false,
          onToggle: () => onOverlayVisible?.(overlay.id, overlay.visible === false),
        }),
        trail: h(
          React.Fragment,
          null,
          h(
            'button',
            {
              type: 'button',
              className: 'mv-icon-btn mv-row-order',
              title: t('layers.overlayUp'),
              'aria-label': t('layers.overlayUp'),
              disabled: index === 0,
              onClick: index === 0 ? undefined : () => onOverlayMove?.(overlay.id, -1),
            },
            h(LayerActionIcon, { kind: 'up', size: 14 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mv-icon-btn mv-row-order',
              title: t('layers.overlayDown'),
              'aria-label': t('layers.overlayDown'),
              disabled: index === overlays.length - 1,
              onClick:
                index === overlays.length - 1 ? undefined : () => onOverlayMove?.(overlay.id, 1),
            },
            h(LayerActionIcon, { kind: 'down', size: 14 }),
          ),
        ),
        menu: [
          { key: 'props', label: t('layers.properties'), onClick: () => onOpenLayerProperties?.({ kind: 'raster', id: overlay.id }) },
          { key: 'up', label: t('layers.overlayUp'), disabled: index === 0, onClick: () => onOverlayMove?.(overlay.id, -1) },
          { key: 'down', label: t('layers.overlayDown'), disabled: index === overlays.length - 1, onClick: () => onOverlayMove?.(overlay.id, 1) },
          onOverlaySwipe
            ? {
                key: 'swipe',
                label: t('swipe.toggle'),
                disabled: overlay.visible === false,
                checked: swipeOn,
                onClick: () => onOverlaySwipe(overlay.id),
              }
            : null,
          { key: 'sep', sep: true },
          { key: 'remove', label: t('layers.overlayRemove'), danger: true, onClick: () => onOverlayRemove?.(overlay.id) },
        ].filter(Boolean),
        menuOpen: rowMenu.openId === kid,
        onMenuToggle: rowMenu.setOpenId,
      }),
      hasRasterTimeline(overlay)
        ? h(RasterTimeline, {
            t,
            source: overlay,
            frameIndex: rasterFrames?.[overlay.id] ?? 0,
            disabled: overlay.visible === false,
            onSelectFrame: onSelectRasterFrame,
          })
        : null,
    )
  }

  return h(
    'div',
    { key: 'list-surface', className: 'mv-layer-list', ref: rowMenu.ref },
    h(
      LayerGroup,
      {
        t,
        id: 'vector',
        title: t('layers.vector'),
        count: groupCount(imports),
        open: openVector,
        onToggle: toggleVector,
        actions: h(
          React.Fragment,
          null,
          onAddLayer ? action('import', t('layers.importVector'), () => onAddLayer('vector')) : null,
          vectorExport
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mv-icon-btn',
                  title: t('layers.vectorExportHint'),
                  'aria-label': t('layers.exportAllOverlays'),
                  disabled: !vectorExport,
                  onClick: () => vectorExport?.download(),
                },
                '↓',
              )
            : null,
          clearButton(t('layers.clearImports'), imports.length, onClearImports),
        ),
        empty: t('layers.emptyVector'),
      },
      imports.length > 0 ? imports.map(importRow) : null,
    ),
    h(
      LayerGroup,
      {
        t,
        id: 'raster',
        title: t('layers.raster'),
        count: groupCount(overlays),
        open: openRaster,
        onToggle: toggleRaster,
        actions: onAddLayer ? action('add', t('layers.addLayer'), () => onAddLayer('raster')) : null,
        empty: t('layers.emptyRaster'),
      },
      overlays.length > 0 ? overlays.map(overlayRow) : null,
    ),
    h(
      LayerGroup,
      {
        t,
        id: 'imagery',
        title: t('layers.imagery'),
        count: groupCount(imagerySources),
        open: openImagery,
        onToggle: toggleImagery,
        hint: openImagery ? null : `${t('layers.imageryCurrent')} ${imagerySummary}`,
      },
      h(
        React.Fragment,
        null,
        radioRow('i-off', t('menu.none'), settings?.imagery == null, () => onSelectImagery(null)),
        imagerySources.map((source) =>
          radioRow(`i-${source.id}`, source.name, settings?.imagery === source.id, () => onSelectImagery(source.id)),
        ),
        h('p', { className: 'mv-none mv-imagery-hint' }, t('layers.imageryCoverageHint')),
      ),
    ),
    // The active multi-period basemap keeps its timeline outside the fold: frame
    // switching is the reason the layer exists, not a detail of its group.
    activeImagerySource && hasRasterTimeline(activeImagerySource)
      ? h(RasterTimeline, {
          t,
          source: activeImagerySource,
          frameIndex: rasterFrames?.[activeImagerySource.id] ?? 0,
          onSelectFrame: onSelectRasterFrame,
        })
      : null,
    h(
      LayerGroup,
      {
        t,
        id: 'terrain',
        title: t('layers.terrain'),
        open: openTerrain,
        onToggle: toggleTerrain,
        hint: openTerrain ? null : `${t('layers.terrainCurrent')} ${terrainSummary}`,
      },
      h(
        React.Fragment,
        null,
        radioRow('t-off', t('menu.terrainOff'), terrainActive === null, () => onSelectTerrain(null)),
        terrainSources.map((source) =>
          radioRow(`t-${source.id}`, source.name, settings?.terrain === source.id, () => onSelectTerrain(source.id)),
        ),
      ),
    ),
    terrainError
      ? h(
          'div',
          { className: 'mv-none mv-terrain-error' },
          h('span', null, terrainError),
          h(
            'button',
            { type: 'button', className: 'mv-icon-btn', title: t('terrain.retry'), 'aria-label': t('terrain.retry'), onClick: onRetryTerrain },
            '↻',
          ),
        )
      : null,
  )
}
