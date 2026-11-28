/**
 * ui/parse-review.js — compatibility entry for the v1.7 extraction workbench.
 *
 * v1.6 shipped a self-contained panel here; v1.7 split it into a pure view
 * (parse-workbench.js), a runtime controller (parse-controller.js) and a thin
 * mount (parse-panel.js). The old export name stays so tool-windows.js and the
 * existing test suite keep one import site.
 */
export { ParsePanel as ParseBody } from './parse-panel.js'
