/**
 * 客户端接线自检。
 *
 * 这些断言只覆盖「面板与对话之间的接线」是否还在：工具行槽位、自动打开面板的
 * 闸门、最近目录的数据来源。渲染细节由人工验证，不在这里重复。
 * 任何一条挂掉，Agent 调用 earth_scene / earth_capture 时就可能看不到地球面板。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { clientSource } from './helpers/source.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readText = (name) => readFileSync(join(root, name), 'utf8')
// Authored client source (src/client/**), not the generated client.js artifact:
// these assertions describe layout/wiring, and the artifact is minified-ish glue.
const client = clientSource()

test('两个地球工具都注册了自定义工具行', () => {
  assert.match(client, /name: 'tool\.call\.toolview'/)
  assert.match(client, /key: 'earth_scene'/)
  assert.match(client, /key: 'earth_capture'/)
})

test('自动打开偏好存在 localStorage 且默认开启', () => {
  assert.match(client, /dsh\.digital-earth\.autoOpenPanel/)
  // 未写入过该键时返回 true，即默认打开。
  assert.match(client, /stored === null \? true/)
})

test('仅在工具调用实时阶段自动打开面板', () => {
  // 历史会话以 result 阶段回放，这时绝不能弹出面板。
  assert.match(client, /if \(phase === 'result' \|\| openedRef\.current\) return/)
})

test('当前已是活动页签时不重复打开', () => {
  assert.match(client, /rightbar\.isExpanded\?\.\(\) === true && rightbar\.active\?\.\(\)\?\.kind === 'digital-earth'/)
})

test('数据菜单懒加载宿主记住的最近目录', () => {
  assert.match(client, /metaRef\.current\?\.directoriesUrl/)
  assert.match(client, /refreshRecentDirs/)
  // 点选最近目录必须复用现有 /scan 请求（带面板标记头），才能通过宿主白名单。
  assert.match(client, /headers: \{ 'x-dsh-panel': '1' \}/)
  assert.match(client, /openRecentDirectory/)
})

test('关于页从 homepage 派生问题反馈链接', () => {
  assert.match(client, /about\.issues/)
  assert.match(client, /\/issues`/)
})

test('空状态提示卡可以关闭，关闭后不再渲染', () => {
  // 卡片右上角的 ✕ 必须存在，并写入独立的 dismissed 状态。
  assert.match(client, /className: 'mv-empty-close'/)
  assert.match(client, /t\('panel\.empty\.dismiss'\)/)
  assert.match(client, /setEmptyDismissed\(true\)/)
  // 渲染条件必须尊重该状态，否则关了还会再弹出来。
  assert.match(client, /phase === 'ready' && layers\.length === 0 && !emptyDismissed/)
})

test('场景按会话快照持久化，重新挂载时恢复', () => {
  // 每个会话一份快照，键前缀必须固定，避免和其它插件的 localStorage 冲突。
  assert.match(client, /dsh\.digital-earth\.scene\./)
  assert.match(client, /function readSceneSnapshot/)
  assert.match(client, /function writeSceneSnapshot/)
  // 恢复既要重建图层，也要恢复相机与 Agent 叠加层。
  assert.match(client, /async function restoreSceneSnapshot/)
  assert.match(client, /loadTileset\(url, item\.name, source, \{ fly: false \}\)/)
  assert.match(client, /viewer\.camera\.setView\(\{/)
  // 相机移动要标记 dirty，卸载/隐藏前必须落盘，否则切换窗口就丢。
  assert.match(client, /viewer\.camera\.moveEnd\.addEventListener\(markSceneDirty\)/)
  assert.match(client, /saveSceneSnapshot\(\)/)
  assert.match(client, /addEventListener\('pagehide', flush\)/)
  // 恢复在 ready 之前完成，Agent 命令才不会和恢复的相机竞争。
  assert.match(client, /const savedScene = .*await loadSceneSnapshot\(sessionId\)/)
  // 宿主侧场景库优先（跨重启/换端口可恢复），localStorage 只是回退与缓存。
  assert.match(client, /async function readHostSceneSnapshot/)
  assert.match(client, /function saveHostSceneSnapshot/)
  assert.match(client, /async function loadSceneSnapshot/)
  assert.match(client, /hostSnapshot = await readHostSceneSnapshot\(session\)/)
  // 卸载 / 页面隐藏时必须强制写一次宿主，否则最后几秒的场景会丢。
  assert.match(client, /saveSceneSnapshot\(true\)/)
})

test('report 工具行与商店描述覆盖新能力', () => {
  // earth_scene action=report 的聊天工具行必须有自己的摘要，不能回退成通用文案。
  assert.match(client, /report: 'tool\.action\.report'/)
  assert.ok(client.includes("'tool.action.report': '导出报告'"))
  assert.ok(client.includes("'tool.action.report': 'Export report'"))
  // 商店简介要提到 1.4–1.7 新增能力，避免 npm 页面信息过时。
  const zh = JSON.parse(readText('locale/zh.json'))
  const en = JSON.parse(readText('locale/en.json'))
  for (const phrase of ['空间分析', '视觉特效', '/earth', '问 Agent', '报告']) {
    assert.ok(zh.meta.description.includes(phrase), `locale/zh.json 简介缺少：${phrase}`)
  }
  for (const phrase of ['spatial', 'visual effects', '/earth', 'Ask Agent', 'report']) {
    assert.ok(en.meta.description.toLowerCase().includes(phrase.toLowerCase()), `locale/en.json 简介缺少：${phrase}`)
  }
})
