/**
 * ui/layers-entities.js — the "三维" tab of the scene card.
 *
 * What belongs here is anything that stands up in space:
 *   - 标注      point / line / area / label drawn by the user or the Agent,
 *               plus imported files? no — imports are 2D layers (surface tab);
 *   - 量测      distance / area / height results (read-only, numeric);
 *   - 三维内容  3D Tiles / 3DGS content layers.
 *
 * Terrain, imagery, raster and vector layers live in ui/layers-surface.js: the
 * split is "体 vs 面", not "3D view vs map view" (the panel only ever shows one
 * globe). Groups share the LayerGroup header and the LayerRow shell so the two
 * tabs stay visually identical.
 */
import React from 'react'

import { LayerRow, RowDot, RowEye } from './layer-row.js'
import { GlyphIcon, LayerActionIcon } from './icons.js'
import { useRowMenu } from './use-row-menu.js'
import { LayerGroup, groupCount, useGroupOpen } from './layer-group.js'
import { shaderEntrySummary } from './workbench-wiring.js'
import { VECTOR_COLORS } from '../scene/vector-style.js'

const h = React.createElement

/** `{ id, kind, index, label, detail }` rows split into the three 3D groups. */
export function splitEntityRows(agentOverlays) {
  const rows = Array.isArray(agentOverlays) ? agentOverlays : []
  return {
    annotations: rows.filter((row) => row.kind === 'draw' && row.origin !== 'import'),
    measurements: rows.filter((row) => row.kind === 'measure'),
    imports: rows.filter((row) => row.kind === 'draw' && row.origin === 'import'),
  }
}

