/**
 * ui/parse-css.js — 2D extraction workbench styles.
 *
 * One compressed rule per line, injected by ui/css.js. Every colour comes from a
 * `--mv-*` token so the panel follows the host theme; the only literal values are
 * transparent/currentColor. The layout is container-relative: the right dock can
 * shrink to ~300 px without a horizontal scrollbar, so chips wrap and the class /
 * area cells ellipsize instead of pushing the row actions off-screen.
 */
export const PARSE_CSS = `
.mv-parse{display:flex;flex-direction:column;gap:6px;min-width:0;min-height:0;flex:1 1 auto}
.mv-parse-workbench{container-type:inline-size;gap:8px}
.mv-parse-head{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}
.mv-parse-title{font-size:11.5px;font-weight:600;color:var(--mv-text);white-space:nowrap}
.mv-parse-model{margin:0;padding:6px 8px;border:1px solid var(--mv-line);border-radius:7px;min-width:0;display:grid;gap:5px;color:var(--mv-text)}
.mv-parse-model legend{padding:0 4px;font-weight:600}
.mv-parse-model-field{display:grid;grid-template-columns:minmax(50px,auto) minmax(0,1fr);gap:7px;align-items:center;color:var(--mv-dim);font-size:11px}
.mv-parse-model-field input,.mv-parse-model-field select{box-sizing:border-box;width:100%;min-width:0;max-inline-size:none;min-height:26px;border-radius:5px}
.mv-parse-model-field select{appearance:auto}
.mv-parse-model-apply,.mv-parse-scale{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mv-parse-sec{display:flex;flex-direction:column;gap:4px;min-width:0}
.mv-parse-sec-label{font-size:10.5px;font-weight:600;color:var(--mv-dim)}
.mv-parse-note{font-size:10.5px;line-height:1.4;color:var(--mv-dim);overflow-wrap:anywhere}
.mv-parse-invalid{font-size:10.5px;color:var(--mv-danger)}
.mv-parse-mini-btn{appearance:none;border:.5px solid var(--mv-line);background:var(--mv-lift);color:var(--mv-text);border-radius:6px;padding:2px 7px;min-block-size:24px;font:inherit;font-size:10.5px;cursor:pointer;white-space:nowrap}
.mv-parse-mini-btn:hover{border-color:var(--mv-accent)}
.mv-parse-mini-btn:disabled{opacity:.45;cursor:not-allowed}
.mv-parse-seg{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}
.mv-parse-seg-btn{appearance:none;flex:1 1 96px;min-width:0;min-block-size:26px;padding:3px 8px;border-radius:7px;border:.5px solid var(--mv-line);background:transparent;color:var(--mv-dim);font:inherit;font-size:11px;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.mv-parse-seg-btn.on{background:color-mix(in srgb,var(--mv-accent) 16%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 52%,transparent);color:var(--mv-text);font-weight:600}
.mv-parse-seg-btn:disabled{opacity:.45;cursor:not-allowed}
.mv-parse-aoi{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}
.mv-parse-aoi .mv-parse-note{flex:1 1 120px;min-width:0}
.mv-parse-run{display:flex;flex-direction:column;gap:3px;min-width:0}
.mv-parse-run-btn{width:100%;min-width:0}
.mv-parse-confirm{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.mv-parse-confirm-text{flex:1 1 100%;font-size:10.5px;line-height:1.35;color:var(--mv-dim)}
.mv-parse-reason{font-size:10.5px;line-height:1.4;color:var(--mv-dim)}
.mv-parse-chips{display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:1px 0;min-block-size:26px;min-width:0}
.mv-parse-chip{appearance:none;display:inline-flex;align-items:center;gap:4px;flex:0 1 auto;max-inline-size:100%;min-block-size:24px;padding:3px 8px;border-radius:999px;border:.5px solid var(--mv-line);background:transparent;color:var(--mv-dim);font:inherit;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.mv-parse-chip.on{background:color-mix(in srgb,var(--mv-accent) 16%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 50%,transparent);color:var(--mv-text);font-weight:600}
.mv-parse-chip:disabled{opacity:.45;cursor:not-allowed}
.mv-parse-chip-add{border-style:dashed}
.mv-parse-dot{--mv-dot:var(--mv-accent);background:var(--mv-dot);width:8px;height:8px;border-radius:999px;flex:0 0 auto;border:1px solid var(--mv-line)}
.mv-parse-inline-input{appearance:none;flex:0 0 auto;min-block-size:24px;max-inline-size:132px;padding:2px 8px;border-radius:999px;border:.5px solid var(--mv-line);background:var(--mv-input);color:var(--mv-text);font:inherit;font-size:11px}
.mv-parse-status{font-size:10.5px;line-height:1.4;color:var(--mv-dim);min-block-size:14px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.mv-parse-error{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 8px;border-radius:8px;border:.5px solid color-mix(in srgb,var(--mv-danger) 42%,var(--mv-line));background:color-mix(in srgb,var(--mv-danger) 9%,transparent);font-size:11px;line-height:1.45;color:var(--mv-text)}
.mv-parse-error-msg{flex:1 1 120px;min-width:0}
.mv-parse-settings{display:flex;flex-direction:column;gap:4px;padding:7px 8px;border-radius:8px;border:.5px solid var(--mv-line);background:color-mix(in srgb,var(--mv-lift) 55%,transparent)}
.mv-parse-profile{display:flex;gap:8px;align-items:center;color:var(--mv-dim)}
.mv-parse-profile select{appearance:auto;max-inline-size:none}
.mv-parse-definitions summary{cursor:pointer;color:var(--mv-dim);padding-block:3px}
.mv-parse-defs{display:flex;flex-direction:column;gap:3px;max-block-size:180px;overflow:auto}
.mv-parse-def{display:flex;flex-direction:column;gap:0;font-size:10.5px;line-height:1.4}
.mv-parse-def-name{color:var(--mv-text);font-weight:600}
.mv-parse-def-text{color:var(--mv-dim);overflow-wrap:anywhere}
.mv-parse-queue{display:flex;flex-direction:column;gap:4px;min-width:0;min-height:0}
.mv-parse-queue-head{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;min-width:0}
.mv-parse-queue-counts{font-size:10.5px;color:var(--mv-dim);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mv-parse-queue-tools{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}
.mv-parse-select{appearance:none;min-block-size:24px;max-inline-size:96px;padding:2px 6px;border-radius:6px;border:.5px solid var(--mv-line);background:var(--mv-lift);color:var(--mv-text);font:inherit;font-size:10.5px;cursor:pointer}
.mv-parse-rows{display:flex;flex-direction:column;gap:2px;max-block-size:240px;overflow:auto;padding:2px;border-radius:8px;background:color-mix(in srgb,var(--mv-lift) 55%,transparent);min-width:0}
.mv-parse-item-wrap{display:flex;flex-direction:column;gap:2px;min-width:0}
.mv-parse-row{display:flex;align-items:center;gap:4px;min-width:0;min-block-size:28px;padding:2px 5px;border-radius:6px;border:1px solid transparent;font-size:11.5px;cursor:pointer}
.mv-parse-row:hover{background:color-mix(in srgb,var(--mv-accent) 8%,transparent)}
.mv-parse-row.on{background:color-mix(in srgb,var(--mv-accent) 10%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 26%,transparent)}
.mv-parse-row.active{box-shadow:inset 2px 0 0 var(--mv-accent)}
.mv-parse-check{flex:0 0 auto;inline-size:12px;block-size:12px;margin:0;accent-color:var(--mv-accent)}
.mv-parse-item-class{border:0;background:transparent;color:inherit;font:inherit;text-align:start;padding:0;cursor:pointer;flex:1 1 auto;min-width:0;max-inline-size:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mv-text)}
.mv-parse-item-area{flex:0 0 auto;font-size:10px;color:var(--mv-dim);font-variant-numeric:tabular-nums;white-space:nowrap;max-inline-size:72px;overflow:hidden;text-overflow:ellipsis}
.mv-parse-item-tag{flex:0 0 auto;padding:0 4px;border-radius:4px;border:.5px solid var(--mv-line);color:var(--mv-dim);font-size:9.5px;line-height:15px;white-space:nowrap}
.mv-parse-item-actions{display:inline-flex;align-items:center;gap:1px;flex:0 0 auto}
.mv-parse-icon-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-inline-size:22px;min-block-size:22px;padding:0;border-radius:6px;border:.5px solid transparent;background:transparent;color:var(--mv-dim);font:inherit;font-size:12px;line-height:1;cursor:pointer}
.mv-parse-icon-btn:hover{border-color:var(--mv-line);background:var(--mv-lift);color:var(--mv-text)}
.mv-parse-icon-btn:disabled{opacity:.4;cursor:not-allowed}
.mv-parse-empty{padding:10px 8px;font-size:11px;color:var(--mv-dim);text-align:center}
.mv-parse-export{display:flex;flex-direction:column;gap:4px;margin-top:auto;padding-top:4px;min-width:0}
.mv-parse-export-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}
.mv-parse-export-do{flex:1 1 120px;min-width:0}
.mv-parse-row:focus-visible,.mv-parse-chip:focus-visible,.mv-parse-seg-btn:focus-visible,.mv-parse-icon-btn:focus-visible,.mv-parse-mini-btn:focus-visible,.mv-parse-inline-input:focus-visible,.mv-parse-select:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px}
@container (max-width:340px){.mv-parse-item-class{max-inline-size:64px}.mv-parse-item-area{max-inline-size:56px}.mv-parse-chip{font-size:10.5px}}
@media(forced-colors:active){.mv-parse-seg-btn.on,.mv-parse-chip.on{border:2px solid Highlight;color:HighlightText;background:Highlight}}
`
