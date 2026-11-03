# Changelog

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
- 安全：Connection 会话 / 同源校验、一次性 token、本地目录白名单、代理内网地址拦截。
- CesiumJS 1.147 自托管（中国大陆网络可用）。
- 设置面板页脚展示维护团队：武汉大学 CVEO 课题组（https://www.whu-cveo.com/）。
