/**
 * scene/evidence-export.js — POST the evidence pack to the page-only host route.
 *
 * Kept separate from the selection controller so the JSON shape + HTTP body can be
 * unit-tested without a Cesium viewer or React (the controller imports the cursor
 * module, which needs the panel runtime).
 */
import { buildEvidencePack } from './selection.js'

/**
 * @param {object} input
 * @param {object} input.card       card built by buildSelectionCard
 * @param {object|null} input.view  current camera view
 * @param {string|null} input.pluginVersion
 * @param {string|null} input.exportUrl  token-bearing host route from /meta
 * @param {object|null} input.snapshot   result of capture.renderSnapshot
 * @param {Function} [input.fetchImpl]
 */
export async function postEvidence({ card, view, pluginVersion, exportUrl, snapshot = null, label = 'selection', fetchImpl } = {}) {
  if (typeof exportUrl !== 'string' || exportUrl === '') throw new Error('export_unavailable')
  const pack = buildEvidencePack({
    card,
    view,
    pluginVersion,
    image: snapshot ? { format: snapshot.format, width: snapshot.width, height: snapshot.height } : null,
  })
  const doFetch = typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch
  const response = await doFetch(exportUrl, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'evidence', label, card: pack, image: snapshot?.dataUrl }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}
