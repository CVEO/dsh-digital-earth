/**
 * 本地 3D Tiles 地理配准回归（v1.4.0 bug 修复）。
 *
 * OSGB 转换产物常常只带局部坐标：根节点没有 `transform`/`region`，原点写在
 * 同级 `tileset_info.json` 的 `srs` + `srs_origin` 里。Cesium 会把局部米直接
 * 当成 ECEF，整块数据坍缩到地心附近，`flyTo` 于是钻进地核（表现为「球不居中」），
 * 瓦片也会在视锥里反复闪现。
 *
 * 本文件只测纯函数与 `/tiles` 上的补丁服务，不做浏览器渲染测试：
 *   - `gaussKrugerFrame` 对四族 CGCS2000 高斯-克吕格 EPSG 码给出中央经线/假东；
 *   - `deriveLocalGeoreference` 用 EPSG:4547（114E）把东坐标/北坐标反算成经纬度；
 *   - 派生矩阵必须满足 ENU 语义：+X 向东、+Y 向北、+Z 抬高；
 *   - `serveGeoreferencedTileset` 只在「根无变换 + 有元数据」时补根变换，
 *     其余情况一律返回 false 让普通文件服务接手（不改变旧行为）。
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  deriveLocalGeoreference,
  gaussKrugerFrame,
  georeferenceTilesetDocument,
  inspectRootGeoreference,
  serveGeoreferencedTileset,
  tilesetRootIsGeoreferenced,
} from '../index.js'

// The real 景山 (Jingshan, Hubei) OSGB header this fix was written against:
// EPSG:4547 with the projected origin [417751, 3433599, 0].
const JINGSHAN_INFO = { srs: 'EPSG:4547', srs_origin: [417751, 3433599, 0] }
const JINGSHAN_LON = 113.1386207
const JINGSHAN_LAT = 31.0207996

const tempDirs = []
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-georef-'))
  tempDirs.push(dir)
  return dir
}
after(async () => {
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true })
})

/** Minimal Node `ServerResponse` stand-in: records the status, headers and body. */
function fakeResponse() {
  return {
    status: 0,
    headers: {},
    body: Buffer.alloc(0),
    ended: false,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(chunk) {
      if (chunk !== undefined) this.body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      this.ended = true
    },
  }
}

/** ECEF -> geodetic (WGS84), so the tests can assert real-world placement. */
function ecefToGeodetic([x, y, z]) {
  const a = 6378137
  const f = 1 / 298.257222101
  const e2 = f * (2 - f)
  const lon = Math.atan2(y, x)
  const p = Math.hypot(x, y)
  let lat = Math.atan2(z, p * (1 - e2))
  for (let i = 0; i < 8; i += 1) {
    const sin = Math.sin(lat)
    const n = a / Math.sqrt(1 - e2 * sin * sin)
    const h = p / Math.cos(lat) - n
    lat = Math.atan2(z, p * (1 - (e2 * n) / (n + h)))
  }
  const sin = Math.sin(lat)
  const n = a / Math.sqrt(1 - e2 * sin * sin)
  return {
    lon: (lon * 180) / Math.PI,
    lat: (lat * 180) / Math.PI,
    height: p / Math.cos(lat) - n,
  }
}

/** Apply a column-major 4x4 tileset transform to one local point. */
function applyTransform(transform, [x, y, z]) {
  return [0, 1, 2].map((row) => transform[row] * x + transform[4 + row] * y + transform[8 + row] * z + transform[12 + row])
}

function baseTileset() {
  return {
    asset: { version: '1.1', tilesetVersion: '1.0.0-osgb-local', gltfUpAxis: 'Z' },
    geometricError: 10185.724609375,
    root: {
      boundingVolume: { box: [69.17236328125, 15.4783935546875, 98.02559813857079, 1273.21, 0, 0, 0, 1047.73, 0, 0, 0, 98.32] },
      geometricError: 2546.43115234375,
      refine: 'REPLACE',
      children: [
        {
          boundingVolume: { box: [-1129.85, -359.99, 72.15, 74.15, 0, 0, 0, 75.3, 0, 0, 0, 12.57] },
          geometricError: 0,
          content: { uri: 'tiles/Tile_+000_+004.glb' },
        },
      ],
    },
  }
}

