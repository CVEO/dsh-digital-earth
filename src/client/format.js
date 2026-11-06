/**
 * format.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import { t } from './i18n.js'

    //#region helpers ----------------------------------------------------------

    const message = (error) => (error instanceof Error ? error.message : String(error))
    // Tool results are model-facing: never leak the plugin-instance token that
    // guards /tiles and /files, so an Agent cannot mutate the local allowlist.
    const redactUrl = (value) =>
      typeof value === 'string'
        ? value.replace(/\/api\/3dviewer\/(tiles|files)\/[^/]+\//g, '/api/3dviewer/$1/<token>/')
        : value
    const b64url = (value) => {
      const bytes = new TextEncoder().encode(value)
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    const formatValue = (value) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
      return text.length > 200 ? `${text.slice(0, 200)}…` : text
    }
    const formatBytes = (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '–'
      if (value >= 1 << 30) return `${(value / (1 << 30)).toFixed(2)} GB`
      if (value >= 1 << 20) return `${(value / (1 << 20)).toFixed(1)} MB`
      if (value >= 1 << 10) return `${(value / 1024).toFixed(0)} KB`
      return `${value} B`
    }
    const formatCount = (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '–'
      if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`
      return String(value)
    }
    const formatDistance = (meters) =>
      meters >= 1000 ? `${(meters / 1000).toFixed(3)} km` : `${meters.toFixed(2)} m`
    const formatArea = (squareMeters) =>
      squareMeters >= 1e6
        ? `${(squareMeters / 1e6).toFixed(3)} km²`
        : squareMeters >= 1e4
          ? `${(squareMeters / 1e4).toFixed(2)} ${t('unit.hectare')}`
          : `${squareMeters.toFixed(1)} m²`
    const formatHeight = (meters) =>
      Math.abs(meters) >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(1)} m`

    /** Escape user/scene text for the self-contained report HTML. */
    const escapeHtml = (value) =>
      String(value).replace(/[&<>"']/g, (character) => {
        switch (character) {
          case '&':
            return '&amp;'
          case '<':
            return '&lt;'
          case '>':
            return '&gt;'
          case '"':
            return '&quot;'
          default:
            return '&#39;'
        }
      })

    /** Base64-encode a binary screenshot for embedding in the report HTML. */
    const arrayBufferToBase64 = (buffer) => {
      const bytes = new Uint8Array(buffer)
      let binary = ''
      const chunk = 0x8000
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk))
      }
      return btoa(binary)
    }

    function geodesicLength(Cesium, points) {
      let total = 0
      for (let index = 1; index < points.length; index += 1) {
        const left = Cesium.Cartographic.fromCartesian(points[index - 1])
        const right = Cesium.Cartographic.fromCartesian(points[index])
        total += new Cesium.EllipsoidGeodesic(left, right).surfaceDistance
      }
      return total
    }

    function planarArea(Cesium, points) {
      if (points.length < 3) return 0
      const enu = Cesium.Transforms.eastNorthUpToFixedFrame(points[0])
      const inverse = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4())
      const local = points.map((point) => Cesium.Matrix4.multiplyByPoint(inverse, point, new Cesium.Cartesian3()))
      let sum = 0
      for (let index = 0; index < local.length; index += 1) {
        const current = local[index]
        const next = local[(index + 1) % local.length]
        sum += current.x * next.y - next.x * current.y
      }
      return Math.abs(sum) / 2
    }

    const clone = (value) => JSON.parse(JSON.stringify(value))
    //#endregion helpers

export { message, redactUrl, b64url, formatValue, formatBytes, formatCount, formatDistance, formatArea, formatHeight, escapeHtml, arrayBufferToBase64, geodesicLength, planarArea, clone }
