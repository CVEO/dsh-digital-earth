/**
 * scene/profile-tool.js — manual two-click profile.
 *
 * The user clicks a start and an end point on the globe. The module turns those
 * picks into the same `{ from, to, samples }` command the Agent uses, so the
 * existing analysis engine owns sampling, the colored line, the result card and
 * the scene snapshot. This module only collects clicks, draws two draft markers
 * and cleans them up — no duplicate profile math.
 */
export function createProfileTool({ getCesium, getViewer, pickSurface, setTool, runAnalysis, showToast, t }) {
  let points = []
  let entities = []

  function clear() {
    const viewer = getViewer?.()
    if (viewer) {
      for (const entity of entities) {
        try {
          viewer.entities.remove(entity)
        } catch {
          /* already detached */
        }
      }
    }
    entities = []
    points = []
  }

  function marker(Cesium, viewer, cartesian, index) {
    try {
      entities.push(
        viewer.entities.add({
          id: `profile-draft-${index}-${Date.now()}`,
          position: cartesian,
          point: {
            pixelSize: 9,
            color: Cesium.Color.fromCssColorString('#2563eb'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }),
      )
    } catch {
      /* a viewer without entities still profiles; the draft dot is cosmetic */
    }
  }

  function start() {
    clear()
    setTool('profile')
    showToast(t('profile.clickStart'))
  }

  function cancel() {
    clear()
    setTool(null)
  }

  function onPoint(position) {
    const Cesium = getCesium?.()
    const viewer = getViewer?.()
    if (!Cesium || !viewer) return
    const surface = pickSurface?.(position)
    if (!surface) {
      showToast(t('toast.noSurface'))
      return
    }
    let carto = null
    try {
      carto = Cesium.Cartographic.fromCartesian(surface)
    } catch {
      carto = null
    }
    if (!carto) {
      showToast(t('toast.noSurface'))
      return
    }
    const point = { lon: Cesium.Math.toDegrees(carto.longitude), lat: Cesium.Math.toDegrees(carto.latitude) }
    points.push(point)
    marker(Cesium, viewer, surface, points.length)
    if (points.length === 1) {
      showToast(t('profile.clickEnd'))
      return
    }
    const from = points[0]
    const to = points[1]
    clear()
    setTool(null)
    showToast(t('profile.running'))
    Promise.resolve(runAnalysis({ action: 'profile', from: [from.lon, from.lat], to: [to.lon, to.lat], samples: 32 })).catch(
      (error) => showToast(t('profile.failed', { message: error?.message ?? String(error) })),
    )
  }

  return { start, onPoint, cancel, clear }
}
