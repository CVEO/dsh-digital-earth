/**
 * ui/tools-bookmarks.js — camera bookmarks + tour launcher (a tool, not a layer).
 *
 * Client-only: stored in localStorage, no Agent contract involved. Extracted from
 * the old layer panel during the IA split so the tools card can own it.
 */
import React from 'react'

import { addBookmark, loadBookmarks, removeBookmark, saveBookmarks, updateBookmarkCaption } from '../scene/bookmarks.js'

const h = React.createElement

export function ToolsBookmarks({ t, getCurrentView, onFlyView, onStartTour }) {
  const [bookmarks, setBookmarks] = React.useState(() => loadBookmarks())
  const [notice, setNotice] = React.useState('')

  const saveCurrent = () => {
    const view = typeof getCurrentView === 'function' ? getCurrentView() : null
    if (!view) {
      setNotice(t('bookmarks.noView'))
      return
    }
    const result = addBookmark(bookmarks, view, null)
    if (!result.bookmark) return
    setBookmarks(result.list)
    setNotice(saveBookmarks(result.list) ? '' : t('bookmarks.saveFailed'))
  }
  const remove = (id) => {
    const next = removeBookmark(bookmarks, id)
    setBookmarks(next)
    saveBookmarks(next)
  }
  // Tour stop text is edited inline; every edit also updates the list the story
  // bar plays, so no separate save action is needed.
  const setCaption = (id, value) => {
    const next = updateBookmarkCaption(bookmarks, id, value)
    setBookmarks(next)
    saveBookmarks(next)
  }

  return h(
    React.Fragment,
    null,
    h(
      'div',
      { className: 'mv-group-actions' },
      h('button', { type: 'button', className: 'mv-cta', onClick: saveCurrent }, t('bookmarks.save')),
      h(
        'button',
        {
          type: 'button',
          className: 'mv-cta',
          disabled: bookmarks.length < 2,
          title: bookmarks.length < 2 ? t('tour.needStops') : t('tour.start'),
          onClick: () => {
            if (typeof onStartTour === 'function') onStartTour(bookmarks)
          },
        },
        t('tour.start'),
      ),
    ),
    notice !== '' ? h('div', { className: 'mv-none' }, notice) : null,
    bookmarks.length === 0
      ? h('div', { className: 'mv-none' }, t('bookmarks.empty'))
      : bookmarks.map((item) =>
          h(
            'div',
            { key: item.id, className: 'mv-bookmark' },
            h(
              'div',
              { className: 'mv-layer' },
              h('button', { type: 'button', className: 'name mv-bookmark-name', title: t('bookmarks.flyHint'), onClick: () => onFlyView(item.view) }, item.name),
              h('button', { type: 'button', className: 'mv-icon-btn', title: t('bookmarks.remove'), 'aria-label': t('bookmarks.remove'), onClick: () => remove(item.id) }, '✕'),
            ),
            h('input', {
              className: 'mv-caption',
              value: item.caption ?? '',
              placeholder: t('bookmarks.captionPlaceholder'),
              title: t('bookmarks.captionPlaceholder'),
              'aria-label': t('bookmarks.captionPlaceholder'),
              maxLength: 120,
              onChange: (event) => setCaption(item.id, event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              },
            }),
          ),
        ),
  )
}
