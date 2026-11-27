/**
 * api.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import { clone } from './format.js'

    // Per-call caches: the Host meta and the vendored Cesium build load once.
    let metaPromise = null
    let cesiumPromise = null
    let cesiumStylePromise = null
    let saveChain = Promise.resolve()

    //#region data access ------------------------------------------------------

    const loadMeta = (force = false) => {
      if (force) metaPromise = null
      metaPromise ??= fetch('/api/3dviewer/meta', { credentials: 'same-origin' })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json()
        })
        .catch((error) => {
          // A failed fetch must not poison the cache: the next attempt has to retry.
          metaPromise = null
          throw error
        })
      return metaPromise
    }

    const loadCesium = () => {
      cesiumPromise ??= (async () => {
        const meta = await loadMeta()
        window.CESIUM_BASE_URL = meta.cesiumBase
        return import(meta.cesiumBase + 'index.js')
      })()
      return cesiumPromise
    }

    const loadCesiumStyle = () => {
      cesiumStylePromise ??= (async () => {
        if (document.getElementById('mv-cesium-style')) return
        const meta = await loadMeta()
        await new Promise((resolve) => {
          const link = document.createElement('link')
          link.id = 'mv-cesium-style'
          link.rel = 'stylesheet'
          link.href = meta.cesiumBase + 'Widgets/widgets.css'
          link.onload = resolve
          link.onerror = resolve
          document.head.appendChild(link)
        })
      })()
      return cesiumStylePromise
    }

    /**
     * Local GeoTIFF overlays are stored with the origin that created them. The
     * token segment is refreshed by the host, but a DSH restart can also change
     * the port, so point the same tile path at the origin serving this page.
     */
    const rebaseGeotiffOverlays = (config) => {
      const overlays = Array.isArray(config?.rasterOverlays) ? config.rasterOverlays : []
      // String surgery, not `new URL().href`: URL encodes `{z}/{x}/{y}` and
      // Cesium would stop recognising the tile template.
      const localGeotiff = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/api\/3dviewer\/geotiff\/.+)$/
      for (const overlay of overlays) {
        if (typeof overlay?.url !== 'string') continue
        const match = localGeotiff.exec(overlay.url)
        if (match !== null) overlay.url = `${location.protocol}//${location.host}${match[1]}`
      }
      return config
    }

    /** Read the persisted source catalog (falls back to the built-in catalog). */
    const loadSources = async (meta) => {
      try {
        const response = await fetch(meta.sourcesUrl, { credentials: 'same-origin' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        // The host answers `{ config, defaults }`; the overlays live in config.
        rebaseGeotiffOverlays(payload?.config ?? payload)
        return payload
      } catch {
        const config = {
          imagery: [
            {
              id: 'esri-world-imagery',
              name: 'Esri World Imagery',
              type: 'xyz',
              url: 'https://wi.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              tilingScheme: 'geographic',
              maximumLevel: 19,
              credit: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            },
          ],
          terrain: [
            {
              id: 'arcgis-world-elevation',
              name: 'ArcGIS WorldElevation3D',
              type: 'arcgis',
              url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
              credit: 'Esri, CGIAR, USGS',
            },
          ],
          settings: { theme: 'auto', imagery: 'esri-world-imagery', terrain: null },
        }
        return { config, defaults: clone(config) }
      }
    }

    /** Persist the catalog; calls are serialised so concurrent edits cannot race. */
    const persistSources = (meta, config) => {
      const run = saveChain.then(async () => {
        const response = await fetch(meta.sourcesUrl, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(config),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return (await response.json()).config
      })
      // Keep the queue usable after a failed write while still reporting it to the caller.
      saveChain = run.catch(() => {})
      return run
    }

    /** Map a stored imagery source onto a Cesium imagery provider. */
    /**
     * Register a local folder with the Host scan endpoint so its files can be
     * served same-origin. `x-dsh-panel` is required: it proves the request comes
     * from the panel, not from arbitrary page script.
     */
    const scanLocalDirectory = async (meta, directory) => {
      const response = await fetch(
        `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(directory)}`,
        { credentials: 'same-origin', headers: { 'x-dsh-panel': '1' } },
      )
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).trim()
        const error = new Error(detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`)
        error.status = response.status
        error.detail = detail
        throw error
      }
      return response.json().catch(() => ({}))
    }

    /**
     * Client-side cleanup deadline for the authorisation dialog. The Host times the
     * request out at 30 s and maps it to `access_timeout`; this timer only keeps the
     * panel's serialised command chain from waiting forever after that, and the Host
     * ignores the late ack.
     */
    const ACCESS_TIMEOUT_MS = 28000

    async function imageryProvider(Cesium, source) {
      const options = {}
      if (source.credit) options.credit = source.credit
      if (source.type === 'arcgis') return Cesium.ArcGisMapServerImageryProvider.fromUrl(source.url, options)
      if (source.type === 'wms') {
        const parameters = { service: 'WMS', version: '1.1.1', transparent: true, format: 'image/png' }
        if (typeof source.wmsTime === 'string' && source.wmsTime !== '') parameters.TIME = source.wmsTime
        return new Cesium.WebMapServiceImageryProvider({
          url: source.url,
          layers: source.layers ?? '',
          parameters,
          ...options,
        })
      }
      if (source.maximumLevel !== undefined) options.maximumLevel = source.maximumLevel
      if (source.subdomains) options.subdomains = source.subdomains
      if (source.tilingScheme === 'geographic') options.tilingScheme = new Cesium.GeographicTilingScheme()
      if (source.tilingScheme === 'web-mercator') options.tilingScheme = new Cesium.WebMercatorTilingScheme()
      // Cesium reads south-origin tile rows from `{reverseY}`, so rewrite the template
      // instead of asking users to remember which placeholder their tileset needs.
      const template = source.reverseY ? source.url.replace(/\{y\}/g, '{reverseY}') : source.url
      return new Cesium.UrlTemplateImageryProvider({ url: template, ...options })
    }

    const prefetchedTerrain = new Map()
    const terrainPrefetchKey = (source) =>
      source ? `${source.type ?? ''}|${source.url ?? ''}|${source.requestVertexNormals ? 1 : 0}|${source.requestWaterMask ? 1 : 0}` : ''

    function createTerrainProviderPromise(Cesium, source) {
      const options = {}
      if (source.credit) options.credit = source.credit
      if (source.requestVertexNormals) options.requestVertexNormals = true
      if (source.requestWaterMask) options.requestWaterMask = true
      if (source.type === 'cesium') return Cesium.CesiumTerrainProvider.fromUrl(source.url, options)
      return Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(source.url, options)
    }

    /** Kick off terrain metadata prefetch during boot so first-frame tiles do not wipe mid-load. */
    function prefetchTerrainProvider(Cesium, source) {
      if (!Cesium || !source) return
      const key = terrainPrefetchKey(source)
      if (!key || prefetchedTerrain.has(key)) return
      const promise = Promise.resolve().then(() => createTerrainProviderPromise(Cesium, source))
      promise.catch(() => {
        if (prefetchedTerrain.get(key) === promise) prefetchedTerrain.delete(key)
      })
      prefetchedTerrain.set(key, promise)
    }

    /** Map a stored terrain source onto a Cesium terrain provider. */
    async function terrainProvider(Cesium, source) {
      const key = terrainPrefetchKey(source)
      if (key && prefetchedTerrain.has(key)) {
        const pending = prefetchedTerrain.get(key)
        prefetchedTerrain.delete(key)
        return pending
      }
      return createTerrainProviderPromise(Cesium, source)
    }
    //#endregion data access

export { loadMeta, loadCesium, loadCesiumStyle, loadSources, persistSources, scanLocalDirectory, ACCESS_TIMEOUT_MS, imageryProvider, terrainProvider, prefetchTerrainProvider }
