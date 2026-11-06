# 数字地球 Agent 插件 · 大模型 Agent 向简历包装（投递版）

> 本文件面向**大模型 Agent / 应用算法 / 工具调用**类实习岗位。
> 若投空间智能 / 3D 视觉岗，用同目录 `数字地球项目-简历包装-投递版.md`（几何与采样算法前置）。
> 所有数字可从仓库核实（第 6 节）；不能写的见第 7 节。

---

## 0. 一句话定位

**一个基于 DeepSeek Harness（DSH）插件体系开发的开源插件：让大模型通过一组受约束的工具，用自然语言读取和操作一个 CesiumJS 三维地球场景，并把"模型在宿主、场景在浏览器"的执行链路、状态恢复与上下文注入做成可验证、可回放、可单测的运行时。**

对 Agent 岗，这个项目的价值不在"地球"，而在四件事：**工具契约设计、跨进程执行语义、会话状态工程、上下文边界**。写简历时，"数字地球"只是场景，主线是 Agent 运行时。

---

## 1. 标题行（三选一，都必须带 DSH + 开源）

| 版本 | 写法 |
|---|---|
| **推荐** | **数字地球 Agent 插件（DSH 插件）** ｜ 核心开发者 ｜ 开源 MIT ｜ Node.js · LLM Tool-Use · JSON Schema · CesiumJS |
| 强调运行时 | **LLM 三维场景工具运行时（DSH 插件）** ｜ 核心开发者 ｜ 开源 MIT ｜ 工具契约 · SSE 命令桥 · 会话快照 |
| 强调产品 | **面向大模型的三维地球工作台（DSH 插件）** ｜ 核心开发者 ｜ 开源 MIT · npm 公开包 ｜ 7 个工具 · 7 类空间分析 |

⚠️ 三个信息缺一不可：**基于 DSH 插件体系**、**开源（MIT / GitHub / npm）**、**"让大模型操作三维场景"**。只写"数字地球"会被当成 GIS 前端项目。

---

## 2. 主版本（Agent 向，4 条，可直接粘贴）

```
数字地球 Agent 插件（DeepSeek Harness / DSH 插件）｜ 核心开发者 ｜ 开源 MIT（GitHub CVEO/dsh-digital-earth，npm @cveo/dsh-digital-earth）
技术栈：DSH 插件体系 · Node.js · LLM Tool-Use · JSON Schema · SSE 命令桥 · CesiumJS 1.147 · 3D Tiles / 3DGS
```

- **工具契约层**：基于 DSH 插件 API（`apply(ctx)` + `ctx.inject(['tools','systemPrompt'])`）注册 7 个 agent 工具——场景控制、截图、GeoJSON 标注、量测、地形分析、着色器、相机运动——并注入插件专属 system prompt 段与 `/earth` 斜杠命令；工具入参由 JSON Schema 严格校验，失败统一返回错误码 + 可操作 `next`，使模型能在下一步自愈而不是原地重试；工具结果不携带插件实例 token。

- **跨进程执行链路**：解决"模型在宿主、场景在浏览器"的执行语义问题：设计 session 级 SSE 命令桥（宿主下发 → 面板串行执行 → HTTP 回执），同会话多页签只有最新连接执行、其余只读，避免一条指令执行两次；模型首次调用时自动打开面板并等待连上（约 8 s），断线重连走 4 次指数退避 0.5 s→4 s；截图/报告经宿主落盘后只回传绝对路径。

- **状态与上下文工程**：把场景状态（相机、图层、标注、量测、分析、着色器）按会话原子快照到宿主（≤512 KB/份、保留 50 个会话、恢复顺序固定为 图层→标注→着色→分析→相机），实现"重启 DSH、换端口也能复现同一实验环境"；Ask-Agent 注入通道限 16 KiB / 4,000 字符、剥离 C0 控制符、不唤醒空闲 agent，明确"注入的上下文 ≠ 用户消息"；对话内 toolview 渲染工具行与截图缩略图，模型侧只看到路径。

- **可验证的空间能力 + 开源工程**：在工具层之上实现 7 类空间分析（高程剖面 8–64 采样、洪水淹没 4–24² 网格、日照阴影、通视 LOS、视域 24×12=288 采样、控高包络、天际线 48×16=768 采样）与 4 种着色器预设（同层叠加 ≤3，合成单一 `CustomShader`），无有效高程数据时显式报错而非估算；约 1.68 万行 JS、32 个测试文件 / 352 个用例（351 通过）、GitHub Actions 覆盖 Windows/Linux × Node 22/24。

> 版面紧张时：保留 1/2/3 条——它们才是 Agent 岗看的东西；第 4 条压缩成一句"并实现 7 类空间分析与 4 种着色器预设，352 用例、双平台 CI"。

---

