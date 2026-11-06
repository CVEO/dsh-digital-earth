/**
 * Response writers, request path/query parsing and the contained static file server.
 *
 * v2.0 host split: implementation moved verbatim from the index.js monolith.
 */
import { promises as fs, createReadStream } from 'node:fs'
import { extname, resolve } from 'node:path'
import { MIME } from './constants.js'
import { isWithinDirectory, realPathOr } from './paths.js'

export function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(text)
}

export function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(data))
}

/** Percent-encoded pathname of a request; the router hands route handlers only (req, res). */
export function requestPath(req) {
  try {
    return new URL(req.url ?? '/', 'http://localhost').pathname
  } catch {
    return '/'
  }
}

/** The raw path below a prefix route, or `null` when the request is not below it. */
export function subPath(pathname, prefix) {
  if (pathname === prefix) return ''
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length + 1)
  return null
}

/**
 * Query string of the request target, read from the raw request line so encoded
 * separators stay intact. The panel appends a remote URL's `?query` after the
 * encoded path; it belongs to the upstream URL, not to the final path segment.
 */
export function requestQuery(req) {
  const raw = typeof req.url === 'string' ? req.url : ''
  const mark = raw.indexOf('?')
  if (mark < 0) return ''
  return raw.slice(mark + 1)
}

export async function serveFile(req, res, root, relPath, cacheControl) {
  if (relPath === '') return sendText(res, 404, 'not found')
  const target = resolve(root, relPath)
  if (!isWithinDirectory(target, root)) return sendText(res, 403, 'forbidden')
  // A symlink or junction below the root must not escape it: compare the
  // resolved real paths, not just the lexical ones.
  if (!isWithinDirectory(await realPathOr(target), await realPathOr(root))) return sendText(res, 403, 'forbidden')
  let stat
  try {
    stat = await fs.stat(target)
  } catch {
    return sendText(res, 404, 'not found')
  }
  if (!stat.isFile()) return sendText(res, 404, 'not found')
  res.writeHead(200, {
    'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'content-length': String(stat.size),
    'cache-control': cacheControl,
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(target)
    .on('error', () => res.destroy())
    .pipe(res)
}
