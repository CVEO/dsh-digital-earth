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
var import_react12 = __toESM(require("react"), 1);

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
    "hud.fpsTitle": "每秒真实渲染帧数（场景静止 2 秒后显示 —）",
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
    "layers.analysisHint": "剖面 / 淹没 / 日照分析由对话 Agent 执行（例如：「对当前图层做一条从 A 到 B 的剖面」）；结果会显示在这里，可一键清除。",
    "layers.analysisClear": "清除分析",
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
    "toast.busyDirectory": "正在打开目录…",
    "toast.terrainLoading": "正在加载地形…",
    "toast.terrainOn": "已开启地形：{name}",
    "toast.terrainOff": "已关闭地形，恢复椭球",
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
    "btn.maximize": "最大化侧栏",
    "btn.maximizeTitle": "最大化侧栏（再次点击返回停靠）",
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
    "toast.askAgentSent": "当前场景已发送到对话，直接输入问题即可。",
    "toast.askAgentFailed": "发送场景失败：{message}",
    "toast.askAgentNoSession": "请先打开一个会话，再使用「问 Agent」。",
    "toast.reportSaved": "场景报告已保存：{path}",
    "toast.reportFailed": "导出报告失败：{message}",
    "toast.noSession": "请先打开一个会话，再在对话旁查看数字地球。",
    "toast.fullscreenUnsupported": "当前浏览器不支持全屏 API。",
    "toast.fullscreenFailed": "全屏失败：{message}",
    "unit.hectare": "公顷"
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
    "hud.fpsTitle": "Real rendered frames per second (— after 2 s without a render)",
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
    "layers.analysisHint": "Profile / flood / sunlight analyses are run by the conversation Agent (e.g. “profile the current layer from A to B”); results appear here and can be cleared in one click.",
    "layers.analysisClear": "Clear analysis",
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
    "toast.busyDirectory": "Opening folder…",
    "toast.terrainLoading": "Loading terrain…",
    "toast.terrainOn": "Terrain enabled: {name}",
    "toast.terrainOff": "Terrain off; ellipsoid restored",
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
    "btn.maximize": "Maximize sidebar",
    "btn.maximizeTitle": "Maximize sidebar (click again to dock)",
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
    "toast.askAgentSent": "Scene sent to the conversation; just type your question.",
    "toast.askAgentFailed": "Could not send the scene: {message}",
    "toast.askAgentNoSession": "Open a conversation first to use Ask Agent.",
    "toast.reportSaved": "Scene report saved: {path}",
    "toast.reportFailed": "Could not export the report: {message}",
    "toast.noSession": "Open a conversation first to view the globe beside it.",
    "toast.fullscreenUnsupported": "This browser does not expose the fullscreen API.",
    "toast.fullscreenFailed": "Fullscreen failed: {message}",
    "unit.hectare": "ha"
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
var h = import_react.default.createElement;
function ViewerIcon({ size = 18 }) {
  return h(
    "svg",
    { viewBox: "0 0 64 64", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h("circle", { cx: 30, cy: 30, r: 20, fill: "none", stroke: "currentColor", strokeWidth: 3 }),
    h("ellipse", { cx: 30, cy: 30, rx: 8.5, ry: 20, fill: "none", stroke: "currentColor", strokeWidth: 2.2, opacity: 0.85 }),
    h("path", { d: "M10.5 30h39M13.5 20.5h33M13.5 39.5h33", stroke: "currentColor", strokeWidth: 2, opacity: 0.55 }),
    h("path", { d: "M48 34l9 5v10l-9 5-9-5V39z", fill: "currentColor", opacity: 0.9 })
  );
}
var ThemeIcon = ({ mode, size = 16 }) => h(
  "svg",
  { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
  mode === "dark" ? h("path", { d: "M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5 8.6 8.6 0 1 0 20.5 14.4z", fill: "currentColor" }) : mode === "light" ? h(
    "g",
    { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", fill: "none" },
    h("circle", { cx: 12, cy: 12, r: 4.1 }),
    h("path", { d: "M12 2.6v1.7M12 19.2v1.7M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" })
  ) : h(
    "g",
    { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", fill: "none" },
    h("circle", { cx: 12, cy: 12, r: 8.4 }),
    h("path", { d: "M12 3.6a8.4 8.4 0 0 0 0 16.8z", fill: "currentColor", stroke: "none" })
  )
);
var FullscreenIcon = ({ size = 15 }) => h(
  "svg",
  { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
  h(
    "g",
    { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" },
    h("path", { d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" })
  )
);
var HudIcon = ({ size = 16 }) => h(
  "svg",
  { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
  h(
    "g",
    { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", fill: "none" },
    h("circle", { cx: 12, cy: 12, r: 5.2 }),
    h("path", { d: "M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4" })
  )
);
function ShaderIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h("path", { d: "M3 7h6.5M13.5 7H21M3 17h4M11 17h10", ...stroke }),
    h("circle", { cx: 11.5, cy: 7, r: 2.4, ...stroke }),
    h("circle", { cx: 8.5, cy: 17, r: 2.4, ...stroke })
  );
}
function ScreenshotIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h("path", { d: "M3.5 8.5h3l1.4-2.2h8.2l1.4 2.2h3v10h-17z", ...stroke }),
    h("circle", { cx: 12, cy: 13, r: 3.4, ...stroke })
  );
}
function ResetIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h("path", { d: "M4 11.5 12 4l8 7.5", ...stroke }),
    h("path", { d: "M6.5 10.5V20h11v-9.5", ...stroke }),
    h("path", { d: "M10 20v-5h4v5", ...stroke })
  );
}
function AskAgentIcon({ size = 16 }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return h(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
    h("path", { d: "M4 5.5h16v10.5H9.5L5 20v-4H4z", ...stroke }),
    h("path", { d: "M8.5 9.5h7M8.5 12.5h4.5", ...stroke })
  );
}

// src/client/ui/layout.js
var import_react10 = __toESM(require("react"), 1);

// src/client/viewer/ViewerSurface.js
var import_react9 = __toESM(require("react"), 1);

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
function frameAllLayers(viewer, Cesium, layers, duration = 1.2) {
  if (!viewer || !Cesium) return false;
  const sphere = combinedBoundingSphere(Cesium, layers);
  if (sphere === null) return false;
  const target = new Cesium.BoundingSphere(sphere.center, sphere.radius * 1.15);
  viewer.camera.flyToBoundingSphere(target, { duration });
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
  vec3 low = vec3(0.16, 0.36, 0.86);
  vec3 midLow = vec3(0.20, 0.78, 0.36);
  vec3 mid = vec3(0.96, 0.90, 0.22);
  vec3 midHigh = vec3(0.98, 0.56, 0.14);
  vec3 high = vec3(0.92, 0.18, 0.16);
  vec3 ramp = t < 0.25
    ? mix(low, midLow, t / 0.25)
    : t < 0.5
      ? mix(midLow, mid, (t - 0.25) / 0.25)
      : t < 0.75
        ? mix(mid, midHigh, (t - 0.5) / 0.25)
        : mix(midHigh, high, (t - 0.75) / 0.25);
  material.diffuse = mix(material.diffuse, ramp, 0.85);
}`,
  contour: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float spacing = max(u_interval, 1.0);
  float band = fract(height / spacing);
  float edge = min(band, 1.0 - band);
  float line = 1.0 - smoothstep(0.0, 0.08, edge);
  vec3 contourColor = vec3(0.98, 0.84, 0.28);
  material.diffuse = mix(material.diffuse, contourColor, line);
}`,
  scan: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float span = max(u_maxHeight - u_minHeight, 1.0);
  float t = clamp((height - u_minHeight) / span, 0.0, 1.0);
  float sweep = fract(u_time * max(u_speed, 0.1) * 0.12);
  float distanceToBand = abs(t - sweep);
  float band = 1.0 - smoothstep(0.0, 0.05, distanceToBand);
  vec3 scanColor = vec3(0.32, 0.95, 1.0);
  material.diffuse = mix(material.diffuse * 0.6, scanColor, band);
}`,
  water: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float waveA = sin(height * 0.35 + u_time * u_speed * 1.6);
  float waveB = sin(height * 0.72 - u_time * u_speed * 2.4);
  float ripple = clamp(0.5 + (waveA * 0.35 + waveB * 0.15) * u_amplitude, 0.0, 1.0);
  vec3 waterColor = mix(vec3(0.03, 0.16, 0.38), vec3(0.24, 0.62, 0.92), ripple);
  material.diffuse = mix(material.diffuse, waterColor, u_opacity);
  material.alpha = mix(material.alpha, 0.92, u_opacity * 0.5);
}`,
  // D-17: colour geometry by how deep it sits below a chosen water plane; the
  // depth ramp is fixed (never user-supplied color) so the whitelist stays intact.
  "water-depth": `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float height = length(fsInput.attributes.positionWC) - length(u_center) + u_centerHeight;
  float depth = u_waterHeight - height;
  float t = clamp(depth / max(u_depthMax, 0.5), 0.0, 1.0);
  float submerged = step(0.0, depth);
  vec3 shallow = vec3(0.36, 0.78, 0.96);
  vec3 deep = vec3(0.02, 0.10, 0.38);
  material.diffuse = mix(material.diffuse, mix(shallow, deep, t), submerged * 0.9);
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
    return [...shaderEntriesRef.current.values()].sort((left, right) => (order.get(left.layer.id) ?? 0) - (order.get(right.layer.id) ?? 0)).map((entry) => ({ layer: entry.layerName, preset: entry.preset }));
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
    const range = shaderHeightRange(Cesium, layer.tileset, null);
    if (request.params.min_height !== void 0) range.minimum = request.params.min_height;
    if (request.params.max_height !== void 0) range.maximum = request.params.max_height;
    if (!(range.maximum > range.minimum)) {
      throw shaderFail(`高程范围无效（${range.minimum}..${range.maximum}）。`, "传入 min_height < max_height。");
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
    const existing = shaderEntriesRef.current.get(layer.id);
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
    releaseTick: () => releaseShaderTick()
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
var h2 = import_react4.default.createElement;
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
  return h2(
    "svg",
    {
      className: "chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": t2("analysis.chart")
    },
    h2("line", {
      x1: padX,
      y1: height - padY,
      x2: width - padX,
      y2: height - padY,
      stroke: "var(--mv-line)"
    }),
    ...segments.map(
      (pointsText, index) => h2("polyline", {
        key: `segment-${index}`,
        points: pointsText,
        fill: "none",
        stroke: "var(--mv-accent)",
        strokeWidth: 1.7,
        strokeLinejoin: "round",
        strokeLinecap: "round"
      })
    ),
    h2("text", { x: padX, y: padY - 3 }, formatHeight(maximum)),
    h2("text", { x: padX, y: height - 2 }, formatHeight(minimum)),
    h2("text", { x: width - padX, y: height - 2, textAnchor: "end" }, formatDistance(maxDistance))
  );
}
function AnalysisCard({ state, t: t2, onClose }) {
  const [open, setOpen] = import_react4.default.useState(true);
  if (!state || !state.result) return null;
  const result = state.result;
  const operation = state.operation;
  const rows = [];
  const row = (key, label, value) => rows.push(h2("div", { key, className: "stat" }, h2("span", null, label), h2("b", null, value)));
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
  return h2(
    "div",
    { className: "mv-card mv-analysis", role: "region", "aria-label": t2(`analysis.title.${operation}`) },
    h2(
      "header",
      null,
      h2("span", { className: "title" }, t2(`analysis.title.${operation}`)),
      h2(
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
      h2(
        "button",
        { type: "button", className: "mv-icon-btn", title: t2("analysis.close"), "aria-label": t2("analysis.close"), onClick: onClose },
        "✕"
      )
    ),
    open ? h2(
      "div",
      { className: "body" },
      state.layerName ? h2("div", { className: "layer", title: state.layerName }, `${t2("analysis.layer")}: ${state.layerName}`) : null,
      ...rows,
      operation === "profile" ? h2(AnalysisProfileChart, { points: result.points, t: t2 }) : null,
      h2("p", { className: "hint" }, t2("analysis.hint"))
    ) : null
  );
}
function ShaderWorkbench({
  t: t2,
  layers,
  form,
  active,
  onClose,
  onLayer,
  onPreset,
  onField,
  onApply,
  onResetLayer,
  onResetAll
}) {
  const visibleLayers = layers.filter((layer) => layer.visible);
  const selectedPresets = Array.isArray(form.preset) ? form.preset : [form.preset];
  const presetLabel = (value) => (Array.isArray(value) ? value : [value]).map((item) => t2(`shader.preset.${item}`)).join(" + ");
  const numberField = (key, labelKey, placeholder) => h2(
    "div",
    { className: "field", key },
    h2("label", { htmlFor: `mv-shader-${key}` }, t2(labelKey)),
    h2("input", {
      id: `mv-shader-${key}`,
      type: "number",
      inputMode: "decimal",
      step: "any",
      value: form[key],
      placeholder: placeholder ?? "",
      onChange: (event) => onField(key, event.target.value)
    })
  );
  const paramRows = [];
  if (selectedPresets.includes("height-false-color")) {
    const auto = t2("shader.param.auto");
    paramRows.push(numberField("minHeight", "shader.param.minHeight", auto), numberField("maxHeight", "shader.param.maxHeight", auto));
  }
  if (selectedPresets.includes("contour")) paramRows.push(numberField("interval", "shader.param.interval"));
  if (selectedPresets.includes("scan") || selectedPresets.includes("water")) {
    paramRows.push(numberField("speed", "shader.param.speed"));
  }
  if (selectedPresets.includes("water")) {
    paramRows.push(numberField("amplitude", "shader.param.amplitude"), numberField("opacity", "shader.param.opacity"));
  }
  if (selectedPresets.includes("water-depth")) {
    paramRows.push(numberField("waterHeight", "shader.param.waterHeight"), numberField("depthMax", "shader.param.depthMax"));
  }
  const params = paramRows.length > 0 ? h2("div", { className: "params" }, ...paramRows) : null;
  return h2(
    "div",
    { className: "mv-card mv-shader", role: "region", "aria-label": t2("shader.title") },
    h2(
      "header",
      null,
      h2("span", { className: "title" }, t2("shader.title")),
      h2(
        "button",
        { type: "button", className: "mv-icon-btn", title: t2("shader.close"), "aria-label": t2("shader.close"), onClick: onClose },
        "✕"
      )
    ),
    h2(
      "div",
      { className: "body" },
      h2(
        "div",
        { className: "field" },
        h2("label", { htmlFor: "mv-shader-layer" }, t2("shader.layerLabel")),
        h2(
          "select",
          {
            id: "mv-shader-layer",
            value: form.layerId,
            disabled: visibleLayers.length === 0,
            onChange: (event) => onLayer(event.target.value)
          },
          h2("option", { value: "" }, t2("shader.layerAuto")),
          ...visibleLayers.map((layer) => h2("option", { key: layer.id, value: layer.id }, layer.name))
        )
      ),
      h2(
        "div",
        { className: "field" },
        h2("label", null, t2("shader.presetLabel")),
        h2(
          "div",
          { className: "presets" },
          ...SHADER_PRESETS.map(
            (preset) => h2(
              "button",
              {
                key: preset,
                type: "button",
                className: `preset${selectedPresets.includes(preset) ? " on" : ""}`,
                title: t2(`shader.preset.${preset}`),
                "aria-pressed": selectedPresets.includes(preset),
                onClick: () => onPreset(preset)
              },
              t2(`shader.preset.${preset}`)
            )
          )
        ),
        h2("p", { className: "hint" }, t2("shader.stackHint"))
      ),
      params,
      h2(
        "div",
        { className: "row" },
        h2("button", { type: "button", className: "mv-cta primary", disabled: visibleLayers.length === 0, onClick: onApply }, t2("shader.apply")),
        h2("button", { type: "button", className: "mv-cta", onClick: onResetLayer }, t2("shader.resetLayer")),
        h2("button", { type: "button", className: "mv-cta", disabled: active.length === 0, onClick: onResetAll }, t2("shader.resetAll"))
      ),
      h2(
        "div",
        { className: "active" },
        h2("b", null, t2("shader.active")),
        active.length === 0 ? h2("span", { className: "empty" }, t2("shader.activeEmpty")) : active.map(
          (entry) => h2(
            "div",
            { key: entry.layer, className: "item" },
            h2("span", { title: entry.layer }, entry.layer),
            h2("em", null, presetLabel(entry.preset))
          )
        )
      ),
      visibleLayers.length === 0 ? h2("p", { className: "hint" }, t2("shader.noLayers")) : null
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
.mv-urlbar{position:absolute;top:58px;left:50%;transform:translateX(-50%);display:flex;gap:6px;padding:6px;border-radius:11px;z-index:12;width:min(640px,82%)}
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
.mv-shader{position:absolute;top:60px;left:10px;width:min(320px,calc(100% - 20px));max-height:calc(100% - 150px);z-index:14;display:flex;flex-direction:column;overflow:hidden;border-radius:13px}
.mv-shader>header{display:flex;align-items:center;gap:4px;padding:7px 7px 7px 11px;border-bottom:.5px solid var(--mv-line)}
.mv-shader>header .title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}
.mv-shader .body{padding:8px 11px 10px;overflow:auto;display:flex;flex-direction:column;gap:8px;min-height:0}
.mv-shader .field{display:flex;flex-direction:column;gap:3px;min-width:0}
.mv-shader .field label{font-size:10.5px;color:var(--mv-dim)}
.mv-shader .field select,.mv-shader .field input{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:6px 8px;font:inherit;font-size:11.5px;outline:none;min-width:0}
.mv-shader .field select:focus,.mv-shader .field input:focus{border-color:var(--mv-accent)}
.mv-shader .params{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.mv-shader .presets{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.mv-shader .preset{appearance:none;border:.5px solid var(--mv-line);background:var(--mv-input);color:var(--mv-dim);font:inherit;font-size:11px;padding:6px 8px;border-radius:7px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-shader .preset.on{background:color-mix(in srgb,var(--mv-accent) 22%,transparent);color:var(--mv-text);border-color:color-mix(in srgb,var(--mv-accent) 45%,transparent)}
.mv-shader .preset:focus-visible,.mv-shader .mv-cta:focus-visible,.mv-shader .mv-icon-btn:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-shader .row{display:flex;gap:6px}
.mv-shader .row .mv-cta{flex:1;min-width:0;padding:6px 8px;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-shader .row .mv-cta:disabled{opacity:.45;cursor:not-allowed}
.mv-shader .active{display:flex;flex-direction:column;gap:4px;border-top:.5px solid var(--mv-line);padding-top:7px}
.mv-shader .active b{font-size:10.5px;letter-spacing:.04em;color:var(--mv-dim);font-weight:600}
.mv-shader .active .item{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11px;line-height:1.4}
.mv-shader .active .item span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mv-dim)}
.mv-shader .active .item em{flex:none;font-style:normal;color:var(--mv-text)}
.mv-shader .empty{color:var(--mv-dim);font-size:10.5px}
.mv-shader .hint{margin:0;color:var(--mv-dim);font-size:10px;line-height:1.5}
.mv-layers>header{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;font-size:11px;letter-spacing:.06em;color:var(--mv-dim);border-bottom:.5px solid var(--mv-line)}
.mv-layers>header .mv-icon-btn{width:22px;height:22px;font-size:12px}
.mv-layer-list{overflow:auto;padding:4px;min-height:0}
.mv-layer{display:flex;align-items:center;gap:2px;padding:5px 6px;border-radius:8px}
.mv-layer:hover{background:color-mix(in srgb,var(--mv-lift) 64%,transparent)}
.mv-layer .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;cursor:pointer}
.mv-layer.off .name{color:var(--mv-dim);text-decoration:line-through}
.mv-icon-btn{appearance:none;border:0;background:transparent;color:var(--mv-dim);width:26px;height:26px;border-radius:7px;cursor:pointer;font:inherit;font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:none}
.mv-layer{gap:3px;padding:5px 7px}
.mv-layer .mv-icon-btn{font-size:15px}
/* Layer panel v1.6: four groups (L1 terrain / L2 basemap / L3 raster / L4 vector)
   plus the 3D Tiles list. Group titles are sticky so a long overlay list keeps
   the current section readable. */
.mv-group{padding:6px 6px 2px;margin-top:2px}
.mv-group-title{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--mv-dim);padding:0 2px 4px;position:sticky;top:0;background:var(--mv-glass-strong)}
.mv-choice{width:100%;text-align:left;border:0;background:transparent;color:var(--mv-text);font:inherit;font-size:12px;cursor:pointer}
.mv-choice .tick{color:var(--mv-accent);font-size:11px;flex:none}
.mv-choice.on{background:color-mix(in srgb,var(--mv-accent) 10%,transparent)}
.mv-opacity{width:64px;flex:none;accent-color:var(--mv-accent)}
.mv-overlay-row{gap:2px}
.mv-none{padding:6px 8px;font-size:11px;color:var(--mv-dim)}
.mv-overlay-form{border:.5px solid var(--mv-line);border-radius:8px;padding:8px;margin:2px 4px 6px;display:flex;flex-direction:column;gap:6px;background:color-mix(in srgb,var(--mv-lift) 40%,transparent)}
.mv-overlay-form .mv-field{display:flex;flex-direction:column;gap:3px}
.mv-overlay-form .mv-field label{font-size:10px;color:var(--mv-dim)}
.mv-overlay-form input,.mv-overlay-form select{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:5px 7px;font:inherit;font-size:11px;min-width:0}
.mv-icon-btn:hover{background:color-mix(in srgb,var(--mv-lift) 82%,transparent);color:var(--mv-text)}
.mv-icon-btn.on{color:var(--mv-accent)}
.mv-hud{position:absolute;left:10px;bottom:10px;z-index:9;padding:8px 11px;border-radius:11px;display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--mv-dim);max-width:calc(100% - 330px);pointer-events:none}
.mv-hud .row{display:flex;gap:10px;flex-wrap:wrap}
.mv-hud b{color:var(--mv-text);font-weight:600;font-variant-numeric:tabular-nums}
.mv-pick{position:absolute;right:10px;bottom:10px;width:322px;max-height:44%;display:flex;flex-direction:column;z-index:13;border-radius:12px;overflow:hidden}
.mv-pick>header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;font-size:11px;color:var(--mv-dim);border-bottom:.5px solid var(--mv-line)}
.mv-pick table{width:100%;border-collapse:collapse;font-size:11px;overflow:auto;display:block}
.mv-pick td{padding:3px 9px;vertical-align:top;border-top:.5px solid var(--mv-line);word-break:break-all}
.mv-pick td:first-child{color:var(--mv-dim);width:38%}
.mv-measure{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:11;padding:6px 13px;border-radius:999px;font-size:11px;color:var(--mv-dim);white-space:nowrap;pointer-events:none}
.mv-toast{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);z-index:40;background:var(--mv-glass-strong);border:.5px solid var(--mv-line);color:var(--mv-text);padding:8px 14px;border-radius:9px;font-size:12px;max-width:72%;word-break:break-all;box-shadow:var(--mv-shadow)}
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
.mv-root.mv-capturing .mv-top,.mv-root.mv-capturing .mv-urlbar,.mv-root.mv-capturing .mv-right,.mv-root.mv-capturing .mv-shader,.mv-root.mv-capturing .mv-layers,.mv-root.mv-capturing .mv-analysis,.mv-root.mv-capturing .mv-hud,.mv-root.mv-capturing .mv-attr,.mv-root.mv-capturing .mv-credits,.mv-root.mv-capturing .mv-pick,.mv-root.mv-capturing .mv-measure,.mv-root.mv-capturing .mv-toast,.mv-root.mv-capturing .mv-overlay,.mv-root.mv-capturing .mv-modal{visibility:hidden!important}
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
var h3 = import_react5.default.createElement;
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
  const field2 = (label, input) => h3("div", { className: "mv-field" }, h3("label", null, label), input);
  const pickTiles = async () => {
    if (typeof onPickLocal !== "function") return;
    const url = await onPickLocal();
    if (url) set({ type: "xyz", url, maximumLevel: source.maximumLevel ?? 18 });
  };
  const text = (key, value, placeholder) => h3("input", {
    key,
    value: value ?? "",
    placeholder: placeholder ?? "",
    onChange: (event) => set({ [key]: event.target.value })
  });
  return h3(
    "div",
    { className: "mv-form" },
    h3(
      "div",
      { className: "grid" },
      field2(t2("settings.field.name"), text("name")),
      field2(
        t2("settings.field.type"),
        h3(
          "select",
          { value: source.type, onChange: (event) => set({ type: event.target.value }) },
          SOURCE_TYPES[kind].map((type) => h3("option", { key: type, value: type }, t2(SOURCE_TYPE_KEY[type])))
        )
      )
    ),
    field2(t2("settings.field.url"), text("url", source.url, kind === "imagery" ? "https://…/{z}/{x}/{y}.png" : "https://…")),
    field2(t2("settings.field.credit"), text("credit", source.credit)),
    kind === "imagery" && source.type === "xyz" ? h3(
      "div",
      { className: "grid" },
      field2(
        t2("settings.field.maxLevel"),
        h3("input", {
          type: "number",
          min: 0,
          max: 25,
          value: source.maximumLevel ?? "",
          onChange: (event) => set({ maximumLevel: event.target.value === "" ? void 0 : Number(event.target.value) })
        })
      ),
      field2(
        t2("settings.field.tilingScheme"),
        h3(
          "select",
          {
            value: source.tilingScheme ?? "web-mercator",
            onChange: (event) => set({ tilingScheme: event.target.value })
          },
          h3("option", { value: "web-mercator" }, t2("settings.tiling.webMercator")),
          h3("option", { value: "geographic" }, t2("settings.tiling.geographic"))
        )
      ),
      field2(
        t2("settings.field.subdomains"),
        h3("input", {
          value: (source.subdomains ?? []).join(","),
          onChange: (event) => set({
            subdomains: event.target.value.split(",").map((item) => item.trim()).filter((item) => item !== "")
          })
        })
      )
    ) : null,
    kind === "imagery" && source.type === "xyz" ? h3(
      "div",
      { className: "grid" },
      h3(
        "div",
        { className: "mv-field check" },
        h3("input", {
          id: "mv-reverse-y",
          type: "checkbox",
          checked: source.reverseY === true,
          onChange: (event) => set({ reverseY: event.target.checked })
        }),
        h3("label", { htmlFor: "mv-reverse-y" }, t2("settings.field.tms"))
      ),
      h3(
        "div",
        { className: "mv-field" },
        h3(
          "button",
          { type: "button", className: "mv-cta", onClick: pickTiles },
          t2("settings.field.localTiles")
        )
      )
    ) : null,
    kind === "imagery" && source.type === "wms" ? field2(t2("settings.field.layers"), text("layers", source.layers)) : null,
    kind === "terrain" ? h3(
      "div",
      { className: "grid" },
      h3(
        "div",
        { className: "mv-field check" },
        h3("input", {
          id: "mv-normals",
          type: "checkbox",
          checked: source.requestVertexNormals === true,
          onChange: (event) => set({ requestVertexNormals: event.target.checked })
        }),
        h3("label", { htmlFor: "mv-normals" }, t2("settings.field.normals"))
      ),
      h3(
        "div",
        { className: "mv-field check" },
        h3("input", {
          id: "mv-water",
          type: "checkbox",
          checked: source.requestWaterMask === true,
          onChange: (event) => set({ requestWaterMask: event.target.checked })
        }),
        h3("label", { htmlFor: "mv-water" }, t2("settings.field.waterMask"))
      )
    ) : null,
    h3(
      "div",
      { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } },
      h3("button", { type: "button", className: "mv-cta", onClick: onCancel }, t2("btn.cancel"))
    )
  );
}
function SourcesDialog({ config, defaults, environmentDark, themeMode, onPickLocal, onSave, onClose, messages, meta, bridgeOn, bridgeReload }) {
  const t2 = messages;
  const [draft, setDraft] = import_react5.default.useState(() => clone(config));
  const [tab, setTab] = import_react5.default.useState("imagery");
  const [editing, setEditing] = import_react5.default.useState(null);
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
    (source) => editing?.kind === kind && editing.id === source.id ? h3(SourceForm, {
      key: source.id,
      kind,
      source,
      t: t2,
      onPickLocal,
      onChange: (next) => updateSource(kind, next),
      onCancel: () => setEditing(null)
    }) : h3(
      "div",
      { key: source.id, className: "mv-src" },
      h3("span", {
        className: `radio${activeId(kind) === source.id ? " on" : ""}`,
        role: "radio",
        "aria-checked": activeId(kind) === source.id,
        tabIndex: 0,
        onClick: () => selectSource(kind, activeId(kind) === source.id ? null : source.id),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") selectSource(kind, source.id);
        }
      }),
      h3(
        "div",
        { className: "meta" },
        h3("b", null, source.name),
        h3("span", null, source.url)
      ),
      h3("span", { className: "badge" }, t2(SOURCE_TYPE_KEY[source.type] ?? source.type)),
      h3(
        "button",
        {
          type: "button",
          className: "mv-icon-btn",
          title: t2("btn.edit"),
          onClick: () => setEditing({ kind, id: source.id })
        },
        "✎"
      ),
      h3(
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
  const appearance = h3(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "10px" } },
    h3("p", { className: "mv-note" }, t2("theme.appearanceHint")),
    h3(
      "div",
      { className: "mv-seg", role: "radiogroup" },
      segments.map(
        ([value, key]) => h3(
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
    h3("p", { className: "mv-note" }, `${t2("theme.auto")} · ${environmentDark ? t2("theme.dark") : t2("theme.light")}`),
    h3(
      "label",
      { className: "mv-toggle" },
      h3(
        "span",
        { className: "text" },
        h3("b", null, t2("settings.autoOpenPanel")),
        h3("span", null, t2("settings.autoOpenPanelHint"))
      ),
      h3("input", {
        type: "checkbox",
        checked: autoOpen,
        onChange: (event) => {
          setAutoOpen(event.target.checked);
          writeAutoOpen(event.target.checked);
        }
      })
    ),
    h3(
      "label",
      { className: "mv-toggle" },
      h3(
        "span",
        { className: "text" },
        h3("b", null, t2("settings.screenshotHud")),
        h3("span", null, t2("settings.screenshotHudHint"))
      ),
      h3("input", {
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
      h3(
        "select",
        {
          value: draft.settings.quality === "high" ? "high" : "balanced",
          onChange: (event) => setDraft((current) => ({
            ...current,
            settings: { ...current.settings, quality: event.target.value }
          }))
        },
        h3("option", { value: "balanced" }, t2("settings.qualityBalanced")),
        h3("option", { value: "high" }, t2("settings.qualityHigh"))
      )
    ),
    h3("p", { className: "mv-note" }, t2("settings.qualityHint")),
    h3(
      "label",
      { className: "mv-toggle" },
      h3(
        "span",
        { className: "text" },
        h3("b", null, t2("settings.terrainDepthTest")),
        h3("span", null, t2("settings.terrainDepthTestHint"))
      ),
      h3("input", {
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
    h3(
      "label",
      { className: "mv-toggle" },
      h3(
        "span",
        { className: "text" },
        h3("b", null, t2("settings.showLayers")),
        h3("span", null, t2("settings.showLayersHint"))
      ),
      h3("input", {
        type: "checkbox",
        checked: draft.settings.showLayers !== false,
        onChange: (event) => setDraft((current) => ({
          ...current,
          settings: { ...current.settings, showLayers: event.target.checked }
        }))
      })
    ),
    h3(
      "label",
      { className: "mv-toggle" },
      h3(
        "span",
        { className: "text" },
        h3("b", null, t2("settings.showHud")),
        h3("span", null, t2("settings.showHudHint"))
      ),
      h3("input", {
        type: "checkbox",
        checked: draft.settings.showHud !== false,
        onChange: (event) => setDraft((current) => ({
          ...current,
          settings: { ...current.settings, showHud: event.target.checked }
        }))
      })
    )
  );
  const homepage = meta?.homepage ?? FALLBACK_ABOUT.homepage;
  const issuesUrl = meta?.issues ?? `${String(homepage).replace(/\/+$/, "")}/issues`;
  const teamUrl = meta?.team?.url ?? FALLBACK_ABOUT.teamUrl;
  const about = h3(
    "div",
    { className: "mv-about" },
    h3("p", { className: "intro" }, t2("about.intro")),
    h3(
      "div",
      { className: "row" },
      h3("span", { className: "key" }, t2("about.version")),
      h3("span", null, meta?.version ?? FALLBACK_ABOUT.version)
    ),
    h3(
      "div",
      { className: "row" },
      h3("span", { className: "key" }, t2("about.homepage")),
      h3("a", { href: homepage, target: "_blank", rel: "noopener noreferrer" }, homepage)
    ),
    h3(
      "div",
      { className: "row" },
      h3("span", { className: "key" }, t2("about.issues")),
      h3("a", { href: issuesUrl, target: "_blank", rel: "noopener noreferrer" }, "GitHub Issues")
    ),
    h3(
      "div",
      { className: "row" },
      h3("span", { className: "key" }, t2("about.team")),
      h3(
        "div",
        { className: "team" },
        h3("a", { href: teamUrl, target: "_blank", rel: "noopener noreferrer" }, meta?.team?.name ?? t2("about.teamName")),
        h3("small", null, teamUrl)
      )
    ),
    h3(
      "div",
      { className: "row" },
      h3("span", { className: "key" }, t2("about.agent")),
      h3("span", null, bridgeReload ? t2("about.agent.stale") : bridgeOn ? t2("about.agent.on") : t2("about.agent.off"))
    ),
    h3(
      "div",
      { className: "row" },
      h3("span", { className: "key" }, t2("about.licenseLabel")),
      h3("span", null, t2("about.license"))
    )
  );
  return h3(
    "div",
    { className: "mv-modal", onPointerDown: (event) => event.target === event.currentTarget && onClose() },
    h3(
      "div",
      { className: "mv-dialog", role: "dialog", "aria-modal": true },
      h3(
        "header",
        null,
        h3("b", null, t2("settings.title")),
        h3("button", { type: "button", className: "mv-icon-btn", onClick: onClose, title: t2("btn.close") }, "✕")
      ),
      h3(
        "div",
        { className: "mv-tabs" },
        [["imagery", "settings.tab.imagery"], ["terrain", "settings.tab.terrain"], ["appearance", "settings.tab.appearance"], ["about", "settings.tab.about"]].map(
          ([value, key]) => h3(
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
      h3(
        "div",
        { className: "body" },
        tab === "about" ? about : tab === "appearance" ? appearance : h3(
          import_react5.default.Fragment,
          null,
          h3("p", { className: "mv-note" }, t2(tab === "imagery" ? "settings.imageryHint" : "settings.terrainHint")),
          rowsFor(tab),
          draft[tab].length === 0 && editing === null ? h3("p", { className: "mv-note" }, t2("settings.empty")) : null,
          h3(
            "div",
            { style: { display: "flex", justifyContent: "flex-start" } },
            h3("button", { type: "button", className: "mv-cta", onClick: () => addSource(tab) }, `+ ${t2("btn.add")}`)
          )
        )
      ),
      h3(
        "div",
        { className: "footer" },
        h3(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 } },
          h3("button", { type: "button", className: "mv-cta", onClick: restore }, t2("btn.restore"))
        ),
        h3(
          "div",
          { className: "right" },
          h3("button", { type: "button", className: "mv-cta", onClick: onClose }, t2("btn.cancel")),
          h3("button", { type: "button", className: "mv-cta primary", onClick: save }, t2("btn.save"))
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
  const body = state?.loading ? h3(
    "div",
    { className: "mv-health-loading" },
    h3("div", { className: "mv-spinner" }),
    h3("p", { className: "mv-note" }, t2("health.loading"))
  ) : state?.error ? h3("p", { className: "mv-note" }, t2("health.failed", { message: state.error })) : report ? h3(
    "div",
    { className: "mv-health-body" },
    h3(
      "div",
      { className: "mv-health-rows" },
      rows.map(
        ([key, value]) => h3(
          "div",
          { className: "row", key },
          h3("span", { className: "key" }, t2(key)),
          h3("span", { className: "value" }, value)
        )
      )
    ),
    h3(
      "div",
      { className: "mv-health-section" },
      h3("b", null, `${t2("health.issues")} · ${issues.length}`),
      issues.length > 0 ? h3(
        "ul",
        { className: "issues" },
        issues.map(
          (issue, index) => h3(
            "li",
            { key: `${issue.code}-${index}`, className: `lvl-${issue.level}` },
            h3("span", { className: "badge" }, t2(`health.level.${issue.level}`)),
            h3("code", null, issue.code),
            h3("span", { className: "msg" }, issue.message)
          )
        )
      ) : h3("p", { className: "mv-note" }, t2("health.noIssues"))
    ),
    runtime ? h3(
      "div",
      { className: "mv-health-section" },
      h3("b", null, t2("health.runtime")),
      h3(
        "div",
        { className: "mv-health-runtime" },
        `${t2("hud.tiles")} ${runtime.tiles ?? 0} · ${t2("hud.pending")} ${runtime.pending ?? 0} · ${t2("hud.triangles")} ${runtime.triangles ?? 0}`
      )
    ) : null,
    h3(
      "div",
      { className: "mv-health-path" },
      h3("span", { className: "key" }, t2("health.reportPath")),
      h3("code", { title: reportPath }, reportPath || t2("health.unknown")),
      reportPath ? h3("button", { type: "button", className: "mv-cta", onClick: onCopy }, t2("health.copy")) : null
    )
  ) : null;
  return h3(
    "div",
    { className: "mv-modal", onPointerDown: (event) => event.target === event.currentTarget && onClose() },
    h3(
      "div",
      { className: "mv-dialog mv-health", role: "dialog", "aria-modal": true },
      h3(
        "header",
        null,
        h3("b", null, state?.layer ? `${t2("health.title")} · ${state.layer}` : t2("health.title")),
        h3("button", { type: "button", className: "mv-icon-btn", onClick: onClose, title: t2("btn.close") }, "✕")
      ),
      h3("div", { className: "body" }, body)
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
  const row = (key, value) => value ? h3("div", { key, className: "row" }, h3("span", { className: "key" }, t2(key)), h3("code", { title: value }, value)) : null;
  return h3(
    "div",
    { className: "mv-modal", onPointerDown: (event) => event.target === event.currentTarget && !busy && onDeny() },
    h3(
      "div",
      { className: "mv-dialog mv-access", role: "dialog", "aria-modal": true, "aria-labelledby": "mv-access-title" },
      h3(
        "header",
        null,
        h3("b", { id: "mv-access-title" }, `${t2("access.title")} · ${action}`),
        h3("button", { type: "button", className: "mv-icon-btn", onClick: onDeny, disabled: busy, title: t2("btn.close") }, "✕")
      ),
      h3(
        "div",
        { className: "body" },
        h3("p", { className: "mv-note" }, t2("access.body")),
        h3(
          "div",
          { className: "mv-access-path" },
          row("access.path", request.path),
          row("access.dir", request.directory),
          request.resolved ? row("access.target", request.target) : null
        ),
        request.kind === "missing" ? h3("p", { className: "mv-note" }, t2("access.missing")) : null,
        request.resolved ? h3("p", { className: "mv-note" }, t2("access.resolved")) : null
      ),
      h3(
        "div",
        { className: "footer" },
        h3(
          "div",
          { className: "right" },
          h3("button", { ref: denyRef, type: "button", className: "mv-cta", onClick: onDeny, disabled: busy }, t2("access.cancel")),
          h3(
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
var h4 = import_react6.default.createElement;
function StatusHud({ fps, stats, viewerRef, cesiumRef, labels, readoutRef }) {
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
  return h4(
    "div",
    { className: "mv-hud mv-glass" },
    h4(
      "div",
      { className: "row" },
      // fps is null while the scene is idle (no render pass for 2 s); a dash is
      // honest, a 0 would suggest the scene renders nothing while idling.
      h4("span", { title: t("hud.fpsTitle") }, "FPS ", h4("b", null, fps === null ? "—" : fps)),
      h4("span", null, `${labels.pointer} `, h4("b", { ref: cursorRef }, t("hud.empty"))),
      h4("span", null, `${labels.camera} `, h4("b", null, stats.height)),
      h4("span", null, `${labels.heading} `, h4("b", null, `${stats.heading} / ${stats.pitch}`))
    ),
    stats.layers.map(
      (row) => h4(
        "div",
        { key: row.id, className: "row" },
        h4("b", null, row.name),
        h4("span", null, `${labels.tiles} `, h4("b", null, formatCount(row.tiles))),
        h4("span", null, `${labels.pending} `, h4("b", null, formatCount(row.pending))),
        h4("span", null, `${labels.triangles} `, h4("b", null, formatCount(row.triangles))),
        h4("span", null, `${labels.cache} `, h4("b", null, formatBytes(row.memory)))
      )
    )
  );
}

// src/client/ui/layers-panel.js
var import_react7 = __toESM(require("react"), 1);
var h5 = import_react7.default.createElement;
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
  onClearAnalysis
}) {
  const [adding, setAdding] = import_react7.default.useState(false);
  const [draft, setDraft] = import_react7.default.useState({ type: "wms", name: "", url: "", layers: "", opacity: 0.7 });
  const [error, setError] = import_react7.default.useState("");
  const sourceName = (list, id) => list?.find((item) => item.id === id)?.name ?? null;
  const terrainActive = sourceName(config?.terrain, settings?.terrain);
  const imageryActive = sourceName(config?.imagery, settings?.imagery);
  const overlays = Array.isArray(config?.rasterOverlays) ? config.rasterOverlays : [];
  const drawn = annotations?.drawn_features ?? 0;
  const measured = annotations?.measured_points ?? 0;
  const radioRow = (key, label, active, onClick) => h5(
    "button",
    {
      key,
      type: "button",
      className: `mv-layer mv-choice${active ? " on" : ""}`,
      "aria-pressed": active,
      onClick
    },
    h5("span", { className: "name" }, label),
    h5("span", { className: "tick", "aria-hidden": true }, active ? "✓" : "")
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
  const field2 = (label, input) => h5("div", { className: "mv-field" }, h5("label", null, label), input);
  return h5(
    "div",
    { className: "mv-layers mv-glass" },
    h5(
      "header",
      null,
      h5("span", null, t2("layers.title")),
      h5(
        "div",
        { className: "mv-head-actions" },
        layers.length > 0 ? h5("button", { type: "button", className: "mv-icon-btn", title: t2("layers.frameAll"), "aria-label": t2("layers.frameAll"), onClick: onFrameAll }, "⛶") : null,
        h5(
          "button",
          { type: "button", className: "mv-icon-btn", title: t2("layers.collapse"), "aria-label": t2("layers.collapse"), onClick: onCollapse },
          "✕"
        )
      )
    ),
    h5(
      "div",
      { className: "mv-layer-list" },
      // ---- L1 terrain --------------------------------------------------------
      h5("div", { key: "g1", className: "mv-group" }, h5("div", { className: "mv-group-title" }, t2("layers.terrain"))),
      radioRow("t-off", t2("menu.terrainOff"), terrainActive === null, () => onSelectTerrain(null)),
      ...(config?.terrain ?? []).map(
        (source) => radioRow(`t-${source.id}`, source.name, settings?.terrain === source.id, () => onSelectTerrain(source.id))
      ),
      // ---- L2 imagery basemap ------------------------------------------------
      h5("div", { key: "g2", className: "mv-group" }, h5("div", { className: "mv-group-title" }, t2("layers.imagery"))),
      radioRow("i-off", t2("menu.none"), imageryActive === null, () => onSelectImagery(null)),
      ...(config?.imagery ?? []).map(
        (source) => radioRow(`i-${source.id}`, source.name, settings?.imagery === source.id, () => onSelectImagery(source.id))
      ),
      // ---- L3 raster overlays ------------------------------------------------
      h5(
        "div",
        { key: "g3", className: "mv-group" },
        h5("div", { className: "mv-group-title" }, `${t2("layers.raster")}${overlays.length ? ` · ${overlays.length}` : ""}`),
        h5(
          "button",
          { type: "button", className: "mv-cta", onClick: () => setAdding((value) => !value) },
          adding ? t2("layers.overlayCancel") : t2("layers.addOverlay")
        )
      ),
      adding ? h5(
        "div",
        { key: "add-form", className: "mv-overlay-form" },
        field2(
          t2("layers.overlayType"),
          h5(
            "select",
            { value: draft.type, onChange: (event) => setDraft((current) => ({ ...current, type: event.target.value })) },
            OVERLAY_TYPES2.map((type) => h5("option", { key: type, value: type }, type.toUpperCase()))
          )
        ),
        field2(t2("layers.overlayName"), h5("input", { value: draft.name, onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })) })),
        field2(t2("layers.overlayUrl"), h5("input", { value: draft.url, placeholder: "https://…", onChange: (event) => setDraft((current) => ({ ...current, url: event.target.value })) })),
        draft.type === "wms" ? field2(t2("layers.overlayLayers"), h5("input", { value: draft.layers, placeholder: "flood:risk", onChange: (event) => setDraft((current) => ({ ...current, layers: event.target.value })) })) : null,
        field2(
          t2("layers.overlayOpacity"),
          h5("input", {
            type: "range",
            min: 0,
            max: 100,
            value: Math.round(draft.opacity * 100),
            onChange: (event) => setDraft((current) => ({ ...current, opacity: Number(event.target.value) / 100 }))
          })
        ),
        error ? h5("p", { className: "mv-note" }, error) : null,
        h5("button", { type: "button", className: "mv-cta primary", onClick: submitDraft }, t2("layers.overlayAdd"))
      ) : null,
      overlays.length === 0 && !adding ? h5("div", { key: "no-overlay", className: "mv-none" }, t2("layers.emptyRaster")) : overlays.map(
        (overlay, index) => h5(
          "div",
          { key: overlay.id, className: `mv-layer mv-overlay-row${overlay.visible === false ? " off" : ""}` },
          h5("span", { className: "name", title: overlay.url }, overlay.name),
          h5("input", {
            className: "mv-opacity",
            type: "range",
            min: 0,
            max: 100,
            title: t2("layers.overlayOpacity"),
            "aria-label": t2("layers.overlayOpacity"),
            value: Math.round((overlay.opacity ?? 1) * 100),
            onChange: (event) => onOverlayOpacity(overlay.id, Number(event.target.value) / 100)
          }),
          h5("button", {
            type: "button",
            className: `mv-icon-btn${overlay.visible === false ? " on" : ""}`,
            title: overlay.visible === false ? t2("btn.hidden") : t2("btn.visible"),
            onClick: () => onOverlayVisible(overlay.id, overlay.visible === false)
          }, overlay.visible === false ? "◌" : "◉"),
          h5("button", { type: "button", className: "mv-icon-btn", title: t2("layers.overlayDown"), disabled: index === 0, onClick: () => onOverlayMove(overlay.id, -1) }, "↑"),
          h5("button", { type: "button", className: "mv-icon-btn", title: t2("layers.overlayUp"), disabled: index === overlays.length - 1, onClick: () => onOverlayMove(overlay.id, 1) }, "↓"),
          h5("button", { type: "button", className: "mv-icon-btn", title: t2("layers.overlayRemove"), onClick: () => onOverlayRemove(overlay.id) }, "✕")
        )
      ),
      // ---- L4 vector overlays ------------------------------------------------
      h5("div", { key: "g4", className: "mv-group" }, h5("div", { className: "mv-group-title" }, t2("layers.vector"))),
      h5(
        "div",
        { key: "vector-row", className: "mv-layer" },
        h5("span", { className: "name" }, `${t2("layers.vectorDrawn")} ${drawn} · ${t2("layers.vectorMeasured")} ${measured}`),
        h5("button", { type: "button", className: "mv-icon-btn", title: t2("tool.clear"), onClick: onClearVector }, "✕")
      ),
      ...(Array.isArray(agentOverlays) ? agentOverlays : []).map(
        (row) => h5(
          "div",
          { key: row.id, className: "mv-layer" },
          h5("span", { className: "name", title: row.detail }, `${row.label} · ${row.detail}`),
          h5(
            "button",
            { type: "button", className: "mv-icon-btn", title: t2("layers.vectorRemove"), onClick: () => onRemoveAgentOverlay(row.kind, row.index) },
            "✕"
          )
        )
      ),
      // ---- analysis (Agent-driven; the panel owns the entry + the clear) ------
      h5("div", { key: "g5", className: "mv-group" }, h5("div", { className: "mv-group-title" }, t2("layers.analysis"))),
      analysis ? h5(
        "div",
        { key: "analysis-row", className: "mv-layer" },
        h5(
          "span",
          { className: "name" },
          `${analysis.operation ?? t2("layers.analysis")}${typeof analysis.layer === "string" && analysis.layer !== "" ? ` · ${analysis.layer}` : ""}`
        ),
        h5("button", { type: "button", className: "mv-icon-btn", title: t2("layers.analysisClear"), onClick: onClearAnalysis }, "✕")
      ) : h5("div", { key: "analysis-hint", className: "mv-none" }, t2("layers.analysisHint")),
      // ---- 3D Tiles content --------------------------------------------------
      h5("div", { key: "g6", className: "mv-group" }, h5("div", { className: "mv-group-title" }, `${t2("layers.content")} · ${layers.length}`)),
      ...layers.map(
        (layer) => h5(
          "div",
          { key: layer.id, className: `mv-layer${layer.visible ? "" : " off"}` },
          h5("span", { className: "name", title: layer.name, onClick: () => onFlyLayer(layer.id) }, layer.name),
          h5("button", { type: "button", className: `mv-icon-btn${layer.visible ? "" : " on"}`, title: layer.visible ? t2("btn.visible") : t2("btn.hidden"), onClick: () => onToggleLayer(layer.id) }, layer.visible ? "◉" : "◌"),
          h5("button", { type: "button", className: "mv-icon-btn", title: t2("btn.flyTo"), "aria-label": t2("btn.flyTo"), onClick: () => onFlyLayer(layer.id) }, "⌖"),
          h5("button", { type: "button", className: "mv-icon-btn", title: t2("btn.health"), "aria-label": t2("btn.health"), onClick: () => onInspectLayer(layer.id) }, "⌕"),
          h5("button", { type: "button", className: "mv-icon-btn", title: t2("btn.delete"), "aria-label": t2("btn.delete"), onClick: () => onRemoveLayer(layer.id) }, "✕")
        )
      )
    )
  );
}

// src/client/ui/menu-item.js
var import_react8 = __toESM(require("react"), 1);
var h6 = import_react8.default.createElement;
function MenuItem({ onClick, children, active, title }) {
  return h6(
    "button",
    { type: "button", className: `mv-menu-item${active ? " on" : ""}`, onClick, title },
    children,
    active ? h6("span", { className: "check", "aria-hidden": true }, "✓") : null
  );
}

// src/client/viewer/ViewerSurface.js
var h7 = import_react9.default.createElement;
function ViewerSurface({ t: injectedT, sessionId = null, docked = false }) {
  const fallbackT = useTranslation();
  const t2 = typeof injectedT === "function" ? injectedT : fallbackT;
  const environmentDark = useEnvironmentDark();
  const rootRef = import_react9.default.useRef(null);
  const globeRef = import_react9.default.useRef(null);
  const creditRef = import_react9.default.useRef(null);
  const menuRef = import_react9.default.useRef(null);
  const viewerRef = import_react9.default.useRef(null);
  const cesiumRef = import_react9.default.useRef(null);
  const metaRef = import_react9.default.useRef(null);
  const layersRef = import_react9.default.useRef([]);
  const toolRef = import_react9.default.useRef(null);
  const measureRef = import_react9.default.useRef({ points: [], entities: [] });
  const handlerRef = import_react9.default.useRef(null);
  const imageryRef = import_react9.default.useRef(null);
  const overlayLayersRef = import_react9.default.useRef(null);
  const sourcesRef = import_react9.default.useRef(null);
  const toastTimer = import_react9.default.useRef(0);
  const captureReadoutRef = import_react9.default.useRef(null);
  const commandChainRef = import_react9.default.useRef(Promise.resolve());
  const commandRef = import_react9.default.useRef(null);
  const accessRef = import_react9.default.useRef(null);
  const analysisRef = import_react9.default.useRef({ operation: null, layerId: null, layerName: null, entities: [], restore: null });
  const analysisCommandRef = import_react9.default.useRef(null);
  const shaderEntriesRef = import_react9.default.useRef(/* @__PURE__ */ new Map());
  const shaderTickRef = import_react9.default.useRef(null);
  const readyGateRef = import_react9.default.useRef({ ready: false, error: null, waiters: [] });
  const healthSeqRef = import_react9.default.useRef(0);
  const sessionRef = import_react9.default.useRef(sessionId);
  sessionRef.current = sessionId;
  const [phase, setPhase] = import_react9.default.useState("loading");
  const [error, setError] = import_react9.default.useState("");
  const [layers, setLayers] = import_react9.default.useState([]);
  const [sources, setSources] = import_react9.default.useState(null);
  const [defaults, setDefaults] = import_react9.default.useState(null);
  const [tool, setTool] = import_react9.default.useState(null);
  const [fps, setFps] = import_react9.default.useState(null);
  const [fullscreen, setFullscreen] = import_react9.default.useState(false);
  const [stats, setStats] = import_react9.default.useState(null);
  const [pickInfo, setPickInfo] = import_react9.default.useState(null);
  const [measureInfo, setMeasureInfo] = import_react9.default.useState(null);
  const [scan, setScan] = import_react9.default.useState(null);
  const [emptyDismissed, setEmptyDismissed] = import_react9.default.useState(false);
  const [restoringScene, setRestoringScene] = import_react9.default.useState(false);
  const [urlBar, setUrlBar] = import_react9.default.useState(false);
  const [urlInput, setUrlInput] = import_react9.default.useState("");
  const [busy, setBusy] = import_react9.default.useState("");
  const [toast, setToast] = import_react9.default.useState("");
  const [openMenu, setOpenMenu] = import_react9.default.useState(null);
  const [recentDirs, setRecentDirs] = import_react9.default.useState([]);
  const [accessRequest, setAccessRequest] = import_react9.default.useState(null);
  const [accessBusy, setAccessBusy] = import_react9.default.useState(false);
  const [analysis, setAnalysis] = import_react9.default.useState(null);
  const [shaderOpen, setShaderOpen] = import_react9.default.useState(false);
  const [shaderActive, setShaderActive] = import_react9.default.useState([]);
  const [shaderForm, setShaderForm] = import_react9.default.useState({
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
  const [settingsOpen, setSettingsOpen] = import_react9.default.useState(false);
  const [health, setHealth] = import_react9.default.useState(null);
  const [terrainBusy, setTerrainBusy] = import_react9.default.useState(false);
  const [imageryBusy, setImageryBusy] = import_react9.default.useState(false);
  const [meta, setMeta] = import_react9.default.useState(null);
  const [bridgeOn, setBridgeOn] = import_react9.default.useState(false);
  const [bridgeReload, setBridgeReload] = import_react9.default.useState(false);
  const [bridgeEpoch, setBridgeEpoch] = import_react9.default.useState(0);
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
  const saveChainRef = import_react9.default.useRef(Promise.resolve());
  const saveSeqRef = import_react9.default.useRef(0);
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
        tileset = await Cesium.Cesium3DTileset.fromUrl(url, tilesetOptions);
      } catch (directError) {
        if (!/^https?:/i.test(url)) throw directError;
        tileset = await Cesium.Cesium3DTileset.fromUrl(proxyUrlFor(url), tilesetOptions);
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
        const provider = await imageryProvider(Cesium, source);
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
        viewer.terrainProvider = await terrainProvider(Cesium, source);
        showToast(t2("toast.terrainOn", { name: source.name }));
      } else {
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        showToast(t2("toast.terrainOff"));
      }
      applyGlobeDepthTest();
      return { ok: true, source };
    } catch (error2) {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      showToast(t2("toast.terrainFailed", { message: message(error2) }));
      return { ok: false, error: message(error2) };
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
  const togglePaneFullscreen = () => {
    const rightbar = service("sidebarRight");
    try {
      const target = rightbar?.focusedTarget?.(rootRef.current) ?? rightbar?.commandTarget?.(rootRef.current);
      if (target !== void 0) {
        rightbar.toggleFullscreen(target);
        return;
      }
    } catch {
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
  const agentOverlayRef = import_react9.default.useRef({
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
  const [agentOverlayCount, setAgentOverlayCount] = import_react9.default.useState(0);
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
  const sceneDirtyRef = import_react9.default.useRef(false);
  const sceneRestoredRef = import_react9.default.useRef(false);
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
  async function restoreSceneSnapshot(snapshot) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || snapshot === null) return;
    setRestoringScene(snapshot.layers.length > 0);
    try {
      for (const item of snapshot.layers) {
        const source = item.source;
        let url = "";
        if (typeof source.path === "string" && source.path !== "") {
          try {
            url = await localPathToUrl(source.path);
          } catch {
            continue;
          }
        } else if (typeof source.url === "string" && /^https?:\/\//i.test(source.url)) {
          url = source.url;
        }
        if (url === "") continue;
        try {
          const layer = await loadTileset(url, item.name, source, { fly: false });
          if (item.visible === false) setLayerVisible(layer.id, false);
        } catch {
        }
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
      duration: 1.2
    });
  }
  const setChromeHidden = (hidden) => {
    const root = rootRef.current;
    if (root) root.classList.toggle("mv-capturing", hidden);
  };
  const roundedRectPath = (context, x, y, width, height, radius) => {
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
  };
  const drawCaptureOverlay = (context, width, height) => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
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
    const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} };
    const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null;
    const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null;
    const lastReadout = captureReadoutRef.current;
    let pointerText = lastReadout || "";
    if (!pointerText) {
      const center = new Cesium.Cartesian2(
        Math.round(viewer.canvas.clientWidth / 2),
        Math.round(viewer.canvas.clientHeight / 2)
      );
      const carto = sampleCursor(viewer, Cesium, center, { pickPosition: true });
      if (carto) pointerText = formatCursor(Cesium, carto);
    }
    const visibleCount = layersRef.current.filter((layer) => layer.visible).length;
    const lines = [
      `${lastReadout ? t2("hud.pointer") : t2("hud.center")}  ${pointerText || t2("hud.empty")}`,
      `${t2("hud.camera")} ${cameraHeight} m · ${t2("hud.heading")} ${heading}° · ${pitch}°`,
      `${t2("hud.layers")} ${visibleCount}/${layersRef.current.length} · ${imagery?.name ?? "—"} · ${terrain?.name ?? "—"}`,
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
    const aboutMeta = metaRef.current;
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
    if (layer && viewer) viewer.flyTo(layer.tileset, { duration: 1 });
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
  import_react9.default.useEffect(() => {
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
  import_react9.default.useEffect(
    () => () => {
      const current = accessRef.current;
      if (!current) return;
      accessRef.current = null;
      clearTimeout(current.timer);
      current.resolve({ allowed: false, message: t2("access.denied") });
    },
    []
  );
  import_react9.default.useEffect(() => {
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
        if (catalog.config.settings.terrain) await applyTerrain(catalog.config.settings.terrain, false);
        applyGlobeDepthTest();
        overlayLayersRef.current = createOverlayLayers({
          Cesium,
          viewer,
          // The panel owns the provider mapping; the stack stays browser-free.
          providerFactory: imageryProvider,
          onError: (error2, source) => showToast(t2("toast.overlayFailed", { name: source?.name ?? "", message: message(error2) }))
        });
        await overlayLayersRef.current.sync(catalog.config.rasterOverlays ?? []);
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((event) => onCanvasClick(event.position), Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.setInputAction(
          (event) => {
            if (toolRef.current) {
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
        if (savedScene !== null) {
          await restoreSceneSnapshot(savedScene);
          if (cancelled) return;
        }
        sceneRestoredRef.current = typeof sessionId === "string" && sessionId !== "";
        settleReadyWaiters();
        setPhase("ready");
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
  import_react9.default.useEffect(() => {
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
  import_react9.default.useEffect(() => {
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
  import_react9.default.useEffect(() => {
    if (!openMenu) return void 0;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [openMenu]);
  import_react9.default.useEffect(() => {
    if (openMenu === "data") refreshRecentDirs();
  }, [openMenu, meta?.directoriesUrl]);
  import_react9.default.useEffect(() => {
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
  import_react9.default.useEffect(() => {
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
  import_react9.default.useEffect(() => {
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
  import_react9.default.useEffect(() => {
    if (!scan) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") setScan(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scan]);
  import_react9.default.useEffect(() => {
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
  import_react9.default.useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (phase !== "ready" || !viewer || !Cesium) return;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(resolvedDark ? "#05080f" : "#dde6f2");
    viewer.scene.globe.showGroundAtmosphere = resolvedDark;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = resolvedDark;
    viewer.scene.requestRender?.();
  }, [phase, resolvedDark]);
  const button = (label, onClick, active, extra, title) => h7(
    "button",
    { type: "button", className: `mv-btn${active ? " on" : ""}${extra ? ` ${extra}` : ""}`, onClick, title },
    label
  );
  const iconButton = (icon, title, onClick, active) => h7(
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
  const menu = (id, label, items, active) => h7(
    "div",
    { key: id, className: "mv-menu" },
    button(`${label} ▾`, () => setOpenMenu(openMenu === id ? null : id), active),
    openMenu === id ? h7("div", { className: "mv-menu-panel mv-glass" }, items) : null
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
  const workbench = createWorkbenchWiring({
    getForm: () => shaderForm,
    getLayers: () => layers,
    setShaderForm,
    shaderCommand,
    showToast,
    t: t2
  });
  return h7(
    "div",
    {
      ref: rootRef,
      className: `mv-root${docked ? " mv-docked" : ""}`,
      "data-mv-theme": themeMode === "auto" ? void 0 : themeMode,
      "data-mv-scheme": resolvedDark ? "dark" : "light"
    },
    h7("style", { key: "css" }, CSS),
    h7("div", { key: "globe", ref: globeRef, className: "mv-globe" }),
    activeImagery?.credit ? h7("div", { key: "attr", className: "mv-attr" }, `${t2("credit.imagery")} © ${activeImagery.credit}`) : null,
    h7("div", { key: "credits", ref: creditRef, className: "mv-credits" }),
    h7(
      "div",
      { key: "top", className: "mv-top" },
      h7(
        "div",
        { className: "mv-brand mv-glass" },
        h7(ViewerIcon, { size: 18 }),
        h7("b", null, t2("panel.title")),
        h7("span", null, status)
      ),
      h7(
        "div",
        { ref: menuRef, className: "mv-actions mv-glass" },
        menu(
          "data",
          t2("btn.data"),
          [
            h7(MenuItem, { key: "local", onClick: pickLocal }, t2("btn.openLocal")),
            recentDirs.length ? h7(
              import_react9.default.Fragment,
              { key: "recent" },
              h7("span", { className: "mv-menu-label" }, t2("menu.recentDirs")),
              ...recentDirs.map(
                (entry) => h7(
                  MenuItem,
                  { key: entry.dir, title: entry.dir, onClick: () => openRecentDirectory(entry.dir) },
                  h7("span", { className: "ellipsis" }, entry.name)
                )
              )
            ) : null,
            agentOverlayCount > 0 ? h7(
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
            h7(
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
            h7(
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
            h7("i", { key: "sep", className: "mv-sep", style: { width: "auto", height: ".5px", margin: "4px 8px" } }),
            h7(
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
        h7("i", { key: "s1", className: "mv-sep" }),
        menu(
          "measure",
          t2("btn.measure"),
          [
            h7(MenuItem, { key: "distance", active: tool === "distance", onClick: () => setToolMode(tool === "distance" ? null : "distance") }, t2("tool.distance")),
            h7(MenuItem, { key: "area", active: tool === "area", onClick: () => setToolMode(tool === "area" ? null : "area") }, t2("tool.area")),
            h7(MenuItem, { key: "height", active: tool === "height", onClick: () => setToolMode(tool === "height" ? null : "height") }, t2("tool.height")),
            h7(MenuItem, { key: "pick", active: tool === "pick", onClick: () => setToolMode(tool === "pick" ? null : "pick") }, t2("tool.pick"))
          ],
          tool !== null
        ),
        h7("i", { key: "s2", className: "mv-sep" }),
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
          h7(HudIcon),
          showHud ? t2("btn.hudHide") : t2("btn.hudShow"),
          () => updateSettings({ showHud: !showHud }),
          showHud
        ),
        iconButton(
          h7(ShaderIcon),
          shaderOpen ? t2("btn.shaderHide") : t2("btn.shaderShow"),
          () => setShaderOpen((value) => !value),
          shaderOpen
        ),
        // Action buttons are icon-only with a tooltip/aria-label: in the docked
        // narrow panel the text labels were what wrapped the toolbar onto a
        // second row. The four dropdown menus keep their text labels because a
        // bare icon does not tell the user what the menu contains.
        iconButton(h7(ScreenshotIcon), t2("btn.screenshot"), screenshot),
        sessionId ? iconButton(h7(AskAgentIcon), t2("btn.askAgent"), askAgent) : null,
        iconButton(h7(ResetIcon), t2("btn.reset"), resetView),
        docked ? iconButton(h7(FullscreenIcon), t2("btn.maximizeTitle"), togglePaneFullscreen) : button(t2("btn.beside"), openBeside),
        // Real fullscreen works from both mounts; the sidebar-maximize button
        // above is a docked-only layout action, not fullscreen.
        iconButton(h7(FullscreenIcon), fullscreen ? t2("btn.fullscreenExit") : t2("btn.fullscreenTitle"), toggleDomFullscreen, fullscreen),
        h7("i", { key: "s3", className: "mv-sep" }),
        h7(
          "div",
          { key: "appearance", className: "mv-menu" },
          h7(
            "button",
            {
              type: "button",
              className: "mv-btn icon",
              title: `${t2("btn.appearance")} · ${t2(themeMode === "auto" ? "theme.auto" : themeMode === "light" ? "theme.light" : "theme.dark")}`,
              "aria-haspopup": "menu",
              onClick: () => setOpenMenu(openMenu === "appearance" ? null : "appearance")
            },
            h7(ThemeIcon, { mode: resolvedDark ? "dark" : "light" })
          ),
          openMenu === "appearance" ? h7(
            "div",
            { className: "mv-menu-panel mv-glass" },
            [
              ["auto", "theme.auto"],
              ["light", "theme.light"],
              ["dark", "theme.dark"]
            ].map(
              ([mode, label]) => h7(
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
        h7(
          "button",
          {
            key: "settings",
            type: "button",
            className: "mv-btn icon",
            title: t2("btn.settings"),
            onClick: () => setSettingsOpen(true)
          },
          h7(
            "svg",
            { viewBox: "0 0 24 24", width: 16, height: 16, "aria-hidden": true, style: { display: "block" } },
            h7(
              "g",
              { stroke: "currentColor", strokeWidth: 1.7, fill: "none", strokeLinecap: "round" },
              h7("circle", { cx: 12, cy: 12, r: 3.2 }),
              h7("path", { d: "M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z" })
            )
          )
        )
      )
    ),
    urlBar ? h7(
      "div",
      { key: "urlbar", className: "mv-urlbar mv-glass" },
      h7("input", {
        autoFocus: true,
        value: urlInput,
        placeholder: t2("urlbar.placeholder"),
        onChange: (event) => setUrlInput(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") submitUrl();
          if (event.key === "Escape") setUrlBar(false);
        }
      }),
      h7("button", { type: "button", onClick: submitUrl }, t2("urlbar.submit"))
    ) : null,
    shaderOpen ? h7(ShaderWorkbench, {
      key: "shader",
      t: t2,
      layers,
      form: shaderForm,
      active: shaderActive,
      onClose: () => setShaderOpen(false),
      onLayer: (layerId) => workbench.field("layerId", layerId),
      onPreset: workbench.toggle,
      onField: workbench.field,
      onApply: workbench.apply,
      onResetLayer: workbench.resetLayer,
      onResetAll: workbench.resetAll
    }) : null,
    analysis || showLayers ? h7(
      "div",
      { key: "right", className: "mv-right" },
      analysis ? h7(AnalysisCard, { key: "analysis", state: analysis, t: t2, onClose: () => clearAnalysis() }) : null,
      showLayers ? h7(LayersPanel, {
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
        onFlyLayer: flyToLayer,
        onFrameAll: () => frameAllLayers(viewerRef.current, cesiumRef.current, layersRef.current),
        analysis,
        onClearAnalysis: () => clearAnalysis(),
        onToggleLayer: toggleLayer,
        onInspectLayer: inspectLayer,
        onRemoveLayer: removeLayer,
        onOverlayAdd: addOverlay,
        onOverlayRemove: removeOverlay,
        onOverlayOpacity: setOverlayOpacity,
        onOverlayVisible: setOverlayVisible,
        onOverlayMove: moveOverlay,
        onClearVector: () => clearAgentOverlays2("all"),
        agentOverlays: buildAgentOverlayList(agentOverlayRef.current),
        onRemoveAgentOverlay: (kind, index) => {
          if (!removeAgentOverlay(agentOverlayRef.current, viewerRef.current, kind, index)) return;
          syncAgentOverlayCount();
          markSceneDirty();
        }
      }) : null
    ) : null,
    phase === "ready" && layers.length === 0 && !emptyDismissed && !restoringScene ? h7(
      "div",
      { key: "empty", className: "mv-overlay" },
      h7(
        "div",
        { className: "mv-empty" },
        h7(
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
        h7(ViewerIcon, { size: 30 }),
        h7("h2", null, t2("panel.empty.title")),
        h7("p", null, t2("panel.empty.body")),
        h7(
          "div",
          { className: "buttons" },
          h7("button", { type: "button", className: "mv-cta primary", onClick: pickLocal }, t2("panel.empty.local")),
          h7("button", { type: "button", className: "mv-cta", onClick: () => setUrlBar(true) }, t2("panel.empty.url"))
        )
      )
    ) : null,
    phase === "loading" ? h7("div", { key: "loading", className: "mv-overlay dim" }, h7("div", { className: "mv-empty" }, h7("div", { className: "mv-spinner" }), h7("p", null, t2("panel.status.loading")))) : null,
    phase === "error" ? h7(
      "div",
      { key: "error", className: "mv-overlay dim" },
      h7(
        "div",
        { className: "mv-empty" },
        h7("h2", null, "⚠"),
        h7("p", null, error),
        h7("div", { className: "buttons" }, h7("button", { type: "button", className: "mv-cta", onClick: () => location.reload() }, t2("btn.retry")))
      )
    ) : null,
    stats && showHud ? h7(StatusHud, { key: "hud", fps, stats, viewerRef, cesiumRef, labels: hudLabels, readoutRef: captureReadoutRef }) : null,
    measureInfo ? h7("div", { key: "measure", className: "mv-measure mv-glass" }, measureInfo.text) : null,
    pickInfo ? h7(
      "div",
      { key: "pick", className: "mv-pick mv-glass" },
      h7(
        "header",
        null,
        h7("span", null, pickInfo.title),
        h7(
          "button",
          { type: "button", className: "mv-icon-btn", onClick: () => setPickInfo(null), title: t2("btn.close") },
          "✕"
        )
      ),
      h7(
        "table",
        null,
        h7(
          "tbody",
          null,
          pickInfo.rows.map(([name, value]) => h7("tr", { key: name }, h7("td", null, name), h7("td", null, value)))
        )
      )
    ) : null,
    toast ? h7("div", { key: "toast", className: "mv-toast" }, toast) : null,
    scan ? h7(
      "div",
      { key: "scan", className: "mv-modal", onPointerDown: (event) => event.target === event.currentTarget && setScan(null) },
      h7(
        "div",
        { className: "mv-dialog" },
        h7(
          "header",
          null,
          h7("b", null, t2("layers.title")),
          h7("span", { className: "path", style: { fontWeight: 400, color: "var(--mv-dim)" } }, scan.dir),
          h7("button", { type: "button", className: "mv-icon-btn", onClick: () => setScan(null), title: t2("btn.close") }, "✕")
        ),
        h7(
          "div",
          { className: "body" },
          scan.items.map(
            (item) => h7(
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
              h7("span", null, item.name)
            )
          )
        )
      )
    ) : null,
    health ? h7(HealthDialog, {
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
    settingsOpen && sources && defaults ? h7(SourcesDialog, {
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
    accessRequest ? h7(PathAccessDialog, {
      key: "access",
      request: accessRequest,
      busy: accessBusy,
      t: t2,
      onAllow: allowPathAccess,
      onDeny: () => settleAccess({ allowed: false, message: t2("access.denied") })
    }) : null,
    imageryBusy || terrainBusy ? h7("div", { key: "busy", className: "mv-measure mv-glass", style: { bottom: "44px" } }, t2("toast.loadingData")) : null
  );
}

// src/client/ui/layout.js
var h8 = import_react10.default.createElement;
function ViewerPanel(props) {
  return h8(ViewerSurface, { t: props.t, sessionId: null, docked: false });
}
function EarthTabBody(props) {
  const info = typeof props.useTabInfo === "function" ? props.useTabInfo() : null;
  const sessionId = props.sessionId ?? info?.tab?.sessionId ?? info?.sessionId ?? null;
  return h8(ViewerSurface, { t: props.t, sessionId, docked: true });
}

// src/client/ui/tool-row.js
var import_react11 = __toESM(require("react"), 1);
var h9 = import_react11.default.createElement;
function HeaderButton(props) {
  const fallbackT = useTranslation();
  const t2 = typeof props.t === "function" ? props.t : fallbackT;
  const [hover, setHover] = import_react11.default.useState(false);
  return h9(
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
    h9(ViewerIcon, { size: 16 })
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
  const openedRef = import_react11.default.useRef(false);
  import_react11.default.useEffect(() => {
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
  const [thumbUrl, setThumbUrl] = import_react11.default.useState("");
  import_react11.default.useEffect(() => {
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
  return h9(
    "div",
    { className: "mv-toolrow", "data-state": state, "data-tool": toolName },
    h9("span", { className: "glyph", "aria-hidden": true }, h9(ViewerIcon, { size: 14 })),
    h9("span", { className: "title" }, t2("panel.title")),
    h9("span", { className: "sep", "aria-hidden": true }),
    h9("span", { className: "summary", title: failure !== "" ? failure : void 0 }, summary),
    thumbUrl === "" ? null : h9(
      "a",
      {
        className: "thumb",
        href: thumbUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        title: t2("tool.thumbOpen")
      },
      h9("img", { src: thumbUrl, alt: "", loading: "lazy" })
    ),
    h9(
      "button",
      { type: "button", className: "open", title: t2("tool.openTip"), onClick: openEarthPanel },
      t2("tool.open")
    )
  );
}

// src/client/plugin.js
var h10 = import_react12.default.createElement;
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
        (props) => h10(HeaderButton, { ...props, onOpen: openEarthPanel })
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
