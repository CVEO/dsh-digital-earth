export const SELECTION_QUESTION_CSS = `
.mv-selection-question{box-sizing:border-box;min-width:0;margin:2px 0 4px;padding:12px;border:1px solid color-mix(in srgb,var(--mv-accent) 35%,var(--mv-line));border-radius:12px;background:var(--mv-glass-strong);box-shadow:0 3px 12px #00000008}
.mv-question-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mv-question-head strong{font-size:13px;font-weight:600;line-height:1.5;overflow-wrap:anywhere}
.mv-selection-question .mv-question-note{margin:6px 0 10px;font-size:12px;line-height:1.6;color:var(--mv-dim);overflow-wrap:anywhere}
.mv-question-preview{display:block;width:100%;height:auto;max-height:160px;object-fit:contain;background:#0b1320;border-radius:7px;margin-bottom:10px}
.mv-question-label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--mv-text)}
.mv-question-label textarea{box-sizing:border-box;display:block;width:100%;min-width:0;min-height:86px;resize:vertical;max-height:220px;padding:10px;border:1px solid var(--mv-line);border-radius:8px;background:var(--mv-input);color:var(--mv-text);font:inherit;line-height:1.6;outline-offset:2px}
.mv-question-label textarea:focus-visible{outline:2px solid var(--mv-accent)}
.mv-question-prompts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.mv-question-prompts button{appearance:none;min-height:30px;padding:4px 8px;border:1px solid var(--mv-line);border-radius:6px;background:var(--mv-lift);color:var(--mv-text);font:inherit;font-size:11px;cursor:pointer}
.mv-question-prompts button:hover{border-color:var(--mv-accent)}
.mv-question-prompts button:focus-visible{outline:2px solid var(--mv-accent);outline-offset:2px}
.mv-question-image{display:flex;align-items:flex-start;gap:7px;margin:10px 0;font-size:11px;line-height:1.6;color:var(--mv-dim);overflow-wrap:anywhere;cursor:pointer}
.mv-question-image input{flex:none;margin:3px 0 0;accent-color:var(--mv-accent)}
.mv-question-actions{display:flex;flex-wrap:wrap;gap:6px}
.mv-question-actions .mv-cta{flex:1 1 100px;white-space:normal}
.mv-selection-question .mv-question-status,.mv-selection-question .mv-question-error{margin:10px 0 0;font-size:12px;line-height:1.6;overflow-wrap:anywhere;color:var(--mv-dim)}
.mv-selection-question .mv-question-error{color:var(--dsw-alias-state-error-primary,#c43b3b)}
.mv-root:is([data-mv-scheme="dark"],[data-mv-theme="dark"]) .mv-question-error{color:var(--dsw-alias-state-error-primary,#ffa69c)}
.mv-selection-question button:disabled{opacity:.5;cursor:default}
@media(pointer:coarse){.mv-question-prompts button,.mv-question-image{min-height:44px}.mv-question-label textarea{font-size:16px}}
`
