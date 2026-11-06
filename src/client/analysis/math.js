/**
 * analysis/math.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */

    //#region analysis core ----------------------------------------------------
    // Shared maths for the B2 analysis engine (profile / flood / sunlight). The
    // engine itself lives inside ViewerSurface because it owns the viewer and the
    // React card state; these helpers stay pure so the sampling/formatting rules
    // are the same for every operation.

    /** Analysis entities share this id prefix so clear() never touches agent overlays. */
    const ANALYSIS_ENTITY_PREFIX = 'analysis-'
    /** At least this many elevation samples are required for a surface statistic. */
    const ANALYSIS_MIN_SAMPLES = 2
    /** Elevation colour band: blue (low) → green → yellow → orange → red (high). */
    const ANALYSIS_ELEVATION_STOPS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444']

    const analysisRound = (value, digits = 1) => {
      const factor = 10 ** digits
      return Math.round(value * factor) / factor
    }

    const analysisInteger = (value, fallback, minimum, maximum) => {
      const number = Number(value)
      if (!Number.isFinite(number)) return fallback
      return Math.min(maximum, Math.max(minimum, Math.round(number)))
    }

    const analysisLonLat = (value) => {
      if (!Array.isArray(value) || value.length < 2) return null
      const lon = Number(value[0])
      const lat = Number(value[1])
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
      return [lon, lat]
    }

    const analysisRegion = (value) => {
      if (value === null || typeof value !== 'object') return null
      const west = Number(value.west)
      const south = Number(value.south)
      const east = Number(value.east)
      const north = Number(value.north)
      if (![west, south, east, north].every((item) => Number.isFinite(item))) return null
      if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null
      return { west, south, east, north }
    }

    /** Interpolate the profile colour band for a 0..1 elevation ratio. */
    const analysisColorAt = (Cesium, ratio) => {
      const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0))
      const scaled = clamped * (ANALYSIS_ELEVATION_STOPS.length - 1)
      const index = Math.min(ANALYSIS_ELEVATION_STOPS.length - 2, Math.floor(scaled))
      const local = scaled - index
      try {
        const from = Cesium.Color.fromCssColorString(ANALYSIS_ELEVATION_STOPS[index])
        const to = Cesium.Color.fromCssColorString(ANALYSIS_ELEVATION_STOPS[index + 1])
        return Cesium.Color.lerp(from, to, local, new Cesium.Color())
      } catch {
        return Cesium.Color.DODGERBLUE
      }
    }

    /**
     * Elevation probe used by profile/flood. A visible 3D Tiles layer may expose
     * `getHeight` (some providers return a Promise), terrain is the fallback, and
     * a missing value stays `null` — never a fake zero.
     */
    const analysisElevation = async (Cesium, viewer, layer, carto) => {
      const scene = viewer.scene
      const tileset = layer && layer.visible ? layer.tileset : null
      if (tileset && typeof tileset.getHeight === 'function') {
        try {
          const value = tileset.getHeight(carto, scene)
          const height = value && typeof value.then === 'function' ? await value : value
          if (typeof height === 'number' && Number.isFinite(height)) return height
        } catch {
          /* fall back to the globe */
        }
      }
      try {
        const height = scene.globe.getHeight(carto)
        if (typeof height === 'number' && Number.isFinite(height)) return height
      } catch {
        /* no terrain provider: leave the sample empty */
      }
      return null
    }

    /**
     * Sun altitude/azimuth at an observer for a date, using Cesium's built-in
     * ephemeris (Simon1994) plus an inertial→fixed rotation. Altitude is 0 at the
     * horizon; azimuth is degrees clockwise from north.
     *
     * `computeIcrfToFixedMatrix` needs Cesium's IAU2006 XYS assets and returns
     * undefined until they are loaded, so that rotation is preferred when it is
     * available and the synchronous TEME→pseudo-fixed rotation (GMST-based, no
     * assets, ~0.01° difference for a sun direction) is used as a fallback.
     * The date has to be a `JulianDate`; Cesium's ephemeris reads Julian fields.
     */
    const analysisSunAngles = (Cesium, date, observer) => {
      try {
        if (!Cesium.Simon1994PlanetaryPositions || !Cesium.Transforms) return null
        const julianDate = Cesium.JulianDate.fromDate(date)
        const sunInertial =
          Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(julianDate)
        if (!sunInertial) return null
        let icrfToFixed = null
        try {
          icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(julianDate)
        } catch {
          icrfToFixed = null
        }
        if (!icrfToFixed) {
          icrfToFixed = Cesium.Transforms.computeTemeToPseudoFixedMatrix(julianDate)
        }
        if (!icrfToFixed) return null
        const sunFixed = Cesium.Matrix3.multiplyByVector(icrfToFixed, sunInertial, new Cesium.Cartesian3())
        const sunDirection = Cesium.Cartesian3.normalize(sunFixed, new Cesium.Cartesian3())
        // Cesium 1.147: geodeticSurfaceNormal takes a Cartesian, the Cartographic
        // sugar is geodeticSurfaceNormalCartographic.
        const ellipsoid = Cesium.Ellipsoid.WGS84
        const up =
          typeof ellipsoid.geodeticSurfaceNormalCartographic === 'function'
            ? ellipsoid.geodeticSurfaceNormalCartographic(observer, new Cesium.Cartesian3())
            : Cesium.Cartesian3.normalize(
                ellipsoid.cartographicToCartesian(observer, new Cesium.Cartesian3()),
                new Cesium.Cartesian3(),
              )
        const sine = Cesium.Math.clamp(Cesium.Cartesian3.dot(sunDirection, up), -1, 1)
        const altitude = Cesium.Math.toDegrees(Math.asin(sine))
        if (!Number.isFinite(altitude)) return null
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(
          Cesium.Cartesian3.fromRadians(observer.longitude, observer.latitude, 0),
        )
        const east = Cesium.Matrix4.getColumn(enu, 0, new Cesium.Cartesian4())
        const north = Cesium.Matrix4.getColumn(enu, 1, new Cesium.Cartesian4())
        const eastDirection = new Cesium.Cartesian3(east.x, east.y, east.z)
        const northDirection = new Cesium.Cartesian3(north.x, north.y, north.z)
        const azimuth = (
          Cesium.Math.toDegrees(
            Math.atan2(
              Cesium.Cartesian3.dot(sunDirection, eastDirection),
              Cesium.Cartesian3.dot(sunDirection, northDirection),
            ),
          ) + 360
        ) % 360
        if (!Number.isFinite(azimuth)) return null
        return { altitude: analysisRound(altitude, 2), azimuth: analysisRound(azimuth, 2) }
      } catch {
        return null
      }
    }

    /** Sun angles describe the dataset centre when known, otherwise the camera. */
    const analysisObserver = (Cesium, viewer, layer) => {
      const tileset = layer ? layer.tileset : null
      if (tileset && tileset.boundingSphere) {
        try {
          const carto = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center)
          if (carto) return carto
        } catch {
          /* use the camera position */
        }
      }
      return viewer.camera.positionCartographic
    }
    //#endregion analysis core

export { ANALYSIS_ENTITY_PREFIX, ANALYSIS_MIN_SAMPLES, ANALYSIS_ELEVATION_STOPS, analysisRound, analysisInteger, analysisLonLat, analysisRegion, analysisColorAt, analysisElevation, analysisSunAngles, analysisObserver }
