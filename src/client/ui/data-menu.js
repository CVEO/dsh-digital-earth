/**
 * ui/data-menu.js — items of the toolbar "数据 ▾" menu.
 *
 * v1.8: the menu is the single funnel for bringing data in (AddLayerDialog) plus
 * the recent lists, and it groups its rows as 添加 / 最近 / 管理 instead of one
 * flat list of seven actions. Icons make the three import routes distinguishable
 * at a glance; the Agent cleanup stays last and in the danger tone because it is
 * the only destructive item here.
 */
import { GlyphIcon } from './icons.js'
import { MENU_SEP } from './menu-item.js'
import { recentUrlLabel } from './recent-urls.js'

export function dataMenuItems({
  h,
  MenuItem,
  t,
  recentDirs,
  recentUrls,
  agentOverlayCount,
  closeMenu,
  onAddLayer,
  onImportVector,
  onImportGeotiff,
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
  const icon = (name) => h(GlyphIcon, { name })
  const items = []
  if (typeof onAddLayer === 'function') {
    items.push(h('span', { key: 'add-label', className: 'mv-menu-section' }, t('menu.addGroup')))
    items.push(h(MenuItem, { key: 'add', icon: icon('add'), onClick: run(() => onAddLayer(null)) }, t('menu.addLayer')))
  }
  if (typeof onImportGeotiff === 'function') {
    items.push(
      h(MenuItem, { key: 'geotiff', icon: icon('raster'), onClick: run(() => onImportGeotiff()) }, t('menu.importGeotiff')),
    )
  }
  if (typeof onImportVector === 'function') {
    items.push(
      h(MenuItem, { key: 'import', icon: icon('import'), onClick: run(() => onImportVector()) }, t('menu.import')),
    )
  }
  items.push(h(MenuItem, { key: 'local', icon: icon('folder'), onClick: run(onOpenLocal) }, t('btn.openLocal')))
  items.push(h(MenuItem, { key: 'url', icon: icon('link'), onClick: run(onToggleUrlBar) }, t('menu.loadAddress')))
  const recent = []
  if (Array.isArray(recentUrls) && recentUrls.length > 0) {
    for (const entry of recentUrls) {
      recent.push(
        h(
          MenuItem,
          { key: `url:${entry.url}`, title: entry.url, icon: icon('history'), onClick: run(() => onOpenRecentUrl(entry.url)) },
          h('span', { className: 'ellipsis' }, recentUrlLabel(entry.url)),
        ),
      )
    }
  }
  if (Array.isArray(recentDirs) && recentDirs.length > 0) {
    for (const entry of recentDirs) {
      recent.push(
        h(
          MenuItem,
          { key: `dir:${entry.dir}`, title: entry.dir, icon: icon('history'), onClick: run(() => onOpenRecentDirectory(entry.dir)) },
          h('span', { className: 'ellipsis' }, entry.name),
        ),
      )
    }
  }
  if (recent.length > 0) {
    items.push(h('span', { key: 'recent-label', className: 'mv-menu-section' }, t('menu.recent')))
    items.push(...recent)
  }
  // Kept visible but disabled when there is nothing to clear: a hidden item is
  // undiscoverable and makes the menu jump as overlays appear.
  items.push(h('i', { key: 'sep', className: 'mv-sep', style: MENU_SEP }))
  items.push(h('span', { key: 'manage-label', className: 'mv-menu-section' }, t('menu.manage')))
  // Scoped to agent-created overlays only: the label matches what it deletes.
  items.push(
    h(
      MenuItem,
      { key: 'clearAgent', danger: true, disabled: !(agentOverlayCount > 0), onClick: run(onClearAgent) },
      t('menu.clearAgent'),
    ),
  )
  return items
}
