/**
 * ui/icons.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'

const h = React.createElement

    function ViewerIcon({ size = 18 }) {
      return h(
        'svg',
        { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('circle', { cx: 30, cy: 30, r: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 3 }),
        h('ellipse', { cx: 30, cy: 30, rx: 8.5, ry: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, opacity: 0.85 }),
        h('path', { d: 'M10.5 30h39M13.5 20.5h33M13.5 39.5h33', stroke: 'currentColor', strokeWidth: 2, opacity: 0.55 }),
        h('path', { d: 'M48 34l9 5v10l-9 5-9-5V39z', fill: 'currentColor', opacity: 0.9 }),
      )
    }

    const ThemeIcon = ({ mode, size = 16 }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        mode === 'dark'
          ? h('path', { d: 'M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5 8.6 8.6 0 1 0 20.5 14.4z', fill: 'currentColor' })
          : mode === 'light'
            ? h(
                'g',
                { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', fill: 'none' },
                h('circle', { cx: 12, cy: 12, r: 4.1 }),
                h('path', { d: 'M12 2.6v1.7M12 19.2v1.7M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6' }),
              )
            : h(
                'g',
                { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', fill: 'none' },
                h('circle', { cx: 12, cy: 12, r: 8.4 }),
                h('path', { d: 'M12 3.6a8.4 8.4 0 0 0 0 16.8z', fill: 'currentColor', stroke: 'none' }),
              ),
      )

    /** Crisp 16px action icons for the layer rows (Unicode glyphs rendered unevenly). */
    /** Four-corner expand glyph: the docked toolbar's fullscreen toggle. */
    const FullscreenIcon = ({ size = 15 }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h(
          'g',
          { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' },
          h('path', { d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }),
        ),
      )

    /** Coordinate crosshair used by the HUD visibility toggle. */
    const HudIcon = ({ size = 16 }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h(
          'g',
          { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', fill: 'none' },
          h('circle', { cx: 12, cy: 12, r: 5.2 }),
          h('path', { d: 'M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4' }),
        ),
      )

    /** Chevron used by the floating layer-card header to collapse itself. */
    const CollapseIcon = ({ size = 13 }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', {
          d: 'M5 15l7-7 7 7',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )

    function LayerActionIcon({ kind, size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      let shapes
      if (kind === 'visible') {
        shapes = [
          h('path', { key: 'eye', d: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z', ...stroke }),
          h('circle', { key: 'pupil', cx: 12, cy: 12, r: 3, ...stroke }),
        ]
      } else if (kind === 'hidden') {
        shapes = [
          h('path', { key: 'eye', d: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z', ...stroke }),
          h('path', { key: 'slash', d: 'M3.5 3.5l17 17', ...stroke }),
        ]
      } else if (kind === 'locate') {
        shapes = [
          h('circle', { key: 'ring', cx: 12, cy: 12, r: 5.5, ...stroke }),
          h('path', { key: 'ticks', d: 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3', ...stroke }),
        ]
      } else if (kind === 'inspect') {
        shapes = [
          h('circle', { key: 'lens', cx: 10.5, cy: 10.5, r: 6, ...stroke }),
          h('path', { key: 'handle', d: 'M15 15l5.5 5.5', ...stroke }),
        ]
      } else if (kind === 'more') {
        shapes = [
          h('circle', { key: 'a', cx: 5.5, cy: 12, r: 1.5, fill: 'currentColor' }),
          h('circle', { key: 'b', cx: 12, cy: 12, r: 1.5, fill: 'currentColor' }),
          h('circle', { key: 'c', cx: 18.5, cy: 12, r: 1.5, fill: 'currentColor' }),
        ]
      } else if (kind === 'up' || kind === 'down') {
        shapes = [
          h('path', { key: 'arrow', d: kind === 'up' ? 'M12 19V6M6 12l6-6 6 6' : 'M12 5v13M6 12l6 6 6-6', ...stroke }),
        ]
      } else if (kind === 'delete') {
        shapes = [
          h('path', { key: 'lid', d: 'M4 7h16M9.5 7V5h5v2', ...stroke }),
          h('path', { key: 'can', d: 'M6.5 7l.9 11.5h9.2L17.5 7', ...stroke }),
          h('path', { key: 'lines', d: 'M10 11v4.5M14 11v4.5', ...stroke }),
        ]
      } else if (kind === 'shader') {
        shapes = [
          h('path', { key: 'sliders', d: 'M3 7h6.5M13.5 7H21M3 17h4M11 17h10', ...stroke }),
          h('circle', { key: 'k1', cx: 11.5, cy: 7, r: 2.4, ...stroke }),
          h('circle', { key: 'k2', cx: 8.5, cy: 17, r: 2.4, ...stroke }),
        ]
      } else {
        shapes = [h('path', { key: 'x', d: 'M6 6l12 12M18 6L6 18', ...stroke })]
      }
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } }, shapes)
    }

    /** B3: workbench toggle icon (three sliders), matches the stroke icon family. */
    function ShaderIcon({ size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M3 7h6.5M13.5 7H21M3 17h4M11 17h10', ...stroke }),
        h('circle', { cx: 11.5, cy: 7, r: 2.4, ...stroke }),
        h('circle', { cx: 8.5, cy: 17, r: 2.4, ...stroke }),
      )
    }

    /** Camera glyph: screenshot / capture. */
    function ScreenshotIcon({ size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M3.5 8.5h3l1.4-2.2h8.2l1.4 2.2h3v10h-17z', ...stroke }),
        h('circle', { cx: 12, cy: 13, r: 3.4, ...stroke }),
      )
    }

    /** Selection reticle: the "指认" tool (point at one object and read it). */
    function IdentifyIcon({ size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M12 2.8v4M12 17.2v4M2.8 12h4M17.2 12h4', ...stroke }),
        h('circle', { cx: 12, cy: 12, r: 5.2, ...stroke }),
        h('circle', { cx: 12, cy: 12, r: 1.3, fill: 'currentColor', stroke: 'none' }),
      )
    }

    /** Home glyph: reset the camera to the home view. */
    function ResetIcon({ size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M4 11.5 12 4l8 7.5', ...stroke }),
        h('path', { d: 'M6.5 10.5V20h11v-9.5', ...stroke }),
        h('path', { d: 'M10 20v-5h4v5', ...stroke }),
      )
    }

    /** Speech bubble glyph: ask the conversation Agent about the scene. */
    function AskAgentIcon({ size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M4 5.5h16v10.5H9.5L5 20v-4H4z', ...stroke }),
        h('path', { d: 'M8.5 9.5h7M8.5 12.5h4.5', ...stroke }),
      )
    }

    /**
     * Toolbox entry glyphs. One family of 16px stroke icons so the index reads as
     * a list of doors rather than a wall of text buttons.
     */
    function ToolEntryIcon({ kind, size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      let shapes
      if (kind === 'measure') {
        shapes = [
          h('path', { key: 'ruler', d: 'M3.5 14.5 14.5 3.5l6 6-11 11z', ...stroke }),
          h('path', { key: 'ticks', d: 'M7.5 10.5l1.8 1.8M10.5 7.5l1.8 1.8M13.5 4.5l1.8 1.8', ...stroke }),
        ]
      } else if (kind === 'select') {
        shapes = [
          h('path', { key: 'frame', d: 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4', ...stroke }),
          h('path', { key: 'polygon', d: 'M7 5.5l7-1.5 4 6-4 7-7-2-2-6z', ...stroke }),
          h('circle', { key: 'vertex', cx: '7', cy: '5.5', r: '1.2', fill: 'currentColor', stroke: 'none' }),
        ]
      } else if (kind === 'parse') {
        shapes = [
          h('path', { key: 'frame', d: 'M4 8V4h5M20 8V4h-5M4 16v4h5M20 16v4h-5', ...stroke }),
          h('path', { key: 'sparkle', d: 'M12 8.5l1.4 3.1 3.1 1.4-3.1 1.4L12 17.5l-1.4-3.1L7.5 13l3.1-1.4z', fill: 'currentColor', stroke: 'none' }),
        ]
      } else if (kind === 'analysis') {
        shapes = [
          h('path', { key: 'axes', d: 'M4 20V4M4 20h16', ...stroke }),
          h('path', { key: 'curve', d: 'M7 16l4-5 3 3 5-7', ...stroke }),
        ]
      } else if (kind === 'compare') {
        shapes = [
          h('rect', { key: 'frame', x: 3.5, y: 4.5, width: 17, height: 15, rx: 2, ...stroke }),
          h('path', { key: 'split', d: 'M12 3v18', ...stroke }),
          h('path', { key: 'arrows', d: 'M9 12H6.5m0 0L8 10.5M6.5 12 8 13.5M15 12h2.5m0 0L16 10.5m1.5 1.5L16 13.5', ...stroke }),
        ]
      } else if (kind === 'annotation') {
        shapes = [
          h('path', { key: 'pin', d: 'M12 21s6-6.1 6-11a6 6 0 1 0-12 0c0 4.9 6 11 6 11z', ...stroke }),
          h('circle', { key: 'dot', cx: 12, cy: 10, r: 2.2, ...stroke }),
        ]
      } else if (kind === 'effects') {
        shapes = [
          h('path', { key: 'sliders', d: 'M3 7h6.5M13.5 7H21M3 17h4M11 17h10', ...stroke }),
          h('circle', { key: 'k1', cx: 11.5, cy: 7, r: 2.4, ...stroke }),
          h('circle', { key: 'k2', cx: 8.5, cy: 17, r: 2.4, ...stroke }),
        ]
      } else if (kind === 'view') {
        shapes = [
          h('path', { key: 'eye', d: 'M2.5 12s3.6-6.2 9.5-6.2S21.5 12 21.5 12s-3.6 6.2-9.5 6.2S2.5 12 2.5 12z', ...stroke }),
          h('circle', { key: 'pupil', cx: 12, cy: 12, r: 2.9, ...stroke }),
        ]
      } else if (kind === 'effects') {
        shapes = [
          h('path', { key: 'sliders', d: 'M3 7h6.5M13.5 7H21M3 17h4M11 17h10', ...stroke }),
          h('circle', { key: 'a', cx: 11.5, cy: 7, r: 2.4, ...stroke }),
          h('circle', { key: 'b', cx: 8.5, cy: 17, r: 2.4, ...stroke }),
        ]
      } else {
        shapes = [
          h('path', { key: 'globe', d: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', ...stroke }),
          h('path', { key: 'meridian', d: 'M12 3.5c2.6 2.4 4 5.2 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.2-4-8.5s1.4-6.1 4-8.5z', ...stroke }),
          h('path', { key: 'equator', d: 'M3.8 12h16.4', ...stroke }),
        ]
      }
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } }, shapes)
    }

    /** Layer visibility: an eye reads as "show/hide" at a glance (crossed = hidden). */
    const EyeIcon = ({ size = 15, off = false }) =>
      h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', {
          d: 'M2.5 12s3.6-6.2 9.5-6.2S21.5 12 21.5 12s-3.6 6.2-9.5 6.2S2.5 12 2.5 12z',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          fill: 'none',
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 12, cy: 12, r: 2.9, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }),
        off ? h('path', { d: 'M4 20 20 4', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }) : null,
      )

    /** Toolbox glyph: four squares read as "a set of tools" at 16px. */
    function ToolsIcon({ size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('rect', { key: 'a', x: 4, y: 4, width: 7, height: 7, rx: 1.6, ...stroke }),
        h('rect', { key: 'b', x: 13, y: 4, width: 7, height: 7, rx: 1.6, ...stroke }),
        h('rect', { key: 'c', x: 4, y: 13, width: 7, height: 7, rx: 1.6, ...stroke }),
        h('rect', { key: 'd', x: 13, y: 13, width: 7, height: 7, rx: 1.6, ...stroke }),
      )
    }

    /** Stacked layers glyph: the layer card / data domain entry. */
    function LayersIcon({ size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { key: 'top', d: 'M12 3.5 3.5 8l8.5 4.5L20.5 8z', ...stroke }),
        h('path', { key: 'mid', d: 'M3.5 12.5 12 17l8.5-4.5', ...stroke }),
        h('path', { key: 'bottom', d: 'M3.5 16.5 12 21l8.5-4.5', ...stroke }),
      )
    }

    /**
     * Small action glyphs for menu rows and group headers. One stroke family so a
     * menu reads as a list of actions instead of nine undifferentiated words.
     * `name`: add | folder | link | history | import | export | terrain | raster |
     *         vector | pen | props | scene | view | output | chat | frame | ruler
     */
    function GlyphIcon({ name, size = 16 }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      const paths = {
        add: ['M12 5v14', 'M5 12h14'],
        folder: ['M3.5 6.8h5.6l1.5 2h9.9v9.4h-17z'],
        link: ['M9.5 14.5 14.5 9.5', 'M8 12 6.4 13.6a3.1 3.1 0 0 0 4.4 4.4L12.4 16.4', 'M16 12l1.6-1.6a3.1 3.1 0 0 0-4.4-4.4L11.6 7.6'],
        history: ['M12 4.5a7.5 7.5 0 1 1-7.4 8.8', 'M4.5 8.5 4.4 4.4l4.1.1', 'M12 8v4.5l3.2 1.9'],
        import: ['M12 4.5v9', 'M8.6 10.4 12 13.8l3.4-3.4', 'M4.5 15.5v3h15v-3'],
        export: ['M12 14.5v-9', 'M8.6 8.6 12 5.2l3.4 3.4', 'M4.5 15.5v3h15v-3'],
        terrain: ['M3 18.5 9 8l3.6 6.1 2-3.1 4.4 7.5z'],
        raster: ['M4 4.5h16v15H4z', 'M4 9.5h16M4 14.5h16M9.3 4.5v15M14.7 4.5v15'],
        vector: ['M12 3.8 19.5 8v8L12 20.2 4.5 16V8z', 'M12 3.8v16.4M4.5 8l15 8M19.5 8l-15 8'],
        pen: ['M4.5 19.5l3.2-.7L19 7.6a1.6 1.6 0 0 0-2.3-2.3L5.2 16.4z', 'M15.6 6.9l1.5 1.5'],
        frame: ['M4 9V5.2h3.8M16.2 5.2H20V9M20 15v3.8h-3.8M7.8 18.8H4V15', 'M9.2 9.2h5.6v5.6H9.2z'],
        ruler: ['M4.4 15.6 15.6 4.4l4 4L8.4 19.6z', 'M8.2 11.8l2 2M11 9l2 2M13.8 6.2l2 2'],
        props: ['M4 8h6M14 8h6M4 16h3M11 16h9', 'M12 8a2 2 0 1 0 0-.1z', 'M9.5 16a2 2 0 1 0 0-.1z'],
        scene: ['M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z', 'M12 3.6c2.5 2.3 3.9 5.1 3.9 8.4s-1.4 6.1-3.9 8.4c-2.5-2.3-3.9-5.1-3.9-8.4s1.4-6.1 3.9-8.4z', 'M3.9 12h16.2'],
        view: ['M2.5 12s3.6-6.2 9.5-6.2S21.5 12 21.5 12s-3.6 6.2-9.5 6.2S2.5 12 2.5 12z', 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z'],
        output: ['M4.5 6.5h15v13h-15z', 'M8 3.8v4M16 3.8v4', 'M8 12.5h8M8 15.8h5'],
        chat: ['M4 5.5h16v10.5H9.5L5 20v-4H4z', 'M8.5 9.5h7M8.5 12.5h4.5'],
      }[name] ?? ['M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z', 'M3.9 12h16.2']
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        ...paths.map((d, index) => h('path', { key: index, d, ...stroke })),
      )
    }

export { ViewerIcon, ThemeIcon, FullscreenIcon, HudIcon, CollapseIcon, LayerActionIcon, ShaderIcon, ScreenshotIcon, IdentifyIcon, ResetIcon, AskAgentIcon, EyeIcon, ToolEntryIcon, ToolsIcon, LayersIcon, GlyphIcon }
