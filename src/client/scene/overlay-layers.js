/**
 * scene/overlay-layers.js — the L3 raster-overlay stack.
 *
 * The panel's basemap is a single `ImageryLayer` that gets replaced when the user
 * switches sources. Raster overlays are different: several of them coexist above
 * the basemap (a flood-risk WMS, a classification raster, a 2020 orthophoto), each
 * with its own opacity and visibility, and they must never be confused with the
 * basemap. This module owns that stack so the rest of the panel (and the settings
 * schema) only deals with a plain array of source descriptors.
 *
 * Stacking contract: the basemap is added at index 0 (see applyImagery in
 * ViewerSurface), so overlays appended at the end always render above it. Adding a
 * new basemap therefore cannot cover the overlays.
 *
 * All mutations are serialised: adding a provider is async (ArcGIS/WMS fetch
 * capabilities), and two rapid settings saves must not interleave inserts/removes.
 */

/** Overlay source types the inline "add overlay" form accepts. */
export const OVERLAY_TYPES = ['wms', 'xyz', 'arcgis']

/**
 * Validate the inline "add overlay" form into a catalog overlay entry, or null.
 * Pure on purpose: the form rules live next to the stack schema and are
 * unit-testable without React or a browser.
 */
export function normalizeOverlayDraft(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const type = typeof raw.type === 'string' && OVERLAY_TYPES.includes(raw.type) ? raw.type : null
  if (type === null) return null
  const url = typeof raw.url === 'string' ? raw.url.trim() : ''
  if (url === '') return null
  const layers = type === 'wms' ? (typeof raw.layers === 'string' ? raw.layers.trim() : '') : ''
  if (type === 'wms' && layers === '') return null
  const name = (typeof raw.name === 'string' ? raw.name.trim() : '') || '叠加图层'
  const opacity = Number.isFinite(Number(raw.opacity)) ? Math.min(1, Math.max(0, Number(raw.opacity))) : 1
  return { name, type, url, ...(layers === '' ? {} : { layers }), opacity, visible: true }
}

/**
 * @param {object} options
 * @param {object} options.Cesium vendored Cesium namespace (from the panel runtime)
 * @param {object} options.viewer  Cesium.Viewer (or a fake in tests)
 * @param {Function} options.providerFactory async (Cesium, source) => ImageryProvider
 *   The panel passes `imageryProvider`; keeping it injected is what lets this
 *   module stay free of browser-only imports and be unit-tested in Node.
 * @param {Function} [options.onError] called with (error, source) when one overlay fails
 */
