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

## Documentation screenshots

README 与插件市场截图使用 **CRAIG 公开发布的法国克莱蒙费朗 3D Tiles 数据集**（`https://3d.craig.fr/datasets/Clermont/3dtiles/tileset.json`）。数据版权归 CRAIG 及原始数据提供方所有，使用与署名条款以该数据集发布页面为准；相关截图仅用于展示插件功能。

## Fonts and icons

界面使用系统字体（`-apple-system`, `Segoe UI`, `PingFang SC`, `Microsoft YaHei` 等），不随包分发字体文件。插件图标与界面图标为项目内联 SVG，由武汉大学 CVEO 课题组创作（MIT）。
