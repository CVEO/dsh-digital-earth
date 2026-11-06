/**
 * scene/command-bridge.js — the panel command dispatcher.
 *
 * Extracted from ViewerSurface in v1.6 Phase 2: every earth_scene action plus the
 * internal authorize/capture/analyze/shader/report commands, each returning a
 * model-readable value or throwing an actionable error. Handlers and refs are
 * injected so the module holds no React state and cannot pin a stale viewer.
 */
export function createCommandBridge(deps) {
  const cesiumRef = { get current() { return deps.getCesium() } }
  const viewerRef = { get current() { return deps.getViewer() } }
  const sourcesRef = { get current() { return deps.getSources() } }
  const layersRef = { get current() { return deps.getLayers() } }
  const metaRef = { get current() { return deps.getMeta() } }
  const agentOverlayRef = { get current() { return deps.getAgentOverlays() } }
  const t = deps.t
  const findLayer = deps.findLayer
  const normalizeAccessRequest = deps.normalizeAccessRequest
  const askPathAccess = deps.askPathAccess
  const collectSceneStatus = deps.collectSceneStatus
  const captureScene = deps.captureScene
  const redactUrl = deps.redactUrl
  const analyzeCommand = deps.analyzeCommand
  const shaderCommand = deps.shaderCommand
  const message = deps.message
  const sourceOfLayer = deps.sourceOfLayer
  const layerRuntime = deps.layerRuntime
  const localPathToUrl = deps.localPathToUrl
  const loadTileset = deps.loadTileset
  const removeLayer = deps.removeLayer
  const setLayerVisible = deps.setLayerVisible
  const applyImagery = deps.applyImagery
  const updateSettings = deps.updateSettings
  const applyTerrain = deps.applyTerrain
  const clampNumber = deps.clampNumber
  const delay = deps.delay
  const resetView = deps.resetView
  const pickResult = deps.pickResult
  const clearAgentOverlays = deps.clearAgentOverlays
  const drawAgentOverlay = deps.drawAgentOverlay
  const measureAgentOverlay = deps.measureAgentOverlay
  const buildSceneReport = deps.buildSceneReport

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

  return { runCommand }
}
