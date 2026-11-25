/**
 * ui/tools-bookmarks.js — camera bookmarks + tour launcher (a tool, not a layer).
 *
 * Client-only: stored in localStorage, no Agent contract involved. Lists stops
 * in chronological playback order (1 -> 2 -> 3) with live WebGL thumbnails,
 * spatial readouts, inline rename, reorder, and one-click view recapture.
 */
import React from 'react'

import {
  addBookmark,
  captureBookmarkThumbnail,
  formatBookmarkMeta,
  loadBookmarks,
  moveBookmark,
  removeBookmark,
  renameBookmark,
  saveBookmarks,
  updateBookmarkCaption,
  updateBookmarkView,
} from '../scene/bookmarks.js'

const h = React.createElement

export function ToolsBookmarks({ t, getCurrentView, getViewer, onFlyView, onStartTour, showToast }) {
  const [bookmarks, setBookmarks] = React.useState(() => loadBookmarks())
  const [notice, setNotice] = React.useState('')
  const [activeId, setActiveId] = React.useState(null)
  const [editingId, setEditingId] = React.useState(null)
  const [draftName, setDraftName] = React.useState('')

  const persist = (next) => {
    setBookmarks(next)
    setNotice(saveBookmarks(next) ? '' : t('bookmarks.saveFailed'))
  }

  const saveCurrent = () => {
    const view = typeof getCurrentView === 'function' ? getCurrentView() : null
    if (!view) {
      setNotice(t('bookmarks.noView'))
      return
    }
    const thumb = captureBookmarkThumbnail(typeof getViewer === 'function' ? getViewer() : null)
    const result = addBookmark(bookmarks, view, null, { thumb })
    if (!result.bookmark) return
    setActiveId(result.bookmark.id)
    setBookmarks(result.list)
    setNotice(saveBookmarks(result.list) ? '' : t('bookmarks.saveFailed'))
  }

  const remove = (id) => {
    const next = removeBookmark(bookmarks, id)
    if (activeId === id) setActiveId(null)
    if (editingId === id) setEditingId(null)
    setBookmarks(next)
    saveBookmarks(next)
  }

  const flyTo = (item) => {
    setActiveId(item.id)
    if (typeof onFlyView === 'function') onFlyView(item.view)
  }

  const startRename = (item) => {
    setEditingId(item.id)
    setDraftName(item.name ?? '')
  }

  const commitRename = (id) => {
    const next = renameBookmark(bookmarks, id, draftName)
    setEditingId(null)
    persist(next)
  }

  const move = (id, delta) => {
    persist(moveBookmark(bookmarks, id, delta))
  }

  const reverseAll = () => {
    if (bookmarks.length < 2) return
    persist([...bookmarks].reverse())
  }

  const recapture = (id) => {
    const view = typeof getCurrentView === 'function' ? getCurrentView() : null
    if (!view) {
      setNotice(t('bookmarks.noView'))
      return
    }
    const thumb = captureBookmarkThumbnail(typeof getViewer === 'function' ? getViewer() : null)
    const next = updateBookmarkView(bookmarks, id, view, { thumb })
    setActiveId(id)
    persist(next)
    showToast?.(t('bookmarks.updated'))
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
          className: `mv-cta${bookmarks.length >= 2 ? ' primary' : ''}`,
          disabled: bookmarks.length < 2,
          title: bookmarks.length < 2 ? t('tour.needStops') : t('tour.start'),
          onClick: () => {
            if (typeof onStartTour === 'function') onStartTour(bookmarks)
          },
        },
        t('tour.start'),
      ),
    ),
    bookmarks.length >= 2
      ? h(
          'div',
          { className: 'mv-bm-bar' },
          h('span', { className: 'mv-bm-bar-text' }, t('bookmarks.tourOrder', { n: bookmarks.length })),
          h(
            'button',
            { type: 'button', className: 'mv-bm-bar-btn', title: t('bookmarks.reverseHint'), onClick: reverseAll },
            t('bookmarks.reverse'),
          ),
        )
      : null,
    notice !== '' ? h('div', { className: 'mv-none' }, notice) : null,
    bookmarks.length === 0
      ? h('div', { className: 'mv-none' }, t('bookmarks.empty'))
      : h(
          'div',
          { className: 'mv-bm-list' },
          ...bookmarks.map((item, index) => {
            const meta = formatBookmarkMeta(item.view)
            const isEditing = editingId === item.id
            const isActive = activeId === item.id
            return h(
              'div',
              { key: item.id, className: `mv-bookmark${isActive ? ' active' : ''}` },
              h(
                'div',
                { className: 'mv-bm-main' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: `mv-bm-thumb${item.thumb ? '' : ' empty'}`,
                    title: t('bookmarks.flyHint'),
                    onClick: () => flyTo(item),
                  },
                  item.thumb
                    ? h('img', { src: item.thumb, alt: item.name })
                    : h(
                        'span',
                        { className: 'mv-bm-thumb-ph' },
                        h('strong', null, meta?.alt ?? '3D'),
                        h('small', null, meta ? `${meta.compass}` : ''),
                      ),
                  h('span', { className: 'mv-bm-index' }, String(index + 1)),
                ),
                h(
                  'div',
                  { className: 'mv-bm-info' },
                  h(
                    'div',
                    { className: 'mv-bm-title-row' },
                    isEditing
                      ? h('input', {
                          className: 'mv-bm-rename',
                          value: draftName,
                          maxLength: 60,
                          autoFocus: true,
                          'aria-label': t('bookmarks.rename'),
                          onChange: (event) => setDraftName(event.target.value),
                          onBlur: () => commitRename(item.id),
                          onKeyDown: (event) => {
                            if (event.key === 'Enter') commitRename(item.id)
                            else if (event.key === 'Escape') setEditingId(null)
                          },
                        })
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'name mv-bookmark-name',
                            title: t('bookmarks.flyHint'),
                            onClick: () => flyTo(item),
                            onDoubleClick: () => startRename(item),
                          },
                          item.name,
                        ),
                    h(
                      'div',
                      { className: 'mv-bm-ops' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-bm-op',
                          disabled: index === 0,
                          title: t('bookmarks.moveUp'),
                          'aria-label': t('bookmarks.moveUp'),
                          onClick: () => move(item.id, -1),
                        },
                        '↑',
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-bm-op',
                          disabled: index === bookmarks.length - 1,
                          title: t('bookmarks.moveDown'),
                          'aria-label': t('bookmarks.moveDown'),
                          onClick: () => move(item.id, 1),
                        },
                        '↓',
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-bm-op',
                          title: t('bookmarks.rename'),
                          'aria-label': t('bookmarks.rename'),
                          onClick: () => startRename(item),
                        },
                        '✎',
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-bm-op',
                          title: t('bookmarks.recapture'),
                          'aria-label': t('bookmarks.recapture'),
                          onClick: () => recapture(item.id),
                        },
                        '↻',
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mv-bm-op danger',
                          title: t('bookmarks.remove'),
                          'aria-label': t('bookmarks.remove'),
                          onClick: () => remove(item.id),
                        },
                        '✕',
                      ),
                    ),
                  ),
                  meta
                    ? h(
                        'div',
                        { className: 'mv-bm-meta', title: meta.coords },
                        t('bookmarks.metaLine', {
                          alt: meta.alt,
                          pitch: meta.pitchDeg,
                          heading: meta.headingDeg,
                          compass: meta.compass,
                        }),
                      )
                    : null,
                  meta ? h('div', { className: 'mv-bm-coords' }, meta.coords) : null,
                ),
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
            )
          }),
        ),
  )
}
