/**
 * ui/tool-workspace.js — independent multi-window state for open tools.
 *
 * Separating open tool windows from ToolsPanel visibility fixes two workflow
 * bottlenecks: closing Tools no longer cancels an active Selection window, and
 * Selection can remain open side-by-side while inspecting other tools.
 */
import React from 'react'

import { focusFloatingWindow } from './floating.js'
import { toolEntry } from './tool-catalog.js'

export function openWorkspaceTool(windows, id, { toggleIfOpen = false } = {}) {
  const list = Array.isArray(windows) ? windows : []
  if (!toolEntry(id)) return list
  const existing = list.find((item) => item.id === id)
  if (!existing) return [...list, { id, minimized: false, expanded: false }]
  if (existing.minimized) {
    return list.map((item) => (item.id === id ? { ...item, minimized: false } : item))
  }
  if (toggleIfOpen) return list.filter((item) => item.id !== id)
  return [...list.filter((item) => item.id !== id), existing]
}

export function closeWorkspaceTool(windows, id) {
  const list = Array.isArray(windows) ? windows : []
  return list.filter((item) => item.id !== id)
}

export function toggleMinimizeWorkspaceTool(windows, id) {
  const list = Array.isArray(windows) ? windows : []
  return list.map((item) => (item.id === id ? { ...item, minimized: !item.minimized } : item))
}

export function toggleExpandWorkspaceTool(windows, id) {
  const list = Array.isArray(windows) ? windows : []
  return list.map((item) =>
    item.id === id ? { ...item, expanded: !item.expanded, minimized: false } : item,
  )
}

export function useToolWorkspace(openRequest) {
  const [windows, setWindows] = React.useState([])
  const lastSeqRef = React.useRef(0)

  React.useEffect(() => {
    const seq = openRequest?.seq ?? 0
    if (!openRequest?.id || seq <= lastSeqRef.current) return
    lastSeqRef.current = seq
    setWindows((prev) => openWorkspaceTool(prev, openRequest.id, { toggleIfOpen: false }))
    focusFloatingWindow(`toolwin.${openRequest.id}`)
  }, [openRequest?.id, openRequest?.seq])

  const selectTool = React.useCallback((id) => {
    setWindows((prev) => openWorkspaceTool(prev, id, { toggleIfOpen: true }))
    focusFloatingWindow(`toolwin.${id}`)
  }, [])

  const openTool = React.useCallback((id) => {
    setWindows((prev) => openWorkspaceTool(prev, id, { toggleIfOpen: false }))
    focusFloatingWindow(`toolwin.${id}`)
  }, [])

  const closeTool = React.useCallback((id) => {
    setWindows((prev) => closeWorkspaceTool(prev, id))
  }, [])

  const toggleMinimize = React.useCallback((id) => {
    setWindows((prev) => toggleMinimizeWorkspaceTool(prev, id))
  }, [])

  const toggleExpand = React.useCallback((id) => {
    setWindows((prev) => toggleExpandWorkspaceTool(prev, id))
    focusFloatingWindow(`toolwin.${id}`)
  }, [])

  return {
    windows,
    isOpen: (id) => windows.some((item) => item.id === id),
    selectTool,
    openTool,
    closeTool,
    toggleMinimize,
    toggleExpand,
  }
}
