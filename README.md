<div align="center">

# 数字地球 · Digital Earth

**在 CesiumJS 地球上叠加 3D Tiles / 3DGS 图层，并与 Agent 对话协同的 DeepSeek Harness 面板**

[中文](README.md) · [English](README.en.md)

![版本](https://img.shields.io/badge/版本-1.6.0-4f8cff)
![许可](https://img.shields.io/badge/许可-MIT-2ea44f)
![平台](https://img.shields.io/badge/平台-Web-8b5cf6)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.1--rc.1-0ea5e9)

</div>

![预览](preview.png)

数字地球是一个 DSH 插件：把 CesiumJS 三维地球嵌入工作区，既能与对话同屏浏览实景三维与高斯泼溅成果，也能让 Agent 通过自然语言直接读取、操控场景。自托管 CesiumJS 1.147，不依赖 Cesium ion Token，不请求外网静态资源。

## 功能

| 能力 | 说明 |
| --- | --- |
| 对话同屏 | 右侧边栏的「数字地球」页签与对话并排显示；Agent 调用地球工具时自动打开并等待连上；对话标题栏的地球按钮可随时打开，也可切到全屏沉浸模式 |
| Agent 协同 | 内置六个工具：`earth_scene` 读取与操控场景、`earth_capture` 截图、`earth_draw` 标注、`earth_measure` 量测、`earth_analyze` 地形分析、`earth_shader` 着色器预设；六个工具调用都会显示工具行，用自然语言即可驱动 |
| 实景三维叠加 | 本地目录递归扫描 `tileset.json`；3D Tiles 1.0 / 1.1（b3dm、glb）与 3DGS（`KHR_gaussian_splatting`，含 SPZ 压缩）；多图层同时叠加、显隐 / 定位 / 移除 |
| 在线与本地路径 | 直接粘贴 `http(s)` 地址或本机绝对路径；本机路径不在已选目录时，面板会弹窗一次性授权，允许后登记目录并继续；跨域失败自动回退到宿主代理 |
| 标准数据契约 | 只接受标准 3D Tiles 1.0 / 1.1：根瓦片必须自带世界定位（`root.transform` 或 `boundingVolume.region`）。缺世界定位的数据不会被静默改写，而是在数据体检中报 `tileset_not_georeferenced`，请重新导出时写入根 `transform` / `region` |
| 影像底图 | 内置多个 Esri 底图预设，可自定义 XYZ（TMS、投影、子域名、最大层级）/ WMS / ArcGIS 服务；无底图模式也完整可用 |
| 地形 | 内置 ArcGIS WorldElevation3D，可接入任意 Cesium / ArcGIS 地形服务 |
| 本地瓦片 | 直接把本地 XYZ / TMS 瓦片目录添加为底图，离线可用 |
| 数据源管理 | 设置面板内增删改、单选启用、恢复默认，配置持久化到 `$DSH_HOME/digital-earth/sources.json` |
| 显示三态与地形遮挡 | 停靠侧栏 / 主区域 / **真全屏**（DOM Fullscreen，Esc 退出）三态；「地形遮挡三维图层（深度测试）」开关默认关闭，地下管网与埋在地形下的模型都能看见，开启后地形会遮挡埋在下面的内容 |
| 渲染质量档 | 设置 → 外观可选「均衡（默认，流畅优先）」或「高清（画质优先）」：均衡降低渲染分辨率与地形 / 瓦片 LOD、加大地形缓存，拖动更稳；高清回到满分辨率与 Cesium 默认 LOD。切换即时生效，抗锯齿档位在重新打开面板后完全生效；当前档位与有效分辨率进 `earth_scene status` 的 `render` |
| 坐标 HUD | 光标经纬度 + 高程；裸地球、地形、模型三种情形均可用，约 5–6 Hz 采样，拖动时暂停、停手后补一次，不触发重渲染；FPS 取 Cesium 真实渲染帧（`scene.postRender`），场景静止 2 秒显示 `—` 而不是假的 0 |
| 量测与工具 | 测距、测面、测高、拾取 3D Tiles 属性、截图、复位视角 |
| 地形分析 | `earth_analyze`：剖面（含 SVG 剖面卡）、淹没、日照三类分析一次只保留一个；结果以地图叠加与数值返回，清除时移除叠加，日照分析还会恢复进入前的光照 / 阴影状态 |
| 着色器预设 | `earth_shader`：高程渐变、等高线、扫描、水面四个白名单预设，按图层应用 / 重置 / 列出；3DGS 不支持，不接受自定义 GLSL |
| 可折叠面板 | 图层面板与坐标 HUD 可从工具栏收起 / 展开，图层卡标题栏也可收起；设置中的显示开关持久化 |
| 干净截图 | 手动与 Agent 截图默认只保留三维画面；需要时按次传 `include_hud` 或打开设置开关，把坐标 HUD 与团队署名绘入图片 |
| 图层统计 | 每层瓦片数、待加载数、三角面数、缓存占用；全局 FPS 与相机高度 / 朝向 |
| 数据体检 | 图层行一键静态体检 `tileset.json`：资产版本、根几何误差、LOD 深度、瓦片 / 内容数、外部 tileset、`extensionsUsed`、内容缺失与包围体问题；报告落盘可追溯，Agent 也可通过 `earth_scene` 触发 |
| 双语 | 跟随 DSH 语言，中文 / English 运行时即时切换 |
| 主题 | 跟随 DSH 或系统；可显式选择浅色 / 深色，仅作用于本面板 |

## 环境要求

- DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0`
- 支持 WebGL / WebGL2 的现代浏览器
- 中国大陆网络可直接访问 ArcGIS 公共服务（`server.arcgisonline.com`、`elevation3d.arcgis.com`）

## 安装

在插件市场中搜索「数字地球」，或使用命令行：

```bash
# 从 npm 注册表安装
dsh plugin --profile <profile> add @cveo/dsh-digital-earth

# 从本地目录 / 打包文件安装
dsh plugin --profile <profile> add "<path-to-plugin>"
dsh plugin --profile <profile> add "./cveo-dsh-digital-earth-1.6.0.tgz"
```

安装或更新后请**完全退出并重新打开 DSH** 一次：客户端 bundle 在宿主启动时注册，仅刷新页面不会重新注册。随后左侧栏出现「数字地球 / Digital Earth」入口，对话标题栏也会出现地球按钮。

## 使用

| 入口 | 作用 |
| --- | --- |
| **对话标题栏地球按钮** | 在对话右侧打开地球页签（对话同屏）；页签工具栏还提供真全屏 |
| **问 Agent** | 地球页签工具栏按钮（仅会话页签内显示）：尽力截取当前画面并把场景摘要注入当前对话的 Agent，随后直接输入问题即可；不会唤醒空闲 Agent |
| **数据 ▾** | 打开本地目录（递归扫描 `tileset.json`）、从「最近打开」重扫上一次的目录、加载在线地址 / 本机绝对路径（越出已选目录时弹窗一次性授权所在目录）、清除量测与拾取结果、导出场景报告（HTML）；存在 Agent 标注时显示「清除 Agent 标注」 |
| **量测 ▾** | 测距、测面、测高、拾取属性；左键取点，双击结束 |
| **图层 n** | 统一图层面板（v1.6）：**L1 地形**、**L2 影像底图**、**L3 栅格叠加**（WMS/XYZ/ArcGIS，多实例，透明度/显隐/排序/移除，面板内可直接添加）、**L4 矢量叠加**（Agent 标注与量测数量 + 清除）、**三维内容层**（定位 / 显隐 / 数据体检 / 移除）；没有加载 3D Tiles 时也能打开 |
| **图层 / 坐标 HUD** | 工具栏按钮可收起 / 展开图层面板与坐标 HUD；设置中的显示开关会持久化 |
| **着色器** | 工具栏着色器按钮打开工作台：选择可见 3D Tiles 图层与四个白名单预设，按预设设置参数后应用 / 重置 |
| **外观** | 跟随系统 / 浅色 / 深色 |
| **设置** | 数据源管理（影像 / 地形）、外观（含「Agent 调用时自动打开」「显示图层卡」「显示坐标 HUD」开关）、截图叠加信息开关与「关于」页签（版本、GitHub 仓库与 Issues、团队） |

鼠标坐标按约 5–6 Hz 采样，拖动视角时暂停、停手后补一次：射线与椭球求交保证裸地球也有经纬度；命中 3D Tiles / 3DGS 时用深度缓冲取模型表面高程；有地形时用 `globe.getHeight` 校正。HUD 文本直接写入 DOM，不触发 React 重渲染；隐藏 HUD 后停止指针采样。

## 与 Agent 协作

Agent 调用地球工具时，插件会自动在对话右侧打开地球页签，并等待它连上（最多约 8 秒），不需要先手动打开；用户通过面板选过的本地目录会被记住，重启 DSH 后仍可直接加载。面板通过 SSE 命令桥接入当前对话的 Agent，模型即可用自然语言读写场景。Agent 也可直接传本机绝对路径，路径越出已选目录时由面板弹窗请求一次授权。六个工具调用都会在对话中显示工具行；Agent 侧提供六个工具，也可以用 `/earth` 斜杠命令直接操作面板（不产生模型回合）：

| 工具 | 参数 | 作用 |
| --- | --- | --- |
| `earth_scene` | `action`（`status` / `list` / `load` / `remove` / `visible` / `basemap` / `terrain` / `fly` / `reset` / `pick` / `inspect` / `report`） | 读取场景状态与图层统计；加载 / 移除 / 显隐图层；切换底图与地形；飞到指定经纬度；拾取画面中心对象；数据体检（`layer` / `path` / `url` 三选一，`deep` 可选）；导出场景报告（`format` / `title` / `include_capture`） |
| `earth_capture` | `width`、`format`、`include_hud`、`label` | 生成截图并返回宿主绝对路径；默认只保留干净三维画面，`include_hud=true` 时把坐标 HUD 与团队署名直接绘入图片 |
| `earth_draw` | `features`（GeoJSON 字符串：要素集合、单个要素或裸几何）、`style`（`accent` / `alert` / `success` / `warm` / `violet`）、`label`、`clear` | 绘制点 / 多点、线 / 多线、面 / 多面与文字标签，要素 `properties.name` 作为逐要素标签；单次最多 500 个要素 / 20000 个坐标，`clear=true` 清除此前 Agent 绘制的全部叠加；返回要素数与包围盒 |
| `earth_measure` | `mode`（`distance` / `area` / `height`）、`points`（`[lon,lat]` 或 `[lon,lat,height]`，最多 200 个）、`draw`、`clear` | 大地线距离、平面面积（含周长）、高差（含水平距离与坡度）；默认把量测绘到地球上，`draw=false` 只返回数值；结果 JSON 以米 / 千米给出 |
| `earth_analyze` | `action`（`profile` / `flood` / `sunlight` / `clear`）、`layer`、`from` / `to`、`samples`、`region`、`water_height`、`grid`、`datetime`、`show_shadows` | 地形分析：剖面（长度、起伏 / 爬升 / 下降与采样点，面板显示 SVG 剖面卡）、淹没（面积、淹没比与水深）、日照（太阳高度角 / 方位角，切换光照与阴影）与清除；一次只保留一个活动分析，默认取最上面的可见 3D Tiles 图层；无可用高程时返回错误，不猜测数值 |
| `earth_shader` | `action`（`apply` / `reset` / `list`）、`layer`、`preset`（`height-false-color` / `contour` / `scan` / `water`）、`min_height` / `max_height`、`interval`、`speed`、`amplitude`、`opacity` | 为单个 3D Tiles 图层应用 / 重置白名单着色器预设，或列出当前活动预设；同一图层只保留一个 shader，参数按预设严格校验；3DGS 图层不支持，也不接受自定义 GLSL |

| `/earth` 命令 | 作用 |
| --- | --- |
| `/earth status` | 相机、图层、底图 / 地形与 Agent 叠加数量的一屏摘要 |
| `/earth capture [label]` | 截图并返回宿主绝对路径，可带一个标签 |
| `/earth report [html\|markdown]` | 导出场景报告并返回宿主绝对路径，默认 HTML（自包含，截图内嵌） |
| `/earth clear` | 清除 Agent 绘制的标注与量测叠加 |
| `/earth open` | 打开指引：下一次地球工具调用会自动打开，或点对话标题栏的地球按钮 |
| `/earth`（不带参数） | 显示用法 |

命令结果只保留在命令气泡里，不写入模型上下文；面板未连接时返回命令错误而不是模型消息。

- **问 Agent**：工具栏的「问 Agent」按钮把当前场景（相机、图层与显隐、底图 / 地形、Agent 标注 / 量测、活动地形分析、各图层着色器预设，以及尽力截取的截图路径）整理成一段有界文本，经宿主带 token 的注入路由送进当前对话的 Agent；上下文落在下一个被接纳的步骤上，且不会唤醒空闲 Agent，随后直接输入你的问题即可。文本上限 4000 字符、请求体上限 16 KiB，注入的是上下文行而非用户消息，也不含实例 token；Agent 未运行或宿主没有 Agent 运行时，分别以 409 / 503 返回可操作的 toast 错误。
- **Agent 标注与量测**：`earth_draw` / `earth_measure` 的绘制结果留在面板里，直到用工具传 `clear=true` 或从「数据 ▾ → 清除 Agent 标注」清除；`earth_scene` 的 `status.annotations` 报告当前 Agent 绘制的要素数、量测点数与叠加对象数。
- **场景保持**：切换会话 / 窗口或面板被右侧栏回收后，重新打开地球页签（或下一次 Agent 调用自动打开）会按会话恢复相机视角、已加载图层（按原始本地路径或在线地址重新加载）、图层显隐、Agent 标注 / 量测、当前地形分析结果与各图层的着色器预设；快照优先存放在宿主的 `$DSH_HOME/digital-earth/scenes`（每会话一份、原子写入、单份上限约 512 KB、最多保留最近 50 个会话，经面板专用带 token 路由读写，不进入任何工具结果），本机浏览器 localStorage 只作快速缓存与兜底，因此重启 DSH 或页面地址 / 端口变化后仍能恢复；底图与地形沿用数据源设置。
- **截图叠加信息**：面板工具栏与 HUD 是网页 DOM 元素，本身无法与 WebGL 画面一起导出；截图默认只保留干净三维画面，Agent 截图可按次传 `include_hud=true`，或打开「设置 → 截图时叠加坐标 HUD 与署名」作为默认，插件会把光标坐标、相机参数和团队署名重绘到图片画布上，手动截图与 Agent 截图都生效。
- **本地数据**：Agent 可直接加载面板「数据 → 打开本地目录」里选过的目录，也可直接传本机绝对路径。路径越出白名单时，宿主会先向面板发起一次授权请求；用户允许后先把所在目录登记为本地数据源，再继续原加载 / 体检。拒绝返回 `access_denied` 且不自动重试，30 秒未处理返回 `access_timeout`；白名单、真实路径与根目录校验不变，命令桥与工具结果不暴露实例 token，模型无法自行扩大可读范围。选过的目录会记入 `$DSH_HOME/digital-earth/directories.json`，重启 DSH 后仍可直接加载。
- **标准数据契约**：只接受标准 3D Tiles 1.0 / 1.1，根瓦片必须自带世界定位（`root.transform` 或 `root.boundingVolume.region`）。不少 OSGB 转换工具只写局部坐标——根节点没有 `transform`/`region`，原点写在同级 `tileset_info.json` 里；这类数据在 v1.5 起**不再被插件代偿**：宿主原样返回文件字节，数据体检会报 `tileset_not_georeferenced` 错误并说明症状（数据坍缩到地心附近、`flyTo` 钻进地核、瓦片在视锥里反复闪现）。修复方式是在转换时写入根 `transform` 或 `region`，插件不做隐式改写，因此「Cesium 拿到的字节」永远等于「磁盘上的字节」。嵌套外部 tileset 由父级 `tileset.json` 的根变换负责，插件不重复叠加。
- **地形分析**：`earth_analyze` 一次只保留一个活动分析，新分析替换旧分析；剖面返回长度、起伏 / 爬升 / 下降与采样点并显示 SVG 剖面卡，淹没返回面积、淹没比与水深，日照切换光照与阴影，`clear` 移除分析叠加并在日照分析后恢复进入前的光照 / 阴影 / 时钟状态。没有有效高程数据时返回可操作错误，不猜测数值。
- **着色器预设**：`earth_shader` 的预设固定为高程渐变、等高线、扫描、水面四种，按图层应用 / 重置 / 列出；同一图层只保留一个 shader，参数按预设严格校验。3DGS 图层不支持该能力，模型与面板都不能注入自定义 GLSL。
- **场景报告**：直接说「导出当前场景报告」即可调用 `earth_scene` 的 `report`；面板「数据 ▾ → 导出场景报告」或聊天里的 `/earth report [html|markdown]` 也能导出。报告包含相机、图层与显隐、底图 / 地形、Agent 标注与量测数值、活动地形分析、着色器预设和尽力截取的截图：HTML 是单文件（截图 base64 内嵌、内联样式），Markdown 以图片链接引用截图；文件写入 `$DSH_HOME/digital-earth/exports`（保留最近 200 份），工具会返回绝对路径并提示用 `present` 打开。
- **截图与多模态**：截图保存到 `$DSH_HOME/digital-earth/captures`；对话中的 `earth_capture` 工具行会显示一张可点击的小缩略图，链接到完整截图——图片地址由页面元数据拼装并受实例 token 保护，模型侧仍只看到文件路径。支持图像解译的多模态模型可用 `read_image` 读取返回路径；不支持视觉的模型则退回 `earth_scene` 的 `status` JSON，不编造画面内容。
- **数据体检**：对当前图层说「做一次数据体检」即可；`layer` 模式由面板解析原始来源并附加运行统计，`path` / `url` 模式在面板未打开时也能体检。报告写入 `$DSH_HOME/digital-earth/reports`（保留最近 100 份），工具只返回摘要与 `report_path`，需要细节时再读文件。
- **示例**：「打开数字地球，切到影像底图，飞到武汉大学并截图」；「加载我刚才选过的那个数据目录里的 tileset」；「把第二个图层隐藏，再报告当前相机高度」；「对当前图层做数据体检，看看有没有内容缺失」；「把这三个点连成一条路线并标注名称，然后截图」；「量一下这两个点的高差、水平距离和坡度」；「从起点到终点做一条地形剖面」；「给当前图层套上等高线」。

## 数据源

内置预设均为免 Token 的 ArcGIS 公共服务，可在设置中一键启用：

| 类型 | 预设 |
| --- | --- |
| 影像 | Esri World Imagery、World Topographic、World Street Map、Light Gray Canvas、World Shaded Relief、World Ocean、World Hillshade |
| 地形 | ArcGIS WorldElevation3D |

自定义数据源支持：

- **XYZ 瓦片**：`{z}/{x}/{y}` 模板、TMS（Y 轴南起）、Web 墨卡托 / 地理坐标、子域名、最大层级、版权署名
- **WMS**：服务地址 + 图层名
- **ArcGIS**：MapServer 地址（自动读取层级信息）
- **Cesium 地形**：地形服务地址，可选请求法线 / 水面掩膜
- **本地瓦片目录**：在 XYZ 表单中直接选择目录，插件通过宿主白名单提供瓦片

选中的底图与地形随配置持久化，换端口或重开 DSH 都不会丢失。

## 工作原理

- **宿主侧**（`index.js` 入口 + `src/host/**`）：注册 `/api/3dviewer/*` 路由，负责 Cesium 静态资源、本地目录扫描与白名单、最近打开目录记录、会话场景快照（`$DSH_HOME/digital-earth/scenes`）、瓦片服务、跨域代理、数据源配置读写，以及六个 Agent 工具、`/earth` 斜杠命令和 session 级命令桥。v1.5 起入口只有 `inject`/`apply` 与公开 re-export，实现按职责拆在 27 个模块里（路由、桥、体检、存储、工具各自独立）。
- **客户端**（`src/client/**` → `client.js` 产物）：作为 DSH 客户端模块加载，声明 `sidebar.panellist`、`main` 与右侧边栏页签，按需动态 `import()` 自托管 CesiumJS；页签内面板用 `EventSource` 连接命令桥，串行执行 Agent 指令并回执。源码拆在 22 个模块，由 esbuild 打包成单一 `window.__ModuleLoader__` 产物（`npm run build:client`）；`client.js` 是构建产物，CI 会校验它与源码一致，请勿手改。
- **Agent 命令桥**：`GET /api/3dviewer/bridge?session=…` 推送命令，`POST /api/3dviewer/bridge` 回执；同一会话只由最新打开的那个地球页签执行命令，避免重复加载；截图经 `POST /api/3dviewer/capture` 落盘，再由 `/api/3dviewer/files` 回读；数据体检经 `POST /api/3dviewer/inspect` 分析并写入报告目录。
- **安全**：所有路由绑定 DSH `connection` 会话与同源校验，并带插件实例 token（只下发给页面，不出现在任何工具结果里）；`/tiles` 仅服务经文件选择器加入白名单的目录，Agent 加载本地路径同样受该白名单约束，且会校验真实路径；白名单注册端点 `/scan` 只接受面板自身的请求头，模型无法借 Cesium 发同源 GET 间接触发；`/inspect` 同样要求面板请求头，本地路径走白名单 + 真实路径，远程 URL 复用 `/remote` 规则；`/remote` 代理拒绝字面量 loopback / 私网地址与 3xx 重定向，避免直接 SSRF；代理不做 DNS 解析，若域名解析到内网可能绕过（见已知限制）。插件不上传数据、不主动外联。
- **自托管 CesiumJS**：`vendor/cesium` 随插件分发，无 CDN、无 Cesium ion Token。

## 已知限制

- 同一会话若在多个浏览器标签页里打开地球页签，只有最新连接的那一个会执行 Agent 命令，其余页签保持只读展示。
- 地形分析依赖已加载的 3D Tiles 或地形高程；数据未加载或没有有效采样点时返回错误，不生成估算值，同一时间只保留一个分析结果。
- 着色器预设只作用于普通 3D Tiles，3DGS 图层会返回错误；四种预设仅做外观表达（水面波纹不是真实折射），不接受自定义 GLSL。
- 地形开启时拖动视角的帧率取决于显卡、窗口尺寸与数据量；本机真实 GPU 浏览器实测约 30 FPS，不作为固定帧率承诺，headless / SwiftShader 数值不代表实际体验。
- Agent 截图要求地球页签可见：切到其他页签或窗口在后台时会返回「面板不可见」提示，而不是生成空白图。
- 截图目录只保留最近 50 张，体检报告只保留最近 100 份，场景快照按会话只保留最近 50 个，避免长期使用后无限增长。
- `/remote` 代理已透传查询串（长度上限 2048 字符，超限 400，控制字符与非法编码 403），WMS / WMTS / 带签名参数的瓦片可直接经代理加载；体检会读取外部 `tileset.json`（本地与远程最多 50 个），远程 `deep` 模式只检查根瓦片内容，本地 `deep` 模式最多检查 200 个内容文件。
- `/remote` 代理按字面量判断内网地址、不做 DNS 解析；在不可信网络里请勿把它暴露给不可控的模型 / 用户组合，后续版本会补 DNS 解析与解析后校验。
- 在线 Esri 服务在部分网络环境可能不可达，此时底图会显示为空白，可切换为本地瓦片数据源。

## 目录结构

```text
dsh-digital-earth/
├── index.js            # 宿主入口：inject/apply + 公开 re-export（≤80 行）
├── src/host/           # 宿主实现：路由、命令桥、体检、存储、六个工具、/earth 命令
├── src/client/         # 客户端源码：场景面板、工具栏、对话框、着色器/分析、i18n
├── client.js           # 客户端产物（由 npm run build:client 生成，勿手改）
├── scripts/            # build-client（esbuild 打包）与 check-size（架构预算门禁）
├── docs/               # 审计、冻结需求、方向与协议调研、交付验证清单（不随包发布）
├── test/               # 模块单测 / 契约测试 / 产物冒烟
├── cordis.patch.yml    # bundle 补丁
├── locale/             # 插件市场元数据（中 / 英）
├── vendor/cesium/      # 自托管 CesiumJS 1.147
├── icon.svg
└── preview.png
```

## 反馈与贡献

欢迎通过 [Issue](https://github.com/CVEO/dsh-digital-earth/issues) 报告问题或提出建议。提交前请确保 `node --check index.js && node --check client.js` 通过。

## 团队

由 **武汉大学 CVEO 课题组** 维护 · <https://www.whu-cveo.com/>

## 许可

MIT。CesiumJS 以 Apache-2.0 分发，第三方声明见 [`NOTICE`](NOTICE)。
