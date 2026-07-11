import { EventEmitter } from 'events'
import {
  Dependency,
  DependencyState,
  ResolvedProject,
  ActivePort
} from '../config/types'
import { checkDockerDependency } from './docker-checker'
import { checkServiceDependency } from './service-checker'
import { checkApiDependency } from './api-checker'
import { checkProjectDependency } from './project-checker'
import { buildDockerSnapshot } from './docker-snapshot'
import { DockerSnapshot } from '../config/types'

/**
 * Aggregates health check results for all dependencies across all projects.
 * Runs checks on a configurable interval.
 */
export class HealthAggregator extends EventEmitter {
  private timer: ReturnType<typeof setInterval> | null = null
  private results = new Map<string, DependencyState>()
  private dockerSnapshot: DockerSnapshot = { available: true, containers: [], missing: [] }
  private latestProjects = new Map<string, ResolvedProject>()
  private latestActivePorts: ActivePort[] = []

  constructor(private intervalMs: number = 10000) {
    super()
  }

  getResults(): Map<string, DependencyState> {
    return new Map(this.results)
  }

  getDockerSnapshot(): DockerSnapshot {
    return this.dockerSnapshot
  }

  startPeriodicCheck(
    getProjects: () => Map<string, ResolvedProject>,
    getActivePorts: () => ActivePort[]
  ): void {
    this.stop()

    // Run immediately
    this.checkAll(getProjects(), getActivePorts())

    this.timer = setInterval(() => {
      this.checkAll(getProjects(), getActivePorts())
    }, this.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async checkAll(
    projects: Map<string, ResolvedProject>,
    activePorts: ActivePort[]
  ): Promise<void> {
    this.latestProjects = projects
    this.latestActivePorts = activePorts
    const allDeps = collectAllDependencies(projects)
    const checks = allDeps.map(({ key, dep }) => this.checkOne(key, dep, projects, activePorts))

    await Promise.allSettled(checks)
    this.dockerSnapshot = await buildDockerSnapshot(projects)
    this.emit('health-updated', this.results)
  }

  /** Re-check docker containers and dependency health immediately. */
  async refreshDocker(): Promise<void> {
    await this.checkAll(this.latestProjects, this.latestActivePorts)
  }

  private async checkOne(
    key: string,
    dep: Dependency,
    projects: Map<string, ResolvedProject>,
    activePorts: ActivePort[]
  ): Promise<void> {
    let result: DependencyState

    switch (dep.type) {
      case 'docker':
        result = await checkDockerDependency(dep)
        break
      case 'service':
        result = await checkServiceDependency(dep)
        break
      case 'api':
        result = await checkApiDependency(dep)
        break
      case 'project':
        result = checkProjectDependency(dep, projects, activePorts)
        break
    }

    this.results.set(key, result)
  }
}

/** Collect all unique dependencies from all projects */
function collectAllDependencies(
  projects: Map<string, ResolvedProject>
): { key: string; dep: Dependency }[] {
  const deps: { key: string; dep: Dependency }[] = []
  const seen = new Set<string>()

  for (const project of projects.values()) {
    // Project-level dependencies
    for (const dep of project.dependencies) {
      const key = depKey(project.name, dep)
      if (!seen.has(key)) {
        seen.add(key)
        deps.push({ key, dep })
      }
    }

    // Component-level dependencies
    for (const [compName, comp] of Object.entries(project.components)) {
      if (comp.dependencies) {
        for (const dep of comp.dependencies) {
          const key = depKey(`${project.name}/${compName}`, dep)
          if (!seen.has(key)) {
            seen.add(key)
            deps.push({ key, dep })
          }
        }
      }
    }
  }

  return deps
}

function depKey(_owner: string, dep: Dependency): string {
  switch (dep.type) {
    case 'docker':
      return `docker:${dep.container}`
    case 'service':
      return `service:${dep.name}`
    case 'api':
      return `api:${dep.name}`
    case 'project':
      return `project:${dep.name}`
  }
}
