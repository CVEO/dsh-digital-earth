/**
 * ui/parse-panel.js — mounts the extraction workbench on a session controller.
 *
 * Kept tiny on purpose: the view (parse-workbench.js) is pure and the runtime
 * (parse-controller.js) owns the viewer, so this file only wires subscription
 * and refresh.
 */
import React from 'react'

import { ParseWorkbench } from './parse-workbench.js'
import { parseSession } from './parse-session.js'

const h = React.createElement
// Module scope so a stale openRequest does not replay an old AOI request when the
// panel remounts, while a brand new request still lands on first mount. Track the
// request object, not a counter: other tool windows reset toolRequest.aoiSeq.
let consumedAoiRequest = null

export function ParsePanel(props) {
  const controller = parseSession(props)
  const [, force] = React.useState(0)

  React.useEffect(() => {
    const unsubscribe = controller.subscribe(() => force((tick) => tick + 1))
    controller.refresh()
    return () => {
      // Unsubscribe first, then disarm: deactivate() emits an update.
      unsubscribe()
      // The controller outlives the panel; disarm the click/draw tools so a closed
      // workbench cannot keep adding candidates from stray map clicks.
      controller.actions.deactivate?.()
    }
  }, [controller])

  React.useEffect(() => {
    controller?.refresh()
    // "Extract this selection" must not silently fall back to the whole
    // viewport: setScope('aoi') adopts the live selection as the AOI when the
    // selection tool still holds one.
    const request = props.openRequest
    if (request?.aoiSeq && request !== consumedAoiRequest) {
      consumedAoiRequest = request
      controller?.actions?.setScope?.('aoi')
    }
  }, [controller, props.openRequest?.id, props.openRequest?.aoiSeq])

  return h(ParseWorkbench, {
    t: props.t,
    state: controller.getState(),
    actions: controller.actions,
    openRequest: props.openRequest ?? null,
  })
}

export { ParsePanel as ParseBody }
