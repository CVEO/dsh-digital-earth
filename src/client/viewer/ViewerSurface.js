/**
 * viewer/ViewerSurface.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { createAnalysisEngine } from '../analysis/engine.js'
import { buildAgentOverlayList, clearAgentOverlays as clearAgentOverlaysInState, removeAgentOverlay } from '../scene/agent-overlays.js'
import { ACCESS_TIMEOUT_MS, imageryProvider, loadCesium, loadCesiumStyle, loadMeta, loadSources, persistSources, scanLocalDirectory, terrainProvider } from '../api.js'
import { formatCursor, sampleCursor } from '../cursor.js'
import { arrayBufferToBase64, b64url, clone, escapeHtml, formatArea, formatDistance, formatHeight, formatValue, geodesicLength, message, planarArea, redactUrl } from '../format.js'
import { isChinese, t, useTranslation } from '../i18n.js'
import { FALLBACK_ABOUT } from '../messages.js'
import { folderName } from '../preferences.js'
import { service } from '../runtime.js'
import { normalizeSceneSnapshot, readSceneSnapshot, writeSceneSnapshot } from '../scene-store.js'
import { createOverlayLayers } from '../scene/overlay-layers.js'
import { flyToCartographic, frameAllLayers } from '../scene/frame.js'
import { createHostSceneStore } from '../scene/host-scene-store.js'
import { applyQuality, normalizeQuality, qualityProfile } from '../scene/quality.js'
import { createShaderEngine } from '../scene/shader-engine.js'
import { useEnvironmentDark } from '../theme.js'
import { AnalysisCard, ShaderWorkbench } from '../ui/cards.js'
import { CSS } from '../ui/css.js'
import { HealthDialog, PathAccessDialog, SourcesDialog } from '../ui/dialogs.js'
import { StatusHud } from '../ui/hud.js'
import { AskAgentIcon, FullscreenIcon, HudIcon, ResetIcon, ScreenshotIcon, ShaderIcon, ThemeIcon, ViewerIcon } from '../ui/icons.js'
import { LayersPanel } from '../ui/layers-panel.js'
import { MenuItem } from '../ui/menu-item.js'

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
      const toolRef = React.useRef(null)
      const measureRef = React.useRef({ points: [], entities: [] })
      const handlerRef = React.useRef(null)
      const imageryRef = React.useRef(null)
      // L3 raster overlays above the basemap (several layers, each with alpha).
      const overlayLayersRef = React.useRef(null)
      const sourcesRef = React.useRef(null)
      const toastTimer = React.useRef(0)
      const captureReadoutRef = React.useRef(null)
      const commandChainRef = React.useRef(Promise.resolve())
      const commandRef = React.useRef(null)
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
      const [tool, setTool] = React.useState(null)
      const [fps, setFps] = React.useState(null)
      // True while the panel root is the document's fullscreen element.
      const [fullscreen, setFullscreen] = React.useState(false)
      const [stats, setStats] = React.useState(null)
      const [pickInfo, setPickInfo] = React.useState(null)
      const [measureInfo, setMeasureInfo] = React.useState(null)
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
      const waitForPanelReady = (timeoutMs = 30000) =>
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
        setLayers(layersRef.current.map((layer) => ({ id: layer.id, name: layer.name, visible: layer.visible })))
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
       * Open the dialog and wait for the user. The 32 s cleanup timer unblocks this
       * panel's serialised command chain after the Host's own 30 s deadline; the
       * late ack is ignored by the Host and never retried.
       */
      const askPathAccess = (request) =>
        new Promise((resolve) => {
          if (accessRef.current) settleAccess({ allowed: false, message: t('access.denied') })
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

      const pickSurface = (position) => {
        const viewer = viewerRef.current
        if (!viewer) return null
        if (viewer.scene.pickPositionSupported) {
          try {
            const picked = viewer.scene.pickPosition(position)
            if (picked) return picked
          } catch {
            /* fall through to the globe ray pick */
          }
        }
        const ray = viewer.camera.getPickRay(position)
        return ray ? viewer.scene.globe.pick(ray, viewer.scene) ?? null : null
      }

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
            tileset = await Cesium.Cesium3DTileset.fromUrl(url, tilesetOptions)
          } catch (directError) {
            if (!/^https?:/i.test(url)) throw directError
            tileset = await Cesium.Cesium3DTileset.fromUrl(proxyUrlFor(url), tilesetOptions)
            showToast(t('toast.proxyFallback'))
          }
          viewer.scene.primitives.add(tileset)
          const layer = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: label,
            url,
            source,
            tileset,
            visible: true,
          }
          layersRef.current.push(layer)
          syncLayers()
          setScan(null)
          if (options.fly !== false) await viewer.flyTo(tileset, { duration: 1.2 })
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

      /**
       * Load the folders the Host remembers from earlier `/scan` calls (newest
       * first). Older Hosts do not send `directoriesUrl`: hide the section then
       * rather than failing a menu that otherwise works.
       */
      const refreshRecentDirs = async () => {
        const url = metaRef.current?.directoriesUrl
        if (typeof url !== 'string' || url === '') return
        try {
          const response = await fetch(url, { credentials: 'same-origin' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          const list = Array.isArray(data?.directories) ? data.directories : []
          const entries = []
          for (const entry of list) {
            const dir = typeof entry === 'string' ? entry : entry?.path
            if (typeof dir !== 'string' || dir === '') continue
            entries.push({ dir, name: typeof entry?.name === 'string' && entry.name !== '' ? entry.name : folderName(dir) })
            if (entries.length >= 5) break
          }
          setRecentDirs(entries)
        } catch (error) {
          // A stale endpoint must not break the data menu; surface it like a scan error.
          setRecentDirs([])
          showToast(t('toast.scanFailed', { message: message(error) }))
        }
      }

      /** Re-open a remembered folder exactly like the picker would. */
      async function openRecentDirectory(dir) {
        setOpenMenu(null)
        setBusy(t('toast.busyDirectory'))
        try {
          const meta = metaRef.current
          const response = await fetch(
            `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(dir)}`,
            { credentials: 'same-origin', headers: { 'x-dsh-panel': '1' } },
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          refreshRecentDirs()
          if (!data.items || data.items.length === 0) {
            showToast(t('toast.scanEmpty'))
            return
          }
          setScan({ dir, items: data.items })
        } catch (error) {
          showToast(t('toast.scanFailed', { message: message(error) }))
        } finally {
          setBusy('')
        }
      }

      async function pickLocal() {
        setOpenMenu(null)
        const workspace = service('uiWorkspace')
        if (!workspace) {
          showToast(t('toast.dialogUnavailable'))
          return
        }
        setBusy(t('toast.busyDirectory'))
        try {
          const dir = await workspace.pickDirectory()
          if (!dir) return
          const meta = metaRef.current
          const response = await fetch(
            `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(dir)}`,
            { credentials: 'same-origin', headers: { 'x-dsh-panel': '1' } },
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          // `/scan` records the folder on the Host, so the recent list is stale now.
          refreshRecentDirs()
          if (!data.items || data.items.length === 0) {
            showToast(t('toast.scanEmpty'))
            return
          }
          setScan({ dir, items: data.items })
        } catch (error) {
          showToast(t('toast.scanFailed', { message: message(error) }))
        } finally {
          setBusy('')
        }
      }

      /**
       * Pick a local tile pyramid folder and turn it into a `/tiles` template.
       * Opening the folder through /scan is what whitelists it on the host, so a
       * local XYZ pyramid needs no extra permission plumbing.
       */
      async function pickLocalTiles() {
        const workspace = service('uiWorkspace')
        if (!workspace) {
          showToast(t('toast.dialogUnavailable'))
          return null
        }
        try {
          const dir = await workspace.pickDirectory()
          if (!dir) return null
          const meta = metaRef.current
          const response = await fetch(
            `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(dir)}`,
            { credentials: 'same-origin', headers: { 'x-dsh-panel': '1' } },
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const folder = dir.replace(/\\/g, '/').replace(/\/+$/, '')
          return `${meta.tilesBase}${encodeURIComponent(b64url(folder))}/{z}/{x}/{y}.png`
        } catch (error) {
          showToast(t('toast.scanFailed', { message: message(error) }))
          return null
        }
      }

      async function applyImagery(id, notify) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { ok: false, error: t('agent.notReady') }
        const config = sourcesRef.current
        const source = config?.imagery.find((item) => item.id === id) ?? null
        setImageryBusy(true)
        try {
          if (imageryRef.current) {
            viewer.scene.imageryLayers.remove(imageryRef.current, true)
            imageryRef.current = null
          }
          if (source) {
            const provider = await imageryProvider(Cesium, source)
            // Index 0: the basemap is always the BOTTOM imagery layer, so switching
            // it never covers the L3 raster overlays stacked above it.
            imageryRef.current = viewer.scene.imageryLayers.addImageryProvider(provider, 0)
            if (notify) showToast(t('toast.basemap', { name: source.name }))
          } else if (notify) {
            showToast(t('toast.basemapNone'))
          }
          return { ok: true, source }
        } catch (error) {
          showToast(t('toast.basemapFailed', { message: message(error) }))
          return { ok: false, error: message(error) }
        } finally {
          setImageryBusy(false)
        }
      }

      async function applyTerrain(id, notify) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { ok: false, error: t('agent.notReady') }
        const config = sourcesRef.current
        const source = config?.terrain.find((item) => item.id === id) ?? null
        setTerrainBusy(true)
        if (notify) setBusy(t('toast.terrainLoading'))
        try {
          if (source) {
            viewer.terrainProvider = await terrainProvider(Cesium, source)
            showToast(t('toast.terrainOn', { name: source.name }))
          } else {
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
            showToast(t('toast.terrainOff'))
          }
          // A terrain switch can change the elevation baseline, so re-apply the
          // user's depth-test choice on the new terrain.
          applyGlobeDepthTest()
          return { ok: true, source }
        } catch (error) {
          viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
          showToast(t('toast.terrainFailed', { message: message(error) }))
          return { ok: false, error: message(error) }
        } finally {
          setTerrainBusy(false)
          if (notify) setBusy('')
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
       * Docked tab: expand the sidebar column to fullscreen so the globe gets the
       * room while the Session (and the Agent bridge) stay mounted. Falls back to
       * the immersive main panel when the column cannot report a target.
       */
      const togglePaneFullscreen = () => {
        const rightbar = service('sidebarRight')
        try {
          const target =
            rightbar?.focusedTarget?.(rootRef.current) ?? rightbar?.commandTarget?.(rootRef.current)
          if (target !== undefined) {
            rightbar.toggleFullscreen(target)
            return
          }
        } catch {
          /* fall through to the immersive panel */
        }
        service('layout')?.selectPanel?.('digital-earth')
      }

      /**
       * Real fullscreen: the panel root element goes to OS-level fullscreen
       * (DOM Fullscreen API), so the whole screen shows the globe and no DSH
       * chrome remains. Distinct from togglePaneFullscreen, which only expands the
       * sidebar column and is labelled "maximize sidebar".
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

      const saveSources = (draft) => {
        const current = sourcesRef.current
        const meta = metaRef.current
        if (!meta) return
        const next = { ...draft }
        commitSources(next, true)
        setSettingsOpen(false)
        if (current?.settings?.imagery !== next.settings.imagery) applyImagery(next.settings.imagery, false)
        if (current?.settings?.terrain !== next.settings.terrain) applyTerrain(next.settings.terrain, false)
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
        toolRef.current = mode
        setTool(mode)
        clearMeasure()
        if (mode) setPickInfo(null)
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
        const add = (options) => {
          const entity = viewer.entities.add(options)
          state.entities.push(entity)
          return entity
        }
        const accent = Cesium.Color.fromCssColorString('#5b8cff')
        const label = (position, text) =>
          add({
            position,
            label: {
              text,
              font: '12px -apple-system,"Segoe UI","PingFang SC",sans-serif',
              style: Cesium.LabelStyle.FILL,
              fillColor: Cesium.Color.WHITE,
              showBackground: true,
              backgroundColor: new Cesium.Color(0.06, 0.09, 0.15, 0.85),
              backgroundPadding: new Cesium.Cartesian2(8, 5),
              pixelOffset: new Cesium.Cartesian2(0, -18),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
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
          const area = planarArea(Cesium, points)
          const center = Cesium.BoundingSphere.fromPoints(points).center
          label(center, t('measure.areaLabel', { value: formatArea(area) }))
          setMeasureInfo({ text: t('measure.area', { value: formatArea(area) }) })
        } else if (mode === 'height' && points.length === 2) {
          add({
            polyline: {
              positions: points,
              width: 2,
              material: Cesium.Color.fromCssColorString('#f0b84b'),
              depthFailMaterial: Cesium.Color.fromCssColorString('#f0b84b'),
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

      // Clear/remove helpers live in src/client/scene/agent-overlays.js.
      const clearAgentOverlays = (kind = 'all') => {
        clearAgentOverlaysInState(agentOverlayRef.current, viewerRef.current, kind)
        syncAgentOverlayCount()
        markSceneDirty()
      }

      const AGENT_OVERLAY_COLORS = {
        accent: '#5b8cff',
        alert: '#e5484d',
        success: '#2ec27e',
        warm: '#f0b84b',
        violet: '#a855f7',
      }

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
          label: {
            text,
            font: '12px -apple-system,"Segoe UI","PingFang SC",sans-serif',
            style: Cesium.LabelStyle.FILL,
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: new Cesium.Color(0.06, 0.09, 0.15, 0.85),
            backgroundPadding: new Cesium.Cartesian2(8, 5),
            pixelOffset: new Cesium.Cartesian2(0, -18),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
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
        const add = (options) => {
          const entity = viewer.entities.add(options)
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
          switch (geometry.type) {
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
        const color = Cesium.Color.fromCssColorString('#f0b84b')
        const add = (options) => {
          const entity = viewer.entities.add(options)
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
            addAgentGroundLabel(Cesium, add, to.lon, to.lat, `${t('measure.height', { value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m`, distance: formatDistance(horizontal) })}`)
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
        markSceneDirty: () => markSceneDirty(),
        t,
      })
      const clearAnalysis = () => analysisEngine.clear()
      const analyzeCommand = (args = {}) => analysisEngine.command(args)
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
        setShaderActive,
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

      /** Rebuild a saved scene into the freshly created viewer. Best effort per item. */
      async function restoreSceneSnapshot(snapshot) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer || snapshot === null) return
        setRestoringScene(snapshot.layers.length > 0)
        try {
          for (const item of snapshot.layers) {
            const source = item.source
            let url = ''
            if (typeof source.path === 'string' && source.path !== '') {
              try {
                url = await localPathToUrl(source.path)
              } catch {
                // The folder may not be authorised any more: skip that layer.
                continue
              }
            } else if (typeof source.url === 'string' && /^https?:\/\//i.test(source.url)) {
              url = source.url
            }
            if (url === '') continue
            try {
              const layer = await loadTileset(url, item.name, source, { fly: false })
              if (item.visible === false) setLayerVisible(layer.id, false)
            } catch {
              // One missing or moved source must not abort the other layers.
            }
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
        } finally {
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
      function pickResult(position) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { picked: false, type: 'none', properties: [] }
        const picked = viewer.scene.pick(position)
        if (!Cesium.defined(picked)) return { picked: false, type: 'none', properties: [] }
        if (picked instanceof Cesium.Cesium3DTileFeature) {
          const properties = []
          for (const id of picked.getPropertyIds()) {
            if (properties.length >= 40) break
            properties.push({ name: id, value: formatValue(picked.getProperty(id)) })
          }
          return {
            picked: true,
            type: 'tile-feature',
            layer: layerLabel(picked.primitive ?? picked.tileset),
            properties,
          }
        }
        const primitive = picked?.primitive ?? picked
        if (primitive instanceof Cesium.Cesium3DTileset) {
          return { picked: true, type: 'tileset', layer: layerLabel(primitive), properties: [] }
        }
        if (picked?.id instanceof Cesium.Entity) {
          return { picked: true, type: 'entity', name: String(picked.id.name ?? picked.id.id), properties: [] }
        }
        return { picked: true, type: 'scene', properties: [] }
      }

      function pickAt(position) {
        const result = pickResult(position)
        if (!result.picked) {
          setPickInfo({ title: t('toast.pickNone'), rows: [] })
          return
        }
        if (result.type === 'tile-feature') {
          const rows = result.properties.map((entry) => [entry.name, entry.value])
          if (rows.length === 0) rows.push([t('pick.noProperties'), t('pick.noPropertiesValue')])
          setPickInfo({ title: result.layer, rows })
          return
        }
        if (result.type === 'tileset') {
          setPickInfo({
            title: t('pick.title'),
            rows: [
              [t('pick.type'), t('pick.tiles')],
              [t('pick.layer'), result.layer],
            ],
          })
          return
        }
        if (result.type === 'entity') {
          setPickInfo({
            title: t('pick.title'),
            rows: [
              [t('pick.type'), t('pick.entity')],
              [t('pick.name'), result.name],
            ],
          })
          return
        }
        setPickInfo({ title: t('pick.title'), rows: [[t('pick.type'), t('pick.scene')]] })
      }

      function onCanvasClick(position) {
        const mode = toolRef.current
        if (mode === null) return
        if (mode === 'pick') {
          pickAt(position)
          return
        }
        const surface = pickSurface(position)
        if (!surface) {
          showToast(t('toast.noSurface'))
          return
        }
        measureRef.current.points.push(surface)
        if (mode === 'height' && measureRef.current.points.length > 2) {
          measureRef.current.points.splice(0, measureRef.current.points.length - 2)
        }
        redrawMeasure(mode)
      }

      function finishMeasure() {
        if (toolRef.current === 'distance' || toolRef.current === 'area') {
          toolRef.current = null
          setTool(null)
        }
      }

      function resetView() {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(104, 31, 14000000),
          duration: 1.2,
        })
      }

      /** Hide the panel chrome while a clean snapshot is rendered. */
      const setChromeHidden = (hidden) => {
        const root = rootRef.current
        if (root) root.classList.toggle('mv-capturing', hidden)
      }

      const roundedRectPath = (context, x, y, width, height, radius) => {
        const r = Math.max(0, Math.min(radius, width / 2, height / 2))
        context.beginPath()
        context.moveTo(x + r, y)
        context.lineTo(x + width - r, y)
        context.arcTo(x + width, y, x + width, y + r, r)
        context.lineTo(x + width, y + height - r)
        context.arcTo(x + width, y + height, x + width - r, y + height, r)
        context.lineTo(x + r, y + height)
        context.arcTo(x, y + height, x, y + height - r, r)
        context.lineTo(x, y + r)
        context.arcTo(x, y, x + r, y, r)
        context.closePath()
      }

      /**
       * Draw the coordinate HUD and the team credit into the snapshot itself.
       * The panel chrome is a DOM overlay and can never be rasterised with the
       * WebGL canvas, so this is what "include HUD" means in an image.
       */
      const drawCaptureOverlay = (context, width, height) => {
        const viewer = viewerRef.current
        const Cesium = cesiumRef.current
        if (!viewer || !Cesium) return
        const font = Math.max(11, Math.min(24, Math.round(width * 0.0155)))
        const padding = Math.max(10, Math.round(font * 0.75))
        const lineGap = Math.round(font * 1.6)
        const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
        const lon = cartographic ? Cesium.Math.toDegrees(cartographic.longitude).toFixed(4) : '—'
        const lat = cartographic ? Cesium.Math.toDegrees(cartographic.latitude).toFixed(4) : '—'
        const cameraHeight = cartographic ? Math.round(cartographic.height) : 0
        const heading = Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0))
        const pitch = Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0))
        const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} }
        const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null
        const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null
        const lastReadout = captureReadoutRef.current
        let pointerText = lastReadout || ''
        if (!pointerText) {
          const center = new Cesium.Cartesian2(
            Math.round(viewer.canvas.clientWidth / 2),
            Math.round(viewer.canvas.clientHeight / 2),
          )
          const carto = sampleCursor(viewer, Cesium, center, { pickPosition: true })
          if (carto) pointerText = formatCursor(Cesium, carto)
        }
        const visibleCount = layersRef.current.filter((layer) => layer.visible).length
        const lines = [
          `${lastReadout ? t('hud.pointer') : t('hud.center')}  ${pointerText || t('hud.empty')}`,
          `${t('hud.camera')} ${cameraHeight} m · ${t('hud.heading')} ${heading}° · ${pitch}°`,
          `${t('hud.layers')} ${visibleCount}/${layersRef.current.length} · ${imagery?.name ?? '—'} · ${terrain?.name ?? '—'}`,
          `${t('hud.cameraPos')} ${lon}, ${lat}`,
        ]
        const family = '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
        context.save()
        context.font = `${font}px ${family}`
        context.textBaseline = 'top'
        context.textAlign = 'left'
        const textWidth = Math.max(...lines.map((line) => context.measureText(line).width))
        const boxWidth = Math.min(width - padding * 2, textWidth + padding * 2)
        const boxHeight = lines.length * lineGap + padding * 2
        const boxX = padding
        const boxY = height - boxHeight - padding
        context.fillStyle = 'rgba(8, 12, 18, 0.6)'
        roundedRectPath(context, boxX, boxY, boxWidth, boxHeight, Math.round(font * 0.65))
        context.fill()
        lines.forEach((line, index) => {
          context.fillStyle = index === 0 ? '#eef4ff' : '#c5d2e2'
          context.fillText(line, boxX + padding, boxY + padding + index * lineGap)
        })
        const title = t('panel.title')
        const aboutMeta = metaRef.current
        const teamName = aboutMeta?.team?.name ?? t('about.teamName')
        let teamHost = 'www.whu-cveo.com'
        try {
          teamHost = new URL(aboutMeta?.team?.url ?? FALLBACK_ABOUT.teamUrl).host || teamHost
        } catch {
          /* keep the static fallback */
        }
        context.font = `600 ${font}px ${family}`
        context.fillStyle = 'rgba(240, 246, 255, 0.9)'
        context.shadowColor = 'rgba(0, 0, 0, 0.45)'
        context.shadowBlur = Math.round(font * 0.6)
        context.fillText(title, padding, padding)
        const credit = `${teamName} · ${teamHost}`
        context.textAlign = 'right'
        context.font = `${Math.max(10, Math.round(font * 0.85))}px ${family}`
        context.fillStyle = 'rgba(238, 244, 255, 0.85)'
        context.fillText(credit, width - padding, height - padding - font)
        context.restore()
      }

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

      const MAX_CAPTURE_DATAURL = 7_500_000

      /** Render the canvas at the requested width and return a data URL. */
      async function renderSnapshot(options = {}) {
        const viewer = viewerRef.current
        if (!viewer) throw new Error(t('agent.noViewer'))
        const root = rootRef.current
        const hidden =
          !root ||
          root.offsetWidth < 32 ||
          root.offsetHeight < 32 ||
          (typeof document !== 'undefined' && document.visibilityState === 'hidden')
        if (hidden) throw new Error(t('agent.hiddenPanel'))
        const width = Math.round(Math.min(Math.max(Number(options.width) || 1280, 480), 2560))
        const format = options.format === 'png' ? 'png' : 'jpeg'
        const settings = sourcesRef.current?.settings ?? {}
        const includeHud = typeof options.include_hud === 'boolean' ? options.include_hud : settings.screenshotHud === true
        if (!includeHud) setChromeHidden(true)
        try {
          // Let CSS hide the chrome before the next frame is drawn, with a bound
          // so a backgrounded tab fails clearly instead of timing out later.
          await Promise.race([
            nextFrames(2),
            new Promise((_, reject) => setTimeout(() => reject(new Error(t('agent.hiddenPanel'))), 1500)),
          ])
          // Captures always use the full-quality buffer: the balanced tier trades
          // sharpness for motion, and the user asked for a picture, not a frame
          // budget. The tier's scale is restored afterwards.
          const previousResolutionScale = viewer.resolutionScale
          viewer.resolutionScale = 1
          try {
            viewer.resize()
            viewer.render()
            const canvas = viewer.canvas
            const sourceWidth = canvas?.width ?? 0
            const sourceHeight = canvas?.height ?? 0
            if (sourceWidth < 32 || sourceHeight < 32) throw new Error(t('agent.hiddenPanel'))
            let scale = 1
            let quality = 0.9
            let targetWidth = 0
            let targetHeight = 0
            let dataUrl = ''
            for (let attempt = 0; attempt < 4; attempt += 1) {
              const drawWidth = Math.max(320, Math.round(width * scale))
              targetWidth = Math.min(drawWidth, sourceWidth)
              targetHeight = Math.max(1, Math.round((targetWidth * sourceHeight) / sourceWidth))
              const target = document.createElement('canvas')
              target.width = targetWidth
              target.height = targetHeight
              const context = target.getContext('2d')
              context.drawImage(canvas, 0, 0, targetWidth, targetHeight)
              if (includeHud) drawCaptureOverlay(context, targetWidth, targetHeight)
              dataUrl = format === 'png' ? target.toDataURL('image/png') : target.toDataURL('image/jpeg', quality)
              if (dataUrl.length <= MAX_CAPTURE_DATAURL) break
              if (format === 'jpeg') quality = Math.max(0.5, quality - 0.15)
              else scale *= 0.78
            }
            if (dataUrl.length > MAX_CAPTURE_DATAURL) throw new Error(t('agent.captureTooLarge'))
            return { dataUrl, width: targetWidth, height: targetHeight, includeHud, format }
          } finally {
            viewer.resolutionScale = previousResolutionScale
            viewer.resize()
          }
        } finally {
          if (!includeHud) setChromeHidden(false)
        }
      }

      async function screenshot() {
        try {
          const shot = await renderSnapshot({ format: 'png' })
          const link = document.createElement('a')
          link.href = shot.dataUrl
          link.download = `digital-earth-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
          link.click()
          showToast(t('toast.screenshotSaved'))
        } catch (error) {
          showToast(t('toast.screenshotFailed', { message: message(error) }))
        }
      }

      /** Snapshot the scene and hand the file to the Host for the Agent to read. */
      async function captureScene(options = {}, session = null) {
        const meta = metaRef.current
        if (!meta?.captureUrl) throw new Error(t('agent.notReady'))
        const shot = await renderSnapshot(options)
        const response = await fetch(`${meta.captureUrl}?token=${encodeURIComponent(meta.token)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            session: session ?? sessionRef.current ?? '',
            dataUrl: shot.dataUrl,
            width: shot.width,
            height: shot.height,
            hud: shot.includeHud,
            label: typeof options.label === 'string' ? options.label : '',
          }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const saved = await response.json()
        showToast(
          t('toast.captureSaved', {
            width: saved.width,
            height: saved.height,
            path: saved.name ?? saved.path ?? '',
          }),
        )
        return { ...saved, hud: shot.includeHud }
      }

      /**
       * "Ask Agent": capture the current scene as context and inject it into the
       * live conversation, so the user can simply type the follow-up question.
       * Injection never wakes an idle agent; the context lands on the next step.
       */
      async function askAgent() {
        const meta = metaRef.current
        const session = sessionRef.current
        if (!meta?.injectUrl || typeof session !== 'string' || session === '') {
          showToast(t('toast.askAgentNoSession'))
          return
        }
        let snapshotPath = ''
        try {
          const saved = await captureScene({}, session)
          snapshotPath = typeof saved.path === 'string' ? saved.path : ''
        } catch {
          // A fresh image is a bonus; the textual summary still helps.
        }
        let status = null
        try {
          status = await collectSceneStatus()
        } catch {
          status = null
        }
        const lines = [
          '[Digital Earth scene context] The user is looking at this scene and will ask a follow-up about it.',
        ]
        if (status !== null) {
          const view = status.view ?? {}
          if (Number.isFinite(view.lon) && Number.isFinite(view.lat)) {
            lines.push(
              `Camera: lon=${view.lon}, lat=${view.lat}, height=${view.height} m, heading=${view.heading}°, pitch=${view.pitch}°.`,
            )
          }
          const layerText =
            Array.isArray(status.layers) && status.layers.length > 0
              ? status.layers.map((layer) => `${layer.name}${layer.visible === false ? ' (hidden)' : ''}`).join(', ')
              : 'none'
          lines.push(`Layers: ${layerText}.`)
          lines.push(`Imagery: ${status.imagery?.name ?? 'none'}; terrain: ${status.terrain?.name ?? 'none'}.`)
          const annotations = status.annotations ?? {}
          lines.push(
            `Agent overlays: ${annotations.drawn_features ?? 0} annotated features, ${annotations.measured_points ?? 0} measured points.`,
          )
        }
        if (analysis !== null && analysis.result) {
          const result = analysis.result
          if (result.operation === 'profile' && result.stats) {
            lines.push(
              `Analysis (profile): length=${result.length_m} m, relief=${result.stats.relief_m} m, min=${result.stats.min_height} m, max=${result.stats.max_height} m, samples=${result.samples}.`,
            )
          } else if (result.operation === 'flood') {
            lines.push(
              `Analysis (flood): water=${result.water_height} m, area=${result.area_km2} km², inundated=${result.inundated_km2} km², ratio=${result.inundated_ratio}, max depth=${result.depth_max_m} m.`,
            )
          } else if (result.operation === 'sunlight') {
            lines.push(
              `Analysis (sunlight): datetime=${result.datetime}, altitude=${result.sun?.altitude_deg}°, azimuth=${result.sun?.azimuth_deg}°, shadows=${result.shadows_enabled === true ? 'on' : 'off'}.`,
            )
          }
        }
        const shaders = shaderActiveList()
        if (shaders.length > 0) {
          lines.push(`Shaders: ${shaders.map((item) => `${item.layer}=${item.preset}`).join(', ')}.`)
        }
        if (snapshotPath !== '') lines.push(`Snapshot: ${snapshotPath}`)
        lines.push('Answer from the scene state above; do not invent data that is not in it.')
        try {
          const response = await fetch(meta.injectUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session, text: lines.join('\n') }),
          })
          const data = await response.json().catch(() => null)
          if (!response.ok || data?.ok !== true) throw new Error(data?.message ?? `HTTP ${response.status}`)
          showToast(t('toast.askAgentSent'))
        } catch (error) {
          showToast(t('toast.askAgentFailed', { message: message(error) }))
        }
      }

      /**
       * Build a scene report (self-contained HTML or Markdown) from the live
       * scene: camera, layers, basemap/terrain, Agent overlays and measured
       * values, the active analysis, shader presets and a best-effort snapshot.
       */
      async function buildSceneReport(args = {}) {
        const format = args.format === 'markdown' ? 'markdown' : 'html'
        const chinese = isChinese()
        const L = chinese
          ? {
              title: '数字地球场景报告',
              generated: '生成时间',
              camera: '相机',
              layers: '图层',
              name: '名称',
              visibility: '可见性',
              imagery: '影像底图',
              terrain: '地形',
              overlays: 'Agent 叠加',
              annotatedFeatures: '标注要素',
              measuredPoints: '量测点数',
              measurements: '量测结果',
              analysis: '地形分析',
              shaders: '着色器预设',
              snapshot: '当前画面',
              none: '无',
              visible: '显示',
              hidden: '隐藏',
              distance: '距离',
              area: '面积',
              height: '高差',
              slope: '坡度',
              profile: '剖面',
              relief: '起伏',
              flood: '淹没',
              inundated: '淹没面积',
              sunlight: '日照',
              generatedBy: '由 DSH 数字地球插件生成',
            }
          : {
              title: 'Digital Earth scene report',
              generated: 'Generated',
              camera: 'Camera',
              layers: 'Layers',
              name: 'Name',
              visibility: 'Visibility',
              imagery: 'Imagery',
              terrain: 'Terrain',
              overlays: 'Agent overlays',
              annotatedFeatures: 'Annotated features',
              measuredPoints: 'Measured points',
              measurements: 'Measurements',
              analysis: 'Terrain analysis',
              shaders: 'Shader presets',
              snapshot: 'Current view',
              none: 'none',
              visible: 'visible',
              hidden: 'hidden',
              distance: 'Distance',
              area: 'Area',
              height: 'Height difference',
              slope: 'slope',
              profile: 'Profile',
              relief: 'relief',
              flood: 'Flood',
              inundated: 'inundated',
              sunlight: 'Sunlight',
              generatedBy: 'Generated by the DSH Digital Earth plugin',
            }
        const title = typeof args.title === 'string' && args.title.trim() !== '' ? args.title.trim().slice(0, 120) : L.title
        const generatedAt = new Date().toISOString()
        const sections = []
        const failed = []
        let capture = null
        if (args.include_capture !== false) {
          try {
            const saved = await captureScene({}, sessionRef.current)
            capture = {
              path: typeof saved.path === 'string' ? saved.path : '',
              width: saved.width,
              height: saved.height,
              mime: 'image/jpeg',
              base64: '',
            }
            if (typeof saved.url === 'string' && saved.url !== '') {
              try {
                const response = await fetch(saved.url, { credentials: 'same-origin' })
                if (response.ok) {
                  const blob = await response.blob()
                  capture.mime = blob.type || 'image/jpeg'
                  capture.base64 = arrayBufferToBase64(await blob.arrayBuffer())
                }
              } catch {
                // Keeping the path still makes the report useful.
              }
            }
            if (capture.path !== '') sections.push('snapshot')
          } catch (error) {
            failed.push(`snapshot: ${message(error)}`)
          }
        }
        const status = await collectSceneStatus().catch(() => null)
        const view = status?.view ?? null
        const layers = Array.isArray(status?.layers) ? status.layers : []
        const annotations = status?.annotations ?? {}
        const measurements = agentOverlayRef.current.measureCommands
          .map((command) => command?.result)
          .filter((result) => result !== null && typeof result === 'object')
          .map((result) => {
            if (result.mode === 'distance') return `${L.distance}: ${formatDistance(result.distance_m)}`
            if (result.mode === 'area') return `${L.area}: ${formatArea(result.area_m2)}`
            if (result.mode === 'height') {
              return `${L.height}: ${result.height_m} m (${formatDistance(result.horizontal_m)} ${L.slope} ${result.slope_deg}°)`
            }
            return ''
          })
          .filter((line) => line !== '')
        if (measurements.length > 0) sections.push('measurements')
        let analysisText = ''
        if (analysis !== null && analysis.result) {
          const result = analysis.result
          if (result.operation === 'profile') {
            analysisText = `${L.profile}: ${formatDistance(result.length_m)}, ${L.relief} ${result.stats?.relief_m} m`
          } else if (result.operation === 'flood') {
            analysisText = `${L.flood}: ${formatDistance(result.water_height)} water, ${L.inundated} ${result.inundated_km2} km² (${result.inundated_ratio})`
          } else if (result.operation === 'sunlight') {
            analysisText = `${L.sunlight}: ${result.datetime}, altitude ${result.sun?.altitude_deg}°, azimuth ${result.sun?.azimuth_deg}°`
          }
        }
        if (analysisText !== '') sections.push('analysis')
        const shaders = shaderActiveList()
        if (shaders.length > 0) sections.push('shaders')
        sections.unshift('camera', 'layers')
        if (status !== null) sections.splice(2, 0, 'basemap & terrain')

        const cameraLine =
          view !== null
            ? `lon ${view.lon}, lat ${view.lat}, height ${view.height} m, heading ${view.heading}°, pitch ${view.pitch}°`
            : L.none
        const layerRows = layers.map((layer) => ({
          name: layer.name,
          visible: layer.visible === false ? L.hidden : L.visible,
        }))
        const environment = `${L.imagery}: ${status?.imagery?.name ?? L.none}; ${L.terrain}: ${status?.terrain?.name ?? L.none}`
        const overlayLine = `${L.annotatedFeatures}: ${annotations.drawn_features ?? 0}; ${L.measuredPoints}: ${annotations.measured_points ?? 0}`
        const shaderLines = shaders.map((item) => `${item.layer} — ${item.preset}`)

        let content = ''
        if (format === 'markdown') {
          const lines = [`# ${title}`, '', `${L.generated}: ${generatedAt}`, '', `## ${L.camera}`, '', `- ${cameraLine}`, '']
          lines.push(`## ${L.layers}`, '')
          if (layerRows.length === 0) lines.push(`- ${L.none}`)
          else {
            lines.push(`| ${L.name} | ${L.visibility} |`, '| --- | --- |')
            for (const row of layerRows) lines.push(`| ${row.name} | ${row.visible} |`)
          }
          lines.push('', `## ${L.imagery} / ${L.terrain}`, '', `- ${environment}`, '', `## ${L.overlays}`, '', `- ${overlayLine}`, '')
          if (measurements.length > 0) lines.push(`## ${L.measurements}`, '', ...measurements.map((line) => `- ${line}`), '')
          if (analysisText !== '') lines.push(`## ${L.analysis}`, '', `- ${analysisText}`, '')
          if (shaderLines.length > 0) lines.push(`## ${L.shaders}`, '', ...shaderLines.map((line) => `- ${line}`), '')
          if (capture !== null && capture.path !== '') lines.push(`## ${L.snapshot}`, '', `![${L.snapshot}](${capture.path})`, '')
          lines.push('---', L.generatedBy)
          content = lines.join('\n')
        } else {
          const table = layerRows.length === 0
            ? `<p>${escapeHtml(L.none)}</p>`
            : `<table><thead><tr><th>${escapeHtml(L.name)}</th><th>${escapeHtml(L.visibility)}</th></tr></thead><tbody>${layerRows
                .map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.visible)}</td></tr>`)
                .join('')}</tbody></table>`
          const image = capture !== null && capture.base64 !== ''
            ? `<img alt="${escapeHtml(L.snapshot)}" src="data:${escapeHtml(capture.mime)};base64,${capture.base64}">`
            : capture !== null && capture.path !== ''
              ? `<p>${escapeHtml(capture.path)}</p>`
              : ''
          const list = (items) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
          content = `<!doctype html>
