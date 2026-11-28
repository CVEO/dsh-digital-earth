/**
 * scene/overlay-actions.js — destructive overlay actions for the scene card.
 *
 * v1.8 review fix (B2/M9): every group ✕ and every row "remove" can delete real
 * user data, so the confirmation, the count copy and the toast live in one place
 * instead of being re-derived inline in the 2 800-line ViewerSurface. The viewer
 * keeps the state and the Cesium budget; this module keeps the policy:
 *
 *   - a group clear always asks, and says how many rows AND features die;
 *   - a single row removal asks only when that row owns features;
 *   - every successful removal reports back with a toast.
 *
 * Copy is resolved with literal t() keys so the i18n gate can see every lookup.
 */
import { buildAgentOverlayList } from './agent-overlays.js'

/**
 * @param {object} deps
 * @param {(key: string, params?: object) => string} deps.t
 * @param {(options: object) => Promise<boolean>} deps.confirm
 * @param {(message: string) => void} deps.showToast
 * @param {() => object} deps.getState  live overlay state (drawCommands/measureCommands)
 * @param {(kind: string, options?: object) => void} deps.clear  scoped clear, already synced+saved
 * @param {(kind: string, index: number) => boolean} deps.remove
 * @param {() => void} deps.onChanged  sync counts / mark dirty / save snapshot
 */
export function createOverlayActions({ t, confirm, showToast, getState, clear, remove, onChanged }) {
  const rows = () => buildAgentOverlayList(getState())
  const featureCount = (kind, index) => (kind === 'draw' ? getState().drawCommands[index]?.drawn ?? 0 : 0)

  const copy = {
    annotations: {
      title: t('confirm.clearAnnotationsTitle'),
      message: (params) => t('confirm.clearAnnotationsMessage', params),
      toast: t('toast.annotationsCleared'),
    },
    measurements: {
      title: t('confirm.clearMeasurementsTitle'),
      message: (params) => t('confirm.clearMeasurementsMessage', params),
      toast: t('toast.measureCleared'),
    },
    imports: {
      title: t('confirm.clearImportsTitle'),
      message: (params) => t('confirm.clearImportsMessage', params),
      toast: t('toast.vectorCleared'),
    },
  }

  const clearScope = async ({ scope, predicate, run }) => {
    const scoped = rows().filter(predicate)
    if (scoped.length === 0) return false
    const features = scoped.reduce((sum, row) => sum + featureCount(row.kind, row.index), 0)
    const ok = await confirm({
      title: copy[scope].title,
      message: copy[scope].message({ n: scoped.length, features }),
      confirmLabel: t('confirm.clear'),
      cancelLabel: t('btn.cancel'),
      danger: true,
    })
    if (!ok) return false
    run()
    showToast(copy[scope].toast)
    return true
  }

  return {
    // 标注: Agent + user drawn annotations, never the imported vector layers.
    onClearAnnotations: () =>
      clearScope({
        scope: 'annotations',
        predicate: (row) => row.kind === 'draw' && row.origin !== 'import',
        run: () => {
          clear('draw', { origin: 'agent' })
          clear('draw', { origin: 'user' })
        },
      }),
    // 量测: measurements only.
    onClearMeasurements: () =>
      clearScope({
        scope: 'measurements',
        predicate: (row) => row.kind === 'measure',
        run: () => clear('measure'),
      }),
    // 矢量图层: imported vector layers only.
    onClearImports: () =>
      clearScope({
        scope: 'imports',
        predicate: (row) => row.kind === 'draw' && row.origin === 'import',
        run: () => clear('draw', { origin: 'import' }),
      }),
    onRemoveAgentOverlay: async (kind, index) => {
      const features = featureCount(kind, index)
      if (features > 0) {
        const ok = await confirm({
          title: t('confirm.removeOverlayTitle'),
          message: t('confirm.removeOverlayMessage', { features }),
          confirmLabel: t('confirm.remove'),
          cancelLabel: t('btn.cancel'),
          danger: true,
        })
        if (!ok) return
      }
      if (!remove(kind, index)) return
      onChanged()
      showToast(t('toast.overlayRemoved'))
    },
  }
}
