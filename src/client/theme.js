/**
 * theme.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { getAppCtx, service } from './runtime.js'

    /** Whether DSH (or the OS, when DSH follows it) is currently dark. */
    const darkFromEnvironment = () => {
      const theme = service('theme')
      const snapshot = theme?.getTheme?.()
      const scheme = snapshot?.active?.colorScheme
      if (scheme === 'dark') return true
      if (scheme === 'light') return false
      if (typeof document !== 'undefined' && document.body) {
        if (document.body.hasAttribute('data-ds-dark-theme')) return true
        const source = document.documentElement?.dataset?.dsThemeSource
        if (source === 'dark') return true
        if (source === 'light') return false
      }
      return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    }

    /**
     * Track the resolved DSH colour scheme. `theme/change` is the documented
     * channel; the media query covers a host without the theme service.
     */
    function useEnvironmentDark() {
      const subscribe = React.useCallback((callback) => {
        const theme = service('theme')
        const disposers = []
        if (theme && typeof getAppCtx()?.on === 'function') disposers.push(getAppCtx().on('theme/change', callback))
        if (typeof matchMedia === 'function') {
          const media = matchMedia('(prefers-color-scheme: dark)')
          media.addEventListener('change', callback)
          disposers.push(() => media.removeEventListener('change', callback))
        }
        return () => {
          for (const dispose of disposers) dispose()
        }
      }, [])
      return React.useSyncExternalStore(subscribe, darkFromEnvironment)
    }

export { darkFromEnvironment, useEnvironmentDark }
