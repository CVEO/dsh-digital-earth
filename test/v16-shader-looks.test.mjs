/**
 * v1.6 shader look pass — elevation range must follow the actual tileset extent
 * (the flat-yellow bug came from a bounding-sphere range that collapsed every
 * surface into one ramp stop), and every preset keeps a modern, legible palette.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { SHADER_FRAGMENT_SOURCES, shaderHeightRange, shaderTilesetExtent } from '../src/client/shader/presets.js'
import { readRepoFile } from './helpers/source.mjs'

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z })
// Minimal Cartesian3 stand-in: the plugin calls `new Cesium.Cartesian3()`.
function Cartesian3(x = 0, y = 0, z = 0) {
  this.x = x
  this.y = y
  this.z = z
}
Cartesian3.fromDegrees = () => vec(6378137, 0, 0)
Cartesian3.clone = (input) => vec(input.x, input.y, input.z)
Cartesian3.normalize = (input, out) => {
  const length = Math.hypot(input.x, input.y, input.z) || 1
  out.x = input.x / length
  out.y = input.y / length
  out.z = input.z / length
  return out
}
Cartesian3.dot = (left, right) => left.x * right.x + left.y * right.y + left.z * right.z
const fakeCesium = {
  Cartesian3,
  Matrix3: {
    getColumn: (matrix, index, out) => {
      out.x = matrix[index * 3]
      out.y = matrix[index * 3 + 1]
      out.z = matrix[index * 3 + 2]
      return out
    },
  },
  Cartographic: { fromCartesian: () => ({ height: 30 }) },
}

test('高程范围优先取 root 包围体的真实垂直范围（修复“整片平黄”）', () => {
  const regionTileset = { root: { boundingVolume: { minimumHeight: 12, maximumHeight: 96 } } }
  const extent = shaderTilesetExtent(fakeCesium, regionTileset)
  assert.deepEqual(extent, { minimum: 12, maximum: 96 })
  const range = shaderHeightRange(fakeCesium, regionTileset, null)
  assert.equal(range.minimum, 12)
  assert.equal(range.maximum, 96)
  assert.equal(range.bounds, true)
})

test('包围体缺失时保留 boundingSphere 与 0..200 契约回退', () => {
  const noVolume = { boundingSphere: undefined, root: {} }
  assert.equal(shaderTilesetExtent(fakeCesium, noVolume), null)
  const fallback = shaderHeightRange(fakeCesium, noVolume, null)
  assert.equal(fallback.minimum, 0)
  assert.equal(fallback.maximum, 200)

  const sphere = { boundingSphere: { center: vec(6378137, 0, 0), radius: 500 } }
  const range = shaderHeightRange(fakeCesium, sphere, null)
  assert.equal(range.estimated, true)
  assert.equal(range.maximum - range.minimum, 1000)
})

test('OBB 包围体用 up 轴支撑近似垂直范围', () => {
  const obbTileset = {
    root: {
      boundingVolume: {
        obb: {
          center: vec(6378137, 0, 0),
          // third column is the local up axis: ±25 m along the ECEF up used by the
          // fake centre x-axis; horizontal axes contribute 0.
          halfAxes: [0, 100, 0, 0, 0, 100, 25, 0, 0],
        },
      },
    },
  }
  const extent = shaderTilesetExtent(fakeCesium, obbTileset)
  assert.ok(extent !== null, 'OBB 应可推导出垂直范围')
  assert.equal(Math.round(extent.minimum), 5)
  assert.equal(Math.round(extent.maximum), 55)
})

test('五个预设保持现代配色与可读性线索，且仍只改 diffuse/alpha', () => {
  const cues = {
    'height-false-color': [/dot\(material\.diffuse, vec3\(0\.2126, 0\.7152, 0\.0722\)\)/, /mix\(material\.diffuse, ramp, 0\.72\)/],
    contour: [/spacing \* 5\.0/, /lineColor = mix\(vec3\(0\.62, 0\.86, 1\.0\)/],
    scan: [/exp\(-distanceToBand \* 22\.0\)/, /material\.diffuse \*= 0\.88/],
    water: [/vec3 local = fsInput\.attributes\.positionWC - u_center/, /fwidth\(position\)/, /u_waterMask/],
    'water-depth': [/shore = 1\.0 - smoothstep/, /submerged/],
  }
  for (const [preset, patterns] of Object.entries(cues)) {
    const source = SHADER_FRAGMENT_SOURCES[preset]
    assert.ok(source.length <= 8 * 1024, `${preset} 超 8 KB`)
    for (const pattern of patterns) assert.match(source, pattern, `${preset} 缺少视觉线索 ${pattern}`)
    assert.match(source, /void fragmentMain\(FragmentInput fsInput, inout czm_modelMaterial material\)/)
    assert.doesNotMatch(source, /void main\s*\(|gl_Position|attribute |varying /)
  }
  // 等高线单用时不能引用只在高程/扫描预设存在的 uniform。
  assert.doesNotMatch(SHADER_FRAGMENT_SOURCES.contour, /u_minHeight|u_maxHeight/)
})

test('源码注释与卡片缩略图同步保留（可读的调色说明）', () => {
  const presets = readRepoFile('src/client/shader/presets.js')
  assert.match(presets, /photogrammetry textures already bake in roof\/wall shading/i)
  const cards = readRepoFile('src/client/ui/cards.js')
  assert.match(cards, /mv-thumb-ramp/)
})
