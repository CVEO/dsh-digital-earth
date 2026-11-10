<div align="center">

<img src="icon.svg" width="76" height="76" alt="数字地球图标">

# 数字地球 · Digital Earth

**在 DSH 对话里直接看、量、分析 3D Tiles 与 3DGS。**

武汉大学 CVEO 课题组出品 · 面向三维城市、实景三维与多模态对地观测数据的三维交互组件

[中文](README.md) · [English](README.en.md) · [更新日志](CHANGELOG.md) · [许可](LICENSE)

![版本](https://img.shields.io/badge/版本-1.5.1-4f8cff)
![许可](https://img.shields.io/badge/许可-MIT-2ea44f)
![DSH](https://img.shields.io/badge/DSH-插件-0ea5e9)

<img src="assets/readme/hero.jpg" alt="数字地球面板：东京千代田建筑三维场景" width="46%">

</div>

打开 DSH，点对话标题栏的地球按钮，右侧就会出现一个三维地球。把本地或在线 3D Tiles / 3DGS 数据加载进来，一边聊天一边浏览、量测、做地形分析；也可以让 Agent 直接读写场景、标注、截图、出报告。

三维引擎与界面资源随插件一起分发，不需要 GIS 服务端，也不用先学三维引擎；数据留在本机。

## 30 秒上手

```bash
# 插件市场搜索「数字地球」，或从 npm / tgz 安装：
dsh plugin --profile <profile> add @cveo/dsh-digital-earth
dsh plugin --profile <profile> add ./cveo-dsh-digital-earth-1.5.1.tgz
```

1. 完全退出并重新打开 DSH（客户端 bundle 在启动时注册，刷新页面不够）。
2. 点对话标题栏的地球按钮，打开右侧「数字地球」页签。
3. 数据 ▾ → 打开本地目录，选择包含 `tileset.json` 的文件夹；或粘贴在线地址 / 输入经纬度直接飞过去。

然后可以直接对 Agent 说：

> 加载刚打开目录里的 tileset.json，飞到场景中心，量一下两栋楼的距离，再截一张图。

第一次打开新目录时面板会请求一次授权，之后同一目录直接加载。

## 能做什么

- **看**：叠加多份 3D Tiles / 3DGS，显隐、定位、指认属性；图层分「地图 / 三维」两个 Tab，可折叠面板，右下角指南针点击回正北。
- **量**：距离、面积、高差，量完就有结果与标注；坐标 HUD 约 5–6 Hz 采样，指认卡给出表面高程与几何高度估计。
- **分析地形**：剖面、淹没、日照、剖切、天际线，一次只保留一个分析，结果叠加在场景里，并写明高程来源（3D 表面或地形）。
- **交付**：干净截图（手动与 Agent 截图默认只保留三维画面）、HTML / Markdown 场景报告、证据包、按会话恢复场景；截图目录只保留最近 50 张，适合写材料、做汇报、留档。
- **交给 Agent**：内置六个工具（`earth_scene`、`earth_capture`、`earth_draw`、`earth_measure`、`earth_analyze`、`earth_shader`），让对话直接读写场景；着色器为白名单预设，支持 1–3 个预设叠加与原图对比。
- **数据入口**：本地目录递归扫描、本机绝对路径、`http(s)` 在线地址；本地路径一次授权，不脱离授权目录读取。

## 界面对话

下面都是真实操作截图。示例数据为日本 PLATEAU 2025 千代田区建筑 LOD2（国土交通省，CC BY 4.0）。

<div align="center">

<img src="assets/readme/measure.jpg" alt="在地球上量测两栋建筑之间的距离" width="32%">
<img src="assets/readme/shader.jpg" alt="高程渐变着色器：按建筑高度着色" width="32%">
<img src="assets/readme/sunlight.jpg" alt="下午四点左右的建筑阴影" width="32%">

<p align="center"><img src="assets/readme/tour.gif" alt="绕着东京千代田建筑群浏览" width="320"></p>

</div>

**对话示例**（真实运行记录，保留同一次会话里的工具调用）：

> **你**：加载东京千代田的 3D Tiles，量一下这两栋楼之间的距离，再截图。
>
> **Agent**：`earth_scene load` → `earth_measure distance` → `earth_capture`
>
> **结果**：504.19 m；截图保存到截图目录，面板里同时保留量测标注。

**量测与标注**：在地球上测距、测面、测高，或让 Agent 用 GeoJSON 画点线面；结果留在面板里，可随时截图。

**剖面**：在「三维」Tab 选择「画剖面」，依次点起点和终点，分析卡给出起伏、坡度、挖填方与剖面线。

**着色器**：高程渐变、等高线、扫描、水面、水深五个白名单预设，按图层应用；工作台支持叠加、滑杆调参与原图对比。

## 数据与精度

- **3D Tiles**：标准 1.0 / 1.1（b3dm、glb），根瓦片需自带世界定位（`root.transform` 或 `root.boundingVolume.region`）。OSGB 转换的数据如果缺根变换，可以在仓库里运行 `georef-osgb` 脚本一次性补齐（npm 包不含该脚本）。
- **3DGS**：`KHR_gaussian_splatting`（含 SPZ 压缩）。面板会读取内容头判断图层是 mesh 还是 3DGS；3DGS 适合浏览、指认与叠加标注，它不提供可采样的表面高程，剖面 / 淹没 / 天际线这类需要高程的功能请配合地形或 mesh 3D Tiles 使用。
- **底图与地形**：内置 Esri 影像、ArcGIS 地形等常用服务，也可在设置里换成自己的 XYZ / ArcGIS / WMS 源；离线时可关闭底图。
- **高程与面积**：面板高度来自 3D 表面或在线地形，使用椭球高；面积是局部平面近似。对精度敏感的业务请以专业软件成果为准，并把期望口径告诉我们。
- **大体量数据**：几百 MB 的实景模型与上千个瓦片可以直接加载；截图与报告目录会自动保留最近的文件。

## Agent 工具

六个工具由 Host 注册，名称与参数是稳定契约，面板和对话共用同一套操作：

| 工具 | 作用 |
| --- | --- |
| `earth_scene` | 读取或修改相机、图层、底图、地形与可见性；`load` / `remove` / `visible` / `fly` / `reset` / `pick` / `inspect` / `report` |
| `earth_capture` | 截图并返回宿主绝对路径；可选 JPEG / PNG、尺寸与 HUD |
| `earth_draw` | 用 GeoJSON 画点、线、面与文字标签；可清空此前 Agent 绘制的叠加 |
| `earth_measure` | 测大地线距离、多边形面积与高差，返回数值与标注 |
| `earth_analyze` | 地形分析：`profile` / `flood` / `sunlight` / `clip` / `skyline` / `clear`；高程来源可选 3D 表面或地形，一次只用一个 |
| `earth_shader` | 应用 / 重置 / 列出白名单着色器预设，支持 1–3 个预设叠加 |

除了工具，对话里也可以用 `/earth` 命令快速查看状态、截图、出报告或清除标注。

## 引用与论文

数字地球是武汉大学 CVEO 课题组长期研究工作的一部分。如果它帮到了你的研究、教学或项目，欢迎引用（不强制，但对我们很重要）：

> 武汉大学 CVEO 课题组. 数字地球：面向 DSH 的三维地球插件（v1.5.1）[CP/OL]. 2026.

    @software{cveo_digital_earth_2026,
      author  = {{CVEO Research Group, Wuhan University}},
      title   = {Digital Earth: a 3D globe plugin for DeepSeek Harness},
      year    = {2026},
      version = {1.5.1},
      url     = {https://www.whu-cveo.com/},
      note    = {3D digital earth component for DSH}
    }

与三维城市建模、三维重建最相关的两篇课题组论文：

[1] CHENG J X, HUANG X R, CHEN G Z, et al. FACTS: training-free zero-shot diffusion framework for facade texture restoration in 3D urban models[J]. Advanced Engineering Informatics, 2026, 71: 104385. DOI: 10.1016/j.aei.2026.104385.

[2] WANG J Q, CHEN G Z, ZHANG X D, et al. Utilizing geometric primitives for depicting planar building roof structure from high-resolution remote sensing imagery[J]. International Journal of Applied Earth Observation and Geoinformation, 2025, 141: 104630. DOI: 10.1016/j.jag.2025.104630.

更多成果见课题组官网「科研成果」：<a href="https://www.whu-cveo.com/research/">whu-cveo.com/research</a>。

## 团队与商务合作

**官方发布渠道**：npm（`@cveo/dsh-digital-earth`）、DSH 插件市场（发布者 CVEO）、课题组官网 <a href="https://www.whu-cveo.com/">whu-cveo.com</a>。使用中遇到问题、发现数据兼容性问题，或想反馈需求，通过课题组官网联系我们即可。

插件以 MIT 许可免费发布、可自由商用。课题组同时提供面向团队的增值服务：

- **私有化部署**：内网 / 专有云部署、离线瓦片与地形接入、升级维护。
- **团队权限控制**：多用户与角色权限、项目与数据隔离、审计日志、统一登录。
- **多模态对地观测数据智能**：面向 SAR、多光谱、高光谱、点云等非 RGB 8-bit 数据的感知、理解与分析一体化能力。通用大模型通常只处理 8-bit RGB 图像，这类数据需要专门的数据管线与模型配合，也是我们长期研究的方向。
- **「经纬观枢」时空智能体**：面向行业的时空智能合作、定制开发与集成、培训与技术支持。

联系：官网合作页 <a href="https://www.whu-cveo.com/collaboration/">whu-cveo.com/collaboration</a> · 微信公众号「CVEO课题组」「珞珈经纬」。

### 许可与致谢

本项目以 MIT 发布，完整文本见 [LICENSE](LICENSE)；第三方许可见 [NOTICE](NOTICE)。CesiumJS 以 Apache-2.0 分发并随插件自托管；影像与地形在运行时访问 ArcGIS 公共服务，版权归各自提供方；加载动画使用 CesiumJS 附带的 Natural Earth II 公有领域数据。示例截图的 PLATEAU 数据由日本国土交通省以 CC BY 4.0 发布。

由**武汉大学 CVEO 课题组**维护 · <a href="https://www.whu-cveo.com/">www.whu-cveo.com</a>
