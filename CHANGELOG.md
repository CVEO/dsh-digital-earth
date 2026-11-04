# Changelog

## 1.1.0

第二阶段（P0）：让对话里的 Agent 能**操作**数字地球、也能**看到**数字地球。

- **Agent 命令桥**：Host 新增 `GET /api/3dviewer/events`（SSE，面板登记 + 心跳 + 断线清理）与 `POST /api/3dviewer/result`（回执，16 MiB 上限、id 归属校验）；一个面板一条串行命令队列，工具调用 20s / 截图 30s 超时；按会话优先、唯一面板兜底选择目标面板，无面板时返回结构化 `panel_not_open`。
- **`earth_scene` 工具**：`status / load / remove / visible / basemap / terrain / fly / reset / pick` 九个 action；坐标 WGS84 十进制度、高度米；`status` 返回紧凑场景快照（相机、图层统计、底图/地形、量测）；本地 `load.path` 只允许用户已在面板打开过的目录（`/scan` 白名单，未授权返回 `needs_user_directory` 且不下发命令）。
- **`earth_capture` 工具**：截取 Cesium 视口（PNG/JPEG，宽 320–2560，默认 1280），落盘到会话工作区 `.dsh-earth/captures/` 并写同名 `.json` 侧车（场景快照 + 图像元信息），返回路径/相机/图层摘要，提示模型用 `read_image` 复核。截图只含地球画布，天然不含 HUD / 工具栏 / 图层面板。
- **系统提示小节**：≤300 tokens 的硬规则（坐标约定、先 `status`、面板未打开时的处理、改完视图先截图、本地路径白名单），随插件注册/销毁。
- **面板侧**：顶部加入极小的 Agent 连接指示点；工具栏「截图」改为菜单——「保存截图」（原下载行为）/「复制场景摘要」（场景 JSON 到剪贴板）；Agent 操作时沿用现有 busy/toast 反馈，不新增弹层。
- **设置 › 关于**：新增「关于 / About」页签（版本、GitHub 仓库、课题组、MIT 许可、随包分发的 CesiumJS Apache-2.0 署名），页脚课题组链接旁增加轻量 GitHub 入口。
- **兼容性**：旧 Host 不提供 `eventsUrl`/`resultUrl` 时面板照常工作（桥静默跳过）；视觉链路与具体模型无关，任何支持图像输入的模型都可 `read_image` 读截图。
- **测试**：`node --test` 54 项（新增 Host 桥 16 项、Client 结构 12 项、CI 11 项），CI 在 Node 22/24 上跑语法检查、结构测试、打包清单与真实打包冒烟。
- **发布流程**：`develop` 日常开发 → `main` 合并即触发 GitHub Actions 自动发布 npm（OIDC Trusted Publishing，版本已存在自动跳过）。

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
