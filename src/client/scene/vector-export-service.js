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
import { downloadText } from './download.js'
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

function cleanExportBase(raw, fallback = 'vector-overlay') {
  const stripped = String(raw ?? '').replace(/^GeoJSON:\s*/i, '').trim()
  const safe = stripped
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return safe || fallback
}

export function createVectorExport({ stateRef, getMeta, getSession, showToast, t, fetchImpl } = {}) {
  const doFetch = () => (typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch)

  const buildPrepared = ({ drawCommands, measureCommands }, { name = 'vector-overlay', fileName = vectorExportFileName() } = {}) => {
    const built = collectVectorFeatures({ drawCommands, measureCommands })
    if (!built.ok) {
      showToast(t(`vectorExport.${built.error}`))
      return null
    }
    return {
      features: built.features,
      geojson: vectorExportCollection(built.features, { name }),
      count: built.features.length,
      bbox: vectorBbox(built.features),
      fileName,
    }
  }

  const prepare = () => {
    const state = stateRef?.current ?? {}
    return buildPrepared(
      { drawCommands: state.drawCommands, measureCommands: state.measureCommands },
      { name: 'vector-overlay', fileName: vectorExportFileName() },
    )
  }

  const prepareOverlay = (index) => {
    const command = stateRef?.current?.drawCommands?.[index]
    if (!command) {
      showToast(t('vectorExport.empty'))
      return null
    }
    const base = cleanExportBase(command.caption, `vector-overlay-${index + 1}`)
    return buildPrepared(
      { drawCommands: [command], measureCommands: [] },
      { name: base, fileName: `${base}.geojson` },
    )
  }

  const prepareFeature = (feature, fallbackName) => {
    if (!feature || typeof feature !== 'object') {
      showToast(t('vectorExport.empty'))
      return null
    }
    const base = cleanExportBase(feature.properties?.name ?? fallbackName, 'annotation')
    return buildPrepared(
      { drawCommands: [{ geojson: { type: 'FeatureCollection', features: [feature] } }], measureCommands: [] },
      { name: base, fileName: `${base}.geojson` },
    )
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

  // One export at a time: a double click must not write two files or inject the
  // same attachment twice. Concurrent callers share the in-flight promise.
  const flights = new Map()
  const single = (key, task) => {
    if (flights.has(key)) return flights.get(key)
    const promise = Promise.resolve().then(task).finally(() => { flights.delete(key) })
    flights.set(key, promise)
    return promise
  }

  const deliverDownload = (prepared) => {
    if (!prepared) return false
    const written = downloadText(
      prepared.fileName,
      vectorExportText(prepared.geojson),
      'application/geo+json',
    )
    if (!written) {
      showToast(t('vectorExport.failed', { reason: 'download_unavailable' }))
      return false
    }
    showToast(t('vectorExport.downloaded', { count: prepared.count }))
    return true
  }

  const deliverSend = (key, prepareFn) => single(key, async () => {
    const session = typeof getSession === 'function' ? getSession() : null
    if (!session) {
      showToast(t('vectorExport.noSession'))
      return null
    }
    const prepared = prepareFn()
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
  })

  return {
    canSend: () => typeof getSession === 'function' && Boolean(getSession()),

    /** Local download; works with no session and no host route. */
    download: () => deliverDownload(prepare()),

    /** Download one specific draw/GeoJSON overlay as its own .geojson file. */
    downloadOverlay: (index) => deliverDownload(prepareOverlay(index)),

    /** Write one .geojson under the DSH exports folder and report the path. */
    save: () => single('save', async () => {
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
    }),

    /**
     * Write one GeoJSON under the exports folder and hand it to the conversation.
     *
     * Preferred path: one host call writes the file, stores it as a durable file
     * attachment and injects a user message carrying it, so the chat shows a real
     * file card. Older hosts without that route fall back to writing the file and
     * injecting a path-only notice, which the agent can still read.
     */
    send: () => deliverSend('send', prepare),

    /** Send one specific draw/GeoJSON overlay to chat as a file attachment. */
    sendOverlay: (index) => deliverSend(`send-overlay-${index}`, () => prepareOverlay(index)),

    /** Send the currently selected feature to chat as its own GeoJSON attachment. */
    sendFeature: (feature, fallbackName) => deliverSend('send-feature', () => prepareFeature(feature, fallbackName)),
  }
}
