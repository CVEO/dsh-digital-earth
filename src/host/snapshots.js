/**
 * Per-session scene snapshot store and retention.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { MAX_SCENE_BODY, MAX_SCENE_FILES, SCENES_DIR } from './constants.js'
import { pruneByMtime, writeJsonAtomic } from './fs-util.js'
import { sendJson, sendText } from './http.js'
import { validSessionId } from './session.js'

// ---------------------------------------------------------------------------
// Per-session scene snapshots: the panel persists camera, layers and overlays so
// a remounted tab restores them. The JSON is page-only data and never enters a
// tool result; the session id is hashed into the file name.
// ---------------------------------------------------------------------------

/** Deterministic, filesystem-safe file name for one session id. */
export function sceneSnapshotFile(sessionId) {
  return join(SCENES_DIR, `${createHash('sha256').update(sessionId).digest('hex')}.json`)
}

/** GET/PUT one session's scene snapshot. */
export async function sceneSnapshotHandler(req, res) {
  let parsed
  try {
    parsed = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    return sendText(res, 400, 'bad request')
  }
  const session = parsed.searchParams.get('session') ?? ''
  if (!validSessionId(session)) return sendText(res, 400, 'missing or invalid session')
  const file = sceneSnapshotFile(session)
  if (req.method === 'GET') {
    try {
      const stored = JSON.parse(await fs.readFile(file, 'utf8'))
      if (
        stored === null ||
        typeof stored !== 'object' ||
        stored.session !== session ||
        stored.snapshot === null ||
        typeof stored.snapshot !== 'object'
      ) {
        return sendJson(res, 200, { snapshot: null })
      }
      return sendJson(res, 200, {
        snapshot: stored.snapshot,
        savedAt: typeof stored.savedAt === 'string' ? stored.savedAt : null,
      })
    } catch {
      // Missing, unreadable or corrupt: the page falls back to its local cache.
      return sendJson(res, 200, { snapshot: null })
    }
  }
  if (req.method !== 'PUT') return sendText(res, 405, 'method not allowed')
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_SCENE_BODY) {
        req.destroy()
        return sendText(res, 413, 'payload too large')
      }
    }
  } catch {
    return sendText(res, 400, 'bad request')
  }
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return sendText(res, 400, 'invalid json')
  }
  const snapshot = payload?.snapshot
  if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return sendText(res, 400, 'invalid snapshot')
  }
  const stored = { version: 1, session, savedAt: new Date().toISOString(), snapshot }
  try {
    await writeJsonAtomic(file, stored, { space: undefined, trailingNewline: false })
  } catch (error) {
    return sendText(res, 500, `save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  void pruneSceneSnapshots().catch(() => {})
  return sendJson(res, 200, { ok: true, savedAt: stored.savedAt })
}

/** Keep the newest MAX_SCENE_FILES snapshots; older sessions are dropped. */
async function pruneSceneSnapshots() {
  await pruneByMtime(SCENES_DIR, MAX_SCENE_FILES, { match: (name) => name.endsWith('.json') })
}