<html lang="${chinese ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;padding:32px;background:#f5f7fa;color:#1b1f24;font:14px/1.65 -apple-system,"Segoe UI","PingFang SC",sans-serif}
main{max-width:900px;margin:0 auto;background:#fff;padding:32px 36px;border-radius:14px;box-shadow:0 8px 32px rgba(20,30,50,.08)}
h1{margin:0 0 4px;font-size:24px}
h2{margin:28px 0 10px;font-size:16px;border-bottom:1px solid #e6eaf0;padding-bottom:6px}
.meta{color:#6b7280;font-size:12px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #e6eaf0;padding:7px 10px;text-align:left}
th{background:#f8fafc}
ul{margin:0;padding-left:20px}
img{max-width:100%;border-radius:10px;border:1px solid #e6eaf0}
footer{margin-top:32px;color:#9aa1ab;font-size:12px}
</style>
</head>
<body><main>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(L.generated)}: ${escapeHtml(generatedAt)}</p>
<h2>${escapeHtml(L.camera)}</h2><p>${escapeHtml(cameraLine)}</p>
<h2>${escapeHtml(L.layers)}</h2>${table}
<h2>${escapeHtml(L.imagery)} / ${escapeHtml(L.terrain)}</h2><p>${escapeHtml(environment)}</p>
<h2>${escapeHtml(L.overlays)}</h2><p>${escapeHtml(overlayLine)}</p>
${measurements.length > 0 ? `<h2>${escapeHtml(L.measurements)}</h2><ul>${list(measurements)}</ul>` : ''}
${analysisText !== '' ? `<h2>${escapeHtml(L.analysis)}</h2><p>${escapeHtml(analysisText)}</p>` : ''}
${shaderLines.length > 0 ? `<h2>${escapeHtml(L.shaders)}</h2><ul>${list(shaderLines)}</ul>` : ''}
${image !== '' ? `<h2>${escapeHtml(L.snapshot)}</h2>${image}` : ''}
<footer>${escapeHtml(L.generatedBy)}</footer>
</main></body></html>`
        }
        return { format, title, content, label: 'scene', sections, failed }
      }

      function setLayerVisible(id, visible) {
        const layer = layersRef.current.find((item) => item.id === id)
        if (!layer) return null
        layer.visible = visible
        layer.tileset.show = visible
        syncLayers()
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
        if (layer && viewer) viewer.flyTo(layer.tileset, { duration: 1.0 })
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
        let url = value
        if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')) {
          try {
            url = await localPathToUrl(value)
          } catch (error) {
            showToast(message(error))
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
      async function collectSceneStatus() {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) throw new Error(t('agent.notReady'))
        const carto = viewer.camera.positionCartographic
        const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} }
        const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null
        const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null
        const round = (value) => Math.round(value * 1e6) / 1e6
        return {
          ready: true,
          view: {
            lon: round(Cesium.Math.toDegrees(carto.longitude)),
            lat: round(Cesium.Math.toDegrees(carto.latitude)),
            height: Math.round(carto.height),
            heading: Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0)),
            pitch: Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0)),
          },
          layers: layersRef.current.map((layer) => {
            const statistics = layer.tileset.statistics ?? {}
            return {
              id: layer.id,
              name: layer.name,
              visible: layer.visible,
              url: redactUrl(layer.url),
              tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded ?? 0,
              pending: statistics.numberOfPendingRequests ?? 0,
              triangles: statistics.numberOfTrianglesSelected ?? 0,
            }
          }),
          imagery: imagery ? { id: imagery.id, name: imagery.name } : null,
          terrain: terrain ? { id: terrain.id, name: terrain.name } : null,
          sources: {
            imagery: config.imagery.map((item) => ({ id: item.id, name: item.name })),
            terrain: config.terrain.map((item) => ({ id: item.id, name: item.name })),
          },
          viewport: { width: viewer.canvas.width, height: viewer.canvas.height },
          // L3 raster overlays above the basemap, in stack order (additive field).
          raster_overlays: overlayLayersRef.current?.list() ?? [],
          // Render health is additive: `fps` is null while the scene is idle (no
          // render pass for 2 s) and the terrain depth-test flag is the user's
          // current choice, so an Agent can explain a "model looks flat/buried"
          // report instead of guessing.
          render: {
            fps: fps === null ? null : Math.round(fps),
            idle: fps === null,
            terrain_depth_test: viewer.scene.globe.depthTestAgainstTerrain === true,
            // Quality tier + the effective scale, so "why is it blurry / slow"
            // has an answer in the scene state instead of a guess.
            quality: normalizeQuality(config.settings.quality),
            resolution_scale: viewer.resolutionScale,
            globe_maximum_screen_space_error: viewer.scene.globe.maximumScreenSpaceError,
          },
          snapshot: { includeHud: config.settings.screenshotHud === true },
          measureTool: toolRef.current,
          annotations: {
            drawn_features: agentOverlayRef.current.drawnFeatures,
            measured_points: agentOverlayRef.current.measuredCount,
            overlays: agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length,
          },
          busy: busy || '',
        }
      }

      /**
       * The single command dispatcher shared by the Agent bridge and (where it
       * makes sense) the panel UI. Every failure throws a model-readable error.
       */
      async function runCommand(action, args = {}, session = null) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} }
        const layerList = () => layersRef.current.map((layer) => layer.name).join(', ') || '—'
        const requireLayer = () => {
          const token = typeof args.layer === 'string' ? args.layer.trim() : ''
          if (!token) throw new Error(t('agent.missingLayer'))
          const layer = findLayer(token)
          if (!layer) throw new Error(t('agent.unknownLayer', { name: token, list: layerList() }))
          return layer
        }

        // Internal bridge action (not part of the earth_scene tool schema): the Host
        // resolved a local path but the whitelist rejected it, so ask the user in
        // the panel. Allow only after /scan registered the folder; the Host then
        // re-validates and sends the real `load` with the resolved target path.
        if (action === 'authorize') {
          const request = normalizeAccessRequest(args)
          if (!request.directory) throw new Error(`access_denied: ${t('access.badPath')}`)
          const decision = await askPathAccess(request)
          if (!decision.allowed) throw new Error(`access_denied: ${decision.message || t('access.denied')}`)
          return { authorized: true, directory: decision.directory }
        }
        if (action === 'status') return collectSceneStatus()
        if (action === 'capture') {
          const saved = await captureScene(
            {
              width: args.width,
              format: args.format,
              include_hud: args.include_hud,
              label: args.label,
            },
            session,
          )
          return {
            path: saved.path,
            url: redactUrl(saved.url),
            width: saved.width,
            height: saved.height,
            bytes: saved.bytes,
            hud_hidden: saved.hud !== true,
            layers_visible: layersRef.current.filter((layer) => layer.visible).length,
            view: (await collectSceneStatus()).view,
          }
        }
        // B2 analysis bridge: profile / flood / sunlight / clear (Host tool
        // `earth_analyze`); the Host validates the operation before sending it.
        // Checked before the generic readiness guard so every analysis failure
        // (including a cold viewer) carries an actionable "next:" step.
        if (action === 'analyze') {
          try {
            return await analyzeCommand(args)
          } catch (error) {
            const text = message(error)
            // Every analysis failure must end in an actionable next step.
            if (text.includes('next:')) throw error
            throw new Error(`${text} next: 用 earth_scene 检查面板与数据状态后重试，或先执行 analyze clear。`)
          }
        }
        // B3 shader bridge: apply / reset / list (Host tool `earth_shader`). Like
        // analysis, it is checked before the generic readiness guard so a cold
        // viewer still produces a model-facing "next:" instead of a dead end.
        if (action === 'shader') {
          try {
            return await shaderCommand(args)
          } catch (error) {
            const text = message(error)
            if (text.includes('next:')) throw error
            throw new Error(`${text} next: 用 earth_scene 的 list 动作确认图层后，先 shader reset 再重试。`)
          }
        }
        if (!Cesium || !viewer) throw new Error(t('agent.notReady'))

        if (action === 'inspect') {
          const layer = requireLayer()
          const source = sourceOfLayer(layer)
          if (!source) throw new Error(t('agent.unknownSource', { name: layer.name }))
          // The Host analyses the tileset itself; the panel only resolves the
          // layer to its original source and adds live runtime counters.
          return { layer: layer.name, source, runtime: layerRuntime(layer) }
        }
        if (action === 'list') {
          const status = await collectSceneStatus()
          return { layers: status.layers, sources: status.sources, imagery: status.imagery, terrain: status.terrain }
        }
        if (action === 'load') {
          const rawPath = typeof args.path === 'string' ? args.path.trim() : ''
          let url = typeof args.url === 'string' ? args.url.trim() : ''
          if (!url && rawPath) {
            try {
              url = /^https?:/i.test(rawPath) ? rawPath : await localPathToUrl(rawPath)
            } catch (error) {
              throw new Error(t('agent.dirDenied', { message: message(error) }))
            }
          }
          // Local tiles are served through the Host's own token route, which is a
          // same-origin path (`/api/3dviewer/tiles/...`) rather than an absolute
          // http(s) URL. Accepting only http(s) here made every `path` load fail
          // with "agent.missingUrl" even after the folder was authorised.
          const localTilesBase = typeof metaRef.current?.tilesBase === 'string' ? metaRef.current.tilesBase : ''
          const isHostTilesUrl = localTilesBase !== '' && url.startsWith(localTilesBase)
          if (!/^https?:\/\//i.test(url) && !isHostTilesUrl) throw new Error(t('agent.missingUrl'))
          const label = rawPath
            ? rawPath.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')
            : undefined
          const source = rawPath && !/^https?:\/\//i.test(rawPath)
            ? { kind: 'local', path: rawPath }
            : { kind: 'remote', url: rawPath || url }
          const layer = await loadTileset(url, label, source)
          return {
            loaded: true,
            layer: { id: layer.id, name: layer.name, url: redactUrl(layer.url) },
            view: (await collectSceneStatus()).view,
            layers_count: layersRef.current.length,
          }
        }
        if (action === 'remove') {
          const layer = requireLayer()
          removeLayer(layer.id)
          return { removed: layer.name, layers: layersRef.current.map((item) => item.name) }
        }
        if (action === 'visible') {
          if (typeof args.visible !== 'boolean') throw new Error('Provide visible (true or false).')
          const layer = requireLayer()
          setLayerVisible(layer.id, args.visible)
          return { id: layer.id, name: layer.name, visible: layer.visible }
        }
        if (action === 'basemap') {
          const id = typeof args.imagery === 'string' && args.imagery !== '' ? args.imagery : null
          if (id === null) {
            const outcome = await applyImagery(null, false)
            if (!outcome.ok) throw new Error(outcome.error)
            updateSettings({ imagery: null })
            return { imagery: null }
          }
          const source = config.imagery.find((item) => item.id === id || item.name === id) ?? null
          if (!source) {
            throw new Error(
              t('agent.unknownImagery', {
                name: id,
                list: config.imagery.map((item) => `${item.id} (${item.name})`).join(', ') || '—',
              }),
            )
          }
          const outcome = await applyImagery(source.id, false)
          if (!outcome.ok) throw new Error(outcome.error)
          updateSettings({ imagery: source.id })
          return { imagery: { id: source.id, name: source.name } }
        }
        if (action === 'terrain') {
          const id = typeof args.terrain === 'string' && args.terrain !== '' ? args.terrain : null
          if (id === null) {
            const outcome = await applyTerrain(null, false)
            if (!outcome.ok) throw new Error(outcome.error)
            updateSettings({ terrain: null })
            return { terrain: null }
          }
          const source = config.terrain.find((item) => item.id === id || item.name === id) ?? null
          if (!source) {
            throw new Error(
              t('agent.unknownTerrain', {
                name: id,
                list: config.terrain.map((item) => `${item.id} (${item.name})`).join(', ') || '—',
              }),
            )
          }
          const outcome = await applyTerrain(source.id, false)
          if (!outcome.ok) throw new Error(outcome.error)
          updateSettings({ terrain: source.id })
          return { terrain: { id: source.id, name: source.name } }
        }
        if (action === 'fly') {
          if (typeof args.lon !== 'number' || typeof args.lat !== 'number') throw new Error(t('agent.missingCoords'))
          const height = clampNumber(args.height, 1500, 1, 40000000)
          const heading = clampNumber(args.heading, 0, -360, 360)
          const pitch = clampNumber(args.pitch, -45, -90, 90)
          const duration = clampNumber(args.duration, 1.2, 0, 5)
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(args.lon, args.lat, height),
            orientation: {
              heading: Cesium.Math.toRadians(heading),
              pitch: Cesium.Math.toRadians(pitch),
              roll: 0,
            },
            duration,
          })
          await delay(duration * 1000 + 200)
          return { view: (await collectSceneStatus()).view }
        }
        if (action === 'reset') {
          resetView()
          await delay(1400)
          return { view: (await collectSceneStatus()).view }
        }
        if (action === 'pick') {
          const position = new Cesium.Cartesian2(
            Math.round(viewer.canvas.clientWidth / 2),
            Math.round(viewer.canvas.clientHeight / 2),
          )
          return pickResult(position)
        }
        if (action === 'draw') {
          if (args.clear === true) clearAgentOverlays('all')
          const outcome = args.geojson !== undefined
            ? drawAgentOverlay(Cesium, viewer, args.geojson, args.style, args.label)
            : { drawn: 0, by_type: { points: 0, lines: 0, polygons: 0 }, bbox: null }
          const value = {
            ok: true,
            cleared: args.clear === true,
            drawn: outcome.drawn,
            by_type: outcome.by_type,
            bbox: outcome.bbox,
            overlays: agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length,
          }
          if (typeof args.label === 'string' && args.label !== '') value.label = args.label
          return value
        }
        if (action === 'measure') {
          if (args.clear === true) clearAgentOverlays('all')
          const value = measureAgentOverlay(Cesium, viewer, args)
          value.cleared = args.clear === true
          value.overlays = agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length
          return value
        }
        if (action === 'report') {
          const meta = metaRef.current
          if (!meta?.reportUrl) throw new Error(t('agent.notReady'))
          const report = await buildSceneReport(args)
          const response = await fetch(meta.reportUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(report),
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const saved = await response.json()
          return {
            operation: 'report',
            path: saved.path,
            format: saved.format ?? report.format,
            bytes: saved.bytes,
            title: report.title,
            sections: report.sections,
            failed: report.failed,
          }
        }
        throw new Error(t('agent.badAction', { action: String(action) }))
      }
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
        const onCommand = (event) => {
          let payload
          try {
            payload = JSON.parse(event.data)
          } catch {
            return
          }
          if (!payload?.id) return
          commandChainRef.current = commandChainRef.current
            .then(async () => {
              try {
                // The authorisation dialog only needs meta + DOM: answer it while
                // Cesium is still booting so the Host's 30 s deadline is not spent
                // waiting for the engine.
                if (payload.action !== 'authorize') await waitForPanelReady()
                const result = await commandRef.current(payload.action, payload.args ?? {}, bridgeSession)
                await ack({ session: bridgeSession, id: payload.id, ok: true, result })
              } catch (error) {
                await ack({ session: bridgeSession, id: payload.id, ok: false, error: message(error) })
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
        source.addEventListener('error', onError)
        setBridgeOn(false)
        return () => {
          if (retryTimer !== null) clearTimeout(retryTimer)
          source.removeEventListener('hello', onHello)
          source.removeEventListener('command', onCommand)
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
            viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#060a12')
            // Apply the persisted render tier before the first frame: resolution
            // scale and terrain LOD are the two biggest per-frame costs.
            applyQuality(viewer, catalog.config.settings?.quality)
            viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(104, 31, 14000000) })
            await applyImagery(catalog.config.settings.imagery, false)
            if (catalog.config.settings.terrain) await applyTerrain(catalog.config.settings.terrain, false)
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
            await overlayLayersRef.current.sync(catalog.config.rasterOverlays ?? [])
            const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
            handler.setInputAction((event) => onCanvasClick(event.position), Cesium.ScreenSpaceEventType.LEFT_CLICK)
            handler.setInputAction(
              (event) => {
                // A double click finishes a measurement when a tool is active;
                // otherwise it is a "bring that spot here" gesture.
                if (toolRef.current) {
                  finishMeasure()
                  return
                }
                const viewerNow = viewerRef.current
                const scene = viewerNow?.scene
                if (!viewerNow || !scene) return
                const carto = sampleCursor(viewerNow, Cesium, event.position, { pickPosition: true })
                if (carto) flyToCartographic(viewerNow, Cesium, carto)
              },
              Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
            )
            handlerRef.current = handler
            // A camera move is the most frequent scene change: mark it dirty and
            // let the short timer batch the localStorage write.
            viewer.camera.moveEnd.addEventListener(markSceneDirty)
            // Rebuild the scene this session had when its tab body was disposed;
            // commands wait for this so they cannot race the restored camera. The
            // host store is tried first (it survives origin changes), then the
            // localStorage cache.
            const savedScene = typeof sessionId === 'string' && sessionId !== '' ? await loadSceneSnapshot(sessionId) : null
            if (savedScene !== null) {
              await restoreSceneSnapshot(savedScene)
              if (cancelled) return
            }
            sceneRestoredRef.current = typeof sessionId === 'string' && sessionId !== ''
            settleReadyWaiters()
            setPhase('ready')
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
          // B3: detach the u_time tick and forget per-layer shader entries before
          // the viewer goes away; the tilesets themselves are destroyed with it.
          releaseShaderTick()
          shaderEntriesRef.current.clear()
          // Drop the L3 overlay layers with the viewer; the queued removals are
          // no-ops if the scene is already gone.
          void overlayLayersRef.current?.dispose()
          overlayLayersRef.current = null
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
        if (openMenu === 'data') refreshRecentDirs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [openMenu, meta?.directoriesUrl])

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

      const status = busy || (phase === 'loading' ? t('panel.status.loading') : layers.length ? t('panel.status.layers', { n: layers.length }) : t('panel.status.ready'))
      const hudLabels = {
        pointer: t('hud.pointer'),
        camera: t('hud.camera'),
        heading: t('hud.heading'),
        tiles: t('hud.tiles'),
        pending: t('hud.pending'),
        triangles: t('hud.triangles'),
        cache: t('hud.cache'),
      }

      // B3 workbench wiring lives in src/client/ui/workbench-wiring.js; this
      // component only owns the form state and the scene refs the wiring needs.
      const workbench = createWorkbenchWiring({
        getForm: () => shaderForm,
        getLayers: () => layers,
        setShaderForm,
        shaderCommand,
        showToast,
        t,
      })

      return h(
        'div',
        {
          ref: rootRef,
          className: `mv-root${docked ? ' mv-docked' : ''}`,
          'data-mv-theme': themeMode === 'auto' ? undefined : themeMode,
          'data-mv-scheme': resolvedDark ? 'dark' : 'light',
        },
        h('style', { key: 'css' }, CSS),
        h('div', { key: 'globe', ref: globeRef, className: 'mv-globe' }),
        activeImagery?.credit
          ? h('div', { key: 'attr', className: 'mv-attr' }, `${t('credit.imagery')} © ${activeImagery.credit}`)
          : null,
        h('div', { key: 'credits', ref: creditRef, className: 'mv-credits' }),
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
            menu(
              'measure',
              t('btn.measure'),
              [
                h(MenuItem, { key: 'distance', active: tool === 'distance', onClick: () => setToolMode(tool === 'distance' ? null : 'distance') }, t('tool.distance')),
                h(MenuItem, { key: 'area', active: tool === 'area', onClick: () => setToolMode(tool === 'area' ? null : 'area') }, t('tool.area')),
                h(MenuItem, { key: 'height', active: tool === 'height', onClick: () => setToolMode(tool === 'height' ? null : 'height') }, t('tool.height')),
                h(MenuItem, { key: 'pick', active: tool === 'pick', onClick: () => setToolMode(tool === 'pick' ? null : 'pick') }, t('tool.pick')),
              ],
              tool !== null,
            ),
            h('i', { key: 's2', className: 'mv-sep' }),
            button(
              `${t('btn.layers')}${layers.length ? ` ${layers.length}` : ''}`,
              () => updateSettings({ showLayers: !showLayers }),
              // The panel is the only place to pick terrain/basemap now, so it must
              // be reachable even with zero 3D Tiles loaded.
              showLayers,
              undefined,
              showLayers ? t('btn.layersHide') : t('btn.layersShow'),
            ),
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
            // Action buttons are icon-only with a tooltip/aria-label: in the docked
            // narrow panel the text labels were what wrapped the toolbar onto a
            // second row. The four dropdown menus keep their text labels because a
            // bare icon does not tell the user what the menu contains.
            iconButton(h(ScreenshotIcon), t('btn.screenshot'), screenshot),
            sessionId ? iconButton(h(AskAgentIcon), t('btn.askAgent'), askAgent) : null,
            iconButton(h(ResetIcon), t('btn.reset'), resetView),
            docked
              ? iconButton(h(FullscreenIcon), t('btn.maximizeTitle'), togglePaneFullscreen)
              : button(t('btn.beside'), openBeside),
            // Real fullscreen works from both mounts; the sidebar-maximize button
            // above is a docked-only layout action, not fullscreen.
            iconButton(h(FullscreenIcon), fullscreen ? t('btn.fullscreenExit') : t('btn.fullscreenTitle'), toggleDomFullscreen, fullscreen),
            h('i', { key: 's3', className: 'mv-sep' }),
            h(
              'div',
              { key: 'appearance', className: 'mv-menu' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-btn icon',
                  title: `${t('btn.appearance')} · ${t(themeMode === 'auto' ? 'theme.auto' : themeMode === 'light' ? 'theme.light' : 'theme.dark')}`,
                  'aria-haspopup': 'menu',
                  onClick: () => setOpenMenu(openMenu === 'appearance' ? null : 'appearance'),
                },
                h(ThemeIcon, { mode: resolvedDark ? 'dark' : 'light' }),
              ),
              openMenu === 'appearance'
                ? h(
                    'div',
                    { className: 'mv-menu-panel mv-glass' },
                    [
                      ['auto', 'theme.auto'],
                      ['light', 'theme.light'],
                      ['dark', 'theme.dark'],
                    ].map(([mode, label]) =>
                      h(
                        MenuItem,
                        {
                          key: mode,
                          active: themeMode === mode,
                          onClick: () => setTheme(mode),
                        },
                        t(label),
                      ),
                    ),
                  )
                : null,
            ),
            h(
              'button',
              {
                key: 'settings',
                type: 'button',
                className: 'mv-btn icon',
                title: t('btn.settings'),
                onClick: () => setSettingsOpen(true),
              },
              h(
                'svg',
                { viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': true, style: { display: 'block' } },
                h('g', { stroke: 'currentColor', strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round' },
                  h('circle', { cx: 12, cy: 12, r: 3.2 }),
                  h('path', { d: 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z' }),
                ),
              ),
            ),
          ),
        ),
        urlBar
          ? h(
              'div',
              { key: 'urlbar', className: 'mv-urlbar mv-glass' },
              h('input', {
                autoFocus: true,
                value: urlInput,
                placeholder: t('urlbar.placeholder'),
                onChange: (event) => setUrlInput(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') submitUrl()
                  if (event.key === 'Escape') setUrlBar(false)
                },
              }),
              h('button', { type: 'button', onClick: submitUrl }, t('urlbar.submit')),
            )
          : null,
        shaderOpen
          ? h(ShaderWorkbench, {
              key: 'shader',
              t,
              layers,
              form: shaderForm,
              active: shaderActive,
              onClose: () => setShaderOpen(false),
              onLayer: (layerId) => workbench.field('layerId', layerId),
              onPreset: workbench.toggle,
              onField: workbench.field,
              onApply: workbench.apply,
              onResetLayer: workbench.resetLayer,
              onResetAll: workbench.resetAll,
            })
          : null,
        analysis || showLayers
          ? h(
              'div',
              { key: 'right', className: 'mv-right' },
              analysis
                ? h(AnalysisCard, { key: 'analysis', state: analysis, t, onClose: () => clearAnalysis() })
                : null,
              showLayers
                ? h(LayersPanel, {
                    key: 'layers',
                    t,
                    config: sources,
                    settings: sources?.settings ?? {},
                    layers,
                    annotations: {
                      drawn_features: agentOverlayRef.current.drawnFeatures,
                      measured_points: agentOverlayRef.current.measuredCount,
                    },
                    onCollapse: () => updateSettings({ showLayers: false }),
                    onSelectTerrain: changeTerrain,
                    onSelectImagery: changeImagery,
                    onFlyLayer: flyToLayer,
                    onFrameAll: () => frameAllLayers(viewerRef.current, cesiumRef.current, layersRef.current),
                    analysis,
                    onClearAnalysis: () => clearAnalysis(),
                    onToggleLayer: toggleLayer,
                    onInspectLayer: inspectLayer,
                    onRemoveLayer: removeLayer,
                    onOverlayAdd: addOverlay,
                    onOverlayRemove: removeOverlay,
                    onOverlayOpacity: setOverlayOpacity,
                    onOverlayVisible: setOverlayVisible,
                    onOverlayMove: moveOverlay,
                    onClearVector: () => clearAgentOverlays('all'),
                    agentOverlays: buildAgentOverlayList(agentOverlayRef.current),
                    onRemoveAgentOverlay: (kind, index) => {
                      if (!removeAgentOverlay(agentOverlayRef.current, viewerRef.current, kind, index)) return
                      syncAgentOverlayCount()
                      markSceneDirty()
                    },
                  })
                : null,
            )
          : null,
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
          ? h('div', { key: 'loading', className: 'mv-overlay dim' }, h('div', { className: 'mv-empty' }, h('div', { className: 'mv-spinner' }), h('p', null, t('panel.status.loading'))))
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
          ? h(StatusHud, { key: 'hud', fps, stats, viewerRef, cesiumRef, labels: hudLabels, readoutRef: captureReadoutRef })
          : null,
        measureInfo ? h('div', { key: 'measure', className: 'mv-measure mv-glass' }, measureInfo.text) : null,
        pickInfo
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
          ? h(
              'div',
              { key: 'scan', className: 'mv-modal', onPointerDown: (event) => event.target === event.currentTarget && setScan(null) },
              h(
                'div',
                { className: 'mv-dialog' },
                h(
                  'header',
                  null,
                  h('b', null, t('layers.title')),
                  h('span', { className: 'path', style: { fontWeight: 400, color: 'var(--mv-dim)' } }, scan.dir),
                  h('button', { type: 'button', className: 'mv-icon-btn', onClick: () => setScan(null), title: t('btn.close') }, '✕'),
                ),
                h(
                  'div',
                  { className: 'body' },
                  scan.items.map((item) =>
                    h(
                      'button',
                      {
                        key: item.url,
                        type: 'button',
                        className: 'mv-cta',
                        style: { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' },
                        onClick: () =>
                          addTileset(item.url, item.name.split(/[\\/]/).filter(Boolean).slice(-2).join('/'), {
                            kind: 'local',
                            path: joinLocalPath(scan.dir, item.name),
                          }),
                      },
                      h('span', null, item.name),
                    ),
                  ),
                ),
              ),
            )
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
