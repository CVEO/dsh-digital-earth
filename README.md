<div align="center">

<img src="https://github.com/CVEO/dsh-digital-earth/raw/main/icon.svg" width="72" height="72" alt="数字地球图标">

# 数字地球 · Digital Earth

**把 3D Tiles / 3DGS 场景带进 DSH 对话工作区，让 Agent 能看、能测、能分析。**

[中文](README.md) · [English](README.en.md) · [Issues](https://github.com/CVEO/dsh-digital-earth/issues) · [更新日志](CHANGELOG.md)

![版本](https://img.shields.io/badge/版本-1.5.1-4f8cff)
![CI](https://github.com/CVEO/dsh-digital-earth/actions/workflows/ci.yml/badge.svg)
![许可](https://img.shields.io/badge/许可-MIT-2ea44f)
![DSH 插件](https://img.shields.io/badge/DSH-插件-0ea5e9)
![平台](https://img.shields.io/badge/平台-Web-64748b)

</div>

![数字地球面板：着色器工作台、两个 Tab 的图层与指南针](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/panel-overview.jpg)

数字地球是 DeepSeek Harness（DSH）插件：在对话旁打开 CesiumJS 三维地球，浏览 3D Tiles 与 3DGS，并把场景读写、标注量测、地形分析与着色器预设交给 Agent。CesiumJS 与界面资源随插件自托管，不需要外部静态资源或 Cesium ion Token。

## 界面

**标注与量测**：在地球上画范围、量距离，或让 Agent 用 GeoJSON 标注；坐标、面积与结果都留在面板里。

![标注与量测](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/identify.jpg)

**剖面**：在「三维」Tab 点「画剖面」，在地球上点起点 / 终点；分析卡给出起伏、坡度、挖填方与剖面线。

![剖面](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/analysis.jpg)

**着色器**：五个白名单预设按图层应用，例如水面、高程；工作台支持 1–3 个预设叠加、滑杆调参与原图对比。

![着色器](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/shader.jpg)

## 功能

- **场景浏览**：3D Tiles 1.0 / 1.1（b3dm、glb）与 3DGS（`KHR_gaussian_splatting`，含 SPZ）；多图层叠加，可显隐、定位、移除。
- **数据入口**：本地目录递归扫描 `tileset.json`、`http(s)` 在线地址、本机绝对路径；白名单外的路径需在面板授权一次。
- **图层结构**：L1 地形、L2 影像底图、L3 栅格叠加（WMS / XYZ / ArcGIS）、L4 矢量叠加；没有 3D Tiles 时也能切换地形、底图与栅格。
- **量测与指认**：测距、测面、测高、拾取 3D Tiles 属性；指认卡给出坐标、表面高程、几何高度估计与置信度，并可导出证据包。
- **地形分析**：剖面、淹没、日照、剖切、天际线；一次只保留一个分析，结果为场景叠加与分析卡。
- **着色器预设**：高程渐变、等高线、扫描、水面、水深五个白名单预设；同一图层只保留一个 shader，支持 1–3 个预设叠加。
- **交付**：干净截图（手动与 Agent 截图默认只保留三维画面）、HTML / Markdown 场景报告、证据包、按会话恢复场景。
- **界面**：双语（跟随 DSH 语言）、浅色 / 深色主题、可折叠面板；图层分「地图 / 三维」两个 Tab，右下角指南针点击回正北，坐标 HUD 约 5–6 Hz 采样。
- **内置六个工具**：`earth_scene`、`earth_capture`、`earth_draw`、`earth_measure`、`earth_analyze`、`earth_shader`；每次调用都会在对话里显示工具行。

## 安装与快速开始

**前置条件**

- DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0`（与 `package.json` 的 `engines.dsh` 一致）。
- 支持 WebGL / WebGL2 的现代浏览器；面板是 DSH Web UI 的一部分。
- 在线底图 / 地形 / 在线瓦片需要访问对应公共服务；离线时可用本地瓦片或关闭底图。
- Node.js 22 或 24 只用于开发与构建，运行期没有第三方依赖。

**安装**

```bash
# 从 npm 注册表安装
dsh plugin --profile <profile> add @cveo/dsh-digital-earth

# 或从本地 tgz 安装（在仓库根目录执行）
dsh plugin --profile <profile> add ./cveo-dsh-digital-earth-1.5.1.tgz
```

也可以在插件市场搜索「数字地球」。安装或更新后请**完全退出并重新打开 DSH**：客户端 bundle 在宿主启动时注册，只刷新页面不会重新注册。之后对话标题栏会出现地球按钮，左侧栏会出现「数字地球」入口。

**加载第一个数据**

1. 点对话标题栏的地球按钮，或直接让 Agent 调用地球工具；面板会自动打开并等待连接。
2. 打开「数据 ▾ → 打开本地目录…」选择包含 `tileset.json` 的目录；或「数据 ▾ → 加载地址或坐标…」粘贴 `http(s)` 地址 / 本机绝对路径，或输入 `经度,纬度[,高度]` 直接飞到该点。
3. 目录不在白名单时，面板会请求一次授权；允许后继续，未授权时保持当前状态。
4. 载入后即可拖动浏览；用「量测」量一条距离，或对 Agent 说「对当前图层做一次数据体检」。

五分钟验收：能看到地球、加载一个 tileset、量一条距离、让 Agent 截一张图。请使用你自己的标准 3D Tiles；示例 Prompt 可写成 `加载 D:\data\city\tileset.json，飞到城市上空并截图`（路径换成你的）。

## 使用面板

| 入口 | 作用 |
| --- | --- |
| 地球按钮 | 在对话右侧打开数字地球页签；工具栏提供全屏入口（DOM Fullscreen，Esc 退出） |
| 数据 ▾ | 打开本地目录、重扫最近目录、加载地址或经纬度、清除 Agent 标注与量测、导出场景报告 |
| 量测 ▾ | 测距 / 测面 / 测高 / 拾取属性；左键取点，双击结束，Esc 或提示条「结束」退出 |
| 画剖面 | 在「三维」Tab 点「画剖面」，在地球上点起点 / 终点；结果进入分析卡 |
| 日照时间轴 | 在「三维」Tab 开启后拖动日期 / 时间，查看昼夜明暗与地形阴影 |
| 指认 | 点选场景对象打开选中卡，可抵近定位、量测高度、导出证据 |
| 图层 | 两个 Tab：「地图」地形 / 影像 / 栅格；「三维」矢量 / 三维内容 / 空间分析 / 日照 / 视角收藏 |
| 着色器 | 打开工作台：选择 3D Tiles 图层与预设，调参后应用、重置或对比原图 |
| 问 Agent | 将当前视图与场景摘要附加到当前对话上下文，随后直接输入问题；上下文在下一步生效，不会主动启动空闲会话 |
| 设置 | 数据源、外观、渲染质量、HUD 详细模式、截图叠加信息与「关于」页签 |

本地目录会记入 `$DSH_HOME/digital-earth/directories.json`；场景按会话保存相机、图层、标注 / 量测、分析结果与着色器预设，切换会话或重启 DSH 后可以恢复。

## Agent 工具

六个工具由 Host 注册，名称与参数是稳定契约；工具结果只报状态与路径，画面内容以实际渲染为准。分析通过对话调用 `earth_analyze`；剖面和日照也可在面板直接操作。

| 工具 | 作用 |
| --- | --- |
| `earth_scene` | 读取 / 修改相机、图层、底图、地形与可见性；`load` / `remove` / `visible` / `fly` / `pick` / `inspect` / `report` |
| `earth_capture` | 截图并返回宿主绝对路径；可选 JPEG / PNG、尺寸与 HUD |
| `earth_draw` | 从 GeoJSON 绘制点、线、面与文字标签；可清除此前的 Agent 叠加 |
| `earth_measure` | 量测大地线距离、平面面积或高差；坐标使用 `[lon, lat]` 或 `[lon, lat, height]` |
| `earth_analyze` | 地形分析：`profile` / `flood` / `sunlight` / `clip` / `skyline` / `clear` |
| `earth_shader` | 应用 / 重置 / 列出白名单着色器预设 |

**示例 Prompt**

> 加载 `D:\data\city\tileset.json`，切到影像底图，飞到场景中心并截图。

> 对当前图层做一次数据体检，把内容完整性检查结果列出来；再量一下画面中心到东北方向 300 米的高差。

**`/earth` 命令**

- `/earth status`：相机、图层、底图 / 地形与 Agent 叠加数量摘要。
- `/earth capture [label]`：截图并返回宿主绝对路径。
- `/earth report [html|markdown]`：导出场景报告。
- `/earth clear`：清除 Agent 绘制的标注与量测。
- `/earth open`：给出打开面板的指引。

**返回约定**

- 工具返回以 `[code]` 开头，并给出一条 `next:` 建议；按建议处理即可。
- 白名单外的本地路径返回 `access_denied` 或 `access_timeout`，可在面板重新授权。
- 分析没有高程、着色器目标不是普通 3D Tiles、面板不可见时截图，工具会返回可操作的建议。

## 数据与安全

**数据契约**

- 支持 3D Tiles 1.0 / 1.1；根瓦片带有世界定位（`root.transform` 或 `root.boundingVolume.region`）时可直接加载。
- 数据保持原样：Cesium 接收的字节与磁盘一致；嵌套外部 tileset 由父级根变换定位，不重复变换。

**世界定位**

- 导出 3D Tiles 时写入根 `transform` 或 `region`，即可在任意位置正确定位。
- 数据体检会给出世界定位提示与修复建议；OSGB 转换数据可用 `scripts/georef-osgb.mjs` 一次性补齐根 `transform`（默认 dry-run，`--apply` 保留 `tileset.json.bak`，支持 CGCS2000 高斯-克吕格 EPSG 4491–4554）。
- 运行时按标准 3D Tiles 读取，不读取 sidecar，也不改写数据。

**本地数据与权限**

- 面板打开过的目录（或用户一次性授权的目录）会由 `/tiles` 提供；白名单、真实路径与根目录校验都在宿主侧。
- Agent 可传本机绝对路径；白名单外的路径会先向面板请求一次授权，30 秒未处理返回 `access_timeout`。
- 数据只在本机和你选择的在线服务之间流动；插件不会上传场景、截图或标注。

**访问控制与保留**

- 所有路由绑定 DSH `connection` 会话、同源校验与插件实例 token；token 只下发给页面，不出现在任何工具结果里。
- `/remote` 代理只转发公网地址，字面量 loopback / 私网地址与 3xx 重定向会被拦截；查询串上限 2048 字符。
- 截图目录只保留最近 50 张（`$DSH_HOME/digital-earth/captures`）；体检报告保留最近 100 份，场景报告与证据包保留最近 200 份，场景快照保留最近 50 个会话。

## 参与贡献

欢迎通过 [Issues](https://github.com/CVEO/dsh-digital-earth/issues) 报问题或提建议。开发、构建、测试与发布流程见 [CONTRIBUTING.md](CONTRIBUTING.md)；提交 PR 时请保持六个工具的名称、参数与 action 集合不变。

## 许可与致谢

本项目以 MIT 许可发布，完整文本见 [LICENSE](LICENSE)；第三方许可见 [NOTICE](NOTICE)。

- CesiumJS 1.147 以 Apache-2.0 分发并随插件自托管。
- DeepSeek Harness 提供插件运行时、命令桥与工具调用界面。
- 示例数据：课题组自有的 LOD18 实景三维；3DGS 样例 Svirnas Alyt 来自 WilliamLiu 的 3D-Tiles-RendererJS-3DGS-Plugin（Apache-2.0）。
- 影像与地形：运行期访问的 ArcGIS 公共服务，版权归各自提供方。

由**武汉大学 CVEO 课题组**维护 · <https://www.whu-cveo.com/>
