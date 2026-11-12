/**
 * analysis/engine.js — the profile / flood / sunlight engine.
 *
 * Extracted verbatim from ViewerSurface in v1.6 (Phase 2 of the client split):
 * ViewerSurface was at its line budget and the engine is the one large block that
 * only needs the viewer, the layer list and a handful of callbacks. Keeping the
 * code text unchanged keeps the existing structural tests honest: the same
 * \`//#region analysis engine\` block, the same function names and the same
 * error messages still exist — they just live in a module now.
 *
 * The factory receives lazy ref getters instead of the refs themselves so the
 * module never holds a stale viewer/layer list across panel remounts.
 */
import { createHeightService } from './height-service.js'
import { resolveAnalysisTarget } from './source-policy.js'
import { ANALYSIS_ENTITY_PREFIX, ANALYSIS_MIN_SAMPLES, analysisClipPlane, analysisColorAt, analysisInteger, analysisLocalizeClipPlane, analysisLonLat, analysisObserver, analysisRegion, analysisRound, analysisSunAngles } from './math.js'
import { formatHeight } from '../format.js'
import { vectorLabel } from '../scene/vector-style.js'
import {
  acquireClipCollection,
  CLIP_OWNER_ANALYSIS,
  releaseClipCollection,
} from '../scene/clip-collections.js'

/**
 * @param {object} deps
 * @param {Function} deps.getCesium  () => Cesium namespace
 * @param {Function} deps.getViewer  () => current Cesium.Viewer
 * @param {Function} deps.getLayers  () => current 3D Tiles layer list
 * @param {Function} deps.findLayer  (token) => layer | null (id or exact name)
 * @param {object}   deps.state      the analysis state ref object
 * @param {object}   deps.commandRef the "replay this analysis after remount" ref
 * @param {Function} deps.setAnalysis React state setter for the analysis card
 * @param {Function} deps.markSceneDirty mark the scene snapshot dirty
 * @param {Function} deps.t          translate function
 */
