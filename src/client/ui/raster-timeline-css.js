/**
 * ui/raster-timeline-css.js — styles for the multi-period imagery frame timeline.
 *
 * Uses native `<input type="range">` with separate WebKit/Firefox pseudo-element
 * blocks (never comma-combined) and custom-property progress fill with calc()
 * fallback.
 */
export const RASTER_TIMELINE_CSS = `
.mv-overlay-item{display:flex;flex-direction:column;gap:4px}
.mv-rtime{display:flex;flex-direction:column;gap:5px;margin:2px 0 4px;padding:7px 9px;border-radius:9px;background:color-mix(in srgb,var(--mv-lift) 68%,transparent);border:.5px solid var(--mv-line)}
.mv-rtime.dim{opacity:.66}
.mv-rtime-head{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}
.mv-rtime-tag{flex:none;font-size:10px;font-weight:600;padding:1px 6px;border-radius:999px;color:var(--mv-accent);background:color-mix(in srgb,var(--mv-accent) 14%,transparent);border:.5px solid color-mix(in srgb,var(--mv-accent) 28%,transparent)}
.mv-rtime-current{flex:1 1 auto;min-width:0;display:flex;align-items:baseline;gap:5px;overflow:hidden}
.mv-rtime-label{font-size:11px;font-weight:600;color:var(--mv-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-rtime-date{flex:none;font-size:10px;color:var(--mv-dim);font-variant-numeric:tabular-nums}
.mv-rtime-count{flex:none;font-size:10px;color:var(--mv-dim);font-variant-numeric:tabular-nums}
.mv-rtime-range{--slider-track-size:4px;--slider-thumb-size:13px;--slider-track-color:color-mix(in srgb,var(--mv-dim) 32%,transparent);--slider-fill-color:var(--mv-accent);--slider-thumb-color:var(--mv-accent);--slider-progress:calc((var(--control-value,0) - var(--attr-min,0)) / max(1,var(--attr-max,1) - var(--attr-min,0)) * 100%);appearance:none;inline-size:100%;block-size:22px;margin:0;padding:0;border:0;background:transparent;cursor:pointer}
.mv-rtime-range:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px;border-radius:4px}
.mv-rtime-range::-webkit-slider-runnable-track{block-size:var(--slider-track-size);border:0;border-radius:999px;background:linear-gradient(to right,var(--slider-fill-color) var(--slider-progress),var(--slider-track-color) var(--slider-progress))}
.mv-rtime-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;inline-size:var(--slider-thumb-size);block-size:var(--slider-thumb-size);margin-block-start:calc((var(--slider-track-size) - var(--slider-thumb-size)) / 2);border:0;border-radius:50%;background:var(--slider-thumb-color);box-shadow:0 1px 4px rgba(15,23,42,.3)}
.mv-rtime-range::-moz-range-track{block-size:var(--slider-track-size);border:0;border-radius:999px;background:var(--slider-track-color)}
.mv-rtime-range::-moz-range-progress{block-size:var(--slider-track-size);border-radius:999px;background:var(--slider-fill-color)}
.mv-rtime-range::-moz-range-thumb{inline-size:var(--slider-thumb-size);block-size:var(--slider-thumb-size);border:0;border-radius:50%;background:var(--slider-thumb-color)}
.mv-rtime-bounds{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--mv-dim);font-variant-numeric:tabular-nums;margin-top:-3px}
.mv-rtime-bounds span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-rtime-controls{display:flex;align-items:center;gap:4px}
.mv-rtime-btn{appearance:none;border:.5px solid var(--mv-line);background:var(--mv-glass-strong);color:var(--mv-text);font:inherit;font-size:11px;line-height:1;padding:4px 7px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px}
.mv-rtime-btn:hover:not(:disabled){border-color:var(--mv-accent);color:var(--mv-accent)}
.mv-rtime-btn:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-rtime-btn:disabled{opacity:.42;cursor:not-allowed}
.mv-rtime-btn.play{flex:1 1 auto}
.mv-rtime-btn.on{background:color-mix(in srgb,var(--mv-accent) 18%,transparent);border-color:color-mix(in srgb,var(--mv-accent) 45%,transparent);color:var(--mv-accent)}
.mv-rtime-btn.speed{min-width:36px;font-variant-numeric:tabular-nums;color:var(--mv-dim)}
.mv-overlay-form textarea{width:100%;box-sizing:border-box;min-height:54px;resize:vertical;background:var(--mv-input);border:.5px solid var(--mv-line);color:var(--mv-text);border-radius:7px;padding:6px 8px;font:inherit;font-size:11px;outline:none}
.mv-overlay-form textarea:focus{border-color:var(--mv-accent)}
`
