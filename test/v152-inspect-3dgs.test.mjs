/**
 * v1.5.2 3DGS inspection regression.
 *
 * v1.5.1 only read `extensionsUsed` from tileset.json. Datasets from
 * `3dgs-ply-3dtiles-converter` declare KHR_gaussian_splatting in every GLB
 * instead, so those layers were reported as plain mesh (and the shader panel
 * then applied presets that could never take effect). The inspector now reads a
 * bounded number of GLB JSON chunks; this fixture pins the classification.
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readRepoFile } from './helpers/source.mjs'
import { createLayerKindProbe } from '../src/client/scene/layer-kind.js'

const { analyzeTileset } = await import(new URL('../src/host/inspect/analyze.js', import.meta.url).href)
const workspaces = []
after(async () => {
  for (const dir of workspaces) await rm(dir, { recursive: true, force: true })
})

/** Minimal valid GLB whose JSON chunk declares the given glTF extensions. */
function makeGlb(json) {
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
  const padding = (4 - (jsonBuffer.length % 4)) % 4
  const jsonChunk = Buffer.concat([jsonBuffer, Buffer.alloc(padding, 0x20)])
  const header = Buffer.alloc(12)
  header.write('glTF', 0, 'ascii')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length, 8)
  const chunkHeader = Buffer.alloc(8)
  chunkHeader.writeUInt32LE(jsonChunk.length, 0)
  chunkHeader.writeUInt32LE(0x4e4f534a, 4) // 'JSON'
  return Buffer.concat([header, chunkHeader, jsonChunk])
}

async function fixture({ glbJson, tilesetExtensions = [] }) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-de-3dgs-'))
  workspaces.push(root)
  const folder = join(root, 'model')
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, 'tile.glb'), makeGlb(glbJson))
  const document = {
    asset: { version: '1.1', extras: { generator: '3dgs-ply-3dtiles-converter 0.6.5' } },
    geometricError: 1,
    root: {
      boundingVolume: { region: [-0.01, -0.01, -0.01, 0.01, 0.01, 0.01] },
      geometricError: 0,
      content: { uri: 'tile.glb' },
    },
  }
  if (tilesetExtensions.length > 0) document.extensionsUsed = tilesetExtensions
  await writeFile(join(folder, 'tileset.json'), JSON.stringify(document))
  return { folder, allowedDirs: new Set([folder]) }
}

test('GLB-embedded KHR_gaussian_splatting is detected as 3DGS content', async () => {
  const { folder, allowedDirs } = await fixture({
    glbJson: {
      asset: { generator: '3dgs-ply-3dtiles-converter 0.6.5' },
      extensionsUsed: ['KHR_gaussian_splatting', 'KHR_gaussian_splatting_compression_spz_2', 'KHR_materials_unlit'],
      extensionsRequired: ['KHR_gaussian_splatting', 'KHR_gaussian_splatting_compression_spz_2'],
      meshes: [{ primitives: [] }],
    },
  })
  const report = await analyzeTileset({ kind: 'local', path: join(folder, 'tileset.json') }, { allowedDirs })
  assert.equal(report.kinds.gaussianSplatting, true)
  assert.equal(report.kinds.gaussianSplatGlb, 1)
  assert.equal(report.kinds.meshGlb, 0)
  assert.equal(report.kinds.spz, true)
  assert.equal(report.gaussianSplatSource, 'content')
  assert.match(report.asset.generator ?? '', /3dgs-ply-3dtiles-converter/)
  assert.ok(report.issues.some((issue) => issue.code === 'gaussian_splatting_extension_in_content'))
  // The world placement and kind fields feed the layer badge / shader rejection.
  assert.equal(report.root.hasWorldPlacement, true)
})

test('a plain GLB stays classified as mesh', async () => {
  const { folder, allowedDirs } = await fixture({
    glbJson: { asset: { generator: 'mesh-exporter 1.0' }, extensionsUsed: [], meshes: [{ primitives: [] }] },
  })
  const report = await analyzeTileset({ kind: 'local', path: join(folder, 'tileset.json') }, { allowedDirs })
  assert.equal(report.kinds.gaussianSplatting, false)
  assert.equal(report.kinds.gaussianSplatGlb, 0)
  assert.equal(report.kinds.meshGlb, 1)
  assert.equal(report.gaussianSplatSource, null)
})

test('tileset-level extension declaration is still detected', async () => {
  const { folder, allowedDirs } = await fixture({
    glbJson: { asset: { generator: 'x' }, meshes: [] },
    tilesetExtensions: ['KHR_gaussian_splatting'],
  })
  const report = await analyzeTileset({ kind: 'local', path: join(folder, 'tileset.json') }, { allowedDirs })
  assert.equal(report.kinds.gaussianSplatting, true)
  assert.equal(report.gaussianSplatSource, 'tileset')
})

// ---------------------------------------------------------------------------
// Client wiring: the panel caches the kind, the shader rejects 3DGS, status
// exposes the kind so an Agent can explain a zero-triangle splat layer.
// ---------------------------------------------------------------------------

test('panel caches mesh/3DGS from the Host inspector and sends it once per load', () => {
  const viewer = readRepoFile('src/client/viewer/ViewerSurface.js')
  const layerKind = readRepoFile('src/client/scene/layer-kind.js')
  const status = readRepoFile('src/client/scene/status.js')
  const presets = readRepoFile('src/client/shader/presets.js')
  const shaderEngine = readRepoFile('src/client/scene/shader-engine.js')

  assert.match(viewer, /const hydrateLayerKind = createLayerKindProbe\(/)
  assert.match(viewer, /void hydrateLayerKind\(layer\)/)
  assert.match(layerKind, /kind = kinds\.gaussianSplatting === true \? '3dgs' : 'mesh'/)
  assert.match(status, /kind: layer\.kind \?\? null/)
  assert.match(presets, /layer\.kind === '3dgs'/)
  assert.match(shaderEngine, /shaderGaussianLayer\(layer\.tileset, layer\)/)
})

test('createLayerKindProbe classifies through the inspect route', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(String(options.body)) })
    return {
      ok: true,
      async json() {
        return { report: { kinds: { gaussianSplatting: true, gaussianSplatGlb: 1 }, asset: { generator: '3dgs-ply-3dtiles-converter' } } }
      },
    }
  }
  try {
    const probe = createLayerKindProbe({
      getMeta: () => ({ token: 'tok', inspectUrl: 'https://host/inspect' }),
      sourceOfLayer: () => ({ kind: 'remote', url: 'https://example.invalid/tileset.json' }),
      layerRuntime: () => ({ tiles: 1 }),
    })
    const layer = { id: '1', name: 'splat' }
    await probe(layer)
    assert.equal(layer.kind, '3dgs')
    assert.match(layer.kindGenerator, /3dgs-ply-3dtiles-converter/)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].body.deep, false)
    assert.equal(requests[0].url, 'https://host/inspect?token=tok')
  } finally {
    globalThis.fetch = originalFetch
  }
})
