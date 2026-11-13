/**
 * ui/parse-css.js — F6 scene-parse panel styles.
 * Same conventions as vector-css.js: one compressed rule per line, injected by
 * ui/css.js so the panel does not ship inline styles.
 */
export const PARSE_CSS = `
.mv-parse{display:flex;flex-direction:column;gap:8px}
.mv-parse-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11px;color:var(--mv-dim)}
.mv-parse-controls{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}
.mv-parse-filters{display:inline-flex;align-items:center;gap:4px}
.mv-parse-filter{appearance:none;padding:3px 7px;border-radius:999px;border:.5px solid var(--mv-line);background:transparent;color:var(--mv-dim);font:inherit;font-size:10.5px;cursor:pointer}
.mv-parse-filter.on{background:color-mix(in srgb,#c084fc 18%,transparent);border-color:color-mix(in srgb,#c084fc 45%,transparent);color:var(--mv-fg);font-weight:600}
.mv-parse-toggle{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--mv-dim);cursor:pointer;user-select:none}
.mv-parse-toggle input{accent-color:#c084fc;margin:0}
.mv-parse-count{font-weight:600;color:var(--mv-fg)}
.mv-parse-list{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow:auto;padding:2px;border-radius:8px;background:rgba(148,163,184,.08)}
.mv-parse-row{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:6px;font-size:12px;cursor:pointer}
.mv-parse-row:hover{background:rgba(148,163,184,.14)}
.mv-parse-row.on{background:color-mix(in srgb,#c084fc 16%,transparent)}
.mv-parse-row input{accent-color:#c084fc;margin:0}
.mv-parse-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-parse-metrics{font-size:10px;color:var(--mv-accent);font-variant-numeric:tabular-nums;white-space:nowrap}
.mv-parse-conf{font-size:11px;color:var(--mv-dim);font-variant-numeric:tabular-nums;white-space:nowrap}
.mv-parse .mv-actions{display:flex;gap:6px;flex-wrap:wrap}
.mv-parse .mv-warn{margin:0}
`
