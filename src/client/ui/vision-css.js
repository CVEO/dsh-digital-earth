export const VISION_CSS = `
.mv-vision-screen{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:12px;background:var(--mv-scrim);box-sizing:border-box;pointer-events:auto}
.mv-vision{box-sizing:border-box;display:flex;flex-direction:column;gap:10px;width:min(560px,100%);max-height:100%;overflow:auto;overscroll-behavior:contain;padding:16px;border-radius:14px;background:var(--mv-glass-strong);border:1px solid var(--mv-line);box-shadow:var(--mv-shadow);color:var(--mv-text);outline:none;animation:mv-fade .16s ease-out}
.mv-vision>*{flex-shrink:0;min-width:0}
.mv-vision header{display:flex;align-items:center;justify-content:space-between;gap:12px}
.mv-vision h3{margin:0;font-size:15px;line-height:1.4}
.mv-vision p{margin:0;overflow-wrap:anywhere}
.mv-vision-note{font-size:12px;line-height:1.6;color:var(--mv-dim)}
.mv-vision-image{position:relative;width:100%;overflow:hidden;border-radius:8px;background:#0b111a}
.mv-vision-image img,.mv-vision-image svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.mv-vision-image polygon{fill:#39b7ff30;stroke:#70d8ff;stroke-width:3;stroke-linejoin:round;filter:drop-shadow(0 1px 2px #000)}
.mv-vision-image circle{fill:#fff;stroke:#092638;stroke-width:2}
.mv-vision-status{font-size:13px;line-height:1.5}
.mv-vision-error{font-size:13px;line-height:1.5;color:light-dark(#a52f37,#ffadb4)}
.mv-vision-actions{display:flex;flex-wrap:wrap;gap:8px}
.mv-vision-actions .mv-cta{flex:1 1 120px;min-height:38px;font-size:12px}
.mv-root:has(.mv-vision-screen) :is(.mv-top,.mv-right,.mv-shader,.mv-tour,.mv-scene-details){visibility:hidden;pointer-events:none}
.mv-root.mv-capturing .mv-vision-screen{visibility:hidden!important}
`
