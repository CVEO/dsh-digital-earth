/**
 * scene/vector-export-service.js — deliver the vector overlay layer three ways (F3).
 *
 * - download: always available, writes a .geojson through the browser;
 * - save: page-only host route, writes under DSH_HOME/digital-earth/exports;
 * - send: save, then inject a bounded notice into the live conversation with the
 *   absolute path, so the agent can read the file even when the chat client has
 *   no real attachment channel. The notice says "a file exists", never "here is
 *   the geometry", so nothing is invented.
 *
 * Failures are reported as one toast with a reason; no path is ever silently lost.
 */
import { downloadText } from '../ui/cards.js'
import {
  collectVectorFeatures,
  vectorBbox,
  vectorExportCollection,
  vectorExportFileName,
  vectorExportText,
} from './vector-export.js'

function bboxText(bbox) {
  if (!bbox) return '—'
  const fixed = (value) => value.toFixed(5)
  return `${fixed(bbox.west)}, ${fixed(bbox.south)} → ${fixed(bbox.east)}, ${fixed(bbox.north)}`
}

export function createVectorExport({ stateRef, getMeta, getSession, showToast, t, fetchImpl } = {}) {
  const doFetch = () => (typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch)

  const prepare = () => {
    const state = stateRef?.current ?? {}
    const built = collectVectorFeatures({
      drawCommands: state.drawCommands,
      measureCommands: state.measureCommands,
    })
    if (!built.ok) {
      showToast(t(`vectorExport.${built.error}`))
      return null
    }
    return {
      features: built.features,
      geojson: vectorExportCollection(built.features, { name: 'vector-overlay' }),
      count: built.features.length,
      bbox: vectorBbox(built.features),
    }
  }

  const saveToHost = async (prepared) => {
    const meta = typeof getMeta === 'function' ? getMeta() : null
    if (!meta?.exportVectorUrl) {
      showToast(t('vectorExport.hostUnavailable'))
      return null
    }
    const response = await doFetch()(meta.exportVectorUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'vector', name: prepared.geojson.name, features: prepared.features }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  return {
    canSend: () => typeof getSession === 'function' && Boolean(getSession()),

    /** Local download; works with no session and no host route. */
    download: () => {
      const prepared = prepare()
      if (!prepared) return false
      const written = downloadText(
        vectorExportFileName(),
        vectorExportText(prepared.geojson),
        'application/geo+json',
      )
      if (!written) {
        showToast(t('vectorExport.failed', { reason: 'download_unavailable' }))
        return false
      }
      showToast(t('vectorExport.downloaded', { count: prepared.count }))
      return true
    },

    /** Write one .geojson under the DSH exports folder and report the path. */
    save: async () => {
      const prepared = prepare()
      if (!prepared) return null
      try {
        const saved = await saveToHost(prepared)
        if (!saved) return null
        showToast(t('vectorExport.saved', { path: saved.path, count: prepared.count }))
        return saved
      } catch (error) {
        showToast(t('vectorExport.failed', { reason: error instanceof Error ? error.message : String(error) }))
        return null
      }
    },

    /**
     * Write one GeoJSON under the exports folder and hand it to the conversation.
     *
     * Preferred path: one host call writes the file, stores it as a durable file
     * attachment and injects a user message carrying it, so the chat shows a real
     * file card. Older hosts without that route fall back to writing the file and
     * injecting a path-only notice, which the agent can still read.
     */
    send: async () => {
      const session = typeof getSession === 'function' ? getSession() : null
      if (!session) {
        showToast(t('vectorExport.noSession'))
        return null
      }
      const prepared = prepare()
      if (!prepared) return null
      const meta = typeof getMeta === 'function' ? getMeta() : null
      const text = t('vectorExport.chatAttachNotice', {
        count: prepared.count,
        bbox: bboxText(prepared.bbox),
      })
      try {
        if (meta?.exportVectorChatUrl) {
          const response = await doFetch()(meta.exportVectorChatUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              kind: 'vector',
              session,
              name: prepared.geojson.name,
              features: prepared.features,
              text,
            }),
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const receipt = await response.json()
          if (receipt.injected === true && receipt.attached === true) {
            showToast(t('vectorExport.sentAttached', { count: prepared.count }))
          } else {
            // The file still exists; report where it went instead of claiming an attachment.
            showToast(t('vectorExport.saved', { path: receipt.path, count: prepared.count }))
          }
          return receipt
        }
        const saved = await saveToHost(prepared)
        if (!saved) return null
        if (!meta?.injectUrl) {
          showToast(t('vectorExport.hostUnavailable'))
          return saved
        }
        const notice = t('vectorExport.chatNotice', {
          path: saved.path,
          count: prepared.count,
          bbox: bboxText(prepared.bbox),
        })
        const response = await doFetch()(meta.injectUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session, text: notice }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        showToast(t('vectorExport.sent', { count: prepared.count }))
        return saved
      } catch (error) {
        showToast(t('vectorExport.failed', { reason: error instanceof Error ? error.message : String(error) }))
        return null
      }
    },
  }
}
