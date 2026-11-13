/**
 * ui/data-menu.js — items of the toolbar "Data" menu.
 *
 * Extracted from ViewerSurface: that file is at its size budget, and the recent
 * online-address list (ui/recent-urls.js) joins the existing recent-folder list
 * here. Every action closes the menu first, exactly like the inline block did.
 */
import { recentUrlLabel } from './recent-urls.js'

const MENU_SEP = { width: 'auto', height: '.5px', margin: '4px 8px' }

export function dataMenuItems({
  h,
  MenuItem,
  t,
  recentDirs,
  recentUrls,
  agentOverlayCount,
  closeMenu,
  onOpenLocal,
  onOpenRecentDirectory,
  onOpenRecentUrl,
  onClearAgent,
  onToggleUrlBar,
  onReport,
  onClearTools,
}) {
  const run = (action) => () => {
    if (typeof closeMenu === 'function') closeMenu()
    action()
  }
  const items = [h(MenuItem, { key: 'local', onClick: run(onOpenLocal) }, t('btn.openLocal'))]
  if (Array.isArray(recentDirs) && recentDirs.length > 0) {
    items.push(h('span', { key: 'recent-dirs-label', className: 'mv-menu-label' }, t('menu.recentDirs')))
    for (const entry of recentDirs) {
      items.push(
        h(
          MenuItem,
          { key: `dir:${entry.dir}`, title: entry.dir, onClick: run(() => onOpenRecentDirectory(entry.dir)) },
          h('span', { className: 'ellipsis' }, entry.name),
        ),
      )
    }
  }
  if (Array.isArray(recentUrls) && recentUrls.length > 0) {
    items.push(h('span', { key: 'recent-urls-label', className: 'mv-menu-label' }, t('menu.recentUrls')))
    for (const entry of recentUrls) {
      items.push(
        h(
          MenuItem,
          { key: `url:${entry.url}`, title: entry.url, onClick: run(() => onOpenRecentUrl(entry.url)) },
          h('span', { className: 'ellipsis' }, recentUrlLabel(entry.url)),
        ),
      )
    }
  }
  if (agentOverlayCount > 0) {
    items.push(h(MenuItem, { key: 'clearAgent', onClick: run(onClearAgent) }, t('menu.clearAgent')))
  }
  items.push(h(MenuItem, { key: 'url', onClick: run(onToggleUrlBar) }, t('btn.openUrl')))
  items.push(h(MenuItem, { key: 'report', onClick: run(onReport) }, t('menu.report')))
  items.push(h('i', { key: 'sep', className: 'mv-sep', style: MENU_SEP }))
  items.push(h(MenuItem, { key: 'clear', onClick: run(onClearTools) }, t('tool.clear')))
  return items
}
