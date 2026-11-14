export const VECTOR_CSS = `
.mv-elevation-legend{padding:12px;border:1px solid var(--mv-line);border-radius:9px;background:var(--mv-glass-strong);font-size:12px;line-height:1.5}
.mv-elevation-legend p{margin:0 0 8px;color:var(--mv-dim)}
.mv-elevation-legend .ramp{height:10px;border-radius:4px;background:linear-gradient(90deg,#172466,#147db3 25%,#3dcc99 50%,#fcc951 75%,#f05c4d)}
.mv-elevation-legend .ticks{display:flex;justify-content:space-between;gap:8px;margin:5px 0 9px;font-variant-numeric:tabular-nums;color:var(--mv-text);font-size:11px}
.mv-elevation-legend .warning{color:#d48222}
.mv-elevation-legend .mv-cta{width:100%;font-size:12px}
.mv-vector-labels{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden}
.mv-vector-label{position:absolute;box-sizing:border-box;appearance:none;pointer-events:auto;max-width:calc(100% - 16px);margin:0;padding:7px 11px;border:1px solid #cad7e3;border-radius:8px;background:#fcfdff;color:#20344c;font:500 13px/19px "Segoe UI","Microsoft YaHei","PingFang SC",sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px #07152926,0 1px 2px #07152914;cursor:pointer;transition:background .14s ease-out,border-color .14s ease-out,box-shadow .14s ease-out}
.mv-vector-label[data-style]{border-left:3.5px solid var(--mv-label-accent,#5796cb)}
.mv-vector-label[data-kind="note"]{font-weight:600;border-left-width:4px}
.mv-vector-label[hidden]{display:none}
.mv-vector-label:disabled{pointer-events:none;cursor:default}
.mv-vector-label[data-state="hover"],.mv-vector-label[data-state="selected"]{border-color:#5796cb;background:#edf6ff;box-shadow:0 0 0 2px #79b6e83d,0 3px 12px #07152933}
.mv-vector-label:focus-visible{outline:2px solid #5796cb;outline-offset:2px}
.mv-root[data-mv-scheme="dark"] .mv-vector-label{background:#17212f;color:#edf5ff;border-color:#3c4d63;box-shadow:0 2px 8px #0006}
.mv-root[data-mv-scheme="dark"] .mv-vector-label:is([data-state="hover"],[data-state="selected"]){background:#223b53;border-color:#79b6e8}
.mv-vector-hovering .cesium-widget canvas{cursor:pointer}
.mv-vector-card{position:absolute;left:12px;bottom:48px;z-index:13;box-sizing:border-box;width:min(344px,calc(100% - 24px));max-height:min(520px,68%);overflow:auto;padding:16px;border:1px solid var(--mv-line);border-radius:12px;background:var(--mv-glass-strong);box-shadow:var(--mv-shadow);font-size:13px;line-height:1.6;animation:mv-fade .16s ease-out}
.mv-vector-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.mv-vector-card .eyebrow{display:block;font-size:11px;color:var(--mv-dim);margin-bottom:3px}
.mv-vector-card h3{margin:0;font-size:15px;font-weight:600;overflow-wrap:anywhere}
.mv-vector-card .summary{margin:10px 0;color:var(--mv-text);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.mv-vector-card dl{margin:10px 0}
.mv-vector-card dl>div{display:grid;grid-template-columns:minmax(60px,1fr) minmax(0,2fr);gap:12px;border-top:1px solid var(--mv-line);padding:6px 0}
.mv-vector-card dt{color:var(--mv-dim);overflow-wrap:anywhere}
.mv-vector-card dd{margin:0;overflow-wrap:anywhere}
.mv-vector-card footer{margin-top:10px;padding-top:10px;border-top:1px solid var(--mv-line);font-size:11px;color:var(--mv-dim)}
.mv-vector-card .mv-vector-edit{display:grid;gap:10px;margin:10px 0}
.mv-vector-card .mv-vector-edit label,.mv-vector-field{display:grid;gap:4px}
.mv-vector-card .mv-vector-edit label>span,.mv-vector-field-label{font-size:11px;color:var(--mv-dim)}
.mv-vector-card .mv-vector-edit input:not([type="checkbox"]),.mv-vector-card .mv-vector-edit textarea,.mv-vector-card .mv-vector-edit select{width:100%;box-sizing:border-box;border:1px solid var(--mv-line);border-radius:7px;background:var(--mv-lift);color:var(--mv-text);font:inherit;font-size:12px;padding:6px 8px;resize:vertical}
.mv-vector-card .mv-vector-edit select{cursor:pointer}
.mv-vector-card .mv-vector-edit input:focus-visible,.mv-vector-card .mv-vector-edit textarea:focus-visible,.mv-vector-card .mv-vector-edit select:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-vector-row-2{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.25fr);gap:10px;align-items:end}
.mv-swatch-row{display:flex;align-items:center;gap:7px;min-height:30px}
.mv-swatch{appearance:none;position:relative;width:20px;height:20px;padding:0;border-radius:999px;border:2px solid transparent;background:var(--mv-swatch,#38c9ff);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.mv-swatch:hover{transform:scale(1.1)}
.mv-swatch.on{border-color:#fff;box-shadow:0 0 0 2px var(--mv-swatch,#38c9ff)}
.mv-root[data-mv-scheme="dark"] .mv-swatch.on{border-color:#0f172a}
.mv-swatch:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px}
.mv-anno-palette{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;margin-top:4px;border:1px solid var(--mv-line);border-radius:8px;background:color-mix(in srgb,var(--mv-lift) 65%,transparent)}
.mv-anno-palette-label{font-size:11px;color:var(--mv-dim);white-space:nowrap}
.mv-extrude-box{display:grid;gap:7px;padding:8px 10px;border:1px solid var(--mv-line);border-radius:8px;background:color-mix(in srgb,var(--mv-lift) 60%,transparent)}
.mv-extrude-toggle{display:flex!important;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--mv-text)!important}
.mv-extrude-toggle input{appearance:auto;width:14px;height:14px;margin:0;cursor:pointer}
.mv-extrude-toggle span{font-size:12px!important;color:var(--mv-text)!important;font-weight:500}
.mv-extrude-height{display:grid;grid-template-columns:1fr 96px;align-items:center;gap:8px}
.mv-extrude-hint{font-size:11px;color:var(--mv-dim);line-height:1.45}
.mv-vector-shortcuts{margin:8px 0 0;padding:7px 9px;border-radius:8px;background:color-mix(in srgb,var(--mv-accent) 10%,transparent);border:1px solid color-mix(in srgb,var(--mv-accent) 26%,transparent);color:var(--mv-text);font-size:11px;line-height:1.45}
.mv-point-coords{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mv-attr-box{display:grid;gap:7px;padding:8px 10px;border:1px solid var(--mv-line);border-radius:8px;background:color-mix(in srgb,var(--mv-lift) 55%,transparent)}
.mv-attr-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mv-attr-toggle{display:inline-flex;align-items:center;gap:5px;padding:0;border:0;background:none;color:var(--mv-text);font:inherit;font-size:11.5px;font-weight:500;cursor:pointer}
.mv-attr-add{padding:2px 7px;border:1px solid var(--mv-line);border-radius:6px;background:var(--mv-lift);color:var(--mv-text);font:inherit;font-size:11px;cursor:pointer}
.mv-attr-add:hover{border-color:color-mix(in srgb,var(--mv-accent) 40%,var(--mv-line))}
.mv-attr-list{display:grid;gap:6px}
.mv-attr-row{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr) auto;gap:6px;align-items:center}
.mv-attr-json{font-size:11px;color:var(--mv-dim);padding:5px 7px;border:1px solid var(--mv-line);border-radius:7px;background:var(--mv-glass);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-attr-hint{font-size:11px;color:var(--mv-dim);line-height:1.4}
.mv-overlay-toggle{flex:0 0 auto;width:20px;height:20px;font-size:11px}
.mv-overlay-features{display:grid;gap:2px;margin:2px 0 6px 14px;padding-left:8px;border-left:1px solid var(--mv-line)}
.mv-overlay-feature{display:flex;align-items:center;gap:4px;min-width:0}
.mv-overlay-feature-pick{flex:1;min-width:0;display:flex;align-items:center;gap:6px;padding:4px 6px;border:0;border-radius:6px;background:transparent;color:var(--mv-text);font:inherit;font-size:11.5px;text-align:left;cursor:pointer}
.mv-overlay-feature-pick:hover{background:color-mix(in srgb,var(--mv-lift) 70%,transparent)}
.mv-overlay-feature-dot{width:7px;height:7px;border-radius:999px;flex:0 0 auto}
.mv-overlay-feature-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-overlay-feature-meta{font-size:10px;color:var(--mv-accent);font-variant-numeric:tabular-nums;white-space:nowrap;flex:0 0 auto}
.mv-overlay-feature-tag{font-size:10px;color:var(--mv-dim);flex:0 0 auto}
.mv-layer-dim-btn{min-block-size:24px;min-inline-size:28px;padding:0 5px;border-radius:6px;border:1px solid var(--mv-line);font-size:10px;font-weight:700;letter-spacing:.02em;color:var(--mv-dim)}
.mv-layer-dim-btn.on{border-color:color-mix(in srgb,var(--mv-accent) 60%,transparent);background:color-mix(in srgb,var(--mv-accent) 18%,transparent);color:var(--mv-fg)}
.mv-layer-dim-btn:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px}
@media(forced-colors:active){.mv-layer-dim-btn.on{border:2px solid Highlight;color:HighlightText;background:Highlight}}
.mv-vector-card .mv-vector-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.mv-vector-card .mv-btn.mv-danger{color:#fca5a5}
.mv-vector-card .mv-btn.mv-danger:hover{background:color-mix(in srgb,#f87171 22%,transparent)}
.mv-vector-card .mv-btn:disabled{opacity:.45;cursor:default}
.mv-vertex-layer{position:absolute;inset:0;z-index:12;pointer-events:none;overflow:hidden}
.mv-vertex{position:absolute;left:0;top:0;box-sizing:border-box;width:13px;height:13px;margin:-7px 0 0 -7px;border:2px solid #f8fafc;border-radius:50%;background:#f59e0b;box-shadow:0 1px 4px #07152966;pointer-events:auto;cursor:grab;touch-action:none}
.mv-vertex:hover,.mv-vertex:active{background:#fbbf24}
.mv-vertex:active{cursor:grabbing}
.mv-vertex.center{width:0;height:0;margin:0;border:0;background:none;box-shadow:none;cursor:move}
.mv-vertex.center::before{content:'';position:absolute;left:-8px;top:-8px;width:16px;height:16px;box-sizing:border-box;border:2px solid #0f172a;border-radius:3px;background:#7dd3fc;transform:rotate(45deg);box-shadow:0 1px 4px #07152966}
.mv-vertex.center:hover::before{background:#bae6fd}
.mv-root[data-mv-scheme="dark"] .mv-vertex{border-color:#0f172a}
.mv-capturing .mv-vertex-layer,.mv-capturing .mv-vector-card{visibility:hidden}
.mv-pick{font-size:13px;line-height:1.6}
.mv-pick td{padding:5px 8px;font-size:12px}
.mv-analysis .stat{font-size:12.5px;line-height:1.65}
.mv-analysis .chart text{font-size:10px;font-weight:500}
.mv-sel-anchor .chip{font-size:12px;padding:4px 8px;border-radius:7px;border-width:1px}
@media(prefers-reduced-motion:reduce){.mv-vector-label{transition:none}.mv-vector-card{animation:none}}
`