## 3. 功能速览（"你这个插件到底实现了什么"——直接照这个答）

| 层 | 已实现能力 |
|---|---|
| **Agent 集成** | 7 个工具（`earth_scene` / `capture` / `draw` / `measure` / `analyze` / `shader` / `camera`）；插件 system prompt 段；`/earth status\|capture\|report\|clear\|open` 斜杠命令；工具行 toolview 与截图缩略图 |
| **场景** | 3D Tiles 1.0/1.1（b3dm、glb）与 3DGS（`KHR_gaussian_splatting`、SPZ）多图层叠加、显隐、定位、移除；影像底图 / 地形 / 本地 XYZ 瓦片切换 |
| **数据** | 本地目录递归扫描 `tileset.json`；在线 URL 与宿主代理回退；本机绝对路径越权时一次性授权（`access_denied` / `access_timeout`） |
| **空间分析** | 剖面、淹没（面积/淹没比/水深）、日照阴影、通视、视域（可见占比 + 覆盖渲染）、控高包络、天际线；单次只保留一个活动分析 |
| **表达** | 4 个着色器白名单预设，同层叠加 ≤3；GeoJSON 标注（点/线/面/多几何，单次 ≤500 要素）；大地线距离、面积、高差量测 |
| **数据质量** | `tileset.json` 静态体检（几何误差、LOD 深度、内容缺失、包围体）+ 确定性修复建议（只改内存、可撤销） |
| **状态与上下文** | 会话级场景快照与恢复；Ask-Agent 场景注入；HTML/Markdown 场景报告导出；坐标 HUD |
| **工程与开源** | 中英双语、跟随主题；MIT 开源；npm 公开发布（1.0.0 → 1.4.0 共 6 个版本）；CI 双平台 × Node 22/24 |

---

## 4. 备选版本

### 4.1 极简 3 条（6 行版面）

- 基于 DeepSeek Harness（DSH）插件体系开发开源三维地球插件，注册 7 个 LLM 可调用工具 + 插件 system prompt + `/earth` 命令，JSON Schema 校验入参、失败带 `next` 支持模型自愈。
- 设计 session 级 SSE 命令桥打通"宿主 Agent ↔ 浏览器场景"，多页签去重、断线指数退避、面板自动打开；场景状态按会话原子快照，重启后可复现。
- 实现 7 类空间分析与 4 种着色器预设；约 1.68 万行、352 个用例、CI 双平台；MIT 开源并在 npm 公开发布 6 个版本。

### 4.2 若投空间智能 / 3D 视觉岗

把主版本第 4 条提到第 1 位，并换成几何口径开头：

> 面向实景三维（3D Tiles / 3DGS）的空间智能体：实现 CGCS2000 高斯-克吕格反算与 ENU→ECEF 根变换（覆盖 64 个 EPSG 码），把"局部坐标被误读为 ECEF 导致整模坍缩到地心"从静默错误变成自动配准。

---

## 5. 英文版（4 条）

**Digital Earth Agent Plugin (DeepSeek Harness / DSH)** | Core Developer | Open Source (MIT) · npm `@cveo/dsh-digital-earth` | Node.js · LLM Tool-Use · JSON Schema · CesiumJS

- **Tool contract layer.** Built a DSH plugin that registers 7 agent tools (scene control, capture, GeoJSON annotation, measurement, terrain analysis, shader presets, camera motion) plus a plugin system-prompt section and an `/earth` slash command. Every tool is JSON-Schema-validated, and failures return an error code with an actionable `next` so the model can self-repair instead of retrying blindly; tool results never carry the plugin instance token.
- **Cross-process execution.** Solved the "model lives in the host, scene lives in the browser" semantics with a per-session SSE command bridge (host → panel → HTTP receipt): only the newest panel tab of a session executes, the panel auto-opens and waits (~8 s) on first tool call, and reconnects use 4 exponential backoff rounds (0.5 s→4 s).
- **State & context engineering.** Persisted scene state (camera, layers, annotations, measurements, analysis, shaders) as atomic per-session snapshots on the host (≤512 KB, 50 sessions, fixed restore order), so an experiment is reproducible after a restart or port change. Bounded the Ask-Agent context-injection channel to 16 KiB / 4,000 chars with C0 stripping and no idle-agent wake-up, keeping "injected context ≠ user message".
- **Verifiable spatial capabilities, open source.** Layer 7 spatial analyses on top of the tools (profile 8–64 samples, flood 4–24² grid, sun/shadow, line-of-sight, viewshed 24×12 = 288 samples, height-control envelope, skyline 48×16 = 768 samples) plus 4 shader presets composable into a single `CustomShader` (≤3 stacked). ~16.8k LOC, 32 test files / 352 cases (351 passing), Windows/Linux × Node 22/24 CI; released under MIT with 6 public npm versions.

