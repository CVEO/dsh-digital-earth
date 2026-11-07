# Changelog

## 1.5.0

图层平台与性能版本，按 `docs/PLAN-v1.6.md` 的阶段推进（**发布版本号始终保持 1.5.0**，不单独发 1.6.0）。以下为本轮已完成项：

- **新功能：指认（选中卡 + L 形角标 + 高度引线）**：工具栏新增准星按钮，点击场景中的对象后由面板弹出选中卡——显示坐标、表面高程（采样值）、高度估计（几何；邻域 8 方位 × 30/60/120 m 共 24 点，样本数 / 地面 / 跨度一并给出）与「高于邻域中位数」，并用**红黄绿三档置信度**（高 / 中 / 低）标注每条结论的来源。卡片保持克制：属性未知与限制**只写入证据 JSON**，界面上仅在底部保留一行小字说明高度为几何估计；三个动作的完整说明放在按钮悬浮提示里。**没有 batch table 的摄影测量数据用中性命中级别作标题（「三维瓦片区域」/「瓦片内要素」/「场景表面」），不写"未命名对象"式措辞、不编造名称、不给伪精度**（高度一律取整到米，对比基线写明是邻域中位数、含屋顶）。角标通过 `scene.postRender` 投影跟随三维点（直接写 DOM，不触发 React 重渲染），卡片宽度 ≤340 px、实底可读；Esc 关闭卡片、再点按钮退出指认。纯面板功能，**不改任何工具契约**。
- **新功能：导出证据包（PNG + JSON sidecar）**：选中卡上的「导出证据」先截一张干净 PNG，再把证据 JSON 一并写入 `$DSH_HOME/digital-earth/exports/`——JSON 含 schema 版本、插件版本、时间、相机视角、坐标、采样方法与统计、身份依据、`facts[]`（每个数字带 `basis: measured/estimated/inferred` 来源）、未知与限制，以及 `earth: {datum: WGS84, height_reference: ellipsoid}`，未测量字段写 `null` 而不填 0。新增**页面专用** host 路由 `POST /api/3dviewer/export/<token>`（16 MiB 请求上限、JSON ≤256 KiB、目录最多保留 200 份、文件名由宿主生成），路由与 token 不出现在任何工具结果里。
- **新功能：导览故事条**：图层面板的「视角收藏」新增每站一句说明（`caption`，向后兼容旧数据），并新增「播放导览」——按 1.6–2.4 s 自适应飞行逐站播放、到站显示文案，支持暂停 / 上一站 / 下一站；**拖动地球或点击别处立即暂停接管**，Esc 结束，自然播完自动保存一张截图。纯面板功能，不新增工具。
- **HUD 详细模式（设置项）**：P0 把左下 HUD 压到 5 个数字（FPS + 光标 + 相机高度）后，设置 → 外观新增「HUD 详细模式」，**默认关闭、写回 `sources.json` 持久化**；打开后 HUD 额外显示朝向 / 俯仰与逐层瓦片 / 待加载 / 三角面 / 缓存，关闭则回到精简仪表。窄面板仍按原有规则隐藏次要遥测（≤560px 隐藏相机高度与朝向、≤420px 再隐藏 FPS）。
- **视觉质感包（仪器感）**：地平线大气与四角径向压暗（CSS 伪元素，截图时自动隐藏）；卡片统一 13/12/11 字号层级、`tabular-nums` 数字与 200 ms `cubic-bezier(.16,1,.3,1)` 入场动效；**HUD 常驻数字压到 ≤6 个**（FPS + 光标经纬/高程 + 相机高度），朝向 / 俯仰与逐层瓦片 / 三角面 / 缓存统计收进图层面板「场景详情」；相机飞行按距离自适应 **1.2 / 1.6 / 2.4 s** 三档（复位从 1.2 s 改为 2.4 s，图层定位与框全改按实际距离取值），连续操作不再闪切。
- **工程**：截图 HUD 绘制抽到 `src/client/scene/capture-hud.js`，`ViewerSurface` 从 2,845 行降到 **2,818 行**（限期例外预算 2,880）；新增 `scene/selection.js`、`scene/selection-controller.js`、`scene/evidence-export.js`、`scene/tour.js`、`scene/motion.js`、`ui/selection-overlay.js`、`ui/tour-bar.js`；`messages.js` 到 900 行预算后，P0 文案拆到 `messages-v17.js`。测试从 405 增至 **437**（新增 10 条宿主导出路由测试、22 条 P0 客户端测试），`npm run release:check` 通过。
- **仓库卫生**：删除 4 份与发布无关的个人简历包装文档并加入 `.gitignore`，避免随公开仓库发布。
- **渲染质量档**：设置 → 外观新增「渲染质量」，两个档位——**均衡（默认）**：`resolutionScale 0.85` + 2× MSAA + 地形 LOD 3 + 瓦片 LOD 20 + 地形缓存 200，拖拽更稳；**高清**：满分辨率 + 4× MSAA + Cesium 默认 LOD（2 / 16），适合截图与评审。切换即时生效（抗锯齿档位在重新打开面板后完全生效）；`earth_scene status` 的 `render` 增加 `quality`、`resolution_scale`、`globe_maximum_screen_space_error`，Agent 可以解释"为什么模糊/为什么卡"。
- **修复地形遮挡开关不持久化**：`settings.terrainDepthTest` 之前只存在于客户端，宿主 `normalizeConfig` 会把它丢掉，导致每次保存设置后开关复位；现在它和渲染质量一起随数据源配置持久化（新增行为测试覆盖往返）。
- **统一图层面板（四层结构）**：工具栏的「底图 ▾ / 地形 ▾」两个菜单和右侧内联图层卡合并为一个「图层」面板，按显示栈从上到下组织——**L1 地形**（单选/无地形）、**L2 影像底图**（单选/无底图）、**L3 栅格叠加**（多实例，每行含透明度滑杆、显隐、上移/下移、移除，并可在面板内直接添加 WMS / XYZ / ArcGIS 叠加层）、**L4 矢量叠加**（Agent 标注与量测数量 + 一键清除）、**三维内容层**（原有定位/显隐/体检/移除）。面板在没有加载 3D Tiles 时也能打开（地形/底图只能从这里选）；叠加层的增删改会先写回 `sources.json` 再实时对账图层堆栈，单层失败只弹 toast。
- **着色器工作台支持叠加**：面板的工作台预设按钮改为**可点选 1–3 个**（再点取消），参数区按所选预设的并集显示（`water-depth` 的水面高程/最大深度字段也补上了）；应用时按点选顺序发送数组，活动列表与 toast 显示 `等高线 + 高度扫描` 这样的叠加名。界面与 Agent 侧能力保持一致。
- **着色器预设叠加（D-17 第二半）**：`earth_shader` 的 `preset` 现在接受**单个预设或 1–3 个预设的有序数组**——叠加后的片元体按顺序各自包一层 GLSL 块作用域（避免 `height`/`band` 等局部变量冲突），uniform 取所选预设的并集，参数默认值按数组顺序合并后再被显式值覆盖；重复预设、超过 3 个、跨预设参数都会带 `next:` 拒绝，合成源码仍受 8 KB 白名单上限约束。结果新增加法字段 `stack`（D-18），模型面文本把叠加显示为 `contour + scan`。D-17 至此完成。
- **`skyline` 天际线分析（D-16 第二半）**：`earth_analyze` 新增 `skyline` action——给定观察点 `from` 与方向目标 `to`，沿测地线采样地形，返回**最大仰角**及其距离/高程（观察点取 1.7 m 人眼高），在地球上绘制天际线剖面线与最大仰角/观察点标记。与淹没一样，有真实地形时走 `ground` 模式（不会把屋顶当成地平线），只有 3D Tiles 时回退表面高程并带 `warnings`；分析卡显示最大仰角/出现距离/观察点高度。剪影（skyline）与剖切（clip）至此都完成 D-16 的 1.6 范围。
- **`clip` 剖切分析（D-16 第一半）**：`earth_analyze` 新增 `clip` action——用一条**水平剖切面**切开 3D Tiles：`height` 指定剖切高程（沿当地垂线，-1000..9000 m），`keep` 选择保留侧（`below` 默认裁掉平面上方、`above` 裁掉平面下方）。平面法向/距离由纯函数 `analysisClipPlane` 计算（Cesium 裁掉平面的**负侧**，所以 below 用反向法向），`clear` 会把图层原有的 `clippingPlanes` 恢复；分析卡显示剖切高程/保留侧/剖切面数，模型面文本带结果与下一步。天空线（skyline）是 D-16 的第二半，下一轮做。
- **`water-depth` 着色器预设（D-17 第一半）**：第五个白名单预设——按"水面高程以下的水深"给地物上**固定深度色带**（浅蓝→深蓝，参数 `water_height` 默认 0、`depth_max` 默认 50）；仍然**不接受任意 GLSL**，`earth_shader` 的 preset 枚举、参数 schema、错误提示与系统提示词同步更新。预设叠加（1–3 个）是 D-17 的第二半，下一轮做。
- **修复：窄窗口左下 HUD 被挤成竖排单字**：旧样式 `max-width:calc(100% - 330px)` + 行内 `flex-wrap:wrap`，在窄面板里每个字都换行。现在 HUD 改为不换行的仪表式读数（`white-space:nowrap`、行内不折行、`width:max-content`），并做窄宽分级：≤560px 隐藏相机/朝向与图层统计、≤420px 再隐藏 FPS，只保留「光标坐标 + 高程」主读数；非停靠的窄视口用媒体查询兜底。悬停/拖动穿透（`pointer-events:none`）保持不变。新增 3 条响应式测试。
- **修复：点开「设置」白屏**：数据源对话框的外观页（渲染质量那一行）调用了只在 `SourceForm` 内部定义的 `field()` 辅助函数，打开设置时抛 `ReferenceError: field is not defined`，React 直接卸载整个面板 → 白屏。现已在 `SourcesDialog` 内补上同名局部 helper；新增**对话框渲染冒烟测试**（设置/数据源表单/健康检查/路径授权全部真实渲染一遍），这类"只有打开对话框才触发"的运行时错误以后会被测试拦住。
- **着色器效果挂在图层行上（不是独立分组）**：3D Tiles 图层行本身承载效果信息——有效果的层左侧出现薄荷绿标线并显示 ✦ 按钮；鼠标悬停该行即显示「图层 · 预设 · 参数」摘要；点击整行或 ✦ 会把该效果载入着色器工作台（图层、叠加顺序、参数全部回填）直接编辑；图层名与 ⌖ 仍保持飞行定位，✕ 仍是删除图层。
- **着色器视觉效果升级**：修复高程渐变“整片平黄”的根因——高程范围改为优先读取 3D Tiles root 包围体的**真实垂直范围**（region 的 min/max 高度，或 OBB 沿地心方向的支撑半高），不再用被水平尺度主导的包围球半径；配色换为现代感知色带（深靛蓝→青→薄荷→琥珀→珊瑚），并用纹理亮度调制保留建筑屋顶/墙面的体积感；等高线改为冷色双线权重（1x 细线 + 5x 主线），扫描改为柔和辉光 + 细核心带，水波改为世界坐标多向波纹 + 浪尖高光，水深加入分层色带与岸线高亮；工作台缩略图同步新配色。
- **着色器工作台 2.0（面板可读性 + 可调性 + 反馈）**：卡片改为实底磨砂（浅色实底 + 薄荷绿强调色 `#3ddc97`），统一字号/行距/间距，地图不再干扰阅读；五个预设都有**效果缩略图**（高程色带 / 等高线 / 扫描带 / 水波 / 水深渐变），一眼看懂用途；「自动选择」下方直接显示**实际目标图层名**，并用卡片标题栏的小标签标出「作用于…」；叠加预设改为**有序列表**，可上移/下移/移除，顺序即合成顺序；参数改为**滑杆 + 数值输入**；新增**实时预览**开关（拖动滑杆静默合并应用，显式应用才 toast）与**原图对比**按钮（临时切回图层原始外观，应用/重置/关闭工作台自动恢复）；「已应用」列表与所选预设用不同视觉层级区分，避免"已选择/已应用"混淆。引擎新增同预设 uniform 快路径（不重建 CustomShader）与对比生命周期管理；新增 7 条测试（顺序/目标解析/预览合并/对比/引擎快路径/卡片结构）。
- **新功能：视角收藏**：图层面板新增「视角收藏」——一键保存当前相机视角（经度/纬度/高度/朝向/俯仰，最多 20 条，存浏览器 localStorage），点击名称飞回、✕ 删除；不依赖对话 Agent，也不改变任何工具契约。纯逻辑在 `src/client/scene/bookmarks.js`，含 7 条测试（校验/去重/封顶/存储降级/飞行）。
- **简化：全屏只保留一个入口**：移除「最大化侧栏」按钮（DSH 自带侧栏布局），停靠与主区域都只保留唯一的真全屏按钮（DOM Fullscreen，Esc 退出）；相应删除 `togglePaneFullscreen` 与 `btn.maximize*` 文案。
- **修复：地形/网络请求不再阻塞面板**：底图、地形、3D Tiles、L3 叠加层的 provider 请求都加了超时（底图/地形 8 s、瓦片 15 s、叠加层 10 s）；初始化时地形改为**后台加载**，地形服务失败（如 ArcGIS 高程服务 `Request has failed`）只 toast 并回退椭球，不再遮住加载层。
- **修复：重开面板卡在“正在加载三维引擎”**：初始化时 `await restoreSceneSnapshot(savedScene)` 位于 `setPhase('ready')` 之前——当上一会话保存的某个图层指向已失效的本地目录、或远程 tileset 请求一直不返回时，该 await 永不结束，加载覆盖层便一直遮住已经渲染好的地球。现在：① 相机视角先恢复（本地数据，立即生效）；② 面板**先就绪**，恢复改在后台执行；③ 每层目录解析 3 s、图层加载 8 s 超时，超时跳过并提示一次；④ 恢复顺序改为“视角 → 图层 → 标注/着色器/分析”，不会再把用户已经移动的相机回跳。新增 4 条结构测试（超时护栏、顺序、先就绪、错误文案）。
- **修复：面板白屏（首帧运行时错误）**：v1.6 拆分引入两处只有真实渲染才会触发的问题——① `collectSceneStatus` 被写成 `const`，而 askAgent/报告接线早于其定义（TDZ `Cannot access before initialization`）；② `createWorkbenchWiring` 迁移后**漏了 import**（`ReferenceError: createWorkbenchWiring is not defined`）。两处均已修复；并新增**首帧渲染冒烟测试**（`test/helpers/render-smoke.mjs` + `test/v16-render-smoke.test.mjs`）：用假 React/DOM 执行发布产物 `client.js`、注册插件并把面板组件树渲染一遍，任何只在渲染期出现的错误都会让门禁失败。
- **工程：Client Phase 2 第七批**：`ViewerSurface` 从 2,840 行降到 **2,769 行**——画布拾取与量测点击循环（`pickResult`/`pickAt`/`onCanvasClick`/`finishMeasure`，含要素属性 40 条上限、tileset/entity/scene 回退、测高只留两点）迁到 `src/client/scene/pointer-tools.js`；预算收紧到 2,780。新增 5 条行为测试（拾取分类、属性封顶、拾取卡片、点击加点、结束工具）。
- **工程：Client Phase 2 第六批**：`ViewerSurface` 从 3,051 行降到 **2,840 行**——命令分发器 `runCommand`（earth_scene 全部 action + authorize/capture/analyze/shader/report，约 250 行）迁到 `src/client/scene/command-bridge.js`（处理函数全部注入，组件只留 `commandRef.current = runCommand` 接线）；预算收紧到 2,850。新增 7 条分发行为测试（status/capture/list、analyze/shader 的 next 补全、authorize、图层动作、相机/叠加、report 脱敏、未知 action）。
- **工程：Client Phase 2 第五批**：`ViewerSurface` 从 3,160 行降到 **3,051 行**——场景状态（`collectSceneStatus`，含 render/quality/raster_overlays 加法字段）迁到 `src/client/scene/status.js`；"Ask Agent"（截图为可选、文字摘要注入）迁到 `src/client/scene/ask-agent.js`；预算收紧到 3,060。新增 6 条行为测试（status 字段/空闲 fps、注入文本、无会话、采集失败降级、拆分守卫）。
- **工程：Client Phase 2 第四批**：`ViewerSurface` 从 3,349 行降到 **3,160 行**——场景报告生成器（自包含 HTML / Markdown、图层表、量测/分析/着色器小节、可选内嵌截图）迁到 `src/client/scene/report.js`；预算收紧到 3,200。新增 5 条报告行为测试（Markdown/HTML/sections/截图可选与失败降级）。
- **工程：Client Phase 2 第三批**：`ViewerSurface` 从 3,444 行降到 **3,349 行**——截图/Agent 快照链路（`renderSnapshot` / `screenshot` / `captureScene`：chrome 隐藏、满分辨率缓冲、7.5 MB dataURL 预算与 JPEG 降质重试）迁到 `src/client/scene/capture.js`；行数预算收紧到 3,350。新增 6 条无浏览器依赖的行为测试（HUD 开关、质量档恢复、隐藏面板拒绝、capture POST/toast、下载）。
- **工程：Client Phase 2 第二批**：`ViewerSurface` 从 3,498 行降到 **3,444 行**——宿主/本地场景快照存储（3 s 读超时、10 s 写节流、512 KB 上限、localStorage 回退）迁到 `src/client/scene/host-scene-store.js`；组件只保留 refs 与三个同名薄封装，原有结构测试继续有效。行数预算同步收紧到 3,450。
- **L4 矢量叠加可编辑**：图层面板的「矢量叠加」不再只有计数——每条 Agent 标注 / 量测命令成为一行（名称、要素数或量测值），可**单独移除**某一组实体，保留一键清除全部；实体组用 `WeakMap` 挂在状态旁，场景快照 JSON 不被 Cesium 实体污染。清理/移除逻辑抽到 `src/client/scene/agent-overlays.js`（纯函数 + 单测）。
- **工程：发布前只读 dry-run**：新增 `npm run release:check`（`scripts/release-check.mjs`）——在打 tag 之前本地校验版本单源（package / README 徽章 / Host+Client About / CHANGELOG 顶部）、`client.js` 可复现、架构行数预算、`npm pack --dry-run` 的必需文件与包版本/文件名；脚本**只读**，不会 tag / push / publish，最后打印应打的 tag（当前 `v1.5.0`）。Windows 下 `npm` 走 `npm.cmd`，避免 ENOENT。
- **工程：Client Phase 2**：`ViewerSurface` 从 4,179 行降到 **3,497 行**——分析引擎（profile/flood/sunlight/clip/skyline、实体生命周期、日照阴影恢复）迁到 `src/client/analysis/engine.js`；着色器引擎（预设应用/重置/列表、共享 `u_time` tick、逐图层原有着色器恢复）迁到 `src/client/scene/shader-engine.js`；工作台接线（表单→bridge 参数、叠加 toggle、toast）迁到 `src/client/ui/workbench-wiring.js`。三者都是纯工厂 + 惰性 ref getter，不含 React 状态；`ViewerSurface` 只保留接线。架构预算同步收紧（`ViewerSurface` 限期例外 4,200 → 3,500，只许变小）。
- **分析高程来源统一（HeightService）**：新增 `src/client/analysis/height-service.js` 作为分析唯一的高程采样入口，支持 `surface`（3D Tiles 表面优先、地形兜底）与 `ground`（**只用地形**）两种模式，带探针缓存、采样预算（默认 600，超出告警）与来源统计。修复两个语义问题：**淹没分析**在有地形时改为纯地面采样，不再把 3D Tiles 的**屋顶**当裸地算淹没面积（无地形时仍用表面高程，但结果明确标注 `height_source: tiles` + `warnings`）；**剖面分析**结果新增 `height_source`/`height_sources`/`warnings`，不再"高程随相机选中的瓦片变化却不说"。`earth_analyze` 的模型面文本新增 `Height source:` 与 `Warnings:` 两行，旧字段一个没少。
- **便捷操作**：面板标题栏新增「**框全所有可见图层**」（一次把多图层合并包围球框满画面，此前只能逐层定位）；**双击地球**把光标处飞向画面中心（保持当前朝向/俯仰/高度；量测工具激活时双击仍是"结束量测"）；面板新增「空间分析」区，显示当前活动的分析并可一键清除；`earth_capture` 的结果也补上可执行的下一步建议（与其他工具一致）。

