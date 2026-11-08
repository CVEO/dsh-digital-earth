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

数字地球把 CesiumJS 三维场景接入 DeepSeek Harness（DSH）的对话工作区：既可浏览 3D Tiles 与 3DGS，也让 Agent 读写场景、执行标注量测、地形分析与着色器预设。CesiumJS 与界面资源随插件自托管，无需外部静态资源或 Cesium ion Token。

## 界面

**标注与量测**：在地球上绘制范围、量测距离，或让 Agent 用 GeoJSON 标注；坐标、面积与结果保留在面板中。

![标注与量测](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/identify.jpg)

**剖面**：在「三维」Tab 选择「画剖面」，在地球上依次选取起点与终点；分析卡给出起伏、坡度、挖填方与剖面线。

![剖面](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/analysis.jpg)

**着色器**：五个白名单预设按图层应用，例如水面、高程；工作台支持 1–3 个预设叠加、滑杆调参与原图对比。

![着色器](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/shader.jpg)

## 功能

- **场景浏览**：3D Tiles 1.0 / 1.1（b3dm、glb）与 3DGS（`KHR_gaussian_splatting`，含 SPZ）；多图层叠加，可显隐、定位、移除。
- **数据入口**：本地目录递归扫描 `tileset.json`、`http(s)` 在线地址、本机绝对路径；白名单外的路径需在面板授权一次。
- **图层结构**：L1 地形、L2 影像底图、L3 栅格叠加（WMS / XYZ / ArcGIS）、L4 矢量叠加；即使未加载 3D Tiles，也可切换地形、底图与栅格。
- **量测与指认**：测距、测面、测高、拾取 3D Tiles 属性；指认卡给出坐标、表面高程、几何高度估计与置信度，并可导出证据包。
- **地形分析**：剖面、淹没、日照、剖切、天际线；一次只保留一个分析，结果为场景叠加与分析卡。
- **着色器预设**：高程渐变、等高线、扫描、水面、水深五个白名单预设；同一图层只保留一个 shader，支持 1–3 个预设叠加。
- **交付**：干净截图（手动与 Agent 截图默认只保留三维画面）、HTML / Markdown 场景报告、证据包、按会话恢复场景。
- **本地数据**：只在面板打开过或一次性授权的目录内读取；不上传场景、截图或标注。
- **界面**：双语（跟随 DSH 语言）、浅色 / 深色主题、可折叠面板；图层分「地图 / 三维」两个 Tab，右下角指南针点击回正北，坐标 HUD 约 5–6 Hz 采样。
- **内置六个工具**：`earth_scene`、`earth_capture`、`earth_draw`、`earth_measure`、`earth_analyze`、`earth_shader`；每次调用都会在对话里显示工具行。

## 安装与快速开始

**前置条件**

- DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0`（与 `package.json` 的 `engines.dsh` 一致）。
- 支持 WebGL / WebGL2 的现代浏览器；面板是 DSH Web UI 的一部分。
- 在线底图 / 地形 / 在线瓦片需要访问对应公共服务；离线时可用本地瓦片或关闭底图。
- Node.js 22 或 24 只用于开发与构建，运行期没有第三方依赖。

**数据要求**：标准 3D Tiles 1.0 / 1.1，根瓦片自带世界定位（`root.transform` 或 `root.boundingVolume.region`）。OSGB 转换数据可用 `scripts/georef-osgb.mjs` 一次性补齐根 `transform`。

**安装**

```bash
# 从 npm 注册表安装
dsh plugin --profile <profile> add @cveo/dsh-digital-earth