test('EPSG:4547 是 CGCS2000 三度带 114E 中央经线', () => {
  // 4547 = 4534 + 13 -> 75 + 13 * 3 = 114E (the 117E answer would be 4548).
  assert.deepEqual(gaussKrugerFrame('EPSG:4547'), { centralMeridian: 114, falseEasting: 500000 })
})

test('四族 CGCS2000 高斯-克吕格带号与中央经线映射', () => {
  // 3-degree zone variant: zone 25 -> CM 75E, easting prefixed with 25.
  assert.deepEqual(gaussKrugerFrame('epsg:4513'), { centralMeridian: 75, falseEasting: 25500000 })
  assert.deepEqual(gaussKrugerFrame('EPSG:4533'), { centralMeridian: 135, falseEasting: 45500000 })
  // 3-degree central-meridian variant (no zone prefix).
  assert.deepEqual(gaussKrugerFrame('EPSG:4534'), { centralMeridian: 75, falseEasting: 500000 })
  assert.deepEqual(gaussKrugerFrame('EPSG:4554'), { centralMeridian: 135, falseEasting: 500000 })
  // 6-degree zone variant: zone 13 -> CM 78E, easting prefixed with 13.
  assert.deepEqual(gaussKrugerFrame('EPSG:4491'), { centralMeridian: 78, falseEasting: 13500000 })
  // 6-degree central-meridian variant.
  assert.deepEqual(gaussKrugerFrame('EPSG:4502'), { centralMeridian: 75, falseEasting: 500000 })
  // Anything outside those families is refused instead of guessed.
  for (const srs of ['EPSG:3857', 'EPSG:4326', 'WGS84', '', null, undefined, 'EPSG:4535x']) {
    assert.equal(gaussKrugerFrame(srs), null)
  }
})

test('景山 OSGB 原点反算回湖北京山', () => {
  const georeference = deriveLocalGeoreference(JINGSHAN_INFO)
  assert.ok(georeference)
  assert.equal(georeference.crs, 'EPSG:4547')
  assert.ok(Math.abs(georeference.lon - JINGSHAN_LON) < 5e-5, `lon ${georeference.lon}`)
  assert.ok(Math.abs(georeference.lat - JINGSHAN_LAT) < 5e-5, `lat ${georeference.lat}`)
  assert.equal(georeference.transform.length, 16)
  for (const value of georeference.transform) assert.ok(Number.isFinite(value))
  // Origin of the local frame lands on the ellipsoid surface.
  assert.ok(Math.abs(georeference.height) < 1e-9)
})

test('派生矩阵是 ENU：+X 向东、+Y 向北、+Z 抬高', () => {
  const { transform } = deriveLocalGeoreference(JINGSHAN_INFO)
  const origin = ecefToGeodetic(applyTransform(transform, [0, 0, 0]))
  assert.ok(Math.abs(origin.lon - JINGSHAN_LON) < 5e-5)
  assert.ok(Math.abs(origin.lat - JINGSHAN_LAT) < 5e-5)

  const up = ecefToGeodetic(applyTransform(transform, [0, 0, 100]))
  assert.ok(Math.abs(up.height - 100) < 1e-3, `height ${up.height}`)

  // 1000 m east is ~0.0104 deg of longitude at 31N; 1000 m north ~0.0090 deg.
  const east = ecefToGeodetic(applyTransform(transform, [1000, 0, 0]))
  assert.ok(Math.abs(east.lon - origin.lon - 0.01047) < 1e-4, `dlon ${east.lon - origin.lon}`)
  assert.ok(Math.abs(east.lat - origin.lat) < 1e-6)
  const north = ecefToGeodetic(applyTransform(transform, [0, 1000, 0]))
  assert.ok(Math.abs(north.lat - origin.lat - 0.00902) < 1e-4, `dlat ${north.lat - origin.lat}`)
  assert.ok(Math.abs(north.lon - origin.lon) < 1e-6)
})

test('残缺或无法识别的元数据不会派生出变换', () => {
  assert.equal(deriveLocalGeoreference(null), null)
  assert.equal(deriveLocalGeoreference({}), null)
  assert.equal(deriveLocalGeoreference({ srs: 'EPSG:4547' }), null)
  assert.equal(deriveLocalGeoreference({ srs: 'EPSG:4547', srs_origin: [417751] }), null)
  assert.equal(deriveLocalGeoreference({ srs: 'EPSG:4547', srs_origin: ['a', 'b', 'c'] }), null)
  assert.equal(deriveLocalGeoreference({ srs: 'EPSG:3857', srs_origin: [417751, 3433599, 0] }), null)
})

