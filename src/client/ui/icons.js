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

export { ViewerIcon, ThemeIcon, FullscreenIcon, HudIcon, CollapseIcon, LayerActionIcon, ShaderIcon }
