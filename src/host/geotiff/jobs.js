/**
 * host/geotiff/jobs.js — the publish queue (one raster at a time).
 *
 * Decoding a 1–2 GB GeoTIFF is memory- and CPU-heavy, so concurrent publishes are
 * worse than queued ones: the queue keeps exactly one job running, gives every job
 * a stable id for progress polling, and cancels by aborting the decoder instead of
 * killing a thread.
 */
import { randomUUID } from 'node:crypto'
import { publishGeotiff } from './publish.js'

const MAX_JOBS = 20

export function createGeotiffJobs({ cacheDir, publish = publishGeotiff, maxJobs = MAX_JOBS } = {}) {
  const jobs = new Map()
  const queue = []
  let active = null

  const publicJob = (job) => ({
    id: job.id,
    state: job.state,
    done: job.done,
    total: job.total,
    level: job.level,
    maxLevel: job.maxLevel,
    readyLevel: job.readyLevel,
    fileName: job.fileName,
    fileKey: job.fileKey ?? null,
    renderKey: job.renderKey ?? null,
    canceled: job.canceled,
    error: job.error ?? null,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null,
  })

  const pump = () => {
    if (active !== null) return
    const next = queue.shift()
    if (next === undefined) return
    active = next
    next.state = 'running'
    next.startedAt = Date.now()
    const controller = new AbortController()
    next.controller = controller
    publish({
      filePath: next.filePath,
      render: next.render,
      cacheDir,
      signal: controller.signal,
      onProgress: (progress) => {
        next.done = progress.done ?? next.done
        next.total = progress.total ?? next.total
        next.level = progress.level ?? next.level
        next.maxLevel = progress.maxLevel ?? next.maxLevel
        next.readyLevel = progress.readyLevel ?? next.readyLevel
      },
    })
      .then((result) => {
        next.state = result.canceled ? 'canceled' : 'done'
        next.canceled = Boolean(result.canceled)
        next.fileKey = result.fileKey
        next.renderKey = result.renderKey
        next.total = result.total ?? next.total
        next.done = result.done ?? next.done
        next.readyLevel = (result.meta?.maxLevel ?? next.maxLevel) + 1
        next.meta = result.meta
      })
      .catch((error) => {
        next.state = 'failed'
        next.error = { code: error?.code ?? 'publish_failed', message: error?.message ?? String(error) }
      })
      .finally(() => {
        next.finishedAt = Date.now()
        active = null
        pump()
      })
  }

  return {
    /** Queue a publish; the returned job id is stable for polling. */
    start({ filePath, render, fileName }) {
      const live = [...jobs.values()].filter((entry) => entry.state === 'queued' || entry.state === 'running').length
      if (live >= maxJobs) {
        const error = new Error('too many publish jobs are already queued')
        error.code = 'too_many_jobs'
        throw error
      }
      const job = {
        id: randomUUID().slice(0, 8),
        filePath,
        render,
        fileName: fileName ?? filePath.split(/[\\/]/).pop() ?? filePath,
        state: 'queued',
        done: 0,
        total: 0,
        level: 0,
        maxLevel: 0,
        readyLevel: -1,
        canceled: false,
        error: null,
        startedAt: null,
        finishedAt: null,
      }
      jobs.set(job.id, job)
      queue.push(job)
      // Bound memory: forget the oldest finished jobs, never a live one.
      while (jobs.size > maxJobs) {
        const oldest = [...jobs.values()].find((entry) => entry.state === 'done' || entry.state === 'failed' || entry.state === 'canceled')
        if (oldest === undefined) break
        jobs.delete(oldest.id)
      }
      pump()
      return publicJob(job)
    },
    status(id) {
      const job = jobs.get(id)
      return job ? publicJob(job) : null
    },
    list() {
      return [...jobs.values()].map(publicJob)
    },
    cancel(id) {
      const job = jobs.get(id)
      if (!job) return null
      if (job.state === 'queued') {
        const index = queue.indexOf(job)
        if (index >= 0) queue.splice(index, 1)
        job.state = 'canceled'
        job.canceled = true
        job.finishedAt = Date.now()
        return publicJob(job)
      }
      if (job.state === 'running') {
        job.canceled = true
        job.controller?.abort()
      }
      return publicJob(job)
    },
    /** True while a publish is running; the HTTP layer refuses a second one. */
    get busy() {
      return active !== null
    },
  }
}