test('只在根节点缺少世界变换时补 transform，且不改动其他字段', () => {
  const document = baseTileset()
  const patched = georeferenceTilesetDocument(document, JINGSHAN_INFO)
  assert.ok(patched)
  assert.equal(patched.document.root.transform.length, 16)
  // Child content URIs and the asset block must survive untouched.
  assert.deepEqual(patched.document.root.children, document.root.children)
  assert.deepEqual(patched.document.asset, document.asset)
  assert.equal(patched.document.geometricError, document.geometricError)
  // The input document is not mutated in place.
  assert.equal(document.root.transform, undefined)

  // Already georeferenced roots pass through and are reported as such.
  assert.equal(georeferenceTilesetDocument(patched.document, JINGSHAN_INFO), null)
  assert.equal(tilesetRootIsGeoreferenced({ transform: new Array(16).fill(0) }), true)
  assert.equal(tilesetRootIsGeoreferenced({ boundingVolume: { region: [0, 0, 1, 1, 0, 1] } }), true)
  assert.equal(tilesetRootIsGeoreferenced({ boundingVolume: { box: new Array(12).fill(0) } }), false)
  assert.equal(tilesetRootIsGeoreferenced(null), false)
})

test('/tiles 为缺少根变换的本地 tileset 补根变换', async () => {
  const dir = await tempDir()
  await mkdir(join(dir, 'tiles'), { recursive: true })
  await writeFile(join(dir, 'tileset.json'), JSON.stringify(baseTileset()))
  await writeFile(join(dir, 'tileset_info.json'), JSON.stringify(JINGSHAN_INFO))
  await writeFile(join(dir, 'tiles', 'Tile_+000_+004.glb'), 'glTF')

  const res = fakeResponse()
  const served = await serveGeoreferencedTileset({ method: 'GET' }, res, dir, 'tileset.json', 'public, max-age=60')
  assert.equal(served, true)
  assert.equal(res.status, 200)
  assert.match(res.headers['content-type'], /application\/json/)
  assert.equal(Number(res.headers['content-length']), res.body.length)
  const body = JSON.parse(res.body.toString('utf8'))
  assert.equal(body.root.transform.length, 16)
  assert.deepEqual(body.root.transform, deriveLocalGeoreference(JINGSHAN_INFO).transform)
  assert.equal(body.root.children[0].content.uri, 'tiles/Tile_+000_+004.glb')
})

test('/tiles 对已有配准或缺少元数据的 tileset 回退到普通文件服务', async () => {
  const plain = await tempDir()
  await writeFile(join(plain, 'tileset.json'), JSON.stringify(baseTileset()))
  assert.equal(await serveGeoreferencedTileset({ method: 'GET' }, fakeResponse(), plain, 'tileset.json', 'x'), false)

  const done = await tempDir()
  const georeferenced = baseTileset()
  georeferenced.root.transform = new Array(16).fill(0).map((_, index) => (index % 5 === 0 ? 1 : 0))
  await writeFile(join(done, 'tileset.json'), JSON.stringify(georeferenced))
  await writeFile(join(done, 'tileset_info.json'), JSON.stringify(JINGSHAN_INFO))
  assert.equal(await serveGeoreferencedTileset({ method: 'GET' }, fakeResponse(), done, 'tileset.json', 'x'), false)

  // Non-tileset files never go through the patch path.
  assert.equal(await serveGeoreferencedTileset({ method: 'GET' }, fakeResponse(), plain, 'tileset_info.json', 'x'), false)
})

test('/tiles 补丁服务不服务目录外的文件', async () => {
  const dir = await tempDir()
  const outside = await tempDir()
  await writeFile(join(outside, 'tileset.json'), JSON.stringify(baseTileset()))
  await writeFile(join(outside, 'tileset_info.json'), JSON.stringify(JINGSHAN_INFO))
  const served = await serveGeoreferencedTileset(
    { method: 'GET' },
    fakeResponse(),
    dir,
    join('..', outside.split(/[\\/]/).pop(), 'tileset.json'),
    'x',
  )
  assert.equal(served, false)
})

