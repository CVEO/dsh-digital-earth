/**
 * i18n.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { MESSAGES } from './messages.js'
import { service } from './runtime.js'

    const localeId = () => {
      const active = service('locale')?.getSnapshot?.()?.active
      if (typeof active === 'string' && active !== '') return active
      return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
    }
    const isChinese = () => localeId().toLowerCase().startsWith('zh')

    /** Translate a copy key; `{name}` placeholders interpolate from `params`. */
    const t = (key, params) => {
      const table = isChinese() ? MESSAGES.zh : MESSAGES.en
      let text = table[key] ?? MESSAGES.en[key] ?? key
      if (params !== undefined) {
        for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value))
      }
      return text
    }

    /** Re-render the panel when the DSH locale changes. */
    function useTranslation() {
      React.useSyncExternalStore(
        React.useCallback((callback) => service('locale')?.subscribe?.(callback) ?? (() => {}), []),
        localeId,
      )
      return t
    }

export { localeId, isChinese, t, useTranslation }
