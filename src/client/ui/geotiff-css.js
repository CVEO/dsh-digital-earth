/**
 * ui/geotiff-css.js — the local GeoTIFF route inside the add-data dialog.
 *
 * The route is a small wizard, so it needs three visual states the generic form
 * classes do not cover: a two-tab mode switch, a scrollable file list where one
 * row is the pending file, and a preview that never grows past the dialog.
 */

export const GEOTIFF_CSS = `
/* The add-data dialog wants 520 px, but the generic .mv-dialog rule is declared
   later in the sheet with the same specificity and wins; pin it here instead of
   editing the shared block. */
.mv-dialog.mv-add-layer{width:min(520px,calc(100vw - 32px));max-height:min(80vh,720px)}
.mv-geo-tabs{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--mv-input);margin-bottom:2px}
.mv-geo-tab{appearance:none;flex:1 1 0;min-height:28px;border:0;border-radius:6px;background:transparent;color:var(--mv-dim);font:inherit;font-size:12px;cursor:pointer;transition:background .1s,color .1s}
.mv-geo-tab:hover{color:var(--mv-text)}
.mv-geo-tab.on{background:var(--mv-glass-strong);color:var(--mv-text);font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.1)}
.mv-geo-tab:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-geo-dir{appearance:none;display:flex;align-items:center;gap:6px;width:100%;margin:0;padding:6px 8px;border:0;border-radius:7px;background:var(--mv-input);color:var(--mv-dim);font:inherit;font-size:11px;text-align:left;min-width:0;cursor:pointer}
.mv-geo-dir:hover{background:color-mix(in srgb,var(--mv-lift) 70%,transparent);color:var(--mv-text)}
.mv-geo-dir:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-geo-dir .ellipsis{flex:1 1 auto}
.mv-geo-dir em{flex:none;font-style:normal;color:var(--mv-accent);font-size:10.5px}
.mv-geo-list{display:flex;flex-direction:column;gap:1px;max-height:148px;overflow:auto;padding:2px;border-radius:8px;border:.5px solid var(--mv-line);background:var(--mv-glass);scrollbar-width:thin}
.mv-geo-file{appearance:none;display:flex;align-items:center;gap:8px;min-height:30px;padding:4px 8px;border:0;border-radius:6px;background:transparent;color:var(--mv-text);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.mv-geo-file:hover{background:color-mix(in srgb,var(--mv-lift) 75%,transparent)}
.mv-geo-file.on{background:color-mix(in srgb,var(--mv-accent) 14%,transparent);color:var(--mv-text);box-shadow:inset 2px 0 0 var(--mv-accent)}
.mv-geo-file .ellipsis{flex:1 1 auto;min-width:0}
.mv-geo-size{flex:none;font-size:10.5px;color:var(--mv-dim);font-variant-numeric:tabular-nums}
.mv-geo-preview-wrap{position:relative;border-radius:8px;overflow:hidden;border:.5px solid var(--mv-line);background:var(--mv-input)}
.mv-geo-preview{display:block;width:100%;height:188px;object-fit:contain;background:color-mix(in srgb,var(--mv-text) 6%,transparent)}
.mv-geo-preview-tag{position:absolute;left:8px;top:8px;padding:2px 7px;border-radius:999px;background:rgba(15,23,42,.62);color:#fff;font-size:10.5px;letter-spacing:.02em}
.mv-geo-specs{display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--mv-dim);line-height:1.5}
.mv-geo-specs span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-geo-warn{color:#c2610a}
.mv-geo-progress{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--mv-accent) 8%,transparent);border:.5px solid color-mix(in srgb,var(--mv-accent) 24%,transparent)}
.mv-geo-progress span{font-size:11px;color:var(--mv-text);font-variant-numeric:tabular-nums}
.mv-geo-bar{height:6px;border-radius:999px;background:color-mix(in srgb,var(--mv-text) 12%,transparent);overflow:hidden}
.mv-geo-bar i{display:block;height:100%;border-radius:999px;background:var(--mv-accent);transition:width .25s ease}
.mv-geo-actions{display:flex;justify-content:flex-end;gap:6px}
.mv-geo-empty{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:8px;border:.5px dashed var(--mv-line)}
.mv-geo-done{display:flex;flex-direction:column;gap:8px;padding:14px 12px;border-radius:10px;border:.5px solid color-mix(in srgb,var(--mv-accent) 35%,transparent);background:color-mix(in srgb,var(--mv-accent) 8%,transparent)}
.mv-geo-done b{font-size:13px}
.mv-geo-note{color:var(--mv-dim)}
.mv-geo-tabs button:disabled,.mv-geo-dir:disabled{opacity:.55;cursor:default}
.mv-geo-drop-wrap{display:flex;flex-direction:column;gap:8px}
.mv-geo-drop{appearance:none;display:flex;flex-direction:column;align-items:center;gap:5px;width:100%;padding:18px 14px 16px;border:1px dashed color-mix(in srgb,var(--mv-text) 26%,transparent);border-radius:10px;background:color-mix(in srgb,var(--mv-input) 70%,transparent);color:var(--mv-text);font:inherit;cursor:pointer;transition:border-color .12s,background .12s}
.mv-geo-drop:hover:not(:disabled){border-color:color-mix(in srgb,var(--mv-accent) 62%,transparent);background:color-mix(in srgb,var(--mv-accent) 7%,var(--mv-input))}
.mv-geo-drop:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-geo-drop:disabled{cursor:default;opacity:.7}
.mv-geo-drop-icon{display:grid;place-items:center;width:38px;height:38px;margin-bottom:2px;border-radius:50%;background:color-mix(in srgb,var(--mv-accent) 13%,transparent);color:var(--mv-accent)}
.mv-geo-drop b{font-size:12.5px;font-weight:600}
.mv-geo-drop em{font-style:normal;font-size:11px;color:var(--mv-dim)}
.mv-geo-drop small{font-size:10.5px;color:var(--mv-dim);line-height:1.45;text-align:center;max-width:34em}
.mv-geo-picked{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;border:.5px solid var(--mv-line);background:var(--mv-glass);font-size:12px}
.mv-geo-picked .ellipsis{flex:1 1 auto;min-width:0}
.mv-geo-picked-icon{display:inline-flex;flex:none;color:var(--mv-accent);opacity:.9}
.mv-geo-picked .mv-cta{flex:none;min-height:24px;padding:2px 8px;font-size:11px}
.mv-geo-switch{appearance:none;align-self:flex-start;border:0;background:transparent;padding:2px 0;color:var(--mv-dim);font:inherit;font-size:10.5px;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.mv-geo-switch:hover{color:var(--mv-text)}
.mv-geo-switch:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px;border-radius:3px}
`