### 工程重构与不兼容变更（原 1.5.0 冻结内容）

架构与契约版本：把 1.x 的单文件巨石拆成模块、清掉隐式改写数据的兼容层、修掉错误的性能度量，并把未验证的功能移出主线。**有破坏性变更，升级前请读「不兼容变更」一节。**

### 不兼容变更

- **删除 `tileset_info.json` 地理配准兼容层**：以前宿主会在 `/tiles` 上读同级 `tileset_info.json` 的 `srs` + `srs_origin`，给缺少根 `transform` 的 `tileset.json` 补一个 ENU→ECEF 根变换。现在**只接受标准 3D Tiles 1.0 / 1.1**：根瓦片必须自带 `root.transform`（16 个数）或 `root.boundingVolume.region`，否则按 ECEF 读局部米、数据会落在地心附近。插件不再猜测、不再改写要发给 Cesium 的 JSON——`/tiles` 恢复为纯静态文件服务，「渲染的字节」永远等于「磁盘的字节」。
- **替代方案**：数据体检（`earth_scene action=inspect`）在根文档缺世界定位时报 **error 级 `tileset_not_georeferenced`**，说明症状与修法（重新导出时写入根 `transform` / `region`）。OSGB 转换链请把世界定位写进 `tileset.json`，不要依赖 sidecar 文件。
- **实验功能包未随本版发布**：自动找目标 / 视觉锚定、第一人称巡检 `earth_camera`、双期卷帘对比、单体化量测、视域 / 通视 / 控高、巡游录制、接触表、QA 清单、照片叠合、属性查询、覆盖网格、取景框、GeoJSON 导出、场景召回等 16 项**已整体移出主线**（天际线 / 剖切 / 水深着色已按 D-16 / D-17 回到 1.5.0 主线），代码保留在分支 / tag `wip/feature-bomb`（该分支是 1.5 开发期堆出来的功能爆炸，不代表已发布能力）。解冻条件见 `docs/DIRECTION.md` §7 与 `docs/spec/SPEC-v1.5.md` §7（先有 `HeightService`、多数据集图层模型或属性语义层，再逐个回归）。