# 或从本地 tgz 安装（在仓库根目录执行）
dsh plugin --profile <profile> add ./cveo-dsh-digital-earth-1.5.1.tgz
```

也可以在插件市场搜索「数字地球」。安装或更新后请**完全退出并重新打开 DSH**：客户端 bundle 在宿主启动时注册，只刷新页面不会重新注册。之后对话标题栏会出现地球按钮，左侧栏会出现「数字地球」入口。

**加载首个数据集**

1. 选择对话标题栏的地球按钮，或让 Agent 调用地球工具；面板会自动打开并等待连接。
2. 打开「数据 ▾ → 打开本地目录…」选择包含 `tileset.json` 的目录；或「数据 ▾ → 加载地址或坐标…」粘贴 `http(s)` 地址 / 本机绝对路径，或输入 `经度,纬度[,高度]` 飞至该点。
3. 目录不在白名单时，面板会请求一次授权；授权后继续加载。
4. 加载后可浏览场景，并使用「量测」测量距离，或对 Agent 说「对当前图层做一次数据体检」。

快速验证：能打开地球、加载一个 tileset、量测距离，并让 Agent 截图。请使用标准 3D Tiles；示例 Prompt：`加载 D:\data\city\tileset.json，飞到城市上空并截图`（路径替换为你的数据路径）。

## 使用面板

| 入口 | 作用 |
| --- | --- |
| 地球按钮 | 在对话右侧打开数字地球页签；工具栏提供全屏入口（DOM Fullscreen，Esc 退出） |
| 数据 ▾ | 打开本地目录、重扫最近目录、加载地址或经纬度、清除 Agent 标注与量测、导出场景报告 |
| 量测 ▾ | 测距 / 测面 / 测高 / 拾取属性；左键取点，双击结束，Esc 或提示条「结束」退出 |
| 画剖面 | 在「三维」Tab 选择「画剖面」，依次选取起点与终点；结果显示在分析卡 |
| 日照时间轴 | 在「三维」Tab 开启后拖动日期 / 时间，查看昼夜明暗与地形阴影 |
| 指认 | 选择场景对象打开选中卡，可抵近定位、量测高度、导出证据 |
| 图层 | 两个 Tab：「地图」地形 / 影像 / 栅格；「三维」矢量 / 三维内容 / 空间分析 / 日照 / 视角收藏 |
| 着色器 | 打开工作台：选择 3D Tiles 图层与预设，调参后应用、重置或对比原图 |
| 问 Agent | 将当前视图与场景摘要附加到当前对话上下文，随后输入问题；上下文在下一步生效，不会主动启动空闲会话 |
| 设置 | 数据源、外观、渲染质量、HUD 详细模式、截图叠加信息与「关于」页签 |

本地目录会记入 `$DSH_HOME/digital-earth/directories.json`；场景按会话保存相机、图层、标注 / 量测、分析结果与着色器预设，切换会话或重启 DSH 后可以恢复。截图默认只保留三维画面，截图目录只保留最近 50 张；报告与导出路径由工具返回。

## Agent 工具

六个工具由 Host 注册，名称与参数为稳定契约；工具返回仅描述场景状态与文件路径，不替代实际渲染画面。分析通过对话调用 `earth_analyze`；剖面和日照也可在面板中操作。

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

> 对当前图层做一次数据体检，列出内容完整性检查结果；再测量画面中心到东北方向 300 米的高差。

**`/earth` 命令**

- `/earth status`：相机、图层、底图 / 地形与 Agent 叠加数量摘要。
- `/earth capture [label]`：截图并返回宿主绝对路径。
- `/earth report [html|markdown]`：导出场景报告。
- `/earth clear`：清除 Agent 绘制的标注与量测。
- `/earth open`：给出打开面板的指引。

**返回约定**

- 工具返回包含 `[code]` 与 `next:` 处理建议。
- 白名单外的本地路径返回 `access_denied` 或 `access_timeout`，可在面板重新授权。
- 缺少高程数据、着色器目标不适用或面板不可见时，工具会返回对应错误码与处理建议。

## 参与贡献

欢迎通过 [Issues](https://github.com/CVEO/dsh-digital-earth/issues) 报问题或提建议。开发、构建、测试与发布流程见 [CONTRIBUTING.md](CONTRIBUTING.md)；提交 PR 时请保持六个工具的名称、参数与 action 集合不变。

## 许可与致谢

本项目以 MIT 许可发布，完整文本见 [LICENSE](LICENSE)；第三方许可见 [NOTICE](NOTICE)。

- CesiumJS 1.147 以 Apache-2.0 分发并随插件自托管。
- DeepSeek Harness 提供插件运行时、命令桥与工具调用界面。
- 示例数据：课题组自有的 LOD18 实景三维；3DGS 样例 Svirnas Alyt 来自 WilliamLiu 的 3D-Tiles-RendererJS-3DGS-Plugin（Apache-2.0）。
- 影像与地形：运行期访问的 ArcGIS 公共服务，版权归各自提供方。

由**武汉大学 CVEO 课题组**维护 · <https://www.whu-cveo.com/>
