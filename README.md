<div align="center">

<img src="icon.svg" width="76" height="76" alt="数字地球图标">

# 数字地球 · Digital Earth

**数字地球是运行于 DeepSeek Harness 的三维场景插件，用于浏览、量测与分析 3D Tiles / 3DGS 数据，并允许 Agent 直接读写当前场景。**

武汉大学 CVEO 课题组出品 · 面向三维城市、实景三维与多模态对地观测数据的三维交互组件

[中文](README.md) · [English](README.en.md) · [更新日志](CHANGELOG.md) · [许可](LICENSE)

![版本](https://img.shields.io/badge/版本-1.6.0-4f8cff)
![许可](https://img.shields.io/badge/许可-MIT-2ea44f)
![DSH](https://img.shields.io/badge/DSH-插件-0ea5e9)
[![npm downloads](https://img.shields.io/npm/dm/@cveo/dsh-digital-earth?label=npm%20downloads&color=cb383f)](https://www.npmjs.com/package/@cveo/dsh-digital-earth)

<img src="assets/readme/hero.jpg" alt="数字地球面板：法国克莱蒙费朗老城与大教堂（CRAIG 公开 3D Tiles，数据集中心约 45.7944°N, 3.1676°E）" width="78%">

</div>

打开 DSH 并进入数字地球后，对话右侧会显示三维场景面板。加载本地或在线的 3D Tiles / 3DGS 数据后，可在对话过程中浏览、量测与执行空间分析；Agent 也可直接读写场景、添加标注、截图并导出报告。

三维引擎与界面资源随插件分发，无需额外的 GIS 服务端；本地图层无需上传，在线底图与地形按所选数据源访问。主动使用 AI 辅助圈选时，当前截图会发送给所选模型并存为宿主附件。

<p align="center"><img src="assets/readme/split-view.jpg" alt="DSH 对话与数字地球分屏：左侧对话、右侧三维场景与工具面板（真实运行截图）" width="92%"></p>
<p align="center"><sub>DSH 对话与数字地球分屏：左侧对话，右侧三维场景、图层与工具面板</sub></p>

## 快速开始

**最简单的安装方式**：打开桌面版 DeepSeek Harness，点击右上角「插件」，在插件市场搜索框输入完整包名 `@cveo/dsh-digital-earth`，选择「数字地球」安装即可；安装完成后按第 1 步重启 DSH。

也可以在终端通过 npm 或本地 `.tgz` 安装（`--profile` 为必填参数，用来指定插件安装到哪个 DSH 配置环境，默认目录为 `~/.dsh/profiles/`，Windows 为 `%USERPROFILE%\.dsh\profiles\`，也可通过 `DSH_HOME` 指定；Windows 终端若未将 `dsh` 加入 `PATH`，可直接调用 DSH 安装目录下的 `resources\runtime\cli\bin\dsh.cmd`）：

- **桌面端应用（最常用）**：`--profile desktop`（对应 DeepSeek Harness 桌面客户端）
- **Web 端服务**：`--profile web`（对应 `dsh web` 启动的浏览器端界面）
- **自定义配置**：把 `desktop` 替换为你的配置名称即可

```bash
# 安装到 DSH 桌面端（npm）
dsh plugin --profile desktop add @cveo/dsh-digital-earth

# 安装到 DSH Web 端（dsh web，npm）
dsh plugin --profile web add @cveo/dsh-digital-earth

# 从本地构建包安装（桌面端示例；Web 端把 desktop 改为 web）
dsh plugin --profile desktop add ./cveo-dsh-digital-earth-1.6.0.tgz
```

1. 完全退出并重新打开 DSH 桌面端，或重启 `dsh web` 服务（客户端 bundle 在启动时注册，仅刷新页面不够）。
2. 在开始页点击「数字地球」卡片，或在对话标题栏点地球按钮，打开右侧「数字地球」页签。
3. 数据 ▾ → 打开本地目录，选择包含 `tileset.json` 的文件夹；或粘贴在线地址 / 输入经纬度直接飞过去。

加载数据后，可直接向 Agent 发出指令：

> 加载刚打开目录里的 tileset.json，飞到场景中心，量一下两栋楼的距离，再截一张图。

首次访问未授权目录时，面板会请求一次授权；授权后该目录可直接加载。

## 三分钟上手：照着说就行

不需要记工具名，也不用写经纬度。加载示例数据后，可以直接对 Agent 说下面任意一句；也可以直接用面板操作。

| 你只要说 / 做 | 插件会自动完成 | 你会看到 |
| --- | --- | --- |
| 「把当前画面里的建筑按高度上色，然后截一张图」 | 应用高程渐变视觉特效，再执行干净截图 | 彩色建筑画面；回复给出截图路径与相机位置 |
| 「截一张当前视角的干净图，并告诉我相机在哪」 | 截图并读取相机经纬度、高度、朝向、俯仰与可见图层 | 只有三维画面的图片，图片旁有同名 JSON sidecar |
| 「生成当前场景的 Markdown 报告」 | 汇总图层、相机、量测、分析与截图 | 报告路径，以及可继续转发的 Markdown / HTML |
| 直接单击画面中的建筑或地面 | 默认识别：读取命中图层、坐标、表面/几何高程与属性 | 识别卡与对象属性；可「框选此点周围」生成 15 m 近似选区 |
| 工具 → 矩形框选 → 拖框 → 输入「这里主要有哪些建筑和植被？」 | 保存当时的画面与选区，发送到当前对话 | 对话区回答；选区可量测、导出 GeoJSON 或做淹没分析 |
| 工具 → AI 圈选 → 单击目标 | 截图交给视觉模型，反投影为可见表面近似轮廓 | 可确认采用的近似选区；需要默认模型支持图片输入 |

> 想直接截图：推荐先做第一行「按高度上色」，右侧画面变化明显，适合作为 README 首图。

## 核心能力

- **场景浏览**：叠加多份 3D Tiles / 3DGS，支持显隐、定位与属性指认；图层面板只管理数据——「三维」放地形与 3D Tiles/3DGS，「地图」放影像、栅格与矢量；量测、剖面、日照、分析、视觉特效与视角收藏收进独立「工具」卡，可折叠面板，右下角指南针点击回正北。
- **量测与指认**：距离、面积、高差，以及在地球上直接拖拽框选地面区域得到面积/周长/边界高程并导出 GeoJSON；量测结果与标注保留在面板中；坐标 HUD 约 5–6 Hz 采样，指认卡给出表面高程与几何高度估计。
- **空间分析**：三维剖面、淹没、日照、剖切、天际线，一次只保留一个分析；结果叠加在场景中，并写明高程来源（3D Tiles 地表或地形）。
- **成果交付**：干净截图（手动与 Agent 截图默认只保留三维画面）、HTML / Markdown 场景报告、证据包、按会话恢复场景；截图目录只保留最近 50 张，适用于报告、汇报与归档。截图同时给出相机经纬度、高度、朝向、俯仰、时间与可见图层，并在图片旁写同名 JSON sidecar。
- **Agent 集成**：内置六个工具（`earth_scene`、`earth_capture`、`earth_draw`、`earth_measure`、`earth_analyze`、`earth_shader`），支持对话直接读写场景；视觉特效为白名单预设（禁止自定义 GLSL），按图层应用并支持原图对比。
- **数据接入**：本地目录递归扫描、本机绝对路径、`http(s)` 在线地址；本地路径一次授权，不脱离授权目录读取。「地图」Tab 还可直接导入本地 GeoJSON 或 Shapefile（`.shp` 可同时选 `.dbf` 属性表；最多 500 要素 / 2 万坐标），或把文件直接拖进画面，作为矢量叠加，与 Agent 标注共用显示与清除逻辑。

## 界面与交互

以下截图均来自真实面板操作。示例数据为法国克莱蒙费朗（Clermont-Ferrand）公开 3D Tiles，可直接加载：<a href="https://3d.craig.fr/datasets/Clermont/3dtiles/tileset.json">3d.craig.fr/datasets/Clermont/3dtiles/tileset.json</a>。该数据集根范围中心约为 **45.7944°N, 3.1676°E（WGS84）**，截图内容均落在此老城范围内。

<div align="center">

<img src="assets/readme/profile.jpg" alt="三维剖面：从大教堂到老城的剖面分析，显示高程来源、起伏与挖填方（CRAIG Clermont-Ferrand 3D Tiles）" width="32%">
<img src="assets/readme/shader.jpg" alt="视觉特效工作台：按建筑高度渐变着色，可调高程范围（CRAIG Clermont-Ferrand 3D Tiles）" width="32%">
<img src="assets/readme/tools.jpg" alt="工具卡：点选、套索、矩形/对象框选、AI 圈选、剖面与日照时间轴" width="32%">

<p align="center"><img src="assets/readme/tour.gif" alt="数字地球面板功能演示：单击识别、框选提问、淹没分析、工具卡与视角导览" width="640"></p>


</div>

**对话示例**（真实运行记录，保留同一次会话里的工具调用）：

> **你**：加载克莱蒙费朗的 3D Tiles，量一下大教堂到雅德广场的距离，再截图。
>
> **Agent**：`earth_scene load` → `earth_measure distance` → `earth_capture`
>
> **结果**：381.12 m；截图保存到截图目录，同时返回相机元数据与 JSON sidecar，面板里保留量测标注。

**量测与标注**：在地球上测距、测面、测高，或让 Agent 用 GeoJSON 画点线面；结果留在面板里，可随时截图。**单击场景对象即可识别**：默认指针行为就是指认，弹出对象属性（有批量表时最多显示 8 条）、命中图层、坐标、表面/几何高程与置信度，不需要先切换工具；识别卡还可“框选此点周围”生成 15 m 近似选区（明确标注为近似范围，不冒充建筑轮廓）。

**工具卡**：工具栏「工具」按钮直接打开独立工具卡，集中量测、剖面、日照、视觉特效与视角收藏。完成「点选 / 套索 / 框选 / 对象框选」后，自动展开选区提问框，可直接输入问题或选用快捷问题，再点「发送到当前对话」。坐标和可选的选区截图随问题一起发送，Agent 回复显示在对话区；忙碌时排队。可靠的表面选区还可查看近似面积/周长、导出 GeoJSON 或运行已有分析；对象框选针对已有标注，支持批量删除与导出。「AI 圈选」使用独立的视觉直连流程，下文有精度说明。原工具栏「问 Agent」保留为只发送场景上下文、随后在对话中输入问题的入口。

**框选后提问**：打开「工具」→「框选区域」，在场景里拖框并松开，提问卡即保留当时的画面与青色选区。之后移动相机也不会把问题配到新画面。截图最长边为 1024 像素，只在点击发送后交给当前会话模型，并由宿主作为原生图片附件接收；不需要 Agent 再读取截图文件。模型不能读图时会明确报错，可换视觉模型，或取消附图后只问有坐标的选区。宿主缺少直接提问服务时，可复制问题与选区到对话，不会把仅注入上下文说成已经启动回答。网络状态不明时，先查看对话，直接重试会沿用原请求编号。

拖动预览在屏幕空间绘制，松开才采样三维表面，避免每次移动反复读取深度。表面采样不是建筑分割：屋顶、墙面、地面可能让经纬度边界折返，面积仅为水平投影估算。边界漏采或自交时保留画面选区供看图提问，关闭面积与几何导出，建议转为俯视后重选；不会把缺失点强行连成测量结果。淹没快捷分析使用选区的外接矩形，结果不是任意多边形内的精确水量。

**三维剖面**：在「三维」Tab 选择「画剖面」，第一次点击起点后即出现草稿线，移动鼠标实时预览，点击终点生成三维剖面；分析卡最上方是剖面图，并标明本次使用的高程来源（3D Tiles 地表或地形）。分析的是三维地表（含建筑与植被），不是地形（terrain）本身。

**视觉特效**：高程渐变、高度扫描、水面波纹与淹没分析四个主效果，按明确的目标图层应用；高程渐变默认按当前可见表面的采样高程着色，水面波纹随时间真实波动，重置或隐藏图层后不会残留。等高线在三维模型表面会呈锯齿，已从界面移除（工具白名单仍兼容该预设，避免破坏既有调用）。

**日照时间轴**：在「三维」Tab 开启后拖动日期与时间，可选择「画面地方时」（默认，按当前画面/图层经度自动匹配并标注 UTC 偏移）、「浏览器本地」或「UTC」；开启时显示天空与太阳，太阳落山后的变暗会明确提示为真实昼夜而不是渲染故障，关闭后恢复原光照。

## 数据与精度

- **3D Tiles**：标准 1.0 / 1.1（b3dm、glb），根瓦片需自带世界定位（`root.transform` 或 `root.boundingVolume.region`）。OSGB 转换的数据如果缺根变换，可以在仓库里运行 `georef-osgb` 脚本一次性补齐（npm 包不含该脚本）。
- **3DGS**：`KHR_gaussian_splatting`（含 SPZ 压缩）。面板会读取内容头判断图层是 mesh 还是 3DGS；3DGS 适合浏览、指认与叠加标注，它不提供可采样的表面高程，三维剖面 / 淹没 / 天际线这类需要高程的功能请配合地形或 mesh 3D Tiles 使用。
- **底图与地形**：内置 Esri 影像、ArcGIS 地形等常用服务，也可在设置里换成自己的 XYZ / ArcGIS / WMS 源；离线时可关闭底图。
- **高程与面积**：面板高度来自 3D 表面或在线地形，使用椭球高；面积是局部平面近似。一次分析只使用一个高程来源，不混用；对精度敏感的业务请以专业软件成果为准，并把期望口径告诉我们。
- **大体量数据**：几百 MB 的实景模型与上千个瓦片可以直接加载；截图与报告目录会自动保留最近的文件。

公开示例数据：<a href="https://3d.craig.fr/datasets/Clermont/3dtiles/tileset.json">Clermont-Ferrand 3D Tiles</a>（法国克莱蒙费朗，由 CRAIG 发布，数据集中心约 45.7944°N, 3.1676°E），填入面板的地址栏即可打开。

## AI 辅助圈选（视觉直连）

点击场景目标，在识别卡中选择「AI 圈出这个目标」，核对截图上的轮廓，再点「采用近似选区」。选区进入工具卡，可导出带近似标记的 GeoJSON，或使用已有分析功能。结果只表示可见表面的近似范围，面积与分析仅作参考，不是建筑占地、精细分割或 mesh 提取。

此入口直接调用 DSH 全局默认视觉模型一次，不进入 Agent 工具循环，不安装 SAM 或其他推理运行时。模型需明确支持图片输入，宿主需提供 LLM、附件及默认模型服务；缺失时会明确提示。截图最长边限制为 1024 像素，服务请求约 20 秒超时，不自动重试；模型费用按配置的服务计收。取消会通知模型停止，已产生的调用费用或附件不因此撤销。

识别期间固定视角；相机、图层、瓦片细节或面板尺寸变化会使本次结果失效。确认时必须取得可靠的三维深度，失败可明确切换到手动套索。原「问 Agent」仍是独立入口。更新本地插件后需完全退出并重启 DSH，使新宿主路由生效。

## Agent 工具

六个工具由 Host 注册，名称与参数是稳定契约，面板和对话共用同一套操作：

| 工具 | 作用 |
| --- | --- |
| `earth_scene` | 读取或修改相机、图层、底图、地形与可见性；`load` / `remove` / `visible` / `fly` / `reset` / `pick` / `inspect` / `report` |
| `earth_capture` | 截图并返回宿主绝对路径与相机元数据（经纬度、高度、朝向、时间、可见图层），图片旁写 JSON sidecar；可选 JPEG / PNG、尺寸与 HUD |
| `earth_draw` | 用 GeoJSON 画点、线、面与文字标签；可清空此前 Agent 绘制的叠加 |
| `earth_measure` | 测大地线距离、多边形面积与高差，返回数值与标注 |
| `earth_analyze` | 空间分析：`profile`（三维剖面）/ `flood` / `sunlight` / `clip` / `skyline` / `clear`；高程来源可选 3D 表面或地形，一次只用一个 |
| `earth_shader` | 应用 / 重置 / 列出白名单视觉特效预设，支持 1–3 个预设叠加 |

除了工具，对话里也可以用 `/earth` 命令快速查看状态、截图、出报告或清除标注。

## 引用与论文

数字地球是武汉大学 CVEO 课题组长期研究工作的一部分。如果它帮到了你的研究、教学或项目，欢迎引用下列与三维城市建模、三维重建最相关的论文：

[1] CHENG J X, HUANG X R, CHEN G Z, et al. FACTS: training-free zero-shot diffusion framework for facade texture restoration in 3D urban models[J]. Advanced Engineering Informatics, 2026, 71: 104385. DOI: 10.1016/j.aei.2026.104385.

[2] WANG J Q, CHEN G Z, ZHANG X D, et al. Utilizing geometric primitives for depicting planar building roof structure from high-resolution remote sensing imagery[J]. International Journal of Applied Earth Observation and Geoinformation, 2025, 141: 104630. DOI: 10.1016/j.jag.2025.104630.

更多成果见课题组官网「科研成果」：<a href="https://www.whu-cveo.com/research/">whu-cveo.com/research</a>。

## 团队与商务合作

**官方发布渠道**：npm（`@cveo/dsh-digital-earth`）、DSH 插件市场（发布者 CVEO）、课题组官网 <a href="https://www.whu-cveo.com/">whu-cveo.com</a>。使用中遇到问题、发现数据兼容性问题，或想反馈需求，通过课题组官网联系我们即可。

插件以 MIT 许可免费发布、可自由商用。课题组同时提供面向团队的增值服务：

- **私有化部署**：内网 / 专有云部署、离线瓦片与地形接入、升级维护，并支持大规模时空数据治理与国产信创设备部署等功能。
- **团队权限控制**：多用户与角色权限、项目与数据隔离、审计日志、统一登录。
- **多模态对地观测数据智能**：面向 SAR、多光谱、高光谱、点云等非 RGB 8-bit 数据的感知、理解与分析一体化能力。
- **「经纬观枢」时空智能体**：面向行业的时空智能合作、定制开发与集成、培训与技术支持。

联系：官网合作页 <a href="https://www.whu-cveo.com/collaboration/">whu-cveo.com/collaboration</a> · 微信公众号「CVEO课题组」「珞珈经纬」。

### 许可与致谢

本项目以 MIT 发布，完整文本见 [LICENSE](LICENSE)；第三方组件与数据声明见 [THIRD-PARTY.md](THIRD-PARTY.md) 与 [NOTICE](NOTICE)。三维引擎 CesiumJS 以 Apache-2.0 分发并随插件自托管；影像与地形在运行时访问 ArcGIS 公共服务，版权归各自提供方；加载动画使用 CesiumJS 附带的 Natural Earth II 公有领域数据。示例截图使用 CRAIG 公开发布的法国克莱蒙费朗 3D Tiles 数据。

由**武汉大学 CVEO 课题组**维护 · <a href="https://www.whu-cveo.com/">www.whu-cveo.com</a>