### 修复

- **FPS 不再是错的度量**：仪表改为计数 Cesium 真实渲染帧（`scene.postRender`，与 Cesium 自带 `PerformanceDisplay` 同语义）+ EMA 平滑；页面隐藏、WebGL 上下文丢失、或连续 2 秒无渲染帧时进入**空闲态**，HUD 显示 `—` 而不是冻结的旧数字（此前读数来自窗口 `requestAnimationFrame`，静止时会一直停在某个值，例如 32）。`earth_scene status` 新增可加字段 `render: { fps, idle, terrain_depth_test }`。
- **性能：移除每帧的帧缓冲拷贝**：`preserveDrawingBuffer` 改为 `false`（截图链路本来就在同一个同步任务里 `viewer.render()` 后立即 `drawImage`，不依赖保留缓冲）。这一项直接减少每帧一次全分辨率拷贝，是"开地形后拖拽掉到 30 FPS"归因后落地的第一刀；HUD 相机/图层统计从 500 ms 降到 1 s 且数值无变化时不触发 React 重渲染，静止场景的面板重渲染降为零。归因与后续修复（分辨率档、地形 LOD、瓦片 LOD）见 `docs/research/performance.md` 与 `docs/PLAN-v1.6.md`。
- **「全屏」名副其实**：新增真正的全屏（DOM Fullscreen API，面板根节点 `requestFullscreen`，停靠态与主区域都可用，Esc / 系统退出后自动同步状态并 `viewer.resize()`）；原来叫「全屏查看」的按钮实际是把 DSH 右侧栏最大化，现更名为「最大化侧栏」。
- **工具栏更省空间**：截图 / 问 Agent / 复位改为图标按钮（tooltip + aria-label），两个全屏相关按钮本来就是图标；停靠窄宽度下不再因为文字标签换行到第二排。
- **地形遮挡（深度测试）可开关**：新增设置项 `terrainDepthTest`（默认关）。关闭时地下管网、埋在地形下的模型都能看见（Cesium 默认行为）；开启时地形会遮挡埋在下面的内容、天际线更干净。切换只改 `Globe` 属性，不重建 viewer，切换地形后自动重放。
- 清理三处重复实现：原子 JSON 写入、瓦片目录扫描、时间戳格式化各合并为一份；删除已废弃的截图回执兼容分支。

