# Changelog

## 1.5.0

架构与契约版本：把 1.x 的单文件巨石拆成模块、清掉隐式改写数据的兼容层、修掉错误的性能度量，并把未验证的功能移出主线。**有破坏性变更，升级前请读「不兼容变更」一节。**

### 不兼容变更

- **删除 `tileset_info.json` 地理配准兼容层**：以前宿主会在 `/tiles` 上读同级 `tileset_info.json` 的 `srs` + `srs_origin`，给缺少根 `transform` 的 `tileset.json` 补一个 ENU→ECEF 根变换。现在**只接受标准 3D Tiles 1.0 / 1.1**：根瓦片必须自带 `root.transform`（16 个数）或 `root.boundingVolume.region`，否则按 ECEF 读局部米、数据会落在地心附近。插件不再猜测、不再改写要发给 Cesium 的 JSON——`/tiles` 恢复为纯静态文件服务，「渲染的字节」永远等于「磁盘的字节」。
- **替代方案**：数据体检（`earth_scene action=inspect`）在根文档缺世界定位时报 **error 级 `tileset_not_georeferenced`**，说明症状与修法（重新导出时写入根 `transform` / `region`）。OSGB 转换链请把世界定位写进 `tileset.json`，不要依赖 sidecar 文件。
- **实验功能包未随本版发布**：自动找目标 / 视觉锚定、第一人称巡检 `earth_camera`、双期卷帘对比、单体化量测、视域 / 通视 / 控高 / 天际线 / 剖切、巡游录制、接触表、QA 清单、照片叠合、属性查询、覆盖网格、取景框、GeoJSON 导出、场景召回等 19 项**已整体移出主线**，代码保留在分支 / tag `wip/feature-bomb`（该分支是 1.5 开发期堆出来的功能爆炸，不代表已发布能力）。解冻条件见 `docs/DIRECTION.md` §7 与 `docs/spec/SPEC-v1.5.md` §7（先有 `HeightService`、多数据集图层模型或属性语义层，再逐个回归）。

### 修复

- **FPS 不再是错的度量**：仪表改为计数 Cesium 真实渲染帧（`scene.postRender`，与 Cesium 自带 `PerformanceDisplay` 同语义）+ EMA 平滑；页面隐藏、WebGL 上下文丢失、或连续 2 秒无渲染帧时进入**空闲态**，HUD 显示 `—` 而不是冻结的旧数字（此前读数来自窗口 `requestAnimationFrame`，静止时会一直停在某个值，例如 32）。`earth_scene status` 新增可加字段 `render: { fps, idle, terrain_depth_test }`。
- **「全屏」名副其实**：新增真正的全屏（DOM Fullscreen API，面板根节点 `requestFullscreen`，停靠态与主区域都可用，Esc / 系统退出后自动同步状态并 `viewer.resize()`）；原来叫「全屏查看」的按钮实际是把 DSH 右侧栏最大化，现更名为「最大化侧栏」。
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
