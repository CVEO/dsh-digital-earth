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

    /** Read the persisted source catalog (falls back to the built-in catalog). */
    const loadSources = async (meta) => {
      try {
        const response = await fetch(meta.sourcesUrl, { credentials: 'same-origin' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.json()
      } catch {
        const config = {
          imagery: [
            {
              id: 'esri-world-imagery',
              name: 'Esri World Imagery',
              type: 'xyz',
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json().catch(() => ({}))
    }

    /**
     * Client-side cleanup deadline for the authorisation dialog. The Host times the
     * request out at 30 s and maps it to `access_timeout`; this timer only keeps the
     * panel's serialised command chain from waiting forever after that, and the Host
     * ignores the late ack.
     */
    const ACCESS_TIMEOUT_MS = 32000

    async function imageryProvider(Cesium, source) {
      const options = {}
      if (source.credit) options.credit = source.credit
      if (source.type === 'arcgis') return Cesium.ArcGisMapServerImageryProvider.fromUrl(source.url, options)
      if (source.type === 'wms') {
        return new Cesium.WebMapServiceImageryProvider({
          url: source.url,
          layers: source.layers ?? '',
          parameters: { service: 'WMS', version: '1.1.1', transparent: true, format: 'image/png' },
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

    /** Map a stored terrain source onto a Cesium terrain provider. */
    async function terrainProvider(Cesium, source) {
      const options = {}
      if (source.credit) options.credit = source.credit
      if (source.requestVertexNormals) options.requestVertexNormals = true
      if (source.requestWaterMask) options.requestWaterMask = true
      if (source.type === 'cesium') return Cesium.CesiumTerrainProvider.fromUrl(source.url, options)
      return Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(source.url, options)
    }
    //#endregion data access

export { loadMeta, loadCesium, loadCesiumStyle, loadSources, persistSources, scanLocalDirectory, ACCESS_TIMEOUT_MS, imageryProvider, terrainProvider }
