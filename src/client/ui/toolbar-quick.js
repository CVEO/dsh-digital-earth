/**
 * ui/toolbar-quick.js — the three domain tabs of the right rail.
 *
 * Panel System 2.0: the toolbar is 添加数据 ▾ / 图层 / 工具 / 结果 / 输出 ▾ / ⚙.
 * These entries map one-to-one onto rail destinations; a second click on the
 * active destination collapses the rail (the rule lives in `panel-state.js`).
 * 分析 / 视图 buttons are gone: analysis runs from the tool master list and
 * view actions live in the tool list / output menu.
 */
import React from 'react'

import { ToolEntryIcon, ToolsIcon, LayersIcon } from './icons.js'

const h = React.createElement

export function ToolbarQuick({ t, showLayers, showTools, showResult, onToggleLayers, onToggleTools, onOpenResult }) {
  const entry = (key, icon, label, onClick, active, title = label) =>
    h(
      'button',
      {
        key,
        type: 'button',
        className: `mv-btn${active ? ' on' : ''}`,
        title,
        'aria-label': label,
        'aria-pressed': Boolean(active),
        onClick,
      },
      h('span', { className: 'mv-btn-icon', 'aria-hidden': true }, icon),
      h('span', { className: 'mv-btn-label' }, label),
    )
  return h(
    React.Fragment,
    null,
    entry('layers', h(LayersIcon), t('btn.layers'), onToggleLayers, showLayers, showLayers ? t('btn.layersHide') : t('btn.layersShow')),
    entry('tools', h(ToolsIcon), t('btn.tools'), onToggleTools, showTools, showTools ? t('btn.toolsHide') : t('btn.toolsShow')),
    entry('result', h(ToolEntryIcon, { kind: 'analysis' }), t('panel.tab.result'), onOpenResult, showResult),
  )
}
