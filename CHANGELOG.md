# Changelog

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