test('嵌套的外部 tileset 不会被重复配准', async () => {
  const root = await tempDir()
  // A dataset document at the top of the opened folder ...
  await writeFile(join(root, 'tileset.json'), JSON.stringify(baseTileset()))
  await writeFile(join(root, 'tileset_info.json'), JSON.stringify(JINGSHAN_INFO))
  // ... and an external tileset two levels down that also ships the metadata.
  const nested = join(root, 'Data', 'sub')
  await mkdir(nested, { recursive: true })
  await writeFile(join(nested, 'tileset.json'), JSON.stringify(baseTileset()))
  await writeFile(join(nested, 'tileset_info.json'), JSON.stringify(JINGSHAN_INFO))

  // The top-level document is patched once ...
  assert.equal(await serveGeoreferencedTileset({ method: 'GET' }, fakeResponse(), root, 'tileset.json', 'x'), true)
  // ... while the nested document is left to its ancestor's transform.
  const relPath = join('Data', 'sub', 'tileset.json')
  assert.equal(await serveGeoreferencedTileset({ method: 'GET' }, fakeResponse(), root, relPath, 'x'), false)

  // A nested folder with no ancestor document is still a top-level dataset.
  const alone = await tempDir()
  const lone = join(alone, 'JingShan')
  await mkdir(lone, { recursive: true })
  await writeFile(join(lone, 'tileset.json'), JSON.stringify(baseTileset()))
  await writeFile(join(lone, 'tileset_info.json'), JSON.stringify(JINGSHAN_INFO))
  assert.equal(
    await serveGeoreferencedTileset({ method: 'GET' }, fakeResponse(), alone, join('JingShan', 'tileset.json'), 'x'),
    true,
  )
})

test('补丁后的根包围盒中心落到地表附近而不是地心', async () => {
  const document = baseTileset()
  const box = document.root.boundingVolume.box
  const before = Math.hypot(box[0], box[1], box[2])
  assert.ok(before < 200, `precondition: un-georeferenced centre is ${before} m from the earth centre`)

  const patched = georeferenceTilesetDocument(document, JINGSHAN_INFO)
  const centre = applyTransform(patched.document.root.transform, [box[0], box[1], box[2]])
  const radius = Math.hypot(...centre)
  // The centre must now sit on the ellipsoid (~6370 km from the earth centre).
  assert.ok(Math.abs(radius - 6372590) < 5000, `patched radius ${radius}`)
  const geodetic = ecefToGeodetic(centre)
  assert.ok(Math.abs(geodetic.lon - JINGSHAN_LON) < 1e-3)
  assert.ok(Math.abs(geodetic.lat - JINGSHAN_LAT) < 1e-3)
  assert.ok(Math.abs(geodetic.height - 98.0256) < 0.01, `height ${geodetic.height}`)
})

test('数据体检说明根文档会被如何配准，且不静默失败', async () => {
  const supported = await tempDir()
  await writeFile(join(supported, 'tileset_info.json'), JSON.stringify(JINGSHAN_INFO))
  // A repairable document is reported at info level, so the panel explains why
  // the dataset still shows up in the right place despite having no transform.
  const derived = { issues: [] }
  await inspectRootGeoreference(baseTileset(), supported, derived, 'x')
  assert.deepEqual(derived.issues.map((item) => item.code), ['georeference_derived'])
  assert.equal(derived.issues[0].level, 'info')

  // The metadata exists but names a datum this plugin cannot project without a
  // datum shift; refusing silently used to look exactly like the original bug.
  const unsupported = await tempDir()
  await writeFile(
    join(unsupported, 'tileset_info.json'),
    JSON.stringify({ srs: 'EPSG:2327', srs_origin: [417751, 3433599, 0] }),
  )
  const refused = { issues: [] }
  await inspectRootGeoreference(baseTileset(), unsupported, refused, 'x')
  assert.deepEqual(refused.issues.map((item) => item.code), ['georeference_unsupported'])
  assert.equal(refused.issues[0].level, 'warn')

  // No metadata at all, and remote documents whose siblings cannot be read.
  for (const directory of [await tempDir(), null]) {
    const bare = { issues: [] }
    await inspectRootGeoreference(baseTileset(), directory, bare, 'x')
    assert.deepEqual(bare.issues.map((item) => item.code), ['no_georeference'])
  }

  // An already georeferenced document stays silent.
  const done = { issues: [] }
  const georeferenced = baseTileset()
  georeferenced.root.transform = new Array(16).fill(0)
  await inspectRootGeoreference(georeferenced, supported, done, 'x')
  assert.equal(done.issues.length, 0)
})
