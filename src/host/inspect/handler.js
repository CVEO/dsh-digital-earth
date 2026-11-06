/**
 * Report file writing/retention and the POST /inspect route handler.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { INSPECT_FAILURE_STATUS, InspectError, normalizeInspectRuntime, normalizeInspectSource } from './fetch.js'
import { MAX_INSPECT_BODY, MAX_INSPECT_REPORTS, PANEL_HEADER, REPORT_DIR, TOKEN } from '../constants.js'
import { analyzeTileset } from './analyze.js'
import { isPlainObject } from '../sanitize.js'
import { scrubToken } from '../session.js'
import { sendJson, sendText } from '../http.js'
import { pruneByMtime } from '../fs-util.js'
import { timeStamp } from '../paths.js'

function inspectSlug(label) {
  const raw = typeof label === 'string' ? scrubToken(label) : ''
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return slug === '' ? 'tileset' : slug
}

/** Write the report JSON, then keep only the newest reports. The absolute path is
 * added to the report itself as well, so the panel can copy it from either place. */
export async function writeInspectReport(report) {
  await fs.mkdir(REPORT_DIR, { recursive: true })
  const base = `${timeStamp()}-${inspectSlug(report.source?.label)}`
  let handle
  let target
  // `wx` makes create-or-fail atomic, so two inspections in the same second get
  // different files instead of racing between exists() and writeFile().
  for (let attempt = 0; attempt < 100; attempt += 1) {
    target = join(REPORT_DIR, attempt === 0 ? `${base}.json` : `${base}-${attempt + 1}.json`)
    try {
      handle = await fs.open(target, 'wx')
      break
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  if (handle === undefined) throw new InspectError('internal', 'could not create a unique inspection report file.')
  report.reportPath = target
  try {
    await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`, 'utf8')
  } finally {
    await handle.close().catch(() => {})
  }
  try {
    await pruneInspectReports()
  } catch {
    // Retention is best effort; the report itself already exists.
  }
  return report
}

/** Keep the newest 100 report files, deleting the oldest first. */
async function pruneInspectReports() {
  await pruneByMtime(REPORT_DIR, MAX_INSPECT_REPORTS, { match: (name) => /^\d{8}-\d{6}-.+\.json$/.test(name) })
}

/** POST /api/3dviewer/inspect: the panel's data health check endpoint. */
export async function inspectHandler(req, res, allowedDirs) {
  if (req.method !== 'POST') return sendText(res, 405, 'method not allowed')
  let parsed
  try {
    parsed = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    return sendText(res, 400, 'bad request')
  }
  if (parsed.searchParams.get('token') !== TOKEN) return sendText(res, 403, 'forbidden')
  if (req.headers?.[PANEL_HEADER] !== '1') return sendText(res, 403, 'inspect requests must come from the panel')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (Buffer.byteLength(body, 'utf8') > MAX_INSPECT_BODY) {
        req.destroy()
        return sendInspectFailure(res, 'too_large', `inspect request body exceeds ${MAX_INSPECT_BODY / 1024} KiB.`)
      }
    }
  } catch {
    return sendInspectFailure(res, 'invalid_json', 'could not read the inspect request body.')
  }
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return sendInspectFailure(res, 'invalid_json', 'inspect request body is not valid JSON.')
  }
  if (!isPlainObject(payload)) return sendInspectFailure(res, 'invalid_source', 'inspect request body must be a JSON object.')
  if (payload.deep !== undefined && typeof payload.deep !== 'boolean') {
    return sendInspectFailure(res, 'invalid_source', 'inspect "deep" must be true or false.')
  }
  if (payload.runtime !== undefined && payload.runtime !== null && normalizeInspectRuntime(payload.runtime) === null) {
    return sendInspectFailure(res, 'invalid_source', 'inspect "runtime" must contain numeric tiles/pending/triangles/memory counters.')
  }
  let source
  try {
    source = normalizeInspectSource(payload.source)
  } catch (error) {
    return sendInspectFailure(res, error instanceof InspectError ? error.code : 'invalid_source', error instanceof Error ? error.message : String(error))
  }
  try {
    const report = await analyzeTileset(source, {
      deep: payload.deep === true,
      runtime: payload.runtime,
      allowedDirs,
    })
    await writeInspectReport(report)
    sendJson(res, 200, scrubToken({ ok: true, reportPath: report.reportPath, report }))
  } catch (error) {
    if (error instanceof InspectError) return sendInspectFailure(res, error.code, error.message)
    sendInspectFailure(res, 'internal', error instanceof Error ? error.message : String(error))
  }
}

function sendInspectFailure(res, code, message) {
  const status = INSPECT_FAILURE_STATUS[code] ?? 502
  sendJson(res, status, { ok: false, code, error: scrubToken(typeof message === 'string' ? message : 'inspection failed') })
}
