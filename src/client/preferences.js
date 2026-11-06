/**
 * preferences.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */

    /**
     * Browser-local preferences live in localStorage rather than the Host source
     * catalog: the client must read the auto-open switch while the panel (and its
     * settings dialog) is closed, before any Host round-trip could complete.
     */
    const AUTO_OPEN_KEY = 'dsh.digital-earth.autoOpenPanel'

    /** Read the auto-open preference; default ON, and never throw on disabled storage. */
    const readAutoOpen = () => {
      try {
        const stored = window.localStorage.getItem(AUTO_OPEN_KEY)
        return stored === null ? true : stored === '1'
      } catch {
        return true
      }
    }

    const writeAutoOpen = (value) => {
      try {
        window.localStorage.setItem(AUTO_OPEN_KEY, value ? '1' : '0')
      } catch {
        // Storage disabled: the preference only survives until the page reloads.
      }
    }

    /**
     * Read one tool argument across the three owner blocks: a live call exposes a
     * growing `PartialArguments` view (`.text(key)`), a settled one keeps raw JSON
     * on `block.call.argsRaw`, and preparations may expose neither.
     */
    const toolArg = (block, key) => {
      const call = block?.call
      if (typeof call?.argsRaw === 'string') {
        try {
          const parsed = JSON.parse(call.argsRaw)
          if (parsed && typeof parsed === 'object' && typeof parsed[key] === 'string') return parsed[key]
        } catch {
          // The stream has not produced valid JSON yet; fall through to the live view.
        }
      }
      const view = block?.args
      if (view && typeof view === 'object') {
        try {
          if (typeof view.text === 'function') {
            const text = view.text(key)
            if (typeof text === 'string' && text !== '') return text
          }
          if (typeof view[key] === 'string') return view[key]
        } catch {
          // A partially streamed argument can throw while decoding.
        }
      }
      return undefined
    }

    /** Last path segment of a Windows or POSIX folder path, for compact menus. */
    const folderName = (dir) => String(dir).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || String(dir)

export { AUTO_OPEN_KEY, readAutoOpen, writeAutoOpen, toolArg, folderName }
