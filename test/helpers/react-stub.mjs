/**
 * Minimal React stand-in for tests that execute client modules outside a browser.
 * Only the surface touched by non-component modules (i18n.js) needs to exist.
 */
const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useCallback: (callback) => callback,
  useRef: (initial) => ({ current: initial }),
  useSyncExternalStore: () => undefined,
}

export default React
export { React }
