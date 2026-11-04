/**
 * Client half of the Digital Earth plugin: a full-page globe panel that renders
 * imagery basemaps, terrain and any number of local/online 3D Tiles layers on
 * top of CesiumJS.
 *
 * The CesiumJS build is vendored in the package and served by the Host half,
 * so the panel is fully offline-capable and never depends on a CDN.
 */
window.__ModuleLoader__.load({
  id: '@cveo/dsh-digital-earth',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    let appCtx = null
    let metaPromise = null
    let cesiumPromise = null
    let cesiumStylePromise = null
    let saveChain = Promise.resolve()

    /** Read a Cordis client service without breaking when it is not mounted. */
    const service = (key) => {
      try {
        return appCtx?.get?.(key) ?? undefined
      } catch {
        return undefined
      }
    }

    //#region localization -----------------------------------------------------

    const MESSAGES = {
      zh: {
        'panel.title': '数字地球',
        'panel.status.loading': '正在加载三维引擎…',
        'panel.status.ready': '就绪',
        'panel.status.layers': '{n} 个图层',
        'panel.empty.title': '在地球上叠加你的数据',
        'panel.empty.body':
          '打开本地目录或在线地址，把 3D Tiles（b3dm / glb / 3DGS）叠加到 CesiumJS 地球上；底图、地形与量测工具已就绪。',
        'panel.empty.local': '打开本地目录',
        'panel.empty.url': '加载在线地址',
        'panel.empty.dismiss': '关闭提示',
        'btn.data': '数据',
        'btn.openLocal': '打开本地目录…',
        'btn.openUrl': '加载在线地址…',
        'btn.layers': '图层',
        'btn.layersShow': '展开图层卡',
        'btn.layersHide': '收起图层卡',
        'btn.hud': '坐标 HUD',
        'btn.hudShow': '显示坐标 HUD',
        'btn.hudHide': '隐藏坐标 HUD',
        'btn.basemap': '底图',
        'btn.terrain': '地形',
        'btn.measure': '量测',
        'btn.screenshot': '截图',
        'btn.reset': '复位',
        'btn.settings': '数据源与外观',
        'btn.appearance': '外观',
        'btn.close': '关闭',
        'btn.cancel': '取消',
        'btn.retry': '重试',
        'btn.save': '保存',
        'btn.add': '添加',
        'btn.edit': '编辑',
        'btn.delete': '删除',
        'btn.restore': '恢复默认',
        'btn.flyTo': '定位',
        'btn.visible': '显示',
        'btn.hidden': '隐藏',
        'menu.none': '无底图',
        'menu.terrainOff': '关闭地形',
        'menu.recentDirs': '最近打开',
        'menu.clearAgent': '清除 Agent 标注',
        'tool.distance': '测距',
        'tool.area': '测面',
        'tool.height': '测高',
        'tool.pick': '拾取属性',
        'tool.clear': '清除量测结果',
        'hud.pointer': '光标',
        'hud.center': '视线中心',
        'hud.camera': '相机高度',
        'hud.cameraPos': '相机位置',
        'hud.heading': '朝向',
        'hud.tiles': '瓦片',
        'hud.pending': '待加载',
        'hud.triangles': '三角面',
        'hud.layers': '图层',
        'hud.cache': '缓存',
        'hud.elevation': '高程 {value}',
        'hud.empty': '—',
        'layers.title': '图层',
        'layers.collapse': '收起图层卡',
        'urlbar.placeholder': 'tileset.json 的 http(s) 地址，或本地绝对路径',
        'urlbar.submit': '加载',
        'toast.scanEmpty': '该目录下没有找到 tileset.json',
        'toast.scanFailed': '打开目录失败：{message}',
        'toast.dialogUnavailable': '目录选择服务不可用',
        'toast.invalidPath': '本地路径无效',
        'toast.invalidUrl': '请输入 http(s) 地址或本地 tileset.json 路径',
        'toast.proxyFallback': '直连失败，已通过本地代理加载',
        'toast.loadFailed': '加载失败：{message}',
        'toast.loadingData': '正在加载数据…',
        'toast.busyDirectory': '正在打开目录…',
        'toast.terrainLoading': '正在加载地形…',
        'toast.terrainOn': '已开启地形：{name}',
        'toast.terrainOff': '已关闭地形，恢复椭球',
        'toast.terrainFailed': '地形加载失败，继续使用椭球：{message}',
        'toast.basemap': '已切换底图：{name}',
        'toast.basemapNone': '已关闭影像底图',
        'toast.basemapFailed': '底图加载失败：{message}',
        'toast.screenshotSaved': '截图已保存',
        'toast.screenshotFailed': '截图失败：{message}',
        'toast.sourcesSaved': '数据源已保存',
        'toast.saveFailed': '保存失败：{message}',
        'toast.noSurface': '该位置没有可拾取的表面',
        'toast.pickNone': '未拾取到对象',
        'measure.start': '左键点击取点，双击结束',
        'measure.distance': '总长 {value} · 双击结束',
        'measure.area': '面积 {value} · 双击结束',
        'measure.height': '高差 {value} · 水平距 {distance}',
        'measure.total': '总长 {value}',
        'measure.areaLabel': '面积 {value}',
        'pick.title': '拾取对象',
        'pick.type': '类型',
        'pick.layer': '图层',
        'pick.name': '名称',
        'pick.entity': '实体',
        'pick.scene': '场景对象',
        'pick.tiles': '3D Tiles 模型',
        'pick.noProperties': '说明',
        'pick.noPropertiesValue': '该瓦片没有属性表',
        'model.unnamed': '3D Tiles 模型',
        'credit.imagery': '影像',
        'settings.title': '设置',
        'settings.tab.imagery': '影像底图',
        'settings.tab.terrain': '地形',
        'settings.tab.appearance': '外观',
        'settings.imageryHint': '此处维护「底图」菜单中的影像源；单选按钮切换当前底图。',
        'settings.terrainHint': '此处维护可选的地形源；单选按钮用于开启或切换地形。',
        'settings.empty': '还没有数据源，点击「添加」新建一个。',
        'settings.field.name': '名称',
        'settings.field.type': '类型',
        'settings.field.url': '地址',
        'settings.field.credit': '版权署名',
        'settings.field.maxLevel': '最大层级',
        'settings.field.subdomains': '子域名（逗号分隔）',
        'settings.field.tms': 'TMS（Y 轴南起）',
        'settings.field.localTiles': '选择本地瓦片目录…',
        'settings.field.layers': 'WMS 图层名',
        'settings.field.tilingScheme': '投影方式',
        'settings.field.normals': '请求顶点法线',
        'settings.field.waterMask': '请求水面掩膜',
        'settings.type.xyz': 'XYZ 瓦片模板',
        'settings.type.arcgis': 'ArcGIS 服务',
        'settings.type.wms': 'WMS',
        'settings.type.cesium': 'Cesium 地形',
        'settings.tiling.webMercator': 'Web 墨卡托',
        'settings.tiling.geographic': '经纬度',
        'settings.required': '请填写名称与地址',
        'settings.deleteConfirm': '确定删除数据源「{name}」？',
        'settings.restoreConfirm': '恢复默认数据源？当前配置将被覆盖。',
        'theme.auto': '跟随系统',
        'theme.light': '浅色',
        'theme.dark': '深色',
        'theme.appearanceHint': '默认跟随 DSH / 系统的浅深色；选择具体模式可覆盖本面板的外观。',
        'tab.title': '数字地球',
        'header.open': '在对话旁打开数字地球',
        'btn.beside': '在对话旁打开',
        'btn.immersive': '全屏查看',
        'btn.immersiveTitle': '全屏查看（再次点击返回停靠）',
        'tool.action.status': '读取场景',
        'tool.action.list': '读取图层',
        'tool.action.load': '加载图层',
        'tool.action.remove': '移除图层',
        'tool.action.visible': '切换可见',
        'tool.action.basemap': '切换底图',
        'tool.action.terrain': '切换地形',
        'tool.action.fly': '移动视角',
        'tool.action.reset': '复位视角',
        'tool.action.pick': '拾取对象',
        'tool.action.inspect': '数据体检',
        'tool.action.capture': '截图',
        'tool.action.draw': '绘制标注',
        'tool.action.measure': '量测',
        'tool.action.clearAgent': '清除标注',
        'tool.action.generic': '三维场景',
        'tool.open': '打开',
        'tool.openTip': '在对话右侧打开数字地球',
        'settings.tab.about': '关于',
        'settings.autoOpenPanel': 'Agent 调用时自动打开数字地球',
        'settings.autoOpenPanelHint':
          'Agent 调用地球工具（earth_scene / earth_capture / earth_draw / earth_measure）时，自动在对话右侧打开数字地球面板；关闭后仍可从对话标题栏的地球按钮手动打开。该偏好只保存在本机浏览器。',
        'settings.screenshotHud': '截图时叠加坐标 HUD 与署名',
        'settings.screenshotHudHint':
          '默认关闭：截图只保留干净的三维画面，便于分享或交给模型识别。打开后会在图片内叠加光标坐标、相机参数与团队署名（面板工具栏属于网页元素，不会进入图片）。',
        'settings.showLayers': '显示图层卡',
        'settings.showLayersHint': '关闭后图层卡从画布上收起；仍可从工具栏的「图层」按钮重新展开。该偏好会写回数据源配置。',
        'settings.showHud': '显示坐标 HUD',
        'settings.showHudHint':
          '关闭后不渲染左下角的坐标/瓦片统计，并停止指针采样以节省性能。截图默认仍不叠加 HUD；该偏好会写回数据源配置。',
        'about.version': '版本',
        'about.homepage': '项目源码',
        'about.issues': '问题反馈',
        'about.team': '开发团队',
        'about.teamName': '武汉大学 CVEO 课题组',
        'about.license': 'MIT License',
        'about.licenseLabel': '许可',
        'about.intro':
          '在 DSH 对话里直接查看、操控三维地球：叠加 3D Tiles / 3DGS、影像底图与地形，并让 Agent 读取场景、截图，与自然语言对话协同。',
        'about.agent': 'Agent 集成',
        'about.agent.on': '已连接，可被对话调用',
        'about.agent.off': '面板打开后自动连接',
        'about.agent.stale': '连接已断开，刷新页面后自动重连',
        'btn.health': '数据体检',
        'health.title': '数据体检',
        'health.loading': '正在体检数据…',
        'health.failed': '体检失败：{message}',
        'health.noSource': '该图层没有可体检的数据来源，请重新加载后再试。',
        'health.source': '来源',
        'health.sourceLabel': '图层',
        'health.kind.local': '本地',
        'health.kind.remote': '远程',
        'health.assetVersion': '资产版本',
        'health.tiles': '瓦片数',
        'health.contents': '内容数',
        'health.depth': 'LOD 深度',
        'health.extensions': '扩展',
        'health.rootError': '根几何误差',
        'health.boundingVolume': '包围体',
        'health.reportPath': '报告路径',
        'health.copy': '复制路径',
        'health.copied': '报告路径已复制',
        'health.copyFailed': '复制失败，请手动选择报告路径',
        'health.issues': '问题',
        'health.noIssues': '未发现数据问题',
        'health.runtime': '当前运行统计',
        'health.level.error': '错误',
        'health.level.warn': '警告',
        'health.level.info': '提示',
        'health.unknown': '—',
        'agent.unknownSource': '无法确定图层「{name}」的数据来源：请重新加载该图层后再体检。',
        'agent.notReady': '三维引擎尚未就绪，请稍后再试。',
        'agent.hiddenPanel': '数字地球面板当前不可见（已切到别的页签或窗口在后台），无法渲染截图。请先切到右侧「数字地球」页签、保持窗口在前台，再重试。',
        'agent.captureTooLarge': '截图体积超过上限，请降低 width 后重试。',
        'agent.noViewer': '数字地球画布不可用，请刷新页面后重试。',
        'agent.missingLayer': '请提供 layer（图层 id 或名称）。',
        'agent.unknownLayer': '找不到图层「{name}」，当前图层：{list}',
        'agent.missingUrl': '请提供 http(s) 地址或本地 tileset.json 路径。',
        'agent.dirDenied': '访问本地目录失败（{message}）。请重试一次以重新触发授权；若仍失败，请在面板中授权该目录后再试。',
        'agent.missingCoords': '请提供 lon 与 lat。',
        'agent.unknownImagery': '找不到影像源「{name}」，可用：{list}',
        'agent.unknownTerrain': '找不到地形源「{name}」，可用：{list}',
        'agent.badAction': '不支持的操作：{action}',
        'agent.badGeojson': '标注数据无效：{message}',
        'agent.badMeasure': '量测参数无效：{message}',
        'agent.measureEmpty': '没有可用的量测结果。',
        'agent.clearedOverlays': '已清除 Agent 标注',
        'access.title': '授权访问本地数据',
        'access.body': 'Agent 想从这个本地路径加载数据。允许后，面板会先把该文件所在目录登记为可读取的本地数据源（仅本页面会话内有效），然后继续操作。',
        'access.dir': '目录',
        'access.path': '请求路径',
        'access.target': '解析到的文件',
        'access.file': '文件',
        'access.allowing': '正在登记目录…',
        'access.request.load': '加载 3D Tiles',
        'access.request.inspect': '数据体检',
        'access.request.generic': '读取本地数据',
        'access.missing': '该路径当前未找到 tileset.json：允许后 Host 会继续在上层目录内查找唯一候选，找到才会加载。',
        'access.resolved': '已在上层目录中找到候选文件，允许后加载这个文件：',
        'access.allow': '允许并继续',
        'access.cancel': '取消',
        'access.denied': '用户取消了本地路径授权，本次操作未执行。',
        'access.scanFailed': '目录登记失败，本次操作未执行：{message}',
        'access.remote': '仅本地路径需要授权；在线地址无需此步骤。',
        'access.badPath': '授权请求缺少有效的本地路径。',
        'toast.captureSaved': '已生成 {width}×{height} 截图：{path}',
        'toast.noSession': '请先打开一个会话，再在对话旁查看数字地球。',
        'unit.hectare': '公顷',
      },
      en: {
        'panel.title': 'Digital Earth',
        'panel.status.loading': 'Loading 3D engine…',
        'panel.status.ready': 'Ready',
        'panel.status.layers': '{n} layers',
        'panel.empty.title': 'Lay your data over the globe',
        'panel.empty.body':
          'Open a local folder or an online URL to add 3D Tiles (b3dm / glb / 3DGS) to this CesiumJS globe. Imagery, terrain and measurement tools are ready.',
        'panel.empty.local': 'Open local folder',
        'panel.empty.url': 'Load from URL',
        'panel.empty.dismiss': 'Dismiss',
        'btn.data': 'Data',
        'btn.openLocal': 'Open local folder…',
        'btn.openUrl': 'Load from URL…',
        'btn.layers': 'Layers',
        'btn.layersShow': 'Show layer card',
        'btn.layersHide': 'Hide layer card',
        'btn.hud': 'Coordinate HUD',
        'btn.hudShow': 'Show coordinate HUD',
        'btn.hudHide': 'Hide coordinate HUD',
        'btn.basemap': 'Basemap',
        'btn.terrain': 'Terrain',
        'btn.measure': 'Measure',
        'btn.screenshot': 'Snapshot',
        'btn.reset': 'Reset',
        'btn.settings': 'Sources & appearance',
        'btn.appearance': 'Appearance',
        'btn.close': 'Close',
        'btn.cancel': 'Cancel',
        'btn.retry': 'Retry',
        'btn.save': 'Save',
        'btn.add': 'Add',
        'btn.edit': 'Edit',
        'btn.delete': 'Delete',
        'btn.restore': 'Restore defaults',
        'btn.flyTo': 'Fly to',
        'btn.visible': 'Show',
        'btn.hidden': 'Hide',
        'menu.none': 'No basemap',
        'menu.terrainOff': 'Terrain off',
        'menu.recentDirs': 'Recently opened',
        'menu.clearAgent': 'Clear Agent annotations',
        'tool.distance': 'Distance',
        'tool.area': 'Area',
        'tool.height': 'Height',
        'tool.pick': 'Pick properties',
        'tool.clear': 'Clear measurements',
        'hud.pointer': 'Cursor',
        'hud.center': 'View centre',
        'hud.camera': 'Camera',
        'hud.cameraPos': 'Camera position',
        'hud.heading': 'Heading',
        'hud.tiles': 'Tiles',
        'hud.pending': 'Pending',
        'hud.triangles': 'Triangles',
        'hud.layers': 'Layers',
        'hud.cache': 'Cache',
        'hud.elevation': 'Elev {value}',
        'hud.empty': '—',
        'layers.title': 'Layers',
        'layers.collapse': 'Collapse layer card',
        'urlbar.placeholder': 'http(s) URL of tileset.json, or an absolute local path',
        'urlbar.submit': 'Load',
        'toast.scanEmpty': 'No tileset.json found in that folder',
        'toast.scanFailed': 'Failed to open folder: {message}',
        'toast.dialogUnavailable': 'Directory picker is unavailable',
        'toast.invalidPath': 'Invalid local path',
        'toast.invalidUrl': 'Enter an http(s) URL or a local tileset.json path',
        'toast.proxyFallback': 'Direct request failed; loaded through the local proxy',
        'toast.loadFailed': 'Load failed: {message}',
        'toast.loadingData': 'Loading dataset…',
        'toast.busyDirectory': 'Opening folder…',
        'toast.terrainLoading': 'Loading terrain…',
        'toast.terrainOn': 'Terrain enabled: {name}',
        'toast.terrainOff': 'Terrain off; ellipsoid restored',
        'toast.terrainFailed': 'Terrain failed; keeping the ellipsoid: {message}',
        'toast.basemap': 'Basemap: {name}',
        'toast.basemapNone': 'Imagery basemap off',
        'toast.basemapFailed': 'Basemap failed: {message}',
        'toast.screenshotSaved': 'Snapshot saved',
        'toast.screenshotFailed': 'Snapshot failed: {message}',
        'toast.sourcesSaved': 'Sources saved',
        'toast.saveFailed': 'Save failed: {message}',
        'toast.noSurface': 'No pickable surface there',
        'toast.pickNone': 'Nothing picked',
        'measure.start': 'Left-click to add points, double-click to finish',
        'measure.distance': 'Total {value} · double-click to finish',
        'measure.area': 'Area {value} · double-click to finish',
        'measure.height': 'Δh {value} · horizontal {distance}',
        'measure.total': 'Total {value}',
        'measure.areaLabel': 'Area {value}',
        'pick.title': 'Picked object',
        'pick.type': 'Type',
        'pick.layer': 'Layer',
        'pick.name': 'Name',
        'pick.entity': 'Entity',
        'pick.scene': 'Scene object',
        'pick.tiles': '3D Tiles model',
        'pick.noProperties': 'Info',
        'pick.noPropertiesValue': 'This tile has no property table',
        'model.unnamed': '3D Tiles model',
        'credit.imagery': 'Imagery',
        'settings.title': 'Settings',
        'settings.tab.imagery': 'Imagery',
        'settings.tab.terrain': 'Terrain',
        'settings.tab.appearance': 'Appearance',
        'settings.imageryHint': 'Manage the imagery sources offered in the Basemap menu; the radio button picks the active one.',
        'settings.terrainHint': 'Manage the available terrain sources; the radio button enables or switches terrain.',
        'settings.empty': 'No sources yet — click Add to create one.',
        'settings.field.name': 'Name',
        'settings.field.type': 'Type',
        'settings.field.url': 'URL',
        'settings.field.credit': 'Credit',
        'settings.field.maxLevel': 'Max zoom level',
        'settings.field.subdomains': 'Subdomains (comma separated)',
        'settings.field.tms': 'TMS (south-origin Y)',
        'settings.field.localTiles': 'Pick local tiles…',
        'settings.field.layers': 'WMS layers',
        'settings.field.tilingScheme': 'Projection',
        'settings.field.normals': 'Request vertex normals',
        'settings.field.waterMask': 'Request water mask',
        'settings.type.xyz': 'XYZ tile template',
        'settings.type.arcgis': 'ArcGIS service',
        'settings.type.wms': 'WMS',
        'settings.type.cesium': 'Cesium terrain',
        'settings.tiling.webMercator': 'Web Mercator',
        'settings.tiling.geographic': 'Geographic',
        'settings.required': 'Name and URL are required',
        'settings.deleteConfirm': 'Delete source "{name}"?',
        'settings.restoreConfirm': 'Restore default sources? The current configuration is replaced.',
        'theme.auto': 'Follow system',
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'theme.appearanceHint': 'Follows the DSH / system light-dark theme by default; pick a mode to override this panel only.',
        'tab.title': 'Digital Earth',
        'header.open': 'Open Digital Earth beside the chat',
        'btn.beside': 'Open beside chat',
        'btn.immersive': 'Full screen',
        'btn.immersiveTitle': 'Full screen (click again to return to the dock)',
        'tool.action.status': 'Read scene',
        'tool.action.list': 'List layers',
        'tool.action.load': 'Load layer',
        'tool.action.remove': 'Remove layer',
        'tool.action.visible': 'Toggle visibility',
        'tool.action.basemap': 'Switch basemap',
        'tool.action.terrain': 'Switch terrain',
        'tool.action.fly': 'Move camera',
        'tool.action.reset': 'Reset view',
        'tool.action.pick': 'Pick object',
        'tool.action.inspect': 'Data check',
        'tool.action.capture': 'Snapshot',
        'tool.action.draw': 'Draw annotations',
        'tool.action.measure': 'Measure',
        'tool.action.clearAgent': 'Clear annotations',
        'tool.action.generic': '3D scene',
        'tool.open': 'Open',
        'tool.openTip': 'Open Digital Earth beside the chat',
        'settings.tab.about': 'About',
        'settings.autoOpenPanel': 'Open Digital Earth automatically on Agent calls',
        'settings.autoOpenPanelHint':
          'When the Agent calls an earth tool (earth_scene / earth_capture / earth_draw / earth_measure), open the Digital Earth panel beside the conversation; with this off you can still open it from the globe button in the chat header. The preference is stored in this browser only.',
        'settings.screenshotHud': 'Overlay coordinate HUD and credits in snapshots',
        'settings.screenshotHudHint':
          'Off by default: snapshots keep only the clean 3D view, which is easier to share or hand to a model. Turn it on to burn the cursor coordinates, camera parameters and team credit into the image (the panel toolbar is DOM chrome and can never be part of the image).',
        'settings.showLayers': 'Show the layer card',
        'settings.showLayersHint':
          'When off, the layer card collapses off the canvas; reopen it from the Layers button in the toolbar. The preference is written back to the sources config.',
        'settings.showHud': 'Show the coordinate HUD',
        'settings.showHudHint':
          'When off, the bottom-left coordinates/tile statistics are not rendered and pointer sampling stops to save performance. Snapshots still hide the HUD by default; the preference is written back to the sources config.',
        'about.version': 'Version',
        'about.homepage': 'Source code',
        'about.issues': 'Report an issue',
        'about.team': 'Developed by',
        'about.teamName': 'Wuhan University CVEO Research Group',
        'about.license': 'MIT License',
        'about.licenseLabel': 'License',
        'about.intro':
          'Inspect and drive a 3D earth right inside a DSH conversation: stack 3D Tiles / 3DGS, imagery and terrain, and let the Agent read the scene, take snapshots and work with it in natural language.',
        'about.agent': 'Agent integration',
        'about.agent.on': 'Connected and callable from chat',
        'about.agent.off': 'Connects when the panel opens',
        'about.agent.stale': 'Connection lost; reload the page to reconnect',
        'btn.health': 'Data check',
        'health.title': 'Data health check',
        'health.loading': 'Checking the dataset…',
        'health.failed': 'Data check failed: {message}',
        'health.noSource': 'This layer has no inspectable source; reload it and try again.',
        'health.source': 'Source',
        'health.sourceLabel': 'Layer',
        'health.kind.local': 'Local',
        'health.kind.remote': 'Remote',
        'health.assetVersion': 'Asset version',
        'health.tiles': 'Tiles',
        'health.contents': 'Contents',
        'health.depth': 'LOD depth',
        'health.extensions': 'Extensions',
        'health.rootError': 'Root geometric error',
        'health.boundingVolume': 'Bounding volume',
        'health.reportPath': 'Report path',
        'health.copy': 'Copy path',
        'health.copied': 'Report path copied',
        'health.copyFailed': 'Copy failed; select the report path manually',
        'health.issues': 'Issues',
        'health.noIssues': 'No data issues found',
        'health.runtime': 'Current runtime statistics',
        'health.level.error': 'Error',
        'health.level.warn': 'Warning',
        'health.level.info': 'Info',
        'health.unknown': '—',
        'agent.unknownSource': 'Cannot determine the data source of layer "{name}"; reload the layer and inspect it again.',
        'agent.notReady': 'The 3D engine is not ready yet; retry in a moment.',
        'agent.hiddenPanel':
          'The Digital Earth panel is not visible (another tab is selected or the window is in the background), so no frame can be rendered. Switch to the Digital Earth tab in the right sidebar, keep the window in the foreground, then retry.',
        'agent.captureTooLarge': 'The screenshot exceeds the size limit; retry with a smaller width.',
        'agent.noViewer': 'The 3D canvas is unavailable; refresh the page and retry.',
        'agent.missingLayer': 'Provide layer (a layer id or name).',
        'agent.unknownLayer': 'No layer "{name}". Current layers: {list}',
        'agent.missingUrl': 'Provide an http(s) URL or a local tileset.json path.',
        'agent.dirDenied': 'Could not access that local folder ({message}). Retry once to trigger the authorisation prompt; if it still fails, authorise the folder in the panel and try again.',
        'agent.missingCoords': 'Provide lon and lat.',
        'agent.unknownImagery': 'No imagery source "{name}". Available: {list}',
        'agent.unknownTerrain': 'No terrain source "{name}". Available: {list}',
        'agent.badAction': 'Unsupported action: {action}',
        'agent.badGeojson': 'Invalid annotation data: {message}',
        'agent.badMeasure': 'Invalid measurement arguments: {message}',
        'agent.measureEmpty': 'No measurement result was produced.',
        'agent.clearedOverlays': 'Agent annotations cleared',
        'access.title': 'Allow local data access',
        'access.body':
          'The Agent wants to load data from this local path. If you allow it, the panel first registers the containing folder as a readable local data source (for this page session only), then continues the operation.',
        'access.dir': 'Folder',
        'access.path': 'Requested path',
        'access.target': 'Resolved file',
        'access.file': 'File',
        'access.allowing': 'Registering the folder…',
        'access.request.load': 'Load 3D Tiles',
        'access.request.inspect': 'Data health check',
        'access.request.generic': 'read local data',
        'access.missing':
          'No tileset.json exists at that exact path right now: after you allow it, the Host keeps looking for a single candidate inside the ancestor folder and only loads the file when exactly one is found.',
        'access.resolved': 'A candidate file was found in an ancestor folder; allowing loads this file:',
        'access.allow': 'Allow and continue',
        'access.cancel': 'Cancel',
        'access.denied': 'The user cancelled the local path authorisation, so the operation did not run.',
        'access.scanFailed': 'The folder could not be registered, so the operation did not run: {message}',
        'access.remote': 'Only local paths need authorisation; remote URLs do not.',
        'access.badPath': 'The authorisation request has no valid local path.',
        'toast.captureSaved': 'Saved {width}×{height} snapshot: {path}',
        'toast.noSession': 'Open a conversation first to view the globe beside it.',
        'unit.hectare': 'ha',
      },
    }

    /** About-tab fallbacks used before the Host meta payload arrives. */
    const FALLBACK_ABOUT = {
      version: '1.3.0',
      homepage: 'https://github.com/CVEO/dsh-digital-earth',
      teamUrl: 'https://www.whu-cveo.com/',
    }

    const localeId = () => {
      const active = service('locale')?.getSnapshot?.()?.active
      if (typeof active === 'string' && active !== '') return active
      return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
    }
    const isChinese = () => localeId().toLowerCase().startsWith('zh')

    /** Translate a copy key; `{name}` placeholders interpolate from `params`. */
    const t = (key, params) => {
      const table = isChinese() ? MESSAGES.zh : MESSAGES.en
      let text = table[key] ?? MESSAGES.en[key] ?? key
      if (params !== undefined) {
        for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value))
      }
      return text
    }

    /** Re-render the panel when the DSH locale changes. */
    function useTranslation() {
      React.useSyncExternalStore(
        React.useCallback((callback) => service('locale')?.subscribe?.(callback) ?? (() => {}), []),
        localeId,
      )
      return t
    }
    //#endregion localization

    //#region theme ------------------------------------------------------------

    /** Whether DSH (or the OS, when DSH follows it) is currently dark. */
    const darkFromEnvironment = () => {
      const theme = service('theme')
      const snapshot = theme?.getTheme?.()
      const scheme = snapshot?.active?.colorScheme
      if (scheme === 'dark') return true
      if (scheme === 'light') return false
      if (typeof document !== 'undefined' && document.body) {
        if (document.body.hasAttribute('data-ds-dark-theme')) return true
        const source = document.documentElement?.dataset?.dsThemeSource
        if (source === 'dark') return true
        if (source === 'light') return false
      }
      return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    }

    /**
     * Track the resolved DSH colour scheme. `theme/change` is the documented
     * channel; the media query covers a host without the theme service.
     */
    function useEnvironmentDark() {
      const subscribe = React.useCallback((callback) => {
        const theme = service('theme')
        const disposers = []
        if (theme && typeof appCtx?.on === 'function') disposers.push(appCtx.on('theme/change', callback))
        if (typeof matchMedia === 'function') {
          const media = matchMedia('(prefers-color-scheme: dark)')
          media.addEventListener('change', callback)
          disposers.push(() => media.removeEventListener('change', callback))
        }
        return () => {
          for (const dispose of disposers) dispose()
        }
      }, [])
      return React.useSyncExternalStore(subscribe, darkFromEnvironment)
    }
    //#endregion theme

    //#region preferences ------------------------------------------------------

    /**
     * Browser-local preferences live in localStorage rather than the Host source
     * catalog: the client must read the auto-open switch while the panel (and its
     * settings dialog) is closed, before any Host round-trip could complete.
     */
    const AUTO_OPEN_KEY = 'dsh.digital-earth.autoOpenPanel'

    /** Read the auto-open preference; default ON, and never throw on disabled storage. */
    const readAutoOpen = () => {
      try {
        const stored = window.localStorage.getItem(AUTO_OPEN_KEY)
        return stored === null ? true : stored === '1'
      } catch {
        return true
      }
    }

    const writeAutoOpen = (value) => {
      try {
        window.localStorage.setItem(AUTO_OPEN_KEY, value ? '1' : '0')
      } catch {
        // Storage disabled: the preference only survives until the page reloads.
      }
    }

    /**
     * Read one tool argument across the three owner blocks: a live call exposes a
     * growing `PartialArguments` view (`.text(key)`), a settled one keeps raw JSON
     * on `block.call.argsRaw`, and preparations may expose neither.
     */
    const toolArg = (block, key) => {
      const call = block?.call
      if (typeof call?.argsRaw === 'string') {
        try {
          const parsed = JSON.parse(call.argsRaw)
          if (parsed && typeof parsed === 'object' && typeof parsed[key] === 'string') return parsed[key]
        } catch {
          // The stream has not produced valid JSON yet; fall through to the live view.
        }
      }
      const view = block?.args
      if (view && typeof view === 'object') {
        try {
          if (typeof view.text === 'function') {
            const text = view.text(key)
            if (typeof text === 'string' && text !== '') return text
          }
          if (typeof view[key] === 'string') return view[key]
        } catch {
          // A partially streamed argument can throw while decoding.
        }
      }
      return undefined
    }

    /** Last path segment of a Windows or POSIX folder path, for compact menus. */
    const folderName = (dir) => String(dir).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || String(dir)
    //#endregion preferences

    //#region scene persistence -----------------------------------------------
    // The right sidebar may dispose a session's tab body when the user visits
    // another session or window, which would otherwise drop the globe state. The
    // scene is snapshotted per session in localStorage (camera, layers by source,
    // Agent overlays) and rebuilt when the panel mounts again. It is page-local
    // data: sources were already authorised by the user, and snapshots are
    // trimmed so many sessions cannot exhaust the origin quota.
    const SCENE_STORE_PREFIX = 'dsh.digital-earth.scene.'
    const SCENE_STORE_VERSION = 1
    const SCENE_STORE_MAX_ENTRIES = 12
    const SCENE_STORE_MAX_BYTES = 512 * 1024

    const sceneStoreKey = (sessionId) => `${SCENE_STORE_PREFIX}${sessionId}`

    const sceneStorage = () => {
      try {
        return typeof window !== 'undefined' ? window.localStorage : null
      } catch {
        return null
      }
    }

    /** Snapshot guard: storage can hold data written by an older or broken build. */
    const isSnapshotView = (view) =>
      view !== null &&
      typeof view === 'object' &&
      ['lon', 'lat', 'height', 'heading', 'pitch'].every(
        (key) => typeof view[key] === 'number' && Number.isFinite(view[key]),
      )

    const isSnapshotLayer = (layer) =>
      layer !== null &&
      typeof layer === 'object' &&
      typeof layer.name === 'string' &&
      layer.source !== null &&
      typeof layer.source === 'object' &&
      (typeof layer.source.path === 'string' || typeof layer.source.url === 'string')

    function readSceneSnapshot(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const store = sceneStorage()
      if (!store) return null
      try {
        const raw = store.getItem(sceneStoreKey(sessionId))
        if (typeof raw !== 'string' || raw === '') return null
        const snapshot = JSON.parse(raw)
        if (snapshot === null || typeof snapshot !== 'object' || snapshot.v !== SCENE_STORE_VERSION) return null
        const layers = (Array.isArray(snapshot.layers) ? snapshot.layers : [])
          .filter(isSnapshotLayer)
          .map((layer) => ({ name: layer.name, source: layer.source, visible: layer.visible !== false }))
        const draw = Array.isArray(snapshot.annotations?.draw)
          ? snapshot.annotations.draw.filter((command) => command !== null && typeof command === 'object' && command.geojson !== undefined)
          : []
        const measure = Array.isArray(snapshot.annotations?.measure)
          ? snapshot.annotations.measure.filter(
              (command) => command !== null && typeof command === 'object' && typeof command.mode === 'string' && Array.isArray(command.points),
            )
          : []
        return { view: isSnapshotView(snapshot.view) ? snapshot.view : null, layers, annotations: { draw, measure } }
      } catch {
        return null
      }
    }

    /** Drop the oldest snapshots so the store stays bounded across sessions. */
    function trimSceneSnapshots(store, keepKey) {
      try {
        const entries = []
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index)
          if (typeof key !== 'string' || !key.startsWith(SCENE_STORE_PREFIX) || key === keepKey) continue
          let savedAt = ''
          try {
            const parsed = JSON.parse(store.getItem(key))
            if (typeof parsed?.savedAt === 'string') savedAt = parsed.savedAt
          } catch {
            // Unreadable entry sorts first and is removed before valid ones.
          }
          entries.push({ key, savedAt })
        }
        entries.sort((left, right) => left.savedAt.localeCompare(right.savedAt))
        const excess = entries.length + 1 - SCENE_STORE_MAX_ENTRIES
        for (let index = 0; index < excess; index += 1) store.removeItem(entries[index].key)
      } catch {
        // Quota or privacy mode: persistence stays best effort.
      }
    }

    function writeSceneSnapshot(sessionId, snapshot) {
      if (typeof sessionId !== 'string' || sessionId === '') return
      const store = sceneStorage()
      if (!store) return
      const body = { v: SCENE_STORE_VERSION, savedAt: new Date().toISOString(), ...snapshot }
      let text = ''
      try {
        text = JSON.stringify(body)
      } catch {
        return
      }
      // Overlays are reconstructible from the conversation, so drop them first
      // rather than lose the camera and layer list to the quota.
      if (text.length > SCENE_STORE_MAX_BYTES) {
        body.annotations = { draw: [], measure: [] }
        try {
          text = JSON.stringify(body)
        } catch {
          return
        }
        if (text.length > SCENE_STORE_MAX_BYTES) return
      }
      try {
        store.setItem(sceneStoreKey(sessionId), text)
      } catch {
        return
      }
      trimSceneSnapshots(store, sceneStoreKey(sessionId))
    }
    //#endregion scene persistence

    //#region helpers ----------------------------------------------------------

    const message = (error) => (error instanceof Error ? error.message : String(error))
    // Tool results are model-facing: never leak the plugin-instance token that
    // guards /tiles and /files, so an Agent cannot mutate the local allowlist.
    const redactUrl = (value) =>
      typeof value === 'string'
        ? value.replace(/\/api\/3dviewer\/(tiles|files)\/[^/]+\//g, '/api/3dviewer/$1/<token>/')
        : value
    const b64url = (value) => {
      const bytes = new TextEncoder().encode(value)
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    const formatValue = (value) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
      return text.length > 200 ? `${text.slice(0, 200)}…` : text
    }
    const formatBytes = (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '–'
      if (value >= 1 << 30) return `${(value / (1 << 30)).toFixed(2)} GB`
      if (value >= 1 << 20) return `${(value / (1 << 20)).toFixed(1)} MB`
      if (value >= 1 << 10) return `${(value / 1024).toFixed(0)} KB`
      return `${value} B`
    }
    const formatCount = (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '–'
      if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`
      return String(value)
    }
    const formatDistance = (meters) =>
      meters >= 1000 ? `${(meters / 1000).toFixed(3)} km` : `${meters.toFixed(2)} m`
    const formatArea = (squareMeters) =>
      squareMeters >= 1e6
        ? `${(squareMeters / 1e6).toFixed(3)} km²`
        : squareMeters >= 1e4
          ? `${(squareMeters / 1e4).toFixed(2)} ${t('unit.hectare')}`
          : `${squareMeters.toFixed(1)} m²`
    const formatHeight = (meters) =>
      Math.abs(meters) >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(1)} m`

    function geodesicLength(Cesium, points) {
      let total = 0
      for (let index = 1; index < points.length; index += 1) {
        const left = Cesium.Cartographic.fromCartesian(points[index - 1])
        const right = Cesium.Cartographic.fromCartesian(points[index])
        total += new Cesium.EllipsoidGeodesic(left, right).surfaceDistance
      }
      return total
    }

    function planarArea(Cesium, points) {
      if (points.length < 3) return 0
      const enu = Cesium.Transforms.eastNorthUpToFixedFrame(points[0])
      const inverse = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4())
      const local = points.map((point) => Cesium.Matrix4.multiplyByPoint(inverse, point, new Cesium.Cartesian3()))
      let sum = 0
      for (let index = 0; index < local.length; index += 1) {
        const current = local[index]
        const next = local[(index + 1) % local.length]
        sum += current.x * next.y - next.x * current.y
      }
      return Math.abs(sum) / 2
    }

    const clone = (value) => JSON.parse(JSON.stringify(value))
    //#endregion helpers

    //#region data access ------------------------------------------------------

    const loadMeta = (force = false) => {
      if (force) metaPromise = null
      metaPromise ??= fetch('/api/3dviewer/meta', { credentials: 'same-origin' })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json()
        })
        .catch((error) => {
          // A failed fetch must not poison the cache: the next attempt has to retry.
          metaPromise = null
          throw error
        })
      return metaPromise
    }

    const loadCesium = () => {
      cesiumPromise ??= (async () => {
        const meta = await loadMeta()
        window.CESIUM_BASE_URL = meta.cesiumBase
        return import(meta.cesiumBase + 'index.js')
      })()
      return cesiumPromise
    }

    const loadCesiumStyle = () => {
      cesiumStylePromise ??= (async () => {
        if (document.getElementById('mv-cesium-style')) return
        const meta = await loadMeta()
        await new Promise((resolve) => {
          const link = document.createElement('link')
          link.id = 'mv-cesium-style'
          link.rel = 'stylesheet'
          link.href = meta.cesiumBase + 'Widgets/widgets.css'
          link.onload = resolve
          link.onerror = resolve
          document.head.appendChild(link)
        })
      })()
      return cesiumStylePromise
    }

    /** Read the persisted source catalog (falls back to the built-in catalog). */
    const loadSources = async (meta) => {
      try {
        const response = await fetch(meta.sourcesUrl, { credentials: 'same-origin' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.json()
      } catch {
        const config = {
          imagery: [
            {
              id: 'esri-world-imagery',
              name: 'Esri World Imagery',
              type: 'xyz',
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              maximumLevel: 19,
              credit: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            },
          ],
          terrain: [
            {
              id: 'arcgis-world-elevation',
              name: 'ArcGIS WorldElevation3D',
              type: 'arcgis',
              url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
              credit: 'Esri, CGIAR, USGS',
            },
          ],
          settings: { theme: 'auto', imagery: 'esri-world-imagery', terrain: null },
        }
        return { config, defaults: clone(config) }
      }
    }

    /** Persist the catalog; calls are serialised so concurrent edits cannot race. */
    const persistSources = (meta, config) => {
      const run = saveChain.then(async () => {
        const response = await fetch(meta.sourcesUrl, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(config),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return (await response.json()).config
      })
      // Keep the queue usable after a failed write while still reporting it to the caller.
      saveChain = run.catch(() => {})
      return run
    }

    /** Map a stored imagery source onto a Cesium imagery provider. */
    /**
     * Register a local folder with the Host scan endpoint so its files can be
     * served same-origin. `x-dsh-panel` is required: it proves the request comes
     * from the panel, not from arbitrary page script.
     */
    const scanLocalDirectory = async (meta, directory) => {
      const response = await fetch(
        `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(directory)}`,
        { credentials: 'same-origin', headers: { 'x-dsh-panel': '1' } },
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json().catch(() => ({}))
    }

    /**
     * Client-side cleanup deadline for the authorisation dialog. The Host times the
     * request out at 30 s and maps it to `access_timeout`; this timer only keeps the
     * panel's serialised command chain from waiting forever after that, and the Host
     * ignores the late ack.
     */
    const ACCESS_TIMEOUT_MS = 32000

    async function imageryProvider(Cesium, source) {
      const options = {}
      if (source.credit) options.credit = source.credit
      if (source.type === 'arcgis') return Cesium.ArcGisMapServerImageryProvider.fromUrl(source.url, options)
      if (source.type === 'wms') {
        return new Cesium.WebMapServiceImageryProvider({
          url: source.url,
          layers: source.layers ?? '',
          parameters: { service: 'WMS', version: '1.1.1', transparent: true, format: 'image/png' },
          ...options,
        })
      }
      if (source.maximumLevel !== undefined) options.maximumLevel = source.maximumLevel
      if (source.subdomains) options.subdomains = source.subdomains
      if (source.tilingScheme === 'geographic') options.tilingScheme = new Cesium.GeographicTilingScheme()
      if (source.tilingScheme === 'web-mercator') options.tilingScheme = new Cesium.WebMercatorTilingScheme()
      // Cesium reads south-origin tile rows from `{reverseY}`, so rewrite the template
      // instead of asking users to remember which placeholder their tileset needs.
      const template = source.reverseY ? source.url.replace(/\{y\}/g, '{reverseY}') : source.url
      return new Cesium.UrlTemplateImageryProvider({ url: template, ...options })
    }

    /** Map a stored terrain source onto a Cesium terrain provider. */
    async function terrainProvider(Cesium, source) {
      const options = {}
      if (source.credit) options.credit = source.credit
      if (source.requestVertexNormals) options.requestVertexNormals = true
      if (source.requestWaterMask) options.requestWaterMask = true
      if (source.type === 'cesium') return Cesium.CesiumTerrainProvider.fromUrl(source.url, options)
      return Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(source.url, options)
    }
    //#endregion data access

    //#region cursor sampling --------------------------------------------------

    /** Above this camera height the depth buffer is too coarse to trust. */
    const PICK_POSITION_MAX_CAMERA_HEIGHT = 100000
    /** Steady HUD refresh cadence while the pointer moves (5–6 Hz is plenty). */
    const HUD_SAMPLE_INTERVAL_MS = 180
    /** Quiet time after the last pointer move before the one depth-buffer read. */
    const HUD_SETTLE_MS = 180

    /**
     * Sample the point under the pointer.
     *
     * The globe ray hit always has an answer (ray → ellipsoid), which keeps the
     * readout alive on the bare globe with terrain disabled; a non-flat terrain
     * provider fills in the surface elevation through `globe.getHeight`.
     * `options.pickPosition` additionally reads the depth buffer so a 3D Tiles /
     * glTF surface under the cursor reports its own elevation — that is a GPU→CPU
     * readback, so the HUD only asks for it once the pointer settles. `scene.pick`
     * is deliberately not used here: the pick was only needed to decide whether
     * depth was trustworthy, and `earth_scene pick` remains the way to identify
     * an object.
     */
    function sampleCursor(viewer, Cesium, position, options = {}) {
      const scene = viewer.scene
      const ellipsoid = scene.globe.ellipsoid
      const ray = viewer.camera.getPickRay(position)
      const interval = ray ? Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid) : undefined
      let carto = interval ? ellipsoid.cartesianToCartographic(Cesium.Ray.getPoint(ray, interval.start)) : null
      if (!carto) return null
      carto.height = 0

      let sampled = false
      const cameraHeight = viewer.camera.positionCartographic.height
      if (options.pickPosition === true && scene.pickPositionSupported && cameraHeight < PICK_POSITION_MAX_CAMERA_HEIGHT) {
        try {
          const point = scene.pickPosition(position)
          if (Cesium.defined(point)) {
            const depthCarto = Cesium.Cartographic.fromCartesian(point)
            if (depthCarto && Math.abs(depthCarto.height) < 30000) {
              carto = depthCarto
              sampled = true
            }
          }
        } catch {
          /* keep the ray hit */
        }
      }
      if (!sampled) {
        const provider = scene.globe.terrainProvider
        const flat = provider instanceof Cesium.EllipsoidTerrainProvider
        if (!flat && typeof scene.globe.getHeight === 'function') {
          const terrainHeight = scene.globe.getHeight(carto)
          if (typeof terrainHeight === 'number' && Number.isFinite(terrainHeight)) carto.height = terrainHeight
        } else {
          carto.height = 0
        }
      } else if (scene.globe.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
        // The depth buffer biases the faceted ellipsoid by up to a few
        // kilometres; report sea level instead of a fake elevation.
        if (Math.abs(carto.height) < 100) carto.height = 0
      }
      return carto
    }

    const formatCursor = (Cesium, carto) => {
      const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5)
      const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5)
      const height = Math.abs(carto.height) < 0.05 ? 0 : carto.height
      return `${lon}, ${lat} · ${t('hud.elevation', { value: formatHeight(height) })}`
    }
    //#endregion cursor sampling

    function ViewerIcon({ size = 18 }) {
      return h(
        'svg',
        { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('circle', { cx: 30, cy: 30, r: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 3 }),
        h('ellipse', { cx: 30, cy: 30, rx: 8.5, ry: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, opacity: 0.85 }),
        h('path', { d: 'M10.5 30h39M13.5 20.5h33M13.5 39.5h33', stroke: 'currentColor', strokeWidth: 2, opacity: 0.55 }),
        h('path', { d: 'M48 34l9 5v10l-9 5-9-5V39z', fill: 'currentColor', opacity: 0.9 }),
      )
    }

    const ThemeIcon = ({ mode, size = 16 }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        mode === 'dark'
          ? h('path', { d: 'M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5 8.6 8.6 0 1 0 20.5 14.4z', fill: 'currentColor' })
          : mode === 'light'
            ? h(
                'g',
                { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', fill: 'none' },
                h('circle', { cx: 12, cy: 12, r: 4.1 }),
                h('path', { d: 'M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6' }),
              )
            : h(
                'g',
                { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', fill: 'none' },
                h('circle', { cx: 12, cy: 12, r: 8.4 }),
                h('path', { d: 'M12 3.6a8.4 8.4 0 0 0 0 16.8z', fill: 'currentColor', stroke: 'none' }),
              ),
      )

    /** Crisp 16px action icons for the layer rows (Unicode glyphs rendered unevenly). */
    /** Four-corner expand glyph: the docked toolbar's fullscreen toggle. */
    const FullscreenIcon = ({ size = 15 }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h(
          'g',
          { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' },
          h('path', { d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }),
        ),
      )

    /** Coordinate crosshair used by the HUD visibility toggle. */
    const HudIcon = ({ size = 16 }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h(
          'g',
          { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', fill: 'none' },
          h('circle', { cx: 12, cy: 12, r: 5.2 }),
          h('path', { d: 'M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4' }),
        ),
      )

    /** Chevron used by the floating layer-card header to collapse itself. */
    const CollapseIcon = ({ size = 13 }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', {
          d: 'M5 15l7-7 7 7',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )

    function LayerActionIcon({ kind, size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      let shapes
      if (kind === 'visible') {
        shapes = [
          h('path', { key: 'eye', d: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z', ...stroke }),
          h('circle', { key: 'pupil', cx: 12, cy: 12, r: 3, ...stroke }),
        ]
      } else if (kind === 'hidden') {
        shapes = [
          h('path', { key: 'eye', d: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z', ...stroke }),
          h('path', { key: 'slash', d: 'M3.5 3.5l17 17', ...stroke }),
        ]
      } else if (kind === 'locate') {
        shapes = [
          h('circle', { key: 'ring', cx: 12, cy: 12, r: 5.5, ...stroke }),
          h('path', { key: 'ticks', d: 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3', ...stroke }),
        ]
      } else if (kind === 'inspect') {
        shapes = [
          h('circle', { key: 'lens', cx: 10.5, cy: 10.5, r: 6, ...stroke }),
          h('path', { key: 'handle', d: 'M15 15l5.5 5.5', ...stroke }),
        ]
      } else {
        shapes = [h('path', { key: 'x', d: 'M6 6l12 12M18 6L6 18', ...stroke })]
      }
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } }, shapes)
    }

    /** Bottom-left HUD: FPS, pointer position/elevation, camera and per-layer statistics. */
    function StatusHud({ fps, stats, viewerRef, cesiumRef, labels, readoutRef }) {
      // The cursor readout is written straight into the DOM: it updates around five
      // times a second, so keeping it out of React avoids re-renders while busy.
      const cursorRef = React.useRef(null)

      React.useEffect(() => {
        const viewer = viewerRef.current
        const Cesium = cesiumRef.current
        if (!viewer || !Cesium) return undefined
        const canvas = viewer.scene.canvas
        const pointer = { x: 0, y: 0, inside: false, dirty: false, dragging: false }
        let settleTimer = 0
        let shown = null
        const paint = (value) => {
          if (value === shown) return
          shown = value
          if (cursorRef.current) cursorRef.current.textContent = value ?? t('hud.empty')
          if (readoutRef) readoutRef.current = value
        }
        const sampleInto = (allowPickPosition) => {
          let next = null
          if (pointer.inside) {
            const position = new Cesium.Cartesian2(pointer.x, pointer.y)
            const carto = sampleCursor(viewer, Cesium, position, { pickPosition: allowPickPosition === true })
            if (carto) next = formatCursor(Cesium, carto)
          }
          paint(next)
        }
        const clearSettle = () => {
          if (settleTimer) clearTimeout(settleTimer)
          settleTimer = 0
        }
        // One sample shortly after the pointer stops, allowed to read the depth
        // buffer: this is the only place the HUD pays for that GPU readback, and a
        // single read is enough because the camera is no longer moving.
        const armSettle = () => {
          clearSettle()
          settleTimer = setTimeout(() => {
            settleTimer = 0
            if (pointer.dragging) return
            pointer.dirty = false
            sampleInto(true)
          }, HUD_SETTLE_MS)
        }
        const onMove = (event) => {
          pointer.x = event.offsetX
          pointer.y = event.offsetY
          pointer.inside = true
          pointer.dirty = true
          // While the camera is being dragged the readout would be stale anyway;
          // skip sampling and let the pointer-up settle produce one update.
          if (!pointer.dragging) armSettle()
        }
        const onLeave = () => {
          pointer.inside = false
          pointer.dirty = true
          clearSettle()
        }
        const onPointerDown = () => {
          pointer.dragging = true
          clearSettle()
        }
        const onPointerUp = () => {
          if (!pointer.dragging) return
          pointer.dragging = false
          pointer.dirty = true
          armSettle()
        }
        canvas.addEventListener('pointermove', onMove, { passive: true })
        canvas.addEventListener('pointerleave', onLeave, { passive: true })
        canvas.addEventListener('pointerdown', onPointerDown, { passive: true })
        window.addEventListener('pointerup', onPointerUp, { passive: true })
        window.addEventListener('pointercancel', onPointerUp, { passive: true })
        // Steady cadence while the pointer moves: ray + terrain height only, so the
        // periodic path never touches the depth buffer and stays smooth on
        // multi-million-triangle tilesets.
        const timer = setInterval(() => {
          if (pointer.dragging || !pointer.dirty) return
          pointer.dirty = false
          sampleInto(false)
        }, HUD_SAMPLE_INTERVAL_MS)
        return () => {
          clearSettle()
          clearInterval(timer)
          canvas.removeEventListener('pointermove', onMove)
          canvas.removeEventListener('pointerleave', onLeave)
          canvas.removeEventListener('pointerdown', onPointerDown)
          window.removeEventListener('pointerup', onPointerUp)
          window.removeEventListener('pointercancel', onPointerUp)
          // Drop the stale readout so a later capture cannot reuse an old coordinate.
          if (readoutRef) readoutRef.current = null
        }
      }, [])

      return h(
        'div',
        { className: 'mv-hud mv-glass' },
        h(
          'div',
          { className: 'row' },
          h('span', null, 'FPS ', h('b', null, fps)),
          h('span', null, `${labels.pointer} `, h('b', { ref: cursorRef }, t('hud.empty'))),
          h('span', null, `${labels.camera} `, h('b', null, stats.height)),
          h('span', null, `${labels.heading} `, h('b', null, `${stats.heading} / ${stats.pitch}`)),
        ),
        stats.layers.map((row) =>
          h(
            'div',
            { key: row.id, className: 'row' },
            h('b', null, row.name),
            h('span', null, `${labels.tiles} `, h('b', null, formatCount(row.tiles))),
            h('span', null, `${labels.pending} `, h('b', null, formatCount(row.pending))),
            h('span', null, `${labels.triangles} `, h('b', null, formatCount(row.triangles))),
            h('span', null, `${labels.cache} `, h('b', null, formatBytes(row.memory))),
          ),
        ),
      )
    }

    function MenuItem({ onClick, children, active, title }) {
      return h(
        'button',
        { type: 'button', className: `mv-menu-item${active ? ' on' : ''}`, onClick, title },
        children,
        active ? h('span', { className: 'check', 'aria-hidden': true }, '✓') : null,
      )
    }

    const CSS = `
.mv-root{position:relative;flex:1 1 0;min-height:0;overflow:hidden;background:var(--mv-bg);color:var(--mv-text);font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;--mv-bg:var(--dsw-alias-bg-base,#fff);--mv-text:var(--dsw-alias-label-primary,#0f1115);--mv-dim:var(--dsw-alias-label-secondary,#5b6068);--mv-line:var(--dsw-alias-border-l2,#0000001a);--mv-accent:var(--dsw-alias-state-business-primary,#4176e6);--mv-lift:var(--dsw-alias-interactive-bg-hover,#2631480f);--mv-glass:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 88%,transparent);--mv-glass-strong:var(--dsw-alias-bg-layer-1,#fff);--mv-input:var(--dsw-alias-interactive-bg-hover,#2631480f);--mv-shadow:0 8px 28px rgba(15,23,42,.18);--mv-attrib:rgba(255,255,255,.62);--mv-attrib-shadow:0 1px 2px rgba(0,0,0,.6);--mv-overlay:transparent;--mv-scrim:rgba(24,34,50,.28)}
.mv-root[data-mv-scheme="dark"]{--mv-attrib:rgba(255,255,255,.62);--mv-attrib-shadow:0 1px 2px rgba(0,0,0,.6);--mv-overlay:transparent;--mv-scrim:rgba(3,7,13,.62)}
.mv-root[data-mv-theme="dark"]{--mv-bg:#151517;--mv-text:#ebeef2;--mv-dim:#adb2b8;--mv-line:#ffffff1f;--mv-accent:#7aaaff;--mv-lift:#ffffff14;--mv-glass:rgba(21,21,23,.82);--mv-glass-strong:#232324;--mv-input:#ffffff14;--mv-shadow:0 8px 28px rgba(0,0,0,.34);color-scheme:dark}
.mv-root[data-mv-theme="light"]{--mv-bg:#fff;--mv-text:#0f1115;--mv-dim:#5b6068;--mv-line:#0000001a;--mv-accent:#4176e6;--mv-lift:#2631480f;--mv-glass:rgba(255,255,255,.86);--mv-glass-strong:#fff;--mv-input:#2631480f;--mv-shadow:0 8px 28px rgba(15,23,42,.16);color-scheme:light}
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
.mv-layers{position:absolute;top:60px;right:10px;width:284px;max-height:calc(100% - 214px);display:flex;flex-direction:column;border-radius:13px;z-index:9;overflow:hidden}
.mv-layers>header{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;font-size:11px;letter-spacing:.06em;color:var(--mv-dim);border-bottom:.5px solid var(--mv-line)}
.mv-layers>header .mv-icon-btn{width:22px;height:22px;font-size:12px}
.mv-layer-list{overflow:auto;padding:4px}
.mv-layer{display:flex;align-items:center;gap:2px;padding:5px 6px;border-radius:8px}
.mv-layer:hover{background:color-mix(in srgb,var(--mv-lift) 64%,transparent)}
.mv-layer .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;cursor:pointer}
.mv-layer.off .name{color:var(--mv-dim);text-decoration:line-through}
.mv-icon-btn{appearance:none;border:0;background:transparent;color:var(--mv-dim);width:26px;height:26px;border-radius:7px;cursor:pointer;font:inherit;font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:none}
.mv-layer{gap:3px;padding:5px 7px}
.mv-layer .mv-icon-btn{font-size:15px}
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
.mv-root.mv-docked .mv-layers{top:96px;right:20px;width:min(284px,calc(100% - 40px));max-height:calc(100% - 250px)}
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
}
/* Snapshot mode: the picture is meant to be clean, so every overlay is hidden. */
.mv-root.mv-capturing .mv-top,.mv-root.mv-capturing .mv-urlbar,.mv-root.mv-capturing .mv-layers,.mv-root.mv-capturing .mv-hud,.mv-root.mv-capturing .mv-attr,.mv-root.mv-capturing .mv-credits,.mv-root.mv-capturing .mv-pick,.mv-root.mv-capturing .mv-measure,.mv-root.mv-capturing .mv-toast,.mv-root.mv-capturing .mv-overlay,.mv-root.mv-capturing .mv-modal{visibility:hidden!important}
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
`

    //#region sources dialog ---------------------------------------------------

    const SOURCE_TYPES = {
      imagery: ['xyz', 'arcgis', 'wms'],
      terrain: ['arcgis', 'cesium'],
    }
    const SOURCE_TYPE_KEY = {
      xyz: 'settings.type.xyz',
      arcgis: 'settings.type.arcgis',
      wms: 'settings.type.wms',
      cesium: 'settings.type.cesium',
    }

    const emptySource = (kind) => ({
      id: `${kind}-${Date.now().toString(36)}`,
      name: '',
      type: SOURCE_TYPES[kind][0],
      url: '',
      credit: '',
    })

    function SourceForm({ kind, source, onPickLocal, onChange, onCancel, t }) {
      const set = (patch) => onChange({ ...source, ...patch })
      const field = (label, input) => h('div', { className: 'mv-field' }, h('label', null, label), input)
      const pickTiles = async () => {
        if (typeof onPickLocal !== 'function') return
        const url = await onPickLocal()
        if (url) set({ type: 'xyz', url, maximumLevel: source.maximumLevel ?? 18 })
      }
      const text = (key, value, placeholder) =>
        h('input', {
          key,
          value: value ?? '',
          placeholder: placeholder ?? '',
          onChange: (event) => set({ [key]: event.target.value }),
        })
      return h(
        'div',
        { className: 'mv-form' },
        h(
          'div',
          { className: 'grid' },
          field(t('settings.field.name'), text('name')),
          field(
            t('settings.field.type'),
            h(
              'select',
              { value: source.type, onChange: (event) => set({ type: event.target.value }) },
              SOURCE_TYPES[kind].map((type) => h('option', { key: type, value: type }, t(SOURCE_TYPE_KEY[type]))),
            ),
          ),
        ),
        field(t('settings.field.url'), text('url', source.url, kind === 'imagery' ? 'https://…/{z}/{x}/{y}.png' : 'https://…')),
        field(t('settings.field.credit'), text('credit', source.credit)),
        kind === 'imagery' && source.type === 'xyz'
          ? h(
              'div',
              { className: 'grid' },
              field(
                t('settings.field.maxLevel'),
                h('input', {
                  type: 'number',
                  min: 0,
                  max: 25,
                  value: source.maximumLevel ?? '',
                  onChange: (event) =>
                    set({ maximumLevel: event.target.value === '' ? undefined : Number(event.target.value) }),
                }),
              ),
              field(
                t('settings.field.tilingScheme'),
                h(
                  'select',
                  {
                    value: source.tilingScheme ?? 'web-mercator',
                    onChange: (event) => set({ tilingScheme: event.target.value }),
                  },
                  h('option', { value: 'web-mercator' }, t('settings.tiling.webMercator')),
                  h('option', { value: 'geographic' }, t('settings.tiling.geographic')),
                ),
              ),
              field(
                t('settings.field.subdomains'),
                h('input', {
                  value: (source.subdomains ?? []).join(','),
                  onChange: (event) =>
                    set({
                      subdomains: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter((item) => item !== ''),
                    }),
                }),
              ),
            )
          : null,
        kind === 'imagery' && source.type === 'xyz'
          ? h(
              'div',
              { className: 'grid' },
              h(
                'div',
                { className: 'mv-field check' },
                h('input', {
                  id: 'mv-reverse-y',
                  type: 'checkbox',
                  checked: source.reverseY === true,
                  onChange: (event) => set({ reverseY: event.target.checked }),
                }),
                h('label', { htmlFor: 'mv-reverse-y' }, t('settings.field.tms')),
              ),
              h(
                'div',
                { className: 'mv-field' },
                h(
                  'button',
                  { type: 'button', className: 'mv-cta', onClick: pickTiles },
                  t('settings.field.localTiles'),
                ),
              ),
            )
          : null,
        kind === 'imagery' && source.type === 'wms'
          ? field(t('settings.field.layers'), text('layers', source.layers))
          : null,
        kind === 'terrain'
          ? h(
              'div',
              { className: 'grid' },
              h(
                'div',
                { className: 'mv-field check' },
                h('input', {
                  id: 'mv-normals',
                  type: 'checkbox',
                  checked: source.requestVertexNormals === true,
                  onChange: (event) => set({ requestVertexNormals: event.target.checked }),
                }),
                h('label', { htmlFor: 'mv-normals' }, t('settings.field.normals')),
              ),
              h(
                'div',
                { className: 'mv-field check' },
                h('input', {
                  id: 'mv-water',
                  type: 'checkbox',
                  checked: source.requestWaterMask === true,
                  onChange: (event) => set({ requestWaterMask: event.target.checked }),
                }),
                h('label', { htmlFor: 'mv-water' }, t('settings.field.waterMask')),
              ),
            )
          : null,
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
          h('button', { type: 'button', className: 'mv-cta', onClick: onCancel }, t('btn.cancel')),
        ),
      )
    }

    function SourcesDialog({ config, defaults, environmentDark, themeMode, onPickLocal, onSave, onClose, messages, meta, bridgeOn, bridgeReload }) {
      const t = messages
      const [draft, setDraft] = React.useState(() => clone(config))
      const [tab, setTab] = React.useState('imagery')
      const [editing, setEditing] = React.useState(null)
      // Auto-open is a browser preference, not part of the Host source catalog, so
      // it stays outside `draft` and applies the moment the checkbox changes.
      const [autoOpen, setAutoOpen] = React.useState(readAutoOpen)
      const activeId = (kind) => (kind === 'imagery' ? draft.settings.imagery : draft.settings.terrain)

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          onClose()
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [onClose])

      const setSources = (kind, list) => setDraft((current) => ({ ...current, [kind]: list }))
      const selectSource = (kind, id) =>
        setDraft((current) => ({
          ...current,
          settings: { ...current.settings, [kind]: id },
        }))
      const addSource = (kind) => {
        const source = emptySource(kind)
        setSources(kind, [...draft[kind], source])
        setEditing({ kind, id: source.id })
      }
      const removeSource = (kind, id) => {
        setSources(
          kind,
          draft[kind].filter((item) => item.id !== id),
        )
        if (draft.settings[kind] === id) selectSource(kind, null)
        if (editing?.id === id) setEditing(null)
      }
      const updateSource = (kind, source) =>
        setSources(
          kind,
          draft[kind].map((item) => (item.id === source.id ? source : item)),
        )
      const save = () => {
        for (const kind of ['imagery', 'terrain']) {
          if (draft[kind].some((source) => source.name.trim() === '' || source.url.trim() === '')) {
            window.alert(t('settings.required'))
            return
          }
        }
        onSave(draft)
      }
      const restore = () => {
        if (!window.confirm(t('settings.restoreConfirm'))) return
        setDraft(clone(defaults))
        setEditing(null)
      }
      const segments = [
        ['auto', 'theme.auto'],
        ['light', 'theme.light'],
        ['dark', 'theme.dark'],
      ]
      const rowsFor = (kind) =>
        draft[kind].map((source) =>
          editing?.kind === kind && editing.id === source.id
            ? h(SourceForm, {
                key: source.id,
                kind,
                source,
                t,
                onPickLocal,
                onChange: (next) => updateSource(kind, next),
                onCancel: () => setEditing(null),
              })
            : h(
                'div',
                { key: source.id, className: 'mv-src' },
                h('span', {
                  className: `radio${activeId(kind) === source.id ? ' on' : ''}`,
                  role: 'radio',
                  'aria-checked': activeId(kind) === source.id,
                  tabIndex: 0,
                  onClick: () => selectSource(kind, activeId(kind) === source.id ? null : source.id),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') selectSource(kind, source.id)
                  },
                }),
                h(
                  'div',
                  { className: 'meta' },
                  h('b', null, source.name),
                  h('span', null, source.url),
                ),
                h('span', { className: 'badge' }, t(SOURCE_TYPE_KEY[source.type] ?? source.type)),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mv-icon-btn',
                    title: t('btn.edit'),
                    onClick: () => setEditing({ kind, id: source.id }),
                  },
                  '✎',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mv-icon-btn',
                    title: t('btn.delete'),
                    onClick: () => {
                      if (window.confirm(t('settings.deleteConfirm', { name: source.name }))) removeSource(kind, source.id)
                    },
                  },
                  '✕',
                ),
              ),
        )

      const appearance = h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('p', { className: 'mv-note' }, t('theme.appearanceHint')),
        h(
          'div',
          { className: 'mv-seg', role: 'radiogroup' },
          segments.map(([value, key]) =>
            h(
              'button',
              {
                key: value,
                type: 'button',
                className: themeMode === value ? 'on' : '',
                role: 'radio',
                'aria-checked': themeMode === value,
                onClick: () => setDraft((current) => ({ ...current, settings: { ...current.settings, theme: value } })),
              },
              t(key),
            ),
          ),
        ),
        h('p', { className: 'mv-note' }, `${t('theme.auto')} · ${environmentDark ? t('theme.dark') : t('theme.light')}`),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.autoOpenPanel')),
            h('span', null, t('settings.autoOpenPanelHint')),
          ),
          h('input', {
            type: 'checkbox',
            checked: autoOpen,
            onChange: (event) => {
              setAutoOpen(event.target.checked)
              writeAutoOpen(event.target.checked)
            },
          }),
        ),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.screenshotHud')),
            h('span', null, t('settings.screenshotHudHint')),
          ),
          h('input', {
            type: 'checkbox',
            checked: draft.settings.screenshotHud === true,
            onChange: (event) =>
              setDraft((current) => ({
                ...current,
                settings: { ...current.settings, screenshotHud: event.target.checked },
              })),
          }),
        ),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.showLayers')),
            h('span', null, t('settings.showLayersHint')),
          ),
          h('input', {
            type: 'checkbox',
            checked: draft.settings.showLayers !== false,
            onChange: (event) =>
              setDraft((current) => ({
                ...current,
                settings: { ...current.settings, showLayers: event.target.checked },
              })),
          }),
        ),
        h(
          'label',
          { className: 'mv-toggle' },
          h(
            'span',
            { className: 'text' },
            h('b', null, t('settings.showHud')),
            h('span', null, t('settings.showHudHint')),
          ),
          h('input', {
            type: 'checkbox',
            checked: draft.settings.showHud !== false,
            onChange: (event) =>
              setDraft((current) => ({
                ...current,
                settings: { ...current.settings, showHud: event.target.checked },
              })),
          }),
        ),
      )

      const homepage = meta?.homepage ?? FALLBACK_ABOUT.homepage
      // Prefer the Host's issues URL; older hosts only send homepage, whose
      // conventional sibling is /issues, so both paths stay useful.
      const issuesUrl = meta?.issues ?? `${String(homepage).replace(/\/+$/, '')}/issues`
      const teamUrl = meta?.team?.url ?? FALLBACK_ABOUT.teamUrl
      const about = h(
        'div',
        { className: 'mv-about' },
        h('p', { className: 'intro' }, t('about.intro')),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.version')),
          h('span', null, meta?.version ?? FALLBACK_ABOUT.version),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.homepage')),
          h('a', { href: homepage, target: '_blank', rel: 'noopener noreferrer' }, homepage),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.issues')),
          h('a', { href: issuesUrl, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub Issues'),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.team')),
          h(
            'div',
            { className: 'team' },
            h('a', { href: teamUrl, target: '_blank', rel: 'noopener noreferrer' }, meta?.team?.name ?? t('about.teamName')),
            h('small', null, teamUrl),
          ),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.agent')),
          h('span', null, bridgeReload ? t('about.agent.stale') : bridgeOn ? t('about.agent.on') : t('about.agent.off')),
        ),
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'key' }, t('about.licenseLabel')),
          h('span', null, t('about.license')),
        ),
      )

      return h(
        'div',
        { className: 'mv-modal', onPointerDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'mv-dialog', role: 'dialog', 'aria-modal': true },
          h(
            'header',
            null,
            h('b', null, t('settings.title')),
            h('button', { type: 'button', className: 'mv-icon-btn', onClick: onClose, title: t('btn.close') }, '✕'),
          ),
          h(
            'div',
            { className: 'mv-tabs' },
            [['imagery', 'settings.tab.imagery'], ['terrain', 'settings.tab.terrain'], ['appearance', 'settings.tab.appearance'], ['about', 'settings.tab.about']].map(
              ([value, key]) =>
                h(
                  'button',
                  {
                    key: value,
                    type: 'button',
                    className: `mv-tab${tab === value ? ' on' : ''}`,
                    onClick: () => setTab(value),
                  },
                  t(key),
                ),
            ),
          ),
          h(
            'div',
            { className: 'body' },
            tab === 'about'
              ? about
              : tab === 'appearance'
                ? appearance
                : h(
                    React.Fragment,
                    null,
                    h('p', { className: 'mv-note' }, t(tab === 'imagery' ? 'settings.imageryHint' : 'settings.terrainHint')),
                    rowsFor(tab),
                    draft[tab].length === 0 && editing === null
                      ? h('p', { className: 'mv-note' }, t('settings.empty'))
                      : null,
                    h(
                      'div',
                      { style: { display: 'flex', justifyContent: 'flex-start' } },
                      h('button', { type: 'button', className: 'mv-cta', onClick: () => addSource(tab) }, `+ ${t('btn.add')}`),
                    ),
                  ),
          ),
          h(
            'div',
            { className: 'footer' },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 } },
              h('button', { type: 'button', className: 'mv-cta', onClick: restore }, t('btn.restore')),
            ),
            h(
              'div',
              { className: 'right' },
              h('button', { type: 'button', className: 'mv-cta', onClick: onClose }, t('btn.cancel')),
              h('button', { type: 'button', className: 'mv-cta primary', onClick: save }, t('btn.save')),
            ),
          ),
        ),
      )
    }
    //#endregion sources dialog

    //#region data health dialog ----------------------------------------------

    /**
     * Read-only report dialog for the Host data-health inspector. The panel
     * never analyses tilesets itself: it posts the layer source and renders
     * whatever the Host returns.
     */
    function HealthDialog({ state, messages: t, onClose, onCopy }) {
      const report = state?.report ?? null
      const issues = Array.isArray(report?.issues) ? report.issues : []
      const extensions = Array.isArray(report?.counts?.extensionsUsed) ? report.counts.extensionsUsed : []
      const kind = report?.source?.kind === 'remote' ? 'health.kind.remote' : 'health.kind.local'
      const rows = report
        ? [
            ['health.source', `${t(kind)} · ${report.source?.label ?? t('health.unknown')}`],
            ['health.assetVersion', report.asset?.version ?? t('health.unknown')],
            ['health.tiles', String(report.counts?.tiles ?? 0)],
            ['health.contents', String(report.counts?.contents ?? 0)],
            ['health.depth', String(report.root?.depth ?? 0)],
            ['health.rootError', String(report.root?.geometricError ?? t('health.unknown'))],
            ['health.extensions', extensions.length > 0 ? extensions.join(', ') : t('health.unknown')],
          ]
        : []
      const runtime = report?.runtime ?? null
      const reportPath = state?.reportPath ?? report?.reportPath ?? ''
      const body = state?.loading
        ? h(
            'div',
            { className: 'mv-health-loading' },
            h('div', { className: 'mv-spinner' }),
            h('p', { className: 'mv-note' }, t('health.loading')),
          )
        : state?.error
          ? h('p', { className: 'mv-note' }, t('health.failed', { message: state.error }))
          : report
            ? h(
                'div',
                { className: 'mv-health-body' },
                h(
                  'div',
                  { className: 'mv-health-rows' },
                  rows.map(([key, value]) =>
                    h(
                      'div',
                      { className: 'row', key },
                      h('span', { className: 'key' }, t(key)),
                      h('span', { className: 'value' }, value),
                    ),
                  ),
                ),
                h(
                  'div',
                  { className: 'mv-health-section' },
                  h('b', null, `${t('health.issues')} · ${issues.length}`),
                  issues.length > 0
                    ? h(
                        'ul',
                        { className: 'issues' },
                        issues.map((issue, index) =>
                          h(
                            'li',
                            { key: `${issue.code}-${index}`, className: `lvl-${issue.level}` },
                            h('span', { className: 'badge' }, t(`health.level.${issue.level}`)),
                            h('code', null, issue.code),
                            h('span', { className: 'msg' }, issue.message),
                          ),
                        ),
                      )
                    : h('p', { className: 'mv-note' }, t('health.noIssues')),
                ),
                runtime
                  ? h(
                      'div',
                      { className: 'mv-health-section' },
                      h('b', null, t('health.runtime')),
                      h(
                        'div',
                        { className: 'mv-health-runtime' },
                        `${t('hud.tiles')} ${runtime.tiles ?? 0} · ${t('hud.pending')} ${runtime.pending ?? 0} · ${t('hud.triangles')} ${runtime.triangles ?? 0}`,
                      ),
                    )
                  : null,
                h(
                  'div',
                  { className: 'mv-health-path' },
                  h('span', { className: 'key' }, t('health.reportPath')),
                  h('code', { title: reportPath }, reportPath || t('health.unknown')),
                  reportPath
                    ? h('button', { type: 'button', className: 'mv-cta', onClick: onCopy }, t('health.copy'))
                    : null,
                ),
              )
            : null
      return h(
        'div',
        { className: 'mv-modal', onPointerDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'mv-dialog mv-health', role: 'dialog', 'aria-modal': true },
          h(
            'header',
            null,
            h('b', null, state?.layer ? `${t('health.title')} · ${state.layer}` : t('health.title')),
            h('button', { type: 'button', className: 'mv-icon-btn', onClick: onClose, title: t('btn.close') }, '✕'),
          ),
          h('div', { className: 'body' }, body),
        ),
      )
    }
    //#endregion data health dialog

    //#region local path authorisation -----------------------------------------

    /**
     * Modal shown by the internal `authorize` bridge command before the Host may
     * read a local folder. It only presents the request and wires its buttons:
     * the actual `/scan` registration runs in the surface handler, so the bridge
     * ack is sent only after that request succeeded.
     */
    function PathAccessDialog({ request, busy, t, onAllow, onDeny }) {
      const denyRef = React.useRef(null)
      React.useEffect(() => {
        denyRef.current?.focus?.()
      }, [])
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          onDeny()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onDeny])
      const action =
        request.request === 'load'
          ? t('access.request.load')
          : request.request === 'inspect'
            ? t('access.request.inspect')
            : t('access.request.generic')
      const row = (key, value) =>
        value
          ? h('div', { key, className: 'row' }, h('span', { className: 'key' }, t(key)), h('code', { title: value }, value))
          : null
      return h(
        'div',
        { className: 'mv-modal', onPointerDown: (event) => event.target === event.currentTarget && !busy && onDeny() },
        h(
          'div',
          { className: 'mv-dialog mv-access', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'mv-access-title' },
          h(
            'header',
            null,
            h('b', { id: 'mv-access-title' }, `${t('access.title')} · ${action}`),
            h('button', { type: 'button', className: 'mv-icon-btn', onClick: onDeny, disabled: busy, title: t('btn.close') }, '✕'),
          ),
          h(
            'div',
            { className: 'body' },
            h('p', { className: 'mv-note' }, t('access.body')),
            h(
              'div',
              { className: 'mv-access-path' },
              row('access.path', request.path),
              row('access.dir', request.directory),
              request.resolved ? row('access.target', request.target) : null,
            ),
            request.kind === 'missing' ? h('p', { className: 'mv-note' }, t('access.missing')) : null,
            request.resolved ? h('p', { className: 'mv-note' }, t('access.resolved')) : null,
          ),
          h(
            'div',
            { className: 'footer' },
            h(
              'div',
              { className: 'right' },
              h('button', { ref: denyRef, type: 'button', className: 'mv-cta', onClick: onDeny, disabled: busy }, t('access.cancel')),
              h(
                'button',
                { type: 'button', className: 'mv-cta primary', onClick: onAllow, disabled: busy },
                busy ? t('access.allowing') : t('access.allow'),
              ),
            ),
          ),
        ),
      )
    }
    //#endregion local path authorisation

    /** Immersive `main` panel: no Session, so the Agent bridge stays off. */
    function ViewerPanel(props) {
      return h(ViewerSurface, { t: props.t, sessionId: null, docked: false })
    }

    /** Session-scoped right sidebar body: the chat stays visible beside it. */
    function EarthTabBody(props) {
      const info = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null
      const sessionId = props.sessionId ?? info?.tab?.sessionId ?? info?.sessionId ?? null
      return h(ViewerSurface, { t: props.t, sessionId, docked: true })
    }

    /**
     * The globe surface itself. It is mounted twice: once as the immersive
     * `main` panel (no session) and once inside the session-scoped right
     * sidebar tab, where `sessionId` enables the Agent bridge.
     */
    function ViewerSurface({ t: injectedT, sessionId = null, docked = false }) {
      const fallbackT = useTranslation()
      const t = typeof injectedT === 'function' ? injectedT : fallbackT
      const environmentDark = useEnvironmentDark()
      const rootRef = React.useRef(null)
      const globeRef = React.useRef(null)
      const creditRef = React.useRef(null)
      const menuRef = React.useRef(null)
      const viewerRef = React.useRef(null)
      const cesiumRef = React.useRef(null)
      const metaRef = React.useRef(null)
      const layersRef = React.useRef([])
      const toolRef = React.useRef(null)
      const measureRef = React.useRef({ points: [], entities: [] })
      const handlerRef = React.useRef(null)
      const imageryRef = React.useRef(null)
      const sourcesRef = React.useRef(null)
      const toastTimer = React.useRef(0)
      const captureReadoutRef = React.useRef(null)
      const commandChainRef = React.useRef(Promise.resolve())
      const commandRef = React.useRef(null)
      const accessRef = React.useRef(null)
      // Resolves when the Cesium viewer is fully ready. The bridge connects before
      // that (right after meta arrives) so a cold panel mount does not eat the
      // Host's attach grace; commands wait on this gate instead.
      const readyGateRef = React.useRef({ ready: false, error: null, waiters: [] })
      const healthSeqRef = React.useRef(0)
      const sessionRef = React.useRef(sessionId)
      sessionRef.current = sessionId

      const [phase, setPhase] = React.useState('loading')
      const [error, setError] = React.useState('')
      const [layers, setLayers] = React.useState([])
      const [sources, setSources] = React.useState(null)
      const [defaults, setDefaults] = React.useState(null)
      const [tool, setTool] = React.useState(null)
      const [fps, setFps] = React.useState(0)
      const [stats, setStats] = React.useState(null)
      const [pickInfo, setPickInfo] = React.useState(null)
      const [measureInfo, setMeasureInfo] = React.useState(null)
      const [scan, setScan] = React.useState(null)
      // The empty-state card is onboarding, not chrome: dismissing it keeps the
      // globe free for custom instructions until this panel is remounted.
      const [emptyDismissed, setEmptyDismissed] = React.useState(false)
      const [restoringScene, setRestoringScene] = React.useState(false)
      const [urlBar, setUrlBar] = React.useState(false)
      const [urlInput, setUrlInput] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [toast, setToast] = React.useState('')
      const [openMenu, setOpenMenu] = React.useState(null)
      const [recentDirs, setRecentDirs] = React.useState([])
      const [accessRequest, setAccessRequest] = React.useState(null)
      const [accessBusy, setAccessBusy] = React.useState(false)
      const [settingsOpen, setSettingsOpen] = React.useState(false)
      const [health, setHealth] = React.useState(null)
      const [terrainBusy, setTerrainBusy] = React.useState(false)
      const [imageryBusy, setImageryBusy] = React.useState(false)
      const [meta, setMeta] = React.useState(null)
      const [bridgeOn, setBridgeOn] = React.useState(false)
      const [bridgeReload, setBridgeReload] = React.useState(false)
      const [bridgeEpoch, setBridgeEpoch] = React.useState(0)

      const themeMode = sources?.settings?.theme ?? 'auto'
      const resolvedDark = themeMode === 'auto' ? environmentDark : themeMode === 'dark'
      // Chrome visibility is persisted through `settings`: an older Host config may
      // not have written these keys yet, so a missing value means "visible".
      const showLayers = sources?.settings?.showLayers !== false
      const showHud = sources?.settings?.showHud !== false
      const activeImageryId = sources?.settings?.imagery ?? null
      const activeTerrainId = sources?.settings?.terrain ?? null
      const activeImagery = sources?.imagery?.find((source) => source.id === activeImageryId) ?? null

      const showToast = (text) => {
        setToast(text)
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(''), 6000)
      }

      /** Wake every command waiting for the viewer: resolve when ready, reject on failure. */
      const settleReadyWaiters = (error) => {
        const gate = readyGateRef.current
        if (error === undefined) {
          gate.ready = true
          gate.error = null
        } else {
          gate.error = error
        }
        const waiters = gate.waiters.splice(0)
        for (const waiter of waiters) {
          if (error === undefined) waiter.resolve()
          else waiter.reject(error)
        }
      }

      /**
       * Wait for the viewer before executing a bridge command. The Host starts its
       * command deadline when it sends the frame, so this wait is bounded by the
       * Host timeout too; the local timeout only keeps a dead panel from stalling
       * the command chain forever.
       */
      const waitForPanelReady = (timeoutMs = 30000) =>
        new Promise((resolve, reject) => {
          const gate = readyGateRef.current
          if (gate.ready) {
            resolve()
            return
          }
          // A failed panel init never becomes ready: fail fast instead of leaving
          // the Agent waiting for the local timeout.
          if (gate.error !== null) {
            reject(gate.error)
            return
          }
          const waiter = { resolve: null, reject: null }
          const timer = setTimeout(() => {
            const index = gate.waiters.indexOf(waiter)
            if (index >= 0) gate.waiters.splice(index, 1)
            reject(new Error(t('agent.notReady')))
          }, timeoutMs)
          waiter.resolve = () => {
            clearTimeout(timer)
            resolve()
          }
          waiter.reject = (error) => {
            clearTimeout(timer)
            reject(error)
          }
          gate.waiters.push(waiter)
        })

      const syncLayers = () => {
        setLayers(layersRef.current.map((layer) => ({ id: layer.id, name: layer.name, visible: layer.visible })))
        markSceneDirty()
      }

      // Persist writes run one at a time and stale responses are dropped, so two
      // quick Agent commands (basemap then terrain) cannot roll each other back.
      const saveChainRef = React.useRef(Promise.resolve())
      const saveSeqRef = React.useRef(0)
      const commitSources = (next, notify) => {
        const previous = sourcesRef.current
        sourcesRef.current = next
        setSources(next)
        const meta = metaRef.current
        if (!meta) return
        const seq = (saveSeqRef.current += 1)
        saveChainRef.current = saveChainRef.current.then(() =>
          persistSources(meta, next)
            .then((saved) => {
              if (!saved || seq !== saveSeqRef.current) return
              sourcesRef.current = saved
              setSources(saved)
              if (notify) showToast(t('toast.sourcesSaved'))
            })
            .catch((error) => {
              if (seq !== saveSeqRef.current) return
              sourcesRef.current = previous
              setSources(previous)
              showToast(t('toast.saveFailed', { message: message(error) }))
            }),
        )
      }

      const updateSettings = (patch, notify) => {
        const current = sourcesRef.current
        if (!current) return
        commitSources({ ...current, settings: { ...current.settings, ...patch } }, notify)
      }

      /**
       * Map the frozen Host `authorize` args onto what the dialog renders. The Host
       * resolves the target before asking, so `directory` and `target` are normally
       * present; the fallbacks keep older/partial payloads working.
       */
      const normalizeAccessRequest = (args = {}) => {
        const rawPath = typeof args.path === 'string' ? args.path.trim() : ''
        const rawTarget = typeof args.target === 'string' ? args.target.trim() : ''
        const target = rawTarget || rawPath
        const explicitDir = typeof args.directory === 'string' ? args.directory.trim() : ''
        const normalized = target.replace(/\\/g, '/')
        const index = normalized.lastIndexOf('/')
        return {
          request: typeof args.request === 'string' ? args.request : 'load',
          path: rawPath,
          target,
          directory: explicitDir || (index > 0 ? target.slice(0, index) : ''),
          kind: typeof args.kind === 'string' ? args.kind : 'file',
          resolved: args.resolved === true || (rawTarget !== '' && rawTarget !== rawPath),
        }
      }

      /**
       * Settle the open authorisation dialog exactly once. A late settle (e.g. the
       * cleanup timer firing after the Host already timed out) is ignored.
       */
      const settleAccess = (outcome) => {
        const current = accessRef.current
        if (!current) return
        accessRef.current = null
        clearTimeout(current.timer)
        setAccessRequest(null)
        setAccessBusy(false)
        current.resolve(outcome)
      }

      /**
       * Open the dialog and wait for the user. The 32 s cleanup timer unblocks this
       * panel's serialised command chain after the Host's own 30 s deadline; the
       * late ack is ignored by the Host and never retried.
       */
      const askPathAccess = (request) =>
        new Promise((resolve) => {
          if (accessRef.current) settleAccess({ allowed: false, message: t('access.denied') })
          const timer = setTimeout(() => settleAccess({ allowed: false, message: t('access.denied') }), ACCESS_TIMEOUT_MS)
          accessRef.current = { resolve, timer }
          setAccessBusy(false)
          setAccessRequest(request)
        })

      /** Allow: register the folder via /scan first; only then does the bridge ack. */
      const allowPathAccess = async () => {
        const request = accessRequest
        if (!request || accessBusy || !accessRef.current) return
        setAccessBusy(true)
        try {
          await scanLocalDirectory(metaRef.current, request.directory)
          settleAccess({ allowed: true, directory: request.directory })
        } catch (error) {
          const detail = message(error)
          settleAccess({ allowed: false, message: t('access.scanFailed', { message: detail }) })
          showToast(t('access.scanFailed', { message: detail }))
        }
      }

      const pickSurface = (position) => {
        const viewer = viewerRef.current
        if (!viewer) return null
        if (viewer.scene.pickPositionSupported) {
          try {
            const picked = viewer.scene.pickPosition(position)
            if (picked) return picked
          } catch {
            /* fall through to the globe ray pick */
          }
        }
        const ray = viewer.camera.getPickRay(position)
        return ray ? viewer.scene.globe.pick(ray, viewer.scene) ?? null : null
      }

      const proxyUrlFor = (url) => {
        const meta = metaRef.current
        const parsed = new URL(url)
        const path = parsed.pathname
          .replace(/^\//, '')
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/')
        // Signed tile URLs (and some WMS endpoints) carry their credentials in
        // the query string; the proxy must forward it untouched.
        return `${meta.remoteBase}${b64url(parsed.origin)}/${path}${parsed.search}`
      }

      const localPathToUrl = async (filePath) => {
        const meta = metaRef.current
        const normalized = filePath.replace(/\\/g, '/')
        const index = normalized.lastIndexOf('/')
        if (index <= 0) throw new Error(t('toast.invalidPath'))
        const dir = normalized.slice(0, index)
        const rel = normalized.slice(index + 1)
        // The host only serves tile files from directories registered through /scan;
        // the Agent path was validated and authorised by the Host bridge beforehand,
        // so this call normally confirms an already-registered folder.
        await scanLocalDirectory(meta, dir)
        return `${meta.tilesBase}${encodeURIComponent(b64url(dir))}/${encodeURIComponent(rel)}`
      }

      /** Add a 3D Tiles layer; flies to it unless the caller restores a saved view. */
      async function loadTileset(url, name, source = null, options = {}) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) throw new Error(t('agent.notReady'))
        const label = name || decodeURIComponent(url.split('/').filter(Boolean).slice(-2).join('/'))
        setBusy(t('toast.loadingData'))
        try {
          let tileset
          try {
            tileset = await Cesium.Cesium3DTileset.fromUrl(url)
          } catch (directError) {
            if (!/^https?:/i.test(url)) throw directError
            tileset = await Cesium.Cesium3DTileset.fromUrl(proxyUrlFor(url))
            showToast(t('toast.proxyFallback'))
          }
          viewer.scene.primitives.add(tileset)
          const layer = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: label,
            url,
            source,
            tileset,
            visible: true,
          }
          layersRef.current.push(layer)
          syncLayers()
          setScan(null)
          if (options.fly !== false) await viewer.flyTo(tileset, { duration: 1.2 })
          return layer
        } finally {
          setBusy('')
        }
      }

      /** Join a folder and a relative tileset path for the Host allowlist check. */
      function joinLocalPath(dir, rel) {
        return `${String(dir).replace(/[\\/]+$/, '')}/${String(rel).replace(/\\/g, '/')}`
      }

      async function addTileset(url, name, source = null) {
        try {
          await loadTileset(url, name, source)
        } catch (error) {
          showToast(t('toast.loadFailed', { message: message(error) }))
        }
      }

      /**
       * Load the folders the Host remembers from earlier `/scan` calls (newest
       * first). Older Hosts do not send `directoriesUrl`: hide the section then
       * rather than failing a menu that otherwise works.
       */
      const refreshRecentDirs = async () => {
        const url = metaRef.current?.directoriesUrl
        if (typeof url !== 'string' || url === '') return
        try {
          const response = await fetch(url, { credentials: 'same-origin' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          const list = Array.isArray(data?.directories) ? data.directories : []
          const entries = []
          for (const entry of list) {
            const dir = typeof entry === 'string' ? entry : entry?.path
            if (typeof dir !== 'string' || dir === '') continue
            entries.push({ dir, name: typeof entry?.name === 'string' && entry.name !== '' ? entry.name : folderName(dir) })
            if (entries.length >= 5) break
          }
          setRecentDirs(entries)
        } catch (error) {
          // A stale endpoint must not break the data menu; surface it like a scan error.
          setRecentDirs([])
          showToast(t('toast.scanFailed', { message: message(error) }))
        }
      }

      /** Re-open a remembered folder exactly like the picker would. */
      async function openRecentDirectory(dir) {
        setOpenMenu(null)
        setBusy(t('toast.busyDirectory'))
        try {
          const meta = metaRef.current
          const response = await fetch(
            `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(dir)}`,
            { credentials: 'same-origin', headers: { 'x-dsh-panel': '1' } },
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          refreshRecentDirs()
          if (!data.items || data.items.length === 0) {
            showToast(t('toast.scanEmpty'))
            return
          }
          setScan({ dir, items: data.items })
        } catch (error) {
          showToast(t('toast.scanFailed', { message: message(error) }))
        } finally {
          setBusy('')
        }
      }

      async function pickLocal() {
        setOpenMenu(null)
        const workspace = service('uiWorkspace')
        if (!workspace) {
          showToast(t('toast.dialogUnavailable'))
          return
        }
        setBusy(t('toast.busyDirectory'))
        try {
          const dir = await workspace.pickDirectory()
          if (!dir) return
          const meta = metaRef.current
          const response = await fetch(
            `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(dir)}`,
            { credentials: 'same-origin', headers: { 'x-dsh-panel': '1' } },
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          // `/scan` records the folder on the Host, so the recent list is stale now.
          refreshRecentDirs()
          if (!data.items || data.items.length === 0) {
            showToast(t('toast.scanEmpty'))
            return
          }
          setScan({ dir, items: data.items })
        } catch (error) {
          showToast(t('toast.scanFailed', { message: message(error) }))
        } finally {
          setBusy('')
        }
      }

      /**
       * Pick a local tile pyramid folder and turn it into a `/tiles` template.
       * Opening the folder through /scan is what whitelists it on the host, so a
       * local XYZ pyramid needs no extra permission plumbing.
       */
      async function pickLocalTiles() {
        const workspace = service('uiWorkspace')
        if (!workspace) {
          showToast(t('toast.dialogUnavailable'))
          return null
        }
        try {
          const dir = await workspace.pickDirectory()
          if (!dir) return null
          const meta = metaRef.current
          const response = await fetch(
            `${meta.scanUrl}?token=${encodeURIComponent(meta.token)}&dir=${encodeURIComponent(dir)}`,
            { credentials: 'same-origin', headers: { 'x-dsh-panel': '1' } },
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const folder = dir.replace(/\\/g, '/').replace(/\/+$/, '')
          return `${meta.tilesBase}${encodeURIComponent(b64url(folder))}/{z}/{x}/{y}.png`
        } catch (error) {
          showToast(t('toast.scanFailed', { message: message(error) }))
          return null
        }
      }

      async function applyImagery(id, notify) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { ok: false, error: t('agent.notReady') }
        const config = sourcesRef.current
        const source = config?.imagery.find((item) => item.id === id) ?? null
        setImageryBusy(true)
        try {
          if (imageryRef.current) {
            viewer.scene.imageryLayers.remove(imageryRef.current, true)
            imageryRef.current = null
          }
          if (source) {
            const provider = await imageryProvider(Cesium, source)
            imageryRef.current = viewer.scene.imageryLayers.addImageryProvider(provider)
            if (notify) showToast(t('toast.basemap', { name: source.name }))
          } else if (notify) {
            showToast(t('toast.basemapNone'))
          }
          return { ok: true, source }
        } catch (error) {
          showToast(t('toast.basemapFailed', { message: message(error) }))
          return { ok: false, error: message(error) }
        } finally {
          setImageryBusy(false)
        }
      }

      async function applyTerrain(id, notify) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { ok: false, error: t('agent.notReady') }
        const config = sourcesRef.current
        const source = config?.terrain.find((item) => item.id === id) ?? null
        setTerrainBusy(true)
        if (notify) setBusy(t('toast.terrainLoading'))
        try {
          if (source) {
            viewer.terrainProvider = await terrainProvider(Cesium, source)
            showToast(t('toast.terrainOn', { name: source.name }))
          } else {
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
            showToast(t('toast.terrainOff'))
          }
          return { ok: true, source }
        } catch (error) {
          viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
          showToast(t('toast.terrainFailed', { message: message(error) }))
          return { ok: false, error: message(error) }
        } finally {
          setTerrainBusy(false)
          if (notify) setBusy('')
        }
      }

      const changeImagery = (id) => {
        updateSettings({ imagery: id })
        applyImagery(id, true)
        setOpenMenu(null)
      }

      const changeTerrain = (id) => {
        updateSettings({ terrain: id })
        applyTerrain(id, true)
        setOpenMenu(null)
      }

      const setTheme = (mode) => {
        updateSettings({ theme: mode })
        setOpenMenu(null)
      }

      /** Close the immersive panel (if any) and open the session globe tab. */
      const openBeside = () => {
        const rightbar = service('sidebarRight')
        if (rightbar && typeof rightbar.openTab === 'function') {
          try {
            service('layout')?.selectPanel?.(null)
            rightbar.openTab('digital-earth')
            return
          } catch {
            // No Session on screen: the column cannot host a tab yet.
            showToast(t('toast.noSession'))
            return
          }
        }
        service('layout')?.selectPanel?.('digital-earth')
      }

      /**
       * Docked tab: expand the sidebar column to fullscreen so the globe gets the
       * room while the Session (and the Agent bridge) stay mounted. Falls back to
       * the immersive main panel when the column cannot report a target.
       */
      const togglePaneFullscreen = () => {
        const rightbar = service('sidebarRight')
        try {
          const target =
            rightbar?.focusedTarget?.(rootRef.current) ?? rightbar?.commandTarget?.(rootRef.current)
          if (target !== undefined) {
            rightbar.toggleFullscreen(target)
            return
          }
        } catch {
          /* fall through to the immersive panel */
        }
        service('layout')?.selectPanel?.('digital-earth')
      }

      const saveSources = (draft) => {
        const current = sourcesRef.current
        const meta = metaRef.current
        if (!meta) return
        const next = { ...draft }
        commitSources(next, true)
        setSettingsOpen(false)
        if (current?.settings?.imagery !== next.settings.imagery) applyImagery(next.settings.imagery, false)
        if (current?.settings?.terrain !== next.settings.terrain) applyTerrain(next.settings.terrain, false)
      }

      function setToolMode(mode) {
        toolRef.current = mode
        setTool(mode)
        clearMeasure()
        if (mode) setPickInfo(null)
        setOpenMenu(null)
      }

      function clearMeasure() {
        const viewer = viewerRef.current
        const state = measureRef.current
        if (viewer) {
          for (const entity of state.entities) viewer.entities.remove(entity)
        }
        state.entities = []
        state.points = []
        setMeasureInfo(null)
      }

      function redrawMeasure(mode) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        const state = measureRef.current
        if (!Cesium || !viewer) return
        for (const entity of state.entities) viewer.entities.remove(entity)
        state.entities = []
        const points = state.points
        const add = (options) => {
          const entity = viewer.entities.add(options)
          state.entities.push(entity)
          return entity
        }
        const accent = Cesium.Color.fromCssColorString('#5b8cff')
        const label = (position, text) =>
          add({
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
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
        for (const position of points) {
          add({
            position,
            point: {
              pixelSize: 6,
              color: accent,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
        }
        if (mode === 'distance' && points.length >= 2) {
          add({ polyline: { positions: points, width: 2, material: accent, depthFailMaterial: accent } })
          const total = geodesicLength(Cesium, points)
          label(points[points.length - 1], t('measure.total', { value: formatDistance(total) }))
          setMeasureInfo({ text: t('measure.distance', { value: formatDistance(total) }) })
        } else if (mode === 'area' && points.length >= 3) {
          add({
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(points),
              perPositionHeight: true,
              material: accent.withAlpha(0.28),
              outline: true,
              outlineColor: accent,
            },
          })
          const area = planarArea(Cesium, points)
          const center = Cesium.BoundingSphere.fromPoints(points).center
          label(center, t('measure.areaLabel', { value: formatArea(area) }))
          setMeasureInfo({ text: t('measure.area', { value: formatArea(area) }) })
        } else if (mode === 'height' && points.length === 2) {
          add({
            polyline: {
              positions: points,
              width: 2,
              material: Cesium.Color.fromCssColorString('#f0b84b'),
              depthFailMaterial: Cesium.Color.fromCssColorString('#f0b84b'),
            },
          })
          const left = Cesium.Cartographic.fromCartesian(points[0])
          const right = Cesium.Cartographic.fromCartesian(points[1])
          const delta = right.height - left.height
          const horizontal = new Cesium.EllipsoidGeodesic(left, right).surfaceDistance
          const text = t('measure.height', {
            value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m`,
            distance: formatDistance(horizontal),
          })
          label(points[1], text)
          setMeasureInfo({ text })
        } else {
          setMeasureInfo({ text: t('measure.start') })
        }
      }

      //#region Agent overlays (annotations + measurements) ---------------------
      // Overlays the Agent asked for live in their own entity lists: they do not
      // mix with the user's measuring tool, can be cleared as one group from the
      // Data menu, and status reports how much of them is currently drawn.
      const agentOverlayRef = React.useRef({
        draw: [],
        measure: [],
        drawnFeatures: 0,
        measuredCount: 0,
        // The commands themselves are kept so a remounted panel can redraw them.
        drawCommands: [],
        measureCommands: [],
      })
      const [agentOverlayCount, setAgentOverlayCount] = React.useState(0)

      const syncAgentOverlayCount = () => {
        const state = agentOverlayRef.current
        setAgentOverlayCount(state.draw.length + state.measure.length)
      }

      function clearAgentOverlays(kind = 'all') {
        const viewer = viewerRef.current
        const state = agentOverlayRef.current
        const drop = (entities) => {
          if (viewer) for (const entity of entities) viewer.entities.remove(entity)
        }
        if (kind === 'all' || kind === 'draw') {
          drop(state.draw)
          state.draw = []
          state.drawnFeatures = 0
          state.drawCommands = []
        }
        if (kind === 'all' || kind === 'measure') {
          drop(state.measure)
          state.measure = []
          state.measuredCount = 0
          state.measureCommands = []
        }
        syncAgentOverlayCount()
        markSceneDirty()
      }

      const AGENT_OVERLAY_COLORS = {
        accent: '#5b8cff',
        alert: '#e5484d',
        success: '#2ec27e',
        warm: '#f0b84b',
        violet: '#a855f7',
      }

      const agentOverlayColor = (Cesium, style) => {
        const css = AGENT_OVERLAY_COLORS[style] ?? AGENT_OVERLAY_COLORS.accent
        try {
          return Cesium.Color.fromCssColorString(css)
        } catch {
          return Cesium.Color.DODGERBLUE
        }
      }

      /** Surface height at a lon/lat when terrain is loaded, otherwise 0. */
      const agentSurfaceHeight = (Cesium, viewer, lon, lat) => {
        try {
          const height = viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lon, lat))
          if (Number.isFinite(height)) return height
        } catch {
          // No terrain provider: the ellipsoid surface is height 0.
        }
        return 0
      }

      const agentLabelText = (text, value) =>
        typeof text === 'string' && text !== '' ? text : typeof value === 'string' ? value : ''

      /** Add a result label anchored on a ground point. */
      const addAgentGroundLabel = (Cesium, add, lon, lat, text) =>
        add({
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
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })

      /**
       * Draw a host-validated GeoJSON FeatureCollection. Every annotation is
       * ground-draped so it stays visible on terrain and imagery; optional
       * GeoJSON heights are therefore ignored here (measurements keep them).
       */
      function drawAgentOverlay(Cesium, viewer, geojson, style, caption) {
        const state = agentOverlayRef.current
        const color = agentOverlayColor(Cesium, style)
        const byType = { points: 0, lines: 0, polygons: 0 }
        const bbox = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }
        let drawn = 0
        const add = (options) => {
          const entity = viewer.entities.add(options)
          state.draw.push(entity)
          return entity
        }
        const track = (coordinates) => {
          if (Array.isArray(coordinates)) {
            if (typeof coordinates[0] === 'number' && coordinates.length >= 2) {
              const [lon, lat] = coordinates
              if (Number.isFinite(lon) && Number.isFinite(lat)) {
                bbox.west = Math.min(bbox.west, lon)
                bbox.south = Math.min(bbox.south, lat)
                bbox.east = Math.max(bbox.east, lon)
                bbox.north = Math.max(bbox.north, lat)
              }
            } else {
              for (const item of coordinates) track(item)
            }
          }
        }
        const flat2d = (positions) => {
          // Cesium's fromDegreesArray takes lon/lat pairs; optional heights are
          // dropped on purpose here because these primitives are ground-draped.
          const flat = []
          for (const position of positions) {
            if (!Array.isArray(position) || position.length < 2) continue
            flat.push(position[0], position[1])
          }
          return flat
        }
        const nameOf = (properties) => {
          const name = properties?.name
          return typeof name === 'string' && name.trim() !== '' ? name.trim() : ''
        }
        const drawLine = (coordinates, name) => {
          if (!Array.isArray(coordinates) || coordinates.length < 2) return
          add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(flat2d(coordinates)),
              width: 3,
              material: color,
              depthFailMaterial: color.withAlpha(0.55),
              clampToGround: true,
            },
          })
          byType.lines += 1
          drawn += 1
          track(coordinates)
          if (name !== '') {
            const middle = coordinates[Math.floor(coordinates.length / 2)]
            addAgentGroundLabel(Cesium, add, middle[0], middle[1], name)
          }
        }
        const drawPolygon = (rings, name) => {
          if (!Array.isArray(rings) || rings.length === 0 || !Array.isArray(rings[0])) return
          const outer = Cesium.Cartesian3.fromDegreesArray(flat2d(rings[0]))
          if (outer.length < 3) return
          const holes = rings.slice(1).map((ring) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat2d(ring))))
          add({ polygon: { hierarchy: new Cesium.PolygonHierarchy(outer, holes), material: color.withAlpha(0.26), outline: false, perPositionHeight: false } })
          // Ground polygons do not draw an outline reliably, so trace the rings.
          for (const ring of rings) {
            if (!Array.isArray(ring) || ring.length < 2) continue
            const closed = ring.slice()
            const first = closed[0]
            const last = closed[closed.length - 1]
            if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first)
            add({
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(flat2d(closed)),
                width: 2,
                material: color,
                depthFailMaterial: color.withAlpha(0.55),
                clampToGround: true,
              },
            })
          }
          byType.polygons += 1
          drawn += 1
          for (const ring of rings) track(ring)
          if (name !== '') {
            let lon = 0
            let lat = 0
            for (const position of rings[0]) {
              lon += position[0]
              lat += position[1]
            }
            addAgentGroundLabel(Cesium, add, lon / rings[0].length, lat / rings[0].length, name)
          }
        }
        const drawPoint = (coordinates, name) => {
          if (!Array.isArray(coordinates) || coordinates.length < 2) return
          add({
            position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
            point: {
              pixelSize: 11,
              color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
          byType.points += 1
          drawn += 1
          track(coordinates)
          if (name !== '') addAgentGroundLabel(Cesium, add, coordinates[0], coordinates[1], name)
        }
        const drawGeometry = (geometry, properties) => {
          if (geometry === null || typeof geometry !== 'object') return
          const label = agentLabelText(nameOf(properties), caption)
          switch (geometry.type) {
            case 'Point':
              drawPoint(geometry.coordinates, label)
              break
            case 'MultiPoint':
              for (const position of geometry.coordinates ?? []) drawPoint(position, label)
              break
            case 'LineString':
              drawLine(geometry.coordinates, label)
              break
            case 'MultiLineString':
              for (const line of geometry.coordinates ?? []) drawLine(line, label)
              break
            case 'Polygon':
              drawPolygon(geometry.coordinates, label)
              break
            case 'MultiPolygon':
              for (const polygon of geometry.coordinates ?? []) drawPolygon(polygon, label)
              break
            default:
              break
          }
        }
        const features = Array.isArray(geojson?.features) ? geojson.features : []
        for (const feature of features) {
          if (feature?.geometry?.type === 'GeometryCollection') {
            for (const child of feature.geometry.geometries ?? []) {
              drawGeometry(child, feature.properties)
            }
          } else {
            drawGeometry(feature?.geometry, feature?.properties)
          }
        }
        state.drawnFeatures += drawn
        if (drawn > 0) {
          state.drawCommands.push({
            geojson,
            style,
            ...(typeof caption === 'string' && caption !== '' ? { caption } : {}),
          })
          markSceneDirty()
        }
        syncAgentOverlayCount()
        const rounded = (value, digits = 6) => Math.round(value * 10 ** digits) / 10 ** digits
        const hasBox = Number.isFinite(bbox.west) && Number.isFinite(bbox.east)
        return {
          drawn,
          by_type: byType,
          bbox: hasBox
            ? { west: rounded(bbox.west), south: rounded(bbox.south), east: rounded(bbox.east), north: rounded(bbox.north) }
            : null,
        }
      }

      /** Compute and (by default) draw a measurement; returns structured values. */
      function measureAgentOverlay(Cesium, viewer, args) {
        const state = agentOverlayRef.current
        const mode = args.mode
        const points = Array.isArray(args.points) ? args.points : []
        const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits
        if (points.length < 2) throw new Error(t('agent.badMeasure', { message: 'need at least 2 points' }))
        const located = points.map((position) => {
          const lon = position[0]
          const lat = position[1]
          const height = Number.isFinite(position[2]) ? position[2] : agentSurfaceHeight(Cesium, viewer, lon, lat)
          return { lon, lat, height }
        })
        const ground = located.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 0))
        const draw = args.draw !== false
        const color = Cesium.Color.fromCssColorString('#f0b84b')
        const add = (options) => {
          const entity = viewer.entities.add(options)
          state.measure.push(entity)
          return entity
        }
        const dot = (lon, lat, height) =>
          add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
            point: {
              pixelSize: 8,
              color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
        const result = { mode, points: points.length, drawn: draw }
        if (mode === 'distance') {
          const distance = geodesicLength(Cesium, ground)
          result.distance_m = round(distance)
          result.distance_km = round(distance / 1000, 4)
          if (draw) {
            for (const point of located) dot(point.lon, point.lat, point.height)
            add({
              polyline: {
                positions: ground,
                width: 3,
                material: color,
                depthFailMaterial: color.withAlpha(0.55),
                clampToGround: true,
              },
            })
            const last = located[located.length - 1]
            addAgentGroundLabel(Cesium, add, last.lon, last.lat, t('measure.total', { value: formatDistance(distance) }))
          }
        } else if (mode === 'area') {
          if (points.length < 3) throw new Error(t('agent.badMeasure', { message: 'area needs at least 3 points' }))
          const area = planarArea(Cesium, ground)
          const perimeter = geodesicLength(Cesium, [...ground, ground[0]])
          result.area_m2 = round(area)
          result.area_km2 = round(area / 1e6, 6)
          result.perimeter_m = round(perimeter)
          if (draw) {
            add({ polygon: { hierarchy: new Cesium.PolygonHierarchy(ground), material: color.withAlpha(0.28), outline: false, perPositionHeight: false } })
            add({
              polyline: {
                positions: [...ground, ground[0]],
                width: 3,
                material: color,
                depthFailMaterial: color.withAlpha(0.55),
                clampToGround: true,
              },
            })
            let lon = 0
            let lat = 0
            for (const point of located) {
              lon += point.lon
              lat += point.lat
            }
            addAgentGroundLabel(Cesium, add, lon / located.length, lat / located.length, t('measure.areaLabel', { value: formatArea(area) }))
          }
        } else if (mode === 'height') {
          if (points.length !== 2) throw new Error(t('agent.badMeasure', { message: 'height needs exactly 2 points' }))
          const from = located[0]
          const to = located[1]
          const delta = to.height - from.height
          const horizontal = new Cesium.EllipsoidGeodesic(
            Cesium.Cartographic.fromDegrees(from.lon, from.lat, from.height),
            Cesium.Cartographic.fromDegrees(to.lon, to.lat, to.height),
          ).surfaceDistance
          const slope = horizontal > 0 ? (Math.atan2(delta, horizontal) * 180) / Math.PI : 0
          result.height_m = round(delta)
          result.height_from_m = round(from.height)
          result.height_to_m = round(to.height)
          result.horizontal_m = round(horizontal)
          result.slope_deg = round(slope, 2)
          if (draw) {
            for (const point of located) dot(point.lon, point.lat, point.height)
            add({
              polyline: {
                positions: located.map((point) => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height)),
                width: 3,
                material: color,
                depthFailMaterial: color.withAlpha(0.55),
              },
            })
            addAgentGroundLabel(Cesium, add, to.lon, to.lat, `${t('measure.height', { value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m`, distance: formatDistance(horizontal) })}`)
          }
        } else {
          throw new Error(t('agent.badMeasure', { message: `unsupported mode ${String(mode)}` }))
        }
        // `measured_points` counts what is currently drawn, matching the entity
        // count in `overlays`; a numeric-only measurement adds no overlay.
        if (draw) {
          state.measuredCount += points.length
          state.measureCommands.push({ mode, points, draw: true })
          markSceneDirty()
        }
        syncAgentOverlayCount()
        return result
      }
      //#endregion Agent overlays

      //#region scene snapshot ---------------------------------------------------
      // Camera, layers (by their original source) and Agent overlays survive the
      // tab body being disposed: they are written to localStorage per session and
      // rebuilt into the next viewer. Writes are debounced through a dirty flag
      // plus a short timer, and flushed synchronously on unmount/page hide.
      const sceneDirtyRef = React.useRef(false)
      // Whether a restore decision was already made for this mount; a session id
      // that arrives after the viewer is ready gets exactly one late restore.
      const sceneRestoredRef = React.useRef(false)

      const markSceneDirty = () => {
        sceneDirtyRef.current = true
      }

      /** Everything needed to rebuild this panel's scene in a later mount. */
      const currentSceneSnapshot = () => {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return null
        const carto = viewer.camera.positionCartographic
        const round = (value) => Math.round(value * 1e6) / 1e6
        return {
          view: {
            lon: round(Cesium.Math.toDegrees(carto.longitude)),
            lat: round(Cesium.Math.toDegrees(carto.latitude)),
            height: Math.round(carto.height),
            heading: Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0)),
            pitch: Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0)),
          },
          layers: layersRef.current
            .filter(
              (layer) =>
                layer.source !== null &&
                typeof layer.source === 'object' &&
                (typeof layer.source.path === 'string' || typeof layer.source.url === 'string'),
            )
            .map((layer) => ({ name: layer.name, source: layer.source, visible: layer.visible !== false })),
          annotations: {
            draw: agentOverlayRef.current.drawCommands,
            measure: agentOverlayRef.current.measureCommands,
          },
        }
      }

      /** Persist the current scene for this session (best effort, never throws). */
      const saveSceneSnapshot = () => {
        const session = sessionRef.current
        if (typeof session !== 'string' || session === '') return
        try {
          const snapshot = currentSceneSnapshot()
          if (snapshot === null) return
          writeSceneSnapshot(session, snapshot)
          sceneDirtyRef.current = false
        } catch {
          // Persistence must never take the panel down.
        }
      }

      /** Rebuild a saved scene into the freshly created viewer. Best effort per item. */
      async function restoreSceneSnapshot(snapshot) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer || snapshot === null) return
        setRestoringScene(snapshot.layers.length > 0)
        try {
          for (const item of snapshot.layers) {
            const source = item.source
            let url = ''
            if (typeof source.path === 'string' && source.path !== '') {
              try {
                url = await localPathToUrl(source.path)
              } catch {
                // The folder may not be authorised any more: skip that layer.
                continue
              }
            } else if (typeof source.url === 'string' && /^https?:\/\//i.test(source.url)) {
              url = source.url
            }
            if (url === '') continue
            try {
              const layer = await loadTileset(url, item.name, source, { fly: false })
              if (item.visible === false) setLayerVisible(layer.id, false)
            } catch {
              // One missing or moved source must not abort the other layers.
            }
          }
          for (const command of snapshot.annotations.draw) {
            try {
              drawAgentOverlay(Cesium, viewer, command.geojson, command.style, command.caption)
            } catch {
              // A stale annotation is not worth failing the restore.
            }
          }
          for (const command of snapshot.annotations.measure) {
            try {
              measureAgentOverlay(Cesium, viewer, command)
            } catch {
              // Same for a stale measurement.
            }
          }
          if (snapshot.view !== null) {
            viewer.camera.setView({
              destination: Cesium.Cartesian3.fromDegrees(snapshot.view.lon, snapshot.view.lat, snapshot.view.height),
              orientation: {
                heading: Cesium.Math.toRadians(snapshot.view.heading),
                pitch: Cesium.Math.toRadians(snapshot.view.pitch),
                roll: 0,
              },
            })
          }
        } finally {
          setRestoringScene(false)
          sceneDirtyRef.current = false
        }
      }
      //#endregion scene snapshot

      function layerLabel(tileset) {
        const found = layersRef.current.find((entry) => entry.tileset === tileset)
        return found ? found.name : t('model.unnamed')
      }

      /** Readable description of the object under a screen position. */
      function pickResult(position) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return { picked: false, type: 'none', properties: [] }
        const picked = viewer.scene.pick(position)
        if (!Cesium.defined(picked)) return { picked: false, type: 'none', properties: [] }
        if (picked instanceof Cesium.Cesium3DTileFeature) {
          const properties = []
          for (const id of picked.getPropertyIds()) {
            if (properties.length >= 40) break
            properties.push({ name: id, value: formatValue(picked.getProperty(id)) })
          }
          return {
            picked: true,
            type: 'tile-feature',
            layer: layerLabel(picked.primitive ?? picked.tileset),
            properties,
          }
        }
        const primitive = picked?.primitive ?? picked
        if (primitive instanceof Cesium.Cesium3DTileset) {
          return { picked: true, type: 'tileset', layer: layerLabel(primitive), properties: [] }
        }
        if (picked?.id instanceof Cesium.Entity) {
          return { picked: true, type: 'entity', name: String(picked.id.name ?? picked.id.id), properties: [] }
        }
        return { picked: true, type: 'scene', properties: [] }
      }

      function pickAt(position) {
        const result = pickResult(position)
        if (!result.picked) {
          setPickInfo({ title: t('toast.pickNone'), rows: [] })
          return
        }
        if (result.type === 'tile-feature') {
          const rows = result.properties.map((entry) => [entry.name, entry.value])
          if (rows.length === 0) rows.push([t('pick.noProperties'), t('pick.noPropertiesValue')])
          setPickInfo({ title: result.layer, rows })
          return
        }
        if (result.type === 'tileset') {
          setPickInfo({
            title: t('pick.title'),
            rows: [
              [t('pick.type'), t('pick.tiles')],
              [t('pick.layer'), result.layer],
            ],
          })
          return
        }
        if (result.type === 'entity') {
          setPickInfo({
            title: t('pick.title'),
            rows: [
              [t('pick.type'), t('pick.entity')],
              [t('pick.name'), result.name],
            ],
          })
          return
        }
        setPickInfo({ title: t('pick.title'), rows: [[t('pick.type'), t('pick.scene')]] })
      }

      function onCanvasClick(position) {
        const mode = toolRef.current
        if (mode === null) return
        if (mode === 'pick') {
          pickAt(position)
          return
        }
        const surface = pickSurface(position)
        if (!surface) {
          showToast(t('toast.noSurface'))
          return
        }
        measureRef.current.points.push(surface)
        if (mode === 'height' && measureRef.current.points.length > 2) {
          measureRef.current.points.splice(0, measureRef.current.points.length - 2)
        }
        redrawMeasure(mode)
      }

      function finishMeasure() {
        if (toolRef.current === 'distance' || toolRef.current === 'area') {
          toolRef.current = null
          setTool(null)
        }
      }

      function resetView() {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(104, 31, 14000000),
          duration: 1.2,
        })
      }

      /** Hide the panel chrome while a clean snapshot is rendered. */
      const setChromeHidden = (hidden) => {
        const root = rootRef.current
        if (root) root.classList.toggle('mv-capturing', hidden)
      }

      const roundedRectPath = (context, x, y, width, height, radius) => {
        const r = Math.max(0, Math.min(radius, width / 2, height / 2))
        context.beginPath()
        context.moveTo(x + r, y)
        context.lineTo(x + width - r, y)
        context.arcTo(x + width, y, x + width, y + r, r)
        context.lineTo(x + width, y + height - r)
        context.arcTo(x + width, y + height, x + width - r, y + height, r)
        context.lineTo(x + r, y + height)
        context.arcTo(x, y + height, x, y + height - r, r)
        context.lineTo(x, y + r)
        context.arcTo(x, y, x + r, y, r)
        context.closePath()
      }

      /**
       * Draw the coordinate HUD and the team credit into the snapshot itself.
       * The panel chrome is a DOM overlay and can never be rasterised with the
       * WebGL canvas, so this is what "include HUD" means in an image.
       */
      const drawCaptureOverlay = (context, width, height) => {
        const viewer = viewerRef.current
        const Cesium = cesiumRef.current
        if (!viewer || !Cesium) return
        const font = Math.max(11, Math.min(24, Math.round(width * 0.0155)))
        const padding = Math.max(10, Math.round(font * 0.75))
        const lineGap = Math.round(font * 1.6)
        const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
        const lon = cartographic ? Cesium.Math.toDegrees(cartographic.longitude).toFixed(4) : '—'
        const lat = cartographic ? Cesium.Math.toDegrees(cartographic.latitude).toFixed(4) : '—'
        const cameraHeight = cartographic ? Math.round(cartographic.height) : 0
        const heading = Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0))
        const pitch = Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0))
        const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} }
        const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null
        const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null
        const lastReadout = captureReadoutRef.current
        let pointerText = lastReadout || ''
        if (!pointerText) {
          const center = new Cesium.Cartesian2(
            Math.round(viewer.canvas.clientWidth / 2),
            Math.round(viewer.canvas.clientHeight / 2),
          )
          const carto = sampleCursor(viewer, Cesium, center, { pickPosition: true })
          if (carto) pointerText = formatCursor(Cesium, carto)
        }
        const visibleCount = layersRef.current.filter((layer) => layer.visible).length
        const lines = [
          `${lastReadout ? t('hud.pointer') : t('hud.center')}  ${pointerText || t('hud.empty')}`,
          `${t('hud.camera')} ${cameraHeight} m · ${t('hud.heading')} ${heading}° · ${pitch}°`,
          `${t('hud.layers')} ${visibleCount}/${layersRef.current.length} · ${imagery?.name ?? '—'} · ${terrain?.name ?? '—'}`,
          `${t('hud.cameraPos')} ${lon}, ${lat}`,
        ]
        const family = '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
        context.save()
        context.font = `${font}px ${family}`
        context.textBaseline = 'top'
        context.textAlign = 'left'
        const textWidth = Math.max(...lines.map((line) => context.measureText(line).width))
        const boxWidth = Math.min(width - padding * 2, textWidth + padding * 2)
        const boxHeight = lines.length * lineGap + padding * 2
        const boxX = padding
        const boxY = height - boxHeight - padding
        context.fillStyle = 'rgba(8, 12, 18, 0.6)'
        roundedRectPath(context, boxX, boxY, boxWidth, boxHeight, Math.round(font * 0.65))
        context.fill()
        lines.forEach((line, index) => {
          context.fillStyle = index === 0 ? '#eef4ff' : '#c5d2e2'
          context.fillText(line, boxX + padding, boxY + padding + index * lineGap)
        })
        const title = t('panel.title')
        const aboutMeta = metaRef.current
        const teamName = aboutMeta?.team?.name ?? t('about.teamName')
        let teamHost = 'www.whu-cveo.com'
        try {
          teamHost = new URL(aboutMeta?.team?.url ?? FALLBACK_ABOUT.teamUrl).host || teamHost
        } catch {
          /* keep the static fallback */
        }
        context.font = `600 ${font}px ${family}`
        context.fillStyle = 'rgba(240, 246, 255, 0.9)'
        context.shadowColor = 'rgba(0, 0, 0, 0.45)'
        context.shadowBlur = Math.round(font * 0.6)
        context.fillText(title, padding, padding)
        const credit = `${teamName} · ${teamHost}`
        context.textAlign = 'right'
        context.font = `${Math.max(10, Math.round(font * 0.85))}px ${family}`
        context.fillStyle = 'rgba(238, 244, 255, 0.85)'
        context.fillText(credit, width - padding, height - padding - font)
        context.restore()
      }

      /** Wait for the next painted frame, but never hang on a hidden tab. */
      const nextFrames = (count) =>
        new Promise((resolve) => {
          let left = count
          const step = () => {
            left -= 1
            if (left <= 0) resolve()
            else requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        })

      const MAX_CAPTURE_DATAURL = 7_500_000

      /** Render the canvas at the requested width and return a data URL. */
      async function renderSnapshot(options = {}) {
        const viewer = viewerRef.current
        if (!viewer) throw new Error(t('agent.noViewer'))
        const root = rootRef.current
        const hidden =
          !root ||
          root.offsetWidth < 32 ||
          root.offsetHeight < 32 ||
          (typeof document !== 'undefined' && document.visibilityState === 'hidden')
        if (hidden) throw new Error(t('agent.hiddenPanel'))
        const width = Math.round(Math.min(Math.max(Number(options.width) || 1280, 480), 2560))
        const format = options.format === 'png' ? 'png' : 'jpeg'
        const settings = sourcesRef.current?.settings ?? {}
        const includeHud = typeof options.include_hud === 'boolean' ? options.include_hud : settings.screenshotHud === true
        if (!includeHud) setChromeHidden(true)
        try {
          // Let CSS hide the chrome before the next frame is drawn, with a bound
          // so a backgrounded tab fails clearly instead of timing out later.
          await Promise.race([
            nextFrames(2),
            new Promise((_, reject) => setTimeout(() => reject(new Error(t('agent.hiddenPanel'))), 1500)),
          ])
          viewer.resize()
          viewer.render()
          const canvas = viewer.canvas
          const sourceWidth = canvas?.width ?? 0
          const sourceHeight = canvas?.height ?? 0
          if (sourceWidth < 32 || sourceHeight < 32) throw new Error(t('agent.hiddenPanel'))
          let scale = 1
          let quality = 0.9
          let targetWidth = 0
          let targetHeight = 0
          let dataUrl = ''
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const drawWidth = Math.max(320, Math.round(width * scale))
            targetWidth = Math.min(drawWidth, sourceWidth)
            targetHeight = Math.max(1, Math.round((targetWidth * sourceHeight) / sourceWidth))
            const target = document.createElement('canvas')
            target.width = targetWidth
            target.height = targetHeight
            const context = target.getContext('2d')
            context.drawImage(canvas, 0, 0, targetWidth, targetHeight)
            if (includeHud) drawCaptureOverlay(context, targetWidth, targetHeight)
            dataUrl = format === 'png' ? target.toDataURL('image/png') : target.toDataURL('image/jpeg', quality)
            if (dataUrl.length <= MAX_CAPTURE_DATAURL) break
            if (format === 'jpeg') quality = Math.max(0.5, quality - 0.15)
            else scale *= 0.78
          }
          if (dataUrl.length > MAX_CAPTURE_DATAURL) throw new Error(t('agent.captureTooLarge'))
          return { dataUrl, width: targetWidth, height: targetHeight, includeHud, format }
        } finally {
          if (!includeHud) setChromeHidden(false)
        }
      }

      async function screenshot() {
        try {
          const shot = await renderSnapshot({ format: 'png' })
          const link = document.createElement('a')
          link.href = shot.dataUrl
          link.download = `digital-earth-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
          link.click()
          showToast(t('toast.screenshotSaved'))
        } catch (error) {
          showToast(t('toast.screenshotFailed', { message: message(error) }))
        }
      }

      /** Snapshot the scene and hand the file to the Host for the Agent to read. */
      async function captureScene(options = {}, session = null) {
        const meta = metaRef.current
        if (!meta?.captureUrl) throw new Error(t('agent.notReady'))
        const shot = await renderSnapshot(options)
        const response = await fetch(`${meta.captureUrl}?token=${encodeURIComponent(meta.token)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            session: session ?? sessionRef.current ?? '',
            dataUrl: shot.dataUrl,
            width: shot.width,
            height: shot.height,
            hud: shot.includeHud,
            label: typeof options.label === 'string' ? options.label : '',
          }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const saved = await response.json()
        showToast(
          t('toast.captureSaved', {
            width: saved.width,
            height: saved.height,
            path: saved.name ?? saved.path ?? '',
          }),
        )
        return { ...saved, hud: shot.includeHud }
      }

      function setLayerVisible(id, visible) {
        const layer = layersRef.current.find((item) => item.id === id)
        if (!layer) return null
        layer.visible = visible
        layer.tileset.show = visible
        syncLayers()
        return layer
      }

      function toggleLayer(id) {
        const layer = layersRef.current.find((item) => item.id === id)
        if (!layer) return
        setLayerVisible(id, !layer.visible)
      }

      // Only exact ids or exact (case-insensitive) names resolve, so a destructive
      // remove/visibility command can never hit a different layer by substring.
      function findLayer(token) {
        if (typeof token !== 'string' || token.trim() === '') return null
        const value = token.trim()
        const byId = layersRef.current.find((layer) => layer.id === value)
        if (byId) return byId
        const lowered = value.toLowerCase()
        return layersRef.current.find((layer) => layer.name.toLowerCase() === lowered) ?? null
      }

      function flyToLayer(id) {
        const layer = layersRef.current.find((item) => item.id === id)
        const viewer = viewerRef.current
        if (layer && viewer) viewer.flyTo(layer.tileset, { duration: 1.0 })
      }

      function removeLayer(id) {
        const viewer = viewerRef.current
        const index = layersRef.current.findIndex((item) => item.id === id)
        if (index < 0 || !viewer) return null
        const [layer] = layersRef.current.splice(index, 1)
        try {
          viewer.scene.primitives.remove(layer.tileset)
        } catch {
          /* already detached */
        }
        syncLayers()
        return layer
      }

      function collectStats() {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) return null
        const layerRows = layersRef.current.map((layer) => {
          const statistics = layer.tileset.statistics ?? {}
          return {
            id: layer.id,
            name: layer.name,
            tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded,
            pending: statistics.numberOfPendingRequests,
            triangles: statistics.numberOfTrianglesSelected,
            memory: layer.tileset.cacheBytes ?? layer.tileset.totalMemoryUsageInBytes,
          }
        })
        const heading = Cesium.Math.toDegrees(viewer.camera.heading ?? 0)
        const pitch = Cesium.Math.toDegrees(viewer.camera.pitch ?? 0)
        return {
          height: formatHeight(viewer.camera.positionCartographic.height),
          heading: `${heading.toFixed(0)}°`,
          pitch: `${pitch.toFixed(0)}°`,
          layers: layerRows,
        }
      }

      /** The original source behind a layer, for the Host inspector. */
      function sourceOfLayer(layer) {
        if (layer?.source) return layer.source
        if (typeof layer?.url === 'string' && /^https?:\/\//i.test(layer.url)) {
          return { kind: 'remote', url: layer.url }
        }
        return null
      }

      /** Runtime counters merged into the Host report when the panel is online. */
      function layerRuntime(layer) {
        const statistics = layer?.tileset?.statistics ?? {}
        const memory = layer?.tileset?.cacheBytes ?? layer?.tileset?.totalMemoryUsageInBytes
        return {
          tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded ?? 0,
          pending: statistics.numberOfPendingRequests ?? 0,
          triangles: statistics.numberOfTrianglesSelected ?? 0,
          memory: typeof memory === 'number' ? memory : 0,
        }
      }

      /** Run the Host data-health inspector for one loaded layer. */
      async function inspectLayer(layerId) {
        const layer = layersRef.current.find((entry) => entry.id === layerId)
        if (!layer) return
        const source = sourceOfLayer(layer)
        if (!source) {
          showToast(t('health.noSource'))
          return
        }
        const meta = metaRef.current
        if (!meta?.token || (!meta.inspectUrl && !meta.scanUrl)) {
          showToast(t('health.failed', { message: t('agent.notReady') }))
          return
        }
        const endpoint = meta.inspectUrl ?? `${meta.scanUrl.replace(/\/scan$/, '')}/inspect`
        const requestSeq = healthSeqRef.current + 1
        healthSeqRef.current = requestSeq
        setHealth({ loading: true, layer: layer.name, source })
        try {
          const response = await fetch(`${endpoint}?token=${encodeURIComponent(meta.token)}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', 'x-dsh-panel': '1' },
            body: JSON.stringify({ source, deep: false, runtime: layerRuntime(layer) }),
          })
          const data = await response.json().catch(() => null)
          // The dialog may have been closed while the Host was analysing; a
          // late answer must not reopen it or toast behind the user's back.
          if (requestSeq !== healthSeqRef.current) return
          if (!response.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${response.status}`)
          setHealth({ loading: false, layer: layer.name, source, report: data.report, reportPath: data.reportPath })
        } catch (error) {
          if (requestSeq !== healthSeqRef.current) return
          setHealth({ loading: false, layer: layer.name, source, error: message(error) })
          showToast(t('health.failed', { message: message(error) }))
        }
      }

      /** Close the health dialog and invalidate any request still in flight. */
      const closeHealth = () => {
        healthSeqRef.current += 1
        setHealth(null)
      }

      async function submitUrl() {
        const value = urlInput.trim()
        if (!value) return
        let url = value
        if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')) {
          try {
            url = await localPathToUrl(value)
          } catch (error) {
            showToast(message(error))
            return
          }
        } else if (!/^https?:\/\//i.test(value)) {
          showToast(t('toast.invalidUrl'))
          return
        }
        setUrlBar(false)
        setUrlInput('')
        const local = /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')
        const source = local ? { kind: 'local', path: value } : { kind: 'remote', url: value }
        await addTileset(url, value.split(/[\\/]/).filter(Boolean).slice(-2).join('/'), source)
      }

      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const clampNumber = (value, fallback, minimum, maximum) => {
        const number = Number(value)
        if (!Number.isFinite(number)) return fallback
        return Math.min(Math.max(number, minimum), maximum)
      }

      /** Snapshot of what the Agent may ask about: camera, layers, sources. */
      async function collectSceneStatus() {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        if (!Cesium || !viewer) throw new Error(t('agent.notReady'))
        const carto = viewer.camera.positionCartographic
        const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} }
        const imagery = config.imagery.find((item) => item.id === config.settings.imagery) ?? null
        const terrain = config.terrain.find((item) => item.id === config.settings.terrain) ?? null
        const round = (value) => Math.round(value * 1e6) / 1e6
        return {
          ready: true,
          view: {
            lon: round(Cesium.Math.toDegrees(carto.longitude)),
            lat: round(Cesium.Math.toDegrees(carto.latitude)),
            height: Math.round(carto.height),
            heading: Math.round(Cesium.Math.toDegrees(viewer.camera.heading ?? 0)),
            pitch: Math.round(Cesium.Math.toDegrees(viewer.camera.pitch ?? 0)),
          },
          layers: layersRef.current.map((layer) => {
            const statistics = layer.tileset.statistics ?? {}
            return {
              id: layer.id,
              name: layer.name,
              visible: layer.visible,
              url: redactUrl(layer.url),
              tiles: statistics.numberOfTilesWithContentReady ?? statistics.numberOfTilesLoaded ?? 0,
              pending: statistics.numberOfPendingRequests ?? 0,
              triangles: statistics.numberOfTrianglesSelected ?? 0,
            }
          }),
          imagery: imagery ? { id: imagery.id, name: imagery.name } : null,
          terrain: terrain ? { id: terrain.id, name: terrain.name } : null,
          sources: {
            imagery: config.imagery.map((item) => ({ id: item.id, name: item.name })),
            terrain: config.terrain.map((item) => ({ id: item.id, name: item.name })),
          },
          viewport: { width: viewer.canvas.width, height: viewer.canvas.height },
          snapshot: { includeHud: config.settings.screenshotHud === true },
          measureTool: toolRef.current,
          annotations: {
            drawn_features: agentOverlayRef.current.drawnFeatures,
            measured_points: agentOverlayRef.current.measuredCount,
            overlays: agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length,
          },
          busy: busy || '',
        }
      }

      /**
       * The single command dispatcher shared by the Agent bridge and (where it
       * makes sense) the panel UI. Every failure throws a model-readable error.
       */
      async function runCommand(action, args = {}, session = null) {
        const Cesium = cesiumRef.current
        const viewer = viewerRef.current
        const config = sourcesRef.current ?? { imagery: [], terrain: [], settings: {} }
        const layerList = () => layersRef.current.map((layer) => layer.name).join(', ') || '—'
        const requireLayer = () => {
          const token = typeof args.layer === 'string' ? args.layer.trim() : ''
          if (!token) throw new Error(t('agent.missingLayer'))
          const layer = findLayer(token)
          if (!layer) throw new Error(t('agent.unknownLayer', { name: token, list: layerList() }))
          return layer
        }

        // Internal bridge action (not part of the earth_scene tool schema): the Host
        // resolved a local path but the whitelist rejected it, so ask the user in
        // the panel. Allow only after /scan registered the folder; the Host then
        // re-validates and sends the real `load` with the resolved target path.
        if (action === 'authorize') {
          const request = normalizeAccessRequest(args)
          if (!request.directory) throw new Error(`access_denied: ${t('access.badPath')}`)
          const decision = await askPathAccess(request)
          if (!decision.allowed) throw new Error(`access_denied: ${decision.message || t('access.denied')}`)
          return { authorized: true, directory: decision.directory }
        }
        if (action === 'status') return collectSceneStatus()
        if (action === 'capture') {
          const saved = await captureScene(
            {
              width: args.width,
              format: args.format,
              include_hud: args.include_hud,
              label: args.label,
            },
            session,
          )
          return {
            path: saved.path,
            url: redactUrl(saved.url),
            width: saved.width,
            height: saved.height,
            bytes: saved.bytes,
            hud_hidden: saved.hud !== true,
            layers_visible: layersRef.current.filter((layer) => layer.visible).length,
            view: (await collectSceneStatus()).view,
          }
        }
        if (!Cesium || !viewer) throw new Error(t('agent.notReady'))

        if (action === 'inspect') {
          const layer = requireLayer()
          const source = sourceOfLayer(layer)
          if (!source) throw new Error(t('agent.unknownSource', { name: layer.name }))
          // The Host analyses the tileset itself; the panel only resolves the
          // layer to its original source and adds live runtime counters.
          return { layer: layer.name, source, runtime: layerRuntime(layer) }
        }
        if (action === 'list') {
          const status = await collectSceneStatus()
          return { layers: status.layers, sources: status.sources, imagery: status.imagery, terrain: status.terrain }
        }
        if (action === 'load') {
          const rawPath = typeof args.path === 'string' ? args.path.trim() : ''
          let url = typeof args.url === 'string' ? args.url.trim() : ''
          if (!url && rawPath) {
            try {
              url = /^https?:/i.test(rawPath) ? rawPath : await localPathToUrl(rawPath)
            } catch (error) {
              throw new Error(t('agent.dirDenied', { message: message(error) }))
            }
          }
          if (!/^https?:\/\//i.test(url)) throw new Error(t('agent.missingUrl'))
          const label = rawPath
            ? rawPath.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')
            : undefined
          const source = rawPath && !/^https?:\/\//i.test(rawPath)
            ? { kind: 'local', path: rawPath }
            : { kind: 'remote', url: rawPath || url }
          const layer = await loadTileset(url, label, source)
          return {
            loaded: true,
            layer: { id: layer.id, name: layer.name, url: redactUrl(layer.url) },
            view: (await collectSceneStatus()).view,
            layers_count: layersRef.current.length,
          }
        }
        if (action === 'remove') {
          const layer = requireLayer()
          removeLayer(layer.id)
          return { removed: layer.name, layers: layersRef.current.map((item) => item.name) }
        }
        if (action === 'visible') {
          if (typeof args.visible !== 'boolean') throw new Error('Provide visible (true or false).')
          const layer = requireLayer()
          setLayerVisible(layer.id, args.visible)
          return { id: layer.id, name: layer.name, visible: layer.visible }
        }
        if (action === 'basemap') {
          const id = typeof args.imagery === 'string' && args.imagery !== '' ? args.imagery : null
          if (id === null) {
            const outcome = await applyImagery(null, false)
            if (!outcome.ok) throw new Error(outcome.error)
            updateSettings({ imagery: null })
            return { imagery: null }
          }
          const source = config.imagery.find((item) => item.id === id || item.name === id) ?? null
          if (!source) {
            throw new Error(
              t('agent.unknownImagery', {
                name: id,
                list: config.imagery.map((item) => `${item.id} (${item.name})`).join(', ') || '—',
              }),
            )
          }
          const outcome = await applyImagery(source.id, false)
          if (!outcome.ok) throw new Error(outcome.error)
          updateSettings({ imagery: source.id })
          return { imagery: { id: source.id, name: source.name } }
        }
        if (action === 'terrain') {
          const id = typeof args.terrain === 'string' && args.terrain !== '' ? args.terrain : null
          if (id === null) {
            const outcome = await applyTerrain(null, false)
            if (!outcome.ok) throw new Error(outcome.error)
            updateSettings({ terrain: null })
            return { terrain: null }
          }
          const source = config.terrain.find((item) => item.id === id || item.name === id) ?? null
          if (!source) {
            throw new Error(
              t('agent.unknownTerrain', {
                name: id,
                list: config.terrain.map((item) => `${item.id} (${item.name})`).join(', ') || '—',
              }),
            )
          }
          const outcome = await applyTerrain(source.id, false)
          if (!outcome.ok) throw new Error(outcome.error)
          updateSettings({ terrain: source.id })
          return { terrain: { id: source.id, name: source.name } }
        }
        if (action === 'fly') {
          if (typeof args.lon !== 'number' || typeof args.lat !== 'number') throw new Error(t('agent.missingCoords'))
          const height = clampNumber(args.height, 1500, 1, 40000000)
          const heading = clampNumber(args.heading, 0, -360, 360)
          const pitch = clampNumber(args.pitch, -45, -90, 90)
          const duration = clampNumber(args.duration, 1.2, 0, 5)
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(args.lon, args.lat, height),
            orientation: {
              heading: Cesium.Math.toRadians(heading),
              pitch: Cesium.Math.toRadians(pitch),
              roll: 0,
            },
            duration,
          })
          await delay(duration * 1000 + 200)
          return { view: (await collectSceneStatus()).view }
        }
        if (action === 'reset') {
          resetView()
          await delay(1400)
          return { view: (await collectSceneStatus()).view }
        }
        if (action === 'pick') {
          const position = new Cesium.Cartesian2(
            Math.round(viewer.canvas.clientWidth / 2),
            Math.round(viewer.canvas.clientHeight / 2),
          )
          return pickResult(position)
        }
        if (action === 'draw') {
          if (args.clear === true) clearAgentOverlays('all')
          const outcome = args.geojson !== undefined
            ? drawAgentOverlay(Cesium, viewer, args.geojson, args.style, args.label)
            : { drawn: 0, by_type: { points: 0, lines: 0, polygons: 0 }, bbox: null }
          const value = {
            ok: true,
            cleared: args.clear === true,
            drawn: outcome.drawn,
            by_type: outcome.by_type,
            bbox: outcome.bbox,
            overlays: agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length,
          }
          if (typeof args.label === 'string' && args.label !== '') value.label = args.label
          return value
        }
        if (action === 'measure') {
          if (args.clear === true) clearAgentOverlays('all')
          const value = measureAgentOverlay(Cesium, viewer, args)
          value.cleared = args.clear === true
          value.overlays = agentOverlayRef.current.draw.length + agentOverlayRef.current.measure.length
          return value
        }
        throw new Error(t('agent.badAction', { action: String(action) }))
      }
      commandRef.current = runCommand

      // The bridge connects only inside a Session (the right sidebar tab), never in
      // the immersive main panel, so one Agent never drives two globes at once. It
      // connects as soon as the page metadata exists, so the Host's attach grace is
      // spent on the tab mount rather than on the Cesium cold start; commands then
      // wait for the viewer through `waitForPanelReady`.
      React.useEffect(() => {
        if (!sessionId || !meta?.bridgeUrl) return undefined
        // Everything below is bound to the session that opened this connection:
        // a later sidebar session switch must not re-address in-flight acks.
        const bridgeSession = sessionId
        const endpoint = `${meta.bridgeUrl}?token=${encodeURIComponent(meta.token)}&session=${encodeURIComponent(bridgeSession)}`
        let source
        try {
          source = new EventSource(endpoint)
        } catch {
          return undefined
        }
        let retries = 0
        let retryTimer = null
        const ack = async (body) => {
          try {
            await fetch(`${meta.bridgeUrl}?token=${encodeURIComponent(meta.token)}`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            })
          } catch {
            /* the Host times the command out and reports it to the Agent */
          }
        }
        const onHello = () => {
          retries = 0
          setBridgeReload(false)
          setBridgeOn(true)
        }
        const onCommand = (event) => {
          let payload
          try {
            payload = JSON.parse(event.data)
          } catch {
            return
          }
          if (!payload?.id) return
          commandChainRef.current = commandChainRef.current
            .then(async () => {
              try {
                // The authorisation dialog only needs meta + DOM: answer it while
                // Cesium is still booting so the Host's 30 s deadline is not spent
                // waiting for the engine.
                if (payload.action !== 'authorize') await waitForPanelReady()
                const result = await commandRef.current(payload.action, payload.args ?? {}, bridgeSession)
                await ack({ session: bridgeSession, id: payload.id, ok: true, result })
              } catch (error) {
                await ack({ session: bridgeSession, id: payload.id, ok: false, error: message(error) })
              }
            })
            .catch(() => {})
        }
        const onError = () => {
          setBridgeOn(false)
          // A host restart rotates the token; refetch meta and reconnect. A long
          // outage can outlive the EventSource retry, so allow four backoff rounds
          // (500ms → 4s) before asking the user to reload.
          if (retries >= 4 || retryTimer !== null) return
          retries += 1
          retryTimer = setTimeout(async () => {
            retryTimer = null
            try {
              const fresh = await loadMeta(true)
              if (!fresh) return
              const changed = fresh.token !== metaRef.current?.token || fresh.bridgeUrl !== metaRef.current?.bridgeUrl
              metaRef.current = fresh
              setMeta(fresh)
              if (changed) setBridgeEpoch((value) => value + 1)
            } catch {
              /* keep the current connection state; the UI already shows it off */
            }
            // Backoff is exhausted: stop retrying quietly and tell the user how
            // to reconnect instead of leaving a misleading "connecting" state.
            if (retries >= 4) setBridgeReload(true)
          }, Math.min(4000, 500 * 2 ** (retries - 1)))
        }
        source.addEventListener('hello', onHello)
        source.addEventListener('command', onCommand)
        source.addEventListener('error', onError)
        setBridgeOn(false)
        return () => {
          if (retryTimer !== null) clearTimeout(retryTimer)
          source.removeEventListener('hello', onHello)
          source.removeEventListener('command', onCommand)
          source.removeEventListener('error', onError)
          try {
            source.close()
          } catch {
            /* already closed */
          }
        }
      }, [sessionId, meta, bridgeEpoch])

      // A panel that goes away must not leave a pending authorisation promise or
      // its cleanup timer behind: settle it as denied so the command chain ends.
      React.useEffect(
        () => () => {
          const current = accessRef.current
          if (!current) return
          accessRef.current = null
          clearTimeout(current.timer)
          current.resolve({ allowed: false, message: t('access.denied') })
        },
        [],
      )

      React.useEffect(() => {
        let cancelled = false
        ;(async () => {
          try {
            const meta = await loadMeta()
            if (cancelled) return
            metaRef.current = meta
            setMeta(meta)
            const [Cesium, catalog] = await Promise.all([loadCesium(), loadSources(meta)])
            await loadCesiumStyle()
            if (cancelled || !globeRef.current) return
            cesiumRef.current = Cesium
            sourcesRef.current = catalog.config
            setSources(catalog.config)
            setDefaults(catalog.defaults)
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
              contextOptions: { webgl: { preserveDrawingBuffer: true } },
            })
            viewerRef.current = viewer
            viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#060a12')
            viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(104, 31, 14000000) })
            await applyImagery(catalog.config.settings.imagery, false)
            if (catalog.config.settings.terrain) await applyTerrain(catalog.config.settings.terrain, false)
            const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
            handler.setInputAction((event) => onCanvasClick(event.position), Cesium.ScreenSpaceEventType.LEFT_CLICK)
            handler.setInputAction(() => finishMeasure(), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
            handlerRef.current = handler
            // A camera move is the most frequent scene change: mark it dirty and
            // let the short timer batch the localStorage write.
            viewer.camera.moveEnd.addEventListener(markSceneDirty)
            // Rebuild the scene this session had when its tab body was disposed;
            // commands wait for this so they cannot race the restored camera.
            const savedScene = typeof sessionId === 'string' && sessionId !== '' ? readSceneSnapshot(sessionId) : null
            if (savedScene !== null) {
              await restoreSceneSnapshot(savedScene)
              if (cancelled) return
            }
            sceneRestoredRef.current = typeof sessionId === 'string' && sessionId !== ''
            settleReadyWaiters()
            setPhase('ready')
          } catch (error) {
            if (!cancelled) {
              settleReadyWaiters(error instanceof Error ? error : new Error(String(error)))
              setError(message(error))
              setPhase('error')
            }
          }
        })()
        return () => {
          cancelled = true
          // Capture the last scene before the viewer is destroyed.
          saveSceneSnapshot()
          readyGateRef.current.ready = false
          settleReadyWaiters(new Error(t('agent.notReady')))
          clearTimeout(toastTimer.current)
          try {
            handlerRef.current?.destroy()
          } catch {
            /* ignore */
          }
          handlerRef.current = null
          try {
            viewerRef.current?.destroy()
          } catch {
            /* ignore */
          }
          viewerRef.current = null
          layersRef.current = []
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      // A tab body can mount before its session id is known; restore once the
      // viewer is ready and the id arrives (the normal path restores inside the
      // init effect and leaves this no-op).
      React.useEffect(() => {
        if (phase !== 'ready' || sceneRestoredRef.current) return undefined
        if (typeof sessionId !== 'string' || sessionId === '') return undefined
        sceneRestoredRef.current = true
        const snapshot = readSceneSnapshot(sessionId)
        if (snapshot === null) return undefined
        void restoreSceneSnapshot(snapshot)
        return undefined
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [phase, sessionId])

      // Debounced scene persistence: camera moves and layer/overlay changes set
      // the dirty flag, this timer writes at most every few seconds. pagehide and
      // visibilitychange flush before the tab body is disposed or the window hides.
      React.useEffect(() => {
        const timer = setInterval(() => {
          if (sceneDirtyRef.current) saveSceneSnapshot()
        }, 3000)
        const flush = () => {
          if (sceneDirtyRef.current) saveSceneSnapshot()
        }
        const onVisibility = () => {
          if (document.visibilityState === 'hidden') flush()
        }
        window.addEventListener('pagehide', flush)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          clearInterval(timer)
          window.removeEventListener('pagehide', flush)
          document.removeEventListener('visibilitychange', onVisibility)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      React.useEffect(() => {
        if (!openMenu) return undefined
        const close = (event) => {
          if (!menuRef.current?.contains(event.target)) setOpenMenu(null)
        }
        document.addEventListener('pointerdown', close, true)
        return () => document.removeEventListener('pointerdown', close, true)
      }, [openMenu])

      // The recent-folder list is Host state, so fetch it when the menu opens rather
      // than at panel start: a closed menu costs no request, an open one is current.
      React.useEffect(() => {
        if (openMenu === 'data') refreshRecentDirs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [openMenu, meta?.directoriesUrl])

      React.useEffect(() => {
        if (phase !== 'ready') return undefined
        const element = globeRef.current
        if (!element || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => {
          try {
            viewerRef.current?.resize()
          } catch {
            /* ignore */
          }
        })
        observer.observe(element)
        return () => observer.disconnect()
      }, [phase])

      React.useEffect(() => {
        if (phase !== 'ready') return undefined
        let raf = 0
        let frames = 0
        let last = performance.now()
        const tick = (now) => {
          frames += 1
          if (now - last >= 1000) {
            setFps(Math.round((frames * 1000) / (now - last)))
            frames = 0
            last = now
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
      }, [phase])

      React.useEffect(() => {
        if (!scan) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setScan(null)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [scan])

      React.useEffect(() => {
        if (phase !== 'ready') return undefined
        const timer = setInterval(() => setStats(collectStats()), 500)
        return () => clearInterval(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [phase])

      // Keep the bare globe (no imagery) and its atmosphere in step with the
      // resolved light/dark scheme, so an explicit override tints the whole panel.
      React.useEffect(() => {
        const viewer = viewerRef.current
        const Cesium = cesiumRef.current
        if (phase !== 'ready' || !viewer || !Cesium) return
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(resolvedDark ? '#05080f' : '#dde6f2')
        viewer.scene.globe.showGroundAtmosphere = resolvedDark
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = resolvedDark
        viewer.scene.requestRender?.()
      }, [phase, resolvedDark])

      const button = (label, onClick, active, extra, title) =>
        h(
          'button',
          { type: 'button', className: `mv-btn${active ? ' on' : ''}${extra ? ` ${extra}` : ''}`, onClick, title },
          label,
        )
      const iconButton = (icon, title, onClick, active) =>
        h(
          'button',
          {
            type: 'button',
            className: `mv-btn icon${active ? ' on' : ''}`,
            title,
            'aria-label': title,
            'aria-pressed': active === undefined ? undefined : active,
            onClick,
          },
          icon,
        )
      const menu = (id, label, items, active) =>
        h(
          'div',
          { key: id, className: 'mv-menu' },
          button(`${label} ▾`, () => setOpenMenu(openMenu === id ? null : id), active),
          openMenu === id ? h('div', { className: 'mv-menu-panel mv-glass' }, items) : null,
        )

      const status = busy || (phase === 'loading' ? t('panel.status.loading') : layers.length ? t('panel.status.layers', { n: layers.length }) : t('panel.status.ready'))
      const hudLabels = {
        pointer: t('hud.pointer'),
        camera: t('hud.camera'),
        heading: t('hud.heading'),
        tiles: t('hud.tiles'),
        pending: t('hud.pending'),
        triangles: t('hud.triangles'),
        cache: t('hud.cache'),
      }

      return h(
        'div',
        {
          ref: rootRef,
          className: `mv-root${docked ? ' mv-docked' : ''}`,
          'data-mv-theme': themeMode === 'auto' ? undefined : themeMode,
          'data-mv-scheme': resolvedDark ? 'dark' : 'light',
        },
        h('style', { key: 'css' }, CSS),
        h('div', { key: 'globe', ref: globeRef, className: 'mv-globe' }),
        activeImagery?.credit
          ? h('div', { key: 'attr', className: 'mv-attr' }, `${t('credit.imagery')} © ${activeImagery.credit}`)
          : null,
        h('div', { key: 'credits', ref: creditRef, className: 'mv-credits' }),
        h(
          'div',
          { key: 'top', className: 'mv-top' },
          h(
            'div',
            { className: 'mv-brand mv-glass' },
            h(ViewerIcon, { size: 18 }),
            h('b', null, t('panel.title')),
            h('span', null, status),
          ),
          h(
            'div',
            { ref: menuRef, className: 'mv-actions mv-glass' },
            menu(
              'data',
              t('btn.data'),
              [
                h(MenuItem, { key: 'local', onClick: pickLocal }, t('btn.openLocal')),
                recentDirs.length
                  ? h(
                      React.Fragment,
                      { key: 'recent' },
                      h('span', { className: 'mv-menu-label' }, t('menu.recentDirs')),
                      ...recentDirs.map((entry) =>
                        h(
                          MenuItem,
                          { key: entry.dir, title: entry.dir, onClick: () => openRecentDirectory(entry.dir) },
                          h('span', { className: 'ellipsis' }, entry.name),
                        ),
                      ),
                    )
                  : null,
                agentOverlayCount > 0
                  ? h(
                      MenuItem,
                      {
                        key: 'clearAgent',
                        onClick: () => {
                          setOpenMenu(null)
                          clearAgentOverlays('all')
                          showToast(t('agent.clearedOverlays'))
                        },
                      },
                      t('menu.clearAgent'),
                    )
                  : null,
                h(
                  MenuItem,
                  {
                    key: 'url',
                    onClick: () => {
                      setOpenMenu(null)
                      setUrlBar((value) => !value)
                    },
                  },
                  t('btn.openUrl'),
                ),
                h('i', { key: 'sep', className: 'mv-sep', style: { width: 'auto', height: '.5px', margin: '4px 8px' } }),
                h(
                  MenuItem,
                  {
                    key: 'clear',
                    onClick: () => {
                      setOpenMenu(null)
                      setToolMode(null)
                      setPickInfo(null)
                      setMeasureInfo(null)
                    },
                  },
                  t('tool.clear'),
                ),
              ],
            ),
            menu(
              'basemap',
              t('btn.basemap'),
              [
                h(
                  MenuItem,
                  { key: 'none', active: activeImageryId === null, onClick: () => changeImagery(null) },
                  t('menu.none'),
                ),
                ...(sources?.imagery ?? []).map((source) =>
                  h(
                    MenuItem,
                    { key: source.id, active: activeImageryId === source.id, onClick: () => changeImagery(source.id) },
                    source.name,
                  ),
                ),
              ],
              Boolean(activeImageryId),
            ),
            menu(
              'terrain',
              t('btn.terrain'),
              [
                h(MenuItem, { key: 'off', active: activeTerrainId === null, onClick: () => changeTerrain(null) }, t('menu.terrainOff')),
                ...(sources?.terrain ?? []).map((source) =>
                  h(
                    MenuItem,
                    { key: source.id, active: activeTerrainId === source.id, onClick: () => changeTerrain(source.id) },
                    source.name,
                  ),
                ),
              ],
              activeTerrainId !== null,
            ),
            h('i', { key: 's1', className: 'mv-sep' }),
            menu(
              'measure',
              t('btn.measure'),
              [
                h(MenuItem, { key: 'distance', active: tool === 'distance', onClick: () => setToolMode(tool === 'distance' ? null : 'distance') }, t('tool.distance')),
                h(MenuItem, { key: 'area', active: tool === 'area', onClick: () => setToolMode(tool === 'area' ? null : 'area') }, t('tool.area')),
                h(MenuItem, { key: 'height', active: tool === 'height', onClick: () => setToolMode(tool === 'height' ? null : 'height') }, t('tool.height')),
                h(MenuItem, { key: 'pick', active: tool === 'pick', onClick: () => setToolMode(tool === 'pick' ? null : 'pick') }, t('tool.pick')),
              ],
              tool !== null,
            ),
            h('i', { key: 's2', className: 'mv-sep' }),
            button(
              `${t('btn.layers')}${layers.length ? ` ${layers.length}` : ''}`,
              () => updateSettings({ showLayers: !showLayers }),
              showLayers && layers.length > 0,
              undefined,
              showLayers ? t('btn.layersHide') : t('btn.layersShow'),
            ),
            iconButton(
              h(HudIcon),
              showHud ? t('btn.hudHide') : t('btn.hudShow'),
              () => updateSettings({ showHud: !showHud }),
              showHud,
            ),
            button(t('btn.screenshot'), screenshot),
            button(t('btn.reset'), resetView),
            docked
              ? iconButton(h(FullscreenIcon), t('btn.immersiveTitle'), togglePaneFullscreen)
              : button(t('btn.beside'), openBeside),
            h('i', { key: 's3', className: 'mv-sep' }),
            h(
              'div',
              { key: 'appearance', className: 'mv-menu' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mv-btn icon',
                  title: `${t('btn.appearance')} · ${t(themeMode === 'auto' ? 'theme.auto' : themeMode === 'light' ? 'theme.light' : 'theme.dark')}`,
                  'aria-haspopup': 'menu',
                  onClick: () => setOpenMenu(openMenu === 'appearance' ? null : 'appearance'),
                },
                h(ThemeIcon, { mode: resolvedDark ? 'dark' : 'light' }),
              ),
              openMenu === 'appearance'
                ? h(
                    'div',
                    { className: 'mv-menu-panel mv-glass' },
                    [
                      ['auto', 'theme.auto'],
                      ['light', 'theme.light'],
                      ['dark', 'theme.dark'],
                    ].map(([mode, label]) =>
                      h(
                        MenuItem,
                        {
                          key: mode,
                          active: themeMode === mode,
                          onClick: () => setTheme(mode),
                        },
                        t(label),
                      ),
                    ),
                  )
                : null,
            ),
            h(
              'button',
              {
                key: 'settings',
                type: 'button',
                className: 'mv-btn icon',
                title: t('btn.settings'),
                onClick: () => setSettingsOpen(true),
              },
              h(
                'svg',
                { viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': true, style: { display: 'block' } },
                h('g', { stroke: 'currentColor', strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round' },
                  h('circle', { cx: 12, cy: 12, r: 3.2 }),
                  h('path', { d: 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z' }),
                ),
              ),
            ),
          ),
        ),
        urlBar
          ? h(
              'div',
              { key: 'urlbar', className: 'mv-urlbar mv-glass' },
              h('input', {
                autoFocus: true,
                value: urlInput,
                placeholder: t('urlbar.placeholder'),
                onChange: (event) => setUrlInput(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') submitUrl()
                  if (event.key === 'Escape') setUrlBar(false)
                },
              }),
              h('button', { type: 'button', onClick: submitUrl }, t('urlbar.submit')),
            )
          : null,
        showLayers && layers.length > 0
          ? h(
              'div',
              { key: 'layers', className: 'mv-layers mv-glass' },
              h(
                'header',
                null,
                h('span', null, `${t('layers.title')} · ${layers.length}`),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mv-icon-btn',
                    title: t('layers.collapse'),
                    'aria-label': t('layers.collapse'),
                    onClick: () => updateSettings({ showLayers: false }),
                  },
                  h(CollapseIcon),
                ),
              ),
              h(
                'div',
                { className: 'mv-layer-list' },
                layers.map((layer) =>
                  h(
                    'div',
                    { key: layer.id, className: `mv-layer${layer.visible ? '' : ' off'}` },
                    h('span', { className: 'name', title: layer.name, onClick: () => flyToLayer(layer.id) }, layer.name),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: `mv-icon-btn${layer.visible ? '' : ' on'}`,
                        title: layer.visible ? t('btn.visible') : t('btn.hidden'),
                        onClick: () => toggleLayer(layer.id),
                      },
                      layer.visible ? h(LayerActionIcon, { key: 'v', kind: 'visible' }) : h(LayerActionIcon, { key: 'v', kind: 'hidden' }),
                    ),
                    h(
                      'button',
                      { type: 'button', className: 'mv-icon-btn', title: t('btn.flyTo'), 'aria-label': t('btn.flyTo'), onClick: () => flyToLayer(layer.id) },
                      h(LayerActionIcon, { kind: 'locate' }),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mv-icon-btn',
                        title: t('btn.health'),
                        'aria-label': t('btn.health'),
                        onClick: () => inspectLayer(layer.id),
                      },
                      h(LayerActionIcon, { kind: 'inspect' }),
                    ),
                    h(
                      'button',
                      { type: 'button', className: 'mv-icon-btn', title: t('btn.delete'), 'aria-label': t('btn.delete'), onClick: () => removeLayer(layer.id) },
                      h(LayerActionIcon, { kind: 'delete' }),
                    ),
                  ),
                ),
              ),
            )
          : null,
        phase === 'ready' && layers.length === 0 && !emptyDismissed && !restoringScene
          ? h(
              'div',
              { key: 'empty', className: 'mv-overlay' },
              h(
                'div',
                { className: 'mv-empty' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mv-empty-close',
                    title: t('panel.empty.dismiss'),
                    'aria-label': t('panel.empty.dismiss'),
                    onClick: () => setEmptyDismissed(true),
                  },
                  '✕',
                ),
                h(ViewerIcon, { size: 30 }),
                h('h2', null, t('panel.empty.title')),
                h('p', null, t('panel.empty.body')),
                h(
                  'div',
                  { className: 'buttons' },
                  h('button', { type: 'button', className: 'mv-cta primary', onClick: pickLocal }, t('panel.empty.local')),
                  h('button', { type: 'button', className: 'mv-cta', onClick: () => setUrlBar(true) }, t('panel.empty.url')),
                ),
              ),
            )
          : null,
        phase === 'loading'
          ? h('div', { key: 'loading', className: 'mv-overlay dim' }, h('div', { className: 'mv-empty' }, h('div', { className: 'mv-spinner' }), h('p', null, t('panel.status.loading'))))
          : null,
        phase === 'error'
          ? h(
              'div',
              { key: 'error', className: 'mv-overlay dim' },
              h(
                'div',
                { className: 'mv-empty' },
                h('h2', null, '⚠'),
                h('p', null, error),
                h('div', { className: 'buttons' }, h('button', { type: 'button', className: 'mv-cta', onClick: () => location.reload() }, t('btn.retry'))),
              ),
            )
          : null,
        stats && showHud
          ? h(StatusHud, { key: 'hud', fps, stats, viewerRef, cesiumRef, labels: hudLabels, readoutRef: captureReadoutRef })
          : null,
        measureInfo ? h('div', { key: 'measure', className: 'mv-measure mv-glass' }, measureInfo.text) : null,
        pickInfo
          ? h(
              'div',
              { key: 'pick', className: 'mv-pick mv-glass' },
              h(
                'header',
                null,
                h('span', null, pickInfo.title),
                h(
                  'button',
                  { type: 'button', className: 'mv-icon-btn', onClick: () => setPickInfo(null), title: t('btn.close') },
                  '✕',
                ),
              ),
              h(
                'table',
                null,
                h(
                  'tbody',
                  null,
                  pickInfo.rows.map(([name, value]) => h('tr', { key: name }, h('td', null, name), h('td', null, value))),
                ),
              ),
            )
          : null,
        toast ? h('div', { key: 'toast', className: 'mv-toast' }, toast) : null,
        scan
          ? h(
              'div',
              { key: 'scan', className: 'mv-modal', onPointerDown: (event) => event.target === event.currentTarget && setScan(null) },
              h(
                'div',
                { className: 'mv-dialog' },
                h(
                  'header',
                  null,
                  h('b', null, t('layers.title')),
                  h('span', { className: 'path', style: { fontWeight: 400, color: 'var(--mv-dim)' } }, scan.dir),
                  h('button', { type: 'button', className: 'mv-icon-btn', onClick: () => setScan(null), title: t('btn.close') }, '✕'),
                ),
                h(
                  'div',
                  { className: 'body' },
                  scan.items.map((item) =>
                    h(
                      'button',
                      {
                        key: item.url,
                        type: 'button',
                        className: 'mv-cta',
                        style: { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' },
                        onClick: () =>
                          addTileset(item.url, item.name.split(/[\\/]/).filter(Boolean).slice(-2).join('/'), {
                            kind: 'local',
                            path: joinLocalPath(scan.dir, item.name),
                          }),
                      },
                      h('span', null, item.name),
                    ),
                  ),
                ),
              ),
            )
          : null,
        health
          ? h(HealthDialog, {
              key: 'health',
              state: health,
              messages: t,
              onClose: closeHealth,
              onCopy: async () => {
                const path = health.reportPath ?? health.report?.reportPath
                if (!path) return
                try {
                  await navigator.clipboard.writeText(path)
                  showToast(t('health.copied'))
                } catch {
                  showToast(t('health.copyFailed'))
                }
              },
            })
          : null,
        settingsOpen && sources && defaults
          ? h(SourcesDialog, {
              key: 'settings',
              config: sources,
              defaults,
              environmentDark,
              themeMode,
              messages: t,
              meta,
              bridgeOn,
              bridgeReload,
              onPickLocal: pickLocalTiles,
              onSave: saveSources,
              onClose: () => setSettingsOpen(false),
            })
          : null,
        accessRequest
          ? h(PathAccessDialog, {
              key: 'access',
              request: accessRequest,
              busy: accessBusy,
              t,
              onAllow: allowPathAccess,
              onDeny: () => settleAccess({ allowed: false, message: t('access.denied') }),
            })
          : null,
        imageryBusy || terrainBusy
          ? h('div', { key: 'busy', className: 'mv-measure mv-glass', style: { bottom: '44px' } }, t('toast.loadingData'))
          : null,
      )
    }

    /** Chat header globe button: opens the session-scoped earth tab. */
    function HeaderButton(props) {
      const fallbackT = useTranslation()
      const t = typeof props.t === 'function' ? props.t : fallbackT
      const [hover, setHover] = React.useState(false)
      return h(
        'button',
        {
          type: 'button',
          title: t('header.open'),
          'aria-label': t('header.open'),
          style: {
            appearance: 'none',
            border: 0,
            padding: 0,
            margin: 0,
            flex: 'none',
            width: 26,
            height: 26,
            borderRadius: 7,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'inherit',
            background: hover ? 'rgba(127,127,127,.16)' : 'transparent',
            opacity: hover ? 1 : 0.82,
          },
          onClick: () => props.onOpen?.(props.sessionId),
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
        },
        h(ViewerIcon, { size: 16 }),
      )
    }

    //#region agent tool rows --------------------------------------------------

    /**
     * The panel's own stylesheet only exists inside an `mv-root`, but the tool
     * rows live in the chat, so they need their own (host-token based) sheet.
     */
    const TOOL_CSS = `
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
`

    /** Inject the chat-row stylesheet once; a hot reload may re-run `apply`. */
    const ensureToolCss = () => {
      if (typeof document === 'undefined') return
      const id = '@cveo/dsh-digital-earth/tool-row.css'
      if (document.querySelector(`style[data-plugin-css="${id}"]`)) return
      const tag = document.createElement('style')
      tag.dataset.plugin = '@cveo/dsh-digital-earth'
      tag.dataset.pluginCss = id
      tag.textContent = TOOL_CSS
      document.head.appendChild(tag)
    }

    /** Open the session-scoped earth tab, falling back to the immersive panel. */
    const openEarthPanel = () => {
      // Prefer the chat-adjacent tab so the conversation stays visible; the
      // immersive main panel is only a fallback for hosts without a session.
      try {
        const rightbar = service('sidebarRight')
        if (rightbar && typeof rightbar.openTab === 'function') {
          rightbar.openTab('digital-earth')
          return
        }
      } catch {
        // No on-screen session: fall through to the immersive panel.
      }
      service('layout')?.selectPanel?.('digital-earth')
    }

    /**
     * First line of a settled tool result. A failed earth call keeps its guidance
     * ("panel did not attach…") in the transcript instead of hiding it behind the
     * generic row this custom view replaced.
     */
    const resultFirstLine = (block) => {
      const content = Array.isArray(block?.content) ? block.content : []
      for (const part of content) {
        if (part?.type !== 'text' || typeof part.text !== 'string') continue
        const line = part.text.split('\n').find((item) => item.trim() !== '')
        if (line !== undefined) return line.trim()
      }
      return ''
    }

    /** Locale keys for the action summary shown on an earth tool-call row. */
    const SCENE_ACTION_KEYS = {
      status: 'tool.action.status',
      list: 'tool.action.list',
      load: 'tool.action.load',
      remove: 'tool.action.remove',
      visible: 'tool.action.visible',
      basemap: 'tool.action.basemap',
      terrain: 'tool.action.terrain',
      fly: 'tool.action.fly',
      reset: 'tool.action.reset',
      pick: 'tool.action.pick',
      inspect: 'tool.action.inspect',
    }

    /** Fixed summary keys for the tools that carry no `action` argument. */
    const TOOL_SUMMARY_KEYS = {
      earth_capture: 'tool.action.capture',
      earth_draw: 'tool.action.draw',
      earth_measure: 'tool.action.measure',
    }

    /**
     * Call ids whose live row already opened the panel. Module-level so a row
     * remount (scrolling, session switch) cannot reopen a panel the user closed,
     * while a genuinely new call still opens it.
     */
    const AUTO_OPENED_CALLS = new Set()

    /**
     * Chat row for the four Agent wire tools. It keeps the transcript compact,
     * offers a way back into the panel, and is the client's auto-open trigger: a
     * live call opens the docked tab so the Host tool call finds a panel to drive.
     */
    function EarthToolRow({ toolName, phase, block, callId }) {
      const t = useTranslation()
      const openedRef = React.useRef(false)

      React.useEffect(() => {
        // Replayed history renders with phase === 'result' and must never pop the
        // panel. The refs make this one-shot per rendered row and per call id: a
        // long turn (or React re-running the effect in development) cannot re-open
        // a panel the user just closed.
        if (phase === 'result' || openedRef.current) return
        if (typeof callId === 'string' && AUTO_OPENED_CALLS.has(callId)) return
        if (!readAutoOpen()) return
        const rightbar = service('sidebarRight')
        // A service that is not mounted yet must not burn the one-shot: the next
        // phase transition retries instead of leaving the Host call waiting.
        if (!rightbar || typeof rightbar.openTab !== 'function') return
        openedRef.current = true
        try {
          const alreadyOpen = rightbar.isExpanded?.() === true && rightbar.active?.()?.kind === 'digital-earth'
          if (!alreadyOpen) rightbar.openTab('digital-earth')
          // Recorded only after openTab returned: a throw (no on-screen session)
          // must stay retryable on the next phase transition.
          if (typeof callId === 'string') AUTO_OPENED_CALLS.add(callId)
        } catch {
          // No on-screen Session yet: the row's Open button stays the manual path.
        }
      }, [phase, callId])

      const action = toolName === 'earth_scene' ? toolArg(block, 'action') : ''
      const state = phase === 'result' ? (block?.isError === true ? 'error' : 'ok') : 'live'
      const failure = state === 'error' ? resultFirstLine(block) : ''
      const summaryKey = toolName === 'earth_scene'
        ? SCENE_ACTION_KEYS[action] ?? 'tool.action.generic'
        : TOOL_SUMMARY_KEYS[toolName] ?? 'tool.action.generic'
      const summary = failure !== '' ? failure : t(summaryKey)
      return h(
        'div',
        { className: 'mv-toolrow', 'data-state': state, 'data-tool': toolName },
        h('span', { className: 'glyph', 'aria-hidden': true }, h(ViewerIcon, { size: 14 })),
        h('span', { className: 'title' }, t('panel.title')),
        h('span', { className: 'sep', 'aria-hidden': true }),
        h('span', { className: 'summary', title: failure !== '' ? failure : undefined }, summary),
        h(
          'button',
          { type: 'button', className: 'open', title: t('tool.openTip'), onClick: openEarthPanel },
          t('tool.open'),
        ),
      )
    }
    //#endregion agent tool rows

    return {
      inject: ['slots', 'uiWorkspace', 'locale', 'theme'],
      apply(ctx) {
        appCtx = ctx
        const NS = 'dsh-digital-earth'
        // Registered through ctx.effect so a hot reload disposes the old dictionaries
        // before the new ones land (the registry rejects duplicate namespaces).
        ctx.effect(
          () => ctx.locale.register(NS, { zh: MESSAGES.zh, en: MESSAGES.en }),
          'dsh-digital-earth: dictionaries',
        )
        const translate = ctx.locale.bind(NS)
        // The chat rows live outside the panel, so their styles must be global.
        ensureToolCss()
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'digital-earth',
              order: 30,
              label: () => translate('panel.title'),
              locale: NS,
            },
            ViewerIcon,
          ),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'digital-earth', locale: NS }, ViewerPanel),
        )
        // Session right sidebar: a page type plus its body. Both live inside the
        // same injected scope, so a hot reload disposes the type before
        // re-registering it.
        ctx.inject(['sidebarRightTabs'], (scope) => {
          scope.effect(
            () =>
              scope.sidebarRightTabs.register({
                id: 'dsh-digital-earth',
                kind: 'digital-earth',
                title: () => translate('tab.title'),
                keepMounted: true,
              }),
            'dsh-digital-earth: sidebar tab type',
          )
          scope.slots.inject('sidebar.right.pane.tab', () =>
            scope.slots.register(
              { name: 'sidebar.right.pane.tab', key: 'dsh-digital-earth', locale: NS },
              EarthTabBody,
            ),
          )
        })
        // A globe button on the conversation header keeps the panel one click away
        // from the chat, which is how the Agent-first workflow stays discoverable.
        ctx.slots.inject('conversation.session.header.utilities', () =>
          ctx.slots.register(
            { name: 'conversation.session.header.utilities', id: 'digital-earth-open', order: 30, locale: NS },
            (props) => h(HeaderButton, { ...props, onOpen: openEarthPanel }),
          ),
        )
        // The Agent drives the same panel through these two wire tools, so their
        // rows own the auto-open: the Host tool call waits for this tab to attach.
        ctx.slots.inject('tool.call.toolview', function* () {
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_scene', locale: NS }, EarthToolRow)
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_capture', locale: NS }, EarthToolRow)
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_draw', locale: NS }, EarthToolRow)
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_measure', locale: NS }, EarthToolRow)
        })
      },
    }
  },
})
