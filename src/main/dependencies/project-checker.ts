import { DependencyState, ProjectDependency, ResolvedProject, ActivePort } from '../config/types'

/**
 * Checks if a referenced project's components have active ports.
 * A project dependency is healthy if at least one of the referenced project's
 * component ports is active.
 */
export function checkProjectDependency(
  dep: ProjectDependency,
  allProjects: Map<string, ResolvedProject>,
  activePorts: ActivePort[]
): DependencyState {
  // Find the referenced project
  const project = Array.from(allProjects.values()).find((p) => p.name === dep.name)

  if (!project) {
    return {
      dependency: dep,
      health: 'unknown',
      lastChecked: Date.now(),
      error: `Referenced project "${dep.name}" not found`
    }
  }

  // Check if any of its declared ports are active
  const declaredPorts = Object.values(project.components).flatMap((c) => c.ports.map((p) => p.port))

  if (declaredPorts.length === 0) {
    return {
      dependency: dep,
      health: 'unknown',
      lastChecked: Date.now(),
      error: `Project "${dep.name}" has no declared ports`
    }
  }

  const activePortNumbers = new Set(activePorts.map((a) => a.port))
  const hasActivePort = declaredPorts.some((p) => activePortNumbers.has(p))

  return {
    dependency: dep,
    health: hasActivePort ? 'healthy' : 'unhealthy',
    lastChecked: Date.now(),
    error: hasActivePort ? undefined : `No active ports for project "${dep.name}"`
  }
}
