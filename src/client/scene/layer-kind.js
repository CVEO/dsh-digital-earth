/**
 * scene/layer-kind.js — classify a loaded layer as mesh vs 3DGS.
 *
 * v1.5.2: a dataset can declare KHR_gaussian_splatting inside its GLBs only, so
 * the tileset extension list is not enough. The Host inspector reads the content
 * headers under the folder allowlist; the panel caches the answer on the layer so
 * shader rejection, the status badge and analysis errors stay consistent.
 */
export function createLayerKindProbe({ getMeta, sourceOfLayer, layerRuntime }) {
  return async function hydrateLayerKind(layer) {
    const meta = getMeta()
    const source = sourceOfLayer(layer)
    if (!meta?.token || !source) return
    const endpoint =
      typeof meta.inspectUrl === 'string' && meta.inspectUrl !== ''
        ? meta.inspectUrl
        : typeof meta.scanUrl === 'string'
          ? `${meta.scanUrl.replace(/\/scan$/, '')}/inspect`
          : ''
    if (endpoint === '') return
    try {
      const response = await fetch(`${endpoint}?token=${encodeURIComponent(meta.token)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-dsh-panel': '1' },
        body: JSON.stringify({ source, deep: false, runtime: layerRuntime(layer) }),
      })
      if (!response.ok) return
      const data = await response.json().catch(() => null)
      const kinds = data?.report?.kinds
      if (!kinds) return
      layer.kind = kinds.gaussianSplatting === true ? '3dgs' : 'mesh'
      layer.kindGenerator = typeof data.report.asset?.generator === 'string' ? data.report.asset.generator : null
    } catch {
      // Classification is an enhancement; the layer is already usable.
    }
  }
}
