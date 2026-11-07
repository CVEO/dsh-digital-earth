#!/usr/bin/env node
/**
 * georef-osgb.mjs — one-off data repair for OSGB-converted 3D Tiles.
 *
 * The plugin only accepts standard 3D Tiles: a root `transform` or `region` must
 * carry the world placement, and nothing is patched at runtime. This tool is the
 * general data-side fix: it reads the conversion sidecar (`tileset_info.json`)
 * next to any `tileset.json`, converts the documented CGCS2000 Gauss-Krueger
 * origin to WGS84, and writes the missing root `transform` (ENU -> ECEF) once.
 *
 * Supported SRS: CGCS2000 Gauss-Krueger EPSG 4491-4554 (the four contiguous
 * Chinese families). Other projections are reported instead of guessed.
 *
 * Usage:
 *   node scripts/georef-osgb.mjs <dir|tileset.json> [...] [--apply] [--recursive]
 *
 * Default is a dry run. `--apply` backs up `tileset.json` to `tileset.json.bak`
 * (created once) and rewrites it with the root transform. Idempotent: files that
 * already have `root.transform` or `root.boundingVolume.region` are left alone.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const INFO_NAME = 'tileset_info.json'
const TILESET_NAME = 'tileset.json'
const BACKUP_NAME = `${TILESET_NAME}.bak`
// CGCS2000 ellipsoid; WGS84 differs by well under a millimetre at these scales.
const SEMI_MAJOR = 6378137
const FLATTENING = 1 / 298.257222101
const EARTH_MIN_RADIUS = 6_200_000
const EARTH_MAX_RADIUS = 6_600_000

/**
 * Gauss-Krueger frame of a CGCS2000 EPSG code, or null when the code is not in
 * the four contiguous Chinese families (see docs/spec/SPEC-v1.5.md history).
 */
export function gaussKrugerFrame(srs) {
  const match = /^epsg:(\d+)$/i.exec(String(srs ?? '').trim())
  if (match === null) return null
  const code = Number(match[1])
  if (code >= 4491 && code <= 4501) {
    const zone = code - 4478
    return { centralMeridian: zone * 6, falseEasting: zone * 1e6 + 500000 }
  }
  if (code >= 4502 && code <= 4512) return { centralMeridian: 75 + (code - 4502) * 6, falseEasting: 500000 }
  if (code >= 4513 && code <= 4533) {
    const zone = code - 4488
    return { centralMeridian: zone * 3, falseEasting: zone * 1e6 + 500000 }
  }
  if (code >= 4534 && code <= 4554) return { centralMeridian: 75 + (code - 4534) * 3, falseEasting: 500000 }
  return null
}

/** Inverse transverse Mercator (Snyder series), accurate to about a millimetre. */
export function gaussKrugerToGeodetic(easting, northing, frame) {
  const a = SEMI_MAJOR
  const e2 = FLATTENING * (2 - FLATTENING)
  const ep2 = e2 / (1 - e2)
  const rectifying = a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256)
  const mu = northing / rectifying
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const foot =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  const sin = Math.sin(foot)
  const cos = Math.cos(foot)
  const tan = Math.tan(foot)
  const n1 = a / Math.sqrt(1 - e2 * sin * sin)
  const r1 = (a * (1 - e2)) / (1 - e2 * sin * sin) ** 1.5
  const t1 = tan * tan
  const c1 = ep2 * cos * cos
  const d = (easting - frame.falseEasting) / n1
  const lat =
    foot -
    ((n1 * tan) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720)
  const lon =
    (frame.centralMeridian * Math.PI) / 180 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
      cos
  return { lon: (lon * 180) / Math.PI, lat: (lat * 180) / Math.PI }
}

/** WGS84 geodetic -> ECEF metres. */
export function geodeticToEcef(lon, lat, height) {
  const e2 = FLATTENING * (2 - FLATTENING)
  const lambda = (lon * Math.PI) / 180
  const phi = (lat * Math.PI) / 180
  const sin = Math.sin(phi)
  const cos = Math.cos(phi)
  const n = SEMI_MAJOR / Math.sqrt(1 - e2 * sin * sin)
  return [(n + height) * cos * Math.cos(lambda), (n + height) * cos * Math.sin(lambda), (n * (1 - e2) + height) * sin]
}

/** East-north-up -> ECEF, packed column-major for a 3D Tiles root transform. */
export function eastNorthUpTransform(lon, lat, height) {
  const lambda = (lon * Math.PI) / 180
  const phi = (lat * Math.PI) / 180
  const sinLambda = Math.sin(lambda)
  const cosLambda = Math.cos(lambda)
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const origin = geodeticToEcef(lon, lat, height)
  return [
    -sinLambda, cosLambda, 0, 0,
    -sinPhi * cosLambda, -sinPhi * sinLambda, cosPhi, 0,
    cosPhi * cosLambda, cosPhi * sinLambda, sinPhi, 0,
    origin[0], origin[1], origin[2], 1,
  ]
}

/** Resolve the sidecar into a root transform, or explain why it cannot. */
export function deriveRootTransform(info) {
  if (info === null || typeof info !== 'object') return { ok: false, reason: 'missing_info' }
  const origin = info.srs_origin
  if (!Array.isArray(origin) || origin.length < 2) return { ok: false, reason: 'incomplete_srs_origin' }
  const [easting, northing, height = 0] = origin.map(Number)
  if (![easting, northing, height].every((value) => Number.isFinite(value))) return { ok: false, reason: 'incomplete_srs_origin' }
  const frame = gaussKrugerFrame(info.srs)
  if (frame === null) return { ok: false, reason: 'unsupported_srs', srs: info.srs ?? null }
  const { lon, lat } = gaussKrugerToGeodetic(easting, northing, frame)
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 89) return { ok: false, reason: 'projection_failed' }
  return { ok: true, lon, lat, height, transform: eastNorthUpTransform(lon, lat, height), frame }
}

