/**
 * v1.6.1 Batch A — destructive-action safety.
 *
 * A1–A4: every "clear" states its scope; the Agent clears only its own overlays,
 *       user-facing clears sweep all origins after an explicit confirmation.
 * A5:    water-depth is a depth ramp, not a flood analysis result.
 * A6:    enabling the sun timeline no longer destroys an unrelated analysis.
 * A7:    closing a tool window ends the canvas tool it owns.
 * A8:    a failed analysis keeps the previous result (clear after validation).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

import {
  buildAgentOverlayList,
  clearAgentOverlays,
  overlayOriginOf,
  overlayStats,
  OVERLAY_ORIGINS,
} from '../src/client/scene/agent-overlays.js'
import { clientSource, hostSource, readRepoFile } from './helpers/source.mjs'

register('./helpers/react-stub-loader.mjs', import.meta.url)
const { MenuItem } = await import('../src/client/ui/menu-item.js')

const entity = (id) => ({ id })

function state() {
  return {
    draw: [],
    measure: [],
    drawnFeatures: 0,
    measuredCount: 0,
    drawCommands: [],
    measureCommands: [],
    entityGroups: new WeakMap(),
  }
}

function fakeViewer() {
  const removed = []
  return { removed, entities: { remove: (item) => removed.push(item?.id ?? item) } }
}

function drawCommand(s, { origin, drawn = 1, entities = 1, caption = '' } = {}) {
  const command = {
    geojson: { type: 'FeatureCollection', features: Array.from({ length: drawn }, () => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } })) },
    style: 'accent',
    caption,
    drawn,
    ...(origin === undefined ? {} : { origin }),
  }
  const group = Array.from({ length: entities }, (_, index) => entity(`d${s.drawCommands.length}-${index}`))
  s.drawCommands.push(command)
  s.draw.push(...group)
  s.drawnFeatures += drawn
  s.entityGroups.set(command, group)
  return command
}

function measureCommand(s, { origin, points = 2, mode = 'distance' } = {}) {
  const command = {
    mode,
    points: Array.from({ length: points }, () => [0, 0]),
    draw: true,
    result: { distance_m: 10 },
    ...(origin === undefined ? {} : { origin }),
  }
  const group = [entity(`m${s.measureCommands.length}-0`)]
  s.measureCommands.push(command)
  s.measure.push(...group)
  s.measuredCount += points
  s.entityGroups.set(command, group)
  return command
}

test('A2 覆盖物来源：缺省按 agent 处理，未知值也回落到 agent', () => {
  assert.deepEqual(OVERLAY_ORIGINS, ['agent', 'user', 'import'])
  assert.equal(overlayOriginOf({}), 'agent')
  assert.equal(overlayOriginOf({ origin: 'user' }), 'user')
  assert.equal(overlayOriginOf({ origin: 'import' }), 'import')
  assert.equal(overlayOriginOf({ origin: 'someone-else' }), 'agent')
  assert.equal(overlayOriginOf(null), 'agent')
  // 旧快照没有 origin：当时只有 Agent 能写入，因此按 agent 处理。
  assert.equal(overlayOriginOf({ geojson: { type: 'Point' } }), 'agent')
})

test('A2 统计：按来源分账，画/量测各自计数', () => {
  const s = state()
  drawCommand(s, { origin: 'agent', drawn: 2 })
  drawCommand(s, { origin: 'user', drawn: 1 })
  drawCommand(s, { origin: 'import', drawn: 3 })
  measureCommand(s, { origin: 'agent', points: 2 })
  measureCommand(s, { origin: 'user', points: 3 })

  assert.deepEqual(overlayStats(s), {
    draw: 6,
    measure: 5,
    agentDraw: 2,
    agentMeasure: 2,
    userDraw: 1,
    userMeasure: 3,
    importDraw: 3,
  })
})

test('A2 Agent 清空只删自己的标注：user / import 全部保留', () => {
  const s = state()
  const viewer = fakeViewer()
  drawCommand(s, { origin: 'agent', drawn: 2 })
  drawCommand(s, { origin: 'user', drawn: 1 })
  drawCommand(s, { origin: 'import', drawn: 3 })
  measureCommand(s, { origin: 'agent', points: 2 })
  measureCommand(s, { origin: 'user', points: 3 })

  const outcome = clearAgentOverlays(s, viewer, 'all', { origin: 'agent' })
  assert.deepEqual(outcome, { removed: 2 })
  assert.equal(s.drawCommands.length, 2, 'user + import 标注保留')
  assert.equal(s.measureCommands.length, 1, 'user 量测保留')
  assert.equal(s.drawnFeatures, 4, '计数只扣掉 agent 的要素')
  assert.equal(s.measuredCount, 3, '计数只扣掉 agent 的量测点')
  assert.ok(viewer.removed.length >= 2)
  // 保留下来的命令实体仍在 viewer 上。
  for (const command of s.drawCommands) assert.ok(s.entityGroups.get(command).length > 0)
})

test('A2 用户确认后的清空扫全部来源；kind 过滤仍生效', () => {
  const s = state()
  drawCommand(s, { origin: 'agent' })
  drawCommand(s, { origin: 'user' })
  drawCommand(s, { origin: 'import' })
  measureCommand(s, { origin: 'user' })

  clearAgentOverlays(s, fakeViewer(), 'measure')
  assert.equal(s.drawCommands.length, 3, '仅清量测不动标注')
  assert.equal(s.measureCommands.length, 0)

  clearAgentOverlays(s, fakeViewer(), 'all')
  assert.equal(s.drawCommands.length, 0)
  assert.equal(s.drawnFeatures, 0)
  assert.equal(s.measureCommands.length, 0)
})

test('A1 行数据带来源标签，确认框可以按来源解释范围', () => {
  const s = state()
  drawCommand(s, { origin: 'import', caption: '地块' })
  measureCommand(s, { origin: 'agent' })
  const rows = buildAgentOverlayList(s)
  const drawRow = rows.find((row) => row.kind === 'draw')
  const measureRow = rows.find((row) => row.kind === 'measure')
  assert.equal(drawRow.origin, 'import')
  assert.equal(measureRow.origin, 'agent')
})

test('A1 客户端接线：分组 ✕ 各自限范围，Agent 只清自己的标注，量测清空真的删实体', () => {
  const client = clientSource()
  // 单一确认对话框实现仍在（设置等其它破坏性动作通过 useConfirm() 使用）。
  assert.match(client, /export function ConfirmDialog\(/)
  assert.match(client, /export function useConfirm\(/)
  assert.match(client, /role: 'dialog'/)
  assert.match(client, /'aria-modal': 'true'/)
  assert.match(client, /event\.key === 'Escape'/)
  assert.match(client, /event\.key !== 'Tab'/)
  // v1.8：图层卡不再有「全部清空 / 仅清量测」的三选一确认，改成分组作用域清空。
  assert.doesNotMatch(client, /t\('confirm\.clearVectorTitle'\)/)
  assert.doesNotMatch(client, /t\('confirm\.clearMeasureOnly'\)/)

  // 三个分组各清各的：策略集中在 scene/overlay-actions.js，ViewerSurface 只接线。
  assert.match(client, /onClearAnnotations: overlayActions\.onClearAnnotations/)
  assert.match(client, /onClearMeasurements: overlayActions\.onClearMeasurements/)
  assert.match(client, /onClearImports: overlayActions\.onClearImports/)
  const actionsModule = readRepoFile('src/client/scene/overlay-actions.js')
  const scopedClear = (name) => {
    const start = actionsModule.indexOf(`${name}: () =>`)
    assert.ok(start >= 0, `缺少 ${name} 策略`)
    const stop = actionsModule.indexOf('\n      }),', start)
    assert.ok(stop > start, `${name} 代码块切片失败`)
    return actionsModule.slice(start, stop)
  }

  const annotations = scopedClear('onClearAnnotations')
  assert.match(annotations, /clear\('draw', \{ origin: 'agent' \}\)/)
  assert.match(annotations, /clear\('draw', \{ origin: 'user' \}\)/)
  assert.doesNotMatch(annotations, /'measure'/, '清标注不得动量测')
  assert.doesNotMatch(annotations, /origin: 'import'/, '清标注不得动导入图层')

  const measurements = scopedClear('onClearMeasurements')
  assert.match(measurements, /clear\('measure'\)/)
  assert.doesNotMatch(measurements, /'draw'/, '清量测不得动标注')

  const imports = scopedClear('onClearImports')
  assert.match(imports, /clear\('draw', \{ origin: 'import' \}\)/)
  assert.doesNotMatch(imports, /'measure'/, '清导入图层不得动量测')

  // A confirm with no labels renders two empty buttons (review N1).
  assert.match(actionsModule, /confirmLabel: t\('confirm\.clear'\)/)
  assert.match(actionsModule, /confirmLabel: t\('confirm\.remove'\)/)
  assert.equal((actionsModule.match(/cancelLabel: t\('btn\.cancel'\)/g) ?? []).length, 2)

  for (const toast of ['toast.annotationsCleared', 'toast.measureCleared', 'toast.vectorCleared']) {
    assert.match(actionsModule, new RegExp(`t\\('${toast.replaceAll('.', '\\.')}'\\)`), `清除后应有反馈 ${toast}`)
  }

  // 面板：每个分组头的 ✕ 接自己的回调，空组禁用；回调只下发给对应页签。
  const entities = readRepoFile('src/client/ui/layers-entities.js')
  assert.match(entities, /clearButton\(t\('layers\.clearAnnotations'\), annotations\.length, annotations\.length === 0, onClearAnnotations\)/)
  assert.match(entities, /clearButton\(t\('layers\.clearMeasurements'\), measurements\.length, measurements\.length === 0, onClearMeasurements\)/)
  const surface = readRepoFile('src/client/ui/layers-surface.js')
  assert.match(surface, /clearButton\(t\('layers\.clearImports'\), imports\.length, onClearImports\)/)

  const panel = readRepoFile('src/client/ui/layers-panel.js')
  const surfaceAt = panel.indexOf('h(LayersSurface, {')
  assert.ok(surfaceAt > 0)
  const entityProps = panel.slice(panel.indexOf('h(LayersEntities, {'), surfaceAt)
  const surfaceProps = panel.slice(surfaceAt)
  assert.match(entityProps, /onClearAnnotations/)
  assert.match(entityProps, /onClearMeasurements/)
  assert.doesNotMatch(entityProps, /onClearImports/, '导入图层的清空只属于地表页签')
  assert.match(surfaceProps, /onClearImports/)
  assert.doesNotMatch(surfaceProps, /onClearAnnotations/, '标注清空只属于三维页签')

  // Agent 菜单项只清 agent 来源，并报告真实条数。
  assert.match(client, /onClearAgent: \(\) => \{/)
  assert.match(client, /clearAgentOverlays\('all', \{ origin: 'agent' \}\)/)
  assert.match(client, /t\('agent\.clearedOverlays', \{ n:/)
  // B1：数据菜单不再混排工具动作；量测清空在量测窗口内，统一清理手动量测/预览/纵断面草稿与 Agent 量测实体。
  assert.ok(client.includes('onClearMeasure: clearAllMeasurements,') || client.includes('onClearMeasure: clearMeasure,'))
  assert.ok(readRepoFile('src/client/ui/tool-windows.js').includes('onClick: onClearMeasure'))

  // 确认框渲染进面板树。
  assert.match(client, /confirmDialog,/)
})

test('A5 水深配色不再自称淹没分析，且带非分析声明', () => {
  const client = clientSource()
  const messages = readRepoFile('src/client/messages.js')
  assert.match(messages, /'shader\.preset\.water-depth': '水深配色'/)
  assert.match(messages, /'shader\.preset\.water-depth': 'Depth ramp'/)
  assert.match(readRepoFile('src/client/messages-v17.js'), /'shader\.waterDepthNote':/)
  assert.match(client, /t\('shader\.waterDepthNote'\)/)
  // 真正的淹没分析条目保留原名，避免两个概念又被混在一起。
  assert.match(messages, /'analysis\.title\.flood': '淹没分析'/)
  assert.match(readRepoFile('src/client/messages-v18.js'), /'selection\.flood': '淹没范围估算'/)
  // 预设 id 契约冻结，只改文案。
  assert.match(readRepoFile('src/client/shader/presets.js'), /water-depth/)
})

test('A6 时间轴只替换日照分析，其他分析结果保留并提示', () => {
  const client = clientSource()
  assert.match(client, /const handleSunEnable = \(\) => \{/)
  assert.match(client, /if \(analysis\?\.operation !== 'sunlight'\) return/)
  assert.match(client, /onBeforeEnable: handleSunEnable/)
  assert.match(client, /t\('toast\.sunReplacesAnalysis'\)/)
  assert.doesNotMatch(client, /onBeforeEnable: onClearAnalysis/)
})

test('A7 关闭工具窗会结束它拥有的画布工具', () => {
  const client = clientSource()
  assert.match(client, /const TOOL_WINDOW_OF_MODE = \{/)
  assert.match(client, /distance: 'measure'/)
  assert.match(client, /annotate: 'annotation'/)
  assert.match(client, /profile: 'analysis'/)
  assert.match(client, /if \(workspace\.windows\.some\(\(item\) => item\.id === owner\)\) return/)
  assert.match(client, /setToolMode\(null\)/)
})

test('A8 分析先校验后替换：分派器不再提前 clear，各分析体在采样后 clear', () => {
  const engine = readRepoFile('src/client/analysis/engine.js')
  const commandStart = engine.indexOf('async function analyzeCommand(')
  const command = engine.slice(commandStart, engine.indexOf('//#endregion analysis engine'))
  assert.doesNotMatch(command, /^\s*clearAnalysis\(\)$/m, '分派器不得在采样前清掉旧结果')
  assert.match(command, /A8: each analyze\* body clears the old result after its own validation and/)

  // 每个分析体：clearAnalysis() 紧挨着 beginAnalysis()，说明校验/采样已完成。
  for (const operation of ['profile', 'skyline', 'flood']) {
    const begin = engine.indexOf(`beginAnalysis('${operation}', layer)`)
    assert.ok(begin > 0, `缺少 ${operation} 的 beginAnalysis`)
    const before = engine.slice(Math.max(0, begin - 200), begin)
    assert.match(before, /clearAnalysis\(\)/, `${operation} 必须在 beginAnalysis 前 clear`)
  }
  // sunlight：restore 快照必须记录“分析前”的场景，所以 clear 在快照之前。
  const restoreAt = engine.indexOf('const restore = {\n          enableLighting')
  const sunlightClear = engine.lastIndexOf('clearAnalysis()', restoreAt)
  assert.ok(sunlightClear > 0 && sunlightClear < restoreAt, 'sunlight 必须先 clear 再快照 restore')
  // clip：先只读检查共享裁剪注册表，再 clear，再 acquire。
  const clipStart = engine.indexOf('const analyzeClip = async')
  const clipBlock = engine.slice(clipStart, engine.indexOf('async function analyzeCommand'))
  assert.match(clipBlock, /const conflict = clipConflictOf\(tileset\)/)
  assert.ok(clipBlock.indexOf('clearAnalysis()') < clipBlock.indexOf('acquireClipCollection('), 'clip 先 clear 再 acquire')
  // 预检本身是 registry 的只读查询，不再让 engine 读 owner/collection。
  assert.match(readRepoFile('src/client/scene/clip-collections.js'), /export function clipConflictOf\(tileset\)/)
})

test('A3 宿主工具文案：clear 只清 Agent 自己画的内容', () => {
  const host = hostSource()
  assert.match(host, /true first removes the annotations the Agent drew earlier in this panel; user-imported, hand-drawn and parsed overlays are not touched\./)
  assert.match(host, /true first removes the measurements the Agent drew earlier in this panel; annotations and the user\\'s own measurements are not touched\./)
  assert.doesNotMatch(host, /removes every overlay the Agent drew earlier in this panel \(annotations and measurements\)/)
  assert.match(host, /Cleared the Agent-drawn annotations on the digital earth\./)
})

test('A4 菜单项在不可用时禁用（MenuItem 支持 disabled/danger/checked/hint）', () => {
  // 禁用的菜单项：视觉上 is-disabled，语义上 disabled，且没有 onClick。
  const disabled = MenuItem({ onClick: () => assert.fail('禁用项不应执行'), disabled: true, children: '清空' })
  assert.ok(disabled.props.className.includes('is-disabled'))
  assert.equal(disabled.props.disabled, true)
  assert.equal(disabled.props.onClick, undefined)
  assert.equal(disabled.props.role, 'menuitem')

  // 复选项：role=menuitemcheckbox + aria-checked（HUD / 全屏用这个）。
  const check = MenuItem({ checked: true, children: '坐标 HUD' })
  assert.equal(check.props.role, 'menuitemcheckbox')
  assert.equal(check.props['aria-checked'], true)
  assert.ok(check.props.className.includes('is-check'))
  const unchecked = MenuItem({ checked: false, children: '全屏' })
  assert.equal(unchecked.props['aria-checked'], false)

  // 危险项与提示位（快捷键 / 计数）。
  const danger = MenuItem({ danger: true, children: '删除' })
  assert.ok(danger.props.className.includes('is-danger'))
  const hinted = MenuItem({ children: '导出', hint: '⌘E' })
  const hintSpan = hinted.children.flat(Infinity).find((node) => node?.props?.className === 'mv-menu-hint')
  assert.equal(hintSpan?.children[0], '⌘E', 'hint 必须渲染在标签右侧')

  // 数据菜单不再自带“可清数量”开关；量测清空在量测窗口内。
  assert.ok(!readRepoFile('src/client/ui/data-menu.js').includes('canClearMeasure'))
  assert.ok(readRepoFile('src/client/ui/tool-windows.js').includes("t('tool.clear')"))
})
