/**
 * ui/layout.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { ViewerSurface } from '../viewer/ViewerSurface.js'

const h = React.createElement

    /** Immersive `main` panel: no Session, so the Agent bridge stays off. */
    function ViewerPanel(props) {
      return h(ViewerSurface, { t: props.t, sessionId: null, docked: false })
    }

    /** Session-scoped right sidebar body: the chat stays visible beside it. */
    function EarthTabBody(props) {
      const info = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null
      const sessionId = props.sessionId ?? info?.tab?.sessionId ?? info?.sessionId ?? null
      return h(ViewerSurface, { t: props.t, sessionId, docked: true })
    }

export { ViewerPanel, EarthTabBody }
