/**
 * Client half of the Digital Earth plugin.
 *
 * GENERATED FILE — do not edit. Author sources in src/client/, then run
 * `npm run build:client`. CI fails when this file is not the build output.
 */
window.__ModuleLoader__.load({
  id: "@cveo/dsh-digital-earth",
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  default: () => index_default,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/plugin.js
var import_react15 = __toESM(require("react"), 1);

// src/client/messages-v17.js
var V17_MESSAGES = {
  zh: {
    "bookmarks.captionPlaceholder": "这一站的说明（可选）",
    "btn.identify": "指认",
    "btn.identifyHint": "点击场景对象，查看命中级别、高程估计与来源",
    "selection.resultLabel": "识别结果",
    "selection.unnamed": "瓦片内要素",
    "selection.unnamed.tileset": "三维瓦片区域",
    "selection.unnamed.entity": "场景实体",
    "selection.unnamed.scene": "场景表面",
    "selection.unknownLayer": "来源图层未知",
    "selection.hint": "指认模式：点击场景对象，查看命中级别、高程估计与来源。",
    "selection.reading": "正在读取表面高程与邻域采样…",
    "selection.noHeight": "无可用高度估计",
    "selection.surfaceHeight": "表面高程（采样）",
    "selection.objectHeight": "高度估计（几何）",
    "selection.aboveMedian": "高于邻域中位数",
    "selection.aboveMedianHint": "对比基线为邻域表面高程中位数（24 点，含屋顶）",
    "selection.sampled": "邻域 {n} 点抽样",
    "selection.sampling": "邻域表面采样 {count} 点（{radii} m × 8 方位）",
    "selection.samplingHint": "邻域表面采样（含屋顶）；高程基准为 WGS84 椭球",
    "selection.footnote": "高度为几何估计；数据不含要素级属性。",
    "selection.flyHint": "相机飞近至该点上方约 120 m，俯角 -35°",
    "selection.measureHint": "进入高度量测，并把该点预填为第一个点",
    "selection.confidence.high": "高置信度",
    "selection.confidence.medium": "中置信度",
    "selection.confidence.low": "低置信度",
    "selection.fly": "抵近定位",
    "selection.measure": "高度量测",
    "selection.takeAway": "导出证据",
    "selection.exporting": "正在导出…",
    "selection.exportHint": "导出干净截图 PNG + 证据 JSON（坐标 / 高程 / 采样 / 来源 / 未知）",
    "selection.saved": "证据包已写入：{path}",
    "selection.saveFailed": "导出失败：{message}",
    "selection.noSurface": "此处无可用表面采样，请换一处。",
    "selection.notReady": "地球尚未就绪，请稍后重试。",
    "selection.failed": "读取失败，请重试或换一处。",
    "tour.title": "导览",
    "tour.start": "播放导览",
    "tour.needStops": "至少需要 2 个视角收藏才能播放导览。",
    "tour.stop": "第 {n} 站",
    "tour.progress": "{index} / {total}",
    "tour.play": "播放",
    "tour.pause": "暂停",
    "tour.prev": "上一站",
    "tour.next": "下一站",
    "tour.exit": "结束导览",
    "tour.finished": "导览结束，已保存一张截图。",
    "tour.hint": "拖动地球或点击别处即接管；Esc 结束。",
    "layers.details": "场景详情"
  },
  en: {
    "bookmarks.captionPlaceholder": "One sentence for this stop (optional)",
    "btn.identify": "Identify",
    "btn.identifyHint": "Click a scene object to inspect the hit level, height estimate and sources",
    "selection.resultLabel": "Identification",
    "selection.unnamed": "Feature inside a tile",
    "selection.unnamed.tileset": "3D tile region",
    "selection.unnamed.entity": "Scene entity",
    "selection.unnamed.scene": "Scene surface",
    "selection.unknownLayer": "source layer unknown",
    "selection.hint": "Identify mode: click a scene object to inspect the hit level, height estimate and sources.",
    "selection.reading": "Reading surface elevation and neighbourhood samples…",
    "selection.noHeight": "no height estimate",
    "selection.surfaceHeight": "Surface elevation (sampled)",
    "selection.objectHeight": "Height estimate (geometric)",
    "selection.aboveMedian": "Above neighbourhood median",
    "selection.aboveMedianHint": "Baseline: median of the 24 neighbourhood surface samples (roofs included)",
    "selection.sampled": "from {n} neighbourhood samples",
    "selection.sampling": "{count}-point neighbourhood surface sampling ({radii} m × 8 bearings)",
    "selection.samplingHint": "Neighbourhood surface sampling (roofs included); heights are WGS84 ellipsoidal",
    "selection.footnote": "Height is a geometric estimate; the data carries no feature-level attributes.",
    "selection.flyHint": "Fly the camera to about 120 m above the point, pitch -35°",
    "selection.measureHint": "Start a height measurement with this point prefilled",
    "selection.confidence.high": "High confidence",
    "selection.confidence.medium": "Medium confidence",
    "selection.confidence.low": "Low confidence",
    "selection.fly": "Approach object",
    "selection.measure": "Measure height",
    "selection.takeAway": "Export evidence",
    "selection.exporting": "Exporting…",
    "selection.exportHint": "Export a clean PNG plus an evidence JSON (position / elevation / sampling / source / unknowns)",
    "selection.saved": "Evidence pack written: {path}",
    "selection.saveFailed": "Export failed: {message}",
    "selection.noSurface": "No usable surface sample here - pick another point.",
    "selection.notReady": "The globe is not ready yet; try again shortly.",
    "selection.failed": "Read failed - retry or pick another point.",
    "tour.title": "Tour",
    "tour.start": "Play tour",
    "tour.needStops": "A tour needs at least 2 view bookmarks.",
    "tour.stop": "Stop {n}",
    "tour.progress": "{index} / {total}",
    "tour.play": "Play",
    "tour.pause": "Pause",
    "tour.prev": "Previous stop",
    "tour.next": "Next stop",
    "tour.exit": "End tour",
    "tour.finished": "Tour finished — one screenshot saved.",
    "tour.hint": "Drag the globe or click elsewhere to take over; Esc ends the tour.",
    "layers.details": "Scene details"
  }
};

// src/client/messages.js
var MESSAGES = {
  zh: {
    "panel.title": "数字地球",
    "panel.status.loading": "正在加载三维引擎…",
    "panel.status.ready": "就绪",
    "panel.status.layers": "{n} 个图层",
    "panel.empty.title": "在地球上叠加你的数据",
    "panel.empty.body": "打开本地目录或在线地址，把 3D Tiles（b3dm / glb / 3DGS）叠加到 CesiumJS 地球上；底图、地形与量测工具已就绪。",
    "panel.empty.local": "打开本地目录",
    "panel.empty.url": "加载在线地址",
    "panel.empty.dismiss": "关闭提示",
    "btn.data": "数据",
    "btn.openLocal": "打开本地目录…",
    "btn.openUrl": "加载在线地址…",
    "btn.layers": "图层",
    "btn.layersShow": "展开图层卡",
    "btn.layersHide": "收起图层卡",
    "btn.hud": "坐标 HUD",
    "btn.hudShow": "显示坐标 HUD",
    "btn.hudHide": "隐藏坐标 HUD",
    "btn.shaderShow": "打开着色器工作台",
    "btn.shaderHide": "关闭着色器工作台",
    "btn.basemap": "底图",
    "btn.terrain": "地形",
    "btn.measure": "量测",
    "btn.screenshot": "截图",
    "btn.askAgent": "问 Agent",
    "btn.reset": "复位",
    "btn.settings": "数据源与外观",
    "btn.appearance": "外观",
    "btn.close": "关闭",
    "btn.cancel": "取消",
    "btn.retry": "重试",
    "btn.save": "保存",
    "btn.add": "添加",
    "btn.edit": "编辑",
    "btn.delete": "删除",
    "btn.restore": "恢复默认",
    "btn.flyTo": "定位",
    "btn.visible": "显示",
    "btn.hidden": "隐藏",
    "menu.none": "无底图",
    "menu.terrainOff": "关闭地形",
    "menu.recentDirs": "最近打开",
    "menu.clearAgent": "清除 Agent 标注",
    "menu.report": "导出场景报告",
    "tool.distance": "测距",
    "tool.area": "测面",
    "tool.height": "测高",
    "tool.pick": "拾取属性",
    "tool.clear": "清除量测结果",
    "hud.pointer": "光标",
    "hud.center": "视线中心",
    "hud.camera": "相机高度",
    "hud.cameraPos": "相机位置",
    "hud.heading": "朝向",
    "hud.tiles": "瓦片",
    "hud.pending": "待加载",
    "hud.triangles": "三角面",
    "hud.layers": "图层",
    "hud.cache": "缓存",
    "hud.elevation": "高程 {value}",
    "hud.empty": "—",
    "hud.fpsTitle": "按 Cesium 渲染帧统计的平滑帧率（窗口刷新率不等于渲染帧；静止 2 秒显示 —）",
    "settings.terrainDepthTest": "地形遮挡三维图层（深度测试）",
    "settings.terrainDepthTestHint": "关闭（默认）：地下管网、埋在地形下的模型都能看见；开启：地形会挡住埋在下面的内容，天际线更干净。",
    "settings.quality": "渲染质量",
    "settings.qualityHint": "均衡（默认）略微降低分辨率与地形 / 瓦片细节，拖动更流畅；高清使用满分辨率与 4× MSAA。抗锯齿档位在重新打开面板后完全生效。",
    "settings.qualityBalanced": "均衡（流畅优先）",
    "settings.qualityHigh": "高清（画质优先）",
    "layers.title": "图层",
    "layers.collapse": "收起图层卡",
    "layers.terrain": "地形（L1）",
    "layers.imagery": "影像底图（L2）",
    "layers.raster": "栅格叠加（L3）",
    "layers.vector": "矢量叠加（L4）",
    "layers.content": "三维内容层",
    "layers.addOverlay": "＋ 添加叠加层",
    "layers.overlayAdd": "添加",
    "layers.overlayCancel": "取消",
    "layers.overlayType": "类型",
    "layers.overlayName": "名称",
    "layers.overlayUrl": "服务地址",
    "layers.overlayLayers": "WMS 图层名",
    "layers.overlayOpacity": "透明度",
    "layers.overlayRemove": "移除叠加层",
    "layers.overlayUp": "上移一层",
    "layers.overlayDown": "下移一层",
    "layers.overlayInvalid": "请填写类型、服务地址；WMS 还需要图层名。",
    "layers.emptyRaster": "暂无叠加层",
    "layers.vectorDrawn": "标注要素",
    "layers.vectorMeasured": "量测点",
    "layers.vectorRemove": "移除该叠加",
    "layers.frameAll": "框全所有可见图层",
    "layers.analysis": "空间分析",
    "layers.analysisHint": "剖面 / 淹没 / 日照 / 剖切 / 天际线分析由对话 Agent 执行（例如：「对当前图层做一条从 A 到 B 的剖面」）；结果会显示在这里，可在此清除。",
    "layers.analysisClear": "清除分析",
    "layers.shader": "着色器效果",
    "layers.shaderEmpty": "暂无着色器效果；在着色器工作台应用预设后会出现在这里。",
    "shader.editEntry": "选中并编辑该效果",
    "shader.removeEntry": "移除该效果",
    "shader.entryTooltip": "{layer} · {presets}｜参数：{params}",
    "shader.entryNoParams": "默认参数",
    "bookmarks.title": "视角收藏",
    "bookmarks.save": "＋ 保存当前视角",
    "bookmarks.empty": "暂无收藏视角",
    "bookmarks.remove": "删除该视角",
    "bookmarks.flyHint": "点击飞到该视角",
    "bookmarks.noView": "面板尚未就绪，无法读取当前视角。",
    "bookmarks.saveFailed": "本地存储不可用，收藏只保留在本次会话。",
    "urlbar.placeholder": "tileset.json 的 http(s) 地址，或本地绝对路径",
    "urlbar.submit": "加载",
    "toast.scanEmpty": "该目录下没有找到 tileset.json",
    "toast.scanFailed": "打开目录失败：{message}",
    "toast.dialogUnavailable": "目录选择服务不可用",
    "toast.invalidPath": "本地路径无效",
    "toast.invalidUrl": "请输入 http(s) 地址或本地 tileset.json 路径",
    "toast.proxyFallback": "直连失败，已通过本地代理加载",
    "toast.loadFailed": "加载失败：{message}",
    "toast.loadingData": "正在加载数据…",
    "toast.requestTimeout": "请求超时（{seconds} 秒），已放弃等待",
    "toast.busyDirectory": "正在打开目录…",
    "toast.restoreTimeout": "恢复上次场景时部分图层超时，已跳过（面板可直接使用）。",
    "toast.terrainLoading": "正在加载地形…",
    "toast.terrainOn": "已开启地形：{name}",
    "toast.terrainOff": "已关闭地形，恢复椭球",
    "toast.terrainNetwork": "地形服务不可达（{message}），已回退椭球：请检查网络/代理后点「重试地形」。",
    "terrain.networkHint": "地形服务不可达（{message}），当前使用椭球。检查网络/代理后点重试，或在「设置 → 数据源」关闭或更换地形。",
    "terrain.failedHint": "地形加载失败（{message}），当前使用椭球。",
    "terrain.retry": "重试地形",
    "toast.terrainFailed": "地形加载失败，继续使用椭球：{message}",
    "toast.basemap": "已切换底图：{name}",
    "toast.basemapNone": "已关闭影像底图",
    "toast.basemapFailed": "底图加载失败：{message}",
    "toast.overlayFailed": "叠加图层「{name}」加载失败：{message}",
    "toast.screenshotSaved": "截图已保存",
    "toast.screenshotFailed": "截图失败：{message}",
    "toast.sourcesSaved": "数据源已保存",
    "toast.saveFailed": "保存失败：{message}",
    "toast.shaderApplied": "已应用预设：{preset}（{layer}）",
    "toast.shaderReset": "已重置图层着色器：{layer}",
    "toast.shaderResetAll": "已清除全部图层着色器",
    "toast.noSurface": "该位置没有可拾取的表面",
    "toast.pickNone": "未拾取到对象",
    "measure.start": "左键点击取点，双击结束",
    "measure.distance": "总长 {value} · 双击结束",
    "measure.area": "面积 {value} · 双击结束",
    "measure.height": "高差 {value} · 水平距 {distance}",
    "measure.end": "结束",
    "measure.endHint": "结束当前量测（Esc）",
    "measure.total": "总长 {value}",
    "measure.areaLabel": "面积 {value}",
    "pick.title": "拾取对象",
    "pick.type": "类型",
    "pick.layer": "图层",
    "pick.name": "名称",
    "pick.entity": "实体",
    "pick.scene": "场景对象",
    "pick.tiles": "3D Tiles 模型",
    "pick.noProperties": "说明",
    "pick.noPropertiesValue": "该瓦片没有属性表",
    "model.unnamed": "3D Tiles 模型",
    "credit.imagery": "影像",
    "settings.title": "设置",
    "settings.tab.imagery": "影像底图",
    "settings.tab.terrain": "地形",
    "settings.tab.appearance": "外观",
    "settings.imageryHint": "此处维护「底图」菜单中的影像源；单选按钮切换当前底图。",
    "settings.terrainHint": "此处维护可选的地形源；单选按钮用于开启或切换地形。",
    "settings.empty": "还没有数据源，点击「添加」新建一个。",
    "settings.field.name": "名称",
    "settings.field.type": "类型",
    "settings.field.url": "地址",
    "settings.field.credit": "版权署名",
    "settings.field.maxLevel": "最大层级",
    "settings.field.subdomains": "子域名（逗号分隔）",
    "settings.field.tms": "TMS（Y 轴南起）",
    "settings.field.localTiles": "选择本地瓦片目录…",
    "settings.field.layers": "WMS 图层名",
    "settings.field.tilingScheme": "投影方式",
    "settings.field.normals": "请求顶点法线",
    "settings.field.waterMask": "请求水面掩膜",
    "settings.type.xyz": "XYZ 瓦片模板",
    "settings.type.arcgis": "ArcGIS 服务",
    "settings.type.wms": "WMS",
    "settings.type.cesium": "Cesium 地形",
    "settings.tiling.webMercator": "Web 墨卡托",
    "settings.tiling.geographic": "经纬度",
    "settings.required": "请填写名称与地址",
    "settings.deleteConfirm": "确定删除数据源「{name}」？",
    "settings.restoreConfirm": "恢复默认数据源？当前配置将被覆盖。",
    "theme.auto": "跟随系统",
    "theme.light": "浅色",
    "theme.dark": "深色",
    "theme.appearanceHint": "默认跟随 DSH / 系统的浅深色；选择具体模式可覆盖本面板的外观。",
    "tab.title": "数字地球",
    "header.open": "在对话旁打开数字地球",
    "btn.beside": "在对话旁打开",
    "btn.fullscreen": "全屏",
    "btn.fullscreenTitle": "全屏（按 Esc 退出）",
    "btn.fullscreenExit": "退出全屏",
    "tool.action.status": "读取场景",
    "tool.action.list": "读取图层",
    "tool.action.load": "加载图层",
    "tool.action.remove": "移除图层",
    "tool.action.visible": "切换可见",
    "tool.action.basemap": "切换底图",
    "tool.action.terrain": "切换地形",
    "tool.action.fly": "移动视角",
    "tool.action.reset": "复位视角",
    "tool.action.pick": "拾取对象",
    "tool.action.inspect": "数据体检",
    "tool.action.report": "导出报告",
    "tool.action.capture": "截图",
    "tool.action.draw": "绘制标注",
    "tool.action.measure": "量测",
    "tool.action.analyze": "分析",
    "tool.action.shader": "着色器",
    "tool.action.clearAgent": "清除标注",
    "tool.action.generic": "三维场景",
    "tool.open": "打开",
    "tool.openTip": "在对话右侧打开数字地球",
    "tool.thumbOpen": "查看截图",
    "settings.tab.about": "关于",
    "settings.autoOpenPanel": "Agent 调用时自动打开数字地球",
    "settings.autoOpenPanelHint": "Agent 调用地球工具（earth_scene / earth_capture / earth_draw / earth_measure / earth_analyze / earth_shader）时，自动在对话右侧打开数字地球面板；关闭后仍可从对话标题栏的地球按钮手动打开。该偏好只保存在本机浏览器。",
    "settings.screenshotHud": "截图时叠加坐标 HUD 与署名",
    "settings.screenshotHudHint": "默认关闭：截图只保留干净的三维画面，便于分享或交给模型识别。打开后会在图片内叠加光标坐标、相机参数与团队署名（面板工具栏属于网页元素，不会进入图片）。",
    "settings.showLayers": "显示图层卡",
    "settings.showLayersHint": "关闭后图层卡从画布上收起；仍可从工具栏的「图层」按钮重新展开。该偏好会写回数据源配置。",
    "settings.showHud": "显示坐标 HUD",
    "settings.showHudHint": "关闭后不渲染左下角的坐标/瓦片统计，并停止指针采样以节省性能。截图默认仍不叠加 HUD；该偏好会写回数据源配置。",
    "settings.hudDetailed": "HUD 详细模式",
    "settings.hudDetailedHint": "默认关闭：左下角只显示 FPS、光标读数与相机高度。打开后额外显示朝向 / 俯仰与逐层瓦片 / 待加载 / 三角面 / 缓存；该偏好会写回数据源配置。",
    "about.version": "版本",
    "about.homepage": "项目源码",
    "about.issues": "问题反馈",
    "about.team": "开发团队",
    "about.teamName": "武汉大学 CVEO 课题组",
    "about.license": "MIT License",
    "about.licenseLabel": "许可",
    "about.intro": "在 DSH 对话里直接查看、操控三维地球：叠加 3D Tiles / 3DGS、影像底图与地形，并让 Agent 读取场景、截图，与自然语言对话协同。",
    "about.agent": "Agent 集成",
    "about.agent.on": "已连接，可被对话调用",
    "about.agent.off": "面板打开后自动连接",
    "about.agent.stale": "连接已断开，刷新页面后自动重连",
    "btn.health": "数据体检",
    "health.title": "数据体检",
    "health.loading": "正在体检数据…",
    "health.failed": "体检失败：{message}",
    "health.noSource": "该图层没有可体检的数据来源，请重新加载后再试。",
    "health.source": "来源",
    "health.sourceLabel": "图层",
    "health.kind.local": "本地",
    "health.kind.remote": "远程",
    "health.assetVersion": "资产版本",
    "health.tiles": "瓦片数",
    "health.contents": "内容数",
    "health.depth": "LOD 深度",
    "health.extensions": "扩展",
    "health.rootError": "根几何误差",
    "health.boundingVolume": "包围体",
    "health.reportPath": "报告路径",
    "health.copy": "复制路径",
    "health.copied": "报告路径已复制",
    "health.copyFailed": "复制失败，请手动选择报告路径",
    "health.issues": "问题",
    "health.noIssues": "未发现数据问题",
    "health.runtime": "当前运行统计",
    "health.level.error": "错误",
    "health.level.warn": "警告",
    "health.level.info": "提示",
    "health.unknown": "—",
    "agent.unknownSource": "无法确定图层「{name}」的数据来源：请重新加载该图层后再体检。",
    "agent.notReady": "三维引擎尚未就绪，请稍后再试。",
    "agent.hiddenPanel": "数字地球面板当前不可见（已切到别的页签或窗口在后台），无法渲染截图。请先切到右侧「数字地球」页签、保持窗口在前台，再重试。",
    "agent.captureTooLarge": "截图体积超过上限，请降低 width 后重试。",
    "agent.noViewer": "数字地球画布不可用，请刷新页面后重试。",
    "agent.missingLayer": "请提供 layer（图层 id 或名称）。",
    "agent.unknownLayer": "找不到图层「{name}」，当前图层：{list}",
    "agent.missingUrl": "请提供 http(s) 地址或本地 tileset.json 路径。",
    "agent.dirDenied": "访问本地目录失败（{message}）。请重试一次以重新触发授权；若仍失败，请在面板中授权该目录后再试。",
    "agent.missingCoords": "请提供 lon 与 lat。",
    "agent.unknownImagery": "找不到影像源「{name}」，可用：{list}",
    "agent.unknownTerrain": "找不到地形源「{name}」，可用：{list}",
    "agent.badAction": "不支持的操作：{action}",
    "agent.badGeojson": "标注数据无效：{message}",
    "agent.badMeasure": "量测参数无效：{message}",
    "agent.measureEmpty": "没有可用的量测结果。",
    "agent.clearedOverlays": "已清除 Agent 标注",
    "access.title": "授权访问本地数据",
    "access.body": "Agent 想从这个本地路径加载数据。允许后，面板会先把该文件所在目录登记为可读取的本地数据源（仅本页面会话内有效），然后继续操作。",
    "access.dir": "目录",
    "access.path": "请求路径",
    "access.target": "解析到的文件",
    "access.file": "文件",
    "access.allowing": "正在登记目录…",
    "access.request.load": "加载 3D Tiles",
    "access.request.inspect": "数据体检",
    "access.request.generic": "读取本地数据",
    "access.missing": "该路径当前未找到 tileset.json：允许后 Host 会继续在上层目录内查找唯一候选，找到才会加载。",
    "access.resolved": "已在上层目录中找到候选文件，允许后加载这个文件：",
    "access.allow": "允许并继续",
    "access.cancel": "取消",
    "access.denied": "用户取消了本地路径授权，本次操作未执行。",
    "access.scanFailed": "目录登记失败，本次操作未执行：{message}",
    "access.remote": "仅本地路径需要授权；在线地址无需此步骤。",
    "access.badPath": "授权请求缺少有效的本地路径。",
    "analysis.title.profile": "地形剖面",
    "analysis.title.flood": "淹没分析",
    "analysis.title.sunlight": "日照分析",
    "analysis.title.clip": "剖切分析",
    "analysis.title.skyline": "天际线分析",
    "analysis.skylineAngle": "最大仰角",
    "analysis.skylineDistance": "出现距离",
    "analysis.skylineEye": "观察点高度",
    "analysis.skylineEyeValue": "观察点 {value}",
    "analysis.skylineMax": "天际线 {value} · {angle}",
    "analysis.clipHeight": "剖切高程",
    "analysis.clipKeep": "保留侧",
    "analysis.clipKeepAbove": "平面以上",
    "analysis.clipKeepBelow": "平面以下",
    "analysis.clipPlanes": "剖切面",
    "analysis.layer": "图层",
    "analysis.collapse": "折叠分析卡",
    "analysis.expand": "展开分析卡",
    "analysis.close": "关闭分析卡",
    "analysis.chart": "距离—高程剖面",
    "analysis.length": "剖面长度",
    "analysis.minHeight": "最低高程",
    "analysis.maxHeight": "最高高程",
    "analysis.relief": "起伏",
    "analysis.gain": "累计爬升",
    "analysis.loss": "累计下降",
    "analysis.samples": "采样点",
    "analysis.region": "分析范围",
    "analysis.waterHeight": "水位",
    "analysis.area": "分析面积",
    "analysis.inundated": "淹没面积",
    "analysis.inundatedRatio": "淹没比例",
    "analysis.depthMax": "最大水深",
    "analysis.depthMean": "平均水深",
    "analysis.inundatedSamples": "淹没格点",
    "analysis.altitude": "高度角",
    "analysis.azimuth": "方位角",
    "analysis.datetime": "时间",
    "analysis.shadows": "阴影",
    "analysis.shadowsOn": "已开启",
    "analysis.shadowsOff": "已关闭",
    "analysis.night": "夜间",
    "analysis.day": "白天",
    "analysis.daylight": "昼夜",
    "analysis.hint": "单次仅保留一个分析；再次分析或调用 clear 会替换当前结果。",
    "analysis.start": "起点 {value}",
    "analysis.end": "终点 {value}",
    "analysis.waterLabel": "水面 {value}",
    "analysis.sunLabel": "太阳 {altitude}° / {azimuth}°",
    "shader.title": "着色器工作台",
    "shader.close": "关闭着色器工作台",
    "shader.layerLabel": "目标图层",
    "shader.layerAuto": "最上可见图层（自动）",
    "shader.presetLabel": "预设",
    "shader.preset.height-false-color": "高程渐变",
    "shader.preset.contour": "等高线",
    "shader.preset.scan": "高度扫描",
    "shader.preset.water": "水面波纹",
    "shader.preset.water-depth": "水深着色",
    "shader.targetChip": "作用于 {name}",
    "shader.targetNone": "暂无可作用图层",
    "shader.layerAutoNamed": "自动选择（{name}）",
    "shader.targetAuto": "自动目标：{name}（最上层的可见 3D Tiles）",
    "shader.targetFixed": "已固定：{name}",
    "shader.orderLabel": "叠加顺序",
    "shader.moveUp": "上移一层",
    "shader.moveDown": "下移一层",
    "shader.removePreset": "从叠加中移除",
    "shader.livePreview": "实时预览（拖动滑杆时连续更新，约 0.2 s 合并一次）",
    "shader.compare": "原图对比",
    "shader.compareOn": "正在看原图",
    "shader.compareHint": "按住对比：临时切回图层原始外观，松开或关闭面板后恢复",
    "shader.appliedTag": "已应用",
    "shader.param.waterHeight": "水面高程 (m)",
    "shader.param.depthMax": "最大映射深度 (m)",
    "shader.stackHint": "点选预设可叠加，最多 3 个（按点选顺序合成）；再点一次取消。",
    "shader.param.minHeight": "最小高程 (m)",
    "shader.param.maxHeight": "最大高程 (m)",
    "shader.param.auto": "自动",
    "shader.param.interval": "等高距 (m)",
    "shader.param.speed": "动画速度",
    "shader.param.amplitude": "波幅",
    "shader.param.opacity": "不透明度",
    "shader.apply": "应用预设",
    "shader.resetLayer": "重置当前图层",
    "shader.resetAll": "全部重置",
    "shader.active": "活动预设",
    "shader.activeEmpty": "尚未应用任何预设",
    "shader.noLayers": "先加载 3D Tiles 图层，再应用着色器预设。",
    "toast.captureSaved": "已生成 {width}×{height} 截图：{path}",
    "toast.askAgentSent": "场景摘要已注入对话，在下一步生效；直接输入问题即可。",
    "toast.askAgentFailed": "发送场景失败：{message}",
    "toast.askAgentNoSession": "请先打开一个会话，再使用「问 Agent」。",
    "toast.reportSaved": "场景报告已保存：{path}",
    "toast.reportFailed": "导出报告失败：{message}",
    "toast.noSession": "请先打开一个会话，再在对话旁查看数字地球。",
    "toast.fullscreenUnsupported": "当前浏览器不支持全屏 API。",
    "toast.fullscreenFailed": "全屏失败：{message}",
    "unit.hectare": "公顷",
    // v1.7 P0 vocabulary (identify card / evidence export / tour bar).
    ...V17_MESSAGES.zh
  },
  en: {
    "panel.title": "Digital Earth",
    "panel.status.loading": "Loading 3D engine…",
    "panel.status.ready": "Ready",
    "panel.status.layers": "{n} layers",
    "panel.empty.title": "Lay your data over the globe",
    "panel.empty.body": "Open a local folder or an online URL to add 3D Tiles (b3dm / glb / 3DGS) to this CesiumJS globe. Imagery, terrain and measurement tools are ready.",
    "panel.empty.local": "Open local folder",
    "panel.empty.url": "Load from URL",
    "panel.empty.dismiss": "Dismiss",
    "btn.data": "Data",
    "btn.openLocal": "Open local folder…",
    "btn.openUrl": "Load from URL…",
    "btn.layers": "Layers",
    "btn.layersShow": "Show layer card",
    "btn.layersHide": "Hide layer card",
    "btn.hud": "Coordinate HUD",
    "btn.hudShow": "Show coordinate HUD",
    "btn.hudHide": "Hide coordinate HUD",
    "btn.shaderShow": "Open shader workbench",
    "btn.shaderHide": "Close shader workbench",
    "btn.basemap": "Basemap",
    "btn.terrain": "Terrain",
    "btn.measure": "Measure",
    "btn.screenshot": "Snapshot",
    "btn.askAgent": "Ask Agent",
    "btn.reset": "Reset",
    "btn.settings": "Sources & appearance",
    "btn.appearance": "Appearance",
    "btn.close": "Close",
    "btn.cancel": "Cancel",
    "btn.retry": "Retry",
    "btn.save": "Save",
    "btn.add": "Add",
    "btn.edit": "Edit",
    "btn.delete": "Delete",
    "btn.restore": "Restore defaults",
    "btn.flyTo": "Fly to",
    "btn.visible": "Show",
    "btn.hidden": "Hide",
    "menu.none": "No basemap",
    "menu.terrainOff": "Terrain off",
    "menu.recentDirs": "Recently opened",
    "menu.clearAgent": "Clear Agent annotations",
    "menu.report": "Export scene report",
    "tool.distance": "Distance",
    "tool.area": "Area",
    "tool.height": "Height",
    "tool.pick": "Pick properties",
    "tool.clear": "Clear measurements",
    "hud.pointer": "Cursor",
    "hud.center": "View centre",
    "hud.camera": "Camera",
    "hud.cameraPos": "Camera position",
    "hud.heading": "Heading",
    "hud.tiles": "Tiles",
    "hud.pending": "Pending",
    "hud.triangles": "Triangles",
    "hud.layers": "Layers",
    "hud.cache": "Cache",
    "hud.elevation": "Elev {value}",
    "hud.empty": "—",
    "hud.fpsTitle": "Smoothed frame rate counted from Cesium render passes (window refresh rate is not render throughput; — after 2 s without a render)",
    "settings.terrainDepthTest": "Terrain occludes 3D layers (depth test)",
    "settings.terrainDepthTestHint": "Off (default): underground pipes and models buried under the terrain stay visible. On: terrain hides what is below it and the skyline reads cleaner.",
    "settings.quality": "Render quality",
    "settings.qualityHint": "Balanced (default) trims resolution and terrain / 3D Tiles detail to stay smooth while dragging; High keeps full resolution and 4× MSAA. The anti-aliasing tier applies after the panel is reopened.",
    "settings.qualityBalanced": "Balanced (smoother)",
    "settings.qualityHigh": "High (sharper)",
    "layers.title": "Layers",
    "layers.collapse": "Collapse layer card",
    "layers.terrain": "Terrain (L1)",
    "layers.imagery": "Imagery basemap (L2)",
    "layers.raster": "Raster overlays (L3)",
    "layers.vector": "Vector overlays (L4)",
    "layers.content": "3D Tiles layers",
    "layers.addOverlay": "+ Add overlay",
    "layers.overlayAdd": "Add",
    "layers.overlayCancel": "Cancel",
    "layers.overlayType": "Type",
    "layers.overlayName": "Name",
    "layers.overlayUrl": "Service URL",
    "layers.overlayLayers": "WMS layer name",
    "layers.overlayOpacity": "Opacity",
    "layers.overlayRemove": "Remove overlay",
    "layers.overlayUp": "Move up",
    "layers.overlayDown": "Move down",
    "layers.overlayInvalid": "Fill in the type and service URL; WMS also needs a layer name.",
    "layers.emptyRaster": "No overlays yet",
    "layers.vectorDrawn": "drawn features",
    "layers.vectorMeasured": "measured points",
    "layers.vectorRemove": "Remove this overlay",
    "layers.frameAll": "Frame all visible layers",
    "layers.analysis": "Spatial analysis",
    "layers.analysisHint": "Profile / flood / sunlight / clip / skyline analyses are run by the conversation Agent (e.g. “profile the current layer from A to B”); results appear here and can be cleared here.",
    "layers.analysisClear": "Clear analysis",
    "layers.shader": "Shader effects",
    "layers.shaderEmpty": "No shader effects yet; applying a preset in the workbench lists it here.",
    "shader.editEntry": "Select and edit this effect",
    "shader.removeEntry": "Remove this effect",
    "shader.entryTooltip": "{layer} · {presets} | params: {params}",
    "shader.entryNoParams": "defaults",
    "bookmarks.title": "View bookmarks",
    "bookmarks.save": "+ Save current view",
    "bookmarks.empty": "No saved views yet",
    "bookmarks.remove": "Remove this view",
    "bookmarks.flyHint": "Click to fly to this view",
    "bookmarks.noView": "The panel is not ready, so the current view cannot be read.",
    "bookmarks.saveFailed": "Local storage is unavailable; bookmarks last for this session only.",
    "urlbar.placeholder": "http(s) URL of tileset.json, or an absolute local path",
    "urlbar.submit": "Load",
    "toast.scanEmpty": "No tileset.json found in that folder",
    "toast.scanFailed": "Failed to open folder: {message}",
    "toast.dialogUnavailable": "Directory picker is unavailable",
    "toast.invalidPath": "Invalid local path",
    "toast.invalidUrl": "Enter an http(s) URL or a local tileset.json path",
    "toast.proxyFallback": "Direct request failed; loaded through the local proxy",
    "toast.loadFailed": "Load failed: {message}",
    "toast.loadingData": "Loading dataset…",
    "toast.requestTimeout": "Request timed out after {seconds}s",
    "toast.busyDirectory": "Opening folder…",
    "toast.restoreTimeout": "Some layers from the previous scene timed out and were skipped; the panel is ready to use.",
    "toast.terrainLoading": "Loading terrain…",
    "toast.terrainOn": "Terrain enabled: {name}",
    "toast.terrainOff": "Terrain off; ellipsoid restored",
    "toast.terrainNetwork": "Terrain service unreachable ({message}); using the ellipsoid. Check network/proxy and press retry terrain.",
    "terrain.networkHint": "Terrain service unreachable ({message}); using the ellipsoid. Check network/proxy and retry, or turn terrain off / pick another source in Settings → Data sources.",
    "terrain.failedHint": "Terrain failed to load ({message}); using the ellipsoid.",
    "terrain.retry": "Retry terrain",
    "toast.terrainFailed": "Terrain failed; keeping the ellipsoid: {message}",
    "toast.basemap": "Basemap: {name}",
    "toast.basemapNone": "Imagery basemap off",
    "toast.basemapFailed": "Basemap failed: {message}",
    "toast.overlayFailed": 'Overlay layer "{name}" failed: {message}',
    "toast.screenshotSaved": "Snapshot saved",
    "toast.screenshotFailed": "Snapshot failed: {message}",
    "toast.sourcesSaved": "Sources saved",
    "toast.saveFailed": "Save failed: {message}",
    "toast.shaderApplied": "Preset applied: {preset} ({layer})",
    "toast.shaderReset": "Shader reset on layer: {layer}",
    "toast.shaderResetAll": "All layer shaders cleared",
    "toast.noSurface": "No pickable surface there",
    "toast.pickNone": "Nothing picked",
    "measure.start": "Left-click to add points, double-click to finish",
    "measure.distance": "Total {value} · double-click to finish",
    "measure.area": "Area {value} · double-click to finish",
    "measure.height": "Δh {value} · horizontal {distance}",
    "measure.end": "End",
    "measure.endHint": "End the current measurement (Esc)",
    "measure.total": "Total {value}",
    "measure.areaLabel": "Area {value}",
    "pick.title": "Picked object",
    "pick.type": "Type",
    "pick.layer": "Layer",
    "pick.name": "Name",
    "pick.entity": "Entity",
    "pick.scene": "Scene object",
    "pick.tiles": "3D Tiles model",
    "pick.noProperties": "Info",
    "pick.noPropertiesValue": "This tile has no property table",
    "model.unnamed": "3D Tiles model",
    "credit.imagery": "Imagery",
    "settings.title": "Settings",
    "settings.tab.imagery": "Imagery",
    "settings.tab.terrain": "Terrain",
    "settings.tab.appearance": "Appearance",
    "settings.imageryHint": "Manage the imagery sources offered in the Basemap menu; the radio button picks the active one.",
    "settings.terrainHint": "Manage the available terrain sources; the radio button enables or switches terrain.",
    "settings.empty": "No sources yet — click Add to create one.",
    "settings.field.name": "Name",
    "settings.field.type": "Type",
    "settings.field.url": "URL",
    "settings.field.credit": "Credit",
    "settings.field.maxLevel": "Max zoom level",
    "settings.field.subdomains": "Subdomains (comma separated)",
    "settings.field.tms": "TMS (south-origin Y)",
    "settings.field.localTiles": "Pick local tiles…",
    "settings.field.layers": "WMS layers",
    "settings.field.tilingScheme": "Projection",
    "settings.field.normals": "Request vertex normals",
    "settings.field.waterMask": "Request water mask",
    "settings.type.xyz": "XYZ tile template",
    "settings.type.arcgis": "ArcGIS service",
    "settings.type.wms": "WMS",
    "settings.type.cesium": "Cesium terrain",
    "settings.tiling.webMercator": "Web Mercator",
    "settings.tiling.geographic": "Geographic",
    "settings.required": "Name and URL are required",
    "settings.deleteConfirm": 'Delete source "{name}"?',
    "settings.restoreConfirm": "Restore default sources? The current configuration is replaced.",
    "theme.auto": "Follow system",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.appearanceHint": "Follows the DSH / system light-dark theme by default; pick a mode to override this panel only.",
    "tab.title": "Digital Earth",
    "header.open": "Open Digital Earth beside the chat",
    "btn.beside": "Open beside chat",
    "btn.fullscreen": "Fullscreen",
    "btn.fullscreenTitle": "Fullscreen (Esc exits)",
    "btn.fullscreenExit": "Exit fullscreen",
    "tool.action.status": "Read scene",
    "tool.action.list": "List layers",
    "tool.action.load": "Load layer",
    "tool.action.remove": "Remove layer",
    "tool.action.visible": "Toggle visibility",
    "tool.action.basemap": "Switch basemap",
    "tool.action.terrain": "Switch terrain",
    "tool.action.fly": "Move camera",
    "tool.action.reset": "Reset view",
    "tool.action.pick": "Pick object",
    "tool.action.inspect": "Data check",
    "tool.action.report": "Export report",
    "tool.action.capture": "Snapshot",
    "tool.action.draw": "Draw annotations",
    "tool.action.measure": "Measure",
    "tool.action.analyze": "Analyze",
    "tool.action.shader": "Shader",
    "tool.action.clearAgent": "Clear annotations",
    "tool.action.generic": "3D scene",
    "tool.open": "Open",
    "tool.openTip": "Open Digital Earth beside the chat",
    "tool.thumbOpen": "Open snapshot",
    "settings.tab.about": "About",
    "settings.autoOpenPanel": "Open Digital Earth automatically on Agent calls",
    "settings.autoOpenPanelHint": "When the Agent calls an earth tool (earth_scene / earth_capture / earth_draw / earth_measure / earth_analyze / earth_shader), open the Digital Earth panel beside the conversation; with this off you can still open it from the globe button in the chat header. The preference is stored in this browser only.",
    "settings.screenshotHud": "Overlay coordinate HUD and credits in snapshots",
    "settings.screenshotHudHint": "Off by default: snapshots keep only the clean 3D view, which is easier to share or hand to a model. Turn it on to burn the cursor coordinates, camera parameters and team credit into the image (the panel toolbar is DOM chrome and can never be part of the image).",
    "settings.showLayers": "Show the layer card",
    "settings.showLayersHint": "When off, the layer card collapses off the canvas; reopen it from the Layers button in the toolbar. The preference is written back to the sources config.",
    "settings.showHud": "Show the coordinate HUD",
    "settings.showHudHint": "When off, the bottom-left coordinates/tile statistics are not rendered and pointer sampling stops to save performance. Snapshots still hide the HUD by default; the preference is written back to the sources config.",
    "settings.hudDetailed": "Detailed HUD",
    "settings.hudDetailedHint": "Off by default: the bottom-left HUD shows FPS, the cursor readout and camera height only. Turn it on to add heading / pitch and per-layer tiles / pending / triangles / cache; the preference is written back to the sources config.",
    "about.version": "Version",
    "about.homepage": "Source code",
    "about.issues": "Report an issue",
    "about.team": "Developed by",
    "about.teamName": "Wuhan University CVEO Research Group",
    "about.license": "MIT License",
    "about.licenseLabel": "License",
    "about.intro": "Inspect and drive a 3D earth right inside a DSH conversation: stack 3D Tiles / 3DGS, imagery and terrain, and let the Agent read the scene, take snapshots and work with it in natural language.",
    "about.agent": "Agent integration",
    "about.agent.on": "Connected and callable from chat",
    "about.agent.off": "Connects when the panel opens",
    "about.agent.stale": "Connection lost; reload the page to reconnect",
    "btn.health": "Data check",
    "health.title": "Data health check",
    "health.loading": "Checking the dataset…",
    "health.failed": "Data check failed: {message}",
    "health.noSource": "This layer has no inspectable source; reload it and try again.",
    "health.source": "Source",
    "health.sourceLabel": "Layer",
    "health.kind.local": "Local",
    "health.kind.remote": "Remote",
    "health.assetVersion": "Asset version",
    "health.tiles": "Tiles",
    "health.contents": "Contents",
    "health.depth": "LOD depth",
    "health.extensions": "Extensions",
    "health.rootError": "Root geometric error",
    "health.boundingVolume": "Bounding volume",
    "health.reportPath": "Report path",
    "health.copy": "Copy path",
    "health.copied": "Report path copied",
    "health.copyFailed": "Copy failed; select the report path manually",
    "health.issues": "Issues",
    "health.noIssues": "No data issues found",
    "health.runtime": "Current runtime statistics",
    "health.level.error": "Error",
    "health.level.warn": "Warning",
    "health.level.info": "Info",
    "health.unknown": "—",
    "agent.unknownSource": 'Cannot determine the data source of layer "{name}"; reload the layer and inspect it again.',
    "agent.notReady": "The 3D engine is not ready yet; retry in a moment.",
    "agent.hiddenPanel": "The Digital Earth panel is not visible (another tab is selected or the window is in the background), so no frame can be rendered. Switch to the Digital Earth tab in the right sidebar, keep the window in the foreground, then retry.",
    "agent.captureTooLarge": "The screenshot exceeds the size limit; retry with a smaller width.",
    "agent.noViewer": "The 3D canvas is unavailable; refresh the page and retry.",
    "agent.missingLayer": "Provide layer (a layer id or name).",
    "agent.unknownLayer": 'No layer "{name}". Current layers: {list}',
    "agent.missingUrl": "Provide an http(s) URL or a local tileset.json path.",
    "agent.dirDenied": "Could not access that local folder ({message}). Retry once to trigger the authorisation prompt; if it still fails, authorise the folder in the panel and try again.",
    "agent.missingCoords": "Provide lon and lat.",
    "agent.unknownImagery": 'No imagery source "{name}". Available: {list}',
    "agent.unknownTerrain": 'No terrain source "{name}". Available: {list}',
    "agent.badAction": "Unsupported action: {action}",
    "agent.badGeojson": "Invalid annotation data: {message}",
    "agent.badMeasure": "Invalid measurement arguments: {message}",
    "agent.measureEmpty": "No measurement result was produced.",
    "agent.clearedOverlays": "Agent annotations cleared",
    "access.title": "Allow local data access",
    "access.body": "The Agent wants to load data from this local path. If you allow it, the panel first registers the containing folder as a readable local data source (for this page session only), then continues the operation.",
    "access.dir": "Folder",
    "access.path": "Requested path",
    "access.target": "Resolved file",
    "access.file": "File",
    "access.allowing": "Registering the folder…",
    "access.request.load": "Load 3D Tiles",
    "access.request.inspect": "Data health check",
    "access.request.generic": "read local data",
    "access.missing": "No tileset.json exists at that exact path right now: after you allow it, the Host keeps looking for a single candidate inside the ancestor folder and only loads the file when exactly one is found.",
    "access.resolved": "A candidate file was found in an ancestor folder; allowing loads this file:",
    "access.allow": "Allow and continue",
    "access.cancel": "Cancel",
    "access.denied": "The user cancelled the local path authorisation, so the operation did not run.",
    "access.scanFailed": "The folder could not be registered, so the operation did not run: {message}",
    "access.remote": "Only local paths need authorisation; remote URLs do not.",
    "access.badPath": "The authorisation request has no valid local path.",
    "analysis.title.profile": "Terrain profile",
    "analysis.title.flood": "Flood analysis",
    "analysis.title.sunlight": "Sunlight analysis",
    "analysis.title.clip": "Clip analysis",
    "analysis.title.skyline": "Skyline analysis",
    "analysis.skylineAngle": "Max elevation angle",
    "analysis.skylineDistance": "Seen at distance",
    "analysis.skylineEye": "Observer height",
    "analysis.skylineEyeValue": "Observer {value}",
    "analysis.skylineMax": "Skyline {value} · {angle}",
    "analysis.clipHeight": "Clip height",
    "analysis.clipKeep": "Keeps",
    "analysis.clipKeepAbove": "Above the plane",
    "analysis.clipKeepBelow": "Below the plane",
    "analysis.clipPlanes": "Clipping planes",
    "analysis.layer": "Layer",
    "analysis.collapse": "Collapse analysis card",
    "analysis.expand": "Expand analysis card",
    "analysis.close": "Close analysis card",
    "analysis.chart": "Distance–elevation profile",
    "analysis.length": "Profile length",
    "analysis.minHeight": "Lowest elevation",
    "analysis.maxHeight": "Highest elevation",
    "analysis.relief": "Relief",
    "analysis.gain": "Total ascent",
    "analysis.loss": "Total descent",
    "analysis.samples": "Samples",
    "analysis.region": "Analysis extent",
    "analysis.waterHeight": "Water level",
    "analysis.area": "Analysis area",
    "analysis.inundated": "Inundated area",
    "analysis.inundatedRatio": "Inundated share",
    "analysis.depthMax": "Max depth",
    "analysis.depthMean": "Mean depth",
    "analysis.inundatedSamples": "Inundated cells",
    "analysis.altitude": "Solar altitude",
    "analysis.azimuth": "Solar azimuth",
    "analysis.datetime": "Time",
    "analysis.shadows": "Shadows",
    "analysis.shadowsOn": "enabled",
    "analysis.shadowsOff": "disabled",
    "analysis.night": "Night",
    "analysis.day": "Day",
    "analysis.daylight": "Day / night",
    "analysis.hint": "One analysis is kept at a time; another analysis or clear replaces the current result.",
    "analysis.start": "Start {value}",
    "analysis.end": "End {value}",
    "analysis.waterLabel": "Water {value}",
    "analysis.sunLabel": "Sun {altitude}° / {azimuth}°",
    "shader.title": "Shader workbench",
    "shader.close": "Close shader workbench",
    "shader.layerLabel": "Target layer",
    "shader.layerAuto": "Top visible layer (auto)",
    "shader.presetLabel": "Preset",
    "shader.preset.height-false-color": "Elevation ramp",
    "shader.preset.contour": "Contours",
    "shader.preset.scan": "Height scan",
    "shader.preset.water": "Water ripples",
    "shader.preset.water-depth": "Water depth",
    "shader.targetChip": "on {name}",
    "shader.targetNone": "No usable layer",
    "shader.layerAutoNamed": "Auto select ({name})",
    "shader.targetAuto": "Auto target: {name} (topmost visible 3D Tiles)",
    "shader.targetFixed": "Pinned: {name}",
    "shader.orderLabel": "Stack order",
    "shader.moveUp": "Move up",
    "shader.moveDown": "Move down",
    "shader.removePreset": "Remove from stack",
    "shader.livePreview": "Live preview (updates while dragging, coalesced about every 0.2 s)",
    "shader.compare": "Compare original",
    "shader.compareOn": "Showing original",
    "shader.compareHint": "Hold to compare: temporarily show the layer without the preset; release or close to restore",
    "shader.appliedTag": "Applied",
    "shader.param.waterHeight": "Water height (m)",
    "shader.param.depthMax": "Max depth (m)",
    "shader.stackHint": "Click presets to stack up to 3 (composed in click order); click again to remove.",
    "shader.param.minHeight": "Min height (m)",
    "shader.param.maxHeight": "Max height (m)",
    "shader.param.auto": "Auto",
    "shader.param.interval": "Contour interval (m)",
    "shader.param.speed": "Animation speed",
    "shader.param.amplitude": "Amplitude",
    "shader.param.opacity": "Opacity",
    "shader.apply": "Apply preset",
    "shader.resetLayer": "Reset layer",
    "shader.resetAll": "Reset all",
    "shader.active": "Active presets",
    "shader.activeEmpty": "No preset applied yet",
    "shader.noLayers": "Load a 3D Tiles layer before applying a shader preset.",
    "toast.captureSaved": "Saved {width}×{height} snapshot: {path}",
    "toast.askAgentSent": "Scene summary injected into the conversation; it takes effect on the next step - just type your question.",
    "toast.askAgentFailed": "Could not send the scene: {message}",
    "toast.askAgentNoSession": "Open a conversation first to use Ask Agent.",
    "toast.reportSaved": "Scene report saved: {path}",
    "toast.reportFailed": "Could not export the report: {message}",
    "toast.noSession": "Open a conversation first to view the globe beside it.",
    "toast.fullscreenUnsupported": "This browser does not expose the fullscreen API.",
    "toast.fullscreenFailed": "Fullscreen failed: {message}",
    "unit.hectare": "ha",
    // v1.7 P0 vocabulary (identify card / evidence export / tour bar).
    ...V17_MESSAGES.en
  }
};
var FALLBACK_ABOUT = {
  version: "1.5.0",
  homepage: "https://github.com/CVEO/dsh-digital-earth",
  teamUrl: "https://www.whu-cveo.com/"
};

// src/client/runtime.js
var appCtx = null;
var setAppCtx = (value) => {
  appCtx = value;
};
var getAppCtx = () => appCtx;
var service = (key) => {
  try {
    return appCtx?.get?.(key) ?? void 0;
  } catch {
    return void 0;
  }
};

// src/client/ui/icons.js
var import_react = __toESM(require("react"), 1);
var h2 = import_react.default.createElement;
function ViewerIcon({ size = 18 }) {
  return h2(
    "svg",
    { viewBox: "0 0 64 64", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h2("circle", { cx: 30, cy: 30, r: 20, fill: "none", stroke: "currentColor", strokeWidth: 3 }),
    h2("ellipse", { cx: 30, cy: 30, rx: 8.5, ry: 20, fill: "none", stroke: "currentColor", strokeWidth: 2.2, opacity: 0.85 }),
    h2("path", { d: "M10.5 30h39M13.5 20.5h33M13.5 39.5h33", stroke: "currentColor", strokeWidth: 2, opacity: 0.55 }),
    h2("path", { d: "M48 34l9 5v10l-9 5-9-5V39z", fill: "currentColor", opacity: 0.9 })
  );
}
var ThemeIcon = ({ mode, size = 16 }) => h2(
  "svg",
  { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
  mode === "dark" ? h2("path", { d: "M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5 8.6 8.6 0 1 0 20.5 14.4z", fill: "currentColor" }) : mode === "light" ? h2(
    "g",
    { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", fill: "none" },
    h2("circle", { cx: 12, cy: 12, r: 4.1 }),
    h2("path", { d: "M12 2.6v1.7M12 19.2v1.7M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" })
  ) : h2(
    "g",
    { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", fill: "none" },
    h2("circle", { cx: 12, cy: 12, r: 8.4 }),
    h2("path", { d: "M12 3.6a8.4 8.4 0 0 0 0 16.8z", fill: "currentColor", stroke: "none" })
  )
);
var FullscreenIcon = ({ size = 15 }) => h2(
  "svg",
  { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
  h2(
    "g",
    { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" },
    h2("path", { d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" })
  )
);
var HudIcon = ({ size = 16 }) => h2(
  "svg",
  { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
  h2(
    "g",
    { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", fill: "none" },
    h2("circle", { cx: 12, cy: 12, r: 5.2 }),
    h2("path", { d: "M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4" })
  )
);
function ShaderIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h2(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h2("path", { d: "M3 7h6.5M13.5 7H21M3 17h4M11 17h10", ...stroke }),
    h2("circle", { cx: 11.5, cy: 7, r: 2.4, ...stroke }),
    h2("circle", { cx: 8.5, cy: 17, r: 2.4, ...stroke })
  );
}
function ScreenshotIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h2(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h2("path", { d: "M3.5 8.5h3l1.4-2.2h8.2l1.4 2.2h3v10h-17z", ...stroke }),
    h2("circle", { cx: 12, cy: 13, r: 3.4, ...stroke })
  );
}
function IdentifyIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h2(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h2("path", { d: "M12 2.8v4M12 17.2v4M2.8 12h4M17.2 12h4", ...stroke }),
    h2("circle", { cx: 12, cy: 12, r: 5.2, ...stroke }),
    h2("circle", { cx: 12, cy: 12, r: 1.3, fill: "currentColor", stroke: "none" })
  );
}
function ResetIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h2(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h2("path", { d: "M4 11.5 12 4l8 7.5", ...stroke }),
    h2("path", { d: "M6.5 10.5V20h11v-9.5", ...stroke }),
    h2("path", { d: "M10 20v-5h4v5", ...stroke })
  );
}
function AskAgentIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h2(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h2("path", { d: "M4 5.5h16v10.5H9.5L5 20v-4H4z", ...stroke }),
    h2("path", { d: "M8.5 9.5h7M8.5 12.5h4.5", ...stroke })
  );
}

// src/client/ui/layout.js
var import_react13 = __toESM(require("react"), 1);

// src/client/viewer/ViewerSurface.js
var import_react12 = __toESM(require("react"), 1);

// src/client/analysis/height-service.js
var CACHE_DEGREES = 1e-7;
var DEFAULT_SAMPLE_BUDGET = 600;
function isThenable(value) {
  return value !== null && typeof value === "object" && typeof value.then === "function";
}
function createHeightService({ Cesium, viewer, layer = null } = {}) {
  const cache = /* @__PURE__ */ new Map();
  const warnings = /* @__PURE__ */ new Set();
  const counts = { tiles: 0, terrain: 0, none: 0 };
  const terrainProvider2 = () => {
    try {
      return viewer?.scene?.globe?.terrainProvider ?? null;
    } catch {
      return null;
    }
  };
  const hasRealTerrain = () => {
    const provider = terrainProvider2();
    if (!provider) return false;
    const Ellipsoid = Cesium?.EllipsoidTerrainProvider;
    if (typeof Ellipsoid === "function" && provider instanceof Ellipsoid) return false;
    return true;
  };
  const targetTileset = () => {
    if (!layer || layer.visible === false) return null;
    const tileset = layer.tileset;
    return tileset && typeof tileset.getHeight === "function" ? tileset : null;
  };
  const cacheKey = (carto, mode) => `${mode}|${Math.round(carto.longitude / CACHE_DEGREES)}|${Math.round(carto.latitude / CACHE_DEGREES)}`;
  async function fromTiles(carto) {
    const tileset = targetTileset();
    if (!tileset) return null;
    try {
      const raw = tileset.getHeight(carto, viewer.scene);
      const value = isThenable(raw) ? await raw : raw;
      if (typeof value === "number" && Number.isFinite(value)) return value;
    } catch {
    }
    return null;
  }
  function fromTerrain(carto) {
    if (!hasRealTerrain()) return null;
    try {
      const value = viewer.scene.globe.getHeight(carto);
      if (typeof value === "number" && Number.isFinite(value)) return value;
    } catch {
    }
    return null;
  }
  async function sample(carto, { mode = "surface" } = {}) {
    if (!carto) return null;
    const key = cacheKey(carto, mode);
    if (cache.has(key)) return cache.get(key);
    let result = null;
    if (mode === "ground") {
      const terrain = fromTerrain(carto);
      if (terrain !== null) result = { height: terrain, source: "terrain" };
      else warnings.add("ground_height_unavailable");
    } else {
      const tiles = await fromTiles(carto);
      if (tiles !== null) {
        result = { height: tiles, source: "tiles" };
        warnings.add("surface_height_from_tiles");
      } else {
        const terrain = fromTerrain(carto);
        if (terrain !== null) result = { height: terrain, source: "terrain" };
      }
    }
    counts[result ? result.source : "none"] += 1;
    cache.set(key, result);
    return result;
  }
  async function sampleMany(cartos, { mode = "surface", budget = DEFAULT_SAMPLE_BUDGET } = {}) {
    const list = Array.isArray(cartos) ? cartos : [];
    const values = [];
    for (let index = 0; index < list.length; index += 1) {
      if (index >= budget) break;
      values.push(await sample(list[index], { mode }));
    }
    if (list.length > budget) warnings.add("sample_budget_truncated");
    return { values, ...report() };
  }
  function report() {
    const source = counts.tiles >= counts.terrain && counts.tiles > 0 ? "tiles" : counts.terrain > 0 ? "terrain" : "none";
    return {
      height_source: source,
      height_sources: { ...counts },
      warnings: [...warnings]
    };
  }
  return {
    sample,
    sampleMany,
    report,
    /** Whether a real (non-ellipsoid) terrain provider is installed. */
    hasRealTerrain,
    /** Test seam: drop the probe cache (a new run re-samples). */
    reset() {
      cache.clear();
      warnings.clear();
      counts.tiles = 0;
      counts.terrain = 0;
      counts.none = 0;
    }
  };
}

// src/client/analysis/math.js
var ANALYSIS_ENTITY_PREFIX = "analysis-";
var ANALYSIS_MIN_SAMPLES = 2;
var ANALYSIS_ELEVATION_STOPS = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444"];
var analysisRound = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
var analysisInteger = (value, fallback, minimum, maximum) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
};
var analysisLonLat = (value) => {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [lon, lat];
};
var analysisRegion = (value) => {
  if (value === null || typeof value !== "object") return null;
  const west = Number(value.west);
  const south = Number(value.south);
  const east = Number(value.east);
  const north = Number(value.north);
  if (![west, south, east, north].every((item) => Number.isFinite(item))) return null;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null;
  return { west, south, east, north };
};
var analysisColorAt = (Cesium, ratio) => {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const scaled = clamped * (ANALYSIS_ELEVATION_STOPS.length - 1);
  const index = Math.min(ANALYSIS_ELEVATION_STOPS.length - 2, Math.floor(scaled));
  const local = scaled - index;
  try {
    const from = Cesium.Color.fromCssColorString(ANALYSIS_ELEVATION_STOPS[index]);
    const to = Cesium.Color.fromCssColorString(ANALYSIS_ELEVATION_STOPS[index + 1]);
    return Cesium.Color.lerp(from, to, local, new Cesium.Color());
  } catch {
    return Cesium.Color.DODGERBLUE;
  }
};
var analysisSunAngles = (Cesium, date, observer) => {
  try {
    if (!Cesium.Simon1994PlanetaryPositions || !Cesium.Transforms) return null;
    const julianDate = Cesium.JulianDate.fromDate(date);
    const sunInertial = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(julianDate);
    if (!sunInertial) return null;
    let icrfToFixed = null;
    try {
      icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(julianDate);
    } catch {
      icrfToFixed = null;
    }
    if (!icrfToFixed) {
      icrfToFixed = Cesium.Transforms.computeTemeToPseudoFixedMatrix(julianDate);
    }
    if (!icrfToFixed) return null;
    const sunFixed = Cesium.Matrix3.multiplyByVector(icrfToFixed, sunInertial, new Cesium.Cartesian3());
    const sunDirection = Cesium.Cartesian3.normalize(sunFixed, new Cesium.Cartesian3());
    const ellipsoid = Cesium.Ellipsoid.WGS84;
    const up = typeof ellipsoid.geodeticSurfaceNormalCartographic === "function" ? ellipsoid.geodeticSurfaceNormalCartographic(observer, new Cesium.Cartesian3()) : Cesium.Cartesian3.normalize(
      ellipsoid.cartographicToCartesian(observer, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    const sine = Cesium.Math.clamp(Cesium.Cartesian3.dot(sunDirection, up), -1, 1);
    const altitude = Cesium.Math.toDegrees(Math.asin(sine));
    if (!Number.isFinite(altitude)) return null;
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromRadians(observer.longitude, observer.latitude, 0)
    );
    const east = Cesium.Matrix4.getColumn(enu, 0, new Cesium.Cartesian4());
    const north = Cesium.Matrix4.getColumn(enu, 1, new Cesium.Cartesian4());
    const eastDirection = new Cesium.Cartesian3(east.x, east.y, east.z);
    const northDirection = new Cesium.Cartesian3(north.x, north.y, north.z);
    const azimuth = (Cesium.Math.toDegrees(
      Math.atan2(
        Cesium.Cartesian3.dot(sunDirection, eastDirection),
        Cesium.Cartesian3.dot(sunDirection, northDirection)
      )
    ) + 360) % 360;
    if (!Number.isFinite(azimuth)) return null;
    return { altitude: analysisRound(altitude, 2), azimuth: analysisRound(azimuth, 2) };
  } catch {
    return null;
  }
};
var analysisObserver = (Cesium, viewer, layer) => {
  const tileset = layer ? layer.tileset : null;
  if (tileset && tileset.boundingSphere) {
    try {
      const carto = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center);
      if (carto) return carto;
    } catch {
    }
  }
  return viewer.camera.positionCartographic;
};
var analysisClipPlane = (Cesium, center, height, keep = "below") => {
  if (!Cesium?.Cartesian3 || !center) return null;
  let carto = null;
  try {
    carto = Cesium.Cartographic.fromCartesian(center);
  } catch {
    return null;
  }
  if (!carto || !Number.isFinite(carto.height)) return null;
  let up;
  try {
    up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(center, new Cesium.Cartesian3());
  } catch {
    return null;
  }
  if (!up) return null;
  const offset = Cesium.Cartesian3.multiplyByScalar(up, height - carto.height, new Cesium.Cartesian3());
  const pointOnPlane = Cesium.Cartesian3.add(center, offset, new Cesium.Cartesian3());
  const dot = Cesium.Cartesian3.dot(up, pointOnPlane);
  const keepBelow = keep !== "above";
  const normal = keepBelow ? Cesium.Cartesian3.negate(up, new Cesium.Cartesian3()) : Cesium.Cartesian3.clone(up, new Cesium.Cartesian3());
  return {
    normal,
    distance: keepBelow ? dot : -dot,
    pointOnPlane,
    keep: keepBelow ? "below" : "above"
  };
};

// src/client/i18n.js
var import_react2 = __toESM(require("react"), 1);
var localeId = () => {
  const active = service("locale")?.getSnapshot?.()?.active;
  if (typeof active === "string" && active !== "") return active;
  return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en";
};
var isChinese = () => localeId().toLowerCase().startsWith("zh");
var t = (key, params) => {
  const table = isChinese() ? MESSAGES.zh : MESSAGES.en;
  let text = table[key] ?? MESSAGES.en[key] ?? key;
  if (params !== void 0) {
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
};
function useTranslation() {
  import_react2.default.useSyncExternalStore(
    import_react2.default.useCallback((callback) => service("locale")?.subscribe?.(callback) ?? (() => {
    }), []),
    localeId
  );
  return t;
}

// src/client/format.js
var message = (error) => error instanceof Error ? error.message : String(error);
var redactUrl = (value) => typeof value === "string" ? value.replace(/\/api\/3dviewer\/(tiles|files)\/[^/]+\//g, "/api/3dviewer/$1/<token>/") : value;
var b64url = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
var formatValue = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
};
var formatBytes = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "–";
  if (value >= 1 << 30) return `${(value / (1 << 30)).toFixed(2)} GB`;
  if (value >= 1 << 20) return `${(value / (1 << 20)).toFixed(1)} MB`;
  if (value >= 1 << 10) return `${(value / 1024).toFixed(0)} KB`;
  return `${value} B`;
};
var formatCount = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "–";
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return String(value);
};
var formatDistance = (meters) => meters >= 1e3 ? `${(meters / 1e3).toFixed(3)} km` : `${meters.toFixed(2)} m`;
var formatArea = (squareMeters) => squareMeters >= 1e6 ? `${(squareMeters / 1e6).toFixed(3)} km²` : squareMeters >= 1e4 ? `${(squareMeters / 1e4).toFixed(2)} ${t("unit.hectare")}` : `${squareMeters.toFixed(1)} m²`;
var formatHeight = (meters) => Math.abs(meters) >= 1e3 ? `${(meters / 1e3).toFixed(2)} km` : `${meters.toFixed(1)} m`;
var escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => {
  switch (character) {
    case "&":
      return "&amp;";
    case "<":
      return "&lt;";
    case ">":
      return "&gt;";
    case '"':
      return "&quot;";
    default:
      return "&#39;";
  }
});
var arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 32768;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};
function geodesicLength(Cesium, points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const left = Cesium.Cartographic.fromCartesian(points[index - 1]);
    const right = Cesium.Cartographic.fromCartesian(points[index]);
    total += new Cesium.EllipsoidGeodesic(left, right).surfaceDistance;
  }
  return total;
}
function planarArea(Cesium, points) {
  if (points.length < 3) return 0;
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(points[0]);
  const inverse = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4());
  const local = points.map((point) => Cesium.Matrix4.multiplyByPoint(inverse, point, new Cesium.Cartesian3()));
  let sum = 0;
  for (let index = 0; index < local.length; index += 1) {
    const current = local[index];
    const next = local[(index + 1) % local.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}
var clone = (value) => JSON.parse(JSON.stringify(value));

// src/client/analysis/engine.js
function createAnalysisEngine(deps) {
  const analysisRef = deps.state;
  const analysisCommandRef = deps.commandRef;
  const viewerRef = { get current() {
    return deps.getViewer();
  } };
  const layersRef = { get current() {
    return deps.getLayers();
  } };
  const cesiumRef = { get current() {
    return deps.getCesium();
  } };
  const setAnalysis = deps.setAnalysis;
  const markSceneDirty = () => deps.markSceneDirty();
  const t2 = deps.t;
  const findLayer = deps.findLayer;
  const analysisAdd = (Cesium, viewer, options) => {
    const state = analysisRef.current;
    const entity = viewer.entities.add({ ...options, id: `${ANALYSIS_ENTITY_PREFIX}${options.id}` });
    state.entities.push(entity);
    return entity;
  };
  const analysisLabel = (Cesium, text) => ({
    text,
    font: '12px -apple-system,"Segoe UI","PingFang SC",sans-serif',
    style: Cesium.LabelStyle.FILL,
    fillColor: Cesium.Color.WHITE,
    showBackground: true,
    backgroundColor: new Cesium.Color(0.06, 0.09, 0.15, 0.85),
    backgroundPadding: new Cesium.Cartesian2(8, 5),
    pixelOffset: new Cesium.Cartesian2(0, -18),
    disableDepthTestDistance: Number.POSITIVE_INFINITY
  });
  const restoreAnalysisScene = () => {
    const viewer = viewerRef.current;
    const restore = analysisRef.current.restore;
    if (!viewer || !restore) return;
    try {
      if (typeof restore.enableLighting === "boolean") viewer.scene.globe.enableLighting = restore.enableLighting;
      if (typeof restore.shadowMapEnabled === "boolean") viewer.scene.shadowMap.enabled = restore.shadowMapEnabled;
      if (typeof restore.shouldAnimate === "boolean") viewer.clock.shouldAnimate = restore.shouldAnimate;
      if (restore.currentTime) viewer.clock.currentTime = restore.currentTime;
      for (const saved of restore.tilesets ?? []) {
        const layer = layersRef.current.find((item) => item.id === saved.id);
        if (layer && layer.tileset) layer.tileset.shadows = saved.shadows;
      }
      if (restore.clipping) {
        const target = restore.clipping.layer;
        if (target && target.tileset) target.tileset.clippingPlanes = restore.clipping.previous ?? void 0;
      }
    } catch {
    }
    analysisRef.current.restore = null;
  };
  function clearAnalysis() {
    const viewer = viewerRef.current;
    const state = analysisRef.current;
    const cleared = state.operation ? [state.operation] : [];
    if (viewer) {
      for (const entity of state.entities) {
        try {
          viewer.entities.remove(entity);
        } catch {
        }
      }
    }
    state.entities = [];
    restoreAnalysisScene();
    state.operation = null;
    state.layerId = null;
    state.layerName = null;
    analysisCommandRef.current = null;
    setAnalysis(null);
    markSceneDirty();
    return cleared;
  }
  const beginAnalysis = (operation, layer) => {
    const state = analysisRef.current;
    state.operation = operation;
    state.layerId = layer ? layer.id : null;
    state.layerName = layer ? layer.name : null;
  };
  const analyzeProfile = async (Cesium, viewer, layer, args, sampler) => {
    const from = analysisLonLat(args.from);
    const to = analysisLonLat(args.to);
    if (!from || !to) {
      throw new Error("analysis: `from`/`to` must be [lon, lat] pairs. next: pass two legal WGS84 [lon, lat] arrays.");
    }
    const samples = analysisInteger(args.samples, 32, 8, 64);
    const ellipsoid = viewer.scene.globe.ellipsoid;
    const geodesic = new Cesium.EllipsoidGeodesic(
      Cesium.Cartographic.fromDegrees(from[0], from[1]),
      Cesium.Cartographic.fromDegrees(to[0], to[1]),
      ellipsoid
    );
    const length = Number.isFinite(geodesic.surfaceDistance) ? geodesic.surfaceDistance : 0;
    const points = [];
    let withData = 0;
    for (let index = 0; index < samples; index += 1) {
      const fraction = samples === 1 ? 0 : index / (samples - 1);
      const carto = geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic());
      const probe = carto ? await sampler.sample(carto) : null;
      const height = probe ? probe.height : null;
      if (height !== null) withData += 1;
      points.push({
        distance_m: analysisRound(length * fraction, 1),
        height_m: height === null ? null : analysisRound(height, 1)
      });
    }
    if (withData < ANALYSIS_MIN_SAMPLES) {
      throw new Error(
        "analysis: 当前视图中没有可采样的高程数据，先加载 3D Tiles 或地形再试。next: 用 earth_scene 的 list 查看可见图层，或先 load 3D Tiles / 地形后重试。"
      );
    }
    const heights = points.filter((point) => point.height_m !== null).map((point) => point.height_m);
    const minimum = Math.min(...heights);
    const maximum = Math.max(...heights);
    let gain = 0;
    let loss = 0;
    let previous = null;
    for (const point of points) {
      if (point.height_m === null) continue;
      if (previous !== null) {
        const delta = point.height_m - previous;
        if (delta > 0) gain += delta;
        else loss -= delta;
      }
      previous = point.height_m;
    }
    const relief = maximum - minimum;
    const stats = {
      min_height: analysisRound(minimum, 1),
      max_height: analysisRound(maximum, 1),
      relief_m: analysisRound(relief, 1),
      gain_m: analysisRound(gain, 1),
      loss_m: analysisRound(loss, 1)
    };
    beginAnalysis("profile", layer);
    const positionAt = (fraction, height) => {
      const carto = geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic());
      return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height + 2);
    };
    const step = samples > 1 ? 1 / (samples - 1) : 0;
    for (let index = 1; index < points.length; index += 1) {
      const left = points[index - 1];
      const right = points[index];
      if (left.height_m === null || right.height_m === null) continue;
      const ratio = relief > 0 ? ((left.height_m + right.height_m) / 2 - minimum) / relief : 0;
      const color = analysisColorAt(Cesium, ratio);
      analysisAdd(Cesium, viewer, {
        id: `profile-line-${index}`,
        polyline: {
          positions: [
            positionAt((index - 1) * step, left.height_m),
            positionAt(index * step, right.height_m)
          ],
          width: 3.5,
          arcType: Cesium.ArcType.NONE,
          material: color,
          depthFailMaterial: color.withAlpha(0.35)
        }
      });
    }
    const endpointHeight = (point) => point.height_m === null ? 0 : point.height_m;
    const endpointText = (point) => point.height_m === null ? t2("hud.empty") : formatHeight(point.height_m);
    const marker = (id, fraction, point, color) => {
      analysisAdd(Cesium, viewer, {
        id,
        position: positionAt(fraction, endpointHeight(point)),
        point: {
          pixelSize: 9,
          color,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: analysisLabel(
          Cesium,
          id === "profile-start" ? t2("analysis.start", { value: endpointText(point) }) : t2("analysis.end", { value: endpointText(point) })
        )
      });
    };
    marker("profile-start", 0, points[0], analysisColorAt(Cesium, 0));
    marker("profile-end", 1, points[points.length - 1], analysisColorAt(Cesium, 1));
    const result = {
      operation: "profile",
      layer: layer ? layer.name : null,
      from,
      to,
      samples,
      length_m: analysisRound(length, 1),
      stats,
      points,
      ...sampler.report()
    };
    setAnalysis({ operation: "profile", layerName: result.layer, result });
    markSceneDirty();
    return result;
  };
  const analyzeSkyline = async (Cesium, viewer, layer, args, sampler) => {
    const from = analysisLonLat(args.from);
    const to = analysisLonLat(args.to);
    if (!from || !to) {
      throw new Error(
        "analysis: `from`/`to` must be [lon, lat] pairs. next: pass the observer and a direction target."
      );
    }
    const samples = analysisInteger(args.samples, 32, 8, 64);
    const ellipsoid = viewer.scene.globe.ellipsoid;
    const geodesic = new Cesium.EllipsoidGeodesic(
      Cesium.Cartographic.fromDegrees(from[0], from[1]),
      Cesium.Cartographic.fromDegrees(to[0], to[1]),
      ellipsoid
    );
    const length = Number.isFinite(geodesic.surfaceDistance) ? geodesic.surfaceDistance : 0;
    if (length <= 0) {
      throw new Error("analysis: skyline 起终点重合或距离为 0。next: 给出两个不同的位置。");
    }
    const heightMode = sampler.hasRealTerrain() ? "ground" : "surface";
    const fractions = [];
    const probes = [];
    for (let index = 0; index < samples; index += 1) {
      const fraction = samples === 1 ? 0 : index / (samples - 1);
      fractions.push(fraction);
      probes.push(geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic()));
    }
    const sampled = await sampler.sampleMany(probes, { mode: heightMode });
    const eyeSample = sampled.values[0];
    if (!eyeSample) {
      throw new Error("analysis: 观察点没有可采样的高程。next: 换一个观察位置，或先加载地形 / 3D Tiles 后重试。");
    }
    const eyeHeight = eyeSample.height + 1.7;
    const points = [];
    let withData = 0;
    for (let index = 0; index < sampled.values.length; index += 1) {
      const sample = sampled.values[index];
      if (!sample) continue;
      withData += 1;
      const distance = length * fractions[index];
      const angle = distance > 0 ? Math.atan2(sample.height - eyeHeight, distance) * 180 / Math.PI : -90;
      points.push({
        distance_m: analysisRound(distance, 1),
        height_m: analysisRound(sample.height, 1),
        angle_deg: analysisRound(angle, 3)
      });
    }
    if (withData < ANALYSIS_MIN_SAMPLES) {
      throw new Error(
        "analysis: 当前视图中没有可采样的高程数据，先加载 3D Tiles 或地形再试。next: 用 earth_scene 的 list 查看可见图层，或先 load 3D Tiles / 地形后重试。"
      );
    }
    let maxPoint = points[0];
    for (const point of points) if (point.angle_deg > maxPoint.angle_deg) maxPoint = point;
    beginAnalysis("skyline", layer);
    const positionAt = (fraction, height) => {
      const carto = geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic());
      return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height + 2);
    };
    for (let index = 1; index < points.length; index += 1) {
      const ratio = points.length > 1 ? index / (points.length - 1) : 0;
      analysisAdd(Cesium, viewer, {
        id: `skyline-line-${index}`,
        polyline: {
          positions: [positionAt(fractions[index - 1], points[index - 1].height_m), positionAt(fractions[index], points[index].height_m)],
          width: 3,
          arcType: Cesium.ArcType.NONE,
          material: analysisColorAt(Cesium, ratio),
          depthFailMaterial: analysisColorAt(Cesium, ratio).withAlpha(0.35)
        }
      });
    }
    const maxIndex = points.indexOf(maxPoint);
    analysisAdd(Cesium, viewer, {
      id: "skyline-max",
      position: positionAt(fractions[maxIndex], maxPoint.height_m),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString("#ffd166"),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: analysisLabel(
        Cesium,
        t2("analysis.skylineMax", { value: formatHeight(maxPoint.height_m), angle: `${maxPoint.angle_deg.toFixed(2)}°` })
      )
    });
    analysisAdd(Cesium, viewer, {
      id: "skyline-eye",
      position: positionAt(0, eyeHeight),
      point: {
        pixelSize: 8,
        color: Cesium.Color.fromCssColorString("#7fd4ff"),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: analysisLabel(Cesium, t2("analysis.skylineEyeValue", { value: formatHeight(eyeHeight) }))
    });
    const result = {
      operation: "skyline",
      layer: layer ? layer.name : null,
      from,
      to,
      samples,
      length_m: analysisRound(length, 1),
      height_mode: heightMode,
      eye_height_m: analysisRound(eyeHeight, 2),
      max_angle_deg: maxPoint.angle_deg,
      max_distance_m: maxPoint.distance_m,
      max_height_m: maxPoint.height_m,
      points,
      height_source: sampled.height_source,
      height_sources: sampled.height_sources,
      warnings: sampled.warnings
    };
    setAnalysis({ operation: "skyline", layerName: result.layer, result });
    markSceneDirty();
    return result;
  };
  const analyzeFlood = async (Cesium, viewer, layer, args, sampler) => {
    const region = analysisRegion(args.region);
    if (!region) {
      throw new Error("analysis: `region` must be {west, south, east, north} with west < east and south < north. next: pass a legal WGS84 bounding box.");
    }
    const waterHeight = Number(args.water_height);
    if (!Number.isFinite(waterHeight)) {
      throw new Error("analysis: `water_height` must be a finite number in metres. next: pass the water level to test.");
    }
    const grid = analysisInteger(args.grid, 12, 4, 24);
    const ellipsoid = viewer.scene.globe.ellipsoid;
    const span = (lon1, lat1, lon2, lat2) => new Cesium.EllipsoidGeodesic(
      Cesium.Cartographic.fromDegrees(lon1, lat1),
      Cesium.Cartographic.fromDegrees(lon2, lat2),
      ellipsoid
    ).surfaceDistance;
    const middleLat = (region.south + region.north) / 2;
    const middleLon = (region.west + region.east) / 2;
    const cellWidth = span(region.west, middleLat, region.east, middleLat) / grid;
    const cellHeight = span(middleLon, region.south, middleLon, region.north) / grid;
    const cellArea = Math.abs(cellWidth * cellHeight);
    if (!Number.isFinite(cellArea) || cellArea <= 0) {
      throw new Error("analysis: 分析范围过小，无法计算格元面积。next: 扩大 region 后重试。");
    }
    const probes = [];
    for (let row = 0; row < grid; row += 1) {
      const lat = region.south + (region.north - region.south) * (row + 0.5) / grid;
      for (let column = 0; column < grid; column += 1) {
        const lon = region.west + (region.east - region.west) * (column + 0.5) / grid;
        probes.push(Cesium.Cartographic.fromDegrees(lon, lat));
      }
    }
    const heightMode = sampler.hasRealTerrain() ? "ground" : "surface";
    const sampled = await sampler.sampleMany(probes, { mode: heightMode });
    let withData = 0;
    let inundated = 0;
    let depthMaximum = 0;
    let depthSum = 0;
    for (const sample of sampled.values) {
      if (!sample) continue;
      const height = sample.height;
      withData += 1;
      if (waterHeight > height) {
        const depth = waterHeight - height;
        inundated += 1;
        depthSum += depth;
        if (depth > depthMaximum) depthMaximum = depth;
      }
    }
    if (withData === 0) {
      throw new Error(
        "analysis: 当前视图中没有可采样的高程数据，先加载 3D Tiles 或地形再试。next: 用 earth_scene 的 list 查看可见图层，或先 load 3D Tiles / 地形后重试。"
      );
    }
    beginAnalysis("flood", layer);
    const waterColor = Cesium.Color.fromCssColorString("#2f7fe0").withAlpha(0.38);
    const borderColor = Cesium.Color.fromCssColorString("#9fc7ff");
    analysisAdd(Cesium, viewer, {
      id: "flood-water",
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(region.west, region.south, region.east, region.north),
        height: waterHeight,
        material: waterColor,
        outline: true,
        outlineColor: borderColor
      }
    });
    const corners = [
      [region.west, region.south],
      [region.east, region.south],
      [region.east, region.north],
      [region.west, region.north],
      [region.west, region.south]
    ];
    analysisAdd(Cesium, viewer, {
      id: "flood-border",
      polyline: {
        positions: corners.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, waterHeight)),
        width: 2,
        arcType: Cesium.ArcType.NONE,
        material: borderColor
      }
    });
    analysisAdd(Cesium, viewer, {
      id: "flood-label",
      position: Cesium.Cartesian3.fromDegrees(middleLon, middleLat, waterHeight + 2),
      label: analysisLabel(Cesium, t2("analysis.waterLabel", { value: formatHeight(waterHeight) }))
    });
    const regionArea = grid * grid * cellArea;
    const result = {
      operation: "flood",
      layer: layer ? layer.name : null,
      region,
      water_height: analysisRound(waterHeight, 2),
      grid,
      cell_area_m2: analysisRound(cellArea, 1),
      area_km2: analysisRound(regionArea / 1e6, 6),
      inundated_km2: analysisRound(inundated * cellArea / 1e6, 6),
      inundated_ratio: analysisRound(withData > 0 ? inundated / withData : 0, 4),
      depth_max_m: analysisRound(depthMaximum, 2),
      depth_mean_m: analysisRound(inundated > 0 ? depthSum / inundated : 0, 2),
      samples_with_data: withData,
      samples_inundated: inundated,
      // Provenance is additive: old fields keep their names/semantics.
      height_mode: heightMode,
      height_source: sampled.height_source,
      height_sources: sampled.height_sources,
      warnings: sampled.warnings
    };
    setAnalysis({ operation: "flood", layerName: result.layer, result });
    markSceneDirty();
    return result;
  };
  const analyzeSunlight = (Cesium, viewer, layer, args) => {
    const date = args.datetime === void 0 || args.datetime === null ? /* @__PURE__ */ new Date() : new Date(args.datetime);
    if (Number.isNaN(date.getTime())) {
      throw new Error("analysis: `datetime` must be a valid ISO 8601 date. next: pass an ISO timestamp, or omit it for the current time.");
    }
    const showShadows = args.show_shadows !== false;
    const observer = analysisObserver(Cesium, viewer, layer);
    const sun = analysisSunAngles(Cesium, date, observer);
    if (!sun) {
      throw new Error("analysis: 无法计算太阳位置（Cesium 星历不可用）。next: 检查浏览器控制台后重试，或先执行 clear。");
    }
    const scene = viewer.scene;
    const restore = {
      enableLighting: scene.globe.enableLighting,
      shadowMapEnabled: scene.shadowMap ? scene.shadowMap.enabled : null,
      shouldAnimate: viewer.clock.shouldAnimate,
      currentTime: viewer.clock.currentTime ? viewer.clock.currentTime.clone() : null,
      tilesets: layersRef.current.filter((item) => item.visible && item.tileset).map((item) => ({ id: item.id, shadows: item.tileset.shadows }))
    };
    beginAnalysis("sunlight", layer);
    analysisRef.current.restore = restore;
    scene.globe.enableLighting = true;
    if (scene.shadowMap) {
      scene.shadowMap.enabled = true;
      scene.shadowMap.softShadows = true;
      scene.shadowMap.darkness = 0.35;
      if (!showShadows) scene.shadowMap.enabled = false;
    }
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(date);
    viewer.clock.shouldAnimate = false;
    for (const saved of restore.tilesets) {
      const item = layersRef.current.find((entry) => entry.id === saved.id);
      if (item && item.tileset) {
        item.tileset.shadows = Cesium.ShadowMode.ENABLED;
        if (!showShadows) item.tileset.shadows = Cesium.ShadowMode.DISABLED;
      }
    }
    analysisAdd(Cesium, viewer, {
      id: "sun-label",
      position: Cesium.Cartesian3.fromDegrees(
        Cesium.Math.toDegrees(observer.longitude),
        Cesium.Math.toDegrees(observer.latitude),
        (observer.height || 0) + 30
      ),
      label: analysisLabel(
        Cesium,
        t2("analysis.sunLabel", { altitude: sun.altitude, azimuth: sun.azimuth })
      )
    });
    const result = {
      operation: "sunlight",
      layer: layer ? layer.name : null,
      datetime: date.toISOString(),
      sun: { altitude_deg: sun.altitude, azimuth_deg: sun.azimuth },
      shadows_enabled: showShadows,
      night: sun.altitude < 0
    };
    setAnalysis({ operation: "sunlight", layerName: result.layer, result });
    markSceneDirty();
    return result;
  };
  const analyzeClip = async (Cesium, viewer, layer, args) => {
    const height = Number(args.height);
    if (!Number.isFinite(height)) {
      throw new Error("analysis: `height` must be a finite number in metres. next: pass the clip plane height.");
    }
    if (!layer || layer.visible === false || !layer.tileset) {
      throw new Error("analysis: clip 需要可见的 3D Tiles 图层。next: 先加载或显示 3D Tiles 图层后重试。");
    }
    const tileset = layer.tileset;
    const center = tileset.boundingSphere && tileset.boundingSphere.center;
    if (!center) {
      throw new Error("analysis: 图层缺少包围球，无法建立剖切面。next: 重新加载该图层后重试。");
    }
    const plane = analysisClipPlane(Cesium, center, height, args.keep);
    if (!plane) {
      throw new Error("analysis: 无法计算剖切面。next: 重新加载图层后重试，或改用其他分析。");
    }
    if (typeof Cesium.ClippingPlaneCollection !== "function" || typeof Cesium.ClippingPlane !== "function") {
      throw new Error("analysis: 当前 Cesium 不支持剖切（ClippingPlane）。next: 升级 Cesium 后重试。");
    }
    const previous = tileset.clippingPlanes ?? null;
    const collection = new Cesium.ClippingPlaneCollection({
      planes: [new Cesium.ClippingPlane(plane.normal, plane.distance)],
      enabled: true,
      edgeWidth: 1,
      edgeColor: Cesium.Color.fromCssColorString("#7fd4ff")
    });
    try {
      tileset.clippingPlanes = collection;
      if (tileset.clippingPlanes !== collection) throw new Error("图层拒绝了 clippingPlanes 赋值");
    } catch {
      try {
        tileset.clippingPlanes = previous ?? void 0;
      } catch {
      }
      throw new Error("analysis: 该图层不支持剖切（clippingPlanes 赋值失败）。next: 换 3D Tiles 图层或重新加载后重试。");
    }
    beginAnalysis("clip", layer);
    analysisRef.current.restore = { clipping: { layer, previous } };
    const result = {
      operation: "clip",
      layer: layer.name,
      height: analysisRound(height, 2),
      keep: plane.keep,
      planes: 1,
      layer_center_height: analysisRound(Cesium.Cartographic.fromCartesian(center).height, 1)
    };
    setAnalysis({ operation: "clip", layerName: result.layer, result });
    markSceneDirty();
    return result;
  };
  async function analyzeCommand(args = {}) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) {
      throw new Error("analysis: 三维引擎尚未就绪。next: 打开数字地球面板后重试。");
    }
    const operation = typeof args.action === "string" ? args.action.trim() : "";
    if (operation === "clear") {
      const cleared = clearAnalysis();
      return { operation: "clear", layer: null, cleared };
    }
    if (operation !== "profile" && operation !== "flood" && operation !== "sunlight" && operation !== "clip" && operation !== "skyline") {
      throw new Error(
        `analysis: 不支持的分析类型 "${String(args.action)}"。next: 使用 profile / flood / skyline / sunlight / clip / clear。`
      );
    }
    let layer = null;
    const requested = typeof args.layer === "string" ? args.layer.trim() : "";
    if (requested !== "") {
      layer = findLayer(requested);
      if (!layer) {
        throw new Error(`analysis: 未找到图层 "${requested}"。next: 用 earth_scene 的 list 动作查看当前图层名。`);
      }
    } else {
      for (let index = layersRef.current.length - 1; index >= 0; index -= 1) {
        if (layersRef.current[index].visible) {
          layer = layersRef.current[index];
          break;
        }
      }
    }
    clearAnalysis();
    const sampler = createHeightService({ Cesium, viewer, layer });
    let result;
    if (operation === "profile") result = await analyzeProfile(Cesium, viewer, layer, args, sampler);
    else if (operation === "flood") result = await analyzeFlood(Cesium, viewer, layer, args, sampler);
    else if (operation === "skyline") result = await analyzeSkyline(Cesium, viewer, layer, args, sampler);
    else if (operation === "sunlight") result = analyzeSunlight(Cesium, viewer, layer, args);
    else result = await analyzeClip(Cesium, viewer, layer, args);
    analysisCommandRef.current = {
      action: operation,
      ...args,
      ...layer ? { layer: layer.name } : {}
    };
    markSceneDirty();
    return result;
  }
  return {
    /** Run one analyze command (profile / flood / sunlight / clear). */
    command: (args = {}) => analyzeCommand(args),
    /** Remove the active analysis and restore whatever sunlight changed. */
    clear: () => clearAnalysis(),
    /** Re-apply a saved sunlight restore state (used by scene restore). */
    restoreScene: () => restoreAnalysisScene()
  };
}

// src/client/scene/agent-overlays.js
function clearAgentOverlays(state, viewer, kind = "all") {
  const drop = (entities) => {
    if (!viewer) return;
    for (const entity of entities) {
      try {
        viewer.entities.remove(entity);
      } catch {
      }
    }
  };
  if (kind === "all" || kind === "draw") {
    drop(state.draw);
    state.draw = [];
    state.drawnFeatures = 0;
    state.drawCommands = [];
  }
  if (kind === "all" || kind === "measure") {
    drop(state.measure);
    state.measure = [];
    state.measuredCount = 0;
    state.measureCommands = [];
  }
}
function geojsonFeatureCount(geojson) {
  if (geojson === null || typeof geojson !== "object") return 0;
  if (geojson.type === "FeatureCollection") return Array.isArray(geojson.features) ? geojson.features.length : 0;
  if (geojson.type === "Feature" || geojson.type === "GeometryCollection") return 1;
  return typeof geojson.type === "string" ? 1 : 0;
}
function measureDetail(command) {
  const result = command?.result ?? {};
  if (command?.mode === "distance" && Number.isFinite(result.distance_m)) return `${result.distance_m.toFixed(1)} m`;
  if (command?.mode === "area" && Number.isFinite(result.area_m2)) return `${result.area_m2.toFixed(1)} m²`;
  if (command?.mode === "height" && Number.isFinite(result.height_m)) return `${result.height_m.toFixed(2)} m`;
  return "";
}
function buildAgentOverlayList(state) {
  const rows = [];
  for (let index = 0; index < state.drawCommands.length; index += 1) {
    const command = state.drawCommands[index];
    const count = geojsonFeatureCount(command?.geojson);
    rows.push({
      id: `draw-${index}`,
      kind: "draw",
      index,
      label: typeof command?.caption === "string" && command.caption !== "" ? command.caption : `标注 ${index + 1}`,
      detail: `${count || command?.drawn || 0} 要素`
    });
  }
  for (let index = 0; index < state.measureCommands.length; index += 1) {
    const command = state.measureCommands[index];
    rows.push({
      id: `measure-${index}`,
      kind: "measure",
      index,
      label: `量测 ${index + 1}`,
      detail: `${command?.mode ?? "measure"}${measureDetail(command) === "" ? "" : ` · ${measureDetail(command)}`}`
    });
  }
  return rows;
}
function removeAgentOverlay(state, viewer, kind, index) {
  if (kind === "draw") {
    const command = state.drawCommands[index];
    if (!command) return false;
    const entities = state.entityGroups?.get(command) ?? [];
    state.drawCommands.splice(index, 1);
    state.entityGroups?.delete(command);
    for (const entity of entities) {
      try {
        viewer?.entities?.remove(entity);
      } catch {
      }
      const at = state.draw.indexOf(entity);
      if (at >= 0) state.draw.splice(at, 1);
    }
    state.drawnFeatures = Math.max(0, state.drawnFeatures - (Number.isFinite(command.drawn) ? command.drawn : entities.length));
    return true;
  }
  if (kind === "measure") {
    const command = state.measureCommands[index];
    if (!command) return false;
    const entities = state.entityGroups?.get(command) ?? [];
    state.measureCommands.splice(index, 1);
    state.entityGroups?.delete(command);
    for (const entity of entities) {
      try {
        viewer?.entities?.remove(entity);
      } catch {
      }
      const at = state.measure.indexOf(entity);
      if (at >= 0) state.measure.splice(at, 1);
    }
    const points = Array.isArray(command.points) ? command.points.length : 0;
    state.measuredCount = Math.max(0, state.measuredCount - points);
    return true;
  }
  return false;
}

// src/client/api.js
var metaPromise = null;
var cesiumPromise = null;
var cesiumStylePromise = null;
var saveChain = Promise.resolve();
var loadMeta = (force = false) => {
  if (force) metaPromise = null;
  metaPromise ??= fetch("/api/3dviewer/meta", { credentials: "same-origin" }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).catch((error) => {
    metaPromise = null;
    throw error;
  });
  return metaPromise;
};
var loadCesium = () => {
  cesiumPromise ??= (async () => {
    const meta = await loadMeta();
    window.CESIUM_BASE_URL = meta.cesiumBase;
    return import(meta.cesiumBase + "index.js");
  })();
  return cesiumPromise;
};
var loadCesiumStyle = () => {
  cesiumStylePromise ??= (async () => {
    if (document.getElementById("mv-cesium-style")) return;
    const meta = await loadMeta();
    await new Promise((resolve) => {
      const link = document.createElement("link");
      link.id = "mv-cesium-style";
      link.rel = "stylesheet";
      link.href = meta.cesiumBase + "Widgets/widgets.css";
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  })();
  return cesiumStylePromise;
};
var loadSources = async (meta) => {
  try {
    const response = await fetch(meta.sourcesUrl, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    const config = {
      imagery: [
        {
          id: "esri-world-imagery",
          name: "Esri World Imagery",
          type: "xyz",
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          maximumLevel: 19,
          credit: "Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        }
      ],
      terrain: [
        {
          id: "arcgis-world-elevation",
          name: "ArcGIS WorldElevation3D",
          type: "arcgis",
          url: "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
          credit: "Esri, CGIAR, USGS"
        }
      ],
      settings: { theme: "auto", imagery: "esri-world-imagery", terrain: null }
    };
    return { config, defaults: clone(config) };
  }
};
var persistSources = (meta, config) => {
  const run = saveChain.then(async () => {
    const response = await fetch(meta.sourcesUrl, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).config;
  });
  saveChain = run.catch(() => {
  });
  return run;
};
var scanLocalDirectory = async (meta, directory) => {
  const response = await fetch(
    `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(directory)}`,
    { credentials: "same-origin", headers: { "x-dsh-panel": "1" } }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json().catch(() => ({}));
};
var ACCESS_TIMEOUT_MS = 32e3;
async function imageryProvider(Cesium, source) {
  const options = {};
  if (source.credit) options.credit = source.credit;
  if (source.type === "arcgis") return Cesium.ArcGisMapServerImageryProvider.fromUrl(source.url, options);
  if (source.type === "wms") {
    return new Cesium.WebMapServiceImageryProvider({
      url: source.url,
      layers: source.layers ?? "",
      parameters: { service: "WMS", version: "1.1.1", transparent: true, format: "image/png" },
      ...options
    });
  }
  if (source.maximumLevel !== void 0) options.maximumLevel = source.maximumLevel;
  if (source.subdomains) options.subdomains = source.subdomains;
  if (source.tilingScheme === "geographic") options.tilingScheme = new Cesium.GeographicTilingScheme();
  if (source.tilingScheme === "web-mercator") options.tilingScheme = new Cesium.WebMercatorTilingScheme();
  const template = source.reverseY ? source.url.replace(/\{y\}/g, "{reverseY}") : source.url;
  return new Cesium.UrlTemplateImageryProvider({ url: template, ...options });
}
async function terrainProvider(Cesium, source) {
  const options = {};
  if (source.credit) options.credit = source.credit;
  if (source.requestVertexNormals) options.requestVertexNormals = true;
  if (source.requestWaterMask) options.requestWaterMask = true;
  if (source.type === "cesium") return Cesium.CesiumTerrainProvider.fromUrl(source.url, options);
  return Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(source.url, options);
}

// src/client/cursor.js
var PICK_POSITION_MAX_CAMERA_HEIGHT = 1e5;
var HUD_SAMPLE_INTERVAL_MS = 180;
var HUD_SETTLE_MS = 180;
function sampleCursor(viewer, Cesium, position, options = {}) {
  const scene = viewer.scene;
  const ellipsoid = scene.globe.ellipsoid;
  const ray = viewer.camera.getPickRay(position);
  const interval = ray ? Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid) : void 0;
  let carto = interval ? ellipsoid.cartesianToCartographic(Cesium.Ray.getPoint(ray, interval.start)) : null;
  if (!carto) return null;
  carto.height = 0;
  let sampled = false;
  const cameraHeight = viewer.camera.positionCartographic.height;
  if (options.pickPosition === true && scene.pickPositionSupported && cameraHeight < PICK_POSITION_MAX_CAMERA_HEIGHT) {
    try {
      const point = scene.pickPosition(position);
      if (Cesium.defined(point)) {
        const depthCarto = Cesium.Cartographic.fromCartesian(point);
        if (depthCarto && Math.abs(depthCarto.height) < 3e4) {
          carto = depthCarto;
          sampled = true;
        }
      }
    } catch {
    }
  }
  if (!sampled) {
    const provider = scene.globe.terrainProvider;
    const flat = provider instanceof Cesium.EllipsoidTerrainProvider;
    if (!flat && typeof scene.globe.getHeight === "function") {
      const terrainHeight = scene.globe.getHeight(carto);
      if (typeof terrainHeight === "number" && Number.isFinite(terrainHeight)) carto.height = terrainHeight;
    } else {
      carto.height = 0;
    }
  } else if (scene.globe.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
    if (Math.abs(carto.height) < 100) carto.height = 0;
  }
  return carto;
}
var formatCursor = (Cesium, carto) => {
  const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
  const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
  const height = Math.abs(carto.height) < 0.05 ? 0 : carto.height;
  return `${lon}, ${lat} · ${t("hud.elevation", { value: formatHeight(height) })}`;
};

// src/client/preferences.js
var AUTO_OPEN_KEY = "dsh.digital-earth.autoOpenPanel";
var readAutoOpen = () => {
  try {
    const stored = window.localStorage.getItem(AUTO_OPEN_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
};
var writeAutoOpen = (value) => {
  try {
    window.localStorage.setItem(AUTO_OPEN_KEY, value ? "1" : "0");
  } catch {
  }
};
var toolArg = (block, key) => {
  const call = block?.call;
  if (typeof call?.argsRaw === "string") {
    try {
      const parsed = JSON.parse(call.argsRaw);
      if (parsed && typeof parsed === "object" && typeof parsed[key] === "string") return parsed[key];
    } catch {
    }
  }
  const view = block?.args;
  if (view && typeof view === "object") {
    try {
      if (typeof view.text === "function") {
        const text = view.text(key);
        if (typeof text === "string" && text !== "") return text;
      }
      if (typeof view[key] === "string") return view[key];
    } catch {
    }
  }
  return void 0;
};
var folderName = (dir) => String(dir).replace(/[\\/]+$/, "").split(/[\\/]/).pop() || String(dir);

// src/client/scene-store.js
var SCENE_STORE_PREFIX = "dsh.digital-earth.scene.";
var SCENE_STORE_VERSION = 1;
var SCENE_STORE_MAX_ENTRIES = 12;
var SCENE_STORE_MAX_BYTES = 512 * 1024;
var sceneStoreKey = (sessionId) => `${SCENE_STORE_PREFIX}${sessionId}`;
var sceneStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};
var isSnapshotView = (view) => view !== null && typeof view === "object" && ["lon", "lat", "height", "heading", "pitch"].every(
  (key) => typeof view[key] === "number" && Number.isFinite(view[key])
);
var isSnapshotLayer = (layer) => layer !== null && typeof layer === "object" && typeof layer.name === "string" && layer.source !== null && typeof layer.source === "object" && (typeof layer.source.path === "string" || typeof layer.source.url === "string");
var SNAPSHOT_ANALYSIS_ACTIONS = ["profile", "flood", "sunlight"];
var isSnapshotAnalysis = (analysis) => analysis !== null && typeof analysis === "object" && typeof analysis.action === "string" && SNAPSHOT_ANALYSIS_ACTIONS.includes(analysis.action);
var isSnapshotShader = (item) => item !== null && typeof item === "object" && typeof item.layer === "string" && typeof item.preset === "string";
function normalizeSceneSnapshot(snapshot) {
  if (snapshot === null || typeof snapshot !== "object" || snapshot.v !== SCENE_STORE_VERSION) return null;
  const layers = (Array.isArray(snapshot.layers) ? snapshot.layers : []).filter(isSnapshotLayer).map((layer) => ({ name: layer.name, source: layer.source, visible: layer.visible !== false }));
  const draw = Array.isArray(snapshot.annotations?.draw) ? snapshot.annotations.draw.filter((command) => command !== null && typeof command === "object" && command.geojson !== void 0) : [];
  const measure = Array.isArray(snapshot.annotations?.measure) ? snapshot.annotations.measure.filter(
    (command) => command !== null && typeof command === "object" && typeof command.mode === "string" && Array.isArray(command.points)
  ) : [];
  const shaders = Array.isArray(snapshot.shaders) ? snapshot.shaders.filter(isSnapshotShader).map((item) => ({
    layer: item.layer,
    preset: item.preset,
    params: item.params !== null && typeof item.params === "object" ? item.params : {}
  })) : [];
  return {
    view: isSnapshotView(snapshot.view) ? snapshot.view : null,
    layers,
    annotations: { draw, measure },
    analysis: isSnapshotAnalysis(snapshot.analysis) ? snapshot.analysis : null,
    shaders
  };
}
function readSceneSnapshot(sessionId) {
  if (typeof sessionId !== "string" || sessionId === "") return null;
  const store = sceneStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(sceneStoreKey(sessionId));
    if (typeof raw !== "string" || raw === "") return null;
    return normalizeSceneSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}
function trimSceneSnapshots(store, keepKey) {
  try {
    const entries = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (typeof key !== "string" || !key.startsWith(SCENE_STORE_PREFIX) || key === keepKey) continue;
      let savedAt = "";
      try {
        const parsed = JSON.parse(store.getItem(key));
        if (typeof parsed?.savedAt === "string") savedAt = parsed.savedAt;
      } catch {
      }
      entries.push({ key, savedAt });
    }
    entries.sort((left, right) => left.savedAt.localeCompare(right.savedAt));
    const excess = entries.length + 1 - SCENE_STORE_MAX_ENTRIES;
    for (let index = 0; index < excess; index += 1) store.removeItem(entries[index].key);
  } catch {
  }
}
function writeSceneSnapshot(sessionId, snapshot) {
  if (typeof sessionId !== "string" || sessionId === "") return null;
  const body = { v: SCENE_STORE_VERSION, savedAt: (/* @__PURE__ */ new Date()).toISOString(), ...snapshot };
  let text = "";
  try {
    text = JSON.stringify(body);
  } catch {
    return null;
  }
  if (text.length > SCENE_STORE_MAX_BYTES) {
    body.annotations = { draw: [], measure: [] };
    body.analysis = null;
    try {
      text = JSON.stringify(body);
    } catch {
      return null;
    }
    if (text.length > SCENE_STORE_MAX_BYTES) return null;
  }
  const store = sceneStorage();
  if (store) {
    try {
      store.setItem(sceneStoreKey(sessionId), text);
      trimSceneSnapshots(store, sceneStoreKey(sessionId));
    } catch {
    }
  }
  return body;
}

// src/client/scene/overlay-layers.js
var OVERLAY_TYPES = ["wms", "xyz", "arcgis"];
function normalizeOverlayDraft(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const type = typeof raw.type === "string" && OVERLAY_TYPES.includes(raw.type) ? raw.type : null;
  if (type === null) return null;
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (url === "") return null;
  const layers = type === "wms" ? typeof raw.layers === "string" ? raw.layers.trim() : "" : "";
  if (type === "wms" && layers === "") return null;
  const name = (typeof raw.name === "string" ? raw.name.trim() : "") || "叠加图层";
  const opacity = Number.isFinite(Number(raw.opacity)) ? Math.min(1, Math.max(0, Number(raw.opacity))) : 1;
  return { name, type, url, ...layers === "" ? {} : { layers }, opacity, visible: true };
}
function createOverlayLayers({ Cesium, viewer, providerFactory, onError = () => {
} } = {}) {
  const buildProvider = typeof providerFactory === "function" ? providerFactory : async () => {
    throw new Error("overlay provider factory is missing");
  };
  const entries = /* @__PURE__ */ new Map();
  let chain = Promise.resolve();
  const collection = () => {
    try {
      return viewer?.scene?.imageryLayers ?? null;
    } catch {
      return null;
    }
  };
  function enqueue(task) {
    const run = chain.then(task);
    chain = run.catch(() => {
    });
    return run;
  }
  function destroyLayer(layer) {
    const layers = collection();
    if (!layers || !layer) return;
    try {
      layers.remove(layer, true);
    } catch {
    }
  }
  function removeNow(id) {
    const entry = entries.get(id);
    if (!entry) return false;
    destroyLayer(entry.layer);
    entries.delete(id);
    return true;
  }
  function needsRebuild(entry, source) {
    return entry.source.type !== source.type || entry.source.url !== source.url || (entry.source.layers ?? "") !== (source.layers ?? "");
  }
  function applyStyle(entry) {
    if (!entry.layer) return;
    entry.layer.alpha = entry.source.opacity;
    entry.layer.show = entry.source.visible !== false;
  }
  async function addNow(source) {
    const layers = collection();
    if (!layers) return null;
    if (entries.has(source.id)) removeNow(source.id);
    let provider;
    try {
      provider = await buildProvider(Cesium, source);
    } catch (error) {
      onError(error, source);
      return null;
    }
    const layer = layers.addImageryProvider(provider);
    const entry = {
      id: source.id,
      source: { ...source },
      layer
    };
    entries.set(source.id, entry);
    applyStyle(entry);
    return entry;
  }
  return {
    /** Add (or replace) one overlay and return its entry, or null on failure. */
    add(source) {
      return enqueue(() => addNow(source));
    },
    /** Remove one overlay; returns true when it existed. */
    remove(id) {
      return enqueue(() => removeNow(id));
    },
    /** Remove every overlay (used when the panel is destroyed). */
    clear() {
      return enqueue(() => {
        for (const id of [...entries.keys()]) removeNow(id);
      });
    },
    setOpacity(id, opacity) {
      return enqueue(() => {
        const entry = entries.get(id);
        if (!entry) return false;
        entry.source.opacity = Math.min(1, Math.max(0, Number(opacity) || 0));
        applyStyle(entry);
        return true;
      });
    },
    setVisible(id, visible) {
      return enqueue(() => {
        const entry = entries.get(id);
        if (!entry) return false;
        entry.source.visible = visible !== false;
        applyStyle(entry);
        return true;
      });
    },
    /**
     * Reconcile the live stack with a catalog array: add new ids, drop removed
     * ones, rebuild changed sources and refresh opacity/visibility. This is the
     * one entry point the panel calls at mount and after a settings save, so the
     * stack can never drift from `sources.json`.
     */
    sync(sources) {
      return enqueue(async () => {
        const next = Array.isArray(sources) ? sources.filter((item) => item && typeof item.id === "string") : [];
        const wanted = new Set(next.map((item) => item.id));
        const summary = { added: 0, removed: 0, updated: 0, failed: 0 };
        for (const id of [...entries.keys()]) {
          if (!wanted.has(id)) {
            if (removeNow(id)) summary.removed += 1;
          }
        }
        for (const source of next) {
          const existing = entries.get(source.id);
          if (!existing) {
            if (await addNow(source) !== null) summary.added += 1;
            else summary.failed += 1;
            continue;
          }
          if (needsRebuild(existing, source)) {
            removeNow(source.id);
            if (await addNow(source) !== null) summary.added += 1;
            else summary.failed += 1;
            continue;
          }
          existing.source = { ...source };
          applyStyle(existing);
          summary.updated += 1;
        }
        return summary;
      });
    },
    /** Live stack in insert order (bottom-most overlay first). */
    list() {
      return [...entries.values()].map((entry) => ({
        id: entry.id,
        name: entry.source.name,
        type: entry.source.type,
        url: entry.source.url,
        opacity: entry.source.opacity,
        visible: entry.source.visible !== false
      }));
    },
    /** Number of live overlays. */
    size() {
      return entries.size;
    },
    /** Remove every layer and forget the stack (viewer teardown). */
    dispose() {
      return enqueue(() => {
        for (const id of [...entries.keys()]) removeNow(id);
        chain = Promise.resolve();
      });
    }
  };
}

// src/client/scene/motion.js
var EARTH_RADIUS_M = 63710088e-1;
var toRad = (degrees) => degrees * Math.PI / 180;
function viewDistanceM(from, to) {
  if (!from || !to) return 0;
  const lat1 = Number(from.lat);
  const lon1 = Number(from.lon);
  const lat2 = Number(to.lat);
  const lon2 = Number(to.lon);
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return 0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const ground = 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
  const dh = Number(from.height);
  const targetDh = Number(to.height);
  const vertical = Number.isFinite(dh) && Number.isFinite(targetDh) ? targetDh - dh : 0;
  return Math.hypot(ground, vertical);
}
function flightDuration(distanceM, { min = 1.2, mid = 1.6, max = 2.4 } = {}) {
  const low = Number.isFinite(min) ? min : 1.2;
  const middle = Number.isFinite(mid) ? Math.max(mid, low) : Math.max(1.6, low);
  const high = Number.isFinite(max) ? Math.max(max, middle) : Math.max(2.4, middle);
  if (typeof distanceM !== "number" || !Number.isFinite(distanceM) || distanceM <= 0) return low;
  if (distanceM < 2e3) return low;
  if (distanceM < 5e4) return middle;
  return high;
}
function cameraView(viewer, Cesium) {
  const camera = viewer?.camera;
  if (!camera || !Cesium?.Cartographic) return null;
  try {
    const position = camera.positionWC ?? camera.position;
    const carto = Cesium.Cartographic.fromCartesian(position);
    if (!carto) return null;
    return {
      lon: Cesium.Math.toDegrees(carto.longitude),
      lat: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      heading: Cesium.Math.toDegrees(camera.heading ?? 0),
      pitch: Cesium.Math.toDegrees(camera.pitch ?? 0)
    };
  } catch {
    return null;
  }
}

// src/client/scene/bookmarks.js
var BOOKMARK_STORAGE_KEY = "dsh-de:bookmarks:v1";
var MAX_BOOKMARKS = 20;
var MAX_BOOKMARK_CAPTION = 120;
var finite = (value) => typeof value === "number" && Number.isFinite(value);
var normalizeCaption = (value) => typeof value === "string" ? value.trim().slice(0, MAX_BOOKMARK_CAPTION) : "";
function normalizeBookmarkView(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const view = { lon: Number(raw.lon), lat: Number(raw.lat), height: Number(raw.height), heading: Number(raw.heading), pitch: Number(raw.pitch) };
  if (!finite(view.lon) || !finite(view.lat) || !finite(view.height)) return null;
  if (!finite(view.heading)) view.heading = 0;
  if (!finite(view.pitch)) view.pitch = -45;
  if (view.lon < -180 || view.lon > 180 || view.lat < -90 || view.lat > 90) return null;
  if (view.height < 0 || view.height > 4e7) return null;
  return view;
}
function normalizeBookmarks(raw, max = MAX_BOOKMARKS) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = /* @__PURE__ */ new Set();
  const bookmarks = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const id = typeof item.id === "string" && item.id !== "" ? item.id : null;
    if (id === null || seen.has(id)) continue;
    const view = normalizeBookmarkView(item.view);
    if (view === null) continue;
    seen.add(id);
    bookmarks.push({
      id,
      name: typeof item.name === "string" && item.name.trim() !== "" ? item.name.trim().slice(0, 60) : "视角",
      // Additive since v1.7: older saved lists simply have no caption.
      caption: normalizeCaption(item.caption),
      view,
      createdAt: finite(item.createdAt) ? item.createdAt : 0
    });
    if (bookmarks.length >= max) break;
  }
  return bookmarks;
}
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
function loadBookmarks(storage = defaultStorage()) {
  if (!storage || typeof storage.getItem !== "function") return [];
  try {
    return normalizeBookmarks(JSON.parse(storage.getItem(BOOKMARK_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}
function saveBookmarks(list, storage = defaultStorage()) {
  if (!storage || typeof storage.setItem !== "function") return false;
  try {
    storage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(normalizeBookmarks(list)));
    return true;
  } catch {
    return false;
  }
}
function addBookmark(list, view, name, { now = Date.now(), idFactory, caption } = {}) {
  const normalized = normalizeBookmarkView(view);
  if (normalized === null) return { list: normalizeBookmarks(list), bookmark: null };
  const bookmarks = normalizeBookmarks(list);
  const id = typeof idFactory === "function" ? String(idFactory()) : `bm-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const bookmark = {
    id,
    name: typeof name === "string" && name.trim() !== "" ? name.trim().slice(0, 60) : `视角 ${bookmarks.length + 1}`,
    caption: normalizeCaption(caption),
    view: normalized,
    createdAt: now
  };
  return { list: [bookmark, ...bookmarks].slice(0, MAX_BOOKMARKS), bookmark };
}
function updateBookmarkCaption(list, id, caption) {
  return normalizeBookmarks(list).map((item) => item.id === id ? { ...item, caption: normalizeCaption(caption) } : item);
}
function removeBookmark(list, id) {
  return normalizeBookmarks(list).filter((item) => item.id !== id);
}
function flyToBookmark(viewer, Cesium, view, duration) {
  const normalized = normalizeBookmarkView(view);
  if (!viewer?.camera || !Cesium?.Cartesian3 || normalized === null) return false;
  const travel = Number.isFinite(duration) ? duration : flightDuration(viewDistanceM(cameraView(viewer, Cesium), normalized));
  try {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(normalized.lon, normalized.lat, normalized.height),
      orientation: {
        heading: Cesium.Math.toRadians(normalized.heading),
        pitch: Cesium.Math.toRadians(normalized.pitch),
        roll: 0
      },
      duration: travel
    });
    return true;
  } catch {
    return false;
  }
}

// src/client/scene/frame.js
function combinedBoundingSphere(Cesium, layers) {
  const spheres = (Array.isArray(layers) ? layers : []).filter((layer) => layer && layer.visible !== false && layer.tileset && layer.tileset.boundingSphere).map((layer) => layer.tileset.boundingSphere);
  if (spheres.length === 0) return null;
  if (spheres.length === 1) return spheres[0];
  const sum = new Cesium.Cartesian3(0, 0, 0);
  for (const sphere of spheres) Cesium.Cartesian3.add(sum, sphere.center, sum);
  const center = Cesium.Cartesian3.divideByScalar(sum, spheres.length, new Cesium.Cartesian3());
  let radius = 0;
  for (const sphere of spheres) {
    const distance = Cesium.Cartesian3.distance(center, sphere.center);
    radius = Math.max(radius, distance + sphere.radius);
  }
  return new Cesium.BoundingSphere(center, radius);
}
function frameAllLayers(viewer, Cesium, layers, duration) {
  if (!viewer || !Cesium) return false;
  const sphere = combinedBoundingSphere(Cesium, layers);
  if (sphere === null) return false;
  const target = new Cesium.BoundingSphere(sphere.center, sphere.radius * 1.15);
  const travel = Number.isFinite(duration) ? duration : flightDuration(Cesium.Cartesian3.distance(viewer.camera.positionWC, target.center));
  viewer.camera.flyToBoundingSphere(target, { duration: travel });
  return true;
}
function flyToCartographic(viewer, Cesium, carto, duration = 0.8) {
  const camera = viewer?.camera;
  if (!camera || !Cesium || !carto) return false;
  if (!Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) return false;
  const height = camera.positionCartographic.height;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height),
    orientation: { heading: camera.heading, pitch: camera.pitch, roll: 0 },
    duration
  });
  return true;
}

// src/client/scene/ask-agent.js
function createAskAgent(deps) {
  const metaRef = { get current() {
    return deps.getMeta();
  } };
  const sessionRef = { get current() {
    return deps.getSession();
  } };
  const showToast = deps.showToast;
  const t2 = deps.t;
  const captureScene = deps.captureScene;
  const collectSceneStatus = deps.collectSceneStatus;
  const shaderActiveList = deps.shaderActiveList;
  const message2 = deps.message;
  async function askAgent() {
    const analysis = deps.getAnalysis();
    const meta = metaRef.current;
    const session = sessionRef.current;
    if (!meta?.injectUrl || typeof session !== "string" || session === "") {
      showToast(t2("toast.askAgentNoSession"));
      return;
    }
    let snapshotPath = "";
    try {
      const saved = await captureScene({}, session);
      snapshotPath = typeof saved.path === "string" ? saved.path : "";
    } catch {
    }
    let status = null;
    try {
      status = await collectSceneStatus();
    } catch {
      status = null;
    }
    const lines = [
      "[Digital Earth scene context] The user is looking at this scene and will ask a follow-up about it."
    ];
    if (status !== null) {
      const view = status.view ?? {};
      if (Number.isFinite(view.lon) && Number.isFinite(view.lat)) {
        lines.push(
          `Camera: lon=${view.lon}, lat=${view.lat}, height=${view.height} m, heading=${view.heading}°, pitch=${view.pitch}°.`
        );
      }
      const layerText = Array.isArray(status.layers) && status.layers.length > 0 ? status.layers.map((layer) => `${layer.name}${layer.visible === false ? " (hidden)" : ""}`).join(", ") : "none";
      lines.push(`Layers: ${layerText}.`);
      lines.push(`Imagery: ${status.imagery?.name ?? "none"}; terrain: ${status.terrain?.name ?? "none"}.`);
      const annotations = status.annotations ?? {};
      lines.push(
        `Agent overlays: ${annotations.drawn_features ?? 0} annotated features, ${annotations.measured_points ?? 0} measured points.`
      );
    }
    if (analysis !== null && analysis.result) {
      const result = analysis.result;
      if (result.operation === "profile" && result.stats) {
        lines.push(
          `Analysis (profile): length=${result.length_m} m, relief=${result.stats.relief_m} m, min=${result.stats.min_height} m, max=${result.stats.max_height} m, samples=${result.samples}.`
        );
      } else if (result.operation === "flood") {
        lines.push(
          `Analysis (flood): water=${result.water_height} m, area=${result.area_km2} km², inundated=${result.inundated_km2} km², ratio=${result.inundated_ratio}, max depth=${result.depth_max_m} m.`
        );
      } else if (result.operation === "sunlight") {
        lines.push(
          `Analysis (sunlight): datetime=${result.datetime}, altitude=${result.sun?.altitude_deg}°, azimuth=${result.sun?.azimuth_deg}°, shadows=${result.shadows_enabled === true ? "on" : "off"}.`
        );
      }
    }
    const shaders = shaderActiveList();
    if (shaders.length > 0) {
      lines.push(`Shaders: ${shaders.map((item) => `${item.layer}=${item.preset}`).join(", ")}.`);
    }
    if (snapshotPath !== "") lines.push(`Snapshot: ${snapshotPath}`);
    lines.push("Answer from the scene state above; do not invent data that is not in it.");
    try {
      const response = await fetch(meta.injectUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session, text: lines.join("\n") })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) throw new Error(data?.message ?? `HTTP ${response.status}`);
      showToast(t2("toast.askAgentSent"));
    } catch (error) {
      showToast(t2("toast.askAgentFailed", { message: message2(error) }));
    }
  }
  return { askAgent };
}

// src/client/scene/capture.js
function createCaptureService({ getViewer, getRoot, getSettings, getMeta, getSession, t: t2, showToast, setChromeHidden, nextFrames, drawCaptureOverlay }) {
  const MAX_CAPTURE_DATAURL = 75e5;
  async function renderSnapshot(options = {}) {
    const viewer = getViewer();
    if (!viewer) throw new Error(t2("agent.noViewer"));
    const root = getRoot();
    const hidden = !root || root.offsetWidth < 32 || root.offsetHeight < 32 || typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden) throw new Error(t2("agent.hiddenPanel"));
    const width = Math.round(Math.min(Math.max(Number(options.width) || 1280, 480), 2560));
    const format = options.format === "png" ? "png" : "jpeg";
    const settings = getSettings()?.settings ?? {};
    const includeHud = typeof options.include_hud === "boolean" ? options.include_hud : settings.screenshotHud === true;
    if (!includeHud) setChromeHidden(true);
    try {
      await Promise.race([
        nextFrames(2),
        new Promise((_, reject) => setTimeout(() => reject(new Error(t2("agent.hiddenPanel"))), 1500))
      ]);
      const previousResolutionScale = viewer.resolutionScale;
      viewer.resolutionScale = 1;
      try {
        viewer.resize();
        viewer.render();
        const canvas = viewer.canvas;
        const sourceWidth = canvas?.width ?? 0;
        const sourceHeight = canvas?.height ?? 0;
        if (sourceWidth < 32 || sourceHeight < 32) throw new Error(t2("agent.hiddenPanel"));
        let scale = 1;
        let quality = 0.9;
        let targetWidth = 0;
        let targetHeight = 0;
        let dataUrl = "";
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const drawWidth = Math.max(320, Math.round(width * scale));
          targetWidth = Math.min(drawWidth, sourceWidth);
          targetHeight = Math.max(1, Math.round(targetWidth * sourceHeight / sourceWidth));
          const target = document.createElement("canvas");
          target.width = targetWidth;
          target.height = targetHeight;
          const context = target.getContext("2d");
          context.drawImage(canvas, 0, 0, targetWidth, targetHeight);
          if (includeHud) drawCaptureOverlay(context, targetWidth, targetHeight);
          dataUrl = format === "png" ? target.toDataURL("image/png") : target.toDataURL("image/jpeg", quality);
          if (dataUrl.length <= MAX_CAPTURE_DATAURL) break;
          if (format === "jpeg") quality = Math.max(0.5, quality - 0.15);
          else scale *= 0.75;
        }
        if (dataUrl.length > MAX_CAPTURE_DATAURL) throw new Error(t2("agent.captureTooLarge"));
        return { dataUrl, width: targetWidth, height: targetHeight, includeHud, format };
      } finally {
        viewer.resolutionScale = previousResolutionScale;
        viewer.resize();
      }
    } finally {
      if (!includeHud) setChromeHidden(false);
    }
  }
  async function screenshot() {
    try {
      const shot = await renderSnapshot({ format: "png" });
      const link = document.createElement("a");
      link.href = shot.dataUrl;
      link.download = `digital-earth-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.png`;
      link.click();
      showToast(t2("toast.screenshotSaved"));
    } catch (error) {
      showToast(t2("toast.screenshotFailed", { message: error?.message ?? String(error) }));
    }
  }
  async function captureScene(options = {}, session = null) {
    const meta = getMeta();
    if (!meta?.captureUrl) throw new Error(t2("agent.notReady"));
    const shot = await renderSnapshot(options);
    const response = await fetch(`${meta.captureUrl}?token=${encodeURIComponent(meta.token)}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session: session ?? getSession() ?? "",
        dataUrl: shot.dataUrl,
        width: shot.width,
        height: shot.height,
        hud: shot.includeHud,
        label: typeof options.label === "string" ? options.label : ""
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const saved = await response.json();
    showToast(
      t2("toast.captureSaved", {
        width: saved.width,
        height: saved.height,
        path: saved.name ?? saved.path ?? ""
      })
    );
    return { ...saved, hud: shot.includeHud };
  }
  return { renderSnapshot, screenshot, captureScene };
}

// src/client/scene/capture-hud.js
function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height - r);
  context.arcTo(x + width, y + height, x + width - r, y + height, r);
  context.lineTo(x + r, y + height);
  context.arcTo(x, y + height, x, y + height - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}
function createCaptureHud({ getViewer, getCesium, getSources, getLayers, getMeta, getReadout, t: t2 }) {
  return function drawCaptureOverlay(context, width, height) {
    const viewer = getViewer();
    const Cesium = getCesium();
    if (!viewer || !Cesium) return;
    const font = Math.max(11, Math.min(24, Math.round(width * 0.0155)));
    const padding = Math.max(10, Math.round(font * 0.75));
    const lineGap = Math.round(font * 1.6);
    const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);
    const lon = cartographic ? Cesium.Math.toDegrees(cartographic.longitude).toFixed(4) : "—";
    const lat = cartographic ? Cesium.Math.toDegrees(cartographic.latitude).toFixed(4) : "—";
    const cameraHeight = cartographic ? Math.round(cartographic.height) : 0;
    const heading = Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0));
    const pitch = Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0));
    const config = getSources() ?? { imagery: [], terrain: [], settings: {} };
    const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null;
    const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null;
    const lastReadout = getReadout();
    let pointerText = lastReadout || "";
    if (!pointerText) {
      const center = new Cesium.Cartesian2(
        Math.round(viewer.canvas.clientWidth / 2),
        Math.round(viewer.canvas.clientHeight / 2)
      );
      const carto = sampleCursor(viewer, Cesium, center, { pickPosition: true });
      if (carto) pointerText = formatCursor(Cesium, carto);
    }
    const layers = getLayers() ?? [];
    const visibleCount = layers.filter((layer) => layer.visible).length;
    const lines = [
      `${lastReadout ? t2("hud.pointer") : t2("hud.center")}  ${pointerText || t2("hud.empty")}`,
      `${t2("hud.camera")} ${cameraHeight} m · ${t2("hud.heading")} ${heading}° · ${pitch}°`,
      `${t2("hud.layers")} ${visibleCount}/${layers.length} · ${imagery?.name ?? "—"} · ${terrain?.name ?? "—"}`,
      `${t2("hud.cameraPos")} ${lon}, ${lat}`
    ];
    const family = '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    context.save();
    context.font = `${font}px ${family}`;
    context.textBaseline = "top";
    context.textAlign = "left";
    const textWidth = Math.max(...lines.map((line) => context.measureText(line).width));
    const boxWidth = Math.min(width - padding * 2, textWidth + padding * 2);
    const boxHeight = lines.length * lineGap + padding * 2;
    const boxX = padding;
    const boxY = height - boxHeight - padding;
    context.fillStyle = "rgba(8, 12, 18, 0.6)";
    roundedRectPath(context, boxX, boxY, boxWidth, boxHeight, Math.round(font * 0.65));
    context.fill();
    lines.forEach((line, index) => {
      context.fillStyle = index === 0 ? "#eef4ff" : "#c5d2e2";
      context.fillText(line, boxX + padding, boxY + padding + index * lineGap);
    });
    const title = t2("panel.title");
    const aboutMeta = getMeta();
    const teamName = aboutMeta?.team?.name ?? t2("about.teamName");
    let teamHost = "www.whu-cveo.com";
    try {
      teamHost = new URL(aboutMeta?.team?.url ?? FALLBACK_ABOUT.teamUrl).host || teamHost;
    } catch {
    }
    context.font = `600 ${font}px ${family}`;
    context.fillStyle = "rgba(240, 246, 255, 0.9)";
    context.shadowColor = "rgba(0, 0, 0, 0.45)";
    context.shadowBlur = Math.round(font * 0.6);
    context.fillText(title, padding, padding);
    const credit = `${teamName} · ${teamHost}`;
    context.textAlign = "right";
    context.font = `${Math.max(10, Math.round(font * 0.85))}px ${family}`;
    context.fillStyle = "rgba(238, 244, 255, 0.85)";
    context.fillText(credit, width - padding, height - padding - font);
    context.restore();
  };
}

// src/client/scene/pointer-tools.js
function createPointerTools(deps) {
  const cesiumRef = { get current() {
    return deps.getCesium();
  } };
  const viewerRef = { get current() {
    return deps.getViewer();
  } };
  const toolRef = deps.toolRef;
  const measureRef = deps.measureRef;
  const setPickInfo = deps.setPickInfo;
  const showToast = deps.showToast;
  const pickSurface = deps.pickSurface;
  const redrawMeasure = deps.redrawMeasure;
  const onFinishTool = deps.onFinishTool;
  const formatValue2 = deps.formatValue;
  const layerLabel = deps.layerLabel;
  const t2 = deps.t;
  function pickResult(position) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return { picked: false, type: "none", properties: [] };
    const picked = viewer.scene.pick(position);
    if (!Cesium.defined(picked)) return { picked: false, type: "none", properties: [] };
    if (picked instanceof Cesium.Cesium3DTileFeature) {
      const properties = [];
      for (const id of picked.getPropertyIds()) {
        if (properties.length >= 40) break;
        properties.push({ name: id, value: formatValue2(picked.getProperty(id)) });
      }
      return {
        picked: true,
        type: "tile-feature",
        layer: layerLabel(picked.primitive ?? picked.tileset),
        properties
      };
    }
    const primitive = picked?.primitive ?? picked;
    if (primitive instanceof Cesium.Cesium3DTileset) {
      return { picked: true, type: "tileset", layer: layerLabel(primitive), properties: [] };
    }
    if (picked?.id instanceof Cesium.Entity) {
      return { picked: true, type: "entity", name: String(picked.id.name ?? picked.id.id), properties: [] };
    }
    return { picked: true, type: "scene", properties: [] };
  }
  function pickAt(position) {
    const result = pickResult(position);
    if (!result.picked) {
      setPickInfo({ title: t2("toast.pickNone"), rows: [] });
      return;
    }
    if (result.type === "tile-feature") {
      const rows = result.properties.map((entry) => [entry.name, entry.value]);
      if (rows.length === 0) rows.push([t2("pick.noProperties"), t2("pick.noPropertiesValue")]);
      setPickInfo({ title: result.layer, rows });
      return;
    }
    if (result.type === "tileset") {
      setPickInfo({
        title: t2("pick.title"),
        rows: [
          [t2("pick.type"), t2("pick.tiles")],
          [t2("pick.layer"), result.layer]
        ]
      });
      return;
    }
    if (result.type === "entity") {
      setPickInfo({
        title: t2("pick.title"),
        rows: [
          [t2("pick.type"), t2("pick.entity")],
          [t2("pick.name"), result.name]
        ]
      });
      return;
    }
    setPickInfo({ title: t2("pick.title"), rows: [[t2("pick.type"), t2("pick.scene")]] });
  }
  function onCanvasClick(position) {
    const mode = toolRef.current;
    if (mode === null) return;
    if (mode === "identify") {
      if (typeof deps.onIdentify === "function") deps.onIdentify(position);
      return;
    }
    if (mode === "pick") {
      pickAt(position);
      return;
    }
    const surface = pickSurface(position);
    if (!surface) {
      showToast(t2("toast.noSurface"));
      return;
    }
    measureRef.current.points.push(surface);
    if (mode === "height" && measureRef.current.points.length > 2) {
      measureRef.current.points.splice(0, measureRef.current.points.length - 2);
    }
    redrawMeasure(mode);
  }
  function finishMeasure() {
    if (toolRef.current === "distance" || toolRef.current === "area") {
      toolRef.current = null;
      onFinishTool();
    }
  }
  return { pickResult, pickAt, onCanvasClick, finishMeasure };
}

// src/client/scene/selection.js
var EVIDENCE_SCHEMA_VERSION = 1;
var SELECTION_RADII_M = [30, 60, 120];
var SELECTION_DIRECTIONS = 8;
var SELECTION_MIN_SAMPLES = 4;
var SELECTION_MAX_PROPERTIES = 24;
var METERS_PER_DEGREE_LAT = 110540;
var METERS_PER_DEGREE_LON = 111320;
var IDENTITY_KEYS = ["name", "Name", "NAME", "title", "id", "ID", "identifier"];
function round1(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}
function offsetCartographic(lon, lat, bearingDeg, distanceM) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (!Number.isFinite(bearingDeg) || !Number.isFinite(distanceM) || distanceM <= 0) return null;
  const bearing = bearingDeg * Math.PI / 180;
  const north = distanceM * Math.cos(bearing) / METERS_PER_DEGREE_LAT;
  const cosLat = Math.max(0.02, Math.cos(lat * Math.PI / 180));
  const east = distanceM * Math.sin(bearing) / (METERS_PER_DEGREE_LON * cosLat);
  const nextLat = Math.min(89, Math.max(-89, lat + north));
  let nextLon = lon + east;
  if (nextLon > 180) nextLon -= 360;
  else if (nextLon < -180) nextLon += 360;
  return { lon: nextLon, lat: nextLat };
}
function selectionOffsets(center, { radii = SELECTION_RADII_M, directions = SELECTION_DIRECTIONS } = {}) {
  const lon = Number(center?.lon);
  const lat = Number(center?.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
  const list = [];
  const count = Math.max(1, Math.min(directions, 36));
  for (const radius of radii) {
    if (!Number.isFinite(radius) || radius <= 0) continue;
    for (let step = 0; step < count; step += 1) {
      const bearing = step * 360 / count;
      const point = offsetCartographic(lon, lat, bearing, radius);
      if (point) list.push({ lon: point.lon, lat: point.lat, distance_m: radius, bearing_deg: bearing });
    }
  }
  return list;
}
function medianOf(values) {
  const list = (Array.isArray(values) ? values : []).filter((value) => typeof value === "number" && Number.isFinite(value));
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
function summarizeHeights(values) {
  const list = (Array.isArray(values) ? values : []).filter((value) => typeof value === "number" && Number.isFinite(value));
  if (list.length === 0) {
    return { count: 0, min: null, max: null, median: null, spread: null };
  }
  const sorted = [...list].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return {
    count: sorted.length,
    min: round1(min),
    max: round1(max),
    median: round1(medianOf(sorted)),
    spread: round1(max - min)
  };
}
function normalizeIdentity(raw) {
  const kind = typeof raw?.kind === "string" ? raw.kind : "scene";
  const properties = (Array.isArray(raw?.properties) ? raw.properties : []).filter((entry) => entry && typeof entry.name === "string").slice(0, SELECTION_MAX_PROPERTIES).map((entry) => ({ name: entry.name.slice(0, 60), value: String(entry.value ?? "").slice(0, 160) }));
  let name = typeof raw?.name === "string" && raw.name.trim() !== "" ? raw.name.trim().slice(0, 80) : null;
  if (name === null) {
    const found = properties.find((entry) => IDENTITY_KEYS.includes(entry.name));
    if (found && found.value.trim() !== "") name = found.value.trim().slice(0, 80);
  }
  return {
    kind,
    name,
    properties,
    basis: name === null ? "geometry_only" : kind === "entity" ? "entity_name" : "layer_metadata"
  };
}
function selectionLimitations({ identity, layer, sampling }) {
  const limitations = [];
  if (identity.kind === "tileset") limitations.push("tile_feature_only");
  if (identity.kind === "tile_feature" && identity.name === null) limitations.push("no_feature_name");
  if (identity.name === null) limitations.push("no_building_identity");
  if (sampling.count < SELECTION_MIN_SAMPLES) limitations.push("too_few_height_samples");
  if (sampling.count > 0) limitations.push("neighbour_sampled_height");
  if (!layer) limitations.push("layer_source_unknown");
  return limitations;
}
function selectionUnknowns(identity) {
  const unknowns = [];
  if (identity.name === null) unknowns.push("name");
  unknowns.push("use", "ownership", "footprint");
  return unknowns;
}
function buildSelectionCard({ point, layer, identity: rawIdentity, samples, id, createdAt } = {}) {
  const safePoint = {
    lon: round1(Number(point?.lon)) ?? 0,
    lat: round1(Number(point?.lat)) ?? 0,
    surface_height_m: round1(Number(point?.surface_height_m))
  };
  const identity = normalizeIdentity(rawIdentity);
  const list = Array.isArray(samples) ? samples : [];
  const heights = list.map((sample) => typeof sample?.height_m === "number" ? sample.height_m : null);
  const sampling = {
    method: "neighbor_ring",
    radii_m: SELECTION_RADII_M,
    directions: SELECTION_DIRECTIONS,
    requested: list.length,
    count: summarizeHeights(heights).count,
    ...summarizeHeights(heights)
  };
  const lowest = list.filter((sample) => typeof sample?.height_m === "number").sort((a, b) => a.height_m - b.height_m)[0];
  const ground = sampling.min;
  const groundSource = lowest?.source ?? "none";
  const objectHeight = safePoint.surface_height_m !== null && ground !== null ? round1(Math.max(0, safePoint.surface_height_m - ground)) : null;
  const aboveMedian = safePoint.surface_height_m !== null && sampling.median !== null ? round1(safePoint.surface_height_m - sampling.median) : null;
  const facts = [
    {
      key: "surface_height",
      value: safePoint.surface_height_m,
      unit: "m",
      basis: "measured",
      source: "height_service"
    },
    {
      key: "object_height",
      value: objectHeight,
      unit: "m",
      basis: objectHeight === null ? "inferred" : "estimated",
      method: "neighbor_ring",
      sample_count: sampling.count,
      ground_m: ground,
      spread_m: sampling.spread
    },
    {
      key: "above_median",
      value: aboveMedian,
      unit: "m",
      basis: aboveMedian === null ? "inferred" : "estimated",
      method: "neighbor_ring"
    },
    {
      key: "ground_source",
      value: groundSource,
      unit: null,
      basis: "measured"
    }
  ];
  const confidence = objectHeight === null ? "inferred" : "estimated";
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: typeof id === "string" && id !== "" ? id : `sel-${Date.now().toString(36)}`,
    createdAt: typeof createdAt === "string" ? createdAt : (/* @__PURE__ */ new Date()).toISOString(),
    point: safePoint,
    layer: layer ? { id: layer.id ?? null, name: layer.name ?? null, source: layer.source ?? null } : null,
    identity,
    sampling,
    facts,
    confidence,
    unknowns: selectionUnknowns(identity),
    limitations: selectionLimitations({ identity, layer, sampling })
  };
}
function buildEvidencePack({ card, view, pluginVersion, capturedAt, image } = {}) {
  const safeView = view ? {
    lon: round1(Number(view.lon)),
    lat: round1(Number(view.lat)),
    height: round1(Number(view.height)),
    heading: round1(Number(view.heading)),
    pitch: round1(Number(view.pitch))
  } : null;
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    kind: "digital-earth-evidence",
    id: card?.id ?? null,
    capturedAt: typeof capturedAt === "string" ? capturedAt : (/* @__PURE__ */ new Date()).toISOString(),
    pluginVersion: typeof pluginVersion === "string" ? pluginVersion : null,
    view: safeView,
    point: card?.point ?? null,
    layer: card?.layer ?? null,
    identity: card?.identity ?? null,
    facts: Array.isArray(card?.facts) ? card.facts : [],
    sampling: card?.sampling ?? null,
    confidence: card?.confidence ?? "inferred",
    unknowns: Array.isArray(card?.unknowns) ? card.unknowns : [],
    limitations: Array.isArray(card?.limitations) ? card.limitations : [],
    earth: { datum: "WGS84", height_reference: "ellipsoid" },
    image: image && typeof image === "object" ? {
      format: image.format === "jpeg" ? "jpeg" : "png",
      width: Number.isInteger(image.width) ? image.width : null,
      height: Number.isInteger(image.height) ? image.height : null
    } : null
  };
}

// src/client/scene/evidence-export.js
async function postEvidence({ card, view, pluginVersion, exportUrl, snapshot = null, label = "selection", fetchImpl } = {}) {
  if (typeof exportUrl !== "string" || exportUrl === "") throw new Error("export_unavailable");
  const pack = buildEvidencePack({
    card,
    view,
    pluginVersion,
    image: snapshot ? { format: snapshot.format, width: snapshot.width, height: snapshot.height } : null
  });
  const doFetch = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  const response = await doFetch(exportUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "evidence", label, card: pack, image: snapshot?.dataUrl })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// src/client/scene/selection-controller.js
function formatProperty(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "string") return value.slice(0, 160);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, 160);
  } catch {
    return String(value).slice(0, 160);
  }
}
function createSelectionController({ getViewer, getCesium, getLayers, getMeta } = {}) {
  function findLayer(tileset) {
    const list = typeof getLayers === "function" ? getLayers() : [];
    return (Array.isArray(list) ? list : []).find((layer) => layer && layer.tileset === tileset) ?? null;
  }
  function classifyPick(picked, Cesium) {
    if (picked === void 0 || picked === null) return { kind: "scene", tileset: null, properties: [] };
    if (typeof Cesium?.Cesium3DTileFeature === "function" && picked instanceof Cesium.Cesium3DTileFeature) {
      const properties = [];
      try {
        for (const id of picked.getPropertyIds()) {
          if (properties.length >= SELECTION_MAX_PROPERTIES) break;
          properties.push({ name: String(id), value: formatProperty(picked.getProperty(id)) });
        }
      } catch {
      }
      return { kind: "tile_feature", tileset: picked.primitive ?? picked.tileset ?? null, properties };
    }
    const primitive = picked?.primitive ?? picked;
    if (typeof Cesium?.Cesium3DTileset === "function" && primitive instanceof Cesium.Cesium3DTileset) {
      return { kind: "tileset", tileset: primitive, properties: [] };
    }
    if (picked?.id && typeof Cesium?.Entity === "function" && picked.id instanceof Cesium.Entity) {
      return { kind: "entity", name: String(picked.id.name ?? picked.id.id ?? ""), properties: [] };
    }
    return { kind: "scene", tileset: null, properties: [] };
  }
  function currentView() {
    return cameraView(getViewer(), getCesium());
  }
  async function identifyAt(position) {
    const viewer = getViewer();
    const Cesium = getCesium();
    if (!viewer || !Cesium) throw new Error("not_ready");
    const carto = sampleCursor(viewer, Cesium, position, { pickPosition: true });
    if (!carto) throw new Error("no_surface");
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const classified = classifyPick(viewer.scene.pick(position), Cesium);
    const layer = findLayer(classified.tileset);
    let anchor = null;
    try {
      const picked = viewer.scene.pickPosition(position);
      if (Cesium.defined(picked)) anchor = picked;
    } catch {
      anchor = null;
    }
    if (!anchor) anchor = Cesium.Cartesian3.fromDegrees(lon, lat, carto.height);
    const identity = {
      kind: classified.kind,
      name: classified.name ?? null,
      properties: classified.properties ?? []
    };
    const heightService = createHeightService({ Cesium, viewer, layer });
    const samples = [];
    for (const offset of selectionOffsets({ lon, lat })) {
      const probe = new Cesium.Cartographic(Cesium.Math.toRadians(offset.lon), Cesium.Math.toRadians(offset.lat));
      let sample = null;
      try {
        sample = await heightService.sample(probe, { mode: "surface" });
      } catch {
        sample = null;
      }
      samples.push({
        distance_m: offset.distance_m,
        bearing_deg: offset.bearing_deg,
        height_m: sample && typeof sample.height === "number" ? sample.height : null,
        source: sample?.source ?? "none"
      });
    }
    const card = buildSelectionCard({
      point: { lon, lat, surface_height_m: carto.height },
      layer,
      identity,
      samples
    });
    return { card, anchor };
  }
  async function exportEvidence(card, snapshot = null) {
    const meta = typeof getMeta === "function" ? getMeta() : null;
    return postEvidence({
      card,
      view: currentView(),
      pluginVersion: meta?.version ?? null,
      exportUrl: meta?.exportUrl ?? null,
      snapshot
    });
  }
  return { identifyAt, exportEvidence, currentView, getViewer, getCesium };
}

// src/client/scene/command-bridge.js
function createCommandBridge(deps) {
  const cesiumRef = { get current() {
    return deps.getCesium();
  } };
  const viewerRef = { get current() {
    return deps.getViewer();
  } };
  const sourcesRef = { get current() {
    return deps.getSources();
  } };
  const layersRef = { get current() {
    return deps.getLayers();
  } };
  const metaRef = { get current() {
    return deps.getMeta();
  } };
  const agentOverlayRef = { get current() {
    return deps.getAgentOverlays();
  } };
  const t2 = deps.t;
  const findLayer = deps.findLayer;
  const normalizeAccessRequest = deps.normalizeAccessRequest;
  const askPathAccess = deps.askPathAccess;
  const collectSceneStatus = deps.collectSceneStatus;
  const captureScene = deps.captureScene;
  const redactUrl2 = deps.redactUrl;
  const analyzeCommand = deps.analyzeCommand;
  const shaderCommand = deps.shaderCommand;
  const message2 = deps.message;
  const sourceOfLayer = deps.sourceOfLayer;
  const layerRuntime = deps.layerRuntime;
  const localPathToUrl = deps.localPathToUrl;
  const loadTileset = deps.loadTileset;
  const removeLayer = deps.removeLayer;
  const setLayerVisible = deps.setLayerVisible;
  const applyImagery = deps.applyImagery;
  const updateSettings = deps.updateSettings;
  const applyTerrain = deps.applyTerrain;
  const clampNumber = deps.clampNumber;
  const delay = deps.delay;
  const resetView = deps.resetView;
  const pickResult = deps.pickResult;
  const clearAgentOverlays2 = deps.clearAgentOverlays;
  const drawAgentOverlay = deps.drawAgentOverlay;
  const measureAgentOverlay = deps.measureAgentOverlay;
  const buildSceneReport = deps.buildSceneReport;
  async function runCommand(action, args = {}, session = null) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} };
    const layerList = () => layersRef.current.map((layer) => layer.name).join(", ") || "—";
    const requireLayer = () => {
      const token = typeof args.layer === "string" ? args.layer.trim() : "";
      if (!token) throw new Error(t2("agent.missingLayer"));
      const layer = findLayer(token);
      if (!layer) throw new Error(t2("agent.unknownLayer", { name: token, list: layerList() }));
      return layer;
    };
    if (action === "authorize") {
      const request = normalizeAccessRequest(args);
      if (!request.directory) throw new Error(`access_denied: ${t2("access.badPath")}`);
      const decision = await askPathAccess(request);
      if (!decision.allowed) throw new Error(`access_denied: ${decision.message || t2("access.denied")}`);
      return { authorized: true, directory: decision.directory };
    }
    if (action === "status") return collectSceneStatus();
    if (action === "capture") {
      const saved = await captureScene(
        {
          width: args.width,
          format: args.format,
          include_hud: args.include_hud,
          label: args.label
        },
        session
      );
      return {
        path: saved.path,
        url: redactUrl2(saved.url),
        width: saved.width,
        height: saved.height,
        bytes: saved.bytes,
        hud_hidden: saved.hud !== true,
        layers_visible: layersRef.current.filter((layer) => layer.visible).length,
        view: (await collectSceneStatus()).view
      };
    }
    if (action === "analyze") {
      try {
        return await analyzeCommand(args);
      } catch (error) {
        const text = message2(error);
        if (text.includes("next:")) throw error;
        throw new Error(`${text} next: 用 earth_scene 检查面板与数据状态后重试，或先执行 analyze clear。`);
      }
    }
    if (action === "shader") {
      try {
        return await shaderCommand(args);
      } catch (error) {
        const text = message2(error);
        if (text.includes("next:")) throw error;
        throw new Error(`${text} next: 用 earth_scene 的 list 动作确认图层后，先 shader reset 再重试。`);
      }
    }
    if (!Cesium || !viewer) throw new Error(t2("agent.notReady"));
    if (action === "inspect") {
      const layer = requireLayer();
      const source = sourceOfLayer(layer);
      if (!source) throw new Error(t2("agent.unknownSource", { name: layer.name }));
      return { layer: layer.name, source, runtime: layerRuntime(layer) };
    }
    if (action === "list") {
      const status = await collectSceneStatus();
      return { layers: status.layers, sources: status.sources, imagery: status.imagery, terrain: status.terrain };
    }
    if (action === "load") {
      const rawPath = typeof args.path === "string" ? args.path.trim() : "";
      let url = typeof args.url === "string" ? args.url.trim() : "";
      if (!url && rawPath) {
        try {
          url = /^https?:/i.test(rawPath) ? rawPath : await localPathToUrl(rawPath);
        } catch (error) {
          throw new Error(t2("agent.dirDenied", { message: message2(error) }));
        }
      }
      const localTilesBase = typeof metaRef.current?.tilesBase === "string" ? metaRef.current.tilesBase : "";
      const isHostTilesUrl = localTilesBase !== "" && url.startsWith(localTilesBase);
      if (!/^https?:\/\//i.test(url) && !isHostTilesUrl) throw new Error(t2("agent.missingUrl"));
      const label = rawPath ? rawPath.replace(/\\/g, "/").split("/").filter(Boolean).slice(-2).join("/") : void 0;
      const source = rawPath && !/^https?:\/\//i.test(rawPath) ? { kind: "local", path: rawPath } : { kind: "remote", url: rawPath || url };
      const layer = await loadTileset(url, label, source);
      return {
        loaded: true,
        layer: { id: layer.id, name: layer.name, url: redactUrl2(layer.url) },
        view: (await collectSceneStatus()).view,
        layers_count: layersRef.current.length
      };
    }
    if (action === "remove") {
      const layer = requireLayer();
      removeLayer(layer.id);
      return { removed: layer.name, layers: layersRef.current.map((item) => item.name) };
    }
    if (action === "visible") {
      if (typeof args.visible !== "boolean") throw new Error("Provide visible (true or false).");
      const layer = requireLayer();
      setLayerVisible(layer.id, args.visible);
      return { id: layer.id, name: layer.name, visible: layer.visible };
    }
    if (action === "basemap") {
      const id = typeof args.imagery === "string" && args.imagery !== "" ? args.imagery : null;
      if (id === null) {
        const outcome2 = await applyImagery(null, false);
        if (!outcome2.ok) throw new Error(outcome2.error);
        updateSettings({ imagery: null });
        return { imagery: null };
      }
      const source = config.imagery.find((item) => item.id === id || item.name === id) ?? null;
      if (!source) {
        throw new Error(
          t2("agent.unknownImagery", {
            name: id,
            list: config.imagery.map((item) => `${item.id} (${item.name})`).join(", ") || "—"
          })
        );
      }
      const outcome = await applyImagery(source.id, false);
      if (!outcome.ok) throw new Error(outcome.error);
      updateSettings({ imagery: source.id });
      return { imagery: { id: source.id, name: source.name } };
    }
    if (action === "terrain") {
      const id = typeof args.terrain === "string" && args.terrain !== "" ? args.terrain : null;
      if (id === null) {
        const outcome2 = await applyTerrain(null, false);
        if (!outcome2.ok) throw new Error(outcome2.error);
        updateSettings({ terrain: null });
        return { terrain: null };
      }
      const source = config.terrain.find((item) => item.id === id || item.name === id) ?? null;
      if (!source) {
        throw new Error(
          t2("agent.unknownTerrain", {
            name: id,
            list: config.terrain.map((item) => `${item.id} (${item.name})`).join(", ") || "—"
          })
        );
      }
      const outcome = await applyTerrain(source.id, false);
      if (!outcome.ok) throw new Error(outcome.error);
      updateSettings({ terrain: source.id });
      return { terrain: { id: source.id, name: source.name } };
    }
    if (action === "fly") {
      if (typeof args.lon !== "number" || typeof args.lat !== "number") throw new Error(t2("agent.missingCoords"));
      const height = clampNumber(args.height, 1500, 1, 4e7);
      const heading = clampNumber(args.heading, 0, -360, 360);
      const pitch = clampNumber(args.pitch, -45, -90, 90);
      const duration = clampNumber(args.duration, 1.2, 0, 5);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(args.lon, args.lat, height),
        orientation: {
          heading: Cesium.Math.toRadians(heading),
          pitch: Cesium.Math.toRadians(pitch),
          roll: 0
        },
        duration
      });
      await delay(duration * 1e3 + 200);
      return { view: (await collectSceneStatus()).view };
    }
    if (action === "reset") {
      resetView();
      await delay(1400);
      return { view: (await collectSceneStatus()).view };
    }
    if (action === "pick") {
      const position = new Cesium.Cartesian2(
        Math.round(viewer.canvas.clientWidth / 2),
        Math.round(viewer.canvas.clientHeight / 2)
      );
      return pickResult(position);
    }
    if (action === "draw") {
      if (args.clear === true) clearAgentOverlays2("all");
      const outcome = args.geojson !== void 0 ? drawAgentOverlay(Cesium, viewer, args.geojson, args.style, args.label) : { drawn: 0, by_type: { points: 0, lines: 0, polygons: 0 }, bbox: null };
      const value = {
        ok: true,
        cleared: args.clear === true,
        drawn: outcome.drawn,
        by_type: outcome.by_type,
        bbox: outcome.bbox,
        overlays: agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length
      };
      if (typeof args.label === "string" && args.label !== "") value.label = args.label;
      return value;
    }
    if (action === "measure") {
      if (args.clear === true) clearAgentOverlays2("all");
      const value = measureAgentOverlay(Cesium, viewer, args);
      value.cleared = args.clear === true;
      value.overlays = agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length;
      return value;
    }
    if (action === "report") {
      const meta = metaRef.current;
      if (!meta?.reportUrl) throw new Error(t2("agent.notReady"));
      const report = await buildSceneReport(args);
      const response = await fetch(meta.reportUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const saved = await response.json();
      return {
        operation: "report",
        path: saved.path,
        format: saved.format ?? report.format,
        bytes: saved.bytes,
        title: report.title,
        sections: report.sections,
        failed: report.failed
      };
    }
    throw new Error(t2("agent.badAction", { action: String(action) }));
  }
  return { runCommand };
}

// src/client/scene/report.js
function createSceneReport(deps) {
  const sessionRef = { get current() {
    return deps.getSession();
  } };
  const agentOverlayRef = { get current() {
    return deps.getAgentOverlays();
  } };
  const captureScene = deps.captureScene;
  const collectSceneStatus = deps.collectSceneStatus;
  const shaderActiveList = deps.shaderActiveList;
  const formatDistance2 = deps.formatDistance;
  const formatArea2 = deps.formatArea;
  const escapeHtml2 = deps.escapeHtml;
  const arrayBufferToBase642 = deps.arrayBufferToBase64;
  const isChinese2 = deps.isChinese;
  const message2 = deps.message;
  async function buildSceneReport(args = {}) {
    const analysis = deps.getAnalysis();
    const format = args.format === "markdown" ? "markdown" : "html";
    const chinese = isChinese2();
    const L = chinese ? {
      title: "数字地球场景报告",
      generated: "生成时间",
      camera: "相机",
      layers: "图层",
      name: "名称",
      visibility: "可见性",
      imagery: "影像底图",
      terrain: "地形",
      overlays: "Agent 叠加",
      annotatedFeatures: "标注要素",
      measuredPoints: "量测点数",
      measurements: "量测结果",
      analysis: "地形分析",
      shaders: "着色器预设",
      snapshot: "当前画面",
      none: "无",
      visible: "显示",
      hidden: "隐藏",
      distance: "距离",
      area: "面积",
      height: "高差",
      slope: "坡度",
      profile: "剖面",
      relief: "起伏",
      flood: "淹没",
      inundated: "淹没面积",
      sunlight: "日照",
      generatedBy: "由 DSH 数字地球插件生成"
    } : {
      title: "Digital Earth scene report",
      generated: "Generated",
      camera: "Camera",
      layers: "Layers",
      name: "Name",
      visibility: "Visibility",
      imagery: "Imagery",
      terrain: "Terrain",
      overlays: "Agent overlays",
      annotatedFeatures: "Annotated features",
      measuredPoints: "Measured points",
      measurements: "Measurements",
      analysis: "Terrain analysis",
      shaders: "Shader presets",
      snapshot: "Current view",
      none: "none",
      visible: "visible",
      hidden: "hidden",
      distance: "Distance",
      area: "Area",
      height: "Height difference",
      slope: "slope",
      profile: "Profile",
      relief: "relief",
      flood: "Flood",
      inundated: "inundated",
      sunlight: "Sunlight",
      generatedBy: "Generated by the DSH Digital Earth plugin"
    };
    const title = typeof args.title === "string" && args.title.trim() !== "" ? args.title.trim().slice(0, 120) : L.title;
    const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const sections = [];
    const failed = [];
    let capture = null;
    if (args.include_capture !== false) {
      try {
        const saved = await captureScene({}, sessionRef.current);
        capture = {
          path: typeof saved.path === "string" ? saved.path : "",
          width: saved.width,
          height: saved.height,
          mime: "image/jpeg",
          base64: ""
        };
        if (typeof saved.url === "string" && saved.url !== "") {
          try {
            const response = await fetch(saved.url, { credentials: "same-origin" });
            if (response.ok) {
              const blob = await response.blob();
              capture.mime = blob.type || "image/jpeg";
              capture.base64 = arrayBufferToBase642(await blob.arrayBuffer());
            }
          } catch {
          }
        }
        if (capture.path !== "") sections.push("snapshot");
      } catch (error) {
        failed.push(`snapshot: ${message2(error)}`);
      }
    }
    const status = await collectSceneStatus().catch(() => null);
    const view = status?.view ?? null;
    const layers = Array.isArray(status?.layers) ? status.layers : [];
    const annotations = status?.annotations ?? {};
    const measurements = agentOverlayRef.current.measureCommands.map((command) => command?.result).filter((result) => result !== null && typeof result === "object").map((result) => {
      if (result.mode === "distance") return `${L.distance}: ${formatDistance2(result.distance_m)}`;
      if (result.mode === "area") return `${L.area}: ${formatArea2(result.area_m2)}`;
      if (result.mode === "height") {
        return `${L.height}: ${result.height_m} m (${formatDistance2(result.horizontal_m)} ${L.slope} ${result.slope_deg}°)`;
      }
      return "";
    }).filter((line) => line !== "");
    if (measurements.length > 0) sections.push("measurements");
    let analysisText = "";
    if (analysis !== null && analysis.result) {
      const result = analysis.result;
      if (result.operation === "profile") {
        analysisText = `${L.profile}: ${formatDistance2(result.length_m)}, ${L.relief} ${result.stats?.relief_m} m`;
      } else if (result.operation === "flood") {
        analysisText = `${L.flood}: ${formatDistance2(result.water_height)} water, ${L.inundated} ${result.inundated_km2} km² (${result.inundated_ratio})`;
      } else if (result.operation === "sunlight") {
        analysisText = `${L.sunlight}: ${result.datetime}, altitude ${result.sun?.altitude_deg}°, azimuth ${result.sun?.azimuth_deg}°`;
      }
    }
    if (analysisText !== "") sections.push("analysis");
    const shaders = shaderActiveList();
    if (shaders.length > 0) sections.push("shaders");
    sections.unshift("camera", "layers");
    if (status !== null) sections.splice(2, 0, "basemap & terrain");
    const cameraLine = view !== null ? `lon ${view.lon}, lat ${view.lat}, height ${view.height} m, heading ${view.heading}°, pitch ${view.pitch}°` : L.none;
    const layerRows = layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible === false ? L.hidden : L.visible
    }));
    const environment = `${L.imagery}: ${status?.imagery?.name ?? L.none}; ${L.terrain}: ${status?.terrain?.name ?? L.none}`;
    const overlayLine = `${L.annotatedFeatures}: ${annotations.drawn_features ?? 0}; ${L.measuredPoints}: ${annotations.measured_points ?? 0}`;
    const shaderLines = shaders.map((item) => `${item.layer} — ${item.preset}`);
    let content = "";
    if (format === "markdown") {
      const lines = [`# ${title}`, "", `${L.generated}: ${generatedAt}`, "", `## ${L.camera}`, "", `- ${cameraLine}`, ""];
      lines.push(`## ${L.layers}`, "");
      if (layerRows.length === 0) lines.push(`- ${L.none}`);
      else {
        lines.push(`| ${L.name} | ${L.visibility} |`, "| --- | --- |");
        for (const row of layerRows) lines.push(`| ${row.name} | ${row.visible} |`);
      }
      lines.push("", `## ${L.imagery} / ${L.terrain}`, "", `- ${environment}`, "", `## ${L.overlays}`, "", `- ${overlayLine}`, "");
      if (measurements.length > 0) lines.push(`## ${L.measurements}`, "", ...measurements.map((line) => `- ${line}`), "");
      if (analysisText !== "") lines.push(`## ${L.analysis}`, "", `- ${analysisText}`, "");
      if (shaderLines.length > 0) lines.push(`## ${L.shaders}`, "", ...shaderLines.map((line) => `- ${line}`), "");
      if (capture !== null && capture.path !== "") lines.push(`## ${L.snapshot}`, "", `![${L.snapshot}](${capture.path})`, "");
      lines.push("---", L.generatedBy);
      content = lines.join("\n");
    } else {
      const table = layerRows.length === 0 ? `<p>${escapeHtml2(L.none)}</p>` : `<table><thead><tr><th>${escapeHtml2(L.name)}</th><th>${escapeHtml2(L.visibility)}</th></tr></thead><tbody>${layerRows.map((row) => `<tr><td>${escapeHtml2(row.name)}</td><td>${escapeHtml2(row.visible)}</td></tr>`).join("")}</tbody></table>`;
      const image = capture !== null && capture.base64 !== "" ? `<img alt="${escapeHtml2(L.snapshot)}" src="data:${escapeHtml2(capture.mime)};base64,${capture.base64}">` : capture !== null && capture.path !== "" ? `<p>${escapeHtml2(capture.path)}</p>` : "";
      const list = (items) => items.map((item) => `<li>${escapeHtml2(item)}</li>`).join("");
      content = `<!doctype html>
<html lang="${chinese ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml2(title)}</title>
<style>
body{margin:0;padding:32px;background:#f5f7fa;color:#1b1f24;font:14px/1.65 -apple-system,"Segoe UI","PingFang SC",sans-serif}
main{max-width:900px;margin:0 auto;background:#fff;padding:32px 36px;border-radius:14px;box-shadow:0 8px 32px rgba(20,30,50,.08)}
h1{margin:0 0 4px;font-size:24px}
h2{margin:28px 0 10px;font-size:16px;border-bottom:1px solid #e6eaf0;padding-bottom:6px}
.meta{color:#6b7280;font-size:12px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #e6eaf0;padding:7px 10px;text-align:left}
th{background:#f8fafc}
ul{margin:0;padding-left:20px}
img{max-width:100%;border-radius:10px;border:1px solid #e6eaf0}
footer{margin-top:32px;color:#9aa1ab;font-size:12px}
</style>
</head>
<body><main>
<h1>${escapeHtml2(title)}</h1>
<p class="meta">${escapeHtml2(L.generated)}: ${escapeHtml2(generatedAt)}</p>
<h2>${escapeHtml2(L.camera)}</h2><p>${escapeHtml2(cameraLine)}</p>
<h2>${escapeHtml2(L.layers)}</h2>${table}
<h2>${escapeHtml2(L.imagery)} / ${escapeHtml2(L.terrain)}</h2><p>${escapeHtml2(environment)}</p>
<h2>${escapeHtml2(L.overlays)}</h2><p>${escapeHtml2(overlayLine)}</p>
${measurements.length > 0 ? `<h2>${escapeHtml2(L.measurements)}</h2><ul>${list(measurements)}</ul>` : ""}
${analysisText !== "" ? `<h2>${escapeHtml2(L.analysis)}</h2><p>${escapeHtml2(analysisText)}</p>` : ""}
${shaderLines.length > 0 ? `<h2>${escapeHtml2(L.shaders)}</h2><ul>${list(shaderLines)}</ul>` : ""}
${image !== "" ? `<h2>${escapeHtml2(L.snapshot)}</h2>${image}` : ""}
<footer>${escapeHtml2(L.generatedBy)}</footer>
</main></body></html>`;
    }
    return { format, title, content, label: "scene", sections, failed };
  }
  return { buildSceneReport };
}

// src/client/scene/status.js
function createSceneStatus(deps) {
  const cesiumRef = { get current() {
    return deps.getCesium();
  } };
  const viewerRef = { get current() {
    return deps.getViewer();
  } };
  const sourcesRef = { get current() {
    return deps.getSources();
  } };
  const layersRef = { get current() {
    return deps.getLayers();
  } };
  const overlayLayersRef = { get current() {
    return deps.getOverlayLayers();
  } };
  const agentOverlayRef = { get current() {
    return deps.getAgentOverlays();
  } };
  const toolRef = { get current() {
    return deps.getToolMode();
  } };
  const t2 = deps.t;
  const redactUrl2 = deps.redactUrl;
  const normalizeQuality2 = deps.normalizeQuality;
  async function collectSceneStatus() {
    const fps = deps.getFps();
    const busy = deps.getBusy();
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) throw new Error(t2("agent.notReady"));
    const carto = viewer.camera.positionCartographic;
    const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} };
    const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null;
    const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null;
    const round = (value) => Math.round(value * 1e6) / 1e6;
    return {
      ready: true,
      view: {
        lon: round(Cesium.Math.toDegrees(carto.longitude)),
        lat: round(Cesium.Math.toDegrees(carto.latitude)),
        height: Math.round(carto.height),
        heading: Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0)),
        pitch: Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0))
      },
      layers: layersRef.current.map((layer) => {
        const statistics = layer.tileset.statistics ?? {};
        return {
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          url: redactUrl2(layer.url),
          tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded ?? 0,
          pending: statistics.numberOfPendingRequests ?? 0,
          triangles: statistics.numberOfTrianglesSelected ?? 0
        };
      }),
      imagery: imagery ? { id: imagery.id, name: imagery.name } : null,
      terrain: terrain ? { id: terrain.id, name: terrain.name } : null,
      sources: {
        imagery: config.imagery.map((item) => ({ id: item.id, name: item.name })),
        terrain: config.terrain.map((item) => ({ id: item.id, name: item.name }))
      },
      viewport: { width: viewer.canvas.width, height: viewer.canvas.height },
      // L3 raster overlays above the basemap, in stack order (additive field).
      raster_overlays: overlayLayersRef.current?.list() ?? [],
      // Render health is additive: `fps` is null while the scene is idle (no
      // render pass for 2 s) and the terrain depth-test flag is the user's
      // current choice, so an Agent can explain a "model looks flat/buried"
      // report instead of guessing.
      render: {
        fps: fps === null ? null : Math.round(fps),
        idle: fps === null,
        terrain_depth_test: viewer.scene.globe.depthTestAgainstTerrain === true,
        // Quality tier + the effective scale, so "why is it blurry / slow"
        // has an answer in the scene state instead of a guess.
        quality: normalizeQuality2(config.settings.quality),
        resolution_scale: viewer.resolutionScale,
        globe_maximum_screen_space_error: viewer.scene.globe.maximumScreenSpaceError
      },
      snapshot: { includeHud: config.settings.screenshotHud === true },
      measureTool: toolRef.current,
      annotations: {
        drawn_features: agentOverlayRef.current.drawnFeatures,
        measured_points: agentOverlayRef.current.measuredCount,
        overlays: agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length
      },
      busy: busy || ""
    };
  }
  return { collectSceneStatus };
}

// src/client/scene/host-scene-store.js
function createHostSceneStore({
  getMeta,
  loadMeta: loadMeta2,
  normalizeSceneSnapshot: normalizeSceneSnapshot2,
  readSceneSnapshot: readSceneSnapshot2,
  writeSceneSnapshot: writeSceneSnapshot2,
  hostTimeoutMs = 3e3,
  saveIntervalMs = 1e4,
  maxBodyLength = 512 * 1024
}) {
  const metaRef = {
    get current() {
      return getMeta();
    }
  };
  const HOST_SCENE_TIMEOUT_MS = hostTimeoutMs;
  const lastHostSceneSaveRef = { current: 0 };
  async function readHostSceneSnapshot(session) {
    const meta = metaRef.current ?? await loadMeta2().catch(() => null);
    if (!meta?.sceneUrl) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HOST_SCENE_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${meta.sceneUrl}?token=${encodeURIComponent(meta.token)}&session=${encodeURIComponent(session)}`,
        { credentials: "same-origin", signal: controller.signal }
      );
      if (!response.ok) return null;
      const data = await response.json();
      return normalizeSceneSnapshot2(data?.snapshot);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  function saveHostSceneSnapshot(session, body, force = false) {
    const meta = metaRef.current;
    if (!meta?.sceneUrl) return;
    const now = Date.now();
    if (!force && now - lastHostSceneSaveRef.current < saveIntervalMs) return;
    lastHostSceneSaveRef.current = now;
    let text = "";
    try {
      text = JSON.stringify({ session, snapshot: body });
    } catch {
      return;
    }
    if (text.length > maxBodyLength) return;
    try {
      void fetch(meta.sceneUrl, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: text,
        keepalive: true
      }).catch(() => {
      });
    } catch {
    }
  }
  async function loadSceneSnapshot(session) {
    const hostSnapshot = await readHostSceneSnapshot(session);
    if (hostSnapshot !== null) {
      try {
        writeSceneSnapshot2(session, hostSnapshot);
      } catch {
      }
      return hostSnapshot;
    }
    return readSceneSnapshot2(session);
  }
  return { readHostSceneSnapshot, saveHostSceneSnapshot, loadSceneSnapshot };
}

// src/client/scene/quality.js
var QUALITY_MODES = ["balanced", "high"];
var DEFAULT_QUALITY = "balanced";
var PROFILES = {
  /**
   * Balanced (default): ~28 % fewer pixels, coarser terrain/photogrammetry LOD.
   * The visual difference is mostly at silhouettes; motion stays smooth.
   */
  balanced: {
    resolutionScale: 0.85,
    msaaSamples: 2,
    globeMaximumScreenSpaceError: 3,
    globeTileCacheSize: 200,
    tilesetMaximumScreenSpaceError: 20
  },
  /** High: full resolution at the Cesium defaults, for screenshots and reviews. */
  high: {
    resolutionScale: 1,
    msaaSamples: 4,
    globeMaximumScreenSpaceError: 2,
    globeTileCacheSize: 100,
    tilesetMaximumScreenSpaceError: 16
  }
};
function normalizeQuality(value) {
  return QUALITY_MODES.includes(value) ? value : DEFAULT_QUALITY;
}
function qualityProfile(value) {
  return { ...PROFILES[normalizeQuality(value)] };
}
function applyQuality(viewer, value, tilesets = []) {
  if (!viewer) return qualityProfile(value);
  const profile = qualityProfile(value);
  viewer.resolutionScale = profile.resolutionScale;
  const globe = viewer.scene?.globe;
  if (globe) {
    globe.maximumScreenSpaceError = profile.globeMaximumScreenSpaceError;
    globe.tileCacheSize = profile.globeTileCacheSize;
  }
  for (const tileset of tilesets) {
    if (tileset) tileset.maximumScreenSpaceError = profile.tilesetMaximumScreenSpaceError;
  }
  return profile;
}

// src/client/shader/presets.js
var SHADER_PRESETS = ["height-false-color", "contour", "scan", "water", "water-depth"];
var SHADER_MAX_STACK = 3;
var SHADER_SOURCE_LIMIT = 8 * 1024;
var SHADER_HEIGHT_FLOOR = -1e3;
var SHADER_HEIGHT_CEILING = 9e3;
var SHADER_PARAM_LIMITS = {
  min_height: [-1e3, 9e3],
  max_height: [-1e3, 9e3],
  interval: [1, 500],
  speed: [0.1, 10],
  amplitude: [0.1, 5],
  opacity: [0.05, 1],
  water_height: [-1e3, 9e3],
  depth_max: [0.5, 500]
};
var SHADER_PRESET_PARAMS = {
  "height-false-color": ["min_height", "max_height"],
  contour: ["interval"],
  scan: ["speed"],
  water: ["speed", "amplitude", "opacity"],
  "water-depth": ["water_height", "depth_max"]
};
var SHADER_PRESET_DEFAULTS = {
  "height-false-color": {},
  contour: { interval: 20 },
  scan: { speed: 1 },
  water: { speed: 1, amplitude: 1, opacity: 0.75 },
  "water-depth": { water_height: 0, depth_max: 50 }
};
var shaderClamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
var shaderFinite = (value) => typeof value === "number" && Number.isFinite(value);
var shaderFail = (message2, next) => new Error(`shader: ${message2} next: ${next}`);
function shaderValidateRequest(args = {}) {
  const raw = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const action = typeof raw.action === "string" ? raw.action.trim() : "";
  if (action !== "apply" && action !== "reset" && action !== "list") {
    return shaderFail(`不支持的操作 "${String(raw.action)}"。`, "使用 apply / reset / list。");
  }
  if (raw.layer !== void 0 && raw.layer !== null && typeof raw.layer !== "string") {
    return shaderFail("layer 必须是图层名或 id 字符串。", "传入字符串后重试。");
  }
  const layer = typeof raw.layer === "string" && raw.layer.trim() !== "" ? raw.layer.trim() : null;
  const keys = Object.keys(raw).filter((key) => key !== "action");
  if (action === "list") {
    if (keys.length > 0) return shaderFail(`list 不接受参数 "${keys[0]}"。`, '只传 action: "list"。');
    return { operation: "list" };
  }
  if (action === "reset") {
    const extra2 = keys.filter((key) => key !== "layer");
    if (extra2.length > 0) return shaderFail(`reset 不接受参数 "${extra2[0]}"。`, "reset 只接受 action 与可选的 layer。");
    return { operation: "reset", layer };
  }
  const rawPresets = Array.isArray(raw.preset) ? raw.preset : typeof raw.preset === "string" ? [raw.preset] : [];
  const presets = rawPresets.map((item) => typeof item === "string" ? item.trim() : "");
  if (presets.length === 0 || presets.length > SHADER_MAX_STACK) {
    return shaderFail(
      `preset 需要 1..${SHADER_MAX_STACK} 个预设，实际 ${presets.length} 个。`,
      "传入一个预设字符串，或 1..3 个预设的数组（按顺序叠加）。"
    );
  }
  for (const preset of presets) {
    if (!SHADER_PRESETS.includes(preset)) {
      return shaderFail(
        `不支持的预设 "${String(preset)}"。`,
        "使用 height-false-color / contour / scan / water / water-depth。"
      );
    }
  }
  if (new Set(presets).size !== presets.length) {
    return shaderFail("预设不能重复。", "每个预设只列一次；顺序即叠加顺序。");
  }
  const allowedParams = new Set(presets.flatMap((preset) => SHADER_PRESET_PARAMS[preset]));
  const allowed = /* @__PURE__ */ new Set(["preset", "layer", ...allowedParams]);
  const extra = keys.filter((key) => !allowed.has(key));
  if (extra.length > 0) {
    return shaderFail(
      `预设 ${presets.join(" + ")} 不接受参数 "${extra[0]}"。`,
      `只使用 ${["preset", "layer", ...allowedParams].join(", ")}。`
    );
  }
  const params = {};
  for (const preset of presets) Object.assign(params, SHADER_PRESET_DEFAULTS[preset]);
  for (const key of allowedParams) {
    const value = raw[key];
    if (value === void 0 || value === null) continue;
    if (!shaderFinite(value)) return shaderFail(`参数 ${key} 必须是有限数字。`, "传入数字后重试。");
    const [minimum, maximum] = SHADER_PARAM_LIMITS[key];
    if (value < minimum || value > maximum) {
      return shaderFail(`参数 ${key}=${value} 超出 ${minimum}..${maximum}。`, "调整到合法范围后重试。");
    }
    params[key] = value;
  }
  if (presets.includes("height-false-color") && params.min_height !== void 0 && params.max_height !== void 0 && !(params.min_height < params.max_height)) {
    return shaderFail("min_height 必须小于 max_height。", "调整两个高度后重试。");
  }
  return {
    operation: "apply",
    preset: presets.length === 1 ? presets[0] : presets,
    presets,
    layer,
    params
  };
}
function samePresetStack(left, right) {
  const a = Array.isArray(left) ? left : left === null || left === void 0 ? [] : [left];
  const b = Array.isArray(right) ? right : right === null || right === void 0 ? [] : [right];
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
}
function shaderTilesetExtensions(tileset) {
  const lists = [tileset?.extensionsUsed, tileset?._extensionsUsed, tileset?.root?.extensionsUsed];
  const values = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string" && !values.includes(item)) values.push(item);
    }
  }
  return values;
}
function shaderGaussianLayer(tileset) {
  if (shaderTilesetExtensions(tileset).includes("KHR_gaussian_splatting")) return true;
  if (typeof tileset?.hasExtension === "function") {
    try {
      return tileset.hasExtension("KHR_gaussian_splatting") === true;
    } catch {
      return false;
    }
  }
  return false;
}
function shaderTilesetExtent(Cesium, tileset) {
  const root = tileset?.root;
  const volume = root?.boundingVolume;
  if (!volume) return null;
  if (shaderFinite(volume.minimumHeight) && shaderFinite(volume.maximumHeight) && volume.maximumHeight > volume.minimumHeight) {
    return { minimum: volume.minimumHeight, maximum: volume.maximumHeight };
  }
  const obb = volume.obb ?? root?._boundingVolume?.obb;
  if (obb?.center && obb?.halfAxes && typeof Cesium?.Matrix3?.getColumn === "function") {
    try {
      const up = Cesium.Cartesian3.normalize(Cesium.Cartesian3.clone(obb.center), new Cesium.Cartesian3());
      const column = new Cesium.Cartesian3();
      let support = 0;
      for (let index = 0; index < 3; index += 1) {
        Cesium.Matrix3.getColumn(obb.halfAxes, index, column);
        support += Math.abs(Cesium.Cartesian3.dot(column, up));
      }
      const centerHeight = Cesium.Cartographic.fromCartesian(obb.center)?.height;
      if (shaderFinite(centerHeight) && support > 0.5) {
        return { minimum: centerHeight - support, maximum: centerHeight + support };
      }
    } catch {
    }
  }
  return null;
}
function shaderHeightRange(Cesium, tileset, fallbackCenter) {
  let center = tileset?.boundingSphere?.center ?? tileset?.root?.boundingSphere?.center ?? fallbackCenter ?? null;
  if (!center) center = Cesium.Cartesian3.fromDegrees(0, 0, 0);
  let centerHeight = 0;
  try {
    const carto = Cesium.Cartographic.fromCartesian(center);
    if (carto && shaderFinite(carto.height)) centerHeight = carto.height;
  } catch {
    centerHeight = 0;
  }
  const extent = shaderTilesetExtent(Cesium, tileset);
  if (extent) {
    const minimum2 = shaderClamp(extent.minimum, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING);
    const maximum2 = shaderClamp(extent.maximum, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING);
    if (maximum2 > minimum2) return { center, centerHeight, minimum: minimum2, maximum: maximum2, estimated: true, bounds: true };
  }
  const rawRadius = Number(tileset?.boundingSphere?.radius ?? tileset?.root?.boundingSphere?.radius);
  const radius = shaderFinite(rawRadius) ? Math.abs(rawRadius) : 0;
  let minimum = 0;
  let maximum = 0;
  if (radius > 0) {
    minimum = shaderClamp(centerHeight - radius, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING);
    maximum = shaderClamp(centerHeight + radius, SHADER_HEIGHT_FLOOR, SHADER_HEIGHT_CEILING);
  }
  if (!(maximum > minimum)) {
    minimum = 0;
    maximum = 200;
  }
  return { center, centerHeight, minimum, maximum, estimated: radius > 0 };
}
function shaderUniforms(Cesium, preset, params, range) {
  const presets = Array.isArray(preset) ? preset : [preset];
  const uniforms = {
    u_center: { type: Cesium.UniformType.VEC3, value: range.center },
    u_centerHeight: { type: Cesium.UniformType.FLOAT, value: range.centerHeight }
  };
  if (presets.includes("height-false-color") || presets.includes("scan")) {
    uniforms.u_minHeight = { type: Cesium.UniformType.FLOAT, value: range.minimum };
    uniforms.u_maxHeight = { type: Cesium.UniformType.FLOAT, value: range.maximum };
  }
  if (presets.includes("contour")) {
    uniforms.u_interval = { type: Cesium.UniformType.FLOAT, value: params.interval ?? 20 };
  }
  if (presets.includes("scan") || presets.includes("water")) {
    uniforms.u_speed = { type: Cesium.UniformType.FLOAT, value: params.speed ?? 1 };
    uniforms.u_time = { type: Cesium.UniformType.FLOAT, value: 0 };
  }
  if (presets.includes("water")) {
    uniforms.u_amplitude = { type: Cesium.UniformType.FLOAT, value: params.amplitude ?? 1 };
    uniforms.u_opacity = { type: Cesium.UniformType.FLOAT, value: params.opacity ?? 0.75 };
  }
  if (presets.includes("water-depth")) {
    uniforms.u_waterHeight = { type: Cesium.UniformType.FLOAT, value: params.water_height ?? 0 };
    uniforms.u_depthMax = { type: Cesium.UniformType.FLOAT, value: params.depth_max ?? 50 };
  }
  return uniforms;
}
function shaderFragmentSource(preset) {
  const presets = Array.isArray(preset) ? preset : [preset];
  const original = (item) => {
    const source = SHADER_FRAGMENT_SOURCES[item];
    if (typeof source !== "string" || source.length === 0 || source.length > SHADER_SOURCE_LIMIT) {
      throw shaderFail(`预设 ${String(item)} 的着色器源码无效。`, "联系面板维护者检查预设定义。");
    }
    return source;
  };
  if (presets.length === 1) return original(presets[0]);
  const blocks = presets.map((item) => {
    const source = original(item);
    const match = /void fragmentMain\(FragmentInput fsInput, inout czm_modelMaterial material\) \{([\s\S]*)\}\s*$/.exec(source);
    if (!match) {
      throw shaderFail(`预设 ${item} 的着色器结构无效。`, "联系面板维护者检查预设定义。");
    }
    return `  // ${item}
  {${match[1]}}`;
  });
  const composed = `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
${blocks.join("\n")}
}`;
  if (composed.length > SHADER_SOURCE_LIMIT) {
    throw shaderFail(`叠加后的着色器源码超过 ${SHADER_SOURCE_LIMIT} 字节。`, "减少叠加的预设数量。");
  }
  return composed;
}
var SHADER_FRAGMENT_SOURCES = {
  "height-false-color": `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float span = max(u_maxHeight - u_minHeight, 1.0);
  float t = clamp((height - u_minHeight) / span, 0.0, 1.0);
  // Deep indigo -> cyan -> mint -> amber -> coral: a modern elevation ramp that
  // stays legible on both dark and light imagery.
  vec3 c0 = vec3(0.09, 0.14, 0.40);
  vec3 c1 = vec3(0.08, 0.49, 0.70);
  vec3 c2 = vec3(0.24, 0.80, 0.60);
  vec3 c3 = vec3(0.99, 0.79, 0.32);
  vec3 c4 = vec3(0.94, 0.36, 0.30);
  vec3 ramp = t < 0.25
    ? mix(c0, c1, t / 0.25)
    : t < 0.5
      ? mix(c1, c2, (t - 0.25) / 0.25)
      : t < 0.75
        ? mix(c2, c3, (t - 0.5) / 0.25)
        : mix(c3, c4, (t - 0.75) / 0.25);
  // Photogrammetry textures already bake in roof/wall shading; reusing their
  // luminance keeps the volume that a flat colour would erase.
  float lum = clamp(dot(material.diffuse, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  ramp *= 0.74 + 0.52 * lum;
  // Faint topographic bands: readable as elevation without looking like a poster.
  float shade = abs(fract(t * 8.0) - 0.5) * 2.0;
  ramp *= 0.95 + 0.05 * shade;
  material.diffuse = mix(material.diffuse, ramp, 0.72);
}`,
  contour: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float spacing = max(u_interval, 1.0);
  float band = fract(height / spacing);
  float edge = min(band, 1.0 - band);
  // Two line weights: a crisp 1x grid plus a brighter 5x "major" contour.
  float minor = 1.0 - smoothstep(0.0, 0.050, edge);
  float majorBand = fract(height / (spacing * 5.0));
  float majorEdge = min(majorBand, 1.0 - majorBand);
  float major = 1.0 - smoothstep(0.0, 0.022, majorEdge);
  // Cool instrument tint instead of a yellow wash; imagery detail stays visible.
  float tint = 0.5 + 0.5 * sin(height * 0.0026);
  vec3 base = mix(vec3(0.07, 0.15, 0.26), vec3(0.13, 0.30, 0.40), tint);
  vec3 lineColor = mix(vec3(0.62, 0.86, 1.0), vec3(0.97, 1.0, 1.0), major);
  material.diffuse = mix(material.diffuse, base, 0.22);
  material.diffuse = mix(material.diffuse, lineColor, clamp(minor * 0.5 + major * 0.5, 0.0, 1.0));
}`,
  scan: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float span = max(u_maxHeight - u_minHeight, 1.0);
  float t = clamp((height - u_minHeight) / span, 0.0, 1.0);
  float sweep = fract(u_time * max(u_speed, 0.1) * 0.09);
  float distanceToBand = abs(t - sweep);
  // A soft wide glow with a thin bright core reads as a live instrument sweep;
  // the rest of the surface is only slightly dimmed so context stays visible.
  float glow = exp(-distanceToBand * 22.0);
  float core = 1.0 - smoothstep(0.0, 0.012, distanceToBand);
  vec3 scanTint = mix(vec3(0.12, 0.62, 0.86), vec3(0.72, 1.0, 0.94), glow);
  material.diffuse *= 0.88;
  material.diffuse = mix(material.diffuse, scanTint, clamp(glow * 0.8 + core * 0.2, 0.0, 1.0));
}`,
  water: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  // World-space waves keep ripples moving across the surface instead of sliding
  // up and down with altitude (the old height-only sine looked like stripes).
  vec3 world = fsInput.attributes.positionWC;
  float speed = max(u_speed, 0.1) * 1.15;
  float w1 = sin(world.x * 0.055 + world.z * 0.021 + u_time * speed);
  float w2 = sin(world.y * 0.043 - world.z * 0.031 - u_time * speed * 1.35);
  float w3 = sin((world.x + world.y) * 0.028 + u_time * speed * 0.72);
  float ripple = clamp(0.5 + (w1 * 0.5 + w2 * 0.32 + w3 * 0.18) * u_amplitude * 0.6, 0.0, 1.0);
  vec3 deep = vec3(0.02, 0.09, 0.22);
  vec3 shallow = vec3(0.09, 0.42, 0.60);
  vec3 crest = vec3(0.62, 0.97, 1.0);
  vec3 waterColor = mix(deep, shallow, ripple);
  float sparkle = pow(ripple, 7.0);
  waterColor = mix(waterColor, crest, sparkle * 0.55);
  material.diffuse = mix(material.diffuse, waterColor, u_opacity * 0.85);
  material.alpha = mix(material.alpha, 0.94, u_opacity * 0.55);
}`,
  // D-17: colour geometry by how deep it sits below a chosen water plane; the
  // depth ramp is fixed (never user-supplied color) so the whitelist stays intact.
  "water-depth": `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float depth = u_waterHeight - height;
  float t = clamp(depth / max(u_depthMax, 0.5), 0.0, 1.0);
  float submerged = smoothstep(-0.8, 0.8, depth);
  vec3 shallow = vec3(0.46, 0.94, 0.93);
  vec3 mid = vec3(0.10, 0.52, 0.72);
  vec3 deep = vec3(0.02, 0.07, 0.22);
  vec3 ramp = t < 0.5 ? mix(shallow, mid, t / 0.5) : mix(mid, deep, (t - 0.5) / 0.5);
  // Faint depth bands every 20% of the ramp plus a brighter shoreline edge.
  float bands = abs(fract(t * 5.0) - 0.5) * 2.0;
  ramp *= 0.93 + 0.07 * bands;
  float shore = 1.0 - smoothstep(0.0, 0.035, abs(depth) / max(u_depthMax, 0.5));
  ramp = mix(ramp, vec3(0.86, 1.0, 1.0), shore * 0.5);
  material.diffuse = mix(material.diffuse, ramp, submerged * 0.86);
  material.alpha = mix(material.alpha, 1.0, submerged * 0.35);
}`
};

// src/client/scene/shader-engine.js
function createShaderEngine(deps) {
  const cesiumRef = { get current() {
    return deps.getCesium();
  } };
  const viewerRef = { get current() {
    return deps.getViewer();
  } };
  const layersRef = { get current() {
    return deps.getLayers();
  } };
  const findLayer = deps.findLayer;
  const shaderEntriesRef = deps.entries;
  const shaderTickRef = deps.tickRef;
  const setShaderActive = deps.setShaderActive;
  const comparisons = /* @__PURE__ */ new Map();
  const shaderResult = (operation, preset, layer) => ({
    operation,
    preset: preset ?? null,
    layer: layer ?? null,
    // D-18 additive: the ordered stack (one entry for a single preset).
    stack: Array.isArray(preset) ? preset.slice() : preset ? [preset] : [],
    active: shaderActiveList(),
    presets: SHADER_PRESETS.slice()
  });
  const shaderActiveList = () => {
    const order = new Map(layersRef.current.map((layer, index) => [layer.id, index]));
    return [...shaderEntriesRef.current.values()].sort((left, right) => (order.get(left.layer.id) ?? 0) - (order.get(right.layer.id) ?? 0)).map((entry) => ({ layer: entry.layerName, layerId: entry.layer.id, preset: entry.preset, params: { ...entry.params } }));
  };
  const refreshShaderActive = () => setShaderActive(shaderActiveList());
  function ensureShaderTick() {
    const viewer = viewerRef.current;
    if (!viewer || shaderTickRef.current) return;
    const tick = () => {
      const seconds = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1e3;
      for (const entry of shaderEntriesRef.current.values()) {
        const shader = entry.shader;
        if (!shader || !shader.uniforms || !("u_time" in shader.uniforms)) continue;
        try {
          shader.setUniform("u_time", seconds);
        } catch {
        }
      }
    };
    try {
      viewer.scene.preRender.addEventListener(tick);
      shaderTickRef.current = { viewer, tick };
    } catch {
      shaderTickRef.current = null;
    }
  }
  function releaseShaderTick() {
    const handle = shaderTickRef.current;
    shaderTickRef.current = null;
    if (!handle) return;
    try {
      handle.viewer.scene.preRender.removeEventListener(handle.tick);
    } catch {
    }
  }
  function finishCompare(layerId) {
    if (!comparisons.has(layerId)) return false;
    comparisons.delete(layerId);
    const entry = shaderEntriesRef.current.get(layerId);
    if (entry && entry.layer && entry.layer.tileset) {
      try {
        entry.layer.tileset.customShader = entry.shader;
      } catch {
      }
    }
    return true;
  }
  function restoreShaderEntry(entry) {
    try {
      entry.layer.tileset.customShader = entry.previous ?? void 0;
      return null;
    } catch (error) {
      return error;
    }
  }
  function detachShaderForLayer(id, restore) {
    const entries = shaderEntriesRef.current;
    const entry = entries.get(id);
    if (!entry) return false;
    entries.delete(id);
    finishCompare(id);
    if (restore) restoreShaderEntry(entry);
    refreshShaderActive();
    if (entries.size === 0) releaseShaderTick();
    return true;
  }
  function resolveShaderLayer(token) {
    if (token) {
      const layer = findLayer(token);
      if (!layer) {
        throw shaderFail(`未找到图层 "${token}"。`, "用 earth_scene 的 list 动作查看当前图层名。");
      }
      return layer;
    }
    let gaussianOnly = false;
    for (let index = layersRef.current.length - 1; index >= 0; index -= 1) {
      const layer = layersRef.current[index];
      if (!layer.visible) continue;
      if (shaderGaussianLayer(layer.tileset)) {
        gaussianOnly = true;
        continue;
      }
      return layer;
    }
    if (gaussianOnly) {
      throw shaderFail(
        "当前视图没有可用的 3D Tiles 图层（可见图层均为 3DGS）。",
        "加载或显示普通 3D Tiles 图层后重试。"
      );
    }
    throw shaderFail("当前视图没有可见的 3D Tiles 图层。", "先加载或显示 3D Tiles 图层后重试。");
  }
  function applyShader(request) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) throw shaderFail("三维引擎尚未就绪。", "打开数字地球面板后重试。");
    if (typeof Cesium.CustomShader !== "function") {
      throw shaderFail("当前 Cesium 不支持 CustomShader。", "升级 Cesium 版本或换用其他可视化方式。");
    }
    const layer = resolveShaderLayer(request.layer);
    if (shaderGaussianLayer(layer.tileset)) {
      throw new Error("shader: 3DGS 图层不支持该预设。next: 换 3D Tiles 图层。");
    }
    finishCompare(layer.id);
    const range = shaderHeightRange(Cesium, layer.tileset, null);
    if (request.params.min_height !== void 0) range.minimum = request.params.min_height;
    if (request.params.max_height !== void 0) range.maximum = request.params.max_height;
    if (!(range.maximum > range.minimum)) {
      throw shaderFail(`高程范围无效（${range.minimum}..${range.maximum}）。`, "传入 min_height < max_height。");
    }
    const existing = shaderEntriesRef.current.get(layer.id);
    if (existing && samePresetStack(existing.preset, request.preset) && typeof existing.shader?.setUniform === "function") {
      const uniforms = shaderUniforms(Cesium, request.presets ?? request.preset, request.params, range);
      try {
        for (const [name, uniform] of Object.entries(uniforms)) existing.shader.setUniform(name, uniform.value);
      } catch (error) {
        throw shaderFail(`更新着色器参数失败（${message(error)}）。`, "换一个预设或重置后重试。");
      }
      existing.params = { ...request.params };
      return shaderResult("apply", request.preset, layer.name);
    }
    const options = {
      uniforms: shaderUniforms(Cesium, request.presets ?? request.preset, request.params, range),
      fragmentShaderText: shaderFragmentSource(request.presets ?? request.preset)
    };
    const stack = Array.isArray(request.presets) ? request.presets : [request.preset];
    if ((stack.includes("water") || stack.includes("water-depth")) && Cesium.CustomShaderTranslucencyMode?.TRANSLUCENT !== void 0) {
      options.translucencyMode = Cesium.CustomShaderTranslucencyMode.TRANSLUCENT;
    }
    let shader = null;
    try {
      shader = new Cesium.CustomShader(options);
    } catch (error) {
      throw shaderFail(`预设着色器构造失败（${message(error)}）。`, "换一个预设或重置后重试。");
    }
    const previous = existing ? existing.previous : layer.tileset.customShader ?? null;
    try {
      layer.tileset.customShader = shader;
      if (layer.tileset.customShader !== shader) throw new Error("图层拒绝了 customShader 赋值");
    } catch (error) {
      let restored = false;
      try {
        if (existing) {
          layer.tileset.customShader = existing.shader ?? void 0;
          restored = layer.tileset.customShader === (existing.shader ?? void 0);
        } else {
          layer.tileset.customShader = previous ?? void 0;
          restored = layer.tileset.customShader === (previous ?? void 0);
        }
      } catch {
        restored = false;
      }
      if (!restored) {
        if (existing) {
          shaderEntriesRef.current.delete(layer.id);
          if (shaderEntriesRef.current.size === 0) releaseShaderTick();
          refreshShaderActive();
        }
        throw shaderFail(
          `预设应用失败（${message(error)}），且原有着色器恢复失败。`,
          "重新加载该图层或刷新面板后重试。"
        );
      }
      throw shaderFail(`预设应用失败（${message(error)}）。`, "换一个预设或重置后重试。");
    }
    shaderEntriesRef.current.set(layer.id, {
      layer,
      layerName: layer.name,
      preset: request.preset,
      params: { ...request.params },
      previous,
      shader
    });
    ensureShaderTick();
    refreshShaderActive();
    return shaderResult("apply", request.preset, layer.name);
  }
  function resetShader(layerToken) {
    const entries = shaderEntriesRef.current;
    let targetLayerName = null;
    let targets = [];
    if (layerToken) {
      const layer = findLayer(layerToken);
      if (!layer) {
        throw shaderFail(`未找到图层 "${layerToken}"。`, "用 earth_scene 的 list 动作查看当前图层名。");
      }
      targetLayerName = layer.name;
      const entry = entries.get(layer.id);
      if (entry) targets = [entry];
    } else {
      targets = [...entries.values()];
    }
    let failure = null;
    for (const entry of targets) {
      finishCompare(entry.layer.id);
      entries.delete(entry.layer.id);
      const error = restoreShaderEntry(entry);
      if (error && !failure) failure = error;
    }
    if (entries.size === 0) releaseShaderTick();
    refreshShaderActive();
    if (failure) {
      throw shaderFail(`恢复原有着色器失败（${message(failure)}）。`, "重试 reset，或换一个预设后重置。");
    }
    return shaderResult("reset", null, targetLayerName);
  }
  function compareShader(layerToken, enabled) {
    const layer = resolveShaderLayer(layerToken);
    const entry = shaderEntriesRef.current.get(layer.id);
    if (enabled) {
      if (!entry) {
        throw shaderFail("当前图层还没有应用着色器，无法对比。", "先应用一个预设，再点「原图对比」。");
      }
      if (!comparisons.has(layer.id)) {
        comparisons.set(layer.id, { original: entry.previous ?? null });
        try {
          layer.tileset.customShader = entry.previous ?? void 0;
        } catch (error) {
          comparisons.delete(layer.id);
          throw shaderFail(`原图对比失败（${message(error)}）。`, "重试，或先重置该图层再对比。");
        }
      }
      return { compared: true, layer: layer.name };
    }
    finishCompare(layer.id);
    return { compared: false, layer: layer.name };
  }
  async function shaderCommand(args = {}) {
    const request = shaderValidateRequest(args);
    if (request instanceof Error) throw request;
    if (request.operation === "list") return shaderResult("list", null, null);
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) throw shaderFail("三维引擎尚未就绪。", "打开数字地球面板后重试。");
    if (request.operation === "reset") return resetShader(request.layer);
    return applyShader(request);
  }
  return {
    /** Bridge entry: apply / reset / list. */
    command: (args = {}) => shaderCommand(args),
    /** Active presets in layer order (workbench, snapshot and report). */
    activeList: () => shaderActiveList(),
    /** Layer removal / teardown: forget the preset and stop the tick when idle. */
    detachForLayer: (id, restore) => detachShaderForLayer(id, restore),
    /** Detach the u_time tick without touching the entries (viewer teardown). */
    releaseTick: () => releaseShaderTick(),
    /** Workbench: temporarily swap to the layer's original look / restore. */
    compare: (layer, enabled) => compareShader(layer, enabled)
  };
}

// src/client/theme.js
var import_react3 = __toESM(require("react"), 1);
var darkFromEnvironment = () => {
  const theme = service("theme");
  const snapshot = theme?.getTheme?.();
  const scheme = snapshot?.active?.colorScheme;
  if (scheme === "dark") return true;
  if (scheme === "light") return false;
  if (typeof document !== "undefined" && document.body) {
    if (document.body.hasAttribute("data-ds-dark-theme")) return true;
    const source = document.documentElement?.dataset?.dsThemeSource;
    if (source === "dark") return true;
    if (source === "light") return false;
  }
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
};
function useEnvironmentDark() {
  const subscribe = import_react3.default.useCallback((callback) => {
    const theme = service("theme");
    const disposers = [];
    if (theme && typeof getAppCtx()?.on === "function") disposers.push(getAppCtx().on("theme/change", callback));
    if (typeof matchMedia === "function") {
      const media = matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", callback);
      disposers.push(() => media.removeEventListener("change", callback));
    }
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, []);
  return import_react3.default.useSyncExternalStore(subscribe, darkFromEnvironment);
}

// src/client/ui/cards.js
var import_react4 = __toESM(require("react"), 1);
var h3 = import_react4.default.createElement;
var analysisMetric = (value, digits = 1) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
function AnalysisProfileChart({ points, t: t2 }) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const width = 260;
  const height = 92;
  const padX = 10;
  const padY = 12;
  const valid = points.filter(
    (point) => point && typeof point.height_m === "number" && Number.isFinite(point.height_m)
  );
  if (valid.length < 2) return null;
  const maxDistance = Math.max(...points.map((point) => Number(point.distance_m) || 0), 1);
  const minimum = Math.min(...valid.map((point) => point.height_m));
  const maximum = Math.max(...valid.map((point) => point.height_m));
  const range = maximum - minimum || 1;
  const x = (distance) => padX + (width - padX * 2) * Math.min(1, Math.max(0, distance / maxDistance));
  const y = (value) => height - padY - (height - padY * 2) * ((value - minimum) / range);
  const segments = [];
  let current = [];
  for (const point of points) {
    const heightValue = point ? point.height_m : null;
    if (typeof heightValue === "number" && Number.isFinite(heightValue)) {
      const distance = Number(point.distance_m) || 0;
      current.push(`${x(distance).toFixed(1)},${y(heightValue).toFixed(1)}`);
    } else if (current.length > 0) {
      segments.push(current.join(" "));
      current = [];
    }
  }
  if (current.length > 0) segments.push(current.join(" "));
  return h3(
    "svg",
    {
      className: "chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": t2("analysis.chart")
    },
    h3("line", {
      x1: padX,
      y1: height - padY,
      x2: width - padX,
      y2: height - padY,
      stroke: "var(--mv-line)"
    }),
    ...segments.map(
      (pointsText, index) => h3("polyline", {
        key: `segment-${index}`,
        points: pointsText,
        fill: "none",
        stroke: "var(--mv-accent)",
        strokeWidth: 1.7,
        strokeLinejoin: "round",
        strokeLinecap: "round"
      })
    ),
    h3("text", { x: padX, y: padY - 3 }, formatHeight(maximum)),
    h3("text", { x: padX, y: height - 2 }, formatHeight(minimum)),
    h3("text", { x: width - padX, y: height - 2, textAnchor: "end" }, formatDistance(maxDistance))
  );
}
function AnalysisCard({ state, t: t2, onClose }) {
  const [open, setOpen] = import_react4.default.useState(true);
  if (!state || !state.result) return null;
  const result = state.result;
  const operation = state.operation;
  const rows = [];
  const row = (key, label, value) => rows.push(h3("div", { key, className: "stat" }, h3("span", null, label), h3("b", null, value)));
  if (operation === "profile") {
    const stats = result.stats ?? {};
    row("length", t2("analysis.length"), formatDistance(result.length_m ?? 0));
    row("min", t2("analysis.minHeight"), formatHeight(stats.min_height ?? 0));
    row("max", t2("analysis.maxHeight"), formatHeight(stats.max_height ?? 0));
    row("relief", t2("analysis.relief"), formatHeight(stats.relief_m ?? 0));
    row("gain", t2("analysis.gain"), formatHeight(stats.gain_m ?? 0));
    row("loss", t2("analysis.loss"), formatHeight(stats.loss_m ?? 0));
    row("samples", t2("analysis.samples"), `${result.samples ?? 0}`);
  } else if (operation === "flood") {
    row("water", t2("analysis.waterHeight"), formatHeight(result.water_height ?? 0));
    row("area", t2("analysis.area"), `${analysisMetric(result.area_km2, 3)} km²`);
    row("inundated", t2("analysis.inundated"), `${analysisMetric(result.inundated_km2, 3)} km²`);
    row("ratio", t2("analysis.inundatedRatio"), `${analysisMetric((result.inundated_ratio ?? 0) * 100, 1)}%`);
    row("depthMax", t2("analysis.depthMax"), formatHeight(result.depth_max_m ?? 0));
    row("depthMean", t2("analysis.depthMean"), formatHeight(result.depth_mean_m ?? 0));
    row(
      "samples",
      t2("analysis.inundatedSamples"),
      `${result.samples_inundated ?? 0} / ${result.samples_with_data ?? 0}`
    );
    const region = result.region ?? {};
    row(
      "region",
      t2("analysis.region"),
      `${analysisMetric(region.west, 2)}, ${analysisMetric(region.south, 2)} – ${analysisMetric(region.east, 2)}, ${analysisMetric(region.north, 2)}`
    );
  } else if (operation === "sunlight") {
    let dateText = String(result.datetime ?? "");
    try {
      dateText = new Date(result.datetime).toLocaleString();
    } catch {
    }
    row("datetime", t2("analysis.datetime"), dateText);
    row("altitude", t2("analysis.altitude"), `${analysisMetric(result.sun?.altitude_deg, 2)}°`);
    row("azimuth", t2("analysis.azimuth"), `${analysisMetric(result.sun?.azimuth_deg, 2)}°`);
    row("shadows", t2("analysis.shadows"), result.shadows_enabled ? t2("analysis.shadowsOn") : t2("analysis.shadowsOff"));
    row("daylight", t2("analysis.daylight"), result.night ? t2("analysis.night") : t2("analysis.day"));
  } else if (operation === "skyline") {
    row("angle", t2("analysis.skylineAngle"), `${analysisMetric(result.max_angle_deg, 2)}°`);
    row("distance", t2("analysis.skylineDistance"), formatDistance(result.max_distance_m ?? 0));
    row("eye", t2("analysis.skylineEye"), formatHeight(result.eye_height_m ?? 0));
    row("samples", t2("analysis.samples"), `${result.samples ?? 0}`);
  } else if (operation === "clip") {
    row("height", t2("analysis.clipHeight"), formatHeight(result.height ?? 0));
    row(
      "keep",
      t2("analysis.clipKeep"),
      result.keep === "above" ? t2("analysis.clipKeepAbove") : t2("analysis.clipKeepBelow")
    );
    row("planes", t2("analysis.clipPlanes"), `${result.planes ?? 1}`);
  }
  return h3(
    "div",
    { className: "mv-card mv-analysis", role: "region", "aria-label": t2(`analysis.title.${operation}`) },
    h3(
      "header",
      null,
      h3("span", { className: "title" }, t2(`analysis.title.${operation}`)),
      h3(
        "button",
        {
          type: "button",
          className: "mv-icon-btn",
          title: open ? t2("analysis.collapse") : t2("analysis.expand"),
          "aria-label": open ? t2("analysis.collapse") : t2("analysis.expand"),
          "aria-expanded": open,
          onClick: () => setOpen(!open)
        },
        open ? "▾" : "▸"
      ),
      h3(
        "button",
        { type: "button", className: "mv-icon-btn", title: t2("analysis.close"), "aria-label": t2("analysis.close"), onClick: onClose },
        "✕"
      )
    ),
    open ? h3(
      "div",
      { className: "body" },
      state.layerName ? h3("div", { className: "layer", title: state.layerName }, `${t2("analysis.layer")}: ${state.layerName}`) : null,
      ...rows,
      operation === "profile" ? h3(AnalysisProfileChart, { points: result.points, t: t2 }) : null,
      h3("p", { className: "hint" }, t2("analysis.hint"))
    ) : null
  );
}
function ShaderWorkbench({
  t: t2,
  layers,
  form,
  active,
  target,
  onClose,
  onLayer,
  onPreset,
  onPresetMove,
  onField,
  onPreview,
  onCompare,
  onApply,
  onResetLayer,
  onResetAll
}) {
  const visibleLayers = layers.filter((layer) => layer.visible);
  const selectedPresets = Array.isArray(form.preset) ? form.preset : [form.preset];
  const presetLabel = (value) => (Array.isArray(value) ? value : [value]).map((item) => t2(`shader.preset.${item}`)).join(" + ");
  const [live, setLive] = import_react4.default.useState(false);
  const [comparing, setComparing] = import_react4.default.useState(false);
  const comparingRef = import_react4.default.useRef(false);
  import_react4.default.useEffect(
    () => () => {
      if (comparingRef.current) onCompare(false);
    },
    []
  );
  const targetName = target?.layer?.name ?? "";
  const changeField = (key, value) => {
    onField(key, value);
    if (live) onPreview();
  };
  const toggleCompare = () => {
    const next = !comparing;
    setComparing(next);
    comparingRef.current = next;
    onCompare(next);
  };
  const stopCompare = () => {
    if (!comparingRef.current) return;
    comparingRef.current = false;
    setComparing(false);
    onCompare(false);
  };
  const runApply = () => {
    stopCompare();
    onApply();
  };
  const runResetLayer = () => {
    stopCompare();
    onResetLayer();
  };
  const runResetAll = () => {
    stopCompare();
    onResetAll();
  };
  const sliderField = (key, labelKey, min, max, step, fallback = "") => h3(
    "div",
    { className: "param", key },
    h3("div", { className: "param-head" }, h3("label", { htmlFor: `mv-shader-${key}` }, t2(labelKey))),
    h3(
      "div",
      { className: "param-controls" },
      h3("input", {
        className: "slider",
        type: "range",
        min,
        max,
        step,
        value: form[key] === "" ? fallback : form[key],
        "aria-label": t2(labelKey),
        onChange: (event) => changeField(key, event.target.value)
      }),
      h3("input", {
        className: "number",
        id: `mv-shader-${key}`,
        type: "number",
        inputMode: "decimal",
        step: "any",
        value: form[key],
        placeholder: t2("shader.param.auto"),
        onChange: (event) => changeField(key, event.target.value)
      })
    )
  );
  const paramRows = [];
  if (selectedPresets.includes("height-false-color")) {
    paramRows.push(
      sliderField("minHeight", "shader.param.minHeight", -1e3, 9e3, 1, "0"),
      sliderField("maxHeight", "shader.param.maxHeight", -1e3, 9e3, 1, "200")
    );
  }
  if (selectedPresets.includes("contour")) paramRows.push(sliderField("interval", "shader.param.interval", 1, 500, 1, "20"));
  if (selectedPresets.includes("scan") || selectedPresets.includes("water")) {
    paramRows.push(sliderField("speed", "shader.param.speed", 0.1, 10, 0.1, "1"));
  }
  if (selectedPresets.includes("water")) {
    paramRows.push(sliderField("amplitude", "shader.param.amplitude", 0.1, 5, 0.1, "1"), sliderField("opacity", "shader.param.opacity", 0.05, 1, 0.05, "0.75"));
  }
  if (selectedPresets.includes("water-depth")) {
    paramRows.push(sliderField("waterHeight", "shader.param.waterHeight", -1e3, 9e3, 1, "0"), sliderField("depthMax", "shader.param.depthMax", 0.5, 500, 0.5, "50"));
  }
  const params = paramRows.length > 0 ? h3("div", { className: "params" }, ...paramRows) : null;
  const thumb = (preset) => {
    const viewBox = "0 0 96 40";
    const common = { viewBox, preserveAspectRatio: "none", className: "thumb-svg", "aria-hidden": true };
    if (preset === "height-false-color") {
      return h3(
        "svg",
        common,
        h3(
          "defs",
          null,
          h3(
            "linearGradient",
            { id: "mv-thumb-ramp", x1: "0", y1: "0", x2: "1", y2: "0" },
            h3("stop", { offset: "0", stopColor: "#172466" }),
            h3("stop", { offset: "0.28", stopColor: "#157db3" }),
            h3("stop", { offset: "0.52", stopColor: "#3dcc99" }),
            h3("stop", { offset: "0.78", stopColor: "#fcc951" }),
            h3("stop", { offset: "1", stopColor: "#f05c4d" })
          )
        ),
        h3("rect", { width: "96", height: "40", fill: "url(#mv-thumb-ramp)", opacity: "0.9" }),
        h3("path", { d: "M0 34 L18 22 L34 28 L52 12 L70 18 L96 6 L96 40 L0 40 Z", fill: "rgba(8,14,24,.35)" })
      );
    }
    if (preset === "contour") {
      return h3(
        "svg",
        common,
        h3("rect", { width: "96", height: "40", fill: "#0e1620" }),
        ...[0, 1, 2, 3].map(
          (index) => h3("path", {
            key: index,
            d: `M0 ${10 + index * 7} C 16 ${4 + index * 8}, 32 ${18 + index * 6}, 48 ${10 + index * 7} S 80 ${2 + index * 9}, 96 ${12 + index * 6}`,
            fill: "none",
            stroke: "#9fdcff",
            strokeWidth: "1.4",
            opacity: 0.85 - index * 0.12
          })
        )
      );
    }
    if (preset === "scan") {
      return h3(
        "svg",
        common,
        h3("rect", { width: "96", height: "40", fill: "#0b1119" }),
        ...[0, 1, 2, 3, 4].map(
          (index) => h3("line", { key: index, x1: "0", y1: 8 + index * 8, x2: "96", y2: 8 + index * 8, stroke: "#243244", strokeWidth: "0.5" })
        ),
        h3(
          "defs",
          null,
          h3(
            "linearGradient",
            { id: "mv-thumb-scan", x1: "0", y1: "0", x2: "1", y2: "0" },
            h3("stop", { offset: "0", stopColor: "rgba(55,230,255,0)" }),
            h3("stop", { offset: "0.5", stopColor: "rgba(55,230,255,.85)" }),
            h3("stop", { offset: "1", stopColor: "rgba(55,230,255,0)" })
          )
        ),
        h3("rect", { x: "30", y: "14", width: "36", height: "12", fill: "url(#mv-thumb-scan)" })
      );
    }
    if (preset === "water") {
      return h3(
        "svg",
        common,
        h3(
          "defs",
          null,
          h3(
            "linearGradient",
            { id: "mv-thumb-water", x1: "0", y1: "0", x2: "0", y2: "1" },
            h3("stop", { offset: "0", stopColor: "#0b2b52" }),
            h3("stop", { offset: "1", stopColor: "#1b6fae" })
          )
        ),
        h3("rect", { width: "96", height: "40", fill: "url(#mv-thumb-water)" }),
        ...[0, 1, 2].map(
          (index) => h3("path", {
            key: index,
            d: `M0 ${14 + index * 8} Q 12 ${8 + index * 8}, 24 ${14 + index * 8} T 48 ${14 + index * 8} T 72 ${14 + index * 8} T 96 ${14 + index * 8}`,
            fill: "none",
            stroke: "#9fd7ff",
            strokeWidth: "1.3",
            opacity: 0.5
          })
        )
      );
    }
    return h3(
      "svg",
      common,
      h3(
        "defs",
        null,
        h3(
          "linearGradient",
          { id: "mv-thumb-depth", x1: "0", y1: "0", x2: "0", y2: "1" },
          h3("stop", { offset: "0", stopColor: "#67e8f9" }),
          h3("stop", { offset: "0.55", stopColor: "#0e7490" }),
          h3("stop", { offset: "1", stopColor: "#0b1e4b" })
        )
      ),
      h3("rect", { width: "96", height: "40", fill: "url(#mv-thumb-depth)" }),
      h3("line", { x1: "0", y1: "16", x2: "96", y2: "16", stroke: "rgba(255,255,255,.65)", strokeWidth: "0.8" })
    );
  };
  const orderList = selectedPresets.length > 1 ? h3(
    "div",
    { className: "order", role: "list", "aria-label": t2("shader.orderLabel") },
    ...selectedPresets.map(
      (preset, index) => h3(
        "div",
        { key: preset, className: "order-item", role: "listitem" },
        h3("span", { className: "index" }, `${index + 1}`),
        h3("span", { className: "order-name", title: t2(`shader.preset.${preset}`) }, t2(`shader.preset.${preset}`)),
        h3(
          "button",
          { type: "button", className: "mv-icon-btn", title: t2("shader.moveUp"), disabled: index === 0, onClick: () => onPresetMove(preset, -1) },
          "↑"
        ),
        h3(
          "button",
          { type: "button", className: "mv-icon-btn", title: t2("shader.moveDown"), disabled: index === selectedPresets.length - 1, onClick: () => onPresetMove(preset, 1) },
          "↓"
        ),
        h3("button", { type: "button", className: "mv-icon-btn", title: t2("shader.removePreset"), onClick: () => onPreset(preset) }, "✕")
      )
    )
  ) : null;
  return h3(
    "div",
    { className: "mv-card mv-shader", role: "region", "aria-label": t2("shader.title") },
    h3(
      "header",
      null,
      h3("span", { className: "title" }, t2("shader.title")),
      h3("span", { className: "subtitle" }, targetName !== "" ? t2("shader.targetChip", { name: targetName }) : t2("shader.targetNone")),
      h3(
        "button",
        { type: "button", className: "mv-icon-btn", title: t2("shader.close"), "aria-label": t2("shader.close"), onClick: onClose },
        "✕"
      )
    ),
    h3(
      "div",
      { className: "body" },
      h3(
        "div",
        { className: "field" },
        h3("label", { htmlFor: "mv-shader-layer" }, t2("shader.layerLabel")),
        h3(
          "select",
          {
            id: "mv-shader-layer",
            value: form.layerId,
            disabled: visibleLayers.length === 0,
            onChange: (event) => onLayer(event.target.value)
          },
          h3("option", { value: "" }, targetName !== "" ? t2("shader.layerAutoNamed", { name: targetName }) : t2("shader.layerAuto")),
          ...visibleLayers.map((layer) => h3("option", { key: layer.id, value: layer.id }, layer.name))
        ),
        h3(
          "p",
          { className: "target-line" },
          targetName === "" ? t2("shader.targetNone") : target?.auto ? t2("shader.targetAuto", { name: targetName }) : t2("shader.targetFixed", { name: targetName })
        )
      ),
      h3(
        "div",
        { className: "field" },
        h3("label", null, t2("shader.presetLabel")),
        h3(
          "div",
          { className: "presets" },
          ...SHADER_PRESETS.map((preset) => {
            const selected = selectedPresets.includes(preset);
            const order = selected ? selectedPresets.indexOf(preset) + 1 : 0;
            return h3(
              "button",
              {
                key: preset,
                type: "button",
                className: `preset${selected ? " on" : ""}`,
                title: t2(`shader.preset.${preset}`),
                "aria-pressed": selected,
                onClick: () => onPreset(preset)
              },
              h3("span", { className: "thumb" }, thumb(preset)),
              h3("span", { className: "preset-name" }, t2(`shader.preset.${preset}`)),
              order > 0 ? h3("span", { className: "order-badge", "aria-hidden": true }, `${order}`) : null
            );
          })
        ),
        h3("p", { className: "hint" }, t2("shader.stackHint"))
      ),
      orderList,
      params,
      h3(
        "label",
        { className: "live-row" },
        h3("input", {
          type: "checkbox",
          checked: live,
          onChange: (event) => {
            setLive(event.target.checked);
            if (event.target.checked) onPreview();
          }
        }),
        h3("span", null, t2("shader.livePreview"))
      ),
      h3(
        "div",
        { className: "row" },
        h3("button", { type: "button", className: "mv-cta primary", disabled: visibleLayers.length === 0, onClick: runApply }, t2("shader.apply")),
        h3(
          "button",
          {
            type: "button",
            className: `mv-cta${comparing ? " on" : ""}`,
            disabled: visibleLayers.length === 0,
            "aria-pressed": comparing,
            title: t2("shader.compareHint"),
            onClick: toggleCompare
          },
          comparing ? t2("shader.compareOn") : t2("shader.compare")
        )
      ),
      h3(
        "div",
        { className: "row" },
        h3("button", { type: "button", className: "mv-cta", onClick: runResetLayer }, t2("shader.resetLayer")),
        h3("button", { type: "button", className: "mv-cta", disabled: active.length === 0, onClick: runResetAll }, t2("shader.resetAll"))
      ),
      h3(
        "div",
        { className: "active" },
        h3("b", null, t2("shader.active")),
        active.length === 0 ? h3("span", { className: "empty" }, t2("shader.activeEmpty")) : active.map(
          (entry) => h3(
            "div",
            { key: entry.layer, className: "item" },
            h3("span", { title: entry.layer }, entry.layer),
            h3("span", { className: "applied-tag" }, t2("shader.appliedTag")),
            h3("em", null, presetLabel(entry.preset))
          )
        )
      ),
      visibleLayers.length === 0 ? h3("p", { className: "hint" }, t2("shader.noLayers")) : null
    )
  );
}

// src/client/ui/css.js
var CSS = `
.mv-root{position:relative;flex:1 1 0;min-height:0;overflow:hidden;background:var(--mv-bg);color:var(--mv-text);font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;--mv-bg:var(--dsw-alias-bg-base,#fff);--mv-text:var(--dsw-alias-label-primary,#0f1115);--mv-dim:var(--dsw-alias-label-secondary,#5b6068);--mv-line:var(--dsw-alias-border-l2,#0000001a);--mv-accent:var(--dsw-alias-state-business-primary,#4176e6);--mv-lift:var(--dsw-alias-interactive-bg-hover,#2631480f);--mv-glass:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 88%,transparent);--mv-glass-strong:var(--dsw-alias-bg-layer-1,#fff);--mv-input:var(--dsw-alias-interactive-bg-hover,#2631480f);--mv-shadow:0 8px 28px rgba(15,23,42,.18);--mv-attrib:rgba(255,255,255,.62);--mv-attrib-shadow:0 1px 2px rgba(0,0,0,.6);--mv-overlay:transparent;--mv-scrim:rgba(24,34,50,.28)}
.mv-root[data-mv-scheme="dark"]{--mv-attrib:rgba(255,255,255,.62);--mv-attrib-shadow:0 1px 2px rgba(0,0,0,.6);--mv-overlay:transparent;--mv-scrim:rgba(3,7,13,.62)}
.mv-root[data-mv-theme="dark"]{--mv-bg:#151517;--mv-text:#ebeef2;--mv-dim:#adb2b8;--mv-line:#ffffff1f;--mv-accent:#7aaaff;--mv-lift:#ffffff14;--mv-glass:rgba(21,21,23,.82);--mv-glass-strong:#232324;--mv-input:#ffffff14;--mv-shadow:0 8px 28px rgba(0,0,0,.34);color-scheme:dark}
.mv-root[data-mv-theme="light"]{--mv-bg:#fff;--mv-text:#0f1115;--mv-dim:#5b6068;--mv-line:#0000001a;--mv-accent:#4176e6;--mv-lift:#2631480f;--mv-glass:rgba(255,255,255,.86);--mv-glass-strong:#fff;--mv-input:#2631480f;--mv-shadow:0 8px 28px rgba(15,23,42,.16);color-scheme:light}
/* DOM fullscreen: the panel root owns the whole screen, so the flex sizing of
   the slot no longer applies and the floating chrome uses the viewport. */
.mv-root:fullscreen{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0}
.mv-globe{position:absolute;inset:0;background:#05080f}
.mv-globe .cesium-viewer,.mv-globe .cesium-widget,.mv-globe .cesium-widget canvas{width:100%;height:100%}
.mv-attr{position:absolute;right:10px;bottom:18px;z-index:6;font-size:10px;line-height:1.4;color:var(--mv-attrib);pointer-events:none;text-shadow:var(--mv-attrib-shadow)}
.mv-credits{position:absolute;right:10px;bottom:2px;max-width:46%;z-index:6;font-size:10px;color:var(--mv-attrib);text-align:right;line-height:1.4;text-shadow:var(--mv-attrib-shadow)}
.mv-credits .cesium-credit-textContainer,.mv-credits .cesium-credit-logoContainer{display:inline-block}
.mv-credits a{color:inherit}
.mv-glass{background:var(--mv-glass);border:.5px solid var(--mv-line);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:var(--mv-shadow)}
.mv-top{position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;z-index:10;pointer-events:none}
.mv-brand{display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:11px;pointer-events:auto}
.mv-brand b{font-size:13px;font-weight:600;letter-spacing:.01em}
.mv-brand span{font-size:11px;color:var(--mv-dim)}
.mv-brand b,.mv-brand span{white-space:nowrap}
.mv-actions{display:flex;align-items:center;gap:2px;padding:4px;border-radius:11px;pointer-events:auto;flex-wrap:wrap;justify-content:flex-end}
.mv-btn{appearance:none;border:0;background:transparent;color:var(--mv-dim);font:inherit;font-size:12px;line-height:1;padding:7px 9px;border-radius:7px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.mv-btn:hover{background:color-mix(in srgb,var(--mv-lift) 72%,transparent);color:var(--mv-text)}
.mv-btn.on{background:color-mix(in srgb,var(--mv-accent) 26%,transparent);color:var(--mv-text)}
.mv-btn.icon{padding:7px 8px;flex:none}
.mv-btn:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-sep{width:1px;height:17px;background:var(--mv-line);margin:0 3px}
.mv-menu{position:relative;display:inline-flex}
.mv-menu-panel{position:absolute;top:calc(100% + 6px);right:0;min-width:206px;padding:4px;border-radius:11px;z-index:20;display:flex;flex-direction:column;gap:1px}
.mv-menu-item{appearance:none;border:0;background:transparent;color:var(--mv-text);font:inherit;font-size:12px;text-align:left;padding:8px 10px;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;white-space:nowrap}
.mv-menu-item:hover{background:color-mix(in srgb,var(--mv-lift) 80%,transparent)}
.mv-menu-item.on{color:var(--mv-accent)}
.mv-menu-item .check{font-size:11px}
.mv-menu-label{padding:4px 10px 2px;font-size:10.5px;line-height:1.4;letter-spacing:.04em;color:var(--mv-dim);white-space:nowrap}
.mv-menu-item .ellipsis{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-urlbar{position:absolute;top:58px;left:0;right:0;margin:0 auto;display:flex;gap:6px;padding:6px;border-radius:11px;z-index:12;width:min(640px,82%)}
.mv-urlbar input{flex:1;min-width:0;background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:7px;padding:7px 9px;font:inherit;font-size:12px;outline:none}
.mv-urlbar input:focus{border-color:var(--mv-accent)}
.mv-urlbar button{appearance:none;border:.5px solid var(--mv-line);background:var(--mv-lift);color:var(--mv-text);font:inherit;font-size:12px;padding:7px 13px;border-radius:7px;cursor:pointer}
.mv-urlbar button:hover{border-color:var(--mv-accent)}
/* Right-hand floating column: the analysis card (Agent result) and the layer
   card share one stack so a new analysis never overlaps the layers list. */
.mv-right{position:absolute;top:60px;right:10px;width:min(300px,calc(100% - 20px));max-height:calc(100% - 150px);display:flex;flex-direction:column;gap:10px;z-index:9;pointer-events:none}
.mv-right>*{pointer-events:auto}
.mv-card{background:var(--mv-glass);border:.5px solid var(--mv-line);box-shadow:var(--mv-shadow);border-radius:13px}
.mv-layers{width:100%;min-height:0;flex:1 1 auto;display:flex;flex-direction:column;border-radius:13px;overflow:hidden}
.mv-analysis{flex:0 1 auto;min-height:0;max-height:min(62%,380px);width:100%;max-width:300px;display:flex;flex-direction:column;overflow:hidden}
.mv-analysis>header{display:flex;align-items:center;gap:2px;padding:7px 7px 7px 11px;border-bottom:.5px solid var(--mv-line)}
.mv-analysis>header .title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}
.mv-analysis .body{padding:8px 11px 10px;overflow:auto;display:flex;flex-direction:column;gap:5px;min-height:0}
.mv-analysis .layer{color:var(--mv-dim);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-analysis .stat{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:11.5px;line-height:1.5}
.mv-analysis .stat span{flex:none;color:var(--mv-dim)}
.mv-analysis .stat b{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;word-break:break-word}
.mv-analysis .chart{width:100%;height:auto;display:block;margin-top:2px;border:.5px solid var(--mv-line);border-radius:8px;background:color-mix(in srgb,var(--mv-bg) 45%,transparent)}
.mv-analysis .chart text{fill:var(--mv-dim);font-size:8px}
.mv-analysis .hint{margin:2px 0 0;color:var(--mv-dim);font-size:10px;line-height:1.5}
/* Shader workbench (B3): one compact card on the left, never wider than 320px. */
.mv-shader{position:absolute;top:60px;left:10px;width:min(340px,calc(100% - 20px));max-height:calc(100% - 150px);z-index:14;display:flex;flex-direction:column;overflow:hidden;border-radius:14px;--shader-mint:#3ddc97;background:color-mix(in srgb,var(--mv-glass-strong) 94%,#0a0f15 6%);backdrop-filter:blur(14px) saturate(1.08);-webkit-backdrop-filter:blur(14px) saturate(1.08);border:.5px solid color-mix(in srgb,var(--mv-line) 65%,transparent);box-shadow:0 24px 64px rgba(2,8,20,.35)}
.mv-shader>header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:.5px solid var(--mv-line);background:linear-gradient(180deg,color-mix(in srgb,var(--shader-mint) 7%,transparent),transparent)}
.mv-shader>header .title{flex:none;font-size:13px;font-weight:650;letter-spacing:.01em}
.mv-shader>header .subtitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--mv-dim)}
.mv-shader .body{padding:12px 13px 14px;overflow:auto;display:flex;flex-direction:column;gap:11px;min-height:0}
.mv-shader .field{display:flex;flex-direction:column;gap:5px;min-width:0}
.mv-shader .field label{font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:color-mix(in srgb,var(--mv-dim) 88%,var(--mv-text))}
.mv-shader .field select,.mv-shader .field input{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:8px;padding:7px 9px;font:inherit;font-size:12.5px;outline:none;min-width:0}
.mv-shader .field select:focus,.mv-shader .field input:focus{border-color:var(--shader-mint);box-shadow:0 0 0 2px color-mix(in srgb,var(--shader-mint) 18%,transparent)}
.mv-shader .target-line{margin:0;font-size:11px;line-height:1.45;color:var(--mv-dim)}
.mv-shader .params{display:grid;grid-template-columns:1fr;gap:9px}
.mv-shader .param{display:flex;flex-direction:column;gap:4px}
.mv-shader .param-head label{font-size:11px;color:var(--mv-dim)}
.mv-shader .param-controls{display:grid;grid-template-columns:1fr 62px;gap:7px;align-items:center}
.mv-shader .param .slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;border-radius:3px;background:linear-gradient(90deg,color-mix(in srgb,var(--shader-mint) 55%,transparent),color-mix(in srgb,var(--shader-mint) 18%,transparent));outline:none;margin:0}
.mv-shader .param .slider::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:var(--shader-mint);border:2px solid #0b1512;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer}
.mv-shader .param .slider::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--shader-mint);border:2px solid #0b1512;cursor:pointer}
.mv-shader .param .number{padding:5px 6px;text-align:right;font-size:11.5px}
.mv-shader .presets{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.mv-shader .preset{position:relative;display:flex;flex-direction:column;gap:5px;appearance:none;border:.5px solid var(--mv-line);background:color-mix(in srgb,var(--mv-input) 82%,transparent);color:var(--mv-dim);font:inherit;font-size:11px;padding:5px;border-radius:9px;cursor:pointer;text-align:left;min-width:0}
.mv-shader .preset .thumb{display:block;height:36px;border-radius:6px;overflow:hidden;background:#0a1018;border:.5px solid color-mix(in srgb,var(--mv-line) 60%,transparent)}
.mv-shader .preset .thumb-svg{display:block;width:100%;height:100%}
.mv-shader .preset .preset-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--mv-dim)}
.mv-shader .preset:hover{border-color:color-mix(in srgb,var(--shader-mint) 40%,var(--mv-line));color:var(--mv-text)}
.mv-shader .preset.on{border-color:var(--shader-mint);background:color-mix(in srgb,var(--shader-mint) 12%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--shader-mint) 55%,transparent),0 6px 18px rgba(0,0,0,.25);color:var(--mv-text)}
.mv-shader .preset.on .preset-name{color:var(--mv-text);font-weight:600}
.mv-shader .order-badge{position:absolute;top:6px;right:6px;min-width:16px;height:16px;padding:0 3px;border-radius:5px;background:var(--shader-mint);color:#04241a;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.mv-shader .order{display:flex;flex-direction:column;gap:3px;border:.5px dashed color-mix(in srgb,var(--mv-line) 70%,transparent);border-radius:9px;padding:6px 7px}
.mv-shader .order-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mv-text)}
.mv-shader .order-item .index{width:15px;height:15px;border-radius:4px;background:color-mix(in srgb,var(--shader-mint) 22%,transparent);color:var(--shader-mint);font-size:10px;display:flex;align-items:center;justify-content:center;flex:none}
.mv-shader .order-item .order-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-shader .order-item .mv-icon-btn{width:22px;height:22px;font-size:12px}
.mv-shader .order-item .mv-icon-btn:disabled{opacity:.3;cursor:default}
.mv-shader .live-row{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--mv-dim);cursor:pointer;user-select:none}
.mv-shader .live-row input{accent-color:var(--shader-mint);width:14px;height:14px;margin:0}
.mv-shader .row{display:flex;gap:7px}
.mv-shader .row .mv-cta{flex:1;min-width:0;padding:7px 8px;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-shader .row .mv-cta.on{border-color:var(--shader-mint);color:var(--shader-mint);background:color-mix(in srgb,var(--shader-mint) 12%,transparent)}
.mv-shader .row .mv-cta:disabled{opacity:.45;cursor:not-allowed}
.mv-shader .active{display:flex;flex-direction:column;gap:5px;border-top:.5px solid var(--mv-line);padding-top:9px}
.mv-shader .active b{font-size:10px;letter-spacing:.06em;color:var(--mv-dim);font-weight:600;text-transform:uppercase}
.mv-shader .active .item{display:flex;align-items:baseline;gap:6px;font-size:11px;line-height:1.4;min-width:0}
.mv-shader .active .item span:first-child{min-width:0;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mv-text)}
.mv-shader .applied-tag{flex:none;font-size:9px;letter-spacing:.04em;color:#04241a;background:color-mix(in srgb,var(--shader-mint) 80%,transparent);border-radius:4px;padding:1px 4px}
.mv-shader .active .item em{flex:1;min-width:0;font-style:normal;color:var(--mv-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
.mv-shader .empty{color:var(--mv-dim);font-size:11px}
.mv-shader .hint{margin:0;color:var(--mv-dim);font-size:10.5px;line-height:1.5}
.mv-layers>header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;font-size:13px;font-weight:600;letter-spacing:0;color:var(--mv-text);border-bottom:.5px solid var(--mv-line)}
.mv-layers>header .mv-icon-btn{width:26px;height:26px;font-size:13px}
.mv-layer-list{overflow:auto;padding:4px 10px 12px;min-height:0;overscroll-behavior:contain;scrollbar-width:thin}
.mv-layer{display:flex;align-items:center;gap:2px;padding:5px 6px;border-radius:8px}
.mv-layer:hover{background:color-mix(in srgb,var(--mv-lift) 64%,transparent)}
.mv-layer .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;cursor:pointer}
.mv-layer.off .name{color:var(--mv-dim);text-decoration:line-through}
.mv-layer.has-shader{cursor:pointer;border-left:2px solid color-mix(in srgb,#3ddc97 70%,transparent);box-sizing:border-box}
.mv-layer.has-shader:hover{background:color-mix(in srgb,#3ddc97 8%,transparent)}
.mv-layer.has-shader .name{cursor:default}
.mv-layer .mv-shader-edit{color:#3ddc97}
.mv-layer .mv-shader-edit:hover{background:color-mix(in srgb,#3ddc97 18%,transparent);color:#7ff0c4}
.mv-icon-btn{appearance:none;border:0;background:transparent;color:var(--mv-dim);width:26px;height:26px;border-radius:7px;cursor:pointer;font:inherit;font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:none}
.mv-layer{gap:3px;padding:5px 7px}
.mv-layer .mv-icon-btn{font-size:15px}
/* Layer panel v1.6: four groups (L1 terrain / L2 basemap / L3 raster / L4 vector)
   plus the 3D Tiles list. */
.mv-group{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 4px 5px;margin-top:3px;border-top:.5px solid var(--mv-line)}
.mv-group:first-child{border-top:0;margin-top:0;padding-top:9px}
.mv-group-title{min-width:0;font-size:11px;line-height:1.4;font-weight:600;letter-spacing:0;color:var(--mv-dim)}
.mv-layers .mv-layer{min-height:30px;box-sizing:border-box;padding:5px 8px}
.mv-layers .mv-layer .name{font-size:12px;line-height:1.45;font-weight:400}
.mv-choice{appearance:none;width:100%;text-align:left;border:1px solid transparent;background:transparent;color:var(--mv-text);font:inherit;cursor:pointer}
.mv-choice .tick{color:var(--mv-accent);font-size:12px;font-weight:600;flex:none}
.mv-choice.on{background:color-mix(in srgb,var(--mv-accent) 10%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 18%,transparent)}
.mv-choice.on .name{font-weight:600}
.mv-choice:focus-visible,.mv-layers .mv-cta:focus-visible,.mv-layers .mv-icon-btn:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-group .mv-cta{flex:none;font-size:11px;padding:5px 8px}
.mv-opacity{width:64px;flex:none;accent-color:var(--mv-accent)}
.mv-overlay-row{gap:2px}
.mv-none{padding:6px 8px 8px;font-size:11px;line-height:1.5;color:var(--mv-dim)}
.mv-terrain-error{display:flex;align-items:flex-start;gap:6px;margin:2px 6px 6px;padding:7px 9px;border-radius:8px;background:color-mix(in srgb,#f0b84b 14%,transparent);border:.5px solid color-mix(in srgb,#f0b84b 38%,transparent);color:color-mix(in srgb,#f0b84b 65%,var(--mv-text))}
.mv-terrain-error span{flex:1;min-width:0}
.mv-terrain-error .mv-icon-btn{width:22px;height:22px;font-size:13px;flex:none}
.mv-overlay-form{border:.5px solid var(--mv-line);border-radius:8px;padding:8px;margin:2px 4px 6px;display:flex;flex-direction:column;gap:6px;background:color-mix(in srgb,var(--mv-lift) 40%,transparent)}
.mv-overlay-form .mv-field{display:flex;flex-direction:column;gap:3px}
.mv-overlay-form .mv-field label{font-size:10px;color:var(--mv-dim)}
.mv-overlay-form input,.mv-overlay-form select{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:5px 7px;font:inherit;font-size:11px;min-width:0}
.mv-icon-btn:hover{background:color-mix(in srgb,var(--mv-lift) 82%,transparent);color:var(--mv-text)}
.mv-icon-btn.on{color:var(--mv-accent)}
.mv-hud{position:absolute;left:10px;bottom:10px;z-index:9;padding:8px 11px;border-radius:11px;display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--mv-dim);max-width:min(640px,calc(100% - 20px));white-space:nowrap;pointer-events:none}
.mv-hud .row{display:flex;gap:10px;flex-wrap:nowrap;align-items:baseline;min-width:0;overflow:hidden}
.mv-hud .row>span{flex:none;white-space:nowrap}
.mv-hud b{color:var(--mv-text);font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.mv-pick{position:absolute;right:10px;bottom:10px;width:322px;max-height:44%;display:flex;flex-direction:column;z-index:13;border-radius:12px;overflow:hidden}
.mv-pick>header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;font-size:11px;color:var(--mv-dim);border-bottom:.5px solid var(--mv-line)}
.mv-pick table{width:100%;border-collapse:collapse;font-size:11px;overflow:auto;display:block}
.mv-pick td{padding:3px 9px;vertical-align:top;border-top:.5px solid var(--mv-line);word-break:break-all}
.mv-pick td:first-child{color:var(--mv-dim);width:38%}
.mv-measure{position:absolute;left:0;right:0;margin:0 auto;width:max-content;bottom:16px;z-index:11;padding:7px 14px;border-radius:999px;font-size:12px;font-weight:500;line-height:1.35;color:var(--mv-text);white-space:nowrap;pointer-events:none;display:flex;align-items:center;gap:10px;font-variant-numeric:tabular-nums;background:color-mix(in srgb,var(--mv-glass-strong) 94%,transparent);border:.5px solid color-mix(in srgb,var(--mv-line) 80%,transparent);box-shadow:0 6px 18px rgba(0,0,0,.22);backdrop-filter:none;-webkit-backdrop-filter:none}
.mv-measure-end{pointer-events:auto;appearance:none;border:.5px solid var(--mv-line);background:var(--mv-lift);color:var(--mv-text);font:inherit;font-size:11px;padding:3px 10px;border-radius:999px;cursor:pointer}
.mv-measure-end:hover{border-color:var(--mv-accent);background:color-mix(in srgb,var(--mv-accent) 20%,transparent)}
.mv-toast{position:absolute;left:0;right:0;margin:0 auto;width:max-content;bottom:64px;z-index:40;background:var(--mv-glass-strong);border:.5px solid var(--mv-line);color:var(--mv-text);padding:8px 14px;border-radius:9px;font-size:12px;max-width:72%;word-break:break-all;box-shadow:var(--mv-shadow)}
.mv-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--mv-overlay);pointer-events:none}
.mv-overlay.dim{background:var(--mv-scrim)}
.mv-empty{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;max-width:470px;pointer-events:auto;padding:24px 28px;border-radius:16px;background:var(--mv-glass-strong);border:.5px solid var(--mv-line);box-shadow:0 24px 64px var(--mv-shadow)}
.mv-empty .mv-empty-close{position:absolute;top:8px;right:8px;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:none;border-radius:7px;background:transparent;color:var(--mv-dim);font-size:14px;line-height:1;cursor:pointer;transition:background .12s,color .12s}
.mv-empty .mv-empty-close:hover{background:color-mix(in srgb,var(--mv-lift) 80%,transparent);color:var(--mv-text)}
.mv-empty .mv-empty-close:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-empty h2{margin:0;font-size:17px;font-weight:600;letter-spacing:.01em;color:var(--mv-text)}
.mv-empty p{margin:0;color:var(--mv-dim);font-size:12px;line-height:1.75}
.mv-empty .buttons{display:flex;gap:8px;margin-top:2px}
.mv-cta{appearance:none;border:.5px solid var(--mv-line);background:var(--mv-lift);color:var(--mv-text);font:inherit;font-size:12px;padding:8px 16px;border-radius:9px;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.mv-cta.primary{background:color-mix(in srgb,var(--mv-accent) 20%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 45%,transparent)}
.mv-cta:hover{border-color:var(--mv-accent);background:color-mix(in srgb,var(--mv-accent) 26%,transparent)}
.mv-cta:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-spinner{width:24px;height:24px;border-radius:50%;border:2px solid rgba(120,160,255,.22);border-top-color:var(--mv-accent);animation:mv-spin .9s linear infinite}
@keyframes mv-spin{to{transform:rotate(360deg)}}
.mv-overlay.dim:has(>.mv-empty>.mv-spinner){background:color-mix(in srgb,var(--mv-scrim) 42%,transparent)}
.mv-overlay.dim>.mv-empty:has(>.mv-spinner){box-sizing:border-box;width:min(290px,100%);padding:30px 24px 26px;gap:22px;border-radius:22px;background:color-mix(in srgb,var(--mv-glass-strong) 94%,transparent);border-color:color-mix(in srgb,#8bb6dc 20%,transparent);box-shadow:0 12px 40px rgba(62,103,143,.1);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.mv-overlay.dim>.mv-empty:has(>.mv-spinner) p{font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:12px;font-weight:500;line-height:1.6;letter-spacing:.02em;color:var(--mv-dim)}
.mv-overlay.dim>.mv-empty>.mv-spinner{position:relative;box-sizing:border-box;flex:0 0 80px;width:80px!important;height:80px!important;min-width:80px;min-height:80px;max-width:80px;max-height:80px;aspect-ratio:1;overflow:hidden;isolation:isolate;border:0;border-radius:50%!important;corner-shape:round!important;clip-path:circle(50%);background:#e2f2fd;box-shadow:none;animation:none}
.mv-overlay.dim>.mv-empty>.mv-spinner::before,.mv-overlay.dim>.mv-empty>.mv-spinner::after{content:none}
.mv-loading-globe{display:block;width:80px!important;height:80px!important;border:0;border-radius:50%!important;corner-shape:round!important;clip-path:circle(50%)}
.mv-modal{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:var(--mv-scrim);padding:20px}
.mv-dialog{width:min(740px,94%);max-height:86%;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;background:var(--mv-glass-strong);border:.5px solid var(--mv-line);box-shadow:0 24px 64px var(--mv-shadow)}
.mv-dialog>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:.5px solid var(--mv-line);font-size:13px;font-weight:600}
.mv-tabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:.5px solid var(--mv-line)}
.mv-tab{appearance:none;border:0;background:transparent;color:var(--mv-dim);font:inherit;font-size:12px;padding:8px 12px;border-radius:8px 8px 0 0;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.mv-tab:hover{color:var(--mv-text)}
.mv-tab.on{color:var(--mv-text);border-bottom-color:var(--mv-accent)}
.mv-tab:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-dialog .body{padding:12px 14px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.mv-note{margin:0 0 2px;color:var(--mv-dim);font-size:11px;line-height:1.65}
.mv-src{display:flex;align-items:center;gap:8px;padding:8px 10px;border:.5px solid var(--mv-line);border-radius:9px;background:color-mix(in srgb,var(--mv-bg) 55%,transparent)}
.mv-src .radio{width:16px;height:16px;flex:none;border-radius:50%;border:1.5px solid var(--mv-line);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.mv-src .radio.on{border-color:var(--mv-accent)}
.mv-src .radio.on::after{content:"";width:8px;height:8px;border-radius:50%;background:var(--mv-accent)}
.mv-src .meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.mv-src .meta b{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-src .meta span{font-size:10.5px;color:var(--mv-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-src .badge{font-size:10px;padding:1px 6px;border-radius:999px;border:.5px solid var(--mv-line);color:var(--mv-dim);flex:none}
.mv-form{border:.5px solid var(--mv-line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:color-mix(in srgb,var(--mv-bg) 42%,transparent)}
.mv-form .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mv-field{display:flex;flex-direction:column;gap:3px;min-width:0}
.mv-field label{font-size:10.5px;color:var(--mv-dim)}
.mv-field input,.mv-field select{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:6px 8px;font:inherit;font-size:12px;outline:none;min-width:0}
.mv-field input:focus,.mv-field select:focus{border-color:var(--mv-accent)}
.mv-field.check{flex-direction:row;align-items:center;gap:7px}
.mv-field.check label{font-size:12px;color:var(--mv-text);cursor:pointer}
.mv-field.check input{appearance:auto;width:13px;height:13px;padding:0;margin:0}
.mv-dialog .footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-top:.5px solid var(--mv-line)}
.mv-dialog .footer .right{display:flex;gap:8px}

.mv-seg{display:flex;gap:2px;padding:3px;border:.5px solid var(--mv-line);border-radius:9px;background:var(--mv-input)}
.mv-seg button{appearance:none;border:0;background:transparent;color:var(--mv-dim);font:inherit;font-size:11.5px;padding:6px 12px;border-radius:6px;cursor:pointer;flex:1}
.mv-seg button.on{background:color-mix(in srgb,var(--mv-accent) 22%,transparent);color:var(--mv-text)}
.mv-seg button:focus-visible,.mv-icon-btn:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
/* Docked inside the session right sidebar: fill the tab body, tighten chrome. */
/* The host already draws the tab strip right above this body, so the floating
   toolbar keeps a visible gap instead of hugging it; the layer card follows the
   same offset so the two never collide when the action row wraps. */
.mv-root.mv-docked{container-type:inline-size;margin-top:9px}
.mv-root.mv-docked .mv-top{top:20px;left:20px;right:20px;gap:8px}
.mv-root.mv-docked .mv-brand{padding:6px 10px;flex:none;gap:6px}
.mv-root.mv-docked .mv-actions{gap:0;padding:3px;flex:0 1 auto;max-width:100%;margin-left:auto;min-width:0;row-gap:2px}
.mv-root.mv-docked .mv-right{top:96px;right:20px;width:min(300px,calc(100% - 40px));max-height:calc(100% - 250px)}
.mv-root.mv-docked .mv-shader{top:96px;left:20px;width:min(320px,calc(100% - 40px));max-height:calc(100% - 250px)}
.mv-root.mv-docked .mv-dialog{width:min(680px,96%)}
/* Narrow docked panes: the host tab already shows the panel title, so drop the
   duplicated brand title, then the status text, then the whole brand, keeping
   the action row on one line as long as possible. */
@container (max-width: 900px){
  .mv-root.mv-docked .mv-brand b{display:none}
}
@container (max-width: 760px){
  .mv-root.mv-docked .mv-actions .mv-btn{padding:6px 8px}
  .mv-root.mv-docked .mv-actions .mv-sep{margin:0 1px}
  .mv-root.mv-docked .mv-actions .mv-btn.icon{padding:7px 6px}
}
@container (max-width: 640px){
  .mv-root.mv-docked .mv-brand span{display:none}
  .mv-root.mv-docked .mv-brand{padding:6px 8px}
}
@container (max-width: 540px){
  .mv-root.mv-docked .mv-brand{display:none}
  .mv-root.mv-docked .mv-actions{justify-content:flex-end}
}
/* 320px-wide docks: drop the separators and extra padding so the action row
   wraps cleanly instead of overflowing the pane. */
@container (max-width: 420px){
  .mv-root.mv-docked .mv-top{left:12px;right:12px;gap:6px}
  .mv-root.mv-docked .mv-actions .mv-btn{padding:6px 7px}
  .mv-root.mv-docked .mv-actions .mv-sep{display:none}
  .mv-root.mv-docked .mv-actions .mv-btn.icon{padding:7px 6px}
  .mv-root.mv-docked .mv-layers{top:92px;right:12px;width:min(284px,calc(100% - 24px))}
  .mv-root.mv-docked .mv-right{top:92px;right:12px;width:min(300px,calc(100% - 24px));max-height:calc(100% - 236px)}
  .mv-root.mv-docked .mv-right .mv-layers{position:static;top:auto;right:auto;width:100%;max-height:none}
  .mv-root.mv-docked .mv-right .mv-analysis{max-width:100%}
  .mv-root.mv-docked .mv-shader{top:92px;left:12px;width:min(320px,calc(100% - 24px));max-height:calc(100% - 236px)}
}
/* Snapshot mode: the picture is meant to be clean, so every overlay is hidden. */
.mv-root.mv-capturing .mv-top,.mv-root.mv-capturing .mv-urlbar,.mv-root.mv-capturing .mv-right,.mv-root.mv-capturing .mv-shader,.mv-root.mv-capturing .mv-layers,.mv-root.mv-capturing .mv-analysis,.mv-root.mv-capturing .mv-hud,.mv-root.mv-capturing .mv-attr,.mv-root.mv-capturing .mv-credits,.mv-root.mv-capturing .mv-pick,.mv-root.mv-capturing .mv-measure,.mv-root.mv-capturing .mv-toast,.mv-root.mv-capturing .mv-select,.mv-root.mv-capturing .mv-sel-anchor,.mv-root.mv-capturing .mv-sel-hint,.mv-root.mv-capturing .mv-tour,.mv-root.mv-capturing .mv-overlay,.mv-root.mv-capturing .mv-modal{visibility:hidden!important}
.mv-about{display:flex;flex-direction:column;gap:12px;padding:2px 0;font-size:12px}
.mv-about .intro{margin:0;color:var(--mv-dim);line-height:1.75}
.mv-about .row{display:flex;gap:12px;align-items:baseline}
.mv-about .row .key{width:76px;flex:none;color:var(--mv-dim);font-size:11px}
.mv-about a{color:var(--mv-accent);text-decoration:none;word-break:break-all}
.mv-about a:hover{text-decoration:underline}
.mv-about .team{display:flex;flex-direction:column;gap:1px}
.mv-about .team small{color:var(--mv-dim);font-size:10.5px}
.mv-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border:.5px solid var(--mv-line);border-radius:9px;background:color-mix(in srgb,var(--mv-bg) 55%,transparent)}
.mv-toggle .text{display:flex;flex-direction:column;gap:2px;min-width:0}
.mv-toggle .text b{font-size:12px;font-weight:600}
.mv-toggle .text span{color:var(--mv-dim);font-size:10.5px;line-height:1.5}
.mv-toggle input{appearance:auto;width:15px;height:15px;flex:none;margin:0;cursor:pointer}
/* Local path authorisation dialog: narrower than the settings dialog, with
   labelled path rows so the user sees exactly which folder is granted. */
.mv-access{width:min(560px,94%)}
.mv-access-path{display:flex;flex-direction:column;gap:6px;border:.5px solid var(--mv-line);border-radius:9px;padding:9px 11px;background:color-mix(in srgb,var(--mv-bg) 42%,transparent)}
.mv-access-path .row{display:flex;gap:10px;align-items:baseline;min-width:0}
.mv-access-path .key{flex:none;width:54px;font-size:10.5px;color:var(--mv-dim)}
.mv-access-path code{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.55;color:var(--mv-text);word-break:break-all;user-select:text}
.mv-access .mv-note b{color:var(--mv-text);font-weight:600}
.mv-access .footer .right{margin-left:auto}
.mv-health{width:min(680px,94%)}
.mv-health-loading{display:flex;flex-direction:column;align-items:center;gap:12px;padding:18px 0}
.mv-health-rows{display:flex;flex-direction:column;gap:5px}
.mv-health-rows .row{display:flex;gap:10px;font-size:12px;line-height:1.5}
.mv-health-rows .key{width:112px;flex:none;color:var(--mv-dim);font-size:11px}
.mv-health-rows .value{min-width:0;word-break:break-all}
.mv-health-section{display:flex;flex-direction:column;gap:6px;border-top:.5px solid var(--mv-line);padding-top:8px}
.mv-health-section>b{font-size:12px}
.mv-health-runtime{font-size:11.5px;color:var(--mv-dim);line-height:1.6}
.mv-health .issues{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;max-height:220px;overflow:auto}
.mv-health .issues li{display:flex;gap:8px;align-items:baseline;font-size:11.5px;line-height:1.55}
.mv-health .issues .badge{flex:none;font-size:10px;padding:1px 6px;border-radius:999px;border:.5px solid var(--mv-line);color:var(--mv-dim)}
.mv-health .issues .lvl-error .badge{color:#ff8b8b;border-color:rgba(255,139,139,.45)}
.mv-health .issues .lvl-warn .badge{color:#ffc46b;border-color:rgba(255,196,107,.45)}
.mv-health .issues code{flex:none;color:var(--mv-accent);font-size:10.5px}
.mv-health .issues .msg{color:var(--mv-dim);word-break:break-word}
.mv-health-path{display:flex;align-items:center;gap:8px;border-top:.5px solid var(--mv-line);padding-top:8px;font-size:11px}
.mv-health-path .key{flex:none;color:var(--mv-dim)}
.mv-health-path code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mv-text);direction:rtl;text-align:left}
/* Narrow panes: keep the primary cursor/elevation readout on one line and drop
   secondary telemetry instead of letting every glyph wrap into a vertical column. */
@container (max-width: 560px){
  .mv-root.mv-docked .mv-hud .mv-hud-camera,.mv-root.mv-docked .mv-hud .mv-hud-heading{display:none}
  .mv-root.mv-docked .mv-hud .mv-hud-layer{display:none}
}
@container (max-width: 420px){
  .mv-root.mv-docked .mv-hud{padding:6px 9px;font-size:10.5px;gap:2px}
  .mv-root.mv-docked .mv-hud .mv-hud-fps{display:none}
}
@media (max-width: 760px){
  .mv-hud .mv-hud-camera,.mv-hud .mv-hud-heading,.mv-hud .mv-hud-layer{display:none}
}
@media (max-width: 480px){
  .mv-hud{padding:6px 9px;font-size:10.5px;gap:2px}
  .mv-hud .mv-hud-fps{display:none}
}
/* v1.7 P0 — the scene as an instrument: a restrained vignette instead of more
   chrome, a selection card with corner brackets, and the tour story bar. */
.mv-root::after{content:"";position:absolute;inset:0;z-index:3;pointer-events:none;background:radial-gradient(115% 115% at 50% 46%,rgba(3,7,13,0) 56%,rgba(3,7,13,.26) 100%)}
.mv-root[data-mv-theme="light"]::after{background:radial-gradient(115% 115% at 50% 46%,rgba(24,34,50,0) 58%,rgba(24,34,50,.10) 100%)}
.mv-root.mv-capturing::after{display:none}
.mv-sel-anchor{position:absolute;left:0;top:0;width:0;height:0;z-index:8;pointer-events:none}
.mv-sel-anchor .c{position:absolute;width:11px;height:11px;border:1.5px solid #7dd3fc;filter:drop-shadow(0 1px 3px rgba(0,0,0,.45))}
.mv-sel-anchor .c.tl{left:-26px;top:-26px;border-right:0;border-bottom:0}
.mv-sel-anchor .c.tr{left:15px;top:-26px;border-left:0;border-bottom:0}
.mv-sel-anchor .c.bl{left:-26px;top:15px;border-right:0;border-top:0}
.mv-sel-anchor .c.br{left:15px;top:15px;border-left:0;border-top:0}
.mv-sel-anchor .leader{position:absolute;left:0;top:14px;width:1px;height:52px;background:linear-gradient(180deg,rgba(125,211,252,.9),rgba(125,211,252,.02))}
.mv-sel-anchor .chip{position:absolute;left:8px;top:38px;padding:2px 6px;border-radius:5px;background:rgba(6,12,20,.78);color:#d8ecff;font:inherit;font-size:10.5px;font-variant-numeric:tabular-nums;white-space:nowrap;border:.5px solid rgba(125,211,252,.35)}
.mv-select{position:absolute;left:0;right:0;margin:0 auto;bottom:18px;z-index:12;width:min(340px,calc(100% - 20px));border-radius:12px;padding:11px 13px 12px;display:flex;flex-direction:column;gap:7px;animation:mv-fade .2s cubic-bezier(.16,1,.3,1)}
.mv-select header{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--mv-dim);font-size:10.5px;letter-spacing:.04em;text-transform:uppercase}
.mv-select h3{margin:0;font-size:13px;font-weight:600;line-height:1.35;color:var(--mv-text)}
.mv-select p{margin:0}
.mv-select .layer{font-size:11px;color:var(--mv-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-select .facts{display:flex;flex-direction:column;gap:4px;border-top:.5px solid var(--mv-line);border-bottom:.5px solid var(--mv-line);padding:7px 0}
.mv-select .fact{display:flex;align-items:baseline;gap:6px;font-size:11.5px}
.mv-select .fact .key{color:var(--mv-dim);flex:none}
.mv-select .fact b{font-weight:600;font-variant-numeric:tabular-nums}
.mv-select .fact em{flex:1;min-width:0;text-align:right;font-style:normal;font-size:10.5px;color:var(--mv-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-select .fact .mv-sel-conf{margin-left:auto;flex:none;font-size:9.5px;line-height:1;padding:2px 5px;border-radius:5px;border:1px solid color-mix(in srgb,currentColor 45%,transparent);background:color-mix(in srgb,currentColor 12%,transparent);white-space:nowrap}
.mv-sel-conf.high{color:#4ade80}
.mv-sel-conf.medium{color:#f0b84b}
.mv-sel-conf.low{color:#ff8b8b}
.mv-select .sampling{font-size:10px;color:var(--mv-dim);line-height:1.45}
.mv-select .footnote{margin:0;font-size:9.5px;line-height:1.45;color:color-mix(in srgb,var(--mv-dim) 78%,transparent)}
.mv-select .actions{display:flex;gap:6px;margin-top:2px}
.mv-select .actions .mv-cta{flex:1;padding:6px 8px;font-size:11.5px;white-space:nowrap}
.mv-select .actions .mv-cta:disabled{opacity:.5;cursor:default}
.mv-select-loading{flex-direction:row;align-items:center;gap:9px;font-size:11.5px;color:var(--mv-dim)}
.mv-select-loading .mv-spinner{width:14px;height:14px;border-width:2px}
.mv-select-error{font-size:11.5px;line-height:1.5;color:color-mix(in srgb,#ff8b8b 78%,var(--mv-text));border-left:2px solid #ff8b8b;padding-left:8px}
.mv-sel-hint{position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:62px;z-index:11;padding:6px 12px;border-radius:999px;font-size:11px;color:var(--mv-dim);pointer-events:none;white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis}
.mv-tour{position:absolute;left:0;right:0;margin:0 auto;bottom:18px;z-index:12;width:min(560px,calc(100% - 20px));border-radius:12px;padding:9px 12px 10px;display:flex;flex-direction:column;gap:6px;animation:mv-fade .2s cubic-bezier(.16,1,.3,1)}
.mv-tour-head{display:flex;align-items:center;gap:8px}
.mv-tour-head b{font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--mv-dim);text-transform:uppercase}
.mv-tour-progress{margin-left:auto;font-size:10.5px;color:var(--mv-dim);font-variant-numeric:tabular-nums}
.mv-tour-caption{margin:0;font-size:13px;line-height:1.5;color:var(--mv-text)}
.mv-tour-actions{display:flex;align-items:center;gap:6px}
.mv-tour-actions .mv-cta{flex:1;padding:6px 10px;font-size:11.5px}
.mv-tour-hint{margin:0;font-size:10px;color:var(--mv-dim)}
@keyframes mv-fade{from{opacity:0}to{opacity:1}}
.mv-group-actions{display:flex;gap:6px;flex:none}
.mv-bookmark{display:flex;flex-direction:column;gap:0}
.mv-caption{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:4px 7px;font:inherit;font-size:11px;margin:0 8px 4px;outline:none;min-width:0}
.mv-caption:focus{border-color:var(--mv-accent)}
.mv-caption::placeholder{color:color-mix(in srgb,var(--mv-dim) 70%,transparent)}
.mv-details{padding:2px 6px 6px;display:flex;flex-direction:column;gap:3px}
.mv-details .row{display:flex;gap:8px;align-items:baseline;font-size:10.5px;line-height:1.5;color:var(--mv-dim);flex-wrap:wrap}
.mv-details .row b{font-weight:600;color:var(--mv-text);max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-details .row span{font-variant-numeric:tabular-nums}
`;
var TOOL_CSS = `
.mv-toolrow{display:flex;align-items:center;min-width:0;height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px))}
.mv-toolrow .glyph{display:inline-flex;flex:none;align-items:center;justify-content:center;width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));margin-right:6px;color:inherit}
.mv-toolrow .glyph svg{width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}
.mv-toolrow .title{flex:none;color:inherit}
.mv-toolrow .sep{flex:none;width:2px;height:2px;margin:0 8px;border-radius:1px;background:var(--dsw-alias-label-caption,#a8adb5)}
.mv-toolrow .summary{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-toolrow[data-state="error"] .summary{color:var(--dsw-alias-state-error-primary,#e5484d)}
.mv-toolrow .open{appearance:none;flex:none;margin-left:8px;border:.5px solid var(--dsw-alias-border-l1,#d0d4da);border-radius:999px;background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-secondary,#5b6068);font:inherit;font-size:11px;line-height:16px;padding:2px 9px;cursor:pointer;opacity:.72;transition:opacity .1s,background .1s}
.mv-toolrow .open:hover,.mv-toolrow .open:focus-visible{opacity:1;background:var(--dsw-alias-interactive-bg-hover-solid,rgba(127,127,127,.16));color:var(--dsw-alias-label-primary,#0f1115)}
.mv-toolrow .open:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}
.mv-toolrow .thumb{flex:none;display:inline-flex;margin-left:8px;width:40px;height:24px;overflow:hidden;border-radius:4px;border:.5px solid var(--dsw-alias-border-l1,#d0d4da);background:var(--dsw-alias-bg-base,transparent)}
.mv-toolrow .thumb img{display:block;width:100%;height:100%;object-fit:cover}
`;

// src/client/ui/dialogs.js
var import_react5 = __toESM(require("react"), 1);
var h4 = import_react5.default.createElement;
var SOURCE_TYPES = {
  imagery: ["xyz", "arcgis", "wms"],
  terrain: ["arcgis", "cesium"]
};
var SOURCE_TYPE_KEY = {
  xyz: "settings.type.xyz",
  arcgis: "settings.type.arcgis",
  wms: "settings.type.wms",
  cesium: "settings.type.cesium"
};
var emptySource = (kind) => ({
  id: `${kind}-${Date.now().toString(36)}`,
  name: "",
  type: SOURCE_TYPES[kind][0],
  url: "",
  credit: ""
});
function SourceForm({ kind, source, onPickLocal, onChange, onCancel, t: t2 }) {
  const set = (patch) => onChange({ ...source, ...patch });
  const field = (label, input) => h4("div", { className: "mv-field" }, h4("label", null, label), input);
  const pickTiles = async () => {
    if (typeof onPickLocal !== "function") return;
    const url = await onPickLocal();
    if (url) set({ type: "xyz", url, maximumLevel: source.maximumLevel ?? 18 });
  };
  const text = (key, value, placeholder) => h4("input", {
    key,
    value: value ?? "",
    placeholder: placeholder ?? "",
    onChange: (event) => set({ [key]: event.target.value })
  });
  return h4(
    "div",
    { className: "mv-form" },
    h4(
      "div",
      { className: "grid" },
      field(t2("settings.field.name"), text("name")),
      field(
        t2("settings.field.type"),
        h4(
          "select",
          { value: source.type, onChange: (event) => set({ type: event.target.value }) },
          SOURCE_TYPES[kind].map((type) => h4("option", { key: type, value: type }, t2(SOURCE_TYPE_KEY[type])))
        )
      )
    ),
    field(t2("settings.field.url"), text("url", source.url, kind === "imagery" ? "https://…/{z}/{x}/{y}.png" : "https://…")),
    field(t2("settings.field.credit"), text("credit", source.credit)),
    kind === "imagery" && source.type === "xyz" ? h4(
      "div",
      { className: "grid" },
      field(
        t2("settings.field.maxLevel"),
        h4("input", {
          type: "number",
          min: 0,
          max: 25,
          value: source.maximumLevel ?? "",
          onChange: (event) => set({ maximumLevel: event.target.value === "" ? void 0 : Number(event.target.value) })
        })
      ),
      field(
        t2("settings.field.tilingScheme"),
        h4(
          "select",
          {
            value: source.tilingScheme ?? "web-mercator",
            onChange: (event) => set({ tilingScheme: event.target.value })
          },
          h4("option", { value: "web-mercator" }, t2("settings.tiling.webMercator")),
          h4("option", { value: "geographic" }, t2("settings.tiling.geographic"))
        )
      ),
      field(
        t2("settings.field.subdomains"),
        h4("input", {
          value: (source.subdomains ?? []).join(","),
          onChange: (event) => set({
            subdomains: event.target.value.split(",").map((item) => item.trim()).filter((item) => item !== "")
          })
        })
      )
    ) : null,
    kind === "imagery" && source.type === "xyz" ? h4(
      "div",
      { className: "grid" },
      h4(
        "div",
        { className: "mv-field check" },
        h4("input", {
          id: "mv-reverse-y",
          type: "checkbox",
          checked: source.reverseY === true,
          onChange: (event) => set({ reverseY: event.target.checked })
        }),
        h4("label", { htmlFor: "mv-reverse-y" }, t2("settings.field.tms"))
      ),
      h4(
        "div",
        { className: "mv-field" },
        h4(
          "button",
          { type: "button", className: "mv-cta", onClick: pickTiles },
          t2("settings.field.localTiles")
        )
      )
    ) : null,
    kind === "imagery" && source.type === "wms" ? field(t2("settings.field.layers"), text("layers", source.layers)) : null,
    kind === "terrain" ? h4(
      "div",
      { className: "grid" },
      h4(
        "div",
        { className: "mv-field check" },
        h4("input", {
          id: "mv-normals",
          type: "checkbox",
          checked: source.requestVertexNormals === true,
          onChange: (event) => set({ requestVertexNormals: event.target.checked })
        }),
        h4("label", { htmlFor: "mv-normals" }, t2("settings.field.normals"))
      ),
      h4(
        "div",
        { className: "mv-field check" },
        h4("input", {
          id: "mv-water",
          type: "checkbox",
          checked: source.requestWaterMask === true,
          onChange: (event) => set({ requestWaterMask: event.target.checked })
        }),
        h4("label", { htmlFor: "mv-water" }, t2("settings.field.waterMask"))
      )
    ) : null,
    h4(
      "div",
      { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } },
      h4("button", { type: "button", className: "mv-cta", onClick: onCancel }, t2("btn.cancel"))
    )
  );
}
function SourcesDialog({ config, defaults, environmentDark, themeMode, onPickLocal, onSave, onClose, messages, meta, bridgeOn, bridgeReload }) {
  const t2 = messages;
  const [draft, setDraft] = import_react5.default.useState(() => clone(config));
  const [tab, setTab] = import_react5.default.useState("imagery");
  const [editing, setEditing] = import_react5.default.useState(null);
  const field = (label, input) => h4("div", { className: "mv-field" }, h4("label", null, label), input);
  const [autoOpen, setAutoOpen] = import_react5.default.useState(readAutoOpen);
  const activeId = (kind) => kind === "imagery" ? draft.settings.imagery : draft.settings.terrain;
  import_react5.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const setSources = (kind, list) => setDraft((current) => ({ ...current, [kind]: list }));
  const selectSource = (kind, id) => setDraft((current) => ({
    ...current,
    settings: { ...current.settings, [kind]: id }
  }));
  const addSource = (kind) => {
    const source = emptySource(kind);
    setSources(kind, [...draft[kind], source]);
    setEditing({ kind, id: source.id });
  };
  const removeSource = (kind, id) => {
    setSources(
      kind,
      draft[kind].filter((item) => item.id !== id)
    );
    if (draft.settings[kind] === id) selectSource(kind, null);
    if (editing?.id === id) setEditing(null);
  };
  const updateSource = (kind, source) => setSources(
    kind,
    draft[kind].map((item) => item.id === source.id ? source : item)
  );
  const save = () => {
    for (const kind of ["imagery", "terrain"]) {
      if (draft[kind].some((source) => source.name.trim() === "" || source.url.trim() === "")) {
        window.alert(t2("settings.required"));
        return;
      }
    }
    onSave(draft);
  };
  const restore = () => {
    if (!window.confirm(t2("settings.restoreConfirm"))) return;
    setDraft(clone(defaults));
    setEditing(null);
  };
  const segments = [
    ["auto", "theme.auto"],
    ["light", "theme.light"],
    ["dark", "theme.dark"]
  ];
  const rowsFor = (kind) => draft[kind].map(
    (source) => editing?.kind === kind && editing.id === source.id ? h4(SourceForm, {
      key: source.id,
      kind,
      source,
      t: t2,
      onPickLocal,
      onChange: (next) => updateSource(kind, next),
      onCancel: () => setEditing(null)
    }) : h4(
      "div",
      { key: source.id, className: "mv-src" },
      h4("span", {
        className: `radio${activeId(kind) === source.id ? " on" : ""}`,
        role: "radio",
        "aria-checked": activeId(kind) === source.id,
        tabIndex: 0,
        onClick: () => selectSource(kind, activeId(kind) === source.id ? null : source.id),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") selectSource(kind, source.id);
        }
      }),
      h4(
        "div",
        { className: "meta" },
        h4("b", null, source.name),
        h4("span", null, source.url)
      ),
      h4("span", { className: "badge" }, t2(SOURCE_TYPE_KEY[source.type] ?? source.type)),
      h4(
        "button",
        {
          type: "button",
          className: "mv-icon-btn",
          title: t2("btn.edit"),
          onClick: () => setEditing({ kind, id: source.id })
        },
        "✎"
      ),
      h4(
        "button",
        {
          type: "button",
          className: "mv-icon-btn",
          title: t2("btn.delete"),
          onClick: () => {
            if (window.confirm(t2("settings.deleteConfirm", { name: source.name }))) removeSource(kind, source.id);
          }
        },
        "✕"
      )
    )
  );
  const appearance = h4(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "10px" } },
    h4("p", { className: "mv-note" }, t2("theme.appearanceHint")),
    h4(
      "div",
      { className: "mv-seg", role: "radiogroup" },
      segments.map(
        ([value, key]) => h4(
          "button",
          {
            key: value,
            type: "button",
            className: themeMode === value ? "on" : "",
            role: "radio",
            "aria-checked": themeMode === value,
            onClick: () => setDraft((current) => ({ ...current, settings: { ...current.settings, theme: value } }))
          },
          t2(key)
        )
      )
    ),
    h4("p", { className: "mv-note" }, `${t2("theme.auto")} · ${environmentDark ? t2("theme.dark") : t2("theme.light")}`),
    h4(
      "label",
      { className: "mv-toggle" },
      h4(
        "span",
        { className: "text" },
        h4("b", null, t2("settings.autoOpenPanel")),
        h4("span", null, t2("settings.autoOpenPanelHint"))
      ),
      h4("input", {
        type: "checkbox",
        checked: autoOpen,
        onChange: (event) => {
          setAutoOpen(event.target.checked);
          writeAutoOpen(event.target.checked);
        }
      })
    ),
    h4(
      "label",
      { className: "mv-toggle" },
      h4(
        "span",
        { className: "text" },
        h4("b", null, t2("settings.screenshotHud")),
        h4("span", null, t2("settings.screenshotHudHint"))
      ),
      h4("input", {
        type: "checkbox",
        checked: draft.settings.screenshotHud === true,
        onChange: (event) => setDraft((current) => ({
          ...current,
          settings: { ...current.settings, screenshotHud: event.target.checked }
        }))
      })
    ),
    field(
      t2("settings.quality"),
      h4(
        "select",
        {
          value: draft.settings.quality === "high" ? "high" : "balanced",
          onChange: (event) => setDraft((current) => ({
            ...current,
            settings: { ...current.settings, quality: event.target.value }
          }))
        },
        h4("option", { value: "balanced" }, t2("settings.qualityBalanced")),
        h4("option", { value: "high" }, t2("settings.qualityHigh"))
      )
    ),
    h4("p", { className: "mv-note" }, t2("settings.qualityHint")),
    h4(
      "label",
      { className: "mv-toggle" },
      h4(
        "span",
        { className: "text" },
        h4("b", null, t2("settings.terrainDepthTest")),
        h4("span", null, t2("settings.terrainDepthTestHint"))
      ),
      h4("input", {
        type: "checkbox",
        // Missing/false = off: underground content stays visible, matching the
        // Cesium default and the documented behaviour before v1.5.
        checked: draft.settings.terrainDepthTest === true,
        onChange: (event) => setDraft((current) => ({
          ...current,
          settings: { ...current.settings, terrainDepthTest: event.target.checked }
        }))
      })
    ),
    h4(
      "label",
      { className: "mv-toggle" },
      h4(
        "span",
        { className: "text" },
        h4("b", null, t2("settings.showLayers")),
        h4("span", null, t2("settings.showLayersHint"))
      ),
      h4("input", {
        type: "checkbox",
        checked: draft.settings.showLayers !== false,
        onChange: (event) => setDraft((current) => ({
          ...current,
          settings: { ...current.settings, showLayers: event.target.checked }
        }))
      })
    ),
    h4(
      "label",
      { className: "mv-toggle" },
      h4(
        "span",
        { className: "text" },
        h4("b", null, t2("settings.showHud")),
        h4("span", null, t2("settings.showHudHint"))
      ),
      h4("input", {
        type: "checkbox",
        checked: draft.settings.showHud !== false,
        onChange: (event) => setDraft((current) => ({
          ...current,
          settings: { ...current.settings, showHud: event.target.checked }
        }))
      })
    ),
    h4(
      "label",
      { className: "mv-toggle" },
      h4(
        "span",
        { className: "text" },
        h4("b", null, t2("settings.hudDetailed")),
        h4("span", null, t2("settings.hudDetailedHint"))
      ),
      h4("input", {
        type: "checkbox",
        // Off by default: the instrument keeps five numbers unless asked.
        checked: draft.settings.hudDetailed === true,
        onChange: (event) => setDraft((current) => ({
          ...current,
          settings: { ...current.settings, hudDetailed: event.target.checked }
        }))
      })
    )
  );
  const homepage = meta?.homepage ?? FALLBACK_ABOUT.homepage;
  const issuesUrl = meta?.issues ?? `${String(homepage).replace(/\/+$/, "")}/issues`;
  const teamUrl = meta?.team?.url ?? FALLBACK_ABOUT.teamUrl;
  const about = h4(
    "div",
    { className: "mv-about" },
    h4("p", { className: "intro" }, t2("about.intro")),
    h4(
      "div",
      { className: "row" },
      h4("span", { className: "key" }, t2("about.version")),
      h4("span", null, meta?.version ?? FALLBACK_ABOUT.version)
    ),
    h4(
      "div",
      { className: "row" },
      h4("span", { className: "key" }, t2("about.homepage")),
      h4("a", { href: homepage, target: "_blank", rel: "noopener noreferrer" }, homepage)
    ),
    h4(
      "div",
      { className: "row" },
      h4("span", { className: "key" }, t2("about.issues")),
      h4("a", { href: issuesUrl, target: "_blank", rel: "noopener noreferrer" }, "GitHub Issues")
    ),
    h4(
      "div",
      { className: "row" },
      h4("span", { className: "key" }, t2("about.team")),
      h4(
        "div",
        { className: "team" },
        h4("a", { href: teamUrl, target: "_blank", rel: "noopener noreferrer" }, meta?.team?.name ?? t2("about.teamName")),
        h4("small", null, teamUrl)
      )
    ),
    h4(
      "div",
      { className: "row" },
      h4("span", { className: "key" }, t2("about.agent")),
      h4("span", null, bridgeReload ? t2("about.agent.stale") : bridgeOn ? t2("about.agent.on") : t2("about.agent.off"))
    ),
    h4(
      "div",
      { className: "row" },
      h4("span", { className: "key" }, t2("about.licenseLabel")),
      h4("span", null, t2("about.license"))
    )
  );
  return h4(
    "div",
    { className: "mv-modal", onPointerDown: (event) => event.target === event.currentTarget && onClose() },
    h4(
      "div",
      { className: "mv-dialog", role: "dialog", "aria-modal": true },
      h4(
        "header",
        null,
        h4("b", null, t2("settings.title")),
        h4("button", { type: "button", className: "mv-icon-btn", onClick: onClose, title: t2("btn.close") }, "✕")
      ),
      h4(
        "div",
        { className: "mv-tabs" },
        [["imagery", "settings.tab.imagery"], ["terrain", "settings.tab.terrain"], ["appearance", "settings.tab.appearance"], ["about", "settings.tab.about"]].map(
          ([value, key]) => h4(
            "button",
            {
              key: value,
              type: "button",
              className: `mv-tab${tab === value ? " on" : ""}`,
              onClick: () => setTab(value)
            },
            t2(key)
          )
        )
      ),
      h4(
        "div",
        { className: "body" },
        tab === "about" ? about : tab === "appearance" ? appearance : h4(
          import_react5.default.Fragment,
          null,
          h4("p", { className: "mv-note" }, t2(tab === "imagery" ? "settings.imageryHint" : "settings.terrainHint")),
          rowsFor(tab),
          draft[tab].length === 0 && editing === null ? h4("p", { className: "mv-note" }, t2("settings.empty")) : null,
          h4(
            "div",
            { style: { display: "flex", justifyContent: "flex-start" } },
            h4("button", { type: "button", className: "mv-cta", onClick: () => addSource(tab) }, `+ ${t2("btn.add")}`)
          )
        )
      ),
      h4(
        "div",
        { className: "footer" },
        h4(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 } },
          h4("button", { type: "button", className: "mv-cta", onClick: restore }, t2("btn.restore"))
        ),
        h4(
          "div",
          { className: "right" },
          h4("button", { type: "button", className: "mv-cta", onClick: onClose }, t2("btn.cancel")),
          h4("button", { type: "button", className: "mv-cta primary", onClick: save }, t2("btn.save"))
        )
      )
    )
  );
}
function HealthDialog({ state, messages: t2, onClose, onCopy }) {
  const report = state?.report ?? null;
  const issues = Array.isArray(report?.issues) ? report.issues : [];
  const extensions = Array.isArray(report?.counts?.extensionsUsed) ? report.counts.extensionsUsed : [];
  const kind = report?.source?.kind === "remote" ? "health.kind.remote" : "health.kind.local";
  const rows = report ? [
    ["health.source", `${t2(kind)} · ${report.source?.label ?? t2("health.unknown")}`],
    ["health.assetVersion", report.asset?.version ?? t2("health.unknown")],
    ["health.tiles", String(report.counts?.tiles ?? 0)],
    ["health.contents", String(report.counts?.contents ?? 0)],
    ["health.depth", String(report.root?.depth ?? 0)],
    ["health.rootError", String(report.root?.geometricError ?? t2("health.unknown"))],
    ["health.extensions", extensions.length > 0 ? extensions.join(", ") : t2("health.unknown")]
  ] : [];
  const runtime = report?.runtime ?? null;
  const reportPath = state?.reportPath ?? report?.reportPath ?? "";
  const body = state?.loading ? h4(
    "div",
    { className: "mv-health-loading" },
    h4("div", { className: "mv-spinner" }),
    h4("p", { className: "mv-note" }, t2("health.loading"))
  ) : state?.error ? h4("p", { className: "mv-note" }, t2("health.failed", { message: state.error })) : report ? h4(
    "div",
    { className: "mv-health-body" },
    h4(
      "div",
      { className: "mv-health-rows" },
      rows.map(
        ([key, value]) => h4(
          "div",
          { className: "row", key },
          h4("span", { className: "key" }, t2(key)),
          h4("span", { className: "value" }, value)
        )
      )
    ),
    h4(
      "div",
      { className: "mv-health-section" },
      h4("b", null, `${t2("health.issues")} · ${issues.length}`),
      issues.length > 0 ? h4(
        "ul",
        { className: "issues" },
        issues.map(
          (issue, index) => h4(
            "li",
            { key: `${issue.code}-${index}`, className: `lvl-${issue.level}` },
            h4("span", { className: "badge" }, t2(`health.level.${issue.level}`)),
            h4("code", null, issue.code),
            h4("span", { className: "msg" }, issue.message)
          )
        )
      ) : h4("p", { className: "mv-note" }, t2("health.noIssues"))
    ),
    runtime ? h4(
      "div",
      { className: "mv-health-section" },
      h4("b", null, t2("health.runtime")),
      h4(
        "div",
        { className: "mv-health-runtime" },
        `${t2("hud.tiles")} ${runtime.tiles ?? 0} · ${t2("hud.pending")} ${runtime.pending ?? 0} · ${t2("hud.triangles")} ${runtime.triangles ?? 0}`
      )
    ) : null,
    h4(
      "div",
      { className: "mv-health-path" },
      h4("span", { className: "key" }, t2("health.reportPath")),
      h4("code", { title: reportPath }, reportPath || t2("health.unknown")),
      reportPath ? h4("button", { type: "button", className: "mv-cta", onClick: onCopy }, t2("health.copy")) : null
    )
  ) : null;
  return h4(
    "div",
    { className: "mv-modal", onPointerDown: (event) => event.target === event.currentTarget && onClose() },
    h4(
      "div",
      { className: "mv-dialog mv-health", role: "dialog", "aria-modal": true },
      h4(
        "header",
        null,
        h4("b", null, state?.layer ? `${t2("health.title")} · ${state.layer}` : t2("health.title")),
        h4("button", { type: "button", className: "mv-icon-btn", onClick: onClose, title: t2("btn.close") }, "✕")
      ),
      h4("div", { className: "body" }, body)
    )
  );
}
function PathAccessDialog({ request, busy, t: t2, onAllow, onDeny }) {
  const denyRef = import_react5.default.useRef(null);
  import_react5.default.useEffect(() => {
    denyRef.current?.focus?.();
  }, []);
  import_react5.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDeny();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDeny]);
  const action = request.request === "load" ? t2("access.request.load") : request.request === "inspect" ? t2("access.request.inspect") : t2("access.request.generic");
  const row = (key, value) => value ? h4("div", { key, className: "row" }, h4("span", { className: "key" }, t2(key)), h4("code", { title: value }, value)) : null;
  return h4(
    "div",
    { className: "mv-modal", onPointerDown: (event) => event.target === event.currentTarget && !busy && onDeny() },
    h4(
      "div",
      { className: "mv-dialog mv-access", role: "dialog", "aria-modal": true, "aria-labelledby": "mv-access-title" },
      h4(
        "header",
        null,
        h4("b", { id: "mv-access-title" }, `${t2("access.title")} · ${action}`),
        h4("button", { type: "button", className: "mv-icon-btn", onClick: onDeny, disabled: busy, title: t2("btn.close") }, "✕")
      ),
      h4(
        "div",
        { className: "body" },
        h4("p", { className: "mv-note" }, t2("access.body")),
        h4(
          "div",
          { className: "mv-access-path" },
          row("access.path", request.path),
          row("access.dir", request.directory),
          request.resolved ? row("access.target", request.target) : null
        ),
        request.kind === "missing" ? h4("p", { className: "mv-note" }, t2("access.missing")) : null,
        request.resolved ? h4("p", { className: "mv-note" }, t2("access.resolved")) : null
      ),
      h4(
        "div",
        { className: "footer" },
        h4(
          "div",
          { className: "right" },
          h4("button", { ref: denyRef, type: "button", className: "mv-cta", onClick: onDeny, disabled: busy }, t2("access.cancel")),
          h4(
            "button",
            { type: "button", className: "mv-cta primary", onClick: onAllow, disabled: busy },
            busy ? t2("access.allowing") : t2("access.allow")
          )
        )
      )
    )
  );
}

// src/client/ui/hud.js
var import_react6 = __toESM(require("react"), 1);
var h5 = import_react6.default.createElement;
function StatusHud({ fps, stats, viewerRef, cesiumRef, labels, readoutRef, detailed = false }) {
  const cursorRef = import_react6.default.useRef(null);
  import_react6.default.useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return void 0;
    const canvas = viewer.scene.canvas;
    const pointer = { x: 0, y: 0, inside: false, dirty: false, dragging: false };
    let settleTimer = 0;
    let shown = null;
    const paint = (value) => {
      if (value === shown) return;
      shown = value;
      if (cursorRef.current) cursorRef.current.textContent = value ?? t("hud.empty");
      if (readoutRef) readoutRef.current = value;
    };
    const sampleInto = (allowPickPosition) => {
      let next = null;
      if (pointer.inside) {
        const position = new Cesium.Cartesian2(pointer.x, pointer.y);
        const carto = sampleCursor(viewer, Cesium, position, { pickPosition: allowPickPosition === true });
        if (carto) next = formatCursor(Cesium, carto);
      }
      paint(next);
    };
    const clearSettle = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = 0;
    };
    const armSettle = () => {
      clearSettle();
      settleTimer = setTimeout(() => {
        settleTimer = 0;
        if (pointer.dragging) return;
        pointer.dirty = false;
        sampleInto(true);
      }, HUD_SETTLE_MS);
    };
    const onMove = (event) => {
      pointer.x = event.offsetX;
      pointer.y = event.offsetY;
      pointer.inside = true;
      pointer.dirty = true;
      if (!pointer.dragging) armSettle();
    };
    const onLeave = () => {
      pointer.inside = false;
      pointer.dirty = true;
      clearSettle();
    };
    const onPointerDown = () => {
      pointer.dragging = true;
      clearSettle();
    };
    const onPointerUp = () => {
      if (!pointer.dragging) return;
      pointer.dragging = false;
      pointer.dirty = true;
      armSettle();
    };
    canvas.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerleave", onLeave, { passive: true });
    canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    const timer = setInterval(() => {
      if (pointer.dragging || !pointer.dirty) return;
      pointer.dirty = false;
      sampleInto(false);
    }, HUD_SAMPLE_INTERVAL_MS);
    return () => {
      clearSettle();
      clearInterval(timer);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (readoutRef) readoutRef.current = null;
    };
  }, []);
  return h5(
    "div",
    { className: "mv-hud mv-glass" },
    h5(
      "div",
      { className: "row mv-hud-primary" },
      // fps is null while the scene is idle (no render pass for 2 s); a dash is
      // honest, a 0 would suggest the scene renders nothing while idling.
      h5("span", { className: "mv-hud-fps", title: t("hud.fpsTitle") }, "FPS ", h5("b", null, fps === null ? "—" : fps)),
      h5("span", { className: "mv-hud-cursor" }, `${labels.pointer} `, h5("b", { ref: cursorRef }, t("hud.empty"))),
      h5("span", { className: "mv-hud-camera" }, `${labels.camera} `, h5("b", null, stats.height)),
      detailed ? h5("span", { className: "mv-hud-heading" }, `${labels.heading} `, h5("b", null, `${stats.heading} / ${stats.pitch}`)) : null
    ),
    detailed ? (stats.layers ?? []).map(
      (row) => h5(
        "div",
        { key: row.id, className: "row mv-hud-layer" },
        h5("b", null, row.name),
        h5("span", null, `${labels.tiles} `, h5("b", null, formatCount(row.tiles))),
        h5("span", null, `${labels.pending} `, h5("b", null, formatCount(row.pending))),
        h5("span", null, `${labels.triangles} `, h5("b", null, formatCount(row.triangles))),
        h5("span", null, `${labels.cache} `, h5("b", null, formatBytes(row.memory)))
      )
    ) : null
  );
}

// src/client/ui/layers-panel.js
var import_react7 = __toESM(require("react"), 1);

// src/client/ui/workbench-wiring.js
function toggleShaderPreset(form, preset) {
  const current = Array.isArray(form.preset) ? form.preset : [form.preset];
  const next = current.includes(preset) ? current.filter((item) => item !== preset) : current.length >= 3 ? current : [...current, preset];
  if (next.length === 0) return form;
  return { ...form, preset: next.length === 1 ? next[0] : next };
}
function buildShaderFormArgs(form) {
  const selected = Array.isArray(form.preset) ? form.preset : [form.preset];
  const args = { action: "apply", preset: selected.length === 1 ? selected[0] : selected };
  if (form.layerId) args.layer = form.layerId;
  const readNumber = (key) => form[key] === "" ? void 0 : Number(form[key]);
  const has = (preset) => selected.includes(preset);
  if (has("height-false-color")) {
    const minimum = readNumber("minHeight");
    const maximum = readNumber("maxHeight");
    if (minimum !== void 0) args.min_height = minimum;
    if (maximum !== void 0) args.max_height = maximum;
  }
  if (has("contour")) {
    const interval = readNumber("interval");
    if (interval !== void 0) args.interval = interval;
  }
  if (has("scan") || has("water")) {
    const speed = readNumber("speed");
    if (speed !== void 0) args.speed = speed;
  }
  if (has("water")) {
    const amplitude = readNumber("amplitude");
    const opacity = readNumber("opacity");
    if (amplitude !== void 0) args.amplitude = amplitude;
    if (opacity !== void 0) args.opacity = opacity;
  }
  if (has("water-depth")) {
    const waterHeight = readNumber("waterHeight");
    const depthMax = readNumber("depthMax");
    if (waterHeight !== void 0) args.water_height = waterHeight;
    if (depthMax !== void 0) args.depth_max = depthMax;
  }
  return args;
}
function moveShaderPreset(form, preset, delta) {
  const current = Array.isArray(form.preset) ? [...form.preset] : [form.preset];
  const from = current.indexOf(preset);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= current.length) return form;
  current.splice(from, 1);
  current.splice(to, 0, preset);
  return { ...form, preset: current.length === 1 ? current[0] : current };
}
function resolveWorkbenchTarget(layers, form) {
  const list = Array.isArray(layers) ? layers : [];
  const explicit = form.layerId ? list.find((layer) => layer.id === form.layerId) ?? null : null;
  if (explicit) return { layer: explicit, auto: false };
  let gaussianOnly = false;
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const layer = list[index];
    if (!layer.visible) continue;
    if (shaderGaussianLayer(layer.tileset)) {
      gaussianOnly = true;
      continue;
    }
    return { layer, auto: true };
  }
  return { layer: null, auto: true, gaussianOnly };
}
var SHADER_PARAM_FORM_KEYS = {
  min_height: "minHeight",
  max_height: "maxHeight",
  interval: "interval",
  speed: "speed",
  amplitude: "amplitude",
  opacity: "opacity",
  water_height: "waterHeight",
  depth_max: "depthMax"
};
var SHADER_FORM_DEFAULTS = {
  layerId: "",
  preset: "height-false-color",
  minHeight: "",
  maxHeight: "",
  interval: "20",
  speed: "1",
  amplitude: "1",
  opacity: "0.75",
  waterHeight: "",
  depthMax: ""
};
function formFromShaderEntry(entry) {
  const selected = Array.isArray(entry?.preset) ? [...entry.preset] : entry?.preset ? [entry.preset] : [];
  const preset = selected.length > 0 ? selected.length === 1 ? selected[0] : selected : SHADER_FORM_DEFAULTS.preset;
  const form = { ...SHADER_FORM_DEFAULTS, layerId: typeof entry?.layerId === "string" ? entry.layerId : "", preset };
  for (const [param, key] of Object.entries(SHADER_PARAM_FORM_KEYS)) {
    const value = entry?.params?.[param];
    if (typeof value === "number" && Number.isFinite(value)) form[key] = String(value);
  }
  return form;
}
function shaderEntrySummary(t2, entry) {
  const presets = Array.isArray(entry?.preset) ? entry.preset : entry?.preset ? [entry.preset] : [];
  const parts = [];
  for (const [param, key] of Object.entries(SHADER_PARAM_FORM_KEYS)) {
    const value = entry?.params?.[param];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    parts.push(`${t2(`shader.param.${key}`)} ${value}`);
  }
  const presetText = presets.map((item) => t2(`shader.preset.${item}`)).join(" + ");
  return t2("shader.entryTooltip", {
    layer: entry?.layer ?? "",
    presets: presetText,
    params: parts.join(" · ") || t2("shader.entryNoParams")
  });
}
function shaderStackLabel(t2, preset) {
  return (Array.isArray(preset) ? preset : [preset]).map((item) => t2(`shader.preset.${item}`)).join(" + ");
}
function createWorkbenchWiring({ getForm, getLayers, setShaderForm, shaderCommand, showToast, t: t2, shaderCompare }) {
  const field = (key, value) => setShaderForm((form) => ({ ...form, [key]: value }));
  const formLayer = () => getLayers().find((layer) => layer.id === getForm().layerId) ?? null;
  const target = () => resolveWorkbenchTarget(getLayers(), getForm());
  let applyTimer = null;
  let applying = false;
  let queued = false;
  let lastSilentError = "";
  const runApply = async (silent) => {
    try {
      const result = await shaderCommand(buildShaderFormArgs(getForm()));
      if (!silent) showToast(t2("toast.shaderApplied", { preset: shaderStackLabel(t2, result.preset), layer: result.layer }));
      lastSilentError = "";
      return result;
    } catch (error) {
      const text = messageOf(error);
      if (!silent || text !== lastSilentError) showToast(text);
      lastSilentError = silent ? text : "";
      return null;
    }
  };
  return {
    /** Set one form field (layerId / numeric inputs). */
    field,
    /** Toggle a preset chip in the stack. */
    toggle: (preset) => setShaderForm((form) => toggleShaderPreset(form, preset)),
    /** Reorder one preset inside the stack (the array order is the compose order). */
    move: (preset, delta) => setShaderForm((form) => moveShaderPreset(form, preset, delta)),
    /** The layer the card should show under "automatic selection". */
    target,
    /** Load an applied shader row into the form (edit-in-place). */
    loadEntry: (entry) => setShaderForm(formFromShaderEntry(entry)),
    /** Reset one specific layer's shader (used by the layer-panel row ✕). */
    async resetLayerFor(token) {
      try {
        const result = await shaderCommand({ action: "reset", layer: token });
        showToast(result.layer ? t2("toast.shaderReset", { layer: result.layer }) : t2("toast.shaderResetAll"));
      } catch (error) {
        showToast(messageOf(error));
      }
    },
    /** Debounced silent apply for slider previews; repeated calls merge into one. */
    preview: () => {
      if (applyTimer !== null) clearTimeout(applyTimer);
      applyTimer = setTimeout(() => {
        applyTimer = null;
        void applyInternal(true);
      }, 180);
    },
    async apply() {
      if (applyTimer !== null) {
        clearTimeout(applyTimer);
        applyTimer = null;
      }
      await applyInternal(false);
    },
    /** Hold/release the original-look comparison. Closes itself if it cannot run. */
    async compare(enabled) {
      try {
        const resolved = target();
        if (!resolved.layer) {
          showToast(t2("shader.noLayers"));
          return null;
        }
        return await shaderCompare(resolved.layer.id, enabled);
      } catch (error) {
        showToast(messageOf(error));
        return null;
      }
    },
    async resetLayer() {
      try {
        const visible = getLayers().filter((layer) => layer.visible);
        const resolved = target().layer ?? formLayer() ?? visible[visible.length - 1] ?? null;
        if (!resolved) {
          showToast(t2("shader.noLayers"));
          return;
        }
        const result = await shaderCommand({ action: "reset", layer: resolved.id });
        showToast(result.layer ? t2("toast.shaderReset", { layer: result.layer }) : t2("toast.shaderResetAll"));
      } catch (error) {
        showToast(messageOf(error));
      }
    },
    async resetAll() {
      try {
        await shaderCommand({ action: "reset" });
        showToast(t2("toast.shaderResetAll"));
      } catch (error) {
        showToast(messageOf(error));
      }
    }
  };
  async function applyInternal(silent) {
    if (applying) {
      queued = true;
      return;
    }
    applying = true;
    try {
      await runApply(silent);
    } finally {
      applying = false;
    }
    if (queued) {
      queued = false;
      await applyInternal(silent);
    }
  }
}
function messageOf(error) {
  return error && typeof error.message === "string" && error.message !== "" ? error.message : String(error);
}

// src/client/ui/layers-panel.js
var h6 = import_react7.default.createElement;
var OVERLAY_TYPES2 = ["wms", "xyz", "arcgis"];
function LayersPanel({
  t: t2,
  config,
  settings,
  layers,
  annotations,
  onCollapse,
  onSelectTerrain,
  onSelectImagery,
  terrainError,
  onRetryTerrain,
  onFlyLayer,
  onFrameAll,
  onToggleLayer,
  onInspectLayer,
  onRemoveLayer,
  onOverlayAdd,
  onOverlayRemove,
  onOverlayOpacity,
  onOverlayVisible,
  onOverlayMove,
  onClearVector,
  agentOverlays,
  onRemoveAgentOverlay,
  analysis,
  onClearAnalysis,
  shaderActive,
  onEditLayerShader,
  getCurrentView,
  onFlyView,
  stats,
  onStartTour
}) {
  const [adding, setAdding] = import_react7.default.useState(false);
  const [draft, setDraft] = import_react7.default.useState({ type: "wms", name: "", url: "", layers: "", opacity: 0.7 });
  const [error, setError] = import_react7.default.useState("");
  const [bookmarks, setBookmarks] = import_react7.default.useState(() => loadBookmarks());
  const [bookmarkNotice, setBookmarkNotice] = import_react7.default.useState("");
  const sourceName = (list, id) => list?.find((item) => item.id === id)?.name ?? null;
  const terrainActive = sourceName(config?.terrain, settings?.terrain);
  const imageryActive = sourceName(config?.imagery, settings?.imagery);
  const overlays = Array.isArray(config?.rasterOverlays) ? config.rasterOverlays : [];
  const drawn = annotations?.drawn_features ?? 0;
  const measured = annotations?.measured_points ?? 0;
  const radioRow = (key, label, active, onClick) => h6(
    "button",
    {
      key,
      type: "button",
      className: `mv-layer mv-choice${active ? " on" : ""}`,
      "aria-pressed": active,
      onClick
    },
    h6("span", { className: "name" }, label),
    h6("span", { className: "tick", "aria-hidden": true }, active ? "✓" : "")
  );
  const submitDraft = () => {
    const next = normalizeOverlayDraft(draft);
    if (next === null) {
      setError(t2("layers.overlayInvalid"));
      return;
    }
    onOverlayAdd(next);
    setAdding(false);
    setError("");
    setDraft({ type: "wms", name: "", url: "", layers: "", opacity: 0.7 });
  };
  const field = (label, input) => h6("div", { className: "mv-field" }, h6("label", null, label), input);
  const saveCurrentBookmark = () => {
    const view = typeof getCurrentView === "function" ? getCurrentView() : null;
    if (!view) {
      setBookmarkNotice(t2("bookmarks.noView"));
      return;
    }
    const result = addBookmark(bookmarks, view, null);
    if (!result.bookmark) return;
    setBookmarks(result.list);
    setBookmarkNotice(saveBookmarks(result.list) ? "" : t2("bookmarks.saveFailed"));
  };
  const deleteBookmark = (id) => {
    const next = removeBookmark(bookmarks, id);
    setBookmarks(next);
    saveBookmarks(next);
  };
  const setCaption = (id, value) => {
    const next = updateBookmarkCaption(bookmarks, id, value);
    setBookmarks(next);
    saveBookmarks(next);
  };
  return h6(
    "div",
    { className: "mv-layers mv-glass" },
    h6(
      "header",
      null,
      h6("span", null, t2("layers.title")),
      h6(
        "div",
        { className: "mv-head-actions" },
        layers.length > 0 ? h6("button", { type: "button", className: "mv-icon-btn", title: t2("layers.frameAll"), "aria-label": t2("layers.frameAll"), onClick: onFrameAll }, "⛶") : null,
        h6(
          "button",
          { type: "button", className: "mv-icon-btn", title: t2("layers.collapse"), "aria-label": t2("layers.collapse"), onClick: onCollapse },
          "✕"
        )
      )
    ),
    h6(
      "div",
      { className: "mv-layer-list" },
      // ---- L1 terrain --------------------------------------------------------
      h6("div", { key: "g1", className: "mv-group" }, h6("div", { className: "mv-group-title" }, t2("layers.terrain"))),
      radioRow("t-off", t2("menu.terrainOff"), terrainActive === null, () => onSelectTerrain(null)),
      ...(config?.terrain ?? []).map(
        (source) => radioRow(`t-${source.id}`, source.name, settings?.terrain === source.id, () => onSelectTerrain(source.id))
      ),
      terrainError ? h6(
        "div",
        { key: "terrain-error", className: "mv-none mv-terrain-error" },
        h6("span", null, terrainError),
        h6("button", { type: "button", className: "mv-icon-btn", title: t2("terrain.retry"), "aria-label": t2("terrain.retry"), onClick: onRetryTerrain }, "↻")
      ) : null,
      // ---- L2 imagery basemap ------------------------------------------------
      h6("div", { key: "g2", className: "mv-group" }, h6("div", { className: "mv-group-title" }, t2("layers.imagery"))),
      radioRow("i-off", t2("menu.none"), imageryActive === null, () => onSelectImagery(null)),
      ...(config?.imagery ?? []).map(
        (source) => radioRow(`i-${source.id}`, source.name, settings?.imagery === source.id, () => onSelectImagery(source.id))
      ),
      // ---- L3 raster overlays ------------------------------------------------
      h6(
        "div",
        { key: "g3", className: "mv-group" },
        h6("div", { className: "mv-group-title" }, `${t2("layers.raster")}${overlays.length ? ` · ${overlays.length}` : ""}`),
        h6(
          "button",
          { type: "button", className: "mv-cta", onClick: () => setAdding((value) => !value) },
          adding ? t2("layers.overlayCancel") : t2("layers.addOverlay")
        )
      ),
      adding ? h6(
        "div",
        { key: "add-form", className: "mv-overlay-form" },
        field(
          t2("layers.overlayType"),
          h6(
            "select",
            { value: draft.type, onChange: (event) => setDraft((current) => ({ ...current, type: event.target.value })) },
            OVERLAY_TYPES2.map((type) => h6("option", { key: type, value: type }, type.toUpperCase()))
          )
        ),
        field(t2("layers.overlayName"), h6("input", { value: draft.name, onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })) })),
        field(t2("layers.overlayUrl"), h6("input", { value: draft.url, placeholder: "https://…", onChange: (event) => setDraft((current) => ({ ...current, url: event.target.value })) })),
        draft.type === "wms" ? field(t2("layers.overlayLayers"), h6("input", { value: draft.layers, placeholder: "flood:risk", onChange: (event) => setDraft((current) => ({ ...current, layers: event.target.value })) })) : null,
        field(
          t2("layers.overlayOpacity"),
          h6("input", {
            type: "range",
            min: 0,
            max: 100,
            value: Math.round(draft.opacity * 100),
            onChange: (event) => setDraft((current) => ({ ...current, opacity: Number(event.target.value) / 100 }))
          })
        ),
        error ? h6("p", { className: "mv-note" }, error) : null,
        h6("button", { type: "button", className: "mv-cta primary", onClick: submitDraft }, t2("layers.overlayAdd"))
      ) : null,
      overlays.length === 0 && !adding ? h6("div", { key: "no-overlay", className: "mv-none" }, t2("layers.emptyRaster")) : overlays.map(
        (overlay, index) => h6(
          "div",
          { key: overlay.id, className: `mv-layer mv-overlay-row${overlay.visible === false ? " off" : ""}` },
          h6("span", { className: "name", title: overlay.url }, overlay.name),
          h6("input", {
            className: "mv-opacity",
            type: "range",
            min: 0,
            max: 100,
            title: t2("layers.overlayOpacity"),
            "aria-label": t2("layers.overlayOpacity"),
            value: Math.round((overlay.opacity ?? 1) * 100),
            onChange: (event) => onOverlayOpacity(overlay.id, Number(event.target.value) / 100)
          }),
          h6("button", {
            type: "button",
            className: `mv-icon-btn${overlay.visible === false ? " on" : ""}`,
            title: overlay.visible === false ? t2("btn.hidden") : t2("btn.visible"),
            onClick: () => onOverlayVisible(overlay.id, overlay.visible === false)
          }, overlay.visible === false ? "◌" : "◉"),
          h6("button", { type: "button", className: "mv-icon-btn", title: t2("layers.overlayDown"), disabled: index === 0, onClick: () => onOverlayMove(overlay.id, -1) }, "↑"),
          h6("button", { type: "button", className: "mv-icon-btn", title: t2("layers.overlayUp"), disabled: index === overlays.length - 1, onClick: () => onOverlayMove(overlay.id, 1) }, "↓"),
          h6("button", { type: "button", className: "mv-icon-btn", title: t2("layers.overlayRemove"), onClick: () => onOverlayRemove(overlay.id) }, "✕")
        )
      ),
      // ---- L4 vector overlays ------------------------------------------------
      h6("div", { key: "g4", className: "mv-group" }, h6("div", { className: "mv-group-title" }, t2("layers.vector"))),
      h6(
        "div",
        { key: "vector-row", className: "mv-layer" },
        h6("span", { className: "name" }, `${t2("layers.vectorDrawn")} ${drawn} · ${t2("layers.vectorMeasured")} ${measured}`),
        h6("button", { type: "button", className: "mv-icon-btn", title: t2("tool.clear"), onClick: onClearVector }, "✕")
      ),
      ...(Array.isArray(agentOverlays) ? agentOverlays : []).map(
        (row) => h6(
          "div",
          { key: row.id, className: "mv-layer" },
          h6("span", { className: "name", title: row.detail }, `${row.label} · ${row.detail}`),
          h6(
            "button",
            { type: "button", className: "mv-icon-btn", title: t2("layers.vectorRemove"), onClick: () => onRemoveAgentOverlay(row.kind, row.index) },
            "✕"
          )
        )
      ),
      // ---- analysis (Agent-driven; the panel owns the entry + the clear) ------
      h6("div", { key: "g5", className: "mv-group" }, h6("div", { className: "mv-group-title" }, t2("layers.analysis"))),
      analysis ? h6(
        "div",
        { key: "analysis-row", className: "mv-layer" },
        h6(
          "span",
          { className: "name" },
          `${analysis.operation ?? t2("layers.analysis")}${typeof analysis.layer === "string" && analysis.layer !== "" ? ` · ${analysis.layer}` : ""}`
        ),
        h6("button", { type: "button", className: "mv-icon-btn", title: t2("layers.analysisClear"), onClick: onClearAnalysis }, "✕")
      ) : h6("div", { key: "analysis-hint", className: "mv-none" }, t2("layers.analysisHint")),
      // ---- camera bookmarks (client-only, localStorage) ----------------------
      h6(
        "div",
        { key: "g6b", className: "mv-group" },
        h6("div", { className: "mv-group-title" }, `${t2("bookmarks.title")}${bookmarks.length > 0 ? ` · ${bookmarks.length}` : ""}`),
        h6(
          "div",
          { className: "mv-group-actions" },
          h6("button", { type: "button", className: "mv-cta", onClick: saveCurrentBookmark }, t2("bookmarks.save")),
          h6(
            "button",
            {
              type: "button",
              className: "mv-cta",
              disabled: bookmarks.length < 2,
              title: bookmarks.length < 2 ? t2("tour.needStops") : t2("tour.start"),
              onClick: () => {
                if (typeof onStartTour === "function") onStartTour(bookmarks);
              }
            },
            t2("tour.start")
          )
        )
      ),
      bookmarkNotice !== "" ? h6("div", { key: "bm-notice", className: "mv-none" }, bookmarkNotice) : null,
      bookmarks.length === 0 ? h6("div", { key: "bm-empty", className: "mv-none" }, t2("bookmarks.empty")) : bookmarks.map(
        (item) => h6(
          "div",
          { key: item.id, className: "mv-bookmark" },
          h6(
            "div",
            { className: "mv-layer" },
            h6("span", { className: "name", title: t2("bookmarks.flyHint"), onClick: () => onFlyView(item.view) }, item.name),
            h6("button", { type: "button", className: "mv-icon-btn", title: t2("bookmarks.remove"), onClick: () => deleteBookmark(item.id) }, "✕")
          ),
          h6("input", {
            className: "mv-caption",
            value: item.caption ?? "",
            placeholder: t2("bookmarks.captionPlaceholder"),
            title: t2("bookmarks.captionPlaceholder"),
            maxLength: 120,
            onChange: (event) => setCaption(item.id, event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }
          })
        )
      ),
      // ---- 3D Tiles content --------------------------------------------------
      h6("div", { key: "g6", className: "mv-group" }, h6("div", { className: "mv-group-title" }, `${t2("layers.content")} · ${layers.length}`)),
      ...layers.map((layer) => {
        const shader = (shaderActive ?? []).find(
          (entry) => entry.layerId === layer.id || entry.layerId === void 0 && entry.layer === layer.name
        ) ?? null;
        const summary = shader ? shaderEntrySummary(t2, shader) : "";
        const openShader = () => onEditLayerShader(layer, shader);
        const stop = (event) => event.stopPropagation();
        return h6(
          "div",
          {
            key: layer.id,
            className: `mv-layer${layer.visible ? "" : " off"}${shader ? " has-shader" : ""}`,
            title: shader ? `${layer.name} — ${summary}` : layer.name,
            ...shader ? {
              role: "button",
              tabIndex: 0,
              onClick: openShader,
              onKeyDown: (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openShader();
                }
              }
            } : {}
          },
          h6(
            "span",
            {
              className: "name",
              title: layer.name,
              onClick: (event) => {
                stop(event);
                onFlyLayer(layer.id);
              }
            },
            layer.name
          ),
          shader ? h6(
            "button",
            {
              type: "button",
              className: "mv-icon-btn mv-shader-edit",
              title: `${t2("shader.editEntry")} · ${summary}`,
              "aria-label": t2("shader.editEntry"),
              onClick: (event) => {
                stop(event);
                openShader();
              }
            },
            "✦"
          ) : null,
          h6("button", { type: "button", className: `mv-icon-btn${layer.visible ? "" : " on"}`, title: layer.visible ? t2("btn.visible") : t2("btn.hidden"), onClick: (event) => {
            stop(event);
            onToggleLayer(layer.id);
          } }, layer.visible ? "◉" : "◌"),
          h6("button", { type: "button", className: "mv-icon-btn", title: t2("btn.flyTo"), "aria-label": t2("btn.flyTo"), onClick: (event) => {
            stop(event);
            onFlyLayer(layer.id);
          } }, "⌖"),
          h6("button", { type: "button", className: "mv-icon-btn", title: t2("btn.health"), "aria-label": t2("btn.health"), onClick: (event) => {
            stop(event);
            onInspectLayer(layer.id);
          } }, "⌕"),
          h6("button", { type: "button", className: "mv-icon-btn", title: t2("btn.delete"), "aria-label": t2("btn.delete"), onClick: (event) => {
            stop(event);
            onRemoveLayer(layer.id);
          } }, "✕")
        );
      }),
      // ---- technical telemetry ----------------------------------------------
      // v1.7 P0: heading / pitch and the per-layer counters left the HUD so the
      // instrument keeps at most six numbers; they still have a home here.
      h6("div", { key: "g7", className: "mv-group" }, h6("div", { className: "mv-group-title" }, t2("layers.details"))),
      h6(
        "div",
        { key: "details", className: "mv-details" },
        h6(
          "div",
          { className: "row" },
          h6("span", null, `${t2("hud.camera")} ${stats?.height ?? "—"}`),
          h6("span", null, `${t2("hud.heading")} ${stats?.heading ?? "—"} / ${stats?.pitch ?? "—"}`)
        ),
        ...(Array.isArray(stats?.layers) ? stats.layers : []).map(
          (row) => h6(
            "div",
            { key: `d-${row.id}`, className: "row" },
            h6("b", null, row.name),
            h6(
              "span",
              null,
              `${t2("hud.tiles")} ${formatCount(row.tiles)} · ${t2("hud.pending")} ${formatCount(row.pending)} · ${t2("hud.triangles")} ${formatCount(row.triangles)} · ${t2("hud.cache")} ${formatBytes(row.memory)}`
            )
          )
        )
      )
    )
  );
}

// src/client/ui/loading-globe.js
var import_react8 = __toESM(require("react"), 1);

// src/client/ui/earth-mask.js
var EARTH_MASK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAEACAYAAADFkM5nAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAABUQSURBVHhe7dmLjuW2siDR8/8/PQPbt+zqSD1I8U1GAAuNm5uiKO2qds+c//3vf//7f5Ik6ThhIEmS9hcGkiRpf2EgSZL2FwaSJGl/YSBJkvYXBpIkaX9hIEmS9hcGkiRpf2EgSZL2FwaSJGl/YSBluYprJEnTCQMpWU68dga94v14DkkaIAykJCnxmhZWjc8hSZ2FgfSv3/+xuovXtNAr3leSNhYG0r/e4voWWsZ7SdJBwkD6w+//UI76j+dTXPu2/ne8TpIOEgbSEp7+A87/wF/937xGkg4TBtJ2+A8ASVIcSEv7+Q89/1/8/gNAqustrtd0wkBa2lNcK+mb0rifhggDaQtXcY10ulHxHBoiDJTJH+j53MV10qlGxDNouDBQhre4Xn0xfi6dYrZ4Pg0RBsrw1NVaztQW4+fSF6v8LO0Qn+nu+fiZkoSBMqX88L3F9Tl7t/IU185s1XNLX50c34UehYE6SonX9JASr5kZ4+fSSIyf362z+/juUuXG6xcTBuooJ17b2l1ctwLGz6VR7kpdZ8/xPf68y17vlPf+ff8JhEFTJXGvWXw925e4x8xmOu+q7/AUT3Htbu5KWWNrx5+FAcKgup7x3iUYP+cafpbi7vqnuEeq0utzMX7e21Vco7ZqxD1Xd1fKGtsv/nw0FgbVWIzvqBfGz+/krqe7uK4Xxs9VX894756+9HRdjf3Nnmr6D4C/WIzv6M3X6672YFx3dw0/y3EX17VyFdeojZHxLF+MbKaz2J49/lTxB7DU7u34nPwOSzB+XttdXKf6Zopno5mb/Xy2dv/+/wA8xV+Yr3Zut2fl89TUev8fd3Gd6pkxnnH285r1qsn/BGBr9fOd8Xus4SmubeEurlO53Equ/YlnuGNmsSb/APiLrRG/t9re4voWruKakZ7i2lnlVnr977gXmdl1zf4BQDZn/J5auoprWmL8fCTGz2f1pRp7mFl+/N3zHwCHxu+nF8bPexl57x18rdY+ZpYff/+a/wPA5orfj5TrSzX2MLPv8Xfw/4RBNTZP/G6kXF/jPiV7mVl6/L27EAbV2Dzxu2lp1H3VRmnc7+ueJdeazRR/H6gk7vUiDKqqEfdMYf/Fd9PKW1yv+dWIe37d/8s1ZrPF34E7ufH6RGHQxJe4R4mT47toITVep7mVxv2emO0ef+YnEAZNpcbrajoxvoPacuK1mldp3O+J2ezxZ3YDYdAV4+etnRSfvabceL3mVRL3umM2a/xZ3UwYHOek+Ow11Yx7a05vcf0Vsxnjz2lLV3FNI2FwpJPis9dSO+6vb1q/07u4LuUasxniz2sLb3F9I2FwtJPis5dqEe+hPFdxTam7uC7lGrOR8ee0lZR4TSNhoMQvaLf4DnK1ivdRuqu45ounuPaK2WzxZ7Slt7i+oTBQwhd0Qnwnd3rEeyrdVVyT4ymuvWI2Y/w5bekprm0sDPR/7L/4bka8J95Xf2Jvn/8V17xJ6cs1ZqPjz21LT3FtY2GgX+y/+G5meD88z6mu+rLmjtkp8We/hau4ppMwENh/zfZueJ5TXfX2+U/cK+UasxP6/bvA348SV/cYJAx0wf5ptvfC85zs6b28xfUp15jtHn8X+DtSovZ+H4WBbth88TvStbdy1pqdEn8n+Hu1gTDQAxsbvw+lu+pubmb+A0AXrH58x+rLzP7s6veDvzcbCAMlsLrx/b4puVZ/MrPY1e8If3c2EAbKYPXiu71zFdcoMrO07n53ON9AGCjDDvGZRj4Xz3HlKq5RZGZp8XdnY2GgDKvH5xn5bLy/2jCz+/j7srkwUIYd4jONfD7eX/WZ2X38fdlcGCjDrvE5Rzwv7616Vu7p/E+fpcZ3tcM7s/T4vW8uDJThhEY9M++relrUat+/4vmvnuNunhP3L93P1orf+wHCQBlOqeUz852qvdr12jvHl7jH131snfh9U87aBYWBMuzW3TPVfGa+Q/X3padra+x/F/fOkROv/bKHrRW/6yuMny8uDJRht1o/F9+f6qoR9+I9+PnvuOZuXWrc66vUeF3u9TZ/P98nv+M7jJ8vLgyUwdLju1N9pXG/N4yf361LjfuUSInX5F5vc8bvMlfNvSYTBspgafG9qb4acc8UjJ8/rU2Je3yVGq/7sofNEb8/BWGgDPYe35naKIl7ffW235dy9uDalGuu4vVf97Fx8bvTpTBQBnuO70vtfIl71PC0/1Upa3rHM810NnuP35tuhYEy2H18V2rrS9yjhqf9GT+/W9c7nmems50Yv4O374Nrvqi518TCQBnsOr4ntfcl7tFD6v1HxrPMcq7T4ru/w/j5F7X3m1QYKJP9Gd+P+vgS9+gl5Qwj41lmONOp8Tu4chXX5GD8fCNhoA/sn/he1E9OvLa3lHOMjGeZ4Uz2T/xOnr4brklVY49FhIE+sH/ie1Ffb3F9rlr7pBrdTGexf+LPyNN3xM+fXMU1GwoDfWRH/MIsI+U7KYl7jWLnxO+eGD+/cxfXbSgMVODk+C40v9K43yi2f/zO7+RecxfXbSoMVOjE+A40Xut4v9Fs3/hdl3iL6zcXBqrgpPjsGq9HvOdotnf8vr+4i+sOEgaqaOf4rBqvd7z/KHZG/N5VLAxU2Y7xGTXe6HienuyM+L2rWBiogZ3is2kOs8RzEePnueys+P2rSBiokR3iM2keM8Wz5Z6R192x8+LPgIqEgTqYrdQz8Tk0B7NT4s++ioSBOpkhnulK7nr1Z3Xync4ff/ZVJAzUSY94z69a7Kk6rF6+27nj96NiYaAOesR7lmi1r8pY3fh+fcdzxe9GxcJAHfAHukW8Z6mWeyuftfn94Xuuvb99i9+JqggDDVA77l9D6/2Vxv6r1XvhO29xD8uL34WqCAMNVCvuW0vr/fXM/qzl++HeT6xtfN+qJgw0WI24p/ZgsZbvh+//jbWJ71nVhIEmUBr30/rsupbviXvXZu/xnamqMNAkSuJeWp/d1/Jdce/f+3Oey+7ju1ITYaCJfIl7aH32HN/XiHfG+6eyGN+RmgkDTSY3Xq+1WVp8byPeHe+fyv6L70ZNhYEmlBOvbaHnvU5n6Y1+d7x/qhGNvv9PfBfqKgw0oZx4bQu973cqy2v0++P9c/SK9219/7u9eX8NEQaaVE689g7j5ymu4hp9Z+nx3fV8f7xvqRbxHlS7q/0501BhoEnlxGuvXMU1KUqu1TvLi++vxzvk/WqoHfe/UyvuqymFgSaWE69924PrariKa/TM8uL7a/0Oea9aasV939SIe2paYaDJ5ZRzLdfWcBXX6Jnlx3fY6j3yHrWVxv1S1Yh7akphoIXUjHtrDvYtvsfa75J7t1AS98pRK+5bqsWehwsDLaZW3FdzsG/xPdZ6l9yzpa9xn1y14r6lWux5uDDQgmrFfTWWlVXzfXKvXnLitV9xz5K491ct9lQcaGE1497qz8qq9T65T28p8ZpS3LMk7v1F7f30tzDQxnLj9erLyit5p7x2lJR4TQslca8vau6lv4WBNpcbr1c/Vqecd8rvYAZvcX0rJXGvL2rto3+FgQ70FNeqH6vb03vlu5/JW1zfSkncS1MIAx3sLq5TH1a3q/fKdz6jt7i+Fd4zJ+6lKYSBDnYV16gvqx/f8Qqe4tpWru6XGvfSFMJAh7uKa3LV2udEVj++4xU8xbWt3N0vJV6jKYSBxN/d8PmT1Hidnln/+B2MdhfXjXAX12kqYSD97csvca24r/5h/eN3MNJVXDMS4+c1td7/EGEg/SHnF6123P901je+/xkwfn6K05+/kjCQLr39srWM9zqV9Y3vfxYjzzfqvvQ7fqZkYSBl6RnvfSLrE9/7zFY8c6lVv6vJhIGUpXe8/4msfXznM1vxzLWc+tyVhIGUZUQ8w4msXXzXsxtx7t73UxNhIGUbFc9xmpq12nfF+J4V+b62EAZStpni2U7xJe5Rut8O8T2c7u6dtHhnjJ+rujCQss0Wz6dvTovPr/v/eYHx8xx3cZ2qCwMp24zxjKpj5/is+sfd+6nx7p7iWlUXBlK2GeMZVc+O8Rn1n7v3dDdP9RbXq7owkLLMHM+qOnaLz6foLa5/kxKvUXVhICWbPZ5XdewSn0vPnuLaOznxWlUXBlKSVeK5VW6X+Fx69hTXXsmN16u6MJBerRTPrjI7xGdSuru4jr7EPVRdGEivVovn13czVHIWPo/yXcU1V3Lj9aouDKRHu8TnUpoZ+noWPou+u4prKCdeqybCQHq0U3w2vZuhr2fhs+i7p7g29bqfnq7hZ1/c7VPzHosIA+nRjvEZ9WzV+Bwq8xTXpl73V2/r+Xku7vEUr91MGEiPTorPrv+sEs+tuu7iujuMn6euyfE17rOBMJAenRafX/+ZPZ5XbVzFNSUYP//ia9xncWEgPTo5vovTzR7PqzYYP6+l1f5f4h6LCgPp0enxfZxu5nhWtbPDe8+N1y8oDKRXp8f3cbKZ41nVx6rvPzdev6AwkF6dHt/H6WaN51Q/q34HX+M+iwgDKcnJ8V2cbtZ4To3H+PlIpXG/BYSBlOzU+B5ON2s8p8Zi/HwGbz2t414LCAMp2cnxXZxu1nhOKRXj57/XcL6IMJCynBjfgeb9OeA5Jf0rDKQsp8Xn1z9mjmeV9LcwkLKdEJ9Zf5o5nlXS38JA+mT3+Lz608zxrJL+FgbSZ7vG51Q0czyrznMX113JWbuYMJA+2zU+p/40ezyvzvIU11LO2gWFgfTZrvE59afZ43nvMH6u9bzF9cT4+eLCQCqyW3w+RbPH8165ims0r6vvLTXudbfv29oFhYFUbKf4bPrTCvHMdBfXaU6lcb+3vblmYWEgVbFDfCZFK8Qzp5yf6zSfmnHvp3twzcLCQGpixfgMimaP5009O9dqPi1KvQfXLSoMpGZWi+dXNGs8Jz3FtZpPy1LvwTMtKAykZlaL51c0Wzzflbe4XnOZJZ5rQWEgNbNaPL+uzRLPdectrtc8ZopnW1AYSE2tFM+uazPEMz15i+s1hxnjGRcTBlJTq8Rz697oeJ43b3G9xlohnnkRYSA1tUI8s96NjGd58xTXqr9V43MsIAykplaIZ9a7kfEsb57iWvWzenyeBYSB1MwK8cxKNyqe481TXKs+donPNbkwkJqZMZ5R342K53jzFNeqvd3i800sDKRmZopnUx0j4hne3MV16mPH+IyTCgOpmVniuVTPiHiGN3dxnfrYNT7nhMJAamaGeCbV1TveP1WNPVTHrvE5JxQGUjOj43nURq94X61p5/iskwkDqZmR8Sxqp0e8p9a1e3zeiYSB1MToeB610zreT2vbPT7vRMJAamJkPIvaah3vp7XtHp93ImEgNTEynkXttYz30vp2js86kTCQmhgVz6F+WsR7aA87x2edSBhI1Y2MZ1E/LeI9tIed47NOJAyk6kbFc6i/mnFv7WXX+JwTCQOpuhHxDBqnNO6nPe0Yn3EyYSBV1zveX2OVxL20r5q12PNLfMbJhIFUXc94b41XEvfSvr7GfVL0iPecUBhI1fWK99UcvsZ9tLfceH2u1vF+EwoDqbpe8b6aj9+V7jzFtbW0iveZVBhIVbWO95O0LsbPW6oV951YGEhVtYr3kaRSNeKeEwsDqZqW8V6SVENp3G9iYSBV0zLeS5JqKIl7TS4MpGpaxntJUi1f4h6zeDhfGEjVtIj3kKRW+HfPan8PMXweL5BqqRX3lSS9Y/g8XiDVUhr3kySle/m7NAykakriXpKkqsJAquZL3EOSZjPz31kZ5woDqZrceL0kzYjx8xE+nCcMpGpy4/WSNKPZ/t76eJ4wkKrJjddL0qxm+XuL8fMHYSBVkxOvlSTdu4prXoSBVE1OvFaSdI/x8wRhIFWRGq+TJL2r8PdoGEhVpMRrJElpKvw9GgZSsZx4rSSpizCQiuXEayVJXYSBVCw1XidJ6iYMpGKp8TpJUjdhIFXxFtdLkroKA6mKt7hektRVGEjV3MV1kqTuwkCq5i6ukyR1FwZSNXdxnSSpuzCQqmL8XJI0RBhIkqT9hYEkSdpfGEjN+T8HSNJwYSBJkvYXBpIkaX9hIEmS9hcGkiRpf2EgSZL2FwaSJGl/YSBJkvYXBpIkaX9hIEmS9hcGkiRpf2EgSZL2FwaSJGl/YSBJkvYXBpIkaX9hIEmS9hcGkiRpf2EgSbrwO362o7e4fjZvcf2BwkAaxl9MzeYprl1Ny3ivmmrFfVOVXDuZMJCGqfHLKaXqFe/byqzxnDzzzGd/is+yoDCQhmD8XKplVDxHDSu18tlz47NOKgyk7q7iGqnEDPFMNazWquduEb/LAcJA6uourpNyzBbPd3VOfka2Z/yeOwoDqZmceK3qK437tbJ6fJ6dns3qxZ+NDsJAaiI3Xq97P+9rtfgcKz7DU3y2HLZGP9/V7z9TfIl7VBAGUnVf4h6KbM74PX1lc8fvK0dp3O+jMNBiKv4wNJMbr9efbI5+fx/8jmqxM+PPQSNhoIXkxGt/X895TbnxeuW/Q+sTv6fa7Lz4M9BYGGghreJ9SrXce1c2V/x+WusV75tjlXjuWc/OM3YQBscpiXv1Nks8l76zNeL3VkvPeO8aZoxnnPGsPFsnYXCUGeMZn/To7T48k8r0jPfOdXp8HyVGxDPUNDKe5U5qP2t//1lTiz0ThcFydo/Pe6VFvMfd/fiZyvH9tor3zWX943fA74Gf/f6c89Zqxr0pZ+3ddYxrW+l9v1/CYHq94n1bSI3Xpfh9XWrco5Yv97iKa05n/8V3QzOWej4+yypqxD1n8hbX32H8vKEwmFLLeK+eUuN1d77GfWr7cp+f9W/xutOcHt/Hk1Xjc6yiRtxzJm9x/RPGzxsJA00g5wegRtxT6zg5vosUV93NW8ZzrWpkPMspKj57GChTSdzri5K4l9YzMp5FZxkdz7O7Bs8eBpI28tTP51/+lEbH8+zqKq75KAwkLaTBXwpSsp+fu95/nuYqrvkgDCRJ0v7CQJIk7S8MtJDSuJ8knaI07regMNBCSuN+u2L8XNJ5avWzV86fkwgDLaQ07reTlHjNinZ5DumLleOzDBAGuvHzhU3yxf2tNO63gxH93Lf3n+yvuXSSnfp5Hj5jMzxAbmHDBf08B5/n9/wu7pXrhPjMNVlZfJ/q7+d7yP2zFu6b+ucMrKyl3+BMPwA/Z8n902z1+DPd88/V1epnr9w/a8V9e/1pZfkWzczMDsx/AJiZmR2Y/wAwMzM7MP8BYGZmdmD/H2qz0FAxQljGAAAAAElFTkSuQmCC";

// src/client/ui/loading-globe-renderer.js
var TURN_DURATION = 24e3;
function buildGlobeProjection(size, textureWidth, textureHeight) {
  const longitude = new Float32Array(size * size);
  const latitude = new Float32Array(size * size);
  const light = new Float32Array(size * size);
  const pixels = new Uint8ClampedArray(size * size * 4);
  const tilt = 15 * Math.PI / 180;
  for (let pixelY = 0; pixelY < size; pixelY++) {
    for (let pixelX = 0; pixelX < size; pixelX++) {
      const east = (2 * pixelX + 1) / size - 1;
      const north = 1 - (2 * pixelY + 1) / size;
      const radiusSquared = east * east + north * north;
      if (radiusSquared >= 1) continue;
      const depth = Math.sqrt(1 - radiusSquared);
      const index = pixelY * size + pixelX;
      longitude[index] = Math.atan2(east, depth * Math.cos(tilt) - north * Math.sin(tilt)) / (2 * Math.PI) * textureWidth;
      latitude[index] = (0.5 - Math.asin(north * Math.cos(tilt) + depth * Math.sin(tilt)) / Math.PI) * (textureHeight - 1);
      light[index] = 0.87 + 0.13 * Math.max(0, -0.35 * east + 0.45 * north + 0.8 * depth);
      pixels[index * 4 + 3] = 255 * Math.min(1, (1 - Math.sqrt(radiusSquared)) * size / 2);
    }
  }
  return { size, textureWidth, textureHeight, longitude, latitude, light, pixels };
}
function renderGlobePixels(projection, texture, elapsed = 0) {
  const { size, textureWidth, textureHeight, longitude, latitude, light, pixels } = projection;
  const offset = (elapsed % TURN_DURATION / TURN_DURATION + 295 / 360) * textureWidth;
  for (let index = 0; index < size * size; index++) {
    if (!pixels[index * 4 + 3]) continue;
    const textureX = ((longitude[index] + offset) % textureWidth + textureWidth) % textureWidth;
    const textureY = latitude[index];
    const left = Math.floor(textureX);
    const right = (left + 1) % textureWidth;
    const top = Math.floor(textureY);
    const bottom = Math.min(top + 1, textureHeight - 1);
    const fractionX = textureX - left;
    const fractionY = textureY - top;
    const upper = texture[(top * textureWidth + left) * 4] * (1 - fractionX) + texture[(top * textureWidth + right) * 4] * fractionX;
    const lower = texture[(bottom * textureWidth + left) * 4] * (1 - fractionX) + texture[(bottom * textureWidth + right) * 4] * fractionX;
    const land = (upper * (1 - fractionY) + lower * fractionY) / 255;
    pixels[index * 4] = (226 - 102 * land) * light[index];
    pixels[index * 4 + 1] = (242 - 70 * land) * light[index];
    pixels[index * 4 + 2] = (253 - 38 * land) * light[index];
  }
  return pixels;
}

// src/client/ui/loading-globe.js
function LoadingGlobe() {
  const canvasRef = import_react8.default.useRef(null);
  import_react8.default.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    const size = Math.round(80 * Math.min(window.devicePixelRatio || 1, 2));
    canvas.width = size;
    canvas.height = size;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const image = new Image();
    let frame = 0;
    let texture = null;
    let projection = null;
    let lastDraw = -Infinity;
    const started = performance.now();
    const output = context.createImageData(size, size);
    const draw = (now) => {
      frame = 0;
      if (!texture || document.hidden) return;
      if (reducedMotion.matches || now - lastDraw >= 1e3 / 30) {
        output.data.set(renderGlobePixels(projection, texture, reducedMotion.matches ? 0 : now - started));
        context.putImageData(output, 0, 0);
        lastDraw = now;
      }
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      lastDraw = -Infinity;
      draw(performance.now());
    };
    image.onload = () => {
      const map = document.createElement("canvas");
      map.width = image.width;
      map.height = image.height;
      const mapContext = map.getContext("2d");
      if (!mapContext) return;
      mapContext.drawImage(image, 0, 0);
      texture = mapContext.getImageData(0, 0, image.width, image.height).data;
      projection = buildGlobeProjection(size, image.width, image.height);
      resume();
    };
    image.src = EARTH_MASK;
    reducedMotion.addEventListener("change", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame);
      image.onload = null;
      reducedMotion.removeEventListener("change", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return import_react8.default.createElement(
    "div",
    { className: "mv-spinner", "aria-hidden": true },
    import_react8.default.createElement("canvas", { ref: canvasRef, className: "mv-loading-globe" })
  );
}

// src/client/ui/selection-overlay.js
var import_react9 = __toESM(require("react"), 1);
var h7 = import_react9.default.createElement;
var CONFIDENCE_TIER = {
  measured: { key: "selection.confidence.high", tone: "high" },
  estimated: { key: "selection.confidence.medium", tone: "medium" },
  inferred: { key: "selection.confidence.low", tone: "low" }
};
var TITLE_KEY = {
  tile_feature: "selection.unnamed",
  tileset: "selection.unnamed.tileset",
  entity: "selection.unnamed.entity",
  scene: "selection.unnamed.scene"
};
function factOf(card, key) {
  const facts = Array.isArray(card?.facts) ? card.facts : [];
  return facts.find((fact) => fact && fact.key === key) ?? null;
}
function numberText(value, suffix = " m", digits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return `${rounded}${suffix}`;
}
function SelectionOverlay({ active, apiRef, controller, renderSnapshot, t: t2, showToast, onMeasure }) {
  const [card, setCard] = import_react9.default.useState(null);
  const [busy, setBusy] = import_react9.default.useState(false);
  const [errorLine, setErrorLine] = import_react9.default.useState("");
  const [exporting, setExporting] = import_react9.default.useState(false);
  const anchorRef = import_react9.default.useRef(null);
  const bracketRef = import_react9.default.useRef(null);
  const chipRef = import_react9.default.useRef(null);
  const identify = import_react9.default.useCallback(
    async (position) => {
      if (!controller) return;
      setBusy(true);
      setErrorLine("");
      setCard(null);
      try {
        const result = await controller.identifyAt(position);
        anchorRef.current = result?.anchor ?? null;
        setCard(result?.card ?? null);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setErrorLine(reason === "no_surface" ? t2("selection.noSurface") : reason === "not_ready" ? t2("selection.notReady") : t2("selection.failed"));
        setCard(null);
      } finally {
        setBusy(false);
      }
    },
    [controller, t2]
  );
  import_react9.default.useEffect(() => {
    if (!apiRef) return void 0;
    apiRef.current = active ? identify : null;
    return () => {
      if (apiRef) apiRef.current = null;
    };
  }, [apiRef, active, identify]);
  import_react9.default.useEffect(() => {
    if (active) return;
    anchorRef.current = null;
    setCard(null);
    setBusy(false);
    setErrorLine("");
  }, [active]);
  import_react9.default.useEffect(() => {
    if (!active || !card) return void 0;
    const viewer = controller?.getViewer?.();
    const Cesium = controller?.getCesium?.();
    const anchor = anchorRef.current;
    if (!viewer || !Cesium || !anchor) return void 0;
    const scene = viewer.scene;
    const update = () => {
      const element = bracketRef.current;
      if (!element) return;
      let point = null;
      try {
        point = Cesium.SceneTransforms.worldToWindowCoordinates(scene, anchor);
      } catch {
        point = null;
      }
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        element.style.display = "none";
        return;
      }
      element.style.display = "";
      element.style.transform = `translate(${Math.round(point.x)}px,${Math.round(point.y)}px)`;
    };
    scene.postRender.addEventListener(update);
    update();
    return () => {
      try {
        scene.postRender.removeEventListener(update);
      } catch {
      }
    };
  }, [active, card, controller]);
  import_react9.default.useEffect(() => {
    if (!card) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setCard(null);
        anchorRef.current = null;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [card]);
  const flyNear = () => {
    const viewer = controller?.getViewer?.();
    const Cesium = controller?.getCesium?.();
    if (!viewer || !Cesium || !card) return;
    const anchor = anchorRef.current;
    const target = anchor ?? Cesium.Cartesian3.fromDegrees(card.point.lon, card.point.lat, card.point.surface_height_m ?? 0);
    const range = 120;
    const pitch = Cesium.Math.toRadians(-35);
    const heading = viewer.camera.heading ?? 0;
    try {
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, 2), {
        offset: new Cesium.HeadingPitchRange(heading, pitch, range),
        duration: 1.4
      });
      setCard(null);
      anchorRef.current = null;
    } catch {
    }
  };
  const measure = () => {
    if (!card || typeof onMeasure !== "function") return;
    onMeasure(anchorRef.current ?? null, card);
    setCard(null);
    anchorRef.current = null;
  };
  const takeAway = async () => {
    if (!card || exporting) return;
    setExporting(true);
    try {
      const snapshot = typeof renderSnapshot === "function" ? await renderSnapshot({ format: "png" }) : null;
      const saved = await controller.exportEvidence(card, snapshot);
      showToast(t2("selection.saved", { path: saved?.path ?? "" }));
    } catch (error) {
      showToast(t2("selection.saveFailed", { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setExporting(false);
    }
  };
  if (!active) return null;
  const surface = factOf(card, "surface_height");
  const object = factOf(card, "object_height");
  const above = factOf(card, "above_median");
  const confidenceChip = (basis) => {
    const tier = CONFIDENCE_TIER[basis] ?? CONFIDENCE_TIER.inferred;
    return h7("span", { className: `mv-sel-conf ${tier.tone}`, title: t2(tier.key) }, t2(tier.key));
  };
  const limitations = Array.isArray(card?.limitations) ? card.limitations : [];
  const radii = card?.sampling?.radii_m ?? [30, 60, 120];
  const showFootnote = limitations.includes("no_building_identity") || limitations.includes("tile_feature_only");
  return h7(
    import_react9.default.Fragment,
    null,
    h7(
      "div",
      { ref: bracketRef, className: "mv-sel-anchor", style: { display: "none" }, "aria-hidden": true },
      h7("i", { className: "c tl" }),
      h7("i", { className: "c tr" }),
      h7("i", { className: "c bl" }),
      h7("i", { className: "c br" }),
      h7("span", { className: "leader" }),
      h7("b", { ref: chipRef, className: "chip" }, object && object.value !== null ? `≈ ${numberText(object.value, " m")}` : t2("selection.noHeight"))
    ),
    busy ? h7("div", { className: "mv-select mv-select-loading mv-glass", role: "status" }, h7("div", { className: "mv-spinner" }), h7("span", null, t2("selection.reading"))) : null,
    errorLine !== "" ? h7(
      "div",
      { className: "mv-select mv-glass" },
      h7("div", { className: "mv-select-error" }, h7("span", null, errorLine))
    ) : null,
    card ? h7(
      "div",
      { className: "mv-select mv-glass" },
      h7(
        "header",
        null,
        h7("span", { className: "kind" }, t2("selection.resultLabel")),
        h7(
          "button",
          { type: "button", className: "mv-icon-btn", title: t2("btn.close"), "aria-label": t2("btn.close"), onClick: () => {
            setCard(null);
            anchorRef.current = null;
          } },
          "✕"
        )
      ),
      h7("h3", null, card.identity?.name ?? t2(TITLE_KEY[card.identity?.kind] ?? TITLE_KEY.tile_feature)),
      h7(
        "p",
        { className: "layer" },
        `${card.layer?.name ?? t2("selection.unknownLayer")} · ${card.point.lon.toFixed(5)}, ${card.point.lat.toFixed(5)}`
      ),
      h7(
        "div",
        { className: "facts" },
        surface ? h7(
          "div",
          { className: "fact" },
          h7("span", { className: "key" }, t2("selection.surfaceHeight")),
          h7("b", null, numberText(surface.value)),
          confidenceChip("measured")
        ) : null,
        object ? h7(
          "div",
          { className: "fact" },
          h7("span", { className: "key" }, t2("selection.objectHeight")),
          h7("b", null, numberText(object.value)),
          confidenceChip(object.basis)
        ) : null,
        above ? h7(
          "div",
          { className: "fact" },
          h7("span", { className: "key", title: t2("selection.aboveMedianHint") }, t2("selection.aboveMedian")),
          h7(
            "b",
            null,
            typeof above.value === "number" ? `${Math.round(above.value) > 0 ? "+" : ""}${Math.round(above.value)} m` : "—"
          ),
          confidenceChip(above.basis)
        ) : null
      ),
      h7(
        "p",
        { className: "sampling", title: t2("selection.samplingHint") },
        t2("selection.sampling", { count: card.sampling?.count ?? 0, radii: radii.join("/") })
      ),
      showFootnote ? h7("p", { className: "footnote" }, t2("selection.footnote")) : null,
      h7(
        "div",
        { className: "actions" },
        h7("button", { type: "button", className: "mv-cta", title: t2("selection.flyHint"), onClick: flyNear }, t2("selection.fly")),
        h7("button", { type: "button", className: "mv-cta", title: t2("selection.measureHint"), onClick: measure }, t2("selection.measure")),
        h7(
          "button",
          { type: "button", className: "mv-cta primary", title: t2("selection.exportHint"), disabled: exporting, onClick: takeAway },
          exporting ? t2("selection.exporting") : t2("selection.takeAway")
        )
      )
    ) : null,
    active && !card && !busy && errorLine === "" ? h7("div", { className: "mv-sel-hint mv-glass" }, t2("selection.hint")) : null
  );
}

// src/client/ui/tour-bar.js
var import_react10 = __toESM(require("react"), 1);

// src/client/scene/tour.js
var TOUR_MIN_DURATION = 1.6;
var TOUR_MID_DURATION = 2;
var TOUR_MAX_DURATION = 2.4;
var TOUR_DWELL_MS = 2200;
var TOUR_MIN_STOPS = 2;
function buildTour(bookmarks) {
  const list = Array.isArray(bookmarks) ? bookmarks : [];
  const stops = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const view = normalizeBookmarkView(item.view);
    if (view === null) continue;
    stops.push({
      id: typeof item.id === "string" ? item.id : `stop-${stops.length + 1}`,
      name: typeof item.name === "string" && item.name.trim() !== "" ? item.name.trim().slice(0, 60) : "",
      caption: typeof item.caption === "string" ? item.caption.trim().slice(0, 120) : "",
      view
    });
  }
  return stops;
}
function stepIndex(index, delta, length) {
  const size = Number.isInteger(length) ? length : 0;
  if (size <= 0) return 0;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return ((Math.trunc(index) + step) % size + size) % size;
}
function stopCaption(stop, index, t2) {
  if (stop && typeof stop.caption === "string" && stop.caption.trim() !== "") return stop.caption.trim();
  const n = (Number.isInteger(index) ? index : 0) + 1;
  return typeof t2 === "function" ? t2("tour.stop", { n }) : `第 ${n} 站`;
}
function tourDuration(fromView, toView) {
  if (!fromView || !toView) return TOUR_MIN_DURATION;
  return flightDuration(viewDistanceM(fromView, toView), {
    min: TOUR_MIN_DURATION,
    mid: TOUR_MID_DURATION,
    max: TOUR_MAX_DURATION
  });
}

// src/client/ui/tour-bar.js
function useTour({ t: t2, showToast, getCurrentView, onFlyView, onFinish }) {
  const [state, setState] = import_react10.default.useState(null);
  const barRef = import_react10.default.useRef(null);
  const apiRef = import_react10.default.useRef({});
  apiRef.current = { t: t2, showToast, getCurrentView, onFlyView, onFinish };
  const stop = import_react10.default.useCallback(() => {
    setState(null);
  }, []);
  const start = import_react10.default.useCallback(
    (bookmarks) => {
      const stops = buildTour(bookmarks);
      if (stops.length < TOUR_MIN_STOPS) {
        if (typeof showToast === "function") showToast(t2("tour.needStops"));
        return false;
      }
      setState({ stops, index: 0, playing: true });
      return true;
    },
    [showToast, t2]
  );
  import_react10.default.useEffect(() => {
    if (!state || !state.playing) return void 0;
    const api = apiRef.current;
    const current2 = state.stops[state.index];
    if (!current2) return void 0;
    const from = typeof api.getCurrentView === "function" ? api.getCurrentView() : null;
    const duration = tourDuration(from, current2.view);
    if (typeof api.onFlyView === "function") api.onFlyView(current2.view, duration);
    const timer = setTimeout(() => {
      const next = stepIndex(state.index, 1, state.stops.length);
      if (next === 0) {
        setState(null);
        if (typeof api.onFinish === "function") api.onFinish();
        if (typeof api.showToast === "function") api.showToast(api.t("tour.finished"));
        return;
      }
      setState((previous) => previous ? { ...previous, index: next } : null);
    }, Math.round(duration * 1e3) + TOUR_DWELL_MS);
    return () => clearTimeout(timer);
  }, [state]);
  import_react10.default.useEffect(() => {
    if (!state || !state.playing) return void 0;
    const onPointerDown = (event) => {
      const bar = barRef.current;
      if (bar && event.target instanceof Node && bar.contains(event.target)) return;
      setState((previous) => previous ? { ...previous, playing: false } : null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [state]);
  import_react10.default.useEffect(() => {
    if (!state) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") setState(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state]);
  const current = state ? state.stops[state.index] : null;
  const element = state ? h(
    "div",
    { ref: barRef, className: "mv-tour mv-glass", role: "region", "aria-label": t2("tour.title") },
    h(
      "div",
      { className: "mv-tour-head" },
      h("b", null, t2("tour.title")),
      h("span", { className: "mv-tour-progress" }, t2("tour.progress", { index: state.index + 1, total: state.stops.length })),
      h("button", { type: "button", className: "mv-icon-btn", title: t2("tour.exit"), "aria-label": t2("tour.exit"), onClick: stop }, "✕")
    ),
    h("p", { className: "mv-tour-caption" }, stopCaption(current, state.index, t2)),
    h(
      "div",
      { className: "mv-tour-actions" },
      h("button", { type: "button", className: "mv-icon-btn", title: t2("tour.prev"), "aria-label": t2("tour.prev"), onClick: () => setState((previous) => previous ? { ...previous, index: stepIndex(previous.index, -1, previous.stops.length), playing: true } : null) }, "⏮"),
      h(
        "button",
        {
          type: "button",
          className: "mv-cta primary",
          onClick: () => setState((previous) => previous ? { ...previous, playing: !previous.playing } : null)
        },
        state.playing ? t2("tour.pause") : t2("tour.play")
      ),
      h("button", { type: "button", className: "mv-icon-btn", title: t2("tour.next"), "aria-label": t2("tour.next"), onClick: () => setState((previous) => previous ? { ...previous, index: stepIndex(previous.index, 1, previous.stops.length), playing: true } : null) }, "⏭")
    ),
    h("p", { className: "mv-tour-hint" }, t2("tour.hint"))
  ) : null;
  return { start, stop, element };
}

// src/client/ui/menu-item.js
var import_react11 = __toESM(require("react"), 1);
var h8 = import_react11.default.createElement;
function MenuItem({ onClick, children, active, title }) {
  return h8(
    "button",
    { type: "button", className: `mv-menu-item${active ? " on" : ""}`, onClick, title },
    children,
    active ? h8("span", { className: "check", "aria-hidden": true }, "✓") : null
  );
}

// src/client/viewer/ViewerSurface.js
var h9 = import_react12.default.createElement;
function ViewerSurface({ t: injectedT, sessionId = null, docked = false }) {
  const fallbackT = useTranslation();
  const t2 = typeof injectedT === "function" ? injectedT : fallbackT;
  const environmentDark = useEnvironmentDark();
  const rootRef = import_react12.default.useRef(null);
  const globeRef = import_react12.default.useRef(null);
  const creditRef = import_react12.default.useRef(null);
  const menuRef = import_react12.default.useRef(null);
  const viewerRef = import_react12.default.useRef(null);
  const cesiumRef = import_react12.default.useRef(null);
  const metaRef = import_react12.default.useRef(null);
  const layersRef = import_react12.default.useRef([]);
  const toolRef = import_react12.default.useRef(null);
  const measureRef = import_react12.default.useRef({ points: [], entities: [] });
  const handlerRef = import_react12.default.useRef(null);
  const imageryRef = import_react12.default.useRef(null);
  const overlayLayersRef = import_react12.default.useRef(null);
  const sourcesRef = import_react12.default.useRef(null);
  const toastTimer = import_react12.default.useRef(0);
  const captureReadoutRef = import_react12.default.useRef(null);
  const commandChainRef = import_react12.default.useRef(Promise.resolve());
  const commandRef = import_react12.default.useRef(null);
  const selectionApiRef = import_react12.default.useRef(null);
  const accessRef = import_react12.default.useRef(null);
  const analysisRef = import_react12.default.useRef({ operation: null, layerId: null, layerName: null, entities: [], restore: null });
  const analysisCommandRef = import_react12.default.useRef(null);
  const shaderEntriesRef = import_react12.default.useRef(/* @__PURE__ */ new Map());
  const shaderTickRef = import_react12.default.useRef(null);
  const readyGateRef = import_react12.default.useRef({ ready: false, error: null, waiters: [] });
  const healthSeqRef = import_react12.default.useRef(0);
  const sessionRef = import_react12.default.useRef(sessionId);
  sessionRef.current = sessionId;
  const [phase, setPhase] = import_react12.default.useState("loading");
  const [error, setError] = import_react12.default.useState("");
  const [layers, setLayers] = import_react12.default.useState([]);
  const [sources, setSources] = import_react12.default.useState(null);
  const [defaults, setDefaults] = import_react12.default.useState(null);
  const [tool, setTool] = import_react12.default.useState(null);
  const [fps, setFps] = import_react12.default.useState(null);
  const [fullscreen, setFullscreen] = import_react12.default.useState(false);
  const [stats, setStats] = import_react12.default.useState(null);
  const [pickInfo, setPickInfo] = import_react12.default.useState(null);
  const [measureInfo, setMeasureInfo] = import_react12.default.useState(null);
  const [scan, setScan] = import_react12.default.useState(null);
  const [emptyDismissed, setEmptyDismissed] = import_react12.default.useState(false);
  const [restoringScene, setRestoringScene] = import_react12.default.useState(false);
  const [urlBar, setUrlBar] = import_react12.default.useState(false);
  const [urlInput, setUrlInput] = import_react12.default.useState("");
  const [busy, setBusy] = import_react12.default.useState("");
  const [toast, setToast] = import_react12.default.useState("");
  const [openMenu, setOpenMenu] = import_react12.default.useState(null);
  const [recentDirs, setRecentDirs] = import_react12.default.useState([]);
  const [accessRequest, setAccessRequest] = import_react12.default.useState(null);
  const [accessBusy, setAccessBusy] = import_react12.default.useState(false);
  const [analysis, setAnalysis] = import_react12.default.useState(null);
  const [shaderOpen, setShaderOpen] = import_react12.default.useState(false);
  const [shaderActive, setShaderActive] = import_react12.default.useState([]);
  const [shaderForm, setShaderForm] = import_react12.default.useState({
    layerId: "",
    preset: "height-false-color",
    minHeight: "",
    maxHeight: "",
    interval: "20",
    speed: "1",
    amplitude: "1",
    opacity: "0.75",
    waterHeight: "",
    depthMax: ""
  });
  const [settingsOpen, setSettingsOpen] = import_react12.default.useState(false);
  const [health, setHealth] = import_react12.default.useState(null);
  const [terrainBusy, setTerrainBusy] = import_react12.default.useState(false);
  const [terrainError, setTerrainError] = import_react12.default.useState("");
  const [imageryBusy, setImageryBusy] = import_react12.default.useState(false);
  const [meta, setMeta] = import_react12.default.useState(null);
  const [bridgeOn, setBridgeOn] = import_react12.default.useState(false);
  const [bridgeReload, setBridgeReload] = import_react12.default.useState(false);
  const [bridgeEpoch, setBridgeEpoch] = import_react12.default.useState(0);
  const themeMode = sources?.settings?.theme ?? "auto";
  const resolvedDark = themeMode === "auto" ? environmentDark : themeMode === "dark";
  const showLayers = sources?.settings?.showLayers !== false;
  const showHud = sources?.settings?.showHud !== false;
  const activeImageryId = sources?.settings?.imagery ?? null;
  const activeTerrainId = sources?.settings?.terrain ?? null;
  const activeImagery = sources?.imagery?.find((source) => source.id === activeImageryId) ?? null;
  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6e3);
  };
  const settleReadyWaiters = (error2) => {
    const gate = readyGateRef.current;
    if (error2 === void 0) {
      gate.ready = true;
      gate.error = null;
    } else {
      gate.error = error2;
    }
    const waiters = gate.waiters.splice(0);
    for (const waiter of waiters) {
      if (error2 === void 0) waiter.resolve();
      else waiter.reject(error2);
    }
  };
  const waitForPanelReady = (timeoutMs = 3e4) => new Promise((resolve, reject) => {
    const gate = readyGateRef.current;
    if (gate.ready) {
      resolve();
      return;
    }
    if (gate.error !== null) {
      reject(gate.error);
      return;
    }
    const waiter = { resolve: null, reject: null };
    const timer = setTimeout(() => {
      const index = gate.waiters.indexOf(waiter);
      if (index >= 0) gate.waiters.splice(index, 1);
      reject(new Error(t2("agent.notReady")));
    }, timeoutMs);
    waiter.resolve = () => {
      clearTimeout(timer);
      resolve();
    };
    waiter.reject = (error2) => {
      clearTimeout(timer);
      reject(error2);
    };
    gate.waiters.push(waiter);
  });
  const syncLayers = () => {
    setLayers(layersRef.current.map((layer) => ({ id: layer.id, name: layer.name, visible: layer.visible })));
    markSceneDirty();
  };
  const saveChainRef = import_react12.default.useRef(Promise.resolve());
  const saveSeqRef = import_react12.default.useRef(0);
  const commitSources = (next, notify) => {
    const previous = sourcesRef.current;
    sourcesRef.current = next;
    setSources(next);
    const meta2 = metaRef.current;
    if (!meta2) return;
    const seq = saveSeqRef.current += 1;
    saveChainRef.current = saveChainRef.current.then(
      () => persistSources(meta2, next).then((saved) => {
        if (!saved || seq !== saveSeqRef.current) return;
        sourcesRef.current = saved;
        setSources(saved);
        if (notify) showToast(t2("toast.sourcesSaved"));
      }).catch((error2) => {
        if (seq !== saveSeqRef.current) return;
        sourcesRef.current = previous;
        setSources(previous);
        showToast(t2("toast.saveFailed", { message: message(error2) }));
      })
    );
  };
  const updateSettings = (patch, notify) => {
    const current = sourcesRef.current;
    if (!current) return;
    commitSources({ ...current, settings: { ...current.settings, ...patch } }, notify);
  };
  const normalizeAccessRequest = (args = {}) => {
    const rawPath = typeof args.path === "string" ? args.path.trim() : "";
    const rawTarget = typeof args.target === "string" ? args.target.trim() : "";
    const target = rawTarget || rawPath;
    const explicitDir = typeof args.directory === "string" ? args.directory.trim() : "";
    const normalized = target.replace(/\\/g, "/");
    const index = normalized.lastIndexOf("/");
    return {
      request: typeof args.request === "string" ? args.request : "load",
      path: rawPath,
      target,
      directory: explicitDir || (index > 0 ? target.slice(0, index) : ""),
      kind: typeof args.kind === "string" ? args.kind : "file",
      resolved: args.resolved === true || rawTarget !== "" && rawTarget !== rawPath
    };
  };
  const settleAccess = (outcome) => {
    const current = accessRef.current;
    if (!current) return;
    accessRef.current = null;
    clearTimeout(current.timer);
    setAccessRequest(null);
    setAccessBusy(false);
    current.resolve(outcome);
  };
  const askPathAccess = (request) => new Promise((resolve) => {
    if (accessRef.current) settleAccess({ allowed: false, message: t2("access.denied") });
    const timer = setTimeout(() => settleAccess({ allowed: false, message: t2("access.denied") }), ACCESS_TIMEOUT_MS);
    accessRef.current = { resolve, timer };
    setAccessBusy(false);
    setAccessRequest(request);
  });
  const allowPathAccess = async () => {
    const request = accessRequest;
    if (!request || accessBusy || !accessRef.current) return;
    setAccessBusy(true);
    try {
      await scanLocalDirectory(metaRef.current, request.directory);
      settleAccess({ allowed: true, directory: request.directory });
    } catch (error2) {
      const detail = message(error2);
      settleAccess({ allowed: false, message: t2("access.scanFailed", { message: detail }) });
      showToast(t2("access.scanFailed", { message: detail }));
    }
  };
  const pickSurface = (position) => {
    const viewer = viewerRef.current;
    if (!viewer) return null;
    if (viewer.scene.pickPositionSupported) {
      try {
        const picked = viewer.scene.pickPosition(position);
        if (picked) return picked;
      } catch {
      }
    }
    const ray = viewer.camera.getPickRay(position);
    return ray ? viewer.scene.globe.pick(ray, viewer.scene) ?? null : null;
  };
  const proxyUrlFor = (url) => {
    const meta2 = metaRef.current;
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\//, "").split("/").map((part) => encodeURIComponent(part)).join("/");
    return `${meta2.remoteBase}${b64url(parsed.origin)}/${path}${parsed.search}`;
  };
  const localPathToUrl = async (filePath) => {
    const meta2 = metaRef.current;
    const normalized = filePath.replace(/\\/g, "/");
    const index = normalized.lastIndexOf("/");
    if (index <= 0) throw new Error(t2("toast.invalidPath"));
    const dir = normalized.slice(0, index);
    const rel = normalized.slice(index + 1);
    await scanLocalDirectory(meta2, dir);
    return `${meta2.tilesBase}${encodeURIComponent(b64url(dir))}/${encodeURIComponent(rel)}`;
  };
  async function loadTileset(url, name, source = null, options = {}) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) throw new Error(t2("agent.notReady"));
    const label = name || decodeURIComponent(url.split("/").filter(Boolean).slice(-2).join("/"));
    const tilesetOptions = {
      maximumScreenSpaceError: qualityProfile(sourcesRef.current?.settings?.quality).tilesetMaximumScreenSpaceError
    };
    setBusy(t2("toast.loadingData"));
    try {
      let tileset;
      try {
        tileset = await withNetworkTimeout(Cesium.Cesium3DTileset.fromUrl(url, tilesetOptions), 15e3);
      } catch (directError) {
        if (!/^https?:/i.test(url)) throw directError;
        tileset = await withNetworkTimeout(Cesium.Cesium3DTileset.fromUrl(proxyUrlFor(url), tilesetOptions), 15e3);
        showToast(t2("toast.proxyFallback"));
      }
      viewer.scene.primitives.add(tileset);
      const layer = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: label,
        url,
        source,
        tileset,
        visible: true
      };
      layersRef.current.push(layer);
      syncLayers();
      setScan(null);
      if (options.fly !== false) await viewer.flyTo(tileset, { duration: 1.2 });
      return layer;
    } finally {
      setBusy("");
    }
  }
  function joinLocalPath(dir, rel) {
    return `${String(dir).replace(/[\\/]+$/, "")}/${String(rel).replace(/\\/g, "/")}`;
  }
  async function addTileset(url, name, source = null) {
    try {
      await loadTileset(url, name, source);
    } catch (error2) {
      showToast(t2("toast.loadFailed", { message: message(error2) }));
    }
  }
  const refreshRecentDirs = async () => {
    const url = metaRef.current?.directoriesUrl;
    if (typeof url !== "string" || url === "") return;
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const list = Array.isArray(data?.directories) ? data.directories : [];
      const entries = [];
      for (const entry of list) {
        const dir = typeof entry === "string" ? entry : entry?.path;
        if (typeof dir !== "string" || dir === "") continue;
        entries.push({ dir, name: typeof entry?.name === "string" && entry.name !== "" ? entry.name : folderName(dir) });
        if (entries.length >= 5) break;
      }
      setRecentDirs(entries);
    } catch (error2) {
      setRecentDirs([]);
      showToast(t2("toast.scanFailed", { message: message(error2) }));
    }
  };
  async function openRecentDirectory(dir) {
    setOpenMenu(null);
    setBusy(t2("toast.busyDirectory"));
    try {
      const meta2 = metaRef.current;
      const response = await fetch(
        `${meta2.scanUrl}?token=${encodeURIComponent(meta2.token)}&dir=${encodeURIComponent(dir)}`,
        { credentials: "same-origin", headers: { "x-dsh-panel": "1" } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      refreshRecentDirs();
      if (!data.items || data.items.length === 0) {
        showToast(t2("toast.scanEmpty"));
        return;
      }
      setScan({ dir, items: data.items });
    } catch (error2) {
      showToast(t2("toast.scanFailed", { message: message(error2) }));
    } finally {
      setBusy("");
    }
  }
  async function pickLocal() {
    setOpenMenu(null);
    const workspace = service("uiWorkspace");
    if (!workspace) {
      showToast(t2("toast.dialogUnavailable"));
      return;
    }
    setBusy(t2("toast.busyDirectory"));
    try {
      const dir = await workspace.pickDirectory();
      if (!dir) return;
      const meta2 = metaRef.current;
      const response = await fetch(
        `${meta2.scanUrl}?token=${encodeURIComponent(meta2.token)}&dir=${encodeURIComponent(dir)}`,
        { credentials: "same-origin", headers: { "x-dsh-panel": "1" } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      refreshRecentDirs();
      if (!data.items || data.items.length === 0) {
        showToast(t2("toast.scanEmpty"));
        return;
      }
      setScan({ dir, items: data.items });
    } catch (error2) {
      showToast(t2("toast.scanFailed", { message: message(error2) }));
    } finally {
      setBusy("");
    }
  }
  async function pickLocalTiles() {
    const workspace = service("uiWorkspace");
    if (!workspace) {
      showToast(t2("toast.dialogUnavailable"));
      return null;
    }
    try {
      const dir = await workspace.pickDirectory();
      if (!dir) return null;
      const meta2 = metaRef.current;
      const response = await fetch(
        `${meta2.scanUrl}?token=${encodeURIComponent(meta2.token)}&dir=${encodeURIComponent(dir)}`,
        { credentials: "same-origin", headers: { "x-dsh-panel": "1" } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const folder = dir.replace(/\\/g, "/").replace(/\/+$/, "");
      return `${meta2.tilesBase}${encodeURIComponent(b64url(folder))}/{z}/{x}/{y}.png`;
    } catch (error2) {
      showToast(t2("toast.scanFailed", { message: message(error2) }));
      return null;
    }
  }
  const NETWORK_TIMEOUT_MS = 8e3;
  function withNetworkTimeout(promise, ms = NETWORK_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise(
        (_, reject) => setTimeout(() => reject(new Error(t2("toast.requestTimeout", { seconds: Math.round(ms / 1e3) }))), ms)
      )
    ]);
  }
  async function applyImagery(id, notify) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return { ok: false, error: t2("agent.notReady") };
    const config = sourcesRef.current;
    const source = config?.imagery.find((item) => item.id === id) ?? null;
    setImageryBusy(true);
    try {
      if (imageryRef.current) {
        viewer.scene.imageryLayers.remove(imageryRef.current, true);
        imageryRef.current = null;
      }
      if (source) {
        const provider = await withNetworkTimeout(imageryProvider(Cesium, source));
        imageryRef.current = viewer.scene.imageryLayers.addImageryProvider(provider, 0);
        if (notify) showToast(t2("toast.basemap", { name: source.name }));
      } else if (notify) {
        showToast(t2("toast.basemapNone"));
      }
      return { ok: true, source };
    } catch (error2) {
      showToast(t2("toast.basemapFailed", { message: message(error2) }));
      return { ok: false, error: message(error2) };
    } finally {
      setImageryBusy(false);
    }
  }
  async function applyTerrain(id, notify) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return { ok: false, error: t2("agent.notReady") };
    const config = sourcesRef.current;
    const source = config?.terrain.find((item) => item.id === id) ?? null;
    setTerrainBusy(true);
    if (notify) setBusy(t2("toast.terrainLoading"));
    try {
      if (source) {
        viewer.terrainProvider = await withNetworkTimeout(terrainProvider(Cesium, source));
        setTerrainError("");
        showToast(t2("toast.terrainOn", { name: source.name }));
      } else {
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        setTerrainError("");
        showToast(t2("toast.terrainOff"));
      }
      applyGlobeDepthTest();
      return { ok: true, source };
    } catch (error2) {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      const text = message(error2);
      const network = /Request has failed|Failed to fetch|NetworkError|timed out|timeout|超时|网络/i.test(text);
      const hint = t2(network ? "terrain.networkHint" : "terrain.failedHint", { message: text });
      setTerrainError(hint);
      if (notify) showToast(t2(network ? "toast.terrainNetwork" : "toast.terrainFailed", { message: text }));
      return { ok: false, error: text };
    } finally {
      setTerrainBusy(false);
      if (notify) setBusy("");
    }
  }
  function applyGlobeDepthTest() {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.globe.depthTestAgainstTerrain = sourcesRef.current?.settings?.terrainDepthTest === true;
  }
  const changeImagery = (id) => {
    updateSettings({ imagery: id });
    applyImagery(id, true);
    setOpenMenu(null);
  };
  const changeTerrain = (id) => {
    updateSettings({ terrain: id });
    applyTerrain(id, true);
    setOpenMenu(null);
  };
  const setTheme = (mode) => {
    updateSettings({ theme: mode });
    setOpenMenu(null);
  };
  const openBeside = () => {
    const rightbar = service("sidebarRight");
    if (rightbar && typeof rightbar.openTab === "function") {
      try {
        service("layout")?.selectPanel?.(null);
        rightbar.openTab("digital-earth");
        return;
      } catch {
        showToast(t2("toast.noSession"));
        return;
      }
    }
    service("layout")?.selectPanel?.("digital-earth");
  };
  const toggleDomFullscreen = () => {
    const root = rootRef.current;
    if (!root) return;
    const request = root.requestFullscreen?.bind(root);
    if (typeof request !== "function") {
      showToast(t2("toast.fullscreenUnsupported"));
      return;
    }
    const run = async () => {
      try {
        if (document.fullscreenElement === root) await document.exitFullscreen();
        else await root.requestFullscreen({ navigationUI: "hide" });
      } catch (error2) {
        showToast(t2("toast.fullscreenFailed", { message: message(error2) }));
      }
    };
    void run();
  };
  const saveSources = (draft) => {
    const current = sourcesRef.current;
    const meta2 = metaRef.current;
    if (!meta2) return;
    const next = { ...draft };
    commitSources(next, true);
    setSettingsOpen(false);
    if (current?.settings?.imagery !== next.settings.imagery) applyImagery(next.settings.imagery, false);
    if (current?.settings?.terrain !== next.settings.terrain) applyTerrain(next.settings.terrain, false);
    if (normalizeQuality(current?.settings?.quality) !== normalizeQuality(next.settings.quality)) {
      applyQuality(
        viewerRef.current,
        next.settings.quality,
        layersRef.current.map((layer) => layer.tileset)
      );
    }
    applyGlobeDepthTest();
    void overlayLayersRef.current?.sync(next.rasterOverlays ?? []).catch(() => {
    });
  };
  function setToolMode(mode) {
    toolRef.current = mode;
    setTool(mode);
    clearMeasure();
    if (mode) setPickInfo(null);
    setOpenMenu(null);
  }
  function clearMeasure() {
    const viewer = viewerRef.current;
    const state = measureRef.current;
    if (viewer) {
      for (const entity of state.entities) viewer.entities.remove(entity);
    }
    state.entities = [];
    state.points = [];
    setMeasureInfo(null);
  }
  function redrawMeasure(mode) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    const state = measureRef.current;
    if (!Cesium || !viewer) return;
    for (const entity of state.entities) viewer.entities.remove(entity);
    state.entities = [];
    const points = state.points;
    const add = (options) => {
      const entity = viewer.entities.add(options);
      state.entities.push(entity);
      return entity;
    };
    const accent = Cesium.Color.fromCssColorString("#5b8cff");
    const label = (position, text) => add({
      position,
      label: {
        text,
        font: '12px -apple-system,"Segoe UI","PingFang SC",sans-serif',
        style: Cesium.LabelStyle.FILL,
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0.06, 0.09, 0.15, 0.85),
        backgroundPadding: new Cesium.Cartesian2(8, 5),
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    for (const position of points) {
      add({
        position,
        point: {
          pixelSize: 6,
          color: accent,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    }
    if (mode === "distance" && points.length >= 2) {
      add({ polyline: { positions: points, width: 2, material: accent, depthFailMaterial: accent } });
      const total = geodesicLength(Cesium, points);
      label(points[points.length - 1], t2("measure.total", { value: formatDistance(total) }));
      setMeasureInfo({ text: t2("measure.distance", { value: formatDistance(total) }) });
    } else if (mode === "area" && points.length >= 3) {
      add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(points),
          perPositionHeight: true,
          material: accent.withAlpha(0.28),
          outline: true,
          outlineColor: accent
        }
      });
      const area = planarArea(Cesium, points);
      const center = Cesium.BoundingSphere.fromPoints(points).center;
      label(center, t2("measure.areaLabel", { value: formatArea(area) }));
      setMeasureInfo({ text: t2("measure.area", { value: formatArea(area) }) });
    } else if (mode === "height" && points.length === 2) {
      add({
        polyline: {
          positions: points,
          width: 2,
          material: Cesium.Color.fromCssColorString("#f0b84b"),
          depthFailMaterial: Cesium.Color.fromCssColorString("#f0b84b")
        }
      });
      const left = Cesium.Cartographic.fromCartesian(points[0]);
      const right = Cesium.Cartographic.fromCartesian(points[1]);
      const delta = right.height - left.height;
      const horizontal = new Cesium.EllipsoidGeodesic(left, right).surfaceDistance;
      const text = t2("measure.height", {
        value: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} m`,
        distance: formatDistance(horizontal)
      });
      label(points[1], text);
      setMeasureInfo({ text });
    } else {
      setMeasureInfo({ text: t2("measure.start") });
    }
  }
  const agentOverlayRef = import_react12.default.useRef({
    draw: [],
    measure: [],
    drawnFeatures: 0,
    measuredCount: 0,
    // The commands themselves are kept so a remounted panel can redraw them.
    drawCommands: [],
    measureCommands: [],
    // Entities per command (WeakMap keeps snapshots JSON-clean).
    entityGroups: /* @__PURE__ */ new WeakMap()
  });
  const [agentOverlayCount, setAgentOverlayCount] = import_react12.default.useState(0);
  const syncAgentOverlayCount = () => {
    const state = agentOverlayRef.current;
    setAgentOverlayCount(state.draw.length + state.measure.length);
  };
  const clearAgentOverlays2 = (kind = "all") => {
    clearAgentOverlays(agentOverlayRef.current, viewerRef.current, kind);
    syncAgentOverlayCount();
    markSceneDirty();
  };
  const AGENT_OVERLAY_COLORS = {
    accent: "#5b8cff",
    alert: "#e5484d",
    success: "#2ec27e",
    warm: "#f0b84b",
    violet: "#a855f7"
  };
  const agentOverlayColor = (Cesium, style) => {
    const css = AGENT_OVERLAY_COLORS[style] ?? AGENT_OVERLAY_COLORS.accent;
    try {
      return Cesium.Color.fromCssColorString(css);
    } catch {
      return Cesium.Color.DODGERBLUE;
    }
  };
  const agentSurfaceHeight = (Cesium, viewer, lon, lat) => {
    try {
      const height = viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lon, lat));
      if (Number.isFinite(height)) return height;
    } catch {
    }
    return 0;
  };
  const agentLabelText = (text, value) => typeof text === "string" && text !== "" ? text : typeof value === "string" ? value : "";
  const addAgentGroundLabel = (Cesium, add, lon, lat, text) => add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    label: {
      text,
      font: '12px -apple-system,"Segoe UI","PingFang SC",sans-serif',
      style: Cesium.LabelStyle.FILL,
      fillColor: Cesium.Color.WHITE,
      showBackground: true,
      backgroundColor: new Cesium.Color(0.06, 0.09, 0.15, 0.85),
      backgroundPadding: new Cesium.Cartesian2(8, 5),
      pixelOffset: new Cesium.Cartesian2(0, -18),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  });
  function drawAgentOverlay(Cesium, viewer, geojson, style, caption) {
    const state = agentOverlayRef.current;
    const firstEntity = state.draw.length;
    const color = agentOverlayColor(Cesium, style);
    const byType = { points: 0, lines: 0, polygons: 0 };
    const bbox = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
    let drawn = 0;
    const add = (options) => {
      const entity = viewer.entities.add(options);
      state.draw.push(entity);
      return entity;
    };
    const track = (coordinates) => {
      if (Array.isArray(coordinates)) {
        if (typeof coordinates[0] === "number" && coordinates.length >= 2) {
          const [lon, lat] = coordinates;
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            bbox.west = Math.min(bbox.west, lon);
            bbox.south = Math.min(bbox.south, lat);
            bbox.east = Math.max(bbox.east, lon);
            bbox.north = Math.max(bbox.north, lat);
          }
        } else {
          for (const item of coordinates) track(item);
        }
      }
    };
    const flat2d = (positions) => {
      const flat = [];
      for (const position of positions) {
        if (!Array.isArray(position) || position.length < 2) continue;
        flat.push(position[0], position[1]);
      }
      return flat;
    };
    const nameOf = (properties) => {
      const name = properties?.name;
      return typeof name === "string" && name.trim() !== "" ? name.trim() : "";
    };
    const drawLine = (coordinates, name) => {
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(flat2d(coordinates)),
          width: 3,
          material: color,
          depthFailMaterial: color.withAlpha(0.55),
          clampToGround: true
        }
      });
      byType.lines += 1;
      drawn += 1;
      track(coordinates);
      if (name !== "") {
        const middle = coordinates[Math.floor(coordinates.length / 2)];
        addAgentGroundLabel(Cesium, add, middle[0], middle[1], name);
      }
    };
    const drawPolygon = (rings, name) => {
      if (!Array.isArray(rings) || rings.length === 0 || !Array.isArray(rings[0])) return;
      const outer = Cesium.Cartesian3.fromDegreesArray(flat2d(rings[0]));
      if (outer.length < 3) return;
      const holes = rings.slice(1).map((ring) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat2d(ring))));
      add({ polygon: { hierarchy: new Cesium.PolygonHierarchy(outer, holes), material: color.withAlpha(0.26), outline: false, perPositionHeight: false } });
      for (const ring of rings) {
        if (!Array.isArray(ring) || ring.length < 2) continue;
        const closed = ring.slice();
        const first = closed[0];
        const last = closed[closed.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first);
        add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(flat2d(closed)),
            width: 2,
            material: color,
            depthFailMaterial: color.withAlpha(0.55),
            clampToGround: true
          }
        });
      }
      byType.polygons += 1;
      drawn += 1;
      for (const ring of rings) track(ring);
      if (name !== "") {
        let lon = 0;
        let lat = 0;
        for (const position of rings[0]) {
          lon += position[0];
          lat += position[1];
        }
        addAgentGroundLabel(Cesium, add, lon / rings[0].length, lat / rings[0].length, name);
      }
    };
    const drawPoint = (coordinates, name) => {
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      add({
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
        point: {
          pixelSize: 11,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      byType.points += 1;
      drawn += 1;
      track(coordinates);
      if (name !== "") addAgentGroundLabel(Cesium, add, coordinates[0], coordinates[1], name);
    };
    const drawGeometry = (geometry, properties) => {
      if (geometry === null || typeof geometry !== "object") return;
      const label = agentLabelText(nameOf(properties), caption);
      switch (geometry.type) {
        case "Point":
          drawPoint(geometry.coordinates, label);
          break;
        case "MultiPoint":
          for (const position of geometry.coordinates ?? []) drawPoint(position, label);
          break;
        case "LineString":
          drawLine(geometry.coordinates, label);
          break;
        case "MultiLineString":
          for (const line of geometry.coordinates ?? []) drawLine(line, label);
          break;
        case "Polygon":
          drawPolygon(geometry.coordinates, label);
          break;
        case "MultiPolygon":
          for (const polygon of geometry.coordinates ?? []) drawPolygon(polygon, label);
          break;
        default:
          break;
      }
    };
    const features = Array.isArray(geojson?.features) ? geojson.features : [];
    for (const feature of features) {
      if (feature?.geometry?.type === "GeometryCollection") {
        for (const child of feature.geometry.geometries ?? []) {
          drawGeometry(child, feature.properties);
        }
      } else {
        drawGeometry(feature?.geometry, feature?.properties);
      }
    }
    state.drawnFeatures += drawn;
    if (drawn > 0) {
      const command = {
        geojson,
        style,
        drawn,
        ...typeof caption === "string" && caption !== "" ? { caption } : {}
      };
      state.entityGroups.set(command, state.draw.slice(firstEntity));
      state.drawCommands.push(command);
      markSceneDirty();
    }
    syncAgentOverlayCount();
    const rounded = (value, digits = 6) => Math.round(value * 10 ** digits) / 10 ** digits;
    const hasBox = Number.isFinite(bbox.west) && Number.isFinite(bbox.east);
    return {
      drawn,
      by_type: byType,
      bbox: hasBox ? { west: rounded(bbox.west), south: rounded(bbox.south), east: rounded(bbox.east), north: rounded(bbox.north) } : null
    };
  }
  function measureAgentOverlay(Cesium, viewer, args) {
    const state = agentOverlayRef.current;
    const firstEntity = state.measure.length;
    const mode = args.mode;
    const points = Array.isArray(args.points) ? args.points : [];
    const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
    if (points.length < 2) throw new Error(t2("agent.badMeasure", { message: "need at least 2 points" }));
    const located = points.map((position) => {
      const lon = position[0];
      const lat = position[1];
      const height = Number.isFinite(position[2]) ? position[2] : agentSurfaceHeight(Cesium, viewer, lon, lat);
      return { lon, lat, height };
    });
    const ground = located.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 0));
    const draw = args.draw !== false;
    const color = Cesium.Color.fromCssColorString("#f0b84b");
    const add = (options) => {
      const entity = viewer.entities.add(options);
      state.measure.push(entity);
      return entity;
    };
    const dot = (lon, lat, height) => add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      point: {
        pixelSize: 8,
        color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    const result = { mode, points: points.length, drawn: draw };
    if (mode === "distance") {
      const distance = geodesicLength(Cesium, ground);
      result.distance_m = round(distance);
      result.distance_km = round(distance / 1e3, 4);
      if (draw) {
        for (const point of located) dot(point.lon, point.lat, point.height);
        add({
          polyline: {
            positions: ground,
            width: 3,
            material: color,
            depthFailMaterial: color.withAlpha(0.55),
            clampToGround: true
          }
        });
        const last = located[located.length - 1];
        addAgentGroundLabel(Cesium, add, last.lon, last.lat, t2("measure.total", { value: formatDistance(distance) }));
      }
    } else if (mode === "area") {
      if (points.length < 3) throw new Error(t2("agent.badMeasure", { message: "area needs at least 3 points" }));
      const area = planarArea(Cesium, ground);
      const perimeter = geodesicLength(Cesium, [...ground, ground[0]]);
      result.area_m2 = round(area);
      result.area_km2 = round(area / 1e6, 6);
      result.perimeter_m = round(perimeter);
      if (draw) {
        add({ polygon: { hierarchy: new Cesium.PolygonHierarchy(ground), material: color.withAlpha(0.28), outline: false, perPositionHeight: false } });
        add({
          polyline: {
            positions: [...ground, ground[0]],
            width: 3,
            material: color,
            depthFailMaterial: color.withAlpha(0.55),
            clampToGround: true
          }
        });
        let lon = 0;
        let lat = 0;
        for (const point of located) {
          lon += point.lon;
          lat += point.lat;
        }
        addAgentGroundLabel(Cesium, add, lon / located.length, lat / located.length, t2("measure.areaLabel", { value: formatArea(area) }));
      }
    } else if (mode === "height") {
      if (points.length !== 2) throw new Error(t2("agent.badMeasure", { message: "height needs exactly 2 points" }));
      const from = located[0];
      const to = located[1];
      const delta = to.height - from.height;
      const horizontal = new Cesium.EllipsoidGeodesic(
        Cesium.Cartographic.fromDegrees(from.lon, from.lat, from.height),
        Cesium.Cartographic.fromDegrees(to.lon, to.lat, to.height)
      ).surfaceDistance;
      const slope = horizontal > 0 ? Math.atan2(delta, horizontal) * 180 / Math.PI : 0;
      result.height_m = round(delta);
      result.height_from_m = round(from.height);
      result.height_to_m = round(to.height);
      result.horizontal_m = round(horizontal);
      result.slope_deg = round(slope, 2);
      if (draw) {
        for (const point of located) dot(point.lon, point.lat, point.height);
        add({
          polyline: {
            positions: located.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height)),
            width: 3,
            material: color,
            depthFailMaterial: color.withAlpha(0.55)
          }
        });
        addAgentGroundLabel(Cesium, add, to.lon, to.lat, `${t2("measure.height", { value: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} m`, distance: formatDistance(horizontal) })}`);
      }
    } else {
      throw new Error(t2("agent.badMeasure", { message: `unsupported mode ${String(mode)}` }));
    }
    if (draw) {
      state.measuredCount += points.length;
      const command = { mode, points, draw: true, result };
      state.entityGroups.set(command, state.measure.slice(firstEntity));
      state.measureCommands.push(command);
      markSceneDirty();
    }
    syncAgentOverlayCount();
    return result;
  }
  const analysisEngine = createAnalysisEngine({
    getCesium: () => cesiumRef.current,
    getViewer: () => viewerRef.current,
    getLayers: () => layersRef.current,
    findLayer,
    state: analysisRef,
    commandRef: analysisCommandRef,
    setAnalysis,
    markSceneDirty: () => markSceneDirty(),
    t: t2
  });
  const clearAnalysis = () => analysisEngine.clear();
  const analyzeCommand = (args = {}) => analysisEngine.command(args);
  const shaderEngine = createShaderEngine({
    getCesium: () => cesiumRef.current,
    getViewer: () => viewerRef.current,
    getLayers: () => layersRef.current,
    findLayer,
    entries: shaderEntriesRef,
    tickRef: shaderTickRef,
    setShaderActive
  });
  const shaderCommand = (args = {}) => shaderEngine.command(args);
  const shaderActiveList = () => shaderEngine.activeList();
  const detachShaderForLayer = (id, restore) => shaderEngine.detachForLayer(id, restore);
  const releaseShaderTick = () => shaderEngine.releaseTick();
  const sceneDirtyRef = import_react12.default.useRef(false);
  const sceneRestoredRef = import_react12.default.useRef(false);
  const hostSceneStore = createHostSceneStore({
    getMeta: () => metaRef.current,
    loadMeta,
    normalizeSceneSnapshot,
    readSceneSnapshot,
    writeSceneSnapshot
  });
  const { readHostSceneSnapshot, saveHostSceneSnapshot, loadSceneSnapshot } = hostSceneStore;
  const markSceneDirty = () => {
    sceneDirtyRef.current = true;
  };
  const currentSceneSnapshot = () => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return null;
    const carto = viewer.camera.positionCartographic;
    const round = (value) => Math.round(value * 1e6) / 1e6;
    return {
      view: {
        lon: round(Cesium.Math.toDegrees(carto.longitude)),
        lat: round(Cesium.Math.toDegrees(carto.latitude)),
        height: Math.round(carto.height),
        heading: Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0)),
        pitch: Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0))
      },
      layers: layersRef.current.filter(
        (layer) => layer.source !== null && typeof layer.source === "object" && (typeof layer.source.path === "string" || typeof layer.source.url === "string")
      ).map((layer) => ({ name: layer.name, source: layer.source, visible: layer.visible !== false })),
      annotations: {
        draw: agentOverlayRef.current.drawCommands,
        measure: agentOverlayRef.current.measureCommands
      },
      analysis: analysisCommandRef.current,
      shaders: [...shaderEntriesRef.current.values()].map((entry) => ({
        layer: entry.layerName,
        preset: entry.preset,
        params: { ...entry.params }
      }))
    };
  };
  const saveSceneSnapshot = (forceHost = false) => {
    const session = sessionRef.current;
    if (typeof session !== "string" || session === "") return;
    try {
      const snapshot = currentSceneSnapshot();
      if (snapshot === null) return;
      const body = writeSceneSnapshot(session, snapshot);
      if (body !== null) saveHostSceneSnapshot(session, body, forceHost);
      sceneDirtyRef.current = false;
    } catch {
    }
  };
  const RESTORE_LAYER_TIMEOUT_MS = 8e3;
  const restoreTimedOut = /* @__PURE__ */ Symbol("restore-timeout");
  const withRestoreTimeout = (promise, ms = RESTORE_LAYER_TIMEOUT_MS) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(restoreTimedOut), ms))]);
  async function restoreSceneSnapshot(snapshot) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || snapshot === null) return;
    setRestoringScene(snapshot.layers.length > 0);
    try {
      if (snapshot.view !== null) {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(snapshot.view.lon, snapshot.view.lat, snapshot.view.height),
          orientation: {
            heading: Cesium.Math.toRadians(snapshot.view.heading),
            pitch: Cesium.Math.toRadians(snapshot.view.pitch),
            roll: 0
          }
        });
      }
      let timedOut = false;
      for (const item of snapshot.layers) {
        const source = item.source;
        let url = "";
        if (typeof source.path === "string" && source.path !== "") {
          try {
            url = await withRestoreTimeout(localPathToUrl(source.path), 3e3);
          } catch {
            continue;
          }
          if (url === restoreTimedOut) {
            timedOut = true;
            continue;
          }
        } else if (typeof source.url === "string" && /^https?:\/\//i.test(source.url)) {
          url = source.url;
        }
        if (url === "") continue;
        try {
          const layer = await withRestoreTimeout(loadTileset(url, item.name, source, { fly: false }));
          if (layer === restoreTimedOut) {
            timedOut = true;
            continue;
          }
          if (item.visible === false) setLayerVisible(layer.id, false);
        } catch {
        }
      }
      if (timedOut) {
        setBusy("");
        showToast(t2("toast.restoreTimeout"));
      }
      for (const command of snapshot.annotations.draw) {
        try {
          drawAgentOverlay(Cesium, viewer, command.geojson, command.style, command.caption);
        } catch {
        }
      }
      for (const command of snapshot.annotations.measure) {
        try {
          measureAgentOverlay(Cesium, viewer, command);
        } catch {
        }
      }
      for (const item of snapshot.shaders) {
        try {
          await shaderCommand({ action: "apply", preset: item.preset, layer: item.layer, ...item.params ?? {} });
        } catch {
        }
      }
      if (snapshot.analysis !== null) {
        try {
          await analyzeCommand(snapshot.analysis);
        } catch {
        }
      }
    } finally {
      setRestoringScene(false);
      sceneDirtyRef.current = false;
    }
  }
  function layerLabel(tileset) {
    const found = layersRef.current.find((entry) => entry.tileset === tileset);
    return found ? found.name : t2("model.unnamed");
  }
  const pointerTools = createPointerTools({
    getCesium: () => cesiumRef.current,
    getViewer: () => viewerRef.current,
    toolRef,
    measureRef,
    setPickInfo,
    showToast,
    pickSurface,
    redrawMeasure,
    onFinishTool: () => setTool(null),
    formatValue,
    layerLabel,
    // "识别模式" route: the click lands in ui/selection-overlay.js.
    onIdentify: (position) => selectionApiRef.current?.(position),
    t: t2
  });
  const { pickResult, pickAt, onCanvasClick } = pointerTools;
  const finishMeasure = () => pointerTools.finishMeasure();
  function resetView() {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(104, 31, 14e6),
      // The longest flight in the panel (ground → 14,000 km): give it room
      // instead of the old 1.2 s yank.
      duration: 2.4
    });
  }
  const setChromeHidden = (hidden) => {
    const root = rootRef.current;
    if (root) root.classList.toggle("mv-capturing", hidden);
  };
  const drawCaptureOverlay = createCaptureHud({
    getViewer: () => viewerRef.current,
    getCesium: () => cesiumRef.current,
    getSources: () => sourcesRef.current,
    getLayers: () => layersRef.current,
    getMeta: () => metaRef.current,
    getReadout: () => captureReadoutRef.current,
    t: t2
  });
  const nextFrames = (count) => new Promise((resolve) => {
    let left = count;
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  const capture = createCaptureService({
    getViewer: () => viewerRef.current,
    getRoot: () => rootRef.current,
    getSettings: () => sourcesRef.current,
    getMeta: () => metaRef.current,
    getSession: () => sessionRef.current,
    t: t2,
    showToast,
    setChromeHidden,
    nextFrames,
    drawCaptureOverlay
  });
  const { renderSnapshot, screenshot, captureScene } = capture;
  const selectionController = createSelectionController({
    getViewer: () => viewerRef.current,
    getCesium: () => cesiumRef.current,
    getLayers: () => layersRef.current,
    getMeta: () => metaRef.current
  });
  function measureFromSelection(anchor) {
    if (!anchor) return;
    setToolMode("height");
    measureRef.current.points = [anchor];
    redrawMeasure("height");
  }
  const tour = useTour({
    t: t2,
    showToast,
    getCurrentView: () => currentSceneSnapshot()?.view ?? null,
    onFlyView: (view) => flyToBookmark(viewerRef.current, cesiumRef.current, view),
    onFinish: () => void screenshot()
  });
  const askAgentService = createAskAgent({
    getMeta: () => metaRef.current,
    getSession: () => sessionRef.current,
    getAnalysis: () => analysis,
    showToast,
    t: t2,
    captureScene,
    collectSceneStatus,
    shaderActiveList,
    message
  });
  const askAgent = () => askAgentService.askAgent();
  const sceneReport = createSceneReport({
    getSession: () => sessionRef.current,
    getAgentOverlays: () => agentOverlayRef.current,
    getAnalysis: () => analysis,
    captureScene,
    collectSceneStatus,
    shaderActiveList,
    formatDistance,
    formatArea,
    escapeHtml,
    arrayBufferToBase64,
    isChinese,
    message
  });
  const buildSceneReport = (args = {}) => sceneReport.buildSceneReport(args);
  function setLayerVisible(id, visible) {
    const layer = layersRef.current.find((item) => item.id === id);
    if (!layer) return null;
    layer.visible = visible;
    layer.tileset.show = visible;
    syncLayers();
    return layer;
  }
  function toggleLayer(id) {
    const layer = layersRef.current.find((item) => item.id === id);
    if (!layer) return;
    setLayerVisible(id, !layer.visible);
  }
  function findLayer(token) {
    if (typeof token !== "string" || token.trim() === "") return null;
    const value = token.trim();
    const byId = layersRef.current.find((layer) => layer.id === value);
    if (byId) return byId;
    const lowered = value.toLowerCase();
    return layersRef.current.find((layer) => layer.name.toLowerCase() === lowered) ?? null;
  }
  function flyToLayer(id) {
    const layer = layersRef.current.find((item) => item.id === id);
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!layer || !viewer) return;
    const center = layer.tileset?.boundingSphere?.center;
    const distance = Cesium && center ? Cesium.Cartesian3.distance(viewer.camera.positionWC, center) : 0;
    viewer.flyTo(layer.tileset, { duration: flightDuration(distance) });
  }
  function persistOverlays(next) {
    const current = sourcesRef.current;
    if (!current) return;
    commitSources({ ...current, rasterOverlays: next });
  }
  function overlayCatalog() {
    return Array.isArray(sourcesRef.current?.rasterOverlays) ? sourcesRef.current.rasterOverlays : [];
  }
  function addOverlay(draft) {
    const next = [...overlayCatalog(), { ...draft, id: `overlay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }];
    persistOverlays(next);
    void overlayLayersRef.current?.sync(next).catch(() => {
    });
  }
  function removeOverlay(id) {
    const next = overlayCatalog().filter((item) => item.id !== id);
    persistOverlays(next);
    void overlayLayersRef.current?.sync(next).catch(() => {
    });
  }
  function setOverlayOpacity(id, opacity) {
    persistOverlays(overlayCatalog().map((item) => item.id === id ? { ...item, opacity } : item));
    void overlayLayersRef.current?.setOpacity(id, opacity);
  }
  function setOverlayVisible(id, visible) {
    persistOverlays(overlayCatalog().map((item) => item.id === id ? { ...item, visible } : item));
    void overlayLayersRef.current?.setVisible(id, visible);
  }
  function moveOverlay(id, delta) {
    const list = [...overlayCatalog()];
    const index = list.findIndex((item2) => item2.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    persistOverlays(list);
    void overlayLayersRef.current?.sync(list).catch(() => {
    });
  }
  function removeLayer(id) {
    const viewer = viewerRef.current;
    const index = layersRef.current.findIndex((item) => item.id === id);
    if (index < 0 || !viewer) return null;
    if (analysisRef.current.layerId === id) clearAnalysis();
    detachShaderForLayer(id, false);
    const [layer] = layersRef.current.splice(index, 1);
    try {
      viewer.scene.primitives.remove(layer.tileset);
    } catch {
    }
    syncLayers();
    return layer;
  }
  function collectStats() {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return null;
    const layerRows = layersRef.current.map((layer) => {
      const statistics = layer.tileset.statistics ?? {};
      return {
        id: layer.id,
        name: layer.name,
        tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded,
        pending: statistics.numberOfPendingRequests,
        triangles: statistics.numberOfTrianglesSelected,
        memory: layer.tileset.cacheBytes ?? layer.tileset.totalMemoryUsageInBytes
      };
    });
    const heading = Cesium.Math.toDegrees(viewer.camera.heading ?? 0);
    const pitch = Cesium.Math.toDegrees(viewer.camera.pitch ?? 0);
    return {
      height: formatHeight(viewer.camera.positionCartographic.height),
      heading: `${heading.toFixed(0)}°`,
      pitch: `${pitch.toFixed(0)}°`,
      layers: layerRows
    };
  }
  function sourceOfLayer(layer) {
    if (layer?.source) return layer.source;
    if (typeof layer?.url === "string" && /^https?:\/\//i.test(layer.url)) {
      return { kind: "remote", url: layer.url };
    }
    return null;
  }
  function layerRuntime(layer) {
    const statistics = layer?.tileset?.statistics ?? {};
    const memory = layer?.tileset?.cacheBytes ?? layer?.tileset?.totalMemoryUsageInBytes;
    return {
      tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded ?? 0,
      pending: statistics.numberOfPendingRequests ?? 0,
      triangles: statistics.numberOfTrianglesSelected ?? 0,
      memory: typeof memory === "number" ? memory : 0
    };
  }
  async function inspectLayer(layerId) {
    const layer = layersRef.current.find((entry) => entry.id === layerId);
    if (!layer) return;
    const source = sourceOfLayer(layer);
    if (!source) {
      showToast(t2("health.noSource"));
      return;
    }
    const meta2 = metaRef.current;
    if (!meta2?.token || !meta2.inspectUrl && !meta2.scanUrl) {
      showToast(t2("health.failed", { message: t2("agent.notReady") }));
      return;
    }
    const endpoint = meta2.inspectUrl ?? `${meta2.scanUrl.replace(/\/scan$/, "")}/inspect`;
    const requestSeq = healthSeqRef.current + 1;
    healthSeqRef.current = requestSeq;
    setHealth({ loading: true, layer: layer.name, source });
    try {
      const response = await fetch(`${endpoint}?token=${encodeURIComponent(meta2.token)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-dsh-panel": "1" },
        body: JSON.stringify({ source, deep: false, runtime: layerRuntime(layer) })
      });
      const data = await response.json().catch(() => null);
      if (requestSeq !== healthSeqRef.current) return;
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setHealth({ loading: false, layer: layer.name, source, report: data.report, reportPath: data.reportPath });
    } catch (error2) {
      if (requestSeq !== healthSeqRef.current) return;
      setHealth({ loading: false, layer: layer.name, source, error: message(error2) });
      showToast(t2("health.failed", { message: message(error2) }));
    }
  }
  const closeHealth = () => {
    healthSeqRef.current += 1;
    setHealth(null);
  };
  async function submitUrl() {
    const value = urlInput.trim();
    if (!value) return;
    let url = value;
    if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\")) {
      try {
        url = await localPathToUrl(value);
      } catch (error2) {
        showToast(message(error2));
        return;
      }
    } else if (!/^https?:\/\//i.test(value)) {
      showToast(t2("toast.invalidUrl"));
      return;
    }
    setUrlBar(false);
    setUrlInput("");
    const local = /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\");
    const source = local ? { kind: "local", path: value } : { kind: "remote", url: value };
    await addTileset(url, value.split(/[\\/]/).filter(Boolean).slice(-2).join("/"), source);
  }
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clampNumber = (value, fallback, minimum, maximum) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(number, minimum), maximum);
  };
  const sceneStatus = createSceneStatus({
    getCesium: () => cesiumRef.current,
    getViewer: () => viewerRef.current,
    getSources: () => sourcesRef.current,
    getLayers: () => layersRef.current,
    getOverlayLayers: () => overlayLayersRef.current,
    getAgentOverlays: () => agentOverlayRef.current,
    getToolMode: () => toolRef.current,
    getFps: () => fps,
    getBusy: () => busy,
    t: t2,
    redactUrl,
    normalizeQuality
  });
  function collectSceneStatus() {
    return sceneStatus.collectSceneStatus();
  }
  const commandBridge = createCommandBridge({
    getCesium: () => cesiumRef.current,
    getViewer: () => viewerRef.current,
    getSources: () => sourcesRef.current,
    getLayers: () => layersRef.current,
    getMeta: () => metaRef.current,
    getAgentOverlays: () => agentOverlayRef.current,
    t: t2,
    findLayer,
    normalizeAccessRequest,
    askPathAccess,
    collectSceneStatus,
    captureScene,
    redactUrl,
    analyzeCommand,
    shaderCommand,
    message,
    sourceOfLayer,
    layerRuntime,
    localPathToUrl,
    loadTileset,
    removeLayer,
    setLayerVisible,
    applyImagery,
    updateSettings,
    applyTerrain,
    clampNumber,
    delay,
    resetView,
    pickResult,
    clearAgentOverlays: clearAgentOverlays2,
    drawAgentOverlay,
    measureAgentOverlay,
    buildSceneReport
  });
  const runCommand = (action, args = {}, session = null) => commandBridge.runCommand(action, args, session);
  commandRef.current = runCommand;
  import_react12.default.useEffect(() => {
    if (!sessionId || !meta?.bridgeUrl) return void 0;
    const bridgeSession = sessionId;
    const endpoint = `${meta.bridgeUrl}?token=${encodeURIComponent(meta.token)}&session=${encodeURIComponent(bridgeSession)}`;
    let source;
    try {
      source = new EventSource(endpoint);
    } catch {
      return void 0;
    }
    let retries = 0;
    let retryTimer = null;
    const ack = async (body) => {
      try {
        await fetch(`${meta.bridgeUrl}?token=${encodeURIComponent(meta.token)}`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
      } catch {
      }
    };
    const onHello = () => {
      retries = 0;
      setBridgeReload(false);
      setBridgeOn(true);
    };
    const onCommand = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload?.id) return;
      commandChainRef.current = commandChainRef.current.then(async () => {
        try {
          if (payload.action !== "authorize") await waitForPanelReady();
          const result = await commandRef.current(payload.action, payload.args ?? {}, bridgeSession);
          await ack({ session: bridgeSession, id: payload.id, ok: true, result });
        } catch (error2) {
          await ack({ session: bridgeSession, id: payload.id, ok: false, error: message(error2) });
        }
      }).catch(() => {
      });
    };
    const onError = () => {
      setBridgeOn(false);
      if (retries >= 4 || retryTimer !== null) return;
      retries += 1;
      retryTimer = setTimeout(async () => {
        retryTimer = null;
        try {
          const fresh = await loadMeta(true);
          if (!fresh) return;
          const changed = fresh.token !== metaRef.current?.token || fresh.bridgeUrl !== metaRef.current?.bridgeUrl;
          metaRef.current = fresh;
          setMeta(fresh);
          if (changed) setBridgeEpoch((value) => value + 1);
        } catch {
        }
        if (retries >= 4) setBridgeReload(true);
      }, Math.min(4e3, 500 * 2 ** (retries - 1)));
    };
    source.addEventListener("hello", onHello);
    source.addEventListener("command", onCommand);
    source.addEventListener("error", onError);
    setBridgeOn(false);
    return () => {
      if (retryTimer !== null) clearTimeout(retryTimer);
      source.removeEventListener("hello", onHello);
      source.removeEventListener("command", onCommand);
      source.removeEventListener("error", onError);
      try {
        source.close();
      } catch {
      }
    };
  }, [sessionId, meta, bridgeEpoch]);
  import_react12.default.useEffect(
    () => () => {
      const current = accessRef.current;
      if (!current) return;
      accessRef.current = null;
      clearTimeout(current.timer);
      current.resolve({ allowed: false, message: t2("access.denied") });
    },
    []
  );
  import_react12.default.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta2 = await loadMeta();
        if (cancelled) return;
        metaRef.current = meta2;
        setMeta(meta2);
        const [Cesium, catalog] = await Promise.all([loadCesium(), loadSources(meta2)]);
        await loadCesiumStyle();
        if (cancelled || !globeRef.current) return;
        cesiumRef.current = Cesium;
        sourcesRef.current = catalog.config;
        setSources(catalog.config);
        setDefaults(catalog.defaults);
        const viewer = new Cesium.Viewer(globeRef.current, {
          baseLayer: false,
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          infoBox: false,
          selectionIndicator: false,
          fullscreenButton: false,
          vrButton: false,
          creditContainer: creditRef.current,
          // `msaaSamples` is a context-creation option, so the tier is read
          // here and applied live by applyQuality() right after construction;
          // switching tiers later re-applies everything except this one.
          msaaSamples: qualityProfile(catalog.config.settings?.quality).msaaSamples,
          // No `preserveDrawingBuffer`: it forces a full-resolution framebuffer
          // copy and disqualifies the compositor fast path on EVERY frame, which
          // is exactly the kind of millisecond that pushes a 60 FPS frame past the
          // 16.7 ms vsync and makes it render at 30. Captures still work because
          // renderSnapshot() calls viewer.render() and reads the canvas in the
          // SAME synchronous task (see renderSnapshot: no await between them) —
          // keep that invariant if you touch either site.
          contextOptions: { webgl: { preserveDrawingBuffer: false } }
        });
        viewerRef.current = viewer;
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#060a12");
        applyQuality(viewer, catalog.config.settings?.quality);
        viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(104, 31, 14e6) });
        await applyImagery(catalog.config.settings.imagery, false);
        if (catalog.config.settings.terrain) void applyTerrain(catalog.config.settings.terrain, false).catch(() => {
        });
        applyGlobeDepthTest();
        overlayLayersRef.current = createOverlayLayers({
          Cesium,
          viewer,
          // The panel owns the provider mapping; the stack stays browser-free.
          providerFactory: imageryProvider,
          onError: (error2, source) => showToast(t2("toast.overlayFailed", { name: source?.name ?? "", message: message(error2) }))
        });
        try {
          await withNetworkTimeout(overlayLayersRef.current.sync(catalog.config.rasterOverlays ?? []), 1e4);
        } catch {
        }
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((event) => onCanvasClick(event.position), Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.setInputAction(
          (event) => {
            if (toolRef.current && toolRef.current !== "identify") {
              finishMeasure();
              return;
            }
            const viewerNow = viewerRef.current;
            const scene = viewerNow?.scene;
            if (!viewerNow || !scene) return;
            const carto = sampleCursor(viewerNow, Cesium, event.position, { pickPosition: true });
            if (carto) flyToCartographic(viewerNow, Cesium, carto);
          },
          Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );
        handlerRef.current = handler;
        viewer.camera.moveEnd.addEventListener(markSceneDirty);
        const savedScene = typeof sessionId === "string" && sessionId !== "" ? await loadSceneSnapshot(sessionId) : null;
        sceneRestoredRef.current = typeof sessionId === "string" && sessionId !== "";
        settleReadyWaiters();
        setPhase("ready");
        if (savedScene !== null && !cancelled) {
          void restoreSceneSnapshot(savedScene).catch(() => {
          });
        }
      } catch (error2) {
        if (!cancelled) {
          settleReadyWaiters(error2 instanceof Error ? error2 : new Error(String(error2)));
          setError(message(error2));
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      saveSceneSnapshot(true);
      readyGateRef.current.ready = false;
      settleReadyWaiters(new Error(t2("agent.notReady")));
      clearTimeout(toastTimer.current);
      try {
        handlerRef.current?.destroy();
      } catch {
      }
      handlerRef.current = null;
      releaseShaderTick();
      shaderEntriesRef.current.clear();
      void overlayLayersRef.current?.dispose();
      overlayLayersRef.current = null;
      try {
        viewerRef.current?.destroy();
      } catch {
      }
      viewerRef.current = null;
      layersRef.current = [];
    };
  }, []);
  import_react12.default.useEffect(() => {
    if (phase !== "ready" || sceneRestoredRef.current) return void 0;
    if (typeof sessionId !== "string" || sessionId === "") return void 0;
    sceneRestoredRef.current = true;
    let cancelled = false;
    void (async () => {
      const snapshot = await loadSceneSnapshot(sessionId);
      if (!cancelled && snapshot !== null) await restoreSceneSnapshot(snapshot);
    })().catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [phase, sessionId]);
  import_react12.default.useEffect(() => {
    const timer = setInterval(() => {
      if (sceneDirtyRef.current) saveSceneSnapshot();
    }, 3e3);
    const flush = () => {
      if (sceneDirtyRef.current) saveSceneSnapshot(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  import_react12.default.useEffect(() => {
    if (!openMenu) return void 0;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [openMenu]);
  import_react12.default.useEffect(() => {
    if (openMenu === "data") refreshRecentDirs();
  }, [openMenu, meta?.directoriesUrl]);
  import_react12.default.useEffect(() => {
    if (phase !== "ready") return void 0;
    const element = globeRef.current;
    if (!element || typeof ResizeObserver === "undefined") return void 0;
    const observer = new ResizeObserver(() => {
      try {
        viewerRef.current?.resize();
      } catch {
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [phase]);
  import_react12.default.useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === rootRef.current);
      try {
        viewerRef.current?.resize();
      } catch {
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  import_react12.default.useEffect(() => {
    if (phase !== "ready") return void 0;
    const viewer = viewerRef.current;
    if (!viewer) return void 0;
    const scene = viewer.scene;
    const canvas = scene.canvas;
    let frames = 0;
    let last = performance.now();
    let lastFrameAt = last;
    let ema = 0;
    let lost = false;
    const onFrame = () => {
      frames += 1;
      lastFrameAt = performance.now();
    };
    const onLost = () => {
      lost = true;
      frames = 0;
      ema = 0;
    };
    const onRestored = () => {
      lost = false;
      frames = 0;
      last = performance.now();
    };
    scene.postRender.addEventListener(onFrame);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;
      const idle = lost || document.visibilityState === "hidden" || now - lastFrameAt > 2e3;
      if (idle) {
        frames = 0;
        last = now;
        ema = 0;
        setFps((previous) => previous === null ? previous : null);
        return;
      }
      const instant = elapsed > 0 ? frames * 1e3 / elapsed : 0;
      frames = 0;
      last = now;
      ema = ema === 0 ? instant : ema * 0.8 + instant * 0.2;
      const value = Math.round(ema);
      setFps((previous) => previous === value ? previous : value);
    }, 500);
    return () => {
      clearInterval(timer);
      scene.postRender.removeEventListener(onFrame);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [phase]);
  import_react12.default.useEffect(() => {
    if (!scan) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") setScan(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scan]);
  const measureMode = tool === "distance" || tool === "area" || tool === "height";
  import_react12.default.useEffect(() => {
    if (!measureMode) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") setToolMode(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [measureMode]);
  import_react12.default.useEffect(() => {
    if (phase !== "ready") return void 0;
    let lastKey = "";
    const timer = setInterval(() => {
      const next = collectStats();
      const key = next === null ? "null" : JSON.stringify(next);
      if (key === lastKey) return;
      lastKey = key;
      setStats(next);
    }, 1e3);
    return () => clearInterval(timer);
  }, [phase]);
  import_react12.default.useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (phase !== "ready" || !viewer || !Cesium) return;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(resolvedDark ? "#05080f" : "#dde6f2");
    viewer.scene.globe.showGroundAtmosphere = resolvedDark;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = resolvedDark;
    viewer.scene.requestRender?.();
  }, [phase, resolvedDark]);
  const button = (label, onClick, active, extra, title) => h9(
    "button",
    { type: "button", className: `mv-btn${active ? " on" : ""}${extra ? ` ${extra}` : ""}`, onClick, title },
    label
  );
  const iconButton = (icon, title, onClick, active) => h9(
    "button",
    {
      type: "button",
      className: `mv-btn icon${active ? " on" : ""}`,
      title,
      "aria-label": title,
      "aria-pressed": active === void 0 ? void 0 : active,
      onClick
    },
    icon
  );
  const menu = (id, label, items, active) => h9(
    "div",
    { key: id, className: "mv-menu" },
    button(`${label} ▾`, () => setOpenMenu(openMenu === id ? null : id), active),
    openMenu === id ? h9("div", { className: "mv-menu-panel mv-glass" }, items) : null
  );
  const status = busy || (phase === "loading" ? t2("panel.status.loading") : layers.length ? t2("panel.status.layers", { n: layers.length }) : t2("panel.status.ready"));
  const hudLabels = {
    pointer: t2("hud.pointer"),
    camera: t2("hud.camera"),
    heading: t2("hud.heading"),
    tiles: t2("hud.tiles"),
    pending: t2("hud.pending"),
    triangles: t2("hud.triangles"),
    cache: t2("hud.cache")
  };
  const hudDetailed = sources?.settings?.hudDetailed === true;
  const workbench = createWorkbenchWiring({
    getForm: () => shaderForm,
    getLayers: () => layers,
    setShaderForm,
    shaderCommand,
    showToast,
    t: t2,
    shaderCompare: (layer, enabled) => shaderEngine.compare(layer, enabled)
  });
  return h9(
    "div",
    {
      ref: rootRef,
      className: `mv-root${docked ? " mv-docked" : ""}`,
      "data-mv-theme": themeMode === "auto" ? void 0 : themeMode,
      "data-mv-scheme": resolvedDark ? "dark" : "light"
    },
    h9("style", { key: "css" }, CSS),
    h9("div", { key: "globe", ref: globeRef, className: "mv-globe" }),
    activeImagery?.credit ? h9("div", { key: "attr", className: "mv-attr" }, `${t2("credit.imagery")} © ${activeImagery.credit}`) : null,
    h9("div", { key: "credits", ref: creditRef, className: "mv-credits" }),
    h9(
      "div",
      { key: "top", className: "mv-top" },
      h9(
        "div",
        { className: "mv-brand mv-glass" },
        h9(ViewerIcon, { size: 18 }),
        h9("b", null, t2("panel.title")),
        h9("span", null, status)
      ),
      h9(
        "div",
        { ref: menuRef, className: "mv-actions mv-glass" },
        menu(
          "data",
          t2("btn.data"),
          [
            h9(MenuItem, { key: "local", onClick: pickLocal }, t2("btn.openLocal")),
            recentDirs.length ? h9(
              import_react12.default.Fragment,
              { key: "recent" },
              h9("span", { className: "mv-menu-label" }, t2("menu.recentDirs")),
              ...recentDirs.map(
                (entry) => h9(
                  MenuItem,
                  { key: entry.dir, title: entry.dir, onClick: () => openRecentDirectory(entry.dir) },
                  h9("span", { className: "ellipsis" }, entry.name)
                )
              )
            ) : null,
            agentOverlayCount > 0 ? h9(
              MenuItem,
              {
                key: "clearAgent",
                onClick: () => {
                  setOpenMenu(null);
                  clearAgentOverlays2("all");
                  showToast(t2("agent.clearedOverlays"));
                }
              },
              t2("menu.clearAgent")
            ) : null,
            h9(
              MenuItem,
              {
                key: "url",
                onClick: () => {
                  setOpenMenu(null);
                  setUrlBar((value) => !value);
                }
              },
              t2("btn.openUrl")
            ),
            h9(
              MenuItem,
              {
                key: "report",
                onClick: async () => {
                  setOpenMenu(null);
                  try {
                    const value = await runCommand("report", { format: "html" });
                    showToast(t2("toast.reportSaved", { path: value.path }));
                  } catch (error2) {
                    showToast(t2("toast.reportFailed", { message: message(error2) }));
                  }
                }
              },
              t2("menu.report")
            ),
            h9("i", { key: "sep", className: "mv-sep", style: { width: "auto", height: ".5px", margin: "4px 8px" } }),
            h9(
              MenuItem,
              {
                key: "clear",
                onClick: () => {
                  setOpenMenu(null);
                  setToolMode(null);
                  setPickInfo(null);
                  setMeasureInfo(null);
                }
              },
              t2("tool.clear")
            )
          ]
        ),
        h9("i", { key: "s1", className: "mv-sep" }),
        menu(
          "measure",
          t2("btn.measure"),
          [
            h9(MenuItem, { key: "distance", active: tool === "distance", onClick: () => setToolMode(tool === "distance" ? null : "distance") }, t2("tool.distance")),
            h9(MenuItem, { key: "area", active: tool === "area", onClick: () => setToolMode(tool === "area" ? null : "area") }, t2("tool.area")),
            h9(MenuItem, { key: "height", active: tool === "height", onClick: () => setToolMode(tool === "height" ? null : "height") }, t2("tool.height")),
            h9(MenuItem, { key: "pick", active: tool === "pick", onClick: () => setToolMode(tool === "pick" ? null : "pick") }, t2("tool.pick"))
          ],
          tool !== null
        ),
        h9("i", { key: "s2", className: "mv-sep" }),
        button(
          `${t2("btn.layers")}${layers.length ? ` ${layers.length}` : ""}`,
          () => updateSettings({ showLayers: !showLayers }),
          // The panel is the only place to pick terrain/basemap now, so it must
          // be reachable even with zero 3D Tiles loaded.
          showLayers,
          void 0,
          showLayers ? t2("btn.layersHide") : t2("btn.layersShow")
        ),
        iconButton(
          h9(HudIcon),
          showHud ? t2("btn.hudHide") : t2("btn.hudShow"),
          () => updateSettings({ showHud: !showHud }),
          showHud
        ),
        iconButton(
          h9(ShaderIcon),
          shaderOpen ? t2("btn.shaderHide") : t2("btn.shaderShow"),
          () => setShaderOpen((value) => !value),
          shaderOpen
        ),
        // v1.7 P0: 指认 — click an object to read it (panel-only, no tool).
        iconButton(h9(IdentifyIcon), t2("btn.identifyHint"), () => setToolMode(tool === "identify" ? null : "identify"), tool === "identify"),
        // Action buttons are icon-only with a tooltip/aria-label: in the docked
        // narrow panel the text labels were what wrapped the toolbar onto a
        // second row. The four dropdown menus keep their text labels because a
        // bare icon does not tell the user what the menu contains.
        iconButton(h9(ScreenshotIcon), t2("btn.screenshot"), screenshot),
        sessionId ? iconButton(h9(AskAgentIcon), t2("btn.askAgent"), askAgent) : null,
        iconButton(h9(ResetIcon), t2("btn.reset"), resetView),
        // Only the main panel offers "open beside chat"; the docked tab is
        // already beside the conversation.
        docked ? null : button(t2("btn.beside"), openBeside),
        // Single fullscreen entry point for both mounts (DOM Fullscreen API).
        // Expanding the sidebar is DSH's own feature, so the duplicate
        // "maximize sidebar" action is gone.
        iconButton(h9(FullscreenIcon), fullscreen ? t2("btn.fullscreenExit") : t2("btn.fullscreenTitle"), toggleDomFullscreen, fullscreen),
        h9("i", { key: "s3", className: "mv-sep" }),
        h9(
          "div",
          { key: "appearance", className: "mv-menu" },
          h9(
            "button",
            {
              type: "button",
              className: "mv-btn icon",
              title: `${t2("btn.appearance")} · ${t2(themeMode === "auto" ? "theme.auto" : themeMode === "light" ? "theme.light" : "theme.dark")}`,
              "aria-haspopup": "menu",
              onClick: () => setOpenMenu(openMenu === "appearance" ? null : "appearance")
            },
            h9(ThemeIcon, { mode: resolvedDark ? "dark" : "light" })
          ),
          openMenu === "appearance" ? h9(
            "div",
            { className: "mv-menu-panel mv-glass" },
            [
              ["auto", "theme.auto"],
              ["light", "theme.light"],
              ["dark", "theme.dark"]
            ].map(
              ([mode, label]) => h9(
                MenuItem,
                {
                  key: mode,
                  active: themeMode === mode,
                  onClick: () => setTheme(mode)
                },
                t2(label)
              )
            )
          ) : null
        ),
        h9(
          "button",
          {
            key: "settings",
            type: "button",
            className: "mv-btn icon",
            title: t2("btn.settings"),
            onClick: () => setSettingsOpen(true)
          },
          h9(
            "svg",
            { viewBox: "0 0 24 24", width: 16, height: 16, "aria-hidden": true, style: { display: "block" } },
            h9(
              "g",
              { stroke: "currentColor", strokeWidth: 1.7, fill: "none", strokeLinecap: "round" },
              h9("circle", { cx: 12, cy: 12, r: 3.2 }),
              h9("path", { d: "M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z" })
            )
          )
        )
      )
    ),
    urlBar ? h9(
      "div",
      { key: "urlbar", className: "mv-urlbar mv-glass" },
      h9("input", {
        autoFocus: true,
        value: urlInput,
        placeholder: t2("urlbar.placeholder"),
        onChange: (event) => setUrlInput(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") submitUrl();
          if (event.key === "Escape") setUrlBar(false);
        }
      }),
      h9("button", { type: "button", onClick: submitUrl }, t2("urlbar.submit"))
    ) : null,
    shaderOpen ? h9(ShaderWorkbench, {
      key: "shader",
      t: t2,
      layers,
      form: shaderForm,
      active: shaderActive,
      onClose: () => {
        void workbench.compare(false);
        setShaderOpen(false);
      },
      onLayer: (layerId) => workbench.field("layerId", layerId),
      onPreset: workbench.toggle,
      onField: workbench.field,
      onApply: workbench.apply,
      onPreview: workbench.preview,
      target: workbench.target(),
      onPresetMove: workbench.move,
      onCompare: workbench.compare,
      onResetLayer: workbench.resetLayer,
      onResetAll: workbench.resetAll
    }) : null,
    // v1.7 P0: 指认 card + corner brackets (panel-only) and the tour bar.
    h9(SelectionOverlay, {
      key: "selection",
      active: tool === "identify",
      apiRef: selectionApiRef,
      controller: selectionController,
      renderSnapshot,
      t: t2,
      showToast,
      onMeasure: measureFromSelection
    }),
    tour.element,
    analysis || showLayers ? h9(
      "div",
      { key: "right", className: "mv-right" },
      analysis ? h9(AnalysisCard, { key: "analysis", state: analysis, t: t2, onClose: () => clearAnalysis() }) : null,
      showLayers ? h9(LayersPanel, {
        key: "layers",
        t: t2,
        config: sources,
        settings: sources?.settings ?? {},
        layers,
        annotations: {
          drawn_features: agentOverlayRef.current.drawnFeatures,
          measured_points: agentOverlayRef.current.measuredCount
        },
        onCollapse: () => updateSettings({ showLayers: false }),
        onSelectTerrain: changeTerrain,
        onSelectImagery: changeImagery,
        terrainError,
        onRetryTerrain: () => applyTerrain(sourcesRef.current?.settings?.terrain ?? null, true),
        onFlyLayer: flyToLayer,
        onFrameAll: () => frameAllLayers(viewerRef.current, cesiumRef.current, layersRef.current),
        analysis,
        onClearAnalysis: () => clearAnalysis(),
        // Shader effects hang off their 3D Tiles layer row: hover shows
        // the effect, clicking the row loads it into the workbench.
        shaderActive,
        onEditLayerShader: (layer, entry) => {
          workbench.loadEntry(entry ?? { layer: layer.name, layerId: layer.id, preset: "height-false-color" });
          setShaderOpen(true);
        },
        onToggleLayer: toggleLayer,
        onInspectLayer: inspectLayer,
        onRemoveLayer: removeLayer,
        onOverlayAdd: addOverlay,
        onOverlayRemove: removeOverlay,
        onOverlayOpacity: setOverlayOpacity,
        onOverlayVisible: setOverlayVisible,
        onOverlayMove: moveOverlay,
        onClearVector: () => clearAgentOverlays2("all"),
        // Camera bookmarks: panel-managed list, storage in localStorage.
        getCurrentView: () => currentSceneSnapshot()?.view ?? null,
        onFlyView: (view) => flyToBookmark(viewerRef.current, cesiumRef.current, view),
        stats,
        onStartTour: tour.start,
        agentOverlays: buildAgentOverlayList(agentOverlayRef.current),
        onRemoveAgentOverlay: (kind, index) => {
          if (!removeAgentOverlay(agentOverlayRef.current, viewerRef.current, kind, index)) return;
          syncAgentOverlayCount();
          markSceneDirty();
        }
      }) : null
    ) : null,
    phase === "ready" && layers.length === 0 && !emptyDismissed && !restoringScene ? h9(
      "div",
      { key: "empty", className: "mv-overlay" },
      h9(
        "div",
        { className: "mv-empty" },
        h9(
          "button",
          {
            type: "button",
            className: "mv-empty-close",
            title: t2("panel.empty.dismiss"),
            "aria-label": t2("panel.empty.dismiss"),
            onClick: () => setEmptyDismissed(true)
          },
          "✕"
        ),
        h9(ViewerIcon, { size: 30 }),
        h9("h2", null, t2("panel.empty.title")),
        h9("p", null, t2("panel.empty.body")),
        h9(
          "div",
          { className: "buttons" },
          h9("button", { type: "button", className: "mv-cta primary", onClick: pickLocal }, t2("panel.empty.local")),
          h9("button", { type: "button", className: "mv-cta", onClick: () => setUrlBar(true) }, t2("panel.empty.url"))
        )
      )
    ) : null,
    phase === "loading" ? h9("div", { key: "loading", className: "mv-overlay dim", role: "status" }, h9("div", { className: "mv-empty" }, h9(LoadingGlobe), h9("p", null, t2("panel.status.loading")))) : null,
    phase === "error" ? h9(
      "div",
      { key: "error", className: "mv-overlay dim" },
      h9(
        "div",
        { className: "mv-empty" },
        h9("h2", null, "⚠"),
        h9("p", null, error),
        h9("div", { className: "buttons" }, h9("button", { type: "button", className: "mv-cta", onClick: () => location.reload() }, t2("btn.retry")))
      )
    ) : null,
    stats && showHud ? h9(StatusHud, { key: "hud", fps, stats, viewerRef, cesiumRef, labels: hudLabels, readoutRef: captureReadoutRef, detailed: hudDetailed }) : null,
    measureInfo ? h9(
      "div",
      { key: "measure", className: "mv-measure mv-glass" },
      h9("span", { className: "text" }, measureInfo.text),
      h9(
        "button",
        {
          type: "button",
          className: "mv-measure-end",
          title: t2("measure.endHint"),
          "aria-label": t2("measure.endHint"),
          onClick: () => setToolMode(null)
        },
        t2("measure.end")
      )
    ) : null,
    pickInfo ? h9(
      "div",
      { key: "pick", className: "mv-pick mv-glass" },
      h9(
        "header",
        null,
        h9("span", null, pickInfo.title),
        h9(
          "button",
          { type: "button", className: "mv-icon-btn", onClick: () => setPickInfo(null), title: t2("btn.close") },
          "✕"
        )
      ),
      h9(
        "table",
        null,
        h9(
          "tbody",
          null,
          pickInfo.rows.map(([name, value]) => h9("tr", { key: name }, h9("td", null, name), h9("td", null, value)))
        )
      )
    ) : null,
    toast ? h9("div", { key: "toast", className: "mv-toast" }, toast) : null,
    scan ? h9(
      "div",
      { key: "scan", className: "mv-modal", onPointerDown: (event) => event.target === event.currentTarget && setScan(null) },
      h9(
        "div",
        { className: "mv-dialog" },
        h9(
          "header",
          null,
          h9("b", null, t2("layers.title")),
          h9("span", { className: "path", style: { fontWeight: 400, color: "var(--mv-dim)" } }, scan.dir),
          h9("button", { type: "button", className: "mv-icon-btn", onClick: () => setScan(null), title: t2("btn.close") }, "✕")
        ),
        h9(
          "div",
          { className: "body" },
          scan.items.map(
            (item) => h9(
              "button",
              {
                key: item.url,
                type: "button",
                className: "mv-cta",
                style: { textAlign: "left", display: "flex", flexDirection: "column", gap: "2px" },
                onClick: () => addTileset(item.url, item.name.split(/[\\/]/).filter(Boolean).slice(-2).join("/"), {
                  kind: "local",
                  path: joinLocalPath(scan.dir, item.name)
                })
              },
              h9("span", null, item.name)
            )
          )
        )
      )
    ) : null,
    health ? h9(HealthDialog, {
      key: "health",
      state: health,
      messages: t2,
      onClose: closeHealth,
      onCopy: async () => {
        const path = health.reportPath ?? health.report?.reportPath;
        if (!path) return;
        try {
          await navigator.clipboard.writeText(path);
          showToast(t2("health.copied"));
        } catch {
          showToast(t2("health.copyFailed"));
        }
      }
    }) : null,
    settingsOpen && sources && defaults ? h9(SourcesDialog, {
      key: "settings",
      config: sources,
      defaults,
      environmentDark,
      themeMode,
      messages: t2,
      meta,
      bridgeOn,
      bridgeReload,
      onPickLocal: pickLocalTiles,
      onSave: saveSources,
      onClose: () => setSettingsOpen(false)
    }) : null,
    accessRequest ? h9(PathAccessDialog, {
      key: "access",
      request: accessRequest,
      busy: accessBusy,
      t: t2,
      onAllow: allowPathAccess,
      onDeny: () => settleAccess({ allowed: false, message: t2("access.denied") })
    }) : null,
    imageryBusy || terrainBusy ? h9("div", { key: "busy", className: "mv-measure mv-glass", style: { bottom: "44px" } }, t2("toast.loadingData")) : null
  );
}

// src/client/ui/layout.js
var h10 = import_react13.default.createElement;
function ViewerPanel(props) {
  return h10(ViewerSurface, { t: props.t, sessionId: null, docked: false });
}
function EarthTabBody(props) {
  const info = typeof props.useTabInfo === "function" ? props.useTabInfo() : null;
  const sessionId = props.sessionId ?? info?.tab?.sessionId ?? info?.sessionId ?? null;
  return h10(ViewerSurface, { t: props.t, sessionId, docked: true });
}

// src/client/ui/tool-row.js
var import_react14 = __toESM(require("react"), 1);
var h11 = import_react14.default.createElement;
function HeaderButton(props) {
  const fallbackT = useTranslation();
  const t2 = typeof props.t === "function" ? props.t : fallbackT;
  const [hover, setHover] = import_react14.default.useState(false);
  return h11(
    "button",
    {
      type: "button",
      title: t2("header.open"),
      "aria-label": t2("header.open"),
      style: {
        appearance: "none",
        border: 0,
        padding: 0,
        margin: 0,
        flex: "none",
        width: 26,
        height: 26,
        borderRadius: 7,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "inherit",
        background: hover ? "rgba(127,127,127,.16)" : "transparent",
        opacity: hover ? 1 : 0.82
      },
      onClick: () => props.onOpen?.(props.sessionId),
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false)
    },
    h11(ViewerIcon, { size: 16 })
  );
}
var ensureToolCss = () => {
  if (typeof document === "undefined") return;
  const id = "@cveo/dsh-digital-earth/tool-row.css";
  if (document.querySelector(`style[data-plugin-css="${id}"]`)) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@cveo/dsh-digital-earth";
  tag.dataset.pluginCss = id;
  tag.textContent = TOOL_CSS;
  document.head.appendChild(tag);
};
var openEarthPanel = () => {
  try {
    const rightbar = service("sidebarRight");
    if (rightbar && typeof rightbar.openTab === "function") {
      rightbar.openTab("digital-earth");
      return;
    }
  } catch {
  }
  service("layout")?.selectPanel?.("digital-earth");
};
var resultFirstLine = (block) => {
  const content = Array.isArray(block?.content) ? block.content : [];
  for (const part of content) {
    if (part?.type !== "text" || typeof part.text !== "string") continue;
    const line = part.text.split("\n").find((item) => item.trim() !== "");
    if (line !== void 0) return line.trim();
  }
  return "";
};
var SCENE_ACTION_KEYS = {
  status: "tool.action.status",
  list: "tool.action.list",
  load: "tool.action.load",
  remove: "tool.action.remove",
  visible: "tool.action.visible",
  basemap: "tool.action.basemap",
  terrain: "tool.action.terrain",
  fly: "tool.action.fly",
  reset: "tool.action.reset",
  pick: "tool.action.pick",
  inspect: "tool.action.inspect",
  report: "tool.action.report"
};
var TOOL_SUMMARY_KEYS = {
  earth_capture: "tool.action.capture",
  earth_draw: "tool.action.draw",
  earth_measure: "tool.action.measure",
  earth_analyze: "tool.action.analyze",
  earth_shader: "tool.action.shader"
};
var AUTO_OPENED_CALLS = /* @__PURE__ */ new Set();
function EarthToolRow({ toolName, phase, block, callId }) {
  const t2 = useTranslation();
  const openedRef = import_react14.default.useRef(false);
  import_react14.default.useEffect(() => {
    if (phase === "result" || openedRef.current) return;
    if (typeof callId === "string" && AUTO_OPENED_CALLS.has(callId)) return;
    if (!readAutoOpen()) return;
    const rightbar = service("sidebarRight");
    if (!rightbar || typeof rightbar.openTab !== "function") return;
    openedRef.current = true;
    try {
      const alreadyOpen = rightbar.isExpanded?.() === true && rightbar.active?.()?.kind === "digital-earth";
      if (!alreadyOpen) rightbar.openTab("digital-earth");
      if (typeof callId === "string") AUTO_OPENED_CALLS.add(callId);
    } catch {
    }
  }, [phase, callId]);
  const [thumbUrl, setThumbUrl] = import_react14.default.useState("");
  import_react14.default.useEffect(() => {
    if (toolName !== "earth_capture" || phase !== "result" || block?.isError === true) return void 0;
    const content = Array.isArray(block?.content) ? block.content : [];
    const text = content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
    const match = /Captured image:\s*(.+)/.exec(text);
    const file = match === null ? "" : String(match[1]).trim().split(/[\\/]/).pop();
    if (file === "") return void 0;
    let cancelled = false;
    loadMeta().then((meta) => {
      if (cancelled) return;
      if (typeof meta?.filesUrl !== "string" || meta.filesUrl === "") return;
      setThumbUrl(`${meta.filesUrl}${encodeURIComponent(file)}`);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [toolName, phase, block]);
  const action = toolName === "earth_scene" ? toolArg(block, "action") : "";
  const state = phase === "result" ? block?.isError === true ? "error" : "ok" : "live";
  const failure = state === "error" ? resultFirstLine(block) : "";
  const summaryKey = toolName === "earth_scene" ? SCENE_ACTION_KEYS[action] ?? "tool.action.generic" : TOOL_SUMMARY_KEYS[toolName] ?? "tool.action.generic";
  const summary = failure !== "" ? failure : t2(summaryKey);
  return h11(
    "div",
    { className: "mv-toolrow", "data-state": state, "data-tool": toolName },
    h11("span", { className: "glyph", "aria-hidden": true }, h11(ViewerIcon, { size: 14 })),
    h11("span", { className: "title" }, t2("panel.title")),
    h11("span", { className: "sep", "aria-hidden": true }),
    h11("span", { className: "summary", title: failure !== "" ? failure : void 0 }, summary),
    thumbUrl === "" ? null : h11(
      "a",
      {
        className: "thumb",
        href: thumbUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        title: t2("tool.thumbOpen")
      },
      h11("img", { src: thumbUrl, alt: "", loading: "lazy" })
    ),
    h11(
      "button",
      { type: "button", className: "open", title: t2("tool.openTip"), onClick: openEarthPanel },
      t2("tool.open")
    )
  );
}

// src/client/plugin.js
var h12 = import_react15.default.createElement;
var plugin = {
  inject: ["slots", "uiWorkspace", "locale", "theme"],
  apply(ctx) {
    setAppCtx(ctx);
    const NS = "dsh-digital-earth";
    ctx.effect(
      () => ctx.locale.register(NS, { zh: MESSAGES.zh, en: MESSAGES.en }),
      "dsh-digital-earth: dictionaries"
    );
    const translate = ctx.locale.bind(NS);
    ensureToolCss();
    ctx.slots.inject(
      "sidebar.panellist",
      () => ctx.slots.register(
        {
          name: "sidebar.panellist",
          id: "digital-earth",
          order: 30,
          label: () => translate("panel.title"),
          locale: NS
        },
        ViewerIcon
      )
    );
    ctx.slots.inject(
      "main",
      () => ctx.slots.register({ name: "main", key: "digital-earth", locale: NS }, ViewerPanel)
    );
    ctx.inject(["sidebarRightTabs"], (scope) => {
      scope.effect(
        () => scope.sidebarRightTabs.register({
          id: "dsh-digital-earth",
          kind: "digital-earth",
          title: () => translate("tab.title"),
          keepMounted: true
        }),
        "dsh-digital-earth: sidebar tab type"
      );
      scope.slots.inject(
        "sidebar.right.pane.tab",
        () => scope.slots.register(
          { name: "sidebar.right.pane.tab", key: "dsh-digital-earth", locale: NS },
          EarthTabBody
        )
      );
    });
    ctx.slots.inject(
      "conversation.session.header.utilities",
      () => ctx.slots.register(
        { name: "conversation.session.header.utilities", id: "digital-earth-open", order: 30, locale: NS },
        (props) => h12(HeaderButton, { ...props, onOpen: openEarthPanel })
      )
    );
    ctx.slots.inject("tool.call.toolview", function* () {
      yield ctx.slots.register({ name: "tool.call.toolview", key: "earth_scene", locale: NS }, EarthToolRow);
      yield ctx.slots.register({ name: "tool.call.toolview", key: "earth_capture", locale: NS }, EarthToolRow);
      yield ctx.slots.register({ name: "tool.call.toolview", key: "earth_draw", locale: NS }, EarthToolRow);
      yield ctx.slots.register({ name: "tool.call.toolview", key: "earth_measure", locale: NS }, EarthToolRow);
      yield ctx.slots.register({ name: "tool.call.toolview", key: "earth_analyze", locale: NS }, EarthToolRow);
      yield ctx.slots.register({ name: "tool.call.toolview", key: "earth_shader", locale: NS }, EarthToolRow);
    });
  }
};
var inject = plugin.inject;
var apply = plugin.apply;
var plugin_default = plugin;

// src/client/index.js
var index_default = plugin_default;
    if (module.exports && module.exports.__esModule) {
      var named = {};
      for (var key in module.exports) named[key] = module.exports[key];
      return named;
    }
    return module.exports;
  },
})
