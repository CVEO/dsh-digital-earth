/**
 * v1.5.2 security regressions (host side).
 *
 * Covers the two P1 findings from the 1.5.1 audit:
 *   - H1: a proxied upstream body that errors mid-stream must never surface as an
 *     uncaught exception (it used to be able to terminate the Host process);
 *   - H2: a junction/symlink to a drive root must not widen the folder allowlist,
 *     and `tilesHandler` must refuse to serve from such a root even if an older
 *     build had remembered it.
 *
 * DSH_HOME is redirected before importing host modules: constants.js freezes the
 * state paths at import time, so the remembered-folder test must not touch the
 * real user profile.
 */
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough, Readable } from 'node:stream'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

const previousHome = process.env.DSH_HOME
const home = await mkdtemp(join(tmpdir(), 'dsh-de-sec-'))
process.env.DSH_HOME = home

const { streamRemoteBody, scanHandler, tilesHandler } = await import(new URL('../src/host/routes.js', import.meta.url).href)
const { isSafeOpenedDirectory } = await import(new URL('../src/host/paths.js', import.meta.url).href)
const { createRecentDirectories } = await import(new URL('../src/host/directories.js', import.meta.url).href)
const { TOKEN } = await import(new URL('../src/host/constants.js', import.meta.url).href)
const { toB64 } = await import(new URL('../src/host/paths.js', import.meta.url).href)

after(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

/** Minimal response double: a real Writable (pipeline needs one) plus writeHead. */
function fakeResponse() {
  const res = new PassThrough()
  const chunks = []
  res.statusCode = null
  res.headers = null
  res.writeHead = (status, headers) => {
    res.statusCode = status
    res.headers = headers
    return res
  }
  res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  res.text = () => chunks.map((chunk) => chunk.toString('utf8')).join('')
  return res
}

function fakeRequest(url, headers = {}) {
  const req = new EventEmitter()
  req.url = url
  req.headers = headers
  req.destroy = () => {
    req.destroyed = true
  }
  return req
}

test('H1: streamRemoteBody swallows a mid-stream upstream error (no uncaughtException)', async () => {
  const uncaught = []
  const onUncaught = (error) => uncaught.push(error)
  process.on('uncaughtException', onUncaught)
  try {
    const source = new Readable({ read() {} })
    const req = fakeRequest('/api/3dviewer/remote/x')
    const res = fakeResponse()
    streamRemoteBody(source, req, res)
    source.push(Buffer.from('{"asset":'))
    // The upstream dies after the first chunk: this is the exact shape that used
    // to escape `.pipe()` as an unhandled 'error' event.
    source.destroy(new Error('upstream terminated'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.deepEqual(uncaught, [], 'mid-stream upstream error must not surface as uncaughtException')
  } finally {
    process.removeListener('uncaughtException', onUncaught)
  }
})

test('H1: streamRemoteBody cancels the upstream when the page goes away', async () => {
  const source = new Readable({ read() {} })
  const req = fakeRequest('/api/3dviewer/remote/x')
  const res = fakeResponse()
  streamRemoteBody(source, req, res)
  source.push(Buffer.from('partial'))
  req.emit('close')
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(source.destroyed, true, 'page close must destroy the upstream stream')
})

test('H1: streamRemoteBody stops an oversized upstream body', async () => {
  const source = new Readable({ read() {} })
  const req = fakeRequest('/api/3dviewer/remote/x')
  const res = fakeResponse()
  streamRemoteBody(source, req, res, { maxBytes: 8 })
  source.push(Buffer.alloc(32, 1))
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(source.destroyed, true, 'body above the byte budget must be destroyed')
})

test('H2: isSafeOpenedDirectory rejects roots, UNC and extended spellings', () => {
  const windowsRoots = ['C:\\', 'C:/', '\\\\server\\share', '\\\\.\\C:', '\\\\?\\C:\\data']
  for (const value of windowsRoots) assert.equal(isSafeOpenedDirectory(value), false, `${value} must be rejected`)
  assert.equal(isSafeOpenedDirectory('relative\\folder'), false)
  assert.equal(isSafeOpenedDirectory(''), false)
  // A normal subfolder and the current repo folder are safe on every platform.
  const normal = process.platform === 'win32' ? 'C:\\Users' : '/tmp'
  assert.equal(isSafeOpenedDirectory(normal), true)
})

test('H2: scanHandler refuses a junction to a drive root and widens nothing', { skip: process.platform !== 'win32' }, async (t) => {
  const linkRoot = join(home, 'junction-to-c')
  try {
    await symlink('C:\\', linkRoot, 'junction')
  } catch (error) {
    t.skip(`junction creation is not available here: ${error?.code ?? error}`)
    return
  }
  const allowedDirs = new Set()
  const url = `/api/3dviewer/scan?token=${encodeURIComponent(TOKEN)}&dir=${encodeURIComponent(linkRoot)}`
  const res = fakeResponse()
  await scanHandler(fakeRequest(url, { 'x-dsh-panel': '1' }), res, allowedDirs)
  assert.notEqual(res.statusCode, 200, 'a junction to C:\\ must not be accepted')
  assert.equal(allowedDirs.size, 0, 'no directory may be added for a junction to a root')
  assert.ok(![...allowedDirs].some((entry) => entry === 'C:\\'), 'the drive root must never enter the allowlist')
})

test('H2: scanHandler accepts a normal folder inside the temp home', async () => {
  const folder = join(home, 'data')
  await mkdir(join(folder, 'sub'), { recursive: true })
  await writeFile(join(folder, 'sub', 'tileset.json'), '{"asset":{"version":"1.0"}}')
  const allowedDirs = new Set()
  const url = `/api/3dviewer/scan?token=${encodeURIComponent(TOKEN)}&dir=${encodeURIComponent(folder)}`
  const res = fakeResponse()
  await scanHandler(fakeRequest(url, { 'x-dsh-panel': '1' }), res, allowedDirs)
  assert.equal(res.statusCode, 200, res.text())
  assert.ok(allowedDirs.size > 0, 'a normal folder must still be allowed')
  // A second scan without the panel header is rejected before touching disk.
  const denied = fakeResponse()
  await scanHandler(fakeRequest(url), denied, new Set())
  assert.equal(denied.statusCode, 403)
})

test('H2: tilesHandler rejects a drive root even when an old allowlist contained it', async () => {
  const url = `/api/3dviewer/tiles/${encodeURIComponent(TOKEN)}/${encodeURIComponent(toB64('C:\\'))}/Windows/win.ini`
  const res = fakeResponse()
  await tilesHandler(fakeRequest(url), res, new Set(['C:\\']))
  assert.equal(res.statusCode, 403, 'a drive root must never be served, even if remembered')
})

test('H2: directories restore skips a remembered root but keeps a normal folder', async () => {
  const folder = join(home, 'remembered')
  await mkdir(folder, { recursive: true })
  const stateDir = join(home, 'digital-earth')
  await mkdir(stateDir, { recursive: true })
  await writeFile(
    join(stateDir, 'directories.json'),
    JSON.stringify([
      { path: 'C:\\', at: '2026-01-01T00:00:00.000Z' },
      { path: folder, at: '2026-01-02T00:00:00.000Z' },
    ]),
  )
  const allowedDirs = new Set()
  const directories = createRecentDirectories(allowedDirs)
  await directories.restore()
  assert.ok(![...allowedDirs].some((entry) => entry === 'C:\\'), 'restore must never allow the drive root')
  assert.ok([...allowedDirs].some((entry) => entry.toLowerCase().startsWith(folder.toLowerCase())), 'normal folders still restore')
})
