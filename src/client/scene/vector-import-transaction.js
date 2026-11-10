export function runVectorImport(state, viewer, draw) {
  const firstEntity = state.draw.length
  const firstCommand = state.drawCommands.length
  const previousCount = state.drawnFeatures
  try { return draw() }
  catch (error) {
    for (const entity of state.draw.splice(firstEntity)) {
      try { viewer.entities.remove(entity) } catch {}
    }
    for (const command of state.drawCommands.splice(firstCommand)) state.entityGroups?.delete(command)
    state.drawnFeatures = previousCount
    throw error
  }
}
