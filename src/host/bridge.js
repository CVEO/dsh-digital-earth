/**
 * Session-scoped SSE command bridge between host tools and the panel.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { BRIDGE_HEARTBEAT_MS, MAX_BRIDGE_BODY, PANEL_ATTACH_GRACE_MS, TOKEN } from './constants.js'
import { LOCAL_ACCESS_TIMEOUT_MS, isLocalResolutionAllowed, localPathError, resolveLocalTileset } from './local-resolve.js'
import { PANEL_CLOSED_MESSAGE, asResultObject, scrubToken, validSessionId } from './session.js'
import { sendText } from './http.js'

const timeoutMessage = (action, timeoutMs) =>
  `The digital earth panel did not answer the "${action}" command within ${Math.round(timeoutMs / 1000)}s. Make sure the panel is still open and has finished loading, then retry.`

// Only the newest connection of a session receives commands, so several open
// tabs cannot run one command twice; older tabs stay connected but idle.
const MULTI_TAB_HINT = ' Several panel tabs are connected for this session and only the most recently opened one receives commands; switch to that tab (or reopen the panel here) and retry.'

/**
 * Session-scoped command bridge between the Host tools and the browser panel.
 *
 * Each open tab holds one SSE connection. A command is delivered only to the
 * newest connection of its session, so several open tabs can never run the same
 * load or capture twice; older tabs keep their stream and heartbeat but stay
 * idle. The first acknowledgement settles the call, and calls for one session
 * run one at a time so concurrent tool calls cannot interleave camera changes.
 *
 * A tool call may arrive before the panel exists: the client half opens the
 * docked tab on demand. `waitForAttach` therefore holds the command for a short
 * grace period (options.attachGraceMs) while the tab connects, instead of
 * failing the first call in a closed conversation.
 *
 * Test seam: exported so the host bridge can be exercised without a web server.
 */
