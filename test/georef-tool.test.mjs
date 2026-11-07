/**
 * georef-osgb.mjs — the general data repair for OSGB-converted 3D Tiles.
 *
 * These tests pin the maths (CGCS2000 Gauss-Krueger -> WGS84 -> ENU->ECEF) and
 * the safety rules (idempotent, backup, unsupported CRS reported, transform must
 * put the data on the globe).
 */
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  applyGeoreference,
  deriveRootTransform,
  eastNorthUpTransform,
  gaussKrugerFrame,
  gaussKrugerToGeodetic,
  run,
  validateTransform,
} from '../scripts/georef-osgb.mjs'

const EPSG_4547 = { srs: 'EPSG:4547', srs_origin: [417751, 3433599, 0] }
// pyproj reference: EPSG:4547 (417751, 3433599) -> WGS84.
const LON = 113.1386206718246
const LAT = 31.020799569713233

const fixtureDocument = () => ({
  asset: { version: '1.1' },
  geometricError: 469.18,
  root: {
    boundingVolume: { box: [69.17, 15.47, 98.02, 1273.21, 0, 0, 0, 1047.73, 0, 0, 0, 98.32] },
    geometricError: 2546.43,
    refine: 'REPLACE',
    children: [],
  },
})

test('gaussKrugerFrame：四个 CGCS2000 家族，非法 EPSG 返回 null', () => {
  assert.deepEqual(gaussKrugerFrame('EPSG:4547'), { centralMeridian: 114, falseEasting: 500000 })
  assert.deepEqual(gaussKrugerFrame('epsg:4491'), { centralMeridian: 78, falseEasting: 13500000 })
  assert.deepEqual(gaussKrugerFrame('EPSG:4502'), { centralMeridian: 75, falseEasting: 500000 })
  assert.deepEqual(gaussKrugerFrame('EPSG:4513'), { centralMeridian: 75, falseEasting: 25500000 })
  assert.deepEqual(gaussKrugerFrame('EPSG:4534'), { centralMeridian: 75, falseEasting: 500000 })
  assert.equal(gaussKrugerFrame('EPSG:4326'), null)
  assert.equal(gaussKrugerFrame(''), null)
})

test('deriveRootTransform：EPSG:4547 原点换算到 WGS84 并生成 ENU→ECEF', () => {
  const derived = deriveRootTransform(EPSG_4547)
  assert.equal(derived.ok, true)
  assert.ok(Math.abs(derived.lon - LON) < 1e-6, `lon=${derived.lon}`)
  assert.ok(Math.abs(derived.lat - LAT) < 1e-6, `lat=${derived.lat}`)
  assert.equal(derived.transform.length, 16)
  // pyproj reference matrix; the Snyder series differs by well under a millimetre.
  const expected = [
    -0.919556830453, -0.392957040358, 0, 0,
    0.202510100577, -0.473892886745, 0.856980274602, 0,
    -0.336756432352, 0.788042065074, 0.515349210675, 0,
    -2149790.5952715855, 5030714.36034738, 3267869.9638576633, 1,
  ]
  for (let index = 0; index < 16; index += 1) {
    assert.ok(Math.abs(derived.transform[index] - expected[index]) < 1e-3, `transform[${index}]`)
  }
})

test('deriveRootTransform：缺 sidecar / 缺原点 / 不支持的坐标系都明确报错', () => {
  assert.equal(deriveRootTransform(null).reason, 'missing_info')
  assert.equal(deriveRootTransform({ srs: 'EPSG:4547' }).reason, 'incomplete_srs_origin')
  const unsupported = deriveRootTransform({ srs: 'EPSG:4326', srs_origin: [0, 0, 0] })
  assert.equal(unsupported.ok, false)
  assert.equal(unsupported.reason, 'unsupported_srs')
})

test('applyGeoreference：补 root.transform、幂等，region 数据不重复处理', () => {
  const doc = fixtureDocument()
  const first = applyGeoreference(doc, EPSG_4547)
  assert.equal(first.changed, true)
  assert.equal(Array.isArray(doc.root.transform), true)
  assert.equal(doc.root.transform.length, 16)
  const second = applyGeoreference(doc, EPSG_4547)
  assert.equal(second.changed, false)
  assert.equal(second.reason, 'already_georeferenced')

  const regionDoc = fixtureDocument()
  regionDoc.root.boundingVolume = { region: [-1, -1, -1, 1, 1, 1] }
  assert.equal(applyGeoreference(regionDoc, EPSG_4547).reason, 'already_georeferenced')
  assert.equal(applyGeoreference(null, EPSG_4547).reason, 'invalid_tileset')
})

test('validateTransform：变换后数据必须落在地球表面附近', () => {
  const doc = fixtureDocument()
  const derived = deriveRootTransform(EPSG_4547)
  assert.equal(validateTransform(doc, derived.transform).ok, true)
  const broken = [...derived.transform]
  broken[12] = 0
  broken[13] = 0
  broken[14] = 0
  const check = validateTransform(doc, broken)
  assert.equal(check.ok, false)
  assert.equal(check.reason, 'transform_off_globe')
})

test('CLI：默认 dry-run 不改文件，--apply 写入并保留 .bak 备份', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-de-georef-'))
  try {
    const original = `${JSON.stringify(fixtureDocument(), null, 1)}\n`
    await writeFile(join(dir, 'tileset.json'), original, 'utf8')
    await writeFile(join(dir, 'tileset_info.json'), JSON.stringify(EPSG_4547), 'utf8')
    const logs = []
    const dry = run([dir], { log: (line) => logs.push(line) })
    assert.equal(dry, 0)
    assert.ok(logs.some((line) => line.includes('[planned')))
    assert.equal(await readFile(join(dir, 'tileset.json'), 'utf8'), original)

    const applied = run([dir, '--apply'], { log: () => {} })
    assert.equal(applied, 0)
    await stat(join(dir, 'tileset.json.bak'))
    const patched = JSON.parse(await readFile(join(dir, 'tileset.json'), 'utf8'))
    assert.equal(patched.root.transform.length, 16)

    const logs2 = []
    run([dir], { log: (line) => logs2.push(line) })
    assert.ok(logs2.some((line) => line.includes('already_georeferenced')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('CLI：缺 sidecar 会跳过而不是报错退出', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-de-georef-nosidecar-'))
  try {
    await writeFile(join(dir, 'tileset.json'), JSON.stringify(fixtureDocument()), 'utf8')
    const logs = []
    const code = run([dir], { log: (line) => logs.push(line) })
    assert.equal(code, 0)
    assert.ok(logs.some((line) => line.includes('missing_info')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
