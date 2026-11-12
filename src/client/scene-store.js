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
    const SNAPSHOT_EXTRA_ANALYSIS_ACTIONS = ['clip', 'skyline']

    const isSnapshotAnalysis = (analysis) =>
      analysis !== null &&
      typeof analysis === 'object' &&
      typeof analysis.action === 'string' &&
      (SNAPSHOT_ANALYSIS_ACTIONS.includes(analysis.action) || SNAPSHOT_EXTRA_ANALYSIS_ACTIONS.includes(analysis.action))

    const isSnapshotPresetStack = (preset) =>
      Array.isArray(preset) &&
      preset.length >= 1 &&
      preset.length <= 3 &&
      preset.every((entry) => typeof entry === 'string' && entry.trim() !== '')

    const isSnapshotShader = (item) =>
      item !== null &&
      typeof item === 'object' &&
      ((typeof item.layer === 'string' && typeof item.preset === 'string') ||
        (typeof item.layer === 'string' && isSnapshotPresetStack(item.preset)))

    /**
     * F02: a save that had to omit annotations records what it dropped, so the
     * restore can tell the user instead of the scene silently losing data.
     */
    const normalizeSnapshotCompaction = (value) => {
      if (value === null || typeof value !== 'object') return null
      if (typeof value.level !== 'string' || value.level === '') return null
      const count = (key) =>
        typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] > 0 ? Math.round(value[key]) : 0
      const compacted = {
        level: value.level,
        dropped_draw: count('dropped_draw'),
        dropped_features: count('dropped_features'),
        dropped_measure: count('dropped_measure'),
      }
      const total = compacted.dropped_draw + compacted.dropped_features + compacted.dropped_measure
      return total > 0 ? compacted : null
    }

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
            preset: Array.isArray(item.preset) ? item.preset.slice() : item.preset,
            params: item.params !== null && typeof item.params === 'object' ? item.params : {},
          }))
        : []
      const compaction = normalizeSnapshotCompaction(snapshot.compacted)
      return {
        ...(typeof snapshot.savedAt === 'string' && snapshot.savedAt !== '' ? { savedAt: snapshot.savedAt } : {}),
        ...(compaction !== null ? { compacted: compaction } : {}),
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

    function compactSnapshotCoords(coords) {
      if (!Array.isArray(coords)) return coords
      if (typeof coords[0] === 'number') {
        const lon = Math.round(coords[0] * 1e6) / 1e6
        const lat = typeof coords[1] === 'number' ? Math.round(coords[1] * 1e6) / 1e6 : 0
        return [lon, lat]
      }
      return coords.map(compactSnapshotCoords)
    }

    function compactSnapshotGeometry(geometry) {
      if (geometry === null || typeof geometry !== 'object') return geometry
      if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
        return { type: 'GeometryCollection', geometries: geometry.geometries.map(compactSnapshotGeometry) }
      }
      return { type: geometry.type, coordinates: compactSnapshotCoords(geometry.coordinates) }
    }

    function compactSnapshotProperties(properties) {
      if (properties === null || typeof properties !== 'object') return undefined
      const out = {}
      if (typeof properties.name === 'string' && properties.name !== '') out.name = properties.name.slice(0, 160)
      let count = 0
      for (const [key, value] of Object.entries(properties)) {
        if (key === 'name' || value === null || value === undefined) continue
        if (count >= 12) break
        out[key] = typeof value === 'string' && value.length > 160 ? value.slice(0, 160) : value
        count += 1
      }
      return Object.keys(out).length > 0 ? out : undefined
    }

    function compactDrawCommand(command) {
      if (command === null || typeof command !== 'object' || !Array.isArray(command.geojson?.features)) return command
      const features = command.geojson.features.map((feature) => {
        if (feature === null || typeof feature !== 'object') return feature
        const props = compactSnapshotProperties(feature.properties)
        return {
          type: 'Feature',
          ...(feature.id !== undefined ? { id: feature.id } : {}),
          geometry: compactSnapshotGeometry(feature.geometry),
          ...(props ? { properties: props } : {}),
        }
      })
      return { ...command, geojson: { type: 'FeatureCollection', features } }
    }

    /**
     * Compact oversized GeoJSON overlays (6-decimal coords + 12 UI properties) and,
     * if still over budget, retain the newest draw commands/features that fit before
     * falling back to dropping annotations. Leaves room for the host `{session,snapshot}` envelope.
     *
     * Returns `{ text, compacted }`. `compacted` is `null` when the whole scene fits;
     * otherwise it describes what was dropped so the panel can tell the user instead
     * of silently shrinking the saved scene (F02).
     */
    function fitSnapshotBodyToBudget(body, maxBytes = SCENE_STORE_MAX_BYTES) {
      const budget = Math.max(1024, maxBytes - 1024)
      const drawList = Array.isArray(body.annotations?.draw) ? body.annotations.draw.map(compactDrawCommand) : []
      const measureList = Array.isArray(body.annotations?.measure) ? body.annotations.measure : []
      const totalFeatures = drawList.reduce(
        (sum, command) => sum + (Array.isArray(command?.geojson?.features) ? command.geojson.features.length : 0),
        0,
      )
      body.annotations = { draw: drawList, measure: measureList }
      let text = JSON.stringify(body)
      if (text.length <= budget) return { text, compacted: null }

      const keptDraw = []
      body.annotations = { draw: keptDraw, measure: measureList }
      text = JSON.stringify(body)
      let stopIndex = -1
      let partialKept = 0
      for (let index = drawList.length - 1; index >= 0; index -= 1) {
        const cmd = drawList[index]
        keptDraw.unshift(cmd)
        const candidate = JSON.stringify(body)
        if (candidate.length <= budget) {
          text = candidate
          continue
        }
        keptDraw.shift()
        stopIndex = index
        const features = Array.isArray(cmd?.geojson?.features) ? cmd.geojson.features : []
        if (features.length > 1) {
          let low = 1
          let high = features.length
          let best = null
          while (low <= high) {
            const mid = (low + high) >> 1
            const partial = { ...cmd, drawn: mid, geojson: { type: 'FeatureCollection', features: features.slice(0, mid) } }
            keptDraw.unshift(partial)
            const attempt = JSON.stringify(body)
            keptDraw.shift()
            if (attempt.length <= budget) {
              best = { partial, attempt }
              low = mid + 1
            } else {
              high = mid - 1
            }
          }
          if (best) {
            keptDraw.unshift(best.partial)
            text = best.attempt
            partialKept = best.partial.drawn
          }
        }
        break
      }
      // Older commands never get a turn once one stops fitting, so count every omitted
      // feature (not just the first failure) or the marker under-reports the loss.
      let droppedDraw = 0
      let droppedFeatures = 0
      if (stopIndex >= 0) {
        droppedDraw = stopIndex + 1
        for (let index = 0; index < stopIndex; index += 1) {
          const features = drawList[index]?.geojson?.features
          droppedFeatures += Array.isArray(features) ? features.length : 0
        }
        const failed = drawList[stopIndex]?.geojson?.features
        droppedFeatures += (Array.isArray(failed) ? failed.length : 0) - partialKept
      }
      if (text.length <= maxBytes) {
        const compacted =
          droppedDraw + droppedFeatures > 0
            ? { level: 'features', dropped_draw: droppedDraw, dropped_features: droppedFeatures, dropped_measure: 0 }
            : null
        return { text, compacted }
      }

      body.annotations = { draw: [], measure: [] }
      body.analysis = null
      return {
        text: JSON.stringify(body),
        compacted: {
          level: 'annotations',
          dropped_draw: drawList.length,
          dropped_features: totalFeatures,
          dropped_measure: measureList.length,
        },
      }
    }

    /**
     * Persist the snapshot body to the local cache and return the body so the
     * caller can also hand it to the host store. Returns null only when the
     * snapshot cannot be serialized.
     */
    function writeSceneSnapshot(sessionId, snapshot) {
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const savedAt =
        typeof snapshot?.savedAt === 'string' && snapshot.savedAt !== '' ? snapshot.savedAt : new Date().toISOString()
      const body = { v: SCENE_STORE_VERSION, ...snapshot, savedAt }
      // Never carry a stale marker from a previous save into this one.
      delete body.compacted
      let text = ''
      try {
        text = JSON.stringify(body)
      } catch {
        return null
      }
      // Compact GeoJSON coordinates/properties first so large vector imports and
      // Agent annotations survive refresh; only drop overlays if the base scene itself exceeds quota.
      if (text.length > SCENE_STORE_MAX_BYTES - 1024) {
        let fitted = null
        try {
          // Leave headroom so the `compacted` marker itself still fits.
          fitted = fitSnapshotBodyToBudget(body, SCENE_STORE_MAX_BYTES - 512)
        } catch {
          return null
        }
        if (fitted.compacted !== null) body.compacted = fitted.compacted
        try {
          text = JSON.stringify(body)
        } catch {
          return null
        }
        if (typeof text !== 'string' || text.length > SCENE_STORE_MAX_BYTES) return null
      }
      const store = sceneStorage()
      if (store) {
        try {
          trimSceneSnapshots(store, sceneStoreKey(sessionId))
          store.setItem(sceneStoreKey(sessionId), text)
        } catch {
          // Quota or privacy mode: the local cache stays best effort; the host
          // store below still gets the body.
        }
      }
      return body
    }
    //#endregion scene persistence

export { SCENE_STORE_PREFIX, SCENE_STORE_VERSION, SCENE_STORE_MAX_ENTRIES, SCENE_STORE_MAX_BYTES, sceneStoreKey, sceneStorage, isSnapshotView, isSnapshotLayer, SNAPSHOT_ANALYSIS_ACTIONS, isSnapshotAnalysis, isSnapshotShader, normalizeSceneSnapshot, readSceneSnapshot, trimSceneSnapshots, writeSceneSnapshot }