### 工程

- **Host 拆分**：`index.js` 从 5,081 行降为 **43 行入口**（`inject` / `apply` + 公开 re-export），实现落到 `src/host/**` 的 **27 个模块**（最大 499 行），零运行期依赖、无循环依赖。
- **Client 拆分**：`client.js` 从 7,582 行手写单文件改为 `src/client/**` 的 **22 个模块**，由 esbuild 打包成单一 `window.__ModuleLoader__` 产物（React 保持 external，动态 Cesium `import()` 保持不变）。`client.js` 现在是**构建产物**（CI 用 `npm run build:client -- --check` 防止源码与产物漂移）。
- **架构门禁**：`scripts/check-size.mjs` 限制 `src/host/**` ≤600 行、`src/client/**` ≤900 行、`index.js` ≤80 行；`ViewerSurface` 作为限期例外（4,200 行）登记在豁免表里，只许变小。
- **发布链路**：仍为 tag-only，并加固——手动 `workflow_dispatch` 只允许在 `main` 上运行；tag 必须等于 `v<package.json version>` **且落在 `origin/main` 上**；发布前重跑 `npm ci`、产物一致性、架构预算、测试与打包冒烟。
- **测试分层**：240 个测试全绿（原 227）；9 个「读源码文本断言」的客户端测试改为读模块源码（`test/helpers/source.mjs`），新增 12 个离线体检行为测试与 3 个产物冒烟测试（在 Node VM 里真实执行 `client.js`，断言工厂返回 `{inject, apply}`）。
- **仓库卫生**：`roof_task/` 等本地点云数据、`*.npz` / `*.las` 等二进制扩展名加入 `.gitignore` 与隐私扫描跳过列表；`cveo-dsh-digital-earth-1.4.0.tgz` 按 `d14d17b` 重新打包，保留为回滚安装源。

