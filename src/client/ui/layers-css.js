/**
 * ui/layers-css.js — the scene card's v1.9 interaction pass.
 *
 * Appended after the base sheet so it wins on equal specificity. Everything here
 * exists because a measurement from the design review demanded it: a 62×20 px
 * group toggle, a menu stretched by one long label, sub-rows indenting to the
 * eye instead of the parent name, 44 px touch targets wrapping a 284 px dock.
 * Keep these as overrides until the base sheet has budget to absorb them.
 */

export const LAYERS_CSS = `
/* ---- scene secondary segmented control (三维 / 地表) ---- */
.mv-layers .mv-layer-tabs{display:flex;gap:2px;margin:8px 10px 4px;padding:2px;border-radius:8px;border:.5px solid color-mix(in srgb,var(--mv-line) 75%,transparent);background:color-mix(in srgb,var(--mv-lift) 80%,transparent)}
.mv-layers .mv-layer-tab{padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:500;line-height:1.4;color:var(--mv-dim);transition:background-color .14s ease,color .14s ease,box-shadow .14s ease}
.mv-layers .mv-layer-tab:hover{color:var(--mv-text)}
.mv-layers .mv-layer-tab.on{background:var(--mv-glass-strong);color:var(--mv-text);font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.08)}
/* ---- group header: clean transparent section divider, vertically centred ---- */
.mv-lgroup{gap:2px}
.mv-group{padding:6px 6px 4px 4px;gap:4px}
.mv-lgroup>.mv-group{position:static;padding:7px 6px 5px 4px;margin-top:8px;border-top:.5px solid color-mix(in srgb,var(--mv-line) 75%,transparent);background:transparent;border-radius:0}
.mv-lgroup:first-child>.mv-group{border-top:0;margin-top:0;padding-top:4px;border-radius:0}
.mv-group-toggle{flex:1 1 auto;align-self:stretch;min-width:0;min-height:24px;justify-content:flex-start;padding:2px 6px 2px 4px;margin-left:-4px;gap:6px;border-radius:6px}
.mv-group-chevron{width:12px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:var(--mv-dim)}
.mv-group-toggle:hover .mv-group-chevron{color:var(--mv-text)}
.mv-group-title{font-size:11.5px;font-weight:600;letter-spacing:.01em;color:color-mix(in srgb,var(--mv-text) 82%,var(--mv-dim));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-group-count{font-size:11px;font-weight:500;color:color-mix(in srgb,var(--mv-dim) 82%,transparent)}
.mv-group-actions{gap:2px}
.mv-layers .mv-group-actions .mv-cta{min-height:22px;padding:2px 8px;font-size:11px}
.mv-layers .mv-group-actions .mv-cta:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-layers .mv-group-actions .mv-icon-btn{width:24px;height:24px;border-radius:6px;color:var(--mv-dim)}
.mv-layers .mv-group-actions .mv-icon-btn:hover{color:var(--mv-text);background:color-mix(in srgb,var(--mv-lift) 82%,transparent)}
.mv-layers .mv-group-actions .mv-icon-btn:disabled{opacity:.32;cursor:default}
/* ---- rows: optically balanced height, actions flush with group header right edge ---- */
.mv-layers .mv-layer{min-height:32px;padding:5px 6px;gap:4px;border-radius:8px;align-items:center;transition:background-color .12s ease}
.mv-layer .mv-row-name{font-size:12px;font-weight:500;line-height:1.4}
.mv-layer .mv-row-meta{font-size:10.5px;line-height:1.35}
.mv-layer .mv-icon-btn{width:24px;height:24px;border-radius:6px;font-size:12px;color:var(--mv-dim)}
.mv-layer .mv-icon-btn:hover{color:var(--mv-text);background:color-mix(in srgb,var(--mv-lift) 85%,transparent)}
.mv-layer .mv-icon-btn:disabled{color:var(--mv-dim);opacity:.32}
.mv-layer .mv-row-more{color:var(--mv-dim)}
.mv-layer .mv-row-more:hover{color:var(--mv-text)}
.mv-icon-btn.is-off{color:var(--mv-dim);background:transparent;opacity:.65}
/* Hidden rows stay legible: dimmed name, no strike-through (that reads as deleted). */
.mv-layer.off .name{color:var(--mv-dim)}
.mv-layer.off .mv-row-name{text-decoration:none;color:color-mix(in srgb,var(--mv-text) 62%,transparent)}
.mv-layer.off .mv-row-dot{opacity:.45}
/* ---- overflow menu: bounded by the dock, long labels take a hint slot ---- */
.mv-row-menu{min-width:160px;width:max-content;max-width:min(244px,calc(100% - 6px))}
.mv-row-menu .mv-menu-item{padding:7px 9px}
.mv-row-menu .mv-menu-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-row-menu .mv-menu-hint{flex:none;margin-left:auto;padding-left:10px;font-size:10.5px;color:var(--mv-dim);white-space:nowrap}
.mv-row-menu .mv-menu-item.is-disabled{opacity:.55}
.mv-row-menu .mv-menu-item.is-disabled .mv-menu-hint{opacity:.9}
/* ---- feature sub-rows hang from the parent dot, not from the eye ---- */
.mv-overlay-features{margin-left:40px;padding-left:8px;border-left:1px solid color-mix(in srgb,var(--mv-line) 90%,transparent)}
.mv-overlay-feature-name{font-size:12px}
/* ---- empty state: full-width quiet inset note, aligned flush with rows ---- */
.mv-layers .mv-none{margin:2px 0 4px;padding:7px 10px;border-radius:7px;background:color-mix(in srgb,var(--mv-lift) 52%,transparent);font-size:11px;line-height:1.5;color:var(--mv-dim)}
.mv-layers .mv-none.mv-imagery-hint{background:transparent;padding:2px 8px 4px 18px}
.mv-lgroup-hint{margin:0 0 4px 18px;font-size:11px}
/* ---- list padding: crisp left/right symmetry without dead scrollbar gutter ---- */
.mv-layer-list{padding:2px 10px 12px;scrollbar-gutter:auto}
/* ---- active shader: a dot in the meta line, so colour is not the only cue ---- */
.mv-layer.has-shader .mv-row-meta::before{content:'';display:inline-block;width:5px;height:5px;margin-right:4px;border-radius:50%;background:#3ddc97;vertical-align:1px}
/* ---- row menus read as actions, not as secondary notes ---- */
.mv-row-menu .mv-menu-item{color:var(--mv-text)}
.mv-row-menu .mv-menu-item .mv-menu-label{font-weight:500}
/* ---- touch: the group toggle and row actions get real hit areas ---- */
@media(pointer:coarse){
  .mv-layer{flex-wrap:nowrap}
  .mv-group-toggle{min-height:40px}
  .mv-layers .mv-group-actions .mv-icon-btn{width:36px;height:36px}
  .mv-layer .mv-icon-btn{width:36px;height:36px}
  .mv-overlay-feature-act{width:32px;height:32px}
  .mv-row-menu .mv-menu-item{min-height:44px}
}
`
