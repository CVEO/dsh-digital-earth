/**
 * ui/toolbar-output.js — items of the toolbar "画面与输出" menu.
 *
 * The audit (docs/audit-2026-11-23, batch B1) collapsed the toolbar from 13
 * buttons to 7 entries. Output actions (snapshot, report, HUD, reset view,
 * fullscreen, ask-Agent, open beside chat) are infrequent and none of them is a
 * domain entry, so they live in one dropdown instead of six icon buttons.
 *
 * Pure props-in/items-out: the menu state stays in ViewerSurface.
 */
const MENU_SEP = { width: 'auto', height: '.5px', margin: '4px 8px' }

export function outputMenuItems({
  h,
  MenuItem,
  t,
  showHud = false,
  fullscreen = false,
  sessionId = null,
  docked = false,
  closeMenu,
  onScreenshot,
  onReport,
  onToggleHud,
  onResetView,
  onToggleFullscreen,
  onAskAgent,
  onOpenBeside,
}) {
  const run = (action) => () => {
    if (typeof closeMenu === 'function') closeMenu()
    action()
  }
  const items = [
    h(MenuItem, { key: 'screenshot', onClick: run(onScreenshot) }, t('btn.screenshot')),
    h(MenuItem, { key: 'report', onClick: run(onReport) }, t('menu.report')),
    h('i', { key: 'sep1', className: 'mv-sep', style: MENU_SEP }),
    h(
      MenuItem,
      { key: 'hud', onClick: run(onToggleHud) },
      showHud ? t('btn.hudHide') : t('btn.hudShow'),
    ),
    h(MenuItem, { key: 'reset', onClick: run(onResetView) }, t('btn.reset')),
    h(
      MenuItem,
      { key: 'fullscreen', onClick: run(onToggleFullscreen) },
      fullscreen ? t('btn.fullscreenExit') : t('btn.fullscreenTitle'),
    ),
  ]
  if (sessionId) {
    items.push(h('i', { key: 'sep2', className: 'mv-sep', style: MENU_SEP }))
    items.push(h(MenuItem, { key: 'ask', onClick: run(onAskAgent) }, t('btn.askAgent')))
  }
  // The docked tab is already beside the conversation, so only the main panel
  // offers "open beside chat".
  if (!docked && typeof onOpenBeside === 'function') {
    items.push(h(MenuItem, { key: 'beside', onClick: run(onOpenBeside) }, t('btn.beside')))
  }
  return items
}
