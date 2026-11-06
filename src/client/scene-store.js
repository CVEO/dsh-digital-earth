/**
 * scene-store.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */

    //#region scene persistence -----------------------------------------------
    // The right sidebar may dispose a session's tab body when the user visits
    // another session or window, which would otherwise drop the globe state. The
    // scene is snapshotted per session in localStorage (camera, layers by source,
    // Agent overlays) and rebuilt when the panel mounts again. It is page-local
    // data: sources were already authorised by the user, and snapshots are
    // trimmed so many sessions cannot exhaust the origin quota.
    const SCENE_STORE_PREFIX = 'dsh.digital-earth.scene.'
    const SCENE_STORE_VERSION = 1
    const SCENE_STORE_MAX_ENTRIES = 12
    const SCENE_STORE_MAX_BYTES = 512 * 1024

    const sceneStoreKey = (sessionId) => `${SCENE_STORE_PREFIX}${sessionId}`

    const sceneStorage = () => {
      try {
        return typeof window !== 'undefined' ? window.localStorage : null
      } catch {
        return null
      }
    }

    /** Snapshot guard: storage can hold data written by an older or broken build. */
    const isSnapshotView = (view) =>
      view !== null &&
      typeof view === 'object' &&
      ['lon', 'lat', 'height', 'heading', 'pitch'].every(
        (key) => typeof view[key] === 'number' && Number.isFinite(view[key]),
      )

    const isSnapshotLayer = (layer) =>
      layer !== null &&
      typeof layer === 'object' &&
      typeof layer.name === 'string' &&
      layer.source !== null &&
      typeof layer.source === 'object' &&
      (typeof layer.source.path === 'string' || typeof layer.source.url === 'string')

    const SNAPSHOT_ANALYSIS_ACTIONS = ['profile', 'flood', 'sunlight']

    const isSnapshotAnalysis = (analysis) =>
      analysis !== null &&
      typeof analysis === 'object' &&
      typeof analysis.action === 'string' &&
      SNAPSHOT_ANALYSIS_ACTIONS.includes(analysis.action)

    const isSnapshotShader = (item) =>
      item !== null && typeof item === 'object' && typeof item.layer === 'string' && typeof item.preset === 'string'

    /** Normalize one stored snapshot body (localStorage or the host route). */
    function normalizeSceneSnapshot(snapshot) {
      if (snapshot === null || typeof snapshot !== 'object' || snapshot.v !== SCENE_STORE_VERSION) return null
      const layers = (Array.isArray(snapshot.layers) ? snapshot.layers : [])
        .filter(isSnapshotLayer)
        .map((layer) => ({ name: layer.name, source: layer.source, visible: layer.visible !== false }))
      const draw = Array.isArray(snapshot.annotations?.draw)
        ? snapshot.annotations.draw.filter((command) => command !== null && typeof command === 'object' && command.geojson !== undefined)
        : []
      const measure = Array.isArray(snapshot.annotations?.measure)
        ? snapshot.annotations.measure.filter(
            (command) => command !== null && typeof command === 'object' && typeof command.mode === 'string' && Array.isArray(command.points),
          )
        : []
      const shaders = Array.isArray(snapshot.shaders)
        ? snapshot.shaders.filter(isSnapshotShader).map((item) => ({
            layer: item.layer,
            preset: item.preset,
            params: item.params !== null && typeof item.params === 'object' ? item.params : {},
          }))
        : []
      return {
        view: isSnapshotView(snapshot.view) ? snapshot.view : null,
        layers,
        annotations: { draw, measure },
        analysis: isSnapshotAnalysis(snapshot.analysis) ? snapshot.analysis : null,
        shaders,
      }
    }

    function readSceneSnapshot(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const store = sceneStorage()
      if (!store) return null
      try {
        const raw = store.getItem(sceneStoreKey(sessionId))
        if (typeof raw !== 'string' || raw === '') return null
        return normalizeSceneSnapshot(JSON.parse(raw))
      } catch {
        return null
      }
    }

    /** Drop the oldest snapshots so the store stays bounded across sessions. */
    function trimSceneSnapshots(store, keepKey) {
      try {
        const entries = []
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index)
          if (typeof key !== 'string' || !key.startsWith(SCENE_STORE_PREFIX) || key === keepKey) continue
          let savedAt = ''
          try {
            const parsed = JSON.parse(store.getItem(key))
            if (typeof parsed?.savedAt === 'string') savedAt = parsed.savedAt
          } catch {
            // Unreadable entry sorts first and is removed before valid ones.
          }
          entries.push({ key, savedAt })
        }
        entries.sort((left, right) => left.savedAt.localeCompare(right.savedAt))
        const excess = entries.length + 1 - SCENE_STORE_MAX_ENTRIES
        for (let index = 0; index < excess; index += 1) store.removeItem(entries[index].key)
      } catch {
        // Quota or privacy mode: persistence stays best effort.
      }
    }

    /**
     * Persist the snapshot body to the local cache and return the body so the
     * caller can also hand it to the host store. Returns null only when the
     * snapshot cannot be serialized.
     */
    function writeSceneSnapshot(sessionId, snapshot) {
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const body = { v: SCENE_STORE_VERSION, savedAt: new Date().toISOString(), ...snapshot }
      let text = ''
      try {
        text = JSON.stringify(body)
      } catch {
        return null
      }
      // Overlays and analyses are reconstructible from the conversation, so drop
      // them first rather than lose the camera and layer list to the quota.
      if (text.length > SCENE_STORE_MAX_BYTES) {
        body.annotations = { draw: [], measure: [] }
        body.analysis = null
        try {
          text = JSON.stringify(body)
        } catch {
          return null
        }
        if (text.length > SCENE_STORE_MAX_BYTES) return null
      }
      const store = sceneStorage()
      if (store) {
        try {
          store.setItem(sceneStoreKey(sessionId), text)
          trimSceneSnapshots(store, sceneStoreKey(sessionId))
        } catch {
          // Quota or privacy mode: the local cache stays best effort; the host
          // store below still gets the body.
        }
      }
      return body
    }
    //#endregion scene persistence

export { SCENE_STORE_PREFIX, SCENE_STORE_VERSION, SCENE_STORE_MAX_ENTRIES, SCENE_STORE_MAX_BYTES, sceneStoreKey, sceneStorage, isSnapshotView, isSnapshotLayer, SNAPSHOT_ANALYSIS_ACTIONS, isSnapshotAnalysis, isSnapshotShader, normalizeSceneSnapshot, readSceneSnapshot, trimSceneSnapshots, writeSceneSnapshot }