export function createBridge(allowedDirs, options = {}) {
  const sessions = new Map()
  const pending = new Map()
  const queues = new Map()
  // One waiter set per session id: the attach waiters of that session.
  const attachWaiters = new Map()
  const requestedGrace = options?.attachGraceMs
  const attachGraceMs = Number.isFinite(requestedGrace) && requestedGrace >= 0 ? requestedGrace : PANEL_ATTACH_GRACE_MS
  // Panel access dialogs get their own deadline; it is independent from the
  // scene-command timeout and can be shortened by tests.
  const requestedAuthorize = options?.authorizeTimeoutMs
  const authorizeTimeoutMs = Number.isFinite(requestedAuthorize) && requestedAuthorize > 0 ? requestedAuthorize : LOCAL_ACCESS_TIMEOUT_MS
  let sequence = 0

  const connectedSessions = () =>
    [...sessions.keys()].filter((sessionId) => (sessions.get(sessionId)?.size ?? 0) > 0)

  const hasConnection = (sessionId) => (sessions.get(sessionId)?.size ?? 0) > 0

  /** Wake every attach waiter of a session; a real connection replaces the wait. */
  const wakeAttachWaiters = (sessionId) => {
    const waiters = attachWaiters.get(sessionId)
    if (!waiters) return
    for (const waiter of [...waiters]) waiter.finish(true)
  }

  /**
   * Resolve true once a connection for the session exists, false after the
   * timeout or on abort, true immediately when a tab is already connected.
   */
  const waitForAttach = (sessionId, timeoutMs, signal) => {
    if (hasConnection(sessionId)) return Promise.resolve(true)
    return new Promise((resolveWait) => {
      const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0
      if (limit === 0) {
        resolveWait(false)
        return
      }
      const waiters = attachWaiters.get(sessionId) ?? new Set()
      attachWaiters.set(sessionId, waiters)
      let timer = null
      const waiter = {
        done: false,
        finish: (attached) => {
          if (waiter.done) return
          waiter.done = true
          if (timer !== null) clearTimeout(timer)
          signal?.removeEventListener?.('abort', onAbort)
          waiters.delete(waiter)
          if (waiters.size === 0 && attachWaiters.get(sessionId) === waiters) attachWaiters.delete(sessionId)
          resolveWait(attached)
        },
      }
      const onAbort = () => waiter.finish(false)
      waiters.add(waiter)
      timer = setTimeout(() => waiter.finish(false), limit)
      // Keep this short timer ref'd: unref'ing it lets a test runner (or a
      // draining event loop) end the process while the awaited attach promise is
      // still pending, which surfaces as "Promise resolution is still pending".
      timer.ref?.()
      signal?.addEventListener?.('abort', onAbort, { once: true })
      // `abort` may have fired between the check above and the listener.
      if (signal?.aborted) waiter.finish(false)
    })
  }

  const writeFrame = (connection, frame) => {
    if (connection.closed) return false
    try {
      connection.res.write(frame)
      return true
    } catch {
      connection.detach()
      return false
    }
  }

  const attach = (sessionId, req, res) => {
    const connections = sessions.get(sessionId) ?? new Set()
    sessions.set(sessionId, connections)
    const connection = { res, closed: false, timer: null, detach: null }
    const detach = () => {
      if (connection.closed) return
      connection.closed = true
      if (connection.timer !== null) clearInterval(connection.timer)
      connections.delete(connection)
      if (connections.size === 0 && sessions.get(sessionId) === connections) sessions.delete(sessionId)
    }
    connection.detach = detach
    connections.add(connection)
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.write('retry: 3000\n\n')
    res.write(`event: hello\ndata: ${JSON.stringify({ session: sessionId })}\n\n`)
    connection.timer = setInterval(() => {
      if (connection.closed) return
      try {
        res.write(': ping\n\n')
      } catch {
        detach()
      }
    }, BRIDGE_HEARTBEAT_MS)
    connection.timer.unref?.()
    req.on('close', detach)
    req.on('error', detach)
    // The stream is live: release any tool call that was waiting for this tab.
    wakeAttachWaiters(sessionId)
    return connection
  }

  /** Run one task after every earlier task of the same session settled. */
  const enqueue = (sessionId, task) => {
    const previous = queues.get(sessionId) ?? Promise.resolve()
    const current = previous.then(task, task)
    let tail
    tail = current
      .then(() => undefined, () => undefined)
      .finally(() => {
        if (queues.get(sessionId) === tail) queues.delete(sessionId)
      })
    queues.set(sessionId, tail)
    return current
  }

  const bridgeFailure = (kind, message) => {
    const error = new Error(message)
    error.bridgeKind = kind
    return error
  }

  /** Send one command to the newest connection of a session and await its ack. */
  const dispatch = (sessionId, action, args, timeoutMs, signal) => new Promise((resolveCommand, rejectCommand) => {
    const cancelledMessage = `The "${action}" command was cancelled before it reached the digital earth panel.`
    if (signal?.aborted) {
      rejectCommand(bridgeFailure('cancelled', cancelledMessage))
      return
    }
    const connections = sessions.get(sessionId)
    if (!connections || connections.size === 0) {
      rejectCommand(bridgeFailure('closed', PANEL_CLOSED_MESSAGE))
      return
    }
    // The timeout starts when this command is actually dispatched, not when it
    // was queued behind an earlier one for the same session.
    if (!(timeoutMs > 0)) {
      rejectCommand(bridgeFailure('timeout', timeoutMessage(action, timeoutMs) + (connections.size > 1 ? MULTI_TAB_HINT : '')))
      return
    }
    const id = `earth-${Date.now().toString(36)}-${(sequence += 1)}`
    let abortListener = null
    const job = {
      session: sessionId,
      settled: false,
      timer: null,
      finish: (error, value) => {
        if (job.settled) return
        job.settled = true
        if (job.timer !== null) clearTimeout(job.timer)
        if (abortListener !== null) signal?.removeEventListener?.('abort', abortListener)
        pending.delete(id)
        if (error) rejectCommand(error)
        else resolveCommand(value === undefined ? {} : value)
      },
    }
    // Only the newest attachment executes: an older tab that still has the
    // panel open must stay idle instead of running the command a second time.
    const newest = [...connections].pop()
    abortListener = () => {
      if (newest) {
        try {
          writeFrame(newest, `event: cancel\ndata: ${JSON.stringify({ id, action })}\n\n`)
        } catch {
          /* ignore closed socket on cancel */
        }
      }
      job.finish(bridgeFailure('cancelled', `The "${action}" command was cancelled.`))
    }
    signal?.addEventListener?.('abort', abortListener, { once: true })
    pending.set(id, job)
    const timerMessage = timeoutMessage(action, timeoutMs) + (connections.size > 1 ? MULTI_TAB_HINT : '')
    job.timer = setTimeout(() => job.finish(bridgeFailure('timeout', timerMessage)), timeoutMs)
    job.timer.unref?.()
    const frame = `event: command\ndata: ${JSON.stringify({ id, action, args })}\n\n`
    if (!newest || !writeFrame(newest, frame)) job.finish(bridgeFailure('closed', PANEL_CLOSED_MESSAGE))
  })

  /** The model-supplied absolute path of a load/inspect call, or null. */
  const localPathRequest = (action, args) => {
    if (action !== 'load' && action !== 'inspect') return null
    return typeof args?.path === 'string' ? args.path : null
  }

  const authorizeArgs = (action, resolution) => ({
    request: action,
    path: resolution.requested,
    target: resolution.path,
    directory: resolution.directory,
    kind: resolution.kind,
    resolved: resolution.path !== resolution.requested,
  })

  /**
   * Ask the panel for one-time access to a resolved folder. Any denial becomes
   * `access_denied`; the independent dialog deadline becomes `access_timeout`.
   * Neither case retries: a retry needs a fresh tool call from the model.
   */
  const requestAuthorization = async (sessionId, action, resolution, signal) => {
    try {
      return await dispatch(sessionId, 'authorize', authorizeArgs(action, resolution), authorizeTimeoutMs, signal)
    } catch (error) {
      if (error?.bridgeKind === 'timeout') {
        throw localPathError(
          'access_timeout',
          `the user did not answer the access request for "${resolution.directory}" within ${Math.round(authorizeTimeoutMs / 1000)}s.`,
          'ask the user to allow the folder, then retry once when they are ready.',
        )
      }
      if (error?.bridgeKind === 'cancelled' || error?.bridgeKind === 'closed') throw error
      throw localPathError(
        'access_denied',
        `the user did not allow "${resolution.directory}".`,
        'stop and report this; do not retry.',
      )
    }
  }

  // Wait for the tab outside the queue and start the command deadline only once
  // it is attached: the panel's start-up time must not eat SCENE_TIMEOUT_MS.
  const run = async (sessionId, action, args, timeoutMs, signal) => {
    const requestedPath = localPathRequest(action, args)
    let resolution = null
    if (requestedPath !== null) {
      // Local paths are resolved from filesystem metadata before a tab is
      // needed; failures here carry their own [code] and never open a dialog.
      resolution = await resolveLocalTileset(requestedPath)
      // `inspect path` runs on the host, so an already allowed file keeps
      // working with the panel closed.
      if (action === 'inspect' && isLocalResolutionAllowed(resolution, allowedDirs)) return { ...resolution }
    }
    if (signal?.aborted) {
      throw bridgeFailure('cancelled', `The "${action}" command was cancelled before it reached the digital earth panel.`)
    }
    const attached = await waitForAttach(sessionId, attachGraceMs, signal)
    if (!attached) {
      // An abort is the caller's own cancellation, not a missing panel.
      if (signal?.aborted) {
        throw bridgeFailure('cancelled', `The "${action}" command was cancelled before it reached the digital earth panel.`)
      }
      throw bridgeFailure('closed', PANEL_CLOSED_MESSAGE)
    }
    return enqueue(sessionId, async () => {
      let current = resolution
      if (requestedPath !== null) {
        if (current === null) current = await resolveLocalTileset(requestedPath)
        if (!isLocalResolutionAllowed(current, allowedDirs)) {
          // Order matters: wait for the tab, ask for permission, re-check the
          // allowlist (and the path) from scratch, then continue the original
          // load/inspect. No retry on denial or timeout.
          await requestAuthorization(sessionId, action, current, signal)
          current = await resolveLocalTileset(requestedPath)
          if (!isLocalResolutionAllowed(current, allowedDirs)) {
            throw localPathError(
              'access_denied',
              `the folder for "${current.requested}" was not added to the panel allowlist.`,
              'stop and report this; do not retry.',
            )
          }
        }
        if (action === 'inspect') return { ...current }
      }
      const commandArgs = current === null ? args : { ...args, path: current.path }
      const result = await dispatch(sessionId, action, commandArgs, timeoutMs, signal)
      if (current !== null && action === 'load') {
        // The panel returns view/layers_count; a healed path adds the original
        // request so the model can report what it actually loaded.
        const value = asResultObject(result)
        if (current.resolvedFrom !== undefined && value.resolved_from === undefined) value.resolved_from = current.resolvedFrom
        if (typeof value.layers_count !== 'number' && Array.isArray(value.layers)) value.layers_count = value.layers.length
        return value
      }
      return result
    })
  }

  /** Settle a pending command from the browser acknowledgement, first ack wins. */
  const settle = (sessionId, id, payload) => {
    const job = pending.get(id)
    if (!job || job.settled || job.session !== sessionId) return false
    if (payload.ok === true) {
      job.finish(null, payload.result)
      return true
    }
    const message = typeof payload.error === 'string' && payload.error.trim() !== ''
      ? scrubToken(payload.error.trim().slice(0, 2000))
      : 'The digital earth panel reported the command as failed without an error message.'
    job.finish(new Error(message))
    return true
  }

  const dispose = () => {
    // Pending attach waiters must not outlive the plugin and reject later.
    for (const waiters of [...attachWaiters.values()]) {
      for (const waiter of [...waiters]) waiter.finish(false)
    }
    attachWaiters.clear()
    for (const job of [...pending.values()]) {
      if (!job.settled) job.finish(new Error('The digital earth bridge was unloaded before the command completed.'))
    }
    pending.clear()
    for (const connections of [...sessions.values()]) {
      for (const connection of [...connections]) {
        connection.closed = true
        if (connection.timer !== null) clearInterval(connection.timer)
        try {
          connection.res.end()
        } catch {
          // The page is already gone.
        }
      }
    }
    sessions.clear()
    queues.clear()
  }

  return { attach, waitForAttach, run, settle, connectedSessions, dispose }
}