function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]
}

/** The transformed root box centre must sit on the globe, not inside it. */
export function validateTransform(doc, transform) {
  const box = doc?.root?.boundingVolume?.box
  if (!Array.isArray(box) || box.length < 3) return { ok: false, reason: 'missing_root_box' }
  const [x, y, z] = transformPoint(transform, [Number(box[0]), Number(box[1]), Number(box[2])])
  const radius = Math.hypot(x, y, z)
  if (!Number.isFinite(radius) || radius < EARTH_MIN_RADIUS || radius > EARTH_MAX_RADIUS) {
    return { ok: false, reason: 'transform_off_globe', radius_m: Math.round(radius) }
  }
  return { ok: true, radius_m: Math.round(radius) }
}

/** Add the missing root transform to one parsed tileset document (in memory). */
export function applyGeoreference(doc, info) {
  if (doc === null || typeof doc !== 'object' || doc.root === null || typeof doc.root !== 'object') {
    return { changed: false, reason: 'invalid_tileset' }
  }
  if (Array.isArray(doc.root.transform) || doc.root.boundingVolume?.region) {
    return { changed: false, reason: 'already_georeferenced' }
  }
  const derived = deriveRootTransform(info)
  if (!derived.ok) return { changed: false, ...derived }
  const validation = validateTransform(doc, derived.transform)
  if (!validation.ok) return { changed: false, ...validation }
  doc.root.transform = derived.transform
  return { changed: true, lon: derived.lon, lat: derived.lat, height: derived.height, radius_m: validation.radius_m }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function collectDirs(target, recursive, found) {
  const dir = resolve(target)
  if (!existsSync(dir)) return { ok: false, reason: 'path_not_found' }
  if (existsSync(join(dir, TILESET_NAME))) found.push(dir)
  if (!recursive) return { ok: true }
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return { ok: true }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    collectDirs(join(dir, entry.name), true, found)
  }
  return { ok: true }
}

function patchOne(dir, apply) {
  const tilesetPath = join(dir, TILESET_NAME)
  const doc = readJson(tilesetPath)
  if (doc === null) return { dir, status: 'error', reason: 'invalid_tileset_json' }
  const infoPath = join(dir, INFO_NAME)
  const info = existsSync(infoPath) ? readJson(infoPath) : null
  const result = applyGeoreference(doc, info)
  if (!result.changed) return { dir, status: 'unchanged', reason: result.reason }
  if (apply) {
    const backupPath = join(dir, BACKUP_NAME)
    if (!existsSync(backupPath)) copyFileSync(tilesetPath, backupPath)
    writeFileSync(tilesetPath, `${JSON.stringify(doc, null, 1)}\n`, 'utf8')
  }
  return { dir, status: apply ? 'patched' : 'planned', lon: result.lon, lat: result.lat, height: result.height }
}

function formatResult(result) {
  switch (result.status) {
    case 'planned':
    case 'patched':
      return `[${result.status.padEnd(6)}] ${result.dir}  ->  ${result.lon.toFixed(6)}E, ${result.lat.toFixed(6)}N`
    case 'unchanged':
      return `[skip   ] ${result.dir}  (${result.reason})`
    default:
      return `[error  ] ${result.dir}  (${result.reason})`
  }
}

/** CLI entry; exported so the test suite can drive it without spawning node. */
export function run(argv, { log = console.log } = {}) {
  const paths = []
  let apply = false
  let recursive = false
  let json = false
  for (const arg of argv) {
    if (arg === '--apply') apply = true
    else if (arg === '--recursive') recursive = true
    else if (arg === '--json') json = true
    else if (arg === '--help' || arg === '-h') {
      log('usage: node scripts/georef-osgb.mjs <dir|tileset.json> [...] [--apply] [--recursive] [--json]')
      return 0
    } else if (arg.startsWith('-')) {
      log(`unknown option: ${arg}`)
      return 2
    } else {
      paths.push(arg)
    }
  }
  if (paths.length === 0) {
    log('usage: node scripts/georef-osgb.mjs <dir|tileset.json> [...] [--apply] [--recursive] [--json]')
    return 2
  }
  const dirs = []
  for (const target of paths) {
    const targetDir = /\.json$/i.test(target) ? dirname(resolve(target)) : target
    const collected = collectDirs(targetDir, recursive, dirs)
    if (!collected.ok) log(`[error  ] ${target}  (${collected.reason})`)
  }
  const unique = [...new Set(dirs)]
  const results = unique.map((dir) => patchOne(dir, apply))
  if (json) {
    log(JSON.stringify(results, null, 2))
  } else {
    for (const result of results) log(formatResult(result))
    const patched = results.filter((r) => r.status === 'patched').length
    const planned = results.filter((r) => r.status === 'planned').length
    const skipped = results.filter((r) => r.status === 'unchanged').length
    const errors = results.filter((r) => r.status === 'error').length
    log(`\n${apply ? 'patched' : 'planned'}: ${apply ? patched : planned}, skipped: ${skipped}, errors: ${errors}`)
    if (!apply && planned > 0) log('dry run only; re-run with --apply to write tileset.json (a .bak backup is kept)')
  }
  return results.some((result) => result.status === 'error') ? 1 : 0
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
if (isMain) process.exitCode = run(process.argv.slice(2))