---

## 6. 数字口径（可当场复核）

| 指标 | 数值 | 出处 |
|---|---|---|
| DSH 插件入口 | `export function apply(ctx)`，`inject = ['webServer','connection']` | `index.js` |
| 工具注册 | `ctx.inject(['tools','systemPrompt'])` → `scope.tools.register(...)` × 7 | `index.js` |
| 系统提示注入 | `scope.systemPrompt.section({ name: 'plugin:digital-earth', order: 810 })` | `index.js` |
| 斜杠命令 | `ctx.inject(['commands'])` → `commands.register({ name: 'earth' })` | `index.js` |
| 宿主路由 | `ctx.webServer.register({ kind, path, handler })` | `index.js` |
| 鉴权 | `ctx.get('connection').requestRejection(req)`，`ctx.get('agents')` 取 Agent 运行时 | `index.js` |
| 运行依赖 | DSH `>=0.2.1-rc.1 <0.3.0-0`；无第三方运行期依赖 | `package.json` |
| 代码规模 | 16,810 行 JS（宿主 7,175 + 面板 9,635） | `index.js` / `client.js` |
| 测试 | 32 文件 / 352 用例 / 351 通过 | 逐文件 `node test/*.test.mjs` |
| 开源 | MIT；GitHub `CVEO/dsh-digital-earth`；npm `@cveo/dsh-digital-earth` 公开 | `LICENSE` / `package.json` |
| 版本 | 1.0.0 → 1.4.0 共 6 个版本 | `CHANGELOG.md` |
| 工具 / 分析 | 7 工具（发布版 6）/ 7 分析（发布版 3） | `index.js` |
| 采样参数 | 视域 24×12=288、天际线 48×16=768、剖面 8–64、淹没网格 4–24 | `index.js` 常量 |
| 注入上限 | 16 KiB / 4,000 字符 | `MAX_INJECT_BODY` / `MAX_INJECT_TEXT` |
| 快照 | ≤512 KB/份、50 会话 | `MAX_SCENE_BODY` / `MAX_SCENE_FILES` |
| 重连 | 4 次指数退避 0.5 s→4 s | `client.js` |
| CI | Windows/Linux × Node 22/24 | `.github/workflows/ci.yml` |

---

## 7. 诚实边界（红线）

1. **角色**：仓库作者是武汉大学 CVEO 课题组，MIT 开源。写"核心开发者 / 插件主要开发者"，不要写"独立从 0 到 1"。
2. **DSH 不是你的**：你写的是**插件**，宿主是 DeepSeek Harness。别写"我开发了 Agent 框架 / 我实现了工具调用协议"——面试官会立刻问宿主提供什么、你写了什么。
3. **在研 vs 已发布**：npm 1.4.0 是 **6 工具 + 3 分析**；第 7 个工具（`earth_camera`）、los/viewshed/envelope/skyline、着色器叠加在**未提交工作区**。写"在研分支已实现"，不要写"已上线"。
4. **没有**用户量 / 下载量 / 精度 / 准确率 / 帧率指标。别编百分比；可核实的是 352 用例、CI、6 个公开版本。
5. **测试口径**：352 例中 351 通过；第 352 例是隐私扫描用例，需 `git ls-files` 子进程，在受限执行环境被禁，不是产品缺陷。被问如实说。
6. **时间线**：提交集中在 3 天内（11/03–11/05，1.0.0→1.4.0）。别写"历时数月/长期迭代"；被问就说"高频小版本迭代，每版收敛一个能力闭环"。
7. **不含模型训练/微调/评测**。投 Agent 岗说"工具契约与运行时"，不要说"做了 Agent 训练"。
8. **只写你真正写过的模块**。四条 bullet 是可写全集，按实际参与裁剪。

---

## 8. 面试深挖 10 问（Agent 向，30 秒答法）

**Q1 为什么做成 DSH 插件，而不是独立 Web 应用？**
DSH 已经提供宿主能力：Agent 运行时、工具注册表、会话与鉴权、Web 服务与插件市场分发。插件只写领域能力（三维场景 + 空间分析），模型、会话、鉴权这些不重复造。代价是必须遵守宿主契约（工具 schema、命令不写入模型上下文、路由要过 connection 校验）。

**Q2 工具是怎么注册进 Agent 的？**
`apply(ctx)` 里 `ctx.inject(['tools','systemPrompt'], scope => ...)`，逐个 `scope.tools.register({ name, description, parameters, execute })`；同时 `scope.systemPrompt.section({ name:'plugin:digital-earth', order:810 })` 注入使用规范，让模型知道什么时候该调哪个工具。`ctx.inject` 是惰性的：宿主没提供对应服务时插件不会崩。

