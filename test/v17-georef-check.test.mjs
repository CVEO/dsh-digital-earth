/**
 * v1.7 follow-up — generic "no world placement" detection.
 *
 * The plugin does not read sidecars or rewrite data at runtime, but it must not
 * leave the user with a silent black screen either: a bounding sphere far from
 * the Earth's surface is the generic signature of local metres read as ECEF.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { EARTH_SURFACE_MAX_RADIUS_M, EARTH_SURFACE_MIN_RADIUS_M, tilesetGeorefIssue } from '../src/client/scene/georef-check.js'
import { MESSAGES } from '../src/client/messages.js'
import { clientSource, readRepoFile } from './helpers/source.mjs'

const Cesium = {
  Cartesian3: { magnitude: (center) => Math.hypot(center.x, center.y, center.z) },
}
const tilesetAt = (x, y = 0, z = 0) => ({ boundingSphere: { center: { x, y, z } } })

test('tilesetGeorefIssue：地心附近/地球外判定为问题，桌面数据不误报', () => {
  assert.deepEqual(tilesetGeorefIssue(tilesetAt(100), Cesium), { kind: 'inside_earth', distance_m: 100 })
  assert.deepEqual(tilesetGeorefIssue(tilesetAt(6_371_000), Cesium), null)
  assert.equal(tilesetGeorefIssue(tilesetAt(EARTH_SURFACE_MIN_RADIUS_M), Cesium), null)
  assert.deepEqual(tilesetGeorefIssue(tilesetAt(7_000_000), Cesium), { kind: 'outside_earth', distance_m: 7_000_000 })
  // A whole-earth tileset centres its sphere at the origin with a planet-scale
  // radius; that is legitimate and must not be flagged.
  assert.equal(tilesetGeorefIssue({ boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 6_400_000 } }, Cesium), null)
  // A fake without a usable sphere / Cesium namespace is "unknown", never a warning.
  assert.equal(tilesetGeorefIssue(null, Cesium), null)
  assert.equal(tilesetGeorefIssue({}, Cesium), null)
  assert.equal(tilesetGeorefIssue(tilesetAt(100), {}), null)
})

test('接线：加载图层时检测并提示，图层行显示警告标记', () => {
  const client = clientSource()
  assert.match(client, /const georefIssue = tilesetGeorefIssue\(tileset, Cesium\)/)
  assert.match(client, /if \(georefIssue !== null\) \{/)
  assert.match(client, /t\('toast\.notGeoreferenced'\)/)
  // A broken layer must not trigger the auto-fly into the planet.
  assert.match(client, /if \(georefIssue !== null\) \{\s*\n\s*if \(options\.fly !== false\) showToast\(t\('toast\.notGeoreferenced'\)\)\s*\n\s*\} else if \(options\.fly !== false\) await viewer\.flyTo/)

  const panel = readRepoFile('src/client/ui/layers-panel.js')
  assert.match(panel, /layer\.georefIssue/)
  assert.match(panel, /className: 'mv-warn'/)
  assert.match(panel, /t\('layers\.georefWarning'\)/)

  const css = readRepoFile('src/client/ui/css.js')
  assert.match(css, /\.mv-layer \.mv-warn\{/)
})

test('i18n：世界定位提示中英齐全', () => {
  for (const key of ['toast.notGeoreferenced', 'layers.georefWarning']) {
    assert.equal(typeof MESSAGES.zh[key], 'string', `缺少 zh ${key}`)
    assert.equal(typeof MESSAGES.en[key], 'string', `缺少 en ${key}`)
  }
  // The message must point at the data-side fix instead of promising a rewrite.
  assert.match(MESSAGES.zh['toast.notGeoreferenced'], /georef-osgb/)
  assert.match(MESSAGES.en['toast.notGeoreferenced'], /georef-osgb/)
})

test('README/CHANGELOG 记录一次性修复工具，插件运行时不读 sidecar', () => {
  const readme = readRepoFile('README.md')
  assert.match(readme, /georef-osgb/)
  // The runtime half must stay standard-only: no host route or client loader
  // mentions the OSGB sidecar file.
  const hostSource = readRepoFile('src/host/routes.js')
  assert.doesNotMatch(hostSource, /tileset_info/)
  const checkSource = readRepoFile('src/client/scene/georef-check.js')
  assert.doesNotMatch(checkSource, /readFile|JSON\.parse/)
})
