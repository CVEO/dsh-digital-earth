/**
 * Response writers, request path/query parsing and the contained static file server.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
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
  const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream'
  // Byte ranges are what makes a local GeoTIFF/COG readable from the page and
  // what lets browsers seek a local video without downloading it whole.
  const range = parseRange(req.headers?.range, stat.size)
  if (range === 'invalid') {
    res.writeHead(416, { 'content-range': `bytes */${stat.size}`, 'accept-ranges': 'bytes' })
    res.end()
    return
  }
  if (range !== null) {
    res.writeHead(206, {
      'content-type': type,
      'content-length': String(range.end - range.start + 1),
      'content-range': `bytes ${range.start}-${range.end}/${stat.size}`,
      'accept-ranges': 'bytes',
      'cache-control': cacheControl,
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(target, { start: range.start, end: range.end })
      .on('error', () => res.destroy())
      .pipe(res)
    return
  }
  res.writeHead(200, {
    'content-type': type,
    'content-length': String(stat.size),
    'accept-ranges': 'bytes',
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

/**
 * Parse a `Range: bytes=…` header against a file size.
 *
 * Only a single range is supported (multi-range responses are pointless for
 * imagery/tiles and every browser copes with `206` for one range). Returns
 * `null` for "serve the whole file", `'invalid'` for an unsatisfiable range.
 */
export function parseRange(header, size) {
  if (typeof header !== 'string' || header === '') return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return 'invalid'
  let start
  let end
  if (rawStart === '') {
    // Suffix range: the last N bytes.
    const length = Number(rawEnd)
    if (!Number.isFinite(length) || length <= 0) return 'invalid'
    start = Math.max(0, size - length)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Number(rawEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'invalid'
    if (start >= size || end < start) return 'invalid'
    end = Math.min(end, size - 1)
  }
  if (size === 0) return 'invalid'
  return { start, end }
}
