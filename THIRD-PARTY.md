# Third-party components and data / 第三方组件与数据

数字地球以 MIT 许可发布。本文件列出随插件分发、构建期使用或运行时访问的第三方组件与数据，便于合规审查。

## Runtime dependencies

插件运行期**没有 npm 第三方依赖**。以下组件随包分发：

| 组件 | 版本 | 许可 | 说明 |
| --- | --- | --- | --- |
| CesiumJS | 1.147.0 | Apache-2.0 | 三维引擎，自托管于 `vendor/cesium/`。许可证全文见 `vendor/cesium/LICENSE.md`，Cesium 自身的第三方声明见 `vendor/cesium/ThirdParty/`；Cesium® 是 Cesium GS, Inc. 的注册商标，本项目与该公司的归属关系见 [NOTICE](NOTICE)。 |
| Natural Earth II 纹理 | 随 CesiumJS 分发 | Public domain | 加载动画的陆地遮罩，源文件在 `vendor/cesium/Assets/Textures/NaturalEarthII/`，数据来自 https://www.naturalearthdata.com/ 。 |

## Build-time dependencies

| 组件 | 许可 | 说明 |
| --- | --- | --- |
| esbuild | MIT | 唯一的 `devDependency`，仅用于把 `src/client/**` 打包为 `client.js`；不进入运行期产物之外的依赖图。 |

## Runtime services (not bundled)

以下服务由用户选择的在线数据源在运行时访问，插件不复制、不再分发其数据：

| 服务 | 用途 | 条款 |
| --- | --- | --- |
| Esri World Imagery 等 ArcGIS 影像服务 | 内置底图 | 版权与使用条款归 Esri 及各数据提供方，见其服务条款。 |
| ArcGIS World Elevation 3D | 内置地形 | 同上。 |
| 用户自填的 XYZ / ArcGIS / WMS / 地形源 | 自定义数据源 | 由用户选择的提供方决定。 |
| 天地图地名搜索 API | 地名检索，默认启用（用户自备服务端 tk） | 使用受天地图服务条款约束；密钥与申请入口见 https://cloudcenter.tianditu.gov.cn/ 。 |
| 高德地图 Web 服务 API | 地名检索，默认启用（用户自备 Web 服务 key） | 使用受高德开放平台服务条款约束，见 https://console.amap.com/dev/key/app 。 |
| Photon（Komoot） | 地名检索，无需密钥，默认不启用 | 检索结果数据 © OpenStreetMap contributors，按 ODbL 许可；服务由 Komoot 运营，见 https://photon.komoot.io/ 。 |
| OpenStreetMap Nominatim（公共实例或自建） | 地名检索，无需密钥，默认不启用 | 公共实例须遵守使用政策（全应用 ≤1 次/秒）：https://operations.osmfoundation.org/policies/nominatim/ ；数据 © OpenStreetMap contributors，ODbL；建议自建或代理时使用。 |

除内置条目外，用户可在设置中添加自定义服务商实例（同一批适配器类型 + 自填服务地址，例如自建 Photon、Nominatim 镜像或代理）。请求会发往用户填写的地址，该地址的服务可用性、数据与条款由用户与其运营方负责；插件只按所选服务类型附加查询参数，不做可信性背书。

天地图、高德、Photon 与 Nominatim 的检索结果只用于在场景中定位；重复查询会在宿主进程内存中缓存（最多 256 条）以减少请求次数，不写入仓库、不再分发。

地名检索由第三方地图 / 地理编码服务提供，服务可用性、数据内容与使用条款均由各服务商负责，与本插件开发方无关；使用前请自行确认并遵守对应服务商的服务条款（例如天地图、高德、OpenStreetMap / Nominatim 各自的政策）。

## 数据外发 / Data egress

插件本身不做遥测、不收集使用统计。只有当用户主动使用以下功能时，数据才会发往对应服务：

| 功能 | 外发内容 | 接收方 |
| --- | --- | --- |
| AI 2D 实例提取、发送视图给 AI | 面板正射画面截图（必要时附带选区范围与类别名） | 用户选择的视觉模型服务：当前对话的 DSH 模型，或用户自行填写的 OpenAI 兼容端点。 |
| 地名检索 | 用户输入的检索词（以及请求语言） | 用户在地名检索面板或设置中选择的服务商（天地图 / 高德 / Photon / OpenStreetMap Nominatim）。 |
| 底图、地形与在线 3D Tiles | 对应服务请求所需的瓦片 / 地形范围参数 | 用户选择的数据源提供方。 |

服务密钥只保存在宿主状态目录（例如 `~/.dsh/digital-earth/place-search.json`，权限 0600），不写入仓库、不进入浏览器存储，也不会发送给上述接收方之外的服务。

## Documentation screenshots

README 与插件市场截图使用 **CRAIG 公开发布的法国克莱蒙费朗 3D Tiles 数据集**（`https://3d.craig.fr/datasets/Clermont/3dtiles/tileset.json`）。数据版权归 CRAIG 及原始数据提供方所有，使用与署名条款以该数据集发布页面为准；相关截图仅用于展示插件功能。

## Fonts and icons

界面使用系统字体（`-apple-system`, `Segoe UI`, `PingFang SC`, `Microsoft YaHei` 等），不随包分发字体文件。插件图标与界面图标为项目内联 SVG，由武汉大学 CVEO 课题组创作（MIT）。