export function LayersEntities({
  t,
  layers,
  shaderActive,
  agentOverlays,
  overlayDetails,
  overlayExtrusions,
  onFlyLayer,
  onFrameAll,
  onToggleLayer,
  onRemoveLayer,
  onEditLayerShader,
  onOpenLayerProperties,
  swipeState,
  onSwipeLayer,
  onAddLayer,
  onQuickAnnotate,
  onOpenMeasure,
  onFlyAgentOverlay,
  onRemoveAgentOverlay,
  onToggleOverlayExtrude,
  onSelectAgentFeature,
  onExportOverlay,
  onSendOverlay,
  onFlyAgentFeature,
  onRemoveAgentFeature,
  canSend,
  onClearAnnotations,
  onClearMeasurements,
  onToggleOverlayVisible,
}) {
  const rowMenu = useRowMenu()
  const [expanded, setExpanded] = React.useState({})
  const [openAnnotations, toggleAnnotations] = useGroupOpen('annotations')
  const [openMeasurements, toggleMeasurements] = useGroupOpen('measurements')
  const [openContent, toggleContent] = useGroupOpen('content')
  const { annotations, measurements } = splitEntityRows(agentOverlays)
  const shaderFor = (layer) =>
    (shaderActive ?? []).find(
      (entry) => entry.layerId === layer.id || (entry.layerId === undefined && entry.layer === layer.name),
    ) ?? null
  const featureList = (row) =>
    row.kind === 'draw' && Array.isArray(overlayDetails?.[row.index]) ? overlayDetails[row.index] : []
  const dotColor = (row) => {
    const first = featureList(row)[0]
    return VECTOR_COLORS[first?.style] ?? VECTOR_COLORS.accent
  }
  const rowId = (row) => `entity-${row.id}`
  // Row meta stays short: the preset name, never the layer name again.
  const shaderPresetLabel = (shader) => {
    const presets = Array.isArray(shader?.preset) ? shader.preset : shader?.preset ? [shader.preset] : []
    return presets.map((preset) => t(`shader.preset.${preset}`)).join(' + ')
  }
  const flyButton = (row) =>
    onFlyAgentOverlay
      ? h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn mv-row-fly',
            title: t('btn.flyTo'),
            'aria-label': t('btn.flyTo'),
            onClick: () => onFlyAgentOverlay(row.kind, row.index),
          },
          h(LayerActionIcon, { kind: 'locate', size: 15 }),
        )
      : null
  const rowEye = (row) =>
    onToggleOverlayVisible
      ? h(RowEye, {
          t,
          visible: row.hidden !== true,
          onToggle: () => onToggleOverlayVisible(row.kind, row.index, row.hidden === true),
        })
      : null

  const clearButton = (label, count, disabled, onClick) =>
    h(
      'button',
      {
        type: 'button',
        className: 'mv-icon-btn',
        title: `${label}${count > 0 ? ` · ${count}` : ''}`,
        'aria-label': label,
        disabled,
        onClick: disabled ? undefined : onClick,
      },
      h(LayerActionIcon, { kind: 'delete', size: 15 }),
    )

  // Group actions are icon-only so a category header reads as a title with
  // tools, not as a row of competing text buttons. Tooltip + aria keep names.
  const action = (icon, label, onClick, disabled = false) =>
    h(
      'button',
      { type: 'button', className: 'mv-icon-btn', title: label, 'aria-label': label, disabled, onClick: disabled ? undefined : onClick },
      h(GlyphIcon, { name: icon, size: 15 }),
    )

  const annotationRow = (row) => {
    const features = featureList(row)
    const hasFeatures = features.length > 0
    const canExtrude = overlayExtrusions?.[row.index]?.canExtrude === true
    const isOpen = Boolean(expanded[row.id])
    const is3d = Boolean(overlayExtrusions?.[row.index]?.extruded)
    const menu = [
      { key: 'fly', label: t('btn.flyTo'), onClick: () => onFlyAgentOverlay?.(row.kind, row.index) },
      { key: 'props', label: t('layers.properties'), onClick: () => onOpenLayerProperties?.({ kind: 'vector', index: row.index }) },
      features.length > 0
        ? {
            key: 'edit',
            label: t('layers.propsEditFeatures'),
            onClick: () => onSelectAgentFeature?.(row.index, features[0]?.featureIndex ?? 0),
          }
        : null,
      onExportOverlay
        ? { key: 'export', label: t('layers.exportVector'), onClick: () => onExportOverlay(row.index) }
        : null,
      onSendOverlay
        ? {
            key: 'send',
            label: t('layers.vectorToChat'),
            disabled: canSend === false,
            onClick: () => onSendOverlay(row.index),
          }
        : null,
      onToggleOverlayVisible
        ? {
            key: 'visible',
            label: t('btn.visible'),
            checked: row.hidden !== true,
            onClick: () => onToggleOverlayVisible(row.kind, row.index, row.hidden === true),
          }
        : null,
      { key: 'sep', sep: true },
      { key: 'remove', label: t('layers.removeFromScene'), danger: true, onClick: () => onRemoveAgentOverlay?.(row.kind, row.index) },
    ].filter(Boolean)
    return h(
      'div',
      { key: row.id, className: 'mv-lgroup-item' },
      h(LayerRow, {
        t,
        id: rowId(row),
        name: row.label,
        meta: row.detail,
        off: row.hidden === true,
        lead: h(
          React.Fragment,
          null,
          rowEye(row),
          hasFeatures
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mv-icon-btn mv-overlay-toggle',
                  title: isOpen ? t('layers.overlayCollapseFeatures') : t('layers.overlayExpandFeatures'),
                  'aria-label': isOpen ? t('layers.overlayCollapseFeatures') : t('layers.overlayExpandFeatures'),
                  'aria-expanded': isOpen,
                  onClick: () => setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] })),
                },
                isOpen ? '▾' : '▸',
              )
            : null,
          h(RowDot, { color: dotColor(row) }),
        ),
        trail: h(
          React.Fragment,
          null,
          canExtrude
            ? h(
                'button',
                {
                  type: 'button',
                  className: `mv-icon-btn mv-layer-dim-btn${is3d ? ' on' : ''}`,
                  'aria-pressed': is3d,
                  title: is3d ? t('layers.switch2d') : t('layers.switch3d'),
                  'aria-label': is3d ? t('layers.switch2d') : t('layers.switch3d'),
                  onClick: () => onToggleOverlayExtrude?.(row.index),
                },
                is3d ? '3D' : '2D',
              )
            : null,
          flyButton(row),
        ),
        menu,
        menuOpen: rowMenu.openId === rowId(row),
        onMenuToggle: rowMenu.setOpenId,
        onNameClick: () => onFlyAgentOverlay?.(row.kind, row.index),
      }),
      features.length > 0 && isOpen
        ? h(
            'div',
            { className: 'mv-overlay-features' },
            ...features.map((feat) =>
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
                  feat.heightM != null
                    ? h(
                        'span',
                        { className: 'mv-overlay-feature-meta' },
                        `≈${Math.round(feat.heightM)}m${feat.estFloors != null ? `/${t('parse.floors', { n: feat.estFloors })}` : ''}`,
                      )
                    : null,
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
              ),
            ),
          )
        : null,
    )
  }

  const measureRow = (row) =>
    h(LayerRow, {
      key: row.id,
      t,
      id: rowId(row),
      name: row.label,
      meta: row.detail,
      lead: h(
        React.Fragment,
        null,
        rowEye(row),
        h(RowDot, { color: VECTOR_COLORS.accent }),
      ),
      trail: flyButton(row),
      menu: [
        { key: 'fly', label: t('btn.flyTo'), onClick: () => onFlyAgentOverlay?.(row.kind, row.index) },
        { key: 'sep', sep: true },
        { key: 'remove', label: t('layers.removeFromScene'), danger: true, onClick: () => onRemoveAgentOverlay?.(row.kind, row.index) },
      ],
      menuOpen: rowMenu.openId === rowId(row),
      onMenuToggle: rowMenu.setOpenId,
      onNameClick: () => onFlyAgentOverlay?.(row.kind, row.index),
      onNameDoubleClick: () => onOpenLayerProperties?.({ kind: 'vector', index: row.index }),
    })

  const contentRow = (layer) => {
    const shader = shaderFor(layer)
    const is3dgs = layer.kind === '3dgs'
    const summary = shader ? shaderEntrySummary(t, shader) : ''
    const swipeOn =
      ((swipeState?.kind === '3d' || swipeState?.kind === 'split') && swipeState?.id === layer.id) ||
      (swipeState?.kind === 'pair' && (swipeState?.leftId === layer.id || swipeState?.rightId === layer.id))
    return h(LayerRow, {
      key: layer.id,
      t,
      id: `layer-${layer.id}`,
      name: layer.name,
      meta: [is3dgs ? t('layers.kindSplats') : t('layers.kindTiles'), shader ? shaderPresetLabel(shader) : '']
        .filter(Boolean)
        .join(' · '),
      title: summary ? `${layer.name} — ${summary}` : layer.name,
      warn: Boolean(layer.georefIssue),
      warnTitle: t('layers.georefWarning'),
      off: !layer.visible,
      className: shader ? 'has-shader' : '',
      lead: h(RowEye, {
        t,
        visible: layer.visible,
        onToggle: () => onToggleLayer(layer.id),
      }),
      trail: h(
        React.Fragment,
        null,
        h(
        'button',
        {
          type: 'button',
          className: `mv-icon-btn mv-shader-edit${shader ? ' on' : ''}`,
          title: is3dgs ? t('layers.appearance3dgs') : summary ? `${t('shader.editEntry')} · ${summary}` : t('layers.appearance'),
          'aria-label': is3dgs ? t('layers.appearance3dgs') : summary ? t('shader.editEntry') : t('layers.appearance'),
          disabled: is3dgs,
          onClick: () => {
            if (is3dgs) return
            onEditLayerShader(layer, shader)
          },
        },
        h(LayerActionIcon, { kind: 'shader', size: 15 }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mv-icon-btn mv-row-fly',
            title: t('btn.flyTo'),
            'aria-label': t('btn.flyTo'),
            onClick: () => onFlyLayer(layer.id),
          },
          h(LayerActionIcon, { kind: 'locate', size: 15 }),
        ),
      ),
      menu: [
        { key: 'fly', label: t('btn.flyTo'), onClick: () => onFlyLayer(layer.id) },
        { key: 'props', label: t('layers.properties'), onClick: () => onOpenLayerProperties?.({ kind: '3d', id: layer.id }) },
        onSwipeLayer
          ? {
              key: 'swipe',
              label: t('swipe.toggle'),
              hint: t('swipe.toggleHint'),
              disabled: !layer.visible,
              checked: swipeOn,
              onClick: () => onSwipeLayer(layer.id),
            }
          : null,
        { key: 'sep', sep: true },
        { key: 'remove', label: t('layers.removeFromScene'), danger: true, onClick: () => onRemoveLayer(layer.id) },
      ].filter(Boolean),
      menuOpen: rowMenu.openId === `layer-${layer.id}`,
      onMenuToggle: rowMenu.setOpenId,
      onNameClick: () => onFlyLayer(layer.id),
      onNameDoubleClick: () => onOpenLayerProperties?.({ kind: '3d', id: layer.id }),
    })
  }

  return h(
    'div',
    { key: 'list-3d', className: 'mv-layer-list', ref: rowMenu.ref },
    h(
      LayerGroup,
      {
        t,
        id: 'annotations',
        title: t('layers.annotations'),
        count: groupCount(annotations),
        open: openAnnotations,
        onToggle: toggleAnnotations,
        actions: h(
          React.Fragment,
          null,
          onQuickAnnotate ? action('pen', t('annotation.quickDraw'), onQuickAnnotate) : null,
          clearButton(t('layers.clearAnnotations'), annotations.length, annotations.length === 0, onClearAnnotations),
        ),
        empty: t('layers.emptyAnnotations'),
      },
      annotations.length > 0 ? annotations.map(annotationRow) : null,
    ),
    h(
      LayerGroup,
      {
        t,
        id: 'measurements',
        title: t('layers.measurements'),
        count: groupCount(measurements),
        open: openMeasurements,
        onToggle: toggleMeasurements,
        actions: h(
          React.Fragment,
          null,
          onOpenMeasure ? action('ruler', t('btn.measure'), onOpenMeasure) : null,
          clearButton(t('layers.clearMeasurements'), measurements.length, measurements.length === 0, onClearMeasurements),
        ),
        empty: t('layers.emptyMeasurements'),
      },
      measurements.length > 0 ? measurements.map(measureRow) : null,
    ),
    h(
      LayerGroup,
      {
        t,
        id: 'content',
        title: t('layers.content'),
        count: groupCount(layers),
        open: openContent,
        onToggle: toggleContent,
        actions: h(
          React.Fragment,
          null,
          layers.length > 0 ? action('frame', t('layers.frameAll'), onFrameAll) : null,
          action('add', t('layers.addLayer'), () => onAddLayer?.('3d')),
        ),
        empty: t('layers.contentEmpty'),
      },
      layers.length > 0 ? layers.map(contentRow) : null,
    ),
  )
}
