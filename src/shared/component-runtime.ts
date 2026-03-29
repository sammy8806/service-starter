export interface RuntimePortLike {
  status: 'free' | 'in-use' | 'conflict'
  pid?: number
}

export interface RuntimeDependencyLike {
  health: 'healthy' | 'unhealthy' | 'unknown'
}

export interface ComponentRuntimeState {
  status: 'running' | 'stopped' | 'warning'
  processOrigin: 'managed' | 'external' | 'none'
}

export function deriveComponentRuntimeState({
  portStates,
  dependencies,
  isManaged
}: {
  portStates: RuntimePortLike[]
  dependencies: RuntimeDependencyLike[]
  isManaged: boolean
}): ComponentRuntimeState {
  const hasObservedRunningPort = portStates.some((port) => port.status === 'in-use')
  const hasBoundPortConflict = portStates.some(
    (port) => port.status === 'conflict' && typeof port.pid === 'number'
  )
  const hasIssue =
    hasBoundPortConflict || dependencies.some((dependency) => dependency.health === 'unhealthy')

  if (isManaged) {
    return {
      status: 'running',
      processOrigin: 'managed'
    }
  }

  if (hasObservedRunningPort) {
    return {
      status: 'running',
      processOrigin: 'external'
    }
  }

  return {
    status: hasIssue ? 'warning' : 'stopped',
    processOrigin: 'none'
  }
}