export function bridgeHandler(bridge) {
  return (req, res) => {
    let parsed
    try {
      parsed = new URL(req.url ?? '/', 'http://localhost')
    } catch {
      return sendText(res, 400, 'bad request')
    }
    if (parsed.searchParams.get('token') !== TOKEN) return sendText(res, 403, 'forbidden')
    if (req.method === 'GET') {
      const session = parsed.searchParams.get('session') ?? ''
      if (!validSessionId(session)) return sendText(res, 400, 'missing or invalid session')
      bridge.attach(session, req, res)
      return
    }
    if (req.method === 'POST') return bridgeAck(bridge, req, res)
    return sendText(res, 405, 'method not allowed')
  }
}

/** POST: the browser acknowledges one command; unknown or stale ids are ignored. */
async function bridgeAck(bridge, req, res) {
  try {
    let body = ''
    try {
      for await (const chunk of req) {
        body += chunk
        if (body.length > MAX_BRIDGE_BODY) {
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
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return sendText(res, 400, 'invalid ack')
    }
    const session = typeof payload.session === 'string' ? payload.session : ''
    const id = typeof payload.id === 'string' ? payload.id : ''
    if (session !== '' && id !== '') bridge.settle(session, id, payload)
    res.writeHead(204, { 'cache-control': 'no-store' })
    res.end()
  } catch {
    if (!res.writableEnded) sendText(res, 400, 'bad ack')
  }
}
