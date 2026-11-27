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
/* ---- group header: the whole left region is the toggle, not just the text ---- */
.mv-group{padding:9px 2px 4px;gap:4px}
.mv-lgroup>.mv-group{padding:9px 2px 4px}
.mv-group-toggle{flex:1 1 auto;align-self:stretch;min-width:0;min-height:26px;justify-content:flex-start;padding:3px 6px;margin-left:-6px;gap:6px}
.mv-group-title{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-group-count{font-size:11px}
.mv-group-actions{gap:2px}
.mv-layers .mv-group-actions .mv-cta{min-height:24px;padding:2px 9px;font-size:11.5px}
.mv-layers .mv-group-actions .mv-cta:focus-visible{outline:2px solid var(--mv-accent);outline-offset:1px}
.mv-layers .mv-group-actions .mv-icon-btn{width:24px;height:24px;color:color-mix(in srgb,var(--mv-text) 62%,transparent)}
.mv-layers .mv-group-actions .mv-icon-btn:hover{color:var(--mv-text);background:color-mix(in srgb,var(--mv-lift) 78%,transparent)}
.mv-layers .mv-group-actions .mv-icon-btn:disabled{opacity:.4;cursor:default}
/* ---- rows: one optical size per level, actions are 16px strokes, not glyphs ---- */
.mv-layer{gap:2px;align-items:center}
.mv-layer .mv-row-name{font-size:12.5px;line-height:1.45}
.mv-layer .mv-row-meta{font-size:11px}
.mv-layer .mv-icon-btn{width:26px;height:26px;font-size:12px;color:color-mix(in srgb,var(--mv-text) 72%,transparent)}
.mv-layer .mv-icon-btn:hover{color:var(--mv-text);background:color-mix(in srgb,var(--mv-lift) 80%,transparent)}
.mv-layer .mv-icon-btn:disabled{color:var(--mv-dim);opacity:.4}
.mv-layer .mv-row-more{color:var(--mv-dim)}
.mv-layer .mv-row-more:hover{color:var(--mv-text)}
.mv-icon-btn.is-off{color:var(--mv-dim);background:transparent}
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
.mv-overlay-features{margin-left:45px;padding-left:8px;border-left:1px solid color-mix(in srgb,var(--mv-line) 90%,transparent)}
.mv-overlay-feature-name{font-size:12px}
/* ---- empty state aligns with row names so the group still reads as one column ---- */
.mv-none{margin:0;padding:6px 8px 8px 62px;font-size:11.5px}
.mv-imagery-hint{padding-left:24px}
/* ---- a long dock scrolls: keep the group context visible while it does ---- */
.mv-layer-list{scrollbar-gutter:stable}
.mv-lgroup>.mv-group{position:sticky;top:0;z-index:2;background:var(--mv-glass-strong);border-radius:0 0 6px 6px}
.mv-lgroup:first-child>.mv-group{border-radius:6px}
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