export function createAnalysisEngine(deps) {
  // Local shims keep the extracted block byte-for-byte the old implementation.
  const analysisRef = deps.state
  const analysisCommandRef = deps.commandRef
  const viewerRef = { get current() { return deps.getViewer() } }
  const layersRef = { get current() { return deps.getLayers() } }
  const cesiumRef = { get current() { return deps.getCesium() } }
  const setAnalysis = deps.setAnalysis
  const markSceneDirty = () => deps.markSceneDirty()
  const t = deps.t
  const findLayer = deps.findLayer

      //#region analysis engine ---------------------------------------------------
      // B2 `analyze` bridge command: profile / flood / sunlight / clear. Only one
      // analysis is active at a time; every entity carries the `analysis-` id
      // prefix so clear() can never remove Agent annotations or user measurements.

      const analysisAdd = (Cesium, viewer, options) => {
        const state = analysisRef.current
        const descriptor = { group: 'analysis', kind: t('layers.analysis'), title: t(`analysis.title.${state.operation}`), summary: state.layerName ?? '' }
        const values = { ...options, id: `${ANALYSIS_ENTITY_PREFIX}${options.id}` }
        const entity = deps.addEntity ? deps.addEntity(values, descriptor) : viewer.entities.add(values)
        state.entities.push(entity)
        return entity
      }

      const analysisLabel = (Cesium, text) => vectorLabel(Cesium, text)

      /** Restore whatever the sunlight or clip operation changed in the scene. */
      const restoreAnalysisScene = () => {
        const viewer = viewerRef.current
        const restore = analysisRef.current.restore
        if (!viewer || !restore) return
        try {
          if (typeof restore.enableLighting === 'boolean') viewer.scene.globe.enableLighting = restore.enableLighting
          if (typeof restore.shadowMapEnabled === 'boolean') viewer.scene.shadowMap.enabled = restore.shadowMapEnabled
          if (typeof restore.shouldAnimate === 'boolean') viewer.clock.shouldAnimate = restore.shouldAnimate
          if (restore.currentTime) viewer.clock.currentTime = restore.currentTime
          for (const saved of restore.tilesets ?? []) {
            const layer = layersRef.current.find((item) => item.id === saved.id)
            if (layer && layer.tileset) layer.tileset.shadows = saved.shadows
          }
          // clip: disable the shared collection instead of unassigning it — the Cesium
          // setter destroys the clipping texture a tile draw command may still use.
          if (restore.clipping) {
            const target = restore.clipping.layer
            if (target && target.tileset) releaseClipCollection(target.tileset, CLIP_OWNER_ANALYSIS)
          }
        } catch {
          /* the viewer may be mid-teardown; state restoration is best-effort */
        }
        analysisRef.current.restore = null
      }

      /** Remove every analysis entity and restore the pre-analysis scene state. */
      function clearAnalysis() {
        const viewer = viewerRef.current
        const state = analysisRef.current
        const cleared = state.operation ? [state.operation] : []
        if (viewer) {
          for (const entity of state.entities) {
            try {
              viewer.entities.remove(entity)
            } catch {
              /* already detached */
            }
          }
        }
        state.entities = []
        restoreAnalysisScene()
        state.operation = null
        state.layerId = null
        state.layerName = null
        analysisCommandRef.current = null
        setAnalysis(null)
        markSceneDirty()
        return cleared
      }

      const beginAnalysis = (operation, layer) => {
        const state = analysisRef.current
        state.operation = operation
        state.layerId = layer ? layer.id : null
        state.layerName = layer ? layer.name : null
      }

      const analyzeProfile = async (Cesium, viewer, layer, args, sampler) => {
        const from = analysisLonLat(args.from)
        const to = analysisLonLat(args.to)
        if (!from || !to) {
          throw new Error('analysis: `from`/`to` must be [lon, lat] pairs. next: pass two legal WGS84 [lon, lat] arrays.')
        }
        const samples = analysisInteger(args.samples, 32, 8, 64)
        const heightMode = args.source === 'terrain' ? 'terrain' : 'tiles'
        const ellipsoid = viewer.scene.globe.ellipsoid
        const geodesic = new Cesium.EllipsoidGeodesic(
          Cesium.Cartographic.fromDegrees(from[0], from[1]),
          Cesium.Cartographic.fromDegrees(to[0], to[1]),
          ellipsoid,
        )
        const length = Number.isFinite(geodesic.surfaceDistance) ? geodesic.surfaceDistance : 0
        const points = []
        let withData = 0
        for (let index = 0; index < samples; index += 1) {
          const fraction = samples === 1 ? 0 : index / (samples - 1)
          const carto = geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic())
          const probe = carto ? await sampler.sample(carto, { mode: heightMode }) : null
          const height = probe ? probe.height : null
          if (height !== null) withData += 1
          points.push({
            distance_m: analysisRound(length * fraction, 1),
            height_m: height === null ? null : analysisRound(height, 1),
          })
        }
        if (withData < ANALYSIS_MIN_SAMPLES) {
          throw new Error(
            heightMode === 'terrain'
              ? 'analysis: [no_height_data] 地形没有返回可采样的高程。next: 在「地图」Tab 打开地形，或改用 source="tiles" 的 mesh 图层。'
              : 'analysis: [no_height_data] 所选图层没有返回可采样的表面高程（3DGS 不提供表面高程）。next: 选择 source="terrain" 并加载地形，或改用 mesh 3D Tiles 图层。',
          )
        }
        const heights = points.filter((point) => point.height_m !== null).map((point) => point.height_m)
        const minimum = Math.min(...heights)
        const maximum = Math.max(...heights)
        let gain = 0
        let loss = 0
        let previous = null
        // Adjacent valid samples define ascent/descent; a data gap bridges the last
        // known height so a hole neither invents nor removes relief.
        for (const point of points) {
          if (point.height_m === null) continue
          if (previous !== null) {
            const delta = point.height_m - previous
            if (delta > 0) gain += delta
            else loss -= delta
          }
          previous = point.height_m
        }
        const relief = maximum - minimum
        const stats = {
          min_height: analysisRound(minimum, 1),
          max_height: analysisRound(maximum, 1),
          relief_m: analysisRound(relief, 1),
          gain_m: analysisRound(gain, 1),
          loss_m: analysisRound(loss, 1),
        }
        beginAnalysis('profile', layer)
        const positionAt = (fraction, height) => {
          const carto = geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic())
          return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height + 2)
        }
        const step = samples > 1 ? 1 / (samples - 1) : 0
        for (let index = 1; index < points.length; index += 1) {
          const left = points[index - 1]
          const right = points[index]
          if (left.height_m === null || right.height_m === null) continue
          const ratio = relief > 0 ? ((left.height_m + right.height_m) / 2 - minimum) / relief : 0
          const color = analysisColorAt(Cesium, ratio)
          analysisAdd(Cesium, viewer, {
            id: `profile-line-${index}`,
            polyline: {
              positions: [
                positionAt((index - 1) * step, left.height_m),
                positionAt(index * step, right.height_m),
              ],
              width: 4.5,
              arcType: Cesium.ArcType.NONE,
              material: color,
              depthFailMaterial: color.withAlpha(0.35),
            },
          })
        }
        const endpointHeight = (point) => (point.height_m === null ? 0 : point.height_m)
        const endpointText = (point) => (point.height_m === null ? t('hud.empty') : formatHeight(point.height_m))
        const marker = (id, fraction, point, color) => {
          analysisAdd(Cesium, viewer, {
            id,
            position: positionAt(fraction, endpointHeight(point)),
            point: {
              pixelSize: 10,
              color,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: analysisLabel(
              Cesium,
              id === 'profile-start'
                ? t('analysis.start', { value: endpointText(point) })
                : t('analysis.end', { value: endpointText(point) }),
            ),
          })
        }
        marker('profile-start', 0, points[0], analysisColorAt(Cesium, 0))
        marker('profile-end', 1, points[points.length - 1], analysisColorAt(Cesium, 1))
        const result = {
          operation: 'profile',
          layer: layer ? layer.name : null,
          from,
          to,
          samples,
          length_m: analysisRound(length, 1),
          height_mode: heightMode,
          stats,
          points,
          ...sampler.report(),
        }
        setAnalysis({ operation: 'profile', layerName: result.layer, result })
        markSceneDirty()
        return result
      }

      /**
       * D-16 skyline: sample along the from→to direction and report the maximum
       * elevation angle seen from the observer (eye height 1.7 m). Exactly one
       * source per run: `terrain` (relief horizon) or `tiles` (visible surface,
       * e.g. roofs/foliage). A 3DGS layer cannot supply either.
       */
      const analyzeSkyline = async (Cesium, viewer, layer, args, sampler) => {
        const from = analysisLonLat(args.from)
        const to = analysisLonLat(args.to)
        if (!from || !to) {
          throw new Error(
            'analysis: `from`/`to` must be [lon, lat] pairs. next: pass the observer and a direction target.',
          )
        }
        const samples = analysisInteger(args.samples, 32, 8, 64)
        const ellipsoid = viewer.scene.globe.ellipsoid
        const geodesic = new Cesium.EllipsoidGeodesic(
          Cesium.Cartographic.fromDegrees(from[0], from[1]),
          Cesium.Cartographic.fromDegrees(to[0], to[1]),
          ellipsoid,
        )
        const length = Number.isFinite(geodesic.surfaceDistance) ? geodesic.surfaceDistance : 0
        if (length <= 0) {
          throw new Error('analysis: skyline 起终点重合或距离为 0。next: 给出两个不同的位置。')
        }
        const heightMode = args.source === 'terrain' ? 'terrain' : 'tiles'
        const fractions = []
        const probes = []
        for (let index = 0; index < samples; index += 1) {
          const fraction = samples === 1 ? 0 : index / (samples - 1)
          fractions.push(fraction)
          probes.push(geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic()))
        }
        const sampled = await sampler.sampleMany(probes, { mode: heightMode })
        const eyeSample = sampled.values[0]
        if (!eyeSample) {
          throw new Error(
            heightMode === 'terrain'
              ? 'analysis: [no_height_data] 观察点没有可采样的地形高程。next: 在「地图」Tab 打开地形后重试。'
              : 'analysis: [no_height_data] 观察点没有可采样的 3D 表面高程（3DGS 不提供表面高程，或该点不在 mesh 覆盖范围内）。next: 改用地形模式，或把观察点移到 mesh 覆盖范围内。',
          )
        }
        // 1.7 m eye height keeps the angle meaningful for a person-sized observer.
        const eyeHeight = eyeSample.height + 1.7
        const points = []
        let withData = 0
        for (let index = 0; index < sampled.values.length; index += 1) {
          const sample = sampled.values[index]
          if (!sample) continue
          withData += 1
          const distance = length * fractions[index]
          // distance 0 is the observer itself: its angle is undefined (-90°) and
          // must not enter the statistics or the drawn profile.
          if (distance <= 0) continue
          const angle = (Math.atan2(sample.height - eyeHeight, distance) * 180) / Math.PI
          points.push({
            distance_m: analysisRound(distance, 1),
            height_m: analysisRound(sample.height, 1),
            angle_deg: analysisRound(angle, 3),
          })
        }
        if (withData < ANALYSIS_MIN_SAMPLES || points.length === 0) {
          throw new Error(
            heightMode === 'terrain'
              ? 'analysis: [no_height_data] 地形没有返回可采样的高程。next: 在「地图」Tab 打开地形后重试。'
              : 'analysis: [no_height_data] 所选图层没有返回可采样的表面高程（3DGS 不提供表面高程）。next: 选择 source="terrain" 并加载地形，或改用 mesh 3D Tiles 图层。',
          )
        }
        let maxPoint = points[0]
        for (const point of points) if (point.angle_deg > maxPoint.angle_deg) maxPoint = point
        beginAnalysis('skyline', layer)
        const positionAt = (fraction, height) => {
          const carto = geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic())
          return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height + 2)
        }
        const fractionAt = (point) => (length > 0 ? point.distance_m / length : 0)
        for (let index = 1; index < points.length; index += 1) {
          const ratio = points.length > 1 ? index / (points.length - 1) : 0
          analysisAdd(Cesium, viewer, {
            id: `skyline-line-${index}`,
            polyline: {
              positions: [
                positionAt(fractionAt(points[index - 1]), points[index - 1].height_m),
                positionAt(fractionAt(points[index]), points[index].height_m),
              ],
              width: 3,
              arcType: Cesium.ArcType.NONE,
              material: analysisColorAt(Cesium, ratio),
              depthFailMaterial: analysisColorAt(Cesium, ratio).withAlpha(0.35),
            },
          })
        }
        analysisAdd(Cesium, viewer, {
          id: 'skyline-max',
          position: positionAt(fractionAt(maxPoint), maxPoint.height_m),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString('#ddbb83'),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: analysisLabel(
            Cesium,
            t('analysis.skylineMax', { value: formatHeight(maxPoint.height_m), angle: `${maxPoint.angle_deg.toFixed(2)}°` }),
          ),
        })
        analysisAdd(Cesium, viewer, {
          id: 'skyline-eye',
          position: positionAt(0, eyeHeight),
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#79b6e8'),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: analysisLabel(Cesium, t('analysis.skylineEyeValue', { value: formatHeight(eyeHeight) })),
        })
        const result = {
          operation: 'skyline',
          layer: layer ? layer.name : null,
          from,
          to,
          samples,
          length_m: analysisRound(length, 1),
          height_mode: heightMode,
          eye_height_m: analysisRound(eyeHeight, 2),
          max_angle_deg: maxPoint.angle_deg,
          max_distance_m: maxPoint.distance_m,
          max_height_m: maxPoint.height_m,
          points,
          height_source: sampled.height_source,
          height_sources: sampled.height_sources,
          warnings: sampled.warnings,
        }
        setAnalysis({ operation: 'skyline', layerName: result.layer, result })
        markSceneDirty()
        return result
      }

      const analyzeFlood = async (Cesium, viewer, layer, args, sampler) => {
        const region = analysisRegion(args.region)
        if (!region) {
          throw new Error('analysis: `region` must be {west, south, east, north} with west < east and south < north. next: pass a legal WGS84 bounding box.')
        }
        const waterHeight = Number(args.water_height)
        if (!Number.isFinite(waterHeight)) {
          throw new Error('analysis: `water_height` must be a finite number in metres. next: pass the water level to test.')
        }
        const grid = analysisInteger(args.grid, 12, 4, 24)
        const ellipsoid = viewer.scene.globe.ellipsoid
        const span = (lon1, lat1, lon2, lat2) =>
          new Cesium.EllipsoidGeodesic(
            Cesium.Cartographic.fromDegrees(lon1, lat1),
            Cesium.Cartographic.fromDegrees(lon2, lat2),
            ellipsoid,
          ).surfaceDistance
        const middleLat = (region.south + region.north) / 2
        const middleLon = (region.west + region.east) / 2
        // Cell size from the region centre: the mean width/height of one grid cell,
        // so the area is finite even when the region is a tiny sliver.
        const cellWidth = span(region.west, middleLat, region.east, middleLat) / grid
        const cellHeight = span(middleLon, region.south, middleLon, region.north) / grid
        const cellArea = Math.abs(cellWidth * cellHeight)
        if (!Number.isFinite(cellArea) || cellArea <= 0) {
          throw new Error('analysis: 分析范围过小，无法计算格元面积。next: 扩大 region 后重试。')
        }
        const probes = []
        for (let row = 0; row < grid; row += 1) {
          const lat = region.south + ((region.north - region.south) * (row + 0.5)) / grid
          for (let column = 0; column < grid; column += 1) {
            const lon = region.west + ((region.east - region.west) * (column + 0.5)) / grid
            probes.push(Cesium.Cartographic.fromDegrees(lon, lat))
          }
        }
        // Flood is a GROUND analysis by default. `source: "terrain"` is the only
        // strict mode; `source: "surface"` is an explicit approximation on the
        // visible 3D Tiles surface (roofs/foliage included) and is labelled as
        // such. The two are never mixed inside one run.
        const floodSource = args.source === 'surface' ? 'surface' : 'terrain'
        if (floodSource === 'terrain' && !sampler.hasRealTerrain()) {
          throw new Error(
            'analysis: [no_height_data] 淹没默认使用地形，但当前没有加载地形。next: 在「地图」Tab 打开地形；或用 source="surface" 对 3D Tiles 表面做近似（含屋顶/植被，非严格地面）。',
          )
        }
        if (floodSource === 'surface' && (!layer || layer.visible === false || !layer.tileset)) {
          throw new Error(
            'analysis: [no_height_data] source="surface" 需要可见的 mesh 3D Tiles 图层。next: 加载或显示 mesh 3D Tiles 图层，或改用 source="terrain"。',
          )
        }
        const heightMode = floodSource === 'surface' ? 'tiles' : 'terrain'
        const sampled = await sampler.sampleMany(probes, { mode: heightMode })
        if (floodSource === 'surface') sampled.warnings.push('surface_approx_includes_roofs')
        let withData = 0
        let inundated = 0
        let depthMaximum = 0
        let depthSum = 0
        for (const sample of sampled.values) {
          if (!sample) continue
          const height = sample.height
          withData += 1
          if (waterHeight > height) {
            const depth = waterHeight - height
            inundated += 1
            depthSum += depth
            if (depth > depthMaximum) depthMaximum = depth
          }
        }
        if (withData === 0) {
          throw new Error(
            floodSource === 'surface'
              ? 'analysis: [no_height_data] 3D 表面没有返回可采样的高程（3DGS 不提供表面高程）。next: 改用 source="terrain" 并加载地形，或加载 mesh 3D Tiles。'
              : 'analysis: [no_height_data] 地形没有返回可采样的高程。next: 在「地图」Tab 打开地形后重试，或改用 source="surface" 做近似。',
          )
        }
        beginAnalysis('flood', layer)
        const waterColor = Cesium.Color.fromCssColorString('#2f7fe0').withAlpha(0.38)
        const borderColor = Cesium.Color.fromCssColorString('#9fc7ff')
        analysisAdd(Cesium, viewer, {
          id: 'flood-water',
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(region.west, region.south, region.east, region.north),
            height: waterHeight,
            material: waterColor,
            outline: true,
            outlineColor: borderColor,
          },
        })
        const corners = [[region.west, region.south], [region.east, region.south], [region.east, region.north], [region.west, region.north], [region.west, region.south]]
        analysisAdd(Cesium, viewer, {
          id: 'flood-border',
          polyline: {
            positions: corners.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, waterHeight)),
            width: 2,
            arcType: Cesium.ArcType.NONE,
            material: borderColor,
          },
        })
        analysisAdd(Cesium, viewer, {
          id: 'flood-label',
          position: Cesium.Cartesian3.fromDegrees(middleLon, middleLat, waterHeight + 2),
          label: analysisLabel(Cesium, t('analysis.waterLabel', { value: formatHeight(waterHeight) })),
        })
        const totalSamples = grid * grid
        const missingSamples = Math.max(0, totalSamples - withData)
        const coverageRatio = totalSamples > 0 ? analysisRound(withData / totalSamples, 4) : 0
        if (coverageRatio < 0.5 && !sampled.warnings.includes('low_sample_coverage')) sampled.warnings.push('low_sample_coverage')
        const regionArea = totalSamples * cellArea
        const result = {
          operation: 'flood',
          layer: layer ? layer.name : null,
          region,
          water_height: analysisRound(waterHeight, 2),
          grid,
          cell_area_m2: analysisRound(cellArea, 1),
          area_km2: analysisRound(regionArea / 1e6, 6),
          inundated_km2: analysisRound((inundated * cellArea) / 1e6, 6),
          unknown_km2: analysisRound((missingSamples * cellArea) / 1e6, 6),
          inundated_ratio: analysisRound(withData > 0 ? inundated / withData : 0, 4),
          coverage_ratio: coverageRatio,
          depth_max_m: analysisRound(depthMaximum, 2),
          depth_mean_m: analysisRound(inundated > 0 ? depthSum / inundated : 0, 2),
          samples_total: totalSamples,
          samples_with_data: withData,
          samples_missing: missingSamples,
          samples_inundated: inundated,
          // Provenance is additive: old fields keep their names/semantics.
          source: floodSource,
          surface_approx: floodSource === 'surface',
          height_mode: heightMode,
          height_source: sampled.height_source,
          height_sources: sampled.height_sources,
          warnings: sampled.warnings,
        }
        setAnalysis({ operation: 'flood', layerName: result.layer, result })
        markSceneDirty()
        return result
      }

      const analyzeSunlight = (Cesium, viewer, layer, args) => {
        const date = args.datetime === undefined || args.datetime === null ? new Date() : new Date(args.datetime)
        if (Number.isNaN(date.getTime())) throw new Error('analysis: `datetime` must be a valid ISO 8601 date. next: pass an ISO timestamp, or omit it for the current time.')
        const showShadows = args.show_shadows !== false
        const observer = analysisObserver(Cesium, viewer, layer)
        const sun = analysisSunAngles(Cesium, date, observer)
        if (!sun) throw new Error('analysis: 无法计算太阳位置（Cesium 星历不可用）。next: 检查浏览器控制台后重试，或先执行 clear。')
        const scene = viewer.scene
        const restore = {
          enableLighting: scene.globe.enableLighting,
          shadowMapEnabled: scene.shadowMap ? scene.shadowMap.enabled : null,
          shouldAnimate: viewer.clock.shouldAnimate,
          currentTime: viewer.clock.currentTime ? viewer.clock.currentTime.clone() : null,
          tilesets: layersRef.current
            .filter((item) => item.visible && item.tileset)
            .map((item) => ({ id: item.id, shadows: item.tileset.shadows })),
        }
        beginAnalysis('sunlight', layer)
        analysisRef.current.restore = restore
        scene.globe.enableLighting = true
        if (scene.shadowMap) {
          // Sunlight always turns the shadow pipeline on; show_shadows=false only
          // keeps the shadows themselves from being rendered.
          scene.shadowMap.enabled = true
          scene.shadowMap.softShadows = true
          scene.shadowMap.darkness = 0.35
          if (!showShadows) scene.shadowMap.enabled = false
        }
        viewer.clock.currentTime = Cesium.JulianDate.fromDate(date)
        viewer.clock.shouldAnimate = false
        for (const saved of restore.tilesets) {
          const item = layersRef.current.find((entry) => entry.id === saved.id)
          if (item && item.tileset) {
            item.tileset.shadows = Cesium.ShadowMode.ENABLED
            if (!showShadows) item.tileset.shadows = Cesium.ShadowMode.DISABLED
          }
        }
        analysisAdd(Cesium, viewer, {
          id: 'sun-label',
          position: Cesium.Cartesian3.fromDegrees(
            Cesium.Math.toDegrees(observer.longitude),
            Cesium.Math.toDegrees(observer.latitude),
            (observer.height || 0) + 30,
          ),
          label: analysisLabel(
            Cesium,
            t('analysis.sunLabel', { altitude: sun.altitude, azimuth: sun.azimuth }),
          ),
        })
        const result = {
          operation: 'sunlight',
          layer: layer ? layer.name : null,
          datetime: date.toISOString(),
          sun: { altitude_deg: sun.altitude, azimuth_deg: sun.azimuth },
          shadows_enabled: showShadows,
          night: sun.altitude < 0,
        }
        setAnalysis({ operation: 'sunlight', layerName: result.layer, result })
        markSceneDirty()
        return result
      }

      /**
       * D-16 clip: cut the tileset with one horizontal plane along the local
       * vertical. `keep: 'below'` removes everything above the plane (revealing
       * the horizontal section); `keep: 'above'` removes everything below it.
       * The tileset's previous clippingPlanes are restored by clear().
       */
      const analyzeClip = async (Cesium, viewer, layer, args) => {
        const height = Number(args.height)
        if (!Number.isFinite(height)) {
          throw new Error('analysis: `height` must be a finite number in metres. next: pass the clip plane height.')
        }
        if (!layer || layer.visible === false || !layer.tileset) {
          throw new Error('analysis: clip 需要可见的 3D Tiles 图层。next: 先加载或显示 3D Tiles 图层后重试。')
        }
        if (layer.kind === '3dgs') {
          throw new Error(
            'analysis: [unsupported_layer] 3DGS 图层不支持剖切：clippingPlanes 不会作用于 splat 渲染。next: 选择 mesh 3D Tiles 图层，或改用剖面/日照分析。',
          )
        }
        const tileset = layer.tileset
        const center = tileset.boundingSphere && tileset.boundingSphere.center
        if (!center) {
          throw new Error('analysis: 图层缺少包围球，无法建立剖切面。next: 重新加载该图层后重试。')
        }
        const plane = analysisClipPlane(Cesium, center, height, args.keep)
        if (!plane) {
          throw new Error('analysis: 无法计算剖切面。next: 重新加载图层后重试，或改用其他分析。')
        }
        analysisLocalizeClipPlane(Cesium, plane, tileset, center)
        if (typeof Cesium.ClippingPlaneCollection !== 'function' || typeof Cesium.ClippingPlane !== 'function') {
          throw new Error('analysis: 当前 Cesium 不支持剖切（ClippingPlane）。next: 升级 Cesium 后重试。')
        }
        // Shared registry: one collection per tileset, never replaced while another owner holds it.
        const acquired = acquireClipCollection(Cesium, tileset, {
          owner: CLIP_OWNER_ANALYSIS,
          planes: [{ normal: plane.normal, distance: plane.distance }],
          edgeWidth: 1.0,
          edgeColor: Cesium.Color?.fromCssColorString?.('#7fd4ff') ?? undefined,
        })
        if (!acquired.ok) {
          if (acquired.reason === 'conflict') {
            throw new Error(
              'analysis: [clip_conflict] 该图层正在被卷帘对比裁剪，两次裁剪无法叠加。next: 先退出卷帘对比，再执行剖切。',
            )
          }
          throw new Error('analysis: 该图层不支持剖切（clippingPlanes 赋值失败）。next: 换 3D Tiles 图层或重新加载后重试。')
        }
        beginAnalysis('clip', layer)
        analysisRef.current.restore = { clipping: { layer } }
        const result = {
          operation: 'clip',
          layer: layer.name,
          height: analysisRound(height, 2),
          keep: plane.keep,
          planes: 1,
          layer_center_height: analysisRound(Cesium.Cartographic.fromCartesian(center).height, 1),
        }
        setAnalysis({ operation: 'clip', layerName: result.layer, result })
        markSceneDirty()
        return result
      }

      async function analyzeCommand(args = {}) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) {
          throw new Error('analysis: 三维引擎尚未就绪。next: 打开数字地球面板后重试。')
        }
        const operation = typeof args.action === 'string' ? args.action.trim() : ''
        if (operation === 'clear') {
          const cleared = clearAnalysis()
          return { operation: 'clear', layer: null, cleared }
        }
        if (operation !== 'profile' && operation !== 'flood' && operation !== 'sunlight' && operation !== 'clip' && operation !== 'skyline') {
          throw new Error(
            `analysis: 不支持的分析类型 "${String(args.action)}"。next: 使用 profile / flood / skyline / sunlight / clip / clear。`,
          )
        }
        // source-policy.js: one height source per run; a 3DGS layer is never sampled.
        const target = resolveAnalysisTarget({ operation, args, layers: layersRef.current, findLayer })
        args = target.args
        let layer = target.layer
        // Single active analysis: the new result replaces the previous one.
        clearAnalysis()
        // One sampler per run: it caches probes and reports which source the
        // heights came from, so the tool result can warn instead of hiding it.
        const sampler = createHeightService({ Cesium, viewer, layer })
        let result
        if (operation === 'profile') result = await analyzeProfile(Cesium, viewer, layer, args, sampler)
        else if (operation === 'flood') result = await analyzeFlood(Cesium, viewer, layer, args, sampler)
        else if (operation === 'skyline') result = await analyzeSkyline(Cesium, viewer, layer, args, sampler)
        else if (operation === 'sunlight') result = analyzeSunlight(Cesium, viewer, layer, args)
        else result = await analyzeClip(Cesium, viewer, layer, args)
        // Remember the command (not its entities) so a remounted panel can replay
        // it. The layer is stored by name because restored layers get new ids.
        analysisCommandRef.current = {
          action: operation,
          ...args,
          ...(layer ? { layer: layer.name } : {}),
        }
        markSceneDirty()
        return result
      }
      //#endregion analysis engine

  return {
    /** Run one analyze command (profile / flood / sunlight / clear). */
    command: (args = {}) => analyzeCommand(args),
    /** Remove the active analysis and restore whatever sunlight changed. */
    clear: () => clearAnalysis(),
    /** Re-apply a saved sunlight restore state (used by scene restore). */
    restoreScene: () => restoreAnalysisScene(),
  }
}
