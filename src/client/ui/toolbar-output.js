/**
 * ui/toolbar-output.js — items of the toolbar "输出 ▾" menu.
 *
 * v1.8 split: 输出 is about taking something OUT of the scene — a snapshot, a
 * scene report, the vector layers as GeoJSON, or a hand-off to the conversation.
 * Camera and on-screen aids moved to 视图 ▾ (ui/toolbar-view.js), so neither menu
 * mixes "how I look" with "what I take away".
 */
import { GlyphIcon } from './icons.js'
import { MENU_SEP } from './menu-item.js'

export function outputMenuItems({
  h,
  MenuItem,
  t,
  sessionId = null,
  docked = false,
  canExportVector = false,
  closeMenu,
  onScreenshot,
  onReport,
  onExportVector,
  onAskAgent,
  onOpenBeside,
}) {
  const run = (action) => () => {
    if (typeof closeMenu === 'function') closeMenu()
    action()
  }
  const icon = (name) => h(GlyphIcon, { name })
  const items = [
    h(MenuItem, { key: 'screenshot', icon: icon('output'), onClick: run(onScreenshot) }, t('btn.screenshot')),
    h(MenuItem, { key: 'report', icon: icon('export'), onClick: run(onReport) }, t('menu.report')),
    h(
      MenuItem,
      {
        key: 'vector',
        icon: icon('export'),
        disabled: !canExportVector,
        title: canExportVector ? t('layers.vectorExportHint') : t('out.exportEmpty'),
        onClick: run(onExportVector),
      },
      t('out.exportVector'),
    ),
  ]
  if (sessionId || typeof onOpenBeside === 'function') {
    items.push(h('i', { key: 'sep2', className: 'mv-sep', style: MENU_SEP }))
  }
  if (sessionId) {
    items.push(h(MenuItem, { key: 'ask', icon: icon('chat'), onClick: run(onAskAgent) }, t('btn.askAgent')))
  }
  // The docked tab is already beside the conversation, so only the main panel
  // offers "open beside chat".
  if (!docked && typeof onOpenBeside === 'function') {
    items.push(h(MenuItem, { key: 'beside', icon: icon('chat'), onClick: run(onOpenBeside) }, t('btn.beside')))
  }
  return items
}
