export const VECTOR_CSS = `
.mv-elevation-legend{padding:12px;border:1px solid var(--mv-line);border-radius:9px;background:var(--mv-glass-strong);font-size:12px;line-height:1.5}
.mv-elevation-legend p{margin:0 0 8px;color:var(--mv-dim)}
.mv-elevation-legend .ramp{height:10px;border-radius:4px;background:linear-gradient(90deg,#172466,#147db3 25%,#3dcc99 50%,#fcc951 75%,#f05c4d)}
.mv-elevation-legend .ticks{display:flex;justify-content:space-between;gap:8px;margin:5px 0 9px;font-variant-numeric:tabular-nums;color:var(--mv-text);font-size:11px}
.mv-elevation-legend .warning{color:#d48222}
.mv-elevation-legend .mv-cta{width:100%;font-size:12px}
.mv-vector-labels{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden}
.mv-vector-label{position:absolute;box-sizing:border-box;appearance:none;pointer-events:auto;max-width:calc(100% - 16px);margin:0;padding:7px 11px;border:1px solid #cad7e3;border-radius:8px;background:#fcfdff;color:#20344c;font:500 13px/19px "Segoe UI","Microsoft YaHei","PingFang SC",sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px #07152926,0 1px 2px #07152914;cursor:pointer;transition:background .14s ease-out,border-color .14s ease-out,box-shadow .14s ease-out}
.mv-vector-label[hidden]{display:none}
.mv-vector-label:disabled{pointer-events:none;cursor:default}
.mv-vector-label[data-state="hover"],.mv-vector-label[data-state="selected"]{border-color:#5796cb;background:#edf6ff;box-shadow:0 0 0 2px #79b6e83d,0 3px 12px #07152933}
.mv-vector-label:focus-visible{outline:2px solid #5796cb;outline-offset:2px}
.mv-root[data-mv-scheme="dark"] .mv-vector-label{background:#17212f;color:#edf5ff;border-color:#3c4d63;box-shadow:0 2px 8px #0006}
.mv-root[data-mv-scheme="dark"] .mv-vector-label:is([data-state="hover"],[data-state="selected"]){background:#223b53;border-color:#79b6e8}
.mv-vector-hovering .cesium-widget canvas{cursor:pointer}
.mv-vector-card{position:absolute;left:12px;bottom:48px;z-index:13;box-sizing:border-box;width:min(320px,calc(100% - 24px));max-height:45%;overflow:auto;padding:16px;border:1px solid var(--mv-line);border-radius:12px;background:var(--mv-glass-strong);box-shadow:var(--mv-shadow);font-size:13px;line-height:1.6;animation:mv-fade .16s ease-out}
.mv-vector-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.mv-vector-card .eyebrow{display:block;font-size:11px;color:var(--mv-dim);margin-bottom:3px}
.mv-vector-card h3{margin:0;font-size:15px;font-weight:600;overflow-wrap:anywhere}
.mv-vector-card .summary{margin:12px 0;color:var(--mv-text);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.mv-vector-card dl{margin:12px 0}
.mv-vector-card dl>div{display:grid;grid-template-columns:minmax(60px,1fr) minmax(0,2fr);gap:12px;border-top:1px solid var(--mv-line);padding:6px 0}
.mv-vector-card dt{color:var(--mv-dim);overflow-wrap:anywhere}
.mv-vector-card dd{margin:0;overflow-wrap:anywhere}
.mv-vector-card footer{margin-top:12px;padding-top:10px;border-top:1px solid var(--mv-line);font-size:11px;color:var(--mv-dim)}
.mv-vector-card .mv-vector-edit{display:grid;gap:10px;margin:12px 0}
.mv-vector-card .mv-vector-edit label{display:grid;gap:4px}
.mv-vector-card .mv-vector-edit label>span{font-size:11px;color:var(--mv-dim)}
.mv-vector-card .mv-vector-edit input,.mv-vector-card .mv-vector-edit textarea{width:100%;box-sizing:border-box;border:1px solid var(--mv-line);border-radius:7px;background:var(--mv-lift);color:var(--mv-text);font:inherit;font-size:12px;padding:6px 8px;resize:vertical}
.mv-vector-card .mv-vector-edit input:focus-visible,.mv-vector-card .mv-vector-edit textarea:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
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
