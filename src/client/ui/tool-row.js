/**
 * ui/tool-row.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { loadMeta } from '../api.js'
import { useTranslation } from '../i18n.js'
import { readAutoOpen, toolArg } from '../preferences.js'
import { service } from '../runtime.js'
import { TOOL_CSS } from './css.js'
import { ViewerIcon } from './icons.js'

const h = React.createElement

    /** Chat header globe button: opens the session-scoped earth tab. */
    function HeaderButton(props) {
      const fallbackT = useTranslation()
      const t = typeof props.t === 'function' ? props.t : fallbackT
      const [hover, setHover] = React.useState(false)
      return h(
        'button',
        {
          type: 'button',
          title: t('header.open'),
          'aria-label': t('header.open'),
          style: {
            appearance: 'none',
            border: 0,
            padding: 0,
            margin: 0,
            flex: 'none',
            width: 26,
            height: 26,
            borderRadius: 7,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'inherit',
            background: hover ? 'rgba(127,127,127,.16)' : 'transparent',
            opacity: hover ? 1 : 0.82,
          },
          onClick: () => props.onOpen?.(props.sessionId),
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
        },
        h(ViewerIcon, { size: 16 }),
      )
    }
    //#region agent tool rows --------------------------------------------------
    /** Inject the chat-row stylesheet once; a hot reload may re-run `apply`. */
    const ensureToolCss = () => {
      if (typeof document === 'undefined') return
      const id = '@cveo/dsh-digital-earth/tool-row.css'
      if (document.querySelector(`style[data-plugin-css="${id}"]`)) return
      const tag = document.createElement('style')
      tag.dataset.plugin = '@cveo/dsh-digital-earth'
      tag.dataset.pluginCss = id
      tag.textContent = TOOL_CSS
      document.head.appendChild(tag)
    }

    /** Open the session-scoped earth tab, falling back to the immersive panel. */
    const openEarthPanel = () => {
      // Prefer the chat-adjacent tab so the conversation stays visible; the
      // immersive main panel is only a fallback for hosts without a session.
      try {
        const rightbar = service('sidebarRight')
        if (rightbar && typeof rightbar.openTab === 'function') {
          rightbar.openTab('digital-earth')
          return
        }
      } catch {
        // No on-screen session: fall through to the immersive panel.
      }
      service('layout')?.selectPanel?.('digital-earth')
    }

    /**
     * First line of a settled tool result. A failed earth call keeps its guidance
     * ("panel did not attach…") in the transcript instead of hiding it behind the
     * generic row this custom view replaced.
     */
    const resultFirstLine = (block) => {
      const content = Array.isArray(block?.content) ? block.content : []
      for (const part of content) {
        if (part?.type !== 'text' || typeof part.text !== 'string') continue
        const line = part.text.split('\n').find((item) => item.trim() !== '')
        if (line !== undefined) return line.trim()
      }
      return ''
    }

    /** Locale keys for the action summary shown on an earth tool-call row. */
    const SCENE_ACTION_KEYS = {
      status: 'tool.action.status',
      list: 'tool.action.list',
      load: 'tool.action.load',
      remove: 'tool.action.remove',
      visible: 'tool.action.visible',
      basemap: 'tool.action.basemap',
      terrain: 'tool.action.terrain',
      fly: 'tool.action.fly',
      reset: 'tool.action.reset',
      pick: 'tool.action.pick',
      inspect: 'tool.action.inspect',
      report: 'tool.action.report',
    }

    /** Fixed summary keys for the tools that carry no `action` argument. */
    const TOOL_SUMMARY_KEYS = {
      earth_capture: 'tool.action.capture',
      earth_draw: 'tool.action.draw',
      earth_measure: 'tool.action.measure',
      earth_analyze: 'tool.action.analyze',
      earth_shader: 'tool.action.shader',
    }

    /**
     * Call ids whose live row already opened the panel. Module-level so a row
     * remount (scrolling, session switch) cannot reopen a panel the user closed,
     * while a genuinely new call still opens it.
     */
    const AUTO_OPENED_CALLS = new Set()

    /**
     * Chat row for the six Agent wire tools. It keeps the transcript compact,
     * offers a way back into the panel, and is the client's auto-open trigger: a
     * live call opens the docked tab so the Host tool call finds a panel to drive.
     */
    function EarthToolRow({ toolName, phase, block, callId }) {
      const t = useTranslation()
      const openedRef = React.useRef(false)

      React.useEffect(() => {
        // Replayed history renders with phase === 'result' and must never pop the
        // panel. The refs make this one-shot per rendered row and per call id: a
        // long turn (or React re-running the effect in development) cannot re-open
        // a panel the user just closed.
        if (phase === 'result' || openedRef.current) return
        if (typeof callId === 'string' && AUTO_OPENED_CALLS.has(callId)) return
        if (!readAutoOpen()) return
        const rightbar = service('sidebarRight')
        // A service that is not mounted yet must not burn the one-shot: the next
        // phase transition retries instead of leaving the Host call waiting.
        if (!rightbar || typeof rightbar.openTab !== 'function') return
        openedRef.current = true
        try {
          const alreadyOpen = rightbar.isExpanded?.() === true && rightbar.active?.()?.kind === 'digital-earth'
          if (!alreadyOpen) rightbar.openTab('digital-earth')
          // Recorded only after openTab returned: a throw (no on-screen session)
          // must stay retryable on the next phase transition.
          if (typeof callId === 'string') AUTO_OPENED_CALLS.add(callId)
        } catch {
          // No on-screen Session yet: the row's Open button stays the manual path.
        }
      }, [phase, callId])

      // earth_capture rows show the saved snapshot as a small preview. The file
      // path comes from the rendered result text; the token-bearing URL is built
      // from page metadata and never enters the model-facing result.
      const [thumbUrl, setThumbUrl] = React.useState('')
      React.useEffect(() => {
        if (toolName !== 'earth_capture' || phase !== 'result' || block?.isError === true) return undefined
        const content = Array.isArray(block?.content) ? block.content : []
        const text = content
          .filter((part) => part?.type === 'text' && typeof part.text === 'string')
          .map((part) => part.text)
          .join('\n')
        const match = /Captured image:\s*(.+)/.exec(text)
        const file = match === null ? '' : String(match[1]).trim().split(/[\\/]/).pop()
        if (file === '') return undefined
        let cancelled = false
        loadMeta()
          .then((meta) => {
            if (cancelled) return
            if (typeof meta?.filesUrl !== 'string' || meta.filesUrl === '') return
            setThumbUrl(`${meta.filesUrl}${encodeURIComponent(file)}`)
          })
          .catch(() => {})
        return () => {
          cancelled = true
        }
      }, [toolName, phase, block])

      const action = toolName === 'earth_scene' ? toolArg(block, 'action') : ''
      const state = phase === 'result' ? (block?.isError === true ? 'error' : 'ok') : 'live'
      const failure = state === 'error' ? resultFirstLine(block) : ''
      const summaryKey = toolName === 'earth_scene'
        ? SCENE_ACTION_KEYS[action] ?? 'tool.action.generic'
        : TOOL_SUMMARY_KEYS[toolName] ?? 'tool.action.generic'
      const summary = failure !== '' ? failure : t(summaryKey)
      return h(
        'div',
        { className: 'mv-toolrow', 'data-state': state, 'data-tool': toolName },
        h('span', { className: 'glyph', 'aria-hidden': true }, h(ViewerIcon, { size: 14 })),
        h('span', { className: 'title' }, t('panel.title')),
        h('span', { className: 'sep', 'aria-hidden': true }),
        h('span', { className: 'summary', title: failure !== '' ? failure : undefined }, summary),
        thumbUrl === ''
          ? null
          : h(
              'a',
              {
                className: 'thumb',
                href: thumbUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                title: t('tool.thumbOpen'),
              },
              h('img', { src: thumbUrl, alt: '', loading: 'lazy' }),
            ),
        h(
          'button',
          { type: 'button', className: 'open', title: t('tool.openTip'), onClick: openEarthPanel },
          t('tool.open'),
        ),
      )
    }
    //#endregion agent tool rows

export { HeaderButton, ensureToolCss, openEarthPanel, resultFirstLine, SCENE_ACTION_KEYS, TOOL_SUMMARY_KEYS, AUTO_OPENED_CALLS, EarthToolRow }