### 文档

- 新增 `docs/AUDIT.md`（证据化审计）、`docs/spec/SPEC-v1.5.md`（冻结需求与决策记录）、`docs/DIRECTION.md`（方向、四层图层模型、路线图、工程准则）、`docs/audit/{host,client,release}.md`（逐行审计明细）、`docs/research/layers.md`（公开 XYZ / WMS / WMTS / ArcGIS / MVT 端点的实测结果与能力矩阵）、`docs/DELIVERY.md`（重装验证清单）。

## 1.4.0

对话工作区版本：本地数据、地形分析、着色器预设、场景快照、`/earth` 命令、问 Agent 与场景报告。

- **场景快照更完整**：按会话保存的场景快照在相机、图层、标注 / 量测之外，新增当前活动的地形分析（`profile` / `flood` / `sunlight`，按图层名记录）与各图层的着色器预设（预设 + 参数）；恢复时按图层 → 标注 / 量测 → 着色器 → 分析 → 相机的顺序回放，未激活的分析 / 着色器不会写入快照。
- **场景快照落盘到宿主**：快照优先存放在 `$DSH_HOME/digital-earth/scenes`（每会话一份、原子写入、单份上限 512 KB、最多保留最近 50 个会话），本机 localStorage 只作快速缓存与兜底；因此完全重启 DSH、或页面地址 / 端口变化后，重新打开面板仍能恢复同一会话的场景。保存按变更防抖，面板卸载与页面隐藏（pagehide）时强制落盘；宿主快照经面板专用带实例 token 的路由读写，不进入任何工具结果。
- **`/earth` 斜杠命令**：聊天里直接输入 `/earth status | capture [label] | report [html|markdown] | clear | open`（裸 `/earth` 显示用法），不产生模型回合：`status` 返回相机 / 图层 / 底图 / 地形与 Agent 叠加摘要，`capture` 截图并返回宿主路径，`report` 导出场景报告，`clear` 清除 Agent 标注与量测，`open` 给出打开指引；失败以命令错误返回，不写入模型上下文。
- **截图工具行缩略图**：对话中的 `earth_capture` 工具行显示可点击的小缩略图，链接到完整截图；图片地址由页面元数据拼装并受实例 token 保护，模型侧仍只看到文件路径。
- **问 Agent / Ask Agent**：对话内的地球页签工具栏新增「问 Agent」按钮（仅在会话页签中显示）。点击后先尽力截取当前画面，再把场景整理成一段有长度上限的纯文本——相机经纬度 / 高度 / 朝向 / 俯仰、图层列表与隐藏标记、影像与地形名称、Agent 标注与量测数量、活动的 `earth_analyze` 剖面 / 淹没 / 日照结果统计、各图层的 `earth_shader` 预设，以及本次截图路径——经宿主新增的、带实例 token 的 `POST /api/3dviewer/inject` 路由注入当前对话的 Agent。上下文落在下一个被接纳的步骤上，用户接着直接输入问题即可。
- **注入边界**：注入不会唤醒空闲的 Agent；请求体上限 16 KiB、文本上限 4000 字符，C0 控制字符会被剥离。Agent 未运行返回 409 `agent_not_running`，宿主缺少 Agent 运行时返回 503 `agent_unavailable`，面板以可操作的 toast 错误提示。注入内容以上下文行（`source.kind = digital-earth`、`form = notice`）进入对话，不是用户手写消息，也不包含插件 token。
- **`earth_scene` 场景报告**：`earth_scene` 新增 `action="report"`（`format` 默认 `html` 自包含文档，或 `markdown`；`title` 上限 120 字符；`include_capture` 默认 true）。面板从当前场景生成报告：相机、图层表与显隐、影像 / 地形、Agent 标注与量测（量测现在保留计算结果）、活动的地形分析结果、各图层着色器预设，并尽力截取当前画面；HTML 把截图以 base64 内嵌并带内联样式，Markdown 用图片链接指向截图路径。宿主把文档写入 `$DSH_HOME/digital-earth/exports`（请求体上限 16 MiB、最多保留最近 200 份，经面板专用带 token 的 `POST /api/3dviewer/report` 路由），返回 `{path, format, bytes}`；工具结果会提示模型用 `present` 展示该路径。
- **导出入口**：面板「数据」菜单新增「导出场景报告」（HTML）；聊天里也可用 `/earth report [html|markdown]` 直接导出。失败以 toast 或工具错误返回。
- **文案与商店描述**：`earth_scene action=report` 的聊天工具行显示「导出报告 / Export report」摘要（不再回退为通用「三维场景」）；着色器工作台移除底部“仅支持四个白名单预设…”的说明行，并把 `height-false-color` 的界面名称从「高程假彩色」改为更直白的「高程渐变 / Elevation ramp」（工具 API 的 preset id 保持不变）；npm 商店的中英文简介同步覆盖地形分析、着色器预设、`/earth` 命令、问 Agent、报告导出与场景恢复。
- **工程与发版**：新增 `.gitattributes` 统一 LF 行尾，修复 Windows checkout 下结构性测试因 CRLF 失败的问题；CI 增加 Windows 运行腿（Node 22 / 24），打包冒烟脚本同时兼容 Windows 与 Linux；发版链路改为 tag-only —— 只有 push `v*` tag 或手动 workflow_dispatch 才发版，push 到 main 不再触发，tag 仍需严格等于 `v<package.json version>`。