**Q3 为什么失败要带 `next`？**
错误码给程序判断（`access_denied` / `access_timeout` / 参数越界），`next` 给模型下一步动作（"改用 region 参数" / "先打开面板"）。模型拿不到可执行动作就会原地重试或瞎猜，这是 tool-use 最常见的失败模式。

**Q4 宿主和浏览器怎么通信？为什么用 SSE 不是 WebSocket？**
宿主下发命令用 SSE（单向、内建重连、实现简单），面板执行完用 `POST /bridge` 回执。场景状态本身不需要双向长连接，WebSocket 的额外复杂度换不来收益。断线用 4 次指数退避，避免宿主重启时打满重连。

**Q5 多页签同时打开会不会执行两次？**
会，所以桥按 session 记录连接，只有**最新**连接收命令，旧页签保持连接但只读，并在结果里提示"其他页签已连接"。语义是"同一会话同一时刻只有一个执行者"。

**Q6 快照为什么放宿主而不是 localStorage？**
localStorage 跟随页面 origin，换端口 / 换地址 / 清缓存就丢；放宿主才能跨重启恢复。做法是原子写（单份 ≤512 KB、保留最近 50 个会话）、恢复顺序固定（图层→标注→着色→分析→相机），避免恢复过程触发多余重渲染。

**Q7 为什么注入通道要限长、要剥离控制字符、还不唤醒空闲 agent？**
场景文本来自页面，属于半可信输入：不限长会污染上下文，控制字符可能被当成指令分隔。不唤醒 agent 是为了让"问 Agent"变成用户显式动作，而不是页面的副作用。

**Q8 怎么防止模型借工具做危险操作？**
三道：工具结果不含实例 token（模型拿不到凭证）；本地路径走白名单 + 真实路径校验，越权要用户在面板点一次授权；`/remote` 代理拒绝 loopback / 私网地址与 3xx 重定向，避免 SSRF。另外"无高程数据不估算"也是安全边界——不允许模型编造数值。

**Q9 一个 Agent 插件怎么测？**
把契约与算法抽成纯函数单测（工具参数校验、错误码、桥协议、快照顺序、坐标反算），宿主路由用桩对象测，浏览器渲染只做形状校验，再加打包冒烟（解包后 `import` 宿主入口）。32 个文件 / 352 个用例，双平台 CI。

**Q10 最值得讲的设计决策是什么？**
**"注入的上下文 ≠ 用户消息"**——面板可以把场景摘要送进对话，但它必须是上下文行而不是伪造用户消息，且不触发 agent 苏醒。这条边界定了，工具、注入、快照三块的设计才自洽。追问可引申到"Agent 系统里谁能代表用户说话"。

---

## 9. 投递执行建议

**简历关键词**（至少出现 4 个）：LLM Tool-Use / Agent 工具调用 / JSON Schema 契约 / Function Calling / 上下文工程 / 会话状态恢复 / DeepSeek Harness 插件 / 开源 MIT。

**排序**：有一个带训练或评测指标的项目 → 本项目放第 2；没有 → 放第 1，但标题行必须带 "DSH 插件 + 开源 + LLM Tool-Use"，别只写"数字地球"。

**向面试官解释 DSH 的一句话**：
> "DSH（DeepSeek Harness）是一个带插件体系的 AI 工作台：插件可以向宿主注册工具、系统提示、斜杠命令和 HTTP 路由，Agent 通过工具调用驱动插件提供的 UI。我这个插件就是把一个三维地球做成一等公民工具集。"

**30 秒口述**：
> "我基于 DeepSeek Harness 的插件体系写了一个开源数字地球插件，让大模型能用自然语言操作 CesiumJS 场景。核心不是地球，是 Agent 运行时：7 个工具全部 JSON Schema 约束、失败带下一步动作；宿主到浏览器的命令走 session 级 SSE 桥，多页签去重；场景状态按会话快照，重启能复现；面板注入上下文有 16 KiB 上限且不唤醒空闲 agent。整体 1.68 万行，352 个用例，MIT 开源，npm 发了 6 个版本。"

**被问"这不就是调 API 吗"**：
> "工具调用本身是 API，难的是执行语义：模型在服务端、场景在浏览器、面板可能没开、可能有多个页签、状态要跨重启。我把这些做成可验证的契约和可单测的纯函数，而不是散落在 UI 里。"

**若想把 Agent 方向再推一步（2–3 天可做）**：
1. 给 7 个工具写**工具调用评测集**：非法参数拒绝率、失败自愈轮数、跨模型成功率——这是 Agent 岗最认的东西；
2. 加 **tool 选择策略**实验：系统提示里工具的 description 写法对选错率的影响（A/B 两版 prompt）；
3. 给长任务加 **多步规划**示例：一句话"飞到武汉大学、量两个点高差、截图并导出报告"，记录步数与失败点。
