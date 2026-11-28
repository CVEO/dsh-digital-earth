/**
 * ui/toolbar-view.js — items of the toolbar "视图 ▾" menu.
 *
 * v1.8 split: "画面与输出" mixed two domains. Camera and on-screen aids (reset,
 * HUD, fullscreen, bookmarks, scene details) are how you LOOK at the scene, so
 * they belong to the view domain; screenshots, reports and sharing are what you
 * TAKE OUT of it and stay in 输出 ▾.
 */
import { GlyphIcon } from './icons.js'
import { MENU_SEP } from './menu-item.js'

export function viewMenuItems({
  h,
  MenuItem,
  t,
  showHud = false,
  fullscreen = false,
  closeMenu,
  onResetView,
  onToggleHud,
  onToggleFullscreen,
  onOpenBookmarks,
  onShowSceneDetails,
  onToggleChrome,
}) {
  const run = (action) => () => {
    if (typeof closeMenu === 'function') closeMenu()
    action()
  }
  const icon = (name) => h(GlyphIcon, { name })
  const items = [
    h(MenuItem, { key: 'reset', icon: icon('view'), onClick: run(onResetView) }, t('btn.reset')),
    h(
      MenuItem,
      { key: 'hud', icon: h(GlyphIcon, { name: 'props' }), checked: showHud, onClick: run(onToggleHud) },
      t('btn.hud'),
    ),
    h(
      MenuItem,
      { key: 'fullscreen', icon: h(GlyphIcon, { name: 'scene' }), checked: fullscreen, onClick: run(onToggleFullscreen) },
      fullscreen ? t('btn.fullscreenExit') : t('btn.fullscreenTitle'),
    ),
  ]
  if (typeof onOpenBookmarks === 'function' || typeof onShowSceneDetails === 'function') {
    items.push(h('i', { key: 'sep', className: 'mv-sep', style: MENU_SEP }))
  }
  if (typeof onOpenBookmarks === 'function') {
    items.push(h(MenuItem, { key: 'bookmarks', icon: icon('history'), onClick: run(onOpenBookmarks) }, t('menu.bookmarks')))
  }
  if (typeof onShowSceneDetails === 'function') {
    items.push(
      h(MenuItem, { key: 'details', icon: icon('output'), onClick: run(onShowSceneDetails) }, t('sceneDetails.title')),
    )
  }
  if (typeof onToggleChrome === 'function') {
    items.push(h('i', { key: 'chrome-sep', className: 'mv-sep', style: MENU_SEP }))
    items.push(
      h(
        MenuItem,
        { key: 'hideChrome', icon: icon('hide'), hint: 'H', onClick: run(onToggleChrome) },
        t('dock.hideChrome'),
      ),
    )
  }
  return items
}
