/**
 * messages-hud.js — coordinate HUD and runtime readout copy.
 *
 * messages.js is at its 900-line budget; the HUD strings are a self-contained
 * instrument vocabulary (pointer/centre/camera, tile and frame counters), so
 * they live in their own module and are merged into the base catalog.
 */

export const HUD_MESSAGES = {
  zh: {
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
    'hud.fpsTitle': '按 Cesium 渲染帧统计的平滑帧率（窗口刷新率不等于渲染帧；静止 2 秒显示 —）',
  },
  en: {
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
    'hud.fpsTitle': 'Smoothed frame rate counted from Cesium render passes (window refresh rate is not render throughput; — after 2 s without a render)',
  },
}
