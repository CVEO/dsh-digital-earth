export const VISION_CSS = `
.mv-vision-screen{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:12px;background:var(--mv-scrim);box-sizing:border-box;pointer-events:auto}
.mv-vision{box-sizing:border-box;display:flex;flex-direction:column;gap:10px;width:min(560px,100%);max-height:100%;overflow:auto;overscroll-behavior:contain;padding:16px;border-radius:14px;background:var(--mv-glass-strong);border:1px solid var(--mv-line);box-shadow:var(--mv-shadow);color:var(--mv-text);outline:none;animation:mv-fade .16s ease-out}
.mv-vision>*{flex-shrink:0;min-width:0}
.mv-vision header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mv-vision-head-actions{display:flex;align-items:center;gap:6px}
.mv-vision h3{margin:0;font-size:15px;line-height:1.4}
.mv-vision p{margin:0;overflow-wrap:anywhere}
.mv-vision-note{font-size:12px;line-height:1.6;color:var(--mv-dim)}
.mv-vision-image{position:relative;width:100%;overflow:hidden;border-radius:8px;background:#0b111a;touch-action:none}
.mv-vision-image img,.mv-vision-image svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.mv-vision-image polygon{fill:#39b7ff30;stroke:#70d8ff;stroke-width:3;stroke-linejoin:round;filter:drop-shadow(0 1px 2px #000)}
.mv-vision-image circle{fill:#fff;stroke:#092638;stroke-width:2}
.mv-vision-image circle.mv-vision-handle{fill:#70d8ff;stroke:#092638;stroke-width:2;cursor:grab}
.mv-vision-image circle.mv-vision-handle:active{cursor:grabbing;fill:#fff}
.mv-vision-busy-badge{position:absolute;left:10px;bottom:10px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:var(--mv-glass-strong);color:var(--mv-text);border:1px solid var(--mv-line);font-size:11px;line-height:1.4;backdrop-filter:blur(6px);pointer-events:none}
.mv-vision-busy-dot{width:7px;height:7px;border-radius:50%;background:#70d8ff;animation:mv-pulse 1.1s ease-in-out infinite}
@keyframes mv-pulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
.mv-vision-status{font-size:13px;line-height:1.5}
.mv-vision-error{font-size:13px;line-height:1.5;color:light-dark(#a52f37,#ffadb4)}
.mv-vision-diag{font-size:11px;line-height:1.5;color:var(--mv-dim);padding:6px 10px;border-radius:8px;border:1px solid var(--mv-line);background:color-mix(in srgb,var(--mv-glass) 70%,transparent)}
.mv-vision-diag summary{cursor:pointer;font-weight:500;color:var(--mv-text)}
.mv-vision-diag pre{margin:6px 0 0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.mv-vision-cfg{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:10px;border:1px solid var(--mv-line);background:color-mix(in srgb,var(--mv-glass) 75%,transparent)}
.mv-vision-cfg label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--mv-dim)}
.mv-vision-cfg input,.mv-vision-cfg select{box-sizing:border-box;width:100%;padding:6px 8px;border-radius:7px;border:1px solid var(--mv-line);background:var(--mv-bg,transparent);color:var(--mv-text);font-size:12px}
.mv-vision-cfg-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mv-vision-actions{display:flex;flex-wrap:wrap;gap:8px}
.mv-vision-actions .mv-cta{flex:1 1 120px;min-height:38px;font-size:12px}
.mv-root:has(.mv-vision-screen) :is(.mv-top,.mv-right,.mv-shader,.mv-tour,.mv-scene-details,.mv-floating,.mv-toolwin){visibility:hidden;pointer-events:none}
`
