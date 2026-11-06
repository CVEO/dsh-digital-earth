/**
 * ui/menu-item.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'

const h = React.createElement

    function MenuItem({ onClick, children, active, title }) {
      return h(
        'button',
        { type: 'button', className: `mv-menu-item${active ? ' on' : ''}`, onClick, title },
        children,
        active ? h('span', { className: 'check', 'aria-hidden': true }, '✓') : null,
      )
    }

export { MenuItem }
