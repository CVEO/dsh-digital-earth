/**
 * ui/menu-item.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'

const h = React.createElement

    function MenuItem({ onClick, children, title, disabled = false }) {
      return h(
        'button',
        {
          type: 'button',
          className: `mv-menu-item${disabled ? ' is-disabled' : ''}`,
          onClick: disabled ? undefined : onClick,
          title,
          disabled,
        },
        children,
      )
    }

export { MenuItem }