- **本地绝对路径直接授权**：`earth_scene` 的 `load` / `inspect` 可直接接收本机绝对路径。路径不在已选目录白名单时，宿主向面板发起一次授权请求，弹窗展示请求目录与解析到的文件；用户允许后先把所在目录登记为本地数据源，再继续原操作。拒绝返回 `access_denied` 且不重试，30 秒未处理返回 `access_timeout`；白名单、真实路径与根目录校验不变，模型无法自行扩大可读范围。
- **本地数据自动地理配准（修复「球不居中」与瓦片闪现）**：OSGB 转换产物常常只带局部坐标（根节点无 `transform`/`region`，原点写在同级 `tileset_info.json` 的 `srs` + `srs_origin`）。Cesium 会把局部米当作 ECEF，整块数据坍缩到地心附近，`flyTo` 于是钻进地核、看起来像「球不居中」，瓦片也会在视锥里反复闪现。宿主现在在 `/tiles` 上按元数据反算原点经纬度，给缺少根变换的 `tileset.json` 补一个 ENU → ECEF 的根变换；磁盘文件不改动，已带 `transform` / `region` 的数据原样通过。支持 CGCS2000 高斯-克吕格四族 EPSG 码（6 度带 4491–4501 / 4502–4512，3 度带 4513–4533 / 4534–4554，如 `EPSG:4547` = 114°E 中央经线），其他投影跳过补丁。为防止重复变换，只补数据集自身的顶层 `tileset.json`，被父级引用的嵌套外部 tileset 交给父级变换。数据体检同步给出闭环诊断：可自动配准时报 `georeference_derived`，`tileset_info.json` 的 CRS 不支持时报 `georeference_unsupported`，完全没有元数据时报 `no_georeference`——不再静默回退成「数据落在地心」。
- **修复 `earth_scene load` 传本机 `path` 必然失败**：本地瓦片经宿主同源路由 `/api/3dviewer/tiles/...` 提供，是站点相对路径而非绝对 `http(s)` URL，却被原先的 `^https?://` 守卫判为非法地址，导致授权通过后仍报「请提供 http(s) 地址或本地 tileset.json 路径」。现在把宿主瓦片路由视为合法来源，绝对 `http(s)` 判定与代理回退逻辑不变。
- **图层与 HUD 可折叠**：工具栏可收起 / 展开图层卡与坐标 HUD，图层卡标题栏另有收起按钮；「设置 → 外观」新增「显示图层卡」「显示坐标 HUD」开关并持久化到数据源配置。HUD 隐藏后停止指针采样，不再为不可见读数做额外工作。
- **操作与性能**：HUD 指针采样调整为约 5–6 Hz，拖动视角时暂停采样、停手后补一次，周期采样不再触发 `scene.pick`，模型表面深度只在需要时读取；在本机真实 GPU 浏览器（非 headless / SwiftShader）中开启地形拖动视角实测约 30 FPS，帧率随显卡、窗口尺寸、地形与瓦片数据量变化，不作为固定指标。
- **`earth_analyze` 地形分析**：新增第 5 个工具，支持 `profile`（剖面）、`flood`（淹没）、`sunlight`（日照）与 `clear`；一次只保留一个活动分析，新分析替换旧分析。剖面返回长度、起伏 / 爬升 / 下降与采样点，并在面板显示 SVG 剖面卡；淹没返回区域、水位、面积、淹没比与水深统计；日照返回太阳高度角 / 方位角并切换光照与阴影，`clear` 移除分析叠加，并在日照分析后恢复进入前的光照 / 阴影 / 时钟状态。无有效高程数据时返回可操作错误，不猜测数值。
- **`earth_shader` 着色器预设**：新增第 6 个工具，支持 `apply` / `reset` / `list` 与四个白名单预设 `height-false-color`、`contour`、`scan`、`water`；同一图层只保留一个 shader，参数按预设严格校验，重置可只清一个图层或全部。3DGS 图层不支持该能力，模型与界面均不能注入自定义 GLSL。
- **第六工具与六条 toolview**：Agent 工具增至 6 个（`earth_scene`、`earth_capture`、`earth_draw`、`earth_measure`、`earth_analyze`、`earth_shader`）；对话中六个工具对应的 `tool.call.toolview` 行都已注册，面板尚未打开时会先自动打开并等待地球页签连上；系统提示词与工具描述同步覆盖分析与着色器。
- **截图默认干净画面**：手动截图与 Agent 截图默认隐藏 DOM 坐标 HUD，只保留三维画面；`earth_capture` 传 `include_hud=true` 或打开设置中的「截图时叠加坐标 HUD 与署名」时，才把光标坐标、相机参数与团队署名绘入图片。
- **关于页签**：版本更新为 1.4.0，并保留项目源码、Issues 与团队（武汉大学 CVEO 课题组）链接；版本号由宿主包元数据下发给面板。

