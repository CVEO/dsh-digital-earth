import React from 'react'
import { createWorkbenchWiring } from './workbench-wiring.js'

export function useWorkbenchWiring(deps) {
  const latest = React.useRef(deps)
  latest.current = deps
  const service = React.useRef(null)
  if (!service.current) service.current = createWorkbenchWiring(Object.fromEntries(Object.keys(deps).map((key) => [key, (...args) => latest.current[key]?.(...args)])))
  React.useEffect(() => {
    service.current.activate()
    return () => service.current.dispose()
  }, [])
  return service.current
}
