/**
 * viewer/ViewerSurface.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { createAnalysisEngine } from '../analysis/engine.js'
import { buildAgentOverlayList, clearAgentOverlays as clearAgentOverlaysInState, flyToAgentOverlay, flyToBbox, manualMeasurementRow, overlayRowsWithEntities, removeAgentOverlay, removeAgentOverlayRows } from '../scene/agent-overlays.js'
import { ACCESS_TIMEOUT_MS, imageryProvider, loadCesium, loadCesiumStyle, loadMeta, loadSources, persistSources, scanLocalDirectory, terrainProvider } from '../api.js'
import { sampleCursor } from '../cursor.js'
import { arrayBufferToBase64, b64url, clone, escapeHtml, formatArea, formatDistance, formatHeight, formatValue, geodesicLength, message, planarArea, redactUrl } from '../format.js'
import { isChinese, t, useTranslation } from '../i18n.js'
import { folderName } from '../preferences.js'
import { service } from '../runtime.js'
import { normalizeSceneSnapshot, readSceneSnapshot, writeSceneSnapshot } from '../scene-store.js'
import { createOverlayLayers } from '../scene/overlay-layers.js'
import { createLayerKindProbe } from '../scene/layer-kind.js'
import { flyToBookmark } from '../scene/bookmarks.js'
import { flyToCartographic, frameAllLayers } from '../scene/frame.js'
import { flyToCoordinates, parseLonLat } from '../scene/fly-target.js'
import { tilesetGeorefIssue } from '../scene/georef-check.js'
import { flightDuration } from '../scene/motion.js'
import { createAskAgent } from '../scene/ask-agent.js'
import { createCaptureService } from '../scene/capture.js'
import { createCaptureHud } from '../scene/capture-hud.js'
import { createPointerTools } from '../scene/pointer-tools.js'
import { pickSurfaceAt } from '../scene/pick-surface.js'
import { createProfileTool } from '../scene/profile-tool.js'
import { createVectorInteraction } from '../scene/vector-interaction.js'
import { VECTOR_COLORS, vectorLabel } from '../scene/vector-style.js'
import { createSelectionController } from '../scene/selection-controller.js'
import { cancelSelection, disposeSelection, getSelectionTool, isSelectionActive, peekSelection } from '../scene/selection-tools.js'
import { installCanvasInput } from '../scene/canvas-input.js'
import { createCommandBridge } from '../scene/command-bridge.js'
import { createSceneReport } from '../scene/report.js'
import { createSceneStatus } from '../scene/status.js'
import { createHostSceneStore } from '../scene/host-scene-store.js'
import { applyQuality, normalizeQuality, qualityProfile } from '../scene/quality.js'
import { createShaderEngine } from '../scene/shader-engine.js'
import { useEnvironmentDark } from '../theme.js'
import { ShaderWorkbench } from '../ui/cards.js'
import { CSS } from '../ui/css.js'
import { revealPanel } from '../ui/reveal-panel.js'
import { HealthDialog, PathAccessDialog, ScanDialog, SourcesDialog } from '../ui/dialogs.js'
import { UrlBar } from '../ui/url-bar.js'
import { Compass } from '../ui/compass.js'
import { StatusHud } from '../ui/hud.js'
import { AskAgentIcon, FullscreenIcon, HudIcon, ResetIcon, ScreenshotIcon, ShaderIcon, ViewerIcon } from '../ui/icons.js'
import { ToolbarQuick } from '../ui/toolbar-quick.js'
import { ToolbarMenus } from '../ui/toolbar-menus.js'
import { RightStack } from '../ui/right-stack.js'
import { LoadingGlobe } from '../ui/loading-globe.js'
import { SelectionOverlay } from '../ui/selection-overlay.js'
import { VectorCard } from '../ui/vector-card.js'
import { useTour } from '../ui/tour-bar.js'
import { useSceneDetails } from '../ui/scene-details.js'
import { useWorkbenchWiring } from '../ui/use-workbench.js'
import { createLocalDirectoryWiring, formatScanFailure } from '../ui/workbench-wiring.js'
import { MenuItem } from '../ui/menu-item.js'
import { hasVectorFile, isVectorDrag, readVectorFiles } from '../scene/vector-file.js'
import { vectorErrorText } from '../scene/vector-errors.js'
import { runVectorImport } from '../scene/vector-import-transaction.js'
const h = React.createElement

    /**
     * The globe surface itself. It is mounted twice: once as the immersive
     * `main` panel (no session) and once inside the session-scoped right
     * sidebar tab, where `sessionId` enables the Agent bridge.
     */
    function ViewerSurface({ t: injectedT, sessionId = null, docked = false }) {
      const fallbackT = useTranslation()
      const t = typeof injectedT === 'function' ? injectedT : fallbackT
      const environmentDark = useEnvironmentDark()
      const rootRef = React.useRef(null)
      const globeRef = React.useRef(null)
      const creditRef = React.useRef(null)
      const menuRef = React.useRef(null)
      const viewerRef = React.useRef(null)
      const cesiumRef = React.useRef(null)
      const metaRef = React.useRef(null)
      const layersRef = React.useRef([])
      const toolRef = React.useRef('identify')
      const profileToolRef = React.useRef(null)
      const measureRef = React.useRef({ points: [], entities: [] })
      const vectorRef = React.useRef(null)
      const handlerRef = React.useRef(null)
      const imageryRef = React.useRef(null)
      // L3 raster overlays above the basemap (several layers, each with alpha).
      const overlayLayersRef = React.useRef(null)
      const sourcesRef = React.useRef(null)
      const toastTimer = React.useRef(0)
      const captureReadoutRef = React.useRef(null)
      const commandChainRef = React.useRef(Promise.resolve())
      const commandRef = React.useRef(null)
      // v1.7 P0 "指认": the overlay publishes its identify(position) here so the
      // shared canvas click loop in scene/pointer-tools.js can route clicks.
      const selectionApiRef = React.useRef(null)
      const accessRef = React.useRef(null)
      // Single active analysis: owns its entities plus the scene state sunlight
      // changed (lighting, shadows, clock) so clear() can restore it exactly.
      const analysisRef = React.useRef({ operation: null, layerId: null, layerName: null, entities: [], restore: null })
      // The last analysis command (not its entities): a remounted panel replays it
      // so the profile/flood/sunlight result comes back with the scene.
      const analysisCommandRef = React.useRef(null)
      // B3 shader: one active preset per layer, plus the single preRender u_time
      // tick that is registered only while at least one preset is active.
      const shaderEntriesRef = React.useRef(new Map())
      const shaderTickRef = React.useRef(null)
      // Resolves when the Cesium viewer is fully ready. The bridge connects before
      // that (right after meta arrives) so a cold panel mount does not eat the
      // Host's attach grace; commands wait on this gate instead.
      const readyGateRef = React.useRef({ ready: false, error: null, waiters: [] })
      const healthSeqRef = React.useRef(0)
      const sessionRef = React.useRef(sessionId)
      sessionRef.current = sessionId

      const [phase, setPhase] = React.useState('loading')
      const [error, setError] = React.useState('')
      const [layers, setLayers] = React.useState([])
      const [sources, setSources] = React.useState(null)
      const [defaults, setDefaults] = React.useState(null)
      const [tool, setTool] = React.useState('identify')
      const [fps, setFps] = React.useState(null)
      // True while the panel root is the document's fullscreen element.
      const [fullscreen, setFullscreen] = React.useState(false)
      const [stats, setStats] = React.useState(null)
      const [pickInfo, setPickInfo] = React.useState(null)
      const [measureInfo, setMeasureInfo] = React.useState(null)
      const [vectorSelection, setVectorSelection] = React.useState(null)
      const [scan, setScan] = React.useState(null)
      // The empty-state card is onboarding, not chrome: dismissing it keeps the
      // globe free for custom instructions until this panel is remounted.
      const [emptyDismissed, setEmptyDismissed] = React.useState(false)
      const [restoringScene, setRestoringScene] = React.useState(false)
      const [urlBar, setUrlBar] = React.useState(false)
      const [urlInput, setUrlInput] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [toast, setToast] = React.useState('')
      const [openMenu, setOpenMenu] = React.useState(null)
      const [recentDirs, setRecentDirs] = React.useState([])
      const [accessRequest, setAccessRequest] = React.useState(null)
      const [accessBusy, setAccessBusy] = React.useState(false)
      const [analysis, setAnalysis] = React.useState(null)
      const [shaderOpen, setShaderOpen] = React.useState(false)
      const [showTools, setShowTools] = React.useState(true)
      const [shaderActive, setShaderActive] = React.useState([])
      const [shaderForm, setShaderForm] = React.useState({
        layerId: '',
        preset: 'height-false-color',
        minHeight: '',
        maxHeight: '',
        interval: '20',
        speed: '1',
        amplitude: '1',
        opacity: '0.75',
        waterHeight: '',
        depthMax: '',
      })
      const [settingsOpen, setSettingsOpen] = React.useState(false)
      const [health, setHealth] = React.useState(null)
      const [terrainBusy, setTerrainBusy] = React.useState(false)
      // Inline terrain problem (blocked service etc.) shown in the layer panel instead
      // of toasting on every automatic restore attempt.
      const [terrainError, setTerrainError] = React.useState('')
      const [imageryBusy, setImageryBusy] = React.useState(false)
      const [meta, setMeta] = React.useState(null)
      const [bridgeOn, setBridgeOn] = React.useState(false)
      const [bridgeReload, setBridgeReload] = React.useState(false)
      const [bridgeEpoch, setBridgeEpoch] = React.useState(0)

      const themeMode = sources?.settings?.theme ?? 'auto'
      const resolvedDark = themeMode === 'auto' ? environmentDark : themeMode === 'dark'
      // Chrome visibility is persisted through `settings`: an older Host config may
      // not have written these keys yet, so a missing value means "visible".
      const showLayers = sources?.settings?.showLayers !== false
      const showHud = sources?.settings?.showHud !== false
      const activeImageryId = sources?.settings?.imagery ?? null
      const activeTerrainId = sources?.settings?.terrain ?? null
      const activeImagery = sources?.imagery?.find((source) => source.id === activeImageryId) ?? null

      const showToast = (text) => {
        setToast(text)
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(''), 6000)
      }

      /** Wake every command waiting for the viewer: resolve when ready, reject on failure. */
      const settleReadyWaiters = (error) => {
        const gate = readyGateRef.current
        if (error === undefined) {
          gate.ready = true
          gate.error = null
        } else {
          gate.error = error
        }
        const waiters = gate.waiters.splice(0)
        for (const waiter of waiters) {
          if (error === undefined) waiter.resolve()
          else waiter.reject(error)
        }
      }

      /**
       * Wait for the viewer before executing a bridge command. The Host starts its
       * command deadline when it sends the frame, so this wait is bounded by the
       * Host timeout too; the local timeout only keeps a dead panel from stalling
       * the command chain forever.
       */
      const waitForPanelReady = (timeoutMs = 12000) =>
        new Promise((resolve, reject) => {
          const gate = readyGateRef.current
          if (gate.ready) {
            resolve()
            return
          }
          // A failed panel init never becomes ready: fail fast instead of leaving
          // the Agent waiting for the local timeout.
          if (gate.error !== null) {
            reject(gate.error)
            return
          }
          const waiter = { resolve: null, reject: null }
          const timer = setTimeout(() => {
            const index = gate.waiters.indexOf(waiter)
            if (index >= 0) gate.waiters.splice(index, 1)
            reject(new Error(t('agent.notReady')))
          }, timeoutMs)
          waiter.resolve = () => {
            clearTimeout(timer)
            resolve()
          }
          waiter.reject = (error) => {
            clearTimeout(timer)
            reject(error)
          }
          gate.waiters.push(waiter)
        })

      const syncLayers = () => {
        setLayers(layersRef.current.map((layer) => ({ id: layer.id, name: layer.name, visible: layer.visible, georefIssue: layer.georefIssue })))
        markSceneDirty()
      }

      // Persist writes run one at a time and stale responses are dropped, so two
      // quick Agent commands (basemap then terrain) cannot roll each other back.
      const saveChainRef = React.useRef(Promise.resolve())
      const saveSeqRef = React.useRef(0)
      const commitSources = (next, notify) => {
        const previous = sourcesRef.current
        sourcesRef.current = next
        setSources(next)
        const meta = metaRef.current
        if (!meta) return
        const seq = (saveSeqRef.current += 1)
        saveChainRef.current = saveChainRef.current.then(() =>
          persistSources(meta, next)
            .then((saved) => {
              if (!saved || seq !== saveSeqRef.current) return
              sourcesRef.current = saved
              setSources(saved)
              if (notify) showToast(t('toast.sourcesSaved'))
            })
            .catch((error) => {
              if (seq !== saveSeqRef.current) return
              sourcesRef.current = previous
              setSources(previous)
              showToast(t('toast.saveFailed', { message: message(error) }))
            }),
        )
      }

      const updateSettings = (patch, notify) => {
        const current = sourcesRef.current
        if (!current) return
        commitSources({ ...current, settings: { ...current.settings, ...patch } }, notify)
      }

      /**
       * Map the frozen Host `authorize` args onto what the dialog renders. The Host
       * resolves the target before asking, so `directory` and `target` are normally
       * present; the fallbacks keep older/partial payloads working.
       */
      const normalizeAccessRequest = (args = {}) => {
        const rawPath = typeof args.path === 'string' ? args.path.trim() : ''
        const rawTarget = typeof args.target === 'string' ? args.target.trim() : ''
        const target = rawTarget || rawPath
        const explicitDir = typeof args.directory === 'string' ? args.directory.trim() : ''
        const normalized = target.replace(/\\/g, '/')
        const index = normalized.lastIndexOf('/')
        return {
          request: typeof args.request === 'string' ? args.request : 'load',
          path: rawPath,
          target,
          directory: explicitDir || (index > 0 ? target.slice(0, index) : ''),
          kind: typeof args.kind === 'string' ? args.kind : 'file',
          resolved: args.resolved === true || (rawTarget !== '' && rawTarget !== rawPath),
        }
      }

      /**
       * Settle the open authorisation dialog exactly once. A late settle (e.g. the
       * cleanup timer firing after the Host already timed out) is ignored.
       */
      const settleAccess = (outcome) => {
        const current = accessRef.current
        if (!current) return
        accessRef.current = null
        clearTimeout(current.timer)
        setAccessRequest(null)
        setAccessBusy(false)
        current.resolve(outcome)
      }

      /**
       * Open the dialog and wait for the user. The 28 s cleanup timer stays under
       * the Host's 30 s authorisation deadline; the late ack is ignored by the
       * Host and never retried.
       */
      const askPathAccess = (request) =>
        new Promise((resolve) => {
          if (accessRef.current) settleAccess({ allowed: false, message: t('access.denied') })
          // A path dialog that opens in a hidden tab is invisible to the user and
          // always ends in an access timeout. Bring the panel forward first.
          revealPanel()
          const timer = setTimeout(() => settleAccess({ allowed: false, message: t('access.denied') }), ACCESS_TIMEOUT_MS)
          accessRef.current = { resolve, timer }
          setAccessBusy(false)
          setAccessRequest(request)
        })

      /** Allow: register the folder via /scan first; only then does the bridge ack. */
      const allowPathAccess = async () => {
        const request = accessRequest
        if (!request || accessBusy || !accessRef.current) return
        setAccessBusy(true)
        try {
          await scanLocalDirectory(metaRef.current, request.directory)
          settleAccess({ allowed: true, directory: request.directory })
        } catch (error) {
          const detail = message(error)
          settleAccess({ allowed: false, message: t('access.scanFailed', { message: detail }) })
          showToast(t('access.scanFailed', { message: detail }))
        }
      }

      const pickSurface = (position) => pickSurfaceAt(viewerRef.current, position)

      const proxyUrlFor = (url) => {
        const meta = metaRef.current
        const parsed = new URL(url)
        const path = parsed.pathname
          .replace(/^\//, '')
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/')
        // Signed tile URLs (and some WMS endpoints) carry their credentials in
        // the query string; the proxy must forward it untouched.
        return `${meta.remoteBase}${b64url(parsed.origin)}/${path}${parsed.search}`
      }

      const localPathToUrl = async (filePath) => {
        const meta = metaRef.current
        const normalized = filePath.replace(/\\/g, '/')
        const index = normalized.lastIndexOf('/')
        if (index <= 0) throw new Error(t('toast.invalidPath'))
        const dir = normalized.slice(0, index)
        const rel = normalized.slice(index + 1)
        // The host only serves tile files from directories registered through /scan;
        // the Agent path was validated and authorised by the Host bridge beforehand,
        // so this call normally confirms an already-registered folder.
        await scanLocalDirectory(meta, dir)
        return `${meta.tilesBase}${encodeURIComponent(b64url(dir))}/${encodeURIComponent(rel)}`
      }

      /**
       * Ask the Host to classify a freshly loaded layer (mesh vs 3DGS). The
       * content-level check lives in the Host inspector because only it can read
       * the content headers under the folder allowlist. The result is cached on
       * the layer so shader rejection and status stay consistent.
       */
      const hydrateLayerKind = createLayerKindProbe({
        getMeta: () => metaRef.current,
        sourceOfLayer,
        layerRuntime,
      })

      /** Add a 3D Tiles layer; flies to it unless the caller restores a saved view. */
      async function loadTileset(url, name, source = null, options = {}) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) throw new Error(t('agent.notReady'))
        const label = name || decodeURIComponent(url.split('/').filter(Boolean).slice(-2).join('/'))
        // The tier decides the photogrammetry LOD; both the direct and the proxy
        // path must use the same option, otherwise a proxied load silently
        // reverts to Cesium's default 16 and looks heavier than the direct one.
        const tilesetOptions = {
          maximumScreenSpaceError: qualityProfile(sourcesRef.current?.settings?.quality).tilesetMaximumScreenSpaceError,
        }
        setBusy(t('toast.loadingData'))
        try {
          let tileset
          try {
            tileset = await withNetworkTimeout(Cesium.Cesium3DTileset.fromUrl(url, tilesetOptions), 15000)
          } catch (directError) {
            if (!/^https?:/i.test(url)) throw directError
            tileset = await withNetworkTimeout(Cesium.Cesium3DTileset.fromUrl(proxyUrlFor(url), tilesetOptions), 15000)
            showToast(t('toast.proxyFallback'))
          }
          viewer.scene.primitives.add(tileset)
          // A root without transform/region makes Cesium read local metres as
          // ECEF (data near the Earth's centre). Flag it instead of silently
          // flying the camera into the planet and showing a black screen.
          const georefIssue = tilesetGeorefIssue(tileset, Cesium)
          const layer = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: label,
            url,
            source,
            tileset,
            visible: true,
            georefIssue,
          }
          layersRef.current.push(layer)
          syncLayers()
          setScan(null)
          // Classify the content in the background (shader rejection, layer badge,
          // analysis errors). The load already succeeded: a failed inspection must
          // never fail or delay the load itself.
          void hydrateLayerKind(layer)
          if (georefIssue !== null) {
            if (options.fly !== false) showToast(t('toast.notGeoreferenced'))
          } else if (options.fly !== false) {
            // Never block the command acknowledgement on the camera flight: the
            // flight is driven by the render loop and never resolves while the
            // panel is hidden or the window is in the background (v1.5.1 A1).
            // The layer is already added, so treating the load as done is both
            // correct and the only way later commands are not stalled behind it.
            void viewer.flyTo(tileset, { duration: 1.2 }).catch(() => {})
          }
          return layer
        } finally {
          setBusy('')
        }
      }

      /** Join a folder and a relative tileset path for the Host allowlist check. */
      function joinLocalPath(dir, rel) {
        return `${String(dir).replace(/[\\/]+$/, '')}/${String(rel).replace(/\\/g, '/')}`
      }

      async function addTileset(url, name, source = null) {
        try {
          await loadTileset(url, name, source)
        } catch (error) {
          showToast(t('toast.loadFailed', { message: message(error) }))
        }
      }

      const { refreshRecentDirs, openRecentDirectory, pickLocal, pickLocalTiles } = createLocalDirectoryWiring({
        metaRef,
        getWorkspace: () => service('uiWorkspace'),
        scanLocalDirectory,
        addTileset,
        joinLocalPath,
        b64url,
        folderName,
        setRecentDirs,
        setScan,
        setBusy,
        setOpenMenu,
        showToast,
        t,
      })

      /**
       * Provider/service requests (terrain metadata, imagery capabilities, tileset
       * JSON) can hang on a bad network or a stale host route. Every network step
       * that gates the UI is raced against this timeout so the panel can fall back
       * instead of leaving the loading overlay up forever.
       */
      const NETWORK_TIMEOUT_MS = 8000
      function withNetworkTimeout(promise, ms = NETWORK_TIMEOUT_MS) {
        return Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(t('toast.requestTimeout', { seconds: Math.round(ms / 1000) }))), ms),
          ),
        ])
      }

      const imagerySeqRef = React.useRef(0)
      const terrainSeqRef = React.useRef(0)

      async function applyImagery(id, notify) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { ok: false, error: t('agent.notReady') }
        const config = sourcesRef.current
        const source = config?.imagery.find((item) => item.id === id) ?? null
        const seq = (imagerySeqRef.current += 1)
        setImageryBusy(true)
        try {
          const provider = source ? await withNetworkTimeout(imageryProvider(Cesium, source)) : null
          if (seq !== imagerySeqRef.current) return { ok: false, stale: true }
          if (imageryRef.current) {
            viewer.scene.imageryLayers.remove(imageryRef.current, true)
            imageryRef.current = null
          }
          if (source && provider) {
            // Index 0: the basemap is always the BOTTOM imagery layer, so switching
            // it never covers the L3 raster overlays stacked above it.
            imageryRef.current = viewer.scene.imageryLayers.addImageryProvider(provider, 0)
            if (notify) showToast(t('toast.basemap', { name: source.name }))
          } else if (notify) {
            showToast(t('toast.basemapNone'))
          }
          return { ok: true, source }
        } catch (error) {
          if (seq !== imagerySeqRef.current) return { ok: false, stale: true }
          showToast(t('toast.basemapFailed', { message: message(error) }))
          return { ok: false, error: message(error) }
        } finally {
          if (seq === imagerySeqRef.current) setImageryBusy(false)
        }
      }

      async function applyTerrain(id, notify) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { ok: false, error: t('agent.notReady') }
        const config = sourcesRef.current
        const source = config?.terrain.find((item) => item.id === id) ?? null
        const seq = (terrainSeqRef.current += 1)
        setTerrainBusy(true)
        if (notify) setBusy(t('toast.terrainLoading'))
        try {
          if (source) {
            const nextProvider = await withNetworkTimeout(terrainProvider(Cesium, source))
            if (seq !== terrainSeqRef.current) return { ok: false, stale: true }
            viewer.terrainProvider = nextProvider
            setTerrainError('')
            showToast(t('toast.terrainOn', { name: source.name }))
          } else {
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
            setTerrainError('')
            showToast(t('toast.terrainOff'))
          }
          // A terrain switch can change the elevation baseline, so re-apply the
          // user's depth-test choice on the new terrain.
          applyGlobeDepthTest()
          return { ok: true, source }
        } catch (error) {
          if (seq !== terrainSeqRef.current) return { ok: false, stale: true }
          viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
          const text = message(error)
          // A blocked terrain host makes every automatic restore fail. Keep the
          // failure visible in the layer panel (with a retry) instead of toasting on
          // each panel open; explicit user switches still get a toast.
          const network = /Request has failed|Failed to fetch|NetworkError|timed out|timeout|超时|网络/i.test(text)
          const hint = t(network ? 'terrain.networkHint' : 'terrain.failedHint', { message: text })
          setTerrainError(hint)
          if (notify) showToast(t(network ? 'toast.terrainNetwork' : 'toast.terrainFailed', { message: text }))
          return { ok: false, error: text }
        } finally {
          if (seq === terrainSeqRef.current) {
            setTerrainBusy(false)
            if (notify) setBusy('')
          }
        }
      }

      /**
       * Terrain depth test is a Globe property, not a viewer option: toggling it
       * must never rebuild the viewer. Off (default) lets underground pipes and
       * buried models show through the terrain; on lets terrain occlude them.
       */
      function applyGlobeDepthTest() {
        const viewer = viewerRef.current
        if (!viewer) return
        viewer.scene.globe.depthTestAgainstTerrain = sourcesRef.current?.settings?.terrainDepthTest === true
      }

      const changeImagery = (id) => {
        updateSettings({ imagery: id })
        applyImagery(id, true)
        setOpenMenu(null)
      }

      const changeTerrain = (id) => {
        updateSettings({ terrain: id })
        applyTerrain(id, true)
        setOpenMenu(null)
      }

      const setTheme = (mode) => {
        updateSettings({ theme: mode })
        setOpenMenu(null)
      }

      /** Close the immersive panel (if any) and open the session globe tab. */
      const openBeside = () => {
        const rightbar = service('sidebarRight')
        if (rightbar && typeof rightbar.openTab === 'function') {
          try {
            service('layout')?.selectPanel?.(null)
            rightbar.openTab('digital-earth')
            return
          } catch {
            // No Session on screen: the column cannot host a tab yet.
            showToast(t('toast.noSession'))
            return
          }
        }
        service('layout')?.selectPanel?.('digital-earth')
      }

      /**
       * Real fullscreen: the panel root element goes to OS-level fullscreen
       * (DOM Fullscreen API), so the whole screen shows the globe and no DSH
       * chrome remains. This is the only fullscreen entry point in the panel —
       * expanding the sidebar column is DSH's own layout feature, not ours.
       */
      const toggleDomFullscreen = () => {
        const root = rootRef.current
        if (!root) return
        const request = root.requestFullscreen?.bind(root)
        if (typeof request !== 'function') {
          showToast(t('toast.fullscreenUnsupported'))
          return
        }
        const run = async () => {
          try {
            if (document.fullscreenElement === root) await document.exitFullscreen()
            else await root.requestFullscreen({ navigationUI: 'hide' })
          } catch (error) {
            showToast(t('toast.fullscreenFailed', { message: message(error) }))
          }
        }
        void run()
      }

      const sameSourceSpec = (a, b) => a?.type === b?.type && a?.url === b?.url && (a?.layers ?? '') === (b?.layers ?? '')

      const saveSources = (draft) => {
        const current = sourcesRef.current
        const meta = metaRef.current
        if (!meta) return
        const next = { ...draft }
        commitSources(next, true)
        setSettingsOpen(false)
        const findById = (list, id) => list?.find((item) => item.id === id)
        if (current?.settings?.imagery !== next.settings.imagery || !sameSourceSpec(findById(current?.imagery, current?.settings?.imagery), findById(next.imagery, next.settings?.imagery))) {
          applyImagery(next.settings.imagery, false)
        }
        if (current?.settings?.terrain !== next.settings.terrain || !sameSourceSpec(findById(current?.terrain, current?.settings?.terrain), findById(next.terrain, next.settings?.terrain))) {
          applyTerrain(next.settings.terrain, false)
        }
        if (normalizeQuality(current?.settings?.quality) !== normalizeQuality(next.settings.quality)) {
          applyQuality(
            viewerRef.current,
            next.settings.quality,
            layersRef.current.map((layer) => layer.tileset),
          )
        }
        applyGlobeDepthTest()
        // Reconcile the L3 stack with the saved catalog (add/remove/reorder/alpha).
        void overlayLayersRef.current?.sync(next.rasterOverlays ?? []).catch(() => {})
      }

      function setToolMode(mode) {
        cancelSelection(viewerRef.current)
        // Identify is the DEFAULT pointer behaviour (click an object → its card),
        // so leaving any other tool falls back to it instead of a dead canvas.
        const next = mode ?? 'identify'
        toolRef.current = next
        setTool(next)
        if (next !== 'profile') profileToolRef.current?.clear()
        vectorRef.current?.clearSelection()
        if (next !== 'identify' || measureRef.current.points.length < (measureRef.current.mode === 'area' ? 3 : 2)) clearMeasure()
        if (next) setPickInfo(null)
        setOpenMenu(null)
      }

      function clearMeasure() {
        const viewer = viewerRef.current
        const state = measureRef.current
        if (viewer) {
          for (const entity of state.entities) viewer.entities.remove(entity)
        }
        state.entities = []
        state.points = []
        setMeasureInfo(null)
      }

      function redrawMeasure(mode) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        const state = measureRef.current
        if (!Cesium || !viewer) return
        for (const entity of state.entities) viewer.entities.remove(entity)
        state.entities = []
        const points = state.points
        state.mode = mode
        const descriptor = { group: 'local-measure', kind: t('layers.vectorMeasured'), title: t(`tool.${mode}`), summary: '' }
        const add = (options) => {
          const entity = vectorRef.current.add(options, descriptor)
          state.entities.push(entity)
          return entity
        }
        const accent = Cesium.Color.fromCssColorString(VECTOR_COLORS.accent)
        const label = (position, text) =>
          add({
            position,
            label: vectorLabel(Cesium, text),
          })
        for (const position of points) {
          add({
            position,
            point: {
              pixelSize: 6,
              color: accent,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
        }
        if (mode === 'distance' && points.length >= 2) {
          add({ polyline: { positions: points, width: 2, material: accent, depthFailMaterial: accent } })
          const total = geodesicLength(Cesium, points)
          label(points[points.length - 1], t('measure.total', { value: formatDistance(total) }))
          setMeasureInfo({ text: t('measure.distance', { value: formatDistance(total) }) })
        } else if (mode === 'area' && points.length >= 3) {
          add({
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(points),
              perPositionHeight: true,
              material: accent.withAlpha(0.28),
              outline: true,
              outlineColor: accent,
            },
          })
          add({ polyline: { positions: [...points, points[0]], width: 2.5, material: accent, depthFailMaterial: accent.withAlpha(0.3) } })
          const area = planarArea(Cesium, points)
          const center = Cesium.BoundingSphere.fromPoints(points).center
          label(center, t('measure.areaLabel', { value: formatArea(area) }))
          setMeasureInfo({ text: t('measure.area', { value: formatArea(area) }) })
        } else if (mode === 'height' && points.length === 2) {
          add({
            polyline: {
              positions: points,
              width: 2,
              material: accent,
              depthFailMaterial: accent.withAlpha(0.3),
            },
          })
          const left = Cesium.Cartographic.fromCartesian(points[0])
          const right = Cesium.Cartographic.fromCartesian(points[1])
          const delta = right.height - left.height
          const horizontal = new Cesium.EllipsoidGeodesic(left, right).surfaceDistance
          const text = t('measure.height', {
            value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m`,
            distance: formatDistance(horizontal),
          })
          label(points[1], text)
          setMeasureInfo({ text })
        } else {
          setMeasureInfo({ text: t('measure.start') })
        }
        descriptor.summary = state.entities.map((entity) => entity.label?.text?.getValue?.()).filter(Boolean).join(' · ')
        vectorRef.current.refresh(descriptor)
      }

      //#region Agent overlays (annotations + measurements) ---------------------
      // Overlays the Agent asked for live in their own entity lists: they do not
      // mix with the user's measuring tool, can be cleared as one group from the
      // Data menu, and status reports how much of them is currently drawn.
      const agentOverlayRef = React.useRef({
        draw: [],
        measure: [],
        drawnFeatures: 0,
        measuredCount: 0,
        // The commands themselves are kept so a remounted panel can redraw them.
        drawCommands: [],
        measureCommands: [],
        // Entities per command (WeakMap keeps snapshots JSON-clean).
        entityGroups: new WeakMap(),
      })
      const [agentOverlayCount, setAgentOverlayCount] = React.useState(0)

      const syncAgentOverlayCount = () => {
        const state = agentOverlayRef.current
        setAgentOverlayCount(state.draw.length + state.measure.length)
      }

      // Local vector import (file picker or drop on the globe): draw through the
      // same overlay renderer as earth_draw, then refresh counts/snapshot state.
      const importVectorData = (parsed, name) => {
        try {
          runVectorImport(agentOverlayRef.current, viewerRef.current, () => drawAgentOverlay(cesiumRef.current, viewerRef.current, parsed.geojson, 'accent', `GeoJSON: ${name}`))
          syncAgentOverlayCount()
          markSceneDirty()
          saveSceneSnapshot(true)
          if (parsed?.bbox) flyToBbox(viewerRef.current, cesiumRef.current, parsed.bbox)
          showToast([t('layers.imported', { name, n: parsed.featureCount }), ...(parsed.warnings ?? []).map((key) => t(key))].join(' · '))
        } catch (error) {
          showToast(t('layers.importFailed', { message: vectorErrorText(error, t) }))
        }
      }

      // Clear/remove helpers live in src/client/scene/agent-overlays.js.
      const clearAgentOverlays = (kind = 'all') => {
        clearAgentOverlaysInState(agentOverlayRef.current, viewerRef.current, kind)
        syncAgentOverlayCount()
        markSceneDirty()
        saveSceneSnapshot(true)
      }

      const AGENT_OVERLAY_COLORS = VECTOR_COLORS

      const agentOverlayColor = (Cesium, style) => {
        const css = AGENT_OVERLAY_COLORS[style] ?? AGENT_OVERLAY_COLORS.accent
        try {
          return Cesium.Color.fromCssColorString(css)
        } catch {
          return Cesium.Color.DODGERBLUE
        }
      }

      /** Surface height at a lon/lat when terrain is loaded, otherwise 0. */
      const agentSurfaceHeight = (Cesium, viewer, lon, lat) => {
        try {
          const height = viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lon, lat))
          if (Number.isFinite(height)) return height
        } catch {
          // No terrain provider: the ellipsoid surface is height 0.
        }
        return 0
      }

      const agentLabelText = (text, value) =>
        typeof text === 'string' && text !== '' ? text : typeof value === 'string' ? value : ''

      /** Add a result label anchored on a ground point. */
      const addAgentGroundLabel = (Cesium, add, lon, lat, text) =>
        add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          label: vectorLabel(Cesium, text, {
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          }),
        })

      /**
       * Draw a host-validated GeoJSON FeatureCollection. Every annotation is
       * ground-draped so it stays visible on terrain and imagery; optional
       * GeoJSON heights are therefore ignored here (measurements keep them).
       */
      function drawAgentOverlay(Cesium, viewer, geojson, style, caption) {
        const state = agentOverlayRef.current
        const firstEntity = state.draw.length
        const color = agentOverlayColor(Cesium, style)
        const byType = { points: 0, lines: 0, polygons: 0 }
        const bbox = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }
        let drawn = 0
        let descriptor = null
        const add = (options) => {
          const entity = vectorRef.current.add(options, descriptor)
          state.draw.push(entity)
          return entity
        }
        const track = (coordinates) => {
          if (Array.isArray(coordinates)) {
            if (typeof coordinates[0] === 'number' && coordinates.length >= 2) {
              const [lon, lat] = coordinates
              if (Number.isFinite(lon) && Number.isFinite(lat)) {
                bbox.west = Math.min(bbox.west, lon)
                bbox.south = Math.min(bbox.south, lat)
                bbox.east = Math.max(bbox.east, lon)
                bbox.north = Math.max(bbox.north, lat)
              }
            } else {
              for (const item of coordinates) track(item)
            }
          }
        }
        const flat2d = (positions) => {
          // Cesium's fromDegreesArray takes lon/lat pairs; optional heights are
          // dropped on purpose here because these primitives are ground-draped.
          const flat = []
          for (const position of positions) {
            if (!Array.isArray(position) || position.length < 2) continue
            flat.push(position[0], position[1])
          }
          return flat
        }
        const nameOf = (properties) => {
          const name = properties?.name
          return typeof name === 'string' && name.trim() !== '' ? name.trim() : ''
        }
        const drawLine = (coordinates, name) => {
          if (!Array.isArray(coordinates) || coordinates.length < 2) return
          add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(flat2d(coordinates)),
              width: 3,
              material: color,
              depthFailMaterial: color.withAlpha(0.55),
              clampToGround: true,
            },
          })
          byType.lines += 1
          drawn += 1
          track(coordinates)
          if (name !== '') {
            const middle = coordinates[Math.floor(coordinates.length / 2)]
            addAgentGroundLabel(Cesium, add, middle[0], middle[1], name)
          }
        }
        const drawPolygon = (rings, name) => {
          if (!Array.isArray(rings) || rings.length === 0 || !Array.isArray(rings[0])) return
          const outer = Cesium.Cartesian3.fromDegreesArray(flat2d(rings[0]))
          if (outer.length < 3) return
          const holes = rings.slice(1).map((ring) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat2d(ring))))
          add({ polygon: { hierarchy: new Cesium.PolygonHierarchy(outer, holes), material: color.withAlpha(0.26), outline: false, perPositionHeight: false } })
          // Ground polygons do not draw an outline reliably, so trace the rings.
          for (const ring of rings) {
            if (!Array.isArray(ring) || ring.length < 2) continue
            const closed = ring.slice()
            const first = closed[0]
            const last = closed[closed.length - 1]
            if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first)
            add({
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(flat2d(closed)),
                width: 2,
                material: color,
                depthFailMaterial: color.withAlpha(0.55),
                clampToGround: true,
              },
            })
          }
          byType.polygons += 1
          drawn += 1
          for (const ring of rings) track(ring)
          if (name !== '') {
            let lon = 0
            let lat = 0
            for (const position of rings[0]) {
              lon += position[0]
              lat += position[1]
            }
            addAgentGroundLabel(Cesium, add, lon / rings[0].length, lat / rings[0].length, name)
          }
        }
        const drawPoint = (coordinates, name) => {
          if (!Array.isArray(coordinates) || coordinates.length < 2) return
          add({
            position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
            point: {
              pixelSize: 11,
              color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
          byType.points += 1
          drawn += 1
          track(coordinates)
          if (name !== '') addAgentGroundLabel(Cesium, add, coordinates[0], coordinates[1], name)
        }
        const drawGeometry = (geometry, properties) => {
          if (geometry === null || typeof geometry !== 'object') return
          const label = agentLabelText(nameOf(properties), caption)
          descriptor = { group: {}, kind: t('layers.vectorDrawn'), title: label || t('layers.vectorDrawn'), summary: t(`vector.geometry.${geometry.type.replace('Multi', '')}`),
            rows: Object.entries(properties ?? {}).filter(([key]) => key !== 'name').slice(0, 12).map(([key, value]) => [key, formatValue(value)]) }
          switch (geometry.type) {
            case 'GeometryCollection':
              for (const child of geometry.geometries ?? []) drawGeometry(child, properties)
              break
            case 'Point':
              drawPoint(geometry.coordinates, label)
              break
            case 'MultiPoint':
              for (const position of geometry.coordinates ?? []) drawPoint(position, label)
              break
            case 'LineString':
              drawLine(geometry.coordinates, label)
              break
            case 'MultiLineString':
              for (const line of geometry.coordinates ?? []) drawLine(line, label)
              break
            case 'Polygon':
              drawPolygon(geometry.coordinates, label)
              break
            case 'MultiPolygon':
              for (const polygon of geometry.coordinates ?? []) drawPolygon(polygon, label)
              break
            default:
              break
          }
        }
        const features = Array.isArray(geojson?.features) ? geojson.features : []
        for (const feature of features) {
          if (feature?.geometry?.type === 'GeometryCollection') {
            for (const child of feature.geometry.geometries ?? []) {
              drawGeometry(child, feature.properties)
            }
          } else {
            drawGeometry(feature?.geometry, feature?.properties)
          }
        }
        state.drawnFeatures += drawn
        if (drawn > 0) {
          const command = {
            geojson,
            style,
            drawn,
            ...(typeof caption === 'string' && caption !== '' ? { caption } : {}),
          }
          state.entityGroups.set(command, state.draw.slice(firstEntity))
          state.drawCommands.push(command)
          markSceneDirty()
        }
        syncAgentOverlayCount()
        const rounded = (value, digits = 6) => Math.round(value * 10 ** digits) / 10 ** digits
        const hasBox = Number.isFinite(bbox.west) && Number.isFinite(bbox.east)
        return {
          drawn,
          by_type: byType,
          bbox: hasBox
            ? { west: rounded(bbox.west), south: rounded(bbox.south), east: rounded(bbox.east), north: rounded(bbox.north) }
            : null,
        }
      }

      /** Compute and (by default) draw a measurement; returns structured values. */
      function measureAgentOverlay(Cesium, viewer, args) {
        const state = agentOverlayRef.current
        const firstEntity = state.measure.length
        const mode = args.mode
        const points = Array.isArray(args.points) ? args.points : []
        const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits
        if (points.length < 2) throw new Error(t('agent.badMeasure', { message: 'need at least 2 points' }))
        const located = points.map((position) => {
          const lon = position[0]
          const lat = position[1]
          const height = Number.isFinite(position[2]) ? position[2] : agentSurfaceHeight(Cesium, viewer, lon, lat)
          return { lon, lat, height }
        })
        const ground = located.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 0))
        const draw = args.draw !== false
        const color = Cesium.Color.fromCssColorString(VECTOR_COLORS.accent)
        const descriptor = { group: {}, kind: t('layers.vectorMeasured'), title: t(`tool.${mode}`), summary: '' }
        const add = (options) => {
          const entity = vectorRef.current.add(options, descriptor)
          state.measure.push(entity)
          return entity
        }
        const dot = (lon, lat, height) =>
          add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
            point: {
              pixelSize: 8,
              color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
        const result = { mode, points: points.length, drawn: draw }
        if (mode === 'distance') {
          const distance = geodesicLength(Cesium, ground)
          result.distance_m = round(distance)
          result.distance_km = round(distance / 1000, 4)
          if (draw) {
            for (const point of located) dot(point.lon, point.lat, point.height)
            add({
              polyline: {
                positions: ground,
                width: 3,
                material: color,
                depthFailMaterial: color.withAlpha(0.55),
                clampToGround: true,
              },
            })
            const last = located[located.length - 1]
            addAgentGroundLabel(Cesium, add, last.lon, last.lat, t('measure.total', { value: formatDistance(distance) }))
          }
        } else if (mode === 'area') {
          if (points.length < 3) throw new Error(t('agent.badMeasure', { message: 'area needs at least 3 points' }))
          const area = planarArea(Cesium, ground)
          const perimeter = geodesicLength(Cesium, [...ground, ground[0]])
          result.area_m2 = round(area)
          result.area_km2 = round(area / 1e6, 6)
          result.perimeter_m = round(perimeter)
          if (draw) {
            add({ polygon: { hierarchy: new Cesium.PolygonHierarchy(ground), material: color.withAlpha(0.28), outline: false, perPositionHeight: false } })
            add({
              polyline: {
                positions: [...ground, ground[0]],
                width: 3,
                material: color,
                depthFailMaterial: color.withAlpha(0.55),
                clampToGround: true,
              },
            })
            let lon = 0
            let lat = 0
            for (const point of located) {
              lon += point.lon
              lat += point.lat
            }
            addAgentGroundLabel(Cesium, add, lon / located.length, lat / located.length, t('measure.areaLabel', { value: formatArea(area) }))
          }
        } else if (mode === 'height') {
          if (points.length !== 2) throw new Error(t('agent.badMeasure', { message: 'height needs exactly 2 points' }))
          const from = located[0]
          const to = located[1]
          const delta = to.height - from.height
          const horizontal = new Cesium.EllipsoidGeodesic(
            Cesium.Cartographic.fromDegrees(from.lon, from.lat, from.height),
            Cesium.Cartographic.fromDegrees(to.lon, to.lat, to.height),
          ).surfaceDistance
          const slope = horizontal > 0 ? (Math.atan2(delta, horizontal) * 180) / Math.PI : 0
          result.height_m = round(delta)
          result.height_from_m = round(from.height)
          result.height_to_m = round(to.height)
          result.horizontal_m = round(horizontal)
          result.slope_deg = round(slope, 2)
          if (draw) {
            for (const point of located) dot(point.lon, point.lat, point.height)
            add({
              polyline: {
                positions: located.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height)),
                width: 3,
                material: color,
                depthFailMaterial: color.withAlpha(0.55),
              },
            })
            add({ position: Cesium.Cartesian3.fromDegrees(to.lon, to.lat, to.height), label: vectorLabel(Cesium,
              t('measure.height', { value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m`, distance: formatDistance(horizontal) })) })
          }
        } else {
          throw new Error(t('agent.badMeasure', { message: `unsupported mode ${String(mode)}` }))
        }
        // `measured_points` counts what is currently drawn, matching the entity
        // count in `overlays`; a numeric-only measurement adds no overlay.
        if (draw) {
          state.measuredCount += points.length
          const command = { mode, points, draw: true, result }
          state.entityGroups.set(command, state.measure.slice(firstEntity))
          state.measureCommands.push(command)
          markSceneDirty()
        }
        syncAgentOverlayCount()
        descriptor.summary = state.measure.slice(firstEntity).map((entity) => entity.label?.text?.getValue?.()).filter(Boolean).join(' · ')
        vectorRef.current.refresh(descriptor)
        return result
      }
      //#endregion Agent overlays

      //#region analysis engine ---------------------------------------------------
      // The engine (profile / flood / sunlight, entity lifecycle, shadow restore) is
      // its own module now; this component only wires it to the live scene refs and
      // keeps the same two entry points the rest of the panel calls.
      const analysisEngine = createAnalysisEngine({
        getCesium: () => cesiumRef.current,
        getViewer: () => viewerRef.current,
        getLayers: () => layersRef.current,
        findLayer,
        state: analysisRef,
        commandRef: analysisCommandRef,
        setAnalysis,
        addEntity: (options, descriptor) => vectorRef.current.add(options, descriptor),
        markSceneDirty: () => markSceneDirty(),
        t,
      })
      const clearAnalysis = () => analysisEngine.clear()
      const analyzeCommand = (args = {}) => analysisEngine.command(args)
      const profileTool = createProfileTool({
        getCesium: () => cesiumRef.current, getViewer: () => viewerRef.current, pickSurface, setTool: setToolMode, runAnalysis: analyzeCommand, showToast, t,
      })
      profileToolRef.current = profileTool
      //#endregion analysis engine

      //#region shader engine ----------------------------------------------------
      // The preset engine (apply / reset / list, u_time tick, per-layer original
      // shader) is its own module; the component only wires it to the scene refs.
      const shaderEngine = createShaderEngine({
        getCesium: () => cesiumRef.current,
        getViewer: () => viewerRef.current,
        getLayers: () => layersRef.current,
        findLayer,
        entries: shaderEntriesRef,
        tickRef: shaderTickRef,
        setShaderActive: (list) => {
          setShaderActive(list)
          markSceneDirty()
        },
      })
      const shaderCommand = (args = {}) => shaderEngine.command(args)
      const shaderActiveList = () => shaderEngine.activeList()
      const detachShaderForLayer = (id, restore) => shaderEngine.detachForLayer(id, restore)
      const releaseShaderTick = () => shaderEngine.releaseTick()
      //#endregion shader engine

      //#region scene snapshot ---------------------------------------------------
      // Camera, layers (by their original source) and Agent overlays survive the
      // tab body being disposed: they are written to localStorage per session and
      // rebuilt into the next viewer. Writes are debounced through a dirty flag
      // plus a short timer, and flushed synchronously on unmount/page hide.
      const sceneDirtyRef = React.useRef(false)
      const restoringRef = React.useRef(false)
      // Whether a restore decision was already made for this mount; a session id
      // that arrives after the viewer is ready gets exactly one late restore.
      const sceneRestoredRef = React.useRef(false)
      // Host/local snapshot store lives in src/client/scene/host-scene-store.js;
      // this component keeps the refs and re-exports the same three names.
      const hostSceneStore = createHostSceneStore({
        getMeta: () => metaRef.current,
        loadMeta,
        normalizeSceneSnapshot,
        readSceneSnapshot,
        writeSceneSnapshot,
      })
      const { readHostSceneSnapshot, saveHostSceneSnapshot, loadSceneSnapshot } = hostSceneStore

      const markSceneDirty = () => {
        sceneDirtyRef.current = true
      }

      /** Everything needed to rebuild this panel's scene in a later mount. */
      const currentSceneSnapshot = () => {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return null
        const carto = viewer.camera.positionCartographic
        const round = (value) => Math.round(value * 1e6) / 1e6
        return {
          view: {
            lon: round(Cesium.Math.toDegrees(carto.longitude)),
            lat: round(Cesium.Math.toDegrees(carto.latitude)),
            height: Math.round(carto.height),
            heading: Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0)),
            pitch: Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0)),
          },
          layers: layersRef.current
            .filter(
              (layer) =>
                layer.source !== null &&
                typeof layer.source === 'object' &&
                (typeof layer.source.path === 'string' || typeof layer.source.url === 'string'),
            )
            .map((layer) => ({ name: layer.name, source: layer.source, visible: layer.visible !== false })),
          annotations: {
            draw: agentOverlayRef.current.drawCommands,
            measure: agentOverlayRef.current.measureCommands,
          },
          analysis: analysisCommandRef.current,
          shaders: [...shaderEntriesRef.current.values()].map((entry) => ({
            layer: entry.layerName,
            preset: entry.preset,
            params: { ...entry.params },
          })),
        }
      }

      /** Persist the current scene locally and hand the body to the host store. */
      const saveSceneSnapshot = (forceHost = false) => {
        if (restoringRef.current) return
        const session = sessionRef.current
        if (typeof session !== 'string' || session === '') return
        try {
          const snapshot = currentSceneSnapshot()
          if (snapshot === null) return
          const body = writeSceneSnapshot(session, snapshot)
          if (body !== null) saveHostSceneSnapshot(session, body, forceHost)
          sceneDirtyRef.current = false
        } catch {
          // Persistence must never take the panel down.
        }
      }

      /**
       * A saved layer may point at a folder the host no longer serves, or a remote
       * URL whose request never settles. Restoring must never keep the panel behind
       * the loading overlay, so every layer load is raced against a timeout and the
       * restore itself runs after the panel is already interactive.
       */
      const RESTORE_LAYER_TIMEOUT_MS = 8000
      const restoreTimedOut = Symbol('restore-timeout')
      const withRestoreTimeout = (promise, ms = RESTORE_LAYER_TIMEOUT_MS) =>
        Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(restoreTimedOut), ms))])

      /** Rebuild a saved scene into the freshly created viewer. Best effort per item. */
      async function restoreSceneSnapshot(snapshot) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer || snapshot === null) return
        restoringRef.current = true
        setRestoringScene(snapshot.layers.length > 0)
        try {
          // Camera first: the saved viewpoint is local data, so applying it before
          // any network load makes the restore feel immediate and avoids snapping
          // the camera back after the user has already started moving it.
          if (snapshot.view !== null) {
            viewer.camera.setView({
              destination: Cesium.Cartesian3.fromDegrees(snapshot.view.lon, snapshot.view.lat, snapshot.view.height),
              orientation: {
                heading: Cesium.Math.toRadians(snapshot.view.heading),
                pitch: Cesium.Math.toRadians(snapshot.view.pitch),
                roll: 0,
              },
            })
          }
          let timedOut = false
          for (const item of snapshot.layers) {
            const source = item.source
            let url = ''
            if (typeof source.path === 'string' && source.path !== '') {
              try {
                url = await withRestoreTimeout(localPathToUrl(source.path), 3000)
              } catch {
                // The folder may not be authorised any more: skip that layer.
                continue
              }
              if (url === restoreTimedOut) {
                timedOut = true
                continue
              }
            } else if (typeof source.url === 'string' && /^https?:\/\//i.test(source.url)) {
              url = source.url
            }
            if (url === '') continue
            try {
              const layer = await withRestoreTimeout(loadTileset(url, item.name, source, { fly: false }))
              if (layer === restoreTimedOut) {
                timedOut = true
                continue
              }
              if (item.visible === false) setLayerVisible(layer.id, false)
            } catch {
              // One missing or moved source must not abort the other layers.
            }
          }
          if (timedOut) {
            setBusy('')
            showToast(t('toast.restoreTimeout'))
          }
          for (const command of snapshot.annotations.draw) {
            try {
              drawAgentOverlay(Cesium, viewer, command.geojson, command.style, command.caption)
            } catch {
              // A stale annotation is not worth failing the restore.
            }
          }
          for (const command of snapshot.annotations.measure) {
            try {
              measureAgentOverlay(Cesium, viewer, command)
            } catch {
              // Same for a stale measurement.
            }
          }
          for (const item of snapshot.shaders) {
            try {
              await shaderCommand({ action: 'apply', preset: item.preset, layer: item.layer, ...(item.params ?? {}) })
            } catch {
              // A stale preset (3DGS layer, changed tileset) is skipped.
            }
          }
          if (snapshot.analysis !== null) {
            try {
              await analyzeCommand(snapshot.analysis)
            } catch {
              // The saved analysis may no longer have usable height data.
            }
          }
        } finally {
          restoringRef.current = false
          setRestoringScene(false)
          sceneDirtyRef.current = false
        }
      }
      //#endregion scene snapshot

      function layerLabel(tileset) {
        const found = layersRef.current.find((entry) => entry.tileset === tileset)
        return found ? found.name : t('model.unnamed')
      }

      /** Readable description of the object under a screen position. */
      // Canvas picking / measure click loop lives in src/client/scene/pointer-tools.js.
      const pointerTools = createPointerTools({        getCesium: () => cesiumRef.current,
        getViewer: () => viewerRef.current,
        toolRef,
        measureRef,
        setPickInfo,
        showToast,
        pickSurface,
        redrawMeasure,
        onFinishTool: () => setToolMode(null),
        formatValue,
        layerLabel,
        // "识别模式" route: the click lands in ui/selection-overlay.js.
        onIdentify: (position) => selectionApiRef.current?.(position),
        onProfilePoint: (position) => profileTool.onPoint(position),
        onOverlayClick: (position) => vectorRef.current?.click(position),
        t,
      })
      const { pickResult, pickAt, onCanvasClick } = pointerTools
      const finishMeasure = () => pointerTools.finishMeasure()

      function resetView() {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(104, 31, 14000000),
          // The longest flight in the panel (ground → 14,000 km): give it room
          // instead of the old 1.2 s yank.
          duration: 2.4,
        })
      }

      /** Hide the panel chrome while a clean snapshot is rendered. */
      const setChromeHidden = (hidden) => {
        const root = rootRef.current
        if (root) root.classList.toggle('mv-capturing', hidden)
      }

      // Capture-HUD text painter lives in src/client/scene/capture-hud.js; the
      // refs are injected so this file stays inside its line budget.
      const drawCaptureOverlay = createCaptureHud({
        getViewer: () => viewerRef.current,
        getCesium: () => cesiumRef.current,
        getSources: () => sourcesRef.current,
        getLayers: () => layersRef.current,
        getMeta: () => metaRef.current,
        getReadout: () => captureReadoutRef.current,
        t,
      })

      /** Wait for the next painted frame, but never hang on a hidden tab. */
      const nextFrames = (count) =>
        new Promise((resolve) => {
          let left = count
          const step = () => {
            left -= 1
            if (left <= 0) resolve()
            else requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        })

      // Capture (screenshot / Agent snapshot) lives in src/client/scene/capture.js.
      const capture = createCaptureService({
        getViewer: () => viewerRef.current,
        getRoot: () => rootRef.current,
        getSettings: () => sourcesRef.current,
        getMeta: () => metaRef.current,
        getSession: () => sessionRef.current,
        getCesium: () => cesiumRef.current,
        getLayers: () => layersRef.current,
        t,
        showToast,
        setChromeHidden,
        nextFrames,
        revealPanel,
        drawCaptureOverlay,
        drawVectorLabels: (context, width, height) => vectorRef.current?.drawLabels(context, width, height),
      })
      const { renderSnapshot, screenshot, captureScene } = capture

      // v1.7 P0 "指认": card data (pick + neighbour ring sampler) and the
      // evidence pack. React state stays in ui/selection-overlay.js.
      const selectionController = React.useMemo(() => createSelectionController({
        getViewer: () => viewerRef.current,
        getCesium: () => cesiumRef.current,
        getLayers: () => layersRef.current,
        getMeta: () => metaRef.current,
      }), [])

      /** "量一下" from the selection card: pre-fill the first height point. */
      function measureFromSelection(anchor) {
        if (!anchor) return
        // setToolMode clears the previous measurement, so seed the point AFTER it.
        setToolMode('height')
        measureRef.current.points = [anchor]
        redrawMeasure('height')
      }

      // v1.7 P0 tour: bookmark stops play through the panel (captions + flights +
      // take-over); the Agent's six tools are untouched.
      const tour = useTour({
        t,
        showToast,
        getCurrentView: () => currentSceneSnapshot()?.view ?? null,
        onFlyView: (view) => flyToBookmark(viewerRef.current, cesiumRef.current, view),
        onFinish: () => void screenshot(),
      })
      // Dedicated scene-details card (whole scene or one layer) instead of
      // inlining camera telemetry into the long, narrow layer list.
      const sceneDetails = useSceneDetails({ t, stats, config: sources, layers, analysis, shaderActive })

      /**
       * "Ask Agent": capture the current scene as context and inject it into the
       * live conversation, so the user can simply type the follow-up question.
       * Injection never wakes an idle agent; the context lands on the next step.
       */
      // "Ask Agent" lives in src/client/scene/ask-agent.js.
      const askAgentService = createAskAgent({
        getMeta: () => metaRef.current,
        getSession: () => sessionRef.current,
        getAnalysis: () => analysis,
        getSelection: () => peekSelection(viewerRef.current),
        showToast,
        t,
        captureScene,
        collectSceneStatus,
        shaderActiveList,
        message,
      })
      const askAgent = () => askAgentService.askAgent()

      /**
       * Build a scene report (self-contained HTML or Markdown) from the live
       * scene: camera, layers, basemap/terrain, Agent overlays and measured
       * values, the active analysis, shader presets and a best-effort snapshot.
       */
      // The scene report builder lives in src/client/scene/report.js.
      const sceneReport = createSceneReport({
        getSession: () => sessionRef.current,
        getAgentOverlays: () => agentOverlayRef.current,
        getAnalysis: () => analysis,
        captureScene,
        collectSceneStatus,
        shaderActiveList,
        formatDistance,
        formatArea,
        escapeHtml,
        arrayBufferToBase64,
        isChinese,
        message,
      })
      const buildSceneReport = (args = {}) => sceneReport.buildSceneReport(args)

      function setLayerVisible(id, visible) {
        const layer = layersRef.current.find((item) => item.id === id)
        if (!layer) return null
        if (!visible) detachShaderForLayer(id, true) // hiding a layer ends its visual effect
        layer.visible = visible
        layer.tileset.show = visible
        syncLayers()
        saveSceneSnapshot(true)
        return layer
      }

      function toggleLayer(id) {
        const layer = layersRef.current.find((item) => item.id === id)
        if (!layer) return
        setLayerVisible(id, !layer.visible)
      }

      // Only exact ids or exact (case-insensitive) names resolve, so a destructive
      // remove/visibility command can never hit a different layer by substring.
      function findLayer(token) {
        if (typeof token !== 'string' || token.trim() === '') return null
        const value = token.trim()
        const byId = layersRef.current.find((layer) => layer.id === value)
        if (byId) return byId
        const lowered = value.toLowerCase()
        return layersRef.current.find((layer) => layer.name.toLowerCase() === lowered) ?? null
      }

      function flyToLayer(id) {
        const layer = layersRef.current.find((item) => item.id === id)
        const viewer = viewerRef.current
        const Cesium = cesiumRef.current
        if (!layer || !viewer) return
        // Distance-adaptive so flying to a province does not look like a cut.
        const center = layer.tileset?.boundingSphere?.center
        const distance = Cesium && center ? Cesium.Cartesian3.distance(viewer.camera.positionWC, center) : 0
        viewer.flyTo(layer.tileset, { duration: flightDuration(distance) })
      }

      // ---- L3 raster overlays: the panel edits the catalog, then one sync()
      // reconciles the live stack. Persisting first keeps sources.json and the
      // rendered stack from diverging if the provider call fails.
      function persistOverlays(next) {
        const current = sourcesRef.current
        if (!current) return
        commitSources({ ...current, rasterOverlays: next })
      }

      function overlayCatalog() {
        return Array.isArray(sourcesRef.current?.rasterOverlays) ? sourcesRef.current.rasterOverlays : []
      }

      function addOverlay(draft) {
        const next = [...overlayCatalog(), { ...draft, id: `overlay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }]
        persistOverlays(next)
        void overlayLayersRef.current?.sync(next).catch(() => {})
      }

      function removeOverlay(id) {
        const next = overlayCatalog().filter((item) => item.id !== id)
        persistOverlays(next)
        void overlayLayersRef.current?.sync(next).catch(() => {})
      }

      function setOverlayOpacity(id, opacity) {
        persistOverlays(overlayCatalog().map((item) => (item.id === id ? { ...item, opacity } : item)))
        void overlayLayersRef.current?.setOpacity(id, opacity)
      }

      function setOverlayVisible(id, visible) {
        persistOverlays(overlayCatalog().map((item) => (item.id === id ? { ...item, visible } : item)))
        void overlayLayersRef.current?.setVisible(id, visible)
      }

      function moveOverlay(id, delta) {
        const list = [...overlayCatalog()]
        const index = list.findIndex((item) => item.id === id)
        const target = index + delta
        if (index < 0 || target < 0 || target >= list.length) return
        const [item] = list.splice(index, 1)
        list.splice(target, 0, item)
        persistOverlays(list)
        void overlayLayersRef.current?.sync(list).catch(() => {})
      }

      function removeLayer(id) {
        const viewer = viewerRef.current
        const index = layersRef.current.findIndex((item) => item.id === id)
        if (index < 0 || !viewer) return null
        // An analysis that targeted this layer loses its data source: clear it
        // before the tileset detaches so the card never points at a removed layer.
        if (analysisRef.current.layerId === id) clearAnalysis()
        // B3: a removed layer must not keep a dangling shader entry (or the u_time
        // tick alive); no restore is needed because the tileset is being detached.
        detachShaderForLayer(id, false)
        const [layer] = layersRef.current.splice(index, 1)
        try {
          viewer.scene.primitives.remove(layer.tileset)
        } catch {
          /* already detached */
        }
        syncLayers()
        saveSceneSnapshot(true)
        return layer
      }

      function collectStats() {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return null
        const layerRows = layersRef.current.map((layer) => {
          const statistics = layer.tileset.statistics ?? {}
          return {
            id: layer.id,
            name: layer.name,
            tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded,
            pending: statistics.numberOfPendingRequests,
            triangles: statistics.numberOfTrianglesSelected,
            memory: layer.tileset.cacheBytes ?? layer.tileset.totalMemoryUsageInBytes,
          }
        })
        const heading = Cesium.Math.toDegrees(viewer.camera.heading ?? 0)
        const pitch = Cesium.Math.toDegrees(viewer.camera.pitch ?? 0)
        return {
          height: formatHeight(viewer.camera.positionCartographic.height),
          heading: `${heading.toFixed(0)}°`,
          pitch: `${pitch.toFixed(0)}°`,
          layers: layerRows,
        }
      }

      /** The original source behind a layer, for the Host inspector. */
      function sourceOfLayer(layer) {
        if (layer?.source) return layer.source
        if (typeof layer?.url === 'string' && /^https?:\/\//i.test(layer.url)) {
          return { kind: 'remote', url: layer.url }
        }
        return null
      }

      /** Runtime counters merged into the Host report when the panel is online. */
      function layerRuntime(layer) {
        const statistics = layer?.tileset?.statistics ?? {}
        const memory = layer?.tileset?.cacheBytes ?? layer?.tileset?.totalMemoryUsageInBytes
        return {
          tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded ?? 0,
          pending: statistics.numberOfPendingRequests ?? 0,
          triangles: statistics.numberOfTrianglesSelected ?? 0,
          memory: typeof memory === 'number' ? memory : 0,
        }
      }

      /** Run the Host data-health inspector for one loaded layer. */
      async function inspectLayer(layerId) {
        const layer = layersRef.current.find((entry) => entry.id === layerId)
        if (!layer) return
        const source = sourceOfLayer(layer)
        if (!source) {
          showToast(t('health.noSource'))
          return
        }
        const meta = metaRef.current
        if (!meta?.token || (!meta.inspectUrl && !meta.scanUrl)) {
          showToast(t('health.failed', { message: t('agent.notReady') }))
          return
        }
        const endpoint = meta.inspectUrl ?? `${meta.scanUrl.replace(/\/scan$/, '')}/inspect`
        const requestSeq = healthSeqRef.current + 1
        healthSeqRef.current = requestSeq
        setHealth({ loading: true, layer: layer.name, source })
        try {
          const response = await fetch(`${endpoint}?token=${encodeURIComponent(meta.token)}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', 'x-dsh-panel': '1' },
            body: JSON.stringify({ source, deep: false, runtime: layerRuntime(layer) }),
          })
          const data = await response.json().catch(() => null)
          // The dialog may have been closed while the Host was analysing; a
          // late answer must not reopen it or toast behind the user's back.
          if (requestSeq !== healthSeqRef.current) return
          if (!response.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${response.status}`)
          setHealth({ loading: false, layer: layer.name, source, report: data.report, reportPath: data.reportPath })
        } catch (error) {
          if (requestSeq !== healthSeqRef.current) return
          setHealth({ loading: false, layer: layer.name, source, error: message(error) })
          showToast(t('health.failed', { message: message(error) }))
        }
      }

      /** Close the health dialog and invalidate any request still in flight. */
      const closeHealth = () => {
        healthSeqRef.current += 1
        setHealth(null)
      }

      async function submitUrl() {
        const value = urlInput.trim()
        if (!value) return
        const target = parseLonLat(value)
        if (target) {
          setUrlBar(false); setUrlInput('')
          return flyToCoordinates(viewerRef.current, cesiumRef.current, target)
        }
        let url = value
        if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')) {
          try {
            url = await localPathToUrl(value)
          } catch (error) {
            showToast(formatScanFailure(t, error))
            return
          }
        } else if (!/^https?:\/\//i.test(value)) {
          showToast(t('toast.invalidUrl'))
          return
        }
        setUrlBar(false)
        setUrlInput('')
        const local = /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')
        const source = local ? { kind: 'local', path: value } : { kind: 'remote', url: value }
        await addTileset(url, value.split(/[\\/]/).filter(Boolean).slice(-2).join('/'), source)
      }

      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const clampNumber = (value, fallback, minimum, maximum) => {
        const number = Number(value)
        if (!Number.isFinite(number)) return fallback
        return Math.min(Math.max(number, minimum), maximum)
      }

      /** Snapshot of what the Agent may ask about: camera, layers, sources. */
      // Scene status lives in src/client/scene/status.js.
      const sceneStatus = createSceneStatus({
        getCesium: () => cesiumRef.current,
        getViewer: () => viewerRef.current,
        getSources: () => sourcesRef.current,
        getLayers: () => layersRef.current,
        getOverlayLayers: () => overlayLayersRef.current,
        getAgentOverlays: () => agentOverlayRef.current,
        getToolMode: () => toolRef.current,
        getFps: () => fps,
        getBusy: () => busy,
        t,
        redactUrl,
        normalizeQuality,
      })
      // Hoisted on purpose: askAgent/report wirings are created earlier in render
      // and pass this function by reference. A `const` here would throw
      // "Cannot access 'collectSceneStatus' before initialization" and blank the
      // whole panel (v1.6 regression, caught by test/v16-wiring-order).
      function collectSceneStatus() {
        return sceneStatus.collectSceneStatus()
      }

      /**
       * The single command dispatcher shared by the Agent bridge and (where it
       * makes sense) the panel UI. Every failure throws a model-readable error.
       */
      // The command dispatcher lives in src/client/scene/command-bridge.js.
      const commandBridge = createCommandBridge({
        getCesium: () => cesiumRef.current,
        getViewer: () => viewerRef.current,
        getSources: () => sourcesRef.current,
        getLayers: () => layersRef.current,
        getMeta: () => metaRef.current,
        getAgentOverlays: () => agentOverlayRef.current,
        t,
        findLayer,
        normalizeAccessRequest,
        askPathAccess,
        collectSceneStatus,
        captureScene,
        redactUrl,
        analyzeCommand,
        shaderCommand,
        message,
        sourceOfLayer,
        layerRuntime,
        localPathToUrl,
        loadTileset,
        removeLayer,
        setLayerVisible,
        applyImagery,
        updateSettings,
        applyTerrain,
        clampNumber,
        delay,
        resetView,
        pickResult,
        clearAgentOverlays,
        drawAgentOverlay,
        measureAgentOverlay,
        buildSceneReport,
      })
      const runCommand = (action, args = {}, session = null) => commandBridge.runCommand(action, args, session)
      commandRef.current = runCommand

      // The bridge connects only inside a Session (the right sidebar tab), never in
      // the immersive main panel, so one Agent never drives two globes at once. It
      // connects as soon as the page metadata exists, so the Host's attach grace is
      // spent on the tab mount rather than on the Cesium cold start; commands then
      // wait for the viewer through `waitForPanelReady`.
      React.useEffect(() => {
        if (!sessionId || !meta?.bridgeUrl) return undefined
        // Everything below is bound to the session that opened this connection:
        // a later sidebar session switch must not re-address in-flight acks.
        const bridgeSession = sessionId
        const endpoint = `${meta.bridgeUrl}?token=${encodeURIComponent(meta.token)}&session=${encodeURIComponent(bridgeSession)}`
        let source
        try {
          source = new EventSource(endpoint)
        } catch {
          return undefined
        }
        let retries = 0
        let retryTimer = null
        const ack = async (body) => {
          try {
            await fetch(`${meta.bridgeUrl}?token=${encodeURIComponent(meta.token)}`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            })
          } catch {
            /* the Host times the command out and reports it to the Agent */
          }
        }
        const onHello = () => {
          retries = 0
          setBridgeReload(false)
          setBridgeOn(true)
        }
        const cancelledIds = new Set()
        let activeCancel = null
        const onCancel = (event) => {
          try {
            const payload = JSON.parse(event.data)
            if (payload?.id) cancelledIds.add(payload.id)
            if (payload?.action === 'authorize' || accessRef.current) settleAccess({ allowed: false, message: t('access.denied') })
            if (activeCancel && (!payload?.id || activeCancel.id === payload.id)) activeCancel.reject(new Error('cancelled'))
          } catch { /* ignore malformed cancel frame */ }
        }
        const onCommand = (event) => {
          let payload
          try { payload = JSON.parse(event.data) } catch { return }
          if (!payload?.id) return
          // Per-command watchdogs: a command that never settles must not wedge later commands.
          const commandBudgets = { capture: 40000, report: 45000, load: 40000 }
          commandChainRef.current = commandChainRef.current
            .then(async () => {
              if (cancelledIds.has(payload.id)) return
              let watchdog = null
              try {
                if (payload.action !== 'authorize') await waitForPanelReady()
                if (cancelledIds.has(payload.id)) return
                const budgetMs = commandBudgets[payload.action] ?? 15000
                const command = commandRef.current(payload.action, payload.args ?? {}, bridgeSession)
                const budget = new Promise((_, reject) => {
                  activeCancel = { id: payload.id, reject }
                  watchdog = setTimeout(
                    () => reject(new Error(t('agent.commandTimeout', { seconds: Math.round(budgetMs / 1000) }))),
                    budgetMs,
                  )
                })
                const result = await Promise.race([command, budget])
                if (!cancelledIds.has(payload.id)) await ack({ session: bridgeSession, id: payload.id, ok: true, result })
              } catch (error) {
                if (!cancelledIds.has(payload.id)) await ack({ session: bridgeSession, id: payload.id, ok: false, error: message(error) })
              } finally {
                activeCancel = null
                if (watchdog !== null) clearTimeout(watchdog)
              }
            })
            .catch(() => {})
        }
        const onError = () => {
          setBridgeOn(false)
          // A host restart rotates the token; refetch meta and reconnect. A long
          // outage can outlive the EventSource retry, so allow four backoff rounds
          // (500ms → 4s) before asking the user to reload.
          if (retries >= 4 || retryTimer !== null) return
          retries += 1
          retryTimer = setTimeout(async () => {
            retryTimer = null
            try {
              const fresh = await loadMeta(true)
              if (!fresh) return
              const changed = fresh.token !== metaRef.current?.token || fresh.bridgeUrl !== metaRef.current?.bridgeUrl
              metaRef.current = fresh
              setMeta(fresh)
              if (changed) setBridgeEpoch((value) => value + 1)
            } catch {
              /* keep the current connection state; the UI already shows it off */
            }
            // Backoff is exhausted: stop retrying quietly and tell the user how
            // to reconnect instead of leaving a misleading "connecting" state.
            if (retries >= 4) setBridgeReload(true)
          }, Math.min(4000, 500 * 2 ** (retries - 1)))
        }
        source.addEventListener('hello', onHello)
        source.addEventListener('command', onCommand)
        source.addEventListener('cancel', onCancel)
        source.addEventListener('error', onError)
        setBridgeOn(false)
        return () => {
          if (retryTimer !== null) clearTimeout(retryTimer)
          source.removeEventListener('hello', onHello)
          source.removeEventListener('command', onCommand)
          source.removeEventListener('cancel', onCancel)
          source.removeEventListener('error', onError)
          try {
            source.close()
          } catch {
            /* already closed */
          }
        }
      }, [sessionId, meta, bridgeEpoch])

      // A panel that goes away must not leave a pending authorisation promise or
      // its cleanup timer behind: settle it as denied so the command chain ends.
      React.useEffect(
        () => () => {
          const current = accessRef.current
          if (!current) return
          accessRef.current = null
          clearTimeout(current.timer)
          current.resolve({ allowed: false, message: t('access.denied') })
        },
        [],
      )

      React.useEffect(() => {
        let cancelled = false
        ;(async () => {
          try {
            const meta = await loadMeta()
            if (cancelled) return
            metaRef.current = meta
            setMeta(meta)
            const [Cesium, catalog] = await Promise.all([loadCesium(), loadSources(meta)])
            await loadCesiumStyle()
            if (cancelled || !globeRef.current) return
            cesiumRef.current = Cesium
            sourcesRef.current = catalog.config
            setSources(catalog.config)
            setDefaults(catalog.defaults)
            const viewer = new Cesium.Viewer(globeRef.current, {
              baseLayer: false,
              animation: false,
              timeline: false,
              baseLayerPicker: false,
              geocoder: false,
              homeButton: false,
              sceneModePicker: false,
              navigationHelpButton: false,
              infoBox: false,
              selectionIndicator: false,
              fullscreenButton: false,
              vrButton: false,
              creditContainer: creditRef.current,
              // `msaaSamples` is a context-creation option, so the tier is read
              // here and applied live by applyQuality() right after construction;
              // switching tiers later re-applies everything except this one.
              msaaSamples: qualityProfile(catalog.config.settings?.quality).msaaSamples,
              // No `preserveDrawingBuffer`: it forces a full-resolution framebuffer
            // copy and disqualifies the compositor fast path on EVERY frame, which
            // is exactly the kind of millisecond that pushes a 60 FPS frame past the
            // 16.7 ms vsync and makes it render at 30. Captures still work because
            // renderSnapshot() calls viewer.render() and reads the canvas in the
            // SAME synchronous task (see renderSnapshot: no await between them) —
            // keep that invariant if you touch either site.
            contextOptions: { webgl: { preserveDrawingBuffer: false } },
            })
            viewerRef.current = viewer
            vectorRef.current = createVectorInteraction({ Cesium, viewer, root: rootRef.current, getTool: () => toolRef.current,
              onSelect: (selection) => { setVectorSelection(selection); if (selection) setPickInfo(null) } })
            viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#060a12')
            // Apply the persisted render tier before the first frame: resolution
            // scale and terrain LOD are the two biggest per-frame costs.
            applyQuality(viewer, catalog.config.settings?.quality)
            viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(104, 31, 14000000) })
            await applyImagery(catalog.config.settings.imagery, false)
            // Terrain metadata can fail or hang (network/proxy); it must not hold the
            // loading overlay. Start it in the background; the switch itself shows a
            // toast and falls back to the ellipsoid on failure.
            if (catalog.config.settings.terrain) void applyTerrain(catalog.config.settings.terrain, false).catch(() => {})
            applyGlobeDepthTest()
            // L3 raster overlays: created after the basemap so the stack order is
            // basemap (index 0) -> overlays (appended above). A failed overlay is a
            // toast, never a panel-wide failure.
            overlayLayersRef.current = createOverlayLayers({
              Cesium,
              viewer,
              // The panel owns the provider mapping; the stack stays browser-free.
              providerFactory: imageryProvider,
              onError: (error, source) =>
                showToast(t('toast.overlayFailed', { name: source?.name ?? '', message: message(error) })),
            })
            try {
              await withNetworkTimeout(overlayLayersRef.current.sync(catalog.config.rasterOverlays ?? []), 10000)
            } catch {
              // A hung overlay provider keeps syncing in the background; the panel
              // becomes ready and the failed overlay reports itself through onError.
            }
            const handler = installCanvasInput({
              Cesium,
              viewer,
              getViewer: () => viewerRef.current,
              getTool: () => toolRef.current,
              onCanvasClick,
              finishMeasure,
              sampleCursor,
              flyToCartographic,
              isSelectionActive: () => isSelectionActive(viewerRef.current),
              onCancelProfile: () => profileTool.cancel(),
            })
            handlerRef.current = handler
            // A camera move is the most frequent scene change: mark it dirty and
            // let the short timer batch the localStorage write.
            viewer.camera.moveEnd.addEventListener(markSceneDirty)
            // Rebuild the scene this session had when its tab body was disposed;
            // commands wait for this so they cannot race the restored camera. The
            // host store is tried first (it survives origin changes), then the
            // localStorage cache.
            const savedScene = typeof sessionId === 'string' && sessionId !== '' ? await loadSceneSnapshot(sessionId) : null
            // Mark the restore decision before phase becomes ready so the late-restore
            // effect does not start a second one. The restore itself runs in the
            // background: a stale or hanging layer load must never keep the loading
            // overlay up (each layer load is timeout-guarded inside restore).
            sceneRestoredRef.current = typeof sessionId === 'string' && sessionId !== ''
            settleReadyWaiters()
            setPhase('ready')
            if (savedScene !== null && !cancelled) {
              void restoreSceneSnapshot(savedScene).catch(() => {})
            }
          } catch (error) {
            if (!cancelled) {
              settleReadyWaiters(error instanceof Error ? error : new Error(String(error)))
              setError(message(error))
              setPhase('error')
            }
          }
        })()
        return () => {
          cancelled = true
          // Capture the last scene before the viewer is destroyed.
          saveSceneSnapshot(true)
          readyGateRef.current.ready = false
          settleReadyWaiters(new Error(t('agent.notReady')))
          clearTimeout(toastTimer.current)
          try {
            handlerRef.current?.destroy()
          } catch {
            /* ignore */
          }
          handlerRef.current = null
          disposeSelection(viewerRef.current)
          profileToolRef.current?.dispose()
          // B3: detach the u_time tick and forget per-layer shader entries before
          // the viewer goes away; the tilesets themselves are destroyed with it.
          releaseShaderTick()
          shaderEntriesRef.current.clear()
          // Drop the L3 overlay layers with the viewer; the queued removals are
          // no-ops if the scene is already gone.
          void overlayLayersRef.current?.dispose()
          overlayLayersRef.current = null
          vectorRef.current?.dispose()
          vectorRef.current = null
          try {
            viewerRef.current?.destroy()
          } catch {
            /* ignore */
          }
          viewerRef.current = null
          layersRef.current = []
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      // A tab body can mount before its session id is known; restore once the
      // viewer is ready and the id arrives (the normal path restores inside the
      // init effect and leaves this no-op).
      React.useEffect(() => {
        if (phase !== 'ready' || sceneRestoredRef.current) return undefined
        if (typeof sessionId !== 'string' || sessionId === '') return undefined
        sceneRestoredRef.current = true
        let cancelled = false
        void (async () => {
          const snapshot = await loadSceneSnapshot(sessionId)
          if (!cancelled && snapshot !== null) await restoreSceneSnapshot(snapshot)
        })().catch(() => {})
        return () => {
          cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [phase, sessionId])

      // Debounced scene persistence: camera moves and layer/overlay changes set
      // the dirty flag, this timer writes at most every few seconds. pagehide and
      // visibilitychange flush before the tab body is disposed or the window hides.
      React.useEffect(() => {
        const timer = setInterval(() => {
          if (sceneDirtyRef.current) saveSceneSnapshot()
        }, 3000)
        const flush = () => {
          if (sceneDirtyRef.current) saveSceneSnapshot(true)
        }
        const onVisibility = () => {
          if (document.visibilityState === 'hidden') flush()
        }
        window.addEventListener('pagehide', flush)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          clearInterval(timer)
          window.removeEventListener('pagehide', flush)
          document.removeEventListener('visibilitychange', onVisibility)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      React.useEffect(() => {
        if (!openMenu) return undefined
        const close = (event) => {
          if (!menuRef.current?.contains(event.target)) setOpenMenu(null)
        }
        document.addEventListener('pointerdown', close, true)
        return () => document.removeEventListener('pointerdown', close, true)
      }, [openMenu])

      // The recent-folder list is Host state, so fetch it when the menu opens rather
      // than at panel start: a closed menu costs no request, an open one is current.
      React.useEffect(() => {
        if (openMenu === 'data' || showLayers) refreshRecentDirs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [openMenu, showLayers, meta?.directoriesUrl])

      React.useEffect(() => {
        if (phase !== 'ready') return undefined
        const element = globeRef.current
        if (!element || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => {
          try {
            viewerRef.current?.resize()
          } catch {
            /* ignore */
          }
        })
        observer.observe(element)
        return () => observer.disconnect()
      }, [phase])

      // Fullscreen is owned by the browser: Esc, F11 and the OS can leave it
      // without going through our button, so the toolbar state follows
      // `fullscreenchange` (and the canvas is resized once layout settles).
      React.useEffect(() => {
        const onChange = () => {
          setFullscreen(document.fullscreenElement === rootRef.current)
          try {
            viewerRef.current?.resize()
          } catch {
            /* ignore */
          }
        }
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
      }, [])

      React.useEffect(() => {
        if (phase !== 'ready') return undefined
        const viewer = viewerRef.current
        if (!viewer) return undefined
        const scene = viewer.scene
        const canvas = scene.canvas
        // Count REAL Cesium render passes (`scene.postRender`), not window
        // requestAnimationFrame callbacks: rAF fires per compositor vsync even
        // when the scene did not render (hidden tab, lost context, render mode),
        // so an rAF counter reports the browser cadence, not scene throughput.
        let frames = 0
        let last = performance.now()
        let lastFrameAt = last
        let ema = 0
        let lost = false
        const onFrame = () => {
          frames += 1
          lastFrameAt = performance.now()
        }
        const onLost = () => {
          lost = true
          frames = 0
          ema = 0
        }
        const onRestored = () => {
          lost = false
          frames = 0
          last = performance.now()
        }
        scene.postRender.addEventListener(onFrame)
        canvas.addEventListener('webglcontextlost', onLost)
        canvas.addEventListener('webglcontextrestored', onRestored)
        const timer = setInterval(() => {
          const now = performance.now()
          const elapsed = now - last
          // No render pass for two seconds (hidden panel, lost context, destroyed
          // viewer) is IDLE, not 0 fps: the HUD shows a dash instead of a fake 0.
          const idle = lost || document.visibilityState === 'hidden' || now - lastFrameAt > 2000
          if (idle) {
            frames = 0
            last = now
            ema = 0
            setFps((previous) => (previous === null ? previous : null))
            return
          }
          const instant = elapsed > 0 ? (frames * 1000) / elapsed : 0
          frames = 0
          last = now
          ema = ema === 0 ? instant : ema * 0.8 + instant * 0.2
          const value = Math.round(ema)
          setFps((previous) => (previous === value ? previous : value))
        }, 500)
        return () => {
          clearInterval(timer)
          scene.postRender.removeEventListener(onFrame)
          canvas.removeEventListener('webglcontextlost', onLost)
          canvas.removeEventListener('webglcontextrestored', onRestored)
        }
      }, [phase])

      React.useEffect(() => {
        if (!scan) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setScan(null)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [scan])

      // A measure tool must never be a dead end: Esc leaves it (the on-screen
      // chip also offers an explicit 结束 button). Scoped to the three measure
      // modes so Esc keeps its "close the card, stay in identify mode" meaning.
      const measureMode = tool === 'distance' || tool === 'area' || tool === 'height' || tool === 'profile'
      React.useEffect(() => {
        if (!measureMode) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') finishMeasure()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [measureMode])

      React.useEffect(() => {
        if (phase !== 'ready') return undefined
        // The camera/layer readout only needs ~1 Hz, and every state update
        // re-renders the whole panel (the toolbar, menus and layer card), which
        // competes with the globe's frame budget while the user is dragging. A
        // 500 ms cadence doubled that cost for no visible gain, so: 1 Hz plus a
        // value check that makes an idle scene cost zero React work.
        let lastKey = ''
        const timer = setInterval(() => {
          const next = collectStats()
          const key = next === null ? 'null' : JSON.stringify(next)
          if (key === lastKey) return
          lastKey = key
          setStats(next)
        }, 1000)
        return () => clearInterval(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [phase])

      // Keep the bare globe (no imagery) and its atmosphere in step with the
      // resolved light/dark scheme, so an explicit override tints the whole panel.
      React.useEffect(() => {
        const viewer = viewerRef.current
        const Cesium = cesiumRef.current
        if (phase !== 'ready' || !viewer || !Cesium) return
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(resolvedDark ? '#05080f' : '#dde6f2')
        viewer.scene.globe.showGroundAtmosphere = resolvedDark
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = resolvedDark
        viewer.scene.requestRender?.()
      }, [phase, resolvedDark])

      const button = (label, onClick, active, extra, title) =>
        h(
          'button',
          { type: 'button', className: `mv-btn${active ? ' on' : ''}${extra ? ` ${extra}` : ''}`, onClick, title },
          label,
        )
      const iconButton = (icon, title, onClick, active) =>
        h(
          'button',
          {
            type: 'button',
            className: `mv-btn icon${active ? ' on' : ''}`,
            title,
            'aria-label': title,
            'aria-pressed': active === undefined ? undefined : active,
            onClick,
          },
          icon,
        )
      const menu = (id, label, items, active) =>
        h(
          'div',
          { key: id, className: 'mv-menu' },
          button(`${label} ▾`, () => setOpenMenu(openMenu === id ? null : id), active),
          openMenu === id ? h('div', { className: 'mv-menu-panel mv-glass' }, items) : null,
        )

      const status = busy || (phase === 'loading' ? t('panel.status.loading') : t('panel.status.ready'))
      // v1.7 P0: the HUD keeps five readouts by default; the detailed mode
      // (Settings → Appearance, off by default) restores the old telemetry.
      const hudLabels = {
        pointer: t('hud.pointer'),
        camera: t('hud.camera'),
        heading: t('hud.heading'),
        tiles: t('hud.tiles'),
        pending: t('hud.pending'),
        triangles: t('hud.triangles'),
        cache: t('hud.cache'),
      }
      const hudDetailed = sources?.settings?.hudDetailed === true

      // B3 workbench wiring lives in src/client/ui/workbench-wiring.js; this
      // component only owns the form state and the scene refs the wiring needs.
      const workbench = useWorkbenchWiring({
        getForm: () => shaderForm,
        getLayers: () => layersRef.current,
        setShaderForm,
        shaderCommand,
        showToast,
        t,
        shaderCompare: (layer, enabled) => shaderEngine.compare(layer, enabled),
        openLocal: pickLocal,
        openRecent: openRecentDirectory,
        openUrl: () => {
          setOpenMenu(null)
          setUrlBar(true)
        },
        pickLocalTiles,
      })

      return h(
        'div',
        {
          ref: rootRef,
          className: `mv-root${docked ? ' mv-docked' : ''}`,
          'data-mv-theme': themeMode === 'auto' ? undefined : themeMode,
          'data-mv-scheme': resolvedDark ? 'dark' : 'light',
          onDragOver: (event) => {
            if (!isVectorDrag(event.dataTransfer)) return
            event.preventDefault()
            event.stopPropagation()
          },
          onDrop: (event) => {
            const files = Array.from(event.dataTransfer?.files ?? [])
            if (!hasVectorFile(files)) return
            event.preventDefault()
            event.stopPropagation()
            void readVectorFiles(files)
              .then(({ parsed, name }) => importVectorData(parsed, name))
              .catch((error) =>
                showToast(
                  t('layers.importFailed', {
                    message: error?.message === 'vector_file_unsupported' ? t('layers.importNeedFile') : vectorErrorText(error, t),
                  }),
                ),
              )
          },
        },
        h('style', { key: 'css' }, CSS),
        h('div', { key: 'globe', ref: globeRef, className: 'mv-globe' }),
        activeImagery?.credit
          ? h('div', { key: 'attr', className: 'mv-attr' }, `${t('credit.imagery')} © ${activeImagery.credit}`)
          : null,
        h('div', { key: 'credits', ref: creditRef, className: 'mv-credits' }),
        h(Compass, { key: 'compass', getViewer: () => viewerRef.current, t }),
        h(
          'div',
          { key: 'top', className: 'mv-top' },
          h(
            'div',
            { className: 'mv-brand mv-glass' },
            h(ViewerIcon, { size: 18 }),
            h('b', null, t('panel.title')),
            h('span', null, status),
          ),
          h(
            'div',
            { ref: menuRef, className: 'mv-actions mv-glass' },
            menu(
              'data',
              t('btn.data'),
              [
                h(MenuItem, { key: 'local', onClick: pickLocal }, t('btn.openLocal')),
                recentDirs.length
                  ? h(
                      React.Fragment,
                      { key: 'recent' },
                      h('span', { className: 'mv-menu-label' }, t('menu.recentDirs')),
                      ...recentDirs.map((entry) =>
                        h(
                          MenuItem,
                          { key: entry.dir, title: entry.dir, onClick: () => openRecentDirectory(entry.dir) },
                          h('span', { className: 'ellipsis' }, entry.name),
                        ),
                      ),
                    )
                  : null,
                agentOverlayCount > 0
                  ? h(
                      MenuItem,
                      {
                        key: 'clearAgent',
                        onClick: () => {
                          setOpenMenu(null)
                          clearAgentOverlays('all')
                          showToast(t('agent.clearedOverlays'))
                        },
                      },
                      t('menu.clearAgent'),
                    )
                  : null,
                h(
                  MenuItem,
                  {
                    key: 'url',
                    onClick: () => {
                      setOpenMenu(null)
                      setUrlBar((value) => !value)
                    },
                  },
                  t('btn.openUrl'),
                ),
                h(
                  MenuItem,
                  {
                    key: 'report',
                    onClick: async () => {
                      setOpenMenu(null)
                      try {
                        const value = await runCommand('report', { format: 'html' })
                        showToast(t('toast.reportSaved', { path: value.path }))
                      } catch (error) {
                        showToast(t('toast.reportFailed', { message: message(error) }))
                      }
                    },
                  },
                  t('menu.report'),
                ),
                h('i', { key: 'sep', className: 'mv-sep', style: { width: 'auto', height: '.5px', margin: '4px 8px' } }),
                h(
                  MenuItem,
                  {
                    key: 'clear',
                    onClick: () => {
                      setOpenMenu(null)
                      setToolMode(null)
                      setPickInfo(null)
                      setMeasureInfo(null)
                    },
                  },
                  t('tool.clear'),
                ),
              ],
            ),
            h('i', { key: 's1', className: 'mv-sep' }),
            h(ToolbarQuick, {
              t,
              showLayers,
              showTools,
              onToggleLayers: () => updateSettings({ showLayers: !showLayers }),
              onToggleTools: () => setShowTools((value) => !value),
              button,
            }),
            iconButton(
              h(HudIcon),
              showHud ? t('btn.hudHide') : t('btn.hudShow'),
              () => updateSettings({ showHud: !showHud }),
              showHud,
            ),
            iconButton(
              h(ShaderIcon),
              shaderOpen ? t('btn.shaderHide') : t('btn.shaderShow'),
              () => setShaderOpen((value) => !value),
              shaderOpen,
            ),
            // v1.7 P0: 指认 — click an object to read it (panel-only, no tool).
            // Identify is now the default pointer behaviour, so no dedicated
            // toolbar toggle is needed; measure/profile temporarily override it.
            // Action buttons are icon-only with a tooltip/aria-label: in the docked
            // narrow panel the text labels were what wrapped the toolbar onto a
            // second row. The four dropdown menus keep their text labels because a
            // bare icon does not tell the user what the menu contains.
            iconButton(h(ScreenshotIcon), t('btn.screenshot'), screenshot),
            sessionId ? iconButton(h(AskAgentIcon), t('btn.askAgent'), askAgent) : null,
            iconButton(h(ResetIcon), t('btn.reset'), resetView),
            // Only the main panel offers "open beside chat"; the docked tab is
            // already beside the conversation.
            docked ? null : button(t('btn.beside'), openBeside),
            // Single fullscreen entry point for both mounts (DOM Fullscreen API).
            // Expanding the sidebar is DSH's own feature, so the duplicate
            // "maximize sidebar" action is gone.
            iconButton(h(FullscreenIcon), fullscreen ? t('btn.fullscreenExit') : t('btn.fullscreenTitle'), toggleDomFullscreen, fullscreen),
            h('i', { key: 's3', className: 'mv-sep' }),
            h(ToolbarMenus, { t, themeMode, resolvedDark, openMenu, setOpenMenu, setTheme, setSettingsOpen }),
          ),
        ),
        urlBar
          ? h(UrlBar, {
              key: 'urlbar',
              value: urlInput,
              placeholder: t('urlbar.placeholder'),
              submitLabel: t('urlbar.submit'),
              onChange: setUrlInput,
              onSubmit: submitUrl,
              onClose: () => setUrlBar(false),
            })
          : null,
        shaderOpen
          ? h(ShaderWorkbench, {
              key: 'shader',
              t,
              layers,
              form: shaderForm,
              active: shaderActive,
              onClose: () => {
                void workbench.compare(false)
                setShaderOpen(false)
              },
              onLayer: (layerId) => workbench.field('layerId', layerId),
              onPreset: workbench.toggle,
              onField: workbench.field,
              onApply: workbench.apply,
              onPreview: workbench.preview,
              target: workbench.target(), getScene: () => ({ Cesium: cesiumRef.current, viewer: viewerRef.current }),
              onPresetMove: workbench.move,
              onCompare: workbench.compare,
              onResetLayer: workbench.resetLayer,
              onResetAll: workbench.resetAll,
            })
          : null,
        // v1.7 P0: 指认 card + corner brackets (panel-only) and the tour bar.
        h(SelectionOverlay, {
          key: 'selection',
          active: tool === 'identify',
          apiRef: selectionApiRef,
          controller: selectionController,
          renderSnapshot,
          t,
          showToast,
          onMeasure: measureFromSelection,
          onVisionCommit: (ground) => { getSelectionTool(viewerRef.current, { getCesium: () => cesiumRef.current, t, showToast })?.commitVision(ground); setShowTools(true) },
          onVisionManual: () => setShowTools(true),
          onSelectArea: (card) => {
            const viewerNow = viewerRef.current
            if (!viewerNow || !card?.point) return
            const selectionTool = getSelectionTool(viewerNow, { getCesium: () => cesiumRef.current, t, showToast })
            selectionTool?.selectAreaAround?.({ lon: card.point.lon, lat: card.point.lat, radiusM: 15, height: card.point.surface_height_m ?? 0 })
            setShowTools(true)
          },
        }),
        tour.element,
        sceneDetails.element,
        h(RightStack, {
          t,
          analysis,
          onCloseAnalysis: () => clearAnalysis(),
          showLayers,
          showTools,
          layersPanel: {
            config: sources,
            settings: sources?.settings ?? {},
            layers,
            annotations: { drawn_features: agentOverlayRef.current.drawnFeatures, measured_points: agentOverlayRef.current.measuredCount },
            onCollapse: () => updateSettings({ showLayers: false }),
            onSelectTerrain: changeTerrain,
            onSelectImagery: changeImagery,
            terrainError,
            onRetryTerrain: () => applyTerrain(sourcesRef.current?.settings?.terrain ?? null, true),
            onFlyLayer: flyToLayer,
            onFrameAll: () => frameAllLayers(viewerRef.current, cesiumRef.current, layersRef.current),
            onToggleLayer: toggleLayer,
            onInspectLayer: inspectLayer,
            onRemoveLayer: removeLayer,
            shaderActive,
            onEditLayerShader: (layer, entry) => {
              workbench.loadEntry(entry ?? { layer: layer.name, layerId: layer.id, preset: 'height-false-color' })
              setShaderOpen(true)
            },
            onOverlayAdd: addOverlay,
            onOverlayRemove: removeOverlay,
            onOverlayOpacity: setOverlayOpacity,
            onOverlayVisible: setOverlayVisible,
            onOverlayMove: moveOverlay,
            onImportVector: importVectorData,
            onPickLocalTiles: () => workbench.pickLocalTiles({ withMeta: true }),
            onOpenLocal: workbench.openLocal,
            onOpenUrl: workbench.openUrl,
            recentDirs,
            onOpenRecent: workbench.openRecent,
            onClearVector: () => clearAgentOverlays('all'),
            agentOverlays: buildAgentOverlayList(agentOverlayRef.current),
            onFlyAgentOverlay: (kind, index) =>
              flyToAgentOverlay(agentOverlayRef.current, viewerRef.current, cesiumRef.current, kind, index),
            onRemoveAgentOverlay: (kind, index) => {
              if (!removeAgentOverlay(agentOverlayRef.current, viewerRef.current, kind, index)) return
              syncAgentOverlayCount()
              markSceneDirty()
              saveSceneSnapshot(true)
            },
            onShowSceneDetails: sceneDetails.open,
          },
          toolsPanel: {
            tool,
            analysis,
            shaderActive,
            onCollapse: () => setShowTools(false),
            onStartTool: (mode) => setToolMode(mode),
            onClearMeasure: clearMeasure,
            onStartProfile: () => profileTool.start(),
            onClearAnalysis: () => clearAnalysis(),
            onOpenShader: () => setShaderOpen(true),
            getCesium: () => cesiumRef.current,
            getViewer: () => viewerRef.current,
            getLayers: () => layersRef.current,
            // Camera bookmarks: panel-managed list, storage in localStorage.
            getCurrentView: () => currentSceneSnapshot()?.view ?? null,
            onFlyView: (view) => flyToBookmark(viewerRef.current, cesiumRef.current, view),
            onStartTour: tour.start,
            showToast,
            runAnalysis: analyzeCommand,
            getTerrainActive: () => Boolean(sourcesRef.current?.settings?.terrain),
            getOverlayRows: () => {
              const rows = overlayRowsWithEntities(agentOverlayRef.current)
              const manual = manualMeasurementRow(measureRef.current.entities, t('measure.objectRow'), measureInfo?.text ?? '')
              return manual ? [...rows, manual] : rows
            },
            onActivateSelection: () => { setToolMode(null); selectionApiRef.current?.cancel?.() },
            onRemoveOverlayRows: (rows) => {
              const manual = Array.isArray(rows) && rows.some((row) => row.kind === 'manual')
              if (manual) clearMeasure()
              const removed = removeAgentOverlayRows(agentOverlayRef.current, viewerRef.current, rows)
              syncAgentOverlayCount()
              markSceneDirty()
              saveSceneSnapshot(true)
              return removed + (manual ? 1 : 0)
            },
            onAskAgent: askAgent,
            onAskSelection: (options) => askAgentService.askSelection(options),
            onVisionSelect: () => { selectionApiRef.current?.requestVision?.(); setToolMode(null); setShowTools(false) },
          },
        }),
        phase === 'ready' && layers.length === 0 && !emptyDismissed && !restoringScene
          ? h(
              'div',
              { key: 'empty', className: 'mv-overlay' },
              h(
                'div',
                { className: 'mv-empty' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mv-empty-close',
                    title: t('panel.empty.dismiss'),
                    'aria-label': t('panel.empty.dismiss'),
                    onClick: () => setEmptyDismissed(true),
                  },
                  '✕',
                ),
                h(ViewerIcon, { size: 30 }),
                h('h2', null, t('panel.empty.title')),
                h('p', null, t('panel.empty.body')),
                h(
                  'div',
                  { className: 'buttons' },
                  h('button', { type: 'button', className: 'mv-cta primary', onClick: pickLocal }, t('panel.empty.local')),
                  h('button', { type: 'button', className: 'mv-cta', onClick: () => setUrlBar(true) }, t('panel.empty.url')),
                ),
              ),
            )
          : null,
        phase === 'loading'
          ? h('div', { key: 'loading', className: 'mv-overlay dim', role: 'status' }, h('div', { className: 'mv-empty' }, h(LoadingGlobe), h('p', null, t('panel.status.loading'))))
          : null,
        phase === 'error'
          ? h(
              'div',
              { key: 'error', className: 'mv-overlay dim' },
              h(
                'div',
                { className: 'mv-empty' },
                h('h2', null, '⚠'),
                h('p', null, error),
                h('div', { className: 'buttons' }, h('button', { type: 'button', className: 'mv-cta', onClick: () => location.reload() }, t('btn.retry'))),
              ),
            )
          : null,
        stats && showHud
          ? h(StatusHud, { key: 'hud', fps, stats, viewerRef, cesiumRef, labels: hudLabels, readoutRef: captureReadoutRef, detailed: hudDetailed })
          : null,
        measureInfo
          ? h(
              'div',
              { key: 'measure', className: 'mv-measure mv-glass' },
              h('span', { className: 'text' }, measureInfo.text),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-measure-end',
                  title: measureMode ? t('measure.endHint') : t('tool.clear'),
                  'aria-label': measureMode ? t('measure.endHint') : t('tool.clear'),
                  onClick: () => (measureMode ? finishMeasure() : clearMeasure()),
                },
                measureMode ? t('measure.end') : t('tool.clear'),
              ),
            )
          : null,
        h(VectorCard, { key: 'vector-selection', selection: vectorSelection, onClose: () => vectorRef.current?.clearSelection(), t }),
        pickInfo && !vectorSelection
          ? h(
              'div',
              { key: 'pick', className: 'mv-pick mv-glass' },
              h(
                'header',
                null,
                h('span', null, pickInfo.title),
                h(
                  'button',
                  { type: 'button', className: 'mv-icon-btn', onClick: () => setPickInfo(null), title: t('btn.close') },
                  '✕',
                ),
              ),
              h(
                'table',
                null,
                h(
                  'tbody',
                  null,
                  pickInfo.rows.map(([name, value]) => h('tr', { key: name }, h('td', null, name), h('td', null, value))),
                ),
              ),
            )
          : null,
        toast ? h('div', { key: 'toast', className: 'mv-toast' }, toast) : null,
        scan
          ? h(ScanDialog, {
              key: 'scan',
              scan,
              t,
              onClose: () => setScan(null),
              onSelect: (item) =>
                addTileset(item.url, item.name.split(/[\\/]/).filter(Boolean).slice(-2).join('/'), {
                  kind: 'local',
                  path: joinLocalPath(scan.dir, item.name),
                }),
            })
          : null,
        health
          ? h(HealthDialog, {
              key: 'health',
              state: health,
              messages: t,
              onClose: closeHealth,
              onCopy: async () => {
                const path = health.reportPath ?? health.report?.reportPath
                if (!path) return
                try {
                  await navigator.clipboard.writeText(path)
                  showToast(t('health.copied'))
                } catch {
                  showToast(t('health.copyFailed'))
                }
              },
            })
          : null,
        settingsOpen && sources && defaults
          ? h(SourcesDialog, {
              key: 'settings',
              config: sources,
              defaults,
              environmentDark,
              themeMode,
              messages: t,
              meta,
              bridgeOn,
              bridgeReload,
              onPickLocal: pickLocalTiles,
              onSave: saveSources,
              onClose: () => setSettingsOpen(false),
            })
          : null,
        accessRequest
          ? h(PathAccessDialog, {
              key: 'access',
              request: accessRequest,
              busy: accessBusy,
              t,
              onAllow: allowPathAccess,
              onDeny: () => settleAccess({ allowed: false, message: t('access.denied') }),
            })
          : null,
        imageryBusy || terrainBusy
          ? h('div', { key: 'busy', className: 'mv-measure mv-glass', style: { bottom: '44px' } }, t('toast.loadingData'))
          : null,
      )
    }

export { ViewerSurface }