## 1.3.0

标注与量测版本。

- **Agent 自动打开面板**：Agent 调用 `earth_scene` / `earth_capture` / `earth_draw` / `earth_measure` 时，插件自动在对话右侧打开当前会话的数字地球页签，并等待它连上（最多约 8 秒），不再需要先手动打开；「设置 → 外观」新增「Agent 调用时自动打开数字地球」开关，可随时关闭，偏好只保存在本机浏览器。
- **`earth_draw` 标注工具**：Agent 用 GeoJSON 在地球上绘制点 / 多点、线 / 多线、面 / 多面与文字标签（要素 `properties.name` 作为逐要素标签），提供 accent / alert / success / warm / violet 五套配色；`clear=true` 清除此前由 Agent 绘制的全部标注与量测，单次最多 500 个要素 / 20000 个坐标。
- **`earth_measure` 量测工具**：Agent 用 `[lon,lat]` 或 `[lon,lat,height]` 点串量测大地线距离、平面面积（含周长）或高差（含水平距离与坡度），默认把量测绘到地球上，`draw=false` 只返回数值；结果 JSON 以米 / 千米给出。
- **标注管理**：存在 Agent 标注时，面板「数据」菜单出现「清除 Agent 标注」；`earth_scene` 的 `status` 新增 `annotations{drawn_features, measured_points, overlays}`；沉浸式主面板与对话同屏页签行为一致。
- **空状态可关闭**：面板「在地球上叠加你的数据」提示卡右上角新增 ✕，关闭后在本次面板挂载期间不再遮挡地球，便于直接用自然语言自定义指令；「数据 ▾」菜单仍可随时打开本地目录或在线地址。
- **场景不再丢**：切换会话 / 窗口或面板被右侧栏回收后，重新打开面板（或下一次 Agent 调用自动打开）会按会话恢复相机视角、已加载图层（按原始本地路径或在线地址重新加载）、图层显隐与 Agent 标注 / 量测；快照保存在本机浏览器，按会话保留最近 12 份并自动限容，底图与地形沿用数据源设置。
- **最近打开的目录**：面板里选过的本地目录记入 `$DSH_HOME/digital-earth/directories.json`，重启 DSH 后在「数据 → 最近打开」里可直接重扫加载；`/scan` 仍是新增目录的唯一入口，白名单边界不变。
- **关于页签**：在项目源码链接旁新增 GitHub Issues 链接（两个链接地址都由宿主下发）。
- **工具与提示**：Agent 工具增至 4 个（`earth_scene`、`earth_capture`、`earth_draw`、`earth_measure`），系统提示词同步覆盖绘制与量测。

## 1.2.1

界面微调版本。

- **右栏页签留白**：面板停靠在会话右侧栏时，顶部悬浮工具栏与宿主页签条之间留出 20px 呼吸间距（原来只有 8px），左右边距同步为 20px；图层面板下移到 96px，与工具栏之间同样保留 20px，上下间距对称，避免工具栏换行后与图层卡片重叠。
- **窄宽度自适应**：停靠面板变窄时按容器宽度逐级精简——先隐藏与宿主页签重复的面板标题，再收起「就绪/图层数」状态文字，最后只保留图标；按钮只轻微收紧内边距（字号保持原大小），图层面板宽度改为跟随面板宽度，避免品牌条文字竖排换行、工具栏被迫折成两行。
- **停靠模式更紧凑**：品牌条与操作区的内边距略微收紧，窄宽度下按钮换行时不再挤压；主面板（全屏）布局保持不变。
- **图层行图标重做**：图层卡片的显隐、定位、体检、删除四项从 Unicode 字符改为内联 SVG 图标（统一 16px 视觉尺寸、26px 点击区域），解决 `⌖`/`⌕` 等字符在部分字体下明显偏小的问题；弹窗关闭等其它图标按钮同步放大到 26px。