export function createOverlayLayers({ Cesium, viewer, providerFactory, onError = () => {} } = {}) {
  const buildProvider =
    typeof providerFactory === 'function'
      ? providerFactory
      : async () => {
          throw new Error('overlay provider factory is missing')
        }
  /** id -> { id, source, layer } */
  const entries = new Map()
  let chain = Promise.resolve()

  // The viewer can be destroyed while a queued mutation is still pending, so every
  // access is defensive: losing the collection just means "nothing to do".
  const collection = () => {
    try {
      return viewer?.scene?.imageryLayers ?? null
    } catch {
      return null
    }
  }

  /** Run one stack mutation after the previous one finished (and never reject the chain). */
  function enqueue(task) {
    const run = chain.then(task)
    chain = run.catch(() => {})
    return run
  }

  function destroyLayer(layer) {
    const layers = collection()
    if (!layers || !layer) return
    try {
      layers.remove(layer, true)
    } catch {
      /* the viewer may already be destroyed */
    }
  }

  function removeNow(id) {
    const entry = entries.get(id)
    if (!entry) return false
    destroyLayer(entry.layer)
    entries.delete(id)
    return true
  }

  /** True when the stored descriptor differs from what the layer was built from. */
  function needsRebuild(entry, source) {
    return entry.source.type !== source.type || entry.source.url !== source.url || (entry.source.layers ?? '') !== (source.layers ?? '')
  }

  function applyStyle(entry) {
    if (!entry.layer) return
    entry.layer.alpha = entry.source.opacity
    entry.layer.show = entry.source.visible !== false
  }

  async function addNow(source) {
    const layers = collection()
    if (!layers) return null
    if (entries.has(source.id)) removeNow(source.id)
    let provider
    try {
      provider = await buildProvider(Cesium, source)
    } catch (error) {
      onError(error, source)
      return null
    }
    const layer = layers.addImageryProvider(provider)
    const entry = {
      id: source.id,
      source: { ...source },
      layer,
    }
    entries.set(source.id, entry)
    applyStyle(entry)
    return entry
  }

  return {
    /** Add (or replace) one overlay and return its entry, or null on failure. */
    add(source) {
      return enqueue(() => addNow(source))
    },

    /** Remove one overlay; returns true when it existed. */
    remove(id) {
      return enqueue(() => removeNow(id))
    },

    /** Remove every overlay (used when the panel is destroyed). */
    clear() {
      return enqueue(() => {
        for (const id of [...entries.keys()]) removeNow(id)
      })
    },

    setOpacity(id, opacity) {
      return enqueue(() => {
        const entry = entries.get(id)
        if (!entry) return false
        entry.source.opacity = Math.min(1, Math.max(0, Number(opacity) || 0))
        applyStyle(entry)
        return true
      })
    },

    setVisible(id, visible) {
      return enqueue(() => {
        const entry = entries.get(id)
        if (!entry) return false
        entry.source.visible = visible !== false
        applyStyle(entry)
        return true
      })
    },

    /**
     * Reconcile the live stack with a catalog array: add new ids, drop removed
     * ones, rebuild changed sources and refresh opacity/visibility. This is the
     * one entry point the panel calls at mount and after a settings save, so the
     * stack can never drift from `sources.json`.
     */
    sync(sources) {
      return enqueue(async () => {
        const next = Array.isArray(sources) ? sources.filter((item) => item && typeof item.id === 'string') : []
        const wanted = new Set(next.map((item) => item.id))
        const summary = { added: 0, removed: 0, updated: 0, failed: 0 }
        for (const id of [...entries.keys()]) {
          if (!wanted.has(id)) {
            if (removeNow(id)) summary.removed += 1
          }
        }
        for (const source of next) {
          const existing = entries.get(source.id)
          if (!existing) {
            if ((await addNow(source)) !== null) summary.added += 1
            else summary.failed += 1
            continue
          }
          if (needsRebuild(existing, source)) {
            removeNow(source.id)
            if ((await addNow(source)) !== null) summary.added += 1
            else summary.failed += 1
            continue
          }
          existing.source = { ...source }
          applyStyle(existing)
          summary.updated += 1
        }
        // F09: Reorder both the entries Map and the live Cesium ImageryLayerCollection
        // so moving an overlay up/down in the UI actually changes the draw stack order.
        const currentOrder = [...entries.keys()]
        const orderedEntries = []
        for (const source of next) {
          const entry = entries.get(source.id)
          if (entry) orderedEntries.push([source.id, entry])
        }
        const orderChanged =
          orderedEntries.length === currentOrder.length &&
          orderedEntries.some(([id], idx) => currentOrder[idx] !== id)
        if (orderChanged) {
          entries.clear()
          const layers = collection()
          for (const [id, entry] of orderedEntries) {
            entries.set(id, entry)
            try {
              if (layers && entry.layer && typeof layers.raiseToTop === 'function') {
                layers.raiseToTop(entry.layer)
              }
            } catch {
              /* viewer may be tearing down */
            }
          }
        }
        return summary
      })
    },

    /** Live stack in insert order (bottom-most overlay first). */
    list() {
      return [...entries.values()].map((entry) => ({
        id: entry.id,
        name: entry.source.name,
        type: entry.source.type,
        url: entry.source.url,
        opacity: entry.source.opacity,
        visible: entry.source.visible !== false,
      }))
    },

    /** Number of live overlays. */
    size() {
      return entries.size
    },

    /** Remove every layer and forget the stack (viewer teardown). */
    dispose() {
      return enqueue(() => {
        for (const id of [...entries.keys()]) removeNow(id)
        chain = Promise.resolve()
      })
    },
  }
}
