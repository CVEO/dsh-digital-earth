/**
 * v1.5.2 height-source contract for earth_analyze.
 *
 * v1.5.1 mixed 3D Tiles surface heights and terrain heights inside one profile
 * (live QA: relief 73.3 m over a 435 m flat river valley). The v1.5.2 contract is
 * one explicit source per run, and 3DGS is never silently sampled:
 *   - profile/skyline: "tiles" | "terrain" (default tiles);
 *   - flood: "terrain" (default, strict ground) | "surface" (explicit approx);
 *   - clip: mesh only, 3DGS rejected;
 *   - the Host validates the source before the panel runs anything.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readRepoFile } from './helpers/source.mjs'
import { normalizeAnalyzeRequest } from '../src/host/tools/analyze.js'

const engineSource = readRepoFile('src/client/analysis/engine.js')
const sourcePolicy = readRepoFile('src/client/analysis/source-policy.js')
const analyzeSource = readRepoFile('src/host/tools/analyze.js')
const analyzeRenderSource = readRepoFile('src/host/tools/analyze-render.js')

test('tool schema accepts a single source and normalizes it per action', () => {
  const profile = normalizeAnalyzeRequest({ action: 'profile', from: [1, 2], to: [3, 4], source: 'terrain' })
  assert.equal(profile.args.source, 'terrain')
  const skyline = normalizeAnalyzeRequest({ action: 'skyline', from: [1, 2], to: [3, 4], source: 'tiles' })
  assert.equal(skyline.args.source, 'tiles')
  const flood = normalizeAnalyzeRequest({
    action: 'flood',
    region: { west: 0, south: 0, east: 1, north: 1 },
    water_height: 10,
    source: 'surface',
  })
  assert.equal(flood.args.source, 'surface')
  // Defaults: profile/skyline tiles, flood terrain.
  assert.equal(normalizeAnalyzeRequest({ action: 'profile', from: [1, 2], to: [3, 4] }).args.source, undefined)
  assert.equal(analyzeSource.includes("source: {"), true)
})

test('tool schema rejects a source that would mix or mislead', () => {
  assert.throws(
    () => normalizeAnalyzeRequest({ action: 'profile', from: [1, 2], to: [3, 4], source: 'surface' }),
    /\[source\]|source.*must be "tiles" or "terrain"/,
  )
  assert.throws(
    () => normalizeAnalyzeRequest({ action: 'flood', region: { west: 0, south: 0, east: 1, north: 1 }, water_height: 1, source: 'tiles' }),
    /source.*"terrain" or "surface"/,
  )
  assert.throws(
    () => normalizeAnalyzeRequest({ action: 'sunlight', source: 'tiles' }),
    /does not accept "source"/,
  )
})

test('engine never auto-switches source and refuses 3DGS surface sampling', () => {
  // No automatic ground/surface choice based on whether terrain exists.
  assert.doesNotMatch(engineSource, /hasRealTerrain\(\) \? 'ground' : 'surface'/)
  assert.match(engineSource, /const heightMode = args\.source === 'terrain' \? 'terrain' : 'tiles'/)
  assert.match(engineSource, /const floodSource = args\.source === 'surface' \? 'surface' : 'terrain'/)
  assert.match(engineSource, /const heightMode = floodSource === 'surface' \? 'tiles' : 'terrain'/)
  // 3DGS has no sampleable surface height and must be told so.
  assert.match(engineSource, /layer\.kind === '3dgs'/)
  assert.match(engineSource, /3DGS 图层不支持剖切/)
  assert.match(engineSource, /\[no_height_data\]/)
  // Terrain-only runs drop the layer so a loaded mesh cannot leak into them.
  assert.match(sourcePolicy, /if \(heightOperation && source === 'terrain'\) \{/)
  assert.match(sourcePolicy, /const heightOperation = operation === 'profile'/)
  assert.match(sourcePolicy, /layer\.kind === '3dgs'/)
})

test('flood summary separates area ratio from sampled-cell ratio', () => {
  assert.match(analyzeRenderSource, /% of area/)
  assert.match(analyzeRenderSource, /% of sampled cells/)
  assert.match(analyzeRenderSource, /Surface approximation: heights come from the 3D Tiles surface/)
})

test('3DGS clip is rejected with an actionable next step', () => {
  assert.match(engineSource, /\[unsupported_layer\] 3DGS 图层不支持剖切/)
})
