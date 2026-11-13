/**
 * ui/css.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */

import { VECTOR_CSS } from './vector-css.js'
import { VISION_CSS } from './vision-css.js'
import { SELECTION_QUESTION_CSS } from './selection-question-css.js'
import { PARSE_CSS } from './parse-css.js'

    const CSS = `
.mv-root{position:relative;flex:1 1 0;min-height:0;overflow:hidden;background:var(--mv-bg);color:var(--mv-text);font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;--mv-bg:var(--dsw-alias-bg-base,#fff);--mv-text:var(--dsw-alias-label-primary,#0f1115);--mv-dim:var(--dsw-alias-label-secondary,#5b6068);--mv-line:var(--dsw-alias-border-l2,#0000001a);--mv-accent:var(--dsw-alias-state-business-primary,#4176e6);--mv-profile-line:#1d4ed8;--mv-profile-design:#c2610a;--mv-lift:var(--dsw-alias-interactive-bg-hover,#2631480f);--mv-glass:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 88%,transparent);--mv-glass-strong:var(--dsw-alias-bg-layer-1,#fff);--mv-input:var(--dsw-alias-interactive-bg-hover,#2631480f);--mv-shadow:0 8px 28px rgba(15,23,42,.18);--mv-attrib:rgba(255,255,255,.62);--mv-attrib-shadow:0 1px 2px rgba(0,0,0,.6);--mv-overlay:transparent;--mv-scrim:rgba(24,34,50,.28)}
.mv-root[data-mv-scheme="dark"]{--mv-attrib:rgba(255,255,255,.62);--mv-attrib-shadow:0 1px 2px rgba(0,0,0,.6);--mv-overlay:transparent;--mv-scrim:rgba(3,7,13,.62);color-scheme:dark}
.mv-root[data-mv-scheme="light"]{color-scheme:light}
.mv-root[data-mv-theme="dark"]{--mv-bg:#151517;--mv-text:#ebeef2;--mv-dim:#adb2b8;--mv-line:#ffffff1f;--mv-accent:#7aaaff;--mv-profile-line:#8ab4ff;--mv-profile-design:#f0a04b;--mv-lift:#ffffff14;--mv-glass:rgba(21,21,23,.82);--mv-glass-strong:#232324;--mv-input:#ffffff14;--mv-shadow:0 8px 28px rgba(0,0,0,.34);color-scheme:dark}
.mv-root[data-mv-theme="light"]{--mv-bg:#fff;--mv-text:#0f1115;--mv-dim:#5b6068;--mv-line:#0000001a;--mv-accent:#4176e6;--mv-profile-line:#1d4ed8;--mv-profile-design:#c2610a;--mv-lift:#2631480f;--mv-glass:rgba(255,255,255,.86);--mv-glass-strong:#fff;--mv-input:#2631480f;--mv-shadow:0 8px 28px rgba(15,23,42,.16);color-scheme:light}
/* DOM fullscreen: the panel root owns the whole screen, so the flex sizing of
   the slot no longer applies and the floating chrome uses the viewport. */
.mv-root:fullscreen{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0}
.mv-globe{position:absolute;inset:0;background:#05080f}
.mv-globe .cesium-viewer,.mv-globe .cesium-widget,.mv-globe .cesium-widget canvas{width:100%;height:100%}
.mv-attr{position:absolute;right:10px;bottom:18px;z-index:6;font-size:10px;line-height:1.4;color:var(--mv-attrib);pointer-events:none;text-shadow:var(--mv-attrib-shadow)}
.mv-credits{position:absolute;right:10px;bottom:2px;max-width:46%;z-index:6;font-size:10px;color:var(--mv-attrib);text-align:right;line-height:1.4;text-shadow:var(--mv-attrib-shadow)}
.mv-compass{position:absolute;right:12px;bottom:42px;z-index:12;appearance:none;display:flex;align-items:center;justify-content:center;width:58px;height:58px;padding:0;border-radius:50%;border:1px solid var(--mv-line);background:color-mix(in srgb,var(--mv-bg) 72%,transparent);color:var(--mv-text);cursor:pointer;pointer-events:auto;box-shadow:0 4px 16px rgba(15,23,42,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.mv-compass svg{display:block;width:100%;height:100%}
.mv-compass-rose{transform-origin:28px 28px;transition:transform .08s linear}
.mv-compass:hover{border-color:var(--mv-accent)}
.mv-compass:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px}
@media (max-width:420px){.mv-compass{width:50px;height:50px;right:8px;bottom:36px}}
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
.mv-right{position:absolute;top:60px;right:10px;width:min(300px,calc(100% - 20px));max-height:calc(100% - 150px);display:flex;flex-direction:column;gap:10px;z-index:9;pointer-events:none;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin}
.mv-right>*{pointer-events:auto;box-sizing:border-box;max-width:100%}
.mv-card{background:var(--mv-glass);border:.5px solid var(--mv-line);box-shadow:var(--mv-shadow);border-radius:13px}
/* Workbench resize grips: thin transparent edges, visible only on hover/focus. */
.mv-resize-handle{position:absolute;z-index:40;touch-action:none;background:transparent;pointer-events:auto}
.mv-resize-width{top:0;bottom:0;width:8px;cursor:ew-resize}
.mv-resize-left{left:0}
.mv-resize-right{right:0}
.mv-resize-height{left:0;right:0;height:8px;cursor:ns-resize}
.mv-resize-bottom{bottom:0}
.mv-resize-corner{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize}
.mv-resize-handle:hover,.mv-resize-handle:focus-visible{background:color-mix(in srgb,var(--mv-accent) 28%,transparent);outline:none}
.mv-resize-handle:focus-visible{box-shadow:inset 0 0 0 1px var(--mv-accent)}
.mv-tools,.mv-layers,.mv-analysis{position:relative}
.mv-layers{width:100%;min-height:0;flex:1 1 auto;display:flex;flex-direction:column;border-radius:13px;overflow:hidden}
.mv-head-actions{display:inline-flex;align-items:center;gap:2px;flex:none}
/* Tools card: functions (measure / analysis / sun / effects / views) live here,
   never in the layer card. It caps its height so the layer list keeps room. */
.mv-tools{width:100%;flex:0 1 auto;min-height:0;max-height:min(52%,400px);display:flex;flex-direction:column;border-radius:13px;overflow:hidden;container-type:inline-size}
.mv-tools>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px 9px 14px;font-size:13px;font-weight:600;color:var(--mv-text);border-bottom:.5px solid var(--mv-line);flex-shrink:0}
.mv-tools.minimized>header{border-bottom:0}
.mv-tools-title{display:inline-flex;align-items:center;gap:7px;min-width:0}
.mv-tools-active-pill{min-width:0;max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:500;color:var(--mv-accent);background:color-mix(in srgb,var(--mv-accent) 12%,transparent);border:.5px solid color-mix(in srgb,var(--mv-accent) 26%,transparent)}
.mv-tools .mv-tool-list{overflow:auto;padding:4px 10px 10px;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable}
.mv-tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:3px 0 6px}
.mv-tool-grid .mv-cta{padding:6px 8px;font-size:11px}
/* Box-selection readout inside the Tools card (canvas gesture → area/GeoJSON). */
.mv-selection{display:flex;flex-direction:column;gap:5px;margin-top:5px}
.mv-selection .stat{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11px;color:var(--mv-dim)}
.mv-selection .stat b{color:var(--mv-text);font-weight:600;font-variant-numeric:tabular-nums}
.mv-selection-actions{display:flex;gap:5px;flex-wrap:wrap}
.mv-selection-actions .mv-cta{flex:1;min-width:0;padding:6px 8px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-analysis{flex:0 1 auto;min-height:0;max-height:min(72%,460px);width:100%;max-width:100%;display:flex;flex-direction:column;overflow:hidden}
/* The chart is the first body child now; a docked (narrow) panel still gets the
   taller cap so the profile thumbnail is never squeezed to zero. */
.mv-root.mv-docked .mv-analysis{max-height:min(72%,460px)}
.mv-analysis>header{display:flex;align-items:center;gap:2px;padding:7px 7px 7px 11px;border-bottom:.5px solid var(--mv-line)}
.mv-analysis>header .title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}
.mv-analysis .body{padding:8px 11px 10px;overflow:auto;display:flex;flex-direction:column;gap:5px;min-height:0}
.mv-analysis .layer{color:var(--mv-dim);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-analysis .stat{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:11.5px;line-height:1.5}
.mv-analysis .stat span{flex:none;color:var(--mv-dim)}
.mv-analysis .stat b{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;word-break:break-word}
.mv-analysis .chart{width:100%;height:auto;display:block;margin-top:0;border:.5px solid var(--mv-line);border-radius:8px;background:color-mix(in srgb,var(--mv-bg) 45%,transparent)}
.mv-analysis .chart text{fill:var(--mv-dim);font-size:8px}
.mv-analysis .hint{margin:2px 0 0;color:var(--mv-dim);font-size:10px;line-height:1.5}
.mv-analysis .warnings{margin:0;color:var(--mv-dim);font-size:10px;line-height:1.45;word-break:break-word}
.mv-analysis .profile-tools{display:flex;flex-direction:column;gap:6px;border-top:.5px solid var(--mv-line);padding-top:7px;margin-top:3px}
.mv-analysis .profile-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mv-analysis .profile-row select,.mv-analysis .profile-row input{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:4px 6px;font:inherit;font-size:11px;min-width:0}
.mv-analysis .profile-width{display:inline-flex;align-items:center;gap:4px;color:var(--mv-dim);font-size:10.5px}
.mv-analysis .profile-width input{width:52px}
.mv-analysis .profile-row .mv-cta{flex:1;padding:5px 6px;font-size:10.5px;white-space:nowrap}
.mv-analysis .profile-note{margin:0;color:var(--mv-dim);font-size:9.5px;line-height:1.45}
.mv-analysis .profile-chart-thumb{appearance:none;display:flex;flex-direction:column;gap:2px;width:100%;padding:0;border:0;background:transparent;text-align:right;cursor:zoom-in;flex:none}
.mv-analysis .profile-chart-hint{font-size:9.5px;color:var(--mv-dim)}
.mv-chart-modal{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,18,30,.55)}
.mv-chart-dialog{width:min(980px,94vw);max-height:90vh;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;background:var(--mv-glass-strong);border:.5px solid var(--mv-line);box-shadow:var(--mv-shadow)}
.mv-chart-dialog>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:.5px solid var(--mv-line);font-size:13px;font-weight:600}
.mv-chart-body{padding:12px;overflow:auto;background:#fff}
.mv-chart-body img{display:block;width:100%;height:auto}
.mv-chart-actions{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:.5px solid var(--mv-line);flex-wrap:wrap}
.mv-chart-note{margin-left:auto;font-size:9.5px;color:var(--mv-dim)}
.mv-layer-tabs{display:flex;gap:2px;padding:6px 8px 4px;border-bottom:.5px solid var(--mv-line)}
.mv-layer-tab{appearance:none;border:0;background:transparent;color:var(--mv-dim);font:inherit;font-size:11.5px;font-weight:600;padding:6px 10px;border-radius:7px;cursor:pointer;flex:1;white-space:nowrap}
.mv-layer-tab.on{background:color-mix(in srgb,var(--mv-accent) 16%,transparent);color:var(--mv-text)}
.mv-layer-tab:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-layer-list[hidden]{display:none}
.mv-sun{margin:8px 4px 4px;padding:8px;border:.5px solid var(--mv-line);border-radius:9px;background:color-mix(in srgb,var(--mv-bg) 40%,transparent);display:flex;flex-direction:column;gap:6px}
.mv-sun-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
.mv-sun-toggle{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--mv-dim);cursor:pointer}
.mv-sun-row{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--mv-dim)}
.mv-sun-row input[type=date]{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:3px 5px;font:inherit;font-size:10.5px;min-width:0}
.mv-sun-row select{background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:3px 5px;font:inherit;font-size:10.5px;min-width:0;flex:1}
.mv-sun-clock{margin-left:auto;font-variant-numeric:tabular-nums}
.mv-sun-range{width:100%}
.mv-sun-readout{display:flex;gap:10px;font-size:10.5px;color:var(--mv-dim);font-variant-numeric:tabular-nums}
.mv-sun-check{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--mv-dim);cursor:pointer}
.mv-sun-note{margin:0;font-size:9.5px;line-height:1.45;color:var(--mv-dim)}
.mv-sun-zone{font-size:10px;color:var(--mv-dim);font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-sun-note.mv-sun-night{color:color-mix(in srgb,var(--mv-dim) 70%,var(--mv-accent) 30%)}
.mv-sun-note.mv-sun-alert{color:var(--mv-accent)}
/* Shader workbench (B3): one compact card on the left, never wider than 320px. */
.mv-shader{position:absolute;top:60px;left:10px;width:min(340px,calc(100% - 20px));max-height:calc(100% - 150px);z-index:14;display:flex;flex-direction:column;overflow:hidden;border-radius:14px;--shader-mint:#3ddc97;background:color-mix(in srgb,var(--mv-glass-strong) 94%,#0a0f15 6%);backdrop-filter:blur(14px) saturate(1.08);-webkit-backdrop-filter:blur(14px) saturate(1.08);border:.5px solid color-mix(in srgb,var(--mv-line) 65%,transparent);box-shadow:0 24px 64px rgba(2,8,20,.35)}.mv-shader>header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:.5px solid var(--mv-line);background:linear-gradient(180deg,color-mix(in srgb,var(--shader-mint) 7%,transparent),transparent)}
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
.mv-shader .presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;gap:8px}
.mv-shader .preset{position:relative;display:flex;flex-direction:column;gap:5px;appearance:none;border:.5px solid var(--mv-line);background:color-mix(in srgb,var(--mv-input) 82%,transparent);color:var(--mv-dim);font:inherit;font-size:11px;padding:5px;border-radius:9px;cursor:pointer;text-align:left;min-width:0}
.mv-shader .preset .thumb{display:block;height:48px;flex-shrink:0;border-radius:6px;overflow:hidden;background:#0a1018;border:.5px solid color-mix(in srgb,var(--mv-line) 60%,transparent)}
.mv-shader .preset .thumb-svg{display:block;width:100%;height:100%}
.mv-shader .preset .preset-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.5;color:var(--mv-dim)}
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
.mv-layer .mv-warn{flex:none;color:#f0b84b;font-size:12px;line-height:1;cursor:help;padding:0 2px}
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
/* Layer panel v1.6: four groups (L1 terrain / L2 vector / L3 raster / L4 imagery)
   plus the 3D Tiles list. The imagery group folds because one source is normally in use. */
.mv-group{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 4px 5px;margin-top:3px;border-top:.5px solid var(--mv-line)}
.mv-group-actions{display:inline-flex;align-items:center;gap:4px;flex:none}
.mv-group-subactions{display:flex;align-items:center;gap:6px;padding:2px 4px 6px}
.mv-group-subactions .mv-cta{flex:1;min-width:0;justify-content:center;font-size:11px;padding:5px 8px;border:.5px solid var(--mv-line);border-radius:8px;background:color-mix(in srgb,var(--mv-lift) 45%,transparent)}
.mv-group-subactions .mv-cta:hover{background:color-mix(in srgb,var(--mv-lift) 82%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 28%,var(--mv-line))}
.mv-add3d-menu .mv-cta{text-align:left;width:100%}
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
/* Collapsible card-within-card box for the long imagery basemap selector. */
.mv-fold-box{margin-top:8px;border:.5px solid var(--mv-line);border-radius:10px;background:color-mix(in srgb,var(--mv-lift) 38%,transparent);overflow:hidden}
.mv-fold-box.open{background:color-mix(in srgb,var(--mv-lift) 52%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 22%,var(--mv-line))}
.mv-fold-box>.mv-group{margin-top:0;border-top:0;padding:8px 10px}
.mv-fold-box.open>.mv-group{border-bottom:.5px solid var(--mv-line)}
.mv-fold-body{display:flex;flex-direction:column;gap:2px;padding:6px 6px 8px}
/* Foldable group header (the imagery basemap list is long and rarely changed). */
.mv-group-toggle{appearance:none;width:100%;display:flex;align-items:center;gap:8px;background:transparent;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer;text-align:left}
.mv-group-toggle .mv-group-title{flex:none}
.mv-group-current{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;font-size:11px;color:var(--mv-dim);opacity:.85}
.mv-group-chevron{flex:none;color:var(--mv-dim);font-size:13px;line-height:1;transform:rotate(90deg);transition:transform 160ms cubic-bezier(0.16,1,0.3,1)}
.mv-group-chevron.open{transform:rotate(-90deg)}
.mv-group-toggle:hover .mv-group-title,.mv-group-toggle:hover .mv-group-current{color:var(--mv-text)}
.mv-group-toggle:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px;border-radius:6px}
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
.mv-cta:disabled{opacity:.45;cursor:not-allowed}
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
  .mv-root.mv-docked .mv-tools{max-height:min(48%,360px)}
  .mv-root.mv-docked .mv-shader{top:92px;left:12px;width:min(320px,calc(100% - 24px));max-height:calc(100% - 236px)}
}
/* Snapshot mode: the picture is meant to be clean, so every overlay is hidden. */
.mv-root.mv-capturing .mv-top,.mv-root.mv-capturing .mv-urlbar,.mv-root.mv-capturing .mv-right,.mv-root.mv-capturing .mv-shader,.mv-root.mv-capturing .mv-layers,.mv-root.mv-capturing .mv-analysis,.mv-root.mv-capturing .mv-hud,.mv-root.mv-capturing .mv-attr,.mv-root.mv-capturing .mv-credits,.mv-root.mv-capturing .mv-pick,.mv-root.mv-capturing .mv-measure,.mv-root.mv-capturing .mv-toast,.mv-root.mv-capturing .mv-select,.mv-root.mv-capturing .mv-sel-anchor,.mv-root.mv-capturing .mv-sel-hint,.mv-root.mv-capturing .mv-tour,.mv-root.mv-capturing .mv-scene-details,.mv-root.mv-capturing .mv-overlay,.mv-root.mv-capturing .mv-compass,.mv-root.mv-capturing .mv-modal{visibility:hidden!important}
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
.mv-select{position:absolute;box-sizing:border-box;left:0;right:0;margin:0 auto;bottom:18px;z-index:12;width:min(360px,calc(100% - 24px));max-height:calc(100% - 132px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:9px;animation:mv-fade .16s cubic-bezier(.16,1,.3,1)}
.mv-scene-details{position:absolute;top:64px;right:12px;z-index:30;width:min(360px,calc(100% - 24px));max-height:calc(100% - 130px);overflow:auto;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;animation:mv-fade .16s ease-out}
.mv-scene-details>header{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;color:var(--mv-text)}
.mv-sd-section{display:flex;flex-direction:column;gap:4px;border-top:.5px solid var(--mv-line);padding-top:7px}
.mv-sd-section:first-of-type{border-top:0;padding-top:0}
.mv-sd-title{font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--mv-dim)}
.mv-sd-row{display:flex;align-items:baseline;gap:8px;font-size:11.5px}
.mv-sd-row span{color:var(--mv-dim);flex:none}
.mv-sd-row b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-sd-layer{display:flex;flex-direction:column;gap:2px;font-size:11.5px;padding:4px 0}
.mv-sd-layer b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-sd-layer span{color:var(--mv-dim);font-size:10.5px;font-variant-numeric:tabular-nums}
.mv-sd-empty{font-size:11px;color:var(--mv-dim)}
.mv-sd-warn{font-size:10.5px;line-height:1.45;color:#f0b84b;margin:0}
.mv-select header{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--mv-dim);font-size:10.5px;letter-spacing:.04em;text-transform:uppercase}
.mv-select h3{margin:0;font-size:15px;font-weight:600;line-height:1.4;color:var(--mv-text);overflow-wrap:anywhere}
.mv-select p{margin:0}
.mv-select .layer{font-size:11px;color:var(--mv-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-select .facts{display:flex;flex-direction:column;gap:4px;border-top:.5px solid var(--mv-line);border-bottom:.5px solid var(--mv-line);padding:7px 0}
.mv-select .fact{display:flex;align-items:baseline;gap:6px;font-size:11.5px}
.mv-select .fact .key{color:var(--mv-dim);flex:none}
.mv-select .fact b{font-weight:600;font-variant-numeric:tabular-nums}
.mv-select .fact em{flex:1;min-width:0;text-align:right;font-style:normal;font-size:10.5px;color:var(--mv-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-select .fact .mv-sel-conf{margin-left:auto;flex:none;font-size:9.5px;line-height:1;padding:2px 5px;border-radius:5px;border:1px solid color-mix(in srgb,currentColor 45%,transparent);background:color-mix(in srgb,currentColor 12%,transparent);white-space:nowrap}
.mv-select .props{display:flex;flex-direction:column;gap:3px;border-bottom:.5px solid var(--mv-line);padding:6px 0;min-height:0;max-height:220px;overflow:auto;scrollbar-width:thin}
.mv-select .props-title{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--mv-dim)}
.mv-select .coords{display:flex;align-items:center;gap:6px;margin:0 0 8px;font-size:11px;color:var(--mv-dim)}
.mv-select .coords code{flex:1;font-size:11px;font-variant-numeric:tabular-nums;color:var(--mv-text)}
.mv-select .props-more{margin:4px 0 0;font-size:10px;color:var(--mv-dim)}
.mv-sel-meta{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 7px}
.mv-sel-meta-chip{padding:2px 6px;border-radius:6px;font-size:10.5px;line-height:1.3;color:var(--mv-dim);background:color-mix(in srgb,var(--mv-lift) 72%,transparent);border:.5px solid var(--mv-line);white-space:nowrap}
.mv-sel-props-toggle{appearance:none;margin-top:4px;padding:3px 6px;border-radius:6px;border:.5px solid var(--mv-line);background:color-mix(in srgb,var(--mv-lift) 55%,transparent);color:var(--mv-accent);font:inherit;font-size:10.5px;font-weight:500;cursor:pointer;align-self:flex-start}
.mv-sel-props-toggle:hover{background:color-mix(in srgb,var(--mv-accent) 12%,transparent)}
.mv-sel-props-toggle:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-select .prop{display:flex;align-items:baseline;gap:8px;font-size:11px;min-width:0}
.mv-select .prop span{flex:none;max-width:42%;color:var(--mv-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-select .prop b{flex:1;min-width:0;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-sel-conf.high{color:#4ade80}
.mv-sel-conf.medium{color:#f0b84b}
.mv-sel-conf.low{color:#ff8b8b}
.mv-select .sampling{font-size:10px;color:var(--mv-dim);line-height:1.45}
.mv-select .footnote{margin:0;font-size:9.5px;line-height:1.45;color:color-mix(in srgb,var(--mv-dim) 78%,transparent)}
.mv-select .actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
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
.mv-tool-group{display:block;padding:8px 0 4px;border-top:.5px solid var(--mv-line);min-width:0}
.mv-tool-group:first-child{border-top:0;padding-top:4px}
.mv-tool-group>.mv-group-title{display:block;margin:0 0 5px;font-size:11px;line-height:1.4;color:var(--mv-dim);font-weight:600}
.mv-tool-group-body{display:flex;flex-direction:column;gap:5px;min-width:0}
.mv-tool-group-body>.mv-none,.mv-tool-group-body .mv-selection>.mv-none{margin:0;padding:1px 0 1px 8px;border-left:2px solid color-mix(in srgb,var(--mv-accent) 28%,var(--mv-line));font-size:11px;line-height:1.5;overflow-wrap:break-word}
.mv-tool-group-body>.mv-tool-grid{margin:3px 0 6px}
.mv-tool-group-body .mv-cta,.mv-selection-actions .mv-cta{box-sizing:border-box;min-height:0;font-size:11px;line-height:1.4}
.mv-tools .mv-cta{border:.5px solid var(--mv-line);border-radius:8px;box-shadow:none;word-break:normal}
.mv-tools .mv-cta[aria-pressed="true"]{border-color:var(--mv-accent);background:color-mix(in srgb,var(--mv-accent) 13%,var(--mv-glass));color:var(--mv-text);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--mv-accent) 22%,transparent)}
.mv-tool-group-body>.mv-cta{width:100%;white-space:normal;text-wrap:pretty;padding:5px 8px}
.mv-tool-group-body .mv-selection{margin:0;gap:5px;min-width:0}
.mv-selection-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
.mv-selection-modes .mv-cta{width:100%;padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-tools .mv-group-actions{display:flex;gap:6px}
.mv-tools .mv-sun{margin:0}
/* Toolbox v1.6: 2-column bento tile index; clicking a tile opens a pop-out ToolWindow. */
.mv-tool-index{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:8px 10px 10px;overflow:auto;min-height:0;scrollbar-width:thin}
@container (max-width: 240px){.mv-tool-index{grid-template-columns:minmax(0,1fr)}}
.mv-tool-entry{position:relative;appearance:none;display:flex;align-items:center;gap:7px;width:100%;min-width:0;border:.5px solid var(--mv-line);border-radius:10px;background:color-mix(in srgb,var(--mv-lift) 46%,transparent);color:var(--mv-text);font:inherit;font-size:11.5px;font-weight:500;padding:7px 8px;cursor:pointer;text-align:left;transition:background-color 140ms ease,border-color 140ms ease}
.mv-tool-entry:hover{background:color-mix(in srgb,var(--mv-lift) 85%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 28%,var(--mv-line))}
.mv-tool-entry.on{background:color-mix(in srgb,var(--mv-accent) 13%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 36%,transparent)}
.mv-tool-entry:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-tool-entry-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:color-mix(in srgb,var(--mv-dim) 12%,transparent);color:var(--mv-dim);flex:none}
.mv-tool-entry.on .mv-tool-entry-icon{background:color-mix(in srgb,var(--mv-accent) 18%,transparent);color:var(--mv-accent)}
.mv-tool-entry-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-tool-entry-dot{width:6px;height:6px;border-radius:999px;background:var(--mv-accent);flex:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--mv-accent) 22%,transparent)}
.mv-toolwin{width:100%;flex:0 1 auto;min-height:0;display:flex;flex-direction:column;border-radius:13px;overflow:hidden;border-top:2px solid color-mix(in srgb,var(--mv-accent) 55%,transparent)}
.mv-toolwin>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px 8px 12px;border-bottom:.5px solid var(--mv-line);flex-shrink:0;font-size:12px;font-weight:600;color:var(--mv-text)}
.mv-toolwin.minimized>header{border-bottom:0}
.mv-toolwin-title{display:inline-flex;align-items:center;gap:7px;min-width:0}
.mv-toolwin-badge{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:color-mix(in srgb,var(--mv-accent) 14%,transparent);color:var(--mv-accent);flex:none}
.mv-toolwin-title>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-toolwin-body{display:flex;flex-direction:column;gap:6px;padding:8px 12px 10px;overflow:auto;min-height:0;overscroll-behavior:contain;scrollbar-width:thin}
.mv-toolwin-body>.mv-tool-grid{margin:0}
.mv-toolwin-body .mv-cta{border:.5px solid var(--mv-line);border-radius:8px;font-size:11px;line-height:1.4}
.mv-toolwin-body .mv-cta[aria-pressed="true"]{border-color:var(--mv-accent);background:color-mix(in srgb,var(--mv-accent) 13%,var(--mv-glass))}
.mv-toolwin-body .mv-group-title{margin-top:4px}
.mv-profile-opts{display:flex;flex-direction:column;gap:4px;padding:6px 8px;border:.5px solid var(--mv-line);border-radius:8px;background:color-mix(in srgb,var(--mv-bg) 35%,transparent)}
.mv-profile-opt{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10.5px;color:var(--mv-dim)}
.mv-profile-opt span{flex:none}
.mv-profile-opt select{flex:1;min-width:0;max-width:170px;background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:3px 6px;font:inherit;font-size:10.5px}
.mv-tool-effects-list{display:flex;flex-direction:column;gap:3px;padding:2px 0}
.mv-tool-effects-list .mv-layer{min-height:26px;padding:4px 6px;display:flex;align-items:center;justify-content:space-between;gap:6px}
.mv-root.mv-docked .mv-toolwin{max-height:none}
.mv-bookmark-name{appearance:none;background:transparent;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:4px 0}
.mv-root :is(button,input,select,textarea):focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px}
.mv-data-panel{display:flex;flex-direction:column;min-height:0;overflow:auto;overscroll-behavior:contain}
.mv-select>*{flex-shrink:0}
.mv-select .layer,.mv-select .prop,.mv-select .fact{font-size:12px}
.mv-select .sampling,.mv-select .footnote,.mv-select .props-title,.mv-select .fact em{font-size:11px;line-height:1.5;color:var(--mv-dim)}
.mv-select .fact .mv-sel-conf{font-size:11px;line-height:1.2}
.mv-root .mv-sel-conf.high{color:light-dark(#167344,#76e0a4)}
.mv-root .mv-sel-conf.medium{color:light-dark(#8a5208,#f0be65)}
.mv-root .mv-sel-conf.low{color:light-dark(#b52b35,#ffadb4)}
.mv-swipe{position:absolute;inset:0;pointer-events:none;z-index:18;overflow:hidden}
.mv-swipe-line{position:absolute;background:var(--mv-accent,#38bdf8);box-shadow:0 0 8px rgba(0,0,0,.45)}
.mv-swipe.vert .mv-swipe-line{top:0;bottom:0;width:2px;transform:translateX(-1px)}
.mv-swipe.horiz .mv-swipe-line{left:0;right:0;height:2px;transform:translateY(-1px)}
.mv-swipe-handle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:999px;background:var(--mv-surface-hi,rgba(15,23,42,.92));border:1.5px solid var(--mv-accent,#38bdf8);color:var(--mv-fg,#f8fafc);display:flex;align-items:center;justify-content:center;font-size:13px;cursor:ew-resize;pointer-events:auto;user-select:none;box-shadow:0 2px 10px rgba(0,0,0,.4)}
.mv-swipe.horiz .mv-swipe-handle{cursor:ns-resize}
.mv-swipe-badge{position:absolute;padding:3px 8px;border-radius:999px;background:rgba(15,23,42,.82);color:#f8fafc;font-size:11px;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;border:.5px solid rgba(255,255,255,.18)}
.mv-swipe.vert .mv-swipe-badge.with{top:56px;right:10px}
.mv-swipe.vert .mv-swipe-badge.without{top:56px;left:10px}
.mv-swipe.horiz .mv-swipe-badge.with{left:16px;bottom:10px}
.mv-swipe.horiz .mv-swipe-badge.without{left:16px;top:10px}
.mv-swipe-bar{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;pointer-events:auto;font-size:12px}
.mv-swipe-title{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}
${VECTOR_CSS}
${VISION_CSS}
${SELECTION_QUESTION_CSS}
${PARSE_CSS}
@container (max-width:480px){
  .mv-root.mv-docked .mv-right{left:12px;right:12px;width:auto;max-height:calc(100% - 132px)}
  .mv-root.mv-docked .mv-shader{box-sizing:border-box;left:12px;right:12px;width:auto;max-height:calc(100% - 132px)}
  .mv-root.mv-docked .mv-tools{max-height:none}
  .mv-root .mv-select,.mv-root .mv-vector-card{left:12px;right:12px;width:auto;margin:0;bottom:16px;max-height:calc(100% - 132px)}
  .mv-root:has(.mv-shader) .mv-right,.mv-root:has(.mv-select) .mv-right,.mv-root:has(.mv-select) .mv-shader{visibility:hidden;pointer-events:none}
  .mv-root:has(.mv-vector-card) :is(.mv-right,.mv-shader,.mv-select),.mv-root:has(.mv-scene-details) :is(.mv-right,.mv-shader,.mv-select,.mv-vector-card){visibility:hidden;pointer-events:none}
  .mv-root .mv-select .actions .mv-cta{flex:1 1 100px;min-height:36px}
}
@media(pointer:coarse){
  .mv-root .mv-icon-btn{width:44px;height:44px}
  .mv-root .mv-layer{flex-wrap:wrap}
  .mv-root .mv-cta,.mv-root .mv-layer-tab{min-height:44px}
}
@media(prefers-reduced-motion:reduce){.mv-root *,.mv-root *::before,.mv-root *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`
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
.mv-toolrow .thumb{flex:none;display:inline-flex;margin-left:8px;width:40px;height:24px;overflow:hidden;border-radius:4px;border:.5px solid var(--dsw-alias-border-l1,#d0d4da);background:var(--dsw-alias-bg-base,transparent)}
.mv-toolrow .thumb img{display:block;width:100%;height:100%;object-fit:cover}
`

export { CSS, TOOL_CSS }
