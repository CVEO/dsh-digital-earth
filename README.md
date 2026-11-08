<div align="center">

<img src="https://github.com/CVEO/dsh-digital-earth/raw/main/icon.svg" width="72" height="72" alt="数字地球图标">

# 数字地球 · Digital Earth

**在 CesiumJS 地球上叠加 3D Tiles / 3DGS，并把场景交给对话里的 Agent 读写。**

[中文](README.md) · [English](README.en.md) · [Issues](https://github.com/CVEO/dsh-digital-earth/issues) · [更新日志](CHANGELOG.md)

![版本](https://img.shields.io/badge/版本-1.5.1-4f8cff)
![许可](https://img.shields.io/badge/许可-MIT-2ea44f)
![DSH 插件](https://img.shields.io/badge/DSH-插件-0ea5e9)
![3D Tiles + 3DGS](https://img.shields.io/badge/3D_Tiles_%2B_3DGS-CesiumJS-8b5cf6)
![平台](https://img.shields.io/badge/平台-Web-64748b)

</div>

![数字地球面板：着色器工作台、两个 Tab 的图层与指南针](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/panel-overview.jpg)

数字地球是 DeepSeek Harness（DSH）的一个插件：把 CesiumJS 三维地球放进工作区，与对话同屏。它既能让工程师浏览实景三维与高斯泼溅成果，也能让 Agent 通过自然语言读取、操控、量测和分析这套场景。CesiumJS 1.147 与界面资源随插件自托管，不需要 Cesium ion Token；影像底图、地形与在线瓦片按你选择的数据源访问网络。

## 演示

以下画面来自真实面板。示例数据为课题组自有的 LOD18 实景三维；截图不包含本机路径。头图是总览，下面按能力看细节。

**标注 / 量测：在地球上画范围、量距离，或让 Agent 用 GeoJSON 标注；坐标、面积与标注结果都留在面板里。**

![标注与量测](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/identify.jpg)

**剖面：在「三维」Tab 点「画剖面」，在地球上点起点 / 终点；分析卡给出起伏、坡度、挖填方与剖面线。**

![剖面](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/analysis.jpg)

**着色器：五个白名单预设按图层应用，例如水面、高程；工作台支持 1–3 个预设叠加、滑杆调参与原图对比。**

![着色器](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/shader.jpg)

## 功能

**数据与场景**

- 3D Tiles 1.0 / 1.1（b3dm、glb）与 3DGS（`KHR_gaussian_splatting`，含 SPZ 压缩）；多图层同时叠加，可显隐、定位、移除。
- 数据入口三种：本地目录递归扫描 `tileset.json`、`http(s)` 在线地址、本机绝对路径。路径越出已选白名单时面板弹一次授权，拒绝不重试。
- 四层图层结构：L1 地形、L2 影像底图、L3 栅格叠加（WMS / XYZ / ArcGIS）、L4 矢量叠加。
- 数据体检：资产版本、根几何误差、LOD 深度、瓦片 / 内容数、外部 tileset、`extensionsUsed`、内容缺失与包围体问题；报告落盘可追溯。
- 内置六个工具：`earth_scene`、`earth_capture`、`earth_draw`、`earth_measure`、`earth_analyze`、`earth_shader`；每次调用都会在对话里显示工具行。

**量测与标注**

- 测距、测面、测高、拾取 3D Tiles 属性；左键取点，双击结束，**Esc** 或提示条上的「结束」退出。
- Agent 可用 GeoJSON 绘制点 / 线 / 面与文字标签；绘制与量测结果留在面板，直到 `clear=true` 或从菜单清除。

**空间分析（面板 + 对话）**

- 地形分析：剖面、淹没、日照、剖切、天际线；一次只保留一个结果，结果显示为场景叠加与分析卡。
- 剖面可以手动画线：在「三维」Tab 点「画剖面」，在地球上点起点 / 终点，直接出结果；剖面卡支持挖填、坡度与 CSV / SVG 导出。
- 日照时间轴：在「三维」Tab 拖动日期 / 时间，看太阳高度与地形阴影；夜间自动给整个画面加压暗滤镜，摄影测量与地形一起变暗。
- 淹没 / 剖切 / 天际线仍由对话 Agent 执行；「空间分析」区保留可复制的示例 Prompt 与清除按钮。

**着色器预设**

- 五个白名单预设：高程渐变、等高线、扫描、水面、水深；同一图层只保留一个 shader，`preset` 可传 1–3 个预设的数组叠加。
- 工作台提供预设缩略图、目标图层提示、叠加顺序调整、滑杆调参、实时预览与原图对比；3DGS 图层用于浏览，着色器为白名单预设。

**指认与证据**

- 命中标题用中性级别（三维瓦片区域 / 瓦片内要素 / 场景表面），不编造对象名，也不给伪精度。
- 红 / 黄 / 绿三档置信度标注每条结论的来源；表面高程是采样值，高度是几何估计（邻域 24 点），未知与不确定性写进证据 JSON。

**导览与交付**

- 视角收藏与导览故事条：每站 = 一个相机视角 + 一句说明，按距离自适应飞行，拖动地球或点击别处立即接管。
- 干净截图：手动与 Agent 截图默认只保留三维画面（默认跟随面板设置，开箱为不叠加 HUD）；需要时按次传 `include_hud=true` 或打开设置开关。
- `earth_scene` 场景报告：HTML（单文件、截图内嵌）或 Markdown，写入 `$DSH_HOME/digital-earth/exports`。
- `/earth` 斜杠命令、问 Agent 场景注入、按会话恢复场景；切换会话或重启 DSH 后仍能接回上次的相机、图层与标注。

**界面**

- 双语（跟随 DSH 语言，运行时即时切换）、浅色 / 深色主题、可折叠面板。
- 图层面板两个 Tab：「地图」（地形 / 影像 / 栅格）与「三维」（矢量 / 三维内容 / 空间分析 / 日照 / 视角收藏 / 着色器）。
- 指南针：右下角随相机旋转，点击回正北。
- 坐标 HUD 约 5–6 Hz 采样；FPS 取 Cesium 真实渲染帧，场景静止 2 秒显示 `—` 而不是假的 0。
- 渲染质量两档（均衡 / 高清），当前档位与有效分辨率写入 `earth_scene status` 的 `render`。

## 快速开始

**前置条件**

- DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0`（与 `package.json` 的 `engines.dsh` 一致）。
- 支持 WebGL / WebGL2 的现代浏览器；面板是 DSH Web UI 的一部分。
- 在线底图 / 地形 / 在线瓦片需要能访问对应公共服务（例如 `server.arcgisonline.com`、`elevation3d.arcgis.com`）；离线时可用本地瓦片或关闭底图。
- 只有开发与构建需要 Node.js 22 或 24（CI 覆盖这两个版本）；运行期没有第三方依赖。

**安装**

```bash
# 从 npm 注册表安装
dsh plugin --profile <profile> add @cveo/dsh-digital-earth

# 或从本地 tgz 安装（在仓库根目录执行）
dsh plugin --profile <profile> add ./cveo-dsh-digital-earth-1.5.1.tgz
```

也可以在插件市场搜索「数字地球」。安装或更新后请**完全退出并重新打开 DSH**：客户端 bundle 在宿主启动时注册，仅刷新页面不会重新注册。随后对话标题栏会出现地球按钮，左侧栏会出现「数字地球」入口。

**加载第一个数据**

1. 点对话标题栏的地球按钮（或直接让 Agent 调用地球工具，面板会自动打开并等待连上）。
2. 打开「数据 ▾ → 打开本地目录…」选择包含 `tileset.json` 的目录；或「数据 ▾ → 加载地址或坐标…」粘贴 `http(s)` 地址 / 本机绝对路径，或输入 `经度,纬度[,高度]`（例如 `113.14,31.02,900`）直接飞到该点。
3. 目录不在白名单时，面板会请求一次授权；允许后继续，拒绝后不会自动重试。
4. 载入后即可拖动浏览；用工具栏「量测」量一条距离，或对 Agent 说「对当前图层做一次数据体检」。

五分钟验收：能看到地球、加载一个 tileset、量一条距离、让 Agent 截一张图。请使用你自己的标准 3D Tiles；示例 Prompt 可写成 `加载 D:\data\city\tileset.json，飞到城市上空并截图`（路径换成你的）。

## 使用面板

| 入口 | 作用 |
| --- | --- |
| 地球按钮 | 在对话右侧打开数字地球页签；面板工具栏只有一个真全屏入口（DOM Fullscreen，Esc 退出） |
| 数据 ▾ | 打开本地目录、重扫最近目录、加载地址或经纬度、清除 Agent 标注与量测、导出场景报告 |
| 量测 ▾ | 测距 / 测面 / 测高 / 拾取属性；左键取点，双击结束，Esc 或提示条「结束」退出 |
| 画剖面 | 在「三维」Tab 点「画剖面」，在地球上点起点 / 终点；结果直接进入分析卡 |
| 日照时间轴 | 在「三维」Tab 开启后拖动日期 / 时间，查看昼夜明暗与地形阴影变化 |
| 指认 | 点选场景对象打开选中卡：坐标、表面高程、几何高度估计、置信度，可抵近定位 / 高度量测 / 导出证据 |
| 图层 | 两个 Tab：「地图」地形 / 影像 / 栅格；「三维」矢量 / 三维内容 / 空间分析 / 日照 / 视角收藏；标题栏 ⓘ 打开独立「场景详情」浮层 |
| 着色器 | 打开工作台：选择 3D Tiles 图层与预设，调参后应用 / 重置 / 对比原图 |
| 问 Agent | 将当前视图与场景摘要附加到当前对话上下文，随后直接输入问题；上下文在下一步生效，不会自动启动空闲会话 |
| 设置 | 数据源（影像 / 地形）、外观、渲染质量、HUD 详细模式、截图叠加信息与「关于」页签 |

**加载与图层**

- 本地目录会记入 `$DSH_HOME/digital-earth/directories.json`，重启 DSH 后仍可直接加载。
- 场景按会话保存：相机、图层与显隐、Agent 标注 / 量测、活动分析、各图层着色器预设；快照在宿主侧，localStorage 只作缓存与兜底。
- 没有加载 3D Tiles 时也能打开图层面板，用来切换地形 / 底图 / 栅格叠加。

**量测与指认**

- 量测中按 **Esc** 或点提示条「结束」退出；双击结束并保留结果，再点一次同一工具可继续。
- 指认卡片用高 / 中 / 低三档置信度标注来源，证据 JSON 把每个数字标成实测 / 估计 / 推断；证据包是干净 PNG + JSON，写入 `$DSH_HOME/digital-earth/exports/`。
- 证据 JSON 带坐标、采样方法、相机、时间与不确定性；拿不到 batch 属性时只写中性标题，不编造名称。

**分析：面板 + 对话**

- 剖面：在「三维」Tab 点「画剖面」，在地球上点起点 / 终点，直接出结果；日照：在「三维」Tab 开启时间轴并拖动日期 / 时间。
- 淹没 / 剖切 / 天际线仍对 Agent 说：`对当前图层做一次淹没分析，水位 75 米`（参数换成你的）。
- 一次只保留一个分析；新的会替换旧的。「空间分析」区显示当前分析摘要，✕ 清除并移除叠加。
- 没有有效高程数据时返回可操作错误，不生成估算值。
- 剖面卡可直接切换设计基准（起终点坡线 / 最低点水平）与路宽，挖填数值即时更新；卡片里的剖面图是缩略图，点击展开大图，并在大图里直接导出 CSV / SVG。
- 日照：夜间自动给整个画面加压暗滤镜，摄影测量与地形一起变暗；白天恢复原始亮度。

**着色器工作台**

- 选图层与预设后可调参数、叠加最多 3 个预设；「实时预览」拖动滑杆静默生效，显式「应用」才写回场景。
- 已应用效果挂在图层面板的 3D Tiles 图层行上：悬停看参数，点击整行（或 ✦）载入编辑。
- 3DGS 图层用于浏览；着色器为白名单预设。

**导览与交付**

- 「视角收藏」保存当前相机视角（最多 20 条）；两站以上可「播放导览」，每站可写一句说明。
- 截图默认干净画面；报告与截图路径由工具返回，用 `present` 展示给用户。截图目录保留最近 50 张。

**数据源**

| 类型 | 内置预设 |
| --- | --- |
| 影像 | Esri World Imagery、World Topographic、World Street Map、Light Gray Canvas、World Shaded Relief、World Ocean、World Hillshade |
| 地形 | ArcGIS WorldElevation3D |

自定义数据源支持 XYZ 瓦片（含 TMS、投影、子域名、最大层级与署名）、WMS、ArcGIS MapServer、Cesium 地形服务与本地瓦片目录；选择会持久化到 `$DSH_HOME/digital-earth/sources.json`。

## Agent 工具

六个工具由 Host 注册，名称与参数是稳定契约；工具结果只报状态与路径，不伪造画面内容。分析族没有面板按钮，用对话调用 `earth_analyze` 是设计选择，不是缺失。

| 工具 | 关键参数 | 作用 |
| --- | --- | --- |
| `earth_scene` | `action`（`status` / `list` / `load` / `remove` / `visible` / `basemap` / `terrain` / `fly` / `reset` / `pick` / `inspect` / `report`）；`layer` / `path` / `url` / `visible` / `imagery` / `terrain` / `lon` / `lat` / `height` / `heading` / `pitch` / `duration` / `deep` / `format` / `title` / `include_capture` | 读写场景与图层；`fly` 默认高度 1500 m、俯仰 -45°；`inspect` 做数据体检；`report` 导出场景报告 |
| `earth_capture` | `width`（480–2560，默认 1280）、`format`（`jpeg` / `png`）、`include_hud`、`label` | 截图并返回宿主绝对路径；`include_hud=true` 才把坐标 HUD 与署名绘入图片 |
| `earth_draw` | `features`（GeoJSON 字符串）、`style`（`accent` / `alert` / `success` / `warm` / `violet`）、`label`（≤80 字符）、`clear` | 绘制点 / 线 / 面与文字标签；单次 ≤500 要素 / 20000 坐标；`clear=true` 清除此前 Agent 叠加 |
| `earth_measure` | `mode`（`distance` / `area` / `height`）、`points`（`[lon,lat]` 或 `[lon,lat,height]`，最多 200，至少 2）、`draw`、`clear` | 大地线距离、平面面积（含周长）、高差（含水平距离与坡度） |
| `earth_analyze` | `action`（`profile` / `flood` / `sunlight` / `clip` / `skyline` / `clear`）、`layer`、`from` / `to`、`samples`（8–64，默认 32）、`region`（跨度 ≤10°）、`water_height`、`grid`（4–24，默认 12）、`datetime`（1900–2200）、`show_shadows`、`height`（-1000–9000）、`keep`（`below` / `above`） | 地形分析；一次一个活动分析；无有效高程时返回错误，不猜值 |
| `earth_shader` | `action`（`apply` / `reset` / `list`）、`layer`、`preset`（5 选 1，或 1–3 个的数组）、`min_height` / `max_height`、`interval`（1–500）、`speed`、`amplitude`、`opacity`、`water_height`、`depth_max` | 白名单着色器预设（作用对象为普通 3D Tiles） |

**两个示例 Prompt**

> 加载 `D:\data\city\tileset.json`，切到影像底图，飞到场景中心并截图。

> 对当前图层做一次数据体检，把缺失内容列出来；再量一下画面中心到东北方向 300 米的高差。

**错误约定**

- 工具错误以 `[code]` 开头，并给出一条 `next:` 操作建议；按 `next:` 处理，不要重复同一个失败调用。
- 本地路径越权返回 `access_denied` 或 `access_timeout`，两者都不自动重试；需要用户在面板里重新授权。
- 分析没有高程、着色器目标不是普通 3D Tiles、面板不可见时截图，都会返回可操作的错误而不是空结果。

| `/earth` 命令 | 作用 |
| --- | --- |
| `/earth status` | 相机、图层、底图 / 地形与 Agent 叠加数量的一屏摘要 |
| `/earth capture [label]` | 截图并返回宿主绝对路径，可带一个标签 |
| `/earth report [html\|markdown]` | 导出场景报告并返回宿主绝对路径，默认 HTML |
| `/earth clear` | 清除 Agent 绘制的标注与量测 |
| `/earth open` | 打开指引：下一次地球工具调用会自动打开，或点对话标题栏地球按钮 |
| `/earth` | 显示用法 |

命令结果只留在命令气泡里，不写入模型上下文；面板未连接时返回命令错误而不是模型消息。

## 数据与安全

**标准 3D Tiles 契约**

- 只接受标准 3D Tiles 1.0 / 1.1：根瓦片必须自带世界定位（`root.transform` 或 `root.boundingVolume.region`）。
- 插件不做隐式改写：Cesium 拿到的字节永远等于磁盘上的字节；嵌套外部 tileset 由父级根变换负责，不重复叠加。

**缺世界定位的诊断**

- 症状：数据坍缩到地心附近、`flyTo` 钻进地核、瓦片在视锥里反复闪现。这不是渲染故障。
- 数据体检会报 `tileset_not_georeferenced` 并说明修法：在导出时写入根 `transform` / `region`。
- 存量 OSGB 转换数据可用 `scripts/georef-osgb.mjs` 一次性补根 `transform`：默认 dry-run，`--apply` 先备份 `tileset.json.bak`，支持 CGCS2000 高斯-克吕格 EPSG 4491–4554。插件运行时仍不读取 sidecar、不改写数据。

**本地数据**

- 只有通过面板打开过的目录（或用户一次性授权的目录）才会被 `/tiles` 提供；白名单、真实路径与根目录校验都在宿主侧。
- Agent 可传本机绝对路径；越出白名单时宿主向面板发起一次授权请求，30 秒未处理返回 `access_timeout`。
- 插件不上传数据、不主动外联；网络请求只发生在你选择的影像、地形与在线瓦片服务上。

**访问控制与代理**

- 所有路由绑定 DSH `connection` 会话、同源校验与插件实例 token；token 只下发给页面，不出现在任何工具结果里。
- `/remote` 代理拒绝字面量 loopback / 私网地址与 3xx 重定向，转发查询串（上限 2048 字符；超限 400，控制字符或非法编码 403）。
- 代理不做 DNS 解析：域名解析到内网地址的场景仍可能绕过，详见「常见问题」。

**输出与保留**

- 截图 `$DSH_HOME/digital-earth/captures` 保留最近 50 张；体检报告保留最近 100 份。
- 场景报告与证据包共享 `$DSH_HOME/digital-earth/exports` 的最近 200 份配额。
- 场景快照每会话一份、原子写入、单份上限约 512 KB，最多保留最近 50 个会话。

## 工作原理

宿主侧负责数据与服务，客户端侧负责 Cesium 画面与面板；两侧通过带 token 的 SSE 命令桥通信。`client.js` 是 `src/client/**` 的构建产物，不手改。

<pre>
Host (Node)                                   Browser (DSH Web UI)
+------------------------------+   commands   +---------------------------+
| index.js   inject / apply    | -----------> | src/client/**  -> client.js|
| src/host/tools/* (6 tools)   |              | CesiumJS + panel          |
| routes / bridge / storage    | <----------- | (vendor/cesium, bundled)  |
+------------------------------+   acks/data  +---------------------------+
</pre>

- **Host**：`index.js` 只做 `inject` / `apply` 与公开 re-export；实现按职责拆在 `src/host/**` 的 28 个模块里（路由、命令桥、体检、存储、六个工具、`/earth` 命令）。
- **Client**：`src/client/**` 的 53 个模块经 esbuild 打包成单一 `window.__ModuleLoader__` 产物；按需动态 `import()` 自托管 CesiumJS，声明侧栏页签与工具行。
- **CesiumJS**：`vendor/cesium` 随插件分发，无 CDN、无 Cesium ion Token。
- **发布**：tag-only + GitHub Actions OIDC。本地 `npm run release:check` 只读自检版本单源、产物一致性与打包清单，不 tag / push / publish。

## 常见问题

- **支持哪些数据？** 标准 3D Tiles 1.0 / 1.1（b3dm、glb）与 3DGS（含 SPZ）；本地目录、在线地址、本机绝对路径都可以加载。
- **3DGS 能做什么？** 高斯泼溅图层可以浏览、定位、显隐和移除；分析与着色器面向普通 3D Tiles。
- **为什么截图里没有 HUD？** 手动与 Agent 截图默认只保留三维画面；按次传 `include_hud=true`，或打开「设置 → 截图时叠加坐标 HUD 与署名」。
- **画面黑屏或模型落在地心？** 先做数据体检，确认根瓦片带 `transform` 或 `region`；补上世界定位后重新加载即可。
- **数据会上传吗？** 不会；插件只读取本机文件和你选择的在线数据源。
- **分析按钮在哪？** 剖面和日照在「三维」Tab：画剖面 + 日照时间轴；淹没 / 剖切 / 天际线通过对话调用 `earth_analyze`。
- **截图和报告保存在哪？** 截图目录只保留最近 50 张，报告 100 份，导出 200 份；具体路径由工具返回。
- **性能大概怎样？** 取决于显卡、窗口尺寸与数据量，建议用实际数据试。

## 路线图

以下是讨论中的方向，不构成版本承诺；具体排期以 Issue 为准。

- **数据安全**：`/remote` 代理补 DNS 解析后的二次校验，收紧不可信网络下的边界。
- **大数据体验**：更大瓦片集的加载与拖动体验、缓存与质量档的继续调优。
- **交付格式**：更多分析结果的导出形态，以及报告 / 证据包的自动化工作流。
- **文档与示例**：更完整的接入示例、常见数据转换流程与排错手册。

## 参与贡献

欢迎通过 [Issues](https://github.com/CVEO/dsh-digital-earth/issues) 报问题或提建议；开发、构建、测试与发布流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。提交 PR 时请保持六个工具的名称、参数与 action 集合不变，新增能力优先做面板侧或新增可选参数。

## 致谢与许可

**致谢**

- CesiumJS 1.147 以 Apache-2.0 分发并随插件自托管；第三方声明见 [NOTICE](NOTICE)。
- DeepSeek Harness 提供的插件运行时、命令桥与工具调用界面。
- 示例数据：课题组自有的 LOD18 实景三维；3DGS 样例 Svirnas Alyt 来自 WilliamLiu 的 3D-Tiles-RendererJS-3DGS-Plugin（Apache-2.0）。
- 影像与地形：运行期访问的 ArcGIS 公共服务，版权归各自提供方。

**团队与许可**

由**武汉大学 CVEO 课题组**维护 · <https://www.whu-cveo.com/>

本项目以 MIT 许可发布，完整文本见 [LICENSE](LICENSE)；第三方许可见 [NOTICE](NOTICE)。