## 1.2.0

数据体检版本。

- **面板数据体检**：图层列表每行新增「数据体检」入口（⌕），对 3D Tiles / 3DGS 的 `tileset.json` 做静态体检：资产版本、根几何误差、LOD 深度、瓦片 / 内容数、外部 tileset、`extensionsUsed`、内容缺失与包围体等问题；报告写入 `$DSH_HOME/digital-earth/reports`（保留最近 100 份），弹窗展示摘要与报告路径并支持复制。体检失败只提示，不进入全局 busy，也不影响已加载图层。
- **Agent 数据体检**：`earth_scene` 新增 `action="inspect"`（`layer` / `path` / `url` 三选一，可选 `deep`）。`layer` 模式经命令桥由面板解析原始来源并附加 Cesium 运行统计；`path` / `url` 模式在面板未打开时也可用。工具返回紧凑摘要与 `report_path`，不把 token 或全量报告暴露给模型。
- **`/remote` 查询串**：宿主代理透传远程 URL 的 `?query`（长度上限 2048 字符，超限 400，控制字符与非法编码 403），WMS / WMTS / 带签名参数的瓦片可直接经代理加载；原有的内网地址、3xx 重定向与超时规则不变。
- **打磨**：截图 HUD 的相机位置文案随界面语言本地化；面板未打开时的工具错误改为英文可操作提示；截图结果按实际开关说明 HUD，不再固定声称已隐藏；Windows 下截图路径包含判断大小写折叠；命令桥断线重连改为 4 次指数退避（500 ms → 4 s）。

## 1.1.0

与 Agent 对话协同的版本。

- **与聊天同屏**：右侧边栏新增「数字地球」页签（session 级），对话与三维地球并排显示；原 `main` 全屏面板保留为沉浸模式。两处面板提供「全屏查看 / 在对话旁打开」相互切换。
- **Agent 集成**：新增 `earth_scene` 工具（`status` / `list` / `load` / `remove` / `visible` / `basemap` / `terrain` / `fly` / `reset` / `pick`）与 `earth_capture` 工具（截图）。页签内面板通过 SSE 命令桥连接 Host，命令串行执行并回执。
- **本地目录白名单**：Agent 只能加载用户在面板里选择过的目录，Host 在派发命令前校验；工具结果与命令桥都不含实例 token，模型无法自行扩大白名单；越权路径返回可操作错误。
- **截图**：设置新增「截图时叠加坐标 HUD 与署名」开关（默认关闭）。面板工具栏 / HUD 是 DOM 元素无法直接导出，打开后插件会把光标坐标、相机参数与团队署名重绘进图片画布；手动与 Agent 截图均生效。Agent 截图默认只含干净画面，返回 Host 绝对路径；支持图像的多模态模型可直接读取，不支持时退回场景状态 JSON。截图写入 `$DSH_HOME/digital-earth/captures`，只保留最近 50 张。
- **单页签执行**：同一会话同时打开多个地球页签时，只由最新连接的那个执行 Agent 命令，避免重复加载或重复截图；截图时若面板不可见会返回明确提示。
- **设置**：新增「关于」页签（版本、项目源码、开发团队、Agent 连接状态），原页脚团队链接移入该页签；弹窗标题改为「设置 / Settings」。

## 1.0.0

首个公开版本（npm 包名 `@cveo/dsh-digital-earth`，面板名「数字地球 / Digital Earth」）。

- 3D Tiles 浏览：b3dm / glb（3D Tiles 1.0 / 1.1）与 3DGS（`KHR_gaussian_splatting`，含 SPZ 压缩）。
- 数据加载：本地目录递归扫描 `tileset.json`；在线 `http(s)` 地址（跨域失败自动走 Host 代理）；本机绝对路径。
- 数据源管理：影像底图与地形数据源可在设置中增删改（XYZ / WMS / ArcGIS / Cesium 地形），选中的底图与地形持久化到 `$DSH_HOME/digital-earth/sources.json`，支持恢复默认。
- 底图与地形：默认 Esri World Imagery 与 ArcGIS WorldElevation3D，均可关闭或切换；内置 7 个 Esri 底图预设（地形图 / 街道图 / 浅灰 / 晕渲 / 海洋 / 山体阴影），新增预设自动合并进已有配置。
- 双语界面：跟随 DSH 语言（中文 / English），运行时切换即时生效（槽位 `locale` 命名空间 + 全局字典注册）。
- 浅深主题：默认跟随 DSH / 系统；顶栏「外观」下拉提供 跟随系统 / 浅色 / 深色 三选，设置中亦可切换，仅作用于本面板（自有 `--mv-*` 变量 + Cesium 调色板同步）。
- 图层面板：显隐、定位、移除、叠加，按图层统计瓦片 / 三角面 / 缓存。
- 工具：测距、测面、测高、拾取属性、截图、复位视角。
- 坐标 HUD：光标经纬度与高程在裸地球、地形、3D Tiles / 3DGS 三种情形下均可用（射线—椭球求交 + 模型深度拾取 + `globe.getHeight` 地形校正，~8 Hz，DOM 直写不触发重渲染）。
- 数据源表单：XYZ 支持 TMS（Y 轴南起），并可直接选择本地 XYZ 瓦片目录作为底图（离线可用）。
- 安全：Connection 会话 / 同源校验、插件实例 token（仅下发给页面，工具结果不含 token）、本地目录白名单与真实路径校验、代理内网地址与重定向拦截。
- CesiumJS 1.147 自托管（中国大陆网络可用）。
- 设置面板页脚展示维护团队：武汉大学 CVEO 课题组（https://www.whu-cveo.com/）。
