/**
 * ui/compare-css.js — stylesheet fragment for the Scene Compare floating panel
 * and the upgraded dual-layer swipe bar. Appended inside ui/css.js.
 */

export const COMPARE_CSS = `
.mv-root.mv-capturing .mv-swipe{visibility:hidden!important}
.mv-swipe-select{max-width:140px;background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:7px;padding:4px 7px;font:inherit;font-size:11px;outline:none}
.mv-swipe-select:focus{border-color:var(--mv-accent)}
.mv-swipe-pct{font-size:11px;color:var(--mv-dim);font-variant-numeric:tabular-nums;padding:0 2px}
.mv-compare{flex:1 1 auto;display:flex;flex-direction:column;gap:8px;min-width:0;accent-color:var(--mv-accent)}
.mv-compare-sec{display:flex;flex-direction:column;gap:6px;padding-top:7px;border-top:.5px solid var(--mv-line);min-width:0}
.mv-compare-sec:first-child{border-top:0;padding-top:0}
.mv-compare-sec-head{display:flex;align-items:center;justify-content:space-between;gap:6px}
.mv-compare-sec-title{font-size:11px;font-weight:600;color:var(--mv-dim)}
.mv-compare-field{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--mv-dim);min-width:0}
.mv-compare-field>span{flex:none}
.mv-compare-field select,.mv-compare-field input[type="number"]{flex:1;min-width:0;max-width:185px;background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:4px 7px;font:inherit;font-size:11px;outline:none}
.mv-compare-field select:focus,.mv-compare-field input[type="number"]:focus{border-color:var(--mv-accent)}
.mv-compare-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.mv-compare-row .mv-cta{flex:1;min-width:0;padding:5px 8px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-compare-slider-row{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--mv-dim)}
.mv-compare-slider-row input[type="range"]{flex:1;min-width:0;accent-color:var(--mv-accent);cursor:pointer}
.mv-compare-slider-row b{font-variant-numeric:tabular-nums;color:var(--mv-text);font-weight:600;min-width:34px;text-align:right}
.mv-compare-toggles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
.mv-compare-toggles .mv-cta{padding:5px 7px;font-size:11px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-compare-sse-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.mv-compare-sse-pill{appearance:none;border:.5px solid var(--mv-line);background:transparent;color:var(--mv-dim);border-radius:6px;padding:2px 7px;font:inherit;font-size:10.5px;cursor:pointer;font-variant-numeric:tabular-nums}
.mv-compare-sse-pill:hover{border-color:var(--mv-accent);color:var(--mv-text)}
.mv-compare-sse-pill.on{background:color-mix(in srgb,var(--mv-accent) 18%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 50%,transparent);color:var(--mv-text);font-weight:600}
.mv-compare-sse-input{width:54px;background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:6px;padding:2px 5px;font:inherit;font-size:11px;text-align:right;font-variant-numeric:tabular-nums;margin-left:auto}
.mv-compare-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 8px;padding:5px 7px;border:.5px solid var(--mv-line);border-radius:8px;background:color-mix(in srgb,var(--mv-bg) 42%,transparent);font-size:10.5px;color:var(--mv-dim);font-variant-numeric:tabular-nums}
.mv-compare-stats span{display:flex;align-items:baseline;justify-content:space-between;gap:4px;min-width:0}
.mv-compare-stats b{color:var(--mv-text);font-weight:600}
.mv-compare-checks{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.mv-compare-check{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--mv-dim);cursor:pointer}
.mv-compare-check input{accent-color:var(--mv-accent);margin:0}
.mv-compare-pose-box{display:flex;flex-direction:column;gap:5px}
.mv-compare-pose-box textarea{width:100%;box-sizing:border-box;min-height:86px;resize:vertical;background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:7px;padding:6px 8px;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}
.mv-compare-pose-box textarea:focus{border-color:var(--mv-accent)}
.mv-compare-sec:last-child{flex:1 1 auto}
.mv-compare-status{margin-top:auto;min-height:14px;font-size:10.5px;line-height:1.4;color:var(--mv-dim)}
.mv-compare-warn{margin:0;font-size:10.5px;line-height:1.45;color:color-mix(in srgb,#f0b84b 72%,var(--mv-text))}
`
