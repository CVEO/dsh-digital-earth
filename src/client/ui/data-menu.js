/**
 * ui/data-menu.js — items of the toolbar "数据 ▾" menu.
 *
 * Batch B1 (数据菜单瘦身): data is the only domain of this menu, so it now lists
 * only ways to bring data in (local folder, recents, address) plus the scoped
 * "clear what the Agent drew here". Scene report moved to 画面与输出, and clearing
 * measurements moved to the Measure window, where the measurement state lives.
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
}) {
  const run = (action) => () => {
    if (typeof closeMenu === 'function') closeMenu()
    action()
  }
  const items = [
    h(MenuItem, { key: 'local', onClick: run(onOpenLocal) }, t('btn.openLocal')),
    h(MenuItem, { key: 'url', onClick: run(onToggleUrlBar) }, t('btn.openUrl')),
  ]
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
  if (agentOverlayCount > 0) {
    items.push(h('i', { key: 'sep', className: 'mv-sep', style: MENU_SEP }))
    // Scoped to agent-created overlays only: the label matches what it deletes.
    items.push(h(MenuItem, { key: 'clearAgent', onClick: run(onClearAgent) }, t('menu.clearAgent')))
  }
  return items
}
