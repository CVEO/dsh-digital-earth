/**
 * v1.6 Requirement A + coupled F06 / F11 / F13 verification:
 *   - 3D tab (`Layers3D`) exposes `+ 添加` (`打开本地目录…` / `粘贴在线 / 本机地址…` / `最近打开`)
 *     even after the first dataset is loaded and the empty-state overlay is gone;
 *   - opening a 2nd local dataset appends to existing layers without overwriting,
 *     auto-loads a single tileset, and opens `ScanDialog` ("发现 N 个数据集") when >1;
 *   - `/scan` prioritises `tileset.json` and subdirectories over flat tile files, and
 *     `resolveLocalTileset` refuses to treat a truncated 1-file scan as unique (F13);
 *   - task-language scan error messages distinguish empty / unauthorized / unreadable
 *     on Host machine / root-or-UNC;
 *   - Map tab (`LayersMap`) offers local XYZ directory picking in the raster form,
 *     merges multiple GeoJSON files, preserves `feature.id`, and flies to vector rows (F11);
 *   - `SourceForm` retains `source.name` in the name input (F06).
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { scanTilesets } from '../src/host/fs-util.js'
import { resolveLocalTileset } from '../src/host/local-resolve.js'
import { MESSAGES } from '../src/client/messages.js'
import { register } from 'node:module'
import { flyToAgentOverlay } from '../src/client/scene/agent-overlays.js'
import { readVectorFiles } from '../src/client/scene/vector-file.js'
import { normalizeVectorGeoJSON } from '../src/client/scene/vector-import.js'
import { createLocalDirectoryWiring, createWorkbenchWiring, formatScanFailure } from '../src/client/ui/workbench-wiring.js'
import { readRepoFile } from './helpers/source.mjs'

register('./helpers/react-stub-loader.mjs', import.meta.url)
const { ScanDialog, SourceForm } = await import('../src/client/ui/dialogs.js')
const { Layers3D } = await import('../src/client/ui/layers-3d.js')

const tempDirs = []
after(async () => {
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true }).catch(() => {})
})

async function makeTemp(prefix) {
  const dir = await mkdtemp(join(tmpdir(), `dsh-req-a-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

test('需求 A：已加载首份数据后，追加打开第二份本地目录不覆盖原图层，单数据集直载、多数据集弹窗选择', async () => {
  const loadedLayers = [{ id: 'layer-1', name: 'first/tileset.json', url: '/tiles/1', visible: true }]
  let scannedModal = null
  let recentList = []
  const toasts = []

  const directoryPayloads = {
    'D:/data/second': {
      items: [{ name: 'tileset.json', url: '/api/3dviewer/tiles/tok/d2/tileset.json' }],
    },
    'D:/data/multi': {
      items: [
        { name: 'blockA/tileset.json', url: '/api/3dviewer/tiles/tok/m/blockA/tileset.json' },
        { name: 'blockB/tileset.json', url: '/api/3dviewer/tiles/tok/m/blockB/tileset.json' },
      ],
    },
  }
  let nextPickedDir = 'D:/data/second'

  const localWiring = createLocalDirectoryWiring({
    metaRef: { current: { token: 'tok', scanUrl: '/api/3dviewer/scan', tilesBase: '/api/3dviewer/tiles/tok/' } },
    getWorkspace: () => ({ pickDirectory: async () => nextPickedDir }),
    scanLocalDirectory: async (_meta, dir) => directoryPayloads[dir] ?? { items: [] },
    addTileset: async (url, name, source) => {
      loadedLayers.push({ id: `layer-${loadedLayers.length + 1}`, name, url, source, visible: true, framed: true })
    },
    joinLocalPath: (dir, rel) => `${dir}/${rel}`,
    b64url: (text) => Buffer.from(text).toString('base64url'),
    folderName: (dir) => dir.split('/').pop(),
    setRecentDirs: (list) => {
      recentList = list
    },
    setScan: (state) => {
      scannedModal = state
    },
    setBusy: () => {},
    setOpenMenu: () => {},
    showToast: (msg) => toasts.push(msg),
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  })

  const workbench = createWorkbenchWiring({
    getForm: () => ({ preset: 'height-false-color' }),
    getLayers: () => loadedLayers,
    setShaderForm: () => {},
    shaderCommand: async () => ({}),
    showToast: (msg) => toasts.push(msg),
    t: (key) => key,
    shaderCompare: async () => ({}),
    openLocal: localWiring.pickLocal,
    openRecent: localWiring.openRecentDirectory,
    openUrl: () => {},
    pickLocalTiles: localWiring.pickLocalTiles,
  })

  // 1) 单 tileset 目录：直接追加并定位，不覆盖第一份图层，也不弹多选框。
  await workbench.openLocal()
  assert.equal(loadedLayers.length, 2, '新图层应追加到列表而非覆盖已有图层')
  assert.equal(loadedLayers[0].id, 'layer-1')
  assert.equal(loadedLayers[1].url, '/api/3dviewer/tiles/tok/d2/tileset.json')
  assert.deepEqual(loadedLayers[1].source, { kind: 'local', path: 'D:/data/second/tileset.json' })
  assert.equal(scannedModal, null)

  // 2) 多 tileset 目录：绝不静默取第一个，必须弹出选择框并携带全部候选。
  nextPickedDir = 'D:/data/multi'
  await workbench.openLocal()
  assert.equal(loadedLayers.length, 2, '多数据集目录不应静默加载第一个')
  assert.ok(scannedModal !== null, '应弹出多数据集选择框')
  assert.equal(scannedModal.dir, 'D:/data/multi')
  assert.equal(scannedModal.items.length, 2)
  assert.equal(recentList.length, 0)
  assert.equal(toasts.length, 0)

  // 3) 地图 Tab 本地瓦片目录选择：withMeta 返回 URL 与目录名。
  nextPickedDir = 'D:/data/ortho_xyz'
  const pickedTiles = await workbench.pickLocalTiles({ withMeta: true })
  assert.equal(pickedTiles.name, 'ortho_xyz')
  assert.match(pickedTiles.url, /\/\{z\}\/\{x\}\/\{y\}\.png$/)
})

test('需求 A：任务语言错误提示区分未找到 tileset / 目录未授权 / Host 路径不可读 / 根目录与 UNC', () => {
  const zh = (key, params) => {
    const raw = MESSAGES.zh[key] ?? key
    return params ? raw.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : raw
  }
  const en = (key, params) => {
    const raw = MESSAGES.en[key] ?? key
    return params ? raw.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : raw
  }

  const forbidden = Object.assign(new Error('HTTP 403: forbidden'), { status: 403, detail: 'forbidden' })
  assert.match(formatScanFailure(zh, forbidden), /未授权|令牌/)
  assert.match(formatScanFailure(en, forbidden), /not authorized|token/i)

  const notFound = Object.assign(new Error('HTTP 404: folder not found'), { status: 404, detail: 'folder not found' })
  assert.match(formatScanFailure(zh, notFound), /Host|无法读取/)
  assert.match(formatScanFailure(en, notFound), /Host machine|not readable/i)

  const invalidRoot = Object.assign(new Error('HTTP 400: scanning a filesystem root'), { status: 400 })
  assert.match(formatScanFailure(zh, invalidRoot), /根目录|UNC/)
  assert.match(formatScanFailure(en, invalidRoot), /drive root|UNC/i)
})

test('F13（含 P1-A 正向回归）：大数据集（1 个 tileset.json + 300 个 .glb）正常直载，多子目录数据集与截断子目录正确报 ambiguous', async () => {
  // 1) 正向测试：1 个根 tileset.json + 300 个 .glb 瓦片文件，按目录加载应直接解析成功。
  const singleLarge = await makeTemp('f13-single-large')
  for (let i = 0; i < 300; i += 1) {
    await writeFile(join(singleLarge, `tile_${String(i).padStart(3, '0')}.glb`), '')
  }
  await writeFile(join(singleLarge, 'tileset.json'), '{}')
  const singleResolved = await resolveLocalTileset(singleLarge)
  assert.equal(singleResolved.path, join(singleLarge, 'tileset.json'))

  // 2) 根目录下唯一 tileset.json + 超过 200 个普通子目录（截断发生但根 tileset 位于 base 根目录），仍直接解析根 tileset。
  const rootWithSubdirs = await makeTemp('f13-root-subdirs')
  await writeFile(join(rootWithSubdirs, 'tileset.json'), '{}')
  for (let i = 0; i < 205; i += 1) {
    await mkdir(join(rootWithSubdirs, `tile_dir_${String(i).padStart(3, '0')}`))
  }
  const rootResolved = await resolveLocalTileset(rootWithSubdirs)
  assert.equal(rootResolved.path, join(rootWithSubdirs, 'tileset.json'))

  // 3) 两个子目录数据集（其中 subA 含 300 个 .b3dm/.glb）：prioritizeTilesets 跳过普通瓦片文件，完整扫出 2 个候选并报 ambiguous。
  const root = await makeTemp('f13-multi')
  const subA = join(root, 'a_dataset')
  const subB = join(root, 'b_dataset')
  await mkdir(subA, { recursive: true })
  await mkdir(subB, { recursive: true })
  for (let i = 0; i < 300; i += 1) {
    await writeFile(join(subA, `tile_${String(i).padStart(3, '0')}.b3dm`), '')
  }
  await writeFile(join(subA, 'tileset.json'), '{}')
  await writeFile(join(subB, 'tileset.json'), '{}')

  const prioritized = await scanTilesets(root, { depth: 3, limit: 10, prioritizeTilesets: true })
  assert.equal(prioritized.found.length, 2)
  assert.equal(prioritized.truncated, false)

  await assert.rejects(
    resolveLocalTileset(root),
    (error) => {
      assert.equal(error.code, 'ambiguous_local_path')
      assert.match(error.message, /found 2 tileset\.json files/)
      return true
    },
  )

  // 4) 当子目录自身包含超过 200 个子文件夹导致截断、只扫到非根位置的 1 个 tileset.json 时，拒绝静默当唯一。
  const truncatedRoot = await makeTemp('f13-truncated-sub')
  const heavySubA = join(truncatedRoot, 'a_heavy')
  const heavySubB = join(truncatedRoot, 'b_sibling')
  await mkdir(heavySubA, { recursive: true })
  await mkdir(heavySubB, { recursive: true })
  await writeFile(join(heavySubA, 'tileset.json'), '{}')
  for (let i = 0; i < 205; i += 1) {
    await mkdir(join(heavySubA, `sub_${String(i).padStart(3, '0')}`))
  }
  await writeFile(join(heavySubB, 'tileset.json'), '{}')
  await assert.rejects(
    resolveLocalTileset(truncatedRoot),
    (error) => {
      assert.equal(error.code, 'ambiguous_local_path')
      assert.match(error.message, /stopped at 200 entries/)
      return true
    },
  )
})

test('F11：多 GeoJSON 同时导入合并要素、保留 feature.id，且矢量叠加行支持定位到数据', async () => {
  const f1 = {
    name: 'one.geojson',
    size: 120,
    text: async () =>
      JSON.stringify({
        type: 'Feature',
        id: 'feat-alpha',
        properties: { name: 'Alpha' },
        geometry: { type: 'Point', coordinates: [114.3, 30.5] },
      }),
  }
  const f2 = {
    name: 'two.geojson',
    size: 120,
    text: async () =>
      JSON.stringify({
        type: 'Feature',
        id: 42,
        properties: { name: 'Beta' },
        geometry: { type: 'Point', coordinates: [114.4, 30.6] },
      }),
  }

  const { parsed, name } = await readVectorFiles([f1, f2])
  assert.equal(name, 'one.geojson, two.geojson')
  assert.equal(parsed.featureCount, 2)
  assert.equal(parsed.geojson.features[0].id, 'feat-alpha')
  assert.equal(parsed.geojson.features[1].id, 42)
  assert.deepEqual(parsed.bbox, { west: 114.3, south: 30.5, east: 114.4, north: 30.6 })

  const single = normalizeVectorGeoJSON(await f1.text())
  assert.equal(single.geojson.features[0].id, 'feat-alpha')

  let flownDestination = null
  const viewer = {
    camera: {
      flyTo: ({ destination }) => {
        flownDestination = destination
      },
    },
  }
  const Cesium = {
    Rectangle: {
      fromDegrees: (west, south, east, north) => ({ west, south, east, north }),
    },
    Cartesian3: {
      fromDegrees: (lon, lat, height) => ({ lon, lat, height }),
    },
  }
  const state = {
    drawCommands: [{ geojson: parsed.geojson, style: 'accent', drawn: 2 }],
    measureCommands: [],
  }
  assert.equal(flyToAgentOverlay(state, viewer, Cesium, 'draw', 0), true)
  assert.ok(flownDestination !== null)
  assert.ok(flownDestination.west < 114.3 && flownDestination.east > 114.4)
})

test('F06 与 UI 组件行为：SourceForm 渲染保留 source.name，ScanDialog 携带动态 limit，Layers3D 提供无障碍菜单契约', () => {
  const collectNodes = (node, acc = []) => {
    if (!node || typeof node !== 'object') return acc
    if (Array.isArray(node)) {
      for (const child of node) collectNodes(child, acc)
      return acc
    }
    acc.push(node)
    for (const group of [node.children, node.props?.children]) {
      if (Array.isArray(group)) {
        for (const child of group) collectNodes(child, acc)
      } else if (group && typeof group === 'object') {
        collectNodes(group, acc)
      }
    }
    return acc
  }

  // 1) F06 真实组件渲染：编辑已有数据源时，名称输入框的 value 必须等于 source.name。
  const formTree = SourceForm({
    kind: 'imagery',
    source: { id: 'img-1', name: '天地图影像', type: 'xyz', url: 'https://example.com/{z}/{x}/{y}.png', credit: 'TDT' },
    onPickLocal: () => {},
    onChange: () => {},
    onCancel: () => {},
    t: (key) => key,
  })
  const inputs = collectNodes(formTree).filter((el) => el.type === 'input')
  assert.equal(inputs[0]?.props?.value, '天地图影像', 'SourceForm 第一个名称输入框应回填 source.name')

  // 2) ScanDialog 真实组件渲染：显示数据集数量及带动态 limit 的截断提示。
  const scanTree = ScanDialog({
    scan: {
      dir: 'D:/data/city',
      items: [
        { name: 'blockA/tileset.json', url: '/tiles/a' },
        { name: 'blockB/tileset.json', url: '/tiles/b' },
      ],
      truncated: true,
      limit: 200,
    },
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    onSelect: () => {},
    onClose: () => {},
  })
  const scanTexts = collectNodes(scanTree)
    .flatMap((el) => [...(Array.isArray(el.children) ? el.children : []), el.props?.children])
    .filter((child) => typeof child === 'string')
  assert.ok(scanTexts.includes('scan.foundCount:{"n":2}'))
  assert.ok(scanTexts.includes('scan.truncatedHint:{"limit":200}'))

  // 3) Layers3D 真实组件渲染：即使 layers 非空，「＋ 添加」按钮也始终存在且暴露 aria-controls="mv-add-3d-menu"。
  const layers3dTree = Layers3D({
    t: (key) => key,
    config: { terrain: [] },
    settings: { terrain: null },
    layers: [{ id: 'l1', name: 'blockA/tileset.json', visible: true }],
    terrainActive: null,
    shaderActive: [],
    recentDirs: [{ dir: 'D:/data/city', name: 'city' }],
  })
  const buttons = collectNodes(layers3dTree).filter((el) => el.type === 'button')
  const addBtn = buttons.find((el) => el.props?.['aria-controls'] === 'mv-add-3d-menu')
  assert.ok(addBtn, '已加载图层后，三维 Tab 仍应渲染带 aria-controls="mv-add-3d-menu" 的添加按钮')
  assert.equal(addBtn.props['aria-haspopup'], 'menu')

  const layers3dSource = readRepoFile('src/client/ui/layers-3d.js')
  assert.match(layers3dSource, /event\.key !== 'Escape'/)
  assert.match(layers3dSource, /onOpenLocal\?\.\(\)/)
  assert.match(layers3dSource, /onOpenUrl\?\.\(\)/)

  const layersMap = readRepoFile('src/client/ui/layers-map.js')
  assert.match(layersMap, /t\('settings\.field\.localTiles'\)/)
  assert.match(layersMap, /onPickLocalTiles/)
  assert.match(layersMap, /onFlyAgentOverlay/)
})
