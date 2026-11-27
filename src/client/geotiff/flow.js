/**
 * geotiff/flow.js — the client half of local GeoTIFF publishing.
 *
 * The host owns the decoding; the page only asks for a folder scan, a probe, a
 * publish job and a preview image. Keeping those four calls in one module means
 * the dialog stays a presenter and the endpoint names appear exactly once.
 *
 * `x-dsh-panel` is required on scan/probe/publish: the host only acts on host
 * paths for a gesture the user made in this page. Tile reads need no header —
 * Cesium fetches them itself through an ordinary `<img>`.
 *
 * The route prefix embeds the host token, which rotates when the host restarts.
 * A stale prefix answers 403/404, so every call retries once after re-reading
 * `/meta` instead of leaving the dialog broken until a page reload.
 */
const API = '/api/3dviewer'
const PANEL = { 'x-dsh-panel': '1' }

let cachedBase = null

export class FlowError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'FlowError'
    this.code = code
  }
}

async function readBase() {
  const response = await fetch(`${API}/meta`, { headers: PANEL })
  if (!response.ok) throw new FlowError('host_unavailable', 'Cannot reach the 3D viewer host')
  const meta = await response.json()
  if (typeof meta?.geotiffBase !== 'string' || meta.geotiffBase === '') {
    throw new FlowError('unsupported', 'This host cannot publish local GeoTIFF yet; update the plugin')
  }
  return meta.geotiffBase
}

async function base() {
  if (cachedBase) return cachedBase
  cachedBase = await readBase()
  return cachedBase
}

async function json(response) {
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) cachedBase = null
    throw new FlowError(payload?.code ?? `http_${response.status}`, payload?.message ?? `Request failed (${response.status})`)
  }
  return payload
}

/** Run `build(prefix)` once; on a rotated token, refresh the prefix and retry. */
async function withBase(build) {
  try {
    return await build(await base())
  } catch (error) {
    if (error instanceof FlowError && (error.code === 'http_403' || error.code === 'http_404')) {
      cachedBase = null
      return build(await base())
    }
    throw error
  }
}

/** List `.tif/.tiff` files directly inside a folder the user just picked. */
export async function scanFolder(dir) {
  return withBase(async (prefix) => {
    const response = await fetch(`${prefix}/scan?dir=${encodeURIComponent(dir)}`, { headers: PANEL })
    return json(response)
  })
}

/** Read identity, CRS, bands and statistics without writing anything. */
export async function probeFile(path) {
  return withBase(async (prefix) => {
    const response = await fetch(`${prefix}/probe`, {
      method: 'POST',
      headers: { ...PANEL, 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    // The route wraps the payload in `{ probe }` so failures can carry a code;
    // flatten it here and no caller has to remember the envelope.
    const payload = await json(response)
    return payload?.probe ?? payload
  })
}

/** Queue a publish job; resolves as soon as the host accepts it. */
export async function startPublish(path, render) {
  return withBase(async (prefix) => {
    const response = await fetch(`${prefix}/publish`, {
      method: 'POST',
      headers: { ...PANEL, 'content-type': 'application/json' },
      body: JSON.stringify({ path, render }),
    })
    return json(response)
  })
}

export async function jobStatus(jobId) {
  return withBase(async (prefix) => {
    const response = await fetch(`${prefix}/job/${encodeURIComponent(jobId)}`)
    return json(response)
  })
}

export async function cancelJob(jobId) {
  return withBase(async (prefix) => {
    const response = await fetch(`${prefix}/job/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
    return json(response)
  })
}

/** Bounded polling: the publish job reports a tile count, not a stream. */
export function waitForJob(jobId, { onProgress = () => {}, signal, interval = 450 } = {}) {
  return new Promise((resolve, reject) => {
    let timer = null
    let stopped = false
    const stop = () => {
      stopped = true
      if (timer !== null) clearTimeout(timer)
    }
    const tick = async () => {
      if (stopped) return
      if (signal?.aborted) {
        stop()
        reject(new FlowError('canceled', 'Publish canceled'))
        return
      }
      try {
        const job = await jobStatus(jobId)
        if (stopped) return
        onProgress(job)
        if (job.state === 'done' || job.state === 'failed' || job.state === 'canceled') {
          stop()
          if (job.state === 'done') resolve(job)
          else if (job.state === 'canceled') reject(new FlowError('canceled', 'Publish canceled'))
          else reject(new FlowError(job.error?.code ?? 'publish_failed', job.error?.message ?? 'Publish failed'))
          return
        }
      } catch (error) {
        stop()
        reject(error)
        return
      }
      timer = setTimeout(tick, interval)
    }
    void tick()
  })
}

/** Preview URL for a probed file; the host renders/caches the PNG. */
export async function previewUrl(probe) {
  const prefix = await base()
  return `${prefix}/preview/${probe.fileKey}/${probe.renderKey}.png`
}

/**
 * The xyz overlay descriptor handed to the scene once a job finishes.
 *
 * The job is authoritative: the probe's render key comes from a different host
 * process call and an older client could hash it differently, while the finished
 * job's key names the directory that actually exists on disk.
 */
/** Absolute URL for one host route (the catalog only stores http(s) URLs). */
function absoluteUrl(prefix, suffix) {
  const base = prefix.startsWith('http') ? prefix : `${globalThis.location?.origin ?? 'http://localhost'}${prefix}`
  return `${base}${suffix}`
}

/**
 * Copy a file the page picked into the host cache. A browser cannot hand a
 * native path to Node, so the bytes themselves cross the local HTTP boundary;
 * XHR is used for upload progress on multi-hundred-megabyte files.
 */
export async function uploadGeotiff(file, { onProgress, signal } = {}) {
  const send = (prefix) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', absoluteUrl(prefix, '/upload'))
      xhr.setRequestHeader('x-dsh-panel', '1')
      xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name))
      xhr.responseType = 'text'
      const abort = () => xhr.abort()
      signal?.addEventListener('abort', abort, { once: true })
      const done = (fn) => {
        signal?.removeEventListener('abort', abort)
        fn()
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(event.loaded, event.total)
      }
      xhr.onload = () =>
        done(() => {
          let payload = null
          try {
            payload = JSON.parse(xhr.responseText)
          } catch {
            payload = null
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            const code = payload?.code ?? `http_${xhr.status}`
            if (xhr.status === 403 || xhr.status === 404) cachedBase = null
            reject(new FlowError(code, payload?.message ?? `Upload failed (${xhr.status})`))
            return
          }
          resolve(payload)
        })
      xhr.onerror = () => done(() => reject(new FlowError('network', 'Upload failed')))
      xhr.onabort = () => done(() => reject(new FlowError('canceled', 'Upload canceled')))
      xhr.send(file)
    })
  try {
    return await send(await base())
  } catch (error) {
    if (error instanceof FlowError && (error.code === 'http_403' || error.code === 'http_404')) {
      cachedBase = null
      return send(await base())
    }
    throw error
  }
}

export async function overlayFor(probe, job) {
  const prefix = await base()
  const fileKey = job?.fileKey ?? probe.fileKey
  const renderKey = job?.renderKey ?? probe.renderKey
  return {
    type: 'xyz',
    name: probe.name.replace(/\.tiff?$/i, ''),
    url: absoluteUrl(prefix, `/tiles/${fileKey}/${renderKey}/{z}/{x}/{y}.png`),
    tilingScheme: 'geographic',
    maximumLevel: job?.maxLevel ?? probe.pyramid?.maxLevel ?? 0,
    opacity: 1,
  }
}
