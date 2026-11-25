/**
 * ui/parse-css.js — F6 scene-parse panel styles.
 * Same conventions as vector-css.js: one compressed rule per line, injected by
 * ui/css.js so the panel does not ship inline styles.
 */
export const PARSE_CSS = `
.mv-parse{flex:1 1 auto;display:flex;flex-direction:column;gap:8px;min-height:0}
.mv-parse-scope{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.mv-parse-scope-btn{appearance:none;min-block-size:28px;padding:4px 8px;border-radius:7px;border:1px solid var(--mv-line);background:transparent;color:var(--mv-dim);font:inherit;font-size:11.5px;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.mv-parse-scope-btn.on{background:color-mix(in srgb,var(--mv-accent) 18%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 55%,transparent);color:var(--mv-fg);font-weight:600}
.mv-parse-scope-btn:disabled{opacity:.45;cursor:not-allowed}
.mv-parse-scope-btn:focus-visible,.mv-parse-filter:focus-visible,.mv-parse-sort-btn:focus-visible,.mv-parse-target:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px}
.mv-parse-aoi-box{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:8px;border:.5px solid var(--mv-line);background:color-mix(in srgb,var(--mv-lift) 45%,transparent)}
.mv-parse-aoi-bar{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;padding:6px 8px;border-radius:8px;border:.5px solid color-mix(in srgb,var(--mv-accent) 36%,var(--mv-line));background:color-mix(in srgb,var(--mv-accent) 10%,transparent);font-size:11px;color:var(--mv-text)}
.mv-parse-aoi-bar-info{display:inline-flex;align-items:center;gap:6px;font-weight:500;font-variant-numeric:tabular-nums}
.mv-parse-aoi-bar-dot{width:7px;height:7px;border-radius:50%;background:var(--mv-accent);flex:none}
.mv-parse-aoi-bar-actions{display:inline-flex;align-items:center;gap:4px}
.mv-parse-mini-btn{appearance:none;border:.5px solid var(--mv-line);background:var(--mv-lift);color:var(--mv-text);border-radius:6px;padding:2px 7px;font:inherit;font-size:10.5px;cursor:pointer}
.mv-parse-mini-btn:hover{border-color:var(--mv-accent)}
.mv-parse-targets{display:flex;flex-direction:column;gap:5px}
.mv-parse-sec-label{font-size:10.5px;font-weight:600;color:var(--mv-dim)}
.mv-parse-target-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.mv-parse-target{appearance:none;display:inline-flex;align-items:center;gap:4px;min-block-size:24px;padding:3px 8px;border-radius:999px;border:.5px solid var(--mv-line);background:transparent;color:var(--mv-dim);font:inherit;font-size:11px;cursor:pointer}
.mv-parse-target.on{background:color-mix(in srgb,var(--mv-accent) 16%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 50%,transparent);color:var(--mv-fg);font-weight:600}
.mv-parse-run-row{display:flex;align-items:center;gap:6px}
.mv-parse-run-row>.mv-cta.primary{flex:1}
.mv-parse-diag{display:flex;flex-direction:column;gap:6px;padding:8px 9px;border-radius:8px;border:.5px solid color-mix(in srgb,#f0b84b 42%,var(--mv-line));background:color-mix(in srgb,#f0b84b 10%,transparent);font-size:11px;line-height:1.45;color:var(--mv-text)}
.mv-parse-diag-thumb{display:flex;flex-direction:column;gap:3px}
.mv-parse-diag-thumb img{display:block;width:100%;max-height:110px;object-fit:contain;border-radius:6px;border:.5px solid var(--mv-line);background:#090d16}
.mv-parse-diag-thumb span{font-size:10px;color:var(--mv-dim);font-variant-numeric:tabular-nums}
.mv-parse-foot{margin:auto 0 0;padding-top:6px;font-size:10.5px;line-height:1.45;color:var(--mv-dim)}
.mv-parse-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11px;color:var(--mv-dim);flex-wrap:wrap}
.mv-parse-aoi-tag{padding:1px 6px;border-radius:999px;border:1px solid color-mix(in srgb,var(--mv-accent) 45%,transparent);background:color-mix(in srgb,var(--mv-accent) 14%,transparent);color:var(--mv-fg);font-size:10px}
.mv-parse-controls{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}
.mv-parse-filters,.mv-parse-sort{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap}
.mv-parse-filter,.mv-parse-sort-btn{appearance:none;display:inline-flex;align-items:center;gap:4px;min-block-size:24px;padding:3px 7px;border-radius:999px;border:.5px solid var(--mv-line);background:transparent;color:var(--mv-dim);font:inherit;font-size:10.5px;cursor:pointer}
.mv-parse-filter.on,.mv-parse-sort-btn.on{background:color-mix(in srgb,#c084fc 18%,transparent);border-color:color-mix(in srgb,#c084fc 45%,transparent);color:var(--mv-fg);font-weight:600}
.mv-parse-toggle{display:inline-flex;align-items:center;gap:5px;min-block-size:24px;font-size:11px;color:var(--mv-dim);cursor:pointer;user-select:none}
.mv-parse-toggle input{accent-color:#c084fc;margin:0}
.mv-parse-count{font-weight:600;color:var(--mv-fg)}
.mv-parse-list{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow:auto;padding:2px;border-radius:8px;background:rgba(148,163,184,.08)}
.mv-parse-row{display:flex;align-items:center;gap:6px;min-block-size:26px;padding:5px 7px;border-radius:6px;font-size:12px;cursor:pointer}
.mv-parse-row:hover{background:rgba(148,163,184,.14)}
.mv-parse-row.on{background:color-mix(in srgb,#c084fc 16%,transparent)}
.mv-parse-row input{accent-color:#c084fc;margin:0}
.mv-parse-dot{width:8px;height:8px;border-radius:999px;flex:0 0 auto;border:1px solid rgba(255,255,255,.35)}
.mv-parse-class{font-size:10px;color:var(--mv-dim);padding:1px 5px;border-radius:4px;border:1px solid var(--mv-line);white-space:nowrap;flex:0 0 auto}
.mv-parse-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-parse-metrics{font-size:10px;color:var(--mv-accent);font-variant-numeric:tabular-nums;white-space:nowrap}
.mv-parse-conf{font-size:11px;color:var(--mv-dim);font-variant-numeric:tabular-nums;white-space:nowrap}
.mv-parse .mv-actions{display:flex;gap:6px;flex-wrap:wrap}
.mv-parse .mv-warn{margin:0}
@media(forced-colors:active){.mv-parse-scope-btn.on,.mv-parse-filter.on,.mv-parse-sort-btn.on,.mv-parse-target.on{border:2px solid Highlight;color:HighlightText;background:Highlight}}
`
